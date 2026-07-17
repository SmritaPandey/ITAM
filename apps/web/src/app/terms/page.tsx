"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Scale, CheckCircle2, ShieldAlert, Award } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const SECTIONS = [
  { id: "section-1", title: "1. Agreement & Acceptance" },
  { id: "section-2", title: "2. Service Descriptions" },
  { id: "section-3", title: "3. Plans & Billing Cycles" },
  { id: "section-4", title: "4. Scanning Policies" },
  { id: "section-5", title: "5. Telemetry Ownership" },
  { id: "section-6", title: "6. Platform Integrity" },
  { id: "section-7", title: "7. Uptime SLA Commitments" },
  { id: "section-8", title: "8. Liability Limitations" },
  { id: "section-9", title: "9. Account Termination" },
  { id: "section-10", title: "10. Jurisdiction & Law" },
  { id: "section-11", title: "11. Legal Notifications" },
];

export default function TermsPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("section-1");

  const { theme, toggleTheme } = useTheme();
  const L = theme === "light";
  const bg = L ? "#f5f7f8" : "#070b10";
  const txt = L ? "#0f172a" : "#f5f5f7";
  const muted = L ? "#6b7280" : "#9f9fa0";
  const border = L ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)";
  const card = L ? "#ffffff" : "rgba(18, 21, 26, 0.92)";
  const pTxt = L ? "#334155" : "#cbd5e1";
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
            Legal · Platform terms
          </div>
          <h1 className="font-serif" style={{ fontSize: "clamp(36px, 5vw, 48px)", fontWeight: 400, marginBottom: 8, letterSpacing: "-0.02em", lineHeight: 0.95 }}>Terms of Service</h1>
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
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  1. Agreement & Acceptance of Terms
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  By accessing, establishing a tenant workspace, downloading monitoring agents, or interacting with the **QS Asset APM Platform**, you explicitly agree to compile and maintain compliance with these Terms of Service. If you act on behalf of a corporate entity, you declare and warrant that you hold legitimate administrative authority to bind said entity to these constraints.
                </p>
              </section>

              <section id="section-2">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  2. Service Descriptions & Delivery Scope
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  QS Asset is a comprehensive IT and non-IT active asset discovery, network monitoring, vulnerability scoring, and service desk management SaaS framework operated by NeurQ AI Labs Private Limited. The service scope encompasses:
                </p>
                <ul style={{ margin: "14px 0 0", paddingLeft: 20, color: pTxt, fontSize: 14, lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
                  <li>Active SNMP, Nmap, and ICMP system scanning discovery tools.</li>
                  <li>Host-based software and hardware telemetry gathering agent distributions.</li>
                  <li>Unified CCTV ONVIF stream state alerts and camera health audits.</li>
                  <li>GPS-enabled enterprise fleet and vehicle asset tracking maps.</li>
                  <li>Integrated ITSM ticketing with strict SLA response routing metrics.</li>
                </ul>
              </section>

              <section id="section-3">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  3. Subscription Plans, Billing & Cancellations
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  Our platform is provisioned across structured pricing tiers:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                  <div style={{ padding: 16, borderRadius: 12, background: boxBg, border: `1px solid ${border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#06b6d4", marginBottom: 4 }}>STARTER & FREE PLAN</div>
                    <p style={{ fontSize: 12, color: muted, margin: 0, lineHeight: 1.6 }}>Supports up to 5 discovered assets, 4 administrative user allocations, and standard priority community ticket boards. See <a href="/pricing" style={{ color: "#06b6d4" }}>pricing</a> for paid tiers.</p>
                  </div>
                  <div style={{ padding: 16, borderRadius: 12, background: boxBg, border: `1px solid ${border}` }}>
                    <div className="font-mono-label" style={{ fontSize: 11, color: "#0e7490", marginBottom: 4 }}>Professional & Enterprise</div>
                    <p style={{ fontSize: 12, color: muted, margin: 0, lineHeight: 1.6 }}>Unlimited assets, multi-node agent orchestration, customizable vulnerability rules, and direct engineers support SLAs.</p>
                  </div>
                </div>
                <p style={{ marginTop: 16, marginBottom: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  Paid contracts are calculated chronologically monthly or annually. You may submit termination directives at any time; access parameters persist unchanged until the resolution of the current active pre-paid billing block. No pro-rated refunds are issued.
                </p>
              </section>

              <section id="section-4">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                  4. Acceptable Scanning Policies & Mandatory Rules
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  Because the platform implements deep port, vulnerability, and SNMP scanning utilities, you must maintain absolute ethical boundaries:
                </p>
                <div style={{ marginTop: 16, padding: "16px 20px", borderRadius: 12, background: L ? "rgba(239, 68, 68, 0.05)" : "rgba(239, 68, 68, 0.03)", border: "1px solid rgba(239, 68, 68, 0.15)", display: "flex", gap: 12, alignItems: "start" }}>
                  <ShieldAlert size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 13, color: pTxt, lineHeight: 1.6 }}>
                    <strong style={{ color: L ? "#7f1d1d" : "#fca5a5" }}>Authorization Mandatory Constraint:</strong> You strictly declare, warrant, and commit that you will **ONLY** target and scan subnet allocations, physical machines, switches, or networks that you explicitly own, operate, or maintain written authorization to audit. Unauthorized network scanning constitutes a severe breach of this contract and local laws.
                  </div>
                </div>
                <p style={{ marginTop: 16, marginBottom: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  You shall not attempt to breach tenant isolation layers, trigger Distributed Denial of Service (DDoS) simulations on our endpoints, script excessive API queries bypassing system throttling boundaries, or reverse-engineer binary agent distributions.
                </p>
              </section>

              <section id="section-5">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  5. Customer Telemetry & Intellectual Property
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  You retain absolute ownership, rights, and intellectual claims over all database entities, device coordinates, ticketing text, and tracking parameters uploaded, generated, or cataloged within your tenant space. NeurQ AI Labs does not establish any proprietary claim over customer datasets. We claim all intellectual property, copyright, and patent frameworks relating to our code, agent binaries, custom layout systems, and visual styling tokens.
                </p>
              </section>

              <section id="section-6">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  6. Platform Integrity & Safety Boundaries
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  While our engineering teams deliver extremely hardened environments (employing strict row-level multitenant locks, continuous database replication, and zero-trust firewall configurations), you recognize that absolute security does not exist. You commit to safeguarding administrative passwords, enforcing multi-factor verification across your administrator teams, and immediately notifying us at `security@neurqai.com` if you discover any local key leaks.
                </p>
              </section>

              <section id="section-7">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                  7. 99.9% Uptime Service Level Agreement (SLA)
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  Professional and Enterprise tiers are governed by a strict <strong style={{ color: L ? "#0891b2" : "#06b6d4" }}>99.9% Uptime Commitment</strong>. The canonical SLA (credits, exclusions, and support targets) is published at{" "}
                  <a href="/sla" style={{ color: L ? "#0891b2" : "#06b6d4", fontWeight: 600 }}>qsasset.com/sla</a>. In the event that monthly cumulative availability drops below this baseline, you are eligible for service credits applied to subsequent billing cycles:
                </p>
                <ul style={{ margin: "14px 0 0", paddingLeft: 20, color: pTxt, fontSize: 14, lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <li><strong style={{ color: txt }}>Availability &ge; 99.0% and &lt; 99.9%:</strong> 10% monthly subscription credit value back.</li>
                  <li><strong style={{ color: txt }}>Availability &ge; 95.0% and &lt; 99.0%:</strong> 25% monthly subscription credit value back.</li>
                  <li><strong style={{ color: txt }}>Availability &lt; 95.0%:</strong> 50% monthly subscription credit value back.</li>
                </ul>
                <p style={{ marginTop: 12, marginBottom: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  This SLA excludes outages occurring due to scheduled platform maintenance announced at least <strong>48 hours</strong> in advance, or catastrophic upstream network failures.
                </p>
              </section>

              <section id="section-8">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  8. Direct Limitation of Liability Clauses
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  To the maximum extent permitted by applicable commercial regulations, the total cumulative liability of NeurQ AI Labs Private Limited for any direct legal claims, software anomalies, loss of operational telemetry, or downtime damages is strictly capped at the **total financial amount paid by you** in the twelve (12) months preceding the initiation of the legal claim. We are not liable for any indirect, consequential, or incidental operational losses.
                </p>
              </section>

              <section id="section-9">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  9. Account Termination & Data Disposal
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  You may close your workspace at any time. Upon termination, active data processing ceases immediately. We preserve your database records for a grace period of **30 days** to allow comprehensive export of tracking configurations and ticket logs. Upon resolution of this grace period, all records undergo permanent zero-residual physical destruction.
                </p>
              </section>

              <section id="section-10">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                  10. Governing Law & Judicial Jurisdiction
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  These terms, platform access coordinates, and all regulatory declarations are governed by and construed in strict alignment with the **laws of the Republic of India**. Any unresolved commercial disputes or legal controversies arising from these policies shall be subject to the exclusive jurisdiction of the competent courts located in **Lucknow, Uttar Pradesh, India**.
                </p>
              </section>

              <section id="section-11">
                <h2 style={{ fontSize: 20, fontWeight: 800, color: txt, marginBottom: 14, letterSpacing: "-0.02em" }}>
                  11. Contact & Legal Notifications
                </h2>
                <p style={{ margin: 0, color: pTxt, fontSize: 14, lineHeight: 1.8 }}>
                  For official contract notifications, legal processes, or to initiate a service credit verification claim under the SLA, please direct formal correspondence to our legal department:
                </p>
                <div style={{ marginTop: 20, padding: 24, borderRadius: 16, background: L ? "rgba(255, 255, 255, 0.4)" : "rgba(255,255,255,0.01)", border: `1px solid ${border}` }}>
                  <div style={{ fontWeight: 800, color: txt, fontSize: 15, marginBottom: 4 }}>Legal Affairs & Governance Desk</div>
                  <div style={{ color: muted, fontSize: 13, marginBottom: 12 }}>NeurQ AI Labs Private Limited</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: pTxt }}>
                    <div>✉️ <span style={{ color: muted }}>Email:</span> legal@neurqai.com</div>
                    <div>📍 <span style={{ color: muted }}>Registered Address:</span> C-403 Royal Estate Apartment, 7 Laplace Hazratganj, Lucknow - 226001, Uttar Pradesh, India</div>
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
