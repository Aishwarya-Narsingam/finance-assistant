import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { AppError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, getRefreshTokenExpiry } from '../utils/jwt';
import { generateToken } from '../utils/crypto';
import { sendEmail, verificationEmailHtml, passwordResetHtml } from '../services/email';
import { config } from '../config';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validators';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Register ──────────────────────────────────────────────────
router.post('/register', asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({ where: { email: body.email } });
  if (existingUser) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: {
      email: body.email,
      password: hashedPassword,
      name: body.name,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  // Send verification email
  const verificationToken = generateToken();
  await prisma.emailVerification.create({
    data: {
      token: verificationToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  const verificationUrl = `${config.frontendUrl}/auth/verify-email?token=${verificationToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your FinanceAI account',
    html: verificationEmailHtml(user.name, verificationUrl),
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: config.cookie.maxAge,
  });

  res.status(201).json({ user, accessToken });
}));

// ─── Login ─────────────────────────────────────────────────────
router.post('/login', asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.password) {
    throw new AppError(401, 'Invalid email or password');
  }

  const isValid = await bcrypt.compare(body.password, user.password);
  if (!isValid) {
    throw new AppError(401, 'Invalid email or password');
  }

  // Check MFA
  if (user.mfaEnabled) {
    if (!body.mfaCode) {
      return res.status(200).json({ requiresMfa: true });
    }
    const { authenticator } = await import('otplib');
    const isValid = authenticator.verify({
      token: body.mfaCode,
      secret: user.mfaSecret!,
    });
    if (!isValid) {
      throw new AppError(401, 'Invalid MFA code');
    }
  }

  const userData = { id: user.id, email: user.email, name: user.name, role: user.role };
  const accessToken = generateAccessToken(userData);
  const refreshToken = generateRefreshToken(userData);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: config.cookie.maxAge,
  });

  res.json({ user: userData, accessToken });
}));

// ─── Refresh Token ─────────────────────────────────────────────
router.post('/refresh', asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  if (!token) {
    throw new AppError(401, 'Refresh token required');
  }

  const payload = verifyRefreshToken(token);
  const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  // Rotate refresh token
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  // Clean up expired refresh tokens for this user
  await prisma.refreshToken.deleteMany({
    where: { userId: payload.id, expiresAt: { lt: new Date() } },
  });

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) {
    throw new AppError(401, 'User not found');
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: config.cookie.maxAge,
  });

  res.json({ accessToken: newAccessToken });
}));

// ─── Logout ────────────────────────────────────────────────────
router.post('/logout', asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
}));

// ─── Verify Email ──────────────────────────────────────────────
router.get('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.query as { token: string };
  if (!token) throw new AppError(400, 'Token is required');

  const verification = await prisma.emailVerification.findUnique({ where: { token } });
  if (!verification || verification.used || verification.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired verification token');
  }

  await prisma.user.update({
    where: { id: verification.userId },
    data: { isEmailVerified: true },
  });

  await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { used: true },
  });

  res.json({ message: 'Email verified successfully' });
}));

// ─── Forgot Password ───────────────────────────────────────────
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const body = forgotPasswordSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ message: 'If an account exists, a reset email has been sent' });
  }

  const resetToken = generateToken();
  await prisma.passwordReset.create({
    data: {
      token: resetToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  const resetUrl = `${config.frontendUrl}/auth/reset-password?token=${resetToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your FinanceAI password',
    html: passwordResetHtml(user.name, resetUrl),
  });

  res.json({ message: 'If an account exists, a reset email has been sent' });
}));

// ─── Reset Password ────────────────────────────────────────────
router.post('/reset-password', asyncHandler(async (req, res) => {
  const body = resetPasswordSchema.parse(req.body);

  const reset = await prisma.passwordReset.findUnique({ where: { token: body.token } });
  if (!reset || reset.used || reset.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired reset token');
  }

  const hashedPassword = await bcrypt.hash(body.password, 12);
  await prisma.user.update({
    where: { id: reset.userId },
    data: { password: hashedPassword },
  });

  await prisma.passwordReset.update({
    where: { id: reset.id },
    data: { used: true },
  });

  // Invalidate all refresh tokens for this user
  await prisma.refreshToken.deleteMany({ where: { userId: reset.userId } });

  res.json({ message: 'Password reset successfully' });
}));

// ─── Google OAuth ──────────────────────────────────────────────
router.get('/google', asyncHandler(async (req, res) => {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}));

router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, error } = req.query as { code?: string; error?: string };
  if (error || !code) {
    return res.redirect(`${config.frontendUrl}/auth/login?error=google_auth_failed`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as Record<string, any>;

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json() as Record<string, any>;

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { provider: 'google', providerId: googleUser.id },
    });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: googleUser.email } });
      if (user) {
        // Link Google account
        user = await prisma.user.update({
          where: { id: user.id },
          data: { provider: 'google', providerId: googleUser.id, avatar: googleUser.picture },
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: googleUser.email,
            name: googleUser.name,
            avatar: googleUser.picture,
            provider: 'google',
            providerId: googleUser.id,
            isEmailVerified: true,
          },
        });
      }
    }

    const userData = { id: user.id, email: user.email, name: user.name, role: user.role };
    const accessToken = generateAccessToken(userData);
    const refreshToken = generateRefreshToken(userData);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    // Redirect to frontend with tokens (use HTTPS in production)
    const frontendRedirect = process.env.NODE_ENV === 'production'
      ? config.frontendUrl.replace(/^http:/i, 'https:')
      : config.frontendUrl;
    res.redirect(`${frontendRedirect}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${config.frontendUrl}/auth/login?error=google_auth_failed`);
  }
}));

// ─── Get Current User ──────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
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

export default router;
