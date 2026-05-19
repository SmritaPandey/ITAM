"use client";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, Cookie } from "lucide-react";

export default function CookiePolicyPage() {
  const router = useRouter();
  const bg = "#0a0e1a", card = "rgba(26,31,53,0.7)", border = "rgba(42,49,80,0.5)", muted = "#94a3b8", txt = "#f1f5f9";

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

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Cookie Policy</h1>
        <p style={{ fontSize: 13, color: muted, marginBottom: 32 }}>Last updated: May 19, 2026 • Effective: May 19, 2026</p>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "28px 32px", lineHeight: 1.8, fontSize: 14, color: "#cbd5e1" }}>
          <Section title="1. What Are Cookies">
            Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences and improve your experience. QS Asset Management uses localStorage (a similar browser storage mechanism) instead of traditional cookies for most functionality.
          </Section>

          <Section title="2. Types of Storage We Use">
            <Table data={[
              { type: "Essential", purpose: "Authentication tokens (JWT), session management, theme preference", retention: "Until logout / browser clear", optional: "No — Required" },
              { type: "Analytics", purpose: "Anonymous page views, feature usage counts, session duration", retention: "Session only (cleared on tab close)", optional: "Yes — Requires consent" },
              { type: "Preferences", purpose: "Dashboard layout, sidebar state, cookie consent choice", retention: "Persistent (localStorage)", optional: "No — Functional" },
            ]} />
          </Section>

          <Section title="3. Essential Storage (Always Active)">
            These are required for the platform to function. Without them, you cannot log in or use QS Asset Management:
            <ul style={{ margin: "8px 0 0 20px", fontSize: 13 }}>
              <li><code style={{ background: "rgba(6,182,212,0.1)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>accessToken</code> — JWT authentication token (encrypted, contains user ID and role)</li>
              <li><code style={{ background: "rgba(6,182,212,0.1)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>refreshToken</code> — Token for seamless session renewal</li>
              <li><code style={{ background: "rgba(6,182,212,0.1)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>theme</code> — Your light/dark mode preference</li>
              <li><code style={{ background: "rgba(6,182,212,0.1)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>qs_cookie_consent</code> — Your cookie consent preferences</li>
            </ul>
          </Section>

          <Section title="4. Analytics (Consent Required)">
            If you opt in, we collect anonymous usage data to improve the platform:
            <ul style={{ margin: "8px 0 0 20px", fontSize: 13 }}>
              <li>Pages visited (paths only, no content)</li>
              <li>Time spent on pages</li>
              <li>Screen size and language (for responsive design)</li>
              <li>Session duration</li>
              <li>Feature usage counts (e.g., "assets page viewed")</li>
            </ul>
            <p style={{ marginTop: 8, fontWeight: 600, color: "#10b981" }}>
              We do NOT collect: form inputs, passwords, personal data, IP addresses in analytics, or any content you create in the platform.
            </p>
          </Section>

          <Section title="5. Third-Party Cookies">
            QS Asset Management does <strong>not</strong> use any third-party cookies, advertising trackers, or external analytics services (no Google Analytics, no Facebook Pixel, no tracking scripts). All analytics are first-party and processed on our own servers.
          </Section>

          <Section title="6. Managing Your Preferences">
            You can change your cookie preferences at any time:
            <ul style={{ margin: "8px 0 0 20px", fontSize: 13 }}>
              <li>Click "Manage Preferences" on the cookie banner (appears on first visit)</li>
              <li>Clear your browser's localStorage to reset all preferences</li>
              <li>Use your browser's built-in cookie management tools</li>
            </ul>
          </Section>

          <Section title="7. Data Processing Legal Basis">
            Under India's Digital Personal Data Protection Act (DPDP) 2023 and GDPR (for EU visitors):
            <ul style={{ margin: "8px 0 0 20px", fontSize: 13 }}>
              <li><strong>Essential storage:</strong> Legitimate interest — necessary for service delivery</li>
              <li><strong>Analytics:</strong> Consent — only processed with your explicit opt-in</li>
            </ul>
          </Section>

          <Section title="8. Contact">
            Data Protection Officer: NeurQ AI Labs Pvt Ltd, IIIT Lucknow, Uttar Pradesh, India. Email: privacy@neurqai.com
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{title}</h2>
      <div style={{ margin: 0 }}>{children}</div>
    </div>
  );
}

function Table({ data }: { data: { type: string; purpose: string; retention: string; optional: string }[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid rgba(42,49,80,0.5)" }}>
          {["Type", "Purpose", "Retention", "Optional?"].map(h => (
            <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#94a3b8", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map(r => (
          <tr key={r.type} style={{ borderBottom: "1px solid rgba(42,49,80,0.3)" }}>
            <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.type}</td>
            <td style={{ padding: "8px 10px" }}>{r.purpose}</td>
            <td style={{ padding: "8px 10px" }}>{r.retention}</td>
            <td style={{ padding: "8px 10px", color: r.optional.includes("No") ? "#ef4444" : "#10b981" }}>{r.optional}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
