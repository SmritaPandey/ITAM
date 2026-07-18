import { Test, TestingModule } from '@nestjs/testing';
import { AutomationService } from './automation.service';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService, DomainEvent } from '../../common/events/event-bus.service';
import { EmailService } from '../notifications/email.service';

describe('AutomationService', () => {
  let service: AutomationService;
  let prisma: any;
  let eventBus: EventBusService;

  const mockEmailService = {
    send: jest.fn().mockResolvedValue(undefined),
    sendMail: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrisma = {
    automationRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    automationExecution: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    notification: { create: jest.fn() },
    ticket: { create: jest.fn(), count: jest.fn() },
    asset: { update: jest.fn() },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: new EventBusService() },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AutomationService>(AutomationService);
    prisma = module.get(PrismaService);
    eventBus = module.get(EventBusService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('evaluateRules', () => {
    const baseEvent: DomainEvent = {
      type: 'monitoring.device_down',
      tenantId: 'tenant-1',
      payload: { deviceId: 'dev-1', name: 'Switch-01' },
      timestamp: new Date(),
    };

    it('should skip when no rules match the event', async () => {
      mockPrisma.automationRule.findMany.mockResolvedValue([]);
      await service.evaluateRules(baseEvent);
      expect(mockPrisma.automationRule.findMany).toHaveBeenCalled();
      expect(mockPrisma.automationExecution.create).not.toHaveBeenCalled();
    });

    it('should execute matching rules with send_notification action', async () => {
      const rule = {
        id: 'rule-1',
        name: 'Alert on device down',
        triggerModule: 'Monitoring',
        triggerEvent: 'device_down',
        status: 'ACTIVE',
        condition: '',
        actionType: 'send_notification',
        actionConfig: { title: 'Device Down', message: 'A device went offline' },
        cooldownMinutes: 0,
        lastTriggeredAt: null,
        dedupKey: null,
        chainedRuleId: null,
      };

      mockPrisma.automationRule.findMany.mockResolvedValue([rule]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.automationExecution.create.mockResolvedValue({});
      mockPrisma.automationRule.update.mockResolvedValue({});

      await service.evaluateRules(baseEvent);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            userId: 'admin-1',
            title: 'Device Down',
          }),
        }),
      );
    });

    it('should respect cooldown periods', async () => {
      const rule = {
        id: 'rule-2',
        name: 'Cooldown rule',
        triggerModule: 'Monitoring',
        triggerEvent: 'device_down',
        status: 'ACTIVE',
        condition: '',
        actionType: 'send_notification',
        actionConfig: {},
        cooldownMinutes: 60,
        lastTriggeredAt: new Date(), // Just triggered
        dedupKey: null,
        chainedRuleId: null,
      };

      mockPrisma.automationRule.findMany.mockResolvedValue([rule]);
      mockPrisma.automationExecution.create.mockResolvedValue({});

      await service.evaluateRules(baseEvent);

      // Should log as SKIPPED, not execute action
      expect(mockPrisma.automationExecution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SKIPPED',
          }),
        }),
      );
    });

    it('should evaluate JSON conditions correctly', async () => {
      const rule = {
        id: 'rule-3',
        name: 'Conditional rule',
        triggerModule: 'Monitoring',
        triggerEvent: 'device_down',
        status: 'ACTIVE',
        condition: JSON.stringify({ name: 'Switch-01' }),
        actionType: 'send_notification',
        actionConfig: {},
        cooldownMinutes: 0,
        lastTriggeredAt: null,
        dedupKey: null,
        chainedRuleId: null,
      };

      mockPrisma.automationRule.findMany.mockResolvedValue([rule]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.automationExecution.create.mockResolvedValue({});
      mockPrisma.automationRule.update.mockResolvedValue({});

      // Event payload matches condition { name: 'Switch-01' }
      await service.evaluateRules(baseEvent);

      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });

    it('should skip rule when condition does not match', async () => {
      const rule = {
        id: 'rule-4',
        name: 'Non-matching condition',
        triggerModule: 'Monitoring',
        triggerEvent: 'device_down',
        status: 'ACTIVE',
        condition: JSON.stringify({ name: 'Router-99' }),
        actionType: 'send_notification',
        actionConfig: {},
        cooldownMinutes: 0,
        lastTriggeredAt: null,
        dedupKey: null,
        chainedRuleId: null,
      };

      mockPrisma.automationRule.findMany.mockResolvedValue([rule]);

      await service.evaluateRules(baseEvent);

      // Notification should NOT be created
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('should execute create_ticket action', async () => {
      const rule = {
        id: 'rule-5',
        name: 'Auto-create ticket',
        triggerModule: 'Monitoring',
        triggerEvent: 'device_down',
        status: 'ACTIVE',
        condition: '',
        actionType: 'create_ticket',
        actionConfig: { subject: 'Device Down', priority: 'CRITICAL', category: 'Incident' },
        cooldownMinutes: 0,
        lastTriggeredAt: null,
        dedupKey: null,
        chainedRuleId: null,
      };

      mockPrisma.automationRule.findMany.mockResolvedValue([rule]);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      mockPrisma.ticket.count.mockResolvedValue(5);
      mockPrisma.ticket.create.mockResolvedValue({});
      mockPrisma.automationExecution.create.mockResolvedValue({});
      mockPrisma.automationRule.update.mockResolvedValue({});

      await service.evaluateRules(baseEvent);

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketNumber: expect.stringMatching(/^AUTO-[A-F0-9]+$/),
            priority: 'CRITICAL',
          }),
        }),
      );
    });
  });

  describe('CRUD operations', () => {
    const tenantId = 'tenant-1';

    it('should list rules with pagination', async () => {
      mockPrisma.automationRule.findMany.mockResolvedValue([]);
      mockPrisma.automationRule.count.mockResolvedValue(0);

      const result = await service.findAll(tenantId, 1, 20);

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
      expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId } }),
      );
    });

    it('should create a new rule', async () => {
      const ruleData = {
        name: 'Test Rule',
        description: 'A test automation rule',
        triggerModule: 'Discovery',
        triggerEvent: 'scan_completed',
        actionModule: 'Notifications',
        actionType: 'send_notification',
      };

      mockPrisma.automationRule.create.mockResolvedValue({ id: 'new-id', ...ruleData });

      const result = await service.create(tenantId, 'user-1', ruleData);

      expect(result.name).toBe('Test Rule');
      expect(mockPrisma.automationRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId, name: 'Test Rule', status: 'DRAFT' }),
        }),
      );
    });

    it('should return stats', async () => {
      mockPrisma.automationRule.count
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(5)   // active
        .mockResolvedValueOnce(2);  // paused
      mockPrisma.automationExecution.count
        .mockResolvedValueOnce(100)  // totalExecutions
        .mockResolvedValueOnce(90)   // recentSuccesses
        .mockResolvedValueOnce(3);   // recentFailures

      const stats = await service.getStats(tenantId);

      expect(stats.total).toBe(10);
      expect(stats.active).toBe(5);
      expect(stats.paused).toBe(2);
      expect(stats.draft).toBe(3);
      expect(stats.totalExecutions).toBe(100);
    });
  });
});
