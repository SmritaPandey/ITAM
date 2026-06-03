import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Auto-set SLA due dates when a ticket is created based on priority
   */
  async applySlaToTicket(ticketId: string, tenantId: string, priority: string) {
    const policy = await this.prisma.slaPolicy.findUnique({
      where: { tenantId_priority: { tenantId, priority } },
    });

    if (!policy) return;

    const now = new Date();
    const responseDue = new Date(now.getTime() + policy.responseHours * 3600000);
    const resolutionDue = new Date(now.getTime() + policy.resolutionHours * 3600000);

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        responseDueAt: responseDue,
        resolutionDueAt: resolutionDue,
      },
    });

    this.logger.log(`SLA applied to ticket ${ticketId}: respond by ${responseDue.toISOString()}, resolve by ${resolutionDue.toISOString()}`);
  }

  /**
   * Runs every minute to check for SLA warnings (80% elapsed) and breaches
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSlaCompliance() {
    const now = new Date();

    // Find tickets approaching SLA breach (response)
    const warningThreshold = 0.8; // 80% of time elapsed

    const openTickets = await this.prisma.ticket.findMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] },
        resolutionDueAt: { not: null },
      },
      include: { assignedTo: true },
    });

    for (const ticket of openTickets) {
      const created = new Date(ticket.createdAt).getTime();
      const elapsed = now.getTime() - created;

      // Track which breach types have already been notified to prevent duplicate events
      const breachFlags = this.getBreachFlags(ticket);

      // Check response SLA
      if (ticket.responseDueAt) {
        const responseWindow = ticket.responseDueAt.getTime() - created;
        const responseElapsed = elapsed / responseWindow;

        if (now > ticket.responseDueAt) {
          // Response SLA BREACHED — only emit if not already notified
          if (!breachFlags.responseBreachNotified) {
            this.eventBus.emit('ticket.sla_breach', {
              tenantId: ticket.tenantId,
              ticketId: ticket.id,
              ticketNumber: ticket.ticketNumber,
              slaType: 'response',
              dueAt: ticket.responseDueAt,
              priority: ticket.priority,
            });
            await this.markBreachNotified(ticket.id, 'response', ticket);
          }
        } else if (responseElapsed >= warningThreshold) {
          // Response SLA WARNING
          this.eventBus.emit('ticket.sla_warning', {
            tenantId: ticket.tenantId,
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            slaType: 'response',
            dueAt: ticket.responseDueAt,
            percentElapsed: Math.round(responseElapsed * 100),
            priority: ticket.priority,
          });
        }
      }

      // Check resolution SLA
      if (ticket.resolutionDueAt) {
        const resWindow = ticket.resolutionDueAt.getTime() - created;
        const resElapsed = elapsed / resWindow;

        if (now > ticket.resolutionDueAt) {
          // Resolution SLA BREACHED — only emit if not already notified
          if (!breachFlags.resolutionBreachNotified) {
            this.eventBus.emit('ticket.sla_breach', {
              tenantId: ticket.tenantId,
              ticketId: ticket.id,
              ticketNumber: ticket.ticketNumber,
              slaType: 'resolution',
              dueAt: ticket.resolutionDueAt,
              priority: ticket.priority,
            });
            await this.markBreachNotified(ticket.id, 'resolution', ticket);
          }

          // Auto-escalate: bump priority if not already CRITICAL
          if (ticket.priority !== 'CRITICAL') {
            const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
            const nextIdx = Math.min(priorities.indexOf(ticket.priority) + 1, 3);
            await this.prisma.ticket.update({
              where: { id: ticket.id },
              data: { priority: priorities[nextIdx] as any },
            });
            this.logger.warn(`SLA breach: ticket ${ticket.ticketNumber} escalated to ${priorities[nextIdx]}`);
          }
        } else if (resElapsed >= warningThreshold) {
          this.eventBus.emit('ticket.sla_warning', {
            tenantId: ticket.tenantId,
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            slaType: 'resolution',
            dueAt: ticket.resolutionDueAt,
            percentElapsed: Math.round(resElapsed * 100),
            priority: ticket.priority,
          });
        }
      }
    }
  }

  // ─── CRUD for SLA Policies ──────────────────────────────────────

  async findAll(tenantId: string) {
    return this.prisma.slaPolicy.findMany({
      where: { tenantId },
      orderBy: { responseHours: 'asc' },
    });
  }

  async create(tenantId: string, data: any) {
    return this.prisma.slaPolicy.create({
      data: { tenantId, ...data },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    const existing = await this.prisma.slaPolicy.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('SLA policy not found');
    return this.prisma.slaPolicy.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string) {
    const existing = await this.prisma.slaPolicy.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('SLA policy not found');
    return this.prisma.slaPolicy.delete({ where: { id } });
  }

  async getStats(tenantId: string) {
    const now = new Date();
    const [total, breached, atRisk] = await Promise.all([
      this.prisma.ticket.count({
        where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] }, resolutionDueAt: { not: null } },
      }),
      this.prisma.ticket.count({
        where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] }, resolutionDueAt: { lt: now } },
      }),
      this.prisma.ticket.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] },
          resolutionDueAt: { gt: now, lt: new Date(now.getTime() + 3600000) }, // within 1 hour
        },
      }),
    ]);
    const onTrack = total - breached - atRisk;
    return { total, onTrack, atRisk, breached };
  }

  // ─── SLA Breach Deduplication Helpers ───────────────────────

  /**
   * Extract breach notification flags from the ticket's description JSON metadata.
   * We use a structured JSON suffix in the description to avoid schema changes.
   */
  private getBreachFlags(ticket: any): { responseBreachNotified: boolean; resolutionBreachNotified: boolean } {
    try {
      // Check if description contains embedded breach metadata (JSON block at end)
      const desc = ticket.description || '';
      const metaMatch = desc.match(/<!--SLA_META:(.*?)-->$/);
      if (metaMatch) {
        const meta = JSON.parse(metaMatch[1]);
        return {
          responseBreachNotified: !!meta.responseBreachNotified,
          resolutionBreachNotified: !!meta.resolutionBreachNotified,
        };
      }
    } catch {
      // Ignore parse errors — treat as not notified
    }
    return { responseBreachNotified: false, resolutionBreachNotified: false };
  }

  /**
   * Mark a breach type as notified by appending/updating metadata in the ticket description.
   */
  private async markBreachNotified(ticketId: string, slaType: 'response' | 'resolution', ticket: any) {
    try {
      const desc = ticket.description || '';
      const metaMatch = desc.match(/<!--SLA_META:(.*?)-->$/);
      let meta: any = {};
      let baseDesc = desc;

      if (metaMatch) {
        meta = JSON.parse(metaMatch[1]);
        baseDesc = desc.replace(/<!--SLA_META:.*?-->$/, '');
      }

      if (slaType === 'response') meta.responseBreachNotified = true;
      if (slaType === 'resolution') meta.resolutionBreachNotified = true;

      const updatedDesc = `${baseDesc}<!--SLA_META:${JSON.stringify(meta)}-->`;
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { description: updatedDesc },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to mark breach notified for ticket ${ticketId}: ${err.message}`);
    }
  }
}
