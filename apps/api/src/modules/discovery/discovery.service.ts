import { Injectable, Logger, NotFoundException, BadRequestException, NotImplementedException, Optional, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { ComplianceService } from '../compliance/compliance.service';
import { AlertsService } from '../alerts/alerts.service';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as dns from 'dns';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { SshScanner } from '../../common/scanners/ssh.scanner';
import { WmiScanner } from '../../common/scanners/wmi.scanner';
import { CredentialVaultService } from './credential-vault.service';
import { SnmpScanner } from '../../common/scanners/snmp.scanner';
import { SoftwareService } from '../software/software.service';
import { AuthService } from '../auth/auth.service';
import { VulnerabilitiesService } from '../vulnerabilities/vulnerabilities.service';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export type DeployRemoteMethod = 'ssh' | 'winrm' | 'auto';

export interface DeployRemoteOptions {
  method?: DeployRemoteMethod;
  platform?: string;
  username?: string;
  password?: string;
}

// Common service ports for fingerprinting
const SERVICE_PORTS = [22, 80, 135, 139, 161, 443, 445, 631, 3306, 3389, 5432, 5900, 8080, 8443, 9100];

const PORT_SERVICE_MAP: Record<number, string> = {
  22: 'SSH', 80: 'HTTP', 135: 'RPC', 139: 'NetBIOS', 161: 'SNMP',
  443: 'HTTPS', 445: 'SMB', 631: 'IPP/Printer', 3306: 'MySQL', 3389: 'RDP',
  5432: 'PostgreSQL', 5900: 'VNC', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 9100: 'JetDirect',
};

// Normalize scan type strings to valid Prisma enum values
const VALID_SCAN_TYPES = ['PING_SWEEP', 'ARP_SCAN', 'PORT_SCAN', 'TCP_PORT_SCAN', 'SNMP_DISCOVERY', 'FULL_SCAN'];
function normalizeScanType(raw?: string): string {
  if (!raw) return 'PING_SWEEP';
  const upper = raw.toUpperCase().replace(/-/g, '_');
  return VALID_SCAN_TYPES.includes(upper) ? upper : 'PING_SWEEP';
}

// Calculate risk score (0-100) from open ports and device info
function calculateRiskScore(openPorts: { port: number; service: string }[], hostname?: string, deviceType?: string): number {
  let score = 0;
  const portNumbers = new Set(openPorts.map(p => p.port));
  if (portNumbers.has(3389)) score += 20;   // RDP exposed
  if (portNumbers.has(5900)) score += 30;   // VNC exposed
  if (portNumbers.has(22)) score += 10;     // SSH exposed
  if (portNumbers.has(23)) score += 35;     // Telnet (very risky)
  if (portNumbers.has(445)) score += 15;    // SMB exposed
  if (portNumbers.has(3306) || portNumbers.has(5432)) score += 20; // DB exposed
  if (!hostname) score += 15;               // No hostname = unmanaged
  if (deviceType === 'Unknown' || !deviceType) score += 10;
  if (openPorts.length > 8) score += 10;    // Too many open ports
  return Math.min(score, 100);
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private complianceService: ComplianceService,
    private credentialVault: CredentialVaultService,
    private snmpScanner: SnmpScanner,
    private alertsService: AlertsService,
    private softwareService: SoftwareService,
    private authService: AuthService,
    @Optional() @Inject(forwardRef(() => VulnerabilitiesService))
    private vulnerabilitiesService?: VulnerabilitiesService,
  ) {}

  /**
   * Fetch and decrypt all SNMP community strings for a tenant
   */
  async getSnmpCommunities(tenantId: string): Promise<string[]> {
    const creds = await this.prisma.scanCredential.findMany({
      where: {
        tenantId,
        type: { in: ['SNMP_V2C', 'SNMP'] },
      },
    });

    const communities = new Set<string>(['public']); // Always fallback to public
    for (const cred of creds) {
      try {
        const decrypted = await this.credentialVault.getDecrypted(cred.id, tenantId);
        if (decrypted && decrypted.community) {
          communities.add(decrypted.community);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to decrypt SNMP credential ${cred.id}: ${err.message}`);
      }
    }
    return Array.from(communities);
  }

  /**
   * Try to poll a host using a list of community strings
   */
  private async pollSnmpForHost(ip: string, communities: string[]): Promise<any | null> {
    for (const community of communities) {
      try {
        const result = await this.snmpScanner.pollDevice(ip, community, 2000);
        if (result && (result.sysDescr || result.sysName)) {
          return { result, community };
        }
      } catch (err) {
        // Continue trying
      }
    }
    return null;
  }

  /**
   * Heuristic SNMP classification parser
   */
  classifyDeviceFromSnmp(sysDescr: string, mac?: string): {
    deviceType: string;
    manufacturer: string;
    model: string;
    osGuess: string;
  } {
    const desc = (sysDescr || '').toLowerCase();
    let deviceType = 'Network Device';
    let manufacturer = 'Generic';
    let model = 'Generic SNMP Device';
    let osGuess = 'Embedded OS';

    if (desc.includes('cisco')) {
      manufacturer = 'Cisco';
      osGuess = 'IOS';
      if (desc.includes('catalyst')) {
        deviceType = 'Switch';
        model = 'Catalyst Switch';
        const match = sysDescr.match(/c(\d{4})/i);
        if (match) model = `Catalyst ${match[1]} Series`;
      } else if (desc.includes('nexus')) {
        deviceType = 'Switch';
        model = 'Nexus Switch';
        osGuess = 'NX-OS';
        const match = sysDescr.match(/n(\d{4})/i);
        if (match) model = `Nexus ${match[1]} Series`;
      } else if (desc.includes('adaptive security appliance') || desc.includes('asa')) {
        deviceType = 'Firewall';
        model = 'ASA Firewall';
      } else {
        model = 'Cisco Router/Switch';
      }
    } else if (desc.includes('juniper')) {
      manufacturer = 'Juniper';
      osGuess = 'Junos';
      if (desc.includes('srx')) {
        deviceType = 'Firewall';
        model = 'SRX Series';
      } else if (desc.includes('ex')) {
        deviceType = 'Switch';
        model = 'EX Series';
      } else {
        model = 'Juniper Router';
      }
    } else if (desc.includes('fortinet') || desc.includes('fortigate')) {
      manufacturer = 'Fortinet';
      deviceType = 'Firewall';
      osGuess = 'FortiOS';
      model = 'FortiGate Firewall';
    } else if (desc.includes('hp ') || desc.includes('procurve') || desc.includes('hewlett-packard')) {
      manufacturer = 'HP';
      if (desc.includes('procurve')) {
        deviceType = 'Switch';
        model = 'ProCurve Switch';
        osGuess = 'ProCurve OS';
      } else if (desc.includes('laserjet') || desc.includes('printer') || desc.includes('officejet')) {
        deviceType = 'Printer';
        model = 'LaserJet';
        const match = sysDescr.match(/laserjet\s+([\w\d]+)/i);
        if (match) model = `LaserJet ${match[1]}`;
      }
    } else if (desc.includes('synology') || desc.includes('nas')) {
      manufacturer = 'Synology';
      deviceType = 'Storage';
      osGuess = 'DSM';
      model = 'DiskStation';
    } else if (desc.includes('windows')) {
      manufacturer = 'Microsoft';
      osGuess = 'Windows';
      if (desc.includes('server')) {
        deviceType = 'Windows Server';
        if (desc.includes('2025')) model = 'Windows Server 2025';
        else if (desc.includes('2022')) model = 'Windows Server 2022';
        else if (desc.includes('2019')) model = 'Windows Server 2019';
        else if (desc.includes('2016')) model = 'Windows Server 2016';
        else model = 'Windows Server';
      } else {
        deviceType = 'Windows Workstation';
        model = 'Windows PC';
      }
    } else if (desc.includes('linux')) {
      manufacturer = 'Generic Linux';
      deviceType = 'Linux Server';
      osGuess = 'Linux';
      if (desc.includes('ubuntu')) {
        manufacturer = 'Canonical';
        model = 'Ubuntu Server';
        osGuess = 'Ubuntu';
      } else if (desc.includes('red hat') || desc.includes('rhel')) {
        manufacturer = 'Red Hat';
        model = 'Red Hat Enterprise Linux';
        osGuess = 'RHEL';
      } else if (desc.includes('debian')) {
        manufacturer = 'Debian Project';
        model = 'Debian GNU/Linux';
        osGuess = 'Debian';
      } else if (desc.includes('centos')) {
        manufacturer = 'CentOS Project';
        model = 'CentOS Linux';
        osGuess = 'CentOS';
      } else {
        model = 'Linux Machine';
      }
    } else if (desc.includes('apple') || desc.includes('mac os') || desc.includes('darwin')) {
      manufacturer = 'Apple';
      deviceType = 'Apple Device';
      osGuess = 'macOS';
      model = 'Mac';
    }

    return { deviceType, manufacturer, model, osGuess };
  }

  async getLocalSubnets(tenantId: string): Promise<{ ip: string; subnet: string; interface: string; source: string }[]> {
    const subnets: { ip: string; subnet: string; interface: string; source: string }[] = [];

    // 1. Get subnets from active online agents in the tenant (last heartbeat in last 5 minutes)
    try {
      const onlineAgents = await this.prisma.agent.findMany({
        where: {
          tenantId,
          status: 'ONLINE',
          lastHeartbeat: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });

      for (const agent of onlineAgents) {
        const systemInfo = agent.systemInfo as any;
        const interfaces = systemInfo?.network?.interfaces;
        if (Array.isArray(interfaces)) {
          for (const iface of interfaces) {
            if (iface.ip && iface.name) {
              const parts = iface.ip.split('.');
              if (parts.length === 4) {
                const subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
                // Deduplicate
                if (!subnets.some(s => s.subnet === subnet)) {
                  subnets.push({
                    ip: iface.ip,
                    subnet,
                    interface: `${iface.name} (${agent.hostname})`,
                    source: 'Agent',
                  });
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to retrieve subnets from active agents: ${err.message}`);
    }

    // 2. Fallback to server's own interfaces (useful for local development/on-premise servers)
    // Heuristic name-priority scoring to prioritize physical active interfaces over virtual/mock adapters
    const interfaces = os.networkInterfaces();
    const serverIfaces: { name: string; ip: string; subnet: string; score: number }[] = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const parts = addr.address.split('.');
          if (parts.length === 4) {
            const subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
            const lowerName = name.toLowerCase();
            let score = 100;

            // Heavily deprioritize loopback and virtual/mock interfaces
            if (lowerName.includes('docker') || lowerName.includes('veth') || lowerName.includes('br-') || lowerName.includes('virbr')) {
              score -= 80;
            }
            if (lowerName.includes('vboxnet') || lowerName.includes('vbox') || lowerName.includes('virtualbox')) {
              score -= 70;
            }
            if (lowerName.includes('vmnet') || lowerName.includes('vmware') || lowerName.includes('virtual')) {
              score -= 60;
            }
            if (lowerName.includes('vpn') || lowerName.includes('tun') || lowerName.includes('tap') || lowerName.includes('ppp')) {
              score -= 50;
            }

            // Prioritize standard interfaces (en0, eth0, wlan0, Ethernet, Wi-Fi)
            if (lowerName.startsWith('en') || lowerName.startsWith('eth') || lowerName.startsWith('wlan') || lowerName.startsWith('wlp')) {
              score += 20;
            }
            if (lowerName.includes('ethernet') || lowerName.includes('wi-fi') || lowerName.includes('wifi')) {
              score += 25;
            }

            serverIfaces.push({ name, ip: addr.address, subnet, score });
          }
        }
      }
    }

    // Sort server interfaces descending by score
    serverIfaces.sort((a, b) => b.score - a.score);

    for (const sIface of serverIfaces) {
      if (!subnets.some(s => s.subnet === sIface.subnet)) {
        subnets.push({
          ip: sIface.ip,
          subnet: sIface.subnet,
          interface: sIface.name,
          source: 'Server',
        });
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
    const scanTypeNormalized = normalizeScanType(data.scanType);
    const scanJob = await this.prisma.scanJob.create({
      data: {
        tenantId,
        triggeredById: userId,
        subnet: data.subnet,
        scanType: scanTypeNormalized as any,
        name: data.name || `Scan ${data.subnet}`,
        portRange: data.portRange,
        status: 'PENDING',
      },
    });

    // Check if there are any ONLINE agents in this tenant (last heartbeat in last 5 minutes)
    const onlineAgents = await this.prisma.agent.findMany({
      where: {
        tenantId,
        status: 'ONLINE',
        lastHeartbeat: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });

    if (onlineAgents.length > 0) {
      this.logger.log(`Scan job ${scanJob.id} created and queued for agent-delegated execution (online agents: ${onlineAgents.length})`);
    } else {
      // Run scan asynchronously locally on the server
      this.runScan(scanJob.id, tenantId, data.subnet, scanTypeNormalized).catch(err =>
        this.logger.error(`Scan ${scanJob.id} failed: ${err.message}`),
      );
    }

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
    let targetSubnet = subnet;
    const interfaces = os.networkInterfaces();
    let localSubnet = '';
    const sortedIfaces: { subnet: string; score: number }[] = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const parts = addr.address.split('.');
          if (parts.length === 4) {
            const subnetStr = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
            const lowerName = name.toLowerCase();
            let score = 100;

            // Heavily deprioritize loopback and virtual/mock interfaces
            if (lowerName.includes('docker') || lowerName.includes('veth') || lowerName.includes('br-') || lowerName.includes('virbr')) score -= 80;
            if (lowerName.includes('vboxnet') || lowerName.includes('vbox') || lowerName.includes('virtualbox')) score -= 70;
            if (lowerName.includes('vmnet') || lowerName.includes('vmware') || lowerName.includes('virtual')) score -= 60;
            if (lowerName.includes('vpn') || lowerName.includes('tun') || lowerName.includes('tap') || lowerName.includes('ppp')) score -= 50;

            // Prioritize standard interfaces (en0, eth0, wlan0, Ethernet, Wi-Fi)
            if (lowerName.startsWith('en') || lowerName.startsWith('eth') || lowerName.startsWith('wlan') || lowerName.startsWith('wlp')) score += 20;
            if (lowerName.includes('ethernet') || lowerName.includes('wi-fi') || lowerName.includes('wifi')) score += 25;

            sortedIfaces.push({ subnet: subnetStr, score });
          }
        }
      }
    }

    if (sortedIfaces.length > 0) {
      sortedIfaces.sort((a, b) => b.score - a.score);
      localSubnet = sortedIfaces[0].subnet;
    }

    if (!targetSubnet || targetSubnet.includes('192.168.1.0') || targetSubnet.includes('10.0.0.0')) {
      if (localSubnet) {
        this.logger.log(`Autodetected correct local interface subnet: ${localSubnet} (replacing mock ${targetSubnet || 'empty'})`);
        targetSubnet = localSubnet;
      }
    }

    await this.prisma.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        subnet: targetSubnet,
        name: `Scan ${targetSubnet}`,
      },
    });

    try {
      const baseIp = targetSubnet.replace(/\/\d+$/, '').replace(/\.\d+$/, '');
      const ips = Array.from({ length: 254 }, (_, i) => `${baseIp}.${i + 1}`);

      // Phase 1: Ping sweep (always first)
      const platform = os.platform();
      const pingCmd = platform === 'darwin' ? 'ping -c 1 -W 1' :
                      platform === 'win32' ? 'ping -n 1 -w 1000' : 'ping -c 1 -W 1';

      const batchSize = 30;
      const aliveHosts: { ip: string; hostname?: string; latency?: string; openPorts?: any[]; classification?: any; snmpResult?: any }[] = [];

      for (let i = 0; i < ips.length; i += batchSize) {
        // Check if scan was stopped/cancelled by user
        const checkJob = await this.prisma.scanJob.findUnique({
          where: { id: scanJobId },
          select: { status: true },
        });
        if (!checkJob || checkJob.status === 'CANCELLED') {
          this.logger.log(`Scan job ${scanJobId} was cancelled mid-sweep.`);
          return;
        }

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

        // Emit progress
        const progress = Math.floor(((i + batchSize) / ips.length) * 40); // 0-40% for ping sweep
        this.eventBus.emitDiscoveryEvent(tenantId, 'scan_progress', { scanJobId, progress, phase: 'Ping Sweep', found: aliveHosts.length });
      }

      // Fallback 1: If no hosts found by ping (possibly due to cloud container isolation, blocked ICMP, or permission error),
      // try to probe a few highly common ports (e.g. 22, 80, 135, 443, 445) to discover active hosts.
      if (aliveHosts.length === 0) {
        this.logger.log(`Ping sweep found 0 hosts. Running TCP-based discovery sweep on common ports...`);
        for (let i = 0; i < ips.length; i += batchSize) {
          // Check if scan was stopped/cancelled by user
          const checkJob = await this.prisma.scanJob.findUnique({
            where: { id: scanJobId },
            select: { status: true },
          });
          if (!checkJob || checkJob.status === 'CANCELLED') {
            this.logger.log(`Scan job ${scanJobId} was cancelled during fallback sweep.`);
            return;
          }

          const batch = ips.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map(async (ip) => {
              const commonPorts = [22, 80, 135, 443, 445];
              for (const port of commonPorts) {
                const open = await this.probePort(ip, port, 800); // Fast timeout for sweep
                if (open) {
                  let hostname: string | undefined;
                  try { const [name] = await dns.promises.reverse(ip); hostname = name; } catch {}
                  return { ip, hostname, latency: '1' };
                }
              }
              return null;
            }),
          );

          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
              aliveHosts.push(result.value);
            }
          }
        }
      }

      // Fallback 2: If we still have 0 hosts, log that no active devices were detected
      if (aliveHosts.length === 0) {
        this.logger.log(`No active hosts found on subnet ${subnet} during discovery scan.`);
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

      // Phase 2: Port scan (for PORT_SCAN, TCP_PORT_SCAN, and FULL_SCAN)
      const isPortScan = ['PORT_SCAN', 'TCP_PORT_SCAN', 'FULL_SCAN'].includes(scanType);
      if (isPortScan) {
        this.logger.log(`Running port scan on ${aliveHosts.length} hosts...`);
        const portBatchSize = 10;
        for (let i = 0; i < aliveHosts.length; i += portBatchSize) {
          // Check if scan was stopped/cancelled by user
          const checkJob = await this.prisma.scanJob.findUnique({
            where: { id: scanJobId },
            select: { status: true },
          });
          if (!checkJob || checkJob.status === 'CANCELLED') {
            this.logger.log(`Scan job ${scanJobId} was cancelled before port scanning.`);
            return;
          }

          const batch = aliveHosts.slice(i, i + portBatchSize);
          await Promise.all(
            batch.map(async (host) => {
              host.openPorts = await this.scanPorts(host.ip);
              const mac = arpEntries[host.ip];
              host.classification = this.classifyDevice(host.openPorts, mac);
            }),
          );

          // Emit progress
          const progress = 40 + Math.floor(((i + portBatchSize) / aliveHosts.length) * 40); // 40-80% for port scan
          this.eventBus.emitDiscoveryEvent(tenantId, 'scan_progress', { scanJobId, progress, phase: 'Port Scan', found: aliveHosts.length });
        }
      }

      // Phase 3: SNMP discovery (for SNMP_DISCOVERY and FULL_SCAN)
      if (scanType === 'SNMP_DISCOVERY' || scanType === 'FULL_SCAN') {
        this.logger.log(`Running SNMP discovery on ${aliveHosts.length} hosts...`);
        const communities = await this.getSnmpCommunities(tenantId);
        
        for (const host of aliveHosts) {
          // Check if scan was stopped/cancelled by user
          const checkJob = await this.prisma.scanJob.findUnique({
            where: { id: scanJobId },
            select: { status: true },
          });
          if (!checkJob || checkJob.status === 'CANCELLED') {
            this.logger.log(`Scan job ${scanJobId} was cancelled before SNMP scanning.`);
            return;
          }

          const snmpPoll = await this.pollSnmpForHost(host.ip, communities);
          if (snmpPoll) {
            const { result: snmpResult } = snmpPoll;
            host.snmpResult = snmpResult;
            
            const classification = this.classifyDeviceFromSnmp(
              snmpResult.sysDescr || '',
              arpEntries[host.ip] || undefined,
            );
            host.classification = classification;
            
            // Mark SNMP port as open
            host.openPorts = [
              ...(host.openPorts || []),
              { port: 161, service: 'SNMP' },
            ];
            if (snmpResult.sysName) {
              host.hostname = snmpResult.sysName;
            }
          }
        }
      }

      // Phase 4: Classify ALL hosts (even ping-only) using ARP + basic heuristics
      for (const host of aliveHosts) {
        if (!host.classification) {
          const mac = arpEntries[host.ip];
          host.classification = this.classifyDevice(host.openPorts || [], mac);
        }
      }

      // Check which IPs already exist as managed assets (for auto-merge)
      const existingAssets = await this.prisma.asset.findMany({
        where: { tenantId, deletedAt: null, ipAddress: { in: aliveHosts.map(h => h.ip) } },
        select: { id: true, ipAddress: true },
      });
      const assetByIp = new Map(existingAssets.map(a => [a.ipAddress, a.id]));

      // Upsert discovered devices (deduplication by tenantId + ipAddress)
      let newCount = 0;
      for (const host of aliveHosts) {
        const mac = arpEntries[host.ip] || null;
        const existingAssetId = assetByIp.get(host.ip);
        const classification = host.classification;
        const riskScore = calculateRiskScore(host.openPorts || [], host.hostname, classification?.deviceType);

        // Immediately populate enrichmentData if SNMP walked successfully
        let enrichmentData: any = null;
        let enrichmentStatus = 'BASIC';
        if (host.snmpResult) {
          enrichmentStatus = 'ENRICHED';
          enrichmentData = {
            collectedAt: new Date().toISOString(),
            method: 'SNMP',
            hardware: {
              manufacturer: classification?.manufacturer || 'Generic',
              model: classification?.model || 'Generic SNMP Device',
              cpuLoad: host.snmpResult.cpuLoad || null,
              memoryPercent: host.snmpResult.memoryPercent || null,
            },
            operatingSystem: {
              name: classification?.osGuess || 'Embedded OS',
              osGuess: classification?.osGuess || 'Embedded OS',
              hostname: host.snmpResult.sysName,
              uptime: host.snmpResult.sysUpTime ? Math.floor(host.snmpResult.sysUpTime / 100) : null,
            },
            network: {
              sysName: host.snmpResult.sysName,
              sysLocation: host.snmpResult.sysLocation,
              sysContact: host.snmpResult.sysContact,
              interfaces: host.snmpResult.interfaces || [],
              lldpNeighbors: host.snmpResult.lldpNeighbors || [],
              cdpNeighbors: host.snmpResult.cdpNeighbors || [],
            },
          };
        }

        const deviceData = {
          scanJobId: scanJobId,
          macAddress: mac || null,
          hostname: host.hostname || null,
          manufacturer: classification?.manufacturer || null,
          deviceType: classification?.deviceType || 'Unknown',
          osInfo: classification?.osGuess || null,
          openPorts: host.openPorts ? JSON.stringify(host.openPorts) : null,
          services: classification?.services ? JSON.stringify(classification.services) : null,
          riskScore,
          lastSeenAt: new Date(),
          enrichmentStatus,
          enrichmentData: enrichmentData ? (enrichmentData as any) : undefined,
        };

        const result = await this.prisma.discoveredDevice.upsert({
          where: { tenantId_ipAddress: { tenantId, ipAddress: host.ip } },
          create: {
            tenantId,
            ipAddress: host.ip,
            ...deviceData,
            status: existingAssetId ? 'MERGED' : 'PENDING_REVIEW',
            approvedAssetId: existingAssetId || null,
            firstSeenAt: new Date(),
            seenCount: 1,
          },
          update: {
            ...deviceData,
            seenCount: { increment: 1 },
            // Don't overwrite APPROVED/IGNORED status on rescan
            ...(existingAssetId ? { status: 'MERGED', approvedAssetId: existingAssetId } : {}),
          },
        });

        // Count as new only if freshly created with PENDING_REVIEW
        if (result.seenCount === 1 && result.status === 'PENDING_REVIEW') {
          newCount++;
          this.eventBus.emitDiscoveryEvent(tenantId, 'device_discovered', {
            device: result,
            ipAddress: host.ip, deviceType: classification?.deviceType,
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

      // Emit final scan_progress with COMPLETED status so frontend triggers refresh
      this.eventBus.emitDiscoveryEvent(tenantId, 'scan_progress', {
        scanJobId, progress: 100, phase: 'Complete', found: aliveHosts.length, status: 'COMPLETED',
      });

      this.logger.log(`Scan ${scanJobId} completed: ${aliveHosts.length} devices, ${newCount} new (type: ${scanType})`);
    } catch (error: any) {
      await this.prisma.scanJob.update({
        where: { id: scanJobId },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: error.message },
      });

      // Emit scan_progress with FAILED status so frontend triggers refresh
      this.eventBus.emitDiscoveryEvent(tenantId, 'scan_progress', {
        scanJobId, progress: 0, phase: 'Failed', found: 0, status: 'FAILED',
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

  async stopScan(id: string, tenantId: string) {
    const scanJob = await this.prisma.scanJob.findFirst({
      where: { id, tenantId },
    });
    if (!scanJob) {
      throw new NotFoundException('Scan job not found');
    }
    if (scanJob.status !== 'RUNNING' && scanJob.status !== 'PENDING') {
      throw new BadRequestException(`Cannot stop a scan that is already ${scanJob.status.toLowerCase()}`);
    }

    const updated = await this.prisma.scanJob.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        errorMessage: 'Scan was stopped by administrator.',
      },
    });

    this.logger.log(`Scan job ${id} was stopped by administrator.`);
    return updated;
  }

  async deleteScan(id: string, tenantId: string) {
    const scanJob = await this.prisma.scanJob.findFirst({
      where: { id, tenantId },
    });
    if (!scanJob) {
      throw new NotFoundException('Scan job not found');
    }
    if (scanJob.status === 'RUNNING' || scanJob.status === 'PENDING') {
      throw new BadRequestException('Cannot delete a running or pending scan. Stop it first.');
    }

    // Delete discovered devices that are still PENDING_REVIEW from this scan
    // Don't delete APPROVED/MERGED/IGNORED devices — those are user decisions
    await this.prisma.discoveredDevice.deleteMany({
      where: {
        scanJobId: id,
        tenantId,
        status: 'PENDING_REVIEW',
      },
    });

    await this.prisma.scanJob.delete({ where: { id } });
    this.logger.log(`Scan job ${id} deleted.`);
    return { deleted: true };
  }

  async findPendingDevices(tenantId: string) {
    return this.prisma.discoveredDevice.findMany({
      where: { tenantId, status: 'PENDING_REVIEW' },
      include: { scanJob: { select: { name: true, subnet: true, scanType: true } } },
      orderBy: [{ riskScore: 'desc' }, { lastSeenAt: 'desc' }],
    });
  }

  async approveDevice(deviceId: string, tenantId: string, userId: string, data: {
    name?: string; assetTypeId?: string;
  }) {
    const device = await this.prisma.discoveredDevice.findFirst({
      where: { id: deviceId, tenantId },
    });
    if (!device) throw new NotFoundException('Device not found');

    // Auto-resolve asset type if not provided
    let assetTypeId = data.assetTypeId;
    if (!assetTypeId) {
      const typeName = this.mapDeviceTypeToAssetType(device.deviceType || undefined);
      let assetType = await this.prisma.assetType.findFirst({
        where: { tenantId, name: { contains: typeName, mode: 'insensitive' } },
      });
      if (!assetType) {
        // Create the asset type automatically
        assetType = await this.prisma.assetType.create({
          data: { tenantId, name: typeName, icon: this.getAssetTypeIcon(typeName) },
        });
      }
      assetTypeId = assetType.id;
    }

    const deviceName = data.name || device.hostname || `${device.deviceType || 'Device'} (${device.ipAddress})`;
    const enrichment = device.enrichmentData ? (device.enrichmentData as any) : null;

    const asset = await this.prisma.asset.create({
      data: {
        tenantId, name: deviceName, assetTypeId,
        ipAddress: device.ipAddress, macAddress: device.macAddress,
        hostname: device.hostname, status: 'ACTIVE',
        discoverySource: 'NETWORK_SCAN', createdById: userId,
        serialNumber: enrichment?.hardware?.serialNumber || null,
        manufacturer: device.manufacturer || enrichment?.hardware?.biosVendor || enrichment?.hardware?.manufacturer || null,
        model: enrichment?.hardware?.motherboard || enrichment?.hardware?.model || null,
        category: device.deviceType ? this.mapDeviceTypeToAssetType(device.deviceType) : 'Other',
      },
    });

    // Auto-add to Live Monitoring if it's a network device or server
    const typeName = this.mapDeviceTypeToAssetType(device.deviceType || undefined).toLowerCase();
    const isMonitoredType = ['server', 'network equipment', 'switch', 'router', 'firewall'].some(t => typeName.includes(t));
    if (isMonitoredType && asset.ipAddress) {
      await this.prisma.monitoredDevice.create({
        data: {
          tenantId,
          type: 'NETWORK_DEVICE',
          name: asset.name,
          ipAddress: asset.ipAddress,
          status: 'ONLINE',
          config: { deviceType: typeName, sourceAssetId: asset.id },
        },
      });
      this.eventBus.emitMonitoringEvent(tenantId, 'new_monitored_device', { deviceId: asset.id, name: asset.name, ipAddress: asset.ipAddress });
    }

    // Write Operating System details
    if (enrichment?.operatingSystem) {
      const osData = enrichment.operatingSystem;
      await this.prisma.osDetail.create({
        data: {
          assetId: asset.id,
          osName: osData.name || osData.osGuess || null,
          osVersion: osData.version || osData.kernel || null,
          osArchitecture: osData.architecture || null,
          uptimeDays: osData.uptime ? Math.floor(osData.uptime / (24 * 3600)) : null,
        },
      });
    }

    // Write Hardware details
    if (enrichment?.hardware) {
      const hwData = enrichment.hardware;
      let diskTotalGb = 0;
      if (hwData.diskDrives && Array.isArray(hwData.diskDrives)) {
        for (const disk of hwData.diskDrives) {
          const size = parseFloat(disk.sizeGb);
          if (!isNaN(size)) diskTotalGb += size;
        }
      }

      await this.prisma.hardwareDetail.create({
        data: {
          assetId: asset.id,
          cpuModel: hwData.cpuModel || null,
          cpuCores: hwData.cpuCores ? parseInt(hwData.cpuCores) : null,
          ramTotalGb: hwData.totalRamMb ? hwData.totalRamMb / 1024 : null,
          diskTotalGb: diskTotalGb || null,
          biosVendor: hwData.biosVendor || null,
          biosVersion: hwData.biosVersion || null,
          tpmEnabled: hwData.tpmEnabled !== undefined ? hwData.tpmEnabled : null,
          tpmVersion: hwData.tpmVersion || null,
        },
      });
    }

    // Write Security posture
    if (enrichment?.security || enrichment?.network) {
      const secData = enrichment.security;
      const netData = enrichment.network;
      const firewallStatus = secData?.firewallStatus || netData?.firewallStatus;
      const firewallEnabled = firewallStatus
        ? firewallStatus.toLowerCase().includes('enabled') || firewallStatus.toLowerCase().includes('active')
        : null;

      const encryptionStatus = secData?.encryptionEnabled || secData?.diskEncryptionStatus;
      const encryptionEnabled = typeof encryptionStatus === 'boolean'
        ? encryptionStatus
        : encryptionStatus
          ? encryptionStatus.toLowerCase().includes('enabled') || encryptionStatus.toLowerCase().includes('active') || encryptionStatus.toLowerCase().includes('encrypted')
          : null;

      await this.prisma.securityPosture.create({
        data: {
          assetId: asset.id,
          firewallEnabled: firewallEnabled,
          encryptionEnabled: encryptionEnabled,
          encryptionType: secData?.encryptionType || null,
          complianceScore: secData?.complianceScore || null,
          lastAssessedAt: new Date(),
        },
      });
    }
    
    // ─── Ingest Software Packages ──────────
    if (enrichment?.software?.packages && Array.isArray(enrichment.software.packages)) {
      this.softwareService.ingestSoftware(
        tenantId,
        asset.id,
        enrichment.software.packages,
      ).catch(err => this.logger.error(`Software ingestion failed during approval for asset ${asset.id}: ${err.message}`));
    }

    await this.prisma.discoveredDevice.update({
      where: { id: deviceId },
      data: { status: 'APPROVED', approvedAssetId: asset.id },
    });

    this.eventBus.emitAssetEvent(tenantId, 'created', {
      assetId: asset.id, name: asset.name, source: 'discovery',
    });

    return asset;
  }

  /**
   * Merge discovered device specs into an existing managed asset
   */
  async mergeDevice(deviceId: string, tenantId: string, userId: string, data: { assetId: string }) {
    const device = await this.prisma.discoveredDevice.findFirst({
      where: { id: deviceId, tenantId },
    });
    if (!device) throw new NotFoundException('Discovered device not found');

    const asset = await this.prisma.asset.findFirst({
      where: { id: data.assetId, tenantId, deletedAt: null },
      include: {
        osDetails: true,
        hardwareDetails: true,
        securityPosture: true,
      },
    });
    if (!asset) throw new NotFoundException('Target asset not found');

    const assetUpdateData: any = {};
    if (!asset.ipAddress && device.ipAddress) assetUpdateData.ipAddress = device.ipAddress;
    if (!asset.macAddress && device.macAddress) assetUpdateData.macAddress = device.macAddress;
    if (!asset.hostname && device.hostname) assetUpdateData.hostname = device.hostname;

    const enrichment = device.enrichmentData ? (device.enrichmentData as any) : null;
    const discoveredManufacturer = device.manufacturer || enrichment?.hardware?.biosVendor || enrichment?.hardware?.manufacturer;
    const discoveredModel = enrichment?.hardware?.motherboard || enrichment?.hardware?.model;

    if (!asset.serialNumber && enrichment?.hardware?.serialNumber) {
      assetUpdateData.serialNumber = enrichment.hardware.serialNumber;
    }
    if (!asset.manufacturer && discoveredManufacturer) {
      assetUpdateData.manufacturer = discoveredManufacturer;
    }
    if (!asset.model && discoveredModel) {
      assetUpdateData.model = discoveredModel;
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id: asset.id },
      data: assetUpdateData,
    });

    // Merge Operating System details
    if (enrichment?.operatingSystem) {
      const osData = enrichment.operatingSystem;
      const existingOs = asset.osDetails;

      await this.prisma.osDetail.upsert({
        where: { assetId: asset.id },
        create: {
          assetId: asset.id,
          osName: osData.name || osData.osGuess || null,
          osVersion: osData.version || osData.kernel || null,
          osArchitecture: osData.architecture || null,
          uptimeDays: osData.uptime ? Math.floor(osData.uptime / (24 * 3600)) : null,
        },
        update: {
          osName: existingOs?.osName || osData.name || osData.osGuess || null,
          osVersion: existingOs?.osVersion || osData.version || osData.kernel || null,
          osArchitecture: existingOs?.osArchitecture || osData.architecture || null,
          uptimeDays: existingOs?.uptimeDays || (osData.uptime ? Math.floor(osData.uptime / (24 * 3600)) : null),
        },
      });
    }

    // Merge Hardware details
    if (enrichment?.hardware) {
      const hwData = enrichment.hardware;
      const existingHw = asset.hardwareDetails;

      let diskTotalGb = 0;
      if (hwData.diskDrives && Array.isArray(hwData.diskDrives)) {
        for (const disk of hwData.diskDrives) {
          const size = parseFloat(disk.sizeGb);
          if (!isNaN(size)) diskTotalGb += size;
        }
      }

      await this.prisma.hardwareDetail.upsert({
        where: { assetId: asset.id },
        create: {
          assetId: asset.id,
          cpuModel: hwData.cpuModel || null,
          cpuCores: hwData.cpuCores ? parseInt(hwData.cpuCores) : null,
          ramTotalGb: hwData.totalRamMb ? hwData.totalRamMb / 1024 : null,
          diskTotalGb: diskTotalGb || null,
          biosVendor: hwData.biosVendor || null,
          biosVersion: hwData.biosVersion || null,
          tpmEnabled: hwData.tpmEnabled !== undefined ? hwData.tpmEnabled : null,
          tpmVersion: hwData.tpmVersion || null,
        },
        update: {
          cpuModel: existingHw?.cpuModel || hwData.cpuModel || null,
          cpuCores: existingHw?.cpuCores || (hwData.cpuCores ? parseInt(hwData.cpuCores) : null),
          ramTotalGb: existingHw?.ramTotalGb || (hwData.totalRamMb ? hwData.totalRamMb / 1024 : null),
          diskTotalGb: existingHw?.diskTotalGb || diskTotalGb || null,
          biosVendor: existingHw?.biosVendor || hwData.biosVendor || null,
          biosVersion: existingHw?.biosVersion || hwData.biosVersion || null,
          tpmEnabled: existingHw?.tpmEnabled !== null ? existingHw?.tpmEnabled : (hwData.tpmEnabled !== undefined ? hwData.tpmEnabled : null),
          tpmVersion: existingHw?.tpmVersion || hwData.tpmVersion || null,
        },
      });
    }

    // Merge Security posture
    if (enrichment?.security || enrichment?.network) {
      const secData = enrichment.security;
      const netData = enrichment.network;
      const existingSec = asset.securityPosture;
      const firewallStatus = secData?.firewallStatus || netData?.firewallStatus;
      const firewallEnabled = firewallStatus
        ? firewallStatus.toLowerCase().includes('enabled') || firewallStatus.toLowerCase().includes('active')
        : null;

      const encryptionStatus = secData?.encryptionEnabled || secData?.diskEncryptionStatus;
      const encryptionEnabled = typeof encryptionStatus === 'boolean'
        ? encryptionStatus
        : encryptionStatus
          ? encryptionStatus.toLowerCase().includes('enabled') || encryptionStatus.toLowerCase().includes('active') || encryptionStatus.toLowerCase().includes('encrypted')
          : null;

      await this.prisma.securityPosture.upsert({
        where: { assetId: asset.id },
        create: {
          assetId: asset.id,
          firewallEnabled: firewallEnabled,
          encryptionEnabled: encryptionEnabled,
          encryptionType: secData?.encryptionType || null,
          complianceScore: secData?.complianceScore || null,
          lastAssessedAt: new Date(),
        },
        update: {
          firewallEnabled: existingSec?.firewallEnabled !== null ? existingSec?.firewallEnabled : firewallEnabled,
          encryptionEnabled: existingSec?.encryptionEnabled !== null ? existingSec?.encryptionEnabled : encryptionEnabled,
          encryptionType: existingSec?.encryptionType || secData?.encryptionType || null,
          complianceScore: existingSec?.complianceScore || secData?.complianceScore || null,
          lastAssessedAt: new Date(),
        },
      });
    }

    await this.prisma.discoveredDevice.update({
      where: { id: deviceId },
      data: { status: 'MERGED', approvedAssetId: asset.id },
    });

    this.eventBus.emitAssetEvent(tenantId, 'updated', {
      assetId: asset.id, name: asset.name, source: 'discovery-merge',
    });

    return updatedAsset;
  }

  async bulkApprove(tenantId: string, userId: string, deviceIds: string[]) {
    const results = [];
    for (const id of deviceIds) {
      try {
        const asset = await this.approveDevice(id, tenantId, userId, {});
        results.push({ id, status: 'approved', assetId: asset.id });
      } catch (err: any) {
        results.push({ id, status: 'failed', error: err.message });
      }
    }
    return results;
  }

  async bulkIgnore(tenantId: string, deviceIds: string[]) {
    await this.prisma.discoveredDevice.updateMany({
      where: { id: { in: deviceIds }, tenantId, status: 'PENDING_REVIEW' },
      data: { status: 'IGNORED' },
    });
    return { ignored: deviceIds.length };
  }

  private mapDeviceTypeToAssetType(deviceType?: string): string {
    const map: Record<string, string> = {
      'Windows Server': 'Server', 'Linux Server': 'Server', 'Web Server': 'Server',
      'Windows Workstation': 'Workstation', 'Linux Workstation': 'Workstation',
      'Apple Device': 'Workstation', 'Printer': 'Printer',
      'Network Device': 'Network Equipment', 'Virtual Machine': 'Virtual Machine',
    };
    return map[deviceType || ''] || 'Other';
  }

  private getAssetTypeIcon(typeName: string): string {
    const icons: Record<string, string> = {
      'Server': 'server', 'Workstation': 'monitor', 'Printer': 'printer',
      'Network Equipment': 'network', 'Virtual Machine': 'cloud', 'Other': 'help-circle',
    };
    return icons[typeName] || 'help-circle';
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

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkStaleAgents() {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const staleAgents = await this.prisma.agent.findMany({
      where: {
        status: 'ONLINE',
        lastHeartbeat: { lt: staleThreshold },
      },
    });

    for (const agent of staleAgents) {
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: { status: 'STALE' },
      });

      // Update linked asset status to IN_MAINTENANCE or OFFLINE
      if (agent.assetId) {
        await this.prisma.asset.update({
          where: { id: agent.assetId },
          data: { status: 'IN_MAINTENANCE' },
        });
      }

      this.eventBus.emitDiscoveryEvent(agent.tenantId, 'agent_offline', {
        agentId: agent.id,
        hostname: agent.hostname,
        ipAddress: agent.ipAddress,
        lastHeartbeat: agent.lastHeartbeat,
        message: `Agent ${agent.hostname} has gone offline`,
      });

      this.eventBus.emitMonitoringEvent(agent.tenantId, 'device_down', {
        deviceId: agent.id,
        name: agent.hostname,
        type: 'AGENT',
      });

      this.logger.warn(`Agent ${agent.hostname} (${agent.ipAddress}) marked as STALE — last heartbeat: ${agent.lastHeartbeat?.toISOString()}`);
    }

    if (staleAgents.length > 0) {
      this.logger.log(`Stale agent check: ${staleAgents.length} agent(s) marked as STALE.`);
    }
  }

  async getAgent(id: string, tenantId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async deleteAgent(id: string, tenantId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');

    // Unlink from any associated asset
    if (agent.assetId) {
      await this.prisma.asset.updateMany({
        where: { id: agent.assetId, agentId: agent.id },
        data: { agentId: null },
      });
    }

    await this.prisma.agent.delete({ where: { id } });
    this.logger.log(`Agent ${agent.hostname} (${agent.ipAddress}) deleted from tenant ${tenantId}`);
    return { deleted: true };
  }

  async registerAgent(tenantId: string, data: {
    id?: string;
    hostname: string; platform: string; agentVersion: string;
    ipAddress: string; macAddress?: string; systemInfo?: any;
  }) {
    // 1. Check for existing agent by ID first if provided
    if (data.id) {
      const existingById = await this.prisma.agent.findFirst({
        where: { id: data.id, tenantId },
      });
      if (existingById) {
        return this.prisma.agent.update({
          where: { id: existingById.id },
          data: { ...data, lastHeartbeat: new Date(), status: 'ONLINE' },
        });
      }
    }

    // 2. Check for existing agent by hostname + IP (legacy / fallback)
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

  async agentHeartbeat(id: string, tenantId: string, data?: { systemInfo?: any; version?: string }) {
    const agent = await this.prisma.agent.findFirst({ where: { id, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');

    let updated: any;

    if (agent.status !== 'ONLINE') {
      updated = await this.prisma.agent.update({
        where: { id },
        data: {
          lastHeartbeat: new Date(),
          status: 'ONLINE',
          ...(data?.systemInfo ? { systemInfo: data.systemInfo } : {}),
          ...(data?.version ? { agentVersion: data.version } : {}),
        },
      });

      // If linked to an asset, ensure it's ACTIVE
      if (agent.assetId) {
        await this.prisma.asset.update({
          where: { id: agent.assetId },
          data: { status: 'ACTIVE' },
        });
      }

      this.eventBus.emitMonitoringEvent(tenantId, 'device_recovered', {
        deviceId: agent.id,
        name: agent.hostname,
        type: 'AGENT',
      });
    } else {
      updated = await this.prisma.agent.update({
        where: { id },
        data: {
          lastHeartbeat: new Date(),
          status: 'ONLINE',
          ...(data?.systemInfo ? { systemInfo: data.systemInfo } : {}),
          ...(data?.version ? { agentVersion: data.version } : {}),
        },
      });
    }

    // Warn if agent version is outdated
    const LATEST_AGENT_VERSION = '2.0.0';
    if (data?.version && data.version < LATEST_AGENT_VERSION) {
      this.logger.warn(`Agent ${agent.hostname} is running outdated version ${data.version} (latest: ${LATEST_AGENT_VERSION})`);
    }

    // Emit heartbeat event for real-time UI updates
    this.eventBus.emitDiscoveryEvent(tenantId, 'agent_heartbeat', {
      agentId: agent.id,
      hostname: agent.hostname,
      ipAddress: agent.ipAddress,
      status: 'ONLINE',
    });

    // Run compliance change detection and sync systemInfo snapshot directly to CMDB Asset tables
    if (data?.systemInfo) {
      try {
        await this.complianceService.processHeartbeat(tenantId, id, agent, data.systemInfo);
      } catch (err) {
        this.logger.warn(`Compliance check failed for agent ${agent.hostname}: ${err.message}`);
      }

      // Sync software inventory directly to SoftwareCatalog and SoftwareInstallation
      if (data.systemInfo.software && Array.isArray(data.systemInfo.software) && agent.assetId) {
        try {
          await this.softwareService.ingestSoftware(tenantId, agent.assetId, data.systemInfo.software);
        } catch (err) {
          this.logger.warn(`Software sync failed for agent ${agent.hostname}: ${err.message}`);
        }

        // Authenticated CVE match from agent product inventory + CRITICAL auto-tickets
        if (this.vulnerabilitiesService) {
          try {
            const products = data.systemInfo.software
              .filter((p: any) => p?.name)
              .map((p: any) => ({ name: String(p.name), version: p.version ? String(p.version) : undefined }))
              .slice(0, 200);
            if (products.length > 0) {
              // Throttle: at most once per 6 hours per agent (stored on systemInfo)
              const lastScan = Number((data.systemInfo as any)?._lastCveScanAt || 0);
              const sixHours = 6 * 60 * 60 * 1000;
              if (Date.now() - lastScan > sixHours) {
                const scanResult = await this.vulnerabilitiesService.agentProductScan(tenantId, {
                  assetId: agent.assetId,
                  agentId: agent.id,
                  hostname: agent.hostname,
                  products,
                  autoTicket: true,
                });
                const info = ((await this.prisma.agent.findUnique({ where: { id } }))?.systemInfo as any) || {};
                await this.prisma.agent.update({
                  where: { id },
                  data: {
                    systemInfo: {
                      ...info,
                      _lastCveScanAt: Date.now(),
                      _lastCveScanResult: {
                        matched: scanResult.matched,
                        critical: scanResult.critical,
                        ticketsCreated: scanResult.ticketsCreated,
                      },
                    },
                  },
                });
                if (scanResult.critical > 0) {
                  this.logger.warn(
                    `Agent CVE scan ${agent.hostname}: ${scanResult.matched} matches, ${scanResult.critical} CRITICAL, ${scanResult.ticketsCreated} tickets`,
                  );
                }
              }
            }
          } catch (err: any) {
            this.logger.warn(`Agent CVE scan failed for ${agent.hostname}: ${err?.message || err}`);
          }
        }
      }

      // Evaluate security alert rules against agent telemetry
      try {
        await this.alertsService.evaluateHeartbeat(
          tenantId, id, data.systemInfo, agent.hostname,
        );
      } catch (err) {
        this.logger.warn(`Alert evaluation failed for agent ${agent.hostname}: ${err.message}`);
      }

      // --- Live CMDB Asset Synchronization ---
      try {
        let asset = null;
        if (agent.assetId) {
          asset = await this.prisma.asset.findFirst({
            where: { id: agent.assetId, tenantId, deletedAt: null },
          });
        }
        if (!asset) {
          asset = await this.prisma.asset.findFirst({
            where: {
              tenantId,
              deletedAt: null,
              OR: [
                { agentId: agent.id },
                ...(agent.macAddress ? [{ macAddress: agent.macAddress }] : []),
                { hostname: agent.hostname, ipAddress: agent.ipAddress }
              ]
            },
          });
        }

        if (!asset) {
          // Provision a new Asset automatically for this agent
          let typeName = 'Workstation';
          if (agent.platform === 'linux') {
            typeName = agent.hostname.toLowerCase().includes('server') ? 'Server' : 'Workstation';
          } else if (agent.platform === 'windows') {
            typeName = agent.hostname.toLowerCase().includes('server') ? 'Server' : 'Workstation';
          }

          let assetType = await this.prisma.assetType.findFirst({
            where: { tenantId, name: { contains: typeName, mode: 'insensitive' } },
          });
          if (!assetType) {
            assetType = await this.prisma.assetType.create({
              data: { tenantId, name: typeName, icon: this.getAssetTypeIcon(typeName) },
            });
          }

          asset = await this.prisma.asset.create({
            data: {
              tenantId,
              name: agent.hostname,
              assetTypeId: assetType.id,
              ipAddress: agent.ipAddress,
              macAddress: agent.macAddress,
              hostname: agent.hostname,
              status: 'ACTIVE',
              discoverySource: 'AGENT',
              serialNumber: data.systemInfo.hardware?.serialNumber || null,
              manufacturer: data.systemInfo.hardware?.biosVendor || null,
              model: data.systemInfo.hardware?.motherboard || null,
              category: typeName,
              agentId: agent.id,
              lastScannedAt: new Date(),
            },
          });

          // Link agent to the new asset
          await this.prisma.agent.update({
            where: { id: agent.id },
            data: { assetId: asset.id },
          });
        } else {
          // Ensure agent-asset cross-link exists
          if (agent.assetId !== asset.id || !asset.agentId) {
            await this.prisma.agent.update({
              where: { id: agent.id },
              data: { assetId: asset.id },
            });
            if (!asset.agentId) {
              await this.prisma.asset.update({
                where: { id: asset.id },
                data: { agentId: agent.id },
              });
            }
          }
        }

        // Dynamically update the main Asset fields
        const assetUpdateData: any = {
          lastScannedAt: new Date(),
        };
        if (data.systemInfo.hardware?.serialNumber && asset.serialNumber !== data.systemInfo.hardware.serialNumber) {
          assetUpdateData.serialNumber = data.systemInfo.hardware.serialNumber;
        }
        if (data.systemInfo.hardware?.biosVendor && !asset.manufacturer) {
          assetUpdateData.manufacturer = data.systemInfo.hardware.biosVendor;
        }
        if (data.systemInfo.hardware?.motherboard && !asset.model) {
          assetUpdateData.model = data.systemInfo.hardware.motherboard;
        }
        if (agent.ipAddress && asset.ipAddress !== agent.ipAddress) {
          assetUpdateData.ipAddress = agent.ipAddress;
        }
        if (agent.macAddress && asset.macAddress !== agent.macAddress) {
          assetUpdateData.macAddress = agent.macAddress;
        }

        await this.prisma.asset.update({
          where: { id: asset.id },
          data: assetUpdateData,
        });

        // Upsert OS Details
        const osData = data.systemInfo.operatingSystem;
        if (osData) {
          await this.prisma.osDetail.upsert({
            where: { assetId: asset.id },
            create: {
              assetId: asset.id,
              osName: osData.type || osData.platform || null,
              osVersion: osData.release || null,
              osArchitecture: osData.arch || null,
              uptimeDays: osData.uptime ? Math.floor(osData.uptime / (24 * 3600)) : null,
            },
            update: {
              osName: osData.type || osData.platform || null,
              osVersion: osData.release || null,
              osArchitecture: osData.arch || null,
              uptimeDays: osData.uptime ? Math.floor(osData.uptime / (24 * 3600)) : null,
            },
          });
        }

        // Upsert Hardware Details
        const hwData = data.systemInfo.hardware;
        if (hwData) {
          let diskTotalGb = 0;
          if (hwData.diskDrives && Array.isArray(hwData.diskDrives)) {
            for (const disk of hwData.diskDrives) {
              const size = parseFloat(disk.sizeGb || (disk.sizeBytes ? (disk.sizeBytes / (1024 * 1024 * 1024)).toString() : '0'));
              if (!isNaN(size)) diskTotalGb += size;
            }
          }

          const ramTotalGb = hwData.totalRamMb
            ? parseFloat((hwData.totalRamMb / 1024).toFixed(2))
            : null;

          const cpuSpeedGhz = hwData.cpuSpeed
            ? parseFloat((hwData.cpuSpeed / 1000).toFixed(2))
            : null;

          await this.prisma.hardwareDetail.upsert({
            where: { assetId: asset.id },
            create: {
              assetId: asset.id,
              cpuModel: hwData.cpuModel || null,
              cpuCores: hwData.cpuCores ? parseInt(hwData.cpuCores) : null,
              cpuSpeedGhz: cpuSpeedGhz,
              ramTotalGb: ramTotalGb,
              diskTotalGb: diskTotalGb || null,
              biosVendor: hwData.biosVendor || null,
              biosVersion: hwData.biosVersion || null,
              tpmEnabled: hwData.tpmEnabled !== undefined ? hwData.tpmEnabled : null,
              tpmVersion: hwData.tpmVersion || null,
            },
            update: {
              cpuModel: hwData.cpuModel || null,
              cpuCores: hwData.cpuCores ? parseInt(hwData.cpuCores) : null,
              cpuSpeedGhz: cpuSpeedGhz,
              ramTotalGb: ramTotalGb,
              diskTotalGb: diskTotalGb || null,
              biosVendor: hwData.biosVendor || null,
              biosVersion: hwData.biosVersion || null,
              tpmEnabled: hwData.tpmEnabled !== undefined ? hwData.tpmEnabled : null,
              tpmVersion: hwData.tpmVersion || null,
            },
          });
        }

        // Upsert Security Posture Details
        const secData = data.systemInfo.security;
        if (secData) {
          const firewallStatus = secData.firewallStatus || secData.firewallEnabled;
          const firewallEnabled = typeof firewallStatus === 'boolean'
            ? firewallStatus
            : firewallStatus
              ? firewallStatus.toString().toLowerCase().includes('enabled') || firewallStatus.toString().toLowerCase().includes('active')
              : null;

          const encryptionStatus = secData.encryptionEnabled || secData.diskEncryptionStatus;
          const encryptionEnabled = typeof encryptionStatus === 'boolean'
            ? encryptionStatus
            : encryptionStatus
              ? encryptionStatus.toString().toLowerCase().includes('enabled') || encryptionStatus.toString().toLowerCase().includes('active') || encryptionStatus.toString().toLowerCase().includes('encrypted')
              : null;

          await this.prisma.securityPosture.upsert({
            where: { assetId: asset.id },
            create: {
              assetId: asset.id,
              firewallEnabled: firewallEnabled,
              encryptionEnabled: encryptionEnabled,
              encryptionType: secData.encryptionType || null,
              complianceScore: secData.complianceScore || null,
              lastAssessedAt: new Date(),
            },
            update: {
              firewallEnabled: firewallEnabled,
              encryptionEnabled: encryptionEnabled,
              encryptionType: secData.encryptionType || null,
              complianceScore: secData.complianceScore || null,
              lastAssessedAt: new Date(),
            },
          });
        }

        // --- Software Ingestion from Agent ---
        if (data.systemInfo.software?.packages && Array.isArray(data.systemInfo.software.packages)) {
          this.softwareService.ingestSoftware(
            tenantId,
            asset.id,
            data.systemInfo.software.packages,
          ).catch(err => this.logger.error(`Software ingestion failed for agent ${agent.hostname}: ${err.message}`));
        }
      } catch (err: any) {
        this.logger.error(`Live CMDB synchronization failed for agent ${agent.hostname}: ${err.message}`);
      }
    }

    // Query active compliance changes requiring mitigation (only automatic blocks or admin-rejected items)
    const activeThreats = await this.prisma.endpointChange.findMany({
      where: {
        agentId: id,
        status: { in: ['VIOLATION', 'REJECTED'] }, // PENDING_REVIEW should NOT trigger active mitigation until reviewed!
      },
    });

    const actions: any[] = activeThreats.map((threat: any) => {
      const val = threat.newValue as any;
      if (threat.category === 'PROCESS_BLOCKED') {
        return {
          type: 'KILL_PROCESS',
          processName: val?.name || '',
          pid: val?.pid || '',
          command: val?.command || '',
        };
      } else if (threat.category === 'UNAUTHORIZED_ACCESS' && val?.port !== undefined && val?.port !== null) {
        return {
          type: 'BLOCK_PORT',
          port: val.port,
          processName: val.process || '',
          pid: val.pid || '',
        };
      } else if (threat.category === 'USB_DEVICE' || threat.category === 'DISK_CHANGE') {
        return {
          type: 'BLOCK_USB',
          deviceName: val?.name || 'Storage Drive',
          serialNumber: val?.serial || '',
          mountPoint: val?.mount || '',
        };
      } else if (threat.category === 'CERTIFICATE_CHANGE' || threat.category === 'PERSISTENCE_CHANGE') {
        if (threat.severity === 'CRITICAL') {
          return {
            type: 'QUARANTINE_DEVICE',
            reason: threat.summary,
            allowServerOnly: true,
          };
        }
        return {
          type: 'ALERT',
          category: threat.category,
          summary: threat.summary,
          details: val,
        };
      } else {
        return {
          type: 'ALERT',
          category: threat.category,
          summary: threat.summary,
          details: val,
        };
      }
    });

    // Queue any pending network scans for this tenant to the agent
    const pendingScan = await this.prisma.scanJob.findFirst({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });

    if (pendingScan) {
      actions.push({
        type: 'RUN_SCAN',
        scanJobId: pendingScan.id,
        subnet: pendingScan.subnet,
        scanType: pendingScan.scanType,
        portRange: pendingScan.portRange,
      });

      // Mark the scan job as RUNNING so it is not picked up by other heartbeats
      await this.prisma.scanJob.update({
        where: { id: pendingScan.id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      this.logger.log(`Delegated scan job ${pendingScan.id} to agent ${agent.hostname}`);
    }

    // Queue any pending SNMP scan jobs for this tenant to the agent
    const pendingSnmpScan = await this.prisma.scanJob.findFirst({
      where: { tenantId, status: 'PENDING', scanType: 'SNMP_DISCOVERY' },
      orderBy: { createdAt: 'asc' },
    });

    if (pendingSnmpScan) {
      const communities = await this.getSnmpCommunities(tenantId);
      actions.push({
        type: 'SNMP_SCAN',
        scanJobId: pendingSnmpScan.id,
        subnet: pendingSnmpScan.subnet,
        communities,
      });

      await this.prisma.scanJob.update({
        where: { id: pendingSnmpScan.id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      this.logger.log(`Delegated SNMP scan job ${pendingSnmpScan.id} to agent ${agent.hostname}`);
    }

    // Queue any pending script executions for this agent
    const pendingScripts = await this.prisma.scanResult.findMany({
      where: {
        tenantId,
        scanType: 'SCRIPT_EXECUTION',
        status: 'QUEUED',
        summary: { path: ['agentId'], equals: id },
      },
      take: 5,
    });

    for (const exec of pendingScripts) {
      const summary = exec.summary as any;
      actions.push({
        type: 'EXECUTE_SCRIPT',
        executionId: exec.id,
        scriptId: summary?.scriptId,
        scriptName: summary?.scriptName,
        scriptContent: exec.rawOutput,
        platform: summary?.platform || 'BASH',
        parameters: summary?.parameters || {},
        timeoutSeconds: summary?.timeoutSeconds || 300,
      });

      await this.prisma.scanResult.update({
        where: { id: exec.id },
        data: { status: 'DISPATCHED' },
      });

      this.logger.log(`Dispatched script "${summary?.scriptName}" (${exec.id}) to agent ${agent.hostname}`);
    }

    // Check if tenant has agentStartOnBoot enabled — push INSTALL_SERVICE to agents that haven't installed yet
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });
      const tenantSettings = typeof tenant?.settings === 'object' ? (tenant.settings as Record<string, any>) : {};
      const startOnBoot = tenantSettings.agentStartOnBoot;
      const agentInfo = (updated.systemInfo as any) || {};
      const serviceInstalled = agentInfo?.serviceInstalled === true;

      if (startOnBoot === true && !serviceInstalled) {
        actions.push({ type: 'INSTALL_SERVICE' });
        this.logger.log(`Dispatching INSTALL_SERVICE to agent ${agent.hostname} (Start on Boot enabled)`);
      } else if (startOnBoot === false && serviceInstalled) {
        actions.push({ type: 'UNINSTALL_SERVICE' });
        this.logger.log(`Dispatching UNINSTALL_SERVICE to agent ${agent.hostname} (Start on Boot disabled)`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to check agentStartOnBoot setting: ${err.message}`);
    }

    // Drain admin-enqueued threat actions from systemInfo._pendingActions
    try {
      const info = (updated.systemInfo as any) || {};
      const pending: any[] = Array.isArray(info._pendingActions) ? info._pendingActions : [];
      if (pending.length > 0) {
        const pendingFilePulls: any[] = Array.isArray(info._pendingFilePulls)
          ? info._pendingFilePulls
          : [];
        for (const act of pending) {
          actions.push(act);
          if (act?.type === 'FILE_PULL') pendingFilePulls.push(act);
        }
        info._pendingActions = [];
        info._pendingFilePulls = pendingFilePulls.slice(-20);
        await this.prisma.agent.update({
          where: { id },
          data: { systemInfo: info },
        });
        this.logger.log(`Drained ${pending.length} pending action(s) to agent ${agent.hostname}`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to drain _pendingActions for agent ${id}: ${err.message}`);
    }

    // Inject live software blacklist policy for this agent's asset
    try {
      const blacklist = await this.prisma.softwareCatalog.findMany({
        where: {
          tenantId,
          OR: [{ isBlacklisted: true }, { authorizationStatus: 'BLACKLISTED' }],
        },
        select: { id: true, name: true },
        take: 200,
      });
      if (blacklist.length) {
        actions.push({
          type: 'SOFTWARE_POLICY',
          blacklist: blacklist.map((s) => ({
            softwareId: s.id,
            name: s.name,
            processName: `${(s.name.split(/\s+/)[0] || 'unknown').replace(/[^a-zA-Z0-9._\-]/g, '')}.exe`,
            action: 'BLOCK',
          })),
          whitelist: [],
          updatedAt: new Date().toISOString(),
        });

        if (agent.assetId) {
          const badInstalls = await this.prisma.softwareInstallation.findMany({
            where: {
              tenantId,
              assetId: agent.assetId,
              softwareId: { in: blacklist.map((b) => b.id) },
            },
            include: { software: { select: { name: true } } },
          });
          for (const inst of badInstalls) {
            const pname = `${(inst.software.name.split(/\s+/)[0] || 'unknown').replace(/[^a-zA-Z0-9._\-]/g, '')}.exe`;
            actions.push({
              type: 'KILL_PROCESS',
              processName: pname,
              reason: `Blacklisted: ${inst.software.name}`,
              softwareId: inst.softwareId,
            });
            actions.push({
              type: 'BLOCK_INSTALL',
              softwareName: inst.software.name,
              processName: pname,
              reason: 'BLACKLISTED',
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to inject software policy for agent ${id}: ${err.message}`);
    }

    // Drain admin-enqueued remote commands → REMOTE_COMMAND actions
    try {
      const info = ((await this.prisma.agent.findUnique({ where: { id } }))?.systemInfo as any) || {};
      const pendingCmds: any[] = Array.isArray(info._pendingCommands) ? info._pendingCommands : [];
      const stillQueued: any[] = [];
      for (const cmd of pendingCmds) {
        if (cmd.status === 'QUEUED' || !cmd.status) {
          actions.push({
            type: 'REMOTE_COMMAND',
            commandId: cmd.id,
            command: cmd.command,
            timeout: cmd.timeout || 30000,
          });
        } else {
          stillQueued.push(cmd);
        }
      }
      if (pendingCmds.length !== stillQueued.length) {
        info._pendingCommands = stillQueued;
        await this.prisma.agent.update({
          where: { id },
          data: { systemInfo: info },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to drain _pendingCommands for agent ${id}: ${err.message}`);
    }

    // Queue software / patch package installs for this agent's linked asset (deploy rings)
    try {
      const agentRing = ((updated.systemInfo as any)?.deployRing || 'ALL').toUpperCase();
      const ringOrder = { PILOT: 1, STAGED: 2, ALL: 3 } as Record<string, number>;
      const agentRank = ringOrder[agentRing] || 3;

      if (updated.assetId) {
        const deployments = await this.prisma.patchDeployment.findMany({
          where: {
            tenantId,
            assetId: updated.assetId,
            status: 'QUEUED',
          },
          include: { patch: true },
          take: 5,
        });
        for (const dep of deployments) {
          const patchRing = (dep.patch?.deployRing || 'ALL').toUpperCase();
          const requiredRank = ringOrder[patchRing] || 3;
          // Agent must be in a ring at least as early as the patch's ring
          // PILOT patch → only PILOT agents; STAGED → PILOT+STAGED; ALL → everyone
          if (agentRank > requiredRank) continue;

          let pkg: any = {};
          try {
            pkg = dep.output ? JSON.parse(dep.output) : {};
          } catch {
            pkg = {};
          }
          if (pkg.action === 'INSTALL_PACKAGE' || dep.patch?.category === 'Software Deployment') {
            actions.push({
              type: 'INSTALL_PACKAGE',
              deploymentId: dep.id,
              packageName: pkg.packageName || dep.patch?.title,
              packageUrl: pkg.packageUrl,
              packageType: pkg.packageType,
              silent: pkg.silent ?? true,
              deployRing: patchRing,
            });
          } else {
            actions.push({
              type: 'INSTALL_PACKAGE',
              deploymentId: dep.id,
              packageName: dep.patch?.patchId || dep.patch?.title,
              packageUrl: pkg.packageUrl,
              packageType: pkg.packageType || 'patch',
              silent: true,
              deployRing: patchRing,
            });
          }
          await this.prisma.patchDeployment.update({
            where: { id: dep.id },
            data: { status: 'DEPLOYING' },
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to queue package deploys for agent ${id}: ${err.message}`);
    }

    return {
      ...updated,
      actions,
    };
  }

  /**
   * Process scan results uploaded by an on-premise agent
   */
  async processAgentScanResults(scanJobId: string, tenantId: string, devices: any[]) {
    this.logger.log(`Processing scan results for scan job ${scanJobId} from agent. Devices found: ${devices.length}`);

    const scanJob = await this.prisma.scanJob.findFirst({
      where: { id: scanJobId, tenantId },
    });
    if (!scanJob) {
      throw new NotFoundException('Scan job not found');
    }
    if (scanJob.status === 'CANCELLED') {
      throw new BadRequestException('This scan job was cancelled/stopped by the administrator.');
    }

    try {
      // Check which IPs already exist as managed assets (for auto-merge)
      const existingAssets = await this.prisma.asset.findMany({
        where: { tenantId, deletedAt: null, ipAddress: { in: devices.map(d => d.ip) } },
        select: { id: true, ipAddress: true },
      });
      const assetByIp = new Map(existingAssets.map(a => [a.ipAddress, a.id]));

      let newCount = 0;
      for (const host of devices) {
        const mac = host.mac || null;
        const existingAssetId = assetByIp.get(host.ip);
        const openPorts = host.openPorts || [];
        let deviceType = host.deviceType || 'Unknown';
        let hostname = host.hostname || null;
        let manufacturer = host.manufacturer || null;
        const riskScore = calculateRiskScore(openPorts, host.hostname, deviceType);

        // Handle SNMP results from agent
        let enrichmentData = host.enrichmentData ? (host.enrichmentData as any) : null;
        let enrichmentStatus = host.enrichmentData ? 'ENRICHED' : 'BASIC';

        if (host.snmpResults && (host.snmpResults.sysDescr || host.snmpResults.sysName)) {
          const snmpClassification = this.classifyDeviceFromSnmp(
            host.snmpResults.sysDescr || '',
            mac || undefined,
          );
          deviceType = snmpClassification.deviceType || deviceType;
          manufacturer = snmpClassification.manufacturer || manufacturer;
          if (host.snmpResults.sysName) {
            hostname = host.snmpResults.sysName;
          }
          enrichmentStatus = 'ENRICHED';
          enrichmentData = {
            collectedAt: new Date().toISOString(),
            method: 'SNMP',
            hardware: {
              manufacturer: snmpClassification.manufacturer,
              model: snmpClassification.model,
              cpuLoad: host.snmpResults.cpuLoad || null,
              memoryPercent: host.snmpResults.memoryPercent || null,
            },
            operatingSystem: {
              name: snmpClassification.osGuess,
              osGuess: snmpClassification.osGuess,
              hostname: host.snmpResults.sysName,
              uptime: host.snmpResults.sysUpTime ? Math.floor(host.snmpResults.sysUpTime / 100) : null,
            },
            network: {
              sysName: host.snmpResults.sysName,
              sysLocation: host.snmpResults.sysLocation,
              sysContact: host.snmpResults.sysContact,
              interfaces: host.snmpResults.interfaces || [],
            },
          };
        }

        const deviceData = {
          scanJobId: scanJobId,
          macAddress: mac || null,
          hostname,
          manufacturer,
          deviceType: deviceType,
          osGuess: host.osInfo || null,
          osInfo: host.osInfo || null,
          openPorts: openPorts.length > 0 ? JSON.stringify(openPorts) : null,
          services: openPorts.length > 0 ? JSON.stringify(openPorts.map((p: any) => p.service)) : null,
          riskScore,
          lastSeenAt: new Date(),
          enrichmentStatus,
          enrichmentData: enrichmentData ? (enrichmentData as any) : null,
        };

        const result = await this.prisma.discoveredDevice.upsert({
          where: { tenantId_ipAddress: { tenantId, ipAddress: host.ip } },
          create: {
            tenantId,
            ipAddress: host.ip,
            ...deviceData,
            status: existingAssetId ? 'MERGED' : 'PENDING_REVIEW',
            approvedAssetId: existingAssetId || null,
            firstSeenAt: new Date(),
            seenCount: 1,
          },
          update: {
            ...deviceData,
            seenCount: { increment: 1 },
            ...(existingAssetId ? { status: 'MERGED', approvedAssetId: existingAssetId } : {}),
          },
        });

        if (result.seenCount === 1 && result.status === 'PENDING_REVIEW') {
          newCount++;
          this.eventBus.emitDiscoveryEvent(tenantId, 'device_discovered', {
            device: result,
            ipAddress: host.ip, deviceType: deviceType,
            hostname: host.hostname, mac, scanJobId,
          });
        }
      }

      // Update scan job
      await this.prisma.scanJob.update({
        where: { id: scanJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          devicesFound: devices.length,
          newDevices: newCount,
        },
      });

      // Emit scan completed event
      this.eventBus.emitDiscoveryEvent(tenantId, 'scan_completed', {
        scanJobId, devicesFound: devices.length, newDevices: newCount, scanType: scanJob.scanType,
      });

      // Emit final scan_progress with COMPLETED status so frontend triggers refresh
      this.eventBus.emitDiscoveryEvent(tenantId, 'scan_progress', {
        scanJobId, progress: 100, phase: 'Complete', found: devices.length, status: 'COMPLETED',
      });

      this.logger.log(`Scan job ${scanJobId} completed via agent upload: ${devices.length} devices, ${newCount} new`);
      return { success: true, devicesFound: devices.length, newDevices: newCount };
    } catch (error: any) {
      await this.prisma.scanJob.update({
        where: { id: scanJobId },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: error.message },
      });

      this.eventBus.emitDiscoveryEvent(tenantId, 'scan_progress', {
        scanJobId, progress: 0, phase: 'Failed', found: 0, status: 'FAILED',
      });

      throw error;
    }
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

    // ─── Detect unreachable private LAN IPs from a cloud server ─────
    const ip = device.ipAddress || '';
    const isPrivateIp = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(ip);
    const isCloudHosted = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RENDER_EXTERNAL_URL ||
      process.env.FLY_APP_NAME || process.env.HEROKU_APP_NAME || process.env.CLOUD_RUN_JOB);

    if (isPrivateIp && isCloudHosted) {
      // Can't reach local LAN from cloud — build the richest possible profile from all available data
      this.logger.log(`Cloud server cannot reach private IP ${ip} — building comprehensive heuristic profile`);

      // 1. Gather all available data sources
      const scanJob = device.scanJobId ? await this.prisma.scanJob.findUnique({ where: { id: device.scanJobId } }) : null;
      const existingPorts = device.openPorts ? JSON.parse(device.openPorts as string) : [];
      const existingServices = device.services ? JSON.parse(device.services as string) : [];
      const mac = device.macAddress || '';
      const hostname = device.hostname || '';

      // 2. MAC OUI deep vendor analysis
      const ouiLookup = this.deepMacLookup(mac);
      
      // 3. Hostname pattern analysis
      const hostnameAnalysis = this.analyzeHostname(hostname);

      // 4. Port-based classification (use ports discovered during the scan)
      const classification = this.classifyDevice(
        existingPorts.map((p: any) => typeof p === 'object' ? p : { port: p, service: `port-${p}` }),
        mac || undefined,
      );

      // 5. Risk assessment
      const riskFactors: string[] = [];
      if (existingPorts.some((p: any) => [21, 23, 25, 137, 139, 445, 3389].includes(typeof p === 'object' ? p.port : p))) {
        riskFactors.push('High-risk ports open (FTP/Telnet/SMB/RDP)');
      }
      if (!mac) riskFactors.push('No MAC address — may be spoofed or behind NAT');
      if (hostname.toLowerCase().includes('guest') || hostname.toLowerCase().includes('byod')) {
        riskFactors.push('Guest/BYOD device detected from hostname');
      }

      // 6. Build comprehensive enrichment profile
      const enrichmentData: any = {
        collectedAt: new Date().toISOString(),
        method: 'DEEP_HEURISTIC',
        dataQuality: existingPorts.length > 0 ? 'GOOD' : 'LIMITED',
        hardware: {
          detectedType: classification.deviceType,
          manufacturer: ouiLookup.manufacturer,
          manufacturerCountry: ouiLookup.country,
          macPrefix: mac ? mac.substring(0, 8).toUpperCase() : null,
          isVirtual: ouiLookup.isVirtual,
          possibleModels: ouiLookup.possibleModels,
        },
        operatingSystem: {
          osGuess: classification.osGuess || hostnameAnalysis.osGuess,
          confidence: classification.osGuess ? 'MEDIUM' : 'LOW',
          hostname: hostname,
          hostnamePattern: hostnameAnalysis.pattern,
        },
        network: {
          ipAddress: ip,
          macAddress: mac,
          openPorts: existingPorts.map((p: any) => {
            const port = typeof p === 'object' ? p.port : p;
            const service = typeof p === 'object' ? p.service : (PORT_SERVICE_MAP[port] || `port-${port}`);
            return {
              port, service,
              protocol: 'TCP',
              risk: [21, 23, 25, 445, 3389].includes(port) ? 'HIGH' :
                    [80, 8080, 8443].includes(port) ? 'MEDIUM' : 'LOW',
              description: this.getPortDescription(port),
            };
          }),
          services: existingServices.length > 0 ? existingServices : classification.services,
          discoveredVia: scanJob ? `Network scan (${scanJob.scanType || 'FULL'})` : 'Agent discovery',
          firstSeen: device.createdAt,
          lastSeen: device.lastSeenAt,
        },
        software: {
          detectedServices: classification.services,
          webServer: existingPorts.some((p: any) => [80, 443, 8080, 8443].includes(typeof p === 'object' ? p.port : p))
            ? 'Web server detected (HTTP/HTTPS)' : null,
          databaseServer: existingPorts.some((p: any) => [3306, 5432, 1433, 27017, 6379].includes(typeof p === 'object' ? p.port : p))
            ? 'Database server detected' : null,
          remoteAccess: existingPorts.some((p: any) => [22, 3389, 5900].includes(typeof p === 'object' ? p.port : p))
            ? 'Remote access enabled (SSH/RDP/VNC)' : null,
          fileSharing: existingPorts.some((p: any) => [21, 139, 445, 2049].includes(typeof p === 'object' ? p.port : p))
            ? 'File sharing active (FTP/SMB/NFS)' : null,
        },
        security: {
          riskScore: device.riskScore || (riskFactors.length * 25),
          riskLevel: riskFactors.length >= 3 ? 'CRITICAL' : riskFactors.length >= 2 ? 'HIGH' :
                     riskFactors.length >= 1 ? 'MEDIUM' : 'LOW',
          riskFactors: riskFactors.length > 0 ? riskFactors : ['No immediate risk factors identified'],
          recommendations: this.getSecurityRecommendations(existingPorts, classification.deviceType),
        },
        enrichmentNote: `Comprehensive analysis using MAC OUI database, hostname patterns, port fingerprinting, and scan results. ${
          existingPorts.length > 0 ? `${existingPorts.length} ports analyzed.` : 'No port data available from scan.'
        } For full software/hardware inventory, deploy the on-premise discovery agent.`,
      };

      const updated = await this.prisma.discoveredDevice.update({
        where: { id: deviceId },
        data: {
          enrichmentData: enrichmentData as any,
          enrichmentStatus: 'ENRICHED',
          deviceType: classification.deviceType || device.deviceType,
          manufacturer: ouiLookup.manufacturer || device.manufacturer,
        },
      });

      return {
        device: updated,
        enrichmentSummary: {
          method: 'DEEP_HEURISTIC',
          deviceType: classification.deviceType,
          manufacturer: ouiLookup.manufacturer,
          openPorts: existingPorts.length,
          riskLevel: enrichmentData.security.riskLevel,
          note: `Cloud-side deep heuristic analysis complete. ${existingPorts.length} ports, ${riskFactors.length} risk factors. Deploy agent for full inventory.`,
        },
      };
    }

    let enrichmentData: any = {
      collectedAt: new Date().toISOString(),
      method: 'PORT_FINGERPRINT',
    };

    // ─── Try SNMP / WMI-WinRM / SSH enrichment if credentials provided ─────────
    if (credentialId) {
      const cred = await this.prisma.scanCredential.findFirst({
        where: { id: credentialId, tenantId },
      });

      if (cred) {
        if (cred.type === 'SNMP_V2C' || cred.type === 'SNMP') {
          const credData = await this.credentialVault.getDecrypted(cred.id, tenantId);
          const community = credData?.community || 'public';
          try {
            const snmpResult = await this.snmpScanner.pollDevice(device.ipAddress, community);
            if (snmpResult && (snmpResult.sysDescr || snmpResult.sysName)) {
              const classification = this.classifyDeviceFromSnmp(snmpResult.sysDescr || '', device.macAddress || undefined);
              
              enrichmentData = {
                collectedAt: new Date().toISOString(),
                method: 'SNMP',
                hardware: {
                  manufacturer: classification.manufacturer,
                  model: classification.model,
                  cpuLoad: snmpResult.cpuLoad || null,
                  memoryPercent: snmpResult.memoryPercent || null,
                },
                operatingSystem: {
                  name: classification.osGuess,
                  osGuess: classification.osGuess,
                  hostname: snmpResult.sysName,
                  uptime: snmpResult.sysUpTime ? Math.floor(snmpResult.sysUpTime / 100) : null,
                },
                network: {
                  sysName: snmpResult.sysName,
                  sysLocation: snmpResult.sysLocation,
                  sysContact: snmpResult.sysContact,
                  interfaces: snmpResult.interfaces || [],
                  lldpNeighbors: snmpResult.lldpNeighbors || [],
                  cdpNeighbors: snmpResult.cdpNeighbors || [],
                },
              };

              // Also update device basic info
              await this.prisma.discoveredDevice.update({
                where: { id: deviceId },
                data: {
                  hostname: snmpResult.sysName || device.hostname,
                  manufacturer: classification.manufacturer || device.manufacturer,
                  deviceType: classification.deviceType || device.deviceType,
                  osInfo: classification.osGuess || device.osInfo,
                },
              });

              this.logger.log(`Device ${device.ipAddress} enriched via SNMP — ${snmpResult.interfaces?.length || 0} interfaces`);
            }
          } catch (err: any) {
            this.logger.warn(`SNMP enrichment failed for ${device.ipAddress}: ${err.message}`);
            enrichmentData.snmpError = err.message;
          }
        } else if (['WMI', 'WINRM', 'WMI_PASSWORD'].includes(cred.type)) {
          // WMI / WinRM agentless Windows inventory
          const credData = await this.credentialVault.getDecrypted(cred.id, tenantId);
          if (!credData?.username || !credData?.password) {
            throw new Error(`WMI/WinRM credentials for ID ${cred.id} must include username and password`);
          }
          try {
            const wmiResult = await WmiScanner.scan({
              host: device.ipAddress,
              username: credData.username,
              password: credData.password,
              domain: credData.domain,
              timeout: 90000,
            });

            if (!wmiResult.error) {
              const packages = (wmiResult.software || []).map((s) => ({
                name: s.name,
                version: s.version || '',
                publisher: s.publisher,
              }));

              const osName =
                wmiResult.os?.name ||
                (wmiResult.os?.version ? `Windows ${wmiResult.os.version}` : null) ||
                'Windows';
              const hwManufacturer = wmiResult.manufacturer || 'Unknown';
              const hwModel = wmiResult.model || 'Unknown';

              enrichmentData = {
                collectedAt: new Date().toISOString(),
                method: 'WMI',
                hardware: {
                  manufacturer: hwManufacturer,
                  model: hwModel,
                  serialNumber: wmiResult.serial || null,
                  cpuModel: wmiResult.cpu?.name || null,
                  cpuCores: wmiResult.cpu?.cores || wmiResult.cpu?.logicalProcessors || 0,
                  totalRamMb: wmiResult.ram?.totalMb || 0,
                  diskDrives: (wmiResult.disks || []).map((d) => ({
                    deviceId: d.deviceId,
                    filesystem: d.filesystem,
                    sizeGb: d.sizeGb,
                    freeGb: d.freeGb,
                    sizeBytes: d.sizeBytes,
                    freeBytes: d.freeBytes,
                  })),
                },
                operatingSystem: {
                  name: osName,
                  version: wmiResult.os?.version || null,
                  build: wmiResult.os?.build || null,
                  architecture: wmiResult.os?.architecture || null,
                  hostname: wmiResult.hostname || null,
                  installDate: wmiResult.os?.installDate || null,
                  lastBoot: wmiResult.os?.lastBoot || null,
                },
                network: {
                  nics: wmiResult.nics || [],
                  macAddresses: (wmiResult.nics || []).map((n) => n.mac).filter(Boolean),
                },
                security: {
                  hotfixes: wmiResult.hotfixes || [],
                  hotfixCount: wmiResult.hotfixes?.length || 0,
                },
                software: {
                  installedPackages: packages.length,
                  packages,
                  runningServices: (wmiResult.services || []).map((s) => ({
                    name: s.name,
                    displayName: s.displayName,
                    status: s.state,
                    startMode: s.startMode,
                  })),
                },
              };

              await this.prisma.discoveredDevice.update({
                where: { id: deviceId },
                data: {
                  hostname: wmiResult.hostname || device.hostname,
                  manufacturer: hwManufacturer !== 'Unknown' ? hwManufacturer : device.manufacturer,
                  osInfo: osName,
                  macAddress:
                    device.macAddress ||
                    wmiResult.nics?.find((n) => n.mac)?.mac ||
                    undefined,
                },
              });

              if (packages.length > 0 && device.approvedAssetId) {
                this.softwareService
                  .ingestSoftware(tenantId, device.approvedAssetId, packages)
                  .catch((err) =>
                    this.logger.error(
                      `Software ingestion failed for asset ${device.approvedAssetId}: ${err.message}`,
                    ),
                  );
              }

              this.logger.log(
                `Device ${device.ipAddress} enriched via WMI/WinRM — ${wmiResult.cpu?.cores || '?'} cores, ${wmiResult.disks?.length || 0} disks, ${packages.length} packages`,
              );
            } else {
              this.logger.warn(`WMI/WinRM enrichment failed for ${device.ipAddress}: ${wmiResult.error}`);
              enrichmentData.wmiError = wmiResult.error;
            }
          } catch (err: any) {
            this.logger.warn(`WMI/WinRM enrichment exception for ${device.ipAddress}: ${err.message}`);
            enrichmentData.wmiError = err.message;
          }
        } else {
          // SSH Credential
          const credData = await this.credentialVault.getDecrypted(cred.id, tenantId);
          if (!credData) {
            throw new Error(`Failed to decrypt credentials for ID ${cred.id}`);
          }
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
                  serialNumber: sshResult.hardwareDetails?.serialNumber || 'Unknown',
                  biosVendor: sshResult.hardwareDetails?.biosVendor || 'Unknown',
                  biosVersion: sshResult.hardwareDetails?.biosVersion || 'Unknown',
                  motherboard: sshResult.hardwareDetails?.motherboard || 'Unknown',
                  tpmEnabled: sshResult.hardwareDetails?.tpmEnabled !== undefined ? sshResult.hardwareDetails.tpmEnabled : false,
                  tpmVersion: sshResult.hardwareDetails?.tpmVersion || 'N/A',
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
                  packages: sshResult.packages || [],
                },
                users: {
                  accounts: sshResult.users || [],
                  lastLogins: sshResult.lastLogins || [],
                },
              };

              // ─── Ingest Discovered Software ──────────
              if (sshResult.packages && sshResult.packages.length > 0) {
                // If it's a discovered device being enriched, it might have an approvedAssetId
                const targetAssetId = device.approvedAssetId;
                if (targetAssetId) {
                  this.softwareService.ingestSoftware(
                    tenantId,
                    targetAssetId,
                    sshResult.packages,
                  ).catch(err => this.logger.error(`Software ingestion failed for asset ${targetAssetId}: ${err.message}`));
                }
              }

              await this.prisma.discoveredDevice.update({
                where: { id: deviceId },
                data: {
                  hostname: sshResult.hostname || device.hostname,
                  manufacturer:
                    sshResult.hardwareDetails?.biosVendor &&
                    sshResult.hardwareDetails.biosVendor !== 'Unknown'
                      ? sshResult.hardwareDetails.biosVendor
                      : device.manufacturer,
                  osInfo: sshResult.osInfo?.distro || enrichmentData.operatingSystem?.name || device.osInfo,
                },
              });

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
    }

    // ─── Fallback: SNMP or Port-scan fingerprinting ──────────────
    if (enrichmentData.method === 'PORT_FINGERPRINT') {
      const communities = await this.getSnmpCommunities(tenantId);
      const snmpPoll = await this.pollSnmpForHost(device.ipAddress, communities);

      if (snmpPoll) {
        const { result: snmpResult } = snmpPoll;
        const classification = this.classifyDeviceFromSnmp(snmpResult.sysDescr || '', device.macAddress || undefined);
        enrichmentData = {
          collectedAt: new Date().toISOString(),
          method: 'SNMP',
          hardware: {
            manufacturer: classification.manufacturer,
            model: classification.model,
            cpuLoad: snmpResult.cpuLoad || null,
            memoryPercent: snmpResult.memoryPercent || null,
          },
          operatingSystem: {
            name: classification.osGuess,
            osGuess: classification.osGuess,
            hostname: snmpResult.sysName,
            uptime: snmpResult.sysUpTime ? Math.floor(snmpResult.sysUpTime / 100) : null,
          },
          network: {
            sysName: snmpResult.sysName,
            sysLocation: snmpResult.sysLocation,
            sysContact: snmpResult.sysContact,
            interfaces: snmpResult.interfaces || [],
            lldpNeighbors: snmpResult.lldpNeighbors || [],
            cdpNeighbors: snmpResult.cdpNeighbors || [],
          },
        };

        // Also update device basic info
        await this.prisma.discoveredDevice.update({
          where: { id: deviceId },
          data: {
            hostname: snmpResult.sysName || device.hostname,
            manufacturer: classification.manufacturer || device.manufacturer,
            deviceType: classification.deviceType || device.deviceType,
            osInfo: classification.osGuess || device.osInfo,
          },
        });

        this.logger.log(`Device ${device.ipAddress} auto-enriched via SNMP — ${snmpResult.interfaces?.length || 0} interfaces`);
      } else {
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
    }

    const updated = await this.prisma.discoveredDevice.update({
      where: { id: deviceId },
      data: {
        enrichmentData: enrichmentData as any,
        enrichmentStatus: 'ENRICHED',
        // Always surface Hardware/OS onto the device row when enrich succeeded
        ...(enrichmentData.operatingSystem?.name || enrichmentData.operatingSystem?.osGuess
          ? {
              osInfo:
                enrichmentData.operatingSystem.name ||
                enrichmentData.operatingSystem.osGuess,
            }
          : {}),
        ...(enrichmentData.hardware?.manufacturer
          ? { manufacturer: enrichmentData.hardware.manufacturer }
          : {}),
        ...(enrichmentData.operatingSystem?.hostname
          ? { hostname: enrichmentData.operatingSystem.hostname }
          : {}),
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

  /**
   * Resolve the canonical monorepo-root `/agent` directory.
   * Never prefers the stale `apps/api/agent` copy.
   */
  private resolveAgentDirectory(): string {
    const staleMarker = `${path.sep}apps${path.sep}api${path.sep}agent`;
    // Prefer repo-root agent/ (cwd may be repo root or apps/api)
    const possiblePaths = [
      path.resolve(process.cwd(), 'agent'), // repo root → ./agent (skipped if apps/api/agent)
      path.resolve(process.cwd(), '../../agent'), // apps/api cwd → monorepo root /agent
      path.resolve(__dirname, '../../../../../agent'), // dist/modules/discovery → root/agent
      path.resolve(__dirname, '../../../../../../agent'),
      path.resolve(__dirname, '../../../../agent'),
    ];

    for (const p of possiblePaths) {
      const resolved = path.resolve(p);
      if (resolved.includes(staleMarker)) continue;
      if (
        fs.existsSync(resolved) &&
        fs.statSync(resolved).isDirectory() &&
        fs.existsSync(path.join(resolved, 'qs-discovery-agent.js'))
      ) {
        this.logger.debug(`Using canonical agent directory: ${resolved}`);
        return resolved;
      }
    }

    this.logger.error('Discovery agent directory not found (expected repo-root /agent).');
    throw new NotFoundException('Discovery Agent template files not found on the server.');
  }

  /**
   * Package all agent collector files into an in-memory ZIP buffer with OS-specific hierarchy.
   * Source of truth: monorepo-root `/agent` only (not `apps/api/agent`).
   */
  getAgentZipPackage(serverUrl?: string, token?: string, userEmail?: string): Buffer {
    const zip = new AdmZip();
    const agentDir = this.resolveAgentDirectory();

    // 1. Structure: /bin (Unix), /win (Windows), /mac (macOS .app), /core (clean background core), and root (premium native quick-launchers)
    
    // Unix Helpers
    const unixFiles = ['install-service.sh', 'run-agent.sh', 'qs-discovery-agent.js', 'setup.html', 'QuickStart.txt', 'README.md', 'Status Dashboard.html'];
    for (const file of unixFiles) {
      const filePath = path.join(agentDir, file);
      if (fs.existsSync(filePath)) zip.addLocalFile(filePath, 'bin');
    }

    // Windows Helpers (neat core folder containing all hidden dependencies)
    const winFiles = ['Start Agent.bat', 'install-service.bat', 'run-agent.bat', 'qs-discovery-agent.js', 'launch-silent.vbs', 'setup.html', 'QuickStart.txt', 'Status Dashboard.html'];
    for (const file of winFiles) {
      const filePath = path.join(agentDir, file);
      if (fs.existsSync(filePath)) {
        const destName = file === 'install-service.bat' ? 'Install Service.bat' : file;
        zip.addLocalFile(filePath, 'core', destName);
      }
    }

    // Root-level items for easy double-clicking
    const rootFiles = [
      { name: 'setup.html' },
      { name: 'QuickStart.txt' },
      { name: 'Status Dashboard.html' },
      { name: 'README.md' },
      { name: 'Start Agent.bat' },
      { name: 'install-service.bat', destName: 'Install Service.bat' }
    ];
    for (const item of rootFiles) {
      const filePath = path.join(agentDir, item.name);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath, '', item.destName || item.name);
      }
    }

    // macOS Application Bundle (Legacy and root-level launcher)
    const appBundlePath = path.join(agentDir, 'QS-Discovery-Agent.app');
    if (fs.existsSync(appBundlePath) && fs.statSync(appBundlePath).isDirectory()) {
      zip.addLocalFolder(appBundlePath, 'mac/QS-Discovery-Agent.app');
      zip.addLocalFolder(appBundlePath, 'QS-Discovery-Agent.app');
    }

    // 2. Inject config.json with token + email for credential-based re-auth
    if (serverUrl && token) {
      try {
        // Include email so the agent can re-authenticate via credentials when the JWT expires
        const configObj: Record<string, any> = { server: serverUrl, token };
        if (userEmail) {
          configObj.email = userEmail;
          // NOTE: password is NOT embedded for security — the agent will prompt or
          // the user must run pair-local.js to complete credential setup.
          // The agent's login flow will use the email + token initially, then
          // fall back to pair-local.js if the token fully expires.
        }
        const configBuffer = Buffer.from(JSON.stringify(configObj, null, 2), 'utf-8');
        zip.addFile('config.json', configBuffer);
        zip.addFile('bin/config.json', configBuffer);
        zip.addFile('core/config.json', configBuffer);
        zip.addFile('mac/QS-Discovery-Agent.app/Contents/MacOS/config.json', configBuffer);
        zip.addFile('QS-Discovery-Agent.app/Contents/MacOS/config.json', configBuffer);
      } catch (err: any) {
        this.logger.error(`Failed to inject config.json: ${err.message}`);
      }
    }

    return zip.toBuffer();
  }

  /**
   * Resolve whether to use SSH or WinRM for remote agent deploy.
   */
  private resolveDeployMethod(
    method?: DeployRemoteMethod,
    platform?: string,
  ): 'ssh' | 'winrm' {
    if (method === 'ssh' || method === 'winrm') return method;
    const p = (platform || '').toLowerCase();
    if (
      p.includes('win') ||
      p.includes('windows') ||
      p === 'wmi' ||
      p === 'winrm'
    ) {
      return 'winrm';
    }
    return 'ssh';
  }

  /**
   * Locate pwsh / powershell for WinRM Invoke-Command deploys.
   */
  private async findPowerShellBinary(): Promise<string | null> {
    const candidates =
      process.platform === 'win32'
        ? ['pwsh.exe', 'powershell.exe']
        : ['pwsh', 'powershell'];

    for (const cmd of candidates) {
      try {
        if (process.platform === 'win32') {
          await execFileAsync('where.exe', [cmd], { timeout: 5000 });
        } else {
          await execFileAsync('which', [cmd], { timeout: 5000 });
        }
        return cmd;
      } catch {
        // try next
      }
    }

    // Common absolute paths
    const absPaths =
      process.platform === 'win32'
        ? [
            'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
            'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
          ]
        : ['/usr/bin/pwsh', '/usr/local/bin/pwsh', '/opt/microsoft/powershell/7/pwsh'];

    for (const p of absPaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /**
   * Deploy the discovery agent to a remote host via SSH or WinRM.
   * method: 'ssh' | 'winrm' | 'auto' (auto uses platform hint when provided).
   */
  async deployRemoteAgent(
    tenantId: string,
    userId: string,
    targetIp: string,
    credentialId: string,
    options?: DeployRemoteOptions,
  ) {
    const method = this.resolveDeployMethod(options?.method, options?.platform);
    if (method === 'winrm') {
      return this.deployRemoteAgentWinRM(tenantId, userId, targetIp, credentialId, options);
    }
    return this.deployRemoteAgentSsh(tenantId, userId, targetIp, credentialId);
  }

  /**
   * Deploy the discovery agent to a remote Windows host via WinRM / PowerShell Remoting.
   * Builds the same agent zip as SSH (with a real JWT), base64-encodes it, and runs
   * `pwsh -Command "Invoke-Command -ComputerName ..."` when PowerShell is available.
   */
  async deployRemoteAgentWinRM(
    tenantId: string,
    userId: string,
    targetIp: string,
    credentialId?: string,
    options?: DeployRemoteOptions,
  ) {
    this.logger.log(`Starting WinRM agent deployment to ${targetIp} for tenant ${tenantId}`);
    const logs: string[] = [];
    const stamp = Date.now();
    const localPackagePath = path.join(os.tmpdir(), `qs-agent-winrm-${stamp}.zip`);
    const localB64Path = path.join(os.tmpdir(), `qs-agent-winrm-${stamp}.b64`);
    const localPs1Path = path.join(os.tmpdir(), `qs-agent-winrm-${stamp}.ps1`);

    let username = options?.username?.trim() || '';
    let password = options?.password || '';

    // 1. Resolve WMI / WINRM credentials (vault preferred, body username/password as override)
    try {
      if (credentialId) {
        const credMeta = await this.prisma.scanCredential.findFirst({
          where: { id: credentialId, tenantId },
          select: { type: true, name: true },
        });
        const credentials = await this.credentialVault.getDecrypted(credentialId, tenantId);
        if (!credentials?.username || !credentials?.password) {
          throw new BadRequestException(
            'WinRM credentials must include username and password (WMI or WINRM vault type)',
          );
        }
        username = username || credentials.username;
        password = password || credentials.password;
        logs.push(
          `[OK] WinRM credentials resolved from vault (${credMeta?.name || credentialId}, type=${credMeta?.type || 'unknown'})`,
        );
      } else if (!username || !password) {
        // Auto-pick first WMI/WINRM credential for the tenant
        const winCred = await this.prisma.scanCredential.findFirst({
          where: {
            tenantId,
            type: { in: ['WMI', 'WINRM', 'WMI_PASSWORD'] },
          },
          orderBy: { updatedAt: 'desc' },
        });
        if (winCred) {
          const credentials = await this.credentialVault.getDecrypted(winCred.id, tenantId);
          username = credentials?.username || '';
          password = credentials?.password || '';
          logs.push(`[OK] Using tenant WMI/WINRM credential "${winCred.name}"`);
        }
      }

      if (!username || !password) {
        throw new BadRequestException(
          'WinRM deploy requires a WMI/WINRM vault credential (username + password) or body username/password',
        );
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      logs.push(`[FAIL] Failed to resolve WinRM credentials: ${err.message}`);
      throw new BadRequestException(`Failed to resolve WinRM credentials: ${err.message}`);
    }

    const psBinary = await this.findPowerShellBinary();
    if (!psBinary) {
      const hint =
        process.platform === 'win32'
          ? 'PowerShell was not found on this API host. Install PowerShell 7+ or ensure powershell.exe is on PATH, and enable WinRM on the target (Enable-PSRemoting -Force).'
          : 'PowerShell (pwsh) is not installed on this Linux API host. Install PowerShell 7+ (https://aka.ms/powershell) so the API can run Invoke-Command over WinRM, and ensure the target has WinRM enabled (Enable-PSRemoting -Force) with reachable port 5985/5986.';
      logs.push(`[FAIL] ${hint}`);
      return {
        status: 'FAILED',
        success: false,
        method: 'winrm',
        targetIp,
        logs,
        error: hint,
      };
    }
    logs.push(`[OK] Using PowerShell binary: ${psBinary}`);

    try {
      // 2. Generate agent package with real long-lived JWT
      const serverUrl =
        process.env.API_URL || process.env.SERVER_URL || `http://${os.hostname()}:3001`;
      const deployer = await this.prisma.user.findFirst({
        where: { id: userId, tenantId, deletedAt: null },
        select: { email: true },
      });
      const userEmail = deployer?.email || `agent-deploy@${tenantId}`;
      const token = this.authService.generateAgentToken(tenantId, userEmail, userId);
      const packageBuffer = this.getAgentZipPackage(serverUrl, token, userEmail);
      fs.writeFileSync(localPackagePath, packageBuffer);
      fs.writeFileSync(localB64Path, packageBuffer.toString('base64'), 'utf8');
      logs.push(
        `[OK] Agent package generated with JWT (${Math.round(packageBuffer.length / 1024)} KB, base64 staged)`,
      );

      const remoteInstallDir = 'C:\\ProgramData\\QS-Discovery-Agent';
      const configJson = JSON.stringify({ server: serverUrl, token, email: userEmail }, null, 2);

      // 3. Write a temp PS1 that uses Invoke-Command (WinRM) — credentials via env to avoid argv leaks in process list somewhat
      const ps1 = `
$ErrorActionPreference = 'Stop'
$target = $env:QS_WINRM_TARGET
$user = $env:QS_WINRM_USER
$passPlain = $env:QS_WINRM_PASS
$b64Path = $env:QS_WINRM_B64
$installDir = '${remoteInstallDir.replace(/'/g, "''")}'
$configJson = @'
${configJson}
'@

if (-not $target -or -not $user -or -not $passPlain) {
  Write-Output '[FAIL] Missing WinRM target or credentials in environment'
  exit 2
}
if (-not (Test-Path -LiteralPath $b64Path)) {
  Write-Output "[FAIL] Base64 package missing at $b64Path"
  exit 3
}

Write-Output "[INFO] Connecting via WinRM / PowerShell Remoting to $target as $user"
$secure = ConvertTo-SecureString $passPlain -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($user, $secure)
$b64 = Get-Content -LiteralPath $b64Path -Raw

try {
  $result = Invoke-Command -ComputerName $target -Credential $cred -Authentication Negotiate -ScriptBlock {
    param($B64, $InstallDir, $ConfigJson)
    $ErrorActionPreference = 'Stop'
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    $zipPath = Join-Path $InstallDir 'agent.zip'
    [System.IO.File]::WriteAllBytes($zipPath, [Convert]::FromBase64String($B64))
    if (Get-Command Expand-Archive -ErrorAction SilentlyContinue) {
      Expand-Archive -Path $zipPath -DestinationPath $InstallDir -Force
    } else {
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      if (Test-Path $InstallDir) {
        Get-ChildItem -LiteralPath $InstallDir -Force | Where-Object { $_.Name -ne 'agent.zip' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
      }
      [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $InstallDir)
    }

    $coreDir = Join-Path $InstallDir 'core'
    if (-not (Test-Path $coreDir)) { $coreDir = $InstallDir }

    foreach ($cfgName in @('config.json', (Join-Path 'bin' 'config.json'), (Join-Path 'core' 'config.json'))) {
      $cfgPath = Join-Path $InstallDir $cfgName
      $parent = Split-Path -Parent $cfgPath
      if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
      Set-Content -LiteralPath $cfgPath -Value $ConfigJson -Encoding UTF8
    }
    if (Test-Path $coreDir) {
      Set-Content -LiteralPath (Join-Path $coreDir 'config.json') -Value $ConfigJson -Encoding UTF8
    }

    $vbs = Join-Path $coreDir 'launch-silent.vbs'
    $agentJs = Join-Path $coreDir 'qs-discovery-agent.js'
    if (-not (Test-Path $agentJs)) { $agentJs = Join-Path $InstallDir 'qs-discovery-agent.js' }

    if (Test-Path $vbs) {
      & schtasks.exe /create /tn 'QSDiscoveryAgent' /tr "wscript.exe \`"$vbs\`"" /sc onlogon /rl highest /f | Out-Null
      & schtasks.exe /run /tn 'QSDiscoveryAgent' | Out-Null
      Write-Output '[OK] Scheduled task QSDiscoveryAgent registered and started'
    } elseif (Test-Path $agentJs) {
      $node = Get-Command node -ErrorAction SilentlyContinue
      if ($node) {
        Start-Process -FilePath $node.Source -ArgumentList $agentJs -WorkingDirectory (Split-Path $agentJs) -WindowStyle Hidden
        Write-Output '[OK] Agent started via node (no launch-silent.vbs)'
      } else {
        Write-Output '[WARN] Agent files extracted but node/launch-silent.vbs missing — install Node.js or re-package agent'
      }
    } else {
      Write-Output '[WARN] Package extracted but agent entrypoint not found'
    }

    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    Write-Output "[OK] WinRM deploy finished under $InstallDir"
  } -ArgumentList $b64, $installDir, $configJson

  $result | ForEach-Object { Write-Output $_ }
  Write-Output '[OK] Invoke-Command completed'
  exit 0
} catch {
  Write-Output ("[FAIL] WinRM Invoke-Command error: " + $_.Exception.Message)
  Write-Output '[HINT] Ensure WinRM is enabled on the target (Enable-PSRemoting -Force), firewall allows 5985/5986, and credentials have admin rights.'
  exit 1
}
`.trim();

      fs.writeFileSync(localPs1Path, ps1, 'utf8');
      logs.push(`[OK] WinRM deploy script prepared`);

      const { stdout, stderr } = await execFileAsync(
        psBinary,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', localPs1Path],
        {
          timeout: 180000,
          maxBuffer: 10 * 1024 * 1024,
          env: {
            ...process.env,
            QS_WINRM_TARGET: targetIp,
            QS_WINRM_USER: username,
            QS_WINRM_PASS: password,
            QS_WINRM_B64: localB64Path,
          },
        },
      );

      const combined = `${stdout || ''}\n${stderr || ''}`.trim();
      for (const line of combined.split(/\r?\n/).filter(Boolean)) {
        logs.push(line);
      }

      const failed = /\[FAIL\]/i.test(combined) || (!/\[OK\] Invoke-Command completed/i.test(combined) && !/WinRM deploy finished/i.test(combined));
      if (failed) {
        this.logger.error(`WinRM agent deployment to ${targetIp} failed`);
        return {
          status: 'FAILED',
          success: false,
          method: 'winrm',
          targetIp,
          logs,
          error: combined || 'WinRM deployment failed',
        };
      }

      this.logger.log(`WinRM agent deployment to ${targetIp} completed successfully`);
      return {
        status: 'SUCCESS',
        success: true,
        method: 'winrm',
        targetIp,
        installDir: remoteInstallDir,
        logs,
        message: `Agent deployed to ${targetIp} via WinRM. It will register with the server on first heartbeat.`,
      };
    } catch (err: any) {
      const msg = err?.stderr || err?.message || String(err);
      this.logger.error(`WinRM agent deployment to ${targetIp} failed: ${msg}`);
      logs.push(`[FAIL] Deployment failed: ${msg}`);
      logs.push(
        '[HINT] WinRM must be enabled on the target (Enable-PSRemoting -Force), API host needs pwsh/powershell, and credentials need local admin rights.',
      );
      return {
        status: 'FAILED',
        success: false,
        method: 'winrm',
        targetIp,
        logs,
        error: msg,
      };
    } finally {
      for (const f of [localPackagePath, localB64Path, localPs1Path]) {
        try {
          fs.unlinkSync(f);
        } catch {
          /* ignore */
        }
      }
    }
  }

  /**
   * Deploy the discovery agent to a remote host via SSH.
   * Resolves SSH credentials from the credential vault, copies the agent package,
   * extracts it, configures the server URL and auth token, and starts the agent service.
   */
  async deployRemoteAgentSsh(
    tenantId: string,
    userId: string,
    targetIp: string,
    credentialId: string,
  ) {
    this.logger.log(`Starting remote agent deployment to ${targetIp} for tenant ${tenantId}`);
    const logs: string[] = [];

    // 1. Resolve SSH credentials from the credential vault
    let credentials: any;
    try {
      credentials = await this.credentialVault.getDecrypted(credentialId, tenantId);
      if (!credentials || (!credentials.password && !credentials.privateKey)) {
        throw new BadRequestException(
          'Invalid SSH credentials: must contain either password or privateKey',
        );
      }
      logs.push(`[OK] SSH credentials resolved for credential ${credentialId}`);
    } catch (err: any) {
      logs.push(`[FAIL] Failed to resolve SSH credentials: ${err.message}`);
      throw new BadRequestException(
        `Failed to resolve SSH credentials: ${err.message}`,
      );
    }

    const sshUser = credentials.username || 'root';
    const remoteTmpDir = '/tmp/qs-agent-deploy';
    const remoteInstallDir = '/opt/qs-discovery-agent';

    // Build SSH command options
    const sshOpts = '-o StrictHostKeyChecking=no -o ConnectTimeout=15';
    let sshAuthArgs: string;
    let keyPath: string | null = null;

    if (credentials.privateKey) {
      // Write the private key to a temporary file
      keyPath = `/tmp/.qs-deploy-key-${Date.now()}`;
      fs.writeFileSync(keyPath, credentials.privateKey, { mode: 0o600 });
      sshAuthArgs = `${sshOpts} -i ${keyPath}`;
      logs.push(`[OK] Using SSH key authentication`);
    } else {
      // Use sshpass for password auth (requires sshpass installed on the API server)
      sshAuthArgs = `${sshOpts}`;
      logs.push(`[INFO] Using password authentication (requires sshpass on API server)`);
    }

    const sshCmd = (cmd: string) => credentials.privateKey
      ? `ssh ${sshAuthArgs} ${sshUser}@${targetIp} "${cmd.replace(/"/g, '\\"')}"`
      : `sshpass -p '${credentials.password}' ssh ${sshAuthArgs} ${sshUser}@${targetIp} "${cmd.replace(/"/g, '\\"')}"`;

    const scpCmd = (src: string, dest: string) => credentials.privateKey
      ? `scp ${sshAuthArgs} ${src} ${sshUser}@${targetIp}:${dest}`
      : `sshpass -p '${credentials.password}' scp ${sshAuthArgs} ${src} ${sshUser}@${targetIp}:${dest}`;

    const localPackagePath = `/tmp/qs-agent-${Date.now()}.zip`;

    try {
      // 2. Test SSH connectivity
      try {
        const { stdout } = await execAsync(sshCmd('echo CONNECTION_OK'), { timeout: 20000 });
        if (!stdout.includes('CONNECTION_OK')) {
          throw new Error('SSH connection test did not return expected response');
        }
        logs.push(`[OK] SSH connection to ${targetIp} successful`);
      } catch (err: any) {
        logs.push(`[FAIL] SSH connection to ${targetIp} failed: ${err.message}`);
        throw new BadRequestException(
          `Cannot establish SSH connection to ${targetIp}: ${err.message}`,
        );
      }

      // 3. Generate the agent package with a real long-lived JWT (same as download endpoint)
      const serverUrl = process.env.API_URL || process.env.SERVER_URL || `http://${os.hostname()}:3001`;
      const deployer = await this.prisma.user.findFirst({
        where: { id: userId, tenantId, deletedAt: null },
        select: { email: true },
      });
      const userEmail = deployer?.email || `agent-deploy@${tenantId}`;
      const token = this.authService.generateAgentToken(tenantId, userEmail, userId);
      const packageBuffer = this.getAgentZipPackage(serverUrl, token, userEmail);
      fs.writeFileSync(localPackagePath, packageBuffer);
      logs.push(`[OK] Agent package generated with JWT (${Math.round(packageBuffer.length / 1024)} KB)`);

      // 4. Copy the agent package to the remote host
      try {
        await execAsync(sshCmd(`mkdir -p ${remoteTmpDir}`), { timeout: 10000 });
        await execAsync(scpCmd(localPackagePath, `${remoteTmpDir}/agent.zip`), { timeout: 60000 });
        logs.push(`[OK] Agent package copied to ${targetIp}:${remoteTmpDir}/agent.zip`);
      } catch (err: any) {
        logs.push(`[FAIL] SCP transfer failed: ${err.message}`);
        throw new Error(`Failed to copy agent package: ${err.message}`);
      }

      // 5. Extract the package on the remote host
      try {
        await execAsync(sshCmd(
          `mkdir -p ${remoteInstallDir} && ` +
          `cd ${remoteTmpDir} && ` +
          `unzip -o agent.zip -d ${remoteInstallDir} 2>/dev/null || ` +
          `python3 -c \\\"import zipfile; zipfile.ZipFile('agent.zip').extractall('${remoteInstallDir}')\\\"`,
        ), { timeout: 30000 });
        logs.push(`[OK] Agent package extracted to ${remoteInstallDir}`);
      } catch (err: any) {
        logs.push(`[FAIL] Package extraction failed: ${err.message}`);
        throw new Error(`Failed to extract agent package: ${err.message}`);
      }

      // 6. Configure the agent with server URL and auth token
      try {
        const configJson = JSON.stringify({ server: serverUrl, token, email: userEmail }, null, 2);
        await execAsync(sshCmd(
          `echo '${configJson}' > ${remoteInstallDir}/bin/config.json && ` +
          `echo '${configJson}' > ${remoteInstallDir}/core/config.json 2>/dev/null; true`,
        ), { timeout: 10000 });
        logs.push(`[OK] Agent configured with server URL: ${serverUrl}`);
      } catch (err: any) {
        logs.push(`[WARN] Config injection issue (may still work): ${err.message}`);
      }

      // 7. Start the agent service
      try {
        // Try systemd service first, then fall back to direct execution
        await execAsync(sshCmd(
          `cd ${remoteInstallDir} && ` +
          `chmod +x bin/install-service.sh bin/run-agent.sh 2>/dev/null; ` +
          `if [ -f bin/install-service.sh ]; then bash bin/install-service.sh; ` +
          `elif command -v node >/dev/null 2>&1; then nohup node bin/qs-discovery-agent.js > /var/log/qs-agent.log 2>&1 & fi`,
        ), { timeout: 30000 });
        logs.push(`[OK] Agent service started on ${targetIp}`);
      } catch (err: any) {
        logs.push(`[WARN] Service start had issues (agent may still be running): ${err.message}`);
      }

      // 8. Clean up temporary files
      try {
        await execAsync(sshCmd(`rm -rf ${remoteTmpDir}`), { timeout: 5000 });
        fs.unlinkSync(localPackagePath);
      } catch {
        // Cleanup failures are non-critical
      }

      // Clean up the temporary key file if used
      if (keyPath) {
        try { fs.unlinkSync(keyPath); } catch {}
      }

      this.logger.log(`Remote agent deployment to ${targetIp} completed successfully`);

      return {
        status: 'SUCCESS',
        success: true,
        method: 'ssh',
        targetIp,
        installDir: remoteInstallDir,
        logs,
        message: `Agent deployed to ${targetIp}. It will register with the server on first heartbeat.`,
      };
    } catch (err: any) {
      // Clean up the temporary key file on error
      if (keyPath) {
        try { fs.unlinkSync(keyPath); } catch {}
      }
      try { fs.unlinkSync(localPackagePath); } catch {}

      this.logger.error(`Remote agent deployment to ${targetIp} failed: ${err.message}`);
      logs.push(`[FAIL] Deployment failed: ${err.message}`);

      return {
        status: 'FAILED',
        success: false,
        method: 'ssh',
        targetIp,
        logs,
        error: err.message,
      };
    }
  }

  // ─── Deep MAC OUI Lookup ─────────────────────────────────────
  private deepMacLookup(mac: string): {
    manufacturer: string; country: string; isVirtual: boolean; possibleModels: string[];
  } {
    if (!mac) return { manufacturer: 'Unknown', country: '', isVirtual: false, possibleModels: [] };
    const oui = mac.substring(0, 8).toUpperCase().replace(/[:-]/g, '');
    
    const OUI_DB: Record<string, { m: string; c: string; v?: boolean; models?: string[] }> = {
      // Apple
      'DCED96': { m: 'Apple Inc.', c: 'USA', models: ['MacBook Pro', 'MacBook Air', 'iMac', 'Mac Mini'] },
      'DC4F22': { m: 'Apple Inc.', c: 'USA', models: ['iPhone', 'iPad', 'Apple TV'] },
      'A4C3F0': { m: 'Apple Inc.', c: 'USA', models: ['MacBook Pro M-series'] },
      'F0B479': { m: 'Apple Inc.', c: 'USA', models: ['Apple Silicon Mac'] },
      '5C9BA6': { m: 'Apple Inc.', c: 'USA', models: ['MacBook Pro', 'MacBook Air'] },
      '3C22FB': { m: 'Apple Inc.', c: 'USA', models: ['MacBook Air', 'MacBook Pro'] },
      // HP
      'B8AEED': { m: 'Hewlett-Packard', c: 'USA', models: ['HP EliteBook', 'HP ProBook', 'HP ZBook'] },
      '001B44': { m: 'Hewlett-Packard', c: 'USA', models: ['HP Server', 'HP Switch'] },
      '08003E': { m: 'Hewlett-Packard', c: 'USA', models: ['HP Enterprise'] },
      // Dell
      'D4BE26': { m: 'Dell Inc.', c: 'USA', models: ['Dell Latitude', 'Dell XPS'] },
      '246E96': { m: 'Dell Inc.', c: 'USA', models: ['Dell OptiPlex', 'Dell PowerEdge'] },
      'F8DB88': { m: 'Dell Inc.', c: 'USA', models: ['Dell Server', 'Dell Workstation'] },
      // Lenovo
      '54AB3A': { m: 'Lenovo', c: 'China', models: ['ThinkPad', 'ThinkCentre'] },
      '8CEC4B': { m: 'Lenovo', c: 'China', models: ['ThinkPad', 'IdeaPad'] },
      // Cisco
      '0050BA': { m: 'Cisco Systems', c: 'USA', models: ['Cisco Switch', 'Cisco Router'] },
      '0023EA': { m: 'Cisco Systems', c: 'USA', models: ['Cisco Catalyst', 'Cisco Meraki'] },
      '001D70': { m: 'Cisco Systems', c: 'USA', models: ['Cisco Access Point'] },
      // Network devices
      '44D9E7': { m: 'Ubiquiti Inc.', c: 'USA', models: ['UniFi AP', 'UniFi Switch', 'EdgeRouter'] },
      '802AA8': { m: 'Ubiquiti Inc.', c: 'USA', models: ['UniFi Dream Machine'] },
      '0418D6': { m: 'Ubiquiti Inc.', c: 'USA', models: ['UniFi'] },
      'C0A0BB': { m: 'D-Link', c: 'Taiwan', models: ['D-Link Router', 'D-Link Switch'] },
      '001E58': { m: 'D-Link', c: 'Taiwan', models: ['D-Link NAS', 'D-Link Camera'] },
      '40167E': { m: 'TP-Link', c: 'China', models: ['TP-Link Router', 'TP-Link Switch'] },
      '8C210A': { m: 'TP-Link', c: 'China', models: ['TP-Link Router'] },
      'FCECDA': { m: 'Ubiquiti Inc.', c: 'USA', models: ['UniFi'] },
      // Printers
      '0025B3': { m: 'HP Printing', c: 'USA', models: ['HP LaserJet', 'HP OfficeJet'] },
      '3C2C94': { m: 'HP Printing', c: 'USA', models: ['HP Enterprise Printer'] },
      // Samsung
      'BC7285': { m: 'Samsung', c: 'South Korea', models: ['Samsung Galaxy', 'Samsung TV'] },
      // Virtual
      'F0DEF1': { m: 'VMware Inc.', c: 'USA', v: true, models: ['VMware VM'] },
      '00505A': { m: 'VMware Inc.', c: 'USA', v: true, models: ['VMware VM'] },
      '000C29': { m: 'VMware Inc.', c: 'USA', v: true, models: ['VMware ESXi VM'] },
      '005056': { m: 'VMware Inc.', c: 'USA', v: true, models: ['VMware vSphere VM'] },
      '00155D': { m: 'Microsoft Hyper-V', c: 'USA', v: true, models: ['Hyper-V VM'] },
      '525400': { m: 'QEMU/KVM', c: 'Open Source', v: true, models: ['KVM Virtual Machine'] },
      '080027': { m: 'Oracle VirtualBox', c: 'USA', v: true, models: ['VirtualBox VM'] },
      // Intel
      'A0369F': { m: 'Intel Corp.', c: 'USA', models: ['Intel NUC', 'Intel NIC'] },
      // Synology
      '0011322': { m: 'Synology Inc.', c: 'Taiwan', models: ['Synology NAS'] },
      // Raspberry Pi
      'B827EB': { m: 'Raspberry Pi Foundation', c: 'UK', models: ['Raspberry Pi 3/4'] },
      'DC26B0': { m: 'Raspberry Pi Foundation', c: 'UK', models: ['Raspberry Pi 4/5'] },
      'E45F01': { m: 'Raspberry Pi Foundation', c: 'UK', models: ['Raspberry Pi'] },
    };

    // Try exact 6-char match first, then 4-char prefix
    const entry = OUI_DB[oui.substring(0, 6)] || OUI_DB[oui.substring(0, 4)];
    if (entry) {
      return {
        manufacturer: entry.m,
        country: entry.c,
        isVirtual: entry.v || false,
        possibleModels: entry.models || [],
      };
    }

    return { manufacturer: 'Unknown', country: '', isVirtual: false, possibleModels: [] };
  }

  // ─── Hostname Pattern Analysis ──────────────────────────────
  private analyzeHostname(hostname: string): {
    osGuess: string; pattern: string; deviceRole: string;
  } {
    if (!hostname) return { osGuess: '', pattern: 'Unknown', deviceRole: '' };
    const h = hostname.toLowerCase();

    if (h.includes('macbook') || h.includes('imac') || h.includes('-mac'))
      return { osGuess: 'macOS', pattern: 'Apple naming convention', deviceRole: 'Workstation' };
    if (h.endsWith('.local'))
      return { osGuess: 'macOS/Linux (mDNS)', pattern: 'Bonjour/mDNS .local suffix', deviceRole: 'Endpoint' };
    if (h.includes('win') && (h.includes('desktop') || h.includes('pc') || h.includes('ws')))
      return { osGuess: 'Windows', pattern: 'Windows naming convention', deviceRole: 'Workstation' };
    if (h.startsWith('dc-') || h.includes('-dc') || h.includes('domain'))
      return { osGuess: 'Windows Server', pattern: 'Domain controller naming', deviceRole: 'Domain Controller' };
    if (h.includes('srv') || h.includes('server') || h.includes('esxi') || h.includes('vcenter'))
      return { osGuess: 'Server OS', pattern: 'Server naming convention', deviceRole: 'Server' };
    if (h.includes('fw-') || h.includes('firewall') || h.includes('pfsense') || h.includes('opnsense'))
      return { osGuess: 'Firewall OS', pattern: 'Firewall naming', deviceRole: 'Firewall' };
    if (h.includes('ap-') || h.includes('access-point') || h.includes('unifi'))
      return { osGuess: 'Embedded', pattern: 'Access point naming', deviceRole: 'Wireless AP' };
    if (h.includes('switch') || h.includes('sw-'))
      return { osGuess: 'Network OS', pattern: 'Switch naming', deviceRole: 'Network Switch' };
    if (h.includes('router') || h.includes('gw-') || h.includes('gateway'))
      return { osGuess: 'Router OS', pattern: 'Router/gateway naming', deviceRole: 'Router' };
    if (h.includes('printer') || h.includes('prn') || h.includes('hp-') || h.includes('epson') || h.includes('canon'))
      return { osGuess: 'Embedded', pattern: 'Printer naming', deviceRole: 'Printer' };
    if (h.includes('nas') || h.includes('synology') || h.includes('qnap'))
      return { osGuess: 'Linux (NAS)', pattern: 'NAS device naming', deviceRole: 'NAS Storage' };
    if (h.includes('cam') || h.includes('ipcam') || h.includes('hikvision') || h.includes('dahua'))
      return { osGuess: 'Embedded', pattern: 'IP camera naming', deviceRole: 'IP Camera' };
    if (h.includes('pi') || h.includes('raspberry'))
      return { osGuess: 'Linux (Raspberry Pi)', pattern: 'Raspberry Pi naming', deviceRole: 'IoT Device' };

    return { osGuess: '', pattern: 'Standard', deviceRole: '' };
  }

  // ─── Port Description Database ──────────────────────────────
  private getPortDescription(port: number): string {
    const descs: Record<number, string> = {
      21: 'FTP — File Transfer Protocol (unencrypted)',
      22: 'SSH — Secure Shell (encrypted remote access)',
      23: 'Telnet — Unencrypted remote access (INSECURE)',
      25: 'SMTP — Email relay (often spam target)',
      53: 'DNS — Domain Name System',
      80: 'HTTP — Web server (unencrypted)',
      110: 'POP3 — Email retrieval',
      111: 'RPCbind — Remote Procedure Call',
      135: 'MS-RPC — Microsoft RPC (Windows)',
      137: 'NetBIOS — Windows name service',
      139: 'NetBIOS — Windows file sharing (legacy)',
      143: 'IMAP — Email access',
      161: 'SNMP — Network management',
      389: 'LDAP — Directory services',
      443: 'HTTPS — Encrypted web server',
      445: 'SMB — Windows file sharing',
      631: 'IPP — Internet Printing Protocol',
      993: 'IMAPS — Encrypted email',
      995: 'POP3S — Encrypted email',
      1433: 'MSSQL — Microsoft SQL Server',
      1521: 'Oracle DB — Oracle Database',
      2049: 'NFS — Network File System',
      3306: 'MySQL — MySQL Database',
      3389: 'RDP — Remote Desktop (Windows)',
      5432: 'PostgreSQL — PostgreSQL Database',
      5900: 'VNC — Virtual Network Computing',
      5985: 'WinRM — Windows Remote Management',
      6379: 'Redis — In-memory database',
      8080: 'HTTP Alt — Alternative web server',
      8443: 'HTTPS Alt — Alternative encrypted web',
      9100: 'RAW Print — Direct printer port',
      27017: 'MongoDB — MongoDB Database',
    };
    return descs[port] || `Port ${port}`;
  }

  // ─── Security Recommendations ───────────────────────────────
  private getSecurityRecommendations(ports: any[], deviceType: string): string[] {
    const recs: string[] = [];
    const portNums = ports.map((p: any) => typeof p === 'object' ? p.port : p);
    
    if (portNums.includes(23)) recs.push('CRITICAL: Disable Telnet and switch to SSH for remote management');
    if (portNums.includes(21)) recs.push('HIGH: Replace FTP with SFTP or SCP for file transfers');
    if (portNums.includes(445) || portNums.includes(139)) recs.push('HIGH: Ensure SMB is secured with authentication and not exposed to untrusted networks');
    if (portNums.includes(3389)) recs.push('HIGH: Use VPN or Network Level Authentication for RDP access');
    if (portNums.includes(25)) recs.push('MEDIUM: Ensure SMTP relay is properly configured to prevent spam abuse');
    if (portNums.includes(161)) recs.push('MEDIUM: Use SNMPv3 with authentication instead of SNMPv2c community strings');
    if (portNums.includes(80) && !portNums.includes(443)) recs.push('MEDIUM: Enable HTTPS and redirect HTTP traffic');
    if (portNums.includes(3306) || portNums.includes(5432) || portNums.includes(27017)) {
      recs.push('HIGH: Ensure database ports are not exposed to the public network');
    }
    if (portNums.includes(6379)) recs.push('CRITICAL: Redis should not be exposed — requires authentication and firewall rules');
    
    if (recs.length === 0) {
      recs.push('No critical vulnerabilities detected from port analysis');
      if (deviceType === 'Unknown') recs.push('Consider running a full agent-based scan for deeper analysis');
    }
    return recs;
  }

  // ─── REMOTE COMMAND EXECUTION ─────────────────────────────────────
  async queueRemoteCommand(_tenantId: string, _agentId: string, _body: { command: string; timeout?: number }) {
    throw new BadRequestException(
      'Free-form remote shell is disabled. Use approved ScriptLibrary scripts via /discovery/agents/:agentId/run-script.',
    );
  }

  async storeCommandResult(body: {
    agentId: string;
    command: string;
    output: string;
    exitCode: number;
    timestamp: string;
  }, tenantId?: string) {
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: body.agentId,
        ...(tenantId ? { tenantId } : {}),
      },
    });
    if (!agent) return { received: false };
    
    const systemInfo = (agent.systemInfo as any) || {};
    const commandHistory = systemInfo._commandHistory || [];
    commandHistory.push({
      command: body.command,
      output: body.output?.substring(0, 10000),
      exitCode: body.exitCode,
      executedAt: body.timestamp,
    });
    // Keep only last 50 commands
    if (commandHistory.length > 50) commandHistory.splice(0, commandHistory.length - 50);
    
    // Remove from pending
    const pendingCommands = (systemInfo._pendingCommands || []).filter(
      (c: any) => c.command !== body.command
    );
    
    await this.prisma.agent.update({
      where: { id: agent.id },
      data: { systemInfo: { ...systemInfo, _commandHistory: commandHistory, _pendingCommands: pendingCommands } },
    });
    
    this.logger.log(`Command result received from agent ${body.agentId}: exit=${body.exitCode}`);
    return { received: true };
  }

  async getCommandHistory(agentId: string, tenantId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const systemInfo = (agent.systemInfo as any) || {};
    return {
      history: systemInfo._commandHistory || [],
      pending: systemInfo._pendingCommands || [],
      filePulls: systemInfo._filePullHistory || [],
    };
  }

  /**
   * Queue an approved ScriptLibrary script onto an agent (UEM remote run).
   */
  async queueScriptLibraryRun(
    tenantId: string,
    userId: string,
    agentId: string,
    scriptId: string,
    parameters?: any,
  ) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');

    const script = await this.prisma.scriptLibrary.findFirst({
      where: { id: scriptId, tenantId },
    });
    if (!script) throw new NotFoundException('Script not found');
    if (script.approvalStatus !== 'APPROVED') {
      throw new BadRequestException(
        `Script must be APPROVED before remote run (status=${script.approvalStatus})`,
      );
    }

    const execution = await this.prisma.scanResult.create({
      data: {
        tenantId,
        scanType: 'SCRIPT_EXECUTION',
        targetType: 'HOST',
        target: agent.ipAddress,
        status: 'QUEUED',
        triggeredBy: userId,
        summary: {
          scriptId,
          scriptName: script.name,
          platform: script.platform,
          agentId,
          agentHostname: agent.hostname,
          parameters: parameters || {},
          timeoutSeconds: script.timeoutSeconds,
        },
        rawOutput: script.scriptContent,
      },
    });

    await this.prisma.scriptLibrary.update({
      where: { id: scriptId },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });

    return {
      executionId: execution.id,
      status: 'QUEUED',
      agentId,
      scriptId,
      message: 'Script queued. Agent picks it up on next heartbeat as EXECUTE_SCRIPT.',
    };
  }

  async queueFilePull(
    tenantId: string,
    agentId: string,
    body: { path: string; maxBytes?: number },
  ) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');
    if (!body.path?.trim()) throw new BadRequestException('path is required');

    const rawPath = body.path.trim();
    const isWindowsPath = /^[A-Za-z]:[\\/]/.test(rawPath);
    const pathApi = isWindowsPath ? path.win32 : path.posix;
    if (!pathApi.isAbsolute(rawPath)) {
      throw new BadRequestException('FILE_PULL requires an absolute path');
    }
    const p = pathApi.resolve(rawPath);
    const configuredRoots = (process.env.FILE_PULL_ALLOWED_ROOTS || '')
      .split(',')
      .map((root) => root.trim())
      .filter(Boolean);
    const defaultRoots = isWindowsPath
      ? ['C:\\ProgramData\\QSAssets\\logs', 'C:\\Windows\\Logs']
      : ['/var/log', '/tmp/qs-assets'];
    const allowedRoots = (configuredRoots.length ? configuredRoots : defaultRoots)
      .filter((root) => pathApi.isAbsolute(root))
      .map((root) => pathApi.resolve(root));
    const comparablePath = isWindowsPath ? p.toLowerCase() : p;
    const insideAllowedRoot = allowedRoots.some((root) => {
      const comparableRoot = isWindowsPath ? root.toLowerCase() : root;
      return comparablePath === comparableRoot ||
        comparablePath.startsWith(`${comparableRoot}${pathApi.sep}`);
    });
    const sensitiveSegments =
      /(?:^|[\\/])(?:\.ssh|\.aws|\.gnupg|\.kube|credentials?|secrets?|private|id_(?:rsa|dsa|ecdsa|ed25519)|shadow|sam)(?:[\\/]|$)/i;
    if (!insideAllowedRoot || sensitiveSegments.test(p)) {
      throw new BadRequestException('Path rejected by security policy');
    }

    const systemInfo = (agent.systemInfo as any) || {};
    const pendingActions = Array.isArray(systemInfo._pendingActions)
      ? systemInfo._pendingActions
      : [];
    const pullId = `pull-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingActions.push({
      type: 'FILE_PULL',
      pullId,
      path: p,
      maxBytes: body.maxBytes || 256 * 1024,
    });

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { systemInfo: { ...systemInfo, _pendingActions: pendingActions } },
    });

    return {
      success: true,
      pullId,
      message: 'FILE_PULL queued. Agent will upload file content on next heartbeat.',
    };
  }

  async storeFilePullResult(body: {
    agentId: string;
    pullId?: string;
    path: string;
    content: string;
    truncated?: boolean;
    error?: string;
  }, tenantId?: string) {
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: body.agentId,
        ...(tenantId ? { tenantId } : {}),
      },
    });
    if (!agent) return { received: false };

    const systemInfo = (agent.systemInfo as any) || {};
    const pendingFilePulls = Array.isArray(systemInfo._pendingFilePulls)
      ? systemInfo._pendingFilePulls
      : [];
    const expectedPull = pendingFilePulls.find(
      (action: any) =>
        action.type === 'FILE_PULL' &&
        action.pullId === body.pullId &&
        action.path === body.path,
    );
    if (!expectedPull) {
      throw new BadRequestException('FILE_PULL result does not match a pending request');
    }
    const history = Array.isArray(systemInfo._filePullHistory) ? systemInfo._filePullHistory : [];
    history.push({
      pullId: body.pullId,
      path: body.path,
      content: (body.content || '').substring(0, 200_000),
      truncated: !!body.truncated,
      error: body.error || null,
      receivedAt: new Date().toISOString(),
    });
    if (history.length > 20) history.splice(0, history.length - 20);

    await this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        systemInfo: {
          ...systemInfo,
          _filePullHistory: history,
          _pendingFilePulls: pendingFilePulls.filter((action: any) => action !== expectedPull),
        },
      },
    });

    return { received: true };
  }

  /**
   * Honest remote-assist deep links — rdp:// / ssh:// only (no fake WebRTC).
   */
  async getRemoteAssistDeepLink(agentId: string, tenantId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');

    const host = agent.ipAddress || agent.hostname;
    const platform = (agent.platform || '').toLowerCase();

    if (platform.includes('win')) {
      return {
        available: true,
        type: 'rdp',
        url: `rdp://full%20address=s:${host}:3389`,
        hint: `Opens the system Remote Desktop client to ${host}:3389. No in-browser WebRTC console is provided.`,
        agentId,
        hostname: agent.hostname,
        platform: agent.platform,
      };
    }

    return {
      available: true,
      type: 'ssh',
      url: `ssh://${host}`,
      hint: `Opens an SSH client to ${host}. No in-browser WebRTC console is provided.`,
      agentId,
      hostname: agent.hostname,
      platform: agent.platform,
    };
  }

  async setAgentDeployRing(tenantId: string, agentId: string, deployRing: string) {
    const ring = (deployRing || '').toUpperCase();
    if (!['PILOT', 'STAGED', 'ALL'].includes(ring)) {
      throw new BadRequestException('deployRing must be PILOT, STAGED, or ALL');
    }
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const systemInfo = (agent.systemInfo as any) || {};
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { systemInfo: { ...systemInfo, deployRing: ring } },
    });
    return { agentId, deployRing: ring };
  }

  /**
   * Desktop App package — Electron tray sources from apps/agent-desktop + paired config.
   */
  getDesktopAppPackage(serverUrl?: string, token?: string, userEmail?: string): Buffer {
    const zip = new AdmZip();
    const desktopDir = this.resolveAgentDesktopDirectory();
    const agentDir = this.resolveAgentDirectory();

    if (desktopDir && fs.existsSync(desktopDir)) {
      const include = ['package.json', 'README.md', 'src', 'assets'];
      for (const name of include) {
        const p = path.join(desktopDir, name);
        if (!fs.existsSync(p)) continue;
        const st = fs.statSync(p);
        if (st.isDirectory()) zip.addLocalFolder(p, name);
        else zip.addLocalFile(p);
      }
    } else {
      // Fallback: include macOS .app bundle as the "desktop" artifact
      const appBundle = path.join(agentDir, 'QS-Discovery-Agent.app');
      if (fs.existsSync(appBundle)) {
        zip.addLocalFolder(appBundle, 'QS-Discovery-Agent.app');
      }
      const readme = Buffer.from(
        'QS Discovery Agent — Desktop package\n\n' +
          'Electron sources were not found at apps/agent-desktop.\n' +
          'Use the included .app bundle or build from the monorepo.\n',
        'utf-8',
      );
      zip.addFile('README.txt', readme);
    }

    // Always include core agent for the tray to launch
    const core = path.join(agentDir, 'qs-discovery-agent.js');
    if (fs.existsSync(core)) zip.addLocalFile(core, 'agent');

    if (serverUrl && token) {
      const configObj: Record<string, any> = { server: serverUrl, token };
      if (userEmail) configObj.email = userEmail;
      const configBuffer = Buffer.from(JSON.stringify(configObj, null, 2), 'utf-8');
      zip.addFile('config.json', configBuffer);
      zip.addFile('agent/config.json', configBuffer);
    }

    const instructions = Buffer.from(
      [
        'QS Discovery Agent — Desktop App',
        '',
        '1. Extract this ZIP.',
        '2. Ensure config.json has your server URL + token (pre-filled on download).',
        '3. From apps/agent-desktop (or this package root): npm install && npm start',
        '   Or build installers: npm run dist:mac | dist:win | dist:linux',
        '4. Tray icons reflect ONLINE / OFFLINE / PAUSED.',
        '',
      ].join('\n'),
      'utf-8',
    );
    zip.addFile('INSTALL.txt', instructions);
    return zip.toBuffer();
  }

  /**
   * Service installer package — systemd / launchd / Windows service scripts + agent.
   */
  getServiceInstallerPackage(serverUrl?: string, token?: string, userEmail?: string): Buffer {
    const zip = new AdmZip();
    const agentDir = this.resolveAgentDirectory();
    const packagingDir = path.join(agentDir, 'packaging');

    const serviceFiles = [
      'install-service.sh',
      'install-service.bat',
      'qs-discovery-agent.js',
      'run-agent.sh',
      'run-agent.bat',
      'README.md',
    ];
    for (const file of serviceFiles) {
      const p = path.join(agentDir, file);
      if (fs.existsSync(p)) zip.addLocalFile(p);
    }

    if (fs.existsSync(packagingDir)) {
      zip.addLocalFolder(packagingDir, 'packaging');
    }

    if (serverUrl && token) {
      const configObj: Record<string, any> = { server: serverUrl, token };
      if (userEmail) configObj.email = userEmail;
      zip.addFile('config.json', Buffer.from(JSON.stringify(configObj, null, 2), 'utf-8'));
    }

    zip.addFile(
      'INSTALL.txt',
      Buffer.from(
        [
          'QS Discovery Agent — Service Installer',
          '',
          'Linux:   sudo bash install-service.sh   (or packaging/linux/*.sh)',
          'macOS:   sudo bash install-service.sh   (or packaging/macos/com.qs.discovery-agent.plist)',
          'Windows: Run Install Service.bat as Administrator (or packaging/windows/*.ps1)',
          '',
          'config.json is pre-paired for your tenant.',
          '',
        ].join('\n'),
        'utf-8',
      ),
    );

    return zip.toBuffer();
  }

  private resolveAgentDesktopDirectory(): string | null {
    const candidates = [
      path.resolve(process.cwd(), 'apps/agent-desktop'),
      path.resolve(process.cwd(), '../agent-desktop'),
      path.resolve(process.cwd(), '../../apps/agent-desktop'),
      path.resolve(__dirname, '../../../../../apps/agent-desktop'),
      path.resolve(__dirname, '../../../../../../apps/agent-desktop'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'package.json'))) return c;
    }
    return null;
  }
}
