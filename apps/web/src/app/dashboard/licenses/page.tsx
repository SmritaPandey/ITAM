"use client";
import { useEffect, useState } from "react";
import {
  Key, Plus, AlertTriangle, CheckCircle2, Clock, XCircle,
  Loader2, RefreshCw, DollarSign
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PageHelp } from "@/components/HelpSystem";

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [form, setForm] = useState({
    softwareName: "", vendor: "", version: "", totalSeats: 1,
    licenseType: "PER_SEAT", licenseModel: "ANNUAL",
    purchaseCost: "", expiryDate: "",
  });

  async function refresh() {
    try {
      const [l, c] = await Promise.all([
        apiFetch("/licenses?limit=50"),
        apiFetch("/licenses/compliance"),
      ]);
      setLicenses(l.data || []);
      setCompliance(c);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/licenses", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        totalSeats: Number(form.totalSeats),
        purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : null,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
      }),
    });
    setShowAdd(false);
    setForm({ softwareName: "", vendor: "", version: "", totalSeats: 1, licenseType: "PER_SEAT", licenseModel: "ANNUAL", purchaseCost: "", expiryDate: "" });
    refresh();
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
          <h1 className="page-title">License Management</h1>
          <p className="page-subtitle">Track software licenses, compliance, and renewals</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14} /> Add License
          </button>
        </div>
      </div>

      <PageHelp id="licenses" title="License Management">
        Track software licenses across your organization. The compliance bar shows <strong>seat utilization</strong> — green is healthy, amber is nearing capacity, red means overused. Click <strong>Add License</strong> to register new software, and click any row for full details including expiry dates, costs, and license keys.
      </PageHelp>

      {/* Compliance Stats */}
      {compliance && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-icon cyan"><Key size={22} /></div>
            <div className="stat-content"><div className="stat-label">Total Licenses</div><div className="stat-value">{compliance.total}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><CheckCircle2 size={22} /></div>
            <div className="stat-content"><div className="stat-label">Compliant</div><div className="stat-value">{compliance.compliant}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><AlertTriangle size={22} /></div>
            <div className="stat-content"><div className="stat-label">Overused</div><div className="stat-value">{compliance.overused}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><Clock size={22} /></div>
            <div className="stat-content"><div className="stat-label">Expiring (30d)</div><div className="stat-value">{compliance.expiring}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><DollarSign size={22} /></div>
            <div className="stat-content"><div className="stat-label">Total Spend</div><div className="stat-value">₹{(compliance.totalCost / 1000).toFixed(0)}K</div></div>
          </div>
        </div>
      )}

      {/* Add License Form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add New License</h3>
          <form onSubmit={handleAdd} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input placeholder="Software Name *" required value={form.softwareName} onChange={e => setForm({ ...form, softwareName: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <input placeholder="Vendor" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <input placeholder="Version" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <input type="number" placeholder="Total Seats" value={form.totalSeats} onChange={e => setForm({ ...form, totalSeats: Number(e.target.value) })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <input type="number" placeholder="Purchase Cost" value={form.purchaseCost} onChange={e => setForm({ ...form, purchaseCost: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <input type="date" placeholder="Expiry Date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Plus size={14} /> Add License</button>
            </div>
          </form>
        </div>
      )}

      {/* Licenses Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {licenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
            <Key size={36} style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No licenses tracked</div>
            <p style={{ fontSize: 12 }}>Add a license to start tracking software compliance</p>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Software</th><th>Vendor</th><th>Type</th><th>Usage</th><th>Expiry</th><th>Cost</th><th>Status</th></tr></thead>
            <tbody>
              {licenses.map((l: any) => {
                const usage = l.totalSeats > 0 ? Math.round((l.usedSeats / l.totalSeats) * 100) : 0;
                const isOverused = l.usedSeats > l.totalSeats;
                const isExpired = l.expiryDate && new Date(l.expiryDate) < new Date();
                return (
                  <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => setSelectedLicense(l)}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{l.softwareName}</div>
                      {l.version && <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>v{l.version}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{l.vendor || "—"}</td>
                    <td><span className="badge gray" style={{ fontSize: 9 }}>{l.licenseType.replace("_", " ")}</span></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 60, height: 6, borderRadius: 3, background: "var(--bg-elevated)" }}>
                          <div style={{
                            width: `${Math.min(usage, 100)}%`, height: "100%", borderRadius: 3,
                            background: isOverused ? "#ef4444" : usage > 80 ? "#f59e0b" : "#10b981",
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: isOverused ? "#ef4444" : "var(--text-secondary)" }}>
                          {l.usedSeats}/{l.totalSeats}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: isExpired ? "#ef4444" : "var(--text-secondary)" }}>
                      {l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : "Perpetual"}
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 500 }}>
                      {l.purchaseCost ? `₹${Number(l.purchaseCost).toLocaleString()}` : "—"}
                    </td>
                    <td>
                      <span className={`badge ${isExpired ? "red" : isOverused ? "amber" : "green"}`}>
                        {isExpired ? "EXPIRED" : isOverused ? "OVERUSED" : "COMPLIANT"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Panel */}
      {selectedLicense && (() => {
        const l = selectedLicense;
        const usage = l.totalSeats > 0 ? Math.round((l.usedSeats / l.totalSeats) * 100) : 0;
        const isOverused = l.usedSeats > l.totalSeats;
        const isExpired = l.expiryDate && new Date(l.expiryDate) < new Date();
        const daysLeft = l.expiryDate ? Math.ceil((new Date(l.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
        return (
          <>
            <div onClick={() => setSelectedLicense(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 92vw)", background: "var(--bg-card)", zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{l.softwareName}</h2>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{l.vendor || "Unknown vendor"} • v{l.version || "N/A"}</p>
                </div>
                <button onClick={() => setSelectedLicense(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <LRow label="Status" value={<span className={`badge ${isExpired ? "red" : isOverused ? "amber" : "green"}`}>{isExpired ? "EXPIRED" : isOverused ? "OVERUSED" : "COMPLIANT"}</span>} />
                  <LRow label="License Type" value={l.licenseType?.replace("_", " ") || "—"} />
                  <LRow label="License Model" value={l.licenseModel || "—"} />
                  <LRow label="Vendor" value={l.vendor || "—"} />
                  <LRow label="Version" value={l.version || "—"} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>Seat Usage</div>
                  <LRow label="Used Seats" value={l.usedSeats} />
                  <LRow label="Total Seats" value={l.totalSeats} />
                  <LRow label="Utilization" value={<span style={{ color: isOverused ? "#ef4444" : usage > 80 ? "#f59e0b" : "#10b981", fontWeight: 600 }}>{usage}%</span>} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>Financial</div>
                  <LRow label="Purchase Cost" value={l.purchaseCost ? `₹${Number(l.purchaseCost).toLocaleString()}` : "—"} />
                  <LRow label="Renewal Cost" value={l.renewalCost ? `₹${Number(l.renewalCost).toLocaleString()}` : "—"} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>Dates</div>
                  <LRow label="Purchase Date" value={l.purchaseDate ? new Date(l.purchaseDate).toLocaleDateString() : "—"} />
                  <LRow label="Expiry Date" value={l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : "Perpetual"} />
                  {daysLeft !== null && <LRow label="Days Remaining" value={<span style={{ color: daysLeft < 0 ? "#ef4444" : daysLeft < 30 ? "#f59e0b" : "#10b981", fontWeight: 600 }}>{daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft} days`}</span>} />}
                  <LRow label="License Key" value={l.licenseKey ? `${l.licenseKey.substring(0, 12)}...` : "—"} />
                  <LRow label="Created" value={new Date(l.createdAt).toLocaleString()} />
                </div>
              </div>
            </div>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
          </>
        );
      })()}
    </>
  );
}

function LRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{typeof value === "string" || typeof value === "number" ? value : value}</span>
    </div>
  );
}
