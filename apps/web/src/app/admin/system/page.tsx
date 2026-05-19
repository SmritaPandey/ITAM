"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Activity, Database, Server, Cpu, HardDrive, Clock, RefreshCw, Shield } from "lucide-react";

export default function SystemPage() {
  const [health, setHealth] = useState<any>(null);
  const [logs, setLogs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);

  function loadHealth() {
    setLoading(true);
    apiFetch("/admin/system").then(d => setHealth(d)).finally(() => setLoading(false));
  }

  function loadLogs() {
    setLogsLoading(true);
    apiFetch("/admin/audit-logs?limit=30").then(d => setLogs(d)).finally(() => setLogsLoading(false));
  }

  useEffect(() => { loadHealth(); loadLogs(); }, []);

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>System Health</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>API, database, and runtime metrics</p>
        </div>
        <button onClick={() => { loadHealth(); loadLogs(); }} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
          border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
        }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</div>
      ) : health ? (
        <>
          {/* Status Banner */}
          <div style={{
            padding: 20, borderRadius: 12, marginBottom: 20,
            background: health.status === "healthy" ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
            border: `1px solid ${health.status === "healthy" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: "50%",
              background: health.status === "healthy" ? "#10b981" : "#ef4444",
              boxShadow: `0 0 8px ${health.status === "healthy" ? "#10b981" : "#ef4444"}`,
            }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: health.status === "healthy" ? "#10b981" : "#ef4444" }}>
                {health.status === "healthy" ? "All Systems Operational" : "Issues Detected"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Environment: {health.environment} • Node: {health.nodeVersion}</div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Uptime", value: formatUptime(health.uptime), icon: Clock, color: "#06b6d4" },
              { label: "Database", value: health.database?.connected ? "Connected" : "Down", icon: Database, color: health.database?.connected ? "#10b981" : "#ef4444" },
              { label: "DB Size", value: health.database?.size || "—", icon: HardDrive, color: "#8b5cf6" },
              { label: "Heap Used", value: health.memoryUsage?.heapUsed || "—", icon: Cpu, color: "#f59e0b" },
              { label: "RSS Memory", value: health.memoryUsage?.rss || "—", icon: Server, color: "#3b82f6" },
              { label: "Environment", value: health.environment || "—", icon: Shield, color: "#64748b" },
            ].map(m => (
              <div key={m.label} style={{ padding: 18, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${m.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: m.color }}>
                    <m.icon size={14} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>{m.label}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{m.value}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* Audit Logs */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Recent Audit Logs</h3>
        </div>
        {logsLoading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</div>
        ) : !logs?.data?.length ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)" }}>No audit logs</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                {["Time", "Actor", "Action", "Resource", "Tenant", "Outcome"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.data.map((l: any) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <td style={{ padding: "8px 12px", color: "var(--text-tertiary)", fontSize: 11 }}>{new Date(l.timestamp).toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-primary)" }}>{l.actor ? `${l.actor.firstName} ${l.actor.lastName}` : "System"}</td>
                  <td style={{ padding: "8px 12px", color: "#06b6d4", fontWeight: 600 }}>{l.action}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{l.resourceType}{l.resourceName ? ` — ${l.resourceName}` : ""}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-tertiary)" }}>{l.tenant?.name || "—"}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                      background: l.outcome === "SUCCESS" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                      color: l.outcome === "SUCCESS" ? "#10b981" : "#ef4444",
                    }}>{l.outcome}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
