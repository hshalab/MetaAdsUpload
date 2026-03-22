import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, sql, asc, inArray, notInArray } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const assignments = await db
      .select()
      .from(schema.assignments)
      .where(
        and(
          eq(schema.assignments.assignedToId, userId),
          notInArray(schema.assignments.status, ["ready_for_posting", "posted"])
        )
      )
      .orderBy(asc(schema.assignments.priority), asc(schema.assignments.dueDate));

    // Get time sums
    const assignmentIds = assignments.map(a => a.id);
    const timeMap = new Map<string, number>();

    if (assignmentIds.length > 0) {
      const timeSums = await db
        .select({
          assignmentId: schema.timeEntries.assignmentId,
          total: sql<number>`coalesce(sum(${schema.timeEntries.durationSeconds}), 0)`,
        })
        .from(schema.timeEntries)
        .where(
          and(
            eq(schema.timeEntries.status, "completed"),
            inArray(schema.timeEntries.assignmentId, assignmentIds)
          )
        )
        .groupBy(schema.timeEntries.assignmentId);

      for (const ts of timeSums) {
        if (ts.assignmentId) timeMap.set(ts.assignmentId, ts.total);
      }
    }

    // Enrich with related data
    const [allUsers, allAngles, allFormats, allProducts, allCountries, allOfferTypes] = await Promise.all([
      db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users),
      db.select({ id: schema.angles.id, name: schema.angles.name }).from(schema.angles),
      db.select({ id: schema.formats.id, name: schema.formats.name }).from(schema.formats),
      db.select({ id: schema.products.id, name: schema.products.name, code: schema.products.code }).from(schema.products),
      db.select({ id: schema.countries.id, name: schema.countries.name, code: schema.countries.code }).from(schema.countries),
      db.select({ id: schema.offerTypes.id, name: schema.offerTypes.name }).from(schema.offerTypes),
    ]);

    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const angleMap = new Map(allAngles.map(a => [a.id, a]));
    const formatMap = new Map(allFormats.map(f => [f.id, f]));
    const productMap = new Map(allProducts.map(p => [p.id, p]));
    const countryMap = new Map(allCountries.map(c => [c.id, c]));
    const offerTypeMap = new Map(allOfferTypes.map(o => [o.id, o]));

    const enriched = assignments.map(a => ({
      ...a,
      status: a.status.toUpperCase(),
      priority: a.priority.toUpperCase(),
      totalTrackedSeconds: timeMap.get(a.id) || 0,
      assignedTo: userMap.get(a.assignedToId) || { id: a.assignedToId, name: "Unknown", email: "" },
      assignedBy: userMap.get(a.assignedById) || { id: a.assignedById, name: "Unknown", email: "" },
      creativeStrategist: a.creativeStrategistId ? userMap.get(a.creativeStrategistId) || null : null,
      angle: a.angleId ? angleMap.get(a.angleId) || null : null,
      format: a.formatId ? formatMap.get(a.formatId) || null : null,
      product: a.productId ? productMap.get(a.productId) || null : null,
      country: a.countryId ? countryMap.get(a.countryId) || null : null,
      offerType: a.offerTypeId ? offerTypeMap.get(a.offerTypeId) || null : null,
    }));

    const needsAttention = enriched.filter(a => a.status === "REVISION");
    const active = enriched.filter(a => a.status === "EDITING_NOW");
    const pending = enriched.filter(a => a.status === "READY_FOR_EDITING");
    const inReview = enriched.filter(a => a.status === "READY_FOR_REVIEW");

    return NextResponse.json({
      needsAttention,
      active,
      pending,
      inReview,
      posted: [],
      total: assignments.length,
    });
  } catch (error) {
    console.error("My assignments GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}
