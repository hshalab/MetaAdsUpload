import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { guardAdmin } from "@/lib/auth-helpers";
import { invalidateAccountCache } from "@/lib/meta/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await guardAdmin();
  if (error) return error;

  try {
    const connections = await db.select().from(schema.metaConnections).orderBy(schema.metaConnections.createdAt);
    const active = connections.find((c) => c.isActive);
    return NextResponse.json({
      connections: connections.map((c) => ({
        id: c.id,
        name: c.name,
        facebookUserId: c.facebookUserId,
        adAccounts: c.adAccounts,
        activeAdAccountId: c.activeAdAccountId,
        pages: c.pages,
        activePageId: c.activePageId,
        pixelId: c.pixelId,
        isActive: c.isActive,
        tokenExpiresAt: c.tokenExpiresAt,
        createdAt: c.createdAt,
      })),
      active: active ? {
        id: active.id,
        name: active.name,
        activeAdAccountId: active.activeAdAccountId,
        activePageId: active.activePageId,
        pixelId: active.pixelId,
      } : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await guardAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const { id, activeAdAccountId, activePageId, pixelId, isActive } = body;

    if (!id) return NextResponse.json({ error: "Missing connection ID" }, { status: 400 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (activeAdAccountId !== undefined) updates.activeAdAccountId = activeAdAccountId;
    if (activePageId !== undefined) updates.activePageId = activePageId;
    if (pixelId !== undefined) updates.pixelId = pixelId;
    if (isActive !== undefined) {
      if (isActive) {
        await db.update(schema.metaConnections).set({ isActive: false });
      }
      updates.isActive = isActive;
    }

    await db.update(schema.metaConnections).set(updates).where(eq(schema.metaConnections.id, id));
    invalidateAccountCache();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await guardAdmin();
  if (error) return error;

  try {
    const { id } = await request.json();
    await db.delete(schema.metaConnections).where(eq(schema.metaConnections.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
