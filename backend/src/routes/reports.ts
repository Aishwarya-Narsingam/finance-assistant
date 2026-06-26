import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { reportSchema } from '../utils/validators';
import { AuthRequest } from '../types';

const router = Router();

function calculateHealthScore(data: { totalIncome: number; totalExpenses: number; savingsGoals?: any[] }): number {
  const { totalIncome, totalExpenses, savingsGoals } = data;

  if (totalIncome === 0) return 20;

  const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;

  // Savings rate score (0-40 points)
  let score = 0;
  if (savingsRate >= 30) score += 40;
  else if (savingsRate >= 20) score += 35;
  else if (savingsRate >= 10) score += 25;
  else if (savingsRate >= 5) score += 15;
  else if (savingsRate > 0) score += 10;

  // Income stability (0-20 points)
  if (totalIncome >= 100000) score += 20;
  else if (totalIncome >= 50000) score += 15;
  else if (totalIncome >= 25000) score += 10;
  else score += 5;

  // Goal progress (0-20 points)
  if (savingsGoals && savingsGoals.length > 0) {
    const avgProgress = savingsGoals.reduce((sum, g) => {
      return sum + (g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0);
    }, 0) / savingsGoals.length;

    if (avgProgress >= 75) score += 20;
    else if (avgProgress >= 50) score += 15;
    else if (avgProgress >= 25) score += 10;
    else score += 5;
  } else {
    score += 10; // No goals = neutral
  }

  // Expense ratio (0-20 points)
  const expenseRatio = totalIncome > 0 ? totalExpenses / totalIncome : 0;
  if (expenseRatio <= 0.5) score += 20;
  else if (expenseRatio <= 0.7) score += 15;
  else if (expenseRatio <= 0.9) score += 10;
  else if (expenseRatio < 1) score += 5;

  return Math.max(5, Math.min(95, Math.round(score)));
}

// GET /reports
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.report.count({ where: { userId } }),
  ]);

  res.json({
    success: true,
    data: reports,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

// POST /reports/generate
router.post('/generate', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { type, startDate: sd, endDate: ed } = reportSchema.parse(req.body);

  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  if (type === 'WEEKLY') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  } else if (type === 'MONTHLY') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  } else if (type === 'YEARLY') {
    startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  } else if (sd && ed) {
    startDate = new Date(sd);
    endDate = new Date(ed);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  }

  const [transactions, goals, budgets] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: { gte: startDate, lte: endDate } }, orderBy: { date: 'desc' } }),
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.budget.findMany({ where: { userId } }),
  ]);

  const totalIncome = transactions.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);

  const categoryBreakdown: Record<string, number> = {};
  transactions.filter((t) => t.type === 'EXPENSE').forEach((t) => {
    categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
  });

  const healthScore = calculateHealthScore({ totalIncome, totalExpenses, savingsGoals: goals });

  const reportData = {
    generatedAt: new Date().toISOString(),
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    summary: { totalIncome, totalExpenses, netSavings: totalIncome - totalExpenses, savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0, transactionCount: transactions.length },
    categoryBreakdown,
    healthScore,
    goalProgress: goals.map((g) => ({ name: g.name, progress: g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0, status: g.status })),
    topExpenses: transactions.filter((t) => t.type === 'EXPENSE').sort((a, b) => b.amount - a.amount).slice(0, 5),
    budgets: budgets.map((b) => ({ name: b.name, budgeted: b.amount, spent: b.spent, remaining: Math.max(0, b.amount - b.spent), percentage: b.amount > 0 ? (b.spent / b.amount) * 100 : 0 })),
  };

  const report = await prisma.report.create({
    data: {
      type,
      startDate,
      endDate,
      data: reportData,
      userId,
    },
  });

  res.status(201).json({ success: true, data: report, message: 'Report generated' });
}));

// GET /reports/:id
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const report = await prisma.report.findFirst({ where: { id, userId } });
  if (!report) throw new AppError(404, 'Report not found');

  res.json({ success: true, data: report });
}));

// DELETE /reports/:id
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = await prisma.report.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Report not found');

  await prisma.report.delete({ where: { id } });
  res.json({ success: true, message: 'Report deleted' });
}));

export default router;
