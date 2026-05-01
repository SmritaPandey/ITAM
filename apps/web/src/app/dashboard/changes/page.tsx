"use client";
import { useState, useEffect, useCallback } from "react";
import {
  GitBranch, Plus, RefreshCw, Filter, Calendar, Clock, CheckCircle2,
  AlertTriangle, XCircle, ArrowRight, RotateCcw, Loader2, X,
  ChevronRight, Send, ShieldCheck, Zap, Eye, FileText,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }
function apiFetch(path: string, opts?: any) {
  return fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...opts?.headers } }).then(r => r.json());
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; badge: string; icon: any; label: string }> = {
  DRAFT:        { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", badge: "gray", icon: <FileText size={12} />, label: "Draft" },
  SUBMITTED:    { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", badge: "blue", icon: <Send size={12} />, label: "Submitted" },
  APPROVED:     { color: "#10b981", bg: "rgba(16,185,129,0.12)", badge: "green", icon: <CheckCircle2 size={12} />, label: "Approved" },
  REJECTED:     { color: "#ef4444", bg: "rgba(239,68,68,0.12)", badge: "red", icon: <XCircle size={12} />, label: "Rejected" },
  IN_PROGRESS:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", badge: "amber", icon: <Loader2 size={12} />, label: "In Progress" },
  COMPLETED:    { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", badge: "purple", icon: <CheckCircle2 size={12} />, label: "Completed" },
  FAILED:       { color: "#ef4444", bg: "rgba(239,68,68,0.12)", badge: "red", icon: <XCircle size={12} />, label: "Failed" },
  ROLLED_BACK:  { color: "#f97316", bg: "rgba(249,115,22,0.12)", badge: "amber", icon: <RotateCcw size={12} />, label: "Rolled Back" },
  CANCELLED:    { color: "#64748b", bg: "rgba(100,116,139,0.12)", badge: "gray", icon: <XCircle size={12} />, label: "Cancelled" },
};

const PRIORITY_BADGE: Record<string, string> = { LOW: "green", MEDIUM: "amber", HIGH: "red", CRITICAL: "red" };
const TYPE_ICON: Record<string, any> = { STANDARD: <FileText size={13} />, NORMAL: <GitBranch size={13} />, EMERGENCY: <Zap size={13} /> };

const TRANSITIONS: Record<string, { label: string; to: string; color: string; bg: string }[]> = {
  DRAFT: [{ label: "Submit", to: "SUBMITTED", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" }],
  SUBMITTED: [
    { label: "Approve", to: "APPROVED", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { label: "Reject", to: "REJECTED", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  ],
  APPROVED: [{ label: "Implement", to: "IN_PROGRESS", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" }],
  IN_PROGRESS: [
    { label: "Complete", to: "COMPLETED", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    { label: "Rollback", to: "ROLLED_BACK", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    { label: "Failed", to: "FAILED", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  ],
};

export default function ChangesPage() {
  const [changes, setChanges] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [tab, setTab] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({ type: "NORMAL", priority: "MEDIUM", risk: "MEDIUM" });
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, cal] = await Promise.all([apiFetch("/changes"), apiFetch("/changes/stats"), apiFetch("/changes/calendar")]);
      setChanges(c); setStats(s); setCalendar(cal);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await apiFetch("/changes", { method: "POST", body: JSON.stringify(form) }); setShowCreate(false); setForm({ type: "NORMAL", priority: "MEDIUM", risk: "MEDIUM" }); load(); } catch(e) { alert(String(e)); }
    setSaving(false);
  };

  const transition = async (id: string, status: string) => {
    try { await apiFetch(`/changes/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }); load(); setSelected(null); } catch(e) { alert(String(e)); }
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)",
    background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", width: "100%",
  };

  const filtered = statusFilter ? changes.filter(c => c.status === statusFilter) : changes;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Change Management</h1>
          <p className="page-subtitle">ITIL change lifecycle — request, approve, implement, verify</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => load()}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New Change Request</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          {["DRAFT", "SUBMITTED", "APPROVED", "IN_PROGRESS", "COMPLETED"].map(s => {
            const count = stats.byStatus?.find((x: any) => x.status === s)?._count || 0;
            const sc = STATUS_CONFIG[s];
            return (
              <div key={s} className="stat-card" style={{ cursor: "pointer" }} onClick={() => { setStatusFilter(statusFilter === s ? "" : s); }}>
                <div className="stat-content">
                  <div className="stat-label">{sc.label}</div>
                  <div className="stat-value" style={{ color: sc.color }}>{count}</div>
                </div>
                <div style={{ color: sc.color, opacity: 0.5 }}>{sc.icon}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="card" style={{ marginBottom: 16, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["list", "calendar"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
              background: tab === t ? "rgba(6,182,212,0.15)" : "transparent",
              color: tab === t ? "#22d3ee" : "var(--text-secondary)",
            }}>{t === "list" ? <><GitBranch size={13} /> List</> : <><Calendar size={13} /> Calendar</>}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Filter size={13} style={{ color: "var(--text-tertiary)" }} />
          {["", "DRAFT", "SUBMITTED", "APPROVED", "IN_PROGRESS", "COMPLETED"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "3px 10px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: statusFilter === s ? "rgba(34,211,238,0.15)" : "rgba(100,116,139,0.08)",
              color: statusFilter === s ? "#22d3ee" : "var(--text-secondary)",
            }}>{s ? STATUS_CONFIG[s]?.label : "All"}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80, color: "var(--text-tertiary)" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          {/* ─── List View ─── */}
          {tab === "list" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Change #</th><th>Title</th><th>Type</th><th>Priority</th><th>Risk</th><th>Status</th><th>Scheduled</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.DRAFT;
                    const actions = TRANSITIONS[c.status] || [];
                    return (
                      <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setSelected(c)}>
                        <td>
                          <span style={{ fontWeight: 600, color: "var(--brand-400)", fontFamily: "monospace", fontSize: 12 }}>{c.changeNumber}</span>
                        </td>
                        <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{c.title}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: c.type === "EMERGENCY" ? "#ef4444" : "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
                            {TYPE_ICON[c.type]} {c.type}
                          </span>
                        </td>
                        <td><span className={`badge ${PRIORITY_BADGE[c.priority] || "gray"}`}>{c.priority}</span></td>
                        <td><span className={`badge ${PRIORITY_BADGE[c.risk] || "gray"}`}>{c.risk}</span></td>
                        <td>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
                            borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color,
                          }}>{sc.icon} {sc.label}</span>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {c.scheduledStart ? new Date(c.scheduledStart).toLocaleDateString() : "—"}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 3 }}>
                            {actions.map(a => (
                              <button key={a.to} onClick={() => transition(c.id, a.to)} style={{
                                padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10,
                                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                background: a.bg, color: a.color,
                              }}>{a.label}</button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                      No change requests {statusFilter ? `with status "${STATUS_CONFIG[statusFilter]?.label}"` : "yet"}.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Calendar View ─── */}
          {tab === "calendar" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {calendar.length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                  No scheduled changes
                </div>
              )}
              {calendar.map(c => {
                const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.DRAFT;
                return (
                  <div key={c.id} className="card" style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `3px solid ${sc.color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontWeight: 600, color: "var(--brand-400)", fontFamily: "monospace", fontSize: 12 }}>{c.changeNumber}</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: 13 }}>{c.title}</span>
                      <span className={`badge ${PRIORITY_BADGE[c.priority] || "gray"}`}>{c.priority}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <Calendar size={12} /> {c.scheduledStart ? new Date(c.scheduledStart).toLocaleString() : "—"}
                      </span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
                        borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color,
                      }}>{sc.icon} {sc.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Create Modal ─── */}
      {showCreate && (
        <>
          <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "var(--modal-overlay)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 560, maxHeight: "85vh", overflowY: "auto",
            background: "var(--bg-card)", border: "1px solid var(--border-primary)",
            borderRadius: 16, boxShadow: "var(--modal-shadow)", zIndex: 2001, padding: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New Change Request</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input required placeholder="Title *" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                  {["STANDARD", "NORMAL", "EMERGENCY"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inputStyle}>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={form.risk} onChange={e => setForm({ ...form, risk: e.target.value })} style={inputStyle}>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input placeholder="Category" value={form.category || ""} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle} />
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>Scheduled Start</label>
                  <input type="datetime-local" value={form.scheduledStart || ""} onChange={e => setForm({ ...form, scheduledStart: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <textarea placeholder="Description" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              <textarea placeholder="Impact Analysis" value={form.impactAnalysis || ""} onChange={e => setForm({ ...form, impactAnalysis: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <textarea placeholder="Rollback Plan" value={form.rollbackPlan || ""} onChange={e => setForm({ ...form, rollbackPlan: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                <textarea placeholder="Test Plan" value={form.testPlan || ""} onChange={e => setForm({ ...form, testPlan: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Submitting..." : "Submit Change"}</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ─── Detail Panel ─── */}
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "var(--modal-overlay)", zIndex: 2000, backdropFilter: "blur(2px)" }} />
          <div style={{
            position: "fixed", right: 0, top: 0, width: 460, height: "100vh",
            background: "var(--bg-secondary)", borderLeft: "1px solid var(--border-primary)",
            padding: 24, overflowY: "auto", zIndex: 2001,
            boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <span style={{ fontFamily: "monospace", color: "var(--brand-400)", fontWeight: 600, fontSize: 13 }}>{selected.changeNumber}</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{selected.title}</h2>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {selected.description && (
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>{selected.description}</p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                ["Type", selected.type, TYPE_ICON[selected.type]],
                ["Priority", selected.priority],
                ["Risk", selected.risk],
                ["Status", STATUS_CONFIG[selected.status]?.label || selected.status],
                ["Category", selected.category || "—"],
                ["Scheduled", selected.scheduledStart ? new Date(selected.scheduledStart).toLocaleString() : "—"],
              ].map(([k, v, icon]) => (
                <div key={String(k)} style={{ background: "var(--bg-card)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k as string}</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                    {icon} {v as string}
                  </div>
                </div>
              ))}
            </div>

            {selected.impactAnalysis && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Impact Analysis</div>
                <div style={{ background: "var(--bg-card)", borderRadius: 8, padding: 12, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{selected.impactAnalysis}</div>
              </div>
            )}
            {selected.rollbackPlan && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Rollback Plan</div>
                <div style={{ background: "var(--bg-card)", borderRadius: 8, padding: 12, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{selected.rollbackPlan}</div>
              </div>
            )}

            {(TRANSITIONS[selected.status] || []).length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
                {(TRANSITIONS[selected.status] || []).map(a => (
                  <button key={a.to} onClick={() => transition(selected.id, a.to)} className="btn" style={{ background: a.bg, color: a.color, fontSize: 12 }}>
                    {a.label} <ArrowRight size={12} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
