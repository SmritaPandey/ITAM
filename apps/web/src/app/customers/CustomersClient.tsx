"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";
import { CUSTOMER_STORIES } from "@/lib/content/customer-stories";
import { TrustStrip } from "@/components/landing/TrustStrip";

export default function CustomersClient() {
  const t = usePublicTheme();
  return (
    <PublicShell maxWidth={960}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <MonoEyebrow muted={t.muted} light={t.L}>
          Customers
        </MonoEyebrow>
        <h1 className="font-serif" style={{ fontSize: "clamp(36px, 5vw, 48px)", lineHeight: 0.95, marginBottom: 14 }}>
          Stories from the <em style={{ fontStyle: "italic" }}>field</em>
        </h1>
        <p style={{ fontSize: 16, color: t.muted, maxWidth: 560, margin: "0 auto 28px", fontWeight: 300, lineHeight: 1.55 }}>
          Outcomes from teams running QS Assets across IT, facilities, and MSP estates. Named logos available on request —
          replace placeholders in marketing assets when approved.
        </p>
        <TrustStrip muted={t.muted} txt={t.txt} border={t.border} L={t.L} compact />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {CUSTOMER_STORIES.map((story) => (
          <Link
            key={story.slug}
            href={`/customers/${story.slug}`}
            style={{
              display: "block",
              padding: 24,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              background: t.card,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div className="font-mono-label" style={{ fontSize: 11, color: t.muted, marginBottom: 10 }}>
              {story.industry}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: t.txt }}>{story.headline}</h2>
            <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.6, margin: 0, fontWeight: 300 }}>{story.summary}</p>
            <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
              {story.metrics.map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0e7490" }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: t.muted }}>{m.label}</div>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>

      <p style={{ textAlign: "center", marginTop: 36, fontSize: 14, color: t.muted }}>
        Want a similar outcome?{" "}
        <Link href="/contact" style={{ color: "#0891b2", fontWeight: 600 }}>
          Book a demo
        </Link>
      </p>
    </PublicShell>
  );
}
