import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { prisma, verifyDbConnection } from './config/prisma';
import { validateEnv } from './config/validateEnv';
import { errorHandler } from './middleware/error';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import transactionRoutes from './routes/transactions';
import budgetRoutes from './routes/budgets';
import goalRoutes from './routes/goals';
import chatRoutes from './routes/chat';
import reportRoutes from './routes/reports';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';

const app = express();

// Validate environment variables
validateEnv();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS
const corsOrigins = config.frontendUrl.split(',').map((s) => s.trim());
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() } });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// Serve uploaded files in development
if (config.isDevelopment) {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  const isDbConnected = await verifyDbConnection();
  if (!isDbConnected && config.isProduction) {
    console.error('❌ Database connection failed. Exiting.');
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`🚀 FinanceAI server running on port ${config.port}`);
    console.log(`📝 Environment: ${config.nodeEnv}`);
    console.log(`🌐 Frontend URL: ${config.frontendUrl}`);
    console.log(`💡 AI Features: ${config.groq.apiKey ? 'Enabled (Groq)' : 'Disabled'}`);
    console.log(`📧 Email: ${config.resend.apiKey ? 'Enabled' : 'Disabled'}`);
  });
}

start();

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Unhandled errors
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

export default app;
