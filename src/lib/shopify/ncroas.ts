import { db, schema } from "@/db";
import { sql, and, gte, lte } from "drizzle-orm";

export interface NcRoasData {
  newCustomerRevenue: number;
  totalRevenue: number;
  newCustomerOrders: number;
  totalOrders: number;
}

/**
 * Get per-adset ncROAS data for a date range.
 * Groups shopify_orders by utm_adset (= Meta ad set ID stored in utm_term).
 * ncROAS itself is calculated in the caller: newCustomerRevenue / adsetSpend.
 */
export async function getAdsetNcRoas(
  since: string,
  until: string
): Promise<Map<string, NcRoasData>> {
  const result = new Map<string, NcRoasData>();

  try {
    const rows = await db
      .select({
        utmAdset: schema.shopifyOrders.utmAdset,
        newCustomerRevenue: sql<number>`coalesce(sum(case when ${schema.shopifyOrders.isNewCustomer} then ${schema.shopifyOrders.totalPrice} else 0 end), 0)`,
        totalRevenue: sql<number>`coalesce(sum(${schema.shopifyOrders.totalPrice}), 0)`,
        newCustomerOrders: sql<number>`coalesce(sum(case when ${schema.shopifyOrders.isNewCustomer} then 1 else 0 end), 0)`,
        totalOrders: sql<number>`count(*)`,
      })
      .from(schema.shopifyOrders)
      .where(
        and(
          gte(schema.shopifyOrders.orderDate, since),
          lte(schema.shopifyOrders.orderDate, until),
          sql`${schema.shopifyOrders.utmAdset} is not null`
        )
      )
      .groupBy(schema.shopifyOrders.utmAdset);

    for (const row of rows) {
      if (row.utmAdset) {
        result.set(row.utmAdset, {
          newCustomerRevenue: Number(row.newCustomerRevenue),
          totalRevenue: Number(row.totalRevenue),
          newCustomerOrders: Number(row.newCustomerOrders),
          totalOrders: Number(row.totalOrders),
        });
      }
    }
  } catch {
    // shopify_orders table might not exist yet — return empty map
  }

  return result;
}
