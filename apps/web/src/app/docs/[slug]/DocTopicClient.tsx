"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";
import { getDocTopic } from "@/lib/content/docs-topics";
import { notFound } from "next/navigation";

export default function DocTopicClient({ slug }: { slug: string }) {
  const t = usePublicTheme();
  const topic = getDocTopic(slug);
  if (!topic) notFound();

  return (
    <PublicShell maxWidth={760}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <Link href="/docs" style={{ fontSize: 13, color: "#0891b2", textDecoration: "none", fontWeight: 600 }}>
          ← Docs hub
        </Link>
        <span style={{ color: t.muted }}>·</span>
        <Link
          href={`/docs#${topic.hubAnchor}`}
          style={{ fontSize: 13, color: "#0891b2", textDecoration: "none", fontWeight: 600 }}
        >
          Open interactive article
        </Link>
      </div>
      <MonoEyebrow muted={t.muted} light={t.L}>
        {topic.category}
      </MonoEyebrow>
      <h1 className="font-serif" style={{ fontSize: "clamp(32px, 4vw, 42px)", lineHeight: 1.05, marginBottom: 16 }}>
        {topic.title}
      </h1>
      <p style={{ fontSize: 16, color: t.muted, marginBottom: 24, fontWeight: 300, lineHeight: 1.6 }}>{topic.description}</p>
      {topic.body.map((para) => (
        <p key={para.slice(0, 40)} style={{ fontSize: 16, lineHeight: 1.75, color: t.pTxt, marginBottom: 16, fontWeight: 300 }}>
          {para}
        </p>
      ))}
      <div
        style={{
          marginTop: 28,
          padding: 18,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          background: t.boxBg,
          fontSize: 14,
          color: t.muted,
        }}
      >
        Need the full runnable examples?{" "}
        <Link href={`/docs#${topic.hubAnchor}`} style={{ color: "#0891b2", fontWeight: 600 }}>
          Open the docs hub
        </Link>{" "}
        or{" "}
        <Link href="/contact" style={{ color: "#0891b2", fontWeight: 600 }}>
          ask support
        </Link>
        .
      </div>
    </PublicShell>
  );
}
