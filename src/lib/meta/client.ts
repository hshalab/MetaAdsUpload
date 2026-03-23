import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const META_API_VERSION = "v25.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

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

export async function getAccessToken(): Promise<string> {
  // First try DB connection
  const conn = await getActiveConnection();
  if (conn?.accessToken) {
    return refreshTokenIfNeeded(conn);
  }

  // Fallback to env var
  const envToken = process.env.META_ACCESS_TOKEN;
  if (envToken) return envToken;

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

  let res: Response;
  try {
    res = await fetch(url.toString(), fetchOptions);
  } catch (err) {
    throw new MetaApiError(
      `Network error calling Meta API: ${err instanceof Error ? err.message : String(err)}`,
      0
    );
  }

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
    throw new MetaApiError(
      metaError?.message || `Meta API error: ${res.status}`,
      res.status,
      metaError?.code,
      metaError?.error_subcode,
    );
  }

  return data as T;
}

export async function getAdAccountId(): Promise<string> {
  // First try DB connection
  const conn = await getActiveConnection();
  if (conn?.activeAdAccountId) {
    const id = conn.activeAdAccountId;
    return id.startsWith("act_") ? id : `act_${id}`;
  }

  // Fallback to env var
  const id = process.env.META_AD_ACCOUNT_ID;
  if (!id) throw new Error("No ad account selected. Go to Settings to connect your Meta account.");
  return id.startsWith("act_") ? id : `act_${id}`;
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
