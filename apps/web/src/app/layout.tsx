import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "QS Asset Management | Enterprise IT Asset & Security Platform",
    template: "%s | QS Asset Management",
  },
  description: "Unified IT & non-IT asset management platform with ITSM ticketing, vulnerability scanning, network monitoring, CCTV, fleet GPS, VDI, patch management, and CMDB. Trusted by enterprises for complete asset visibility and security control.",
  keywords: [
    "IT asset management",
    "ITAM software",
    "asset tracking",
    "ITSM service desk",
    "vulnerability scanning",
    "network monitoring",
    "CMDB",
    "patch management",
    "CCTV management",
    "fleet GPS tracking",
    "VDI management",
    "IT security platform",
    "enterprise asset management",
    "non-IT asset tracking",
    "SaaS ITAM",
    "India IT asset management",
    "DPDP compliant",
    "NeurQ AI Labs",
    "QS Asset",
    "qsasset",
  ],
  authors: [{ name: "NeurQ AI Labs", url: "https://qsasset.com" }],
  creator: "NeurQ AI Labs Private Limited",
  publisher: "NeurQ AI Labs",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  metadataBase: new URL("https://qsasset.com"),
  alternates: {
    canonical: "https://qsasset.com",
  },
  openGraph: {
    title: "QS Asset Management — Enterprise IT Asset & Security Platform",
    description: "Command every asset. Secure every endpoint. 12 unified modules for complete IT operations — from asset tracking to vulnerability scanning.",
    siteName: "QS Asset Management",
    url: "https://qsasset.com",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QS Asset Management Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QS Asset Management — Enterprise IT Asset & Security Platform",
    description: "12 unified modules for complete IT operations. Start free, scale to enterprise.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "google-site-verification-id-placeholder",
  },
  category: "technology",
};

// JSON-LD structured data for rich search results
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "QS Asset Management",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Unified IT & non-IT asset management platform with 12 integrated modules for complete enterprise visibility and control.",
  url: "https://qsasset.com",
  author: {
    "@type": "Organization",
    name: "NeurQ AI Labs Private Limited",
    url: "https://qsasset.com",
  },
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "0",
      priceCurrency: "INR",
      description: "Free plan — up to 5 assets and 4 users",
    },
    {
      "@type": "Offer",
      name: "Professional",
      price: "4999",
      priceCurrency: "INR",
      description: "Unlimited assets, all 12 modules, priority support",
    },
  ],
  featureList: [
    "IT Asset Management",
    "Non-IT Asset Tracking",
    "ITSM Service Desk",
    "Vulnerability Scanning",
    "Network Monitoring (NMS)",
    "Patch Management",
    "CCTV Surveillance",
    "Fleet GPS Tracking",
    "VDI Management",
    "CMDB & Dependencies",
    "Procurement & Contracts",
    "Reports & Compliance",
  ],
};

import { ClientProviders } from "@/components/ClientProviders";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
