import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

const DEFAULT_RULES = [
  {
    name: 'Unauthorized USB Device',
    description: 'Alert when a new USB storage device is connected',
    enabled: true,
    category: 'USB_DEVICE',
    conditions: { type: 'USB_INSERTED' },
    severity: 'HIGH',
    channels: ['in_app'],
    cooldownMinutes: 5,
  },
  {
    name: 'Dangerous Port Opened',
    description: 'Alert when RDP (3389), Telnet (23), or FTP (21) ports are detected open',
    enabled: true,
    category: 'PORT_CHANGE',
    conditions: { ports: [3389, 23, 21, 445] },
    severity: 'CRITICAL',
    channels: ['in_app', 'email'],
    cooldownMinutes: 15,
  },
  {
    name: 'File Integrity Change',
    description: 'Alert when a monitored system file is modified (FIM)',
    enabled: true,
    category: 'FIM_CHANGE',
    conditions: { type: 'FILE_MODIFIED' },
    severity: 'CRITICAL',
    channels: ['in_app', 'email'],
    cooldownMinutes: 1,
  },
  {
    name: 'Agent Offline > 30min',
    description: 'Alert when an agent has not sent a heartbeat in 30+ minutes',
    enabled: true,
    category: 'AGENT_OFFLINE',
    conditions: { offlineMinutes: 30 },
    severity: 'MEDIUM',
    channels: ['in_app'],
    cooldownMinutes: 60,
  },
  {
    name: 'Disk Encryption Disabled',
    description: 'Alert when BitLocker/FileVault is not enabled on an endpoint',
    enabled: true,
    category: 'COMPLIANCE',
    conditions: { check: 'encryption_disabled' },
    severity: 'HIGH',
    channels: ['in_app'],
    cooldownMinutes: 60,
  },
  {
    name: 'Failed Login Attempts > 5',
    description: 'Alert when more than 5 failed logins are detected on an endpoint',
    enabled: true,
    category: 'SECURITY',
    conditions: { failedLoginsThreshold: 5 },
    severity: 'HIGH',
    channels: ['in_app', 'email'],
    cooldownMinutes: 30,
  },
  {
    name: 'New Software Installed',
    description: 'Alert when unauthorized software is detected on an endpoint',
    enabled: false,
    category: 'SOFTWARE_CHANGE',
    conditions: { type: 'NEW_SOFTWARE' },
    severity: 'MEDIUM',
    channels: ['in_app'],
    cooldownMinutes: 60,
  },
  {
    name: 'Firewall Disabled',
    description: 'Alert when the host firewall is found disabled',
    enabled: true,
    category: 'COMPLIANCE',
    conditions: { check: 'firewall_disabled' },
    severity: 'CRITICAL',
    channels: ['in_app', 'email'],
    cooldownMinutes: 30,
  },
];

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  private mapAlert(a: any) {
    return {
      id: a.id,
      tenantId: a.tenantId,
      severity: a.severity,
      category: a.category,
      title: a.title,
      message: a.message,
      source: a.source,
      sourceId: a.sourceId,
      acknowledged: a.acknowledged,
      acknowledgedBy: a.acknowledgedBy,
      acknowledgedAt: a.acknowledgedAt?.toISOString?.() ?? a.acknowledgedAt,
      resolved: a.resolved,
      resolvedAt: a.resolvedAt?.toISOString?.() ?? a.resolvedAt,
      createdAt: a.createdAt?.toISOString?.() ?? a.createdAt,
      metadata: a.metadata,
    };
  }

  private mapRule(r: any) {
    return {
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      description: r.description,
      enabled: r.enabled,
      category: r.category,
      conditions: r.conditions,
      severity: r.severity,
      channels: Array.isArray(r.channels) ? r.channels : r.channels,
      cooldownMinutes: r.cooldownMinutes,
      createdAt: r.createdAt,
    };
  }

  async getAlerts(tenantId: string, query?: { severity?: string; acknowledged?: string; limit?: number }) {
    const where: any = { tenantId };
    if (query?.severity) where.severity = query.severity;
    if (query?.acknowledged === 'true') where.acknowledged = true;
    if (query?.acknowledged === 'false') where.acknowledged = false;

    const alerts = await this.prisma.alertEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query?.limit || 100,
    });
    return alerts.map((a) => this.mapAlert(a));
  }

  async getDashboard(tenantId: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, unack, recent, weekAlerts, unackList] = await Promise.all([
      this.prisma.alertEvent.count({ where: { tenantId } }),
      this.prisma.alertEvent.count({ where: { tenantId, acknowledged: false } }),
      this.prisma.alertEvent.findMany({
        where: { tenantId, createdAt: { gte: last24h } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.alertEvent.findMany({
        where: { tenantId, createdAt: { gte: last7d } },
        select: { createdAt: true },
      }),
      this.prisma.alertEvent.findMany({
        where: { tenantId, acknowledged: false },
        select: { severity: true },
      }),
    ]);

    const bySeverity: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const a of unackList) bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;

    const byCategory: Record<string, number> = {};
    for (const a of recent) byCategory[a.category] = (byCategory[a.category] || 0) + 1;

    const trend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split('T')[0];
      const count = weekAlerts.filter((a) => a.createdAt.toISOString().startsWith(dayStr)).length;
      trend.push({ date: dayStr, count });
    }

    return {
      total,
      unacknowledged: unack,
      last24h: recent.length,
      last7d: weekAlerts.length,
      critical: bySeverity.CRITICAL,
      high: bySeverity.HIGH,
      bySeverity,
      byCategory,
      trend,
      recentAlerts: recent.slice(0, 10).map((a) => this.mapAlert(a)),
    };
  }

  async createAlert(
    tenantId: string,
    data: {
      severity: string;
      category: string;
      title: string;
      message: string;
      source: string;
      sourceId?: string;
      metadata?: any;
    },
  ) {
    // Cooldown: skip duplicate title+sourceId within 5 minutes
    if (data.sourceId) {
      const recent = await this.prisma.alertEvent.findFirst({
        where: {
          tenantId,
          sourceId: data.sourceId,
          title: data.title,
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });
      if (recent) return this.mapAlert(recent);
    }

    const alert = await this.prisma.alertEvent.create({
      data: {
        tenantId,
        severity: data.severity,
        category: data.category,
        title: data.title,
        message: data.message,
        source: data.source,
        sourceId: data.sourceId,
        metadata: data.metadata || {},
      },
    });
    const mapped = this.mapAlert(alert);
    this.eventBus.emitDomainEvent({
      type: 'alert.created',
      tenantId,
      payload: { alert: mapped },
      timestamp: new Date(),
    });
    this.logger.log(`[${data.severity}] ${data.title} — ${data.message}`);
    return mapped;
  }

  async acknowledgeAlert(tenantId: string, alertId: string, userId?: string) {
    const existing = await this.prisma.alertEvent.findFirst({ where: { id: alertId, tenantId } });
    if (!existing) return null;
    const alert = await this.prisma.alertEvent.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
    return this.mapAlert(alert);
  }

  async acknowledgeAll(tenantId: string, userId?: string) {
    const result = await this.prisma.alertEvent.updateMany({
      where: { tenantId, acknowledged: false },
      data: {
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
    return { acknowledged: result.count };
  }

  async resolveAlert(tenantId: string, alertId: string) {
    const existing = await this.prisma.alertEvent.findFirst({ where: { id: alertId, tenantId } });
    if (!existing) return null;
    const alert = await this.prisma.alertEvent.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        acknowledged: true,
        acknowledgedAt: existing.acknowledgedAt || new Date(),
      },
    });
    return this.mapAlert(alert);
  }

  async getAlertRules(tenantId: string) {
    let rules = await this.prisma.alertRule.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    if (rules.length === 0) {
      await this.prisma.alertRule.createMany({
        data: DEFAULT_RULES.map((r) => ({
          tenantId,
          name: r.name,
          description: r.description,
          enabled: r.enabled,
          category: r.category,
          conditions: r.conditions,
          severity: r.severity,
          channels: r.channels,
          cooldownMinutes: r.cooldownMinutes,
        })),
      });
      rules = await this.prisma.alertRule.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    }
    return rules.map((r) => this.mapRule(r));
  }

  async createAlertRule(tenantId: string, body: any) {
    const rule = await this.prisma.alertRule.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description,
        enabled: body.enabled ?? true,
        category: body.category,
        conditions: body.conditions || {},
        severity: body.severity || 'MEDIUM',
        channels: body.channels || ['in_app'],
        cooldownMinutes: body.cooldownMinutes || 15,
      },
    });
    return this.mapRule(rule);
  }

  async toggleAlertRule(tenantId: string, ruleId: string) {
    const existing = await this.prisma.alertRule.findFirst({ where: { id: ruleId, tenantId } });
    if (!existing) return null;
    const rule = await this.prisma.alertRule.update({
      where: { id: ruleId },
      data: { enabled: !existing.enabled },
    });
    return this.mapRule(rule);
  }

  async deleteAlertRule(tenantId: string, ruleId: string) {
    const existing = await this.prisma.alertRule.findFirst({ where: { id: ruleId, tenantId } });
    if (!existing) return { deleted: false };
    await this.prisma.alertRule.delete({ where: { id: ruleId } });
    return { deleted: true };
  }

  async evaluateHeartbeat(tenantId: string, agentId: string, systemInfo: any, hostname: string) {
    const rules = await this.getAlertRules(tenantId);
    const enabledRules = rules.filter((r) => r.enabled);
    const security = systemInfo.security || {};

    for (const rule of enabledRules) {
      try {
        if (rule.category === 'COMPLIANCE' && rule.conditions?.check === 'encryption_disabled') {
          if (!security.encryptionEnabled) {
            await this.createAlert(tenantId, {
              severity: rule.severity,
              category: 'COMPLIANCE',
              title: `Disk encryption disabled on ${hostname}`,
              message: `${hostname} does not have BitLocker/FileVault/LUKS enabled`,
              source: 'Agent',
              sourceId: agentId,
            });
          }
        }

        if (rule.category === 'COMPLIANCE' && rule.conditions?.check === 'firewall_disabled') {
          if (!security.firewallEnabled) {
            await this.createAlert(tenantId, {
              severity: rule.severity,
              category: 'COMPLIANCE',
              title: `Firewall disabled on ${hostname}`,
              message: `${hostname} host firewall is not active`,
              source: 'Agent',
              sourceId: agentId,
            });
          }
        }

        if (rule.category === 'PORT_CHANGE') {
          const openPorts = (security.openPorts || []).map((p: any) => p.port || p);
          const dangerousPorts = rule.conditions?.ports || [3389, 23, 21, 445];
          const found = openPorts.filter((p: number) => dangerousPorts.includes(p));
          if (found.length > 0) {
            await this.createAlert(tenantId, {
              severity: rule.severity,
              category: 'PORT_CHANGE',
              title: `Dangerous ports open on ${hostname}`,
              message: `Ports ${found.join(', ')} detected on ${hostname}`,
              source: 'Agent',
              sourceId: agentId,
              metadata: { ports: found },
            });
          }
        }

        if (rule.category === 'SECURITY' && rule.conditions?.failedLoginsThreshold) {
          const failedLogins = security.failedLoginsCount || 0;
          if (failedLogins >= rule.conditions.failedLoginsThreshold) {
            await this.createAlert(tenantId, {
              severity: rule.severity,
              category: 'SECURITY',
              title: `${failedLogins} failed logins on ${hostname}`,
              message: `Possible brute-force attack detected on ${hostname}`,
              source: 'Agent',
              sourceId: agentId,
              metadata: { failedLogins },
            });
          }
        }

        if (rule.category === 'USB_DEVICE') {
          const usbDevices = systemInfo.usbDevices || [];
          if (usbDevices.length > 0) {
            const storageDevices = usbDevices.filter(
              (d: any) =>
                d.name?.toLowerCase().includes('storage') ||
                d.name?.toLowerCase().includes('flash') ||
                d.name?.toLowerCase().includes('disk'),
            );
            if (storageDevices.length > 0) {
              await this.createAlert(tenantId, {
                severity: rule.severity,
                category: 'USB_DEVICE',
                title: `USB storage device detected on ${hostname}`,
                message: `${storageDevices.length} USB storage device(s): ${storageDevices.map((d: any) => d.name).join(', ')}`,
                source: 'Agent',
                sourceId: agentId,
                metadata: { devices: storageDevices },
              });
            }
          }
        }
      } catch (err) {
        this.logger.error(`Alert rule ${rule.name} evaluation failed: ${err}`);
      }
    }
  }

  async getNotificationChannels(tenantId: string) {
    const channels = await this.prisma.notificationChannel.findMany({ where: { tenantId } });
    const defaults = [
      { id: 'in_app', name: 'In-App Notifications', type: 'in_app', enabled: true, config: {} },
      { id: 'email', name: 'Email Notifications', type: 'email', enabled: false, config: { smtpHost: '', smtpPort: 587, from: '' } },
      { id: 'webhook', name: 'Webhook (Slack/Teams)', type: 'webhook', enabled: false, config: { url: '', method: 'POST' } },
      { id: 'syslog', name: 'Syslog / SIEM', type: 'syslog', enabled: false, config: { host: '', port: 514, protocol: 'UDP' } },
    ];
    if (channels.length === 0) return defaults;
    return [
      defaults[0],
      ...channels.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type.toLowerCase(),
        enabled: c.isActive,
        config: c.config,
      })),
    ];
  }
}
