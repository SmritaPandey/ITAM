"use client";
import { useEffect, useState } from "react";
import {
  FileText, Download, BarChart3, PieChart as PieIcon, Calendar, Clock,
  Filter, TrendingUp, Package, Ticket, Shield, ChevronRight, Loader2, AlertTriangle,
  FileSpreadsheet, FileDown, Network, Activity, ClipboardList
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Enterprise reporting powered by live data — 8 report types</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
          />
          <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>to</span>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
          />
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, padding: "12px 16px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}>
          <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}><AlertTriangle size={14} style={{ verticalAlign: "middle" }} /> {error}</span>
        </div>
      )}

      {/* Quick Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card"><div className="stat-icon cyan"><Package size={22} /></div><div className="stat-content"><div className="stat-label">Total Assets</div><div className="stat-value">{totalAssets}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><Ticket size={22} /></div><div className="stat-content"><div className="stat-label">Open Tickets</div><div className="stat-value">{openTickets}</div></div></div>
        <div className="stat-card"><div className="stat-icon purple"><Clock size={22} /></div><div className="stat-content"><div className="stat-label">Avg Resolution</div><div className="stat-value">{avgResHours}h</div></div></div>
        <div className="stat-card"><div className="stat-icon amber"><TrendingUp size={22} /></div><div className="stat-content"><div className="stat-label">Total Asset Value</div><div className="stat-value">₹{totalAssetValue > 100000 ? `${(totalAssetValue / 100000).toFixed(1)}L` : totalAssetValue.toLocaleString()}</div></div></div>
      </div>

      {/* Charts */}
      <div className="charts-grid-equal" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><div><div className="card-title">Asset Lifecycle (6 Months)</div><div className="card-subtitle">Assets created per month</div></div></div>
          {assetLifecycle.length > 0 ? (
            <SafeChart height={220}>
              <BarChart data={assetLifecycle} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="created" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Created" />
              </BarChart>
            </SafeChart>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
              <BarChart3 size={16} style={{ marginRight: 6 }} /> No asset trend data yet
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">Assets by Category</div><div className="card-subtitle">{totalAssets} total assets</div></div></div>
          {costData.length > 0 ? (
            <>
              <SafeChart height={220}>
                <PieChart>
                  <Pie data={costData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                    {costData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </SafeChart>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {costData.map((d: any) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-secondary)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: d.color, display: "inline-block" }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No category data</div>
          )}
        </div>
      </div>

      {/* Ticket Trend */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div><div className="card-title">Ticket Volume (6 Months)</div><div className="card-subtitle">Opened vs resolved</div></div></div>
        {ticketVolume.length > 0 ? (
          <SafeChart height={180}>
            <AreaChart data={ticketVolume}>
              <defs>
                <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                <linearGradient id="closeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="opened" stroke="#8b5cf6" fill="url(#openGrad)" strokeWidth={2} name="Opened" />
              <Area type="monotone" dataKey="closed" stroke="#10b981" fill="url(#closeGrad)" strokeWidth={2} name="Resolved" />
            </AreaChart>
          </SafeChart>
        ) : (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No ticket trend data yet</div>
        )}
      </div>

      {/* Report Templates — Real Backend Export */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>Export Reports</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 12 }}>
        {REPORT_TYPES.map(r => (
          <div key={r.id} className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: `${r.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center", color: r.color, flexShrink: 0,
            }}>{r.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>{r.desc}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {r.formats.map(fmt => (
                  <button key={fmt} className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10, gap: 3 }}
                    onClick={() => downloadReport(r.id, fmt)}
                    disabled={downloading === `${r.id}-${fmt}`}
                  >
                    {downloading === `${r.id}-${fmt}` ? (
                      <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
                    ) : fmt === "xlsx" ? (
                      <FileSpreadsheet size={10} />
                    ) : (
                      <FileDown size={10} />
                    )}
                    {fmt.toUpperCase()}
                  </button>
                ))}
                <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }}
                  onClick={() => previewReportData(r.id)}>
                  <ChevronRight size={10} /> Preview
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {(previewReport || previewLoading) && (
        <>
          <div onClick={() => setPreviewReport(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(900px, 92vw)", maxHeight: "80vh", background: "var(--bg-card)",
            zIndex: 1001, borderRadius: 12, border: "1px solid var(--border-primary)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{previewReport?.title || "Loading..."}</h3>
              <button onClick={() => setPreviewReport(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {previewLoading ? (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : previewReport?.headers ? (
                <>
                  {previewReport.summary && (
                    <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                      {Object.entries(previewReport.summary).filter(([, v]) => typeof v === "number" || typeof v === "string").slice(0, 6).map(([k, v]) => (
                        <div key={k} className="card" style={{ padding: "8px 14px", flex: "1 1 120px" }}>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>{typeof v === "number" && v > 10000 ? `${(v as number / 1000).toFixed(1)}K` : String(v)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <table className="data-table" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>{previewReport.headers.map((h: string) => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(previewReport.rows || []).slice(0, 50).map((row: string[], i: number) => (
                        <tr key={i}>{row.map((cell: string, j: number) => <td key={j}>{cell}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                  {(previewReport.rows?.length || 0) > 50 && (
                    <div style={{ textAlign: "center", padding: 12, color: "var(--text-tertiary)", fontSize: 11 }}>
                      Showing 50 of {previewReport.rows.length} rows. Download for full data.
                    </div>
                  )}
                </>
              ) : previewReport?.sections ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {Object.entries(previewReport.sections).map(([section, data]: [string, any]) => (
                    <div key={section} className="card" style={{ padding: 16 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize", marginBottom: 8 }}>{section}</h4>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {Object.entries(data).filter(([, v]) => typeof v === "number" || typeof v === "string").map(([k, v]) => (
                          <div key={k} style={{ flex: "1 1 100px" }}>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</div>
                            <div style={{ fontSize: 16, fontWeight: 600 }}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No data available</div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
