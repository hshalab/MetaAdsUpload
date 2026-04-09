// ─── Auto-Booking Pipeline: Match bank transactions to vouchers ─────────────

import { db } from "@/db";
import { bankTransactions, vouchers, voucherLines } from "@/db/schema";
import { eq, and, between, isNull, sql } from "drizzle-orm";

export interface MatchResult {
  bankTransactionId: string;
  matchedVoucherId: string | null;
  confidence: "high" | "medium" | "none";
}

/**
 * Auto-match unmatched bank transactions against vouchers.
 *
 * Matching logic:
 * 1. Fetch bank transactions where matchedVoucherId IS NULL
 * 2. For each, find vouchers with a line on account "1930" whose amount
 *    matches the bank transaction amount (within ±0.01), and voucher date
 *    is within ±2 days of the bank transaction date.
 * 3. Exactly one match  → "high" confidence, link it
 * 4. Multiple matches   → "medium" confidence, pick closest date, link it
 * 5. No matches         → "none" confidence
 */
export async function autoMatchTransactions(): Promise<MatchResult[]> {
  // Step 1: Fetch all unmatched bank transactions
  const unmatched = await db
    .select()
    .from(bankTransactions)
    .where(isNull(bankTransactions.matchedVoucherId));

  if (unmatched.length === 0) return [];

  const results: MatchResult[] = [];

  for (const tx of unmatched) {
    // Compute date window: ±2 days from bankDate
    const txDate = new Date(tx.bankDate);
    const dateFrom = new Date(txDate);
    dateFrom.setDate(dateFrom.getDate() - 2);
    const dateTo = new Date(txDate);
    dateTo.setDate(dateTo.getDate() + 2);

    const dateFromStr = dateFrom.toISOString().slice(0, 10);
    const dateToStr = dateTo.toISOString().slice(0, 10);

    // Step 2: Find vouchers with a 1930-account line matching this amount
    // within ±0.01, and date within ±2 days
    const candidates = await db
      .select({
        voucherId: vouchers.id,
        voucherDate: vouchers.date,
        lineAmount: voucherLines.amount,
      })
      .from(vouchers)
      .innerJoin(voucherLines, eq(voucherLines.voucherId, vouchers.id))
      .where(
        and(
          eq(voucherLines.account, "1930"),
          between(vouchers.date, dateFromStr, dateToStr),
          between(
            voucherLines.amount,
            tx.amount - 0.01,
            tx.amount + 0.01
          )
        )
      );

    if (candidates.length === 0) {
      // Step 5: No match
      results.push({
        bankTransactionId: tx.id,
        matchedVoucherId: null,
        confidence: "none",
      });
      continue;
    }

    let confidence: "high" | "medium";
    let bestVoucherId: string;

    if (candidates.length === 1) {
      // Step 3: Exactly one match → high confidence
      confidence = "high";
      bestVoucherId = candidates[0].voucherId;
    } else {
      // Step 4: Multiple matches → medium confidence, pick closest date
      confidence = "medium";

      const txTime = txDate.getTime();
      let closest = candidates[0];
      let closestDelta = Math.abs(
        new Date(candidates[0].voucherDate).getTime() - txTime
      );

      for (let i = 1; i < candidates.length; i++) {
        const delta = Math.abs(
          new Date(candidates[i].voucherDate).getTime() - txTime
        );
        if (delta < closestDelta) {
          closestDelta = delta;
          closest = candidates[i];
        }
      }

      bestVoucherId = closest.voucherId;
    }

    // Update the bank transaction with the matched voucher
    await db
      .update(bankTransactions)
      .set({ matchedVoucherId: bestVoucherId })
      .where(eq(bankTransactions.id, tx.id));

    results.push({
      bankTransactionId: tx.id,
      matchedVoucherId: bestVoucherId,
      confidence,
    });
  }

  return results;
}
