import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAggregate, mockGroupBy, mockFindMany } = vi.hoisted(() => ({
  mockAggregate: vi.fn(),
  mockGroupBy: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('../config/prisma', () => ({
  prisma: {
    transaction: {
      aggregate: mockAggregate,
      groupBy: mockGroupBy,
      findMany: mockFindMany,
    },
    budget: { findMany: vi.fn() },
    savingsGoal: { findMany: vi.fn() },
  },
}));

import { calculateAnalytics, calculateCategoryDetail } from './analyticsService';

beforeEach(() => {
  vi.clearAllMocks();
});

function mockAggregateResponse(overrides: {
  incomeSum?: number;
  incomeCount?: number;
  expenseSum?: number;
  expenseCount?: number;
  expenseAvg?: number;
  expenseMax?: number;
  expenseMin?: number;
}) {
  mockAggregate
    .mockResolvedValueOnce({
      _sum: { amount: overrides.incomeSum ?? 0 },
      _count: { amount: overrides.incomeCount ?? 0 },
      _avg: { amount: null },
      _max: { amount: null },
      _min: { amount: null },
    })
    .mockResolvedValueOnce({
      _sum: { amount: overrides.expenseSum ?? 0 },
      _count: { amount: overrides.expenseCount ?? 0 },
      _avg: { amount: overrides.expenseAvg ?? null },
      _max: { amount: overrides.expenseMax ?? null },
      _min: { amount: overrides.expenseMin ?? null },
    })
    .mockResolvedValueOnce({
      _sum: { amount: 0 },
      _count: { amount: 0 },
      _avg: { amount: null },
      _max: { amount: null },
      _min: { amount: null },
    })
    .mockResolvedValueOnce({
      _sum: { amount: 0 },
      _count: { amount: 0 },
      _avg: { amount: null },
      _max: { amount: null },
      _min: { amount: null },
    });
}

describe('AnalyticsService - calculateAnalytics', () => {
  it('1. calculates totalIncome correctly from Prisma aggregate', async () => {
    mockAggregateResponse({ incomeSum: 50000, incomeCount: 2 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.totalIncome).toBe(50000);
  });

  it('2. calculates totalExpenses correctly from Prisma aggregate', async () => {
    mockAggregateResponse({ expenseSum: 30000, expenseCount: 5, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.totalExpenses).toBe(30000);
  });

  it('3. calculates balance as totalIncome - totalExpenses', async () => {
    mockAggregateResponse({ incomeSum: 50000, incomeCount: 2, expenseSum: 30000, expenseCount: 5, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.balance).toBe(20000);
  });

  it('3b. balance can be negative when expenses exceed income', async () => {
    mockAggregateResponse({ incomeSum: 20000, incomeCount: 1, expenseSum: 30000, expenseCount: 5, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.balance).toBe(-10000);
  });

  it('4. calculates savingsRate as ((income - expenses) / income) * 100', async () => {
    mockAggregateResponse({ incomeSum: 50000, incomeCount: 2, expenseSum: 30000, expenseCount: 5, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.savingsRate).toBe(40);
  });

  it('4b. savingsRate is 0 when income is 0', async () => {
    mockAggregateResponse({ incomeSum: 0, incomeCount: 0, expenseSum: 30000, expenseCount: 5, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.savingsRate).toBe(0);
  });

  it('4c. savingsRate correctly handles negative savings (spending > income)', async () => {
    mockAggregateResponse({ incomeSum: 40000, incomeCount: 1, expenseSum: 50000, expenseCount: 5, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.savingsRate).toBe(-25);
  });

  it('5. calculates categoryTotals correctly from groupBy', async () => {
    mockAggregateResponse({ expenseSum: 15000, expenseCount: 4, expenseMax: 8000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([
      { category: 'FOOD', _sum: { amount: 8000 }, _count: { amount: 2 }, _max: { amount: 5000 }, _min: { amount: 1000 } },
      { category: 'TRAVEL', _sum: { amount: 5000 }, _count: { amount: 1 }, _max: { amount: 5000 }, _min: { amount: 5000 } },
      { category: 'SHOPPING', _sum: { amount: 2000 }, _count: { amount: 1 }, _max: { amount: 2000 }, _min: { amount: 2000 } },
    ]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.categoryTotals).toEqual({
      FOOD: 8000,
      TRAVEL: 5000,
      SHOPPING: 2000,
    });
  });

  it('6. calculates categoryPercentages as (categoryTotal / totalExpenses) * 100', async () => {
    mockAggregateResponse({ expenseSum: 15000, expenseCount: 4, expenseMax: 8000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([
      { category: 'FOOD', _sum: { amount: 8000 }, _count: { amount: 2 }, _max: { amount: 5000 }, _min: { amount: 1000 } },
      { category: 'TRAVEL', _sum: { amount: 5000 }, _count: { amount: 1 }, _max: { amount: 5000 }, _min: { amount: 5000 } },
      { category: 'SHOPPING', _sum: { amount: 2000 }, _count: { amount: 1 }, _max: { amount: 2000 }, _min: { amount: 2000 } },
    ]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.categoryPercentages.FOOD).toBeCloseTo(53.33, 0);
    expect(result.categoryPercentages.TRAVEL).toBeCloseTo(33.33, 0);
    expect(result.categoryPercentages.SHOPPING).toBeCloseTo(13.33, 0);
  });

  it('6b. category percentage is 0 when totalExpenses is 0', async () => {
    mockAggregateResponse({ expenseSum: 0, expenseCount: 0, expenseMax: 0, expenseMin: 0 });
    mockGroupBy.mockResolvedValue([
      { category: 'FOOD', _sum: { amount: 0 }, _count: { amount: 0 }, _max: { amount: 0 }, _min: { amount: 0 } },
    ]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.categoryPercentages.FOOD).toBe(0);
  });

  it('7. calculates categoryTransactionCount from _count in groupBy', async () => {
    mockAggregateResponse({ expenseSum: 15000, expenseCount: 4, expenseMax: 8000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([
      { category: 'FOOD', _sum: { amount: 8000 }, _count: { amount: 2 }, _max: { amount: 5000 }, _min: { amount: 1000 } },
      { category: 'TRAVEL', _sum: { amount: 5000 }, _count: { amount: 1 }, _max: { amount: 5000 }, _min: { amount: 5000 } },
    ]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.categoryTransactionCount).toEqual({
      FOOD: 2,
      TRAVEL: 1,
    });
  });

  it('8. calculates averageExpense as total / number_of_transactions', async () => {
    mockAggregateResponse({ expenseSum: 15000, expenseCount: 4, expenseMax: 8000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.averageExpense).toBe(3750);
  });

  it('8b. averageExpense is 0 when there are no expense transactions', async () => {
    mockAggregateResponse({ expenseSum: 0, expenseCount: 0, expenseMax: 0, expenseMin: 0 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.averageExpense).toBe(0);
  });

  it('8c. averageExpense with fractional result rounds correctly', async () => {
    mockAggregateResponse({ expenseSum: 100, expenseCount: 3, expenseMax: 50, expenseMin: 10 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.averageExpense).toBeCloseTo(33.33, 0);
  });

  it('9. calculates highestExpense from _max in Prisma aggregate', async () => {
    mockAggregateResponse({ expenseSum: 15000, expenseCount: 4, expenseMax: 8000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.highestExpense).toBe(8000);
  });

  it('9b. highestExpense is 0 when there are no expense transactions', async () => {
    mockAggregateResponse({ expenseSum: 0, expenseCount: 0, expenseMax: 0, expenseMin: 0 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.highestExpense).toBe(0);
  });

  it('10. calculates lowestExpense from _min in Prisma aggregate', async () => {
    mockAggregateResponse({ expenseSum: 15000, expenseCount: 4, expenseMax: 8000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.lowestExpense).toBe(500);
  });

  it('10b. lowestExpense is 0 when there are no expense transactions', async () => {
    mockAggregateResponse({ expenseSum: 0, expenseCount: 0, expenseMax: 0, expenseMin: 0 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.lowestExpense).toBe(0);
  });

  it('11. sets monthlyComparison correctly', async () => {
    mockAggregateResponse({ incomeSum: 50000, incomeCount: 2, expenseSum: 30000, expenseCount: 5, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.monthlyComparison.currentMonth).toEqual({ income: 50000, expenses: 30000 });
    expect(result.monthlyComparison.previousMonth).toBeNull();
    expect(result.monthlyComparison.incomeChange).toBeNull();
    expect(result.monthlyComparison.expenseChange).toBeNull();
  });

  it('calculates transactionCount as sum of income + expense counts', async () => {
    mockAggregateResponse({ incomeSum: 50000, incomeCount: 3, expenseSum: 30000, expenseCount: 7, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.transactionCount).toBe(10);
  });

  it('validates totals by comparing Prisma aggregate with JS reduce', async () => {
    mockAggregateResponse({ incomeSum: 50000, incomeCount: 2, expenseSum: 30000, expenseCount: 5, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([
      { amount: 30000, type: 'INCOME', category: 'SALARY' },
      { amount: 20000, type: 'INCOME', category: 'FREELANCE' },
      { amount: 10000, type: 'EXPENSE', category: 'FOOD' },
      { amount: 8000, type: 'EXPENSE', category: 'TRAVEL' },
      { amount: 5000, type: 'EXPENSE', category: 'SHOPPING' },
      { amount: 4000, type: 'EXPENSE', category: 'BILLS' },
      { amount: 3000, type: 'EXPENSE', category: 'ENTERTAINMENT' },
    ]);

    const result = await calculateAnalytics('user-1');

    expect(result.validation.passed).toBe(true);
    expect(result.validation.totalIncomeMatch).toBe(true);
    expect(result.validation.totalExpensesMatch).toBe(true);
    expect(result.validation.totalIncomeFromDb).toBe(50000);
    expect(result.validation.totalIncomeCalculated).toBe(50000);
    expect(result.validation.totalExpensesFromDb).toBe(30000);
    expect(result.validation.totalExpensesCalculated).toBe(30000);
    expect(result.validation.mismatches).toEqual([]);
  });

  it('detects mismatch when Prisma aggregate and JS reduce disagree', async () => {
    mockAggregateResponse({ incomeSum: 50000, incomeCount: 2, expenseSum: 30000, expenseCount: 5, expenseMax: 10000, expenseMin: 500 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([
      { amount: 30000, type: 'INCOME', category: 'SALARY' },
      { amount: 25000, type: 'INCOME', category: 'FREELANCE' },
    ]);

    const result = await calculateAnalytics('user-1');

    expect(result.validation.passed).toBe(false);
    expect(result.validation.totalIncomeMatch).toBe(false);
    expect(result.validation.mismatches.length).toBeGreaterThan(0);
  });

  it('handles zero transactions gracefully', async () => {
    mockAggregateResponse({ incomeSum: 0, incomeCount: 0, expenseSum: 0, expenseCount: 0, expenseMax: 0, expenseMin: 0 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const result = await calculateAnalytics('user-1');

    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.savingsRate).toBe(0);
    expect(result.averageExpense).toBe(0);
    expect(result.highestExpense).toBe(0);
    expect(result.lowestExpense).toBe(0);
    expect(result.transactionCount).toBe(0);
    expect(Object.keys(result.categoryTotals).length).toBe(0);
    expect(result.validation.passed).toBe(true);
  });

  it('handles single transaction correctly', async () => {
    mockAggregateResponse({ incomeSum: 10000, incomeCount: 1, expenseSum: 0, expenseCount: 0, expenseMax: 0, expenseMin: 0 });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([
      { amount: 10000, type: 'INCOME', category: 'SALARY' },
    ]);

    const result = await calculateAnalytics('user-1');

    expect(result.totalIncome).toBe(10000);
    expect(result.totalExpenses).toBe(0);
    expect(result.balance).toBe(10000);
    expect(result.savingsRate).toBe(100);
    expect(result.transactionCount).toBe(1);
  });
});

describe('AnalyticsService - calculateCategoryDetail', () => {
  it('calculates totalSpent, highest, lowest from category aggregates', async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { amount: 20000 }, _count: { amount: 5 } })
      .mockResolvedValueOnce({
        _sum: { amount: 8000 },
        _count: { amount: 3 },
        _max: { amount: 5000 },
        _min: { amount: 1000 },
      })
      .mockResolvedValueOnce({ _sum: { amount: 15000 }, _count: { amount: 4 } })
      .mockResolvedValueOnce({
        _sum: { amount: 6000 },
        _count: { amount: 2 },
        _max: { amount: 4000 },
        _min: { amount: 2000 },
      });

    const result = await calculateCategoryDetail('user-1', 'FOOD');

    expect(result.totalSpent).toBe(8000);
    expect(result.transactionCount).toBe(3);
    expect(result.highestTransaction).toBe(5000);
    expect(result.lowestTransaction).toBe(1000);
  });

  it('calculates averageExpense as total / count', async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { amount: 20000 }, _count: { amount: 5 } })
      .mockResolvedValueOnce({
        _sum: { amount: 8000 },
        _count: { amount: 3 },
        _max: { amount: 5000 },
        _min: { amount: 1000 },
      })
      .mockResolvedValueOnce({ _sum: { amount: 15000 }, _count: { amount: 4 } })
      .mockResolvedValueOnce({
        _sum: { amount: 6000 },
        _count: { amount: 2 },
        _max: { amount: 4000 },
        _min: { amount: 2000 },
      });

    const result = await calculateCategoryDetail('user-1', 'FOOD');

    expect(result.averageExpense).toBeCloseTo(2666.67, 0);
  });

  it('calculates percentageOfTotal as (totalSpent / totalExpenses) * 100', async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { amount: 20000 }, _count: { amount: 5 } })
      .mockResolvedValueOnce({
        _sum: { amount: 8000 },
        _count: { amount: 3 },
        _max: { amount: 5000 },
        _min: { amount: 1000 },
      })
      .mockResolvedValueOnce({ _sum: { amount: 15000 }, _count: { amount: 4 } })
      .mockResolvedValueOnce({
        _sum: { amount: 6000 },
        _count: { amount: 2 },
        _max: { amount: 4000 },
        _min: { amount: 2000 },
      });

    const result = await calculateCategoryDetail('user-1', 'FOOD');

    expect(result.percentageOfTotal).toBe(40);
  });

  it('includes previousMonth comparison data', async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { amount: 20000 }, _count: { amount: 5 } })
      .mockResolvedValueOnce({
        _sum: { amount: 8000 },
        _count: { amount: 3 },
        _max: { amount: 5000 },
        _min: { amount: 1000 },
      })
      .mockResolvedValueOnce({ _sum: { amount: 15000 }, _count: { amount: 4 } })
      .mockResolvedValueOnce({
        _sum: { amount: 6000 },
        _count: { amount: 2 },
        _max: { amount: 4000 },
        _min: { amount: 2000 },
      });

    const result = await calculateCategoryDetail('user-1', 'FOOD');

    expect(result.previousMonth).not.toBeNull();
    expect(result.previousMonth!.totalSpent).toBe(6000);
    expect(result.previousMonth!.percentageOfTotal).toBeCloseTo(40, 0);
  });

  it('handles zero transactions gracefully', async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { amount: 0 }, _count: { amount: 0 } })
      .mockResolvedValueOnce({
        _sum: { amount: 0 },
        _count: { amount: 0 },
        _max: { amount: 0 },
        _min: { amount: 0 },
      })
      .mockResolvedValueOnce({ _sum: { amount: 0 }, _count: { amount: 0 } })
      .mockResolvedValueOnce({
        _sum: { amount: 0 },
        _count: { amount: 0 },
        _max: { amount: 0 },
        _min: { amount: 0 },
      });

    const result = await calculateCategoryDetail('user-1', 'FOOD');

    expect(result.totalSpent).toBe(0);
    expect(result.transactionCount).toBe(0);
    expect(result.averageExpense).toBe(0);
    expect(result.highestTransaction).toBe(0);
    expect(result.lowestTransaction).toBe(0);
    expect(result.percentageOfTotal).toBe(0);
    expect(result.previousMonth).not.toBeNull();
    expect(result.previousMonth!.totalSpent).toBe(0);
  });
});
