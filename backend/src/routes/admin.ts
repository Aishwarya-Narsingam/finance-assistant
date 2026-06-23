import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ─── Admin Dashboard Stats ─────────────────────────────────────
router.get('/dashboard', asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    newUsersThisMonth,
    totalTransactions,
    transactionsThisMonth,
    totalChatMessages,
    chatMessagesThisWeek,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      where: { transactions: { some: { date: { gte: sevenDaysAgo } } } },
      select: { id: true },
    }).then((u) => u.length),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { date: { gte: thirtyDaysAgo } } }),
    prisma.chatHistory.count(),
    prisma.chatHistory.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, email: true, name: true, role: true,
        isEmailVerified: true, createdAt: true,
        _count: { select: { transactions: true } },
      },
    }),
  ]);

  res.json({
    stats: {
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      totalTransactions,
      transactionsThisMonth,
      totalChatMessages,
      chatMessagesThisWeek,
    },
    recentUsers,
  });
}));

// ─── Get All Users ─────────────────────────────────────────────
router.get('/users', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', search } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      select: {
        id: true, email: true, name: true, avatar: true,
        role: true, isEmailVerified: true, mfaEnabled: true,
        provider: true, createdAt: true,
        _count: {
          select: { transactions: true, savingsGoals: true, reports: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    users,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
}));

// ─── Update User Role ──────────────────────────────────────────
router.patch('/users/:id/role', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  res.json({ user });
}));

// ─── Delete User ───────────────────────────────────────────────
router.delete('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await prisma.user.delete({ where: { id } });
  res.json({ message: 'User deleted successfully' });
}));

// ─── Get All Transactions (Admin) ──────────────────────────────
router.get('/transactions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.transaction.count(),
  ]);

  res.json({
    transactions,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
}));

// ─── Get AI Usage Stats ────────────────────────────────────────
router.get('/ai-usage', asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalMessages, messagesThisMonth, messagesThisWeek, activeChatters] = await Promise.all([
    prisma.chatHistory.count({ where: { role: 'user' } }),
    prisma.chatHistory.count({ where: { role: 'user', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.chatHistory.count({ where: { role: 'user', createdAt: { gte: sevenDaysAgo } } }),
    prisma.chatHistory.findMany({
      where: { role: 'user', createdAt: { gte: thirtyDaysAgo } },
      select: { userId: true },
      distinct: ['userId'],
    }).then((u) => u.length),
  ]);

  res.json({
    usage: { totalMessages, messagesThisMonth, messagesThisWeek, activeChatters },
  });
}));

// ─── Get Audit Logs ────────────────────────────────────────────
router.get('/audit-logs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.auditLog.count(),
  ]);

  res.json({
    logs,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
}));

export default router;
