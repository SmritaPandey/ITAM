"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Building2, Search, ChevronRight, Users, Package, Ticket } from "lucide-react";

const PLAN_COLORS: Record<string, string> = { STARTER: "#64748b", PROFESSIONAL: "#06b6d4", ENTERPRISE: "#8b5cf6", ON_PREMISE: "#f59e0b" };
const STATUS_COLORS: Record<string, string> = { ACTIVE: "#10b981", SUSPENDED: "#ef4444", TRIAL: "#f59e0b", CANCELLED: "#64748b" };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");

  function load(q?: string) {
    setLoading(true);
    apiFetch(`/admin/tenants?limit=50${q ? `&search=${encodeURIComponent(q)}` : ""}`).then(d => {
      setTenants(d.data || []); setTotal(d.total || 0);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleSearch(e: React.FormEvent) { e.preventDefault(); load(search); }

  function openDetail(id: string) {
    setDetailLoading(true);
    apiFetch(`/admin/tenants/${id}`).then(d => {
      setSelected(d); setEditPlan(d.plan); setEditStatus(d.status);
    }).finally(() => setDetailLoading(false));
  }

  async function saveTenant() {
    if (!selected) return;
    await apiFetch(`/admin/tenants/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: editPlan, status: editStatus }),
    });
    setSelected(null); load(search);
  }

  async function deleteTenant(id: string) {
    if (!confirm("Are you sure? This will suspend this tenant.")) return;
    await apiFetch(`/admin/tenants/${id}`, { method: "DELETE" });
    setSelected(null); load(search);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Tenant Management</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{total} tenants registered</p>
        </div>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants..."
              style={{ padding: "8px 12px 8px 32px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, width: 240, outline: "none" }} />
          </div>
        </form>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
              {["Name", "Plan", "Status", "Users", "Assets", "Tickets", "Created", ""].map(h => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>No tenants found</td></tr>
            ) : tenants.map(t => (
              <tr key={t.id} style={{ borderBottom: "1px solid var(--border-primary)", cursor: "pointer" }} onClick={() => openDetail(t.id)}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t.slug}</div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${PLAN_COLORS[t.plan] || "#64748b"}15`, color: PLAN_COLORS[t.plan] || "#64748b" }}>{t.plan}</span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${STATUS_COLORS[t.status] || "#64748b"}15`, color: STATUS_COLORS[t.status] || "#64748b" }}>{t.status}</span>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{t._count?.users || 0}</td>
                <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{t._count?.assets || 0}</td>
                <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{t._count?.tickets || 0}</td>
                <td style={{ padding: "12px 14px", color: "var(--text-tertiary)", fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: "12px 14px" }}><ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: "var(--bg-card)", borderLeft: "1px solid var(--border-primary)", zIndex: 2001, overflow: "auto", padding: 28 }}>
            {detailLoading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</div> : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{selected.name}</h2>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{selected.slug} • ID: {selected.id.slice(0, 8)}...</p>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 20 }}>×</button>
                </div>

                {/* Edit Plan & Status */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Plan</label>
                    <select value={editPlan} onChange={e => setEditPlan(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                      {["STARTER", "PROFESSIONAL", "ENTERPRISE", "ON_PREMISE"].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                      {["ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                  <button onClick={saveTenant} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#dc2626", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save Changes</button>
                  <button onClick={() => deleteTenant(selected.id)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Suspend Tenant</button>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                  {[
                    { label: "Users", value: selected._count?.users || 0, icon: Users, color: "#8b5cf6" },
                    { label: "Assets", value: selected._count?.assets || 0, icon: Package, color: "#10b981" },
                    { label: "Tickets", value: selected._count?.tickets || 0, icon: Ticket, color: "#f59e0b" },
                    { label: "Scans", value: selected._count?.scanJobs || 0, icon: Building2, color: "#3b82f6" },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center", padding: 12, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Subscription */}
                {selected.subscription && (
                  <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Subscription</h4>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 2 }}>
                      <div>Plan: <strong>{selected.subscription.plan}</strong></div>
                      <div>Status: <strong>{selected.subscription.status}</strong></div>
                      <div>MRR: <strong>₹{Number(selected.subscription.mrr || 0).toLocaleString()}</strong></div>
                      <div>Start: {new Date(selected.subscription.startDate).toLocaleDateString()}</div>
                      {selected.subscription.endDate && <div>End: {new Date(selected.subscription.endDate).toLocaleDateString()}</div>}
                    </div>
                  </div>
                )}

                {/* Users */}
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Users ({selected.users?.length || 0})</h4>
                <div style={{ borderRadius: 10, border: "1px solid var(--border-primary)", overflow: "hidden", marginBottom: 20 }}>
                  {(selected.users || []).map((u: any) => (
                    <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border-primary)" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.firstName} {u.lastName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{u.email}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>{u.role?.name}</span>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {u.lastLoginAt ? `Last: ${new Date(u.lastLoginAt).toLocaleDateString()}` : "Never logged in"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payments */}
                {selected.subscription?.payments?.length > 0 && (
                  <>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Payment History</h4>
                    <div style={{ borderRadius: 10, border: "1px solid var(--border-primary)", overflow: "hidden" }}>
                      {selected.subscription.payments.map((p: any) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border-primary)" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>₹{Number(p.amount).toLocaleString()}</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{p.method} • {p.referenceId || "—"}</div>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "right" }}>
                            <div>{p.status}</div>
                            <div>{new Date(p.paidAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
