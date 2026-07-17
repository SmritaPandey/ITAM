"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";
import { CHANGELOG } from "@/lib/content/changelog";

export default function ChangelogClient() {
  const t = usePublicTheme();
  return (
    <PublicShell maxWidth={760}>
      <MonoEyebrow muted={t.muted} light={t.L}>
        Changelog
      </MonoEyebrow>
      <h1 className="font-serif" style={{ fontSize: "clamp(36px, 5vw, 48px)", lineHeight: 0.95, marginBottom: 12 }}>
        What we <em style={{ fontStyle: "italic" }}>shipped</em>
      </h1>
      <p style={{ fontSize: 16, color: t.muted, marginBottom: 36, fontWeight: 300 }}>
        Release highlights for the QS Assets platform.{" "}
        <Link href="/blog" style={{ color: "#0891b2", fontWeight: 600 }}>
          Blog →
        </Link>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {CHANGELOG.map((entry) => (
          <article
            key={entry.version}
            style={{
              padding: 24,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              background: t.card,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: t.txt }}>
                {entry.version} — {entry.title}
              </h2>
              <span style={{ fontSize: 12, color: t.muted }}>{entry.date}</span>
            </div>
            <ul style={{ margin: "12px 0 0", paddingLeft: 20, color: t.pTxt, fontSize: 14, lineHeight: 1.7, fontWeight: 300 }}>
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </PublicShell>
  );
}
