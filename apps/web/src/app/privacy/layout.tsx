import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "QS Assets privacy policy. Learn how NeurQ AI Labs collects, uses, and protects your personal data in compliance with the DPDP Act 2023.",
  openGraph: {
    title: "Privacy Policy | QS Assets",
    description: "DPDP Act 2023 compliant privacy policy for the QS Assets platform.",
  },
  alternates: { canonical: "https://www.qsasset.com/privacy" },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
