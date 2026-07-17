import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Free Account",
  description:
    "Sign up for QS Assets free. Track up to 5 IT assets, run network scans, and manage your IT operations — no credit card required.",
  openGraph: {
    title: "Create Free Account | QS Assets",
    description: "Start managing your IT assets in minutes. Free plan includes 5 assets, 4 users, and basic reporting.",
  },
  alternates: { canonical: "https://www.qsasset.com/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
