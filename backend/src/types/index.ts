import { Request } from 'express';
import { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar: string | null;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  onboardingDone: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: string[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  incomeTrend: { month: string; income: number; expenses: number }[];
  categoryBreakdown: { category: string; amount: number; percentage: number }[];
  recentTransactions: any[];
}

export interface IntentResult {
  type: 'db_query' | 'ai_analysis' | 'budget_create' | 'general_chat';
  intent: string;
  params?: Record<string, any>;
  confidence: number;
}

export interface FinancialContext {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
  topCategories: { category: string; amount: number }[];
  recentTransactions: number;
  activeBudgets: { name: string; spent: number; amount: number }[];
  activeGoals: { name: string; current: number; target: number }[];
  month: string;
}

export interface CategoryDetail {
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
}

export interface BudgetSummary {
  name: string;
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
}

export interface GoalSummary {
  name: string;
  current: number;
  target: number;
  percentageComplete: number;
  deadline: string | null;
  monthlyTarget: number | null;
  priority: string;
}

export interface TransactionSummary {
  id: string;
  date: string;
  type: string;
  category: string;
  amount: number;
  description: string | null;
}

export interface FinancialSummary {
  period: {
    month: string;
    year: number;
  };
  overview: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    savingsRate: number;
    previousMonthBalance: number | null;
  };
  budgets: BudgetSummary[];
  goals: GoalSummary[];
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
    transactionCount: number;
  }[];
  monthlyTrends: {
    month: string;
    income: number;
    expenses: number;
  }[];
  topCategories: {
    category: string;
    amount: number;
  }[];
  recentTransactions: TransactionSummary[];
  categoryDetail?: CategoryDetail;
}
