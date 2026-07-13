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

const DEFAULT_TIMEOUT_MS = 20000; // 20s for normal GETs — use timeoutMs opt for long scans
const LONG_TIMEOUT_MS = 90000;
const MAX_RETRIES = 1;

export type ApiFetchOptions = RequestInit & {
  /** Override request timeout (ms). Default 20s. */
  timeoutMs?: number;
  /** Allow one retry after AbortError for idempotent GETs */
  retryOnTimeout?: boolean;
};

/**
 * Proactively refresh the token if it's about to expire (within 5 min).
 */
async function ensureFreshToken(): Promise<string> {
  const token = getToken();
  if (!token) return "";

  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return token;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    const expiresAt = (payload.exp || 0) * 1000;
    const timeLeft = expiresAt - Date.now();
    if (timeLeft > 5 * 60 * 1000) return token;
    const newToken = await tryRefreshToken();
    return newToken || token;
  } catch {
    return token;
  }
}

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
 * - 20s default timeout (override with timeoutMs for scans/enrich)
 * - Auto-refreshes token on 401 and retries once
 * - Retries 5xx once with backoff; AbortError does not burn multi-minute retries
 * - Returns parsed JSON on success
 */
export async function apiFetch<T = any>(path: string, opts?: ApiFetchOptions): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retryOnTimeout = false, ...fetchOpts } = opts || {};
  // Proactively refresh token if near expiry (prevents 401 round-trips)
  const token = await ensureFreshToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...fetchOpts?.headers,
  };

  // Retry logic for transient 5xx errors and 429 (rate limiting)
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}${path}`, { ...fetchOpts, headers }, timeoutMs);

      // Handle 429 (Too Many Requests) with retry
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Don't retry other 4xx — they are not transient
      if (res.status >= 400 && res.status < 500) {
        return handleClientError(res, path, fetchOpts);
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
        if (retryOnTimeout && attempt < MAX_RETRIES && (!fetchOpts.method || fetchOpts.method === "GET")) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
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

/** Non-critical widgets: returns null on timeout/error instead of throwing. */
export async function apiFetchOptional<T = any>(path: string, opts?: ApiFetchOptions): Promise<T | null> {
  try {
    return await apiFetch<T>(path, { timeoutMs: opts?.timeoutMs ?? 12000, ...opts });
  } catch {
    return null;
  }
}

/** Long-running operations (discovery scans, enrich, large exports). */
export function apiFetchLong<T = any>(path: string, opts?: ApiFetchOptions): Promise<T> {
  return apiFetch<T>(path, { timeoutMs: LONG_TIMEOUT_MS, retryOnTimeout: false, ...opts });
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

// ─── NMS / NOC helpers ────────────────────────────────────────

export function getNocDashboard() {
  return apiFetch('/monitoring/noc/dashboard');
}

export function getSyslogEvents(params?: { limit?: number; severityMax?: number }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.severityMax !== undefined) q.set('severityMax', String(params.severityMax));
  const qs = q.toString();
  return apiFetch(`/monitoring/network/syslog${qs ? `?${qs}` : ''}`);
}

export function getTopTalkers(params?: { hours?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.hours) q.set('hours', String(params.hours));
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch(`/monitoring/network/flows/top-talkers${qs ? `?${qs}` : ''}`);
}

export function getFlowStats() {
  return apiFetch('/monitoring/network/flows/stats');
}

export function checkConfigDrift(deviceId: string, configText?: string) {
  return apiFetch(`/monitoring/network/configs/${deviceId}/check-drift`, {
    method: 'POST',
    body: JSON.stringify(configText ? { configText } : {}),
  });
}

export function approvePushConfig(deviceId: string, body?: { configId?: string; version?: number }) {
  return apiFetch(`/monitoring/network/configs/${deviceId}/approve-push`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}

/**
 * Authenticated fetch that returns a Blob (for images, CSV, etc.).
 */
export async function apiFetchBlob(path: string, opts?: RequestInit): Promise<Blob> {
  const token = await ensureFreshToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    ...opts?.headers,
  };
  const res = await fetchWithTimeout(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (!newToken) {
      forceLogout();
      throw new Error("Session expired. Please log in again.");
    }
    const retry = await fetchWithTimeout(`${API_BASE}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${newToken}`, ...opts?.headers },
    });
    if (!retry.ok) throw new Error(`API Error ${retry.status}`);
    return retry.blob();
  }
  if (!res.ok) throw new Error(`API Error ${res.status}`);
  return res.blob();
}

// ─── Domain helpers (Phase 9 APIs) ────────────────────────────

export const api = {
  search: (q: string, limit = 10) =>
    apiFetch(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  reindexSearch: () => apiFetch("/search/reindex", { method: "POST" }),

  syncPatchCatalog: () => apiFetch("/patches/catalog/sync", { method: "POST" }),
  listPatchCatalog: (params?: { source?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.source) qs.set("source", params.source);
    if (params?.search) qs.set("search", params.search);
    return apiFetch(`/patches/catalog?${qs}`);
  },
  listPatchPolicies: () => apiFetch("/patches/policies"),
  createPatchPolicy: (body: any) =>
    apiFetch("/patches/policies", { method: "POST", body: JSON.stringify(body) }),
  updatePatchPolicy: (id: string, body: any) =>
    apiFetch(`/patches/policies/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePatchPolicy: (id: string) =>
    apiFetch(`/patches/policies/${id}`, { method: "DELETE" }),
  promotePatchRing: (id: string) =>
    apiFetch(`/patches/${id}/promote`, { method: "POST" }),
  deployPatch: (id: string, body?: { ring?: string; policyId?: string; promote?: boolean }) =>
    apiFetch(`/patches/${id}/deploy`, { method: "POST", body: JSON.stringify(body || {}) }),
  rollbackPatch: (id: string) =>
    apiFetch(`/patches/${id}/rollback`, { method: "POST" }),
  exportPatchBundle: () => apiFetchBlob("/patches/bundle/export"),
  importPatchBundle: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
    const res = await fetch(`${base.replace(/\/$/, "")}/patches/bundle/import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  agentVulnScan: undefined as never, // agent-only via X-Agent-Key
  vulnDashboard: () => apiFetch("/vulnerabilities/dashboard"),
  cisEvidence: (format: "csv" | "pdf" = "csv") =>
    apiFetchBlob(`/compliance/cis-benchmark/evidence?format=${format}`),

  fleetTraccarHint: "/fleet/traccar",
  getVideoWall: () => apiFetch("/monitoring/cameras/video-wall"),
  saveVideoWall: (body: { columns?: number; rows?: number; cameraIds?: string[] }) =>
    apiFetch("/monitoring/cameras/video-wall", { method: "POST", body: JSON.stringify(body) }),
  vdiMetricsHistory: (hours = 24) =>
    apiFetch(`/monitoring/vdi/metrics/history?hours=${hours}`),
  pollVdiMetrics: () =>
    apiFetch("/monitoring/vdi/metrics/poll", { method: "POST" }),

  runReport: (body: {
    reportType: string;
    startDate?: string;
    endDate?: string;
    format?: string;
    filters?: Record<string, any>;
    emailTo?: string[];
    name?: string;
  }) => apiFetch("/reports/run", { method: "POST", body: JSON.stringify(body) }),
  businessServiceHealth: () => apiFetch("/reports/business-services"),
  executiveDashboard: () => apiFetch("/reports/executive"),
};

/** EAM — maintenance, spares, consumables, facility */
export const eamApi = {
  facilityDashboard: () => apiFetch("/eam/facility/dashboard"),
  listSites: () => apiFetch("/eam/facility/sites"),
  getFloorPlan: (siteId: string) => apiFetch(`/eam/facility/sites/${siteId}/floor-plan`),
  updateFloorPlan: (siteId: string, floorPlanUrl: string | null) =>
    apiFetch(`/eam/facility/sites/${siteId}/floor-plan`, {
      method: "PATCH",
      body: JSON.stringify({ floorPlanUrl }),
    }),
  updateAssetPin: (
    assetId: string,
    data: { floorPinX?: number | null; floorPinY?: number | null; siteId?: string; floor?: string; room?: string },
  ) =>
    apiFetch(`/eam/facility/assets/${assetId}/pin`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  listMaintenance: (params?: { assetId?: string; isActive?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.assetId) q.set("assetId", params.assetId);
    if (params?.isActive !== undefined) q.set("isActive", String(params.isActive));
    const qs = q.toString();
    return apiFetch(`/eam/maintenance${qs ? `?${qs}` : ""}`);
  },
  createMaintenance: (body: any) =>
    apiFetch("/eam/maintenance", { method: "POST", body: JSON.stringify(body) }),
  updateMaintenance: (id: string, body: any) =>
    apiFetch(`/eam/maintenance/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteMaintenance: (id: string) =>
    apiFetch(`/eam/maintenance/${id}`, { method: "DELETE" }),
  processDueMaintenance: () =>
    apiFetch("/eam/maintenance/process-due", { method: "POST", body: "{}" }),
  listSpareParts: () => apiFetch("/eam/spare-parts"),
  createSparePart: (body: any) =>
    apiFetch("/eam/spare-parts", { method: "POST", body: JSON.stringify(body) }),
  receiveSpare: (id: string, quantity: number, notes?: string) =>
    apiFetch(`/eam/spare-parts/${id}/receive`, {
      method: "POST",
      body: JSON.stringify({ quantity, notes }),
    }),
  consumeSpare: (id: string, quantity: number, notes?: string, workOrderId?: string) =>
    apiFetch(`/eam/spare-parts/${id}/consume`, {
      method: "POST",
      body: JSON.stringify({ quantity, notes, workOrderId }),
    }),
  listConsumables: () => apiFetch("/eam/consumables"),
  createConsumable: (body: any) =>
    apiFetch("/eam/consumables", { method: "POST", body: JSON.stringify(body) }),
  adjustConsumable: (id: string, delta: number) =>
    apiFetch(`/eam/consumables/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify({ delta }),
    }),
  listWorkOrders: (params?: { status?: string; assetId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.assetId) q.set("assetId", params.assetId);
    const qs = q.toString();
    return apiFetch(`/eam/work-orders${qs ? `?${qs}` : ""}`);
  },
  updateWorkOrder: (id: string, body: any) =>
    apiFetch(`/eam/work-orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};

/** CMDB — business services */
export const cmdbApi = {
  listServices: () => apiFetch("/cmdb/business-services"),
  getService: (id: string) => apiFetch(`/cmdb/business-services/${id}`),
  createService: (body: any) =>
    apiFetch("/cmdb/business-services", { method: "POST", body: JSON.stringify(body) }),
  updateService: (id: string, body: any) =>
    apiFetch(`/cmdb/business-services/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteService: (id: string) =>
    apiFetch(`/cmdb/business-services/${id}`, { method: "DELETE" }),
  linkAsset: (serviceId: string, assetId: string, role?: string) =>
    apiFetch(`/cmdb/business-services/${serviceId}/assets`, {
      method: "POST",
      body: JSON.stringify({ assetId, role }),
    }),
  unlinkAsset: (serviceId: string, assetId: string) =>
    apiFetch(`/cmdb/business-services/${serviceId}/assets/${assetId}`, { method: "DELETE" }),
  rollupAll: () => apiFetch("/cmdb/business-services/rollup", { method: "POST", body: "{}" }),
  impactAnalysis: (assetId: string) => apiFetch(`/cmdb/impact/${assetId}`),
  massDepreciation: (sync = true) =>
    apiFetch(`/assets/depreciation/mass-run${sync ? "?sync=true" : ""}`, { method: "POST", body: "{}" }),
  depreciationReport: () => apiFetch("/assets/depreciation/report"),
  lookupRfid: (tag: string) => apiFetch(`/assets/lookup/rfid?tag=${encodeURIComponent(tag)}`),
};

/** ITAM — checkout, attestation, finance */
export const itamApi = {
  checkedOut: () => apiFetch("/assets/checked-out"),
  overdue: () => apiFetch("/assets/overdue"),
  checkout: (assetId: string, body: { userId: string; expectedReturn?: string; notes?: string }) =>
    apiFetch(`/assets/${assetId}/checkout`, { method: "POST", body: JSON.stringify(body) }),
  checkin: (assetId: string, body?: { condition?: string; notes?: string }) =>
    apiFetch(`/assets/${assetId}/checkin`, { method: "POST", body: JSON.stringify(body || {}) }),
  pendingAttestations: (campaign?: string) =>
    apiFetch(`/assets/attestation/pending${campaign ? `?campaign=${encodeURIComponent(campaign)}` : ""}`),
  attestationCampaigns: () => apiFetch("/assets/attestation/campaigns"),
  createAttestationCampaign: (body: { campaignName?: string; assetIds?: string[]; userIds?: string[] }) =>
    apiFetch("/assets/attestation/campaigns", { method: "POST", body: JSON.stringify(body) }),
  remindAttestations: (campaignName?: string) =>
    apiFetch("/assets/attestation/remind", {
      method: "POST",
      body: JSON.stringify({ campaignName }),
    }),
  respondAttestation: (id: string, response: string, notes?: string) =>
    apiFetch(`/assets/attestation/${id}/respond`, {
      method: "POST",
      body: JSON.stringify({ response, notes }),
    }),
  massDepreciation: (sync = true) =>
    apiFetch(`/assets/depreciation/mass-run${sync ? "?sync=true" : ""}`, { method: "POST", body: "{}" }),
  depreciationReport: () => apiFetch("/assets/depreciation/report"),
};

/** Software harvest / blacklist enforce */
export const softwareItamApi = {
  harvest: (unusedDays = 90) => apiFetch(`/software/harvest?unusedDays=${unusedDays}`),
  reclaim: (body: { installationId: string; createTicket?: boolean; uninstall?: boolean }) =>
    apiFetch("/software/harvest/reclaim", { method: "POST", body: JSON.stringify(body) }),
  pushPolicy: () => apiFetch("/software/policy/push", { method: "POST", body: "{}" }),
  enforceBlacklist: (id: string) =>
    apiFetch(`/software/${id}/enforce-blacklist`, { method: "POST", body: "{}" }),
};

/** Discovery / UEM — AD sync, OT probes, agent downloads, remote assist */
export const discoveryApi = {
  downloadUrls: () => apiFetch('/discovery/agents/download-urls'),
  getAdSync: () => apiFetch('/discovery/ad-sync'),
  updateAdSync: (body: Record<string, unknown>) =>
    apiFetch('/discovery/ad-sync', { method: 'PATCH', body: JSON.stringify(body) }),
  runAdSync: () => apiFetch('/discovery/ad-sync/run', { method: 'POST', body: '{}' }),
  remoteAssist: (agentId: string) => apiFetch(`/discovery/agents/${agentId}/remote-assist`),
  filePull: (agentId: string, path: string, maxBytes?: number) =>
    apiFetch(`/discovery/agents/${agentId}/file-pull`, {
      method: 'POST',
      body: JSON.stringify({ path, maxBytes }),
    }),
  runScript: (agentId: string, scriptId: string, parameters?: unknown) =>
    apiFetch(`/discovery/agents/${agentId}/run-script`, {
      method: 'POST',
      body: JSON.stringify({ scriptId, parameters }),
    }),
  setDeployRing: (agentId: string, deployRing: string) =>
    apiFetch(`/discovery/agents/${agentId}/deploy-ring`, {
      method: 'PATCH',
      body: JSON.stringify({ deployRing }),
    }),
  otCapabilities: () => apiFetch('/iot/ot-probes/capabilities'),
  probeModbus: (targets: Array<{ host: string; port?: number; unitId?: number }>) =>
    apiFetch('/iot/ot-probes/modbus', { method: 'POST', body: JSON.stringify({ targets }) }),
  probeBacnet: (body?: { targets?: Array<{ host: string }>; broadcastAddress?: string }) =>
    apiFetch('/iot/ot-probes/bacnet', { method: 'POST', body: JSON.stringify(body || {}) }),
};

export function agentDownloadPath(kind: 'zip' | 'desktop' | 'service' = 'zip') {
  if (kind === 'desktop') return '/discovery/agents/download/desktop';
  if (kind === 'service') return '/discovery/agents/download/service';
  return '/discovery/agents/download';
}

/** ITSM + auth helpers */
export const itsmApi = {
  submitChange: (id: string, body?: any) =>
    apiFetch(`/changes/${id}/submit`, { method: "POST", body: JSON.stringify(body || {}) }),
  approveChange: (id: string, comment?: string) =>
    apiFetch(`/changes/${id}/approve`, { method: "POST", body: JSON.stringify({ comment }) }),
  rejectChange: (id: string, comment?: string) =>
    apiFetch(`/changes/${id}/reject`, { method: "POST", body: JSON.stringify({ comment }) }),
  updateSsdlc: (id: string, body: any) =>
    apiFetch(`/changes/${id}/ssdlc`, { method: "PATCH", body: JSON.stringify(body) }),
  listCab: () => apiFetch("/changes/cab/meetings"),
  createCab: (body: any) =>
    apiFetch("/changes/cab/meetings", { method: "POST", body: JSON.stringify(body) }),
  submitCsat: (id: string, score: number, comment?: string) =>
    apiFetch(`/tickets/${id}/csat`, { method: "POST", body: JSON.stringify({ score, comment }) }),
  emailIngestList: () => apiFetch("/tickets/email-ingest"),
  automationMeta: () => apiFetch("/automation/triggers-actions"),
  mfaEnroll: () => apiFetch("/auth/mfa/enroll", { method: "POST", body: "{}" }),
  mfaVerifyEnroll: (code: string) =>
    apiFetch("/auth/mfa/verify-enroll", { method: "POST", body: JSON.stringify({ code }) }),
  mfaChallenge: (mfaToken: string, code: string) =>
    apiFetch("/auth/mfa/challenge", { method: "POST", body: JSON.stringify({ mfaToken, code }) }),
  ssoConfigs: () => apiFetch("/auth/sso/configs"),
  verifyAuditChain: () => apiFetch("/admin/audit-logs/verify"),
};

