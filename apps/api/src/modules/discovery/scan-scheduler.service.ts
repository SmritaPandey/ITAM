import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DiscoveryService } from './discovery.service';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ScanSchedulerService {
  private readonly logger = new Logger(ScanSchedulerService.name);

  constructor(
    private discoveryService: DiscoveryService,
    private prisma: PrismaService,
  ) {}

  /**
   * Check for due scheduled scans every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledScans() {
    try {
      await this.discoveryService.executeDueScans();
    } catch (err: any) {
      this.logger.error(`Scheduled scan execution error: ${err.message}`);
    }
  }

  /**
   * Mark stale agents (no heartbeat in 5 minutes) as OFFLINE every 2 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async markStaleAgents() {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = await this.prisma.agent.updateMany({
      where: { status: 'ONLINE', lastHeartbeat: { lt: fiveMinAgo } },
      data: { status: 'STALE' },
    });
    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} agents as STALE`);
    }

    // Mark agents offline if stale for > 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const offlineResult = await this.prisma.agent.updateMany({
      where: { status: 'STALE', lastHeartbeat: { lt: fifteenMinAgo } },
      data: { status: 'OFFLINE' },
    });
    if (offlineResult.count > 0) {
      this.logger.warn(`Marked ${offlineResult.count} agents as OFFLINE`);
    }
  }
}
