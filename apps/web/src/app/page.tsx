"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Monitor, Ticket, Network, Package, BarChart3, Lock, Zap, ChevronRight,
  ArrowRight, CheckCircle2, Globe, Server, Cpu, Sun, Moon, Camera, Car, Laptop,
  Radio, FileText, AlertTriangle, Settings, Activity, Database, Eye, Wifi, HardDrive,
  RefreshCw, Terminal as TerminalIcon, Check, Users, DollarSign, Sparkles
} from "lucide-react";

/* ── Static Modules Data ── */
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
  const [theme, setTheme] = useState<"dark" | "light">("light");

  const L = theme === "light";
  const bg = L ? "#f9fafb" : "#020205";
  const card = L ? "#ffffff" : "rgba(10, 10, 15, 0.7)";
  const border = L ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.06)";
  const muted = L ? "#475569" : "#8a8f98";
  const txt = L ? "#0f172a" : "#f3f4f6";
  const hudBg = L ? "rgba(255, 255, 255, 0.85)" : "rgba(3, 3, 6, 0.85)";

  useEffect(() => {
    const s = localStorage.getItem("theme") as "dark" | "light" | null;
    const t = s || "light";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  function toggle() {
    const n = theme === "dark" ? "light" : "dark";
    setTheme(n);
    localStorage.setItem("theme", n);
    document.documentElement.setAttribute("data-theme", n);
  }

  // ─── CHAPTER 1: CMDB TOPOLOGY REROUTING STATE ───
  const [cmdbFailureSimulated, setCmdbFailureSimulated] = useState(false);
  const [selectedHudNode, setSelectedHudNode] = useState<string>("core-sw-01");
  const [swPacketCount, setSwPacketCount] = useState({ eth1: 1420, eth2: 2890 });

  useEffect(() => {
    const interval = setInterval(() => {
      setSwPacketCount(prev => ({
        eth1: prev.eth1 + Math.floor(Math.random() * 11) - 5,
        eth2: prev.eth2 + Math.floor(Math.random() * 15) - 7,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── CHAPTER 2: THE SECURE IMMUNE IMMERSIVE CLI REMEDIATION STATE ───
  const [radarAngle, setRadarAngle] = useState(0);
  const [radarPatched, setRadarPatched] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<string[]>([
    "// System secure. Telemetry idle.",
    "// Click \"1-Click Remediate & Patch\" to execute direct SSH shell fixes."
  ]);
  const [isPatching, setIsPatching] = useState(false);
  const [radarPatchingProgress, setRadarPatchingProgress] = useState(0);

  useEffect(() => {
    const radarInterval = setInterval(() => {
      setRadarAngle(prev => (prev + 3.2) % 360);
    }, 30);
    return () => clearInterval(radarInterval);
  }, []);

  // Sequential typing shell script mitigation simulation
  function handlePatchSecurity() {
    if (isPatching || radarPatched) return;
    setIsPatching(true);
    setSecurityLogs(["$ qs-ssh root@10.0.1.18 -p 22 --auth-key-vault"]);
    setRadarPatchingProgress(5);

    const scriptSteps = [
      { text: "⚡ [SSH] secure shell handshake established using ed25519 hash.", progress: 15 },
      { text: "$ systemctl stop vulnerable-service.service", progress: 30 },
      { text: "⚙️ Service daemon halted. Preparing secure downstream sweep...", progress: 45 },
      { text: "$ apt-get update && apt-get install --only-upgrade -y liblzma5", progress: 60 },
      { text: "📦 Fetching liblzma5:amd64 upstream replacement...", progress: 75 },
      { text: "$ sha256sum /usr/lib/liblzma.so.5.6.1", progress: 85 },
      { text: "🔒 Hash check: F4E82B7... Cryptographic match SECURE.", progress: 95 },
      { text: "✅ [SUCCESS] Mitigation verified. Radar sweep green.", progress: 100 }
    ];

    scriptSteps.forEach((step, idx) => {
      setTimeout(() => {
        setSecurityLogs(prev => [...prev, step.text]);
        setRadarPatchingProgress(step.progress);
        if (step.progress === 100) {
          setIsPatching(false);
          setRadarPatched(true);
        }
      }, (idx + 1) * 850);
    });
  }

  // ─── CHAPTER 3: KPI 3D CARD FLIP DECK ───
  const [kpiMode, setKpiMode] = useState<"legacy" | "optimized">("optimized");

  // ─── CHAPTER 4: ROI CALCULATOR ───
  const [roiAssets, setRoiAssets] = useState(2500);
  const [roiAgents, setRoiAgents] = useState(20);

  const tradCost = (roiAssets * 220 + roiAgents * 4200) * 12;
  const qsCost = (roiAssets * 60 + roiAgents * 1000) * 12;
  const netSavings = tradCost - qsCost;

  return (
    <div style={{ minHeight: "100vh", background: bg, color: txt, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif", transition: "background 0.5s, color 0.5s", overflowX: "hidden" }}>
      
      {/* ─── ATMOSPHERIC SLATE BACKDROP RAYS ─── */}
      <div style={{
        position: "absolute",
        top: "-10%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "80%",
        height: "700px",
        background: L
          ? "radial-gradient(ellipse at center, rgba(6, 182, 212, 0.04) 0%, rgba(139, 92, 246, 0.02) 50%, transparent 100%)"
          : "radial-gradient(ellipse at center, rgba(6, 182, 212, 0.07) 0%, rgba(139, 92, 246, 0.04) 50%, transparent 100%)",
        pointerEvents: "none",
        filter: "blur(120px)",
        zIndex: 0
      }} />
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 1400,
        backgroundImage: L
          ? "linear-gradient(rgba(6, 182, 212, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.04) 1px, transparent 1px)"
          : "linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        backgroundPosition: "center top",
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0.05) 80%, rgba(0,0,0,0))",
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0.05) 80%, rgba(0,0,0,0))",
        pointerEvents: "none",
        zIndex: 0
      }} />

      {/* ─── NAVIGATION BAR (APPLE GLASS STYLE) ─── */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "16px 6%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: L ? "rgba(255,255,255,0.75)" : "rgba(2, 2, 5, 0.65)",
        backdropFilter: "blur(30px) saturate(1.8)",
        WebkitBackdropFilter: "blur(30px) saturate(1.8)",
        borderBottom: `1px solid ${border}`,
        boxShadow: L ? "0 4px 30px rgba(15, 23, 42, 0.03)" : "none",
        transition: "background 0.3s"
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(6, 182, 212, 0.25)"
          }}>
            <img src="/favicon.png" alt="QS" style={{ width: 20, height: 20, borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.04em" }}>QS Asset</span>
        </a>
        
        <div className="landing-nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[
            { l: "Nerve System", h: "#nerve-system" },
            { l: "Immune Radar", h: "#immune-system" },
            { l: "3D Comparison", h: "#3d-comparison" },
            { l: "Savings Engine", h: "#savings-engine" },
            { l: "12 Modules", h: "#modules-grid" }
          ].map(t => (
            <a key={t.l} href={t.h} style={{ fontSize: 13, fontWeight: 600, color: muted, textDecoration: "none", transition: "color 0.2s" }}>{t.l}</a>
          ))}
          <button onClick={toggle} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${border}`, cursor: "pointer", background: L ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)", color: muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {L ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button onClick={() => router.push("/login")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(6, 182, 212, 0.2)", display: "flex", alignItems: "center", gap: 6, letterSpacing: "-0.01em" }}>
            Sign In <ArrowRight size={13} />
          </button>
        </div>
      </nav>

      {/* ─── HERO CHAPTER: THE GENESIS (APPLE DRAMATIC STYLE) ─── */}
      <section style={{ paddingTop: 180, paddingBottom: 110, textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 940, margin: "0 auto", padding: "0 24px" }}>
          
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 18px",
            borderRadius: 30,
            background: L ? "rgba(6, 182, 212, 0.05)" : "rgba(6, 182, 212, 0.06)",
            border: `1px solid ${L ? 'rgba(6,182,212,0.15)' : 'rgba(6, 182, 212, 0.2)'}`,
            marginBottom: 32,
            fontSize: 11,
            fontWeight: 800,
            color: "#06b6d4",
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }}>
            <Sparkles size={12} /> The First Autonomic IT Management Infrastructure
          </div>
          
          <h1 style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.05em", marginBottom: 28, color: txt }}>
            Control Every Device.<br />
            <span style={{ background: "linear-gradient(135deg, #06b6d4 10%, #8b5cf6 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Secure Every Network.
            </span>
          </h1>

          <p style={{ fontSize: 20, lineHeight: 1.6, color: muted, maxWidth: 740, margin: "0 auto 44px", letterSpacing: "-0.015em" }}>
            Witness a fully self-healing network CMDB topology, secure CVE hotfixing, and automated ITSM ticketing consolidated into one breathtaking pane.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 60 }}>
            <button onClick={() => router.push("/register")} style={{ padding: "16px 36px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 28px rgba(6, 182, 212, 0.3)", display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.02em" }}>
              Get Started Free <ChevronRight size={16} />
            </button>
            <a href="#nerve-system" style={{ padding: "16px 32px", borderRadius: 10, border: `1.5px solid ${border}`, background: card, color: txt, fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", letterSpacing: "-0.02em" }}>
              Explore the Chapters
            </a>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
            <span style={{ fontSize: 12, color: muted, fontWeight: 700, letterSpacing: "0.02em" }}>
              DPDP ACT 2023 COMPLIANT • SECURE CRYPTO AUDIT HASH CHAINS
            </span>
          </div>

        </div>
      </section>

      {/* ─── CHAPTER 1: THE NERVE SYSTEM (AUTONOMIC CMDB TOPOLOGY) ─── */}
      <section id="nerve-system" style={{ padding: "100px 6%", maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 64, alignItems: "center" }}>
          
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#06b6d4", letterSpacing: "0.1em", textTransform: "uppercase" }}>CHAPTER 01</div>
            <h2 style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.04em", marginTop: 8, lineHeight: 1.1 }}>
              The Nerve System.<br />Self-Healing CMDB.
            </h2>
            <p style={{ fontSize: 15, color: muted, marginTop: 18, lineHeight: 1.7 }}>
              Traditional spreadsheets are obsolete static records. QS Asset polls every physical router and switch continuously using LLDP/CDP MIB walks, charting dynamic neighborhood relations.
            </p>
            <p style={{ fontSize: 15, color: muted, marginTop: 12, lineHeight: 1.7 }}>
              When a link goes down, the system does not fail. It automatically detects the severance, emits an SNMP trap alert, and reroutes production traffic through secondary active layers in milliseconds.
            </p>

            <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
              <div style={{ flex: 1, padding: "14px", background: L ? "#f8fafc" : "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${border}`, boxShadow: L ? "0 4px 10px rgba(0,0,0,0.01)" : "none" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: muted }}>ETH1/1 PORT</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: cmdbFailureSimulated ? "#ef4444" : "#10b981", marginTop: 4 }}>
                  {cmdbFailureSimulated ? "LINK DOWN" : `${swPacketCount.eth1} Pkts/s`}
                </div>
              </div>
              <div style={{ flex: 1, padding: "14px", background: L ? "#f8fafc" : "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${border}`, boxShadow: L ? "0 4px 10px rgba(0,0,0,0.01)" : "none" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: muted }}>ETH1/2 BACKUP</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#8b5cf6", marginTop: 4 }}>
                  {cmdbFailureSimulated ? `${swPacketCount.eth2 * 2} Pkts/s` : `${swPacketCount.eth2} Pkts/s`}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live SVG Widescreen Console Mockup */}
          <div style={{
            background: hudBg,
            border: `1.5px solid ${border}`,
            borderRadius: 24,
            padding: 24,
            boxShadow: L
              ? "0 30px 70px -15px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.02)"
              : "0 20px 80px rgba(6, 182, 212, 0.08)",
            position: "relative",
            minHeight: 460,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: cmdbFailureSimulated ? "#ef4444" : "#06b6d4", boxShadow: cmdbFailureSimulated ? "0 0 8px #ef4444" : "0 0 8px #06b6d4" }} />
                <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.02em", color: txt }}>
                  TOPOLOGY MONITOR: {cmdbFailureSimulated ? "REROUTED" : "OPTIMAL"}
                </span>
              </div>
              <button
                onClick={() => setCmdbFailureSimulated(!cmdbFailureSimulated)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: `1px solid ${cmdbFailureSimulated ? "#10b981" : "#ef4444"}`,
                  background: "transparent",
                  color: cmdbFailureSimulated ? "#10b981" : "#ef4444",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <RefreshCw size={11} className={cmdbFailureSimulated ? "spin" : ""} />
                {cmdbFailureSimulated ? "Restore Connection" : "Simulate Link Failure"}
              </button>
            </div>

            {/* Live Interactive Graph Canvas Area */}
            <div style={{
              flex: 1,
              position: "relative",
              border: `1.5px dashed ${border}`,
              borderRadius: 14,
              background: L ? "#ffffff" : "rgba(2, 2, 5, 0.4)",
              boxShadow: L ? "inset 0 2px 8px rgba(15, 23, 42, 0.02)" : "none",
              minHeight: 300,
              overflow: "hidden"
            }}>
              <svg style={{ width: "100%", height: "100%", minHeight: 300 }}>
                {/* Links */}
                {/* Severed direct path */}
                <line
                  x1="80" y1="150" x2="420" y2="150"
                  stroke={cmdbFailureSimulated ? "#ef4444" : "#06b6d4"}
                  strokeWidth={cmdbFailureSimulated ? "2" : "3.5"}
                  strokeDasharray={cmdbFailureSimulated ? "5 5" : "0"}
                  style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
                />
                
                {/* Secondary Detour Path */}
                <path
                  d="M 80 150 Q 250 40 420 150"
                  fill="none"
                  stroke={cmdbFailureSimulated ? "#8b5cf6" : "rgba(139, 92, 246, 0.2)"}
                  strokeWidth="2.5"
                  style={{ transition: "stroke 0.3s" }}
                />

                <path
                  d="M 80 150 Q 250 260 420 150"
                  fill="none"
                  stroke="rgba(100, 116, 139, 0.15)"
                  strokeWidth="1.5"
                />

                {/* Packet Animations */}
                {!cmdbFailureSimulated ? (
                  <circle r="4" fill="#06b6d4" style={{ filter: "drop-shadow(0 0 4px #06b6d4)" }}>
                    <animateMotion dur="2s" repeatCount="indefinite" path="M 80 150 L 420 150" />
                  </circle>
                ) : (
                  <>
                    <circle r="4.5" fill="#a78bfa" style={{ filter: "drop-shadow(0 0 6px #a78bfa)" }}>
                      <animateMotion dur="1.8s" repeatCount="indefinite" path="M 80 150 Q 250 40 420 150" />
                    </circle>
                    <circle r="3.5" fill="#a78bfa">
                      <animateMotion dur="1.8s" begin="0.9s" repeatCount="indefinite" path="M 80 150 Q 250 40 420 150" />
                    </circle>
                  </>
                )}

                {/* Node Icons */}
                {[
                  { id: "fw-01", name: "edge-fw-01", label: "Firewall", cx: 80, cy: 150, color: "#ef4444", icon: "🛡️" },
                  { id: "core-sw-01", name: "core-sw-01", label: "Core Switch", cx: 250, cy: 40, color: "#8b5cf6", icon: "🔌" },
                  { id: "prod-db-01", name: "prod-db-01", label: "Database", cx: 420, cy: 150, color: "#10b981", icon: "🗄️" }
                ].map(n => {
                  const isSel = selectedHudNode === n.id;
                  return (
                    <g key={n.id} onClick={() => setSelectedHudNode(n.id)} style={{ cursor: "pointer" }}>
                      {isSel && <circle cx={n.cx} cy={n.cy} r="20" fill={`${n.color}15`} stroke={n.color} strokeWidth="1" strokeDasharray="3 3" />}
                      <circle cx={n.cx} cy={n.cy} r="14" fill={L ? "#ffffff" : "#020205"} stroke={n.color} strokeWidth="2.5" />
                      <text x={n.cx} y={n.cy + 1} textAnchor="middle" alignmentBaseline="middle" fontSize="13">{n.icon}</text>
                      <text x={n.cx} y={n.cy + 25} textAnchor="middle" fill={txt} fontSize="10" fontWeight="800">{n.name}</text>
                    </g>
                  );
                })}
              </svg>

              {/* Server Warning Card overlay */}
              {cmdbFailureSimulated && (
                <div style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  right: 12,
                  background: L ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.12)",
                  border: "1px solid #ef4444",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  color: L ? "#991b1b" : "#fca5a5",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  animation: "pulse 2s infinite"
                }}>
                  <AlertTriangle size={14} color="#ef4444" />
                  <span>Port xe-0/0/1 state down. Detour path Core-SW-01 activated successfully.</span>
                </div>
              )}
            </div>

            {/* Node Info Inspection Detail Deck */}
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 12 }}>
              <div style={{ padding: 12, background: L ? "#f8fafc" : "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${border}` }}>
                <span style={{ color: muted }}>Discovered Node</span>
                <h4 style={{ fontWeight: 800, marginTop: 2, color: txt }}>
                  {selectedHudNode === "fw-01" ? "edge-fw-01" : selectedHudNode === "prod-db-01" ? "prod-db-01" : "core-sw-01"}
                </h4>
              </div>
              <div style={{ padding: 12, background: L ? "#f8fafc" : "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${border}` }}>
                <span style={{ color: muted }}>IP Specs</span>
                <h4 style={{ fontWeight: 800, marginTop: 2, color: txt }}>
                  {selectedHudNode === "fw-01" ? "10.0.1.1" : selectedHudNode === "prod-db-01" ? "10.0.1.18" : "10.0.1.5"}
                </h4>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── CHAPTER 2: THE IMMUNE SYSTEM (SECURITY IMMERSIVE COCKPIT SCANNER) ─── */}
      <section id="immune-system" style={{ padding: "100px 6%", maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 64, alignItems: "center" }}>
          
          {/* Immersive Sweeper & Retro Hacker CLI Console */}
          <div style={{
            background: hudBg,
            border: `1.5px solid ${border}`,
            borderRadius: 24,
            padding: 24,
            boxShadow: L
              ? "0 30px 70px -15px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.02)"
              : "0 20px 80px rgba(6, 182, 212, 0.08)",
            position: "relative",
            minHeight: 480,
            display: "flex",
            flexDirection: "column"
          }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: radarPatched ? "#10b981" : "#ef4444", boxShadow: radarPatched ? "0 0 8px #10b981" : "0 0 8px #ef4444" }} />
                <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.02em", color: txt }}>
                  IMMUNE RADAR: {radarPatched ? "SECURED" : "2 HAZARDS FOUND"}
                </span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: radarPatched ? "#10b981" : "#ef4444" }}>
                System: {radarPatched ? "100%" : "62%"} Clean
              </span>
            </div>

            {/* Radar and terminal columns */}
            <div className="radar-terminal-grid" style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: 20, flex: 1 }}>
              
              {/* SVG Sweep Radar */}
              <div style={{
                border: `1px solid ${border}`,
                borderRadius: 14,
                background: L ? "#ffffff" : "rgba(2, 2, 5, 0.6)",
                boxShadow: L ? "0 8px 24px rgba(15, 23, 42, 0.02)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                height: 180
              }}>
                <svg style={{ width: 140, height: 140 }}>
                  <circle cx="70" cy="70" r="60" stroke={border} fill="none" strokeWidth="1" />
                  <circle cx="70" cy="70" r="40" stroke={border} fill="none" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx="70" cy="70" r="20" stroke={border} fill="none" strokeWidth="1" />
                  <line x1="70" y1="5" x2="70" y2="135" stroke={border} strokeWidth="0.8" />
                  <line x1="5" y1="70" x2="135" y2="70" stroke={border} strokeWidth="0.8" />

                  {/* Sweep wedge */}
                  <path
                    d="M 70 70 L 70 10 A 60 60 0 0 1 130 70 Z"
                    fill="url(#radarSweepGlow)"
                    transform={`rotate(${radarAngle} 70 70)`}
                  />

                  <defs>
                    <linearGradient id="radarSweepGlow" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={radarPatched ? "#10b981" : "#ef4444"} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={radarPatched ? "#10b981" : "#ef4444"} stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Hazard Nodes */}
                  <circle cx="45" cy="45" r="4.5" fill={radarPatched ? "#10b981" : "#ef4444"} className="pulse" />
                  <circle cx="100" cy="90" r="4.5" fill={radarPatched ? "#10b981" : "#f59e0b"} className="pulse" />
                </svg>
              </div>

              {/* Immersive Typewriter Terminal CLI */}
              <div style={{
                background: "#010103",
                border: L ? "1.5px solid rgba(0, 0, 0, 0.08)" : "1.5px solid rgba(255,255,255,0.04)",
                borderRadius: 14,
                padding: "16px",
                fontFamily: "monospace",
                fontSize: 10.5,
                color: "#10b981",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                height: 180,
                overflowY: "auto"
              }}>
                {securityLogs.map((log, idx) => (
                  <div key={idx} style={{ lineBreak: "anywhere", opacity: 0.9 }}>{log}</div>
                ))}
                {isPatching && <div className="blink" style={{ color: "#ef4444" }}>█ Mitigating...</div>}
              </div>

            </div>

            {/* Mitigation button with custom state indicator */}
            <div style={{ marginTop: 20 }}>
              {isPatching && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: muted }}>Deploying Autonomic Shell Patch...</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", marginLeft: "auto" }}>{radarPatchingProgress}%</span>
                </div>
              )}

              <button
                onClick={handlePatchSecurity}
                disabled={isPatching || radarPatched}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 10,
                  border: "none",
                  background: radarPatched ? "#10b981" : "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: (isPatching || radarPatched) ? "not-allowed" : "pointer",
                  boxShadow: radarPatched ? "none" : "0 4px 20px rgba(239, 68, 68, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <Shield size={14} />
                {radarPatched ? "Vulnerability Resolved (100% Secure)" : isPatching ? "Remediating Hotfixes..." : "Execute 1-Click Remediate & Patch"}
              </button>
            </div>

          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase" }}>CHAPTER 02</div>
            <h2 style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.04em", marginTop: 8, lineHeight: 1.1 }}>
              The Immune System.<br />1-Click Remediation.
            </h2>
            <p style={{ fontSize: 15, color: muted, marginTop: 18, lineHeight: 1.7 }}>
              Alert fatigue is an administrative bottleneck. When our vulnerability sweep radar maps active threat vectors (CVE vulnerabilities), you do not log static Jira tasks to resolve next quarter.
            </p>
            <p style={{ fontSize: 15, color: muted, marginTop: 12, lineHeight: 1.7 }}>
              You launch direct shell remediation. From stopping outdated service daemons, pulling secure downstream libraries, validating cryptographic SHA hashes, to restarting active systems securely. Remediated in seconds.
            </p>
          </div>

        </div>
      </section>

      {/* ─── CHAPTER 3: THE UNIFIED SHIFT (3D COMPARISON FLIP) ─── */}
      <section id="3d-comparison" style={{ padding: "100px 6%", maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 64, alignItems: "center" }}>
          
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#8b5cf6", letterSpacing: "0.1em", textTransform: "uppercase" }}>CHAPTER 03</div>
            <h2 style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.04em", marginTop: 8, lineHeight: 1.1 }}>
              The Unified Shift.<br />Consolidated in a Flip.
            </h2>
            <p style={{ fontSize: 15, color: muted, marginTop: 18, lineHeight: 1.7 }}>
              Stop context switching across separate tabs. Witness the visual metamorphosis when you unify point solutions (ITAM + NMS + ITSM + CCTV + patch workflows) under one single operational console.
            </p>
            <p style={{ fontSize: 15, color: muted, marginTop: 12, lineHeight: 1.7 }}>
              Toggle between a traditional, fractured IT suite and our autonomic stack. Watch the metrics flip in beautiful 3D cards.
            </p>

            <div style={{
              display: "inline-flex",
              background: L ? "#e2e8f0" : "rgba(255,255,255,0.02)",
              border: `1px solid ${border}`,
              padding: 4,
              borderRadius: 10,
              marginTop: 28,
              boxShadow: L ? "inset 0 1px 2px rgba(0,0,0,0.05)" : "none"
            }}>
              <button
                onClick={() => setKpiMode("legacy")}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: kpiMode === "legacy" ? "#ef4444" : "transparent",
                  color: kpiMode === "legacy" ? "white" : muted,
                  transition: "all 0.15s"
                }}
              >
                Traditional Stack
              </button>
              <button
                onClick={() => setKpiMode("optimized")}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: kpiMode === "optimized" ? "#10b981" : "transparent",
                  color: kpiMode === "optimized" ? "white" : muted,
                  transition: "all 0.15s"
                }}
              >
                QS Autonomic Core
              </button>
            </div>
          </div>

          {/* 3D Flipping Cards Deck */}
          <div className="kpi-flip-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { title: "Average MTTR", legacyVal: "18.2 Hours", legacyDesc: "Disconnected tickets, manually researching hardware specs.", optVal: "12 Minutes", optDesc: "Automated correlation, instant hardware spec injections.", color: "#06b6d4" },
              { title: "CVE Remediation", legacyVal: "14.5 Days", legacyDesc: "Weekly schedules, downloading packages manually, testing hotfixes.", optVal: "4 Minutes", optDesc: "1-Click automated hotfix deploy, immediate scan validation.", color: "#ef4444" },
              { title: "Annual Licensing", legacyVal: "₹18.5L / yr", legacyDesc: "Seat licensing thresholds, disjointed modules, costly NMS add-ons.", optVal: "₹3.9L / yr", optDesc: "Flat module licensing, massive savings, unlimited seats.", color: "#8b5cf6" },
              { title: "Network Uptime", legacyVal: "99.2% Uptime", legacyDesc: "Blindspots on remote ports, missed SNMP polling loops.", optVal: "99.99% Uptime", optDesc: "Real-time LLDP neighbor routing, continuous alert engine.", color: "#10b981" },
            ].map((cardItem, idx) => {
              const isFlipped = kpiMode === "legacy";
              return (
                <div key={idx} style={{ height: 200, perspective: 1000 }}>
                  <div style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "none"
                  }}>
                    {/* Front: QS Autonomic */}
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      background: card,
                      border: `1.5px solid ${border}`,
                      borderRadius: 16,
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      textAlign: "left",
                      boxShadow: L ? "0 10px 30px rgba(15, 23, 42, 0.02)" : "none"
                    }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: cardItem.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cardItem.title}</span>
                          <Zap size={12} color="#10b981" />
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6, color: "#10b981" }}>{cardItem.optVal}</div>
                      </div>
                      <p style={{ fontSize: 11.5, lineHeight: 1.5, color: muted, margin: 0 }}>{cardItem.optDesc}</p>
                    </div>

                    {/* Back: Legacy */}
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      background: card,
                      border: `1.5px solid #ef4444`,
                      borderRadius: 16,
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      textAlign: "left",
                      transform: "rotateY(180deg)",
                      boxShadow: L ? "0 10px 30px rgba(239, 68, 68, 0.03)" : "none"
                    }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cardItem.title}</span>
                          <AlertTriangle size={12} color="#ef4444" />
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6, color: "#ef4444" }}>{cardItem.legacyVal}</div>
                      </div>
                      <p style={{ fontSize: 11.5, lineHeight: 1.5, color: muted, margin: 0 }}>{cardItem.legacyDesc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ─── CHAPTER 4: THE SAVINGS ENGINE (ROI GRAPH CALCULATOR) ─── */}
      <section id="savings-engine" style={{ padding: "100px 6%", maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 64, alignItems: "center" }}>
          
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>CHAPTER 04</div>
            <h2 style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.04em", marginTop: 8, lineHeight: 1.1 }}>
              The Financial Engine.<br />Consolidated Spending.
            </h2>
            <p style={{ fontSize: 15, color: muted, marginTop: 18, lineHeight: 1.7 }}>
              License proliferation degrades operational efficiency. By consolidating individual point systems into one unified subscription plan, save up to 75% on licensing spend.
            </p>
            
            <div style={{ marginTop: 32, display: "grid", gap: 24 }}>
              {/* Slider 1: Managed Assets */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, fontWeight: 800 }}>
                  <span>Managed Network Assets</span>
                  <span style={{ color: "#06b6d4" }}>{roiAssets.toLocaleString()} Devices</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="15000"
                  step="250"
                  value={roiAssets}
                  onChange={e => setRoiAssets(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "#06b6d4",
                    background: L ? "#e2e8f0" : "#111116",
                    height: 5,
                    borderRadius: 3,
                    outline: "none"
                  }}
                />
              </div>

              {/* Slider 2: IT support agents */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, fontWeight: 800 }}>
                  <span>Support Desk Seats</span>
                  <span style={{ color: "#8b5cf6" }}>{roiAgents} Seats</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="300"
                  step="5"
                  value={roiAgents}
                  onChange={e => setRoiAgents(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "#8b5cf6",
                    background: L ? "#e2e8f0" : "#111116",
                    height: 5,
                    borderRadius: 3,
                    outline: "none"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Cost comparison bar graphs panel */}
          <div style={{
            background: hudBg,
            border: `1.5px solid ${border}`,
            borderRadius: 24,
            padding: 32,
            boxShadow: L
              ? "0 30px 70px -15px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.02)"
              : "0 20px 80px rgba(6, 182, 212, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 24
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>YOUR ANNUALLY RECOVERED SPEND</div>
              <div style={{
                fontSize: 40,
                fontWeight: 950,
                background: "linear-gradient(135deg, #06b6d4, #10b981)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginTop: 6,
                letterSpacing: "-0.04em"
              }}>
                ₹{netSavings.toLocaleString("en-IN")} / yr
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Competitor Spend Bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                  <span style={{ color: "#ef4444" }}>Legacy fragmented software stack</span>
                  <span>₹{tradCost.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "rgba(239, 68, 68, 0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: "100%", height: "100%", background: "#ef4444", borderRadius: 4 }} />
                </div>
              </div>

              {/* QS Asset Spend Bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                  <span style={{ color: "#10b981" }}>QS Autonomic flat plan</span>
                  <span>₹{qsCost.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "rgba(16, 185, 129, 0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.max(8, (qsCost / tradCost) * 100)}%`,
                    height: "100%",
                    background: "#10b981",
                    borderRadius: 4,
                    transition: "width 0.4s ease"
                  }} />
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16, fontSize: 11.5, color: muted, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
              <CheckCircle2 size={14} color="#10b981" /> Consolidates NMS, ITSM, and ITAM seat costs by 75%.
            </div>
          </div>

        </div>
      </section>

      {/* ─── 12 INTEGRATED MODULES COHESIVE SYSTEM ─── */}
      <section id="modules-grid" style={{ padding: "100px 6%", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.04em", marginBottom: 16 }}>
            12 Cohesive Modules. One Autonomic Heart.
          </h2>
          <p style={{ fontSize: 16, color: muted, maxWidth: 640, margin: "0 auto", lineHeight: 1.7 }}>
            Consolidate fragmented point solutions into a single interface. SNMP alerts trigger automated ITSM service tickets; CVE alerts run automated CLI patches.
          </p>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {MODULES.map(m => {
            const IconComp = m.icon;
            return (
              <div
                key={m.title}
                style={{
                  padding: 28,
                  borderRadius: 16,
                  background: card,
                  border: `1.5px solid ${border}`,
                  transition: "all 0.3s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
                className="module-card-hover"
              >
                <div>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${m.color}12`, display: "flex", alignItems: "center", justifyContent: "center", color: m.color, marginBottom: 18 }}>
                    <IconComp size={20} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: txt }}>{m.title}</h3>
                  <p style={{ fontSize: 12.5, lineHeight: 1.6, color: muted, margin: "0 0 16px" }}>{m.desc}</p>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {m.kpis.map(k => (
                    <span key={k} style={{ fontSize: 10.5, padding: "4px 10px", borderRadius: 6, background: `${m.color}08`, color: m.color, fontWeight: 700 }}>{k}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── COMPARATIVE FEATURE CAPABILITY MATRIX GRID ─── */}
      <section style={{ padding: "100px 6%", maxWidth: 940, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em" }}>Capability Comparison Grid</h2>
          <p style={{ fontSize: 15, color: muted, marginTop: 8 }}>See how QS Asset consolidates legacy enterprise platforms.</p>
        </div>
        
        <div style={{ borderRadius: 18, overflow: "hidden", border: `1.5px solid ${border}`, background: card, boxShadow: L ? "0 10px 40px rgba(0, 0, 0, 0.02)" : "none" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: L ? "#f8fafc" : "rgba(10,10,15,0.8)" }}>
                <th style={{ textAlign: "left", padding: "16px 20px", fontWeight: 700, color: txt }}>Feature Specs</th>
                <th style={{ padding: "16px 20px", fontWeight: 900, color: "#06b6d4", textAlign: "center" }}>QS Asset</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, color: muted, textAlign: "center" }}>Ivanti</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, color: muted, textAlign: "center" }}>ManageEngine</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r, i) => (
                <tr key={r.feature} style={{ borderTop: `1.5px solid ${border}`, background: i % 2 === 0 ? "transparent" : (L ? "rgba(241, 245, 249, 0.4)" : "rgba(255,255,255,0.01)") }}>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: txt }}>{r.feature}</td>
                  <td style={{ padding: "14px 20px", textAlign: "center" }}><CheckCircle2 size={16} color="#10b981" style={{ margin: "0 auto" }} /></td>
                  <td style={{ padding: "14px 20px", textAlign: "center" }}>{r.ivanti ? <CheckCircle2 size={16} color="#64748b" style={{ margin: "0 auto" }} /> : <span style={{ color: muted }}>—</span>}</td>
                  <td style={{ padding: "14px 20px", textAlign: "center" }}>{r.manage ? <CheckCircle2 size={16} color="#64748b" style={{ margin: "0 auto" }} /> : <span style={{ color: muted }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" style={{ padding: "100px 6%", maxWidth: 1040, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", marginBottom: 12 }}>Simple, Transparent Pricing</h2>
        <p style={{ fontSize: 15, color: muted, marginBottom: 44 }}>Unified flat-fee subscriptions. No mandatory service lock-ins.</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "start" }}>
          {[
            { name: "Starter", price: 0, annual: 0, desc: "Up to 5 assets", features: ["IT Asset Tracking", "4 Users", "Basic Reports", "Email Support", "Community Access"], popular: false, cta: "Start Free" },
            { name: "Professional", price: 4999, annual: 3999, desc: "Unlimited assets", features: ["All 12 Modules", "Unlimited Users", "Vulnerability Scanning", "ITSM + SLA Engine", "Priority Support", "API Access"], popular: true, cta: "Start 14-Day Trial" },
            { name: "Enterprise", price: -1, annual: -1, desc: "On-premise + SaaS", features: ["Everything in Pro", "On-Premise Deploy", "SSO / SAML / LDAP", "Dedicated CSM", "Custom SLA", "White-Label Option"], popular: false, cta: "Talk to Sales" },
          ].map(p => (
            <div key={p.name} style={{
              borderRadius: 18,
              padding: p.popular ? "2px" : 0,
              background: p.popular ? "linear-gradient(135deg, #06b6d4, #8b5cf6)" : "transparent",
              boxShadow: L
                ? (p.popular ? "0 25px 50px -12px rgba(6, 182, 212, 0.15)" : "0 15px 35px -10px rgba(15, 23, 42, 0.05)")
                : "none"
            }}>
              <div style={{ padding: "34px 24px", borderRadius: p.popular ? 16 : 18, background: card, border: p.popular ? "none" : `1.5px solid ${border}`, position: "relative", textAlign: "left" }}>
                {p.popular && <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", padding: "4px 16px", borderRadius: "0 0 8px 8px", background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", color: "white", fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>⚡ POPULAR</div>}
                
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, marginTop: p.popular ? 8 : 4, color: txt }}>{p.name}</h3>
                
                {p.price === 0 ? (
                  <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4, color: txt }}>Free</div>
                ) : p.price < 0 ? (
                  <div><div style={{ fontSize: 26, fontWeight: 900, color: txt }}>Custom</div><div style={{ fontSize: 11, color: muted }}>Tailored SLA models</div></div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 34, fontWeight: 900, color: txt }}>₹{p.annual.toLocaleString("en-IN")}</span>
                      <span style={{ fontSize: 12, color: muted }}>/mo</span>
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 12, color: muted, marginBottom: 24, marginTop: 6 }}>{p.desc}</p>
                
                <div style={{ display: "grid", gap: 10 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: txt, fontWeight: 600 }}>
                      <CheckCircle2 size={14} color="#10b981" /> {f}
                    </div>
                  ))}
                </div>

                <button onClick={() => router.push(p.price < 0 ? "/contact" : "/register")} style={{ width: "100%", marginTop: 28, padding: "12px 0", borderRadius: 10, border: p.popular ? "none" : `1.5px solid ${border}`, background: p.popular ? "linear-gradient(135deg, #06b6d4, #0891b2)" : "transparent", color: p.popular ? "white" : txt, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                  {p.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ padding: "80px 6% 36px", borderTop: `1.5px solid ${border}`, maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src="/favicon.png" alt="QS" style={{ width: 17, height: 17, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em" }}>QS Asset</span>
            </div>
            <p style={{ fontSize: 12.5, color: muted, lineHeight: 1.7, maxWidth: 300 }}>
              Autonomous IT asset lifecycle management, real-time SNMP topology, and security mitigation engine. Crafted by NeurQ AI Labs.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, color: muted }}>Product</h4>
            {[{ l: "Nerve System", h: "#nerve-system" }, { l: "Immune Radar", h: "#immune-system" }, { l: "Pricing", h: "#pricing" }].map(a => (
              <a key={a.l} href={a.h} style={{ display: "block", fontSize: 13, color: txt, textDecoration: "none", marginBottom: 10, opacity: 0.7, fontWeight: 600 }}>{a.l}</a>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, color: muted }}>Company</h4>
            {[{ l: "Contact Sales", h: "/contact" }].map(a => (
              <a key={a.l} href={a.h} style={{ display: "block", fontSize: 13, color: txt, textDecoration: "none", marginBottom: 10, opacity: 0.7, fontWeight: 600 }}>{a.l}</a>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, color: muted }}>Legal</h4>
            {[{ l: "Privacy Policy", h: "/privacy" }, { l: "Terms of Service", h: "/terms" }].map(a => (
              <a key={a.l} href={a.h} style={{ display: "block", fontSize: 13, color: txt, textDecoration: "none", marginBottom: 10, opacity: 0.7, fontWeight: 600 }}>{a.l}</a>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, borderTop: `1px solid ${border}` }}>
          <p style={{ fontSize: 12, color: muted, margin: 0 }}>&copy; 2026 NeurQ AI Labs Pvt Ltd. All rights reserved. Crafted in India 🇮🇳</p>
        </div>
      </footer>

      {/* ─── PREMIUM SCROLL EFFECTS & INTERACTIONS ─── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.96); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .spin {
          animation: spin 1.5s linear infinite;
        }
        .blink {
          animation: blink 1s step-end infinite;
        }
        .pulse {
          animation: pulse 2.5s infinite ease-in-out;
        }
        .module-card-hover {
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.01) !important;
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .module-card-hover:hover {
          transform: translateY(-6px) !important;
          border-color: rgba(6, 182, 212, 0.35) !important;
          box-shadow: 0 20px 40px rgba(6, 182, 212, 0.1) !important;
        }
        @media (max-width: 1024px) {
          .landing-nav-links { display: none !important; }
          h1 { font-size: 52px !important; }
        }
        @media (max-width: 768px) {
          section > div[style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; gap: 32px !important; }
          .kpi-flip-grid { grid-template-columns: 1fr !important; }
          #pricing > div { grid-template-columns: 1fr !important; max-width: 400px !important; margin: 0 auto !important; }
          #pricing > div > div { width: 100% !important; }
          footer > div { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .radar-terminal-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  );
}
