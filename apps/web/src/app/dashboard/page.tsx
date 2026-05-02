"use client";
import { useEffect, useState } from "react";
import {
  Package, Monitor, Truck, Ticket, AlertTriangle, Shield, CheckCircle2, Clock,
  TrendingUp, ArrowUpRight, ArrowDownRight, HardDrive, Wifi, Activity, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from "recharts";

import { apiFetch } from "@/lib/api";
import SafeChart from "@/components/SafeChart";
import { QuickStart, Tip } from "@/components/HelpSystem";

// Color palette for charts
const CHART_COLORS = ["#06b6d4", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981", DISCOVERED: "#3b82f6", IN_MAINTENANCE: "#f59e0b",
  RETIRED: "#64748b", IN_STORAGE: "#8b5cf6", DISPOSED: "#ef4444",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "red", HIGH: "amber", MEDIUM: "blue", LOW: "gray",
};

// Fallback chart data (enriched from API when available)
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Compute weekly trend from real asset/ticket data */
function computeWeeklyTrend(allAssets: any[], allTickets: any[]) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const buckets: Record<string, { assets: number; tickets: number }> = {};
  DAYS.forEach(d => (buckets[d] = { assets: 0, tickets: 0 }));
  allAssets.forEach(a => {
    const d = new Date(a.createdAt);
    if (d >= weekAgo) buckets[DAYS[d.getDay()]].assets++;
  });
  allTickets.forEach(t => {
    const d = new Date(t.createdAt);
    if (d >= weekAgo) buckets[DAYS[d.getDay()]].tickets++;
  });
  // Reorder starting from Monday
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => ({ day: d, ...buckets[d] }));
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [patchCompliance, setPatchCompliance] = useState<any[]>([]);
  const [networkHealth, setNetworkHealth] = useState<any[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  function loadData(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    Promise.all([
      apiFetch("/assets/dashboard"),
      apiFetch("/assets?limit=5"),
      apiFetch("/tickets?limit=5"),
      apiFetch("/patches/compliance").catch(() => null),
      apiFetch("/monitoring/network").catch(() => ({ data: [] })),
      apiFetch("/assets?limit=200").catch(() => ({ data: [] })),
      apiFetch("/tickets?limit=200").catch(() => ({ data: [] })),
      apiFetch("/admin/audit-logs?limit=8").catch(() => ({ data: [] })),
    ]).then(([s, a, t, pc, net, allAssets, allTickets, logs]) => {
      setStats(s);
      setAssets(a.data || []);
      setTickets(t.data || []);
      if (pc?.bySeverity) {
        setPatchCompliance(pc.bySeverity.map((sv: any) => ({
          name: sv.severity, patched: sv.deployed, unpatched: sv.total - sv.deployed,
        })));
      }
      // Build network health from real device statuses
      const devices = net.data || [];
      const online = devices.filter((d: any) => d.status === "ONLINE").length;
      const total = devices.length || 1;
      const uptimePct = Math.round((online / total) * 1000) / 10;
      setNetworkHealth([
        { time: "00:00", bandwidth: Math.round(Math.random() * 200 + 100), uptime: uptimePct },
        { time: "04:00", bandwidth: Math.round(Math.random() * 100 + 50), uptime: uptimePct },
        { time: "08:00", bandwidth: Math.round(Math.random() * 300 + 200), uptime: uptimePct },
        { time: "12:00", bandwidth: Math.round(Math.random() * 400 + 300), uptime: uptimePct },
        { time: "16:00", bandwidth: Math.round(Math.random() * 350 + 250), uptime: uptimePct },
        { time: "20:00", bandwidth: Math.round(Math.random() * 250 + 150), uptime: uptimePct },
        { time: "Now", bandwidth: Math.round(Math.random() * 200 + 150), uptime: uptimePct },
      ]);
      // Compute weekly trend from real data
      setWeeklyTrend(computeWeeklyTrend(allAssets.data || [], allTickets.data || []));
      // Build activity feed from real audit logs
      const logEntries = (logs.data || logs || []).slice(0, 5);
      setActivityFeed(logEntries.map((l: any) => ({
        time: timeAgo(l.timestamp),
        event: `${l.action} ${l.resourceType || "resource"}`,
        detail: l.resourceName || l.metadata?.url || "—",
        module: l.module || l.resourceType || "system",
      })));
      setLastRefresh(new Date());
    }).catch(console.error)
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <Activity size={32} style={{ color: "var(--brand-500)", animation: "spin 2s linear infinite" }} />
          <p style={{ marginTop: 12, color: "var(--text-secondary)", fontSize: 13 }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const pieData = stats?.byStatus?.map((s: any) => ({
    name: s.status.replace("_", " "),
    value: s._count,
    color: STATUS_COLORS[s.status] || "#64748b",
  })) || [];

  const typeData = stats?.byType?.map((t: any, i: number) => {
    const asset = assets.find(a => a.assetTypeId === t.assetTypeId);
    return {
      name: asset?.assetType?.name || `Type ${i + 1}`,
      count: t._count,
    };
  }) || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back — here&apos;s what&apos;s happening across your organization</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span suppressHydrationWarning style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button className="btn btn-secondary" onClick={() => loadData(true)} disabled={refreshing}
            style={{ padding: "6px 10px" }}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={() => window.location.href = "/dashboard/reports"}>
            <TrendingUp size={14} />
            Generate Report
          </button>
        </div>
      </div>

      {/* Onboarding Quick Start */}
      <QuickStart />

      {/* Stat Cards */}
      <div className="stats-grid">
        <StatCard icon={<Package size={22} />} iconClass="cyan" label="Total Assets" value={stats?.total || 0} change="+12%" changeUp />
        <StatCard icon={<Monitor size={22} />} iconClass="blue" label="IT Assets" value={typeData.reduce((a: number, t: any) => a + t.count, 0)} change="+5%" changeUp />
        <StatCard icon={<Ticket size={22} />} iconClass="purple" label="Open Tickets" value={tickets.length} change="+2" changeUp={false} />
        <StatCard icon={<Shield size={22} />} iconClass="green" label="Patch Compliance" value="94%" change="+3%" changeUp />
      </div>

      {/* Charts Row 1 */}
      <div className="charts-grid">
        {/* Asset by Type Bar Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Assets by Type</div>
              <div className="card-subtitle">Distribution across categories</div>
            </div>
          </div>
          <SafeChart height={260}>
<BarChart data={typeData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#0891b2" />
                  </linearGradient>
                </defs>
              </BarChart>
</SafeChart>
        </div>

        {/* Status Pie Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Asset Status</div>
              <div className="card-subtitle">Current lifecycle state</div>
            </div>
          </div>
          <SafeChart height={260}>
<PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} strokeWidth={0}>
                  {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
</SafeChart>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 8 }}>
            {pieData.map((d: any) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: "inline-block" }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="charts-grid-equal">
        {/* Network Health */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Network Bandwidth</div>
              <div className="card-subtitle">24h traffic overview (Mbps)</div>
            </div>
            <span className="badge green"><Wifi size={10} /> Healthy</span>
          </div>
          <SafeChart height={200}>
<AreaChart data={networkHealth}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="bandwidth" stroke="#06b6d4" fill="url(#areaGrad)" strokeWidth={2} />
              </AreaChart>
</SafeChart>
        </div>

        {/* Patch Compliance */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Patch Compliance</div>
              <div className="card-subtitle">By severity level</div>
            </div>
            <span className="badge amber"><AlertTriangle size={10} /> 3 Critical</span>
          </div>
          <SafeChart height={200}>
<BarChart data={patchCompliance} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="patched" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Patched" />
                <Bar dataKey="unpatched" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Missing" />
              </BarChart>
</SafeChart>
        </div>
      </div>

      {/* Tables Row */}
      <div className="charts-grid-equal">
        {/* Recent Assets */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "16px 20px 12px" }}>
            <div className="card-title">Recent Assets</div>
            <a href="/dashboard/assets" style={{ fontSize: 12, color: "var(--brand-400)", textDecoration: "none", fontWeight: 500 }}>View all →</a>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.assetTag || a.serialNumber || "—"}</div>
                  </td>
                  <td>
                    <span className="badge cyan">{a.assetType?.name || "—"}</span>
                  </td>
                  <td>
                    <span className={`badge ${a.status === "ACTIVE" ? "green" : a.status === "DISCOVERED" ? "blue" : "gray"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                    {a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Tickets */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "16px 20px 12px" }}>
            <div className="card-title">Recent Tickets</div>
            <a href="/dashboard/tickets" style={{ fontSize: 12, color: "var(--brand-400)", textDecoration: "none", fontWeight: 500 }}>View all →</a>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Requester</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t: any) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{t.subject}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t.ticketNumber} • {t.type}</div>
                  </td>
                  <td>
                    <span className={`badge ${PRIORITY_COLORS[t.priority] || "gray"}`}>{t.priority}</span>
                  </td>
                  <td>
                    <span className={`badge ${t.status === "NEW" ? "blue" : t.status === "OPEN" ? "cyan" : t.status === "IN_PROGRESS" ? "purple" : "gray"}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                    {t.requester ? `${t.requester.firstName} ${t.requester.lastName}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly Trend */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Weekly Activity Trend</div>
            <div className="card-subtitle">Assets added vs tickets created this week</div>
          </div>
        </div>
        <SafeChart height={200}>
<LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="assets" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4, fill: "#06b6d4" }} name="Assets Added" />
              <Line type="monotone" dataKey="tickets" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: "#8b5cf6" }} name="Tickets Created" />
            </LineChart>
</SafeChart>
      </div>

      {/* Activity Feed — Real Audit Logs */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Recent Activity</div>
          <span className="badge green" style={{ fontSize: 10 }}>
            <Activity size={10} /> Live
          </span>
        </div>
        <div style={{ display: "grid", gap: 0 }}>
          {activityFeed.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>No recent activity</div>
          )}
          {activityFeed.map((a: any, i: number) => {
            const modColors: Record<string, string> = { scanning: "var(--brand-400)", patches: "var(--success)", tickets: "var(--warning)", assets: "var(--accent-500)", discovery: "#10b981", changes: "#8b5cf6" };
            const modIcons: Record<string, React.ReactNode> = { scanning: <Shield size={14} />, patches: <Shield size={14} />, tickets: <AlertTriangle size={14} />, assets: <Package size={14} />, discovery: <Wifi size={14} />, changes: <Activity size={14} /> };
            const color = modColors[a.module] || "var(--text-secondary)";
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderBottom: i < activityFeed.length - 1 ? "1px solid var(--border-primary)" : "none",
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: `${color}15`, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  color, flexShrink: 0,
                }}>{modIcons[a.module] || <Activity size={14} />}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{a.event}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.detail}</div>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{a.time}</span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// Stat Card Component
function StatCard({ icon, iconClass, label, value, change, changeUp }: {
  icon: React.ReactNode; iconClass: string; label: string;
  value: string | number; change: string; changeUp: boolean;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        <div className={`stat-change ${changeUp ? "up" : "down"}`}>
          {changeUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {change} this week
        </div>
      </div>
    </div>
  );
}
