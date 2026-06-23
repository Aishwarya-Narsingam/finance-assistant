import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Don't log sensitive details in production
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  } else {
    console.error('Error:', err.message);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Validation failed',
      details: messages,
    });
    return;
  }

  // Prisma connection/initialization errors (Neon unavailable)
  if (err instanceof Prisma.PrismaClientInitializationError) {
    res.status(503).json({
      success: false,
      error: 'Database temporarily unavailable',
      message: 'Database temporarily unavailable. Please try again later.',
    });
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.join(', ') || 'field';
      res.status(409).json({
        success: false,
        error: `A record with this ${field} already exists`,
        message: `A record with this ${field} already exists`,
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Record not found',
        message: 'Record not found',
      });
      return;
    }
  }

  // Prisma validation errors (bad query params)
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: 'Invalid query parameters',
      message: 'Invalid query parameters',
    });
    return;
  }

  // Custom app errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      message: err.message,
    });
    return;
  }

  // Default — never leak stack traces in production
  const message = process.env.NODE_ENV === 'development' ? err.message : 'Internal server error';
  res.status(500).json({
    success: false,
    error: message,
    message,
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: 'Route not found',
  });
}
