import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { transactionSchema, transactionUpdateSchema } from '../utils/validators';
import { AuthRequest } from '../types';
import { getMonthlyTrends, getCategoryBreakdown } from '../services/financeQuery';

const router = Router();

// GET /transactions
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const page = parseInt(String(req.query.page || '1'), 10);
  const limit = parseInt(String(req.query.limit || '20'), 10);
  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (req.query.type) where.type = String(req.query.type);
  if (req.query.category) where.category = String(req.query.category);
  if (req.query.startDate || req.query.endDate) {
    where.date = {};
    if (req.query.startDate) where.date.gte = new Date(String(req.query.startDate));
    if (req.query.endDate) where.date.lte = new Date(String(req.query.endDate));
  }
  if (req.query.search) {
    where.description = { contains: String(req.query.search), mode: 'insensitive' };
  }

  const sortField = String(req.query.sortBy || 'date');
  const sortOrder = String(req.query.sortOrder || 'desc');

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  res.json({
    success: true,
    data: transactions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

// GET /transactions/summary
router.get('/summary', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

  const [incomeResult, expenseResult, trends, categoryBreakdown, recentTransactions] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    getMonthlyTrends(userId),
    getCategoryBreakdown(userId),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ]);

  const totalIncome = incomeResult._sum.amount || 0;
  const totalExpenses = expenseResult._sum.amount || 0;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  res.json({
    success: true,
    data: {
      totalBalance: totalIncome - totalExpenses,
      totalIncome,
      totalExpenses,
      savingsRate: Math.round(savingsRate * 100) / 100,
      incomeTrend: trends,
      categoryBreakdown,
      recentTransactions,
    },
  });
}));

// POST /transactions
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const data = transactionSchema.parse(req.body);
  const date = typeof data.date === 'string' ? new Date(data.date) : data.date;

  const transaction = await prisma.transaction.create({
    data: { ...data, date, userId },
  });

  // Update budget spent if expense
  if (data.type === 'EXPENSE') {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const budget = await prisma.budget.findFirst({
      where: { userId, category: data.category, month, year },
    });

    if (budget) {
      await prisma.budget.update({
        where: { id: budget.id },
        data: { spent: { increment: data.amount } },
      });
    }
  }

  res.status(201).json({ success: true, data: transaction, message: 'Transaction created' });
}));

// PUT /transactions/:id
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const data = transactionUpdateSchema.parse(req.body);

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Transaction not found');

  // If changing amount or type, adjust budget
  if ((data.amount && data.amount !== existing.amount) || (data.type && data.type !== existing.type)) {
    const oldMonth = existing.date.getMonth() + 1;
    const oldYear = existing.date.getFullYear();
    const oldBudget = await prisma.budget.findFirst({
      where: { userId, category: data.category || existing.category, month: oldMonth, year: oldYear },
    });

    if (oldBudget && existing.type === 'EXPENSE') {
      await prisma.budget.update({
        where: { id: oldBudget.id },
        data: { spent: { decrement: existing.amount } },
      });
    }

    const newType = data.type || existing.type;
    if (newType === 'EXPENSE' && data.amount) {
      const newDate = data.date ? new Date(data.date) : existing.date;
      const newMonth = newDate.getMonth() + 1;
      const newYear = newDate.getFullYear();
      const newBudget = await prisma.budget.findFirst({
        where: { userId, category: data.category || existing.category, month: newMonth, year: newYear },
      });
      if (newBudget) {
        await prisma.budget.update({
          where: { id: newBudget.id },
          data: { spent: { increment: data.amount } },
        });
      }
    }
  }

  const updateData: any = { ...data };
  if (data.date) updateData.date = new Date(data.date);

  const transaction = await prisma.transaction.update({
    where: { id },
    data: updateData,
  });

  res.json({ success: true, data: transaction, message: 'Transaction updated' });
}));

// DELETE /transactions/:id
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Transaction not found');

  // Decrement budget spent if expense
  if (existing.type === 'EXPENSE') {
    const month = existing.date.getMonth() + 1;
    const year = existing.date.getFullYear();
    const budget = await prisma.budget.findFirst({
      where: { userId, category: existing.category, month, year },
    });
    if (budget) {
      await prisma.budget.update({
        where: { id: budget.id },
        data: { spent: { decrement: existing.amount } },
      });
    }
  }

  await prisma.transaction.delete({ where: { id } });
  res.json({ success: true, message: 'Transaction deleted' });
}));

export default router;
