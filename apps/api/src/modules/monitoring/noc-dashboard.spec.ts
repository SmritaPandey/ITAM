import { MonitoringController } from './monitoring.controller';

/**
 * NOC dashboard aggregation. getNocDashboard() fans out to topology, alerts,
 * traps, syslog, netflow top-talkers and device SNMP data, then derives the
 * top-interfaces ranking and the online/warning/offline device summary.
 */
describe('MonitoringController.getNocDashboard', () => {
  const TENANT = 'tenant-1';
  const req = { user: { tenantId: TENANT } };

  function makeController(devices: any[]) {
    const service: any = {
      getTopology: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
      getAlerts: jest.fn().mockResolvedValue([{ id: 'al-1' }]),
    };
    const trapReceiver: any = {
      getRecentTraps: jest.fn().mockResolvedValue([{ id: 'trap-1' }]),
      getStats: jest.fn().mockReturnValue({ isRunning: true }),
    };
    const syslogReceiver: any = {
      getEvents: jest.fn().mockResolvedValue({ events: [{ id: 'sys-1' }] }),
      getStats: jest.fn().mockReturnValue({ isRunning: true, port: 5514 }),
    };
    const netflowCollector: any = {
      getTopTalkers: jest.fn().mockResolvedValue({ talkers: [{ ip: '10.0.0.1' }] }),
      getStats: jest.fn().mockResolvedValue({ flows: 10 }),
    };
    const prisma: any = {
      monitoredDevice: { findMany: jest.fn().mockResolvedValue(devices) },
    };

    const controller = new MonitoringController(
      service,
      {} as any, // snmpPoller
      trapReceiver,
      {} as any, // onvifDiscovery
      {} as any, // vdiHypervisor
      {} as any, // cameraHls
      syslogReceiver,
      netflowCollector,
      {} as any, // topologyService
      prisma,
    );
    return { controller, service, trapReceiver, syslogReceiver, netflowCollector, prisma };
  }

  it('aggregates all NOC panels and ranks top interfaces by throughput', async () => {
    const { controller, service, prisma } = makeController([
      {
        id: 'd1',
        name: 'core-sw',
        status: 'ONLINE',
        config: {
          interfaces: [
            { name: 'gi0/1', status: 'up', inOctets: 100, outOctets: 100 },
            { name: 'gi0/2', status: 'up', inOctets: 5000, outOctets: 5000 },
          ],
        },
      },
      { id: 'd2', name: 'edge', status: 'OFFLINE', config: {} },
      { id: 'd3', name: 'dist', status: 'WARNING', config: { interfaces: 'not-an-array' } },
    ]);

    const result = await controller.getNocDashboard(req);

    expect(service.getTopology).toHaveBeenCalledWith(TENANT);
    expect(result.alarms).toEqual([{ id: 'al-1' }]);
    expect(result.recentTraps).toEqual([{ id: 'trap-1' }]);
    expect(result.recentSyslog).toEqual([{ id: 'sys-1' }]);
    expect(result.topTalkers).toEqual([{ ip: '10.0.0.1' }]);

    // top interfaces are sorted by (in+out) desc — the 5000/5000 iface leads
    expect(result.topInterfaces[0].name).toBe('gi0/2');
    expect(result.topInterfaces).toHaveLength(2);

    // device summary buckets by status
    expect(result.deviceSummary).toEqual({ total: 3, online: 1, warning: 1, offline: 1 });

    // NETWORK_DEVICE query is tenant-scoped
    const where = prisma.monitoredDevice.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.type).toBe('NETWORK_DEVICE');

    // collector health surfaced
    expect(result.collectors.syslog).toEqual({ isRunning: true, port: 5514 });
  });

  it('handles an empty NOC gracefully', async () => {
    const { controller } = makeController([]);

    const result = await controller.getNocDashboard(req);

    expect(result.topInterfaces).toEqual([]);
    expect(result.deviceSummary).toEqual({ total: 0, online: 0, warning: 0, offline: 0 });
  });
});
