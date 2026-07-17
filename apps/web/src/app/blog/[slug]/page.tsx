import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getPost } from "@/lib/content/blog-posts";
import BlogPostClient from "./BlogPostClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post" };
  return {
    title: post.title,
    description: post.description,
    openGraph: { title: `${post.title} | QS Assets`, description: post.description },
    alternates: { canonical: `https://www.qsasset.com/blog/${post.slug}` },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.date,
    author: { "@type": "Organization", name: post.author },
    description: post.description,
    url: `https://www.qsasset.com/blog/${post.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <BlogPostClient slug={slug} />
    </>
  );
}
