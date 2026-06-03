"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Camera, Video, Eye, AlertTriangle, CheckCircle2, Clock, MapPin, Shield,
  Grid3X3, Loader2, RefreshCw, Plus, Search, Trash2, Settings, X,
  MonitorPlay, Wifi, WifiOff, Play, Pause, RotateCw
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtimeEvents";

const STATUS_COLORS: Record<string, string> = { ONLINE: "green", WARNING: "amber", OFFLINE: "red" };

export default function CCTVPage() {
  const [data, setData] = useState<any>({ data: [], total: 0, online: 0, recording: 0, alerts: 0 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCam, setSelectedCam] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", ipAddress: "", location: "", cameraType: "IP", resolution: "1080p", rtspUrl: "" });
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { connected, on } = useRealtimeEvents();

  const refresh = useCallback(() => {
    apiFetch("/monitoring/cameras").then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleDeleteCamera(id: string) {
    if (!confirm("Delete this camera?")) return;
    try {
      await apiFetch(`/monitoring/devices/${id}`, { method: "DELETE" });
      setSelectedCam(null);
      refresh();
    } catch {
      alert("Failed to delete camera.");
    }
  }

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh on WebSocket events
  useEffect(() => {
    const c1 = on("monitoring.camera_offline", () => refresh());
    const c2 = on("monitoring.device_down", () => refresh());
    return () => { c1(); c2(); };
  }, [on, refresh]);

  // Load camera events when detail panel opens
  useEffect(() => {
    if (!selectedCam) return;
    setEventsLoading(true);
    apiFetch(`/monitoring/cameras/${selectedCam.id}/events`)
      .then(d => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }, [selectedCam]);

  const cameras = data.data || [];
  const statusFiltered = filter === "all" ? cameras
    : filter === "online" ? cameras.filter((c: any) => c.status === "ONLINE")
    : filter === "offline" ? cameras.filter((c: any) => c.status === "OFFLINE")
    : filter === "recording" ? cameras.filter((c: any) => c.config?.recording)
    : cameras;
  const filtered = statusFiltered.filter((c: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name?.toLowerCase().includes(q) ||
           c.ipAddress?.toLowerCase().includes(q);
  });

  async function addCamera() {
    setAdding(true);
    try {
      await apiFetch("/monitoring/devices", {
        method: "POST",
        body: JSON.stringify({
          type: "CAMERA",
          name: addForm.name,
          ipAddress: addForm.ipAddress,
          location: addForm.location,
          status: "ONLINE",
          config: {
            cameraType: addForm.cameraType,
            resolution: addForm.resolution,
            rtspUrl: addForm.rtspUrl || `rtsp://${addForm.ipAddress}:554/stream1`,
            recording: false,
          },
          metrics: { storage: 0, health: 100 },
        }),
      });
      setShowAddModal(false);
      setAddForm({ name: "", ipAddress: "", location: "", cameraType: "IP", resolution: "1080p", rtspUrl: "" });
      refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">CCTV Surveillance</h1>
          <p className="page-subtitle">
            {data.total} cameras • {data.online} online
            {connected && <span style={{ marginLeft: 8, fontSize: 10, color: "#10b981" }}>● Live</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={14} /></button>
          <button className={`btn ${viewMode === "grid" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("grid")} style={{ padding: "6px 10px" }}><Grid3X3 size={14} /></button>
          <button className={`btn ${viewMode === "list" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("list")} style={{ padding: "6px 10px" }}><Eye size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}><Plus size={14} /> Add Camera</button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "8px 14px" }}>
          <Search size={15} style={{ color: "var(--text-tertiary)" }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by camera name or IP address..."
            style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card" onClick={() => setFilter("all")} style={{ cursor: "pointer", outline: filter === "all" ? "2px solid var(--brand-400)" : "none", borderRadius: 12 }}>
          <div className="stat-icon cyan"><Camera size={22} /></div><div className="stat-content"><div className="stat-label">Total Cameras</div><div className="stat-value">{data.total}</div></div></div>
        <div className="stat-card" onClick={() => setFilter("online")} style={{ cursor: "pointer", outline: filter === "online" ? "2px solid var(--brand-400)" : "none", borderRadius: 12 }}>
          <div className="stat-icon green"><CheckCircle2 size={22} /></div><div className="stat-content"><div className="stat-label">Online</div><div className="stat-value">{data.online}</div></div></div>
        <div className="stat-card" onClick={() => setFilter("recording")} style={{ cursor: "pointer", outline: filter === "recording" ? "2px solid var(--brand-400)" : "none", borderRadius: 12 }}>
          <div className="stat-icon purple"><Video size={22} /></div><div className="stat-content"><div className="stat-label">Recording</div><div className="stat-value">{data.recording}</div></div></div>
        <div className="stat-card" onClick={() => setFilter("offline")} style={{ cursor: "pointer", outline: filter === "offline" ? "2px solid var(--brand-400)" : "none", borderRadius: 12 }}>
          <div className="stat-icon red"><AlertTriangle size={22} /></div><div className="stat-content"><div className="stat-label">Alerts</div><div className="stat-value">{data.alerts}</div></div></div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
          <Camera size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{filter === "all" ? "No cameras configured" : `No ${filter} cameras`}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {filter === "all" ? "Click Add Camera to register your CCTV devices." : "Try a different filter."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(340px, 1fr))" : "1fr", gap: 12 }}>
          {filtered.map((cam: any) => {
            const cfg = cam.config || {};
            const met = cam.metrics || {};
            return (
              <div key={cam.id} className="card" style={{ overflow: "hidden", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                onClick={() => setSelectedCam(cam)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
              >
                <div style={{
                  height: viewMode === "grid" ? 160 : 100,
                  background: cam.status === "ONLINE"
                    ? "linear-gradient(135deg, #0a0e1a 0%, #0f1929 50%, #1a1f35 100%)"
                    : "linear-gradient(135deg, #1a0a0a 0%, #2d1515 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative", borderRadius: "8px 8px 0 0", margin: "-16px -16px 12px",
                }}>
                  <div style={{ textAlign: "center" }}>
                    {cam.status === "ONLINE" ? (
                      <>
                        <MonitorPlay size={32} style={{ color: "rgba(6,182,212,0.4)" }} />
                        <div style={{ fontSize: 9, color: "rgba(6,182,212,0.6)", marginTop: 4, letterSpacing: 1.5, fontWeight: 600 }}>LIVE FEED</div>
                      </>
                    ) : (
                      <>
                        <WifiOff size={32} style={{ color: "rgba(239,68,68,0.4)" }} />
                        <div style={{ fontSize: 9, color: "rgba(239,68,68,0.6)", marginTop: 4, letterSpacing: 1.5, fontWeight: 600 }}>OFFLINE</div>
                      </>
                    )}
                  </div>
                  {cfg.recording && (
                    <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.2)", padding: "2px 8px", borderRadius: 12, backdropFilter: "blur(4px)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 2s infinite" }} />
                      <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700 }}>REC</span>
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 8, left: 8 }}>
                    <span className="badge gray" style={{ fontSize: 9, backdropFilter: "blur(4px)", background: "rgba(0,0,0,0.4)" }}>{cfg.resolution || "—"}</span>
                  </div>
                  <div style={{ position: "absolute", bottom: 8, left: 8 }}>
                    <span className="badge gray" style={{ fontSize: 9, backdropFilter: "blur(4px)", background: "rgba(0,0,0,0.4)" }}>
                      <Wifi size={8} /> {cam.ipAddress || "No IP"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{cam.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}><MapPin size={10} /> {cam.location || "Unassigned"}</div>
                  </div>
                  <span className={`badge ${STATUS_COLORS[cam.status] || "gray"}`}>{cam.status}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                  <div><span style={{ color: "var(--text-tertiary)" }}>Type</span><br /><span style={{ fontWeight: 500 }}>{cfg.cameraType || "—"}</span></div>
                  <div><span style={{ color: "var(--text-tertiary)" }}>Storage</span><br /><span style={{ fontWeight: 500 }}>{met.storage || 0}%</span></div>
                  <div><span style={{ color: "var(--text-tertiary)" }}>Health</span><br /><span style={{ fontWeight: 500, color: met.health > 90 ? "var(--success)" : met.health > 0 ? "var(--warning)" : "var(--text-tertiary)" }}>{met.health || 0}%</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Panel */}
      {selectedCam && (
        <>
          <div onClick={() => setSelectedCam(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 92vw)", background: "var(--bg-card)", zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selectedCam.name}</h2>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{selectedCam.ipAddress || "No IP"} • {selectedCam.location || "No location"}</p>
              </div>
              <button onClick={() => setSelectedCam(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}><X size={14} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {/* Stream Preview */}
              <div style={{
                height: 200, borderRadius: 8, marginBottom: 16,
                background: selectedCam.status === "ONLINE" ? "linear-gradient(135deg, #0a0e1a, #1a1f35)" : "linear-gradient(135deg, #1a0a0a, #2d1515)",
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}>
                {selectedCam.status === "ONLINE" ? (
                  <div style={{ textAlign: "center" }}>
                    <MonitorPlay size={40} style={{ color: "rgba(6,182,212,0.3)" }} />
                    <div style={{ fontSize: 10, color: "rgba(6,182,212,0.5)", marginTop: 6 }}>Camera stream requires RTSP client</div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <WifiOff size={40} style={{ color: "rgba(239,68,68,0.3)" }} />
                    <div style={{ fontSize: 10, color: "rgba(239,68,68,0.5)", marginTop: 6 }}>Camera is offline</div>
                  </div>
                )}
              </div>

              {/* Camera Info */}
              <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                <DRow label="Status" value={<span className={`badge ${STATUS_COLORS[selectedCam.status]}`}>{selectedCam.status}</span>} />
                <DRow label="IP Address" value={selectedCam.ipAddress || "—"} />
                <DRow label="Location" value={selectedCam.location || "—"} />
                <DRow label="Camera Type" value={selectedCam.config?.cameraType || "—"} />
                <DRow label="Resolution" value={selectedCam.config?.resolution || "—"} />
                <DRow label="Recording" value={selectedCam.config?.recording ? "● Active" : "Inactive"} />
                <DRow label="RTSP URL" value={
                  <code style={{ fontSize: 10, color: "var(--brand-400)", wordBreak: "break-all" }}>
                    {selectedCam.config?.rtspUrl || `rtsp://${selectedCam.ipAddress}:554/stream1`}
                  </code>
                } />
                <DRow label="PTZ Support" value={selectedCam.config?.ptzSupport ? "Yes" : "No"} />
                <DRow label="Storage Used" value={`${selectedCam.metrics?.storage || 0}%`} />
                <DRow label="Health Score" value={`${selectedCam.metrics?.health || 0}%`} />
                <DRow label="Last Seen" value={selectedCam.lastSeen ? new Date(selectedCam.lastSeen).toLocaleString() : "Never"} />
              </div>

              {/* Delete Camera */}
              <button
                className="btn btn-secondary"
                style={{ width: "100%", padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#ef4444", borderColor: "rgba(239,68,68,0.3)", fontSize: 13, fontWeight: 600 }}
                onClick={() => handleDeleteCamera(selectedCam.id)}
              >
                <Trash2 size={14} /> Delete Camera
              </button>

              {/* Events Timeline */}
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>Event History</h3>
              {eventsLoading ? (
                <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : events.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {events.slice(0, 20).map((evt: any, i: number) => (
                    <div key={i} style={{
                      padding: "8px 12px", borderRadius: 6,
                      background: evt.type === "camera_offline" ? "rgba(239,68,68,0.06)" : "rgba(42,49,80,0.3)",
                      border: `1px solid ${evt.type === "camera_offline" ? "rgba(239,68,68,0.15)" : "var(--border-secondary)"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: evt.type === "camera_offline" ? "#ef4444" : "var(--text-primary)" }}>{evt.type}</span>
                        <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{new Date(evt.timestamp).toLocaleString()}</span>
                      </div>
                      {evt.details && <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{typeof evt.details === "string" ? evt.details : JSON.stringify(evt.details)}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 20, color: "var(--text-tertiary)", fontSize: 11 }}>No events recorded</div>
              )}
            </div>
          </div>
          <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        </>
      )}

      {/* Add Camera Modal */}
      {showAddModal && (
        <>
          <div onClick={() => setShowAddModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(460px, 92vw)", background: "var(--bg-card)", zIndex: 1001,
            borderRadius: 12, border: "1px solid var(--border-primary)", padding: 24,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Add Camera</h3>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>Camera Name *</label>
                <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Main Gate Camera"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>IP Address *</label>
                <input value={addForm.ipAddress} onChange={e => setAddForm(p => ({ ...p, ipAddress: e.target.value }))} placeholder="192.168.1.100"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>Location</label>
                <input value={addForm.location} onChange={e => setAddForm(p => ({ ...p, location: e.target.value }))} placeholder="Main Entrance"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>Camera Type</label>
                  <select value={addForm.cameraType} onChange={e => setAddForm(p => ({ ...p, cameraType: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13 }}>
                    <option value="IP">IP Camera</option><option value="PTZ">PTZ Camera</option><option value="Dome">Dome Camera</option><option value="Bullet">Bullet Camera</option><option value="NVR">NVR Channel</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>Resolution</label>
                  <select value={addForm.resolution} onChange={e => setAddForm(p => ({ ...p, resolution: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13 }}>
                    <option value="720p">720p HD</option><option value="1080p">1080p Full HD</option><option value="2K">2K QHD</option><option value="4K">4K UHD</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}>RTSP URL (optional)</label>
                <input value={addForm.rtspUrl} onChange={e => setAddForm(p => ({ ...p, rtspUrl: e.target.value }))} placeholder={`rtsp://${addForm.ipAddress || '192.168.1.100'}:554/stream1`}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "monospace" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addCamera} disabled={!addForm.name || !addForm.ipAddress || adding}>
                {adding ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Adding...</> : <><Plus size={14} /> Add Camera</>}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function DRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-secondary)" }}>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, maxWidth: "60%", textAlign: "right", wordBreak: "break-all" }}>{typeof value === "string" ? value : value}</span>
    </div>
  );
}
