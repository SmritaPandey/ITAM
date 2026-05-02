/**
 * Shared API fetch utility for all dashboard pages.
 * Handles authentication, error responses, and token refresh.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || "";
}

export function getApiBase(): string {
  return API_BASE;
}

/**
 * Authenticated fetch wrapper.
 * - Throws on non-OK responses (so try/catch catches them)
 * - Redirects to /login on 401 (token expired)
 * - Returns parsed JSON on success
 */
export async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });

  if (res.status === 401) {
    // Token expired — redirect to login
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Safe fetch — returns null on failure instead of throwing.
 * Useful for non-critical data fetches (stats, optional widgets).
 */
export async function safeFetch<T = any>(path: string, opts?: RequestInit): Promise<T | null> {
  try {
    return await apiFetch<T>(path, opts);
  } catch {
    return null;
  }
}
