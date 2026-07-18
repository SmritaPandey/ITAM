import { NotFoundException } from '@nestjs/common';
import { CmdbService } from './cmdb.service';

/**
 * Business-service health rollup. rollupServiceHealth() loads a service's linked
 * assets, runs the (private) computeHealth reducer, and persists the derived
 * status. We assert the OUTAGE/DEGRADED/HEALTHY precedence rules.
 */
describe('CmdbService health rollup', () => {
  const TENANT = 'tenant-1';

  function makeService(links: any[]) {
    const prisma: any = {
      businessService: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'svc-1',
          name: 'Payments',
          status: 'HEALTHY',
          assets: links,
        }),
        update: jest.fn((args: any) => Promise.resolve({ id: 'svc-1', name: 'Payments', ...args.data })),
        findMany: jest.fn(),
      },
    };
    const service = new CmdbService(prisma);
    return { service, prisma };
  }

  const link = (role: string, status: string) => ({ role, asset: { id: 'a', name: 'n', status } });

  it('is HEALTHY when all linked assets are healthy', async () => {
    const { service, prisma } = makeService([link('CRITICAL', 'ACTIVE'), link('SUPPORTS', 'ACTIVE')]);

    const result = await service.rollupServiceHealth('svc-1', TENANT);

    expect(result.status).toBe('HEALTHY');
    expect(prisma.businessService.update.mock.calls[0][0].data.status).toBe('HEALTHY');
    // service lookup is tenant-scoped
    expect(prisma.businessService.findFirst.mock.calls[0][0].where.tenantId).toBe(TENANT);
  });

  it('is OUTAGE when a CRITICAL/DEPENDS asset is unhealthy', async () => {
    const { service } = makeService([link('CRITICAL', 'OFFLINE'), link('SUPPORTS', 'ACTIVE')]);

    const result = await service.rollupServiceHealth('svc-1', TENANT);

    expect(result.status).toBe('OUTAGE');
  });

  it('is DEGRADED when only a non-critical asset is unhealthy', async () => {
    const { service } = makeService([link('CRITICAL', 'ACTIVE'), link('SUPPORTS', 'RETIRED')]);

    const result = await service.rollupServiceHealth('svc-1', TENANT);

    expect(result.status).toBe('DEGRADED');
  });

  it('OUTAGE takes precedence over DEGRADED', async () => {
    const { service } = makeService([link('DEPENDS', 'LOST'), link('SUPPORTS', 'OFFLINE')]);

    const result = await service.rollupServiceHealth('svc-1', TENANT);

    expect(result.status).toBe('OUTAGE');
  });

  it('throws NotFound when the service is missing', async () => {
    const { service, prisma } = makeService([]);
    prisma.businessService.findFirst.mockResolvedValue(null);

    await expect(service.rollupServiceHealth('missing', TENANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rollupAll rolls up every service for the tenant', async () => {
    const { service, prisma } = makeService([link('CRITICAL', 'ACTIVE')]);
    prisma.businessService.findMany.mockResolvedValue([{ id: 'svc-1' }, { id: 'svc-2' }]);

    const result = await service.rollupAll(TENANT);

    expect(result.updated).toBe(2);
    expect(prisma.businessService.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT);
  });
});
