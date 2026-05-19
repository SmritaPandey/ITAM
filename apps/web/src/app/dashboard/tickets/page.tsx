"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare, Shield, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import CreateTicketPanel from "@/components/CreateTicketPanel";
import { apiFetch } from "@/lib/api";
import { PageHelp } from "@/components/HelpSystem";

const PRIORITY_BADGE: Record<string, string> = { CRITICAL: "red", HIGH: "amber", MEDIUM: "blue", LOW: "gray" };
const STATUS_BADGE: Record<string, string> = { NEW: "blue", OPEN: "cyan", IN_PROGRESS: "purple", PENDING: "amber", RESOLVED: "green", CLOSED: "gray" };
const TYPE_BADGE: Record<string, string> = { INCIDENT: "red", PROBLEM: "amber", CHANGE: "purple", SERVICE_REQUEST: "cyan", MAINTENANCE: "green" };

function slaCountdown(dueAt: string | null) {
  if (!dueAt) return null;
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) return { label: "BREACHED", color: "#ef4444", icon: <AlertTriangle size={10} /> };
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours < 1) return { label: `${mins}m`, color: "#f59e0b", icon: <Clock size={10} /> };
  if (hours < 4) return { label: `${hours}h ${mins}m`, color: "#f59e0b", icon: <Clock size={10} /> };
  return { label: `${hours}h ${mins}m`, color: "#10b981", icon: <CheckCircle2 size={10} /> };
}

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any>({ data: [], total: 0 });
  const [slaStats, setSlaStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  function loadTickets() {
    setLoading(true);
    Promise.all([
      apiFetch("/tickets?limit=50"),
      apiFetch("/tickets/sla/stats"),
    ]).then(([t, s]) => { setTickets(t); setSlaStats(s); })
      .catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { loadTickets(); }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tickets</h1>
          <p className="page-subtitle">{tickets.total} tickets • Incidents, Problems, Changes & Service Requests</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New Ticket</button>
      </div>

      <PageHelp id="tickets" title="Ticket Management">
        Create tickets for incidents, service requests, and changes. Each ticket tracks <strong>SLA compliance</strong> automatically — green means on track, amber is at risk, red is breached. Click any ticket to view details, add comments, and update status. End users can also submit tickets via the <strong>Self-Service Portal</strong> at /portal.
      </PageHelp>

      {/* Quick Stats + SLA panel */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 8 }}>
        {["NEW", "OPEN", "IN_PROGRESS", "PENDING", "RESOLVED"].map(status => {
          const count = tickets.data?.filter((t: any) => t.status === status).length || 0;
          const isActive = statusFilter === status;
          return (
            <div key={status} className="stat-card" style={{
              padding: 14, cursor: "pointer",
              borderLeft: isActive ? "3px solid var(--brand-400)" : undefined,
              transition: "transform 0.15s",
            }}
              onClick={() => setStatusFilter(isActive ? null : status)}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
              <div className="stat-content">
                <div className="stat-label">{status.replace("_", " ")}</div>
                <div className="stat-value" style={{ fontSize: 24 }}>{count}</div>
              </div>
              <span className={`badge ${STATUS_BADGE[status] || "gray"}`} style={{ alignSelf: "flex-start" }}>{status.replace("_", " ")}</span>
            </div>
          );
        })}
      </div>
      {statusFilter && (
        <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Showing: <strong>{statusFilter.replace("_", " ")}</strong></span>
          <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => setStatusFilter(null)}>Clear ✕</button>
        </div>
      )}

      {/* SLA Compliance Row */}
      {slaStats && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16,
          padding: 14, borderRadius: 12,
          background: "linear-gradient(135deg, rgba(34,211,238,0.04) 0%, rgba(59,130,246,0.04) 100%)",
          border: "1px solid rgba(34,211,238,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={16} style={{ color: "#22d3ee" }} />
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>SLA Tracked</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{slaStats.total}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} style={{ color: "#10b981" }} />
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>On Track</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{slaStats.onTrack}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} style={{ color: "#f59e0b" }} />
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>At Risk</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>{slaStats.atRisk}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} style={{ color: "#ef4444" }} />
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>Breached</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{slaStats.breached}</div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket #</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>SLA</th>
              <th>Requester</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading...</td></tr>
            ) : (statusFilter ? tickets.data?.filter((t: any) => t.status === statusFilter) : tickets.data)?.map((t: any) => {
              const sla = slaCountdown(t.resolutionDueAt);
              return (
                <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/dashboard/tickets/${t.id}`)}>
                  <td style={{ fontFamily: "monospace", color: "var(--brand-400)", fontWeight: 600, fontSize: 12 }}>{t.ticketNumber}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{t.subject}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.category || "General"}
                    </div>
                  </td>
                  <td><span className={`badge ${TYPE_BADGE[t.type] || "gray"}`}>{t.type.replace("_", " ")}</span></td>
                  <td><span className={`badge ${PRIORITY_BADGE[t.priority] || "gray"}`}>{t.priority}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[t.status] || "gray"}`}>{t.status.replace("_", " ")}</span></td>
                  <td>
                    {sla ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                        background: `${sla.color}15`, color: sla.color,
                      }}>
                        {sla.icon} {sla.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {t.requester ? `${t.requester.firstName} ${t.requester.lastName}` : "—"}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CreateTicketPanel open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadTickets} />
    </>
  );
}
