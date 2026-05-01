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
    <div style={{ minHeight: "100vh", background: bg, color: txt, fontFamily: "'Inter',system-ui,sans-serif", transition: "background 0.3s, color 0.3s" }}>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: L ? "rgba(248,250,252,0.9)" : "rgba(10,14,26,0.9)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Shield size={18} color="white" /></div>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.03em" }}>AssetCommand</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {["Features","Modules","Compare","Security","Pricing"].map(t => (
            <a key={t} href={`#${t.toLowerCase()}`} style={{ fontSize: 13, fontWeight: 500, color: muted, textDecoration: "none" }}>{t}</a>
          ))}
          <button onClick={toggle} style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", background: L ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", color: muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {L ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button onClick={() => router.push("/login")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Sign In <ArrowRight size={13} style={{ marginLeft: 4, verticalAlign: "middle" }} />
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 130, paddingBottom: 60, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(6,182,212,0.08) 0%,transparent 70%)", top: "-20%", right: "10%" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.06) 0%,transparent 70%)", bottom: "-20%", left: "5%" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 820, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, background: L ? "rgba(6,182,212,0.08)" : "rgba(6,182,212,0.12)", border: `1px solid rgba(6,182,212,0.2)`, marginBottom: 24, fontSize: 12, fontWeight: 600, color: "#06b6d4" }}>
            <Zap size={14} /> Enterprise-Grade IT Asset Management
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.04em", marginBottom: 20, color: txt }}>
            Command Every Asset.<br /><span style={{ color: "#06b6d4" }}>Secure Every Endpoint.</span>
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: muted, maxWidth: 640, margin: "0 auto 32px" }}>
            The only platform that unifies IT &amp; non-IT asset management, ITSM ticketing, vulnerability scanning, network monitoring, CCTV, fleet GPS, VDI, patch management, and CMDB — in a single pane of glass.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/login")} style={{ padding: "13px 30px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(6,182,212,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
              Start Free Trial <ChevronRight size={18} />
            </button>
            <button onClick={() => document.getElementById("modules")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "13px 30px", borderRadius: 10, border: `1px solid ${border}`, background: card, color: txt, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Globe size={16} /> Explore 12+ Modules
            </button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section id="features" style={{ padding: "40px 40px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12 }}>
          {KPIS.map(k => (
            <div key={k.label} style={{ textAlign: "center", padding: 20, borderRadius: 12, background: card, border: `1px solid ${border}` }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#06b6d4" }}>{k.value}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <div style={{ textAlign: "center", padding: "30px 0", borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}>
        <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: muted, marginBottom: 16, fontWeight: 600 }}>Trusted by India&apos;s Leading Enterprises</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap", opacity: 0.35 }}>
          {["Tata","Infosys","Wipro","HCL","TCS","Reliance"].map(n => (
            <div key={n} style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.05em", color: muted }}>{n}</div>
          ))}
        </div>
      </div>

      {/* ALL 12 MODULES */}
      <section id="modules" style={{ padding: "70px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>12 Modules. One Unified Platform.</h2>
          <p style={{ fontSize: 15, color: muted, maxWidth: 600, margin: "0 auto" }}>Replace 6+ point solutions with AssetCommand. Every module is deeply integrated — assets flow into tickets, scans trigger patches, and everything feeds the CMDB.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {MODULES.map(m => {
            const Icon = m.icon;
            return (
            <div key={m.title} style={{ padding: 24, borderRadius: 14, background: card, border: `1px solid ${border}`, transition: "transform 0.2s", cursor: "default" }}>
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
      <section id="compare" style={{ padding: "60px 40px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>How We Compare</h2>
          <p style={{ fontSize: 14, color: muted }}>AssetCommand vs. industry leaders — more features at a fraction of the cost.</p>
        </div>
        <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: L ? "#f1f5f9" : "rgba(15,23,42,0.6)" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Feature</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "#06b6d4" }}>AssetCommand</th>
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
      <section id="security" style={{ padding: "60px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ padding: 44, borderRadius: 18, background: L ? "linear-gradient(135deg,#f0fdfa,#eff6ff)" : "linear-gradient(135deg,rgba(6,182,212,0.04),rgba(139,92,246,0.04))", border: `1px solid ${border}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 6, background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: 11, fontWeight: 600, marginBottom: 16 }}><Lock size={12} /> Enterprise Security</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>Built for Zero-Trust Environments</h2>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: muted, marginBottom: 20 }}>Multi-tenant architecture with RBAC, JWT authentication, SHA-256 audit hash chains, and full compliance with DPDP Act 2023, SOC 2 Type II, and ISO 27001.</p>
            {["SOC 2 Type II Ready","DPDP Act 2023 Compliant","SHA-256 Audit Hash Chain","RBAC + Multi-Tenant Isolation","End-to-End Encrypted API","Credential Vault for Scans"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
                <CheckCircle2 size={15} color="#10b981" /> {t}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { icon: Server, t: "On-Premise", d: "Self-hosted deployment" },
              { icon: Globe, t: "Cloud SaaS", d: "Managed infrastructure" },
              { icon: Cpu, t: "Agent-Based", d: "Deep endpoint telemetry" },
              { icon: Wifi, t: "Agentless", d: "Zero-install SNMP/WMI" },
              { icon: Eye, t: "Real-Time", d: "Live dashboards & alerts" },
              { icon: Activity, t: "Automated", d: "Self-healing workflows" },
            ].map(c => (
              <div key={c.t} style={{ padding: 18, borderRadius: 12, background: card, border: `1px solid ${border}`, textAlign: "center" }}>
                <div style={{ color: "#06b6d4", marginBottom: 6 }}><c.icon size={20} /></div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{c.t}</div>
                <div style={{ fontSize: 11, color: muted }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "70px 40px", maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Simple, Transparent Pricing</h2>
        <p style={{ fontSize: 14, color: muted, marginBottom: 36 }}>Start free. Scale as you grow. No hidden fees.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { name: "Starter", price: "Free", desc: "Up to 100 assets", features: ["IT Asset Tracking","5 Users","Basic Reports","Email Support","Community Access"], popular: false },
            { name: "Professional", price: "₹4,999/mo", desc: "Unlimited assets", features: ["All 12 Modules","Unlimited Users","Vulnerability Scanning","ITSM + SLA Engine","Priority Support","API Access"], popular: true },
            { name: "Enterprise", price: "Custom", desc: "On-premise + SaaS", features: ["Everything in Pro","On-Premise Deploy","SSO / SAML / LDAP","Dedicated CSM","Custom SLA","White-Label Option"], popular: false },
          ].map(p => (
            <div key={p.name} style={{ padding: 30, borderRadius: 16, background: card, border: p.popular ? "2px solid #06b6d4" : `1px solid ${border}`, position: "relative", transform: p.popular ? "scale(1.03)" : "none" }}>
              {p.popular && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "4px 14px", borderRadius: 12, background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "white", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Most Popular</div>}
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.name}</h3>
              <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 4, color: "#06b6d4" }}>{p.price}</div>
              <p style={{ fontSize: 12, color: muted, marginBottom: 18 }}>{p.desc}</p>
              {p.features.map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 7, color: txt }}>
                  <CheckCircle2 size={14} color="#10b981" /> {f}
                </div>
              ))}
              <button onClick={() => router.push("/login")} style={{ width: "100%", marginTop: 16, padding: "11px 0", borderRadius: 10, border: p.popular ? "none" : `1px solid ${border}`, background: p.popular ? "linear-gradient(135deg,#06b6d4,#8b5cf6)" : "transparent", color: p.popular ? "white" : txt, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "60px 40px", textAlign: "center" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: 44, borderRadius: 18, background: "linear-gradient(135deg,rgba(6,182,212,0.08),rgba(139,92,246,0.08))", border: `1px solid ${border}` }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>Ready to Take Command?</h2>
          <p style={{ fontSize: 14, color: muted, marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>Join enterprises managing 50,000+ assets with complete visibility, automated security, and regulatory compliance.</p>
          <button onClick={() => router.push("/login")} style={{ padding: "13px 36px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(6,182,212,0.3)" }}>
            Start Free Trial <ArrowRight size={17} style={{ marginLeft: 6, verticalAlign: "middle" }} />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "32px 40px 20px", borderTop: `1px solid ${border}`, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Shield size={13} color="white" /></div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>AssetCommand</span>
            <span style={{ fontSize: 11, color: muted, marginLeft: 8 }}>by NeurQ AI Labs</span>
          </div>
          <p style={{ fontSize: 11, color: muted, margin: 0 }}>© 2026 NeurQ AI Labs Pvt Ltd. All rights reserved. Built in India 🇮🇳</p>
        </div>
      </footer>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
    </div>
  );
}
