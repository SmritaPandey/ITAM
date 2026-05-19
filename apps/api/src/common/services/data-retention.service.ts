import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

/**
 * Automated data retention — prevents unbounded DB growth.
 * Runs daily at 3 AM to clean up old records.
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  // Default retention periods (days)
  private readonly METRICS_RETENTION_DAYS = 90;
  private readonly AUDIT_LOG_RETENTION_DAYS = 365;
  private readonly SCAN_RESULT_RETENTION_DAYS = 180;
  private readonly REFRESH_TOKEN_CLEANUP_DAYS = 30;
  private readonly NOTIFICATION_RETENTION_DAYS = 90;

  constructor(private prisma: PrismaService) {}

  /**
   * Run at 3 AM daily — clean up expired data
   */
  @Cron('0 3 * * *')
  async runRetention() {
    this.logger.log('Starting data retention cleanup...');

    const results = await Promise.allSettled([
      this.cleanMetricsHistory(),
      this.cleanExpiredTokens(),
      this.cleanOldScanResults(),
      this.cleanOldNotifications(),
    ]);

    const summary = results.map((r, i) => {
      const names = ['MetricsHistory', 'ExpiredTokens', 'ScanResults', 'Notifications'];
      return r.status === 'fulfilled'
        ? `${names[i]}: ${r.value} removed`
        : `${names[i]}: FAILED (${(r as PromiseRejectedResult).reason?.message})`;
    });

    this.logger.log(`Retention cleanup complete: ${summary.join(', ')}`);
  }

  /**
   * Remove DeviceMetricsHistory older than retention period
   */
  private async cleanMetricsHistory(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.METRICS_RETENTION_DAYS);

    try {
      const result = await this.prisma.deviceMetricsHistory.deleteMany({
        where: { collectedAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned ${result.count} metrics history records (>${this.METRICS_RETENTION_DAYS}d)`);
      }
      return result.count;
    } catch (err: any) {
      this.logger.warn(`Metrics cleanup failed: ${err.message}`);
      return 0;
    }
  }

  /**
   * Remove expired refresh tokens
   */
  private async cleanExpiredTokens(): Promise<number> {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { revokedAt: { not: null } },
          ],
        },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned ${result.count} expired/revoked refresh tokens`);
      }
      return result.count;
    } catch (err: any) {
      this.logger.warn(`Token cleanup failed: ${err.message}`);
      return 0;
    }
  }

  /**
   * Remove old scan results
   */
  private async cleanOldScanResults(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.SCAN_RESULT_RETENTION_DAYS);

    try {
      const result = await this.prisma.scanResult.deleteMany({
        where: { startedAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned ${result.count} old scan results (>${this.SCAN_RESULT_RETENTION_DAYS}d)`);
      }
      return result.count;
    } catch (err: any) {
      this.logger.warn(`Scan results cleanup failed: ${err.message}`);
      return 0;
    }
  }

  /**
   * Remove old read notifications
   */
  private async cleanOldNotifications(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.NOTIFICATION_RETENTION_DAYS);

    try {
      const result = await this.prisma.notification.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          isRead: true,
        },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned ${result.count} old read notifications (>${this.NOTIFICATION_RETENTION_DAYS}d)`);
      }
      return result.count;
    } catch (err: any) {
      this.logger.warn(`Notification cleanup failed: ${err.message}`);
      return 0;
    }
  }

  /**
   * Get retention statistics (for admin dashboard)
   */
  async getStats() {
    const [metricsCount, tokenCount, scanCount, notifCount] = await Promise.all([
      this.prisma.deviceMetricsHistory.count().catch(() => 0),
      this.prisma.refreshToken.count().catch(() => 0),
      this.prisma.scanResult.count().catch(() => 0),
      this.prisma.notification.count().catch(() => 0),
    ]);

    return {
      metricsHistory: { count: metricsCount, retentionDays: this.METRICS_RETENTION_DAYS },
      refreshTokens: { count: tokenCount, retentionDays: this.REFRESH_TOKEN_CLEANUP_DAYS },
      scanResults: { count: scanCount, retentionDays: this.SCAN_RESULT_RETENTION_DAYS },
      notifications: { count: notifCount, retentionDays: this.NOTIFICATION_RETENTION_DAYS },
    };
  }
}
