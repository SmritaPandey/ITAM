import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "QS Assets documentation hub. Quick start guides, deployment options, agent setup, module documentation, and REST API reference.",
  openGraph: {
    title: "Documentation | QS Assets",
    description: "Everything you need to deploy, configure, and operate QS Assets.",
  },
  alternates: { canonical: "https://www.qsasset.com/docs" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
