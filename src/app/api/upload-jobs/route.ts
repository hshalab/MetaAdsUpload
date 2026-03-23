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
