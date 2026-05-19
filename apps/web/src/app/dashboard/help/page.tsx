"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Package, Ticket, Network, Shield, Camera, MonitorPlay, Zap, Key,
  BarChart3, Users, Settings, Radar, Search, HelpCircle, ChevronDown, ChevronRight,
  Play, Keyboard, ExternalLink, Lightbulb, ShoppingCart, GitBranch, AlertOctagon,
  Wrench, Headphones, FileText, Truck, Server, Monitor, Building2, ShieldCheck,
  Scan, ArrowRight, Sparkles, CheckCircle2,
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
    features: ["Hardware specs (CPU, RAM, storage)", "Software inventory per device", "IP address and hostname tracking", "Warranty and purchase date", "Assigned user and department"] },
  { icon: <Building2 size={18} />, name: "Non-IT Assets", href: "/dashboard/non-it-assets", desc: "Manage furniture, vehicles, facilities equipment, and other physical assets. Track location, condition, and depreciation.",
    tabs: ["All Non-IT", "Furniture", "Vehicles", "Equipment"],
    features: ["Location and site tracking", "Condition assessment", "Depreciation tracking", "Purchase cost and vendor info"] },
  { icon: <Server size={18} />, name: "CMDB", href: "/dashboard/cmdb", desc: "Configuration Management Database — view relationships between assets, dependencies, and infrastructure topology.",
    tabs: ["Configuration Items", "Relationships", "Topology"],
    features: ["CI (Configuration Item) records", "Dependency mapping between assets", "Impact analysis for changes", "Visual infrastructure topology"] },
  { icon: <Ticket size={18} />, name: "Tickets / ITSM", href: "/dashboard/tickets", desc: "Full IT service management helpdesk with SLA tracking, auto-assignment, priority escalation, comments, and resolution workflows.",
    tabs: ["All Tickets", "My Tickets", "Unassigned", "Overdue"],
    features: ["Create tickets with priority (Critical/High/Medium/Low)", "SLA timers with response and resolution deadlines", "Auto-assignment by department or round-robin", "Comments and internal notes thread", "File attachments", "Status workflow: New → Open → In Progress → Resolved → Closed", "Auto-created by automation rules when devices go offline"] },
  { icon: <Wrench size={18} />, name: "Work Orders", href: "/dashboard/work-orders", desc: "Schedule and track maintenance tasks, repairs, and installations. Assign to technicians.",
    tabs: ["Open", "In Progress", "Completed", "Scheduled"],
    features: ["Preventive maintenance scheduling", "Technician assignment", "Parts and labor tracking", "Linked to parent assets", "Priority and due date management"] },
  { icon: <Radar size={18} />, name: "Discovery", href: "/dashboard/discovery", desc: "Agentless network scanning using ICMP ping, TCP probes, and Nmap. Schedule recurring scans. Deploy agents for deep host-level data.",
    tabs: ["Scan History", "Pending Review", "Schedules", "Credential Vault", "Agents"],
    features: ["4 scan types: Ping Sweep, TCP Port Scan, SNMP Discovery, Full Scan", "Real Nmap v7.97 integration for deep OS/service detection", "Auto-detect local network interfaces", "Custom subnet entry (e.g. 10.0.1.0/24)", "Review and approve/ignore discovered devices", "Cron-based scheduled scans (nightly, weekly, hourly)", "Encrypted credential vault (WMI, SSH, SNMP) — AES-256-CBC", "Agent deployment for Windows/macOS/Linux host telemetry", "Real-time scan progress with device count updates"] },
  { icon: <Shield size={18} />, name: "Patch Management", href: "/dashboard/patches", desc: "Track OS and software patches across your fleet. Monitor compliance by severity level.",
    tabs: ["All Patches", "Critical", "Missing", "Deployed", "Compliance"],
    features: ["Patch inventory by severity (Critical, Important, Moderate, Low)", "Deployment status tracking per device", "Compliance percentage dashboard", "Stacked bar charts by severity", "Export patch compliance reports"] },
  { icon: <Network size={18} />, name: "Network (NMS)", href: "/dashboard/network", desc: "Network Management System — real-time monitoring of routers, switches, firewalls, and access points.",
    tabs: ["Devices", "Topology", "SNMP", "Traps", "Interfaces"],
    features: ["Real-time ICMP ping health checks every 5 minutes", "Interactive network topology map with drag-and-drop", "SNMP v2c/v3 polling for CPU, RAM, interface stats", "Device probe: ping + TCP port scan on 7 common ports", "Nmap deep scan per device (OS detection, service versions)", "SNMP trap log from device status changes", "Interface list with up/down status and traffic stats", "Auto-discover devices from existing asset inventory", "Add/edit/delete monitored devices with SNMP credentials", "Status indicators: Online (green), Warning (amber), Offline (red)"] },
  { icon: <Scan size={18} />, name: "Security Scan", href: "/dashboard/scanning", desc: "Vulnerability scanning and security posture assessment.",
    tabs: ["Scan Results", "Vulnerabilities", "Compliance Gaps"],
    features: ["CVE tracking and severity classification", "Misconfiguration detection", "Security posture scoring", "Remediation recommendations", "Compliance gap analysis"] },
  { icon: <ShieldCheck size={18} />, name: "Compliance", href: "/dashboard/compliance", desc: "Framework-based compliance tracking for enterprise audit readiness.",
    tabs: ["Frameworks", "Controls", "Assessments", "Evidence", "Calendar"],
    features: ["ISO 27001, SOC 2, NIST, HIPAA, PCI-DSS frameworks", "Control mapping with implementation status", "Assessment scheduling and tracking", "Evidence collection and document uploads", "Gap analysis with remediation plans", "Audit-ready compliance reports", "Industry filter (Healthcare, Finance, Technology, etc.)"] },
  { icon: <Camera size={18} />, name: "CCTV", href: "/dashboard/cctv", desc: "CCTV camera management with RTSP stream support, PTZ controls, and event logging.",
    tabs: ["All Cameras", "Online", "Offline", "Events"],
    features: ["Camera grid with live status indicators", "RTSP stream URL configuration per camera", "Snapshot URL for still image capture", "PTZ (Pan-Tilt-Zoom) control support", "Recording state monitoring", "Event log from audit trail", "Add cameras by IP address", "Motion detection event tracking", "Camera offline alerts via automation"] },
  { icon: <MonitorPlay size={18} />, name: "VDI", href: "/dashboard/vdi", desc: "Virtual Desktop Infrastructure monitoring for VMs, pools, sessions, and resource metrics.",
    tabs: ["Virtual Machines", "Desktop Pools", "Sessions", "Metrics"],
    features: ["VM inventory with status (Running, Stopped, Suspended)", "CPU, RAM, disk usage per VM", "Desktop pool grouping and capacity", "Active session tracking with user assignment", "Aggregate metrics: avg CPU, avg RAM across fleet", "Peak resource VM identification", "RDP protocol session state"] },
  { icon: <Truck size={18} />, name: "Fleet / GPS", href: "/dashboard/fleet", desc: "Vehicle and fleet asset tracking with GPS integration.",
    tabs: ["Vehicles", "Map", "Maintenance", "Drivers"],
    features: ["Vehicle inventory with make, model, year", "GPS location tracking on map", "Mileage and fuel tracking", "Maintenance schedule management", "Driver assignment and history", "Trip logging and route history"] },
  { icon: <Zap size={18} />, name: "Automation", href: "/dashboard/automation", desc: "Event-driven automation engine that triggers actions from monitoring events, SLA breaches, and scan results.",
    tabs: ["Rules", "Execution Log", "Templates"],
    features: ["Trigger modules: Monitoring, Ticket, Discovery, Patch, CCTV", "Trigger events: device_offline, sla_breach, scan_completed, camera_offline", "Action types: create_ticket, send_notification, update_asset, webhook", "Cooldown periods to prevent duplicate actions", "Enable/disable rules without deleting", "Execution history with success/failure status", "Run count and last-triggered timestamp", "Default rules: offline→ticket, SLA breach→alert, scan→notify"] },
  { icon: <Key size={18} />, name: "Licenses", href: "/dashboard/licenses", desc: "Software license management — track seat counts, expiry dates, compliance, and cost optimization.",
    tabs: ["All Licenses", "Expiring Soon", "Over-allocated", "Compliance"],
    features: ["Software name, vendor, and license key tracking", "Total seats vs. used seats monitoring", "Expiry date alerts", "License type (Perpetual, Subscription, OEM)", "Cost per seat and total spend", "Compliance status (Compliant, Over-allocated, Expired)", "Renewal reminders"] },
  { icon: <BookOpen size={18} />, name: "Knowledge Base", href: "/dashboard/knowledge-base", desc: "Self-service knowledge articles for common IT issues. Staff can browse, search, and vote on helpfulness.",
    tabs: ["All Articles", "Most Viewed", "Recently Updated"],
    features: ["Rich-text article creation", "Category and tag organization", "View count and helpful vote tracking", "Search across article titles and content", "Staff self-service portal access", "Linked to ticket resolution (suggest articles)"] },
  { icon: <BarChart3 size={18} />, name: "Reports", href: "/dashboard/reports", desc: "Generate and download comprehensive reports for stakeholders and compliance.",
    tabs: ["Asset Inventory", "Ticket Summary", "Compliance", "Executive"],
    features: ["4 report types with date range filtering", "Asset inventory: type, status, department, site breakdown", "Ticket summary: open/closed, priority, SLA compliance", "Compliance: patch status, framework coverage", "Executive: high-level KPIs, trends, risk summary", "Download as CSV or PDF", "Real-time data aggregation from database"] },
  { icon: <Users size={18} />, name: "Users", href: "/dashboard/users", desc: "User and role management with RBAC (Role-Based Access Control).",
    tabs: ["All Users", "Active", "Inactive", "Roles"],
    features: ["Invite users by email with role assignment", "4 default roles: Tenant Admin, IT Admin, Staff, Employee", "Custom permission editing per role", "User status toggle (Active/Inactive)", "Department and site assignment", "Last login tracking", "Password reset capability", "Email verification enforcement for new users"] },
  { icon: <Settings size={18} />, name: "Settings", href: "/dashboard/settings", desc: "Organization-wide configuration for your QS Asset workspace.",
    tabs: ["General", "Billing & Plan", "SLA Policies", "Asset Types", "Departments", "Sites", "Integrations"],
    features: ["Organization name, timezone, industry configuration", "Billing plan management (Starter, Professional, Enterprise)", "SLA policy customization (response/resolution hours per priority)", "Asset type management (add, edit, delete categories)", "Department management", "Multi-site support with HQ designation", "API key management for integrations", "Email notification preferences", "Data retention settings"] },
];

/* ── Component ────────────────────────────────────────────── */
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Help & Documentation</h1>
          <p className="page-subtitle">Everything you need to get the most out of QS Asset Management</p>
        </div>
        {walkthrough && (
          <button className="btn btn-primary" onClick={() => walkthrough!.startWalkthrough(DASHBOARD_TOUR, "dashboard")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> Take a Tour
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
          background: "var(--bg-card)", border: "1px solid var(--border-primary)",
          borderRadius: 10,
        }}>
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

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              background: activeTab === t.id ? "var(--brand-400)" : "var(--bg-card)",
              color: activeTab === t.id ? "#fff" : "var(--text-secondary)",
              border: activeTab === t.id ? "none" : "1px solid var(--border-primary)",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* GETTING STARTED */}
      {activeTab === "guide" && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Quick start steps */}
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Quick Start Guide</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>Follow these steps to set up your workspace:</p>
            {[
              { step: 1, title: "Run a Network Scan", desc: "Go to Discovery → New Scan. Enter your subnet (e.g. 192.168.1.0/24) and run a Ping Sweep to discover devices on your network.", href: "/dashboard/discovery" },
              { step: 2, title: "Review Discovered Devices", desc: "After the scan completes, review discovered devices and approve them as managed assets. They'll appear in your asset inventory automatically.", href: "/dashboard/discovery" },
              { step: 3, title: "Set Up Monitoring", desc: "Go to Network (NMS) to configure monitoring for your network devices. Enable SNMP polling for deeper metrics like CPU, memory, and interface stats.", href: "/dashboard/network" },
              { step: 4, title: "Configure Automation", desc: "Set up automation rules to auto-create tickets when devices go offline, SLAs are breached, or new devices are discovered. Go to Automation → Rules.", href: "/dashboard/automation" },
              { step: 5, title: "Invite Your Team", desc: "Go to Users → Add User to invite colleagues. Assign roles (IT Admin, Staff, Employee) to control access levels.", href: "/dashboard/users" },
              { step: 6, title: "Customize Settings", desc: "Go to Settings to configure asset types, SLA policies, departments, and billing. All defaults are fully customizable.", href: "/dashboard/settings" },
            ].map(s => (
              <div key={s.step}
                onClick={() => router.push(s.href)}
                style={{
                  display: "flex", gap: 14, padding: "14px 16px", borderRadius: 10,
                  cursor: "pointer", transition: "background 0.15s", marginBottom: 2,
                  border: "1px solid var(--border-primary)",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(6,182,212,0.04)"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-primary)"; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "linear-gradient(135deg, var(--brand-400), var(--accent-500))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 13, fontWeight: 800,
                }}>{s.step}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{s.desc}</div>
                </div>
                <ArrowRight size={16} style={{ color: "var(--text-tertiary)", marginTop: 6, flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* Feature highlights */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {[
              { icon: <Radar size={20} />, title: "Agentless Scanning", desc: "Discover devices using ICMP ping, TCP probes, and Nmap — no agent installation needed on target machines." },
              { icon: <Zap size={20} />, title: "Event-Driven Automation", desc: "Auto-create tickets, send alerts, and update records when monitoring events, SLA breaches, or scans trigger rules." },
              { icon: <Shield size={20} />, title: "Encrypted Credential Vault", desc: "Store WMI, SSH, and SNMP credentials encrypted at rest using AES-256-CBC. Credentials never leave your tenant." },
              { icon: <BarChart3 size={20} />, title: "Real-Time Analytics", desc: "Live dashboards with auto-refreshing KPIs, charts, and activity feeds. Export reports to CSV and PDF." },
            ].map(f => (
              <div key={f.title} className="card" style={{ padding: "20px" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 12, background: "rgba(6,182,212,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-400)" }}>{f.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE GUIDE */}
      {activeTab === "modules" && (
        <div style={{ display: "grid", gap: 8 }}>
          {filteredModules.map((m, idx) => {
            const isExpanded = expandedModule === idx;
            return (
              <div key={m.name} className="card" style={{ padding: 0, overflow: "hidden", transition: "all 0.2s" }}>
                {/* Module header — click to expand */}
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : idx)}
                  style={{
                    width: "100%", padding: "14px 18px", background: "none", border: "none",
                    display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                    fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: isExpanded ? "rgba(6,182,212,0.12)" : "rgba(6,182,212,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-400)", flexShrink: 0, transition: "background 0.2s" }}>{m.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{m.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 2 }}>{m.desc}</div>
                  </div>
                  <ChevronDown size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border-primary)", animation: "faqSlide 0.2s ease-out" }}>
                    {/* Tabs */}
                    <div style={{ marginTop: 14, marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-tertiary)", marginBottom: 8 }}>Tabs / Views</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {m.tabs.map(t => (
                          <span key={t} style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: "rgba(6,182,212,0.08)", color: "var(--brand-400)",
                            border: "1px solid rgba(6,182,212,0.15)",
                          }}>{t}</span>
                        ))}
                      </div>
                    </div>

                    {/* Features */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-tertiary)", marginBottom: 8 }}>Key Features</div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {m.features.map(f => (
                          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            <CheckCircle2 size={12} style={{ color: "#10b981", marginTop: 3, flexShrink: 0 }} />
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Go to module button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(m.href); }}
                      className="btn btn-primary"
                      style={{ marginTop: 14, fontSize: 11.5, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 5 }}
                    >
                      Open {m.name} <ArrowRight size={12} />
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

      {/* FAQ */}
      {activeTab === "faq" && (
        <div style={{ display: "grid", gap: 6 }}>
          {filteredFaq.map((f, i) => (
            <div key={i} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} style={{
                width: "100%", padding: "14px 18px", background: "none", border: "none",
                display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                fontFamily: "inherit", textAlign: "left",
              }}>
                <HelpCircle size={16} style={{ color: "var(--brand-400)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{f.q}</span>
                <ChevronDown size={16} style={{ color: "var(--text-tertiary)", transform: expandedFaq === i ? "rotate(180deg)" : "none", transition: "0.2s" }} />
              </button>
              {expandedFaq === i && (
                <div style={{
                  padding: "0 18px 16px 50px", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7,
                  animation: "faqSlide 0.2s ease-out",
                }}>{f.a}</div>
              )}
            </div>
          ))}
          {filteredFaq.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>No FAQ matches &quot;{searchQ}&quot;</div>
          )}
        </div>
      )}

      {/* SHORTCUTS */}
      {activeTab === "shortcuts" && (
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Keyboard Shortcuts</div>
          <div style={{ display: "grid", gap: 0 }}>
            {SHORTCUTS.map((s, i) => (
              <div key={s.keys} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0",
                borderBottom: i < SHORTCUTS.length - 1 ? "1px solid var(--border-primary)" : "none",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.desc}</span>
                <kbd style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
                  fontFamily: "inherit", color: "var(--text-primary)", minWidth: 32, textAlign: "center",
                }}>{s.keys}</kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact / Support */}
      <div className="card" style={{ marginTop: 20, textAlign: "center", padding: "24px" }}>
        <Headphones size={24} style={{ color: "var(--brand-400)", marginBottom: 8 }} />
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Need more help?</div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, maxWidth: 400, margin: "0 auto 14px" }}>
          Contact our support team for assistance with setup, integrations, or any technical questions.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="mailto:support@neurqai.com" className="btn btn-primary" style={{ fontSize: 12 }}>Email Support</a>
          <a href="/contact" className="btn btn-secondary" style={{ fontSize: 12 }}>Contact Sales</a>
        </div>
      </div>

      <style>{`@keyframes faqSlide { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 200px; } }`}</style>
    </>
  );
}
