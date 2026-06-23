import prisma from '../config/prisma';

// ─── Debug logger ──────────────────────────────────────────────
function logQuery(name: string, userId: string, startTime: number, result?: any) {
  const elapsed = Date.now() - startTime;
  console.log(`💾 [FinanceQuery] ${name} | userId=${userId.slice(0, 8)}... | ${elapsed}ms`);
  if (elapsed > 500) {
    console.warn(`⚠️  [FinanceQuery] ${name} took ${elapsed}ms (target: <500ms)`);
  }
  return result;
}

// ─── Helper: Monthly Date Range ────────────────────────────────
function getCurrentMonthRange() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { startOfMonth, startOfNextMonth, now };
}

// ─── Income This Month ─────────────────────────────────────────
export async function getIncomeThisMonth(userId: string): Promise<number> {
  const start = Date.now();
  const { startOfMonth } = getCurrentMonthRange();
  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'INCOME',
      date: { gte: startOfMonth },
    },
    _sum: { amount: true },
  });
  return logQuery('getIncomeThisMonth', userId, start, result._sum.amount || 0);
}

// ─── Expenses This Month ──────────────────────────────────────
export async function getExpensesThisMonth(userId: string): Promise<number> {
  const start = Date.now();
  const { startOfMonth } = getCurrentMonthRange();
  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'EXPENSE',
      date: { gte: startOfMonth },
    },
    _sum: { amount: true },
  });
  return logQuery('getExpensesThisMonth', userId, start, result._sum.amount || 0);
}

// ─── Food Expenses This Month ─────────────────────────────────
export async function getFoodExpenses(userId: string): Promise<number> {
  const start = Date.now();
  const { startOfMonth } = getCurrentMonthRange();
  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'EXPENSE',
      category: 'FOOD',
      date: { gte: startOfMonth },
    },
    _sum: { amount: true },
  });
  return logQuery('getFoodExpenses', userId, start, result._sum.amount || 0);
}

// ─── Category Spending This Month ─────────────────────────────
export async function getCategorySpending(userId: string, category: string): Promise<number> {
  const start = Date.now();
  const { startOfMonth } = getCurrentMonthRange();
  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'EXPENSE',
      category: category as any,
      date: { gte: startOfMonth },
    },
    _sum: { amount: true },
  });
  return logQuery(`getCategorySpending(${category})`, userId, start, result._sum.amount || 0);
}

// ─── Current Savings ──────────────────────────────────────────
export async function getCurrentSavings(userId: string): Promise<number> {
  const start = Date.now();
  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
  ]);
  const result = (income._sum.amount || 0) - (expenses._sum.amount || 0);
  return logQuery('getCurrentSavings', userId, start, result);
}

// ─── Current Balance (same as savings) ───────────────────────
export async function getBalance(userId: string): Promise<number> {
  return getCurrentSavings(userId);
}

// ─── Remaining Budget This Month ─────────────────────────────
export async function getRemainingBudget(userId: string): Promise<{
  totalBudget: number;
  totalSpent: number;
  remaining: number;
}> {
  const start = Date.now();
  const { startOfMonth, now } = getCurrentMonthRange();
  const [budgets, spent] = await Promise.all([
    prisma.budget.aggregate({
      where: {
        userId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
  ]);

  const totalBudget = budgets._sum.amount || 0;
  const totalSpent = spent._sum.amount || 0;
  const result = {
    totalBudget,
    totalSpent,
    remaining: Math.max(0, totalBudget - totalSpent),
  };
  return logQuery('getRemainingBudget', userId, start, result);
}

// ─── Detailed Budget Status (per category) ───────────────────
export async function getBudgetStatus(userId: string): Promise<
  Array<{
    name: string;
    category: string;
    budgeted: number;
    spent: number;
    remaining: number;
    percentUsed: number;
  }>
> {
  const start = Date.now();
  const { startOfMonth, now } = getCurrentMonthRange();

  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    },
  });

  // Get spending per category for this month
  const categorySpending = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      userId,
      type: 'EXPENSE',
      date: { gte: startOfMonth },
    },
    _sum: { amount: true },
  });

  const spendingMap = new Map<string, number>();
  for (const entry of categorySpending) {
    spendingMap.set(entry.category, entry._sum.amount || 0);
  }

  const result = budgets.map((b) => {
    const spent = spendingMap.get(b.category) || 0;
    return {
      name: b.name,
      category: b.category,
      budgeted: b.amount,
      spent,
      remaining: Math.max(0, b.amount - spent),
      percentUsed: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
    };
  });

  return logQuery('getBudgetStatus', userId, start, result);
}

// ─── Savings Goal Progress ──────────────────────────────────
export async function getSavingsGoalProgress(userId: string): Promise<
  Array<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    progress: number;
    remaining: number;
    status: string;
  }>
> {
  const start = Date.now();
  const goals = await prisma.savingsGoal.findMany({
    where: { userId, status: 'ACTIVE' },
  });

  const result = goals.map((g) => {
    const progress = g.targetAmount > 0
      ? Math.round((g.currentAmount / g.targetAmount) * 100)
      : 0;
    return {
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      progress,
      remaining: Math.max(0, g.targetAmount - g.currentAmount),
      status: g.status,
    };
  });

  return logQuery('getSavingsGoalProgress', userId, start, result);
}

// ─── Recent Transactions ─────────────────────────────────────
export async function getRecentTransactions(
  userId: string,
  limit: number = 5
): Promise<
  Array<{
    amount: number;
    type: string;
    category: string;
    description: string | null;
    date: Date;
  }>
> {
  const start = Date.now();
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: limit,
    select: {
      amount: true,
      type: true,
      category: true,
      description: true,
      date: true,
    },
  });
  return logQuery('getRecentTransactions', userId, start, transactions);
}

// ─── Spending Analysis (aggregated data for AI) ─────────────
export async function getSpendingAnalysis(userId: string): Promise<{
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>;
  dailyAverage: number;
  transactionCount: number;
}> {
  const start = Date.now();
  const { startOfMonth } = getCurrentMonthRange();

  const [income, expenses, categorySpending, transactionCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['category'],
      where: { userId, type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
    prisma.transaction.count({
      where: { userId, date: { gte: startOfMonth } },
    }),
  ]);

  const totalIncome = income._sum.amount || 0;
  const totalExpenses = expenses._sum.amount || 0;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  const daysElapsed = Math.max(1, new Date().getDate());
  const dailyAverage = Math.round(totalExpenses / daysElapsed);

  const categoryBreakdown = categorySpending.map((c) => ({
    category: c.category,
    amount: c._sum.amount || 0,
    percentage: totalExpenses > 0 ? Math.round(((c._sum.amount || 0) / totalExpenses) * 100) : 0,
  }));

  const result = { totalIncome, totalExpenses, savingsRate, categoryBreakdown, dailyAverage, transactionCount };
  return logQuery('getSpendingAnalysis', userId, start, result);
}

// ─── AI Context Builder ────────────────────────────────────────
/**
 * Builds a comprehensive financial context string for Gemini AI.
 * This allows the AI to answer questions without needing the user to repeat information.
 */
export async function buildFinancialContext(userId: string): Promise<string> {
  const start = Date.now();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalIncome,
    totalExpenses,
    savings,
    budgets,
    goals,
    recentTransactions,
    categoryBreakdown,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    getCurrentSavings(userId),
    prisma.budget.findMany({
      where: { userId, month: now.getMonth() + 1, year: now.getFullYear() },
    }),
    prisma.savingsGoal.findMany({
      where: { userId, status: 'ACTIVE' },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      orderBy: { date: 'desc' },
      take: 10,
      select: { amount: true, type: true, category: true, description: true, date: true },
    }),
    prisma.transaction.groupBy({
      by: ['category'],
      where: { userId, type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
  ]);

  const monthlyIncome = totalIncome._sum.amount || 0;
  const monthlyExpenses = totalExpenses._sum.amount || 0;
  const savingsRate = monthlyIncome > 0
    ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100)
    : 0;

  const parts: string[] = [];
  parts.push(`[User Financial Context for ${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}]`);
  parts.push(`Monthly Income: ₹${monthlyIncome.toLocaleString('en-IN')}`);
  parts.push(`Monthly Expenses: ₹${monthlyExpenses.toLocaleString('en-IN')}`);
  parts.push(`Current Savings: ₹${savings.toLocaleString('en-IN')}`);
  parts.push(`Savings Rate: ${savingsRate}%`);

  if (budgets.length > 0) {
    parts.push(`Active Budgets: ${budgets.map((b) => `${b.name} (${b.category}): ₹${b.amount} budgeted, ₹${b.spent} spent`).join('; ')}`);
  } else {
    parts.push('Active Budgets: None');
  }

  if (goals.length > 0) {
    parts.push(`Savings Goals: ${goals.map((g) => `${g.name}: ₹${g.currentAmount.toLocaleString('en-IN')} / ₹${g.targetAmount.toLocaleString('en-IN')} (${g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0}%)`).join('; ')}`);
  } else {
    parts.push('Savings Goals: None');
  }

  if (categoryBreakdown.length > 0) {
    parts.push('Category Breakdown: ' + categoryBreakdown.map((c) => `${c.category}: ₹${(c._sum.amount || 0).toLocaleString('en-IN')}`).join(', '));
  }

  if (recentTransactions.length > 0) {
    parts.push('Recent Transactions: ' + recentTransactions.map((t) => `${t.date.toLocaleDateString('en-IN')} - ${t.category}: ₹${t.amount.toLocaleString('en-IN')} (${t.type})${t.description ? ` - ${t.description}` : ''}`).join(' | '));
  }

  const context = parts.join('\n');
  console.log(`📊 [Context] Built financial context in ${Date.now() - start}ms`);
  return context;
}

// ─── Quick Response Formatter ────────────────────────────────
/**
 * Formats a database query result into a concise quick-reply string.
 * Response target: < 500ms and under 20 words.
 */
export function formatQuickResponse(
  intent: string,
  value: number,
  extra?: Record<string, any>
): string {
  const fmt = (v: number) =>
    `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  switch (intent) {
    case 'income':
      return `Your income this month: ${fmt(value)}`;
    case 'expenses':
      return `Your expenses this month: ${fmt(value)}`;
    case 'food_expenses':
      return `Your food expenses: ${fmt(value)}`;
    case 'category_spending': {
      const categoryName = extra?.category || 'this category';
      return `Spent ${fmt(value)} on ${categoryName}`;
    }
    case 'savings':
      return `Your total savings: ${fmt(value)}`;
    case 'balance':
      return `Your current balance: ${fmt(value)}`;
    case 'budget_status': {
      if (extra && typeof extra.remaining === 'number' && typeof extra.totalBudget === 'number') {
        return `${fmt(extra.remaining)} remaining of ${fmt(extra.totalBudget)} budget`;
      }
      return `Budget: ${fmt(value)}`;
    }
    case 'goals':
    case 'goal_progress':
    case 'recent_transactions':
      return `Here's your data: ${fmt(value)}`;
    default:
      return fmt(value);
  }
}
