import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, desc, sql } from "drizzle-orm";

// Shared helper: validate link exists, is active, and not expired
async function validateLink(token: string) {
  const [link] = await db
    .select()
    .from(schema.shareLinks)
    .where(eq(schema.shareLinks.token, token));

  if (!link) {
    return { error: NextResponse.json({ error: "Link not found" }, { status: 404 }) };
  }

  if (!link.isActive) {
    return { error: NextResponse.json({ error: "This link has been deactivated" }, { status: 410 }) };
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return { error: NextResponse.json({ error: "This link has expired" }, { status: 410 }) };
  }

  return { link };
}

// Shared helper: fetch the full review payload for a validated link
async function buildReviewPayload(link: typeof schema.shareLinks.$inferSelect) {
  // Update access stats
  await db
    .update(schema.shareLinks)
    .set({
      accessCount: sql`${schema.shareLinks.accessCount} + 1`,
      lastAccessedAt: new Date(),
    })
    .where(eq(schema.shareLinks.id, link.id));

  // Fetch assignment with related data
  const [assignment] = await db
    .select({
      id: schema.assignments.id,
      title: schema.assignments.title,
      autoName: schema.assignments.autoName,
      batchNumber: schema.assignments.batchNumber,
      status: schema.assignments.status,
      priority: schema.assignments.priority,
      deliverableUrl: schema.assignments.deliverableUrl,
      currentVersionId: schema.assignments.currentVersionId,
      dueDate: schema.assignments.dueDate,
      createdAt: schema.assignments.createdAt,
      assignedToName: schema.users.name,
    })
    .from(schema.assignments)
    .leftJoin(schema.users, eq(schema.assignments.assignedToId, schema.users.id))
    .where(eq(schema.assignments.id, link.assignmentId));

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  // Fetch versions
  const versions = await db
    .select()
    .from(schema.deliverableVersions)
    .where(eq(schema.deliverableVersions.assignmentId, link.assignmentId))
    .orderBy(desc(schema.deliverableVersions.versionNumber));

  // Fetch external (non-internal) comment counts per version
  const commentCounts = versions.length > 0
    ? await db
        .select({
          deliverableVersionId: schema.reviewComments.deliverableVersionId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.reviewComments)
        .where(
          sql`${schema.reviewComments.deliverableVersionId} IN (${sql.join(
            versions.map((v) => sql`${v.id}`),
            sql`, `
          )}) AND ${schema.reviewComments.isInternal} = false`
        )
        .groupBy(schema.reviewComments.deliverableVersionId)
    : [];

  const countMap = Object.fromEntries(commentCounts.map((c) => [c.deliverableVersionId, c.count]));

  return NextResponse.json({
    assignment: {
      ...assignment,
      assignedTo: { name: assignment.assignedToName || "Unknown" },
    },
    versions: versions.map((v) => ({
      ...v,
      commentCount: countMap[v.id] || 0,
    })),
    allowComments: link.allowComments,
  });
}

// GET /api/review/:token — public review page data (no auth required)
// If password-protected, returns 401 with {requiresPassword: true}
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await validateLink(token);
    if ("error" in result) return result.error;
    const { link } = result;

    // If link is password-protected, tell the client to POST with password
    if (link.password) {
      return NextResponse.json({ requiresPassword: true }, { status: 401 });
    }

    return await buildReviewPayload(link);
  } catch (error) {
    console.error("Public review GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load review" },
      { status: 500 }
    );
  }
}

// POST /api/review/:token — verify password and return review data
// Body: { password: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await validateLink(token);
    if ("error" in result) return result.error;
    const { link } = result;

    if (!link.password) {
      // No password required — just return the data
      return await buildReviewPayload(link);
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, link.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    return await buildReviewPayload(link);
  } catch (error) {
    console.error("Public review POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load review" },
      { status: 500 }
    );
  }
}
