import { AdminService } from './admin.service';

describe('AdminService operational readiness', () => {
  const previous = {
    VAULT_ENCRYPTION_KEY: process.env.VAULT_ENCRYPTION_KEY,
    LICENSE_PRIVATE_KEY: process.env.LICENSE_PRIVATE_KEY,
    LICENSE_PUBLIC_KEY: process.env.LICENSE_PUBLIC_KEY,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('reports configuration presence without returning secret values', async () => {
    process.env.VAULT_ENCRYPTION_KEY = 'vault-secret-must-not-leak';
    process.env.LICENSE_PRIVATE_KEY = 'private-key-must-not-leak';
    process.env.LICENSE_PUBLIC_KEY = 'public-key';
    const prisma: any = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ ok: 1 }])
        .mockResolvedValueOnce([{ size: '10 MB' }]),
      agent: { count: jest.fn().mockResolvedValue(3) },
      agentEnrollment: {
        count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1),
      },
      productLicense: { count: jest.fn().mockResolvedValue(4) },
    };
    const service = new AdminService(prisma);

    const result = await service.getSystemHealth();

    expect(result.operationalReadiness.vaultEncryption).toBe(true);
    expect(result.operationalReadiness.licenseSigning).toBe(true);
    expect(JSON.stringify(result)).not.toContain('vault-secret-must-not-leak');
    expect(JSON.stringify(result)).not.toContain('private-key-must-not-leak');
  });
});
