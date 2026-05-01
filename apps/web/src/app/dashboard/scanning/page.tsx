"use client";
import { useEffect, useState } from "react";
import {
  Shield, Scan, Wifi, Terminal, Globe, Lock, Router, Radio,
  CheckCircle2, XCircle, Loader2, Clock, Eye, Play, ChevronDown,
  AlertTriangle, Server, Search,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }
function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...opts?.headers } }).then(r => r.json());
}

const SCAN_ICONS: Record<string, any> = { NMAP: Scan, SNMP: Router, SSH: Terminal, ARP: Wifi, TRACEROUTE: Globe, SSL: Lock };
const SCAN_COLORS: Record<string, string> = { NMAP: "#ef4444", SNMP: "#8b5cf6", SSH: "#06b6d4", ARP: "#f59e0b", TRACEROUTE: "#3b82f6", SSL: "#10b981" };

export default function ScanningPage() {
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanType, setScanType] = useState("NMAP");
  const [target, setTarget] = useState("");
  const [scanDepth, setScanDepth] = useState("quick");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [selectedScan, setSelectedScan] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);

  function refresh() {
    Promise.all([
      apiFetch("/scanning/capabilities"),
      apiFetch("/scanning/results"),
    ]).then(([caps, hist]) => {
      setCapabilities(Array.isArray(caps) ? caps : []);
      setHistory(Array.isArray(hist) ? hist : []);
    }).catch(console.error).finally(() => setLoading(false));
  }
  useEffect(() => { refresh(); }, []);

  async function runScan() {
    if (!target.trim()) return;
    setScanning(true); setScanResult(null);
    try {
      const opts: any = {};
      if (scanType === "NMAP") opts.scanDepth = scanDepth;
      const result = await apiFetch("/scanning/run", {
        method: "POST", body: JSON.stringify({ type: scanType, target: target.trim(), options: opts }),
      });
      setScanResult(result);
      refresh();
    } catch (err) {
      setScanResult({ status: "FAILED", error: "Scan request failed" });
    } finally { setScanning(false); }
  }

  async function viewDetail(scan: any) {
    setSelectedScan(scan);
    try {
      const detail = await apiFetch(`/scanning/results/${scan.id}`);
      setDetailData(detail);
    } catch { setDetailData(null); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const available = capabilities.filter(c => c.available).length;
  const total = capabilities.length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Scanning</h1>
          <p className="page-subtitle">{available}/{total} tools available • {history.length} scans completed</p>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
        {capabilities.map((cap: any) => {
          const Icon = SCAN_ICONS[cap.type] || Shield;
          const color = SCAN_COLORS[cap.type] || "#64748b";
          return (
            <div key={cap.type} className="card" style={{ padding: "14px 16px", borderLeft: `3px solid ${cap.available ? color : "var(--border-primary)"}`, opacity: cap.available ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Icon size={18} style={{ color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{cap.name}</span>
                {cap.available ? (
                  <span className="badge green" style={{ fontSize: 9, marginLeft: "auto" }}>READY</span>
                ) : (
                  <span className="badge red" style={{ fontSize: 9, marginLeft: "auto" }}>N/A</span>
                )}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.4 }}>{cap.description}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <span className={`badge ${cap.mode === 'agent-based' ? 'cyan' : 'purple'}`} style={{ fontSize: 9 }}>{cap.mode}</span>
                {cap.version && <span className="badge gray" style={{ fontSize: 9 }}>v{cap.version}</span>}
                {cap.requiresCredentials && <span className="badge amber" style={{ fontSize: 9 }}>needs creds</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scan Runner */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="card-header" style={{ marginBottom: 12 }}><div className="card-title">Run Scan</div></div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 140px" }}>
            <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Scanner</label>
            <select value={scanType} onChange={e => setScanType(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit" }}>
              {capabilities.filter(c => c.available).map(c => (
                <option key={c.type} value={c.type}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Target</label>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder={scanType === "SSL" ? "example.com" : scanType === "ARP" ? "192.168.1.0/24 (or leave blank)" : "192.168.1.0/24 or 10.0.1.1"}
              style={{ width: "100%", padding: "8px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          </div>
          {scanType === "NMAP" && (
            <div style={{ flex: "0 0 120px" }}>
              <label style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Depth</label>
              <select value={scanDepth} onChange={e => setScanDepth(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit" }}>
                <option value="quick">Quick (Top 100)</option>
                <option value="standard">Standard (Top 1000)</option>
                <option value="deep">Deep (All 65535)</option>
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={runScan} disabled={scanning || !target.trim()} style={{ height: 38 }}>
            {scanning ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Scanning...</> : <><Play size={14} /> Run Scan</>}
          </button>
        </div>
      </div>

      {/* Scan Result Banner */}
      {scanResult && (
        <div className="card" style={{
          marginBottom: 16, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
          border: scanResult.status === "FAILED" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(16,185,129,0.3)",
          background: scanResult.status === "FAILED" ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
        }}>
          <div>
            {scanResult.status === "FAILED" ? (
              <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}><AlertTriangle size={14} style={{ verticalAlign: "middle" }} /> {scanResult.error}</span>
            ) : (
              <span style={{ color: "#10b981", fontSize: 13, fontWeight: 600 }}>
                <CheckCircle2 size={14} style={{ verticalAlign: "middle" }} />{" "}
                {scanResult.type} scan completed in {scanResult.duration?.toFixed(1)}s — {JSON.stringify(scanResult.summary || {})}
              </span>
            )}
          </div>
          <button onClick={() => setScanResult(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Scan History */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="card-header" style={{ padding: "12px 16px" }}><div className="card-title">Scan History</div></div>
        <table className="data-table">
          <thead>
            <tr><th>Type</th><th>Target</th><th>Status</th><th>Duration</th><th>Summary</th><th>Time</th><th></th></tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No scans yet. Run your first scan above.</td></tr>
            ) : history.map((s: any) => {
              const Icon = SCAN_ICONS[s.scanType] || Shield;
              const color = SCAN_COLORS[s.scanType] || "#64748b";
              const summary = s.summary || {};
              const summaryText = s.scanType === "NMAP" ? `${summary.hostsUp || 0} hosts, ${summary.portsFound || 0} ports`
                : s.scanType === "SSL" ? `Grade ${summary.grade || "?"}, ${summary.daysRemaining || "?"} days`
                : s.scanType === "ARP" ? `${summary.hostsFound || 0} hosts found`
                : s.scanType === "TRACEROUTE" ? `${summary.totalHops || 0} hops, ${summary.reachable ? "reachable" : "unreachable"}`
                : s.scanType === "SNMP" ? `${summary.deviceType || "?"}, ${summary.interfaceCount || 0} interfaces`
                : s.scanType === "SSH" ? `${summary.os || "?"}, ${summary.pendingPatches || 0} patches`
                : JSON.stringify(summary).substring(0, 60);
              return (
                <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => viewDetail(s)}>
                  <td><span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon size={14} style={{ color }} /><span className="badge" style={{ background: `${color}22`, color, fontSize: 10 }}>{s.scanType}</span></span></td>
                  <td><code style={{ fontSize: 11, color: "var(--brand-400)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4 }}>{s.target}</code></td>
                  <td><span className={`badge ${s.status === "COMPLETED" ? "green" : s.status === "RUNNING" ? "amber" : "red"}`}>{s.status}</span></td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.duration ? `${s.duration.toFixed(1)}s` : "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--text-tertiary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summaryText}</td>
                  <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{new Date(s.startedAt).toLocaleString()}</td>
                  <td><button className="btn btn-secondary" style={{ padding: "3px 8px" }}><Eye size={11} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {selectedScan && (
        <>
          <div onClick={() => { setSelectedScan(null); setDetailData(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: "var(--bg-card)", zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selectedScan.scanType} Scan</h2>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{selectedScan.target} • {new Date(selectedScan.startedAt).toLocaleString()}</p>
              </div>
              <button onClick={() => { setSelectedScan(null); setDetailData(null); }} className="btn btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {!detailData ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  <Row label="Status" value={<span className={`badge ${detailData.status === "COMPLETED" ? "green" : "red"}`}>{detailData.status}</span>} />
                  <Row label="Duration" value={detailData.duration ? `${detailData.duration.toFixed(2)}s` : "N/A"} />
                  <Row label="Target Type" value={detailData.targetType} />
                  <Row label="Triggered By" value={detailData.triggeredBy?.substring(0, 8) + "..."} />
                  {detailData.summary && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>Summary</div>
                      {Object.entries(detailData.summary).map(([k, v]: any) => (
                        <Row key={k} label={k} value={typeof v === "object" ? JSON.stringify(v) : String(v)} />
                      ))}
                    </>
                  )}
                  {detailData.results && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>Raw Results</div>
                      <pre style={{ fontSize: 10, color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {JSON.stringify(detailData.results, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{typeof value === "string" ? value : value}</span>
    </div>
  );
}
