/**
 * Shared API fetch utility for all dashboard pages.
 * Handles authentication, error responses, and automatic token refresh.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || "";
}

export function getApiBase(): string {
  return API_BASE;
}

// ─── Token Refresh Logic ──────────────────────────────────────
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Uses a lock so concurrent 401s don't fire multiple refresh requests.
 */
async function tryRefreshToken(): Promise<string | null> {
  // If already refreshing, wait for the in-flight request
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = typeof window !== "undefined"
    ? localStorage.getItem("refreshToken")
    : null;

  if (!refreshToken) return null;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem("refreshToken", data.refreshToken);
        }
        return data.accessToken as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─── Main API Fetch ───────────────────────────────────────────

/**
 * Authenticated fetch wrapper.
 * - Auto-refreshes token on 401 and retries the request once
 * - Redirects to /login only if refresh also fails
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
    // Try to refresh the token
    const newToken = await tryRefreshToken();

    if (newToken) {
      // Retry the original request with the new token
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...opts,
        headers: {
          Authorization: `Bearer ${newToken}`,
          "Content-Type": "application/json",
          ...opts?.headers,
        },
      });

      if (retryRes.ok) {
        return retryRes.json();
      }

      // If retry also fails with 401, session is truly dead
      if (retryRes.status === 401) {
        forceLogout();
        throw new Error("Session expired. Please log in again.");
      }

      const body = await retryRes.json().catch(() => ({}));
      throw new Error(body.message || `API Error ${retryRes.status}: ${retryRes.statusText}`);
    }

    // Refresh failed — session expired
    forceLogout();
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Force logout — clear all auth state and redirect to login.
 */
function forceLogout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    window.location.href = "/login";
  }
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
