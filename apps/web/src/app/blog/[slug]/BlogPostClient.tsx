"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";
import { getPost } from "@/lib/content/blog-posts";
import { notFound } from "next/navigation";

export default function BlogPostClient({ slug }: { slug: string }) {
  const t = usePublicTheme();
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <PublicShell maxWidth={720}>
      <Link href="/blog" style={{ fontSize: 13, color: "#0891b2", textDecoration: "none", fontWeight: 600 }}>
        ← Blog
      </Link>
      <p style={{ fontSize: 12, color: t.muted, margin: "20px 0 12px" }}>
        {post.date} · {post.author}
      </p>
      <h1 className="font-serif" style={{ fontSize: "clamp(32px, 4vw, 42px)", lineHeight: 1.05, marginBottom: 20 }}>
        {post.title}
      </h1>
      {post.body.map((para) => (
        <p key={para.slice(0, 48)} style={{ fontSize: 16, lineHeight: 1.75, color: t.pTxt, marginBottom: 18, fontWeight: 300 }}>
          {para}
        </p>
      ))}
      <p style={{ marginTop: 28, fontSize: 14, color: t.muted }}>
        <Link href="/register" style={{ color: "#0891b2", fontWeight: 600 }}>
          Start free
        </Link>
        {" · "}
        <Link href="/contact" style={{ color: "#0891b2", fontWeight: 600 }}>
          Contact sales
        </Link>
      </p>
    </PublicShell>
  );
}
