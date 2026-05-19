import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "QS Asset Management privacy policy. Learn how NeurQ AI Labs collects, uses, and protects your personal data in compliance with the DPDP Act 2023.",
  openGraph: {
    title: "Privacy Policy | QS Asset Management",
    description: "DPDP Act 2023 compliant privacy policy for the QS Asset Management platform.",
  },
  alternates: { canonical: "https://qsasset.com/privacy" },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
