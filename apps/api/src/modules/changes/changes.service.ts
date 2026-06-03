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

  async list(tenantId: string, status?: string, page = 1, limit = 50) {
    const where: any = { tenantId };
    if (status) where.status = status;
    const _page = Number(page) || 1; const _limit = Number(limit) || 20;
    const skip = (_page - 1) * _limit;
    const [data, total] = await Promise.all([
      this.prisma.changeRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.changeRequest.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, tenantId: string) {
    const change = await this.prisma.changeRequest.findFirst({ where: { id, tenantId } });
    if (!change) throw new NotFoundException('Change request not found');
    return change;
  }

  private async generateChangeNumber(tenantId: string): Promise<string> {
    // Use last-created change request's number instead of count to reduce race window
    const last = await this.prisma.changeRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { changeNumber: true },
    });
    const lastNum = last.length > 0
      ? parseInt(last[0].changeNumber.replace('CHG-', ''), 10) || 0
      : 0;
    return `CHG-${String(lastNum + 1).padStart(5, '0')}`;
  }

  async create(tenantId: string, userId: string, data: any) {
    // Retry loop to handle unique constraint violations from concurrent number generation
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const changeNumber = await this.generateChangeNumber(tenantId);
        return await this.prisma.changeRequest.create({ data: { tenantId, changeNumber, requestedById: userId, ...data } });
      } catch (error: any) {
        // P2002 is Prisma's unique constraint violation error code
        if (error?.code === 'P2002' && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to generate unique change number after maximum retries');
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
