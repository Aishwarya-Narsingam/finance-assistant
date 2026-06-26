import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { budgetSchema, budgetUpdateSchema } from '../utils/validators';
import { AuthRequest } from '../types';

const router = Router();

// GET /budgets
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const now = new Date();
  const month = parseInt(String(req.query.month || now.getMonth() + 1), 10);
  const year = parseInt(String(req.query.year || now.getFullYear()), 10);

  const budgets = await prisma.budget.findMany({
    where: { userId, month, year },
    orderBy: { category: 'asc' },
  });

  const budgetsWithPercentage = budgets.map((budget) => ({
    ...budget,
    spentPercentage: budget.amount > 0 ? Math.round((budget.spent / budget.amount) * 100 * 100) / 100 : 0,
    remaining: Math.max(0, budget.amount - budget.spent),
    isOverBudget: budget.spent > budget.amount,
  }));

  res.json({ success: true, data: budgetsWithPercentage });
}));

// POST /budgets
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const data = budgetSchema.parse(req.body);

  const budget = await prisma.budget.upsert({
    where: {
      userId_category_month_year: {
        userId,
        category: data.category,
        month: data.month,
        year: data.year,
      },
    },
    update: { name: data.name, amount: data.amount },
    create: { ...data, userId },
  });

  res.status(201).json({ success: true, data: budget, message: 'Budget saved' });
}));

// PUT /budgets/:id
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const data = budgetUpdateSchema.parse(req.body);

  const existing = await prisma.budget.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Budget not found');

  const budget = await prisma.budget.update({
    where: { id },
    data,
  });

  res.json({ success: true, data: budget, message: 'Budget updated' });
}));

// DELETE /budgets/:id
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = await prisma.budget.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Budget not found');

  await prisma.budget.delete({ where: { id } });
  res.json({ success: true, message: 'Budget deleted' });
}));

export default router;
