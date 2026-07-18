jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

describe('Discovery agent identity hardening', () => {
  it('binds registration to an enrollment and returns its secret only when created', async () => {
    const baseAgent = {
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: '22222222-2222-4222-8222-222222222222',
      hostname: 'host-1',
      ipAddress: '10.0.0.5',
      enrollment: null,
    };
    let enrollment: any;
    const tx: any = {
      agent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(baseAgent),
        update: jest.fn(async ({ data }: any) => ({
          ...baseAgent,
          enrollmentId: data.enrollmentId,
          enrollment,
        })),
      },
      agentEnrollment: {
        create: jest.fn(async ({ data }: any) => {
          enrollment = { id: '33333333-3333-4333-8333-333333333333', ...data, revokedAt: null };
          return enrollment;
        }),
      },
    };
    const prisma: any = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    const authService: any = {
      generateAgentToken: jest.fn().mockReturnValue('bound-token'),
    };
    const service = new DiscoveryService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      authService,
    );

    const result = await service.registerAgent(
      baseAgent.tenantId,
      {
        hostname: baseAgent.hostname,
        platform: 'linux',
        agentVersion: '2.0.0',
        ipAddress: baseAgent.ipAddress,
      },
      'admin@example.com',
      '44444444-4444-4444-8444-444444444444',
    );

    expect(result.agentToken).toBe('bound-token');
    expect(result.enrollmentSecret).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(enrollment.secretHash).not.toBe(result.enrollmentSecret);
    expect(authService.generateAgentToken).toHaveBeenCalledWith(
      baseAgent.tenantId,
      'admin@example.com',
      '44444444-4444-4444-8444-444444444444',
      baseAgent.id,
      enrollment.tokenJti,
    );
  });

  it('rejects a bound JWT after its enrollment is revoked', async () => {
    const payload: any = {
      sub: 'user-id',
      email: 'admin@example.com',
      tenantId: '22222222-2222-4222-8222-222222222222',
      role: 'agent',
      permissions: ['discovery:heartbeat'],
      isSuperAdmin: false,
      agentId: '11111111-1111-4111-8111-111111111111',
      jti: '33333333-3333-4333-8333-333333333333',
    };
    const prisma: any = {
      agent: {
        findFirst: jest.fn().mockResolvedValue({
          id: payload.agentId,
          enrollment: {
            id: 'enrollment-id',
            tenantId: payload.tenantId,
            tokenJti: payload.jti,
            revokedAt: new Date(),
          },
        }),
      },
      agentEnrollment: { update: jest.fn() },
    };
    const strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: 'test-agent-jwt-secret' }),
      prisma,
    );

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.agentEnrollment.update).not.toHaveBeenCalled();
  });

  it('revokes the enrollment attached to a tenant agent', async () => {
    const prisma: any = {
      agent: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'agent-id',
          enrollment: { id: 'enrollment-id' },
        }),
      },
      agentEnrollment: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new DiscoveryService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.revokeAgentToken('agent-id', 'tenant-id')).resolves.toEqual({
      revoked: true,
    });
    expect(prisma.agentEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-id' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('denies a bound agent token used against another agent path', async () => {
    const discoveryService: any = { agentHeartbeat: jest.fn() };
    const controller = new DiscoveryController(
      discoveryService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      controller.agentHeartbeat(
        {
          user: {
            tenantId: 'tenant-id',
            agentId: '11111111-1111-4111-8111-111111111111',
          },
        },
        '99999999-9999-4999-8999-999999999999',
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(discoveryService.agentHeartbeat).not.toHaveBeenCalled();
  });
});
