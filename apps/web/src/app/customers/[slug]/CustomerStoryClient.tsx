"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";
import { getStory } from "@/lib/content/customer-stories";
import { notFound } from "next/navigation";

export default function CustomerStoryClient({ slug }: { slug: string }) {
  const t = usePublicTheme();
  const story = getStory(slug);
  if (!story) notFound();

  return (
    <PublicShell maxWidth={760}>
      <Link href="/customers" style={{ fontSize: 13, color: "#0891b2", textDecoration: "none", fontWeight: 600 }}>
        ← Customer stories
      </Link>
      <MonoEyebrow muted={t.muted} light={t.L}>
        {story.industry} · {story.company}
      </MonoEyebrow>
      <h1 className="font-serif" style={{ fontSize: "clamp(32px, 4vw, 42px)", lineHeight: 1.05, marginBottom: 20 }}>
        {story.headline}
      </h1>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 28 }}>
        {story.metrics.map((m) => (
          <div
            key={m.label}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${t.border}`,
              background: t.boxBg,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0e7490" }}>{m.value}</div>
            <div style={{ fontSize: 11, color: t.muted }}>{m.label}</div>
          </div>
        ))}
      </div>
      {story.body.map((para) => (
        <p key={para.slice(0, 40)} style={{ fontSize: 16, lineHeight: 1.75, color: t.pTxt, marginBottom: 16, fontWeight: 300 }}>
          {para}
        </p>
      ))}
      <p style={{ marginTop: 28, fontSize: 14 }}>
        <Link href="/contact" style={{ color: "#0891b2", fontWeight: 600 }}>
          Talk to sales →
        </Link>
      </p>
    </PublicShell>
  );
}
