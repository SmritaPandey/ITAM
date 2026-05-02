"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Monitor, Server, Truck, Ticket, Network, Shield, ShieldCheck,
  Settings, Bell, Search, ChevronDown, Camera, MonitorPlay,
  BarChart3, Zap, Users, Building2, Package, LogOut, User,
  AlertTriangle, CheckCircle2, Info, Clock, X, Radar, Key, FileText, BookOpen,
  Headphones, UserCircle, Wrench, Scan, ShoppingCart, GitBranch, AlertOctagon,
  Sun, Moon, Menu,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }

const navSections = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard", badge: null },
      { name: "My Portal", icon: UserCircle, href: "/dashboard/my-portal", badge: null },
    ],
  },
  {
    label: "Asset Management",
    items: [
      { name: "All Assets", icon: Package, href: "/dashboard/assets", badge: null },
      { name: "IT Assets", icon: Monitor, href: "/dashboard/it-assets", badge: null },
      { name: "Non-IT Assets", icon: Building2, href: "/dashboard/non-it-assets", badge: null },
      { name: "CMDB", icon: Server, href: "/dashboard/cmdb", badge: null },
    ],
  },
  {
    label: "Operations",
    items: [
      { name: "Tickets", icon: Ticket, href: "/dashboard/tickets", badge: null },
      { name: "Work Orders", icon: Wrench, href: "/dashboard/work-orders", badge: null },
      { name: "Discovery", icon: Radar, href: "/dashboard/discovery", badge: null },
      { name: "Patch Mgmt", icon: Shield, href: "/dashboard/patches", badge: null },
      { name: "Network (NMS)", icon: Network, href: "/dashboard/network", badge: null },
      { name: "Security Scan", icon: Scan, href: "/dashboard/scanning", badge: null },
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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Hydrate theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const t = saved || "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // Redirect staff to portal
      if (payload.role === "Employee") { router.push("/portal"); return; }
      setUser(payload);
    } catch { router.push("/login"); }

    // Fetch ticket count for badge
    fetch(`${API}/tickets?limit=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setTicketCount(d.total || 0)).catch(() => {});

    // Fetch real notifications
    fetch(`${API}/notifications?limit=10`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        setNotifications(d.data || []);
        setUnreadCount(d.unread || 0);
      }).catch(() => {});
  }, [router]);

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
    const token = getToken();
    await fetch(`${API}/notifications/read-all`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }


  // Global search across API
  const [searchResults, setSearchResults] = useState<{ nav: any[]; assets: any[]; tickets: any[]; users: any[] }>({ nav: [], assets: [], tickets: [], users: [] });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults({ nav: [], assets: [], tickets: [], users: [] });
      return;
    }
    const q = searchQuery.toLowerCase();
    const nav = navSections.flatMap(s => s.items).filter(i => i.name.toLowerCase().includes(q));

    const timer = setTimeout(() => {
      const token = getToken();
      setSearching(true);
      Promise.all([
        fetch(`${API}/assets?search=${encodeURIComponent(searchQuery)}&limit=5`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API}/tickets?search=${encodeURIComponent(searchQuery)}&limit=5`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API}/users?search=${encodeURIComponent(searchQuery)}&limit=5`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ data: [] })),
      ]).then(([a, t, u]) => {
        setSearchResults({ nav, assets: a.data || [], tickets: t.data || [], users: u.data || [] });
      }).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!user) return null;

  return (
    <div className="app-layout">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />
      )}
      {/* Sidebar */}
      <aside className={`sidebar${mobileSidebarOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/favicon.png" alt="ReconAPM" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span className="sidebar-brand-text">ReconAPM</span>
        </div>
        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map((item) => {
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
          ))}
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
          {children}
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
              ) : (searchResults.nav.length + searchResults.assets.length + searchResults.tickets.length + searchResults.users.length) === 0 ? (
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
                        <button key={a.id} onClick={() => { router.push(`/dashboard/assets`); setShowSearch(false); setSearchQuery(""); }}
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
                        <button key={t.id} onClick={() => { router.push(`/dashboard/tickets`); setShowSearch(false); setSearchQuery(""); }}
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
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
