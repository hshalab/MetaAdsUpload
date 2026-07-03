import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, ilike, or, desc, asc, sql, inArray } from "drizzle-orm";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { getCreativeMetrics, type CreativeMetrics } from "@/lib/creative-metrics";

const METRIC_SORTS: Record<string, { key: keyof CreativeMetrics; dir: 1 | -1 }> = {
  stars_desc: { key: "stars", dir: -1 },
  spend_desc: { key: "spend", dir: -1 },
  roas_desc: { key: "roas", dir: -1 },
  hook_desc: { key: "hookRate", dir: -1 },
  hold_desc: { key: "holdRate", dir: -1 },
  ctr_desc: { key: "ctr", dir: -1 },
};

// Metric sorting needs the whole filtered set aggregated before pagination —
// capped so a huge library can't blow up the request.
const METRIC_SORT_MAX_ROWS = 2000;

const WINNER_CLASSIFICATIONS = new Set(["breakthrough", "spend_winner", "kpi_winner"]);

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
    if (batch) conditions.push(ilike(schema.creatives.batchNumber, `%${batch}%`));
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
    const angleId = searchParams.get("angleId");
    if (angleId) {
      // Filter by the angle of the assignment the creative belongs to
      conditions.push(sql`${schema.creatives.assignmentId} IN (SELECT id FROM assignments WHERE angle_id = ${angleId})`);
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
    const days = Math.max(0, parseInt(searchParams.get("days") || "30"));
    const metricSort = METRIC_SORTS[sort];
    const winnersOnly = searchParams.get("winners") === "1";

    if (metricSort || winnersOnly) {
      // 1. All matching ids (capped) → 2. aggregate → 3. sort → 4. paginate
      const idRows = await db
        .select({ id: schema.creatives.id })
        .from(schema.creatives)
        .where(where)
        .orderBy(desc(schema.creatives.createdAt))
        .limit(METRIC_SORT_MAX_ROWS);
      let allIds = idRows.map((r) => r.id);
      const metricsMap = await getCreativeMetrics(allIds, days);

      if (winnersOnly) {
        allIds = allIds.filter((id) => {
          const c = metricsMap.get(id)?.classification;
          return c != null && WINNER_CLASSIFICATIONS.has(c);
        });
      }

      const effectiveSort = metricSort ?? METRIC_SORTS.spend_desc;
      const sorted = [...allIds].sort((a, b) => {
        const ma = metricsMap.get(a);
        const mb = metricsMap.get(b);
        // creatives with no linked ads always sink to the bottom
        if (!ma?.adCount && !mb?.adCount) return 0;
        if (!ma?.adCount) return 1;
        if (!mb?.adCount) return -1;
        const va = (ma[effectiveSort.key] as number | null) ?? -Infinity;
        const vb = (mb[effectiveSort.key] as number | null) ?? -Infinity;
        return effectiveSort.dir === -1 ? vb - va : va - vb;
      });

      const pageIds = sorted.slice(offset, offset + limit);
      const rows = pageIds.length
        ? await db.select().from(schema.creatives).where(and(where, inArray(schema.creatives.id, pageIds))!)
        : [];
      const rowById = new Map(rows.map((r) => [r.id, r]));
      const data = pageIds
        .map((id) => rowById.get(id))
        .filter(Boolean)
        .map((row) => ({ ...row!, metrics: metricsMap.get(row!.id) ?? null }));

      return NextResponse.json({
        data,
        pagination: {
          page,
          limit,
          total: allIds.length,
          totalPages: Math.ceil(allIds.length / limit),
        },
      });
    }

    const [rows, countResult] = await Promise.all([
      db.select().from(schema.creatives).where(where).orderBy(orderClause).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(schema.creatives).where(where),
    ]);

    // Attach performance metrics for the returned page (one aggregate query)
    const metricsMap = await getCreativeMetrics(rows.map((r) => r.id), days);
    const data = rows.map((row) => ({ ...row, metrics: metricsMap.get(row.id) ?? null }));

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

// DELETE — Soft delete (archive) or hard delete. Supports single id or array of ids.
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, ids, hard } = body as { id?: number; ids?: number[]; hard?: boolean };

    const idsToDelete = ids || (id ? [id] : []);
    if (idsToDelete.length === 0) return NextResponse.json({ error: "id or ids is required" }, { status: 400 });

    for (const deleteId of idsToDelete) {
      if (hard) {
        // Hard delete: remove from R2 + DB
        const [creative] = await db.select().from(schema.creatives).where(eq(schema.creatives.id, deleteId));
        if (creative?.r2Key) {
          const bucketName = process.env.R2_BUCKET_NAME?.trim();
          if (bucketName) {
            try {
              const client = getR2Client();
              await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: creative.r2Key }));
            } catch (e) {
              console.error("R2 delete failed for", creative.r2Key, e);
            }
          }
        }
        await db.delete(schema.creatives).where(eq(schema.creatives.id, deleteId));
      } else {
        // Soft delete: set status to archived
        await db.update(schema.creatives).set({ status: "archived" }).where(eq(schema.creatives.id, deleteId));
      }
    }

    return NextResponse.json({ success: true, deleted: idsToDelete.length });
  } catch (error) {
    console.error("Library DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
