import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { getPool } from '@/lib/database';
import { profileLimits } from '@/lib/profile';
import { authOrigins } from '@/lib/auth-origins';

function checkedName(value: string): string {
  const name = value.trim();
  if (!name || name.length > profileLimits.name) {
    throw new APIError('BAD_REQUEST', { code: 'INVALID_NAME', message: `Use a name between 1 and ${profileLimits.name} characters.` });
  }
  return name;
}

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Set BETTER_AUTH_SECRET to a random value of at least 32 characters.');
  }
  const { baseURL, trustedOrigins } = authOrigins();
  return betterAuth({
    appName: 'QuanAQYL A+',
    baseURL,
    basePath: '/api/auth',
    secret,
    database: getPool(),
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // Verification and password recovery require an email provider; none is configured.
      requireEmailVerification: false,
    },
    user: { modelName: 'auth_user' },
    session: {
      modelName: 'auth_session',
      expiresIn: 60 * 60 * 24 * 7,
      // Fixed seven days: server component reads cannot forward refreshed Set-Cookie headers.
      disableSessionRefresh: true,
      // Every authenticated request checks the persisted session, including revocation.
      cookieCache: { enabled: false },
    },
    account: { modelName: 'auth_account', accountLinking: { enabled: false } },
    verification: { modelName: 'auth_verification' },
    advanced: {
      cookiePrefix: 'quanaqyl',
      useSecureCookies: baseURL.startsWith('https://'),
      ipAddress: {
        // Vercel supplies this header. Never derive identity from Sites or forwarded user headers.
        ipAddressHeaders: process.env.VERCEL === '1' ? ['x-vercel-forwarded-for'] : ['x-forwarded-for'],
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'auth_rate_limit',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
    databaseHooks: {
      user: {
        create: { before: async user => ({ data: { ...user, name: checkedName(user.name) } }) },
        update: { before: async user => ({ data: { ...user, ...(typeof user.name === 'string' ? { name: checkedName(user.name) } : {}) } }) },
      },
    },
    telemetry: { enabled: false },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

// No database connections or secret checks during module import / next build.
export function getAuth() {
  return instance ??= createAuth();
}
