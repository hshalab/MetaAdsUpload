import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import { getEditorsOverview, getEditorTimeseries } from "@/lib/editor-stats";

// Public — no auth. Returns one editor's performance by slug.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

    // Find the user behind this slug (for the optional password gate).
    const [user] = await db.select().from(schema.users).where(eq(schema.users.slug, slug));
    if (!user) {
      return NextResponse.json({ error: "Editor hittades inte" }, { status: 404 });
    }

    // Optional password protection.
    if (user.publicPagePassword) {
      const pw = searchParams.get("pw") || request.headers.get("x-page-password") || "";
      if (!pw) return NextResponse.json({ passwordRequired: true }, { status: 401 });
      const ok = await bcrypt.compare(pw, user.publicPagePassword);
      if (!ok) return NextResponse.json({ passwordRequired: true, error: "Fel lösenord" }, { status: 401 });
    }

    const overview = await getEditorsOverview({ from, to });
    const editor = overview.editors.find((e) => e.slug === slug || e.editorId === user.id);

    if (!editor) {
      // Known user but no owned ads / data yet.
      return NextResponse.json({
        editor: {
          editorId: user.id,
          editor: user.name.split(" ")[0],
          fullName: user.name,
          slug: user.slug,
          userType: user.userType || "video_editor",
          totalSpend: 0,
          totalPurchaseValue: 0,
          totalPurchases: 0,
          totalImpressions: 0,
          roas: 0,
          ctr: 0,
          hookRate: 0,
          totalBonus: 0,
          paidAmount: 0,
          pendingAmount: 0,
          unpaidAmount: 0,
          adCount: 0,
          winnerCount: 0,
          ads: [],
          payouts: [],
        },
        timeseries: [],
        leaderboard: overview.leaderboard,
        bonusTiers: overview.bonusTiers,
        dateRange: overview.dateRange,
      });
    }

    const timeseries = await getEditorTimeseries(
      editor.ads.map((a) => a.id),
      from,
      to
    );

    // Strip payout *notes* from the public payload (keep amounts/status).
    const safeEditor = {
      ...editor,
      payouts: editor.payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        periodFrom: p.periodFrom,
        periodTo: p.periodTo,
        paidAt: p.paidAt,
      })),
    };

    return NextResponse.json({
      editor: safeEditor,
      timeseries,
      leaderboard: overview.leaderboard,
      bonusTiers: overview.bonusTiers,
      dateRange: overview.dateRange,
    });
  } catch (error) {
    console.error("Public editor API error:", error);
    return NextResponse.json({ error: "Kunde inte ladda data" }, { status: 500 });
  }
}
