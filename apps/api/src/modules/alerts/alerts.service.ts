import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

export interface Alert {
  id: string;
  tenantId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  title: string;
  message: string;
  source: string;
  sourceId?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
  metadata?: any;
}

export interface AlertRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  enabled: boolean;
  category: string;
  conditions: any;
  severity: string;
  channels: string[]; // ['in_app', 'email', 'webhook']
  cooldownMinutes: number;
  createdAt: Date;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  // In-memory stores
  private alerts: Map<string, Alert[]> = new Map();
  private alertRules: Map<string, AlertRule[]> = new Map();
  private alertIdCounter = 0;

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {
    // Seed default alert rules on first access
  }

  // ─── GET ALERTS ──────────────────────────────────────────
  async getAlerts(tenantId: string, query?: { severity?: string; acknowledged?: string; limit?: number }) {
    let alerts = this.alerts.get(tenantId) || [];
    if (query?.severity) alerts = alerts.filter(a => a.severity === query.severity);
    if (query?.acknowledged === 'true') alerts = alerts.filter(a => a.acknowledged);
    if (query?.acknowledged === 'false') alerts = alerts.filter(a => !a.acknowledged);
    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const limit = query?.limit || 100;
    return alerts.slice(0, limit);
  }

  // ─── DASHBOARD ──────────────────────────────────────────
  async getDashboard(tenantId: string) {
    const alerts = this.alerts.get(tenantId) || [];
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recent = alerts.filter(a => new Date(a.createdAt) > last24h);
    const weekAlerts = alerts.filter(a => new Date(a.createdAt) > last7d);
    const unack = alerts.filter(a => !a.acknowledged);

    // Group by severity
    const bySeverity: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const a of unack) bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const a of recent) byCategory[a.category] = (byCategory[a.category] || 0) + 1;

    // Trend (last 7 days by day)
    const trend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split('T')[0];
      const count = weekAlerts.filter(a => a.createdAt.startsWith(dayStr)).length;
      trend.push({ date: dayStr, count });
    }

    return {
      total: alerts.length,
      unacknowledged: unack.length,
      last24h: recent.length,
      last7d: weekAlerts.length,
      critical: bySeverity.CRITICAL,
      high: bySeverity.HIGH,
      bySeverity,
      byCategory,
      trend,
      recentAlerts: recent.slice(0, 10),
    };
  }

  // ─── CREATE ALERT ──────────────────────────────────────────
  async createAlert(tenantId: string, data: {
    severity: string; category: string; title: string;
    message: string; source: string; sourceId?: string; metadata?: any;
  }) {
    const alerts = this.alerts.get(tenantId) || [];
    const alert: Alert = {
      id: `alert-${++this.alertIdCounter}-${Date.now()}`,
      tenantId,
      severity: data.severity as any,
      category: data.category,
      title: data.title,
      message: data.message,
      source: data.source,
      sourceId: data.sourceId,
      acknowledged: false,
      resolved: false,
      createdAt: new Date().toISOString(),
      metadata: data.metadata,
    };
    alerts.unshift(alert);
    // Keep max 1000 alerts per tenant
    if (alerts.length > 1000) alerts.length = 1000;
    this.alerts.set(tenantId, alerts);
    this.eventBus.emit('alert.created', { tenantId, alert });
    this.logger.log(`[${data.severity}] ${data.title} — ${data.message}`);
    return alert;
  }

  // ─── ACKNOWLEDGE ──────────────────────────────────────────
  async acknowledgeAlert(tenantId: string, alertId: string, userId?: string) {
    const alerts = this.alerts.get(tenantId) || [];
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return null;
    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date().toISOString();
    return alert;
  }

  async acknowledgeAll(tenantId: string, userId?: string) {
    const alerts = this.alerts.get(tenantId) || [];
    let count = 0;
    for (const alert of alerts) {
      if (!alert.acknowledged) {
        alert.acknowledged = true;
        alert.acknowledgedBy = userId;
        alert.acknowledgedAt = new Date().toISOString();
        count++;
      }
    }
    return { acknowledged: count };
  }

  // ─── RESOLVE ──────────────────────────────────────────
  async resolveAlert(tenantId: string, alertId: string) {
    const alerts = this.alerts.get(tenantId) || [];
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return null;
    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    if (!alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
    }
    return alert;
  }

  // ─── ALERT RULES ──────────────────────────────────────────
  async getAlertRules(tenantId: string) {
    let rules = this.alertRules.get(tenantId);
    if (!rules) {
      // Seed defaults
      rules = [
        {
          id: 'rule-1', tenantId, name: 'Unauthorized USB Device',
          description: 'Alert when a new USB storage device is connected',
          enabled: true, category: 'USB_DEVICE', conditions: { type: 'USB_INSERTED' },
          severity: 'HIGH', channels: ['in_app'], cooldownMinutes: 5, createdAt: new Date(),
        },
        {
          id: 'rule-2', tenantId, name: 'Dangerous Port Opened',
          description: 'Alert when RDP (3389), Telnet (23), or FTP (21) ports are detected open',
          enabled: true, category: 'PORT_CHANGE', conditions: { ports: [3389, 23, 21, 445] },
          severity: 'CRITICAL', channels: ['in_app', 'email'], cooldownMinutes: 15, createdAt: new Date(),
        },
        {
          id: 'rule-3', tenantId, name: 'File Integrity Change',
          description: 'Alert when a monitored system file is modified (FIM)',
          enabled: true, category: 'FIM_CHANGE', conditions: { type: 'FILE_MODIFIED' },
          severity: 'CRITICAL', channels: ['in_app', 'email'], cooldownMinutes: 1, createdAt: new Date(),
        },
        {
          id: 'rule-4', tenantId, name: 'Agent Offline > 30min',
          description: 'Alert when an agent has not sent a heartbeat in 30+ minutes',
          enabled: true, category: 'AGENT_OFFLINE', conditions: { offlineMinutes: 30 },
          severity: 'MEDIUM', channels: ['in_app'], cooldownMinutes: 60, createdAt: new Date(),
        },
        {
          id: 'rule-5', tenantId, name: 'Disk Encryption Disabled',
          description: 'Alert when BitLocker/FileVault is not enabled on an endpoint',
          enabled: true, category: 'COMPLIANCE', conditions: { check: 'encryption_disabled' },
          severity: 'HIGH', channels: ['in_app'], cooldownMinutes: 60, createdAt: new Date(),
        },
        {
          id: 'rule-6', tenantId, name: 'Failed Login Attempts > 5',
          description: 'Alert when more than 5 failed logins are detected on an endpoint',
          enabled: true, category: 'SECURITY', conditions: { failedLoginsThreshold: 5 },
          severity: 'HIGH', channels: ['in_app', 'email'], cooldownMinutes: 30, createdAt: new Date(),
        },
        {
          id: 'rule-7', tenantId, name: 'New Software Installed',
          description: 'Alert when unauthorized software is detected on an endpoint',
          enabled: false, category: 'SOFTWARE_CHANGE', conditions: { type: 'NEW_SOFTWARE' },
          severity: 'MEDIUM', channels: ['in_app'], cooldownMinutes: 60, createdAt: new Date(),
        },
        {
          id: 'rule-8', tenantId, name: 'Firewall Disabled',
          description: 'Alert when the host firewall is found disabled',
          enabled: true, category: 'COMPLIANCE', conditions: { check: 'firewall_disabled' },
          severity: 'CRITICAL', channels: ['in_app', 'email'], cooldownMinutes: 30, createdAt: new Date(),
        },
      ];
      this.alertRules.set(tenantId, rules);
    }
    return rules;
  }

  async createAlertRule(tenantId: string, body: any) {
    const rules = await this.getAlertRules(tenantId);
    const rule: AlertRule = {
      id: `rule-${Date.now()}`,
      tenantId,
      name: body.name,
      description: body.description,
      enabled: body.enabled ?? true,
      category: body.category,
      conditions: body.conditions || {},
      severity: body.severity || 'MEDIUM',
      channels: body.channels || ['in_app'],
      cooldownMinutes: body.cooldownMinutes || 15,
      createdAt: new Date(),
    };
    rules.push(rule);
    return rule;
  }

  async toggleAlertRule(tenantId: string, ruleId: string) {
    const rules = await this.getAlertRules(tenantId);
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return null;
    rule.enabled = !rule.enabled;
    return rule;
  }

  async deleteAlertRule(tenantId: string, ruleId: string) {
    const rules = await this.getAlertRules(tenantId);
    const idx = rules.findIndex(r => r.id === ruleId);
    if (idx === -1) return { deleted: false };
    rules.splice(idx, 1);
    return { deleted: true };
  }

  // ─── EVALUATE HEARTBEAT ──────────────────────────────────
  // Called from the heartbeat handler to auto-generate alerts
  async evaluateHeartbeat(tenantId: string, agentId: string, systemInfo: any, hostname: string) {
    const rules = await this.getAlertRules(tenantId);
    const enabledRules = rules.filter(r => r.enabled);
    const security = systemInfo.security || {};

    for (const rule of enabledRules) {
      try {
        if (rule.category === 'COMPLIANCE' && rule.conditions?.check === 'encryption_disabled') {
          if (!security.encryptionEnabled) {
            await this.createAlert(tenantId, {
              severity: rule.severity, category: 'COMPLIANCE',
              title: `Disk encryption disabled on ${hostname}`,
              message: `${hostname} does not have BitLocker/FileVault/LUKS enabled`,
              source: 'Agent', sourceId: agentId,
            });
          }
        }

        if (rule.category === 'COMPLIANCE' && rule.conditions?.check === 'firewall_disabled') {
          if (!security.firewallEnabled) {
            await this.createAlert(tenantId, {
              severity: rule.severity, category: 'COMPLIANCE',
              title: `Firewall disabled on ${hostname}`,
              message: `${hostname} host firewall is not active`,
              source: 'Agent', sourceId: agentId,
            });
          }
        }

        if (rule.category === 'PORT_CHANGE') {
          const openPorts = (security.openPorts || []).map((p: any) => p.port || p);
          const dangerousPorts = rule.conditions?.ports || [3389, 23, 21, 445];
          const found = openPorts.filter((p: number) => dangerousPorts.includes(p));
          if (found.length > 0) {
            await this.createAlert(tenantId, {
              severity: rule.severity, category: 'PORT_CHANGE',
              title: `Dangerous ports open on ${hostname}`,
              message: `Ports ${found.join(', ')} detected on ${hostname}`,
              source: 'Agent', sourceId: agentId,
              metadata: { ports: found },
            });
          }
        }

        if (rule.category === 'SECURITY' && rule.conditions?.failedLoginsThreshold) {
          const failedLogins = security.failedLoginsCount || 0;
          if (failedLogins >= rule.conditions.failedLoginsThreshold) {
            await this.createAlert(tenantId, {
              severity: rule.severity, category: 'SECURITY',
              title: `${failedLogins} failed logins on ${hostname}`,
              message: `Possible brute-force attack detected on ${hostname}`,
              source: 'Agent', sourceId: agentId,
              metadata: { failedLogins },
            });
          }
        }

        if (rule.category === 'USB_DEVICE') {
          const usbDevices = systemInfo.usbDevices || [];
          if (usbDevices.length > 0) {
            // Only alert for storage-like devices
            const storageDevices = usbDevices.filter((d: any) =>
              d.name?.toLowerCase().includes('storage') ||
              d.name?.toLowerCase().includes('flash') ||
              d.name?.toLowerCase().includes('disk')
            );
            if (storageDevices.length > 0) {
              await this.createAlert(tenantId, {
                severity: rule.severity, category: 'USB_DEVICE',
                title: `USB storage device detected on ${hostname}`,
                message: `${storageDevices.length} USB storage device(s): ${storageDevices.map((d: any) => d.name).join(', ')}`,
                source: 'Agent', sourceId: agentId,
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

  // ─── NOTIFICATION CHANNELS ──────────────────────────────
  async getNotificationChannels(tenantId: string) {
    return [
      { id: 'in_app', name: 'In-App Notifications', type: 'in_app', enabled: true, config: {} },
      { id: 'email', name: 'Email Notifications', type: 'email', enabled: false, config: { smtpHost: '', smtpPort: 587, from: '' } },
      { id: 'webhook', name: 'Webhook (Slack/Teams)', type: 'webhook', enabled: false, config: { url: '', method: 'POST' } },
      { id: 'syslog', name: 'Syslog / SIEM', type: 'syslog', enabled: false, config: { host: '', port: 514, protocol: 'UDP' } },
    ];
  }
}
