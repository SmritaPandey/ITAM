"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare, Shield, Clock, AlertTriangle, CheckCircle2, Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import CreateTicketPanel from "@/components/CreateTicketPanel";
import { apiFetch } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtimeEvents";
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
  const [tickets, setTickets] = useState<any>({ data: [], total: 0, page: 1, totalPages: 1 });
  const [slaStats, setSlaStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  function loadTickets(p = page) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (statusFilter) params.set("status", statusFilter);
    Promise.all([
      apiFetch(`/tickets?${params}`),
      apiFetch("/tickets/sla/stats"),
    ]).then(([t, s]) => { setTickets(t); setSlaStats(s); })
      .catch(console.error).finally(() => setLoading(false));
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this ticket? This action cannot be undone.")) return;
    setDeleting(id);
    try {
      await apiFetch(`/tickets/${id}`, { method: "DELETE" });
      loadTickets(page);
    } catch { alert("Failed to delete ticket."); }
    finally { setDeleting(null); }
  }

  useEffect(() => { loadTickets(); }, []);

  // WebSocket: auto-refresh when tickets are created or updated
  const { on: onWsEvent } = useRealtimeEvents();
  useEffect(() => {
    const cleanups = [
      onWsEvent('ticket.created', () => loadTickets(page)),
      onWsEvent('ticket.updated', () => loadTickets(page)),
    ];
    return () => cleanups.forEach(c => c());
  }, [onWsEvent, page]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tickets</h1>
          <p className="page-subtitle">{tickets.total} tickets • Incidents, Problems, Changes & Service Requests</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New Ticket</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "8px 14px" }}>
          <Search size={15} style={{ color: "var(--text-tertiary)" }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setPage(1); loadTickets(1); } }}
            placeholder="Search tickets by subject, number, or requester..."
            style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        </div>
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
              <th style={{ width: 40 }}></th>
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
                  <td style={{ textAlign: "center" }}>
                    <button onClick={e => { e.stopPropagation(); handleDelete(t.id); }}
                      disabled={deleting === t.id}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "none"; }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {tickets.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", marginTop: 8, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Page {tickets.page || page} of {tickets.totalPages} ({tickets.total} tickets)</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadTickets(p); }} style={{ padding: "6px 14px", fontSize: 12 }}><ChevronLeft size={14} /> Prev</button>
            <button className="btn btn-secondary" disabled={page >= tickets.totalPages} onClick={() => { const p = page + 1; setPage(p); loadTickets(p); }} style={{ padding: "6px 14px", fontSize: 12 }}>Next <ChevronRight size={14} /></button>
          </div>
        </div>
      )}
      <CreateTicketPanel open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => loadTickets(1)} />
    </>
  );
}
