import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import * as dgram from 'dgram';
import * as crypto from 'crypto';

export interface ParsedSyslog {
  sourceIp: string;
  facility: number | null;
  severity: number | null;
  message: string;
  hostname?: string;
  appName?: string;
  receivedAt: Date;
}

const SEV_LABEL: Record<number, string> = {
  0: 'emergency',
  1: 'alert',
  2: 'critical',
  3: 'error',
  4: 'warning',
  5: 'notice',
  6: 'info',
  7: 'debug',
};

@Injectable()
export class SyslogReceiverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyslogReceiverService.name);
  private server: dgram.Socket | null = null;
  private readonly port = parseInt(process.env.SYSLOG_UDP_PORT || '5514', 10);
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  onModuleInit() {
    if (process.env.ENABLE_SYSLOG === 'true') {
      this.start();
    } else {
      this.logger.log('Syslog receiver disabled. Set ENABLE_SYSLOG=true to enable.');
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
        this.logger.error(`Syslog receiver error: ${err.message}`);
        if ((err as NodeJS.ErrnoException).code === 'EACCES') {
          this.logger.warn(`Port ${this.port} requires elevated privileges.`);
        }
      });

      this.server.on('listening', () => {
        const addr = this.server!.address();
        this.logger.log(`Syslog receiver listening on ${addr.address}:${addr.port}`);
        this.isRunning = true;
      });

      this.server.bind(this.port);
    } catch (err: any) {
      this.logger.error(`Failed to start syslog receiver: ${err.message}`);
    }
  }

  stop() {
    if (this.server) {
      try {
        this.server.close();
      } catch { /* ignore */ }
      this.server = null;
      this.isRunning = false;
      this.logger.log('Syslog receiver stopped');
    }
  }

  private async handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    try {
      const parsed = this.parseSyslog(msg.toString('utf8'), rinfo.address);
      if (!parsed) return;

      const tenantId = await this.correlateTenant(parsed.sourceIp);
      let ticketId: string | null = null;
      let alertId: string | null = null;

      if (tenantId && parsed.severity !== null && parsed.severity <= 4) {
        alertId = await this.maybeCreateAlert(tenantId, parsed);
      }

      if (
        tenantId &&
        parsed.severity !== null &&
        parsed.severity <= 3
      ) {
        ticketId = await this.maybeCreateTicket(tenantId, parsed);
      }

      await this.prisma.syslogEvent.create({
        data: {
          tenantId: tenantId || null,
          sourceIp: parsed.sourceIp,
          facility: parsed.facility,
          severity: parsed.severity,
          message: parsed.message.slice(0, 16000),
          ticketId,
        },
      });

      if (tenantId) {
        this.eventBus.emitMonitoringEvent(tenantId, 'syslog_event', {
          sourceIp: parsed.sourceIp,
          severity: parsed.severity,
          facility: parsed.facility,
          message: parsed.message.slice(0, 500),
          ticketId,
          alertId,
        });
      }

      this.logger.debug(
        `Syslog from ${parsed.sourceIp} sev=${parsed.severity}: ${parsed.message.slice(0, 80)}`,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to process syslog from ${rinfo.address}: ${err.message}`);
    }
  }

  /**
   * Light RFC3164 / RFC5424 parser.
   * PRI = facility * 8 + severity
   */
  parseSyslog(raw: string, sourceIp: string): ParsedSyslog | null {
    const text = raw.trim();
    if (!text) return null;

    let facility: number | null = null;
    let severity: number | null = null;
    let rest = text;
    let hostname: string | undefined;
    let appName: string | undefined;

    const priMatch = text.match(/^<(\d{1,3})>/);
    if (priMatch) {
      const pri = parseInt(priMatch[1], 10);
      if (pri >= 0 && pri <= 191) {
        facility = Math.floor(pri / 8);
        severity = pri % 8;
      }
      rest = text.slice(priMatch[0].length);
    }

    // RFC5424: VERSION SP TIMESTAMP SP HOSTNAME SP APP-NAME SP ...
    const rfc5424 = rest.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/s);
    if (rfc5424 && rfc5424[1] === '1') {
      hostname = rfc5424[3] !== '-' ? rfc5424[3] : undefined;
      appName = rfc5424[4] !== '-' ? rfc5424[4] : undefined;
      const msg = rfc5424[7] || '';
      // Strip structured data if present
      const sdStripped = msg.startsWith('[') || msg.startsWith('-')
        ? msg.replace(/^(?:-|(?:\[[^\]]*\]\s*)+)\s*/, '')
        : msg;
      return {
        sourceIp,
        facility,
        severity,
        message: sdStripped || rest,
        hostname,
        appName,
        receivedAt: new Date(),
      };
    }

    // RFC3164: TIMESTAMP HOSTNAME TAG: MESSAGE  (or free-form after PRI)
    const rfc3164 = rest.match(
      /^(?:[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*)$/,
    );
    if (rfc3164) {
      hostname = rfc3164[1];
      const body = rfc3164[2];
      const tagMatch = body.match(/^([A-Za-z0-9_\/.-]+)(?:\[\d+\])?:\s*(.*)$/);
      if (tagMatch) {
        appName = tagMatch[1];
        return {
          sourceIp,
          facility,
          severity,
          message: tagMatch[2] || body,
          hostname,
          appName,
          receivedAt: new Date(),
        };
      }
      return {
        sourceIp,
        facility,
        severity,
        message: body,
        hostname,
        receivedAt: new Date(),
      };
    }

    return {
      sourceIp,
      facility,
      severity,
      message: rest,
      receivedAt: new Date(),
    };
  }

  private async correlateTenant(sourceIp: string): Promise<string | null> {
    const device = await this.prisma.monitoredDevice.findFirst({
      where: { ipAddress: sourceIp },
      select: { tenantId: true },
    });
    if (device) return device.tenantId;

    const asset = await this.prisma.asset.findFirst({
      where: { ipAddress: sourceIp, deletedAt: null },
      select: { tenantId: true },
    });
    return asset?.tenantId || null;
  }

  private async maybeCreateAlert(tenantId: string, event: ParsedSyslog): Promise<string | null> {
    try {
      const recent = await this.prisma.alertEvent.findFirst({
        where: {
          tenantId,
          source: 'syslog',
          sourceId: event.sourceIp,
          resolved: false,
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recent) return recent.id;

      const sev =
        (event.severity ?? 5) <= 1 ? 'CRITICAL' :
        (event.severity ?? 5) <= 2 ? 'CRITICAL' :
        (event.severity ?? 5) <= 3 ? 'WARNING' :
        'INFO';

      const alert = await this.prisma.alertEvent.create({
        data: {
          tenantId,
          severity: sev,
          category: 'NETWORK',
          title: `Syslog ${SEV_LABEL[event.severity ?? 7] || 'event'} from ${event.sourceIp}`,
          message: event.message.slice(0, 4000),
          source: 'syslog',
          sourceId: event.sourceIp,
          metadata: {
            facility: event.facility,
            severity: event.severity,
            hostname: event.hostname,
            appName: event.appName,
          },
        },
      });
      return alert.id;
    } catch (err: any) {
      this.logger.warn(`Syslog alert create failed: ${err.message}`);
      return null;
    }
  }

  private async maybeCreateTicket(tenantId: string, event: ParsedSyslog): Promise<string | null> {
    try {
      // Deduplicate: skip if a similar open ticket was created in the last hour
      const recent = await this.prisma.syslogEvent.findFirst({
        where: {
          tenantId,
          sourceIp: event.sourceIp,
          severity: { lte: 3 },
          ticketId: { not: null },
          receivedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        select: { ticketId: true },
      });
      if (recent?.ticketId) return recent.ticketId;

      const admin = await this.prisma.user.findFirst({
        where: {
          tenantId,
          status: 'ACTIVE',
          role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
        },
        select: { id: true },
      });
      if (!admin) {
        this.logger.warn(`No admin for tenant ${tenantId} — cannot auto-ticket syslog`);
        return null;
      }

      const sevLabel =
        event.severity === 0 ? 'emergency' :
        event.severity === 1 ? 'alert' :
        event.severity === 2 ? 'critical' :
        'error';

      const ticketNumber = `SYS-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      const ticket = await this.prisma.ticket.create({
        data: {
          tenantId,
          requesterId: admin.id,
          ticketNumber,
          subject: `[Syslog ${sevLabel}] ${event.sourceIp}`,
          description:
            `Auto-created from syslog (severity ${event.severity}).\n` +
            `Source: ${event.sourceIp}` +
            (event.hostname ? ` (${event.hostname})` : '') +
            `\n\n${event.message.slice(0, 4000)}`,
          priority: (event.severity ?? 5) <= 1 ? 'CRITICAL' : (event.severity ?? 5) <= 2 ? 'HIGH' : 'MEDIUM',
          category: 'Incident',
          type: 'INCIDENT',
        },
      });

      return ticket.id;
    } catch (err: any) {
      this.logger.warn(`Syslog auto-ticket failed: ${err.message}`);
      return null;
    }
  }

  async getEvents(tenantId: string, opts: { limit?: number; severityMax?: number } = {}) {
    const limit = Math.min(opts.limit || 100, 500);
    const where: any = { tenantId };
    if (opts.severityMax !== undefined) {
      where.severity = { lte: opts.severityMax };
    }
    const events = await this.prisma.syslogEvent.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
    return { events, total: events.length, isRunning: this.isRunning, port: this.port };
  }

  getStats() {
    return { isRunning: this.isRunning, port: this.port };
  }
}
