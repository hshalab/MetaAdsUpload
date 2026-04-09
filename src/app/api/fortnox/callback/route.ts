import { NextRequest, NextResponse } from "next/server";
import { saveTokens } from "@/lib/fortnox/client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?error=no_code", request.url)
    );
  }

  const clientId = process.env.FORTNOX_CLIENT_ID?.trim();
  const clientSecret = process.env.FORTNOX_CLIENT_SECRET?.trim();
  const redirectUri = process.env.FORTNOX_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL("/settings?error=missing_fortnox_env", request.url)
    );
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenResponse = await fetch("https://apps.fortnox.se/oauth-v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Fortnox token exchange failed:", errorText);
      return NextResponse.redirect(
        new URL(`/settings?error=token_exchange_failed`, request.url)
      );
    }

    const data = await tokenResponse.json();

    await saveTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    });

    return NextResponse.redirect(
      new URL("/settings?fortnox=connected", request.url)
    );
  } catch (err) {
    console.error("Fortnox callback error:", err);
    return NextResponse.redirect(
      new URL("/settings?error=callback_exception", request.url)
    );
  }
}
