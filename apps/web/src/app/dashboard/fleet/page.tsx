"use client";
import { useEffect, useState } from "react";
import { Truck, MapPin, Activity, Fuel, AlertTriangle, Navigation, Eye, ArrowLeft, Calendar, Compass } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";

// Dynamically import Leaflet map to avoid SSR issues
const FleetMap = dynamic(() => import("@/components/FleetMap"), { ssr: false });

export default function FleetPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  
  // Trip History States
  const [trips, setTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  useEffect(() => {
    apiFetch("/fleet/vehicles")
      .then(d => {
        const fleet = d.data || [];
        setVehicles(fleet);
        if (fleet.length > 0) setSelectedVehicle(fleet[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch Trips whenever selected vehicle changes
  useEffect(() => {
    if (!selectedVehicle) {
      setTrips([]);
      setSelectedTrip(null);
      return;
    }
    setSelectedTrip(null);
    setTrips([]);
    setLoadingTrips(true);
    
    apiFetch(`/fleet/vehicles/${selectedVehicle.id}/trips`)
      .then(res => {
        setTrips(res.trips || []);
      })
      .catch(console.error)
      .finally(() => setLoadingTrips(false));
  }, [selectedVehicle]);

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(v => v.status === "ACTIVE").length;

  // Format Duration helper
  const formatDuration = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return "N/A";
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  };

  // Format Date helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, height: 520 }}>
        {/* Map */}
        <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)" }}>
              <Activity size={24} style={{ animation: "spin 2s linear infinite" }} />
            </div>
          ) : (
            <FleetMap 
              vehicles={vehicles} 
              selectedVehicle={selectedVehicle} 
              onSelect={setSelectedVehicle} 
              selectedTrip={selectedTrip}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {selectedVehicle ? (
            // Selected Vehicle View: details + trips
            <>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                <button 
                  onClick={() => setSelectedVehicle(null)} 
                  style={{ 
                    background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", 
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 4, borderRadius: "50%",
                  }}
                  title="Back to all vehicles"
                >
                  <ArrowLeft size={16} />
                </button>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedVehicle.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {selectedVehicle.assetTag}
                  </div>
                </div>
                <span className={`badge ${selectedVehicle.status === "ACTIVE" ? "green" : "amber"}`} style={{ fontSize: 9 }}>
                  {selectedVehicle.status}
                </span>
              </div>
              
              <div style={{ padding: "10px 16px", background: "rgba(6,182,212,0.03)", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Live Tracking Mode</span>
                <button 
                  onClick={() => setSelectedTrip(null)}
                  className={`btn ${!selectedTrip ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: 11, padding: "4px 10px", height: "auto" }}
                >
                  <Compass size={12} style={{ marginRight: 4 }} />
                  {!selectedTrip ? "Active Live" : "Switch to Live"}
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
                <div style={{ padding: "0 16px 8px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Historical Trips ({trips.length})
                </div>

                {loadingTrips ? (
                  <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)" }}>
                    <Activity size={18} style={{ animation: "spin 2s linear infinite", margin: "0 auto 8px auto" }} />
                    <span style={{ fontSize: 12 }}>Loading trip history...</span>
                  </div>
                ) : trips.length > 0 ? (
                  trips.map((t, idx) => {
                    const isTripSelected = selectedTrip?.id === t.id;
                    return (
                      <div 
                        key={t.id} 
                        onClick={() => setSelectedTrip(t)} 
                        style={{
                          padding: "10px 16px", borderBottom: "1px solid var(--border-primary)",
                          cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start",
                          background: isTripSelected ? "rgba(6,182,212,0.06)" : "transparent",
                          borderLeft: isTripSelected ? "3px solid var(--brand-400)" : "3px solid transparent",
                          transition: "background 0.2s"
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: isTripSelected ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.05)", 
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: isTripSelected ? "var(--brand-400)" : "var(--text-secondary)",
                          marginTop: 2
                        }}>
                          <Calendar size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: isTripSelected ? "var(--brand-400)" : "var(--text-primary)" }}>
                            {t.startLocation && t.endLocation ? `${t.startLocation} ➔ ${t.endLocation}` : `Trip #${trips.length - idx}`}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                            {formatDate(t.startTime)} • {formatDuration(t.startTime, t.endTime)}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4, fontWeight: 500 }}>
                            {t.distanceKm.toFixed(1)} km • Avg {t.avgSpeed} km/h
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
                    No historical trips recorded.
                  </div>
                )}
              </div>

              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-primary)", display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1, padding: "8px 0", fontSize: 12 }}
                  onClick={() => router.push(`/dashboard/assets/${selectedVehicle.id}`)}>
                  <Eye size={12} style={{ marginRight: 4 }} /> Details
                </button>
              </div>
            </>
          ) : (
            // Default Fleet List View
            <>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Fleet Vehicles</div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {vehicles.map(v => (
                  <div key={v.id} onClick={() => setSelectedVehicle(v)} style={{
                    padding: "12px 16px", borderBottom: "1px solid var(--border-primary)",
                    cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
                    transition: "background 0.2s"
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
            </>
          )}
        </div>
      </div>

      {/* Analysis Grid (Vehicle Details + Trip Details) */}
      {selectedVehicle && (
        <div style={{ display: "grid", gridTemplateColumns: selectedTrip ? "1fr 1fr" : "1fr", gap: 16, marginTop: 16 }}>
          {/* Vehicle Stats Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ color: "var(--brand-400)" }}><Truck size={14} /> Vehicle Parameters</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <DetailItem label="Registration" value={selectedVehicle.customFields?.registrationNumber} />
              <DetailItem label="Fuel Type" value={selectedVehicle.customFields?.fuelType} />
              <DetailItem label="Seating" value={selectedVehicle.customFields?.seatingCapacity} />
              <DetailItem label="Manufacturer" value={selectedVehicle.manufacturer} />
              <DetailItem label="Model" value={selectedVehicle.model} />
              <DetailItem label="Status" value={selectedVehicle.status} />
              <DetailItem label="Latitude" value={selectedVehicle.latitude?.toFixed(5)} mono />
              <DetailItem label="Longitude" value={selectedVehicle.longitude?.toFixed(5)} mono />
              <DetailItem label="Last Update" value={selectedVehicle.updatedAt ? formatDate(selectedVehicle.updatedAt) : "Now"} />
            </div>
          </div>

          {/* Selected Trip Details Card */}
          {selectedTrip && (
            <div className="card" style={{ border: "1px solid rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.02)" }}>
              <div className="card-header">
                <div className="card-title" style={{ color: "var(--brand-400)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Navigation size={14} /> Telematics Route Analysis
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <DetailItem label="Start Point" value={selectedTrip.startLocation || "Mumbai Terminal A"} />
                <DetailItem label="Destination" value={selectedTrip.endLocation || "BKC Central HUB"} />
                <DetailItem label="Distance" value={`${selectedTrip.distanceKm.toFixed(1)} km`} />
                <DetailItem label="Duration" value={formatDuration(selectedTrip.startTime, selectedTrip.endTime)} />
                <DetailItem label="Avg Speed" value={`${selectedTrip.avgSpeed} km/h`} />
                <DetailItem label="Max Speed" value={`${selectedTrip.maxSpeed} km/h`} />
                <DetailItem label="Start Time" value={formatDate(selectedTrip.startTime)} />
                <DetailItem label="End Time" value={formatDate(selectedTrip.endTime)} />
                <DetailItem label="Points Collected" value={`${selectedTrip.points?.length || 0} GPS coords`} />
              </div>
            </div>
          )}
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
