"use client";
import { useEffect, useState } from "react";
import {
  Wrench, Plus, Clock, CheckCircle2, AlertCircle, Filter, RefreshCw,
  ArrowRight, ChevronDown, Calendar, User, Package, DollarSign, Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PageHelp } from "@/components/HelpSystem";

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  CREATED: { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", icon: <Clock size={14} /> },
  ASSIGNED: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", icon: <User size={14} /> },
  IN_PROGRESS: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: <Loader2 size={14} /> },
  COMPLETED: { color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: <CheckCircle2 size={14} /> },
  VERIFIED: { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", icon: <CheckCircle2 size={14} /> },
  CANCELLED: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: <AlertCircle size={14} /> },
};

const TYPE_BADGE: Record<string, string> = {
  MAINTENANCE: "amber", REPAIR: "red", INSTALLATION: "green", INSPECTION: "blue",
};

export default function WorkOrdersPage() {
  const [stats, setStats] = useState<any>({});
  const [workOrders, setWorkOrders] = useState<any>({ data: [], total: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "MAINTENANCE", priority: "MEDIUM" });
  const [selectedWO, setSelectedWO] = useState<any>(null);

  function load(status?: string) {
    setLoading(true);
    const params = status ? `?status=${status}` : "";
    Promise.all([
      apiFetch("/work-orders/stats"),
      apiFetch(`/work-orders${params}`),
    ]).then(([s, wo]) => {
      setStats(s);
      setWorkOrders(wo);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    await apiFetch("/work-orders", { method: "POST", body: JSON.stringify(form) });
    setShowCreate(false);
    setForm({ title: "", description: "", type: "MAINTENANCE", priority: "MEDIUM" });
    load(statusFilter);
    setCreating(false);
  }

  async function handleTransition(id: string, status: string) {
    await apiFetch(`/work-orders/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
    load(statusFilter);
    setSelectedWO(null);
  }

  const statCards = [
    { label: "Total", value: stats.total || 0, color: "#22d3ee", icon: <Wrench size={18} /> },
    { label: "Created", value: stats.created || 0, color: "#94a3b8", icon: <Clock size={18} /> },
    { label: "In Progress", value: stats.inProgress || 0, color: "#f59e0b", icon: <Loader2 size={18} /> },
    { label: "Completed", value: stats.completed || 0, color: "#10b981", icon: <CheckCircle2 size={18} /> },
    { label: "Verified", value: stats.verified || 0, color: "#8b5cf6", icon: <CheckCircle2 size={18} /> },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Work Orders</h1>
          <p className="page-subtitle">Maintenance, repair, and installation task management</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => load(statusFilter)}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Create Work Order</button>
        </div>
      </div>

      <PageHelp id="workorders" title="Work Orders">
        Create and track maintenance, repair, and installation tasks. Work orders follow the lifecycle: <strong>Created → Assigned → In Progress → Completed → Verified</strong>. Click the status filter chips to view by stage. Click any row for full details including schedule, cost tracking, and assignment info.
      </PageHelp>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {statCards.map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: "pointer" }} onClick={() => { setStatusFilter(s.label === "Total" ? "" : s.label.toUpperCase().replace(" ", "_")); load(s.label === "Total" ? "" : s.label.toUpperCase().replace(" ", "_")); }}>
            <div className="stat-content">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
            <div style={{ color: s.color }}>{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 16, padding: "10px 16px", display: "flex", gap: 8, alignItems: "center" }}>
        <Filter size={14} style={{ color: "var(--text-tertiary)" }} />
        {["", "CREATED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "VERIFIED", "CANCELLED"].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); load(s); }}
            style={{
              padding: "4px 12px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: statusFilter === s ? "rgba(34,211,238,0.15)" : "rgba(100,116,139,0.1)",
              color: statusFilter === s ? "#22d3ee" : "var(--text-secondary)",
            }}>{s || "All"}</button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Work Order</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Cost</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading...</td></tr>
            ) : workOrders.data?.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No work orders yet. Click "Create Work Order" to start.</td></tr>
            ) : workOrders.data?.map((wo: any) => {
              const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
              const nextStates: Record<string, string[]> = {
                CREATED: ["ASSIGNED", "CANCELLED"], ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
                IN_PROGRESS: ["COMPLETED", "CANCELLED"], COMPLETED: ["VERIFIED"],
              };
              return (
                <tr key={wo.id} style={{ cursor: "pointer" }} onClick={() => setSelectedWO(wo)}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{wo.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{wo.workOrderNumber}</div>
                  </td>
                  <td><span className={`badge ${TYPE_BADGE[wo.type] || "gray"}`}>{wo.type}</span></td>
                  <td><span className={`badge ${wo.priority === "HIGH" || wo.priority === "CRITICAL" ? "red" : wo.priority === "MEDIUM" ? "amber" : "gray"}`}>{wo.priority}</span></td>
                  <td>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
                      borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: sc.bg, color: sc.color,
                    }}>{sc.icon} {wo.status.replace("_", " ")}</span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {wo.scheduledStart ? new Date(wo.scheduledStart).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {wo.laborHours ? `${wo.laborHours}h` : "—"}
                    {wo.materialCost ? ` / ₹${wo.materialCost}` : ""}
                  </td>
                  <td>
                    {(nextStates[wo.status] || []).length > 0 && (
                      <div style={{ display: "flex", gap: 4 }}>
                        {(nextStates[wo.status] || []).map(ns => (
                          <button key={ns} onClick={() => handleTransition(wo.id, ns)}
                            style={{
                              padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10,
                              fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                              background: ns === "CANCELLED" ? "rgba(239,68,68,0.1)" : "rgba(34,211,238,0.1)",
                              color: ns === "CANCELLED" ? "#ef4444" : "#22d3ee",
                            }}>{ns.replace("_", " ")}</button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {selectedWO && (() => {
        const wo = selectedWO;
        const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
        return (
          <>
            <div onClick={() => setSelectedWO(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 92vw)", background: "var(--bg-card)", zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{wo.title}</h2>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, fontFamily: "monospace" }}>{wo.workOrderNumber}</p>
                </div>
                <button onClick={() => setSelectedWO(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <WRow label="Status" value={<span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{sc.icon} {wo.status.replace("_", " ")}</span>} />
                  <WRow label="Type" value={<span className={`badge ${TYPE_BADGE[wo.type] || "gray"}`}>{wo.type}</span>} />
                  <WRow label="Priority" value={<span className={`badge ${wo.priority === "HIGH" || wo.priority === "CRITICAL" ? "red" : wo.priority === "MEDIUM" ? "amber" : "gray"}`}>{wo.priority}</span>} />
                  {wo.description && (
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Description</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, background: "var(--bg-elevated)", padding: 12, borderRadius: 8 }}>{wo.description}</div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>Schedule & Cost</div>
                  <WRow label="Scheduled Start" value={wo.scheduledStart ? new Date(wo.scheduledStart).toLocaleString() : "—"} />
                  <WRow label="Scheduled End" value={wo.scheduledEnd ? new Date(wo.scheduledEnd).toLocaleString() : "—"} />
                  <WRow label="Actual Start" value={wo.actualStart ? new Date(wo.actualStart).toLocaleString() : "—"} />
                  <WRow label="Actual End" value={wo.actualEnd ? new Date(wo.actualEnd).toLocaleString() : "—"} />
                  <WRow label="Labor Hours" value={wo.laborHours ? `${wo.laborHours}h` : "—"} />
                  <WRow label="Material Cost" value={wo.materialCost ? `₹${Number(wo.materialCost).toLocaleString()}` : "—"} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>Assignment</div>
                  <WRow label="Assigned To" value={wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` : "Unassigned"} />
                  <WRow label="Linked Asset" value={wo.asset ? wo.asset.name : "—"} />
                  <WRow label="Created" value={new Date(wo.createdAt).toLocaleString()} />
                </div>
              </div>
            </div>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
          </>
        );
      })()}

      {/* Create Modal */}
      {showCreate && (
        <>
          <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 480, background: "var(--bg-card)", border: "1px solid var(--border-primary)",
            borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", zIndex: 2001, padding: 24,
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Create Work Order</h3>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input required placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }} />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }}>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="REPAIR">Repair</option>
                  <option value="INSTALLATION">Installation</option>
                  <option value="INSPECTION">Inspection</option>
                </select>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? "Creating..." : "Create"}</button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}

function WRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{typeof value === "string" ? value : value}</span>
    </div>
  );
}
