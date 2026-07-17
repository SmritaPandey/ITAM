import type { Metadata } from "next";
import BlogIndexClient from "./BlogIndexClient";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "QS Assets blog — IT asset discovery, ITSM operations, and DPDP-ready security practices from NeurQ AI Labs.",
  openGraph: {
    title: "Blog | QS Assets",
    description: "Insights on discovery, ITAM, ITSM, and secure asset operations.",
  },
  alternates: { canonical: "https://www.qsasset.com/blog" },
};

export default function BlogPage() {
  return <BlogIndexClient />;
}
