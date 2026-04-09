import { db } from "@/db";
import { vouchers, voucherLines } from "@/db/schema";
import { eq, isNull, asc, and, gt } from "drizzle-orm";
import { createVoucher } from "./client";
import { count, isNotNull } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SyncResult {
  success: boolean;
  fortnoxId?: string;
  error?: string;
}

interface BatchSyncResult {
  synced: number;
  failed: number;
  cursor: string | null;
  hasMore: boolean;
  errors: Array<{
    voucherId: string;
    series: string;
    number: number;
    error: string;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function is429Error(error: unknown): { retryAfter: number } | null {
  if (error instanceof Error && error.message.includes("(429)")) {
    // Try to extract Retry-After from the error message; fall back to 60s
    return { retryAfter: 60 };
  }
  return null;
}

// ─── syncVoucher ─────────────────────────────────────────────────────────────

export async function syncVoucher(voucherId: string): Promise<SyncResult> {
  // Fetch voucher
  const [voucher] = await db
    .select()
    .from(vouchers)
    .where(eq(vouchers.id, voucherId))
    .limit(1);

  if (!voucher) {
    return { success: false, error: `Voucher ${voucherId} not found` };
  }

  // Fetch lines
  const lines = await db
    .select()
    .from(voucherLines)
    .where(eq(voucherLines.voucherId, voucherId));

  if (lines.length === 0) {
    const errorMsg = "Voucher has no lines";
    await db
      .update(vouchers)
      .set({ syncError: errorMsg })
      .where(eq(vouchers.id, voucherId));
    return { success: false, error: errorMsg };
  }

  // Map lines to Fortnox format
  const voucherRows = lines.map((line) => ({
    Account: parseInt(line.account, 10),
    Debit: line.amount > 0 ? line.amount : 0,
    Credit: line.amount < 0 ? Math.abs(line.amount) : 0,
    ...(line.description ? { Description: line.description } : {}),
  }));

  try {
    const result = await createVoucher({
      Description: voucher.description || "",
      TransactionDate: voucher.date,
      VoucherSeries: voucher.series,
      VoucherNumber: voucher.number,
      VoucherRows: voucherRows,
    });

    const fortnoxId = String(result.VoucherNumber);

    // Update voucher with Fortnox ID and clear any previous sync error
    await db
      .update(vouchers)
      .set({ fortnoxId, syncError: null })
      .where(eq(vouchers.id, voucherId));

    return { success: true, fortnoxId };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown sync error";

    // Persist the error on the voucher row
    await db
      .update(vouchers)
      .set({ syncError: errorMsg })
      .where(eq(vouchers.id, voucherId));

    return { success: false, error: errorMsg };
  }
}

// ─── batchSync ───────────────────────────────────────────────────────────────

export async function batchSync(
  options: { batchSize?: number; cursor?: string } = {}
): Promise<BatchSyncResult> {
  const batchSize = options.batchSize ?? 200;

  // Build conditions: fortnoxId IS NULL, optionally after cursor
  const conditions = [isNull(vouchers.fortnoxId)];
  if (options.cursor) {
    conditions.push(gt(vouchers.id, options.cursor));
  }

  // Fetch the batch of unsynced vouchers
  const unsyncedVouchers = await db
    .select({
      id: vouchers.id,
      series: vouchers.series,
      number: vouchers.number,
    })
    .from(vouchers)
    .where(and(...conditions))
    .orderBy(asc(vouchers.date), asc(vouchers.id))
    .limit(batchSize + 1); // fetch one extra to detect hasMore

  const hasMore = unsyncedVouchers.length > batchSize;
  const batch = hasMore
    ? unsyncedVouchers.slice(0, batchSize)
    : unsyncedVouchers;

  let synced = 0;
  let failed = 0;
  const errors: BatchSyncResult["errors"] = [];
  let lastProcessedId: string | null = null;

  for (const v of batch) {
    let retriesLeft = 2;
    let result: SyncResult | null = null;

    while (true) {
      result = await syncVoucher(v.id);

      if (!result.success && result.error) {
        const rateLimited = is429Error(new Error(result.error));
        if (rateLimited && retriesLeft > 0) {
          retriesLeft--;
          await delay(rateLimited.retryAfter * 1000);
          continue;
        }
      }

      break;
    }

    if (result!.success) {
      synced++;
    } else {
      failed++;
      errors.push({
        voucherId: v.id,
        series: v.series,
        number: v.number,
        error: result!.error || "Unknown error",
      });
    }

    lastProcessedId = v.id;

    // Throttle between vouchers to respect Fortnox rate limits
    await delay(250);
  }

  return {
    synced,
    failed,
    cursor: lastProcessedId,
    hasMore,
    errors,
  };
}

// ─── getSyncStats ────────────────────────────────────────────────────────────

export async function getSyncStats(): Promise<{
  total: number;
  synced: number;
  unsynced: number;
  failed: number;
}> {
  const [totalRow] = await db
    .select({ count: count() })
    .from(vouchers);

  const [syncedRow] = await db
    .select({ count: count() })
    .from(vouchers)
    .where(isNotNull(vouchers.fortnoxId));

  const [failedRow] = await db
    .select({ count: count() })
    .from(vouchers)
    .where(
      and(isNull(vouchers.fortnoxId), isNotNull(vouchers.syncError))
    );

  const total = totalRow?.count ?? 0;
  const synced = syncedRow?.count ?? 0;
  const failedCount = failedRow?.count ?? 0;
  const unsynced = total - synced;

  return {
    total,
    synced,
    unsynced,
    failed: failedCount,
  };
}
