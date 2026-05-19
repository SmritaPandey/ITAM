import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Dashboard KPIs ──────────────────────────────────────────
  async getDashboard() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalTenants, activeTenants, totalUsers, totalAssets,
      newSignups7d, pendingContacts, recentContacts,
      recentTenants, totalPayments,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.asset.count({ where: { deletedAt: null } }),
      this.prisma.tenant.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.contactSubmission.count({ where: { status: 'NEW' } }),
      this.prisma.contactSubmission.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, plan: true, status: true, createdAt: true },
      }),
      this.prisma.payment.aggregate({ _sum: { amount: true } }),
    ]);

    // MRR from subscriptions
    const mrr = await this.prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { mrr: true },
    });

    // Plan distribution
    const planDist = await this.prisma.tenant.groupBy({
      by: ['plan'],
      _count: true,
    });

    return {
      kpis: {
        totalTenants,
        activeTenants,
        totalUsers,
        totalAssets,
        newSignups7d,
        pendingContacts,
        mrr: mrr._sum.mrr || 0,
        totalRevenue: totalPayments._sum.amount || 0,
      },
      planDistribution: planDist.map(p => ({ plan: p.plan, count: p._count })),
      recentTenants,
      recentContacts,
    };
  }

  // ─── Tenant Management ───────────────────────────────────────
  async listTenants(query?: { limit?: number; offset?: number; search?: string; plan?: string; status?: string }) {
    const where: any = {};
    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query?.plan) where.plan = query.plan;
    if (query?.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query?.limit || 50,
        skip: query?.offset || 0,
        include: {
          _count: { select: { users: true, assets: true, tickets: true } },
          subscription: { select: { plan: true, status: true, mrr: true, startDate: true, endDate: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, total };
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, assets: true, tickets: true, scanJobs: true } },
        subscription: { include: { payments: { orderBy: { paidAt: 'desc' }, take: 10 } } },
        users: {
          select: { id: true, email: true, firstName: true, lastName: true, status: true, lastLoginAt: true, role: { select: { name: true } } },
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateTenant(id: string, dto: { plan?: string; status?: string; settings?: any }) {
    const data: any = {};
    if (dto.plan) data.plan = dto.plan;
    if (dto.status) data.status = dto.status;
    if (dto.settings) data.settings = dto.settings;

    const tenant = await this.prisma.tenant.update({ where: { id }, data });

    // Also update subscription plan if plan changed
    if (dto.plan) {
      await this.prisma.subscription.upsert({
        where: { tenantId: id },
        update: { plan: dto.plan as any },
        create: { tenantId: id, plan: dto.plan as any, status: 'ACTIVE' },
      });
    }

    this.logger.log(`Tenant ${id} updated: ${JSON.stringify(dto)}`);
    return tenant;
  }

  async deleteTenant(id: string) {
    await this.prisma.tenant.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    this.logger.warn(`Tenant ${id} soft-deleted (status → CANCELLED)`);
    return { success: true };
  }

  // ─── User Management ─────────────────────────────────────────
  async listUsers(query?: { limit?: number; offset?: number; search?: string; tenantId?: string; status?: string }) {
    const where: any = { deletedAt: null };
    if (query?.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query?.tenantId) where.tenantId = query.tenantId;
    if (query?.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query?.limit || 50,
        skip: query?.offset || 0,
        select: {
          id: true, email: true, firstName: true, lastName: true, phone: true,
          status: true, lastLoginAt: true, lastLoginIp: true, createdAt: true,
          isSuperAdmin: true,
          role: { select: { name: true } },
          tenant: { select: { id: true, name: true, plan: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total };
  }

  async updateUser(id: string, dto: { status?: string; roleId?: string; resetPassword?: string }) {
    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.roleId) data.roleId = dto.roleId;
    if (dto.resetPassword) {
      data.passwordHash = await bcrypt.hash(dto.resetPassword, 12);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, status: true },
    });

    this.logger.log(`User ${id} (${user.email}) updated by admin`);
    return user;
  }

  // ─── Support / Contacts ──────────────────────────────────────
  async listContacts(query?: { status?: string; limit?: number; offset?: number }) {
    const where: any = {};
    if (query?.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.contactSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query?.limit || 50,
        skip: query?.offset || 0,
      }),
      this.prisma.contactSubmission.count({ where }),
    ]);

    return { data, total };
  }

  async updateContact(id: string, dto: { status?: string; reply?: string }) {
    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.reply) {
      data.reply = dto.reply;
      data.repliedAt = new Date();
      data.status = 'REPLIED';
    }

    return this.prisma.contactSubmission.update({ where: { id }, data });
  }

  // ─── Payments & Subscriptions ────────────────────────────────
  async listPayments(query?: { limit?: number; offset?: number }) {
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        orderBy: { paidAt: 'desc' },
        take: query?.limit || 50,
        skip: query?.offset || 0,
        include: {
          subscription: {
            select: { tenant: { select: { id: true, name: true } }, plan: true },
          },
        },
      }),
      this.prisma.payment.count(),
    ]);

    // Revenue summary
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalRevenue, monthRevenue] = await Promise.all([
      this.prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: 'COMPLETED', paidAt: { gte: startOfMonth } }, _sum: { amount: true } }),
    ]);

    return {
      data, total,
      summary: {
        totalRevenue: totalRevenue._sum.amount || 0,
        monthRevenue: monthRevenue._sum.amount || 0,
      },
    };
  }

  async createPayment(dto: {
    tenantId: string;
    amount: number;
    currency?: string;
    method?: string;
    referenceId?: string;
    notes?: string;
  }) {
    // Ensure subscription exists
    let subscription = await this.prisma.subscription.findUnique({ where: { tenantId: dto.tenantId } });
    if (!subscription) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
      if (!tenant) throw new NotFoundException('Tenant not found');
      subscription = await this.prisma.subscription.create({
        data: { tenantId: dto.tenantId, plan: tenant.plan, status: 'ACTIVE' },
      });
    }

    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        amount: dto.amount,
        currency: dto.currency || 'INR',
        method: dto.method || 'MANUAL',
        referenceId: dto.referenceId,
        notes: dto.notes,
      },
    });

    this.logger.log(`Payment recorded: ₹${dto.amount} for tenant ${dto.tenantId}`);
    return payment;
  }

  async updateSubscription(tenantId: string, dto: {
    plan?: string; status?: string; mrr?: number; endDate?: string;
    billingCycle?: string; discountPercent?: number; discountNote?: string;
    customPrice?: number; trialEndsAt?: string; notes?: string;
  }) {
    const data: any = {};
    if (dto.plan) data.plan = dto.plan;
    if (dto.status) data.status = dto.status;
    if (dto.mrr !== undefined) data.mrr = dto.mrr;
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.billingCycle) data.billingCycle = dto.billingCycle;
    if (dto.discountPercent !== undefined) data.discountPercent = dto.discountPercent;
    if (dto.discountNote !== undefined) data.discountNote = dto.discountNote;
    if (dto.customPrice !== undefined) data.customPrice = dto.customPrice;
    if (dto.trialEndsAt) data.trialEndsAt = new Date(dto.trialEndsAt);
    if (dto.notes !== undefined) data.notes = dto.notes;

    // Also sync tenant plan if changed
    if (dto.plan) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plan: dto.plan as any },
      });
    }

    const sub = await this.prisma.subscription.upsert({
      where: { tenantId },
      update: data,
      create: {
        tenantId,
        plan: (dto.plan as any) || 'STARTER',
        status: dto.status || 'ACTIVE',
        mrr: dto.mrr || dto.customPrice,
        billingCycle: dto.billingCycle || 'MONTHLY',
        discountPercent: dto.discountPercent || 0,
        discountNote: dto.discountNote,
        customPrice: dto.customPrice,
        notes: dto.notes,
      },
    });

    this.logger.log(`Subscription updated for tenant ${tenantId}: ${JSON.stringify(dto)}`);
    return sub;
  }

  // ─── Audit Logs (Platform-wide) ──────────────────────────────
  async listAuditLogs(query?: { limit?: number; offset?: number; module?: string }) {
    const where: any = {};
    if (query?.module) where.module = query.module;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query?.limit || 50,
        skip: query?.offset || 0,
        include: {
          actor: { select: { email: true, firstName: true, lastName: true } },
          tenant: { select: { name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }

  // ─── System Health ───────────────────────────────────────────
  async getSystemHealth() {
    const dbCheck = await this.prisma.$queryRaw`SELECT 1 AS ok`;
    const dbSize = await this.prisma.$queryRaw<any[]>`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS size
    `;

    return {
      status: 'healthy',
      database: {
        connected: true,
        size: dbSize[0]?.size || 'unknown',
      },
      uptime: process.uptime(),
      nodeVersion: process.version,
      memoryUsage: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      },
      environment: process.env.NODE_ENV,
    };
  }
}
