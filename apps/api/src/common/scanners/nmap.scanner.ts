import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';

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
  fallbackUsed?: boolean;
}

const COMMON_PORTS = [
  21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995,
  1433, 1521, 1723, 2049, 3000, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 9000
];

const PORT_SERVICES: Record<number, string> = {
  21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns', 80: 'http',
  110: 'pop3', 111: 'rpcbind', 135: 'msrpc', 139: 'netbios-ssn', 143: 'imap',
  443: 'https', 445: 'microsoft-ds', 993: 'imaps', 995: 'pop3s',
  1433: 'ms-sql-s', 1521: 'oracle', 1723: 'pptp', 2049: 'nfs', 3000: 'http-node',
  3306: 'mysql', 3389: 'ms-wbt-server', 5432: 'postgresql', 5900: 'vnc',
  6379: 'redis', 8080: 'http-proxy', 8443: 'https-alt', 9000: 'http-alt'
};

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
   */
  static async pingSweep(subnet: string, timeout = 60000): Promise<NmapScanResult> {
    const isAvail = await this.isAvailable();
    if (!isAvail.available) {
      return this.runPureJsFallback(subnet, 'PING_SWEEP', []);
    }
    return this.runScan(`nmap --unprivileged -sn -PE ${subnet} -oX -`, 'PING_SWEEP', timeout);
  }

  /**
   * Standard scan — top 1000 TCP ports with service detection
   */
  static async standardScan(target: string, timeout = 120000): Promise<NmapScanResult> {
    const isAvail = await this.isAvailable();
    if (!isAvail.available) {
      return this.runPureJsFallback(target, 'STANDARD', COMMON_PORTS);
    }
    return this.runScan(`nmap --unprivileged -sT -sV --top-ports 1000 -T4 --max-retries 2 --host-timeout 60s --min-parallelism 10 ${target} -oX -`, 'STANDARD', timeout);
  }

  /**
   * Quick scan — top 100 ports, faster
   */
  static async quickScan(target: string, timeout = 60000): Promise<NmapScanResult> {
    const isAvail = await this.isAvailable();
    if (!isAvail.available) {
      // Use shorter subset of ports for quick scan fallback
      const quickPorts = [22, 80, 443, 445, 3389, 8080];
      return this.runPureJsFallback(target, 'QUICK', quickPorts);
    }
    return this.runScan(`nmap --unprivileged -sT -F -sV -T4 --max-retries 1 --host-timeout 30s --min-parallelism 10 ${target} -oX -`, 'QUICK', timeout);
  }

  /**
   * Deep scan — all ports + script + versioning
   */
  static async deepScan(target: string, timeout = 300000): Promise<NmapScanResult> {
    const isAvail = await this.isAvailable();
    if (!isAvail.available) {
      return this.runPureJsFallback(target, 'DEEP', COMMON_PORTS);
    }
    return this.runScan(`nmap --unprivileged -sT -sV -sC -p- -T4 --max-retries 2 --host-timeout 300s --min-parallelism 20 ${target} -oX -`, 'DEEP', timeout);
  }

  /**
   * Vulnerability scan
   */
  static async vulnScan(target: string, timeout = 180000): Promise<NmapScanResult> {
    const isAvail = await this.isAvailable();
    if (!isAvail.available) {
      return this.runPureJsFallback(target, 'VULN', COMMON_PORTS);
    }
    return this.runScan(`nmap --unprivileged -sT -sV --script vuln -T4 --max-retries 2 --host-timeout 180s --min-parallelism 10 ${target} -oX -`, 'VULN', timeout);
  }

  /**
   * Custom scan
   */
  static async customScan(args: string, timeout = 120000): Promise<NmapScanResult> {
    const isAvail = await this.isAvailable();
    if (!isAvail.available) {
      throw new Error('Nmap is not installed. Custom scans require the actual Nmap binary.');
    }
    return this.runScan(`nmap ${args} -oX -`, 'CUSTOM', timeout);
  }

  /**
   * Subnet scan
   */
  static async subnetScan(subnet: string, timeout = 180000): Promise<NmapScanResult> {
    const isAvail = await this.isAvailable();
    if (!isAvail.available) {
      return this.runPureJsFallback(subnet, 'SUBNET', COMMON_PORTS);
    }
    return this.runScan(`nmap --unprivileged -sT -sV --top-ports 100 -T4 --max-retries 1 --host-timeout 90s --min-parallelism 30 ${subnet} -oX -`, 'SUBNET', timeout);
  }

  // ─── Internal ────────────────────────────────────────────────────
  private static async runScan(command: string, scanType: string, timeout: number): Promise<NmapScanResult> {
    const startedAt = new Date();
    this.logger.log(`Running nmap: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, { timeout, maxBuffer: 15 * 1024 * 1024 });

      if (stderr && stderr.includes('command not found')) {
        throw new Error('nmap is not installed');
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
      let osGuess = osMatch?.[1];

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
        const service = serviceMatch?.[1] || PORT_SERVICES[port] || `port-${port}`;
        const product = serviceMatch?.[2];
        const version = serviceMatch?.[3];

        ports.push({ port, protocol, state: portState, service, product, version });
      }

      // Script outputs (improved parser)
      const scripts: Record<string, string> = {};
      const scriptMatches = block.match(/<script\s+id="([^"]+)"[^>]*output="([^"]*)"/g) || [];
      for (const sm of scriptMatches) {
        const idMatch = sm.match(/id="([^"]+)"/);
        const outMatch = sm.match(/output="([^"]*)"/);
        if (idMatch && outMatch) {
          scripts[idMatch[1]] = outMatch[1]
            .replace(/&#xa;/g, '\n')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
        }
      }

      // Infer OS Guess from banners if not provided natively by OS detection
      if (!osGuess && ports.length > 0) {
        osGuess = this.inferOsFromPorts(ports);
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

  /**
   * Helper to infer Operating System from banner grabbing and service versions
   */
  private static inferOsFromPorts(ports: NmapPort[]): string | undefined {
    for (const p of ports) {
      const textToSearch = `${p.version || ''} ${p.product || ''} ${p.service || ''}`.toLowerCase();
      if (textToSearch.includes('ubuntu')) return 'Ubuntu Linux';
      if (textToSearch.includes('debian')) return 'Debian Linux';
      if (textToSearch.includes('centos')) return 'CentOS Linux';
      if (textToSearch.includes('redhat') || textToSearch.includes('red hat')) return 'Red Hat Enterprise Linux';
      if (textToSearch.includes('freebsd')) return 'FreeBSD';
      if (textToSearch.includes('synology')) return 'Synology DSM (Linux)';
      if (textToSearch.includes('microsoft-ds') || textToSearch.includes('iis') || textToSearch.includes('windows')) return 'Windows Server';
    }
    return undefined;
  }

  /**
   * High performance, 100% available Node.js native parallel TCP Socket Port Scanner
   */
  private static async runPureJsFallback(target: string, scanType: string, ports: number[]): Promise<NmapScanResult> {
    const startedAt = new Date();
    this.logger.warn(`Nmap is not installed. Falling back to Elite Pure-JS TCP Socket Sweeper for target: ${target}`);

    // Resolve IPs (subnet expansion or direct IP)
    let ipsToScan: string[] = [];
    if (target.includes('/')) {
      ipsToScan = this.expandSubnet(target);
    } else {
      ipsToScan = [target];
    }

    // All targets go through the real Pure JS TCP scanner — no demo/simulation modes

    const hosts: NmapHost[] = [];
    // Concurrency limit for scanning hosts
    const BATCH_SIZE = 16;
    for (let i = 0; i < ipsToScan.length; i += BATCH_SIZE) {
      const batch = ipsToScan.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(ip => this.scanSingleHostJs(ip, ports)));
      hosts.push(...batchResults.filter((h): h is NmapHost => h !== null));
    }

    const completedAt = new Date();
    return {
      command: `pure-js-socket-sweep --ports=${ports.join(',')}`,
      scanType,
      startedAt,
      completedAt,
      hosts,
      totalUp: hosts.filter(h => h.state === 'up').length,
      totalDown: ipsToScan.length - hosts.filter(h => h.state === 'up').length,
      scanDuration: (completedAt.getTime() - startedAt.getTime()) / 1000,
      fallbackUsed: true,
    };
  }

  /**
   * Scan a single host using node TCP sockets
   */
  private static async scanSingleHostJs(ip: string, portsToScan: number[]): Promise<NmapHost | null> {
    // If ports array is empty, this was a pingSweep. We will do a fast ping/TCP probe on standard ports to verify host state
    const isPingSweep = portsToScan.length === 0;
    const testPorts = isPingSweep ? [22, 80, 443, 445, 3389] : portsToScan;

    const openPorts: NmapPort[] = [];
    const timeout = 1000;

    // Scan ports in parallel chunks
    const PORT_BATCH_SIZE = 20;
    let anyPortOpen = false;

    for (let i = 0; i < testPorts.length; i += PORT_BATCH_SIZE) {
      const batch = testPorts.slice(i, i + PORT_BATCH_SIZE);
      const checks = await Promise.all(batch.map(port => this.checkPortJs(ip, port, timeout)));

      for (const res of checks) {
        if (res.state === 'open') {
          anyPortOpen = true;
          if (!isPingSweep) {
            openPorts.push({
              port: res.port,
              protocol: 'tcp',
              state: 'open',
              service: PORT_SERVICES[res.port] || `port-${res.port}`,
              product: res.product,
              version: res.version,
            });
          }
        }
      }
    }

    // In a ping sweep or fallback discovery, if at least one port is open or host answers, it is considered 'up'
    if (anyPortOpen || !isPingSweep) {
      const osGuess = this.inferOsFromPorts(openPorts);
      return {
        ip,
        state: anyPortOpen ? 'up' : 'down',
        ports: openPorts,
        osGuess,
      };
    }

    return null;
  }

  /**
   * Probe standard TCP socket connection and attempt a short banner grab
   */
  private static checkPortJs(ip: string, port: number, timeout = 1000): Promise<{ port: number; state: 'open' | 'closed'; product?: string; version?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let connected = false;
      let banner = '';

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        connected = true;
        // Send basic payload to trigger banner responses (SSH, FTP send greeting automatically)
        socket.write('HEAD / HTTP/1.0\r\n\r\n');
        // Let it sit momentarily for a banner grab, then close
        setTimeout(() => {
          socket.destroy();
        }, 150);
      });

      socket.on('data', (chunk) => {
        banner += chunk.toString('utf8');
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ port, state: 'closed' });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({ port, state: 'closed' });
      });

      socket.on('close', () => {
        if (connected) {
          // Parse banner strings to guess product and version
          const parsed = this.parseGrabbedBanner(banner, port);
          resolve({ port, state: 'open', ...parsed });
        } else {
          resolve({ port, state: 'closed' });
        }
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Parse banner details grabbed from socket connection
   */
  private static parseGrabbedBanner(banner: string, port: number): { product?: string; version?: string } {
    if (!banner) return {};
    const lines = banner.split('\n');

    // SSH: SSH-2.0-OpenSSH_8.2p1 Ubuntu-4ubuntu0.5
    if (banner.startsWith('SSH-')) {
      const match = banner.match(/SSH-[\d.]+-(\S+)_(\S+)/);
      if (match) {
        return { product: match[1], version: match[2].trim() };
      }
    }

    // HTTP banner headers: Server: nginx/1.18.0
    const serverLine = lines.find(l => l.toLowerCase().startsWith('server:'));
    if (serverLine) {
      const match = serverLine.match(/Server:\s*(\S+)\/(\S+)/i);
      if (match) {
        return { product: match[1], version: match[2].trim() };
      }
      return { product: serverLine.replace(/Server:\s*/i, '').trim() };
    }

    // FTP: 220 VSFTpd 3.0.3
    if (port === 21 && banner.includes('220')) {
      const clean = banner.replace('220', '').trim();
      const parts = clean.split(/\s+/);
      return { product: parts[0], version: parts[1] };
    }

    return {};
  }

  /**
   * Simple helper to expand CIDR subnet strings into IP listings
   */
  private static expandSubnet(cidr: string): string[] {
    const match = cidr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/);
    if (!match) return [cidr];

    const ip = (parseInt(match[1]) << 24) + (parseInt(match[2]) << 16) + (parseInt(match[3]) << 8) + parseInt(match[4]);
    const mask = parseInt(match[5]);
    const maxHosts = Math.pow(2, 32 - mask);

    // Limit fallback scans to a safe maximum of 256 hosts to avoid excessive socket usage
    const limit = Math.min(maxHosts, 256);
    const ips: string[] = [];
    const startIp = ip & (0xFFFFFFFF << (32 - mask));

    for (let i = 1; i < limit - 1; i++) {
      const nextIp = startIp + i;
      const ipStr = [
        (nextIp >>> 24) & 0xFF,
        (nextIp >>> 16) & 0xFF,
        (nextIp >>> 8) & 0xFF,
        nextIp & 0xFF
      ].join('.');
      ips.push(ipStr);
    }
    return ips;
  }
}
