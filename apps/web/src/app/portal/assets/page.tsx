"use client";
import { useEffect, useState } from "react";
import { Package, Monitor, MapPin, Building, Calendar, Loader2 } from "lucide-react";
import { getApiBase, getToken } from "@/lib/api";

export default function MyAssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${getApiBase()}/assets?limit=50`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(d => setAssets(d.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Assets</h1>
          <p className="page-subtitle">{assets.length} assets assigned to you</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "40vh", color: "var(--text-tertiary)" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : assets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
          <Package size={36} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No assets assigned</div>
          <p style={{ fontSize: 12 }}>Contact your IT administrator to get assets assigned to you</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
          {assets.map(a => (
            <div key={a.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "rgba(6,182,212,0.1)", display: "flex",
                    alignItems: "center", justifyContent: "center", color: "#06b6d4",
                  }}><Monitor size={18} /></div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.assetTag} • {a.serialNumber || "—"}</div>
                  </div>
                </div>
                <span className={`badge ${a.status === "ACTIVE" ? "green" : "gray"}`}>{a.status}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
                  <Package size={10} /> {a.assetType?.name || "—"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
                  <Building size={10} /> {a.department?.name?.split(" ")[0] || "—"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
                  <MapPin size={10} /> {a.site?.name?.split(" - ")[1] || a.site?.name || "—"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
                  <Calendar size={10} /> {a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString() : "No warranty"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
