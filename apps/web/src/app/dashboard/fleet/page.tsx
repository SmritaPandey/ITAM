"use client";
import { useEffect, useState } from "react";
import { Truck, MapPin, Activity, Fuel, AlertTriangle, Navigation, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }

// Dynamically import Leaflet map to avoid SSR issues
const FleetMap = dynamic(() => import("@/components/FleetMap"), { ssr: false });

export default function FleetPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/assets?limit=50`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => {
        const fleet = (d.data || []).filter((a: any) => a.latitude && a.longitude);
        setVehicles(fleet);
        if (fleet.length > 0) setSelectedVehicle(fleet[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(v => v.status === "ACTIVE").length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet / GPS Tracking</h1>
          <p className="page-subtitle">{totalVehicles} tracked assets with GPS coordinates</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Total Fleet</div>
            <div className="stat-value">{totalVehicles}</div>
          </div>
          <div className="stat-icon cyan"><Truck size={18} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Active</div>
            <div className="stat-value">{activeVehicles}</div>
          </div>
          <div className="stat-icon green"><Activity size={18} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">In Maintenance</div>
            <div className="stat-value">{vehicles.filter(v => v.status === "IN_MAINTENANCE").length}</div>
          </div>
          <div className="stat-icon amber"><AlertTriangle size={18} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">GPS-Tracked</div>
            <div className="stat-value">{totalVehicles}</div>
          </div>
          <div className="stat-icon purple"><Navigation size={18} /></div>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, height: 480 }}>
        {/* Map */}
        <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)" }}>
              <Activity size={24} style={{ animation: "spin 2s linear infinite" }} />
            </div>
          ) : (
            <FleetMap vehicles={vehicles} selectedVehicle={selectedVehicle} onSelect={setSelectedVehicle} />
          )}
        </div>

        {/* Vehicle List */}
        <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Fleet Vehicles</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {vehicles.map(v => (
              <div key={v.id} onClick={() => setSelectedVehicle(v)} style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border-primary)",
                cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
                background: selectedVehicle?.id === v.id ? "rgba(6,182,212,0.06)" : "transparent",
                borderLeft: selectedVehicle?.id === v.id ? "3px solid var(--brand-400)" : "3px solid transparent",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(6,182,212,0.12)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  color: "var(--brand-400)",
                }}>
                  <Truck size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{v.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {v.assetTag} • {v.customFields?.registrationNumber || "—"}
                  </div>
                </div>
                <span className={`badge ${v.status === "ACTIVE" ? "green" : "amber"}`} style={{ fontSize: 9 }}>
                  {v.status}
                </span>
              </div>
            ))}
            {vehicles.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                No GPS-tracked assets
              </div>
            )}
          </div>
          {selectedVehicle && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-primary)" }}>
              <button className="btn btn-primary" style={{ width: "100%" }}
                onClick={() => router.push(`/dashboard/assets/${selectedVehicle.id}`)}>
                <Eye size={14} /> View Asset Details
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Details */}
      {selectedVehicle && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div className="card-title"><Truck size={14} /> {selectedVehicle.name}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <DetailItem label="Registration" value={selectedVehicle.customFields?.registrationNumber} />
            <DetailItem label="Fuel Type" value={selectedVehicle.customFields?.fuelType} />
            <DetailItem label="Seating" value={selectedVehicle.customFields?.seatingCapacity} />
            <DetailItem label="Manufacturer" value={selectedVehicle.manufacturer} />
            <DetailItem label="Model" value={selectedVehicle.model} />
            <DetailItem label="Latitude" value={selectedVehicle.latitude?.toFixed(4)} mono />
            <DetailItem label="Longitude" value={selectedVehicle.longitude?.toFixed(4)} mono />
            <DetailItem label="Status" value={selectedVehicle.status} />
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function DetailItem({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, fontFamily: mono ? "monospace" : "inherit", color: value ? "var(--text-primary)" : "var(--text-tertiary)" }}>
        {value || "—"}
      </div>
    </div>
  );
}
