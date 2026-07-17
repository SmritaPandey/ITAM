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
    // Active Directory / LDAP sync
    'adSync',
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
      starter: { priceUSD: 0, priceINR: 0, discountPercent: 0, features: ["IT Asset Tracking", "Up to 5 assets", "4 Users", "Basic Reports", "Email Support", "Community Access"] },
      professional: { priceUSD: 199, priceINR: 16999, discountPercent: 50, features: ["Core Platform Modules", "Unlimited assets", "Unlimited Users", "Vulnerability Scanning", "ITSM + SLA Engine", "Priority Support", "API Access"] },
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

  async requestUpgrade(
    tenantId: string,
    plan: string,
    billingCycle?: string,
    currency?: string,
    providerPreference?: string,
  ) {
    const validPlans = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
    if (!validPlans.includes(plan)) throw new NotFoundException('Invalid plan');

    const cycle = billingCycle || 'MONTHLY';
    const cycleDiscounts: Record<string, number> = { MONTHLY: 0, QUARTERLY: 10, ANNUAL: 20, CUSTOM: 0 };
    const cycleDiscount = cycleDiscounts[cycle] || 0;

    // NOTE: Do NOT update tenant.plan here — the plan change should only be
    // finalized after payment confirmation via the payment webhook handler.
    // This method creates a *pending* upgrade request, not an immediate switch.

    const pricing = await this.getPricingSettings();
    const currencyCode = (currency || 'INR').toUpperCase();
    const isUSD = currencyCode === 'USD';

    const getPlanPrice = (pName: string) => {
      const p = pName.toLowerCase();
      const disc = pricing[p]?.discountPercent || 0;
      const base = isUSD ? (pricing[p]?.priceUSD || 0) : (pricing[p]?.priceINR || 0);
      return Math.round(base * (1 - disc / 100));
    };

    const effectiveMrr = getPlanPrice(plan) * (1 - cycleDiscount / 100);
    const monthsPerCycle: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12, CUSTOM: 1 };
    const chargeAmount = Math.round(effectiveMrr * (monthsPerCycle[cycle] || 1));

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

    const result: Record<string, any> = {
      success: true,
      plan,
      billingCycle: cycle,
      mrr: effectiveMrr,
      // Upgrade is pending — actual plan activation happens after payment confirmation
      status: 'PENDING_UPGRADE',
      message: `Upgrade to ${plan} (${cycle}) is pending payment confirmation${cycleDiscount > 0 ? ` — ${cycleDiscount}% billing discount will be applied` : ''}. Your plan will be activated once payment is verified.`,
      checkoutUrl: null as string | null,
      orderId: null as string | null,
      provider: null as string | null,
    };

    if (chargeAmount > 0) {
      const checkout = await this.createCheckoutSession({
        tenantId,
        plan,
        cycle,
        amount: chargeAmount,
        currency: currencyCode,
        providerPreference,
      });
      Object.assign(result, checkout);
      if (checkout.checkoutUrl || checkout.orderId) {
        result.message = `Upgrade to ${plan} (${cycle}) — complete payment to activate your plan.`;
      }
    }

    return result;
  }

  /**
   * Create Stripe Checkout Session or Razorpay Order when payment env keys are configured.
   * Prefers Stripe when both are available unless providerPreference is set.
   */
  private async createCheckoutSession(opts: {
    tenantId: string;
    plan: string;
    cycle: string;
    amount: number;
    currency: string;
    providerPreference?: string;
  }): Promise<{ checkoutUrl: string | null; orderId: string | null; provider: string | null; razorpayKeyId?: string }> {
    const preferred = (opts.providerPreference || '').toLowerCase();
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    const hasStripe = !!stripeKey;
    const hasRazorpay = !!(razorpayKeyId && razorpayKeySecret);

    let useProvider: 'stripe' | 'razorpay' | null = null;
    if (preferred === 'stripe' && hasStripe) useProvider = 'stripe';
    else if ((preferred === 'razorpay' || preferred === 'payg') && hasRazorpay) useProvider = 'razorpay';
    else if (hasStripe) useProvider = 'stripe';
    else if (hasRazorpay) useProvider = 'razorpay';

    if (!useProvider) {
      return { checkoutUrl: null, orderId: null, provider: null };
    }

    const appUrl = (process.env.APP_URL || 'http://localhost:3100').replace(/\/$/, '');
    const amountMinor = Math.round(opts.amount * 100); // cents / paise

    try {
      if (useProvider === 'stripe') {
        const StripeMod = await import('stripe');
        const Stripe = (StripeMod as any).default || StripeMod;
        const stripe = new Stripe(stripeKey!);
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          success_url: `${appUrl}/dashboard/settings?section=billing&upgrade=success`,
          cancel_url: `${appUrl}/dashboard/settings?section=billing&upgrade=cancelled`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: opts.currency.toLowerCase(),
                unit_amount: amountMinor,
                product_data: {
                  name: `QS Assets ${opts.plan} (${opts.cycle})`,
                  description: `Plan upgrade to ${opts.plan} — ${opts.cycle} billing`,
                },
              },
            },
          ],
          metadata: {
            tenantId: opts.tenantId,
            plan: opts.plan,
            billingCycle: opts.cycle,
          },
          payment_intent_data: {
            metadata: {
              tenantId: opts.tenantId,
              plan: opts.plan,
              billingCycle: opts.cycle,
            },
          },
        });

        return {
          checkoutUrl: session.url,
          orderId: session.id,
          provider: 'stripe',
        };
      }

      // Razorpay order
      const RazorpayMod = await import('razorpay');
      const Razorpay = (RazorpayMod as any).default || RazorpayMod;
      const razorpay = new Razorpay({ key_id: razorpayKeyId!, key_secret: razorpayKeySecret! });
      const order = await razorpay.orders.create({
        amount: amountMinor,
        currency: opts.currency.toUpperCase(),
        receipt: `upgrade_${opts.tenantId.slice(0, 8)}_${Date.now()}`.slice(0, 40),
        notes: {
          tenantId: opts.tenantId,
          plan: opts.plan,
          billingCycle: opts.cycle,
        },
      });

      return {
        checkoutUrl: null,
        orderId: order.id,
        provider: 'razorpay',
        razorpayKeyId: razorpayKeyId!,
      };
    } catch (err) {
      // Keep PENDING_UPGRADE even if payment provider call fails
      console.error(`[Settings] Failed to create ${useProvider} checkout:`, err);
      return { checkoutUrl: null, orderId: null, provider: useProvider };
    }
  }
}
