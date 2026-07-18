jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { ConfigService } from '@nestjs/config';
import { openVaultValue, isVaultValue } from '../../common/security/vault-crypto';
import { SsoService } from './sso.service';

describe('SsoService secret protection', () => {
  const originalKey = process.env.VAULT_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.VAULT_ENCRYPTION_KEY = 'test-only-vault-encryption-key-at-least-32-characters';
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
    else process.env.VAULT_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts a client secret and only returns its presence', async () => {
    let persisted: any;
    const prisma = {
      ssoConfig: {
        create: jest.fn(async ({ data }) => {
          persisted = { id: 'config-1', createdAt: new Date(), updatedAt: new Date(), ...data };
          return persisted;
        }),
      },
    };
    const service = new SsoService(
      prisma as any,
      new ConfigService({}),
      {} as any,
    );

    const result = await service.createConfig('tenant-1', {
      provider: 'OIDC',
      clientId: 'client',
      clientSecret: 'plain-secret',
    });

    expect(isVaultValue(persisted.clientSecret)).toBe(true);
    expect(openVaultValue(persisted.clientSecret)).toBe('plain-secret');
    expect(result.hasClientSecret).toBe(true);
    expect(result).not.toHaveProperty('clientSecret');
    expect(JSON.stringify(result)).not.toContain('plain-secret');
  });

  it('sanitizes existing config rows without decrypting secrets', async () => {
    const prisma = {
      ssoConfig: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'config-1',
            tenantId: 'tenant-1',
            provider: 'OIDC',
            clientSecret: 'vault:v1:opaque',
            certificate: 'certificate-data',
          },
        ]),
      },
    };
    const service = new SsoService(
      prisma as any,
      new ConfigService({}),
      {} as any,
    );

    const [result] = await service.listConfigs('tenant-1');

    expect(result).toMatchObject({ hasClientSecret: true, hasCertificate: true });
    expect(result).not.toHaveProperty('clientSecret');
    expect(result).not.toHaveProperty('certificate');
  });
});
