"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, Plus, Building2, FileText, Package, RefreshCw,
  Filter, Star, DollarSign, AlertTriangle, Calendar, CheckCircle2,
  Clock, Truck, ChevronRight, X, CreditCard, Hash, ArrowRight,
  Loader2, TrendingUp, ShieldCheck, Trash2, Search,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_CONFIG: Record<string, { color: string; bg: string; badge: string }> = {
  ACTIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", badge: "green" },
  EXPIRED: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", badge: "red" },
  PENDING_RENEWAL: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", badge: "amber" },
  DRAFT: { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", badge: "gray" },
  SUBMITTED: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", badge: "blue" },
  APPROVED: { color: "#10b981", bg: "rgba(16,185,129,0.12)", badge: "green" },
  RECEIVED: { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", badge: "purple" },
  CANCELLED: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", badge: "red" },
  PARTIALLY_RECEIVED: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", badge: "amber" },
};

const CONTRACT_TYPE_BADGE: Record<string, string> = {
  WARRANTY: "green", MAINTENANCE: "amber", LEASE: "blue", LICENSE: "purple", SUPPORT: "cyan", AMC: "red",
};

const TABS = ["Dashboard", "Vendors", "Contracts", "Purchase Orders"] as const;

export default function ProcurementPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Dashboard");
  const [vendors, setVendors] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [showModal, setShowModal] = useState("");
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [poItems, setPoItems] = useState<{ description: string; quantity: number; unitPrice: number }[]>([
    { description: "", quantity: 1, unitPrice: 0 }
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, c, p, d] = await Promise.all([
        apiFetch("/procurement/vendors"),
        apiFetch("/procurement/contracts"),
        apiFetch("/procurement/purchase-orders"),
        apiFetch("/procurement/dashboard"),
      ]);
      setVendors(v); setContracts(c); setPos(p); setDashboard(d);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitVendor = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await apiFetch("/procurement/vendors", { method: "POST", body: JSON.stringify(form) }); closeModal(); load(); } catch(e) { alert(String(e)); }
    setSaving(false);
  };
  const submitContract = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await apiFetch("/procurement/contracts", { method: "POST", body: JSON.stringify(form) }); closeModal(); load(); } catch(e) { alert(String(e)); }
    setSaving(false);
  };
  const submitPO = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (poItems.length === 0) {
        alert("Please add at least one line item.");
        setSaving(false);
        return;
      }
      for (const item of poItems) {
        if (!item.description.trim()) {
          alert("All items must have a description.");
          setSaving(false);
          return;
        }
      }

      await apiFetch("/procurement/purchase-orders", {
        method: "POST",
        body: JSON.stringify({ ...form, items: poItems }),
      }); closeModal(); load();
    } catch(e) { alert(String(e)); }
    setSaving(false);
  };
  const approvePO = async (id: string) => { try { await apiFetch(`/procurement/purchase-orders/${id}/approve`, { method: "POST" }); load(); } catch (e) { alert('Failed to approve purchase order'); } };
  const receivePO = async (id: string) => { try { await apiFetch(`/procurement/purchase-orders/${id}/receive`, { method: "POST", body: JSON.stringify({}) }); load(); } catch (e) { alert('Failed to receive purchase order'); } };
  const closeModal = () => { setShowModal(""); setForm({}); setPoItems([{ description: "", quantity: 1, unitPrice: 0 }]); };

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)",
    background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", width: "100%",
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Procurement & Vendor Management</h1>
          <p className="page-subtitle">
            {vendors.length} vendors · {contracts.length} contracts · {pos.length} purchase orders
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => load()}><RefreshCw size={14} /></button>
          {tab === "Vendors" && <button className="btn btn-primary" onClick={() => setShowModal("vendor")}><Plus size={14} /> Add Vendor</button>}
          {tab === "Contracts" && <button className="btn btn-primary" onClick={() => setShowModal("contract")}><Plus size={14} /> Add Contract</button>}
          {tab === "Purchase Orders" && <button className="btn btn-primary" onClick={() => setShowModal("po")}><Plus size={14} /> Create PO</button>}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="card" style={{ marginBottom: 16, padding: "8px 12px", display: "flex", gap: 4, alignItems: "center" }}>
        {TABS.map(t => {
          const icons: Record<string, any> = { Dashboard: <TrendingUp size={14} />, Vendors: <Building2 size={14} />, Contracts: <FileText size={14} />, "Purchase Orders": <ShoppingCart size={14} /> };
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
              background: tab === t ? "rgba(6,182,212,0.15)" : "transparent",
              color: tab === t ? "#22d3ee" : "var(--text-secondary)",
            }}>{icons[t]} {t}</button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80, color: "var(--text-tertiary)" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          {/* ─── Dashboard ─── */}
          {tab === "Dashboard" && dashboard && (
            <>
              <div className="stats-grid">
                {[
                  { label: "Active Vendors", value: dashboard.activeVendors, icon: <Building2 size={18} />, color: "#10b981", targetTab: "Vendors" as const },
                  { label: "Active Contracts", value: dashboard.contractsByStatus?.find((c:any) => c.status === "ACTIVE")?._count || 0, icon: <FileText size={18} />, color: "#3b82f6", targetTab: "Contracts" as const },
                  { label: "Pending POs", value: dashboard.posByStatus?.find((p:any) => p.status === "SUBMITTED")?._count || 0, icon: <Package size={18} />, color: "#f59e0b", targetTab: "Purchase Orders" as const },
                  { label: "Expiring Soon", value: dashboard.expiringContracts, icon: <AlertTriangle size={18} />, color: "#ef4444", targetTab: "Contracts" as const },
                ].map(c => (
                  <div key={c.label} className="stat-card" style={{ cursor: "pointer", transition: "transform 0.15s" }}
                    onClick={() => setTab(c.targetTab)}
                    onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
                    <div className="stat-content">
                      <div className="stat-label">{c.label}</div>
                      <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
                    </div>
                    <div style={{ color: c.color, opacity: 0.6, display: "flex", alignItems: "center", gap: 4 }}>{c.icon} <ChevronRight size={12} /></div>
                  </div>
                ))}
              </div>

              {dashboard.expiringDetails?.length > 0 && (
                <div className="card" style={{ borderLeft: "3px solid #ef4444" }}>
                  <div className="card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                      <span className="card-title" style={{ color: "#f87171" }}>Contracts Expiring Within 30 Days</span>
                    </div>
                  </div>
                  {dashboard.expiringDetails.map((c: any) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-primary)" }}>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>{c.title}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{c.vendor?.name}</span>
                        <span className="badge red">{new Date(c.endDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── Vendors ─── */}
          {tab === "Vendors" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                <Search size={15} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by vendor name, email, or contact person…"
                  style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                />
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendor</th><th>Category</th><th>Contact</th><th>Payment</th>
                    <th>Rating</th><th>Contracts</th><th>POs</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.filter(v => { const q = searchQuery.toLowerCase(); return !q || v.name?.toLowerCase().includes(q) || v.email?.toLowerCase().includes(q) || v.contactPerson?.toLowerCase().includes(q); }).map(v => (
                    <tr key={v.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{v.name}</div>
                        {v.email && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{v.email}</div>}
                      </td>
                      <td>{v.category ? <span className="badge cyan">{v.category}</span> : <span style={{ color: "var(--text-tertiary)" }}>—</span>}</td>
                      <td style={{ fontSize: 12 }}>{v.contactPerson || v.email || "—"}</td>
                      <td style={{ fontSize: 12 }}>{v.paymentTerms || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 1 }}>
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={12} fill={i <= (v.rating || 0) ? "#fbbf24" : "none"} style={{ color: i <= (v.rating || 0) ? "#fbbf24" : "var(--text-muted)" }} />
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>{v._count?.contracts || 0}</td>
                      <td style={{ textAlign: "center" }}>{v._count?.purchaseOrders || 0}</td>
                      <td><span className={`badge ${STATUS_CONFIG[v.status]?.badge || "gray"}`}>{v.status}</span></td>
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                      No vendors yet. Click &quot;Add Vendor&quot; to get started.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Contracts ─── */}
          {tab === "Contracts" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                <Search size={15} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by contract title or vendor name…"
                  style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                />
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract</th><th>Vendor</th><th>Type</th><th>Period</th><th>Value</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.filter(c => { const q = searchQuery.toLowerCase(); return !q || c.title?.toLowerCase().includes(q) || c.vendor?.name?.toLowerCase().includes(q); }).map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.title}</td>
                      <td style={{ fontSize: 12 }}>{c.vendor?.name || "—"}</td>
                      <td><span className={`badge ${CONTRACT_TYPE_BADGE[c.type] || "gray"}`}>{c.type}</span></td>
                      <td style={{ fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={11} style={{ color: "var(--text-tertiary)" }} />
                          {new Date(c.startDate).toLocaleDateString()} — {new Date(c.endDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          ₹{Number(c.value || 0).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td><span className={`badge ${STATUS_CONFIG[c.status]?.badge || "gray"}`}>{c.status}</span></td>
                    </tr>
                  ))}
                  {contracts.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                      No contracts yet. Click &quot;Add Contract&quot; to create one.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Purchase Orders ─── */}
          {tab === "Purchase Orders" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                <Search size={15} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by PO number or vendor name…"
                  style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                />
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO Number</th><th>Vendor</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.filter(p => { const q = searchQuery.toLowerCase(); return !q || p.poNumber?.toLowerCase().includes(q) || p.vendor?.name?.toLowerCase().includes(q); }).map(p => {
                    const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--brand-400)", fontFamily: "monospace" }}>{p.poNumber}</div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""}
                          </div>
                        </td>
                        <td style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>{p.vendor?.name || "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge gray">{p._count?.items || p.items?.length || 0} items</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>
                            ₹{Number(p.totalAmount || 0).toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
                            borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color,
                          }}>{p.status.replace(/_/g, " ")}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            {p.status === "SUBMITTED" && (
                              <button onClick={() => approvePO(p.id)} style={{
                                padding: "3px 10px", borderRadius: 5, border: "none", fontSize: 10,
                                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                background: "rgba(16,185,129,0.12)", color: "#10b981",
                              }}><CheckCircle2 size={10} style={{ marginRight: 3 }} />Approve</button>
                            )}
                            {p.status === "APPROVED" && (
                              <button onClick={() => receivePO(p.id)} style={{
                                padding: "3px 10px", borderRadius: 5, border: "none", fontSize: 10,
                                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                background: "rgba(139,92,246,0.12)", color: "#a78bfa",
                              }}><Truck size={10} style={{ marginRight: 3 }} />Receive</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pos.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                      No purchase orders yet. Click &quot;Create PO&quot; to start.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── Modals ─── */}
      {showModal && (
        <>
          <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "var(--modal-overlay)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: showModal === "po" ? 720 : 520, maxHeight: "85vh", overflowY: "auto",
            background: "var(--bg-card)", border: "1px solid var(--border-primary)",
            borderRadius: 16, boxShadow: "var(--modal-shadow)", zIndex: 2001, padding: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                {showModal === "vendor" && "Add Vendor"}
                {showModal === "contract" && "Create Contract"}
                {showModal === "po" && "Create Purchase Order"}
              </h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {showModal === "vendor" && (
              <form onSubmit={submitVendor} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input required placeholder="Company Name *" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input placeholder="Email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
                  <input placeholder="Phone" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input placeholder="Contact Person" value={form.contactPerson || ""} onChange={e => setForm({ ...form, contactPerson: e.target.value })} style={inputStyle} />
                  <select value={form.category || ""} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                    <option value="">Category</option>
                    {["HARDWARE", "SOFTWARE", "NETWORK", "SERVICES", "OFFICE", "OTHER"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input placeholder="Website" value={form.website || ""} onChange={e => setForm({ ...form, website: e.target.value })} style={inputStyle} />
                  <select value={form.paymentTerms || ""} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} style={inputStyle}>
                    <option value="">Payment Terms</option>
                    {["NET_15", "NET_30", "NET_45", "NET_60", "NET_90", "IMMEDIATE"].map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Add Vendor"}</button>
                </div>
              </form>
            )}

            {showModal === "contract" && (
              <form onSubmit={submitContract} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <select required value={form.vendorId || ""} onChange={e => setForm({ ...form, vendorId: e.target.value })} style={inputStyle}>
                  <option value="">Select Vendor *</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <input required placeholder="Contract Title *" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <select required value={form.type || ""} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                    <option value="">Type *</option>
                    {["WARRANTY", "MAINTENANCE", "LEASE", "LICENSE", "SUPPORT", "AMC"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input required type="number" placeholder="Value (₹)" value={form.value || ""} onChange={e => setForm({ ...form, value: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>Start Date *</label>
                    <input required type="date" value={form.startDate || ""} onChange={e => setForm({ ...form, startDate: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>End Date *</label>
                    <input required type="date" value={form.endDate || ""} onChange={e => setForm({ ...form, endDate: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Create Contract"}</button>
                </div>
              </form>
            )}

            {showModal === "po" && (
              <form onSubmit={submitPO} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <select required value={form.vendorId || ""} onChange={e => setForm({ ...form, vendorId: e.target.value })} style={inputStyle}>
                  <option value="">Select Vendor *</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>Expected Delivery</label>
                  <input type="date" value={form.expectedDelivery || ""} onChange={e => setForm({ ...form, expectedDelivery: e.target.value })} style={inputStyle} />
                </div>
                
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Line Items</label>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{poItems.length} {poItems.length === 1 ? "item" : "items"}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {/* Header Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "3.5fr 1fr 1.5fr 1fr auto", gap: 8, padding: "0 4px", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>
                      <div>Item Description *</div>
                      <div style={{ textAlign: "center" }}>Qty *</div>
                      <div>Unit Price (₹) *</div>
                      <div style={{ textAlign: "right" }}>Total (₹)</div>
                      <div style={{ width: 28 }}></div>
                    </div>

                    {/* Item Rows */}
                    {poItems.map((item, idx) => {
                      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
                      return (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "3.5fr 1fr 1.5fr 1fr auto", gap: 8, alignItems: "center" }}>
                          <input
                            required
                            placeholder="e.g. Dell Latitude 5540"
                            value={item.description}
                            onChange={e => {
                              const newItems = [...poItems];
                              newItems[idx].description = e.target.value;
                              setPoItems(newItems);
                            }}
                            style={inputStyle}
                          />
                          <input
                            required
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={e => {
                              const newItems = [...poItems];
                              newItems[idx].quantity = Math.max(1, parseInt(e.target.value) || 0);
                              setPoItems(newItems);
                            }}
                            style={{ ...inputStyle, textAlign: "center" }}
                          />
                          <input
                            required
                            type="number"
                            min="0"
                            placeholder="Price"
                            value={item.unitPrice || ""}
                            onChange={e => {
                              const newItems = [...poItems];
                              newItems[idx].unitPrice = Math.max(0, parseFloat(e.target.value) || 0);
                              setPoItems(newItems);
                            }}
                            style={inputStyle}
                          />
                          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", paddingRight: 4 }}>
                            ₹{itemTotal.toLocaleString("en-IN")}
                          </div>
                          <button
                            type="button"
                            disabled={poItems.length === 1}
                            onClick={() => {
                              if (poItems.length > 1) {
                                setPoItems(poItems.filter((_, i) => i !== idx));
                              }
                            }}
                            style={{
                              background: "rgba(239,68,68,0.1)",
                              border: "none",
                              color: "#ef4444",
                              borderRadius: 8,
                              width: 32,
                              height: 32,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: poItems.length === 1 ? "not-allowed" : "pointer",
                              opacity: poItems.length === 1 ? 0.4 : 1,
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={e => {
                              if (poItems.length > 1) e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                            }}
                            onMouseLeave={e => {
                              if (poItems.length > 1) e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions & Summary Footer */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px dashed var(--border-primary)",
                    borderRadius: 10,
                    marginTop: 12
                  }}>
                    <button
                      type="button"
                      onClick={() => setPoItems([...poItems, { description: "", quantity: 1, unitPrice: 0 }])}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "rgba(34, 211, 238, 0.08)",
                        border: "1px solid rgba(34, 211, 238, 0.2)",
                        color: "#22d3ee",
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(34, 211, 238, 0.15)";
                        e.currentTarget.style.borderColor = "rgba(34, 211, 238, 0.4)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(34, 211, 238, 0.08)";
                        e.currentTarget.style.borderColor = "rgba(34, 211, 238, 0.2)";
                      }}
                    >
                      <Plus size={14} /> Add Line Item
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Total Amount:</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--brand-400)" }}>
                        ₹{poItems.reduce((acc, item) => acc + (item.quantity || 0) * (item.unitPrice || 0), 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Creating..." : "Create PO"}</button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}
