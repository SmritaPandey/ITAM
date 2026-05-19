"use client";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: muted, marginBottom: 32 }}>Last updated: May 13, 2026 • Effective: May 13, 2026</p>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "28px 32px", lineHeight: 1.8, fontSize: 14, color: "#cbd5e1" }}>
          <Section title="1. Introduction">
            NeurQ AI Labs Private Limited (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the QS Asset Management platform. This Privacy Policy describes how we collect, use, and protect your personal data in compliance with the Digital Personal Data Protection Act, 2023 (DPDP Act) of India and applicable international regulations.
          </Section>
          <Section title="2. Data We Collect">
            <b>Account Data:</b> Name, email, company name, and password (hashed with bcrypt). <b>Usage Data:</b> Login timestamps, IP addresses, feature usage metrics. <b>Device Data:</b> Network device information (IPs, MAC addresses, hostnames) discovered through scanning. <b>Agent Data:</b> System telemetry collected by the QS Asset Management Agent (CPU, RAM, disk, OS, installed software). All data is collected with your explicit consent and used solely for platform functionality.
          </Section>
          <Section title="3. How We Use Your Data">
            We process your data to: (a) Provide and maintain the QS Asset Management service, (b) Authenticate your identity, (c) Generate reports and analytics, (d) Send critical service notifications, (e) Improve platform performance. We do NOT sell, rent, or share your personal data with third parties for marketing purposes.
          </Section>
          <Section title="4. Data Storage & Security">
            All data is stored in encrypted PostgreSQL databases hosted on SOC 2 compliant infrastructure. Data in transit is protected with TLS 1.3. Passwords are hashed with bcrypt (cost factor 12). Audit logs use SHA-256 hash chains for tamper detection. Multi-tenant architecture ensures strict data isolation between organizations.
          </Section>
          <Section title="5. Data Retention">
            Device metrics history: 90 days. Audit logs: 365 days. Scan results: 180 days. Account data: retained while account is active, deleted within 30 days of account closure. You may request data export or deletion at any time.
          </Section>
          <Section title="6. Your Rights (DPDP Act 2023)">
            You have the right to: (a) Access your personal data, (b) Correct inaccurate data, (c) Request erasure of your data, (d) Data portability — export in standard formats, (e) Withdraw consent at any time, (f) Nominate a representative. To exercise these rights, contact privacy@neurqai.com.
          </Section>
          <Section title="7. Cookies">
            We use only essential cookies for authentication (JWT tokens stored in localStorage). We do not use tracking cookies, advertising cookies, or third-party analytics.
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
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}
