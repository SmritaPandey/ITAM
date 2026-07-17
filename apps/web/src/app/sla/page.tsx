"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";

export default function SlaPage() {
  const t = usePublicTheme();

  return (
    <PublicShell maxWidth={800}>
      <MonoEyebrow muted={t.muted} light={t.L}>
        Legal · SLA
      </MonoEyebrow>
      <h1 className="font-serif" style={{ fontSize: "clamp(32px, 4vw, 44px)", lineHeight: 0.95, marginBottom: 12 }}>
        Service Level Agreement
      </h1>
      <p style={{ fontSize: 14, color: t.muted, marginBottom: 28, fontWeight: 300, lineHeight: 1.6 }}>
        Canonical uptime and credit terms for QS Assets Professional and Enterprise. Also summarized in{" "}
        <Link href="/terms#section-7" style={{ color: "#0891b2" }}>
          Terms §7
        </Link>
        .
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>1. Availability commitment</h2>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: t.pTxt, fontWeight: 300 }}>
          For Professional and Enterprise subscriptions on the managed SaaS offering, NeurQ AI Labs targets{" "}
          <strong style={{ color: t.txt }}>99.9% monthly uptime</strong> for the core web application and API
          (excluding customer-managed agents, customer networks, and third-party IdPs).
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>2. Service credits</h2>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: t.pTxt, fontWeight: 300, marginBottom: 12 }}>
          If monthly availability falls below 99.9%, you may request service credits applied to a subsequent billing cycle:
        </p>
        <ul style={{ fontSize: 14, lineHeight: 1.8, color: t.pTxt, fontWeight: 300, paddingLeft: 20 }}>
          <li>
            <strong style={{ color: t.txt }}>99.0% – 99.9%</strong> — 10% of monthly subscription fee
          </li>
          <li>
            <strong style={{ color: t.txt }}>95.0% – 99.0%</strong> — 25% of monthly subscription fee
          </li>
          <li>
            <strong style={{ color: t.txt }}>Below 95.0%</strong> — 50% of monthly subscription fee
          </li>
        </ul>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: t.pTxt, fontWeight: 300, marginTop: 12 }}>
          Credits must be requested in writing to{" "}
          <a href="mailto:contact@qsasset.com" style={{ color: "#0891b2" }}>
            contact@qsasset.com
          </a>{" "}
          within 30 days of the affected month. Credits are the sole remedy for SLA shortfalls unless otherwise agreed in an enterprise order form.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>3. Exclusions</h2>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: t.pTxt, fontWeight: 300 }}>
          Scheduled maintenance announced at least <strong style={{ color: t.txt }}>48 hours</strong> in advance,
          force majeure, upstream cloud/network failures outside our reasonable control, customer misconfiguration,
          agent or on-premise outages, and Free/Starter plan usage are excluded from the 99.9% calculation.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>4. Support response targets</h2>
        <ul style={{ fontSize: 14, lineHeight: 1.8, color: t.pTxt, fontWeight: 300, paddingLeft: 20 }}>
          <li>
            <strong style={{ color: t.txt }}>Professional</strong> — Priority support during business hours (IST)
          </li>
          <li>
            <strong style={{ color: t.txt }}>Enterprise / Custom</strong> — Dedicated support channel and custom SLA
            as defined in the order form
          </li>
        </ul>
      </section>

      <section
        style={{
          padding: 20,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          background: t.boxBg,
          fontSize: 13,
          color: t.muted,
          lineHeight: 1.6,
        }}
      >
        Live operational view:{" "}
        <Link href="/status" style={{ color: "#0891b2", fontWeight: 600 }}>
          Status page
        </Link>
        {" · "}
        <Link href="/pricing" style={{ color: "#0891b2", fontWeight: 600 }}>
          Pricing
        </Link>
      </section>
    </PublicShell>
  );
}
