import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { type, ...data } = body;

    if (type === "desire") {
      const [result] = await db.update(schema.strategyDesires)
        .set({ name: data.name, description: data.description, updatedAt: new Date() })
        .where(eq(schema.strategyDesires.id, id))
        .returning();
      return NextResponse.json(result);
    }

    if (type === "sub_avatar") {
      const [result] = await db.update(schema.strategySubAvatars)
        .set({ name: data.name, behavior: data.behavior, updatedAt: new Date() })
        .where(eq(schema.strategySubAvatars.id, id))
        .returning();
      return NextResponse.json(result);
    }

    if (type === "angle") {
      const [result] = await db.update(schema.strategyAngles)
        .set({ name: data.name, description: data.description, updatedAt: new Date() })
        .where(eq(schema.strategyAngles.id, id))
        .returning();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Strategy avatar PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "desire") {
      await db.update(schema.strategyDesires)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.strategyDesires.id, id));
    } else if (type === "sub_avatar") {
      await db.update(schema.strategySubAvatars)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.strategySubAvatars.id, id));
    } else if (type === "angle") {
      await db.update(schema.strategyAngles)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.strategyAngles.id, id));
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Strategy avatar DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
