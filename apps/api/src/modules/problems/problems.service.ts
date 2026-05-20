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

  async promoteToChangeRequest(id: string, tenantId: string, userId: string, changeData?: any) {
    const problem = await this.prisma.problem.findFirst({ where: { id, tenantId } });
    if (!problem) throw new NotFoundException('Problem not found');

    const count = await this.prisma.changeRequest.count({ where: { tenantId } });
    const changeNumber = `CHG-${String(count + 1).padStart(5, '0')}`;

    const title = changeData?.title || `Change Request from ${problem.problemNumber}: ${problem.title}`;
    const description = changeData?.description || problem.description || 'Change request created from problem record.';
    const type = changeData?.type || 'NORMAL';
    const category = changeData?.category || problem.category || 'Infrastructure';
    const priority = changeData?.priority || problem.priority || 'MEDIUM';
    const risk = changeData?.risk || 'MEDIUM';

    const changeRequest = await this.prisma.changeRequest.create({
      data: {
        tenantId,
        changeNumber,
        title,
        description,
        type,
        category,
        priority,
        risk,
        status: 'DRAFT',
        requestedById: userId,
        affectedAssets: problem.affectedAssets || [],
        relatedTickets: problem.relatedTickets || [],
      }
    });

    const existingChanges = Array.isArray(problem.relatedChanges) ? problem.relatedChanges : [];
    const newChangeEntry = {
      id: changeRequest.id,
      changeNumber: changeRequest.changeNumber,
      title: changeRequest.title,
      status: changeRequest.status,
    };
    const updatedChanges = [...existingChanges, newChangeEntry];

    const updatedProblem = await this.prisma.problem.update({
      where: { id },
      data: {
        status: 'ROOT_CAUSE_IDENTIFIED',
        relatedChanges: updatedChanges as any,
      }
    });

    return { problem: updatedProblem, changeRequest };
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
