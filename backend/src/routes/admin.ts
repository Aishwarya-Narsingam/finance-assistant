import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /admin/dashboard
router.get('/dashboard', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

  const [totalUsers, activeUsers, totalTransactions, monthlyTransactions, aiUsage, recentLogs] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.chatHistory.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { name: true, email: true } } } }),
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsersThisMonth: activeUsers,
      totalTransactions,
      monthlyTransactions,
      aiMessagesThisMonth: aiUsage,
      recentLogs,
    },
  });
}));

// GET /admin/users
router.get('/users', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const search = req.query.search as string;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, avatar: true, isEmailVerified: true, mfaEnabled: true, onboardingDone: true, createdAt: true, _count: { select: { transactions: true, chatHistories: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

// PATCH /admin/users/:id/role
router.patch('/users/:id/role', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !['USER', 'ADMIN'].includes(role)) {
    throw new AppError(400, 'Invalid role. Must be USER or ADMIN');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'User not found');

  const updated = await prisma.user.update({
    where: { id },
    data: { role: role as Role },
    select: { id: true, email: true, name: true, role: true },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      action: 'ROLE_CHANGE',
      entity: 'User',
      entityId: id,
      userId: req.user!.id,
      details: { oldRole: user.role, newRole: role },
      ipAddress: req.ip,
    },
  });

  res.json({ success: true, data: updated, message: 'User role updated' });
}));

// DELETE /admin/users/:id
router.delete('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'User not found');
  if (user.role === 'ADMIN' && user.id !== req.user!.id) {
    throw new AppError(403, 'Cannot delete another admin');
  }

  await prisma.user.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      action: 'USER_DELETE',
      entity: 'User',
      entityId: id,
      userId: req.user!.id,
      details: { deletedUser: user.email },
      ipAddress: req.ip,
    },
  });

  res.json({ success: true, message: 'User deleted' });
}));

// GET /admin/transactions
router.get('/transactions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.transaction.count(),
  ]);

  res.json({
    success: true,
    data: transactions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

// GET /admin/ai-usage
router.get('/ai-usage', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const now = new Date();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [weeklyMessages, monthlyMessages, uniqueUsers, totalMessages] = await Promise.all([
    prisma.chatHistory.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.chatHistory.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.chatHistory.groupBy({ by: ['userId'], _count: true, where: { createdAt: { gte: startOfMonth } } }),
    prisma.chatHistory.count(),
  ]);

  res.json({
    success: true,
    data: {
      totalMessages,
      weeklyMessages,
      monthlyMessages,
      activeUsersThisMonth: uniqueUsers.length,
    },
  });
}));

// GET /admin/audit-logs
router.get('/audit-logs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const action = req.query.action as string;

  const where: any = {};
  if (action) where.action = action;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

export default router;
