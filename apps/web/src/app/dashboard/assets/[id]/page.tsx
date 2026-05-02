"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Monitor, Cpu, HardDrive, Shield, Clock, Package,
  MapPin, User, Calendar, Tag, Activity, Server, Wifi, ChevronRight,
  FileText, AlertTriangle, CheckCircle2, Info, Trash2
} from "lucide-react";
import EditAssetPanel from "@/components/EditAssetPanel";
import { apiFetch } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "green", DISCOVERED: "blue", IN_MAINTENANCE: "amber",
  RETIRED: "gray", IN_STORAGE: "purple", DISPOSED: "red",
};

const TABS = [
  { id: "overview", label: "Overview", icon: <Info size={14} /> },
  { id: "hardware", label: "Hardware", icon: <Cpu size={14} /> },
  { id: "software", label: "Software", icon: <Package size={14} /> },
  { id: "security", label: "Security", icon: <Shield size={14} /> },
  { id: "history", label: "History", icon: <Clock size={14} /> },
];

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [asset, setAsset] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  function loadAsset() {
    apiFetch(`/assets/${params.id}`)
      .then(setAsset)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAsset(); }, [params.id]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Activity size={24} style={{ color: "var(--brand-500)", animation: "spin 2s linear infinite" }} /></div>;
  if (!asset) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Asset not found</div>;

  return (
    <>
      {/* Breadcrumb + Back */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, color: "var(--text-tertiary)" }}>
        <button onClick={() => router.push("/dashboard/assets")} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={14} /> Assets
        </button>
        <ChevronRight size={12} />
        <span style={{ color: "var(--text-secondary)" }}>{asset.name}</span>
      </div>

      {/* Header Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: `rgba(6,182,212,0.12)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--brand-400)", flexShrink: 0,
            }}>
              {asset.ipAddress ? <Monitor size={28} /> : asset.latitude ? <MapPin size={28} /> : <Package size={28} />}
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{asset.name}</h1>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className={`badge ${STATUS_BADGE[asset.status] || "gray"}`}>{asset.status}</span>
                <span className="badge cyan">{asset.assetType?.name}</span>
                {asset.assetTag && <span className="badge gray"><Tag size={10} /> {asset.assetTag}</span>}
                {asset.discoverySource && <span className="badge purple">{asset.discoverySource}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>Edit</button>
            <button className="btn btn-primary" onClick={() => { if(confirm('Delete this asset?')) { apiFetch(`/assets/${asset.id}`, { method: 'DELETE' }).then(() => router.push('/dashboard/assets')); } }}><Trash2 size={14} /> Delete</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0, borderBottom: "1px solid var(--border-primary)",
        marginBottom: 20, overflowX: "auto", scrollbarWidth: "none",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 16px", fontSize: 13, fontWeight: 500,
            fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none",
            borderBottom: tab === t.id ? "2px solid var(--brand-400)" : "2px solid transparent",
            color: tab === t.id ? "var(--brand-300)" : "var(--text-secondary)",
            transition: "all 0.15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && <OverviewTab asset={asset} />}
      {tab === "hardware" && <HardwareTab asset={asset} />}
      {tab === "software" && <SoftwareTab asset={asset} />}
      {tab === "security" && <SecurityTab asset={asset} />}
      {tab === "history" && <HistoryTab asset={asset} />}

      <EditAssetPanel open={showEdit} asset={asset} onClose={() => setShowEdit(false)} onUpdated={loadAsset} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

/* ========== OVERVIEW TAB ========== */
function OverviewTab({ asset }: { asset: any }) {
  const fields = [
    { label: "Asset Tag", value: asset.assetTag, icon: <Tag size={14} /> },
    { label: "Serial Number", value: asset.serialNumber, icon: <FileText size={14} /> },
    { label: "Manufacturer", value: asset.manufacturer, icon: <Package size={14} /> },
    { label: "Model", value: asset.model, icon: <Server size={14} /> },
    { label: "Site", value: asset.site?.name, icon: <MapPin size={14} /> },
    { label: "Department", value: asset.department?.name, icon: <User size={14} /> },
    { label: "Assigned To", value: asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : null, icon: <User size={14} /> },
    { label: "Managed By", value: asset.managedBy ? `${asset.managedBy.firstName} ${asset.managedBy.lastName}` : null, icon: <User size={14} /> },
  ];

  const lifecycle = [
    { label: "Procurement Date", value: asset.procurementDate ? new Date(asset.procurementDate).toLocaleDateString() : null },
    { label: "Deployment Date", value: asset.deploymentDate ? new Date(asset.deploymentDate).toLocaleDateString() : null },
    { label: "Warranty Expiry", value: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : null },
    { label: "EOL Date", value: asset.eolDate ? new Date(asset.eolDate).toLocaleDateString() : null },
    { label: "Purchase Price", value: asset.purchasePrice ? `₹${Number(asset.purchasePrice).toLocaleString("en-IN")}` : null },
    { label: "Current Value", value: asset.currentValue ? `₹${Number(asset.currentValue).toLocaleString("en-IN")}` : null },
  ];

  const network = [
    { label: "IP Address", value: asset.ipAddress },
    { label: "MAC Address", value: asset.macAddress },
    { label: "Hostname", value: asset.hostname },
    { label: "FQDN", value: asset.fqdn },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Identity & Location */}
      <div className="card">
        <div className="card-header"><div className="card-title">Identity & Location</div></div>
        <div style={{ display: "grid", gap: 12 }}>
          {fields.map(f => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
                {f.icon} {f.label}
              </span>
              <span style={{ fontSize: 13, color: f.value ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight: f.value ? 500 : 400 }}>
                {f.value || "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lifecycle & Financial */}
      <div className="card">
        <div className="card-header"><div className="card-title">Lifecycle & Financial</div></div>
        <div style={{ display: "grid", gap: 12 }}>
          {lifecycle.map(f => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={14} /> {f.label}
              </span>
              <span style={{ fontSize: 13, color: f.value ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight: f.value ? 500 : 400 }}>
                {f.value || "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Network (if IT asset) */}
      {(asset.ipAddress || asset.macAddress || asset.hostname) && (
        <div className="card">
          <div className="card-header"><div className="card-title"><Wifi size={14} /> Network Details</div></div>
          <div style={{ display: "grid", gap: 12 }}>
            {network.map(f => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{f.label}</span>
                <span style={{ fontSize: 13, color: f.value ? "var(--brand-400)" : "var(--text-tertiary)", fontFamily: f.value ? "monospace" : "inherit" }}>
                  {f.value || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GPS (if fleet asset) */}
      {(asset.latitude && asset.longitude) && (
        <div className="card">
          <div className="card-header"><div className="card-title"><MapPin size={14} /> GPS Location</div></div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Latitude</span>
              <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--brand-400)" }}>{asset.latitude}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Longitude</span>
              <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--brand-400)" }}>{asset.longitude}</span>
            </div>
          </div>
          {asset.customFields && Object.keys(asset.customFields).length > 0 && (
            <>
              <div style={{ borderTop: "1px solid var(--border-primary)", margin: "12px 0" }} />
              <div className="card-title" style={{ fontSize: 13, marginBottom: 8 }}>Custom Fields</div>
              {Object.entries(asset.customFields).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
                  <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{String(v)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Notes */}
      {asset.notes && (
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-header"><div className="card-title">Notes</div></div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{asset.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ========== HARDWARE TAB ========== */
function HardwareTab({ asset }: { asset: any }) {
  const hw = asset.hardwareDetails;
  const os = asset.osDetails;

  if (!hw && !os) return <EmptyState icon={<Cpu size={40} />} title="No Hardware Details" desc="Hardware specs will appear here once discovered via agent or scan" />;

  const hwFields = hw ? [
    { label: "CPU Model", value: hw.cpuModel }, { label: "CPU Cores", value: hw.cpuCores },
    { label: "CPU Speed", value: hw.cpuSpeedGhz ? `${hw.cpuSpeedGhz} GHz` : null },
    { label: "RAM Total", value: hw.ramTotalGb ? `${hw.ramTotalGb} GB` : null },
    { label: "RAM Type", value: hw.ramType },
    { label: "Disk Total", value: hw.diskTotalGb ? `${hw.diskTotalGb} GB` : null },
    { label: "Disk Type", value: hw.diskType }, { label: "Disk Health", value: hw.diskHealth },
    { label: "GPU", value: hw.gpuModel },
    { label: "BIOS Version", value: hw.biosVersion }, { label: "BIOS Vendor", value: hw.biosVendor },
    { label: "TPM Version", value: hw.tpmVersion },
    { label: "TPM Enabled", value: hw.tpmEnabled != null ? (hw.tpmEnabled ? "Yes" : "No") : null },
    { label: "Form Factor", value: hw.formFactor },
  ] : [];

  const osFields = os ? [
    { label: "OS Name", value: os.osName }, { label: "OS Version", value: os.osVersion },
    { label: "OS Build", value: os.osBuild }, { label: "Architecture", value: os.osArchitecture },
    { label: "Install Date", value: os.installDate ? new Date(os.installDate).toLocaleDateString() : null },
    { label: "Last Boot", value: os.lastBoot ? new Date(os.lastBoot).toLocaleDateString() : null },
    { label: "Uptime", value: os.uptimeDays ? `${os.uptimeDays} days` : null },
  ] : [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {hw && <DetailCard title="Hardware Specs" icon={<Cpu size={14} />} fields={hwFields} />}
      {os && <DetailCard title="Operating System" icon={<Monitor size={14} />} fields={osFields} />}
      {!hw && <EmptyState icon={<Cpu size={32} />} title="No Hardware Data" desc="Run an agent scan to collect hardware specs" />}
      {!os && <EmptyState icon={<Monitor size={32} />} title="No OS Data" desc="OS details pending scan" />}
    </div>
  );
}

/* ========== SOFTWARE TAB ========== */
function SoftwareTab({ asset }: { asset: any }) {
  const installs = asset.softwareInstalls || [];
  if (installs.length === 0) return <EmptyState icon={<Package size={40} />} title="No Software Detected" desc="Software inventory will populate here after an agent scan" />;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="card-header" style={{ padding: "16px 20px 12px" }}>
        <div className="card-title">{installs.length} Installed Software</div>
      </div>
      <table className="data-table">
        <thead><tr><th>Software</th><th>Publisher</th><th>Version</th><th>Install Date</th><th>Last Used</th></tr></thead>
        <tbody>
          {installs.map((i: any) => (
            <tr key={i.id}>
              <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{i.software?.name || "Unknown"}</td>
              <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{i.software?.publisher || "—"}</td>
              <td><span className="badge cyan">{i.version || "—"}</span></td>
              <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{i.installDate ? new Date(i.installDate).toLocaleDateString() : "—"}</td>
              <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{i.lastUsedAt ? new Date(i.lastUsedAt).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ========== SECURITY TAB ========== */
function SecurityTab({ asset }: { asset: any }) {
  const sec = asset.securityPosture;
  if (!sec) return <EmptyState icon={<Shield size={40} />} title="No Security Data" desc="Security posture will update after an agent or vulnerability scan" />;

  const score = sec.complianceScore || 0;
  const scoreColor = score >= 80 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--error)";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Score */}
      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: scoreColor }}>{score}%</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>Compliance Score</div>
        <div style={{ marginTop: 12, width: "100%", height: 8, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${score}%`, height: "100%", background: scoreColor, borderRadius: 4, transition: "width 0.5s" }} />
        </div>
      </div>
      {/* Details */}
      <DetailCard title="Security Posture" icon={<Shield size={14} />} fields={[
        { label: "AV Installed", value: sec.avInstalled != null ? (sec.avInstalled ? "✅ Yes" : "❌ No") : null },
        { label: "AV Name", value: sec.avName },
        { label: "AV Real-time", value: sec.avRealtimeProtection != null ? (sec.avRealtimeProtection ? "✅ Active" : "❌ Off") : null },
        { label: "Firewall", value: sec.firewallEnabled != null ? (sec.firewallEnabled ? "✅ Enabled" : "❌ Disabled") : null },
        { label: "Encryption", value: sec.encryptionEnabled != null ? (sec.encryptionEnabled ? `✅ ${sec.encryptionType || "Enabled"}` : "❌ Not encrypted") : null },
        { label: "Encryption %", value: sec.encryptionPercent != null ? `${sec.encryptionPercent}%` : null },
        { label: "Last Assessed", value: sec.lastAssessedAt ? new Date(sec.lastAssessedAt).toLocaleDateString() : null },
      ]} />
    </div>
  );
}

/* ========== HISTORY TAB ========== */
function HistoryTab({ asset }: { asset: any }) {
  const events = asset.assetHistory || [];
  if (events.length === 0) return <EmptyState icon={<Clock size={40} />} title="No History" desc="Asset lifecycle events will appear here" />;

  const eventColors: Record<string, string> = {
    CREATED: "var(--success)", UPDATED: "var(--brand-400)", STATUS_CHANGED: "var(--warning)",
    ASSIGNED: "var(--accent-500)", DELETED: "var(--error)",
  };

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Asset Timeline</div></div>
      <div style={{ position: "relative", paddingLeft: 24 }}>
        {/* Timeline line */}
        <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 2, background: "var(--border-primary)" }} />
        {events.map((e: any, i: number) => (
          <div key={e.id} style={{ position: "relative", paddingBottom: i === events.length - 1 ? 0 : 20 }}>
            {/* Dot */}
            <div style={{
              position: "absolute", left: -20, top: 4, width: 12, height: 12,
              borderRadius: "50%", border: "2px solid var(--bg-card)",
              background: eventColors[e.eventType] || "var(--text-tertiary)",
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span className={`badge ${e.eventType === "CREATED" ? "green" : e.eventType === "UPDATED" ? "cyan" : "gray"}`} style={{ marginBottom: 4 }}>
                  {e.eventType}
                </span>
                <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4 }}>{e.description}</div>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap", marginLeft: 16 }}>
                {new Date(e.timestamp).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== SHARED COMPONENTS ========== */
function DetailCard({ title, icon, fields }: { title: string; icon: React.ReactNode; fields: { label: string; value: any }[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>{icon} {title}</div></div>
      <div style={{ display: "grid", gap: 10 }}>
        {fields.map(f => (
          <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{f.label}</span>
            <span style={{ fontSize: 13, color: f.value ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight: f.value ? 500 : 400 }}>
              {f.value || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 48, gridColumn: "1 / -1" }}>
      <div style={{ color: "var(--text-tertiary)", margin: "0 auto 12px" }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{title}</h3>
      <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{desc}</p>
    </div>
  );
}
