import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security & Trust",
  description:
    "QS Assets security and trust center — SOC 2 controls, encryption, tenant isolation, MFA/SSO, DPDP, and subprocessors.",
  openGraph: {
    title: "Security & Trust | QS Assets",
    description: "How NeurQ AI Labs protects QS Assets customer data: SOC 2, encryption, RLS, MFA/SSO.",
  },
  alternates: { canonical: "https://www.qsasset.com/security" },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
