import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as net from 'net';
import * as dgram from 'dgram';
import { PrismaService } from '../../common/database/prisma.service';

export interface OtProbeTarget {
  host: string;
  port?: number;
  unitId?: number;
}

export interface OtProbeResult {
  protocol: 'MODBUS_TCP' | 'BACNET_IP';
  host: string;
  port: number;
  reachable: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

@Injectable()
export class OtProbeService {
  private readonly logger = new Logger(OtProbeService.name);

  constructor(private prisma: PrismaService) {}

  isModbusEnabled(): boolean {
    return process.env.MODBUS_PROBE_ENABLED === 'true' || process.env.MODBUS_PROBE_ENABLED === '1';
  }

  isBacnetEnabled(): boolean {
    return process.env.BACNET_PROBE_ENABLED === 'true' || process.env.BACNET_PROBE_ENABLED === '1';
  }

  getCapabilities() {
    return {
      modbusTcp: {
        enabled: this.isModbusEnabled(),
        defaultPort: 502,
        note: this.isModbusEnabled()
          ? 'Modbus TCP probe active — TCP connect + read holding registers (FC03).'
          : 'Set MODBUS_PROBE_ENABLED=true to enable Modbus TCP probes. No devices are invented when disabled.',
      },
      bacnetIp: {
        enabled: this.isBacnetEnabled(),
        defaultPort: 47808,
        note: this.isBacnetEnabled()
          ? 'BACnet/IP probe active — UDP Who-Is broadcast / unicast.'
          : 'Set BACNET_PROBE_ENABLED=true to enable BACnet/IP Who-Is probes. No devices are invented when disabled.',
      },
    };
  }

  /**
   * Probe Modbus TCP targets. Returns empty list honestly when flag is off.
   */
  async probeModbus(
    tenantId: string,
    targets: OtProbeTarget[],
    userId?: string,
  ): Promise<{ enabled: boolean; results: OtProbeResult[]; upserted: number }> {
    if (!this.isModbusEnabled()) {
      return { enabled: false, results: [], upserted: 0 };
    }
    if (!targets?.length) {
      throw new BadRequestException('targets array is required (e.g. [{ host, port?, unitId? }])');
    }

    const results: OtProbeResult[] = [];
    let upserted = 0;
    const assetType = await this.ensureAssetType(tenantId, 'OT / IoT Device', 'iot');

    for (const t of targets) {
      const host = t.host?.trim();
      if (!host) continue;
      const port = t.port || 502;
      const unitId = t.unitId ?? 1;
      try {
        const details = await this.modbusReadHoldingRegisters(host, port, unitId, 0, 2);
        results.push({
          protocol: 'MODBUS_TCP',
          host,
          port,
          reachable: true,
          details: { unitId, registers: details },
        });
        await this.upsertOtAsset(tenantId, assetType.id, userId, {
          name: `Modbus ${host}:${port}`,
          hostname: host,
          ipAddress: host,
          manufacturer: 'Modbus TCP',
          model: `Unit ${unitId}`,
          serialNumber: `modbus-${host}-${port}-${unitId}`,
          customFields: {
            otProtocol: 'MODBUS_TCP',
            modbusUnitId: unitId,
            modbusPort: port,
            sampleRegisters: details,
          },
        });
        upserted++;
      } catch (err: any) {
        results.push({
          protocol: 'MODBUS_TCP',
          host,
          port,
          reachable: false,
          error: err.message,
        });
      }
    }

    return { enabled: true, results, upserted };
  }

  /**
   * BACnet/IP Who-Is. When flag off → empty. Broadcasts/unicasts UDP BVLC Who-Is.
   */
  async probeBacnet(
    tenantId: string,
    opts: { targets?: OtProbeTarget[]; broadcastAddress?: string; timeoutMs?: number } = {},
    userId?: string,
  ): Promise<{ enabled: boolean; results: OtProbeResult[]; upserted: number }> {
    if (!this.isBacnetEnabled()) {
      return { enabled: false, results: [], upserted: 0 };
    }

    const timeoutMs = opts.timeoutMs || 3000;
    const port = 47808;
    const assetType = await this.ensureAssetType(tenantId, 'OT / IoT Device', 'iot');
    const discovered = await this.bacnetWhoIs({
      targets: opts.targets || [],
      broadcastAddress: opts.broadcastAddress || '255.255.255.255',
      port,
      timeoutMs,
    });

    const results: OtProbeResult[] = [];
    let upserted = 0;

    for (const d of discovered) {
      results.push({
        protocol: 'BACNET_IP',
        host: d.host,
        port,
        reachable: true,
        details: { deviceInstance: d.deviceInstance, vendorId: d.vendorId },
      });
      await this.upsertOtAsset(tenantId, assetType.id, userId, {
        name: `BACnet Device ${d.deviceInstance ?? d.host}`,
        hostname: d.host,
        ipAddress: d.host,
        manufacturer: 'BACnet/IP',
        model: d.vendorId != null ? `Vendor ${d.vendorId}` : 'BACnet Device',
        serialNumber: `bacnet-${d.host}-${d.deviceInstance ?? 'unknown'}`,
        customFields: {
          otProtocol: 'BACNET_IP',
          bacnetDeviceInstance: d.deviceInstance,
          bacnetVendorId: d.vendorId,
        },
      });
      upserted++;
    }

    // If explicit targets given and none responded, report unreachable
    if ((opts.targets || []).length && discovered.length === 0) {
      for (const t of opts.targets!) {
        results.push({
          protocol: 'BACNET_IP',
          host: t.host,
          port,
          reachable: false,
          error: 'No I-Am response within timeout',
        });
      }
    }

    return { enabled: true, results, upserted };
  }

  private modbusReadHoldingRegisters(
    host: string,
    port: number,
    unitId: number,
    startAddr: number,
    quantity: number,
  ): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Modbus TCP timeout connecting to ${host}:${port}`));
      }, 5000);

      socket.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      socket.connect(port, host, () => {
        // MBAP + PDU: Read Holding Registers (FC 0x03)
        const pdu = Buffer.alloc(5);
        pdu[0] = 0x03;
        pdu.writeUInt16BE(startAddr, 1);
        pdu.writeUInt16BE(quantity, 3);

        const mbap = Buffer.alloc(7);
        mbap.writeUInt16BE(1, 0); // transaction id
        mbap.writeUInt16BE(0, 2); // protocol id
        mbap.writeUInt16BE(1 + pdu.length, 4); // length = unitId + pdu
        mbap[6] = unitId & 0xff;

        socket.write(Buffer.concat([mbap, pdu]));
      });

      let buf = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        if (buf.length < 9) return;
        const length = buf.readUInt16BE(4);
        if (buf.length < 6 + length) return;
        clearTimeout(timeout);
        socket.destroy();

        const functionCode = buf[7];
        if (functionCode & 0x80) {
          reject(new Error(`Modbus exception code ${buf[8]}`));
          return;
        }
        const byteCount = buf[8];
        const regs: number[] = [];
        for (let i = 0; i < byteCount; i += 2) {
          if (9 + i + 1 < buf.length) {
            regs.push(buf.readUInt16BE(9 + i));
          }
        }
        resolve(regs);
      });
    });
  }

  private bacnetWhoIs(opts: {
    targets: OtProbeTarget[];
    broadcastAddress: string;
    port: number;
    timeoutMs: number;
  }): Promise<Array<{ host: string; deviceInstance?: number; vendorId?: number }>> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const found = new Map<string, { host: string; deviceInstance?: number; vendorId?: number }>();

      // BVLC Original-Broadcast-NPDU + NPDU + APDU Who-Is (unconfirmed)
      // Who-Is with no range: 10 08 (APDU)
      const whoIs = Buffer.from([
        0x81, // BVLC type
        0x0b, // Original-Broadcast-NPDU
        0x00, 0x08, // length
        0x01, // NPDU version
        0x00, // NPDU control (expecting reply)
        0x10, // APDU unconfirmed request
        0x08, // Who-Is
      ]);

      const onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        // Look for I-Am (APDU unconfirmed 0x00)
        // Minimal parse: search for 0x10 0x00 (unconfirmed I-Am)
        for (let i = 0; i < msg.length - 2; i++) {
          if (msg[i] === 0x10 && msg[i + 1] === 0x00) {
            let deviceInstance: number | undefined;
            let vendorId: number | undefined;
            // Object identifier typically follows as tagged application data
            // Best-effort: read next 4 bytes if present as BACnet object id
            if (i + 6 < msg.length && (msg[i + 2] & 0xf8) === 0xc0) {
              const b = msg.slice(i + 3, i + 7);
              if (b.length === 4) {
                const objId = (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
                deviceInstance = objId & 0x3fffff;
              }
            }
            const key = `${rinfo.address}:${deviceInstance ?? ''}`;
            found.set(key, { host: rinfo.address, deviceInstance, vendorId });
            break;
          }
        }
      };

      socket.on('message', onMessage);
      socket.on('error', (err) => {
        this.logger.warn(`BACnet socket error: ${err.message}`);
      });

      socket.bind(() => {
        try {
          socket.setBroadcast(true);
        } catch {
          /* ignore */
        }

        if (opts.targets.length === 0) {
          socket.send(whoIs, opts.port, opts.broadcastAddress);
        } else {
          for (const t of opts.targets) {
            const unicast = Buffer.from([
              0x81, 0x0a, 0x00, 0x08, // Original-Unicast-NPDU
              0x01, 0x00, 0x10, 0x08,
            ]);
            socket.send(unicast, t.port || opts.port, t.host);
          }
        }
      });

      setTimeout(() => {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        resolve(Array.from(found.values()));
      }, opts.timeoutMs);
    });
  }

  private async upsertOtAsset(
    tenantId: string,
    assetTypeId: string,
    userId: string | undefined,
    data: {
      name: string;
      hostname: string;
      ipAddress: string;
      manufacturer: string;
      model: string;
      serialNumber: string;
      customFields: Record<string, unknown>;
    },
  ) {
    const existing = await this.prisma.asset.findFirst({
      where: { tenantId, deletedAt: null, serialNumber: data.serialNumber },
    });
    const payload = {
      name: data.name,
      hostname: data.hostname,
      ipAddress: data.ipAddress,
      manufacturer: data.manufacturer,
      model: data.model,
      serialNumber: data.serialNumber,
      category: 'IoT',
      status: 'DISCOVERED' as const,
      discoverySource: 'IOT' as const,
      lastScannedAt: new Date(),
      customFields: data.customFields,
    };
    if (existing) {
      await this.prisma.asset.update({
        where: { id: existing.id },
        data: {
          ...payload,
          customFields: {
            ...((existing.customFields as object) || {}),
            ...data.customFields,
          } as any,
        },
      });
    } else {
      await this.prisma.asset.create({
        data: {
          tenantId,
          assetTypeId,
          createdById: userId || null,
          ...payload,
          customFields: data.customFields as any,
        },
      });
    }
  }

  private async ensureAssetType(tenantId: string, name: string, icon: string) {
    let assetType = await this.prisma.assetType.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
    if (!assetType) {
      assetType = await this.prisma.assetType.create({
        data: { tenantId, name, icon },
      });
    }
    return assetType;
  }
}
