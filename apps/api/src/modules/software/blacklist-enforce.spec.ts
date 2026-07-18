import { SoftwareService } from './software.service';

/**
 * Blacklist enforcement. enforceBlacklistToAgents() fans a blacklisted package
 * out to every agent on the affected assets by pushing KILL_PROCESS /
 * UNINSTALL_PACKAGE / BLOCK_INSTALL entries into the agent's pending actions and
 * upserting a policy snapshot.
 */
describe('SoftwareService.enforceBlacklistToAgents', () => {
  const TENANT = 'tenant-1';
  const software = { id: 'sw-1', name: 'BitTorrent', publisher: 'BitTorrent Inc' };

  function makeService(installs: any[], agents: any[]) {
    const agentUpdate = jest.fn().mockResolvedValue({});
    const snapshotUpsert = jest.fn().mockResolvedValue({});
    const prisma: any = {
      softwareInstallation: { findMany: jest.fn().mockResolvedValue(installs) },
      agent: {
        findMany: jest.fn().mockResolvedValue(agents),
        update: agentUpdate,
      },
      softwarePolicySnapshot: { upsert: snapshotUpsert },
    };
    const service = new SoftwareService(prisma);
    return { service, prisma, agentUpdate, snapshotUpsert };
  }

  it('enqueues pending actions on each affected agent', async () => {
    const { service, prisma, agentUpdate, snapshotUpsert } = makeService(
      [{ assetId: 'a1' }, { assetId: 'a1' }, { assetId: 'a2' }], // dedups to a1, a2
      [{ id: 'agent-1', assetId: 'a1', systemInfo: {} }],
    );

    const result = await service.enforceBlacklistToAgents(TENANT, software);

    expect(result.enqueued).toBe(1);
    expect(result.assets).toBe(2); // a1 + a2 (deduped)

    // agent lookup scoped to the deduped asset ids and tenant
    const agentQuery = prisma.agent.findMany.mock.calls[0][0];
    expect(agentQuery.where.tenantId).toBe(TENANT);
    expect(agentQuery.where.assetId.in).toEqual(expect.arrayContaining(['a1', 'a2']));

    // pending actions pushed onto the agent's systemInfo
    const updateData = agentUpdate.mock.calls[0][0].data.systemInfo;
    const actionTypes = updateData._pendingActions.map((a: any) => a.type);
    expect(actionTypes).toEqual(
      expect.arrayContaining(['KILL_PROCESS', 'UNINSTALL_PACKAGE', 'BLOCK_INSTALL']),
    );
    // the software policy entry is recorded
    expect(updateData._softwarePolicy[0]).toMatchObject({
      softwareId: 'sw-1',
      action: 'BLOCK',
    });

    // a policy snapshot is persisted per agent
    expect(snapshotUpsert).toHaveBeenCalledTimes(1);
    expect(snapshotUpsert.mock.calls[0][0].where.tenantId_agentId).toEqual({
      tenantId: TENANT,
      agentId: 'agent-1',
    });
  });

  it('appends to existing pending actions instead of overwriting', async () => {
    const existing = [{ type: 'EXISTING_ACTION' }];
    const { service, agentUpdate } = makeService(
      [{ assetId: 'a1' }],
      [{ id: 'agent-1', assetId: 'a1', systemInfo: { _pendingActions: existing } }],
    );

    await service.enforceBlacklistToAgents(TENANT, software);

    const pending = agentUpdate.mock.calls[0][0].data.systemInfo._pendingActions;
    expect(pending[0]).toEqual({ type: 'EXISTING_ACTION' });
    expect(pending.length).toBeGreaterThan(1);
  });

  it('enqueues for every affected agent', async () => {
    const { service, agentUpdate, snapshotUpsert } = makeService(
      [{ assetId: 'a1' }, { assetId: 'a2' }],
      [
        { id: 'agent-1', assetId: 'a1', systemInfo: {} },
        { id: 'agent-2', assetId: 'a2', systemInfo: {} },
      ],
    );

    const result = await service.enforceBlacklistToAgents(TENANT, software);

    expect(result.enqueued).toBe(2);
    expect(agentUpdate).toHaveBeenCalledTimes(2);
    expect(snapshotUpsert).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when no installs exist for the software', async () => {
    const { service, prisma, agentUpdate } = makeService([], []);

    const result = await service.enforceBlacklistToAgents(TENANT, software);

    expect(result).toEqual({ enqueued: 0, assets: 0 });
    expect(prisma.agent.findMany).not.toHaveBeenCalled();
    expect(agentUpdate).not.toHaveBeenCalled();
  });
});
