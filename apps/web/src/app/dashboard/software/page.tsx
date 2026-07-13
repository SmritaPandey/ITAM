"use client";
import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Search, RefreshCw, Loader2, ChevronRight, X,
  Shield, ShieldCheck, AlertTriangle,
  Monitor, Package, Clock, CheckCircle2,
  Edit3, Ban, Link2, Unlink, Key
} from "lucide-react";
import { apiFetch, apiFetchOptional, softwareItamApi } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const selectStyle: CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-primary)",
  borderRadius: 9,
  padding: "8px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  cursor: "pointer",
  minWidth: 140,
};

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
  blacklistedCount: number;
  requiredCount: number;
  highRiskCount: number;
  topPublishers: { publisher: string; count: number }[];
  topCategories: { category: string; count: number }[];
  topInstalled: { id: string; name: string; publisher: string; installCount?: number; installationCount?: number }[];
};

const AUTH_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  AUTHORIZED: { bg: "rgba(16, 185, 129, 0.14)", border: "rgba(16, 185, 129, 0.35)", text: "#059669", label: "Authorized" },
  REQUIRED: { bg: "rgba(59, 130, 246, 0.14)", border: "rgba(59, 130, 246, 0.35)", text: "#2563eb", label: "Required" },
  NEEDS_REVIEW: { bg: "rgba(245, 158, 11, 0.16)", border: "rgba(245, 158, 11, 0.4)", text: "#b45309", label: "Needs Review" },
  UNAUTHORIZED: { bg: "rgba(239, 68, 68, 0.14)", border: "rgba(239, 68, 68, 0.35)", text: "#dc2626", label: "Unauthorized" },
  BLACKLISTED: { bg: "rgba(127, 29, 29, 0.14)", border: "rgba(127, 29, 29, 0.35)", text: "#b91c1c", label: "Blacklisted" },
};

const LIFECYCLE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  CURRENT: { bg: "rgba(16, 185, 129, 0.14)", border: "rgba(16, 185, 129, 0.35)", text: "#059669", label: "Current" },
  APPROACHING_EOL: { bg: "rgba(245, 158, 11, 0.16)", border: "rgba(245, 158, 11, 0.4)", text: "#b45309", label: "Approaching EOL" },
  EOL: { bg: "rgba(239, 68, 68, 0.14)", border: "rgba(239, 68, 68, 0.35)", text: "#dc2626", label: "End of Life" },
  EOS: { bg: "rgba(127, 29, 29, 0.14)", border: "rgba(127, 29, 29, 0.35)", text: "#b91c1c", label: "End of Support" },
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

function StatusBadge({ status, map }: { status: string | null; map: typeof AUTH_COLORS | typeof LIFECYCLE_COLORS }) {
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
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [authFilter, setAuthFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("");
  const [sortBy, setSortBy] = useState("installCount");
  const [selectedSoftware, setSelectedSoftware] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [riskDist, setRiskDist] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<"inventory" | "risk" | "alerts" | "harvest">("inventory");
  const [harvestRows, setHarvestRows] = useState<any[]>([]);
  const [harvestLoading, setHarvestLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "assets" | "users" | "licenses">("overview");
  const [detailData, setDetailData] = useState<any>(null);
  const [detailAssets, setDetailAssets] = useState<any[]>([]);
  const [detailUsers, setDetailUsers] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [licenseCandidates, setLicenseCandidates] = useState<any[]>([]);
  const [licenseLinkLoading, setLicenseLinkLoading] = useState(false);
  const [showLicensePicker, setShowLicensePicker] = useState(false);
  const [mounted, setMounted] = useState(false);
  const limit = 25;

  useEffect(() => { setMounted(true); }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
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
        apiFetch(`/software?${params.toString()}`, { timeoutMs: 45000, retryOnTimeout: true }),
        apiFetchOptional("/software/dashboard", { timeoutMs: 20000 }),
      ]);
      setSoftware(list?.data || []);
      setTotal(list?.total || 0);
      if (stats) setDashboard(stats);

      // Secondary CSAM widgets — non-blocking
      Promise.all([
        apiFetchOptional("/software/risk-distribution"),
        apiFetchOptional("/software/compliance"),
        apiFetchOptional("/software/alerts"),
      ]).then(([rd, comp, a]) => {
        setRiskDist(rd);
        setCompliance(comp);
        setAlerts(Array.isArray(a) ? a : []);
      });
    } catch (err: any) {
      console.error("Software load failed:", err);
      setError(err.message || "Failed to load software inventory. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, authFilter, lifecycleFilter, categoryFilter, publisherFilter, sortBy]);

  const handleSync = async () => {
    if (!confirm("This will manually re-sync software installations from the latest discovery data for all approved assets. Continue?")) return;
    setSyncing(true);
    try {
      const res = await apiFetch("/software/sync", { method: "POST" });
      refresh();
      alert(`Sync successful! Processed ${res.processedAssets} assets.`);
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const loadHarvest = async () => {
    setHarvestLoading(true);
    try {
      const rows = await softwareItamApi.harvest(90);
      setHarvestRows(Array.isArray(rows) ? rows : []);
    } catch {
      setHarvestRows([]);
    } finally {
      setHarvestLoading(false);
    }
  };

  const pushPolicy = async () => {
    try {
      const res = await softwareItamApi.pushPolicy();
      alert(`Pushed policy to ${res.agentsUpdated} agent(s) — ${res.blacklistCount} blacklisted.`);
    } catch (err: any) {
      alert(err?.message || "Failed to push policy");
    }
  };

  useEffect(() => { refresh(); }, [refresh]);

  async function loadDetail(sw: Software) {
    setSelectedSoftware(sw);
    setDetailTab("overview");
    setDetailLoading(true);
    setEditing(false);
    setShowLicensePicker(false);
    setLicenseCandidates([]);
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

  async function loadLicenseCandidates(sw: { id: string; name: string }) {
    setLicenseLinkLoading(true);
    try {
      const matches = await apiFetch(
        `/licenses/match?name=${encodeURIComponent(sw.name)}&softwareCatalogId=${sw.id}`,
      );
      setLicenseCandidates(
        (Array.isArray(matches) ? matches : []).filter(
          (l: any) => l.softwareCatalogId !== sw.id,
        ),
      );
      setShowLicensePicker(true);
    } catch (err) {
      console.error("License match failed:", err);
      window.alert("Failed to load matching licenses");
    } finally {
      setLicenseLinkLoading(false);
    }
  }

  async function linkLicense(licenseId: string) {
    if (!selectedSoftware) return;
    setLicenseLinkLoading(true);
    try {
      await apiFetch(`/licenses/${licenseId}/link`, {
        method: "POST",
        body: JSON.stringify({ softwareCatalogId: selectedSoftware.id }),
      });
      const detail = await apiFetch(`/software/${selectedSoftware.id}`);
      setDetailData(detail);
      setShowLicensePicker(false);
      setLicenseCandidates([]);
    } catch (err: any) {
      window.alert(err.message || "Failed to link license");
    } finally {
      setLicenseLinkLoading(false);
    }
  }

  async function unlinkLicense(licenseId: string) {
    if (!selectedSoftware) return;
    if (!confirm("Unlink this license from the software?")) return;
    setLicenseLinkLoading(true);
    try {
      await apiFetch(`/licenses/${licenseId}/unlink`, { method: "POST" });
      const detail = await apiFetch(`/software/${selectedSoftware.id}`);
      setDetailData(detail);
    } catch (err: any) {
      window.alert(err.message || "Failed to unlink license");
    } finally {
      setLicenseLinkLoading(false);
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
  const hasActiveFilters = !!(authFilter || lifecycleFilter || publisherFilter || categoryFilter || searchQuery);

  const applyAuthFilter = (val: string) => {
    setAuthFilter(val);
    setPage(1);
    setActiveView("inventory");
  };

  const kpiCards: { key: string; label: string; value: number; color: string; lifecycle?: boolean }[] = dashboard
    ? [
        { key: "", label: "Total", value: dashboard.totalSoftware, color: "var(--brand-500)" },
        { key: "AUTHORIZED", label: "Authorized", value: dashboard.authorizedCount, color: "#10b981" },
        { key: "UNAUTHORIZED", label: "Unauthorized", value: dashboard.unauthorizedCount, color: "#ef4444" },
        { key: "NEEDS_REVIEW", label: "Needs review", value: dashboard.needsReviewCount, color: "#f59e0b" },
        { key: "EOL", label: "EOL / EOS", value: dashboard.eolCount, color: "#f97316", lifecycle: true },
        ...(dashboard.blacklistedCount > 0
          ? [{ key: "BLACKLISTED", label: "Blacklisted", value: dashboard.blacklistedCount, color: "#b91c1c" }]
          : []),
      ]
    : [];

  if (error && !dashboard) {
    return (
      <EmptyState
        icon={<AlertTriangle size={36} />}
        title="Unable to load software"
        description={error}
        action={{ label: "Retry", onClick: () => refresh() }}
      />
    );
  }

  const VIEW_TABS: { id: typeof activeView; label: string }[] = [
    { id: "inventory", label: "Inventory" },
    { id: "risk", label: "Risk & compliance" },
    { id: "alerts", label: alerts.length ? `Alerts (${alerts.length})` : "Alerts" },
    { id: "harvest", label: "License harvest" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Software asset management"
        title="Software inventory"
        description={`${total.toLocaleString()} titles discovered from agents and scans`}
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={refresh}
              disabled={loading}
              title="Refresh"
              style={{ width: 36, height: 36, padding: 0, display: "grid", placeItems: "center" }}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button className="btn btn-secondary" onClick={pushPolicy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Ban size={14} /> Push blacklist
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSync}
              disabled={syncing}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {syncing ? "Syncing…" : "Sync discovery"}
            </button>
          </>
        }
      />

      {/* View tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border-primary)",
          paddingBottom: 0,
        }}
      >
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeView === tab.id}
            onClick={() => {
              setActiveView(tab.id);
              if (tab.id === "harvest") loadHarvest();
            }}
            style={{
              padding: "10px 16px",
              marginBottom: -1,
              border: "none",
              borderBottom: activeView === tab.id ? "2px solid var(--brand-500)" : "2px solid transparent",
              background: "transparent",
              color: activeView === tab.id ? "var(--text-primary)" : "var(--text-tertiary)",
              fontSize: 13,
              fontWeight: 650,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI strip — clickable filters */}
      {dashboard && activeView === "inventory" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {kpiCards.map((k) => {
            const active = k.lifecycle
              ? lifecycleFilter === "EOL" || lifecycleFilter === "EOS"
              : authFilter === k.key && (k.key !== "" || !authFilter);
            const isAll = k.key === "";
            const selected = isAll ? !authFilter && !lifecycleFilter : active;
            return (
              <button
                key={k.label}
                type="button"
                onClick={() => {
                  if (k.lifecycle) {
                    setLifecycleFilter(lifecycleFilter === "EOL" ? "" : "EOL");
                    setAuthFilter("");
                    setPage(1);
                    setActiveView("inventory");
                  } else {
                    setLifecycleFilter("");
                    applyAuthFilter(authFilter === k.key ? "" : k.key);
                  }
                }}
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: selected ? `1.5px solid ${k.color}` : "1px solid var(--border-primary)",
                  background: selected ? `color-mix(in srgb, ${k.color} 12%, var(--bg-card))` : "var(--bg-card)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 4 }}>
                  {k.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 750, color: k.color, letterSpacing: "-0.03em", fontFamily: "var(--font-display), inherit" }}>
                  {k.value}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Inventory */}
      {activeView === "inventory" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-card)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: "1 1 220px",
                minWidth: 180,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-primary)",
                borderRadius: 9,
                padding: "8px 12px",
              }}
            >
              <Search size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search name or publisher…"
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={authFilter}
              onChange={(e) => { setAuthFilter(e.target.value); setPage(1); }}
              style={selectStyle}
            >
              <option value="">All authorization</option>
              {Object.entries(AUTH_COLORS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select
              value={lifecycleFilter}
              onChange={(e) => { setLifecycleFilter(e.target.value); setPage(1); }}
              style={selectStyle}
            >
              <option value="">All lifecycle</option>
              {Object.entries(LIFECYCLE_COLORS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
              <option value="installCount">Most installed</option>
              <option value="name">Name A–Z</option>
              <option value="riskScore">Risk score</option>
              <option value="createdAt">Recently added</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setAuthFilter("");
                  setLifecycleFilter("");
                  setPublisherFilter("");
                  setCategoryFilter("");
                  setSearchQuery("");
                  setPage(1);
                }}
                style={{ fontSize: 12, padding: "8px 12px" }}
              >
                Clear filters
              </button>
            )}
          </div>

          {loading && software.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 64, color: "var(--text-tertiary)" }}>
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : software.length === 0 ? (
            <EmptyState
              icon={<Package size={36} />}
              title="No software found"
              description={
                hasActiveFilters
                  ? "Nothing matches these filters. Clear them or sync discovery again."
                  : "Titles appear after agent heartbeats or SSH/WMI enrichment. Approve devices in Discovery and sync."
              }
              action={
                hasActiveFilters
                  ? { label: "Clear filters", onClick: () => { setAuthFilter(""); setLifecycleFilter(""); setSearchQuery(""); setPage(1); } }
                  : { label: "Open Discovery", href: "/dashboard/discovery" }
              }
              secondaryAction={
                hasActiveFilters
                  ? undefined
                  : { label: "Sync discovery", onClick: () => handleSync(), variant: "secondary" }
              }
            />
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-elevated)" }}>
                      {["Software", "Publisher", "Category", "Status", "Risk", "Installs", ""].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: "var(--text-tertiary)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {software.map((sw) => {
                      const installs = sw._count?.installations ?? sw.installCount ?? 0;
                      return (
                        <tr
                          key={sw.id}
                          onClick={() => loadDetail(sw)}
                          style={{ borderBottom: "1px solid var(--border-primary)", cursor: "pointer" }}
                          className="table-row-hover"
                        >
                          <td style={{ padding: "14px 16px", maxWidth: 240 }}>
                            <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text-primary)" }}>{sw.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                              {sw.latestVersion ? `v${sw.latestVersion}` : "Version unknown"}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{sw.publisher || "—"}</td>
                          <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{sw.category || "—"}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              <StatusBadge status={sw.authorizationStatus} map={AUTH_COLORS} />
                              {sw.lifecycleStatus && sw.lifecycleStatus !== "CURRENT" && (
                                <StatusBadge status={sw.lifecycleStatus} map={LIFECYCLE_COLORS} />
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px" }}><RiskBadge score={sw.riskScore} /></td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 650, fontSize: 13 }}>
                              <Monitor size={14} style={{ color: "var(--text-tertiary)" }} /> {installs}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderTop: "1px solid var(--border-primary)",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ fontSize: 12, padding: "6px 12px" }}>
                      Previous
                    </button>
                    <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ fontSize: 12, padding: "6px 12px" }}>
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Risk & Compliance View */}
      {activeView === "risk" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Compliance score
              </div>
              {(() => {
                const pct = compliance?.compliancePercentage ?? 0;
                const gaugeColor = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <div style={{ position: "relative", width: 140, height: 140 }}>
                    <div
                      style={{
                        width: 140,
                        height: 140,
                        borderRadius: "50%",
                        background: `conic-gradient(${gaugeColor} ${pct * 3.6}deg, rgba(255,255,255,0.06) ${pct * 3.6}deg)`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 14,
                        borderRadius: "50%",
                        background: "var(--bg-card)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div style={{ fontSize: 28, fontWeight: 750, color: gaugeColor, fontFamily: "var(--font-display), inherit" }}>{pct}%</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Compliant</div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-secondary)" }}>
                <span>{compliance?.breakdown?.authorized ?? compliance?.compliantCount ?? 0} authorized</span>
                <span>{compliance?.breakdown?.unauthorized ?? 0} unauthorized</span>
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 18 }}>
                Risk distribution
              </div>
              {(() => {
                const buckets = [
                  { label: "Critical", count: riskDist?.buckets?.critical ?? 0, color: "#ef4444" },
                  { label: "High", count: riskDist?.buckets?.high ?? 0, color: "#f59e0b" },
                  { label: "Medium", count: riskDist?.buckets?.medium ?? 0, color: "#60a5fa" },
                  { label: "Low", count: riskDist?.buckets?.low ?? 0, color: "#10b981" },
                ];
                const maxCount = Math.max(...buckets.map((b) => b.count), 1);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {buckets.map((b) => (
                      <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 64, fontSize: 12, fontWeight: 650, color: b.color }}>{b.label}</div>
                        <div style={{ flex: 1, height: 20, borderRadius: 6, background: "var(--bg-elevated)", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${(b.count / maxCount) * 100}%`,
                              height: "100%",
                              borderRadius: 6,
                              background: b.color,
                              opacity: 0.85,
                              minWidth: b.count > 0 ? 4 : 0,
                            }}
                          />
                        </div>
                        <div style={{ width: 36, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{b.count}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", fontSize: 13, fontWeight: 650 }}>
              Top risky assets
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-elevated)" }}>
                    {["#", "Asset", "Tag", "Hostname", "IP", "Risk"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(riskDist?.topRiskyAssets || []).slice(0, 10).map((asset: any, i: number) => (
                    <tr key={asset.id || i} style={{ borderBottom: "1px solid var(--border-primary)" }} className="table-row-hover">
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: i < 3 ? "#ef4444" : "var(--text-secondary)" }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 650 }}>{asset.name || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                        {asset.assetTag || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)" }}>{asset.hostname || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                        {asset.ipAddress || "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <RiskBadge score={asset.riskScore ?? null} />
                      </td>
                    </tr>
                  ))}
                  {(!riskDist?.topRiskyAssets || riskDist.topRiskyAssets.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: 13 }}>
                        No risk data yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              { label: "End of life", value: compliance?.lifecycle?.eolCount ?? dashboard?.eolCount ?? 0, hint: "Past EOL date", color: "#ef4444", icon: <AlertTriangle size={18} /> },
              { label: "End of support", value: compliance?.lifecycle?.eosCount ?? 0, hint: "No vendor support", color: "#f97316", icon: <Shield size={18} /> },
              { label: "Approaching EOL", value: compliance?.lifecycle?.approachingEol ?? 0, hint: "Within 6 months", color: "#f59e0b", icon: <Clock size={18} /> },
            ].map((item) => (
              <div
                key={item.label}
                className="card"
                style={{
                  padding: "18px 20px",
                  borderColor: `color-mix(in srgb, ${item.color} 35%, var(--border-primary))`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: item.color, marginBottom: 8 }}>
                  {item.icon}
                  <span style={{ fontSize: 12, fontWeight: 650 }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 750, color: item.color, fontFamily: "var(--font-display), inherit" }}>{item.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{item.hint}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Alerts View */}
      {activeView === "alerts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alerts.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={36} />}
              title="No active alerts"
              description="Alerts appear when unauthorized, blacklisted, or high-risk software is detected on assets."
            />
          ) : (
            alerts.map((alert: any, i: number) => {
              const sevColor = alert.severity === "CRITICAL" ? "#ef4444" : alert.severity === "HIGH" ? "#f59e0b" : "#60a5fa";
              return (
                <div
                  key={alert.id || i}
                  className="card"
                  style={{
                    padding: "16px 20px",
                    borderLeft: `3px solid ${sevColor}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          background: `color-mix(in srgb, ${sevColor} 18%, transparent)`,
                          color: sevColor,
                        }}
                      >
                        {alert.severity || "MEDIUM"}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                        {alert.alertType || alert.type || "Detection"}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {alert.detectedAt ? new Date(alert.detectedAt).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 13 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Software</div>
                      <div style={{ fontWeight: 650 }}>
                        {alert.software?.name || alert.softwareName || "—"}{" "}
                        <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>{alert.version ? `v${alert.version}` : ""}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Asset</div>
                      <div style={{ fontWeight: 600 }}>
                        {alert.asset?.name || alert.assetName || "—"}{" "}
                        <span style={{ fontWeight: 400, color: "var(--text-tertiary)", fontFamily: "monospace", fontSize: 11 }}>
                          {alert.asset?.assetTag || alert.assetTag || ""}
                        </span>
                      </div>
                    </div>
                    {(alert.asset?.ipAddress || alert.ipAddress) && (
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>IP</div>
                        <div style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{alert.asset?.ipAddress || alert.ipAddress}</div>
                      </div>
                    )}
                    {(alert.asset?.assignedTo || alert.assignedUser) && (
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Assigned to</div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {alert.asset?.assignedTo
                            ? `${alert.asset.assignedTo.firstName || ""} ${alert.asset.assignedTo.lastName || ""}`.trim()
                            : alert.assignedUser}
                        </div>
                      </div>
                    )}
                    {alert.installPath && (
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Install path</div>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{alert.installPath}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeView === "harvest" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              Unused installs (90+ days) on licensed titles — reclaim seats and open tickets.
            </p>
            <button
              className="btn btn-secondary"
              onClick={loadHarvest}
              disabled={harvestLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <RefreshCw size={14} className={harvestLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
          {harvestLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : harvestRows.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={36} />}
              title="No reclaim candidates"
              description="Licensed software appears actively used across discovered installs."
            />
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-elevated)" }}>
                    {["Software", "Asset", "Last used", "Days unused", ""].map((h) => (
                      <th
                        key={h || "action"}
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {harvestRows.map((row) => (
                    <tr key={row.installationId} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 650, fontSize: 13 }}>{row.softwareName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{row.publisher || "—"}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }}>
                        {row.assetName}
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                          {row.assetTag || row.hostname || ""}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-secondary)" }}>
                        {row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleDateString() : "Never"}
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#f59e0b" }}>{row.daysUnused ?? "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: "6px 10px" }}
                          onClick={async () => {
                            try {
                              const res = await softwareItamApi.reclaim({
                                installationId: row.installationId,
                                createTicket: true,
                                uninstall: true,
                              });
                              alert(`Reclaim ticket ${res.ticket?.ticketNumber || "created"}${res.agentAction ? " + uninstall queued" : ""}.`);
                              loadHarvest();
                            } catch (err: any) {
                              alert(err?.message || "Reclaim failed");
                            }
                          }}
                        >
                          Reclaim
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detail Drawer — portaled so it is never clipped by page layout */}
      {mounted && selectedSoftware && createPortal(
        <>
          <div
            onClick={() => { setSelectedSoftware(null); setEditing(false); }}
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1200,
              background: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selectedSoftware.name}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(560px, 100vw)",
              zIndex: 1201,
              background: "var(--bg-card)",
              borderLeft: "1px solid var(--border-primary)",
              boxShadow: "-12px 0 48px rgba(15, 23, 42, 0.18)",
              display: "flex",
              flexDirection: "column",
              animation: "swDrawerIn 0.25s ease-out both",
              color: "var(--text-primary)",
            }}
          >
          {/* Drawer Header */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "var(--bg-card)", flexShrink: 0 }}>
            <div style={{ minWidth: 0, paddingRight: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 750, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>{selectedSoftware.name}</h2>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>{selectedSoftware.publisher || "Unknown publisher"} · {selectedSoftware.category || "Uncategorized"}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {!editing && detailTab === "overview" && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <Edit3 size={12} /> Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => { setSelectedSoftware(null); setEditing(false); }}
                aria-label="Close"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-primary)", padding: "0 16px", background: "var(--bg-card)", flexShrink: 0 }}>
            {(["overview", "assets", "users", "licenses"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDetailTab(tab)}
                style={{
                  padding: "12px 14px",
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: "pointer",
                  color: detailTab === tab ? "var(--brand-600)" : "var(--text-secondary)",
                  border: "none",
                  borderBottom: detailTab === tab ? "2px solid var(--brand-500)" : "2px solid transparent",
                  background: "none",
                  textTransform: "capitalize",
                  fontFamily: "inherit",
                  marginBottom: -1,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Drawer Content */}
          <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", background: "var(--bg-card)", color: "var(--text-primary)", minHeight: 0 }}>
            {detailLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-secondary)" }}>
                <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : detailTab === "overview" ? (
              <div>
                {editing ? (
                  /* Edit Form */
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Authorization Status</label>
                      <select value={editForm.authorizationStatus} onChange={e => setEditForm({ ...editForm, authorizationStatus: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                        <option value="AUTHORIZED">Authorized</option>
                        <option value="UNAUTHORIZED">Unauthorized</option>
                        <option value="NEEDS_REVIEW">Needs Review</option>
                        <option value="REQUIRED">Required</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Lifecycle Status</label>
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
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>EOL Date</label>
                        <input type="date" value={editForm.eolDate} onChange={e => setEditForm({ ...editForm, eolDate: e.target.value })}
                          style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>EOS Date</label>
                        <input type="date" value={editForm.eosDate} onChange={e => setEditForm({ ...editForm, eosDate: e.target.value })}
                          style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Risk Score (0-100)</label>
                      <input type="number" min="0" max="100" value={editForm.riskScore} onChange={e => setEditForm({ ...editForm, riskScore: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Description</label>
                      <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3}
                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => setEditing(false)} style={{ padding: "8px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                      <button onClick={handleSaveEdit} style={{ padding: "8px 20px", borderRadius: 8, background: "var(--brand-500)", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save Changes</button>
                    </div>
                  </div>
                ) : (
                  /* Overview Display */
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 12 }}>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>Authorization</div>
                        <StatusBadge status={detailData?.authorizationStatus} map={AUTH_COLORS} />
                      </div>
                      <div style={{ padding: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 12 }}>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>Lifecycle</div>
                        <StatusBadge status={detailData?.lifecycleStatus} map={LIFECYCLE_COLORS} />
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Risk Assessment</div>
                      <div style={{ padding: 16, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Security Risk Score</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: (detailData?.riskScore || 0) > 70 ? "#dc2626" : "#059669" }}>{detailData?.riskScore || 0}/100</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: "var(--bg-primary)", overflow: "hidden", border: "1px solid var(--border-primary)" }}>
                          <div style={{ width: `${Math.min(100, detailData?.riskScore || 0)}%`, height: "100%", background: (detailData?.riskScore || 0) > 70 ? "#ef4444" : "#10b981" }} />
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 12, lineHeight: 1.5 }}>
                          Calculated based on version age, lifecycle status, and known vulnerabilities for this category.
                        </p>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Description</div>
                      <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
                        {detailData?.description || "No description available for this software."}
                      </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>End of Life</div>
                        <div style={{ fontSize: 13, color: detailData?.eolDate ? "#dc2626" : "var(--text-primary)" }}>
                          <Clock size={12} style={{ marginRight: 6, display: "inline" }} />
                          {detailData?.eolDate ? new Date(detailData.eolDate).toLocaleDateString() : "Not defined"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>End of Support</div>
                        <div style={{ fontSize: 13, color: detailData?.eosDate ? "#dc2626" : "var(--text-primary)" }}>
                          <Shield size={12} style={{ marginRight: 6, display: "inline" }} />
                          {detailData?.eosDate ? new Date(detailData.eosDate).toLocaleDateString() : "Not defined"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : detailTab === "assets" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {detailAssets.map(asset => (
                  <div key={asset.id} style={{ padding: 12, border: "1px solid var(--border-primary)", borderRadius: 12, background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{asset.hostname || asset.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{asset.ipAddress} · {asset.osFamily} {asset.osVersion}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>v{asset.softwareVersion || "?.?"}</div>
                  </div>
                ))}
                {detailAssets.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)", fontSize: 13 }}>No installations found.</div>}
              </div>
            ) : detailTab === "users" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {detailUsers.map(user => (
                  <div key={user.id} style={{ padding: 12, border: "1px solid var(--border-primary)", borderRadius: 12, background: "var(--bg-elevated)", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: "var(--brand-500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white" }}>
                      {user.name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{user.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{user.email} · {user.department}</div>
                    </div>
                  </div>
                ))}
                {detailUsers.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)", fontSize: 13 }}>No users associated with this software.</div>}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Linked Licenses</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      Seats and entitlement tied to this software title
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 11, padding: "6px 12px" }}
                    disabled={licenseLinkLoading}
                    onClick={() => loadLicenseCandidates(selectedSoftware)}
                  >
                    {licenseLinkLoading
                      ? <Loader2 size={12} className="animate-spin" />
                      : <><Link2 size={12} /> Link License</>}
                  </button>
                </div>

                {(detailData?.licenses || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)", fontSize: 13, border: "1px dashed var(--border-primary)", borderRadius: 10 }}>
                    <Key size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>No licenses linked</div>
                    <div style={{ fontSize: 12 }}>Link an existing license record by name match, or create one under Licenses.</div>
                  </div>
                ) : (
                  (detailData.licenses as any[]).map((lic: any) => (
                    <div key={lic.id} className="card" style={{ padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{lic.softwareName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                            {lic.status || "ACTIVE"}
                            {lic.expiryDate ? ` · Expires ${new Date(lic.expiryDate).toLocaleDateString()}` : ""}
                            {lic.complianceStatus ? ` · ${lic.complianceStatus}` : ""}
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 10, padding: "4px 8px", color: "#f87171" }}
                          disabled={licenseLinkLoading}
                          onClick={() => unlinkLicense(lic.id)}
                        >
                          <Unlink size={11} /> Unlink
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Seats</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {lic.usedSeats ?? 0} / {lic.totalSeats ?? 0}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Actual usage</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{lic.actualUsage ?? "—"}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Utilization</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: (lic.utilization || 0) > 100 ? "#f87171" : "var(--text-primary)" }}>
                            {lic.utilization != null ? `${lic.utilization}%` : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {showLicensePicker && (
                  <div style={{ border: "1px solid var(--border-primary)", borderRadius: 10, padding: 12, background: "var(--bg-elevated)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Matching licenses</div>
                      <button className="btn btn-secondary" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => setShowLicensePicker(false)}>
                        <X size={11} /> Close
                      </button>
                    </div>
                    {licenseCandidates.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: 12, textAlign: "center" }}>
                        No matching licenses found. Create one on the Licenses page with this software name.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {licenseCandidates.map((lic: any) => (
                          <div key={lic.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{lic.softwareName}</div>
                              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                                {lic.usedSeats}/{lic.totalSeats} seats · {lic.status}
                                {lic.softwareCatalogId ? " · already linked elsewhere" : ""}
                              </div>
                            </div>
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: 10, padding: "4px 10px" }}
                              disabled={licenseLinkLoading || lic.softwareCatalogId === selectedSoftware?.id}
                              onClick={() => linkLicense(lic.id)}
                            >
                              <Link2 size={11} /> {lic.softwareCatalogId === selectedSoftware?.id ? "Linked" : "Assign"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        </>,
        document.body,
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes swDrawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .table-row-hover:hover { background: rgba(255,255,255,0.02) !important; }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </>
  );
}
