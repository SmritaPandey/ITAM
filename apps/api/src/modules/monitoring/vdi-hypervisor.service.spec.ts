import { VdiHypervisorService } from './vdi-hypervisor.service';

describe('VdiHypervisorService', () => {
  let service: VdiHypervisorService;
  const mockPrisma: any = {
    monitoredDevice: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'vm-1', ...args.data })),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ settings: {} }),
    },
  };
  const mockEventBus: any = {
    emitMonitoringEvent: jest.fn(),
  };

  beforeEach(() => {
    service = new VdiHypervisorService(mockPrisma, mockEventBus);
    jest.clearAllMocks();
  });

  describe('Horizon status mapping', () => {
    it('should map AVAILABLE to running', () => {
      const result = (service as any).mapHorizonStatus('AVAILABLE');
      expect(result).toBe('running');
    });

    it('should map CONNECTED to running', () => {
      const result = (service as any).mapHorizonStatus('CONNECTED');
      expect(result).toBe('running');
    });

    it('should map MAINTENANCE to suspended', () => {
      const result = (service as any).mapHorizonStatus('MAINTENANCE');
      expect(result).toBe('suspended');
    });

    it('should map AGENT_UNREACHABLE to suspended', () => {
      const result = (service as any).mapHorizonStatus('AGENT_UNREACHABLE');
      expect(result).toBe('suspended');
    });

    it('should map ERROR to error', () => {
      const result = (service as any).mapHorizonStatus('ERROR');
      expect(result).toBe('error');
    });

    it('should map unknown states to stopped', () => {
      const result = (service as any).mapHorizonStatus('POWERED_OFF');
      expect(result).toBe('stopped');
    });
  });

  describe('uptime formatting', () => {
    it('should format seconds to days and hours', () => {
      const result = (service as any).formatUptime(90000); // 1 day 1 hour
      expect(result).toBe('1d 1h');
    });

    it('should format seconds to hours and minutes', () => {
      const result = (service as any).formatUptime(5400); // 1h 30m
      expect(result).toBe('1h 30m');
    });

    it('should handle zero seconds', () => {
      const result = (service as any).formatUptime(0);
      expect(result).toBe('0h 0m');
    });
  });

  describe('getHypervisors', () => {
    it('should return empty array when no hypervisors configured', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ settings: {} });
      const result = await service.getHypervisors('tenant-1');
      expect(result).toEqual([]);
    });

    it('should return hypervisors from tenant settings', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        settings: { hypervisors: [{ type: 'proxmox', host: '10.0.0.1', port: 8006, username: 'root', password: 'secret' }] },
      });
      const result = await service.getHypervisors('tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('proxmox');
    });
  });

  describe('syncHypervisor', () => {
    it('should reject unsupported hypervisor types', async () => {
      const result = await service.syncHypervisor('tenant-1', { type: 'unknown', host: '10.0.0.1', port: 443, username: '', password: '' } as any);
      expect(result.totalVMs).toBe(0);
      expect(result.created).toBe(0);
    });
  });
});
