import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "NeurQ AI Labs builds QS Assets — discovery, ITAM, ITSM, and security operations for teams that need one living inventory.",
  openGraph: {
    title: "About | QS Assets",
    description: "The company and mission behind QS Assets.",
  },
  alternates: { canonical: "https://www.qsasset.com/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
