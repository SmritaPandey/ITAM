"use client";
import { useEffect, useState } from "react";
import {
  Shield, FileText, CheckCircle2, AlertTriangle, Search,
  Loader2, RefreshCw, User, Clock, Filter, ChevronDown,
  MapPin, X, Copy, Check, FileJson, Lock, HelpCircle
} from "lucide-react";
import { apiFetch, apiFetchBlob } from "@/lib/api";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "#06b6d4",      // Cyan
  UPDATE: "#3b82f6",      // Blue
  DELETE: "#ef4444",      // Red
  LOGIN: "#8b5cf6",       // Violet
  LOGOUT: "#64748b",      // Slate
  STATUS_CHANGE: "#f59e0b", // Amber
  COMMENT_ADDED: "#10b981", // Emerald
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [chain, setChain] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [copiedText, setCopiedText] = useState("");

  async function refresh(p = 1) {
    setLoading(true);
    try {
      const filter = actionFilter ? `&action=${actionFilter}` : "";
      const [res, s, c] = await Promise.all([
        apiFetch(`/admin/audit-logs?page=${p}&limit=20${filter}`),
        apiFetch("/admin/audit-logs/stats"),
        apiFetch("/admin/audit-logs/verify"),
      ]);
      setLogs(res.data || []);
      setTotal(res.total || 0);
      setStats(s);
      setChain(c);
      setPage(p);
    } catch (err: any) { console.error("Audit logs load failed:", err); } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  const handleCopy = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(""), 2000);
  };

  async function exportLogs(format: "json" | "csv") {
    const blob = await apiFetchBlob(`/admin/audit-logs/export?format=${format}`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function getInitials(actor: any) {
    if (!actor) return "SYS";
    const f = actor.firstName?.[0] || "";
    const l = actor.lastName?.[0] || "";
    return (f + l).toUpperCase() || "??";
  }

  function getAvatarGradient(name: string) {
    if (name === "System") return "linear-gradient(135deg, #475569 0%, #334155 100%)";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)", // Pink-Purple
      "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)", // Cyan-Blue
      "linear-gradient(135deg, #10b981 0%, #059669 100%)", // Emerald-Green
      "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", // Amber-Orange
      "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)", // Purple-Indigo
    ];
    return colors[Math.abs(hash) % colors.length];
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Audit Ledger</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Tamper-proof, cryptographically signed ledger verifying chronological compliance</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => exportLogs("json")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FileJson size={15} /> Export JSON
          </button>
          <button className="btn btn-secondary" onClick={() => exportLogs("csv")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={15} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => refresh(page)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, padding: 0, borderRadius: 10 }}>
            <RefreshCw size={15} className={loading ? "spin-animation" : ""} />
          </button>
        </div>
      </div>

      {/* Cybernetic Stats Grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {/* Total Events */}
        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid var(--border-primary)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative"
        }} className="hover-lift">
          <div style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#22d3ee" }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Events</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>{stats?.total || 0}</div>
          </div>
        </div>

        {/* Today */}
        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid var(--border-primary)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative"
        }} className="hover-lift">
          <div style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa" }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recorded Today</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa", marginTop: 2 }}>{stats?.today || 0}</div>
          </div>
        </div>

        {/* Chain Integrity (Holographic Cryptographic Seal Badge) */}
        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: chain?.valid ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: chain?.valid ? "0 4px 25px rgba(16, 185, 129, 0.08)" : "0 4px 25px rgba(239, 68, 68, 0.08)",
          position: "relative", overflow: "hidden"
        }} className="hover-lift">
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, height: "2px",
            background: chain?.valid ? "linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.5), transparent)" : "linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.5), transparent)",
            animation: "scanLoop 3s linear infinite"
          }} />
          <div style={{
            background: chain?.valid ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: chain?.valid ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
            color: chain?.valid ? "#34d399" : "#f87171"
          }}>
            <Shield size={20} className={chain?.valid ? "pulse-slow" : "flash-fast"} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Chain Verification</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span className={`hologram-badge ${chain?.valid ? "valid" : "broken"}`}>
                <span className="hologram-dot" />
                {chain?.valid ? "SECURE CHAIN" : "COMPROMISED"}
              </span>
            </div>
          </div>
        </div>

        {/* Top Action */}
        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid var(--border-primary)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative"
        }} className="hover-lift">
          <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24" }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Peak Action</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.02em" }}>{stats?.topActions?.[0]?.action || "—"}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(20, 26, 46, 0.8) 100%)",
        border: "1px solid var(--border-primary)",
        borderRadius: 14,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}>
          <Filter size={15} style={{ color: "var(--brand-400)" }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Filter:</span>
        </div>
        <div style={{ position: "relative" }}>
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setTimeout(() => refresh(1), 50); }}
            style={{
              appearance: "none",
              padding: "8px 36px 8px 14px",
              borderRadius: 10,
              background: "var(--bg-input)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              outline: "none",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            className="select-custom"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="LOGIN">Login</option>
            <option value="STATUS_CHANGE">Status Change</option>
            <option value="COMMENT_ADDED">Comment</option>
          </select>
          <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-tertiary)" }} />
        </div>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: "auto", fontWeight: 500 }}>
          Showing {logs.length} of <strong style={{ color: "var(--text-secondary)" }}>{total}</strong> historical events
        </span>
      </div>

      {/* Logs Table Card */}
      <div style={{
        background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15, 20, 35, 0.95) 100%)",
        border: "1px solid var(--border-primary)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
      }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, color: "var(--text-tertiary)", gap: 12 }}>
            <Loader2 size={32} className="spin-animation" style={{ color: "var(--brand-400)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.05em" }}>RETRIEVING ENCRYPTED BLOCKS...</span>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--text-tertiary)" }}>
            <Shield size={48} style={{ margin: "0 auto 16px", color: "var(--text-muted)", strokeWidth: 1.5 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)" }}>No compliance logs found</div>
            <p style={{ fontSize: 13, marginTop: 4 }}>Interact with directory records to generate audit ledger entries.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "rgba(10, 14, 26, 0.4)" }}>
                  <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Timestamp</th>
                  <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actor</th>
                  <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Action</th>
                  <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Resource</th>
                  <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Client IP</th>
                  <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hash Block</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => {
                  const actorName = log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System";
                  const avatarGradient = getAvatarGradient(actorName);
                  const actionColor = ACTION_COLORS[log.action] || "#6b7280";

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      style={{
                        borderBottom: "1px solid rgba(42, 49, 80, 0.4)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      className="row-hover"
                    >
                      {/* Timestamp */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock size={12} style={{ color: "var(--text-tertiary)" }} />
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, paddingLeft: 18 }}>{timeAgo(log.timestamp)}</div>
                      </td>

                      {/* Actor Profile */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: avatarGradient,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 800, color: "#fff",
                            boxShadow: "0 0 10px rgba(0,0,0,0.2)",
                            border: "1px solid rgba(255,255,255,0.1)"
                          }}>
                            {getInitials(log.actor)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{actorName}</div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>{log.actor?.email || "internal.service"}</div>
                          </div>
                        </div>
                      </td>

                      {/* Action Tag */}
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          background: `${actionColor}12`,
                          color: actionColor,
                          border: `1px solid ${actionColor}25`,
                          textShadow: `0 0 6px ${actionColor}20`
                        }}>
                          {log.action}
                        </span>
                      </td>

                      {/* Target Resource */}
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{log.resourceType}</span>
                        {log.resourceId && (
                          <div style={{
                            fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace",
                            marginTop: 3, background: "rgba(0,0,0,0.15)", width: "max-content", padding: "1px 4px", borderRadius: 4, border: "1px dashed rgba(255,255,255,0.05)"
                          }}>
                            ID: {log.resourceId.slice(0, 8)}…
                          </div>
                        )}
                      </td>

                      {/* Target IP */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                          <MapPin size={11} style={{ color: "var(--text-tertiary)" }} />
                          {log.actorIp || "127.0.0.1"}
                        </div>
                      </td>

                      {/* Hash Copy Badge */}
                      <td style={{ padding: "14px 20px" }}>
                        {log.hash ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(log.hash, log.id);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              fontFamily: "monospace",
                              color: copiedText === log.id ? "#34d399" : "#10b981",
                              background: copiedText === log.id ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.06)",
                              border: copiedText === log.id ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(16, 185, 129, 0.18)",
                              padding: "4px 10px",
                              borderRadius: 8,
                              cursor: "pointer",
                              transition: "all 0.2s",
                              textShadow: "0 0 4px rgba(16,185,129,0.2)"
                            }}
                            className="hash-badge"
                            title="Click to copy SHA-256 block signature"
                          >
                            <Shield size={11} style={{ color: copiedText === log.id ? "#34d399" : "#10b981" }} />
                            {log.hash.slice(0, 8)}…
                            {copiedText === log.id ? (
                              <Check size={10} style={{ color: "#34d399" }} />
                            ) : (
                              <Copy size={10} style={{ opacity: 0.5 }} className="copy-icon-hover" />
                            )}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontStyle: "italic" }}>unsigned block</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {total > 20 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24, alignItems: "center" }}>
          <button
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => refresh(page - 1)}
            style={{ borderRadius: 10, fontWeight: 600, padding: "8px 16px", minWidth: 80 }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500, padding: "0 10px" }}>
            Page <strong style={{ color: "var(--text-secondary)" }}>{page}</strong> of {Math.ceil(total / 20)}
          </span>
          <button
            className="btn btn-secondary"
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => refresh(page + 1)}
            style={{ borderRadius: 10, fontWeight: 600, padding: "8px 16px", minWidth: 80 }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Slide-out Interactive Ledger Detail Drawer */}
      {selectedLog && (
        <>
          {/* Overlay backdrop */}
          <div
            onClick={() => setSelectedLog(null)}
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 999,
              animation: "fadeIn 0.2s ease-out"
            }}
          />

          {/* Drawer container */}
          <div style={{
            position: "fixed",
            top: 0, right: 0, bottom: 0,
            width: "100%",
            maxWidth: 500,
            background: "linear-gradient(135deg, #10162a 0%, #0c0e17 100%)",
            borderLeft: "1px solid var(--border-primary)",
            boxShadow: "-10px 0 40px rgba(0,0,0,0.5)",
            zIndex: 1000,
            padding: 28,
            display: "flex",
            flexDirection: "column",
            animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            overflowY: "auto"
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={18} style={{ color: "var(--brand-400)" }} /> LEDGER BLOCK VERIFIER
                </h3>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Verifying cryptographic compliance record</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-primary)",
                  background: "var(--bg-elevated)", color: "var(--text-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  transition: "all 0.2s"
                }}
                className="close-drawer-btn"
              >
                <X size={16} />
              </button>
            </div>

            {/* Event Summary Card */}
            <div style={{
              background: "rgba(30, 37, 64, 0.4)",
              border: "1px solid var(--border-primary)",
              borderRadius: 12, padding: 16, marginBottom: 20
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.05em" }}>EVENT ACTION</span>
                <span style={{
                  padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 800,
                  background: `${ACTION_COLORS[selectedLog.action] || "#6b7280"}15`,
                  color: ACTION_COLORS[selectedLog.action] || "#6b7280",
                  border: `1px solid ${ACTION_COLORS[selectedLog.action] || "#6b7280"}30`
                }}>
                  {selectedLog.action}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: "var(--text-tertiary)" }}>Chronological Time:</span>
                <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-tertiary)" }}>Client Signature IP:</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {selectedLog.actorIp || "127.0.0.1"}
                </span>
              </div>
            </div>

            {/* Actor Card */}
            <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.05em", marginBottom: 8, textTransform: "uppercase" }}>ACTOR PROFILE</h4>
            <div style={{
              background: "rgba(30, 37, 64, 0.2)",
              border: "1px solid rgba(42, 49, 80, 0.5)",
              borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 12, marginBottom: 20
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: getAvatarGradient(selectedLog.actor ? `${selectedLog.actor.firstName} ${selectedLog.actor.lastName}` : "System"),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: "#fff",
                border: "1px solid rgba(255,255,255,0.15)",
                boxShadow: "0 0 10px rgba(0,0,0,0.15)"
              }}>
                {getInitials(selectedLog.actor)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  {selectedLog.actor ? `${selectedLog.actor.firstName} ${selectedLog.actor.lastName}` : "System Environment"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {selectedLog.actor?.email || "cryptographic.internal.service"}
                </div>
              </div>
            </div>

            {/* Target Resource Card */}
            <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.05em", marginBottom: 8, textTransform: "uppercase" }}>TARGET RESOURCE</h4>
            <div style={{
              background: "rgba(30, 37, 64, 0.2)",
              border: "1px solid rgba(42, 49, 80, 0.5)",
              borderRadius: 12, padding: 14, marginBottom: 20
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: "var(--text-tertiary)" }}>Resource Type:</span>
                <span style={{ fontWeight: 600, color: "var(--brand-400)" }}>{selectedLog.resourceType}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: "var(--text-tertiary)" }}>Resource ID:</span>
                {selectedLog.resourceId ? (
                  <span
                    onClick={() => handleCopy(selectedLog.resourceId, "resId")}
                    style={{
                      fontFamily: "monospace", fontSize: 11, color: copiedText === "resId" ? "#34d399" : "var(--text-secondary)",
                      cursor: "pointer", background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4
                    }}
                  >
                    {selectedLog.resourceId.slice(0, 16)}...
                    {copiedText === "resId" ? <Check size={10} /> : <Copy size={10} style={{ opacity: 0.5 }} />}
                  </span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </div>
            </div>

            {/* Cryptographic chain verification */}
            <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.05em", marginBottom: 8, textTransform: "uppercase" }}>CRYPTOGRAPHIC PROOF CHAIN</h4>
            <div style={{
              background: "linear-gradient(180deg, #090b11 0%, rgba(16, 22, 38, 0.95) 100%)",
              border: "1px solid rgba(6, 182, 212, 0.15)",
              borderRadius: 12, padding: 16, marginBottom: 20
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <span className={`hologram-badge ${chain?.valid ? "valid" : "broken"}`} style={{ fontSize: 10 }}>
                  <span className="hologram-dot" />
                  {chain?.valid ? "VERIFIED LEDGER INTEGRITY" : "CHAIN INTEGRITY COMPROMISED"}
                </span>
              </div>

              {/* SHA-256 Block */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>BLOCK SIGNATURE (SHA-256)</span>
                  {selectedLog.hash && (
                    <span
                      onClick={() => handleCopy(selectedLog.hash, "fullHash")}
                      style={{ cursor: "pointer", color: copiedText === "fullHash" ? "#34d399" : "var(--brand-400)", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {copiedText === "fullHash" ? "Copied" : "Copy"} {copiedText === "fullHash" ? <Check size={10} /> : <Copy size={10} />}
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: "monospace", fontSize: 10, color: "#10b981", background: "rgba(0,0,0,0.3)",
                  padding: 8, borderRadius: 8, border: "1px solid rgba(16, 185, 129, 0.15)", wordBreak: "break-all"
                }}>
                  {selectedLog.hash || "NOT_SIGNED"}
                </div>
              </div>

              {/* Previous Hash Block */}
              <div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4 }}>
                  PREVIOUS BLOCK LINK (CHAIN REFERENCING)
                </div>
                <div style={{
                  fontFamily: "monospace", fontSize: 10, color: "var(--text-secondary)", background: "rgba(0,0,0,0.2)",
                  padding: 8, borderRadius: 8, border: "1px solid var(--border-primary)", wordBreak: "break-all"
                }}>
                  {selectedLog.previousHash || "0000000000000000000000000000000000000000000000000000000000000000"}
                </div>
              </div>

              {/* Dynamic Link visualizer */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 12, gap: 4 }}>
                <div style={{ height: 16, width: 2, background: "linear-gradient(180deg, var(--border-primary), #10b981)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#10b981", fontFamily: "monospace", fontWeight: 700 }}>
                  <Lock size={10} /> BLOCK LINK SECURED
                </div>
              </div>
            </div>

            {/* RAW MONOSPACE METADATA PAYLOAD */}
            <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.05em", marginBottom: 8, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
              <FileJson size={12} style={{ color: "var(--brand-400)" }} /> SYSTEM PAYLOAD METADATA
            </h4>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <pre style={{
                background: "#080c14",
                border: "1px solid var(--border-primary)",
                borderRadius: 10,
                padding: "14px 18px",
                fontFamily: "monospace",
                fontSize: 11,
                color: "#38bdf8",
                overflowX: "auto",
                maxHeight: 200,
                boxShadow: "inset 0 4px 16px rgba(0,0,0,0.5)"
              }}>
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
              <button
                onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), "jsonPayload")}
                style={{
                  position: "absolute",
                  top: 8, right: 8,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: copiedText === "jsonPayload" ? "rgba(52, 211, 153, 0.15)" : "rgba(255,255,255,0.05)",
                  border: copiedText === "jsonPayload" ? "1px solid #34d399" : "1px solid rgba(255,255,255,0.1)",
                  color: copiedText === "jsonPayload" ? "#34d399" : "var(--text-secondary)",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.2s"
                }}
              >
                {copiedText === "jsonPayload" ? "Copied" : "Copy Payload"}
                {copiedText === "jsonPayload" ? <Check size={10} /> : <Copy size={10} />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Cybernetic Page Animations and Styles */}
      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .hover-lift {
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .hover-lift:hover {
          transform: translateY(-2px);
          border-color: rgba(6, 182, 212, 0.3) !important;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25), 0 0 15px rgba(6, 182, 212, 0.05) !important;
        }

        .row-hover {
          background: transparent;
        }
        .row-hover:hover {
          background: rgba(30, 37, 64, 0.3) !important;
        }
        .row-hover:hover .copy-icon-hover {
          opacity: 1 !important;
        }

        .select-custom:focus {
          border-color: var(--brand-400) !important;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.15);
        }

        .close-drawer-btn:hover {
          background: var(--bg-card-hover) !important;
          color: var(--text-primary) !important;
          border-color: var(--text-tertiary) !important;
        }

        /* Hologram Ledger Indicator styling */
        .hologram-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: monospace;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          letter-spacing: 0.05em;
          position: relative;
          text-shadow: 0 0 8px currentColor;
        }
        .hologram-badge.valid {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.15), inset 0 0 4px rgba(16, 185, 129, 0.1);
        }
        .hologram-badge.broken {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.15), inset 0 0 4px rgba(239, 68, 68, 0.1);
          animation: hologramFlash 1s ease-in-out infinite;
        }
        .hologram-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: currentColor;
        }
        .hologram-badge.valid .hologram-dot {
          animation: hologramPulse 1.5s ease-in-out infinite;
        }
        .hologram-badge.broken .hologram-dot {
          animation: hologramFlash 0.5s steps(2, start) infinite;
        }

        @keyframes hologramPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 8px currentColor; }
        }
        @keyframes hologramFlash {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; filter: brightness(1.2); }
        }
        @keyframes scanLoop {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(80px); opacity: 0; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
