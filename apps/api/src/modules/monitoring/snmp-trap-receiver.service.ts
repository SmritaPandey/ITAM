import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import * as dgram from 'dgram';

/**
 * Well-known SNMP trap OIDs mapped to human-readable event types.
 * These cover the SNMPv2 standard traps and common enterprise traps.
 */
const TRAP_OID_MAP: Record<string, { type: string; severity: string; description: string }> = {
  // SNMPv2 Standard Traps (RFC 3418)
  '1.3.6.1.6.3.1.1.5.1': { type: 'coldStart', severity: 'warning', description: 'Device cold-started (reboot or power cycle)' },
  '1.3.6.1.6.3.1.1.5.2': { type: 'warmStart', severity: 'info', description: 'Device warm-started (software reload)' },
  '1.3.6.1.6.3.1.1.5.3': { type: 'linkDown', severity: 'critical', description: 'Network interface went down' },
  '1.3.6.1.6.3.1.1.5.4': { type: 'linkUp', severity: 'info', description: 'Network interface came back up' },
  '1.3.6.1.6.3.1.1.5.5': { type: 'authenticationFailure', severity: 'warning', description: 'SNMP authentication failure detected' },
  '1.3.6.1.6.3.1.1.5.6': { type: 'egpNeighborLoss', severity: 'critical', description: 'EGP neighbor lost' },
  // Cisco enterprise traps
  '1.3.6.1.4.1.9.9.43.2.0.1': { type: 'configChange', severity: 'warning', description: 'Configuration change detected on Cisco device' },
  '1.3.6.1.4.1.9.9.43.2.0.2': { type: 'configSaved', severity: 'info', description: 'Configuration saved to NVRAM' },
  '1.3.6.1.4.1.9.0.1': { type: 'ciscoCpuThreshold', severity: 'critical', description: 'CPU utilization threshold exceeded' },
  '1.3.6.1.4.1.9.0.2': { type: 'ciscoMemoryPool', severity: 'warning', description: 'Memory pool utilization threshold exceeded' },
  // Generic enterprise traps
  '1.3.6.1.4.1.232': { type: 'hpTrap', severity: 'warning', description: 'HP ProCurve event' },
  '1.3.6.1.4.1.2636': { type: 'juniperTrap', severity: 'warning', description: 'Juniper Networks event' },
};

/**
 * Parsed SNMP trap data structure
 */
export interface ParsedTrap {
  sourceIp: string;
  sourcePort: number;
  receivedAt: Date;
  trapOid: string;
  type: string;
  severity: string;
  description: string;
  rawVarbinds: Array<{ oid: string; type: number; value: string }>;
  community?: string;
}

@Injectable()
export class SnmpTrapReceiverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SnmpTrapReceiverService.name);
  private server: dgram.Socket | null = null;
  private readonly trapPort = parseInt(process.env.SNMP_TRAP_PORT || '1162', 10); // Use 1162 for non-root
  private readonly maxStoredTraps = 10000;
  private trapBuffer: ParsedTrap[] = [];
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  onModuleInit() {
    if (process.env.ENABLE_SNMP_TRAPS === 'true') {
      this.start();
    } else {
      this.logger.log('SNMP trap receiver disabled. Set ENABLE_SNMP_TRAPS=true to enable.');
    }
  }

  onModuleDestroy() {
    this.stop();
  }

  /**
   * Start listening for SNMP traps on UDP
   */
  start() {
    if (this.isRunning) return;

    try {
      this.server = dgram.createSocket('udp4');

      this.server.on('message', (msg, rinfo) => {
        this.handleTrapMessage(msg, rinfo);
      });

      this.server.on('error', (err) => {
        this.logger.error(`SNMP trap receiver error: ${err.message}`);
        if ((err as any).code === 'EACCES') {
          this.logger.warn(`Port ${this.trapPort} requires elevated privileges. Try port 1162 or run with sudo for port 162.`);
        }
      });

      this.server.on('listening', () => {
        const addr = this.server!.address();
        this.logger.log(`SNMP trap receiver listening on ${addr.address}:${addr.port}`);
        this.isRunning = true;
      });

      this.server.bind(this.trapPort);
    } catch (err: any) {
      this.logger.error(`Failed to start SNMP trap receiver: ${err.message}`);
    }
  }

  /**
   * Stop the trap receiver
   */
  stop() {
    if (this.server) {
      try {
        this.server.close();
      } catch { /* ignore */ }
      this.server = null;
      this.isRunning = false;
      this.logger.log('SNMP trap receiver stopped');
    }
  }

  /**
   * Parse and process an incoming SNMP trap PDU
   */
  private handleTrapMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    try {
      const parsed = this.parseTrapPdu(msg, rinfo);
      if (!parsed) return;

      // Buffer the trap
      this.trapBuffer.push(parsed);
      if (this.trapBuffer.length > this.maxStoredTraps) {
        this.trapBuffer = this.trapBuffer.slice(-this.maxStoredTraps);
      }

      // Match to a monitored device and emit events
      this.correlateAndEmit(parsed);

      this.logger.debug(`Trap received from ${rinfo.address}: ${parsed.type} (${parsed.trapOid})`);
    } catch (err: any) {
      this.logger.warn(`Failed to parse trap from ${rinfo.address}: ${err.message}`);
    }
  }

  /**
   * Basic BER/ASN.1 SNMP trap PDU parser
   * Handles SNMPv1 traps and SNMPv2c notifications
   */
  private parseTrapPdu(msg: Buffer, rinfo: dgram.RemoteInfo): ParsedTrap | null {
    // Minimal validation — SNMP messages start with SEQUENCE (0x30)
    if (msg.length < 10 || msg[0] !== 0x30) return null;

    let trapOid = '';
    const varbinds: Array<{ oid: string; type: number; value: string }> = [];
    let community = 'public';

    // Extract community string (second element after version)
    try {
      let offset = 2; // Skip SEQUENCE tag + length
      // Skip length bytes if extended
      if (msg[1] & 0x80) offset += (msg[1] & 0x7f);

      // Version (INTEGER)
      if (msg[offset] === 0x02) {
        const vLen = msg[offset + 1];
        offset += 2 + vLen;
      }

      // Community (OCTET STRING)
      if (msg[offset] === 0x04) {
        const cLen = msg[offset + 1];
        community = msg.slice(offset + 2, offset + 2 + cLen).toString('ascii');
        offset += 2 + cLen;
      }

      // Scan for OID values in the message
      const oids = this.extractOids(msg);
      if (oids.length > 0) {
        // The snmpTrapOID is typically the second OID in a v2c trap
        // For v1, the enterprise OID is the first
        trapOid = oids.length > 1 ? oids[1] : oids[0];

        for (let i = 0; i < oids.length; i++) {
          varbinds.push({ oid: oids[i], type: 0x06, value: oids[i] });
        }
      }
    } catch { /* Best-effort parsing */ }

    // Resolve OID to human-readable event
    const mapped = this.resolveOid(trapOid);

    return {
      sourceIp: rinfo.address,
      sourcePort: rinfo.port,
      receivedAt: new Date(),
      trapOid,
      type: mapped.type,
      severity: mapped.severity,
      description: mapped.description,
      rawVarbinds: varbinds,
      community,
    };
  }

  /**
   * Extract OID values from a BER-encoded buffer
   */
  private extractOids(buf: Buffer): string[] {
    const oids: string[] = [];
    for (let i = 0; i < buf.length - 2; i++) {
      if (buf[i] === 0x06) { // OID tag
        const len = buf[i + 1];
        if (len > 0 && i + 2 + len <= buf.length) {
          const oid = this.decodeOid(buf.slice(i + 2, i + 2 + len));
          if (oid) oids.push(oid);
        }
      }
    }
    return oids;
  }

  /**
   * Decode BER-encoded OID bytes to dotted-decimal string
   */
  private decodeOid(bytes: Buffer): string | null {
    if (bytes.length === 0) return null;
    const parts: number[] = [];
    // First byte encodes first two components
    parts.push(Math.floor(bytes[0] / 40));
    parts.push(bytes[0] % 40);

    let value = 0;
    for (let i = 1; i < bytes.length; i++) {
      value = (value << 7) | (bytes[i] & 0x7f);
      if (!(bytes[i] & 0x80)) {
        parts.push(value);
        value = 0;
      }
    }
    return parts.join('.');
  }

  /**
   * Map an OID to a known trap type
   */
  private resolveOid(oid: string): { type: string; severity: string; description: string } {
    // Exact match
    if (TRAP_OID_MAP[oid]) return TRAP_OID_MAP[oid];

    // Prefix match (enterprise traps)
    for (const [prefix, info] of Object.entries(TRAP_OID_MAP)) {
      if (oid.startsWith(prefix)) return info;
    }

    return { type: 'unknownTrap', severity: 'info', description: `Unknown trap OID: ${oid}` };
  }

  /**
   * Correlate trap with a monitored device and emit events
   */
  private async correlateAndEmit(trap: ParsedTrap) {
    try {
      // Find the device by IP
      const device = await this.prisma.monitoredDevice.findFirst({
        where: { ipAddress: trap.sourceIp, type: 'NETWORK_DEVICE' },
      });

      if (device) {
        // Update device status based on trap type
        if (trap.type === 'linkDown') {
          await this.prisma.monitoredDevice.update({
            where: { id: device.id },
            data: { status: 'WARNING', metrics: { ...(device.metrics as any), lastTrap: trap.type, lastTrapAt: trap.receivedAt.toISOString() } },
          });
          this.eventBus.emitMonitoringEvent(device.tenantId, 'snmp_trap', {
            deviceId: device.id, deviceName: device.name, trap: trap.type, severity: trap.severity, message: trap.description,
          });
        } else if (trap.type === 'linkUp') {
          await this.prisma.monitoredDevice.update({
            where: { id: device.id },
            data: { status: 'ONLINE', lastSeen: new Date(), metrics: { ...(device.metrics as any), lastTrap: trap.type, lastTrapAt: trap.receivedAt.toISOString() } },
          });
          this.eventBus.emitMonitoringEvent(device.tenantId, 'device_recovered', {
            deviceId: device.id, deviceName: device.name, trap: trap.type,
          });
        } else if (['coldStart', 'warmStart'].includes(trap.type)) {
          this.eventBus.emitMonitoringEvent(device.tenantId, 'device_restarted', {
            deviceId: device.id, deviceName: device.name, trap: trap.type, description: trap.description,
          });
        } else if (trap.severity === 'critical') {
          this.eventBus.emitMonitoringEvent(device.tenantId, 'snmp_critical_trap', {
            deviceId: device.id, deviceName: device.name, trap: trap.type, description: trap.description,
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to correlate trap: ${err.message}`);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Get recent traps from the buffer, optionally filtered by tenant
   */
  async getRecentTraps(tenantId?: string, limit = 100): Promise<ParsedTrap[]> {
    if (!tenantId) return this.trapBuffer.slice(-limit);

    // Resolve tenant device IPs
    const devices = await this.prisma.monitoredDevice.findMany({
      where: { tenantId, type: 'NETWORK_DEVICE', ipAddress: { not: null } },
      select: { ipAddress: true },
    });
    const tenantIps = new Set(devices.map(d => d.ipAddress!));

    return this.trapBuffer
      .filter(t => tenantIps.has(t.sourceIp))
      .slice(-limit);
  }

  /**
   * Get trap statistics
   */
  getStats() {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const trap of this.trapBuffer) {
      byType[trap.type] = (byType[trap.type] || 0) + 1;
      bySeverity[trap.severity] = (bySeverity[trap.severity] || 0) + 1;
    }

    return {
      total: this.trapBuffer.length,
      isRunning: this.isRunning,
      port: this.trapPort,
      byType,
      bySeverity,
      oldestTrap: this.trapBuffer[0]?.receivedAt,
      newestTrap: this.trapBuffer[this.trapBuffer.length - 1]?.receivedAt,
    };
  }

  /**
   * Clear the trap buffer
   */
  clearBuffer() {
    const count = this.trapBuffer.length;
    this.trapBuffer = [];
    return { cleared: count };
  }
}
