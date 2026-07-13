"use client";

import { useEffect } from "react";

/** Registers the /scan scoped service worker for installable PWA. */
export default function ScanServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw-scan.js", { scope: "/scan" }).catch(() => undefined);
  }, []);
  return null;
}
