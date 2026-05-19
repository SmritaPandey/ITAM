"use client";
import { CookieConsent } from "@/components/CookieConsent";
import { AnalyticsProvider } from "@/components/Analytics";

/**
 * Client-side providers that need browser APIs.
 * Wraps children with cookie consent banner and analytics tracking.
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsProvider>
      {children}
      <CookieConsent />
    </AnalyticsProvider>
  );
}
