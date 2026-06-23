import { Request } from 'express';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface PaginatedQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionQuery extends PaginatedQuery {
  type?: 'INCOME' | 'EXPENSE';
  category?: string;
  startDate?: string;
  endDate?: string;
}

export interface BudgetQuery {
  month?: string;
  year?: string;
}

export interface TransactionSummary {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string | null;
  date: Date;
}

export interface DashboardStats {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  totalSavings: number;
  activeGoals: number;
  recentTransactions: TransactionSummary[];
  expenseByCategory: { name: string; value: number }[];
  monthlyTrends: { month: string; income: number; expenses: number }[];
}
