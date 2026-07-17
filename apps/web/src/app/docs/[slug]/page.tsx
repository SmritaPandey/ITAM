import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOC_TOPICS, getDocTopic } from "@/lib/content/docs-topics";
import DocTopicClient from "./DocTopicClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return DOC_TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = getDocTopic(slug);
  if (!topic) return { title: "Docs" };
  return {
    title: topic.title,
    description: topic.description,
    openGraph: { title: `${topic.title} | QS Assets`, description: topic.description },
    alternates: { canonical: `https://www.qsasset.com/docs/${topic.slug}` },
  };
}

export default async function DocTopicPage({ params }: Props) {
  const { slug } = await params;
  const topic = getDocTopic(slug);
  if (!topic) notFound();

  const techArticleLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: topic.title,
    description: topic.description,
    url: `https://www.qsasset.com/docs/${topic.slug}`,
    author: { "@type": "Organization", name: "NeurQ AI Labs" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleLd) }} />
      <DocTopicClient slug={slug} />
    </>
  );
}
