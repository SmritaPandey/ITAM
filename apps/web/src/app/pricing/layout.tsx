import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "QS Assets pricing — free Starter (up to 5 assets), Professional, Enterprise, and custom plans. Start free, scale when ready.",
  openGraph: {
    title: "Pricing | QS Assets",
    description: "Transparent ITAM pricing. Free Starter plan, Professional and Enterprise tiers.",
  },
  alternates: { canonical: "https://www.qsasset.com/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
