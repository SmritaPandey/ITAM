import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Free Account",
  description: "Sign up for QS Asset Management free. Track up to 100 IT assets, run network scans, and manage your IT operations — no credit card required.",
  openGraph: {
    title: "Create Free Account | QS Asset Management",
    description: "Start managing your IT assets in 2 minutes. Free plan includes 100 assets, 5 users, and basic reporting.",
  },
  alternates: { canonical: "https://qsasset.com/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
