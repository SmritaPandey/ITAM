"use client";
import { useEffect, useState } from "react";
import {
  Headphones, Laptop, Shield, Network, Wifi, Printer, HardDrive,
  Wrench, Users, Mail, Loader2, ChevronRight, CheckCircle2, Clock,
  Search, AlertTriangle, Plus, Monitor, Server, Package, X
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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/service-catalog/${requestModal.id}/request`, {
        method: "POST", body: JSON.stringify({ notes: requestNotes, priority: "MEDIUM" }),
      });
      setSuccess(`Request submitted for "${requestModal.name}". A ticket has been created.`);
      setRequestModal(null); setRequestNotes("");
    } catch (err: any) {
      setError(err?.message || `Failed to submit request for "${requestModal.name}". Please try again.`);
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
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Service Catalog</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{catalog.length} professional services configured • Request IT support and provisioning</p>
        </div>
      </div>

      {/* Success Banner */}
      {success && (
        <div className="card" style={{
          padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12,
          border: "1px solid rgba(16, 185, 129, 0.25)", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%)",
          borderRadius: 12, boxShadow: "0 4px 16px rgba(16, 185, 129, 0.05)"
        }}>
          <CheckCircle2 size={18} color="#34d399" />
          <span style={{ fontSize: 13, color: "#34d399", fontWeight: 650, flex: 1 }}>{success}</span>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="card" style={{
          padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12,
          border: "1px solid rgba(239, 68, 68, 0.25)", background: "linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.02) 100%)",
          borderRadius: 12, boxShadow: "0 4px 16px rgba(239, 68, 68, 0.05)"
        }}>
          <AlertTriangle size={18} color="#f87171" />
          <span style={{ fontSize: 13, color: "#f87171", fontWeight: 650, flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Search & Dynamic HSL Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 280, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search catalog for resources, hardware..."
            style={{
              width: "100%", padding: "10px 14px 10px 42px",
              background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12,
              color: "var(--text-primary)", fontSize: 13, outline: "none", transition: "all 0.2s"
            }}
            className="search-focus" />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setSelectedCategory(null)}
            className="filter-pill"
            style={{
              fontSize: 11, padding: "6px 14px", borderRadius: 20, border: "1px solid var(--border-primary)",
              background: !selectedCategory ? "var(--brand-500)" : "rgba(255,255,255,0.03)",
              color: !selectedCategory ? "#fff" : "var(--text-secondary)",
              fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
            }}>All</button>
          {categories.map(cat => {
            const catColor = CATEGORY_COLORS[cat] || "#64748b";
            const isActive = selectedCategory === cat;
            return (
              <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className="filter-pill"
                style={{
                  fontSize: 11, padding: "6px 14px", borderRadius: 20,
                  border: `1px solid ${isActive ? catColor : "var(--border-primary)"}`,
                  background: isActive ? `${catColor}1c` : "rgba(255,255,255,0.03)",
                  color: isActive ? catColor : "var(--text-secondary)",
                  boxShadow: isActive ? `0 0 10px ${catColor}15` : "none",
                  fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                }}>{cat}</button>
            );
          })}
        </div>
      </div>

      {/* Catalog Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {filtered.map(item => {
          const Icon = CATEGORY_ICONS[item.category] || Package;
          const color = CATEGORY_COLORS[item.category] || "#64748b";
          return (
            <div key={item.id} className="catalog-card"
              style={{
                padding: 20, cursor: "pointer", borderRadius: 16, border: "1px solid var(--border-primary)",
                background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)", position: "relative", overflow: "hidden"
              }}
              onClick={() => { setRequestModal(item); setRequestNotes(""); }}>
              
              {/* Category glow background */}
              <div style={{ position: "absolute", top: -10, right: -10, width: 70, height: 70, background: `${color}05`, borderRadius: "50%", filter: "blur(20px)" }} />
              
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${color}22 0%, ${color}0b 100%)`,
                  border: `1px solid ${color}35`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0
                }}>
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 750, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{item.name}</h3>
                  <span style={{
                    fontSize: 9, background: `${color}15`, color, marginTop: 6, display: "inline-block",
                    padding: "2px 8px", borderRadius: 5, fontWeight: 700, letterSpacing: "0.04em"
                  }}>{item.category}</span>
                </div>
                <ChevronRight size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0, marginTop: 4 }} className="chevron-hover" />
              </div>
              
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-tertiary)", margin: "0 0 16px", minHeight: 38 }}>
                {item.description}
              </p>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-primary)", paddingTop: 12, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontWeight: 500 }}>
                  <Clock size={13} style={{ color: "var(--text-tertiary)" }} /> {item.estimatedDelivery}
                </span>
                {item.approvalRequired ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#fbbf24", fontWeight: 600, background: "rgba(245,158,11,0.06)", padding: "2px 8px", borderRadius: 6, fontSize: 10 }}>
                    <Shield size={12} /> Approval Required
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#34d399", fontWeight: 600, background: "rgba(16,185,129,0.06)", padding: "2px 8px", borderRadius: 6, fontSize: 10 }}>
                    <CheckCircle2 size={12} /> Instant Provision
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ padding: 64, textAlign: "center", borderRadius: 16, border: "1px solid var(--border-primary)" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Headphones size={28} style={{ color: "var(--text-tertiary)" }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>No services match</h3>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", maxWidth: 300, margin: "0 auto" }}>Try clearing your search query or picking another service category pill.</p>
        </div>
      )}

      {/* Request Backdrop Blur Modal */}
      {requestModal && (
        <>
          {/* Glassmorphic Backdrop overlay */}
          <div onClick={() => setRequestModal(null)} style={{
            position: "fixed", inset: 0, background: "rgba(6, 9, 17, 0.7)", zIndex: 1000,
            backdropFilter: "blur(12px)", animation: "fadeInBg 0.25s ease-out"
          }} />
          
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(500px, 92vw)", background: "linear-gradient(135deg, #111827 0%, #0c0f1d 100%)",
            border: "1px solid var(--border-primary)", borderRadius: 18,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 24px rgba(6,182,212,0.05)", zIndex: 1001, overflow: "hidden",
            animation: "modalZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
          }}>
            {/* Modal Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Request Workspace Resource</h2>
              <button onClick={() => setRequestModal(null)} style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
                borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s"
              }} className="modal-close-btn">
                <X size={15} />
              </button>
            </div>
            
            {/* Modal Content */}
            <div style={{ padding: 24 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: 16,
                background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-primary)", borderRadius: 12
              }}>
                {(() => {
                  const Icon = CATEGORY_ICONS[requestModal.category] || Package;
                  const color = CATEGORY_COLORS[requestModal.category] || "#64748b";
                  return (
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, background: `linear-gradient(135deg, ${color}22 0%, ${color}0b 100%)`,
                      border: `1px solid ${color}35`, display: "flex", alignItems: "center", justifyContent: "center", color
                    }}><Icon size={20} /></div>
                  );
                })()}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{requestModal.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={12} /> Deliverable: {requestModal.estimatedDelivery}
                  </div>
                </div>
              </div>
              
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
                {requestModal.description}
              </p>
              
              {requestModal.approvalRequired && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "10px 14px",
                  background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10,
                  fontSize: 12, color: "#fbbf24", fontWeight: 500
                }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} /> 
                  <span>Requires manager approval prior to fulfillment routing.</span>
                </div>
              )}
              
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.02em" }}>Justification & Additional Context</label>
                <textarea value={requestNotes} onChange={e => setRequestNotes(e.target.value)} rows={3}
                  placeholder="Provide any details, required applications, office location, serial codes, or specific instructions for delivery..."
                  style={{
                    width: "100%", padding: "12px 14px", background: "var(--bg-input)",
                    border: "1px solid var(--border-primary)", borderRadius: 10,
                    color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "none", transition: "all 0.2s"
                  }}
                  className="search-focus" />
              </div>
              
              <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                <button onClick={() => setRequestModal(null)} className="btn btn-secondary" style={{ borderRadius: 10, fontWeight: 600 }}>Cancel</button>
                <button onClick={submitRequest} className="btn btn-primary" disabled={requesting}
                  style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, fontWeight: 600 }}>
                  {requesting ? (
                    <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Dispatching...</>
                  ) : (
                    <><Plus size={15} /> Submit Request</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .search-focus:focus {
          border-color: var(--brand-400) !important;
          box-shadow: 0 0 12px rgba(6, 182, 212, 0.15);
        }
        .filter-pill:hover {
          opacity: 0.9;
        }
        .catalog-card:hover {
          transform: translateY(-4px);
          border-color: rgba(6,182,212,0.3) !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.3), 0 0 15px rgba(6,182,212,0.05);
        }
        .catalog-card:hover .chevron-hover {
          color: var(--text-primary) !important;
          transform: translateX(3px);
        }
        .chevron-hover {
          transition: all 0.2s;
        }
        .modal-close-btn:hover {
          background: var(--bg-card-hover) !important;
          color: var(--text-primary) !important;
        }
        @keyframes fadeInBg {
          from { opacity: 0; backdrop-filter: blur(0); }
          to { opacity: 1; backdrop-filter: blur(12px); }
        }
        @keyframes modalZoomIn {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
