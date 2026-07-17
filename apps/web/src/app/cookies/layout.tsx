import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How QS Assets uses essential and optional cookies. First-party analytics only — no Google Analytics, GTM, or ad pixels.",
  openGraph: {
    title: "Cookie Policy | QS Assets",
    description: "Cookie and consent practices for the QS Assets platform.",
  },
  alternates: { canonical: "https://www.qsasset.com/cookies" },
};

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
