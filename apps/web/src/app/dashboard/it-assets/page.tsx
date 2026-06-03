"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor, Cpu, HardDrive, Wifi, ExternalLink, Search, Plus, RefreshCw,
  Filter, Copy, Check, CheckCircle2, ChevronRight, User, Globe, Activity, Scan
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import CreateAssetPanel from "@/components/CreateAssetPanel";
import { PageHelp } from "@/components/HelpSystem";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "green",
  DISCOVERED: "blue",
  IN_MAINTENANCE: "amber",
  RETIRED: "gray",
  IN_STORAGE: "purple",
  DISPOSED: "red",
  PENDING_REVIEW: "cyan"
};

export default function ITAssetsPage() {
  const router = useRouter();
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedMacId, setCopiedMacId] = useState<string | null>(null);
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
        // Filter IT assets only (those with IP, hostname, or MAC address)
        const itAssets = (data.data || []).filter(
          (a: any) => a.ipAddress || a.hostname || a.macAddress
        );
        setAllAssets(itAssets);
        setFilteredAssets(itAssets);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Sync client-side search, status, and category filters instantly
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
          a.hostname?.toLowerCase().includes(q) ||
          a.ipAddress?.toLowerCase().includes(q) ||
          a.macAddress?.toLowerCase().includes(q)
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

  const handleCopyMac = (e: React.MouseEvent, mac: string, id: string) => {
    e.stopPropagation();
    if (!mac) return;
    navigator.clipboard.writeText(mac);
    setCopiedMacId(id);
    setTimeout(() => setCopiedMacId(null), 2000);
  };

  // Dynamic IT Category counters based on database records
  const categories = [
    {
      icon: <Monitor size={20} />,
      label: "Workstations & Laptops",
      filter: "Laptop|Desktop|Workstation|Notebook|PC",
      count: allAssets.filter(a =>
        /laptop|desktop|workstation|notebook|pc/i.test(
          a.assetType?.name || a.category || ""
        )
      ).length,
      color: "cyan",
    },
    {
      icon: <HardDrive size={20} />,
      label: "Infrastructure & Servers",
      filter: "Server|VM|Virtual|Database|Hypervisor",
      count: allAssets.filter(a =>
        /server|vm|virtual|database|hypervisor/i.test(
          a.assetType?.name || a.category || ""
        )
      ).length,
      color: "purple",
    },
    {
      icon: <Cpu size={20} />,
      label: "Network Devices",
      filter: "Switch|Router|Firewall|Gateway|Access Point",
      count: allAssets.filter(a =>
        /switch|router|firewall|gateway|access point/i.test(
          a.assetType?.name || a.category || ""
        )
      ).length,
      color: "blue",
    },
    {
      icon: <Wifi size={20} />,
      label: "Peripherals & IoT",
      filter: "Printer|Camera|Scanner|Peripheral|IoT",
      count: allAssets.filter(a =>
        /printer|camera|scanner|peripheral|iot/i.test(
          a.assetType?.name || a.category || ""
        )
      ).length,
      color: "green",
    },
  ];

  return (
    <>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>IT Assets</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
            Networked hardware, active computing workstations, server infrastructure, and network adapters
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => load()} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, padding: 0, borderRadius: 10 }}>
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard/discovery')} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, fontWeight: 600 }}>
            <Scan size={15} /> Scan Subnet
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, fontWeight: 600 }}>
            <Plus size={16} /> Add IT Host
          </button>
        </div>
      </div>

      <PageHelp id="itassets" title="Active IT Inventory (Network Hosts)">
        Monitor and audit your active IT assets, workstations, and server architectures. Category chips filter devices dynamically. Click any row to inspect deep local agent parameters, OS configurations, patch history, or security postures.
      </PageHelp>

      {/* Cybernetic Category KPI Cards */}
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

      {/* Omni-Filter and Search Console */}
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
            placeholder="Search hostnames, IP address, MAC, serial, asset tag..."
            style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
          />
        </div>

        {/* Status Filters */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, marginRight: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Filter size={12} /> Status:
          </span>
          {["", "ACTIVE", "DISCOVERED", "IN_MAINTENANCE", "RETIRED"].map(s => {
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

      {/* Re-engineered IT Host Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--border-primary)" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>IT Device</th>
              <th>Type</th>
              <th>Hostname</th>
              <th>IP Address</th>
              <th>MAC Address</th>
              <th>Status</th>
              <th>Discovery Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <RefreshCw size={16} className="spin" style={{ animation: "spin 1.5s linear infinite" }} />
                    Fetching network host telemetry...
                  </div>
                </td>
              </tr>
            ) : filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                  <Activity size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>No Active IT Assets Found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Run a subnet discovery scan or add a new host manually.</div>
                </td>
              </tr>
            ) : (
              filteredAssets.map((a: any) => {
                const hasPing = a.status === "ACTIVE" && a.ipAddress;
                return (
                  <tr key={a.id} style={{ cursor: "pointer", transition: "background 0.1s" }} onClick={() => router.push(`/dashboard/assets/${a.id}`)}>
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--brand-400)" }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                        {[a.assetTag, a.serialNumber, a.manufacturer].filter(Boolean).join(" • ")}
                      </div>
                    </td>
                    <td>
                      <span className="badge purple" style={{ fontWeight: 650 }}>{a.assetType?.name || "Network CI"}</span>
                    </td>
                    <td style={{ fontSize: 12.5, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                      {a.hostname || <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "var(--text-primary)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {hasPing ? (
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%", background: "#10b981",
                            boxShadow: "0 0 8px #10b981", display: "inline-block",
                            animation: "pulse 1.8s infinite"
                          }} />
                        ) : (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#64748b", display: "inline-block" }} />
                        )}
                        <span>{a.ipAddress || "—"}</span>
                      </div>
                    </td>
                    <td>
                      {a.macAddress ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <code style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-primary)", padding: "2px 6px", borderRadius: 4 }}>
                            {a.macAddress}
                          </code>
                          <button
                            onClick={(e) => handleCopyMac(e, a.macAddress, a.id)}
                            style={{
                              background: copiedMacId === a.id ? "#10b981" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${copiedMacId === a.id ? "#10b981" : "var(--border-primary)"}`,
                              borderRadius: 4, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                              color: copiedMacId === a.id ? "#fff" : "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s"
                            }}
                          >
                            {copiedMacId === a.id ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[a.status] || "gray"}`} style={{ fontWeight: 700 }}>
                        {a.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span className="badge gray" style={{ fontSize: 10, padding: "3px 6px", borderRadius: 6 }}>
                        {a.discoverySource || "CSV_IMPORT"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Asset Inline Creator Dialog Modal */}
      <CreateAssetPanel open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => load(1)} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 20px", marginTop: 12, borderRadius: 12,
          background: "var(--bg-card)", border: "1px solid var(--border-primary)",
        }}>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Page {page} of {totalPages} ({total} total IT assets)
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" disabled={page <= 1}
              onClick={() => { const p = page - 1; setPage(p); load(p); }}
              style={{ padding: "6px 14px", fontSize: 12, borderRadius: 8 }}>
              ← Prev
            </button>
            <button className="btn btn-secondary" disabled={page >= totalPages}
              onClick={() => { const p = page + 1; setPage(p); load(p); }}
              style={{ padding: "6px 14px", fontSize: 12, borderRadius: 8 }}>
              Next →
            </button>
          </div>
        </div>
      )}

      <style>{`
        .category-card:hover {
          transform: translateY(-2px);
          border-color: rgba(6,182,212,0.2) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25), 0 0 12px rgba(6,182,212,0.03);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </>
  );
}
