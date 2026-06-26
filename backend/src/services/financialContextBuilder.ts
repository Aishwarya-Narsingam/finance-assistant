import { prisma } from '../config/prisma';
import { FinancialSummary, CategoryDetail } from '../types';
import type { IntentType } from './intentDetection';
import { detectIntent } from './intentDetection';
import { calculateAnalytics, calculateCategoryDetail } from './analyticsService';

async function getPeriodDates(month?: number, year?: number) {
  const now = new Date();
  const currentMonth = month || now.getMonth() + 1;
  const currentYear = year || now.getFullYear();
  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
  return { currentMonth, currentYear, startDate, endDate };
}

async function getPreviousPeriodDates(month: number, year: number) {
  const prevDate = new Date(year, month - 2, 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();
  const startDate = new Date(prevYear, prevMonth - 1, 1);
  const endDate = new Date(prevYear, prevMonth, 0, 23, 59, 59);
  return { prevMonth, prevYear, startDate, endDate };
}

export async function buildFinancialSummary(
  userId: string,
  message?: string
): Promise<FinancialSummary> {
  const now = new Date();
  const { currentMonth, currentYear, startDate, endDate } = await getPeriodDates();

  // ─── Use AnalyticsService for all calculations ────────────────
  const analytics = await calculateAnalytics(userId, currentMonth, currentYear);

  // Log validation result
  if (analytics.validation.passed) {
    console.log(`[FinancialContextBuilder] ✅ Analytics validation PASSED for user ${userId}`);
  } else {
    console.error(`[FinancialContextBuilder] ❌ Analytics validation FAILED for user ${userId}`);
    analytics.validation.mismatches.forEach((m) => console.error(`  ${m}`));
  }

  // ─── Fetch supplementary data (budgets, goals, trends, transactions) ──
  const [budgets, goals, monthlyTrends, recentTransactions] = await Promise.all([
    // Active budgets
    prisma.budget.findMany({
      where: { userId, month: currentMonth, year: currentYear },
    }),
    // Active goals
    prisma.savingsGoal.findMany({
      where: { userId, status: 'ACTIVE' },
    }),
    // Monthly trends (last 6 months)
    buildMonthlyTrends(userId, 6),
    // Recent 10 transactions
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 10,
    }),
  ]);

  // ─── Build budget summaries ────────────────────────────────────
  const budgetSummaries = budgets.map((b) => ({
    name: b.name,
    category: b.category,
    budgeted: b.amount,
    spent: b.spent,
    remaining: Math.max(b.amount - b.spent, 0),
    percentageUsed: b.amount > 0 ? Math.round((b.spent / b.amount) * 10000) / 100 : 0,
  }));

  // ─── Build goal summaries ──────────────────────────────────────
  const goalSummaries = goals.map((g) => ({
    name: g.name,
    current: g.currentAmount,
    target: g.targetAmount,
    percentageComplete: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 10000) / 100 : 0,
    deadline: g.deadline ? g.deadline.toISOString() : null,
    monthlyTarget: g.monthlyTarget,
    priority: g.priority,
  }));

  // ─── Build category breakdown from analytics ───────────────────
  const categoryBreakdown = Object.entries(analytics.categoryTotals).map(([category, amount]) => ({
    category,
    amount,
    percentage: analytics.categoryPercentages[category] || 0,
    transactionCount: analytics.categoryTransactionCount[category] || 0,
  }));

  // ─── Top 5 categories ──────────────────────────────────────────
  const topCategories = categoryBreakdown.slice(0, 5).map((c) => ({
    category: c.category,
    amount: c.amount,
  }));

  // ─── Format recent transactions ────────────────────────────────
  const formattedTransactions = recentTransactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    type: t.type,
    category: t.category,
    amount: t.amount,
    description: t.description,
  }));

  // ─── Build previous month balance ──────────────────────────────
  let previousMonthBalance: number | null = null;
  try {
    const { startDate: prevStart, endDate: prevEnd } = await getPreviousPeriodDates(currentMonth, currentYear);
    const [prevIncome, prevExpense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', date: { gte: prevStart, lte: prevEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', date: { gte: prevStart, lte: prevEnd } },
        _sum: { amount: true },
      }),
    ]);
    previousMonthBalance = (prevIncome._sum.amount || 0) - (prevExpense._sum.amount || 0);
  } catch {
    previousMonthBalance = null;
  }

  // ─── Build the summary ─────────────────────────────────────────
  const summary: FinancialSummary = {
    period: {
      month: now.toLocaleString('default', { month: 'long' }),
      year: currentYear,
    },
    overview: {
      totalIncome: Math.round(analytics.totalIncome * 100) / 100,
      totalExpenses: Math.round(analytics.totalExpenses * 100) / 100,
      balance: Math.round(analytics.balance * 100) / 100,
      savingsRate: analytics.savingsRate,
      previousMonthBalance,
    },
    budgets: budgetSummaries,
    goals: goalSummaries,
    categoryBreakdown,
    monthlyTrends,
    topCategories,
    recentTransactions: formattedTransactions,
  };

  // ─── If a category is mentioned, build detailed analysis ──────
  const detectedCategory = message ? detectIntent(message).category : null;
  if (detectedCategory && detectedCategory !== categoryBreakdown[0]?.category) {
    const catDetail = await calculateCategoryDetail(userId, detectedCategory, currentMonth, currentYear);
    summary.categoryDetail = {
      category: catDetail.category,
      totalSpent: catDetail.totalSpent,
      transactionCount: catDetail.transactionCount,
      averageExpense: catDetail.averageExpense,
      percentageOfTotal: catDetail.percentageOfTotal,
      highestTransaction: catDetail.highestTransaction,
      lowestTransaction: catDetail.lowestTransaction,
      previousMonth: catDetail.previousMonth,
    };
  }

  // ─── Log summary before sending to AI ─────────────────────────
  console.log('[FinancialContextBuilder] Summary built for AI:');
  console.log(`  Period: ${summary.period.month} ${summary.period.year}`);
  console.log(`  Income: ₹${summary.overview.totalIncome.toLocaleString('en-IN')}`);
  console.log(`  Expenses: ₹${summary.overview.totalExpenses.toLocaleString('en-IN')}`);
  console.log(`  Balance: ₹${summary.overview.balance.toLocaleString('en-IN')}`);
  console.log(`  Savings Rate: ${summary.overview.savingsRate}%`);
  console.log(`  Budgets: ${summary.budgets.length}, Goals: ${summary.goals.length}`);
  console.log(`  Categories: ${summary.categoryBreakdown.length}, Recent Txns: ${summary.recentTransactions.length}`);
  if (summary.categoryDetail) {
    console.log(`  Category Detail: ${summary.categoryDetail.category} (₹${summary.categoryDetail.totalSpent.toLocaleString('en-IN')})`);
  }

  return summary;
}

async function buildMonthlyTrends(userId: string, months: number) {
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

/**
 * Build a scoped (minimal) context string for Quick Mode.
 * Only includes data relevant to the detected intent to reduce tokens.
 */
export function formatScopedSummary(summary: FinancialSummary, intent: IntentType): string {
  const { overview, period, budgets, goals } = summary;
  const lines: string[] = [];

  // Always include period info
  const periodLine = `Period: ${period.month} ${period.year}`;

  switch (intent) {
    case 'CATEGORY_ANALYSIS': {
      const cd = summary.categoryDetail;
      lines.push(periodLine);
      if (cd) {
        lines.push(`Category: ${cd.category}`);
        lines.push(`Total Spent: ₹${cd.totalSpent.toLocaleString('en-IN')}`);
        lines.push(`Transactions: ${cd.transactionCount}`);
        lines.push(`Avg per transaction: ₹${cd.averageExpense.toLocaleString('en-IN')}`);
        lines.push(`Share of total expenses: ${cd.percentageOfTotal}%`);
        if (cd.previousMonth) {
          const dir = cd.totalSpent > cd.previousMonth.totalSpent ? 'up' : 'down';
          lines.push(`Month-over-month: ${dir} by ₹${Math.abs(cd.totalSpent - cd.previousMonth.totalSpent).toLocaleString('en-IN')}`);
        }
      } else {
        lines.push(`Category: ${summary.categoryBreakdown[0]?.category || 'N/A'}`);
        lines.push(`Amount: ₹${summary.categoryBreakdown[0]?.amount.toLocaleString('en-IN') || '0'}`);
        lines.push(`Percentage: ${summary.categoryBreakdown[0]?.percentage || 0}%`);
      }
      break;
    }

    case 'BUDGET': {
      lines.push(periodLine);
      lines.push(`Total Income: ₹${overview.totalIncome.toLocaleString('en-IN')}`);
      lines.push(`Total Expenses: ₹${overview.totalExpenses.toLocaleString('en-IN')}`);
      lines.push(`Balance: ₹${overview.balance.toLocaleString('en-IN')}`);
      lines.push(`Savings Rate: ${overview.savingsRate}%`);
      if (budgets.length > 0) {
        lines.push('Budgets:');
        budgets.forEach((b) => {
          lines.push(`- ${b.name}: ₹${b.spent.toLocaleString('en-IN')} / ₹${b.budgeted.toLocaleString('en-IN')} (${b.percentageUsed}%)`);
        });
      }
      break;
    }

    case 'GOALS': {
      lines.push(periodLine);
      if (goals.length > 0) {
        goals.forEach((g) => {
          lines.push(`Goal: ${g.name}`);
          lines.push(`Progress: ₹${g.current.toLocaleString('en-IN')} / ₹${g.target.toLocaleString('en-IN')} (${g.percentageComplete}%)`);
          if (g.deadline) lines.push(`Deadline: ${new Date(g.deadline).toDateString()}`);
          if (g.monthlyTarget) lines.push(`Monthly Target: ₹${g.monthlyTarget.toLocaleString('en-IN')}`);
          lines.push(`Priority: ${g.priority}`);
        });
      } else {
        lines.push('No active goals.');
      }
      break;
    }

    case 'INCOME': {
      lines.push(periodLine);
      lines.push(`Total Income: ₹${overview.totalIncome.toLocaleString('en-IN')}`);
      if (overview.previousMonthBalance !== null) {
        const diff = overview.balance - overview.previousMonthBalance;
        lines.push(`Month-over-month change: ₹${diff >= 0 ? '+' : ''}${Math.round(diff).toLocaleString('en-IN')}`);
      }
      break;
    }

    case 'EXPENSES': {
      lines.push(periodLine);
      lines.push(`Total Expenses: ₹${overview.totalExpenses.toLocaleString('en-IN')}`);
      lines.push(`Transaction count: ${summary.recentTransactions.length}`);
      if (summary.topCategories.length > 0) {
        lines.push('Top categories:');
        summary.topCategories.slice(0, 3).forEach((c) => {
          lines.push(`- ${c.category}: ₹${c.amount.toLocaleString('en-IN')}`);
        });
      }
      break;
    }

    case 'SAVINGS': {
      lines.push(periodLine);
      lines.push(`Savings Rate: ${overview.savingsRate}%`);
      lines.push(`Balance: ₹${overview.balance.toLocaleString('en-IN')}`);
      lines.push(`Total Income: ₹${overview.totalIncome.toLocaleString('en-IN')}`);
      lines.push(`Total Expenses: ₹${overview.totalExpenses.toLocaleString('en-IN')}`);
      break;
    }

    case 'REPORTS':
    case 'RECOMMENDATIONS': {
      // For reports/recommendations, send more complete context
      lines.push(periodLine);
      lines.push(`Income: ₹${overview.totalIncome.toLocaleString('en-IN')}`);
      lines.push(`Expenses: ₹${overview.totalExpenses.toLocaleString('en-IN')}`);
      lines.push(`Balance: ₹${overview.balance.toLocaleString('en-IN')}`);
      lines.push(`Savings Rate: ${overview.savingsRate}%`);
      if (budgets.length > 0) {
        const overBudget = budgets.filter((b) => b.percentageUsed > 100);
        lines.push(`Budgets over limit: ${overBudget.length}`);
      }
      if (goals.length > 0) {
        lines.push(`Active goals: ${goals.length}`);
      }
      break;
    }

    case 'GREETING': {
      lines.push(periodLine);
      lines.push(`Balance: ₹${overview.balance.toLocaleString('en-IN')}`);
      lines.push(`Income: ₹${overview.totalIncome.toLocaleString('en-IN')}`);
      lines.push(`Expenses: ₹${overview.totalExpenses.toLocaleString('en-IN')}`);
      break;
    }

    default: {
      lines.push(periodLine);
      lines.push(`Income: ₹${overview.totalIncome.toLocaleString('en-IN')}`);
      lines.push(`Expenses: ₹${overview.totalExpenses.toLocaleString('en-IN')}`);
      lines.push(`Balance: ₹${overview.balance.toLocaleString('en-IN')}`);
      lines.push(`Savings Rate: ${overview.savingsRate}%`);
      break;
    }
  }

  return lines.join('\n');
}

/**
 * Build a rich text context string from the financial summary for the AI prompt.
 */
export function formatSummaryForPrompt(summary: FinancialSummary): string {
  const lines: string[] = [];
  const { overview, period, budgets, goals, categoryBreakdown, monthlyTrends, topCategories, recentTransactions, categoryDetail } = summary;

  lines.push(`=== FINANCIAL SUMMARY — ${period.month} ${period.year} ===`);
  lines.push('');

  // Overview
  lines.push('--- OVERVIEW ---');
  lines.push(`Total Income: ₹${overview.totalIncome.toLocaleString('en-IN')}`);
  lines.push(`Total Expenses: ₹${overview.totalExpenses.toLocaleString('en-IN')}`);
  lines.push(`Balance: ₹${overview.balance.toLocaleString('en-IN')}`);
  lines.push(`Savings Rate: ${overview.savingsRate}%`);
  if (overview.previousMonthBalance !== null) {
    const diff = overview.balance - overview.previousMonthBalance;
    const trend = diff >= 0 ? '↑ increased' : '↓ decreased';
    lines.push(`Compared to last month, your balance has ${trend} by ₹${Math.abs(Math.round(diff)).toLocaleString('en-IN')}.`);
  }
  lines.push('');

  // Budgets
  lines.push('--- BUDGETS ---');
  if (budgets.length === 0) {
    lines.push('No budgets set for this period.');
  } else {
    budgets.forEach((b) => {
      const status = b.percentageUsed > 100 ? 'OVER BUDGET' : b.percentageUsed > 80 ? 'Nearly exhausted' : 'On track';
      lines.push(`- ${b.name} (${b.category}): ₹${b.spent.toLocaleString('en-IN')} / ₹${b.budgeted.toLocaleString('en-IN')} (${b.percentageUsed}%) — ${status}`);
    });
  }
  lines.push('');

  // Goals
  lines.push('--- SAVINGS GOALS ---');
  if (goals.length === 0) {
    lines.push('No active savings goals.');
  } else {
    goals.forEach((g) => {
      lines.push(`- ${g.name}: ₹${g.current.toLocaleString('en-IN')} / ₹${g.target.toLocaleString('en-IN')} (${g.percentageComplete}% complete)`);
    });
  }
  lines.push('');

  // Category Breakdown
  lines.push('--- CATEGORY-WISE SPENDING ---');
  if (categoryBreakdown.length === 0) {
    lines.push('No expenses recorded for this period.');
  } else {
    categoryBreakdown.forEach((c) => {
      lines.push(`- ${c.category}: ₹${c.amount.toLocaleString('en-IN')} (${c.percentage}% of total) — ${c.transactionCount} transactions`);
    });
  }
  lines.push('');

  // Monthly Trends
  lines.push('--- MONTHLY TRENDS (Last 6 months) ---');
  monthlyTrends.forEach((t) => {
    lines.push(`- ${t.month}: Income ₹${t.income.toLocaleString('en-IN')} | Expenses ₹${t.expenses.toLocaleString('en-IN')}`);
  });
  lines.push('');

  // Top Categories
  lines.push('--- TOP SPENDING CATEGORIES ---');
  if (topCategories.length === 0) {
    lines.push('No spending data available.');
  } else {
    topCategories.forEach((c, i) => {
      lines.push(`  ${i + 1}. ${c.category}: ₹${c.amount.toLocaleString('en-IN')}`);
    });
  }
  lines.push('');

  // Recent Transactions
  lines.push('--- RECENT TRANSACTIONS (Last 10) ---');
  if (recentTransactions.length === 0) {
    lines.push('No transactions recorded.');
  } else {
    recentTransactions.forEach((t) => {
      const prefix = t.type === 'INCOME' ? '+' : '-';
      const desc = t.description ? ` — ${t.description}` : '';
      lines.push(`  [${new Date(t.date).toLocaleDateString('en-IN')}] ${t.category}: ${prefix}₹${t.amount.toLocaleString('en-IN')}${desc}`);
    });
  }
  lines.push('');

  // Category Detail (if applicable)
  if (categoryDetail) {
    const cd = categoryDetail;
    lines.push(`=== CATEGORY ANALYSIS: ${cd.category} ===`);
    lines.push(`Total spent on ${cd.category}: ₹${cd.totalSpent.toLocaleString('en-IN')}`);
    lines.push(`Number of transactions: ${cd.transactionCount}`);
    lines.push(`Average expense: ₹${cd.averageExpense.toLocaleString('en-IN')}`);
    lines.push(`Percentage of total expenses: ${cd.percentageOfTotal}%`);
    lines.push(`Highest single transaction: ₹${cd.highestTransaction.toLocaleString('en-IN')}`);
    lines.push(`Lowest single transaction: ₹${cd.lowestTransaction.toLocaleString('en-IN')}`);
    if (cd.previousMonth) {
      const change = cd.totalSpent - cd.previousMonth.totalSpent;
      const direction = change > 0 ? 'increased' : 'decreased';
      lines.push(`Compared to last month, spending ${direction} by ₹${Math.abs(Math.round(change)).toLocaleString('en-IN')} (was ₹${cd.previousMonth.totalSpent.toLocaleString('en-IN')}, now ${cd.percentageOfTotal}% vs ${cd.previousMonth.percentageOfTotal}% of total).`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
