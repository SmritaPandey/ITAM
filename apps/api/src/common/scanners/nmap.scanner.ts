import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface NmapHost {
  ip: string;
  hostname?: string;
  state: 'up' | 'down';
  latency?: number;
  mac?: string;
  vendor?: string;
  osGuess?: string;
  ports: NmapPort[];
  scripts?: Record<string, string>;
}

export interface NmapPort {
  port: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered';
  service: string;
  version?: string;
  product?: string;
}

export interface NmapScanResult {
  command: string;
  scanType: string;
  startedAt: Date;
  completedAt: Date;
  hosts: NmapHost[];
  totalUp: number;
  totalDown: number;
  scanDuration: number;
}

/**
 * Nmap scanner utility — wraps the nmap binary for deep network scanning.
 * Requires nmap to be installed on the host (`brew install nmap` / `apt install nmap`).
 */
export class NmapScanner {
  private static readonly logger = new Logger('NmapScanner');

  /**
   * Check if nmap is available
   */
  static async isAvailable(): Promise<{ available: boolean; version?: string; path?: string }> {
    try {
      const { stdout } = await execAsync('which nmap', { timeout: 3000 });
      const path = stdout.trim();
      const { stdout: verOut } = await execAsync('nmap --version', { timeout: 3000 });
      const verMatch = verOut.match(/Nmap version ([\d.]+)/);
      return { available: true, version: verMatch?.[1], path };
    } catch {
      return { available: false };
    }
  }

  /**
   * Quick host discovery — ping sweep only (fast, no port scan)
   * Equivalent to: nmap -sn <subnet>
   */
  static async pingSweep(subnet: string, timeout = 60000): Promise<NmapScanResult> {
    return this.runScan(`nmap -sn ${subnet} -oX -`, 'PING_SWEEP', timeout);
  }

  /**
   * Standard scan — top 1000 TCP ports with service detection
   * Equivalent to: nmap -sV <target>
   */
  static async standardScan(target: string, timeout = 120000): Promise<NmapScanResult> {
    return this.runScan(`nmap -sV --top-ports 1000 ${target} -oX -`, 'STANDARD', timeout);
  }

  /**
   * Quick scan — top 100 ports, faster
   * Equivalent to: nmap -F <target>
   */
  static async quickScan(target: string, timeout = 60000): Promise<NmapScanResult> {
    return this.runScan(`nmap -F -sV ${target} -oX -`, 'QUICK', timeout);
  }

  /**
   * Deep scan — all 65535 TCP ports + OS detection + version detection + scripts
   * Equivalent to: nmap -A -p- <target>
   * WARNING: This is slow and aggressive
   */
  static async deepScan(target: string, timeout = 300000): Promise<NmapScanResult> {
    return this.runScan(`nmap -A -p- --max-retries 2 ${target} -oX -`, 'DEEP', timeout);
  }

  /**
   * Vulnerability scan — runs default NSE scripts for known CVEs
   * Equivalent to: nmap --script vuln <target>
   */
  static async vulnScan(target: string, timeout = 180000): Promise<NmapScanResult> {
    return this.runScan(`nmap -sV --script vuln ${target} -oX -`, 'VULN', timeout);
  }

  /**
   * Custom scan — pass any nmap arguments
   */
  static async customScan(args: string, timeout = 120000): Promise<NmapScanResult> {
    return this.runScan(`nmap ${args} -oX -`, 'CUSTOM', timeout);
  }

  /**
   * Subnet discovery with OS detection
   * Equivalent to: nmap -O -sV <subnet>
   */
  static async subnetScan(subnet: string, timeout = 180000): Promise<NmapScanResult> {
    return this.runScan(`nmap -O -sV --top-ports 100 ${subnet} -oX -`, 'SUBNET', timeout);
  }

  // ─── Internal ────────────────────────────────────────────────────
  private static async runScan(command: string, scanType: string, timeout: number): Promise<NmapScanResult> {
    const startedAt = new Date();
    this.logger.log(`Running nmap: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, { timeout, maxBuffer: 10 * 1024 * 1024 });

      if (stderr && stderr.includes('command not found')) {
        throw new Error('nmap is not installed. Install with: brew install nmap');
      }

      const completedAt = new Date();
      const hosts = this.parseNmapXml(stdout);

      const result: NmapScanResult = {
        command: command.replace(/-oX -/, '').trim(),
        scanType,
        startedAt,
        completedAt,
        hosts,
        totalUp: hosts.filter(h => h.state === 'up').length,
        totalDown: hosts.filter(h => h.state === 'down').length,
        scanDuration: (completedAt.getTime() - startedAt.getTime()) / 1000,
      };

      this.logger.log(`Scan complete: ${result.totalUp} hosts up, ${hosts.reduce((s, h) => s + h.ports.length, 0)} ports found in ${result.scanDuration}s`);
      return result;
    } catch (err: any) {
      this.logger.error(`Nmap scan failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Parse nmap XML output into structured data
   */
  private static parseNmapXml(xml: string): NmapHost[] {
    const hosts: NmapHost[] = [];

    // Match each <host> block
    const hostBlocks = xml.match(/<host\b[^>]*>[\s\S]*?<\/host>/g) || [];

    for (const block of hostBlocks) {
      // State
      const stateMatch = block.match(/<status\s+state="(\w+)"/);
      const state = stateMatch?.[1] === 'up' ? 'up' : 'down';

      // IP address
      const ipMatch = block.match(/<address\s+addr="([^"]+)"\s+addrtype="ipv4"/);
      if (!ipMatch) continue;
      const ip = ipMatch[1];

      // MAC address + vendor
      const macMatch = block.match(/<address\s+addr="([^"]+)"\s+addrtype="mac"(?:\s+vendor="([^"]*)")?/);
      const mac = macMatch?.[1];
      const vendor = macMatch?.[2];

      // Hostname
      const hostnameMatch = block.match(/<hostname\s+name="([^"]+)"/);
      const hostname = hostnameMatch?.[1];

      // Latency
      const latencyMatch = block.match(/srtt="(\d+)"/);
      const latency = latencyMatch ? parseInt(latencyMatch[1]) / 1000 : undefined;

      // OS detection
      const osMatch = block.match(/<osmatch\s+name="([^"]+)"/);
      const osGuess = osMatch?.[1];

      // Ports
      const ports: NmapPort[] = [];
      const portMatches = block.match(/<port\b[^>]*>[\s\S]*?<\/port>/g) || [];

      for (const portBlock of portMatches) {
        const portIdMatch = portBlock.match(/protocol="(\w+)"\s+portid="(\d+)"/);
        if (!portIdMatch) continue;

        const protocol = portIdMatch[1] as 'tcp' | 'udp';
        const port = parseInt(portIdMatch[2]);

        const portStateMatch = portBlock.match(/<state\s+state="(\w+)"/);
        const portState = (portStateMatch?.[1] || 'closed') as 'open' | 'closed' | 'filtered';

        const serviceMatch = portBlock.match(/<service\s+name="([^"]*)"(?:\s+product="([^"]*)")?(?:\s+version="([^"]*)")?/);
        const service = serviceMatch?.[1] || `port-${port}`;
        const product = serviceMatch?.[2];
        const version = serviceMatch?.[3];

        ports.push({ port, protocol, state: portState, service, product, version });
      }

      // Script outputs
      const scripts: Record<string, string> = {};
      const scriptMatches = block.match(/<script\s+id="([^"]+)"[^>]*output="([^"]*)"/g) || [];
      for (const sm of scriptMatches) {
        const idMatch = sm.match(/id="([^"]+)"/);
        const outMatch = sm.match(/output="([^"]*)"/);
        if (idMatch && outMatch) {
          scripts[idMatch[1]] = outMatch[1].replace(/&#xa;/g, '\n').replace(/&amp;/g, '&');
        }
      }

      hosts.push({
        ip,
        hostname,
        state,
        latency,
        mac,
        vendor,
        osGuess,
        ports: ports.filter(p => p.state === 'open'),
        scripts: Object.keys(scripts).length > 0 ? scripts : undefined,
      });
    }

    return hosts;
  }
}
