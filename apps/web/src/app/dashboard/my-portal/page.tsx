"use client";
import { useState, useEffect, useCallback } from "react";
import {
  User, Monitor, Ticket, Package, Search, Send, Loader2,
  CheckCircle2, Clock, AlertTriangle, MessageSquare, BookOpen,
  Download, Globe, Shield, Wrench, Server, Play, ChevronRight,
  HeartPulse, HelpCircle, Laptop, Printer, Truck, HardDrive,
  X, Sparkles, ArrowRight, LayoutDashboard, Bug, Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ─── Constants ─────────────────────────────────────────────── */

type TabId = "dashboard" | "devices" | "software" | "tickets" | "report";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
  { id: "devices", label: "My Devices", icon: <Monitor size={15} /> },
  { id: "software", label: "Request Software", icon: <Download size={15} /> },
  { id: "tickets", label: "My Tickets", icon: <Ticket size={15} /> },
  { id: "report", label: "Report Issue", icon: <Bug size={15} /> },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981", IN_USE: "#3b82f6", IN_REPAIR: "#f59e0b",
  RETIRED: "#6b7280", DISPOSED: "#ef4444",
};

const COMPLIANCE_MAP: Record<string, { color: string; label: string }> = {
  compliant: { color: "#10b981", label: "Compliant" },
  warning: { color: "#f59e0b", label: "Warning" },
  noncompliant: { color: "#ef4444", label: "Non-Compliant" },
};

const TICKET_STATUS: Record<string, { color: string; bg: string }> = {
  NEW: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  OPEN: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  IN_PROGRESS: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  PENDING: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  RESOLVED: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  CLOSED: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const PRIORITY_COLORS: Record<string, { color: string; bg: string }> = {
  LOW: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  MEDIUM: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  HIGH: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const ASSET_ICONS: Record<string, React.ReactNode> = {
  Laptop: <Laptop size={20} />,
  Server: <Server size={20} />,
  Desktop: <Monitor size={20} />,
  Printer: <Printer size={20} />,
  Vehicle: <Truck size={20} />,
};

const ISSUE_CATEGORIES = ["Hardware", "Software", "Network", "Access", "Other"];
const ISSUE_PRIORITIES = ["Low", "Medium", "High"];

/* ─── Page Component ────────────────────────────────────────── */

export default function MyPortalPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [profile, setProfile] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [kbArticles, setKbArticles] = useState<any[]>([]);

  // Software request
  const [softwareSearch, setSoftwareSearch] = useState("");
  const [requestingApp, setRequestingApp] = useState<any | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Report issue form
  const [issueForm, setIssueForm] = useState({
    subject: "", category: "Software", priority: "Medium", description: "",
  });
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(false);

  // KB search
  const [kbSearch, setKbSearch] = useState("");

  /* ── Data Fetching ──────────────────────────────────────── */

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [p, d, a, t, kb] = await Promise.all([
          apiFetch("/users/me").catch(() => null),
          apiFetch("/users/me/dashboard").catch(() => null),
          apiFetch("/users/me/assets").catch(() => []),
          apiFetch("/users/me/tickets").catch(() => ({ data: [] })),
          apiFetch("/knowledge-base?limit=10").catch(() => []),
        ]);
        setProfile(p);
        setDashboard(d);
        setDevices(Array.isArray(a) ? a : []);
        setTickets(t?.data ? t.data : Array.isArray(t) ? t : []);
        setKbArticles(Array.isArray(kb?.data) ? kb.data : Array.isArray(kb) ? kb : []);
      } catch (err: any) {
        setError(err.message || "Failed to load portal data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Lazy-load software catalog when tab is opened
  useEffect(() => {
    if (activeTab === "software" && catalog.length === 0) {
      apiFetch("/patches/software/catalog")
        .then((data: any) => setCatalog(Array.isArray(data) ? data : data?.data || []))
        .catch(() => setCatalog([]));
    }
  }, [activeTab, catalog.length]);

  /* ── Software Request Handler ───────────────────────────── */

  const submitSoftwareRequest = useCallback(async () => {
    if (!requestingApp) return;
    setRequestSubmitting(true);
    try {
      await apiFetch("/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: `Software Request: ${requestingApp.name}`,
          description: `Please install ${requestingApp.name}${requestingApp.version ? ` (v${requestingApp.version})` : ""} on my device.`,
          priority: "LOW",
          category: "Software Request",
        }),
      });
      setRequestSuccess(true);
      // Refresh tickets
      const t = await apiFetch("/users/me/tickets").catch(() => ({ data: [] }));
      setTickets(t?.data ? t.data : Array.isArray(t) ? t : []);
      setTimeout(() => { setRequestingApp(null); setRequestSuccess(false); }, 2000);
    } catch {
      alert("Failed to submit request. Please try again.");
    } finally {
      setRequestSubmitting(false);
    }
  }, [requestingApp]);

  /* ── Report Issue Handler ───────────────────────────────── */

  const submitIssue = useCallback(async () => {
    if (!issueForm.subject.trim() || !issueForm.description.trim()) return;
    setIssueSubmitting(true);
    try {
      await apiFetch("/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: issueForm.subject,
          description: issueForm.description,
          priority: issueForm.priority.toUpperCase(),
          category: issueForm.category,
        }),
      });
      setIssueSuccess(true);
      setIssueForm({ subject: "", category: "Software", priority: "Medium", description: "" });
      // Refresh tickets
      const t = await apiFetch("/users/me/tickets").catch(() => ({ data: [] }));
      setTickets(t?.data ? t.data : Array.isArray(t) ? t : []);
      setTimeout(() => setIssueSuccess(false), 4000);
    } catch {
      alert("Failed to submit issue. Please try again.");
    } finally {
      setIssueSubmitting(false);
    }
  }, [issueForm]);

  /* ── Computed ────────────────────────────────────────────── */

  const userName = profile?.firstName || "there";
  const openTicketCount = dashboard?.openTickets ?? tickets.filter((t: any) => !["RESOLVED", "CLOSED"].includes(t.status)).length;
  const deviceCount = dashboard?.assets ?? devices.length;

  const filteredCatalog = catalog.filter((app: any) =>
    !softwareSearch || app.name?.toLowerCase().includes(softwareSearch.toLowerCase())
  );

  const filteredKb = kbArticles.filter((a: any) =>
    !kbSearch || a.title?.toLowerCase().includes(kbSearch.toLowerCase()) ||
    a.content?.toLowerCase().includes(kbSearch.toLowerCase())
  );

  /* ── Styles ─────────────────────────────────────────────── */

  const sty = {
    tabBar: {
      display: "flex", gap: 2, marginBottom: 24, padding: 4, borderRadius: 12,
      background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
      width: "fit-content",
    } as React.CSSProperties,
    tab: (active: boolean) => ({
      display: "flex", alignItems: "center", gap: 7, padding: "10px 18px",
      borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
      fontFamily: "inherit", transition: "all 0.25s ease",
      background: active ? "rgba(34,211,238,0.12)" : "transparent",
      color: active ? "#22d3ee" : "var(--text-tertiary)",
      boxShadow: active ? "0 0 0 1px rgba(34,211,238,0.2)" : "none",
    } as React.CSSProperties),
    sectionTitle: {
      fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px",
      display: "flex", alignItems: "center", gap: 8,
    } as React.CSSProperties,
    badge: (color: string, bg: string) => ({
      display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700,
      padding: "3px 10px", borderRadius: 6, color, background: bg,
      textTransform: "uppercase" as const, letterSpacing: "0.5px",
    }),
    iconBox: (color: string) => ({
      width: 44, height: 44, borderRadius: 12,
      background: `${color}12`, display: "flex",
      alignItems: "center", justifyContent: "center", color, flexShrink: 0,
    } as React.CSSProperties),
    input: {
      width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border-subtle)",
      background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13,
      fontFamily: "inherit", outline: "none", transition: "border-color 0.2s",
    } as React.CSSProperties,
    searchWrap: {
      position: "relative" as const, marginBottom: 20,
    },
    searchIcon: {
      position: "absolute" as const, left: 12, top: "50%", transform: "translateY(-50%)",
      color: "var(--text-tertiary)", pointerEvents: "none" as const,
    },
    emptyState: {
      textAlign: "center" as const, padding: "60px 20px", color: "var(--text-tertiary)",
    },
    modalOverlay: {
      position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, animation: "fadeIn 0.2s ease",
    },
    modal: {
      background: "var(--bg-card, #1a1b2e)", border: "1px solid var(--border-subtle)",
      borderRadius: 16, padding: 28, minWidth: 400, maxWidth: 480,
      boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    } as React.CSSProperties,
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* ── RENDER ─────────────────────────────────────────────── */
  /* ═══════════════════════════════════════════════════════════ */

  return (
    <>
      {/* ── Page Header ────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles size={22} style={{ color: "var(--brand-400)" }} />
            Self-Service Portal
          </h1>
          <p className="page-subtitle">
            Welcome back, {userName} — manage your devices, software, and support requests
          </p>
        </div>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────── */}
      <div style={sty.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={sty.tab(activeTab === t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Loading / Error ────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-tertiary)" }}>
          <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Loading your portal…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
        </div>
      )}

      {error && !loading && (
        <div className="card" style={{ padding: 24, textAlign: "center", borderColor: "rgba(239,68,68,0.3)" }}>
          <AlertTriangle size={28} style={{ color: "#ef4444", marginBottom: 8 }} />
          <p style={{ margin: 0, color: "#ef4444", fontSize: 14, fontWeight: 600 }}>{error}</p>
          <p style={{ margin: "8px 0 0", color: "var(--text-tertiary)", fontSize: 12 }}>
            Please refresh the page or try again later.
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ════════════════════════════════════════════════════ */}
          {/* ── TAB 1: DASHBOARD ────────────────────────────── */}
          {/* ════════════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <div style={{ animation: "slideUp 0.3s ease" }}>
              {/* Welcome Banner */}
              <div className="card" style={{
                padding: 28, marginBottom: 24,
                background: "linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(139,92,246,0.06) 100%)",
                borderColor: "rgba(34,211,238,0.15)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: "linear-gradient(135deg, #22d3ee, #8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <User size={26} color="#fff" />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                      Welcome back, {userName}! 👋
                    </h2>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                      Here's a snapshot of your IT landscape. Use the tabs above to manage everything.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
                {[
                  { label: "Assigned Devices", value: deviceCount, icon: <Monitor size={20} />, color: "#3b82f6" },
                  { label: "Open Tickets", value: openTicketCount, icon: <Clock size={20} />, color: "#f59e0b" },
                  { label: "Resolved", value: dashboard?.resolvedTickets ?? 0, icon: <CheckCircle2 size={20} />, color: "#10b981" },
                  { label: "Available Software", value: catalog.length || "—", icon: <Download size={20} />, color: "#8b5cf6" },
                ].map((stat, i) => (
                  <div key={i} className="card" style={{
                    padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "all 0.25s ease", cursor: "default",
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                        {stat.label}
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                        {stat.value}
                      </div>
                    </div>
                    <div style={sty.iconBox(stat.color)}>{stat.icon}</div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <h3 style={sty.sectionTitle}>
                <Wrench size={16} style={{ color: "var(--brand-400)" }} />
                Quick Actions
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
                {[
                  { icon: <Download size={22} />, label: "Request Software", sub: "Browse & install apps", tab: "software" as TabId, color: "#8b5cf6" },
                  { icon: <Bug size={22} />, label: "Report an Issue", sub: "Submit a support ticket", tab: "report" as TabId, color: "#ef4444" },
                  { icon: <Ticket size={22} />, label: "Check Ticket Status", sub: "View your open tickets", tab: "tickets" as TabId, color: "#06b6d4" },
                  { icon: <BookOpen size={22} />, label: "Knowledge Base", sub: "Search guides & FAQs", tab: "dashboard" as TabId, color: "#f59e0b", kbJump: true },
                ].map((action, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (action.kbJump) {
                        setKbSearch("");
                        // Scroll to KB section
                        document.getElementById("portal-kb-section")?.scrollIntoView({ behavior: "smooth" });
                      } else {
                        setActiveTab(action.tab);
                      }
                    }}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14,
                      padding: 20, borderRadius: 14, cursor: "pointer", textAlign: "left",
                      background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
                      fontFamily: "inherit", transition: "all 0.25s ease", position: "relative", overflow: "hidden",
                      color: "var(--text-primary)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${action.color}40`;
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${action.color}15`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div style={sty.iconBox(action.color)}>{action.icon}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{action.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{action.sub}</div>
                    </div>
                    <ArrowRight size={14} style={{ position: "absolute", bottom: 16, right: 16, color: "var(--text-tertiary)", opacity: 0.5 }} />
                  </button>
                ))}
              </div>

              {/* Recent Tickets */}
              <h3 style={sty.sectionTitle}>
                <Ticket size={16} style={{ color: "var(--brand-400)" }} />
                Recent Tickets
              </h3>
              <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
                {tickets.length === 0 ? (
                  <div style={sty.emptyState}>
                    <Ticket size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No tickets yet — click "Report an Issue" to get started.</p>
                  </div>
                ) : (
                  <div style={{ padding: 4 }}>
                    {tickets.slice(0, 5).map((t: any, i: number) => (
                      <div key={t.id || i} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                        borderRadius: 10, transition: "background 0.15s",
                        borderBottom: i < Math.min(tickets.length, 5) - 1 ? "1px solid var(--border-subtle)" : "none",
                      }}>
                        <span style={{
                          fontFamily: "monospace", fontSize: 11, color: "var(--brand-400)",
                          fontWeight: 700, minWidth: 90,
                        }}>
                          {t.ticketNumber || `#${t.id?.slice(0, 8)}`}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                          {t.subject}
                        </span>
                        <span style={sty.badge(
                          TICKET_STATUS[t.status]?.color || "#6b7280",
                          TICKET_STATUS[t.status]?.bg || "rgba(107,114,128,0.12)",
                        )}>
                          {(t.status || "").replace(/_/g, " ")}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", minWidth: 80, textAlign: "right" }}>
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Knowledge Base Quick Search */}
              <div id="portal-kb-section">
                <h3 style={sty.sectionTitle}>
                  <BookOpen size={16} style={{ color: "var(--brand-400)" }} />
                  Knowledge Base
                </h3>
                <div style={sty.searchWrap}>
                  <Search size={16} style={sty.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search articles, guides, and FAQs…"
                    value={kbSearch}
                    onChange={(e) => setKbSearch(e.target.value)}
                    style={{ ...sty.input, paddingLeft: 38 }}
                  />
                </div>
                {filteredKb.length === 0 ? (
                  <div className="card" style={sty.emptyState}>
                    <BookOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>{kbSearch ? "No articles match your search." : "No knowledge base articles available."}</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {filteredKb.slice(0, 6).map((a: any) => (
                      <div key={a.id} className="card" style={{
                        padding: 18, cursor: "pointer", transition: "all 0.2s ease",
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.25)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</h4>
                            <p style={{
                              margin: 0, fontSize: 12, color: "var(--text-tertiary)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {a.content?.substring(0, 150) || "No preview available"}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                            {a.category && <span style={sty.badge("#3b82f6", "rgba(59,130,246,0.12)")}>{a.category}</span>}
                            <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/* ── TAB 2: MY DEVICES ───────────────────────────── */}
          {/* ════════════════════════════════════════════════════ */}
          {activeTab === "devices" && (
            <div style={{ animation: "slideUp 0.3s ease" }}>
              <h3 style={sty.sectionTitle}>
                <Monitor size={16} style={{ color: "var(--brand-400)" }} />
                My Assigned Devices
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)" }}>
                  {devices.length} device{devices.length !== 1 ? "s" : ""}
                </span>
              </h3>

              {devices.length === 0 ? (
                <div className="card" style={sty.emptyState}>
                  <Monitor size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No devices assigned</p>
                  <p style={{ margin: "6px 0 0", fontSize: 12 }}>Contact IT if you believe this is an error.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
                  {devices.map((d: any) => {
                    const compliance = d.complianceStatus || (d.status === "ACTIVE" ? "compliant" : d.status === "IN_REPAIR" ? "warning" : "noncompliant");
                    const comp = COMPLIANCE_MAP[compliance] || COMPLIANCE_MAP.compliant;
                    return (
                      <div key={d.id} className="card" style={{
                        padding: 20, transition: "all 0.25s ease",
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.2)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                      >
                        <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                          <div style={sty.iconBox("#3b82f6")}>
                            {ASSET_ICONS[d.assetType?.name] || <HardDrive size={20} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 2 }}>
                              {d.name}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                              {[d.manufacturer, d.model].filter(Boolean).join(" ") || d.assetType?.name || "Unknown device"}
                            </div>
                          </div>
                          {/* Compliance Dot */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={comp.label}>
                            <div style={{
                              width: 10, height: 10, borderRadius: "50%", background: comp.color,
                              boxShadow: `0 0 8px ${comp.color}60`,
                            }} />
                          </div>
                        </div>

                        <div style={{
                          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px",
                          padding: "14px 0 0", borderTop: "1px solid var(--border-subtle)",
                        }}>
                          <div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Type</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{d.assetType?.name || "—"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>OS</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{d.operatingSystem || d.os || "—"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Status</div>
                            <span style={sty.badge(
                              STATUS_COLORS[d.status] || "#6b7280",
                              `${STATUS_COLORS[d.status] || "#6b7280"}18`,
                            )}>{(d.status || "Unknown").replace(/_/g, " ")}</span>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Last Seen</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                              {d.lastSeen ? new Date(d.lastSeen).toLocaleDateString() : d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "—"}
                            </div>
                          </div>
                        </div>

                        {/* Compliance label */}
                        <div style={{
                          marginTop: 14, padding: "8px 12px", borderRadius: 8,
                          background: `${comp.color}10`, display: "flex", alignItems: "center", gap: 8,
                        }}>
                          {compliance === "compliant" ? <Shield size={14} style={{ color: comp.color }} /> :
                            compliance === "warning" ? <AlertTriangle size={14} style={{ color: comp.color }} /> :
                              <AlertTriangle size={14} style={{ color: comp.color }} />}
                          <span style={{ fontSize: 11, fontWeight: 600, color: comp.color }}>{comp.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/* ── TAB 3: REQUEST SOFTWARE ─────────────────────── */}
          {/* ════════════════════════════════════════════════════ */}
          {activeTab === "software" && (
            <div style={{ animation: "slideUp 0.3s ease" }}>
              <h3 style={sty.sectionTitle}>
                <Download size={16} style={{ color: "var(--brand-400)" }} />
                Software Catalog
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)" }}>
                  {filteredCatalog.length} available
                </span>
              </h3>

              {/* Search */}
              <div style={sty.searchWrap}>
                <Search size={16} style={sty.searchIcon} />
                <input
                  type="text"
                  placeholder="Search software by name…"
                  value={softwareSearch}
                  onChange={(e) => setSoftwareSearch(e.target.value)}
                  style={{ ...sty.input, paddingLeft: 38 }}
                />
              </div>

              {filteredCatalog.length === 0 ? (
                <div className="card" style={sty.emptyState}>
                  <Package size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    {softwareSearch ? "No software matches your search" : "Software catalog is loading…"}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 12 }}>
                    {softwareSearch ? "Try a different search term" : "Please wait or try refreshing"}
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {filteredCatalog.map((app: any, i: number) => (
                    <div key={app.id || i} className="card" style={{
                      padding: 20, transition: "all 0.25s ease", display: "flex", flexDirection: "column",
                    }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                    >
                      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        <div style={sty.iconBox("#8b5cf6")}>
                          {app.icon ? (
                            <img src={app.icon} alt="" style={{ width: 22, height: 22, borderRadius: 4 }} />
                          ) : (
                            <Package size={20} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 2 }}>
                            {app.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                            {app.vendor || app.publisher || ""}
                            {app.version ? ` · v${app.version}` : ""}
                          </div>
                        </div>
                      </div>
                      {app.description && (
                        <p style={{
                          fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 14px",
                          lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis",
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        }}>
                          {app.description}
                        </p>
                      )}
                      <div style={{ marginTop: "auto" }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => { setRequestingApp(app); setRequestSuccess(false); }}
                          style={{
                            width: "100%", padding: "10px 16px", fontSize: 12, fontWeight: 600,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            borderRadius: 10,
                          }}
                        >
                          <Plus size={14} /> Request Install
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Software Request Modal ──────────────────── */}
              {requestingApp && (
                <div style={sty.modalOverlay} onClick={() => { if (!requestSubmitting) { setRequestingApp(null); setRequestSuccess(false); } }}>
                  <div style={sty.modal} onClick={(e) => e.stopPropagation()}>
                    {requestSuccess ? (
                      <div style={{ textAlign: "center", padding: "20px 0" }}>
                        <CheckCircle2 size={48} style={{ color: "#10b981", marginBottom: 16 }} />
                        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                          Request Submitted!
                        </h3>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>
                          Your request for <strong>{requestingApp.name}</strong> has been submitted. Check "My Tickets" for updates.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                          <div>
                            <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                              Confirm Software Request
                            </h3>
                            <p style={{ margin: 0, fontSize: 12, color: "var(--text-tertiary)" }}>
                              A ticket will be created for IT to process your request.
                            </p>
                          </div>
                          <button
                            onClick={() => setRequestingApp(null)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "var(--text-tertiary)", padding: 4,
                            }}
                          >
                            <X size={18} />
                          </button>
                        </div>

                        <div className="card" style={{
                          padding: 16, marginBottom: 20,
                          background: "rgba(139,92,246,0.06)", borderColor: "rgba(139,92,246,0.15)",
                        }}>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <div style={sty.iconBox("#8b5cf6")}>
                              <Package size={20} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                                {requestingApp.name}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                {requestingApp.vendor || requestingApp.publisher || ""}
                                {requestingApp.version ? ` · v${requestingApp.version}` : ""}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => setRequestingApp(null)}
                            style={{
                              padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-subtle)",
                              background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
                              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={submitSoftwareRequest}
                            disabled={requestSubmitting}
                            style={{
                              padding: "10px 24px", borderRadius: 10, fontSize: 13,
                              fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                            }}
                          >
                            {requestSubmitting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                            {requestSubmitting ? "Submitting…" : "Submit Request"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/* ── TAB 4: MY TICKETS ───────────────────────────── */}
          {/* ════════════════════════════════════════════════════ */}
          {activeTab === "tickets" && (
            <div style={{ animation: "slideUp 0.3s ease" }}>
              <h3 style={sty.sectionTitle}>
                <Ticket size={16} style={{ color: "var(--brand-400)" }} />
                My Tickets
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)" }}>
                  {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
                </span>
              </h3>

              {tickets.length === 0 ? (
                <div className="card" style={sty.emptyState}>
                  <Ticket size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No tickets found</p>
                  <p style={{ margin: "6px 0 0", fontSize: 12 }}>You haven't created any support tickets yet.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab("report")}
                    style={{ marginTop: 16, padding: "10px 24px", borderRadius: 10, fontSize: 13 }}
                  >
                    <Bug size={14} style={{ marginRight: 6 }} />
                    Report an Issue
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {tickets.map((t: any, i: number) => {
                    const statusStyle = TICKET_STATUS[t.status] || TICKET_STATUS.OPEN;
                    const priorityStyle = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.MEDIUM;
                    return (
                      <div key={t.id || i} className="card" style={{
                        padding: 20, transition: "all 0.2s ease",
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${statusStyle.color}30`; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                          <div style={{
                            ...sty.iconBox(statusStyle.color),
                            width: 40, height: 40, borderRadius: 10,
                          }}>
                            <Ticket size={18} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                              <span style={{
                                fontFamily: "monospace", fontSize: 11, color: "var(--brand-400)",
                                fontWeight: 700,
                              }}>
                                {t.ticketNumber || `#${t.id?.slice(0, 8)}`}
                              </span>
                              <span style={sty.badge(statusStyle.color, statusStyle.bg)}>
                                {(t.status || "").replace(/_/g, " ")}
                              </span>
                              <span style={sty.badge(priorityStyle.color, priorityStyle.bg)}>
                                {t.priority || "MEDIUM"}
                              </span>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>
                              {t.subject}
                            </div>
                            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-tertiary)" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Clock size={11} />
                                {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                              </span>
                              {t.assignedTo && (
                                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <User size={11} />
                                  {t.assignedTo.firstName} {t.assignedTo.lastName}
                                </span>
                              )}
                              {t.category && (
                                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <MessageSquare size={11} />
                                  {t.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/* ── TAB 5: REPORT ISSUE ─────────────────────────── */}
          {/* ════════════════════════════════════════════════════ */}
          {activeTab === "report" && (
            <div style={{ animation: "slideUp 0.3s ease", maxWidth: 640 }}>
              <h3 style={sty.sectionTitle}>
                <Bug size={16} style={{ color: "var(--brand-400)" }} />
                Report an Issue
              </h3>

              {issueSuccess ? (
                <div className="card" style={{
                  padding: 40, textAlign: "center",
                  background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(34,211,238,0.04) 100%)",
                  borderColor: "rgba(16,185,129,0.2)",
                }}>
                  <CheckCircle2 size={52} style={{ color: "#10b981", marginBottom: 16 }} />
                  <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                    Issue Reported Successfully!
                  </h3>
                  <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-tertiary)", maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
                    Your ticket has been created. Our IT team will review it shortly. You can track progress in "My Tickets".
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => setActiveTab("tickets")}
                      style={{ padding: "10px 24px", borderRadius: 10, fontSize: 13 }}
                    >
                      View My Tickets
                    </button>
                    <button
                      onClick={() => setIssueSuccess(false)}
                      style={{
                        padding: "10px 24px", borderRadius: 10, border: "1px solid var(--border-subtle)",
                        background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
                        fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                      }}
                    >
                      Report Another
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: 28 }}>
                  <div style={{ display: "grid", gap: 20 }}>
                    {/* Subject */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                        Subject <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Brief description of the issue…"
                        value={issueForm.subject}
                        onChange={(e) => setIssueForm({ ...issueForm, subject: e.target.value })}
                        style={sty.input}
                      />
                    </div>

                    {/* Category & Priority Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                          Category
                        </label>
                        <select
                          value={issueForm.category}
                          onChange={(e) => setIssueForm({ ...issueForm, category: e.target.value })}
                          style={{ ...sty.input, cursor: "pointer", appearance: "auto" }}
                        >
                          {ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                          Priority
                        </label>
                        <select
                          value={issueForm.priority}
                          onChange={(e) => setIssueForm({ ...issueForm, priority: e.target.value })}
                          style={{ ...sty.input, cursor: "pointer", appearance: "auto" }}
                        >
                          {ISSUE_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                        Description <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <textarea
                        placeholder="Provide details about the issue — steps to reproduce, error messages, etc."
                        value={issueForm.description}
                        onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                        rows={6}
                        style={{ ...sty.input, resize: "vertical", lineHeight: 1.6 }}
                      />
                    </div>

                    {/* Submit */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button
                        onClick={() => setIssueForm({ subject: "", category: "Software", priority: "Medium", description: "" })}
                        style={{
                          padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-subtle)",
                          background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
                          fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                        }}
                      >
                        Clear
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={submitIssue}
                        disabled={issueSubmitting || !issueForm.subject.trim() || !issueForm.description.trim()}
                        style={{
                          padding: "10px 28px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                          display: "flex", alignItems: "center", gap: 8,
                          opacity: (!issueForm.subject.trim() || !issueForm.description.trim()) ? 0.5 : 1,
                        }}
                      >
                        {issueSubmitting ? (
                          <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Submitting…</>
                        ) : (
                          <><Send size={14} /> Submit Issue</>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Help text */}
                  <div style={{
                    marginTop: 20, padding: "14px 16px", borderRadius: 10,
                    background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.1)",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <HelpCircle size={16} style={{ color: "#22d3ee", flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                      <strong style={{ color: "var(--text-secondary)" }}>Tip:</strong> Include as much detail as possible — device name, error screenshots,
                      and the steps you took before the issue appeared. This helps our team resolve it faster.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
