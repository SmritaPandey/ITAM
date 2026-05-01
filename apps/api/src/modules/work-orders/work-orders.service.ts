import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

@Injectable()
export class WorkOrderService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async findAll(tenantId: string, page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where, skip, take: +limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workOrder.count({ where }),
    ]);
    return { data, total, page: +page, limit: +limit };
  }

  async findById(id: string, tenantId: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    return wo;
  }

  async create(tenantId: string, userId: string, data: any) {
    const count = await this.prisma.workOrder.count({ where: { tenantId } });
    const woNumber = `WO-${String(count + 1).padStart(5, '0')}`;

    const wo = await this.prisma.workOrder.create({
      data: {
        tenantId,
        workOrderNumber: woNumber,
        title: data.title,
        description: data.description,
        type: data.type || 'MAINTENANCE',
        priority: data.priority || 'MEDIUM',
        ticketId: data.ticketId,
        assetId: data.assetId,
        assignedToId: data.assignedToId,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
      },
    });

    this.eventBus.emit('work_order.created', {
      tenantId,
      userId,
      workOrderId: wo.id,
      woNumber,
    });

    return wo;
  }

  async convertFromTicket(ticketId: string, tenantId: string, userId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.create(tenantId, userId, {
      title: `[WO] ${ticket.subject}`,
      description: ticket.description,
      priority: ticket.priority,
      ticketId: ticket.id,
    });
  }

  async update(id: string, tenantId: string, data: any) {
    const wo = await this.findById(id, tenantId);
    return this.prisma.workOrder.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === 'IN_PROGRESS' && !wo.actualStart ? { actualStart: new Date() } : {}),
        ...(data.status === 'COMPLETED' ? { actualEnd: new Date() } : {}),
      },
    });
  }

  async updateStatus(id: string, tenantId: string, userId: string, status: string) {
    const wo = await this.findById(id, tenantId);
    const validTransitions: Record<string, string[]> = {
      CREATED: ['ASSIGNED', 'CANCELLED'],
      ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: ['VERIFIED'],
      VERIFIED: [],
      CANCELLED: [],
    };

    if (!validTransitions[wo.status]?.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${wo.status} to ${status}`);
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status,
        ...(status === 'IN_PROGRESS' ? { actualStart: new Date() } : {}),
        ...(status === 'COMPLETED' ? { actualEnd: new Date(), completedById: userId } : {}),
        ...(status === 'VERIFIED' ? { verifiedById: userId } : {}),
      },
    });
  }

  async getStats(tenantId: string) {
    const [total, created, assigned, inProgress, completed, verified, cancelled] = await Promise.all([
      this.prisma.workOrder.count({ where: { tenantId } }),
      this.prisma.workOrder.count({ where: { tenantId, status: 'CREATED' } }),
      this.prisma.workOrder.count({ where: { tenantId, status: 'ASSIGNED' } }),
      this.prisma.workOrder.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
      this.prisma.workOrder.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.workOrder.count({ where: { tenantId, status: 'VERIFIED' } }),
      this.prisma.workOrder.count({ where: { tenantId, status: 'CANCELLED' } }),
    ]);
    return { total, created, assigned, inProgress, completed, verified, cancelled };
  }
}
