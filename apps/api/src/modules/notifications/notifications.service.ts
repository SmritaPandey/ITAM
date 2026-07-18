import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { EmailService } from './email.service';

type DigestFrequency = 'DAILY' | 'WEEKLY';
type DigestPreference = {
  enabled: boolean;
  frequency: DigestFrequency;
  lastSentAt?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (Number(page) - 1) * Number(limit);
    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { data, total, unread, page: Number(page), limit: Number(limit) };
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { unread: count };
  }

  async getDigestPreference(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const preferences = (user.preferences as Record<string, any>) || {};
    return this.normalizeDigestPreference(preferences.notificationDigest);
  }

  async updateDigestPreference(
    userId: string,
    body: { enabled?: boolean; frequency?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const preferences = (user.preferences as Record<string, any>) || {};
    const current = this.normalizeDigestPreference(preferences.notificationDigest);
    const frequency: DigestFrequency =
      String(body.frequency || current.frequency).toUpperCase() === 'WEEKLY'
        ? 'WEEKLY'
        : 'DAILY';
    const notificationDigest: DigestPreference = {
      ...current,
      enabled: body.enabled ?? current.enabled,
      frequency,
    };
    await this.prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...preferences, notificationDigest } },
    });
    return notificationDigest;
  }

  /**
   * Hourly scheduler checks per-user daily/weekly cadence and sends one email
   * containing unread notifications created since that user's previous digest.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendDueDigests() {
    if (process.env.DISABLE_CRON_JOBS === 'true') return { checked: 0, sent: 0 };
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, email: true, preferences: true },
    });
    let sent = 0;
    for (const user of users) {
      const preferences = (user.preferences as Record<string, any>) || {};
      const digest = this.normalizeDigestPreference(preferences.notificationDigest);
      if (!digest.enabled || !this.isDigestDue(digest)) continue;
      if (await this.sendDigestForUser(user.id, user.email, preferences, digest)) sent++;
    }
    return { checked: users.length, sent };
  }

  async sendDigestNow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, preferences: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const preferences = (user.preferences as Record<string, any>) || {};
    const digest = this.normalizeDigestPreference(preferences.notificationDigest);
    const sent = await this.sendDigestForUser(user.id, user.email, preferences, digest, true);
    return { sent };
  }

  private normalizeDigestPreference(value: any): DigestPreference {
    return {
      enabled: value?.enabled === true,
      frequency: String(value?.frequency).toUpperCase() === 'WEEKLY' ? 'WEEKLY' : 'DAILY',
      lastSentAt: value?.lastSentAt,
    };
  }

  private isDigestDue(digest: DigestPreference) {
    if (!digest.lastSentAt) return true;
    const elapsed = Date.now() - new Date(digest.lastSentAt).getTime();
    const interval = digest.frequency === 'WEEKLY' ? 7 * 86400000 : 86400000;
    return !Number.isFinite(elapsed) || elapsed >= interval;
  }

  private async sendDigestForUser(
    userId: string,
    email: string,
    preferences: Record<string, any>,
    digest: DigestPreference,
    force = false,
  ) {
    const since = !force && digest.lastSentAt
      ? new Date(digest.lastSentAt)
      : new Date(Date.now() - (digest.frequency === 'WEEKLY' ? 7 : 1) * 86400000);
    const notifications = await this.prisma.notification.findMany({
      where: { userId, isRead: false, createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    if (notifications.length === 0) return false;

    const result = await this.email.sendDigest(
      email,
      notifications.map((notification) => ({
        type: notification.module || notification.type,
        message: `${notification.title}: ${notification.message}`,
        time: notification.createdAt.toISOString(),
      })),
    );
    if (result !== true) return false;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...preferences,
          notificationDigest: { ...digest, lastSentAt: new Date().toISOString() },
        },
      },
    });
    return true;
  }

  async delete(id: string, userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) throw new NotFoundException('Notification not found');
    return { deleted: true };
  }

  /**
   * Create a notification — called by other services (tickets, discovery, etc.)
   */
  async create(tenantId: string, userId: string, data: {
    title: string; message: string; type?: string; module?: string; resourceId?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId,
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
        module: data.module,
        resourceId: data.resourceId,
      },
    });
  }

  /**
   * Broadcast a notification to all admins in a tenant
   */
  async broadcastToAdmins(tenantId: string, data: {
    title: string; message: string; type?: string; module?: string; resourceId?: string;
  }) {
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    await this.prisma.notification.createMany({
      data: admins.map(admin => ({
        tenantId,
        userId: admin.id,
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
        module: data.module,
        resourceId: data.resourceId,
      })),
    });

    return { sent: admins.length };
  }
}
