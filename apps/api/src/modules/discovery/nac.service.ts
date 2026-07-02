import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

export interface VlanPolicy {
  id: string;
  name: string;
  description?: string;
  vlanId: number;
  vlanName: string;
  conditions: any;
  action: string;
  priority: number;
  tenantId: string;
  createdAt: Date;
}

export interface NetworkSegment {
  id: string;
  name: string;
  vlanId: number;
  subnet: string;
  securityZone: string;
  description?: string;
  tenantId: string;
}

@Injectable()
export class NacService {
  private readonly logger = new Logger(NacService.name);
  // In-memory stores (production would use DB tables)
  private vlanPolicies: Map<string, VlanPolicy[]> = new Map();
  private segments: Map<string, NetworkSegment[]> = new Map();
  private radiusConfigs: Map<string, any> = new Map();

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  // ─── DASHBOARD ──────────────────────────────────────────
  async getDashboard(tenantId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true, status: true, systemInfo: true, hostname: true },
    });

    let compliant = 0, nonCompliant = 0, quarantined = 0, unknown = 0;
    const deviceTypes: Record<string, number> = {};

    for (const agent of agents) {
      const info = (agent.systemInfo as any) || {};
      const posture = this.assessPostureFromInfo(info);
      if (info._quarantined) quarantined++;
      else if (posture.score >= 70) compliant++;
      else if (posture.score > 0) nonCompliant++;
      else unknown++;

      // Device type fingerprinting
      const osType = info.os?.platform || info.platform || 'Unknown';
      deviceTypes[osType] = (deviceTypes[osType] || 0) + 1;
    }

    const policies = this.vlanPolicies.get(tenantId) || [];
    const segs = this.segments.get(tenantId) || [];
    const radius = this.radiusConfigs.get(tenantId);

    return {
      totalDevices: agents.length,
      compliant,
      nonCompliant,
      quarantined,
      unknown,
      onlineDevices: agents.filter(a => a.status === 'ONLINE').length,
      deviceTypes,
      vlanPolicies: policies.length,
      networkSegments: segs.length,
      radiusEnabled: !!radius?.enabled,
    };
  }

  // ─── DEVICE POSTURE ─────────────────────────────────────
  async getDevicePosture(tenantId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true, status: true, systemInfo: true, hostname: true, lastHeartbeat: true, ipAddress: true },
    });

    return agents.map(agent => {
      const info = (agent.systemInfo as any) || {};
      const posture = this.assessPostureFromInfo(info);
      return {
        agentId: agent.id,
        hostname: (agent as any).hostname || agent.id.slice(0, 8),
        ipAddress: (agent as any).ipAddress || info.network?.primaryIp || 'Unknown',
        status: agent.status,
        lastSeen: agent.lastHeartbeat,
        quarantined: !!info._quarantined,
        posture,
        fingerprint: this.generateFingerprint(info),
        recommendedVlan: this.recommendVlan(tenantId, posture, info),
      };
    });
  }

  async reassessPosture(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const info = (agent.systemInfo as any) || {};
    return {
      agentId,
      posture: this.assessPostureFromInfo(info),
      fingerprint: this.generateFingerprint(info),
      recommendedVlan: this.recommendVlan(tenantId, this.assessPostureFromInfo(info), info),
      assessedAt: new Date().toISOString(),
    };
  }

  private assessPostureFromInfo(rawInfo: any) {
    // Normalize agent telemetry paths
    const info = {
      ...rawInfo,
      firewallStatus: rawInfo.firewallStatus || { enabled: rawInfo.security?.firewallEnabled || false },
      diskEncryption: rawInfo.diskEncryption || { enabled: rawInfo.security?.encryptionEnabled || false, method: rawInfo.security?.encryptionMethod || null },
      antivirusStatus: rawInfo.antivirusStatus || { installed: rawInfo.antivirus?.installed || false, active: rawInfo.antivirus?.active || false },
      screenLockPolicy: rawInfo.screenLockPolicy || {},
      listeningPorts: rawInfo.listeningPorts || rawInfo.security?.openPorts || [],
      pendingUpdates: rawInfo.pendingUpdates || { count: rawInfo.softwareUpdates?.pendingCount || 0 },
    };
    const checks: any[] = [];
    let score = 0;
    let maxScore = 0;

    // 1. Agent online
    maxScore += 10;
    if (info.lastSeen || info.hostname) { score += 10; checks.push({ name: 'Agent Active', status: 'PASS', weight: 10 }); }
    else checks.push({ name: 'Agent Active', status: 'FAIL', weight: 10 });

    // 2. Firewall
    maxScore += 20;
    if (info.firewallStatus?.enabled) { score += 20; checks.push({ name: 'Firewall Enabled', status: 'PASS', weight: 20 }); }
    else checks.push({ name: 'Firewall Enabled', status: 'FAIL', weight: 20 });

    // 3. Disk Encryption
    maxScore += 20;
    if (info.diskEncryption?.enabled) { score += 20; checks.push({ name: 'Disk Encryption', status: 'PASS', weight: 20 }); }
    else checks.push({ name: 'Disk Encryption', status: 'FAIL', weight: 20 });

    // 4. Antivirus
    maxScore += 15;
    if (info.antivirusStatus?.active) { score += 15; checks.push({ name: 'Antivirus Active', status: 'PASS', weight: 15 }); }
    else checks.push({ name: 'Antivirus Active', status: 'FAIL', weight: 15 });

    // 5. Screen lock
    maxScore += 10;
    if (info.screenLockPolicy?.screenLockEnabled) { score += 10; checks.push({ name: 'Screen Lock', status: 'PASS', weight: 10 }); }
    else checks.push({ name: 'Screen Lock', status: 'FAIL', weight: 10 });

    // 6. No unauthorized ports
    maxScore += 15;
    const dangerousPorts = [3389, 23, 21, 445, 139]; // RDP, Telnet, FTP, SMB
    const openPorts = (info.listeningPorts || []).map((p: any) => p.port);
    const hasDangerous = dangerousPorts.some(p => openPorts.includes(p));
    if (!hasDangerous) { score += 15; checks.push({ name: 'No Risky Ports', status: 'PASS', weight: 15 }); }
    else checks.push({ name: 'No Risky Ports', status: 'FAIL', weight: 15, detail: `Risky ports open: ${openPorts.filter((p: number) => dangerousPorts.includes(p)).join(', ')}` });

    // 7. OS patched
    maxScore += 10;
    const pendingCount = info.pendingUpdates?.count || 0;
    if (pendingCount <= 3) { score += 10; checks.push({ name: 'OS Patched', status: 'PASS', weight: 10 }); }
    else checks.push({ name: 'OS Patched', status: 'FAIL', weight: 10, detail: `${pendingCount} pending updates` });

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
      deviceType: hw.model?.includes('Virtual') || hw.manufacturer?.includes('VMware') ? 'Virtual Machine' :
                  hw.model?.includes('MacBook') ? 'Laptop' :
                  hw.model?.includes('iMac') ? 'Desktop' :
                  hw.chassis || 'Workstation',
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

  // ─── VLAN POLICIES ──────────────────────────────────────
  async listVlanPolicies(tenantId: string) {
    return this.vlanPolicies.get(tenantId) || [];
  }

  async createVlanPolicy(tenantId: string, body: any) {
    const policies = this.vlanPolicies.get(tenantId) || [];
    const newPolicy: VlanPolicy = {
      id: `vlan-${Date.now()}`,
      name: body.name,
      description: body.description,
      vlanId: body.vlanId,
      vlanName: body.vlanName,
      conditions: body.conditions,
      action: body.action || 'ASSIGN',
      priority: body.priority || policies.length + 1,
      tenantId,
      createdAt: new Date(),
    };
    policies.push(newPolicy);
    this.vlanPolicies.set(tenantId, policies);
    return newPolicy;
  }

  async deleteVlanPolicy(tenantId: string, id: string) {
    const policies = (this.vlanPolicies.get(tenantId) || []).filter(p => p.id !== id);
    this.vlanPolicies.set(tenantId, policies);
    return { deleted: true };
  }

  private recommendVlan(tenantId: string, posture: any, info: any): any {
    const policies = this.vlanPolicies.get(tenantId) || [];

    // Auto-assign based on posture level
    if (posture.level === 'NON_COMPLIANT') {
      return { vlanId: 999, vlanName: 'Quarantine', reason: 'Device is non-compliant' };
    }
    if (posture.level === 'PARTIALLY_COMPLIANT') {
      return { vlanId: 100, vlanName: 'Restricted', reason: 'Device partially compliant — limited network access' };
    }

    // Check custom policies
    for (const policy of policies.sort((a, b) => a.priority - b.priority)) {
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

  // ─── FINGERPRINTS ───────────────────────────────────────
  async getFingerprints(tenantId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true, systemInfo: true, hostname: true, ipAddress: true, status: true },
    });

    return agents.map(agent => {
      const info = (agent.systemInfo as any) || {};
      return {
        agentId: agent.id,
        hostname: (agent as any).hostname,
        ipAddress: (agent as any).ipAddress || info.network?.primaryIp,
        status: agent.status,
        fingerprint: this.generateFingerprint(info),
      };
    });
  }

  // ─── RADIUS ─────────────────────────────────────────────
  async getRadiusConfig(tenantId: string) {
    return this.radiusConfigs.get(tenantId) || {
      serverAddress: '',
      port: 1812,
      sharedSecret: '',
      authProtocol: 'EAP-TLS',
      enabled: false,
    };
  }

  async saveRadiusConfig(tenantId: string, body: any) {
    const config = {
      ...body,
      tenantId,
      updatedAt: new Date().toISOString(),
    };
    this.radiusConfigs.set(tenantId, config);
    this.logger.log(`RADIUS config saved for tenant ${tenantId}: ${body.enabled ? 'ENABLED' : 'DISABLED'}`);
    return config;
  }

  // ─── SEGMENTS ───────────────────────────────────────────
  async listSegments(tenantId: string) {
    const segs = this.segments.get(tenantId) || [];
    if (segs.length === 0) {
      // Seed default segments
      const defaults: NetworkSegment[] = [
        { id: 'seg-1', name: 'Corporate', vlanId: 10, subnet: '10.10.10.0/24', securityZone: 'TRUSTED', description: 'Full network access for compliant corporate devices', tenantId },
        { id: 'seg-2', name: 'Guest', vlanId: 20, subnet: '10.10.20.0/24', securityZone: 'UNTRUSTED', description: 'Internet-only access for guest devices', tenantId },
        { id: 'seg-3', name: 'IoT', vlanId: 30, subnet: '10.10.30.0/24', securityZone: 'RESTRICTED', description: 'Isolated segment for IoT devices', tenantId },
        { id: 'seg-4', name: 'Quarantine', vlanId: 999, subnet: '10.10.99.0/24', securityZone: 'QUARANTINE', description: 'Remediation zone for non-compliant devices', tenantId },
        { id: 'seg-5', name: 'Server', vlanId: 50, subnet: '10.10.50.0/24', securityZone: 'DMZ', description: 'Server and critical infrastructure segment', tenantId },
      ];
      this.segments.set(tenantId, defaults);
      return defaults;
    }
    return segs;
  }

  async createSegment(tenantId: string, body: any) {
    const segs = this.segments.get(tenantId) || [];
    const seg: NetworkSegment = {
      id: `seg-${Date.now()}`,
      name: body.name,
      vlanId: body.vlanId,
      subnet: body.subnet,
      securityZone: body.securityZone,
      description: body.description,
      tenantId,
    };
    segs.push(seg);
    this.segments.set(tenantId, segs);
    return seg;
  }

  // ─── QUARANTINE ─────────────────────────────────────────
  async quarantineDevice(tenantId: string, agentId: string, reason: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');

    const info = (agent.systemInfo as any) || {};
    info._quarantined = true;
    info._quarantineReason = reason;
    info._quarantinedAt = new Date().toISOString();

    // Queue quarantine action for agent
    if (!info._pendingActions) info._pendingActions = [];
    info._pendingActions.push({
      type: 'QUARANTINE_DEVICE',
      reason,
      allowServerOnly: true,
      timestamp: new Date().toISOString(),
    });

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { systemInfo: info },
    });

    this.eventBus.emit('nac.device_quarantined', { tenantId, agentId, reason });
    return { quarantined: true, agentId, reason };
  }

  async unquarantineDevice(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');

    const info = (agent.systemInfo as any) || {};
    info._quarantined = false;
    delete info._quarantineReason;
    delete info._quarantinedAt;

    // Queue unquarantine action
    if (!info._pendingActions) info._pendingActions = [];
    info._pendingActions.push({
      type: 'UNQUARANTINE_DEVICE',
      timestamp: new Date().toISOString(),
    });

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { systemInfo: info },
    });

    this.eventBus.emit('nac.device_unquarantined', { tenantId, agentId });
    return { unquarantined: true, agentId };
  }
}
