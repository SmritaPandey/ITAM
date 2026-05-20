import { Test, TestingModule } from '@nestjs/testing';
import { ItilAutomationService } from './itil-automation.service';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService, DomainEvent } from '../../common/events/event-bus.service';

describe('ItilAutomationService', () => {
  let service: ItilAutomationService;
  let prisma: any;
  let eventBus: EventBusService;

  const mockPrisma = {
    ticketAsset: {
      findMany: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    problem: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItilAutomationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: new EventBusService() },
      ],
    }).compile();

    service = module.get<ItilAutomationService>(ItilAutomationService);
    prisma = module.get(PrismaService);
    eventBus = module.get(EventBusService);

    jest.clearAllMocks();
  });

  it('should auto-promote to problem when threshold of incidents is met', async () => {
    const event: DomainEvent = {
      type: 'ticket.created',
      tenantId: 'tenant-abc',
      payload: { id: 'tkt-3', ticketNumber: 'TKT-000003', subject: 'Incident 3', priority: 'HIGH' },
      timestamp: new Date(),
    };

    // 1. Mock ticketAsset query for incoming ticket
    mockPrisma.ticketAsset.findMany
      .mockResolvedValueOnce([
        { id: 'ta-3', ticketId: 'tkt-3', assetId: 'asset-123', asset: { id: 'asset-123', name: 'Core Router', assetTag: 'AST-99' } }
      ])
      // 2. Mock recent ticketAsset query for same asset
      .mockResolvedValueOnce([
        { id: 'ta-1', ticketId: 'tkt-1', assetId: 'asset-123', ticket: { id: 'tkt-1', ticketNumber: 'TKT-000001', subject: 'Incident 1', priority: 'HIGH' } },
        { id: 'ta-2', ticketId: 'tkt-2', assetId: 'asset-123', ticket: { id: 'tkt-2', ticketNumber: 'TKT-000002', subject: 'Incident 2', priority: 'HIGH' } },
        { id: 'ta-3', ticketId: 'tkt-3', assetId: 'asset-123', ticket: { id: 'tkt-3', ticketNumber: 'TKT-000003', subject: 'Incident 3', priority: 'HIGH' } },
      ]);

    // 3. Mock tenant settings (default rules: 3 incidents threshold)
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-abc',
      settings: {
        itilAutomation: { enabled: true, timeWindowMinutes: 60, thresholdCount: 3 }
      }
    });

    // 4. Mock problem check
    mockPrisma.problem.findMany.mockResolvedValue([]);
    mockPrisma.problem.count.mockResolvedValue(0);
    mockPrisma.problem.create.mockResolvedValue({ id: 'prb-1', problemNumber: 'PRB-00001' });

    // 5. Mock user query for admins
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    mockPrisma.notification.create.mockResolvedValue({});

    await service.handleTicketCreated(event);

    expect(mockPrisma.problem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-abc',
          problemNumber: 'PRB-00001',
          title: expect.stringContaining('Multiple failures detected on Core Router'),
          priority: 'HIGH',
          status: 'OPEN',
        })
      })
    );

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-abc',
          userId: 'admin-1',
          module: 'problems',
        })
      })
    );
  });
});
