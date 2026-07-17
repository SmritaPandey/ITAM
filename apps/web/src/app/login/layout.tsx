import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Log in to your QS Assets workspace. Access your IT assets, network monitoring, vulnerability scans, and ITSM service desk.",
  openGraph: {
    title: "Sign In | QS Assets",
    description: "Access your QS Assets workspace to manage assets, run scans, and track tickets.",
  },
  alternates: { canonical: "https://www.qsasset.com/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
