import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import * as bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/bonus";

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, 5, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { name, email, password, userType, inviteCode } = body;

    // Invite gate: with REGISTRATION_INVITE_CODE set, the code is required.
    // In production WITHOUT a configured code, registration is closed —
    // an ops tool must never expose open self-signup.
    const requiredCode = process.env.REGISTRATION_INVITE_CODE;
    if (requiredCode) {
      if (inviteCode !== requiredCode) {
        return NextResponse.json({ error: "A valid invite code is required" }, { status: 403 });
      }
    } else if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Registration is closed. Ask your admin for an invite (set REGISTRATION_INVITE_CODE to enable)." },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate userType
    const validUserTypes = ["video_editor", "creative_strategist"];
    if (!userType || !validUserTypes.includes(userType)) {
      return NextResponse.json(
        { error: "Please select a valid user type" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate a unique public slug for the editor's /e/[slug] page.
    let slug: string | undefined = slugify(name.trim());
    if (slug) {
      const existingSlugs = await db.select({ slug: users.slug }).from(users).where(eq(users.slug, slug));
      if (existingSlugs.length > 0) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // Create user
    await db.insert(users).values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "editor",
      userType,
      slug: slug || null,
      isActive: true,
    });

    return NextResponse.json(
      { message: "Account created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
