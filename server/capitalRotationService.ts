import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getChart, getQuotes, getScreenerUniverse } from './marketService.ts';
import type { HoldingAnalysisInput } from './portfolioAnalyzer.ts';
import type {
  AiStrategiesResponse,
  AiStrategyBasket,
  CapitalRotationPair,
  CapitalRotationResponse,
  CandlePoint,
  Exchange,
  MarketQuote,
  RotationActionType,
  RotationReplacementPick,
  StrategyChartPoint,
  StrategyConstituent,
  StrategyRotationLogItem,
} from '../src/types/market.ts';

const STRATEGY_TTL_MS = 5 * 60 * 1000;
let strategyCache: { data: AiStrategiesResponse; expiresAt: number } | null = null;

const ROTATION_QUOTA_NOTICE =
  'Gemini API free-tier daily quota was reached. Showing quantitative Smart Capital Rotation pairings grounded in live NSE/BSE valuation, ROCE, 50/200-DMA, and RSI-14 telemetry.';

function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /429|RESOURCE_EXHAUSTED|quota|rate[-_\s]?limit/i.test(msg);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  async function next() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

function scoreUndervaluedCandidate(
  q: MarketQuote,
  sectorWeights: Map<string, number>
): { score: number; diversificationBonus: boolean; defaultThesis: string } {
  let score = 38;

  // 1. Capital Efficiency (ROCE)
  if (q.sector === 'Banking') {
    // Banking uses P/E & price/book proxy instead of industrial ROCE
    if (q.peRatio !== null && q.peRatio <= 16) score += 20;
    else if (q.peRatio !== null && q.peRatio <= 22) score += 14;
  } else if (q.roce !== null) {
    if (q.roce >= 28) score += 24;
    else if (q.roce >= 20) score += 18;
    else if (q.roce >= 14) score += 11;
    else if (q.roce < 8) score -= 18;
  }

  // 2. Valuation Margin of Safety (P/E)
  if (q.peRatio !== null) {
    if (q.peRatio > 0 && q.peRatio <= 18) score += 22;
    else if (q.peRatio <= 28) score += 15;
    else if (q.peRatio <= 38) score += 7;
    else if (q.peRatio > 60) score -= 14;
  } else {
    score -= 10;
  }

  // 3. Balance Sheet Strength
  if (q.debtToEquity !== null) {
    if (q.debtToEquity <= 0.3) score += 10;
    else if (q.debtToEquity <= 0.7) score += 5;
    else if (q.debtToEquity > 1.5) score -= 8;
  }

  // 4. Constructive Entry Zone (non-overbought value + trend support)
  const rsi = q.rsi14 ?? 50;
  if (rsi >= 34 && rsi <= 56) score += 16;
  else if (rsi < 34 && (q.roce ?? 12) >= 12) score += 14;
  else if (rsi >= 72) score -= 14;

  if (q.sma200 && q.price >= q.sma200) score += 6;
  if (q.sma50 && q.price >= q.sma50 * 0.96 && q.price <= q.sma50 * 1.08) score += 5;

  const sectorWt = sectorWeights.get(q.sector) ?? 0;
  const diversificationBonus = sectorWt < 10;
  if (diversificationBonus) {
    score += 10;
  }

  const finalScore = Math.round(clampNum(score, 15, 98));

  const reasons: string[] = [];
  if (q.roce !== null && q.roce >= 18) reasons.push(`${q.roce.toFixed(1)}% ROCE`);
  if (q.peRatio !== null && q.peRatio <= 30) reasons.push(`fair ${q.peRatio.toFixed(1)}x P/E`);
  if (rsi < 45) reasons.push(`accumulation RSI (${rsi.toFixed(1)})`);
  else if (q.sma50 && q.price >= q.sma50) reasons.push('holding 50-DMA support');
  if (diversificationBonus) reasons.push(`adds ${q.sector} diversification`);

  const defaultThesis =
    reasons.length > 0
      ? `Attractive risk-reward backed by ${reasons.join(', ')}.`
      : `Balanced valuation and steady momentum in ${q.sector}.`;

  return { score: finalScore, diversificationBonus, defaultThesis };
}

function buildReplacementPick(
  q: MarketQuote,
  scored: { score: number; diversificationBonus: boolean; defaultThesis: string }
): RotationReplacementPick {
  const beta = clampNum(q.beta || 1, 0.65, 1.65);
  const live = Number(q.price.toFixed(2));
  const suggestedTarget = Number((live * (1 + 0.17 * beta)).toFixed(2));
  const supportStop =
    q.sma50 && q.sma50 < live * 0.96 && q.sma50 > live * 0.84
      ? Number((q.sma50 * 0.985).toFixed(2))
      : Number((live * (1 - 0.08 * beta)).toFixed(2));

  return {
    symbol: q.symbol,
    ticker: q.ticker,
    companyName: q.shortName,
    exchange: (q.exchange === 'BSE' ? 'BSE' : 'NSE') as Exchange,
    sector: q.sector,
    capCategory: q.capCategory,
    livePrice: live,
    roce: q.roce,
    peRatio: q.peRatio,
    debtToEquity: q.debtToEquity,
    rsi14: q.rsi14,
    return6M: q.return6M,
    return1Y: q.return1Y,
    undervaluedScore: scored.score,
    sectorDiversificationBonus: scored.diversificationBonus,
    rotationThesis: scored.defaultThesis,
    suggestedTarget,
    suggestedStopLoss: supportStop,
  };
}

export async function generateCapitalRotation(
  holdings: HoldingAnalysisInput[]
): Promise<CapitalRotationResponse> {
  if (holdings.length === 0) {
    throw new Error('Add at least one equity holding to scan Smart Capital Rotation opportunities.');
  }

  // Consolidate multi-lot holdings by symbol
  const consolidated = new Map<string, HoldingAnalysisInput>();
  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();
    const existing = consolidated.get(sym);
    if (!existing) {
      consolidated.set(sym, { ...h, symbol: sym });
    } else {
      const totalQty = existing.quantity + h.quantity;
      const totalCost = existing.quantity * existing.avgBuyPrice + h.quantity * h.avgBuyPrice;
      consolidated.set(sym, {
        ...existing,
        quantity: Number(totalQty.toFixed(4)),
        avgBuyPrice: totalQty > 0 ? Number((totalCost / totalQty).toFixed(2)) : existing.avgBuyPrice,
        buyDate: existing.buyDate <= h.buyDate ? existing.buyDate : h.buyDate,
      });
    }
  }
  const uniqueHoldings = Array.from(consolidated.values());

  const [holdingQuotes, universeQuotes] = await Promise.all([
    getQuotes(Array.from(new Set(['^NSEI', ...uniqueHoldings.map((h) => h.symbol)]))),
    getScreenerUniverse(),
  ]);

  const nifty = holdingQuotes['^NSEI'] ?? null;
  const nifty6M = nifty?.return6M ?? 0;

  let totalPortfolioValue = 0;
  const enrichedHoldings = uniqueHoldings.map((h) => {
    const q = holdingQuotes[h.symbol] ?? null;
    const livePrice = q?.price && q.price > 0 ? q.price : h.avgBuyPrice;
    const invested = h.quantity * h.avgBuyPrice;
    const currentValue = h.quantity * livePrice;
    totalPortfolioValue += currentValue;
    const unrealizedPnlPercent =
      invested > 0 ? Number((((currentValue - invested) / invested) * 100).toFixed(2)) : 0;

    return {
      ...h,
      ticker: h.symbol.replace(/\.(NS|BO)$/, ''),
      sector: q?.sector || h.sector,
      quote: q,
      livePrice: Number(livePrice.toFixed(2)),
      currentValue: Number(currentValue.toFixed(2)),
      unrealizedPnlPercent,
    };
  });

  const sectorWeights = new Map<string, number>();
  const weightBySymbol = new Map<string, number>();
  for (const eh of enrichedHoldings) {
    const wt = totalPortfolioValue > 0 ? (eh.currentValue / totalPortfolioValue) * 100 : 0;
    weightBySymbol.set(eh.symbol.toUpperCase(), wt);
    sectorWeights.set(eh.sector, (sectorWeights.get(eh.sector) ?? 0) + wt);
  }

  // Score candidate replacement pool
  const heldSymbols = new Set(enrichedHoldings.map((h) => h.symbol.toUpperCase()));
  const scoredPool = universeQuotes
    .filter((q) => {
      if (q.price <= 0) return false;
      const sym = q.symbol.toUpperCase();
      // Exclude oversized existing positions from being suggested again
      if ((weightBySymbol.get(sym) ?? 0) >= 14) return false;
      if (q.roce !== null && q.roce < 7) return false;
      return true;
    })
    .map((q) => {
      const scored = scoreUndervaluedCandidate(q, sectorWeights);
      return buildReplacementPick(q, scored);
    })
    .sort((a, b) => b.undervaluedScore - a.undervaluedScore);

  const standaloneIdeas = scoredPool.filter((c) => !heldSymbols.has(c.symbol)).slice(0, 4);

  // Evaluate source holdings for TRIM_PROFIT or EXIT_LAGGARD
  const flaggedSources: Array<{
    holding: (typeof enrichedHoldings)[number];
    actionType: RotationActionType;
    suggestedTrimPercent: number;
    estimatedFreedCapital: number;
    portfolioWeightPercent: number;
    triggerReason: string;
  }> = [];

  for (const eh of enrichedHoldings) {
    const q = eh.quote;
    const weight = weightBySymbol.get(eh.symbol.toUpperCase()) ?? 0;
    const rsi = q?.rsi14 ?? 50;
    const ret6m = q?.return6M ?? null;
    const relNifty6M = ret6m !== null ? ret6m - nifty6M : null;
    const above50 = q?.sma50 ? eh.livePrice >= q.sma50 : null;
    const deepBelow200 = q?.sma200 ? eh.livePrice < q.sma200 * 0.92 : false;
    const pe = q?.peRatio ?? null;
    const roce = q?.roce ?? null;

    if (
      (deepBelow200 && ((ret6m ?? 0) < -8 || (relNifty6M ?? 0) <= -10)) ||
      (roce !== null && roce < 7 && eh.unrealizedPnlPercent < -10)
    ) {
      flaggedSources.push({
        holding: eh,
        actionType: 'EXIT_LAGGARD',
        suggestedTrimPercent: 100,
        estimatedFreedCapital: Math.round(eh.currentValue),
        portfolioWeightPercent: Number(weight.toFixed(1)),
        triggerReason:
          roce !== null && roce < 7
            ? `Low capital efficiency (${roce.toFixed(1)}% ROCE) with ${eh.unrealizedPnlPercent.toFixed(1)}% drawdown — rotate out to stop opportunity bleed.`
            : `Trading below 200-DMA (${ret6m !== null ? `${ret6m.toFixed(1)}% 6M` : 'weak trend'}) and lagging Nifty 50 — redeploy into stronger setups.`,
      });
      continue;
    }

    const isTripleDigitRun = eh.unrealizedPnlPercent >= 85;
    const isOverextendedWinner =
      eh.unrealizedPnlPercent >= 35 &&
      (rsi >= 67 || weight >= 16 || (pe !== null && pe >= 55 && above50 === true));
    const isOversizedWinner = weight >= 22 && eh.unrealizedPnlPercent > 15;

    if (isTripleDigitRun || isOverextendedWinner || isOversizedWinner) {
      const trimPct = isTripleDigitRun
        ? rsi >= 70 || weight >= 18
          ? 45
          : 35
        : isOversizedWinner
        ? 30
        : 30;
      const freed = Math.round(eh.currentValue * (trimPct / 100));
      const reasonParts: string[] = [
        `${eh.unrealizedPnlPercent >= 0 ? '+' : ''}${eh.unrealizedPnlPercent.toFixed(1)}% unrealized gain`,
      ];
      if (rsi >= 67) reasonParts.push(`extended RSI ${rsi.toFixed(1)}`);
      if (pe !== null && pe >= 50) reasonParts.push(`rich ${pe.toFixed(1)}x P/E`);
      if (weight >= 16) reasonParts.push(`${weight.toFixed(1)}% concentration`);

      flaggedSources.push({
        holding: eh,
        actionType: 'TRIM_PROFIT',
        suggestedTrimPercent: trimPct,
        estimatedFreedCapital: freed,
        portfolioWeightPercent: Number(weight.toFixed(1)),
        triggerReason: `Lock partial profits (${reasonParts.join(' · ')}) and rotate ${trimPct}% into undervalued sectors.`,
      });
    }
  }

  // Pair each flagged source with top 2 undervalued replacements prioritizing sector diversity
  const pairs: CapitalRotationPair[] = flaggedSources
    .sort((a, b) => b.estimatedFreedCapital - a.estimatedFreedCapital)
    .map((src, idx) => {
      const preferred = scoredPool
        .filter((cand) => cand.symbol !== src.holding.symbol)
        .sort((a, b) => {
          const aDiffSector = a.sector !== src.holding.sector ? 8 : 0;
          const bDiffSector = b.sector !== src.holding.sector ? 8 : 0;
          return b.undervaluedScore + bDiffSector - (a.undervaluedScore + aDiffSector);
        });

      // Stagger offset slightly across pairs when pool is rich so suggestions aren't identical clones
      const startOffset = preferred.length > 6 ? (idx * 2) % Math.max(1, preferred.length - 4) : 0;
      const picks = preferred.slice(startOffset, startOffset + 2);
      const finalPicks = picks.length >= 2 ? picks : preferred.slice(0, 2);

      return {
        sourceSymbol: src.holding.symbol,
        sourceTicker: src.holding.ticker,
        sourceCompanyName: src.holding.companyName,
        sourceSector: src.holding.sector,
        actionType: src.actionType,
        currentValue: src.holding.currentValue,
        livePrice: src.holding.livePrice,
        unrealizedPnlPercent: src.holding.unrealizedPnlPercent,
        portfolioWeightPercent: src.portfolioWeightPercent,
        suggestedTrimPercent: src.suggestedTrimPercent,
        estimatedFreedCapital: src.estimatedFreedCapital,
        triggerReason: src.triggerReason,
        candidates: finalPicks,
      };
    });

  let analysisSource: 'gemini' | 'fallback_engine' = 'fallback_engine';
  let quotaNotice: string | undefined;

  // Optional Gemini narrative polish for paired rotations
  if (pairs.length > 0 && process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      const compactPairs = pairs.slice(0, 12).map((p) => ({
        src: p.sourceSymbol,
        act: p.actionType,
        pnlPct: p.unrealizedPnlPercent,
        trimPct: p.suggestedTrimPercent,
        freedInr: p.estimatedFreedCapital,
        srcSec: p.sourceSector,
        picks: p.candidates.map((c) => ({
          sym: c.symbol,
          sec: c.sector,
          roce: c.roce,
          pe: c.peRatio,
          rsi: c.rsi14,
          r6m: c.return6M,
        })),
      }));

      const prompt = `Write crisp 1-sentence institutional Smart Capital Rotation rationales for these Indian NSE pairs (source profit-book/exit -> undervalued replacement picks). Keep triggerReason focused on why locking gains/exiting protects capital and rotationThesis focused on why each replacement captures better risk-reward.
Pairs: ${JSON.stringify(compactPairs)}`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sourceSymbol: { type: Type.STRING },
                triggerReason: { type: Type.STRING },
                pickTheses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      symbol: { type: Type.STRING },
                      rotationThesis: { type: Type.STRING },
                    },
                    required: ['symbol', 'rotationThesis'],
                  },
                },
              },
              required: ['sourceSymbol', 'triggerReason', 'pickTheses'],
            },
          },
        },
        required: ['items'],
      };

      const modelCandidates: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
        { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
        { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      ];

      let lastErr: unknown;
      for (const candidate of modelCandidates) {
        try {
          const response = await ai.models.generateContent({
            model: candidate.model,
            contents: prompt,
            config: {
              temperature: 0.1,
              thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
              systemInstruction:
                'You are an institutional Indian equity portfolio strategist. Ground every sentence strictly in the provided telemetry numbers.',
              responseMimeType: 'application/json',
              responseSchema: schema,
            },
          });

          const parsed = JSON.parse((response.text ?? '{}').trim()) as {
            items?: Array<{
              sourceSymbol?: string;
              triggerReason?: string;
              pickTheses?: Array<{ symbol?: string; rotationThesis?: string }>;
            }>;
          };

          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            const aiBySource = new Map(
              parsed.items
                .filter((i) => i.sourceSymbol)
                .map((i) => [i.sourceSymbol!.toUpperCase(), i])
            );
            for (const p of pairs) {
              const match = aiBySource.get(p.sourceSymbol.toUpperCase());
              if (!match) continue;
              if (match.triggerReason) p.triggerReason = match.triggerReason;
              if (Array.isArray(match.pickTheses)) {
                const thesisBySym = new Map(
                  match.pickTheses
                    .filter((pt) => pt.symbol && pt.rotationThesis)
                    .map((pt) => [pt.symbol!.toUpperCase(), pt.rotationThesis!])
                );
                p.candidates = p.candidates.map((c) => ({
                  ...c,
                  rotationThesis: thesisBySym.get(c.symbol.toUpperCase()) ?? c.rotationThesis,
                }));
              }
            }
            analysisSource = 'gemini';
            break;
          }
        } catch (err) {
          lastErr = err;
        }
      }

      if (analysisSource !== 'gemini' && lastErr) {
        quotaNotice = isQuotaError(lastErr)
          ? ROTATION_QUOTA_NOTICE
          : 'Live AI narrative unavailable; displaying deterministic quantitative Smart Capital Rotation pairings.';
      }
    } catch {
      quotaNotice = ROTATION_QUOTA_NOTICE;
    }
  } else if (!process.env.GEMINI_API_KEY && pairs.length > 0) {
    analysisSource = 'fallback_engine';
  }

  const totalEligibleFreedCapital = pairs.reduce((s, p) => s + p.estimatedFreedCapital, 0);
  const trimCount = pairs.filter((p) => p.actionType === 'TRIM_PROFIT').length;
  const exitCount = pairs.filter((p) => p.actionType === 'EXIT_LAGGARD').length;

  const sourceRoces = flaggedSources
    .map((s) => s.holding.quote?.roce)
    .filter((v): v is number => v !== null && v !== undefined);
  const repRoces = pairs
    .flatMap((p) => p.candidates.map((c) => c.roce))
    .filter((v): v is number => v !== null && v !== undefined);

  const avgSourceRoce =
    sourceRoces.length > 0
      ? Number((sourceRoces.reduce((a, b) => a + b, 0) / sourceRoces.length).toFixed(1))
      : null;
  const avgReplacementRoce =
    repRoces.length > 0
      ? Number((repRoces.reduce((a, b) => a + b, 0) / repRoces.length).toFixed(1))
      : null;

  return {
    totalEligibleFreedCapital,
    trimCount,
    exitCount,
    avgSourceRoce,
    avgReplacementRoce,
    pairs,
    standaloneIdeas,
    benchmarkNifty6M: nifty?.return6M ?? null,
    analysisSource,
    quotaNotice,
    generatedAt: new Date().toISOString(),
  };
}

interface StrategyDefinition {
  id: string;
  name: string;
  tagline: string;
  methodology: string;
  riskProfile: 'Low' | 'Moderate' | 'Aggressive';
  rebalanceCadence: string;
  scoreStock: (q: MarketQuote, nifty6M: number) => { eligible: boolean; score: number; reason: string };
}

const STRATEGY_DEFS: StrategyDefinition[] = [
  {
    id: 'bharat_momentum',
    name: 'Bharat Momentum Leaders',
    tagline: 'Institutional trend leaders outperforming Nifty 50 above 50 & 200-DMA',
    methodology:
      'Ranks liquid NSE equities trading above key moving averages by 6M relative alpha vs. Nifty 50, volume confirmation, and disciplined non-extreme RSI.',
    riskProfile: 'Aggressive',
    rebalanceCadence: 'Monthly Quantitative',
    scoreStock: (q, nifty6M) => {
      if (q.price <= 0) return { eligible: false, score: 0, reason: '' };
      const above50 = q.sma50 ? q.price >= q.sma50 : false;
      const above200 = q.sma200 ? q.price >= q.sma200 : false;
      const rel6m = (q.return6M ?? 0) - nifty6M;
      const rsi = q.rsi14 ?? 50;
      const score =
        40 +
        (above50 ? 18 : 0) +
        (above200 ? 16 : -10) +
        clampNum(rel6m * 0.9, -15, 25) +
        (q.volumeRatio >= 1.1 ? 8 : 0) +
        (rsi > 78 ? -12 : 4);
      const reason = `6M vs Nifty ${rel6m >= 0 ? '+' : ''}${rel6m.toFixed(1)}% · ${
        above50 && above200 ? 'Above 50 & 200-DMA' : above200 ? 'Above 200-DMA' : 'Momentum recovery'
      }`;
      return { eligible: (q.roce ?? 12) >= 6, score: Math.round(clampNum(score, 10, 99)), reason };
    },
  },
  {
    id: 'undervalued_compounders',
    name: 'Undervalued Compounders',
    tagline: 'High-ROCE capital compounders at reasonable P/E multiples',
    methodology:
      'Screens India’s core franchises combining ROCE >= 15%, controlled leverage (D/E <= 0.7), and disciplined valuation multiples before crowded breakouts.',
    riskProfile: 'Moderate',
    rebalanceCadence: 'Monthly Quantitative',
    scoreStock: (q) => {
      if (q.price <= 0 || (q.peRatio !== null && q.peRatio <= 0)) {
        return { eligible: false, score: 0, reason: '' };
      }
      const roce = q.roce ?? 0;
      const pe = q.peRatio ?? 40;
      const de = q.debtToEquity ?? 0.3;
      const rsi = q.rsi14 ?? 50;
      const score =
        30 +
        clampNum(roce * 0.85, 0, 32) +
        (pe <= 20 ? 22 : pe <= 32 ? 14 : pe > 55 ? -14 : 4) +
        (de <= 0.5 ? 10 : de > 1.4 ? -10 : 3) +
        (rsi >= 35 && rsi <= 58 ? 8 : 0);
      const reason = `ROCE ${roce > 0 ? `${roce.toFixed(1)}%` : 'Bank proxy'} · P/E ${pe.toFixed(1)}x · RSI ${rsi.toFixed(1)}`;
      return {
        eligible: q.sector === 'Banking' ? pe <= 22 : roce >= 12,
        score: Math.round(clampNum(score, 10, 99)),
        reason,
      };
    },
  },
  {
    id: 'capex_midcap_alpha',
    name: 'Domestic Capex & Mid-Cap Alpha',
    tagline: 'Defence, infrastructure, manufacturing & high-growth challengers',
    methodology:
      'Captures India’s domestic capital expenditure cycle and non-Nifty-heavy growth sectors exhibiting strong capital efficiency and earnings runway.',
    riskProfile: 'Aggressive',
    rebalanceCadence: 'Monthly Quantitative',
    scoreStock: (q) => {
      const capexSectors = new Set([
        'Defence & Aerospace',
        'Infrastructure',
        'Auto',
        'Metals & Mining',
        'Capital Goods',
        'Healthcare',
        'Consumer Durables',
        'Retail',
      ]);
      const isCapexOrMid = capexSectors.has(q.sector) || q.capCategory === 'Mid Cap';
      if (!isCapexOrMid || q.price <= 0) return { eligible: false, score: 0, reason: '' };
      const score =
        42 +
        clampNum((q.roce ?? 12) * 0.65, 0, 24) +
        clampNum((q.return6M ?? 0) * 0.6, -12, 22) +
        (q.capCategory === 'Mid Cap' ? 8 : 2) +
        (q.sma50 && q.price >= q.sma50 ? 6 : 0);
      const reason = `${q.capCategory} · ${q.sector} · 6M ${
        (q.return6M ?? 0) >= 0 ? '+' : ''
      }${(q.return6M ?? 0).toFixed(1)}%`;
      return { eligible: (q.roce ?? 10) >= 8, score: Math.round(clampNum(score, 10, 99)), reason };
    },
  },
  {
    id: 'defensive_shield',
    name: 'Quality Value & Low-Beta Shield',
    tagline: 'Resilient large-cap cash compounders built to contain drawdowns',
    methodology:
      'Prioritizes beta <= 1.05, established large-cap balance sheets, low P/E multiples, and stable capital returns to dampen volatility during market pullbacks.',
    riskProfile: 'Low',
    rebalanceCadence: 'Monthly Quantitative',
    scoreStock: (q) => {
      if (q.price <= 0 || q.capCategory !== 'Large Cap') {
        return { eligible: false, score: 0, reason: '' };
      }
      const pe = q.peRatio ?? 35;
      const beta = q.beta || 1;
      const score =
        44 +
        (beta <= 0.85 ? 20 : beta <= 1.0 ? 14 : beta > 1.2 ? -15 : 4) +
        (pe <= 24 ? 18 : pe <= 35 ? 10 : -8) +
        clampNum((q.roce ?? 10) * 0.5, 0, 18);
      const reason = `Beta ${beta.toFixed(2)}x · P/E ${pe.toFixed(1)}x · ${q.sector}`;
      return { eligible: (q.roce ?? 8) >= 7, score: Math.round(clampNum(score, 10, 99)), reason };
    },
  },
];

function computeSeriesReturnPct(values: number[], lookbackBars: number): number | null {
  if (values.length < 5) return null;
  const latest = values[values.length - 1];
  const baseIdx = Math.max(0, values.length - 1 - lookbackBars);
  const base = values[baseIdx];
  if (!base || base <= 0) return null;
  return Number((((latest - base) / base) * 100).toFixed(2));
}

function buildIndexedStrategyCurve(
  constituents: StrategyConstituent[],
  candlesBySymbol: Map<string, CandlePoint[]>,
  niftyCandles: CandlePoint[]
): {
  chartSeries: StrategyChartPoint[];
  return1M: number | null;
  return6M: number | null;
  return1Y: number | null;
  nifty1M: number | null;
  nifty6M: number | null;
  nifty1Y: number | null;
} {
  if (niftyCandles.length < 20) {
    return {
      chartSeries: [],
      return1M: null,
      return6M: null,
      return1Y: null,
      nifty1M: null,
      nifty6M: null,
      nifty1Y: null,
    };
  }

  // Build lookup by dateLabel for each constituent
  const priceBySymAndDate = new Map<string, Map<string, number>>();
  for (const c of constituents) {
    const pts = candlesBySymbol.get(c.symbol) ?? [];
    const m = new Map<string, number>();
    for (const p of pts) {
      if (p.close > 0) m.set(p.dateLabel, p.close);
    }
    priceBySymAndDate.set(c.symbol, m);
  }

  // Find starting baseline index per constituent where price exists near start of nifty window
  const baseCloseBySym = new Map<string, number>();
  const lastKnownBySym = new Map<string, number>();

  for (const c of constituents) {
    const map = priceBySymAndDate.get(c.symbol);
    if (!map || map.size === 0) continue;
    for (const np of niftyCandles.slice(0, 15)) {
      const val = map.get(np.dateLabel);
      if (val && val > 0) {
        baseCloseBySym.set(c.symbol, val);
        lastKnownBySym.set(c.symbol, val);
        break;
      }
    }
  }

  const niftyBase = niftyCandles[0].close || 1;
  const rawSeries: StrategyChartPoint[] = [];

  for (const np of niftyCandles) {
    let sumIdx = 0;
    let count = 0;

    for (const c of constituents) {
      const base = baseCloseBySym.get(c.symbol);
      if (!base) continue;
      const map = priceBySymAndDate.get(c.symbol);
      const dayClose = map?.get(np.dateLabel);
      if (dayClose && dayClose > 0) {
        lastKnownBySym.set(c.symbol, dayClose);
      }
      const activeClose = lastKnownBySym.get(c.symbol) ?? base;
      sumIdx += (activeClose / base) * 100;
      count += 1;
    }

    const stratVal = count > 0 ? Number((sumIdx / count).toFixed(2)) : 100;
    const niftyVal = Number(((np.close / niftyBase) * 100).toFixed(2));
    rawSeries.push({
      dateLabel: np.dateLabel,
      strategyIndexed: stratVal,
      niftyIndexed: niftyVal,
    });
  }

  const stratValues = rawSeries.map((r) => r.strategyIndexed);
  const niftyValues = rawSeries.map((r) => r.niftyIndexed);

  return {
    chartSeries: rawSeries,
    return1M: computeSeriesReturnPct(stratValues, 21),
    return6M: computeSeriesReturnPct(stratValues, 126),
    return1Y: computeSeriesReturnPct(stratValues, rawSeries.length - 1),
    nifty1M: computeSeriesReturnPct(niftyValues, 21),
    nifty6M: computeSeriesReturnPct(niftyValues, 126),
    nifty1Y: computeSeriesReturnPct(niftyValues, rawSeries.length - 1),
  };
}

export async function getAiStrategyBaskets(): Promise<AiStrategiesResponse> {
  if (strategyCache && strategyCache.expiresAt > Date.now()) {
    return strategyCache.data;
  }

  const [universeQuotes, niftyChart] = await Promise.all([
    getScreenerUniverse(),
    getChart('^NSEI', '1y'),
  ]);

  // Select top 8 constituents per strategy first
  const draftBaskets = STRATEGY_DEFS.map((def) => {
    const ranked = universeQuotes
      .map((q) => {
        const res = def.scoreStock(q, niftyChart?.quote?.return6M ?? 0);
        return { quote: q, ...res };
      })
      .filter((item) => item.eligible)
      .sort((a, b) => b.score - a.score);

    const selected = ranked.slice(0, 8);
    const weight = selected.length > 0 ? Number((100 / selected.length).toFixed(1)) : 0;

    const constituents: StrategyConstituent[] = selected.map((item) => ({
      symbol: item.quote.symbol,
      ticker: item.quote.ticker,
      name: item.quote.shortName,
      exchange: (item.quote.exchange === 'BSE' ? 'BSE' : 'NSE') as Exchange,
      sector: item.quote.sector,
      capCategory: item.quote.capCategory,
      price: item.quote.price,
      changePercent: item.quote.changePercent,
      peRatio: item.quote.peRatio,
      roce: item.quote.roce,
      debtToEquity: item.quote.debtToEquity,
      rsi14: item.quote.rsi14,
      return6M: item.quote.return6M,
      return1Y: item.quote.return1Y,
      weightPercent: weight,
      factorScore: item.score,
      selectionReason: item.reason,
    }));

    // Recent Monthly Rotation Ledger: overextended/weak stocks outside top 8 vs newest high-conviction entries
    const selectedSyms = new Set(constituents.map((c) => c.symbol));
    const rotateOutPool = universeQuotes
      .filter(
        (q) =>
          !selectedSyms.has(q.symbol) &&
          ((q.rsi14 ?? 50) >= 68 || (q.return6M ?? 0) >= 30 || (q.peRatio ?? 0) >= 55)
      )
      .sort((a, b) => (b.rsi14 ?? 50) - (a.rsi14 ?? 50))
      .slice(0, 2);

    const recentRotations: StrategyRotationLogItem[] = [
      ...rotateOutPool.map((q) => ({
        action: 'ROTATE_OUT' as const,
        symbol: q.symbol,
        ticker: q.ticker,
        companyName: q.shortName,
        sector: q.sector,
        reason:
          (q.rsi14 ?? 50) >= 68
            ? `Booked gains on stretched momentum (RSI ${q.rsi14?.toFixed(1)})`
            : `Locked valuation upside (${q.peRatio?.toFixed(1)}x P/E)`,
        returnTag:
          q.return6M !== null
            ? `${q.return6M >= 0 ? '+' : ''}${q.return6M.toFixed(1)}% 6M`
            : 'Profit Locked',
      })),
      ...constituents.slice(0, 2).map((c) => ({
        action: 'ROTATE_IN' as const,
        symbol: c.symbol,
        ticker: c.ticker,
        companyName: c.name,
        sector: c.sector,
        reason: c.selectionReason,
        returnTag: `Score ${c.factorScore}`,
      })),
    ];

    return { def, constituents, recentRotations };
  });

  // Fetch 1Y historical series for unique constituents concurrently (reuses 180s chartCache)
  const uniqueSymbols = Array.from(
    new Set(draftBaskets.flatMap((b) => b.constituents.map((c) => c.symbol)))
  );

  const chartEntries = await mapWithConcurrency(uniqueSymbols, 6, async (sym) => {
    const ch = await getChart(sym, '1y');
    return [sym, ch?.candles ?? []] as const;
  });
  const candlesBySymbol = new Map<string, CandlePoint[]>(chartEntries);
  const niftyCandles = niftyChart?.candles ?? [];

  const strategies: AiStrategyBasket[] = draftBaskets.map((b) => {
    const curve = buildIndexedStrategyCurve(b.constituents, candlesBySymbol, niftyCandles);
    const roces = b.constituents
      .map((c) => c.roce)
      .filter((v): v is number => v !== null && v > 0);
    const pes = b.constituents
      .map((c) => c.peRatio)
      .filter((v): v is number => v !== null && v > 0);

    return {
      id: b.def.id,
      name: b.def.name,
      tagline: b.def.tagline,
      methodology: b.def.methodology,
      riskProfile: b.def.riskProfile,
      rebalanceCadence: b.def.rebalanceCadence,
      return1M: curve.return1M,
      return6M: curve.return6M,
      return1Y: curve.return1Y,
      nifty1M: curve.nifty1M,
      nifty6M: curve.nifty6M,
      nifty1Y: curve.nifty1Y,
      alpha6M:
        curve.return6M !== null && curve.nifty6M !== null
          ? Number((curve.return6M - curve.nifty6M).toFixed(2))
          : null,
      alpha1Y:
        curve.return1Y !== null && curve.nifty1Y !== null
          ? Number((curve.return1Y - curve.nifty1Y).toFixed(2))
          : null,
      avgRoce:
        roces.length > 0
          ? Number((roces.reduce((s, v) => s + v, 0) / roces.length).toFixed(1))
          : null,
      avgPe:
        pes.length > 0
          ? Number((pes.reduce((s, v) => s + v, 0) / pes.length).toFixed(1))
          : null,
      chartSeries: curve.chartSeries,
      constituents: b.constituents,
      recentRotations: b.recentRotations,
    };
  });

  const payload: AiStrategiesResponse = {
    strategies,
    niftyBenchmark: niftyChart?.quote ?? null,
    fetchedAt: new Date().toISOString(),
  };

  strategyCache = {
    data: payload,
    expiresAt: Date.now() + STRATEGY_TTL_MS,
  };

  return payload;
}
