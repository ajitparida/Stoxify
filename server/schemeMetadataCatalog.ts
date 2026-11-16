import type { MfPlanType } from '../src/types/market.ts';

export interface ExitLoadTier {
  maxDays: number;
  ratePct: number;
}

export interface SchemeCostProfile {
  terPct: number;
  terSource: 'AMC Verified' | 'Category Est.';
  exitLoadTiers: ExitLoadTier[];
  exitLoadWindowDays: number;
  exitLoadRuleLabel: string;
  isElssLockIn: boolean;
}

interface CatalogEntry {
  directTer: number;
  regularTer: number;
  exitLoadTiers: ExitLoadTier[];
  exitLoadRuleLabel: string;
  isElssLockIn?: boolean;
}

// Verified SEBI-disclosed AMFI / AMC Direct & Regular TERs and Exit Load schedules
const VERIFIED_SCHEME_METADATA: Record<string, CatalogEntry> = {
  // Parag Parikh Flexi Cap Fund (Direct & Regular)
  '122639': {
    directTer: 0.63,
    regularTer: 1.33,
    exitLoadTiers: [
      { maxDays: 365, ratePct: 2.0 },
      { maxDays: 730, ratePct: 1.0 },
    ],
    exitLoadRuleLabel: '2% ≤ 365d, 1% ≤ 730d',
  },
  '122640': {
    directTer: 0.63,
    regularTer: 1.33,
    exitLoadTiers: [
      { maxDays: 365, ratePct: 2.0 },
      { maxDays: 730, ratePct: 1.0 },
    ],
    exitLoadRuleLabel: '2% ≤ 365d, 1% ≤ 730d',
  },
  // HDFC Flexi Cap Fund
  '118955': {
    directTer: 0.78,
    regularTer: 1.47,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  '101762': {
    directTer: 0.78,
    regularTer: 1.47,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  // Axis Large Cap Fund
  '120465': {
    directTer: 0.73,
    regularTer: 1.59,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  '112277': {
    directTer: 0.73,
    regularTer: 1.59,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  // SBI Small Cap Fund
  '125497': {
    directTer: 0.7,
    regularTer: 1.64,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  '125494': {
    directTer: 0.7,
    regularTer: 1.64,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  // Nippon India Small Cap Fund
  '118778': {
    directTer: 0.67,
    regularTer: 1.45,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  // HDFC Mid Cap Fund
  '118989': {
    directTer: 0.76,
    regularTer: 1.46,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  // HDFC Large & Mid Cap Fund
  '130498': {
    directTer: 0.86,
    regularTer: 1.68,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  // Mirae Asset Large & Midcap Fund
  '118834': {
    directTer: 0.55,
    regularTer: 1.54,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  // Motilal Oswal Index Funds
  '147622': {
    directTer: 0.3,
    regularTer: 1.0,
    exitLoadTiers: [{ maxDays: 15, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 15d',
  },
  '147623': {
    directTer: 0.36,
    regularTer: 1.05,
    exitLoadTiers: [{ maxDays: 15, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 15d',
  },
  '147625': {
    directTer: 0.33,
    regularTer: 1.03,
    exitLoadTiers: [{ maxDays: 15, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 15d',
  },
  // ICICI Prudential Large Cap Fund
  '120586': {
    directTer: 0.88,
    regularTer: 1.55,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadRuleLabel: '1% ≤ 365d',
  },
  // UTI Nifty 50 Index Fund
  '120716': {
    directTer: 0.18,
    regularTer: 0.33,
    exitLoadTiers: [],
    exitLoadRuleLabel: 'Nil Exit Load',
  },
  // Mirae Asset ELSS Tax Saver Fund
  '135781': {
    directTer: 0.56,
    regularTer: 1.58,
    exitLoadTiers: [],
    exitLoadRuleLabel: '3Y Statutory ELSS Lock-in',
    isElssLockIn: true,
  },
  // Quant ELSS Tax Saver Fund
  '120847': {
    directTer: 0.77,
    regularTer: 1.77,
    exitLoadTiers: [],
    exitLoadRuleLabel: '3Y Statutory ELSS Lock-in',
    isElssLockIn: true,
  },
  // HDFC Corporate Bond Fund
  '118987': {
    directTer: 0.36,
    regularTer: 0.62,
    exitLoadTiers: [],
    exitLoadRuleLabel: 'Nil Exit Load',
  },
};

export function resolveSchemeCostProfile(params: {
  schemeCode: string;
  schemeName: string;
  category: string;
  planType: MfPlanType;
}): SchemeCostProfile {
  const verified = VERIFIED_SCHEME_METADATA[params.schemeCode];
  if (verified) {
    const maxWindow = verified.isElssLockIn
      ? 1095
      : verified.exitLoadTiers.reduce((m, t) => Math.max(m, t.maxDays), 0);
    return {
      terPct: params.planType === 'Direct' ? verified.directTer : verified.regularTer,
      terSource: 'AMC Verified',
      exitLoadTiers: verified.exitLoadTiers,
      exitLoadWindowDays: maxWindow,
      exitLoadRuleLabel: verified.exitLoadRuleLabel,
      isElssLockIn: Boolean(verified.isElssLockIn),
    };
  }

  const c = `${params.category} ${params.schemeName}`.toLowerCase();
  if (c.includes('elss') || c.includes('tax saver')) {
    return {
      terPct: params.planType === 'Direct' ? 0.65 : 1.65,
      terSource: 'Category Est.',
      exitLoadTiers: [],
      exitLoadWindowDays: 1095,
      exitLoadRuleLabel: '3Y Statutory ELSS Lock-in',
      isElssLockIn: true,
    };
  }

  if (c.includes('index') || c.includes('nifty') || c.includes('sensex')) {
    return {
      terPct: params.planType === 'Direct' ? 0.22 : 0.65,
      terSource: 'Category Est.',
      exitLoadTiers: [],
      exitLoadWindowDays: 0,
      exitLoadRuleLabel: 'Nil / Minimal Exit Load',
      isElssLockIn: false,
    };
  }

  if (
    c.includes('debt') ||
    c.includes('bond') ||
    c.includes('liquid') ||
    c.includes('gilt') ||
    c.includes('money market')
  ) {
    return {
      terPct: params.planType === 'Direct' ? 0.34 : 0.72,
      terSource: 'Category Est.',
      exitLoadTiers: [],
      exitLoadWindowDays: 0,
      exitLoadRuleLabel: 'Nil Exit Load',
      isElssLockIn: false,
    };
  }

  if (c.includes('small cap') || c.includes('mid cap')) {
    return {
      terPct: params.planType === 'Direct' ? 0.68 : 1.68,
      terSource: 'Category Est.',
      exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
      exitLoadWindowDays: 365,
      exitLoadRuleLabel: '1% ≤ 365d',
      isElssLockIn: false,
    };
  }

  if (c.includes('hybrid') || c.includes('balanced') || c.includes('advantage')) {
    return {
      terPct: params.planType === 'Direct' ? 0.58 : 1.55,
      terSource: 'Category Est.',
      exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
      exitLoadWindowDays: 365,
      exitLoadRuleLabel: '1% ≤ 365d',
      isElssLockIn: false,
    };
  }

  return {
    terPct: params.planType === 'Direct' ? 0.65 : 1.58,
    terSource: 'Category Est.',
    exitLoadTiers: [{ maxDays: 365, ratePct: 1.0 }],
    exitLoadWindowDays: 365,
    exitLoadRuleLabel: '1% ≤ 365d',
    isElssLockIn: false,
  };
}

export function evaluateTieredExitLoadPct(
  tiers: ExitLoadTier[],
  holdingDays: number
): number {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.maxDays - b.maxDays);
  for (const tier of sorted) {
    if (holdingDays <= tier.maxDays) {
      return tier.ratePct;
    }
  }
  return 0;
}
