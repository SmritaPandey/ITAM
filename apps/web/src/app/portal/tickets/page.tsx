"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Plus, Clock, CheckCircle2, MessageSquare, Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }

export default function MyTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/tickets?limit=50`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(d => setTickets(d.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Tickets</h1>
          <p className="page-subtitle">{tickets.length} service requests</p>
        </div>
        <button className="btn btn-primary" onClick={() => router.push("/portal/tickets/new")}>
          <Plus size={14} /> Raise New Ticket
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "40vh", color: "var(--text-tertiary)" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
          <Ticket size={36} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No tickets yet</div>
          <p style={{ fontSize: 12, marginBottom: 16 }}>Raise a ticket to request help from IT</p>
          <button className="btn btn-primary" onClick={() => router.push("/portal/tickets/new")}>
            <Plus size={14} /> Raise New Ticket
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {tickets.map((t: any) => (
            <div key={t.id} className="card" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: t.status === "CLOSED" || t.status === "RESOLVED"
                  ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: t.status === "CLOSED" || t.status === "RESOLVED" ? "#10b981" : "#f59e0b",
              }}>
                {t.status === "CLOSED" || t.status === "RESOLVED" ? <CheckCircle2 size={18} /> : <Clock size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                  <code style={{ fontSize: 10, color: "var(--brand-400)", background: "var(--bg-elevated)", padding: "1px 6px", borderRadius: 4 }}>{t.ticketNumber}</code>
                  <span className={`badge ${t.priority === "CRITICAL" || t.priority === "HIGH" ? "red" : t.priority === "MEDIUM" ? "amber" : "gray"}`} style={{ fontSize: 9 }}>{t.priority}</span>
                  <span className="badge gray" style={{ fontSize: 9 }}>{t.type?.replace("_", " ")}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{t.subject}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {t.description?.slice(0, 80)}{t.description?.length > 80 ? "…" : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span className={`badge ${
                  t.status === "CLOSED" || t.status === "RESOLVED" ? "green" :
                  t.status === "IN_PROGRESS" ? "cyan" : "amber"
                }`}>{t.status}</span>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
