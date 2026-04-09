import type { EvolveSettings } from "./settings";

export type AuditSeverity = "pass" | "warning" | "fail";
export type AuditCategory = "structure" | "zombie" | "budget" | "frequency" | "ad_count" | "classification";

export interface AuditFinding {
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
}

interface CampaignInfo {
  id: string;
  name: string;
  status: string;
  objective?: string;
  buying_type?: string;
  daily_budget?: string;
}

interface AdsetInfo {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  daily_budget?: string;
  bid_strategy?: string;
  targeting?: Record<string, unknown>;
}

interface AdInfo {
  id: string;
  adset_id: string;
  campaign_id: string;
  name: string;
  status: string;
}

interface AdsetMetrics {
  adsetId: string;
  spend: number;
  roas: number;
  impressions: number;
  reach: number;
  frequency: number;
}

export function auditCampaignStructure(
  campaigns: CampaignInfo[],
  settings: EvolveSettings
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");

  // Check for CBO campaign
  const cboCampaigns = activeCampaigns.filter((c) =>
    c.name.toLowerCase().includes("cbo") || c.buying_type === "AUCTION"
  );

  if (cboCampaigns.length === 0) {
    findings.push({
      category: "structure",
      severity: "warning",
      title: "No CBO campaign detected",
      description: "The Evolve framework recommends at least 1 CBO campaign for testing. Consider creating one.",
    });
  } else {
    findings.push({
      category: "structure",
      severity: "pass",
      title: "CBO campaign found",
      description: `${cboCampaigns.length} CBO-style campaign(s) detected.`,
      details: { campaigns: cboCampaigns.map((c) => c.name) },
    });
  }

  // Check for Zombie/Graveyard campaign
  const zombieCampaigns = activeCampaigns.filter((c) =>
    c.name.toLowerCase().includes("zombie") ||
    c.name.toLowerCase().includes("graveyard") ||
    c.name.toLowerCase().includes("grave")
  );

  if (zombieCampaigns.length === 0) {
    findings.push({
      category: "structure",
      severity: "warning",
      title: "No Zombie campaign detected",
      description: "The Evolve framework recommends a Zombie/Graveyard CBO campaign with cost cap for underperforming ads.",
    });
  } else {
    findings.push({
      category: "structure",
      severity: "pass",
      title: "Zombie campaign found",
      description: `${zombieCampaigns.length} Zombie/Graveyard campaign(s) detected.`,
      details: { campaigns: zombieCampaigns.map((c) => c.name) },
    });
  }

  // Check total active campaign count (3:2:2:2 = ideally small)
  if (activeCampaigns.length > 5) {
    findings.push({
      category: "structure",
      severity: "warning",
      title: `${activeCampaigns.length} active campaigns`,
      description: "Consider consolidating. The Evolve 3:2:2:2 method works best with fewer, focused campaigns (1 CBO + 1 Graveyard).",
    });
  } else {
    findings.push({
      category: "structure",
      severity: "pass",
      title: `${activeCampaigns.length} active campaigns`,
      description: "Campaign count is manageable.",
    });
  }

  return findings;
}

export function auditZombieCampaign(
  campaigns: CampaignInfo[],
  adsets: AdsetInfo[],
  ads: AdInfo[],
  settings: EvolveSettings
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Prefer configured graveyard campaign; fall back to name matching
  let zombieCampaigns: CampaignInfo[];
  if (settings.graveyardCampaignId) {
    zombieCampaigns = campaigns.filter((c) => c.id === settings.graveyardCampaignId);
    if (zombieCampaigns.length === 0) {
      findings.push({
        category: "zombie",
        severity: "fail",
        title: "Konfigurerad Graveyard-kampanj hittades inte",
        description: "Kampanjen som valts i Evolve Settings kunde inte hittas. Kontrollera inställningarna.",
      });
      return findings;
    }
  } else {
    zombieCampaigns = campaigns.filter((c) =>
      c.status === "ACTIVE" &&
      (c.name.toLowerCase().includes("zombie") ||
       c.name.toLowerCase().includes("graveyard") ||
       c.name.toLowerCase().includes("grave"))
    );
  }

  if (zombieCampaigns.length === 0) {
    findings.push({
      category: "zombie",
      severity: "warning",
      title: "Ingen Graveyard-kampanj konfigurerad",
      description: "Gå till Evolve KPI Settings och välj din Graveyard-kampanj, eller skapa en CBO-kampanj med cost cap.",
    });
    return findings;
  }

  for (const zombieCampaign of zombieCampaigns) {
    const zombieAdsets = adsets.filter((a) => a.campaign_id === zombieCampaign.id);
    const zombieAds = ads.filter((a) => a.campaign_id === zombieCampaign.id);

    // Check if it has a cost cap
    const expectedCostCap = settings.targetCpa * (1 - settings.zombieCostCapDiscount);
    const hasAdsetWithCostCap = zombieAdsets.some((a) =>
      a.bid_strategy === "LOWEST_COST_WITH_BID_CAP" || a.bid_strategy === "COST_CAP"
    );

    if (!hasAdsetWithCostCap) {
      findings.push({
        category: "zombie",
        severity: "fail",
        title: `Zombie "${zombieCampaign.name}" missing cost cap`,
        description: `Expected cost cap around ${expectedCostCap.toFixed(0)} SEK (${settings.targetCpa} CPA × ${((1 - settings.zombieCostCapDiscount) * 100).toFixed(0)}%). Add bid cap to ad sets.`,
        entityId: zombieCampaign.id,
        entityType: "campaign",
      });
    } else {
      findings.push({
        category: "zombie",
        severity: "pass",
        title: `Zombie "${zombieCampaign.name}" has cost cap`,
        description: `Cost cap configured. Target: ${expectedCostCap.toFixed(0)} SEK.`,
        entityId: zombieCampaign.id,
        entityType: "campaign",
      });
    }

    // Check ad count per adset (max 50 ads)
    for (const adset of zombieAdsets) {
      const adCount = zombieAds.filter((a) => a.adset_id === adset.id).length;
      if (adCount > 50) {
        findings.push({
          category: "zombie",
          severity: "warning",
          title: `Zombie ad set "${adset.name}" has ${adCount} ads`,
          description: "Zombie ad sets should have max 50 ads for effective testing. Split into multiple ad sets.",
          entityId: adset.id,
          entityType: "adset",
        });
      }
    }

    // Graveyard ad set count — CBO + cost cap handles distribution automatically,
    // so number of ad sets doesn't matter. Just report status.
    const activeZombieAdsets = zombieAdsets.filter((a) => a.status === "ACTIVE");
    const activeZombieAds = zombieAds.filter((a) => a.status === "ACTIVE").length;

    // Check that all ad sets have cost cap (not just "some")
    const adsetsWithoutCostCap = activeZombieAdsets.filter((a) =>
      a.bid_strategy !== "LOWEST_COST_WITH_BID_CAP" && a.bid_strategy !== "COST_CAP"
    );
    if (adsetsWithoutCostCap.length > 0) {
      for (const adset of adsetsWithoutCostCap) {
        findings.push({
          category: "zombie",
          severity: "fail",
          title: `Graveyard ad set "${adset.name}" saknar cost cap`,
          description: `Alla ad sets i Graveyard måste ha cost cap (${expectedCostCap.toFixed(0)} SEK). Utan cost cap riskerar du okontrollerad spend.`,
          entityId: adset.id,
          entityType: "adset",
        });
      }
    }

    findings.push({
      category: "zombie",
      severity: "pass",
      title: `Graveyard: ${activeZombieAds} aktiva ads i ${activeZombieAdsets.length} ad set(s)`,
      description: `CBO + cost cap styr budgeten automatiskt. Totalt: ${zombieAds.length} ads (aktiva: ${activeZombieAds}).`,
      entityId: zombieCampaign.id,
      entityType: "campaign",
      details: { totalAds: zombieAds.length, activeAds: activeZombieAds, activeAdsets: activeZombieAdsets.length },
    });
  }

  return findings;
}

export function auditAdSetCount(
  campaigns: CampaignInfo[],
  adsets: AdsetInfo[],
  settings: EvolveSettings
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Skip the Graveyard campaign — CBO + cost cap handles it, no ad set limit needed
  const graveyardId = settings.graveyardCampaignId;
  const isGraveyard = (c: CampaignInfo) =>
    c.id === graveyardId ||
    c.name.toLowerCase().includes("zombie") ||
    c.name.toLowerCase().includes("graveyard") ||
    c.name.toLowerCase().includes("grave");

  for (const campaign of campaigns.filter((c) => c.status === "ACTIVE")) {
    if (isGraveyard(campaign)) continue; // Graveyard audited separately

    const campaignAdsets = adsets.filter((a) => a.campaign_id === campaign.id && a.status === "ACTIVE");

    // Dynamic max: Budget / Target CPA (Evolve formula)
    // If campaign has a daily budget, use it. Otherwise fall back to settings.maxAdSetsPerCampaign
    const dailyBudget = campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : 0;
    const dynamicMax = dailyBudget > 0 && settings.targetCpa > 0
      ? Math.floor(dailyBudget / settings.targetCpa)
      : settings.maxAdSetsPerCampaign;
    const effectiveMax = Math.max(dynamicMax, 3); // minimum 3 ad sets

    if (campaignAdsets.length > effectiveMax) {
      findings.push({
        category: "ad_count",
        severity: "warning",
        title: `"${campaign.name}" har ${campaignAdsets.length} aktiva ad sets`,
        description: dailyBudget > 0
          ? `Budget ${dailyBudget.toFixed(0)} SEK / ${settings.targetCpa} SEK CPA = max ~${effectiveMax} ad sets. ${campaignAdsets.length} ad sets sprider budgeten för tunt.`
          : `Över gränsen på ${effectiveMax}. Formel: Budget / Target CPA = max ad sets.`,
        entityId: campaign.id,
        entityType: "campaign",
        details: { dailyBudget, targetCpa: settings.targetCpa, dynamicMax: effectiveMax, actual: campaignAdsets.length },
      });
    } else {
      findings.push({
        category: "ad_count",
        severity: "pass",
        title: `"${campaign.name}": ${campaignAdsets.length} ad sets`,
        description: dailyBudget > 0
          ? `Inom gränsen (${dailyBudget.toFixed(0)} SEK / ${settings.targetCpa} SEK CPA = max ~${effectiveMax}).`
          : `Inom gränsen på ${effectiveMax}.`,
        entityId: campaign.id,
        entityType: "campaign",
      });
    }
  }

  return findings;
}

export function auditFrequency(
  adsetMetrics: AdsetMetrics[],
  adsets: AdsetInfo[],
  settings: EvolveSettings
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const adsetMap = new Map(adsets.map((a) => [a.id, a]));

  const highFrequency = adsetMetrics.filter((m) => m.frequency > 1.5 && m.spend > 0);
  const okFrequency = adsetMetrics.filter((m) => m.frequency <= 1.5 && m.frequency > 0 && m.spend > 0);

  if (highFrequency.length > 0) {
    for (const m of highFrequency.slice(0, 10)) {
      const adset = adsetMap.get(m.adsetId);
      const isPerforming = m.roas >= settings.targetRoas;

      if (isPerforming) {
        // High frequency BUT good ROAS — not a problem
        findings.push({
          category: "frequency",
          severity: "pass",
          title: `"${adset?.name || m.adsetId}" frequency: ${m.frequency.toFixed(1)} — but ROAS ${m.roas.toFixed(2)}x`,
          description: `Hög frequency men levererar bra ROAS (ovanför target ${settings.targetRoas}x). Låt den vara — den träffar en engagerad publik.`,
          entityId: m.adsetId,
          entityType: "adset",
        });
      } else if (m.roas >= settings.breakevenRoas) {
        // High frequency, mediocre ROAS — warning
        findings.push({
          category: "frequency",
          severity: "warning",
          title: `"${adset?.name || m.adsetId}" frequency: ${m.frequency.toFixed(1)} med ROAS ${m.roas.toFixed(2)}x`,
          description: `Hög frequency och ROAS under target. Håll koll — om ROAS sjunker under breakeven, byt kreativen.`,
          entityId: m.adsetId,
          entityType: "adset",
        });
      } else {
        // High frequency AND bad ROAS — fail
        findings.push({
          category: "frequency",
          severity: "fail",
          title: `"${adset?.name || m.adsetId}" frequency: ${m.frequency.toFixed(1)} med ROAS ${m.roas.toFixed(2)}x`,
          description: `Hög frequency OCH dålig ROAS (under breakeven ${settings.breakevenRoas}x). Publiken är mättad. Byt kreativ eller pausa.`,
          entityId: m.adsetId,
          entityType: "adset",
        });
      }
    }
  }

  if (okFrequency.length > 0) {
    findings.push({
      category: "frequency",
      severity: "pass",
      title: `${okFrequency.length} ad sets with healthy frequency`,
      description: "Frequency ≤1.5 — bra prospecting-räckvidd.",
    });
  }

  return findings;
}

export function auditBudgetDistribution(
  campaigns: CampaignInfo[],
  adsets: AdsetInfo[]
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const totalBudget = adsets
    .filter((a) => a.status === "ACTIVE" && a.daily_budget)
    .reduce((s, a) => s + (parseFloat(a.daily_budget || "0") / 100), 0);

  if (totalBudget > 0) {
    // Check for zombie budget ratio (~10% of total)
    const zombieCampaigns = activeCampaigns.filter((c) =>
      c.name.toLowerCase().includes("zombie") || c.name.toLowerCase().includes("graveyard")
    );

    if (zombieCampaigns.length > 0) {
      const zombieBudget = adsets
        .filter((a) => zombieCampaigns.some((c) => c.id === a.campaign_id) && a.status === "ACTIVE" && a.daily_budget)
        .reduce((s, a) => s + (parseFloat(a.daily_budget || "0") / 100), 0);

      const zombieRatio = zombieBudget / totalBudget;
      if (zombieRatio > 0.25) {
        findings.push({
          category: "budget",
          severity: "warning",
          title: `Zombie budget is ${(zombieRatio * 100).toFixed(0)}% of total`,
          description: "Zombie campaigns should typically use ~10% of total budget. Consider reducing.",
          details: { zombieBudget, totalBudget, ratio: zombieRatio },
        });
      } else {
        findings.push({
          category: "budget",
          severity: "pass",
          title: `Zombie budget: ${(zombieRatio * 100).toFixed(0)}% of total (${zombieBudget.toFixed(0)} SEK)`,
          description: "Budget allocation looks reasonable.",
        });
      }
    }

    findings.push({
      category: "budget",
      severity: "pass",
      title: `Total daily budget: ${totalBudget.toFixed(0)} SEK across ${adsets.filter((a) => a.status === "ACTIVE").length} ad sets`,
      description: `Across ${activeCampaigns.length} active campaigns.`,
    });
  }

  return findings;
}

export function auditCustomerExclusion(
  adsets: AdsetInfo[],
  settings: EvolveSettings
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Check if any active prospecting ad sets have custom audience exclusions
  const activeAdsets = adsets.filter((a) => a.status === "ACTIVE");

  // Look for custom audience exclusions in targeting
  let hasExclusion = false;
  for (const adset of activeAdsets) {
    const targeting = adset.targeting as Record<string, unknown> | undefined;
    if (targeting?.exclusions || targeting?.excluded_custom_audiences) {
      hasExclusion = true;
      break;
    }
  }

  if (!hasExclusion && activeAdsets.length > 0) {
    findings.push({
      category: "structure",
      severity: "warning",
      title: "Ingen customer exclusion hittad",
      description: "Med hög återköpsfrekvens bör du excluda befintliga kunder från prospecting-kampanjer. Skapa en Custom Audience av köpare (180 dagar) och lägg som exclusion på dina ad sets.",
    });
  } else if (hasExclusion) {
    findings.push({
      category: "structure",
      severity: "pass",
      title: "Customer exclusion aktiv",
      description: "Ad sets har custom audience exclusions konfigurerade.",
    });
  }

  return findings;
}

export type { CampaignInfo, AdsetInfo, AdInfo, AdsetMetrics };
