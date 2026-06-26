import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { goalSchema, goalUpdateSchema, addFundsSchema } from '../utils/validators';
import { AuthRequest } from '../types';
import { generateChatResponse } from '../services/groq';

const router = Router();

// GET /goals
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const goals = await prisma.savingsGoal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const goalsWithHealth = goals.map((goal) => {
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    let healthScore = 50;

    if (goal.deadline && goal.status === 'ACTIVE') {
      const totalDays = (goal.deadline.getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const elapsedDays = (Date.now() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const expectedProgress = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;
      healthScore = expectedProgress > 0 ? Math.min(100, Math.round((progress / expectedProgress) * 50) + 50) : 50;
    } else if (goal.monthlyTarget && goal.monthlyTarget > 0) {
      const monthsElapsed = goal.currentAmount / goal.monthlyTarget;
      const requiredMonths = goal.targetAmount / goal.monthlyTarget;
      healthScore = requiredMonths > 0 ? Math.min(100, Math.round((monthsElapsed / requiredMonths) * 100)) : 50;
    }

    return {
      ...goal,
      progress: Math.round(progress * 100) / 100,
      healthScore: Math.max(1, Math.min(100, healthScore)),
      isCompleted: goal.currentAmount >= goal.targetAmount,
    };
  });

  res.json({ success: true, data: goalsWithHealth });
}));

// POST /goals
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const data = goalSchema.parse(req.body);

  const goal = await prisma.savingsGoal.create({
    data: {
      ...data,
      deadline: data.deadline ? new Date(data.deadline) : null,
      userId,
    },
  });

  res.status(201).json({ success: true, data: goal, message: 'Goal created' });
}));

// PUT /goals/:id
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const data = goalUpdateSchema.parse(req.body);

  const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Goal not found');

  const updateData: any = { ...data };
  if (data.deadline) updateData.deadline = new Date(data.deadline);

  const goal = await prisma.savingsGoal.update({ where: { id }, data: updateData });
  res.json({ success: true, data: goal, message: 'Goal updated' });
}));

// POST /goals/:id/add-funds
router.post('/:id/add-funds', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { amount } = addFundsSchema.parse(req.body);

  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!goal) throw new AppError(404, 'Goal not found');

  const newAmount = goal.currentAmount + amount;
  const isComplete = newAmount >= goal.targetAmount;

  const updated = await prisma.savingsGoal.update({
    where: { id },
    data: {
      currentAmount: newAmount,
      ...(isComplete ? { status: 'COMPLETED' } : {}),
    },
  });

  res.json({
    success: true,
    data: updated,
    message: isComplete ? '🎉 Goal completed!' : 'Funds added successfully',
  });
}));

// GET /goals/:id/predict
router.get('/:id/predict', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!goal) throw new AppError(404, 'Goal not found');

  const prompt = `I have a savings goal named "${goal.name}" with a target of ₹${goal.targetAmount.toLocaleString('en-IN')}. I've currently saved ₹${goal.currentAmount.toLocaleString('en-IN')} (${((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)}% complete).${goal.deadline ? ` The deadline is ${goal.deadline.toDateString()}.` : ''}${goal.monthlyTarget ? ` I contribute ₹${goal.monthlyTarget.toLocaleString('en-IN')} per month.` : ''} Can you provide a prediction for when I'll reach this goal and any suggestions to speed it up?`;

  try {
    const prediction = await generateChatResponse(prompt, `Goal: ${goal.name}
Target: ₹${goal.targetAmount}
Current: ₹${goal.currentAmount}
Progress: ${((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)}%
${goal.deadline ? `Deadline: ${goal.deadline.toDateString()}` : ''}
${goal.monthlyTarget ? `Monthly Target: ₹${goal.monthlyTarget}` : ''}
Status: ${goal.status}`);
    res.json({ success: true, data: { goal, prediction } });
  } catch {
    // Fallback if AI fails
    const remaining = goal.targetAmount - goal.currentAmount;
    const monthsToComplete = goal.monthlyTarget && goal.monthlyTarget > 0
      ? Math.ceil(remaining / goal.monthlyTarget)
      : null;

    res.json({
      success: true,
      data: {
        goal,
        prediction: `Based on your current progress, you have saved ${((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)}% of your target.${monthsToComplete ? ` At your monthly target of ₹${goal.monthlyTarget}, you'll reach your goal in approximately ${monthsToComplete} month(s).` : ''}`,
      },
    });
  }
}));

// DELETE /goals/:id
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Goal not found');

  await prisma.savingsGoal.delete({ where: { id } });
  res.json({ success: true, message: 'Goal deleted' });
}));

export default router;
