import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";

// GET /api/upload-jobs — list recent jobs or get single job by ?id=
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("id");

  if (jobId) {
    const job = await db.query.uploadJobs.findFirst({
      where: eq(schema.uploadJobs.id, Number(jobId)),
    });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(job);
  }

  // List recent jobs (last 50)
  const jobs = await db
    .select()
    .from(schema.uploadJobs)
    .orderBy(desc(schema.uploadJobs.createdAt))
    .limit(50);

  return NextResponse.json({ data: jobs });
}

// POST /api/upload-jobs — create a new job record (called at start of upload)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { filename, mediaType, campaignId, config } = body as {
    filename: string;
    mediaType: string;
    campaignId?: string;
    config?: Record<string, unknown>;
  };

  const [job] = await db
    .insert(schema.uploadJobs)
    .values({
      filename: filename || "unknown",
      mediaType: mediaType || "image",
      status: "pending",
      currentStep: 0,
      totalSteps: 4,
      stepLabel: "Waiting...",
      campaignId,
      config: config || {},
    })
    .returning();

  return NextResponse.json(job);
}

// PATCH /api/upload-jobs — update an existing job
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body as { id: number } & Record<string, unknown>;

  if (!id) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  await db
    .update(schema.uploadJobs)
    .set(updates)
    .where(eq(schema.uploadJobs.id, id));

  return NextResponse.json({ success: true });
}
