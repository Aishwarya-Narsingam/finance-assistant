import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { validateEnv } from './config/validateEnv';
import { errorHandler, notFound } from './middleware/error';
import prisma, { verifyDatabaseConnection } from './config/prisma';
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
import { v4 as uuidv4 } from 'uuid';

// ─── Validate Environment on Startup ───────────────────────────
validateEnv();

const app = express();

// ─── Request ID Middleware ─────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Request-Id', uuidv4());
  next();
});

// ─── Security Middleware ───────────────────────────────────────
app.use(helmet());

// Support multiple CORS origins for Vercel preview deployments
const allowedOrigins = config.frontendUrl
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some((allowed) => origin === allowed || origin.endsWith('.vercel.app'))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
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
  message: { success: false, error: 'Too many requests, please try again later.', message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many authentication attempts, please try again later.', message: 'Too many authentication attempts, please try again later.' },
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
    status,
    geminiConfigured: geminiStatus.geminiConfigured,
    apiKeyLoaded: geminiStatus.apiKeyLoaded,
    databaseConnected,
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
const server = app.listen(config.port, async () => {
  console.log(`🚀 FinanceAI Backend running on port ${config.port}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🟢 Node.js ${process.version}`);

  // ── Verify Database Connection ──────────────────────────────
  await verifyDatabaseConnection();
  
  // ── Startup Audit (production-safe) ─────────────────────────
  console.log('\n─── Service Status ─────────────────────────────────────');
  const services = [
    { name: 'GEMINI_API_KEY', loaded: config.gemini.apiKey.length > 0 },
    { name: 'DATABASE_URL', loaded: config.database.url.length > 0 },
    { name: 'JWT_SECRET', loaded: config.jwt.secret !== 'fallback-secret' },
    { name: 'GOOGLE_CLIENT_ID', loaded: config.google.clientId.length > 0 },
    { name: 'CLOUDINARY', loaded: config.cloudinary.cloudName.length > 0 },
    { name: 'RESEND', loaded: config.resend.apiKey.length > 0 },
  ];
  for (const s of services) {
    console.log(`  ${s.loaded ? '✅' : '⚠️ '} ${s.name}: ${s.loaded ? 'configured' : 'not configured'}`);
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
process.on('uncaughtException', (err: Error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err.message);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('💥 UNHANDLED REJECTION:', reason);
});

process.on('warning', (warning) => {
  console.warn('⚠️  Node.js warning:', warning.message);
});

export default app;
