import { NextResponse } from "next/server";
import { parseSie, validateSie } from "@/lib/sie/parser";
import { db } from "@/db";
import { vouchers, voucherLines } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read file content as text (SIE files are typically Latin-1/CP437)
    const buffer = await file.arrayBuffer();
    let content: string;
    try {
      // Try UTF-8 first
      content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      // Fallback to Latin-1
      content = new TextDecoder("iso-8859-1").decode(buffer);
    }

    // Parse SIE file
    const sieFile = parseSie(content);

    if (sieFile.vouchers.length === 0) {
      return NextResponse.json(
        { imported: 0, skipped: 0, errors: ["No vouchers found in file"] },
        { status: 400 }
      );
    }

    // Validate
    const validationErrors = validateSie(sieFile);
    const balanceErrors = validationErrors.filter((e) =>
      e.message.includes("does not balance")
    );
    if (balanceErrors.length > 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        errors: balanceErrors.map(
          (e) => `${e.voucher}: ${e.message}`
        ),
        warnings: validationErrors
          .filter((e) => !e.message.includes("does not balance"))
          .map((e) => `${e.voucher}: ${e.message}`),
      });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const voucher of sieFile.vouchers) {
      // Format date: YYYYMMDD → YYYY-MM-DD
      const dateStr = voucher.date.length === 8
        ? `${voucher.date.slice(0, 4)}-${voucher.date.slice(4, 6)}-${voucher.date.slice(6, 8)}`
        : voucher.date;

      try {
        // Deduplication: check if voucher already exists (series + number + date)
        const existing = await db
          .select({ id: vouchers.id })
          .from(vouchers)
          .where(
            and(
              eq(vouchers.series, voucher.series),
              eq(vouchers.number, voucher.number),
              eq(vouchers.date, dateStr)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Insert voucher
        const voucherId = crypto.randomUUID();
        await db.insert(vouchers).values({
          id: voucherId,
          series: voucher.series,
          number: voucher.number,
          date: dateStr,
          description: voucher.description || null,
          fortnoxId: null,
          syncError: null,
        });

        // Insert voucher lines
        if (voucher.transactions.length > 0) {
          await db.insert(voucherLines).values(
            voucher.transactions.map((tx) => ({
              id: crypto.randomUUID(),
              voucherId,
              account: tx.account,
              amount: tx.amount,
              description: tx.description || null,
            }))
          );
        }

        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${voucher.series} ${voucher.number}: ${msg}`);
      }
    }

    // Non-balance validation warnings
    const warnings = validationErrors
      .filter((e) => !e.message.includes("does not balance"))
      .map((e) => `${e.voucher}: ${e.message}`);

    return NextResponse.json({
      imported,
      skipped,
      errors,
      warnings,
      totalInFile: sieFile.vouchers.length,
      accountsFound: sieFile.accounts.size,
    });
  } catch (err) {
    console.error("SIE upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "SIE upload failed" },
      { status: 500 }
    );
  }
}
