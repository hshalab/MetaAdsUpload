import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const desires = await db
      .select()
      .from(schema.strategyDesires)
      .where(eq(schema.strategyDesires.isActive, true))
      .orderBy(asc(schema.strategyDesires.sortOrder));

    const subAvatars = await db
      .select()
      .from(schema.strategySubAvatars)
      .where(eq(schema.strategySubAvatars.isActive, true))
      .orderBy(asc(schema.strategySubAvatars.sortOrder));

    const angles = await db
      .select()
      .from(schema.strategyAngles)
      .where(eq(schema.strategyAngles.isActive, true))
      .orderBy(asc(schema.strategyAngles.sortOrder));

    const tree = desires.map((d) => ({
      ...d,
      subAvatars: subAvatars
        .filter((sa) => sa.desireId === d.id)
        .map((sa) => ({
          ...sa,
          angles: angles.filter((a) => a.subAvatarId === sa.id),
        })),
    }));

    return NextResponse.json(tree);
  } catch (error) {
    console.error("Strategy avatars GET error:", error);
    return NextResponse.json({ error: "Failed to fetch avatars" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, ...data } = body;

    if (type === "desire") {
      const [result] = await db.insert(schema.strategyDesires).values({
        name: data.name,
        description: data.description || null,
        sortOrder: data.sortOrder || 0,
      }).returning();
      return NextResponse.json(result);
    }

    if (type === "sub_avatar") {
      const [result] = await db.insert(schema.strategySubAvatars).values({
        desireId: data.desireId,
        name: data.name,
        behavior: data.behavior || null,
        sortOrder: data.sortOrder || 0,
      }).returning();
      return NextResponse.json(result);
    }

    if (type === "angle") {
      const [result] = await db.insert(schema.strategyAngles).values({
        subAvatarId: data.subAvatarId,
        name: data.name,
        description: data.description || null,
        sortOrder: data.sortOrder || 0,
      }).returning();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Strategy avatars POST error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
