import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getQuotes } from './marketService.ts';
import {
  getLiveFundamentals,
  getLiveFundamentalsBatch,
  mergeQuoteWithFundamentals,
} from './fundamentalsService.ts';
import { computeConfidenceBreakdown } from './confidenceEngineService.ts';
import type {
  ConfidenceBreakdown,
  HoldingAiRating,
  HorizonProjection,
  LiveFundamentalsSnapshot,
  PortfolioAnalysisResponse,
  SymbolAiOutlook,
} from '../src/types/market.ts';

export interface HoldingAnalysisInput {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string;
}

export interface AnalyzePortfolioOptions {
  totalPortfolioValue?: number;
  skipPortfolioSummary?: boolean;
}

const STOCK_AI_BATCH_SIZE = 15;
const AI_BATCH_CONCURRENCY = 2;

const RATING_CRITERIA =
  'Criteria: Strictly align rating & conviction with Net Confidence (confPct): BUY requires confPct>=52 (confPct>=65 if daysToEarnings<=5) with constructive trend above 50/200-DMA (wtPct<25 when given) or quality oversold RSI<40 with healthy ROCE; HOLD=moderate confidence, consolidation, stretched RSI>=75, imminent earnings caution, or oversized weight; EXIT=weak confidence (<50) with persistent 6M lag vs Nifty below 200-DMA or weak ROCE drag.';

const QUOTA_EXHAUSTED_NOTICE =
  'Gemini API free-tier daily quota (20 req/day) was reached. Displaying quantitative ratings grounded in live NSE/BSE prices, 50/200-DMA, RSI-14, ROCE, and Nifty 50 relative strength. Select a billing-enabled key in Settings > Secrets for full LLM commentary.';

const TRANSIENT_FALLBACK_NOTICE =
  'AI commentary temporarily fell back to the quantitative telemetry engine for one or more holdings. All verdicts, guardrails, and 1M–10Y projections remain grounded in live NSE/BSE prices, 50/200-DMA, RSI-14, ROCE, and Nifty 50 relative strength.';

interface EnrichedTelemetryItem {
  symbol: string;
  companyName: string;
  sector: string;
  capCategory: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string;
  livePrice: number;
  currentValue: number;
  unrealizedPnlPercent: number;
  dayChangePercent: number;
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  return1M: number | null;
  return3M: number | null;
  return6M: number | null;
  return1Y: number | null;
  peRatio: number | null;
  roce: number | null;
  debtToEquity: number | null;
  beta: number;
  volumeRatio: number;
  portfolioWeightPercent: number;
  confidence?: ConfidenceBreakdown;
  fundamentals?: LiveFundamentalsSnapshot | null;
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /429|RESOURCE_EXHAUSTED|quota exceeded|rate[- ]limit/i.test(msg);
}

function safeParseJsonObject<T>(rawText: string | undefined | null): T | null {
  if (!rawText) return null;
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!stripped) return null;

  try {
    return JSON.parse(stripped) as T;
  } catch {
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

interface RawGeminiRating extends HoldingAiRating {
  p1m?: number;
  p3m?: number;
  p6m?: number;
  p1y?: number;
  cagr5y?: number;
  cagr10y?: number;
}

function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function buildStockProjection(
  t: EnrichedTelemetryItem,
  rating: 'BUY' | 'HOLD' | 'EXIT',
  suggestedTarget: number,
  aiHint?: {
    p1m?: number;
    p3m?: number;
    p6m?: number;
    p1y?: number;
    cagr5y?: number;
    cagr10y?: number;
  }
): HorizonProjection {
  const live = Math.max(0.01, t.livePrice);
  const beta = clampNum(t.beta || 1, 0.6, 1.75);
  const targetUpsidePct = ((suggestedTarget - live) / live) * 100;

  const momAdj =
    t.sma50 && t.sma200
      ? live > t.sma50 && live > t.sma200
        ? 3.0
        : live < t.sma200
        ? -4.0
        : 0
      : 0;

  const roceScore =
    t.roce !== null
      ? t.roce >= 22
        ? 15.5
        : t.roce >= 15
        ? 13.5
        : t.roce >= 10
        ? 11.2
        : 8.0
      : 11.5;
  const pePenalty = t.peRatio !== null && t.peRatio > 60 ? -1.8 : t.peRatio !== null && t.peRatio < 18 ? 1.0 : 0;
  const ratingBias = rating === 'BUY' ? 2.0 : rating === 'EXIT' ? -4.0 : 0;

  const base6m = clampNum(targetUpsidePct * 0.75 + (t.return6M ?? 0) * 0.12, -18, 28);
  const base1y = clampNum(base6m * 1.45 + momAdj + ratingBias * 0.6, -22, 42);
  const base5yCagr = clampNum(roceScore + pePenalty + ratingBias * 0.65, 4, 22);
  const base10yCagr = clampNum(base5yCagr * 0.72 + 12.0 * 0.28, 5, 18.5);

  const r6m =
    typeof aiHint?.p6m === 'number' && Number.isFinite(aiHint.p6m)
      ? clampNum(aiHint.p6m * 0.55 + base6m * 0.45, -18, 28)
      : base6m;
  const r1y =
    typeof aiHint?.p1y === 'number' && Number.isFinite(aiHint.p1y)
      ? clampNum(aiHint.p1y * 0.55 + base1y * 0.45, -22, 42)
      : base1y;
  const c5y =
    typeof aiHint?.cagr5y === 'number' && Number.isFinite(aiHint.cagr5y)
      ? clampNum(aiHint.cagr5y * 0.5 + base5yCagr * 0.5, 4, 22)
      : base5yCagr;
  const c10y =
    typeof aiHint?.cagr10y === 'number' && Number.isFinite(aiHint.cagr10y)
      ? clampNum(aiHint.cagr10y * 0.5 + base10yCagr * 0.5, 5, 18.5)
      : base10yCagr;

  const comp1m = (Math.pow(Math.max(0.5, 1 + r6m / 100), 1 / 6) - 1) * 100;
  const comp3m = (Math.pow(Math.max(0.5, 1 + r6m / 100), 0.5) - 1) * 100;
  const rsiVal = t.rsi14 ?? 50;
  const rsi1mNudge =
    rsiVal >= 74 ? -1.1 : rsiVal <= 35 && rating !== 'EXIT' ? 1.1 : 0;
  const mom1mNudge = clampNum((t.return1M ?? 0) * 0.08, -2.2, 2.2);
  const mom3mNudge = clampNum((t.return3M ?? 0) * 0.08, -3.0, 3.0);

  const base1m = clampNum(comp1m + rsi1mNudge + mom1mNudge, -9, 12);
  const base3m = clampNum(comp3m + mom3mNudge, -14, 19);

  const r1m =
    typeof aiHint?.p1m === 'number' && Number.isFinite(aiHint.p1m)
      ? clampNum(aiHint.p1m * 0.5 + base1m * 0.5, -9, 12)
      : base1m;
  const r3m =
    typeof aiHint?.p3m === 'number' && Number.isFinite(aiHint.p3m)
      ? clampNum(aiHint.p3m * 0.5 + base3m * 0.5, -14, 19)
      : base3m;

  const final1y = clampNum(r1y, Math.max(-22, r6m - 8), 42 * Math.min(1.15, beta * 0.95 + 0.15));

  return {
    return1MPercent: Number(r1m.toFixed(1)),
    value1M: Number((live * (1 + r1m / 100)).toFixed(2)),
    return3MPercent: Number(r3m.toFixed(1)),
    value3M: Number((live * (1 + r3m / 100)).toFixed(2)),
    return6MPercent: Number(r6m.toFixed(1)),
    value6M: Number((live * (1 + r6m / 100)).toFixed(2)),
    return1YPercent: Number(final1y.toFixed(1)),
    value1Y: Number((live * (1 + final1y / 100)).toFixed(2)),
    cagr5YPercent: Number(c5y.toFixed(1)),
    value5Y: Number((live * Math.pow(1 + c5y / 100, 5)).toFixed(2)),
    cagr10YPercent: Number(c10y.toFixed(1)),
    value10Y: Number((live * Math.pow(1 + c10y / 100, 10)).toFixed(2)),
    basisNote:
      t.roce !== null
        ? `Anchored to live ₹${live.toFixed(0)}, ROCE ${t.roce.toFixed(1)}%, β ${beta.toFixed(2)}x & DMA momentum.`
        : `Anchored to live ₹${live.toFixed(0)}, β ${beta.toFixed(2)}x & 50/200-DMA momentum.`,
  };
}

async function runWithConcurrency<T, R>(
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

function evaluateBatchQuantFallback(params: {
  batch: EnrichedTelemetryItem[];
  nifty: { price: number; changePercent: number; return6M: number | null } | null;
  sectorBreakdownText: string;
  includeExecutiveSummary: boolean;
}): {
  overallSummary?: string;
  diversificationNote?: string;
  actionPriority?: string;
  ratings: HoldingAiRating[];
  usedFallbackEngine: boolean;
} {
  const { batch, nifty, sectorBreakdownText, includeExecutiveSummary } = params;
  const nifty6M = nifty?.return6M ?? 0;

  const ratings: HoldingAiRating[] = batch.map((t) => {
    const live = t.livePrice;
    const beta = Math.max(0.65, Math.min(1.65, t.beta || 1));
    const above50 = t.sma50 ? live >= t.sma50 : null;
    const above200 = t.sma200 ? live >= t.sma200 : null;
    const rsi = t.rsi14 ?? 50;
    const ret6m = t.return6M;
    const relNifty6M = ret6m !== null ? Number((ret6m - nifty6M).toFixed(1)) : null;

    const netConf = t.confidence?.overallScore ?? 55;
    const dte = t.fundamentals?.daysToEarnings ?? null;
    const imminentEarnings = typeof dte === 'number' && dte >= 0 && dte <= 5;

    let verdict: 'BUY' | 'HOLD' | 'EXIT' = 'HOLD';
    let conviction: 'High' | 'Medium' | 'Low' = 'Medium';
    let headline = 'Consolidating near trend baseline — trail stop-loss';

    const deepBelow200 = t.sma200 ? live < t.sma200 * 0.88 : false;
    const severeLag = relNifty6M !== null && relNifty6M <= -12 && above200 === false;
    const weakFundamentals = t.roce !== null && t.roce < 7 && t.unrealizedPnlPercent < -15;

    if (
      (severeLag || (deepBelow200 && (ret6m ?? 0) < -10) || weakFundamentals || netConf < 36) &&
      !(netConf >= 70 && above200 === true)
    ) {
      verdict = 'EXIT';
      conviction = netConf <= 38 ? 'High' : 'Medium';
      headline =
        above200 === false
          ? `Below 200-DMA (${ret6m !== null ? `${ret6m}% 6M` : 'weak momentum'}) — capital-drag exit`
          : 'Sustained benchmark underperformance & weak confidence profile';
    } else if (
      netConf >= 52 &&
      (!imminentEarnings || netConf >= 65) &&
      ((above50 === true && above200 === true && rsi <= 68 && t.portfolioWeightPercent < 22) ||
        (rsi <= 38 && (t.roce ?? 12) >= 12 && !deepBelow200) ||
        (netConf >= 68 && t.portfolioWeightPercent < 22 && rsi <= 70))
    ) {
      verdict = 'BUY';
      conviction = netConf >= 68 ? 'High' : 'Medium';
      headline =
        rsi <= 38
          ? `Oversold quality support (RSI ${rsi.toFixed(1)}) — accumulation zone`
          : `Uptrend above 50/200-DMA with ${relNifty6M !== null && relNifty6M >= 0 ? 'Nifty outperformance' : 'steady momentum'}`;
    } else if (imminentEarnings && netConf < 65) {
      verdict = 'HOLD';
      conviction = 'Medium';
      headline = `Results due in ${dte}d — hold steady ahead of earnings event`;
    } else if (t.portfolioWeightPercent >= 22) {
      verdict = 'HOLD';
      conviction = netConf >= 66 ? 'High' : 'Medium';
      headline = `Oversized weight (${t.portfolioWeightPercent.toFixed(1)}%) — hold & cap incremental adds`;
    } else if (rsi >= 72 && t.unrealizedPnlPercent > 15) {
      verdict = 'HOLD';
      conviction = 'Medium';
      headline = `Extended RSI (${rsi.toFixed(1)}) — hold with tighter trailing stop`;
    }

    const techParts: string[] = [
      t.portfolioWeightPercent > 0
        ? `LTP ₹${live.toFixed(2)} (${t.unrealizedPnlPercent >= 0 ? '+' : ''}${t.unrealizedPnlPercent.toFixed(1)}% P&L)`
        : `LTP ₹${live.toFixed(2)}`,
    ];
    if (t.sma50) techParts.push(`50-DMA ₹${t.sma50.toFixed(0)} (${above50 ? 'above' : 'below'})`);
    if (t.sma200) techParts.push(`200-DMA ₹${t.sma200.toFixed(0)} (${above200 ? 'above' : 'below'})`);
    if (t.rsi14 !== null) techParts.push(`RSI ${t.rsi14.toFixed(1)}`);
    if (relNifty6M !== null) {
      techParts.push(`6M vs Nifty: ${relNifty6M >= 0 ? '+' : ''}${relNifty6M}%`);
    }
    if (t.roce !== null) techParts.push(`ROCE ${t.roce.toFixed(1)}%`);

    const rationale =
      t.portfolioWeightPercent > 0
        ? `${techParts.join(' · ')}. Position represents ${t.portfolioWeightPercent.toFixed(1)}% of portfolio value.`
        : `${techParts.join(' · ')}. Grounded in Nifty 50 relative momentum and volatility telemetry.`;

    const keyRisk =
      verdict === 'EXIT'
        ? 'Continued trend breakdown below moving averages may compound opportunity cost.'
        : t.portfolioWeightPercent > 18
        ? `Single-stock concentration (${t.portfolioWeightPercent.toFixed(1)}% weight) amplifies sector drawdown.`
        : rsi > 70
        ? 'Short-term mean reversion pullback risk due to elevated RSI.'
        : 'Broad market volatility around earnings and Nifty 50 liquidity shifts.';

    const suggestedTarget =
      verdict === 'EXIT'
        ? Number((live * 1.05).toFixed(2))
        : Number((live * (1 + (verdict === 'BUY' ? 0.16 : 0.1) * beta)).toFixed(2));

    const suggestedStopLoss =
      verdict === 'EXIT'
        ? Number((live * 0.95).toFixed(2))
        : t.sma50 && t.sma50 < live * 0.97 && t.sma50 > live * 0.82
        ? Number((t.sma50 * 0.985).toFixed(2))
        : Number((live * (1 - 0.08 * beta)).toFixed(2));

    return {
      symbol: t.symbol,
      rating: verdict,
      conviction,
      headline,
      rationale,
      keyRisk,
      suggestedTarget,
      suggestedStopLoss,
    };
  });

  if (!includeExecutiveSummary) {
    return { ratings, usedFallbackEngine: true };
  }

  const buys = ratings.filter((r) => r.rating === 'BUY').length;
  const holds = ratings.filter((r) => r.rating === 'HOLD').length;
  const exits = ratings.filter((r) => r.rating === 'EXIT');

  return {
    overallSummary: `Quantitative telemetry evaluated ${batch.length} positions in this batch (${buys} BUY, ${holds} HOLD, ${exits.length} EXIT) against Nifty 50 (${nifty ? `${nifty.price.toLocaleString('en-IN')}` : 'live'}).`,
    diversificationNote: sectorBreakdownText
      ? `Top sector weights: ${sectorBreakdownText}.`
      : 'Review sector concentration across top weighted positions.',
    actionPriority:
      exits.length > 0
        ? `Prioritize reviewing ${exits.slice(0, 3).map((e) => e.symbol.replace(/\.(NS|BO)$/, '')).join(', ')} flagged below 200-DMA / trailing Nifty 50.`
        : 'Maintain disciplined trailing stop-losses near 50-DMA support on core winners.',
    ratings,
    usedFallbackEngine: true,
  };
}

async function evaluateTelemetryBatch(params: {
  ai: GoogleGenAI;
  batch: EnrichedTelemetryItem[];
  nifty: { price: number; changePercent: number; return6M: number | null } | null;
  includeExecutiveSummary: boolean;
  sectorBreakdownText: string;
}): Promise<{
  overallSummary?: string;
  diversificationNote?: string;
  actionPriority?: string;
  ratings: HoldingAiRating[];
  usedFallbackEngine: boolean;
  quotaExhausted?: boolean;
}> {
  const { ai, batch, nifty, includeExecutiveSummary, sectorBreakdownText } = params;

  // Strip null/redundant fields & pretty indentation to minimize prompt tokens and maximize batch size
  const compactTelemetry = batch.map((t) => ({
    s: t.symbol,
    sec: t.sector,
    cap: t.capCategory,
    ltp: t.livePrice,
    pnlPct: t.unrealizedPnlPercent,
    wtPct: t.portfolioWeightPercent,
    ...(t.rsi14 !== null ? { rsi: t.rsi14 } : {}),
    ...(t.sma50 !== null ? { sma50: t.sma50 } : {}),
    ...(t.sma200 !== null ? { sma200: t.sma200 } : {}),
    ...(t.return6M !== null ? { r6m: t.return6M } : {}),
    ...(t.roce !== null ? { roce: t.roce } : {}),
    ...(t.peRatio !== null ? { pe: t.peRatio } : {}),
    ...(t.confidence ? { confPct: t.confidence.overallScore } : {}),
    ...(t.confidence?.totalAdjustment ? { confAdj: t.confidence.totalAdjustment } : {}),
    ...(typeof t.fundamentals?.daysToEarnings === 'number' && t.fundamentals.daysToEarnings >= 0 && t.fundamentals.daysToEarnings <= 14
      ? { daysToEarnings: t.fundamentals.daysToEarnings }
      : {}),
    ...(t.fundamentals?.earningsRiskFlag && t.fundamentals.nextEarningsDate
      ? { earnings: t.fundamentals.nextEarningsDate }
      : {}),
    beta: t.beta,
  }));

  const summaryHint = includeExecutiveSummary
    ? sectorBreakdownText
      ? `Sector weights: ${sectorBreakdownText}. Return portfolio overallSummary, diversificationNote, actionPriority.`
      : 'Return portfolio overallSummary, diversificationNote, actionPriority.'
    : 'Use short placeholder strings for overallSummary, diversificationNote, and actionPriority (continuation batch).';

  const prompt = `Rate EVERY Indian NSE/BSE stock in the JSON array (${compactTelemetry.length} items) with BUY, HOLD, or EXIT, and estimate expected return/CAGR forecasts (p1m, p3m, p6m, p1y, cagr5y, cagr10y).
Nifty50: level=${nifty ? nifty.price : 'N/A'}, 1D=${nifty ? `${nifty.changePercent}%` : 'N/A'}, 6M=${nifty?.return6M ?? 'N/A'}%.
${summaryHint}
Fields: s=symbol, ltp=livePrice, pnlPct=unrealizedPnl%, wtPct=portfolioWeight%, rsi=RSI14, sma50/sma200, r6m=6M return%, roce, pe, beta.
${RATING_CRITERIA} Keep headline (<=12 words), rationale (<=22 words), and keyRisk (<=16 words) crisp and single-line (no raw newlines or unescaped quotes), and set realistic INR suggestedTarget and suggestedStopLoss relative to ltp plus p1m/p3m/p6m/p1y total % and cagr5y/cagr10y annual % CAGR.
Data:${JSON.stringify(compactTelemetry)}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      overallSummary: { type: Type.STRING },
      diversificationNote: { type: Type.STRING },
      actionPriority: { type: Type.STRING },
      ratings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING },
            rating: { type: Type.STRING, enum: ['BUY', 'HOLD', 'EXIT'] },
            conviction: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
            headline: { type: Type.STRING },
            rationale: { type: Type.STRING },
            keyRisk: { type: Type.STRING },
            suggestedTarget: { type: Type.NUMBER },
            suggestedStopLoss: { type: Type.NUMBER },
            p1m: { type: Type.NUMBER },
            p3m: { type: Type.NUMBER },
            p6m: { type: Type.NUMBER },
            p1y: { type: Type.NUMBER },
            cagr5y: { type: Type.NUMBER },
            cagr10y: { type: Type.NUMBER },
          },
          required: [
            'symbol',
            'rating',
            'conviction',
            'headline',
            'rationale',
            'keyRisk',
            'suggestedTarget',
            'suggestedStopLoss',
          ],
        },
      },
    },
    required: ['overallSummary', 'diversificationNote', 'actionPriority', 'ratings'],
  };

  const modelCandidates: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
  ];

  let lastError: unknown;
  for (const candidate of modelCandidates) {
    try {
      const response = await ai.models.generateContent({
        model: candidate.model,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
          maxOutputTokens: 8192,
          systemInstruction:
            'You are a quantitative Indian equity portfolio analyst. Output concise, objective, data-grounded portfolio diagnostics in strictly valid JSON. Rate every holding provided.',
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const parsed = safeParseJsonObject<{
        overallSummary?: string;
        diversificationNote?: string;
        actionPriority?: string;
        ratings?: HoldingAiRating[];
      }>(response.text);

      if (!parsed) {
        lastError = new Error(`Malformed or truncated JSON response from ${candidate.model}`);
        continue;
      }

      const ratings = Array.isArray(parsed.ratings)
        ? parsed.ratings.filter((r) => Boolean(r && typeof r.symbol === 'string' && r.rating))
        : [];
      if (ratings.length > 0) {
        // Fill any omitted symbols in this batch via quantitative fallback so no holding is dropped
        const ratedSet = new Set(ratings.map((r) => r.symbol.toUpperCase()));
        const missingItems = batch.filter((item) => !ratedSet.has(item.symbol.toUpperCase()));
        const supplementedRatings =
          missingItems.length > 0
            ? [
                ...ratings,
                ...evaluateBatchQuantFallback({
                  batch: missingItems,
                  nifty,
                  sectorBreakdownText,
                  includeExecutiveSummary: false,
                }).ratings,
              ]
            : ratings;

        return {
          overallSummary: parsed.overallSummary,
          diversificationNote: parsed.diversificationNote,
          actionPriority: parsed.actionPriority,
          ratings: supplementedRatings,
          usedFallbackEngine: false,
        };
      }
      lastError = new Error(`Empty ratings array returned from ${candidate.model}`);
    } catch (err) {
      lastError = err;
    }
  }

  const quotaExhausted = isQuotaOrRateLimitError(lastError);
  if (lastError && !quotaExhausted) {
    console.warn('Portfolio AI batch fell back to quantitative engine:', lastError);
  }

  return {
    ...evaluateBatchQuantFallback({
      batch,
      nifty,
      sectorBreakdownText,
      includeExecutiveSummary,
    }),
    quotaExhausted,
  };
}

function applyGuardrails(
  rawRatings: RawGeminiRating[],
  telemetryBySymbol: Map<string, EnrichedTelemetryItem>
): HoldingAiRating[] {
  const seenRatings = new Set<string>();

  return rawRatings
    .filter((r) => {
      const key = String(r.symbol || '').toUpperCase();
      if (!key || seenRatings.has(key)) return false;
      seenRatings.add(key);
      return true;
    })
    .map((r) => {
      const sym = String(r.symbol || '').toUpperCase();
      const t = telemetryBySymbol.get(sym);
      const { p1m, p3m, p6m, p1y, cagr5y, cagr10y, ...cleanRating } = r;

      if (!t || t.livePrice <= 0) {
        return {
          ...cleanRating,
          guardrailStatus: 'PASSED' as const,
          guardrailNote: 'Verified against live quote telemetry.',
        };
      }

      const live = t.livePrice;
      const beta = Math.max(0.6, Math.min(1.8, t.beta || 1));
      const maxUpsidePct = Math.round(45 * beta);
      const maxStopPct = Math.min(32, Math.max(12, Math.round(24 * beta)));
      const minStopPct = 2.0;

      let target = Number(cleanRating.suggestedTarget);
      let stop = Number(cleanRating.suggestedStopLoss);
      let status: 'PASSED' | 'ADJUSTED' | 'FLAGGED' = 'PASSED';
      const notes: string[] = [];

      // 1. Unify Verdict & Conviction against calibrated Net Confidence Score
      let unifiedRating = cleanRating.rating;
      let unifiedConviction = cleanRating.conviction;
      const netConf = t.confidence?.overallScore ?? null;
      const totalAdj = t.confidence?.totalAdjustment ?? 0;
      const dte = t.fundamentals?.daysToEarnings ?? null;

      if (unifiedRating === 'BUY' && netConf !== null && netConf < 52) {
        if (netConf < 36 && t.sma200 && live < t.sma200 * 0.92) {
          unifiedRating = 'EXIT';
          status = 'ADJUSTED';
          notes.push(
            `Unified BUY → EXIT: net confidence ${netConf.toFixed(1)}% (<36%) while trading below 200-DMA.`
          );
        } else {
          unifiedRating = 'HOLD';
          status = 'ADJUSTED';
          notes.push(
            `Unified BUY → HOLD: net confidence ${netConf.toFixed(1)}% is below the 52% BUY threshold${
              totalAdj < 0 ? ` (after ${totalAdj} pts risk deduction)` : ''
            }.`
          );
        }
      } else if (
        unifiedRating === 'BUY' &&
        typeof dte === 'number' &&
        dte >= 0 &&
        dte <= 5 &&
        netConf !== null &&
        netConf < 65
      ) {
        unifiedRating = 'HOLD';
        status = 'ADJUSTED';
        notes.push(
          `Unified BUY → HOLD: earnings due in ${dte}d with ${netConf.toFixed(1)}% net confidence (<65% event buffer).`
        );
      } else if (
        unifiedRating === 'EXIT' &&
        netConf !== null &&
        netConf >= 70 &&
        t.sma200 &&
        live > t.sma200
      ) {
        unifiedRating = 'HOLD';
        status = 'ADJUSTED';
        notes.push(
          `Unified EXIT → HOLD: strong ${netConf.toFixed(1)}% confidence above 200-DMA (consider partial trim instead of full exit).`
        );
      }

      // 2. Calibrate Target & Stop-Loss against the unified verdict
      if (unifiedRating === 'BUY' || unifiedRating === 'HOLD') {
        if (!Number.isFinite(target) || target <= live * 1.01) {
          const fallbackTarget =
            t.sma200 && t.sma200 > live * 1.04
              ? Math.min(t.sma200, live * 1.25)
              : live * (1 + 0.12 * beta);
          target = Number(fallbackTarget.toFixed(2));
          status = 'ADJUSTED';
          notes.push('Upside target calibrated above live market price.');
        } else if (target > live * (1 + maxUpsidePct / 100)) {
          target = Number((live * (1 + maxUpsidePct / 100)).toFixed(2));
          status = 'ADJUSTED';
          notes.push(`Target clamped within ${maxUpsidePct}% β-volatility ceiling.`);
        }

        if (!Number.isFinite(stop) || stop <= 0 || stop >= live * (1 - minStopPct / 100)) {
          const supportRef =
            t.sma50 && t.sma50 < live * 0.97 && t.sma50 > live * (1 - maxStopPct / 100)
              ? t.sma50 * 0.985
              : live * (1 - Math.min(10, 6 * beta) / 100);
          stop = Number(supportRef.toFixed(2));
          status = 'ADJUSTED';
          notes.push('Stop-loss snapped to technical support below live price.');
        } else if (stop < live * (1 - maxStopPct / 100)) {
          stop = Number((live * (1 - maxStopPct / 100)).toFixed(2));
          status = 'ADJUSTED';
          notes.push(`Stop-loss tightened inside ${maxStopPct}% max drawdown guardrail.`);
        }
      } else {
        if (!Number.isFinite(target) || target > live * 1.15 || target <= 0) {
          target = Number((live * 1.05).toFixed(2));
          status = 'ADJUSTED';
          notes.push('EXIT target capped near immediate overhead supply.');
        }
        if (!Number.isFinite(stop) || stop <= 0 || stop >= live * 0.995) {
          stop = Number((live * 0.95).toFixed(2));
          status = 'ADJUSTED';
          notes.push('EXIT stop-loss adjusted below live price.');
        }
      }

      if (
        unifiedRating === 'BUY' &&
        t.sma200 &&
        live < t.sma200 * 0.88 &&
        (t.return6M ?? 0) < -12 &&
        (t.rsi14 ?? 50) > 38
      ) {
        if (status === 'PASSED') status = 'FLAGGED';
        notes.push(
          `Trend conflict: trading >12% below 200-DMA (6M ${t.return6M}%) — falling-knife risk on BUY.`
        );
      } else if (
        unifiedRating === 'EXIT' &&
        t.sma50 &&
        t.sma200 &&
        live > t.sma50 &&
        live > t.sma200 &&
        (t.return6M ?? 0) > 12
      ) {
        if (status === 'PASSED') status = 'FLAGGED';
        notes.push(
          'Trend conflict: above both 50-DMA & 200-DMA with positive 6M momentum — verify before exiting.'
        );
      }

      // 3. Strictly align Conviction label with Net Confidence & Guardrail Status
      if (netConf !== null) {
        if (unifiedRating === 'BUY') {
          unifiedConviction =
            netConf >= 68 && status !== 'FLAGGED' && totalAdj > -7
              ? 'High'
              : netConf >= 52
              ? 'Medium'
              : 'Low';
        } else if (unifiedRating === 'EXIT') {
          unifiedConviction =
            netConf <= 38 && status !== 'FLAGGED'
              ? 'High'
              : netConf <= 55
              ? 'Medium'
              : 'Low';
        } else {
          unifiedConviction =
            totalAdj <= -7 || netConf < 48
              ? 'Low'
              : netConf >= 66 && status === 'PASSED'
              ? 'High'
              : 'Medium';
        }
      }

      const finalTarget = Number(target.toFixed(2));
      const projection = buildStockProjection(t, unifiedRating, finalTarget, {
        p1m,
        p3m,
        p6m,
        p1y,
        cagr5y,
        cagr10y,
      });

      return {
        ...cleanRating,
        rating: unifiedRating,
        conviction: unifiedConviction,
        suggestedTarget: finalTarget,
        suggestedStopLoss: Number(stop.toFixed(2)),
        projection,
        guardrailStatus: status,
        guardrailNote:
          notes.length > 0
            ? notes.join(' ')
            : `Verified: verdict aligned with ${netConf !== null ? `${netConf.toFixed(1)}% net confidence` : 'live telemetry'}, β (${beta.toFixed(2)}x) & DMA support.`,
        confidence: t.confidence,
        fundamentals: t.fundamentals ?? null,
      };
    });
}

export async function analyzePortfolioHoldings(
  holdings: HoldingAnalysisInput[],
  options?: AnalyzePortfolioOptions
): Promise<PortfolioAnalysisResponse> {
  if (holdings.length === 0) {
    throw new Error('Add at least one holding before running AI portfolio analysis.');
  }

  const consolidatedMap = new Map<string, HoldingAnalysisInput>();
  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();
    const existing = consolidatedMap.get(sym);
    if (!existing) {
      consolidatedMap.set(sym, { ...h, symbol: sym });
    } else {
      const totalQty = existing.quantity + h.quantity;
      const totalCost = existing.quantity * existing.avgBuyPrice + h.quantity * h.avgBuyPrice;
      consolidatedMap.set(sym, {
        ...existing,
        quantity: Number(totalQty.toFixed(4)),
        avgBuyPrice: totalQty > 0 ? Number((totalCost / totalQty).toFixed(2)) : existing.avgBuyPrice,
        buyDate: existing.buyDate <= h.buyDate ? existing.buyDate : h.buyDate,
      });
    }
  }
  const uniqueHoldings = Array.from(consolidatedMap.values());

  const symbols = Array.from(new Set(['^NSEI', ...uniqueHoldings.map((h) => h.symbol)]));
  const [quotes, fundamentalsMap] = await Promise.all([
    getQuotes(symbols),
    getLiveFundamentalsBatch(uniqueHoldings.map((h) => h.symbol), 6),
  ]);
  const nifty = quotes['^NSEI'] ?? null;

  const enrichedPayload = uniqueHoldings.map((h) => {
    const sym = h.symbol.toUpperCase();
    const fund = fundamentalsMap[sym] ?? null;
    const rawQ = quotes[sym];
    const q = rawQ ? mergeQuoteWithFundamentals(rawQ, fund) : undefined;
    const livePrice = q?.price ?? h.avgBuyPrice;
    const invested = h.quantity * h.avgBuyPrice;
    const currentValue = h.quantity * livePrice;
    const pnlPct = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0;

    const confidence = computeConfidenceBreakdown({
      price: livePrice,
      sma50: q?.sma50 ?? null,
      sma200: q?.sma200 ?? null,
      fiftyTwoWeekHigh: q?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: q?.fiftyTwoWeekLow ?? null,
      rsi14: q?.rsi14 ?? null,
      volumeRatio: q?.volumeRatio ?? 1.0,
      dayChangePercent: q?.changePercent ?? 0,
      return1M: q?.return1M ?? null,
      return3M: q?.return3M ?? null,
      return6M: q?.return6M ?? null,
      niftyReturn1M: nifty?.return1M ?? null,
      niftyReturn3M: nifty?.return3M ?? null,
      niftyReturn6M: nifty?.return6M ?? null,
      sector: q?.sector || h.sector,
      applyRiskDeductions: true,
      nextEarningsDate: fund?.nextEarningsDate ?? q?.nextEarningsDate ?? null,
      daysToEarnings: fund?.daysToEarnings ?? q?.daysToEarnings ?? null,
      earningsRiskFlag: fund?.earningsRiskFlag ?? q?.earningsRiskFlag ?? false,
      fundamentalsSource: sym.startsWith('^') ? null : fund?.source ?? q?.fundamentalsSource ?? 'catalog_fallback',
      fundamentals: {
        trailingPE: fund?.trailingPE ?? q?.peRatio ?? null,
        forwardPE: fund?.forwardPE ?? null,
        roePct: fund?.roePct ?? null,
        roceProxyPct: fund?.roceProxyPct ?? q?.roce ?? null,
        revenueGrowthPct: fund?.revenueGrowthPct ?? null,
        earningsGrowthPct: fund?.earningsGrowthPct ?? null,
        operatingMarginPct: fund?.operatingMarginPct ?? null,
        debtToEquity: fund?.debtToEquity ?? q?.debtToEquity ?? null,
      },
    });

    return {
      symbol: sym,
      companyName: h.companyName,
      sector: q?.sector || h.sector,
      capCategory: q?.capCategory || 'Mid Cap',
      quantity: h.quantity,
      avgBuyPrice: h.avgBuyPrice,
      buyDate: h.buyDate,
      livePrice,
      currentValue: Number(currentValue.toFixed(2)),
      unrealizedPnlPercent: Number(pnlPct.toFixed(2)),
      dayChangePercent: q?.changePercent ?? 0,
      rsi14: q?.rsi14 ?? null,
      sma50: q?.sma50 ?? null,
      sma200: q?.sma200 ?? null,
      return1M: q?.return1M ?? null,
      return3M: q?.return3M ?? null,
      return6M: q?.return6M ?? null,
      return1Y: q?.return1Y ?? null,
      peRatio: fund?.trailingPE ?? q?.peRatio ?? null,
      roce: fund?.roceProxyPct ?? q?.roce ?? null,
      debtToEquity: fund?.debtToEquity ?? q?.debtToEquity ?? null,
      beta: q?.beta ?? 1.0,
      volumeRatio: q?.volumeRatio ?? 1.0,
      confidence,
      fundamentals: fund,
    };
  });

  const localTotalCurrent = enrichedPayload.reduce((s, r) => s + r.currentValue, 0);
  const totalCurrent =
    options?.totalPortfolioValue && options.totalPortfolioValue > 0
      ? options.totalPortfolioValue
      : localTotalCurrent;

  const portfolioWithWeights: EnrichedTelemetryItem[] = enrichedPayload.map((r) => ({
    ...r,
    portfolioWeightPercent:
      totalCurrent > 0 ? Number(((r.currentValue / totalCurrent) * 100).toFixed(2)) : 0,
  }));

  const sectorTotals = new Map<string, number>();
  for (const item of portfolioWithWeights) {
    sectorTotals.set(item.sector, (sectorTotals.get(item.sector) ?? 0) + item.portfolioWeightPercent);
  }
  const sectorBreakdownText = Array.from(sectorTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sec, wt]) => `${sec}: ${wt.toFixed(1)}%`)
    .join(', ');

  const batches: EnrichedTelemetryItem[][] = [];
  for (let i = 0; i < portfolioWithWeights.length; i += STOCK_AI_BATCH_SIZE) {
    batches.push(portfolioWithWeights.slice(i, i + STOCK_AI_BATCH_SIZE));
  }

  let batchResults: Array<{
    overallSummary?: string;
    diversificationNote?: string;
    actionPriority?: string;
    ratings: HoldingAiRating[];
    usedFallbackEngine: boolean;
    quotaExhausted?: boolean;
  }>;

  if (!process.env.GEMINI_API_KEY) {
    batchResults = batches.map((batch, idx) => ({
      ...evaluateBatchQuantFallback({
        batch,
        nifty,
        sectorBreakdownText,
        includeExecutiveSummary: idx === 0 && !options?.skipPortfolioSummary,
      }),
      quotaExhausted: false,
    }));
  } else {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    batchResults = await runWithConcurrency(batches, AI_BATCH_CONCURRENCY, (batch, idx) =>
      evaluateTelemetryBatch({
        ai,
        batch,
        nifty,
        includeExecutiveSummary: idx === 0 && !options?.skipPortfolioSummary,
        sectorBreakdownText,
      })
    );
  }

  const usedFallback = batchResults.some((r) => r.usedFallbackEngine);
  const hadQuotaError = batchResults.some((r) => r.quotaExhausted);
  const combinedRawRatings = batchResults.flatMap((r) => r.ratings);
  const telemetryBySymbol = new Map(portfolioWithWeights.map((item) => [item.symbol, item]));
  const guardedRatings = applyGuardrails(combinedRawRatings, telemetryBySymbol);

  let baseValue = 0;
  let sum1m = 0;
  let sum3m = 0;
  let sum6m = 0;
  let sum1y = 0;
  let sum5y = 0;
  let sum10y = 0;
  for (const r of guardedRatings) {
    const t = telemetryBySymbol.get(r.symbol.toUpperCase());
    if (!t || !r.projection || t.livePrice <= 0) continue;
    const posVal = t.quantity * t.livePrice;
    baseValue += posVal;
    sum1m += t.quantity * (r.projection.value1M ?? t.livePrice);
    sum3m += t.quantity * (r.projection.value3M ?? t.livePrice);
    sum6m += t.quantity * r.projection.value6M;
    sum1y += t.quantity * r.projection.value1Y;
    sum5y += t.quantity * r.projection.value5Y;
    sum10y += t.quantity * r.projection.value10Y;
  }

  const portfolioProjection: HorizonProjection | undefined =
    baseValue > 0
      ? {
          return1MPercent: Number((((sum1m - baseValue) / baseValue) * 100).toFixed(1)),
          value1M: Math.round(sum1m),
          return3MPercent: Number((((sum3m - baseValue) / baseValue) * 100).toFixed(1)),
          value3M: Math.round(sum3m),
          return6MPercent: Number((((sum6m - baseValue) / baseValue) * 100).toFixed(1)),
          value6M: Math.round(sum6m),
          return1YPercent: Number((((sum1y - baseValue) / baseValue) * 100).toFixed(1)),
          value1Y: Math.round(sum1y),
          cagr5YPercent: Number(((Math.pow(sum5y / baseValue, 1 / 5) - 1) * 100).toFixed(1)),
          value5Y: Math.round(sum5y),
          cagr10YPercent: Number(((Math.pow(sum10y / baseValue, 1 / 10) - 1) * 100).toFixed(1)),
          value10Y: Math.round(sum10y),
          basisNote: 'Capital-weighted forecast aggregated across every rated NSE/BSE holding.',
        }
      : undefined;

  const first = batchResults[0];

  return {
    overallSummary: first?.overallSummary || 'Portfolio evaluation complete.',
    diversificationNote: first?.diversificationNote || '',
    actionPriority: first?.actionPriority || '',
    ratings: guardedRatings,
    portfolioProjection,
    benchmarkNifty6M: nifty?.return6M ?? null,
    analysisSource: usedFallback ? 'fallback_engine' : 'gemini',
    quotaNotice: usedFallback
      ? hadQuotaError || !process.env.GEMINI_API_KEY
        ? QUOTA_EXHAUSTED_NOTICE
        : TRANSIENT_FALLBACK_NOTICE
      : undefined,
    analyzedAt: new Date().toISOString(),
  };
}

const SYMBOL_OUTLOOK_TTL_MS = 10 * 60 * 1000;
const symbolOutlookCache = new Map<string, { data: SymbolAiOutlook; expiresAt: number }>();

export async function analyzeSingleSymbolOutlook(
  symbolInput: string,
  options?: { forceRefresh?: boolean }
): Promise<SymbolAiOutlook> {
  const symbol = symbolInput.trim().toUpperCase();
  if (!symbol) {
    throw new Error('A valid stock or index symbol is required.');
  }

  if (!options?.forceRefresh) {
    const cached = symbolOutlookCache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const fetchList = Array.from(new Set(['^NSEI', symbol]));
  const [quotes, liveFundamentals] = await Promise.all([
    getQuotes(fetchList),
    symbol.startsWith('^') ? Promise.resolve(null) : getLiveFundamentals(symbol),
  ]);
  const rawQuote = quotes[symbol];
  const quote = rawQuote ? mergeQuoteWithFundamentals(rawQuote, liveFundamentals) : undefined;
  const nifty = quotes['^NSEI'] ?? null;

  if (!quote || quote.price <= 0) {
    throw new Error(`No live market quote available for ${symbol}.`);
  }

  const confidence = computeConfidenceBreakdown({
    price: quote.price,
    sma50: quote.sma50 ?? null,
    sma200: quote.sma200 ?? null,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
    rsi14: quote.rsi14 ?? null,
    volumeRatio: quote.volumeRatio ?? 1.0,
    dayChangePercent: quote.changePercent ?? 0,
    return1M: quote.return1M ?? null,
    return3M: quote.return3M ?? null,
    return6M: quote.return6M ?? null,
    niftyReturn1M: nifty?.return1M ?? null,
    niftyReturn3M: nifty?.return3M ?? null,
    niftyReturn6M: nifty?.return6M ?? null,
    sector: quote.sector || 'Equities',
    applyRiskDeductions: true,
    nextEarningsDate: liveFundamentals?.nextEarningsDate ?? quote.nextEarningsDate ?? null,
    daysToEarnings: liveFundamentals?.daysToEarnings ?? quote.daysToEarnings ?? null,
    earningsRiskFlag: liveFundamentals?.earningsRiskFlag ?? quote.earningsRiskFlag ?? false,
    fundamentalsSource: symbol.startsWith('^') ? null : liveFundamentals?.source ?? quote.fundamentalsSource ?? 'catalog_fallback',
    fundamentals: liveFundamentals
      ? {
          trailingPE: liveFundamentals.trailingPE,
          forwardPE: liveFundamentals.forwardPE,
          roePct: liveFundamentals.roePct,
          roceProxyPct: liveFundamentals.roceProxyPct,
          revenueGrowthPct: liveFundamentals.revenueGrowthPct,
          earningsGrowthPct: liveFundamentals.earningsGrowthPct,
          operatingMarginPct: liveFundamentals.operatingMarginPct,
          debtToEquity: liveFundamentals.debtToEquity,
        }
      : {
          trailingPE: quote.peRatio,
          roceProxyPct: quote.roce,
          debtToEquity: quote.debtToEquity,
        },
  });

  const telemetryItem: EnrichedTelemetryItem = {
    symbol,
    companyName: quote.shortName || symbol,
    sector: quote.sector || 'Equities',
    capCategory: quote.capCategory || 'Large Cap',
    quantity: 1,
    avgBuyPrice: quote.price,
    buyDate: new Date().toISOString().slice(0, 10),
    livePrice: quote.price,
    currentValue: quote.price,
    unrealizedPnlPercent: 0,
    dayChangePercent: quote.changePercent ?? 0,
    rsi14: quote.rsi14 ?? null,
    sma50: quote.sma50 ?? null,
    sma200: quote.sma200 ?? null,
    return1M: quote.return1M ?? null,
    return3M: quote.return3M ?? null,
    return6M: quote.return6M ?? null,
    return1Y: quote.return1Y ?? null,
    peRatio: quote.peRatio ?? null,
    roce: quote.roce ?? null,
    debtToEquity: quote.debtToEquity ?? null,
    beta: quote.beta ?? 1.0,
    volumeRatio: quote.volumeRatio ?? 1.0,
    portfolioWeightPercent: 0,
    confidence,
    fundamentals: liveFundamentals,
  };

  let rawRatings: RawGeminiRating[] = [];
  let usedFallback = false;

  if (!process.env.GEMINI_API_KEY) {
    const fallback = evaluateBatchQuantFallback({
      batch: [telemetryItem],
      nifty,
      sectorBreakdownText: quote.sector || 'Equities',
      includeExecutiveSummary: false,
    });
    rawRatings = fallback.ratings;
    usedFallback = true;
  } else {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const compactPayload = {
      symbol: telemetryItem.symbol,
      name: telemetryItem.companyName,
      exchange: quote.exchange,
      sector: telemetryItem.sector,
      cap: telemetryItem.capCategory,
      ltp: telemetryItem.livePrice,
      dayChgPct: telemetryItem.dayChangePercent,
      rsi14: telemetryItem.rsi14,
      sma50: telemetryItem.sma50,
      sma200: telemetryItem.sma200,
      r1m: telemetryItem.return1M,
      r3m: telemetryItem.return3M,
      r6m: telemetryItem.return6M,
      r1y: telemetryItem.return1Y,
      roce: telemetryItem.roce,
      roe: liveFundamentals?.roePct ?? null,
      revGrowthPct: liveFundamentals?.revenueGrowthPct ?? null,
      earnGrowthPct: liveFundamentals?.earningsGrowthPct ?? null,
      pe: telemetryItem.peRatio,
      fwdPe: liveFundamentals?.forwardPE ?? null,
      de: telemetryItem.debtToEquity,
      nextEarningsDate: liveFundamentals?.nextEarningsDate ?? null,
      daysToEarnings: liveFundamentals?.daysToEarnings ?? null,
      confidenceScore: confidence.overallScore,
      baseConfidenceScore: confidence.baseScore ?? confidence.overallScore,
      confidenceAdjustment: confidence.totalAdjustment ?? 0,
      beta: telemetryItem.beta,
      volRatio: telemetryItem.volumeRatio,
    };

    const prompt = `Evaluate this single Indian NSE/BSE stock or index (${telemetryItem.symbol}) and provide a forward outlook with 1-month (p1m), 3-month (p3m), 6-month (p6m), 1-year (p1y), 5-year annual CAGR (cagr5y), and 10-year annual CAGR (cagr10y) return estimates.
Nifty50 benchmark: level=${nifty ? nifty.price : 'N/A'}, 1D=${nifty ? `${nifty.changePercent}%` : 'N/A'}, 6M=${nifty?.return6M ?? 'N/A'}%.
${RATING_CRITERIA}
Give:
- rating: BUY, HOLD, or EXIT (strictly applying the criteria above)
- conviction: High, Medium, or Low
- headline: crisp 1-sentence technical + fundamental thesis
- rationale: 1-2 concise sentences citing live price, 50/200-DMA alignment, RSI-14, ROCE/valuation, or Nifty relative strength
- keyRisk: 1 concise sentence on primary downside risk
- suggestedTarget & suggestedStopLoss: realistic INR levels relative to LTP
- p1m, p3m, p6m & p1y: expected cumulative percentage price return over next 1 month, 3 months, 6 months, and 1 year
- cagr5y & cagr10y: expected annualized CAGR percentage over 5-year and 10-year compounding horizons
Data: ${JSON.stringify(compactPayload)}`;

    const singleSchema = {
      type: Type.OBJECT,
      properties: {
        rating: { type: Type.STRING, enum: ['BUY', 'HOLD', 'EXIT'] },
        conviction: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
        headline: { type: Type.STRING },
        rationale: { type: Type.STRING },
        keyRisk: { type: Type.STRING },
        suggestedTarget: { type: Type.NUMBER },
        suggestedStopLoss: { type: Type.NUMBER },
        p1m: { type: Type.NUMBER },
        p3m: { type: Type.NUMBER },
        p6m: { type: Type.NUMBER },
        p1y: { type: Type.NUMBER },
        cagr5y: { type: Type.NUMBER },
        cagr10y: { type: Type.NUMBER },
      },
      required: [
        'rating',
        'conviction',
        'headline',
        'rationale',
        'keyRisk',
        'suggestedTarget',
        'suggestedStopLoss',
        'p1m',
        'p3m',
        'p6m',
        'p1y',
        'cagr5y',
        'cagr10y',
      ],
    };

    const modelCandidates: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
      { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
      { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
    ];

    let lastError: unknown;
    for (const candidate of modelCandidates) {
      try {
        const response = await ai.models.generateContent({
          model: candidate.model,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
            systemInstruction:
              'You are a quantitative Indian equity analyst for Stoxify. Produce crisp, objective JSON outlooks strictly grounded in the live market telemetry.',
            responseMimeType: 'application/json',
            responseSchema: singleSchema,
          },
        });

        const parsed = safeParseJsonObject<Omit<RawGeminiRating, 'symbol'>>(response.text);
        if (parsed?.rating) {
          rawRatings = [{ ...parsed, symbol }];
          break;
        }
        lastError = new Error(`Malformed or empty JSON outlook from ${candidate.model}`);
      } catch (err) {
        lastError = err;
      }
    }

    if (rawRatings.length === 0) {
      const fallback = evaluateBatchQuantFallback({
        batch: [telemetryItem],
        nifty,
        sectorBreakdownText: quote.sector || 'Equities',
        includeExecutiveSummary: false,
      });
      rawRatings = fallback.ratings;
      usedFallback = true;
    }

    if (usedFallback && lastError && !isQuotaOrRateLimitError(lastError)) {
      console.warn(`AI outlook fell back to quantitative engine for ${symbol}:`, lastError);
    }
  }

  const telemetryMap = new Map([[symbol, telemetryItem]]);
  const [guarded] = applyGuardrails(rawRatings, telemetryMap);
  const projection =
    guarded.projection ??
    buildStockProjection(telemetryItem, guarded.rating, guarded.suggestedTarget);

  const result: SymbolAiOutlook = {
    symbol,
    companyName: quote.shortName || symbol,
    exchange: quote.exchange || 'NSE',
    sector: quote.sector || 'Equities',
    livePrice: Number(quote.price.toFixed(2)),
    rating: guarded.rating,
    conviction: guarded.conviction,
    headline: guarded.headline,
    rationale: guarded.rationale,
    keyRisk: guarded.keyRisk,
    suggestedTarget: guarded.suggestedTarget,
    suggestedStopLoss: guarded.suggestedStopLoss,
    projection,
    guardrailStatus: guarded.guardrailStatus ?? 'PASSED',
    guardrailNote: guarded.guardrailNote ?? 'Verified against live quote telemetry.',
    confidence,
    fundamentals: liveFundamentals,
    benchmarkNifty6M: nifty?.return6M ?? null,
    analysisSource: usedFallback ? 'fallback_engine' : 'gemini',
    quotaNotice: usedFallback ? QUOTA_EXHAUSTED_NOTICE : undefined,
    analyzedAt: new Date().toISOString(),
  };

  symbolOutlookCache.set(symbol, {
    data: result,
    expiresAt: Date.now() + SYMBOL_OUTLOOK_TTL_MS,
  });

  return result;
}
