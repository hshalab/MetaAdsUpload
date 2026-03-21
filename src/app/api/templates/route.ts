import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const templates = await db.select().from(schema.templates).orderBy(schema.templates.createdAt);
    return NextResponse.json({ data: templates });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // If marking as default, unset other defaults first
    if (body.isDefault) {
      await db.update(schema.templates).set({ isDefault: false });
    }

    const [template] = await db.insert(schema.templates).values({
      name: body.name,
      isDefault: body.isDefault || false,
      objective: body.objective,
      budgetType: body.budgetType,
      dailyBudget: body.dailyBudget,
      headlines: body.headlines || [],
      primaryTexts: body.primaryTexts || [],
      descriptions: body.descriptions || [],
      ctaType: body.ctaType,
      landingPages: body.landingPages || [],
      targetCountries: body.targetCountries || ["SE"],
      ageMin: body.ageMin || null,
      ageMax: body.ageMax || null,
      genders: body.genders || null,
      optimizationGoal: body.optimizationGoal,
      conversionEvent: body.conversionEvent,
      bidStrategy: body.bidStrategy,
      adsetNameTemplate: body.adsetNameTemplate,
      adNameTemplate: body.adNameTemplate,
      productName: body.productName || null,
      angleName: body.angleName || null,
      pixelId: body.pixelId || null,
    }).returning();
    return NextResponse.json(template);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create template" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (updates.isDefault) {
      await db.update(schema.templates).set({ isDefault: false });
    }

    const [template] = await db.update(schema.templates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.templates.id, id))
      .returning();
    return NextResponse.json(template);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    await db.delete(schema.templates).where(eq(schema.templates.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete template" }, { status: 500 });
  }
}
