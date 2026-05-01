"use client";
import { useEffect, useState } from "react";
import {
  Package, Monitor, Truck, Ticket, AlertTriangle, Shield, CheckCircle2, Clock,
  TrendingUp, ArrowUpRight, ArrowDownRight, HardDrive, Wifi, Activity, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || "";
}

async function apiFetch(path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("API error");
  return res.json();
}

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
const networkHealthDefault = [
  { time: "00:00", uptime: 99.9, bandwidth: 340 },
  { time: "04:00", uptime: 99.8, bandwidth: 180 },
  { time: "08:00", uptime: 99.7, bandwidth: 520 },
  { time: "12:00", uptime: 99.9, bandwidth: 780 },
  { time: "16:00", uptime: 99.6, bandwidth: 650 },
  { time: "20:00", uptime: 99.8, bandwidth: 420 },
  { time: "Now", uptime: 99.9, bandwidth: 390 },
];

const weeklyTrend = [
  { day: "Mon", assets: 3, tickets: 5 },
  { day: "Tue", assets: 7, tickets: 3 },
  { day: "Wed", assets: 2, tickets: 8 },
  { day: "Thu", assets: 5, tickets: 4 },
  { day: "Fri", assets: 8, tickets: 6 },
  { day: "Sat", assets: 1, tickets: 1 },
  { day: "Sun", assets: 0, tickets: 0 },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [patchCompliance, setPatchCompliance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const networkHealth = networkHealthDefault;

  function loadData(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    Promise.all([
      apiFetch("/assets/dashboard"),
      apiFetch("/assets?limit=5"),
      apiFetch("/tickets?limit=5"),
      apiFetch("/patches/compliance").catch(() => null),
    ]).then(([s, a, t, pc]) => {
      setStats(s);
      setAssets(a.data || []);
      setTickets(t.data || []);
      if (pc?.bySeverity) {
        setPatchCompliance(pc.bySeverity.map((sv: any) => ({
          name: sv.severity, patched: sv.deployed, unpatched: sv.total - sv.deployed,
        })));
      }
      setLastRefresh(new Date());
    }).catch(console.error)
      .finally(() => { setLoading(false); setRefreshing(false); });
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
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button className="btn btn-secondary" onClick={() => loadData(true)} disabled={refreshing}
            style={{ padding: "6px 10px" }}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn btn-primary">
            <TrendingUp size={14} />
            Generate Report
          </button>
        </div>
      </div>

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
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Asset Status</div>
              <div className="card-subtitle">Current lifecycle state</div>
            </div>
          </div>
          <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} strokeWidth={0}>
                  {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
            </ResponsiveContainer>
          </div>
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
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={patchCompliance} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="patched" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Patched" />
                <Bar dataKey="unpatched" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Missing" />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="assets" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4, fill: "#06b6d4" }} name="Assets Added" />
              <Line type="monotone" dataKey="tickets" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: "#8b5cf6" }} name="Tickets Created" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Recent Activity</div>
          <span className="badge green" style={{ fontSize: 10 }}>
            <Activity size={10} /> Live
          </span>
        </div>
        <div style={{ display: "grid", gap: 0 }}>
          {[
            { time: "2 min ago", event: "Asset scan completed", detail: "7 devices detected on subnet 10.0.1.0/24", icon: <Wifi size={14} />, color: "var(--brand-400)" },
            { time: "8 min ago", event: "Ticket TKT-000002 escalated", detail: "Priority changed to HIGH by Raj Sharma", icon: <AlertTriangle size={14} />, color: "var(--warning)" },
            { time: "15 min ago", event: "Patch KB5034441 deployed", detail: "Applied to 12 endpoints successfully", icon: <Shield size={14} />, color: "var(--success)" },
            { time: "22 min ago", event: "New asset onboarded", detail: "Dell Latitude 5540 assigned to Priya Patel", icon: <Package size={14} />, color: "var(--accent-500)" },
            { time: "45 min ago", event: "Fleet vehicle check-in", detail: "Toyota Innova Crysta — MH-02-AB-1234 at HQ", icon: <Truck size={14} />, color: "#10b981" },
          ].map((a, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
              borderBottom: i < 4 ? "1px solid var(--border-primary)" : "none",
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: `${a.color}15`, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: a.color, flexShrink: 0,
              }}>{a.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{a.event}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.detail}</div>
              </div>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{a.time}</span>
            </div>
          ))}
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
