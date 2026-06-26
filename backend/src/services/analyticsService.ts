import { prisma } from '../config/prisma';

// ─── Types ─────────────────────────────────────────────────────

export interface AnalyticsResult {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
  categoryTotals: Record<string, number>;
  categoryPercentages: Record<string, number>;
  categoryTransactionCount: Record<string, number>;
  averageExpense: number;
  highestExpense: number;
  lowestExpense: number;
  monthlyComparison: {
    currentMonth: { income: number; expenses: number };
    previousMonth: { income: number; expenses: number } | null;
    incomeChange: number | null;
    expenseChange: number | null;
  };
  transactionCount: number;
  validation: {
    passed: boolean;
    totalIncomeMatch: boolean;
    totalExpensesMatch: boolean;
    totalIncomeFromDb: number;
    totalExpensesFromDb: number;
    totalIncomeCalculated: number;
    totalExpensesCalculated: number;
    mismatches: string[];
  };
}

// ─── Period helpers ────────────────────────────────────────────

function getPeriodDates(month?: number, year?: number) {
  const now = new Date();
  const currentMonth = month || now.getMonth() + 1;
  const currentYear = year || now.getFullYear();
  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
  return { currentMonth, currentYear, startDate, endDate };
}

function getPreviousPeriodDates(month: number, year: number) {
  const prevDate = new Date(year, month - 2, 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();
  const startDate = new Date(prevYear, prevMonth - 1, 1);
  const endDate = new Date(prevYear, prevMonth, 0, 23, 59, 59);
  return { prevMonth, prevYear, startDate, endDate };
}

// ─── Core analytics calculation ────────────────────────────────

export async function calculateAnalytics(
  userId: string,
  month?: number,
  year?: number
): Promise<AnalyticsResult> {
  const { currentMonth, currentYear, startDate, endDate } = getPeriodDates(month, year);

  console.log(`[AnalyticsService] Calculating analytics for user ${userId}, period: ${currentMonth}/${currentYear}`);
  console.log(`[AnalyticsService] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

  // ─── METHOD 1: Prisma aggregations (trusted source) ──────
  const [incomeAgg, expenseAgg, categoryData, allTransactions] = await Promise.all([
    // Current month income total via Prisma aggregate
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: { amount: true },
    }),

    // Current month expense total via Prisma aggregate
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: { amount: true },
      _avg: { amount: true },
      _max: { amount: true },
      _min: { amount: true },
    }),

    // Category-wise breakdown
    prisma.transaction.groupBy({
      by: ['category'],
      where: { userId, type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: { amount: true },
      _max: { amount: true },
      _min: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),

    // All transactions for this period (for validation via JS reduce)
    prisma.transaction.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      select: { amount: true, type: true, category: true },
    }),
  ]);

  // Fix: Get actual previous month data
  const { startDate: prevStart, endDate: prevEnd } = getPreviousPeriodDates(currentMonth, currentYear);
  const [actualPrevIncome, actualPrevExpense] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', date: { gte: prevStart, lte: prevEnd } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE', date: { gte: prevStart, lte: prevEnd } },
      _sum: { amount: true },
    }),
  ]);

  // ─── Extract values from Prisma aggregations ─────────────
  const totalIncome = incomeAgg._sum.amount || 0;
  const totalExpenses = expenseAgg._sum.amount || 0;
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 10000) / 100 : 0;
  const transactionCount = (incomeAgg._count.amount || 0) + (expenseAgg._count.amount || 0);

  // Average, highest, lowest from expenses
  const averageExpense = expenseAgg._count.amount && expenseAgg._count.amount > 0
    ? (expenseAgg._sum.amount || 0) / expenseAgg._count.amount
    : 0;
  const highestExpense = expenseAgg._max.amount || 0;
  const lowestExpense = expenseAgg._min.amount || 0;

  // ─── Category analytics ───────────────────────────────────
  const categoryTotals: Record<string, number> = {};
  const categoryPercentages: Record<string, number> = {};
  const categoryTransactionCount: Record<string, number> = {};

  for (const cat of categoryData) {
    categoryTotals[cat.category] = cat._sum.amount || 0;
    categoryPercentages[cat.category] = totalExpenses > 0
      ? Math.round(((cat._sum.amount || 0) / totalExpenses) * 10000) / 100
      : 0;
    categoryTransactionCount[cat.category] = cat._count.amount;
  }

  // ─── Monthly comparison ──────────────────────────────────
  const prevMonthIncome = actualPrevIncome._sum.amount || 0;
  const prevMonthExpenses = actualPrevExpense._sum.amount || 0;
  const hasPreviousData = prevMonthIncome > 0 || prevMonthExpenses > 0;

  const monthlyComparison = {
    currentMonth: { income: totalIncome, expenses: totalExpenses },
    previousMonth: hasPreviousData ? { income: prevMonthIncome, expenses: prevMonthExpenses } : null,
    incomeChange: hasPreviousData ? totalIncome - prevMonthIncome : null,
    expenseChange: hasPreviousData ? totalExpenses - prevMonthExpenses : null,
  };

  // ─── Validation: compare Prisma aggregate totals vs raw JS calculation ──
  const incomeFromJs = allTransactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0);

  const expensesFromJs = allTransactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncomeMatch = Math.abs(totalIncome - incomeFromJs) < 0.01;
  const totalExpensesMatch = Math.abs(totalExpenses - expensesFromJs) < 0.01;

  const mismatches: string[] = [];
  if (!totalIncomeMatch) {
    mismatches.push(`INCOME MISMATCH: Prisma aggregate = ${totalIncome}, JS reduce = ${incomeFromJs}`);
  }
  if (!totalExpensesMatch) {
    mismatches.push(`EXPENSES MISMATCH: Prisma aggregate = ${totalExpenses}, JS reduce = ${expensesFromJs}`);
  }

  const validation = {
    passed: totalIncomeMatch && totalExpensesMatch,
    totalIncomeMatch,
    totalExpensesMatch,
    totalIncomeFromDb: totalIncome,
    totalExpensesFromDb: totalExpenses,
    totalIncomeCalculated: incomeFromJs,
    totalExpensesCalculated: expensesFromJs,
    mismatches,
  };

  // ─── Log all calculated analytics ─────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('[AnalyticsService] Calculated Analytics:');
  console.log('───────────────────────────────────────────────');
  console.log(`  totalIncome:        ₹${totalIncome.toLocaleString('en-IN')}`);
  console.log(`  totalExpenses:      ₹${totalExpenses.toLocaleString('en-IN')}`);
  console.log(`  balance:            ₹${balance.toLocaleString('en-IN')}`);
  console.log(`  savingsRate:        ${savingsRate}%`);
  console.log(`  transactionCount:   ${transactionCount}`);
  console.log(`  averageExpense:     ₹${Math.round(averageExpense * 100) / 100}`);
  console.log(`  highestExpense:     ₹${highestExpense.toLocaleString('en-IN')}`);
  console.log(`  lowestExpense:      ₹${lowestExpense.toLocaleString('en-IN')}`);
  console.log('───────────────────────────────────────────────');
  console.log(`  Category Breakdown:`);
  for (const cat of categoryData) {
    console.log(`    ${cat.category}: ₹${(cat._sum.amount || 0).toLocaleString('en-IN')} (${categoryPercentages[cat.category]}%) - ${cat._count.amount} transactions`);
  }
  console.log('───────────────────────────────────────────────');
  console.log(`  Monthly Comparison:`);
  console.log(`    Current:  Income ₹${totalIncome.toLocaleString('en-IN')}, Expenses ₹${totalExpenses.toLocaleString('en-IN')}`);
  if (hasPreviousData) {
    console.log(`    Previous: Income ₹${prevMonthIncome.toLocaleString('en-IN')}, Expenses ₹${prevMonthExpenses.toLocaleString('en-IN')}`);
    console.log(`    Change:   Income ${monthlyComparison.incomeChange! >= 0 ? '+' : ''}${monthlyComparison.incomeChange!.toLocaleString('en-IN')}, Expenses ${monthlyComparison.expenseChange! >= 0 ? '+' : ''}${monthlyComparison.expenseChange!.toLocaleString('en-IN')}`);
  }
  console.log('───────────────────────────────────────────────');
  console.log(`  Validation: ${validation.passed ? '✅ PASSED' : '❌ FAILED'}`);
  if (!validation.passed) {
    mismatches.forEach((m) => console.log(`    ⚠️  ${m}`));
  }
  console.log('═══════════════════════════════════════════════');

  return {
    totalIncome,
    totalExpenses,
    balance,
    savingsRate,
    categoryTotals,
    categoryPercentages,
    categoryTransactionCount,
    averageExpense: Math.round(averageExpense * 100) / 100,
    highestExpense,
    lowestExpense,
    monthlyComparison,
    transactionCount,
    validation,
  };
}

/**
 * Build detailed category analysis for a specific category.
 */
export async function calculateCategoryDetail(
  userId: string,
  category: string,
  month?: number,
  year?: number
): Promise<{
  category: string;
  totalSpent: number;
  transactionCount: number;
  averageExpense: number;
  percentageOfTotal: number;
  highestTransaction: number;
  lowestTransaction: number;
  previousMonth: {
    totalSpent: number;
    percentageOfTotal: number;
  } | null;
}> {
  const { currentMonth, currentYear, startDate, endDate } = getPeriodDates(month, year);

  // Get total expenses for percentage calculation
  const totalExpenseAgg = await prisma.transaction.aggregate({
    where: { userId, type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
    _sum: { amount: true },
  });
  const totalExpenses = totalExpenseAgg._sum.amount || 0;

  // Get category-specific aggregates
  const catAgg = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'EXPENSE',
      category: category as any,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
    _count: { amount: true },
    _max: { amount: true },
    _min: { amount: true },
  });

  const totalSpent = catAgg._sum.amount || 0;
  const transactionCount = catAgg._count.amount;
  const averageExpense = transactionCount > 0 ? totalSpent / transactionCount : 0;
  const highestTransaction = catAgg._max.amount || 0;
  const lowestTransaction = catAgg._min.amount || 0;
  const percentageOfTotal = totalExpenses > 0
    ? Math.round((totalSpent / totalExpenses) * 10000) / 100
    : 0;

  // Previous month comparison
  let previousMonthData: { totalSpent: number; percentageOfTotal: number } | null = null;
  try {
    const { startDate: prevStart, endDate: prevEnd } = getPreviousPeriodDates(currentMonth, currentYear);

    const [prevTotalExpense, prevCategoryAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', date: { gte: prevStart, lte: prevEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          category: category as any,
          date: { gte: prevStart, lte: prevEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const prevTotal = prevTotalExpense._sum.amount || 0;
    const prevCat = prevCategoryAgg._sum.amount || 0;

    previousMonthData = {
      totalSpent: prevCat,
      percentageOfTotal: prevTotal > 0 ? Math.round((prevCat / prevTotal) * 10000) / 100 : 0,
    };
  } catch {
    previousMonthData = null;
  }

  console.log(`[AnalyticsService] Category Detail for "${category}":`);
  console.log(`  totalSpent:         ₹${totalSpent.toLocaleString('en-IN')}`);
  console.log(`  transactionCount:   ${transactionCount}`);
  console.log(`  averageExpense:     ₹${Math.round(averageExpense * 100) / 100}`);
  console.log(`  percentageOfTotal:  ${percentageOfTotal}%`);
  console.log(`  highestTransaction: ₹${highestTransaction.toLocaleString('en-IN')}`);
  console.log(`  lowestTransaction:  ₹${lowestTransaction.toLocaleString('en-IN')}`);
  if (previousMonthData) {
    console.log(`  Previous month:     ₹${previousMonthData.totalSpent.toLocaleString('en-IN')} (${previousMonthData.percentageOfTotal}%)`);
  }

  return {
    category,
    totalSpent: Math.round(totalSpent * 100) / 100,
    transactionCount,
    averageExpense: Math.round(averageExpense * 100) / 100,
    percentageOfTotal,
    highestTransaction,
    lowestTransaction,
    previousMonth: previousMonthData,
  };
}
