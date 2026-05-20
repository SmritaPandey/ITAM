import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { getResolvedModules, getActiveModules } from '../../common/utils/modules';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, domain: true, plan: true, settings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const settingsObj = typeof tenant.settings === 'object' ? (tenant.settings as Record<string, any>) : {};
    const allowedModules = getResolvedModules(tenant.plan, tenant.settings);
    const activeModules = getActiveModules(tenant.plan, tenant.settings);

    return {
      tenantId: tenant.id,
      orgName: tenant.name,
      domain: tenant.domain,
      plan: tenant.plan,
      allowedModules,
      activeModules,
      ...settingsObj,
    };
  }

  async updateSettings(tenantId: string, data: Record<string, any>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Merge with existing settings
    const existing = typeof tenant.settings === 'object' ? (tenant.settings as Record<string, any>) : {};
    const merged = { ...existing, ...data };

    // Update org-level fields if provided
    const update: any = { settings: merged };
    if (data.orgName) update.name = data.orgName;
    if (data.domain) update.domain = data.domain;

    const result = await this.prisma.tenant.update({ where: { id: tenantId }, data: update });
    const settingsObj = typeof result.settings === 'object' ? (result.settings as Record<string, any>) : {};
    const allowedModules = getResolvedModules(result.plan, result.settings);
    const activeModules = getActiveModules(result.plan, result.settings);

    return {
      tenantId: result.id,
      orgName: result.name,
      domain: result.domain,
      plan: result.plan,
      allowedModules,
      activeModules,
      ...settingsObj,
    };
  }

  async getSites(tenantId: string) {
    return this.prisma.site.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async getDepartments(tenantId: string) {
    return this.prisma.department.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  // ─── Account & Billing ─────────────────────────────────────────

  private readonly PLAN_LIMITS: Record<string, { assets: number; users: number; modules: number; price: number }> = {
    STARTER: { assets: 100, users: 5, modules: 4, price: 0 },
    PROFESSIONAL: { assets: -1, users: 50, modules: 12, price: 4999 },
    ENTERPRISE: { assets: -1, users: -1, modules: 12, price: 14999 },
  };

  async getAccount(tenantId: string) {
    const [tenant, userCount, assetCount, siteCount, departmentCount] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, domain: true, plan: true, status: true, createdAt: true },
      }),
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.asset.count({ where: { tenantId } }),
      this.prisma.site.count({ where: { tenantId } }),
      this.prisma.department.count({ where: { tenantId } }),
    ]);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const limits = this.PLAN_LIMITS[tenant.plan] || this.PLAN_LIMITS.STARTER;
    return {
      ...tenant,
      usage: {
        users: { current: userCount, limit: limits.users, unlimited: limits.users === -1 },
        assets: { current: assetCount, limit: limits.assets, unlimited: limits.assets === -1 },
        sites: siteCount,
        departments: departmentCount,
      },
      planLimits: limits,
    };
  }

  async getSubscription(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plan: true, createdAt: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
    });

    const limits = this.PLAN_LIMITS[tenant.plan] || this.PLAN_LIMITS.STARTER;
    const discountPct = subscription?.discountPercent ? Number(subscription.discountPercent) : 0;
    const effectivePrice = subscription?.customPrice
      ? Number(subscription.customPrice)
      : limits.price * (1 - discountPct / 100);

    return {
      currentPlan: tenant.plan,
      limits,
      subscription: subscription ? {
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        billingCycle: subscription.billingCycle || (tenant.plan === 'STARTER' ? 'FREE' : 'MONTHLY'),
        mrr: effectivePrice,
        discountPercent: discountPct,
        discountNote: subscription.discountNote,
        customPrice: subscription.customPrice ? Number(subscription.customPrice) : null,
        trialEndsAt: subscription.trialEndsAt,
      } : {
        status: 'ACTIVE',
        startDate: tenant.createdAt,
        endDate: null,
        billingCycle: tenant.plan === 'STARTER' ? 'FREE' : 'MONTHLY',
        mrr: limits.price,
        discountPercent: 0,
        discountNote: null,
        customPrice: null,
        trialEndsAt: null,
      },
      billingCycles: [
        { value: 'MONTHLY', label: 'Monthly', discount: 0 },
        { value: 'QUARTERLY', label: 'Quarterly', discount: 10 },
        { value: 'ANNUAL', label: 'Annual', discount: 20 },
        { value: 'CUSTOM', label: 'Custom (Contact Sales)', discount: 0 },
      ],
      plans: [
        {
          name: 'STARTER', displayName: 'Starter',
          priceUSD: 0, priceINR: 0,
          discountedUSD: 0, discountedINR: 0,
          billingLabelUSD: 'Free forever', billingLabelINR: 'Free forever',
          features: ['Up to 100 assets', '5 users', '4 core modules', 'Community support', 'Basic reports'],
        },
        {
          name: 'PROFESSIONAL', displayName: 'Professional',
          priceUSD: 199, priceINR: 16999,
          discountedUSD: 99, discountedINR: 7999,
          billingLabelUSD: '$199/mo', billingLabelINR: '₹16,999/mo',
          features: ['Unlimited assets', '50 users', 'All 12 modules', 'Priority support', 'Advanced reports', 'API access', 'Custom integrations'],
          popular: true,
        },
        {
          name: 'ENTERPRISE', displayName: 'Enterprise',
          priceUSD: 499, priceINR: 39999,
          discountedUSD: 249, discountedINR: 19999,
          billingLabelUSD: '$499/mo', billingLabelINR: '₹39,999/mo',
          features: ['Unlimited everything', 'Unlimited users', 'All 12 modules', 'Dedicated support', 'On-premise option', 'SLA guarantee', 'Custom development', 'SSO & SAML'],
        },
        {
          name: 'CUSTOM', displayName: 'Custom',
          priceUSD: -1, priceINR: -1,
          discountedUSD: -1, discountedINR: -1,
          billingLabelUSD: 'Contact Sales', billingLabelINR: 'Contact Sales',
          features: ['Everything in Enterprise', 'Custom asset limits', 'Negotiated pricing', 'Dedicated account manager', 'Custom SLA', 'White-label option', 'Priority onboarding'],
          contactSales: true,
        },
      ],
    };
  }

  async getInvoices(tenantId: string) {
    // Payments are linked via subscription, not directly to tenant
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
    });
    if (!subscription) return [];

    return this.prisma.payment.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { paidAt: 'desc' },
      take: 50,
    });
  }

  async requestUpgrade(tenantId: string, plan: string, billingCycle?: string, currency?: string) {
    const validPlans = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
    if (!validPlans.includes(plan)) throw new NotFoundException('Invalid plan');

    const cycle = billingCycle || 'MONTHLY';
    const cycleDiscounts: Record<string, number> = { MONTHLY: 0, QUARTERLY: 10, ANNUAL: 20, CUSTOM: 0 };
    const cycleDiscount = cycleDiscounts[cycle] || 0;

    // Update the tenant plan
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: plan as any },
    });

    // Calculate effective MRR with billing cycle discount and dynamic currency selection
    const isUSD = (currency || 'INR').toUpperCase() === 'USD';
    const usdPrices: Record<string, number> = { STARTER: 0, PROFESSIONAL: 99, ENTERPRISE: 249 };
    const inrPrices: Record<string, number> = { STARTER: 0, PROFESSIONAL: 7999, ENTERPRISE: 19999 };

    const baseMrr = isUSD ? usdPrices[plan] : inrPrices[plan];
    const effectiveMrr = baseMrr * (1 - cycleDiscount / 100);
    const existing = await this.prisma.subscription.findFirst({ where: { tenantId } });

    if (existing) {
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan: plan as any,
          status: 'ACTIVE',
          billingCycle: cycle,
          mrr: effectiveMrr,
        },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          tenantId,
          plan: plan as any,
          status: 'ACTIVE',
          billingCycle: cycle,
          startDate: new Date(),
          mrr: effectiveMrr,
        },
      });
    }

    return {
      success: true, plan, billingCycle: cycle,
      mrr: effectiveMrr,
      message: `Plan updated to ${plan} (${cycle})${cycleDiscount > 0 ? ` — ${cycleDiscount}% billing discount applied` : ''}`,
    };
  }
}
