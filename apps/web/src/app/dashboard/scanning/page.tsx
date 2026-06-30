"use client";
import { useEffect, useState } from "react";
import {
  Shield, Scan, Wifi, Terminal, Globe, Lock, Router, Radio,
  CheckCircle2, XCircle, Loader2, Clock, Eye, Play, ChevronDown,
  AlertTriangle, Server, Search, ShieldAlert, Activity, Ticket, Filter,
  Bug, Usb, Cpu, HardDrive, Skull, AlertOctagon, Info, ExternalLink,
  AlertCircle, Check, X, ChevronRight, Trash2
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtimeEvents";
import { PageHelp } from "@/components/HelpSystem";

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

  // Tab state
  const [activeTab, setActiveTab] = useState<"console" | "detected">("console");

  // Detected risks states
  const [findings, setFindings] = useState<any[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<any>(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Ticket creation states
  const [creatingTicket, setCreatingTicket] = useState<string | null>(null);
  const [ticketSuccess, setTicketSuccess] = useState<any>(null);

  async function handleDeleteScan(id: string) {
    if (!confirm("Delete this scan result?")) return;
    try {
      await apiFetch(`/scanning/results/${id}`, { method: "DELETE" });
      refresh();
    } catch {
      alert("Failed to delete scan result.");
    }
  }

  function refresh() {
    Promise.all([
      apiFetch("/scanning/capabilities"),
      apiFetch("/scanning/results"),
    ]).then(([caps, hist]) => {
      setCapabilities(Array.isArray(caps) ? caps : []);
      setHistory(Array.isArray(hist) ? hist : []);
    }).catch(console.error).finally(() => setLoading(false));
  }

  async function loadFindings() {
    setFindingsLoading(true);
    try {
      const data = await apiFetch("/scanning/detected");
      setFindings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load detected vulnerabilities:", e);
    } finally {
      setFindingsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    loadFindings();
  }, []);

  // WebSocket: auto-refresh on scan progress and completion
  const { on: onWsEvent } = useRealtimeEvents();
  useEffect(() => {
    const cleanups = [
      onWsEvent('scan_progress', (data: any) => {
        // Update scan status in real-time
        if (data?.status === 'COMPLETED' || data?.status === 'FAILED') {
          refresh();
          loadFindings();
        } else {
          refresh();
        }
      }),
    ];
    return () => cleanups.forEach(c => c());
  }, [onWsEvent]);

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
      // Reload findings since new scan completed
      loadFindings();
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

  async function createTicketForFinding(finding: any) {
    setCreatingTicket(finding.id);
    setTicketSuccess(null);
    try {
      const priorityMap: Record<string, string> = {
        CRITICAL: "CRITICAL",
        HIGH: "HIGH",
        MEDIUM: "MEDIUM",
        LOW: "LOW"
      };

      const ticket = await apiFetch("/tickets", {
        method: "POST",
        body: JSON.stringify({
          type: "INCIDENT",
          category: "SECURITY",
          subject: `Security Vulnerability: ${finding.title} on ${finding.target}`,
          priority: priorityMap[finding.severity] || "MEDIUM",
          description: `VULNERABILITY REPORT\n====================\n\nTitle: ${finding.title}\nSeverity: ${finding.severity} (CVSS: ${finding.cvss})\nTarget: ${finding.target}\nCategory: ${finding.category}\nDetected At: ${new Date(finding.detectedAt).toLocaleString()}\n\nSCAN EVIDENCE:\n--------------\n${finding.evidence}\n\nREMEDIATION PLAYBOOK:\n---------------------\n${finding.remediation}\n\nGenerated automatically by QS Asset CMDB Scanning Module.`,
        })
      });

      setTicketSuccess({ id: finding.id, number: ticket.ticketNumber, ticketId: ticket.id });
      setFindings((prev: any[]) => prev.map((f: any) => f.id === finding.id ? { ...f, ticketNumber: ticket.ticketNumber, ticketId: ticket.id } : f));
      if (selectedFinding && selectedFinding.id === finding.id) {
        setSelectedFinding((prev: any) => ({ ...prev, ticketNumber: ticket.ticketNumber, ticketId: ticket.id }));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate ticket. Ensure ITSM module services are running.");
    } finally {
      setCreatingTicket(null);
    }
  }

  async function muteFinding(id: string) {
    try {
      await apiFetch(`/scanning/detected/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'MUTED' }) });
      setFindings((prev: any[]) => prev.map((f: any) => f.id === id ? { ...f, status: 'MUTED' } : f));
      if (selectedFinding && selectedFinding.id === id) {
        setSelectedFinding((prev: any) => ({ ...prev, status: 'MUTED' }));
      }
    } catch { alert('Failed to mute finding'); }
  }

  async function resolveFinding(id: string) {
    try {
      await apiFetch(`/scanning/detected/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'RESOLVED' }) });
      setFindings((prev: any[]) => prev.map((f: any) => f.id === id ? { ...f, status: 'RESOLVED' } : f));
      if (selectedFinding && selectedFinding.id === id) {
        setSelectedFinding((prev: any) => ({ ...prev, status: 'RESOLVED' }));
      }
    } catch { alert('Failed to resolve finding'); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const available = capabilities.filter(c => c.available).length;
  const total = capabilities.length;

  // Posture score & findings calculations
  const activeFindings = findings.filter(f => f.status === "ACTIVE");
  const totalPenalty = activeFindings.reduce((sum, f) => {
    if (f.severity === "CRITICAL") return sum + 15;
    if (f.severity === "HIGH") return sum + 10;
    if (f.severity === "MEDIUM") return sum + 5;
    if (f.severity === "LOW") return sum + 2;
    return sum;
  }, 0);
  const postureScore = Math.max(30, 100 - totalPenalty);

  // Filtered findings list
  const filteredFindings = findings.filter(f => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.remediation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.evidence && f.evidence.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSeverity = severityFilter === "ALL" || f.severity === severityFilter;
    const matchesCategory = categoryFilter === "ALL" || f.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || f.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesCategory && matchesStatus;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Scanning</h1>
          <p className="page-subtitle">{available}/{total} scanners ready • {history.length} audits completed • Posture: {postureScore}%</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { setLoading(true); refresh(); loadFindings(); }}>
            <Loader2 size={14} className={loading ? "animate-spin" : ""} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid var(--border-primary)", paddingBottom: 8 }}>
        <button onClick={() => setActiveTab("console")}
          className={`btn ${activeTab === "console" ? "btn-primary" : "btn-secondary"}`}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "8px 16px" }}>
          <Scan size={14} /> Scanner Console
        </button>
        <button onClick={() => setActiveTab("detected")}
          className={`btn ${activeTab === "detected" ? "btn-primary" : "btn-secondary"}`}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "8px 16px", position: "relative" }}>
          <ShieldAlert size={14} /> Detected Risks
          {activeFindings.length > 0 && (
            <span className="badge red" style={{ fontSize: 9, padding: "2px 5px", borderRadius: "50%", position: "absolute", top: -8, right: -6, animation: "pulse 2s infinite" }}>
              {activeFindings.length}
            </span>
          )}
        </button>
      </div>

      {/* 🚀 TAB 1: SCANNER CONSOLE */}
      {activeTab === "console" && (
        <>
          <PageHelp id="scanning" title="Security Scanning">
            Select a scanner type below and enter a target IP or subnet. <strong>Nmap</strong> provides the deepest inspection (ports, OS detection, services). <strong>ARP</strong> discovers devices at Layer 2. <strong>SSL/TLS</strong> validates certificates. Results appear in the scan history table below. Scanners marked &quot;Unavailable&quot; need to be installed on the server.
          </PageHelp>

          {/* Capabilities Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
            {capabilities.map((cap: any) => {
              const Icon = SCAN_ICONS[cap.type] || Shield;
              const color = SCAN_COLORS[cap.type] || "#64748b";
              return (
                <div key={cap.type} className="card" style={{ padding: "14px 16px", borderLeft: `3px solid ${cap.available ? color : "var(--border-primary)"}`, opacity: cap.available ? 1 : 0.5, cursor: cap.available ? "pointer" : "default", transition: "transform 0.15s" }}
                  onClick={() => { if (cap.available) { setScanType(cap.type); document.getElementById("scan-runner")?.scrollIntoView({ behavior: "smooth" }); } }}
                  onMouseEnter={e => { if (cap.available) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
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
          <div id="scan-runner" className="card" style={{ padding: 16, marginBottom: 20 }}>
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
                      <td style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary" style={{ padding: "3px 8px" }}><Eye size={11} /></button>
                        <button className="btn btn-secondary" style={{ padding: "3px 8px", color: "#ef4444" }} onClick={(e) => { e.stopPropagation(); handleDeleteScan(s.id); }}><Trash2 size={11} /></button>
                      </td>
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
        </>
      )}

      {/* 🛡️ TAB 2: DETECTED RISKS & VULNERABILITIES */}
      {activeTab === "detected" && (
        <>
          <PageHelp id="detected" title="Detected Security Risks & Vulnerabilities">
            Review the continuous security findings board. This section processes completed on-demand scans and agent compliance telemetry to list exposed ports, outdated configurations, SSL failures, and blocked desktop threat anomalies. Click any finding to inspect technical evidence and generate ITSM remedial support tickets instantly.
          </PageHelp>

          {/* Posture gauge + Severity counters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20 }}>
            {/* Posture Score Gauge */}
            <div className="card animate-fade-in" style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 24px",
              background: "rgba(18, 24, 46, 0.4)", backdropFilter: "blur(20px)",
              border: `1px solid ${postureScore >= 80 ? "rgba(16,185,129,0.2)" : postureScore >= 60 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
              boxShadow: `0 8px 32px 0 rgba(0,0,0,0.3), inset 0 0 15px ${postureScore >= 80 ? "rgba(16,185,129,0.05)" : postureScore >= 60 ? "rgba(245,158,11,0.05)" : "rgba(239,68,68,0.05)"}`
            }}>
              <div style={{ position: "relative", width: 100, height: 100, marginBottom: 10 }}>
                <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke={postureScore >= 80 ? "#10b981" : postureScore >= 60 ? "#f59e0b" : "#ef4444"} strokeWidth="3"
                    strokeDasharray={`${postureScore}, 100`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: postureScore >= 80 ? "#10b981" : postureScore >= 60 ? "#f59e0b" : "#ef4444" }}>
                    {postureScore}%
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Posture Index</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, textAlign: "center" }}>
                {activeFindings.length === 0 ? "No active threats detected" : `${activeFindings.length} unresolved vulnerabilities`}
              </div>
            </div>

            {/* Severity Counters */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <div className="card" onClick={() => setSeverityFilter(severityFilter === "CRITICAL" ? "ALL" : "CRITICAL")} style={{
                padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer",
                borderLeft: "4px solid #ef4444", transition: "transform 0.15s", background: severityFilter === "CRITICAL" ? "rgba(239,68,68,0.05)" : "var(--bg-card)"
              }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>CRITICAL</span>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "#ef4444" }}>{activeFindings.filter(f => f.severity === "CRITICAL").length}</span>
                  <Skull size={18} style={{ color: "#ef4444", opacity: 0.8 }} />
                </div>
              </div>

              <div className="card" onClick={() => setSeverityFilter(severityFilter === "HIGH" ? "ALL" : "HIGH")} style={{
                padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer",
                borderLeft: "4px solid #f59e0b", transition: "transform 0.15s", background: severityFilter === "HIGH" ? "rgba(245,158,11,0.05)" : "var(--bg-card)"
              }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>HIGH</span>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>{activeFindings.filter(f => f.severity === "HIGH").length}</span>
                  <AlertTriangle size={18} style={{ color: "#f59e0b", opacity: 0.8 }} />
                </div>
              </div>

              <div className="card" onClick={() => setSeverityFilter(severityFilter === "MEDIUM" ? "ALL" : "MEDIUM")} style={{
                padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer",
                borderLeft: "4px solid #3b82f6", transition: "transform 0.15s", background: severityFilter === "MEDIUM" ? "rgba(59,130,246,0.05)" : "var(--bg-card)"
              }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>MEDIUM</span>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "#3b82f6" }}>{activeFindings.filter(f => f.severity === "MEDIUM").length}</span>
                  <Shield size={18} style={{ color: "#3b82f6", opacity: 0.8 }} />
                </div>
              </div>

              <div className="card" onClick={() => setSeverityFilter(severityFilter === "LOW" ? "ALL" : "LOW")} style={{
                padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer",
                borderLeft: "4px solid #06b6d4", transition: "transform 0.15s", background: severityFilter === "LOW" ? "rgba(6,182,212,0.05)" : "var(--bg-card)"
              }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>LOW</span>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "#06b6d4" }}>{activeFindings.filter(f => f.severity === "LOW").length}</span>
                  <Info size={18} style={{ color: "#06b6d4", opacity: 0.8 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="card" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-tertiary)" }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search vulnerabilities by target IP, domain, title, CVE..."
                  style={{ width: "100%", padding: "8px 10px 8px 30px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
              </div>

              <div style={{ width: 140 }}>
                <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit" }}>
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical only</option>
                  <option value="HIGH">High only</option>
                  <option value="MEDIUM">Medium only</option>
                  <option value="LOW">Low only</option>
                </select>
              </div>

              <div style={{ width: 140 }}>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit" }}>
                  <option value="ALL">All Categories</option>
                  <option value="OPEN_PORT">Open Ports</option>
                  <option value="SSL_RISK">SSL Vulnerabilities</option>
                  <option value="MALWARE">Blocked Processes</option>
                  <option value="COMPLIANCE">System Compliance</option>
                </select>
              </div>

              <div style={{ width: 120 }}>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit" }}>
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Alerts</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="MUTED">Muted</option>
                </select>
              </div>

              {(searchQuery || severityFilter !== "ALL" || categoryFilter !== "ALL" || statusFilter !== "ALL") && (
                <button className="btn btn-secondary" style={{ fontSize: 11, padding: "7px 12px" }}
                  onClick={() => { setSearchQuery(""); setSeverityFilter("ALL"); setCategoryFilter("ALL"); setStatusFilter("ALL"); }}>
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Detections List Grid */}
          {findingsLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, color: "var(--text-tertiary)" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={40} style={{ color: "#10b981", marginBottom: 12, opacity: 0.8 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>No Vulnerabilities Detected</h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 400, margin: 0 }}>
                All scanned targets are clear of security threats, open legacy protocols, and expired certifications. Great job!
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, animation: "fadeIn 0.25s ease-out" }}>
              {filteredFindings.map((finding: any) => {
                const isCritical = finding.severity === "CRITICAL";
                const isHigh = finding.severity === "HIGH";
                const isMedium = finding.severity === "MEDIUM";
                const isMuted = finding.status === "MUTED";
                const isResolved = finding.status === "RESOLVED";

                const leftBorderColor = isCritical ? "#ef4444" : isHigh ? "#f59e0b" : isMedium ? "#3b82f6" : "#06b6d4";
                const statusBg = isResolved ? "rgba(16,185,129,0.08)" : isMuted ? "rgba(100,116,139,0.08)" : `${leftBorderColor}11`;
                const statusText = isResolved ? "#10b981" : isMuted ? "#64748b" : leftBorderColor;

                return (
                  <div key={finding.id} className="card" style={{
                    padding: "14px 18px", borderLeft: `4px solid ${leftBorderColor}`, background: isMuted || isResolved ? "rgba(15, 23, 42, 0.3)" : "var(--bg-card)",
                    opacity: isMuted || isResolved ? 0.65 : 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                    boxShadow: isMuted || isResolved ? "none" : "0 4px 12px rgba(0,0,0,0.1)", transition: "all 0.2s"
                  }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, cursor: "pointer" }} onClick={() => setSelectedFinding(finding)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`badge`} style={{ background: statusBg, color: statusText, fontSize: 10, fontWeight: 700 }}>
                          {finding.severity}
                        </span>
                        <span className="badge gray" style={{ fontSize: 9 }}>{finding.category.replace("_", " ")}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          {new Date(finding.detectedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>{finding.title}</h4>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Target: </span>
                        <code style={{ fontSize: 11, color: "var(--brand-400)", background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 4 }}>
                          {finding.target}
                        </code>
                        {finding.cvss && (
                          <span className="badge" style={{ fontSize: 10, background: `rgba(239, 68, 68, 0.04)`, color: "#ef4444", fontWeight: 600 }}>
                            CVSS: {finding.cvss}
                          </span>
                        )}
                      </div>
                      {finding.evidence && (
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 600 }}>
                          {finding.evidence}
                        </p>
                      )}
                    </div>

                    {/* Action Panel */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {finding.ticketNumber ? (
                        <a href={`/dashboard/tickets`} className="badge green" style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", fontSize: 10, textDecoration: "none" }}>
                          <Ticket size={11} /> {finding.ticketNumber}
                        </a>
                      ) : (
                        <button className="btn btn-secondary" disabled={creatingTicket === finding.id}
                          style={{ fontSize: 10, padding: "5px 10px", color: "var(--brand-400)", display: "flex", alignItems: "center", gap: 4 }}
                          onClick={() => createTicketForFinding(finding)}>
                          {creatingTicket === finding.id ? (
                            <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                          ) : (
                            <Ticket size={11} />
                          )}
                          Create Ticket
                        </button>
                      )}
                      <button className="btn btn-secondary" style={{ padding: "5px 8px" }} onClick={() => setSelectedFinding(finding)}>
                        <Eye size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Finding slide-out Technical Sheet */}
          {selectedFinding && (
            <>
              <div onClick={() => { setSelectedFinding(null); setTicketSuccess(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
              <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: "var(--bg-card)", zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: selectedFinding.severity === "CRITICAL" ? "#ef4444" : selectedFinding.severity === "HIGH" ? "#f59e0b" : "#3b82f6" }}>
                      Vulnerability Technical Sheet
                    </span>
                    <h2 style={{ fontSize: 16, fontWeight: 800, margin: "4px 0 0" }}>{selectedFinding.title}</h2>
                  </div>
                  <button onClick={() => { setSelectedFinding(null); setTicketSuccess(null); }} className="btn btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Score & details grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 12, border: "1px solid var(--border-primary)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "1px solid var(--border-primary)", paddingRight: 10 }}>
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239, 68, 68, 0.03)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `2px solid ${selectedFinding.severity === "CRITICAL" ? "#ef4444" : selectedFinding.severity === "HIGH" ? "#f59e0b" : "#3b82f6"}` }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: selectedFinding.severity === "CRITICAL" ? "#ef4444" : selectedFinding.severity === "HIGH" ? "#f59e0b" : "#3b82f6" }}>{selectedFinding.cvss || "—"}</span>
                        <span style={{ fontSize: 8, color: "var(--text-tertiary)", fontWeight: 700 }}>CVSS</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, marginTop: 8, color: "var(--text-secondary)" }}>{selectedFinding.severity}</span>
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Target Endpoint:</span>
                        <code style={{ fontWeight: 600, color: "var(--brand-400)" }}>{selectedFinding.target}</code>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Risk Category:</span>
                        <span style={{ fontWeight: 600 }}>{selectedFinding.category.replace("_", " ")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Detection State:</span>
                        <span className={`badge ${selectedFinding.status === "ACTIVE" ? "red" : selectedFinding.status === "RESOLVED" ? "green" : "gray"}`} style={{ fontSize: 9 }}>
                          {selectedFinding.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Scanned Time:</span>
                        <span style={{ fontWeight: 500, fontSize: 11 }}>{new Date(selectedFinding.detectedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Threat Profile & Impact</h3>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                      This vulnerability exposes the target asset <code style={{ color: "var(--brand-300)" }}>{selectedFinding.target}</code> to serious operational risk. 
                      {selectedFinding.severity === "CRITICAL" && " Exploitation requires no advanced permissions and can result in absolute system compromise, unauthorized domain shell access, or malware injection."}
                      {selectedFinding.severity === "HIGH" && " Exploitation can disrupt production assets, disclose sensitive corporate telemetry, or lead to unauthorized privilege escalation."}
                      {selectedFinding.severity === "MEDIUM" && " Standard vulnerability matching or legacy protocol usage that should be mitigated as part of normal security audits."}
                    </p>
                  </div>

                  {/* Scanned Proof / Evidence */}
                  {selectedFinding.evidence && (
                    <div>
                      <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Scan Telemetry & Proof (Raw Data)</h3>
                      <pre style={{ fontSize: 10, color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 150, border: "1px solid var(--border-primary)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {selectedFinding.evidence}
                      </pre>
                    </div>
                  )}

                  {/* Actionable Playbook Remediation */}
                  <div>
                    <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Security Mitigation Playbook</h3>
                    <div style={{ background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: 12 }}>
                      <p style={{ fontSize: 12, color: "#34d399", margin: "0 0 10px", lineHeight: 1.4, fontWeight: 600 }}>Recommended Fix Action:</p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{selectedFinding.remediation}</p>
                      <div style={{ marginTop: 12, borderTop: "1px solid rgba(16,185,129,0.1)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-secondary)" }}>
                          <input type="checkbox" checked readOnly style={{ accentColor: "#10b981" }} /> Identify target host firewall settings and configurations.
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-secondary)" }}>
                          <input type="checkbox" defaultChecked style={{ accentColor: "#10b981" }} /> Create and execute an ITIL incident ticket to track remediation.
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-secondary)" }}>
                          <input type="checkbox" style={{ accentColor: "#10b981" }} /> Upgrade, block, or disable target software or service as per playbook instructions.
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-secondary)" }}>
                          <input type="checkbox" style={{ accentColor: "#10b981" }} /> Re-scan the target host using our scanner console to verify security status.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ticket success banner */}
                  {ticketSuccess && ticketSuccess.id === selectedFinding.id && (
                    <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#10b981" }}>
                      <CheckCircle2 size={16} /> 
                      <div>
                        Support Ticket <strong>{ticketSuccess.number}</strong> generated successfully! 
                        <a href={`/dashboard/tickets`} style={{ color: "#34d399", marginLeft: 6, fontWeight: 700, textDecoration: "underline" }}>View ITSM Queue</a>
                      </div>
                    </div>
                  )}

                  {/* Remediation Action footer */}
                  <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-primary)", paddingTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selectedFinding.ticketNumber ? (
                      <a href={`/dashboard/tickets`} className="btn btn-secondary" style={{ flex: 1, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", color: "#10b981", borderColor: "rgba(16,185,129,0.2)", fontSize: 12 }}>
                        <Ticket size={14} /> Ticket: {selectedFinding.ticketNumber}
                      </a>
                    ) : (
                      <button className="btn btn-primary" disabled={creatingTicket === selectedFinding.id} style={{ flex: 1, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12 }}
                        onClick={() => createTicketForFinding(selectedFinding)}>
                        {creatingTicket === selectedFinding.id ? (
                          <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                        ) : (
                          <Ticket size={14} />
                        )}
                        Generate ITSM Ticket
                      </button>
                    )}

                    <button className="btn btn-secondary" style={{ flex: 1, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12 }}
                      onClick={() => {
                        // Pre-populate target and scan type in console runner
                        setTarget(selectedFinding.target.split(":")[0]); // get IP only
                        if (selectedFinding.category === "SSL_RISK") setScanType("SSL");
                        else if (selectedFinding.category === "OPEN_PORT") setScanType("NMAP");
                        else setScanType("SSH");
                        
                        // Switch tabs and close drawer
                        setActiveTab("console");
                        setSelectedFinding(null);
                        
                        // Scroll to runner smooth
                        setTimeout(() => {
                          document.getElementById("scan-runner")?.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }}>
                      <Play size={14} style={{ color: "var(--brand-400)" }} /> Re-Scan Host
                    </button>

                    <button className="btn btn-secondary" style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12 }}
                      onClick={() => muteFinding(selectedFinding.id)}>
                      <XCircle size={14} style={{ color: selectedFinding.status === "MUTED" ? "#ef4444" : "inherit" }} />
                      {selectedFinding.status === "MUTED" ? "Unmute" : "Mute"}
                    </button>

                    {selectedFinding.status === "ACTIVE" && (
                      <button className="btn btn-secondary" style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#10b981", borderColor: "rgba(16,185,129,0.2)", fontSize: 12 }}
                        onClick={() => resolveFinding(selectedFinding.id)}>
                        <CheckCircle2 size={14} /> Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            </>
          )}
        </>
      )}

      {/* Embedded Animations styling block */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
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
