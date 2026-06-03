import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

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
