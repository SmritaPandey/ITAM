import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description: "QS Asset Management documentation hub. Quick start guides, deployment options, agent setup, module documentation, and REST API reference.",
  openGraph: {
    title: "Documentation | QS Asset Management",
    description: "Everything you need to deploy, configure, and operate QS Asset Management.",
  },
  alternates: { canonical: "https://qsasset.com/docs" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
