import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CUSTOMER_STORIES, getStory } from "@/lib/content/customer-stories";
import CustomerStoryClient from "./CustomerStoryClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return CUSTOMER_STORIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = getStory(slug);
  if (!story) return { title: "Customer story" };
  return {
    title: story.headline,
    description: story.summary,
    openGraph: { title: `${story.headline} | QS Assets`, description: story.summary },
    alternates: { canonical: `https://www.qsasset.com/customers/${story.slug}` },
  };
}

export default async function CustomerStoryPage({ params }: Props) {
  const { slug } = await params;
  if (!getStory(slug)) notFound();
  return <CustomerStoryClient slug={slug} />;
}
