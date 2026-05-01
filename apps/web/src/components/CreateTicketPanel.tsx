"use client";
import { useState } from "react";
import { X, Send, AlertTriangle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }

interface CreateTicketPanelProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTicketPanel({ open, onClose, onCreated }: CreateTicketPanelProps) {
  const [form, setForm] = useState({
    subject: "", description: "", type: "SERVICE_REQUEST",
    priority: "MEDIUM", category: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleChange(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim()) { setError("Subject is required"); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/tickets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setForm({ subject: "", description: "", type: "SERVICE_REQUEST", priority: "MEDIUM", category: "" });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create ticket");
    }
    setSubmitting(false);
  }

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 1000, backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "var(--bg-card)", zIndex: 1001,
        borderLeft: "1px solid var(--border-primary)",
        display: "flex", flexDirection: "column",
        animation: "slideIn 0.2s ease-out",
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border-primary)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="stat-icon amber" style={{ width: 32, height: 32 }}><AlertTriangle size={16} /></div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>New Ticket</h2>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>Submit a request or report an issue</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={labelStyle}>Subject *</label>
              <input value={form.subject} onChange={e => handleChange("subject", e.target.value)}
                placeholder="Brief description of the issue" style={inputStyle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={form.type} onChange={e => handleChange("type", e.target.value)} style={inputStyle}>
                  <option value="SERVICE_REQUEST">Service Request</option>
                  <option value="INCIDENT">Incident</option>
                  <option value="PROBLEM">Problem</option>
                  <option value="CHANGE">Change</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={form.priority} onChange={e => handleChange("priority", e.target.value)} style={inputStyle}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => handleChange("category", e.target.value)} style={inputStyle}>
                <option value="">Select category...</option>
                <option value="Hardware">Hardware</option>
                <option value="Software">Software</option>
                <option value="Network">Network</option>
                <option value="Access">Access / Permissions</option>
                <option value="Facilities">Facilities</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={form.description} onChange={e => handleChange("description", e.target.value)}
                placeholder="Detailed description of the issue or request..."
                style={{ ...inputStyle, height: 120, resize: "vertical" }} />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8,
              color: "var(--error)", fontSize: 12,
            }}>
              {error}
            </div>
          )}
        </form>

        <div style={{
          padding: "12px 20px", borderTop: "1px solid var(--border-primary)",
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            <Send size={14} /> {submitting ? "Creating..." : "Submit Ticket"}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
  marginBottom: 6, display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: "var(--bg-input)",
  border: "1px solid var(--border-primary)", borderRadius: 8,
  color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none",
};
