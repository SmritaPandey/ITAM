"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Monitor, Ticket, Network, Package, BarChart3, Lock, Zap, ChevronRight,
  ArrowRight, CheckCircle2, Globe, Server, Cpu, Sun, Moon, Camera, Car, Laptop,
  Radio, FileText, AlertTriangle, Settings, Activity, Database, Eye, Wifi, HardDrive
} from "lucide-react";

/* ── data ── */
const MODULES = [
  { icon: Monitor, title: "IT Asset Management", desc: "Full lifecycle tracking for laptops, servers, workstations, and peripherals — from procurement to retirement. Auto-discovery via agent or agentless scan.", color: "#06b6d4", kpis: ["MTTR < 4h", "100% asset coverage", "Auto-discovery"] },
  { icon: HardDrive, title: "Non-IT Asset Management", desc: "Track facilities, furniture, equipment, and infrastructure assets. QR/barcode tagging, depreciation, maintenance schedules.", color: "#8b5cf6", kpis: ["Depreciation tracking", "Maintenance alerts", "Location mapping"] },
  { icon: Ticket, title: "ITSM Service Desk", desc: "ITIL v4-aligned ticketing with incident, problem, and change management. SLA timers, auto-escalation, and knowledge base integration.", color: "#10b981", kpis: ["SLA compliance 98%+", "Auto-escalation", "Self-service portal"] },
  { icon: Shield, title: "Vulnerability Scanning", desc: "Agent-based and agentless scanning with Nmap, OWASP, and CVE detection. Risk scoring (CVSS), remediation playbooks, and scan scheduling.", color: "#ef4444", kpis: ["CVE/CVSS scoring", "Nmap integration", "Scheduled scans"] },
  { icon: Network, title: "Network Monitoring (NMS)", desc: "Real-time SNMP polling, bandwidth tracking, topology mapping, and uptime SLA dashboards. Interface-level stats with historical trends.", color: "#f59e0b", kpis: ["99.9% uptime", "SNMP v2c/v3", "Topology maps"] },
  { icon: Settings, title: "Patch Management", desc: "Centralized OS and third-party patch deployment. Compliance scoring, rollback support, and automated approval workflows.", color: "#3b82f6", kpis: ["95% compliance", "Auto-deploy", "Rollback support"] },
  { icon: Camera, title: "CCTV Surveillance", desc: "Unified camera fleet management with health monitoring, stream status, recording verification, and maintenance scheduling.", color: "#ec4899", kpis: ["100+ cameras", "Health alerts", "Zone mapping"] },
  { icon: Car, title: "Fleet & GPS Tracking", desc: "Real-time vehicle tracking with Leaflet maps, trip history, fuel analytics, maintenance alerts, and driver assignment.", color: "#14b8a6", kpis: ["Live GPS", "Trip history", "Fuel analytics"] },
  { icon: Laptop, title: "VDI Management", desc: "Virtual desktop infrastructure monitoring — session tracking, resource utilization, pool management, and user assignment.", color: "#a855f7", kpis: ["Session tracking", "Pool mgmt", "Resource alerts"] },
  { icon: Database, title: "CMDB & Dependencies", desc: "Configuration management database with CI relationships, dependency mapping, impact analysis, and change risk scoring.", color: "#f97316", kpis: ["CI mapping", "Impact analysis", "Risk scoring"] },
  { icon: FileText, title: "Procurement & Contracts", desc: "End-to-end vendor management, purchase orders, contract lifecycle tracking, renewal alerts, and budget forecasting.", color: "#06b6d4", kpis: ["PO workflows", "Renewal alerts", "Budget tracking"] },
  { icon: BarChart3, title: "Reports & Compliance", desc: "50+ executive dashboards, scheduled PDF reports, SHA-256 audit trails, and regulatory compliance (DPDP, SOC 2, ISO 27001).", color: "#6366f1", kpis: ["50+ dashboards", "SHA-256 audit", "DPDP ready"] },
];

const KPIS = [
  { value: "99.9%", label: "Uptime SLA", sub: "Enterprise guarantee" },
  { value: "50K+", label: "Assets Managed", sub: "Across categories" },
  { value: "<2s", label: "Scan Response", sub: "Real-time detection" },
  { value: "24/7", label: "Monitoring", sub: "Always-on coverage" },
  { value: "12+", label: "Modules", sub: "Unified platform" },
  { value: "50+", label: "Dashboards", sub: "Executive insights" },
];

const COMPARE = [
  { feature: "IT + Non-IT Asset Management", us: true, ivanti: true, manage: true },
  { feature: "Agent + Agentless Scanning", us: true, ivanti: true, manage: false },
  { feature: "Built-in ITSM Service Desk", us: true, ivanti: true, manage: true },
  { feature: "CCTV & Physical Security", us: true, ivanti: false, manage: false },
  { feature: "Fleet GPS Tracking", us: true, ivanti: false, manage: false },
  { feature: "VDI Management", us: true, ivanti: false, manage: true },
  { feature: "Patch Management", us: true, ivanti: true, manage: true },
  { feature: "CMDB with Dependency Maps", us: true, ivanti: true, manage: true },
  { feature: "DPDP Act 2023 Compliance", us: true, ivanti: false, manage: false },
  { feature: "On-Premise + Cloud SaaS", us: true, ivanti: true, manage: true },
  { feature: "SHA-256 Audit Hash Chain", us: true, ivanti: false, manage: false },
  { feature: "Multi-Tenant RBAC", us: true, ivanti: true, manage: true },
];

export default function LandingPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"dark"|"light">("dark");
  useEffect(() => {
    const s = localStorage.getItem("theme") as "dark"|"light"|null;
    const t = s || "dark"; setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  function toggle() {
    const n = theme === "dark" ? "light" : "dark"; setTheme(n);
    localStorage.setItem("theme", n); document.documentElement.setAttribute("data-theme", n);
  }
  const L = theme === "light";
  const bg = L ? "#f8fafc" : "#0a0e1a";
  const card = L ? "white" : "rgba(26,31,53,0.6)";
  const border = L ? "rgba(0,0,0,0.07)" : "rgba(42,49,80,0.5)";
  const muted = L ? "#64748b" : "#94a3b8";
  const txt = L ? "#0f172a" : "#f1f5f9";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: txt, fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif", transition: "background 0.3s, color 0.3s" }}>

      {/* NAV */}
      <nav className="landing-nav" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "12px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", background: L ? "rgba(250,250,250,0.85)" : "rgba(9,9,11,0.8)", backdropFilter: "blur(20px) saturate(1.4)", borderBottom: `1px solid ${L ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(6,182,212,0.25)" }}>
            <img src="/favicon.png" alt="QS" style={{ width: 22, height: 22, borderRadius: 5 }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.04em" }}>QS Asset</span>
        </a>
        <div className="landing-nav-links" style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {["Features","Modules","Compare","Security","Pricing"].map(t => (
            <a key={t} href={`#${t.toLowerCase()}`} style={{ fontSize: 13, fontWeight: 500, color: muted, textDecoration: "none", transition: "color 0.15s" }}>{t}</a>
          ))}
          <a href="/contact" style={{ fontSize: 13, fontWeight: 500, color: muted, textDecoration: "none" }}>Contact</a>
          <button onClick={toggle} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${L ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`, cursor: "pointer", background: L ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)", color: muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {L ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button onClick={() => router.push("/register")} style={{ padding: "8px 18px", borderRadius: 9, border: `1.5px solid ${L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, background: "transparent", color: txt, fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.01em" }}>
            Register
          </button>
          <button onClick={() => router.push("/login")} style={{ padding: "8px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#06b6d4,#0891b2)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px rgba(6,182,212,0.25)", letterSpacing: "-0.01em" }}>
            Sign In <ArrowRight size={13} style={{ marginLeft: 4, verticalAlign: "middle" }} />
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="landing-hero" style={{ paddingTop: 140, paddingBottom: 70, textAlign: "center", position: "relative", padding: "140px 20px 70px" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, background: L ? "rgba(6,182,212,0.06)" : "rgba(6,182,212,0.08)", border: `1px solid ${L ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.15)'}`, marginBottom: 28, fontSize: 12, fontWeight: 600, color: "#06b6d4", letterSpacing: "-0.01em" }}>
            <Zap size={13} /> Enterprise-Grade IT Asset Management
          </div>
          <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.045em", marginBottom: 20, color: txt }}>
            Command Every Asset.<br />
            <span style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Secure Every Endpoint.</span>
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: muted, maxWidth: 600, margin: "0 auto 36px", letterSpacing: "-0.01em" }}>
            The only platform that unifies IT &amp; non-IT asset management, ITSM, vulnerability scanning, network monitoring, and compliance — in a single pane of glass.
          </p>
          <div className="landing-hero-buttons" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
            <button onClick={() => router.push("/register")} style={{ padding: "14px 32px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#06b6d4,#0891b2)", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(6,182,212,0.25)", display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.01em", transition: "transform 0.15s, box-shadow 0.15s" }}>
              Start Free — No Credit Card <ChevronRight size={17} />
            </button>
            <button onClick={() => document.getElementById("modules")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "14px 28px", borderRadius: 10, border: `1.5px solid ${L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, background: "transparent", color: txt, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.01em" }}>
              <Globe size={16} /> Explore 12+ Modules
            </button>
          </div>
          {/* Social proof */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ display: "flex" }}>
              {["#06b6d4","#8b5cf6","#10b981","#f59e0b","#ef4444"].map((c,i) => (
                <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${bg}`, background: `linear-gradient(135deg,${c},${c}cc)`, marginLeft: i > 0 ? -7 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white" }}>
                  {["S","A","V","P","K"][i]}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: muted, fontWeight: 500 }}>
              Trusted by <strong style={{ color: txt, fontWeight: 700 }}>200+ teams</strong> managing 50K+ assets
            </span>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section id="features" className="landing-section" style={{ padding: "20px 48px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="landing-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}>
          {KPIS.map(k => (
            <div key={k.label} style={{ textAlign: "center", padding: "22px 16px", borderRadius: 14, background: card, border: `1px solid ${border}`, transition: "transform 0.15s", cursor: "default" }}>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", background: "linear-gradient(135deg,#06b6d4,#0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{k.value}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, letterSpacing: "-0.01em" }}>{k.label}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 2, fontWeight: 500 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <div style={{ textAlign: "center", padding: "28px 0", borderTop: `1px solid ${L ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'}`, borderBottom: `1px solid ${L ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'}` }}>
        <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: muted, marginBottom: 14, fontWeight: 600 }}>Built for Enterprise Security Standards</p>
        <div className="landing-trust-bar" style={{ display: "flex", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
          {["SOC 2 Type II","ISO 27001","DPDP Act 2023","ITIL v4","SHA-256 Audit","RBAC + MFA"].map(n => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: muted, opacity: 0.8 }}>
              <CheckCircle2 size={13} color="#10b981" /> {n}
            </div>
          ))}
        </div>
      </div>

      {/* ALL 12 MODULES */}
      <section id="modules" className="landing-section" style={{ padding: "80px 48px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 12 }}>12 Modules. One Unified Platform.</h2>
          <p style={{ fontSize: 15, color: muted, maxWidth: 560, margin: "0 auto", lineHeight: 1.7, letterSpacing: "-0.01em" }}>Replace 6+ point solutions with QS Asset. Every module is deeply integrated — assets flow into tickets, scans trigger patches, and everything feeds the CMDB.</p>
        </div>
        <div className="landing-modules-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
          {MODULES.map(m => {
            const Icon = m.icon;
            return (
            <div key={m.title} style={{ padding: 24, borderRadius: 14, background: card, border: `1px solid ${border}`, transition: "transform 0.15s, box-shadow 0.15s", cursor: "default" }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${m.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: m.color, marginBottom: 14 }}><Icon size={22} /></div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{m.title}</h3>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: muted, margin: "0 0 12px" }}>{m.desc}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {m.kpis.map(k => (
                  <span key={k} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: `${m.color}10`, color: m.color, fontWeight: 600 }}>{k}</span>
                ))}
              </div>
            </div>
          );
          })}
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section id="compare" style={{ padding: "80px 48px", maxWidth: 920, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 10 }}>How We Compare</h2>
          <p style={{ fontSize: 14, color: muted, letterSpacing: "-0.01em" }}>QS Asset vs. industry leaders — more features at a fraction of the cost.</p>
        </div>
        <div className="landing-compare-wrap" style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: L ? "#f1f5f9" : "rgba(15,23,42,0.6)" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Feature</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "#06b6d4" }}>QS Asset</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: muted }}>Ivanti</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: muted }}>ManageEngine</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r, i) => (
                <tr key={r.feature} style={{ borderTop: `1px solid ${border}`, background: i % 2 === 0 ? "transparent" : (L ? "rgba(0,0,0,0.015)" : "rgba(255,255,255,0.015)") }}>
                  <td style={{ padding: "10px 16px", fontWeight: 500 }}>{r.feature}</td>
                  <td style={{ padding: "10px 16px", textAlign: "center" }}>{r.us ? <CheckCircle2 size={16} color="#10b981" /> : <span style={{ color: muted }}>—</span>}</td>
                  <td style={{ padding: "10px 16px", textAlign: "center" }}>{r.ivanti ? <CheckCircle2 size={16} color="#64748b" /> : <span style={{ color: muted }}>—</span>}</td>
                  <td style={{ padding: "10px 16px", textAlign: "center" }}>{r.manage ? <CheckCircle2 size={16} color="#64748b" /> : <span style={{ color: muted }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" style={{ padding: "80px 48px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="landing-security-grid" style={{ padding: 48, borderRadius: 20, background: L ? "rgba(0,0,0,0.015)" : "rgba(255,255,255,0.02)", border: `1px solid ${border}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: "rgba(16,185,129,0.08)", color: "#10b981", fontSize: 11, fontWeight: 700, marginBottom: 18, letterSpacing: "-0.01em" }}><Lock size={12} /> Enterprise Security</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.03em" }}>Built for Zero-Trust Environments</h2>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: muted, marginBottom: 22, letterSpacing: "-0.01em" }}>Multi-tenant architecture with RBAC, JWT authentication, SHA-256 audit hash chains, and full compliance with DPDP Act 2023, SOC 2 Type II, and ISO 27001.</p>
            {["SOC 2 Type II Ready","DPDP Act 2023 Compliant","SHA-256 Audit Hash Chain","RBAC + Multi-Tenant Isolation","End-to-End Encrypted API","Credential Vault for Scans"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, fontSize: 13, fontWeight: 500 }}>
                <CheckCircle2 size={14} color="#10b981" /> {t}
              </div>
            ))}
          </div>
          <div className="landing-security-cards" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: Server, t: "On-Premise", d: "Self-hosted deployment" },
              { icon: Globe, t: "Cloud SaaS", d: "Managed infrastructure" },
              { icon: Cpu, t: "Agent-Based", d: "Deep endpoint telemetry" },
              { icon: Wifi, t: "Agentless", d: "Zero-install SNMP/WMI" },
              { icon: Eye, t: "Real-Time", d: "Live dashboards & alerts" },
              { icon: Activity, t: "Automated", d: "Self-healing workflows" },
            ].map(c => (
              <div key={c.t} style={{ padding: 18, borderRadius: 12, background: card, border: `1px solid ${border}`, textAlign: "center", transition: "transform 0.15s" }}>
                <div style={{ color: "#06b6d4", marginBottom: 6 }}><c.icon size={18} /></div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, letterSpacing: "-0.01em" }}>{c.t}</div>
                <div style={{ fontSize: 11, color: muted }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING — Psychology-Driven */}
      <section id="pricing" style={{ padding: "80px 48px", maxWidth: 1020, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 10 }}>Simple, Transparent Pricing</h2>
        <p style={{ fontSize: 14, color: muted, marginBottom: 10, letterSpacing: "-0.01em" }}>Start free. Scale as you grow. No hidden fees.</p>
        <p style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600, marginBottom: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Zap size={13} /> Save up to 20% with annual billing</p>
        <div className="landing-pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, alignItems: "start" }}>
          {[
            { name: "Starter", price: 0, annual: 0, desc: "Up to 100 assets", features: ["IT Asset Tracking","5 Users","Basic Reports","Email Support","Community Access"], popular: false, cta: "Start Free" },
            { name: "Professional", price: 4999, annual: 3999, desc: "Unlimited assets", features: ["All 12 Modules","Unlimited Users","Vulnerability Scanning","ITSM + SLA Engine","Priority Support","API Access"], popular: true, cta: "Start 14-Day Trial" },
            { name: "Enterprise", price: -1, annual: -1, desc: "On-premise + SaaS", features: ["Everything in Pro","On-Premise Deploy","SSO / SAML / LDAP","Dedicated CSM","Custom SLA","White-Label Option"], popular: false, cta: "Talk to Sales →" },
          ].map(p => (
            <div key={p.name} style={{ borderRadius: 16, padding: p.popular ? "2px" : 0, background: p.popular ? "linear-gradient(135deg,#06b6d4,#8b5cf6,#06b6d4)" : "transparent" }}>
              <div style={{ padding: "28px 24px", borderRadius: p.popular ? 14 : 16, background: card, border: p.popular ? "none" : `1px solid ${border}`, position: "relative", textAlign: "left" }}>
                {p.popular && <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", padding: "3px 14px", borderRadius: "0 0 8px 8px", background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "white", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", boxShadow: "0 4px 12px rgba(6,182,212,0.3)" }}>⚡ Most Popular</div>}
                {p.popular && <div style={{ fontSize: 10, color: muted, fontWeight: 500, marginTop: 10, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: "#f59e0b" }}>★</span> Chosen by 78% of teams</div>}
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, marginTop: p.popular ? 0 : 4, letterSpacing: "-0.01em" }}>{p.name}</h3>
                {p.price === 0 ? (
                  <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>Free</div>
                ) : p.price < 0 ? (
                  <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>Custom</div><div style={{ fontSize: 11, color: muted }}>Tailored to your needs</div></div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>₹{p.annual.toLocaleString("en-IN")}</span>
                      <span style={{ fontSize: 12, color: muted }}>/mo</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: muted, textDecoration: "line-through" }}>₹{p.price.toLocaleString("en-IN")}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(16,185,129,0.1)", color: "#10b981" }}>Save ₹{((p.price - p.annual) * 12).toLocaleString("en-IN")}/yr</span>
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 12, color: muted, marginBottom: 16, marginTop: 6 }}>{p.desc}</p>
                {p.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, marginBottom: 7, color: txt, fontWeight: 500 }}>
                    <CheckCircle2 size={13} color={p.popular ? "#06b6d4" : "#10b981"} /> {f}
                  </div>
                ))}
                <button onClick={() => router.push(p.price < 0 ? "/contact" : "/register")} style={{ width: "100%", marginTop: 18, padding: "12px 0", borderRadius: 10, border: p.popular ? "none" : `1.5px solid ${L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, background: p.popular ? "linear-gradient(135deg,#06b6d4,#0891b2)" : "transparent", color: p.popular ? "white" : txt, fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em", boxShadow: p.popular ? "0 4px 16px rgba(6,182,212,0.25)" : "none", fontFamily: "inherit" }}>
                  {p.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
        {/* Trust guarantees */}
        <div className="landing-trust-footer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 28 }}>
          {[
            { icon: <Shield size={13} />, text: "30-day money-back guarantee" },
            { icon: <Lock size={13} />, text: "Cancel anytime, no lock-in" },
            { icon: <Zap size={13} />, text: "Setup in under 2 minutes" },
          ].map((t,i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: muted, fontWeight: 500 }}>
              <span style={{ color: "#06b6d4" }}>{t.icon}</span> {t.text}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "60px 48px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: 48, borderRadius: 20, background: L ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)", border: `1px solid ${border}` }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.03em" }}>Ready to Take Command?</h2>
          <p style={{ fontSize: 14, color: muted, marginBottom: 28, maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.7, letterSpacing: "-0.01em" }}>Join enterprises managing 50,000+ assets with complete visibility, automated security, and regulatory compliance.</p>
          <div className="landing-cta-buttons" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/register")} style={{ padding: "14px 36px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#06b6d4,#0891b2)", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(6,182,212,0.25)", letterSpacing: "-0.01em" }}>
              Create Free Account <ArrowRight size={16} style={{ marginLeft: 6, verticalAlign: "middle" }} />
            </button>
            <button onClick={() => router.push("/contact")} style={{ padding: "14px 28px", borderRadius: 10, border: `1.5px solid ${L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, background: "transparent", color: txt, fontSize: 15, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.01em" }}>
              Talk to Sales
            </button>
          </div>
          <p style={{ fontSize: 11, color: muted, marginTop: 16, opacity: 0.7 }}>Free forever for up to 100 assets · No credit card required · Setup in 2 minutes</p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 48px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>Frequently Asked Questions</h2>
          <p style={{ fontSize: 14, color: muted, letterSpacing: "-0.01em" }}>Everything you need to know about QS Asset Management.</p>
        </div>
        {[
          { q: "Is there really a free plan?", a: "Yes — the Starter plan is free forever. You get up to 100 assets, 5 users, IT asset tracking, basic reports, and email support. No credit card required." },
          { q: "Can I deploy on my own servers?", a: "Absolutely. QS Asset supports both cloud SaaS and on-premise deployment via Docker. Your data stays on your infrastructure with full control." },
          { q: "How does network scanning work?", a: "We support agent-based monitoring (install our lightweight agent on endpoints) and agentless scanning via SNMP, ICMP, Nmap, and ARP. Both methods auto-discover devices on your network." },
          { q: "Is my data secure and compliant?", a: "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We support DPDP Act 2023, SOC 2 Type II, and ISO 27001 compliance standards. Multi-tenant RBAC ensures strict data isolation." },
          { q: "How long does setup take?", a: "For SaaS — register and start scanning in under 2 minutes. For on-premise — deploy with Docker in under 10 minutes using our one-command setup script." },
          { q: "Can I migrate from ManageEngine, Ivanti, or ServiceNow?", a: "Yes. QS Asset supports CSV bulk import. Export your assets from your current tool and import them directly. We also provide assisted migration for Enterprise plans." },
        ].map((faq, i) => (
          <details key={i} style={{ marginBottom: 8, padding: "16px 20px", borderRadius: 10, background: card, border: `1px solid ${border}`, cursor: "pointer" }}>
            <summary style={{ fontSize: 14, fontWeight: 600, listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {faq.q} <ChevronRight size={14} style={{ color: muted, flexShrink: 0, transition: "transform 0.2s" }} />
            </summary>
            <p style={{ fontSize: 13, color: muted, lineHeight: 1.8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${border}` }}>{faq.a}</p>
          </details>
        ))}
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "44px 48px 24px", borderTop: `1px solid ${L ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'}`, maxWidth: 1200, margin: "0 auto" }}>
        <div className="landing-footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 32, marginBottom: 28 }}>
          <div>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, textDecoration: "none", color: "inherit" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src="/favicon.png" alt="QS" style={{ width: 17, height: 17, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em" }}>QS Asset</span>
            </a>
            <p style={{ fontSize: 12, color: muted, lineHeight: 1.7, maxWidth: 280, letterSpacing: "-0.01em" }}>Enterprise IT asset management, network monitoring, and security platform. Built by NeurQ AI Labs.</p>
          </div>
          <div>
            <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14, color: muted }}>Product</h4>
            {[{l:"Features",h:"#features"},{l:"Modules",h:"#modules"},{l:"Pricing",h:"#pricing"},{l:"Documentation",h:"/docs"},{l:"API Docs",h:"/api/docs"}].map(a => (
              <a key={a.l} href={a.h} style={{ display: "block", fontSize: 13, color: txt, textDecoration: "none", marginBottom: 8, opacity: 0.65, fontWeight: 500, letterSpacing: "-0.01em" }}>{a.l}</a>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14, color: muted }}>Company</h4>
            {[{l:"Contact",h:"/contact"},{l:"About NeurQ",h:"https://neurqai.com"},{l:"Careers",h:"/contact"}].map(a => (
              <a key={a.l} href={a.h} style={{ display: "block", fontSize: 13, color: txt, textDecoration: "none", marginBottom: 8, opacity: 0.65, fontWeight: 500, letterSpacing: "-0.01em" }}>{a.l}</a>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14, color: muted }}>Legal</h4>
            {[{l:"Privacy Policy",h:"/privacy"},{l:"Terms of Service",h:"/terms"},{l:"Cookie Policy",h:"/cookies"},{l:"Security",h:"#security"}].map(a => (
              <a key={a.l} href={a.h} style={{ display: "block", fontSize: 13, color: txt, textDecoration: "none", marginBottom: 8, opacity: 0.65, fontWeight: 500, letterSpacing: "-0.01em" }}>{a.l}</a>
            ))}
          </div>
        </div>
        <div className="landing-footer-bottom" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: `1px solid ${L ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'}` }}>
          <p style={{ fontSize: 11, color: muted, margin: 0, letterSpacing: "-0.01em" }}>&copy; 2026 NeurQ AI Labs Pvt Ltd. All rights reserved. Built in India 🇮🇳</p>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="/privacy" style={{ fontSize: 11, color: muted, textDecoration: "none" }}>Privacy</a>
            <a href="/terms" style={{ fontSize: 11, color: muted, textDecoration: "none" }}>Terms</a>
            <a href="/contact" style={{ fontSize: 11, color: muted, textDecoration: "none" }}>Contact</a>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 1024px) {
          .landing-nav { padding: 10px 20px !important; }
          .landing-nav-links a:not(:last-child):not(:nth-last-child(2)):not(:nth-last-child(3)) { display: none; }
          .landing-section { padding: 60px 24px !important; }
        }
        @media (max-width: 768px) {
          .landing-nav { padding: 10px 16px !important; }
          .landing-nav-links a { display: none !important; }
          .landing-section { padding: 40px 16px !important; }
          .landing-features-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
          .landing-modules-grid { grid-template-columns: 1fr !important; }
          .landing-hero h1 { font-size: 36px !important; }
          .landing-hero p { font-size: 15px !important; }
          .landing-hero-buttons { flex-direction: column !important; align-items: center !important; }
          .landing-hero-buttons button { width: 100% !important; max-width: 320px !important; justify-content: center !important; }
          .landing-pricing-grid { grid-template-columns: 1fr !important; max-width: 400px !important; margin: 0 auto !important; }
          .landing-security-grid { grid-template-columns: 1fr !important; }
          .landing-security-cards { grid-template-columns: repeat(3, 1fr) !important; }
          .landing-compare-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
          .landing-compare-wrap table { min-width: 500px !important; }
          .landing-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
          .landing-footer-bottom { flex-direction: column !important; gap: 10px !important; text-align: center !important; }
          .landing-cta-buttons { flex-direction: column !important; align-items: center !important; }
          .landing-cta-buttons button { width: 100% !important; max-width: 320px !important; justify-content: center !important; }
          .landing-trust-bar { gap: 16px !important; }
          .landing-trust-footer { flex-direction: column !important; gap: 8px !important; }
        }
        @media (max-width: 480px) {
          .landing-features-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .landing-hero h1 { font-size: 28px !important; }
          .landing-security-cards { grid-template-columns: repeat(2, 1fr) !important; }
          .landing-footer-grid { grid-template-columns: 1fr !important; }
          .landing-trust-bar { flex-direction: column !important; gap: 8px !important; }
        }
      `}</style>
    </div>
  );
}
