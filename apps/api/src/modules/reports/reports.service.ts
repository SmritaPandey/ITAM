import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getAssetSummary(tenantId: string) {
    const [total, byType, byStatus, byDepartment, totalValue] = await Promise.all([
      this.prisma.asset.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.asset.groupBy({ by: ['category'], where: { tenantId, deletedAt: null }, _count: true }),
      this.prisma.asset.groupBy({ by: ['status'], where: { tenantId, deletedAt: null }, _count: true }),
      this.prisma.asset.groupBy({ by: ['departmentId'], where: { tenantId, deletedAt: null }, _count: true }),
      this.prisma.asset.aggregate({ where: { tenantId, deletedAt: null }, _sum: { currentValue: true } }),
    ]);
    return {
      total,
      totalValue: totalValue._sum.currentValue || 0,
      byType: byType.map(t => ({ category: t.category || 'Other', count: t._count })),
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
      byDepartment: byDepartment.map(d => ({ departmentId: d.departmentId, count: d._count })),
    };
  }

  async getTicketSummary(tenantId: string) {
    const [total, open, byPriority, byStatus, avgResolution] = await Promise.all([
      this.prisma.ticket.count({ where: { tenantId } }),
      this.prisma.ticket.count({ where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.ticket.groupBy({ by: ['priority'], where: { tenantId }, _count: true }),
      this.prisma.ticket.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      this.prisma.ticket.findMany({
        where: { tenantId, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    // Calculate average resolution time in hours
    let avgHours = 0;
    if (avgResolution.length > 0) {
      const totalMs = avgResolution.reduce((sum, t) => {
        return sum + (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime());
      }, 0);
      avgHours = Math.round(totalMs / avgResolution.length / (1000 * 60 * 60));
    }

    return {
      total, open, closed: total - open,
      avgResolutionHours: avgHours,
      byPriority: byPriority.map(p => ({ priority: p.priority, count: p._count })),
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
    };
  }

  async getLicenseSummary(tenantId: string) {
    const licenses = await this.prisma.license.findMany({ where: { tenantId } });
    const total = licenses.length;
    const compliant = licenses.filter(l => l.usedSeats <= l.totalSeats).length;
    const overused = licenses.filter(l => l.usedSeats > l.totalSeats).length;
    const totalSpend = licenses.reduce((s, l) => s + (l.renewalCost?.toNumber() || l.purchaseCost?.toNumber() || 0), 0);
    const expiring = licenses.filter(l => {
      if (!l.expiryDate) return false;
      const daysLeft = (new Date(l.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysLeft > 0 && daysLeft <= 30;
    }).length;

    return { total, compliant, overused, expiring, totalSpend };
  }

  async getExecutiveDashboard(tenantId: string) {
    const [assets, tickets, licenses] = await Promise.all([
      this.getAssetSummary(tenantId),
      this.getTicketSummary(tenantId),
      this.getLicenseSummary(tenantId),
    ]);
    return { assets, tickets, licenses, generatedAt: new Date() };
  }

  async getMonthlyTrend(tenantId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });

    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, resolvedAt: true },
    });

    // Group by month
    const months: Record<string, { created: number; resolved: number; assetsAdded: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('en', { month: 'short' });
      months[key] = { created: 0, resolved: 0, assetsAdded: 0 };
    }

    assets.forEach(a => {
      const key = new Date(a.createdAt).toLocaleString('en', { month: 'short' });
      if (months[key]) months[key].assetsAdded++;
    });

    tickets.forEach(t => {
      const key = new Date(t.createdAt).toLocaleString('en', { month: 'short' });
      if (months[key]) months[key].created++;
      if (t.resolvedAt) {
        const rKey = new Date(t.resolvedAt).toLocaleString('en', { month: 'short' });
        if (months[rKey]) months[rKey].resolved++;
      }
    });

    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }
}
