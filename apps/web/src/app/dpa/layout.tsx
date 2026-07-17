import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Addendum",
  description:
    "QS Assets Data Processing Addendum (DPA) — controller/processor roles, security measures, subprocessors, and breach notice for B2B customers.",
  openGraph: {
    title: "Data Processing Addendum | QS Assets",
    description: "B2B DPA for QS Assets covering processing scope, security, and subprocessors.",
  },
  alternates: { canonical: "https://www.qsasset.com/dpa" },
};

export default function DpaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
