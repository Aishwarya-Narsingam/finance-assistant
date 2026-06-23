import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler, notFound } from './middleware/error';
import prisma from './config/prisma';
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
import { getGeminiHealthStatus } from './services/gemini';
import { asyncHandler } from './utils/asyncHandler';

const app = express();

// ─── Security Middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Body Parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health Checks ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI-specific health check at /api/ai/health (no auth required)
app.get('/api/ai/health', asyncHandler(async (_req, res) => {
  const geminiStatus = await getGeminiHealthStatus();

  let databaseConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }

  const status = geminiStatus.status === 'connected' && databaseConnected ? 'healthy' : 'degraded';

  res.json({
    geminiConfigured: geminiStatus.geminiConfigured,
    apiKeyLoaded: geminiStatus.apiKeyLoaded,
    databaseConnected,
    status,
  });
}));

// ─── API Routes ────────────────────────────────────────────────
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

// ─── Error Handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ──────────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log(`🚀 FinanceAI Backend running on port ${config.port}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🟢 Node.js ${process.version}`);
  
  // ── Startup API Key Audit ──────────────────────────────────
  console.log('\n─── API Key Audit ──────────────────────────────────────');
  const isSecret = (name: string) => name.includes('SECRET') || name.includes('PASSWORD');
  const keys = [
    { name: 'GEMINI_API_KEY', value: config.gemini.apiKey },
    { name: 'DATABASE_URL', value: config.database.url },
    { name: 'JWT_SECRET', value: config.jwt.secret },
    { name: 'GOOGLE_CLIENT_ID', value: config.google.clientId },
    { name: 'CLOUDINARY_CLOUD_NAME', value: config.cloudinary.cloudName },
    { name: 'RESEND_API_KEY', value: config.resend.apiKey },
  ];
  for (const k of keys) {
    const loaded = k.value.length > 0;
    const preview = loaded
      ? isSecret(k.name) ? '(set, hidden)' : `${k.value.slice(0, 8)}…`
      : '(empty)';
    console.log(`  ${loaded ? '✅' : '⚠️ '} ${k.name}: ${preview}`);
  }
  console.log('───────────────────────────────────────────────────────\n');
});

// ─── Graceful Shutdown ─────────────────────────────────────────
async function gracefulShutdown(signal: string) {
  console.log(`\n⚠️  ${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('📡 HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('🗄️  Prisma disconnected.');
    } catch (err) {
      console.error('Error during Prisma disconnect:', err);
    }
    process.exit(0);
  });

  // Force close after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Global Error Handlers ─────────────────────────────────────
// These prevent the libuv UV_HANDLE_CLOSING assertion crash on
// Node.js v24 + Windows by catching errors that escape Express.
process.on('uncaughtException', (err: Error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
  // Log the error but allow the process to finish current operations
  // before exiting. This avoids the UV_HANDLE_CLOSING assertion
  // caused by abruptly killing handles mid-operation.
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('💥 UNHANDLED REJECTION:', reason);
  // Don't crash the process — log it and keep running.
  // Most unhandled rejections in Express come from async route
  // handlers that forgot try/catch. The asyncHandler wrapper
  // added to all routes fixes the root cause.
});

// Prevent the process from exiting immediately on unhandled rejection
process.on('warning', (warning) => {
  console.warn('⚠️  Node.js warning:', warning.message);
});

export default app;
