import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { AuthRequest, BudgetQuery } from '../types';
import { budgetSchema } from '../utils/validators';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Get Budgets ───────────────────────────────────────────────
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { month, year } = req.query as BudgetQuery;
  const now = new Date();
  const m = parseInt(month || String(now.getMonth() + 1));
  const y = parseInt(year || String(now.getFullYear()));

  const budgets = await prisma.budget.findMany({
    where: { userId: req.user!.id, month: m, year: y },
    orderBy: { category: 'asc' },
  });

  // Get actual spending per category
  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0);

  const spending = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      userId: req.user!.id,
      type: 'EXPENSE',
      date: { gte: startOfMonth, lte: endOfMonth },
    },
    _sum: { amount: true },
  });

  const spendingMap = new Map(spending.map((s) => [s.category, s._sum.amount || 0]));

  const budgetsWithSpending = budgets.map((b) => ({
    ...b,
    spent: spendingMap.get(b.category) || 0,
    percentage: spendingMap.get(b.category)
      ? Math.round(((spendingMap.get(b.category) || 0) / b.amount) * 100)
      : 0,
  }));

  res.json({ budgets: budgetsWithSpending, month: m, year: y });
}));

// ─── Create Budget ─────────────────────────────────────────────
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = budgetSchema.parse(req.body);

  const budget = await prisma.budget.upsert({
    where: {
      userId_category_month_year: {
        userId: req.user!.id,
        category: body.category,
        month: body.month,
        year: body.year,
      },
    },
    update: { amount: body.amount, name: body.name },
    create: {
      name: body.name,
      amount: body.amount,
      category: body.category,
      month: body.month,
      year: body.year,
      userId: req.user!.id,
    },
  });

  res.status(201).json({ budget });
}));

// ─── Update Budget ─────────────────────────────────────────────
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { amount, name } = req.body;

  const budget = await prisma.budget.findFirst({ where: { id, userId: req.user!.id } });
  if (!budget) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  const updated = await prisma.budget.update({
    where: { id },
    data: { ...(amount && { amount }), ...(name && { name }) },
  });

  res.json({ budget: updated });
}));

// ─── Delete Budget ─────────────────────────────────────────────
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const budget = await prisma.budget.findFirst({ where: { id, userId: req.user!.id } });
  if (!budget) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  await prisma.budget.delete({ where: { id } });
  res.json({ message: 'Budget deleted successfully' });
}));

export default router;
