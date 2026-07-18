import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

const DEFAULT_SEGMENTS = [
  { name: 'Corporate', vlanId: 10, subnet: '10.10.10.0/24', securityZone: 'TRUSTED', description: 'Full network access for compliant corporate devices' },
  { name: 'Guest', vlanId: 20, subnet: '10.10.20.0/24', securityZone: 'UNTRUSTED', description: 'Internet-only access for guest devices' },
  { name: 'IoT', vlanId: 30, subnet: '10.10.30.0/24', securityZone: 'RESTRICTED', description: 'Isolated segment for IoT devices' },
  { name: 'Quarantine', vlanId: 999, subnet: '10.10.99.0/24', securityZone: 'QUARANTINE', description: 'Remediation zone for non-compliant devices' },
  { name: 'Server', vlanId: 50, subnet: '10.10.50.0/24', securityZone: 'DMZ', description: 'Server and critical infrastructure segment' },
];

@Injectable()
export class NacService {
  private readonly logger = new Logger(NacService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async getDashboard(tenantId: string) {
    const { agents, activeQuarantines } = await this.prisma.withTenant(tenantId, async (tx) => {
      const agents = await tx.agent.findMany({
        where: { tenantId },
        select: { id: true, status: true, systemInfo: true, hostname: true },
      });
      const activeQuarantines = await tx.nacQuarantine.findMany({
        where: { tenantId, active: true },
        select: { agentId: true },
      });
      return { agents, activeQuarantines };
    });
    const quarantinedIds = new Set(activeQuarantines.map((q) => q.agentId));

    let compliant = 0,
      nonCompliant = 0,
      quarantined = 0,
      unknown = 0;
    const deviceTypes: Record<string, number> = {};

    for (const agent of agents) {
      const info = (agent.systemInfo as any) || {};
      const posture = this.assessPostureFromInfo(info);
      const isQuarantined = quarantinedIds.has(agent.id) || !!info._quarantined;
      if (isQuarantined) quarantined++;
      else if (posture.score >= 70) compliant++;
      else if (posture.score > 0) nonCompliant++;
      else unknown++;

      const osType = info.os?.platform || info.platform || 'Unknown';
      deviceTypes[osType] = (deviceTypes[osType] || 0) + 1;
    }

    const [policies, segs, radius] = await Promise.all([
      this.prisma.nacVlanPolicy.count({ where: { tenantId } }),
      this.prisma.nacNetworkSegment.count({ where: { tenantId } }),
      this.prisma.nacRadiusConfig.findUnique({ where: { tenantId } }),
    ]);

    return {
      totalDevices: agents.length,
      compliant,
      nonCompliant,
      quarantined,
      unknown,
      onlineDevices: agents.filter((a) => a.status === 'ONLINE').length,
      deviceTypes,
      vlanPolicies: policies,
      networkSegments: segs,
      radiusEnabled: !!radius?.enabled,
    };
  }

  async getDevicePosture(tenantId: string) {
    const { agents, policies, activeQuarantines } = await this.prisma.withTenant(
      tenantId,
      async (tx) => {
        const agents = await tx.agent.findMany({
          where: { tenantId },
          select: {
            id: true,
            status: true,
            systemInfo: true,
            hostname: true,
            lastHeartbeat: true,
            ipAddress: true,
          },
        });
        const policies = await tx.nacVlanPolicy.findMany({
          where: { tenantId },
          orderBy: { priority: 'asc' },
        });
        const activeQuarantines = await tx.nacQuarantine.findMany({
          where: { tenantId, active: true },
          select: { agentId: true },
        });
        return { agents, policies, activeQuarantines };
      },
    );
    const quarantinedIds = new Set(activeQuarantines.map((q) => q.agentId));

    return agents.map((agent) => {
      const info = (agent.systemInfo as any) || {};
      const posture = this.assessPostureFromInfo(info);
      const fingerprint = this.generateFingerprint(info);
      return {
        id: agent.id,
        agentId: agent.id,
        hostname: agent.hostname || agent.id.slice(0, 8),
        ip: agent.ipAddress || info.network?.primaryIp || 'Unknown',
        ipAddress: agent.ipAddress || info.network?.primaryIp || 'Unknown',
        status: agent.status,
        lastSeen: agent.lastHeartbeat,
        lastAssessed: agent.lastHeartbeat,
        quarantined: quarantinedIds.has(agent.id) || !!info._quarantined,
        posture,
        postureScore: posture.score,
        level: posture.level,
        checks: posture.checks.map((c: any) => ({
          name: c.name,
          passed: c.status === 'PASS',
          detail: c.detail,
        })),
        fingerprint,
        osFamily: fingerprint.osFamily,
        deviceType: fingerprint.deviceType,
        mac: fingerprint.macAddress,
        recommendedVlan: this.recommendVlan(policies, posture, info),
      };
    });
  }

  async reassessPosture(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const info = (agent.systemInfo as any) || {};
    const posture = this.assessPostureFromInfo(info);
    const policies = await this.prisma.nacVlanPolicy.findMany({ where: { tenantId }, orderBy: { priority: 'asc' } });
    return {
      agentId,
      posture,
      fingerprint: this.generateFingerprint(info),
      recommendedVlan: this.recommendVlan(policies, posture, info),
      assessedAt: new Date().toISOString(),
    };
  }

  private assessPostureFromInfo(rawInfo: any) {
    const info = {
      ...rawInfo,
      firewallStatus: rawInfo.firewallStatus || { enabled: rawInfo.security?.firewallEnabled || false },
      diskEncryption: rawInfo.diskEncryption || {
        enabled: rawInfo.security?.encryptionEnabled || false,
        method: rawInfo.security?.encryptionMethod || null,
      },
      antivirusStatus: rawInfo.antivirusStatus || {
        installed: rawInfo.antivirus?.installed || false,
        active: rawInfo.antivirus?.active || false,
      },
      screenLockPolicy: rawInfo.screenLockPolicy || {},
      listeningPorts: rawInfo.listeningPorts || rawInfo.security?.openPorts || [],
      pendingUpdates: rawInfo.pendingUpdates || { count: rawInfo.softwareUpdates?.pendingCount || 0 },
    };
    const checks: any[] = [];
    let score = 0;
    let maxScore = 0;

    maxScore += 10;
    if (info.lastSeen || info.hostname) {
      score += 10;
      checks.push({ name: 'Agent Active', status: 'PASS', weight: 10 });
    } else checks.push({ name: 'Agent Active', status: 'FAIL', weight: 10 });

    maxScore += 20;
    if (info.firewallStatus?.enabled) {
      score += 20;
      checks.push({ name: 'Firewall Enabled', status: 'PASS', weight: 20 });
    } else checks.push({ name: 'Firewall Enabled', status: 'FAIL', weight: 20 });

    maxScore += 20;
    if (info.diskEncryption?.enabled) {
      score += 20;
      checks.push({ name: 'Disk Encryption', status: 'PASS', weight: 20 });
    } else checks.push({ name: 'Disk Encryption', status: 'FAIL', weight: 20 });

    maxScore += 15;
    if (info.antivirusStatus?.active) {
      score += 15;
      checks.push({ name: 'Antivirus Active', status: 'PASS', weight: 15 });
    } else checks.push({ name: 'Antivirus Active', status: 'FAIL', weight: 15 });

    maxScore += 10;
    if (info.screenLockPolicy?.screenLockEnabled) {
      score += 10;
      checks.push({ name: 'Screen Lock', status: 'PASS', weight: 10 });
    } else checks.push({ name: 'Screen Lock', status: 'FAIL', weight: 10 });

    maxScore += 15;
    const dangerousPorts = [3389, 23, 21, 445, 139];
    const openPorts = (info.listeningPorts || []).map((p: any) => p.port || p);
    const hasDangerous = dangerousPorts.some((p) => openPorts.includes(p));
    if (!hasDangerous) {
      score += 15;
      checks.push({ name: 'No Risky Ports', status: 'PASS', weight: 15 });
    } else
      checks.push({
        name: 'No Risky Ports',
        status: 'FAIL',
        weight: 15,
        detail: `Risky ports open: ${openPorts.filter((p: number) => dangerousPorts.includes(p)).join(', ')}`,
      });

    maxScore += 10;
    const pendingCount = info.pendingUpdates?.count || 0;
    if (pendingCount <= 3) {
      score += 10;
      checks.push({ name: 'OS Patched', status: 'PASS', weight: 10 });
    } else checks.push({ name: 'OS Patched', status: 'FAIL', weight: 10, detail: `${pendingCount} pending updates` });

    const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const level = finalScore >= 80 ? 'COMPLIANT' : finalScore >= 50 ? 'PARTIALLY_COMPLIANT' : 'NON_COMPLIANT';

    return { score: finalScore, level, checks };
  }

  private generateFingerprint(info: any) {
    const os = info.os || info.operatingSystem || {};
    const hw = info.hardware || {};
    const net = info.network || {};
    return {
      osFamily: os.platform || 'Unknown',
      osVersion: os.release || os.version || 'Unknown',
      deviceType:
        hw.model?.includes('Virtual') || hw.manufacturer?.includes('VMware')
          ? 'Virtual Machine'
          : hw.model?.includes('MacBook')
            ? 'Laptop'
            : hw.model?.includes('iMac')
              ? 'Desktop'
              : hw.chassis || 'Workstation',
      manufacturer: hw.manufacturer || 'Unknown',
      model: hw.model || 'Unknown',
      macAddress: net.mac || net.primaryMac || 'Unknown',
      dhcpFingerprint: {
        vendorClass: net.dhcpVendorClass || 'N/A',
        options: net.dhcpOptions || [],
        hostname: info.hostname || 'Unknown',
      },
    };
  }

  async listVlanPolicies(tenantId: string) {
    return this.prisma.nacVlanPolicy.findMany({ where: { tenantId }, orderBy: { priority: 'asc' } });
  }

  async createVlanPolicy(tenantId: string, body: any) {
    const count = await this.prisma.nacVlanPolicy.count({ where: { tenantId } });
    return this.prisma.nacVlanPolicy.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description,
        vlanId: body.vlanId,
        vlanName: body.vlanName,
        conditions: body.conditions || {},
        action: body.action || 'ASSIGN',
        priority: body.priority || count + 1,
      },
    });
  }

  async deleteVlanPolicy(tenantId: string, id: string) {
    const existing = await this.prisma.nacVlanPolicy.findFirst({ where: { id, tenantId } });
    if (!existing) return { deleted: false };
    await this.prisma.nacVlanPolicy.delete({ where: { id } });
    return { deleted: true };
  }

  private recommendVlan(policies: any[], posture: any, info: any): any {
    if (posture.level === 'NON_COMPLIANT') {
      return { vlanId: 999, vlanName: 'Quarantine', reason: 'Device is non-compliant' };
    }
    if (posture.level === 'PARTIALLY_COMPLIANT') {
      return { vlanId: 100, vlanName: 'Restricted', reason: 'Device partially compliant — limited network access' };
    }

    for (const policy of policies) {
      if (this.matchesVlanConditions(policy.conditions, info, posture)) {
        return { vlanId: policy.vlanId, vlanName: policy.vlanName, reason: `Matched policy: ${policy.name}` };
      }
    }

    return { vlanId: 1, vlanName: 'Default', reason: 'Device is fully compliant' };
  }

  private matchesVlanConditions(conditions: any, info: any, posture: any): boolean {
    if (!conditions) return false;
    if (conditions.osFamily && info.os?.platform !== conditions.osFamily) return false;
    if (conditions.minPostureScore && posture.score < conditions.minPostureScore) return false;
    if (conditions.deviceType) {
      const fp = this.generateFingerprint(info);
      if (fp.deviceType !== conditions.deviceType) return false;
    }
    return true;
  }

  async getFingerprints(tenantId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true, systemInfo: true, hostname: true, ipAddress: true, status: true },
    });

    return agents.map((agent) => {
      const info = (agent.systemInfo as any) || {};
      return {
        agentId: agent.id,
        hostname: agent.hostname,
        ipAddress: agent.ipAddress || info.network?.primaryIp,
        status: agent.status,
        fingerprint: this.generateFingerprint(info),
      };
    });
  }

  async getRadiusConfig(tenantId: string) {
    const config = await this.prisma.nacRadiusConfig.findUnique({ where: { tenantId } });
    if (!config) {
      return {
        serverAddress: '',
        port: 1812,
        sharedSecret: '',
        authProtocol: 'EAP-TLS',
        enabled: false,
      };
    }
    return config;
  }

  async saveRadiusConfig(tenantId: string, body: any) {
    const config = await this.prisma.nacRadiusConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        serverAddress: body.serverAddress || '',
        port: body.port || 1812,
        sharedSecret: body.sharedSecret || '',
        authProtocol: body.authProtocol || 'EAP-TLS',
        enabled: !!body.enabled,
      },
      update: {
        serverAddress: body.serverAddress ?? undefined,
        port: body.port ?? undefined,
        sharedSecret: body.sharedSecret ?? undefined,
        authProtocol: body.authProtocol ?? undefined,
        enabled: body.enabled !== undefined ? !!body.enabled : undefined,
      },
    });
    this.logger.log(`RADIUS config saved for tenant ${tenantId}: ${config.enabled ? 'ENABLED' : 'DISABLED'}`);
    return config;
  }

  async listSegments(tenantId: string) {
    let segs = await this.prisma.nacNetworkSegment.findMany({ where: { tenantId }, orderBy: { vlanId: 'asc' } });
    if (segs.length === 0) {
      await this.prisma.nacNetworkSegment.createMany({
        data: DEFAULT_SEGMENTS.map((s) => ({ ...s, tenantId })),
      });
      segs = await this.prisma.nacNetworkSegment.findMany({ where: { tenantId }, orderBy: { vlanId: 'asc' } });
    }
    return segs;
  }

  async createSegment(tenantId: string, body: any) {
    return this.prisma.nacNetworkSegment.create({
      data: {
        tenantId,
        name: body.name,
        vlanId: body.vlanId,
        subnet: body.subnet,
        securityZone: body.securityZone,
        description: body.description,
      },
    });
  }

  async quarantineDevice(tenantId: string, agentId: string, reason: string) {
    const agent = await this.prisma.withTenant(tenantId, async (tx) => {
      const agent = await tx.agent.findFirst({ where: { id: agentId, tenantId } });
      if (!agent) throw new NotFoundException('Agent not found');

      const info = (agent.systemInfo as any) || {};
      // Keep agent JSON flags for backward-compatible agent polling; durable source of truth is NacQuarantine.
      info._quarantined = true;
      info._quarantineReason = reason;
      info._quarantinedAt = new Date().toISOString();

      if (!info._pendingActions) info._pendingActions = [];
      info._pendingActions.push({
        type: 'QUARANTINE_DEVICE',
        reason,
        allowServerOnly: true,
        timestamp: new Date().toISOString(),
      });

      await tx.agent.update({
        where: { id: agentId },
        data: { systemInfo: info },
      });

      await tx.nacQuarantine.updateMany({
        where: { tenantId, agentId, active: true },
        data: { active: false, clearedAt: new Date() },
      });
      await tx.nacQuarantine.create({
        data: { tenantId, agentId, reason, active: true },
      });

      return agent;
    });

    this.eventBus.emit('nac.device_quarantined', { tenantId, agentId, reason });

    const coa = await this.sendCoA(tenantId, agent, 'disconnect', reason);
    return {
      quarantined: true,
      agentId,
      reason,
      coa,
      agentFirewallQueued: true,
    };
  }

  /** Standalone CoA/disconnect without changing quarantine flag (manual NAC action). */
  async disconnectOrCoa(tenantId: string, agent: any, reason: string) {
    const coa = await this.sendCoA(tenantId, agent, 'disconnect', reason);
    return {
      ok: coa.ok || coa.mode === 'agent_firewall',
      agentId: agent.id,
      reason,
      coa,
      message: coa.detail,
    };
  }

  async unquarantineDevice(tenantId: string, agentId: string) {
    const agent = await this.prisma.withTenant(tenantId, async (tx) => {
      const agent = await tx.agent.findFirst({ where: { id: agentId, tenantId } });
      if (!agent) throw new NotFoundException('Agent not found');

      const info = (agent.systemInfo as any) || {};
      info._quarantined = false;
      delete info._quarantineReason;
      delete info._quarantinedAt;

      if (!info._pendingActions) info._pendingActions = [];
      info._pendingActions.push({
        type: 'UNQUARANTINE_DEVICE',
        timestamp: new Date().toISOString(),
      });

      await tx.agent.update({
        where: { id: agentId },
        data: { systemInfo: info },
      });

      await tx.nacQuarantine.updateMany({
        where: { tenantId, agentId, active: true },
        data: { active: false, clearedAt: new Date() },
      });

      return agent;
    });

    this.eventBus.emit('nac.device_unquarantined', { tenantId, agentId });
    const coa = await this.sendCoA(tenantId, agent, 'reconnect');
    return { unquarantined: true, agentId, coa };
  }

  /**
   * RADIUS CoA / switch webhook when NacRadiusConfig is present.
   * Falls back to agent firewall quarantine when CoA unavailable.
   */
  private async sendCoA(
    tenantId: string,
    agent: any,
    action: 'disconnect' | 'reconnect',
    reason?: string,
  ): Promise<{ attempted: boolean; ok: boolean; mode: string; detail?: string }> {
    const radius = await this.prisma.nacRadiusConfig.findUnique({ where: { tenantId } });
    if (!radius || !radius.enabled) {
      return {
        attempted: false,
        ok: false,
        mode: 'agent_firewall',
        detail: 'No enabled NacRadiusConfig — agent firewall quarantine only',
      };
    }

    // HTTP switch API: serverAddress is a full URL
    if (radius.serverAddress?.startsWith('http://') || radius.serverAddress?.startsWith('https://')) {
      try {
        const res = await fetch(`${radius.serverAddress.replace(/\/$/, '')}/coa/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${radius.sharedSecret || ''}`,
          },
          body: JSON.stringify({
            action: action === 'disconnect' ? 'coa-disconnect' : 'coa-reconnect',
            tenantId,
            agentId: agent.id,
            hostname: agent.hostname,
            ip: agent.ipAddress,
            macAddress: (agent.systemInfo as any)?.network?.mac || (agent.systemInfo as any)?.macAddress,
            reason,
          }),
        });
        return { attempted: true, ok: res.ok, mode: 'switch_webhook', detail: `HTTP ${res.status}` };
      } catch (err: any) {
        return { attempted: true, ok: false, mode: 'switch_webhook', detail: err.message };
      }
    }

    // Optional CoA webhook stored in sharedSecret as JSON {"coaWebhookUrl":"...","apiKey":"..."}
    let webhookUrl: string | undefined;
    let apiKey: string | undefined;
    try {
      const parsed = JSON.parse(radius.sharedSecret || '{}');
      if (parsed?.coaWebhookUrl) {
        webhookUrl = parsed.coaWebhookUrl;
        apiKey = parsed.apiKey;
      }
    } catch {
      // sharedSecret is a RADIUS secret, not JSON
    }
    webhookUrl = webhookUrl || process.env.NAC_COA_WEBHOOK_URL;

    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            action: action === 'disconnect' ? 'coa-disconnect' : 'coa-reconnect',
            tenantId,
            agentId: agent.id,
            hostname: agent.hostname,
            macAddress: (agent.systemInfo as any)?.macAddress,
            reason,
            nasIp: radius.serverAddress,
            radiusPort: radius.port,
          }),
        });
        return {
          attempted: true,
          ok: res.ok,
          mode: 'webhook',
          detail: `HTTP ${res.status}`,
        };
      } catch (err: any) {
        return {
          attempted: true,
          ok: false,
          mode: 'webhook',
          detail: err.message,
        };
      }
    }

    return {
      attempted: false,
      ok: false,
      mode: 'agent_firewall',
      detail: `RADIUS ${radius.serverAddress}:${radius.port} enabled but no CoA webhook URL configured — agent firewall used`,
    };
  }
}
