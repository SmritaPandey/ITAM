import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReconAPM | Enterprise IT Asset & Security Management",
  description: "Unified IT & Non-IT Asset Monitoring, Network Management, Fleet GPS, CCTV, VDI, Vulnerability Scanning, Patch Management & ITSM Platform by NeurQ AI Labs",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  metadataBase: new URL("https://reconapm.com"),
  openGraph: {
    title: "ReconAPM — Enterprise IT Asset & Security Management",
    description: "Command every asset. Secure every endpoint. Built for enterprises that demand visibility and control.",
    siteName: "ReconAPM",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
