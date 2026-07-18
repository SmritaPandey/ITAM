import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
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
  async createTenant(dto: {
    name: string;
    plan?: string;
    adminEmail: string;
    adminPassword?: string;
    adminFullName?: string;
    customAllowedModules?: string[];
    customBlockedModules?: string[];
  }) {
    const email = dto.adminEmail.toLowerCase().trim();
    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this admin email already exists');
    }

    const slugBase = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40) || 'tenant';
    const slugExists = await this.prisma.tenant.findFirst({
      where: { slug: { startsWith: slugBase } },
    });
    const slug = slugExists ? `${slugBase}-${Date.now().toString(36)}` : slugBase;
    const plan = (dto.plan || 'STARTER') as any;
    const password = dto.adminPassword || `Welcome-${Math.random().toString(36).slice(2, 10)}!`;
    const [firstName, ...rest] = (dto.adminFullName || 'Tenant Admin').trim().split(' ');
    const lastName = rest.join(' ') || 'Admin';
    const passwordHash = await bcrypt.hash(password, 12);

    const settings: Record<string, any> = {};
    if (dto.customAllowedModules) settings.customAllowedModules = dto.customAllowedModules;
    if (dto.customBlockedModules) settings.customBlockedModules = dto.customBlockedModules;

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          plan,
          status: 'ACTIVE',
          settings,
        },
      });

      await tx.site.create({
        data: { tenantId: tenant.id, name: 'Headquarters', isHq: true },
      });
      await tx.department.create({
        data: { tenantId: tenant.id, name: 'IT Department' },
      });

      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Tenant Admin',
          description: 'Full administrative access',
          permissions: ['*'],
          isSystem: true,
        },
      });
      await tx.role.createMany({
        data: [
          {
            tenantId: tenant.id,
            name: 'IT Admin',
            description: 'IT operations',
            permissions: ['assets:read', 'assets:write', 'tickets:read', 'tickets:write', 'scanning:execute'],
            isSystem: true,
          },
          {
            tenantId: tenant.id,
            name: 'Staff',
            description: 'Staff',
            permissions: ['assets:read', 'tickets:read', 'tickets:write'],
            isSystem: true,
          },
          {
            tenantId: tenant.id,
            name: 'Employee',
            description: 'Employee',
            permissions: ['assets:read', 'tickets:read', 'tickets:write'],
            isSystem: true,
          },
        ],
      });

      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
          firstName: firstName || 'Admin',
          lastName,
          roleId: adminRole.id,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });

      await tx.assetType.createMany({
        data: [
          { tenantId: tenant.id, name: 'Laptop', isItAsset: true, icon: 'laptop', color: '#6366f1' },
          { tenantId: tenant.id, name: 'Desktop', isItAsset: true, icon: 'monitor', color: '#3b82f6' },
          { tenantId: tenant.id, name: 'Server', isItAsset: true, icon: 'server', color: '#8b5cf6' },
          { tenantId: tenant.id, name: 'Network Device', isItAsset: true, icon: 'router', color: '#0ea5e9' },
          { tenantId: tenant.id, name: 'Printer', isItAsset: true, icon: 'printer', color: '#a855f7' },
          { tenantId: tenant.id, name: 'Furniture', isItAsset: false, icon: 'armchair', color: '#f97316' },
          { tenantId: tenant.id, name: 'Vehicle', isItAsset: false, icon: 'car', color: '#10b981' },
        ],
      });

      await tx.subscription.upsert({
        where: { tenantId: tenant.id },
        update: { plan, status: 'ACTIVE' },
        create: { tenantId: tenant.id, plan, status: 'ACTIVE' },
      });

      return { tenant, admin, temporaryPassword: dto.adminPassword ? undefined : password };
    });

    this.logger.log(`Admin created tenant ${result.tenant.id} (${result.tenant.name})`);
    return {
      tenant: result.tenant,
      admin: { id: result.admin.id, email: result.admin.email },
      temporaryPassword: result.temporaryPassword,
      message: result.temporaryPassword
        ? 'Tenant created. Share the temporary password with the Tenant Admin securely.'
        : 'Tenant created.',
    };
  }

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

  async updateTenant(id: string, dto: {
    plan?: string;
    status?: string;
    settings?: any;
    customAllowedModules?: string[];
    customBlockedModules?: string[];
  }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existingSettings = typeof tenant.settings === 'object' ? (tenant.settings as Record<string, any>) : {};
    const newSettings = {
      ...existingSettings,
      ...(dto.settings || {}),
    };

    if (dto.customAllowedModules !== undefined) {
      newSettings.customAllowedModules = dto.customAllowedModules;
    }
    if (dto.customBlockedModules !== undefined) {
      newSettings.customBlockedModules = dto.customBlockedModules;
    }

    const data: any = { settings: newSettings };
    if (dto.plan) data.plan = dto.plan;
    if (dto.status) data.status = dto.status;

    const updated = await this.prisma.tenant.update({ where: { id }, data });

    // Also update subscription plan if plan changed
    if (dto.plan) {
      await this.prisma.subscription.upsert({
        where: { tenantId: id },
        update: { plan: dto.plan as any },
        create: { tenantId: id, plan: dto.plan as any, status: 'ACTIVE' },
      });
    }

    this.logger.log(`Tenant ${id} updated: ${JSON.stringify(dto)}`);
    return updated;
  }

  async deleteTenant(id: string) {
    await this.prisma.tenant.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Deactivate all users belonging to this tenant
    const { count: deactivatedUsers } = await this.prisma.user.updateMany({
      where: { tenantId: id, status: 'ACTIVE' },
      data: { status: 'INACTIVE' },
    });

    this.logger.warn(
      `Tenant ${id} soft-deleted (status → CANCELLED). Deactivated ${deactivatedUsers} user(s).`,
    );
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
    const [totalGrouped, monthGrouped] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['currency'],
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['currency'],
        where: { status: 'COMPLETED', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue: Record<string, number> = {};
    const monthRevenue: Record<string, number> = {};

    totalGrouped.forEach(item => {
      totalRevenue[item.currency] = item._sum.amount ? Number(item._sum.amount) : 0;
    });

    monthGrouped.forEach(item => {
      monthRevenue[item.currency] = item._sum.amount ? Number(item._sum.amount) : 0;
    });

    return {
      data, total,
      summary: {
        totalRevenue,
        monthRevenue,
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

  // ─── Telemetry Logs (Platform-wide) ──────────────────────────
  async listTelemetry(query?: { limit?: number; offset?: number; search?: string }) {
    const where: any = {};
    if (query?.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { ipAddress: { contains: query.search, mode: 'insensitive' } },
        { path: { contains: query.search, mode: 'insensitive' } },
        { country: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.userTelemetry.findMany({
        where,
        orderBy: { trackedAt: 'desc' },
        take: query?.limit || 50,
        skip: query?.offset || 0,
      }),
      this.prisma.userTelemetry.count({ where }),
    ]);

    return { data, total };
  }

  // ─── System Health ───────────────────────────────────────────
  async getSystemHealth() {
    const dbCheck = await this.prisma.$queryRaw`SELECT 1 AS ok`;
    const dbSize = await this.prisma.$queryRaw<any[]>`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS size
    `;
    const [agentCount, enrollmentActive, enrollmentRevoked, productLicenses] = await Promise.all([
      this.prisma.agent.count(),
      this.prisma.agentEnrollment.count({ where: { revokedAt: null } }),
      this.prisma.agentEnrollment.count({ where: { revokedAt: { not: null } } }),
      this.prisma.productLicense.count(),
    ]);

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
      deployment: {
        mode: process.env.DEPLOYMENT_MODE || 'saas',
        processRole: process.env.PROCESS_ROLE || 'all',
        version: process.env.PLATFORM_VERSION || process.env.npm_package_version || 'unknown',
      },
      fleet: {
        agents: agentCount,
        enrollmentsActive: enrollmentActive,
        enrollmentsRevoked: enrollmentRevoked,
        productLicenses,
      },
      operationalReadiness: {
        redis: Boolean(process.env.REDIS_URL),
        vaultEncryption: Boolean(process.env.VAULT_ENCRYPTION_KEY),
        licenseSigning: Boolean(process.env.LICENSE_PRIVATE_KEY && process.env.LICENSE_PUBLIC_KEY),
        platformUpdateSigning: Boolean(
          process.env.PLATFORM_UPDATE_PRIVATE_KEY && process.env.PLATFORM_UPDATE_PUBLIC_KEY,
        ),
        agentUpdateSigning: Boolean(
          process.env.AGENT_UPDATE_PRIVATE_KEY && process.env.AGENT_UPDATE_PUBLIC_KEY,
        ),
        smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
        oidcOrSaml: Boolean(
          process.env.OIDC_CLIENT_ID ||
            process.env.SAML_ENTRY_POINT ||
            process.env.GOOGLE_CLIENT_ID ||
            process.env.MICROSOFT_CLIENT_ID,
        ),
      },
    };
  }

  async listAgentEnrollments(query?: { limit?: number; offset?: number; tenantId?: string }) {
    const where: any = {};
    if (query?.tenantId) where.tenantId = query.tenantId;
    const [data, total] = await Promise.all([
      this.prisma.agentEnrollment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query?.limit || 50,
        skip: query?.offset || 0,
        select: {
          id: true,
          tenantId: true,
          tokenJti: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
          tenant: { select: { id: true, name: true, slug: true } },
          agent: {
            select: {
              id: true,
              hostname: true,
              status: true,
              lastHeartbeat: true,
              ipAddress: true,
            },
          },
        },
      }),
      this.prisma.agentEnrollment.count({ where }),
    ]);
    return { data, total };
  }

  async revokeAgentEnrollment(id: string) {
    const row = await this.prisma.agentEnrollment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Enrollment not found');
    if (row.revokedAt) return row;
    return this.prisma.agentEnrollment.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Dynamic Pricing Config ──────────────────────────────────
  async getPricingConfig() {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'pricing_settings' }
    });
    return config?.value || null;
  }

  async updatePricingConfig(data: any) {
    const config = await this.prisma.systemConfig.upsert({
      where: { key: 'pricing_settings' },
      update: { value: data },
      create: { key: 'pricing_settings', value: data },
    });
    return config.value;
  }
}
