import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Status",
  description: "QS Assets platform status — current availability of web, API, and discovery services.",
  openGraph: {
    title: "System Status | QS Assets",
    description: "Live status for the QS Assets SaaS platform.",
  },
  alternates: { canonical: "https://www.qsasset.com/status" },
  robots: { index: true, follow: true },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
