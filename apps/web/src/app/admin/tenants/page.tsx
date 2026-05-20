"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { 
  Building2, Search, ChevronRight, Users, Package, Ticket, 
  Shield, Crown, Lock, Settings, DollarSign, Percent, Clock, 
  Wrench, Sparkles, Activity, FileText, CheckCircle2, XCircle, 
  Trash2, HelpCircle, Server, Eye, EyeOff, LayoutGrid, CreditCard, 
  Coins, Gift, Calendar, AlertTriangle
} from "lucide-react";

const PLAN_COLORS: Record<string, string> = { STARTER: "#64748b", PROFESSIONAL: "#06b6d4", ENTERPRISE: "#8b5cf6", ON_PREMISE: "#f59e0b" };
const STATUS_COLORS: Record<string, string> = { ACTIVE: "#10b981", SUSPENDED: "#ef4444", TRIAL: "#f59e0b", CANCELLED: "#64748b" };

const ALL_MODULES = [
  { key: "DASHBOARD", name: "Dashboard", desc: "Core dashboard with resource summaries, quick actions, and overall system status widgets.", category: "Core Features" },
  { key: "MY_PORTAL", name: "My Portal", desc: "Personal workspace for ticket reporting, asset assignments, and self-service requests.", category: "Core Features" },
  { key: "ALL_ASSETS", name: "All Assets", desc: "Unified repository tracking all physical, digital, and cloud-hosted configuration items.", category: "Asset Management" },
  { key: "IT_ASSETS", name: "IT Assets", desc: "Deep IT inventory tracing hardware specs, CPU, RAM, disk space, serials, and OS details.", category: "Asset Management" },
  { key: "NON_IT_ASSETS", name: "Non-IT Assets", desc: "Asset tracker for furniture, facility machinery, office equipment, and other non-digital items.", category: "Asset Management" },
  { key: "CMDB", name: "CMDB", desc: "Visual topology maps and dependency chain mapping across services and physical servers.", category: "Asset Management", tier: "Professional" },
  { key: "TICKETS", name: "Tickets", desc: "Core service desk incident management system supporting SLA tracking and automated assigning.", category: "Core Features" },
  { key: "WORK_ORDERS", name: "Work Orders", desc: "Technician work assignments, scheduled preventive maintenance, and part inventory updates.", category: "Operations", tier: "Professional" },
  { key: "DISCOVERY", name: "Discovery", desc: "Subnet scanning engine discovering SNMP, WMI, and cloud systems to auto-populate inventory.", category: "Operations", tier: "Professional" },
  { key: "PATCH_MGMT", name: "Patch Mgmt", desc: "Cross-platform OS patching system showing update status and scheduling software updates.", category: "Operations", tier: "Professional" },
  { key: "NETWORK", name: "Network (NMS)", desc: "ICMP responses, network interface traffic graphs, switch port mappings, and offline alarms.", category: "Operations", tier: "Professional" },
  { key: "SECURITY_SCAN", name: "Security Scan", desc: "Vulnerability analysis scanners auditing open ports, SSL expiry, and missing patch CVEs.", category: "Operations", tier: "Professional" },
  { key: "COMPLIANCE", name: "Compliance", desc: "Automated regulatory checklists auditing security controls for SOC2, ISO27001, and HIPAA.", category: "Operations", tier: "Enterprise" },
  { key: "PROCUREMENT", name: "Procurement", desc: "Vendor catalog purchase orders, RFQs, depreciation schedules, and hardware birth record logs.", category: "Operations", tier: "Enterprise" },
  { key: "CHANGES", name: "Changes", desc: "ITIL-compliant change approval boards managing risk calculations and rollback playbooks.", category: "Operations", tier: "Enterprise" },
  { key: "PROBLEMS", name: "Problems", desc: "Problem ticket correlation managing root cause analysis folders and known error libraries.", category: "Operations", tier: "Enterprise" },
  { key: "FLEET", name: "Fleet / GPS", desc: "Real-time vehicle GPS tracker showing geo-fences, driver safety alerts, and fuel card logs.", category: "Monitoring", tier: "Enterprise" },
  { key: "CCTV", name: "CCTV", desc: "Contextual video cameras linked directly to locations, server racks, and security incidents.", category: "Monitoring", tier: "Professional" },
  { key: "VDI", name: "VDI", desc: "Cloud virtual desktop orchestrator provisioning isolated dev environments with WebRTC access.", category: "Monitoring", tier: "Enterprise" },
  { key: "AUTOMATION", name: "Automation", desc: "Low-code system runbooks automatically resolving incident alerts via agent CLI hooks.", category: "Management", tier: "Enterprise" },
  { key: "LICENSES", name: "Licenses", desc: "Software license key allocation matrices automatically triggering warning alerts on overages.", category: "Management", tier: "Professional" },
  { key: "KNOWLEDGE_BASE", name: "Knowledge Base", desc: "Self-service article publisher featuring rich markdown tools and interactive user FAQ widgets.", category: "Management", tier: "Professional" },
  { key: "SERVICE_CATALOG", name: "Service Catalog", desc: "IT support service request publisher with dynamic workflows for provisioning resources.", category: "Core Features" },
  { key: "REPORTS", name: "Reports", desc: "Advanced schedule query builder exporting visually rich PDF/CSV charts and summaries.", category: "Management", tier: "Professional" },
  { key: "USERS", name: "Users", desc: "Central workspace identity and team settings.", category: "Management" },
  { key: "AUDIT_LOGS", name: "Audit Logs", desc: "Tamper-proof event logs detailing every action inside the workspace for compliance audits.", category: "Management", tier: "Professional" },
  { key: "HELP", name: "Help & Docs", desc: "Documentation, troubleshooting guides, and contact support.", category: "Core Features" },
  { key: "SETTINGS", name: "Settings", desc: "Organization profile, integration links, security guidelines, and workspace tuning.", category: "Core Features" }
];

const CATEGORIES = ["Core Features", "Asset Management", "Operations", "Monitoring", "Management"];

function getBasePrice(plan: string, currency: string): number {
  const isUSD = currency === "USD";
  if (plan === "PROFESSIONAL") return isUSD ? 99 : 7999;
  if (plan === "ENTERPRISE") return isUSD ? 249 : 19999;
  if (plan === "ON_PREMISE") return isUSD ? 999 : 79999;
  return 0; // STARTER
}

function calculateEffectivePrice(basePrice: number, discountPercent: number): number {
  const discount = Number(discountPercent) || 0;
  return Math.round(basePrice * (1 - discount / 100));
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Tab control & core edits
  const [activeTab, setActiveTab] = useState("overview");
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");
  
  // Custom module overrides
  const [customAllowedModules, setCustomAllowedModules] = useState<string[]>([]);
  const [customBlockedModules, setCustomBlockedModules] = useState<string[]>([]);

  // Subscription and Promotions state variables
  const [billingCycle, setBillingCycle] = useState("MONTHLY");
  const [currency, setCurrency] = useState("INR");
  const [mrr, setMrr] = useState<number | string>(0);
  const [customPrice, setCustomPrice] = useState<number | string>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountNote, setDiscountNote] = useState("");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [endDate, setEndDate] = useState("");
  const [subNotes, setSubNotes] = useState("");

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
    setActiveTab("overview");
    apiFetch(`/admin/tenants/${id}`).then(d => {
      setSelected(d);
      setEditPlan(d.plan);
      setEditStatus(d.status);

      // Parse module overrides from settings
      const settings = d.settings || {};
      setCustomAllowedModules(Array.isArray(settings.customAllowedModules) ? settings.customAllowedModules : []);
      setCustomBlockedModules(Array.isArray(settings.customBlockedModules) ? settings.customBlockedModules : []);

      // Load billing/subscription settings
      const sub = d.subscription || {};
      setBillingCycle(sub.billingCycle || "MONTHLY");
      setCurrency(sub.currency || "INR");
      setMrr(sub.mrr || 0);
      setCustomPrice(sub.customPrice || 0);
      setDiscountPercent(Number(sub.discountPercent) || 0);
      setDiscountNote(sub.discountNote || "");
      setTrialEndsAt(sub.trialEndsAt ? new Date(sub.trialEndsAt).toISOString().split("T")[0] : "");
      setEndDate(sub.endDate ? new Date(sub.endDate).toISOString().split("T")[0] : "");
      setSubNotes(sub.notes || "");
    }).finally(() => setDetailLoading(false));
  }

  async function saveTenant() {
    if (!selected) return;
    setDetailLoading(true);
    try {
      // 1. Update general tenant settings and entitlements
      await apiFetch(`/admin/tenants/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: editPlan,
          status: editStatus,
          customAllowedModules,
          customBlockedModules,
        }),
      });

      // 2. Update billing subscription parameters
      await apiFetch(`/admin/subscriptions/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: editPlan,
          status: editStatus,
          billingCycle,
          currency,
          mrr: Number(mrr) || 0,
          customPrice: Number(customPrice) || 0,
          discountPercent: Number(discountPercent) || 0,
          discountNote,
          trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
          endDate: endDate ? new Date(endDate).toISOString() : null,
          notes: subNotes,
        }),
      });

      setSelected(null);
      load(search);
    } catch (e) {
      console.error(e);
      alert("Failed to update tenant administrative parameters.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function deleteTenant(id: string) {
    if (!confirm("Are you sure? This will suspend this tenant.")) return;
    await apiFetch(`/admin/tenants/${id}`, { method: "DELETE" });
    setSelected(null); load(search);
  }

  function handleOverrideChange(moduleKey: string, status: "DEFAULT" | "ALLOW" | "BLOCK") {
    if (status === "ALLOW") {
      setCustomAllowedModules(prev => {
        if (prev.includes(moduleKey)) return prev;
        return [...prev, moduleKey];
      });
      setCustomBlockedModules(prev => prev.filter(m => m !== moduleKey));
    } else if (status === "BLOCK") {
      setCustomBlockedModules(prev => {
        if (prev.includes(moduleKey)) return prev;
        return [...prev, moduleKey];
      });
      setCustomAllowedModules(prev => prev.filter(m => m !== moduleKey));
    } else {
      setCustomAllowedModules(prev => prev.filter(m => m !== moduleKey));
      setCustomBlockedModules(prev => prev.filter(m => m !== moduleKey));
    }
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
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 560, background: "var(--bg-card)", borderLeft: "1px solid var(--border-primary)", zIndex: 2001, overflow: "auto", padding: 28, display: "flex", flexDirection: "column" }}>
            {detailLoading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Processing...</div> : (
              <>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                      <Building2 size={20} style={{ color: "var(--brand-400)" }} /> {selected.name}
                    </h2>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{selected.slug} • ID: {selected.id}</p>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 24, padding: 0 }}>×</button>
                </div>

                {/* Tab selector */}
                <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-primary)", marginBottom: 20 }}>
                  {[
                    { id: "overview", label: "Overview & Stats", icon: <Activity size={14} /> },
                    { id: "entitlements", label: "Entitlements", icon: <LayoutGrid size={14} /> },
                    { id: "billing", label: "Billing & Promos", icon: <CreditCard size={14} /> }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "10px 16px",
                        background: "none",
                        border: "none",
                        borderBottom: activeTab === t.id ? "2px solid var(--brand-400)" : "2px solid transparent",
                        color: activeTab === t.id ? "var(--text-primary)" : "var(--text-tertiary)",
                        fontWeight: activeTab === t.id ? 700 : 500,
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {/* Content Body */}
                <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
                  
                  {/* TAB 1: OVERVIEW */}
                  {activeTab === "overview" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      
                      {/* Stats Matrix */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                        {[
                          { label: "Users", value: selected._count?.users || 0, icon: Users, color: "#8b5cf6" },
                          { label: "Assets", value: selected._count?.assets || 0, icon: Package, color: "#10b981" },
                          { label: "Tickets", value: selected._count?.tickets || 0, icon: Ticket, color: "#f59e0b" },
                          { label: "Scans", value: selected._count?.scanJobs || 0, icon: Server, color: "#3b82f6" },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: "center", padding: 12, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Subscription Summary */}
                      {selected.subscription && (
                        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: 16 }}>
                          <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            <Crown size={12} style={{ color: "#f59e0b" }} /> Active Plan Subscription
                          </h4>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 2 }}>
                            <div>Plan Tier: <strong style={{ color: PLAN_COLORS[selected.subscription.plan] }}>{selected.subscription.plan}</strong></div>
                            <div>Billing Status: <strong style={{ color: STATUS_COLORS[selected.subscription.status] }}>{selected.subscription.status}</strong></div>
                            <div>MRR: <strong>{selected.subscription.currency === "USD" ? "$" : "₹"}{Number(selected.subscription.mrr || 0).toLocaleString()}</strong></div>
                            <div>Start Date: {new Date(selected.subscription.startDate).toLocaleDateString()}</div>
                            {selected.subscription.endDate && <div>Expiration Date: {new Date(selected.subscription.endDate).toLocaleDateString()}</div>}
                            {selected.subscription.trialEndsAt && <div>Trial Ends At: {new Date(selected.subscription.trialEndsAt).toLocaleDateString()}</div>}
                          </div>
                        </div>
                      )}

                      {/* Users List */}
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Workspace Users ({selected.users?.length || 0})</h4>
                        <div style={{ borderRadius: 10, border: "1px solid var(--border-primary)", overflow: "hidden" }}>
                          {selected.users?.length === 0 ? (
                            <div style={{ padding: 16, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No users found in this workspace</div>
                          ) : (
                            selected.users?.map((u: any) => (
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
                            ))
                          )}
                        </div>
                      </div>

                      {/* Payments List */}
                      {selected.subscription?.payments?.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Payment History</h4>
                          <div style={{ borderRadius: 10, border: "1px solid var(--border-primary)", overflow: "hidden" }}>
                            {selected.subscription.payments.map((p: any) => (
                              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border-primary)" }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>{p.currency === "USD" ? "$" : "₹"}{Number(p.amount).toLocaleString()}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{p.method} • {p.referenceId || "—"}</div>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "right" }}>
                                  <div>{p.status}</div>
                                  <div>{new Date(p.paidAt).toLocaleDateString()}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ENTITLEMENTS OVERRIDES */}
                  {activeTab === "entitlements" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Entitlements Control Panel</h3>
                          <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Manually override feature modules for this tenant</p>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm("Reset all manual overrides to default plan constraints?")) {
                              setCustomAllowedModules([]);
                              setCustomBlockedModules([]);
                            }
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: 10,
                            fontWeight: 600,
                            background: "none",
                            border: "1px solid var(--border-primary)",
                            borderRadius: 6,
                            color: "var(--text-secondary)",
                            cursor: "pointer"
                          }}
                        >
                          Reset Overrides
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {CATEGORIES.map(cat => {
                          const catModules = ALL_MODULES.filter(m => m.category === cat);
                          return (
                            <div key={cat}>
                              <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--brand-400)", marginBottom: 8, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>
                                {cat}
                              </h4>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {catModules.map(m => {
                                  // Plan default inclusion check
                                  let planIncluded = false;
                                  if (editPlan === "STARTER") {
                                    planIncluded = !m.tier; // core is included (no tier specified)
                                  } else if (editPlan === "PROFESSIONAL") {
                                    planIncluded = !m.tier || m.tier === "Professional";
                                  } else if (editPlan === "ENTERPRISE" || editPlan === "ON_PREMISE") {
                                    planIncluded = true;
                                  }

                                  const isAllowed = customAllowedModules.includes(m.key);
                                  const isBlocked = customBlockedModules.includes(m.key);

                                  let effectiveState = planIncluded ? "Inherited (Included)" : "Inherited (Locked)";
                                  if (isAllowed) effectiveState = "Force Allowed (Override)";
                                  if (isBlocked) effectiveState = "Force Blocked (Override)";

                                  const badgeColor = 
                                    isBlocked ? "#ef4444" : 
                                    isAllowed ? "#10b981" : 
                                    planIncluded ? "#3b82f6" : "var(--text-tertiary)";

                                  return (
                                    <div key={m.key} style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      padding: "10px 12px",
                                      background: "var(--bg-elevated)",
                                      border: "1px solid var(--border-primary)",
                                      borderRadius: 8,
                                      gap: 16
                                    }}>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</span>
                                          {m.tier && (
                                            <span style={{
                                              fontSize: 9,
                                              fontWeight: 700,
                                              padding: "1px 6px",
                                              borderRadius: 4,
                                              background: m.tier === "Enterprise" ? "rgba(139,92,246,0.12)" : "rgba(6,182,212,0.12)",
                                              color: m.tier === "Enterprise" ? "#8b5cf6" : "#06b6d4"
                                            }}>
                                              {m.tier}
                                            </span>
                                          )}
                                          <span style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            padding: "1px 6px",
                                            borderRadius: 4,
                                            background: isBlocked ? "rgba(239,68,68,0.1)" : isAllowed ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                                            color: badgeColor
                                          }}>
                                            {effectiveState}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{m.desc}</div>
                                      </div>

                                      {/* Override controls */}
                                      <div style={{
                                        display: "flex",
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border-primary)",
                                        borderRadius: 6,
                                        padding: 2
                                      }}>
                                        {[
                                          { id: "DEFAULT", label: "Default" },
                                          { id: "ALLOW", label: "Allow" },
                                          { id: "BLOCK", label: "Block" }
                                        ].map(opt => {
                                          const active = 
                                            (opt.id === "DEFAULT" && !isAllowed && !isBlocked) ||
                                            (opt.id === "ALLOW" && isAllowed) ||
                                            (opt.id === "BLOCK" && isBlocked);

                                          let activeBg = "transparent";
                                          let activeColor = "var(--text-tertiary)";
                                          if (active) {
                                            if (opt.id === "ALLOW") {
                                              activeBg = "#10b981";
                                              activeColor = "white";
                                            } else if (opt.id === "BLOCK") {
                                              activeBg = "#ef4444";
                                              activeColor = "white";
                                            } else {
                                              activeBg = "var(--bg-elevated)";
                                              activeColor = "var(--text-primary)";
                                            }
                                          }

                                          return (
                                            <button
                                              key={opt.id}
                                              onClick={() => handleOverrideChange(m.key, opt.id as any)}
                                              style={{
                                                padding: "4px 8px",
                                                fontSize: 10,
                                                fontWeight: 600,
                                                background: activeBg,
                                                color: activeColor,
                                                border: "none",
                                                borderRadius: 4,
                                                cursor: "pointer",
                                                transition: "all 0.15s"
                                              }}
                                            >
                                              {opt.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: BILLING & PROMOTIONS */}
                  {activeTab === "billing" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Coins size={16} style={{ color: "var(--brand-400)" }} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Billing & Contract Configuration</h3>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Plan Tier</label>
                          <select value={editPlan} onChange={e => setEditPlan(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                            {["STARTER", "PROFESSIONAL", "ENTERPRISE", "ON_PREMISE"].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Subscription Status</label>
                          <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                            {["ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Billing Cycle</label>
                          <select value={billingCycle} onChange={e => setBillingCycle(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                            {["MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Currency</label>
                          <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                            {["INR", "USD"].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>
                            Custom Price Override ({currency === "USD" ? "$" : "₹"})
                          </label>
                          <input 
                            type="number" 
                            value={customPrice} 
                            onChange={e => setCustomPrice(e.target.value)} 
                            placeholder="e.g. 15000" 
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} 
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>
                            Reported Monthly MRR ({currency === "USD" ? "$" : "₹"})
                          </label>
                          <input 
                            type="number" 
                            value={mrr} 
                            onChange={e => setMrr(e.target.value)} 
                            placeholder="Calculated automatically" 
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} 
                          />
                        </div>
                      </div>

                      <hr style={{ border: "none", borderTop: "1px solid var(--border-primary)", margin: "8px 0" }} />

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Gift size={16} style={{ color: "var(--brand-400)" }} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Promotions & Discounts</h3>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Discount Rate (%)</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={discountPercent} 
                              onChange={e => setDiscountPercent(Number(e.target.value))} 
                              style={{ flex: 1 }} 
                            />
                            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 40, textAlign: "right" }}>{discountPercent}%</span>
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Discount Reason</label>
                          <input 
                            type="text" 
                            value={discountNote} 
                            onChange={e => setDiscountNote(e.target.value)} 
                            placeholder="e.g. Early Launch Sponsor" 
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} 
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>
                            <Calendar size={10} style={{ display: "inline", marginRight: 4 }} /> Trial Period Expiry
                          </label>
                          <input 
                            type="date" 
                            value={trialEndsAt} 
                            onChange={e => setTrialEndsAt(e.target.value)} 
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} 
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>
                            <Calendar size={10} style={{ display: "inline", marginRight: 4 }} /> Contract Expiration
                          </label>
                          <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} 
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Administrative Billing Notes</label>
                        <textarea 
                          value={subNotes} 
                          onChange={e => setSubNotes(e.target.value)} 
                          placeholder="Private contract details, payment terms, or custom agreements..." 
                          rows={3} 
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, resize: "vertical" }} 
                        />
                      </div>

                      {/* Live Dynamic Pricing Summary Card */}
                      <div style={{
                        background: "linear-gradient(135deg, rgba(6,182,212,0.06), rgba(139,92,246,0.04))",
                        border: "1px solid var(--border-primary)",
                        borderRadius: 12,
                        padding: 16,
                        marginTop: 8
                      }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--brand-400)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <Activity size={12} /> Effective Pricing Calculator
                        </h4>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Base Plan Price Value</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                              {currency === "USD" ? "$" : "₹"}{(customPrice ? Number(customPrice) : getBasePrice(editPlan, currency)).toLocaleString()} / mo
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Effective Cost After {discountPercent}% Promo</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>
                              {currency === "USD" ? "$" : "₹"}{calculateEffectivePrice(customPrice ? Number(customPrice) : getBasePrice(editPlan, currency), discountPercent).toLocaleString()} / mo
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Sticky Drawer Action Footer */}
                <div style={{
                  position: "sticky",
                  bottom: -28,
                  right: -28,
                  left: -28,
                  margin: "24px -28px -28px -28px",
                  padding: "16px 28px",
                  background: "var(--bg-card)",
                  backdropFilter: "blur(12px)",
                  borderTop: "1px solid var(--border-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  zIndex: 10
                }}>
                  <button onClick={() => setSelected(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Cancel
                  </button>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => deleteTenant(selected.id)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Suspend Tenant
                    </button>
                    <button onClick={saveTenant} style={{ padding: "8px 24px", borderRadius: 8, border: "none", background: "var(--brand-400, #06b6d4)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(6,182,212,0.25)" }}>
                      Save Changes
                    </button>
                  </div>
                </div>

              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
