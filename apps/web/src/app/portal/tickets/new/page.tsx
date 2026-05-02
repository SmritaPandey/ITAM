"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ticket, ArrowLeft, Send, AlertTriangle, HelpCircle,
  Package, Wrench, Loader2, CheckCircle2
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const CATEGORIES = [
  { value: "Hardware", icon: <Package size={18} />, color: "#06b6d4", desc: "Laptop, printer, monitor, peripherals" },
  { value: "Software", icon: <Wrench size={18} />, color: "#8b5cf6", desc: "Installation, license, access" },
  { value: "Network", icon: <HelpCircle size={18} />, color: "#3b82f6", desc: "Wi-Fi, VPN, connectivity" },
  { value: "Furniture", icon: <Package size={18} />, color: "#f59e0b", desc: "Desk, chair, workspace" },
  { value: "Access", icon: <AlertTriangle size={18} />, color: "#ef4444", desc: "Permissions, accounts, badges" },
  { value: "Other", icon: <HelpCircle size={18} />, color: "#64748b", desc: "General support" },
];

export default function RaiseTicketPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    subject: "", description: "", category: "",
    type: "SERVICE_REQUEST", priority: "MEDIUM",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject || !form.category) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await apiFetch("/tickets", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!result) throw new Error("Failed to create ticket");
      setSuccess(true);
      setTimeout(() => router.push("/portal/tickets"), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <CheckCircle2 size={56} style={{ color: "#10b981", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Ticket Submitted! 🎉</h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Your request has been sent to the admin team. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginBottom: 16, padding: "6px 12px", fontSize: 12 }}>
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 12px",
            background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.2))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Ticket size={26} style={{ color: "var(--brand-400)" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Raise a Ticket</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Describe your issue or request — the admin team will respond</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Category Selection */}
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Category *</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
            {CATEGORIES.map(c => (
              <button key={c.value} type="button" onClick={() => setForm({ ...form, category: c.value })} style={{
                padding: "12px 10px", borderRadius: 10, textAlign: "center", cursor: "pointer",
                background: form.category === c.value ? `${c.color}15` : "var(--bg-card)",
                border: form.category === c.value ? `2px solid ${c.color}` : "1px solid var(--border-primary)",
                color: form.category === c.value ? c.color : "var(--text-secondary)",
                transition: "all 0.15s", fontFamily: "inherit",
              }}>
                <div style={{ marginBottom: 4 }}>{c.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{c.value}</div>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2 }}>{c.desc}</div>
              </button>
            ))}
          </div>

          {/* Type */}
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Request Type</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[
              { value: "SERVICE_REQUEST", label: "Service Request" },
              { value: "INCIDENT", label: "Report Issue" },
            ].map(t => (
              <button key={t.value} type="button" onClick={() => setForm({ ...form, type: t.value })} className={`btn ${form.type === t.value ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: 12, padding: "6px 14px" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Priority */}
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Priority</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {["LOW", "MEDIUM", "HIGH"].map(p => (
              <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })}
                className={`btn ${form.priority === p ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: 12, padding: "6px 14px" }}>
                {p}
              </button>
            ))}
          </div>

          {/* Subject */}
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Subject *</label>
          <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required
            placeholder="e.g. Need new printer for HR department"
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, marginBottom: 16,
              background: "var(--bg-input)", border: "1px solid var(--border-primary)",
              color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none",
            }} />

          {/* Description */}
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Description</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Provide details about your request or issue..."
            rows={5}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, marginBottom: 20,
              background: "var(--bg-input)", border: "1px solid var(--border-primary)",
              color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none",
              resize: "vertical",
            }} />

          {error && (
            <div style={{
              padding: "8px 12px", borderRadius: 8, marginBottom: 16,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171", fontSize: 12,
            }}>{error}</div>
          )}

          <button type="submit" disabled={submitting || !form.subject || !form.category} className="btn btn-primary" style={{
            width: "100%", justifyContent: "center", padding: "12px", fontSize: 14,
          }}>
            {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
            {submitting ? "Submitting..." : "Submit Ticket"}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
