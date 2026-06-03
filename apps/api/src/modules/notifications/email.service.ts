import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as dns from 'dns';
import { PrismaService } from '../../common/database/prisma.service';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private sentCount = 0;
  private sentResetAt = Date.now();
  private readonly MAX_PER_HOUR = 100;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.initTransporter();
  }

  private initTransporter() {
    let host = this.config.get('SMTP_HOST');
    let port = this.config.get('SMTP_PORT', 587);
    const user = this.config.get('SMTP_USER');
    const pass = this.config.get('SMTP_PASS');

    if (!host || !user) {
      this.logger.warn('SMTP not configured — emails will be logged only. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars.');
      return;
    }

    let secure = Number(port) === 465;

    // Force Hostinger to use Port 465 SSL since 587 has connection timeout issues on Railway
    if (host === 'smtp.hostinger.com') {
      port = 465;
      secure = true;
    }

    // Dynamically resolve hostname to IPv4 to prevent ENETUNREACH IPv6 issues in container
    dns.lookup(host, { family: 4 }, (err, ipAddress) => {
      const resolvedHost = err ? host : ipAddress;
      this.transporter = nodemailer.createTransport({
        host: resolvedHost,
        port: Number(port),
        secure,
        auth: { user, pass },
        tls: { servername: host, rejectUnauthorized: false },
      } as any);

      this.transporter.verify().then(() => {
        this.logger.log(`✅ SMTP connected: ${resolvedHost}:${port} (secure: ${secure})`);
      }).catch((err) => {
        this.logger.warn(`⚠️ SMTP connection verification failed on startup: ${err.message}. Retaining transporter for runtime retries.`);
      });
    });
  }

  private checkRateLimit(): boolean {
    if (Date.now() - this.sentResetAt > 3600000) {
      this.sentCount = 0;
      this.sentResetAt = Date.now();
    }
    return this.sentCount < this.MAX_PER_HOUR;
  }

  async send(options: EmailOptions): Promise<boolean | { sent: false; reason: string; logged: boolean }> {
    const from = this.config.get('SMTP_FROM', 'QS Asset <noreply@qsasset.com>');

    if (!this.checkRateLimit()) {
      this.logger.warn('Email rate limit reached (100/hour). Skipping.');
      return false;
    }

    if (!this.transporter) {
      this.logger.warn(`📧 [NO_SMTP] Email not sent — SMTP not configured. To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to} | Subject: ${options.subject}`);
      return { sent: false, reason: 'NO_SMTP_CONFIGURED', logged: true };
    }

    try {
      await this.transporter.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.subject,
      });
      this.sentCount++;
      this.logger.log(`📧 Email sent to ${options.to}: ${options.subject}`);
      return true;
    } catch (err: any) {
      this.logger.error(`📧 Email failed: ${err.message}`);
      return false;
    }
  }

  // ─── Pre-built Email Templates ──────────────────────────────

  async sendDeviceDownAlert(to: string | string[], deviceName: string, ip: string, downSince: string) {
    return this.send({
      to,
      subject: `🔴 Device Down: ${deviceName}`,
      html: this.wrapTemplate(`
        <h2 style="color:#ef4444;margin:0 0 12px">⚠️ Device Offline Alert</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#94a3b8">Device</td><td style="padding:8px 0;font-weight:600">${deviceName}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">IP Address</td><td style="padding:8px 0;font-family:monospace">${ip}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Down Since</td><td style="padding:8px 0">${downSince}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Status</td><td style="padding:8px 0"><span style="background:#ef444420;color:#ef4444;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">OFFLINE</span></td></tr>
        </table>
        <p style="margin-top:16px;font-size:13px;color:#94a3b8">An incident ticket has been auto-created. Check the dashboard for details.</p>
      `),
    });
  }

  async sendTicketAssigned(to: string, ticketNumber: string, subject: string, assignedBy: string) {
    return this.send({
      to,
      subject: `🎫 Ticket Assigned: ${ticketNumber}`,
      html: this.wrapTemplate(`
        <h2 style="color:#8b5cf6;margin:0 0 12px">Ticket Assigned to You</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#94a3b8">Ticket</td><td style="padding:8px 0;font-weight:600">${ticketNumber}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Subject</td><td style="padding:8px 0">${subject}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Assigned By</td><td style="padding:8px 0">${assignedBy}</td></tr>
        </table>
      `),
    });
  }

  async sendLicenseExpiryWarning(to: string | string[], licenseName: string, vendor: string, expiryDate: string, daysLeft: number) {
    return this.send({
      to,
      subject: `⏰ License Expiring: ${licenseName} (${daysLeft} days)`,
      html: this.wrapTemplate(`
        <h2 style="color:#f59e0b;margin:0 0 12px">License Expiry Warning</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#94a3b8">Software</td><td style="padding:8px 0;font-weight:600">${licenseName}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Vendor</td><td style="padding:8px 0">${vendor}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Expires</td><td style="padding:8px 0">${expiryDate}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Days Left</td><td style="padding:8px 0"><span style="background:#f59e0b20;color:#f59e0b;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${daysLeft} days</span></td></tr>
        </table>
      `),
    });
  }

  async sendPatchOverdueAlert(to: string | string[], patchId: string, title: string, severity: string, affectedAssets: number) {
    return this.send({
      to,
      subject: `🛡️ Patch Overdue: ${patchId} (${severity})`,
      html: this.wrapTemplate(`
        <h2 style="color:#ef4444;margin:0 0 12px">Patch Overdue Alert</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#94a3b8">Patch ID</td><td style="padding:8px 0;font-weight:600;font-family:monospace">${patchId}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Title</td><td style="padding:8px 0">${title}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Severity</td><td style="padding:8px 0"><span style="background:${severity === 'Critical' ? '#ef444420' : '#f59e0b20'};color:${severity === 'Critical' ? '#ef4444' : '#f59e0b'};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${severity}</span></td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Affected Assets</td><td style="padding:8px 0">${affectedAssets}</td></tr>
        </table>
      `),
    });
  }

  async sendDigest(to: string, events: Array<{ type: string; message: string; time: string }>) {
    const rows = events.map(e =>
      `<tr><td style="padding:6px 8px;border-bottom:1px solid #1e293b;font-size:12px;color:#94a3b8">${e.time}</td><td style="padding:6px 8px;border-bottom:1px solid #1e293b;font-size:12px">${e.type}</td><td style="padding:6px 8px;border-bottom:1px solid #1e293b;font-size:12px">${e.message}</td></tr>`
    ).join('');

    return this.send({
      to,
      subject: `📊 QS Asset Daily Digest — ${events.length} events`,
      html: this.wrapTemplate(`
        <h2 style="color:#06b6d4;margin:0 0 12px">Daily Event Digest</h2>
        <p style="color:#94a3b8;font-size:13px;margin:0 0 16px">${events.length} events in the last 24 hours</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:2px solid #334155"><th style="text-align:left;padding:6px 8px;font-size:11px;color:#64748b">Time</th><th style="text-align:left;padding:6px 8px;font-size:11px;color:#64748b">Type</th><th style="text-align:left;padding:6px 8px;font-size:11px;color:#64748b">Details</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `),
    });
  }

  // ─── Base HTML Template ──────────────────────────────────────

  private wrapTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid #1e293b;display:flex;align-items:center;gap:8px">
        <span style="font-size:18px;font-weight:700;color:#f1f5f9">Recon</span><span style="font-size:18px;font-weight:700;color:#06b6d4">APM</span>
      </div>
      <div style="padding:20px;color:#e2e8f0;font-size:14px;line-height:1.6">
        ${content}
      </div>
      <div style="padding:12px 20px;border-top:1px solid #1e293b;font-size:11px;color:#64748b;text-align:center">
        QS Asset — Enterprise Asset Monitoring & Management Platform
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
