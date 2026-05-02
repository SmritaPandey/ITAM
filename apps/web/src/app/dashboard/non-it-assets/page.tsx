"use client";
import { useEffect, useState } from "react";
import { Building2, Armchair, Wrench } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function NonITAssetsPage() {
  const [assets, setAssets] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/assets?limit=50")
      .then(data => {
        const nonIt = (data.data || []).filter((a: any) => !a.ipAddress && !a.hostname);
        setAssets({ ...data, data: nonIt, total: nonIt.length });
      })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Non-IT Assets</h1>
          <p className="page-subtitle">{assets.total} facility, furniture & physical assets</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr><th>Asset</th><th>Type</th><th>Location</th><th>Assigned To</th><th>Status</th><th>Purchase Price</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading...</td></tr>
            ) : assets.data.map((a: any) => (
              <tr key={a.id}>
                <td>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.assetTag} • {a.manufacturer}</div>
                </td>
                <td><span className="badge amber">{a.assetType?.name}</span></td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {a.site?.name || "—"}{a.room ? ` / ${a.room}` : ""}
                </td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : "—"}
                </td>
                <td><span className={`badge ${a.status === "ACTIVE" ? "green" : "gray"}`}>{a.status}</span></td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {a.purchasePrice ? `₹${Number(a.purchasePrice).toLocaleString("en-IN")}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
