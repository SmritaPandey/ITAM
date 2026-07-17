"use client";

import Link from "next/link";
import { Lock, Shield, KeyRound, Database, Eye, Server, FileText, CheckCircle2 } from "lucide-react";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";

const PILLARS = [
  {
    icon: Lock,
    title: "Encryption in transit & at rest",
    body: "TLS for agent and API traffic. Production databases and secrets use industry-standard encryption and key management practices.",
  },
  {
    icon: Database,
    title: "Tenant isolation",
    body: "Multi-tenant RBAC plus Postgres row-level security policies so one customer’s assets, tickets, and agents stay scoped to their tenant.",
  },
  {
    icon: KeyRound,
    title: "Identity & access",
    body: "MFA (TOTP), SSO options (SAML/OIDC), session controls, and least-privilege roles for admins, technicians, and portal users.",
  },
  {
    icon: Eye,
    title: "Audit & monitoring",
    body: "Activity trails for sensitive actions, alerting pipelines, and operational logging designed for investigation and compliance evidence.",
  },
  {
    icon: Server,
    title: "Deployment choice",
    body: "Run as managed SaaS or self-host with Docker and PostgreSQL on your infrastructure when data residency requires it.",
  },
  {
    icon: Shield,
    title: "SOC 2 security program",
    body: "QS Assets operates under SOC 2 security controls covering access, change management, and availability practices across the platform.",
  },
];

const SUBPROCESSORS = [
  { name: "Railway", role: "API & database hosting (SaaS)" },
  { name: "Vercel", role: "Web application hosting" },
  { name: "Email delivery provider", role: "Transactional mail (verification, alerts)" },
];

export default function SecurityPage() {
  const t = usePublicTheme();

  return (
    <PublicShell maxWidth={960}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <MonoEyebrow muted={t.muted} light={t.L}>
          Trust Center
        </MonoEyebrow>
        <h1
          className="font-serif"
          style={{ fontSize: "clamp(36px, 5vw, 52px)", fontWeight: 400, lineHeight: 0.95, letterSpacing: "-0.02em", marginBottom: 14 }}
        >
          Security you can <em style={{ fontStyle: "italic" }}>verify</em>
        </h1>
        <p style={{ fontSize: 16, fontWeight: 300, color: t.muted, maxWidth: 560, margin: "0 auto", lineHeight: 1.55 }}>
          Built for IT and security teams that need asset truth without compromising tenant boundaries or compliance posture.
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 28, gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trust/soc2-badge.svg" alt="SOC 2" width={88} height={88} />
          <div style={{ textAlign: "left", fontSize: 13, color: t.muted, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: t.txt, marginBottom: 4 }}>SOC 2 · DPDP Act 2023</div>
            Trusted by 200+ teams managing 50K+ assets.
            <div style={{ marginTop: 8 }}>
              <Link href="/dpa" style={{ color: "#0891b2", fontWeight: 600, textDecoration: "none", marginRight: 14 }}>
                Data Processing Addendum
              </Link>
              <Link href="/privacy" style={{ color: "#0891b2", fontWeight: 600, textDecoration: "none" }}>
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 48 }}>
        {PILLARS.map((p) => (
          <div
            key={p.title}
            style={{
              padding: 24,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              background: t.card,
            }}
          >
            <p.icon size={22} color="#0891b2" style={{ marginBottom: 12 }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.txt }}>{p.title}</h2>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: t.muted, margin: 0, fontWeight: 300 }}>{p.body}</p>
          </div>
        ))}
      </div>

      <section
        style={{
          padding: 28,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          background: t.boxBg,
          marginBottom: 28,
        }}
      >
        <h2 className="font-serif" style={{ fontSize: 28, marginBottom: 8 }}>
          Subprocessors
        </h2>
        <p style={{ fontSize: 14, color: t.muted, marginBottom: 18, fontWeight: 300 }}>
          Infrastructure partners that may process customer data for the managed SaaS offering. Self-hosted deployments keep data on your stack.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {SUBPROCESSORS.map((s) => (
            <li key={s.name} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
              <CheckCircle2 size={16} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
              <span>
                <strong style={{ color: t.txt }}>{s.name}</strong>
                <span style={{ color: t.muted }}> — {s.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        style={{
          padding: 28,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          background: t.card,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", maxWidth: 520 }}>
          <FileText size={22} color="#0891b2" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Report a vulnerability</h2>
            <p style={{ fontSize: 13, color: t.muted, margin: 0, lineHeight: 1.6, fontWeight: 300 }}>
              Responsible disclosure: email{" "}
              <a href="mailto:security@qsasset.com" style={{ color: "#0891b2" }}>
                security@qsasset.com
              </a>{" "}
              or see{" "}
              <a href="/.well-known/security.txt" style={{ color: "#0891b2" }}>
                security.txt
              </a>
              .
            </p>
          </div>
        </div>
        <Link
          href="/status"
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            color: t.txt,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Platform status →
        </Link>
      </section>
    </PublicShell>
  );
}
