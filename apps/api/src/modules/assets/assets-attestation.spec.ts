import { HttpException, NotFoundException } from '@nestjs/common';
import { AssetsService } from './assets.service';

/**
 * Attestation campaign coverage for AssetsService. These methods read/write the
 * assetAttestation table directly via prisma, so we only stub the tables each
 * method touches. metering + jobQueue are unused by these paths.
 */
describe('AssetsService attestation campaigns', () => {
  const TENANT = 'tenant-1';

  function makeService(overrides: any = {}) {
    const prisma: any = {
      asset: { findMany: jest.fn() },
      assetAttestation: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      alertEvent: { create: jest.fn().mockResolvedValue({ id: 'ae-1' }) },
      ...overrides,
    };
    const service = new AssetsService(prisma, {} as any, {} as any);
    return { service, prisma };
  }

  describe('createAttestationCampaign', () => {
    it('creates one attestation per assigned asset scoped to the tenant', async () => {
      const { service, prisma } = makeService();
      prisma.asset.findMany.mockResolvedValue([
        { id: 'a1', assignedToId: 'u1' },
        { id: 'a2', assignedToId: 'u2' },
      ]);

      const result = await service.createAttestationCampaign(TENANT, 'Q3 Audit');

      expect(result).toEqual({ campaign: 'Q3 Audit', assetsRequested: 2 });

      // only active, assigned, non-deleted assets for this tenant are targeted
      const where = prisma.asset.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT);
      expect(where.deletedAt).toBeNull();
      expect(where.status).toBe('ACTIVE');
      expect(where.assignedToId).toEqual({ not: null });

      const records = prisma.assetAttestation.createMany.mock.calls[0][0].data;
      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({ tenantId: TENANT, assetId: 'a1', userId: 'u1', campaignName: 'Q3 Audit' });
    });

    it('scopes to explicit assetIds / userIds when provided', async () => {
      const { service, prisma } = makeService();
      prisma.asset.findMany.mockResolvedValue([{ id: 'a1', assignedToId: 'u1' }]);

      await service.createAttestationCampaign(TENANT, 'Targeted', {
        assetIds: ['a1'],
        userIds: ['u1'],
      });

      const where = prisma.asset.findMany.mock.calls[0][0].where;
      expect(where.id).toEqual({ in: ['a1'] });
      expect(where.assignedToId).toEqual({ in: ['u1'] });
    });

    it('defaults the campaign name when blank and skips createMany with no assets', async () => {
      const { service, prisma } = makeService();
      prisma.asset.findMany.mockResolvedValue([]);

      const result = await service.createAttestationCampaign(TENANT, '   ');

      expect(result.assetsRequested).toBe(0);
      expect(result.campaign).toMatch(/^Attestation \d{4}-\d{2}-\d{2}$/);
      expect(prisma.assetAttestation.createMany).not.toHaveBeenCalled();
    });
  });

  describe('respondAttestation', () => {
    it('records a valid response with a timestamp', async () => {
      const { service, prisma } = makeService();
      prisma.assetAttestation.findFirst.mockResolvedValue({ id: 'at-1', tenantId: TENANT });
      prisma.assetAttestation.update.mockResolvedValue({ id: 'at-1', response: 'CONFIRMED' });

      const result = await service.respondAttestation('at-1', TENANT, 'CONFIRMED', 'all good');

      expect(result.response).toBe('CONFIRMED');
      const updateArg = prisma.assetAttestation.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'at-1' });
      expect(updateArg.data.response).toBe('CONFIRMED');
      expect(updateArg.data.notes).toBe('all good');
      expect(updateArg.data.respondedAt).toBeInstanceOf(Date);
    });

    it('throws NotFound when the attestation is missing (and cross-tenant safe)', async () => {
      const { service, prisma } = makeService();
      prisma.assetAttestation.findFirst.mockResolvedValue(null);

      await expect(
        service.respondAttestation('nope', TENANT, 'CONFIRMED'),
      ).rejects.toBeInstanceOf(NotFoundException);
      // lookup is tenant-scoped
      expect(prisma.assetAttestation.findFirst.mock.calls[0][0].where.tenantId).toBe(TENANT);
      expect(prisma.assetAttestation.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid response value', async () => {
      const { service, prisma } = makeService();
      prisma.assetAttestation.findFirst.mockResolvedValue({ id: 'at-1', tenantId: TENANT });

      await expect(
        service.respondAttestation('at-1', TENANT, 'MAYBE'),
      ).rejects.toBeInstanceOf(HttpException);
      expect(prisma.assetAttestation.update).not.toHaveBeenCalled();
    });
  });

  describe('remindAttestations', () => {
    it('emits an AlertEvent per pending attestation', async () => {
      const { service, prisma } = makeService();
      prisma.assetAttestation.findMany.mockResolvedValue([
        { id: 'at-1', assetId: 'a1', userId: 'u1', campaignName: 'Q3', asset: { id: 'a1', name: 'Laptop', assetTag: 'AT-1' } },
        { id: 'at-2', assetId: 'a2', userId: 'u2', campaignName: 'Q3', asset: { id: 'a2', name: 'Phone', assetTag: 'AT-2' } },
      ]);

      const result = await service.remindAttestations(TENANT, 'Q3');

      expect(result).toEqual({ reminded: 2, pending: 2, campaignName: 'Q3' });
      expect(prisma.alertEvent.create).toHaveBeenCalledTimes(2);

      // query filters to unresponded attestations for the tenant + campaign
      const where = prisma.assetAttestation.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT);
      expect(where.response).toBeNull();
      expect(where.campaignName).toBe('Q3');

      const alertData = prisma.alertEvent.create.mock.calls[0][0].data;
      expect(alertData.category).toBe('ATTESTATION');
      expect(alertData.source).toBe('itam.attestation');
      expect(alertData.metadata.attestationId).toBe('at-1');
    });

    it('is a no-op when nothing is pending', async () => {
      const { service, prisma } = makeService();
      prisma.assetAttestation.findMany.mockResolvedValue([]);

      const result = await service.remindAttestations(TENANT);

      expect(result).toEqual({ reminded: 0, pending: 0, campaignName: null });
      expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    });
  });
});
