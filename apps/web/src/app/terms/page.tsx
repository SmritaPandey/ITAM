"use client";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Terms of Service</h1>
        <p style={{ fontSize: 13, color: muted, marginBottom: 32 }}>Last updated: May 13, 2026 • Effective: May 13, 2026</p>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "28px 32px", lineHeight: 1.8, fontSize: 14, color: "#cbd5e1" }}>
          <Section title="1. Acceptance">
            By accessing QS Asset Management, you agree to these Terms of Service. If you are using QS Asset Management on behalf of an organization, you represent that you have authority to bind that organization.
          </Section>
          <Section title="2. Service Description">
            QS Asset Management is an enterprise IT asset management, network monitoring, and security platform. It provides asset tracking, ITSM ticketing, vulnerability scanning, SNMP monitoring, CCTV management, fleet GPS, VDI management, and compliance reporting.
          </Section>
          <Section title="3. Plans & Billing">
            <b>Starter (Free):</b> Up to 100 assets, 5 users. <b>Professional:</b> Unlimited assets, all modules, priority support. <b>Enterprise:</b> Custom pricing, on-premise option, dedicated support. Paid plans are billed monthly or annually. You may cancel at any time; access continues until the end of the billing period.
          </Section>
          <Section title="4. Acceptable Use">
            You agree NOT to: (a) Use QS Asset Management to scan networks you do not own or have authorization to scan, (b) Attempt to bypass tenant isolation or access other tenants' data, (c) Use the platform for illegal surveillance or unauthorized monitoring, (d) Reverse-engineer the platform, (e) Exceed your plan limits through automation.
          </Section>
          <Section title="5. Data Ownership">
            You retain full ownership of all data you upload or generate in QS Asset Management. We do not claim any intellectual property rights over your data. You may export or delete your data at any time.
          </Section>
          <Section title="6. Security">
            We implement industry-standard security measures including encrypted storage, JWT authentication, bcrypt password hashing, RBAC, and SHA-256 audit chains. However, no system is 100% secure, and you are responsible for safeguarding your credentials.
          </Section>
          <Section title="7. SLA">
            Professional and Enterprise plans include a 99.9% uptime SLA. Downtime due to scheduled maintenance (announced 48h in advance) is excluded. Credit requests must be submitted within 30 days.
          </Section>
          <Section title="8. Limitation of Liability">
            To the maximum extent permitted by law, NeurQ AI Labs' total liability is limited to the amount paid by you in the 12 months preceding the claim. We are not liable for indirect, incidental, or consequential damages.
          </Section>
          <Section title="9. Termination">
            Either party may terminate at any time. Upon termination, your data will be available for export for 30 days, after which it will be permanently deleted.
          </Section>
          <Section title="10. Governing Law">
            These terms are governed by the laws of India. Disputes shall be resolved in the courts of Lucknow, Uttar Pradesh.
          </Section>
          <Section title="11. Contact">
            NeurQ AI Labs Pvt Ltd, IIIT Lucknow, Uttar Pradesh, India. Email: legal@neurqai.com
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
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}
