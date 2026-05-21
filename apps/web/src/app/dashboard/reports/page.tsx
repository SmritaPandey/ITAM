"use client";
import { useEffect, useState } from "react";
import {
  FileText, Download, BarChart3, PieChart as PieIcon, Calendar, Clock,
  Filter, TrendingUp, Package, Ticket, Shield, ChevronRight, Loader2, AlertTriangle,
  FileSpreadsheet, FileDown, Network, Activity, ClipboardList, X, Play, Eye
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { apiFetch } from "@/lib/api";
import SafeChart from "@/components/SafeChart";

const REPORT_TYPES = [
  { id: "assets", name: "Asset Inventory", icon: <Package size={18} />, desc: "Full asset register with types, sites, and values", color: "#06b6d4", formats: ["csv", "xlsx"] },
  { id: "tickets", name: "Ticket SLA Performance", icon: <Ticket size={18} />, desc: "Response and resolution times vs SLA targets", color: "#8b5cf6", formats: ["csv", "xlsx"] },
  { id: "licenses", name: "License Utilization", icon: <FileText size={18} />, desc: "Software license usage, compliance, and renewals", color: "#f59e0b", formats: ["csv", "xlsx"] },
  { id: "network", name: "Network Health", icon: <Network size={18} />, desc: "Device status, CPU, memory, latency, and uptime", color: "#10b981", formats: ["csv", "xlsx"] },
  { id: "patches", name: "Patch Compliance", icon: <Shield size={18} />, desc: "Security patch status across all endpoints", color: "#ef4444", formats: ["csv", "xlsx"] },
  { id: "audit", name: "Audit Trail", icon: <Clock size={18} />, desc: "Full audit log with hash chain verification", color: "#3b82f6", formats: ["csv", "xlsx"] },
  { id: "executive", name: "Executive Summary", icon: <BarChart3 size={18} />, desc: "Cross-module KPI summary for leadership", color: "#ec4899", formats: ["csv"] },
  { id: "compliance", name: "Endpoint Compliance", icon: <ClipboardList size={18} />, desc: "Policy violations and endpoint security posture", color: "#14b8a6", formats: ["csv", "xlsx"] },
];

const CAT_COLORS: Record<string, string> = {
  Hardware: "#06b6d4", Software: "#8b5cf6", Fleet: "#10b981", Facility: "#f59e0b",
  IT: "#06b6d4", "Non-IT": "#f59e0b", Vehicle: "#10b981", Other: "#64748b",
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [execReport, setExecReport] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [previewReport, setPreviewReport] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch("/reports/executive"),
      apiFetch("/reports/trend"),
    ]).then(([exec, trend]) => {
      setExecReport(exec);
      setTrendData(Array.isArray(trend) ? trend : []);
    }).catch(err => {
      console.error(err);
      setError("Failed to load report data");
    }).finally(() => setLoading(false));
  }, []);

  async function downloadReport(type: string, format: string) {
    setDownloading(`${type}-${format}`);
    try {
      const params = new URLSearchParams({ format });
      if (dateRange.start) params.set("startDate", dateRange.start);
      if (dateRange.end) params.set("endDate", dateRange.end);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1"}/reports/download/${type}?${params}`, {
        headers: { Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""}` },
      });
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_report_${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(null);
    }
  }

  async function previewReportData(type: string) {
    setPreviewLoading(true);
    setPreviewReport(null);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set("startDate", dateRange.start);
      if (dateRange.end) params.set("endDate", dateRange.end);
      const data = await apiFetch(`/reports/generate/${type}?${params}`);
      setPreviewReport({ type, ...data });
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const assets = execReport?.assets || {};
  const tickets = execReport?.tickets || {};
  const licenses = execReport?.licenses || {};

  const assetLifecycle = trendData.map(d => ({ month: d.month, created: d.assetsAdded || 0 }));
  const ticketVolume = trendData.map(d => ({ month: d.month, opened: d.created || 0, closed: d.resolved || 0 }));
  const costData = (assets.byType || []).map((t: any, i: number) => ({
    name: t.category || "Other", value: t.count || 0,
    color: Object.values(CAT_COLORS)[i % Object.values(CAT_COLORS).length],
  })).filter((d: any) => d.value > 0);

  const totalAssetValue = assets.totalValue || 0;
  const totalAssets = assets.total || 0;
  const openTickets = tickets.open || 0;
  const avgResHours = tickets.avgResolutionHours || 0;

  return (
    <>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Reports & Analytics</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Enterprise reports powered by real-time infrastructure logs</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "6px 12px", borderRadius: 12, border: "1px solid var(--border-primary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={13} style={{ color: "var(--text-tertiary)" }} />
            <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
              style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
              className="date-focus"
            />
          </div>
          <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }}>to</span>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
            style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
            className="date-focus"
          />
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 20, padding: "14px 18px", border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.05)", borderRadius: 12 }}>
          <span style={{ color: "#f87171", fontSize: 13, fontWeight: 650, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} /> {error}
          </span>
        </div>
      )}

      {/* Cyberpunk Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid var(--border-primary)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden"
        }}>
          <div style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#22d3ee" }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Assets</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>{totalAssets}</div>
          </div>
        </div>

        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid var(--border-primary)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden"
        }}>
          <div style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa" }}>
            <Ticket size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Open Tickets</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>{openTickets}</div>
          </div>
        </div>

        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid var(--border-primary)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden"
        }}>
          <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Resolution</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>{avgResHours}h</div>
          </div>
        </div>

        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid var(--border-primary)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden"
        }}>
          <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24" }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Asset Value</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>₹{totalAssetValue > 100000 ? `${(totalAssetValue / 100000).toFixed(1)}L` : totalAssetValue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Sections */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="charts-grid-equal">
        {/* Chart 1: Asset Lifecycle */}
        <div className="card" style={{ padding: 24, borderRadius: 16, border: "1px solid var(--border-primary)", background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15,23,42,0.2) 100%)" }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Asset Lifecycle Progression</h3>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>Volume of hardware assets provisioned monthly</p>
          </div>
          {assetLifecycle.length > 0 ? (
            <SafeChart height={220}>
              <BarChart data={assetLifecycle} barSize={14}>
                <defs>
                  <linearGradient id="barCyanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgba(17, 24, 39, 0.95)", border: "1px solid var(--brand-500)", borderRadius: 10, fontSize: 12, boxShadow: "0 0 15px rgba(6,182,212,0.12)" }} />
                <Bar dataKey="created" fill="url(#barCyanGrad)" radius={[4, 4, 0, 0]} name="Created Assets" />
              </BarChart>
            </SafeChart>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
              <BarChart3 size={16} style={{ marginRight: 6 }} /> No asset trend data yet
            </div>
          )}
        </div>

        {/* Chart 2: Category Distribution */}
        <div className="card" style={{ padding: 24, borderRadius: 16, border: "1px solid var(--border-primary)", background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15,23,42,0.2) 100%)" }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Infrastructure Composition</h3>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>Distribution by classification categories</p>
          </div>
          {costData.length > 0 ? (
            <>
              <SafeChart height={180}>
                <PieChart>
                  <Pie data={costData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} strokeWidth={0}>
                    {costData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "rgba(17, 24, 39, 0.95)", border: "1px solid var(--border-secondary)", borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </SafeChart>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                {costData.map((d: any) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, display: "inline-block" }} />
                    {d.name} <span style={{ color: "var(--text-tertiary)" }}>({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No category data</div>
          )}
        </div>
      </div>

      {/* Chart 3: Ticket Performance Area */}
      <div className="card" style={{ padding: 24, borderRadius: 16, border: "1px solid var(--border-primary)", background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15,23,42,0.2) 100%)", marginBottom: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Operations Ticket Flow Volume</h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>SLA tickets opened vs resolved monthly progression</p>
        </div>
        {ticketVolume.length > 0 ? (
          <SafeChart height={200}>
            <AreaChart data={ticketVolume}>
              <defs>
                <linearGradient id="openPurpleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="closeGreenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "rgba(17, 24, 39, 0.95)", border: "1px solid var(--border-secondary)", borderRadius: 10, fontSize: 12 }} />
              <Area type="monotone" dataKey="opened" stroke="#8b5cf6" fill="url(#openPurpleGrad)" strokeWidth={2} name="Opened" />
              <Area type="monotone" dataKey="closed" stroke="#10b981" fill="url(#closeGreenGrad)" strokeWidth={2} name="Resolved" />
            </AreaChart>
          </SafeChart>
        ) : (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No ticket trend data yet</div>
        )}
      </div>

      {/* Report Templates Export Panel */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Export Report Center</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
        {REPORT_TYPES.map(r => (
          <div key={r.id} className="report-export-card" style={{
            display: "flex", gap: 14, alignItems: "flex-start", padding: 20, borderRadius: 16,
            border: "1px solid var(--border-primary)", background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.45) 100%)",
            transition: "all 0.2s"
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: `${r.color}18`,
              display: "flex", alignItems: "center", justifyContent: "center", color: r.color, flexShrink: 0,
              border: `1px solid ${r.color}35`
            }}>{r.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 750, color: "var(--text-primary)", marginBottom: 4 }}>{r.name}</div>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 12px", lineHeight: 1.4 }}>{r.desc}</p>
              
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {r.formats.map(fmt => (
                  <button key={fmt} className="btn-format-chip" style={{
                    padding: "6px 12px", fontSize: 11, borderRadius: 8, display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-primary)",
                    color: "var(--text-secondary)", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                  }}
                    onClick={() => downloadReport(r.id, fmt)}
                    disabled={downloading === `${r.id}-${fmt}`}
                  >
                    {downloading === `${r.id}-${fmt}` ? (
                      <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                    ) : fmt === "xlsx" ? (
                      <FileSpreadsheet size={12} style={{ color: "#34d399" }} />
                    ) : (
                      <FileDown size={12} style={{ color: "#22d3ee" }} />
                    )}
                    {fmt.toUpperCase()}
                  </button>
                ))}
                
                <button className="btn-format-chip" style={{
                  padding: "6px 12px", fontSize: 11, borderRadius: 8, display: "flex", alignItems: "center", gap: 5,
                  background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                }}
                  onClick={() => previewReportData(r.id)}>
                  <Eye size={12} /> Preview
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Backdrop Blurred Modal */}
      {(previewReport || previewLoading) && (
        <>
          <div onClick={() => setPreviewReport(null)} style={{
            position: "fixed", inset: 0, background: "rgba(5, 7, 14, 0.7)", zIndex: 1000,
            backdropFilter: "blur(12px)", animation: "fadeInBg 0.25s ease-out"
          }} />
          
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(880px, 94vw)", maxHeight: "85vh", background: "linear-gradient(135deg, #111827 0%, #0c0f1d 100%)",
            zIndex: 1001, borderRadius: 16, border: "1px solid var(--border-primary)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 20px rgba(6,182,212,0.06)",
            animation: "modalZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
          }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {previewReport?.title || "Report Preview Live Feed"}
              </h3>
              <button onClick={() => setPreviewReport(null)} style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
                borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s"
              }} className="modal-close-btn">
                <X size={15} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {previewLoading ? (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : previewReport?.headers ? (
                <>
                  {previewReport.summary && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
                      {Object.entries(previewReport.summary).filter(([, v]) => typeof v === "number" || typeof v === "string").slice(0, 6).map(([k, v]) => (
                        <div key={k} className="card" style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-primary)" }}>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{k.replace(/([A-Z])/g, " $1")}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: "var(--text-primary)" }}>
                            {typeof v === "number" && (v as number) > 100000 ? `₹${(v as number / 1000).toFixed(0)}K` : String(v)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border-primary)" }}>
                    <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.01)", borderBottom: "1px solid var(--border-primary)" }}>
                          {previewReport.headers.map((h: string) => (
                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.04em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(previewReport.rows || []).slice(0, 50).map((row: string[], i: number) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border-primary)", background: i % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                            {row.map((cell: string, j: number) => (
                              <td key={j} style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {(previewReport.rows?.length || 0) > 50 && (
                    <div style={{ textAlign: "center", padding: 14, color: "var(--text-tertiary)", fontSize: 12, fontWeight: 500 }}>
                      Showing 50 of {previewReport.rows.length} records. Download spreadsheet for full audit log.
                    </div>
                  )}
                </>
              ) : previewReport?.sections ? (
                <div style={{ display: "grid", gap: 16 }}>
                  {Object.entries(previewReport.sections).map(([section, data]: [string, any]) => (
                    <div key={section} className="card" style={{ padding: 20, borderRadius: 12, border: "1px solid var(--border-primary)", background: "rgba(255,255,255,0.02)" }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand-400)", marginBottom: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 6 }}>{section}</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                        {Object.entries(data).filter(([, v]) => typeof v === "number" || typeof v === "string").map(([k, v]) => (
                          <div key={k}>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>No dataset records available</div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        .date-focus:focus {
          border-color: var(--brand-400) !important;
          box-shadow: 0 0 10px rgba(6,182,212,0.15);
        }
        .report-export-card:hover {
          border-color: var(--border-secondary) !important;
          box-shadow: 0 6px 20px rgba(0,0,0,0.25);
        }
        .btn-format-chip:hover {
          background: var(--bg-card-hover) !important;
          border-color: var(--brand-500) !important;
          color: var(--text-primary) !important;
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
