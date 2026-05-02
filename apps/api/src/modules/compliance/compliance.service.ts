import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { SshScanner } from '../../common/scanners/ssh.scanner';

interface ChangeDetection {
  category: string;
  changeType: string;
  summary: string;
  previousValue: any;
  newValue: any;
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // DIFF ENGINE — Compares two system snapshots
  // ═══════════════════════════════════════════════════════════════

  diffSnapshots(prev: any, curr: any): ChangeDetection[] {
    const changes: ChangeDetection[] = [];
    if (!prev || !curr) return changes;

    // 1. RAM Change
    const prevRam = prev?.hardware?.totalRamMb || 0;
    const currRam = curr?.hardware?.totalRamMb || 0;
    if (prevRam > 0 && currRam > 0 && Math.abs(prevRam - currRam) > 100) {
      changes.push({
        category: 'RAM_CHANGE',
        changeType: 'MODIFIED',
        summary: `RAM changed from ${Math.round(prevRam / 1024)}GB to ${Math.round(currRam / 1024)}GB`,
        previousValue: { totalRamMb: prevRam },
        newValue: { totalRamMb: currRam },
      });
    }

    // 2. Disk Changes
    const prevDisks = prev?.hardware?.diskDrives || [];
    const currDisks = curr?.hardware?.diskDrives || [];
    if (prevDisks.length > 0 && currDisks.length !== prevDisks.length) {
      changes.push({
        category: 'DISK_CHANGE',
        changeType: currDisks.length > prevDisks.length ? 'ADDED' : 'REMOVED',
        summary: `Disk count changed from ${prevDisks.length} to ${currDisks.length}`,
        previousValue: prevDisks,
        newValue: currDisks,
      });
    }

    // 3. Network Adapter Changes
    const prevNets = (prev?.network?.interfaces || []).map((n: any) => n.mac).filter(Boolean).sort();
    const currNets = (curr?.network?.interfaces || []).map((n: any) => n.mac).filter(Boolean).sort();
    const addedNets = currNets.filter((m: string) => !prevNets.includes(m));
    const removedNets = prevNets.filter((m: string) => !currNets.includes(m));
    for (const mac of addedNets) {
      const iface = (curr?.network?.interfaces || []).find((n: any) => n.mac === mac);
      changes.push({
        category: 'NETWORK_CHANGE',
        changeType: 'ADDED',
        summary: `New network adapter detected: ${iface?.name || mac} (${iface?.ip || 'no IP'})`,
        previousValue: null,
        newValue: iface,
      });
    }
    for (const mac of removedNets) {
      const iface = (prev?.network?.interfaces || []).find((n: any) => n.mac === mac);
      changes.push({
        category: 'NETWORK_CHANGE',
        changeType: 'REMOVED',
        summary: `Network adapter removed: ${iface?.name || mac}`,
        previousValue: iface,
        newValue: null,
      });
    }

    // 4. Software Changes
    const prevSw = (prev?.software || []).map((s: any) => s.name?.toLowerCase()).filter(Boolean);
    const currSw = (curr?.software || []).map((s: any) => s.name?.toLowerCase()).filter(Boolean);
    const installed = currSw.filter((s: string) => !prevSw.includes(s));
    const removed = prevSw.filter((s: string) => !currSw.includes(s));
    for (const name of installed) {
      const sw = (curr?.software || []).find((s: any) => s.name?.toLowerCase() === name);
      changes.push({
        category: 'SOFTWARE_INSTALL',
        changeType: 'ADDED',
        summary: `Software installed: ${sw?.name || name}${sw?.version ? ` v${sw.version}` : ''}`,
        previousValue: null,
        newValue: sw,
      });
    }
    for (const name of removed) {
      const sw = (prev?.software || []).find((s: any) => s.name?.toLowerCase() === name);
      changes.push({
        category: 'SOFTWARE_REMOVE',
        changeType: 'REMOVED',
        summary: `Software removed: ${sw?.name || name}`,
        previousValue: sw,
        newValue: null,
      });
    }

    // 5. USB Device Changes
    const prevUsb = (prev?.usbDevices || []).map((u: any) => u.serial || u.name).filter(Boolean);
    const currUsb = (curr?.usbDevices || []).map((u: any) => u.serial || u.name).filter(Boolean);
    const addedUsb = currUsb.filter((u: string) => !prevUsb.includes(u));
    for (const id of addedUsb) {
      const device = (curr?.usbDevices || []).find((u: any) => (u.serial || u.name) === id);
      changes.push({
        category: 'USB_DEVICE',
        changeType: 'ADDED',
        summary: `USB device connected: ${device?.name || id}`,
        previousValue: null,
        newValue: device,
      });
    }

    // 6. CPU Change (unusual but detectable in VMs)
    const prevCpu = prev?.hardware?.cpuCores || 0;
    const currCpu = curr?.hardware?.cpuCores || 0;
    if (prevCpu > 0 && currCpu > 0 && prevCpu !== currCpu) {
      changes.push({
        category: 'HARDWARE_CHANGE',
        changeType: 'MODIFIED',
        summary: `CPU cores changed from ${prevCpu} to ${currCpu}`,
        previousValue: { cpuCores: prevCpu, cpuModel: prev?.hardware?.cpuModel },
        newValue: { cpuCores: currCpu, cpuModel: curr?.hardware?.cpuModel },
      });
    }

    // 7. Firewall/Encryption changes
    if (prev?.security && curr?.security) {
      if (prev.security.firewallEnabled === true && curr.security.firewallEnabled === false) {
        changes.push({
          category: 'HARDWARE_CHANGE',
          changeType: 'MODIFIED',
          summary: 'Firewall was DISABLED',
          previousValue: { firewallEnabled: true },
          newValue: { firewallEnabled: false },
        });
      }
      if (prev.security.encryptionEnabled === true && curr.security.encryptionEnabled === false) {
        changes.push({
          category: 'HARDWARE_CHANGE',
          changeType: 'MODIFIED',
          summary: 'Disk encryption was DISABLED',
          previousValue: { encryptionEnabled: true },
          newValue: { encryptionEnabled: false },
        });
      }
    }

    return changes;
  }

  // ═══════════════════════════════════════════════════════════════
  // POLICY EVALUATION
  // ═══════════════════════════════════════════════════════════════

  async evaluateAndRecord(
    tenantId: string,
    agentId: string,
    hostname: string,
    ipAddress: string,
    platform: string,
    changes: ChangeDetection[],
  ) {
    if (changes.length === 0) return [];

    const policies = await this.prisma.endpointPolicy.findMany({
      where: { tenantId, isActive: true },
    });

    const results = [];

    for (const change of changes) {
      // Find matching policy
      const matchedPolicy = policies.find(p => {
        if (p.category !== change.category) return false;
        // Check scope
        const scope = p.scope as any;
        if (scope?.platforms?.length && !scope.platforms.includes(platform)) return false;
        if (scope?.hostnames?.length) {
          const matches = scope.hostnames.some((pattern: string) => {
            if (pattern.endsWith('*')) return hostname.startsWith(pattern.slice(0, -1));
            return hostname === pattern;
          });
          if (!matches) return false;
        }
        return true;
      });

      const severity = matchedPolicy?.severity || 'INFO';
      const action = matchedPolicy?.action || 'ALERT_ONLY';
      let status = 'AUTO_ALLOWED';

      if (matchedPolicy) {
        if (action === 'REQUIRE_APPROVAL') status = 'PENDING_REVIEW';
        else if (action === 'AUTO_BLOCK') status = 'VIOLATION';
        else status = 'AUTO_ALLOWED';
      }

      const record = await this.prisma.endpointChange.create({
        data: {
          tenantId,
          agentId,
          policyId: matchedPolicy?.id || null,
          category: change.category,
          changeType: change.changeType,
          severity,
          summary: change.summary,
          previousValue: change.previousValue || undefined,
          newValue: change.newValue || undefined,
          status,
          hostname,
          ipAddress,
          platform,
        },
      });

      results.push(record);

      // Create notification for admins on warnings/criticals
      if (severity !== 'INFO') {
        const admins = await this.prisma.user.findMany({
          where: {
            tenantId,
            role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
            status: 'ACTIVE',
          },
          select: { id: true },
        });

        const notifType = severity === 'CRITICAL' ? 'ALERT' : 'WARNING';
        for (const admin of admins) {
          await this.prisma.notification.create({
            data: {
              tenantId,
              userId: admin.id,
              title: `${severity}: ${change.summary}`,
              message: `Agent "${hostname}" (${ipAddress}) — ${change.summary}. Status: ${status === 'PENDING_REVIEW' ? 'Needs approval' : status}.`,
              type: notifType,
              module: 'compliance',
              resourceId: record.id,
            },
          });
        }

        this.eventBus.emitDomainEvent({
          type: 'compliance.change_detected',
          tenantId,
          payload: { changeId: record.id, category: change.category, severity, hostname, summary: change.summary },
          timestamp: new Date(),
        });
      }

      this.logger.log(`[${severity}] ${hostname}: ${change.summary} → ${status}`);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // HEARTBEAT INTEGRATION — Called from discovery service
  // ═══════════════════════════════════════════════════════════════

  async processHeartbeat(tenantId: string, agentId: string, agent: any, newSnapshot: any) {
    // Get or create baseline
    const baseline = await this.prisma.agentBaseline.findUnique({
      where: { agentId },
    });

    if (!baseline) {
      // First heartbeat — create baseline, no diff
      await this.prisma.agentBaseline.create({
        data: { tenantId, agentId, snapshot: newSnapshot, snapshotAt: new Date() },
      });
      this.logger.log(`Baseline created for agent ${agent.hostname}`);
      return [];
    }

    // Diff against baseline
    const changes = this.diffSnapshots(baseline.snapshot as any, newSnapshot);

    // Evaluate against policies and record
    const results = await this.evaluateAndRecord(
      tenantId, agentId, agent.hostname, agent.ipAddress, agent.platform, changes,
    );

    // Update baseline
    await this.prisma.agentBaseline.update({
      where: { agentId },
      data: { snapshot: newSnapshot, snapshotAt: new Date() },
    });

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // POLICY CRUD
  // ═══════════════════════════════════════════════════════════════

  async listPolicies(tenantId: string) {
    return this.prisma.endpointPolicy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { changes: true } } },
    });
  }

  async createPolicy(tenantId: string, userId: string, data: {
    name: string; description?: string; category: string; severity?: string;
    action?: string; matchPattern?: any; scope?: any;
  }) {
    return this.prisma.endpointPolicy.create({
      data: {
        tenantId,
        createdById: userId,
        name: data.name,
        description: data.description,
        category: data.category,
        severity: data.severity || 'WARNING',
        action: data.action || 'ALERT_ONLY',
        matchPattern: data.matchPattern || {},
        scope: data.scope || {},
      },
    });
  }

  async updatePolicy(id: string, tenantId: string, data: any) {
    const policy = await this.prisma.endpointPolicy.findFirst({ where: { id, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    return this.prisma.endpointPolicy.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.severity !== undefined && { severity: data.severity }),
        ...(data.action !== undefined && { action: data.action }),
        ...(data.matchPattern !== undefined && { matchPattern: data.matchPattern }),
        ...(data.scope !== undefined && { scope: data.scope }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async deletePolicy(id: string, tenantId: string) {
    const policy = await this.prisma.endpointPolicy.findFirst({ where: { id, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    return this.prisma.endpointPolicy.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHANGES — List, Approve, Reject
  // ═══════════════════════════════════════════════════════════════

  async listChanges(tenantId: string, filters?: {
    status?: string; severity?: string; category?: string; agentId?: string;
    page?: number; limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.category) where.category = filters.category;
    if (filters?.agentId) where.agentId = filters.agentId;

    const [data, total] = await Promise.all([
      this.prisma.endpointChange.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { policy: { select: { name: true, action: true } } },
      }),
      this.prisma.endpointChange.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async approveChange(id: string, tenantId: string, userId: string, note?: string) {
    const change = await this.prisma.endpointChange.findFirst({ where: { id, tenantId } });
    if (!change) throw new NotFoundException('Change not found');
    return this.prisma.endpointChange.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: userId, reviewedAt: new Date(), reviewNote: note || null },
    });
  }

  async rejectChange(id: string, tenantId: string, userId: string, note?: string) {
    const change = await this.prisma.endpointChange.findFirst({ where: { id, tenantId } });
    if (!change) throw new NotFoundException('Change not found');
    return this.prisma.endpointChange.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: userId, reviewedAt: new Date(), reviewNote: note || null },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD STATS
  // ═══════════════════════════════════════════════════════════════

  async getDashboard(tenantId: string) {
    const [total, pending, approved, rejected, violations, bySeverity, byCategory, recentChanges] = await Promise.all([
      this.prisma.endpointChange.count({ where: { tenantId } }),
      this.prisma.endpointChange.count({ where: { tenantId, status: 'PENDING_REVIEW' } }),
      this.prisma.endpointChange.count({ where: { tenantId, status: 'APPROVED' } }),
      this.prisma.endpointChange.count({ where: { tenantId, status: 'REJECTED' } }),
      this.prisma.endpointChange.count({ where: { tenantId, status: 'VIOLATION' } }),
      this.prisma.endpointChange.groupBy({ by: ['severity'], where: { tenantId }, _count: true }),
      this.prisma.endpointChange.groupBy({ by: ['category'], where: { tenantId }, _count: true }),
      this.prisma.endpointChange.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { policy: { select: { name: true } } },
      }),
    ]);

    const activePolicies = await this.prisma.endpointPolicy.count({ where: { tenantId, isActive: true } });
    const agentCount = await this.prisma.agent.count({ where: { tenantId } });
    const compliantAgents = await this.prisma.agent.count({
      where: {
        tenantId,
        changes: { none: { status: { in: ['PENDING_REVIEW', 'VIOLATION'] } } },
      },
    });

    return {
      total, pending, approved, rejected, violations,
      activePolicies, agentCount, compliantAgents,
      complianceScore: agentCount > 0 ? Math.round((compliantAgents / agentCount) * 100) : 100,
      bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, s._count])),
      byCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count])),
      recentChanges,
    };
  }

  async getAgentTimeline(agentId: string, tenantId: string) {
    return this.prisma.endpointChange.findMany({
      where: { agentId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { policy: { select: { name: true, action: true } } },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // POLICY TEMPLATES
  // ═══════════════════════════════════════════════════════════════

  getTemplates() {
    return [
      {
        name: 'Unauthorized RAM Change',
        description: 'Alert when RAM is added or removed from a machine',
        category: 'RAM_CHANGE',
        severity: 'WARNING',
        action: 'REQUIRE_APPROVAL',
        matchPattern: {},
        scope: {},
      },
      {
        name: 'USB Mass Storage Device',
        description: 'Detect when a USB storage device is connected',
        category: 'USB_DEVICE',
        severity: 'WARNING',
        action: 'ALERT_ONLY',
        matchPattern: {},
        scope: {},
      },
      {
        name: 'Blocked Software Installation',
        description: 'Flag when restricted software is installed (e.g., P2P, gaming)',
        category: 'SOFTWARE_INSTALL',
        severity: 'CRITICAL',
        action: 'REQUIRE_APPROVAL',
        matchPattern: { blockedKeywords: ['torrent', 'bittorrent', 'steam', 'discord', 'telegram'] },
        scope: {},
      },
      {
        name: 'Network Adapter Change',
        description: 'Detect new network interfaces (WiFi adapters, USB NICs)',
        category: 'NETWORK_CHANGE',
        severity: 'INFO',
        action: 'ALERT_ONLY',
        matchPattern: {},
        scope: {},
      },
      {
        name: 'Disk Drive Change',
        description: 'Alert when storage drives are added or removed',
        category: 'DISK_CHANGE',
        severity: 'WARNING',
        action: 'ALERT_ONLY',
        matchPattern: {},
        scope: {},
      },
      {
        name: 'Security Degradation',
        description: 'Critical alert when firewall or encryption is disabled',
        category: 'HARDWARE_CHANGE',
        severity: 'CRITICAL',
        action: 'REQUIRE_APPROVAL',
        matchPattern: { securityDegradation: true },
        scope: {},
      },
    ];
  }

  async seedDefaultPolicies(tenantId: string) {
    const existing = await this.prisma.endpointPolicy.count({ where: { tenantId } });
    if (existing > 0) return { message: 'Policies already exist', count: existing };

    const templates = this.getTemplates();
    for (const t of templates) {
      await this.prisma.endpointPolicy.create({
        data: { tenantId, ...t, isSystem: true },
      });
    }
    return { message: `Created ${templates.length} default policies`, count: templates.length };
  }

  // ═══════════════════════════════════════════════════════════════
  // AGENTLESS COMPLIANCE SCAN — SSH into remote hosts
  // ═══════════════════════════════════════════════════════════════

  /**
   * Convert SshScanResult to the same snapshot format the agent uses,
   * so the diff engine works identically for both modes.
   */
  private normalizeSshToSnapshot(ssh: any): any {
    // Parse memory (e.g., "7.6Gi" → MB)
    const parseMemGb = (s: string) => {
      if (!s) return 0;
      const num = parseFloat(s);
      if (s.includes('Gi') || s.includes('G')) return Math.round(num * 1024);
      if (s.includes('Mi') || s.includes('M')) return Math.round(num);
      return Math.round(num);
    };

    return {
      collectedAt: new Date().toISOString(),
      agentVersion: 'agentless-ssh',
      hardware: {
        cpuModel: ssh.cpuInfo?.model || 'Unknown',
        cpuCores: ssh.cpuInfo?.cores || 0,
        totalRamMb: parseMemGb(ssh.memoryInfo?.total || '0'),
        freeRamMb: parseMemGb(ssh.memoryInfo?.free || '0'),
        usedRamMb: parseMemGb(ssh.memoryInfo?.used || '0'),
        ramUsagePercent: ssh.memoryInfo?.percent || 0,
        diskDrives: (ssh.diskUsage || []).map((d: any) => ({
          mount: d.mount, totalGb: d.size, usedGb: d.used, freeGb: d.available, usedPercent: d.percent,
        })),
      },
      operatingSystem: {
        platform: 'linux',
        type: ssh.osInfo?.distro || 'Linux',
        release: ssh.osInfo?.kernel || '',
        arch: ssh.osInfo?.arch || '',
        hostname: ssh.hostname || ssh.ip,
        uptime: 0,
      },
      network: {
        interfaces: [], // SSH doesn't easily enumerate MACs like the agent
        hostname: ssh.hostname || ssh.ip,
      },
      security: {
        firewallEnabled: ssh.firewallStatus ? ssh.firewallStatus.includes('active') || ssh.firewallStatus.includes('enabled') : false,
      },
      software: (ssh.runningServices || []).map((s: any) => ({
        name: s.name, version: s.status || '',
      })),
      services: ssh.runningServices || [],
      usbDevices: [],
    };
  }

  /**
   * Run an agentless compliance scan on a target IP via SSH.
   * Creates a virtual agent record if one doesn't exist.
   */
  async agentlessScan(tenantId: string, data: {
    target: string;
    username: string;
    password?: string;
    privateKeyPath?: string;
    credentialId?: string;
  }) {
    const { target } = data;
    this.logger.log(`Starting agentless compliance scan: ${target}`);

    // Resolve credentials from vault if credentialId provided
    let creds = { username: data.username, password: data.password, privateKeyPath: data.privateKeyPath };
    if (data.credentialId) {
      const stored = await this.prisma.scanCredential.findFirst({
        where: { id: data.credentialId, tenantId },
      });
      if (stored) {
        const c = JSON.parse(stored.encryptedData) as any;
        creds = { username: c.username || data.username, password: c.password, privateKeyPath: c.privateKeyPath };
      }
    }

    // Run SSH scan
    const sshResult = await SshScanner.scan(target, creds, 45000);
    if (sshResult.error) {
      return { success: false, error: sshResult.error, target };
    }

    // Normalize to agent snapshot format
    const snapshot = this.normalizeSshToSnapshot(sshResult);
    const hostname = sshResult.hostname || target;

    // Find or create a virtual agent for this target
    let agent = await this.prisma.agent.findFirst({
      where: { tenantId, ipAddress: target },
    });

    if (!agent) {
      agent = await this.prisma.agent.create({
        data: {
          tenantId,
          hostname,
          platform: 'linux',
          agentVersion: 'agentless-ssh',
          ipAddress: target,
          status: 'ONLINE',
          lastHeartbeat: new Date(),
          systemInfo: snapshot,
        },
      });
      this.logger.log(`Created virtual agent for ${hostname} (${target})`);
    } else {
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: { lastHeartbeat: new Date(), status: 'ONLINE', systemInfo: snapshot, hostname },
      });
    }

    // Run through the same compliance engine as agent heartbeats
    const results = await this.processHeartbeat(tenantId, agent.id, agent, snapshot);

    return {
      success: true,
      target,
      hostname,
      agentId: agent.id,
      mode: 'agentless',
      snapshot: {
        cpu: snapshot.hardware.cpuModel,
        cores: snapshot.hardware.cpuCores,
        ramMb: snapshot.hardware.totalRamMb,
        disks: snapshot.hardware.diskDrives?.length || 0,
        services: snapshot.services?.length || 0,
        firewall: snapshot.security.firewallEnabled,
      },
      changesDetected: results.length,
      changes: results.map((r: any) => ({ id: r.id, summary: r.summary, severity: r.severity, status: r.status })),
    };
  }

  /**
   * Batch agentless scan — scan multiple IPs with the same credentials
   */
  async agentlessBatchScan(tenantId: string, data: {
    targets: string[];
    username: string;
    password?: string;
    privateKeyPath?: string;
    credentialId?: string;
  }) {
    const results = [];
    for (const target of data.targets) {
      try {
        const result = await this.agentlessScan(tenantId, { ...data, target });
        results.push(result);
      } catch (err: any) {
        results.push({ success: false, target, error: err.message });
      }
    }
    return {
      total: data.targets.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }
}
