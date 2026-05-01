import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService, DomainEvent } from '../../common/events/event-bus.service';

@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /** Subscribe to all domain events and evaluate automation rules */
  onModuleInit() {
    this.eventBus.on('*', (event: DomainEvent) => {
      this.evaluateRules(event).catch(err =>
        this.logger.error(`Rule evaluation failed: ${err.message}`),
      );
    });
    this.logger.log('Automation engine listening for domain events');
  }

  /**
   * Evaluate all ACTIVE rules against an incoming event
   */
  async evaluateRules(event: DomainEvent) {
    const [module, eventType] = event.type.split('.');
    if (!module || !eventType) return;

    // Capitalize module name to match DB values
    const triggerModule = module.charAt(0).toUpperCase() + module.slice(1);

    const rules = await this.prisma.automationRule.findMany({
      where: {
        tenantId: event.tenantId,
        status: 'ACTIVE',
        triggerModule: { equals: triggerModule, mode: 'insensitive' },
        triggerEvent: { equals: eventType, mode: 'insensitive' },
      },
    });

    if (rules.length === 0) return;
    this.logger.log(`Event ${event.type}: ${rules.length} rules matched`);

    for (const rule of rules) {
      try {
        // ── Cooldown check ──
        if (rule.cooldownMinutes > 0 && rule.lastTriggeredAt) {
          const cooldownMs = rule.cooldownMinutes * 60 * 1000;
          const elapsed = Date.now() - new Date(rule.lastTriggeredAt).getTime();
          if (elapsed < cooldownMs) {
            this.logger.debug(`Rule "${rule.name}" skipped: in cooldown (${Math.round((cooldownMs - elapsed) / 60000)}m remaining)`);
            await this.prisma.automationExecution.create({
              data: { ruleId: rule.id, input: event.payload as any, output: { status: 'skipped', reason: 'cooldown' }, status: 'SKIPPED' },
            });
            continue;
          }
        }

        // ── Dedup check (same rule + same entity within cooldown) ──
        const entityId = (event.payload as any)?.assetId || (event.payload as any)?.ticketId || (event.payload as any)?.deviceId || '';
        const dedupKey = `${rule.id}:${event.type}:${entityId}`;
        if (rule.dedupKey === dedupKey && rule.cooldownMinutes > 0) {
          this.logger.debug(`Rule "${rule.name}" skipped: duplicate event for ${entityId}`);
          continue;
        }

        // Evaluate condition (simple JSON match or always-true)
        if (rule.condition && rule.condition !== '' && rule.condition !== '{}') {
          const conditionMet = this.evaluateCondition(rule.condition, event.payload);
          if (!conditionMet) continue;
        }

        // Execute action
        await this.executeAction(rule, event);

        // Log successful execution + update tracking fields
        await this.prisma.$transaction([
          this.prisma.automationExecution.create({
            data: {
              ruleId: rule.id,
              input: event.payload as any,
              output: { status: 'success', action: rule.actionType },
              status: 'SUCCESS',
            },
          }),
          this.prisma.automationRule.update({
            where: { id: rule.id },
            data: {
              runCount: { increment: 1 },
              lastRunAt: new Date(),
              lastTriggeredAt: new Date(),
              dedupKey,
            },
          }),
        ]);

        this.logger.log(`Rule "${rule.name}" executed: ${rule.actionType}`);

        // ── Chained rule execution ──
        if (rule.chainedRuleId) {
          const chainedRule = await this.prisma.automationRule.findFirst({
            where: { id: rule.chainedRuleId, status: 'ACTIVE' },
          });
          if (chainedRule) {
            this.logger.log(`Chaining to rule "${chainedRule.name}"`);
            await this.executeAction(chainedRule, event);
            await this.prisma.automationRule.update({
              where: { id: chainedRule.id },
              data: { runCount: { increment: 1 }, lastRunAt: new Date() },
            });
          }
        }
      } catch (err: any) {
        await this.prisma.automationExecution.create({
          data: {
            ruleId: rule.id,
            input: event.payload as any,
            output: { status: 'failed', error: err.message },
            status: 'FAILED',
          },
        });
        this.logger.error(`Rule "${rule.name}" failed: ${err.message}`);
      }
    }
  }

  /**
   * Simple condition evaluator — checks if event payload matches condition fields
   */
  private evaluateCondition(condition: string, payload: Record<string, any>): boolean {
    try {
      const cond = typeof condition === 'string' ? JSON.parse(condition) : condition;
      // If condition is empty object, always true
      if (Object.keys(cond).length === 0) return true;
      // Check each condition field against payload
      for (const [key, value] of Object.entries(cond)) {
        if (payload[key] !== value) return false;
      }
      return true;
    } catch {
      return true; // If condition can't be parsed, treat as always-true
    }
  }

  /**
   * Execute the automation action
   */
  private async executeAction(rule: any, event: DomainEvent) {
    const config = typeof rule.actionConfig === 'string' ? JSON.parse(rule.actionConfig) : (rule.actionConfig || {});

    switch (rule.actionType) {
      case 'send_notification':
        await this.actionSendNotification(rule, event, config);
        break;
      case 'create_ticket':
        await this.actionCreateTicket(rule, event, config);
        break;
      case 'update_asset':
        await this.actionUpdateAsset(event, config);
        break;
      case 'send_webhook':
        await this.actionSendWebhook(event, config);
        break;
      case 'send_email':
        this.logger.log(`[EMAIL] Would send email to ${config.to || 'admin'}: ${rule.name}`);
        break;
      default:
        this.logger.warn(`Unknown action type: ${rule.actionType}`);
    }
  }

  private async actionSendNotification(rule: any, event: DomainEvent, config: any) {
    // Get all admin users for the tenant
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId: event.tenantId,
        role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: admin.id,
          title: config.title || `Automation: ${rule.name}`,
          message: config.message || `Rule triggered by ${event.type}: ${JSON.stringify(event.payload).substring(0, 200)}`,
          type: config.severity || 'ALERT',
          module: rule.triggerModule.toLowerCase(),
        },
      });
    }
  }

  private async actionCreateTicket(rule: any, event: DomainEvent, config: any) {
    // Find an admin to assign the ticket to
    const admin = await this.prisma.user.findFirst({
      where: { tenantId: event.tenantId, role: { name: { in: ['Tenant Admin', 'IT Admin'] } }, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!admin) return;

    const ticketCount = await this.prisma.ticket.count({ where: { tenantId: event.tenantId } });
    const ticketNumber = `AUTO-${String(ticketCount + 1).padStart(5, '0')}`;

    await this.prisma.ticket.create({
      data: {
        tenantId: event.tenantId,
        requesterId: admin.id,
        ticketNumber,
        subject: config.subject || `[Auto] ${rule.name}`,
        description: config.description || `Automation rule "${rule.name}" triggered.\n\nEvent: ${event.type}\nPayload: ${JSON.stringify(event.payload, null, 2)}`,
        priority: config.priority || 'HIGH',
        category: config.category || 'Incident',
      },
    });
  }

  private async actionUpdateAsset(event: DomainEvent, config: any) {
    if (event.payload.assetId && config.status) {
      await this.prisma.asset.update({
        where: { id: event.payload.assetId },
        data: { status: config.status },
      });
    }
  }

  private async actionSendWebhook(event: DomainEvent, config: any) {
    if (config.url) {
      try {
        await fetch(config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: event.type, payload: event.payload, timestamp: event.timestamp }),
        });
        this.logger.log(`Webhook sent to ${config.url}`);
      } catch (err: any) {
        this.logger.error(`Webhook to ${config.url} failed: ${err.message}`);
      }
    }
  }

  // ─── CRUD Operations ──────────────────────────────────────────

  async findAll(tenantId: string, page = 1, limit = 20) {
    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where: { tenantId },
        include: {
          createdBy: { select: { firstName: true, lastName: true } },
          _count: { select: { executions: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip, take: Number(limit),
      }),
      this.prisma.automationRule.count({ where: { tenantId } }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(id: string, tenantId: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, tenantId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        executions: { orderBy: { executedAt: 'desc' }, take: 20 },
      },
    });
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  async create(tenantId: string, userId: string, data: any) {
    return this.prisma.automationRule.create({
      data: {
        tenantId, createdById: userId,
        name: data.name, description: data.description,
        triggerModule: data.triggerModule, triggerEvent: data.triggerEvent,
        condition: data.condition, actionModule: data.actionModule,
        actionType: data.actionType, actionConfig: data.actionConfig || {},
        status: data.status || 'DRAFT',
      },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    await this.findById(id, tenantId);
    return this.prisma.automationRule.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    return this.prisma.automationRule.delete({ where: { id } });
  }

  async getExecutions(tenantId: string, page = 1, limit = 30) {
    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      this.prisma.automationExecution.findMany({
        where: { rule: { tenantId } },
        include: { rule: { select: { name: true, triggerModule: true } } },
        orderBy: { executedAt: 'desc' },
        skip, take: Number(limit),
      }),
      this.prisma.automationExecution.count({ where: { rule: { tenantId } } }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async getStats(tenantId: string) {
    const [total, active, paused, totalExecutions, recentSuccesses, recentFailures] = await Promise.all([
      this.prisma.automationRule.count({ where: { tenantId } }),
      this.prisma.automationRule.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.automationRule.count({ where: { tenantId, status: 'PAUSED' } }),
      this.prisma.automationExecution.count({ where: { rule: { tenantId } } }),
      this.prisma.automationExecution.count({
        where: { rule: { tenantId }, status: 'SUCCESS', executedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.automationExecution.count({
        where: { rule: { tenantId }, status: 'FAILED', executedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return { total, active, paused, draft: total - active - paused, totalExecutions, recentSuccesses, recentFailures };
  }
}
