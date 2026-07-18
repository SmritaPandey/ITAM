import { createHash } from 'crypto';
import { TenantPlan } from '@prisma/client';
import { ProductLicenseService } from './product-license.service';
import { signEntitlement } from './license-crypto';

describe('ProductLicenseService', () => {
  const previousMode = process.env.DEPLOYMENT_MODE;

  beforeAll(() => {
    process.env.DEPLOYMENT_MODE = 'onprem';
  });

  afterAll(() => {
    if (previousMode === undefined) delete process.env.DEPLOYMENT_MODE;
    else process.env.DEPLOYMENT_MODE = previousMode;
  });

  it('rejects an activation response with a different challenge nonce', async () => {
    const installId = 'inst-test';
    const row = {
      id: 'row-1',
      installId,
      challengeNonce: 'expected-nonce',
      challengeExpiresAt: new Date(Date.now() + 60_000),
    };
    const prisma: any = {
      instanceEntitlement: {
        findFirst: jest.fn().mockResolvedValue(row),
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const service = new ProductLicenseService(prisma);
    const signed = signEntitlement({
      licenseKey: 'QS-TEST-TEST-TEST-TEST',
      customerName: 'Test',
      plan: 'ON_PREMISE',
      maxAssets: 10,
      maxUsers: 5,
      allowedModules: ['DASHBOARD'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      iss: 'neurq',
      fingerprint: createHash('sha256').update(installId).digest('hex').slice(0, 32),
      installId,
      activationNonce: 'wrong-nonce',
    });

    await expect(
      service.activateInstanceResponse(JSON.stringify(signed)),
    ).rejects.toThrow('nonce does not match');
    expect(prisma.instanceEntitlement.update).not.toHaveBeenCalled();
  });

  it('intersects active license modules with tenant plan modules', async () => {
    const service = new ProductLicenseService({} as any);
    jest.spyOn(service, 'getEffectiveEntitlement').mockResolvedValue({
      valid: true,
      expired: false,
      missing: false,
      readOnly: false,
      plan: TenantPlan.ON_PREMISE,
      maxAssets: -1,
      maxUsers: -1,
      allowedModules: ['DASHBOARD', 'REMOTE_TERMINAL'],
      expiresAt: null,
      licenseKey: 'QS-TEST',
      customerName: 'Test',
      status: 'ACTIVE',
      deploymentMode: 'onprem',
    });

    await expect(
      service.getResolvedModulesAsync(TenantPlan.STARTER, {}),
    ).resolves.toEqual(['DASHBOARD']);
  });

  it('refuses first-boot bootstrap with ChangeMe passwords', async () => {
    const oldOwner = process.env.OWNER_PASSWORD;
    const oldAdmin = process.env.TENANT_ADMIN_PASSWORD;
    process.env.OWNER_PASSWORD = 'ChangeMe@123';
    process.env.TENANT_ADMIN_PASSWORD = 'ChangeMe@123';
    const prisma: any = {
      tenant: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(),
    };
    const service = new ProductLicenseService(prisma);

    await service.bootstrapOnPremIfNeeded();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    if (oldOwner === undefined) delete process.env.OWNER_PASSWORD;
    else process.env.OWNER_PASSWORD = oldOwner;
    if (oldAdmin === undefined) delete process.env.TENANT_ADMIN_PASSWORD;
    else process.env.TENANT_ADMIN_PASSWORD = oldAdmin;
  });
});
