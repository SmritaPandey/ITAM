import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { getResolvedModules, getActiveModules } from '../../common/utils/modules';
import { PLAN_LIMITS } from '../../common/constants/plan-limits';

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
      ...settingsObj,
      tenantId: tenant.id,
      orgName: tenant.name,
      domain: tenant.domain,
      plan: tenant.plan,
      allowedModules,
      activeModules,
    };
  }

  // Allowlist of user-modifiable settings keys — reject anything not listed
  private static readonly ALLOWED_SETTINGS_KEYS = new Set([
    'orgName',
    'domain',
    'timezone',
    'dateFormat',
    'currency',
    'language',
    'theme',
    'logoUrl',
    'faviconUrl',
    'supportEmail',
    'supportPhone',
    'notificationPreferences',
    'maintenanceWindow',
    'autoAssignTickets',
    'defaultTicketPriority',
    'enabledModules',
    'assetLabelPrefix',
    'ticketPrefix',
    'slackWebhookUrl',
    'teamsWebhookUrl',
    'emailNotifications',
    'dashboardLayout',
    // Discovery & Scanning settings
    'autoDiscovery',
    'snmpEnabled',
    'agentEnabled',
    'wmiEnabled',
    'agentStartOnBoot',
    'scanInterval',
    'snmpCommunity',
    'agentPort',
    // Notification settings
    'emailAlerts',
    'slackEnabled',
    'webhookUrl',
    // Security settings
    'sessionTimeout',
    'mfaEnforced',
    'passwordExpiry',
    'ipWhitelist',
    // Storage & System settings
    'storageProvider',
    'storagePath',
    'maxUploadLimit',
    'backupPath',
    'backupInterval',
    'retentionDays',
    'scannerConcurrency',
    // Module customization
    'userDisabledModules',
  ]);

  async updateSettings(tenantId: string, data: Record<string, any>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Strip any keys not in the allowlist to prevent arbitrary JSON injection
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (SettingsService.ALLOWED_SETTINGS_KEYS.has(key)) {
        sanitized[key] = data[key];
      }
    }

    // Merge with existing settings
    const existing = typeof tenant.settings === 'object' ? (tenant.settings as Record<string, any>) : {};
    const merged = { ...existing, ...sanitized };

    // Update org-level fields if provided
    const update: any = { settings: merged };
    if (sanitized.orgName) update.name = sanitized.orgName;
    if (sanitized.domain) update.domain = sanitized.domain;

    const result = await this.prisma.tenant.update({ where: { id: tenantId }, data: update });
    const settingsObj = typeof result.settings === 'object' ? (result.settings as Record<string, any>) : {};
    const allowedModules = getResolvedModules(result.plan, result.settings);
    const activeModules = getActiveModules(result.plan, result.settings);

    return {
      ...settingsObj,
      tenantId: result.id,
      orgName: result.name,
      domain: result.domain,
      plan: result.plan,
      allowedModules,
      activeModules,
    };
  }

  async getSites(tenantId: string) {
    return this.prisma.site.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async getDepartments(tenantId: string) {
    return this.prisma.department.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  // ─── Account & Billing ─────────────────────────────────────────

  // UI-facing helper: converts Infinity → -1 for JSON-safe plan limits
  private getUiPlanLimits(plan: string) {
    const base = PLAN_LIMITS[plan] || PLAN_LIMITS.STARTER;
    return {
      assets: base.maxAssets === Infinity ? -1 : base.maxAssets,
      users: base.maxUsers === Infinity ? -1 : base.maxUsers,
      modules: base.modules,
      price: base.price,
    };
  }

  async getPricingSettings() {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'pricing_settings' }
    });
    return (config?.value as any) || {
      starter: { priceUSD: 0, priceINR: 0, discountPercent: 0, features: ["IT Asset Tracking", "4 Users", "Basic Reports", "Email Support", "Community Access"] },
      professional: { priceUSD: 199, priceINR: 16999, discountPercent: 50, features: ["All 12 Modules", "Unlimited Users", "Vulnerability Scanning", "ITSM + SLA Engine", "Priority Support", "API Access"] },
      enterprise: { priceUSD: 499, priceINR: 39999, discountPercent: 50, features: ["Everything in Pro", "On-Premise Deploy", "SSO / SAML / LDAP", "Dedicated CSM", "Custom SLA", "White-Label Option"] },
      custom: { priceUSD: -1, priceINR: -1, discountPercent: 0, features: ["Everything in Enterprise", "Custom asset limits", "Negotiated pricing", "Dedicated account manager", "Custom SLA", "White-label option", "Priority onboarding"] }
    };
  }

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

    const pricing = await this.getPricingSettings();
    const planKey = tenant.plan.toLowerCase();
    const basePrice = pricing[planKey]?.priceINR !== undefined ? pricing[planKey].priceINR : (PLAN_LIMITS[tenant.plan]?.price || 0);

    const limits = {
      ...this.getUiPlanLimits(tenant.plan),
      price: basePrice,
    };

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

    const pricing = await this.getPricingSettings();

    const getBasePrice = (plan: string) => {
      const p = plan.toLowerCase();
      return pricing[p]?.priceINR !== undefined ? pricing[p].priceINR : 0;
    };

    const discountPct = subscription?.discountPercent ? Number(subscription.discountPercent) : 0;
    const basePrice = getBasePrice(tenant.plan);
    const effectivePrice = subscription?.customPrice
      ? Number(subscription.customPrice)
      : basePrice * (1 - discountPct / 100);

    const limits = {
      ...this.getUiPlanLimits(tenant.plan),
      price: basePrice,
    };

    const getPlanObject = (name: string, displayName: string, data: any, popular = false, contactSales = false) => {
      const disc = data.discountPercent || 0;
      const discountedUSD = data.priceUSD > 0 ? Math.round(data.priceUSD * (1 - disc / 100)) : 0;
      const discountedINR = data.priceINR > 0 ? Math.round(data.priceINR * (1 - disc / 100)) : 0;

      return {
        name,
        displayName,
        priceUSD: data.priceUSD,
        priceINR: data.priceINR,
        discountedUSD,
        discountedINR,
        discountPercent: disc,
        billingLabelUSD: data.priceUSD === 0 ? 'Free forever' : data.priceUSD < 0 ? 'Contact Sales' : `$${data.priceUSD}/mo`,
        billingLabelINR: data.priceINR === 0 ? 'Free forever' : data.priceINR < 0 ? 'Contact Sales' : `₹${data.priceINR.toLocaleString('en-IN')}/mo`,
        features: data.features || [],
        popular,
        contactSales,
      };
    };

    const plans = [
      getPlanObject('STARTER', 'Starter', pricing.starter),
      getPlanObject('PROFESSIONAL', 'Professional', pricing.professional, true),
      getPlanObject('ENTERPRISE', 'Enterprise', pricing.enterprise),
      getPlanObject('CUSTOM', 'Custom', pricing.custom, false, true),
    ];

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
        mrr: basePrice,
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
      plans,
    };
  }

  async getInvoices(tenantId: string) {
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

    // NOTE: Do NOT update tenant.plan here — the plan change should only be
    // finalized after payment confirmation via the payment webhook handler.
    // This method creates a *pending* upgrade request, not an immediate switch.

    const pricing = await this.getPricingSettings();
    const isUSD = (currency || 'INR').toUpperCase() === 'USD';

    const getPlanPrice = (pName: string) => {
      const p = pName.toLowerCase();
      const disc = pricing[p]?.discountPercent || 0;
      const base = isUSD ? (pricing[p]?.priceUSD || 0) : (pricing[p]?.priceINR || 0);
      return Math.round(base * (1 - disc / 100));
    };

    const effectiveMrr = getPlanPrice(plan) * (1 - cycleDiscount / 100);
    const existing = await this.prisma.subscription.findFirst({ where: { tenantId } });

    if (existing) {
      // Set status to PENDING_UPGRADE with the *requested* plan — do not activate yet
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan: plan as any,
          status: 'PENDING_UPGRADE',
          billingCycle: cycle,
          mrr: effectiveMrr,
        },
      });
    } else {
      // Create a new subscription in PENDING_UPGRADE state — not ACTIVE
      await this.prisma.subscription.create({
        data: {
          tenantId,
          plan: plan as any,
          status: 'PENDING_UPGRADE',
          billingCycle: cycle,
          startDate: new Date(),
          mrr: effectiveMrr,
        },
      });
    }

    return {
      success: true,
      plan,
      billingCycle: cycle,
      mrr: effectiveMrr,
      // Upgrade is pending — actual plan activation happens after payment confirmation
      status: 'PENDING_UPGRADE',
      message: `Upgrade to ${plan} (${cycle}) is pending payment confirmation${cycleDiscount > 0 ? ` — ${cycleDiscount}% billing discount will be applied` : ''}. Your plan will be activated once payment is verified.`,
    };
  }
}
