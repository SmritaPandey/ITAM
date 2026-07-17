"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";
import { PricingGrid } from "@/components/landing/PricingGrid";

export default function PricingPage() {
  const t = usePublicTheme();

  return (
    <PublicShell maxWidth={1200}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <MonoEyebrow muted={t.muted} light={t.L}>
          Pricing · QS Assets
        </MonoEyebrow>
        <h1
          className="font-serif"
          style={{
            fontSize: "clamp(36px, 5vw, 52px)",
            fontWeight: 400,
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
            marginBottom: 14,
          }}
        >
          Plans that <em style={{ fontStyle: "italic" }}>scale</em> with you
        </h1>
        <p style={{ fontSize: 16, fontWeight: 300, color: t.muted, maxWidth: 540, margin: "0 auto 8px", lineHeight: 1.55 }}>
          Start free with up to 5 assets and 4 users. Upgrade for unlimited inventory, ITSM, vulnerability scanning, and on-prem.
        </p>
        <p style={{ fontSize: 13, color: t.muted, marginBottom: 32 }}>
          Need a custom contract?{" "}
          <Link href="/contact" style={{ color: "#0891b2", fontWeight: 600, textDecoration: "none" }}>
            Talk to sales
          </Link>
          {" · "}
          <Link href="/sla" style={{ color: "#0891b2", fontWeight: 600, textDecoration: "none" }}>
            View SLA
          </Link>
        </p>
      </div>

      <PricingGrid
        showHeader={false}
        theme={{
          L: t.L,
          cardBg: t.card,
          border: t.border,
          muted: t.muted,
          txt: t.txt,
          voidBtn: t.voidBtn,
          voidTxt: t.voidTxt,
        }}
      />
    </PublicShell>
  );
}
