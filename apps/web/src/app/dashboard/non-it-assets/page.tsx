"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Armchair, Truck, Wrench, Search, Plus, RefreshCw,
  Filter, SlidersHorizontal, MapPin, Building, DollarSign, Package,
  ExternalLink, User, CheckCircle2, ChevronRight, Upload
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import CreateAssetPanel from "@/components/CreateAssetPanel";
import { PageHelp } from "@/components/HelpSystem";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "green",
  IN_MAINTENANCE: "amber",
  IN_STORAGE: "purple",
  RETIRED: "gray",
  DISPOSED: "red",
};

export default function NonITAssetsPage() {
  const router = useRouter();
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  function load(p = page) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    apiFetch(`/assets?${params}`)
      .then(data => {
        // Filter physical / non-IT assets (those without IP, hostname, and MAC address)
        const nonIt = (data.data || []).filter(
          (a: any) => !a.ipAddress && !a.hostname && !a.macAddress
        );
        setAllAssets(nonIt);
        setFilteredAssets(nonIt);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Sync client-side search & category filters instantly
  useEffect(() => {
    let result = [...allAssets];

    // 1. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        a =>
          a.name?.toLowerCase().includes(q) ||
          a.assetTag?.toLowerCase().includes(q) ||
          a.manufacturer?.toLowerCase().includes(q) ||
          a.model?.toLowerCase().includes(q) ||
          a.room?.toLowerCase().includes(q) ||
          a.site?.name?.toLowerCase().includes(q)
      );
    }

    // 2. Status Filter
    if (statusFilter) {
      result = result.filter(a => a.status === statusFilter);
    }

    // 3. Category Filter
    if (activeCategory) {
      const keywords = activeCategory.split("|");
      result = result.filter(a =>
        keywords.some(
          (kw: string) =>
            a.assetType?.name?.toLowerCase().includes(kw.toLowerCase()) ||
            a.category?.toLowerCase().includes(kw.toLowerCase())
        )
      );
    }

    setFilteredAssets(result);
  }, [search, statusFilter, activeCategory, allAssets]);

  // Dynamic Category Stats definition
  const categories = [
    {
      icon: <Building2 size={20} />,
      label: "Facilities & Offices",
      filter: "Facility|Building|Site|Office|Room|Real Estate",
      count: allAssets.filter(a =>
        /facility|building|site|office|room|real estate/i.test(
          a.assetType?.name || a.category || ""
        )
      ).length,
      color: "blue",
    },
    {
      icon: <Armchair size={20} />,
      label: "Furniture & Fixtures",
      filter: "Furniture|Desk|Chair|Table|Armchair|Fixture",
      count: allAssets.filter(a =>
        /furniture|desk|chair|table|armchair|fixture/i.test(
          a.assetType?.name || a.category || ""
        )
      ).length,
      color: "amber",
    },
    {
      icon: <Truck size={20} />,
      label: "Vehicles & Fleet",
      filter: "Vehicle|Car|Truck|Fleet",
      count: allAssets.filter(a =>
        /vehicle|car|truck|fleet/i.test(a.assetType?.name || a.category || "")
      ).length,
      color: "green",
    },
    {
      icon: <Wrench size={20} />,
      label: "Office Equipment & Tools",
      filter: "Equipment|Tool|AC|Generator|Projector|Appliance",
      count: allAssets.filter(a =>
        /equipment|tool|ac|generator|projector|appliance/i.test(
          a.assetType?.name || a.category || ""
        )
      ).length,
      color: "purple",
    },
  ];

  return (
    <>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Non-IT Assets</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
            Facility, furniture, vehicle, and physical workspace equipment inventory
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => load()} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, padding: 0, borderRadius: 10 }}>
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard/assets/import')} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, fontWeight: 600 }}>
            <Upload size={16} /> Import CSV / JSON
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, fontWeight: 600 }}>
            <Plus size={16} /> Add Physical Asset
          </button>
        </div>
      </div>

      <PageHelp id="nonitassets" title="Physical Inventory (Non-IT Assets)">
        Manage and track your organization's physical capital assets, office furniture, lease contracts, and facility equipment. Click the category stat cards to quickly isolate items by classification.
      </PageHelp>

      {/* Cybernetic Category Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 24 }}>
        {categories.map(c => {
          const isSelected = activeCategory === c.filter;
          return (
            <div key={c.label} className="stat-card category-card"
              style={{
                cursor: "pointer",
                borderLeft: isSelected ? "3.5px solid var(--brand-400)" : "1.5px solid var(--border-primary)",
                borderTop: isSelected ? "1px solid rgba(6,182,212,0.1)" : "1px solid var(--border-primary)",
                borderRight: isSelected ? "1px solid rgba(6,182,212,0.1)" : "1px solid var(--border-primary)",
                borderBottom: isSelected ? "1px solid rgba(6,182,212,0.1)" : "1px solid var(--border-primary)",
                boxShadow: isSelected ? "0 4px 20px rgba(6, 182, 212, 0.08)" : "none",
                background: isSelected ? "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)" : "var(--bg-card)",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                borderRadius: 14,
                position: "relative"
              }}
              onClick={() => setActiveCategory(isSelected ? null : c.filter)}>
              <div className={`stat-icon ${c.color}`} style={{ borderRadius: 10, width: 40, height: 40 }}>{c.icon}</div>
              <div className="stat-content">
                <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: isSelected ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                  {c.label}
                  {isSelected && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand-400)", boxShadow: "0 0 6px var(--brand-400)" }} />}
                </div>
                <div className="stat-value" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{c.count}</div>
              </div>
              <ChevronRight size={14} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", opacity: isSelected ? 0.8 : 0.3 }} />
            </div>
          );
        })}
      </div>

      {/* Cyberpunk Filter and Search Bar */}
      <div className="card" style={{
        marginBottom: 16, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center",
        borderRadius: 14, border: "1px solid var(--border-primary)", background: "var(--bg-card)",
        flexWrap: "wrap"
      }}>
        {/* Instant Search Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "8px 14px" }}>
          <Search size={15} style={{ color: "var(--text-tertiary)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search physical assets, location, tags, tags, serial..."
            style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
          />
        </div>

        {/* Status Chips */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, marginRight: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Filter size={12} /> Status:
          </span>
          {["", "ACTIVE", "IN_MAINTENANCE", "IN_STORAGE", "RETIRED"].map(s => {
            const isSel = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  background: isSel ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.03)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: isSel ? "rgba(6,182,212,0.3)" : "var(--border-primary)",
                  color: isSel ? "#22d3ee" : "var(--text-secondary)",
                }}
              >
                {s ? s.replace("_", " ") : "ALL"}
              </button>
            );
          })}
        </div>

        {/* Reset Filter Button */}
        {(activeCategory || search || statusFilter) && (
          <button
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, marginLeft: "auto" }}
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setActiveCategory(null);
            }}
          >
            Clear Filters ✕
          </button>
        )}
      </div>

      {/* Main Asset Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--border-primary)" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Physical Asset</th>
              <th>Category</th>
              <th>Status</th>
              <th>Location & Site</th>
              <th>Custodian / Assigned To</th>
              <th>Procurement Price</th>
              <th>Warranty</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <RefreshCw size={16} className="spin" style={{ animation: "spin 1.5s linear infinite" }} />
                    Fetching physical inventory data...
                  </div>
                </td>
              </tr>
            ) : filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                  <Package size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>No Physical Assets Found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your category or search filters, or add a new physical asset.</div>
                </td>
              </tr>
            ) : (
              filteredAssets.map((a: any) => (
                <tr key={a.id} style={{ cursor: "pointer", transition: "background 0.1s" }} onClick={() => router.push(`/dashboard/assets/${a.id}`)}>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--brand-400)" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {[a.assetTag, a.serialNumber, a.manufacturer].filter(Boolean).join(" • ")}
                    </div>
                  </td>
                  <td>
                    <span className="badge cyan" style={{ fontWeight: 650 }}>{a.assetType?.name || "Physical Item"}</span>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[a.status] || "gray"}`} style={{ fontWeight: 700 }}>
                      {a.status.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={11} style={{ color: "var(--text-tertiary)" }} />
                      <span>{a.site?.name?.split(" - ")[1] || a.site?.name || "Unassigned Site"}</span>
                    </div>
                    {a.room && (
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, paddingLeft: 15 }}>
                        Room: {a.room} {a.floor ? `(Floor ${a.floor})` : ""}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    {a.assignedTo ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <User size={11} style={{ color: "var(--text-tertiary)" }} />
                        <span>{a.assignedTo.firstName} {a.assignedTo.lastName}</span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)" }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {a.purchasePrice ? `₹${Number(a.purchasePrice).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>—</span>}
                  </td>
                  <td style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                    {a.warrantyExpiry ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, color: new Date(a.warrantyExpiry).getTime() < Date.now() ? "var(--error)" : "var(--text-secondary)" }}>
                        <CheckCircle2 size={11} />
                        <span>{new Date(a.warrantyExpiry).toLocaleDateString("en-IN", { year: "2-digit", month: "short" })}</span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Asset Inline Creator Dialog Modal */}
      <CreateAssetPanel open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => load()} />

      <style>{`
        .category-card:hover {
          transform: translateY(-2px);
          border-color: rgba(6,182,212,0.2) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25), 0 0 12px rgba(6,182,212,0.03);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
