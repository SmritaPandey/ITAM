import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma } from '@prisma/client';
import { EventBusService } from '../../common/events/event-bus.service';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  private isPrivilegedRole(role?: string): boolean {
    return ['tenant admin', 'it admin', 'platform owner'].includes((role || '').toLowerCase());
  }

  private assertTicketAccess(
    ticket: { requesterId: string; assignedToId?: string | null },
    userId?: string,
    role?: string,
  ): void {
    if (!userId || this.isPrivilegedRole(role)) return;
    if (ticket.requesterId !== userId && ticket.assignedToId !== userId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }
  }

  private async generateTicketNumber(tenantId: string): Promise<string> {
    // Use last-created ticket's number instead of count to reduce race window
    const last = await this.prisma.ticket.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { ticketNumber: true },
    });
    const lastNum = last.length > 0
      ? parseInt(last[0].ticketNumber.replace('TKT-', ''), 10) || 0
      : 0;
    return `TKT-${String(lastNum + 1).padStart(6, '0')}`;
  }

  async findAll(tenantId: string, filters: {
    page?: number; limit?: number; status?: string; type?: string;
    priority?: string; assignedToId?: string; requesterId?: string;
  } = {}, userId?: string, role?: string) {
    const { page: rawPage = 1, limit: rawLimit = 20, status, type, priority, assignedToId, requesterId } = filters;
    const page = Number(rawPage) || 1;
    const limit = Number(rawLimit) || 20;
    const _page = Number(page) || 1; const _limit = Number(limit) || 20;
    const skip = (_page - 1) * _limit;

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

    const [data, total] = await this.prisma.withTenant(tenantId, async (tx) =>
      Promise.all([
        tx.ticket.findMany({
          where,
          include: {
            requester: { select: { id: true, firstName: true, lastName: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            assets: { include: { asset: { select: { id: true, name: true, assetTag: true } } } },
          },
          skip,
          take: _limit,
          orderBy: { createdAt: 'desc' },
        }),
        tx.ticket.count({ where }),
      ]),
    );

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, tenantId: string, userId?: string, role?: string) {
    const ticket = await this.prisma.withTenant(tenantId, async (tx) =>
      tx.ticket.findFirst({
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
      }),
    );
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertTicketAccess(ticket, userId, role);
    if (!this.isPrivilegedRole(role) && userId) {
      return {
        ...ticket,
        comments: ticket.comments.filter((comment) => !comment.isInternal),
      };
    }
    return ticket;
  }

  async create(tenantId: string, requesterId: string, data: {
    type?: string; category?: string; subject: string;
    description?: string; priority?: string; assetIds?: string[];
  }) {
    // Retry loop to handle unique constraint violations from concurrent number generation
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
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
      } catch (error: any) {
        // P2002 is Prisma's unique constraint violation error code
        if (error?.code === 'P2002' && attempt < MAX_RETRIES - 1) {
          continue; // Retry with a new number
        }
        throw error;
      }
    }
    // This should never be reached due to the throw in the catch block
    throw new Error('Failed to generate unique ticket number after maximum retries');
  }

  async addComment(
    ticketId: string,
    tenantId: string,
    authorId: string,
    content: string,
    isInternal = false,
    role?: string,
  ) {
    await this.findById(ticketId, tenantId, authorId, role);
    return this.prisma.ticketComment.create({
      data: {
        ticketId,
        authorId,
        content,
        isInternal: this.isPrivilegedRole(role) ? isInternal : false,
      },
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

  async getTimeline(id: string, tenantId: string, userId?: string, role?: string) {
    await this.findById(id, tenantId, userId, role);
    return this.prisma.ticketComment.findMany({
      where: {
        ticketId: id,
        ...(!this.isPrivilegedRole(role) && userId ? { isInternal: false } : {}),
      },
      include: { author: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getStats(tenantId: string) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [byStatus, byPriority, byType, total, openCount, recentTickets] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      this.prisma.ticket.groupBy({ by: ['priority'], where: { tenantId }, _count: true }),
      this.prisma.ticket.groupBy({ by: ['type'], where: { tenantId }, _count: true }),
      this.prisma.ticket.count({ where: { tenantId } }),
      this.prisma.ticket.count({ where: { tenantId, status: { in: ['NEW', 'OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.ticket.findMany({
        where: { tenantId, createdAt: { gte: weekAgo } },
        select: { createdAt: true },
        take: 2000,
      }),
    ]);
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const buckets: Record<string, number> = {};
    DAYS.forEach((d) => (buckets[d] = 0));
    for (const t of recentTickets) {
      buckets[DAYS[new Date(t.createdAt).getDay()]]++;
    }
    const weeklyCreated = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
      day,
      count: buckets[day] || 0,
    }));
    return { total, open: openCount, byStatus, byPriority, byType, weeklyCreated };
  }

  async update(id: string, tenantId: string, data: any) {
    await this.findById(id, tenantId);
    const updateData: any = { ...data };
    if (data.status === 'RESOLVED') updateData.resolvedAt = new Date();
    if (data.status === 'CLOSED') updateData.closedAt = new Date();
    return this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async delete(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    // Cascade: delete related comments and asset links first
    await this.prisma.ticketComment.deleteMany({ where: { ticketId: id } });
    await this.prisma.ticketAsset.deleteMany({ where: { ticketId: id } });
    return this.prisma.ticket.delete({ where: { id } });
  }

  /**
   * CSAT survey — only when ticket is RESOLVED or CLOSED.
   */
  async submitCsat(
    id: string,
    tenantId: string,
    data: { score: number; comment?: string },
    requesterId?: string,
  ) {
    const ticket = await this.findById(id, tenantId);
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      throw new BadRequestException('CSAT can only be submitted for RESOLVED or CLOSED tickets');
    }
    if (ticket.satisfactionScore != null && ticket.csatAt) {
      throw new BadRequestException('CSAT already submitted for this ticket');
    }
    const score = Number(data.score);
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      throw new BadRequestException('score must be an integer from 1 to 5');
    }
    if (requesterId && ticket.requesterId !== requesterId) {
      // Allow admins; employees may only rate their own tickets
      const admin = await this.prisma.user.findFirst({
        where: {
          id: requesterId,
          tenantId,
          role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
        },
      });
      if (!admin) {
        throw new BadRequestException('Only the requester (or an admin) can submit CSAT');
      }
    }
    return this.prisma.ticket.update({
      where: { id },
      data: {
        satisfactionScore: Math.round(score),
        csatComment: data.comment || null,
        csatAt: new Date(),
      },
    });
  }

  /**
   * Suggest knowledge-base articles for a ticket (subject/description keywords).
   */
  async suggestKb(tenantId: string, ticketIdOrQuery: string, opts?: { q?: string; limit?: number }) {
    let query = (opts?.q || '').trim();
    if (!query && ticketIdOrQuery) {
      // If looks like UUID, load ticket; otherwise treat as search string
      const isUuid = /^[0-9a-f-]{36}$/i.test(ticketIdOrQuery);
      if (isUuid) {
        const ticket = await this.prisma.ticket.findFirst({
          where: { id: ticketIdOrQuery, tenantId },
          select: { subject: true, description: true, category: true },
        });
        if (ticket) {
          query = [ticket.subject, ticket.category, (ticket.description || '').slice(0, 120)]
            .filter(Boolean)
            .join(' ');
        }
      } else {
        query = ticketIdOrQuery;
      }
    }
    if (!query || query.length < 2) {
      return { data: [], query: '', total: 0 };
    }

    // Extract distinctive tokens (≥4 chars), drop stopwords
    const stop = new Set([
      'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'been', 'were',
      'will', 'your', 'into', 'about', 'please', 'issue', 'problem', 'request',
    ]);
    const tokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !stop.has(t))
      .slice(0, 8);

    const orClauses: any[] = tokens.flatMap((t) => [
      { title: { contains: t, mode: 'insensitive' } },
      { content: { contains: t, mode: 'insensitive' } },
      { tags: { has: t } },
    ]);
    // Also full-phrase title search
    orClauses.push({ title: { contains: query.slice(0, 80), mode: 'insensitive' } });

    const articles = await this.prisma.knowledgeArticle.findMany({
      where: {
        tenantId,
        status: 'PUBLISHED',
        OR: orClauses.length ? orClauses : undefined,
      },
      orderBy: { viewCount: 'desc' },
      take: Math.min(opts?.limit || 5, 20),
      select: {
        id: true,
        title: true,
        category: true,
        tags: true,
        viewCount: true,
        helpfulCount: true,
        updatedAt: true,
      },
    });

    return { data: articles, query, tokens, total: articles.length };
  }
}

