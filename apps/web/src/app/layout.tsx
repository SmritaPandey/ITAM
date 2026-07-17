import type { Metadata } from "next";
import { Outfit, DM_Sans, DM_Serif_Display, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/ClientProviders";
import { LANDING_FAQS, offerPriceINR } from "@/lib/pricing";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  title: {
    default: "QS Assets | IT Asset Discovery & Management",
    template: "%s | QS Assets",
  },
  description:
    "Discover, track, and manage IT and non-IT assets with agent and agentless scanning, monitoring, ITSM, and vulnerability workflows — built by NeurQ AI Labs.",
  keywords: [
    "IT asset management",
    "ITAM software",
    "asset tracking",
    "ITSM service desk",
    "vulnerability scanning",
    "network monitoring",
    "CMDB",
    "patch management",
    "enterprise asset management",
    "NeurQ AI Labs",
    "QS Assets",
    "qsasset",
  ],
  authors: [{ name: "NeurQ AI Labs", url: "https://www.qsasset.com" }],
  creator: "NeurQ AI Labs Private Limited",
  publisher: "NeurQ AI Labs",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  metadataBase: new URL("https://www.qsasset.com"),
  alternates: {
    canonical: "https://www.qsasset.com",
  },
  openGraph: {
    title: "QS Assets — IT Asset Discovery & Management",
    description:
      "Unified asset discovery and operations: inventory, monitoring, tickets, and security workflows in one platform.",
    siteName: "QS Assets",
    url: "https://www.qsasset.com",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QS Assets — Discovery and Control",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QS Assets — IT Asset Discovery & Management",
    description: "Discover and manage every asset. Start free, scale when ready.",
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
  ...(googleVerification
    ? { verification: { google: googleVerification } }
    : {}),
  category: "technology",
};

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "NeurQ AI Labs Private Limited",
  url: "https://www.qsasset.com",
  logo: "https://www.qsasset.com/logo.svg",
  email: "contact@qsasset.com",
  sameAs: [
    "https://www.linkedin.com/company/neurq-ai-labs",
    "https://x.com/neurqailabs",
    "https://github.com/neurq-ai-labs",
  ],
  address: {
    "@type": "PostalAddress",
    streetAddress: "C-403 Royal Estate Apartment, 7 Laplace Hazratganj",
    addressLocality: "Lucknow",
    postalCode: "226001",
    addressRegion: "UP",
    addressCountry: "IN",
  },
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "QS Assets",
  url: "https://www.qsasset.com",
  publisher: { "@type": "Organization", name: "NeurQ AI Labs Private Limited" },
  potentialAction: {
    "@type": "SearchAction",
    target: "https://www.qsasset.com/docs?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "QS Assets",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "IT asset discovery and management platform with monitoring, ITSM, and security workflows.",
  url: "https://www.qsasset.com",
  author: {
    "@type": "Organization",
    name: "NeurQ AI Labs Private Limited",
    url: "https://www.qsasset.com",
  },
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "0",
      priceCurrency: "INR",
      description: "Free plan — up to 5 assets, 4 users, basic reports",
    },
    {
      "@type": "Offer",
      name: "Professional",
      price: offerPriceINR("professional"),
      priceCurrency: "INR",
      description: "Core modules, unlimited assets, vulnerability scanning, ITSM",
    },
    {
      "@type": "Offer",
      name: "Enterprise",
      price: offerPriceINR("enterprise"),
      priceCurrency: "INR",
      description: "On-premise deploy, SSO options, dedicated support",
    },
  ],
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LANDING_FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable} ${dmSerif.variable} ${robotoMono.variable}`} suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var theme = saved || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
