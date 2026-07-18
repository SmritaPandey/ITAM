import { SlaService } from './sla.service';

/**
 * SLA multi-level escalation coverage. escalateBreachedTicket() is private but
 * is the core of the breach-handling path; we invoke it directly with mocked
 * prisma + eventBus and assert level selection, priority bump, and reassignment.
 */
describe('SlaService escalation', () => {
  function makeService() {
    const prisma: any = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
      ticket: { update: jest.fn().mockResolvedValue({}) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const eventBus: any = { emit: jest.fn() };
    const service = new SlaService(prisma, eventBus);
    return { service, prisma, eventBus };
  }

  const baseTicket = () => ({
    id: 'tk1',
    tenantId: 'tenant-1',
    ticketNumber: 'TKT-000001',
    subject: 'Printer down',
    priority: 'MEDIUM',
    escalationLevel: 0,
    escalatedAt: null,
    assignedToId: 'agent-1',
  });

  const escalate = (service: SlaService, ticket: any) =>
    (service as any).escalateBreachedTicket(ticket);

  it('bumps escalation level 0 -> 1 and raises priority', async () => {
    const { service, prisma, eventBus } = makeService();

    await escalate(service, baseTicket());

    expect(prisma.ticket.update).toHaveBeenCalledTimes(1);
    const data = prisma.ticket.update.mock.calls[0][0].data;
    expect(data.escalationLevel).toBe(1);
    expect(data.priority).toBe('HIGH'); // MEDIUM -> HIGH
    // Level 1 does not reassign
    expect(data.assignedToId).toBeUndefined();

    expect(eventBus.emit).toHaveBeenCalledWith(
      'ticket.escalated',
      expect.objectContaining({ escalationLevel: 1, priority: 'HIGH' }),
    );
  });

  it('reassigns to an admin (other than assignee) at level >= 2', async () => {
    const { service, prisma } = makeService();
    prisma.user.findMany.mockResolvedValue([{ id: 'agent-1' }, { id: 'admin-2' }]);

    await escalate(service, { ...baseTicket(), escalationLevel: 1, priority: 'HIGH' });

    const data = prisma.ticket.update.mock.calls[0][0].data;
    expect(data.escalationLevel).toBe(2);
    expect(data.priority).toBe('CRITICAL'); // HIGH -> CRITICAL
    // Should pick the admin who is NOT the current assignee
    expect(data.assignedToId).toBe('admin-2');
  });

  it('notifies each admin of the escalation', async () => {
    const { service, prisma } = makeService();
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

    await escalate(service, { ...baseTicket(), escalationLevel: 1 });

    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it('keeps CRITICAL tickets at CRITICAL', async () => {
    const { service, prisma } = makeService();

    await escalate(service, { ...baseTicket(), priority: 'CRITICAL' });

    expect(prisma.ticket.update.mock.calls[0][0].data.priority).toBe('CRITICAL');
  });

  it('caps escalation at level 5 (no further updates)', async () => {
    const { service, prisma, eventBus } = makeService();

    await escalate(service, { ...baseTicket(), escalationLevel: 5 });

    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('does not re-escalate within an hour of the last escalation', async () => {
    const { service, prisma } = makeService();

    await escalate(service, {
      ...baseTicket(),
      escalationLevel: 1,
      escalatedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    });

    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});
