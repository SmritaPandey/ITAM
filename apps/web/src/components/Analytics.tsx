"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hasAnalyticsConsent } from "./CookieConsent";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";

/**
 * First-party analytics tracker.
 * Only tracks if user has given analytics consent.
 * Collects: page views, session duration, feature usage.
 * Does NOT collect: PII, keystrokes, form content, cookie values,
 * credentials, or screen recordings.
 */

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("qs_session_id");
  if (!sid) {
    sid = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("qs_session_id", sid);
  }
  return sid;
}

/**
 * Only cookie NAMES are collected (for consent/compliance auditing).
 * Cookie values are never read or transmitted.
 */
function getCookieNames(): string[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim())
    .filter(Boolean);
}

function sendEvent(event: string, props?: Record<string, any>) {
  // Respect the user's cookie/analytics consent choice — no consent, no tracking.
  if (!hasAnalyticsConsent()) return;

  const payload = {
    event,
    sessionId: getSessionId(),
    path: typeof window !== "undefined" ? window.location.pathname : "/",
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    screenWidth: typeof window !== "undefined" ? window.innerWidth : 1920,
    screenHeight: typeof window !== "undefined" ? window.innerHeight : 1080,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "SSR",
    language: typeof navigator !== "undefined" ? navigator.language : "en",
    timestamp: new Date().toISOString(),
    cookieNames: getCookieNames(),
    ...props,
  };

  // Authenticate via standard header (never embed tokens in analytics payloads).
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  if (typeof window !== "undefined") {
    fetch(`${API}/analytics/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true, // survives page unload, like sendBeacon
    }).catch(() => {});
  }
}

/**
 * Track a custom event (feature usage, button clicks, etc.)
 */
export function trackEvent(event: string, props?: Record<string, any>) {
  sendEvent(event, props);
}

/**
 * Analytics provider component — place in layout.
 * Automatically tracks page views on route changes.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const startTime = useRef(Date.now());

  useEffect(() => {
    // Track page view
    sendEvent("page_view");
    startTime.current = Date.now();

    // Track time on page when leaving
    return () => {
      const duration = Math.round((Date.now() - startTime.current) / 1000);
      if (duration > 2) {
        sendEvent("page_leave", { duration });
      }
    };
  }, [pathname]);

  return <>{children}</>;
}
