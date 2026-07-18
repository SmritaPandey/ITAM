import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const strong = 'a'.repeat(32);

  it('allows incomplete env in development', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('requires strong secrets in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DEPLOYMENT_MODE: 'saas',
        JWT_SECRET: 'short',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('rejects ChangeMe defaults in on-prem', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DEPLOYMENT_MODE: 'onprem',
        DATABASE_URL: 'postgresql://x',
        JWT_SECRET: strong,
        JWT_REFRESH_SECRET: strong,
        VAULT_ENCRYPTION_KEY: strong,
        OWNER_PASSWORD: 'ChangeMe@123',
        TENANT_ADMIN_PASSWORD: strong,
      }),
    ).toThrow(/OWNER_PASSWORD/);
  });

  it('accepts valid on-prem env', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      DEPLOYMENT_MODE: 'onprem',
      DATABASE_URL: 'postgresql://x',
      JWT_SECRET: strong,
      JWT_REFRESH_SECRET: strong,
      VAULT_ENCRYPTION_KEY: strong,
      OWNER_PASSWORD: 'SecureOwnerPass1!',
      TENANT_ADMIN_PASSWORD: 'SecureAdminPass1!',
    });
    expect(env.DEPLOYMENT_MODE).toBe('onprem');
  });
});
