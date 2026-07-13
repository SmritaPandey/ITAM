"use client";
import { useState, useEffect, useCallback } from "react";
import {
  GitBranch, Plus, RefreshCw, Filter, Calendar, Clock, CheckCircle2,
  AlertTriangle, XCircle, ArrowRight, RotateCcw, Loader2, X,
  ChevronRight, Send, ShieldCheck, Zap, Eye, FileText, Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_CONFIG: Record<string, { color: string; bg: string; badge: string; icon: any; label: string }> = {
  DRAFT:        { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", badge: "gray", icon: <FileText size={12} />, label: "Draft" },
  SUBMITTED:    { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", badge: "blue", icon: <Send size={12} />, label: "Submitted" },
  CAB_REVIEW:   { color: "#a855f7", bg: "rgba(168,85,247,0.12)", badge: "purple", icon: <ShieldCheck size={12} />, label: "CAB Review" },
  APPROVED:     { color: "#10b981", bg: "rgba(16,185,129,0.12)", badge: "green", icon: <CheckCircle2 size={12} />, label: "Approved" },
  REJECTED:     { color: "#ef4444", bg: "rgba(239,68,68,0.12)", badge: "red", icon: <XCircle size={12} />, label: "Rejected" },
  IN_PROGRESS:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", badge: "amber", icon: <Loader2 size={12} />, label: "In Progress" },
  COMPLETED:    { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", badge: "purple", icon: <CheckCircle2 size={12} />, label: "Completed" },
  FAILED:       { color: "#ef4444", bg: "rgba(239,68,68,0.12)", badge: "red", icon: <XCircle size={12} />, label: "Failed" },
  ROLLED_BACK:  { color: "#f97316", bg: "rgba(249,115,22,0.12)", badge: "amber", icon: <RotateCcw size={12} />, label: "Rolled Back" },
  CANCELLED:    { color: "#64748b", bg: "rgba(100,116,139,0.12)", badge: "gray", icon: <XCircle size={12} />, label: "Cancelled" },
};

const PRIORITY_BADGE: Record<string, string> = { LOW: "green", MEDIUM: "amber", HIGH: "red", CRITICAL: "red" };
const TYPE_ICON: Record<string, any> = { STANDARD: <FileText size={13} />, NORMAL: <GitBranch size={13} />, EMERGENCY: <Zap size={13} />, SSDLC: <ShieldCheck size={13} /> };

const SSDLC_GATES = [
  { key: "request", label: "1. Request" },
  { key: "review", label: "2. Review" },
  { key: "approval", label: "3. Approval" },
  { key: "build", label: "4. Build" },
  { key: "uat", label: "5. UAT" },
  { key: "vapt", label: "6. VAPT" },
  { key: "patchWindow", label: "7. Patch Window" },
  { key: "deploy", label: "8. Deploy" },
  { key: "complianceLogging", label: "9. Compliance Logging" },
];

const TRANSITIONS: Record<string, { label: string; to: string; color: string; bg: string }[]> = {
  DRAFT: [{ label: "Submit", to: "SUBMITTED", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" }],
  SUBMITTED: [
    { label: "Approve", to: "APPROVED", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { label: "Reject", to: "REJECTED", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  ],
  CAB_REVIEW: [
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
  const [cabMeetings, setCabMeetings] = useState<any[]>([]);
  const [tab, setTab] = useState<"list" | "calendar" | "cab">("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showCab, setShowCab] = useState(false);
  const [cabForm, setCabForm] = useState<any>({ title: "", scheduledAt: "", location: "", agenda: "" });
  const [form, setForm] = useState<any>({ type: "NORMAL", priority: "MEDIUM", risk: "MEDIUM" });
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ssdlcGates, setSsdlcGates] = useState<Record<string, boolean>>({});
  const [uatEvidence, setUatEvidence] = useState("");
  const [vaptEvidence, setVaptEvidence] = useState("");

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this change request? This cannot be undone.")) return;
    try { await apiFetch(`/changes/${id}`, { method: "DELETE" }); setSelected(null); load(); } catch { alert("Failed to delete."); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, cal, cab] = await Promise.all([
        apiFetch("/changes"),
        apiFetch("/changes/stats"),
        apiFetch("/changes/calendar"),
        apiFetch("/changes/cab/meetings").catch(() => []),
      ]);
      setChanges(Array.isArray(c?.data) ? c.data : Array.isArray(c) ? c : []);
      setStats(s);
      setCalendar(Array.isArray(cal) ? cal : []);
      setCabMeetings(Array.isArray(cab) ? cab : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) {
      setSsdlcGates((selected.ssdlcGates as any) || {});
      setUatEvidence(selected.uatEvidence || "");
      setVaptEvidence(selected.vaptEvidence || "");
    }
  }, [selected]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const created = await apiFetch("/changes", { method: "POST", body: JSON.stringify(form) });
      if (created?.id) {
        await apiFetch(`/changes/${created.id}/submit`, { method: "POST", body: JSON.stringify({}) }).catch(() => {});
      }
      setShowCreate(false); setForm({ type: "NORMAL", priority: "MEDIUM", risk: "MEDIUM" }); load();
    } catch (e) { alert(String(e)); }
    setSaving(false);
  };

  const transition = async (id: string, status: string) => {
    try {
      if (status === "APPROVED") await apiFetch(`/changes/${id}/approve`, { method: "POST", body: JSON.stringify({}) });
      else if (status === "REJECTED") await apiFetch(`/changes/${id}/reject`, { method: "POST", body: JSON.stringify({}) });
      else if (status === "SUBMITTED") await apiFetch(`/changes/${id}/submit`, { method: "POST", body: JSON.stringify({}) });
      else await apiFetch(`/changes/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      load(); setSelected(null);
    } catch (e) { alert(String(e)); }
  };

  const saveSsdlc = async () => {
    if (!selected) return;
    try {
      const updated = await apiFetch(`/changes/${selected.id}/ssdlc`, {
        method: "PATCH",
        body: JSON.stringify({ ssdlcGates, uatEvidence, vaptEvidence }),
      });
      setSelected(updated);
      load();
    } catch (e) { alert(String(e)); }
  };

  const createCab = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const agenda = (cabForm.agenda || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      await apiFetch("/changes/cab/meetings", {
        method: "POST",
        body: JSON.stringify({ ...cabForm, agenda }),
      });
      setShowCab(false); setCabForm({ title: "", scheduledAt: "", location: "", agenda: "" }); load();
    } catch (err) { alert(String(err)); }
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
          <button className="btn btn-secondary" onClick={() => setShowCab(true)}><Calendar size={14} /> New CAB</button>
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
          {(["list", "calendar", "cab"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
              background: tab === t ? "rgba(6,182,212,0.15)" : "transparent",
              color: tab === t ? "#22d3ee" : "var(--text-secondary)",
            }}>{t === "list" ? <><GitBranch size={13} /> List</> : t === "calendar" ? <><Calendar size={13} /> Calendar</> : <><ShieldCheck size={13} /> CAB</>}</button>
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

          {/* ─── CAB Meetings ─── */}
          {tab === "cab" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cabMeetings.length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                  No CAB meetings scheduled. Create one to attach change requests to the agenda.
                </div>
              )}
              {cabMeetings.map((m: any) => (
                <div key={m.id} className="card" style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
                        {new Date(m.scheduledAt).toLocaleString()}
                        {m.location ? ` · ${m.location}` : ""}
                        {` · ${m.status}`}
                      </div>
                    </div>
                    <span className="badge purple">{Array.isArray(m.agenda) ? m.agenda.length : 0} changes</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── CAB Create Modal ─── */}
      {showCab && (
        <>
          <div onClick={() => setShowCab(false)} style={{ position: "fixed", inset: 0, background: "var(--modal-overlay)", zIndex: 2000 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 480, background: "var(--bg-card)", border: "1px solid var(--border-primary)",
            borderRadius: 16, zIndex: 2001, padding: 24,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>New CAB Meeting</h3>
            <form onSubmit={createCab} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input required placeholder="Title *" value={cabForm.title} onChange={e => setCabForm({ ...cabForm, title: e.target.value })} style={inputStyle} />
              <input required type="datetime-local" value={cabForm.scheduledAt} onChange={e => setCabForm({ ...cabForm, scheduledAt: e.target.value })} style={inputStyle} />
              <input placeholder="Location" value={cabForm.location} onChange={e => setCabForm({ ...cabForm, location: e.target.value })} style={inputStyle} />
              <input placeholder="Change IDs (comma-separated)" value={cabForm.agenda} onChange={e => setCabForm({ ...cabForm, agenda: e.target.value })} style={inputStyle} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCab(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
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
                  {["STANDARD", "NORMAL", "EMERGENCY", "SSDLC"].map(t => <option key={t} value={t}>{t}</option>)}
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

            {/* Approvals */}
            {Array.isArray(selected.approvals) && selected.approvals.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Approvals</div>
                {selected.approvals.map((a: any) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "var(--bg-card)", borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                    <span>Level {a.level}</span>
                    <span style={{ color: a.status === "APPROVED" ? "#10b981" : a.status === "REJECTED" ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>{a.status}</span>
                  </div>
                ))}
                {["SUBMITTED", "CAB_REVIEW"].includes(selected.status) && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="btn" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", fontSize: 12 }} onClick={() => transition(selected.id, "APPROVED")}>Approve</button>
                    <button className="btn" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: 12 }} onClick={() => transition(selected.id, "REJECTED")}>Reject</button>
                  </div>
                )}
              </div>
            )}

            {/* SSDLC checklist */}
            {(selected.type === "SSDLC" || selected.category === "SSDLC") && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>SSDLC 9-step gates</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {SSDLC_GATES.map(g => (
                    <label key={g.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                      <input type="checkbox" checked={!!ssdlcGates[g.key]} onChange={e => setSsdlcGates({ ...ssdlcGates, [g.key]: e.target.checked })} />
                      {g.label}
                    </label>
                  ))}
                </div>
                <textarea placeholder="UAT evidence" value={uatEvidence} onChange={e => setUatEvidence(e.target.value)} rows={2} style={{ ...inputStyle, marginTop: 8, resize: "vertical" }} />
                <textarea placeholder="VAPT evidence" value={vaptEvidence} onChange={e => setVaptEvidence(e.target.value)} rows={2} style={{ ...inputStyle, marginTop: 8, resize: "vertical" }} />
                <button className="btn btn-secondary" style={{ marginTop: 8, fontSize: 12 }} onClick={saveSsdlc}>Save SSDLC evidence</button>
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
