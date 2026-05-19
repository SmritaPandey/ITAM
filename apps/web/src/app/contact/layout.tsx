import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the QS Asset Management team. Request a demo, get enterprise pricing, or ask a technical question. We respond within 24 hours.",
  openGraph: {
    title: "Contact Us | QS Asset Management",
    description: "Request a demo, get pricing, or reach our support team.",
  },
  alternates: { canonical: "https://qsasset.com/contact" },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
