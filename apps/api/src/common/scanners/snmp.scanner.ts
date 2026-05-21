import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SnmpNeighbor {
  localPortIndex: number;
  localPortName?: string;
  remotePortName?: string;
  remotePortDesc?: string;
  remoteSysName?: string;
  remoteSysDesc?: string;
  remoteChassisId?: string;
  remoteIp?: string;
}

export interface SnmpDeviceInfo {
  ip: string;
  sysDescr?: string;
  sysName?: string;
  sysUpTime?: number;
  sysContact?: string;
  sysLocation?: string;
  interfaces?: SnmpInterface[];
  cpuLoad?: number;
  memoryPercent?: number;
  lldpNeighbors?: SnmpNeighbor[];
  cdpNeighbors?: SnmpNeighbor[];
  vendor?: string;
  model?: string;
  os?: string;
  usedCommunity?: string;
}

export interface SnmpInterface {
  index: number;
  name: string;
  speed: number;
  speedFormatted?: string;
  mac?: string;
  mtu?: number;
  adminStatus: string;
  operStatus: string;
  inOctets: number;
  outOctets: number;
}

const OID = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifMtu: '1.3.6.1.2.1.2.2.1.4',
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
  ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',
  ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
  hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',

  // LLDP MIBs
  lldpRemChassisId: '1.0.8802.1.1.2.1.4.1.1.5',
  lldpRemPortId: '1.0.8802.1.1.2.1.4.1.1.7',
  lldpRemPortDesc: '1.0.8802.1.1.2.1.4.1.1.8',
  lldpRemSysName: '1.0.8802.1.1.2.1.4.1.1.9',
  lldpRemSysDesc: '1.0.8802.1.1.2.1.4.1.1.10',
  lldpRemManAddrTable: '1.0.8802.1.1.2.1.4.2.1',
  lldpLocPortDesc: '1.0.8802.1.1.2.1.3.7.1.3',

  // CDP Cache MIBs
  cdpCacheAddress: '1.3.6.1.4.1.9.9.23.1.2.1.1.4',
  cdpCacheVersion: '1.3.6.1.4.1.9.9.23.1.2.1.1.5',
  cdpCacheDeviceId: '1.3.6.1.4.1.9.9.23.1.2.1.1.6',
  cdpCacheDevicePort: '1.3.6.1.4.1.9.9.23.1.2.1.1.7',
  cdpCacheSysName: '1.3.6.1.4.1.9.9.23.1.2.1.1.17',
};

const IF_STATUS: Record<number, string> = { 1: 'up', 2: 'down', 3: 'testing' };

@Injectable()
export class SnmpScanner {
  private readonly logger = new Logger(SnmpScanner.name);
  private snmpModule: any = null;

  private async getSnmp() {
    if (!this.snmpModule) {
      try {
        this.snmpModule = await import('net-snmp');
      } catch {
        return null;
      }
    }
    return this.snmpModule;
  }

  /**
   * Main entry point to poll device. If primary community string fails or times out,
   * performs automated community dictionary bruteforcing fallback.
   */
  async pollDevice(ip: string, community = 'public', timeout = 5000): Promise<SnmpDeviceInfo | null> {
    const snmp = await this.getSnmp();
    if (!snmp) {
      return this.fallbackPoll(ip);
    }

    const dict = [
      community,
      'public', 'private', 'admin', 'cisco', 'system',
      'monitor', 'manager', 'read', 'write', 'default',
      'guest', 'public1', 'public2', 'root'
    ];
    // Deduplicate
    const uniqueCommunities = Array.from(new Set(dict.filter(Boolean)));

    for (const comm of uniqueCommunities) {
      try {
        const info = await this.pollDeviceWithCommunity(snmp, ip, comm, timeout);
        if (info && info.sysDescr) {
          info.usedCommunity = comm;
          // Apply parsing heuristics to vendor/model fields
          const parsed = this.parseSysDescr(info.sysDescr);
          info.vendor = parsed.vendor;
          info.model = parsed.model;
          info.os = parsed.os;
          return info;
        }
      } catch (err: any) {
        // Log trace and proceed to fallback dictionary item
        this.logger.debug(`SNMP poll failed on ${ip} using community '${comm}': ${err.message}`);
      }
    }

    // Ping fallback if completely unreachable via SNMP
    return this.fallbackPoll(ip);
  }

  /**
   * Internal session builder mapping OID properties with standard SNMP session.
   */
  private async pollDeviceWithCommunity(snmp: any, ip: string, community: string, timeout: number): Promise<SnmpDeviceInfo | null> {
    return new Promise((resolve, reject) => {
      const session = snmp.createSession(ip, community, { timeout, retries: 1, version: snmp.Version2c });
      const result: SnmpDeviceInfo = { ip };
      const sysOids = [OID.sysDescr, OID.sysName, OID.sysUpTime, OID.sysContact, OID.sysLocation];

      session.get(sysOids, (error: any, varbinds: any[]) => {
        if (error) {
          try { session.close(); } catch {}
          reject(error);
          return;
        }

        for (const vb of varbinds) {
          if (snmp.isVarbindError(vb)) continue;
          const val = vb.value?.toString();
          if (vb.oid === OID.sysDescr) result.sysDescr = val;
          else if (vb.oid === OID.sysName) result.sysName = val;
          else if (vb.oid === OID.sysUpTime) result.sysUpTime = parseInt(val) || 0;
          else if (vb.oid === OID.sysContact) result.sysContact = val;
          else if (vb.oid === OID.sysLocation) result.sysLocation = val;
        }

        // Walk interfaces and neighbors
        const ifaces: Map<number, Partial<SnmpInterface>> = new Map();
        const lldpNeighborsMap: Map<string, SnmpNeighbor> = new Map();
        const cdpNeighborsMap: Map<string, SnmpNeighbor> = new Map();
        const lldpLocPortMap: Map<number, string> = new Map();

        const walkOids = [
          OID.ifDescr, OID.ifMtu, OID.ifSpeed, OID.ifPhysAddress, OID.ifAdminStatus, OID.ifOperStatus, OID.ifInOctets, OID.ifOutOctets,
          OID.lldpRemChassisId, OID.lldpRemPortId, OID.lldpRemPortDesc, OID.lldpRemSysName, OID.lldpRemSysDesc, OID.lldpRemManAddrTable, OID.lldpLocPortDesc,
          OID.cdpCacheAddress, OID.cdpCacheVersion, OID.cdpCacheDeviceId, OID.cdpCacheDevicePort, OID.cdpCacheSysName
        ];

        let done = 0;
        let rejected = false;

        for (const base of walkOids) {
          session.subtree(base, (vbs: any[]) => {
            if (rejected) return;
            for (const vb of vbs) {
              if (snmp.isVarbindError(vb)) continue;

              const parts = vb.oid.split('.');
              const numVal = typeof vb.value === 'number' ? vb.value : parseInt(vb.value?.toString()) || 0;
              const strVal = vb.value?.toString();

              if (vb.oid.startsWith('1.3.6.2.1.2.2.1.') || vb.oid.startsWith('1.3.6.1.2.1.2.2.1.')) {
                // Interface table mapping
                const idx = parseInt(parts.pop()!);
                if (!ifaces.has(idx)) ifaces.set(idx, { index: idx });
                const iface = ifaces.get(idx)!;

                if (vb.oid.startsWith(OID.ifDescr)) iface.name = strVal;
                else if (vb.oid.startsWith(OID.ifMtu)) iface.mtu = numVal;
                else if (vb.oid.startsWith(OID.ifSpeed)) {
                  iface.speed = numVal;
                  iface.speedFormatted = this.formatSpeed(numVal);
                } else if (vb.oid.startsWith(OID.ifPhysAddress)) {
                  iface.mac = this.formatMac(vb.value);
                } else if (vb.oid.startsWith(OID.ifAdminStatus)) iface.adminStatus = IF_STATUS[numVal] || 'unknown';
                else if (vb.oid.startsWith(OID.ifOperStatus)) iface.operStatus = IF_STATUS[numVal] || 'unknown';
                else if (vb.oid.startsWith(OID.ifInOctets)) iface.inOctets = numVal;
                else if (vb.oid.startsWith(OID.ifOutOctets)) iface.outOctets = numVal;

              } else if (vb.oid.startsWith('1.0.8802.1.1.2.1.4.1.1.')) {
                // LLDP remote table
                const localPortNum = parseInt(parts[parts.length - 2]);
                const remIndex = parseInt(parts[parts.length - 1]);
                const key = `${localPortNum}_${remIndex}`;
                if (!lldpNeighborsMap.has(key)) {
                  lldpNeighborsMap.set(key, { localPortIndex: localPortNum });
                }
                const n = lldpNeighborsMap.get(key)!;
                if (vb.oid.startsWith(OID.lldpRemChassisId)) n.remoteChassisId = this.formatMac(vb.value) || strVal;
                else if (vb.oid.startsWith(OID.lldpRemPortId)) n.remotePortName = strVal;
                else if (vb.oid.startsWith(OID.lldpRemPortDesc)) n.remotePortDesc = strVal;
                else if (vb.oid.startsWith(OID.lldpRemSysName)) n.remoteSysName = strVal;
                else if (vb.oid.startsWith(OID.lldpRemSysDesc)) n.remoteSysDesc = strVal;

              } else if (vb.oid.startsWith('1.0.8802.1.1.2.1.4.2.1.')) {
                // LLDP remote address table
                if (parts[11] === '4') {
                  const localPortNum = parseInt(parts[13]);
                  const remIndex = parseInt(parts[14]);
                  const key = `${localPortNum}_${remIndex}`;
                  if (!lldpNeighborsMap.has(key)) {
                    lldpNeighborsMap.set(key, { localPortIndex: localPortNum });
                  }
                  const n = lldpNeighborsMap.get(key)!;
                  if (Buffer.isBuffer(vb.value) && vb.value.length === 4) {
                    n.remoteIp = `${vb.value[0]}.${vb.value[1]}.${vb.value[2]}.${vb.value[3]}`;
                  } else {
                    n.remoteIp = strVal;
                  }
                }

              } else if (vb.oid.startsWith(OID.lldpLocPortDesc)) {
                // LLDP local description mapping
                const localPortNum = parseInt(parts.pop()!);
                lldpLocPortMap.set(localPortNum, strVal);

              } else if (vb.oid.startsWith('1.3.6.1.4.1.9.9.23.1.2.1.1.')) {
                // CDP remote table mapping
                const localIfIndex = parseInt(parts[14]);
                const deviceIndex = parseInt(parts[15]);
                const key = `${localIfIndex}_${deviceIndex}`;
                if (!cdpNeighborsMap.has(key)) {
                  cdpNeighborsMap.set(key, { localPortIndex: localIfIndex });
                }
                const n = cdpNeighborsMap.get(key)!;
                if (vb.oid.startsWith(OID.cdpCacheAddress)) {
                  if (Buffer.isBuffer(vb.value)) {
                    if (vb.value.length === 4) {
                      n.remoteIp = `${vb.value[0]}.${vb.value[1]}.${vb.value[2]}.${vb.value[3]}`;
                    } else {
                      const hex = vb.value.toString('hex');
                      if (hex.length === 8) {
                        n.remoteIp = [
                          parseInt(hex.slice(0, 2), 16),
                          parseInt(hex.slice(2, 4), 16),
                          parseInt(hex.slice(4, 6), 16),
                          parseInt(hex.slice(6, 8), 16),
                        ].join('.');
                      } else {
                        n.remoteIp = strVal;
                      }
                    }
                  } else {
                    n.remoteIp = strVal;
                  }
                } else if (vb.oid.startsWith(OID.cdpCacheVersion)) n.remoteSysDesc = strVal;
                else if (vb.oid.startsWith(OID.cdpCacheDeviceId)) n.remoteChassisId = strVal;
                else if (vb.oid.startsWith(OID.cdpCacheDevicePort)) n.remotePortName = strVal;
                else if (vb.oid.startsWith(OID.cdpCacheSysName)) n.remoteSysName = strVal;
              }
            }
          }, (err: any) => {
            if (rejected) return;
            if (err) {
              rejected = true;
              try { session.close(); } catch {}
              reject(err);
              return;
            }

            done++;
            if (done >= walkOids.length) {
              result.interfaces = Array.from(ifaces.values()) as SnmpInterface[];

              // Resolve interface descriptions for LLDP neighbors
              result.lldpNeighbors = Array.from(lldpNeighborsMap.values()).map(n => {
                const localPortDesc = lldpLocPortMap.get(n.localPortIndex);
                const localIfaceName = Array.from(ifaces.values()).find(i => i.index === n.localPortIndex)?.name;
                return {
                  ...n,
                  localPortName: localPortDesc || localIfaceName || `Port ${n.localPortIndex}`,
                };
              });

              // Resolve interface names for CDP neighbors
              result.cdpNeighbors = Array.from(cdpNeighborsMap.values()).map(n => {
                const localIfaceName = Array.from(ifaces.values()).find(i => i.index === n.localPortIndex)?.name;
                return {
                  ...n,
                  localPortName: localIfaceName || `Port ${n.localPortIndex}`,
                };
              });

              session.close();
              resolve(result);
            }
          });
        }

        setTimeout(() => {
          if (!rejected) {
            rejected = true;
            try { session.close(); } catch {}
            resolve(result);
          }
        }, timeout + 3000);
      });
    });
  }

  /**
   * Regular expression parsing heuristics to extract vendor, model, and OS from SNMP sysDescr.
   */
  private parseSysDescr(sysDescr: string): { vendor?: string; model?: string; os?: string } {
    if (!sysDescr) return {};
    const text = sysDescr.toLowerCase();

    let vendor = 'Unknown';
    let model = 'Generic SNMP Device';
    let os = 'Embedded';

    // Heuristics
    if (text.includes('cisco')) {
      vendor = 'Cisco';
      os = text.includes('nx-os') ? 'NX-OS' : 'IOS';
      if (text.includes('catalyst')) model = 'Catalyst Switch';
      else if (text.includes('nexus')) model = 'Nexus Switch';
      else if (text.includes('asa')) model = 'ASA Firewall';
      else model = 'Cisco Router/Switch';
    } else if (text.includes('juniper') || text.includes('junos')) {
      vendor = 'Juniper Networks';
      os = 'Junos';
      if (text.includes('srx')) model = 'SRX Firewall';
      else if (text.includes('ex')) model = 'EX Switch';
      else model = 'Juniper Router';
    } else if (text.includes('synology')) {
      vendor = 'Synology';
      os = 'DSM';
      model = 'NAS Storage';
    } else if (text.includes('mikrotik') || text.includes('routeros')) {
      vendor = 'MikroTik';
      os = 'RouterOS';
      model = 'RouterBOARD';
    } else if (text.includes('apc') || text.includes('smart-ups')) {
      vendor = 'APC';
      os = 'APC AOS';
      model = 'Smart-UPS';
    } else if (text.includes('windows')) {
      vendor = 'Microsoft';
      os = 'Windows Server';
      model = 'Windows Host';
    } else if (text.includes('linux')) {
      vendor = 'Linux';
      os = 'Linux Kernel';
      model = 'Linux Host';
    } else if (text.includes('hp ') || text.includes('procurve') || text.includes('hewlett-packard')) {
      vendor = 'HP';
      os = 'ProCurveOS';
      model = text.includes('laserjet') ? 'LaserJet Printer' : 'ProCurve Switch';
    } else if (text.includes('ubiquiti') || text.includes('unifi')) {
      vendor = 'Ubiquiti';
      os = 'EdgeOS / UniFi';
      model = 'UniFi AP/Switch';
    }

    return { vendor, model, os };
  }

  /**
   * Nicely format binary MAC strings to standard colon hexadecimal values
   */
  private formatMac(buf: any): string | undefined {
    if (Buffer.isBuffer(buf)) {
      return Array.from(buf).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
    }
    if (typeof buf === 'string') {
      const match = buf.match(/([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}/);
      if (match) return match[0].toUpperCase();
    }
    return undefined;
  }

  /**
   * Formats raw interface speed in bps to human readable string (bps, Kbps, Mbps, Gbps)
   */
  private formatSpeed(bps: number): string {
    if (bps <= 0) return '0 bps';
    const giga = 1000000000;
    const mega = 1000000;
    const kilo = 1000;
    if (bps >= giga) return `${(bps / giga).toFixed(1).replace(/\.0$/, '')} Gbps`;
    if (bps >= mega) return `${(bps / mega).toFixed(1).replace(/\.0$/, '')} Mbps`;
    if (bps >= kilo) return `${(bps / kilo).toFixed(1).replace(/\.0$/, '')} Kbps`;
    return `${bps} bps`;
  }

  /**
   * Fallback poll when SNMP is not available or device refuses SNMP credentials.
   */
  private async fallbackPoll(ip: string): Promise<SnmpDeviceInfo> {
    const result: SnmpDeviceInfo = { ip };
    try {
      const { stdout } = await execAsync(`ping -c 1 -W 2 ${ip}`, { timeout: 5000 });
      const match = stdout.match(/time[=<]([\d.]+)/);
      if (match) {
        result.sysName = ip;
        result.sysDescr = `Reachable (${match[1]}ms, no SNMP responses)`;
      }
    } catch {
      result.sysDescr = 'Unreachable';
    }
    return result;
  }

  /**
   * Check if net-snmp library can be imported successfully
   */
  async isAvailable(): Promise<boolean> {
    return (await this.getSnmp()) !== null;
  }
}
