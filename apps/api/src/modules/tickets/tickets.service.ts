import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma } from '@prisma/client';
import { EventBusService } from '../../common/events/event-bus.service';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  private async generateTicketNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.ticket.count({ where: { tenantId } });
    return `TKT-${String(count + 1).padStart(6, '0')}`;
  }

  async findAll(tenantId: string, filters: {
    page?: number; limit?: number; status?: string; type?: string;
    priority?: string; assignedToId?: string; requesterId?: string;
  } = {}, userId?: string, role?: string) {
    const { page: rawPage = 1, limit: rawLimit = 20, status, type, priority, assignedToId, requesterId } = filters;
    const page = Number(rawPage) || 1;
    const limit = Number(rawLimit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {
      tenantId,
      ...(status && { status: status as any }),
      ...(type && { type: type as any }),
      ...(priority && { priority: priority as any }),
      ...(assignedToId && { assignedToId }),
      ...(requesterId && { requesterId }),
      // Staff: only see their own tickets
      ...(role === 'Employee' && userId && { requesterId: userId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          requester: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          assets: { include: { asset: { select: { id: true, name: true, assetTag: true } } } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, tenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        assets: { include: { asset: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async create(tenantId: string, requesterId: string, data: {
    type?: string; category?: string; subject: string;
    description?: string; priority?: string; assetIds?: string[];
  }) {
    const ticketNumber = await this.generateTicketNumber(tenantId);

    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId,
        ticketNumber,
        type: (data.type as any) || 'SERVICE_REQUEST',
        category: data.category,
        subject: data.subject,
        description: data.description,
        priority: (data.priority as any) || 'MEDIUM',
        requesterId,
        ...(data.assetIds?.length && {
          assets: {
            create: data.assetIds.map(assetId => ({ assetId })),
          },
        }),
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        assets: { include: { asset: { select: { id: true, name: true, assetTag: true } } } },
      },
    });

    this.eventBus.emitTicketEvent(tenantId, 'created', ticket);

    return ticket;
  }

  async addComment(ticketId: string, tenantId: string, authorId: string, content: string, isInternal = false) {
    await this.findById(ticketId, tenantId);
    return this.prisma.ticketComment.create({
      data: { ticketId, authorId, content, isInternal },
    });
  }

  async updateStatus(id: string, tenantId: string, status: string) {
    await this.findById(id, tenantId);
    const updateData: any = { status };
    if (status === 'RESOLVED') updateData.resolvedAt = new Date();
    if (status === 'CLOSED') updateData.closedAt = new Date();
    return this.prisma.ticket.update({ where: { id }, data: updateData });
  }

  async assignTicket(id: string, tenantId: string, assignedToId: string) {
    await this.findById(id, tenantId);
    return this.prisma.ticket.update({
      where: { id },
      data: { assignedToId, status: 'IN_PROGRESS', respondedAt: new Date() },
      include: { assignedTo: { select: { firstName: true, lastName: true } } },
    });
  }

  async escalateTicket(id: string, tenantId: string, data: { reason: string; escalateTo?: string }) {
    const ticket = await this.findById(id, tenantId);
    // Add escalation comment
    await this.prisma.ticketComment.create({
      data: {
        ticketId: id,
        authorId: ticket.requesterId,
        content: `⚠️ ESCALATED: ${data.reason}`,
        isInternal: true,
      },
    });
    // Bump priority
    const priorityMap: Record<string, string> = { LOW: 'MEDIUM', MEDIUM: 'HIGH', HIGH: 'CRITICAL' };
    const newPriority = priorityMap[ticket.priority] || ticket.priority;
    return this.prisma.ticket.update({
      where: { id },
      data: { priority: newPriority as any, ...(data.escalateTo && { assignedToId: data.escalateTo }) },
    });
  }

  async getTimeline(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    return this.prisma.ticketComment.findMany({
      where: { ticketId: id },
      include: { author: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getStats(tenantId: string) {
    const [byStatus, byPriority, byType, total, openCount] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      this.prisma.ticket.groupBy({ by: ['priority'], where: { tenantId }, _count: true }),
      this.prisma.ticket.groupBy({ by: ['type'], where: { tenantId }, _count: true }),
      this.prisma.ticket.count({ where: { tenantId } }),
      this.prisma.ticket.count({ where: { tenantId, status: { in: ['NEW', 'OPEN', 'IN_PROGRESS'] } } }),
    ]);
    return { total, open: openCount, byStatus, byPriority, byType };
  }
}

