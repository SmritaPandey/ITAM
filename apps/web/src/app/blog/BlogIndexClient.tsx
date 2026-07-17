"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";
import { BLOG_POSTS } from "@/lib/content/blog-posts";

/** Client shell wrapper so blog index matches PublicShell theming. */
export default function BlogIndexClient() {
  const t = usePublicTheme();
  return (
    <PublicShell maxWidth={800}>
      <MonoEyebrow muted={t.muted} light={t.L}>
        Blog
      </MonoEyebrow>
      <h1 className="font-serif" style={{ fontSize: "clamp(36px, 5vw, 48px)", lineHeight: 0.95, marginBottom: 12 }}>
        Notes from the <em style={{ fontStyle: "italic" }}>estate</em>
      </h1>
      <p style={{ fontSize: 16, color: t.muted, marginBottom: 36, lineHeight: 1.6, fontWeight: 300 }}>
        Discovery, ITSM, and compliance writing for QS Assets teams.{" "}
        <Link href="/changelog" style={{ color: "#0891b2", fontWeight: 600 }}>
          Changelog →
        </Link>
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {BLOG_POSTS.map((post) => (
          <li
            key={post.slug}
            style={{
              padding: "22px 0",
              borderBottom: `1px solid ${t.border}`,
            }}
          >
            <Link href={`/blog/${post.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ fontSize: 12, color: t.muted, marginBottom: 8 }}>
                {post.date} · {post.tags.join(" · ")}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em", color: t.txt }}>
                {post.title}
              </h2>
              <p style={{ fontSize: 15, color: t.muted, margin: 0, lineHeight: 1.6, fontWeight: 300 }}>{post.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </PublicShell>
  );
}
