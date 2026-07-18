import { z } from 'zod';

const weakDefaults = new Set([
  'ChangeMe@123',
  'changeme',
  'password',
  'qsasset-jwt-secret-2026-change-me',
  'qsasset-refresh-secret-2026-change-me',
]);

function strongSecret(min = 32) {
  return z
    .string()
    .min(min, `must be at least ${min} characters`)
    .refine((v) => !weakDefaults.has(v), { message: 'weak/default secret is not allowed' });
}

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  VAULT_ENCRYPTION_KEY: z.string().optional(),
  DEPLOYMENT_MODE: z.enum(['saas', 'onprem']).optional(),
  OWNER_PASSWORD: z.string().optional(),
  TENANT_ADMIN_PASSWORD: z.string().optional(),
  DISABLE_CRON_JOBS: z.string().optional(),
  PROCESS_ROLE: z.enum(['all', 'api', 'worker', 'collector']).optional(),
});

export type ValidatedEnv = z.infer<typeof baseSchema> & Record<string, unknown>;

/**
 * Nest ConfigModule validate callback. In production (and on-prem), require strong secrets.
 * Development/test stay permissive so local unit tests without full env still run.
 */
export function validateEnv(raw: Record<string, unknown>): ValidatedEnv {
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Environment validation failed: ${parsed.error.message}`);
  }

  const env = { ...raw, ...parsed.data } as ValidatedEnv;
  const mode = env.DEPLOYMENT_MODE || 'saas';
  const nodeEnv = env.NODE_ENV || 'development';
  const enforce =
    nodeEnv === 'production' || mode === 'onprem';

  if (!enforce) return env;

  const jwt = strongSecret(32).safeParse(env.JWT_SECRET);
  if (!jwt.success) {
    throw new Error(`JWT_SECRET ${jwt.error.issues[0]?.message || 'invalid'}`);
  }
  const refresh = strongSecret(32).safeParse(env.JWT_REFRESH_SECRET || env.JWT_SECRET);
  if (!refresh.success) {
    throw new Error(`JWT_REFRESH_SECRET ${refresh.error.issues[0]?.message || 'invalid'}`);
  }
  const vault = strongSecret(32).safeParse(env.VAULT_ENCRYPTION_KEY);
  if (!vault.success) {
    throw new Error(`VAULT_ENCRYPTION_KEY ${vault.error.issues[0]?.message || 'invalid'}`);
  }
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production/on-prem');
  }
  if (mode === 'onprem') {
    const owner = strongSecret(12).safeParse(env.OWNER_PASSWORD);
    if (!owner.success) {
      throw new Error(`OWNER_PASSWORD ${owner.error.issues[0]?.message || 'required'}`);
    }
    const admin = strongSecret(12).safeParse(env.TENANT_ADMIN_PASSWORD);
    if (!admin.success) {
      throw new Error(`TENANT_ADMIN_PASSWORD ${admin.error.issues[0]?.message || 'required'}`);
    }
  }

  return env;
}
