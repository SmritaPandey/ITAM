import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Log in to your QS Asset Management workspace. Access your IT assets, network monitoring, vulnerability scans, and ITSM service desk.",
  openGraph: {
    title: "Sign In | QS Asset Management",
    description: "Access your QS Asset workspace to manage assets, run scans, and track tickets.",
  },
  alternates: { canonical: "https://qsasset.com/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
