"use client";
import { useEffect, useState } from "react";
import {
  FileCode, History, GitCompare, Shield, Upload, Clock, CheckCircle2,
  AlertTriangle, RefreshCw, ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }
function apiFetch(path: string, opts?: any) {
  return fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, ...opts }).then(r => r.json());
}

export default function NetworkConfigPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [showBackup, setShowBackup] = useState(false);
  const [backupForm, setBackupForm] = useState({ deviceId: "", deviceName: "", configText: "" });

  function refresh() {
    setLoading(true);
    apiFetch("/monitoring/network/configs").then(d => setConfigs(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }
  useEffect(() => { refresh(); }, []);

  async function loadHistory(deviceId: string) {
    setSelectedDevice(deviceId);
    const h = await apiFetch(`/monitoring/network/configs/${deviceId}/history`);
    setHistory(Array.isArray(h) ? h : []);
  }

  async function loadDiff(deviceId: string, v1: number, v2: number) {
    const d = await apiFetch(`/monitoring/network/configs/${deviceId}/diff?v1=${v1}&v2=${v2}`);
    setDiff(d);
  }

  async function handleBackup(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch(`/monitoring/network/configs/${backupForm.deviceId}/backup`, {
      method: "POST",
      body: JSON.stringify({ deviceName: backupForm.deviceName, configText: backupForm.configText }),
    });
    setShowBackup(false);
    setBackupForm({ deviceId: "", deviceName: "", configText: "" });
    refresh();
  }

  async function setBaseline(id: string) {
    await apiFetch(`/monitoring/network/configs/${id}/set-baseline`, { method: "POST" });
    if (selectedDevice) loadHistory(selectedDevice);
    refresh();
  }

  // Group configs by device
  const deviceGroups = configs.reduce((acc: any, c) => {
    if (!acc[c.deviceId]) acc[c.deviceId] = { name: c.deviceName, configs: [] };
    acc[c.deviceId].configs.push(c);
    return acc;
  }, {});

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <button onClick={() => router.push("/dashboard/network")} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 0 }}><ArrowLeft size={16} /></button>
            <h1 className="page-title" style={{ margin: 0 }}>Network Config Backup</h1>
          </div>
          <p className="page-subtitle">Configuration versioning, drift detection, and compliance baselines</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowBackup(true)}><Upload size={14} /> Backup Config</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card">
          <div className="stat-content"><div className="stat-label">Total Backups</div><div className="stat-value">{configs.length}</div></div>
          <FileCode size={18} style={{ color: "#22d3ee" }} />
        </div>
        <div className="stat-card">
          <div className="stat-content"><div className="stat-label">Devices</div><div className="stat-value">{Object.keys(deviceGroups).length}</div></div>
          <Shield size={18} style={{ color: "#8b5cf6" }} />
        </div>
        <div className="stat-card">
          <div className="stat-content"><div className="stat-label">Baselines Set</div><div className="stat-value">{configs.filter(c => c.isBaseline).length}</div></div>
          <CheckCircle2 size={18} style={{ color: "#10b981" }} />
        </div>
        <div className="stat-card">
          <div className="stat-content"><div className="stat-label">Latest Backup</div><div className="stat-value" style={{ fontSize: 14 }}>{configs[0] ? new Date(configs[0].backedUpAt).toLocaleDateString() : "—"}</div></div>
          <Clock size={18} style={{ color: "#f59e0b" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedDevice ? "1fr 1fr" : "1fr", gap: 16 }}>
        {/* Config list by device */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "12px 20px" }}><div className="card-title">Device Configs</div></div>
          {Object.keys(deviceGroups).length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-tertiary)" }}>
              <FileCode size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No config backups yet</div>
              <p style={{ fontSize: 12 }}>Click "Backup Config" to store your first device configuration</p>
            </div>
          ) : (
            <div style={{ padding: 8 }}>
              {Object.entries(deviceGroups).map(([deviceId, group]: [string, any]) => (
                <div key={deviceId}
                  onClick={() => loadHistory(deviceId)}
                  style={{
                    padding: "10px 14px", borderRadius: 8, marginBottom: 4,
                    cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: selectedDevice === deviceId ? "rgba(34,211,238,0.08)" : "transparent",
                    border: selectedDevice === deviceId ? "1px solid rgba(34,211,238,0.2)" : "1px solid transparent",
                  }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{group.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{deviceId.substring(0, 12)}...</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{group.configs.length} versions</span>
                    {group.configs.some((c: any) => c.isBaseline) && <span className="badge green" style={{ fontSize: 9 }}>Baseline</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Version history panel */}
        {selectedDevice && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header" style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between" }}>
              <div className="card-title"><History size={14} style={{ marginRight: 6, verticalAlign: "middle" }} /> Version History</div>
              {history.length >= 2 && (
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => loadDiff(selectedDevice, history[history.length - 1]?.version, history[0]?.version)}>
                  <GitCompare size={12} /> Compare Latest
                </button>
              )}
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {history.map((h: any) => (
                <div key={h.id} style={{
                  padding: "10px 20px", borderBottom: "1px solid var(--border-primary)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                      v{h.version}
                      {h.isBaseline && <span className="badge green" style={{ fontSize: 9 }}>BASELINE</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {new Date(h.backedUpAt).toLocaleString()}
                      {h.changesSummary && <span style={{ marginLeft: 8, color: "#f59e0b" }}>({h.changesSummary})</span>}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-tertiary)", marginTop: 2 }}>SHA256: {h.configHash?.substring(0, 16)}...</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {!h.isBaseline && (
                      <button onClick={() => setBaseline(h.id)} style={{
                        padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit", background: "rgba(16,185,129,0.1)", color: "#10b981",
                      }}>Set Baseline</button>
                    )}
                    {h.version > 1 && (
                      <button onClick={() => loadDiff(selectedDevice, h.version - 1, h.version)} style={{
                        padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit", background: "rgba(34,211,238,0.1)", color: "#22d3ee",
                      }}>Diff</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Diff Result */}
      {diff && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div>
              <div className="card-title"><GitCompare size={14} style={{ marginRight: 6, verticalAlign: "middle" }} /> Config Diff: v{diff.version1} → v{diff.version2}</div>
              <div className="card-subtitle">
                {diff.driftDetected
                  ? <span style={{ color: "#ef4444" }}><AlertTriangle size={12} style={{ verticalAlign: "middle" }} /> Drift detected</span>
                  : <span style={{ color: "#10b981" }}><CheckCircle2 size={12} style={{ verticalAlign: "middle" }} /> No drift</span>
                }
                {" "} — {diff.stats?.added} added, {diff.stats?.removed} removed, {diff.stats?.unchanged} unchanged
              </div>
            </div>
            <button onClick={() => setDiff(null)} className="btn btn-secondary" style={{ fontSize: 11 }}>Close</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>+ ADDED LINES</div>
              <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 8, padding: 12, maxHeight: 200, overflowY: "auto", border: "1px solid rgba(16,185,129,0.15)" }}>
                {diff.diff?.added?.length === 0
                  ? <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>No additions</span>
                  : diff.diff?.added?.map((line: string, i: number) => (
                    <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "#10b981", padding: "1px 0" }}>+ {line}</div>
                  ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>- REMOVED LINES</div>
              <div style={{ background: "rgba(239,68,68,0.05)", borderRadius: 8, padding: 12, maxHeight: 200, overflowY: "auto", border: "1px solid rgba(239,68,68,0.15)" }}>
                {diff.diff?.removed?.length === 0
                  ? <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>No removals</span>
                  : diff.diff?.removed?.map((line: string, i: number) => (
                    <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "#ef4444", padding: "1px 0" }}>- {line}</div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Modal */}
      {showBackup && (
        <>
          <div onClick={() => setShowBackup(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", zIndex: 2001, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Backup Device Config</h3>
            <form onSubmit={handleBackup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input required placeholder="Device ID *" value={backupForm.deviceId} onChange={e => setBackupForm({ ...backupForm, deviceId: e.target.value })}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }} />
              <input required placeholder="Device Name *" value={backupForm.deviceName} onChange={e => setBackupForm({ ...backupForm, deviceName: e.target.value })}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }} />
              <textarea required rows={10} placeholder="Paste device configuration here..." value={backupForm.configText} onChange={e => setBackupForm({ ...backupForm, configText: e.target.value })}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", resize: "vertical" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBackup(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Upload size={12} /> Backup</button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
