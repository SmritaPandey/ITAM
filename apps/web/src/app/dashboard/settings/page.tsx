"use client";
import { useEffect, useState } from "react";
import {
  Settings, Globe, Bell, Shield, Database, Mail,
  Clock, Palette, Save, ToggleLeft, ToggleRight, Key, Server, Lock, Loader2, CheckCircle2,
  CreditCard, Receipt, User, Building2, Zap, Crown, ChevronRight, AlertTriangle, CheckCircle, Star
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface SettingsSection { id: string; label: string; icon: React.ReactNode; }

const SECTIONS: SettingsSection[] = [
  { id: "general", label: "General", icon: <Settings size={16} /> },
  { id: "workspace", label: "Workspace Customization", icon: <Palette size={16} /> },
  { id: "account", label: "Account", icon: <User size={16} /> },
  { id: "billing", label: "Billing & Plan", icon: <CreditCard size={16} /> },
  { id: "invoices", label: "Invoices", icon: <Receipt size={16} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={16} /> },
  { id: "security", label: "Security & Auth", icon: <Shield size={16} /> },
  { id: "discovery", label: "Discovery & Scanning", icon: <Server size={16} /> },
  { id: "integrations", label: "Integrations", icon: <Globe size={16} /> },
];

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

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [settings, setSettings] = useState({
    orgName: "", domain: "", timezone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY", autoDiscovery: true, snmpEnabled: true, agentEnabled: true,
    wmiEnabled: false, emailAlerts: true, slackEnabled: false, webhookUrl: "",
    sessionTimeout: 30, mfaEnforced: false, passwordExpiry: 90, ipWhitelist: "",
    scanInterval: 60, snmpCommunity: "public", agentPort: 8443,
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "INR">("INR");
  const [applyPromo, setApplyPromo] = useState(true);

  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [userDisabledModules, setUserDisabledModules] = useState<string[]>([]);

  useEffect(() => {
    apiFetch("/settings")
      .then(data => {
        setSettings(prev => ({ ...prev, ...data }));
        if (data.allowedModules) setAllowedModules(data.allowedModules);
        if (data.activeModules) setActiveModules(data.activeModules);
        if (data.userDisabledModules) setUserDisabledModules(data.userDisabledModules);
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Hash deep-linking
  useEffect(() => {
    function handleHash() {
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.replace("#", "");
        const matched = SECTIONS.find(s => s.id === hash);
        if (matched) {
          setActiveSection(matched.id);
        }
      }
    }
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  function toggleWorkspaceModule(moduleKey: string) {
    if (!allowedModules.includes(moduleKey)) return;
    setUserDisabledModules(prev => {
      const exists = prev.includes(moduleKey);
      if (exists) {
        return prev.filter(m => m !== moduleKey);
      } else {
        return [...prev, moduleKey];
      }
    });
  }

  // Load account data when tab is activated
  useEffect(() => {
    if (activeSection === "account" && !account) {
      apiFetch("/settings/account").then(setAccount).catch(() => {});
    }
    if (activeSection === "billing" && !subscription) {
      apiFetch("/settings/subscription").then(setSubscription).catch(() => {});
    }
    if (activeSection === "invoices" && invoices.length === 0) {
      apiFetch("/settings/invoices").then(d => setInvoices(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [activeSection]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/settings", { method: "PATCH", body: JSON.stringify({ ...settings, userDisabledModules }) });
      setSaved(true);
      
      // Dispatch custom event to notify layout sidebar
      window.dispatchEvent(new CustomEvent("workspace-modules-updated"));

      // Refresh modules list
      const fresh = await apiFetch("/settings");
      if (fresh) {
        setAllowedModules(fresh.allowedModules || []);
        setActiveModules(fresh.activeModules || []);
        setUserDisabledModules(fresh.userDisabledModules || []);
      }
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  async function handleUpgrade(plan: string) {
    setUpgrading(true);
    try {
      await apiFetch("/settings/upgrade", { method: "POST", body: JSON.stringify({ plan, billingCycle: "MONTHLY", currency }) });
      // Reload subscription data
      const sub = await apiFetch("/settings/subscription");
      setSubscription(sub);
      const acc = await apiFetch("/settings/account");
      setAccount(acc);
    } catch {} finally { setUpgrading(false); }
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
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration, billing, and preferences</p>
        </div>
        {!["account", "billing", "invoices"].includes(activeSection) && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saved ? <><CheckCircle2 size={14} /> Saved!</> : <><Save size={14} /> {saving ? "Saving..." : "Save Changes"}</>}
          </button>
        )}
      </div>

      <div className="settings-layout" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, minHeight: 500 }}>
        {/* Sidebar */}
        <div className="card" style={{ padding: "8px 0" }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px",
              background: activeSection === s.id ? "var(--bg-elevated)" : "transparent",
              border: "none", borderLeft: activeSection === s.id ? "3px solid var(--brand-400)" : "3px solid transparent",
              color: activeSection === s.id ? "var(--text-primary)" : "var(--text-secondary)",
              fontSize: 13, fontWeight: activeSection === s.id ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card">
          {activeSection === "workspace" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Workspace Customization</h2>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#06b6d4",
                  background: "rgba(6,182,212,0.08)",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}>
                  {allowedModules.length} / {ALL_MODULES.length} Modules Unlocked
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 24 }}>
                Personalize your workspace sidebar layout. Enable or disable unlocked modules to keep your dashboard clean.
              </p>

              <div style={{ display: "grid", gap: 24 }}>
                {Array.from(new Set(ALL_MODULES.map(m => m.category))).map(category => {
                  const categoryModules = ALL_MODULES.filter(m => m.category === category);
                  return (
                    <div key={category}>
                      <h3 style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--text-tertiary)",
                        marginBottom: 12,
                        borderBottom: "1px solid var(--border-primary)",
                        paddingBottom: 6,
                      }}>{category}</h3>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {categoryModules.map(module => {
                          const isUnlocked = allowedModules.includes(module.key);
                          const isDisabled = userDisabledModules.includes(module.key);
                          const isActive = isUnlocked && !isDisabled;

                          return (
                            <div key={module.key} style={{
                              padding: 16,
                              borderRadius: 12,
                              background: isUnlocked 
                                ? "var(--bg-elevated)" 
                                : "rgba(15, 23, 42, 0.15)",
                              border: `1px solid ${isActive ? "rgba(6,182,212,0.2)" : "var(--border-primary)"}`,
                              opacity: isUnlocked ? 1 : 0.65,
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 16,
                              transition: "all 0.2s ease",
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                  <span style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)"
                                  }}>{module.name}</span>
                                  
                                  {module.tier && !isUnlocked && (
                                    <span style={{
                                      fontSize: 9,
                                      fontWeight: 800,
                                      textTransform: "uppercase",
                                      color: module.tier === "Enterprise" ? "#8b5cf6" : "#06b6d4",
                                      background: module.tier === "Enterprise" ? "rgba(139,92,246,0.1)" : "rgba(6,182,212,0.1)",
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      letterSpacing: "0.04em"
                                    }}>
                                      {module.tier} Plan
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.4 }}>{module.desc}</p>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", alignSelf: "center" }}>
                                {isUnlocked ? (
                                  <button
                                    onClick={() => toggleWorkspaceModule(module.key)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: isActive ? "#10b981" : "var(--text-tertiary)",
                                      padding: 0,
                                      transition: "color 0.2s",
                                    }}
                                  >
                                    {isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setActiveSection("billing")}
                                    style={{
                                      background: "var(--bg-card)",
                                      border: "1px solid rgba(255,255,255,0.05)",
                                      borderRadius: 8,
                                      padding: "6px 12px",
                                      color: "var(--brand-400)",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <Lock size={10} /> Upgrade
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeSection === "general" && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>General Settings</h2>
              <div style={{ display: "grid", gap: 20 }}>
                <Field label="Organization Name" value={settings.orgName} onChange={v => setSettings({ ...settings, orgName: v })} />
                <Field label="Domain" value={settings.domain || ""} onChange={v => setSettings({ ...settings, domain: v })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Timezone" value={settings.timezone} onChange={v => setSettings({ ...settings, timezone: v })} />
                  <Field label="Date Format" value={settings.dateFormat} onChange={v => setSettings({ ...settings, dateFormat: v })} />
                </div>
              </div>
            </>
          )}

          {activeSection === "account" && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Account Overview</h2>
              {account ? (
                <div style={{ display: "grid", gap: 20 }}>
                  {/* Org Info */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <InfoCard label="Organization" value={account.name} icon={<Building2 size={16} />} />
                    <InfoCard label="Account Status" value={account.status} icon={<CheckCircle size={16} />}
                      valueColor={account.status === "ACTIVE" ? "var(--success)" : "var(--warning)"} />
                    <InfoCard label="Current Plan" value={account.plan} icon={<Crown size={16} />} valueColor="#8b5cf6" />
                    <InfoCard label="Member Since" value={new Date(account.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })} icon={<Clock size={16} />} />
                  </div>

                  {/* Usage */}
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: -8 }}>Usage</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <UsageBar label="Users" current={account.usage.users.current} limit={account.usage.users.limit} unlimited={account.usage.users.unlimited} />
                    <UsageBar label="Assets" current={account.usage.assets.current} limit={account.usage.assets.limit} unlimited={account.usage.assets.unlimited} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <InfoCard label="Sites" value={String(account.usage.sites)} icon={<Globe size={16} />} />
                    <InfoCard label="Departments" value={String(account.usage.departments)} icon={<Building2 size={16} />} />
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Loading account details...</div>
              )}
            </>
          )}

          {activeSection === "billing" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.02em" }}>Billing & Subscription</h2>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 24 }}>Manage your plan, billing cycle, and payment details</p>
              {subscription ? (
                <div style={{ display: "grid", gap: 28 }}>
                  {/* ── Current Plan Status ── */}
                  <div style={{
                    padding: 24, borderRadius: 16,
                    background: "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.06))",
                    border: "1px solid rgba(6,182,212,0.15)",
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)", transform: "translate(30%,-30%)" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{
                            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
                            color: "#06b6d4", background: "rgba(6,182,212,0.1)", padding: "3px 10px", borderRadius: 6,
                          }}>Active Plan</div>
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%", background: "#10b981",
                            boxShadow: "0 0 8px rgba(16,185,129,0.4)",
                          }} />
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>{subscription.currentPlan}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                          Billing: <span style={{ fontWeight: 700, color: "#06b6d4" }}>{subscription.subscription.billingCycle || "MONTHLY"}</span>
                          {subscription.subscription.discountPercent > 0 && (
                            <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                              background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                              {subscription.subscription.discountPercent}% discount applied
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
                          {subscription.subscription.mrr === 0 ? "Free" : `${subscription.subscription.mrr >= 1000 ? "₹" : "$"}${Math.round(subscription.subscription.mrr).toLocaleString()}`}
                        </div>
                        {subscription.subscription.mrr > 0 && (
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>per month</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Pricing Toggle Controls ── */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(15, 23, 42, 0.3)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    padding: "12px 20px",
                    borderRadius: 12,
                    marginBottom: 8,
                    gap: 16,
                    flexWrap: "wrap",
                  }}>
                    {/* Currency Segmented Control */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Billing Currency:</span>
                      <div style={{
                        display: "flex",
                        background: "var(--bg-elevated)",
                        borderRadius: 8,
                        padding: 3,
                        border: "1px solid var(--border-primary)",
                      }}>
                        <button
                          onClick={() => setCurrency("USD")}
                          style={{
                            padding: "6px 16px",
                            borderRadius: 6,
                            border: "none",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: currency === "USD" ? "linear-gradient(135deg, #06b6d4, #0891b2)" : "transparent",
                            color: currency === "USD" ? "white" : "var(--text-secondary)",
                            transition: "all 0.2s ease",
                          }}
                        >
                          USD ($)
                        </button>
                        <button
                          onClick={() => setCurrency("INR")}
                          style={{
                            padding: "6px 16px",
                            borderRadius: 6,
                            border: "none",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: currency === "INR" ? "linear-gradient(135deg, #06b6d4, #0891b2)" : "transparent",
                            color: currency === "INR" ? "white" : "var(--text-secondary)",
                            transition: "all 0.2s ease",
                          }}
                        >
                          INR (₹)
                        </button>
                      </div>
                    </div>

                    {/* Founder Discount Switch */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                          <Star size={14} style={{ fill: "#10b981" }} /> Exclusive Founder Discount Active
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Get 50% lifetime discount on select plans</span>
                      </div>
                      <button
                        onClick={() => setApplyPromo(!applyPromo)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: applyPromo ? "#10b981" : "var(--text-tertiary)",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          transition: "color 0.2s",
                        }}
                      >
                        {applyPromo ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                      </button>
                    </div>
                  </div>

                  {/* ── Plan Cards with Psychology ── */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyItems: "space-between", marginBottom: 16, justifyContent: "space-between" }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Choose Your Plan</h3>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
                        <Zap size={12} style={{ color: "#f59e0b" }} />
                        Founder Launch Pricing Live
                      </div>
                    </div>

                    <div className="settings-plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                      {subscription.plans.map((plan: any) => {
                        const isCurrent = plan.name === subscription.currentPlan;
                        const isPopular = plan.popular;
                        const isCustom = plan.contactSales;

                        const basePrice = currency === "USD" ? plan.priceUSD : plan.priceINR;
                        const discountedPrice = currency === "USD" ? plan.discountedUSD : plan.discountedINR;
                        const finalPrice = applyPromo && discountedPrice > 0 ? discountedPrice : basePrice;
                        const curSymbol = currency === "USD" ? "$" : "₹";
                        const monthlySavings = basePrice > finalPrice ? basePrice - finalPrice : 0;

                        return (
                          <div key={plan.name} style={{
                            padding: isPopular ? "2px" : 0,
                            borderRadius: 14,
                            background: isPopular
                              ? "linear-gradient(135deg, #06b6d4, #8b5cf6, #06b6d4)"
                              : "transparent",
                          }}>
                            <div style={{
                              padding: "22px 18px", borderRadius: isPopular ? 12 : 14, height: "100%",
                              background: isCurrent ? "rgba(6,182,212,0.06)" : "var(--bg-card)",
                              border: isPopular ? "none" : `1px solid ${isCurrent ? "rgba(6,182,212,0.25)" : "var(--border-primary)"}`,
                              position: "relative", display: "flex", flexDirection: "column",
                              transition: "transform 0.2s, box-shadow 0.2s",
                            }}>
                              {/* Popular badge */}
                              {isPopular && (
                                <div style={{
                                  position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
                                  background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                                  color: "white", fontSize: 9, fontWeight: 800, padding: "3px 12px", borderRadius: "0 0 8px 8px",
                                  textTransform: "uppercase", letterSpacing: "0.08em",
                                  boxShadow: "0 4px 12px rgba(6,182,212,0.3)",
                                }}>
                                  ⚡ Most Popular
                                </div>
                              )}

                              {/* Chosen by badge (social proof) */}
                              {isPopular && (
                                <div style={{
                                  fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500,
                                  marginTop: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 4,
                                }}>
                                  <span style={{ color: "#f59e0b" }}>★</span> Chosen by 78% of teams
                                </div>
                              )}

                              {/* Plan name */}
                              <div style={{
                                fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
                                marginBottom: 4, marginTop: isPopular ? 0 : 8,
                                letterSpacing: "-0.01em",
                              }}>{plan.displayName}</div>

                              {/* Pricing */}
                              <div style={{ marginBottom: 16 }}>
                                {basePrice === 0 ? (
                                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>Free</div>
                                ) : isCustom ? (
                                  <div>
                                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>Custom</div>
                                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Tailored to your needs</div>
                                  </div>
                                ) : (
                                  <div>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                      <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
                                        {curSymbol}{finalPrice.toLocaleString(currency === "USD" ? "en-US" : "en-IN")}
                                      </span>
                                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>/mo</span>
                                    </div>
                                    {/* Anchoring: Show strikethrough original price & savings */}
                                    {monthlySavings > 0 ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                        <span style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "line-through" }}>
                                          {curSymbol}{basePrice.toLocaleString(currency === "USD" ? "en-US" : "en-IN")}
                                        </span>
                                        <span style={{
                                          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                                          background: "rgba(16,185,129,0.12)", color: "#10b981",
                                        }}>Save 50%</span>
                                      </div>
                                    ) : (
                                      <div style={{ height: 18 }} />
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Features */}
                              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto 0", flex: 1 }}>
                                {plan.features.slice(0, 5).map((f: string, fi: number) => (
                                  <li key={f} style={{
                                    fontSize: 12, color: "var(--text-secondary)", marginBottom: 7,
                                    display: "flex", alignItems: "center", gap: 6,
                                    opacity: fi >= 4 && !isPopular ? 0.6 : 1,
                                  }}>
                                    <CheckCircle size={12} style={{ color: isPopular ? "#06b6d4" : "var(--success)", flexShrink: 0 }} /> {f}
                                  </li>
                                ))}
                                {plan.features.length > 5 && (
                                  <li style={{ fontSize: 11, color: "#06b6d4", marginTop: 4, fontWeight: 600 }}>
                                    +{plan.features.length - 5} more features
                                  </li>
                                )}
                              </ul>

                              {/* CTA Button */}
                              <div style={{ marginTop: 16 }}>
                                {isCurrent ? (
                                  <div style={{
                                    padding: "10px 0", textAlign: "center", fontSize: 12, fontWeight: 700,
                                    color: "#06b6d4", borderRadius: 10, border: "1px solid rgba(6,182,212,0.25)",
                                    background: "rgba(6,182,212,0.04)",
                                    letterSpacing: "-0.01em",
                                  }}>✓ Current Plan</div>
                                ) : isCustom ? (
                                  <a href="mailto:sales@qsasset.com?subject=Enterprise Plan Inquiry" style={{
                                    display: "block", padding: "10px 0", textAlign: "center", fontSize: 12, fontWeight: 700,
                                    color: "white", borderRadius: 10, textDecoration: "none",
                                    background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                                    boxShadow: "0 4px 12px rgba(139,92,246,0.25)",
                                    letterSpacing: "-0.01em",
                                  }}>Talk to Sales →</a>
                                ) : (
                                  <button onClick={() => handleUpgrade(plan.name)} disabled={upgrading}
                                    style={{
                                      width: "100%", fontSize: 12, padding: "10px 0", borderRadius: 10,
                                      border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
                                      letterSpacing: "-0.01em", transition: "all 0.15s",
                                      background: isPopular
                                        ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                                        : "var(--bg-elevated)",
                                      color: isPopular ? "white" : "var(--text-primary)",
                                      boxShadow: isPopular ? "0 4px 12px rgba(6,182,212,0.25)" : "none",
                                    }}>
                                    {upgrading ? "Processing..." : basePrice > (subscription.subscription.mrr || 0) ? "Upgrade Now →" : "Switch Plan"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Trust + Guarantee ── */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 24,
                    padding: "16px 0", borderTop: "1px solid var(--border-primary)",
                  }}>
                    {[
                      { icon: <Shield size={14} />, text: "30-day money-back guarantee" },
                      { icon: <Lock size={14} />, text: "Cancel anytime, no lock-in" },
                      { icon: <Crown size={14} />, text: "Priority migration support" },
                    ].map((t, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500,
                      }}>
                        <span style={{ color: "#06b6d4" }}>{t.icon}</span> {t.text}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Loading subscription details...</div>
              )}
            </>
          )}

          {activeSection === "invoices" && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Invoices & Payment History</h2>
              {invoices.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      {["Date", "Amount", "Method", "Status", "Reference"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textAlign: "left", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                        <td style={{ padding: "12px", fontSize: 13 }}>{new Date(inv.paidAt || inv.createdAt).toLocaleDateString("en-IN")}</td>
                        <td style={{ padding: "12px", fontSize: 13, fontWeight: 600 }}>
                          {inv.currency === "USD" ? "$" : "₹"}{inv.amount?.toLocaleString(inv.currency === "USD" ? "en-US" : "en-IN")}
                        </td>
                        <td style={{ padding: "12px", fontSize: 13 }}>{inv.method || "—"}</td>
                        <td style={{ padding: "12px" }}>
                          <span className={`badge ${inv.status === "COMPLETED" ? "green" : inv.status === "PENDING" ? "yellow" : "gray"}`} style={{ fontSize: 10 }}>
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px", fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{inv.reference || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{
                  padding: 40, textAlign: "center", color: "var(--text-tertiary)",
                  background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-primary)",
                }}>
                  <Receipt size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: "var(--text-secondary)" }}>No invoices yet</div>
                  <div style={{ fontSize: 12 }}>Payment history will appear here once billing is active.</div>
                </div>
              )}
            </>
          )}

          {activeSection === "notifications" && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Notification Preferences</h2>
              <div style={{ display: "grid", gap: 16 }}>
                <ToggleRow label="Email Alerts" desc="Send email notifications for critical events" value={settings.emailAlerts} onChange={() => setSettings({ ...settings, emailAlerts: !settings.emailAlerts })} />
                <ToggleRow label="Slack Integration" desc="Post alerts to a Slack channel" value={settings.slackEnabled} onChange={() => setSettings({ ...settings, slackEnabled: !settings.slackEnabled })} />
                <Field label="Webhook URL" value={settings.webhookUrl} onChange={v => setSettings({ ...settings, webhookUrl: v })} placeholder="https://hooks.example.com/alerts" />
              </div>
            </>
          )}

          {activeSection === "security" && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Security & Authentication</h2>
              <div style={{ display: "grid", gap: 16 }}>
                <ToggleRow label="Enforce MFA" desc="Require multi-factor authentication for all users" value={settings.mfaEnforced} onChange={() => setSettings({ ...settings, mfaEnforced: !settings.mfaEnforced })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Session Timeout (minutes)" value={String(settings.sessionTimeout)} onChange={v => setSettings({ ...settings, sessionTimeout: Number(v) })} />
                  <Field label="Password Expiry (days)" value={String(settings.passwordExpiry)} onChange={v => setSettings({ ...settings, passwordExpiry: Number(v) })} />
                </div>
                <Field label="IP Whitelist (comma separated)" value={settings.ipWhitelist} onChange={v => setSettings({ ...settings, ipWhitelist: v })} placeholder="10.0.0.0/8, 192.168.1.0/24" />
              </div>
            </>
          )}

          {activeSection === "discovery" && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Discovery & Scanning</h2>
              <div style={{ display: "grid", gap: 16 }}>
                <ToggleRow label="Auto Discovery" desc="Automatically detect new devices on the network" value={settings.autoDiscovery} onChange={() => setSettings({ ...settings, autoDiscovery: !settings.autoDiscovery })} />
                <ToggleRow label="SNMP Scanning" desc="Use SNMP protocol for network device discovery" value={settings.snmpEnabled} onChange={() => setSettings({ ...settings, snmpEnabled: !settings.snmpEnabled })} />
                <ToggleRow label="Agent-based Collection" desc="Collect data from installed agents on endpoints" value={settings.agentEnabled} onChange={() => setSettings({ ...settings, agentEnabled: !settings.agentEnabled })} />
                <ToggleRow label="WMI Discovery" desc="Use Windows Management Instrumentation for Windows assets" value={settings.wmiEnabled} onChange={() => setSettings({ ...settings, wmiEnabled: !settings.wmiEnabled })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <Field label="Scan Interval (min)" value={String(settings.scanInterval)} onChange={v => setSettings({ ...settings, scanInterval: Number(v) })} />
                  <Field label="SNMP Community" value={settings.snmpCommunity} onChange={v => setSettings({ ...settings, snmpCommunity: v })} />
                  <Field label="Agent Port" value={String(settings.agentPort)} onChange={v => setSettings({ ...settings, agentPort: Number(v) })} />
                </div>
              </div>
            </>
          )}

          {activeSection === "integrations" && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Integrations</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { name: "Active Directory", status: "Connected", icon: "🏢" },
                  { name: "ServiceNow", status: "Not Connected", icon: "🎫" },
                  { name: "Jira", status: "Not Connected", icon: "📋" },
                  { name: "Slack", status: settings.slackEnabled ? "Connected" : "Not Connected", icon: "💬" },
                  { name: "AWS Cloud", status: "Not Connected", icon: "☁️" },
                  { name: "Azure AD", status: "Not Connected", icon: "🔷" },
                ].map(i => (
                  <div key={i.name} style={{
                    padding: 14, background: "var(--bg-elevated)", borderRadius: 10,
                    border: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{i.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name}</div>
                        <span className={`badge ${i.status === "Connected" ? "green" : "gray"}`} style={{ fontSize: 9 }}>{i.status}</span>
                      </div>
                    </div>
                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }}>
                      {i.status === "Connected" ? "Configure" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Reusable Components ─────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: "100%", padding: "8px 12px", background: "var(--bg-input)",
          border: "1px solid var(--border-primary)", borderRadius: 8,
          color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none",
        }} />
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-primary)" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{desc}</div>
      </div>
      <button onClick={onChange} style={{ background: "none", border: "none", cursor: "pointer", color: value ? "var(--success)" : "var(--text-tertiary)", padding: 0 }}>
        {value ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
      </button>
    </div>
  );
}

function InfoCard({ label, value, icon, valueColor }: { label: string; value: string; icon: React.ReactNode; valueColor?: string }) {
  return (
    <div style={{
      padding: 16, borderRadius: 10, background: "var(--bg-elevated)",
      border: "1px solid var(--border-primary)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-tertiary)" }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: valueColor || "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function UsageBar({ label, current, limit, unlimited }: { label: string; current: number; limit: number; unlimited: boolean }) {
  const pct = unlimited ? Math.min(current * 2, 100) : Math.min((current / limit) * 100, 100);
  const color = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#10b981";
  return (
    <div style={{
      padding: 16, borderRadius: 10, background: "var(--bg-elevated)",
      border: "1px solid var(--border-primary)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {current} / {unlimited ? "∞" : limit}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--border-primary)" }}>
        <div style={{
          height: "100%", borderRadius: 3, background: color,
          width: `${unlimited ? Math.min(current, 30) : pct}%`,
          transition: "width 0.3s",
        }} />
      </div>
    </div>
  );
}
