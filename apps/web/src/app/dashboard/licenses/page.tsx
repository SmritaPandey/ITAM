"use client";
import { useEffect, useState } from "react";
import {
  Key, Plus, AlertTriangle, CheckCircle2, Clock, XCircle,
  Loader2, RefreshCw, DollarSign, Copy, Check, ChevronRight, X,
  Search, Trash2, Edit3, Save
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PageHelp } from "@/components/HelpSystem";

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
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
    } catch (err: any) { console.error("Licenses load failed:", err); } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
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
    } catch (e) { alert('Failed to add license'); }
  }

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  async function handleDelete(id: string) {
    if (!confirm("Delete this license? This cannot be undone.")) return;
    try {
      await apiFetch(`/licenses/${id}`, { method: "DELETE" });
      setSelectedLicense(null);
      refresh();
    } catch { alert("Failed to delete."); }
  }

  async function handleEdit() {
    try {
      await apiFetch(`/licenses/${selectedLicense.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          totalSeats: Number(editForm.totalSeats),
          purchaseCost: editForm.purchaseCost ? Number(editForm.purchaseCost) : null,
          expiryDate: editForm.expiryDate ? new Date(editForm.expiryDate).toISOString() : null,
        }),
      });
      setEditing(false);
      setSelectedLicense(null);
      refresh();
    } catch { alert("Failed to update."); }
  }

  // Client-side search/filter
  const displayedLicenses = licenses.filter((l: any) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || l.softwareName?.toLowerCase().includes(q) || l.vendor?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || (() => {
      const isExpired = l.expiryDate && new Date(l.expiryDate) < new Date();
      const isOverused = l.usedSeats > l.totalSeats;
      if (statusFilter === "EXPIRED") return isExpired;
      if (statusFilter === "OVERUSED") return isOverused;
      if (statusFilter === "COMPLIANT") return !isExpired && !isOverused;
      return true;
    })();
    return matchSearch && matchStatus;
  });

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
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>License Management</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Track software licenses, seats compliance, and renewals</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={refresh} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, padding: 0, borderRadius: 10 }}>
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, fontWeight: 600 }}>
            <Plus size={16} /> Add License
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "8px 14px" }}>
          <Search size={15} style={{ color: "var(--text-tertiary)" }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by software name or vendor..."
            style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "8px 14px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
          <option value="">All Status</option>
          <option value="COMPLIANT">Compliant</option>
          <option value="OVERUSED">Overused</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <PageHelp id="licenses" title="License Management">
        Track software licenses across your organization. The compliance bar shows <strong>seat utilization</strong> — green is healthy, amber is nearing capacity, red means overused. Click <strong>Add License</strong> to register new software, and click any row for full details including expiry dates, costs, and license keys.
      </PageHelp>

      {/* Compliance Stats Grid */}
      {compliance && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {/* Card 1: Total */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid var(--border-primary)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(6, 182, 212, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-400)" }}>
              <Key size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Licenses</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>{compliance.total}</div>
            </div>
          </div>

          {/* Card 2: Compliant */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 12px rgba(16, 185, 129, 0.02)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(16, 185, 129, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Compliant</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399", marginTop: 2 }}>{compliance.compliant}</div>
            </div>
          </div>

          {/* Card 3: Overused */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 12px rgba(239, 68, 68, 0.02)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(239, 68, 68, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Overused</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f87171", marginTop: 2 }}>{compliance.overused}</div>
            </div>
          </div>

          {/* Card 4: Expiring */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 12px rgba(245, 158, 11, 0.02)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(245, 158, 11, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24" }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Expiring (30d)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>{compliance.expiring}</div>
            </div>
          </div>

          {/* Card 5: Total Spend */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid rgba(168, 85, 247, 0.2)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 12px rgba(168, 85, 247, 0.02)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(168, 85, 247, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(168, 85, 247, 0.1)", border: "1px solid rgba(168, 85, 247, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#c084fc" }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Spend</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#c084fc", marginTop: 2 }}>₹{(compliance.totalCost / 1000).toFixed(0)}K</div>
            </div>
          </div>
        </div>
      )}

      {/* Add License Dialog Panel */}
      {showAdd && (
        <div className="card" style={{
          marginBottom: 20, padding: 24, borderRadius: 16,
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(20, 26, 46, 0.95) 100%)",
          border: "1px solid var(--brand-500)",
          boxShadow: "0 8px 32px rgba(6, 182, 212, 0.15), inset 0 0 16px rgba(6, 182, 212, 0.02)",
          animation: "fadeIn 0.25s ease-out"
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={18} style={{ color: "var(--brand-400)" }} /> Add New Software License
          </h3>
          <form onSubmit={handleAdd} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Software Name *</label>
              <input placeholder="e.g. Adobe Creative Cloud" required value={form.softwareName} onChange={e => setForm({ ...form, softwareName: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", transition: "all 0.2s" }}
                className="focus-glow" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Vendor</label>
              <input placeholder="e.g. Adobe Inc." value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                className="focus-glow" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Version</label>
              <input placeholder="e.g. 2026.1" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                className="focus-glow" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Total Seats Available</label>
              <input type="number" placeholder="e.g. 50" value={form.totalSeats} onChange={e => setForm({ ...form, totalSeats: Number(e.target.value) })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                className="focus-glow" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Purchase Cost (₹)</label>
              <input type="number" placeholder="e.g. 75000" value={form.purchaseCost} onChange={e => setForm({ ...form, purchaseCost: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                className="focus-glow" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Expiry Date</label>
              <input type="date" placeholder="Expiry Date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                className="focus-glow" />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)} style={{ borderRadius: 10, fontWeight: 600 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, fontWeight: 600 }}>
                <Plus size={15} /> Save License
              </button>
            </div>
          </form>
          <style>{`
            .focus-glow:focus {
              border-color: var(--brand-400) !important;
              box-shadow: 0 0 10px rgba(6, 182, 212, 0.15);
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Licenses Main Panel */}
      <div className="card" style={{ padding: 0, borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-primary)", background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15, 23, 42, 0.25) 100%)" }}>
        {licenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-tertiary)" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Key size={32} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>No tracked licenses</div>
            <p style={{ fontSize: 13, maxWidth: 360, margin: "0 auto" }}>Get started by tracking your software compliance. Add your first license key above.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Software</th>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Vendor</th>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Type</th>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Seat Allocation & Utilization</th>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Expiry</th>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Cost</th>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Status</th>
                  <th style={{ padding: "16px 20px" }}></th>
                </tr>
              </thead>
              <tbody>
                {displayedLicenses.map((l: any) => {
                  const usage = l.totalSeats > 0 ? Math.round((l.usedSeats / l.totalSeats) * 100) : 0;
                  const isOverused = l.usedSeats > l.totalSeats;
                  const isExpired = l.expiryDate && new Date(l.expiryDate) < new Date();
                  
                  // Seat Meter Color
                  const meterColor = isOverused ? "#ef4444" : usage > 85 ? "#f59e0b" : "#10b981";
                  const meterGradient = isOverused 
                    ? "linear-gradient(90deg, #ef4444 0%, #f87171 100%)" 
                    : usage > 85 
                      ? "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)" 
                      : "linear-gradient(90deg, #10b981 0%, #34d399 100%)";
                  
                  return (
                    <tr key={l.id} 
                      onClick={() => setSelectedLicense(l)}
                      style={{ cursor: "pointer", borderBottom: "1px solid var(--border-primary)", transition: "background 0.15s" }}
                      className="license-row">
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ fontWeight: 650, color: "var(--text-primary)", fontSize: 14 }}>{l.softwareName}</div>
                        {l.version && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Build v{l.version}</div>}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13, color: "var(--text-secondary)" }}>
                        {l.vendor || <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span className="badge gray" style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                          {l.licenseType.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 160 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                            <span style={{ fontWeight: 600, color: isOverused ? "#ef4444" : "var(--text-primary)" }}>{usage}% Seats</span>
                            <span style={{ color: "var(--text-tertiary)" }}>{l.usedSeats}/{l.totalSeats}</span>
                          </div>
                          <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden", position: "relative" }}>
                            {isOverused && (
                              <div style={{ position: "absolute", inset: 0, background: "rgba(239, 68, 68, 0.15)", animation: "pulseGlow 2s infinite" }} />
                            )}
                            <div style={{
                              width: `${Math.min(usage, 100)}%`, height: "100%", borderRadius: 3,
                              background: meterGradient,
                              boxShadow: `0 0 6px ${meterColor}33`,
                              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
                            }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 12, color: isExpired ? "#ef4444" : "var(--text-secondary)", fontWeight: 500 }}>
                        {l.expiryDate ? new Date(l.expiryDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : <span style={{ color: "#34d399", fontWeight: 600 }}>Perpetual</span>}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {l.purchaseCost ? `₹${Number(l.purchaseCost).toLocaleString()}` : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span className={`badge ${isExpired ? "red" : isOverused ? "amber" : "green"}`} style={{
                          padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                          boxShadow: isExpired 
                            ? "0 0 10px rgba(239,68,68,0.08)" 
                            : isOverused 
                              ? "0 0 10px rgba(245,158,11,0.08)" 
                              : "0 0 10px rgba(16,185,129,0.08)"
                        }}>
                          {isExpired ? "EXPIRED" : isOverused ? "OVERUSED" : "COMPLIANT"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={e => { e.stopPropagation(); handleDelete(l.id); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "none"; }}>
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={16} style={{ color: "var(--text-tertiary)", opacity: 0.5 }} className="arrow-hover" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <style>{`
          .license-row:hover {
            background: rgba(255,255,255,0.02) !important;
          }
          .license-row:hover .arrow-hover {
            transform: translateX(4px);
            color: var(--text-primary) !important;
            opacity: 1 !important;
          }
          .arrow-hover {
            transition: all 0.2s;
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.8; }
          }
        `}</style>
      </div>

      {/* Premium Detail Drawer Slide-In */}
      {selectedLicense && (() => {
        const l = selectedLicense;
        const usage = l.totalSeats > 0 ? Math.round((l.usedSeats / l.totalSeats) * 100) : 0;
        const isOverused = l.usedSeats > l.totalSeats;
        const isExpired = l.expiryDate && new Date(l.expiryDate) < new Date();
        const daysLeft = l.expiryDate ? Math.ceil((new Date(l.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
        
        return (
          <>
            {/* Backdrop Blur */}
            <div onClick={() => setSelectedLicense(null)} style={{
              position: "fixed", inset: 0, background: "rgba(5, 7, 12, 0.65)", zIndex: 1000,
              backdropFilter: "blur(10px)", animation: "fadeInBlur 0.25s ease-out"
            }} />
            
            <div style={{
              position: "fixed", top: 0, right: 0, bottom: 0, width: "min(460px, 92vw)",
              background: "linear-gradient(180deg, #111827 0%, #0c0f1d 100%)",
              zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column",
              boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.6)",
              animation: "slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}>
              {/* Header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{l.softwareName}</h2>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
                    {l.vendor || "No vendor recorded"} • Build v{l.version || "N/A"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => {
                    setEditing(true);
                    setEditForm({ softwareName: l.softwareName, vendor: l.vendor || "", version: l.version || "", totalSeats: l.totalSeats, purchaseCost: l.purchaseCost || "", expiryDate: l.expiryDate ? l.expiryDate.slice(0, 10) : "" });
                  }} style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
                    borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s"
                  }}>
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(l.id)} style={{
                    background: "var(--bg-elevated)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#f87171", cursor: "pointer", transition: "all 0.2s"
                  }}>
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => setSelectedLicense(null)} style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
                    borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s"
                  }} className="btn-close-drawer">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Stats Bar */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-primary)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Seat Allocation</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{l.usedSeats} / {l.totalSeats} Seats</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-primary)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Current Spend</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
                      {l.purchaseCost ? `₹${Number(l.purchaseCost).toLocaleString()}` : "—"}
                    </div>
                  </div>
                </div>

                {/* Info Block 1: Details */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 6 }}>
                    License Classification
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <LRow label="Status" value={
                      <span className={`badge ${isExpired ? "red" : isOverused ? "amber" : "green"}`} style={{ padding: "3px 8px", borderRadius: 6 }}>
                        {isExpired ? "EXPIRED" : isOverused ? "OVERUSED" : "COMPLIANT"}
                      </span>
                    } />
                    <LRow label="License Type" value={l.licenseType?.replace("_", " ") || "—"} />
                    <LRow label="License Model" value={l.licenseModel || "—"} />
                    <LRow label="Software Version" value={l.version || "—"} />
                  </div>
                </div>

                {/* Info Block 2: Usage */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 6 }}>
                    Seat Utilization Metrics
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <LRow label="Used Licenses" value={l.usedSeats} />
                    <LRow label="Total Licenses Allocated" value={l.totalSeats} />
                    <LRow label="Seat Utilization Efficiency" value={
                      <span style={{ color: isOverused ? "#ef4444" : usage > 85 ? "#f59e0b" : "#10b981", fontWeight: 700 }}>{usage}%</span>
                    } />
                  </div>
                </div>

                {/* Info Block 3: Dates & Timeline */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 6 }}>
                    Timelines & Expirations
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <LRow label="Purchase Date" value={l.purchaseDate ? new Date(l.purchaseDate).toLocaleDateString() : "—"} />
                    <LRow label="Expiry Date" value={l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : "Perpetual"} />
                    {daysLeft !== null && (
                      <LRow label="Timeline Status" value={
                        <span style={{ color: daysLeft < 0 ? "#ef4444" : daysLeft < 30 ? "#f59e0b" : "#10b981", fontWeight: 700 }}>
                          {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft} days remaining`}
                        </span>
                      } />
                    )}
                  </div>
                </div>

                {/* Info Block 4: Credentials */}
                {l.licenseKey && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 6 }}>
                      Security Credentials
                    </div>
                    <div style={{
                      background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 10,
                      padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
                    }}>
                      <code style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.licenseKey}
                      </code>
                      <button onClick={() => handleCopy(l.licenseKey)} style={{
                        background: copiedKey ? "#10b981" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${copiedKey ? "#10b981" : "var(--border-primary)"}`,
                        borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                        color: copiedKey ? "#fff" : "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s"
                      }} className="btn-copy-action">
                        {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Info Block 5: Timestamps */}
                <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 16, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)" }}>
                  <span>Created {new Date(l.createdAt).toLocaleDateString()}</span>
                  <span>ID: {l.id}</span>
                </div>
              </div>
            </div>
            <style>{`
              @keyframes fadeInBlur {
                from { opacity: 0; backdrop-filter: blur(0); }
                to { opacity: 1; backdrop-filter: blur(10px); }
              }
              @keyframes slideInLeft {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
              .btn-close-drawer:hover {
                background: var(--bg-card-hover) !important;
                color: var(--text-primary) !important;
              }
              .btn-copy-action:hover {
                background: ${copiedKey ? "#10b981" : "rgba(255,255,255,0.08)"} !important;
                color: var(--text-primary) !important;
              }
            `}</style>
          </>
        );
      })()}
    </>
  );
}

function LRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>{label}</span>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
        {typeof value === "string" || typeof value === "number" ? value : value}
      </div>
    </div>
  );
}
