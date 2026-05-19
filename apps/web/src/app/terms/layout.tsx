import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "QS Asset Management terms of service. Plans, billing, acceptable use, data ownership, SLA guarantees, and liability limitations.",
  openGraph: {
    title: "Terms of Service | QS Asset Management",
    description: "Legal terms governing the use of QS Asset Management platform and services.",
  },
  alternates: { canonical: "https://qsasset.com/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
