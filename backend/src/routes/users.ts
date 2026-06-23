import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { AuthRequest } from '../types';
import { updateUserSchema } from '../utils/validators';
import { uploadToCloudinary } from '../services/cloudinary';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Get Profile ───────────────────────────────────────────────
router.get('/profile', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true, email: true, name: true, avatar: true,
      role: true, isEmailVerified: true, mfaEnabled: true,
      provider: true, onboardingDone: true, createdAt: true,
    },
  });
  res.json({ user });
}));

// ─── Update Profile ────────────────────────────────────────────
router.put('/profile', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = updateUserSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: body,
    select: {
      id: true, email: true, name: true, avatar: true,
      role: true, onboardingDone: true,
    },
  });
  res.json({ user });
}));

// ─── Change Password ───────────────────────────────────────────
router.put('/password', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError(400, 'Current and new password are required');
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.password) {
    throw new AppError(400, 'Account uses OAuth login. Cannot change password.');
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new AppError(401, 'Current password is incorrect');
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { password: hashed },
  });

  // Invalidate all refresh tokens
  await prisma.refreshToken.deleteMany({ where: { userId: req.user!.id } });

  res.json({ message: 'Password changed successfully' });
}));

// ─── Upload Avatar ─────────────────────────────────────────────
router.post('/avatar', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { image } = req.body;
  if (!image) throw new AppError(400, 'Image is required');

  const url = await uploadToCloudinary(image, 'financeai/avatars');
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatar: url },
    select: { id: true, avatar: true },
  });
  res.json({ avatar: user.avatar });
}));

// ─── Complete Onboarding ───────────────────────────────────────
router.post('/onboarding', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { onboardingDone: true },
    select: { id: true, onboardingDone: true },
  });
  res.json({ user });
}));

// ─── Setup MFA ─────────────────────────────────────────────────
router.post('/mfa/setup', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { authenticator } = await import('otplib');
  const QRCode = await import('qrcode');

  const secret = authenticator.generateSecret();
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  const otpauthUrl = authenticator.keyuri(user!.email, 'FinanceAI', secret);

  // Store secret temporarily (not enabled yet)
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { mfaSecret: secret },
  });

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  res.json({ secret, qrCode: qrCodeDataUrl, otpauthUrl });
}));

// ─── Verify & Enable MFA ──────────────────────────────────────
router.post('/mfa/verify', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code } = req.body;
  const { authenticator } = await import('otplib');

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.mfaSecret) {
    throw new AppError(400, 'MFA not set up. Run setup first.');
  }

  const isValid = authenticator.verify({ token: code, secret: user.mfaSecret });
  if (!isValid) {
    throw new AppError(400, 'Invalid MFA code');
  }

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { mfaEnabled: true },
  });

  res.json({ message: 'MFA enabled successfully' });
}));

// ─── Disable MFA ───────────────────────────────────────────────
router.post('/mfa/disable', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code } = req.body;
  const { authenticator } = await import('otplib');

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.mfaSecret) throw new AppError(400, 'MFA not enabled');

  const isValid = authenticator.verify({ token: code, secret: user.mfaSecret });
  if (!isValid) throw new AppError(400, 'Invalid MFA code');

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  res.json({ message: 'MFA disabled successfully' });
}));

export default router;
