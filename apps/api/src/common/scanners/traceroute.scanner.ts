import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dns from 'dns';

const execAsync = promisify(exec);

export interface TracerouteHop {
  hop: number;
  ip?: string;
  hostname?: string;
  rtt: number[];
  minRtt?: number;
  maxRtt?: number;
  avgRtt?: number;
  jitter?: number;
  loss: boolean;
}

export interface TracerouteResult {
  target: string;
  resolvedIp?: string;
  hops: TracerouteHop[];
  totalHops: number;
  reachable: boolean;
  protocolUsed: 'UDP' | 'ICMP' | 'TCP' | 'TRACERT';
  scannedAt: Date;
  error?: string;
}

export class TracerouteScanner {
  private static readonly logger = new Logger('TracerouteScanner');

  static async isAvailable(): Promise<{ available: boolean; path?: string }> {
    try {
      const binary = process.platform === 'win32' ? 'tracert' : 'traceroute';
      const { stdout } = await execAsync(`which ${binary} 2>/dev/null || where ${binary} 2>/dev/null`, { timeout: 3000 });
      return { available: true, path: stdout.trim() };
    } catch {
      return { available: false };
    }
  }

  /**
   * Helper to perform concurrent reverse DNS resolution on all hops
   */
  private static async resolveHopHostnames(hops: TracerouteHop[]): Promise<void> {
    const promises = hops.map(async (hop) => {
      if (hop.ip && !hop.hostname) {
        try {
          const hosts = await dns.promises.reverse(hop.ip);
          if (hosts && hosts.length > 0) {
            hop.hostname = hosts[0];
          }
        } catch {
          // Silent catch — if reverse DNS is not available, we leave it blank
        }
      }
    });
    await Promise.allSettled(promises);
  }

  /**
   * Safe calculation of latency variation (jitter / standard deviation)
   */
  private static calculateStats(rtts: number[]): { minRtt?: number; maxRtt?: number; avgRtt?: number; jitter?: number } {
    if (rtts.length === 0) return {};
    
    const minRtt = Math.min(...rtts);
    const maxRtt = Math.max(...rtts);
    const avgRtt = rtts.reduce((a, b) => a + b, 0) / rtts.length;
    
    let jitter = 0;
    if (rtts.length > 1) {
      const squareDiffs = rtts.map(r => Math.pow(r - avgRtt, 2));
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
      jitter = Math.sqrt(avgSquareDiff);
    }

    return {
      minRtt: Math.round(minRtt * 100) / 100,
      maxRtt: Math.round(maxRtt * 100) / 100,
      avgRtt: Math.round(avgRtt * 100) / 100,
      jitter: Math.round(jitter * 100) / 100,
    };
  }

  /**
   * Run traceroute to target with multi-protocol fallback sweeps
   */
  static async trace(target: string, maxHops = 30, timeout = 60000): Promise<TracerouteResult> {
    const isWindows = process.platform === 'win32';
    const result: TracerouteResult = {
      target,
      hops: [],
      totalHops: 0,
      reachable: false,
      protocolUsed: isWindows ? 'TRACERT' : 'UDP',
      scannedAt: new Date(),
    };

    // Determine candidate command strings for different protocols
    const attempts: { protocol: TracerouteResult['protocolUsed']; command: string }[] = [];

    if (isWindows) {
      attempts.push({
        protocol: 'TRACERT',
        command: `tracert -h ${maxHops} -w 1000 ${target}`,
      });
    } else {
      // 1. Primary: Standard UDP trace
      attempts.push({
        protocol: 'UDP',
        command: `traceroute -m ${maxHops} -w 2 ${target}`,
      });
      // 2. Fallback: ICMP Echo Request trace (extremely effective if UDP is blocked)
      attempts.push({
        protocol: 'ICMP',
        command: `traceroute -I -m ${maxHops} -w 2 ${target}`,
      });
      // 3. Fallback: TCP SYN trace (uses port 80/443, highly successful through web firewalls)
      const tcpCmd = process.platform === 'darwin'
        ? `traceroute -P TCP -p 80 -m ${maxHops} -w 2 ${target}`
        : `traceroute -T -p 80 -m ${maxHops} -w 2 ${target}`;
      attempts.push({
        protocol: 'TCP',
        command: tcpCmd,
      });
    }

    let lastError = '';

    for (const attempt of attempts) {
      try {
        this.logger.log(`Running traceroute on ${target} via ${attempt.protocol}: "${attempt.command}"`);
        const { stdout } = await execAsync(attempt.command, { timeout });
        
        const hops = this.parseOutput(stdout, isWindows);
        
        // Audit the resolved path. If we got mostly asterisks (more than 70% loss) or 0 hops, try fallback
        const lostHopsCount = hops.filter(h => h.loss).length;
        const totalParsedHops = hops.length;
        const lossRatio = totalParsedHops > 0 ? lostHopsCount / totalParsedHops : 1.0;

        if (totalParsedHops > 0 && lossRatio < 0.7) {
          result.hops = hops;
          result.protocolUsed = attempt.protocol;
          break; // Successful scan achieved!
        } else {
          this.logger.warn(`Traceroute via ${attempt.protocol} failed due to high packet loss (${Math.round(lossRatio * 100)}%). Trying fallback...`);
          if (hops.length > 0 && result.hops.length === 0) {
            // Keep the best attempt results if fallbacks also fail
            result.hops = hops;
            result.protocolUsed = attempt.protocol;
          }
        }
      } catch (err: any) {
        lastError = err.message;
        this.logger.warn(`Traceroute attempt via ${attempt.protocol} error: ${err.message}`);
      }
    }

    if (result.hops.length === 0) {
      result.error = lastError || 'All traceroute protocol attempts timed out or returned no hops.';
      return result;
    }

    // Resolve header resolved IP if present
    const firstHop = result.hops[0];
    if (firstHop && firstHop.ip) {
      result.resolvedIp = firstHop.ip;
    }

    // Run parallel reverse DNS hostname lookups on all discovered hop IPs
    await this.resolveHopHostnames(result.hops);

    result.totalHops = result.hops.length;
    
    // Check if the target was reachable (the final hop responded successfully)
    const finalHop = result.hops[result.hops.length - 1];
    result.reachable = result.hops.length > 0 && !finalHop?.loss;

    return result;
  }

  /**
   * Parse Unix traceroute and Windows tracert command stdout lines
   */
  private static parseOutput(stdout: string, isWindows: boolean): TracerouteHop[] {
    const hops: TracerouteHop[] = [];
    const lines = stdout.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (isWindows) {
        // Parse Windows: "  1    <1 ms    <1 ms    <1 ms  192.168.1.1" or "  2     *        *        *     Request timed out."
        const match = line.match(/^\s*(\d+)\s+(.+)$/);
        if (!match) continue;

        const hopNum = parseInt(match[1]);
        const rest = match[2].trim();

        if (rest.includes('Request timed out') || rest.includes('* * *')) {
          hops.push({ hop: hopNum, rtt: [], loss: true });
          continue;
        }

        // Extract RTT numeric values
        const rtts: number[] = [];
        const rttMatches = rest.match(/(<[\d.]+|[\d.]+)\s*ms/g) || [];
        for (const rm of rttMatches) {
          const num = parseFloat(rm.replace('ms', '').replace('<', '').trim());
          if (!isNaN(num)) rtts.push(num);
        }

        // Extract IP/Hostname
        let ip: string | undefined;
        let hostname: string | undefined;
        
        const ipMatches = rest.match(/\[?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]?/);
        if (ipMatches) {
          ip = ipMatches[1];
        }

        const hostPart = rest.split(/\s+/).pop();
        if (hostPart && hostPart !== ip && !hostPart.includes('ms')) {
          hostname = hostPart;
        }

        const stats = this.calculateStats(rtts);
        hops.push({
          hop: hopNum,
          ip,
          hostname,
          rtt: rtts,
          ...stats,
          loss: rtts.length === 0,
        });

      } else {
        // Parse Unix: " 1  gateway (192.168.1.1)  1.234 ms  1.456 ms  1.678 ms"
        const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
        if (!hopMatch) continue;

        const hopNum = parseInt(hopMatch[1]);
        const rest = hopMatch[2].trim();

        if (rest.includes('* * *') || rest === '*') {
          hops.push({ hop: hopNum, rtt: [], loss: true });
          continue;
        }

        // Extract hostname/IP and RTT values
        const hostMatch = rest.match(/(\S+)\s+\((\d+\.\d+\.\d+\.\d+)\)/);
        const rttMatches = rest.match(/([\d.]+)\s*ms/g) || [];
        const rtts = rttMatches.map(r => parseFloat(r.replace(' ms', '')));

        let ip = hostMatch ? hostMatch[2] : undefined;
        let hostname = hostMatch ? (hostMatch[1] !== hostMatch[2] ? hostMatch[1] : undefined) : undefined;

        if (!ip) {
          const directIp = rest.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
          if (directIp) ip = directIp[0];
        }

        const stats = this.calculateStats(rtts);
        hops.push({
          hop: hopNum,
          ip,
          hostname,
          rtt: rtts,
          ...stats,
          loss: rtts.length === 0,
        });
      }
    }

    return hops;
  }
}
