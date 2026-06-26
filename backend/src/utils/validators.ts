import { z } from 'zod';
import { TransactionType, Category, Priority, GoalStatus, ReportType, NotificationType } from '@prisma/client';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  mfaToken: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const onboardingSchema = z.object({
  monthlyIncome: z.number().positive('Monthly income must be positive'),
  currency: z.string().default('INR'),
  preferredCategories: z.array(z.nativeEnum(Category)).optional(),
});

export const transactionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.nativeEnum(TransactionType),
  category: z.nativeEnum(Category),
  description: z.string().max(500).optional(),
  date: z.string().or(z.date()),
});

export const transactionUpdateSchema = transactionSchema.partial();

export const budgetSchema = z.object({
  name: z.string().min(2).max(100),
  amount: z.number().positive('Budget amount must be positive'),
  category: z.nativeEnum(Category),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export const budgetUpdateSchema = budgetSchema.partial();

export const goalSchema = z.object({
  name: z.string().min(2).max(100),
  targetAmount: z.number().positive('Target amount must be positive'),
  currentAmount: z.number().min(0).default(0),
  deadline: z.string().optional(),
  monthlyTarget: z.number().positive().optional(),
  priority: z.nativeEnum(Priority).default('MEDIUM'),
});

export const goalUpdateSchema = goalSchema.partial();

export const addFundsSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
});

export const chatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
});

export const reportSchema = z.object({
  type: z.nativeEnum(ReportType),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const notificationSchema = z.object({
  type: z.nativeEnum(NotificationType),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
});

export const mfaVerifySchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type ChatInput = z.infer<typeof chatSchema>;
export type AddFundsInput = z.infer<typeof addFundsSchema>;
