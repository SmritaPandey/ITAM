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
  warnings?: string[];
}

export interface ArpScanResult {
  entries: ArpEntry[];
  totalFound: number;
  scannedAt: Date;
  source: 'arp-table' | 'arp-scan' | 'ping-sweep-fallback';
  conflicts?: { type: 'IP_CONFLICT' | 'MAC_SPOOFING'; ip: string; macs?: string[]; mac?: string; ips?: string[] }[];
}

// Curated 80+ common MAC OUI prefixes for vendor lookup
const OUI_DB: Record<string, string> = {
  '00:50:56': 'VMware', '00:0C:29': 'VMware', '00:05:69': 'VMware', '00:1C:42': 'Parallels',
  'AC:DE:48': 'Apple', '8C:85:90': 'Apple', 'A4:83:E7': 'Apple', 'F0:18:98': 'Apple',
  '3C:22:FB': 'Apple', 'DC:A9:04': 'Apple', '00:1A:2B': 'Apple', '00:1C:B3': 'Apple',
  '00:25:00': 'Apple', '00:25:4B': 'Apple', '00:26:B0': 'Apple', 'B8:27:EB': 'Raspberry Pi',
  'DC:A6:32': 'Raspberry Pi', 'E4:5F:01': 'Raspberry Pi', '00:1B:44': 'SonicWall',
  '00:17:C5': 'SonicWall', '00:1E:BD': 'Cisco', '00:1A:A1': 'Cisco', '00:26:0B': 'Cisco',
  '00:00:0C': 'Cisco', '00:01:42': 'Cisco', '00:01:64': 'Cisco', '00:01:97': 'Cisco',
  '00:02:16': 'Cisco', '00:1B:ED': 'HP', '3C:D9:2B': 'HP', '00:17:A4': 'HP',
  '00:0E:7F': 'HP', '00:0F:20': 'HP', '00:11:0A': 'HP', '00:12:79': 'HP',
  '00:1E:68': 'Dell', 'B8:AC:6F': 'Dell', '00:14:22': 'Dell', '00:13:72': 'Dell',
  '00:15:C5': 'Dell', '00:16:F7': 'Dell', '00:18:8B': 'Dell', '00:19:B9': 'Dell',
  '00:15:5D': 'Microsoft Hyper-V', '00:03:FF': 'Microsoft', '00:50:F2': 'Microsoft',
  '00:E0:4C': 'Realtek', '52:54:00': 'QEMU/KVM', '08:00:27': 'VirtualBox',
  '00:0F:53': 'Supermicro', '00:25:90': 'Supermicro', '00:30:48': 'Supermicro',
  '00:1E:06': 'Intel', '00:1F:3C': 'Intel', 'A4:1F:72': 'Intel', 'E4:B9:7A': 'Intel',
  '10:DD:B1': 'Intel', '00:1D:09': 'Intel', '00:21:6B': 'Intel', '00:27:0E': 'Intel',
  '00:1A:11': 'Google', '3C:5A:B4': 'Google', 'DA:A1:19': 'Google', 'F4:F5:D8': 'Google',
  '00:1D:D8': 'Amazon', '00:22:F2': 'Amazon', 'FC:A6:67': 'Amazon', 'A4:77:33': 'Amazon',
  '00:11:32': 'Synology', '00:11:75': 'Synology', '00:11:F5': 'Synology', '90:09:DF': 'Synology',
  '00:1B:90': 'Ubiquiti', '24:A4:3C': 'Ubiquiti', '44:D9:E7': 'Ubiquiti', '70:A7:41': 'Ubiquiti',
  '80:2A:A8': 'Ubiquiti', 'FC:EC:DA': 'Ubiquiti', '00:0F:B5': 'Netgear', '00:14:6C': 'Netgear',
  '00:18:4D': 'Netgear', '00:1F:33': 'Netgear', '00:24:B2': 'Netgear', '00:26:F2': 'Netgear',
  '00:0D:88': 'D-Link', '00:0F:3D': 'D-Link', '00:13:46': 'D-Link', '00:15:E9': 'D-Link',
  '00:17:9A': 'D-Link', '00:0A:EB': 'TP-Link', '00:14:78': 'TP-Link', '00:1D:0F': 'TP-Link',
  '14:CF:92': 'TP-Link', '3C:83:B5': 'TP-Link', '50:C7:BF': 'TP-Link', '74:DA:38': 'TP-Link',
  '00:18:82': 'Huawei', '00:25:9E': 'Huawei', '28:6E:D4': 'Huawei', '2C:AB:00': 'Huawei',
  '00:03:62': 'H3C', '00:0F:E2': 'H3C', '00:23:89': 'H3C', '00:90:79': 'H3C',
  '00:0B:86': 'Aruba', '00:1A:1E': 'Aruba', '00:24:6C': 'Aruba', '20:4C:03': 'Aruba',
  '00:05:85': 'Juniper', '00:1F:12': 'Juniper', '00:26:88': 'Juniper', '3C:61:04': 'Juniper',
  '00:01:D7': 'F5 Networks', '00:0A:C9': 'F5 Networks', '00:23:E9': 'F5 Networks',
  '00:90:7F': 'F5 Networks', '00:01:E8': 'Force10', '00:16:35': 'Force10', '00:11:5C': 'Intel',
  '00:16:3E': 'XenSource',
};

export class ArpScanner {
  private static readonly logger = new Logger('ArpScanner');

  static async isAvailable(): Promise<{ available: boolean; arpScanAvailable: boolean }> {
    const arpScanAvailable = await this.checkCmd('arp-scan');
    return { available: true, arpScanAvailable }; // arp utility or parsing is always fallback-available
  }

  private static async checkCmd(cmd: string): Promise<boolean> {
    try {
      await execAsync(`which ${cmd}`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scan local network using arp-scan binary or parsing system ARP tables.
   */
  static async scan(subnet?: string): Promise<ArpScanResult> {
    const { arpScanAvailable } = await this.isAvailable();

    let result: ArpScanResult;
    if (arpScanAvailable && subnet) {
      result = await this.arpScanBinary(subnet);
    } else {
      result = await this.arpTable();
    }

    // Active sweep fallback if no results are found in the system table
    if (result.entries.length === 0 && subnet) {
      this.logger.log(`ARP cache is empty. Attempting fast active ping sweep on ${subnet}...`);
      await this.pingSweepCachePopulate(subnet);
      result = await this.arpTable();
      result.source = 'ping-sweep-fallback';
    }

    // Apply advanced conflict and spoofing heuristics
    this.detectConflictHeuristics(result);

    return result;
  }

  /**
   * Parse the system ARP table (fully resilient across macOS, Linux, and Windows)
   */
  static async arpTable(): Promise<ArpScanResult> {
    const entries: ArpEntry[] = [];
    const osPlatform = process.platform;

    try {
      let command = 'arp -a';
      if (osPlatform === 'win32') {
        command = 'arp -a';
      } else {
        command = 'arp -an 2>/dev/null || arp -a 2>/dev/null';
      }

      const { stdout } = await execAsync(command, { timeout: 10000 });
      const lines = stdout.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let ip: string | null = null;
        let mac: string | null = null;
        let iface: string | undefined;

        // 1. macOS format: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
        const macosMatch = trimmed.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-fA-F:-]+)\s+.*?on\s+(\S+)/);
        if (macosMatch) {
          ip = macosMatch[1];
          mac = macosMatch[2];
          iface = macosMatch[3];
        }

        // 2. Linux standard format: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on eth0
        if (!ip) {
          const linuxMatch = trimmed.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-fA-F:-]+)\s+\[ether\]\s+on\s+(\S+)/);
          if (linuxMatch) {
            ip = linuxMatch[1];
            mac = linuxMatch[2];
            iface = linuxMatch[3];
          }
        }

        // 3. Alternative/Simple Unix/Linux format: 192.168.1.1 at aa:bb:cc:dd:ee:ff on eth0
        if (!ip) {
          const simpleMatch = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)\s+at\s+([0-9a-fA-F:-]+)\s+(?:on\s+(\S+))?/);
          if (simpleMatch) {
            ip = simpleMatch[1];
            mac = simpleMatch[2];
            iface = simpleMatch[3];
          }
        }

        // 4. Windows Format: 192.168.1.1      aa-bb-cc-dd-ee-ff      dynamic
        if (!ip) {
          const winMatch = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:-]{17})\s+(\S+)/);
          if (winMatch) {
            ip = winMatch[1];
            mac = winMatch[2];
          }
        }

        // 5. Generic IP + MAC extractor fallback (failsafe regex)
        if (!ip) {
          const genericIpMatch = trimmed.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
          const genericMacMatch = trimmed.match(/\b(([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2})\b/);
          if (genericIpMatch && genericMacMatch) {
            ip = genericIpMatch[1];
            mac = genericMacMatch[1];
          }
        }

        // Filter and normalize if both found
        if (ip && mac && mac !== '(incomplete)' && mac.toLowerCase() !== 'ff:ff:ff:ff:ff:ff') {
          const normalizedMac = this.normalizeMac(mac);
          // Check for duplicate IPs inside parsed entries
          if (!entries.some(e => e.ip === ip)) {
            entries.push({
              ip,
              mac: normalizedMac,
              vendor: this.lookupVendor(normalizedMac),
              interface: iface || 'unknown',
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`ARP table read failed: ${err.message}`);
    }

    return { entries, totalFound: entries.length, scannedAt: new Date(), source: 'arp-table' };
  }

  /**
   * Use arp-scan binary for active Layer-2 scanning (requires root/sudo capability)
   */
  private static async arpScanBinary(subnet: string): Promise<ArpScanResult> {
    const entries: ArpEntry[] = [];

    try {
      const { stdout } = await execAsync(`sudo arp-scan ${subnet} 2>/dev/null || arp-scan ${subnet} 2>/dev/null`, { timeout: 30000 });

      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        const match = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:-]+)\s+(.*)/);
        if (match) {
          const rawMac = match[2];
          const normalizedMac = this.normalizeMac(rawMac);
          const vendorString = match[3]?.trim();
          entries.push({
            ip: match[1],
            mac: normalizedMac,
            vendor: vendorString && !vendorString.includes('Unknown') ? vendorString : this.lookupVendor(normalizedMac),
          });
        }
      }
    } catch {
      return this.arpTable(); // Fallback to standard ARP table extraction
    }

    return { entries, totalFound: entries.length, scannedAt: new Date(), source: 'arp-scan' };
  }

  /**
   * Normalize MAC formatting (converts dashes/dots to standard colons and uppercase)
   */
  private static normalizeMac(mac: string): string {
    let clean = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    if (clean.length === 12) {
      return clean.match(/.{1,2}/g)!.join(':');
    }
    return mac.toUpperCase().replace(/-/g, ':');
  }

  /**
   * Lookup vendor by MAC OUI prefix (handles various prefix formats dynamically)
   */
  static lookupVendor(mac: string): string | undefined {
    const cleanMac = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    if (cleanMac.length < 6) return undefined;
    const prefix = `${cleanMac.substring(0, 2)}:${cleanMac.substring(2, 4)}:${cleanMac.substring(4, 6)}`;
    return OUI_DB[prefix];
  }

  /**
   * Active Ping sweep populate. Pings common subnet range to force the OS to register active hosts in the ARP Cache.
   */
  private static async pingSweepCachePopulate(subnet: string): Promise<void> {
    try {
      const baseIpMatch = subnet.match(/^(\d+\.\d+\.\d+)\./);
      if (!baseIpMatch) return;
      const baseIp = baseIpMatch[1];

      // Ping standard hosts concurrently in blocks of 32 to avoid socket exhaustion
      const pingPromises: Promise<any>[] = [];
      const osPlatform = process.platform;
      const pingCmd = osPlatform === 'win32' ? 'ping -n 1 -w 50' : 'ping -c 1 -W 1';

      for (let i = 1; i <= 254; i++) {
        const targetIp = `${baseIp}.${i}`;
        pingPromises.push(
          execAsync(`${pingCmd} ${targetIp}`).catch(() => {
            // Ignore failure as we just want to trigger ARP cache entry
          }),
        );
      }

      await Promise.all(pingPromises);
    } catch (err: any) {
      this.logger.warn(`ARP ping sweep cache populate failed: ${err.message}`);
    }
  }

  /**
   * Compare ARP results with managed assets to find rogue devices
   */
  static findRogueDevices(arpEntries: ArpEntry[], managedIPs: string[]): ArpEntry[] {
    const managedSet = new Set(managedIPs);
    return arpEntries.filter(e => !managedSet.has(e.ip)).map(e => ({ ...e, isManaged: false }));
  }

  /**
   * Apply heuristics to detect security anomalies (IP Conflicts, MAC Spoofing)
   */
  private static detectConflictHeuristics(result: ArpScanResult): void {
    const ipMap = new Map<string, string[]>(); // IP -> MACs
    const macMap = new Map<string, string[]>(); // MAC -> IPs
    const conflicts: ArpScanResult['conflicts'] = [];

    for (const entry of result.entries) {
      if (!ipMap.has(entry.ip)) ipMap.set(entry.ip, []);
      ipMap.get(entry.ip)!.push(entry.mac);

      if (!macMap.has(entry.mac)) macMap.set(entry.mac, []);
      macMap.get(entry.mac)!.push(entry.ip);
    }

    // 1. IP Conflict Heuristic: Multiple distinct MAC addresses for the same IP
    for (const [ip, macs] of ipMap.entries()) {
      const uniqueMacs = Array.from(new Set(macs));
      if (uniqueMacs.length > 1) {
        conflicts.push({ type: 'IP_CONFLICT', ip, macs: uniqueMacs });
        // Mark warning on the associated entries
        for (const entry of result.entries) {
          if (entry.ip === ip) {
            entry.warnings = entry.warnings || [];
            entry.warnings.push(`IP Conflict detected: Multiple MAC addresses claim this IP (${uniqueMacs.join(', ')})`);
          }
        }
      }
    }

    // 2. MAC Spoofing / Duplicate IP Heuristic: Same MAC address answering for multiple distinct IPs
    for (const [mac, ips] of macMap.entries()) {
      const uniqueIps = Array.from(new Set(ips));
      if (uniqueIps.length > 1) {
        conflicts.push({ type: 'MAC_SPOOFING', ip: uniqueIps[0], mac, ips: uniqueIps });
        for (const entry of result.entries) {
          if (entry.mac === mac) {
            entry.warnings = entry.warnings || [];
            entry.warnings.push(`MAC Spoofing or dynamic duplicate detected: Same MAC physical address answering on multiple IPs (${uniqueIps.join(', ')})`);
          }
        }
      }
    }

    if (conflicts.length > 0) {
      result.conflicts = conflicts;
      this.logger.warn(`Security anomalies detected in ARP sweep: ${conflicts.length} conflict instances flagged!`);
    }
  }
}
