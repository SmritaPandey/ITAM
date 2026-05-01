"use client";
import { useState, useEffect, useCallback } from "react";
import {
  AlertOctagon, Plus, RefreshCw, Filter, Loader2, X,
  CheckCircle2, AlertTriangle, Eye, BookOpen, Clock,
  Search, Bug, ShieldAlert, ArrowRight, XCircle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }
function apiFetch(path: string, opts?: any) {
  return fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...opts?.headers } }).then(r => r.json());
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; badge: string; icon: any; label: string }> = {
  OPEN:                   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", badge: "amber", icon: <AlertOctagon size={12} />, label: "Open" },
  ROOT_CAUSE_IDENTIFIED:  { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", badge: "blue", icon: <Search size={12} />, label: "Root Cause ID" },
  KNOWN_ERROR:            { color: "#f97316", bg: "rgba(249,115,22,0.12)", badge: "amber", icon: <Bug size={12} />, label: "Known Error" },
  RESOLVED:               { color: "#10b981", bg: "rgba(16,185,129,0.12)", badge: "green", icon: <CheckCircle2 size={12} />, label: "Resolved" },
  CLOSED:                 { color: "#64748b", bg: "rgba(100,116,139,0.12)", badge: "gray", icon: <XCircle size={12} />, label: "Closed" },
};

const PRIORITY_BADGE: Record<string, string> = { LOW: "green", MEDIUM: "amber", HIGH: "red", CRITICAL: "red" };

export default function ProblemsPage() {
  const [problems, setProblems] = useState<any[]>([]);
  const [knownErrors, setKnownErrors] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<"all" | "known-errors">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({ priority: "MEDIUM" });
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workaroundInput, setWorkaroundInput] = useState("");
  const [resolutionInput, setResolutionInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, ke, s] = await Promise.all([apiFetch("/problems"), apiFetch("/problems/known-errors"), apiFetch("/problems/stats")]);
      setProblems(p); setKnownErrors(ke); setStats(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await apiFetch("/problems", { method: "POST", body: JSON.stringify(form) }); setShowCreate(false); setForm({ priority: "MEDIUM" }); load(); } catch(e) { alert(String(e)); }
    setSaving(false);
  };

  const promoteKE = async (id: string) => {
    if (!workaroundInput.trim()) return alert("Please enter a workaround");
    try { await apiFetch(`/problems/${id}/known-error`, { method: "POST", body: JSON.stringify({ workaround: workaroundInput }) }); load(); setWorkaroundInput(""); setSelected(null); } catch(e) { alert(String(e)); }
  };

  const resolve = async (id: string) => {
    if (!resolutionInput.trim()) return alert("Please enter a resolution");
    try { await apiFetch(`/problems/${id}/resolve`, { method: "POST", body: JSON.stringify({ resolution: resolutionInput }) }); load(); setResolutionInput(""); setSelected(null); } catch(e) { alert(String(e)); }
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)",
    background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", width: "100%",
  };

  const items = tab === "known-errors" ? knownErrors : problems;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Problem Management</h1>
          <p className="page-subtitle">Root cause analysis, known error database, resolution tracking</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => load()}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New Problem</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          {["OPEN", "ROOT_CAUSE_IDENTIFIED", "KNOWN_ERROR", "RESOLVED", "CLOSED"].map(s => {
            const count = stats.byStatus?.find((x: any) => x.status === s)?._count || 0;
            const sc = STATUS_CONFIG[s];
            return (
              <div key={s} className="stat-card">
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

      {/* Tab Bar */}
      <div className="card" style={{ marginBottom: 16, padding: "8px 12px", display: "flex", gap: 4, alignItems: "center" }}>
        <button onClick={() => setTab("all")} style={{
          padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
          background: tab === "all" ? "rgba(6,182,212,0.15)" : "transparent",
          color: tab === "all" ? "#22d3ee" : "var(--text-secondary)",
        }}><AlertOctagon size={13} /> All Problems</button>
        <button onClick={() => setTab("known-errors")} style={{
          padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
          background: tab === "known-errors" ? "rgba(249,115,22,0.15)" : "transparent",
          color: tab === "known-errors" ? "#f97316" : "var(--text-secondary)",
        }}><Bug size={13} /> Known Errors <span className="badge amber" style={{ marginLeft: 4 }}>{stats?.knownErrors || 0}</span></button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80, color: "var(--text-tertiary)" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Problem #</th><th>Title</th><th>Priority</th><th>Status</th><th>Category</th>
                <th>{tab === "known-errors" ? "Workaround" : "Root Cause"}</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.OPEN;
                return (
                  <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setSelected(p)}>
                    <td>
                      <span style={{ fontWeight: 600, color: "var(--brand-400)", fontFamily: "monospace", fontSize: 12 }}>{p.problemNumber}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{p.title}</div>
                      {p.description && <div style={{ fontSize: 11, color: "var(--text-tertiary)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
                    </td>
                    <td><span className={`badge ${PRIORITY_BADGE[p.priority] || "gray"}`}>{p.priority}</span></td>
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
                        borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color,
                      }}>{sc.icon} {sc.label}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{p.category ? <span className="badge cyan">{p.category}</span> : <span style={{ color: "var(--text-tertiary)" }}>—</span>}</td>
                    <td style={{ fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {tab === "known-errors" ? (p.workaround || "—") : (p.rootCause || "—")}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {p.status === "OPEN" && (
                          <button onClick={() => setSelected(p)} style={{
                            padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10,
                            fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            background: "rgba(249,115,22,0.12)", color: "#f97316",
                          }}><Bug size={10} style={{ marginRight: 2 }} />Known Error</button>
                        )}
                        {p.status !== "RESOLVED" && p.status !== "CLOSED" && (
                          <button onClick={() => setSelected(p)} style={{
                            padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10,
                            fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            background: "rgba(16,185,129,0.12)", color: "#10b981",
                          }}><CheckCircle2 size={10} style={{ marginRight: 2 }} />Resolve</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                  No {tab === "known-errors" ? "known errors" : "problems"} yet. Click &quot;New Problem&quot; to create one.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Create Modal ─── */}
      {showCreate && (
        <>
          <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "var(--modal-overlay)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 500, background: "var(--bg-card)", border: "1px solid var(--border-primary)",
            borderRadius: 16, boxShadow: "var(--modal-shadow)", zIndex: 2001, padding: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New Problem Record</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input required placeholder="Problem Title *" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inputStyle}>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input placeholder="Category" value={form.category || ""} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle} />
              </div>
              <textarea placeholder="Description" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Creating..." : "Create Problem"}</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ─── Detail / Action Panel ─── */}
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
                <span style={{ fontFamily: "monospace", color: "var(--brand-400)", fontWeight: 600, fontSize: 13 }}>{selected.problemNumber}</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{selected.title}</h2>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {selected.description && (
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>{selected.description}</p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                ["Priority", selected.priority],
                ["Status", STATUS_CONFIG[selected.status]?.label || selected.status],
                ["Category", selected.category || "—"],
                ["Known Error", selected.isKnownError ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={String(k)} style={{ background: "var(--bg-card)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k as string}</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{v as string}</div>
                </div>
              ))}
            </div>

            {selected.rootCause && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Root Cause</div>
                <div style={{ background: "var(--bg-card)", borderRadius: 8, padding: 12, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{selected.rootCause}</div>
              </div>
            )}
            {selected.workaround && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Workaround</div>
                <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 8, padding: 12, fontSize: 13, color: "#fb923c", lineHeight: 1.5 }}>{selected.workaround}</div>
              </div>
            )}
            {selected.resolution && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Resolution</div>
                <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: 12, fontSize: 13, color: "#34d399", lineHeight: 1.5 }}>{selected.resolution}</div>
              </div>
            )}

            {/* Actions */}
            {selected.status !== "RESOLVED" && selected.status !== "CLOSED" && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
                {selected.status === "OPEN" && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#f97316", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <Bug size={14} /> Promote to Known Error
                    </div>
                    <textarea placeholder="Describe the workaround..." value={workaroundInput} onChange={e => setWorkaroundInput(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }} />
                    <button onClick={() => promoteKE(selected.id)} className="btn" style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", fontSize: 12 }}>
                      <Bug size={12} /> Mark as Known Error
                    </button>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#10b981", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={14} /> Resolve Problem
                  </div>
                  <textarea placeholder="Describe the permanent fix..." value={resolutionInput} onChange={e => setResolutionInput(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }} />
                  <button onClick={() => resolve(selected.id)} className="btn" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", fontSize: 12 }}>
                    <CheckCircle2 size={12} /> Resolve
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
