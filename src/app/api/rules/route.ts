import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { guardAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await guardAdmin();
  if (error) return error;

  try {
    const rules = await db.select().from(schema.automationRules).orderBy(schema.automationRules.createdAt);
    const executions = await db.select().from(schema.ruleExecutions).orderBy(schema.ruleExecutions.executedAt);
    return NextResponse.json({ rules, executions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error } = await guardAdmin();
  if (error) return error;

  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Rule name is required" }, { status: 400 });
    }
    if (!body.level || !["campaign", "adset", "ad"].includes(body.level)) {
      return NextResponse.json({ error: "Level must be campaign, adset, or ad" }, { status: 400 });
    }
    if (!Array.isArray(body.conditions) || !body.action) {
      return NextResponse.json({ error: "Conditions and action are required" }, { status: 400 });
    }

    const [rule] = await db.insert(schema.automationRules).values({
      name: body.name.trim(),
      level: body.level,
      conditions: body.conditions,
      action: body.action,
      cooldownHours: body.cooldownHours || 24,
      enabled: body.enabled ?? true,
    }).returning();
    return NextResponse.json(rule);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await guardAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const { id, ...rawUpdates } = body;

    if (!id || typeof id !== "number") {
      return NextResponse.json({ error: "Valid rule ID is required" }, { status: 400 });
    }

    // Whitelist allowed fields
    const allowedFields = ["name", "level", "conditions", "action", "cooldownHours", "enabled"] as const;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (field in rawUpdates) {
        updates[field] = rawUpdates[field];
      }
    }

    await db.update(schema.automationRules).set(updates).where(eq(schema.automationRules.id, id));
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
    if (!id || typeof id !== "number") {
      return NextResponse.json({ error: "Valid rule ID is required" }, { status: 400 });
    }
    await db.delete(schema.automationRules).where(eq(schema.automationRules.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
