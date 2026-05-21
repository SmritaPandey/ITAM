"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Mail, MessageSquare, MapPin, Phone, Send, CheckCircle2, Loader2, Sparkles, Clock, Globe } from "lucide-react";

export default function ContactPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const [theme, setTheme] = useState<"dark" | "light">("light");
  useEffect(() => {
    const s = localStorage.getItem("theme") as "dark" | "light" | null;
    const t = s || "light";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  function toggleTheme() {
    const n = theme === "dark" ? "light" : "dark";
    setTheme(n);
    localStorage.setItem("theme", n);
    document.documentElement.setAttribute("data-theme", n);
  }
  const L = theme === "light";
  const bg = L ? "#f9fafb" : "#020205";
  const txt = L ? "#0f172a" : "#f3f4f6";
  const muted = L ? "#475569" : "#8a8f98";
  const border = L ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.06)";
  const card = L ? "rgba(255,255,255,0.7)" : "rgba(16, 22, 42, 0.65)";
  const cyanGlow = "rgba(6, 182, 212, 0.15)";

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
    <div style={{ minHeight: '100vh', background: bg, color: txt, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif", transition: 'background 0.5s, color 0.5s' }}>
      <Header theme={theme} onToggleTheme={toggleTheme} />

      {/* Glow Effect */}
      <div style={{ position: "relative", overflowX: "hidden" }}>
      <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "70%", height: "600px", background: "radial-gradient(ellipse at center, rgba(6,182,212,0.06) 0%, rgba(139,92,246,0.03) 50%, transparent 100%)", pointerEvents: "none", filter: "blur(100px)", zIndex: 0 }} />

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 24px 100px", paddingTop: 80, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.15)", marginBottom: 16, fontSize: 11, fontWeight: 700, color: "#06b6d4", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            <Sparkles size={11} /> Connect with NeurQ AI Labs
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, marginBottom: 12, letterSpacing: "-0.04em" }}>Get in Touch</h1>
          <p style={{ fontSize: 16, color: muted, maxWidth: 540, margin: "0 auto", lineHeight: 1.6 }}>
            Have questions about the QS Asset APM Platform? Need a custom deployment, integration support, or an enterprise demonstration? Our engineering team is ready to assist.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 32 }}>
          {/* Contact Cards Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { icon: Mail, label: "General Inquiries", value: "hello@neurqai.com", sub: "For partnerships and business discussions" },
              { icon: MessageSquare, label: "Technical Support", value: "support@neurqai.com", sub: "24/7 priority response for enterprise SLAs" },
              { icon: Phone, label: "Direct Phone Desk", value: "+91 (522) 430-1020", sub: "Operational Mon–Fri, 10 AM–6 PM IST" },
              { icon: MapPin, label: "Corporate Headquarters", value: "Incubation Cell, IIIT Lucknow", sub: "Chak Ganjaria, Lucknow - 226002, Uttar Pradesh, India" },
            ].map((c, i) => (
              <div key={i} style={{ background: card, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${border}`, borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 18, transition: "all 0.2s" }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#06b6d4", flexShrink: 0 }}><c.icon size={22} /></div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{c.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: txt }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{c.sub}</div>
                </div>
              </div>
            ))}

            {/* SLA Info Card */}
            <div style={{ background: "rgba(6,182,212,0.03)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 16, padding: 20, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                <Clock size={14} /> Response Commitments
              </div>
              <p style={{ fontSize: 12, color: muted, margin: 0, lineHeight: 1.6 }}>
                Enterprise customers holding active Service Level Agreements receive guaranteed <strong style={{ color: "#cbd5e1" }}>15-minute emergency response times</strong> through their dedicated support portal. General inquiries are processed chronologically within 24 hours.
              </p>
            </div>
          </div>

          {/* Glassmorphic Contact Form */}
          <div>
            {sent ? (
              <div style={{ background: card, backdropFilter: "blur(12px)", border: `1px solid ${border}`, borderRadius: 20, padding: "64px 40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", height: "100%", boxSizing: "border-box" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", marginBottom: 20 }}>
                  <CheckCircle2 size={32} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 8, letterSpacing: "-0.02em" }}>Message Received</h2>
                <p style={{ fontSize: 14, color: muted, maxWidth: 300, margin: "0 auto 24px", lineHeight: 1.6 }}>
                  Thank you for reaching out. A systems engineer from NeurQ AI Labs has been assigned to your query.
                </p>
                <button onClick={() => setSent(false)} style={{ padding: "10px 24px", borderRadius: 8, border: `1px solid ${border}`, background: "rgba(255,255,255,0.03)", color: txt, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ background: card, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${border}`, borderRadius: 20, padding: 32, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, letterSpacing: "-0.02em", color: "#f1f5f9" }}>Send a Direct Message</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Your Name</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jane Smith"
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "rgba(10,14,26,0.6)", color: txt, fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = "#06b6d4"} onBlur={e => e.target.style.borderColor = border} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Email Address</label>
                    <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required type="email" placeholder="jane@company.com"
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "rgba(10,14,26,0.6)", color: txt, fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = "#06b6d4"} onBlur={e => e.target.style.borderColor = border} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Subject / Inquiry Type</label>
                  <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "rgba(10,14,26,0.6)", color: txt, fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = "#06b6d4"} onBlur={e => e.target.style.borderColor = border}>
                    <option value="" style={{ background: "#0a0e1a" }}>Select a topic...</option>
                    <option value="demo" style={{ background: "#0a0e1a" }}>Request a Technical Demonstration</option>
                    <option value="pricing" style={{ background: "#0a0e1a" }}>Enterprise Pricing & Discount Inquiries</option>
                    <option value="support" style={{ background: "#0a0e1a" }}>Technical Support Desk</option>
                    <option value="partnership" style={{ background: "#0a0e1a" }}>Partnership Opportunities</option>
                    <option value="other" style={{ background: "#0a0e1a" }}>General Inquiries</option>
                  </select>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Detailed Message</label>
                  <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required rows={5} placeholder="Provide details on your required asset scale, deployment architecture, or general questions..."
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "rgba(10,14,26,0.6)", color: txt, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = "#06b6d4"} onBlur={e => e.target.style.borderColor = border} />
                </div>

                <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 800, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "transform 0.2s, opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.95"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                  {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Transmitting...</> : <><Send size={16} /> Send Message</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Footer theme={theme} />
    </div>
  );
}
