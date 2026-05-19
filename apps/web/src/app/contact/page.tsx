"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, Mail, MessageSquare, MapPin, Phone, Send, CheckCircle2, Loader2 } from "lucide-react";

export default function ContactPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const bg = "#0a0e1a", card = "rgba(26,31,53,0.7)", border = "rgba(42,49,80,0.5)", muted = "#94a3b8", txt = "#f1f5f9";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
      const res = await fetch(`${API}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, subject: form.subject, message: form.message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to send message");
      }
      setSent(true);
    } catch (err: any) {
      alert(err.message || "Failed to send. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, color: txt, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <nav style={{ padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${border}`, background: "rgba(10,14,26,0.95)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <Shield size={24} style={{ color: "#06b6d4" }} />
          <span style={{ fontSize: 16, fontWeight: 800 }}>QS Asset Management</span>
        </div>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
          <ArrowLeft size={14} /> Back
        </button>
      </nav>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Get in Touch</h1>
          <p style={{ fontSize: 15, color: muted, maxWidth: 480, margin: "0 auto" }}>Have questions about QS Asset Management? Need a custom quote? We'd love to hear from you.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Contact Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { icon: Mail, label: "Email", value: "hello@neurqai.com", sub: "We respond within 24 hours" },
              { icon: Phone, label: "Phone", value: "+91 (522) XXX-XXXX", sub: "Mon–Fri, 10AM–6PM IST" },
              { icon: MapPin, label: "Office", value: "IIIT Lucknow, UP, India", sub: "NeurQ AI Labs Pvt Ltd" },
              { icon: MessageSquare, label: "Support", value: "support@neurqai.com", sub: "For existing customers" },
            ].map(c => (
              <div key={c.label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(6,182,212,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#06b6d4", flexShrink: 0 }}><c.icon size={20} /></div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: muted }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Contact Form */}
          {sent ? (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <CheckCircle2 size={40} style={{ color: "#10b981", marginBottom: 16 }} />
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Message Sent!</h2>
              <p style={{ fontSize: 13, color: muted }}>We'll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Your name"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "rgba(15,23,42,0.5)", color: txt, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>Email</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required type="email" placeholder="you@company.com"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "rgba(15,23,42,0.5)", color: txt, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>Subject</label>
                <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "rgba(15,23,42,0.5)", color: txt, fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                  <option value="">Select a topic</option>
                  <option value="demo">Request a Demo</option>
                  <option value="pricing">Enterprise Pricing</option>
                  <option value="support">Technical Support</option>
                  <option value="partnership">Partnership Inquiry</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>Message</label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required rows={5} placeholder="Tell us how we can help..."
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "rgba(15,23,42,0.5)", color: txt, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
              <button type="submit" disabled={loading} style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Sending...</> : <><Send size={15} /> Send Message</>}
              </button>
            </form>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
