import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { AuthRequest } from '../types';
import { savingsGoalSchema } from '../utils/validators';
import { generateSavingsPrediction } from '../services/gemini';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Get All Goals ─────────────────────────────────────────────
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate health scores and predictions
  const enrichedGoals = goals.map((goal) => {
    const progress = goal.targetAmount > 0
      ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
      : 0;

    const monthsRemaining = goal.deadline
      ? Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)))
      : null;

    const monthlyNeeded = monthsRemaining
      ? (goal.targetAmount - goal.currentAmount) / monthsRemaining
      : goal.monthlyTarget || 0;

    // Simple health score based on progress and time
    let healthScore = 50;
    if (progress >= 75) healthScore = 90;
    else if (progress >= 50) healthScore = 75;
    else if (progress >= 25) healthScore = 60;
    if (monthsRemaining !== null && monthsRemaining <= 0 && progress < 100) healthScore = 20;

    return {
      ...goal,
      progress,
      healthScore,
      monthlyNeeded: Math.max(0, monthlyNeeded),
      monthsRemaining,
    };
  });

  res.json({ goals: enrichedGoals });
}));

// ─── Create Goal ───────────────────────────────────────────────
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = savingsGoalSchema.parse(req.body);

  const goal = await prisma.savingsGoal.create({
    data: {
      name: body.name,
      targetAmount: body.targetAmount,
      deadline: body.deadline ? new Date(body.deadline) : null,
      monthlyTarget: body.monthlyTarget,
      priority: body.priority || 'MEDIUM',
      userId: req.user!.id,
    },
  });

  res.status(201).json({ goal });
}));

// ─── Update Goal ───────────────────────────────────────────────
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const body = savingsGoalSchema.partial().parse(req.body);

  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: req.user!.id } });
  if (!goal) throw new AppError(404, 'Goal not found');

  const updated = await prisma.savingsGoal.update({
    where: { id },
    data: body,
  });

  res.json({ goal: updated });
}));

// ─── Add Funds to Goal ─────────────────────────────────────────
router.post('/:id/add-funds', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    throw new AppError(400, 'Amount must be positive');
  }

  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: req.user!.id } });
  if (!goal) throw new AppError(404, 'Goal not found');

  const newAmount = goal.currentAmount + amount;
  const status = newAmount >= goal.targetAmount ? 'COMPLETED' : goal.status;

  const updated = await prisma.savingsGoal.update({
    where: { id },
    data: { currentAmount: newAmount, status },
  });

  res.json({ goal: updated });
}));

// ─── Get AI Prediction ─────────────────────────────────────────
router.get('/:id/predict', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: req.user!.id } });
  if (!goal) throw new AppError(404, 'Goal not found');

  // Get user's monthly income/expenses for context
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: req.user!.id, type: 'INCOME', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: req.user!.id, type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
  ]);

  const result = await generateSavingsPrediction(
    goal.currentAmount,
    goal.targetAmount,
    goal.monthlyTarget || 0,
    expenses._sum.amount || 0
  );

  if (result.error) {
    res.status(502).json({
      prediction: result.prediction,
      error: {
        type: result.error.type,
        message: result.error.userMessage,
        retryable: result.error.retryable,
        statusCode: result.error.statusCode,
      },
    });
    return;
  }

  res.json({ prediction: result.prediction });
}));

// ─── Delete Goal ───────────────────────────────────────────────
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: req.user!.id } });
  if (!goal) throw new AppError(404, 'Goal not found');

  await prisma.savingsGoal.delete({ where: { id } });
  res.json({ message: 'Goal deleted successfully' });
}));

export default router;
