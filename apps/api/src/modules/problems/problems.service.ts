import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, status?: string, page = 1, limit = 50) {
    const where: any = { tenantId };
    if (status) where.status = status;
    const _page = Number(page) || 1; const _limit = Number(limit) || 20;
    const skip = (_page - 1) * _limit;
    const [data, total] = await Promise.all([
      this.prisma.problem.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.problem.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, tenantId: string) {
    const problem = await this.prisma.problem.findFirst({ where: { id, tenantId } });
    if (!problem) throw new NotFoundException('Problem not found');
    return problem;
  }

  private async generateProblemNumber(tenantId: string): Promise<string> {
    // Use last-created problem's number instead of count to reduce race window
    const last = await this.prisma.problem.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { problemNumber: true },
    });
    const lastNum = last.length > 0
      ? parseInt(last[0].problemNumber.replace('PRB-', ''), 10) || 0
      : 0;
    return `PRB-${String(lastNum + 1).padStart(5, '0')}`;
  }

  async create(tenantId: string, data: any) {
    const { title, description, priority, category, assignedToId } = data;
    // Retry loop to handle unique constraint violations from concurrent number generation
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const problemNumber = await this.generateProblemNumber(tenantId);
        return await this.prisma.problem.create({
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
      } catch (error: any) {
        // P2002 is Prisma's unique constraint violation error code
        if (error?.code === 'P2002' && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to generate unique problem number after maximum retries');
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

    // Retry loop to handle unique constraint violations from concurrent number generation
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Use last-created change request's number instead of count to reduce race window
        const lastChange = await this.prisma.changeRequest.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { changeNumber: true },
        });
        const lastChangeNum = lastChange.length > 0
          ? parseInt(lastChange[0].changeNumber.replace('CHG-', ''), 10) || 0
          : 0;
        const changeNumber = `CHG-${String(lastChangeNum + 1).padStart(5, '0')}`;

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

  async getKnownErrors(tenantId: string) {
    return this.prisma.problem.findMany({ where: { tenantId, isKnownError: true }, orderBy: { createdAt: 'desc' } });
  }

  async getStats(tenantId: string) {
    const stats = await this.prisma.problem.groupBy({ by: ['status'], where: { tenantId }, _count: true });
    const knownErrors = await this.prisma.problem.count({ where: { tenantId, isKnownError: true } });
    return { byStatus: stats, knownErrors };
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);

    try {
      return await this.prisma.problem.delete({ where: { id } });
    } catch (error: any) {
      // P2003 = foreign key constraint violation
      if (error?.code === 'P2003') {
        throw new ConflictException('Cannot delete problem — related record(s) exist. Unlink them first.');
      }
      throw error;
    }
  }
}
