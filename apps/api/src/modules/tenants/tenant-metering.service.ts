import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { PLAN_LIMITS } from '../../common/constants/plan-limits';
import { ProductLicenseService } from '../product-license/product-license.service';
import { isOnPrem } from '../../common/deployment-mode';

/**
 * Tenant usage metering — enforces plan limits for SaaS billing + on-prem entitlements.
 */
@Injectable()
export class TenantMeteringService {
  private readonly logger = new Logger(TenantMeteringService.name);

  constructor(
    private prisma: PrismaService,
    private productLicense: ProductLicenseService,
  ) {}

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

    const effectiveLimits = await this.getEffectiveLimits(tenant);
    const maxA = effectiveLimits.maxAssets === Infinity ? -1 : effectiveLimits.maxAssets;
    const maxU = effectiveLimits.maxUsers === Infinity ? -1 : effectiveLimits.maxUsers;
    const maxS = effectiveLimits.maxScansPerMonth === Infinity ? -1 : effectiveLimits.maxScansPerMonth;

    return {
      plan: tenant.plan,
      status: tenant.status,
      usage: {
        assets: {
          current: assetCount,
          limit: maxA,
          percent: maxA < 0 ? 0 : Math.round((assetCount / maxA) * 100),
        },
        users: {
          current: userCount,
          limit: maxU,
          percent: maxU < 0 ? 0 : Math.round((userCount / maxU) * 100),
        },
        scansThisMonth: {
          current: scanCount,
          limit: maxS,
          percent: maxS < 0 ? 0 : Math.round((scanCount / maxS) * 100),
        },
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

    await this.productLicense.assertOperationalLicense();

    const limits = await this.getEffectiveLimits(tenant);
    if (limits.maxAssets === Infinity || limits.maxAssets < 0) return;
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

    await this.productLicense.assertOperationalLicense();

    const limits = await this.getEffectiveLimits(tenant);
    if (limits.maxUsers === Infinity || limits.maxUsers < 0) return;
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

    await this.productLicense.assertOperationalLicense();

    const limits = await this.getEffectiveLimits(tenant);
    if (limits.maxScansPerMonth === Infinity || limits.maxScansPerMonth < 0) return;
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

  private async getEffectiveLimits(tenant: any) {
    const base = this.getPlanLimits(tenant.plan);
    const settings = (tenant.settings as any) || {};

    let maxAssets = base.maxAssets;
    let maxUsers = base.maxUsers;
    let maxScansPerMonth = base.maxScansPerMonth;

    if (typeof settings.maxAssets === 'number' && settings.maxAssets > 0) {
      maxAssets = Math.max(settings.maxAssets, maxAssets === Infinity ? settings.maxAssets : maxAssets);
    }
    if (typeof settings.maxUsers === 'number' && settings.maxUsers > 0) {
      maxUsers = Math.max(settings.maxUsers, maxUsers === Infinity ? settings.maxUsers : maxUsers);
    }
    if (typeof settings.maxScansPerMonth === 'number' && settings.maxScansPerMonth > 0) {
      maxScansPerMonth = Math.max(
        settings.maxScansPerMonth,
        maxScansPerMonth === Infinity ? settings.maxScansPerMonth : maxScansPerMonth,
      );
    }

    if (isOnPrem()) {
      const ent = await this.productLicense.getEffectiveEntitlement();
      if (ent.missing) {
        maxAssets = 0;
        maxUsers = Math.min(maxUsers === Infinity ? 5 : maxUsers, 5);
        maxScansPerMonth = 0;
      } else {
        if (ent.maxAssets >= 0) maxAssets = ent.maxAssets;
        if (ent.maxUsers >= 0) maxUsers = ent.maxUsers;
        if (ent.expired) {
          maxAssets = 0;
          maxScansPerMonth = 0;
        }
      }
    }

    return { maxAssets, maxUsers, maxScansPerMonth };
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
