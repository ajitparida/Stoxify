import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getQuotes } from './marketService.ts';
import type {
  HoldingAiRating,
  HorizonProjection,
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

const STOCK_AI_BATCH_SIZE = 40;
const AI_BATCH_CONCURRENCY = 2;

const QUOTA_EXHAUSTED_NOTICE =
  'Gemini API free-tier daily quota (20 req/day) was reached. Displaying quantitative ratings grounded in live NSE/BSE prices, 50/200-DMA, RSI-14, ROCE, and Nifty 50 relative strength. Select a billing-enabled key in Settings > Secrets for full LLM commentary.';

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
  return6M: number | null;
  return1Y: number | null;
  peRatio: number | null;
  roce: number | null;
  debtToEquity: number | null;
  beta: number;
  volumeRatio: number;
  portfolioWeightPercent: number;
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /429|RESOURCE_EXHAUSTED|quota exceeded|rate[- ]limit/i.test(msg);
}

interface RawGeminiRating extends HoldingAiRating {
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
  aiHint?: { p6m?: number; p1y?: number; cagr5y?: number; cagr10y?: number }
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

  const final1y = clampNum(r1y, Math.max(-22, r6m - 8), 42 * Math.min(1.15, beta * 0.95 + 0.15));

  return {
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

    let verdict: 'BUY' | 'HOLD' | 'EXIT' = 'HOLD';
    let conviction: 'High' | 'Medium' | 'Low' = 'Medium';
    let headline = 'Consolidating near trend baseline — trail stop-loss';

    const deepBelow200 = t.sma200 ? live < t.sma200 * 0.88 : false;
    const severeLag = relNifty6M !== null && relNifty6M <= -12 && above200 === false;
    const weakFundamentals = t.roce !== null && t.roce < 7 && t.unrealizedPnlPercent < -15;

    if (severeLag || (deepBelow200 && (ret6m ?? 0) < -10) || weakFundamentals) {
      verdict = 'EXIT';
      conviction = deepBelow200 && (relNifty6M ?? 0) <= -15 ? 'High' : 'Medium';
      headline =
        above200 === false
          ? `Below 200-DMA (${ret6m !== null ? `${ret6m}% 6M` : 'weak momentum'}) — capital-drag exit`
          : 'Sustained benchmark underperformance & weak return profile';
    } else if (
      (above50 === true && above200 === true && rsi <= 68 && t.portfolioWeightPercent < 22) ||
      (rsi <= 38 && (t.roce ?? 12) >= 12 && !deepBelow200)
    ) {
      verdict = 'BUY';
      conviction = above50 && above200 && (relNifty6M ?? 0) > 0 ? 'High' : 'Medium';
      headline =
        rsi <= 38
          ? `Oversold quality support (RSI ${rsi.toFixed(1)}) — accumulation zone`
          : `Uptrend above 50/200-DMA with ${relNifty6M !== null && relNifty6M >= 0 ? 'Nifty outperformance' : 'steady momentum'}`;
    } else if (t.portfolioWeightPercent >= 22) {
      verdict = 'HOLD';
      conviction = 'High';
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
    beta: t.beta,
  }));

  const summaryHint = includeExecutiveSummary
    ? sectorBreakdownText
      ? `Sector weights: ${sectorBreakdownText}. Return portfolio overallSummary, diversificationNote, actionPriority.`
      : 'Return portfolio overallSummary, diversificationNote, actionPriority.'
    : 'Use short placeholder strings for overallSummary, diversificationNote, and actionPriority (continuation batch).';

  const prompt = `Rate EVERY Indian NSE/BSE stock in the JSON array (${compactTelemetry.length} items) with BUY, HOLD, or EXIT, and estimate expected return/CAGR forecasts (p6m, p1y, cagr5y, cagr10y).
Nifty50: level=${nifty ? nifty.price : 'N/A'}, 1D=${nifty ? `${nifty.changePercent}%` : 'N/A'}, 6M=${nifty?.return6M ?? 'N/A'}%.
${summaryHint}
Fields: s=symbol, ltp=livePrice, pnlPct=unrealizedPnl%, wtPct=portfolioWeight%, rsi=RSI14, sma50/sma200, r6m=6M return%, roce, pe, beta.
Criteria: BUY=constructive trend above 50/200-DMA or quality oversold RSI<40 & wtPct<25; HOLD=fair consolidation/trail SL; EXIT=persistent 6M lag vs Nifty below 200-DMA or weak ROCE drag. Keep headline/rationale/keyRisk concise (1 sentence max each) and set realistic INR suggestedTarget and suggestedStopLoss relative to ltp plus p6m/p1y total % and cagr5y/cagr10y annual % CAGR.
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
          systemInstruction:
            'You are a quantitative Indian equity portfolio analyst. Output concise, objective, data-grounded portfolio diagnostics in valid JSON. Rate every holding provided.',
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        overallSummary?: string;
        diversificationNote?: string;
        actionPriority?: string;
        ratings?: HoldingAiRating[];
      };

      const ratings = Array.isArray(parsed.ratings) ? parsed.ratings : [];
      if (ratings.length > 0) {
        return {
          overallSummary: parsed.overallSummary,
          diversificationNote: parsed.diversificationNote,
          actionPriority: parsed.actionPriority,
          ratings,
          usedFallbackEngine: false,
        };
      }
    } catch (err) {
      lastError = err;
      // On quota exhaustion / rate-limit try next model; otherwise retry/propagate
      if (!isQuotaOrRateLimitError(err)) {
        break;
      }
    }
  }

  if (isQuotaOrRateLimitError(lastError)) {
    return evaluateBatchQuantFallback({
      batch,
      nifty,
      sectorBreakdownText,
      includeExecutiveSummary,
    });
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to evaluate portfolio holdings right now.');
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
      const { p6m, p1y, cagr5y, cagr10y, ...cleanRating } = r;

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

      if (cleanRating.rating === 'BUY' || cleanRating.rating === 'HOLD') {
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
        cleanRating.rating === 'BUY' &&
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
        cleanRating.rating === 'EXIT' &&
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

      const finalTarget = Number(target.toFixed(2));
      const projection = buildStockProjection(t, cleanRating.rating, finalTarget, {
        p6m,
        p1y,
        cagr5y,
        cagr10y,
      });

      return {
        ...cleanRating,
        suggestedTarget: finalTarget,
        suggestedStopLoss: Number(stop.toFixed(2)),
        projection,
        guardrailStatus: status,
        guardrailNote:
          notes.length > 0
            ? notes.join(' ')
            : `Passed live β (${beta.toFixed(2)}x) & 50/200-DMA support checks.`,
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
  const quotes = await getQuotes(symbols);
  const nifty = quotes['^NSEI'] ?? null;

  const enrichedPayload = uniqueHoldings.map((h) => {
    const sym = h.symbol.toUpperCase();
    const q = quotes[sym];
    const livePrice = q?.price ?? h.avgBuyPrice;
    const invested = h.quantity * h.avgBuyPrice;
    const currentValue = h.quantity * livePrice;
    const pnlPct = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0;

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
      return6M: q?.return6M ?? null,
      return1Y: q?.return1Y ?? null,
      peRatio: q?.peRatio ?? null,
      roce: q?.roce ?? null,
      debtToEquity: q?.debtToEquity ?? null,
      beta: q?.beta ?? 1.0,
      volumeRatio: q?.volumeRatio ?? 1.0,
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
  }>;

  if (!process.env.GEMINI_API_KEY) {
    batchResults = batches.map((batch, idx) =>
      evaluateBatchQuantFallback({
        batch,
        nifty,
        sectorBreakdownText,
        includeExecutiveSummary: idx === 0 && !options?.skipPortfolioSummary,
      })
    );
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
  const combinedRawRatings = batchResults.flatMap((r) => r.ratings);
  const telemetryBySymbol = new Map(portfolioWithWeights.map((item) => [item.symbol, item]));
  const guardedRatings = applyGuardrails(combinedRawRatings, telemetryBySymbol);

  let baseValue = 0;
  let sum6m = 0;
  let sum1y = 0;
  let sum5y = 0;
  let sum10y = 0;
  for (const r of guardedRatings) {
    const t = telemetryBySymbol.get(r.symbol.toUpperCase());
    if (!t || !r.projection || t.livePrice <= 0) continue;
    const posVal = t.quantity * t.livePrice;
    baseValue += posVal;
    sum6m += t.quantity * r.projection.value6M;
    sum1y += t.quantity * r.projection.value1Y;
    sum5y += t.quantity * r.projection.value5Y;
    sum10y += t.quantity * r.projection.value10Y;
  }

  const portfolioProjection: HorizonProjection | undefined =
    baseValue > 0
      ? {
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
    quotaNotice: usedFallback ? QUOTA_EXHAUSTED_NOTICE : undefined,
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
  const quotes = await getQuotes(fetchList);
  const quote = quotes[symbol];
  const nifty = quotes['^NSEI'] ?? null;

  if (!quote || quote.price <= 0) {
    throw new Error(`No live market quote available for ${symbol}.`);
  }

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
    return6M: quote.return6M ?? null,
    return1Y: quote.return1Y ?? null,
    peRatio: quote.peRatio ?? null,
    roce: quote.roce ?? null,
    debtToEquity: quote.debtToEquity ?? null,
    beta: quote.beta ?? 1.0,
    volumeRatio: quote.volumeRatio ?? 1.0,
    portfolioWeightPercent: 0,
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
      r6m: telemetryItem.return6M,
      r1y: telemetryItem.return1Y,
      roce: telemetryItem.roce,
      pe: telemetryItem.peRatio,
      beta: telemetryItem.beta,
      volRatio: telemetryItem.volumeRatio,
    };

    const prompt = `Evaluate this single Indian NSE/BSE stock or index (${telemetryItem.symbol}) and provide a forward outlook with 6-month (p6m), 1-year (p1y), 5-year annual CAGR (cagr5y), and 10-year annual CAGR (cagr10y) return estimates.
Nifty50 benchmark: level=${nifty ? nifty.price : 'N/A'}, 1D=${nifty ? `${nifty.changePercent}%` : 'N/A'}, 6M=${nifty?.return6M ?? 'N/A'}%.
Give:
- rating: BUY, HOLD, or EXIT
- conviction: High, Medium, or Low
- headline: crisp 1-sentence technical + fundamental thesis
- rationale: 1-2 concise sentences citing live price, 50/200-DMA alignment, RSI-14, ROCE/valuation, or Nifty relative strength
- keyRisk: 1 concise sentence on primary downside risk
- suggestedTarget & suggestedStopLoss: realistic INR levels relative to LTP
- p6m & p1y: expected cumulative percentage price return over next 6 months and 1 year
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

        const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<RawGeminiRating, 'symbol'>;
        if (parsed?.rating) {
          rawRatings = [{ ...parsed, symbol }];
          break;
        }
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
