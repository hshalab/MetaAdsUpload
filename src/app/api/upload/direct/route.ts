import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2PublicUrl } from "@/lib/r2";

export const maxDuration = 120; // allow up to 120s for large files

// POST /api/upload/direct — server-side proxy upload to R2 (no CORS issues)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate content type
    const allowedTypes = [
      "video/mp4", "video/quicktime", "video/webm",
      "image/jpeg", "image/png", "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Otillåten filtyp: ${file.type}. Tillåtna: ${allowedTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const bucketName = process.env.R2_BUCKET_NAME?.trim();
    const publicUrl = getR2PublicUrl();
    if (!bucketName) {
      return NextResponse.json({ error: "R2_BUCKET_NAME not configured" }, { status: 500 });
    }

    // Generate key
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `library/${timestamp}-${sanitizedFilename}`;

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer());
    const client = getR2Client();

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ContentLength: buffer.length,
      })
    );

    const finalPublicUrl = publicUrl ? `${publicUrl}/${key}` : key;

    return NextResponse.json({
      key,
      publicUrl: finalPublicUrl,
      size: buffer.length,
    });
  } catch (error) {
    console.error("Direct upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
