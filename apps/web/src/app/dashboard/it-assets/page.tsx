"use client";
import { useEffect, useState } from "react";
import { Monitor, Cpu, HardDrive, Wifi } from "lucide-react";
import { getApiBase, getToken } from "@/lib/api";

export default function ITAssetsPage() {
  const [assets, setAssets] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${getApiBase()}/assets?limit=50`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => {
        // Filter IT assets only (those with IP or hostname)
        const itAssets = (data.data || []).filter((a: any) => a.ipAddress || a.hostname || a.macAddress);
        setAssets({ ...data, data: itAssets, total: itAssets.length });
      })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const categories = [
    { icon: <Monitor size={20} />, label: "Workstations", count: assets.data.filter((a: any) => a.assetType?.name?.includes("Laptop")).length, color: "cyan" },
    { icon: <HardDrive size={20} />, label: "Servers", count: assets.data.filter((a: any) => a.assetType?.name?.includes("Server")).length, color: "purple" },
    { icon: <Cpu size={20} />, label: "Network Devices", count: assets.data.filter((a: any) => a.assetType?.name?.includes("Switch") || a.assetType?.name?.includes("Router")).length, color: "blue" },
    { icon: <Wifi size={20} />, label: "Peripherals", count: assets.data.filter((a: any) => a.assetType?.name?.includes("Printer")).length, color: "green" },
  ];

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
          <div key={c.label} className="stat-card">
            <div className={`stat-icon ${c.color}`}>{c.icon}</div>
            <div className="stat-content">
              <div className="stat-label">{c.label}</div>
              <div className="stat-value">{c.count}</div>
            </div>
          </div>
        ))}
      </div>

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
            ) : assets.data.map((a: any) => (
              <tr key={a.id}>
                <td>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.name}</div>
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
