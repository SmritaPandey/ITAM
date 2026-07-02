"use client";
import { useEffect, useState } from "react";
import {
  Shield, CheckCircle2, XCircle, Clock, AlertTriangle, Download,
  Play, Search, Eye, RefreshCw, Loader2, Scan, Rocket, BarChart3,
  Calendar, RotateCcw, CalendarClock, Timer,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { apiFetch } from "@/lib/api";
import SafeChart from "@/components/SafeChart";

const SEV_COLORS: Record<string, string> = { Critical: "red", High: "amber", Medium: "purple", Low: "gray" };
const STATUS_COLORS: Record<string, string> = { Deployed: "green", Pending: "amber", Scheduled: "cyan", Failed: "red" };

export default function PatchesPage() {
  const [apiData, setApiData] = useState<any>({ data: [], total: 0, deployed: 0, pending: 0, failed: 0, critical: 0, compliance: 100 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [sevFilter, setSevFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPatch, setSelectedPatch] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [deploying, setDeploying] = useState(false);
  const [complianceTimeline, setComplianceTimeline] = useState<any[]>([]);
  const [scheduleModal, setScheduleModal] = useState<any>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedEnd, setSchedEnd] = useState("");
  const [schedRecurring, setSchedRecurring] = useState("");
  const [rollingBack, setRollingBack] = useState(false);
  const [upcomingSchedules, setUpcomingSchedules] = useState<any[]>([]);

  function refresh() {
    apiFetch("/patches").then(setApiData).catch(console.error).finally(() => setLoading(false));
    apiFetch("/patches/compliance/history").then(d => {
      setComplianceTimeline(d.timeline || []);
    }).catch(() => {});
    apiFetch("/patches/schedules/upcoming").then(setUpcomingSchedules).catch(() => {});
  }
  useEffect(() => { refresh(); }, []);

  const patches = apiData.data || [];

  const filtered = patches.filter((p: any) => {
    if (filter && !p.title.toLowerCase().includes(filter.toLowerCase()) && !p.patchId.toLowerCase().includes(filter.toLowerCase())) return false;
    if (sevFilter && p.severity !== sevFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  // Build category data from API
  const catMap: Record<string, number> = {};
  patches.forEach((p: any) => { catMap[p.category] = (catMap[p.category] || 0) + 1; });
  const catColors = ["#ef4444", "#8b5cf6", "#3b82f6", "#06b6d4", "#f59e0b", "#10b981", "#64748b"];
  const categoryData = Object.entries(catMap).map(([name, value], i) => ({ name, value, color: catColors[i % catColors.length] }));

  async function deployPatch(id: string) {
    await apiFetch(`/patches/${id}/deploy`, { method: "POST" });
    setSelectedPatch(null);
    refresh();
  }

  async function runScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await apiFetch("/patches/scan", { method: "POST" });
      setScanResult(result);
      refresh();
    } catch (err) {
      setScanResult({ error: "Scan failed" });
    } finally {
      setScanning(false);
    }
  }

  async function deployAll() {
    setDeploying(true);
    try {
      const result = await apiFetch("/patches/deploy-all", { method: "POST" });
      setScanResult({ message: `Deployed ${result.deployed} patches, ${result.failed} failed` });
      refresh();
    } catch {
      setScanResult({ error: "Deploy all failed" });
    } finally {
      setDeploying(false);
    }
  }

  async function schedulePatch(id: string) {
    if (!schedDate) return;
    try {
      await apiFetch(`/patches/${id}/schedule`, {
        method: "POST",
        body: JSON.stringify({
          scheduledAt: schedDate,
          maintenanceEnd: schedEnd || undefined,
          recurring: schedRecurring || undefined,
        }),
      });
      setScheduleModal(null);
      setSchedDate(""); setSchedEnd(""); setSchedRecurring("");
      setScanResult({ message: "Patch scheduled successfully" });
      refresh();
    } catch {
      setScanResult({ error: "Failed to schedule patch" });
    }
  }

  async function rollbackPatch(id: string) {
    if (!confirm("Are you sure you want to rollback this patch? Agents will reverse the installation on next heartbeat.")) return;
    setRollingBack(true);
    try {
      await apiFetch(`/patches/${id}/rollback`, { method: "POST" });
      setSelectedPatch(null);
      setScanResult({ message: "Patch rollback queued — agents will reverse on next heartbeat" });
      refresh();
    } catch {
      setScanResult({ error: "Rollback failed" });
    } finally {
      setRollingBack(false);
    }
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
          <h1 className="page-title">Patch Management</h1>
          <p className="page-subtitle">{apiData.total} patches tracked • {apiData.compliance}% compliance</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={runScan} disabled={scanning}>
            {scanning ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Scanning...</> : <><Scan size={14} /> Scan Now</>}
          </button>
          <button className="btn btn-primary" onClick={deployAll} disabled={deploying || apiData.pending === 0}>
            {deploying ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Deploying...</> : <><Rocket size={14} /> Deploy All Pending ({apiData.pending})</>}
          </button>
        </div>
      </div>

      {/* Scan Result Banner */}
      {scanResult && (
        <div className="card" style={{
          marginBottom: 16, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
          border: scanResult.error ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(16,185,129,0.3)",
          background: scanResult.error ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
        }}>
          <div>
            {scanResult.error ? (
              <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}><AlertTriangle size={14} style={{ verticalAlign: "middle" }} /> {scanResult.error}</span>
            ) : scanResult.message ? (
              <span style={{ color: "#10b981", fontSize: 13, fontWeight: 600 }}><CheckCircle2 size={14} style={{ verticalAlign: "middle" }} /> {scanResult.message}</span>
            ) : (
              <span style={{ color: "#10b981", fontSize: 13, fontWeight: 600 }}>
                <CheckCircle2 size={14} style={{ verticalAlign: "middle" }} />{" "}
                Scan complete on {scanResult.platform} — {scanResult.totalFound} patches found, {scanResult.created} new, {scanResult.updated} updated
              </span>
            )}
          </div>
          <button onClick={() => setScanResult(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={22} /></div><div className="stat-content"><div className="stat-label">Deployed</div><div className="stat-value">{apiData.deployed}</div></div></div>
        <div className="stat-card"><div className="stat-icon amber"><Clock size={22} /></div><div className="stat-content"><div className="stat-label">Pending</div><div className="stat-value">{apiData.pending}</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={22} /></div><div className="stat-content"><div className="stat-label">Failed</div><div className="stat-value">{apiData.failed}</div></div></div>
        <div className="stat-card"><div className="stat-icon cyan"><Shield size={22} /></div><div className="stat-content"><div className="stat-label">Critical Missing</div><div className="stat-value">{apiData.critical}</div></div></div>
      </div>

      {/* Charts Row */}
      <div className="charts-grid-equal" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">Compliance Trend (8 Weeks)</div></div>
          {complianceTimeline.length > 0 ? (
            <SafeChart height={200}>
              <AreaChart data={complianceTimeline}>
                <defs>
                  <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="rate" stroke="#10b981" fill="url(#compGrad)" strokeWidth={2} name="Compliance %" />
              </AreaChart>
            </SafeChart>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
              <BarChart3 size={16} style={{ marginRight: 6 }} /> Run a scan to populate compliance data
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Patches by Category</div></div>
          {categoryData.length > 0 ? (
            <SafeChart height={200}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {categoryData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </SafeChart>
          ) : (
            <div style={{ height: 200, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No patch data yet</div>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {categoryData.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-secondary)" }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: d.color, display: "inline-block" }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "10px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <Search size={14} style={{ color: "var(--text-tertiary)" }} />
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search patches..."
          style={{ flex: 1, background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
          style={{ padding: "4px 8px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 11 }}>
          <option value="">All Severity</option>
          <option value="Critical">Critical</option><option value="High">High</option>
          <option value="Medium">Medium</option><option value="Low">Low</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: "4px 8px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 11 }}>
          <option value="">All Status</option>
          <option value="Deployed">Deployed</option><option value="Pending">Pending</option>
          <option value="Scheduled">Scheduled</option><option value="Failed">Failed</option>
        </select>
      </div>

      {/* Patch Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr><th>Patch ID</th><th>Title</th><th>Category</th><th>Severity</th><th>Status</th><th>Assets</th><th>Source</th><th>Deployed</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                {patches.length === 0 ? <>No patches yet. Click "Scan Now" to discover available updates.</> : <>No patches match filters.</>}
              </td></tr>
            ) : filtered.map((p: any) => (
              <tr key={p.id} onClick={() => setSelectedPatch(p)} style={{ cursor: "pointer" }}>
                <td><code style={{ fontSize: 11, color: "var(--brand-400)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4 }}>{p.patchId}</code></td>
                <td style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>{p.title}</td>
                <td><span className="badge gray" style={{ fontSize: 10 }}>{p.category}</span></td>
                <td><span className={`badge ${SEV_COLORS[p.severity]}`}>{p.severity}</span></td>
                <td><span className={`badge ${STATUS_COLORS[p.status]}`}>{p.status}</span></td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.affectedAssets}</td>
                <td style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{p.scanSource || "MANUAL"}</td>
                <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{p.deployedDate ? new Date(p.deployedDate).toLocaleDateString() : "—"}</td>
                <td><button className="btn btn-secondary" style={{ padding: "3px 8px" }}><Eye size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {selectedPatch && (
        <>
          <div onClick={() => setSelectedPatch(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 420, background: "var(--bg-card)", zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selectedPatch.patchId}</h2>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{selectedPatch.title}</p>
              </div>
              <button onClick={() => setSelectedPatch(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              <div style={{ display: "grid", gap: 14 }}>
                <Row label="Severity" value={<span className={`badge ${SEV_COLORS[selectedPatch.severity]}`}>{selectedPatch.severity}</span>} />
                <Row label="Status" value={<span className={`badge ${STATUS_COLORS[selectedPatch.status]}`}>{selectedPatch.status}</span>} />
                <Row label="Category" value={selectedPatch.category} />
                <Row label="Affected Assets" value={selectedPatch.affectedAssets} />
                <Row label="Scan Source" value={selectedPatch.scanSource || "Manual"} />
                <Row label="Last Scan" value={selectedPatch.lastScanAt ? new Date(selectedPatch.lastScanAt).toLocaleString() : "Never"} />
                <Row label="Deployed Date" value={selectedPatch.deployedDate ? new Date(selectedPatch.deployedDate).toLocaleDateString() : "Not deployed"} />
                {selectedPatch.scheduledAt && <Row label="Scheduled For" value={new Date(selectedPatch.scheduledAt).toLocaleString()} />}
                {selectedPatch.maintenanceEnd && <Row label="Window Ends" value={new Date(selectedPatch.maintenanceEnd).toLocaleString()} />}
                {selectedPatch.rolledBackAt && <Row label="Rolled Back" value={new Date(selectedPatch.rolledBackAt).toLocaleString()} />}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "grid", gap: 8, marginTop: 20 }}>
                {selectedPatch.status !== "Deployed" && selectedPatch.status !== "Scheduled" && (
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => deployPatch(selectedPatch.id)}>
                    <Play size={14} /> Deploy Now
                  </button>
                )}
                {selectedPatch.status !== "Deployed" && selectedPatch.status !== "Scheduled" && (
                  <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => { setScheduleModal(selectedPatch); setSelectedPatch(null); }}>
                    <CalendarClock size={14} /> Schedule Deployment Window
                  </button>
                )}
                {(selectedPatch.status === "Deployed" || selectedPatch.status === "PENDING_DEPLOYMENT") && (
                  <button className="btn btn-secondary" style={{ width: "100%", color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)" }} onClick={() => rollbackPatch(selectedPatch.id)} disabled={rollingBack}>
                    {rollingBack ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Rolling back...</> : <><RotateCcw size={14} /> Rollback Patch</>}
                  </button>
                )}
              </div>
            </div>
          </div>
          <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        </>
      )}
      {/* Schedule Deployment Window Modal */}
      {scheduleModal && (
        <>
          <div onClick={() => setScheduleModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 460, background: "var(--bg-card)", zIndex: 1001, borderRadius: 12, border: "1px solid var(--border-primary)", padding: 24, animation: "fadeIn 0.2s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}><CalendarClock size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />Schedule Deployment</h2>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "4px 0 0" }}>{scheduleModal.patchId} — {scheduleModal.title}</p>
              </div>
              <button onClick={() => setScheduleModal(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Deploy At *</label>
                <input type="datetime-local" value={schedDate} onChange={e => setSchedDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13 }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Maintenance Window Ends</label>
                <input type="datetime-local" value={schedEnd} onChange={e => setSchedEnd(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13 }} />
                <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: "4px 0 0" }}>If the patch misses this window, it will be marked as Failed</p>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Recurring</label>
                <select value={schedRecurring} onChange={e => setSchedRecurring(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13 }}>
                  <option value="">One-time deployment</option>
                  <option value="weekly">Weekly (same day & time)</option>
                  <option value="monthly">Monthly (same date & time)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setScheduleModal(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={!schedDate} onClick={() => schedulePatch(scheduleModal.id)}>
                  <Calendar size={14} /> Schedule
                </button>
              </div>
            </div>
          </div>
          <style>{`@keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }`}</style>
        </>
      )}

      {/* Upcoming Scheduled Deployments */}
      {upcomingSchedules.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <Timer size={14} style={{ color: "var(--brand-400)" }} /> Upcoming Scheduled Deployments ({upcomingSchedules.length})
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {upcomingSchedules.slice(0, 5).map((s: any) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{s.patchId}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 8 }}>{s.title}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="badge cyan" style={{ fontSize: 10 }}>
                    <Clock size={10} /> {new Date(s.scheduledAt).toLocaleString()}
                  </span>
                  {s.recurring && <span className="badge purple" style={{ fontSize: 10 }}>{s.recurring}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
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
