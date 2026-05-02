"use client";
import { useEffect, useState } from "react";
import {
  Zap, Play, Pause, Plus, Trash2, CheckCircle2, Clock,
  ArrowRight, AlertTriangle, Package, Ticket, Shield, Bell, Eye, Settings,
  Loader2, RefreshCw, Code, ShieldCheck, XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const MODULE_ICONS: Record<string, React.ReactNode> = {
  Assets: <Package size={14} />, Tickets: <Ticket size={14} />, Patches: <Shield size={14} />,
  Notifications: <Bell size={14} />, Fleet: <Zap size={14} />, Discovery: <Settings size={14} />,
  CMDB: <Eye size={14} />, Network: <Zap size={14} />, CCTV: <Eye size={14} />,
  Licenses: <Shield size={14} />,
};

const MODULE_COLORS: Record<string, string> = {
  Assets: "#06b6d4", Tickets: "#8b5cf6", Patches: "#10b981",
  Notifications: "#f59e0b", Fleet: "#ef4444", Discovery: "#3b82f6",
  CMDB: "#ec4899", Network: "#06b6d4", CCTV: "#6b7280", Licenses: "#8b5cf6",
};

const STATUS_MAP: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  ACTIVE: { bg: "rgba(16,185,129,0.1)", text: "#10b981", icon: <Play size={10} /> },
  PAUSED: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", icon: <Pause size={10} /> },
  DRAFT: { bg: "rgba(107,114,128,0.1)", text: "#6b7280", icon: <Clock size={10} /> },
};

export default function AutomationPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "ACTIVE" | "PAUSED" | "DRAFT">("all");
  const [viewTab, setViewTab] = useState<"rules" | "executions" | "scripts">("rules");
  const [scripts, setScripts] = useState<any[]>([]);
  const [showAddScript, setShowAddScript] = useState(false);
  const [scriptForm, setScriptForm] = useState({ name: "", description: "", scriptContent: "", platform: "BASH", category: "REMEDIATION", timeoutSeconds: 300 });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", triggerModule: "Discovery", triggerEvent: "",
    condition: "", actionModule: "Notifications", actionType: "send_notification",
  });

  async function refresh() {
    try {
      const [r, s, e] = await Promise.all([
        apiFetch("/automation/rules?limit=50"),
        apiFetch("/automation/rules/stats"),
        apiFetch("/automation/executions?limit=50"),
      ]);
      setRules(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []);
      setStats(s);
      setExecutions(Array.isArray(e?.data) ? e.data : Array.isArray(e) ? e : []);
      // Load scripts
      const sc = await apiFetch("/automation/scripts");
      setScripts(Array.isArray(sc) ? sc : []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const filtered = filter === "all" ? rules : rules.filter(r => r.status === filter);

  async function toggleStatus(rule: any) {
    const newStatus = rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await apiFetch(`/automation/rules/${rule.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    refresh();
  }

  async function deleteRule(id: string) {
    await apiFetch(`/automation/rules/${id}`, { method: "DELETE" });
    refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/automation/rules", { method: "POST", body: JSON.stringify({ ...form, status: "DRAFT" }) });
    setShowAdd(false);
    setForm({ name: "", description: "", triggerModule: "Discovery", triggerEvent: "", condition: "", actionModule: "Notifications", actionType: "send_notification" });
    refresh();
  }

  async function viewDetails(rule: any) {
    const data = await apiFetch(`/automation/rules/${rule.id}`);
    setSelectedRule(data);
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
          <h1 className="page-title">Automation Rules</h1>
          <p className="page-subtitle">Cross-module automation engine for event-driven workflows</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}><Plus size={14} /> New Rule</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-icon cyan"><Zap size={22} /></div>
            <div className="stat-content"><div className="stat-label">Total Rules</div><div className="stat-value">{stats.total}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Play size={22} /></div>
            <div className="stat-content"><div className="stat-label">Active</div><div className="stat-value">{stats.active}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><Pause size={22} /></div>
            <div className="stat-content"><div className="stat-label">Paused</div><div className="stat-value">{stats.paused}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><CheckCircle2 size={22} /></div>
            <div className="stat-content"><div className="stat-label">Total Runs</div><div className="stat-value">{stats.totalExecutions}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><CheckCircle2 size={22} /></div>
            <div className="stat-content"><div className="stat-label">24h Success</div><div className="stat-value">{stats.recentSuccesses}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}><AlertTriangle size={22} /></div>
            <div className="stat-content"><div className="stat-label">24h Failed</div><div className="stat-value">{stats.recentFailures}</div></div>
          </div>
        </div>
      )}

      {/* Add Rule Form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Create New Rule</h3>
          <form onSubmit={handleAdd} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input placeholder="Rule Name *" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ gridColumn: "1 / -1", padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <select value={form.triggerModule} onChange={e => setForm({ ...form, triggerModule: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
              {["Discovery", "Monitoring", "Asset", "Ticket", "Patch", "License"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input placeholder="Trigger Event (e.g. device_offline)" value={form.triggerEvent} onChange={e => setForm({ ...form, triggerEvent: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <input placeholder="Condition (optional)" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <select value={form.actionModule} onChange={e => setForm({ ...form, actionModule: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
              {["Notifications", "Tickets", "Assets", "CMDB"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Plus size={14} /> Create Rule</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter — only show when on rules tab */}
      {viewTab === "rules" && (
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["all", "ACTIVE", "PAUSED", "DRAFT"] as const).map(f => (
          <button key={f} className={`btn ${filter === f ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      )}

      {/* Rules Table */}
      {viewTab === "rules" && (
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
            <Zap size={36} style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No rules found</div>
            <p style={{ fontSize: 12 }}>Create an automation rule to get started</p>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Rule</th><th>Trigger</th><th>Action</th><th>Status</th><th>Runs</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((r: any) => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.DRAFT;
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{r.name}</div>
                      {r.description && <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{r.description}</div>}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${MODULE_COLORS[r.triggerModule] || "#6b7280"}15`, color: MODULE_COLORS[r.triggerModule] || "#6b7280" }}>
                          {MODULE_ICONS[r.triggerModule]} {r.triggerModule}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.triggerEvent}</span>
                      </div>
                      {r.condition && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>if: {r.condition}</div>}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ArrowRight size={10} style={{ color: "var(--text-tertiary)" }} />
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${MODULE_COLORS[r.actionModule] || "#6b7280"}15`, color: MODULE_COLORS[r.actionModule] || "#6b7280" }}>
                          {MODULE_ICONS[r.actionModule]} {r.actionModule}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.actionType}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: st.bg, color: st.text }}>
                        {st.icon} {r.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                      {r.runCount}
                      {r.lastRunAt && <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 400 }}>Last: {new Date(r.lastRunAt).toLocaleDateString()}</div>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => toggleStatus(r)}
                          title={r.status === "ACTIVE" ? "Pause" : "Activate"}>
                          {r.status === "ACTIVE" ? <Pause size={10} /> : <Play size={10} />}
                        </button>
                        <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, color: "#ef4444" }}
                          onClick={() => deleteRule(r.id)} title="Delete">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}

      {/* View Tab Toggle */}
      <div style={{ display: "flex", gap: 4, margin: "16px 0" }}>
        <button className={`btn ${viewTab === "rules" ? "btn-primary" : "btn-secondary"}`}
          style={{ fontSize: 12 }} onClick={() => setViewTab("rules")}>
          <Zap size={12} /> Rules ({rules.length})
        </button>
        <button className={`btn ${viewTab === "executions" ? "btn-primary" : "btn-secondary"}`}
          style={{ fontSize: 12 }} onClick={() => setViewTab("executions")}>
          <Clock size={12} /> Execution Log ({executions.length})
        </button>
        <button className={`btn ${viewTab === "scripts" ? "btn-primary" : "btn-secondary"}`}
          style={{ fontSize: 12 }} onClick={() => setViewTab("scripts")}>
          <Code size={12} /> Script Library ({scripts.length})
        </button>
      </div>

      {/* Execution Log */}
      {viewTab === "executions" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {executions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Clock size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No executions yet</div>
              <p style={{ fontSize: 12 }}>Automation rules will log their execution results here</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Rule</th><th>Status</th><th>Input</th><th>Output</th><th>Executed At</th></tr></thead>
              <tbody>
                {executions.map((ex: any) => (
                  <tr key={ex.id}>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{ex.rule?.name || ex.ruleId?.substring(0, 8)}</td>
                    <td>
                      <span className={`badge ${ex.status === "SUCCESS" ? "green" : ex.status === "FAILED" ? "red" : "gray"}`}
                        style={{ fontSize: 10 }}>
                        {ex.status === "SUCCESS" ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />} {ex.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 10, fontFamily: "monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ex.input ? JSON.stringify(ex.input).substring(0, 60) : "—"}
                    </td>
                    <td style={{ fontSize: 10, fontFamily: "monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ex.output ? JSON.stringify(ex.output).substring(0, 60) : "—"}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {new Date(ex.executedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Script Library */}
      {viewTab === "scripts" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowAddScript(true)}><Plus size={12} /> New Script</button>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {scripts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
                <Code size={36} style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No scripts yet</div>
                <p style={{ fontSize: 12 }}>Create reusable remediation and diagnostic scripts</p>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Script</th><th>Platform</th><th>Category</th><th>Approval</th><th>Runs</th><th>Actions</th></tr></thead>
                <tbody>
                  {scripts.map((sc: any) => (
                    <tr key={sc.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{sc.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{sc.description || "No description"}</div>
                      </td>
                      <td><span className="badge cyan" style={{ fontSize: 10 }}>{sc.platform}</span></td>
                      <td><span className="badge purple" style={{ fontSize: 10 }}>{sc.category}</span></td>
                      <td>
                        <span className={`badge ${sc.approvalStatus === "APPROVED" ? "green" : sc.approvalStatus === "REJECTED" ? "red" : "amber"}`} style={{ fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {sc.approvalStatus === "APPROVED" ? <ShieldCheck size={10} /> : sc.approvalStatus === "REJECTED" ? <XCircle size={10} /> : <Clock size={10} />}
                          {sc.approvalStatus}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sc.runCount || 0}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {sc.approvalStatus === "PENDING" && (
                            <>
                              <button onClick={async () => { await apiFetch(`/automation/scripts/${sc.id}/approve`, { method: "POST" }); refresh(); }}
                                style={{ padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "rgba(16,185,129,0.1)", color: "#10b981" }}>Approve</button>
                              <button onClick={async () => { await apiFetch(`/automation/scripts/${sc.id}/reject`, { method: "POST" }); refresh(); }}
                                style={{ padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Reject</button>
                            </>
                          )}
                          {sc.approvalStatus === "APPROVED" && (
                            <button onClick={async () => { await apiFetch(`/automation/scripts/${sc.id}/execute`, { method: "POST", body: JSON.stringify({ agentId: "default" }) }); refresh(); }}
                              style={{ padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "rgba(34,211,238,0.1)", color: "#22d3ee" }}><Play size={10} /> Run</button>
                          )}
                          <button onClick={async () => { await apiFetch(`/automation/scripts/${sc.id}`, { method: "DELETE" }); refresh(); }}
                            style={{ padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "rgba(239,68,68,0.06)", color: "#ef4444" }}><Trash2 size={10} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add Script Modal */}
          {showAddScript && (
            <>
              <div onClick={() => setShowAddScript(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 540, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", zIndex: 2001, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New Script</h3>
                <form onSubmit={async (e) => { e.preventDefault(); await apiFetch("/automation/scripts", { method: "POST", body: JSON.stringify(scriptForm) }); setShowAddScript(false); setScriptForm({ name: "", description: "", scriptContent: "", platform: "BASH", category: "REMEDIATION", timeoutSeconds: 300 }); refresh(); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input required placeholder="Script name *" value={scriptForm.name} onChange={e => setScriptForm({ ...scriptForm, name: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }} />
                  <input placeholder="Description" value={scriptForm.description} onChange={e => setScriptForm({ ...scriptForm, description: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <select value={scriptForm.platform} onChange={e => setScriptForm({ ...scriptForm, platform: e.target.value })}
                      style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }}>
                      <option value="BASH">Bash</option><option value="POWERSHELL">PowerShell</option><option value="PYTHON">Python</option>
                    </select>
                    <select value={scriptForm.category} onChange={e => setScriptForm({ ...scriptForm, category: e.target.value })}
                      style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }}>
                      <option value="REMEDIATION">Remediation</option><option value="DIAGNOSTIC">Diagnostic</option><option value="MAINTENANCE">Maintenance</option><option value="AUDIT">Audit</option>
                    </select>
                  </div>
                  <textarea required rows={8} placeholder="#!/bin/bash&#10;# Script content..." value={scriptForm.scriptContent} onChange={e => setScriptForm({ ...scriptForm, scriptContent: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", resize: "vertical" }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddScript(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Create Script</button>
                  </div>
                </form>
              </div>
            </>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
