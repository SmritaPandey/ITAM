import { SyslogReceiverService } from './syslog-receiver.service';

/**
 * Syslog receiver: RFC3164/5424 parsing + alert creation. maybeCreateAlert()
 * dedups within a 30-minute window and maps syslog severity → AlertEvent
 * severity. parseSyslog() extracts PRI/facility/severity + message body.
 */
describe('SyslogReceiverService', () => {
  const TENANT = 'tenant-1';

  function makeService(overrides: any = {}) {
    const prisma: any = {
      alertEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'alert-1' }),
      },
      ...overrides,
    };
    const eventBus: any = { emitMonitoringEvent: jest.fn() };
    const service = new SyslogReceiverService(prisma, eventBus);
    return { service, prisma };
  }

  describe('parseSyslog', () => {
    it('extracts facility + severity from the PRI header', () => {
      const { service } = makeService();
      // PRI 34 => facility 4, severity 2 (critical)
      const parsed = service.parseSyslog('<34>Oct 11 22:14:15 mymachine su: failed', '10.0.0.1');
      expect(parsed).not.toBeNull();
      expect(parsed!.facility).toBe(4);
      expect(parsed!.severity).toBe(2);
      expect(parsed!.sourceIp).toBe('10.0.0.1');
      expect(parsed!.message).toContain('failed');
    });

    it('returns null for empty input', () => {
      const { service } = makeService();
      expect(service.parseSyslog('   ', '10.0.0.1')).toBeNull();
    });
  });

  describe('maybeCreateAlert', () => {
    const event = {
      sourceIp: '10.0.0.1',
      facility: 4,
      severity: 2,
      message: 'link down',
      receivedAt: new Date(),
    };

    it('creates a CRITICAL AlertEvent for a critical severity syslog', async () => {
      const { service, prisma } = makeService();

      const alertId = await (service as any).maybeCreateAlert(TENANT, event);

      expect(alertId).toBe('alert-1');
      const data = prisma.alertEvent.create.mock.calls[0][0].data;
      expect(data.tenantId).toBe(TENANT);
      expect(data.severity).toBe('CRITICAL');
      expect(data.source).toBe('syslog');
      expect(data.sourceId).toBe('10.0.0.1');
      expect(data.category).toBe('NETWORK');
    });

    it('dedups to an existing unresolved alert within the window', async () => {
      const { service, prisma } = makeService({
        alertEvent: {
          findFirst: jest.fn().mockResolvedValue({ id: 'existing-alert' }),
          create: jest.fn(),
        },
      });

      const alertId = await (service as any).maybeCreateAlert(TENANT, event);

      expect(alertId).toBe('existing-alert');
      expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    });

    it('maps a warning (severity 3) syslog to a WARNING alert', async () => {
      const { service, prisma } = makeService();

      await (service as any).maybeCreateAlert(TENANT, { ...event, severity: 3 });

      expect(prisma.alertEvent.create.mock.calls[0][0].data.severity).toBe('WARNING');
    });
  });
});
