import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Get Reports ───────────────────────────────────────────────
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '10' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.report.count({ where: { userId: req.user!.id } }),
  ]);

  res.json({
    reports,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}));

// ─── Generate Report ───────────────────────────────────────────
router.post('/generate', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, startDate, endDate } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);

  const [transactions, budgets, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: req.user!.id, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    }),
    prisma.budget.findMany({
      where: { userId: req.user!.id },
    }),
    prisma.savingsGoal.findMany({
      where: { userId: req.user!.id },
    }),
  ]);

  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  // Category breakdown
  const categoryBreakdown = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  // Financial health score
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  let healthScore = 50;
  if (savingsRate >= 30) healthScore = 90;
  else if (savingsRate >= 20) healthScore = 75;
  else if (savingsRate >= 10) healthScore = 60;
  else if (savingsRate >= 0) healthScore = 40;
  else healthScore = 20;

  const reportData = {
    period: { start, end },
    summary: { totalIncome, totalExpenses, savingsRate: Math.round(savingsRate), healthScore },
    categoryBreakdown,
    transactionCount: transactions.length,
    goalProgress: goals.map((g) => ({
      name: g.name,
      progress: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
    })),
  };

  const report = await prisma.report.create({
    data: {
      type,
      startDate: start,
      endDate: end,
      data: reportData,
      userId: req.user!.id,
    },
  });

  res.status(201).json({ report });
}));

// ─── Get Single Report ─────────────────────────────────────────
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const report = await prisma.report.findFirst({
    where: { id, userId: req.user!.id },
  });
  if (!report) throw new AppError(404, 'Report not found');
  res.json({ report });
}));

// ─── Delete Report ─────────────────────────────────────────────
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const report = await prisma.report.findFirst({
    where: { id, userId: req.user!.id },
  });
  if (!report) throw new AppError(404, 'Report not found');
  await prisma.report.delete({ where: { id } });
  res.json({ message: 'Report deleted successfully' });
}));

export default router;
