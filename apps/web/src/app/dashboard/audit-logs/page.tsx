"use client";
import { useEffect, useState } from "react";
import {
  Shield, FileText, CheckCircle2, AlertTriangle, Search,
  Loader2, RefreshCw, User, Clock, Filter, ChevronDown
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "#10b981", UPDATE: "#3b82f6", DELETE: "#ef4444",
  LOGIN: "#8b5cf6", LOGOUT: "#6b7280", STATUS_CHANGE: "#f59e0b",
  COMMENT_ADDED: "#06b6d4",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [chain, setChain] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

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
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Tamper-proof activity log with SHA-256 hash chain verification</p>
        </div>
        <button className="btn btn-primary" onClick={() => refresh(1)}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon cyan"><FileText size={22} /></div>
          <div className="stat-content"><div className="stat-label">Total Events</div><div className="stat-value">{stats?.total || 0}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Clock size={22} /></div>
          <div className="stat-content"><div className="stat-label">Today</div><div className="stat-value">{stats?.today || 0}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Shield size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Chain Integrity</div>
            <div className="stat-value" style={{ color: chain?.valid ? "#10b981" : "#ef4444" }}>
              {chain?.valid ? "✓ Valid" : "✗ Broken"}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><AlertTriangle size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Top Action</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{stats?.topActions?.[0]?.action || "—"}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 16, padding: "10px 16px", display: "flex", gap: 8, alignItems: "center" }}>
        <Filter size={14} style={{ color: "var(--text-tertiary)" }} />
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setTimeout(() => refresh(1), 100); }}
          style={{
            padding: "6px 10px", borderRadius: 6, background: "var(--bg-input)",
            border: "1px solid var(--border-primary)", color: "var(--text-primary)",
            fontSize: 11, fontFamily: "inherit", outline: "none",
          }}>
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="LOGIN">Login</option>
          <option value="STATUS_CHANGE">Status Change</option>
          <option value="COMMENT_ADDED">Comment</option>
        </select>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>
          Showing {logs.length} of {total} events
        </span>
      </div>

      {/* Logs Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
            <FileText size={36} style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No audit events recorded</div>
            <p style={{ fontSize: 12 }}>Events will appear here as users interact with the system</p>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>IP</th><th>Hash</th></tr></thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{timeAgo(log.timestamp)}</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", background: "var(--bg-elevated)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <User size={12} style={{ color: "var(--text-tertiary)" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                          {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System"}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{log.actor?.email || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                      background: `${ACTION_COLORS[log.action] || "#6b7280"}18`,
                      color: ACTION_COLORS[log.action] || "#6b7280",
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{log.resourceType}</span>
                    {log.resourceId && (
                      <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                        {log.resourceId.slice(0, 8)}…
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-tertiary)" }}>{log.actorIp || "—"}</td>
                  <td>
                    {log.hash && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 9, fontFamily: "monospace", color: "#10b981",
                        background: "rgba(16,185,129,0.08)", padding: "2px 6px", borderRadius: 4,
                      }}>
                        <Shield size={8} /> {log.hash.slice(0, 12)}…
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => refresh(page - 1)}>← Prev</button>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)", alignSelf: "center" }}>
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button className="btn btn-secondary" disabled={page >= Math.ceil(total / 20)} onClick={() => refresh(page + 1)}>Next →</button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
