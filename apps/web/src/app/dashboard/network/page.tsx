"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wifi, AlertTriangle, Activity, CheckCircle2, XCircle, Signal, Loader2, RefreshCw, FileCode, Scan, Zap
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }

const STATUS_COLORS: Record<string, string> = { ONLINE: "green", WARNING: "amber", OFFLINE: "red" };

// Simulated bandwidth data (would come from a real NMS agent in production)
const bandwidth = [
  { time: "00:00", inbound: 120, outbound: 80 }, { time: "04:00", inbound: 60, outbound: 40 },
  { time: "08:00", inbound: 450, outbound: 320 }, { time: "12:00", inbound: 680, outbound: 520 },
  { time: "16:00", inbound: 580, outbound: 430 }, { time: "20:00", inbound: 350, outbound: 250 },
  { time: "Now", inbound: 420, outbound: 310 },
];

export default function NetworkPage() {
  const router = useRouter();
  const [data, setData] = useState<any>({ data: [], total: 0, up: 0, warning: 0, down: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [discovering, setDiscovering] = useState(false);

  function refresh() {
    fetch(`${API}/monitoring/network`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }
  useEffect(() => { refresh(); }, []);

  const devices = data.data || [];

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Network Monitoring (NMS)</h1>
          <p className="page-subtitle">{data.total} devices monitored • {data.up} online</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={14} /></button>
          <button className="btn btn-secondary" onClick={async () => { setDiscovering(true); try { const r = await fetch(`${API}/monitoring/network/auto-discover`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()); setScanResult({ message: `Auto-discovered ${r.created} devices from ${r.total} assets` }); refresh(); } catch {} finally { setDiscovering(false); } }} disabled={discovering}>
            {discovering ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Discovering...</> : <><Zap size={14} /> Auto-Discover</>}
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard/network/configs')}><FileCode size={14} /> Config Backup</button>
          <button className="btn btn-primary" onClick={async () => { setScanning(true); setScanResult(null); try { const r = await fetch(`${API}/monitoring/network/scan`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()); setScanResult(r); refresh(); } catch {} finally { setScanning(false); } }} disabled={scanning}>
            {scanning ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Scanning...</> : <><Scan size={14} /> Scan Network</>}
          </button>
        </div>
      </div>

      {/* Scan Result Banner */}
      {scanResult && (
        <div className="card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
          <span style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>
            <CheckCircle2 size={14} style={{ verticalAlign: 'middle' }} />{' '}
            {scanResult.message || `Scan complete — ${scanResult.online || 0} online, ${scanResult.warning || 0} warning, ${scanResult.offline || 0} offline out of ${scanResult.totalDevices || 0} devices`}
          </span>
          <button onClick={() => setScanResult(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card"><div className="stat-icon cyan"><Wifi size={22} /></div><div className="stat-content"><div className="stat-label">Total Devices</div><div className="stat-value">{data.total}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={22} /></div><div className="stat-content"><div className="stat-label">Online</div><div className="stat-value">{data.up}</div></div></div>
        <div className="stat-card"><div className="stat-icon amber"><AlertTriangle size={22} /></div><div className="stat-content"><div className="stat-label">Warnings</div><div className="stat-value">{data.warning}</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={22} /></div><div className="stat-content"><div className="stat-label">Down</div><div className="stat-value">{data.down}</div></div></div>
      </div>

      {/* Bandwidth Chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div><div className="card-title">Network Bandwidth (24h)</div><div className="card-subtitle">Inbound vs outbound traffic (Mbps)</div></div>
          <span className="badge green"><Activity size={10} /> Healthy</span>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={bandwidth}>
              <defs>
                <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="inbound" stroke="#06b6d4" fill="url(#inGrad)" strokeWidth={2} name="Inbound" />
              <Area type="monotone" dataKey="outbound" stroke="#8b5cf6" fill="url(#outGrad)" strokeWidth={2} name="Outbound" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Device Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="card-header" style={{ padding: "12px 20px" }}><div className="card-title">Network Devices</div></div>
        <table className="data-table">
          <thead>
            <tr><th>Device</th><th>Type</th><th>IP Address</th><th>Status</th><th>Uptime</th><th>Latency</th><th>Throughput</th><th>Ports</th><th>Alerts</th></tr>
          </thead>
          <tbody>
            {devices.map((d: any) => {
              const cfg = d.config || {};
              const met = d.metrics || {};
              return (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</td>
                  <td><span className="badge gray" style={{ fontSize: 10 }}>{cfg.deviceType || "—"}</span></td>
                  <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{d.ipAddress}</code></td>
                  <td><span className={`badge ${STATUS_COLORS[d.status] || "gray"}`}>{d.status}</span></td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{met.uptime || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{met.latency ? `${met.latency}ms` : "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{met.throughput ? `${met.throughput} Mbps` : "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{cfg.ports || "—"}</td>
                  <td>{met.alerts > 0 ? <span className="badge red">{met.alerts}</span> : <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
