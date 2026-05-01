import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ArpEntry {
  ip: string;
  mac: string;
  vendor?: string;
  interface?: string;
  isManaged?: boolean;
}

export interface ArpScanResult {
  entries: ArpEntry[];
  totalFound: number;
  scannedAt: Date;
  source: 'arp-table' | 'arp-scan';
}

// Common MAC OUI prefixes for vendor lookup
const OUI_DB: Record<string, string> = {
  '00:50:56': 'VMware', '00:0C:29': 'VMware', '00:1C:42': 'Parallels',
  'AC:DE:48': 'Apple', '8C:85:90': 'Apple', 'A4:83:E7': 'Apple', 'F0:18:98': 'Apple',
  '3C:22:FB': 'Apple', 'DC:A9:04': 'Apple', '00:1A:2B': 'Apple',
  'B8:27:EB': 'Raspberry Pi', 'DC:A6:32': 'Raspberry Pi',
  '00:1B:44': 'SonicWall', '00:17:C5': 'SonicWall',
  '00:1E:BD': 'Cisco', '00:1A:A1': 'Cisco', '00:26:0B': 'Cisco',
  '00:1B:ED': 'HP', '3C:D9:2B': 'HP', '00:17:A4': 'HP',
  '00:1E:68': 'Dell', 'B8:AC:6F': 'Dell', '00:14:22': 'Dell',
  '00:15:5D': 'Microsoft Hyper-V', '00:03:FF': 'Microsoft',
  '00:E0:4C': 'Realtek', '52:54:00': 'QEMU/KVM',
  '08:00:27': 'VirtualBox',
};

export class ArpScanner {
  private static readonly logger = new Logger('ArpScanner');

  static async isAvailable(): Promise<{ available: boolean; arpScanAvailable: boolean }> {
    const arpScanAvailable = await this.checkCmd('arp-scan');
    return { available: true, arpScanAvailable }; // arp -a is always available
  }

  private static async checkCmd(cmd: string): Promise<boolean> {
    try { await execAsync(`which ${cmd}`, { timeout: 3000 }); return true; } catch { return false; }
  }

  /**
   * Scan local network using arp -a (always available) or arp-scan (if installed)
   */
  static async scan(subnet?: string): Promise<ArpScanResult> {
    const { arpScanAvailable } = await this.isAvailable();

    if (arpScanAvailable && subnet) {
      return this.arpScanBinary(subnet);
    }
    return this.arpTable();
  }

  /**
   * Read the system ARP table (no root needed)
   */
  static async arpTable(): Promise<ArpScanResult> {
    const entries: ArpEntry[] = [];

    try {
      const { stdout } = await execAsync('arp -a 2>/dev/null', { timeout: 10000 });

      for (const line of stdout.split('\n')) {
        // macOS: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
        // Linux: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on eth0
        const match = line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-fA-F:]+)\s+.*?on\s+(\S+)/);
        if (match && match[2] !== '(incomplete)' && match[2] !== 'ff:ff:ff:ff:ff:ff') {
          const mac = match[2].toUpperCase();
          entries.push({
            ip: match[1],
            mac,
            vendor: this.lookupVendor(mac),
            interface: match[3],
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`ARP table read failed: ${err.message}`);
    }

    return { entries, totalFound: entries.length, scannedAt: new Date(), source: 'arp-table' };
  }

  /**
   * Use arp-scan binary for active scanning (requires install)
   */
  private static async arpScanBinary(subnet: string): Promise<ArpScanResult> {
    const entries: ArpEntry[] = [];

    try {
      const { stdout } = await execAsync(`sudo arp-scan ${subnet} 2>/dev/null || arp-scan ${subnet} 2>/dev/null`, { timeout: 30000 });

      for (const line of stdout.split('\n')) {
        const match = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:]+)\s+(.*)/);
        if (match) {
          entries.push({
            ip: match[1],
            mac: match[2].toUpperCase(),
            vendor: match[3].trim() || this.lookupVendor(match[2].toUpperCase()),
          });
        }
      }
    } catch {
      return this.arpTable(); // Fallback
    }

    return { entries, totalFound: entries.length, scannedAt: new Date(), source: 'arp-scan' };
  }

  /**
   * Lookup vendor by MAC OUI prefix
   */
  static lookupVendor(mac: string): string | undefined {
    const prefix = mac.substring(0, 8).toUpperCase();
    return OUI_DB[prefix];
  }

  /**
   * Compare ARP results with managed assets to find rogue devices
   */
  static findRogueDevices(arpEntries: ArpEntry[], managedIPs: string[]): ArpEntry[] {
    const managedSet = new Set(managedIPs);
    return arpEntries.filter(e => !managedSet.has(e.ip)).map(e => ({ ...e, isManaged: false }));
  }
}
