import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssetCommand | Enterprise Asset Management",
  description: "Unified IT & Non-IT Asset Monitoring, Network Management, Fleet GPS, CCTV, VDI, Patch Management & ITSM Platform",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  metadataBase: new URL("https://reconapm.com"),
  openGraph: {
    title: "AssetCommand — Enterprise Asset Management",
    description: "Command every asset. Secure every endpoint. Built for enterprises that demand visibility and control.",
    siteName: "AssetCommand",
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
