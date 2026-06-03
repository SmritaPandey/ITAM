import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { ReportGeneratorService } from './report-generator.service';
import { EmailService } from '../notifications/email.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private reportGenerator: ReportGeneratorService,
    private emailService: EmailService,
  ) {}

  // ─── Scheduled Report Execution Cron ──────────────────────────

  /**
   * Runs every hour to find and execute due scheduled reports.
   * For each due report: generates data, emails recipients if configured,
   * and advances nextRunAt.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async executeScheduledReports() {
    const now = new Date();

    const dueReports = await this.prisma.scheduledReport.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
    });

    if (dueReports.length === 0) return;

    this.logger.log(`Executing ${dueReports.length} scheduled report(s)...`);

    for (const schedule of dueReports) {
      try {
        // Generate the report using the existing report generator
        const report = await this.reportGenerator.generate(
          schedule.tenantId,
          schedule.reportType,
          { format: schedule.format },
        );

        // Attempt email delivery if recipients are configured
        if (schedule.recipients && schedule.recipients.length > 0) {
          const csvContent = this.reportGenerator.toCSV(report);
          const reportData = report as any;
          await this.emailService.send({
            to: schedule.recipients,
            subject: `📊 Scheduled Report: ${schedule.name} — ${now.toLocaleDateString()}`,
            html: `
              <h2>${reportData.title || schedule.name}</h2>
              <p>Your scheduled report <strong>${schedule.name}</strong> has been generated.</p>
              <p>Report Type: ${schedule.reportType} | Format: ${schedule.format}</p>
              <p>Generated at: ${now.toISOString()}</p>
              ${reportData.summary ? `<pre>${JSON.stringify(reportData.summary, null, 2)}</pre>` : ''}
              <hr/>
              <p><em>Full report data is attached below in CSV format:</em></p>
              <pre style="font-size:11px;max-height:400px;overflow:auto">${csvContent.substring(0, 5000)}${csvContent.length > 5000 ? '\n... (truncated)' : ''}</pre>
            `,
          });
          this.logger.log(`Report "${schedule.name}" emailed to ${schedule.recipients.length} recipient(s)`);
        }

        // Update lastRunAt and calculate nextRunAt
        const nextRunAt = this.calculateNextRun(schedule.schedule);
        await this.prisma.scheduledReport.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            nextRunAt,
          },
        });

        this.logger.log(`Scheduled report "${schedule.name}" executed. Next run: ${nextRunAt.toISOString()}`);
      } catch (err: any) {
        // Log and continue — one failure should not block others
        this.logger.error(`Failed to execute scheduled report "${schedule.name}" (${schedule.id}): ${err.message}`);
      }
    }
  }

  /**
   * Calculate the next run time from a cron expression.
   * Simple parser for standard 5-field cron; falls back to +24h for complex expressions.
   */
  private calculateNextRun(cronExpr: string): Date {
    const now = new Date();
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [min, hour, dayOfMonth, month, dayOfWeek] = parts;
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(parseInt(min) || 0);
    next.setHours(parseInt(hour) || 0);

    // Advance to next occurrence
    if (next <= now) {
      if (dayOfWeek !== '*' && dayOfMonth === '*') {
        // Weekly schedule — advance to next matching weekday
        const targetDay = parseInt(dayOfWeek);
        if (!isNaN(targetDay)) {
          do {
            next.setDate(next.getDate() + 1);
          } while (next.getDay() !== targetDay);
        } else {
          next.setDate(next.getDate() + 7);
        }
      } else if (dayOfMonth !== '*') {
        // Monthly schedule — advance to next month
        next.setMonth(next.getMonth() + 1);
        next.setDate(parseInt(dayOfMonth) || 1);
      } else {
        // Daily schedule — advance to tomorrow
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  }

  // ─── Report Data Methods ──────────────────────────────────────

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
