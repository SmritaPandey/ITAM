import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the QS Assets team. Request a demo, get enterprise pricing, or ask a technical question. We respond within 24 hours.",
  openGraph: {
    title: "Contact Us | QS Assets",
    description: "Request a demo, get pricing, or reach our support team.",
  },
  alternates: { canonical: "https://www.qsasset.com/contact" },
};

const contactLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact QS Assets",
  url: "https://www.qsasset.com/contact",
  mainEntity: {
    "@type": "Organization",
    name: "NeurQ AI Labs Private Limited",
    email: "contact@qsasset.com",
    telephone: "+91-7752981110",
    address: {
      "@type": "PostalAddress",
      streetAddress: "C-403 Royal Estate Apartment, 7 Laplace Hazratganj",
      addressLocality: "Lucknow",
      postalCode: "226001",
      addressRegion: "UP",
      addressCountry: "IN",
    },
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactLd) }} />
      {children}
    </>
  );
}
