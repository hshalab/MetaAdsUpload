import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName) return NextResponse.json({ error: "R2_BUCKET_NAME not configured" }, { status: 500 });

    const prefix = request.nextUrl.searchParams.get("prefix") || "";
    const continuationToken = request.nextUrl.searchParams.get("cursor") || undefined;

    const client = getR2Client();
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix || undefined,
      Delimiter: "/",
      MaxKeys: 100,
      ContinuationToken: continuationToken,
    });

    const result = await client.send(command);

    // Folders (common prefixes)
    const folders = (result.CommonPrefixes || []).map((p) => ({
      name: p.Prefix?.replace(prefix, "").replace(/\/$/, "") || "",
      prefix: p.Prefix || "",
      type: "folder" as const,
    }));

    // Files
    const videoExts = [".mp4", ".mov", ".webm", ".avi", ".mkv"];
    const imageExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

    const files = (result.Contents || [])
      .filter((obj) => obj.Key && obj.Key !== prefix) // Skip the prefix itself
      .map((obj) => {
        const key = obj.Key!;
        const name = key.split("/").pop() || key;
        const ext = name.toLowerCase().substring(name.lastIndexOf("."));
        const isVideo = videoExts.includes(ext);
        const isImage = imageExts.includes(ext);

        return {
          key,
          name,
          size: obj.Size || 0,
          lastModified: obj.LastModified?.toISOString(),
          url: publicUrl ? `${publicUrl}/${key}` : key,
          type: "file" as const,
          mediaType: isVideo ? "video" : isImage ? "image" : "other",
        };
      })
      .filter((f) => f.mediaType !== "other"); // Only show media files

    return NextResponse.json({
      folders,
      files,
      nextCursor: result.NextContinuationToken || null,
      prefix,
    });
  } catch (error) {
    console.error("R2 browse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to browse R2" },
      { status: 500 }
    );
  }
}
