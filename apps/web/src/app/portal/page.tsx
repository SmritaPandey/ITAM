"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Ticket, Plus, ArrowRight, CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }

function apiFetch(path: string) {
  return fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

export default function PortalDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    try { setUser(JSON.parse(atob(token.split(".")[1]))); } catch {}

    Promise.all([
      apiFetch("/assets?limit=50"),
      apiFetch("/tickets?limit=50"),
    ]).then(([a, t]) => {
      setAssets(a.data || []);
      setTickets(t.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const openTickets = tickets.filter(t => !["CLOSED", "RESOLVED"].includes(t.status)).length;
  const resolvedTickets = tickets.filter(t => ["CLOSED", "RESOLVED"].includes(t.status)).length;

  return (
    <>
      {/* Welcome */}
      <div style={{
        padding: "28px 32px", borderRadius: 16, marginBottom: 24,
        background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(6,182,212,0.1) 100%)",
        border: "1px solid rgba(139,92,246,0.2)",
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
          Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}! 👋
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
          Here&apos;s a summary of your assets and service requests
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat-card">
          <div className="stat-icon cyan"><Package size={22} /></div>
          <div className="stat-content"><div className="stat-label">My Assets</div><div className="stat-value">{assets.length}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Clock size={22} /></div>
          <div className="stat-content"><div className="stat-label">Open Tickets</div><div className="stat-value">{openTickets}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={22} /></div>
          <div className="stat-content"><div className="stat-label">Resolved</div><div className="stat-value">{resolvedTickets}</div></div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>Quick Actions</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push("/portal/tickets/new")} className="card" style={{
          cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: 20,
          border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.05)",
          textAlign: "left",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: "rgba(139,92,246,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6",
          }}><Plus size={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Raise New Ticket</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Request help, report an issue, or request a new asset</div>
          </div>
          <ArrowRight size={16} style={{ color: "var(--text-tertiary)" }} />
        </button>
        <button onClick={() => router.push("/portal/assets")} className="card" style={{
          cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: 20,
          border: "1px solid rgba(6,182,212,0.3)", background: "rgba(6,182,212,0.05)",
          textAlign: "left",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: "rgba(6,182,212,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#06b6d4",
          }}><Package size={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>View My Assets</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>See all assets assigned to you</div>
          </div>
          <ArrowRight size={16} style={{ color: "var(--text-tertiary)" }} />
        </button>
      </div>

      {/* Recent Tickets */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>Recent Tickets</h2>
      {tickets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
          <Ticket size={32} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No tickets yet</div>
          <p style={{ fontSize: 12 }}>Raise a new ticket to get started</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>Ticket #</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {tickets.slice(0, 5).map((t: any) => (
                <tr key={t.id} onClick={() => router.push(`/portal/tickets`)} style={{ cursor: "pointer" }}>
                  <td><code style={{ fontSize: 11, color: "var(--brand-400)" }}>{t.ticketNumber}</code></td>
                  <td style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>{t.subject}</td>
                  <td><span className={`badge ${t.priority === "CRITICAL" || t.priority === "HIGH" ? "red" : t.priority === "MEDIUM" ? "amber" : "gray"}`}>{t.priority}</span></td>
                  <td><span className={`badge ${t.status === "CLOSED" || t.status === "RESOLVED" ? "green" : t.status === "IN_PROGRESS" ? "cyan" : "amber"}`}>{t.status}</span></td>
                  <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
