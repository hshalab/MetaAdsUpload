import { db, schema } from "@/db";
import { sql, and, gte, lte } from "drizzle-orm";

export interface NcRoasData {
  newCustomerRevenue: number;
  totalRevenue: number;
  newCustomerOrders: number;
  totalOrders: number;
}

/**
 * Get total ncROAS data for a date range (not per entity).
 * Used when UTM attribution is not available.
 */
export async function getTotalNcRoas(
  since: string,
  until: string
): Promise<NcRoasData> {
  try {
    const rows = await db
      .select({
        newCustomerRevenue: sql<number>`coalesce(sum(case when ${schema.shopifyOrders.isNewCustomer} then ${schema.shopifyOrders.totalPrice} else 0 end), 0)`,
        totalRevenue: sql<number>`coalesce(sum(${schema.shopifyOrders.totalPrice}), 0)`,
        newCustomerOrders: sql<number>`coalesce(sum(case when ${schema.shopifyOrders.isNewCustomer} then 1 else 0 end), 0)`,
        totalOrders: sql<number>`count(*)`,
      })
      .from(schema.shopifyOrders)
      .where(
        and(
          gte(schema.shopifyOrders.orderDate, since),
          lte(schema.shopifyOrders.orderDate, until)
        )
      );

    return {
      newCustomerRevenue: Number(rows[0]?.newCustomerRevenue || 0),
      totalRevenue: Number(rows[0]?.totalRevenue || 0),
      newCustomerOrders: Number(rows[0]?.newCustomerOrders || 0),
      totalOrders: Number(rows[0]?.totalOrders || 0),
    };
  } catch {
    return { newCustomerRevenue: 0, totalRevenue: 0, newCustomerOrders: 0, totalOrders: 0 };
  }
}

/**
 * Get per-adset ncROAS data for a date range.
 * Groups shopify_orders by utm_adset (= Meta ad set ID stored in utm_term).
 */
export async function getAdsetNcRoas(
  since: string,
  until: string
): Promise<Map<string, NcRoasData>> {
  return getNcRoasGrouped(since, until, "utmAdset");
}

/**
 * Get per-campaign ncROAS data for a date range.
 * Groups shopify_orders by utm_campaign (= Meta campaign ID).
 */
export async function getCampaignNcRoas(
  since: string,
  until: string
): Promise<Map<string, NcRoasData>> {
  return getNcRoasGrouped(since, until, "utmCampaign");
}

/**
 * Get per-ad ncROAS data for a date range.
 * Groups shopify_orders by utm_ad (= Meta ad ID stored in utm_content).
 */
export async function getAdNcRoas(
  since: string,
  until: string
): Promise<Map<string, NcRoasData>> {
  return getNcRoasGrouped(since, until, "utmAd");
}

async function getNcRoasGrouped(
  since: string,
  until: string,
  groupField: "utmAdset" | "utmCampaign" | "utmAd"
): Promise<Map<string, NcRoasData>> {
  const result = new Map<string, NcRoasData>();
  const column = schema.shopifyOrders[groupField];

  try {
    const rows = await db
      .select({
        groupKey: column,
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
          sql`${column} is not null`
        )
      )
      .groupBy(column);

    for (const row of rows) {
      if (row.groupKey) {
        result.set(row.groupKey, {
          newCustomerRevenue: Number(row.newCustomerRevenue),
          totalRevenue: Number(row.totalRevenue),
          newCustomerOrders: Number(row.newCustomerOrders),
          totalOrders: Number(row.totalOrders),
        });
      }
    }
  } catch {
    // table might not exist yet
  }

  return result;
}
