"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { MessageSquare, Send, Archive, Eye, Clock, Mail } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { NEW: "#ef4444", READ: "#3b82f6", REPLIED: "#10b981", ARCHIVED: "#64748b" };
const SUBJECT_LABELS: Record<string, string> = { demo: "Demo Request", pricing: "Pricing", support: "Tech Support", partnership: "Partnership", other: "Other" };

export default function SupportPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  function load(status?: string) {
    setLoading(true);
    apiFetch(`/admin/contacts?limit=50${status ? `&status=${status}` : ""}`).then(d => {
      setContacts(d.data || []); setTotal(d.total || 0);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleFilter(s: string) { setFilter(s); load(s || undefined); }

  async function markAsRead(c: any) {
    if (c.status === "NEW") {
      await apiFetch(`/admin/contacts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READ" }),
      });
    }
    setSelected(c);
    setReply(c.reply || "");
    load(filter || undefined);
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    await apiFetch(`/admin/contacts/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: reply.trim() }),
    });
    setSending(false);
    setSelected(null); setReply("");
    load(filter || undefined);
  }

  async function archiveContact(id: string) {
    await apiFetch(`/admin/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    setSelected(null);
    load(filter || undefined);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Support Inbox</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{total} submissions total</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["", "NEW", "READ", "REPLIED", "ARCHIVED"].map(s => (
            <button key={s} onClick={() => handleFilter(s)} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-primary)",
              background: filter === s ? (s === "" ? "var(--bg-elevated)" : `${STATUS_COLORS[s] || "#64748b"}15`) : "transparent",
              color: filter === s ? (STATUS_COLORS[s] || "var(--text-primary)") : "var(--text-tertiary)",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 16 }}>
        {/* List */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</div>
          ) : contacts.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>No submissions</div>
          ) : contacts.map(c => (
            <div key={c.id} onClick={() => markAsRead(c)} style={{
              padding: "14px 16px", borderBottom: "1px solid var(--border-primary)",
              cursor: "pointer", background: selected?.id === c.id ? "var(--bg-elevated)" : "transparent",
              borderLeft: c.status === "NEW" ? "3px solid #ef4444" : "3px solid transparent",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: c.status === "NEW" ? 700 : 500, color: "var(--text-primary)" }}>{c.name}</div>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                  background: `${STATUS_COLORS[c.status] || "#64748b"}15`, color: STATUS_COLORS[c.status] || "#64748b",
                }}>{c.status}</span>
              </div>
              <div style={{ fontSize: 11, color: "#06b6d4", fontWeight: 600, marginBottom: 2 }}>{SUBJECT_LABELS[c.subject] || c.subject}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.message}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <Mail size={10} /> {c.email} &nbsp;•&nbsp; <Clock size={10} /> {new Date(c.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {/* Detail */}
        {selected && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{selected.name}</h3>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18 }}>×</button>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16, lineHeight: 2 }}>
              <div><strong>Email:</strong> {selected.email}</div>
              <div><strong>Subject:</strong> {SUBJECT_LABELS[selected.subject] || selected.subject}</div>
              <div><strong>Submitted:</strong> {new Date(selected.createdAt).toLocaleString()}</div>
              {selected.ipAddress && <div><strong>IP:</strong> {selected.ipAddress}</div>}
            </div>

            <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid var(--border-primary)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 6 }}>MESSAGE</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selected.message}</div>
            </div>

            {/* Existing Reply */}
            {selected.reply && (
              <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid rgba(16,185,129,0.2)" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#10b981", marginBottom: 6 }}>YOUR REPLY — {selected.repliedAt ? new Date(selected.repliedAt).toLocaleString() : ""}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selected.reply}</div>
              </div>
            )}

            {/* Reply Form */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>
                {selected.reply ? "Update Reply" : "Write Reply"}
              </label>
              <textarea value={reply} onChange={e => setReply(e.target.value)} rows={4} placeholder="Type your reply..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={sendReply} disabled={sending || !reply.trim()} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 20px", borderRadius: 8, border: "none",
                background: "#dc2626", color: "white", fontSize: 12, fontWeight: 600,
                cursor: sending ? "wait" : "pointer", opacity: !reply.trim() ? 0.5 : 1,
              }}>
                <Send size={12} /> {sending ? "Saving..." : "Save Reply"}
              </button>
              <button onClick={() => archiveContact(selected.id)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-primary)",
                background: "transparent", color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer",
              }}>
                <Archive size={12} /> Archive
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
