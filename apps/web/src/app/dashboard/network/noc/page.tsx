"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Network,
  Radio, RefreshCw, Server, XCircle, Wifi,
} from "lucide-react";
import { apiFetch, getNocDashboard } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import { PageHelp } from "@/components/HelpSystem";

const SEV_LABEL: Record<number, string> = {
  0: "emerg", 1: "alert", 2: "crit", 3: "err", 4: "warn", 5: "notice", 6: "info", 7: "debug",
};

function formatBytes(n: string | number | undefined): string {
  const v = typeof n === "string" ? Number(n) : n || 0;
  if (!v) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = v;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

export default function NocDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    getNocDashboard()
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load NOC dashboard"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading && !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)", gap: 8 }}>
        <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        Loading NOC…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const summary = data?.deviceSummary || { total: 0, online: 0, warning: 0, offline: 0 };
  const alarms = data?.alarms?.alerts || [];
  const traps = data?.recentTraps || [];
  const syslog = data?.recentSyslog || [];
  const talkers = data?.topTalkers || [];
  const interfaces = data?.topInterfaces || [];
  const topology = data?.topology || { nodes: [], links: [] };
  const collectors = data?.collectors || {};

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <button onClick={() => router.push("/dashboard/network")} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 0 }}>
              <ArrowLeft size={16} />
            </button>
            <h1 className="page-title" style={{ margin: 0 }}>NOC Dashboard</h1>
          </div>
          <p className="page-subtitle">Topology, alarms, top interfaces, traps &amp; syslog</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/dashboard/network")}>
            <Wifi size={14} /> Devices
          </button>
        </div>
      </div>

      <PageHelp id="noc" title="Network Operations Center">
        Live operational view across topology, device alarms, interface utilization, SNMP traps, and syslog.
        Enable collectors with <code>ENABLE_SYSLOG=true</code> and <code>ENABLE_NETFLOW=true</code> on the API.
      </PageHelp>

      {error && (
        <div className="card" style={{ marginBottom: 16, padding: 12, border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card"><div className="stat-icon cyan"><Server size={20} /></div><div className="stat-content"><div className="stat-label">Devices</div><div className="stat-value">{summary.total}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={20} /></div><div className="stat-content"><div className="stat-label">Online</div><div className="stat-value">{summary.online}</div></div></div>
        <div className="stat-card"><div className="stat-icon amber"><AlertTriangle size={20} /></div><div className="stat-content"><div className="stat-label">Warnings</div><div className="stat-value">{summary.warning}</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={20} /></div><div className="stat-content"><div className="stat-label">Down</div><div className="stat-value">{summary.offline}</div></div></div>
      </div>

      {/* Collector status */}
      <div className="card" style={{ marginBottom: 16, padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12 }}>
        <span><Radio size={12} style={{ verticalAlign: "middle" }} /> Syslog: {collectors.syslog?.isRunning ? `listening :${collectors.syslog.port}` : "disabled"}</span>
        <span><Activity size={12} style={{ verticalAlign: "middle" }} /> NetFlow: {collectors.netflow?.isRunning ? `listening :${collectors.netflow.port}` : "disabled"}</span>
        <span><Network size={12} style={{ verticalAlign: "middle" }} /> Traps: {collectors.traps?.isRunning ? `listening :${collectors.traps.port}` : "disabled"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Topology */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "12px 16px" }}>
            <div className="card-title">Topology</div>
            <span className="badge" style={{ fontSize: 10 }}>{(topology.nodes || []).length} nodes · {(topology.links || []).length} links</span>
          </div>
          {(topology.nodes || []).length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState
                compact
                title="No topology data"
                description="Add network devices and run SNMP polling / LLDP discovery to build the map."
                action={{ label: "Open Network", href: "/dashboard/network", variant: "secondary" }}
              />
            </div>
          ) : (
            <div style={{ padding: 16, maxHeight: 320, overflow: "auto" }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead><tr><th>Node</th><th>Type</th><th>Status</th><th>IP</th></tr></thead>
                <tbody>
                  {(topology.nodes || []).slice(0, 40).map((n: any) => (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 500 }}>{n.label || n.name || n.id}</td>
                      <td>{n.type || "—"}</td>
                      <td><span className={`badge ${n.status === "ONLINE" ? "green" : n.status === "WARNING" ? "amber" : "red"}`} style={{ fontSize: 9 }}>{n.status || "—"}</span></td>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{n.ip || n.ipAddress || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alarms */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "12px 16px" }}>
            <div className="card-title">Active Alarms</div>
            <span className="badge amber" style={{ fontSize: 10 }}>{alarms.length}</span>
          </div>
          {alarms.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState compact title="No active alarms" description="All monitored network devices are healthy." />
            </div>
          ) : (
            <div style={{ padding: 12, maxHeight: 320, overflow: "auto" }}>
              {alarms.map((a: any) => (
                <div key={a.id} style={{ padding: "10px 8px", borderBottom: "1px solid var(--border-primary)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AlertTriangle size={14} color={a.severity === "critical" ? "#ef4444" : "#f59e0b"} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.deviceName}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Top interfaces */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "12px 16px" }}>
            <div className="card-title">Top Interfaces</div>
          </div>
          {interfaces.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState compact title="No interface metrics" description="Run SNMP poll to collect interface counters." />
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Device</th><th>Interface</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
              <tbody>
                {interfaces.map((iface: any, i: number) => (
                  <tr key={`${iface.deviceId}-${iface.name}-${i}`}>
                    <td>{iface.deviceName}</td>
                    <td>{iface.name}</td>
                    <td style={{ color: "#06b6d4" }}>{formatBytes(iface.inOctets)}</td>
                    <td style={{ color: "#8b5cf6" }}>{formatBytes(iface.outOctets)}</td>
                    <td><span className={`badge ${iface.status === "up" ? "green" : "red"}`} style={{ fontSize: 9 }}>{iface.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top talkers */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "12px 16px" }}>
            <div className="card-title">Top Talkers (24h)</div>
          </div>
          {talkers.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState
                compact
                title="No flow data"
                description="Enable ENABLE_NETFLOW=true and point exporters at the collector."
              />
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead><tr><th>IP</th><th>In</th><th>Out</th><th>Total</th><th>Flows</th></tr></thead>
              <tbody>
                {talkers.map((t: any) => (
                  <tr key={t.talkerIp}>
                    <td style={{ fontFamily: "monospace" }}>{t.talkerIp}</td>
                    <td>{formatBytes(t.bytesIn)}</td>
                    <td>{formatBytes(t.bytesOut)}</td>
                    <td style={{ fontWeight: 600 }}>{formatBytes(t.totalBytes)}</td>
                    <td>{t.flows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Traps */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "12px 16px" }}>
            <div className="card-title">Recent SNMP Traps</div>
            <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => apiFetch("/monitoring/network/traps/live").then(() => refresh())}>
              Live
            </button>
          </div>
          {traps.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState compact title="No traps" description="Enable ENABLE_SNMP_TRAPS=true to receive traps." />
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflow: "auto", padding: 8 }}>
              {traps.slice().reverse().slice(0, 30).map((t: any, i: number) => (
                <div key={`${t.sourceIp}-${t.receivedAt}-${i}`} style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-primary)", fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong>{t.type}</strong>
                    <span className={`badge ${t.severity === "critical" ? "red" : t.severity === "warning" ? "amber" : "blue"}`} style={{ fontSize: 9 }}>{t.severity}</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>{t.sourceIp} — {t.description}</div>
                  <div style={{ color: "var(--text-tertiary)", fontSize: 10, marginTop: 2 }}>{t.receivedAt ? new Date(t.receivedAt).toLocaleString() : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Syslog */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "12px 16px" }}>
            <div className="card-title">Recent Syslog</div>
          </div>
          {syslog.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState compact title="No syslog events" description="Enable ENABLE_SYSLOG=true and forward logs to the UDP port." />
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflow: "auto", padding: 8 }}>
              {syslog.map((e: any) => (
                <div key={e.id} style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-primary)", fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: "monospace" }}>{e.sourceIp}</span>
                    <span className={`badge ${(e.severity ?? 7) <= 3 ? "red" : (e.severity ?? 7) <= 4 ? "amber" : "blue"}`} style={{ fontSize: 9 }}>
                      {SEV_LABEL[e.severity ?? 7] || e.severity}
                    </span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", marginTop: 2, wordBreak: "break-word" }}>{e.message}</div>
                  <div style={{ color: "var(--text-tertiary)", fontSize: 10, marginTop: 2 }}>
                    {e.receivedAt ? new Date(e.receivedAt).toLocaleString() : ""}
                    {e.ticketId ? " · ticket created" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
