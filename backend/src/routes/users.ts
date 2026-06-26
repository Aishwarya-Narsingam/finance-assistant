import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { updateProfileSchema, changePasswordSchema, onboardingSchema, mfaVerifySchema } from '../utils/validators';
import { AuthRequest } from '../types';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

const router = Router();

// GET /users/profile
router.get('/profile', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true, avatar: true, isEmailVerified: true, mfaEnabled: true, onboardingDone: true, createdAt: true },
  });
  res.json({ success: true, data: user });
}));

// PUT /users/profile
router.put('/profile', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
    select: { id: true, email: true, name: true, role: true, avatar: true, isEmailVerified: true, mfaEnabled: true, onboardingDone: true },
  });
  res.json({ success: true, data: user, message: 'Profile updated' });
}));

// PUT /users/password
router.put('/password', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.password) {
    throw new AppError(400, 'Cannot change password for OAuth accounts');
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new AppError(401, 'Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

  res.json({ success: true, message: 'Password changed successfully' });
}));

// POST /users/avatar
router.post('/avatar', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { url } = req.body;
  if (!url) throw new AppError(400, 'Avatar URL is required');

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatar: url },
    select: { avatar: true },
  });

  res.json({ success: true, data: user, message: 'Avatar updated' });
}));

// POST /users/onboarding
router.post('/onboarding', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  onboardingSchema.parse(req.body);

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { onboardingDone: true },
  });

  res.json({ success: true, message: 'Onboarding completed' });
}));

// POST /users/mfa/setup
router.post('/mfa/setup', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(req.user!.email, 'FinanceAI', secret);

  const qrCode = await qrcode.toDataURL(otpauth);

  // Save secret temporarily
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { mfaSecret: secret },
  });

  res.json({ success: true, data: { secret, qrCode } });
}));

// POST /users/mfa/verify
router.post('/mfa/verify', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { token } = mfaVerifySchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.mfaSecret) {
    throw new AppError(400, 'MFA not set up. Generate a secret first.');
  }

  const isValid = authenticator.verify({ token, secret: user.mfaSecret });
  if (!isValid) {
    throw new AppError(401, 'Invalid MFA token');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true },
  });

  res.json({ success: true, message: 'MFA enabled successfully' });
}));

// POST /users/mfa/disable
router.post('/mfa/disable', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { token } = mfaVerifySchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.mfaSecret) {
    throw new AppError(400, 'MFA is not enabled');
  }

  const isValid = authenticator.verify({ token, secret: user.mfaSecret });
  if (!isValid) {
    throw new AppError(401, 'Invalid MFA token');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  res.json({ success: true, message: 'MFA disabled successfully' });
}));

export default router;
