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
  { id: "account", label: "Account", icon: <User size={16} /> },
  { id: "billing", label: "Billing & Plan", icon: <CreditCard size={16} /> },
  { id: "invoices", label: "Invoices", icon: <Receipt size={16} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={16} /> },
  { id: "security", label: "Security & Auth", icon: <Shield size={16} /> },
  { id: "discovery", label: "Discovery & Scanning", icon: <Server size={16} /> },
  { id: "integrations", label: "Integrations", icon: <Globe size={16} /> },
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

  useEffect(() => {
    apiFetch("/settings")
      .then(data => {
        setSettings(prev => ({ ...prev, ...data }));
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

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
      await apiFetch("/settings", { method: "PATCH", body: JSON.stringify(settings) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  async function handleUpgrade(plan: string) {
    setUpgrading(true);
    try {
      await apiFetch("/settings/upgrade", { method: "POST", body: JSON.stringify({ plan }) });
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

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, minHeight: 500 }}>
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
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Billing & Subscription</h2>
              {subscription ? (
                <div style={{ display: "grid", gap: 24 }}>
                  {/* Current Plan Banner */}
                  <div style={{
                    padding: 20, borderRadius: 12,
                    background: "linear-gradient(135deg, rgba(6,182,212,0.1), rgba(139,92,246,0.1))",
                    border: "1px solid rgba(6,182,212,0.2)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Current Plan</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{subscription.currentPlan}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                          Status: <span style={{ color: "var(--success)", fontWeight: 600 }}>{subscription.subscription.status}</span>
                          {subscription.subscription.billingCycle !== "FREE" && (
                            <> · Billing: <span style={{ fontWeight: 600 }}>{subscription.subscription.billingCycle}</span></>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
                          {subscription.subscription.mrr === 0 ? "Free" : `₹${subscription.subscription.mrr?.toLocaleString("en-IN")}`}
                        </div>
                        {subscription.subscription.mrr > 0 && (
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>per month</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Plan Comparison */}
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: -8 }}>Available Plans</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                    {subscription.plans.map((plan: any) => {
                      const isCurrent = plan.name === subscription.currentPlan;
                      return (
                        <div key={plan.name} style={{
                          padding: 20, borderRadius: 12,
                          background: isCurrent ? "rgba(6,182,212,0.06)" : "var(--bg-elevated)",
                          border: `1px solid ${isCurrent ? "rgba(6,182,212,0.3)" : "var(--border-primary)"}`,
                          position: "relative",
                        }}>
                          {plan.popular && (
                            <div style={{
                              position: "absolute", top: -8, right: 12,
                              background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                              color: "white", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                              textTransform: "uppercase", letterSpacing: "0.05em",
                            }}>Popular</div>
                          )}
                          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>{plan.displayName}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
                            {plan.price === 0 ? "Free" : plan.price < 0 ? "Custom" : `₹${plan.price.toLocaleString("en-IN")}`}
                            {plan.price > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)" }}>/mo</span>}
                            {plan.price < 0 && <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)", marginTop: 2 }}>Tailored pricing</div>}
                          </div>
                          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0" }}>
                            {plan.features.map((f: string) => (
                              <li key={f} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                <CheckCircle size={12} style={{ color: "var(--success)", flexShrink: 0 }} /> {f}
                              </li>
                            ))}
                          </ul>
                          {isCurrent ? (
                            <div style={{
                              padding: "8px 0", textAlign: "center", fontSize: 12, fontWeight: 600,
                              color: "#06b6d4", borderRadius: 8, border: "1px solid rgba(6,182,212,0.3)",
                              background: "rgba(6,182,212,0.06)",
                            }}>Current Plan</div>
                          ) : plan.contactSales ? (
                            <a href="mailto:sales@qsasset.com?subject=Custom Plan Inquiry" style={{
                              display: "block", padding: "8px 0", textAlign: "center", fontSize: 12, fontWeight: 600,
                              color: "white", borderRadius: 8, textDecoration: "none",
                              background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                            }}>Contact Sales</a>
                          ) : (
                            <button onClick={() => handleUpgrade(plan.name)} disabled={upgrading}
                              className="btn btn-primary" style={{ width: "100%", fontSize: 12, padding: "8px 0" }}>
                              {upgrading ? "Processing..." : plan.price > (subscription.subscription.mrr || 0) ? "Upgrade" : "Switch"}
                            </button>
                          )}
                        </div>
                      );
                    })}
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
                        <td style={{ padding: "12px", fontSize: 13, fontWeight: 600 }}>₹{inv.amount?.toLocaleString("en-IN")}</td>
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
