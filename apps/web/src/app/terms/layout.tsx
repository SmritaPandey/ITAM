import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "QS Assets terms of service. Plans, billing, acceptable use, data ownership, SLA guarantees, and liability limitations.",
  openGraph: {
    title: "Terms of Service | QS Assets",
    description: "Legal terms governing the use of the QS Assets platform and services.",
  },
  alternates: { canonical: "https://www.qsasset.com/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
