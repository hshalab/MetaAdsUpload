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

  const zombieCampaigns = campaigns.filter((c) =>
    c.status === "ACTIVE" &&
    (c.name.toLowerCase().includes("zombie") ||
     c.name.toLowerCase().includes("graveyard") ||
     c.name.toLowerCase().includes("grave"))
  );

  if (zombieCampaigns.length === 0) {
    findings.push({
      category: "zombie",
      severity: "warning",
      title: "No Zombie campaign to audit",
      description: "Create a Zombie/Graveyard campaign to audit its configuration.",
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

    // Check total ads in zombie
    const activeZombieAds = zombieAds.filter((a) => a.status === "ACTIVE").length;
    findings.push({
      category: "zombie",
      severity: "pass",
      title: `Zombie has ${activeZombieAds} active ads in ${zombieAdsets.length} ad set(s)`,
      description: `Total ads: ${zombieAds.length} (active: ${activeZombieAds})`,
      entityId: zombieCampaign.id,
      entityType: "campaign",
      details: { totalAds: zombieAds.length, activeAds: activeZombieAds },
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

  for (const campaign of campaigns.filter((c) => c.status === "ACTIVE")) {
    const campaignAdsets = adsets.filter((a) => a.campaign_id === campaign.id && a.status === "ACTIVE");
    if (campaignAdsets.length > settings.maxAdSetsPerCampaign) {
      findings.push({
        category: "ad_count",
        severity: "warning",
        title: `"${campaign.name}" has ${campaignAdsets.length} active ad sets`,
        description: `Exceeds limit of ${settings.maxAdSetsPerCampaign}. Too many ad sets can dilute budget and slow learning.`,
        entityId: campaign.id,
        entityType: "campaign",
      });
    } else {
      findings.push({
        category: "ad_count",
        severity: "pass",
        title: `"${campaign.name}": ${campaignAdsets.length} ad sets`,
        description: `Within ${settings.maxAdSetsPerCampaign} limit.`,
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

export type { CampaignInfo, AdsetInfo, AdInfo, AdsetMetrics };
