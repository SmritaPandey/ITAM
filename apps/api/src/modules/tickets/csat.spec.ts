import { BadRequestException } from '@nestjs/common';
import { TicketsService } from './tickets.service';

/**
 * CSAT submission coverage. submitCsat() loads the ticket via findById()
 * (which resolves through prisma.withTenant) then validates status/score/owner
 * before persisting the rating.
 */
describe('TicketsService.submitCsat', () => {
  const TENANT = 'tenant-1';

  function makeService(ticket: any, adminLookup: any = null) {
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: ticket.id, ...data }));
    const prisma: any = {
      withTenant: jest.fn((_t: string, fn: any) =>
        fn({ ticket: { findFirst: jest.fn().mockResolvedValue(ticket) } }),
      ),
      ticket: { update },
      user: { findFirst: jest.fn().mockResolvedValue(adminLookup) },
    };
    const service = new TicketsService(prisma, { emitTicketEvent: jest.fn() } as any);
    return { service, prisma, update };
  }

  const resolvedTicket = () => ({
    id: 'tk1',
    tenantId: TENANT,
    status: 'RESOLVED',
    requesterId: 'user-1',
    satisfactionScore: null,
    csatAt: null,
  });

  it('persists a valid score for the requester on a resolved ticket', async () => {
    const { service, update } = makeService(resolvedTicket());

    const result = await service.submitCsat('tk1', TENANT, { score: 5, comment: 'Great!' }, 'user-1');

    expect(update).toHaveBeenCalledTimes(1);
    const data = update.mock.calls[0][0].data;
    expect(data.satisfactionScore).toBe(5);
    expect(data.csatComment).toBe('Great!');
    expect(data.csatAt).toBeInstanceOf(Date);
    expect(result.satisfactionScore).toBe(5);
  });

  it('rounds fractional scores', async () => {
    const { service, update } = makeService(resolvedTicket());

    await service.submitCsat('tk1', TENANT, { score: 4.4 }, 'user-1');

    expect(update.mock.calls[0][0].data.satisfactionScore).toBe(4);
  });

  it('rejects CSAT on tickets that are not resolved/closed', async () => {
    const { service, update } = makeService({ ...resolvedTicket(), status: 'OPEN' });

    await expect(
      service.submitCsat('tk1', TENANT, { score: 5 }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects out-of-range scores', async () => {
    const { service } = makeService(resolvedTicket());

    await expect(
      service.submitCsat('tk1', TENANT, { score: 6 }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a second CSAT submission', async () => {
    const { service } = makeService({
      ...resolvedTicket(),
      satisfactionScore: 3,
      csatAt: new Date(),
    });

    await expect(
      service.submitCsat('tk1', TENANT, { score: 5 }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks a non-requester who is not an admin', async () => {
    const { service } = makeService(resolvedTicket(), null); // user lookup returns no admin

    await expect(
      service.submitCsat('tk1', TENANT, { score: 5 }, 'someone-else'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows an admin to submit CSAT for another user', async () => {
    const { service, update } = makeService(resolvedTicket(), { id: 'admin-1' });

    await service.submitCsat('tk1', TENANT, { score: 4 }, 'admin-1');

    expect(update).toHaveBeenCalledTimes(1);
  });
});
