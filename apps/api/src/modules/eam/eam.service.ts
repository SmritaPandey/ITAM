import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class EamService {
  private readonly logger = new Logger(EamService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Maintenance schedules ─────────────────────────────────────────

  async listSchedules(tenantId: string, opts?: { assetId?: string; isActive?: boolean }) {
    const where: any = { tenantId };
    if (opts?.assetId) where.assetId = opts.assetId;
    if (opts?.isActive !== undefined) where.isActive = opts.isActive;
    return this.prisma.withTenant(tenantId, async (tx) =>
      tx.maintenanceSchedule.findMany({
        where,
        include: {
          asset: { select: { id: true, name: true, assetTag: true, status: true, siteId: true } },
        },
        orderBy: { nextDueAt: 'asc' },
      }),
    );
  }

  async getSchedule(id: string, tenantId: string) {
    const row = await this.prisma.maintenanceSchedule.findFirst({
      where: { id, tenantId },
      include: {
        asset: { select: { id: true, name: true, assetTag: true, status: true } },
      },
    });
    if (!row) throw new NotFoundException('Maintenance schedule not found');
    return row;
  }

  async createSchedule(tenantId: string, data: any) {
    if (!data.assetId || !data.name) {
      throw new BadRequestException('assetId and name are required');
    }
    const asset = await this.prisma.asset.findFirst({
      where: { id: data.assetId, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    return this.prisma.maintenanceSchedule.create({
      data: {
        tenantId,
        assetId: data.assetId,
        name: data.name,
        scheduleType: data.scheduleType || 'CALENDAR',
        cronExpression: data.cronExpression ?? null,
        intervalDays: data.intervalDays ?? null,
        conditionMetric: data.conditionMetric ?? null,
        conditionThreshold: data.conditionThreshold ?? null,
        nextDueAt: data.nextDueAt ? new Date(data.nextDueAt) : null,
        autoCreateWo: data.autoCreateWo !== false,
        isActive: data.isActive !== false,
        notes: data.notes ?? null,
      },
      include: {
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    });
  }

  async updateSchedule(id: string, tenantId: string, data: any) {
    await this.getSchedule(id, tenantId);
    return this.prisma.maintenanceSchedule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.scheduleType !== undefined && { scheduleType: data.scheduleType }),
        ...(data.cronExpression !== undefined && { cronExpression: data.cronExpression }),
        ...(data.intervalDays !== undefined && { intervalDays: data.intervalDays }),
        ...(data.conditionMetric !== undefined && { conditionMetric: data.conditionMetric }),
        ...(data.conditionThreshold !== undefined && { conditionThreshold: data.conditionThreshold }),
        ...(data.nextDueAt !== undefined && {
          nextDueAt: data.nextDueAt ? new Date(data.nextDueAt) : null,
        }),
        ...(data.autoCreateWo !== undefined && { autoCreateWo: data.autoCreateWo }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.lastCompletedAt !== undefined && {
          lastCompletedAt: data.lastCompletedAt ? new Date(data.lastCompletedAt) : null,
        }),
      },
      include: {
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    });
  }

  async deleteSchedule(id: string, tenantId: string) {
    await this.getSchedule(id, tenantId);
    await this.prisma.maintenanceSchedule.delete({ where: { id } });
    return { deleted: true };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processDueMaintenance() {
    if (process.env.DISABLE_CRON_JOBS === 'true') return;
    this.logger.log('Processing due maintenance schedules…');
    try {
      const result = await this.createWorkOrdersForDueSchedules();
      if (result.created > 0) {
        this.logger.log(`Auto-created ${result.created} work order(s) from PM schedules`);
      }
    } catch (err: any) {
      this.logger.error(`PM cron failed: ${err?.message || err}`);
    }
  }

  async createWorkOrdersForDueSchedules(tenantId?: string) {
    const now = new Date();
    const baseWhere: any = { isActive: true, autoCreateWo: true };
    if (tenantId) baseWhere.tenantId = tenantId;

    const calendarDue = await this.prisma.maintenanceSchedule.findMany({
      where: {
        ...baseWhere,
        scheduleType: { in: ['CALENDAR', 'METER'] },
        nextDueAt: { lte: now },
      },
      include: { asset: { select: { id: true, name: true, assetTag: true } } },
    });

    const conditionSchedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        ...baseWhere,
        scheduleType: 'CONDITION',
        conditionMetric: { not: null },
        conditionThreshold: { not: null },
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetTag: true,
            status: true,
            customFields: true,
          },
        },
      },
    });

    const conditionDue: typeof calendarDue = [];
    for (const schedule of conditionSchedules) {
      if (await this.isConditionDue(schedule)) {
        conditionDue.push(schedule as any);
      }
    }

    const due = [...calendarDue, ...conditionDue];
    let created = 0;
    const workOrders: any[] = [];

    for (const schedule of due) {
      const open = await this.prisma.maintenanceWorkOrder.findFirst({
        where: {
          tenantId: schedule.tenantId,
          scheduleId: schedule.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      });
      if (open) continue;

      const wo = await this.createPmWorkOrder(schedule);
      if (!wo) continue;
      workOrders.push(wo);

      const nextDue = schedule.intervalDays
        ? new Date(now.getTime() + schedule.intervalDays * 86400000)
        : null;

      await this.prisma.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          lastCompletedAt: now,
          nextDueAt: nextDue,
        },
      });
      created++;
    }

    return { created, workOrders };
  }

  /** Evaluate CONDITION schedules against asset customFields / agent metrics. */
  private async isConditionDue(schedule: {
    conditionMetric: string | null;
    conditionThreshold: number | null;
    assetId: string;
    tenantId: string;
    asset?: { customFields?: unknown } | null;
  }): Promise<boolean> {
    const metric = (schedule.conditionMetric || '').trim();
    const threshold = schedule.conditionThreshold;
    if (!metric || threshold == null) return false;

    let value: number | null = null;
    const fields = (schedule.asset?.customFields || {}) as Record<string, unknown>;
    if (fields[metric] != null && !Number.isNaN(Number(fields[metric]))) {
      value = Number(fields[metric]);
    }

    if (value == null) {
      const agent = await this.prisma.agent.findFirst({
        where: { tenantId: schedule.tenantId, assetId: schedule.assetId },
        select: { systemInfo: true },
      });
      const info = (agent?.systemInfo || {}) as any;
      const candidates = [
        info?.[metric],
        info?.performance?.[metric],
        info?.hardware?.[metric],
        info?.metrics?.[metric],
      ];
      for (const c of candidates) {
        if (c != null && !Number.isNaN(Number(c))) {
          value = Number(c);
          break;
        }
      }
    }

    if (value == null) return false;
    // Due when measured value meets/exceeds threshold (e.g. runtime hours, vibration)
    return value >= threshold;
  }

  private async createPmWorkOrder(schedule: {
    id: string;
    tenantId: string;
    assetId: string;
    name: string;
    asset?: { name: string; assetTag: string | null } | null;
  }) {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const woNumber = await this.generateWoNumber(schedule.tenantId);
        return await this.prisma.maintenanceWorkOrder.create({
          data: {
            tenantId: schedule.tenantId,
            scheduleId: schedule.id,
            assetId: schedule.assetId,
            workOrderNumber: woNumber,
            title: `PM: ${schedule.name}`,
            description: `Auto-generated from preventive maintenance schedule "${schedule.name}" for asset ${schedule.asset?.name || schedule.assetId}${schedule.asset?.assetTag ? ` (${schedule.asset.assetTag})` : ''}.`,
            priority: 'MEDIUM',
            status: 'OPEN',
            dueAt: new Date(),
          },
        });
      } catch (error: any) {
        if (error?.code === 'P2002' && attempt < MAX_RETRIES - 1) continue;
        throw error;
      }
    }
    return null;
  }

  private async generateWoNumber(tenantId: string): Promise<string> {
    const last = await this.prisma.maintenanceWorkOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { workOrderNumber: true },
    });
    const lastNum =
      last.length > 0
        ? parseInt(last[0].workOrderNumber.replace('MWO-', ''), 10) || 0
        : 0;
    return `MWO-${String(lastNum + 1).padStart(5, '0')}`;
  }

  async listWorkOrders(tenantId: string, opts?: { status?: string; assetId?: string }) {
    const where: any = { tenantId };
    if (opts?.status) where.status = opts.status;
    if (opts?.assetId) where.assetId = opts.assetId;
    return this.prisma.maintenanceWorkOrder.findMany({
      where,
      include: {
        asset: { select: { id: true, name: true, assetTag: true, status: true } },
        schedule: { select: { id: true, name: true, scheduleType: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateWorkOrder(id: string, tenantId: string, data: any) {
    const row = await this.prisma.maintenanceWorkOrder.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Maintenance work order not found');
    return this.prisma.maintenanceWorkOrder.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
        ...(data.status === 'COMPLETED' && { completedAt: new Date() }),
      },
      include: {
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    });
  }

  // ─── Spare parts ───────────────────────────────────────────────────

  async listSpareParts(tenantId: string) {
    return this.prisma.sparePart.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { transactions: true } } },
    });
  }

  async getSparePart(id: string, tenantId: string) {
    const row = await this.prisma.sparePart.findFirst({
      where: { id, tenantId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!row) throw new NotFoundException('Spare part not found');
    return row;
  }

  async createSparePart(tenantId: string, data: any) {
    if (!data.sku || !data.name) {
      throw new BadRequestException('sku and name are required');
    }
    return this.prisma.sparePart.create({
      data: {
        tenantId,
        sku: data.sku,
        name: data.name,
        description: data.description ?? null,
        quantityOnHand: data.quantityOnHand ?? 0,
        minStock: data.minStock ?? 0,
        unitCost: data.unitCost ?? null,
        location: data.location ?? null,
      },
    });
  }

  async updateSparePart(id: string, tenantId: string, data: any) {
    await this.getSparePart(id, tenantId);
    return this.prisma.sparePart.update({
      where: { id },
      data: {
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.minStock !== undefined && { minStock: data.minStock }),
        ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
        ...(data.location !== undefined && { location: data.location }),
      },
    });
  }

  async deleteSparePart(id: string, tenantId: string) {
    await this.getSparePart(id, tenantId);
    await this.prisma.sparePart.delete({ where: { id } });
    return { deleted: true };
  }

  async receiveSparePart(
    id: string,
    tenantId: string,
    data: { quantity: number; notes?: string; workOrderId?: string },
  ) {
    return this.transactSparePart(id, tenantId, {
      quantity: Math.abs(data.quantity),
      type: 'RECEIVE',
      notes: data.notes,
      workOrderId: data.workOrderId,
    });
  }

  async consumeSparePart(
    id: string,
    tenantId: string,
    data: { quantity: number; notes?: string; workOrderId?: string },
  ) {
    return this.transactSparePart(id, tenantId, {
      quantity: -Math.abs(data.quantity),
      type: 'CONSUME',
      notes: data.notes,
      workOrderId: data.workOrderId,
    });
  }

  private async transactSparePart(
    id: string,
    tenantId: string,
    data: { quantity: number; type: string; notes?: string; workOrderId?: string },
  ) {
    if (!data.quantity || data.quantity === 0) {
      throw new BadRequestException('quantity must be non-zero');
    }
    const part = await this.getSparePart(id, tenantId);
    const delta = data.type === 'CONSUME' ? -Math.abs(data.quantity) : data.quantity;
    const nextQty = part.quantityOnHand + delta;
    if (nextQty < 0) {
      throw new BadRequestException(
        `Insufficient stock: on hand ${part.quantityOnHand}, requested ${Math.abs(delta)}`,
      );
    }

    const [updated, tx] = await this.prisma.$transaction([
      this.prisma.sparePart.update({
        where: { id },
        data: { quantityOnHand: nextQty },
      }),
      this.prisma.sparePartTransaction.create({
        data: {
          tenantId,
          sparePartId: id,
          quantity: Math.abs(data.quantity),
          type: data.type,
          workOrderId: data.workOrderId ?? null,
          notes: data.notes ?? null,
        },
      }),
    ]);

    if (updated.quantityOnHand < updated.minStock) {
      await this.prisma.alertEvent.create({
        data: {
          tenantId,
          severity: 'HIGH',
          category: 'INVENTORY',
          title: `Low stock: ${updated.name}`,
          message: `Spare part ${updated.sku} (${updated.name}) is below minimum stock. On hand: ${updated.quantityOnHand}, min: ${updated.minStock}.`,
          source: 'eam.spare_parts',
          sourceId: updated.id,
          metadata: {
            sku: updated.sku,
            quantityOnHand: updated.quantityOnHand,
            minStock: updated.minStock,
          },
        },
      });
    }

    return { part: updated, transaction: tx };
  }

  // ─── Consumables ───────────────────────────────────────────────────

  async listConsumables(tenantId: string) {
    return this.prisma.consumable.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getConsumable(id: string, tenantId: string) {
    const row = await this.prisma.consumable.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Consumable not found');
    return row;
  }

  async createConsumable(tenantId: string, data: any) {
    if (!data.sku || !data.name) {
      throw new BadRequestException('sku and name are required');
    }
    const created = await this.prisma.consumable.create({
      data: {
        tenantId,
        sku: data.sku,
        name: data.name,
        quantityOnHand: data.quantityOnHand ?? 0,
        reorderPoint: data.reorderPoint ?? 0,
        reorderQty: data.reorderQty ?? 0,
        unitCost: data.unitCost ?? null,
      },
    });
    await this.maybeReorderAlert(created);
    return created;
  }

  async updateConsumable(id: string, tenantId: string, data: any) {
    await this.getConsumable(id, tenantId);
    const updated = await this.prisma.consumable.update({
      where: { id },
      data: {
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.quantityOnHand !== undefined && { quantityOnHand: data.quantityOnHand }),
        ...(data.reorderPoint !== undefined && { reorderPoint: data.reorderPoint }),
        ...(data.reorderQty !== undefined && { reorderQty: data.reorderQty }),
        ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
      },
    });
    await this.maybeReorderAlert(updated);
    return updated;
  }

  async adjustConsumable(
    id: string,
    tenantId: string,
    data: { delta: number; notes?: string },
  ) {
    const row = await this.getConsumable(id, tenantId);
    const next = row.quantityOnHand + (data.delta || 0);
    if (next < 0) throw new BadRequestException('Quantity cannot go negative');
    const updated = await this.prisma.consumable.update({
      where: { id },
      data: { quantityOnHand: next },
    });
    await this.maybeReorderAlert(updated);
    return updated;
  }

  async deleteConsumable(id: string, tenantId: string) {
    await this.getConsumable(id, tenantId);
    await this.prisma.consumable.delete({ where: { id } });
    return { deleted: true };
  }

  private async maybeReorderAlert(c: {
    id: string;
    tenantId: string;
    sku: string;
    name: string;
    quantityOnHand: number;
    reorderPoint: number;
    reorderQty: number;
  }) {
    if (c.quantityOnHand >= c.reorderPoint) return;
    await this.prisma.alertEvent.create({
      data: {
        tenantId: c.tenantId,
        severity: 'MEDIUM',
        category: 'INVENTORY',
        title: `Reorder: ${c.name}`,
        message: `Consumable ${c.sku} (${c.name}) is below reorder point. On hand: ${c.quantityOnHand}, reorder point: ${c.reorderPoint}, suggested qty: ${c.reorderQty}.`,
        source: 'eam.consumables',
        sourceId: c.id,
        metadata: {
          sku: c.sku,
          quantityOnHand: c.quantityOnHand,
          reorderPoint: c.reorderPoint,
          reorderQty: c.reorderQty,
        },
      },
    });
  }

  // ─── Facility ──────────────────────────────────────────────────────

  async listFacilitySites(tenantId: string) {
    const sites = await this.prisma.site.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { assets: true } },
      },
    });
    return sites;
  }

  async getSiteFloorPlan(siteId: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
    });
    if (!site) throw new NotFoundException('Site not found');

    const pins = await this.prisma.asset.findMany({
      where: {
        tenantId,
        siteId,
        deletedAt: null,
        OR: [{ floorPinX: { not: null } }, { floorPinY: { not: null } }],
      },
      select: {
        id: true,
        name: true,
        assetTag: true,
        status: true,
        floor: true,
        room: true,
        floorPinX: true,
        floorPinY: true,
        category: true,
      },
    });

    return { site, pins };
  }

  async updateAssetFloorPin(
    assetId: string,
    tenantId: string,
    data: { floorPinX?: number | null; floorPinY?: number | null; siteId?: string; floor?: string; room?: string },
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    return this.prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(data.floorPinX !== undefined && { floorPinX: data.floorPinX }),
        ...(data.floorPinY !== undefined && { floorPinY: data.floorPinY }),
        ...(data.siteId !== undefined && { siteId: data.siteId }),
        ...(data.floor !== undefined && { floor: data.floor }),
        ...(data.room !== undefined && { room: data.room }),
      },
      select: {
        id: true,
        name: true,
        assetTag: true,
        siteId: true,
        floor: true,
        room: true,
        floorPinX: true,
        floorPinY: true,
      },
    });
  }

  async updateSiteFloorPlan(siteId: string, tenantId: string, floorPlanUrl: string | null) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId } });
    if (!site) throw new NotFoundException('Site not found');
    return this.prisma.site.update({
      where: { id: siteId },
      data: { floorPlanUrl },
    });
  }

  async getFacilityDashboard(tenantId: string) {
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 86400000);

    const [
      sitesWithPlans,
      pmDue,
      pmOverdue,
      lowSpares,
      lowConsumables,
      openPmWorkOrders,
      pinnedAssets,
    ] = await Promise.all([
      this.prisma.site.count({
        where: { tenantId, floorPlanUrl: { not: null } },
      }),
      this.prisma.maintenanceSchedule.count({
        where: {
          tenantId,
          isActive: true,
          nextDueAt: { gte: now, lte: in7d },
        },
      }),
      this.prisma.maintenanceSchedule.count({
        where: {
          tenantId,
          isActive: true,
          nextDueAt: { lte: now },
        },
      }),
      this.prisma.sparePart.findMany({
        where: { tenantId },
      }).then((parts) => parts.filter((p) => p.quantityOnHand < p.minStock)),
      this.prisma.consumable.findMany({
        where: { tenantId },
      }).then((rows) => rows.filter((c) => c.quantityOnHand < c.reorderPoint)),
      this.prisma.maintenanceWorkOrder.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.asset.count({
        where: {
          tenantId,
          deletedAt: null,
          floorPinX: { not: null },
          floorPinY: { not: null },
        },
      }),
    ]);

    const upcomingPm = await this.prisma.maintenanceSchedule.findMany({
      where: {
        tenantId,
        isActive: true,
        nextDueAt: { not: null },
      },
      include: {
        asset: { select: { id: true, name: true, assetTag: true, status: true } },
      },
      orderBy: { nextDueAt: 'asc' },
      take: 20,
    });

    return {
      sitesWithFloorPlans: sitesWithPlans,
      pmDueSoon: pmDue,
      pmOverdue,
      openPmWorkOrders,
      pinnedAssets,
      lowSpareParts: lowSpares.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        quantityOnHand: p.quantityOnHand,
        minStock: p.minStock,
      })),
      lowConsumables: lowConsumables.map((c) => ({
        id: c.id,
        sku: c.sku,
        name: c.name,
        quantityOnHand: c.quantityOnHand,
        reorderPoint: c.reorderPoint,
        reorderQty: c.reorderQty,
      })),
      upcomingPm,
    };
  }
}
