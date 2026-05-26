import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async findById(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { role: true, department: true, site: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAll(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, deletedAt: null },
        include: { role: true, department: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(tenantId: string, data: {
    email: string; password: string; firstName: string; lastName: string;
    roleId: string; departmentId?: string; siteId?: string; phone?: string;
  }) {
    // Freemium restriction: STARTER plan has max 4 active user accounts
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant && tenant.plan === 'STARTER') {
      const activeUserCount = await this.prisma.user.count({
        where: { tenantId, deletedAt: null },
      });
      if (activeUserCount >= 4) {
        throw new BadRequestException('User limit exceeded. Free tier allows a maximum of 4 active user accounts. Please upgrade to a premium plan to add more team members.');
      }
    }

    const role = await this.prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role || role.tenantId !== tenantId) {
      throw new BadRequestException('Invalid role specified');
    }
    const roleName = role.name.toLowerCase();
    const isAllowed = roleName === 'staff' || roleName === 'employee' || roleName === 'tenant admin' || roleName === 'admin';
    if (!isAllowed) {
      throw new BadRequestException('You can only invite users with Staff, Employee, or Admin roles');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        roleId: data.roleId,
        departmentId: data.departmentId,
        siteId: data.siteId,
        phone: data.phone,
      },
      include: { role: true },
    });
  }

  async update(id: string, tenantId: string, data: {
    firstName?: string; lastName?: string; phone?: string;
    departmentId?: string; siteId?: string;
  }) {
    await this.findById(id, tenantId);
    return this.prisma.user.update({
      where: { id },
      data,
      include: { role: true, department: true },
    });
  }

  async toggleStatus(id: string, tenantId: string) {
    const user = await this.findById(id, tenantId);
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.prisma.user.update({
      where: { id },
      data: { status: newStatus },
      include: { role: true },
    });
  }

  async changeRole(id: string, tenantId: string, roleId: string) {
    await this.findById(id, tenantId);
    return this.prisma.user.update({
      where: { id },
      data: { roleId },
      include: { role: true },
    });
  }

  async softDelete(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'LOCKED' },
    });
  }

  async getRoles(tenantId: string) {
    return this.prisma.role.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async getDepartments(tenantId: string) {
    return this.prisma.department.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  // ─── Employee Self-Service ──────────────────────────────────────

  async getMyAssets(userId: string, tenantId: string) {
    return this.prisma.asset.findMany({
      where: { tenantId, assignedToId: userId },
      include: { assetType: true, site: true, hardwareDetails: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyTickets(userId: string, tenantId: string) {
    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { tenantId, requesterId: userId },
        include: { assignedTo: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.ticket.count({ where: { tenantId, requesterId: userId } }),
    ]);
    return { data, total };
  }

  async getMyDashboard(userId: string, tenantId: string) {
    const [assets, openTickets, resolvedTickets, notifications] = await Promise.all([
      this.prisma.asset.count({ where: { tenantId, assignedToId: userId } }),
      this.prisma.ticket.count({ where: { tenantId, requesterId: userId, status: { in: ['NEW', 'OPEN', 'IN_PROGRESS', 'PENDING'] } } }),
      this.prisma.ticket.count({ where: { tenantId, requesterId: userId, status: { in: ['RESOLVED', 'CLOSED'] } } }),
      this.prisma.notification.count({ where: { tenantId, userId, isRead: false } }),
    ]);
    return { assets, openTickets, resolvedTickets, unreadNotifications: notifications };
  }
}
