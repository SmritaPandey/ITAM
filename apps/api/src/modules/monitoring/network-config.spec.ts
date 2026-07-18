import { NotFoundException } from '@nestjs/common';
import { NetworkConfigController } from './network-config.controller';

/**
 * Config approve-and-push. approvePush() resolves a config version, then makes
 * an honest attempt to push over SSH, returning structured failure states when
 * prerequisites (device IP, credentials) are missing rather than pretending to
 * succeed. We cover the config-resolution + honest-failure branches with mocks.
 */
describe('NetworkConfigController.approvePush', () => {
  const TENANT = 'tenant-1';
  const req = { user: { tenantId: TENANT, sub: 'user-1' } };

  function makeController(overrides: any = {}) {
    const prisma: any = {
      networkConfig: { findFirst: jest.fn() },
      monitoredDevice: { findFirst: jest.fn().mockResolvedValue(null) },
      asset: { findFirst: jest.fn().mockResolvedValue(null) },
      scanCredential: { findMany: jest.fn().mockResolvedValue([]) },
      ...overrides,
    };
    const credentialVault: any = { getDecrypted: jest.fn().mockResolvedValue(null) };
    const controller = new NetworkConfigController(prisma, credentialVault);
    return { controller, prisma, credentialVault };
  }

  it('throws NotFound when the requested config version does not exist', async () => {
    const { controller, prisma } = makeController();
    prisma.networkConfig.findFirst.mockResolvedValue(null);

    await expect(
      controller.approvePush(req, 'dev-1', { configId: 'cfg-x' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // config lookup is tenant + device scoped
    const where = prisma.networkConfig.findFirst.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.deviceId).toBe('dev-1');
    expect(where.id).toBe('cfg-x');
  });

  it('returns NO_DEVICE_IP when the device has no resolvable IP', async () => {
    const { controller, prisma } = makeController();
    prisma.networkConfig.findFirst.mockResolvedValue({ id: 'cfg-1', version: 3, configText: 'hostname r1' });

    const result = await controller.approvePush(req, 'dev-1', { version: 3 });

    expect(result.success).toBe(false);
    expect(result.state).toBe('NO_DEVICE_IP');
    expect(result.version).toBe(3);
  });

  it('returns NO_CREDENTIALS when an IP exists but no SSH creds are available', async () => {
    const { controller, prisma } = makeController({
      monitoredDevice: { findFirst: jest.fn().mockResolvedValue({ id: 'dev-1', ipAddress: '10.0.0.5', config: {} }) },
    });
    prisma.networkConfig.findFirst.mockResolvedValue({ id: 'cfg-1', version: 3, configText: 'hostname r1' });

    const result = await controller.approvePush(req, 'dev-1', { version: 3 });

    expect(result.success).toBe(false);
    expect(result.state).toBe('NO_CREDENTIALS');
    expect(result.targetIp).toBe('10.0.0.5');
  });

  it('falls back to the baseline config when neither configId nor version is given', async () => {
    const { controller, prisma } = makeController();
    prisma.networkConfig.findFirst.mockResolvedValue({ id: 'cfg-base', version: 1, configText: 'baseline' });

    await controller.approvePush(req, 'dev-1', {});

    // first lookup targets the baseline version for the device
    const where = prisma.networkConfig.findFirst.mock.calls[0][0].where;
    expect(where.isBaseline).toBe(true);
    expect(where.deviceId).toBe('dev-1');
  });
});
