"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Filter, Download, RefreshCw, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import CreateAssetPanel from "@/components/CreateAssetPanel";
import ImportAssetsPanel from "@/components/ImportAssetsPanel";
import { apiFetch } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "green", DISCOVERED: "blue", IN_MAINTENANCE: "amber",
  RETIRED: "gray", IN_STORAGE: "purple", DISPOSED: "red", PENDING_REVIEW: "cyan",
};

export default function AssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<any>({ data: [], total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  function load(p = page, s = search, st = statusFilter) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "15" });
    if (s) params.set("search", s);
    if (st) params.set("status", st);
    apiFetch(`/assets?${params}`)
      .then(setAssets).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { load(1); }, []);

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); load(1, search, statusFilter); }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Assets</h1>
          <p className="page-subtitle">{assets.total} total assets across all categories</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard/assets/import')}><Upload size={14} /> Import CSV</button>
          <button className="btn btn-secondary"><Download size={14} /> Export</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Add Asset</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        <form onSubmit={handleSearch} style={{ flex: 1, display: "flex", gap: 8 }}>
          <div className="topbar-search" style={{ width: "100%", maxWidth: 400 }}>
            <Search size={14} style={{ color: "var(--text-tertiary)" }} />
            <input placeholder="Search name, tag, serial, IP..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); load(1, search, e.target.value); }}
            style={{
              background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 8,
              padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none",
            }}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISCOVERED">Discovered</option>
            <option value="IN_MAINTENANCE">In Maintenance</option>
            <option value="RETIRED">Retired</option>
          </select>
          <button type="submit" className="btn btn-secondary"><Filter size={14} /> Apply</button>
        </form>
        <button className="btn btn-secondary" onClick={() => load(page, search, statusFilter)}><RefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Status</th>
              <th>Location</th>
              <th>Assigned To</th>
              <th>IP / MAC</th>
              <th>Discovered Via</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading...</td></tr>
            ) : assets.data?.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No assets found</td></tr>
            ) : assets.data?.map((a: any) => (
              <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/dashboard/assets/${a.id}`)}>
                <td>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {[a.assetTag, a.serialNumber, a.manufacturer].filter(Boolean).join(" • ")}
                  </div>
                </td>
                <td><span className="badge cyan">{a.assetType?.name}</span></td>
                <td><span className={`badge ${STATUS_BADGE[a.status] || "gray"}`}>{a.status.replace("_", " ")}</span></td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {a.site?.name || "—"}{a.department ? ` / ${a.department.name}` : ""}
                </td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : "—"}
                </td>
                <td style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                  {a.ipAddress || "—"}
                </td>
                <td><span className="badge gray">{a.discoverySource || "—"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {assets.totalPages > 1 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 20px", borderTop: "1px solid var(--border-primary)",
          }}>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              Page {assets.page} of {assets.totalPages} ({assets.total} total)
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}>
                <ChevronLeft size={14} /> Prev
              </button>
              <button className="btn btn-secondary" disabled={page >= assets.totalPages} onClick={() => { setPage(page + 1); load(page + 1); }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      <CreateAssetPanel open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => load(1)} />
      <ImportAssetsPanel open={showImport} onClose={() => setShowImport(false)} onImported={() => load(1)} />
    </>
  );
}
