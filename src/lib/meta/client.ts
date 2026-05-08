import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const META_API_VERSION = "v25.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// ─── Adaptive Rate Limiting ──────────────────────────────────────────────────
// Meta Marketing API uses BUC (Business Use Case) rate limiting.
// - Read calls = 1 point, Write calls = 3 points
// - Standard tier: 9,000 points per 60 seconds
// - We read X-Business-Use-Case-Usage and X-App-Usage headers to adapt dynamically.
// - Proactive slowdown at 50%+, aggressive backoff at 75%+, pause at 90%+.

const THROTTLE_MAX_CONCURRENT = 6;
let inFlightCount = 0;
let lastRequestTime = 0;
let currentUtilization = 0;             // 0-100 from Meta headers
let estimatedRecoveryAt = 0;            // timestamp when we can resume after throttle

function getAdaptiveDelay(): number {
  if (currentUtilization >= 90) return 2000;
  if (currentUtilization >= 75) return 1000;
  if (currentUtilization >= 50) return 400;
  return 100;
}

function getMaxConcurrent(): number {
  if (currentUtilization >= 90) return 1;
  if (currentUtilization >= 75) return 2;
  if (currentUtilization >= 50) return 4;
  return THROTTLE_MAX_CONCURRENT;
}

async function throttle(): Promise<void> {
  // If Meta told us to wait, respect it
  if (estimatedRecoveryAt > Date.now()) {
    const waitMs = estimatedRecoveryAt - Date.now();
    console.warn(`Meta rate limit: waiting ${Math.ceil(waitMs / 1000)}s until recovery...`);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  // Wait for concurrency slot (adaptive based on utilization)
  const maxConcurrent = getMaxConcurrent();
  while (inFlightCount >= maxConcurrent) {
    await new Promise((r) => setTimeout(r, 50));
  }

  // Enforce adaptive delay between requests
  const delay = getAdaptiveDelay();
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < delay) {
    await new Promise((r) => setTimeout(r, delay - elapsed));
  }
  lastRequestTime = Date.now();
  inFlightCount++;
}

function releaseThrottle(): void {
  inFlightCount--;
}

/**
 * Parse Meta rate limit headers and update utilization.
 * Meta returns these as JSON in X-Business-Use-Case-Usage and X-App-Usage.
 */
function updateUtilizationFromHeaders(res: Response): void {
  // X-Business-Use-Case-Usage: {"ad_account_id":[{"call_count":28,"total_cputime":25,"total_time":30,...}]}
  const bucHeader = res.headers.get("x-business-use-case-usage");
  if (bucHeader) {
    try {
      const parsed = JSON.parse(bucHeader);
      for (const accountUsages of Object.values(parsed) as Array<Array<{ call_count?: number; total_cputime?: number; total_time?: number; estimated_time_to_regain_access?: number }>>) {
        for (const usage of accountUsages) {
          const maxUtil = Math.max(
            usage.call_count || 0,
            usage.total_cputime || 0,
            usage.total_time || 0
          );
          currentUtilization = Math.max(currentUtilization, maxUtil);

          if (usage.estimated_time_to_regain_access && usage.estimated_time_to_regain_access > 0) {
            estimatedRecoveryAt = Date.now() + usage.estimated_time_to_regain_access * 60 * 1000;
          }
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Fallback: X-App-Usage header
  const appHeader = res.headers.get("x-app-usage");
  if (appHeader) {
    try {
      const parsed = JSON.parse(appHeader) as { call_count?: number; total_cputime?: number; total_time?: number };
      const maxUtil = Math.max(
        parsed.call_count || 0,
        parsed.total_cputime || 0,
        parsed.total_time || 0
      );
      currentUtilization = Math.max(currentUtilization, maxUtil);
    } catch { /* ignore parse errors */ }
  }

  // Decay utilization gradually if headers show low usage
  // (prevents stale high values from persisting)
  if (currentUtilization > 0 && !bucHeader && !appHeader) {
    currentUtilization = Math.max(0, currentUtilization - 5);
  }
}

/** Add random jitter to prevent thundering herd */
function jitter(ms: number): number {
  return ms + Math.random() * Math.min(ms * 0.5, 1000);
}

// Refresh token when within 7 days of expiry
const TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

interface MetaRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  params?: Record<string, string | number | boolean>;
  body?: Record<string, unknown> | FormData;
  token?: string;
}

export async function getActiveConnection() {
  const connections = await db
    .select()
    .from(schema.metaConnections)
    .where(eq(schema.metaConnections.isActive, true))
    .limit(1);

  if (connections.length === 0) return null;
  return connections[0];
}

/**
 * Refresh a Meta long-lived token before it expires.
 * Returns the new token or null if refresh fails.
 */
async function refreshTokenIfNeeded(
  conn: { id: number; accessToken: string; tokenExpiresAt: Date | null }
): Promise<string> {
  // If no expiry date set or not close to expiry, return current token
  if (!conn.tokenExpiresAt) return conn.accessToken;

  const timeUntilExpiry = conn.tokenExpiresAt.getTime() - Date.now();
  if (timeUntilExpiry > TOKEN_REFRESH_THRESHOLD_MS) return conn.accessToken;

  // Token is expiring soon — attempt refresh
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    console.warn("META_APP_ID/META_APP_SECRET not set — cannot refresh token");
    return conn.accessToken;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?` +
        `grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}` +
        `&fb_exchange_token=${conn.accessToken}`
    );
    const data = await res.json();

    if (data.error || !data.access_token) {
      console.error("Meta token refresh failed:", data.error?.message || "No access_token in response");
      return conn.accessToken;
    }

    const newExpiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

    await db
      .update(schema.metaConnections)
      .set({
        accessToken: data.access_token,
        tokenExpiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.metaConnections.id, conn.id));

    console.log("Meta token refreshed successfully, expires:", newExpiresAt?.toISOString());
    return data.access_token;
  } catch (err) {
    console.error("Meta token refresh error:", err);
    return conn.accessToken;
  }
}

// Cache token + ad account per request lifecycle (serverless function invocation)
let _cachedToken: string | null = null;
let _cachedAdAccountId: string | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

function isCacheValid(): boolean {
  return Date.now() - _cacheTimestamp < CACHE_TTL_MS;
}

export async function getAccessToken(): Promise<string> {
  if (_cachedToken && isCacheValid()) return _cachedToken;

  // First try DB connection
  const conn = await getActiveConnection();
  if (conn?.accessToken) {
    _cachedToken = await refreshTokenIfNeeded(conn);
    _cachedAdAccountId = conn.activeAdAccountId
      ? (conn.activeAdAccountId.startsWith("act_") ? conn.activeAdAccountId : `act_${conn.activeAdAccountId}`)
      : null;
    _cacheTimestamp = Date.now();
    return _cachedToken;
  }

  // Fallback to env var
  const envToken = process.env.META_ACCESS_TOKEN;
  if (envToken) {
    _cachedToken = envToken;
    _cacheTimestamp = Date.now();
    return envToken;
  }

  throw new Error("No Meta connection configured. Go to Settings to connect your Meta account.");
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly metaErrorCode?: number,
    public readonly metaErrorSubcode?: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }

  /** True if the token is expired or invalid */
  get isAuthError(): boolean {
    return this.statusCode === 401 || this.metaErrorCode === 190;
  }

  /** True if we hit the rate limit */
  get isRateLimitError(): boolean {
    return this.statusCode === 429 || this.metaErrorCode === 4 || this.metaErrorCode === 32;
  }
}

export async function metaApi<T = unknown>(
  endpoint: string,
  options: MetaRequestOptions = {}
): Promise<T> {
  const { method = "GET", params = {}, body } = options;
  const token = options.token || await getAccessToken();
  const maxRetries = method === "GET" ? 3 : 1; // Only retry reads

  const url = new URL(`${META_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const fetchOptions: RequestInit = { method, headers, cache: "no-store" };
  if (body) {
    if (body instanceof FormData) {
      fetchOptions.body = body;
    } else {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(body);
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await throttle();
    try {
      let res: Response;
      try {
        res = await fetch(url.toString(), fetchOptions);
      } catch (err) {
        throw new MetaApiError(
          `Network error calling Meta API: ${err instanceof Error ? err.message : String(err)}`,
          0
        );
      }

      // Update adaptive throttle from Meta's rate limit headers
      updateUtilizationFromHeaders(res);

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        throw new MetaApiError(
          `Meta API returned invalid JSON (status ${res.status})`,
          res.status
        );
      }

      if (!res.ok) {
        const metaError = data?.error as { message?: string; code?: number; error_subcode?: number } | undefined;
        const err = new MetaApiError(
          metaError?.message || `Meta API error: ${res.status}`,
          res.status,
          metaError?.code,
          metaError?.error_subcode,
        );

        // Retry on rate limit or transient server errors
        if ((err.isRateLimitError || res.status >= 500) && attempt < maxRetries) {
          // Use Retry-After header if present, otherwise exponential backoff with jitter
          const retryAfter = res.headers.get("retry-after");
          const backoffMs = retryAfter
            ? parseInt(retryAfter) * 1000
            : jitter(Math.min(1000 * Math.pow(2, attempt + 1), 30000));
          console.warn(
            `Meta API ${err.isRateLimitError ? "rate limit" : "server error"} ` +
            `(attempt ${attempt + 1}/${maxRetries + 1}, utilization: ${currentUtilization}%), ` +
            `retrying in ${Math.round(backoffMs / 1000)}s...`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        throw err;
      }

      return data as T;
    } finally {
      releaseThrottle();
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new MetaApiError("Max retries exceeded", 429);
}

/**
 * Fetch all pages from a paginated Meta API endpoint.
 * Automatically follows `paging.next` cursors until all data is retrieved.
 */
export async function metaApiPaginated<T = unknown>(
  endpoint: string,
  options: MetaRequestOptions = {}
): Promise<T[]> {
  const allItems: T[] = [];

  // First request
  const firstPage = await metaApi<{ data?: T[]; paging?: { next?: string } }>(endpoint, options);
  if (firstPage.data) allItems.push(...firstPage.data);

  // Follow pagination cursors
  let nextUrl = firstPage.paging?.next;
  let paginationRetries = 0;
  while (nextUrl) {
    await throttle();
    try {
      const token = options.token || await getAccessToken();
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      updateUtilizationFromHeaders(res);

      const data = await res.json();

      if (!res.ok) {
        const metaError = data?.error as { message?: string; code?: number; error_subcode?: number } | undefined;
        // On rate limit during pagination, wait with backoff and retry this page
        if ((res.status === 429 || metaError?.code === 4 || metaError?.code === 32) && paginationRetries < 3) {
          paginationRetries++;
          const waitMs = jitter(Math.min(2000 * Math.pow(2, paginationRetries), 30000));
          console.warn(`Rate limit during pagination (retry ${paginationRetries}/3), waiting ${Math.round(waitMs / 1000)}s...`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue; // Retry same nextUrl
        }
        console.error("Pagination error:", metaError?.message);
        break; // Stop pagination on other errors
      }

      paginationRetries = 0; // Reset on success
      if (data.data) allItems.push(...data.data);
      nextUrl = data.paging?.next;
    } finally {
      releaseThrottle();
    }
  }

  return allItems;
}

export async function getAdAccountId(): Promise<string> {
  if (_cachedAdAccountId && isCacheValid()) return _cachedAdAccountId;

  // Calling getAccessToken populates the cache from DB
  await getAccessToken();
  if (_cachedAdAccountId) return _cachedAdAccountId;

  // Fallback to env var
  const id = process.env.META_AD_ACCOUNT_ID;
  if (!id) throw new Error("No ad account selected. Go to Settings to connect your Meta account.");
  const formatted = id.startsWith("act_") ? id : `act_${id}`;
  _cachedAdAccountId = formatted;
  return formatted;
}

export async function getPageId(): Promise<string> {
  const conn = await getActiveConnection();
  if (conn?.activePageId) return conn.activePageId;

  const id = process.env.META_PAGE_ID;
  if (!id) throw new Error("No page selected. Go to Settings to configure your Meta page.");
  return id;
}

export async function getPixelId(): Promise<string | null> {
  const conn = await getActiveConnection();
  if (conn?.pixelId) return conn.pixelId;
  return process.env.META_PIXEL_ID || null;
}
