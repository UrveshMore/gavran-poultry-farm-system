import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = fileURLToPath(new URL('.', import.meta.url));
loadEnv({ path: resolve(here, '../../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5318),
  LOG_LEVEL: z.string().default('info'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3317),
  DB_USER: z.string().min(1).default('gavran'),
  DB_PASSWORD: z.string().default('gavran_local'),
  DB_NAME: z.string().min(1).default('gavran'),
  DB_ADMIN_USER: z.string().min(1).default('root'),
  DB_ADMIN_PASSWORD: z.string().default('gavran_root_local'),
  JWT_SECRET: z.string().min(32).default('dev-only-change-me-please-32chars!!'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1_209_600),
  COOKIE_SECURE: z.string().optional(),
  CORS_ORIGIN: z.string().min(1).default('http://127.0.0.1:5317'),
  SERVE_CLIENT: z.string().optional(),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  PIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  SEED_DEV: z.string().optional(),
  SEED_OWNER_EMAIL: z.string().email().default('owner@gavran.local'),
  SEED_OWNER_PASSWORD: z.string().min(10).default('change-me-local-only'),
  SEED_OWNER_NAME: z.string().min(2).default('Farm Owner'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const fields = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment: ${JSON.stringify(fields)}`);
}

const insecureSecrets = new Set([
  'dev-only-change-me-please-32chars!!',
  'replace-with-a-random-string-of-at-least-32-characters',
  'test-only-jwt-secret-must-be-32chars',
]);

if (parsed.data.NODE_ENV === 'production' && insecureSecrets.has(parsed.data.JWT_SECRET)) {
  throw new Error('Refusing to start in production with a sample JWT_SECRET.');
}

if (parsed.data.NODE_ENV === 'test' && !parsed.data.DB_NAME.endsWith('_test')) {
  throw new Error('Refusing to start in test mode unless DB_NAME ends with _test.');
}

const cookieSecure =
  parsed.data.NODE_ENV === 'production'
    ? parsed.data.COOKIE_SECURE !== 'false'
    : parsed.data.COOKIE_SECURE === 'true';

export const env = {
  ...parsed.data,
  COOKIE_SECURE: cookieSecure,
  SEED_DEV: parsed.data.SEED_DEV === 'true',
  SERVE_CLIENT: parsed.data.SERVE_CLIENT === 'true',
};

export type AppEnv = typeof env;
