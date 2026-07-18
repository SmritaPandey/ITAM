"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useTheme } from "@/components/ThemeProvider";
import { Shield, CheckCircle2, Lock, Eye, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";

const SECTIONS = [
  { id: "section-1", title: "1. Introduction" },
  { id: "section-2", title: "2. Data We Collect" },
  { id: "section-3", title: "3. How We Use Data" },
  { id: "section-4", title: "4. Data Storage & Security" },
  { id: "section-5", title: "5. Data Retention Limits" },
  { id: "section-6", title: "6. Rights (DPDP Act 2023)" },
  { id: "section-7", title: "7. Cookie Storage" },
  { id: "section-8", title: "8. Grievance Officer" },
];

export default function PrivacyPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("section-1");
  const [requestType, setRequestType] = useState("ACCESS");
  const [subjectEmail, setSubjectEmail] = useState("");
  const [requestDetails, setRequestDetails] = useState("");
  const [requestStatus, setRequestStatus] = useState("");

  const { theme, toggleTheme } = useTheme();
  const L = theme === "light";
  const bg = L ? "#f5f7f8" : "#070b10";
  const txt = L ? "#0f172a" : "#f5f5f7";
  const muted = L ? "#6b7280" : "#9f9fa0";
  const border = L ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)";
  const card = L ? "#ffffff" : "rgba(18, 21, 26, 0.92)";
  const cyanGlow = "rgba(6, 182, 212, 0.15)";
  const pTxt = L ? "#334155" : "#cbd5e1";
  const codeColor = L ? "#0891b2" : "#22d3ee";
  const boxBg = L ? "rgba(15, 23, 42, 0.02)" : "rgba(255, 255, 255, 0.02)";

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -65% 0px",
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 100; // sticky header spacing
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, color: txt, fontFamily: "var(--font-body), 'DM Sans', system-ui, sans-serif", transition: 'background 0.4s, color 0.4s', overflowX: "hidden" }}>
      <Header theme={theme} onToggleTheme={toggleTheme} />

      <div style={{ position: "relative", overflowX: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: "0 0 auto 0", height: 360, pointerEvents: "none", zIndex: 0, background: L ? "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(6,182,212,0.12) 0%, transparent 55%), linear-gradient(180deg, #eef4f6 0%, #f5f7f8 70%)" : "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(6,182,212,0.16) 0%, transparent 55%), linear-gradient(180deg, #0a1218 0%, #070b10 75%)" }} />

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 24px 120px", paddingTop: 108, position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 48 }}>
          <div className="font-mono-label" style={{ display: "inline-block", padding: "8px 18px", borderRadius: 9999, background: L ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.08)", border: `1px solid ${border}`, marginBottom: 16, fontSize: 11, color: muted }}>
            Privacy · DPDP-oriented
          </div>
          <h1 className="font-serif" style={{ fontSize: "clamp(36px, 5vw, 48px)", fontWeight: 400, marginBottom: 8, letterSpacing: "-0.02em", lineHeight: 0.95 }}>Privacy Policy</h1>
          <p className="font-mono-label" style={{ fontSize: 11, color: muted, letterSpacing: "0.06em" }}>Updated May 21, 2026</p>
        </div>

        <div className="legal-container">
          {/* Sticky Left Table of Contents */}
          <div className="legal-toc" style={{ background: L ? "#ffffff" : "rgba(18, 21, 26, 0.92)", border: `1px solid ${border}` }}>
            <div className="font-mono-label" style={{ fontSize: 10, color: muted, marginBottom: 14, paddingLeft: 12 }}>
              Outline
            </div>
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                className={`legal-toc-item ${activeSection === sec.id ? "active" : ""}`}
              >
                {sec.title}
              </button>
            ))}
          </div>

          {/* Right Scrolling Content Area */}
          <div className="legal-content">
            <div style={{ background: card, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${border}`, borderRadius: 20, padding: "40px 48px", display: "flex", flexDirection: "column", gap: 36, color: pTxt }}>
              
              <section id="section-1">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                  1. Introduction & Regulatory Stand
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  NeurQ AI Labs Private Limited (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the <strong>QS Asset APM Platform</strong>. We are unconditionally committed to protecting the privacy, digital assets, and sensitive telemetry data of our enterprise organizations and individual administrators. 
                </p>
                <p style={{ marginTop: 12, marginBottom: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  This Privacy Policy delineates our rigorous methodologies for data collection, processing, transit security, and absolute isolation. This platform operates in strict compliance with the **Digital Personal Data Protection Act, 2023 (DPDP Act)** of India, the **General Data Protection Regulation (GDPR)** for EU citizens, and relevant regional regulatory frameworks.
                </p>
              </section>

              <section id="section-2">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  2. Data We Collect & Lawful Bases
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  We strictly process data based on your explicit consent, which is requested at the time of account creation. We gather the following categories of telemetry and parameters:
                </p>
                <ul style={{ margin: "14px 0 0", paddingLeft: 20, color: pTxt, fontSize: 14, lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <li>
                    <strong style={{ color: txt }}>Administrative Account Details:</strong> Name, work email address, phone number, corporate entity parameters, and credentials (securely transformed utilizing salt-workload factor 12 <code style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", padding: "1px 6px", borderRadius: 4, color: codeColor }}>bcrypt</code> hashes).
                  </li>
                  <li>
                    <strong style={{ color: txt }}>Discovery Scanning Data:</strong> Hostnames, local IP allocations, MAC coordinates, responding service interfaces, operating system signatures, network switch configurations, SNMP-enabled equipment metrics, ONVIF CCTV capabilities, and physical vehicle GPS coordinate values discovered through active system scans.
                  </li>
                  <li>
                    <strong style={{ color: txt }}>Host Agent System Telemetry:</strong> CPU cores, memory utilization arrays, disk volume limits, running daemon instances, active user sessions, and comprehensive software manifests gathered by the QS Asset Management Agent.
                  </li>
                </ul>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setRequestStatus("Submitting…");
                    try {
                      await apiFetch("/privacy/data-subject-requests", {
                        method: "POST",
                        body: JSON.stringify({ type: requestType, subjectEmail, details: requestDetails }),
                      });
                      setRequestStatus("Request submitted. Your organization can now track it.");
                      setRequestDetails("");
                    } catch (error) {
                      setRequestStatus(error instanceof Error ? error.message : "Unable to submit request");
                    }
                  }}
                  style={{ marginTop: 20, padding: 18, borderRadius: 12, border: `1px solid ${border}`, background: boxBg, display: "grid", gap: 12 }}
                >
                  <strong style={{ color: txt, fontSize: 14 }}>Submit a data subject request</strong>
                  <select value={requestType} onChange={e => setRequestType(e.target.value)} style={{ padding: 10, borderRadius: 8 }}>
                    <option value="ACCESS">Access</option>
                    <option value="CORRECTION">Correction</option>
                    <option value="ERASURE">Erasure</option>
                    <option value="PORTABILITY">Portability</option>
                    <option value="CONSENT_WITHDRAWAL">Withdraw consent</option>
                  </select>
                  <input required type="email" value={subjectEmail} onChange={e => setSubjectEmail(e.target.value)} placeholder="Your account email" style={{ padding: 10, borderRadius: 8, border: `1px solid ${border}` }} />
                  <textarea value={requestDetails} onChange={e => setRequestDetails(e.target.value)} placeholder="Optional request details" rows={3} style={{ padding: 10, borderRadius: 8, border: `1px solid ${border}` }} />
                  <button type="submit" style={{ padding: "10px 14px", borderRadius: 8, border: 0, background: "#0891b2", color: "white", fontWeight: 700, cursor: "pointer" }}>Submit request</button>
                  {requestStatus && <span style={{ fontSize: 12, color: muted }}>{requestStatus}</span>}
                </form>
              </section>

              <section id="section-3">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  3. Purpose Bound Processing Specifications
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  We process the collected telemetry strictly for bounded purposes:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                  <div style={{ padding: 16, borderRadius: 12, background: boxBg, border: `1px solid ${border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#06b6d4", marginBottom: 4 }}>OPERATIONAL DELIVERY</div>
                    <p style={{ fontSize: 12, color: muted, margin: 0, lineHeight: 1.6 }}>Populating real-time infrastructure topology, issuing priority alert dispatches, and managing helpdesk service requests.</p>
                  </div>
                  <div style={{ padding: 16, borderRadius: 12, background: boxBg, border: `1px solid ${border}` }}>
                    <div className="font-mono-label" style={{ fontSize: 11, color: "#0e7490", marginBottom: 4 }}>Vulnerability mitigation</div>
                    <p style={{ fontSize: 12, color: muted, margin: 0, lineHeight: 1.6 }}>Correlating operating systems and daemon variations against globally verified Common Vulnerabilities and Exposures (CVE) repositories.</p>
                  </div>
                </div>
                <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 12, background: L ? "rgba(6,182,212,0.05)" : "rgba(6,182,212,0.03)", border: "1px solid rgba(6,182,212,0.12)", display: "flex", gap: 12, alignItems: "start" }}>
                  <CheckCircle2 size={16} style={{ color: "#06b6d4", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 13, color: pTxt, lineHeight: 1.6 }}>
                    <strong style={{ color: txt }}>Zero External Monetization Commitments:</strong> We strictly declare that your data is never sold, leased, shared, or compiled for targeted consumer profiling or external advertising under any circumstances.
                  </p>
                </div>
              </section>

              <section id="section-4">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                  4. Data Storage & SOC 2 Security Protocols
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  We mandate state-of-the-art technical protections across our infrastructure to preserve the integrity of your telemetry data. QS Assets operates under SOC 2 security controls — see the{" "}
                  <a href="/security" style={{ color: "#06b6d4", fontWeight: 600 }}>Security Trust Center</a>
                  {" "}and{" "}
                  <a href="/dpa" style={{ color: "#06b6d4", fontWeight: 600 }}>Data Processing Addendum</a>
                  {" "}for processing and subprocessor details:
                </p>
                <ul style={{ margin: "14px 0 0", paddingLeft: 20, color: pTxt, fontSize: 14, lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <li>
                    <strong style={{ color: txt }}>Encryption-in-Transit:</strong> All interface interaction, API transport, and remote agent telemetry are encapsulated within TLS 1.3 packets with mandatory HSTS (HTTP Strict Transport Security) active.
                  </li>
                  <li>
                    <strong style={{ color: txt }}>Encryption-at-Rest:</strong> Physical storage uses AES-256 block-level disk encryption. Highly sensitive variables (like ticketing credentials or network community keys) are individually salted and encrypted within PostgreSQL columns.
                  </li>
                  <li>
                    <strong style={{ color: txt }}>Multi-Tenant Isolation:</strong> Virtual environments are segmented using foreign-key organization schemas. Direct cross-tenant data requests are programmatically intercepted and neutralized at the middleware layer.
                  </li>
                  <li>
                    <strong style={{ color: txt }}>Tamper-Proof Audit Logging:</strong> System audit logs utilize sequential cryptographically-linked SHA-256 hash chains. Any unauthorized alteration instantly invalidates the subsequent validation checks, alerting security command centers immediately.
                  </li>
                </ul>
              </section>

              <section id="section-5">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  5. Data Retention Limits & Disposal
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  To guarantee compliance with data minimization directives, telemetry is automatically pruned based on strict lifecycle boundaries:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 16 }}>
                  <div style={{ padding: "16px 20px", borderRadius: 12, background: boxBg, border: `1px solid ${border}`, textAlign: "center" }}>
                    <div className="font-serif" style={{ fontSize: 24, fontWeight: 400, color: "#06b6d4" }}>90 Days</div>
                    <div style={{ fontSize: 11, color: muted, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>Agent Telemetry</div>
                  </div>
                  <div style={{ padding: "16px 20px", borderRadius: 12, background: boxBg, border: `1px solid ${border}`, textAlign: "center" }}>
                    <div className="font-serif" style={{ fontSize: 24, fontWeight: 400, color: "#0e7490" }}>180 Days</div>
                    <div style={{ fontSize: 11, color: muted, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>Discovery Scans</div>
                  </div>
                  <div style={{ padding: "16px 20px", borderRadius: 12, background: boxBg, border: `1px solid ${border}`, textAlign: "center" }}>
                    <div className="font-serif" style={{ fontSize: 24, fontWeight: 400, color: "#0e7490" }}>365 Days</div>
                    <div style={{ fontSize: 11, color: muted, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>Audit Event Logs</div>
                  </div>
                </div>
                <p style={{ marginTop: 16, marginBottom: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  Following user account termination, user parameters are flagged for deletion. Complete zero-residual sanitization across database engines is completed automatically within <strong>30 days</strong>.
                </p>
              </section>

              <section id="section-6">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                  6. User Rights & Consent Management (DPDP Act 2023)
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  In accordance with the India DPDP Act 2023, you retain absolute authority over your digital personal data. You are entitled to exercise these rights at any time:
                </p>
                <ul style={{ margin: "14px 0 0", paddingLeft: 20, color: pTxt, fontSize: 14, lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <li>
                    <strong style={{ color: txt }}>Right to Access & Summary:</strong> Request a comprehensive, structured output of all personal datasets and logs related to your identity held by NeurQ AI Labs.
                  </li>
                  <li>
                    <strong style={{ color: txt }}>Right to Correction & Erasure:</strong> Rectify inaccurate, obsolete, or incomplete coordinates immediately. You may request physical erasure of all records if they are no longer required for lawful, bounded purposes.
                  </li>
                  <li>
                    <strong style={{ color: txt }}>Right to Consent Withdrawal:</strong> Revoke authorization for future data processing at your convenience. Note that withdrawing authentication permissions may limit our ability to deliver platform functionalities.
                  </li>
                  <li>
                    <strong style={{ color: txt }}>Right to Data Portability:</strong> Export all system parameters in a standard, machine-readable JSON structure for transfer to other monitoring services.
                  </li>
                </ul>
              </section>

              <section id="section-7">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  7. First-Party Storage Mechanisms
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  We enforce a strict <strong>Zero Third-Party Cookie Policy</strong>. No advertising pixels, tracking tags, or external behavioral marketing blocks are integrated into our pages. 
                </p>
                <p style={{ marginTop: 12, marginBottom: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  We utilize first-party browser <code style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", padding: "1px 6px", borderRadius: 4, color: codeColor }}>localStorage</code> parameters to support essential platform controls: active JWT session storage, visual layout theme configuration, and cookie banner consent values. Please refer to our complete <a href="/cookies" style={{ color: "#06b6d4", textDecoration: "none", fontWeight: 600 }}>Cookie Policy</a> for detailed schemas.
                </p>
              </section>

              <section id="section-8">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                  8. Grievance Redressal & Contact Coordinates
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  For inquiries concerning privacy regulations, data access requests, or to register a formal concern, you may contact our appointed Data Protection Officer directly:
                </p>
                <div style={{ marginTop: 20, padding: 24, borderRadius: 16, background: L ? "rgba(255, 255, 255, 0.4)" : "rgba(255,255,255,0.01)", border: `1px solid ${border}` }}>
                  <div style={{ fontWeight: 800, color: txt, fontSize: 15, marginBottom: 4 }}>Grievance Redressal Cell</div>
                  <div style={{ color: muted, fontSize: 13, marginBottom: 10 }}>NeurQ AI Labs Private Limited</div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: pTxt }}>
                    <div>📍 <span style={{ color: muted }}>Address:</span> C-403 Royal Estate Apartment, 7 Laplace Hazratganj, Lucknow - 226001, India</div>
                    <div>✉️ <span style={{ color: muted }}>Direct Desk:</span> privacy@neurqai.com</div>
                    <div>📞 <span style={{ color: muted }}>Emergency Line:</span> +91 7752981110</div>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>
      </div>

      <style jsx global>{`
        .legal-container {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 40px;
          align-items: start;
        }
        .legal-toc {
          position: sticky;
          top: 100px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-radius: 16px;
          padding: 20px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .legal-toc-item {
          display: block;
          width: 100%;
          text-align: left;
          background: none;
          border: 1px solid transparent;
          padding: 10px 14px;
          border-radius: 8px;
          color: ${muted};
          font-size: 13px;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .legal-toc-item:hover {
          color: ${txt};
          background: ${L ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)"};
        }
        .legal-toc-item.active {
          color: ${txt};
          background: ${L ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.08)"};
          border-color: ${border};
          font-weight: 500;
        }
        @media (max-width: 900px) {
          .legal-container {
            grid-template-columns: 1fr;
            gap: 32px;
          }
          .legal-toc {
            position: relative;
            top: 0;
            padding: 14px;
          }
        }
      `}</style>
      <Footer theme={theme} />
    </div>
  );
}
