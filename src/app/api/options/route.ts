import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [angles, products, formats, countries, offerTypes, customerAvatars] = await Promise.all([
      db.select().from(schema.angles).where(eq(schema.angles.isActive, true)).orderBy(asc(schema.angles.sortOrder)),
      db.select().from(schema.products).where(eq(schema.products.isActive, true)).orderBy(asc(schema.products.sortOrder)),
      db.select().from(schema.formats).where(eq(schema.formats.isActive, true)).orderBy(asc(schema.formats.sortOrder)),
      db.select().from(schema.countries).where(eq(schema.countries.isActive, true)).orderBy(asc(schema.countries.sortOrder)),
      db.select().from(schema.offerTypes).where(eq(schema.offerTypes.isActive, true)).orderBy(asc(schema.offerTypes.sortOrder)),
      db.select().from(schema.customerAvatars).where(eq(schema.customerAvatars.isActive, true)).orderBy(asc(schema.customerAvatars.sortOrder)),
    ]);

    return NextResponse.json({ angles, products, formats, countries, offerTypes, customerAvatars });
  } catch (error) {
    console.error("Options GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch options" },
      { status: 500 }
    );
  }
}
