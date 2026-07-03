"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Layers, Search, RefreshCw, Loader2, ChevronRight, X,
  Shield, ShieldAlert, ShieldCheck, ShieldQuestion, AlertTriangle,
  Monitor, Users, Package, Clock, CheckCircle2, XCircle,
  Edit3, Save, ExternalLink, Download, Filter, ChevronDown,
  BarChart3, TrendingUp
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type Software = {
  id: string;
  name: string;
  publisher: string | null;
  category: string | null;
  latestVersion: string | null;
  authorizationStatus: string;
  lifecycleStatus: string | null;
  riskScore: number | null;
  eolDate: string | null;
  eosDate: string | null;
  description: string | null;
  isBlacklisted: boolean;
  isAuthorized: boolean;
  createdAt: string;
  _count?: { installations: number };
  installCount?: number;
  userCount?: number;
};

type DashboardStats = {
  totalSoftware: number;
  authorizedCount: number;
  unauthorizedCount: number;
  needsReviewCount: number;
  eolCount: number;
  totalInstallations: number;
  topPublishers: { publisher: string; count: number }[];
  topCategories: { category: string; count: number }[];
  topInstalled: { id: string; name: string; publisher: string; installCount?: number; installationCount?: number }[];
};

const AUTH_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  AUTHORIZED: { bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.3)", text: "#34d399", label: "Authorized" },
  UNAUTHORIZED: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.3)", text: "#f87171", label: "Unauthorized" },
  NEEDS_REVIEW: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.3)", text: "#fbbf24", label: "Needs Review" },
  REQUIRED: { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.3)", text: "#60a5fa", label: "Required" },
};

const LIFECYCLE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  CURRENT: { bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.3)", text: "#34d399", label: "Current" },
  APPROACHING_EOL: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.3)", text: "#fbbf24", label: "Approaching EOL" },
  EOL: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.3)", text: "#f87171", label: "End of Life" },
  EOS: { bg: "rgba(153, 27, 27, 0.15)", border: "rgba(153, 27, 27, 0.4)", text: "#fca5a5", label: "End of Support" },
};

function RiskBadge({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>—</span>;
  const color = score >= 75 ? "#ef4444" : score >= 50 ? "#f59e0b" : score >= 25 ? "#60a5fa" : "#10b981";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 36, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 20 }}>{score}</span>
    </div>
  );
}

function StatusBadge({ status, map }: { status: string | null; map: typeof AUTH_COLORS }) {
  if (!status || !map[status]) return <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>—</span>;
  const c = map[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>
      {c.label}
    </span>
  );
}

export default function SoftwareInventoryPage() {
  const [software, setSoftware] = useState<Software[]>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [authFilter, setAuthFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("");
  const [sortBy, setSortBy] = useState("installCount");
  const [showFilters, setShowFilters] = useState(true);
  const [selectedSoftware, setSelectedSoftware] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "assets" | "users" | "licenses">("overview");
  const [detailData, setDetailData] = useState<any>(null);
  const [detailAssets, setDetailAssets] = useState<any[]>([]);
  const [detailUsers, setDetailUsers] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const limit = 25;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page), limit: String(limit), sortBy,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (authFilter) params.set("authorizationStatus", authFilter);
      if (lifecycleFilter) params.set("lifecycleStatus", lifecycleFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (publisherFilter) params.set("publisher", publisherFilter);

      const [list, stats] = await Promise.all([
        apiFetch(`/software?${params.toString()}`),
        apiFetch("/software/dashboard"),
      ]);
      setSoftware(list.data || []);
      setTotal(list.total || 0);
      setDashboard(stats);
    } catch (err: any) {
      console.error("Software load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, authFilter, lifecycleFilter, categoryFilter, publisherFilter, sortBy]);

  useEffect(() => { refresh(); }, [refresh]);

  async function loadDetail(sw: Software) {
    setSelectedSoftware(sw);
    setDetailTab("overview");
    setDetailLoading(true);
    setEditing(false);
    try {
      const [detail, assets, users] = await Promise.all([
        apiFetch(`/software/${sw.id}`),
        apiFetch(`/software/${sw.id}/assets?limit=50`),
        apiFetch(`/software/${sw.id}/users?limit=50`),
      ]);
      setDetailData(detail);
      setDetailAssets(assets.data || []);
      setDetailUsers(users.data || []);
    } catch (err) {
      console.error("Detail load failed:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  function startEdit() {
    setEditing(true);
    setEditForm({
      authorizationStatus: detailData?.authorizationStatus || "NEEDS_REVIEW",
      lifecycleStatus: detailData?.lifecycleStatus || "",
      riskScore: detailData?.riskScore ?? "",
      eolDate: detailData?.eolDate ? detailData.eolDate.split("T")[0] : "",
      eosDate: detailData?.eosDate ? detailData.eosDate.split("T")[0] : "",
      description: detailData?.description || "",
    });
  }

  async function handleSaveEdit() {
    try {
      await apiFetch(`/software/${selectedSoftware.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          riskScore: editForm.riskScore !== "" ? Number(editForm.riskScore) : null,
          eolDate: editForm.eolDate || null,
          eosDate: editForm.eosDate || null,
        }),
      });
      setEditing(false);
      refresh();
      loadDetail(selectedSoftware);
    } catch { alert("Failed to update."); }
  }

  const totalPages = Math.ceil(total / limit);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 10 }}>
            <Layers size={22} style={{ color: "var(--brand-400)" }} />
            Software Inventory
          </h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
            Manage and audit all software across your organization — {total} entries
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontWeight: 600, fontSize: 13 }}>
            <Filter size={14} /> Filters
          </button>
          <button className="btn btn-secondary" onClick={refresh}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, padding: 0, borderRadius: 10 }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          {/* Total Software */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid var(--border-primary)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(6, 182, 212, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-400)" }}>
              <Layers size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Software</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>{dashboard.totalSoftware}</div>
            </div>
          </div>

          {/* Authorized */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 12px rgba(16, 185, 129, 0.02)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(16, 185, 129, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Authorized</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399", marginTop: 2 }}>{dashboard.authorizedCount}</div>
            </div>
          </div>

          {/* Unauthorized */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 12px rgba(239, 68, 68, 0.02)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(239, 68, 68, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Unauthorized</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f87171", marginTop: 2 }}>{dashboard.unauthorizedCount}</div>
            </div>
          </div>

          {/* Needs Review */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 12px rgba(245, 158, 11, 0.02)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(245, 158, 11, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24" }}>
              <ShieldQuestion size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Needs Review</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>{dashboard.needsReviewCount}</div>
            </div>
          </div>

          {/* EOL/EOS Risk */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
            border: "1px solid rgba(168, 85, 247, 0.2)",
            borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 12px rgba(168, 85, 247, 0.02)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: "rgba(168, 85, 247, 0.03)", borderRadius: "50%", filter: "blur(15px)" }} />
            <div style={{ background: "rgba(168, 85, 247, 0.1)", border: "1px solid rgba(168, 85, 247, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#c084fc" }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>EOL/EOS Risk</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#c084fc", marginTop: 2 }}>{dashboard.eolCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Publishers & Categories Horizontal Bar Charts */}
      {dashboard && (dashboard.topPublishers?.length > 0 || dashboard.topInstalled?.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Top Publishers */}
          <div style={{
            background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15, 23, 42, 0.25) 100%)",
            border: "1px solid var(--border-primary)", borderRadius: 14, padding: 20, overflow: "hidden"
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart3 size={15} style={{ color: "var(--brand-400)" }} /> Top Publishers
            </div>
            {dashboard.topPublishers?.slice(0, 6).map((p, i) => {
              const maxCount = dashboard.topPublishers[0]?.count || 1;
              return (
                <div key={i} style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => setPublisherFilter(p.publisher)}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{p.publisher || "Unknown"}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>{p.count}</span>
                  </div>
                  <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                    <div style={{
                      width: `${(p.count / maxCount) * 100}%`, height: "100%", borderRadius: 3,
                      background: "linear-gradient(90deg, var(--brand-500), var(--brand-400))",
                      transition: "width 0.6s ease"
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Installed */}
          <div style={{
            background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15, 23, 42, 0.25) 100%)",
            border: "1px solid var(--border-primary)", borderRadius: 14, padding: 20, overflow: "hidden"
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={15} style={{ color: "#34d399" }} /> Most Installed
            </div>
            {dashboard.topInstalled?.slice(0, 6).map((s, i) => {
              const cnt = s.installCount ?? s.installationCount ?? 0;
              const maxCount = (dashboard.topInstalled[0]?.installCount ?? dashboard.topInstalled[0]?.installationCount) || 1;
              return (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>{cnt} installs</span>
                  </div>
                  <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                    <div style={{
                      width: `${(cnt / maxCount) * 100}%`, height: "100%", borderRadius: 3,
                      background: "linear-gradient(90deg, #10b981, #34d399)",
                      transition: "width 0.6s ease"
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area: Filters Sidebar + Table */}
      <div style={{ display: "flex", gap: 16 }}>
        {/* Filter Sidebar */}
        {showFilters && (
          <div style={{
            width: 220, flexShrink: 0,
            background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15, 23, 42, 0.25) 100%)",
            border: "1px solid var(--border-primary)", borderRadius: 14, padding: 16,
            alignSelf: "flex-start", position: "sticky", top: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Filters</div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "6px 10px" }}>
                <Search size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search software..."
                  style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
              </div>
            </div>

            {/* Authorization Status */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Authorization</div>
              {["", "AUTHORIZED", "UNAUTHORIZED", "NEEDS_REVIEW", "REQUIRED"].map(val => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 12, color: authFilter === val ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  <input type="radio" name="auth" checked={authFilter === val} onChange={() => { setAuthFilter(val); setPage(1); }}
                    style={{ accentColor: "var(--brand-400)" }} />
                  {val ? AUTH_COLORS[val]?.label || val : "All"}
                </label>
              ))}
            </div>

            {/* Lifecycle Status */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Lifecycle</div>
              {["", "CURRENT", "APPROACHING_EOL", "EOL", "EOS"].map(val => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 12, color: lifecycleFilter === val ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  <input type="radio" name="lifecycle" checked={lifecycleFilter === val} onChange={() => { setLifecycleFilter(val); setPage(1); }}
                    style={{ accentColor: "var(--brand-400)" }} />
                  {val ? LIFECYCLE_COLORS[val]?.label || val : "All"}
                </label>
              ))}
            </div>

            {/* Top Publishers */}
            {dashboard?.topPublishers && dashboard.topPublishers.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Publisher</div>
                <div style={{ cursor: "pointer", padding: "3px 0", fontSize: 12, color: publisherFilter === "" ? "var(--brand-400)" : "var(--text-secondary)", fontWeight: publisherFilter === "" ? 600 : 400 }}
                  onClick={() => { setPublisherFilter(""); setPage(1); }}>
                  All Publishers
                </div>
                {dashboard.topPublishers.slice(0, 8).map(p => (
                  <div key={p.publisher} style={{
                    cursor: "pointer", padding: "3px 0", fontSize: 12, display: "flex", justifyContent: "space-between",
                    color: publisherFilter === p.publisher ? "var(--brand-400)" : "var(--text-secondary)",
                    fontWeight: publisherFilter === p.publisher ? 600 : 400,
                  }}
                    onClick={() => { setPublisherFilter(p.publisher); setPage(1); }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{p.publisher || "Unknown"}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{p.count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Sort By */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Sort By</div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "6px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
                <option value="installCount">Most Installed</option>
                <option value="name">Name (A-Z)</option>
                <option value="riskScore">Risk Score</option>
                <option value="createdAt">Recently Added</option>
              </select>
            </div>

            {/* Clear Filters */}
            {(authFilter || lifecycleFilter || publisherFilter || categoryFilter || searchQuery) && (
              <button onClick={() => { setAuthFilter(""); setLifecycleFilter(""); setPublisherFilter(""); setCategoryFilter(""); setSearchQuery(""); setPage(1); }}
                style={{ marginTop: 12, width: "100%", padding: "8px", borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ padding: 0, borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-primary)", background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(15, 23, 42, 0.25) 100%)" }}>
            {software.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-tertiary)" }}>
                <div style={{ background: "rgba(255,255,255,0.03)", width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Layers size={32} style={{ color: "var(--text-tertiary)" }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>No software found</div>
                <p style={{ fontSize: 13, maxWidth: 360, margin: "0 auto" }}>Software entries are auto-discovered from network scans and agent reports. Try adjusting your filters or run a discovery scan.</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                        {["Software", "Publisher", "Category", "Version", "Installs", "Users", "Authorization", "Lifecycle", "Risk"].map(h => (
                          <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                        <th style={{ padding: "14px 16px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {software.map((sw) => {
                        const installs = sw._count?.installations ?? sw.installCount ?? 0;
                        return (
                          <tr key={sw.id}
                            onClick={() => loadDetail(sw)}
                            style={{ borderBottom: "1px solid var(--border-primary)", cursor: "pointer", transition: "background 0.15s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{sw.name}</div>
                            </td>
                            <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{sw.publisher || "—"}</td>
                            <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{sw.category || "—"}</td>
                            <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{sw.latestVersion || "—"}</td>
                            <td style={{ padding: "14px 16px" }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                                background: "rgba(6, 182, 212, 0.1)", color: "var(--brand-400)"
                              }}>
                                <Monitor size={12} /> {installs}
                              </span>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                                background: "rgba(168, 85, 247, 0.1)", color: "#c084fc"
                              }}>
                                <Users size={12} /> {sw.userCount ?? "—"}
                              </span>
                            </td>
                            <td style={{ padding: "14px 16px" }}><StatusBadge status={sw.authorizationStatus} map={AUTH_COLORS} /></td>
                            <td style={{ padding: "14px 16px" }}><StatusBadge status={sw.lifecycleStatus} map={LIFECYCLE_COLORS} /></td>
                            <td style={{ padding: "14px 16px" }}><RiskBadge score={sw.riskScore} /></td>
                            <td style={{ padding: "14px 16px" }}>
                              <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid var(--border-primary)" }}>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        style={{ padding: "6px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)", fontSize: 12, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
                        Previous
                      </button>
                      <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        style={{ padding: "6px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)", fontSize: 12, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedSoftware && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 560, zIndex: 1000,
          background: "var(--bg-page)", borderLeft: "1px solid var(--border-primary)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
          display: "flex", flexDirection: "column",
          animation: "slideIn 0.25s ease-out",
        }}>
          {/* Drawer Header */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{selectedSoftware.name}</h2>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{selectedSoftware.publisher || "Unknown publisher"} · {selectedSoftware.category || "Uncategorized"}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!editing && detailTab === "overview" && (
                <button onClick={startEdit} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.2)", color: "var(--brand-400)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Edit3 size={12} /> Edit
                </button>
              )}
              <button onClick={() => { setSelectedSoftware(null); setEditing(false); }}
                style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-primary)", color: "var(--text-tertiary)", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-primary)", padding: "0 24px" }}>
            {(["overview", "assets", "users", "licenses"] as const).map(tab => (
              <button key={tab} onClick={() => setDetailTab(tab)}
                style={{
                  padding: "12px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  color: detailTab === tab ? "var(--brand-400)" : "var(--text-tertiary)",
                  borderBottom: detailTab === tab ? "2px solid var(--brand-400)" : "2px solid transparent",
                  background: "none", border: "none", borderBottomStyle: "solid",
                  textTransform: "capitalize", transition: "all 0.2s",
                }}>
                {tab}
              </button>
            ))}
          </div>

          {/* Drawer Content */}
          <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
            {detailLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-tertiary)" }}>
                <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : detailTab === "overview" ? (
              <div>
                {editing ? (
                  /* Edit Form */
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>Authorization Status</label>
                      <select value={editForm.authorizationStatus} onChange={e => setEditForm({ ...editForm, authorizationStatus: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                        <option value="AUTHORIZED">Authorized</option>
                        <option value="UNAUTHORIZED">Unauthorized</option>
                        <option value="NEEDS_REVIEW">Needs Review</option>
                        <option value="REQUIRED">Required</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>Lifecycle Status</label>
                      <select value={editForm.lifecycleStatus} onChange={e => setEditForm({ ...editForm, lifecycleStatus: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                        <option value="">Not Set</option>
                        <option value="CURRENT">Current</option>
                        <option value="APPROACHING_EOL">Approaching EOL</option>
                        <option value="EOL">End of Life</option>
                        <option value="EOS">End of Support</option>
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>EOL Date</label>
                        <input type="date" value={editForm.eolDate} onChange={e => setEditForm({ ...editForm, eolDate: e.target.value })}
                          style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>EOS Date</label>
                        <input type="date" value={editForm.eosDate} onChange={e => setEditForm({ ...editForm, eosDate: e.target.value })}
                          style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>Risk Score (0-100)</label>
                      <input type="number" min="0" max="100" value={editForm.riskScore} onChange={e => setEditForm({ ...editForm, riskScore: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>Description</label>
                      <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3}
                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => setEditing(false)} style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                      <button onClick={handleSaveEdit} style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(6, 182, 212, 0.15)", border: "1px solid rgba(6, 182, 212, 0.3)", color: "var(--brand-400)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <Save size={12} /> Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Read-only Overview */
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Authorization & Lifecycle */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: 14, border: "1px solid var(--border-primary)" }}>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 6 }}>AUTHORIZATION</div>
                        <StatusBadge status={detailData?.authorizationStatus} map={AUTH_COLORS} />
                      </div>
                      <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: 14, border: "1px solid var(--border-primary)" }}>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 6 }}>LIFECYCLE</div>
                        <StatusBadge status={detailData?.lifecycleStatus} map={LIFECYCLE_COLORS} />
                      </div>
                    </div>

                    {/* Risk Score */}
                    <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: 14, border: "1px solid var(--border-primary)" }}>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 8 }}>RISK SCORE</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: "100%", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                          <div style={{
                            width: `${detailData?.riskScore || 0}%`, height: "100%", borderRadius: 4,
                            background: (detailData?.riskScore || 0) >= 75 ? "linear-gradient(90deg, #ef4444, #f87171)" : (detailData?.riskScore || 0) >= 50 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #10b981, #34d399)",
                            transition: "width 0.5s ease"
                          }} />
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", minWidth: 30 }}>{detailData?.riskScore ?? "—"}</span>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Publisher", value: detailData?.publisher || "—" },
                        { label: "Category", value: detailData?.category || "—" },
                        { label: "Latest Version", value: detailData?.latestVersion || "—" },
                        { label: "Installations", value: detailData?.installCount ?? "—" },
                        { label: "EOL Date", value: detailData?.eolDate ? new Date(detailData.eolDate).toLocaleDateString() : "Not set" },
                        { label: "EOS Date", value: detailData?.eosDate ? new Date(detailData.eosDate).toLocaleDateString() : "Not set" },
                      ].map(item => (
                        <div key={item.label} style={{ padding: "8px 0" }}>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 2 }}>{item.label}</div>
                          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    {detailData?.description && (
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 4 }}>DESCRIPTION</div>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{detailData.description}</p>
                      </div>
                    )}

                    {/* Version Distribution */}
                    {detailData?.versionDistribution && detailData.versionDistribution.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 8 }}>VERSION DISTRIBUTION</div>
                        {detailData.versionDistribution.map((v: any, i: number) => {
                          const maxCount = detailData.versionDistribution[0]?.count || 1;
                          return (
                            <div key={i} style={{ marginBottom: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>{v.version || "Unknown"}</span>
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{v.count} installs</span>
                              </div>
                              <div style={{ width: "100%", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                                <div style={{ width: `${(v.count / maxCount) * 100}%`, height: "100%", borderRadius: 2, background: "var(--brand-400)", transition: "width 0.5s ease" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : detailTab === "assets" ? (
              /* Assets Tab */
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>{detailAssets.length} asset(s) with this software installed</div>
                {detailAssets.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: 13 }}>No assets found</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detailAssets.map((a: any) => {
                      const asset = a.asset || a;
                      return (
                      <div key={a.id || a.assetId} style={{
                        background: "var(--bg-elevated)", borderRadius: 10, padding: 14,
                        border: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{asset.name || asset.hostname || "Unknown"}</div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", gap: 12 }}>
                            {asset.ipAddress && <span>{asset.ipAddress}</span>}
                            {asset.hostname && <span>{asset.hostname}</span>}
                            {a.version && <span>v{a.version}</span>}
                            {a.lastUsedAt && <span>Last used: {new Date(a.lastUsedAt).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <span style={{
                          padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: asset.status === "ACTIVE" ? "rgba(16, 185, 129, 0.1)" : "rgba(255,255,255,0.05)",
                          color: asset.status === "ACTIVE" ? "#34d399" : "var(--text-tertiary)",
                          border: `1px solid ${asset.status === "ACTIVE" ? "rgba(16, 185, 129, 0.2)" : "var(--border-primary)"}`,
                        }}>{asset.status || "—"}</span>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : detailTab === "users" ? (
              /* Users Tab */
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>{detailUsers.length} user(s) using this software</div>
                {detailUsers.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: 13 }}>No users found — software may be on unassigned assets</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detailUsers.map((u: any, i: number) => (
                      <div key={u.id || i} style={{
                        background: "var(--bg-elevated)", borderRadius: 10, padding: 14,
                        border: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-400)", fontSize: 13, fontWeight: 700 }}>
                            {(u.firstName || u.name || "?")[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.firstName ? `${u.firstName} ${u.lastName || ""}` : u.name || "Unknown"}</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{u.email || ""} {u.department ? `· ${u.department}` : ""}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>{u.assetCount || 1} asset(s)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Licenses Tab */
              <div>
                {detailData?.licenses && detailData.licenses.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {detailData.licenses.map((lic: any) => {
                      const utilization = lic.totalSeats > 0 ? Math.round((lic.usedSeats / lic.totalSeats) * 100) : 0;
                      const barColor = utilization > 100 ? "#ef4444" : utilization > 85 ? "#f59e0b" : "#10b981";
                      return (
                        <div key={lic.id} style={{
                          background: "var(--bg-elevated)", borderRadius: 10, padding: 16,
                          border: "1px solid var(--border-primary)"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{lic.softwareName}</div>
                            <span style={{
                              padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: lic.status === "ACTIVE" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                              color: lic.status === "ACTIVE" ? "#34d399" : "#f87171",
                            }}>{lic.status}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>
                            {lic.licenseType} · {lic.licenseModel} · {lic.vendor || "Unknown vendor"}
                          </div>
                          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Utilization</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: barColor }}>{lic.usedSeats}/{lic.totalSeats} seats ({utilization}%)</span>
                          </div>
                          <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(utilization, 100)}%`, height: "100%", borderRadius: 3, background: barColor, transition: "width 0.5s ease" }} />
                          </div>
                          {lic.expiryDate && (
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                              Expires: {new Date(lic.expiryDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: 13 }}>No licenses linked to this software</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop for drawer */}
      {selectedSoftware && (
        <div onClick={() => { setSelectedSoftware(null); setEditing(false); }}
          style={{ position: "fixed", top: 0, left: 0, right: 560, bottom: 0, zIndex: 999, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
