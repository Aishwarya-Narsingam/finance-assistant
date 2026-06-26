import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { sendWeeklyReportEmail } from '../services/email';

const router = Router();

// GET /notifications
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { read } = req.query;

  const where: any = { userId };
  if (read === 'true') where.read = true;
  else if (read === 'false') where.read = false;

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, read: false },
  });

  res.json({ success: true, data: { notifications, unreadCount } });
}));

// PATCH /notifications/:id/read
router.patch('/:id/read', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw new AppError(404, 'Notification not found');

  await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json({ success: true, message: 'Notification marked as read' });
}));

// PATCH /notifications/read-all
router.patch('/read-all', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  res.json({ success: true, message: 'All notifications marked as read' });
}));

// DELETE /notifications/:id
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw new AppError(404, 'Notification not found');

  await prisma.notification.delete({ where: { id } });
  res.json({ success: true, message: 'Notification deleted' });
}));

// GET /notifications/check-budgets
router.get('/check-budgets', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const budgets = await prisma.budget.findMany({ where: { userId, month, year } });
  const created: string[] = [];

  for (const budget of budgets) {
    if (budget.amount === 0) continue;
    const percentage = (budget.spent / budget.amount) * 100;

    if (percentage >= 100) {
      const existing = await prisma.notification.findFirst({
        where: { userId, type: 'OVERSPENDING', title: { contains: budget.name } },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            type: 'OVERSPENDING',
            title: `Budget exceeded: ${budget.name}`,
            message: `You've exceeded your ${budget.name} budget of ₹${budget.amount.toLocaleString()}. Current spending: ₹${budget.spent.toLocaleString()}`,
            userId,
          },
        });
        created.push(`overspend:${budget.name}`);
      }
    } else if (percentage >= 80) {
      const existing = await prisma.notification.findFirst({
        where: { userId, type: 'BUDGET_ALERT', title: { contains: budget.name } },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            type: 'BUDGET_ALERT',
            title: `Budget alert: ${budget.name}`,
            message: `You've used ${percentage.toFixed(0)}% of your ${budget.name} budget (₹${budget.spent.toLocaleString()} / ₹${budget.amount.toLocaleString()}).`,
            userId,
          },
        });
        created.push(`alert:${budget.name}`);
      }
    }
  }

  res.json({ success: true, data: { created, count: created.length } });
}));

// POST /notifications/send-weekly-report
router.post('/send-weekly-report', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  const now = new Date();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: weekAgo } },
  });

  const totalIncome = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const savings = totalIncome - totalExpenses;

  const reportHtml = `
    <div style="margin: 16px 0;">
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 8px;">
        <strong>Income:</strong> ₹${totalIncome.toLocaleString()}
      </div>
      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 8px;">
        <strong>Expenses:</strong> ₹${totalExpenses.toLocaleString()}
      </div>
      <div style="background: #f0f0ff; border-radius: 8px; padding: 16px; margin-bottom: 8px;">
        <strong>Net Savings:</strong> ₹${savings.toLocaleString()}
      </div>
      <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">
        View your full report in the FinanceAI dashboard.
      </p>
    </div>
  `;

  // Send email
  if (user.email) {
    sendWeeklyReportEmail(user.email, user.name, reportHtml);
  }

  // Create notification
  await prisma.notification.create({
    data: {
      type: 'WEEKLY_REPORT',
      title: 'Weekly Report Available',
      message: `Your weekly financial report is ready. Income: ₹${totalIncome.toLocaleString()}, Expenses: ₹${totalExpenses.toLocaleString()}, Savings: ₹${savings.toLocaleString()}`,
      userId,
    },
  });

  res.json({ success: true, message: 'Weekly report sent' });
}));

export default router;
