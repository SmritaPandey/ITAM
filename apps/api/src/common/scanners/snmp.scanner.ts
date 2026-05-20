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
}

export interface SnmpInterface {
  index: number;
  name: string;
  speed: number;
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
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
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
      try { this.snmpModule = await import('net-snmp'); } catch { return null; }
    }
    return this.snmpModule;
  }

  async pollDevice(ip: string, community = 'public', timeout = 5000): Promise<SnmpDeviceInfo | null> {
    const snmp = await this.getSnmp();
    if (!snmp) return this.fallbackPoll(ip);

    return new Promise((resolve) => {
      const session = snmp.createSession(ip, community, { timeout, retries: 1, version: snmp.Version2c });
      const result: SnmpDeviceInfo = { ip };
      const sysOids = [OID.sysDescr, OID.sysName, OID.sysUpTime, OID.sysContact, OID.sysLocation];

      session.get(sysOids, (error: any, varbinds: any[]) => {
        if (error) { try { session.close(); } catch {} resolve(this.fallbackPoll(ip)); return; }
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
          OID.ifDescr, OID.ifSpeed, OID.ifAdminStatus, OID.ifOperStatus, OID.ifInOctets, OID.ifOutOctets,
          OID.lldpRemChassisId, OID.lldpRemPortId, OID.lldpRemPortDesc, OID.lldpRemSysName, OID.lldpRemSysDesc, OID.lldpRemManAddrTable, OID.lldpLocPortDesc,
          OID.cdpCacheAddress, OID.cdpCacheVersion, OID.cdpCacheDeviceId, OID.cdpCacheDevicePort, OID.cdpCacheSysName
        ];

        let done = 0;
        for (const base of walkOids) {
          session.subtree(base, (vbs: any[]) => {
            for (const vb of vbs) {
              if (snmp.isVarbindError(vb)) continue;
              
              const parts = vb.oid.split('.');
              const numVal = typeof vb.value === 'number' ? vb.value : parseInt(vb.value?.toString()) || 0;
              const strVal = vb.value?.toString();

              if (vb.oid.startsWith('1.3.6.2.1.2.2.1.') || vb.oid.startsWith('1.3.6.1.2.1.2.2.1.')) {
                // Interface table
                const idx = parseInt(parts.pop()!);
                if (!ifaces.has(idx)) ifaces.set(idx, { index: idx });
                const iface = ifaces.get(idx)!;
                if (vb.oid.startsWith(OID.ifDescr)) iface.name = strVal;
                else if (vb.oid.startsWith(OID.ifSpeed)) iface.speed = numVal;
                else if (vb.oid.startsWith(OID.ifAdminStatus)) iface.adminStatus = IF_STATUS[numVal] || 'unknown';
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
                if (vb.oid.startsWith(OID.lldpRemChassisId)) n.remoteChassisId = strVal;
                else if (vb.oid.startsWith(OID.lldpRemPortId)) n.remotePortName = strVal;
                else if (vb.oid.startsWith(OID.lldpRemPortDesc)) n.remotePortDesc = strVal;
                else if (vb.oid.startsWith(OID.lldpRemSysName)) n.remoteSysName = strVal;
                else if (vb.oid.startsWith(OID.lldpRemSysDesc)) n.remoteSysDesc = strVal;
              } else if (vb.oid.startsWith('1.0.8802.1.1.2.1.4.2.1.')) {
                // LLDP remote man address table
                if (parts[11] === '4') {
                  const localPortNum = parseInt(parts[13]);
                  const remIndex = parseInt(parts[14]);
                  const key = `${localPortNum}_${remIndex}`;
                  if (!lldpNeighborsMap.has(key)) {
                    lldpNeighborsMap.set(key, { localPortIndex: localPortNum });
                  }
                  const n = lldpNeighborsMap.get(key)!;
                  if (Buffer.isBuffer(vb.value)) {
                    if (vb.value.length === 4) {
                      n.remoteIp = `${vb.value[0]}.${vb.value[1]}.${vb.value[2]}.${vb.value[3]}`;
                    } else {
                      n.remoteIp = strVal;
                    }
                  } else {
                    n.remoteIp = strVal;
                  }
                }
              } else if (vb.oid.startsWith(OID.lldpLocPortDesc)) {
                // LLDP local port description table
                const localPortNum = parseInt(parts.pop()!);
                lldpLocPortMap.set(localPortNum, strVal);
              } else if (vb.oid.startsWith('1.3.6.1.4.1.9.9.23.1.2.1.1.')) {
                // CDP remote table
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
          }, () => {
            done++;
            if (done >= walkOids.length) {
              result.interfaces = Array.from(ifaces.values()) as SnmpInterface[];
              
              // Resolve interface names for LLDP
              result.lldpNeighbors = Array.from(lldpNeighborsMap.values()).map(n => {
                const localPortDesc = lldpLocPortMap.get(n.localPortIndex);
                const localIfaceName = Array.from(ifaces.values()).find(i => i.index === n.localPortIndex)?.name;
                return {
                  ...n,
                  localPortName: localPortDesc || localIfaceName || `Port ${n.localPortIndex}`,
                };
              });

              // Resolve interface names for CDP
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
      });

      setTimeout(() => { try { session.close(); } catch {} resolve(result); }, timeout + 3000);
    });
  }

  private async fallbackPoll(ip: string): Promise<SnmpDeviceInfo> {
    const result: SnmpDeviceInfo = { ip };
    try {
      const { stdout } = await execAsync(`ping -c 1 -W 2 ${ip}`, { timeout: 5000 });
      const match = stdout.match(/time[=<]([\d.]+)/);
      if (match) { result.sysName = ip; result.sysDescr = `Reachable (${match[1]}ms, no SNMP)`; }
    } catch { result.sysDescr = 'Unreachable'; }
    return result;
  }

  async isAvailable(): Promise<boolean> {
    return (await this.getSnmp()) !== null;
  }
}

