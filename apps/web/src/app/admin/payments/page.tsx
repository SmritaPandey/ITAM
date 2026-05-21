"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { CreditCard, Plus, TrendingUp, DollarSign, Calendar } from "lucide-react";

export default function PaymentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [form, setForm] = useState({ tenantId: "", amount: "", currency: "INR", method: "MANUAL", referenceId: "", notes: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    apiFetch("/admin/payments?limit=100").then(d => { setData(d); }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openModal() {
    apiFetch("/admin/tenants?limit=100").then(d => { setTenants(d.data || []); setShowModal(true); });
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tenantId || !form.amount) return;
    setSaving(true);
    await apiFetch("/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setSaving(false); setShowModal(false);
    setForm({ tenantId: "", amount: "", currency: "INR", method: "MANUAL", referenceId: "", notes: "" });
    load();
  }

  function formatRevenue(rev: Record<string, number> | number | undefined) {
    if (typeof rev === "number") {
      return `₹${rev.toLocaleString()}`;
    }
    if (!rev) return "₹0";
    const parts: string[] = [];
    if (rev.INR !== undefined && rev.INR > 0) {
      parts.push(`₹${Number(rev.INR).toLocaleString()}`);
    }
    if (rev.USD !== undefined && rev.USD > 0) {
      parts.push(`$${Number(rev.USD).toLocaleString()}`);
    }
    if (parts.length === 0) {
      return "₹0";
    }
    return parts.join(" / ");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Payment Tracking</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{data?.total || 0} payments recorded</p>
        </div>
        <button onClick={openModal} className="btn btn-primary" style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8,
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={14} /> Record Payment
        </button>
      </div>

      {/* Revenue Summary */}
      {data?.summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Revenue", value: formatRevenue(data.summary.totalRevenue), icon: TrendingUp, color: "var(--brand-500)" },
            { label: "This Month", value: formatRevenue(data.summary.monthRevenue), icon: Calendar, color: "var(--brand-400)" },
            { label: "Total Payments", value: data.total, icon: CreditCard, color: "var(--accent-500)" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                  <s.icon size={16} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-secondary)" }}>
              {["Tenant", "Amount", "Method", "Reference", "Status", "Date"].map(h => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>No payments yet</td></tr>
            ) : data.data.map((p: any) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.subscription?.tenant?.name || "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{p.subscription?.plan}</div>
                </td>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--success)" }}>
                  {p.currency === "USD" ? "$" : "₹"}{Number(p.amount).toLocaleString()}
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500, marginLeft: 4 }}>{p.currency}</span>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{p.method || "—"}</td>
                <td style={{ padding: "12px 14px", color: "var(--text-tertiary)", fontSize: 12 }}>{p.referenceId || "—"}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                    background: p.status === "COMPLETED" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    color: p.status === "COMPLETED" ? "var(--success)" : "var(--error)",
                  }}>{p.status}</span>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--text-tertiary)", fontSize: 12 }}>{new Date(p.paidAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 440, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 14, padding: 28, zIndex: 2001, boxShadow: "var(--modal-shadow)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Record Payment</h3>
            <form onSubmit={recordPayment}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Tenant</label>
                <select value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))} required
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                  <option value="">Select tenant...</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.plan})</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Amount</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0.00"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                    {["INR", "USD"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Method</label>
                  <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                    {["MANUAL", "UPI", "BANK_TRANSFER", "RAZORPAY"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Reference ID</label>
                <input value={form.referenceId} onChange={e => setForm(f => ({ ...f, referenceId: e.target.value }))} placeholder="Transaction ref (optional)"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", resize: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ fontSize: 12, padding: "8px 16px" }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ fontSize: 12, padding: "8px 20px", cursor: saving ? "wait" : "pointer" }}>
                  {saving ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
