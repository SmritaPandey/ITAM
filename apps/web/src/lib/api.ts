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

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;

/**
 * Fetch with timeout — prevents hanging requests.
 */
function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Authenticated fetch wrapper.
 * - 30s request timeout (prevents hanging)
 * - Auto-refreshes token on 401 and retries once
 * - Retries 5xx errors with exponential backoff
 * - Returns parsed JSON on success
 */
export async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...opts?.headers,
  };

  // Retry logic for transient 5xx errors
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}${path}`, { ...opts, headers });

      // Don't retry 4xx — they are not transient
      if (res.status >= 400 && res.status < 500) {
        return handleClientError(res, path, opts);
      }

      if (res.ok) return res.json();

      // 5xx — retry with backoff
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }

      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Server Error ${res.status}`);
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out. Please check your connection and try again.");
      }
      lastError = err;
      if (attempt < MAX_RETRIES && !err.message?.includes("Session expired")) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error("Request failed");
}

/**
 * Handle 4xx client errors — auth refresh, validation errors, etc.
 */
async function handleClientError(res: Response, path: string, opts?: RequestInit): Promise<any> {
  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const retryRes = await fetchWithTimeout(`${API_BASE}${path}`, {
        ...opts,
        headers: { Authorization: `Bearer ${newToken}`, "Content-Type": "application/json", ...opts?.headers },
      });
      if (retryRes.ok) return retryRes.json();
      if (retryRes.status === 401) { forceLogout(); throw new Error("Session expired. Please log in again."); }
      const body = await retryRes.json().catch(() => ({}));
      throw new Error(body.message || `API Error ${retryRes.status}`);
    }
    forceLogout();
    throw new Error("Session expired. Please log in again.");
  }

  const body = await res.json().catch(() => ({}));
  throw new Error(body.message || `API Error ${res.status}: ${res.statusText}`);
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
