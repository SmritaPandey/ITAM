import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { PLAN_LIMITS } from '../../common/constants/plan-limits';

/**
 * Tenant usage metering — enforces plan limits for SaaS billing.
 */
@Injectable()
export class TenantMeteringService {
  private readonly logger = new Logger(TenantMeteringService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get current usage stats for a tenant
   */
  async getUsage(tenantId: string) {
    const [tenant, assetCount, userCount, scanCount] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.asset.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
      this.getMonthlyScans(tenantId),
    ]);

    if (!tenant) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);

    const limits = this.getPlanLimits(tenant.plan);
    const settings = (tenant.settings as any) || {};

    const effectiveLimits = this.getEffectiveLimits(tenant);

    return {
      plan: tenant.plan,
      status: tenant.status,
      usage: {
        assets: { current: assetCount, limit: effectiveLimits.maxAssets, percent: Math.round((assetCount / effectiveLimits.maxAssets) * 100) },
        users: { current: userCount, limit: effectiveLimits.maxUsers, percent: Math.round((userCount / effectiveLimits.maxUsers) * 100) },
        scansThisMonth: { current: scanCount, limit: effectiveLimits.maxScansPerMonth, percent: Math.round((scanCount / effectiveLimits.maxScansPerMonth) * 100) },
      },
    };
  }

  /**
   * Check if tenant can create more assets (enforce plan limit)
   */
  async checkAssetLimit(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
    if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
      throw new HttpException('Account is suspended. Please update your billing.', HttpStatus.PAYMENT_REQUIRED);
    }

    const limits = this.getEffectiveLimits(tenant);
    const count = await this.prisma.asset.count({ where: { tenantId, deletedAt: null } });

    if (count >= limits.maxAssets) {
      throw new HttpException(
        `Asset limit reached (${count}/${limits.maxAssets}). Upgrade your plan to add more assets.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /**
   * Check if tenant can create more users
   */
  async checkUserLimit(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);

    const limits = this.getEffectiveLimits(tenant);
    const count = await this.prisma.user.count({ where: { tenantId, deletedAt: null } });

    if (count >= limits.maxUsers) {
      throw new HttpException(
        `User limit reached (${count}/${limits.maxUsers}). Upgrade your plan to add more users.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /**
   * Check if tenant can run more scans this month
   */
  async checkScanLimit(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);

    const limits = this.getEffectiveLimits(tenant);
    const scans = await this.getMonthlyScans(tenantId);

    if (scans >= limits.maxScansPerMonth) {
      throw new HttpException(
        `Monthly scan limit reached (${scans}/${limits.maxScansPerMonth}). Upgrade to Professional for unlimited scans.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private getPlanLimits(plan: string) {
    return PLAN_LIMITS[plan] || PLAN_LIMITS.STARTER;
  }

  private getEffectiveLimits(tenant: any) {
    const base = this.getPlanLimits(tenant.plan);
    const settings = (tenant.settings as any) || {};
    return {
      maxAssets: Math.max(settings.maxAssets || 0, base.maxAssets),
      maxUsers: Math.max(settings.maxUsers || 0, base.maxUsers),
      maxScansPerMonth: Math.max(settings.maxScansPerMonth || 0, base.maxScansPerMonth),
    };
  }

  private async getMonthlyScans(tenantId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.prisma.scanJob.count({
      where: { tenantId, createdAt: { gte: startOfMonth } },
    });
  }
}
