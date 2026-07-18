import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService governance switches', () => {
  function createService(aiEnabled: string, tenantSettings?: Record<string, unknown>) {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ settings: tenantSettings || {} }),
      },
    };
    const service = new AiService(
      prisma as any,
      new ConfigService({ AI_ENABLED: aiEnabled }),
      { emitDomainEvent: jest.fn() } as any,
      {} as any,
      {} as any,
    );
    return { service, prisma };
  }

  it('keeps AI hard-disabled when AI_ENABLED is false', async () => {
    const { service, prisma } = createService('false', { aiEnabled: true });

    const result = await service.chat('tenant-1', 'user-1', 'sensitive prompt');

    expect(result.response).toContain('not enabled');
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('honors the tenant aiEnabled kill-switch', async () => {
    const { service, prisma } = createService('true', { aiEnabled: false });

    const result = await service.chat('tenant-1', 'user-1', 'sensitive prompt');

    expect(result.response).toContain('not enabled');
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      select: { settings: true },
    });
  });
});
