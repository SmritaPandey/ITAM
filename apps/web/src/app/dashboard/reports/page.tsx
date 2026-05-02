"use client";
import { useEffect, useState } from "react";
import {
  FileText, Download, BarChart3, PieChart as PieIcon, Calendar, Clock,
  Filter, TrendingUp, Package, Ticket, Shield, ChevronRight, Loader2, AlertTriangle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { apiFetch } from "@/lib/api";
import SafeChart from "@/components/SafeChart";

const REPORT_TEMPLATES = [
  { id: "inv", name: "Asset Inventory Summary", icon: <Package size={18} />, desc: "Full asset register with types, locations, and values", type: "Scheduled", frequency: "Weekly", format: "PDF", color: "#06b6d4" },
  { id: "patch", name: "Patch Compliance Report", icon: <Shield size={18} />, desc: "Security patch status across all endpoints", type: "Scheduled", frequency: "Monthly", format: "XLSX", color: "#10b981" },
  { id: "sla", name: "Ticket SLA Performance", icon: <Ticket size={18} />, desc: "Response and resolution times vs SLA targets", type: "On-demand", frequency: "—", format: "PDF", color: "#8b5cf6" },
  { id: "license", name: "License Utilization", icon: <FileText size={18} />, desc: "Software license usage and renewal forecasts", type: "Scheduled", frequency: "Quarterly", format: "PDF", color: "#f59e0b" },
  { id: "fleet", name: "Fleet Telemetry Summary", icon: <TrendingUp size={18} />, desc: "GPS tracking, mileage, and maintenance alerts", type: "On-demand", frequency: "—", format: "PDF", color: "#ef4444" },
  { id: "audit", name: "Audit Trail Export", icon: <Clock size={18} />, desc: "Full audit log with SHA-256 hash chain verification", type: "On-demand", frequency: "—", format: "CSV", color: "#3b82f6" },
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

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // Derive chart data from real API
  const assets = execReport?.assets || {};
  const tickets = execReport?.tickets || {};
  const licenses = execReport?.licenses || {};

  // Asset lifecycle chart from trend data
  const assetLifecycle = trendData.map(d => ({
    month: d.month,
    created: d.assetsAdded || 0,
    retired: 0, // No retire tracking yet — show 0 instead of fake
  }));

  // Ticket volume chart from trend data
  const ticketVolume = trendData.map(d => ({
    month: d.month,
    opened: d.created || 0,
    closed: d.resolved || 0,
  }));

  // Cost breakdown from real asset categories
  const costData = (assets.byType || []).map((t: any, i: number) => ({
    name: t.category || "Other",
    value: t.count || 0,
    color: Object.values(CAT_COLORS)[i % Object.values(CAT_COLORS).length],
  })).filter((d: any) => d.value > 0);

  const totalAssetValue = assets.totalValue || 0;
  const totalAssets = assets.total || 0;
  const openTickets = tickets.open || 0;
  const avgResHours = tickets.avgResolutionHours || 0;
  const scheduledReports = REPORT_TEMPLATES.filter(r => r.type === "Scheduled").length;

  function downloadCSV(filename: string, headers: string[], rows: any[][]) {
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportReport(id: string) {
    switch (id) {
      case "inv":
        downloadCSV("asset_inventory.csv",
          ["Category", "Count"],
          (assets.byType || []).map((t: any) => [t.category || "Other", t.count]));
        break;
      case "sla":
        downloadCSV("ticket_sla.csv",
          ["Status", "Count"],
          (tickets.byStatus || []).map((s: any) => [s.status, s.count]));
        break;
      case "license":
        downloadCSV("license_utilization.csv",
          ["Total", "Compliant", "Over-used", "Expiring", "Total Spend"],
          [[licenses.total, licenses.compliant, licenses.overused, licenses.expiring, licenses.totalSpend]]);
        break;
      case "audit":
        apiFetch("/audit-logs?limit=500").then((d: any) => {
          downloadCSV("audit_trail.csv",
            ["Time", "User", "Action", "Resource", "IP"],
            (d.data || []).map((l: any) => [l.createdAt, l.userName || l.userId, l.action, l.resourceType, l.ipAddress || ""]));
        }).catch(console.error);
        break;
      default:
        downloadCSV(`report_${id}.csv`,
          ["Month", "Assets Added", "Tickets Opened", "Tickets Resolved"],
          trendData.map(d => [d.month, d.assetsAdded || 0, d.created || 0, d.resolved || 0]));
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Executive insights powered by live data</p>
        </div>
        <button className="btn btn-primary"><FileText size={14} /> Create Report</button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, padding: "12px 16px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}>
          <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}><AlertTriangle size={14} style={{ verticalAlign: "middle" }} /> {error}</span>
        </div>
      )}

      {/* Quick Stats — Real Data */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card"><div className="stat-icon cyan"><Package size={22} /></div><div className="stat-content"><div className="stat-label">Total Assets</div><div className="stat-value">{totalAssets}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><Ticket size={22} /></div><div className="stat-content"><div className="stat-label">Open Tickets</div><div className="stat-value">{openTickets}</div></div></div>
        <div className="stat-card"><div className="stat-icon purple"><Clock size={22} /></div><div className="stat-content"><div className="stat-label">Avg Resolution</div><div className="stat-value">{avgResHours}h</div></div></div>
        <div className="stat-card"><div className="stat-icon amber"><TrendingUp size={22} /></div><div className="stat-content"><div className="stat-label">Total Asset Value</div><div className="stat-value">₹{totalAssetValue > 100000 ? `${(totalAssetValue / 100000).toFixed(1)}L` : totalAssetValue.toLocaleString()}</div></div></div>
      </div>

      {/* Charts — Real API Data */}
      <div className="charts-grid-equal" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Asset Lifecycle (6 Months)</div><div className="card-subtitle">Assets created per month</div></div>
          </div>
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
          <div className="card-header">
            <div><div className="card-title">Assets by Category</div><div className="card-subtitle">{totalAssets} total assets</div></div>
          </div>
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
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
              No category data
            </div>
          )}
        </div>
      </div>

      {/* Ticket Trend — Real API Data */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div><div className="card-title">Ticket Volume (6 Months)</div><div className="card-subtitle">Opened vs resolved</div></div>
        </div>
        {ticketVolume.length > 0 ? (
          <SafeChart height={180}>
            <AreaChart data={ticketVolume}>
              <defs>
                <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="closeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
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
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
            No ticket trend data yet
          </div>
        )}
      </div>

      {/* Report Templates */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>Report Templates</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {REPORT_TEMPLATES.map(r => (
          <div key={r.id} className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: `${r.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center", color: r.color, flexShrink: 0,
            }}>{r.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>{r.desc}</div>
              <div style={{ display: "flex", gap: 6, fontSize: 10 }}>
                <span className={`badge ${r.type === "Scheduled" ? "cyan" : "purple"}`}>{r.type}</span>
                {r.frequency !== "—" && <span className="badge gray">{r.frequency}</span>}
                <span className="badge gray">{r.format}</span>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => exportReport(r.id)}><Download size={11} /> Export</button>
          </div>
        ))}
      </div>
    </>
  );
}
