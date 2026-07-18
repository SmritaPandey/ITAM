import { NotFoundException } from '@nestjs/common';
import { SoftwareService } from './software.service';

/**
 * License harvest/reclaim coverage plus the metering "last used" update path.
 * getHarvestRecommendations flags stale installs; reclaimHarvest raises a
 * reclaim ticket (and optional agent uninstall); ingestSoftware stamps
 * lastUsedAt on every install upsert.
 */
describe('SoftwareService harvest & reclaim', () => {
  const TENANT = 'tenant-1';

  describe('getHarvestRecommendations', () => {
    function makeService(installs: any[]) {
      const prisma: any = {
        softwareInstallation: { findMany: jest.fn().mockResolvedValue(installs) },
      };
      return { service: new SoftwareService(prisma), prisma };
    }

    it('recommends reclaiming stale/unused installs', async () => {
      const lastUsed = new Date(Date.now() - 120 * 86400000);
      const { service, prisma } = makeService([
        {
          id: 'inst-1',
          version: '1.0',
          lastUsedAt: lastUsed,
          software: { id: 'sw-1', name: 'Photoshop', publisher: 'Adobe', licenses: [{ id: 'l1', totalSeats: 10, usedSeats: 5, purchaseCost: 100 }] },
          asset: { id: 'a1', name: 'PC1', assetTag: 'AT-1', hostname: 'pc1', assignedTo: null },
        },
      ]);

      const result = await service.getHarvestRecommendations(TENANT, 90);

      expect(result).toHaveLength(1);
      expect(result[0].recommendation).toBe('RECLAIM');
      expect(result[0].softwareName).toBe('Photoshop');
      expect(result[0].daysUnused).toBeGreaterThanOrEqual(119);

      // query is tenant-scoped and only targets stale installs with licenses
      const where = prisma.softwareInstallation.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT);
      expect(where.OR).toEqual([
        { lastUsedAt: { lt: expect.any(Date) } },
        { lastUsedAt: null },
      ]);
      expect(where.software.licenses).toEqual({ some: {} });
    });

    it('reports null daysUnused for never-used installs', async () => {
      const { service } = makeService([
        {
          id: 'inst-2',
          version: '2.0',
          lastUsedAt: null,
          software: { id: 'sw-2', name: 'Vim', publisher: 'x', licenses: [{ id: 'l1' }] },
          asset: { id: 'a2', name: 'PC2', assetTag: 'AT-2', hostname: 'pc2', assignedTo: null },
        },
      ]);

      const result = await service.getHarvestRecommendations(TENANT);

      expect(result[0].daysUnused).toBeNull();
    });
  });

  describe('reclaimHarvest', () => {
    function makeService(inst: any, extra: any = {}) {
      const prisma: any = {
        softwareInstallation: { findFirst: jest.fn().mockResolvedValue(inst) },
        ticket: { count: jest.fn().mockResolvedValue(4), create: jest.fn().mockResolvedValue({ id: 'tkt-1', ticketNumber: 'INC-00005' }) },
        ticketAsset: { create: jest.fn().mockResolvedValue({}) },
        agent: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
        ...extra,
      };
      return { service: new SoftwareService(prisma), prisma };
    }

    const install = {
      id: 'inst-1',
      assetId: 'a1',
      lastUsedAt: new Date('2024-01-01'),
      software: { id: 'sw-1', name: 'Photoshop' },
      asset: { id: 'a1', name: 'PC1', assetTag: 'AT-1' },
    };

    it('creates a reclaim ticket and links the asset by default', async () => {
      const { service, prisma } = makeService(install);

      const result = await service.reclaimHarvest(TENANT, 'user-1', { installationId: 'inst-1' });

      expect(prisma.ticket.create).toHaveBeenCalledTimes(1);
      const ticketData = prisma.ticket.create.mock.calls[0][0].data;
      expect(ticketData.tenantId).toBe(TENANT);
      expect(ticketData.requesterId).toBe('user-1');
      expect(ticketData.subject).toContain('Photoshop');
      expect(ticketData.ticketNumber).toBe('INC-00005');
      expect(prisma.ticketAsset.create).toHaveBeenCalledTimes(1);
      expect(result.ticket).toMatchObject({ id: 'tkt-1' });
      expect(result.agentAction).toBeNull();
    });

    it('enqueues an UNINSTALL_SOFTWARE action when uninstall is requested', async () => {
      const { service, prisma } = makeService(install, {
        agent: {
          findFirst: jest.fn().mockResolvedValue({ id: 'agent-1', assetId: 'a1', systemInfo: {} }),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      const result = await service.reclaimHarvest(TENANT, 'user-1', {
        installationId: 'inst-1',
        createTicket: false,
        uninstall: true,
      });

      expect(prisma.ticket.create).not.toHaveBeenCalled();
      expect(result.agentAction.type).toBe('UNINSTALL_SOFTWARE');
      const pending = prisma.agent.update.mock.calls[0][0].data.systemInfo._pendingActions;
      expect(pending[0].type).toBe('UNINSTALL_SOFTWARE');
    });

    it('throws NotFound when the installation does not exist', async () => {
      const { service } = makeService(null);

      await expect(
        service.reclaimHarvest(TENANT, 'user-1', { installationId: 'missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('metering — ingestSoftware stamps lastUsedAt', () => {
    it('upserts installs with lastUsedAt set on both create and update', async () => {
      const catalogUpsert = jest.fn().mockResolvedValue({ id: 'sw-1', isBlacklisted: false, authorizationStatus: 'CURRENT' });
      const installUpsert = jest.fn().mockResolvedValue({});
      const prisma: any = {
        softwareCatalog: { upsert: catalogUpsert },
        softwareInstallation: { upsert: installUpsert },
      };
      const service = new SoftwareService(prisma);

      await service.ingestSoftware(TENANT, 'asset-1', [
        { name: 'Chrome', version: '120', publisher: 'Google' },
      ]);

      expect(installUpsert).toHaveBeenCalledTimes(1);
      const args = installUpsert.mock.calls[0][0];
      expect(args.create.lastUsedAt).toBeInstanceOf(Date);
      expect(args.update.lastUsedAt).toBeInstanceOf(Date);
      expect(args.where.tenantId_assetId_softwareId).toEqual({
        tenantId: TENANT,
        assetId: 'asset-1',
        softwareId: 'sw-1',
      });
    });
  });
});
