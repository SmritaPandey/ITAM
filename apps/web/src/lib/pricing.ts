/** Shared pricing fallbacks — keep in sync with API settings defaults + PLAN_LIMITS.STARTER. */
export interface PlanConfig {
  priceUSD: number;
  priceINR: number;
  discountPercent: number;
  features: string[];
}

export const FALLBACK_PRICING: Record<string, PlanConfig> = {
  starter: {
    priceUSD: 0,
    priceINR: 0,
    discountPercent: 0,
    features: ["IT Asset Tracking", "Up to 5 assets", "4 Users", "Basic Reports", "Email Support", "Community Access"],
  },
  professional: {
    priceUSD: 199,
    priceINR: 16999,
    discountPercent: 50,
    features: ["Core Platform Modules", "Unlimited assets", "Unlimited Users", "Vulnerability Scanning", "ITSM + SLA Engine", "Priority Support", "API Access"],
  },
  enterprise: {
    priceUSD: 499,
    priceINR: 39999,
    discountPercent: 50,
    features: ["Everything in Pro", "On-Premise Deploy", "SSO / SAML / LDAP", "Dedicated Support", "Custom SLA"],
  },
  custom: {
    priceUSD: -1,
    priceINR: -1,
    discountPercent: 0,
    features: ["Everything in Enterprise", "Custom asset limits", "Negotiated pricing", "Dedicated account manager", "Custom SLA", "Priority onboarding"],
  },
};

export const PLAN_CARDS = [
  { id: "starter" as const, name: "Starter", desc: "Up to 5 assets", popular: false, cta: "Get Started Free" },
  { id: "professional" as const, name: "Professional", desc: "Unlimited assets", popular: true, cta: "Start Free Trial" },
  { id: "enterprise" as const, name: "Enterprise", desc: "On-premise + SaaS", popular: false, cta: "Start Scaling" },
  { id: "custom" as const, name: "Custom", desc: "Tailored SLA models", popular: false, cta: "Talk to Sales" },
];

/** Current selling price for JSON-LD (applies promo when configured). */
export function offerPriceINR(plan: keyof typeof FALLBACK_PRICING): string {
  const c = FALLBACK_PRICING[plan];
  if (c.priceINR <= 0) return "0";
  const final = Math.round(c.priceINR * (1 - (c.discountPercent || 0) / 100));
  return String(final);
}

export const LANDING_FAQS = [
  {
    q: "Can the agent run on major operating systems?",
    a: "Yes. The QS Discovery Agent runs on Windows (Service), macOS (LaunchDaemon), and Linux (systemd). It starts on boot and reports inventory and telemetry in the background.",
  },
  {
    q: "Does the platform work without installing agents?",
    a: "Yes. Agentless discovery uses SNMP, SSH, WMI, and nmap to find and profile network devices without installing software on them.",
  },
  {
    q: "How is data secured?",
    a: "Agent traffic uses TLS-protected channels. Tenants get RBAC, MFA/SSO options, Postgres row-level isolation, and activity trails. QS Assets operates under SOC 2 security controls and DPDP Act 2023-oriented practices. See qsasset.com/security.",
  },
  {
    q: "Can I deploy on-premise?",
    a: "Yes. QS Assets supports Docker Compose-style self-hosting on infrastructure that can run PostgreSQL and Node.js.",
  },
  {
    q: "How does threat detection work?",
    a: "Where agents are installed, the platform can surface USB insertions, open-port changes, file integrity changes, and unexpected software. Anomalies can raise alerts and feed automation rules.",
  },
];
