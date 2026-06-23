import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ─── Graceful Connection Handling ──────────────────────────────
// Verify database connectivity at startup. If Neon is unavailable,
// log a warning but don't crash — routes will return clean 503 errors
// via the error middleware.
export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection verified');
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('⚠️  Database connection failed:', message);
    console.error('   The server will start but database operations will fail.');
    console.error('   Check your DATABASE_URL environment variable.');
    return false;
  }
}

export default prisma;
