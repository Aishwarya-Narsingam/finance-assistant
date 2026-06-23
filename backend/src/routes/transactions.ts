import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { AuthRequest, TransactionQuery } from '../types';
import { transactionSchema } from '../utils/validators';
import { Prisma, Category, TransactionType } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Get All Transactions ──────────────────────────────────────
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    page = '1', limit = '20', search, sortBy = 'date',
    sortOrder = 'desc', type, category, startDate, endDate,
  } = req.query as TransactionQuery;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.TransactionWhereInput = { userId: req.user!.id };

  if (type) where.type = type as TransactionType;
  if (category) where.category = category as Category;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { description: { contains: search } },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.transaction.count({ where }),
  ]);

  res.json({
    transactions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}));

// ─── Get Transaction Summary ───────────────────────────────────
router.get('/summary', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [income, expenses, categoryBreakdown] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: req.user!.id, type: 'INCOME', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: req.user!.id, type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['category'],
      where: { userId: req.user!.id, type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
  ]);

  const monthlyIncome = income._sum.amount || 0;
  const monthlyExpenses = expenses._sum.amount || 0;

  // Calculate total savings
  const allTimeIncome = await prisma.transaction.aggregate({
    where: { userId: req.user!.id, type: 'INCOME' },
    _sum: { amount: true },
  });
  const allTimeExpenses = await prisma.transaction.aggregate({
    where: { userId: req.user!.id, type: 'EXPENSE' },
    _sum: { amount: true },
  });

  const totalSavings = (allTimeIncome._sum.amount || 0) - (allTimeExpenses._sum.amount || 0);

  // Active goals count
  const activeGoals = await prisma.savingsGoal.count({
    where: { userId: req.user!.id, status: 'ACTIVE' },
  });

  // Monthly trends (last 6 months)
  const monthlyTrends = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const [monthIncome, monthExpenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: req.user!.id, type: 'INCOME', date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.user!.id, type: 'EXPENSE', date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
    ]);

    monthlyTrends.push({
      month: monthStart.toLocaleString('default', { month: 'short' }),
      income: monthIncome._sum.amount || 0,
      expenses: monthExpenses._sum.amount || 0,
    });
  }

  // Recent transactions
  const recentTransactions = await prisma.transaction.findMany({
    where: { userId: req.user!.id },
    orderBy: { date: 'desc' },
    take: 5,
  });

  res.json({
    totalBalance: (allTimeIncome._sum.amount || 0) - (allTimeExpenses._sum.amount || 0),
    monthlyIncome,
    monthlyExpenses,
    totalSavings,
    activeGoals,
    expenseByCategory: categoryBreakdown.map((c) => ({
      name: c.category,
      value: c._sum.amount || 0,
    })),
    monthlyTrends,
    recentTransactions,
  });
}));

// ─── Create Transaction ────────────────────────────────────────
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = transactionSchema.parse(req.body);

  const transaction = await prisma.transaction.create({
    data: {
      amount: body.amount,
      type: body.type,
      category: body.category,
      description: body.description,
      date: body.date ? new Date(body.date) : new Date(),
      userId: req.user!.id,
    },
  });

  // Update budget spent amount if expense
  if (body.type === 'EXPENSE') {
    const now = new Date();
    await prisma.budget.upsert({
      where: {
        userId_category_month_year: {
          userId: req.user!.id,
          category: body.category,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
      },
      update: { spent: { increment: body.amount } },
      create: {
        name: `${body.category} Budget`,
        amount: body.amount,
        category: body.category,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        spent: body.amount,
        userId: req.user!.id,
      },
    });
  }

  res.status(201).json({ transaction });
}));

// ─── Update Transaction ────────────────────────────────────────
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const body = transactionSchema.partial().parse(req.body);

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: req.user!.id },
  });
  if (!existing) throw new AppError(404, 'Transaction not found');

  const transaction = await prisma.transaction.update({
    where: { id },
    data: body,
  });

  res.json({ transaction });
}));

// ─── Delete Transaction ────────────────────────────────────────
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: req.user!.id },
  });
  if (!existing) throw new AppError(404, 'Transaction not found');

  await prisma.transaction.delete({ where: { id } });
  res.json({ message: 'Transaction deleted successfully' });
}));

export default router;
