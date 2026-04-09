import { NextResponse } from "next/server";
import { parseBankCsv, detectBankFormat } from "@/lib/bank/parsers";
import { db } from "@/db";
import { bankTransactions } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const content = await file.text();
    const format = detectBankFormat(content);
    const transactions = parseBankCsv(content, format);

    if (transactions.length === 0) {
      return NextResponse.json(
        { imported: 0, format, error: "No transactions found in file" },
        { status: 400 }
      );
    }

    let imported = 0;
    const errors: string[] = [];

    for (const tx of transactions) {
      try {
        await db.insert(bankTransactions).values({
          id: crypto.randomUUID(),
          bankDate: tx.date,
          description: tx.description,
          amount: tx.amount,
          balance: tx.balance ?? null,
          bankFormat: format,
          matchedVoucherId: null,
          imported: false,
        });
        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${tx.date} ${tx.description}: ${msg}`);
      }
    }

    return NextResponse.json({
      imported,
      total: transactions.length,
      format,
      errors,
    });
  } catch (err) {
    console.error("Bank import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bank import failed" },
      { status: 500 }
    );
  }
}
