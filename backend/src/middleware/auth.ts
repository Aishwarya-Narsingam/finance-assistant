import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AuthRequest } from '../types';
import { AppError } from './error';
import { prisma } from '../config/prisma';

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Access token required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isEmailVerified: true,
        mfaEnabled: true,
        onboardingDone: true,
      },
    });

    if (!user) {
      throw new AppError(401, 'User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(401, 'Invalid or expired token'));
    }
  }
}

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    next(new AppError(403, 'Admin access required'));
    return;
  }
  next();
}
