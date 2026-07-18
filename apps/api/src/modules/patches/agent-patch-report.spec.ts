import { NotFoundException } from '@nestjs/common';
import { PatchesService } from './patches.service';

/**
 * Agent patch inventory ingestion. processAgentPatchReport() upserts patches
 * reported by an endpoint agent, records per-asset deployment state for
 * installed patches, and emits an asset event.
 */
describe('PatchesService.processAgentPatchReport', () => {
  const TENANT = 'tenant-1';
  const AGENT = 'agent-1';

  function makeService(agent: any, existingByPatchId: Record<string, any> = {}) {
    const prisma: any = {
      agent: { findFirst: jest.fn().mockResolvedValue(agent) },
      patch: {
        findFirst: jest.fn((args: any) => Promise.resolve(existingByPatchId[args.where.patchId] || null)),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn((args: any) => Promise.resolve({ id: `p-${args.data.patchId}`, ...args.data })),
      },
      patchDeployment: {
        create: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const eventBus: any = { emitAssetEvent: jest.fn() };
    const service = new PatchesService(prisma, eventBus, {} as any);
    return { service, prisma, eventBus };
  }

  it('creates new patches and per-asset deployment records', async () => {
    const { service, prisma, eventBus } = makeService({ id: AGENT, tenantId: TENANT, assetId: 'asset-1', hostname: 'host-1' });

    const result = await service.processAgentPatchReport(TENANT, AGENT, [
      { patchId: 'KB100', title: 'Security update', severity: 'CRITICAL', category: 'Security', installed: false },
      { patchId: 'KB200', title: 'Feature update', severity: 'LOW', category: 'Feature', installed: true },
    ]);

    expect(result).toEqual({ agentId: AGENT, created: 2, updated: 0, total: 2 });
    expect(prisma.patch.create).toHaveBeenCalledTimes(2);

    // installed patch is created as Deployed with a DEPLOYED deployment
    const kb200 = prisma.patch.create.mock.calls.find(
      (c: any) => c[0].data.patchId === 'KB200',
    )[0].data;
    expect(kb200.status).toBe('Deployed');
    expect(kb200.scanSource).toBe('AGENT');

    const deploymentStatuses = prisma.patchDeployment.create.mock.calls.map(
      (c: any) => c[0].data.status,
    );
    expect(deploymentStatuses).toEqual(expect.arrayContaining(['PENDING', 'DEPLOYED']));

    expect(eventBus.emitAssetEvent).toHaveBeenCalledWith(
      TENANT,
      'agent_patch_report',
      expect.objectContaining({ agentId: AGENT, created: 2 }),
    );
  });

  it('updates existing (non-deployed) patches and marks installed deployments', async () => {
    const { service, prisma } = makeService(
      { id: AGENT, tenantId: TENANT, assetId: 'asset-1', hostname: 'host-1' },
      { KB100: { id: 'p-existing', status: 'Pending' } },
    );

    const result = await service.processAgentPatchReport(TENANT, AGENT, [
      { patchId: 'KB100', title: 'Security update v2', severity: 'HIGH', category: 'Security', installed: true },
    ]);

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(prisma.patch.update).toHaveBeenCalledTimes(1);
    // installed → deployment upserted to DEPLOYED
    expect(prisma.patchDeployment.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.patchDeployment.upsert.mock.calls[0][0].create.status).toBe('DEPLOYED');
  });

  it('does not re-update patches already marked Deployed', async () => {
    const { service, prisma } = makeService(
      { id: AGENT, tenantId: TENANT, assetId: 'asset-1', hostname: 'host-1' },
      { KB100: { id: 'p-existing', status: 'Deployed' } },
    );

    const result = await service.processAgentPatchReport(TENANT, AGENT, [
      { patchId: 'KB100', title: 'x', severity: 'HIGH', category: 'Security', installed: false },
    ]);

    expect(result.updated).toBe(0);
    expect(prisma.patch.update).not.toHaveBeenCalled();
  });

  it('throws NotFound when the agent does not belong to the tenant', async () => {
    const { service, prisma } = makeService(null);

    await expect(
      service.processAgentPatchReport(TENANT, 'ghost', [{ patchId: 'KB1', title: 't', severity: 'LOW', category: 'c' }]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.agent.findFirst.mock.calls[0][0].where.tenantId).toBe(TENANT);
  });
});
