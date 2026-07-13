import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate a report and return data in a format ready for PDF/CSV/XLSX export
   */
  async generate(tenantId: string, type: string, options?: { startDate?: string; endDate?: string; format?: string; filters?: any }) {
    const startDate = options?.startDate ? new Date(options.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options?.endDate ? new Date(options.endDate) : new Date();

    switch (type) {
      case 'assets': return this.generateAssetReport(tenantId, startDate, endDate, options?.filters);
      case 'tickets': return this.generateTicketReport(tenantId, startDate, endDate, options?.filters);
      case 'licenses': return this.generateLicenseReport(tenantId);
      case 'network': return this.generateNetworkReport(tenantId);
      case 'patches': return this.generatePatchReport(tenantId);
      case 'audit': return this.generateAuditReport(tenantId, startDate, endDate);
      case 'executive': return this.generateExecutiveReport(tenantId, startDate, endDate);
      case 'compliance': return this.generateComplianceReport(tenantId);
      case 'business-services': return this.generateBusinessServiceReport(tenantId);
      default: return { error: `Unknown report type: ${type}` };
    }
  }

  private async generateAssetReport(tenantId: string, start: Date, end: Date, filters?: any) {
    const where: any = { tenantId, deletedAt: null };
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;
    if (filters?.departmentId) where.departmentId = filters.departmentId;

    const assets = await this.prisma.asset.findMany({
      where,
      include: {
        assetType: { select: { name: true } },
        department: { select: { name: true } },
        site: { select: { name: true } },
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { name: 'asc' },
    }) as any[];

    const totalValue = assets.reduce((s: number, a: any) => s + (a.currentValue?.toNumber?.() || Number(a.currentValue) || 0), 0);
    const byStatus = this.groupBy(assets, 'status');
    const byCategory = this.groupBy(assets, 'category');

    return {
      title: 'Asset Inventory Report',
      generatedAt: new Date().toISOString(),
      summary: {
        totalAssets: assets.length,
        totalValue,
        activeAssets: assets.filter((a: any) => a.status === 'ACTIVE').length,
        retiredAssets: assets.filter((a: any) => a.status === 'RETIRED').length,
        byStatus: Object.entries(byStatus).map(([k, v]) => ({ status: k, count: (v as any[]).length })),
        byCategory: Object.entries(byCategory).map(([k, v]) => ({ category: k, count: (v as any[]).length })),
      },
      headers: ['Asset Tag', 'Name', 'Type', 'Category', 'Status', 'Department', 'Site', 'Assigned To', 'Purchase Value', 'Current Value', 'Procurement Date'],
      rows: assets.map((a: any) => [
        a.assetTag || '', a.name, a.assetType?.name || '', a.category || '',
        a.status, a.department?.name || '', a.site?.name || '',
        a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : '',
        a.purchasePrice?.toString() || '0', a.currentValue?.toString() || '0',
        a.procurementDate ? new Date(a.procurementDate).toLocaleDateString() : '',
      ]),
    };
  }

  private async generateTicketReport(tenantId: string, start: Date, end: Date, filters?: any) {
    const where: any = { tenantId, createdAt: { gte: start, lte: end } };
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.departmentId) where.departmentId = filters.departmentId;

    const tickets = await this.prisma.ticket.findMany({
      where,
      include: {
        requester: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as any[];

    const resolved = tickets.filter((t: any) => t.resolvedAt);
    let avgResolutionHours = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((s: number, t: any) => s + (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()), 0);
      avgResolutionHours = Math.round(totalMs / resolved.length / 3600000);
    }

    return {
      title: 'Ticket SLA Performance Report',
      generatedAt: new Date().toISOString(),
      dateRange: { from: start.toISOString(), to: end.toISOString() },
      summary: {
        total: tickets.length,
        open: tickets.filter((t: any) => ['OPEN', 'IN_PROGRESS', 'NEW'].includes(t.status)).length,
        resolved: resolved.length,
        avgResolutionHours,
        byPriority: this.countBy(tickets, 'priority'),
        byStatus: this.countBy(tickets, 'status'),
      },
      headers: ['Ticket #', 'Subject', 'Priority', 'Status', 'Category', 'Requester', 'Assignee', 'Created', 'Resolved', 'Resolution (hrs)'],
      rows: tickets.map((t: any) => [
        t.ticketNumber, t.subject, t.priority, t.status, t.category || '',
        t.requester ? `${t.requester.firstName} ${t.requester.lastName}` : '',
        t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : 'Unassigned',
        new Date(t.createdAt).toLocaleString(),
        t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : '',
        t.resolvedAt ? String(Math.round((new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)) : '',
      ]),
    };
  }

  private async generateLicenseReport(tenantId: string) {
    const licenses = await this.prisma.license.findMany({ where: { tenantId }, orderBy: { softwareName: 'asc' } });
    const totalSpend = licenses.reduce((s, l) => s + (l.renewalCost?.toNumber() || l.purchaseCost?.toNumber() || 0), 0);

    return {
      title: 'License Utilization Report',
      generatedAt: new Date().toISOString(),
      summary: {
        total: licenses.length,
        compliant: licenses.filter(l => l.usedSeats <= l.totalSeats).length,
        overused: licenses.filter(l => l.usedSeats > l.totalSeats).length,
        expiring30d: licenses.filter(l => l.expiryDate && (new Date(l.expiryDate).getTime() - Date.now()) / 86400000 <= 30 && (new Date(l.expiryDate).getTime() - Date.now()) > 0).length,
        totalSpend,
      },
      headers: ['Software', 'Vendor', 'Type', 'Total Seats', 'Used Seats', 'Utilization %', 'Status', 'Compliance', 'Expiry Date', 'Cost'],
      rows: licenses.map(l => [
        l.softwareName, l.vendor || '', l.licenseType, String(l.totalSeats), String(l.usedSeats),
        l.totalSeats > 0 ? `${Math.round((l.usedSeats / l.totalSeats) * 100)}%` : 'N/A',
        l.status, l.complianceStatus || 'UNKNOWN',
        l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : 'Perpetual',
        l.renewalCost?.toString() || l.purchaseCost?.toString() || '0',
      ]),
    };
  }

  private async generateNetworkReport(tenantId: string) {
    const devices = await this.prisma.monitoredDevice.findMany({
      where: { tenantId, type: 'NETWORK_DEVICE' },
      orderBy: { name: 'asc' },
    });

    return {
      title: 'Network Health Report',
      generatedAt: new Date().toISOString(),
      summary: {
        total: devices.length,
        online: devices.filter(d => d.status === 'ONLINE').length,
        offline: devices.filter(d => d.status === 'OFFLINE').length,
        warning: devices.filter(d => d.status === 'WARNING').length,
        avgLatency: Math.round(devices.reduce((s, d) => s + ((d.metrics as any)?.latency || 0), 0) / Math.max(devices.length, 1)),
      },
      headers: ['Device', 'IP Address', 'Type', 'Status', 'CPU %', 'Memory %', 'Latency (ms)', 'Uptime', 'Last Seen'],
      rows: devices.map(d => {
        const m = (d.metrics as any) || {};
        const c = (d.config as any) || {};
        return [
          d.name, d.ipAddress || '', c.deviceType || '', d.status,
          String(m.cpu || 0), String(m.memory || 0), String(m.latency || 0),
          m.sysUpTime ? this.formatUptime(m.sysUpTime) : '',
          d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'Never',
        ];
      }),
    };
  }

  private async generatePatchReport(tenantId: string) {
    const patches = await this.prisma.patch.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });

    return {
      title: 'Patch Compliance Report',
      generatedAt: new Date().toISOString(),
      summary: {
        total: patches.length,
        deployed: patches.filter(p => p.status === 'Deployed').length,
        pending: patches.filter(p => p.status === 'Pending').length,
        failed: patches.filter(p => p.status === 'Failed').length,
        criticalPending: patches.filter(p => p.severity === 'Critical' && p.status !== 'Deployed').length,
      },
      headers: ['Patch ID', 'Title', 'Severity', 'Status', 'Category', 'Affected Assets', 'Deployed Date'],
      rows: patches.map(p => [
        p.patchId, p.title, p.severity, p.status, p.category,
        String(p.affectedAssets), p.deployedDate ? new Date(p.deployedDate).toLocaleDateString() : '',
      ]),
    };
  }

  private async generateAuditReport(tenantId: string, start: Date, end: Date) {
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId, timestamp: { gte: start, lte: end } },
      orderBy: { timestamp: 'desc' },
      take: 5000,
    });

    return {
      title: 'Audit Trail Report',
      generatedAt: new Date().toISOString(),
      dateRange: { from: start.toISOString(), to: end.toISOString() },
      summary: { totalEntries: logs.length },
      headers: ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'Hash'],
      rows: logs.map(l => [
        new Date(l.timestamp).toLocaleString(),
        l.actorId || 'System', l.action, l.resourceType || '', l.resourceId || '',
        l.actorIp || '', l.hash || '',
      ]),
    };
  }

  private async generateExecutiveReport(tenantId: string, start: Date, end: Date) {
    const [assets, tickets, licenses, network, patches, services] = await Promise.all([
      this.generateAssetReport(tenantId, start, end),
      this.generateTicketReport(tenantId, start, end),
      this.generateLicenseReport(tenantId),
      this.generateNetworkReport(tenantId),
      this.generatePatchReport(tenantId),
      this.generateBusinessServiceReport(tenantId),
    ]);

    const sections = {
      assets: assets.summary,
      tickets: tickets.summary,
      licenses: licenses.summary,
      network: network.summary,
      patches: patches.summary,
      businessServices: services.summary,
    };

    return {
      title: 'Executive Dashboard Report',
      generatedAt: new Date().toISOString(),
      summary: {
        totalAssets: (assets.summary as any)?.totalAssets ?? 0,
        openTickets: (tickets.summary as any)?.open ?? (tickets.summary as any)?.totalTickets ?? 0,
        licenseSpend: (licenses.summary as any)?.totalSpend ?? 0,
        servicesHealthy: (services.summary as any)?.healthy ?? 0,
        servicesTotal: (services.summary as any)?.total ?? 0,
      },
      sections,
      headers: ['KPI', 'Value'],
      rows: [
        ['Total Assets', String((assets.summary as any)?.totalAssets ?? 0)],
        ['Active Assets', String((assets.summary as any)?.activeAssets ?? 0)],
        ['Open / Total Tickets', `${(tickets.summary as any)?.open ?? '—'} / ${(tickets.summary as any)?.totalTickets ?? (tickets.summary as any)?.total ?? '—'}`],
        ['License Spend', String((licenses.summary as any)?.totalSpend ?? 0)],
        ['Network Devices', String((network.summary as any)?.totalDevices ?? (network.summary as any)?.total ?? 0)],
        ['Patch Compliance %', String((patches.summary as any)?.compliancePct ?? (patches.summary as any)?.overall ?? '—')],
        ['Business Services Healthy', `${(services.summary as any)?.healthy ?? 0}/${(services.summary as any)?.total ?? 0}`],
        ['Period Start', start.toISOString().slice(0, 10)],
        ['Period End', end.toISOString().slice(0, 10)],
      ],
    };
  }

  private async generateComplianceReport(tenantId: string) {
    const [policies, changes] = await Promise.all([
      this.prisma.endpointPolicy.findMany({ where: { tenantId } }),
      this.prisma.endpointChange.findMany({
        where: { tenantId, status: 'VIOLATION' },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    return {
      title: 'Endpoint Compliance Report',
      generatedAt: new Date().toISOString(),
      summary: {
        totalPolicies: policies.length, activePolicies: policies.filter(p => p.isActive).length,
        totalViolations: changes.length,
        criticalViolations: changes.filter(c => c.severity === 'CRITICAL').length,
      },
      headers: ['Date', 'Hostname', 'Category', 'Severity', 'Summary', 'Status'],
      rows: changes.map(c => [
        new Date(c.createdAt).toLocaleString(), c.hostname || '', c.category, c.severity, c.summary, c.status,
      ]),
    };
  }

  /**
   * Generate CSV string from report data
   */
  toCSV(report: any): string {
    if (!report.headers || !report.rows) return '';
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [report.headers.join(','), ...report.rows.map((r: string[]) => r.map(escape).join(','))].join('\n');
  }

  /**
   * Generate XLSX buffer from report data
   */
  async toXLSX(report: any): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(report.title || 'Report');

    // Header row
    const headerRow = sheet.addRow(report.headers);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.font = { bold: true, color: { argb: 'FFF1F5F9' } };

    // Data rows
    for (const row of report.rows) {
      sheet.addRow(row);
    }

    // Auto-width columns
    sheet.columns.forEach((col: any) => {
      let maxLen = 10;
      col.eachCell?.((cell: any) => { maxLen = Math.max(maxLen, String(cell.value || '').length); });
      col.width = Math.min(maxLen + 2, 40);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate PDF buffer from report data (summary + tabular rows).
   */
  async toPDF(report: any): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    doc.on('data', (c: Buffer) => chunks.push(c));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(16).fillColor('#0f172a').text(report.title || 'QS Assets Report', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor('#64748b');
    doc.text(`Generated: ${report.generatedAt || new Date().toISOString()}`);
    doc.moveDown(0.6);

    if (report.summary && typeof report.summary === 'object') {
      doc.fontSize(11).fillColor('#0f172a').text('Summary', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#334155');
      for (const [key, value] of Object.entries(report.summary)) {
        if (value == null || typeof value === 'object') continue;
        doc.text(`${key}: ${String(value)}`);
      }
      doc.moveDown(0.6);
    }

    const headers: string[] = Array.isArray(report.headers) ? report.headers : [];
    const rows: any[][] = Array.isArray(report.rows) ? report.rows : [];
    if (headers.length > 0) {
      doc.fontSize(11).fillColor('#0f172a').text('Details', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor('#475569');
      // Compact header line
      doc.text(headers.slice(0, 8).join(' | '), { width: 520 });
      doc.moveDown(0.2);
      for (const row of rows.slice(0, 200)) {
        if (doc.y > 720) doc.addPage();
        doc.text(
          (row || []).slice(0, 8).map((c: any) => String(c ?? '')).join(' | '),
          { width: 520 },
        );
      }
      if (rows.length > 200) {
        doc.moveDown(0.4);
        doc.text(`… ${rows.length - 200} more rows truncated`);
      }
    }

    doc.end();
    return done;
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private groupBy(items: any[], key: string): Record<string, any[]> {
    return items.reduce((acc, item) => {
      const val = item[key] || 'Other';
      if (!acc[val]) acc[val] = [];
      acc[val].push(item);
      return acc;
    }, {});
  }

  private countBy(items: any[], key: string): Array<{ value: string; count: number }> {
    const map: Record<string, number> = {};
    items.forEach(i => { const v = i[key] || 'Other'; map[v] = (map[v] || 0) + 1; });
    return Object.entries(map).map(([value, count]) => ({ value, count }));
  }

  private formatUptime(ticks: number): string {
    const seconds = Math.floor(ticks / 100);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  private async generateBusinessServiceReport(tenantId: string) {
    const services = await this.prisma.businessService.findMany({
      where: { tenantId },
      include: {
        assets: {
          include: { asset: { select: { name: true, status: true, assetTag: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      title: 'Business Service Health Report',
      generatedAt: new Date().toISOString(),
      summary: {
        total: services.length,
        healthy: services.filter((s) => s.status === 'HEALTHY').length,
        degraded: services.filter((s) => s.status === 'DEGRADED').length,
        outage: services.filter((s) => s.status === 'OUTAGE').length,
      },
      headers: ['Service', 'Status', 'Criticality', 'Assets', 'Asset Details'],
      rows: services.map((s) => [
        s.name,
        s.status,
        s.criticality,
        String(s.assets.length),
        s.assets
          .map((l) => `${l.asset?.name || '?'}(${l.asset?.status || '?'})`)
          .join('; '),
      ]),
    };
  }
}
