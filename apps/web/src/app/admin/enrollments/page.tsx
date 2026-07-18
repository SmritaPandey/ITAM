"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Ban, RefreshCw, Search } from "lucide-react";

export default function AdminEnrollmentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    apiFetch("/admin/agent-enrollments?limit=100")
      .then((d) => {
        setRows(d.data || []);
        setTotal(d.total || 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function revoke(id: string) {
    if (!confirm("Revoke this enrollment? The agent must re-authenticate.")) return;
    await apiFetch(`/admin/agent-enrollments/${id}/revoke`, { method: "POST" });
    load();
  }

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.tenant?.name?.toLowerCase().includes(q) ||
      r.agent?.hostname?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q) ||
      r.tokenJti?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Agent Enrollments</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{total} enrollment records across tenants</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tenant / hostname…"
              style={{
                padding: "8px 12px 8px 32px", borderRadius: 8, border: "1px solid var(--border-primary)",
                background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, width: 220, outline: "none",
              }}
            />
          </div>
          <button onClick={load} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
            border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
          }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
              {["Tenant", "Hostname", "Status", "Created", "Last used", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>No enrollments</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text-primary)" }}>{r.tenant?.name || "—"}</td>
                <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 11 }}>
                  {r.agent?.hostname || "(unbound)"}
                  {r.agent?.ipAddress ? ` · ${r.agent.ipAddress}` : ""}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                    background: r.revokedAt ? "#ef444415" : "#10b98115",
                    color: r.revokedAt ? "#ef4444" : "#10b981",
                  }}>
                    {r.revokedAt ? "REVOKED" : r.agent?.status || "ACTIVE"}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--text-tertiary)", fontSize: 11 }}>{new Date(r.createdAt).toLocaleString()}</td>
                <td style={{ padding: "12px 14px", color: "var(--text-tertiary)", fontSize: 11 }}>
                  {r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleString() : "—"}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {!r.revokedAt && (
                    <button title="Revoke" onClick={() => revoke(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
                      <Ban size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
