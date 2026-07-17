import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Level Agreement",
  description:
    "QS Assets uptime SLA — 99.9% availability for Professional and Enterprise, service credits, and scheduled maintenance windows.",
  openGraph: {
    title: "Service Level Agreement | QS Assets",
    description: "99.9% uptime commitment and support expectations for paid QS Assets plans.",
  },
  alternates: { canonical: "https://www.qsasset.com/sla" },
};

export default function SlaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
