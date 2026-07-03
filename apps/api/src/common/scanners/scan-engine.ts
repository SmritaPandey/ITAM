import { Logger } from '@nestjs/common';
import { NmapScanner } from './nmap.scanner';
import { SnmpScanner } from './snmp.scanner';
import { SshScanner } from './ssh.scanner';
import { ArpScanner } from './arp.scanner';
import { TracerouteScanner } from './traceroute.scanner';
import { SslScanner } from './ssl.scanner';

export interface ScanCapability {
  type: string;
  name: string;
  available: boolean;
  version?: string;
  path?: string;
  description: string;
  mode: 'agentless' | 'agent-based';
  requiresCredentials: boolean;
}

export interface ScanRequest {
  type: 'NMAP' | 'SNMP' | 'SSH' | 'ARP' | 'TRACEROUTE' | 'SSL';
  target: string;
  options?: {
    scanDepth?: 'quick' | 'standard' | 'deep';
    community?: string;       // SNMP community string
    credentialId?: string;    // SSH credential vault ID
    username?: string;
    password?: string;
    privateKeyPath?: string;
    port?: number;
    maxHops?: number;
  };
}

export interface ScanResponse {
  type: string;
  target: string;
  startedAt: Date;
  completedAt: Date;
  duration: number;
  status: 'COMPLETED' | 'FAILED';
  summary: Record<string, any>;
  results: any;
  error?: string;
}

export class ScanEngine {
  private static readonly logger = new Logger('ScanEngine');
  private static activeScanCount = 0;
  private static readonly MAX_CONCURRENT = 3;

  /**
   * Detect all available scanning capabilities
   */
  static async getCapabilities(): Promise<ScanCapability[]> {
    const [nmap, snmp, ssh, arp, traceroute, ssl] = await Promise.all([
      NmapScanner.isAvailable(),
      new SnmpScanner().isAvailable().then(available => ({ available, path: 'net-snmp' })),
      SshScanner.isAvailable(),
      ArpScanner.isAvailable(),
      TracerouteScanner.isAvailable(),
      SslScanner.isAvailable(),
    ]);

    return [
      {
        type: 'NMAP', name: 'Nmap Port Scanner', available: nmap.available,
        version: nmap.version, path: nmap.path,
        description: 'Deep port scanning, OS detection, service versioning, NSE vulnerability scripts',
        mode: 'agentless', requiresCredentials: false,
      },
      {
        type: 'SNMP', name: 'SNMP Walker', available: snmp.available,
        path: snmp.path,
        description: 'SNMP device interrogation — system info, interfaces, ARP table, routing',
        mode: 'agentless', requiresCredentials: false,
      },
      {
        type: 'SSH', name: 'SSH Agent Scanner', available: ssh.available,
        description: 'Remote endpoint audit via SSH — OS, disk, memory, patches, services, open ports, login history',
        mode: 'agent-based', requiresCredentials: true,
      },
      {
        type: 'ARP', name: 'ARP Discovery', available: arp.available,
        description: 'Layer 2 host discovery, MAC vendor identification, rogue device detection',
        mode: 'agentless', requiresCredentials: false,
      },
      {
        type: 'TRACEROUTE', name: 'Traceroute', available: traceroute.available,
        path: traceroute.path,
        description: 'Network path analysis, hop-by-hop latency, routing anomaly detection',
        mode: 'agentless', requiresCredentials: false,
      },
      {
        type: 'SSL', name: 'SSL/TLS Auditor', available: ssl.available,
        description: 'Certificate inspection, cipher audit, expiration check, A+ to F grading',
        mode: 'agentless', requiresCredentials: false,
      },
    ];
  }

  /**
   * Run a scan with concurrency control
   */
  static async runScan(request: ScanRequest): Promise<ScanResponse> {
    if (this.activeScanCount >= this.MAX_CONCURRENT) {
      return {
        type: request.type, target: request.target,
        startedAt: new Date(), completedAt: new Date(), duration: 0,
        status: 'FAILED', summary: {}, results: null,
        error: `Max concurrent scans (${this.MAX_CONCURRENT}) reached. Try again later.`,
      };
    }

    this.activeScanCount++;
    const startedAt = new Date();

    try {
      const results = await this.dispatch(request);
      const completedAt = new Date();
      const duration = (completedAt.getTime() - startedAt.getTime()) / 1000;

      const summary = this.buildSummary(request.type, results);

      return { type: request.type, target: request.target, startedAt, completedAt, duration, status: 'COMPLETED', summary, results };
    } catch (err: any) {
      const completedAt = new Date();
      this.logger.error(`Scan failed for ${request.type} on ${request.target}: ${err.message}`);
      return {
        type: request.type, target: request.target, startedAt, completedAt,
        duration: (completedAt.getTime() - startedAt.getTime()) / 1000,
        status: 'FAILED', summary: {}, results: null, error: err.message,
      };
    } finally {
      this.activeScanCount--;
    }
  }

  private static async dispatch(request: ScanRequest): Promise<any> {
    const { type, target, options } = request;

    switch (type) {
      case 'NMAP': {
        const depth = options?.scanDepth || 'standard';
        if (depth === 'quick') return NmapScanner.quickScan(target);
        if (depth === 'deep') return NmapScanner.deepScan(target);
        return NmapScanner.standardScan(target);
      }
      case 'SNMP':
        return new SnmpScanner().pollDevice(target, options?.community || 'public');
      case 'SSH':
        if (!options?.username) throw new Error('SSH scan requires credentials (username)');
        return SshScanner.scan(target, {
          username: options.username,
          password: options.password,
          privateKeyPath: options.privateKeyPath,
        });
      case 'ARP':
        return ArpScanner.scan(target || undefined);
      case 'TRACEROUTE':
        return TracerouteScanner.trace(target, options?.maxHops || 30);
      case 'SSL':
        return SslScanner.scan(target, options?.port || 443);
      default:
        throw new Error(`Unknown scan type: ${type}`);
    }
  }

  private static buildSummary(type: string, results: any): Record<string, any> {
    switch (type) {
      case 'NMAP':
        return { hostsUp: results.totalUp, hostsDown: results.totalDown, portsFound: results.hosts?.reduce((s: number, h: any) => s + (h.ports?.length || 0), 0) || 0, scanDuration: results.scanDuration };
      case 'SNMP':
        return { deviceType: results.deviceType, sysName: results.sysName, interfaceCount: results.interfaces?.length || 0, arpEntries: results.arpTable?.length || 0 };
      case 'SSH':
        return { hostname: results.hostname, os: results.osInfo?.distro || results.osInfo?.kernel, pendingPatches: results.pendingPatches?.length || 0, openPorts: results.openPorts?.length || 0, services: results.runningServices?.length || 0 };
      case 'ARP':
        return { hostsFound: results.totalFound, source: results.source };
      case 'TRACEROUTE':
        return { totalHops: results.totalHops, reachable: results.reachable, target: results.target };
      case 'SSL':
        return { grade: results.grade, daysRemaining: results.daysRemaining, expired: results.expired, selfSigned: results.selfSigned, warnings: results.warnings?.length || 0 };
      default:
        return {};
    }
  }
}
