import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const transactionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['INCOME', 'EXPENSE']),
  category: z.enum([
    'FOOD', 'TRAVEL', 'SHOPPING', 'BILLS', 'RENT',
    'INVESTMENT', 'ENTERTAINMENT', 'HEALTHCARE', 'EDUCATION',
    'SALARY', 'FREELANCE', 'OTHER',
  ]),
  description: z.string().max(500).optional(),
  date: z.string().datetime().optional(),
});

export const budgetSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive('Budget amount must be positive'),
  category: z.enum([
    'FOOD', 'TRAVEL', 'SHOPPING', 'BILLS', 'RENT',
    'INVESTMENT', 'ENTERTAINMENT', 'HEALTHCARE', 'EDUCATION',
    'SALARY', 'FREELANCE', 'OTHER',
  ]),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
});

export const savingsGoalSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: z.number().positive('Target amount must be positive'),
  deadline: z.string().datetime().optional(),
  monthlyTarget: z.number().positive().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
});

export const onboardingSchema = z.object({
  personalDetails: z.object({
    name: z.string().min(2),
    age: z.number().min(16).max(120),
    occupation: z.string().min(1),
  }),
  financialDetails: z.object({
    monthlyIncome: z.number().min(0),
    monthlyExpenses: z.number().min(0),
    savings: z.number().min(0),
    existingLoans: z.number().min(0),
  }),
  financialGoals: z.array(z.string()).min(1, 'Select at least one goal'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url().optional(),
});
