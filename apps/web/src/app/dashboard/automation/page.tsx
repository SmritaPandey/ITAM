"use client";
import { useEffect, useState } from "react";
import {
  Zap, Play, Pause, Plus, Trash2, CheckCircle2, Clock,
  ArrowRight, AlertTriangle, Package, Ticket, Shield, Bell, Eye, Settings,
  Loader2, RefreshCw, Code, ShieldCheck, XCircle, Terminal, Cpu, Database
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
  ACTIVE: { bg: "rgba(16,185,129,0.12)", text: "#34d399", icon: <Play size={10} fill="currentColor" /> },
  PAUSED: { bg: "rgba(245,158,11,0.12)", text: "#fbbf24", icon: <Pause size={10} fill="currentColor" /> },
  DRAFT: { bg: "rgba(148,163,184,0.12)", text: "#94a3b8", icon: <Clock size={10} /> },
};

const PLATFORM_COLORS: Record<string, { brand: string; bg: string; text: string }> = {
  BASH: { brand: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", text: "#22d3ee" },
  PYTHON: { brand: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", text: "#60a5fa" },
  POWERSHELL: { brand: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)", text: "#a78bfa" },
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
  const [agents, setAgents] = useState<any[]>([]);
  const [runScriptId, setRunScriptId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [runningScript, setRunningScript] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", triggerModule: "Discovery", triggerEvent: "",
    condition: "", actionModule: "Notifications", actionType: "send_notification",
    actionConfig: "{}",
  });
  const [meta, setMeta] = useState<any>(null);

  async function refresh() {
    try {
      const [r, s, e, ag, m] = await Promise.all([
        apiFetch("/automation/rules?limit=50"),
        apiFetch("/automation/rules/stats"),
        apiFetch("/automation/executions?limit=50"),
        apiFetch("/discovery/agents").catch(() => []),
        apiFetch("/automation/triggers-actions").catch(() => null),
      ]);
      setRules(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []);
      setStats(s);
      setExecutions(Array.isArray(e?.data) ? e.data : Array.isArray(e) ? e : []);
      if (m) setMeta(m);
      const sc = await apiFetch("/automation/scripts");
      setScripts(Array.isArray(sc) ? sc : []);
      setAgents(Array.isArray(ag) ? ag : Array.isArray(ag?.data) ? ag.data : []);
    } catch (err: any) { console.error("Automation refresh failed:", err); } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const filtered = filter === "all" ? rules : rules.filter(r => r.status === filter);

  async function toggleStatus(rule: any) {
    try {
      const newStatus = rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      await apiFetch(`/automation/rules/${rule.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      refresh();
    } catch (err: any) { alert(`Failed to toggle rule: ${err.message || err}`); }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this automation rule?")) return;
    try {
      await apiFetch(`/automation/rules/${id}`, { method: "DELETE" });
      refresh();
    } catch (err: any) { alert(`Failed to delete rule: ${err.message || err}`); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      let actionConfig = {};
      try { actionConfig = JSON.parse(form.actionConfig || "{}"); } catch { /* */ }
      let condition = form.condition;
      if (condition && !condition.trim().startsWith("{")) {
        // allow key=value shorthand → JSON
        const [k, ...rest] = condition.split("=");
        if (k && rest.length) condition = JSON.stringify({ [k.trim()]: rest.join("=").trim().replace(/^['"]|['"]$/g, "") });
      }
      await apiFetch("/automation/rules", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          condition: condition || "{}",
          actionConfig,
          status: "DRAFT",
        }),
      });
      setShowAdd(false);
      setForm({ name: "", description: "", triggerModule: "Discovery", triggerEvent: "", condition: "", actionModule: "Notifications", actionType: "send_notification", actionConfig: "{}" });
      refresh();
    } catch (err: any) { alert(`Failed to create rule: ${err.message || err}`); }
  }

  async function viewDetails(rule: any) {
    try {
      const data = await apiFetch(`/automation/rules/${rule.id}`);
      setSelectedRule(data);
    } catch (err: any) { alert(`Failed to load rule details: ${err.message || err}`); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Automation Rules</h1>
          <p className="page-subtitle">Cross-module automation engine for event-driven workflows</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary" onClick={refresh} style={{ padding: "8px 12px" }}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14} /> New Rule
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon cyan" style={{ background: "rgba(6,182,212,0.1)", color: "#22d3ee" }}><Zap size={20} /></div>
            <div className="stat-content"><div className="stat-label">Total Rules</div><div className="stat-value">{stats.total}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}><Play size={20} /></div>
            <div className="stat-content"><div className="stat-label">Active</div><div className="stat-value">{stats.active}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber" style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24" }}><Pause size={20} /></div>
            <div className="stat-content"><div className="stat-label">Paused</div><div className="stat-value">{stats.paused}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple" style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}><CheckCircle2 size={20} /></div>
            <div className="stat-content"><div className="stat-label">Total Runs</div><div className="stat-value">{stats.totalExecutions}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}><CheckCircle2 size={20} /></div>
            <div className="stat-content"><div className="stat-label">24h Success</div><div className="stat-value">{stats.recentSuccesses}</div></div>
          </div>
          <div className="stat-card" style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
            <div className="stat-icon" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}><AlertTriangle size={20} /></div>
            <div className="stat-content"><div className="stat-label">24h Failed</div><div className="stat-value" style={{ color: "#f87171" }}>{stats.recentFailures}</div></div>
          </div>
        </div>
      )}

      {/* Add Rule Form - Cybernetic Glassmorphic Panel */}
      {showAdd && (
        <div className="card" style={{
          marginBottom: 24,
          padding: 24,
          background: "linear-gradient(135deg, rgba(26,31,53,0.7) 0%, rgba(16,20,38,0.9) 100%)",
          border: "1px solid rgba(6, 182, 212, 0.25)",
          boxShadow: "0 8px 32px 0 rgba(6, 182, 212, 0.08), var(--shadow-glow)",
          backdropFilter: "blur(12px)",
          animation: "fadeIn 0.25s ease-out"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Zap size={16} style={{ color: "var(--brand-400)", filter: "drop-shadow(0 0 4px var(--brand-500))" }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Create New Rule</h3>
          </div>
          <form onSubmit={handleAdd} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <input placeholder="Rule Name *" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", transition: "border-color 0.2s" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 6 }}>Trigger Module</label>
              <select value={form.triggerModule} onChange={e => setForm({ ...form, triggerModule: e.target.value, triggerEvent: "" })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                {(meta?.triggers || [{ module: "Discovery" }, { module: "Monitoring" }, { module: "Asset" }, { module: "Ticket" }, { module: "Patch" }, { module: "License" }]).map((t: any) => (
                  <option key={t.module} value={t.module}>{t.module}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 6 }}>Trigger Event</label>
              {(() => {
                const events = meta?.triggers?.find((t: any) => t.module === form.triggerModule)?.events;
                return events?.length ? (
                  <select value={form.triggerEvent} onChange={e => setForm({ ...form, triggerEvent: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                    <option value="">Select event…</option>
                    {events.map((ev: string) => <option key={ev} value={ev}>{ev}</option>)}
                  </select>
                ) : (
                  <input placeholder="e.g. device_offline" value={form.triggerEvent} onChange={e => setForm({ ...form, triggerEvent: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                );
              })()}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 6 }}>Condition</label>
              <select
                value=""
                onChange={e => {
                  const c = meta?.conditions?.find((x: any) => x.key === e.target.value);
                  if (c) setForm({ ...form, condition: `${c.key}=` });
                }}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 6 }}>
                <option value="">Add condition field…</option>
                {(meta?.conditions || []).map((c: any) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input placeholder='JSON or priority=HIGH' value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 6 }}>Action</label>
              <select value={form.actionType} onChange={e => {
                const a = meta?.actions?.find((x: any) => x.type === e.target.value);
                const templates: Record<string, string> = {
                  send_notification: JSON.stringify({ title: "Alert", message: "{{event}}", severity: "HIGH" }, null, 2),
                  create_ticket: JSON.stringify({ subject: "Auto: {{event}}", priority: "HIGH", type: "INCIDENT" }, null, 2),
                  send_webhook: JSON.stringify({ url: "https://hooks.example.com/...", method: "POST" }, null, 2),
                  send_email: JSON.stringify({ to: "ops@example.com", subject: "Alert: {{event}}" }, null, 2),
                  assign_ticket: JSON.stringify({ assignedToRole: "IT Admin" }, null, 2),
                  escalate_ticket: JSON.stringify({ reason: "SLA risk" }, null, 2),
                };
                setForm({
                  ...form,
                  actionType: e.target.value,
                  actionModule: a?.module || form.actionModule,
                  actionConfig: templates[e.target.value] || form.actionConfig,
                });
              }}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                {(meta?.actions || [
                  { type: "send_notification", label: "Send notification" },
                  { type: "create_ticket", label: "Create ticket" },
                  { type: "send_webhook", label: "Webhook" },
                  { type: "send_email", label: "Email" },
                ]).map((a: any) => <option key={a.type} value={a.type}>{a.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 6 }}>Action config (JSON)</label>
              <textarea value={form.actionConfig} onChange={e => setForm({ ...form, actionConfig: e.target.value })} rows={3}
                placeholder='{"title":"Alert","message":"..."}'
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Plus size={14} /> Create Rule</button>
            </div>
          </form>
        </div>
      )}

      {/* View Tab Toggle */}
      <div style={{ display: "flex", gap: 8, margin: "0 0 20px" }}>
        <button className={`btn ${viewTab === "rules" ? "btn-primary" : "btn-secondary"}`}
          style={{ fontSize: 12.5, padding: "8px 16px" }} onClick={() => setViewTab("rules")}>
          <Zap size={13} style={{ marginRight: 2 }} /> Rules ({rules.length})
        </button>
        <button className={`btn ${viewTab === "executions" ? "btn-primary" : "btn-secondary"}`}
          style={{ fontSize: 12.5, padding: "8px 16px" }} onClick={() => setViewTab("executions")}>
          <Clock size={13} style={{ marginRight: 2 }} /> Execution Log ({executions.length})
        </button>
        <button className={`btn ${viewTab === "scripts" ? "btn-primary" : "btn-secondary"}`}
          style={{ fontSize: 12.5, padding: "8px 16px" }} onClick={() => setViewTab("scripts")}>
          <Code size={13} style={{ marginRight: 2 }} /> Script Library ({scripts.length})
        </button>
      </div>

      {/* Rules View */}
      {viewTab === "rules" && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {(["all", "ACTIVE", "PAUSED", "DRAFT"] as const).map(f => (
              <button key={f} className={`btn ${filter === f ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 20 }} onClick={() => setFilter(f)}>
                {f === "all" ? "All Rules" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-primary)", borderRadius: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)" }}>
                <Zap size={40} style={{ margin: "0 auto 16px", opacity: 0.5, color: "var(--brand-400)" }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>No Rules Found</div>
                <p style={{ fontSize: 12, marginTop: 4 }}>Create an automation rule to connect triggers to actions.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rule Details</th>
                    <th>Trigger Config</th>
                    <th>Action Dispatch</th>
                    <th>Status</th>
                    <th>Runs</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => {
                    const st = STATUS_MAP[r.status] || STATUS_MAP.DRAFT;
                    return (
                      <tr key={r.id} style={{ transition: "all 0.2s" }}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13.5 }}>{r.name}</div>
                          {r.description && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{r.description}</div>}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: `${MODULE_COLORS[r.triggerModule] || "#6b7280"}15`, color: MODULE_COLORS[r.triggerModule] || "#6b7280", border: `1px solid ${MODULE_COLORS[r.triggerModule] || "#6b7280"}25` }}>
                              {MODULE_ICONS[r.triggerModule]} {r.triggerModule}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "monospace" }}>{r.triggerEvent}</span>
                          </div>
                          {r.condition && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace", background: "var(--bg-primary)", padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>if: {r.condition}</div>}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <ArrowRight size={12} style={{ color: "var(--text-tertiary)" }} />
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: `${MODULE_COLORS[r.actionModule] || "#6b7280"}15`, color: MODULE_COLORS[r.actionModule] || "#6b7280", border: `1px solid ${MODULE_COLORS[r.actionModule] || "#6b7280"}25` }}>
                              {MODULE_ICONS[r.actionModule]} {r.actionModule}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>{r.actionType}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: st.bg, color: st.text, letterSpacing: "0.02em" }}>
                            {st.icon} {r.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>{r.runCount}</span>
                            {r.lastRunAt && <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 400, marginTop: 2 }}>Last: {new Date(r.lastRunAt).toLocaleDateString()}</span>}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button className="btn btn-secondary" style={{ padding: "4px 8px", borderRadius: 6 }} onClick={() => toggleStatus(r)}
                              title={r.status === "ACTIVE" ? "Pause" : "Activate"}>
                              {r.status === "ACTIVE" ? <Pause size={12} /> : <Play size={12} />}
                            </button>
                            <button className="btn btn-secondary" style={{ padding: "4px 8px", borderRadius: 6, color: "#ef4444" }}
                              onClick={() => deleteRule(r.id)} title="Delete">
                              <Trash2 size={12} />
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
        </>
      )}

      {/* Execution Logs View */}
      {viewTab === "executions" && (
        <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-primary)", borderRadius: 12 }}>
          {executions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)" }}>
              <Clock size={40} style={{ margin: "0 auto 16px", opacity: 0.5, color: "var(--brand-400)" }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>No Executions Yet</div>
              <p style={{ fontSize: 12, marginTop: 4 }}>Logs will be automatically registered here when rules run.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Status</th>
                  <th>Input Parameters</th>
                  <th>Output / Action Result</th>
                  <th>Executed At</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((ex: any) => {
                  const isSuccess = ex.status === "SUCCESS";
                  const glowColor = isSuccess ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)";
                  const borderColor = isSuccess ? "#10b981" : "#ef4444";
                  return (
                    <tr key={ex.id} style={{ transition: "all 0.2s" }}>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{ex.rule?.name || ex.ruleId?.substring(0, 8)}</td>
                      <td>
                        <span className={`badge ${isSuccess ? "green" : "red"}`}
                          style={{
                            fontSize: 10,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 10px",
                            borderRadius: 8,
                            boxShadow: `0 0 8px ${glowColor}`,
                            border: `1px solid ${borderColor}`,
                            fontWeight: 700
                          }}>
                          {isSuccess ? <CheckCircle2 size={11} fill="currentColor" style={{ color: "var(--bg-primary)" }} /> : <AlertTriangle size={11} />}
                          {ex.status}
                        </span>
                      </td>
                      <td>
                        <div style={{
                          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                          fontSize: 11,
                          background: "var(--bg-primary)",
                          padding: "6px 10px",
                          borderRadius: 6,
                          maxWidth: 250,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          border: "1px solid var(--border-primary)",
                          color: "var(--text-secondary)"
                        }} title={ex.input ? JSON.stringify(ex.input) : ""}>
                          {ex.input ? JSON.stringify(ex.input) : "—"}
                        </div>
                      </td>
                      <td>
                        <div style={{
                          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                          fontSize: 11,
                          background: "var(--bg-primary)",
                          padding: "6px 10px",
                          borderRadius: 6,
                          maxWidth: 250,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          border: "1px solid var(--border-primary)",
                          color: isSuccess ? "#34d399" : "#f87171"
                        }} title={ex.output ? JSON.stringify(ex.output) : ""}>
                          {ex.output ? JSON.stringify(ex.output) : "—"}
                        </div>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {new Date(ex.executedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Script Library View - Tactile Terminal Cards */}
      {viewTab === "scripts" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowAddScript(true)}><Plus size={14} /> New Script</button>
          </div>

          {scripts.length === 0 ? (
            <div className="card" style={{ padding: 64, textAlign: "center", border: "1px solid var(--border-primary)", borderRadius: 12 }}>
              <Code size={40} style={{ margin: "0 auto 16px", opacity: 0.5, color: "var(--brand-400)" }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>No Scripts Registered</div>
              <p style={{ fontSize: 12, marginTop: 4 }}>Add automation scripts to easily remediate and diagnose tasks.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
              {scripts.map((sc: any) => {
                const colors = PLATFORM_COLORS[sc.platform] || { brand: "#94a3b8", bg: "rgba(148,163,184,0.12)", text: "#94a3b8" };
                const isApproved = sc.approvalStatus === "APPROVED";
                return (
                  <div key={sc.id} className="card" style={{
                    padding: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: 12,
                    transition: "transform 0.2s, border-color 0.2s",
                  }}>
                    {/* Terminal Top Bar */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "rgba(0,0,0,0.2)",
                      borderBottom: "1px solid var(--border-primary)"
                    }}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                        <Terminal size={11} style={{ color: "var(--text-tertiary)", marginLeft: 6 }} />
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>script.{sc.platform.toLowerCase()}</span>
                      </div>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.brand}20`
                      }}>
                        {sc.platform}
                      </span>
                    </div>

                    {/* Script content & meta */}
                    <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{sc.name}</h4>
                        <span className="badge purple" style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4 }}>{sc.category}</span>
                      </div>
                      <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", margin: "6px 0 12px", lineHeight: 1.5 }}>{sc.description || "No description provided."}</p>

                      {/* Code Monospace Box */}
                      <div style={{
                        flex: 1,
                        background: "#070a13",
                        border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: 8,
                        padding: "10px 12px",
                        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                        fontSize: 11,
                        color: "#a9b2c3",
                        minHeight: 80,
                        maxHeight: 120,
                        overflowY: "auto",
                        lineHeight: 1.6,
                        marginBottom: 16,
                        whiteSpace: "pre-wrap"
                      }}>
                        <code style={{ color: colors.text }}>{sc.scriptContent || "# Empty script"}</code>
                      </div>

                      {/* Info Row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--text-tertiary)", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: 10 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Cpu size={12} /> Runs: <strong style={{ color: "var(--text-primary)" }}>{sc.runCount || 0}</strong>
                        </span>
                        <span className={`badge ${sc.approvalStatus === "APPROVED" ? "green" : sc.approvalStatus === "REJECTED" ? "red" : "amber"}`} style={{ fontSize: 9.5, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {sc.approvalStatus === "APPROVED" ? <ShieldCheck size={10} /> : sc.approvalStatus === "REJECTED" ? <XCircle size={10} /> : <Clock size={10} />}
                          {sc.approvalStatus}
                        </span>
                      </div>
                    </div>

                    {/* Action footer */}
                    <div style={{
                      padding: "10px 16px",
                      background: "rgba(0,0,0,0.15)",
                      borderTop: "1px solid var(--border-primary)",
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 8
                    }}>
                      {sc.approvalStatus === "PENDING" && (
                        <>
                          <button onClick={async () => { try { await apiFetch(`/automation/scripts/${sc.id}/approve`, { method: "POST" }); refresh(); } catch (err: any) { alert(`Approve failed: ${err.message || err}`); } }}
                            className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 10.5, borderColor: "rgba(16,185,129,0.3)", color: "#10b981", background: "rgba(16,185,129,0.05)" }}>
                            Approve
                          </button>
                          <button onClick={async () => { try { await apiFetch(`/automation/scripts/${sc.id}/reject`, { method: "POST" }); refresh(); } catch (err: any) { alert(`Reject failed: ${err.message || err}`); } }}
                            className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 10.5, borderColor: "rgba(239,68,68,0.3)", color: "#ef4444", background: "rgba(239,68,68,0.05)" }}>
                            Reject
                          </button>
                        </>
                      )}
                      {sc.approvalStatus === "APPROVED" && (
                        <button onClick={() => {
                          setRunScriptId(sc.id);
                          const online = agents.find((a: any) => a.status === "ONLINE");
                          setSelectedAgentId(online?.id || agents[0]?.id || "");
                        }}
                          className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 11, borderColor: "rgba(6,182,212,0.4)", color: "#22d3ee", background: "rgba(6,182,212,0.05)" }}>
                          <Play size={10} fill="currentColor" /> Run
                        </button>
                      )}
                      <button onClick={async () => { if (!confirm("Delete this script?")) return; try { await apiFetch(`/automation/scripts/${sc.id}`, { method: "DELETE" }); refresh(); } catch (err: any) { alert(`Delete failed: ${err.message || err}`); } }}
                        className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11, color: "#f87171" }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {runScriptId && (
            <>
              <div onClick={() => !runningScript && setRunScriptId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 2000, backdropFilter: "blur(6px)" }} />
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 420, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.6)", zIndex: 2001, padding: 24 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Run script on agent</h3>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                  Choose a registered discovery agent to execute this script.
                </p>
                {agents.length === 0 ? (
                  <div style={{ padding: 16, borderRadius: 10, background: "var(--bg-primary)", border: "1px solid var(--border-primary)", marginBottom: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                    No agents registered. Install an agent from Discovery first.
                  </div>
                ) : (
                  <select
                    value={selectedAgentId}
                    onChange={e => setSelectedAgentId(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16 }}
                  >
                    {agents.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.hostname || a.id}{a.ipAddress ? ` (${a.ipAddress})` : ""} — {a.status || "UNKNOWN"}
                      </option>
                    ))}
                  </select>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn btn-secondary" disabled={runningScript} onClick={() => setRunScriptId(null)}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={runningScript || !selectedAgentId || agents.length === 0}
                    onClick={async () => {
                      if (!runScriptId || !selectedAgentId) return;
                      setRunningScript(true);
                      try {
                        await apiFetch(`/automation/scripts/${runScriptId}/execute`, {
                          method: "POST",
                          body: JSON.stringify({ agentId: selectedAgentId }),
                        });
                        setRunScriptId(null);
                        refresh();
                      } catch (err: any) {
                        alert(`Execution failed: ${err.message || err}`);
                      } finally {
                        setRunningScript(false);
                      }
                    }}
                  >
                    {runningScript ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={12} fill="currentColor" />}
                    {runningScript ? " Running…" : " Execute"}
                  </button>
                </div>
              </div>
            </>
          )}

          {showAddScript && (
            <>
              <div onClick={() => setShowAddScript(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 2000, backdropFilter: "blur(6px)" }} />
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 560, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.6)", zIndex: 2001, padding: 24, animation: "fadeIn 0.2s ease-out" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Create Reusable Script</h3>
                <form onSubmit={async (e) => { e.preventDefault(); await apiFetch("/automation/scripts", { method: "POST", body: JSON.stringify(scriptForm) }); setShowAddScript(false); setScriptForm({ name: "", description: "", scriptContent: "", platform: "BASH", category: "REMEDIATION", timeoutSeconds: 300 }); refresh(); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input required placeholder="Script name *" value={scriptForm.name} onChange={e => setScriptForm({ ...scriptForm, name: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                  <input placeholder="Description" value={scriptForm.description} onChange={e => setScriptForm({ ...scriptForm, description: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <select value={scriptForm.platform} onChange={e => setScriptForm({ ...scriptForm, platform: e.target.value })}
                      style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                      <option value="BASH">Bash</option><option value="POWERSHELL">PowerShell</option><option value="PYTHON">Python</option>
                    </select>
                    <select value={scriptForm.category} onChange={e => setScriptForm({ ...scriptForm, category: e.target.value })}
                      style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                      <option value="REMEDIATION">Remediation</option><option value="DIAGNOSTIC">Diagnostic</option><option value="MAINTENANCE">Maintenance</option><option value="AUDIT">Audit</option>
                    </select>
                  </div>
                  <textarea required rows={8} placeholder="#!/bin/bash&#10;# Write script logic here..." value={scriptForm.scriptContent} onChange={e => setScriptForm({ ...scriptForm, scriptContent: e.target.value })}
                    style={{ padding: "12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "#070a13", color: "#a9b2c3", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", resize: "vertical", outline: "none" }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddScript(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Create Script</button>
                  </div>
                </form>
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  );
}

