import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { calculateNextRun } from '../../common/utils/cron-next-run';
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
        const filters = (schedule.filters as any) || {};
        const report = await this.reportGenerator.generate(
          schedule.tenantId,
          schedule.reportType,
          {
            format: schedule.format,
            filters,
            startDate: filters.startDate,
            endDate: filters.endDate,
          },
        );

        if (schedule.recipients && schedule.recipients.length > 0) {
          const fmt = String(schedule.format || 'CSV').toUpperCase();
          const stamp = now.toISOString().split('T')[0];
          const baseName = `${schedule.reportType}_${stamp}`;
          let attachment: { filename: string; content: Buffer | string; contentType: string };

          if (fmt === 'PDF') {
            const buf = await this.reportGenerator.toPDF(report);
            attachment = { filename: `${baseName}.pdf`, content: buf, contentType: 'application/pdf' };
          } else if (fmt === 'XLSX' || fmt === 'XLS') {
            const buf = await this.reportGenerator.toXLSX(report);
            attachment = {
              filename: `${baseName}.xlsx`,
              content: buf,
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            };
          } else {
            const csv = this.reportGenerator.toCSV(report);
            attachment = { filename: `${baseName}.csv`, content: csv, contentType: 'text/csv' };
          }

          const reportData = report as any;
          await this.emailService.send({
            to: schedule.recipients,
            subject: `Scheduled Report: ${schedule.name} — ${now.toLocaleDateString()}`,
            html: `
              <h2>${reportData.title || schedule.name}</h2>
              <p>Your scheduled report <strong>${schedule.name}</strong> has been generated.</p>
              <p>Report Type: ${schedule.reportType} | Format: ${fmt}</p>
              <p>Generated at: ${now.toISOString()}</p>
              ${reportData.summary ? `<pre>${JSON.stringify(reportData.summary, null, 2)}</pre>` : ''}
              <p><em>Full report is attached as ${attachment.filename}.</em></p>
            `,
            attachments: [attachment],
          });
          this.logger.log(`Report "${schedule.name}" emailed to ${schedule.recipients.length} recipient(s) as ${fmt}`);
        }

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
        this.logger.error(`Failed to execute scheduled report "${schedule.name}" (${schedule.id}): ${err.message}`);
      }
    }
  }

  private calculateNextRun(cronExpr: string): Date {
    return calculateNextRun(cronExpr);
  }

  // ─── Report Data Methods ──────────────────────────────────────

  async getAssetSummary(tenantId: string) {
    const [total, byType, byStatus, byDepartment, totalValue] = await this.prisma.withTenant(
      tenantId,
      async (tx) =>
        Promise.all([
          tx.asset.count({ where: { tenantId, deletedAt: null } }),
          tx.asset.groupBy({ by: ['category'], where: { tenantId, deletedAt: null }, _count: true }),
          tx.asset.groupBy({ by: ['status'], where: { tenantId, deletedAt: null }, _count: true }),
          tx.asset.groupBy({ by: ['departmentId'], where: { tenantId, deletedAt: null }, _count: true }),
          tx.asset.aggregate({ where: { tenantId, deletedAt: null }, _sum: { currentValue: true } }),
        ]),
    );
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
    const [assets, tickets, licenses, businessServices] = await Promise.all([
      this.getAssetSummary(tenantId),
      this.getTicketSummary(tenantId),
      this.getLicenseSummary(tenantId),
      this.getBusinessServiceHealth(tenantId),
    ]);
    return { assets, tickets, licenses, businessServices, generatedAt: new Date() };
  }

  async getBusinessServiceHealth(tenantId: string) {
    try {
      const services = await this.prisma.businessService.findMany({
        where: { tenantId },
        include: {
          assets: {
            include: {
              asset: { select: { id: true, name: true, status: true } },
            },
          },
        },
        take: 100,
      });
      return {
        total: services.length,
        healthy: services.filter((s) => s.status === 'HEALTHY').length,
        degraded: services.filter((s) => s.status === 'DEGRADED').length,
        outage: services.filter((s) => s.status === 'OUTAGE').length,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          criticality: s.criticality,
          assetCount: s.assets.length,
        })),
      };
    } catch {
      return { total: 0, healthy: 0, degraded: 0, outage: 0, services: [] };
    }
  }

  /**
   * Parameterized report builder runner — generates report with filters and optional email.
   */
  async runReport(
    tenantId: string,
    params: {
      reportType: string;
      startDate?: string;
      endDate?: string;
      format?: string;
      filters?: Record<string, any>;
      emailTo?: string[];
      name?: string;
    },
  ) {
    const report = await this.reportGenerator.generate(tenantId, params.reportType, {
      startDate: params.startDate,
      endDate: params.endDate,
      format: params.format,
      filters: params.filters,
    });

    let emailed = false;
    if (params.emailTo?.length) {
      const fmt = String(params.format || 'CSV').toUpperCase();
      const stamp = new Date().toISOString().split('T')[0];
      const baseName = `${params.reportType}_${stamp}`;
      let attachment: { filename: string; content: Buffer | string; contentType: string };
      if (fmt === 'PDF') {
        const buf = await this.reportGenerator.toPDF(report as any);
        attachment = { filename: `${baseName}.pdf`, content: buf, contentType: 'application/pdf' };
      } else if (fmt === 'XLSX' || fmt === 'XLS') {
        const buf = await this.reportGenerator.toXLSX(report as any);
        attachment = {
          filename: `${baseName}.xlsx`,
          content: buf,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      } else {
        const csv = this.reportGenerator.toCSV(report as any);
        attachment = { filename: `${baseName}.csv`, content: csv, contentType: 'text/csv' };
      }

      const reportData = report as any;
      await this.emailService.send({
        to: params.emailTo,
        subject: `Report: ${params.name || params.reportType} — ${new Date().toLocaleDateString()}`,
        html: `
          <h2>${reportData.title || params.reportType}</h2>
          <p>Generated at ${new Date().toISOString()}</p>
          ${reportData.summary ? `<pre>${JSON.stringify(reportData.summary, null, 2)}</pre>` : ''}
          <p><em>Full report attached as ${attachment.filename}.</em></p>
        `,
        attachments: [attachment],
      });
      emailed = true;
    }

    return { report, emailed, recipients: params.emailTo || [] };
  }

  async scheduleReport(
    tenantId: string,
    userId: string,
    body: {
      name: string;
      reportType: string;
      schedule: string;
      format?: string;
      recipients?: string[];
      filters?: any;
    },
  ) {
    return this.prisma.scheduledReport.create({
      data: {
        tenantId,
        name: body.name,
        reportType: body.reportType,
        schedule: body.schedule,
        format: body.format || 'CSV',
        recipients: body.recipients || [],
        filters: body.filters || {},
        createdById: userId,
        nextRunAt: this.calculateNextRun(body.schedule),
      },
    });
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

  /**
   * Saved custom report filters stored in tenant.settings.reportSavedFilters
   * (avoids a new migration that could conflict with in-flight EAM schema work).
   */
  async listSavedFilters(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as any) || {};
    return Array.isArray(settings.reportSavedFilters) ? settings.reportSavedFilters : [];
  }

  async saveFilter(
    tenantId: string,
    body: {
      id?: string;
      name: string;
      reportType: string;
      filters?: Record<string, any>;
      format?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = { ...((tenant?.settings as any) || {}) };
    const list: any[] = Array.isArray(settings.reportSavedFilters)
      ? [...settings.reportSavedFilters]
      : [];
    const id = body.id || `rf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id,
      name: body.name,
      reportType: body.reportType,
      filters: body.filters || {},
      format: body.format || 'CSV',
      updatedAt: new Date().toISOString(),
    };
    const idx = list.findIndex((f) => f.id === id);
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    settings.reportSavedFilters = list;
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings },
    });
    return entry;
  }

  async deleteSavedFilter(tenantId: string, filterId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = { ...((tenant?.settings as any) || {}) };
    const list: any[] = Array.isArray(settings.reportSavedFilters)
      ? settings.reportSavedFilters
      : [];
    settings.reportSavedFilters = list.filter((f) => f.id !== filterId);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings },
    });
    return { deleted: true };
  }
}
