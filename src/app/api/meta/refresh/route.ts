import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { guardAdmin } from "@/lib/auth-helpers";
import { withAccount, getAccessToken, getActiveConnection, invalidateAccountCache } from "@/lib/meta/client";
import { fetchAdAccountsAndPages } from "@/lib/meta/assets";

export const dynamic = "force-dynamic";

/**
 * Re-fetch ad accounts + pages for an existing Meta connection and update the
 * stored lists in place, WITHOUT a full reconnect. Preserves the currently
 * selected ad account / page / pixel. Use this to pull in pages created or
 * granted after the original connect (e.g. a new brand page).
 */
export async function POST(request: NextRequest) {
  const { error } = await guardAdmin();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    let connId: number | undefined = typeof body?.id === "number" ? body.id : undefined;

    // Default to the active connection.
    if (!connId) {
      const active = await getActiveConnection();
      if (!active) return NextResponse.json({ error: "No active Meta connection to refresh." }, { status: 400 });
      connId = active.id;
    }

    const rows = await db
      .select()
      .from(schema.metaConnections)
      .where(eq(schema.metaConnections.id, connId))
      .limit(1);
    const conn = rows[0];
    if (!conn) return NextResponse.json({ error: "Connection not found." }, { status: 404 });

    // Resolve a (possibly refreshed) token scoped to this specific connection.
    const token = await withAccount(conn.id, () => getAccessToken());

    const { adAccounts, pages } = await fetchAdAccountsAndPages(token);

    // Keep the current selections if they still exist; otherwise fall back.
    const activePageId = pages.some((p) => p.id === conn.activePageId)
      ? conn.activePageId
      : (pages[0]?.id ?? null);
    const activeAdAccountId = adAccounts.some((a) => a.id === conn.activeAdAccountId)
      ? conn.activeAdAccountId
      : (adAccounts[0]?.id ?? null);

    const prevPageIds = new Set((conn.pages ?? []).map((p) => p.id));
    const newPages = pages.filter((p) => !prevPageIds.has(p.id));

    await db
      .update(schema.metaConnections)
      .set({ adAccounts, pages, activePageId, activeAdAccountId, updatedAt: new Date() })
      .where(eq(schema.metaConnections.id, conn.id));

    invalidateAccountCache();

    return NextResponse.json({
      success: true,
      pageCount: pages.length,
      adAccountCount: adAccounts.length,
      newPages: newPages.map((p) => p.name),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
