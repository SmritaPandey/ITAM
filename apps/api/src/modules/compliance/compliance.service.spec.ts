import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceService } from './compliance.service';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

describe('ComplianceService', () => {
  let service: ComplianceService;

  const mockPrisma = {
    endpointPolicy: {
      findMany: jest.fn(),
    },
    endpointChange: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    agentBaseline: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
        ComplianceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: new EventBusService() },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  describe('diffSnapshots - Process Blocking (nc vs substring)', () => {
    it('should block nc process', () => {
      const prev = { processes: [] };
      const curr = {
        processes: [
          { name: 'nc', pid: 1234, command: 'nc -l 4444' }
        ]
      };
      
      const changes = service.diffSnapshots(prev, curr);
      const procBlocked = changes.find(c => c.category === 'PROCESS_BLOCKED');
      
      expect(procBlocked).toBeDefined();
      expect(procBlocked?.newValue?.name).toBe('nc');
    });

    it('should NOT block typescript cancellation or helper processes containing nc as substring', () => {
      const prev = { processes: [] };
      const curr = {
        processes: [
          { name: 'tsserver', pid: 9001, command: 'node tsserver.js --cancellationPipeName tscancellation-123' },
          { name: 'Google Chrome Helper', pid: 9002, command: 'Google Chrome Helper --lang=en-US' }
        ]
      };

      const changes = service.diffSnapshots(prev, curr);
      const procBlocked = changes.find(c => c.category === 'PROCESS_BLOCKED');

      expect(procBlocked).toBeUndefined();
    });
  });

  describe('diffSnapshots - Port Whitelisting', () => {
    it('should block unauthorized port', () => {
      const prev = { security: { openPorts: [] } };
      const curr = {
        security: {
          openPorts: [
            { port: 4444, process: 'malicious-proc', protocol: 'TCP' }
          ]
        }
      };

      const changes = service.diffSnapshots(prev, curr);
      const portBlocked = changes.find(c => c.category === 'UNAUTHORIZED_ACCESS' && c.newValue?.port === 4444);

      expect(portBlocked).toBeDefined();
    });

    it('should NOT block port opened by safe development processes', () => {
      const prev = { security: { openPorts: [] } };
      const curr = {
        security: {
          openPorts: [
            { port: 54548, process: 'Antigravi', protocol: 'TCP' },
            { port: 52267, process: 'language_', protocol: 'TCP' },
            { port: 3000, process: 'node', protocol: 'TCP' }
          ]
        }
      };

      const changes = service.diffSnapshots(prev, curr);
      const portBlocked = changes.find(c => c.category === 'UNAUTHORIZED_ACCESS');

      expect(portBlocked).toBeUndefined();
    });
  });
});
