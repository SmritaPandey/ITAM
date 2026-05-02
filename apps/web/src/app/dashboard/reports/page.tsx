"use client";
import { useEffect, useState } from "react";
import {
  FileText, Download, BarChart3, PieChart as PieIcon, Calendar, Clock,
  Filter, TrendingUp, Package, Ticket, Shield, ChevronRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { apiFetch, getToken, getApiBase } from "@/lib/api";
import SafeChart from "@/components/SafeChart";

const REPORT_TEMPLATES = [
  { id: "inv", name: "Asset Inventory Summary", icon: <Package size={18} />, desc: "Full asset register with types, locations, and values", type: "Scheduled", frequency: "Weekly", lastRun: "Apr 28, 2026", format: "PDF", color: "#06b6d4" },
  { id: "patch", name: "Patch Compliance Report", icon: <Shield size={18} />, desc: "Security patch status across all endpoints", type: "Scheduled", frequency: "Monthly", lastRun: "Apr 1, 2026", format: "XLSX", color: "#10b981" },
  { id: "sla", name: "Ticket SLA Performance", icon: <Ticket size={18} />, desc: "Response and resolution times vs SLA targets", type: "On-demand", frequency: "—", lastRun: "Apr 25, 2026", format: "PDF", color: "#8b5cf6" },
  { id: "license", name: "License Utilization", icon: <FileText size={18} />, desc: "Software license usage and renewal forecasts", type: "Scheduled", frequency: "Quarterly", lastRun: "Mar 31, 2026", format: "PDF", color: "#f59e0b" },
  { id: "fleet", name: "Fleet Telemetry Summary", icon: <TrendingUp size={18} />, desc: "GPS tracking, mileage, and maintenance alerts", type: "On-demand", frequency: "—", lastRun: "Apr 20, 2026", format: "PDF", color: "#ef4444" },
  { id: "audit", name: "Audit Trail Export", icon: <Clock size={18} />, desc: "Full audit log with SHA-256 hash chain verification", type: "On-demand", frequency: "—", lastRun: "Apr 29, 2026", format: "CSV", color: "#3b82f6" },
];

const monthlyAssets = [
  { month: "Nov", created: 12, retired: 2 }, { month: "Dec", created: 8, retired: 5 },
  { month: "Jan", created: 15, retired: 3 }, { month: "Feb", created: 10, retired: 4 },
  { month: "Mar", created: 18, retired: 6 }, { month: "Apr", created: 7, retired: 1 },
];

const ticketTrend = [
  { month: "Nov", opened: 25, closed: 22 }, { month: "Dec", opened: 18, closed: 20 },
  { month: "Jan", opened: 30, closed: 28 }, { month: "Feb", opened: 22, closed: 25 },
  { month: "Mar", opened: 35, closed: 30 }, { month: "Apr", opened: 15, closed: 12 },
];

const costBreakdown = [
  { name: "Hardware", value: 850000, color: "#06b6d4" },
  { name: "Software", value: 320000, color: "#8b5cf6" },
  { name: "Fleet", value: 2100000, color: "#10b981" },
  { name: "Facility", value: 180000, color: "#f59e0b" },
];

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [execReport, setExecReport] = useState<any>(null);

  useEffect(() => {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${getApiBase()}/assets/dashboard`, { headers }).then(r => r.json()),
      fetch(`${getApiBase()}/reports/executive`, { headers }).then(r => r.json()),
    ]).then(([s, e]) => { setStats(s); setExecReport(e); }).catch(console.error);
  }, []);

  const totalCost = costBreakdown.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Scheduled and on-demand analytics reports</p>
        </div>
        <button className="btn btn-primary"><FileText size={14} /> Create Report</button>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card"><div className="stat-icon cyan"><BarChart3 size={22} /></div><div className="stat-content"><div className="stat-label">Reports Generated</div><div className="stat-value">47</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><Calendar size={22} /></div><div className="stat-content"><div className="stat-label">Scheduled</div><div className="stat-value">3</div></div></div>
        <div className="stat-card"><div className="stat-icon purple"><Download size={22} /></div><div className="stat-content"><div className="stat-label">Downloads This Month</div><div className="stat-value">12</div></div></div>
        <div className="stat-card"><div className="stat-icon amber"><TrendingUp size={22} /></div><div className="stat-content"><div className="stat-label">Total Asset Value</div><div className="stat-value">₹{(totalCost / 100000).toFixed(1)}L</div></div></div>
      </div>

      {/* Charts */}
      <div className="charts-grid-equal" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Asset Lifecycle (6 Months)</div><div className="card-subtitle">Assets created vs retired</div></div>
          </div>
          <SafeChart height={220}>
<BarChart data={monthlyAssets} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="created" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Created" />
                <Bar dataKey="retired" fill="#ef4444" radius={[4, 4, 0, 0]} name="Retired" />
              </BarChart>
</SafeChart>
        </div>
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Cost Distribution</div><div className="card-subtitle">Total: ₹{(totalCost / 100000).toFixed(1)} Lakhs</div></div>
          </div>
          <SafeChart height={220}>
<PieChart>
                <Pie data={costBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                  {costBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `₹${(Number(v) / 1000).toFixed(0)}K`} />
              </PieChart>
</SafeChart>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {costBreakdown.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-secondary)" }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: d.color, display: "inline-block" }} />
                {d.name} (₹{(d.value / 1000).toFixed(0)}K)
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket Trend */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div><div className="card-title">Ticket Volume (6 Months)</div><div className="card-subtitle">Opened vs closed</div></div>
        </div>
        <SafeChart height={180}>
<AreaChart data={ticketTrend}>
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
              <Area type="monotone" dataKey="closed" stroke="#10b981" fill="url(#closeGrad)" strokeWidth={2} name="Closed" />
            </AreaChart>
</SafeChart>
      </div>

      {/* Report Templates */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>Report Templates</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 12 }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }}><Download size={11} /> Export</button>
              <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>Last: {r.lastRun}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
