"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  FileText, Download, Printer, Shield, ShieldCheck, AlertTriangle,
  CheckCircle, Clock, BarChart3, RefreshCw, ChevronDown, ChevronRight, Eye
} from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────────── */

interface SecuritySummary {
  riskScore: number;
  riskLevel: string;
  cisAverageScore?: number;
  totalEndpoints?: number;
  activePolicies?: number;
  criticalViolations?: number;
  recommendations?: { text: string; severity: string; icon?: string }[];
  generatedAt?: string;
}

interface CISCheck {
  name: string;
  status: "PASS" | "FAIL" | "WARNING";
  detail?: string;
  severity?: string;
}

interface CISAgent {
  agentId: string;
  hostname: string;
  score: number;
  assessedAt: string;
  checks: CISCheck[];
}

interface CISBenchmark {
  averageScore: number;
  totalAgents: number;
  agents: CISAgent[];
  totalPass?: number;
  totalFail?: number;
  totalWarn?: number;
}

interface PolicyRow {
  name: string;
  category: string;
  severity: string;
  action: string;
  enabled: boolean;
  violations: number;
}

interface TemplateRow {
  name: string;
  description: string;
  category: string;
  severity: string;
  action: string;
}

interface FullReport {
  cisBenchmark: CISBenchmark;
  policies: PolicyRow[];
  templates: TemplateRow[];
  generatedAt?: string;
}

type TabId = "security" | "cis" | "full";

/* ─── Helpers ───────────────────────────────────────────────────── */

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function riskColor(score: number): string {
  if (score <= 20) return "#22c55e";
  if (score <= 50) return "#eab308";
  if (score <= 75) return "#f97316";
  return "#ef4444";
}

function riskBg(score: number): string {
  if (score <= 20) return "rgba(34,197,94,0.08)";
  if (score <= 50) return "rgba(234,179,8,0.08)";
  if (score <= 75) return "rgba(249,115,22,0.08)";
  return "rgba(239,68,68,0.08)";
}

function riskBorder(score: number): string {
  if (score <= 20) return "rgba(34,197,94,0.2)";
  if (score <= 50) return "rgba(234,179,8,0.2)";
  if (score <= 75) return "rgba(249,115,22,0.2)";
  return "rgba(239,68,68,0.2)";
}

function severityColor(sev?: string): string {
  switch (sev?.toLowerCase()) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#eab308";
    case "low": return "#22c55e";
    case "info": return "#06b6d4";
    default: return "#94a3b8";
  }
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    PASS: { bg: "rgba(34,197,94,0.12)", color: "#4ade80", icon: <CheckCircle size={12} /> },
    FAIL: { bg: "rgba(239,68,68,0.12)", color: "#f87171", icon: <AlertTriangle size={12} /> },
    WARNING: { bg: "rgba(234,179,8,0.12)", color: "#fbbf24", icon: <Clock size={12} /> },
  };
  const s = map[status] || map.PASS;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
      borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color,
      letterSpacing: "0.03em"
    }}>
      {s.icon} {status}
    </span>
  );
}

function scoreGaugeColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

/* ─── Shimmer Skeleton ──────────────────────────────────────────── */

function Shimmer({ width = "100%", height = 20, radius = 8 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s ease-in-out infinite",
    }} />
  );
}

function ShimmerCard() {
  return (
    <div style={{
      padding: 20, borderRadius: 14, border: "1px solid var(--border-primary)",
      background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 12
    }}>
      <Shimmer width="60%" height={14} />
      <Shimmer width="40%" height={28} />
      <Shimmer width="80%" height={12} />
    </div>
  );
}

function ShimmerRow() {
  return (
    <div style={{ display: "flex", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--border-primary)" }}>
      <Shimmer width="25%" height={14} />
      <Shimmer width="15%" height={14} />
      <Shimmer width="35%" height={14} />
      <Shimmer width="10%" height={14} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function ComplianceReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("security");
  const [securityData, setSecurityData] = useState<SecuritySummary | null>(null);
  const [fullReport, setFullReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["cisBenchmark", "policies", "templates"]));
  const [refreshing, setRefreshing] = useState(false);

  /* ── Data Fetching ─────────────────────────────────────────── */

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [sec, full] = await Promise.all([
        apiFetch<SecuritySummary>("/reports/security/summary"),
        apiFetch<FullReport>("/reports/compliance/full"),
      ]);
      setSecurityData(sec);
      setFullReport(full);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load compliance data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Agent accordion toggle ────────────────────────────────── */

  const toggleAgent = (id: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ── Export JSON ────────────────────────────────────────────── */

  const exportJSON = () => {
    if (!fullReport) return;
    const blob = new Blob([JSON.stringify(fullReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance_report_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── CIS fleet summary ─────────────────────────────────────── */

  const cisData = useMemo(() => {
    if (!fullReport?.cisBenchmark) return null;
    const cis = fullReport.cisBenchmark;
    let totalPass = cis.totalPass || 0;
    let totalFail = cis.totalFail || 0;
    let totalWarn = cis.totalWarn || 0;
    if (!totalPass && !totalFail && !totalWarn && cis.agents) {
      cis.agents.forEach(a => {
        a.checks?.forEach(c => {
          if (c.status === "PASS") totalPass++;
          else if (c.status === "FAIL") totalFail++;
          else totalWarn++;
        });
      });
    }
    return { ...cis, totalPass, totalFail, totalWarn };
  }, [fullReport]);

  /* ── Tab definitions ────────────────────────────────────────── */

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "security", label: "Security Summary", icon: <Shield size={15} /> },
    { id: "cis", label: "CIS Benchmark", icon: <ShieldCheck size={15} /> },
    { id: "full", label: "Full Report", icon: <FileText size={15} /> },
  ];

  /* ═══ Render ═════════════════════════════════════════════════ */

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{
            fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", margin: 0,
            color: "var(--text-primary)",
            background: "linear-gradient(135deg, var(--text-primary), var(--brand-400))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
          }}>
            Compliance Reports
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "6px 0 0", fontWeight: 500 }}>
            CIS Benchmark audits, security posture assessment, and policy compliance
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
            borderRadius: 10, border: "1px solid var(--border-primary)",
            background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 650, cursor: "pointer", transition: "all 0.2s",
          }}
          className="btn-refresh"
        >
          <RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 24, padding: 3, borderRadius: 12,
        background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-primary)",
        width: "fit-content",
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="tab-btn"
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
              borderRadius: 10, fontSize: 13, fontWeight: 650, border: "none",
              cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
              background: activeTab === tab.id
                ? "linear-gradient(135deg, var(--brand-500), rgba(6,182,212,0.7))"
                : "transparent",
              color: activeTab === tab.id ? "#fff" : "var(--text-tertiary)",
              boxShadow: activeTab === tab.id ? "0 2px 12px rgba(6,182,212,0.25)" : "none",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div style={{
          marginBottom: 20, padding: "16px 20px", borderRadius: 14,
          border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ color: "#f87171", fontSize: 13, fontWeight: 650, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} /> {error}
          </span>
          <button
            onClick={() => fetchData()}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 12,
              fontWeight: 650, cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── TAB CONTENT ──────────────────────────────────────── */}

      {activeTab === "security" && <SecurityTab data={securityData} loading={loading} />}
      {activeTab === "cis" && (
        <CISTab
          data={cisData}
          loading={loading}
          expandedAgents={expandedAgents}
          toggleAgent={toggleAgent}
        />
      )}
      {activeTab === "full" && (
        <FullReportTab
          data={fullReport}
          cisData={cisData}
          loading={loading}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          expandedAgents={expandedAgents}
          toggleAgent={toggleAgent}
          exportJSON={exportJSON}
        />
      )}

      {/* ── Styles ───────────────────────────────────────────── */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(6,182,212,0.08); }
          50% { box-shadow: 0 0 30px rgba(6,182,212,0.15); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .tab-btn:hover {
          color: var(--text-primary) !important;
          background: ${`rgba(255,255,255,0.05)`} !important;
        }
        .btn-refresh:hover {
          border-color: var(--brand-500) !important;
          background: rgba(6,182,212,0.06) !important;
          color: var(--brand-400) !important;
        }
        .stat-card:hover {
          border-color: var(--border-secondary) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.2) !important;
        }
        .agent-card:hover {
          border-color: var(--border-secondary) !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .section-header:hover {
          background: rgba(255,255,255,0.03) !important;
        }
        .rec-item:hover {
          background: rgba(255,255,255,0.03) !important;
          border-color: var(--border-secondary) !important;
        }
        .table-row:hover {
          background: rgba(255,255,255,0.025) !important;
        }
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          * { color: #000 !important; border-color: #ddd !important; background: transparent !important; box-shadow: none !important; }
          .print-white { background: #fff !important; }
        }
      `}</style>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 1: SECURITY SUMMARY
   ═══════════════════════════════════════════════════════════════════ */

function SecurityTab({ data, loading }: { data: SecuritySummary | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <Shimmer width={200} height={200} radius={100} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {[...Array(5)].map((_, i) => <ShimmerCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const score = data.riskScore ?? 0;
  const color = riskColor(score);
  const level = data.riskLevel || "UNKNOWN";
  const pct = Math.min(score / 100, 1);
  const angle = pct * 360;

  return (
    <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
      {/* Risk Gauge */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
        <div style={{
          position: "relative", width: 210, height: 210,
          animation: "pulseGlow 3s ease-in-out infinite",
        }}>
          {/* Outer ring */}
          <div style={{
            width: 210, height: 210, borderRadius: "50%",
            background: `conic-gradient(${color} 0deg, ${color} ${angle}deg, rgba(255,255,255,0.04) ${angle}deg, rgba(255,255,255,0.04) 360deg)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 40px ${color}22`,
            transition: "all 0.6s cubic-bezier(0.4,0,0.2,1)",
          }}>
            {/* Inner circle */}
            <div style={{
              width: 170, height: 170, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--bg-card), rgba(15,23,42,0.95))",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px solid var(--border-primary)",
            }}>
              <div style={{ fontSize: 42, fontWeight: 900, color, letterSpacing: "-0.04em", lineHeight: 1 }}>
                {score}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Risk Score
              </div>
              <div style={{
                marginTop: 6, padding: "3px 12px", borderRadius: 6,
                background: riskBg(score), border: `1px solid ${riskBorder(score)}`,
                fontSize: 11, fontWeight: 800, color, letterSpacing: "0.06em",
              }}>
                {level}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Risk Score", value: score, icon: <BarChart3 size={18} />, color: riskColor(score), accentBg: riskBg(score), accentBorder: riskBorder(score) },
          { label: "CIS Average", value: data.cisAverageScore != null ? `${data.cisAverageScore}%` : "—", icon: <ShieldCheck size={18} />, color: "#06b6d4", accentBg: "rgba(6,182,212,0.08)", accentBorder: "rgba(6,182,212,0.2)" },
          { label: "Total Endpoints", value: data.totalEndpoints ?? "—", icon: <Eye size={18} />, color: "#8b5cf6", accentBg: "rgba(139,92,246,0.08)", accentBorder: "rgba(139,92,246,0.2)" },
          { label: "Active Policies", value: data.activePolicies ?? "—", icon: <Shield size={18} />, color: "#06b6d4", accentBg: "rgba(6,182,212,0.08)", accentBorder: "rgba(6,182,212,0.2)" },
          { label: "Critical Violations", value: data.criticalViolations ?? 0, icon: <AlertTriangle size={18} />, color: "#ef4444", accentBg: "rgba(239,68,68,0.08)", accentBorder: "rgba(239,68,68,0.2)" },
        ].map((stat, i) => (
          <div key={i} className="stat-card" style={{
            padding: 18, borderRadius: 14,
            border: "1px solid var(--border-primary)",
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30,37,64,0.4) 100%)",
            display: "flex", alignItems: "center", gap: 14,
            transition: "all 0.25s ease",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            cursor: "default",
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: stat.accentBg, border: `1px solid ${stat.accentBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: stat.color, flexShrink: 0,
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {(data.recommendations?.length ?? 0) > 0 && (
        <div style={{
          padding: 24, borderRadius: 16,
          border: "1px solid var(--border-primary)",
          background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15,23,42,0.2) 100%)",
          marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 18px", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            Recommendations
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.recommendations!.map((rec, i) => (
              <div key={i} className="rec-item" style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 16px", borderRadius: 10,
                border: "1px solid var(--border-primary)",
                background: "rgba(255,255,255,0.01)",
                transition: "all 0.2s",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: `${severityColor(rec.severity)}15`,
                  border: `1px solid ${severityColor(rec.severity)}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: severityColor(rec.severity), marginTop: 1,
                }}>
                  <AlertTriangle size={13} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", fontWeight: 600, lineHeight: 1.5 }}>
                    {rec.text}
                  </p>
                  <span style={{
                    display: "inline-block", marginTop: 6, padding: "2px 8px",
                    borderRadius: 5, fontSize: 10, fontWeight: 700,
                    background: `${severityColor(rec.severity)}15`,
                    color: severityColor(rec.severity),
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {rec.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="no-print" style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 0", borderTop: "1px solid var(--border-primary)",
      }}>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
          <Clock size={11} style={{ marginRight: 5, verticalAlign: "middle" }} />
          Generated {relativeTime(data.generatedAt)}
        </span>
        <button
          onClick={() => window.print()}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
            borderRadius: 9, border: "1px solid var(--border-primary)",
            background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 650, cursor: "pointer", transition: "all 0.2s",
          }}
          className="btn-refresh"
        >
          <Printer size={14} /> Print Report
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 2: CIS BENCHMARK
   ═══════════════════════════════════════════════════════════════════ */

function CISTab({
  data, loading, expandedAgents, toggleAgent
}: {
  data: CISBenchmark | null; loading: boolean;
  expandedAgents: Set<string>; toggleAgent: (id: string) => void;
}) {
  if (loading) {
    return (
      <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          <ShimmerCard />
          <ShimmerCard />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ marginBottom: 12, padding: 20, borderRadius: 14, border: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
            <div style={{ display: "flex", gap: 16 }}>
              <Shimmer width="30%" height={16} />
              <Shimmer width="20%" height={16} />
              <Shimmer width="25%" height={16} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
      {/* Fleet Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <div className="stat-card" style={{
          padding: 20, borderRadius: 14, border: "1px solid var(--border-primary)",
          background: "linear-gradient(135deg, var(--bg-card), rgba(6,182,212,0.04))",
          transition: "all 0.25s", boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Fleet Average Score
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: scoreGaugeColor(data.averageScore), letterSpacing: "-0.04em" }}>
              {data.averageScore?.toFixed(1) ?? "—"}
            </span>
            <span style={{ fontSize: 14, color: "var(--text-tertiary)", fontWeight: 600 }}>/ 100</span>
          </div>
          <div style={{
            marginTop: 10, height: 6, borderRadius: 3,
            background: "rgba(255,255,255,0.05)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 3,
              width: `${Math.min(data.averageScore || 0, 100)}%`,
              background: `linear-gradient(90deg, ${scoreGaugeColor(data.averageScore)}, ${scoreGaugeColor(data.averageScore)}99)`,
              transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
            }} />
          </div>
        </div>

        <div className="stat-card" style={{
          padding: 20, borderRadius: 14, border: "1px solid var(--border-primary)",
          background: "linear-gradient(135deg, var(--bg-card), rgba(139,92,246,0.04))",
          transition: "all 0.25s", boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Agents Assessed
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.04em" }}>
            {data.totalAgents ?? data.agents?.length ?? 0}
          </div>
        </div>
      </div>

      {/* Per-Agent Cards */}
      <h3 style={{ fontSize: 14, fontWeight: 750, color: "var(--text-primary)", margin: "0 0 14px", letterSpacing: "-0.01em" }}>
        Agent Assessments
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {(data.agents || []).map(agent => {
          const isOpen = expandedAgents.has(agent.agentId);
          const sc = agent.score ?? 0;
          const sColor = scoreGaugeColor(sc);
          return (
            <div key={agent.agentId} className="agent-card" style={{
              borderRadius: 14, border: "1px solid var(--border-primary)",
              background: "var(--bg-card)", overflow: "hidden",
              transition: "all 0.2s",
            }}>
              {/* Agent Header */}
              <button
                onClick={() => toggleAgent(agent.agentId)}
                style={{
                  width: "100%", padding: "16px 20px", border: "none", background: "transparent",
                  display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                  color: "var(--text-primary)", textAlign: "left",
                }}
              >
                <div style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", color: "var(--text-tertiary)" }}>
                  <ChevronRight size={16} />
                </div>
                <Shield size={16} style={{ color: sColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {agent.hostname || agent.agentId}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontWeight: 500 }}>
                    Assessed {relativeTime(agent.assessedAt)}
                  </div>
                </div>
                {/* Mini score gauge */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{
                    width: 80, height: 6, borderRadius: 3,
                    background: "rgba(255,255,255,0.05)", overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${Math.min(sc, 100)}%`,
                      background: sColor,
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: sColor, minWidth: 36, textAlign: "right" }}>
                    {sc}%
                  </span>
                </div>
              </button>

              {/* Expanded Checks */}
              {isOpen && (
                <div style={{
                  borderTop: "1px solid var(--border-primary)",
                  padding: "0 20px 16px",
                  animation: "scaleIn 0.2s ease-out",
                }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Check</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Severity</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(agent.checks || []).map((chk, ci) => (
                          <tr key={ci} className="table-row" style={{ borderBottom: "1px solid var(--border-primary)", transition: "background 0.15s" }}>
                            <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 600 }}>{chk.name}</td>
                            <td style={{ padding: "10px 12px" }}>{statusBadge(chk.status)}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${severityColor(chk.severity)}15`, color: severityColor(chk.severity), textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                {chk.severity || "—"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "var(--text-secondary)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {chk.detail || "—"}
                            </td>
                          </tr>
                        ))}
                        {(!agent.checks || agent.checks.length === 0) && (
                          <tr><td colSpan={4} style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No checks recorded</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {(!data.agents || data.agents.length === 0) && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, borderRadius: 14, border: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
            No agents assessed yet
          </div>
        )}
      </div>

      {/* Fleet Summary Table */}
      <div style={{
        padding: 20, borderRadius: 14, border: "1px solid var(--border-primary)",
        background: "linear-gradient(180deg, var(--bg-card), rgba(15,23,42,0.2))",
      }}>
        <h4 style={{ fontSize: 13, fontWeight: 750, color: "var(--text-primary)", margin: "0 0 14px", letterSpacing: "-0.01em" }}>
          Fleet Summary
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <div style={{
            padding: "14px 16px", borderRadius: 10,
            background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pass</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#22c55e", marginTop: 4 }}>{data.totalPass}</div>
          </div>
          <div style={{
            padding: "14px 16px", borderRadius: 10,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "#f87171", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fail</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#ef4444", marginTop: 4 }}>{data.totalFail}</div>
          </div>
          <div style={{
            padding: "14px 16px", borderRadius: 10,
            background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.15)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Warning</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#eab308", marginTop: 4 }}>{data.totalWarn}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 3: FULL REPORT
   ═══════════════════════════════════════════════════════════════════ */

function FullReportTab({
  data, cisData, loading, expandedSections, toggleSection, expandedAgents, toggleAgent, exportJSON
}: {
  data: FullReport | null;
  cisData: CISBenchmark | null;
  loading: boolean;
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  expandedAgents: Set<string>;
  toggleAgent: (id: string) => void;
  exportJSON: () => void;
}) {
  if (loading) {
    return (
      <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ marginBottom: 14, padding: 24, borderRadius: 14, border: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
            <Shimmer width="40%" height={18} />
            <div style={{ marginTop: 16 }}>
              {[...Array(3)].map((_, j) => <ShimmerRow key={j} />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const sections = [
    {
      id: "cisBenchmark", label: "CIS Benchmark", icon: <ShieldCheck size={16} />,
      accent: "#06b6d4",
      content: cisData ? (
        <CISTab data={cisData} loading={false} expandedAgents={expandedAgents} toggleAgent={toggleAgent} />
      ) : <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No CIS data available</p>,
    },
    {
      id: "policies", label: "Active Policies", icon: <Shield size={16} />,
      accent: "#8b5cf6",
      content: (data.policies?.length ?? 0) > 0 ? (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border-primary)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border-primary)" }}>
                {["Name", "Category", "Severity", "Action", "Enabled", "Violations"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.policies!.map((p, i) => (
                <tr key={i} className="table-row" style={{ borderBottom: "1px solid var(--border-primary)", transition: "background 0.15s" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 650, color: "var(--text-primary)" }}>{p.name}</td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{p.category}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${severityColor(p.severity)}15`, color: severityColor(p.severity), textTransform: "uppercase" }}>
                      {p.severity}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 11 }}>{p.action}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 11, fontWeight: 700,
                      color: p.enabled ? "#4ade80" : "#f87171",
                    }}>
                      {p.enabled ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      {p.enabled ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={{
                    padding: "12px 14px", fontWeight: 700,
                    color: (p.violations || 0) > 0 ? "#f87171" : "#4ade80",
                  }}>
                    {p.violations ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: 20 }}>No policies configured</p>,
    },
    {
      id: "templates", label: "Policy Templates", icon: <FileText size={16} />,
      accent: "#f59e0b",
      content: (data.templates?.length ?? 0) > 0 ? (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border-primary)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border-primary)" }}>
                {["Name", "Description", "Category", "Severity", "Action"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.templates!.map((t, i) => (
                <tr key={i} className="table-row" style={{ borderBottom: "1px solid var(--border-primary)", transition: "background 0.15s" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 650, color: "var(--text-primary)" }}>{t.name}</td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{t.category}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${severityColor(t.severity)}15`, color: severityColor(t.severity), textTransform: "uppercase" }}>
                      {t.severity}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 11 }}>{t.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: 20 }}>No templates available</p>,
    },
  ];

  return (
    <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
      {/* Action Bar */}
      <div className="no-print" style={{
        display: "flex", gap: 10, marginBottom: 20, justifyContent: "flex-end",
      }}>
        <button
          onClick={exportJSON}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
            borderRadius: 9, border: "1px solid var(--border-primary)",
            background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 650, cursor: "pointer", transition: "all 0.2s",
          }}
          className="btn-refresh"
        >
          <Download size={14} /> Export JSON
        </button>
        <button
          onClick={() => window.print()}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
            borderRadius: 9, border: "1px solid var(--border-primary)",
            background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 650, cursor: "pointer", transition: "all 0.2s",
          }}
          className="btn-refresh"
        >
          <Printer size={14} /> Print
        </button>
      </div>

      {/* Collapsible Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sections.map(sec => {
          const isOpen = expandedSections.has(sec.id);
          return (
            <div key={sec.id} style={{
              borderRadius: 16, border: "1px solid var(--border-primary)",
              background: "var(--bg-card)", overflow: "hidden",
            }}>
              <button
                onClick={() => toggleSection(sec.id)}
                className="section-header"
                style={{
                  width: "100%", padding: "18px 24px", border: "none",
                  background: "transparent", display: "flex", alignItems: "center",
                  gap: 12, cursor: "pointer", color: "var(--text-primary)",
                  textAlign: "left", transition: "background 0.15s",
                }}
              >
                <div style={{
                  transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  color: sec.accent,
                }}>
                  <ChevronRight size={18} />
                </div>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: `${sec.accent}15`, border: `1px solid ${sec.accent}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: sec.accent,
                }}>
                  {sec.icon}
                </div>
                <span style={{ fontSize: 15, fontWeight: 750, letterSpacing: "-0.01em" }}>
                  {sec.label}
                </span>
                <div style={{
                  marginLeft: "auto", transition: "transform 0.25s",
                  color: "var(--text-tertiary)",
                }}>
                  <ChevronDown size={16} style={{
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
                  }} />
                </div>
              </button>

              {isOpen && (
                <div style={{
                  padding: "0 24px 24px",
                  borderTop: "1px solid var(--border-primary)",
                  animation: "scaleIn 0.25s ease-out",
                }}>
                  <div style={{ paddingTop: 20 }}>
                    {sec.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 0", marginTop: 16, borderTop: "1px solid var(--border-primary)",
      }}>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
          <Clock size={11} style={{ marginRight: 5, verticalAlign: "middle" }} />
          Report generated {relativeTime(data.generatedAt)}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
          3 sections • {(data.policies?.length ?? 0)} policies • {(data.templates?.length ?? 0)} templates
        </span>
      </div>
    </div>
  );
}
