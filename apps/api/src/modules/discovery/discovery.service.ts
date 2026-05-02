import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { ComplianceService } from '../compliance/compliance.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as dns from 'dns';
import * as net from 'net';
import { SshScanner } from '../../common/scanners/ssh.scanner';

const execAsync = promisify(exec);

// Common service ports for fingerprinting
const SERVICE_PORTS = [22, 80, 135, 139, 161, 443, 445, 631, 3306, 3389, 5432, 5900, 8080, 8443, 9100];

const PORT_SERVICE_MAP: Record<number, string> = {
  22: 'SSH', 80: 'HTTP', 135: 'RPC', 139: 'NetBIOS', 161: 'SNMP',
  443: 'HTTPS', 445: 'SMB', 631: 'IPP/Printer', 3306: 'MySQL', 3389: 'RDP',
  5432: 'PostgreSQL', 5900: 'VNC', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 9100: 'JetDirect',
};

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private complianceService: ComplianceService,
  ) {}

  /**
   * Detect the local machine's subnet(s) for scanning
   */
  getLocalSubnets(): { ip: string; subnet: string; interface: string }[] {
    const interfaces = os.networkInterfaces();
    const subnets: { ip: string; subnet: string; interface: string }[] = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const parts = addr.address.split('.');
          const subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
          subnets.push({ ip: addr.address, subnet, interface: name });
        }
      }
    }
    return subnets;
  }

  /**
   * Create a new scan job — supports multiple scan types
   */
  async createScan(tenantId: string, userId: string, data: {
    subnet: string; scanType?: string; name?: string; portRange?: string; credentialId?: string;
  }) {
    const scanJob = await this.prisma.scanJob.create({
      data: {
        tenantId,
        triggeredById: userId,
        subnet: data.subnet,
        scanType: (data.scanType as any) || 'PING_SWEEP',
        name: data.name || `Scan ${data.subnet}`,
        portRange: data.portRange,
        status: 'PENDING',
      },
    });

    // Run scan asynchronously
    this.runScan(scanJob.id, tenantId, data.subnet, data.scanType || 'PING_SWEEP').catch(err =>
      this.logger.error(`Scan ${scanJob.id} failed: ${err.message}`),
    );

    return scanJob;
  }

  /**
   * TCP port probe — check if a specific port is open
   */
  private probePort(ip: string, port: number, timeout = 1500): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
      socket.on('error', () => { socket.destroy(); resolve(false); });
      socket.connect(port, ip);
    });
  }

  /**
   * Port scan a single host — returns list of open ports
   */
  private async scanPorts(ip: string, ports: number[] = SERVICE_PORTS): Promise<{ port: number; service: string }[]> {
    const results = await Promise.allSettled(
      ports.map(async (port) => {
        const open = await this.probePort(ip, port);
        return open ? { port, service: PORT_SERVICE_MAP[port] || `port-${port}` } : null;
      }),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<{ port: number; service: string }> =>
        r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);
  }

  /**
   * Classify device based on open ports + MAC OUI
   */
  private classifyDevice(openPorts: { port: number; service: string }[], mac?: string): {
    deviceType: string; osGuess: string; services: string[];
  } {
    const portNumbers = new Set(openPorts.map(p => p.port));
    const services = openPorts.map(p => p.service);

    // MAC OUI-based vendor detection
    let vendorHint = '';
    if (mac) {
      const oui = mac.substring(0, 8).toUpperCase().replace(/:/g, '');
      if (['F0DEF1', '00505A', '000C29', '005056'].some(p => oui.startsWith(p))) vendorHint = 'VMware';
      else if (['B8AEED', '3C22FB', 'A4C3F0', '001B44'].some(p => oui.startsWith(p))) vendorHint = 'HP';
      else if (['0023EA', '0050BA'].some(p => oui.startsWith(p))) vendorHint = 'Cisco';
      else if (['00155D'].some(p => oui.startsWith(p))) vendorHint = 'Microsoft Hyper-V';
      else if (['DCED96', 'DC4F22'].some(p => oui.startsWith(p))) vendorHint = 'Apple';
    }

    // Device classification logic
    if (portNumbers.has(631) || portNumbers.has(9100)) {
      return { deviceType: 'Printer', osGuess: 'Embedded', services };
    }
    if (portNumbers.has(161) && !portNumbers.has(22) && !portNumbers.has(3389)) {
      return { deviceType: 'Network Device', osGuess: vendorHint || 'Network OS', services };
    }
    if (vendorHint === 'VMware') {
      return { deviceType: 'Virtual Machine', osGuess: 'VMware Guest', services };
    }
    if (portNumbers.has(3389)) {
      return { deviceType: portNumbers.has(135) ? 'Windows Server' : 'Windows Workstation', osGuess: 'Windows', services };
    }
    if (portNumbers.has(22) && !portNumbers.has(3389)) {
      return { deviceType: portNumbers.has(80) || portNumbers.has(443) ? 'Linux Server' : 'Linux Workstation', osGuess: 'Linux/Unix', services };
    }
    if (portNumbers.has(80) || portNumbers.has(443) || portNumbers.has(8080)) {
      return { deviceType: 'Web Server', osGuess: 'Unknown', services };
    }
    if (vendorHint === 'Apple') {
      return { deviceType: 'Apple Device', osGuess: 'macOS/iOS', services };
    }

    return { deviceType: vendorHint ? `${vendorHint} Device` : 'Unknown', osGuess: 'Unknown', services };
  }

  /**
   * Execute the actual network scan — supports multiple scan types
   */
  private async runScan(scanJobId: string, tenantId: string, subnet: string, scanType: string) {
    await this.prisma.scanJob.update({
      where: { id: scanJobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    try {
      const baseIp = subnet.replace(/\/\d+$/, '').replace(/\.\d+$/, '');
      const ips = Array.from({ length: 254 }, (_, i) => `${baseIp}.${i + 1}`);

      // Phase 1: Ping sweep (always first)
      const platform = os.platform();
      const pingCmd = platform === 'darwin' ? 'ping -c 1 -W 1' :
                      platform === 'win32' ? 'ping -n 1 -w 1000' : 'ping -c 1 -W 1';

      const batchSize = 30;
      const aliveHosts: { ip: string; hostname?: string; latency?: string; openPorts?: any[]; classification?: any }[] = [];

      for (let i = 0; i < ips.length; i += batchSize) {
        const batch = ips.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (ip) => {
            try {
              const { stdout } = await execAsync(`${pingCmd} ${ip}`, { timeout: 3000 });
              const latencyMatch = stdout.match(/time[=<]([\d.]+)/);
              const latency = latencyMatch ? latencyMatch[1] : undefined;
              let hostname: string | undefined;
              try { const [name] = await dns.promises.reverse(ip); hostname = name; } catch {}
              return { ip, hostname, latency };
            } catch { return null; }
          }),
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            aliveHosts.push(result.value);
          }
        }
      }

      // Get ARP table for MAC addresses
      let arpEntries: Record<string, string> = {};
      try {
        const arpCmd = platform === 'darwin' ? 'arp -a' : platform === 'win32' ? 'arp -a' : 'arp -n';
        const { stdout: arpOutput } = await execAsync(arpCmd, { timeout: 5000 });
        for (const line of arpOutput.split('\n')) {
          const macMatch = line.match(/\(?([\d.]+)\)?\s+at\s+([\da-f:]+)/i);
          if (macMatch) arpEntries[macMatch[1]] = macMatch[2];
          const linuxMatch = line.match(/([\d.]+)\s+\S+\s+([\da-f:]+)/i);
          if (linuxMatch && !macMatch) arpEntries[linuxMatch[1]] = linuxMatch[2];
        }
      } catch { this.logger.warn('ARP table read failed'); }

      // Phase 2: Port scan (for TCP_PORT_SCAN and FULL_SCAN types)
      if (scanType === 'TCP_PORT_SCAN' || scanType === 'FULL_SCAN') {
        this.logger.log(`Running port scan on ${aliveHosts.length} hosts...`);
        const portBatchSize = 10;
        for (let i = 0; i < aliveHosts.length; i += portBatchSize) {
          const batch = aliveHosts.slice(i, i + portBatchSize);
          await Promise.all(
            batch.map(async (host) => {
              host.openPorts = await this.scanPorts(host.ip);
              const mac = arpEntries[host.ip];
              host.classification = this.classifyDevice(host.openPorts, mac);
            }),
          );
        }
      }

      // Phase 3: SNMP discovery (for SNMP_DISCOVERY and FULL_SCAN)
      // SNMP v2c community "public" read — check port 161 on responsive hosts
      if (scanType === 'SNMP_DISCOVERY' || scanType === 'FULL_SCAN') {
        for (const host of aliveHosts) {
          const snmpOpen = await this.probePort(host.ip, 161, 1000);
          if (snmpOpen && (!host.classification || host.classification.deviceType === 'Unknown')) {
            host.classification = {
              deviceType: 'Network Device',
              osGuess: 'SNMP-enabled',
              services: [...(host.openPorts?.map((p: any) => p.service) || []), 'SNMP'],
            };
          }
        }
      }

      // Check which are new vs existing
      const existingAssets = await this.prisma.asset.findMany({
        where: { tenantId, deletedAt: null, ipAddress: { in: aliveHosts.map(h => h.ip) } },
        select: { ipAddress: true },
      });
      const existingIps = new Set(existingAssets.map(a => a.ipAddress));

      // Store discovered devices with enriched data
      let newCount = 0;
      for (const host of aliveHosts) {
        const mac = arpEntries[host.ip];
        const isNew = !existingIps.has(host.ip);
        if (isNew) newCount++;

        const classification = host.classification || this.classifyDevice(host.openPorts || [], mac);

        await this.prisma.discoveredDevice.create({
          data: {
            tenantId,
            scanJobId: scanJobId,
            ipAddress: host.ip,
            macAddress: mac || null,
            hostname: host.hostname || null,
            deviceType: classification.deviceType,
            osInfo: classification.osGuess,
            openPorts: host.openPorts ? JSON.stringify(host.openPorts) : null,
            services: classification.services ? JSON.stringify(classification.services) : null,
            status: isNew ? 'PENDING_REVIEW' : 'MERGED',
          },
        });

        // Emit event for new devices
        if (isNew) {
          this.eventBus.emitDiscoveryEvent(tenantId, 'new_device', {
            ipAddress: host.ip, deviceType: classification.deviceType,
            hostname: host.hostname, mac, scanJobId,
          });
        }
      }

      // Update scan job
      await this.prisma.scanJob.update({
        where: { id: scanJobId },
        data: {
          status: 'COMPLETED', completedAt: new Date(),
          devicesFound: aliveHosts.length, newDevices: newCount,
        },
      });

      // Emit scan completed event
      this.eventBus.emitDiscoveryEvent(tenantId, 'scan_completed', {
        scanJobId, devicesFound: aliveHosts.length, newDevices: newCount, scanType,
      });

      this.logger.log(`Scan ${scanJobId} completed: ${aliveHosts.length} devices, ${newCount} new (type: ${scanType})`);
    } catch (error: any) {
      await this.prisma.scanJob.update({
        where: { id: scanJobId },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: error.message },
      });
      throw error;
    }
  }

  // ─── Scan Jobs CRUD ───────────────────────────────────────────

  async findAllScans(tenantId: string, page = 1, limit = 20) {
    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      this.prisma.scanJob.findMany({
        where: { tenantId },
        include: {
          triggeredBy: { select: { firstName: true, lastName: true } },
          _count: { select: { discoveries: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: Number(limit),
      }),
      this.prisma.scanJob.count({ where: { tenantId } }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findScanById(id: string, tenantId: string) {
    const scan = await this.prisma.scanJob.findFirst({
      where: { id, tenantId },
      include: {
        triggeredBy: { select: { firstName: true, lastName: true } },
        discoveries: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    return scan;
  }

  async findPendingDevices(tenantId: string) {
    return this.prisma.discoveredDevice.findMany({
      where: { tenantId, status: 'PENDING_REVIEW' },
      include: { scanJob: { select: { name: true, subnet: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveDevice(deviceId: string, tenantId: string, userId: string, data: {
    name: string; assetTypeId: string;
  }) {
    const device = await this.prisma.discoveredDevice.findFirst({
      where: { id: deviceId, tenantId },
    });
    if (!device) throw new NotFoundException('Device not found');

    const asset = await this.prisma.asset.create({
      data: {
        tenantId, name: data.name, assetTypeId: data.assetTypeId,
        ipAddress: device.ipAddress, macAddress: device.macAddress,
        hostname: device.hostname, status: 'ACTIVE',
        discoverySource: 'SNMP', createdById: userId,
      },
    });

    await this.prisma.discoveredDevice.update({
      where: { id: deviceId },
      data: { status: 'APPROVED', approvedAssetId: asset.id },
    });

    // Emit asset created event
    this.eventBus.emitAssetEvent(tenantId, 'created', {
      assetId: asset.id, name: asset.name, source: 'discovery',
    });

    return asset;
  }

  async ignoreDevice(deviceId: string, tenantId: string) {
    return this.prisma.discoveredDevice.updateMany({
      where: { id: deviceId, tenantId },
      data: { status: 'IGNORED' },
    });
  }

  // ─── Agents ───────────────────────────────────────────────────

  async listAgents(tenantId: string) {
    return this.prisma.agent.findMany({
      where: { tenantId },
      orderBy: { lastHeartbeat: 'desc' },
    });
  }

  async getAgent(id: string, tenantId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async registerAgent(tenantId: string, data: {
    hostname: string; platform: string; agentVersion: string;
    ipAddress: string; macAddress?: string; systemInfo?: any;
  }) {
    // Check for existing agent by hostname + IP
    const existing = await this.prisma.agent.findFirst({
      where: { tenantId, hostname: data.hostname, ipAddress: data.ipAddress },
    });
    if (existing) {
      return this.prisma.agent.update({
        where: { id: existing.id },
        data: { ...data, lastHeartbeat: new Date(), status: 'ONLINE' },
      });
    }
    return this.prisma.agent.create({
      data: { tenantId, ...data, lastHeartbeat: new Date(), status: 'ONLINE' },
    });
  }

  async agentHeartbeat(id: string, tenantId: string, data?: { systemInfo?: any }) {
    const agent = await this.prisma.agent.findFirst({ where: { id, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');

    const updated = await this.prisma.agent.update({
      where: { id },
      data: { lastHeartbeat: new Date(), status: 'ONLINE', ...(data?.systemInfo ? { systemInfo: data.systemInfo } : {}) },
    });

    // Run compliance change detection if snapshot provided
    if (data?.systemInfo) {
      try {
        await this.complianceService.processHeartbeat(tenantId, id, agent, data.systemInfo);
      } catch (err) {
        this.logger.warn(`Compliance check failed for agent ${agent.hostname}: ${err.message}`);
      }
    }

    return updated;
  }

  // ─── Scheduled Scans ──────────────────────────────────────────

  async listSchedules(tenantId: string) {
    return this.prisma.scheduledScan.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSchedule(tenantId: string, userId: string, data: {
    name: string; subnet: string; scanType: string; schedule: string;
    scanWindow?: any; credentialId?: string;
  }) {
    return this.prisma.scheduledScan.create({
      data: {
        tenantId, createdById: userId,
        name: data.name, subnet: data.subnet,
        scanType: data.scanType, schedule: data.schedule,
        scanWindow: data.scanWindow, credentialId: data.credentialId,
        nextRunAt: this.calculateNextRun(data.schedule),
      },
    });
  }

  async updateSchedule(id: string, tenantId: string, data: any) {
    const existing = await this.prisma.scheduledScan.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Schedule not found');
    return this.prisma.scheduledScan.update({ where: { id }, data });
  }

  async deleteSchedule(id: string, tenantId: string) {
    const existing = await this.prisma.scheduledScan.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Schedule not found');
    return this.prisma.scheduledScan.delete({ where: { id } });
  }

  /** Execute due scheduled scans (called by cron job) */
  async executeDueScans() {
    const dueScans = await this.prisma.scheduledScan.findMany({
      where: { isActive: true, nextRunAt: { lte: new Date() } },
    });

    for (const schedule of dueScans) {
      this.logger.log(`Running scheduled scan: ${schedule.name} (${schedule.subnet})`);
      try {
        await this.createScan(schedule.tenantId, schedule.createdById, {
          subnet: schedule.subnet, scanType: schedule.scanType,
          name: `[Scheduled] ${schedule.name}`, credentialId: schedule.credentialId || undefined,
        });
        await this.prisma.scheduledScan.update({
          where: { id: schedule.id },
          data: { lastRunAt: new Date(), nextRunAt: this.calculateNextRun(schedule.schedule) },
        });
      } catch (e: any) {
        this.logger.error(`Scheduled scan ${schedule.name} failed: ${e.message}`);
      }
    }
  }

  private calculateNextRun(cronExpr: string): Date {
    // Simple cron parser for common patterns
    const now = new Date();
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return new Date(now.getTime() + 24 * 60 * 60 * 1000); // default: 24h

    const [min, hour] = parts;
    const next = new Date(now);
    next.setHours(parseInt(hour) || 0, parseInt(min) || 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  /**
   * Enrich a discovered device with real SSH/SNMP data.
   * - With credentials: Uses SshScanner for deep endpoint interrogation
   * - Without credentials: Uses port-scan fingerprinting + ARP data
   */
  async enrichDevice(deviceId: string, tenantId: string, credentialId?: string) {
    const device = await this.prisma.discoveredDevice.findFirst({
      where: { id: deviceId, tenantId },
    });
    if (!device) throw new NotFoundException('Device not found');

    let enrichmentData: any = {
      collectedAt: new Date().toISOString(),
      method: 'PORT_FINGERPRINT',
    };

    // ─── Try SSH-based deep scan if credentials provided ─────────
    if (credentialId) {
      const cred = await this.prisma.scanCredential.findFirst({
        where: { id: credentialId, tenantId },
      });

      if (cred) {
        const credData = cred.encryptedData ? JSON.parse(cred.encryptedData as string) : {} as any;
        try {
          const sshResult = await SshScanner.scan(device.ipAddress, {
            username: credData.username,
            password: credData.password,
            privateKeyPath: credData.privateKeyPath,
          });

          if (!sshResult.error) {
            enrichmentData = {
              collectedAt: new Date().toISOString(),
              method: 'SSH',
              hardware: {
                cpuModel: sshResult.cpuInfo?.model || 'Unknown',
                cpuCores: sshResult.cpuInfo?.cores || 0,
                totalRamMb: sshResult.memoryInfo ? this.parseMemoryToMb(sshResult.memoryInfo.total) : 0,
                diskDrives: (sshResult.diskUsage || []).map((d: any) => ({
                  filesystem: d.filesystem, sizeGb: d.size, used: d.used,
                  available: d.available, percentUsed: d.percent, mount: d.mount,
                })),
              },
              operatingSystem: {
                name: sshResult.osInfo?.distro || 'Linux',
                kernel: sshResult.osInfo?.kernel || 'unknown',
                architecture: sshResult.osInfo?.arch || 'unknown',
                hostname: sshResult.hostname,
                uptime: sshResult.uptime,
              },
              network: {
                openPorts: sshResult.openPorts || [],
                firewallStatus: sshResult.firewallStatus || 'unknown',
              },
              security: {
                firewallStatus: sshResult.firewallStatus || 'unknown',
                pendingPatches: sshResult.pendingPatches?.length || 0,
                patchList: sshResult.pendingPatches || [],
              },
              software: {
                installedPackages: sshResult.installedPackages || 0,
                runningServices: sshResult.runningServices || [],
              },
              users: {
                accounts: sshResult.users || [],
                lastLogins: sshResult.lastLogins || [],
              },
            };
            this.logger.log(`Device ${device.ipAddress} enriched via SSH — ${sshResult.cpuInfo?.cores || '?'} cores, ${sshResult.diskUsage?.length || 0} disks`);
          } else {
            this.logger.warn(`SSH enrichment failed for ${device.ipAddress}: ${sshResult.error}`);
            enrichmentData.sshError = sshResult.error;
          }
        } catch (err: any) {
          this.logger.warn(`SSH enrichment exception for ${device.ipAddress}: ${err.message}`);
          enrichmentData.sshError = err.message;
        }
      }
    }

    // ─── Fallback: Port-scan fingerprinting ──────────────────────
    if (enrichmentData.method === 'PORT_FINGERPRINT') {
      const openPorts = await this.scanPorts(device.ipAddress);
      const classification = this.classifyDevice(openPorts, device.macAddress || undefined);

      enrichmentData.hardware = { detectedType: classification.deviceType };
      enrichmentData.operatingSystem = { osGuess: classification.osGuess };
      enrichmentData.network = {
        openPorts: openPorts.map(p => ({ port: p.port, service: p.service })),
        services: classification.services,
      };

      this.logger.log(`Device ${device.ipAddress} enriched via port scan — ${openPorts.length} ports, type: ${classification.deviceType}`);
    }

    const updated = await this.prisma.discoveredDevice.update({
      where: { id: deviceId },
      data: {
        enrichmentData: enrichmentData as any,
        enrichmentStatus: 'ENRICHED',
      },
    });

    return {
      device: updated,
      enrichmentSummary: {
        method: enrichmentData.method,
        cpuCores: enrichmentData.hardware?.cpuCores || enrichmentData.hardware?.detectedType || null,
        ramMb: enrichmentData.hardware?.totalRamMb || null,
        diskCount: enrichmentData.hardware?.diskDrives?.length || null,
        osName: enrichmentData.operatingSystem?.name || enrichmentData.operatingSystem?.osGuess || null,
        openPorts: enrichmentData.network?.openPorts?.length || 0,
        firewallStatus: enrichmentData.security?.firewallStatus || enrichmentData.network?.firewallStatus || null,
      },
    };
  }

  /** Parse memory strings like "7.6G" or "512M" to MB */
  private parseMemoryToMb(memStr: string): number {
    const num = parseFloat(memStr);
    if (isNaN(num)) return 0;
    if (memStr.includes('G') || memStr.includes('g')) return Math.round(num * 1024);
    if (memStr.includes('T') || memStr.includes('t')) return Math.round(num * 1024 * 1024);
    if (memStr.includes('M') || memStr.includes('m')) return Math.round(num);
    return Math.round(num);
  }
}
