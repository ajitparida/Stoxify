import { INDIAN_STOCK_UNIVERSE } from './indianMarketCatalog.ts';
import {
  getLiveResearchSignals,
  getQuote,
  getRawOhlcvCandles,
  getScreenerUniverse,
} from './marketService.ts';
import {
  getLiveFundamentalsBatch,
  mergeQuoteWithFundamentals,
} from './fundamentalsService.ts';
import type {
  ConfidenceBreakdown,
  LiveFundamentalsSnapshot,
  LiveResearchSignal,
  MarketQuote,
  MonthlyCohortEntry,
  MonthlyCohortGroup,
  PatternDiscoveryItem,
  PatternDiscoveryResponse,
  PatternId,
  WalkForwardStats,
} from '../src/types/market.ts';

const WEIGHTS = {
  trendStructure: 0.3,
  relativeStrength: 0.25,
  momentumQuality: 0.2,
  fundamentalHealth: 0.25,
} as const;

export const PATTERN_METADATA: Record<
  PatternId,
  { title: string; subtitle: string; ruleSummary: string }
> = {
  high_confidence: {
    title: 'High confidence',
    subtitle: 'Stocks lining up across trend, Nifty relative strength, momentum, and fundamentals.',
    ruleSummary: 'Confidence ≥ 65% with bullish trend structure & positive benchmark alignment',
  },
  fresh_upward_move: {
    title: 'Fresh upward move',
    subtitle: 'Recent upward breakouts regaining 50-DMA with fresh momentum and volume expansion.',
    ruleSummary: 'Above 50-DMA with +3.5% 1M acceleration and constructive volume or RSI 54–72',
  },
  steady_upward_trend: {
    title: 'Steady upward trend',
    subtitle: 'Stocks staying strong across multiple periods rather than relying on one sudden jump.',
    ruleSummary: 'Price > 50-DMA > 200-DMA (Golden alignment), 6M gain ≥ 6%, non-parabolic RSI ≤ 72',
  },
  strong_on_dip: {
    title: 'Strong stocks on a dip',
    subtitle: 'Stronger-confidence uptrends pulling back closer to moving-average support.',
    ruleSummary: 'Long-term uptrend above 200-DMA with mild short-term pullback near 50-DMA support',
  },
  momentum_reset: {
    title: 'Healthy momentum reset',
    subtitle: 'Taking a short breather after strength while the broader price structure stays intact.',
    ruleSummary: 'Price holding above 200-DMA while RSI-14 cools cleanly into the 40–58 reset zone',
  },
  higher_fundamental: {
    title: 'Higher fundamental confidence',
    subtitle: 'Backed by stronger ROE/ROCE, revenue & earnings growth, and disciplined leverage.',
    ruleSummary: 'Fundamental Health pillar ≥ 76% from live Yahoo Finance ratios & balance-sheet checks',
  },
};

export const PATTERN_ORDER: PatternId[] = [
  'high_confidence',
  'fresh_upward_move',
  'steady_upward_trend',
  'strong_on_dip',
  'momentum_reset',
  'higher_fundamental',
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round1(v: number): number {
  return Number(v.toFixed(1));
}

function round2(v: number): number {
  return Number(v.toFixed(2));
}

export interface ConfidenceInput {
  price: number;
  sma50: number | null;
  sma200: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  rsi14: number | null;
  volumeRatio: number;
  dayChangePercent?: number;
  return1M: number | null;
  return3M?: number | null;
  return6M: number | null;
  niftyReturn1M?: number | null;
  niftyReturn3M?: number | null;
  niftyReturn6M?: number | null;
  sector?: string;
  fundamentals?: {
    trailingPE?: number | null;
    forwardPE?: number | null;
    roePct?: number | null;
    roceProxyPct?: number | null;
    revenueGrowthPct?: number | null;
    earningsGrowthPct?: number | null;
    operatingMarginPct?: number | null;
    debtToEquity?: number | null;
  } | null;
}

export function computeConfidenceBreakdown(input: ConfidenceInput): ConfidenceBreakdown {
  const { price, sma50, sma200, rsi14, volumeRatio } = input;
  const safePrice = Math.max(0.01, price);

  // 1. Trend Structure (30%)
  let trendScore = 50;
  const trendNotes: string[] = [];

  if (sma200 && sma200 > 0) {
    const diff200 = ((safePrice - sma200) / sma200) * 100;
    if (diff200 >= 0) {
      trendScore += clamp(12 + diff200 * 0.75, 12, 24);
      trendNotes.push(`+${diff200.toFixed(1)}% vs 200-DMA`);
    } else {
      trendScore -= clamp(12 + Math.abs(diff200) * 0.9, 12, 32);
      trendNotes.push(`${diff200.toFixed(1)}% vs 200-DMA`);
    }
  }

  if (sma50 && sma50 > 0) {
    const diff50 = ((safePrice - sma50) / sma50) * 100;
    if (diff50 >= 0) {
      trendScore += clamp(8 + diff50 * 0.6, 8, 16);
      trendNotes.push('above 50-DMA');
    } else {
      trendScore -= clamp(6 + Math.abs(diff50) * 0.75, 6, 18);
      trendNotes.push('below 50-DMA');
    }
  }

  if (sma50 && sma200 && sma50 > 0 && sma200 > 0) {
    if (sma50 > sma200) {
      trendScore += 10;
      trendNotes.push('Golden alignment');
    } else {
      trendScore -= 8;
    }
  }

  if (
    input.fiftyTwoWeekHigh &&
    input.fiftyTwoWeekLow &&
    input.fiftyTwoWeekHigh > input.fiftyTwoWeekLow
  ) {
    const pos52w =
      (safePrice - input.fiftyTwoWeekLow) / (input.fiftyTwoWeekHigh - input.fiftyTwoWeekLow);
    trendScore += (pos52w - 0.5) * 14;
  }

  trendScore = round1(clamp(trendScore, 5, 98));

  // 2. Relative Strength vs Nifty 50 (25%)
  const alpha1M =
    input.return1M !== null && input.niftyReturn1M !== null && input.niftyReturn1M !== undefined
      ? input.return1M - input.niftyReturn1M
      : input.return1M;
  const alpha3M =
    input.return3M !== null &&
    input.return3M !== undefined &&
    input.niftyReturn3M !== null &&
    input.niftyReturn3M !== undefined
      ? input.return3M - input.niftyReturn3M
      : input.return3M ?? null;
  const alpha6M =
    input.return6M !== null && input.niftyReturn6M !== null && input.niftyReturn6M !== undefined
      ? input.return6M - input.niftyReturn6M
      : input.return6M;

  let blendedAlpha = 0;
  let alphaWeightSum = 0;
  if (alpha1M !== null && alpha1M !== undefined) {
    blendedAlpha += alpha1M * 0.35;
    alphaWeightSum += 0.35;
  }
  if (alpha3M !== null && alpha3M !== undefined) {
    blendedAlpha += alpha3M * 0.35;
    alphaWeightSum += 0.35;
  }
  if (alpha6M !== null && alpha6M !== undefined) {
    blendedAlpha += (alpha6M * 0.55) * 0.3;
    alphaWeightSum += 0.3;
  }

  const normalizedAlpha = alphaWeightSum > 0 ? blendedAlpha / alphaWeightSum : 0;
  const rsScore = round1(clamp(52 + normalizedAlpha * 2.1, 8, 97));
  const rsParts: string[] = [];
  if (alpha1M !== null && alpha1M !== undefined) {
    rsParts.push(`1M α ${alpha1M >= 0 ? '+' : ''}${alpha1M.toFixed(1)}%`);
  }
  if (alpha6M !== null && alpha6M !== undefined) {
    rsParts.push(`6M α ${alpha6M >= 0 ? '+' : ''}${alpha6M.toFixed(1)}%`);
  }

  // 3. Momentum Quality (20%)
  let momentumScore = 55;
  const momNotes: string[] = [];

  if (rsi14 !== null) {
    if (rsi14 >= 52 && rsi14 <= 68) {
      momentumScore = 84 + (1 - Math.abs(rsi14 - 60) / 8) * 10;
      momNotes.push(`RSI ${rsi14.toFixed(1)} sweet spot`);
    } else if (rsi14 >= 42 && rsi14 < 52) {
      momentumScore = 70 + ((rsi14 - 42) / 10) * 12;
      momNotes.push(`RSI ${rsi14.toFixed(1)} reset zone`);
    } else if (rsi14 > 68 && rsi14 <= 76) {
      momentumScore = 74 - ((rsi14 - 68) / 8) * 14;
      momNotes.push(`RSI ${rsi14.toFixed(1)} firm`);
    } else if (rsi14 > 76) {
      momentumScore = clamp(56 - (rsi14 - 76) * 1.6, 30, 56);
      momNotes.push(`RSI ${rsi14.toFixed(1)} stretched`);
    } else if (rsi14 >= 32 && rsi14 < 42) {
      const aboveLongTrend = Boolean(sma200 && safePrice > sma200);
      momentumScore = aboveLongTrend ? 62 : 44;
      momNotes.push(`RSI ${rsi14.toFixed(1)} cooling`);
    } else {
      const aboveLongTrend = Boolean(sma200 && safePrice > sma200);
      momentumScore = aboveLongTrend ? 52 : 30;
      momNotes.push(`RSI ${rsi14.toFixed(1)} oversold`);
    }
  }

  if (volumeRatio >= 1.25 && (input.dayChangePercent ?? 0) >= 0) {
    momentumScore += clamp((volumeRatio - 1) * 7, 3, 10);
    momNotes.push(`${volumeRatio.toFixed(2)}x vol`);
  } else if (volumeRatio >= 1.5 && (input.dayChangePercent ?? 0) < -1.2) {
    momentumScore -= 8;
    momNotes.push(`${volumeRatio.toFixed(2)}x distribution`);
  }

  momentumScore = round1(clamp(momentumScore, 10, 96));

  // 4. Fundamental Health (25%)
  const f = input.fundamentals;
  const isFinancialSector = /bank|financ|insur|nbfc/i.test(input.sector || '');
  let fundScore = 54;
  const fundNotes: string[] = [];

  const returnQuality = f?.roePct ?? f?.roceProxyPct ?? null;
  if (returnQuality !== null) {
    if (returnQuality >= 24) {
      fundScore += 20;
      fundNotes.push(`ROE/ROCE ${returnQuality.toFixed(1)}%`);
    } else if (returnQuality >= 15) {
      fundScore += 13;
      fundNotes.push(`ROE/ROCE ${returnQuality.toFixed(1)}%`);
    } else if (returnQuality >= 10) {
      fundScore += 5;
      fundNotes.push(`ROE/ROCE ${returnQuality.toFixed(1)}%`);
    } else if (returnQuality < 6) {
      fundScore -= 14;
      fundNotes.push(`Low return ${returnQuality.toFixed(1)}%`);
    }
  }

  const revGr = f?.revenueGrowthPct ?? null;
  if (revGr !== null) {
    if (revGr >= 18) {
      fundScore += 12;
      fundNotes.push(`Rev +${revGr.toFixed(1)}%`);
    } else if (revGr >= 8) {
      fundScore += 7;
      fundNotes.push(`Rev +${revGr.toFixed(1)}%`);
    } else if (revGr < 0) {
      fundScore -= 10;
      fundNotes.push(`Rev ${revGr.toFixed(1)}%`);
    }
  }

  const earnGr = f?.earningsGrowthPct ?? null;
  if (earnGr !== null) {
    if (earnGr >= 20) {
      fundScore += 10;
      fundNotes.push(`EPS +${earnGr.toFixed(1)}%`);
    } else if (earnGr >= 8) {
      fundScore += 5;
    } else if (earnGr < -10) {
      fundScore -= 10;
    }
  }

  const pe = f?.forwardPE ?? f?.trailingPE ?? null;
  if (pe !== null && pe > 0) {
    if (pe <= 24) {
      fundScore += 8;
      fundNotes.push(`P/E ${pe.toFixed(1)}x`);
    } else if (pe <= 42) {
      fundScore += 3;
      fundNotes.push(`P/E ${pe.toFixed(1)}x`);
    } else if (pe > 75) {
      fundScore -= 10;
      fundNotes.push(`Rich P/E ${pe.toFixed(0)}x`);
    } else if (pe > 55) {
      fundScore -= 4;
    }
  }

  const de = f?.debtToEquity ?? null;
  if (!isFinancialSector && de !== null) {
    if (de <= 0.35) {
      fundScore += 7;
      fundNotes.push(`D/E ${de.toFixed(2)}x`);
    } else if (de <= 0.85) {
      fundScore += 2;
    } else if (de > 1.8) {
      fundScore -= 12;
      fundNotes.push(`High D/E ${de.toFixed(2)}x`);
    } else if (de > 1.2) {
      fundScore -= 5;
    }
  }

  fundScore = round1(clamp(fundScore, 15, 97));

  const trendPts = round2(trendScore * WEIGHTS.trendStructure);
  const rsPts = round2(rsScore * WEIGHTS.relativeStrength);
  const momPts = round2(momentumScore * WEIGHTS.momentumQuality);
  const fundPts = round2(fundScore * WEIGHTS.fundamentalHealth);

  const overallScore = round2(clamp(trendPts + rsPts + momPts + fundPts, 5, 97));
  const tier: ConfidenceBreakdown['tier'] =
    overallScore >= 66 ? 'Strong' : overallScore >= 50 ? 'Moderate' : 'Caution';

  const matchedPatterns = classifyStockPatterns({
    price: safePrice,
    sma50,
    sma200,
    rsi14,
    volumeRatio,
    return1M: input.return1M,
    return6M: input.return6M,
    overallScore,
    trendScore,
    rsScore,
    fundScore,
  });

  return {
    overallScore,
    tier,
    pillars: {
      trendStructure: {
        score: trendScore,
        weight: WEIGHTS.trendStructure,
        weightedPoints: trendPts,
        summary: trendNotes.length > 0 ? trendNotes.slice(0, 2).join(' · ') : 'Moving-average baseline',
      },
      relativeStrength: {
        score: rsScore,
        weight: WEIGHTS.relativeStrength,
        weightedPoints: rsPts,
        summary: rsParts.length > 0 ? rsParts.join(' · ') : 'Tracked vs Nifty 50',
      },
      momentumQuality: {
        score: momentumScore,
        weight: WEIGHTS.momentumQuality,
        weightedPoints: momPts,
        summary: momNotes.length > 0 ? momNotes.slice(0, 2).join(' · ') : 'Neutral momentum',
      },
      fundamentalHealth: {
        score: fundScore,
        weight: WEIGHTS.fundamentalHealth,
        weightedPoints: fundPts,
        summary:
          fundNotes.length > 0 ? fundNotes.slice(0, 2).join(' · ') : 'Baseline sector valuation',
      },
    },
    matchedPatterns,
    primaryPattern: matchedPatterns[0] ?? null,
    computedAt: new Date().toISOString(),
  };
}

function classifyStockPatterns(p: {
  price: number;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  volumeRatio: number;
  return1M: number | null;
  return6M: number | null;
  overallScore: number;
  trendScore: number;
  rsScore: number;
  fundScore: number;
}): PatternId[] {
  const matched: PatternId[] = [];
  const above50 = Boolean(p.sma50 && p.price >= p.sma50);
  const above200 = Boolean(p.sma200 && p.price >= p.sma200);
  const golden = Boolean(p.sma50 && p.sma200 && p.sma50 > p.sma200);
  const dist50Pct = p.sma50 && p.sma50 > 0 ? ((p.price - p.sma50) / p.sma50) * 100 : null;
  const rsi = p.rsi14 ?? 50;

  if (p.overallScore >= 65 && p.trendScore >= 58 && p.rsScore >= 52) {
    matched.push('high_confidence');
  }

  if (
    above50 &&
    (p.return1M ?? 0) >= 3.5 &&
    ((p.volumeRatio >= 1.1 && rsi <= 76) || (rsi >= 54 && rsi <= 72))
  ) {
    matched.push('fresh_upward_move');
  }

  if (above50 && above200 && golden && (p.return6M ?? 0) >= 6 && rsi <= 72) {
    matched.push('steady_upward_trend');
  }

  if (
    (above200 || p.overallScore >= 58) &&
    (p.return6M ?? 0) >= 3 &&
    ((p.return1M !== null && p.return1M <= 1.5 && p.return1M >= -11) ||
      (dist50Pct !== null && dist50Pct >= -5.5 && dist50Pct <= 2.5))
  ) {
    matched.push('strong_on_dip');
  }

  if (above200 && rsi >= 40 && rsi <= 58 && p.trendScore >= 54) {
    matched.push('momentum_reset');
  }

  if (p.fundScore >= 76) {
    matched.push('higher_fundamental');
  }

  return matched;
}

// Technical indicator helpers on raw historical close slices (point-in-time, no lookahead)
function smaAt(closes: number[], endIdx: number, period: number): number | null {
  if (endIdx + 1 < period) return null;
  let sum = 0;
  for (let i = endIdx - period + 1; i <= endIdx; i++) {
    sum += closes[i];
  }
  return sum / period;
}

function rsiAt(closes: number[], endIdx: number): number | null {
  const period = 14;
  if (endIdx < period + 2) return null;
  const start = Math.max(1, endIdx - 60);
  let gains = 0;
  let losses = 0;
  for (let i = start; i < start + period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = start + period; i <= endIdx; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

function retAt(closes: number[], endIdx: number, lookback: number): number | null {
  if (endIdx < lookback) return null;
  const prev = closes[endIdx - lookback];
  if (!prev || prev <= 0) return null;
  return Number((((closes[endIdx] - prev) / prev) * 100).toFixed(2));
}

function formatMonthLabel(tsSec: number): { monthKey: string; monthLabel: string } {
  const d = new Date(tsSec * 1000);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  return { monthKey, monthLabel: `${monthNames[month]} ${year}` };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  async function runner() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runner())
  );
  return results;
}

const PATTERN_HUB_TTL_MS = 6 * 60 * 60 * 1000;
let patternHubCache: { data: PatternDiscoveryResponse; expiresAt: number } | null = null;
let patternHubInFlight: Promise<PatternDiscoveryResponse> | null = null;

export async function getEnrichedScreenerUniverse(): Promise<MarketQuote[]> {
  const [rawStocks, niftyQuote] = await Promise.all([
    getScreenerUniverse(),
    getQuote('^NSEI'),
  ]);

  const fundamentalsMap = await getLiveFundamentalsBatch(
    rawStocks.map((s) => s.symbol),
    8
  );

  return rawStocks.map((stock) => {
    const fund = fundamentalsMap[stock.symbol.toUpperCase()] ?? null;
    const merged = mergeQuoteWithFundamentals(stock, fund);
    const confidence = computeConfidenceBreakdown({
      price: merged.price,
      sma50: merged.sma50,
      sma200: merged.sma200,
      fiftyTwoWeekHigh: merged.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: merged.fiftyTwoWeekLow,
      rsi14: merged.rsi14,
      volumeRatio: merged.volumeRatio,
      dayChangePercent: merged.changePercent,
      return1M: merged.return1M,
      return3M: merged.return3M ?? null,
      return6M: merged.return6M,
      niftyReturn1M: niftyQuote?.return1M ?? null,
      niftyReturn3M: niftyQuote?.return3M ?? null,
      niftyReturn6M: niftyQuote?.return6M ?? null,
      sector: merged.sector,
      fundamentals: {
        trailingPE: merged.peRatio,
        forwardPE: merged.forwardPE,
        roePct: merged.roePct,
        roceProxyPct: merged.roce,
        revenueGrowthPct: merged.revenueGrowthPct,
        earningsGrowthPct: merged.earningsGrowthPct,
        operatingMarginPct: merged.operatingMarginPct,
        debtToEquity: merged.debtToEquity,
      },
    });

    return {
      ...merged,
      confidence,
    };
  });
}

async function buildPatternDiscoveryHub(): Promise<PatternDiscoveryResponse> {
  const enrichedStocks = await getEnrichedScreenerUniverse();
  const stockBySymbol = new Map(enrichedStocks.map((s) => [s.symbol.toUpperCase(), s]));

  // Fetch 3-year daily OHLCV for ^NSEI and the tracked NSE universe for walk-forward 1M & 3M validation
  const [niftyBars, universeSeries] = await Promise.all([
    getRawOhlcvCandles('^NSEI', '3y', '1d'),
    runWithConcurrency(INDIAN_STOCK_UNIVERSE, 8, async (item) => ({
      symbol: item.symbol.toUpperCase(),
      bars: await getRawOhlcvCandles(item.symbol, '3y', '1d'),
    })),
  ]);

  const niftyCloses = niftyBars.map((b) => b.close);
  const niftyDateToIdx = new Map<string, number>();
  niftyBars.forEach((b, idx) => {
    niftyDateToIdx.set(new Date(b.timestamp * 1000).toISOString().slice(0, 10), idx);
  });

  // Track walk-forward observations per pattern
  const wfBuckets: Record<PatternId, Array<{ fwd1M: number; fwd3M: number | null }>> = {
    high_confidence: [],
    fresh_upward_move: [],
    steady_upward_trend: [],
    strong_on_dip: [],
    momentum_reset: [],
    higher_fundamental: [],
  };

  // Track historical monthly cohorts (monthKey -> patternId -> entries)
  const historicalCohorts = new Map<
    string,
    { monthLabel: string; byPattern: Record<PatternId, MonthlyCohortEntry[]> }
  >();

  for (const { symbol, bars } of universeSeries) {
    if (bars.length < 235) continue;
    const stockMeta = stockBySymbol.get(symbol);
    if (!stockMeta) continue;

    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume);

    // Find monthly checkpoint indices (first trading day of each calendar month where >=200 bars precede and >=21 bars follow)
    const checkpointIndices: Array<{ idx: number; monthKey: string; monthLabel: string }> = [];
    let lastMonthKey = '';
    for (let i = 205; i < bars.length - 21; i++) {
      const { monthKey, monthLabel } = formatMonthLabel(bars[i].timestamp);
      if (monthKey !== lastMonthKey) {
        lastMonthKey = monthKey;
        checkpointIndices.push({ idx: i, monthKey, monthLabel });
      }
    }

    // Keep the most recent 24 monthly checkpoints
    const recentCheckpoints = checkpointIndices.slice(-24);

    for (const cp of recentCheckpoints) {
      const i = cp.idx;
      const price = closes[i];
      const sma50 = smaAt(closes, i, 50);
      const sma200 = smaAt(closes, i, 200);
      const rsi14 = rsiAt(closes, i);
      const r1m = retAt(closes, i, 21);
      const r3m = retAt(closes, i, 63);
      const r6m = retAt(closes, i, 126);

      // 20-day average volume ratio strictly <= i
      let volSum = 0;
      const volStart = Math.max(0, i - 20);
      for (let v = volStart; v < i; v++) volSum += volumes[v];
      const avgVol = i > volStart ? volSum / (i - volStart) : 0;
      const volRatio = avgVol > 0 ? volumes[i] / avgVol : 1;

      const dateStr = new Date(bars[i].timestamp * 1000).toISOString().slice(0, 10);
      const niftyIdx = niftyDateToIdx.get(dateStr) ?? -1;
      const n1m = niftyIdx >= 21 ? retAt(niftyCloses, niftyIdx, 21) : null;
      const n3m = niftyIdx >= 63 ? retAt(niftyCloses, niftyIdx, 63) : null;
      const n6m = niftyIdx >= 126 ? retAt(niftyCloses, niftyIdx, 126) : null;

      // 52W high/low strictly <= i
      const lookStart = Math.max(0, i - 250);
      let hi52 = price;
      let lo52 = price;
      for (let k = lookStart; k <= i; k++) {
        if (closes[k] > hi52) hi52 = closes[k];
        if (closes[k] < lo52) lo52 = closes[k];
      }

      const dayChg = i > 0 && closes[i - 1] > 0 ? ((price - closes[i - 1]) / closes[i - 1]) * 100 : 0;

      const breakdown = computeConfidenceBreakdown({
        price,
        sma50,
        sma200,
        fiftyTwoWeekHigh: hi52,
        fiftyTwoWeekLow: lo52,
        rsi14,
        volumeRatio: volRatio,
        dayChangePercent: dayChg,
        return1M: r1m,
        return3M: r3m,
        return6M: r6m,
        niftyReturn1M: n1m,
        niftyReturn3M: n3m,
        niftyReturn6M: n6m,
        sector: stockMeta.sector,
        fundamentals: {
          trailingPE: stockMeta.peRatio,
          forwardPE: stockMeta.forwardPE,
          roePct: stockMeta.roePct,
          roceProxyPct: stockMeta.roce,
          revenueGrowthPct: stockMeta.revenueGrowthPct,
          earningsGrowthPct: stockMeta.earningsGrowthPct,
          operatingMarginPct: stockMeta.operatingMarginPct,
          debtToEquity: stockMeta.debtToEquity,
        },
      });

      const fwd1M =
        i + 21 < closes.length && price > 0
          ? Number((((closes[i + 21] - price) / price) * 100).toFixed(2))
          : null;
      const fwd3M =
        i + 63 < closes.length && price > 0
          ? Number((((closes[i + 63] - price) / price) * 100).toFixed(2))
          : null;

      if (fwd1M === null) continue;

      for (const pat of breakdown.matchedPatterns) {
        wfBuckets[pat].push({ fwd1M, fwd3M });

        if (!historicalCohorts.has(cp.monthKey)) {
          historicalCohorts.set(cp.monthKey, {
            monthLabel: cp.monthLabel,
            byPattern: {
              high_confidence: [],
              fresh_upward_move: [],
              steady_upward_trend: [],
              strong_on_dip: [],
              momentum_reset: [],
              higher_fundamental: [],
            },
          });
        }
        historicalCohorts.get(cp.monthKey)!.byPattern[pat].push({
          symbol: stockMeta.symbol,
          ticker: stockMeta.ticker,
          companyName: stockMeta.shortName,
          exchange: stockMeta.exchange === 'BSE' ? 'BSE' : 'NSE',
          sector: stockMeta.sector,
          confidenceScore: breakdown.overallScore,
          return1M: fwd1M,
          return3M: fwd3M,
          ltp: stockMeta.price,
          nextEarningsDate: stockMeta.nextEarningsDate ?? null,
          daysToEarnings: stockMeta.daysToEarnings ?? null,
          earningsRiskFlag: Boolean(stockMeta.earningsRiskFlag),
          breakdown,
        });
      }
    }
  }

  const nowEpochSec = Math.floor(Date.now() / 1000);
  const currentMonth = formatMonthLabel(nowEpochSec);

  const sortedHistoricalKeys = Array.from(historicalCohorts.keys())
    .filter((k) => k < currentMonth.monthKey)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 3);

  const patterns: PatternDiscoveryItem[] = PATTERN_ORDER.map((patId) => {
    const meta = PATTERN_METADATA[patId];
    const obs = wfBuckets[patId];
    const obs3M = obs.filter((o): o is { fwd1M: number; fwd3M: number } => o.fwd3M !== null);

    const winRate1M =
      obs.length > 0
        ? round1((obs.filter((o) => o.fwd1M > 0).length / obs.length) * 100)
        : null;
    const avgReturn1M =
      obs.length > 0
        ? round2(obs.reduce((sum, o) => sum + o.fwd1M, 0) / obs.length)
        : null;
    const winRate3M =
      obs3M.length > 0
        ? round1((obs3M.filter((o) => o.fwd3M > 0).length / obs3M.length) * 100)
        : null;
    const avgReturn3M =
      obs3M.length > 0
        ? round2(obs3M.reduce((sum, o) => sum + o.fwd3M, 0) / obs3M.length)
        : null;

    const liveMatches = enrichedStocks
      .filter((s) => s.confidence?.matchedPatterns.includes(patId))
      .sort((a, b) => (b.confidence?.overallScore ?? 0) - (a.confidence?.overallScore ?? 0));

    const latestEntries: MonthlyCohortEntry[] = liveMatches.map((s) => ({
      symbol: s.symbol,
      ticker: s.ticker,
      companyName: s.shortName,
      exchange: s.exchange === 'BSE' ? 'BSE' : 'NSE',
      sector: s.sector,
      confidenceScore: s.confidence?.overallScore ?? 50,
      return1M: s.return1M,
      return3M: s.return3M ?? null,
      ltp: s.price,
      nextEarningsDate: s.nextEarningsDate ?? null,
      daysToEarnings: s.daysToEarnings ?? null,
      earningsRiskFlag: Boolean(s.earningsRiskFlag),
      breakdown: s.confidence,
    }));

    const cohorts: MonthlyCohortGroup[] = [];
    if (latestEntries.length > 0) {
      cohorts.push({
        monthKey: currentMonth.monthKey,
        monthLabel: currentMonth.monthLabel,
        isLatest: true,
        entries: latestEntries,
      });
    }

    for (const mKey of sortedHistoricalKeys) {
      const bucket = historicalCohorts.get(mKey);
      if (!bucket) continue;
      const list = bucket.byPattern[patId]
        .slice()
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, 8);
      if (list.length > 0) {
        cohorts.push({
          monthKey: mKey,
          monthLabel: bucket.monthLabel,
          isLatest: false,
          entries: list,
        });
      }
    }

    const upcomingEarningsCount = liveMatches.filter((s) => s.earningsRiskFlag).length;

    return {
      id: patId,
      title: meta.title,
      subtitle: meta.subtitle,
      ruleSummary: meta.ruleSummary,
      liveCount: liveMatches.length,
      liveSymbols: liveMatches.map((s) => s.symbol),
      hasUpcomingEarningsAlert: upcomingEarningsCount > 0,
      upcomingEarningsCount,
      walkForward: {
        sampleCount: obs.length,
        winRate1M,
        avgReturn1M,
        winRate3M,
        avgReturn3M,
        lookbackMonths: 24,
        basisNote:
          'Walk-forward monthly NSE OHLCV simulation (point-in-time technical & Nifty 50 relative strength rules, zero lookahead).',
      },
      monthlyCohorts: cohorts,
    };
  });

  return {
    patterns,
    benchmarkSymbol: '^NSEI',
    universeCount: enrichedStocks.length,
    computedAt: new Date().toISOString(),
  };
}

export async function getPatternDiscoveryHub(forceRefresh = false): Promise<PatternDiscoveryResponse> {
  if (!forceRefresh && patternHubCache && patternHubCache.expiresAt > Date.now()) {
    return patternHubCache.data;
  }

  if (!patternHubInFlight) {
    patternHubInFlight = buildPatternDiscoveryHub()
      .then((data) => {
        patternHubCache = {
          data,
          expiresAt: Date.now() + PATTERN_HUB_TTL_MS,
        };
        return data;
      })
      .finally(() => {
        patternHubInFlight = null;
      });
  }

  return patternHubInFlight;
}

export async function getEnrichedResearchSignals(): Promise<LiveResearchSignal[]> {
  const [baseSignals, niftyQuote, patternHub] = await Promise.all([
    getLiveResearchSignals(),
    getQuote('^NSEI'),
    getPatternDiscoveryHub().catch(() => null),
  ]);

  const fundamentalsMap = await getLiveFundamentalsBatch(
    baseSignals.map((s) => s.symbol),
    6
  );

  const walkForwardByPattern = new Map<PatternId, WalkForwardStats>();
  for (const pat of patternHub?.patterns ?? []) {
    walkForwardByPattern.set(pat.id, pat.walkForward);
  }

  return baseSignals.map((sig) => {
    const fund: LiveFundamentalsSnapshot | null =
      fundamentalsMap[sig.symbol.toUpperCase()] ?? null;
    const mergedQuote = sig.liveQuote ? mergeQuoteWithFundamentals(sig.liveQuote, fund) : null;

    if (!mergedQuote) {
      return {
        ...sig,
        liveQuote: null,
        fundamentals: fund,
      };
    }

    const confidence = computeConfidenceBreakdown({
      price: mergedQuote.price,
      sma50: mergedQuote.sma50,
      sma200: mergedQuote.sma200,
      fiftyTwoWeekHigh: mergedQuote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: mergedQuote.fiftyTwoWeekLow,
      rsi14: mergedQuote.rsi14,
      volumeRatio: mergedQuote.volumeRatio,
      dayChangePercent: mergedQuote.changePercent,
      return1M: mergedQuote.return1M,
      return3M: mergedQuote.return3M ?? null,
      return6M: mergedQuote.return6M,
      niftyReturn1M: niftyQuote?.return1M ?? null,
      niftyReturn3M: niftyQuote?.return3M ?? null,
      niftyReturn6M: niftyQuote?.return6M ?? null,
      sector: mergedQuote.sector,
      fundamentals: {
        trailingPE: mergedQuote.peRatio,
        forwardPE: mergedQuote.forwardPE,
        roePct: mergedQuote.roePct,
        roceProxyPct: mergedQuote.roce,
        revenueGrowthPct: mergedQuote.revenueGrowthPct,
        earningsGrowthPct: mergedQuote.earningsGrowthPct,
        operatingMarginPct: mergedQuote.operatingMarginPct,
        debtToEquity: mergedQuote.debtToEquity,
      },
    });

    const primaryPattern: PatternId =
      confidence.primaryPattern ?? 'high_confidence';
    const walkForward =
      walkForwardByPattern.get(primaryPattern) ??
      walkForwardByPattern.get('high_confidence') ??
      null;

    return {
      ...sig,
      liveQuote: { ...mergedQuote, confidence },
      confidence,
      primaryPattern,
      walkForward,
      fundamentals: fund,
    };
  });
}
