import { HttpException } from '@nestjs/common';
import { AssetsService } from './assets.service';

/**
 * RFID lookup coverage. findByRfid() delegates to lookupByBarcode(), which
 * queries prisma.asset.findFirst — we assert the query is always scoped to the
 * caller's tenantId and matches the rfidTag.
 */
describe('AssetsService.findByRfid', () => {
  const TENANT = 'tenant-1';
  const asset = { id: 'a1', name: 'Tagged Asset', rfidTag: 'RF-123', tenantId: TENANT };

  function makeService() {
    const findFirst = jest.fn().mockResolvedValue(asset);
    const prisma: any = { asset: { findFirst } };
    const service = new AssetsService(prisma, {} as any, {} as any);
    return { service, findFirst };
  }

  it('scopes the lookup to the tenant and matches rfidTag', async () => {
    const { service, findFirst } = makeService();

    const result = await service.findByRfid(TENANT, 'RF-123');

    expect(result).toBe(asset);
    expect(findFirst).toHaveBeenCalledTimes(1);
    const args = findFirst.mock.calls[0][0];
    expect(args.where.tenantId).toBe(TENANT);
    expect(args.where.deletedAt).toBeNull();
    // rfidTag must be one of the OR match clauses
    const rfidClause = args.where.OR.find((c: any) => c.rfidTag);
    expect(rfidClause).toBeDefined();
    expect(rfidClause.rfidTag).toEqual({ equals: 'RF-123', mode: 'insensitive' });
  });

  it('does not leak other tenants (tenantId is always in the filter)', async () => {
    const { service, findFirst } = makeService();

    await service.findByRfid('tenant-999', 'RF-123');

    expect(findFirst.mock.calls[0][0].where.tenantId).toBe('tenant-999');
  });

  it('trims whitespace from the tag before lookup', async () => {
    const { service, findFirst } = makeService();

    await service.findByRfid(TENANT, '  RF-123  ');

    const rfidClause = findFirst.mock.calls[0][0].where.OR.find((c: any) => c.rfidTag);
    expect(rfidClause.rfidTag.equals).toBe('RF-123');
  });

  it('rejects an empty RFID tag', async () => {
    const { service, findFirst } = makeService();

    await expect(service.findByRfid(TENANT, '   ')).rejects.toBeInstanceOf(HttpException);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
