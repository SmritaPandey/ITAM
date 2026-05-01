import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SnmpResult {
  ip: string;
  sysName?: string;
  sysDescr?: string;
  sysLocation?: string;
  sysContact?: string;
  sysObjectID?: string;
  uptime?: string;
  deviceType?: string;
  interfaces?: SnmpInterface[];
  arpTable?: { ip: string; mac: string }[];
  raw?: Record<string, string>;
}

export interface SnmpInterface {
  index: number;
  name: string;
  type: string;
  speed: string;
  status: 'up' | 'down' | 'unknown';
  macAddress?: string;
  inOctets?: number;
  outOctets?: number;
}

const STANDARD_OIDS: Record<string, string> = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
};

const IF_OIDS = {
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifType: '1.3.6.1.2.1.2.2.1.3',
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
  ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
};

export class SnmpScanner {
  private static readonly logger = new Logger('SnmpScanner');

  static async isAvailable(): Promise<{ available: boolean; path?: string }> {
    try {
      const { stdout } = await execAsync('which snmpwalk', { timeout: 3000 });
      return { available: true, path: stdout.trim() };
    } catch {
      return { available: false };
    }
  }

  /**
   * Full SNMP walk — collects system info, interfaces, and ARP table
   */
  static async walk(ip: string, community = 'public', version = '2c', timeout = 30000): Promise<SnmpResult> {
    const result: SnmpResult = { ip, raw: {} };

    // System info
    for (const [key, oid] of Object.entries(STANDARD_OIDS)) {
      try {
        const { stdout } = await execAsync(
          `snmpget -v${version} -c ${community} -t 5 -r 1 ${ip} ${oid} 2>/dev/null`,
          { timeout: 8000 },
        );
        const value = this.parseSnmpValue(stdout);
        if (value) {
          result.raw![key] = value;
          if (key === 'sysName') result.sysName = value;
          else if (key === 'sysDescr') result.sysDescr = value;
          else if (key === 'sysLocation') result.sysLocation = value;
          else if (key === 'sysContact') result.sysContact = value;
          else if (key === 'sysObjectID') result.sysObjectID = value;
          else if (key === 'sysUpTime') result.uptime = value;
        }
      } catch {}
    }

    // Classify device type
    result.deviceType = this.classifyDevice(result);

    // Interfaces
    try {
      const { stdout } = await execAsync(
        `snmpwalk -v${version} -c ${community} -t 5 -r 1 ${ip} ${IF_OIDS.ifDescr} 2>/dev/null`,
        { timeout },
      );
      const ifNames = this.parseSnmpTable(stdout);
      const interfaces: SnmpInterface[] = [];

      for (const [idx, name] of Object.entries(ifNames)) {
        interfaces.push({
          index: parseInt(idx),
          name,
          type: 'ethernet',
          speed: 'N/A',
          status: 'unknown',
        });
      }

      // Get operational status
      try {
        const { stdout: statusOut } = await execAsync(
          `snmpwalk -v${version} -c ${community} -t 5 -r 1 ${ip} ${IF_OIDS.ifOperStatus} 2>/dev/null`,
          { timeout: 10000 },
        );
        const statuses = this.parseSnmpTable(statusOut);
        for (const [idx, val] of Object.entries(statuses)) {
          const iface = interfaces.find(i => i.index === parseInt(idx));
          if (iface) iface.status = val.includes('1') ? 'up' : 'down';
        }
      } catch {}

      result.interfaces = interfaces;
    } catch {
      this.logger.debug(`No interface data from ${ip}`);
    }

    // ARP table
    try {
      const { stdout } = await execAsync(
        `snmpwalk -v${version} -c ${community} -t 5 -r 1 ${ip} 1.3.6.1.2.1.4.22.1.2 2>/dev/null`,
        { timeout: 10000 },
      );
      const arpEntries: { ip: string; mac: string }[] = [];
      for (const line of stdout.split('\n')) {
        const ipMatch = line.match(/\.(\d+\.\d+\.\d+\.\d+)\s*=/);
        const macMatch = line.match(/STRING:\s*([0-9a-fA-F:]+)/i) || line.match(/Hex-STRING:\s*([0-9a-fA-F ]+)/i);
        if (ipMatch && macMatch) {
          arpEntries.push({ ip: ipMatch[1], mac: macMatch[1].trim() });
        }
      }
      result.arpTable = arpEntries;
    } catch {}

    return result;
  }

  private static parseSnmpValue(output: string): string | null {
    const match = output.match(/=\s*(?:STRING|INTEGER|OID|Timeticks|Counter\d*|Gauge\d*):\s*"?([^"\n]+)"?\s*$/m);
    return match ? match[1].trim() : null;
  }

  private static parseSnmpTable(output: string): Record<string, string> {
    const table: Record<string, string> = {};
    for (const line of output.split('\n')) {
      const match = line.match(/\.(\d+)\s*=\s*(?:STRING|INTEGER):\s*"?([^"\n]+)"?/);
      if (match) table[match[1]] = match[2].trim();
    }
    return table;
  }

  private static classifyDevice(result: SnmpResult): string {
    const desc = (result.sysDescr || '').toLowerCase();
    const oid = result.sysObjectID || '';
    if (desc.includes('cisco')) return oid.includes('1.3.6.1.4.1.9.1') ? 'cisco-router' : 'cisco-switch';
    if (desc.includes('juniper')) return 'juniper-device';
    if (desc.includes('fortigate') || desc.includes('fortinet')) return 'firewall';
    if (desc.includes('printer') || desc.includes('laserjet') || desc.includes('xerox')) return 'printer';
    if (desc.includes('ups') || desc.includes('apc')) return 'ups';
    if (desc.includes('linux')) return 'linux-server';
    if (desc.includes('windows')) return 'windows-server';
    return 'unknown';
  }
}
