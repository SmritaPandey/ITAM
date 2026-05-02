"use client";
import { useEffect, useState } from "react";
import {
  Settings, Globe, Bell, Shield, Database, Mail,
  Clock, Palette, Save, ToggleLeft, ToggleRight, Key, Server, Lock, Loader2, CheckCircle2
} from "lucide-react";
import { apiFetch, getToken, getApiBase } from "@/lib/api";

interface SettingsSection { id: string; label: string; icon: React.ReactNode; }

const SECTIONS: SettingsSection[] = [
  { id: "general", label: "General", icon: <Settings size={16} /> },
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

  useEffect(() => {
    fetch(`${getApiBase()}/settings`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(data => {
        setSettings(prev => ({ ...prev, ...data }));
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${getApiBase()}/settings`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
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
          <p className="page-subtitle">System configuration and preferences</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saved ? <><CheckCircle2 size={14} /> Saved!</> : <><Save size={14} /> {saving ? "Saving..." : "Save Changes"}</>}
        </button>
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
