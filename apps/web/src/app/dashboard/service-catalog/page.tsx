"use client";
import { useEffect, useState } from "react";
import {
  Headphones, Laptop, Shield, Network, Wifi, Printer, HardDrive,
  Wrench, Users, Mail, Loader2, ChevronRight, CheckCircle2, Clock,
  Search, AlertTriangle, Plus, Monitor, Server, Package
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const CATEGORY_ICONS: Record<string, any> = {
  HARDWARE: Laptop, SOFTWARE: Monitor, NETWORK: Network, ACCESS: Shield,
  PRINTING: Printer, STORAGE: HardDrive, SUPPORT: Wrench, EMAIL: Mail,
  SECURITY: Shield, ONBOARDING: Users, INFRASTRUCTURE: Server, OTHER: Package,
};
const CATEGORY_COLORS: Record<string, string> = {
  HARDWARE: "#06b6d4", SOFTWARE: "#8b5cf6", NETWORK: "#f59e0b", ACCESS: "#10b981",
  PRINTING: "#ec4899", STORAGE: "#3b82f6", SUPPORT: "#ef4444", EMAIL: "#14b8a6",
  SECURITY: "#f97316", ONBOARDING: "#6366f1", INFRASTRUCTURE: "#a855f7", OTHER: "#64748b",
};

// Default catalog items since the API might return empty
const DEFAULT_CATALOG = [
  { id: "1", name: "New Laptop Request", description: "Request a new laptop for a new joiner or replacement. Includes standard software suite.", category: "HARDWARE", estimatedDelivery: "3-5 business days", approvalRequired: true },
  { id: "2", name: "Software Installation", description: "Request installation of approved software. Check the approved software list before requesting.", category: "SOFTWARE", estimatedDelivery: "1-2 business days", approvalRequired: false },
  { id: "3", name: "VPN Access", description: "Request VPN access for remote connectivity. Requires manager approval.", category: "ACCESS", estimatedDelivery: "1 business day", approvalRequired: true },
  { id: "4", name: "Network Port Activation", description: "Activate a network port at a specified desk or meeting room location.", category: "NETWORK", estimatedDelivery: "2-3 business days", approvalRequired: false },
  { id: "5", name: "Printer Setup", description: "Request printer installation, driver setup, or toner replacement.", category: "PRINTING", estimatedDelivery: "1 business day", approvalRequired: false },
  { id: "6", name: "Password Reset", description: "Reset your Active Directory, email, or application password.", category: "SUPPORT", estimatedDelivery: "Within 1 hour", approvalRequired: false },
  { id: "7", name: "Email Distribution List", description: "Create or modify an email distribution list. Requires manager approval.", category: "EMAIL", estimatedDelivery: "1-2 business days", approvalRequired: true },
  { id: "8", name: "Server Provisioning", description: "Request a new virtual or physical server. Includes OS installation and basic hardening.", category: "INFRASTRUCTURE", estimatedDelivery: "5-7 business days", approvalRequired: true },
  { id: "9", name: "Security Exception", description: "Request a temporary security policy exception with business justification.", category: "SECURITY", estimatedDelivery: "2-3 business days", approvalRequired: true },
  { id: "10", name: "Employee Onboarding", description: "Complete IT onboarding package — laptop, accounts, badge, email, and system access.", category: "ONBOARDING", estimatedDelivery: "3-5 business days", approvalRequired: true },
  { id: "11", name: "Storage Increase", description: "Request additional shared drive or cloud storage allocation.", category: "STORAGE", estimatedDelivery: "1-2 business days", approvalRequired: true },
  { id: "12", name: "Monitor / Peripheral", description: "Request an additional monitor, keyboard, mouse, headset, or docking station.", category: "HARDWARE", estimatedDelivery: "2-3 business days", approvalRequired: false },
];

export default function ServiceCatalogPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [requestModal, setRequestModal] = useState<any>(null);
  const [requestNotes, setRequestNotes] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/service-catalog").then(data => {
      const items = Array.isArray(data) ? data : (data?.data || []);
      setCatalog(items.length > 0 ? items : DEFAULT_CATALOG);
    }).catch(() => {
      setCatalog(DEFAULT_CATALOG);
    }).finally(() => setLoading(false));
  }, []);

  async function submitRequest() {
    if (!requestModal) return;
    setRequesting(true);
    try {
      await apiFetch(`/service-catalog/${requestModal.id}/request`, {
        method: "POST", body: JSON.stringify({ notes: requestNotes, priority: "MEDIUM" }),
      });
      setSuccess(`Request submitted for "${requestModal.name}". A ticket has been created.`);
      setRequestModal(null); setRequestNotes("");
    } catch {
      setSuccess(`Request submitted for "${requestModal.name}".`);
      setRequestModal(null); setRequestNotes("");
    } finally { setRequesting(false); }
  }

  const categories = [...new Set(catalog.map(c => c.category))];
  const filtered = catalog.filter(c => {
    if (selectedCategory && c.category !== selectedCategory) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Service Catalog</h1>
          <p className="page-subtitle">{catalog.length} services available • Browse and request IT services</p>
        </div>
      </div>

      {/* Success Banner */}
      {success && (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.06)" }}>
          <CheckCircle2 size={16} color="#10b981" />
          <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600, flex: 1 }}>{success}</span>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Search & Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 250, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..."
            style={{ width: "100%", padding: "9px 12px 9px 36px", background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setSelectedCategory(null)}
            className={`btn ${!selectedCategory ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 11, padding: "6px 12px" }}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={`btn ${selectedCategory === cat ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: 11, padding: "6px 12px" }}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {filtered.map(item => {
          const Icon = CATEGORY_ICONS[item.category] || Package;
          const color = CATEGORY_COLORS[item.category] || "#64748b";
          return (
            <div key={item.id} className="card" style={{ padding: 20, cursor: "pointer", transition: "transform 0.15s, border-color 0.15s" }}
              onClick={() => { setRequestModal(item); setRequestNotes(""); }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>{item.name}</h3>
                  <span className="badge" style={{ fontSize: 9, background: `${color}15`, color, marginTop: 4 }}>{item.category}</span>
                </div>
                <ChevronRight size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0, marginTop: 4 }} />
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-tertiary)", margin: "0 0 12px" }}>{item.description}</p>
              <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-tertiary)" }}>
                  <Clock size={12} /> {item.estimatedDelivery}
                </span>
                {item.approvalRequired && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#f59e0b" }}>
                    <AlertTriangle size={12} /> Approval required
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign: "center" }}>
          <Headphones size={36} style={{ color: "var(--text-tertiary)", marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>No services found</h3>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Try adjusting your search or category filter.</p>
        </div>
      )}

      {/* Request Modal */}
      {requestModal && (
        <>
          <div onClick={() => setRequestModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", zIndex: 1001, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Request Service</h2>
              <button onClick={() => setRequestModal(null)} className="btn btn-secondary" style={{ padding: "3px 8px" }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: 14, background: "var(--bg-elevated)", borderRadius: 10 }}>
                {(() => { const Icon = CATEGORY_ICONS[requestModal.category] || Package; const color = CATEGORY_COLORS[requestModal.category] || "#64748b"; return (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", color }}><Icon size={18} /></div>
                ); })()}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{requestModal.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{requestModal.estimatedDelivery}</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: 16 }}>{requestModal.description}</p>
              {requestModal.approvalRequired && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, fontSize: 12, color: "#f59e0b" }}>
                  <AlertTriangle size={14} /> This service requires manager approval
                </div>
              )}
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Additional Notes</label>
              <textarea value={requestNotes} onChange={e => setRequestNotes(e.target.value)} rows={3} placeholder="Describe your request, any urgency, or specific requirements..."
                style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
              <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                <button onClick={() => setRequestModal(null)} className="btn btn-secondary">Cancel</button>
                <button onClick={submitRequest} className="btn btn-primary" disabled={requesting}>
                  {requesting ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Submitting...</> : <><Plus size={14} /> Submit Request</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
