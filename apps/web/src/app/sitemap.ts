import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/content/blog-posts";
import { CUSTOMER_STORIES } from "@/lib/content/customer-stories";
import { DOC_TOPICS } from "@/lib/content/docs-topics";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.qsasset.com";
  const now = new Date();

  const core: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/security`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${baseUrl}/customers`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${baseUrl}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    { url: `${baseUrl}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/status`, lastModified: now, changeFrequency: "daily", priority: 0.55 },
    { url: `${baseUrl}/sla`, lastModified: now, changeFrequency: "yearly", priority: 0.45 },
    { url: `${baseUrl}/dpa`, lastModified: now, changeFrequency: "yearly", priority: 0.45 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const blogs = BLOG_POSTS.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const stories = CUSTOMER_STORIES.map((s) => ({
    url: `${baseUrl}/customers/${s.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.55,
  }));

  const docs = DOC_TOPICS.map((d) => ({
    url: `${baseUrl}/docs/${d.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  return [...core, ...blogs, ...stories, ...docs];
}
