import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import * as dgram from 'dgram';

export interface ParsedFlow {
  exporterIp: string;
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  protocol: number;
  bytes: bigint;
  packets: bigint;
  sampledAt: Date;
  tenantId?: string;
}

/** IPFIX / NetFlow v9 field type IDs we care about */
const NF_SRC_IPV4 = 8;
const NF_DST_IPV4 = 12;
const NF_PROTO = 4;
const NF_SRC_PORT = 7;
const NF_DST_PORT = 11;
const NF_OCTETS = 1;
const NF_PACKETS = 2;
const NF_OCTETS_TOTAL = 85; // IPFIX octetTotalCount
const NF_PACKETS_TOTAL = 86;

type FlowTemplate = Array<{ type: number; length: number }>;

@Injectable()
export class NetflowCollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NetflowCollectorService.name);
  private server: dgram.Socket | null = null;
  private readonly port = parseInt(process.env.NETFLOW_UDP_PORT || '2055', 10);
  private isRunning = false;
  private ingestCount = 0;
  /** Per-exporter template cache for NetFlow v9 / IPFIX */
  private readonly templates = new Map<string, Map<number, FlowTemplate>>();

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.ENABLE_NETFLOW === 'true') {
      this.start();
    } else {
      this.logger.log('NetFlow collector disabled. Set ENABLE_NETFLOW=true to enable.');
    }
  }

  onModuleDestroy() {
    this.stop();
  }

  start() {
    if (this.isRunning) return;

    try {
      this.server = dgram.createSocket('udp4');

      this.server.on('message', (msg, rinfo) => {
        void this.handleMessage(msg, rinfo);
      });

      this.server.on('error', (err) => {
        this.logger.error(`NetFlow collector error: ${err.message}`);
        if ((err as NodeJS.ErrnoException).code === 'EACCES') {
          this.logger.warn(`Port ${this.port} requires elevated privileges.`);
        }
      });

      this.server.on('listening', () => {
        const addr = this.server!.address();
        this.logger.log(`NetFlow collector listening on ${addr.address}:${addr.port}`);
        this.isRunning = true;
      });

      this.server.bind(this.port);
    } catch (err: any) {
      this.logger.error(`Failed to start NetFlow collector: ${err.message}`);
    }
  }

  stop() {
    if (this.server) {
      try {
        this.server.close();
      } catch { /* ignore */ }
      this.server = null;
      this.isRunning = false;
      this.logger.log('NetFlow collector stopped');
    }
  }

  private async handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    try {
      let flows: ParsedFlow[] = [];

      // JSON sFlow-lite / test frames (UTF-8 starting with '{')
      if (msg.length > 0 && msg[0] === 0x7b) {
        flows = this.parseJsonFrame(msg.toString('utf8'), rinfo.address);
      } else if (msg.length >= 24) {
        const v16 = msg.readUInt16BE(0);
        const v32 = msg.readUInt32BE(0);

        if (v16 === 5) {
          // NetFlow v5 (2-byte version)
          flows = this.parseNetflowV5(msg, rinfo.address);
        } else if (v16 === 9) {
          flows = this.parseNetflowV9OrIpfix(msg, rinfo.address, false);
        } else if (v16 === 10) {
          flows = this.parseNetflowV9OrIpfix(msg, rinfo.address, true);
        } else if (v32 === 5) {
          // sFlow datagram (4-byte version = 5)
          flows = this.parseSflowV5(msg, rinfo.address);
        }
      }

      if (flows.length === 0) return;

      for (const flow of flows) {
        const tenantId = flow.tenantId || (await this.correlateTenant(flow.exporterIp));
        if (!tenantId) {
          this.logger.debug(`Skipping uncorrelated flow from exporter ${flow.exporterIp}`);
          continue;
        }

        await this.prisma.flowRecord.create({
          data: {
            tenantId,
            exporterIp: flow.exporterIp,
            srcIp: flow.srcIp,
            dstIp: flow.dstIp,
            srcPort: flow.srcPort,
            dstPort: flow.dstPort,
            protocol: flow.protocol,
            bytes: flow.bytes,
            packets: flow.packets,
            sampledAt: flow.sampledAt,
          },
        });
        this.ingestCount++;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to process NetFlow from ${rinfo.address}: ${err.message}`);
    }
  }

  /**
   * Accept simple JSON test frames for sFlow-lite:
   * { "exporterIp"?, "tenantId"?, "flows": [{ srcIp, dstIp, srcPort, dstPort, protocol, bytes, packets }] }
   * or a single flow object.
   */
  parseJsonFrame(raw: string, remoteIp: string): ParsedFlow[] {
    try {
      const data = JSON.parse(raw);
      const exporterIp = data.exporterIp || remoteIp;
      const tenantId = data.tenantId as string | undefined;
      const list = Array.isArray(data.flows) ? data.flows : [data];
      const now = new Date();
      const out: ParsedFlow[] = [];

      for (const f of list) {
        if (!f?.srcIp || !f?.dstIp) continue;
        out.push({
          exporterIp,
          srcIp: String(f.srcIp),
          dstIp: String(f.dstIp),
          srcPort: Number(f.srcPort) || 0,
          dstPort: Number(f.dstPort) || 0,
          protocol: Number(f.protocol) || 0,
          bytes: BigInt(f.bytes || 0),
          packets: BigInt(f.packets || 0),
          sampledAt: f.sampledAt ? new Date(f.sampledAt) : now,
          tenantId,
        });
      }
      return out;
    } catch {
      return [];
    }
  }

  /**
   * NetFlow v5 header (24 bytes) + 48-byte records.
   */
  parseNetflowV5(buf: Buffer, remoteIp: string): ParsedFlow[] {
    if (buf.length < 24) return [];
    const version = buf.readUInt16BE(0);
    if (version !== 5) return [];

    const count = buf.readUInt16BE(2);
    const unixSecs = buf.readUInt32BE(8);
    const sampledAt = unixSecs > 0 ? new Date(unixSecs * 1000) : new Date();
    const flows: ParsedFlow[] = [];
    const maxRecords = Math.min(count, Math.floor((buf.length - 24) / 48));

    for (let i = 0; i < maxRecords; i++) {
      const off = 24 + i * 48;
      const srcIp = this.ipv4(buf, off);
      const dstIp = this.ipv4(buf, off + 4);
      const packets = BigInt(buf.readUInt32BE(off + 16));
      const bytes = BigInt(buf.readUInt32BE(off + 20));
      const srcPort = buf.readUInt16BE(off + 32);
      const dstPort = buf.readUInt16BE(off + 34);
      const protocol = buf.readUInt8(off + 38);

      flows.push({
        exporterIp: remoteIp,
        srcIp,
        dstIp,
        srcPort,
        dstPort,
        protocol,
        bytes,
        packets,
        sampledAt,
      });
    }
    return flows;
  }

  /**
   * NetFlow v9 (version 9) / IPFIX (version 10) with per-exporter template cache.
   * Parses Template FlowSets and Data FlowSets for common IPv4 field IDs.
   */
  parseNetflowV9OrIpfix(buf: Buffer, remoteIp: string, isIpfix: boolean): ParsedFlow[] {
    if (buf.length < (isIpfix ? 16 : 20)) return [];
    const flows: ParsedFlow[] = [];
    const now = new Date();

    let offset = isIpfix ? 16 : 20; // skip header
    const exporterKey = remoteIp;
    if (!this.templates.has(exporterKey)) this.templates.set(exporterKey, new Map());
    const tplMap = this.templates.get(exporterKey)!;

    while (offset + 4 <= buf.length) {
      const flowSetId = buf.readUInt16BE(offset);
      const length = buf.readUInt16BE(offset + 2);
      if (length < 4 || offset + length > buf.length) break;
      const setEnd = offset + length;
      let pos = offset + 4;

      // Template sets: NetFlow v9 = 0, IPFIX = 2; Options templates skipped
      if (flowSetId === 0 || (isIpfix && flowSetId === 2)) {
        while (pos + 4 <= setEnd) {
          const templateId = buf.readUInt16BE(pos);
          const fieldCount = buf.readUInt16BE(pos + 2);
          pos += 4;
          const fields: FlowTemplate = [];
          let ok = true;
          for (let f = 0; f < fieldCount; f++) {
            if (pos + 4 > setEnd) {
              ok = false;
              break;
            }
            let type = buf.readUInt16BE(pos);
            let flen = buf.readUInt16BE(pos + 2);
            pos += 4;
            // IPFIX enterprise bit
            if (isIpfix && type & 0x8000) {
              if (pos + 4 > setEnd) {
                ok = false;
                break;
              }
              type = type & 0x7fff;
              pos += 4; // skip enterprise number
            }
            fields.push({ type, length: flen });
          }
          if (ok && templateId >= 256) tplMap.set(templateId, fields);
        }
      } else if (flowSetId >= 256) {
        const tpl = tplMap.get(flowSetId);
        if (tpl) {
          const recordLen = tpl.reduce((s, f) => s + (f.length === 0xffff ? 0 : f.length), 0);
          if (recordLen > 0) {
            while (pos + recordLen <= setEnd) {
              const rec = this.decodeTemplatedRecord(buf, pos, tpl);
              pos += recordLen;
              if (rec.srcIp && rec.dstIp) {
                flows.push({
                  exporterIp: remoteIp,
                  srcIp: rec.srcIp,
                  dstIp: rec.dstIp,
                  srcPort: rec.srcPort || 0,
                  dstPort: rec.dstPort || 0,
                  protocol: rec.protocol || 0,
                  bytes: rec.bytes || 0n,
                  packets: rec.packets || 0n,
                  sampledAt: now,
                });
              }
            }
          }
        }
      }

      offset = setEnd;
      // NetFlow v9 pads to 4-byte boundary already via length
    }

    return flows;
  }

  private decodeTemplatedRecord(
    buf: Buffer,
    offset: number,
    tpl: FlowTemplate,
  ): {
    srcIp?: string;
    dstIp?: string;
    srcPort?: number;
    dstPort?: number;
    protocol?: number;
    bytes?: bigint;
    packets?: bigint;
  } {
    const out: any = {};
    let pos = offset;
    for (const field of tpl) {
      const len = field.length;
      if (len === 0xffff || pos + len > buf.length) break;
      const slice = buf.subarray(pos, pos + len);
      pos += len;
      switch (field.type) {
        case NF_SRC_IPV4:
          if (len === 4) out.srcIp = this.ipv4(slice, 0);
          break;
        case NF_DST_IPV4:
          if (len === 4) out.dstIp = this.ipv4(slice, 0);
          break;
        case NF_SRC_PORT:
          if (len >= 2) out.srcPort = slice.readUInt16BE(0);
          break;
        case NF_DST_PORT:
          if (len >= 2) out.dstPort = slice.readUInt16BE(0);
          break;
        case NF_PROTO:
          if (len >= 1) out.protocol = slice.readUInt8(0);
          break;
        case NF_OCTETS:
        case NF_OCTETS_TOTAL:
          out.bytes = this.readVarUint(slice);
          break;
        case NF_PACKETS:
        case NF_PACKETS_TOTAL:
          out.packets = this.readVarUint(slice);
          break;
      }
    }
    return out;
  }

  private readVarUint(buf: Buffer): bigint {
    if (buf.length === 0) return 0n;
    if (buf.length === 1) return BigInt(buf.readUInt8(0));
    if (buf.length === 2) return BigInt(buf.readUInt16BE(0));
    if (buf.length === 4) return BigInt(buf.readUInt32BE(0));
    if (buf.length >= 8) {
      const hi = BigInt(buf.readUInt32BE(0));
      const lo = BigInt(buf.readUInt32BE(4));
      return (hi << 32n) | lo;
    }
    let v = 0n;
    for (let i = 0; i < buf.length; i++) v = (v << 8n) | BigInt(buf[i]);
    return v;
  }

  /**
   * Minimal sFlow v5: extract IPv4 5-tuples from sampled headers in flow samples.
   */
  parseSflowV5(buf: Buffer, remoteIp: string): ParsedFlow[] {
    if (buf.length < 28 || buf.readUInt32BE(0) !== 5) return [];
    const flows: ParsedFlow[] = [];
    const now = new Date();

    // Skip: version(4) + agent_addr_type(4) + agent_addr(4|16) + sub_agent(4) + seq(4) + uptime(4) + numSamples(4)
    let pos = 4;
    if (pos + 4 > buf.length) return [];
    const addrType = buf.readUInt32BE(pos);
    pos += 4;
    const addrLen = addrType === 1 ? 4 : addrType === 2 ? 16 : 4;
    pos += addrLen + 4 + 4 + 4; // agent + subAgent + seq + uptime
    if (pos + 4 > buf.length) return [];
    const numSamples = buf.readUInt32BE(pos);
    pos += 4;

    for (let s = 0; s < Math.min(numSamples, 64) && pos + 8 <= buf.length; s++) {
      const sampleType = buf.readUInt32BE(pos);
      const sampleLen = buf.readUInt32BE(pos + 4);
      pos += 8;
      if (sampleLen < 0 || pos + sampleLen > buf.length) break;
      const sampleEnd = pos + sampleLen;

      // enterprise 0, format 1 = flow sample
      if ((sampleType & 0xfff) === 1) {
        // Skip sample seq, source id, rate, pool, drops, input, output → records
        let p = pos + 4 + 4 + 4 + 4 + 4 + 4 + 4;
        if (p + 4 <= sampleEnd) {
          const numRecords = buf.readUInt32BE(p);
          p += 4;
          for (let r = 0; r < Math.min(numRecords, 16) && p + 8 <= sampleEnd; r++) {
            const dataFormat = buf.readUInt32BE(p);
            const dataLen = buf.readUInt32BE(p + 4);
            p += 8;
            if (p + dataLen > sampleEnd) break;
            // format 1 = raw packet header
            if ((dataFormat & 0xfff) === 1 && dataLen >= 16) {
              const headerProto = buf.readUInt32BE(p); // 1=Ethernet
              const frameLen = buf.readUInt32BE(p + 4);
              const stripped = buf.readUInt32BE(p + 8);
              const headerLen = buf.readUInt32BE(p + 12);
              const hdrStart = p + 16;
              if (headerProto === 1 && headerLen >= 34 && hdrStart + headerLen <= buf.length) {
                const ethTypeOff = hdrStart + 12;
                let ipOff = hdrStart + 14;
                // VLAN tag
                if (buf.readUInt16BE(ethTypeOff) === 0x8100) ipOff += 4;
                if (ipOff + 20 <= buf.length && (buf[ipOff] >> 4) === 4) {
                  const ihl = (buf[ipOff] & 0xf) * 4;
                  const protocol = buf[ipOff + 9];
                  const srcIp = this.ipv4(buf, ipOff + 12);
                  const dstIp = this.ipv4(buf, ipOff + 16);
                  let srcPort = 0;
                  let dstPort = 0;
                  if ((protocol === 6 || protocol === 17) && ipOff + ihl + 4 <= buf.length) {
                    srcPort = buf.readUInt16BE(ipOff + ihl);
                    dstPort = buf.readUInt16BE(ipOff + ihl + 2);
                  }
                  flows.push({
                    exporterIp: remoteIp,
                    srcIp,
                    dstIp,
                    srcPort,
                    dstPort,
                    protocol,
                    bytes: BigInt(frameLen || headerLen),
                    packets: 1n,
                    sampledAt: now,
                  });
                }
              }
              void stripped;
            }
            p += dataLen;
            // pad to 4 bytes
            if (dataLen % 4) p += 4 - (dataLen % 4);
          }
        }
      }

      pos = sampleEnd;
      if (sampleLen % 4) pos += 4 - (sampleLen % 4);
    }

    return flows;
  }

  private ipv4(buf: Buffer, offset: number): string {
    return `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
  }

  private async correlateTenant(exporterIp: string): Promise<string | null> {
    const device = await this.prisma.monitoredDevice.findFirst({
      where: { ipAddress: exporterIp },
      select: { tenantId: true },
    });
    if (device) return device.tenantId;

    const asset = await this.prisma.asset.findFirst({
      where: { ipAddress: exporterIp, deletedAt: null },
      select: { tenantId: true },
    });
    return asset?.tenantId || null;
  }

  /** Hourly rollup of FlowRecord → FlowRollup (top talkers by IP). */
  @Cron(CronExpression.EVERY_HOUR)
  async rollupHourly() {
    if (process.env.DISABLE_CRON_JOBS === 'true') return;
    if (process.env.ENABLE_NETFLOW !== 'true' && this.ingestCount === 0) {
      // Still roll up any pending records even if collector is off
      const pending = await this.prisma.flowRecord.count();
      if (pending === 0) return;
    }

    try {
      const windowEnd = new Date();
      windowEnd.setMinutes(0, 0, 0);
      const windowStart = new Date(windowEnd.getTime() - 60 * 60 * 1000);

      const records = await this.prisma.flowRecord.findMany({
        where: {
          sampledAt: { gte: windowStart, lt: windowEnd },
        },
        select: {
          tenantId: true,
          srcIp: true,
          dstIp: true,
          bytes: true,
          packets: true,
        },
      });

      if (records.length === 0) return;

      // Aggregate per tenant + talker (src = out, dst = in)
      type Acc = { bytesIn: bigint; bytesOut: bigint; packets: bigint; flows: number };
      const byTenant = new Map<string, Map<string, Acc>>();

      for (const r of records) {
        if (!byTenant.has(r.tenantId)) byTenant.set(r.tenantId, new Map());
        const talkers = byTenant.get(r.tenantId)!;

        const bump = (ip: string, dir: 'in' | 'out') => {
          let a = talkers.get(ip);
          if (!a) {
            a = { bytesIn: 0n, bytesOut: 0n, packets: 0n, flows: 0 };
            talkers.set(ip, a);
          }
          if (dir === 'out') a.bytesOut += r.bytes;
          else a.bytesIn += r.bytes;
          a.packets += r.packets;
          a.flows += 1;
        };

        bump(r.srcIp, 'out');
        bump(r.dstIp, 'in');
      }

      for (const [tenantId, talkers] of byTenant) {
        for (const [talkerIp, a] of talkers) {
          await this.prisma.flowRollup.upsert({
            where: {
              tenantId_windowStart_talkerIp: { tenantId, windowStart, talkerIp },
            },
            create: {
              tenantId,
              windowStart,
              talkerIp,
              bytesIn: a.bytesIn,
              bytesOut: a.bytesOut,
              packets: a.packets,
              flows: a.flows,
            },
            update: {
              bytesIn: a.bytesIn,
              bytesOut: a.bytesOut,
              packets: a.packets,
              flows: a.flows,
            },
          });
        }
      }

      this.logger.log(
        `Flow rollup complete for window ${windowStart.toISOString()} (${records.length} records)`,
      );
    } catch (err: any) {
      this.logger.error(`Flow rollup failed: ${err.message}`);
    }
  }

  async getTopTalkers(tenantId: string, opts: { hours?: number; limit?: number } = {}) {
    const hours = opts.hours || 24;
    const limit = Math.min(opts.limit || 20, 100);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const rollups = await this.prisma.flowRollup.findMany({
      where: { tenantId, windowStart: { gte: since } },
    });

    if (rollups.length > 0) {
      const agg = new Map<string, { talkerIp: string; bytesIn: bigint; bytesOut: bigint; packets: bigint; flows: number }>();
      for (const r of rollups) {
        const cur = agg.get(r.talkerIp) || {
          talkerIp: r.talkerIp,
          bytesIn: 0n,
          bytesOut: 0n,
          packets: 0n,
          flows: 0,
        };
        cur.bytesIn += r.bytesIn;
        cur.bytesOut += r.bytesOut;
        cur.packets += r.packets;
        cur.flows += r.flows;
        agg.set(r.talkerIp, cur);
      }
      const sorted = [...agg.values()]
        .sort((a, b) => Number(b.bytesIn + b.bytesOut - (a.bytesIn + a.bytesOut)))
        .slice(0, limit)
        .map((t) => ({
          talkerIp: t.talkerIp,
          bytesIn: t.bytesIn.toString(),
          bytesOut: t.bytesOut.toString(),
          totalBytes: (t.bytesIn + t.bytesOut).toString(),
          packets: t.packets.toString(),
          flows: t.flows,
        }));
      return { talkers: sorted, source: 'rollup', hours, total: sorted.length };
    }

    // Fallback: aggregate raw FlowRecords when rollups are empty
    const records = await this.prisma.flowRecord.findMany({
      where: { tenantId, sampledAt: { gte: since } },
      select: { srcIp: true, dstIp: true, bytes: true, packets: true },
    });

    const agg = new Map<string, { bytesIn: bigint; bytesOut: bigint; packets: bigint; flows: number }>();
    for (const r of records) {
      const src = agg.get(r.srcIp) || { bytesIn: 0n, bytesOut: 0n, packets: 0n, flows: 0 };
      src.bytesOut += r.bytes;
      src.packets += r.packets;
      src.flows += 1;
      agg.set(r.srcIp, src);

      const dst = agg.get(r.dstIp) || { bytesIn: 0n, bytesOut: 0n, packets: 0n, flows: 0 };
      dst.bytesIn += r.bytes;
      dst.packets += r.packets;
      dst.flows += 1;
      agg.set(r.dstIp, dst);
    }

    const sorted = [...agg.entries()]
      .map(([talkerIp, t]) => ({
        talkerIp,
        bytesIn: t.bytesIn.toString(),
        bytesOut: t.bytesOut.toString(),
        totalBytes: (t.bytesIn + t.bytesOut).toString(),
        packets: t.packets.toString(),
        flows: t.flows,
      }))
      .sort((a, b) => Number(BigInt(b.totalBytes) - BigInt(a.totalBytes)))
      .slice(0, limit);

    return {
      talkers: sorted,
      source: records.length > 0 ? 'raw' : 'empty',
      hours,
      total: sorted.length,
      message:
        sorted.length === 0
          ? 'No flow data. Enable ENABLE_NETFLOW=true and point exporters at this collector.'
          : undefined,
    };
  }

  async getStats(tenantId: string) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recordCount, rollupCount, recentBytes] = await Promise.all([
      this.prisma.flowRecord.count({ where: { tenantId, sampledAt: { gte: since24h } } }),
      this.prisma.flowRollup.count({ where: { tenantId, windowStart: { gte: since24h } } }),
      this.prisma.flowRecord.aggregate({
        where: { tenantId, sampledAt: { gte: since24h } },
        _sum: { bytes: true, packets: true },
      }),
    ]);

    return {
      isRunning: this.isRunning,
      port: this.port,
      ingestCount: this.ingestCount,
      last24h: {
        records: recordCount,
        rollups: rollupCount,
        bytes: (recentBytes._sum.bytes ?? 0n).toString(),
        packets: (recentBytes._sum.packets ?? 0n).toString(),
      },
    };
  }
}
