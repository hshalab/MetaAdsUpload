import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, ilike, or, desc, asc, sql } from "drizzle-orm";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";

// GET — List library assets with filters & pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // video | image
    const status = searchParams.get("status"); // uploaded | in_review | approved | archived
    const editor = searchParams.get("editor");
    const batch = searchParams.get("batch");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const conditions = [];

    // Only show R2/library assets by default (not synced Meta assets)
    conditions.push(eq(schema.creatives.source, "r2"));

    if (type) conditions.push(eq(schema.creatives.type, type));
    if (status) conditions.push(eq(schema.creatives.status, status));
    else conditions.push(sql`${schema.creatives.status} != 'archived'`);
    if (editor) conditions.push(ilike(schema.creatives.editorName, `%${editor}%`));
    if (batch) conditions.push(eq(schema.creatives.batchNumber, parseInt(batch)));
    if (search) {
      conditions.push(
        or(
          ilike(schema.creatives.name, `%${search}%`),
          sql`${schema.creatives.tags}::text ILIKE ${"%" + search + "%"}`
        )!
      );
    }
    if (tag) {
      conditions.push(sql`${schema.creatives.tags}::jsonb ? ${tag}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Sort
    const sort = searchParams.get("sort") || "date_desc";
    const sortMap: Record<string, ReturnType<typeof desc>> = {
      date_desc: desc(schema.creatives.createdAt),
      date_asc: asc(schema.creatives.createdAt),
      name_asc: asc(schema.creatives.name),
      name_desc: desc(schema.creatives.name),
      size_desc: desc(schema.creatives.fileSize),
      size_asc: asc(schema.creatives.fileSize),
    };
    const orderClause = sortMap[sort] || sortMap.date_desc;

    const [data, countResult] = await Promise.all([
      db.select().from(schema.creatives).where(where).orderBy(orderClause).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(schema.creatives).where(where),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Library GET error:", error);
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }
}

// PATCH — Update asset metadata (tags, name, status)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, name, tags, status } = body as {
      id: number;
      name?: string;
      tags?: string[];
      status?: string;
    };

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (tags !== undefined) updates.tags = tags;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const [updated] = await db
      .update(schema.creatives)
      .set(updates)
      .where(eq(schema.creatives.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Library PATCH error:", error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

// DELETE — Soft delete (archive) or hard delete
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { id, hard } = body as { id: number; hard?: boolean };

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    if (hard) {
      // Hard delete: remove from R2 + DB
      const [creative] = await db.select().from(schema.creatives).where(eq(schema.creatives.id, id));
      if (creative?.r2Key) {
        const bucketName = process.env.R2_BUCKET_NAME?.trim();
        if (bucketName) {
          const client = getR2Client();
          await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: creative.r2Key }));
        }
      }
      await db.delete(schema.creatives).where(eq(schema.creatives.id, id));
    } else {
      // Soft delete: set status to archived
      await db.update(schema.creatives).set({ status: "archived" }).where(eq(schema.creatives.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Library DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
