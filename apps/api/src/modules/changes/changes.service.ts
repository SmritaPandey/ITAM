import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['IN_PROGRESS', 'CANCELLED'],
  REJECTED: ['DRAFT'],
  IN_PROGRESS: ['COMPLETED', 'FAILED', 'ROLLED_BACK'],
  COMPLETED: [],
  FAILED: ['DRAFT'],
  ROLLED_BACK: ['DRAFT'],
  CANCELLED: [],
};

@Injectable()
export class ChangesService {
  private readonly logger = new Logger(ChangesService.name);

  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.prisma.changeRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async getById(id: string, tenantId: string) {
    return this.prisma.changeRequest.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, userId: string, data: any) {
    const count = await this.prisma.changeRequest.count({ where: { tenantId } });
    const changeNumber = `CHG-${String(count + 1).padStart(5, '0')}`;
    return this.prisma.changeRequest.create({ data: { tenantId, changeNumber, requestedById: userId, ...data } });
  }

  async update(id: string, tenantId: string, data: any) {
    return this.prisma.changeRequest.update({ where: { id, tenantId }, data });
  }

  async transition(id: string, tenantId: string, userId: string, newStatus: string, notes?: string) {
    const change = await this.prisma.changeRequest.findFirst({ where: { id, tenantId } });
    if (!change) throw new NotFoundException('Change not found');
    const allowed = VALID_TRANSITIONS[change.status] || [];
    if (!allowed.includes(newStatus)) throw new BadRequestException(`Cannot transition from ${change.status} to ${newStatus}`);
    const updates: any = { status: newStatus };
    if (newStatus === 'APPROVED') { updates.approvedById = userId; }
    if (newStatus === 'IN_PROGRESS') { updates.actualStart = new Date(); updates.implementedById = userId; }
    if (['COMPLETED', 'FAILED', 'ROLLED_BACK'].includes(newStatus)) { updates.actualEnd = new Date(); }
    if (notes) updates.closureNotes = notes;
    return this.prisma.changeRequest.update({ where: { id }, data: updates });
  }

  async getCalendar(tenantId: string) {
    return this.prisma.changeRequest.findMany({
      where: { tenantId, status: { in: ['APPROVED', 'IN_PROGRESS'] }, scheduledStart: { not: null } },
      select: { id: true, changeNumber: true, title: true, type: true, priority: true, risk: true, status: true, scheduledStart: true, scheduledEnd: true },
      orderBy: { scheduledStart: 'asc' },
    });
  }

  async getStats(tenantId: string) {
    const stats = await this.prisma.changeRequest.groupBy({ by: ['status'], where: { tenantId }, _count: true });
    const byType = await this.prisma.changeRequest.groupBy({ by: ['type'], where: { tenantId }, _count: true });
    return { byStatus: stats, byType };
  }
}
