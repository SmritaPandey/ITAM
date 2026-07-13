"use client";
import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";

export default function NotFoundPage() {
  const t = usePublicTheme();

  return (
    <PublicShell maxWidth={640} contentStyle={{ textAlign: "center", paddingTop: 160, paddingBottom: 100 }}>
      <MonoEyebrow muted={t.muted} light={t.L}>Error</MonoEyebrow>
      <div className="font-serif" style={{ fontSize: "clamp(72px, 12vw, 120px)", fontWeight: 400, lineHeight: 0.9, letterSpacing: "-0.04em", marginBottom: 20, color: t.txt }}>
        404
      </div>
      <h1 className="font-serif" style={{ fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 400, marginBottom: 14, letterSpacing: "-0.02em" }}>
        Page not <em style={{ fontStyle: "italic" }}>found</em>
      </h1>
      <p style={{ fontSize: 16, color: t.muted, lineHeight: 1.55, marginBottom: 36, maxWidth: 420, margin: "0 auto 36px", fontWeight: 300 }}>
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href="/"
          style={{
            padding: "12px 22px",
            borderRadius: 8,
            border: "none",
            background: t.voidBtn,
            color: t.voidTxt,
            fontSize: 15,
            fontWeight: 400,
            textDecoration: "none",
          }}
        >
          Back to home
        </Link>
        <Link
          href="/contact"
          style={{
            padding: "12px 22px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: "transparent",
            color: t.txt,
            fontSize: 15,
            fontWeight: 400,
            textDecoration: "none",
          }}
        >
          Contact support
        </Link>
      </div>
    </PublicShell>
  );
}
