"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";
import { NewsletterForm } from "@/components/landing/NewsletterForm";

export default function AboutPage() {
  const t = usePublicTheme();

  return (
    <PublicShell maxWidth={800}>
      <MonoEyebrow muted={t.muted} light={t.L}>
        Company
      </MonoEyebrow>
      <h1 className="font-serif" style={{ fontSize: "clamp(36px, 5vw, 48px)", lineHeight: 0.95, marginBottom: 16 }}>
        Built for the whole <em style={{ fontStyle: "italic" }}>estate</em>
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.65, color: t.muted, fontWeight: 300, marginBottom: 28 }}>
        QS Assets is a product of <strong style={{ color: t.txt, fontWeight: 600 }}>NeurQ AI Labs Private Limited</strong> —
        based in Lucknow, India — helping IT and operations teams discover, track, and operate IT and non-IT assets from one platform.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Mission</h2>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: t.pTxt, fontWeight: 300, margin: 0 }}>
          Replace fragmented discovery, CMDB, monitoring, and service-desk stacks with a living inventory that stays accurate —
          whether you run SaaS or self-host. Trusted by 200+ teams managing 50K+ assets.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>What we ship</h2>
        <ul style={{ fontSize: 15, lineHeight: 1.8, color: t.pTxt, fontWeight: 300, paddingLeft: 20, margin: 0 }}>
          <li>Agent + agentless discovery across endpoints, network, and OT-adjacent gear</li>
          <li>ITAM / EAM lifecycle, CMDB relationships, and procurement visibility</li>
          <li>ITSM with SLAs, plus monitoring, patch, and vulnerability workflows</li>
          <li>Security posture with SOC 2 controls, MFA/SSO, and DPDP-oriented practices</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Headquarters</h2>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: t.pTxt, fontWeight: 300, margin: 0 }}>
          C-403 Royal Estate Apartment, 7 Laplace Hazratganj, Lucknow 226001, UP, India
          <br />
          <a href="mailto:contact@qsasset.com" style={{ color: "#0891b2" }}>
            contact@qsasset.com
          </a>
          {" · "}
          <Link href="/contact" style={{ color: "#0891b2" }}>
            Contact form
          </Link>
          {" · "}
          <Link href="/security" style={{ color: "#0891b2" }}>
            Security
          </Link>
          {" · "}
          <Link href="/customers" style={{ color: "#0891b2" }}>
            Customer stories
          </Link>
        </p>
      </section>

      <section
        style={{
          padding: 24,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          background: t.boxBg,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Product updates</h2>
        <p style={{ fontSize: 13, color: t.muted, marginBottom: 14 }}>
          Occasional release notes and operational tips — not marketing spam.
        </p>
        <NewsletterForm
          muted={t.muted}
          txt={t.txt}
          border={t.border}
          L={t.L}
          voidBtn={t.voidBtn}
          voidTxt={t.voidTxt}
        />
      </section>
    </PublicShell>
  );
}
