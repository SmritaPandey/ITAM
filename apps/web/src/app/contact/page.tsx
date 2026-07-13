"use client";

import { useState } from "react";
import { Mail, MessageSquare, MapPin, Phone, Send, CheckCircle2, Loader2, Clock } from "lucide-react";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";

export default function ContactPage() {
  const t = usePublicTheme();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const inputStyle = {
    width: "100%" as const,
    padding: "12px 14px",
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.L ? "#f8fafc" : "rgba(0,0,0,0.35)",
    color: t.txt,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    transition: "border-color 0.2s ease",
  };

  const labelStyle = {
    display: "block" as const,
    fontSize: 11,
    marginBottom: 6,
    color: t.muted,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
      const res = await fetch(`${API}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to send message");
      }
      setSent(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const channels = [
    { icon: Mail, label: "General", value: "contact@qsasset.com", sub: "Partnerships and business discussions" },
    { icon: MessageSquare, label: "Support", value: "contact@qsasset.com", sub: "Technical help and product questions" },
    { icon: Phone, label: "Phone", value: "+91 (522) 430-1020", sub: "Mon–Fri, 10 AM–6 PM IST" },
    { icon: MapPin, label: "Headquarters", value: "Incubation Cell, IIIT Lucknow", sub: "Chak Ganjaria, Lucknow - 226002, UP, India" },
  ];

  return (
    <PublicShell maxWidth={1080}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <MonoEyebrow muted={t.muted} light={t.L}>Contact · NeurQ AI Labs</MonoEyebrow>
        <h1
          className="font-serif"
          style={{ fontSize: "clamp(36px, 5vw, 52px)", fontWeight: 400, lineHeight: 0.95, letterSpacing: "-0.02em", marginBottom: 14 }}
        >
          Get in <em style={{ fontStyle: "italic" }}>touch</em>
        </h1>
        <p style={{ fontSize: 16, fontWeight: 300, color: t.muted, maxWidth: 520, margin: "0 auto", lineHeight: 1.55 }}>
          Questions about QS Assets, a custom deployment, or an enterprise demo? Our team is ready to help.
        </p>
      </div>

      <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {channels.map((c) => (
            <div
              key={c.label}
              style={{
                background: t.card,
                border: `1px solid ${t.border}`,
                borderRadius: 16,
                padding: "20px 22px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: t.boxBg,
                  border: `1px solid ${t.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: t.txt,
                  flexShrink: 0,
                }}
              >
                <c.icon size={20} strokeWidth={1.75} />
              </div>
              <div>
                <div className="font-mono-label" style={{ fontSize: 10, color: t.muted, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: t.txt }}>{c.value}</div>
                <div style={{ fontSize: 13, color: t.muted, marginTop: 2, fontWeight: 300 }}>{c.sub}</div>
              </div>
            </div>
          ))}

          <div style={{ background: t.L ? "#1a1d21" : "#12151a", color: "#f5f5f7", borderRadius: 16, padding: 22, marginTop: 4 }}>
            <div className="font-mono-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={12} /> Response times
            </div>
            <p style={{ fontSize: 13, color: "#9f9fa0", margin: 0, lineHeight: 1.55, fontWeight: 300 }}>
              Enterprise customers with active SLAs get priority response through their support portal. General inquiries are typically handled within 24 hours.
            </p>
          </div>
        </div>

        <div>
          {sent ? (
            <div
              style={{
                background: t.card,
                border: `1px solid ${t.border}`,
                borderRadius: 16,
                padding: "56px 36px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                minHeight: 420,
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10b981",
                  marginBottom: 18,
                }}
              >
                <CheckCircle2 size={28} />
              </div>
              <h2 className="font-serif" style={{ fontSize: 28, fontWeight: 400, marginBottom: 8 }}>Message received</h2>
              <p style={{ fontSize: 14, color: t.muted, maxWidth: 280, margin: "0 auto 24px", lineHeight: 1.55, fontWeight: 300 }}>
                Thanks for reaching out. A NeurQ AI Labs engineer will follow up shortly.
              </p>
              <button
                onClick={() => setSent(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: "transparent",
                  color: t.txt,
                  fontSize: 14,
                  fontWeight: 400,
                  cursor: "pointer",
                }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{
                background: t.card,
                border: `1px solid ${t.border}`,
                borderRadius: 16,
                padding: 32,
              }}
            >
              <h3 className="font-serif" style={{ fontSize: 24, fontWeight: 400, marginBottom: 22 }}>Send a message</h3>

              <div className="contact-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="font-mono-label" style={labelStyle}>Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="Jane Smith"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = t.txt; }}
                    onBlur={(e) => { e.target.style.borderColor = t.border; }}
                  />
                </div>
                <div>
                  <label className="font-mono-label" style={labelStyle}>Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    type="email"
                    placeholder="jane@company.com"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = t.txt; }}
                    onBlur={(e) => { e.target.style.borderColor = t.border; }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="font-mono-label" style={labelStyle}>Subject</label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  required
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = t.txt; }}
                  onBlur={(e) => { e.target.style.borderColor = t.border; }}
                >
                  <option value="">Select a topic…</option>
                  <option value="demo">Request a demo</option>
                  <option value="pricing">Enterprise pricing</option>
                  <option value="support">Technical support</option>
                  <option value="partnership">Partnership</option>
                  <option value="other">General inquiry</option>
                </select>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label className="font-mono-label" style={labelStyle}>Message</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  required
                  rows={5}
                  placeholder="Tell us about your estate size, deployment needs, or questions…"
                  style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={(e) => { e.target.style.borderColor = t.txt; }}
                  onBlur={(e) => { e.target.style.borderColor = t.border; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px 0",
                  borderRadius: 8,
                  border: "none",
                  background: t.voidBtn,
                  color: t.voidTxt,
                  fontSize: 15,
                  fontWeight: 400,
                  cursor: loading ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "opacity 0.2s ease",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Sending…
                  </>
                ) : (
                  <>
                    <Send size={16} /> Send message
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 860px) {
          .contact-grid { grid-template-columns: 1fr !important; }
          .contact-form-row { grid-template-columns: 1fr !important; }
        }
        :root[data-theme="dark"] .font-mono-label[style*="background: rgba(15,23,42"] {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
      `}</style>
    </PublicShell>
  );
}
