"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package, Monitor, Truck, Ticket, AlertTriangle, Shield, CheckCircle2, Clock,
  TrendingUp, ArrowUpRight, ArrowDownRight, HardDrive, Wifi, Activity, RefreshCw,
  ExternalLink, Brain
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from "recharts";

import { apiFetch, apiFetchOptional } from "@/lib/api";
import SafeChart from "@/components/SafeChart";
import { QuickStart, Tip } from "@/components/HelpSystem";
import AiInsightCard from "@/components/AiInsightCard";
import TopRiskCard from "@/components/TopRiskCard";
import LicenseOptimizationCard from "@/components/LicenseOptimizationCard";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

// Color palette for charts
const CHART_COLORS = ["#06b6d4", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981", DISCOVERED: "#3b82f6", IN_MAINTENANCE: "#f59e0b",
  RETIRED: "#64748b", IN_STORAGE: "#8b5cf6", DISPOSED: "#ef4444",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "red", HIGH: "amber", MEDIUM: "blue", LOW: "gray",
};

/** Merge weeklyCreated buckets from assets + tickets dashboard APIs */
function mergeWeeklyTrend(assetBuckets?: { day: string; count: number }[], ticketBuckets?: { day: string; count: number }[]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const aMap = Object.fromEntries((assetBuckets || []).map((b) => [b.day, b.count]));
  const tMap = Object.fromEntries((ticketBuckets || []).map((b) => [b.day, b.count]));
  return days.map((day) => ({ day, assets: aMap[day] || 0, tickets: tMap[day] || 0 }));
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [patchCompliance, setPatchCompliance] = useState<any[]>([]);
  const [patchComplianceRaw, setPatchComplianceRaw] = useState<any>(null);
  const [networkHealth, setNetworkHealth] = useState<any[] | null>(null);
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [smartActions, setSmartActions] = useState<{ icon: string; label: string; href: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState("IT Admin");
  const [execKpis, setExecKpis] = useState<any>(null);
  const [vulnDash, setVulnDash] = useState<any>(null);
  const [fleetSummary, setFleetSummary] = useState<any>(null);
  const [facilitySummary, setFacilitySummary] = useState<any>(null);
  const [ticketStatsExtra, setTicketStatsExtra] = useState<any>(null);
  const loadGen = useRef(0);

  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  /** Critical path — paints KPI shell quickly */
  async function loadCritical(silent = false) {
    const gen = ++loadGen.current;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const [s, ticketStats, a, t] = await Promise.all([
      apiFetchOptional("/assets/dashboard"),
      apiFetchOptional("/tickets/stats"),
      apiFetchOptional("/assets?limit=5"),
      apiFetchOptional("/tickets?limit=5"),
    ]);

    if (gen !== loadGen.current) return;

    if (s) setStats(s);
    setAssets(a?.data || []);
    setTickets(t?.data || []);
    setOpenTicketCount(ticketStats?.open ?? t?.total ?? (t?.data || []).length);
    setWeeklyTrend(mergeWeeklyTrend(s?.weeklyCreated, ticketStats?.weeklyCreated));
    if (ticketStats) setTicketStatsExtra(ticketStats);
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
  }

  /** Secondary widgets — after paint, never blanks the page */
  async function loadSecondary() {
    const gen = loadGen.current;
    const [pc, logs, swCompliance, swUtilization, swEol, net] = await Promise.all([
      apiFetchOptional("/patches/compliance"),
      apiFetchOptional("/admin/audit-logs?limit=8"),
      apiFetchOptional("/software/compliance"),
      apiFetchOptional("/software/utilization"),
      apiFetchOptional("/software/eol"),
      apiFetchOptional("/monitoring/network"),
    ]);
    if (gen !== loadGen.current) return;

    setPatchComplianceRaw(pc);
    if (pc?.bySeverity) {
      setPatchCompliance(pc.bySeverity.map((sv: any) => ({
        name: sv.severity, patched: sv.deployed, unpatched: sv.total - sv.deployed,
      })));
    }

    const actions: { icon: string; label: string; href: string }[] = [];
    const criticalUnpatched = pc?.bySeverity
      ? pc.bySeverity
          .filter((sv: any) => sv.severity === "Critical" || sv.severity === "High")
          .reduce((sum: number, sv: any) => sum + Math.max(0, (sv.total || 0) - (sv.deployed || 0)), 0)
      : 0;
    if (criticalUnpatched > 0) {
      actions.push({ icon: "shield", label: `Deploy ${criticalUnpatched} critical/high patch${criticalUnpatched === 1 ? "" : "es"}`, href: "/dashboard/patches" });
    }
    const needsReview = swCompliance?.needsReview || 0;
    if (needsReview > 0) {
      actions.push({ icon: "package", label: `Review ${needsReview} new software title${needsReview === 1 ? "" : "s"}`, href: "/dashboard/software?filter=NEEDS_REVIEW" });
    }
    const underUtilized = Array.isArray(swUtilization)
      ? swUtilization.filter((u: any) => u.status === "UNDER_UTILIZED").length
      : 0;
    if (underUtilized > 0) {
      actions.push({ icon: "monitor", label: `Reclaim seats on ${underUtilized} under-utilized license${underUtilized === 1 ? "" : "s"}`, href: "/dashboard/licenses" });
    }
    const eolCount = Array.isArray(swEol) ? swEol.length : 0;
    if (eolCount > 0 && actions.length < 3) {
      actions.push({ icon: "alert", label: `Replace ${eolCount} end-of-life software title${eolCount === 1 ? "" : "s"}`, href: "/dashboard/software?filter=EOL" });
    }
    setSmartActions(actions.slice(0, 3));

    const logEntries = (logs?.data || logs || []).slice(0, 5);
    setActivityFeed(logEntries.map((l: any) => ({
      time: timeAgo(l.timestamp),
      event: `${l.action} ${l.resourceType || "resource"}`,
      detail: l.resourceName || l.metadata?.url || "—",
      module: l.module || l.resourceType || "system",
    })));

    // SNMP history after shell is visible — never blocks spinner
    const devices = net?.data || [];
    const snmpDevices = devices.filter((d: any) => d.metrics?.snmpAvailable || d.metrics?.ifInOctets !== undefined);
    if (snmpDevices.length > 0) {
      try {
        const histories = await Promise.all(
          snmpDevices.slice(0, 3).map((d: any) =>
            apiFetchOptional(`/monitoring/snmp/devices/${d.id}/history?hours=24`)
          )
        );
        if (gen !== loadGen.current) return;
        const buckets: Record<string, { bandwidth: number; count: number }> = {};
        histories.forEach((history: any) => {
          (Array.isArray(history) ? history : []).forEach((m: any) => {
            const hour = new Date(m.collectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            if (!buckets[hour]) buckets[hour] = { bandwidth: 0, count: 0 };
            buckets[hour].bandwidth += Math.round(((m.metrics?.ifInOctets || 0) + (m.metrics?.ifOutOctets || 0)) / 1024 / 1024);
            buckets[hour].count++;
          });
        });
        const chartData = Object.entries(buckets)
          .map(([time, v]) => ({ time, bandwidth: Math.round(v.bandwidth / Math.max(v.count, 1)) }))
          .sort((a, b) => a.time.localeCompare(b.time));
        setNetworkHealth(chartData.length > 0 ? chartData : null);
      } catch {
        setNetworkHealth(null);
      }
    } else {
      setNetworkHealth(null);
    }
  }

  function loadData(silent = false) {
    loadCritical(silent).then(() => loadSecondary()).catch(console.error);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("accessToken");
      if (raw) {
        const payload = JSON.parse(atob(raw.split(".")[1]));
        setUserRole(payload.role || "IT Admin");
      }
    } catch { /* ignore */ }
    loadData();
    // Silent stats-only refresh every 90s (not full storm)
    const interval = setInterval(() => {
      loadCritical(true).catch(console.error);
    }, 90000);
    return () => {
      loadGen.current++;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (userRole === "Tenant Admin" || /executive/i.test(userRole)) {
      apiFetchOptional("/reports/executive").then(setExecKpis);
    }
    if (/security|IT Admin|Tenant Admin/i.test(userRole)) {
      apiFetchOptional("/vulnerabilities/dashboard").then(setVulnDash);
    }
    if (/Fleet Manager|Tenant Admin/i.test(userRole)) {
      Promise.all([
        apiFetchOptional("/fleet/vehicles"),
        apiFetchOptional("/fleet/alerts"),
        apiFetchOptional("/fleet/maintenance-due"),
      ]).then(([v, a, m]) => {
        setFleetSummary({
          total: v?.total ?? (v?.data || []).length,
          active: v?.active ?? 0,
          alerts: Array.isArray(a) ? a.filter((x: any) => !x.resolved).length : 0,
          maintenanceDue: m?.total ?? v?.maintenanceDueCount ?? 0,
        });
      });
    }
    if (/Facility|Tenant Admin/i.test(userRole)) {
      apiFetchOptional("/eam/facility/dashboard").then(setFacilitySummary);
    }
  }, [userRole]);

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

  // Compute real patch compliance percentage from API data
  const patchCompliancePct = patchComplianceRaw?.overall != null ? `${patchComplianceRaw.overall}%` : "—";

  // Compute critical unpatched count from real patch data
  const criticalUnpatched = patchComplianceRaw?.bySeverity?.find((s: any) => s.severity === "Critical");
  const criticalCount = criticalUnpatched ? criticalUnpatched.total - criticalUnpatched.deployed : 0;
  const criticalBadgeText = criticalCount > 0 ? `${criticalCount} Critical` : "All Clear";
  const criticalBadgeColor = criticalCount > 0 ? "amber" : "green";

  return (
    <>
      <PageHeader
        eyebrow={userRole}
        title="Dashboard"
        description="Welcome back — here's what's happening across your organization"
        actions={
          <button className="btn btn-secondary" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw size={14} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
            Refresh
          </button>
        }
      />

      {/* Role-specific widget strip */}
      {(userRole === "Tenant Admin" || /executive/i.test(userRole)) && execKpis && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-icon cyan"><Package size={20} /></div>
            <div className="stat-content">
              <div className="stat-label">Assets</div>
              <div className="stat-value">{execKpis.assets?.total ?? "—"}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><Ticket size={20} /></div>
            <div className="stat-content">
              <div className="stat-label">Open Tickets</div>
              <div className="stat-value">{execKpis.tickets?.open ?? "—"}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Shield size={20} /></div>
            <div className="stat-content">
              <div className="stat-label">License Spend</div>
              <div className="stat-value">{execKpis.licenses?.totalSpend != null ? `$${Math.round(execKpis.licenses.totalSpend).toLocaleString()}` : "—"}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><Activity size={20} /></div>
            <div className="stat-content">
              <div className="stat-label">Services Healthy</div>
              <div className="stat-value">
                {execKpis.businessServices
                  ? `${execKpis.businessServices.healthy}/${execKpis.businessServices.total}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/Fleet Manager/i.test(userRole) && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">Vehicles</div><div className="stat-value">{fleetSummary?.total ?? "—"}</div></div>
            <div className="stat-icon cyan"><Truck size={18} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">Active</div><div className="stat-value">{fleetSummary?.active ?? "—"}</div></div>
            <div className="stat-icon green"><Activity size={18} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">Fleet Alerts</div><div className="stat-value">{fleetSummary?.alerts ?? "—"}</div></div>
            <div className="stat-icon amber"><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">PM Due</div><div className="stat-value">{fleetSummary?.maintenanceDue ?? "—"}</div></div>
            <div className="stat-icon purple"><HardDrive size={18} /></div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Link href="/dashboard/fleet" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Open Fleet workspace →</Link>
          </div>
        </div>
      )}

      {/NOC|Network/i.test(userRole) && (
        <div className="card" style={{ marginBottom: 16, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700 }}>NOC workspace</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Topology, alarms, top talkers, syslog stream</div>
          </div>
          <Link href="/dashboard/network/noc" className="btn btn-primary" style={{ fontSize: 12 }}>Open NOC</Link>
        </div>
      )}

      {/Service Desk/i.test(userRole) && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">Open Queue</div><div className="stat-value">{ticketStatsExtra?.open ?? openTicketCount}</div></div>
            <div className="stat-icon purple"><Ticket size={18} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">SLA At Risk</div><div className="stat-value">{ticketStatsExtra?.slaAtRisk ?? ticketStatsExtra?.breached ?? "—"}</div></div>
            <div className="stat-icon amber"><Clock size={18} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">Avg CSAT</div><div className="stat-value">{ticketStatsExtra?.avgCsat ?? ticketStatsExtra?.csat ?? "—"}</div></div>
            <div className="stat-icon green"><CheckCircle2 size={18} /></div>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/dashboard/tickets" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Tickets →</Link>
            <Link href="/dashboard/changes" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Changes →</Link>
            <Link href="/dashboard/knowledge-base" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Knowledge base →</Link>
            <Link href="/dashboard/service-catalog" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Service catalog →</Link>
          </div>
        </div>
      )}

      {/^IT Admin$/i.test(userRole) && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>IT Admin workspace</div>
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 12 }}>
            <div className="stat-card">
              <div className="stat-content"><div className="stat-label">Assets</div><div className="stat-value">{stats?.total ?? "—"}</div></div>
              <div className="stat-icon cyan"><Package size={18} /></div>
            </div>
            <div className="stat-card">
              <div className="stat-content"><div className="stat-label">Patch compliance</div><div className="stat-value">{patchCompliancePct}</div></div>
              <div className="stat-icon green"><Shield size={18} /></div>
            </div>
            <div className="stat-card">
              <div className="stat-content"><div className="stat-label">Open tickets</div><div className="stat-value">{openTicketCount}</div></div>
              <div className="stat-icon purple"><Ticket size={18} /></div>
            </div>
            <div className="stat-card">
              <div className="stat-content"><div className="stat-label">Critical vulns</div><div className="stat-value">{vulnDash?.bySeverity?.CRITICAL ?? "—"}</div></div>
              <div className="stat-icon amber"><AlertTriangle size={18} /></div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/dashboard/discovery" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Discovery →</Link>
            <Link href="/dashboard/patches" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Patches →</Link>
            <Link href="/dashboard/software" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Software →</Link>
            <Link href="/dashboard/licenses" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Licenses →</Link>
            <Link href="/dashboard/compliance" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Compliance →</Link>
          </div>
        </div>
      )}

      {/^Employee$/i.test(userRole) && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Employee self-service</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>
            Your assigned assets, requests, and mobile barcode scan
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/dashboard/my-portal" className="btn btn-primary" style={{ fontSize: 12 }}>My portal</Link>
            <Link href="/dashboard/service-catalog" className="btn btn-secondary" style={{ fontSize: 12 }}>Request service</Link>
            <Link href="/dashboard/knowledge-base" className="btn btn-secondary" style={{ fontSize: 12 }}>Knowledge base</Link>
            <Link href="/scan" className="btn btn-secondary" style={{ fontSize: 12 }}>Scan asset</Link>
          </div>
        </div>
      )}

      {/Facility/i.test(userRole) && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">Sites</div><div className="stat-value">{facilitySummary?.sites ?? facilitySummary?.siteCount ?? "—"}</div></div>
            <div className="stat-icon cyan"><Wifi size={18} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">PM Due</div><div className="stat-value">{facilitySummary?.pmDue ?? facilitySummary?.maintenanceDue ?? "—"}</div></div>
            <div className="stat-icon amber"><Clock size={18} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">Low Spares</div><div className="stat-value">{facilitySummary?.lowSpares ?? facilitySummary?.sparesLow ?? "—"}</div></div>
            <div className="stat-icon purple"><Package size={18} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-content"><div className="stat-label">Open WOs</div><div className="stat-value">{facilitySummary?.openWorkOrders ?? "—"}</div></div>
            <div className="stat-icon green"><HardDrive size={18} /></div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Link href="/dashboard/facility" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Open Facility dashboard →</Link>
          </div>
        </div>
      )}

      {vulnDash && (/Security|IT Admin|Tenant Admin/i.test(userRole)) && (
        <div className="card" style={{ marginBottom: 16, padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Security posture</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Open: <strong>{vulnDash.open}</strong></div>
          <div style={{ fontSize: 12, color: "#ef4444" }}>Critical: <strong>{vulnDash.bySeverity?.CRITICAL || 0}</strong></div>
          <div style={{ fontSize: 12, color: "#f59e0b" }}>High: <strong>{vulnDash.bySeverity?.HIGH || 0}</strong></div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/dashboard/vulnerabilities" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Vulns →</Link>
            <Link href="/dashboard/compliance" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Compliance →</Link>
            <Link href="/dashboard/cctv" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>CCTV →</Link>
            <Link href="/dashboard/nac" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>NAC →</Link>
            <Link href="/dashboard/scanning" style={{ fontSize: 12, color: "var(--brand-400)", fontWeight: 600 }}>Scanning →</Link>
          </div>
        </div>
      )}

      {/* Onboarding Quick Start */}
      <QuickStart />

      {/* Stat Cards — Click to drill down */}
      <div className="stats-grid">
        <StatCard icon={<Package size={22} />} iconClass="cyan" label="Total Assets" value={stats?.total || 0} href="/dashboard/assets" />
        <StatCard icon={<Monitor size={22} />} iconClass="blue" label="IT Assets" value={typeData.reduce((a: number, t: any) => a + t.count, 0)} href="/dashboard/it-assets" />
        <StatCard icon={<Ticket size={22} />} iconClass="purple" label="Open Tickets" value={openTicketCount} href="/dashboard/tickets" />
        <StatCard icon={<Shield size={22} />} iconClass="green" label="Patch Compliance" value={patchCompliancePct} href="/dashboard/patches" />
      </div>

      {/* Intelligence & Insights Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
        <TopRiskCard />
        <LicenseOptimizationCard />
      </div>

      {/* AI Insights & Smart Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <AiInsightCard title="Compliance Analysis" type="compliance" />
          <AiInsightCard title="Patch Priority" type="patches" />
        </div>
        
        {/* Smart Actions Card */}
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-elevated), rgba(6,182,212,0.05))', borderColor: 'var(--brand-500)33' }}>
          <div className="card-header">
             <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <Brain size={18} style={{ color: 'var(--brand-400)' }} />
               Next Best Actions
             </div>
          </div>
          <div style={{ padding: '0 20px 20px', display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 5 }}>Recommended by Intelligence Engine</div>
            {smartActions.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                All clear — no pending actions
              </div>
            ) : smartActions.map((act, i) => (
              <SmartAction
                key={i}
                icon={act.icon === 'shield' ? <Shield size={14} /> : act.icon === 'monitor' ? <Monitor size={14} /> : act.icon === 'alert' ? <AlertTriangle size={14} /> : <Package size={14} />}
                label={act.label}
                href={act.href}
              />
            ))}
          </div>
        </div>
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
            <Link href="/dashboard/assets" style={{ fontSize: 11, color: "var(--brand-400)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              View All <ExternalLink size={10} />
            </Link>
          </div>
          <SafeChart height={260}>
<BarChart data={typeData} barSize={32} style={{ cursor: "pointer" }} onClick={(data: any) => { if (data?.activeLabel) router.push(`/dashboard/assets?type=${encodeURIComponent(data.activeLabel)}`); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#f1f5f9" }}
                  cursor={{ fill: "rgba(6,182,212,0.08)" }}
                />
                <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }} />
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
            <Link href="/dashboard/assets" style={{ fontSize: 11, color: "var(--brand-400)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              View All <ExternalLink size={10} />
            </Link>
          </div>
          <SafeChart height={260}>
<PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} strokeWidth={0}
                  style={{ cursor: "pointer" }}
                  onClick={(data: any) => { if (data?.name) router.push(`/dashboard/assets?status=${encodeURIComponent(data.name.replace(/ /g, "_").toUpperCase())}`); }}>
                  {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
</SafeChart>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 8 }}>
            {pieData.map((d: any) => (
              <div key={d.name}
                onClick={() => router.push(`/dashboard/assets?status=${encodeURIComponent(d.name.replace(/ /g, "_").toUpperCase())}`)}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", padding: "2px 6px", borderRadius: 4, transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
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
            <div style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard/network")}>
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>Network Bandwidth <ExternalLink size={10} style={{ opacity: 0.5 }} /></div>
              <div className="card-subtitle">24h traffic overview (Mbps)</div>
            </div>
            {networkHealth && networkHealth.length > 0 && <span className="badge green"><Wifi size={10} /> Healthy</span>}
          </div>
          {networkHealth && networkHealth.length > 0 ? (
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
          ) : (
            <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-tertiary)" }}>
              <Wifi size={28} style={{ opacity: 0.25 }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>No bandwidth data available</div>
              <div style={{ fontSize: 11 }}>Configure SNMP polling to see live bandwidth</div>
            </div>
          )}
        </div>

        {/* Patch Compliance */}
        <div className="card">
          <div className="card-header">
            <div style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard/patches")}>
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>Patch Compliance <ExternalLink size={10} style={{ opacity: 0.5 }} /></div>
              <div className="card-subtitle">By severity level</div>
            </div>
            <span className={`badge ${criticalBadgeColor}`}>{criticalCount > 0 ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />} {criticalBadgeText}</span>
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
                <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/dashboard/assets/${a.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--brand-400)", fontSize: 13 }}>{a.name}</div>
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
                <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/dashboard/tickets/${t.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--brand-400)", fontSize: 13 }}>{t.subject}</div>
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
            const modLinks: Record<string, string> = { scanning: "/dashboard/scanning", patches: "/dashboard/patches", tickets: "/dashboard/tickets", assets: "/dashboard/assets", discovery: "/dashboard/discovery", changes: "/dashboard/changes", system: "/dashboard/audit-logs" };
            const color = modColors[a.module] || "var(--text-secondary)";
            const href = modLinks[a.module] || "/dashboard";
            return (
              <div key={i} onClick={() => router.push(href)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderBottom: i < activityFeed.length - 1 ? "1px solid var(--border-primary)" : "none",
                cursor: "pointer", borderRadius: 6, transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
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
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>{a.time} <ExternalLink size={9} style={{ opacity: 0.4 }} /></span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// Stat Card Component — Now with drilldown link
function StatCard({ icon, iconClass, label, value, change, changeUp, href }: {
  icon: React.ReactNode; iconClass: string; label: string;
  value: string | number; change?: string; changeUp?: boolean; href?: string;
}) {
  const content = (
    <div className="stat-card" style={href ? { cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" } : {}}
      onMouseEnter={e => { if (href) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 25px rgba(6,182,212,0.12)"; } }}
      onMouseLeave={e => { if (href) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; } }}>
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div className="stat-content">
        <div className="stat-label" style={href ? { display: "flex", alignItems: "center", gap: 4 } : {}}>
          {label} {href && <ExternalLink size={9} style={{ opacity: 0.4 }} />}
        </div>
        <div className="stat-value">{value}</div>
        {change && (
          <div className={`stat-change ${changeUp ? "up" : "down"}`}>
            {changeUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change} this week
          </div>
        )}
      </div>
    </div>
  );
  if (href) return <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>{content}</Link>;
  return content;
}

function SmartAction({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)',
      borderRadius: 8, color: 'var(--text-primary)', textDecoration: 'none',
      fontSize: 13, fontWeight: 500, transition: 'all 0.15s'
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-500)'; e.currentTarget.style.background = 'rgba(6,182,212,0.05)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
      <div style={{ color: 'var(--brand-400)' }}>{icon}</div>
      <span style={{ flex: 1 }}>{label}</span>
      <ArrowUpRight size={14} style={{ opacity: 0.5 }} />
    </Link>
  );
}
