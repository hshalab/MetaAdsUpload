import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, desc, sql } from "drizzle-orm";

// Helper: validate token and return share link
async function validateToken(token: string, request: NextRequest) {
  const [link] = await db
    .select()
    .from(schema.shareLinks)
    .where(eq(schema.shareLinks.token, token));

  if (!link) return { error: "Link not found", status: 404 };
  if (!link.isActive) return { error: "This link has been deactivated", status: 410 };
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return { error: "This link has expired", status: 410 };

  // Check password via header
  if (link.password) {
    const providedPassword = request.headers.get("x-review-password");
    if (!providedPassword) return { error: "Password required", status: 401 };
    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(providedPassword, link.password);
    if (!valid) return { error: "Invalid password", status: 401 };
  }

  return { link };
}

// GET /api/review/:token/comments — list external comments (no auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await validateToken(token, request);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { link } = result;
    const versionId = request.nextUrl.searchParams.get("versionId");

    // If no versionId, get the current version from the assignment
    let targetVersionId = versionId;
    if (!targetVersionId) {
      const [assignment] = await db
        .select()
        .from(schema.assignments)
        .where(eq(schema.assignments.id, link.assignmentId));
      targetVersionId = assignment?.currentVersionId || null;
    }

    if (!targetVersionId) {
      return NextResponse.json([]);
    }

    // Fetch only non-internal comments
    const allComments = await db
      .select({
        id: schema.reviewComments.id,
        deliverableVersionId: schema.reviewComments.deliverableVersionId,
        parentCommentId: schema.reviewComments.parentCommentId,
        authorId: schema.reviewComments.authorId,
        guestName: schema.reviewComments.guestName,
        body: schema.reviewComments.body,
        timecodeSeconds: schema.reviewComments.timecodeSeconds,
        annotation: schema.reviewComments.annotation,
        isInternal: schema.reviewComments.isInternal,
        isResolved: schema.reviewComments.isResolved,
        reactions: schema.reviewComments.reactions,
        mentionedUserIds: schema.reviewComments.mentionedUserIds,
        createdAt: schema.reviewComments.createdAt,
        updatedAt: schema.reviewComments.updatedAt,
        authorName: schema.users.name,
      })
      .from(schema.reviewComments)
      .leftJoin(schema.users, eq(schema.reviewComments.authorId, schema.users.id))
      .where(
        sql`${schema.reviewComments.deliverableVersionId} = ${targetVersionId} AND ${schema.reviewComments.isInternal} = false`
      )
      .orderBy(desc(schema.reviewComments.createdAt));

    // Build threaded structure
    type CommentNode = typeof allComments[0] & { replies: CommentNode[] };
    const commentMap = new Map<string, CommentNode>();
    const roots: CommentNode[] = [];

    for (const c of allComments) {
      commentMap.set(c.id, { ...c, replies: [] });
    }

    for (const c of allComments) {
      const node = commentMap.get(c.id)!;
      if (c.parentCommentId && commentMap.has(c.parentCommentId)) {
        commentMap.get(c.parentCommentId)!.replies.push(node);
      } else {
        roots.push(node);
      }
    }

    function formatComment(c: typeof roots[0]): Record<string, unknown> {
      return {
        id: c.id,
        deliverableVersionId: c.deliverableVersionId,
        parentCommentId: c.parentCommentId,
        authorId: c.authorId,
        author: c.authorId ? { id: c.authorId, name: c.authorName || "Unknown" } : null,
        guestName: c.guestName,
        body: c.body,
        timecodeSeconds: c.timecodeSeconds,
        annotation: c.annotation,
        isInternal: c.isInternal,
        isResolved: c.isResolved,
        reactions: c.reactions,
        mentionedUserIds: c.mentionedUserIds,
        replies: c.replies.map(formatComment),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    }

    return NextResponse.json(roots.map(formatComment));
  } catch (error) {
    console.error("Public comments GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST /api/review/:token/comments — add a guest comment (no auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await validateToken(token, request);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { link } = result;

    if (!link.allowComments) {
      return NextResponse.json({ error: "Comments are disabled for this link" }, { status: 403 });
    }

    const body = await request.json();
    const { versionId, parentCommentId, guestName, bodyText, timecodeSeconds, annotation } = body;

    if (!bodyText) {
      return NextResponse.json({ error: "bodyText is required" }, { status: 400 });
    }
    if (!guestName) {
      return NextResponse.json({ error: "guestName is required" }, { status: 400 });
    }

    // Get target version
    let targetVersionId = versionId;
    if (!targetVersionId) {
      const [assignment] = await db
        .select()
        .from(schema.assignments)
        .where(eq(schema.assignments.id, link.assignmentId));
      targetVersionId = assignment?.currentVersionId || null;
    }

    if (!targetVersionId) {
      return NextResponse.json({ error: "No version available for comments" }, { status: 400 });
    }

    // Verify the version exists and belongs to this assignment
    const [version] = await db
      .select()
      .from(schema.deliverableVersions)
      .where(eq(schema.deliverableVersions.id, targetVersionId));

    if (!version || version.assignmentId !== link.assignmentId) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const [comment] = await db
      .insert(schema.reviewComments)
      .values({
        deliverableVersionId: targetVersionId,
        parentCommentId: parentCommentId || null,
        authorId: null, // guest
        guestName,
        body: bodyText,
        timecodeSeconds: timecodeSeconds ?? null,
        annotation: annotation || null,
        isInternal: false, // guest comments are always external
      })
      .returning();

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Public comments POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create comment" },
      { status: 500 }
    );
  }
}
