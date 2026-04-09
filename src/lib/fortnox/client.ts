import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FortnoxTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
}

interface VoucherRow {
  Account: number;
  Debit: number;
  Credit: number;
  Description?: string;
}

interface VoucherInput {
  Description: string;
  TransactionDate: string; // "YYYY-MM-DD"
  VoucherSeries: string;
  VoucherNumber?: number;
  VoucherRows: VoucherRow[];
}

interface VoucherResult {
  VoucherNumber: number;
  VoucherSeries: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FORTNOX_TOKEN_URL = "https://apps.fortnox.se/oauth-v1/token";
const FORTNOX_API_BASE = "https://api.fortnox.se/3";
const SETTINGS_KEY = "fortnox_tokens";
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
const MIN_REQUEST_INTERVAL_MS = 200; // 5 req/s = 300 req/min

// ─── Rate Limiter State ──────────────────────────────────────────────────────

let lastRequestTime = 0;

// ─── Token Management ────────────────────────────────────────────────────────

export async function getTokens(): Promise<FortnoxTokens | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);

  if (rows.length === 0 || !rows[0].value) {
    return null;
  }

  const value = rows[0].value as Record<string, unknown>;
  if (
    typeof value.accessToken !== "string" ||
    typeof value.refreshToken !== "string" ||
    typeof value.expiresAt !== "number"
  ) {
    return null;
  }

  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    expiresAt: value.expiresAt,
  };
}

export async function saveTokens(tokens: FortnoxTokens): Promise<void> {
  await db
    .insert(settings)
    .values({
      key: SETTINGS_KEY,
      value: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        },
        updatedAt: new Date(),
      },
    });
}

export async function refreshAccessToken(): Promise<FortnoxTokens> {
  const currentTokens = await getTokens();
  if (!currentTokens) {
    throw new Error(
      "No Fortnox tokens found in database. Please complete OAuth flow first."
    );
  }

  const clientId = process.env.FORTNOX_CLIENT_ID?.trim();
  const clientSecret = process.env.FORTNOX_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing FORTNOX_CLIENT_ID or FORTNOX_CLIENT_SECRET environment variables."
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: currentTokens.refreshToken,
  });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch(FORTNOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Fortnox token refresh failed (${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  const newTokens: FortnoxTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await saveTokens(newTokens);

  return newTokens;
}

export async function getValidToken(): Promise<string> {
  const tokens = await getTokens();
  if (!tokens) {
    throw new Error(
      "No Fortnox tokens found in database. Please complete OAuth flow first."
    );
  }

  const isExpired = Date.now() >= tokens.expiresAt - TOKEN_EXPIRY_BUFFER_MS;

  if (isExpired) {
    const refreshed = await refreshAccessToken();
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

// ─── Rate-Limited Fetch ──────────────────────────────────────────────────────

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const delay = MIN_REQUEST_INTERVAL_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
}

export async function rateLimitedFetch(
  url: string,
  options: RequestInit
): Promise<Response> {
  await waitForRateLimit();
  return fetch(url, options);
}

// ─── Voucher Creation ────────────────────────────────────────────────────────

export async function createVoucher(
  voucher: VoucherInput
): Promise<VoucherResult> {
  const token = await getValidToken();

  const response = await rateLimitedFetch(`${FORTNOX_API_BASE}/vouchers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ Voucher: voucher }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      detail =
        parsed?.ErrorInformation?.Message ||
        parsed?.message ||
        errorText;
    } catch {
      // Use raw text
    }
    throw new Error(
      `Fortnox voucher creation failed (${response.status}): ${detail}`
    );
  }

  const data = (await response.json()) as {
    Voucher: { VoucherNumber: number; VoucherSeries: string };
  };

  return {
    VoucherNumber: data.Voucher.VoucherNumber,
    VoucherSeries: data.Voucher.VoucherSeries,
  };
}
