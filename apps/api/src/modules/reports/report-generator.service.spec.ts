import { Test, TestingModule } from '@nestjs/testing';
import { ReportGeneratorService } from './report-generator.service';
import { PrismaService } from '../../common/database/prisma.service';

describe('ReportGeneratorService', () => {
  let service: ReportGeneratorService;

  const mockPrisma = {
    asset: {
      findMany: jest.fn().mockResolvedValue([
        { name: 'Laptop-01', assetTag: 'IT-001', status: 'ACTIVE', category: 'Hardware',
          currentValue: { toNumber: () => 50000 }, purchasePrice: { toNumber: () => 60000 },
          purchaseDate: new Date(), assetType: { name: 'Laptop' }, department: { name: 'IT' },
          location: { name: 'HQ' }, assignedTo: { firstName: 'John', lastName: 'Doe', email: 'j@t.com' } },
        { name: 'Server-01', assetTag: 'IT-002', status: 'ACTIVE', category: 'Hardware',
          currentValue: { toNumber: () => 200000 }, purchasePrice: { toNumber: () => 250000 },
          purchaseDate: new Date(), assetType: { name: 'Server' }, department: { name: 'IT' },
          location: { name: 'DC' }, assignedTo: null },
      ]),
    },
    ticket: {
      findMany: jest.fn().mockResolvedValue([
        { ticketNumber: 'TK-001', subject: 'Fix printer', status: 'OPEN', priority: 'MEDIUM',
          category: 'Hardware', createdAt: new Date(), resolvedAt: null,
          requester: { firstName: 'A', lastName: 'B' }, assignee: null },
        { ticketNumber: 'TK-002', subject: 'VPN issue', status: 'RESOLVED', priority: 'HIGH',
          category: 'Network', createdAt: new Date(Date.now() - 86400000), resolvedAt: new Date(),
          requester: { firstName: 'C', lastName: 'D' }, assignee: { firstName: 'E', lastName: 'F' } },
      ]),
    },
    license: {
      findMany: jest.fn().mockResolvedValue([
        { softwareName: 'Office 365', vendor: 'Microsoft', licenseType: 'SUBSCRIPTION',
          totalSeats: 100, usedSeats: 85, status: 'ACTIVE', complianceStatus: 'COMPLIANT',
          expiryDate: new Date(Date.now() + 90 * 86400000),
          renewalCost: { toNumber: () => 500000 }, purchaseCost: { toNumber: () => 500000 } },
      ]),
    },
    monitoredDevice: {
      findMany: jest.fn().mockResolvedValue([
        { name: 'Switch-01', ipAddress: '10.0.0.1', status: 'ONLINE', lastSeen: new Date(),
          config: { deviceType: 'Switch' }, metrics: { cpu: 45, memory: 60, latency: 12, sysUpTime: 8640000 } },
        { name: 'Router-01', ipAddress: '10.0.0.2', status: 'OFFLINE', lastSeen: null,
          config: { deviceType: 'Router' }, metrics: {} },
      ]),
    },
    patch: {
      findMany: jest.fn().mockResolvedValue([
        { patchId: 'KB5001', title: 'Security Update', severity: 'Critical', status: 'Pending',
          category: 'Security', affectedAssets: 15, deployedDate: null, createdAt: new Date() },
      ]),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([
        { timestamp: new Date(), actorId: 'user-1', action: 'CREATE', resourceType: 'Asset',
          resourceId: 'a-1', ipAddress: '192.168.1.1', hash: 'abc123' },
      ]),
    },
    endpointPolicy: { findMany: jest.fn().mockResolvedValue([]) },
    endpointChange: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportGeneratorService>(ReportGeneratorService);
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate asset report with correct structure', async () => {
      const report = await service.generate('tenant-1', 'assets') as any;
      expect(report.title).toBe('Asset Inventory Report');
      expect(report.headers).toContain('Asset Tag');
      expect(report.rows).toHaveLength(2);
      expect(report.summary.totalAssets).toBe(2);
      expect(report.summary.totalValue).toBe(250000);
    });

    it('should generate ticket report with SLA data', async () => {
      const report = await service.generate('tenant-1', 'tickets') as any;
      expect(report.title).toBe('Ticket SLA Performance Report');
      expect(report.summary.total).toBe(2);
      expect(report.summary.resolved).toBe(1);
      expect(report.summary.open).toBe(1);
    });

    it('should generate license report', async () => {
      const report = await service.generate('tenant-1', 'licenses') as any;
      expect(report.title).toBe('License Utilization Report');
      expect(report.summary.total).toBe(1);
      expect(report.summary.compliant).toBe(1);
      expect(report.summary.totalSpend).toBe(500000);
    });

    it('should generate network report', async () => {
      const report = await service.generate('tenant-1', 'network') as any;
      expect(report.title).toBe('Network Health Report');
      expect(report.summary.total).toBe(2);
      expect(report.summary.online).toBe(1);
      expect(report.summary.offline).toBe(1);
    });

    it('should generate patch compliance report', async () => {
      const report = await service.generate('tenant-1', 'patches') as any;
      expect(report.title).toBe('Patch Compliance Report');
      expect(report.summary.total).toBe(1);
      expect(report.summary.criticalPending).toBe(1);
    });

    it('should generate executive report combining all sections', async () => {
      const report = await service.generate('tenant-1', 'executive') as any;
      expect(report.title).toBe('Executive Dashboard Report');
      expect(report.sections.assets).toBeDefined();
      expect(report.sections.tickets).toBeDefined();
      expect(report.sections.licenses).toBeDefined();
      expect(report.sections.network).toBeDefined();
      expect(report.sections.patches).toBeDefined();
    });

    it('should return error for unknown report type', async () => {
      const result = await service.generate('tenant-1', 'nonexistent') as any;
      expect(result.error).toContain('Unknown report type');
    });
  });

  describe('toCSV', () => {
    it('should generate valid CSV from report data', async () => {
      const report = await service.generate('tenant-1', 'assets') as any;
      const csv = service.toCSV(report);
      expect(csv).toContain('Asset Tag');
      expect(csv).toContain('IT-001');
      const lines = csv.split('\n');
      expect(lines.length).toBe(3); // header + 2 data rows
    });

    it('should handle empty reports', () => {
      const csv = service.toCSV({ title: 'Empty' });
      expect(csv).toBe('');
    });

    it('should escape values with commas and quotes', async () => {
      const report = { headers: ['Name'], rows: [['Device "A", model B']] };
      const csv = service.toCSV(report);
      expect(csv).toContain('""'); // Escaped quote
    });
  });

  describe('toXLSX', () => {
    it('should generate XLSX buffer from report data', async () => {
      const report = await service.generate('tenant-1', 'assets') as any;
      const buffer = await service.toXLSX(report);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // XLSX files start with PK (ZIP header)
      expect(buffer[0]).toBe(0x50); // 'P'
      expect(buffer[1]).toBe(0x4b); // 'K'
    });
  });
});
