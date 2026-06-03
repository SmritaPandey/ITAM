"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench, Plus, Clock, CheckCircle2, AlertCircle, Filter, RefreshCw,
  ArrowRight, ChevronDown, Calendar, User, Package, DollarSign, Loader2,
  Edit3, Check, X, ClipboardList, Info, ExternalLink, Trash2, Search
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PageHelp } from "@/components/HelpSystem";

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  CREATED: { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", icon: <Clock size={14} /> },
  ASSIGNED: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", icon: <User size={14} /> },
  IN_PROGRESS: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: <Loader2 size={14} style={{ animation: "spin 1.5s linear infinite" }} /> },
  COMPLETED: { color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: <CheckCircle2 size={14} /> },
  VERIFIED: { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", icon: <CheckCircle2 size={14} /> },
  CANCELLED: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: <AlertCircle size={14} /> },
};

const TYPE_BADGE: Record<string, string> = {
  MAINTENANCE: "amber",
  REPAIR: "red",
  INSTALLATION: "green",
  INSPECTION: "blue",
};

export default function WorkOrdersPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>({});
  const [workOrders, setWorkOrders] = useState<any>({ data: [], total: 0 });
  const [assets, setAssets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Custom Create Form State
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "MAINTENANCE",
    priority: "MEDIUM",
    assetId: "",
    assignedToId: "",
    scheduledStart: "",
    scheduledEnd: "",
  });

  const [selectedWO, setSelectedWO] = useState<any>(null);
  
  // Custom Inline Editing Drawer Form State
  const [editMode, setEditMode] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    type: "MAINTENANCE",
    priority: "MEDIUM",
    assignedToId: "",
    assetId: "",
    scheduledStart: "",
    scheduledEnd: "",
    actualStart: "",
    actualEnd: "",
    laborHours: 0,
    materialCost: 0,
    notes: "",
  });

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    const params = status ? `?status=${status}` : "";
    try {
      const [s, wo, aData, uData] = await Promise.all([
        apiFetch("/work-orders/stats"),
        apiFetch(`/work-orders${params}`),
        apiFetch("/assets?limit=100"),
        apiFetch("/users?limit=100"),
      ]);
      setStats(s || {});
      setWorkOrders(wo || { data: [], total: 0 });
      setAssets(Array.isArray(aData.data) ? aData.data : []);
      setUsers(Array.isArray(uData.data) ? uData.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this work order? This cannot be undone.")) return;
    try { await apiFetch(`/work-orders/${id}`, { method: "DELETE" }); setSelectedWO(null); load(); } catch { alert("Failed to delete."); }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...form,
        scheduledStart: form.scheduledStart || null,
        scheduledEnd: form.scheduledEnd || null,
        assetId: form.assetId || null,
        assignedToId: form.assignedToId || null,
      };
      await apiFetch("/work-orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowCreate(false);
      setForm({
        title: "",
        description: "",
        type: "MAINTENANCE",
        priority: "MEDIUM",
        assetId: "",
        assignedToId: "",
        scheduledStart: "",
        scheduledEnd: "",
      });
      load(statusFilter);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateWorkOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWO) return;
    setUpdating(true);
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        type: editForm.type,
        priority: editForm.priority,
        assignedToId: editForm.assignedToId || null,
        assetId: editForm.assetId || null,
        scheduledStart: editForm.scheduledStart ? new Date(editForm.scheduledStart) : null,
        scheduledEnd: editForm.scheduledEnd ? new Date(editForm.scheduledEnd) : null,
        actualStart: editForm.actualStart ? new Date(editForm.actualStart) : null,
        actualEnd: editForm.actualEnd ? new Date(editForm.actualEnd) : null,
        laborHours: editForm.laborHours ? Number(editForm.laborHours) : null,
        materialCost: editForm.materialCost ? Number(editForm.materialCost) : null,
        notes: editForm.notes || null,
      };

      const updated = await apiFetch(`/work-orders/${selectedWO.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      
      setSelectedWO(updated);
      setEditMode(false);
      load(statusFilter);
    } catch (err: any) {
      alert(`Failed to save changes: ${err.message || err}`);
    } finally {
      setUpdating(false);
    }
  }

  async function handleTransition(id: string, status: string) {
    try {
      await apiFetch(`/work-orders/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      load(statusFilter);
      setSelectedWO(null);
      setEditMode(false);
    } catch (err: any) {
      alert(`Failed to transition status: ${err.message || err}`);
    }
  }

  const statCards = [
    { label: "Total", value: stats.total || 0, color: "#22d3ee", icon: <Wrench size={18} /> },
    { label: "Created", value: stats.created || 0, color: "#94a3b8", icon: <Clock size={18} /> },
    { label: "In Progress", value: stats.inProgress || 0, color: "#f59e0b", icon: <Loader2 size={18} /> },
    { label: "Completed", value: stats.completed || 0, color: "#10b981", icon: <CheckCircle2 size={18} /> },
    { label: "Verified", value: stats.verified || 0, color: "#8b5cf6", icon: <CheckCircle2 size={18} /> },
  ];

  function openEditForm() {
    if (!selectedWO) return;
    setEditForm({
      title: selectedWO.title || "",
      description: selectedWO.description || "",
      type: selectedWO.type || "MAINTENANCE",
      priority: selectedWO.priority || "MEDIUM",
      assignedToId: selectedWO.assignedToId || "",
      assetId: selectedWO.assetId || "",
      scheduledStart: selectedWO.scheduledStart ? new Date(selectedWO.scheduledStart).toISOString().slice(0, 16) : "",
      scheduledEnd: selectedWO.scheduledEnd ? new Date(selectedWO.scheduledEnd).toISOString().slice(0, 16) : "",
      actualStart: selectedWO.actualStart ? new Date(selectedWO.actualStart).toISOString().slice(0, 16) : "",
      actualEnd: selectedWO.actualEnd ? new Date(selectedWO.actualEnd).toISOString().slice(0, 16) : "",
      laborHours: selectedWO.laborHours || 0,
      materialCost: selectedWO.materialCost || 0,
      notes: selectedWO.notes || "",
    });
    setEditMode(true);
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Work Orders</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
            Maintenance, repair, and facility asset service runbook orchestrator
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => load(statusFilter)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, padding: 0, borderRadius: 10 }}>
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, fontWeight: 600 }}>
            <Plus size={16} /> Create Work Order
          </button>
        </div>
      </div>

      <PageHelp id="workorders" title="Work Orders Lifecycle">
        Create, dispatch, and document equipment services. Keep track of materials, schedule dates, labor hours, and resolutions. Work orders progress dynamically: <strong>Created → Assigned → In Progress → Completed → Verified</strong>.
      </PageHelp>

      {/* Search Bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "8px 14px" }}>
          <Search size={15} style={{ color: "var(--text-tertiary)" }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search work orders by title, description, or technician..."
            style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        </div>
      </div>

      {/* Cybernetic Stats Grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 24 }}>
        {statCards.map(s => {
          const filterValue = s.label === "Total" ? "" : s.label.toUpperCase().replace(" ", "_");
          const isSelected = statusFilter === filterValue;
          return (
            <div key={s.label} className="stat-card"
              style={{
                cursor: "pointer",
                borderLeft: isSelected ? "3px solid var(--brand-400)" : undefined,
                transition: "transform 0.15s, border-color 0.15s",
                borderRadius: 12
              }}
              onClick={() => {
                setStatusFilter(filterValue);
                load(filterValue);
              }}>
              <div className="stat-content">
                <div className="stat-label" style={{ fontWeight: 600, color: isSelected ? "var(--text-primary)" : "var(--text-tertiary)" }}>{s.label}</div>
                <div className="stat-value" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{s.value}</div>
              </div>
              <div style={{ color: s.color }}>{s.icon}</div>
            </div>
          );
        })}
      </div>

      {/* Modern Filter Chip Bar */}
      <div className="card" style={{ marginBottom: 16, padding: "10px 16px", display: "flex", gap: 8, alignItems: "center", borderRadius: 12 }}>
        <Filter size={14} style={{ color: "var(--text-tertiary)" }} />
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 700, marginRight: 8 }}>Filter State:</span>
        {["", "CREATED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "VERIFIED", "CANCELLED"].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); load(s); }}
            style={{
              padding: "5px 14px",
              borderRadius: 8,
              border: "none",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
              background: statusFilter === s ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.03)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: statusFilter === s ? "rgba(6,182,212,0.3)" : "var(--border-primary)",
              color: statusFilter === s ? "#22d3ee" : "var(--text-secondary)",
            }}>{s ? s.replace("_", " ") : "ALL"}</button>
        ))}
      </div>

      {/* Main Work Orders Grid */}
      <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--border-primary)" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Work Order</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned Technician</th>
              <th>Linked Asset</th>
              <th>Schedule</th>
              <th>Resource Cost</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 50, color: "var(--text-tertiary)" }}>
                <Loader2 size={18} className="spin" style={{ animation: "spin 1.5s linear infinite", margin: "0 auto 8px" }} />
                Synchronizing task records...
              </td></tr>
            ) : (() => {
              const q = searchQuery.toLowerCase();
              const filteredWOs = (workOrders.data || []).filter((wo: any) => {
                if (!q) return true;
                const techObj = users.find((u: any) => u.id === wo.assignedToId);
                const techName = techObj ? `${techObj.firstName} ${techObj.lastName}`.toLowerCase() : "";
                return wo.title?.toLowerCase().includes(q) ||
                       wo.description?.toLowerCase().includes(q) ||
                       techName.includes(q);
              });
              if (filteredWOs.length === 0) return (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 50, color: "var(--text-tertiary)" }}>
                  <Wrench size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{searchQuery ? "No matching work orders" : "No Work Orders Active"}</div>
                  <p style={{ fontSize: 12, marginTop: 4 }}>{searchQuery ? "Try adjusting your search query." : 'Click "Create Work Order" to catalog a maintenance event.'}</p>
                </td></tr>
              );
              return filteredWOs.map((wo: any) => {
              const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
              const assetObj = assets.find(a => a.id === wo.assetId);
              const techObj = users.find(u => u.id === wo.assignedToId);

              return (
                <tr key={wo.id} style={{ cursor: "pointer", transition: "background 0.15s" }} onClick={() => { setSelectedWO(wo); setEditMode(false); }}>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--brand-400)" }}>{wo.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>{wo.workOrderNumber}</div>
                  </td>
                  <td><span className={`badge ${TYPE_BADGE[wo.type] || "gray"}`} style={{ fontWeight: 650 }}>{wo.type}</span></td>
                  <td><span className={`badge ${wo.priority === "HIGH" || wo.priority === "CRITICAL" ? "red" : wo.priority === "MEDIUM" ? "amber" : "gray"}`} style={{ fontWeight: 700 }}>{wo.priority}</span></td>
                  <td>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px",
                      borderRadius: 6, fontSize: 11, fontWeight: 750,
                      background: sc.bg, color: sc.color,
                    }}>{sc.icon} {wo.status.replace("_", " ")}</span>
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    {techObj ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <User size={11} style={{ color: "var(--text-tertiary)" }} />
                        <span>{techObj.firstName} {techObj.lastName}</span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)" }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    {assetObj ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Package size={11} style={{ color: "var(--text-tertiary)" }} />
                        <span>{assetObj.name}</span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)" }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {wo.scheduledStart ? new Date(wo.scheduledStart).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                    {wo.laborHours ? `${wo.laborHours}h` : ""}
                    {wo.materialCost ? `${wo.laborHours ? " / " : ""}₹${wo.materialCost.toLocaleString()}` : (!wo.laborHours ? "—" : "")}
                  </td>
                </tr>
              );
            })})()}
          </tbody>
        </table>
      </div>

      {/* Slide-In Details & Editing Panel */}
      {selectedWO && (() => {
        const wo = selectedWO;
        const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
        const linkedAsset = assets.find(a => a.id === wo.assetId);
        const assignedTech = users.find(u => u.id === wo.assignedToId);

        const nextStates: Record<string, string[]> = {
          CREATED: ["ASSIGNED", "CANCELLED"],
          ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
          IN_PROGRESS: ["COMPLETED", "CANCELLED"],
          COMPLETED: ["VERIFIED"],
        };

        return (
          <>
            <div onClick={() => { setSelectedWO(null); setEditMode(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 92vw)", background: "var(--bg-card)", zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out", boxShadow: "-12px 0 40px rgba(0,0,0,0.5)" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>{editMode ? "Modify Work Details" : wo.title}</h2>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "4px 0 0", fontFamily: "monospace" }}>{wo.workOrderNumber}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {!editMode && (
                    <button onClick={openEditForm} className="btn btn-secondary" style={{ padding: "5px 10px", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700 }}>
                      <Edit3 size={12} /> Edit Details
                    </button>
                  )}
                  <button onClick={() => { setSelectedWO(null); setEditMode(false); }} className="btn btn-secondary" style={{ padding: "5px 10px" }}><X size={14} /></button>
                </div>
              </div>

              {editMode ? (
                /* EDIT FORM LAYOUT */
                <form onSubmit={handleUpdateWorkOrder} style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Task Title *</label>
                    <input required value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Problem / Description</label>
                    <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} style={inputStyle}>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="REPAIR">Repair</option>
                        <option value="INSTALLATION">Installation</option>
                        <option value="INSPECTION">Inspection</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Priority</label>
                      <select value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })} style={inputStyle}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Assign Technician</label>
                      <select value={editForm.assignedToId} onChange={e => setEditForm({ ...editForm, assignedToId: e.target.value })} style={inputStyle}>
                        <option value="">Select Technician...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Link Asset</label>
                      <select value={editForm.assetId} onChange={e => setEditForm({ ...editForm, assetId: e.target.value })} style={inputStyle}>
                        <option value="">Select Asset...</option>
                        {assets.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "No tag"})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Scheduled Start Date</label>
                      <input type="datetime-local" value={editForm.scheduledStart} onChange={e => setEditForm({ ...editForm, scheduledStart: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Scheduled End Date</label>
                      <input type="datetime-local" value={editForm.scheduledEnd} onChange={e => setEditForm({ ...editForm, scheduledEnd: e.target.value })} style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-400)", borderBottom: "1px solid var(--border-primary)", paddingTop: 10, paddingBottom: 4 }}>
                    Resource Logs &amp; Metrics
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Actual Start Date</label>
                      <input type="datetime-local" value={editForm.actualStart} onChange={e => setEditForm({ ...editForm, actualStart: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Actual End Date</label>
                      <input type="datetime-local" value={editForm.actualEnd} onChange={e => setEditForm({ ...editForm, actualEnd: e.target.value })} style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Labor Hours Spent</label>
                      <input type="number" step="0.1" min="0" value={editForm.laborHours} onChange={e => setEditForm({ ...editForm, laborHours: Number(e.target.value) })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Material Cost (₹)</label>
                      <input type="number" min="0" value={editForm.materialCost} onChange={e => setEditForm({ ...editForm, materialCost: Number(e.target.value) })} style={inputStyle} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Technician Service Notes &amp; Resolutions</label>
                    <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} placeholder="Describe parts replaced, actions taken, or blockers..." style={{ ...inputStyle, resize: "vertical" }} />
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={updating}>
                      {updating ? <><Loader2 size={12} className="spin" /> Saving...</> : <><Check size={12} /> Save Updates</>}
                    </button>
                  </div>
                </form>
              ) : (
                /* STANDARD READ-ONLY DETAILS VIEW */
                <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <WRow label="Service Stage" value={<span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 750, background: sc.bg, color: sc.color }}>{sc.icon} {wo.status.replace("_", " ")}</span>} />
                    <WRow label="Task Type" value={<span className={`badge ${TYPE_BADGE[wo.type] || "gray"}`}>{wo.type}</span>} />
                    <WRow label="Priority Class" value={<span className={`badge ${wo.priority === "HIGH" || wo.priority === "CRITICAL" ? "red" : wo.priority === "MEDIUM" ? "amber" : "gray"}`} style={{ fontWeight: 700 }}>{wo.priority}</span>} />
                    
                    {wo.description && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Task Description</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, background: "var(--bg-elevated)", padding: 12, borderRadius: 8, border: "1px solid var(--border-primary)" }}>{wo.description}</div>
                      </div>
                    )}
                    
                    {wo.notes && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: "var(--brand-400)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Technician Notes &amp; Resolution</div>
                        <div style={{ fontSize: 12.5, color: "var(--success)", lineHeight: 1.5, background: "rgba(16,185,129,0.05)", padding: 12, borderRadius: 8, border: "1px solid rgba(16,185,129,0.15)" }}>{wo.notes}</div>
                      </div>
                    )}

                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>
                      Schedule Details
                    </div>
                    <WRow label="Scheduled Start" value={wo.scheduledStart ? new Date(wo.scheduledStart).toLocaleString("en-IN") : "—"} />
                    <WRow label="Scheduled End" value={wo.scheduledEnd ? new Date(wo.scheduledEnd).toLocaleString("en-IN") : "—"} />
                    <WRow label="Actual Commenced" value={wo.actualStart ? new Date(wo.actualStart).toLocaleString("en-IN") : "—"} />
                    <WRow label="Actual Finished" value={wo.actualEnd ? new Date(wo.actualEnd).toLocaleString("en-IN") : "—"} />

                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>
                      Assignment &amp; Mapping
                    </div>
                    <WRow label="Technician Assigned" value={assignedTech ? `${assignedTech.firstName} ${assignedTech.lastName}` : <span style={{ color: "var(--text-tertiary)" }}>Unassigned</span>} />
                    <WRow label="Linked CMDB Asset" value={linkedAsset ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: "var(--brand-400)" }} onClick={() => router.push(`/dashboard/assets/${linkedAsset.id}`)}>
                        <Package size={11} /> {linkedAsset.name} <ExternalLink size={10} style={{ opacity: 0.5 }} />
                      </div>
                    ) : "—"} />

                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>
                      Logged Costs &amp; Materials
                    </div>
                    <WRow label="Labor Hours" value={wo.laborHours ? `${wo.laborHours} Hours` : <span style={{ color: "var(--text-tertiary)" }}>—</span>} />
                    <WRow label="Material Cost" value={wo.materialCost ? `₹${Number(wo.materialCost).toLocaleString()}` : <span style={{ color: "var(--text-tertiary)" }}>—</span>} />
                    
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-tertiary)", borderTop: "1px solid var(--border-primary)", paddingTop: 14, marginTop: 14 }}>
                      <span>Created: {new Date(wo.createdAt).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  {/* Actions Transition Panel */}
                  {(nextStates[wo.status] || []).length > 0 && (
                    <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-primary)", paddingTop: 18, background: "rgba(0,0,0,0.05)", margin: "16px -24px -24px", padding: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                        Transition Task Stage
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        {(nextStates[wo.status] || []).map(ns => (
                          <button key={ns} onClick={() => handleTransition(wo.id, ns)}
                            style={{
                              flex: 1, padding: "10px", borderRadius: 8, border: "none", fontSize: 12,
                              fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                              background: ns === "CANCELLED" ? "rgba(239,68,68,0.12)" : "rgba(34,211,238,0.15)",
                              borderWidth: 1, borderStyle: "solid",
                              borderColor: ns === "CANCELLED" ? "rgba(239,68,68,0.25)" : "rgba(34,211,238,0.25)",
                              color: ns === "CANCELLED" ? "#ef4444" : "#22d3ee",
                            }}>
                            {ns === "IN_PROGRESS" ? "▶ Start Work" : ns === "COMPLETED" ? "✓ Complete Task" : ns.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
          </>
        );
      })()}

      {/* Extended Create Work Order Dialog Modal */}
      {showCreate && (
        <>
          <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 500, background: "var(--bg-card)", border: "1px solid var(--border-primary)",
            borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", zIndex: 2001, padding: 24,
            maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Create Work Order</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Task Title *</label>
                <input required placeholder="e.g. Server Rack Fan replacement" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Problem / Description</label>
                <textarea placeholder="Describe the failure, required action, or diagnostic detail..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Service Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="REPAIR">Repair</option>
                    <option value="INSTALLATION">Installation</option>
                    <option value="INSPECTION">Inspection</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inputStyle}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Assign Technician</label>
                  <select value={form.assignedToId} onChange={e => setForm({ ...form, assignedToId: e.target.value })} style={inputStyle}>
                    <option value="">Select Technician...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Link CMDB Asset</label>
                  <select value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })} style={inputStyle}>
                    <option value="">Select Asset...</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "No tag"})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Scheduled Start</label>
                  <input type="datetime-local" value={form.scheduledStart} onChange={e => setForm({ ...form, scheduledStart: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Scheduled End</label>
                  <input type="datetime-local" value={form.scheduledEnd} onChange={e => setForm({ ...form, scheduledEnd: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <><Loader2 size={12} className="spin" /> Creating...</> : <><Plus size={12} /> Create Task</>}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 5,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "var(--bg-input)",
  border: "1.5px solid var(--border-primary)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

function WRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-secondary)" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 650, maxWidth: "60%", textAlign: "right" }}>{typeof value === "string" ? value : value}</span>
    </div>
  );
}
