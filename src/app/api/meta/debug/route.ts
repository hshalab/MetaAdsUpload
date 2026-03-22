import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveConnection, getAdAccountId, getAccessToken, metaApi } from "@/lib/meta/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const steps: Record<string, unknown> = {};

  try {
    // Step 1: Auth
    const session = await auth();
    steps.auth = session?.user ? { ok: true, email: session.user.email, role: session.user.role } : { ok: false, reason: "No session" };
    if (!session?.user) return NextResponse.json({ steps }, { status: 401 });

    // Step 2: DB connection
    try {
      const conn = await getActiveConnection();
      steps.dbConnection = conn
        ? { ok: true, id: conn.id, adAccountId: conn.activeAdAccountId, tokenLength: conn.accessToken?.length, expiresAt: conn.tokenExpiresAt }
        : { ok: false, reason: "No active connection in meta_connections table" };
    } catch (err) {
      steps.dbConnection = { ok: false, error: String(err) };
    }

    // Step 3: Token
    try {
      const token = await getAccessToken();
      steps.token = { ok: true, length: token.length, start: token.substring(0, 10) + "..." };
    } catch (err) {
      steps.token = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    // Step 4: Ad account ID
    try {
      const adAccountId = await getAdAccountId();
      steps.adAccountId = { ok: true, value: adAccountId };
    } catch (err) {
      steps.adAccountId = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    // Step 5: Test Meta API - get campaigns
    try {
      const data = await metaApi<{ data?: Array<{ id: string; name: string; status: string }> }>(
        `/${await getAdAccountId()}/campaigns`,
        { params: { fields: "id,name,status", limit: 3 } }
      );
      steps.campaigns = { ok: true, count: data.data?.length || 0, sample: data.data?.slice(0, 2).map(c => ({ id: c.id, name: c.name, status: c.status })) };
    } catch (err) {
      steps.campaigns = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    // Step 6: Test Meta API - get insights
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const to = new Date().toISOString().split("T")[0];
    try {
      const data = await metaApi<{ data?: Array<{ campaign_id?: string; spend?: string; impressions?: string }> }>(
        `/${await getAdAccountId()}/insights`,
        {
          params: {
            fields: "campaign_id,spend,impressions,actions,action_values",
            level: "campaign",
            limit: 5,
            time_range: JSON.stringify({ since: from, until: to }),
          },
        }
      );
      steps.insights = {
        ok: true,
        count: data.data?.length || 0,
        sample: data.data?.slice(0, 3).map(r => ({
          campaign_id: r.campaign_id,
          spend: r.spend,
          impressions: r.impressions,
        })),
      };
    } catch (err) {
      steps.insights = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    return NextResponse.json({ ok: true, dateRange: { from, to }, steps });
  } catch (err) {
    steps.fatal = { error: err instanceof Error ? err.message : String(err) };
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }
}
