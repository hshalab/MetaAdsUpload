import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { checkRateLimit } from "@/lib/rate-limit";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getR2Client, getR2PublicUrl } from "@/lib/r2";

/**
 * Extract batch ID from naming convention.
 * "H1 - SE Josiah Jan194 - #1 - STATIC - LP11 - Evergreen - LickingPaws - Josiah.png" → "Jan194"
 */
function extractBatchId(filename: string): string | null {
  const match = filename.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d+)\b/);
  return match ? match[1] + match[2] : null;
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, 10, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { filename, contentType, fileSize, assignmentId, purpose, tags, batchNumber: rawBatch } = body as {
      filename: string;
      contentType: string;
      fileSize?: number;
      assignmentId?: string;
      purpose?: "deliverable" | "library" | "version";
      tags?: string[];
      batchNumber?: string;
    };

    // Auto-extract batch ID from naming convention if not explicitly provided
    // Pattern: "H1 - SE Josiah Jan194 - #1 - STATIC - ..." → "Jan194"
    const batchNumber = rawBatch || extractBatchId(filename);

    if (!filename || !contentType) {
      return NextResponse.json({ error: "filename and contentType are required" }, { status: 400 });
    }

    // H4: Allowlist content types
    const allowedContentTypes = [
      "video/mp4", "video/quicktime", "video/webm",
      "image/jpeg", "image/png", "image/webp",
    ];
    if (!allowedContentTypes.includes(contentType)) {
      return NextResponse.json(
        { error: `Invalid content type. Allowed: ${allowedContentTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // H4: Validate filename length
    if (filename.length > 255) {
      return NextResponse.json({ error: "Filename must be 255 characters or less" }, { status: 400 });
    }

    // H5: Validate file size (max 500MB)
    const MAX_FILE_SIZE = 999 * 1024 * 1024; // 999MB
    if (fileSize !== undefined && (typeof fileSize !== "number" || fileSize <= 0 || fileSize > MAX_FILE_SIZE)) {
      return NextResponse.json({ error: "File size must be between 1 byte and 999MB" }, { status: 400 });
    }

    const bucketName = process.env.R2_BUCKET_NAME?.trim();
    const publicUrl = getR2PublicUrl();

    if (!bucketName) {
      return NextResponse.json({ error: "R2_BUCKET_NAME not configured" }, { status: 500 });
    }

    // Generate unique key
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const isLibrary = purpose === "library";
    const isVersion = purpose === "version";

    let key = isLibrary
      ? `library/${timestamp}-${sanitizedFilename}`
      : `deliverables/${timestamp}-${sanitizedFilename}`;

    // If assignmentId provided, build folder structure: editor/Batch_N/file
    if (assignmentId && !isLibrary) {
      const [assignment] = await db
        .select({
          batchNumber: schema.assignments.batchNumber,
          editorName: schema.users.name,
        })
        .from(schema.assignments)
        .innerJoin(schema.users, eq(schema.users.id, schema.assignments.assignedToId))
        .where(eq(schema.assignments.id, assignmentId))
        .limit(1);

      if (assignment) {
        const sanitizedEditorName = assignment.editorName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const batchFolder = `Batch_${assignment.batchNumber}`;
        key = `deliverables/${sanitizedEditorName}/${batchFolder}/${timestamp}-${sanitizedFilename}`;
      }
    }

    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize || undefined,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    const finalPublicUrl = publicUrl ? `${publicUrl}/${key}` : key;

    // Auto-create creatives record for library uploads
    let creativeId: number | undefined;
    if (isLibrary) {
      const isImage = /^image\//.test(contentType);
      const [creative] = await db.insert(schema.creatives).values({
        name: filename,
        type: isImage ? "image" : "video",
        source: "r2",
        r2Key: key,
        r2Url: finalPublicUrl,
        fileSize: fileSize || null,
        tags: tags || [],
        batchNumber: batchNumber || null,
        editorName: session.user.name || null,
        status: "uploaded",
      }).returning();
      creativeId = creative.id;
    }

    return NextResponse.json({
      uploadUrl,
      publicUrl: finalPublicUrl,
      key,
      ...(creativeId !== undefined && { creativeId }),
    });
  } catch (error) {
    console.error("Presign error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
