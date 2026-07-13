import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { TicketsService } from './tickets.service';
import { SlaService } from './sla.service';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getVaultKey(): Buffer {
  const raw =
    process.env.VAULT_ENCRYPTION_KEY ||
    (process.env.NODE_ENV === 'production'
      ? ''
      : 'assetcommand-default-vault-key-32!');
  if (!raw) throw new Error('VAULT_ENCRYPTION_KEY is required');
  return crypto.createHash('sha256').update(raw).digest();
}

@Injectable()
export class EmailIngestService {
  private readonly logger = new Logger(EmailIngestService.name);
  private polling = false;

  constructor(
    private prisma: PrismaService,
    private ticketsService: TicketsService,
    private slaService: SlaService,
    private configService: ConfigService,
  ) {}

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getVaultKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getVaultKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async list(tenantId: string) {
    const rows = await this.prisma.emailIngestConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.sanitize(r));
  }

  async get(id: string, tenantId: string) {
    const row = await this.prisma.emailIngestConfig.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Email ingest config not found');
    return this.sanitize(row);
  }

  async create(
    tenantId: string,
    data: {
      host: string;
      port?: number;
      username: string;
      password: string;
      folder?: string;
      enabled?: boolean;
    },
  ) {
    if (!data.host || !data.username || !data.password) {
      throw new BadRequestException('host, username, and password are required');
    }
    const row = await this.prisma.emailIngestConfig.create({
      data: {
        tenantId,
        host: data.host,
        port: data.port || 993,
        username: data.username,
        encryptedPass: this.encrypt(data.password),
        folder: data.folder || 'INBOX',
        enabled: data.enabled !== false,
      },
    });
    return this.sanitize(row);
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<{
      host: string;
      port: number;
      username: string;
      password: string;
      folder: string;
      enabled: boolean;
    }>,
  ) {
    await this.get(id, tenantId);
    const updates: any = {};
    if (data.host !== undefined) updates.host = data.host;
    if (data.port !== undefined) updates.port = data.port;
    if (data.username !== undefined) updates.username = data.username;
    if (data.folder !== undefined) updates.folder = data.folder;
    if (data.enabled !== undefined) updates.enabled = data.enabled;
    if (data.password) updates.encryptedPass = this.encrypt(data.password);
    const row = await this.prisma.emailIngestConfig.update({ where: { id }, data: updates });
    return this.sanitize(row);
  }

  async delete(id: string, tenantId: string) {
    await this.get(id, tenantId);
    await this.prisma.emailIngestConfig.delete({ where: { id } });
    return { deleted: true };
  }

  private sanitize(row: any) {
    const { encryptedPass, ...rest } = row;
    return { ...rest, hasPassword: !!encryptedPass };
  }

  /** Poll every 5 minutes for unread mail → create tickets. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollAll() {
    if (this.configService.get('DISABLE_CRON_JOBS') === 'true') return;
    if (this.polling) return;
    this.polling = true;
    try {
      const configs = await this.prisma.emailIngestConfig.findMany({ where: { enabled: true } });
      for (const cfg of configs) {
        try {
          await this.pollOne(cfg);
        } catch (err: any) {
          this.logger.error(`Email ingest ${cfg.id} failed: ${err.message}`);
        }
      }
    } finally {
      this.polling = false;
    }
  }

  async pollNow(id: string, tenantId: string) {
    const cfg = await this.prisma.emailIngestConfig.findFirst({ where: { id, tenantId } });
    if (!cfg) throw new NotFoundException('Email ingest config not found');
    return this.pollOne(cfg);
  }

  private async pollOne(cfg: any) {
    let ImapFlow: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ImapFlow = require('imapflow').ImapFlow;
    } catch {
      this.logger.error('imapflow package not available — cannot poll mailbox');
      return { polled: false, error: 'imapflow not installed' };
    }

    let simpleParser: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      simpleParser = require('mailparser').simpleParser;
    } catch {
      simpleParser = null;
    }

    const password = this.decrypt(cfg.encryptedPass);
    const client = new ImapFlow({
      host: cfg.host,
      port: cfg.port || 993,
      secure: true,
      auth: { user: cfg.username, pass: password },
      logger: false,
    });

    const created: string[] = [];
    try {
      await client.connect();
      const lock = await client.getMailboxLock(cfg.folder || 'INBOX');
      try {
        for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true, uid: true })) {
          let subject = msg.envelope?.subject || '(no subject)';
          let text = '';
          let fromAddr = msg.envelope?.from?.[0]?.address || cfg.username;

          if (msg.source && simpleParser) {
            try {
              const parsed = await simpleParser(msg.source);
              subject = parsed.subject || subject;
              text = parsed.text || parsed.html || '';
              fromAddr = parsed.from?.value?.[0]?.address || fromAddr;
            } catch {
              text = msg.source.toString().slice(0, 4000);
            }
          } else if (msg.source) {
            text = msg.source.toString().slice(0, 4000);
          }

          // Find or create a system requester (prefer matching email, else first admin)
          let requester = await this.prisma.user.findFirst({
            where: { tenantId: cfg.tenantId, email: { equals: fromAddr, mode: 'insensitive' } },
          });
          if (!requester) {
            requester = await this.prisma.user.findFirst({
              where: {
                tenantId: cfg.tenantId,
                status: 'ACTIVE',
                role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
              },
            });
          }
          if (!requester) {
            this.logger.warn(`No requester for email from ${fromAddr}; skipping`);
            continue;
          }

          const ticket = await this.ticketsService.create(cfg.tenantId, requester.id, {
            type: 'INCIDENT',
            category: 'Email',
            subject: `[Email] ${subject}`.slice(0, 240),
            description: `From: ${fromAddr}\n\n${text}`.slice(0, 10000),
            priority: 'MEDIUM',
          });
          if (ticket?.id) {
            await this.slaService.applySlaToTicket(ticket.id, cfg.tenantId, ticket.priority).catch(() => {});
            created.push(ticket.ticketNumber);
          }

          // Mark as seen
          await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err: any) {
      try { await client.logout(); } catch { /* ignore */ }
      throw err;
    }

    await this.prisma.emailIngestConfig.update({
      where: { id: cfg.id },
      data: { lastPolledAt: new Date() },
    });

    this.logger.log(`Email ingest ${cfg.host}: created ${created.length} ticket(s)`);
    return { polled: true, created };
  }
}
