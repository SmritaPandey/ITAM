"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Clock, Eye, RefreshCw,
  Plus, Loader2, ChevronDown, Filter, Activity, Cpu, HardDrive,
  Wifi, Usb, Package, Lock, Trash2, Power, Scan, Server
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PageHelp } from "@/components/HelpSystem";

const SEVERITY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", badge: "red" },
  WARNING: { bg: "rgba(245,158,11,0.08)", text: "#f59e0b", badge: "amber" },
  INFO: { bg: "rgba(6,182,212,0.08)", text: "#06b6d4", badge: "cyan" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  PENDING_REVIEW: { bg: "rgba(245,158,11,0.08)", text: "#f59e0b", badge: "amber" },
  APPROVED: { bg: "rgba(16,185,129,0.08)", text: "#10b981", badge: "green" },
  REJECTED: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", badge: "red" },
  AUTO_ALLOWED: { bg: "rgba(100,116,139,0.08)", text: "#64748b", badge: "gray" },
  VIOLATION: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", badge: "red" },
};

const CATEGORY_ICONS: Record<string, any> = {
  RAM_CHANGE: <Cpu size={14} />, DISK_CHANGE: <HardDrive size={14} />,
  HARDWARE_CHANGE: <Activity size={14} />, NETWORK_CHANGE: <Wifi size={14} />,
  USB_DEVICE: <Usb size={14} />, SOFTWARE_INSTALL: <Package size={14} />,
  SOFTWARE_REMOVE: <Trash2 size={14} />, PROCESS_BLOCKED: <Lock size={14} />,
};

const ACTION_LABELS: Record<string, string> = {
  ALERT_ONLY: "Alert Only", REQUIRE_APPROVAL: "Require Approval", AUTO_BLOCK: "Auto Block",
};

export default function CompliancePage() {
  const [tab, setTab] = useState<"overview" | "changes" | "policies" | "agentless">("overview");
  const [dashboard, setDashboard] = useState<any>(null);
  const [changes, setChanges] = useState<any>({ data: [], total: 0 });
  const [policies, setPolicies] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ name: "", description: "", category: "RAM_CHANGE", severity: "WARNING", action: "ALERT_ONLY" });
  const [reviewModal, setReviewModal] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [scanTarget, setScanTarget] = useState("");
  const [scanUser, setScanUser] = useState("");
  const [scanPass, setScanPass] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [selectedCred, setSelectedCred] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [d, c, p, t] = await Promise.all([
        apiFetch("/compliance/dashboard"),
        apiFetch(`/compliance/changes?limit=50${statusFilter ? `&status=${statusFilter}` : ""}`),
        apiFetch("/compliance/policies"),
        apiFetch("/compliance/policies/templates"),
      ]);
      setDashboard(d); setChanges(c); setPolicies(p); setTemplates(t);
      // Fetch credential vault for agentless tab
      try { const creds = await apiFetch("/discovery/credentials"); setCredentials(Array.isArray(creds) ? creds : creds.data || []); } catch {}
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  async function seedPolicies() {
    await apiFetch("/compliance/policies/seed", { method: "POST" });
    refresh();
  }

  async function createPolicy() {
    await apiFetch("/compliance/policies", { method: "POST", body: JSON.stringify(newPolicy) });
    setShowCreate(false);
    setNewPolicy({ name: "", description: "", category: "RAM_CHANGE", severity: "WARNING", action: "ALERT_ONLY" });
    refresh();
  }

  async function togglePolicy(id: string, isActive: boolean) {
    await apiFetch(`/compliance/policies/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) });
    refresh();
  }

  async function deletePolicy(id: string) {
    await apiFetch(`/compliance/policies/${id}`, { method: "DELETE" });
    refresh();
  }

  async function approveChange(id: string) {
    await apiFetch(`/compliance/changes/${id}/approve`, { method: "PATCH", body: JSON.stringify({ note: reviewNote }) });
    setReviewModal(null); setReviewNote(""); refresh();
  }

  async function rejectChange(id: string) {
    await apiFetch(`/compliance/changes/${id}/reject`, { method: "PATCH", body: JSON.stringify({ note: reviewNote }) });
    setReviewModal(null); setReviewNote(""); refresh();
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const score = dashboard?.complianceScore ?? 100;
  const scoreColor = score >= 90 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Endpoint Compliance</h1>
          <p className="page-subtitle">Monitor hardware changes, enforce policies, approve or reject endpoint modifications</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { setLoading(true); refresh(); }}><RefreshCw size={14} /></button>
          {policies.length === 0 && (
            <button className="btn btn-primary" onClick={seedPolicies}><Shield size={14} /> Setup Default Policies</button>
          )}
        </div>
      </div>

      <PageHelp id="compliance" title="Endpoint Compliance Engine">
        This module monitors all agent-managed endpoints for unauthorized changes. When the agent reports a heartbeat, the server compares the new snapshot against the previous baseline. Any detected change (RAM, USB, software, network) is matched against your <strong>policies</strong>. Changes requiring approval appear in the <strong>Pending</strong> queue. Start by clicking <strong>Setup Default Policies</strong> to load 6 pre-built templates.
      </PageHelp>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["overview", "changes", "policies", "agentless"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 12, padding: "6px 16px", textTransform: "capitalize" }}>
            {t === "overview" ? <Activity size={12} /> : t === "changes" ? <Eye size={12} /> : t === "agentless" ? <Scan size={12} /> : <Shield size={12} />}
            {t === "agentless" ? "Agentless Scan" : t}
          </button>
        ))}
      </div>

      {/* ════════ OVERVIEW TAB ════════ */}
      {tab === "overview" && dashboard && (
        <>
          {/* Empty state when no agents */}
          {dashboard.agentCount === 0 && dashboard.total === 0 && (
            <div className="card" style={{ padding: 48, textAlign: "center", marginBottom: 20 }}>
              <Shield size={48} style={{ margin: "0 auto 16px", color: "var(--brand-400)", opacity: 0.6 }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No Endpoints Monitored Yet</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 520, margin: "0 auto 20px" }}>
                Deploy the <strong>QS Asset Agent</strong> on staff machines or use the <strong>Agentless Scan</strong> tab to SSH into servers.
                Once endpoints report in, the compliance engine will automatically detect unauthorized changes and enforce your policies.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="btn btn-primary" onClick={() => setTab("agentless")}><Scan size={14} /> Run Agentless Scan</button>
                <button className="btn btn-secondary" onClick={() => setTab("policies")}><Shield size={14} /> Configure Policies</button>
              </div>
            </div>
          )}

          {/* Score + Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, marginBottom: 20 }}>
            {/* Compliance Score Gauge */}
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ position: "relative", width: 120, height: 120 }}>
                <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke={dashboard.agentCount === 0 ? "var(--text-tertiary)" : scoreColor} strokeWidth="3"
                    strokeDasharray={`${dashboard.agentCount === 0 ? 0 : score}, 100`} strokeLinecap="round" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: dashboard.agentCount === 0 ? "var(--text-tertiary)" : scoreColor }}>
                    {dashboard.agentCount === 0 ? "—" : `${score}%`}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>Compliance Score</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                {dashboard.agentCount === 0 ? "No agents yet" : `${dashboard.compliantAgents}/${dashboard.agentCount} agents clean`}
              </div>
            </div>

            {/* Stat Cards */}
            <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setTab("changes")}>
                <div className="stat-content">
                  <div className="stat-label">Total Changes</div>
                  <div className="stat-value">{dashboard.total}</div>
                </div>
                <Activity size={18} style={{ color: "var(--brand-400)" }} />
              </div>
              <div className="stat-card" style={{ borderLeft: "3px solid #f59e0b", cursor: "pointer" }} onClick={() => { setStatusFilter("PENDING_REVIEW"); setTab("changes"); }}>
                <div className="stat-content">
                  <div className="stat-label">Pending Review</div>
                  <div className="stat-value" style={{ color: "#f59e0b" }}>{dashboard.pending}</div>
                </div>
                <Clock size={18} style={{ color: "#f59e0b" }} />
              </div>
              <div className="stat-card" style={{ borderLeft: "3px solid #ef4444", cursor: "pointer" }} onClick={() => { setStatusFilter("VIOLATION"); setTab("changes"); }}>
                <div className="stat-content">
                  <div className="stat-label">Violations</div>
                  <div className="stat-value" style={{ color: "#ef4444" }}>{dashboard.violations}</div>
                </div>
                <AlertTriangle size={18} style={{ color: "#ef4444" }} />
              </div>
              <div className="stat-card" style={{ borderLeft: "3px solid #10b981", cursor: "pointer" }} onClick={() => setTab("policies")}>
                <div className="stat-content">
                  <div className="stat-label">Active Policies</div>
                  <div className="stat-value" style={{ color: "#10b981" }}>{dashboard.activePolicies}</div>
                </div>
                <Shield size={18} style={{ color: "#10b981" }} />
              </div>
            </div>
          </div>

          {/* Recent Changes */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Recent Changes</h3>
              <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setTab("changes")}>View All</button>
            </div>
            {dashboard.recentChanges?.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
                <Shield size={36} style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No changes detected yet</div>
                <p style={{ fontSize: 12 }}>Deploy the QS Asset agent on endpoints to start monitoring</p>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Change</th><th>Hostname</th><th>Severity</th><th>Status</th><th>Time</th></tr></thead>
                <tbody>
                  {dashboard.recentChanges?.map((c: any) => (
                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => { setStatusFilter(""); setTab("changes"); }}>
                      <td><span style={{ display: "flex", alignItems: "center", gap: 6 }}>{CATEGORY_ICONS[c.category] || <Activity size={14} />}{c.summary}</span></td>
                      <td style={{ fontWeight: 500 }}>{c.hostname || "—"}</td>
                      <td><span className={`badge ${SEVERITY_COLORS[c.severity]?.badge || "gray"}`}>{c.severity}</span></td>
                      <td><span className={`badge ${STATUS_COLORS[c.status]?.badge || "gray"}`}>{c.status.replace("_", " ")}</span></td>
                      <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{new Date(c.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ════════ CHANGES TAB ════════ */}
      {tab === "changes" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {["", "PENDING_REVIEW", "APPROVED", "REJECTED", "VIOLATION", "AUTO_ALLOWED"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`btn ${statusFilter === s ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: 11, padding: "5px 12px" }}>
                {s ? s.replace("_", " ") : "All"}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead><tr><th>Change</th><th>Host</th><th>IP</th><th>Severity</th><th>Policy</th><th>Status</th><th>Time</th><th>Actions</th></tr></thead>
              <tbody>
                {changes.data?.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No changes found</td></tr>
                ) : changes.data?.map((c: any) => (
                  <tr key={c.id}>
                    <td><span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>{CATEGORY_ICONS[c.category]}{c.summary}</span></td>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{c.hostname || "—"}</td>
                    <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{c.ipAddress || "—"}</code></td>
                    <td><span className={`badge ${SEVERITY_COLORS[c.severity]?.badge}`}>{c.severity}</span></td>
                    <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.policy?.name || "—"}</td>
                    <td><span className={`badge ${STATUS_COLORS[c.status]?.badge}`}>{c.status.replace(/_/g, " ")}</span></td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{new Date(c.createdAt).toLocaleString()}</td>
                    <td>
                      {c.status === "PENDING_REVIEW" && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, color: "#10b981" }}
                            onClick={() => { setReviewModal(c); setReviewNote(""); }}>
                            <CheckCircle2 size={10} /> Approve
                          </button>
                          <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, color: "#ef4444" }}
                            onClick={() => { setReviewModal({ ...c, _reject: true }); setReviewNote(""); }}>
                            <XCircle size={10} /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ════════ POLICIES TAB ════════ */}
      {tab === "policies" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{policies.length} policies configured</div>
            <div style={{ display: "flex", gap: 8 }}>
              {policies.length === 0 && <button className="btn btn-secondary" onClick={seedPolicies} style={{ fontSize: 12 }}><Shield size={12} /> Load Templates</button>}
              <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: 12 }}><Plus size={12} /> Create Policy</button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {policies.map((p: any) => (
              <div key={p.id} className="card" style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: p.isActive ? 1 : 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: SEVERITY_COLORS[p.severity]?.bg || "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {CATEGORY_ICONS[p.category] || <Shield size={16} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{p.description || p.category}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge ${SEVERITY_COLORS[p.severity]?.badge}`} style={{ fontSize: 10 }}>{p.severity}</span>
                  <span className="badge cyan" style={{ fontSize: 10 }}>{ACTION_LABELS[p.action] || p.action}</span>
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{p._count?.changes || 0} triggers</span>
                  <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                    onClick={() => togglePolicy(p.id, p.isActive)}>
                    <Power size={10} /> {p.isActive ? "Disable" : "Enable"}
                  </button>
                  {!p.isSystem && (
                    <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, color: "#ef4444" }}
                      onClick={() => deletePolicy(p.id)}>
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ════════ REVIEW MODAL ════════ */}
      {reviewModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setReviewModal(null)}>
          <div style={{ width: 480, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-primary)", padding: 24 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              {reviewModal._reject ? "Reject Change" : "Approve Change"}
            </h3>
            <div className="card" style={{ padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{reviewModal.summary}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {reviewModal.hostname} • {reviewModal.ipAddress} • {new Date(reviewModal.createdAt).toLocaleString()}
              </div>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Review Note (optional)</label>
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={3}
              placeholder="Add a note explaining your decision..."
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setReviewModal(null)}>Cancel</button>
              {reviewModal._reject ? (
                <button className="btn btn-primary" style={{ background: "#ef4444" }} onClick={() => rejectChange(reviewModal.id)}>
                  <XCircle size={14} /> Reject
                </button>
              ) : (
                <button className="btn btn-primary" style={{ background: "#10b981" }} onClick={() => approveChange(reviewModal.id)}>
                  <CheckCircle2 size={14} /> Approve
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════ CREATE POLICY MODAL ════════ */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowCreate(false)}>
          <div style={{ width: 500, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-primary)", padding: 24 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Create Endpoint Policy</h3>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Name</label>
                <input value={newPolicy.name} onChange={e => setNewPolicy({ ...newPolicy, name: e.target.value })}
                  placeholder="e.g., Block Unauthorized RAM"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Description</label>
                <input value={newPolicy.description} onChange={e => setNewPolicy({ ...newPolicy, description: e.target.value })}
                  placeholder="Describe what this policy does"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Category</label>
                  <select value={newPolicy.category} onChange={e => setNewPolicy({ ...newPolicy, category: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12 }}>
                    {Object.keys(CATEGORY_ICONS).map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Severity</label>
                  <select value={newPolicy.severity} onChange={e => setNewPolicy({ ...newPolicy, severity: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12 }}>
                    <option value="INFO">Info</option><option value="WARNING">Warning</option><option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Action</label>
                  <select value={newPolicy.action} onChange={e => setNewPolicy({ ...newPolicy, action: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12 }}>
                    <option value="ALERT_ONLY">Alert Only</option><option value="REQUIRE_APPROVAL">Require Approval</option><option value="AUTO_BLOCK">Auto Block</option>
                  </select>
                </div>
              </div>
              {templates.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Or use a template:</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {templates.map((t: any, i: number) => (
                      <button key={i} className="btn btn-secondary" style={{ fontSize: 10, padding: "4px 10px" }}
                        onClick={() => setNewPolicy({ ...newPolicy, name: t.name, description: t.description, category: t.category, severity: t.severity, action: t.action })}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createPolicy} disabled={!newPolicy.name}>
                <Plus size={14} /> Create Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ AGENTLESS SCAN TAB ════════ */}
      {tab === "agentless" && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Server size={18} style={{ color: "var(--brand-400)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Agentless Compliance Scan</h3>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
              Scan remote endpoints via SSH without deploying an agent. The server connects to the target,
              collects system info (CPU, RAM, disks, services, firewall), and evaluates it against your
              compliance policies — the same way agent heartbeats work.
            </p>
            {credentials.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Use Saved Credentials</label>
                <select value={selectedCred} onChange={e => {
                  setSelectedCred(e.target.value);
                  if (e.target.value) {
                    const c = credentials.find((cr: any) => cr.id === e.target.value);
                    if (c) { setScanUser(c.username || ""); setScanPass(""); }
                  }
                }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12 }}>
                  <option value="">— Enter manually —</option>
                  {credentials.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Target IP(s)</label>
                <input value={scanTarget} onChange={e => setScanTarget(e.target.value)}
                  placeholder="192.168.1.10 or 10.0.0.5, 10.0.0.6"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12 }} />
                <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Comma-separated for batch scan</span>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>SSH Username</label>
                <input value={scanUser} onChange={e => setScanUser(e.target.value)}
                  placeholder="root or admin"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>SSH Password</label>
                <input type="password" value={scanPass} onChange={e => setScanPass(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12 }} />
              </div>
            </div>
            <button className="btn btn-primary" disabled={!scanTarget || !scanUser || scanning}
              onClick={async () => {
                setScanning(true); setScanResult(null);
                try {
                  const targets = scanTarget.split(",").map(t => t.trim()).filter(Boolean);
                  if (targets.length === 1) {
                    const res = await apiFetch("/compliance/agentless/scan", { method: "POST", body: JSON.stringify({ target: targets[0], username: scanUser, password: scanPass }) });
                    setScanResult(res);
                  } else {
                    const res = await apiFetch("/compliance/agentless/batch", { method: "POST", body: JSON.stringify({ targets, username: scanUser, password: scanPass }) });
                    setScanResult(res);
                  }
                  refresh();
                } catch (e: any) { setScanResult({ success: false, error: e.message }); }
                finally { setScanning(false); }
              }}>
              {scanning ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Scanning...</> : <><Scan size={14} /> Run Compliance Scan</>}
            </button>
          </div>

          {scanResult && (
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Scan Results</h3>
              {scanResult.results ? (
                /* Batch results */
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                    <span className="badge green">{scanResult.successful} successful</span>
                    {scanResult.failed > 0 && <span className="badge red">{scanResult.failed} failed</span>}
                  </div>
                  {scanResult.results.map((r: any, i: number) => (
                    <div key={i} className="card" style={{ padding: 12, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{r.hostname || r.target}</span>
                          <code style={{ fontSize: 11, marginLeft: 8, color: "var(--brand-400)" }}>{r.target}</code>
                          {r.mode && <span className="badge cyan" style={{ fontSize: 9, marginLeft: 6 }}>{r.mode}</span>}
                        </div>
                        {r.success ? (
                          <span className="badge green">{r.changesDetected} change{r.changesDetected !== 1 ? "s" : ""}</span>
                        ) : (
                          <span className="badge red">Failed: {r.error}</span>
                        )}
                      </div>
                      {r.snapshot && (
                        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>
                          <span>CPU: {r.snapshot.cores} cores</span>
                          <span>RAM: {Math.round(r.snapshot.ramMb / 1024)}GB</span>
                          <span>Disks: {r.snapshot.disks}</span>
                          <span>Services: {r.snapshot.services}</span>
                          <span>Firewall: {r.snapshot.firewall ? "✅" : "❌"}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : scanResult.success ? (
                /* Single result */
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{scanResult.hostname}</span>
                      <code style={{ fontSize: 11, marginLeft: 8, color: "var(--brand-400)" }}>{scanResult.target}</code>
                      <span className="badge cyan" style={{ fontSize: 9, marginLeft: 6 }}>agentless</span>
                    </div>
                    <span className="badge green">{scanResult.changesDetected} change{scanResult.changesDetected !== 1 ? "s" : ""} detected</span>
                  </div>
                  {scanResult.snapshot && (
                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-secondary)" }}>
                      <span>CPU: {scanResult.snapshot.cores} cores</span>
                      <span>RAM: {Math.round(scanResult.snapshot.ramMb / 1024)}GB</span>
                      <span>Disks: {scanResult.snapshot.disks}</span>
                      <span>Services: {scanResult.snapshot.services}</span>
                      <span>Firewall: {scanResult.snapshot.firewall ? "✅" : "❌"}</span>
                    </div>
                  )}
                  {scanResult.changes?.length > 0 && (
                    <div style={{ marginTop: 10, borderTop: "1px solid var(--border-primary)", paddingTop: 10 }}>
                      {scanResult.changes.map((c: any) => (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                          <span>{c.summary}</span>
                          <span className={`badge ${SEVERITY_COLORS[c.severity]?.badge}`}>{c.severity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="card" style={{ padding: 12, background: "rgba(239,68,68,0.06)" }}>
                  <span style={{ color: "#ef4444", fontWeight: 600 }}>Scan failed: {scanResult.error}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
