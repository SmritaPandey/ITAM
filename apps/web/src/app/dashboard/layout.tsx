"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Monitor, Server, Truck, Ticket, Network, Shield, ShieldCheck, ShieldAlert,
  Settings, Bell, Search, ChevronDown, Camera, MonitorPlay,
  BarChart3, Zap, Users, Building2, Package, LogOut, User,
  AlertTriangle, CheckCircle2, Info, Clock, X, Radar, Key, FileText, BookOpen,
  Headphones, UserCircle, Wrench, Scan, ShoppingCart, GitBranch, AlertOctagon,
  Sun, Moon, Menu, Lock, CheckCircle, Terminal, Download, Layers, Brain, MapPin, Activity
} from "lucide-react";

import { apiFetch, safeFetch, getToken } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtimeEvents";
import { WalkthroughProvider } from "@/components/HelpSystem";
import { LogoIcon } from "@/components/Logo";
import { useTheme } from "@/components/ThemeProvider";
import AiCopilot from "@/components/AiCopilot";

const nameToModuleKeyMap: Record<string, string> = {
  "Dashboard": "DASHBOARD",
  "Intelligence": "INTELLIGENCE",
  "My Portal": "MY_PORTAL",
  "All Assets": "ALL_ASSETS",
  "IT Assets": "IT_ASSETS",
  "Non-IT Assets": "NON_IT_ASSETS",
  "Facility": "FACILITY",
  "CMDB": "CMDB",
  "Tickets": "TICKETS",
  "Work Orders": "WORK_ORDERS",
  "Discovery": "DISCOVERY",
  "Patch Mgmt": "PATCH_MGMT",
  "Software Deploy": "SOFTWARE_DEPLOYMENT",
  "Remote Terminal": "REMOTE_TERMINAL",
  "Network (NMS)": "NETWORK",
  "NOC": "NETWORK",
  "Security Scan": "SECURITY_SCAN",
  "Vulnerabilities": "SECURITY_SCAN",
  "Compliance": "COMPLIANCE",
  "Procurement": "PROCUREMENT",
  "Changes": "CHANGES",
  "Problems": "PROBLEMS",
  "Fleet / GPS": "FLEET",
  "CCTV": "CCTV",
  "VDI": "VDI",
  "NAC": "NAC",
  "Alerts": "ALERTS",
  "Automation": "AUTOMATION",
  "Licenses": "LICENSES",
  "Software Inventory": "IT_ASSETS",
  "Knowledge Base": "KNOWLEDGE_BASE",
  "Service Catalog": "SERVICE_CATALOG",
  "Reports": "REPORTS",
  "Users": "USERS",
  "Audit Logs": "AUDIT_LOGS",
  "Help & Docs": "HELP",
  "Settings": "SETTINGS",
};

const hrefToModuleKeyMap: Record<string, string> = {
  "/dashboard/cmdb": "CMDB",
  "/dashboard/facility": "FACILITY",
  "/dashboard/work-orders": "WORK_ORDERS",
  "/dashboard/discovery": "DISCOVERY",
  "/dashboard/patches": "PATCH_MGMT",
  "/dashboard/network": "NETWORK",
  "/dashboard/network/noc": "NETWORK",
  "/dashboard/scanning": "SECURITY_SCAN",
  "/dashboard/vulnerabilities": "SECURITY_SCAN",
  "/dashboard/compliance": "COMPLIANCE",
  "/dashboard/procurement": "PROCUREMENT",
  "/dashboard/changes": "CHANGES",
  "/dashboard/problems": "PROBLEMS",
  "/dashboard/fleet": "FLEET",
  "/dashboard/cctv": "CCTV",
  "/dashboard/vdi": "VDI",
  "/dashboard/nac": "NAC",
  "/dashboard/alerts": "ALERTS",
  "/dashboard/intelligence": "INTELLIGENCE",
  "/dashboard/remote-terminal": "REMOTE_TERMINAL",
  "/dashboard/automation": "AUTOMATION",
  "/dashboard/licenses": "LICENSES",
  "/dashboard/software": "IT_ASSETS",
  "/dashboard/knowledge-base": "KNOWLEDGE_BASE",
  "/dashboard/service-catalog": "SERVICE_CATALOG",
  "/dashboard/reports": "REPORTS",
  "/dashboard/users": "USERS",
  "/dashboard/audit-logs": "AUDIT_LOGS",
  "/dashboard/software-deploy": "SOFTWARE_DEPLOYMENT",
};

const MODULE_METADATA: Record<string, {
  name: string;
  tier: "Professional" | "Enterprise" | "On-Premise";
  desc: string;
  benefits: string[];
}> = {
  CMDB: {
    name: "CMDB & Relationship Mapper",
    tier: "Professional",
    desc: "Map complex dependency chains across your entire infrastructure.",
    benefits: [
      "Visual infrastructure mapping",
      "Impact analysis for outages",
      "CI relationship tracking",
      "Automatic topology updates",
    ],
  },
  WORK_ORDERS: {
    name: "Work Orders & Maintenance",
    tier: "Professional",
    desc: "Create and track maintenance workflows, preventative schedules, and technicians.",
    benefits: [
      "Preventative maintenance scheduling",
      "Technician dispatch & tracking",
      "SLA breach notifications",
      "Parts inventory integration",
    ],
  },
  DISCOVERY: {
    name: "Automatic Discovery",
    tier: "Professional",
    desc: "Scan networks, subnets, and clouds automatically to ingest and sync assets.",
    benefits: [
      "Subnet & range automatic scanning",
      "Agentless SNMP & WMI collection",
      "Cloud asset auto-ingestion",
      "Scheduled reconciliation rules",
    ],
  },
  PATCH_MGMT: {
    name: "Patch Management",
    tier: "Professional",
    desc: "Deploy, verify, and monitor software and OS patches across all user devices.",
    benefits: [
      "Automated OS patching (Windows/macOS)",
      "Vulnerability patching validation",
      "Third-party software updates",
      "Compliance audit reporting",
    ],
  },
  NETWORK: {
    name: "Network Monitoring System (NMS)",
    tier: "Professional",
    desc: "Real-time network traffic audits, interface status, ping telemetry, and topology tracking.",
    benefits: [
      "Live ping & response monitoring",
      "Port-level traffic statistics",
      "Alerts for node down states",
      "Network switch mapping",
    ],
  },
  SECURITY_SCAN: {
    name: "Security Vulnerability Scanning",
    tier: "Professional",
    desc: "Perform automated vulnerability assessments, SSL checks, and port auditing.",
    benefits: [
      "Automated port scanning",
      "SSL certificate expiry tracking",
      "Vulnerability index lookup",
      "Remediation checklist export",
    ],
  },
  LICENSES: {
    name: "Software Licenses & Compliance",
    tier: "Professional",
    desc: "Audit license keys, calculate compliance scores, and track upcoming renewals.",
    benefits: [
      "Volume license key tracking",
      "Software installation auditing",
      "Under/over-licensing warning triggers",
      "Renewal calendar with notifications",
    ],
  },
  KNOWLEDGE_BASE: {
    name: "Knowledge Base",
    tier: "Professional",
    desc: "Create self-service guides, support articles, and standard operating procedures.",
    benefits: [
      "Interactive editor with templates",
      "Role-based reading settings",
      "Ticket link integration",
      "FAQ widget embed helper",
    ],
  },
  REPORTS: {
    name: "Advanced Reports & Analytics",
    tier: "Professional",
    desc: "Build complex custom query filters and schedules with visual chart builders.",
    benefits: [
      "Visual chart builder interface",
      "Automated PDF report schedules",
      "Custom filter presets",
      "Export directly to CSV & Excel",
    ],
  },
  AUDIT_LOGS: {
    name: "Audit Logs",
    tier: "Professional",
    desc: "Access full, tamper-evident logs of every admin and tenant action in the system.",
    benefits: [
      "Detailed event log query system",
      "Actor IP and device logging",
      "Compliance audit export helper",
      "Historical state change records",
    ],
  },
  CCTV: {
    name: "CCTV Integrations",
    tier: "Professional",
    desc: "Connect your security cameras and view feeds directly context-linked to locations and assets.",
    benefits: [
      "RTSP camera stream embedding",
      "Location-linked feeds",
      "Live layout grid editor",
      "Motion event notification triggers",
    ],
  },
  COMPLIANCE: {
    name: "Regulatory Compliance",
    tier: "Enterprise",
    desc: "Track SOC2, ISO27001, HIPAA, and custom compliance frameworks across assets.",
    benefits: [
      "Policy mapping and templates",
      "Audit preparation drawers",
      "Non-compliance tracking alerts",
      "Officer task assignments",
    ],
  },
  PROCUREMENT: {
    name: "Procurement & Purchase Orders",
    tier: "Enterprise",
    desc: "Manage purchase orders, vendor databases, and request-for-quotes.",
    benefits: [
      "Vendor catalog database",
      "Purchase order workflows",
      "Asset birth-record generation",
      "Budget category analysis",
    ],
  },
  CHANGES: {
    name: "Change Management (ITIL)",
    tier: "Enterprise",
    desc: "Structure, review, and authorize change requests with dynamic approval boards.",
    benefits: [
      "ITIL-aligned RFC structures",
      "CAB approval dashboard",
      "Risk calculation models",
      "Post-implementation reviews",
    ],
  },
  PROBLEMS: {
    name: "Problem Management",
    tier: "Enterprise",
    desc: "Track root cause analysis and link multiple tickets to central problems.",
    benefits: [
      "RCA (Root Cause Analysis) workspace",
      "Ticket mapping & mass resolve",
      "Known-error database",
      "SLA breach tracking",
    ],
  },
  FLEET: {
    name: "Fleet & GPS Tracking",
    tier: "Enterprise",
    desc: "Track company vehicles, GPS telemetry, fuel receipts, and maintenance logs.",
    benefits: [
      "Real-time GPS route overlays",
      "Fuel log receipts & economy analytics",
      "Driver assignment & log auditing",
      "Vehicle preventative service triggers",
    ],
  },
  VDI: {
    name: "Virtual Desktop Infrastructure (VDI)",
    tier: "Enterprise",
    desc: "Provision, manage, and remote-session directly into cloud and on-premise VDIs.",
    benefits: [
      "Console access",
      "Resource allocation sliders",
      "Host group scaling rules",
      "VDI health telemetry reporting",
    ],
  },
  IT_ASSETS: {
    name: "IT Asset Management",
    tier: "Professional",
    desc: "Comprehensive tracking of all IT hardware and installed software inventory.",
    benefits: [
      "Hardware lifecycle tracking",
      "Software inventory & EOL data",
      "Employee asset assignment",
      "Risk & vulnerability mapping",
    ],
  },
  AUTOMATION: {
    name: "Automation Runbooks",
    tier: "Enterprise",
    desc: "Build low-code trigger-and-action scripts to automatically heal infrastructure.",
    benefits: [
      "Low-code automation builder",
      "Pre-built system task libraries",
      "Remote agent script execution",
      "Trigger rules (webhook, alerts)",
    ],
  },
  SOFTWARE_DEPLOYMENT: {
    name: "Software Deployment",
    tier: "Professional",
    desc: "Distribute and manage software packages across remote endpoints.",
    benefits: [
      "Package repository management",
      "Silent installation scripts",
      "Deployment scheduling",
      "Success/failure reporting",
    ],
  },
  FACILITY: {
    name: "Facility & EAM",
    tier: "Professional",
    desc: "Floor plans, preventive maintenance, spares, and consumables for non-IT assets.",
    benefits: [
      "Site floor plan overlays",
      "PM schedules & work orders",
      "Spare part min-stock alerts",
      "Consumable reorder points",
    ],
  },
  NAC: {
    name: "Network Access Control",
    tier: "Enterprise",
    desc: "Quarantine and CoA policies for unmanaged or non-compliant endpoints.",
    benefits: [
      "Policy-based isolation",
      "RADIUS CoA / switch webhooks",
      "Agent firewall fallback",
      "Audit of NAC actions",
    ],
  },
  ALERTS: {
    name: "Unified Alerts",
    tier: "Professional",
    desc: "Cross-module AlertEvent console for fleet, NMS, CCTV, and security.",
    benefits: [
      "Acknowledge & resolve workflow",
      "Severity filtering",
      "Source drill-down",
      "Realtime notification feed",
    ],
  },
  INTELLIGENCE: {
    name: "AI Intelligence",
    tier: "Enterprise",
    desc: "Risk scoring, patch priority, and next-best-action recommendations.",
    benefits: [
      "Top risk assets",
      "License optimization",
      "Compliance insights",
      "Smart action queue",
    ],
  },
  REMOTE_TERMINAL: {
    name: "Remote Terminal",
    tier: "Enterprise",
    desc: "Agent-backed remote shell and assist deep-links for endpoints.",
    benefits: [
      "Remote command sessions",
      "RDP/SSH deep-links",
      "Session audit trail",
      "Agent file pull",
    ],
  },
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";

const navSections = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard", badge: null },
      { name: "Intelligence", icon: Brain, href: "/dashboard/intelligence", badge: "NEW" },
      { name: "My Portal", icon: UserCircle, href: "/dashboard/my-portal", badge: null },
    ],
  },
  {
    label: "Asset Management",
    items: [
      { name: "All Assets", icon: Package, href: "/dashboard/assets", badge: null },
      { name: "IT Assets", icon: Monitor, href: "/dashboard/it-assets", badge: null },
      { name: "Non-IT Assets", icon: Building2, href: "/dashboard/non-it-assets", badge: null },
      { name: "Facility", icon: MapPin, href: "/dashboard/facility", badge: null },
      { name: "CMDB", icon: Server, href: "/dashboard/cmdb", badge: null },
      { name: "Software Inventory", icon: Layers, href: "/dashboard/software", badge: null },
    ],
  },
  {
    label: "Operations",
    items: [
      { name: "Tickets", icon: Ticket, href: "/dashboard/tickets", badge: null },
      { name: "Work Orders", icon: Wrench, href: "/dashboard/work-orders", badge: null },
      { name: "Discovery", icon: Radar, href: "/dashboard/discovery", badge: null },
      { name: "Patch Mgmt", icon: Shield, href: "/dashboard/patches", badge: null },
      { name: "Software Deploy", icon: Download, href: "/dashboard/software-deploy", badge: null },
      { name: "Remote Terminal", icon: Terminal, href: "/dashboard/remote-terminal", badge: null },
      { name: "Network (NMS)", icon: Network, href: "/dashboard/network", badge: null },
      { name: "NOC", icon: Activity, href: "/dashboard/network/noc", badge: null },
      { name: "Security Scan", icon: Scan, href: "/dashboard/scanning", badge: null },
      { name: "Vulnerabilities", icon: ShieldAlert, href: "/dashboard/vulnerabilities", badge: null },
      { name: "Compliance", icon: ShieldCheck, href: "/dashboard/compliance", badge: null },
      { name: "Procurement", icon: ShoppingCart, href: "/dashboard/procurement", badge: null },
      { name: "Changes", icon: GitBranch, href: "/dashboard/changes", badge: null },
      { name: "Problems", icon: AlertOctagon, href: "/dashboard/problems", badge: null },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { name: "Fleet / GPS", icon: Truck, href: "/dashboard/fleet", badge: null },
      { name: "CCTV", icon: Camera, href: "/dashboard/cctv", badge: null },
      { name: "VDI", icon: MonitorPlay, href: "/dashboard/vdi", badge: null },
      { name: "NAC", icon: Lock, href: "/dashboard/nac", badge: null },
      { name: "Alerts", icon: Bell, href: "/dashboard/alerts", badge: null },
    ],
  },
  {
    label: "Management",
    items: [
      { name: "Automation", icon: Zap, href: "/dashboard/automation", badge: null },
      { name: "Licenses", icon: Key, href: "/dashboard/licenses", badge: null },
      { name: "Knowledge Base", icon: BookOpen, href: "/dashboard/knowledge-base", badge: null },
      { name: "Service Catalog", icon: Headphones, href: "/dashboard/service-catalog", badge: null },
      { name: "Reports", icon: BarChart3, href: "/dashboard/reports", badge: null },
      { name: "Users", icon: Users, href: "/dashboard/users", badge: null },
      { name: "Audit Logs", icon: FileText, href: "/dashboard/audit-logs", badge: null },
      { name: "Help & Docs", icon: BookOpen, href: "/dashboard/help", badge: null },
      { name: "Settings", icon: Settings, href: "/dashboard/settings", badge: null },
    ],
  },
];

const NOTIF_ICONS: Record<string, any> = {
  ALERT: <AlertTriangle size={14} />,
  WARNING: <Clock size={14} />,
  INFO: <Info size={14} />,
  SUCCESS: <CheckCircle2 size={14} />,
};
const NOTIF_COLORS: Record<string, string> = {
  ALERT: "var(--error)", WARNING: "var(--warning)", INFO: "var(--brand-400)", SUCCESS: "var(--success)",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
  const [activeModules, setActiveModules] = useState<string[] | null>(null);

  // Fetch workspace and dynamic modules settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await safeFetch("/settings");
        if (data) {
          setAllowedModules(data.allowedModules || []);
          setActiveModules(data.activeModules || []);
        }
      } catch (e) {
        console.error("Failed to fetch settings", e);
      }
    }
    fetchSettings();

    const handleUpdate = () => {
      fetchSettings();
    };

    window.addEventListener("workspace-modules-updated", handleUpdate);
    return () => {
      window.removeEventListener("workspace-modules-updated", handleUpdate);
    };
  }, [pathname]);



  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // Redirect staff to portal
      if (payload.role === "Employee") { router.push("/portal"); return; }
      setUser(payload);
    } catch { router.push("/login"); }

    // Fetch live user profile dynamically to sync roles/status/permissions immediately
    safeFetch("/users/me").then(realUser => {
      if (realUser) {
        const normalizedUser = {
          sub: realUser.id,
          email: realUser.email,
          tenantId: realUser.tenantId,
          role: realUser.role?.name || "employee",
          permissions: realUser.role?.permissions || [],
          isSuperAdmin: realUser.isSuperAdmin || false,
        };
        setUser(normalizedUser);
        if (normalizedUser.role.toLowerCase() === "employee") {
          router.push("/portal");
        }
      }
    }).catch(err => {
      console.error("Failed to fetch live user profile:", err);
    });

    // Fetch ticket count for badge
    safeFetch("/tickets?limit=1").then(d => setTicketCount(d?.total || 0));

    // Fetch real notifications
    refreshNotifications();
  }, [router]);

  // Notification refresh helper
  function refreshNotifications() {
    safeFetch("/notifications?limit=10").then(d => {
      if (d) {
        setNotifications(d.data || []);
        setUnreadCount(d.unread || 0);
      }
    });
  }

  // WebSocket: real-time notifications & agent heartbeat
  const { on: onWsEvent, connected: wsConnected } = useRealtimeEvents();

  useEffect(() => {
    const cleanups = [
      // Auto-refresh notifications on new notification event
      onWsEvent('notification', () => {
        refreshNotifications();
      }),
      // Also catch domain events whose type contains 'notification'
      onWsEvent('domain_event', (data: any) => {
        if (data?.type?.includes('notification')) {
          refreshNotifications();
        }
      }),
      // Agent heartbeat — dispatch custom event so child pages can react
      onWsEvent('agent_heartbeat', (data: any) => {
        window.dispatchEvent(new CustomEvent('agent-heartbeat', { detail: data }));
      }),
    ];
    return () => cleanups.forEach(c => c());
  }, [onWsEvent]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cmd+K shortcut for search
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); }
      if (e.key === "Escape") setShowSearch(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  function handleLogout() {
    localStorage.removeItem("accessToken");
    router.push("/login");
  }

  async function markAllRead() {
    // Optimistically clear, then persist. Roll back the count on failure.
    const prevUnread = unreadCount;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
    } catch {
      setUnreadCount(prevUnread);
    }
  }


  // Global search across API
  const [searchResults, setSearchResults] = useState<{ nav: any[]; assets: any[]; tickets: any[]; users: any[]; services: any[] }>({ nav: [], assets: [], tickets: [], users: [], services: [] });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults({ nav: [], assets: [], tickets: [], users: [], services: [] });
      return;
    }
    const q = searchQuery.toLowerCase();
    const nav = navSections.flatMap(s => s.items).filter(i => i.name.toLowerCase().includes(q));

    const timer = setTimeout(() => {
      setSearching(true);
      safeFetch(`/search?q=${encodeURIComponent(searchQuery)}&limit=5`)
        .then((global) => {
          const g = global || { assets: [], tickets: [], users: [], services: [] };
          setSearchResults({
            nav,
            assets: g.assets || [],
            tickets: g.tickets || [],
            users: (g.users || []).map((u: any) => ({
              ...u,
              name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
            })),
            services: g.services || [],
          });
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Intercept direct path routing
  let interceptedModuleKey: string | null = null;
  for (const [routePrefix, moduleKey] of Object.entries(hrefToModuleKeyMap)) {
    if (pathname.startsWith(routePrefix)) {
      interceptedModuleKey = moduleKey;
      break;
    }
  }

  const moduleAllowed = (key: string | null) => {
    if (!key || !allowedModules) return true;
    if (allowedModules.includes(key)) return true;
    // Backward-compat: Facility unlocked by WORK_ORDERS; Alerts by NETWORK/FLEET/CCTV
    if (key === "FACILITY" && allowedModules.includes("WORK_ORDERS")) return true;
    if (key === "ALERTS" && allowedModules.some((m) => ["NETWORK", "FLEET", "CCTV", "SECURITY_SCAN"].includes(m))) return true;
    return false;
  };

  const isRouteIntercepted =
    interceptedModuleKey &&
    allowedModules &&
    !moduleAllowed(interceptedModuleKey);

  if (!user) return null;

  return (
    <WalkthroughProvider>
    <div className="app-layout">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />
      )}
      {/* Sidebar */}
      <aside className={`sidebar${mobileSidebarOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }} onClick={(e) => { e.preventDefault(); router.push("/dashboard"); }}>
            <LogoIcon size={40} />
            <span className="sidebar-brand-text">QS Assets</span>
          </a>
        </div>
        <nav className="sidebar-nav">
          {navSections.map((section) => {
            const filteredItems = section.items.filter((item) => {
              const key = nameToModuleKeyMap[item.name];
              if (!key) return true;
              if (!activeModules) return true;
              if (activeModules.includes(key)) return true;
              if (key === "FACILITY" && activeModules.includes("WORK_ORDERS")) return true;
              return false;
            });

            if (filteredItems.length === 0) return null;

            return (
              <div key={section.label}>
                <div className="sidebar-section-label">{section.label}</div>
                {filteredItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const badge = item.name === "Tickets" && ticketCount > 0 ? String(ticketCount) : item.badge;
                  return (
                    <a key={item.href} href={item.href}
                      className={`sidebar-item${isActive ? " active" : ""}`}
                      onClick={(e) => { e.preventDefault(); router.push(item.href); }}>
                      <item.icon className="sidebar-item-icon" size={18} />
                      <span>{item.name}</span>
                      {badge && <span className="sidebar-badge">{badge}</span>}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <button className="topbar-btn mobile-menu-btn" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
            <Menu size={20} />
          </button>
          <div className="topbar-search" onClick={() => setShowSearch(true)} style={{ cursor: "pointer" }}>
            <Search size={15} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <input placeholder="Search assets, tickets, users..." readOnly style={{ cursor: "pointer" }} />
            <span className="topbar-search-kbd">⌘K</span>
          </div>
          <div className="topbar-actions">
            {/* Theme Toggle */}
            <button className="topbar-btn" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={toggleTheme}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {/* Notifications */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button className="topbar-btn" title="Notifications" onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}>
                <Bell size={18} />
                {unreadCount > 0 && <span className="notification-dot" />}
              </button>
              {showNotif && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, width: 380,
                  background: "var(--bg-card)", border: "1px solid var(--border-primary)",
                  borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", zIndex: 100,
                  overflow: "hidden",
                }}>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ background: "none", border: "none", color: "var(--brand-400)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{
                        padding: "12px 16px", borderBottom: "1px solid var(--border-primary)",
                        cursor: "pointer", display: "flex", gap: 10,
                        background: !n.isRead ? "rgba(6,182,212,0.03)" : "transparent",
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          background: `${NOTIF_COLORS[n.type] || NOTIF_COLORS.INFO}15`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: NOTIF_COLORS[n.type] || NOTIF_COLORS.INFO,
                        }}>
                          {NOTIF_ICONS[n.type] || NOTIF_ICONS.INFO}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: !n.isRead ? 600 : 500, color: "var(--text-primary)", marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</div>
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                        {!n.isRead && <div style={{ width: 6, height: 6, borderRadius: 3, background: "var(--brand-400)", flexShrink: 0, marginTop: 4 }} />}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "10px", textAlign: "center", borderTop: "1px solid var(--border-primary)" }}>
                    <button style={{ background: "none", border: "none", color: "var(--brand-400)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      View All Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div ref={profileRef} style={{ position: "relative" }}>
              <div className="topbar-user" onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }} style={{ cursor: "pointer" }}>
                <div className="topbar-avatar">{user.email?.[0]?.toUpperCase()}</div>
                <div className="topbar-user-info">
                  <span className="topbar-user-name">{user.email?.split("@")[0]}</span>
                  <span className="topbar-user-role">{user.role}</span>
                </div>
                <ChevronDown size={14} style={{ color: "var(--text-tertiary)", transform: showProfile ? "rotate(180deg)" : "none", transition: "0.2s" }} />
              </div>
              {showProfile && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, width: 240,
                  background: "var(--bg-card)", border: "1px solid var(--border-primary)",
                  borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", zIndex: 100,
                  overflow: "hidden",
                }}>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{user.email?.split("@")[0]}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{user.email}</div>
                    <span className="badge purple" style={{ marginTop: 6 }}>{user.role}</span>
                  </div>
                  <div style={{ padding: "4px" }}>
                    {[
                      { icon: <User size={14} />, label: "My Profile", action: () => router.push("/dashboard/settings") },
                      { icon: <Settings size={14} />, label: "Settings", action: () => router.push("/dashboard/settings") },
                    ].map(item => (
                      <button key={item.label} onClick={() => { item.action(); setShowProfile(false); }} style={{
                        width: "100%", padding: "8px 12px", background: "none", border: "none",
                        display: "flex", alignItems: "center", gap: 8, borderRadius: 6,
                        color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      }}>
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ padding: "4px", borderTop: "1px solid var(--border-primary)" }}>
                    <button onClick={handleLogout} style={{
                      width: "100%", padding: "8px 12px", background: "none", border: "none",
                      display: "flex", alignItems: "center", gap: 8, borderRadius: 6,
                      color: "var(--error)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-content">
          {isRouteIntercepted && interceptedModuleKey && MODULE_METADATA[interceptedModuleKey] ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "70vh",
              padding: "40px 20px",
            }}>
              <div className="lock-teaser-container" style={{
                maxWidth: 580,
                width: "100%",
                background: "var(--bg-card)",
                backdropFilter: "blur(20px) saturate(180%)",
                border: "1px solid var(--border-primary)",
                borderRadius: 24,
                padding: 40,
                boxShadow: "0 24px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
              }}>
                {/* Glowing light sphere backdrop */}
                <div style={{
                  position: "absolute",
                  top: -80,
                  right: -80,
                  width: 240,
                  height: 240,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, var(--brand-400) 0%, transparent 70%)",
                  opacity: 0.15,
                  pointerEvents: "none",
                }} />
                
                {/* Lock icon with premium rings */}
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(6,182,212,0.1) 100%)",
                  border: "1px solid rgba(6,182,212,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px auto",
                  boxShadow: "0 12px 30px rgba(6,182,212,0.1)",
                  position: "relative",
                }}>
                  <Lock size={28} style={{ color: "var(--brand-400)" }} />
                </div>

                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  color: "#8b5cf6",
                  background: "rgba(139,92,246,0.1)",
                  padding: "4px 12px",
                  borderRadius: 6,
                  display: "inline-block",
                  marginBottom: 16,
                }}>
                  {MODULE_METADATA[interceptedModuleKey].tier} Feature
                </div>

                <h2 style={{
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "var(--text-primary)",
                  marginBottom: 8,
                }}>
                  Unlock {MODULE_METADATA[interceptedModuleKey].name}
                </h2>
                
                <p style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  marginBottom: 28,
                  maxWidth: 440,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}>
                  {MODULE_METADATA[interceptedModuleKey].desc} Upgrading your subscription plan unlocks access to this and other premium workflows instantly.
                </p>

                {/* Benefits List */}
                <div style={{
                  background: "var(--bg-elevated)",
                  borderRadius: 16,
                  border: "1px solid var(--border-primary)",
                  padding: "20px 24px",
                  textAlign: "left",
                  marginBottom: 32,
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-tertiary)",
                    marginBottom: 12,
                  }}>
                    What is included:
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {MODULE_METADATA[interceptedModuleKey].benefits.map((benefit) => (
                      <div key={benefit} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                        <CheckCircle size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upgrade CTA */}
                <button
                  onClick={() => router.push("/dashboard/settings#billing")}
                  style={{
                    width: "100%",
                    padding: "12px 24px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    color: "white",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(6,182,212,0.25)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 12px 30px rgba(6,182,212,0.35)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 10px 25px rgba(6,182,212,0.25)";
                  }}
                >
                  Upgrade to {MODULE_METADATA[interceptedModuleKey].tier} Plan
                </button>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Command Palette (⌘K) */}
      {showSearch && (
        <>
          <div onClick={() => setShowSearch(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000,
            backdropFilter: "blur(4px)",
          }} />
          <div style={{
            position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)",
            width: "min(560px, 92vw)", maxHeight: "60vh", background: "var(--bg-card)",
            border: "1px solid var(--border-primary)", borderRadius: 16,
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)", zIndex: 2001,
            overflow: "hidden",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", alignItems: "center", gap: 10 }}>
              <Search size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
              <input
                autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search pages, assets, tickets..."
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "var(--text-primary)", fontSize: 15, fontFamily: "inherit",
                }}
              />
              <button onClick={() => setShowSearch(false)} style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
                borderRadius: 6, padding: "2px 8px", color: "var(--text-tertiary)",
                fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              }}>ESC</button>
            </div>
            <div style={{ maxHeight: "50vh", overflowY: "auto", padding: 8 }}>
              {searchQuery.trim().length < 2 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                  Type to search pages, assets, tickets, or users...
                </div>
              ) : searching ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                  Searching...
                </div>
              ) : (searchResults.nav.length + searchResults.assets.length + searchResults.tickets.length + searchResults.users.length + searchResults.services.length) === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                  No results for &quot;{searchQuery}&quot;
                </div>
              ) : (
                <>
                  {searchResults.nav.length > 0 && (
                    <>
                      <div style={{ padding: "4px 8px", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>Pages</div>
                      {searchResults.nav.map((item: any) => (
                        <button key={item.href} onClick={() => { router.push(item.href); setShowSearch(false); setSearchQuery(""); }}
                          style={{
                            width: "100%", padding: "10px 12px", background: "none", border: "none",
                            display: "flex", alignItems: "center", gap: 10, borderRadius: 8,
                            color: "var(--text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                          }}>
                          <item.icon size={16} style={{ color: "var(--brand-400)" }} />
                          <span>{item.name}</span>
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)" }}>{item.href}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {searchResults.assets.length > 0 && (
                    <>
                      <div style={{ padding: "8px 8px 4px", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>Assets</div>
                      {searchResults.assets.map((a: any) => (
                        <button key={a.id} onClick={() => { router.push(`/dashboard/assets/${a.id}`); setShowSearch(false); setSearchQuery(""); }}
                          style={{
                            width: "100%", padding: "8px 12px", background: "none", border: "none",
                            display: "flex", alignItems: "center", gap: 10, borderRadius: 8,
                            color: "var(--text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                          }}>
                          <Package size={14} style={{ color: "#06b6d4" }} />
                          <span>{a.name}</span>
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)" }}>{a.assetTag || a.status}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {searchResults.tickets.length > 0 && (
                    <>
                      <div style={{ padding: "8px 8px 4px", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>Tickets</div>
                      {searchResults.tickets.map((t: any) => (
                        <button key={t.id} onClick={() => { router.push(`/dashboard/tickets/${t.id}`); setShowSearch(false); setSearchQuery(""); }}
                          style={{
                            width: "100%", padding: "8px 12px", background: "none", border: "none",
                            display: "flex", alignItems: "center", gap: 10, borderRadius: 8,
                            color: "var(--text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                          }}>
                          <Ticket size={14} style={{ color: "#8b5cf6" }} />
                          <span>{t.subject}</span>
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)" }}>{t.ticketNumber}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {searchResults.users.length > 0 && (
                    <>
                      <div style={{ padding: "8px 8px 4px", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>Users</div>
                      {searchResults.users.map((u: any) => (
                        <button key={u.id} onClick={() => { router.push(`/dashboard/users`); setShowSearch(false); setSearchQuery(""); }}
                          style={{
                            width: "100%", padding: "8px 12px", background: "none", border: "none",
                            display: "flex", alignItems: "center", gap: 10, borderRadius: 8,
                            color: "var(--text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                          }}>
                          <User size={14} style={{ color: "#10b981" }} />
                          <span>{u.firstName} {u.lastName}</span>
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)" }}>{u.email}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {searchResults.services.length > 0 && (
                    <>
                      <div style={{ padding: "8px 8px 4px", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>Business services</div>
                      {searchResults.services.map((s: any) => (
                        <button key={s.id} onClick={() => { router.push(`/dashboard/cmdb`); setShowSearch(false); setSearchQuery(""); }}
                          style={{
                            width: "100%", padding: "8px 12px", background: "none", border: "none",
                            display: "flex", alignItems: "center", gap: 10, borderRadius: 8,
                            color: "var(--text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                          }}>
                          <Server size={14} style={{ color: "#8b5cf6" }} />
                          <span>{s.name}</span>
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)" }}>{s.status || "CI"}</span>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
    <AiCopilot />
    </WalkthroughProvider>
  );
}
