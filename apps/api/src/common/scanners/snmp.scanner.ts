import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

        // Walk interfaces
        const ifaces: Map<number, Partial<SnmpInterface>> = new Map();
        const walkOids = [OID.ifDescr, OID.ifSpeed, OID.ifAdminStatus, OID.ifOperStatus, OID.ifInOctets, OID.ifOutOctets];
        let done = 0;
        for (const base of walkOids) {
          session.subtree(base, (vbs: any[]) => {
            for (const vb of vbs) {
              if (snmp.isVarbindError(vb)) continue;
              const idx = parseInt(vb.oid.split('.').pop()!);
              if (!ifaces.has(idx)) ifaces.set(idx, { index: idx });
              const iface = ifaces.get(idx)!;
              const numVal = typeof vb.value === 'number' ? vb.value : parseInt(vb.value?.toString()) || 0;
              if (vb.oid.startsWith(OID.ifDescr)) iface.name = vb.value?.toString();
              else if (vb.oid.startsWith(OID.ifSpeed)) iface.speed = numVal;
              else if (vb.oid.startsWith(OID.ifAdminStatus)) iface.adminStatus = IF_STATUS[numVal] || 'unknown';
              else if (vb.oid.startsWith(OID.ifOperStatus)) iface.operStatus = IF_STATUS[numVal] || 'unknown';
              else if (vb.oid.startsWith(OID.ifInOctets)) iface.inOctets = numVal;
              else if (vb.oid.startsWith(OID.ifOutOctets)) iface.outOctets = numVal;
            }
          }, () => {
            done++;
            if (done >= walkOids.length) {
              result.interfaces = Array.from(ifaces.values()) as SnmpInterface[];
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
