"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hasAnalyticsConsent } from "./CookieConsent";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const UTM_STORAGE_KEY = "qs_utm";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("qs_session_id");
  if (!sid) {
    sid = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("qs_session_id", sid);
  }
  return sid;
}

function captureUtmsFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const found: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const v = params.get(key);
      if (v) found[key] = v;
    }
    if (Object.keys(found).length > 0) {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(found));
    }
  } catch {
    /* ignore */
  }
}

function getStoredUtms(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function getCookieNames(): string[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim())
    .filter(Boolean);
}

function sendEvent(event: string, props?: Record<string, any>) {
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
    ...getStoredUtms(),
    ...props,
  };

  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  if (typeof window !== "undefined") {
    fetch(`${API}/analytics/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }
}

export function trackEvent(event: string, props?: Record<string, any>) {
  sendEvent(event, props);
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const startTime = useRef(Date.now());

  useEffect(() => {
    captureUtmsFromUrl();
    sendEvent("page_view");
    startTime.current = Date.now();

    return () => {
      const duration = Math.round((Date.now() - startTime.current) / 1000);
      if (duration > 2) {
        sendEvent("page_leave", { duration });
      }
    };
  }, [pathname]);

  return <>{children}</>;
}
