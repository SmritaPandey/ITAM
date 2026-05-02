"use client";
import { useEffect, useState } from "react";
import { Camera, Video, Eye, AlertTriangle, CheckCircle2, Clock, MapPin, Shield, Grid3X3, Loader2, RefreshCw } from "lucide-react";
import { getApiBase, getToken } from "@/lib/api";

export default function CCTVPage() {
  const [data, setData] = useState<any>({ data: [], total: 0, online: 0, recording: 0, alerts: 0 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  function refresh() {
    fetch(`${getApiBase()}/monitoring/cameras`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }
  useEffect(() => { refresh(); }, []);

  const cameras = data.data || [];

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
          <p className="page-subtitle">{data.total} cameras • {data.online} online</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={14} /></button>
          <button className={`btn ${viewMode === "grid" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("grid")} style={{ padding: "6px 10px" }}><Grid3X3 size={14} /></button>
          <button className={`btn ${viewMode === "list" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("list")} style={{ padding: "6px 10px" }}><Eye size={14} /></button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card"><div className="stat-icon cyan"><Camera size={22} /></div><div className="stat-content"><div className="stat-label">Total Cameras</div><div className="stat-value">{data.total}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={22} /></div><div className="stat-content"><div className="stat-label">Online</div><div className="stat-value">{data.online}</div></div></div>
        <div className="stat-card"><div className="stat-icon purple"><Video size={22} /></div><div className="stat-content"><div className="stat-label">Recording</div><div className="stat-value">{data.recording}</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><AlertTriangle size={22} /></div><div className="stat-content"><div className="stat-label">Alerts</div><div className="stat-value">{data.alerts}</div></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(340px, 1fr))" : "1fr", gap: 12 }}>
        {cameras.map((cam: any) => {
          const cfg = cam.config || {};
          const met = cam.metrics || {};
          return (
            <div key={cam.id} className="card" style={{ overflow: "hidden" }}>
              <div style={{
                height: viewMode === "grid" ? 160 : 100,
                background: cam.status === "ONLINE" ? "linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)" : "linear-gradient(135deg, #1a0a0a 0%, #2d1515 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", borderRadius: "8px 8px 0 0", margin: "-16px -16px 12px",
              }}>
                <div style={{ textAlign: "center" }}>
                  {cam.status === "ONLINE" ? (
                    <><Camera size={28} style={{ color: "rgba(6,182,212,0.4)" }} /><div style={{ fontSize: 9, color: "rgba(6,182,212,0.5)", marginTop: 4 }}>LIVE FEED</div></>
                  ) : (
                    <><AlertTriangle size={28} style={{ color: "rgba(239,68,68,0.5)" }} /><div style={{ fontSize: 9, color: "rgba(239,68,68,0.6)", marginTop: 4 }}>OFFLINE</div></>
                  )}
                </div>
                {cfg.recording && (
                  <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 2s infinite" }} />
                    <span style={{ fontSize: 9, color: "rgba(239,68,68,0.8)", fontWeight: 600 }}>REC</span>
                  </div>
                )}
                <div style={{ position: "absolute", top: 8, left: 8 }}>
                  <span className="badge gray" style={{ fontSize: 9, backdropFilter: "blur(4px)", background: "rgba(0,0,0,0.4)" }}>{cfg.resolution || "—"}</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{cam.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}><MapPin size={10} /> {cam.location}</div>
                </div>
                <span className={`badge ${cam.status === "ONLINE" ? "green" : "red"}`}>{cam.status}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                <div><span style={{ color: "var(--text-tertiary)" }}>Type</span><br /><span style={{ fontWeight: 500 }}>{cfg.cameraType || "—"}</span></div>
                <div><span style={{ color: "var(--text-tertiary)" }}>Storage</span><br /><span style={{ fontWeight: 500 }}>{met.storage || 0}%</span></div>
                <div><span style={{ color: "var(--text-tertiary)" }}>Health</span><br /><span style={{ fontWeight: 500, color: met.health > 90 ? "var(--success)" : met.health > 0 ? "var(--warning)" : "var(--danger)" }}>{met.health || 0}%</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
