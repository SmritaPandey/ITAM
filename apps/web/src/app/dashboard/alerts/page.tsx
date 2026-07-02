"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Bell, Shield, AlertTriangle, AlertOctagon, CheckCircle2, Clock,
  RefreshCw, Loader2, Filter, Plus, Trash2, ChevronDown, Activity,
  Mail, Globe, Server, Eye, EyeOff, Info, Zap, ShieldCheck,
  ToggleLeft, ToggleRight, X, Check, BellRing, Hash, Timer,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ═══════════════════════════════════════════════════════════════
   Constants & Types
   ═══════════════════════════════════════════════════════════════ */

const SEVERITY_MAP: Record<string, { color: string; bg: string; label: string }> = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.10)", label: "Critical" },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.10)", label: "High" },
  MEDIUM:   { color: "#eab308", bg: "rgba(234,179,8,0.10)",  label: "Medium" },
  LOW:      { color: "#3b82f6", bg: "rgba(59,130,246,0.10)",  label: "Low" },
  INFO:     { color: "#6b7280", bg: "rgba(107,114,128,0.10)", label: "Info" },
};

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

const CATEGORY_OPTIONS = [
  "USB_DEVICE", "PORT_CHANGE", "FIM_CHANGE", "COMPLIANCE",
  "SECURITY", "SOFTWARE_CHANGE", "AGENT_OFFLINE",
];

const CHANNEL_OPTIONS = [
  { key: "in_app", label: "In-App" },
  { key: "email", label: "Email" },
  { key: "webhook", label: "Webhook" },
  { key: "syslog", label: "Syslog" },
];

const CHANNEL_TYPE_META: Record<string, { icon: any; color: string }> = {
  in_app:  { icon: Bell,   color: "#a78bfa" },
  email:   { icon: Mail,   color: "#38bdf8" },
  webhook: { icon: Globe,  color: "#34d399" },
  slack:   { icon: Globe,  color: "#34d399" },
  syslog:  { icon: Server, color: "#fb923c" },
  siem:    { icon: Server, color: "#fb923c" },
};

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? "s" : ""} ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo > 1 ? "s" : ""} ago`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_MAP[severity] || SEVERITY_MAP.INFO;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
      color: s.color, background: s.bg, letterSpacing: 0.3,
      border: `1px solid ${s.color}22`, textTransform: "uppercase",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 6,
      fontSize: 10, fontWeight: 600, color: "var(--text-secondary)",
      background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
      textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      {category?.replace(/_/g, " ")}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Inline Styles (scoped)
   ═══════════════════════════════════════════════════════════════ */

const STYLES = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 600px; } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .alerts-tab-bar { display: flex; gap: 4px; margin-bottom: 20px; }
  .alerts-tab {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 20px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; color: var(--text-secondary);
    transition: all 0.2s ease;
  }
  .alerts-tab:hover { background: var(--bg-elevated); color: var(--text-primary); }
  .alerts-tab.active {
    background: var(--brand-500); color: #fff;
    border-color: var(--brand-400); box-shadow: 0 0 12px rgba(99,102,241,0.25);
  }

  .alert-feed-item {
    padding: 16px 20px; border-bottom: 1px solid var(--border-default);
    display: flex; gap: 14px; align-items: flex-start;
    transition: background 0.15s ease;
    animation: fadeIn 0.3s ease both;
  }
  .alert-feed-item:hover { background: var(--bg-elevated); }
  .alert-feed-item:last-child { border-bottom: none; }

  .trend-bar {
    flex: 1; min-width: 20px; border-radius: 4px 4px 0 0;
    background: var(--brand-400); transition: height 0.4s ease;
    position: relative;
  }
  .trend-bar:hover {
    filter: brightness(1.2);
  }
  .trend-bar:hover::after {
    content: attr(data-count);
    position: absolute; top: -22px; left: 50%; transform: translateX(-50%);
    background: var(--bg-elevated); color: var(--text-primary);
    font-size: 10px; padding: 2px 6px; border-radius: 4px;
    border: 1px solid var(--border-default); white-space: nowrap;
  }

  .severity-bar-row {
    display: flex; align-items: center; gap: 10px; padding: 6px 0;
  }
  .severity-bar-fill {
    height: 8px; border-radius: 4px; transition: width 0.6s ease;
    min-width: 4px;
  }

  .rule-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 20px;
    border-bottom: 1px solid var(--border-default);
    transition: background 0.15s ease;
    animation: fadeIn 0.3s ease both;
  }
  .rule-row:hover { background: var(--bg-elevated); }
  .rule-row:last-child { border-bottom: none; }

  .channel-card {
    border-radius: 12px; padding: 20px; border: 1px solid var(--border-default);
    background: var(--bg-card); transition: all 0.2s ease;
  }
  .channel-card:hover {
    border-color: var(--brand-400); transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  }

  .form-field { display: flex; flex-direction: column; gap: 4px; }
  .form-field label { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
  .form-field input, .form-field select, .form-field textarea {
    padding: 8px 12px; border-radius: 8px; font-size: 13px;
    border: 1px solid var(--border-default); background: var(--bg-primary);
    color: var(--text-primary); outline: none; transition: border-color 0.2s;
  }
  .form-field input:focus, .form-field select:focus, .form-field textarea:focus {
    border-color: var(--brand-400); box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
  }

  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999;
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.2s ease;
    backdrop-filter: blur(4px);
  }
  .modal-content {
    background: var(--bg-card); border: 1px solid var(--border-default);
    border-radius: 16px; width: 520px; max-width: 95vw; max-height: 90vh;
    overflow-y: auto; padding: 24px; animation: fadeIn 0.25s ease;
    box-shadow: 0 24px 64px rgba(0,0,0,0.4);
  }

  .toggle-btn {
    width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer;
    position: relative; transition: background 0.2s ease;
  }
  .toggle-btn::after {
    content: ''; position: absolute; top: 3px; width: 16px; height: 16px;
    border-radius: 50%; background: #fff; transition: left 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .toggle-btn.on { background: var(--brand-400); }
  .toggle-btn.on::after { left: 21px; }
  .toggle-btn.off { background: var(--border-default); }
  .toggle-btn.off::after { left: 3px; }

  .empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 64px 24px; text-align: center; animation: fadeIn 0.4s ease;
  }

  .loading-skeleton {
    height: 14px; border-radius: 6px; width: 100%;
    background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--border-default) 50%, var(--bg-elevated) 75%);
    background-size: 200% 100%; animation: shimmer 1.5s ease infinite;
  }

  .filter-dropdown {
    position: relative; display: inline-block;
  }
  .filter-menu {
    position: absolute; top: 100%; left: 0; margin-top: 4px; z-index: 50;
    background: var(--bg-card); border: 1px solid var(--border-default);
    border-radius: 10px; padding: 4px; min-width: 160px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
    animation: fadeIn 0.15s ease;
  }
  .filter-option {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    border-radius: 6px; font-size: 12px; cursor: pointer; border: none;
    background: transparent; color: var(--text-primary); width: 100%;
    transition: background 0.15s;
  }
  .filter-option:hover { background: var(--bg-elevated); }
  .filter-option.selected { background: rgba(99,102,241,0.12); color: var(--brand-400); font-weight: 600; }

  .ack-pulse {
    animation: pulse 2s ease infinite;
  }
`;

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function AlertsPage() {
  type TabKey = "alerts" | "rules" | "channels";
  const [tab, setTab] = useState<TabKey>("alerts");

  /* ─── Alerts Tab State ─────────────────────────── */
  const [dashboard, setDashboard] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  /* ─── Rules Tab State ──────────────────────────── */
  const [rules, setRules] = useState<any[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    name: "", description: "", category: "USB_DEVICE", severity: "HIGH",
    channels: ["in_app"] as string[], cooldownMinutes: 15,
  });

  /* ─── Channels Tab State ───────────────────────── */
  const [channels, setChannels] = useState<any[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);

  /* ─── Data Fetching ────────────────────────────── */

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError("");
    try {
      const [dashData, alertsData] = await Promise.all([
        apiFetch("/alerts/dashboard"),
        apiFetch(`/alerts${severityFilter ? `?severity=${severityFilter}` : ""}`),
      ]);
      setDashboard(dashData);
      setAlerts(Array.isArray(alertsData) ? alertsData : alertsData?.data || alertsData?.alerts || []);
    } catch (e: any) {
      setAlertsError(e.message || "Failed to load alerts");
    } finally {
      setAlertsLoading(false);
    }
  }, [severityFilter]);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const data = await apiFetch("/alerts/rules");
      setRules(Array.isArray(data) ? data : data?.data || data?.rules || []);
    } catch { /* silently fail */ } finally { setRulesLoading(false); }
  }, []);

  const fetchChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const data = await apiFetch("/alerts/channels");
      setChannels(Array.isArray(data) ? data : data?.data || data?.channels || []);
    } catch { /* silently fail */ } finally { setChannelsLoading(false); }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => { if (tab === "rules") fetchRules(); }, [tab, fetchRules]);
  useEffect(() => { if (tab === "channels") fetchChannels(); }, [tab, fetchChannels]);

  /* ─── Alert Actions ────────────────────────────── */

  async function acknowledgeAlert(id: string) {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await apiFetch(`/alerts/${id}/acknowledge`, { method: "PATCH" });
      fetchAlerts();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  }

  async function resolveAlert(id: string) {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await apiFetch(`/alerts/${id}/resolve`, { method: "PATCH" });
      fetchAlerts();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  }

  async function acknowledgeAll() {
    try {
      const unacked = alerts.filter(a => !a.acknowledged && !a.resolved);
      await Promise.all(unacked.map(a => apiFetch(`/alerts/${a.id || a._id}/acknowledge`, { method: "PATCH" })));
      fetchAlerts();
    } catch (e: any) { alert(e.message); }
  }

  /* ─── Rule Actions ─────────────────────────────── */

  async function toggleRule(id: string) {
    try {
      await apiFetch(`/alerts/rules/${id}/toggle`, { method: "PATCH" });
      fetchRules();
    } catch (e: any) { alert(e.message); }
  }

  async function deleteRule(id: string) {
    try {
      await apiFetch(`/alerts/rules/${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      fetchRules();
    } catch (e: any) { alert(e.message); }
  }

  async function createRule() {
    try {
      await apiFetch("/alerts/rules", {
        method: "POST",
        body: JSON.stringify(newRule),
      });
      setShowCreateRule(false);
      setNewRule({ name: "", description: "", category: "USB_DEVICE", severity: "HIGH", channels: ["in_app"], cooldownMinutes: 15 });
      fetchRules();
    } catch (e: any) { alert(e.message); }
  }

  /* ─── Dashboard derivations ────────────────────── */

  const totalAlerts = dashboard?.totalAlerts ?? dashboard?.total ?? 0;
  const unacknowledged = dashboard?.unacknowledged ?? dashboard?.unacked ?? 0;
  const criticalCount = dashboard?.critical ?? 0;
  const last24h = dashboard?.last24h ?? dashboard?.recent ?? 0;

  // 7-day trend
  const trend: number[] = dashboard?.trend7d || dashboard?.trend || [];
  const trendMax = Math.max(...trend, 1);
  const trendLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Severity breakdown
  const severityBreakdown: Record<string, number> = dashboard?.severityBreakdown || dashboard?.bySeverity || {};
  const severityTotal = Object.values(severityBreakdown).reduce((a: number, b: any) => a + (Number(b) || 0), 0) || 1;

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell size={22} style={{ color: "var(--brand-400)" }} />
            Alerts &amp; Notifications
          </h1>
          <p className="page-subtitle">Security alerts center — monitor threats, manage rules, and configure notification channels</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => {
            if (tab === "alerts") { setAlertsLoading(true); fetchAlerts(); }
            else if (tab === "rules") { setRulesLoading(true); fetchRules(); }
            else { setChannelsLoading(true); fetchChannels(); }
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────── */}
      <div className="alerts-tab-bar">
        {([
          { key: "alerts" as TabKey, label: "Alerts", icon: <AlertTriangle size={13} />, count: totalAlerts },
          { key: "rules" as TabKey, label: "Alert Rules", icon: <Shield size={13} /> },
          { key: "channels" as TabKey, label: "Notification Channels", icon: <BellRing size={13} /> },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`alerts-tab ${tab === t.key ? "active" : ""}`}>
            {t.icon} {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{
                background: tab === t.key ? "rgba(255,255,255,0.2)" : "var(--bg-elevated)",
                padding: "1px 7px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                marginLeft: 2,
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════
         TAB 1: ALERTS
         ════════════════════════════════════════════════════ */}
      {tab === "alerts" && (
        <>
          {alertsLoading ? (
            <LoadingState />
          ) : alertsError ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <AlertOctagon size={32} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, color: "#ef4444", marginBottom: 12 }}>{alertsError}</p>
              <button className="btn btn-primary" onClick={() => { setAlertsLoading(true); fetchAlerts(); }}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : (
            <>
              {/* ── Stats Row ────────────────────────────── */}
              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-content">
                    <div className="stat-label">Total Alerts</div>
                    <div className="stat-value">{totalAlerts}</div>
                  </div>
                  <Activity size={18} style={{ color: "var(--brand-400)" }} />
                </div>
                <div className="stat-card" style={{ borderLeft: "3px solid #f97316" }}>
                  <div className="stat-content">
                    <div className="stat-label">Unacknowledged</div>
                    <div className="stat-value" style={{ color: "#f97316" }}>{unacknowledged}</div>
                  </div>
                  <Eye size={18} style={{ color: "#f97316" }} />
                </div>
                <div className="stat-card" style={{ borderLeft: "3px solid #ef4444" }}>
                  <div className="stat-content">
                    <div className="stat-label">Critical</div>
                    <div className="stat-value" style={{ color: "#ef4444" }}>{criticalCount}</div>
                  </div>
                  <AlertOctagon size={18} style={{ color: "#ef4444" }} />
                </div>
                <div className="stat-card" style={{ borderLeft: "3px solid #38bdf8" }}>
                  <div className="stat-content">
                    <div className="stat-label">Last 24h</div>
                    <div className="stat-value" style={{ color: "#38bdf8" }}>{last24h}</div>
                  </div>
                  <Clock size={18} style={{ color: "#38bdf8" }} />
                </div>
              </div>

              {/* ── Trend + Severity Row ─────────────────── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {/* 7-day trend chart */}
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      <Zap size={14} style={{ color: "var(--brand-400)" }} />
                      7-Day Alert Trend
                    </div>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                      {trend.reduce((a, b) => a + b, 0)} total
                    </span>
                  </div>
                  {trend.length > 0 ? (
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
                      {trend.map((count, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <div className="trend-bar" data-count={count}
                            style={{
                              height: `${Math.max((count / trendMax) * 80, 4)}px`,
                              background: count === trendMax
                                ? "linear-gradient(180deg, #ef4444, #b91c1c)"
                                : "linear-gradient(180deg, var(--brand-400), var(--brand-600))",
                              opacity: count === 0 ? 0.3 : 1,
                            }}
                          />
                          <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
                            {trendLabels[i] || i}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
                      No trend data available
                    </div>
                  )}
                </div>

                {/* Severity breakdown */}
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={14} style={{ color: "#eab308" }} />
                    Severity Breakdown
                  </div>
                  {SEVERITY_ORDER.map(sev => {
                    const count = severityBreakdown[sev] || severityBreakdown[sev.toLowerCase()] || 0;
                    const pct = (Number(count) / severityTotal) * 100;
                    const meta = SEVERITY_MAP[sev];
                    return (
                      <div key={sev} className="severity-bar-row">
                        <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, width: 65, flexShrink: 0 }}>
                          {meta.label}
                        </span>
                        <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                          <div className="severity-bar-fill" style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", width: 30, textAlign: "right" }}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Alert Feed ───────────────────────────── */}
              <div className="card" style={{ overflow: "hidden" }}>
                {/* Feed Header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 20px", borderBottom: "1px solid var(--border-default)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Alert Feed</span>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 9999,
                      background: "var(--bg-elevated)", color: "var(--text-tertiary)", fontWeight: 600,
                    }}>
                      {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Severity Filter */}
                    <div className="filter-dropdown">
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: "5px 12px" }}
                        onClick={() => setFilterOpen(o => !o)}>
                        <Filter size={12} />
                        {severityFilter || "All Severities"}
                        <ChevronDown size={11} />
                      </button>
                      {filterOpen && (
                        <div className="filter-menu">
                          <button className={`filter-option ${!severityFilter ? "selected" : ""}`}
                            onClick={() => { setSeverityFilter(""); setFilterOpen(false); }}>
                            All Severities
                          </button>
                          {SEVERITY_ORDER.map(s => (
                            <button key={s} className={`filter-option ${severityFilter === s ? "selected" : ""}`}
                              onClick={() => { setSeverityFilter(s); setFilterOpen(false); }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: SEVERITY_MAP[s].color }} />
                              {SEVERITY_MAP[s].label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Acknowledge All */}
                    {alerts.some(a => !a.acknowledged && !a.resolved) && (
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: "5px 12px" }}
                        onClick={acknowledgeAll}>
                        <CheckCircle2 size={12} /> Acknowledge All
                      </button>
                    )}
                  </div>
                </div>

                {/* Alert Items */}
                {alerts.length === 0 ? (
                  <div className="empty-state">
                    <ShieldCheck size={48} style={{ color: "var(--brand-400)", opacity: 0.5, marginBottom: 16 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No alerts — your fleet is secure 🛡️</h3>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", maxWidth: 400 }}>
                      When threats are detected or rules trigger, alerts will appear here in real-time.
                    </p>
                  </div>
                ) : (
                  <div>
                    {alerts.map((alert, i) => {
                      const id = alert.id || alert._id;
                      const isResolved = alert.resolved || alert.status === "RESOLVED";
                      const isAcked = alert.acknowledged || alert.status === "ACKNOWLEDGED";
                      return (
                        <div key={id || i} className="alert-feed-item"
                          style={{
                            opacity: isResolved ? 0.5 : 1,
                            animationDelay: `${i * 0.04}s`,
                          }}>
                          {/* Severity indicator dot */}
                          <div style={{
                            width: 10, height: 10, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                            background: SEVERITY_MAP[alert.severity]?.color || "#6b7280",
                            boxShadow: alert.severity === "CRITICAL" && !isResolved
                              ? `0 0 8px ${SEVERITY_MAP.CRITICAL.color}80`
                              : "none",
                          }}
                            className={alert.severity === "CRITICAL" && !isResolved ? "ack-pulse" : ""}
                          />

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <SeverityBadge severity={alert.severity} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                                {alert.title || alert.name || "Untitled Alert"}
                              </span>
                              {isAcked && !isResolved && (
                                <span style={{
                                  fontSize: 10, padding: "1px 7px", borderRadius: 9999,
                                  background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 600,
                                }}>
                                  Acknowledged
                                </span>
                              )}
                              {isResolved && (
                                <span style={{
                                  fontSize: 10, padding: "1px 7px", borderRadius: 9999,
                                  background: "rgba(107,114,128,0.1)", color: "#6b7280", fontWeight: 600,
                                }}>
                                  Resolved
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px", lineHeight: 1.5 }}>
                              {alert.message || alert.description || "—"}
                            </p>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--text-tertiary)" }}>
                              {alert.source && (
                                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <Server size={10} /> {alert.source}
                                </span>
                              )}
                              {(alert.createdAt || alert.timestamp) && (
                                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <Clock size={10} /> {relativeTime(alert.createdAt || alert.timestamp)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          {!isResolved && (
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              {!isAcked && (
                                <button className="btn btn-secondary" style={{ fontSize: 11, padding: "5px 10px" }}
                                  disabled={!!actionLoading[id]}
                                  onClick={() => acknowledgeAlert(id)}>
                                  {actionLoading[id]
                                    ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                                    : <><Eye size={12} /> Ack</>
                                  }
                                </button>
                              )}
                              <button className="btn btn-primary" style={{ fontSize: 11, padding: "5px 10px" }}
                                disabled={!!actionLoading[id]}
                                onClick={() => resolveAlert(id)}>
                                {actionLoading[id]
                                  ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                                  : <><CheckCircle2 size={12} /> Resolve</>
                                }
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
         TAB 2: ALERT RULES
         ════════════════════════════════════════════════════ */}
      {tab === "rules" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Alert Rules</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 8 }}>
                {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreateRule(true)}>
              <Plus size={14} /> Create Rule
            </button>
          </div>

          {rulesLoading ? (
            <LoadingState />
          ) : rules.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <Shield size={48} style={{ color: "var(--brand-400)", opacity: 0.5, marginBottom: 16 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Alert Rules Configured</h3>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", maxWidth: 400, marginBottom: 16 }}>
                  Create rules to automatically detect security threats and trigger notifications.
                </p>
                <button className="btn btn-primary" onClick={() => setShowCreateRule(true)}>
                  <Plus size={14} /> Create Your First Rule
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              {rules.map((rule, i) => {
                const id = rule.id || rule._id;
                const isEnabled = rule.enabled ?? rule.isActive ?? true;
                return (
                  <div key={id || i} className="rule-row" style={{ animationDelay: `${i * 0.04}s` }}>
                    {/* Toggle */}
                    <button
                      className={`toggle-btn ${isEnabled ? "on" : "off"}`}
                      onClick={() => toggleRule(id)}
                      title={isEnabled ? "Disable rule" : "Enable rule"}
                    />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isEnabled ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                          {rule.name}
                        </span>
                        <CategoryBadge category={rule.category} />
                        <SeverityBadge severity={rule.severity} />
                      </div>
                      <p style={{
                        fontSize: 12, color: "var(--text-secondary)", margin: 0,
                        opacity: isEnabled ? 1 : 0.5, lineHeight: 1.4,
                      }}>
                        {rule.description || "No description"}
                      </p>
                      {/* Channel tags */}
                      {rule.channels && rule.channels.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          {rule.channels.map((ch: string) => (
                            <span key={ch} style={{
                              fontSize: 9, padding: "2px 6px", borderRadius: 4,
                              background: "var(--bg-elevated)", color: "var(--text-tertiary)",
                              fontWeight: 600, textTransform: "uppercase",
                            }}>
                              {ch.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    {deleteConfirm === id ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 8px", color: "#ef4444" }}
                          onClick={() => deleteRule(id)}>
                          <Check size={12} /> Yes
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 8px" }}
                          onClick={() => setDeleteConfirm(null)}>
                          <X size={12} /> No
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: "5px 8px" }}
                        onClick={() => setDeleteConfirm(id)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Create Rule Modal ────────────────────── */}
          {showCreateRule && (
            <div className="modal-overlay" onClick={() => setShowCreateRule(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <Plus size={16} style={{ color: "var(--brand-400)" }} />
                    Create Alert Rule
                  </h2>
                  <button className="btn btn-secondary" style={{ padding: "4px 8px" }}
                    onClick={() => setShowCreateRule(false)}>
                    <X size={14} />
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="form-field">
                    <label>Rule Name</label>
                    <input placeholder="e.g., USB Device Connected"
                      value={newRule.name} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label>Description</label>
                    <textarea rows={2} placeholder="Describe what this rule detects..."
                      value={newRule.description} onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div className="form-field">
                      <label>Category</label>
                      <select value={newRule.category} onChange={e => setNewRule(p => ({ ...p, category: e.target.value }))}>
                        {CATEGORY_OPTIONS.map(c => (
                          <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Severity</label>
                      <select value={newRule.severity} onChange={e => setNewRule(p => ({ ...p, severity: e.target.value }))}>
                        {SEVERITY_ORDER.map(s => (
                          <option key={s} value={s}>{SEVERITY_MAP[s].label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Notification Channels</label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {CHANNEL_OPTIONS.map(ch => {
                        const selected = newRule.channels.includes(ch.key);
                        return (
                          <label key={ch.key} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            fontSize: 12, cursor: "pointer", padding: "6px 12px",
                            borderRadius: 8, border: `1px solid ${selected ? "var(--brand-400)" : "var(--border-default)"}`,
                            background: selected ? "rgba(99,102,241,0.08)" : "transparent",
                            color: selected ? "var(--brand-400)" : "var(--text-secondary)",
                            transition: "all 0.15s",
                          }}>
                            <input type="checkbox" checked={selected}
                              onChange={() => {
                                setNewRule(p => ({
                                  ...p,
                                  channels: selected
                                    ? p.channels.filter(c => c !== ch.key)
                                    : [...p.channels, ch.key],
                                }));
                              }}
                              style={{ display: "none" }}
                            />
                            {selected ? <Check size={12} /> : <span style={{ width: 12 }} />}
                            {ch.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Cooldown (minutes)</label>
                    <input type="number" min={0} placeholder="15"
                      value={newRule.cooldownMinutes}
                      onChange={e => setNewRule(p => ({ ...p, cooldownMinutes: Number(e.target.value) || 0 }))} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                  <button className="btn btn-secondary" onClick={() => setShowCreateRule(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={createRule}
                    disabled={!newRule.name.trim()}>
                    <Plus size={14} /> Create Rule
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
         TAB 3: NOTIFICATION CHANNELS
         ════════════════════════════════════════════════════ */}
      {tab === "channels" && (
        <>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Notification Channels</span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 8 }}>
              Configure where alerts are delivered
            </span>
          </div>

          {channelsLoading ? (
            <LoadingState />
          ) : channels.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <BellRing size={48} style={{ color: "var(--brand-400)", opacity: 0.5, marginBottom: 16 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Channels Configured</h3>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", maxWidth: 400 }}>
                  Notification channels will appear here once configured by an administrator.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {channels.map((channel, i) => {
                const typeLower = (channel.type || "").toLowerCase();
                const meta = CHANNEL_TYPE_META[typeLower] || CHANNEL_TYPE_META.in_app;
                const Icon = meta.icon;
                const isEnabled = channel.enabled ?? true;
                const config = channel.config || channel.configuration || {};

                return (
                  <div key={channel.id || channel._id || i} className="channel-card"
                    style={{ animationDelay: `${i * 0.06}s`, animation: "fadeIn 0.3s ease both" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: `${meta.color}18`, display: "flex",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={20} style={{ color: meta.color }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{channel.name || channel.type}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "capitalize" }}>
                          {channel.type?.replace(/_/g, " ") || "Unknown"}
                        </div>
                      </div>
                      {isEnabled ? (
                        <span style={{
                          fontSize: 10, padding: "3px 10px", borderRadius: 9999,
                          background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 700,
                        }}>
                          Active
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 10, padding: "3px 10px", borderRadius: 9999,
                          background: "rgba(107,114,128,0.1)", color: "#6b7280", fontWeight: 700,
                        }}>
                          Coming Soon
                        </span>
                      )}
                    </div>

                    {/* Config Summary */}
                    {Object.keys(config).length > 0 && (
                      <div style={{
                        padding: 12, borderRadius: 8, background: "var(--bg-primary)",
                        border: "1px solid var(--border-default)",
                      }}>
                        {Object.entries(config).map(([key, value]) => (
                          <div key={key} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "4px 0", fontSize: 11, borderBottom: "1px solid var(--border-default)",
                          }}>
                            <span style={{ color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>
                              {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
                            </span>
                            <span style={{ color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value || "—")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function LoadingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="loading-skeleton" style={{ width: "60%", marginBottom: 8 }} />
            <div className="loading-skeleton" style={{ width: "40%", height: 24 }} />
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 20 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border-default)" }}>
            <div className="loading-skeleton" style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="loading-skeleton" style={{ width: "70%", marginBottom: 6 }} />
              <div className="loading-skeleton" style={{ width: "90%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
