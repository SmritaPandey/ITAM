import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TracerouteHop {
  hop: number;
  ip?: string;
  hostname?: string;
  rtt: number[];
  avgRtt?: number;
  loss: boolean;
}

export interface TracerouteResult {
  target: string;
  resolvedIp?: string;
  hops: TracerouteHop[];
  totalHops: number;
  reachable: boolean;
  scannedAt: Date;
}

export class TracerouteScanner {
  private static readonly logger = new Logger('TracerouteScanner');

  static async isAvailable(): Promise<{ available: boolean; path?: string }> {
    try {
      const { stdout } = await execAsync('which traceroute', { timeout: 3000 });
      return { available: true, path: stdout.trim() };
    } catch {
      return { available: false };
    }
  }

  /**
   * Run traceroute to target
   */
  static async trace(target: string, maxHops = 30, timeout = 60000): Promise<TracerouteResult> {
    const result: TracerouteResult = { target, hops: [], totalHops: 0, reachable: false, scannedAt: new Date() };

    try {
      const { stdout } = await execAsync(
        `traceroute -m ${maxHops} -w 3 ${target} 2>&1`,
        { timeout },
      );

      const lines = stdout.split('\n');

      // First line: traceroute to x.x.x.x (x.x.x.x), 30 hops max
      const headerMatch = lines[0]?.match(/traceroute to \S+ \((\d+\.\d+\.\d+\.\d+)\)/);
      if (headerMatch) result.resolvedIp = headerMatch[1];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse: "1  gateway (192.168.1.1)  1.234 ms  1.456 ms  1.678 ms"
        const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
        if (!hopMatch) continue;

        const hopNum = parseInt(hopMatch[1]);
        const rest = hopMatch[2];

        if (rest.includes('* * *')) {
          result.hops.push({ hop: hopNum, rtt: [], loss: true });
          continue;
        }

        // Extract hostname/IP and RTT values
        const hostMatch = rest.match(/(\S+)\s+\((\d+\.\d+\.\d+\.\d+)\)/);
        const rttMatches = rest.match(/([\d.]+)\s*ms/g) || [];
        const rtts = rttMatches.map(r => parseFloat(r.replace(' ms', '')));

        const hop: TracerouteHop = {
          hop: hopNum,
          ip: hostMatch ? hostMatch[2] : undefined,
          hostname: hostMatch ? (hostMatch[1] !== hostMatch[2] ? hostMatch[1] : undefined) : undefined,
          rtt: rtts,
          avgRtt: rtts.length > 0 ? Math.round((rtts.reduce((a, b) => a + b, 0) / rtts.length) * 100) / 100 : undefined,
          loss: rtts.length === 0,
        };

        // If no hostname/IP match, try direct IP
        if (!hop.ip) {
          const directIp = rest.match(/(\d+\.\d+\.\d+\.\d+)/);
          if (directIp) hop.ip = directIp[1];
        }

        result.hops.push(hop);
      }

      result.totalHops = result.hops.length;
      result.reachable = result.hops.length > 0 && !result.hops[result.hops.length - 1]?.loss;

    } catch (err: any) {
      this.logger.warn(`Traceroute to ${target} failed: ${err.message}`);
    }

    return result;
  }
}
