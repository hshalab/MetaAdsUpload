import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";

// GET /api/assignments/:id/comments — list comments for the current version (or a specific version)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const versionId = request.nextUrl.searchParams.get("versionId");

    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    // Any authenticated team member can view comments (no role restriction)

    const targetVersionId = versionId || assignment.currentVersionId;
    if (!targetVersionId) {
      return NextResponse.json([]);
    }

    // Fetch all comments for this version (root + replies)
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
      .where(eq(schema.reviewComments.deliverableVersionId, targetVersionId))
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

    // Format with author info
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
    console.error("Comments GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST /api/assignments/:id/comments — create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const reqBody = await request.json();
    const {
      versionId,
      parentCommentId,
      body: bodyField,
      bodyText,
      timecodeSeconds,
      annotation,
      isInternal,
      mentionedUserIds,
    } = reqBody;

    // Accept both "body" (frontend convention) and "bodyText" (legacy)
    const commentBody = bodyField || bodyText;
    if (!commentBody) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    const targetVersionId = versionId || assignment.currentVersionId;
    if (!targetVersionId) {
      return NextResponse.json({ error: "No version available for comments" }, { status: 400 });
    }

    // Verify the version exists
    const [version] = await db
      .select()
      .from(schema.deliverableVersions)
      .where(eq(schema.deliverableVersions.id, targetVersionId));
    if (!version || version.assignmentId !== id) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const [comment] = await db
      .insert(schema.reviewComments)
      .values({
        deliverableVersionId: targetVersionId,
        parentCommentId: parentCommentId || null,
        authorId: session.user.id!,
        body: commentBody,
        timecodeSeconds: timecodeSeconds ?? null,
        annotation: annotation || null,
        isInternal: isInternal !== false, // default true
        mentionedUserIds: mentionedUserIds || [],
      })
      .returning();

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Comments POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create comment" },
      { status: 500 }
    );
  }
}
