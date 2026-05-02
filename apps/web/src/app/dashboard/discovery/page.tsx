"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Radar, Play, Clock, CheckCircle2, XCircle, Wifi, Monitor,
  Server, Printer, HelpCircle, Loader2, RefreshCw, Plus, Search,
  ArrowRight, Eye, EyeOff, Network, Shield, Key, Calendar, Bot, Trash2
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PageHelp, Tip } from "@/components/HelpSystem";

const SCAN_TYPES = [
  { value: "PING_SWEEP", label: "Ping Sweep", desc: "ICMP host alive check" },
  { value: "TCP_PORT_SCAN", label: "TCP Port Scan", desc: "Service fingerprinting" },
  { value: "SNMP_DISCOVERY", label: "SNMP Discovery", desc: "Network device detection" },
  { value: "FULL_SCAN", label: "Full Scan", desc: "Ping + Ports + SNMP + ARP" },
];

const DEVICE_ICONS: Record<string, any> = {
  "Virtual Machine": <Server size={16} />,
  "Workstation": <Monitor size={16} />,
  "Printer": <Printer size={16} />,
  "Network Device": <Network size={16} />,
  "Unknown": <HelpCircle size={16} />,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  RUNNING: { bg: "rgba(6,182,212,0.1)", text: "#06b6d4" },
  COMPLETED: { bg: "rgba(16,185,129,0.1)", text: "#10b981" },
  FAILED: { bg: "rgba(239,68,68,0.1)", text: "#ef4444" },
};

export default function DiscoveryPage() {
  const [subnets, setSubnets] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedScan, setSelectedScan] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [customSubnet, setCustomSubnet] = useState("");
  const [scanType, setScanType] = useState("PING_SWEEP");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"scans" | "pending" | "schedules" | "credentials" | "agents">("scans");

  const refresh = useCallback(async () => {
    try {
      const [s, sc, p, sch, cr, ag] = await Promise.all([
        apiFetch("/discovery/subnets"),
        apiFetch("/discovery/scans?limit=20"),
        apiFetch("/discovery/pending"),
        apiFetch("/discovery/schedules"),
        apiFetch("/discovery/credentials"),
        apiFetch("/discovery/agents"),
      ]);
      setSubnets(s || []);
      setScans(sc.data || []);
      setPending(p || []);
      setSchedules(Array.isArray(sch) ? sch : []);
      setCredentials(Array.isArray(cr) ? cr : []);
      setAgents(Array.isArray(ag) ? ag : []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll for running scans
  useEffect(() => {
    const hasRunning = scans.some(s => s.status === "RUNNING" || s.status === "PENDING");
    if (!hasRunning) return;
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, [scans, refresh]);

  async function startScan(subnet: string) {
    setScanning(true);
    try {
      await apiFetch("/discovery/scans", {
        method: "POST",
        body: JSON.stringify({ subnet, scanType, name: `${SCAN_TYPES.find(t => t.value === scanType)?.label} — ${subnet}` }),
      });
      await refresh();
    } catch {} finally { setScanning(false); }
  }

  async function deleteSchedule(id: string) {
    await apiFetch(`/discovery/schedules/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function toggleSchedule(id: string, isActive: boolean) {
    await apiFetch(`/discovery/schedules/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) });
    await refresh();
  }

  async function deleteCredential(id: string) {
    await apiFetch(`/discovery/credentials/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function viewScanDetails(scanId: string) {
    const data = await apiFetch(`/discovery/scans/${scanId}`);
    setSelectedScan(data);
  }

  async function approveDevice(deviceId: string) {
    await apiFetch(`/discovery/devices/${deviceId}/approve`, {
      method: "POST",
      body: JSON.stringify({ name: `Discovered Device`, assetTypeId: "" }),
    });
    await refresh();
  }

  async function ignoreDevice(deviceId: string) {
    await apiFetch(`/discovery/devices/${deviceId}/ignore`, { method: "POST" });
    await refresh();
  }

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
          <h1 className="page-title">Network Discovery</h1>
          <p className="page-subtitle">Scan your network to discover and inventory devices automatically</p>
        </div>
        <button className="btn btn-primary" onClick={refresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <PageHelp id="discovery" title="How Network Discovery Works">
        Enter a subnet (e.g., <strong>192.168.1.0/24</strong>) and select a scan type. <strong>Ping Sweep</strong> is the fastest — it finds alive hosts. <strong>Full Scan</strong> combines all methods for maximum coverage. After scanning, review discovered devices in the <strong>Pending Review</strong> tab and approve them to add as managed assets. You can also deploy the <strong>ReconAPM Agent</strong> on staff machines for automatic inventory collection.
      </PageHelp>

      {/* Scan Type Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Scan Configuration <Tip text="Choose a scan type, then click Scan on a detected subnet or enter a custom one. Ping Sweep is fastest (~30s). Full Scan is most thorough (~5 min)." /></h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
          {SCAN_TYPES.map(t => (
            <button key={t.value} onClick={() => setScanType(t.value)}
              style={{
                padding: "12px 14px", borderRadius: 10, border: scanType === t.value ? "2px solid var(--brand-400)" : "1px solid var(--border-primary)",
                background: scanType === t.value ? "rgba(6,182,212,0.08)" : "var(--bg-elevated)",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: scanType === t.value ? "var(--brand-400)" : "var(--text-primary)" }}>{t.label}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>
        <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Detected Interfaces</h4>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {subnets.map((s: any, i: number) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
              borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
            }}>
              <Wifi size={16} style={{ color: "var(--brand-400)" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.subnet}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{s.interface} • {s.ip}</div>
              </div>
              <button className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 11 }}
                disabled={scanning} onClick={() => startScan(s.subnet)}>
                {scanning ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={12} />}
                Scan
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Custom subnet (e.g. 10.0.1.0/24)" value={customSubnet}
            onChange={e => setCustomSubnet(e.target.value)}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)",
              border: "1px solid var(--border-primary)", color: "var(--text-primary)",
              fontSize: 12, fontFamily: "inherit", outline: "none",
            }} />
          <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 12 }}
            disabled={!customSubnet || scanning} onClick={() => { startScan(customSubnet); setCustomSubnet(""); }}>
            <Radar size={14} /> {SCAN_TYPES.find(t => t.value === scanType)?.label}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "scans" as const, label: "Scan History", icon: <Radar size={12} />, count: scans.length },
          { key: "pending" as const, label: "Pending Review", icon: <Eye size={12} />, count: pending.length },
          { key: "schedules" as const, label: "Schedules", icon: <Calendar size={12} />, count: schedules.length },
          { key: "credentials" as const, label: "Credential Vault", icon: <Key size={12} />, count: credentials.length },
          { key: "agents" as const, label: "Agents", icon: <Bot size={12} />, count: agents.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`btn ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 4 }}>
            {t.icon} {t.label} {t.count > 0 && <span className="badge cyan" style={{ fontSize: 9, marginLeft: 2 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Scan History Tab */}
      {tab === "scans" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {scans.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Radar size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No scans yet</div>
              <p style={{ fontSize: 12 }}>Use the scan buttons above to discover devices on your network</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Scan Name</th><th>Subnet</th><th>Status</th><th>Devices Found</th><th>New</th><th>Duration</th><th>Actions</th></tr></thead>
              <tbody>
                {scans.map((s: any) => {
                  const colors = STATUS_COLORS[s.status] || STATUS_COLORS.PENDING;
                  const duration = s.startedAt && s.completedAt
                    ? `${Math.round((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 1000)}s`
                    : s.status === "RUNNING" ? "Running..." : "—";
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{s.name || "Scan"}</td>
                      <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{s.subnet}</code></td>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: colors.bg, color: colors.text,
                        }}>
                          {s.status === "RUNNING" && <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />}
                          {s.status === "COMPLETED" && <CheckCircle2 size={10} />}
                          {s.status === "FAILED" && <XCircle size={10} />}
                          {s.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.devicesFound}</td>
                      <td>
                        {s.newDevices > 0 && <span className="badge amber">{s.newDevices} new</span>}
                        {s.newDevices === 0 && "—"}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{duration}</td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                          onClick={() => viewScanDetails(s.id)}>
                          <Eye size={10} /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pending Review Tab */}
      {tab === "pending" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {pending.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <CheckCircle2 size={36} style={{ margin: "0 auto 12px", color: "#10b981" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>All clear!</div>
              <p style={{ fontSize: 12 }}>No devices pending review</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>IP Address</th><th>MAC</th><th>Hostname</th><th>Type</th><th>Source Scan</th><th>Actions</th></tr></thead>
              <tbody>
                {pending.map((d: any) => (
                  <tr key={d.id}>
                    <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{d.ipAddress}</code></td>
                    <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>{d.macAddress || "—"}</td>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{d.hostname || "—"}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                        {DEVICE_ICONS[d.deviceType] || DEVICE_ICONS.Unknown} {d.deviceType}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{d.scanJob?.subnet || "—"}</td>
                    <td style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                        onClick={() => ignoreDevice(d.id)}>
                        <EyeOff size={10} /> Ignore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Scan Detail Modal */}
      {selectedScan && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setSelectedScan(null)}>
          <div style={{
            width: 700, maxHeight: "80vh", overflow: "auto", borderRadius: 16,
            background: "var(--bg-card)", border: "1px solid var(--border-primary)",
            padding: 24,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{selectedScan.name}</h2>
              <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }}
                onClick={() => setSelectedScan(null)}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-label">Subnet</div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-400)" }}>{selectedScan.subnet}</div></div>
              <div className="stat-card"><div className="stat-label">Scan Type</div><div style={{ fontSize: 12, fontWeight: 600 }}>{selectedScan.scanType}</div></div>
              <div className="stat-card"><div className="stat-label">Devices Found</div><div className="stat-value">{selectedScan.devicesFound}</div></div>
              <div className="stat-card"><div className="stat-label">New Devices</div><div className="stat-value">{selectedScan.newDevices}</div></div>
            </div>
            {selectedScan.discoveries?.length > 0 && (
              <table className="data-table">
                <thead><tr><th>IP</th><th>MAC</th><th>Hostname</th><th>Type</th><th>OS</th><th>Open Ports</th><th>Status</th></tr></thead>
                <tbody>
                  {selectedScan.discoveries.map((d: any) => {
                    let ports: any[] = [];
                    try { ports = d.openPorts ? JSON.parse(d.openPorts) : []; } catch {}
                    return (
                      <tr key={d.id}>
                        <td><code style={{ fontSize: 11 }}>{d.ipAddress}</code></td>
                        <td style={{ fontSize: 11, fontFamily: "monospace" }}>{d.macAddress || "—"}</td>
                        <td>{d.hostname || "—"}</td>
                        <td>{d.deviceType || "—"}</td>
                        <td style={{ fontSize: 11 }}>{d.osInfo || d.osGuess || "—"}</td>
                        <td style={{ fontSize: 10 }}>{ports.length > 0 ? ports.map((p:any) => p.service || p.port).join(", ") : "—"}</td>
                        <td><span className={`badge ${d.status === "MERGED" ? "green" : d.status === "PENDING_REVIEW" ? "amber" : "gray"}`}>{d.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Schedules Tab */}
      {tab === "schedules" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {schedules.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Calendar size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No scheduled scans</div>
              <p style={{ fontSize: 12 }}>Use the API to create cron-based scan schedules</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Subnet</th><th>Scan Type</th><th>Schedule (Cron)</th><th>Status</th><th>Next Run</th><th>Actions</th></tr></thead>
              <tbody>
                {schedules.map((s: any) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{s.subnet}</code></td>
                    <td><span className="badge cyan" style={{ fontSize: 10 }}>{s.scanType}</span></td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{s.schedule}</td>
                    <td>
                      <span className={`badge ${s.isActive ? "green" : "gray"}`} style={{ fontSize: 10 }}>
                        {s.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "—"}
                    </td>
                    <td style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                        onClick={() => toggleSchedule(s.id, s.isActive)}>
                        {s.isActive ? "Pause" : "Activate"}
                      </button>
                      <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, color: "#ef4444" }}
                        onClick={() => deleteSchedule(s.id)}>
                        <Trash2 size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Credential Vault Tab */}
      {tab === "credentials" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {credentials.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Key size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No scan credentials</div>
              <p style={{ fontSize: 12 }}>Add SSH, SNMP, or WMI credentials for agentless scanning</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Type</th><th>Scope</th><th>Last Used</th><th>Encrypted</th><th>Actions</th></tr></thead>
              <tbody>
                {credentials.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Shield size={14} style={{ color: "var(--brand-400)" }} /> {c.name}
                      </span>
                    </td>
                    <td><span className="badge cyan" style={{ fontSize: 10 }}>{c.type}</span></td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {c.scope?.subnets ? c.scope.subnets.join(", ") : "All subnets"}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleDateString() : "Never"}
                    </td>
                    <td>
                      <span className="badge green" style={{ fontSize: 9 }}>
                        <Shield size={8} /> AES-256
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, color: "#ef4444" }}
                        onClick={() => deleteCredential(c.id)}>
                        <Trash2 size={10} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Agents Tab */}
      {tab === "agents" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {agents.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Bot size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No agents registered</div>
              <p style={{ fontSize: 12 }}>Deploy the ReconAPM agent on endpoints to auto-report inventory</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Hostname</th><th>IP Address</th><th>Platform</th><th>Version</th><th>Status</th><th>Last Heartbeat</th></tr></thead>
              <tbody>
                {agents.map((a: any) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.hostname}</td>
                    <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{a.ipAddress}</code></td>
                    <td style={{ fontSize: 11 }}>{a.platform}</td>
                    <td style={{ fontSize: 11, fontFamily: "monospace" }}>{a.agentVersion}</td>
                    <td>
                      <span className={`badge ${a.status === "ONLINE" ? "green" : a.status === "STALE" ? "amber" : "red"}`}
                        style={{ fontSize: 10 }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {a.lastHeartbeat ? new Date(a.lastHeartbeat).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
