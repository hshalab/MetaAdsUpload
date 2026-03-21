import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { generateAutoName } from "@/lib/auto-name";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assignedToId = searchParams.get("assignedToId");
    const formatId = searchParams.get("formatId");
    const productId = searchParams.get("productId");

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    const conditions = [];

    // Non-admins can only see their own assignments
    if (userRole !== "admin") {
      conditions.push(eq(schema.assignments.assignedToId, userId));
    } else if (assignedToId) {
      conditions.push(eq(schema.assignments.assignedToId, assignedToId));
    }

    if (status) conditions.push(eq(schema.assignments.status, status));
    if (priority) conditions.push(eq(schema.assignments.priority, priority));
    if (formatId) conditions.push(eq(schema.assignments.formatId, formatId));
    if (productId) conditions.push(eq(schema.assignments.productId, productId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const assignments = await db
      .select()
      .from(schema.assignments)
      .where(whereClause)
      .orderBy(
        asc(schema.assignments.priority),
        asc(schema.assignments.dueDate),
        desc(schema.assignments.createdAt)
      );

    // Get total tracked seconds for each assignment
    const assignmentIds = assignments.map(a => a.id);
    let timeMap = new Map<string, number>();

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
            sql`${schema.timeEntries.assignmentId} = ANY(${assignmentIds})`
          )
        )
        .groupBy(schema.timeEntries.assignmentId);

      for (const ts of timeSums) {
        if (ts.assignmentId) timeMap.set(ts.assignmentId, ts.total);
      }
    }

    // Look up related entity names for each assignment
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
      totalTrackedSeconds: timeMap.get(a.id) || 0,
      assignedTo: userMap.get(a.assignedToId) || null,
      assignedBy: userMap.get(a.assignedById) || null,
      creativeStrategist: a.creativeStrategistId ? userMap.get(a.creativeStrategistId) || null : null,
      angle: a.angleId ? angleMap.get(a.angleId) || null : null,
      format: a.formatId ? formatMap.get(a.formatId) || null : null,
      product: a.productId ? productMap.get(a.productId) || null : null,
      country: a.countryId ? countryMap.get(a.countryId) || null : null,
      offerType: a.offerTypeId ? offerTypeMap.get(a.offerTypeId) || null : null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Assignments GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, 20, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const userId = (session.user as any).id;
    const body = await request.json();
    const {
      batchNumber,
      version = 1,
      formatId,
      angleId,
      productId,
      countryId,
      offerTypeId,
      customerAvatarIds = [],
      landingPage,
      assignedToId,
      creativeStrategistId,
      priority = "medium",
      dueDate,
      estimatedMinutes,
      description,
      scriptContent,
    } = body;

    if (!batchNumber || !assignedToId) {
      return NextResponse.json({ error: "Batch number and assignedToId are required" }, { status: 400 });
    }

    // H2: Input validation
    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ error: "Priority must be one of: low, medium, high, urgent" }, { status: 400 });
    }
    if (!Number.isInteger(batchNumber) || batchNumber <= 0) {
      return NextResponse.json({ error: "batchNumber must be a positive integer" }, { status: 400 });
    }
    if (estimatedMinutes !== undefined && (!Number.isInteger(estimatedMinutes) || estimatedMinutes <= 0)) {
      return NextResponse.json({ error: "estimatedMinutes must be a positive integer" }, { status: 400 });
    }
    if (description !== undefined) {
      if (typeof description !== "string" || description.length > 5000) {
        return NextResponse.json({ error: "description must be a string (max 5000 chars)" }, { status: 400 });
      }
    }

    // Verify editor exists
    const editor = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, assignedToId));
    if (editor.length === 0) {
      return NextResponse.json({ error: "Assigned editor not found" }, { status: 400 });
    }

    const now = new Date();
    const autoName = await generateAutoName({
      batchNumber,
      formatId: formatId || null,
      angleId: angleId || null,
      productId: productId || null,
      countryId: countryId || null,
      offerTypeId: offerTypeId || null,
      landingPage: landingPage || null,
      assignedToId,
      creativeStrategistId: creativeStrategistId || null,
      videoLengthSeconds: null,
      createdAt: now,
    });

    const [assignment] = await db
      .insert(schema.assignments)
      .values({
        title: `BATCH ${batchNumber}`,
        description: description || null,
        batchNumber,
        version,
        formatId: formatId || null,
        angleId: angleId || null,
        productId: productId || null,
        countryId: countryId || null,
        offerTypeId: offerTypeId || null,
        customerAvatarIds,
        landingPage: landingPage || null,
        assignedToId,
        assignedById: userId,
        creativeStrategistId: creativeStrategistId || null,
        status: "ready_for_editing",
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedMinutes: estimatedMinutes || null,
        scriptContent: scriptContent || null,
        autoName,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error("Assignments POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create assignment" },
      { status: 500 }
    );
  }
}
