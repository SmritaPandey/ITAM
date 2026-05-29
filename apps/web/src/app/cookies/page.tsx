"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Cookie, Info, Lock } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function CookiePolicyPage() {
  const router = useRouter();

  const { theme, toggleTheme } = useTheme();
  const L = theme === "light";
  const bg = L ? "#f9fafb" : "#020205";
  const txt = L ? "#0f172a" : "#f3f4f6";
  const muted = L ? "#475569" : "#8a8f98";
  const border = L ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.06)";
  const card = L ? "rgba(255,255,255,0.7)" : "rgba(16, 22, 42, 0.65)";
  const pTxt = L ? "#334155" : "#cbd5e1";
  const codeColor = L ? "#0891b2" : "#22d3ee";

  return (
    <div style={{ minHeight: '100vh', background: bg, color: txt, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif", transition: 'background 0.5s, color 0.5s' }}>
      <Header theme={theme} onToggleTheme={toggleTheme} />

      <div style={{ position: "relative", overflowX: "hidden" }}>
      {/* Background Ambient Glows */}
      <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: "70%", height: "500px", background: "radial-gradient(ellipse at center, rgba(6,182,212,0.04) 0%, rgba(139,92,246,0.01) 50%, transparent 100%)", pointerEvents: "none", filter: "blur(100px)", zIndex: 0 }} />

      <div style={{ maxWidth: 840, margin: "0 auto", padding: "64px 24px 120px", paddingTop: 80, position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.15)", marginBottom: 16, fontSize: 11, fontWeight: 700, color: "#06b6d4", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            <Cookie size={11} /> Storage & First-Party Preferences
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.04em" }}>Cookie Policy</h1>
          <p style={{ fontSize: 14, color: muted }}>Last updated: May 21, 2026 • Effective Date: May 21, 2026</p>
        </div>

        <div style={{ background: card, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${border}`, borderRadius: 20, padding: "40px 48px", display: "flex", flexDirection: "column", gap: 32, lineHeight: 1.8, fontSize: 14, color: pTxt }}>
          
          <Section title="1. What Are Cookies & Session Identifiers?">
            Cookies are simple alphanumeric text strings saved onto your device by browser engines during website interactions. They assist services in remembering user parameters, login statuses, and preference details. 
            QS Asset Management implements modern first-party browser <code style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", padding: "1px 6px", borderRadius: 4, color: codeColor }}>localStorage</code> mechanisms in place of traditional tracking cookies for nearly all active system functions.
          </Section>

          <Section title="2. Taxonomy of Storage Elements We Implement">
            We categorize our active variables to ensure complete clarity over their operational lifecycles:
            <Table data={[
              { type: "Essential Authentication", purpose: "Validates security tokens (JWT), active session persistence, and organization mappings.", retention: "Destroyed upon user logout or browser session closure.", optional: "Required — Core Security" },
              { type: "Functional Settings", purpose: "Remembers sidebar visibility states, dashboard grids, and visual color mode preferences.", retention: "Persistent across browser storage indexes.", optional: "Functional" },
              { type: "Anonymized Analytics", purpose: "Tracks aggregated platform usage patterns (e.g. discovery scans run count) for service scaling.", retention: "Destroyed on browser tab close.", optional: "Opt-in Consent Required" },
            ]} />
          </Section>

          <Section title="3. Mandatory Essential Storage (Always Active)">
            These variables are programmatically required to establish connection integrity. Disabling them will disrupt platform authentication capabilities:
            <ul style={{ margin: "12px 0 0", paddingLeft: 20, fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>
                <code style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", padding: "2px 6px", borderRadius: 4, color: codeColor }}>accessToken</code> — Encrypted JSON Web Token validating your administrative session authorization.
              </li>
              <li>
                <code style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", padding: "2px 6px", borderRadius: 4, color: codeColor }}>refreshToken</code> — Cryptographic token used to securely extend authentication sessions without prompting credential re-entry.
              </li>
              <li>
                <code style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", padding: "2px 6px", borderRadius: 4, color: codeColor }}>theme</code> — Caches user color style preferences (dark/light mode configuration).
              </li>
              <li>
                <code style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", padding: "2px 6px", borderRadius: 4, color: codeColor }}>qs_cookie_consent</code> — Stores user preference configurations for optional analytical trackers.
              </li>
            </ul>
          </Section>

          <Section title="4. Optional Analytics Storage (Consent Required)">
            If you opt-in, we capture highly aggregated, anonymized usage telemetry to improve interface responsiveness:
            <ul style={{ margin: "12px 0 0", paddingLeft: 20, fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
              <li>Pages and system routes visited (represented by relative paths).</li>
              <li>Operational time scopes spent resolving ticketing requests.</li>
              <li>Discovered assets count averages (aggregated to optimize visualization rendering performance).</li>
            </ul>
            <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, background: L ? "rgba(16,185,129,0.05)" : "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.15)", color: "#10b981", fontSize: 13 }}>
              🔒 <strong style={{ color: L ? "#065f46" : "#a7f3d0" }}>Privacy Guarantee:</strong> We explicitly DO NOT track keyboard input contents, configuration parameter values, physical device names, password lengths, or any system configurations inside our analytical trackers.
            </div>
          </Section>

          <Section title="5. Zero Third-Party Cookie Policy">
            We enforce an absolute ban on third-party marketing trackers. There are **zero** Facebook pixels, Google Analytics trackers, HubSpot scripts, or ad networks operating within our domains. All session variables and metrics are captured directly by our own servers and database clusters.
          </Section>

          <Section title="6. Revocation & Storage Management">
            You maintain absolute control over your browser variables:
            <ul style={{ margin: "8px 0 0 20px", fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Access the cookie preference banner to toggle analytical configurations dynamically.</li>
              <li>Initiate a physical browser storage wipe (Clear Site Data) to completely purge all local storage.</li>
              <li>Configure your browser system to block all site storage capabilities (note that this prevents platform sign-in).</li>
            </ul>
          </Section>

          <Section title="7. Compliance Foundation (DPDP Act 2023)">
            In strict compliance with India's DPDP Act 2023:
            <ul style={{ margin: "8px 0 0 20px", fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
              <li><strong>Essential Auth Variables:</strong> Processed under the lawful basis of Legitimate Service Delivery.</li>
              <li><strong>Analytics Variables:</strong> Processed strictly upon receiving your explicit, verifiable consent.</li>
            </ul>
          </Section>

          <Section title="8. Appointed Contact Details">
            For questions about browser session variables or local privacy storage rules, you may contact our operations team at:
            <div style={{ marginTop: 12, padding: 18, borderRadius: 12, background: L ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.01)", border: `1px solid ${border}`, fontSize: 13 }}>
              ✉️ <strong style={{ color: txt }}>Direct Email Desk:</strong> privacy@neurqai.com
            </div>
          </Section>

        </div>
      </div>
      </div>
      <Footer theme={theme} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const L = theme === "light";
  const headingColor = L ? "#0f172a" : "#f3f4f6";

  return (
    <div style={{ marginBottom: 8 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: headingColor, marginBottom: 12, letterSpacing: "-0.02em" }}>{title}</h2>
      <div>{children}</div>
    </div>
  );
}

function Table({ data }: { data: { type: string; purpose: string; retention: string; optional: string }[] }) {
  const { theme } = useTheme();
  const L = theme === "light";
  const borderCol = L ? "rgba(15, 23, 42, 0.08)" : "rgba(42, 49, 80, 0.4)";
  const headerBg = L ? "rgba(15, 23, 42, 0.02)" : "rgba(255, 255, 255, 0.02)";
  const tdTypeColor = L ? "#0f172a" : "#f1f5f9";
  const tdPurposeColor = L ? "#334155" : "#cbd5e1";
  const tdRetentionColor = L ? "#475569" : "#94a3b8";

  return (
    <div style={{ overflowX: "auto", margin: "16px 0", borderRadius: 12, border: `1px solid ${borderCol}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${borderCol}`, background: headerBg }}>
            {["Storage Category", "Operational Purpose", "Retention Window", "Consent Requirement"].map(h => (
              <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: L ? "#0891b2" : "#06b6d4", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.type} style={{ borderBottom: i === data.length - 1 ? "none" : `1px solid ${borderCol}`, background: "transparent" }}>
              <td style={{ padding: "14px 16px", fontWeight: 700, color: tdTypeColor }}>{r.type}</td>
              <td style={{ padding: "14px 16px", color: tdPurposeColor }}>{r.purpose}</td>
              <td style={{ padding: "14px 16px", color: tdRetentionColor }}>{r.retention}</td>
              <td style={{ padding: "14px 16px", color: r.optional.includes("Required") || r.optional.includes("Core") ? "#ef4444" : "#10b981", fontWeight: 600 }}>{r.optional}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
