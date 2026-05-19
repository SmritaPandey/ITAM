import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.prisma.problem.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async getById(id: string, tenantId: string) {
    return this.prisma.problem.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: any) {
    const count = await this.prisma.problem.count({ where: { tenantId } });
    const problemNumber = `PRB-${String(count + 1).padStart(5, '0')}`;
    const { title, description, priority, category, assignedToId } = data;
    return this.prisma.problem.create({
      data: {
        tenantId,
        problemNumber,
        title: title || 'Untitled Problem',
        ...(description && { description }),
        ...(priority && { priority }),
        ...(category && { category }),
        ...(assignedToId && { assignedToId }),
      },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    return this.prisma.problem.update({ where: { id, tenantId }, data });
  }

  async promoteToKnownError(id: string, tenantId: string, workaround: string) {
    const problem = await this.prisma.problem.findFirst({ where: { id, tenantId } });
    if (!problem) throw new NotFoundException('Problem not found');
    return this.prisma.problem.update({
      where: { id },
      data: { status: 'KNOWN_ERROR', isKnownError: true, workaround },
    });
  }

  async resolve(id: string, tenantId: string, resolution: string) {
    return this.prisma.problem.update({
      where: { id, tenantId },
      data: { status: 'RESOLVED', resolution, resolvedAt: new Date() },
    });
  }

  async getKnownErrors(tenantId: string) {
    return this.prisma.problem.findMany({ where: { tenantId, isKnownError: true }, orderBy: { createdAt: 'desc' } });
  }

  async getStats(tenantId: string) {
    const stats = await this.prisma.problem.groupBy({ by: ['status'], where: { tenantId }, _count: true });
    const knownErrors = await this.prisma.problem.count({ where: { tenantId, isKnownError: true } });
    return { byStatus: stats, knownErrors };
  }
}
