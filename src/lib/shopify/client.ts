const SHOPIFY_API_VERSION = "2024-01";

interface ShopifyRequestOptions {
  params?: Record<string, string>;
}

interface ShopifyNoteAttribute {
  name: string;
  value: string;
}

interface ShopifyOrder {
  id: number;
  created_at: string;
  total_price: string;
  customer: {
    id: number;
    email?: string;
    created_at: string;
  } | null;
  note_attributes?: ShopifyNoteAttribute[];
}

interface ShopifyOrdersResponse {
  orders: ShopifyOrder[];
}

function getStore(): string {
  const store = process.env.SHOPIFY_STORE;
  if (!store) throw new Error("Missing SHOPIFY_STORE env var");
  return store;
}

/**
 * Get a valid Shopify access token.
 * Supports two modes:
 *   1. SHOPIFY_ACCESS_TOKEN — permanent Admin API token (custom apps, starts with shpat_)
 *   2. SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET — client_credentials OAuth (newer apps)
 */
async function getAccessToken(): Promise<string> {
  // Mode 1: permanent access token (simplest, most common for custom apps)
  const permanentToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (permanentToken) return permanentToken;

  // Mode 2: client_credentials OAuth
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Shopify credentials. Set SHOPIFY_ACCESS_TOKEN (recommended) or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET."
    );
  }

  const store = getStore();
  const res = await fetch(`https://${store}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function shopifyApi<T = unknown>(
  endpoint: string,
  options: ShopifyRequestOptions = {}
): Promise<T> {
  const store = getStore();
  const accessToken = await getAccessToken();
  const baseUrl = `https://${store}/admin/api/${SHOPIFY_API_VERSION}`;
  const url = new URL(`${baseUrl}${endpoint}`);

  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Parse the Link header for Shopify pagination.
 */
function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

/** Extract YYYY-MM-DD from an ISO timestamp */
function toDateStr(iso: string): string {
  return iso.slice(0, 10);
}

export interface UtmData {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmAdset: string | null;   // utm_term = ad set ID
  utmAd: string | null;      // utm_content = ad ID
}

/**
 * Extract UTM parameters from Shopify order note_attributes.
 * Shopify stores UTM data in note_attributes array.
 */
function extractUtmFromNoteAttributes(attrs: ShopifyNoteAttribute[] | undefined): UtmData {
  if (!attrs || attrs.length === 0) {
    return { utmSource: null, utmMedium: null, utmCampaign: null, utmAdset: null, utmAd: null };
  }
  const map = new Map(attrs.map((a) => [a.name.toLowerCase(), a.value]));
  return {
    utmSource: map.get("utm_source") || null,
    utmMedium: map.get("utm_medium") || null,
    utmCampaign: map.get("utm_campaign") || null,
    utmAdset: map.get("utm_term") || null,     // utm_term = ad set ID
    utmAd: map.get("utm_content") || null,      // utm_content = ad ID
  };
}

export interface ClassifiedOrder {
  id: number;
  createdAt: string;
  totalPrice: number;
  isNewCustomer: boolean;
  customerId: string | null;
  customerEmail: string | null;
  utm: UtmData;
}

/**
 * Fetch all orders in a date range from Shopify, handling pagination.
 * New customer = customer.created_at is the same day as order.created_at.
 * Includes UTM attribution from note_attributes.
 */
export async function fetchOrdersInRange(
  from: string,
  to: string
): Promise<ClassifiedOrder[]> {
  const store = getStore();
  const accessToken = await getAccessToken();
  const baseUrl = `https://${store}/admin/api/${SHOPIFY_API_VERSION}`;

  const allOrders: ClassifiedOrder[] = [];

  const initUrl = new URL(`${baseUrl}/orders.json`);
  initUrl.searchParams.set("status", "any");
  initUrl.searchParams.set("created_at_min", `${from}T00:00:00+00:00`);
  initUrl.searchParams.set("created_at_max", `${to}T23:59:59+00:00`);
  initUrl.searchParams.set("fields", "id,created_at,total_price,customer,note_attributes");
  initUrl.searchParams.set("limit", "250");

  let nextUrl: string | null = initUrl.toString();

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API error ${res.status}: ${text}`);
    }

    const data: ShopifyOrdersResponse = await res.json();

    for (const order of data.orders) {
      const orderDate = toDateStr(order.created_at);
      const customerCreatedDate = order.customer?.created_at
        ? toDateStr(order.customer.created_at)
        : null;

      allOrders.push({
        id: order.id,
        createdAt: order.created_at,
        totalPrice: parseFloat(order.total_price),
        isNewCustomer: customerCreatedDate === orderDate,
        customerId: order.customer?.id ? String(order.customer.id) : null,
        customerEmail: order.customer?.email || null,
        utm: extractUtmFromNoteAttributes(order.note_attributes),
      });
    }

    nextUrl = parseNextLink(res.headers.get("Link"));
  }

  return allOrders;
}
