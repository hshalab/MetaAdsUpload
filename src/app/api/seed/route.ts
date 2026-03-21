import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, 3, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // C1: Require SEED_SECRET
    const seedSecret = process.env.SEED_SECRET;
    if (!seedSecret) {
      return NextResponse.json(
        { error: "SEED_SECRET is not configured" },
        { status: 500 }
      );
    }

    const requestSecret = request.nextUrl.searchParams.get("secret");
    if (requestSecret !== seedSecret) {
      return NextResponse.json(
        { error: "Invalid or missing secret" },
        { status: 401 }
      );
    }

    // Configurable admin credentials via env vars
    const adminEmail = process.env.ADMIN_EMAIL || "admin@apotekhunden.se";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    // Check if admin already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { message: "Admin user already exists", userId: existing.id },
        { status: 200 }
      );
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const [admin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        password: hashedPassword,
        name: "Admin",
        role: "admin",
        isActive: true,
      })
      .returning();

    return NextResponse.json(
      { message: "Admin user created", userId: admin.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}
