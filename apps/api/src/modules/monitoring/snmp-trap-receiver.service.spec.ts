import { SnmpTrapReceiverService } from './snmp-trap-receiver.service';

describe('SnmpTrapReceiverService', () => {
  let service: SnmpTrapReceiverService;
  const mockPrisma: any = {
    monitoredDevice: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const mockEventBus: any = {
    emitMonitoringEvent: jest.fn(),
  };

  beforeEach(() => {
    service = new SnmpTrapReceiverService(mockPrisma, mockEventBus);
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.stop();
  });

  describe('OID resolution', () => {
    it('should resolve standard linkDown OID', () => {
      // Access private method via any cast for testing
      const result = (service as any).resolveOid('1.3.6.1.6.3.1.1.5.3');
      expect(result.type).toBe('linkDown');
      expect(result.severity).toBe('critical');
    });

    it('should resolve standard linkUp OID', () => {
      const result = (service as any).resolveOid('1.3.6.1.6.3.1.1.5.4');
      expect(result.type).toBe('linkUp');
      expect(result.severity).toBe('info');
    });

    it('should resolve coldStart OID', () => {
      const result = (service as any).resolveOid('1.3.6.1.6.3.1.1.5.1');
      expect(result.type).toBe('coldStart');
      expect(result.severity).toBe('warning');
    });

    it('should resolve warmStart OID', () => {
      const result = (service as any).resolveOid('1.3.6.1.6.3.1.1.5.2');
      expect(result.type).toBe('warmStart');
      expect(result.severity).toBe('info');
    });

    it('should resolve authenticationFailure OID', () => {
      const result = (service as any).resolveOid('1.3.6.1.6.3.1.1.5.5');
      expect(result.type).toBe('authenticationFailure');
      expect(result.severity).toBe('warning');
    });

    it('should resolve Cisco enterprise OID by prefix', () => {
      const result = (service as any).resolveOid('1.3.6.1.4.1.9.9.43.2.0.1');
      expect(result.type).toBe('configChange');
      expect(result.severity).toBe('warning');
    });

    it('should return unknownTrap for unrecognized OIDs', () => {
      const result = (service as any).resolveOid('1.3.6.1.99.99.99');
      expect(result.type).toBe('unknownTrap');
      expect(result.severity).toBe('info');
    });
  });

  describe('BER OID decoding', () => {
    it('should decode BER-encoded OID bytes', () => {
      // 1.3.6.1 = bytes [43, 6, 1]
      const buf = Buffer.from([43, 6, 1]);
      const result = (service as any).decodeOid(buf);
      expect(result).toBe('1.3.6.1');
    });

    it('should handle empty buffer', () => {
      const result = (service as any).decodeOid(Buffer.from([]));
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct stats structure', () => {
      const stats = service.getStats();
      expect(stats).toHaveProperty('total', 0);
      expect(stats).toHaveProperty('isRunning', false);
      expect(stats).toHaveProperty('port');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('bySeverity');
    });
  });

  describe('clearBuffer', () => {
    it('should clear the trap buffer', () => {
      // Manually add some traps to buffer
      (service as any).trapBuffer = [
        { sourceIp: '10.0.0.1', type: 'linkDown', severity: 'critical', receivedAt: new Date() },
        { sourceIp: '10.0.0.2', type: 'linkUp', severity: 'info', receivedAt: new Date() },
      ];
      const result = service.clearBuffer();
      expect(result.cleared).toBe(2);
      expect(service.getStats().total).toBe(0);
    });
  });

  describe('getRecentTraps', () => {
    it('should return all traps when no tenantId provided', async () => {
      (service as any).trapBuffer = [
        { sourceIp: '10.0.0.1', type: 'linkDown', severity: 'critical', receivedAt: new Date() },
      ];
      const traps = await service.getRecentTraps(undefined, 10);
      expect(traps).toHaveLength(1);
    });

    it('should filter by tenant device IPs', async () => {
      mockPrisma.monitoredDevice.findMany.mockResolvedValue([
        { ipAddress: '10.0.0.1' },
      ]);
      (service as any).trapBuffer = [
        { sourceIp: '10.0.0.1', type: 'linkDown', severity: 'critical', receivedAt: new Date() },
        { sourceIp: '10.0.0.99', type: 'linkUp', severity: 'info', receivedAt: new Date() },
      ];
      const traps = await service.getRecentTraps('tenant-1', 10);
      expect(traps).toHaveLength(1);
      expect(traps[0].sourceIp).toBe('10.0.0.1');
    });
  });
});
