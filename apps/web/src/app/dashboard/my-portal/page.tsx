"use client";
import { useEffect, useState } from "react";
import {
  Monitor, Ticket, Package, Bell, Shield, ChevronRight,
  Clock, CheckCircle2, AlertTriangle, BookOpen, Headphones,
  Laptop, Server, Printer, Truck, HardDrive,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const ASSET_ICONS: Record<string, any> = {
  Laptop: <Laptop size={18} />, Server: <Server size={18} />, Printer: <Printer size={18} />,
  Vehicle: <Truck size={18} />, Desktop: <Monitor size={18} />,
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981", IN_USE: "#3b82f6", IN_REPAIR: "#f59e0b", RETIRED: "#6b7280", DISPOSED: "#ef4444",
};
const TICKET_STATUS: Record<string, { color: string; bg: string }> = {
  NEW: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  OPEN: { color: "#06b6d4", bg: "rgba(6,182,212,0.1)" },
  IN_PROGRESS: { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
  PENDING: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  RESOLVED: { color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  CLOSED: { color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

export default function MyPortalPage() {
  const [tab, setTab] = useState<"overview" | "assets" | "tickets" | "kb">("overview");
  const [dashboard, setDashboard] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any>({ data: [], total: 0 });
  const [kbArticles, setKbArticles] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/users/me/dashboard"),
      apiFetch("/users/me"),
      apiFetch("/users/me/assets"),
      apiFetch("/users/me/tickets"),
      apiFetch("/knowledge-base?limit=5"),
    ]).then(([d, p, a, t, kb]) => {
      setDashboard(d);
      setProfile(p);
      setAssets(Array.isArray(a) ? a : []);
      setTickets(t?.data ? t : { data: Array.isArray(t) ? t : [], total: 0 });
      setKbArticles(Array.isArray(kb?.data) ? kb.data : Array.isArray(kb) ? kb : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const tabs = [
    { id: "overview", label: "Overview", icon: <Monitor size={14} /> },
    { id: "assets", label: "My Assets", icon: <Package size={14} /> },
    { id: "tickets", label: "My Tickets", icon: <Ticket size={14} /> },
    { id: "kb", label: "Knowledge Base", icon: <BookOpen size={14} /> },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Portal</h1>
          <p className="page-subtitle">
            {profile ? `Welcome back, ${profile.firstName}` : "Self-service dashboard"} — manage your assets, tickets, and resources
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id as any)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              fontFamily: "inherit", transition: "all 0.2s",
              background: tab === t.id ? "rgba(34,211,238,0.15)" : "transparent",
              color: tab === t.id ? "#22d3ee" : "var(--text-tertiary)",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>Loading your portal...</div>
      ) : (
        <>
          {/* ── Overview ── */}
          {tab === "overview" && dashboard && (
            <>
              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
                <div className="stat-card" style={{ padding: 16 }}>
                  <div className="stat-content">
                    <div className="stat-label">My Assets</div>
                    <div className="stat-value" style={{ fontSize: 28 }}>{dashboard.assets}</div>
                  </div>
                  <Package size={20} style={{ color: "#3b82f6" }} />
                </div>
                <div className="stat-card" style={{ padding: 16 }}>
                  <div className="stat-content">
                    <div className="stat-label">Open Tickets</div>
                    <div className="stat-value" style={{ fontSize: 28, color: "#f59e0b" }}>{dashboard.openTickets}</div>
                  </div>
                  <Clock size={20} style={{ color: "#f59e0b" }} />
                </div>
                <div className="stat-card" style={{ padding: 16 }}>
                  <div className="stat-content">
                    <div className="stat-label">Resolved</div>
                    <div className="stat-value" style={{ fontSize: 28, color: "#10b981" }}>{dashboard.resolvedTickets}</div>
                  </div>
                  <CheckCircle2 size={20} style={{ color: "#10b981" }} />
                </div>
                <div className="stat-card" style={{ padding: 16 }}>
                  <div className="stat-content">
                    <div className="stat-label">Notifications</div>
                    <div className="stat-value" style={{ fontSize: 28, color: "#8b5cf6" }}>{dashboard.unreadNotifications}</div>
                  </div>
                  <Bell size={20} style={{ color: "#8b5cf6" }} />
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { icon: <Ticket size={20} />, label: "Raise a Ticket", sub: "Report an issue or request", href: "/dashboard/tickets", color: "#06b6d4" },
                  { icon: <Headphones size={20} />, label: "Service Catalog", sub: "Request IT services", href: "/dashboard/service-catalog", color: "#8b5cf6" },
                  { icon: <BookOpen size={20} />, label: "Knowledge Base", sub: "Find answers & guides", href: "/dashboard/knowledge-base", color: "#f59e0b" },
                ].map((a, i) => (
                  <a key={i} href={a.href} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: 16, borderRadius: 12,
                    background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
                    textDecoration: "none", color: "var(--text-primary)", transition: "all 0.2s",
                    cursor: "pointer",
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: `${a.color}15`, display: "flex", alignItems: "center", justifyContent: "center",
                      color: a.color,
                    }}>{a.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.sub}</div>
                    </div>
                    <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                  </a>
                ))}
              </div>

              {/* Recent tickets */}
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "var(--text-primary)" }}>Recent Tickets</h3>
                {tickets.data.length === 0 ? (
                  <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>No tickets yet. Click "Raise a Ticket" to get started.</p>
                ) : tickets.data.slice(0, 5).map((t: any) => (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}>
                    <span style={{
                      fontFamily: "monospace", fontSize: 10, color: "var(--brand-400)", fontWeight: 600, minWidth: 80,
                    }}>{t.ticketNumber}</span>
                    <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)" }}>{t.subject}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                      background: TICKET_STATUS[t.status]?.bg || "rgba(107,114,128,0.1)",
                      color: TICKET_STATUS[t.status]?.color || "#6b7280",
                    }}>{t.status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── My Assets ── */}
          {tab === "assets" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {assets.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                  <Package size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No assets assigned to you yet.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Type</th>
                      <th>Tag</th>
                      <th>Serial</th>
                      <th>Status</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a: any) => (
                      <tr key={a.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                              color: "#3b82f6",
                            }}>
                              {ASSET_ICONS[a.assetType?.name] || <HardDrive size={16} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{a.name}</div>
                              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{a.manufacturer || ""} {a.model || ""}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.assetType?.name || "—"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--brand-400)" }}>{a.assetTag || "—"}</td>
                        <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.serialNumber || "—"}</td>
                        <td>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                            background: `${STATUS_COLORS[a.status] || "#6b7280"}15`,
                            color: STATUS_COLORS[a.status] || "#6b7280",
                          }}>{a.status}</span>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.site?.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── My Tickets ── */}
          {tab === "tickets" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {tickets.data.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                  <Ticket size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>You haven't created any tickets yet.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticket #</th>
                      <th>Subject</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.data.map((t: any) => (
                      <tr key={t.id}>
                        <td style={{ fontFamily: "monospace", color: "var(--brand-400)", fontWeight: 600, fontSize: 12 }}>{t.ticketNumber}</td>
                        <td style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{t.subject}</td>
                        <td>
                          <span className={`badge ${t.priority === "CRITICAL" ? "red" : t.priority === "HIGH" ? "amber" : t.priority === "MEDIUM" ? "blue" : "gray"}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                            background: TICKET_STATUS[t.status]?.bg || "rgba(107,114,128,0.1)",
                            color: TICKET_STATUS[t.status]?.color || "#6b7280",
                          }}>{t.status.replace("_", " ")}</span>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : <span style={{ color: "var(--text-tertiary)" }}>Unassigned</span>}
                        </td>
                        <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Knowledge Base ── */}
          {tab === "kb" && (
            <div style={{ display: "grid", gap: 10 }}>
              {kbArticles.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                  <BookOpen size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No articles available.</p>
                </div>
              ) : kbArticles.map((a: any) => (
                <div key={a.id} className="card" style={{ padding: 16, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</h3>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-tertiary)", maxWidth: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.content?.substring(0, 120)}...
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="badge blue" style={{ fontSize: 10 }}>{a.category}</span>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{a.viewCount} views</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
