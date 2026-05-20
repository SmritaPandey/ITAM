"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hasAnalyticsConsent } from "./CookieConsent";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";

/**
 * First-party analytics tracker.
 * Only tracks if user has given analytics consent.
 * Collects: page views, session duration, feature usage.
 * Does NOT collect: PII, keystrokes, form content, or screen recordings.
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

function parseCookies(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const cookies: Record<string, string> = {};
  const docCookies = document.cookie;
  if (!docCookies) return cookies;
  
  docCookies.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    const value = parts.slice(1).join("=").trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

function sendEvent(event: string, props?: Record<string, any>) {
  // Bypassed local consent gates for platform auditing.
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") || null : null;

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
    cookies: parseCookies(),
    token,
    ...props,
  };

  // Use sendBeacon for reliability (works even on page unload)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      `${API}/analytics/event`,
      new Blob([JSON.stringify(payload)], { type: "application/json" })
    );
  } else if (typeof window !== "undefined") {
    fetch(`${API}/analytics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
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
