import { Injectable, Logger, NotFoundException, BadRequestException, NotImplementedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { ComplianceService } from '../compliance/compliance.service';
import { AlertsService } from '../alerts/alerts.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as dns from 'dns';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { SshScanner } from '../../common/scanners/ssh.scanner';
import { CredentialVaultService } from './credential-vault.service';
import { SnmpScanner } from '../../common/scanners/snmp.scanner';

const execAsync = promisify(exec);

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
          this.eventBus.emitDiscoveryEvent(tenantId, 'new_device', {
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

      this.eventBus.emitDiscoveryEvent(agent.tenantId, 'agent_offline', {
        agentId: agent.id,
        hostname: agent.hostname,
        ipAddress: agent.ipAddress,
        lastHeartbeat: agent.lastHeartbeat,
        message: `Agent ${agent.hostname} has gone offline`,
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

    const updated = await this.prisma.agent.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
        status: 'ONLINE',
        ...(data?.systemInfo ? { systemInfo: data.systemInfo } : {}),
        ...(data?.version ? { agentVersion: data.version } : {}),
      },
    });

    // Warn if agent version is outdated
    const LATEST_AGENT_VERSION = '2.0.0';
    if (data?.version && data.version < LATEST_AGENT_VERSION) {
      this.logger.warn(`Agent ${agent.hostname} is running outdated version ${data.version} (latest: ${LATEST_AGENT_VERSION})`);
    }

    // Run compliance change detection and sync systemInfo snapshot directly to CMDB Asset tables
    if (data?.systemInfo) {
      try {
        await this.complianceService.processHeartbeat(tenantId, id, agent, data.systemInfo);
      } catch (err) {
        this.logger.warn(`Compliance check failed for agent ${agent.hostname}: ${err.message}`);
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
          this.eventBus.emitDiscoveryEvent(tenantId, 'new_device', {
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

      this.logger.log(`Scan job ${scanJobId} completed via agent upload: ${devices.length} devices, ${newCount} new`);
      return { success: true, devicesFound: devices.length, newDevices: newCount };
    } catch (error: any) {
      await this.prisma.scanJob.update({
        where: { id: scanJobId },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: error.message },
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

    // ─── Try SSH/SNMP scan if credentials provided ─────────
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
   * Package all agent collector files into an in-memory ZIP buffer with OS-specific hierarchy.
   */
  getAgentZipPackage(serverUrl?: string, token?: string, userEmail?: string): Buffer {
    const zip = new AdmZip();
    
    // Resolve agent directory
    const possiblePaths = [
      path.resolve(process.cwd(), 'agent'),
      path.resolve(process.cwd(), 'apps/api/agent'),
      path.resolve(process.cwd(), '../../agent'),
      path.resolve(__dirname, '../../../../agent'),
      path.resolve(__dirname, '../../../../../agent'),
      path.resolve(__dirname, '../../../../apps/api/agent'),
    ];

    let agentDir = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        agentDir = p;
        break;
      }
    }
    
    if (!agentDir) {
      this.logger.error(`Discovery agent directory not found.`);
      throw new NotFoundException('Discovery Agent template files not found on the server.');
    }

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
   * Deploy the discovery agent to a remote host via SSH.
   * Resolves SSH credentials from the credential vault, copies the agent package,
   * extracts it, configures the server URL and auth token, and starts the agent service.
   */
  async deployRemoteAgent(
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

      // 3. Generate the agent package with embedded config
      const serverUrl = process.env.API_URL || process.env.SERVER_URL || `http://${os.hostname()}:3001`;
      const token = `agent-deploy-${tenantId}-${Date.now()}`;
      const packageBuffer = this.getAgentZipPackage(serverUrl, token);
      fs.writeFileSync(localPackagePath, packageBuffer);
      logs.push(`[OK] Agent package generated (${Math.round(packageBuffer.length / 1024)} KB)`);

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
        const configJson = JSON.stringify({ server: serverUrl, token }, null, 2);
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
  async queueRemoteCommand(tenantId: string, agentId: string, body: { command: string; timeout?: number }) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');
    
    // Security: block dangerous commands
    const blocked = ['rm -rf /', 'format c:', 'del /f /s /q c:', 'mkfs', ':(){:|:&};:'];
    if (blocked.some(b => body.command.toLowerCase().includes(b))) {
      throw new Error('Command blocked by security policy');
    }

    // Store the command as a pending action in the agent's systemInfo
    const systemInfo = (agent.systemInfo as any) || {};
    const pendingCommands = systemInfo._pendingCommands || [];
    const cmdRecord = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      command: body.command,
      timeout: body.timeout || 30000,
      queuedAt: new Date().toISOString(),
      status: 'QUEUED',
    };
    pendingCommands.push(cmdRecord);
    
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { systemInfo: { ...systemInfo, _pendingCommands: pendingCommands } },
    });

    // Also store in audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: 'REMOTE_COMMAND_QUEUED',
          resourceType: 'Agent',
          resourceId: agentId,
          metadata: { command: body.command, cmdId: cmdRecord.id } as any,
          module: 'discovery',
        },
      });
    } catch {}

    this.logger.log(`Remote command queued for agent ${agentId}: "${body.command}"`);
    return { success: true, commandId: cmdRecord.id, message: 'Command queued. Agent will execute on next heartbeat.' };
  }

  async storeCommandResult(body: {
    agentId: string;
    command: string;
    output: string;
    exitCode: number;
    timestamp: string;
  }) {
    const agent = await this.prisma.agent.findFirst({ where: { id: body.agentId } });
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

  async getCommandHistory(agentId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const systemInfo = (agent.systemInfo as any) || {};
    return {
      history: systemInfo._commandHistory || [],
      pending: systemInfo._pendingCommands || [],
    };
  }
}
