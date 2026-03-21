import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup old entries every 60 seconds to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Get the client IP address from the request.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}

/**
 * Check rate limit for a request. Returns null if within limits,
 * or a 429 NextResponse if the limit is exceeded.
 *
 * @param request - The incoming NextRequest
 * @param limit - Maximum number of requests allowed within the window
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @param prefix - Optional prefix to namespace the rate limit key (e.g., route path)
 */
export function checkRateLimit(
  request: NextRequest,
  limit: number,
  windowMs: number = 60_000,
  prefix?: string
): NextResponse | null {
  cleanup();

  const ip = getClientIp(request);
  const key = prefix ? `${prefix}:${ip}` : `${request.nextUrl.pathname}:${ip}`;
  const now = Date.now();

  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // First request in this window or window has expired
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > limit) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(entry.resetTime),
        },
      }
    );
  }

  return null;
}
