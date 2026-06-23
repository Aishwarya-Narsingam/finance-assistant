// ─── Startup Environment Validation ────────────────────────────
// Validates that all required environment variables are set before
// the server starts. If any are missing, prints a clear error and exits.

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  // Required for core functionality
  { name: 'DATABASE_URL', required: true, description: 'Neon PostgreSQL connection string' },
  { name: 'JWT_SECRET', required: true, description: 'Secret for signing JWT access tokens' },
  { name: 'JWT_REFRESH_SECRET', required: true, description: 'Secret for signing JWT refresh tokens' },

  // Required for AI features
  { name: 'GEMINI_API_KEY', required: false, description: 'Google Gemini API key (AI features disabled without this)' },

  // Required for Google OAuth
  { name: 'GOOGLE_CLIENT_ID', required: false, description: 'Google OAuth client ID (Google login disabled without this)' },
  { name: 'GOOGLE_CLIENT_SECRET', required: false, description: 'Google OAuth client secret' },

  // Optional services
  { name: 'CLOUDINARY_CLOUD_NAME', required: false, description: 'Cloudinary cloud name (uploads disabled without this)' },
  { name: 'RESEND_API_KEY', required: false, description: 'Resend API key (emails disabled without this)' },

  // Server config
  { name: 'FRONTEND_URL', required: false, description: 'Frontend URL for CORS (defaults to http://localhost:3000)' },
  { name: 'PORT', required: false, description: 'Server port (defaults to 5000)' },
];

export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    if (!value || value.trim() === '') {
      if (envVar.required) {
        missing.push(`  ❌ ${envVar.name} — ${envVar.description}`);
      } else {
        warnings.push(`  ⚠️  ${envVar.name} — ${envVar.description}`);
      }
    }
  }

  if (missing.length > 0) {
    console.error('\n═══════════════════════════════════════════════════════');
    console.error('  FATAL: Missing required environment variables');
    console.error('═══════════════════════════════════════════════════════\n');
    console.error(missing.join('\n'));
    console.error('\nCopy .env.example to .env and fill in the required values.');
    console.error('See: https://github.com/your-repo/backend/.env.example\n');
    console.error('═══════════════════════════════════════════════════════\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('\n─── Optional Environment Variables Not Set ────────────');
    console.warn(warnings.join('\n'));
    console.warn('───────────────────────────────────────────────────────\n');
  }

  // Validate JWT secrets are not using fallback values
  if (process.env.JWT_SECRET === 'fallback-secret' || process.env.JWT_REFRESH_SECRET === 'fallback-refresh-secret') {
    if (process.env.NODE_ENV === 'production') {
      console.error('\n❌ FATAL: Using fallback JWT secrets in production is not allowed.');
      console.error('   Set JWT_SECRET and JWT_REFRESH_SECRET to cryptographically random values.');
      console.error('   Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"\n');
      process.exit(1);
    } else {
      console.warn('⚠️  Using fallback JWT secrets. This is only acceptable in development.');
    }
  }
}
