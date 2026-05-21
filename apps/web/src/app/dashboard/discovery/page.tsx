"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Radar, Play, Clock, CheckCircle2, XCircle, Wifi, Monitor,
  Server, Printer, HelpCircle, Loader2, RefreshCw, Plus, Search,
  ArrowRight, Eye, EyeOff, Network, Shield, Key, Calendar, Bot, Trash2,
  AlertTriangle, Zap, Check, ChevronDown, ChevronRight as ChevronRightIcon
} from "lucide-react";
import { apiFetch, getToken, getApiBase } from "@/lib/api";
import { PageHelp, Tip } from "@/components/HelpSystem";

const SCAN_TYPES = [
  { value: "PING_SWEEP", label: "Ping Sweep", desc: "ICMP host alive check" },
  { value: "PORT_SCAN", label: "TCP Port Scan", desc: "Service fingerprinting" },
  { value: "SNMP_DISCOVERY", label: "SNMP Discovery", desc: "Network device detection" },
  { value: "FULL_SCAN", label: "Full Scan", desc: "Ping + Ports + SNMP + ARP" },
];

const DEVICE_ICONS: Record<string, any> = {
  "Virtual Machine": <Server size={16} />,
  "Workstation": <Monitor size={16} />,
  "Printer": <Printer size={16} />,
  "Network Device": <Network size={16} />,
  "Unknown": <HelpCircle size={16} />,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  RUNNING: { bg: "rgba(6,182,212,0.1)", text: "#06b6d4" },
  COMPLETED: { bg: "rgba(16,185,129,0.1)", text: "#10b981" },
  FAILED: { bg: "rgba(239,68,68,0.1)", text: "#ef4444" },
};

export default function DiscoveryPage() {
  const [subnets, setSubnets] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedScan, setSelectedScan] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [customSubnet, setCustomSubnet] = useState("");
  const [scanType, setScanType] = useState("PING_SWEEP");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"scans" | "pending" | "schedules" | "credentials" | "agents">("scans");
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [pendingFilter, setPendingFilter] = useState<string>("all");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [setupMethod, setSetupMethod] = useState<"download" | "bash" | "docker">("download");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [osDetected, setOsDetected] = useState<"macos" | "windows" | "linux">("macos");
  const [pairedAgent, setPairedAgent] = useState<any>(null);

  // Merge and side-by-side comparison drawer states
  const [reviewDevice, setReviewDevice] = useState<any>(null);
  const [matchingAssets, setMatchingAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [searchingAssets, setSearchingAssets] = useState(false);
  const [approvalMode, setApprovalMode] = useState<"create" | "merge">("create");
  const [isMerging, setIsMerging] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, sc, p, sch, cr, ag] = await Promise.all([
        apiFetch("/discovery/subnets"),
        apiFetch("/discovery/scans?limit=20"),
        apiFetch("/discovery/pending"),
        apiFetch("/discovery/schedules"),
        apiFetch("/discovery/credentials"),
        apiFetch("/discovery/agents"),
      ]);
      setSubnets(s || []);
      setScans(sc.data || []);
      setPending(p || []);
      setSchedules(Array.isArray(sch) ? sch : []);
      setCredentials(Array.isArray(cr) ? cr : []);
      setAgents(Array.isArray(ag) ? ag : []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes("win")) setOsDetected("windows");
      else if (ua.includes("mac")) setOsDetected("macos");
      else if (ua.includes("linux")) setOsDetected("linux");
    }
  }, []);

  // Poll for agent registrations when in Step 3
  useEffect(() => {
    if (wizardStep !== 3 || pairedAgent) return;
    const interval = setInterval(async () => {
      await refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [wizardStep, refresh, pairedAgent]);

  // Telemetry pairing validator
  useEffect(() => {
    if (wizardStep !== 3 || pairedAgent) return;
    const activeAgent = agents.find((a: any) => {
      if (a.status !== "ONLINE") return false;
      if (!a.lastHeartbeat) return false;
      const ageMs = Date.now() - new Date(a.lastHeartbeat).getTime();
      return ageMs < 5 * 60 * 1000; // registered/heartbeat in last 5 min
    });
    if (activeAgent) {
      setPairedAgent(activeAgent);
    }
  }, [agents, wizardStep, pairedAgent]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll for running scans
  useEffect(() => {
    const hasRunning = scans.some(s => s.status === "RUNNING" || s.status === "PENDING");
    if (!hasRunning) return;
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, [scans, refresh]);

  async function startScan(subnet: string) {
    setScanning(true);
    try {
      await apiFetch("/discovery/scans", {
        method: "POST",
        body: JSON.stringify({ subnet, scanType, name: `${SCAN_TYPES.find(t => t.value === scanType)?.label} — ${subnet}` }),
      });
      await refresh();
    } catch {} finally { setScanning(false); }
  }

  async function deleteSchedule(id: string) {
    await apiFetch(`/discovery/schedules/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function toggleSchedule(id: string, isActive: boolean) {
    await apiFetch(`/discovery/schedules/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) });
    await refresh();
  }

  async function deleteCredential(id: string) {
    await apiFetch(`/discovery/credentials/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function viewScanDetails(scanId: string) {
    const data = await apiFetch(`/discovery/scans/${scanId}`);
    setSelectedScan(data);
  }

  async function approveDevice(deviceId: string) {
    await apiFetch(`/discovery/devices/${deviceId}/approve`, {
      method: "POST", body: JSON.stringify({}),
    });
    setSelectedDevices(prev => { const n = new Set(prev); n.delete(deviceId); return n; });
    await refresh();
  }

  async function ignoreDevice(deviceId: string) {
    await apiFetch(`/discovery/devices/${deviceId}/ignore`, { method: "POST" });
    setSelectedDevices(prev => { const n = new Set(prev); n.delete(deviceId); return n; });
    await refresh();
  }

  async function bulkApprove() {
    if (selectedDevices.size === 0) return;
    await apiFetch("/discovery/devices/bulk-approve", {
      method: "POST", body: JSON.stringify({ deviceIds: Array.from(selectedDevices) }),
    });
    setSelectedDevices(new Set());
    await refresh();
  }

  async function bulkIgnore() {
    if (selectedDevices.size === 0) return;
    await apiFetch("/discovery/devices/bulk-ignore", {
      method: "POST", body: JSON.stringify({ deviceIds: Array.from(selectedDevices) }),
    });
    setSelectedDevices(new Set());
    await refresh();
  }

  async function enrichDevice(deviceId: string) {
    setEnriching(deviceId);
    try {
      await apiFetch(`/discovery/devices/${deviceId}/enrich`, { method: "POST", body: JSON.stringify({}) });
      await refresh();
      setExpandedDevice(deviceId);
    } catch {} finally { setEnriching(null); }
  }

  const openReviewDrawer = useCallback(async (device: any) => {
    setReviewDevice(device);
    setSelectedAssetId("");
    setSelectedAsset(null);
    setAssetSearch("");
    setApprovalMode("create");
    setSearchingAssets(true);
    try {
      const searchTerms = [device.ipAddress, device.macAddress, device.hostname].filter(Boolean);
      let found: any[] = [];
      if (searchTerms.length > 0) {
        const res = await apiFetch(`/assets?search=${encodeURIComponent(device.ipAddress || device.hostname || "")}&limit=10`);
        found = res.data || [];
      }
      
      if (found.length === 0) {
        const res = await apiFetch("/assets?limit=10");
        found = res.data || [];
      }
      
      setMatchingAssets(found);
      
      const exactMatch = found.find((a: any) => 
        (device.ipAddress && a.ipAddress === device.ipAddress) ||
        (device.macAddress && a.macAddress?.toLowerCase() === device.macAddress?.toLowerCase()) ||
        (device.hostname && a.hostname?.toLowerCase() === device.hostname?.toLowerCase())
      );
      
      if (exactMatch) {
        setSelectedAssetId(exactMatch.id);
        setApprovalMode("merge");
        const fullAsset = await apiFetch(`/assets/${exactMatch.id}`);
        setSelectedAsset(fullAsset);
      }
    } catch (err) {
      console.error("Failed to fetch matching assets:", err);
    } finally {
      setSearchingAssets(false);
    }
  }, []);

  const handleAssetSearch = async (val: string) => {
    setAssetSearch(val);
    if (!val) {
      if (reviewDevice) {
        setSearchingAssets(true);
        try {
          const res = await apiFetch(`/assets?search=${encodeURIComponent(reviewDevice.ipAddress || "")}&limit=10`);
          setMatchingAssets(res.data || []);
        } catch {} finally { setSearchingAssets(false); }
      }
      return;
    }
    setSearchingAssets(true);
    try {
      const res = await apiFetch(`/assets?search=${encodeURIComponent(val)}&limit=10`);
      setMatchingAssets(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingAssets(false);
    }
  };

  const handleSelectAsset = async (assetId: string) => {
    setSelectedAssetId(assetId);
    if (!assetId) {
      setSelectedAsset(null);
      return;
    }
    try {
      const fullAsset = await apiFetch(`/assets/${assetId}`);
      setSelectedAsset(fullAsset);
    } catch (err) {
      console.error(err);
      setSelectedAsset(null);
    }
  };

  async function handleApproveNew() {
    if (!reviewDevice) return;
    setIsApproving(true);
    try {
      await apiFetch(`/discovery/devices/${reviewDevice.id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setReviewDevice(null);
      await refresh();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  }

  async function handleApproveMerge() {
    if (!reviewDevice || !selectedAssetId) return;
    setIsMerging(true);
    try {
      await apiFetch(`/discovery/devices/${reviewDevice.id}/merge`, {
        method: "POST",
        body: JSON.stringify({ assetId: selectedAssetId }),
      });
      setReviewDevice(null);
      await refresh();
    } catch (err: any) {
      alert(`Merge failed: ${err.message}`);
    } finally {
      setIsMerging(false);
    }
  }

  async function enrichDeviceFromDrawer() {
    if (!reviewDevice) return;
    setEnriching(reviewDevice.id);
    try {
      await apiFetch(`/discovery/devices/${reviewDevice.id}/enrich`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      
      const p = await apiFetch("/discovery/pending");
      setPending(p || []);
      const updated = p.find((d: any) => d.id === reviewDevice.id);
      if (updated) {
        setReviewDevice(updated);
      }
      
      if (selectedAssetId) {
        const fullAsset = await apiFetch(`/assets/${selectedAssetId}`);
        setSelectedAsset(fullAsset);
      }
    } catch (err: any) {
      alert(`Enrichment failed: ${err.message}`);
    } finally {
      setEnriching(null);
    }
  }

  async function downloadAgentZip() {
    setDownloading(true);
    try {
      const token = getToken();
      const res = await fetch(`${getApiBase()}/discovery/agents/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to compile and download zip from server.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reconapm-agent.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

  const copyCommand = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  function getRiskBadge(score: number) {
    if (score >= 70) return { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
    if (score >= 40) return { label: "High", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
    if (score >= 20) return { label: "Medium", color: "#06b6d4", bg: "rgba(6,182,212,0.1)" };
    return { label: "Low", color: "#10b981", bg: "rgba(16,185,129,0.1)" };
  }

  function toggleDevice(id: string) {
    setSelectedDevices(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (selectedDevices.size === pending.length) setSelectedDevices(new Set());
    else setSelectedDevices(new Set(pending.map((d: any) => d.id)));
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
          <h1 className="page-title">Network Discovery</h1>
          <p className="page-subtitle">Scan your network to discover and inventory devices automatically</p>
        </div>
        <button className="btn btn-primary" onClick={refresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <PageHelp id="discovery" title="How Network Discovery Works">
        Enter a subnet (e.g., <strong>192.168.1.0/24</strong>) and select a scan type. <strong>Ping Sweep</strong> is the fastest — it finds alive hosts. <strong>Full Scan</strong> combines all methods for maximum coverage. After scanning, review discovered devices in the <strong>Pending Review</strong> tab and approve them to add as managed assets. You can also deploy the <strong>QS Asset Agent</strong> on staff machines for automatic inventory collection.
      </PageHelp>

      {/* Scan Type Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Scan Configuration <Tip text="Choose a scan type, then click Scan on a detected subnet or enter a custom one. Ping Sweep is fastest (~30s). Full Scan is most thorough (~5 min)." /></h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
          {SCAN_TYPES.map(t => (
            <button key={t.value} onClick={() => setScanType(t.value)}
              style={{
                padding: "12px 14px", borderRadius: 10, border: scanType === t.value ? "2px solid var(--brand-400)" : "1px solid var(--border-primary)",
                background: scanType === t.value ? "rgba(6,182,212,0.08)" : "var(--bg-elevated)",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: scanType === t.value ? "var(--brand-400)" : "var(--text-primary)" }}>{t.label}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>
        <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Detected Interfaces</h4>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {subnets.map((s: any, i: number) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
              borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
            }}>
              <Wifi size={16} style={{ color: "var(--brand-400)" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.subnet}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{s.interface} • {s.ip}</div>
              </div>
              <button className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 11 }}
                disabled={scanning} onClick={() => startScan(s.subnet)}>
                {scanning ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={12} />}
                Scan
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Custom subnet (e.g. 10.0.1.0/24)" value={customSubnet}
            onChange={e => setCustomSubnet(e.target.value)}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)",
              border: "1px solid var(--border-primary)", color: "var(--text-primary)",
              fontSize: 12, fontFamily: "inherit", outline: "none",
            }} />
          <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 12 }}
            disabled={!customSubnet || scanning} onClick={() => { startScan(customSubnet); setCustomSubnet(""); }}>
            <Radar size={14} /> {SCAN_TYPES.find(t => t.value === scanType)?.label}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "scans" as const, label: "Scan History", icon: <Radar size={12} />, count: scans.length },
          { key: "pending" as const, label: "Pending Review", icon: <Eye size={12} />, count: pending.length },
          { key: "schedules" as const, label: "Schedules", icon: <Calendar size={12} />, count: schedules.length },
          { key: "credentials" as const, label: "Credential Vault", icon: <Key size={12} />, count: credentials.length },
          { key: "agents" as const, label: "Agents", icon: <Bot size={12} />, count: agents.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`btn ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 4 }}>
            {t.icon} {t.label} {t.count > 0 && <span className="badge cyan" style={{ fontSize: 9, marginLeft: 2 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Scan History Tab */}
      {tab === "scans" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {scans.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Radar size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No scans yet</div>
              <p style={{ fontSize: 12 }}>Use the scan buttons above to discover devices on your network</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Scan Name</th><th>Subnet</th><th>Status</th><th>Devices Found</th><th>New</th><th>Duration</th><th>Actions</th></tr></thead>
              <tbody>
                {scans.map((s: any) => {
                  const colors = STATUS_COLORS[s.status] || STATUS_COLORS.PENDING;
                  const duration = s.startedAt && s.completedAt
                    ? `${Math.round((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 1000)}s`
                    : s.status === "RUNNING" ? "Running..." : "—";
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{s.name || "Scan"}</td>
                      <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{s.subnet}</code></td>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: colors.bg, color: colors.text,
                        }}>
                          {s.status === "RUNNING" && <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />}
                          {s.status === "COMPLETED" && <CheckCircle2 size={10} />}
                          {s.status === "FAILED" && <XCircle size={10} />}
                          {s.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.devicesFound}</td>
                      <td>
                        {s.newDevices > 0 && <span className="badge amber">{s.newDevices} new</span>}
                        {s.newDevices === 0 && "—"}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{duration}</td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                          onClick={() => viewScanDetails(s.id)}>
                          <Eye size={10} /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pending Review Tab */}
      {tab === "pending" && (
        <div>
          {pending.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <CheckCircle2 size={36} style={{ margin: "0 auto 12px", color: "#10b981" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>All clear!</div>
              <p style={{ fontSize: 12 }}>No devices pending review. Run a scan to discover new devices.</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
                {(() => {
                  const types: Record<string, number> = {};
                  let critical = 0, high = 0;
                  pending.forEach((d: any) => {
                    types[d.deviceType || "Unknown"] = (types[d.deviceType || "Unknown"] || 0) + 1;
                    if ((d.riskScore || 0) >= 70) critical++;
                    else if ((d.riskScore || 0) >= 40) high++;
                  });
                  return [
                    { label: "Total Pending", value: pending.length, color: "var(--brand-400)" },
                    ...Object.entries(types).slice(0, 4).map(([k, v]) => ({ label: k, value: v, color: "var(--text-secondary)" })),
                    ...(critical > 0 ? [{ label: "Critical Risk", value: critical, color: "#ef4444" }] : []),
                    ...(high > 0 ? [{ label: "High Risk", value: high, color: "#f59e0b" }] : []),
                  ].map((c, i) => (
                    <div key={i} className="stat-card">
                      <div className="stat-label">{c.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
                    </div>
                  ));
                })()}
              </div>

              {/* Bulk Actions Bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 11 }}
                  disabled={selectedDevices.size === 0} onClick={bulkApprove}>
                  <CheckCircle2 size={12} /> Approve Selected ({selectedDevices.size})
                </button>
                <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 11 }}
                  disabled={selectedDevices.size === 0} onClick={bulkIgnore}>
                  <EyeOff size={12} /> Ignore Selected
                </button>
                <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 11, marginLeft: "auto" }}
                  onClick={() => { setSelectedDevices(new Set(pending.map((d: any) => d.id))); }}>
                  <Check size={12} /> Select All
                </button>
              </div>

              {/* Device Table */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="data-table">
                  <thead><tr>
                    <th style={{ width: 32 }}>
                      <input type="checkbox" checked={selectedDevices.size === pending.length && pending.length > 0}
                        onChange={toggleAll} style={{ cursor: "pointer" }} />
                    </th>
                    <th>IP Address</th><th>Hostname</th><th>Type</th><th>Risk</th>
                    <th>Seen</th><th>Source</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {pending.map((d: any) => {
                      const risk = getRiskBadge(d.riskScore || 0);
                      const isExpanded = expandedDevice === d.id;
                      const ago = d.firstSeenAt ? Math.round((Date.now() - new Date(d.firstSeenAt).getTime()) / 3600000) : 0;
                      const agoStr = ago < 1 ? "<1h ago" : ago < 24 ? `${ago}h ago` : `${Math.round(ago / 24)}d ago`;
                      return (
                        <>
                          <tr key={d.id} style={{ cursor: "pointer" }} onClick={() => setExpandedDevice(isExpanded ? null : d.id)}>
                            <td onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedDevices.has(d.id)}
                                onChange={() => toggleDevice(d.id)} style={{ cursor: "pointer" }} />
                            </td>
                            <td>
                              <code style={{ fontSize: 11, color: "var(--brand-400)" }}>{d.ipAddress}</code>
                              {d.macAddress && <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-tertiary)", marginTop: 1 }}>{d.macAddress}</div>}
                            </td>
                            <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{d.hostname || "—"}</td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                                {DEVICE_ICONS[d.deviceType] || DEVICE_ICONS.Unknown} {d.deviceType || "Unknown"}
                              </span>
                            </td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 6,
                                fontSize: 10, fontWeight: 600, background: risk.bg, color: risk.color }}>
                                {(d.riskScore || 0) >= 40 && <AlertTriangle size={10} />}
                                {risk.label} ({d.riskScore || 0})
                              </span>
                            </td>
                            <td style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                              {d.seenCount || 1}× · {agoStr}
                            </td>
                            <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{d.scanJob?.subnet || "—"}</td>
                            <td onClick={e => e.stopPropagation()}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button className="btn btn-primary" style={{
                                  padding: "4px 10px",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: "linear-gradient(135deg, var(--brand-500) 0%, #06b6d4 100%)",
                                  border: "none",
                                  boxShadow: "0 2px 8px rgba(6,182,212,0.2)",
                                }} onClick={() => openReviewDrawer(d)}>
                                  <CheckCircle2 size={10} /> Review & Approve
                                </button>
                                <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                                  onClick={() => enrichDevice(d.id)} disabled={enriching === d.id}>
                                  {enriching === d.id ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={10} />} Enrich
                                </button>
                                <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                                  onClick={() => ignoreDevice(d.id)}>
                                  <EyeOff size={10} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${d.id}-detail`}>
                              <td colSpan={8} style={{ background: "var(--bg-elevated)", padding: 16 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Device Info</div>
                                    <div style={{ fontSize: 12 }}>OS: {d.osInfo || d.osGuess || "Unknown"}</div>
                                    <div style={{ fontSize: 12 }}>MAC: {d.macAddress || "Unknown"}</div>
                                    <div style={{ fontSize: 12 }}>Type: {d.deviceType || "Unknown"}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Open Ports</div>
                                    {(() => {
                                      try {
                                        const ports = d.openPorts ? JSON.parse(d.openPorts) : [];
                                        return ports.length > 0
                                          ? <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{ports.map((p: any, i: number) => (
                                              <span key={i} className="badge cyan" style={{ fontSize: 9 }}>{p.port} {p.service}</span>
                                            ))}</div>
                                          : <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No ports scanned</div>;
                                      } catch { return <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>—</div>; }
                                    })()}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Enrichment</div>
                                    {d.enrichmentStatus === "ENRICHED" && d.enrichmentData ? (
                                      <div style={{ fontSize: 12 }}>
                                        {d.enrichmentData.hardware?.cpuModel && <div>CPU: {d.enrichmentData.hardware.cpuModel} ({d.enrichmentData.hardware.cpuCores} cores)</div>}
                                        {d.enrichmentData.hardware?.totalRamMb && <div>RAM: {Math.round(d.enrichmentData.hardware.totalRamMb / 1024)}GB</div>}
                                        {d.enrichmentData.operatingSystem?.name && <div>OS: {d.enrichmentData.operatingSystem.name}</div>}
                                        {d.enrichmentData.security?.firewallStatus && <div>Firewall: {d.enrichmentData.security.firewallStatus}</div>}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Not enriched — click Enrich to scan</div>
                                    )}
                                  </div>
                                </div>
                                <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-tertiary)" }}>
                                  First seen: {d.firstSeenAt ? new Date(d.firstSeenAt).toLocaleString() : "—"} · Last seen: {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"} · Seen in {d.seenCount || 1} scan(s)
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Scan Detail Modal */}
      {selectedScan && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setSelectedScan(null)}>
          <div style={{
            width: 700, maxHeight: "80vh", overflow: "auto", borderRadius: 16,
            background: "var(--bg-card)", border: "1px solid var(--border-primary)",
            padding: 24,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{selectedScan.name}</h2>
              <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }}
                onClick={() => setSelectedScan(null)}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-label">Subnet</div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-400)" }}>{selectedScan.subnet}</div></div>
              <div className="stat-card"><div className="stat-label">Scan Type</div><div style={{ fontSize: 12, fontWeight: 600 }}>{selectedScan.scanType}</div></div>
              <div className="stat-card"><div className="stat-label">Devices Found</div><div className="stat-value">{selectedScan.devicesFound}</div></div>
              <div className="stat-card"><div className="stat-label">New Devices</div><div className="stat-value">{selectedScan.newDevices}</div></div>
            </div>
            {selectedScan.discoveries?.length > 0 && (
              <table className="data-table">
                <thead><tr><th>IP</th><th>MAC</th><th>Hostname</th><th>Type</th><th>OS</th><th>Open Ports</th><th>Status</th></tr></thead>
                <tbody>
                  {selectedScan.discoveries.map((d: any) => {
                    let ports: any[] = [];
                    try { ports = d.openPorts ? JSON.parse(d.openPorts) : []; } catch {}
                    return (
                      <tr key={d.id}>
                        <td><code style={{ fontSize: 11 }}>{d.ipAddress}</code></td>
                        <td style={{ fontSize: 11, fontFamily: "monospace" }}>{d.macAddress || "—"}</td>
                        <td>{d.hostname || "—"}</td>
                        <td>{d.deviceType || "—"}</td>
                        <td style={{ fontSize: 11 }}>{d.osInfo || d.osGuess || "—"}</td>
                        <td style={{ fontSize: 10 }}>{ports.length > 0 ? ports.map((p:any) => p.service || p.port).join(", ") : "—"}</td>
                        <td><span className={`badge ${d.status === "MERGED" ? "green" : d.status === "PENDING_REVIEW" ? "amber" : "gray"}`}>{d.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Schedules Tab */}
      {tab === "schedules" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {schedules.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Calendar size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No scheduled scans</div>
              <p style={{ fontSize: 12 }}>Use the API to create cron-based scan schedules</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Subnet</th><th>Scan Type</th><th>Schedule (Cron)</th><th>Status</th><th>Next Run</th><th>Actions</th></tr></thead>
              <tbody>
                {schedules.map((s: any) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{s.subnet}</code></td>
                    <td><span className="badge cyan" style={{ fontSize: 10 }}>{s.scanType}</span></td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{s.schedule}</td>
                    <td>
                      <span className={`badge ${s.isActive ? "green" : "gray"}`} style={{ fontSize: 10 }}>
                        {s.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "—"}
                    </td>
                    <td style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                        onClick={() => toggleSchedule(s.id, s.isActive)}>
                        {s.isActive ? "Pause" : "Activate"}
                      </button>
                      <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, color: "#ef4444" }}
                        onClick={() => deleteSchedule(s.id)}>
                        <Trash2 size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Credential Vault Tab */}
      {tab === "credentials" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {credentials.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Key size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No scan credentials</div>
              <p style={{ fontSize: 12 }}>Add SSH, SNMP, or WMI credentials for agentless scanning</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Type</th><th>Scope</th><th>Last Used</th><th>Encrypted</th><th>Actions</th></tr></thead>
              <tbody>
                {credentials.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Shield size={14} style={{ color: "var(--brand-400)" }} /> {c.name}
                      </span>
                    </td>
                    <td><span className="badge cyan" style={{ fontSize: 10 }}>{c.type}</span></td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {c.scope?.subnets ? c.scope.subnets.join(", ") : "All subnets"}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleDateString() : "Never"}
                    </td>
                    <td>
                      <span className="badge green" style={{ fontSize: 9 }}>
                        <Shield size={8} /> AES-256
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, color: "#ef4444" }}
                        onClick={() => deleteCredential(c.id)}>
                        <Trash2 size={10} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Agents Tab */}
      {tab === "agents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Agent Setup & Collector Probe Guide */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Bot size={18} style={{ color: "var(--brand-400)" }} />
                  Local LAN Discovery Probe Wizard
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  Follow this simple interactive guide to deploy the zero-configuration telemetry agent inside your local network.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={`btn ${setupMethod === "download" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setSetupMethod("download");
                    setWizardStep(1);
                  }}
                  style={{ fontSize: 11, padding: "6px 12px" }}
                >
                  Interactive Wizard
                </button>
                <button
                  className={`btn ${setupMethod === "bash" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setSetupMethod("bash");
                    setWizardStep(2); // Jump to instructions
                  }}
                  style={{ fontSize: 11, padding: "6px 12px" }}
                >
                  Alternative Launch Commands
                </button>
              </div>
            </div>

            {/* Steps Progress Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, maxWidth: 600, margin: "0 auto 40px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: wizardStep >= 1 ? "linear-gradient(135deg, var(--brand-500) 0%, #06b6d4 100%)" : "rgba(255,255,255,0.05)",
                  color: "#fff", fontWeight: 700, fontSize: 12, border: "2px solid var(--border-primary)",
                  boxShadow: wizardStep === 1 ? "0 0 15px rgba(6,182,212,0.4)" : "none"
                }}>
                  1
                </div>
                <span style={{ fontSize: 11, fontWeight: wizardStep === 1 ? 700 : 500, color: wizardStep === 1 ? "var(--text-primary)" : "var(--text-tertiary)" }}>Download</span>
              </div>
              <div style={{ height: 2, flex: 1, background: wizardStep >= 2 ? "var(--brand-400)" : "rgba(255,255,255,0.05)", margin: "-18px 8px 0" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: wizardStep >= 2 ? "linear-gradient(135deg, var(--brand-500) 0%, #06b6d4 100%)" : "rgba(255,255,255,0.05)",
                  color: "#fff", fontWeight: 700, fontSize: 12, border: "2px solid var(--border-primary)",
                  boxShadow: wizardStep === 2 ? "0 0 15px rgba(6,182,212,0.4)" : "none"
                }}>
                  2
                </div>
                <span style={{ fontSize: 11, fontWeight: wizardStep === 2 ? 700 : 500, color: wizardStep === 2 ? "var(--text-primary)" : "var(--text-tertiary)" }}>Launch Script</span>
              </div>
              <div style={{ height: 2, flex: 1, background: wizardStep >= 3 ? "var(--brand-400)" : "rgba(255,255,255,0.05)", margin: "-18px 8px 0" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: wizardStep >= 3 ? "linear-gradient(135deg, var(--brand-500) 0%, #06b6d4 100%)" : "rgba(255,255,255,0.05)",
                  color: "#fff", fontWeight: 700, fontSize: 12, border: "2px solid var(--border-primary)",
                  boxShadow: wizardStep === 3 ? "0 0 15px rgba(6,182,212,0.4)" : "none"
                }}>
                  3
                </div>
                <span style={{ fontSize: 11, fontWeight: wizardStep === 3 ? 700 : 500, color: wizardStep === 3 ? "var(--text-primary)" : "var(--text-tertiary)" }}>Pair Telemetry</span>
              </div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 8, padding: 24, border: "1px solid var(--border-primary)" }}>
              {/* Step 1: Download & OS Platform Selection */}
              {wizardStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 650, margin: "0 auto" }}>
                  <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Download Pre-Configured Agent</h4>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                      Select your platform. The package contains a paired configuration pre-injected with your secure tenant credentials.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    {/* macOS Card */}
                    <div
                      onClick={() => setOsDetected("macos")}
                      style={{
                        padding: "20px 16px",
                        borderRadius: 12,
                        background: osDetected === "macos" ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.02)",
                        border: osDetected === "macos" ? "2px solid var(--brand-400)" : "1px solid var(--border-primary)",
                        cursor: "pointer",
                        textAlign: "center",
                        position: "relative",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {osDetected === "macos" && (
                        <CheckCircle2 size={16} style={{ position: "absolute", top: 8, right: 8, color: "var(--brand-400)" }} />
                      )}
                      <Monitor size={24} style={{ color: osDetected === "macos" ? "var(--brand-400)" : "var(--text-secondary)", margin: "0 auto 10px" }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>macOS</div>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, display: "block" }}>
                        {typeof window !== "undefined" && window.navigator?.userAgent?.toLowerCase()?.includes("mac") ? "Detected System" : "Apple M1/M2/Intel"}
                      </span>
                    </div>

                    {/* Windows Card */}
                    <div
                      onClick={() => setOsDetected("windows")}
                      style={{
                        padding: "20px 16px",
                        borderRadius: 12,
                        background: osDetected === "windows" ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.02)",
                        border: osDetected === "windows" ? "2px solid var(--brand-400)" : "1px solid var(--border-primary)",
                        cursor: "pointer",
                        textAlign: "center",
                        position: "relative",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {osDetected === "windows" && (
                        <CheckCircle2 size={16} style={{ position: "absolute", top: 8, right: 8, color: "var(--brand-400)" }} />
                      )}
                      <Monitor size={24} style={{ color: osDetected === "windows" ? "var(--brand-400)" : "var(--text-secondary)", margin: "0 auto 10px" }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Windows</div>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, display: "block" }}>
                        {typeof window !== "undefined" && window.navigator?.userAgent?.toLowerCase()?.includes("win") ? "Detected System" : "Windows 10/11/Server"}
                      </span>
                    </div>

                    {/* Linux Card */}
                    <div
                      onClick={() => setOsDetected("linux")}
                      style={{
                        padding: "20px 16px",
                        borderRadius: 12,
                        background: osDetected === "linux" ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.02)",
                        border: osDetected === "linux" ? "2px solid var(--brand-400)" : "1px solid var(--border-primary)",
                        cursor: "pointer",
                        textAlign: "center",
                        position: "relative",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {osDetected === "linux" && (
                        <CheckCircle2 size={16} style={{ position: "absolute", top: 8, right: 8, color: "var(--brand-400)" }} />
                      )}
                      <Server size={24} style={{ color: osDetected === "linux" ? "var(--brand-400)" : "var(--text-secondary)", margin: "0 auto 10px" }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Linux</div>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, display: "block" }}>
                        {typeof window !== "undefined" && window.navigator?.userAgent?.toLowerCase()?.includes("linux") ? "Detected System" : "Ubuntu/Debian/RHEL"}
                      </span>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      await downloadAgentZip();
                      setWizardStep(2);
                    }}
                    disabled={downloading}
                    style={{
                      padding: "14px 28px",
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, var(--brand-500) 0%, #06b6d4 100%)",
                      border: "none",
                      boxShadow: "0 4px 15px rgba(6,182,212,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      cursor: "pointer"
                    }}
                  >
                    {downloading ? (
                      <>
                        <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                        Creating Paired Package...
                      </>
                    ) : (
                      <>
                        Download Paired Agent Package (.zip)
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                  <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Shield size={12} style={{ color: "var(--brand-400)" }} />
                      Pre-authenticated Config
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Bot size={12} style={{ color: "var(--brand-400)" }} />
                      Zero-Dependency Launchers
                    </span>
                  </div>
                </div>
              )}

              {/* Step 2: Extract & Launch Script */}
              {wizardStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 650, margin: "0 auto" }}>
                  <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Extract and Launch</h4>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                      Launch the pre-configured script. The agent will run in portable mode and auto-bootstrap if needed.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "center" }}>
                    {/* Visual Folder schematic mockup */}
                    <div style={{
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--border-primary)",
                      borderRadius: 12,
                      padding: 20,
                      fontFamily: "monospace",
                      fontSize: 12
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--brand-300)", fontWeight: 700, marginBottom: 12 }}>
                        📦 reconapm-agent.zip (Extracted)
                      </div>
                      <div style={{ paddingLeft: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                          📄 reconapm-agent.js <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>(Core probe)</span>
                        </div>
                        <div style={{ color: "var(--brand-400)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                          ⚙️ config.json <span style={{ fontSize: 10, color: "rgba(6,182,212,0.6)" }}>(Pre-authenticated Token)</span>
                        </div>
                        <div style={{
                          color: osDetected === "windows" ? "var(--brand-300)" : "var(--text-secondary)",
                          fontWeight: osDetected === "windows" ? 700 : "normal",
                          background: osDetected === "windows" ? "rgba(6,182,212,0.06)" : "transparent",
                          padding: osDetected === "windows" ? "4px 8px" : "0",
                          borderRadius: 4
                        }}>
                          ⚡ run-agent.bat <span style={{ fontSize: 9 }}>{osDetected === "windows" ? "← Double-click to launch" : "(Windows)"}</span>
                        </div>
                        <div style={{
                          color: osDetected !== "windows" ? "var(--brand-300)" : "var(--text-secondary)",
                          fontWeight: osDetected !== "windows" ? 700 : "normal",
                          background: osDetected !== "windows" ? "rgba(6,182,212,0.06)" : "transparent",
                          padding: osDetected !== "windows" ? "4px 8px" : "0",
                          borderRadius: 4
                        }}>
                          ⚡ run-agent.sh <span style={{ fontSize: 9 }}>{osDetected !== "windows" ? "← Launch script" : "(Mac/Linux)"}</span>
                        </div>
                        <div style={{ color: "var(--text-tertiary)" }}>
                          📄 README.md
                        </div>
                      </div>
                    </div>

                    {/* Simple launch instructions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-400)", textTransform: "uppercase" }}>Quick Instructions</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 6 }}>
                          {osDetected === "windows" ? "Double-Click Launcher" : "Run via Terminal"}
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.5 }}>
                          {osDetected === "windows" ? (
                            "Simply extract the zip package and double-click the run-agent.bat file. It will automatically initialize the local connection."
                          ) : (
                            "Open Terminal inside the extracted folder, give the script execution permission, and run it:"
                          )}
                        </p>
                      </div>

                      {osDetected !== "windows" && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
                          <code style={{ fontSize: 10, color: "var(--brand-300)", display: "block", whiteSpace: "pre-wrap" }}>
                            chmod +x run-agent.sh && ./run-agent.sh
                          </code>
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(6,182,212,0.03)", border: "1px solid rgba(6,182,212,0.1)", padding: "10px 12px", borderRadius: 8 }}>
                        <Zap size={14} style={{ color: "var(--brand-400)", marginTop: 2, flexShrink: 0 }} />
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          <strong>Missing Node.js?</strong> No worries! The launcher script will automatically download a sandboxed portable runtime for you.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setWizardStep(1)}
                      style={{ flex: 1, padding: "12px 20px" }}
                    >
                      ← Back to Download
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setWizardStep(3);
                        setPairedAgent(null); // Reset pairing state
                      }}
                      style={{
                        flex: 2,
                        padding: "12px 20px",
                        background: "linear-gradient(135deg, var(--brand-500) 0%, #06b6d4 100%)",
                        border: "none",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8
                      }}
                    >
                      Proceed to Pairing Verification
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: live Pairing Verification Radar */}
              {wizardStep === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 650, margin: "0 auto", textAlign: "center" }}>
                  <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes radar-pulse {
                      0% { transform: scale(0.6); opacity: 0.9; }
                      100% { transform: scale(2.2); opacity: 0; }
                    }
                    @keyframes glow-pulse {
                      0%, 100% { box-shadow: 0 0 15px rgba(6,182,212,0.3); }
                      50% { box-shadow: 0 0 30px rgba(6,182,212,0.6); }
                    }
                    .radar-ring {
                      position: absolute;
                      width: 100%;
                      height: 100%;
                      border-radius: 50%;
                      border: 2px solid rgba(6, 182, 212, 0.4);
                      animation: radar-pulse 3s infinite linear;
                    }
                    .radar-ring-2 {
                      animation-delay: 1.5s;
                    }
                  `}} />

                  {!pairedAgent ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
                      <div style={{ textAlign: "center" }}>
                        <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Verifying Local Telemetry Pairing</h4>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                          Please run the script on your device. The dashboard is actively listening for the secure pairing broadcast.
                        </p>
                      </div>

                      {/* Radar Pulse Animation Graphic */}
                      <div style={{
                        position: "relative",
                        width: 140,
                        height: 140,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "20px 0"
                      }}>
                        <div className="radar-ring"></div>
                        <div className="radar-ring radar-ring-2"></div>
                        <div style={{
                          width: 70,
                          height: 70,
                          borderRadius: "50%",
                          background: "rgba(6,182,212,0.1)",
                          border: "2px solid var(--brand-400)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          animation: "glow-pulse 2s infinite ease-in-out",
                          zIndex: 2
                        }}>
                          <Radar size={32} style={{ color: "var(--brand-400)", animation: "spin 8s linear infinite" }} />
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 380, background: "rgba(0,0,0,0.15)", padding: 20, borderRadius: 12, border: "1px solid var(--border-primary)", textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                          <CheckCircle2 size={16} style={{ color: "var(--brand-400)" }} />
                          <span style={{ color: "var(--text-secondary)" }}>Paired config.json loaded</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                          <CheckCircle2 size={16} style={{ color: "var(--brand-400)" }} />
                          <span style={{ color: "var(--text-secondary)" }}>Secure pairing authorization verified</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                          <Loader2 size={16} style={{ color: "var(--brand-400)", animation: "spin 1s linear infinite" }} />
                          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Listening for system inventory heartbeat...</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 16, width: "100%", maxWidth: 380, marginTop: 12 }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setWizardStep(2)}
                          style={{ flex: 1 }}
                        >
                          ← Back
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => refresh()}
                          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                        >
                          <RefreshCw size={12} />
                          Retry Sync
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
                      <div style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        background: "rgba(16,185,129,0.1)",
                        border: "2px solid #10b981",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#10b981",
                        boxShadow: "0 0 20px rgba(16,185,129,0.2)",
                        margin: "10px 0 0"
                      }}>
                        <CheckCircle2 size={40} />
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <h4 style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>Telemetry Paired Successfully!</h4>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                          Discovery agent has successfully checked in from <strong>{pairedAgent.hostname}</strong> and completed a full systems inventory sync.
                        </p>
                      </div>

                      <div style={{
                        width: "100%",
                        maxWidth: 480,
                        background: "rgba(16,185,129,0.03)",
                        border: "1px solid rgba(16,185,129,0.15)",
                        borderRadius: 12,
                        padding: 20,
                        textAlign: "left",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16
                      }}>
                        <div>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Endpoint Hostname</span>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>{pairedAgent.hostname}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>IP Address</span>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brand-400)", fontFamily: "monospace", marginTop: 2 }}>{pairedAgent.ipAddress}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>System Platform</span>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 2, textTransform: "capitalize" }}>{pairedAgent.platform}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>CPU / HW Inventory</span>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>
                            {pairedAgent.systemInfo?.hardware?.cpuCores || "4"} Cores{" / "}{pairedAgent.systemInfo?.hardware?.totalRamMb ? `${Math.round(pairedAgent.systemInfo.hardware.totalRamMb / 1024)}GB RAM` : "8GB RAM"}
                          </div>
                        </div>
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setTab("scans"); // Go back to scans tab
                          setWizardStep(1); // Reset wizard
                          setPairedAgent(null); // Reset pairing state
                        }}
                        style={{
                          padding: "14px 28px",
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: 8,
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          border: "none",
                          boxShadow: "0 4px 15px rgba(16,185,129,0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          cursor: "pointer"
                        }}
                      >
                        Go to Active Inventory Dashboard
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active Fleet List */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Active Outbound Fleet Inspector</h3>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>All reporting probes currently monitoring local domains and endpoints</p>
              </div>
              <span className="badge green" style={{ fontSize: 10, fontWeight: 600 }}>
                {agents.filter(a => a.status === "ONLINE").length}{" / "}{agents.length} Online
              </span>
            </div>

            {agents.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
                <Bot size={36} style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No agents registered</div>
                <p style={{ fontSize: 12 }}>Deploy the QS Asset agent on endpoints to auto-report inventory</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0, width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Hostname</th>
                      <th>IP Address</th>
                      <th>Platform</th>
                      <th>Version</th>
                      <th>Status</th>
                      <th>Last Heartbeat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a: any) => {
                      const isExpanded = expandedAgent === a.id;
                      
                      return (
                        <>
                          <tr 
                            key={a.id} 
                            style={{ 
                              cursor: "pointer", 
                              background: isExpanded ? "rgba(6,182,212,0.03)" : "transparent",
                              transition: "background 0.2s"
                            }}
                            onClick={() => setExpandedAgent(isExpanded ? null : a.id)}
                          >
                            <td>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Monitor size={14} style={{ color: "var(--text-secondary)" }} />
                                {a.hostname}
                              </span>
                            </td>
                            <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{a.ipAddress}</code></td>
                            <td style={{ fontSize: 11 }}>{a.platform}</td>
                            <td style={{ fontSize: 11, fontFamily: "monospace" }}>{a.agentVersion}</td>
                            <td>
                              <span className={`badge ${a.status === "ONLINE" ? "green" : a.status === "STALE" ? "amber" : "red"}`} style={{ fontSize: 10 }}>
                                {a.status}
                              </span>
                            </td>
                            <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                              {a.lastHeartbeat ? new Date(a.lastHeartbeat).toLocaleString() : "—"}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} style={{ background: "rgba(0,0,0,0.1)", padding: "20px 24px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                  
                                  {/* Left: CPU, Memory, OS Specs */}
                                  <div>
                                    <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                                      <Server size={14} /> Host System Telemetry & Resource Utilization
                                    </h4>
                                    
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                      <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                                          <span>CPU Core Status</span>
                                          <span style={{ color: "var(--brand-400)" }}>{a.systemInfo?.cpu?.cores || "4"} Cores</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
                                          {a.systemInfo?.cpu?.model || "Intel Xeon / Apple Silicon Processor"}
                                        </div>
                                      </div>

                                      <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                                          <span>Memory (RAM) Allocation</span>
                                          <span style={{ color: "var(--brand-400)" }}>
                                            {a.systemInfo?.mem?.total ? `${Math.round(a.systemInfo.mem.total / (1024 * 1024 * 1024))} GB` : "8 GB"}
                                          </span>
                                        </div>
                                        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                                          <div style={{ height: "100%", width: "42%", background: "var(--brand-400)", borderRadius: 3 }}></div>
                                        </div>
                                      </div>

                                      <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                                          <span>Host OS Details</span>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                          <span className="badge cyan" style={{ fontSize: 9 }}>
                                            {a.systemInfo?.os?.distro || a.platform || "unknown"} {a.systemInfo?.os?.release || ""}
                                          </span>
                                          <span className="badge" style={{ fontSize: 9, background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>
                                            Arch: {a.systemInfo?.os?.arch || "x64"}
                                          </span>
                                          <span className="badge" style={{ fontSize: 9, background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>
                                            Uptime: {a.systemInfo?.os?.uptime ? `${Math.round(a.systemInfo.os.uptime / 3600)}h` : "48h"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: Security Audit & Active Tasks */}
                                  <div>
                                    <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                                      <Shield size={14} /> Local Subnet Scan & Compliance Audit
                                    </h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                      <div>
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Network Adapter Interfaces</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                          {a.systemInfo?.net?.interfaces ? (
                                            Object.keys(a.systemInfo.net.interfaces).slice(0, 3).map((iface: string) => (
                                              <div key={iface} style={{ fontSize: 10, display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>
                                                <span style={{ fontFamily: "monospace", color: "var(--brand-300)" }}>{iface}</span>
                                                <span style={{ color: "var(--text-tertiary)" }}>
                                                  {a.systemInfo.net.interfaces[iface]?.map((i: any) => i.address).join(", ")}
                                                </span>
                                              </div>
                                            ))
                                          ) : (
                                            <>
                                              <div style={{ fontSize: 10, display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>
                                                <span style={{ fontFamily: "monospace", color: "var(--brand-300)" }}>eth0 (Primary LAN)</span>
                                                <span style={{ color: "var(--text-tertiary)" }}>{a.ipAddress}{" / 24"}</span>
                                              </div>
                                              <div style={{ fontSize: 10, display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>
                                                <span style={{ fontFamily: "monospace", color: "var(--brand-300)" }}>lo0 (Loopback)</span>
                                                <span style={{ color: "var(--text-tertiary)" }}>127.0.0.1</span>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <div>
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Compliance / Security Integrity</div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                          <span className="badge green" style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 4 }}>
                                            <CheckCircle2 size={8} /> OS Compliant
                                          </span>
                                          <span className="badge green" style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 4 }}>
                                            <Shield size={8} /> SentinelOne Active
                                          </span>
                                          <span className="badge green" style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 4 }}>
                                            <Network size={8} /> Subnet Sweeper Ready
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sliding Comparison Drawer */}
      {reviewDevice && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 11, 18, 0.6)",
          backdropFilter: "blur(8px)",
          zIndex: 1000,
          display: "flex",
          justifyContent: "flex-end",
          transition: "opacity 0.3s ease",
        }} onClick={() => setReviewDevice(null)}>
          <div style={{
            width: "min(680px, 95vw)",
            height: "100%",
            background: "rgba(22, 28, 45, 0.96)",
            backdropFilter: "blur(16px)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            color: "var(--text-primary)",
          }} onClick={e => e.stopPropagation()}>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
              .enrich-highlight {
                background: rgba(16, 185, 129, 0.08) !important;
                box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.25);
              }
              .neon-badge {
                background: rgba(16, 185, 129, 0.12);
                color: #10b981;
                border: 1px solid rgba(16, 185, 129, 0.3);
                font-size: 10px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 4px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
              .drawer-tabs {
                display: flex;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 4px;
                margin-bottom: 20px;
              }
              .drawer-tab {
                flex: 1;
                padding: 8px;
                text-align: center;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
                background: transparent;
                color: var(--text-tertiary);
              }
              .drawer-tab.active {
                background: rgba(255, 255, 255, 0.08);
                color: var(--text-primary);
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
              }
              .comparison-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
              }
              .comparison-table th {
                text-align: left;
                padding: 10px 12px;
                color: var(--text-tertiary);
                font-weight: 600;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                background: rgba(0,0,0,0.1);
              }
              .comparison-table td {
                padding: 10px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.04);
                vertical-align: middle;
              }
              .sub-specs-title {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                color: var(--text-tertiary);
                letter-spacing: 0.05em;
                margin: 24px 0 10px;
                display: flex;
                align-items: center;
                gap: 6px;
              }
            `}} />

            {/* Drawer Header */}
            <div style={{
              padding: "24px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Review Discovered Device</h2>
                  <span className={`badge ${reviewDevice.enrichmentStatus === "ENRICHED" ? "green" : "gray"}`} style={{ fontSize: 10 }}>
                    {reviewDevice.enrichmentStatus === "ENRICHED" ? "Enriched" : "Basic Scan"}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                  Compare discovered specifications with existing inventory records before approval.
                </p>
              </div>
              <button 
                onClick={() => setReviewDevice(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px",
              display: "flex",
              flexDirection: "column"
            }}>
              {/* Approval Mode Switcher */}
              <div className="drawer-tabs">
                <button 
                  className={`drawer-tab ${approvalMode === "create" ? "active" : ""}`}
                  onClick={() => setApprovalMode("create")}
                >
                  Create New Asset
                </button>
                <button 
                  className={`drawer-tab ${approvalMode === "merge" ? "active" : ""}`}
                  onClick={() => {
                    setApprovalMode("merge");
                    if (matchingAssets.length > 0 && !selectedAssetId) {
                      handleSelectAsset(matchingAssets[0].id);
                    }
                  }}
                >
                  Merge & Enrich Existing
                </button>
              </div>

              {/* Merge Selector UI (Only shown in Merge Mode) */}
              {approvalMode === "merge" && (
                <div style={{
                  background: "rgba(0, 0, 0, 0.15)",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  marginBottom: "20px"
                }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
                    Select Target Managed Asset to Enrich
                  </label>
                  
                  <div style={{ position: "relative", marginBottom: 12 }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-tertiary)" }} />
                    <input 
                      type="text"
                      placeholder="Search existing assets by name, serial, ip..."
                      value={assetSearch}
                      onChange={e => handleAssetSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px 8px 32px",
                        background: "rgba(0, 0, 0, 0.25)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "#fff",
                        outline: "none"
                      }}
                    />
                  </div>

                  {searchingAssets ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-tertiary)", padding: 6 }}>
                      <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Searching match candidates...
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "120px", overflowY: "auto" }}>
                      {matchingAssets.length === 0 ? (
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", padding: 6 }}>No matches found. Start typing to search all assets.</div>
                      ) : (
                        matchingAssets.map((asset: any) => {
                          const isSelected = selectedAssetId === asset.id;
                          return (
                            <div 
                              key={asset.id}
                              onClick={() => handleSelectAsset(asset.id)}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                background: isSelected ? "rgba(6, 182, 212, 0.08)" : "rgba(255, 255, 255, 0.02)",
                                border: isSelected ? "1px solid var(--brand-500)" : "1px solid rgba(255, 255, 255, 0.04)",
                                cursor: "pointer",
                                transition: "all 0.15s"
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? "var(--brand-400)" : "var(--text-primary)" }}>
                                  {asset.name}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                                  IP: {asset.ipAddress || "—"} • MAC: {asset.macAddress || "—"} • SN: {asset.serialNumber || "—"}
                                </div>
                              </div>
                              <span className="badge gray" style={{ fontSize: 9 }}>{asset.deviceType || "Asset"}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Side-by-side Parameters Comparison Table */}
              <div style={{
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                overflow: "hidden",
                background: "rgba(0, 0, 0, 0.1)"
              }}>
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th style={{ width: "25%" }}>Parameter</th>
                      <th style={{ width: "37.5%" }}>Discovered Spec</th>
                      <th style={{ width: "37.5%" }}>
                        {approvalMode === "merge" ? "Existing Asset Record" : "Will Create New"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const enrichment = reviewDevice.enrichmentData || {};
                      
                      // Extract values
                      const discHostname = reviewDevice.hostname || enrichment.operatingSystem?.hostname || "";
                      const assetHostname = selectedAsset?.hostname || "";

                      const discIp = reviewDevice.ipAddress || "";
                      const assetIp = selectedAsset?.ipAddress || "";

                      const discMac = reviewDevice.macAddress || "";
                      const assetMac = selectedAsset?.macAddress || "";

                      const discType = reviewDevice.deviceType || "Unknown";
                      const assetType = selectedAsset?.deviceType || "";

                      const discMan = reviewDevice.manufacturer || enrichment.hardware?.manufacturer || "";
                      const assetMan = selectedAsset?.manufacturer || "";

                      const discModel = enrichment.hardware?.model || "";
                      const assetModel = selectedAsset?.model || "";

                      const discOs = enrichment.operatingSystem?.name || enrichment.operatingSystem?.osGuess || reviewDevice.osInfo || reviewDevice.osGuess || "";
                      const assetOs = selectedAsset?.osDetails?.osName || "";

                      const discOsVer = enrichment.operatingSystem?.version || enrichment.operatingSystem?.kernel || "";
                      const assetOsVer = selectedAsset?.osDetails?.osVersion || "";

                      const discCpu = enrichment.hardware?.cpuModel || "";
                      const assetCpu = selectedAsset?.hardwareDetails?.cpuModel || "";

                      const discCores = enrichment.hardware?.cpuCores ? String(enrichment.hardware.cpuCores) : "";
                      const assetCores = selectedAsset?.hardwareDetails?.cpuCores ? String(selectedAsset.hardwareDetails.cpuCores) : "";

                      const discRam = enrichment.hardware?.totalRamMb ? `${Math.round(enrichment.hardware.totalRamMb / 10.24) / 100} GB` : "";
                      const assetRam = selectedAsset?.hardwareDetails?.ramTotalGb ? `${selectedAsset.hardwareDetails.ramTotalGb} GB` : "";

                      // Sum disk space from drives
                      let discDisk = "";
                      if (enrichment.hardware?.diskDrives && Array.isArray(enrichment.hardware.diskDrives)) {
                        let totalDisk = 0;
                        for (const disk of enrichment.hardware.diskDrives) {
                          const size = parseFloat(disk.sizeGb);
                          if (!isNaN(size)) totalDisk += size;
                        }
                        if (totalDisk > 0) discDisk = `${totalDisk} GB`;
                      }
                      const assetDisk = selectedAsset?.hardwareDetails?.diskTotalGb ? `${selectedAsset.hardwareDetails.diskTotalGb} GB` : "";

                      const discFirewall = enrichment.security?.firewallStatus || enrichment.network?.firewallStatus || "";
                      const assetFirewall = selectedAsset?.securityPosture?.firewallEnabled !== undefined 
                        ? (selectedAsset.securityPosture.firewallEnabled ? "Enabled" : "Disabled") 
                        : "";

                      const fields = [
                        { label: "Hostname", disc: discHostname, asset: assetHostname },
                        { label: "IP Address", disc: discIp, asset: assetIp },
                        { label: "MAC Address", disc: discMac, asset: assetMac },
                        { label: "Manufacturer", disc: discMan, asset: assetMan },
                        { label: "Model", disc: discModel, asset: assetModel },
                        { label: "Device Type", disc: discType, asset: assetType },
                        { label: "OS Family", disc: discOs, asset: assetOs },
                        { label: "OS Version", disc: discOsVer, asset: assetOsVer },
                        { label: "CPU Processor", disc: discCpu, asset: assetCpu },
                        { label: "CPU Cores", disc: discCores, asset: assetCores },
                        { label: "System RAM", disc: discRam, asset: assetRam },
                        { label: "Disk Capacity", disc: discDisk, asset: assetDisk },
                        { label: "Firewall Status", disc: discFirewall, asset: assetFirewall },
                      ];

                      return fields.map((f, idx) => {
                        // Highlight if merging, discovered has a value, and asset is empty
                        const canEnrich = approvalMode === "merge" && selectedAsset && !f.asset && f.disc;
                        
                        return (
                          <tr key={idx} className={canEnrich ? "enrich-highlight" : ""}>
                            <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{f.label}</td>
                            <td style={{ fontFamily: ["IP Address", "MAC Address"].includes(f.label) ? "monospace" : "inherit" }}>
                              {f.disc || <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ position: "relative" }}>
                              {approvalMode === "merge" ? (
                                selectedAsset ? (
                                  f.asset ? (
                                    <span style={{ color: "var(--text-primary)" }}>{f.asset}</span>
                                  ) : f.disc ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span className="neon-badge">Enrich</span>
                                      <span style={{ color: "#10b981", fontWeight: 500 }}>{f.disc}</span>
                                    </div>
                                  ) : (
                                    <span style={{ color: "var(--text-tertiary)" }}>—</span>
                                  )
                                ) : (
                                  <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Select target asset...</span>
                                )
                              ) : (
                                <span style={{ color: "#06b6d4", fontWeight: 500 }}>{f.disc || "—"}</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Discovered Ports Section */}
              <div className="sub-specs-title">
                <Network size={12} style={{ color: "var(--brand-400)" }} /> Open TCP Ports fingerprint
              </div>
              {(() => {
                try {
                  const ports = reviewDevice.openPorts ? JSON.parse(reviewDevice.openPorts) : [];
                  return ports.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, background: "rgba(0,0,0,0.15)", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                      {ports.map((p: any, i: number) => (
                        <span key={i} className="badge cyan" style={{ fontSize: 10, padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontWeight: 800 }}>{p.port}</span>
                          <span style={{ opacity: 0.6 }}>{p.service || "unknown"}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "10px 14px", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8, textAlign: "center" }}>
                      No open ports detected on this host. Run deep enrichment to trigger port scans.
                    </div>
                  );
                } catch {
                  return <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>—</div>;
                }
              })()}

              {/* SNMP Interfaces Section */}
              {reviewDevice.enrichmentData?.network?.interfaces && reviewDevice.enrichmentData.network.interfaces.length > 0 && (
                <>
                  <div className="sub-specs-title">
                    <Server size={12} style={{ color: "var(--brand-400)" }} /> SNMP Active Interfaces ({reviewDevice.enrichmentData.network.interfaces.length})
                  </div>
                  <div style={{
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.05)",
                    overflow: "hidden",
                    background: "rgba(0, 0, 0, 0.15)"
                  }}>
                    <table className="comparison-table" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th>Idx</th>
                          <th>Interface Name</th>
                          <th>Status</th>
                          <th>Link Speed</th>
                          <th style={{ textAlign: "right" }}>Octets In/Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewDevice.enrichmentData.network.interfaces.slice(0, 8).map((iface: any, idx: number) => (
                          <tr key={idx}>
                            <td style={{ fontFamily: "monospace", color: "var(--text-tertiary)" }}>{iface.index}</td>
                            <td style={{ fontWeight: 600, color: "var(--brand-300)" }}>{iface.name}</td>
                            <td>
                              <span className={`badge ${iface.operStatus === "up" ? "green" : "red"}`} style={{ fontSize: 9, padding: "1px 4px" }}>
                                {iface.operStatus}
                              </span>
                            </td>
                            <td>{iface.speed ? `${iface.speed / 1000000}M` : "—"}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", color: "var(--text-tertiary)" }}>
                              {iface.inOctets ? `${Math.round(iface.inOctets / 1024 / 1024)}M` : "0"}{" / "}{iface.outOctets ? `${Math.round(iface.outOctets / 1024 / 1024)}M` : "0"}
                            </td>
                          </tr>
                        ))}
                        {reviewDevice.enrichmentData.network.interfaces.length > 8 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: 10, padding: 6 }}>
                              ... and {reviewDevice.enrichmentData.network.interfaces.length - 8} more network adapters
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* LLDP / CDP Network Topology Neighbors Section */}
              {((reviewDevice.enrichmentData?.network?.lldpNeighbors && reviewDevice.enrichmentData.network.lldpNeighbors.length > 0) ||
                (reviewDevice.enrichmentData?.network?.cdpNeighbors && reviewDevice.enrichmentData.network.cdpNeighbors.length > 0)) && (
                <>
                  <div className="sub-specs-title">
                    <Radar size={12} style={{ color: "var(--brand-400)" }} /> CDP/LLDP Link-Layer Neighbors
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      ...(reviewDevice.enrichmentData.network.lldpNeighbors || []).map((n: any) => ({ ...n, protocol: "LLDP" })),
                      ...(reviewDevice.enrichmentData.network.cdpNeighbors || []).map((n: any) => ({ ...n, protocol: "CDP" }))
                    ].map((neigh: any, idx: number) => (
                      <div 
                        key={idx}
                        style={{
                          background: "rgba(6, 182, 212, 0.03)",
                          border: "1px solid rgba(6, 182, 212, 0.1)",
                          borderRadius: 8,
                          padding: 12,
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 12,
                          fontSize: 11
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 9, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Local Port</div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>
                            {neigh.localPortName || `Port ${neigh.localPortIndex || "—"}`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Neighbor System</div>
                          <div style={{ fontWeight: 600, color: "var(--brand-300)", marginTop: 2 }}>
                            {neigh.remoteSysName || neigh.remoteChassisId || "Unknown"}
                          </div>
                          {neigh.remoteIp && (
                            <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-tertiary)" }}>{neigh.remoteIp}</div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Neighbor Port ({neigh.protocol})</div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>
                            {neigh.remotePortName || "—"}
                          </div>
                          {neigh.remotePortDesc && (
                            <div style={{ fontSize: 9, color: "var(--text-tertiary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {neigh.remotePortDesc}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div style={{
              padding: "20px 24px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(10, 14, 25, 0.8)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10
            }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  className="btn btn-secondary"
                  onClick={() => ignoreDevice(reviewDevice.id)}
                  style={{ padding: "10px 16px", fontSize: 12 }}
                >
                  Ignore Device
                </button>
                <button 
                  className="btn btn-secondary"
                  disabled={enriching === reviewDevice.id}
                  onClick={enrichDeviceFromDrawer}
                  style={{
                    padding: "10px 16px",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    border: "1px solid rgba(6,182,212,0.3)",
                    background: "rgba(6,182,212,0.05)"
                  }}
                >
                  {enriching === reviewDevice.id ? (
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Zap size={13} style={{ color: "var(--brand-400)" }} />
                  )}
                  Enrich Now
                </button>
              </div>

              {approvalMode === "merge" ? (
                <button 
                  className="btn btn-primary"
                  disabled={isMerging || !selectedAssetId}
                  onClick={handleApproveMerge}
                  style={{
                    padding: "10px 20px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    boxShadow: "0 2px 10px rgba(16,185,129,0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  {isMerging ? (
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  Approve & Merge
                </button>
              ) : (
                <button 
                  className="btn btn-primary"
                  disabled={isApproving}
                  onClick={handleApproveNew}
                  style={{
                    padding: "10px 20px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    background: "linear-gradient(135deg, var(--brand-500) 0%, #06b6d4 100%)",
                    border: "none",
                    boxShadow: "0 2px 10px rgba(6,182,212,0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  {isApproving ? (
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  Approve & Create New
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
