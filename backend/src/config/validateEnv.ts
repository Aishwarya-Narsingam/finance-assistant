import { config } from './index';

const REQUIRED_VARS: { key: keyof typeof config; name: string }[] = [
  { key: 'database' as keyof typeof config, name: 'DATABASE_URL' },
  { key: 'jwt' as keyof typeof config, name: 'JWT_SECRET' },
  { key: 'jwt' as keyof typeof config, name: 'JWT_REFRESH_SECRET' },
];

const OPTIONAL_VARS: { key: keyof typeof config; name: string }[] = [
  { key: 'groq' as keyof typeof config, name: 'GROQ_API_KEY' },
  { key: 'google' as keyof typeof config, name: 'GOOGLE_CLIENT_ID' },
  { key: 'google' as keyof typeof config, name: 'GOOGLE_CLIENT_SECRET' },
  { key: 'cloudinary' as keyof typeof config, name: 'CLOUDINARY_CLOUD_NAME' },
  { key: 'resend' as keyof typeof config, name: 'RESEND_API_KEY' },
];

export function validateEnv(): void {
  const missing: string[] = [];

  for (const v of REQUIRED_VARS) {
    const value = config as any;
    if (!value[v.key]) {
      missing.push(v.name);
    }
  }

  if (!config.database.url) missing.push('DATABASE_URL');
  if (!config.jwt.secret) missing.push('JWT_SECRET');
  if (!config.jwt.refreshSecret) missing.push('JWT_REFRESH_SECRET');

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    if (config.isProduction) {
      throw new Error(`Server cannot start: missing required environment variables: ${missing.join(', ')}`);
    }
    console.warn('⚠️  Running in development mode with missing variables - some features may not work');
  }

  // Log optional feature status
  if (!config.groq.apiKey) console.warn('⚠️  GROQ_API_KEY not set — AI features disabled');
  if (!config.resend.apiKey) console.warn('⚠️  RESEND_API_KEY not set — email features disabled');
  if (!config.cloudinary.cloudName) console.warn('⚠️  Cloudinary not configured — uploads disabled');
  if (!config.google.clientId) console.warn('⚠️  Google OAuth not configured — Google login disabled');

  console.log('✅ Environment variables validated');
}
