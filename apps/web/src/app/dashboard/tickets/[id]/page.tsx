"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronRight, MessageSquare, Send, Clock, User,
  AlertTriangle, CheckCircle2, Circle, Tag, Package, Activity
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "red", HIGH: "amber", MEDIUM: "purple", LOW: "green",
};
const STATUS_COLORS: Record<string, string> = {
  NEW: "blue", OPEN: "cyan", IN_PROGRESS: "amber", PENDING: "purple",
  ON_HOLD: "gray", RESOLVED: "green", CLOSED: "green", CANCELLED: "red",
};
const STATUS_FLOW = ["NEW", "OPEN", "IN_PROGRESS", "PENDING", "ON_HOLD", "RESOLVED", "CLOSED"];

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [csatScore, setCsatScore] = useState(0);
  const [csatComment, setCsatComment] = useState("");
  const [csatSubmitting, setCsatSubmitting] = useState(false);
  const [kbArticles, setKbArticles] = useState<any[]>([]);

  function loadTicket() {
    apiFetch(`/tickets/${params.id}`).then(setTicket).catch(console.error).finally(() => setLoading(false));
    apiFetch(`/tickets/${params.id}/kb-suggest`).then((r) => setKbArticles(r?.data || [])).catch(() => setKbArticles([]));
  }

  useEffect(() => { loadTicket(); }, [params.id]);

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/tickets/${params.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: comment }),
      });
      setComment("");
      loadTicket();
    } catch (err) { console.error(err); }
    setSubmitting(false);
  }

  async function handleStatusChange(status: string) {
    setStatusChanging(true);
    try {
      await apiFetch(`/tickets/${params.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      loadTicket();
    } catch (err) { console.error(err); }
    setStatusChanging(false);
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Activity size={24} style={{ color: "var(--brand-500)", animation: "spin 2s linear infinite" }} /></div>;
  if (!ticket) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Ticket not found</div>;

  const age = Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60));

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, color: "var(--text-tertiary)" }}>
        <button onClick={() => router.push("/dashboard/tickets")} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", fontSize: 13 }}>
          <ArrowLeft size={14} /> Tickets
        </button>
        <ChevronRight size={12} />
        <span style={{ color: "var(--text-secondary)" }}>{ticket.ticketNumber}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* Main Column */}
        <div>
          {/* Header */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span className={`badge ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
              <span className={`badge ${STATUS_COLORS[ticket.status]}`}>{ticket.status.replace(/_/g, " ")}</span>
              <span className="badge gray">{ticket.type.replace(/_/g, " ")}</span>
              {ticket.category && <span className="badge cyan">{ticket.category}</span>}
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{ticket.subject}</h1>
            {ticket.description && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>{ticket.description}</p>
            )}
          </div>

          {/* Status Actions */}
          <div className="card" style={{ marginBottom: 16, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginRight: 4 }}>Update Status:</span>
              {STATUS_FLOW.map(s => (
                <button key={s} onClick={() => handleStatusChange(s)} disabled={statusChanging || ticket.status === s}
                  className={`btn ${ticket.status === s ? "btn-primary" : "btn-secondary"}`}
                  style={{ padding: "4px 10px", fontSize: 11, opacity: ticket.status === s ? 1 : 0.7 }}>
                  {s === ticket.status && <CheckCircle2 size={10} />} {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* CSAT */}
          {["RESOLVED", "CLOSED"].includes(ticket.status) && !ticket.csatAt && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><div className="card-title">Customer Satisfaction</div></div>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>How satisfied are you with the resolution? (1–5)</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" className={`btn ${csatScore === n ? "btn-primary" : "btn-secondary"}`}
                    style={{ width: 40, padding: "8px 0" }} onClick={() => setCsatScore(n)}>{n}</button>
                ))}
              </div>
              <textarea value={csatComment} onChange={e => setCsatComment(e.target.value)} placeholder="Optional comment"
                rows={2} style={{
                  width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-primary)",
                  background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", marginBottom: 10,
                }} />
              <button className="btn btn-primary" disabled={!csatScore || csatSubmitting} onClick={async () => {
                setCsatSubmitting(true);
                try {
                  await apiFetch(`/tickets/${params.id}/csat`, { method: "POST", body: JSON.stringify({ score: csatScore, comment: csatComment }) });
                  loadTicket();
                } catch (err) { alert(String(err)); }
                setCsatSubmitting(false);
              }}>{csatSubmitting ? "Submitting…" : "Submit CSAT"}</button>
            </div>
          )}
          {ticket.csatAt && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><div className="card-title">CSAT submitted</div></div>
              <div style={{ fontSize: 13 }}>Score: <strong>{ticket.satisfactionScore}/5</strong></div>
              {ticket.csatComment && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{ticket.csatComment}</p>}
            </div>
          )}

          {/* Knowledge base suggestions */}
          {kbArticles.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><div className="card-title">Suggested knowledge articles</div></div>
              <div style={{ display: "grid", gap: 8 }}>
                {kbArticles.map((a: any) => (
                  <a key={a.id} href={`/dashboard/knowledge-base?id=${a.id}`}
                    style={{ display: "block", padding: "10px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brand-400)" }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {a.category}{a.viewCount != null ? ` · ${a.viewCount} views` : ""}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comments Thread */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><MessageSquare size={14} /> Comments ({ticket.comments?.length || 0})</div>
            </div>

            {/* Comment List */}
            <div style={{ display: "grid", gap: 16, marginBottom: 20 }}>
              {(!ticket.comments || ticket.comments.length === 0) ? (
                <div style={{ textAlign: "center", padding: 24, color: "var(--text-tertiary)", fontSize: 13 }}>
                  No comments yet. Be the first to respond.
                </div>
              ) : ticket.comments.map((c: any) => (
                <div key={c.id} style={{
                  padding: 14, borderRadius: 10,
                  background: c.isInternal ? "rgba(139,92,246,0.06)" : "var(--bg-elevated)",
                  border: `1px solid ${c.isInternal ? "rgba(139,92,246,0.15)" : "var(--border-primary)"}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 6,
                        background: "linear-gradient(135deg, var(--brand-500), var(--accent-500))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontSize: 10, fontWeight: 700,
                      }}>
                        {c.author?.firstName?.[0]}{c.author?.lastName?.[0] || "?"}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                        {c.author ? `${c.author.firstName} ${c.author.lastName}` : "Unknown User"}
                      </span>
                      {c.isInternal && <span className="badge purple" style={{ fontSize: 9 }}>Internal</span>}
                    </div>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>{c.content}</p>
                </div>
              ))}
            </div>

            {/* New Comment Form */}
            <form onSubmit={handleComment} style={{ display: "flex", gap: 8 }}>
              <input
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Add a comment..."
                style={{
                  flex: 1, padding: "10px 14px", background: "var(--bg-input)",
                  border: "1px solid var(--border-primary)", borderRadius: 8,
                  color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none",
                }}
              />
              <button type="submit" className="btn btn-primary" disabled={submitting || !comment.trim()}
                style={{ padding: "10px 16px" }}>
                <Send size={14} /> {submitting ? "..." : "Send"}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {/* Details Card */}
          <div className="card">
            <div className="card-header"><div className="card-title">Details</div></div>
            <div style={{ display: "grid", gap: 12 }}>
              <DetailRow icon={<Tag size={13} />} label="Ticket #" value={ticket.ticketNumber} mono />
              <DetailRow icon={<AlertTriangle size={13} />} label="Priority" value={
                <span className={`badge ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
              } />
              <DetailRow icon={<Circle size={13} />} label="Status" value={
                <span className={`badge ${STATUS_COLORS[ticket.status]}`}>{ticket.status.replace(/_/g, " ")}</span>
              } />
              <DetailRow icon={<Package size={13} />} label="Type" value={ticket.type.replace(/_/g, " ")} />
              {ticket.category && <DetailRow icon={<Tag size={13} />} label="Category" value={ticket.category} />}
              <DetailRow icon={<Clock size={13} />} label="Age" value={age < 24 ? `${age}h` : `${Math.floor(age / 24)}d ${age % 24}h`} />
            </div>
          </div>

          {/* People Card */}
          <div className="card">
            <div className="card-header"><div className="card-title">People</div></div>
            <div style={{ display: "grid", gap: 12 }}>
              <PersonRow label="Requester" user={ticket.requester} />
              <PersonRow label="Assigned To" user={ticket.assignedTo} />
              {ticket.assignedGroup && (
                <DetailRow icon={<User size={13} />} label="Group" value={ticket.assignedGroup} />
              )}
            </div>
          </div>

          {/* SLA Card */}
          <div className="card">
            <div className="card-header"><div className="card-title">SLA</div></div>
            <div style={{ display: "grid", gap: 12 }}>
              <DetailRow icon={<Clock size={13} />} label="Created" value={new Date(ticket.createdAt).toLocaleString()} />
              <DetailRow icon={<Clock size={13} />} label="Response Due" value={ticket.responseDueAt ? new Date(ticket.responseDueAt).toLocaleString() : "—"} />
              <DetailRow icon={<Clock size={13} />} label="Resolution Due" value={ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : "—"} />
              {ticket.resolvedAt && <DetailRow icon={<CheckCircle2 size={13} />} label="Resolved" value={new Date(ticket.resolvedAt).toLocaleString()} />}
            </div>
          </div>

          {/* Linked Assets */}
          <div className="card">
            <div className="card-header"><div className="card-title">Linked Assets</div></div>
            {(!ticket.assets || ticket.assets.length === 0) ? (
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>No assets linked</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {ticket.assets.map((ta: any) => (
                  <div key={ta.id} style={{
                    padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: 6,
                    border: "1px solid var(--border-primary)", cursor: "pointer",
                  }} onClick={() => router.push(`/dashboard/assets/${ta.asset?.id}`)}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{ta.asset?.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{ta.asset?.assetTag}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function DetailRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: any; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: mono ? "monospace" : "inherit", fontWeight: 500 }}>
        {typeof value === "string" ? value : value}
      </span>
    </div>
  );
}

function PersonRow({ label, user }: { label: string; user: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
        <User size={13} /> {label}
      </span>
      {user ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 5,
            background: "linear-gradient(135deg, var(--brand-500), var(--accent-500))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 8, fontWeight: 700,
          }}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>
            {user.firstName} {user.lastName}
          </span>
        </div>
      ) : (
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Unassigned</span>
      )}
    </div>
  );
}
