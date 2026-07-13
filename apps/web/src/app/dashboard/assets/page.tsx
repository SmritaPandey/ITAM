"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Filter, Download, RefreshCw, ChevronLeft, ChevronRight, Upload, Layers, ScanLine, Calculator, ClipboardCheck, Bell } from "lucide-react";
import CreateAssetPanel from "@/components/CreateAssetPanel";
import ImportAssetsPanel from "@/components/ImportAssetsPanel";
import EmptyState from "@/components/EmptyState";
import { apiFetch, itamApi } from "@/lib/api";

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
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [pendingAttest, setPendingAttest] = useState(0);
  const [itamBusy, setItamBusy] = useState("");

  function load(p = page, s = search, st = statusFilter) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "15" });
    if (s) params.set("search", s);
    if (st) params.set("status", st);
    apiFetch(`/assets?${params}`)
      .then(setAssets).catch(console.error).finally(() => setLoading(false));
  }

  function loadItam() {
    Promise.all([
      itamApi.depreciationReport().catch(() => null),
      itamApi.pendingAttestations().catch(() => []),
    ]).then(([report, pending]) => {
      setFinanceSummary(report);
      setPendingAttest(Array.isArray(pending) ? pending.length : 0);
    });
  }

  useEffect(() => { load(1); loadItam(); }, []);

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); load(1, search, statusFilter); }

  async function runMassDepreciation() {
    setItamBusy("depreciation");
    try {
      const result = await itamApi.massDepreciation(true);
      alert(`Depreciation updated ${result?.updated ?? 0} of ${result?.total ?? 0} assets.`);
      loadItam();
    } catch (err: any) {
      alert(err?.message || "Mass depreciation failed");
    } finally {
      setItamBusy("");
    }
  }

  async function startAttestation() {
    const name = prompt("Campaign name", `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()} Asset Verification`);
    if (!name) return;
    setItamBusy("attestation");
    try {
      const result = await itamApi.createAttestationCampaign({ campaignName: name });
      alert(`Campaign "${result.campaign}" created for ${result.assetsRequested} assets.`);
      loadItam();
    } catch (err: any) {
      alert(err?.message || "Failed to create campaign");
    } finally {
      setItamBusy("");
    }
  }

  async function remindAttestation() {
    setItamBusy("remind");
    try {
      const result = await itamApi.remindAttestations();
      alert(`Sent ${result.reminded} attestation reminder(s).`);
    } catch (err: any) {
      alert(err?.message || "Remind failed");
    } finally {
      setItamBusy("");
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Assets</h1>
          <p className="page-subtitle">{assets.total} total assets across all categories</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => router.push('/scan')}><ScanLine size={14} /> Scan</button>
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard/assets/import')}><Upload size={14} /> Import CSV</button>
          <button className="btn btn-secondary" onClick={async () => {
            try {
              const token = localStorage.getItem("accessToken") || "";
              const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
              const res = await fetch(`${base}/reports/download/assets?format=csv`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error("Export failed");
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `assets-export-${new Date().toISOString().slice(0,10)}.csv`;
              document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            } catch { alert("Export failed. Please try again."); }
          }}><Download size={14} /> Export</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Add Asset</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: "14px 16px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: "var(--text-secondary)" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 }}>Book value</div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 16 }}>
              {financeSummary ? `$${Number(financeSummary.totalBookValue || 0).toLocaleString()}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 }}>Depreciated</div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 16 }}>
              {financeSummary ? `$${Number(financeSummary.totalDepreciated || 0).toLocaleString()}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 }}>Pending attestations</div>
            <div style={{ fontWeight: 700, color: pendingAttest ? "#f59e0b" : "var(--text-primary)", fontSize: 16 }}>{pendingAttest}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" disabled={!!itamBusy} onClick={runMassDepreciation}>
            <Calculator size={14} /> {itamBusy === "depreciation" ? "Running…" : "Run depreciation"}
          </button>
          <button className="btn btn-secondary" disabled={!!itamBusy} onClick={startAttestation}>
            <ClipboardCheck size={14} /> {itamBusy === "attestation" ? "Creating…" : "Start attestation"}
          </button>
          <button className="btn btn-secondary" disabled={!!itamBusy || pendingAttest === 0} onClick={remindAttestation}>
            <Bell size={14} /> {itamBusy === "remind" ? "Sending…" : "Remind owners"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        <form onSubmit={handleSearch} style={{ flex: 1, display: "flex", gap: 8 }}>
          <div className="topbar-search" style={{ width: "100%", maxWidth: 400 }}>
            <Search size={14} style={{ color: "var(--text-tertiary)" }} />
            <input placeholder="Search name, tag, serial, IP, RFID..." value={search} onChange={e => setSearch(e.target.value)} />
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

      {!loading && assets.data?.length === 0 ? (
        <EmptyState
          icon={<Layers size={40} />}
          title="No assets yet"
          description="Create an asset manually, import a spreadsheet, or discover devices on your network."
          action={{ label: "Go to Discovery", href: "/dashboard/discovery" }}
          secondaryAction={{ label: "Add Asset", onClick: () => setShowCreate(true) }}
        />
      ) : (
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Status</th>
              <th>Software</th>
              <th>Location</th>
              <th>Assigned To</th>
              <th>IP / MAC</th>
              <th>Discovered Via</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading...</td></tr>
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
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(6, 182, 212, 0.1)", color: "#22d3ee", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                    <Layers size={12} />
                    {a.softwareInstalls?.length || a._count?.softwareInstalls || 0}
                  </span>
                </td>
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
      )}
      <CreateAssetPanel open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => load(1)} />
      <ImportAssetsPanel open={showImport} onClose={() => setShowImport(false)} onImported={() => load(1)} />
    </>
  );
}
