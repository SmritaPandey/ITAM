"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Package, Ticket, Network, Shield, Camera, MonitorPlay, Zap, Key,
  BarChart3, Users, Settings, Radar, Search, HelpCircle, ChevronDown,
  Play, Keyboard, Headphones, Server, Monitor, Building2, ShieldCheck,
  ArrowRight, Sparkles, CheckCircle2, Terminal, Info,
} from "lucide-react";
import { useWalkthrough, WalkthroughStep } from "@/components/HelpSystem";

/* ── Walkthrough definitions ──────────────────────────────── */
const DASHBOARD_TOUR: WalkthroughStep[] = [
  { target: ".sidebar-brand", title: "Navigation", content: "Use the sidebar to navigate between modules. It's organized into Overview, Asset Management, Operations, Monitoring, and Management sections.", position: "right" },
  { target: ".stats-grid", title: "KPI Cards", content: "These cards show real-time metrics pulled from your database. Click any card to drill down into that module.", position: "bottom" },
  { target: ".topbar-search", title: "Global Search (⌘K)", content: "Press ⌘K to search across assets, tickets, users, and pages instantly. Results update as you type.", position: "bottom" },
  { target: ".topbar-actions", title: "Quick Actions", content: "Toggle dark/light theme, view notifications, and access your profile settings from here.", position: "bottom" },
  { target: ".charts-grid", title: "Analytics Charts", content: "Interactive charts show asset distribution by type and status. Click chart segments to filter the assets view.", position: "bottom" },
];

/* ── FAQ data ─────────────────────────────────────────────── */
const FAQ = [
  { q: "How do I run my first network scan?", a: "Navigate to Discovery in the sidebar. Click 'New Scan', enter your subnet (e.g. 192.168.1.0/24), select the scan type (Ping Sweep, Port Scan, or Full Scan), and click Start. Results appear in real-time." },
  { q: "How does agentless discovery work?", a: "QS Asset uses ICMP ping, TCP port scanning, and Nmap for agentless discovery. No software needs to be installed on target devices. For deeper info, configure SNMP or WMI credentials in the Credential Vault." },
  { q: "How do I deploy the agent?", a: "Go to Discovery → Agent Downloads. Download the agent for your OS (Windows, macOS, Linux). Deploy it to staff machines — it reports hardware, software, and health data back to QS Asset automatically." },
  { q: "What are SLA policies?", a: "SLA policies define response and resolution time targets for tickets by priority level. Go to Settings → SLA Policies to customize. Default policies: Critical (1hr response), High (4hr), Medium (8hr), Low (24hr)." },
  { q: "How do automation rules work?", a: "Go to Automation → Rules. Each rule has a trigger (e.g. 'device goes offline') and an action (e.g. 'create ticket'). Rules fire automatically when events occur. You can set cooldown periods to prevent duplicates." },
  { q: "Can I export data to CSV/PDF?", a: "Yes! Go to Reports, select the report type (Asset Inventory, Ticket Summary, Compliance, Executive), and click Download. Both CSV and PDF formats are available." },
  { q: "How do I manage user roles?", a: "Go to Users → Roles. QS Asset comes with 4 default roles: Tenant Admin, IT Admin, Staff, and Employee. You can edit permissions for each role or create custom roles." },
  { q: "Is my data encrypted?", a: "Yes. All scan credentials (WMI, SSH, SNMP) are encrypted at rest using AES-256-CBC via the Credential Vault. Database connections use TLS. Passwords are hashed with bcrypt (12 rounds)." },
  { q: "How do I set up CCTV monitoring?", a: "Go to Monitoring → CCTV. Add cameras by entering their IP address and RTSP stream URL. QS Asset will probe the camera and show live status, recording state, and event logs." },
  { q: "What's the difference between Discovery and Network (NMS)?", a: "Discovery is for finding new devices on your network. NMS (Network Management System) is for ongoing monitoring of known network devices — health checks, topology mapping, SNMP polling, and alerts." },
];

/* ── Keyboard shortcuts ───────────────────────────────────── */
const SHORTCUTS = [
  { keys: "⌘K", desc: "Open global search" },
  { keys: "⌘/", desc: "Toggle sidebar" },
  { keys: "N", desc: "New asset / ticket (context-dependent)" },
  { keys: "Esc", desc: "Close modals and search" },
  { keys: "R", desc: "Refresh dashboard data" },
  { keys: "?", desc: "Show keyboard shortcuts" },
];

/* ── Module guide data with tabs/features ─────────────────── */
const MODULES = [
  { icon: <Package size={18} />, name: "All Assets", href: "/dashboard/assets", desc: "Full lifecycle management of IT and non-IT assets. Track purchase, assignment, maintenance, and disposal. Import via CSV or create manually.",
    tabs: ["All", "Active", "Discovered", "In Maintenance", "Retired"],
    features: ["Create/edit/delete assets", "Assign to users and departments", "Track serial numbers, asset tags, warranty", "Filter by type, status, site, department", "Bulk CSV import/export", "Click any row to view full detail page with history"] },
  { icon: <Monitor size={18} />, name: "IT Assets", href: "/dashboard/it-assets", desc: "Filtered view showing only IT-classified assets (Laptop, Desktop, Server, Network Device, Printer).",
    tabs: ["All IT", "Laptops", "Desktops", "Servers", "Network"],
    features: ["Hardware specs (CPU, RAM, storage)", "Software inventory per device", "IP address and tracking", "Warranty and purchase date", "Assigned user and department"] },
  { icon: <Building2 size={18} />, name: "Non-IT Assets", href: "/dashboard/non-it-assets", desc: "Manage furniture, vehicles, facilities equipment, and other physical assets. Track location, condition, and depreciation.",
    tabs: ["All Non-IT", "Furniture", "Vehicles", "Equipment"],
    features: ["Location and site tracking", "Condition assessment", "Depreciation tracking", "Purchase cost and vendor info"] },
  { icon: <Server size={18} />, name: "CMDB", href: "/dashboard/cmdb", desc: "Configuration Management Database — view relationships between assets, dependencies, and infrastructure topology.",
    tabs: ["Configuration Items", "Relationships", "Topology"],
    features: ["CI (Configuration Item) records", "Dependency mapping between assets", "Impact analysis for changes", "Visual infrastructure topology"] },
  { icon: <Ticket size={18} />, name: "Tickets / ITSM", href: "/dashboard/tickets", desc: "Full IT service management helpdesk with SLA tracking, auto-assignment, priority escalation, comments, and resolution workflows.",
    tabs: ["All Tickets", "My Tickets", "Unassigned", "Overdue"],
    features: ["Create tickets with priority (Critical/High/Medium/Low)", "SLA timers with response and resolution deadlines", "Auto-assignment by department or round-robin", "Comments and internal notes thread", "File attachments", "Status workflow: New → Open → In Progress → Resolved → Closed"] },
  { icon: <Radar size={18} />, name: "Discovery", href: "/dashboard/discovery", desc: "Agentless network scanning using ICMP ping, TCP probes, and Nmap. Schedule recurring scans. Deploy agents for deep host-level data.",
    tabs: ["Scan History", "Pending Review", "Schedules", "Credential Vault", "Agents"],
    features: ["4 scan types: Ping Sweep, TCP Port Scan, SNMP Discovery, Full Scan", "Nmap v7.97 integration for deep OS/service detection", "Auto-detect local network interfaces", "Custom subnet entry (e.g. 10.0.1.0/24)", "Review and approve/ignore discovered devices", "Cron-based scheduled scans (nightly, weekly, hourly)", "Encrypted credential vault (WMI, SSH, SNMP) — AES-256-CBC"] },
  { icon: <Shield size={18} />, name: "Patch Management", href: "/dashboard/patches", desc: "Track OS and software patches across your fleet. Monitor compliance by severity level.",
    tabs: ["All Patches", "Critical", "Missing", "Deployed", "Compliance"],
    features: ["Patch inventory by severity (Critical, Important, Moderate, Low)", "Deployment status tracking per device", "Compliance percentage dashboard", "Stacked bar charts by severity"] },
  { icon: <Network size={18} />, name: "Network (NMS)", href: "/dashboard/network", desc: "Network Management System — real-time monitoring of routers, switches, firewalls, and access points.",
    tabs: ["Devices", "Topology", "SNMP", "Traps", "Interfaces"],
    features: ["Real-time ICMP ping health checks every 5 minutes", "Interactive network topology map with drag-and-drop", "SNMP v2c/v3 polling for CPU, RAM, interface stats", "Device probe: ping + TCP port scan on 7 common ports", "Nmap deep scan per device (OS detection, service versions)", "SNMP trap log from device status changes"] },
  { icon: <ShieldCheck size={18} />, name: "Compliance", href: "/dashboard/compliance", desc: "Framework-based compliance tracking for enterprise audit readiness.",
    tabs: ["Frameworks", "Controls", "Assessments", "Evidence", "Calendar"],
    features: ["ISO 27001, SOC 2, NIST, HIPAA, PCI-DSS frameworks", "Control mapping with implementation status", "Assessment scheduling and tracking", "Evidence collection and document uploads"] },
  { icon: <Camera size={18} />, name: "CCTV", href: "/dashboard/cctv", desc: "CCTV camera management with RTSP stream support, PTZ controls, and event logging.",
    tabs: ["All Cameras", "Online", "Offline", "Events"],
    features: ["Camera grid with live status indicators", "RTSP stream URL configuration per camera", "Snapshot URL for still image capture", "PTZ control support", "Recording state monitoring"] },
  { icon: <MonitorPlay size={18} />, name: "VDI", href: "/dashboard/vdi", desc: "Virtual Desktop Infrastructure monitoring for VMs, pools, sessions, and resource metrics.",
    tabs: ["Virtual Machines", "Desktop Pools", "Sessions", "Metrics"],
    features: ["VM inventory with status (Running, Stopped, Suspended)", "CPU, RAM, disk usage per VM", "Desktop pool grouping and capacity", "Active session tracking with user assignment"] },
  { icon: <Zap size={18} />, name: "Automation", href: "/dashboard/automation", desc: "Event-driven automation engine that triggers actions from monitoring events, SLA breaches, and scan results.",
    tabs: ["Rules", "Execution Log", "Templates"],
    features: ["Trigger modules: Monitoring, Ticket, Discovery, Patch, CCTV", "Trigger events: device_offline, sla_breach, scan_completed", "Action types: create_ticket, send_notification, update_asset, webhook", "Cooldown periods to prevent duplicate actions"] },
  { icon: <Key size={18} />, name: "Licenses", href: "/dashboard/licenses", desc: "Software license management — track seat counts, expiry dates, compliance, and cost optimization.",
    tabs: ["All Licenses", "Expiring Soon", "Over-allocated", "Compliance"],
    features: ["Software name, vendor, and license key tracking", "Total seats vs. used seats monitoring", "Expiry date alerts", "License type (Perpetual, Subscription, OEM)"] },
  { icon: <BookOpen size={18} />, name: "Knowledge Base", href: "/dashboard/knowledge-base", desc: "Self-service knowledge articles for common IT issues. Staff can browse, search, and vote on helpfulness.",
    tabs: ["All Articles", "Most Viewed", "Recently Updated"],
    features: ["Rich-text article creation", "Category and tag organization", "View count and helpful vote tracking", "Search across article titles and content"] },
  { icon: <BarChart3 size={18} />, name: "Reports", href: "/dashboard/reports", desc: "Generate and download comprehensive reports for stakeholders and compliance.",
    tabs: ["Asset Inventory", "Ticket Summary", "Compliance", "Executive"],
    features: ["4 report types with date range filtering", "Asset inventory breakdown", "Ticket summary: open/closed, priority, SLA compliance", "Download as CSV or PDF"] },
  { icon: <Users size={18} />, name: "Users", href: "/dashboard/users", desc: "User and role management with RBAC (Role-Based Access Control).",
    tabs: ["All Users", "Active", "Inactive", "Roles"],
    features: ["Invite users by email with role assignment", "4 default roles: Tenant Admin, IT Admin, Staff, Employee", "Custom permission editing per role"] },
  { icon: <Settings size={18} />, name: "Settings", href: "/dashboard/settings", desc: "Organization-wide configuration for your QS Asset workspace.",
    tabs: ["General", "Billing & Plan", "SLA Policies", "Asset Types", "Departments", "Sites"],
    features: ["Organization name, timezone, industry configuration", "Billing plan management (Starter, Professional, Enterprise)", "SLA policy customization", "Multi-site support with HQ designation"] },
];

export default function HelpPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"guide" | "modules" | "faq" | "shortcuts">("guide");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedModule, setExpandedModule] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");
  let walkthrough: ReturnType<typeof useWalkthrough> | null = null;
  try { walkthrough = useWalkthrough(); } catch {}

  const tabs = [
    { id: "guide" as const, label: "Getting Started", icon: <Sparkles size={14} /> },
    { id: "modules" as const, label: "Module Guide", icon: <BookOpen size={14} /> },
    { id: "faq" as const, label: "FAQ", icon: <HelpCircle size={14} /> },
    { id: "shortcuts" as const, label: "Shortcuts", icon: <Keyboard size={14} /> },
  ];

  const filteredModules = searchQ
    ? MODULES.filter(m => m.name.toLowerCase().includes(searchQ.toLowerCase()) || m.desc.toLowerCase().includes(searchQ.toLowerCase()))
    : MODULES;

  const filteredFaq = searchQ
    ? FAQ.filter(f => f.q.toLowerCase().includes(searchQ.toLowerCase()) || f.a.toLowerCase().includes(searchQ.toLowerCase()))
    : FAQ;

  return (
    <>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>Help & Documentation</h1>
          <p className="page-subtitle" style={{ color: "var(--text-secondary)" }}>Everything you need to get the most out of QS Asset Management</p>
        </div>
        {walkthrough && (
          <button className="btn btn-primary" onClick={() => walkthrough!.startWalkthrough(DASHBOARD_TOUR, "dashboard")} style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 18px",
            fontSize: "13px",
            fontWeight: 700,
            borderRadius: 8,
            background: "linear-gradient(135deg, #22d3ee, #3b82f6)",
            boxShadow: "0 4px 14px rgba(34, 211, 238, 0.3)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(34, 211, 238, 0.4)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 14px rgba(34, 211, 238, 0.3)";
          }}>
            <Play size={14} fill="#fff" /> Take the Interactive Tour
          </button>
        )}
      </div>

      {/* Global Search Bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
          background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-primary)",
          borderRadius: 10, backdropFilter: "blur(8px)", transition: "all 0.2s ease"
        }}
        onFocusCapture={e => e.currentTarget.style.borderColor = "#22d3ee"}
        onBlurCapture={e => e.currentTarget.style.borderColor = "var(--border-primary)"}
        >
          <Search size={16} style={{ color: "var(--text-tertiary)" }} />
          <input
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search help articles, modules, shortcuts..."
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* Glassmorphic Tabs Navigation */}
      <div style={{
        display: "flex",
        gap: 6,
        marginBottom: 24,
        flexWrap: "wrap",
        background: "rgba(255, 255, 255, 0.01)",
        padding: 5,
        borderRadius: 12,
        border: "1px solid rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(10px)",
      }}>
        {tabs.map(t => {
          const isActive = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 8,
                background: isActive ? "rgba(34, 211, 238, 0.08)" : "transparent",
                color: isActive ? "#22d3ee" : "var(--text-secondary)",
                border: "none",
                boxShadow: isActive ? "inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 0 15px rgba(34, 211, 238, 0.15)" : "none",
                borderBottom: isActive ? "2px solid #22d3ee" : "none",
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                textShadow: isActive ? "0 0 10px rgba(34, 211, 238, 0.25)" : "none",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >{t.icon} {t.label}</button>
          );
        })}
      </div>

      {/* ── GETTING STARTED TAB ── */}
      {activeTab === "guide" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, alignItems: "start" }}>
          {/* Timeline steps */}
          <div className="card" style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-primary)",
            padding: 24,
            borderRadius: 12
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>Setup Quick Start Steps</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>Configure your network discovery, agent telemetry, monitoring modules and team seats.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { step: 1, title: "Configure Network Subnet", desc: "Head over to Discovery → New Scan to execute Nmap sweeps on your asset nodes.", href: "/dashboard/discovery" },
                { step: 2, title: "Review Discovered CIs", desc: "Approve newly scanned hardware nodes, laptops, and virtual networks into active inventory.", href: "/dashboard/discovery" },
                { step: 3, title: "Enable SNMP Health Checks", desc: "Map active WMI credentials and SSH profiles inside NMS settings for real-time memory metrics.", href: "/dashboard/network" },
                { step: 4, title: "Map Event Automation Rules", desc: "Link critical device state offline telemetry triggers directly to ITSM ticket pipelines.", href: "/dashboard/automation" },
                { step: 5, title: "Invite Operations Staff", desc: "Provision role-based controls (Tenant Admin, IT Admin, Helpdesk, Staff) for teammates.", href: "/dashboard/users" },
                { step: 6, title: "Standardize Custom Templates", desc: "Build tailored asset categorization models, SLA priority schedules, and business sites.", href: "/dashboard/settings" },
              ].map(s => (
                <div key={s.step}
                  onClick={() => router.push(s.href)}
                  style={{
                    display: "flex", gap: 14, padding: "14px 16px", borderRadius: 10,
                    cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    border: "1px solid rgba(255, 255, 255, 0.04)",
                    background: "rgba(255, 255, 255, 0.01)",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(34,211,238,0.03)";
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.25)";
                    e.currentTarget.style.transform = "translateX(4px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(34,211,238,0.03)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.01)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.04)";
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(59,130,246,0.2))",
                    border: "1px solid rgba(34, 211, 238, 0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#22d3ee", fontSize: 12, fontWeight: 800,
                  }}>{s.step}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{s.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--text-tertiary)", marginTop: 6, flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Interactive Tour Step Tracker */}
            <div className="card" style={{
              background: "linear-gradient(135deg, rgba(34,211,238,0.05), rgba(139,92,246,0.05))",
              border: "1px solid rgba(34, 211, 238, 0.25)",
              boxShadow: "0 8px 32px rgba(34, 211, 238, 0.05)",
              padding: 20,
              borderRadius: 12
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Terminal size={16} style={{ color: "#22d3ee" }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#22d3ee", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tour Checklist</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Dashboard Telemetry Tour</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DASHBOARD_TOUR.map((t, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                    <CheckCircle2 size={13} style={{ color: "rgba(34, 211, 238, 0.4)" }} />
                    <span>{t.title} segment scan</span>
                  </div>
                ))}
              </div>
              {walkthrough && (
                <button
                  onClick={() => walkthrough!.startWalkthrough(DASHBOARD_TOUR, "dashboard")}
                  style={{
                    width: "100%", marginTop: 16, border: "1px solid rgba(34, 211, 238, 0.3)",
                    background: "rgba(34, 211, 238, 0.06)", color: "#22d3ee", padding: "8px", borderRadius: 8,
                    fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s ease"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(34, 211, 238, 0.15)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(34, 211, 238, 0.06)"; }}
                >
                  Launch Interactive UI Tour
                </button>
              )}
            </div>

            {/* Side Tips */}
            <div className="card" style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-primary)",
              padding: 20,
              borderRadius: 12
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Info size={16} style={{ color: "var(--brand-400)" }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Pro Tips</span>
              </div>
              <ul style={{ paddingLeft: 16, margin: 0, fontSize: 11.5, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.5 }}>
                <li>Press <kbd style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, padding: "1px 4px" }}>⌘K</kbd> from anywhere to trigger global search.</li>
                <li>Store scan credentials securely in the vault with zero outbound API leak risks.</li>
                <li>Download missing patch lists as clean spreadsheet sheets under Reports modules.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── MODULE GUIDE TAB ── */}
      {activeTab === "modules" && (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredModules.map((m, idx) => {
            const isExpanded = expandedModule === idx;
            return (
              <div key={m.name} className="card" style={{
                padding: 0,
                overflow: "hidden",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                background: "rgba(255, 255, 255, 0.02)",
                border: isExpanded ? "1px solid rgba(34, 211, 238, 0.3)" : "1px solid var(--border-primary)",
                boxShadow: isExpanded ? "0 4px 20px rgba(34, 211, 238, 0.05)" : "none",
              }}>
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : idx)}
                  style={{
                    width: "100%", padding: "16px 20px", background: "none", border: "none",
                    display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
                    fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: isExpanded ? "rgba(34, 211, 238, 0.12)" : "rgba(255, 255, 255, 0.03)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isExpanded ? "#22d3ee" : "var(--text-secondary)",
                    flexShrink: 0, transition: "all 0.2s"
                  }}>{m.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 3 }}>{m.desc}</div>
                  </div>
                  <ChevronDown size={16} style={{
                    color: "var(--text-tertiary)", flexShrink: 0,
                    transform: isExpanded ? "rotate(180deg)" : "none", transition: "0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                  }} />
                </button>

                {isExpanded && (
                  <div style={{
                    padding: "0 20px 20px 72px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                    animation: "faqSlide 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}>
                    {/* View Pills */}
                    <div style={{ marginTop: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-tertiary)", marginBottom: 8 }}>Available Views</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {m.tabs.map(t => (
                          <span key={t} style={{
                            padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: "rgba(34, 211, 238, 0.06)", color: "#22d3ee",
                            border: "1px solid rgba(34, 211, 238, 0.15)",
                          }}>{t}</span>
                        ))}
                      </div>
                    </div>

                    {/* Feature bullet list */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-tertiary)", marginBottom: 8 }}>Module Highlights</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {m.features.map(f => (
                          <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            <CheckCircle2 size={12} style={{ color: "#34d399", flexShrink: 0 }} />
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA redirect */}
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(m.href); }}
                      className="btn btn-primary"
                      style={{ fontSize: 11.5, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 6 }}
                    >
                      Navigate to {m.name} <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredModules.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>No modules match &quot;{searchQ}&quot;</div>
          )}
        </div>
      )}

      {/* ── FAQ TAB ── */}
      {activeTab === "faq" && (
        <div style={{ display: "grid", gap: 8 }}>
          {filteredFaq.map((f, i) => {
            const isFaqExpanded = expandedFaq === i;
            return (
              <div key={i} className="card" style={{
                padding: 0,
                overflow: "hidden",
                background: "rgba(255, 255, 255, 0.02)",
                border: isFaqExpanded ? "1px solid rgba(34, 211, 238, 0.25)" : "1px solid var(--border-primary)",
                borderLeft: isFaqExpanded ? "3px solid #22d3ee" : "1px solid var(--border-primary)",
                transition: "all 0.2s ease"
              }}>
                <button onClick={() => setExpandedFaq(isFaqExpanded ? null : i)} style={{
                  width: "100%", padding: "16px 20px", background: "none", border: "none",
                  display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                  fontFamily: "inherit", textAlign: "left",
                }}>
                  <HelpCircle size={16} style={{ color: isFaqExpanded ? "#22d3ee" : "var(--text-tertiary)", flexShrink: 0, transition: "color 0.2s" }} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{f.q}</span>
                  <ChevronDown size={16} style={{
                    color: "var(--text-tertiary)",
                    transform: isFaqExpanded ? "rotate(180deg)" : "none",
                    transition: "0.2s"
                  }} />
                </button>
                {isFaqExpanded && (
                  <div style={{
                    padding: "0 20px 16px 50px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7,
                    borderTop: "1px solid rgba(255, 255, 255, 0.02)", paddingTop: 10,
                    animation: "faqSlide 0.2s ease-out",
                  }}>{f.a}</div>
                )}
              </div>
            );
          })}
          {filteredFaq.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>No FAQ matches &quot;{searchQ}&quot;</div>
          )}
        </div>
      )}

      {/* ── SHORTCUTS TAB ── */}
      {activeTab === "shortcuts" && (
        <div className="card" style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--border-primary)",
          padding: 24,
          borderRadius: 12
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18, color: "var(--text-primary)" }}>Workspace Hotkeys</div>
          <div style={{ display: "grid", gap: 0 }}>
            {SHORTCUTS.map((s, i) => (
              <div key={s.keys} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 0",
                borderBottom: i < SHORTCUTS.length - 1 ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.desc}</span>
                <kbd style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: "monospace",
                  background: "rgba(34, 211, 238, 0.06)",
                  border: "1px solid rgba(34, 211, 238, 0.25)",
                  color: "#22d3ee",
                  minWidth: 44,
                  textAlign: "center",
                  boxShadow: "0 2px 8px rgba(34, 211, 238, 0.1)",
                  textShadow: "0 0 5px rgba(34, 211, 238, 0.2)",
                }}>{s.keys}</kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support card */}
      <div className="card" style={{
        marginTop: 24,
        textAlign: "center",
        padding: "32px 24px",
        background: "rgba(255, 255, 255, 0.01)",
        border: "1px solid rgba(255, 255, 255, 0.04)",
        borderRadius: 12
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "rgba(34, 211, 238, 0.08)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "#22d3ee", marginBottom: 12, border: "1px solid rgba(34, 211, 238, 0.15)"
        }}>
          <Headphones size={20} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Direct Operations Support</div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 18, maxWidth: 440, margin: "0 auto 18px", lineHeight: 1.6 }}>
          Our engineering staff is online to assist with custom SNMP templates, webhook automation, or single-sign-on deployments.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <a href="mailto:support@neurqai.com" className="btn btn-primary" style={{
            fontSize: 12, padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 700
          }}>Email Support Ticket</a>
          <a href="/contact" className="btn btn-secondary" style={{
            fontSize: 12, padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 700
          }}>Contact Platform Architect</a>
        </div>
      </div>

      <style>{`@keyframes faqSlide { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 300px; } }`}</style>
    </>
  );
}
