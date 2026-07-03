"use client";
import { useEffect, useState, useCallback, Fragment } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Wifi, WifiOff,
  Monitor, Laptop, Server, Smartphone, Printer, Router,
  Loader2, RefreshCw, ChevronDown, ChevronRight, Plus, Trash2, X, Check,
  AlertTriangle, CheckCircle2, XCircle, Eye, EyeOff, Save,
  Activity, Lock, Unlock, Globe, Network, Radio, Scan,
  BarChart3, Cpu, HardDrive, Settings, Zap, Info,
  CircleDot, ArrowRightLeft, FileCode, Layers
} from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ──────────────────────── Types ──────────────────────── */
interface PostureCheck { name: string; passed: boolean; detail?: string; }
interface DevicePosture {
  id: string; hostname: string; ip: string; mac: string; status: "online" | "offline";
  postureScore: number; level: string; recommendedVlan: number; osFamily: string;
  deviceType: string; lastAssessed: string;
  checks: PostureCheck[];
}
interface Segment {
  id: string; name: string; vlanId: number; subnet: string; gateway: string;
  securityZone: string; description: string; deviceCount: number;
}
interface VlanPolicy {
  id: string; name: string; targetVlanId: number; vlanName: string;
  conditions: { osFamily?: string; minPostureScore?: number; deviceType?: string; };
  action: "ASSIGN" | "QUARANTINE"; priority: number; enabled: boolean;
}
interface RadiusConfig {
  serverAddress: string; port: number; sharedSecret: string;
  authProtocol: string; enabled: boolean; status: string; lastSync?: string;
}
interface DashboardData {
  totalDevices: number; compliant: number; nonCompliant: number;
  quarantined: number; online: number; offline: number;
  complianceRate: number; deviceTypes: Record<string, number>;
  radiusStatus: string;
}

/* ──────────────────────── Constants ──────────────────── */
type Tab = "dashboard" | "posture" | "segments" | "policies" | "radius";
const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "posture",   label: "Device Posture", icon: ShieldCheck },
  { key: "segments",  label: "Network Segments", icon: Network },
  { key: "policies",  label: "VLAN Policies", icon: ArrowRightLeft },
  { key: "radius",    label: "RADIUS / 802.1X", icon: Radio },
];

const ZONE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  TRUSTED:    { bg: "rgba(16,185,129,0.08)", border: "#10b981", text: "#10b981", badge: "green" },
  UNTRUSTED:  { bg: "rgba(239,68,68,0.08)",  border: "#ef4444", text: "#ef4444", badge: "red" },
  RESTRICTED: { bg: "rgba(245,158,11,0.08)", border: "#f59e0b", text: "#f59e0b", badge: "amber" },
  QUARANTINE: { bg: "rgba(185,28,28,0.10)",  border: "#991b1b", text: "#fca5a5", badge: "red" },
  DMZ:        { bg: "rgba(59,130,246,0.08)", border: "#3b82f6", text: "#3b82f6", badge: "blue" },
};

const DEVICE_TYPE_ICONS: Record<string, any> = {
  laptop: <Laptop size={14} />, desktop: <Monitor size={14} />, server: <Server size={14} />,
  mobile: <Smartphone size={14} />, printer: <Printer size={14} />, router: <Router size={14} />,
  switch: <Network size={14} />, iot: <Cpu size={14} />,
};

function scoreColor(s: number): string {
  if (s >= 80) return "#10b981";
  if (s >= 50) return "#f59e0b";
  return "#ef4444";
}

function levelBadge(level: string): string {
  switch (level?.toUpperCase()) {
    case "COMPLIANT": return "green";
    case "NON_COMPLIANT": case "NON-COMPLIANT": return "red";
    case "QUARANTINED": return "red";
    case "WARNING": return "amber";
    default: return "gray";
  }
}

/* ──────────────────────── Main Component ──────────────── */
export default function NACPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Dashboard
  const [dashData, setDashData] = useState<DashboardData | null>(null);

  // Posture
  const [devices, setDevices] = useState<DevicePosture[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reassessing, setReassessing] = useState<string | null>(null);

  // Quarantine modal
  const [quarantineModal, setQuarantineModal] = useState<DevicePosture | null>(null);
  const [quarantineReason, setQuarantineReason] = useState("");
  const [quarantining, setQuarantining] = useState(false);

  // Segments
  const [segments, setSegments] = useState<Segment[]>([]);
  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [segForm, setSegForm] = useState({ name: "", vlanId: "", subnet: "", gateway: "", securityZone: "TRUSTED", description: "" });
  const [segCreating, setSegCreating] = useState(false);

  // VLAN Policies
  const [policies, setPolicies] = useState<VlanPolicy[]>([]);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [polForm, setPolForm] = useState({
    name: "", targetVlanId: "", vlanName: "", osFamily: "", minPostureScore: 70, deviceType: "", action: "ASSIGN" as "ASSIGN" | "QUARANTINE", priority: 100,
  });
  const [polCreating, setPolCreating] = useState(false);

  // RADIUS
  const [radConfig, setRadConfig] = useState<RadiusConfig>({ serverAddress: "", port: 1812, sharedSecret: "", authProtocol: "EAP-TLS", enabled: false, status: "disconnected" });
  const [showSecret, setShowSecret] = useState(false);
  const [radSaving, setRadSaving] = useState(false);

  /* ── Fetch helpers ── */
  const showBanner = useCallback((type: "success" | "error", msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 5000);
  }, []);

  const fetchDashboard = useCallback(async () => {
    try { const d = await apiFetch("/nac/dashboard"); setDashData(d); } catch { /* silent */ }
  }, []);

  const fetchPosture = useCallback(async () => {
    try { const d = await apiFetch("/nac/posture"); setDevices(Array.isArray(d) ? d : d.data || []); } catch { setDevices([]); }
  }, []);

  const fetchSegments = useCallback(async () => {
    try { const d = await apiFetch("/nac/segments"); setSegments(Array.isArray(d) ? d : d.data || []); } catch { setSegments([]); }
  }, []);

  const fetchPolicies = useCallback(async () => {
    try { const d = await apiFetch("/nac/vlan-policies"); setPolicies(Array.isArray(d) ? d : d.data || []); } catch { setPolicies([]); }
  }, []);

  const fetchRadius = useCallback(async () => {
    try { const d = await apiFetch("/nac/radius/config"); setRadConfig(d); } catch { /* use defaults */ }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchDashboard(), fetchPosture(), fetchSegments(), fetchPolicies(), fetchRadius()]);
    setLoading(false);
  }, [fetchDashboard, fetchPosture, fetchSegments, fetchPolicies, fetchRadius]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  /* ── Actions ── */
  async function reassessDevice(id: string) {
    setReassessing(id);
    try {
      await apiFetch(`/nac/posture/${id}/reassess`, { method: "POST" });
      showBanner("success", "Device reassessed successfully");
      fetchPosture(); fetchDashboard();
    } catch (e: any) { showBanner("error", e.message || "Reassessment failed"); }
    finally { setReassessing(null); }
  }

  async function quarantineDevice() {
    if (!quarantineModal) return;
    setQuarantining(true);
    try {
      await apiFetch(`/nac/posture/${quarantineModal.id}/quarantine`, {
        method: "POST", body: JSON.stringify({ reason: quarantineReason }),
      });
      showBanner("success", `${quarantineModal.hostname} quarantined`);
      setQuarantineModal(null); setQuarantineReason("");
      fetchPosture(); fetchDashboard();
    } catch (e: any) { showBanner("error", e.message || "Quarantine failed"); }
    finally { setQuarantining(false); }
  }

  async function createSegment() {
    setSegCreating(true);
    try {
      await apiFetch("/nac/segments", {
        method: "POST",
        body: JSON.stringify({ ...segForm, vlanId: parseInt(segForm.vlanId) || 0 }),
      });
      showBanner("success", "Network segment created");
      setShowSegmentForm(false);
      setSegForm({ name: "", vlanId: "", subnet: "", gateway: "", securityZone: "TRUSTED", description: "" });
      fetchSegments(); fetchDashboard();
    } catch (e: any) { showBanner("error", e.message || "Failed to create segment"); }
    finally { setSegCreating(false); }
  }

  async function createPolicy() {
    setPolCreating(true);
    try {
      await apiFetch("/nac/vlan-policies", {
        method: "POST",
        body: JSON.stringify({
          name: polForm.name, targetVlanId: parseInt(polForm.targetVlanId) || 0,
          vlanName: polForm.vlanName, action: polForm.action, priority: polForm.priority,
          conditions: {
            ...(polForm.osFamily ? { osFamily: polForm.osFamily } : {}),
            ...(polForm.minPostureScore ? { minPostureScore: polForm.minPostureScore } : {}),
            ...(polForm.deviceType ? { deviceType: polForm.deviceType } : {}),
          },
        }),
      });
      showBanner("success", "VLAN policy created");
      setShowPolicyForm(false);
      setPolForm({ name: "", targetVlanId: "", vlanName: "", osFamily: "", minPostureScore: 70, deviceType: "", action: "ASSIGN", priority: 100 });
      fetchPolicies();
    } catch (e: any) { showBanner("error", e.message || "Failed to create policy"); }
    finally { setPolCreating(false); }
  }

  async function deletePolicy(id: string) {
    if (!confirm("Delete this VLAN policy?")) return;
    try {
      await apiFetch(`/nac/vlan-policies/${id}`, { method: "DELETE" });
      showBanner("success", "Policy deleted");
      fetchPolicies();
    } catch (e: any) { showBanner("error", e.message || "Delete failed"); }
  }

  async function saveRadius() {
    setRadSaving(true);
    try {
      await apiFetch("/nac/radius/config", { method: "PUT", body: JSON.stringify(radConfig) });
      showBanner("success", "RADIUS configuration saved");
      fetchRadius();
    } catch (e: any) { showBanner("error", e.message || "Failed to save RADIUS config"); }
    finally { setRadSaving(false); }
  }

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* ──────────────────────── Render ──────────────────────── */
  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Shield size={24} style={{ color: "var(--brand-400)" }} />
            Network Access Control
          </h1>
          <p className="page-subtitle">
            Forescout-inspired NAC — Device posture, network segmentation &amp; 802.1X
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refreshAll}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div className="card" style={{
          marginBottom: 16, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
          border: `1px solid ${banner.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          background: banner.type === "success" ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
        }}>
          <span style={{ color: banner.type === "success" ? "#10b981" : "#ef4444", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {banner.type === "success" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {banner.msg}
          </span>
          <button onClick={() => setBanner(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 20, background: "var(--bg-card)",
        borderRadius: 10, padding: 4, border: "1px solid var(--border-primary)",
      }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 16px", border: "none", borderRadius: 8, cursor: "pointer",
              fontSize: 12, fontWeight: active ? 700 : 500, letterSpacing: "0.02em",
              transition: "all 0.2s ease",
              background: active ? "var(--brand-400)" : "transparent",
              color: active ? "#fff" : "var(--text-secondary)",
            }}>
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════ TAB 1: DASHBOARD ═══════════ */}
      {tab === "dashboard" && (
        <>
          {/* Big Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            <div className="stat-card">
              <div className="stat-icon cyan"><Monitor size={22} /></div>
              <div className="stat-content">
                <div className="stat-label">Total Devices</div>
                <div className="stat-value">{dashData?.totalDevices ?? 0}</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: "3px solid #10b981" }}>
              <div className="stat-icon green"><ShieldCheck size={22} /></div>
              <div className="stat-content">
                <div className="stat-label">Compliant</div>
                <div className="stat-value">{dashData?.compliant ?? 0}</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: "3px solid #ef4444" }}>
              <div className="stat-icon red"><ShieldX size={22} /></div>
              <div className="stat-content">
                <div className="stat-label">Non-Compliant</div>
                <div className="stat-value">{dashData?.nonCompliant ?? 0}</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: "3px solid #f59e0b" }}>
              <div className="stat-icon amber"><ShieldAlert size={22} /></div>
              <div className="stat-content">
                <div className="stat-label">Quarantined</div>
                <div className="stat-value">{dashData?.quarantined ?? 0}</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: "3px solid #06b6d4" }}>
              <div className="stat-icon blue"><Wifi size={22} /></div>
              <div className="stat-content">
                <div className="stat-label">Online</div>
                <div className="stat-value">{dashData?.online ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Compliance Breakdown + Device Types */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Compliance Visual */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header" style={{ padding: 0, marginBottom: 16 }}>
                <div className="card-title">Compliance Breakdown</div>
              </div>
              {(() => {
                const total = (dashData?.compliant ?? 0) + (dashData?.nonCompliant ?? 0) + (dashData?.quarantined ?? 0);
                if (total === 0) return (
                  <div style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)" }}>
                    <Shield size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                    <div style={{ fontSize: 13 }}>No compliance data yet</div>
                  </div>
                );
                const pctComp = Math.round(((dashData?.compliant ?? 0) / total) * 100);
                const pctNon = Math.round(((dashData?.nonCompliant ?? 0) / total) * 100);
                const pctQuar = 100 - pctComp - pctNon;
                return (
                  <>
                    {/* Ring Visual */}
                    <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 20 }}>
                      <div style={{ position: "relative", width: 120, height: 120 }}>
                        <svg viewBox="0 0 36 36" width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.5" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="3.5"
                            strokeDasharray={`${pctComp * 0.88} ${88 - pctComp * 0.88}`} strokeDashoffset="0" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#ef4444" strokeWidth="3.5"
                            strokeDasharray={`${pctNon * 0.88} ${88 - pctNon * 0.88}`} strokeDashoffset={`-${pctComp * 0.88}`} strokeLinecap="round" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="3.5"
                            strokeDasharray={`${pctQuar * 0.88} ${88 - pctQuar * 0.88}`} strokeDashoffset={`-${(pctComp + pctNon) * 0.88}`} strokeLinecap="round" />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{dashData?.complianceRate ?? pctComp}%</span>
                          <span style={{ fontSize: 9, color: "var(--text-tertiary)", letterSpacing: "0.05em" }}>COMPLIANT</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                        <ComplianceBar label="Compliant" count={dashData?.compliant ?? 0} pct={pctComp} color="#10b981" />
                        <ComplianceBar label="Non-Compliant" count={dashData?.nonCompliant ?? 0} pct={pctNon} color="#ef4444" />
                        <ComplianceBar label="Quarantined" count={dashData?.quarantined ?? 0} pct={pctQuar} color="#f59e0b" />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Device Types */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header" style={{ padding: 0, marginBottom: 16 }}>
                <div className="card-title">Device Types</div>
              </div>
              {(!dashData?.deviceTypes || Object.keys(dashData.deviceTypes).length === 0) ? (
                <div style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)" }}>
                  <Monitor size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>No device type data</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(dashData.deviceTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                    const total = Object.values(dashData.deviceTypes).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={type} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6" }}>
                          {DEVICE_TYPE_ICONS[type.toLowerCase()] || <Monitor size={14} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{type}</span>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{count} ({pct}%)</span>
                          </div>
                          <div style={{ width: "100%", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
                            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #8b5cf6, #a78bfa)", transition: "width 0.5s ease" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RADIUS Status + Quick Actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header" style={{ padding: 0, marginBottom: 16 }}>
                <div className="card-title">RADIUS Server Status</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: dashData?.radiusStatus === "connected" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: dashData?.radiusStatus === "connected" ? "#10b981" : "#ef4444",
                }}>
                  <Radio size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                    {dashData?.radiusStatus === "connected" ? "Connected" : "Disconnected"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    802.1X Authentication Server
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <span className={`badge ${dashData?.radiusStatus === "connected" ? "green" : "red"}`} style={{ fontSize: 10 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: dashData?.radiusStatus === "connected" ? "#10b981" : "#ef4444", marginRight: 4 }} />
                    {dashData?.radiusStatus?.toUpperCase() || "UNKNOWN"}
                  </span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div className="card-header" style={{ padding: 0, marginBottom: 16 }}>
                <div className="card-title">Quick Actions</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setTab("posture")} style={{ flex: 1, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 12px" }}>
                  <ShieldCheck size={14} /> View Posture
                </button>
                <button className="btn btn-secondary" onClick={() => setTab("segments")} style={{ flex: 1, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 12px" }}>
                  <Network size={14} /> Manage Segments
                </button>
                <button className="btn btn-primary" onClick={() => setTab("radius")} style={{ flex: 1, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 12px" }}>
                  <Radio size={14} /> RADIUS Config
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ TAB 2: DEVICE POSTURE ═══════════ */}
      {tab === "posture" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "14px 20px" }}>
            <div>
              <div className="card-title">Device Posture Assessment</div>
              <div className="card-subtitle">{devices.length} device{devices.length !== 1 ? "s" : ""} assessed</div>
            </div>
            <button className="btn btn-secondary" onClick={fetchPosture} style={{ fontSize: 11 }}>
              <RefreshCw size={12} /> Reassess All
            </button>
          </div>

          {devices.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <ShieldCheck size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>No Devices Assessed</div>
              <div style={{ fontSize: 12 }}>Devices will appear here once NAC posture assessment is configured.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Hostname</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Posture Score</th>
                  <th>Level</th>
                  <th>Recommended VLAN</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(d => (
                  <Fragment key={d.id}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                      <td style={{ color: "var(--text-tertiary)" }}>
                        {expandedId === d.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                        {DEVICE_TYPE_ICONS[d.deviceType?.toLowerCase()] || <Monitor size={14} />}
                        {d.hostname}
                      </td>
                      <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{d.ip}</code></td>
                      <td>
                        <span className={`badge ${d.status === "online" ? "green" : "red"}`} style={{ fontSize: 10 }}>
                          {d.status === "online" ? <Wifi size={9} style={{ marginRight: 3 }} /> : <WifiOff size={9} style={{ marginRight: 3 }} />}
                          {d.status?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                            <div style={{
                              width: `${d.postureScore}%`, height: "100%", borderRadius: 3,
                              background: scoreColor(d.postureScore),
                              transition: "width 0.3s ease",
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(d.postureScore) }}>{d.postureScore}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${levelBadge(d.level)}`} style={{ fontSize: 10 }}>{d.level?.replace("_", " ")}</span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>VLAN {typeof d.recommendedVlan === 'object' && d.recommendedVlan ? (d.recommendedVlan as any).vlanId ?? JSON.stringify(d.recommendedVlan) : d.recommendedVlan}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                            onClick={() => reassessDevice(d.id)} disabled={reassessing === d.id}>
                            {reassessing === d.id ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Scan size={10} />}
                            {" "}Reassess
                          </button>
                          {(d.level === "NON_COMPLIANT" || d.level === "NON-COMPLIANT") && (
                            <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, color: "#ef4444" }}
                              onClick={() => { setQuarantineModal(d); setQuarantineReason(""); }}>
                              <ShieldX size={10} /> Quarantine
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Posture Checks */}
                    {expandedId === d.id && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0, background: "rgba(0,0,0,0.15)" }}>
                          <div style={{ padding: "16px 24px 16px 48px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, letterSpacing: "0.05em" }}>
                              POSTURE CHECKS
                            </div>
                            {(!d.checks || d.checks.length === 0) ? (
                              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No posture checks recorded.</div>
                            ) : (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                {d.checks.map((c, i) => (
                                  <div key={i} style={{
                                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                                    borderRadius: 8, border: `1px solid ${c.passed ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                                    background: c.passed ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
                                  }}>
                                    {c.passed
                                      ? <CheckCircle2 size={16} style={{ color: "#10b981", flexShrink: 0 }} />
                                      : <XCircle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />}
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</div>
                                      {c.detail && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{c.detail}</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-tertiary)" }}>
                              OS: {d.osFamily || "—"} • MAC: {d.mac || "—"} • Last Assessed: {d.lastAssessed ? new Date(d.lastAssessed).toLocaleString() : "—"}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══════════ TAB 3: NETWORK SEGMENTS ═══════════ */}
      {tab === "segments" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Network Segments</h2>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>{segments.length} segment{segments.length !== 1 ? "s" : ""} configured</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowSegmentForm(true)} style={{ fontSize: 12 }}>
              <Plus size={14} /> Create Segment
            </button>
          </div>

          {segments.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Network size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>No Network Segments</div>
              <div style={{ fontSize: 12, marginBottom: 16 }}>Create your first network segment to begin zone-based access control.</div>
              <button className="btn btn-primary" onClick={() => setShowSegmentForm(true)} style={{ fontSize: 12 }}>
                <Plus size={14} /> Create Segment
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
              {segments.map(s => {
                const zone = ZONE_COLORS[s.securityZone] || ZONE_COLORS.TRUSTED;
                return (
                  <div className="card" key={s.id} style={{
                    padding: 0, overflow: "hidden",
                    borderTop: `3px solid ${zone.border}`,
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${zone.bg}`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                  >
                    <div style={{ padding: "16px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{s.name}</h3>
                        <span className={`badge ${zone.badge}`} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
                          {s.securityZone}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 12 }}>
                        <InfoRow label="VLAN ID" value={s.vlanId} />
                        <InfoRow label="Subnet" value={s.subnet} />
                        <InfoRow label="Gateway" value={s.gateway || "—"} />
                        <InfoRow label="Devices" value={s.deviceCount ?? 0} />
                      </div>
                      {s.description && (
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "10px 0 0", lineHeight: 1.5 }}>{s.description}</p>
                      )}
                    </div>
                    {/* Zone strip */}
                    <div style={{ height: 3, background: `linear-gradient(90deg, ${zone.border}, transparent)` }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Segment Modal */}
          {showSegmentForm && (
            <>
              <div onClick={() => setShowSegmentForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
              <div style={{
                position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                width: "min(520px, 90vw)", background: "var(--bg-card)", borderRadius: 14,
                border: "1px solid var(--border-primary)", zIndex: 1001, padding: 24,
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Create Network Segment</h3>
                  <button onClick={() => setShowSegmentForm(false)} className="btn btn-secondary" style={{ padding: "4px 8px" }}><X size={14} /></button>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <FormField label="Segment Name" value={segForm.name} onChange={v => setSegForm({ ...segForm, name: v })} placeholder="e.g. Corporate LAN" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <FormField label="VLAN ID" value={segForm.vlanId} onChange={v => setSegForm({ ...segForm, vlanId: v })} placeholder="100" type="number" />
                    <FormField label="Subnet" value={segForm.subnet} onChange={v => setSegForm({ ...segForm, subnet: v })} placeholder="10.0.1.0/24" />
                  </div>
                  <FormField label="Gateway" value={segForm.gateway} onChange={v => setSegForm({ ...segForm, gateway: v })} placeholder="10.0.1.1" />
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Security Zone</label>
                    <select value={segForm.securityZone} onChange={e => setSegForm({ ...segForm, securityZone: e.target.value })}
                      style={selectStyle}>
                      <option value="TRUSTED">TRUSTED</option>
                      <option value="UNTRUSTED">UNTRUSTED</option>
                      <option value="RESTRICTED">RESTRICTED</option>
                      <option value="QUARANTINE">QUARANTINE</option>
                      <option value="DMZ">DMZ</option>
                    </select>
                  </div>
                  <FormField label="Description" value={segForm.description} onChange={v => setSegForm({ ...segForm, description: v })} placeholder="Optional description..." />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                  <button className="btn btn-secondary" onClick={() => setShowSegmentForm(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={createSegment} disabled={segCreating || !segForm.name || !segForm.vlanId}>
                    {segCreating ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Creating...</> : <><Plus size={14} /> Create Segment</>}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════ TAB 4: VLAN POLICIES ═══════════ */}
      {tab === "policies" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>VLAN Assignment Policies</h2>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>Rules for automatic VLAN placement based on device posture</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowPolicyForm(true)} style={{ fontSize: 12 }}>
              <Plus size={14} /> Create Policy
            </button>
          </div>

          {policies.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <ArrowRightLeft size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>No VLAN Policies</div>
              <div style={{ fontSize: 12, marginBottom: 16 }}>Create policies to automate VLAN assignment based on device compliance.</div>
              <button className="btn btn-primary" onClick={() => setShowPolicyForm(true)} style={{ fontSize: 12 }}>
                <Plus size={14} /> Create Policy
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Policy Name</th>
                    <th>Target VLAN</th>
                    <th>Conditions</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {[...policies].sort((a, b) => a.priority - b.priority).map(p => (
                    <tr key={p.id}>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 28, height: 28, borderRadius: 8, fontSize: 11, fontWeight: 700,
                          background: "rgba(139,92,246,0.1)", color: "#8b5cf6",
                        }}>{p.priority}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</td>
                      <td>
                        <span style={{ fontSize: 12, color: "var(--brand-400)" }}>VLAN {p.targetVlanId}</span>
                        {p.vlanName && <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: 6 }}>({p.vlanName})</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {p.conditions?.osFamily && <span className="badge gray" style={{ fontSize: 9 }}>OS: {p.conditions.osFamily}</span>}
                          {p.conditions?.minPostureScore != null && <span className="badge gray" style={{ fontSize: 9 }}>Score ≥ {p.conditions.minPostureScore}</span>}
                          {p.conditions?.deviceType && <span className="badge gray" style={{ fontSize: 9 }}>Type: {p.conditions.deviceType}</span>}
                          {!p.conditions?.osFamily && !p.conditions?.minPostureScore && !p.conditions?.deviceType && (
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Any device</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${p.action === "ASSIGN" ? "green" : "red"}`} style={{ fontSize: 10 }}>
                          {p.action === "ASSIGN" ? <><ArrowRightLeft size={9} style={{ marginRight: 3 }} />ASSIGN</> : <><ShieldX size={9} style={{ marginRight: 3 }} />QUARANTINE</>}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.enabled !== false ? "green" : "gray"}`} style={{ fontSize: 9 }}>
                          {p.enabled !== false ? "ACTIVE" : "DISABLED"}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: "3px 6px", color: "#ef4444" }} onClick={() => deletePolicy(p.id)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Create Policy Modal */}
          {showPolicyForm && (
            <>
              <div onClick={() => setShowPolicyForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
              <div style={{
                position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                width: "min(560px, 90vw)", background: "var(--bg-card)", borderRadius: 14,
                border: "1px solid var(--border-primary)", zIndex: 1001, padding: 24,
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Create VLAN Policy</h3>
                  <button onClick={() => setShowPolicyForm(false)} className="btn btn-secondary" style={{ padding: "4px 8px" }}><X size={14} /></button>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <FormField label="Policy Name" value={polForm.name} onChange={v => setPolForm({ ...polForm, name: v })} placeholder="e.g. Compliant Workstations" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <FormField label="Target VLAN ID" value={polForm.targetVlanId} onChange={v => setPolForm({ ...polForm, targetVlanId: v })} placeholder="100" type="number" />
                    <FormField label="VLAN Name" value={polForm.vlanName} onChange={v => setPolForm({ ...polForm, vlanName: v })} placeholder="Corporate" />
                  </div>

                  <div style={{ border: "1px solid var(--border-secondary)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, letterSpacing: "0.05em" }}>CONDITIONS</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>OS Family</label>
                        <select value={polForm.osFamily} onChange={e => setPolForm({ ...polForm, osFamily: e.target.value })} style={selectStyle}>
                          <option value="">Any</option>
                          <option value="Windows">Windows</option>
                          <option value="macOS">macOS</option>
                          <option value="Linux">Linux</option>
                          <option value="iOS">iOS</option>
                          <option value="Android">Android</option>
                          <option value="ChromeOS">ChromeOS</option>
                        </select>
                      </div>
                      <FormField label="Device Type" value={polForm.deviceType} onChange={v => setPolForm({ ...polForm, deviceType: v })} placeholder="e.g. laptop" />
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>
                        Min Posture Score: <span style={{ color: scoreColor(polForm.minPostureScore), fontWeight: 700 }}>{polForm.minPostureScore}</span>
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>0</span>
                        <input type="range" min={0} max={100} value={polForm.minPostureScore}
                          onChange={e => setPolForm({ ...polForm, minPostureScore: parseInt(e.target.value) })}
                          style={{ flex: 1, accentColor: "var(--brand-400)" }} />
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>100</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Action</label>
                      <select value={polForm.action} onChange={e => setPolForm({ ...polForm, action: e.target.value as "ASSIGN" | "QUARANTINE" })} style={selectStyle}>
                        <option value="ASSIGN">ASSIGN — Place in VLAN</option>
                        <option value="QUARANTINE">QUARANTINE — Isolate device</option>
                      </select>
                    </div>
                    <FormField label="Priority" value={String(polForm.priority)} onChange={v => setPolForm({ ...polForm, priority: parseInt(v) || 0 })} placeholder="100" type="number" />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                  <button className="btn btn-secondary" onClick={() => setShowPolicyForm(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={createPolicy} disabled={polCreating || !polForm.name || !polForm.targetVlanId}>
                    {polCreating ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Creating...</> : <><Plus size={14} /> Create Policy</>}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════ TAB 5: RADIUS / 802.1X ═══════════ */}
      {tab === "radius" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* RADIUS Config Form */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header" style={{ padding: 0, marginBottom: 16 }}>
                <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Radio size={16} style={{ color: "var(--brand-400)" }} />
                  RADIUS Server Configuration
                </div>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <FormField label="Server Address" value={radConfig.serverAddress} onChange={v => setRadConfig({ ...radConfig, serverAddress: v })} placeholder="radius.example.com" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <FormField label="Port" value={String(radConfig.port)} onChange={v => setRadConfig({ ...radConfig, port: parseInt(v) || 1812 })} placeholder="1812" type="number" />
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Auth Protocol</label>
                    <select value={radConfig.authProtocol} onChange={e => setRadConfig({ ...radConfig, authProtocol: e.target.value })} style={selectStyle}>
                      <option value="EAP-TLS">EAP-TLS</option>
                      <option value="PEAP">PEAP</option>
                      <option value="EAP-TTLS">EAP-TTLS</option>
                      <option value="EAP-FAST">EAP-FAST</option>
                    </select>
                  </div>
                </div>
                {/* Shared Secret with show/hide */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Shared Secret</label>
                  <div style={{ position: "relative" }}>
                    <input type={showSecret ? "text" : "password"} value={radConfig.sharedSecret}
                      onChange={e => setRadConfig({ ...radConfig, sharedSecret: e.target.value })}
                      placeholder="Enter shared secret"
                      style={{ ...inputStyle, paddingRight: 36 }} />
                    <button onClick={() => setShowSecret(!showSecret)} style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2,
                    }}>
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                {/* Enable/Disable Toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border-secondary)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Enable RADIUS Authentication</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Enforce 802.1X port-based access control</div>
                  </div>
                  <button onClick={() => setRadConfig({ ...radConfig, enabled: !radConfig.enabled })}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                      background: radConfig.enabled ? "#10b981" : "rgba(255,255,255,0.1)",
                      position: "relative", transition: "background 0.2s ease",
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: radConfig.enabled ? 23 : 3,
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }} />
                  </button>
                </div>
                <button className="btn btn-primary" onClick={saveRadius} disabled={radSaving} style={{ justifySelf: "flex-start", marginTop: 4 }}>
                  {radSaving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving...</> : <><Save size={14} /> Save Configuration</>}
                </button>
              </div>
            </div>

            {/* RADIUS Status */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <div className="card-header" style={{ padding: 0, marginBottom: 14 }}>
                  <div className="card-title">Connection Status</div>
                </div>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                  padding: 24, borderRadius: 12,
                  background: radConfig.status === "connected"
                    ? "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))"
                    : "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))",
                  border: `1px solid ${radConfig.status === "connected" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: radConfig.status === "connected" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
                    animation: radConfig.status === "connected" ? "pulse 2s ease-in-out infinite" : "none",
                  }}>
                    {radConfig.status === "connected"
                      ? <CheckCircle2 size={26} style={{ color: "#10b981" }} />
                      : <XCircle size={26} style={{ color: "#ef4444" }} />}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                    {radConfig.status === "connected" ? "Connected" : "Disconnected"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {radConfig.serverAddress ? `${radConfig.serverAddress}:${radConfig.port}` : "No server configured"}
                  </div>
                  {radConfig.lastSync && (
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6 }}>
                      Last sync: {new Date(radConfig.lastSync).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* 802.1X Info Cards */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-header" style={{ padding: 0, marginBottom: 14 }}>
                  <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Info size={14} style={{ color: "var(--brand-400)" }} />
                    802.1X Workflow
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <WorkflowStep num={1} title="Supplicant Connects" desc="Device connects to switch port and sends EAPOL-Start" color="#06b6d4" />
                  <WorkflowStep num={2} title="Authenticator Proxies" desc="Switch forwards EAP request to RADIUS server" color="#8b5cf6" />
                  <WorkflowStep num={3} title="RADIUS Validates" desc="Server verifies credentials and checks posture policy" color="#f59e0b" />
                  <WorkflowStep num={4} title="VLAN Assignment" desc="Device placed into appropriate VLAN based on compliance" color="#10b981" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ QUARANTINE MODAL ═══════════ */}
      {quarantineModal && (
        <>
          <div onClick={() => setQuarantineModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(440px, 90vw)", background: "var(--bg-card)", borderRadius: 14,
            border: "1px solid rgba(239,68,68,0.3)", zIndex: 1001, padding: 24,
            boxShadow: "0 20px 60px rgba(239,68,68,0.1)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldAlert size={20} style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Quarantine Device</h3>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                  {quarantineModal.hostname} ({quarantineModal.ip})
                </p>
              </div>
            </div>
            <div style={{
              padding: 12, borderRadius: 8, marginBottom: 14,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
              fontSize: 12, color: "#fca5a5", lineHeight: 1.6,
            }}>
              <AlertTriangle size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
              This will move the device to the quarantine VLAN, restricting all network access. The device must pass a reassessment to regain access.
            </div>
            <FormField label="Reason for Quarantine" value={quarantineReason} onChange={setQuarantineReason} placeholder="e.g. Failed compliance check, potential threat detected..." />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setQuarantineModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "#ef4444", borderColor: "#ef4444" }}
                onClick={quarantineDevice} disabled={quarantining || !quarantineReason.trim()}>
                {quarantining ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Quarantining...</> : <><ShieldX size={14} /> Confirm Quarantine</>}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </>
  );
}

/* ──────────────────────── Sub-Components ──────────────── */

/** Compliance breakdown bar for dashboard */
function ComplianceBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{count} ({pct}%)</span>
      </div>
      <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

/** Info row for segment cards */
function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{String(value)}</div>
    </div>
  );
}

/** 802.1X workflow step */
function WorkflowStep({ num, title, desc, color }: { num: number; title: string; desc: string; color: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: `${color}18`, color, fontSize: 12, fontWeight: 800,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{num}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.4 }}>{desc}</div>
      </div>
    </div>
  );
}

/** Reusable form field */
function FormField({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

/* ──────────────────────── Shared Styles ──────────────── */
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border-primary)", background: "var(--bg-primary)",
  color: "var(--text-primary)", fontSize: 13, outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border-primary)", background: "var(--bg-primary)",
  color: "var(--text-primary)", fontSize: 13, outline: "none",
  boxSizing: "border-box", cursor: "pointer",
};
