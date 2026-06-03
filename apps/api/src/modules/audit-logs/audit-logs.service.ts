import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters: {
    page?: number; limit?: number; action?: string; resourceType?: string;
    actorId?: string; startDate?: string; endDate?: string; search?: string;
  }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 30;
    const _page = Number(page) || 1; const _limit = Number(limit) || 20;
    const skip = (_page - 1) * _limit;

    const where: any = { tenantId };
    if (filters.action) where.action = filters.action;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
      if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { timestamp: 'desc' },
        skip,
        take: _limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getStats(tenantId: string) {
    const [total, today, actions] = await Promise.all([
      this.prisma.auditLog.count({ where: { tenantId } }),
      this.prisma.auditLog.count({
        where: { tenantId, timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: { tenantId },
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ]);
    return { total, today, topActions: actions.map(a => ({ action: a.action, count: a._count })) };
  }

  async verifyChain(tenantId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId, hash: { not: null } },
      orderBy: { timestamp: 'asc' },
      select: { id: true, hash: true, prevHash: true, timestamp: true },
    });

    let valid = true;
    let brokenAt: string | null = null;
    for (let i = 1; i < logs.length; i++) {
      if (logs[i].prevHash !== logs[i - 1].hash) {
        valid = false;
        brokenAt = logs[i].id;
        break;
      }
    }

    return { valid, totalLogs: logs.length, brokenAt, checkedAt: new Date() };
  }
}
