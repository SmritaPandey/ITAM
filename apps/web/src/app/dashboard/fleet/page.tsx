"use client";
import { useEffect, useState, type CSSProperties } from "react";
import {
  Truck, Activity, AlertTriangle, Navigation, Eye, ArrowLeft, Calendar, Compass, MapPin, Plus, Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const FleetMap = dynamic(() => import("@/components/FleetMap"), { ssr: false });

type SideTab = "vehicles" | "alerts" | "geofences" | "maintenance";

export default function FleetPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fleetStats, setFleetStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [sideTab, setSideTab] = useState<SideTab>("vehicles");

  const [trips, setTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [geofences, setGeofences] = useState<any[]>([]);
  const [maintenanceDue, setMaintenanceDue] = useState<any>(null);
  const [showFenceForm, setShowFenceForm] = useState(false);
  const [fenceName, setFenceName] = useState("");
  const [fenceLat, setFenceLat] = useState("");
  const [fenceLng, setFenceLng] = useState("");
  const [fenceRadius, setFenceRadius] = useState("500");
  const [savingFence, setSavingFence] = useState(false);

  function loadFleet() {
    setLoading(true);
    Promise.all([
      apiFetch("/fleet/vehicles"),
      apiFetch("/fleet/alerts").catch(() => []),
      apiFetch("/fleet/geofences").catch(() => []),
      apiFetch("/fleet/maintenance-due").catch(() => null),
    ])
      .then(([d, a, g, m]) => {
        const fleet = d.data || [];
        setVehicles(fleet);
        setFleetStats(d);
        if (fleet.length > 0 && !selectedVehicle) setSelectedVehicle(fleet[0]);
        setAlerts(Array.isArray(a) ? a : []);
        setGeofences(Array.isArray(g) ? g : []);
        setMaintenanceDue(m);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadFleet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .then((res) => setTrips(res.trips || []))
      .catch(console.error)
      .finally(() => setLoadingTrips(false));
  }, [selectedVehicle]);

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter((v) => v.status === "ACTIVE").length;

  const formatDuration = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return "N/A";
    const diffMins = Math.round((new Date(endStr).getTime() - new Date(startStr).getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  async function createGeofence() {
    const lat = parseFloat(fenceLat);
    const lng = parseFloat(fenceLng);
    const radius = parseFloat(fenceRadius);
    if (!fenceName.trim() || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
      alert("Name, lat, lng, and radius are required");
      return;
    }
    setSavingFence(true);
    try {
      await apiFetch("/fleet/geofences", {
        method: "POST",
        body: JSON.stringify({
          name: fenceName.trim(),
          type: "circle",
          center: { lat, lng },
          radius,
        }),
      });
      setFenceName("");
      setFenceLat("");
      setFenceLng("");
      setFenceRadius("500");
      setShowFenceForm(false);
      const g = await apiFetch("/fleet/geofences");
      setGeofences(Array.isArray(g) ? g : []);
    } catch (err: any) {
      alert(err?.message || "Failed to create geofence");
    } finally {
      setSavingFence(false);
    }
  }

  const tabs: { id: SideTab; label: string; count?: number }[] = [
    { id: "vehicles", label: "Vehicles", count: totalVehicles },
    { id: "alerts", label: "Alerts", count: alerts.length },
    { id: "geofences", label: "Geofences", count: geofences.length },
    { id: "maintenance", label: "PM Due", count: maintenanceDue?.total || 0 },
  ];

  return (
    <>
      <PageHeader
        title="Fleet / GPS Tracking"
        description={`${totalVehicles} tracked assets · geofence, speeding & idle alerts · Traccar ingest`}
        actions={
          <button className="btn btn-secondary" onClick={loadFleet}>
            <Activity size={14} /> Refresh
          </button>
        }
      />

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
            <div className="stat-label">Open Alerts</div>
            <div className="stat-value">{alerts.filter((a) => !a.resolved).length}</div>
          </div>
          <div className="stat-icon amber"><AlertTriangle size={18} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">PM Due</div>
            <div className="stat-value">{fleetStats?.maintenanceDueCount ?? maintenanceDue?.total ?? 0}</div>
          </div>
          <div className="stat-icon purple"><Wrench size={18} /></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, minHeight: 520 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative", minHeight: 480 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)" }}>
              <Activity size={24} style={{ animation: "spin 2s linear infinite" }} />
            </div>
          ) : vehicles.length === 0 ? (
            <EmptyState
              icon={<Navigation size={28} />}
              title="No GPS-tracked vehicles"
              description="Assets with latitude/longitude appear here. POST /fleet/traccar or /fleet/telemetry to ingest positions."
            />
          ) : (
            <FleetMap
              vehicles={vehicles}
              selectedVehicle={selectedVehicle}
              onSelect={setSelectedVehicle}
              selectedTrip={selectedTrip}
            />
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-primary)", overflowX: "auto" }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSideTab(t.id)}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  fontSize: 11,
                  fontWeight: 650,
                  border: "none",
                  background: sideTab === t.id ? "rgba(6,182,212,0.08)" : "transparent",
                  color: sideTab === t.id ? "var(--brand-400)" : "var(--text-secondary)",
                  borderBottom: sideTab === t.id ? "2px solid var(--brand-400)" : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}{t.count != null ? ` (${t.count})` : ""}
              </button>
            ))}
          </div>

          {sideTab === "vehicles" && (
            selectedVehicle ? (
              <>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setSelectedVehicle(null)}
                    style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedVehicle.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{selectedVehicle.assetTag}</div>
                  </div>
                  <span className={`badge ${selectedVehicle.status === "ACTIVE" ? "green" : "amber"}`} style={{ fontSize: 9 }}>
                    {selectedVehicle.status}
                  </span>
                </div>

                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Live Tracking</span>
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
                  <div style={{ padding: "0 16px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                    Historical Trips ({trips.length})
                  </div>
                  {loadingTrips ? (
                    <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>Loading…</div>
                  ) : trips.length > 0 ? (
                    trips.map((t, idx) => {
                      const isTripSelected = selectedTrip?.id === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTrip(t)}
                          style={{
                            padding: "10px 16px",
                            borderBottom: "1px solid var(--border-primary)",
                            cursor: "pointer",
                            display: "flex",
                            gap: 10,
                            background: isTripSelected ? "rgba(6,182,212,0.06)" : "transparent",
                            borderLeft: isTripSelected ? "3px solid var(--brand-400)" : "3px solid transparent",
                          }}
                        >
                          <Calendar size={14} style={{ marginTop: 4, color: "var(--text-secondary)" }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {t.startLocation && t.endLocation ? `${t.startLocation} → ${t.endLocation}` : `Trip #${trips.length - idx}`}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                              {formatDate(t.startTime)} · {formatDuration(t.startTime, t.endTime)}
                            </div>
                            {t.distanceKm != null && (
                              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>
                                {Number(t.distanceKm).toFixed(1)} km · Avg {t.avgSpeed} km/h
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState compact title="No trips yet" description="Trip history appears after GPS telemetry is ingested." />
                  )}
                </div>

                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-primary)" }}>
                  <button
                    className="btn btn-secondary"
                    style={{ width: "100%", fontSize: 12 }}
                    onClick={() => router.push(`/dashboard/assets/${selectedVehicle.id}`)}
                  >
                    <Eye size={12} style={{ marginRight: 4 }} /> Asset Details
                  </button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, overflowY: "auto" }}>
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border-primary)",
                      cursor: "pointer",
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "rgba(6,182,212,0.12)", display: "flex",
                      alignItems: "center", justifyContent: "center", color: "var(--brand-400)",
                    }}>
                      <Truck size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{v.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                        {v.assetTag} · {v.latitude?.toFixed?.(4)}, {v.longitude?.toFixed?.(4)}
                      </div>
                    </div>
                    <span className={`badge ${v.status === "ACTIVE" ? "green" : "amber"}`} style={{ fontSize: 9 }}>{v.status}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {sideTab === "alerts" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {alerts.length === 0 ? (
                <EmptyState compact title="No fleet alerts" description="Geofence enter/exit, speeding, and idle events appear here as AlertEvents." />
              ) : (
                alerts.map((a) => (
                  <div key={a.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{a.title}</div>
                      <span className={`badge ${a.severity === "HIGH" || a.severity === "CRITICAL" ? "red" : "amber"}`} style={{ fontSize: 9 }}>
                        {a.severity || a.category}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4 }}>{a.message}</div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6 }}>{formatDate(a.createdAt)}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {sideTab === "geofences" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Geofences</div>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setShowFenceForm((v) => !v)}>
                  <Plus size={12} /> Add
                </button>
              </div>
              {showFenceForm && (
                <div style={{ display: "grid", gap: 8, marginBottom: 12, padding: 12, background: "var(--bg-elevated)", borderRadius: 8 }}>
                  <input placeholder="Name" value={fenceName} onChange={(e) => setFenceName(e.target.value)} style={inputStyle} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input placeholder="Lat" value={fenceLat} onChange={(e) => setFenceLat(e.target.value)} style={inputStyle} />
                    <input placeholder="Lng" value={fenceLng} onChange={(e) => setFenceLng(e.target.value)} style={inputStyle} />
                  </div>
                  <input placeholder="Radius (m)" value={fenceRadius} onChange={(e) => setFenceRadius(e.target.value)} style={inputStyle} />
                  <button className="btn btn-primary" disabled={savingFence} onClick={createGeofence} style={{ fontSize: 12 }}>
                    {savingFence ? "Saving…" : "Create circle geofence"}
                  </button>
                </div>
              )}
              {geofences.length === 0 ? (
                <EmptyState compact icon={<MapPin size={22} />} title="No geofences" description="Create a circular fence to get enter/exit AlertEvents." />
              ) : (
                geofences.map((f: any) => (
                  <div key={f.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-primary)" }}>
                    <div style={{ fontSize: 13, fontWeight: 650 }}>{f.name || `Geofence ${f.id}`}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {f.type || "circle"}
                      {f.radius ? ` · ${f.radius}m` : ""}
                      {f.center ? ` · ${f.center.lat?.toFixed?.(4)}, ${f.center.lng?.toFixed?.(4)}` : ""}
                    </div>
                  </div>
                ))
              )}
              <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.45 }}>
                Traccar: POST /fleet/traccar with X-Fleet-Token. Map devices via tenant settings.fleet.traccarDeviceMap.
              </div>
            </div>
          )}

          {sideTab === "maintenance" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {!maintenanceDue?.items?.length ? (
                <EmptyState
                  compact
                  title="No maintenance due"
                  description="EAM schedules for GPS-tracked assets appear here when due within 14 days."
                  action={{ label: "Open Facility", href: "/dashboard/facility" }}
                />
              ) : (
                maintenanceDue.items.map((item: any) => (
                  <div key={item.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{item.title}</div>
                      <span className={`badge ${item.overdue ? "red" : "amber"}`} style={{ fontSize: 9 }}>
                        {item.overdue ? "Overdue" : "Upcoming"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                      {item.assetName} {item.assetTag ? `(${item.assetTag})` : ""}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                      Due {formatDate(item.nextDueAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const inputStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontSize: 12,
};
