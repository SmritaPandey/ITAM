import { ForbiddenException } from '@nestjs/common';
import { TicketsService } from './tickets.service';

describe('TicketsService authorization', () => {
  const ticket = {
    id: 'ticket-1',
    tenantId: 'tenant-1',
    requesterId: 'requester-1',
    assignedToId: 'agent-1',
    comments: [
      { id: 'public', isInternal: false, content: 'visible' },
      { id: 'internal', isInternal: true, content: 'staff only' },
    ],
  };
  const prisma: any = {
    ticket: { findFirst: jest.fn().mockResolvedValue(ticket) },
    ticketComment: {
      findMany: jest.fn().mockResolvedValue(ticket.comments),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    },
    withTenant: jest.fn((_tenantId: string, fn: any) => fn({
      ticket: { findFirst: jest.fn().mockResolvedValue(ticket) },
      ticketComment: {
        findMany: jest.fn().mockResolvedValue(ticket.comments),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    })),
  };
  const service = new TicketsService(prisma, {} as any);

  beforeEach(() => jest.clearAllMocks());

  it('blocks unrelated employees from ticket details', async () => {
    await expect(
      service.findById('ticket-1', 'tenant-1', 'other-user', 'Employee'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('strips internal comments for the requester', async () => {
    const result = await service.findById(
      'ticket-1',
      'tenant-1',
      'requester-1',
      'Employee',
    );
    expect(result.comments).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('staff only');
  });

  it('ignores isInternal from non-privileged users', async () => {
    const result = await service.addComment(
      'ticket-1',
      'tenant-1',
      'requester-1',
      'hello',
      true,
      'Employee',
    );
    expect(result.isInternal).toBe(false);
  });
});
