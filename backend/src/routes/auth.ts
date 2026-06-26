import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { generateSecureToken } from '../utils/crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../utils/validators';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';
import { config } from '../config';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { AuthRequest } from '../types';

const router = Router();

// POST /auth/register
router.post('/register', asyncHandler(async (req, res: Response) => {
  const { email, password, name } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'A user with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
    select: { id: true, email: true, name: true, role: true, avatar: true, isEmailVerified: true, mfaEnabled: true, onboardingDone: true, createdAt: true },
  });

  const jwtPayload = { userId: user.id, email: user.email, role: user.role };

  // Generate verification token
  const verifyToken = generateSecureToken();
  await prisma.emailVerification.create({
    data: {
      token: verifyToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  // Send verification email (non-blocking)
  sendVerificationEmail(email, verifyToken, name);

  // Generate tokens
  const accessToken = generateAccessToken(jwtPayload);
  const refreshToken = generateRefreshToken(jwtPayload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  res.status(201).json({
    success: true,
    data: { user, accessToken },
    message: 'Registration successful. Please verify your email.',
  });
}));

// POST /auth/login
router.post('/login', asyncHandler(async (req, res: Response) => {
  const { email, password, mfaToken } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    throw new AppError(401, 'Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new AppError(401, 'Invalid email or password');
  }

  // Check MFA
  if (user.mfaEnabled && user.mfaSecret) {
    if (!mfaToken) {
      res.json({
        success: true,
        data: { mfaRequired: true, userId: user.id },
        message: 'MFA token required',
      });
      return;
    }

    const isValidMfa = authenticator.verify({ token: mfaToken, secret: user.mfaSecret });
    if (!isValidMfa) {
      throw new AppError(401, 'Invalid MFA token');
    }
  }

  const jwtPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(jwtPayload);
  const refreshToken = generateRefreshToken(jwtPayload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        mfaEnabled: user.mfaEnabled,
        onboardingDone: user.onboardingDone,
      },
      accessToken,
    },
    message: 'Login successful',
  });
}));

// POST /auth/refresh
router.post('/refresh', asyncHandler(async (req, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    throw new AppError(401, 'Refresh token not found');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  // Delete old token
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  // Verify and generate new pair
  const decoded = verifyRefreshToken(token);
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, name: true, role: true, avatar: true, isEmailVerified: true, mfaEnabled: true, onboardingDone: true },
  });

  if (!user) throw new AppError(401, 'User not found');

  const jwtPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(jwtPayload);
  const newRefreshToken = generateRefreshToken(jwtPayload);

  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  res.json({
    success: true,
    data: { accessToken, user },
  });
}));

// POST /auth/logout
router.post('/logout', asyncHandler(async (req, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }

  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ success: true, message: 'Logged out successfully' });
}));

// GET /auth/verify-email
router.get('/verify-email', asyncHandler(async (req, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    throw new AppError(400, 'Verification token is required');
  }

  const verification = await prisma.emailVerification.findUnique({ where: { token } });
  if (!verification || verification.used || verification.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired verification token');
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: verification.userId }, data: { isEmailVerified: true } }),
    prisma.emailVerification.update({ where: { id: verification.id }, data: { used: true } }),
  ]);

  res.json({ success: true, message: 'Email verified successfully' });
}));

// POST /auth/forgot-password
router.post('/forgot-password', asyncHandler(async (req, res: Response) => {
  const { email } = forgotPasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = generateSecureToken();
    await prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
    sendPasswordResetEmail(email, token, user.name);
  }

  res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
}));

// POST /auth/reset-password
router.post('/reset-password', asyncHandler(async (req, res: Response) => {
  const { token, password } = resetPasswordSchema.parse(req.body);

  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (!reset || reset.used || reset.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired reset token');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { password: hashedPassword } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
    // Invalidate all refresh tokens
    prisma.refreshToken.deleteMany({ where: { userId: reset.userId } }),
  ]);

  res.json({ success: true, message: 'Password reset successfully' });
}));

// GET /auth/google - Redirect to Google OAuth
router.get('/google', (_req, res: Response) => {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /auth/google/callback
router.get('/google/callback', asyncHandler(async (req, res: Response) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    throw new AppError(400, 'Authorization code is required');
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData: any = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new AppError(400, 'Failed to get Google access token');
  }

  // Get user info from Google
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const googleUser: any = await userResponse.json();

  if (!googleUser.email) {
    throw new AppError(400, 'Failed to get Google user info');
  }

  // Find or create user
  let user = await prisma.user.findFirst({
    where: { OR: [{ providerId: googleUser.id }, { email: googleUser.email }] },
  });

  if (user) {
    // Link Google account if not already linked
    if (!user.providerId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { provider: 'google', providerId: googleUser.id, isEmailVerified: true },
      });
    }
  } else {
    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        avatar: googleUser.picture,
        provider: 'google',
        providerId: googleUser.id,
        isEmailVerified: true,
      },
    });
  }

  const jwtPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(jwtPayload);
  const refreshToken = generateRefreshToken(jwtPayload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  res.redirect(`${config.frontendUrl}/auth/callback?token=${accessToken}`);
}));

// GET /auth/me
router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { user: req.user } });
}));

export default router;
