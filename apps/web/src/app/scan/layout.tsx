import type { Metadata, Viewport } from "next";
import ScanServiceWorker from "./ScanServiceWorker";

export const metadata: Metadata = {
  title: "Scan Asset",
  description: "Scan barcodes and QR codes to look up assets in QS Assets",
  applicationName: "QS Assets Scan",
  appleWebApp: {
    capable: true,
    title: "QS Scan",
    statusBarStyle: "black-translucent",
  },
  manifest: "/scan-manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#06b6d4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="manifest" href="/scan-manifest.json" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <ScanServiceWorker />
      {children}
    </>
  );
}
