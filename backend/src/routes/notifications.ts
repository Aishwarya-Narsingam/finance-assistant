import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { sendEmail } from '../services/email';
import { config } from '../config';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ─── Get Notifications ─────────────────────────────────────────
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', unreadOnly } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const where: any = { userId: req.user!.id };
  if (unreadOnly === 'true') where.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
  ]);

  res.json({
    notifications,
    unreadCount,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}));

// ─── Mark as Read ──────────────────────────────────────────────
router.patch('/:id/read', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await prisma.notification.updateMany({
    where: { id, userId: req.user!.id },
    data: { read: true },
  });
  res.json({ message: 'Notification marked as read' });
}));

// ─── Mark All as Read ──────────────────────────────────────────
router.patch('/read-all', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  });
  res.json({ message: 'All notifications marked as read' });
}));

// ─── Delete Notification ───────────────────────────────────────
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await prisma.notification.deleteMany({
    where: { id, userId: req.user!.id },
  });
  res.json({ message: 'Notification deleted' });
}));

// ─── Check Budget Alerts ───────────────────────────────────────
router.get('/check-budgets', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const budgets = await prisma.budget.findMany({
    where: { userId: req.user!.id, month: now.getMonth() + 1, year: now.getFullYear() },
  });

  for (const budget of budgets) {
    const percentage = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;

    if (percentage >= 100) {
      // Overspending alert
      const existing = await prisma.notification.findMany({
        where: {
          userId: req.user!.id,
          type: 'OVERSPENDING',
        },
        take: 1,
      });

      const hasAlert = existing.some((n) => n.message.includes(budget.name));

      if (!hasAlert) {
        await prisma.notification.create({
          data: {
            title: 'Overspending Alert',
            message: `You've exceeded your ${budget.name} budget by ₹${Math.round(budget.spent - budget.amount)}. Consider reducing spending in this category.`,
            type: 'OVERSPENDING',
            userId: req.user!.id,
          },
        });
      }
    } else if (percentage >= 80) {
      const existing = await prisma.notification.findMany({
        where: {
          userId: req.user!.id,
          type: 'BUDGET_ALERT',
        },
        take: 1,
      });

      const hasAlert = existing.some((n) => n.message.includes(budget.name));

      if (!hasAlert) {
        await prisma.notification.create({
          data: {
            title: 'Budget Alert',
            message: `You've used ${Math.round(percentage)}% of your ${budget.name} budget. ₹${Math.round(budget.amount - budget.spent)} remaining.`,
            type: 'BUDGET_ALERT',
            userId: req.user!.id,
          },
        });
      }
    }
  }

  res.json({ message: 'Budget check complete' });
}));

// ─── Send Weekly Report Email ──────────────────────────────────
router.post('/send-weekly-report', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: req.user!.id, type: 'INCOME', date: { gte: weekAgo, lte: now } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: req.user!.id, type: 'EXPENSE', date: { gte: weekAgo, lte: now } },
      _sum: { amount: true },
    }),
  ]);

  const html = `
    <div style="font-family: Inter, sans-serif; padding: 40px; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">Weekly Financial Report</h1>
      <p style="color: #6B7280;">Hi ${user.name}, here's your weekly summary:</p>
      <div style="background: #FAFAFA; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <p><strong>Income:</strong> ₹${(income._sum.amount || 0).toLocaleString()}</p>
        <p><strong>Expenses:</strong> ₹${(expenses._sum.amount || 0).toLocaleString()}</p>
        <p><strong>Net Savings:</strong> ₹${((income._sum.amount || 0) - (expenses._sum.amount || 0)).toLocaleString()}</p>
      </div>
      <a href="${config.frontendUrl}/dashboard" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Dashboard</a>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: 'Your Weekly Financial Report - FinanceAI',
    html,
  });

  await prisma.notification.create({
    data: {
      title: 'Weekly Report Sent',
      message: 'Your weekly financial report has been sent to your email.',
      type: 'WEEKLY_REPORT',
      userId: req.user!.id,
    },
  });

  res.json({ message: 'Weekly report sent successfully' });
}));

export default router;
