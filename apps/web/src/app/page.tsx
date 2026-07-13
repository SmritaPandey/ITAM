"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AssetEstateVisual from "@/components/landing/AssetEstateVisual";
import { useTheme } from "@/components/ThemeProvider";
import {
  Shield, Monitor, Ticket, Package, BarChart3, ChevronRight,
  ArrowRight, CheckCircle2, Camera, Car, Laptop,
  FileText, Check, Search, GitBranch, Cloud, Bell,
  Router, Workflow, Bot, ScanLine, X,
} from "lucide-react";

const MODULES = [
  { icon: Monitor, title: "IT Asset Management", desc: "Lifecycle tracking for laptops, servers, workstations, and peripherals — from procurement to retirement.", color: "#06b6d4", kpis: ["Auto-discovery", "Lifecycle", "Depreciation"] },
  { icon: Package, title: "Non-IT Asset Management", desc: "Track facilities, furniture, and equipment with QR/barcode tagging and maintenance schedules.", color: "#0d9488", kpis: ["QR/barcode", "Maintenance", "Location"] },
  { icon: Ticket, title: "ITSM Service Desk", desc: "Incident, problem, and change workflows with SLA timers and escalation paths.", color: "#10b981", kpis: ["SLA timers", "Escalation", "Portal"] },
  { icon: ScanLine, title: "Vulnerability Scanning", desc: "Agent-based and agentless scanning with CVE detection, risk scoring, and remediation tracking.", color: "#ef4444", kpis: ["CVE", "CVSS", "Remediation"] },
  { icon: Router, title: "Network Monitoring", desc: "SNMP polling, bandwidth tracking, topology views, and uptime history for network devices.", color: "#f59e0b", kpis: ["SNMP", "Topology", "Bandwidth"] },
  { icon: Shield, title: "Patch Management", desc: "OS and third-party patch visibility with compliance scoring and deployment workflows.", color: "#0891b2", kpis: ["Compliance", "Deploy", "Rollback"] },
  { icon: Camera, title: "CCTV Surveillance", desc: "Camera fleet inventory with health monitoring, stream status, and maintenance scheduling.", color: "#14b8a6", kpis: ["Health", "Alerts", "Zones"] },
  { icon: Car, title: "Fleet & GPS Tracking", desc: "Vehicle tracking with maps, trip history, and driver assignment where GPS feeds are available.", color: "#0e7490", kpis: ["Live GPS", "Trips", "Drivers"] },
  { icon: Laptop, title: "VDI Management", desc: "Virtual desktop session tracking, resource utilization, and pool visibility.", color: "#155e75", kpis: ["Sessions", "Pools", "Resources"] },
  { icon: GitBranch, title: "CMDB & Dependencies", desc: "Configuration items with relationship mapping and change impact context.", color: "#f97316", kpis: ["CI mapping", "Impact", "Change"] },
  { icon: FileText, title: "Procurement & Contracts", desc: "Vendor records, purchase orders, contract renewals, and budget tracking.", color: "#06b6d4", kpis: ["POs", "Renewals", "Budget"] },
  { icon: BarChart3, title: "Reports & Compliance", desc: "Operational dashboards, scheduled reports, and audit-friendly activity trails.", color: "#10b981", kpis: ["Reports", "Audit", "DPDP"] },
];

const CAPABILITIES = [
  { icon: Search, title: "Auto-Discovery", desc: "Find devices with agents or agentless SNMP, SSH, WMI, and nmap sweeps.", color: "#06b6d4" },
  { icon: Bot, title: "Live Monitoring", desc: "CPU, RAM, disk, and network telemetry from agents on a steady cadence.", color: "#14b8a6" },
  { icon: Bell, title: "Alert Engine", desc: "Threshold alerts via email, Slack, webhooks, and in-app notifications.", color: "#f59e0b" },
  { icon: Shield, title: "Threat Signals", desc: "USB monitoring, unexpected port changes, and file integrity detection.", color: "#0e7490" },
  { icon: Workflow, title: "Automation Rules", desc: "Event-driven rules to notify teams, open tickets, or run approved scripts.", color: "#10b981" },
  { icon: Cloud, title: "Flexible Deployment", desc: "Run as SaaS or self-host with Docker and PostgreSQL on your infrastructure.", color: "#475569" },
];

const COMPARE = [
  { feature: "IT + Non-IT Asset Management", us: true, ivanti: true, manage: true },
  { feature: "Agent + Agentless Discovery", us: true, ivanti: true, manage: false },
  { feature: "Built-in ITSM Service Desk", us: true, ivanti: true, manage: true },
  { feature: "CCTV Inventory Module", us: true, ivanti: false, manage: false },
  { feature: "Fleet GPS Module", us: true, ivanti: false, manage: false },
  { feature: "VDI Visibility", us: true, ivanti: false, manage: true },
  { feature: "Patch Workflows", us: true, ivanti: true, manage: true },
  { feature: "CMDB Relationships", us: true, ivanti: true, manage: true },
  { feature: "India DPDP-oriented Controls", us: true, ivanti: false, manage: false },
  { feature: "Cloud SaaS + Self-host Option", us: true, ivanti: true, manage: true },
  { feature: "Audit Activity Trails", us: true, ivanti: true, manage: true },
  { feature: "Multi-Tenant RBAC", us: true, ivanti: true, manage: true },
];

interface PlanConfig { priceUSD: number; priceINR: number; discountPercent: number; features: string[]; }

const FALLBACK_PRICING: Record<string, PlanConfig> = {
  starter: { priceUSD: 0, priceINR: 0, discountPercent: 0, features: ["IT Asset Tracking", "4 Users", "Basic Reports", "Email Support", "Community Access"] },
  professional: { priceUSD: 199, priceINR: 16999, discountPercent: 50, features: ["Core Platform Modules", "Unlimited Users", "Vulnerability Scanning", "ITSM + SLA Engine", "Priority Support", "API Access"] },
  enterprise: { priceUSD: 499, priceINR: 39999, discountPercent: 50, features: ["Everything in Pro", "On-Premise Deploy", "SSO / SAML / LDAP", "Dedicated Support", "Custom SLA"] },
  custom: { priceUSD: -1, priceINR: -1, discountPercent: 0, features: ["Everything in Enterprise", "Custom asset limits", "Negotiated pricing", "Dedicated account manager", "Custom SLA", "Priority onboarding"] },
};

export default function LandingPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const L = theme === "light";
  const bg = L ? "#f5f7f8" : "#070b10";
  const cardBg = L ? "#ffffff" : "rgba(18,21,26,0.92)";
  const border = L ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)";
  const muted = L ? "#6b7280" : "#9f9fa0";
  const txt = L ? "#0f172a" : "#f5f5f7";
  const voidBtn = L ? "#0f172a" : "#ffffff";
  const voidTxt = L ? "#ffffff" : "#0f172a";

  const [pricingData, setPricingData] = useState(FALLBACK_PRICING);
  const [currency, setCurrency] = useState<"USD" | "INR">("INR");
  const [applyPromo] = useState(true);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [roiAssets, setRoiAssets] = useState(2500);
  const [roiAgents, setRoiAgents] = useState(20);

  const tradCost = (roiAssets * 220 + roiAgents * 4200) * 12;
  const qsCost = (roiAssets * 60 + roiAgents * 1000) * 12;
  const netSavings = tradCost - qsCost;

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
    fetch(`${API_BASE}/settings/pricing`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.starter) setPricingData(d); })
      .catch(() => {});
  }, []);

  const plans = [
    { id: "starter" as const, name: "Starter", desc: "Up to 5 assets", popular: false, cta: "Get Started Free" },
    { id: "professional" as const, name: "Professional", desc: "Unlimited assets", popular: true, cta: "Start Free Trial" },
    { id: "enterprise" as const, name: "Enterprise", desc: "On-premise + SaaS", popular: false, cta: "Start Scaling" },
    { id: "custom" as const, name: "Custom", desc: "Tailored SLA models", popular: false, cta: "Talk to Sales" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, color: txt, fontFamily: "var(--font-body), 'DM Sans', system-ui, sans-serif", transition: "background 0.4s, color 0.4s", overflowX: "hidden" }}>

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "0 0 auto 0",
          height: "min(100vh, 920px)",
          pointerEvents: "none",
          zIndex: 0,
          background: L
            ? `radial-gradient(ellipse 90% 70% at 50% -10%, rgba(6,182,212,0.14) 0%, transparent 55%),
               linear-gradient(180deg, #eef4f6 0%, #f5f7f8 72%)`
            : `radial-gradient(ellipse 90% 70% at 50% -10%, rgba(6,182,212,0.18) 0%, transparent 55%),
               linear-gradient(180deg, #0a1218 0%, #070b10 75%)`,
        }}
      />

      <Header theme={theme} onToggleTheme={toggleTheme} />

      {/* ===== HERO ===== */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          padding: "120px 24px 72px",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28, animation: "qsHeroIn 2.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) both" }}>
            <Logo size={72} glow={!L} theme={theme} showTagline />
          </div>

          <div
            className="font-mono-label"
            style={{
              display: "inline-block",
              fontSize: 11,
              padding: "8px 20px",
              borderRadius: 9999,
              background: L ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.08)",
              border: `1px solid ${L ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.12)"}`,
              color: muted,
              marginBottom: 28,
              animation: "qsHeroIn 2.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 0.08s both",
            }}
          >
            Discovery & control — SaaS or self-host
          </div>

          <h1
            className="font-serif hero-headline"
            style={{
              fontSize: "clamp(40px, 7vw, 72px)",
              fontWeight: 400,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              marginBottom: 20,
              color: txt,
              animation: "qsHeroIn 2.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 0.12s both",
            }}
          >
            <em className="hero-accent-cyan">Discover</em> everything.
            <br />
            <em className="hero-accent-teal">Command</em> anything.
          </h1>

          <p
            style={{
              fontSize: "clamp(16px, 2vw, 18px)",
              lineHeight: 1.55,
              color: muted,
              maxWidth: 520,
              margin: "0 auto 36px",
              fontWeight: 300,
              animation: "qsHeroIn 2.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 0.18s both",
            }}
          >
            IT, facilities, fleet, cameras, cloud, and OT — one inventory that stays alive.
          </p>

          <div
            className="hero-cta-row"
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
              animation: "qsHeroIn 2.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 0.24s both",
            }}
          >
            <button
              className="hero-cta-primary"
              onClick={() => router.push("/register")}
            >
              <span className="hero-cta-glow" aria-hidden />
              <span className="hero-cta-label">Start trial</span>
              <ArrowRight size={16} className="hero-cta-arrow" />
            </button>
            <button
              className="hero-cta-ghost"
              onClick={() => router.push("/login")}
              data-theme={theme}
            >
              <span className="hero-cta-label">Login</span>
              <ChevronRight size={16} className="hero-cta-arrow" />
            </button>
          </div>
        </div>
      </section>

      {/* ===== CAPABILITIES — chromatic tiles ===== */}
      <section style={{ padding: "0 6% 80px", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div className="font-mono-label" style={{ fontSize: 11, color: muted, marginBottom: 14 }}>How it works</div>
          <h2 className="font-serif" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 0.95, letterSpacing: "-0.02em", marginBottom: 14 }}>
            Discovery to <em style={{ fontStyle: "italic" }}>action</em>
          </h2>
          <p style={{ fontSize: 16, fontWeight: 300, color: muted, maxWidth: 520, margin: "0 auto", lineHeight: 1.5 }}>
            From network discovery to alerts and remediation — without juggling five tools.
          </p>
        </div>
        <div className="landing-tile-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              style={{
                padding: 32,
                borderRadius: 30,
                background: c.color,
                color: "#fff",
                minHeight: 200,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                transition: "transform 0.2s ease",
              }}
            >
              <c.icon size={22} strokeWidth={1.75} />
              <h3 className="font-serif" style={{ fontSize: 28, lineHeight: 1, fontWeight: 400 }}>{c.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.5, margin: 0, opacity: 0.92, fontWeight: 400 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== DYNAMIC ASSET ESTATE ===== */}
      <AssetEstateVisual light={L} />

      {/* ===== PLATFORM STORY ===== */}
      <section id="platform" style={{ padding: "0 6% 80px", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div className="landing-story" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <div className="font-mono-label" style={{ fontSize: 11, color: muted, marginBottom: 14 }}>Platform</div>
            <h2 className="font-serif" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 0.95, letterSpacing: "-0.02em", marginBottom: 16 }}>
              A living inventory.<br /><em style={{ fontStyle: "italic" }}>Self-updating</em> CMDB.
            </h2>
            <p style={{ fontSize: 16, fontWeight: 300, color: muted, lineHeight: 1.6, maxWidth: 480 }}>
              Agents and agentless sweeps keep configuration items current. Relationships surface change impact before you push — so discovery feeds operations, not a stale spreadsheet.
            </p>
          </div>
          <div style={{ padding: 32, borderRadius: 30, background: cardBg, border: `1px solid ${border}` }}>
            {[
              { label: "Network sweep", status: "Synced", detail: "SNMP · SSH · WMI" },
              { label: "Agent fleet", status: "Online", detail: "Windows · macOS · Linux" },
              { label: "CI relationships", status: "Mapped", detail: "Impact-ready graph" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${border}` }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{row.label}</div>
                  <div className="font-mono-label" style={{ fontSize: 10, color: muted }}>{row.detail}</div>
                </div>
                <span className="font-mono-label" style={{ fontSize: 10, color: "#10b981" }}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECURITY STORY ===== */}
      <section id="security" style={{ padding: "0 6% 80px", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div className="landing-story" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 48, alignItems: "center" }}>
          <div style={{ padding: 32, borderRadius: 30, background: L ? "#1a1d21" : "#12151a", color: "#f5f5f7", order: 0 }} className="security-panel">
            {[
              { signal: "USB insertion", action: "Alert raised" },
              { signal: "Port change", action: "Ticket opened" },
              { signal: "File integrity", action: "Rule fired" },
            ].map((row) => (
              <div key={row.signal} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 14 }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>{row.signal}</span>
                <span className="font-mono-label" style={{ fontSize: 10, color: "#14b8a6" }}>{row.action}</span>
              </div>
            ))}
            <p style={{ fontSize: 13, color: "#9f9fa0", marginTop: 20, lineHeight: 1.5, fontWeight: 300 }}>
              Threat signals feed automation — notify, escalate, or remediate without leaving the platform.
            </p>
          </div>
          <div>
            <div className="font-mono-label" style={{ fontSize: 11, color: muted, marginBottom: 14 }}>Security</div>
            <h2 className="font-serif" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 0.95, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Threat signals.<br /><em style={{ fontStyle: "italic" }}>Actionable</em> response.
            </h2>
            <p style={{ fontSize: 16, fontWeight: 300, color: muted, lineHeight: 1.6, maxWidth: 480 }}>
              Where agents are installed, USB events, open-port drift, and file integrity changes surface as alerts. Pair them with rules to open tickets or run approved scripts.
            </p>
          </div>
        </div>
      </section>

      {/* ===== MODULES ===== */}
      <section id="modules-grid" style={{ padding: "0 6% 80px", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div className="font-mono-label" style={{ fontSize: 11, color: muted, marginBottom: 14 }}>Platform modules</div>
          <h2 className="font-serif" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 0.95, letterSpacing: "-0.02em", marginBottom: 14 }}>
            Twelve modules.<br />One workspace.
          </h2>
          <p style={{ fontSize: 16, fontWeight: 300, color: muted, maxWidth: 520, margin: "0 auto" }}>
            Asset inventory, monitoring, tickets, and security workflows share one data model.
          </p>
        </div>
        <div className="landing-modules" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {MODULES.map((m) => (
            <div
              key={m.title}
              style={{
                padding: 28,
                borderRadius: 16,
                background: cardBg,
                border: `1px solid ${border}`,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition: "background 0.2s ease",
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${m.color}14`, display: "flex", alignItems: "center", justifyContent: "center", color: m.color }}>
                <m.icon size={18} strokeWidth={1.75} />
              </div>
              <h3 className="font-serif" style={{ fontSize: 22, lineHeight: 1.1, fontWeight: 400 }}>{m.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: muted, margin: 0, fontWeight: 300 }}>{m.desc}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
                {m.kpis.map((k) => (
                  <span key={k} className="font-mono-label" style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: L ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", color: muted }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ROI ===== */}
      <section id="savings-engine" style={{ padding: "0 6% 80px", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div
          className="landing-story"
          style={{
            borderRadius: 30,
            background: L ? "#1a1d21" : "#12151a",
            color: "#f5f5f7",
            padding: "48px 40px",
            display: "grid",
            gridTemplateColumns: "1.15fr 1fr",
            gap: 48,
            alignItems: "center",
          }}
        >
          <div>
            <div className="font-mono-label" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>Value</div>
            <h2 className="font-serif" style={{ fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 0.95, marginBottom: 14, color: "#fff" }}>
              Consolidate the stack.<br /><em style={{ fontStyle: "italic" }}>Recover</em> the spend.
            </h2>
            <p style={{ fontSize: 15, color: "#9f9fa0", lineHeight: 1.55, fontWeight: 300, marginBottom: 28 }}>
              Illustrative model comparing fragmented ITAM + NMS + ITSM seat costs to a unified QS Assets plan. Adjust the sliders to match your estate.
            </p>
            <div style={{ display: "grid", gap: 22 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span>Managed assets</span>
                  <span className="font-mono-label" style={{ fontSize: 11, color: "#06b6d4", textTransform: "none", letterSpacing: 0 }}>{roiAssets.toLocaleString()} devices</span>
                </div>
                <input type="range" min={500} max={15000} step={250} value={roiAssets} onChange={(e) => setRoiAssets(Number(e.target.value))} style={{ width: "100%", accentColor: "#06b6d4" }} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span>Support desk seats</span>
                  <span className="font-mono-label" style={{ fontSize: 11, color: "#14b8a6", textTransform: "none", letterSpacing: 0 }}>{roiAgents} seats</span>
                </div>
                <input type="range" min={5} max={300} step={5} value={roiAgents} onChange={(e) => setRoiAgents(Number(e.target.value))} style={{ width: "100%", accentColor: "#14b8a6" }} />
              </div>
            </div>
          </div>
          <div style={{ padding: 28, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="font-mono-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Illustrative annual savings</div>
            <div className="font-serif" style={{ fontSize: 40, lineHeight: 1, color: "#fff", marginBottom: 24 }}>
              ₹{netSavings.toLocaleString("en-IN")}<span style={{ fontSize: 16, color: "#9f9fa0" }}> / yr</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "#f87171" }}>Fragmented stack</span>
                <span className="font-mono-label" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}>₹{tradCost.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "rgba(248,113,113,0.2)" }}>
                <div style={{ width: "100%", height: "100%", background: "#ef4444", borderRadius: 4 }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "#34d399" }}>QS Assets plan</span>
                <span className="font-mono-label" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}>₹{qsCost.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "rgba(52,211,153,0.15)" }}>
                <div style={{ width: `${Math.max(8, (qsCost / tradCost) * 100)}%`, height: "100%", background: "#10b981", borderRadius: 4, transition: "width 0.2s ease" }} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 20, lineHeight: 1.5 }}>
              Estimates only — actual savings depend on your vendors and seat mix.
            </p>
          </div>
        </div>
      </section>

      {/* ===== COMPARISON ===== */}
      <section style={{ padding: "0 6% 80px", maxWidth: 900, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="font-mono-label" style={{ fontSize: 11, color: muted, marginBottom: 14 }}>Comparison</div>
          <h2 className="font-serif" style={{ fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 0.95, marginBottom: 12 }}>Feature snapshot</h2>
          <p style={{ fontSize: 15, fontWeight: 300, color: muted }}>A rough side-by-side of common enterprise ITAM capabilities — always verify against current vendor docs.</p>
        </div>
        <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${border}`, background: cardBg }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: L ? "#f8fafc" : "rgba(255,255,255,0.03)" }}>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 500, color: txt }}>Capability</th>
                <th style={{ padding: "14px 20px", fontWeight: 500, color: txt, textAlign: "center" }}>QS Assets</th>
                <th style={{ padding: "14px 20px", fontWeight: 400, color: muted, textAlign: "center" }}>Ivanti*</th>
                <th style={{ padding: "14px 20px", fontWeight: 400, color: muted, textAlign: "center" }}>ManageEngine*</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r, i) => (
                <tr key={r.feature} style={{ borderTop: `1px solid ${border}`, background: i % 2 === 0 ? "transparent" : (L ? "rgba(241,245,249,0.45)" : "rgba(255,255,255,0.015)") }}>
                  <td style={{ padding: "12px 20px", fontWeight: 400, color: txt }}>{r.feature}</td>
                  <td style={{ padding: "12px 20px", textAlign: "center" }}><CheckCircle2 size={15} color="#10b981" /></td>
                  <td style={{ padding: "12px 20px", textAlign: "center" }}>{r.ivanti ? <CheckCircle2 size={15} color="#10b981" /> : <X size={14} color={muted} />}</td>
                  <td style={{ padding: "12px 20px", textAlign: "center" }}>{r.manage ? <CheckCircle2 size={15} color="#10b981" /> : <X size={14} color={muted} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "10px 20px", fontSize: 11, color: muted, borderTop: `1px solid ${border}` }}>
            * Illustrative only — competitor packaging varies by edition and region.
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" style={{ padding: "0 6% 80px", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="font-mono-label" style={{ fontSize: 11, color: muted, marginBottom: 14 }}>Pricing</div>
          <h2 className="font-serif" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 0.95, marginBottom: 12 }}>Simple, transparent pricing</h2>
          <p style={{ fontSize: 15, fontWeight: 300, color: muted }}>Start free. Scale when you are ready.</p>
          <div style={{ display: "inline-flex", background: L ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, marginTop: 24, border: `1px solid ${border}` }}>
            {(["USD", "INR"] as const).map((c) => (
              <button key={c} onClick={() => setCurrency(c)} style={{ padding: "7px 18px", borderRadius: 6, border: "none", background: currency === c ? voidBtn : "transparent", color: currency === c ? voidTxt : muted, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.06em", transition: "all 0.2s ease" }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div id="pricing-grid" className="landing-pricing" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "stretch" }}>
          {plans.map((p) => {
            const config = pricingData[p.id] || FALLBACK_PRICING[p.id];
            const isFree = p.id === "starter" || config.priceUSD === 0;
            const isCustom = p.id === "custom" || config.priceUSD < 0;
            const basePrice = currency === "USD" ? config.priceUSD : config.priceINR;
            const discount = applyPromo && config.discountPercent > 0 ? config.discountPercent : 0;
            const finalPrice = basePrice * (1 - discount / 100);
            const symbol = currency === "USD" ? "$" : "₹";
            const locale = currency === "USD" ? "en-US" : "en-IN";

            return (
              <div
                key={p.id}
                style={{
                  padding: 28,
                  borderRadius: 16,
                  background: cardBg,
                  border: `1px solid ${p.popular ? (L ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.35)") : border}`,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {p.popular && (
                  <div className="font-mono-label" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", padding: "4px 12px", borderRadius: 9999, background: voidBtn, color: voidTxt, fontSize: 10, whiteSpace: "nowrap" }}>
                    Most popular
                  </div>
                )}
                <div className="font-mono-label" style={{ fontSize: 11, color: muted }}>{p.name}</div>
                <div>
                  {isFree && <div className="font-serif" style={{ fontSize: 36, lineHeight: 1 }}>Free</div>}
                  {isCustom && <div className="font-serif" style={{ fontSize: 32, lineHeight: 1 }}>Custom</div>}
                  {!isFree && !isCustom && (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span className="font-serif" style={{ fontSize: 36, lineHeight: 1 }}>{symbol}{Math.round(finalPrice).toLocaleString(locale)}</span>
                        <span style={{ fontSize: 13, color: muted }}>/mo</span>
                      </div>
                      {discount > 0 && (
                        <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                          <span style={{ textDecoration: "line-through" }}>{symbol}{basePrice.toLocaleString(locale)}</span>
                          <span className="font-mono-label" style={{ marginLeft: 8, fontSize: 10, color: "#10b981" }}>Save {discount}%</span>
                        </div>
                      )}
                    </>
                  )}
                  <p style={{ fontSize: 13, color: muted, marginTop: 8, fontWeight: 300 }}>{p.desc}</p>
                </div>
                <div style={{ borderTop: `1px solid ${border}`, paddingTop: 14, flex: 1 }}>
                  {config.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13, color: txt }}>
                      <Check size={14} color="#10b981" /><span>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push(isCustom ? "/contact" : "/register")}
                  style={{
                    marginTop: "auto",
                    padding: "12px 0",
                    borderRadius: 8,
                    border: p.popular ? "none" : `1px solid ${border}`,
                    background: p.popular ? voidBtn : "transparent",
                    color: p.popular ? voidTxt : txt,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "opacity 0.2s ease",
                  }}
                >
                  {p.cta}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section style={{ padding: "0 6% 80px", maxWidth: 700, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <h2 className="font-serif" style={{ fontSize: "clamp(28px, 4vw, 40px)", textAlign: "center", lineHeight: 0.95, marginBottom: 32 }}>
          Frequently asked questions
        </h2>
        {[
          { q: "Can the agent run on major operating systems?", a: "Yes. The QS Discovery Agent runs on Windows (Service), macOS (LaunchDaemon), and Linux (systemd). It starts on boot and reports inventory and telemetry in the background." },
          { q: "Does the platform work without installing agents?", a: "Yes. Agentless discovery uses SNMP, SSH, WMI, and nmap to find and profile network devices without installing software on them." },
          { q: "How is data secured?", a: "Agent traffic is designed for TLS-protected channels. Tenants can configure access controls and review activity trails. Controls are oriented toward DPDP Act 2023 requirements; formal third-party certifications depend on your deployment and engagement." },
          { q: "Can I deploy on-premise?", a: "Yes. QS Assets supports Docker Compose-style self-hosting on infrastructure that can run PostgreSQL and Node.js." },
          { q: "How does threat detection work?", a: "Where agents are installed, the platform can surface USB insertions, open-port changes, file integrity changes, and unexpected software. Anomalies can raise alerts and feed automation rules." },
        ].map((faq, i) => (
          <div key={faq.q} style={{ borderBottom: `1px solid ${border}` }}>
            <button
              onClick={() => setActiveFaq(activeFaq === i ? null : i)}
              style={{ width: "100%", padding: "18px 0", display: "flex", justifyContent: "space-between", alignItems: "center", border: "none", background: "none", color: txt, fontSize: 16, fontWeight: 400, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              {faq.q}
              <span style={{ transform: activeFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", color: muted }}>▾</span>
            </button>
            {activeFaq === i && <p style={{ padding: "0 0 18px", fontSize: 14, lineHeight: 1.7, color: muted, margin: 0, fontWeight: 300 }}>{faq.a}</p>}
          </div>
        ))}
      </section>

      {/* ===== CTA ===== */}
      <section style={{ padding: "0 6% 80px", maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1, textAlign: "center" }}>
        <div style={{ padding: "56px 40px", borderRadius: 30, background: L ? "#1a1d21" : "#12151a", color: "#f5f5f7" }}>
          <h2 className="font-serif" style={{ fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 0.95, marginBottom: 14, color: "#fff" }}>
            Ready to inventory your <em style={{ fontStyle: "italic" }}>estate</em>?
          </h2>
          <p style={{ fontSize: 16, color: "#9f9fa0", marginBottom: 28, fontWeight: 300 }}>Start a trial and connect your first discovery source.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/register")} style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: "#fff", color: "#0f172a", fontSize: 16, fontWeight: 400, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Start trial <ArrowRight size={16} />
            </button>
            <button onClick={() => router.push("/login")} style={{ padding: "12px 24px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#fff", fontSize: 16, fontWeight: 400, cursor: "pointer" }}>
              Login
            </button>
          </div>
        </div>
      </section>

      <Footer theme={theme} />

      <style>{`
        @keyframes qsHeroIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroGlowPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.06); }
        }
        @keyframes heroShimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .hero-accent-cyan {
          font-style: italic;
          background: linear-gradient(120deg, #06b6d4 0%, #22d3ee 45%, #0e7490 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: heroShimmer 6s ease infinite;
        }
        .hero-accent-teal {
          font-style: italic;
          background: linear-gradient(120deg, #14b8a6 0%, #2dd4bf 45%, #0d9488 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: heroShimmer 6s ease infinite reverse;
        }
        .hero-cta-primary,
        .hero-cta-ghost {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          padding: 14px 26px;
          border-radius: 9999px;
          font-size: 15px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .hero-cta-primary {
          border: none;
          color: #fff;
          background: linear-gradient(135deg, #0f172a 0%, #164e63 48%, #06b6d4 100%);
          background-size: 180% 180%;
          box-shadow: 0 8px 28px rgba(6, 182, 212, 0.35), 0 0 0 1px rgba(6, 182, 212, 0.25);
        }
        .hero-cta-primary .hero-cta-glow {
          position: absolute;
          inset: -40%;
          z-index: -1;
          background: radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.55), transparent 60%);
          animation: heroGlowPulse 2.8s ease-in-out infinite;
          pointer-events: none;
        }
        .hero-cta-primary:hover {
          transform: translateY(-3px) scale(1.03);
          background-position: 100% 50%;
          box-shadow: 0 14px 40px rgba(6, 182, 212, 0.45), 0 0 0 1px rgba(34, 211, 238, 0.45);
        }
        .hero-cta-primary:active {
          transform: translateY(-1px) scale(0.99);
        }
        .hero-cta-ghost {
          border: 1.5px solid ${L ? "rgba(15,23,42,0.16)" : "rgba(255,255,255,0.28)"};
          background: ${L ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.04)"};
          color: ${txt};
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 0 0 0 rgba(20, 184, 166, 0);
        }
        .hero-cta-ghost:hover {
          transform: translateY(-3px) scale(1.03);
          border-color: rgba(20, 184, 166, 0.55);
          color: ${L ? "#0f766e" : "#5eead4"};
          box-shadow: 0 10px 32px rgba(20, 184, 166, 0.22), 0 0 24px rgba(20, 184, 166, 0.18);
          background: ${L ? "rgba(240, 253, 250, 0.9)" : "rgba(20, 184, 166, 0.08)"};
        }
        .hero-cta-ghost:active {
          transform: translateY(-1px) scale(0.99);
        }
        .hero-cta-arrow {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .hero-cta-primary:hover .hero-cta-arrow,
        .hero-cta-ghost:hover .hero-cta-arrow {
          transform: translateX(4px);
        }
        @media (max-width: 960px) {
          .landing-tile-grid { grid-template-columns: 1fr 1fr !important; }
          .landing-modules { grid-template-columns: 1fr 1fr !important; }
          .landing-pricing { grid-template-columns: 1fr 1fr !important; }
          .landing-story { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .landing-tile-grid { grid-template-columns: 1fr !important; }
          .landing-modules { grid-template-columns: 1fr !important; }
          .landing-pricing { grid-template-columns: 1fr !important; max-width: 400px; margin: 0 auto; }
        }
      `}</style>
    </div>
  );
}
