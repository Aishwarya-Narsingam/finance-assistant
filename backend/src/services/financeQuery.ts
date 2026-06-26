import { prisma } from '../config/prisma';
import { FinancialContext } from '../types';

export async function getFinancialContext(userId: string, month?: number, year?: number): Promise<FinancialContext> {
  const now = new Date();
  const currentMonth = month || now.getMonth() + 1;
  const currentYear = year || now.getFullYear();

  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

  const [incomeResult, expenseResult, topCategories, recentCount, budgets, goals] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['category'],
      where: { userId, type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    }),
    prisma.transaction.count({
      where: { userId, date: { gte: startDate, lte: endDate } },
    }),
    prisma.budget.findMany({
      where: { userId, month: currentMonth, year: currentYear },
      select: { name: true, spent: true, amount: true },
    }),
    prisma.savingsGoal.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { name: true, currentAmount: true, targetAmount: true },
    }),
  ]);

  const totalIncome = incomeResult._sum.amount || 0;
  const totalExpenses = expenseResult._sum.amount || 0;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    savingsRate: Math.round(savingsRate * 100) / 100,
    topCategories: topCategories.map((c) => ({
      category: c.category,
      amount: c._sum.amount || 0,
    })),
    recentTransactions: recentCount,
    activeBudgets: budgets.map((b) => ({
      name: b.name,
      spent: b.spent,
      amount: b.amount,
    })),
    activeGoals: goals.map((g) => ({
      name: g.name,
      current: g.currentAmount,
      target: g.targetAmount,
    })),
    month: monthNames[currentMonth - 1],
  };
}

export async function getMonthlyTrends(userId: string, months: number = 6) {
  const trends = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const monthName = date.toLocaleString('default', { month: 'short' });

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
    ]);

    trends.push({
      month: `${monthName} ${year}`,
      income: income._sum.amount || 0,
      expenses: expense._sum.amount || 0,
    });
  }

  return trends;
}

export async function getCategoryBreakdown(userId: string, month?: number, year?: number) {
  const now = new Date();
  const currentMonth = month || now.getMonth() + 1;
  const currentYear = year || now.getFullYear();

  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

  const totalExpense = await prisma.transaction.aggregate({
    where: { userId, type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
    _sum: { amount: true },
  });

  const totalExpenses = totalExpense._sum.amount || 0;

  const categories = await prisma.transaction.groupBy({
    by: ['category'],
    where: { userId, type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  return categories.map((c) => ({
    category: c.category,
    amount: c._sum.amount || 0,
    percentage: totalExpenses > 0 ? ((c._sum.amount || 0) / totalExpenses) * 100 : 0,
  }));
}
