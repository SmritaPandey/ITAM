import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import * as dgram from 'dgram';
import * as net from 'net';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

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

  async exportLogs(
    tenantId: string,
    format: 'json' | 'csv',
    filters: { startDate?: string; endDate?: string },
  ): Promise<string> {
    const where: any = { tenantId };
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
      if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      include: { actor: { select: { email: true } } },
    });
    const rows = logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      actor: log.actor?.email || null,
      actorIp: log.actorIp,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      outcome: log.outcome,
      severity: log.severity,
      module: log.module,
      hash: log.hash,
      prevHash: log.prevHash,
      metadata: log.metadata,
    }));
    if (format === 'json') return JSON.stringify(rows, null, 2);

    const columns = [
      'id', 'timestamp', 'actor', 'actorIp', 'action', 'resourceType', 'resourceId',
      'outcome', 'severity', 'module', 'hash', 'prevHash', 'metadata',
    ];
    const csv = (value: unknown) =>
      `"${String(value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : value).replace(/"/g, '""')}"`;
    return [
      columns.join(','),
      ...rows.map((row) => columns.map((column) => csv((row as any)[column])).join(',')),
    ].join('\n');
  }

  /** Nightly hash-chain verification across tenants with hashed audit logs. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async nightlyVerifyAllTenants() {
    if (process.env.DISABLE_CRON_JOBS === 'true') return;
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    for (const t of tenants) {
      const hashed = await this.prisma.auditLog.count({
        where: { tenantId: t.id, hash: { not: null } },
      });
      if (hashed === 0) continue;
      const result = await this.verifyChain(t.id);
      if (!result.valid) {
        this.logger.error(
          `Audit hash-chain BROKEN for tenant ${t.name} (${t.id}) at log ${result.brokenAt}`,
        );
        const admins = await this.prisma.user.findMany({
          where: {
            tenantId: t.id,
            status: 'ACTIVE',
            role: { name: { in: ['Tenant Admin', 'Platform Owner'] } },
          },
          select: { id: true },
          take: 5,
        });
        for (const admin of admins) {
          await this.prisma.notification.create({
            data: {
              tenantId: t.id,
              userId: admin.id,
              title: 'Audit log integrity failure',
              message: `Hash chain broken at audit log ${result.brokenAt}. Immediate investigation required.`,
              type: 'ALERT',
              module: 'audit',
            },
          });
        }
        await this.exportToSiem(t.id, { sinceHours: 1 }).catch(() => {});
      } else {
        this.logger.log(`Audit hash-chain OK for tenant ${t.name}: ${result.totalLogs} entries`);
      }
    }
  }

  /**
   * Export recent audit events to SIEM via syslog (UDP/TCP) and/or webhook channels.
   */
  async exportToSiem(tenantId: string, opts?: { sinceHours?: number; limit?: number }) {
    const sinceHours = opts?.sinceHours ?? 24;
    const limit = Math.min(opts?.limit || 200, 1000);
    const since = new Date(Date.now() - sinceHours * 3600_000);

    const channels = await this.prisma.notificationChannel.findMany({
      where: {
        tenantId,
        isActive: true,
        type: { in: ['SYSLOG', 'WEBHOOK', 'SIEM'] },
      },
    });

    const envSyslogHost = process.env.SIEM_SYSLOG_HOST;
    const envWebhook = process.env.SIEM_WEBHOOK_URL;

    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId, timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { actor: { select: { email: true, firstName: true, lastName: true } } },
    });

    const events = logs.map((l) => ({
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      timestamp: l.timestamp,
      actor: l.actor?.email,
      metadata: l.metadata,
      hash: l.hash,
    }));

    if (events.length === 0) {
      return { exported: 0, channels: 0, message: 'No audit events in window' };
    }

    let delivered = 0;
    const results: any[] = [];

    for (const ch of channels) {
      const cfg = (ch.config as any) || {};
      try {
        if (ch.type === 'SYSLOG' || ch.type === 'SIEM') {
          const host = cfg.host || envSyslogHost;
          const port = Number(cfg.port || 514);
          const protocol = (cfg.protocol || 'UDP').toUpperCase();
          if (!host) continue;
          for (const ev of events) {
            await this.sendSyslog(host, port, protocol, this.toCef(tenantId, ev));
            delivered++;
          }
          results.push({ channelId: ch.id, type: ch.type, ok: true, count: events.length });
        } else if (ch.type === 'WEBHOOK') {
          const url = cfg.url || envWebhook;
          if (!url) continue;
          await this.postJson(url, {
            source: 'qs-assets',
            tenantId,
            type: 'audit.export',
            exportedAt: new Date().toISOString(),
            events,
          });
          delivered += events.length;
          results.push({ channelId: ch.id, type: 'WEBHOOK', ok: true, count: events.length });
        }
      } catch (err: any) {
        this.logger.warn(`SIEM export via ${ch.id} failed: ${err?.message}`);
        results.push({ channelId: ch.id, ok: false, error: err?.message });
      }
    }

    if (channels.length === 0) {
      if (envSyslogHost) {
        const port = Number(process.env.SIEM_SYSLOG_PORT || 514);
        const protocol = (process.env.SIEM_SYSLOG_PROTOCOL || 'UDP').toUpperCase();
        for (const ev of events) {
          await this.sendSyslog(envSyslogHost, port, protocol, this.toCef(tenantId, ev));
          delivered++;
        }
        results.push({ channelId: 'env-syslog', ok: true, count: events.length });
      }
      if (envWebhook) {
        await this.postJson(envWebhook, {
          source: 'qs-assets',
          tenantId,
          type: 'audit.export',
          exportedAt: new Date().toISOString(),
          events,
        });
        delivered += events.length;
        results.push({ channelId: 'env-webhook', ok: true, count: events.length });
      }
    }

    return { exported: events.length, delivered, channels: results.length, results };
  }

  private toCef(tenantId: string, ev: any): string {
    const ts = new Date(ev.timestamp || Date.now()).toISOString();
    const action = String(ev.action || 'AUDIT').replace(/\|/g, '_');
    const msg = JSON.stringify({
      tenantId,
      resourceType: ev.resourceType,
      resourceId: ev.resourceId,
      actor: ev.actor,
      hash: ev.hash,
    }).slice(0, 1800);
    return `<134>1 ${ts} qs-assets CEF:0|NeurQ|QS Assets|1.0|${action}|${action}|5|msg=${msg}`;
  }

  private sendSyslog(host: string, port: number, protocol: string, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (protocol === 'TCP') {
        const socket = net.connect({ host, port }, () => {
          socket.write(message + '\n', () => {
            socket.end();
            resolve();
          });
        });
        socket.setTimeout(5000);
        socket.on('error', reject);
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('syslog TCP timeout'));
        });
      } else {
        const client = dgram.createSocket('udp4');
        const buf = Buffer.from(message);
        client.send(buf, 0, buf.length, port, host, (err) => {
          client.close();
          if (err) reject(err);
          else resolve();
        });
      }
    });
  }

  private postJson(urlStr: string, body: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const u = new URL(urlStr);
      const lib = u.protocol === 'https:' ? https : http;
      const payload = JSON.stringify(body);
      const req = lib.request(
        {
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + u.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'User-Agent': 'QS-Assets-SIEM/1.0',
          },
          timeout: 10000,
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Webhook HTTP ${res.statusCode}`));
            } else resolve();
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('webhook timeout'));
      });
      req.write(payload);
      req.end();
    });
  }
}
