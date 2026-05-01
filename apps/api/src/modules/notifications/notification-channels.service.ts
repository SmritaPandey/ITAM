import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationChannelsService {
  private readonly logger = new Logger(NotificationChannelsService.name);

  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.notificationChannel.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async create(tenantId: string, data: any) {
    return this.prisma.notificationChannel.create({ data: { tenantId, ...data } });
  }

  async update(id: string, tenantId: string, data: any) {
    return this.prisma.notificationChannel.update({ where: { id, tenantId }, data });
  }

  async delete(id: string, tenantId: string) {
    return this.prisma.notificationChannel.delete({ where: { id, tenantId } });
  }

  async test(id: string, tenantId: string) {
    const channel = await this.prisma.notificationChannel.findFirst({ where: { id, tenantId } });
    if (!channel) throw new NotFoundException('Channel not found');

    const config = channel.config as any;
    try {
      if (channel.type === 'SLACK' && config.webhookUrl) {
        const response = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '🔔 AssetCommand test notification — channel is working!' }),
        });
        return { success: response.ok, status: response.status };
      }
      if (channel.type === 'TEAMS' && config.webhookUrl) {
        const response = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ '@type': 'MessageCard', summary: 'Test', title: '🔔 AssetCommand Test', text: 'Channel is working!' }),
        });
        return { success: response.ok, status: response.status };
      }
      if (channel.type === 'WEBHOOK' && config.webhookUrl) {
        const response = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'test', message: 'AssetCommand webhook test', timestamp: new Date().toISOString() }),
        });
        return { success: response.ok, status: response.status };
      }
      return { success: false, message: `Channel type ${channel.type} test not implemented or missing config` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async send(tenantId: string, event: string, payload: any) {
    const channels = await this.prisma.notificationChannel.findMany({
      where: { tenantId, isActive: true },
    });

    for (const channel of channels) {
      const events = channel.events as string[];
      if (events.length > 0 && !events.includes(event) && !events.includes('*')) continue;

      const config = channel.config as any;
      try {
        if ((channel.type === 'SLACK' || channel.type === 'TEAMS' || channel.type === 'WEBHOOK') && config.webhookUrl) {
          await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }),
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to send to channel ${channel.name}: ${err.message}`);
      }
    }
  }

  // ─── License Metering ──────────────────────────────────────────────────
  @Cron(CronExpression.EVERY_6_HOURS)
  async meterLicenses() {
    this.logger.log('Running license metering...');
    const licenses = await this.prisma.license.findMany({ where: { status: 'ACTIVE' } });
    for (const lic of licenses) {
      const installations = await this.prisma.softwareInstallation.count({
        where: { software: { name: { contains: lic.softwareName, mode: 'insensitive' } } },
      });
      let complianceStatus = 'UNKNOWN';
      if (installations <= lic.totalSeats) complianceStatus = 'COMPLIANT';
      else complianceStatus = 'OVER_LICENSED';
      if (installations < Math.floor(lic.totalSeats * 0.5)) complianceStatus = 'UNDER_LICENSED';

      await this.prisma.license.update({
        where: { id: lic.id },
        data: { actualUsage: installations, lastMeasuredAt: new Date(), complianceStatus, usedSeats: installations },
      });
    }
    this.logger.log(`Metered ${licenses.length} licenses`);
  }
}
