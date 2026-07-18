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
  { id: "license", label: "Product License", icon: <Key size={16} /> },
  { id: "billing", label: "Billing & Plan", icon: <CreditCard size={16} /> },
  { id: "invoices", label: "Invoices", icon: <Receipt size={16} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={16} /> },
  { id: "security", label: "Security & Auth", icon: <Shield size={16} /> },
  { id: "discovery", label: "Discovery & Scanning", icon: <Server size={16} /> },
  { id: "storage", label: "Storage & System", icon: <Database size={16} /> },
  { id: "integrations", label: "Integrations", icon: <Globe size={16} /> },
];

const ALL_MODULES = [
  { key: "DASHBOARD", name: "Dashboard", desc: "Core dashboard with resource summaries, quick actions, and overall system status widgets.", category: "Core Features" },
  { key: "MY_PORTAL", name: "My Portal", desc: "Personal workspace for ticket reporting, asset assignments, and self-service requests.", category: "Core Features" },
  { key: "ALL_ASSETS", name: "All Assets", desc: "Unified repository tracking all physical, digital, and cloud-hosted configuration items.", category: "Asset Management" },
  { key: "IT_ASSETS", name: "IT Assets", desc: "Deep IT inventory tracing hardware specs, CPU, RAM, disk space, serials, and OS details.", category: "Asset Management" },
  { key: "NON_IT_ASSETS", name: "Non-IT Assets", desc: "Asset tracker for furniture, facility machinery, office equipment, and other non-digital items.", category: "Asset Management" },
  { key: "FACILITY", name: "Facility & EAM", desc: "Floor plans, preventive maintenance, spares, and consumable reorder points.", category: "Asset Management", tier: "Professional" },
  { key: "CMDB", name: "CMDB", desc: "Visual topology maps and dependency chain mapping across services and physical servers.", category: "Asset Management", tier: "Professional" },
  { key: "TICKETS", name: "Tickets", desc: "Core service desk incident management system supporting SLA tracking and automated assigning.", category: "Core Features" },
  { key: "WORK_ORDERS", name: "Work Orders", desc: "Technician work assignments, scheduled preventive maintenance, and part inventory updates.", category: "Operations", tier: "Professional" },
  { key: "DISCOVERY", name: "Discovery", desc: "Subnet scanning engine discovering SNMP, WMI, and cloud systems to auto-populate inventory.", category: "Operations", tier: "Professional" },
  { key: "PATCH_MGMT", name: "Patch Mgmt", desc: "Cross-platform OS patching system showing update status and scheduling software updates.", category: "Operations", tier: "Professional" },
  { key: "SOFTWARE_DEPLOYMENT", name: "Software Deploy", desc: "Distribute packages and deploy rings across remote endpoints.", category: "Operations", tier: "Professional" },
  { key: "REMOTE_TERMINAL", name: "Remote Terminal", desc: "Agent remote shell and assist deep-links for endpoints.", category: "Operations", tier: "Enterprise" },
  { key: "NETWORK", name: "Network (NMS)", desc: "ICMP responses, network interface traffic graphs, switch port mappings, and offline alarms.", category: "Operations", tier: "Professional" },
  { key: "SECURITY_SCAN", name: "Security Scan", desc: "Vulnerability analysis scanners auditing open ports, SSL expiry, and missing patch CVEs.", category: "Operations", tier: "Professional" },
  { key: "COMPLIANCE", name: "Compliance", desc: "Automated regulatory checklists auditing security controls for SOC2, ISO27001, and HIPAA.", category: "Operations", tier: "Enterprise" },
  { key: "PROCUREMENT", name: "Procurement", desc: "Vendor catalog purchase orders, RFQs, depreciation schedules, and hardware birth record logs.", category: "Operations", tier: "Enterprise" },
  { key: "CHANGES", name: "Changes", desc: "ITIL-compliant change approval boards managing risk calculations and rollback playbooks.", category: "Operations", tier: "Enterprise" },
  { key: "PROBLEMS", name: "Problems", desc: "Problem ticket correlation managing root cause analysis folders and known error libraries.", category: "Operations", tier: "Enterprise" },
  { key: "FLEET", name: "Fleet / GPS", desc: "Real-time vehicle GPS tracker showing geo-fences, driver safety alerts, and fuel card logs.", category: "Monitoring", tier: "Enterprise" },
  { key: "CCTV", name: "CCTV", desc: "Contextual video cameras linked directly to locations, server racks, and security incidents.", category: "Monitoring", tier: "Professional" },
  { key: "VDI", name: "VDI", desc: "Cloud virtual desktop orchestrator provisioning isolated dev environments with console access.", category: "Monitoring", tier: "Enterprise" },
  { key: "NAC", name: "NAC", desc: "Network access control policies with quarantine and CoA hooks.", category: "Monitoring", tier: "Enterprise" },
  { key: "ALERTS", name: "Alerts", desc: "Unified AlertEvent console across fleet, NMS, CCTV, and security.", category: "Monitoring", tier: "Professional" },
  { key: "INTELLIGENCE", name: "Intelligence", desc: "AI risk scoring and next-best-action recommendations.", category: "Core Features", tier: "Enterprise" },
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
    slackWebhookUrl: "", teamsWebhookUrl: "",
    sessionTimeout: 30, mfaEnforced: false, passwordExpiry: 90, ipWhitelist: "",
    aiEnabled: true, auditRetentionDays: 365,
    scanInterval: 60, snmpCommunity: "public", agentPort: 8443,
    agentStartOnBoot: false,
    storageProvider: "local",
    storagePath: "/var/lib/qsasset/data",
    maxUploadLimit: 50,
    backupPath: "/var/lib/qsasset/backups",
    backupInterval: "daily",
    retentionDays: 90,
    scannerConcurrency: 4,
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
  const [cloudConnectors, setCloudConnectors] = useState<any[]>([]);
  const [cloudForm, setCloudForm] = useState({
    name: "",
    provider: "AWS",
    accessKeyId: "",
    secretAccessKey: "",
    clientSecret: "",
    subscriptionId: "",
    regions: "us-east-1",
    serviceAccountJson: "",
  });
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMsg, setCloudMsg] = useState("");
  const [mfaStatus, setMfaStatus] = useState<any>(null);
  const [mfaEnroll, setMfaEnroll] = useState<any>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [ssoConfigs, setSsoConfigs] = useState<any[]>([]);
  const [ssoForm, setSsoForm] = useState({ entityId: "", ssoUrl: "", certificate: "", groupRoleMap: "{}", enabled: false });
  const [emailIngest, setEmailIngest] = useState<any[]>([]);
  const [emailForm, setEmailForm] = useState({ host: "", port: 993, username: "", password: "", folder: "INBOX" });
  const [productLicense, setProductLicense] = useState<any>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [licenseFileText, setLicenseFileText] = useState("");
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [licenseMsg, setLicenseMsg] = useState("");

  async function loadProductLicense() {
    try {
      setProductLicense(await apiFetch("/product-licenses/instance/status"));
    } catch {
      setProductLicense(null);
    }
  }

  async function loadSso() {
    try {
      const rows = await apiFetch("/auth/sso/configs");
      setSsoConfigs(Array.isArray(rows) ? rows : []);
    } catch { setSsoConfigs([]); }
  }
  async function loadEmailIngest() {
    try {
      const rows = await apiFetch("/tickets/email-ingest");
      setEmailIngest(Array.isArray(rows) ? rows : []);
    } catch { setEmailIngest([]); }
  }
  async function loadMfa() {
    try {
      setMfaStatus(await apiFetch("/auth/mfa/status"));
    } catch { setMfaStatus({ mfaEnabled: false }); }
  }

  async function loadCloudConnectors() {
    try {
      const rows = await apiFetch("/cloud-connectors");
      setCloudConnectors(Array.isArray(rows) ? rows : []);
    } catch {
      setCloudConnectors([]);
    }
  }

  useEffect(() => {
    if (activeSection === "integrations") loadCloudConnectors();
    if (activeSection === "license") loadProductLicense();
    if (activeSection === "security") {
      loadMfa();
      loadSso();
      loadEmailIngest();
    }
  }, [activeSection]);

  function emptyCloudForm() {
    return {
      name: "",
      provider: "AWS",
      accessKeyId: "",
      secretAccessKey: "",
      clientSecret: "",
      subscriptionId: "",
      regions: "us-east-1",
      serviceAccountJson: "",
    };
  }

  async function createCloudConnector() {
    setCloudBusy(true);
    setCloudMsg("");
    try {
      let credentials: Record<string, string> = {};
      let regions = cloudForm.regions.split(",").map((r) => r.trim()).filter(Boolean);
      if (cloudForm.provider === "AWS") {
        credentials = {
          accessKeyId: cloudForm.accessKeyId,
          secretAccessKey: cloudForm.secretAccessKey,
        };
      } else if (cloudForm.provider === "AZURE") {
        credentials = {
          tenantId: cloudForm.accessKeyId,
          clientId: cloudForm.secretAccessKey,
          clientSecret: cloudForm.clientSecret,
          subscriptionId: cloudForm.subscriptionId,
        };
        if (cloudForm.subscriptionId) regions = [cloudForm.subscriptionId];
      } else if (cloudForm.provider === "GCP") {
        credentials = { serviceAccountJson: cloudForm.serviceAccountJson };
      }
      await apiFetch("/cloud-connectors", {
        method: "POST",
        body: JSON.stringify({
          name: cloudForm.name || `${cloudForm.provider} Connector`,
          provider: cloudForm.provider,
          regions,
          credentials,
        }),
      });
      setCloudForm(emptyCloudForm());
      setCloudMsg("Connector saved.");
      await loadCloudConnectors();
    } catch (err: any) {
      setCloudMsg(err?.message || "Failed to create connector");
    } finally {
      setCloudBusy(false);
    }
  }

  async function syncCloudConnector(id: string) {
    setCloudBusy(true);
    setCloudMsg("");
    try {
      const result = await apiFetch(`/cloud-connectors/${id}/sync`, { method: "POST" });
      setCloudMsg(`Synced ${result.upserted ?? 0} assets from ${result.provider}.`);
      await loadCloudConnectors();
    } catch (err: any) {
      setCloudMsg(err?.message || "Sync failed");
    } finally {
      setCloudBusy(false);
    }
  }

  async function deleteCloudConnector(id: string) {
    if (!confirm("Delete this cloud connector?")) return;
    await apiFetch(`/cloud-connectors/${id}`, { method: "DELETE" });
    await loadCloudConnectors();
  }

  useEffect(() => {
    apiFetch("/settings")
      .then(data => {
        const {
          allowedModules: allowed,
          activeModules: active,
          userDisabledModules: disabled,
          tenantId,
          plan,
          ...configurableSettings
        } = data;
        setSettings(prev => ({ ...prev, ...configurableSettings }));
        if (allowed) setAllowedModules(allowed);
        if (active) setActiveModules(active);
        if (disabled) setUserDisabledModules(disabled);
      }).catch((e) => { console.error('Settings load error:', e); }).finally(() => setLoading(false));
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
      const updated = exists
        ? prev.filter(m => m !== moduleKey)
        : [...prev, moduleKey];

      // Auto-save this setting instantly to the backend (Premium UX)
      apiFetch("/settings", {
        method: "PATCH",
        body: JSON.stringify({ ...settings, userDisabledModules: updated }),
      }).then(() => {
        // Dispatch custom event to notify layout sidebar instantly
        window.dispatchEvent(new CustomEvent("workspace-modules-updated"));
      }).catch(err => {
        console.error("Failed to auto-save workspace customization", err);
      });

      return updated;
    });
  }

  // Load account data when tab is activated
  useEffect(() => {
    if (activeSection === "account" && !account) {
      apiFetch("/settings/account").then(setAccount).catch((e) => { console.error('Settings load error:', e); });
    }
    if (activeSection === "billing" && !subscription) {
      apiFetch("/settings/subscription").then(setSubscription).catch((e) => { console.error('Settings load error:', e); });
    }
    if (activeSection === "invoices" && invoices.length === 0) {
      apiFetch("/settings/invoices").then(d => setInvoices(Array.isArray(d) ? d : [])).catch((e) => { console.error('Settings load error:', e); });
    }
  }, [activeSection]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/settings", { method: "PATCH", body: JSON.stringify({ ...settings, currency, userDisabledModules }) });
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
    } catch (e) { console.error('Settings save error:', e); } finally { setSaving(false); }
  }

  async function handleUpgrade(plan: string) {
    setUpgrading(true);
    try {
      const result = await apiFetch("/settings/upgrade", {
        method: "POST",
        body: JSON.stringify({ plan, billingCycle: "MONTHLY", currency }),
      });
      // Redirect to Stripe Checkout (or other hosted checkout) when URL is returned
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      // Reload subscription data when no hosted checkout (pending / Razorpay order-only)
      const sub = await apiFetch("/settings/subscription");
      setSubscription(sub);
      const acc = await apiFetch("/settings/account");
      setAccount(acc);
    } catch (e) { console.error('Settings upgrade error:', e); } finally { setUpgrading(false); }
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
        {!["account", "billing", "invoices", "license"].includes(activeSection) && (
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
                              padding: 18,
                              borderRadius: 14,
                              background: isUnlocked 
                                ? "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)" 
                                : "rgba(10, 14, 26, 0.3)",
                              border: `1px solid ${isActive ? "var(--brand-500)" : "var(--border-primary)"}`,
                              boxShadow: isActive ? "0 0 16px rgba(6, 182, 212, 0.08), inset 0 0 12px rgba(6, 182, 212, 0.04)" : "none",
                              opacity: isUnlocked ? 1 : 0.6,
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 16,
                              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                  <span style={{
                                    fontSize: 13.5,
                                    fontWeight: 700,
                                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                                    transition: "color 0.2s"
                                  }}>{module.name}</span>

                                  {isActive && (
                                    <span style={{
                                      width: 6, height: 6, borderRadius: "50%", background: "#10b981",
                                      boxShadow: "0 0 8px #10b981", display: "inline-block",
                                      animation: "pulseGlow 2s infinite"
                                    }} />
                                  )}
                                  
                                  {module.tier && !isUnlocked && (
                                    <span style={{
                                      fontSize: 9,
                                      fontWeight: 800,
                                      textTransform: "uppercase",
                                      color: module.tier === "Enterprise" ? "#8b5cf6" : "#06b6d4",
                                      background: module.tier === "Enterprise" ? "rgba(139,92,246,0.12)" : "rgba(6,182,212,0.12)",
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      letterSpacing: "0.04em",
                                      border: `1px solid ${module.tier === "Enterprise" ? "rgba(139,92,246,0.2)" : "rgba(6,182,212,0.2)"}`
                                    }}>
                                      {module.tier} Plan
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{module.desc}</p>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", alignSelf: "center" }}>
                                {isUnlocked ? (
                                  <button
                                    onClick={() => toggleWorkspaceModule(module.key)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      transition: "all 0.2s",
                                    }}
                                  >
                                    <div style={{
                                      width: 44,
                                      height: 22,
                                      borderRadius: 11,
                                      background: isActive ? "rgba(6, 182, 212, 0.25)" : "rgba(100, 116, 139, 0.08)",
                                      border: `1px solid ${isActive ? "var(--brand-500)" : "var(--border-secondary)"}`,
                                      position: "relative",
                                      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                    }}>
                                      <div style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: "50%",
                                        background: isActive ? "var(--brand-400)" : "var(--text-secondary)",
                                        boxShadow: isActive ? "0 0 8px var(--brand-400)" : "none",
                                        position: "absolute",
                                        top: 3,
                                        left: isActive ? 24 : 4,
                                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                      }} />
                                    </div>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setActiveSection("billing")}
                                    style={{
                                      background: "var(--bg-elevated)",
                                      border: "1px solid var(--border-secondary)",
                                      borderRadius: 8,
                                      padding: "6px 12px",
                                      color: "var(--brand-400)",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      transition: "all 0.2s",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand-400)"; e.currentTarget.style.boxShadow = "var(--shadow-glow)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-secondary)"; e.currentTarget.style.boxShadow = "none"; }}
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

          {activeSection === "license" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Product License</h2>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 24 }}>
                On-prem and enterprise installs activate a NeurQ-signed entitlement (online key or offline .lic file).
              </p>

              {productLicense && (
                <div style={{
                  padding: 16, borderRadius: 12, marginBottom: 20,
                  border: `1px solid ${productLicense.valid ? "#10b98155" : "#f59e0b55"}`,
                  background: productLicense.valid ? "#10b98112" : "#f59e0b12",
                }}>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                    Status: {productLicense.status}
                    {productLicense.deploymentMode === "saas" && " (SaaS — no local product license required)"}
                  </div>
                  {productLicense.message && (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{productLicense.message}</p>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                    <div>Plan: <strong style={{ color: "var(--text-primary)" }}>{productLicense.plan}</strong></div>
                    <div>Expires: <strong style={{ color: "var(--text-primary)" }}>{productLicense.expiresAt ? new Date(productLicense.expiresAt).toLocaleDateString() : "—"}</strong></div>
                    <div>Max users: <strong style={{ color: "var(--text-primary)" }}>{productLicense.maxUsers < 0 ? "Unlimited" : productLicense.maxUsers}</strong></div>
                    <div>Max assets: <strong style={{ color: "var(--text-primary)" }}>{productLicense.maxAssets < 0 ? "Unlimited" : productLicense.maxAssets}</strong></div>
                    <div style={{ gridColumn: "1 / -1" }}>Key: <code>{productLicense.licenseKey || "—"}</code></div>
                    {Array.isArray(productLicense.allowedModules) && productLicense.allowedModules.length > 0 && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        Modules: {productLicense.allowedModules.slice(0, 12).join(", ")}
                        {productLicense.allowedModules.length > 12 ? ` +${productLicense.allowedModules.length - 12} more` : ""}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {productLicense?.deploymentMode === "onprem" && (
                <div style={{ display: "grid", gap: 20 }}>
                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Activate online</h3>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                      Requires LICENSE_SERVER_URL pointing at NeurQ SaaS.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={licenseKeyInput}
                        onChange={(e) => setLicenseKeyInput(e.target.value)}
                        placeholder="QS-XXXX-XXXX-XXXX-XXXX"
                        style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, fontFamily: "monospace" }}
                      />
                      <button
                        disabled={licenseBusy || !licenseKeyInput.trim()}
                        onClick={async () => {
                          setLicenseBusy(true); setLicenseMsg("");
                          try {
                            await apiFetch("/product-licenses/instance/activate-key", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ licenseKey: licenseKeyInput.trim() }),
                            });
                            setLicenseMsg("License activated.");
                            await loadProductLicense();
                          } catch (err: any) {
                            setLicenseMsg(err?.message || "Activation failed");
                          } finally {
                            setLicenseBusy(false);
                          }
                        }}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#06b6d4", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                      >
                        {licenseBusy ? "…" : "Activate"}
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Upload offline .lic</h3>
                    <textarea
                      value={licenseFileText}
                      onChange={(e) => setLicenseFileText(e.target.value)}
                      placeholder="Paste .lic JSON contents or base64 blob…"
                      rows={6}
                      style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace", marginBottom: 10 }}
                    />
                    <input
                      type="file"
                      accept=".lic,.json,application/json,text/plain"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLicenseFileText(await file.text());
                      }}
                      style={{ marginBottom: 10, fontSize: 12, color: "var(--text-secondary)" }}
                    />
                    <button
                      disabled={licenseBusy || !licenseFileText.trim()}
                      onClick={async () => {
                        setLicenseBusy(true); setLicenseMsg("");
                        try {
                          await apiFetch("/product-licenses/instance/upload", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ content: licenseFileText.trim() }),
                          });
                          setLicenseMsg("License file applied.");
                          await loadProductLicense();
                        } catch (err: any) {
                          setLicenseMsg(err?.message || "Upload failed");
                        } finally {
                          setLicenseBusy(false);
                        }
                      }}
                      style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#06b6d4", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    >
                      Apply license file
                    </button>
                  </div>
                </div>
              )}

              {licenseMsg && (
                <p style={{ marginTop: 16, fontSize: 13, color: licenseMsg.toLowerCase().includes("fail") ? "#ef4444" : "#10b981" }}>
                  {licenseMsg}
                </p>
              )}
            </div>
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
                <ToggleRow label="AI assistance" desc="Tenant kill-switch for all AI analysis and Copilot requests" value={settings.aiEnabled} onChange={() => setSettings({ ...settings, aiEnabled: !settings.aiEnabled })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Session Timeout (minutes)" value={String(settings.sessionTimeout)} onChange={v => setSettings({ ...settings, sessionTimeout: Number(v) })} />
                  <Field label="Password Expiry (days)" value={String(settings.passwordExpiry)} onChange={v => setSettings({ ...settings, passwordExpiry: Number(v) })} />
                </div>
                <Field label="IP Whitelist (comma separated)" value={settings.ipWhitelist} onChange={v => setSettings({ ...settings, ipWhitelist: v })} placeholder="10.0.0.0/8, 192.168.1.0/24" />

                {/* Personal MFA enroll */}
                <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Your MFA (TOTP)</div>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>
                    {mfaStatus?.mfaEnabled ? "MFA is enabled on your account." : "Enroll an authenticator app for login challenges."}
                  </p>
                  {!mfaStatus?.mfaEnabled && !mfaEnroll && (
                    <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={mfaBusy} onClick={async () => {
                      setMfaBusy(true);
                      try {
                        const data = await apiFetch("/auth/mfa/enroll", { method: "POST", body: "{}" });
                        setMfaEnroll(data);
                      } catch (e) { alert(String(e)); }
                      setMfaBusy(false);
                    }}>Enroll MFA</button>
                  )}
                  {mfaEnroll && (
                    <div style={{ display: "grid", gap: 10 }}>
                      {mfaEnroll.qrDataUrl && <img src={mfaEnroll.qrDataUrl} alt="MFA QR" width={160} height={160} />}
                      <code style={{ fontSize: 11, wordBreak: "break-all" }}>{mfaEnroll.secret}</code>
                      <Field label="Enter code from app" value={mfaCode} onChange={setMfaCode} placeholder="123456" />
                      <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={mfaBusy} onClick={async () => {
                        setMfaBusy(true);
                        try {
                          await apiFetch("/auth/mfa/verify-enroll", { method: "POST", body: JSON.stringify({ code: mfaCode }) });
                          setMfaEnroll(null); setMfaCode("");
                          const st = await apiFetch("/auth/mfa/status");
                          setMfaStatus(st);
                        } catch (e) { alert(String(e)); }
                        setMfaBusy(false);
                      }}>Verify & enable</button>
                    </div>
                  )}
                  {mfaStatus?.mfaEnabled && (
                    <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
                      <Field label="Code to disable" value={mfaCode} onChange={setMfaCode} placeholder="123456" />
                      <button className="btn btn-secondary" style={{ fontSize: 12, color: "#ef4444" }} onClick={async () => {
                        try {
                          await apiFetch("/auth/mfa/disable", { method: "POST", body: JSON.stringify({ code: mfaCode }) });
                          setMfaStatus({ mfaEnabled: false }); setMfaCode("");
                        } catch (e) { alert(String(e)); }
                      }}>Disable MFA</button>
                    </div>
                  )}
                </div>

                {/* SAML SSO config */}
                <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Enterprise SAML</div>
                  <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                    {ssoConfigs.map((c: any) => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: 10, background: "var(--bg-card)", borderRadius: 8 }}>
                        <span>{c.provider} {c.enabled ? "· enabled" : "· disabled"} {c.hasCertificate ? "· cert ✓" : ""}</span>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 8px", color: "#ef4444" }} onClick={async () => {
                          await apiFetch(`/auth/sso/configs/${c.id}`, { method: "DELETE" });
                          loadSso();
                        }}>Delete</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <Field label="Entity ID" value={ssoForm.entityId} onChange={v => setSsoForm({ ...ssoForm, entityId: v })} />
                    <Field label="IdP SSO URL" value={ssoForm.ssoUrl} onChange={v => setSsoForm({ ...ssoForm, ssoUrl: v })} />
                    <Field label="IdP Certificate (PEM or base64)" value={ssoForm.certificate} onChange={v => setSsoForm({ ...ssoForm, certificate: v })} />
                    <Field label="Group→Role map JSON" value={ssoForm.groupRoleMap} onChange={v => setSsoForm({ ...ssoForm, groupRoleMap: v })} placeholder='{"Admins":"Tenant Admin"}' />
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <input type="checkbox" checked={ssoForm.enabled} onChange={e => setSsoForm({ ...ssoForm, enabled: e.target.checked })} /> Enable
                    </label>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={async () => {
                      try {
                        let groupRoleMap = {};
                        try { groupRoleMap = JSON.parse(ssoForm.groupRoleMap || "{}"); } catch { /* */ }
                        await apiFetch("/auth/sso/configs", {
                          method: "POST",
                          body: JSON.stringify({
                            provider: "SAML",
                            enabled: ssoForm.enabled,
                            entityId: ssoForm.entityId,
                            ssoUrl: ssoForm.ssoUrl,
                            certificate: ssoForm.certificate,
                            groupRoleMap,
                          }),
                        });
                        setSsoForm({ entityId: "", ssoUrl: "", certificate: "", groupRoleMap: "{}", enabled: false });
                        loadSso();
                      } catch (e) { alert(String(e)); }
                    }}>Save SAML config</button>
                  </div>
                </div>

                {/* Email ingest */}
                <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Email → Ticket ingest (IMAP)</div>
                  {emailIngest.map((c: any) => (
                    <div key={c.id} style={{ fontSize: 12, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                      <span>{c.username}@{c.host}:{c.port} {c.enabled ? "· on" : "· off"}</span>
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 8px" }} onClick={async () => {
                        try { await apiFetch(`/tickets/email-ingest/${c.id}/poll`, { method: "POST", body: "{}" }); alert("Poll complete"); }
                        catch (e) { alert(String(e)); }
                      }}>Poll now</button>
                    </div>
                  ))}
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <Field label="IMAP host" value={emailForm.host} onChange={v => setEmailForm({ ...emailForm, host: v })} />
                    <Field label="Username" value={emailForm.username} onChange={v => setEmailForm({ ...emailForm, username: v })} />
                    <Field label="Password" value={emailForm.password} onChange={v => setEmailForm({ ...emailForm, password: v })} />
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={async () => {
                      try {
                        await apiFetch("/tickets/email-ingest", { method: "POST", body: JSON.stringify(emailForm) });
                        setEmailForm({ host: "", port: 993, username: "", password: "", folder: "INBOX" });
                        loadEmailIngest();
                      } catch (e) { alert(String(e)); }
                    }}>Add mailbox</button>
                  </div>
                </div>
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

                {/* ── Start on Boot — Premium Feature ── */}
                <div style={{
                  padding: 20,
                  borderRadius: 14,
                  background: settings.agentStartOnBoot
                    ? "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(6,182,212,0.04) 100%)"
                    : "var(--bg-card)",
                  border: `1px solid ${settings.agentStartOnBoot ? "rgba(16,185,129,0.25)" : "var(--border-primary)"}`,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}>
                  <ToggleRow
                    label="Start on Boot (Persistent Service)"
                    desc="Install the discovery agent as a persistent OS daemon that survives reboots. Applies to all connected agents on next heartbeat."
                    value={settings.agentStartOnBoot}
                    onChange={() => setSettings({ ...settings, agentStartOnBoot: !settings.agentStartOnBoot })}
                  />

                  {/* Permissions & OS-specific instructions */}
                  <div style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 10,
                    background: "rgba(15, 23, 42, 0.35)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: 12 }}>
                      Required OS Permissions
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      {/* macOS */}
                      <div style={{
                        padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 16 }}>🍏</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>macOS</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                          <strong style={{ color: "var(--text-secondary)" }}>LaunchDaemon</strong><br />
                          Requires <code style={{ fontSize: 10, padding: "1px 4px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>sudo</code> to install at <code style={{ fontSize: 10, padding: "1px 4px", borderRadius: 4, background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}>/Library/LaunchDaemons/</code>.<br />
                          Runs as root for complete ports & updates telemetry.
                        </div>
                      </div>

                      {/* Linux */}
                      <div style={{
                        padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 16 }}>🐧</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Linux</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                          <strong style={{ color: "var(--text-secondary)" }}>systemd Service</strong><br />
                          Requires <code style={{ fontSize: 10, padding: "1px 4px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>sudo</code> to install at <code style={{ fontSize: 10, padding: "1px 4px", borderRadius: 4, background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}>/etc/systemd/system/</code>.
                          Auto-restarts on crash.
                        </div>
                      </div>

                      {/* Windows */}
                      <div style={{
                        padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 16 }}>🪟</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Windows</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                          <strong style={{ color: "var(--text-secondary)" }}>Windows Service</strong><br />
                          Requires <code style={{ fontSize: 10, padding: "1px 4px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Administrator</code> to install via <code style={{ fontSize: 10, padding: "1px 4px", borderRadius: 4, background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}>sc.exe</code>.
                          Runs as Local System.
                        </div>
                      </div>
                    </div>

                    {settings.agentStartOnBoot && (
                      <div style={{
                        marginTop: 12, padding: "10px 14px", borderRadius: 8,
                        background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)",
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%", background: "#10b981",
                          boxShadow: "0 0 10px rgba(16,185,129,0.5)",
                          animation: "pulseGlow 2s infinite",
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>
                          Active — all connected agents will receive the install directive on their next heartbeat cycle.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <Field label="Scan Interval (min)" value={String(settings.scanInterval)} onChange={v => setSettings({ ...settings, scanInterval: Number(v) })} />
                  <Field label="SNMP Community" value={settings.snmpCommunity} onChange={v => setSettings({ ...settings, snmpCommunity: v })} />
                  <Field label="Agent Port" value={String(settings.agentPort)} onChange={v => setSettings({ ...settings, agentPort: Number(v) })} />
                </div>
              </div>
            </>
          )}

          {activeSection === "storage" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Storage & System</h2>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#10b981",
                  background: "rgba(16,185,129,0.08)",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}>
                  Storage Engine: Local Disk Active
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 24 }}>
                Configure platform storage pathways, automatic database backups, and concurrent network scan capacity for this tenant.
              </p>

              <div style={{ display: "grid", gap: 24 }}>
                {/* Storage Configuration */}
                <div>
                  <h3 style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-tertiary)",
                    marginBottom: 12,
                    borderBottom: "1px solid var(--border-primary)",
                    paddingBottom: 6,
                  }}>Storage Engine</h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Storage Provider</label>
                      <select 
                        value={settings.storageProvider || "local"} 
                        onChange={e => setSettings({ ...settings, storageProvider: e.target.value })}
                        style={{
                          width: "100%", padding: "8px 12px", background: "var(--bg-input)",
                          border: "1px solid var(--border-primary)", borderRadius: 8,
                          color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none",
                        }}
                      >
                        <option value="local">Local File System (On-Premises Default)</option>
                        <option value="s3">AWS S3 / Compatible (MinIO)</option>
                        <option value="gcs">Google Cloud Storage</option>
                        <option value="azure">Azure Blob Storage</option>
                      </select>
                    </div>

                    <Field 
                      label="Max File Upload Limit (MB)" 
                      value={String(settings.maxUploadLimit || 50)} 
                      onChange={v => setSettings({ ...settings, maxUploadLimit: Number(v) || 50 })} 
                    />
                  </div>

                  <Field 
                    label="Storage Path / Root Directory" 
                    value={settings.storagePath || "/var/lib/qsasset/data"} 
                    onChange={v => setSettings({ ...settings, storagePath: v })} 
                    placeholder="/var/lib/qsasset/data or C:\qsasset\data" 
                  />
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                    Path on the host machine where uploaded PDFs, asset documents, photos, and agent packages are saved.
                  </p>
                </div>

                {/* Backups & Retention */}
                <div>
                  <h3 style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-tertiary)",
                    marginBottom: 12,
                    borderBottom: "1px solid var(--border-primary)",
                    paddingBottom: 6,
                  }}>Backups & Retention</h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Backup Frequency</label>
                      <select 
                        value={settings.backupInterval || "daily"} 
                        onChange={e => setSettings({ ...settings, backupInterval: e.target.value })}
                        style={{
                          width: "100%", padding: "8px 12px", background: "var(--bg-input)",
                          border: "1px solid var(--border-primary)", borderRadius: 8,
                          color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none",
                        }}
                      >
                        <option value="none">No Automated Backups</option>
                        <option value="daily">Daily Automated Backup</option>
                        <option value="weekly">Weekly Automated Backup</option>
                        <option value="monthly">Monthly Automated Backup</option>
                      </select>
                    </div>

                    <Field 
                      label="Data Retention Period (Days)" 
                      value={String(settings.retentionDays || 90)} 
                      onChange={v => setSettings({ ...settings, retentionDays: Number(v) || 90 })} 
                    />
                    <Field
                      label="Audit Retention Policy (Days, minimum 180)"
                      value={String(settings.auditRetentionDays || 365)}
                      onChange={v => setSettings({ ...settings, auditRetentionDays: Math.max(180, Number(v) || 365) })}
                    />
                  </div>

                  <Field 
                    label="Backup Output Directory" 
                    value={settings.backupPath || "/var/lib/qsasset/backups"} 
                    onChange={v => setSettings({ ...settings, backupPath: v })} 
                    placeholder="/var/lib/qsasset/backups" 
                  />
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                    Destination folder where automated SQL database dumps and system snapshots are compiled.
                  </p>
                </div>

                {/* Scan Infrastructure */}
                <div>
                  <h3 style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-tertiary)",
                    marginBottom: 12,
                    borderBottom: "1px solid var(--border-primary)",
                    paddingBottom: 6,
                  }}>System Scaling</h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <Field 
                      label="Concurrent Scan Workers (Threads)" 
                      value={String(settings.scannerConcurrency || 4)} 
                      onChange={v => setSettings({ ...settings, scannerConcurrency: Number(v) || 4 })} 
                    />
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Telemetry Queue Size</label>
                      <input 
                        value="10,000 Messages / sec (Max)" 
                        disabled 
                        style={{
                          width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.02)",
                          border: "1px solid var(--border-primary)", borderRadius: 8,
                          color: "var(--text-tertiary)", fontSize: 13, fontFamily: "inherit", outline: "none",
                        }} 
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                    Adjust background processing power. Scale scan concurrency to higher numbers if scanning large Class B subnets.
                  </p>
                </div>

                {/* Database Maintenance Actions */}
                <div style={{
                  padding: 18,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(6,182,212,0.04) 0%, rgba(139,92,246,0.02) 100%)",
                  border: "1px solid var(--border-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16
                }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Export Settings</h4>
                    <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                      Downloads current settings as JSON (not a database backup).
                    </p>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `qsasset-settings-${new Date().toISOString().split('T')[0]}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600 }}
                  >
                    Export Settings
                  </button>
                </div>
              </div>
            </>
          )}

          {activeSection === "integrations" && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Integrations</h2>
              <p style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 20 }}>
                Connect QS Asset to your existing tools. Configured webhook integrations deliver real-time alerts and notifications.
              </p>

              {/* Live webhook integrations */}
              <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
                <div style={{ padding: 16, background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border-primary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 22 }}>💬</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Slack</div>
                      <span className={`badge ${settings.slackWebhookUrl ? "green" : "gray"}`} style={{ fontSize: 9 }}>
                        {settings.slackWebhookUrl ? "Connected" : "Not Configured"}
                      </span>
                    </div>
                  </div>
                  <Field label="Slack Incoming Webhook URL" value={settings.slackWebhookUrl} onChange={v => setSettings({ ...settings, slackWebhookUrl: v })} placeholder="https://hooks.slack.com/services/..." />
                </div>

                <div style={{ padding: 16, background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border-primary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 22 }}>🟦</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Microsoft Teams</div>
                      <span className={`badge ${settings.teamsWebhookUrl ? "green" : "gray"}`} style={{ fontSize: 9 }}>
                        {settings.teamsWebhookUrl ? "Connected" : "Not Configured"}
                      </span>
                    </div>
                  </div>
                  <Field label="Teams Incoming Webhook URL" value={settings.teamsWebhookUrl} onChange={v => setSettings({ ...settings, teamsWebhookUrl: v })} placeholder="https://outlook.office.com/webhook/..." />
                </div>

                <div style={{ padding: 16, background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border-primary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 22 }}>🔗</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Generic Webhook</div>
                      <span className={`badge ${settings.webhookUrl ? "green" : "gray"}`} style={{ fontSize: 9 }}>
                        {settings.webhookUrl ? "Connected" : "Not Configured"}
                      </span>
                    </div>
                  </div>
                  <Field label="Webhook URL" value={settings.webhookUrl} onChange={v => setSettings({ ...settings, webhookUrl: v })} placeholder="https://hooks.example.com/alerts" />
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Cloud Connectors</div>
              <p style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 12 }}>
                Sync cloud compute into the asset inventory: AWS EC2, Azure VMs (ARM), and GCP Compute Engine.
                Active Directory / LDAP sync is configured on the Discovery page under the <strong>AD / LDAP</strong> tab.
              </p>
              {cloudMsg && (
                <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text-secondary)", padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}>
                  {cloudMsg}
                </div>
              )}
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                {cloudConnectors.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No cloud connectors configured yet.</div>
                ) : cloudConnectors.map((c) => (
                  <div key={c.id} style={{ padding: 14, background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {c.provider} • {c.enabled ? "Enabled" : "Disabled"}
                        {c.lastSyncAt ? ` • Last sync ${new Date(c.lastSyncAt).toLocaleString()}` : ""}
                        {c.lastSyncStatus ? ` • ${c.lastSyncStatus}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-secondary" disabled={cloudBusy} onClick={() => syncCloudConnector(c.id)} style={{ fontSize: 11, padding: "6px 10px" }}>Sync</button>
                      <button className="btn btn-secondary" onClick={() => deleteCloudConnector(c.id)} style={{ fontSize: 11, padding: "6px 10px", color: "#ef4444" }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: 16, background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border-primary)", marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Add connector</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <Field label="Name" value={cloudForm.name} onChange={(v) => setCloudForm((p) => ({ ...p, name: v }))} placeholder="Prod AWS" />
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Provider</label>
                    <select value={cloudForm.provider} onChange={(e) => setCloudForm((p) => ({ ...p, provider: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px", background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }}>
                      <option value="AWS">AWS</option>
                      <option value="AZURE">Azure</option>
                      <option value="GCP">GCP</option>
                    </select>
                  </div>
                  {cloudForm.provider === "AWS" && (
                    <>
                      <Field label="Access Key ID" value={cloudForm.accessKeyId} onChange={(v) => setCloudForm((p) => ({ ...p, accessKeyId: v }))} placeholder="AKIA..." />
                      <Field label="Secret Access Key" value={cloudForm.secretAccessKey} onChange={(v) => setCloudForm((p) => ({ ...p, secretAccessKey: v }))} placeholder="••••••••" />
                      <Field label="Regions (comma-separated)" value={cloudForm.regions} onChange={(v) => setCloudForm((p) => ({ ...p, regions: v }))} placeholder="us-east-1,eu-west-1" />
                    </>
                  )}
                  {cloudForm.provider === "AZURE" && (
                    <>
                      <Field label="Tenant ID" value={cloudForm.accessKeyId} onChange={(v) => setCloudForm((p) => ({ ...p, accessKeyId: v }))} placeholder="xxxxxxxx-xxxx-..." />
                      <Field label="Client ID" value={cloudForm.secretAccessKey} onChange={(v) => setCloudForm((p) => ({ ...p, secretAccessKey: v }))} placeholder="app registration client id" />
                      <Field label="Client Secret" value={cloudForm.clientSecret} onChange={(v) => setCloudForm((p) => ({ ...p, clientSecret: v }))} placeholder="••••••••" />
                      <Field label="Subscription ID" value={cloudForm.subscriptionId} onChange={(v) => setCloudForm((p) => ({ ...p, subscriptionId: v }))} placeholder="subscription uuid" />
                    </>
                  )}
                  {cloudForm.provider === "GCP" && (
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Service Account JSON</label>
                      <textarea
                        value={cloudForm.serviceAccountJson}
                        onChange={(e) => setCloudForm((p) => ({ ...p, serviceAccountJson: e.target.value }))}
                        placeholder='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
                        rows={6}
                        style={{ width: "100%", padding: "8px 12px", background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace" }}
                      />
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={
                      cloudBusy ||
                      (cloudForm.provider === "AWS" && !cloudForm.accessKeyId) ||
                      (cloudForm.provider === "AZURE" && (!cloudForm.accessKeyId || !cloudForm.clientSecret || !cloudForm.subscriptionId)) ||
                      (cloudForm.provider === "GCP" && !cloudForm.serviceAccountJson)
                    }
                    onClick={createCloudConnector}
                    style={{ justifySelf: "start" }}
                  >
                    {cloudBusy ? "Saving..." : "Save Connector"}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>On the Roadmap</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { name: "ServiceNow", icon: "🎫" },
                  { name: "Jira", icon: "📋" },
                  { name: "Okta SSO", icon: "🔐" },
                ].map(i => (
                  <div key={i.name} style={{
                    padding: 14, background: "var(--bg-elevated)", borderRadius: 10,
                    border: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{i.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name}</div>
                        <span className="badge gray" style={{ fontSize: 9 }}>Planned</span>
                      </div>
                    </div>
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
