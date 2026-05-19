"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Cpu, HardDrive, Wifi, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ITAssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/assets?limit=50")
      .then(data => {
        // Filter IT assets only (those with IP or hostname)
        const itAssets = (data.data || []).filter((a: any) => a.ipAddress || a.hostname || a.macAddress);
        setAssets({ ...data, data: itAssets, total: itAssets.length });
      })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const categories = [
    { icon: <Monitor size={20} />, label: "Workstations", filter: "Laptop", count: assets.data.filter((a: any) => a.assetType?.name?.includes("Laptop")).length, color: "cyan" },
    { icon: <HardDrive size={20} />, label: "Servers", filter: "Server", count: assets.data.filter((a: any) => a.assetType?.name?.includes("Server")).length, color: "purple" },
    { icon: <Cpu size={20} />, label: "Network Devices", filter: "Switch|Router", count: assets.data.filter((a: any) => a.assetType?.name?.includes("Switch") || a.assetType?.name?.includes("Router")).length, color: "blue" },
    { icon: <Wifi size={20} />, label: "Peripherals", filter: "Printer", count: assets.data.filter((a: any) => a.assetType?.name?.includes("Printer")).length, color: "green" },
  ];

  const filteredAssets = activeCategory
    ? assets.data.filter((a: any) => activeCategory.split("|").some((f: string) => a.assetType?.name?.includes(f)))
    : assets.data;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">IT Assets</h1>
          <p className="page-subtitle">{assets.total} networked IT assets</p>
        </div>
      </div>

      <div className="stats-grid">
        {categories.map(c => (
          <div key={c.label} className="stat-card"
            style={{ cursor: "pointer", borderLeft: activeCategory === c.filter ? `3px solid var(--brand-400)` : undefined, transition: "transform 0.15s" }}
            onClick={() => setActiveCategory(activeCategory === c.filter ? null : c.filter)}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
            <div className={`stat-icon ${c.color}`}>{c.icon}</div>
            <div className="stat-content">
              <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>{c.label} <ExternalLink size={9} style={{ opacity: 0.3 }} /></div>
              <div className="stat-value">{c.count}</div>
            </div>
          </div>
        ))}
      </div>
      {activeCategory && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Filtered: <strong>{categories.find(c => c.filter === activeCategory)?.label}</strong> ({filteredAssets.length})</span>
          <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => setActiveCategory(null)}>Clear ✕</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Type</th>
              <th>Hostname</th>
              <th>IP Address</th>
              <th>MAC Address</th>
              <th>Status</th>
              <th>Discovery</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading...</td></tr>
            ) : filteredAssets.map((a: any) => (
              <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/dashboard/assets/${a.id}`)}>
                <td>
                  <div style={{ fontWeight: 600, color: "var(--brand-400)" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.assetTag} • {a.manufacturer}</div>
                </td>
                <td><span className="badge cyan">{a.assetType?.name}</span></td>
                <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{a.hostname || "—"}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--brand-400)" }}>{a.ipAddress || "—"}</td>
                <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{a.macAddress || "—"}</td>
                <td><span className={`badge ${a.status === "ACTIVE" ? "green" : "gray"}`}>{a.status}</span></td>
                <td><span className="badge gray">{a.discoverySource}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
