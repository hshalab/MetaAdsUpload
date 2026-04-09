import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export interface EvolveSettings {
  id?: number;
  targetRoas: number;
  holdRoas: number;
  breakevenRoas: number;
  targetCpa: number;
  minDailySpend: number;
  learningPeriodDays: number;
  scalingProtocolDays: number;
  zombieCostCapDiscount: number;
  maxAdSetsPerCampaign: number;
  surfModeEnabled: boolean;
  surfModeCampaignIds: string[];
  surfIntervalHours: number;
  graveyardCampaignId: string | null;
}

const DEFAULTS: EvolveSettings = {
  targetRoas: 2.0,
  holdRoas: 1.7,
  breakevenRoas: 1.42,
  targetCpa: 30,
  minDailySpend: 50,
  learningPeriodDays: 7,
  scalingProtocolDays: 3,
  zombieCostCapDiscount: 0.20,
  maxAdSetsPerCampaign: 5,
  surfModeEnabled: false,
  surfModeCampaignIds: [],
  surfIntervalHours: 4,
  graveyardCampaignId: null,
};

export async function getEvolveSettings(): Promise<EvolveSettings> {
  const rows = await db
    .select()
    .from(schema.evolveSettings)
    .orderBy(desc(schema.evolveSettings.id))
    .limit(1);

  if (rows.length === 0) return { ...DEFAULTS };

  const row = rows[0];
  return {
    id: row.id,
    targetRoas: row.targetRoas,
    holdRoas: row.holdRoas,
    breakevenRoas: row.breakevenRoas,
    targetCpa: row.targetCpa,
    minDailySpend: row.minDailySpend,
    learningPeriodDays: row.learningPeriodDays,
    scalingProtocolDays: row.scalingProtocolDays,
    zombieCostCapDiscount: row.zombieCostCapDiscount,
    maxAdSetsPerCampaign: row.maxAdSetsPerCampaign,
    surfModeEnabled: row.surfModeEnabled,
    surfModeCampaignIds: row.surfModeCampaignIds ? JSON.parse(row.surfModeCampaignIds) : [],
    surfIntervalHours: row.surfIntervalHours,
    graveyardCampaignId: row.graveyardCampaignId || null,
  };
}

export { DEFAULTS as EVOLVE_DEFAULTS };
