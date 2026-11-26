import { findCatalogEntry, resolveActiveMarketSymbol } from './marketService.ts';
import type {
  AiRatingVerdict,
  BacktestCalibrationBucket,
  BacktestCalibrationReport,
  BacktestDataQualityItem,
  BacktestEquityPoint,
  BacktestHorizonDays,
  BacktestHorizonSummary,
  BacktestOutcomeStatus,
  BacktestPortfolioMetrics,
  BacktestRunRequest,
  BacktestRunResult,
  BacktestSamplingFrequency,
  BacktestSignalOutcome,
  BacktestSignalRecord,
  BacktestStockScorecard,
  BacktestUniverseMode,
  LiveCalibrationContext,
  StockEdgeTier,
} from '../src/types/market.ts';

export const FLAGSHIP_17_NSE_SYMBOLS: string[] = [
  'RELIANCE.NS',
  'TCS.NS',
  'HDFCBANK.NS',
  'ICICIBANK.NS',
  'INFY.NS',
  'BAJFINANCE.NS',
  'SBIN.NS',
  'BHARTIARTL.NS',
  'LT.NS',
  'ITC.NS',
  'KOTAKBANK.NS',
  'SUNPHARMA.NS',
  'M&M.NS',
  'AXISBANK.NS',
  'HCLTECH.NS',
  'TITAN.NS',
  'NTPC.NS',
];

export const BACKTEST_HORIZONS: Array<{
  days: BacktestHorizonDays;
  label: '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';
}> = [
  { days: 21, label: '1M' },
  { days: 63, label: '3M' },
  { days: 126, label: '6M' },
  { days: 252, label: '1Y' },
  { days: 1260, label: '5Y' },
  { days: 2520, label: '10Y' },
];

export const TRAIN_CUTOFF_DATE = '2023-12-31';

const HISTORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const RUN_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

export interface HistoricalDailyBar {
  date: string; // YYYY-MM-DD
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

export interface LoadedHistoricalSeries {
  symbol: string;
  ticker: string;
  companyName: string;
  sector: string;
  bars: HistoricalDailyBar[];
  dividendEvents: number;
  splitEvents: number;
  missingGapWarnings: number;
  quality: BacktestDataQualityItem;
}

interface YahooChart10YResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
      events?: {
        dividends?: Record<string, { amount?: number; date?: number }>;
        splits?: Record<string, { numerator?: number; denominator?: number; date?: number }>;
      };
    }>;
  };
}

const historyCache = new Map<string, { data: LoadedHistoricalSeries; expiresAt: number }>();
const runCache = new Map<string, { data: BacktestRunResult; expiresAt: number }>();

let latestCalibrationRun: BacktestRunResult | null = null;
let baselineWarmPromise: Promise<BacktestRunResult | null> | null = null;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round2(v: number): number {
  return Number(v.toFixed(2));
}

function round3(v: number): number {
  return Number(v.toFixed(3));
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, x) => sum + (x - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function toIsoDateFromEpochSec(tsSec: number): string {
  // Shift by +5.5h (IST) so NSE daily bars align cleanly to Indian trading dates
  const istMs = tsSec * 1000 + 5.5 * 3600 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

function daysBetweenIso(d1: string, d2: string): number {
  const t1 = Date.parse(`${d1}T00:00:00Z`);
  const t2 = Date.parse(`${d2}T00:00:00Z`);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 0;
  return Math.round((t2 - t1) / (24 * 3600 * 1000));
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => runner());
  await Promise.all(workers);
  return results;
}

async function fetchYahoo10YSeries(symbolInput: string): Promise<LoadedHistoricalSeries> {
  const symbol = resolveActiveMarketSymbol(symbolInput);
  const cached = historyCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const catalog = findCatalogEntry(symbol);
  const ticker = catalog?.ticker || symbol.replace(/\.(NS|BO)$/, '');
  const companyName = catalog?.name || ticker;
  const sector = catalog?.sector || (symbol.startsWith('^') ? 'Index' : 'Equities');

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=10y&interval=1d&includePrePost=false&events=div,split`;

  let payload: YahooChart10YResponse | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: YAHOO_HEADERS,
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        payload = (await res.json()) as YahooChart10YResponse;
        break;
      }
      if (res.status === 404) break;
    } catch {
      // retry with backoff
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }

  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const adjCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  const dividendEvents = Object.keys(result?.events?.dividends ?? {}).length;
  const splitEvents = Object.keys(result?.events?.splits ?? {}).length;

  const dedupedByDate = new Map<string, HistoricalDailyBar>();
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const close = quote?.close?.[i];
    if (typeof ts !== 'number' || typeof close !== 'number' || !Number.isFinite(close) || close <= 0) {
      continue;
    }
    const rawOpen = quote?.open?.[i];
    const rawHigh = quote?.high?.[i];
    const rawLow = quote?.low?.[i];
    const rawVol = quote?.volume?.[i];
    const rawAdj = adjCloses[i];

    const open =
      typeof rawOpen === 'number' && Number.isFinite(rawOpen) && rawOpen > 0 ? rawOpen : close;
    const highCandidate =
      typeof rawHigh === 'number' && Number.isFinite(rawHigh) && rawHigh > 0 ? rawHigh : Math.max(open, close);
    const lowCandidate =
      typeof rawLow === 'number' && Number.isFinite(rawLow) && rawLow > 0 ? rawLow : Math.min(open, close);
    const high = Math.max(highCandidate, open, close);
    const low = Math.min(lowCandidate, open, close);
    const adjClose =
      typeof rawAdj === 'number' && Number.isFinite(rawAdj) && rawAdj > 0 ? rawAdj : close;
    const volume =
      typeof rawVol === 'number' && Number.isFinite(rawVol) && rawVol >= 0 ? rawVol : 0;

    const date = toIsoDateFromEpochSec(ts);
    dedupedByDate.set(date, {
      date,
      timestamp: ts,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      adjClose: round3(adjClose),
      volume,
    });
  }

  const bars = Array.from(dedupedByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  let missingGapWarnings = 0;
  for (let i = 1; i < bars.length; i++) {
    if (daysBetweenIso(bars[i - 1].date, bars[i].date) > 12) {
      missingGapWarnings++;
    }
  }

  const startDate = bars.length > 0 ? bars[0].date : null;
  const endDate = bars.length > 0 ? bars[bars.length - 1].date : null;
  const historyYears =
    startDate && endDate ? round2(Math.max(0, daysBetweenIso(startDate, endDate) / 365.25)) : 0;

  let status: BacktestDataQualityItem['status'] = 'OK';
  let note = `${bars.length} daily bars · ${dividendEvents} dividends · ${splitEvents} splits`;
  if (bars.length < 240) {
    status = 'UNAVAILABLE';
    note =
      bars.length === 0
        ? 'No 10Y Yahoo Finance OHLCV history available for this symbol.'
        : `Insufficient history (${bars.length} sessions; minimum 240 required after 200-DMA warm-up).`;
  } else if (historyYears < 7.5) {
    status = 'PARTIAL_HISTORY';
    note = `Recent listing or partial Yahoo history (${historyYears.toFixed(1)} yrs, ${bars.length} bars).`;
  }

  const loaded: LoadedHistoricalSeries = {
    symbol,
    ticker,
    companyName: result?.meta?.shortName || companyName,
    sector,
    bars,
    dividendEvents,
    splitEvents,
    missingGapWarnings,
    quality: {
      symbol,
      ticker,
      status,
      barsCount: bars.length,
      startDate,
      endDate,
      historyYears,
      dividendEvents,
      splitEvents,
      missingGapWarnings,
      note,
    },
  };

  historyCache.set(symbol, { data: loaded, expiresAt: Date.now() + HISTORY_CACHE_TTL_MS });
  return loaded;
}

// Precompute strictly point-in-time rolling indicators (zero look-ahead)
export interface PrecomputedSeriesIndicators {
  sma20: Array<number | null>;
  sma50: Array<number | null>;
  sma200: Array<number | null>;
  ema20: Array<number | null>;
  rsi14: Array<number | null>;
  vol30Ann: Array<number | null>;
  ret21: Array<number | null>;
  ret63: Array<number | null>;
  ret126: Array<number | null>;
  high252: Array<number | null>;
  low252: Array<number | null>;
}

export function precomputePointInTimeIndicators(
  bars: HistoricalDailyBar[]
): PrecomputedSeriesIndicators {
  const n = bars.length;
  const closes = bars.map((b) => b.close);

  const sma = (period: number): Array<number | null> => {
    const out: Array<number | null> = new Array(n).fill(null);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += closes[i];
      if (i >= period) sum -= closes[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  };

  const ema20: Array<number | null> = new Array(n).fill(null);
  const k = 2 / 21;
  let emaVal: number | null = null;
  for (let i = 0; i < n; i++) {
    if (i === 19) {
      let s = 0;
      for (let j = 0; j < 20; j++) s += closes[j];
      emaVal = s / 20;
      ema20[i] = emaVal;
    } else if (i > 19 && emaVal !== null) {
      emaVal = closes[i] * k + emaVal * (1 - k);
      ema20[i] = emaVal;
    }
  }

  const rsi14: Array<number | null> = new Array(n).fill(null);
  if (n > 14) {
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gainSum += diff;
      else lossSum -= diff;
    }
    let avgGain = gainSum / 14;
    let avgLoss = lossSum / 14;
    rsi14[14] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = 15; i < n; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;
      rsi14[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  const dailyRets: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    dailyRets[i] = closes[i - 1] > 0 ? (closes[i] - closes[i - 1]) / closes[i - 1] : 0;
  }

  const vol30Ann: Array<number | null> = new Array(n).fill(null);
  for (let i = 30; i < n; i++) {
    const window = dailyRets.slice(i - 29, i + 1);
    vol30Ann[i] = stdDev(window) * Math.sqrt(252) * 100;
  }

  const pctRet = (lookback: number): Array<number | null> => {
    const out: Array<number | null> = new Array(n).fill(null);
    for (let i = lookback; i < n; i++) {
      const base = closes[i - lookback];
      if (base > 0) out[i] = ((closes[i] - base) / base) * 100;
    }
    return out;
  };

  const high252: Array<number | null> = new Array(n).fill(null);
  const low252: Array<number | null> = new Array(n).fill(null);
  for (let i = 200; i < n; i++) {
    const start = Math.max(0, i - 251);
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = start; j <= i; j++) {
      if (bars[j].high > hi) hi = bars[j].high;
      if (bars[j].low < lo) lo = bars[j].low;
    }
    high252[i] = hi;
    low252[i] = lo;
  }

  return {
    sma20: sma(20),
    sma50: sma(50),
    sma200: sma(200),
    ema20,
    rsi14,
    vol30Ann,
    ret21: pctRet(21),
    ret63: pctRet(63),
    ret126: pctRet(126),
    high252,
    low252,
  };
}

export interface PointInTimeSignalEvaluation {
  verdict: AiRatingVerdict;
  conviction: 'High' | 'Medium' | 'Low';
  rawConfidence: number;
  targetPrice: number;
  stopLossPrice: number;
  betaEst: number;
}

/**
 * Zero-look-ahead technical signal reconstruction (TECH_RECONSTRUCTED_V1).
 * Uses ONLY price/volume/Nifty information available on or before signalIdx.
 */
export function reconstructPointInTimeSignal(params: {
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  rsi14: number | null;
  vol30Ann: number | null;
  ret21: number | null;
  ret63: number | null;
  ret126: number | null;
  high252: number | null;
  low252: number | null;
  niftyRet21: number | null;
  niftyRet63: number | null;
  niftyRet126: number | null;
  betaEst: number;
}): PointInTimeSignalEvaluation {
  const {
    price,
    sma50,
    sma200,
    ema20,
    rsi14,
    vol30Ann,
    ret21,
    ret63,
    ret126,
    high252,
    low252,
    niftyRet21,
    niftyRet63,
    niftyRet126,
  } = params;
  const beta = clamp(params.betaEst || 1.0, 0.65, 1.7);

  // Pillar 1: Trend Structure (0..100, 40% weight)
  let trendScore = 50;
  if (sma200 && sma200 > 0) {
    const dist200 = ((price - sma200) / sma200) * 100;
    trendScore += dist200 >= 0 ? clamp(8 + dist200 * 0.7, 8, 22) : clamp(dist200 * 1.1, -24, -6);
  }
  if (sma50 && sma50 > 0) {
    const dist50 = ((price - sma50) / sma50) * 100;
    trendScore += dist50 >= 0 ? clamp(6 + dist50 * 0.6, 6, 14) : clamp(dist50 * 0.9, -14, -4);
  }
  if (ema20 && sma50 && sma50 > 0) {
    trendScore += ema20 >= sma50 ? 6 : -6;
  }
  if (sma50 && sma200 && sma200 > 0) {
    trendScore += sma50 >= sma200 ? 6 : -6;
  }
  if (high252 && low252 && high252 > low252) {
    const pos = (price - low252) / (high252 - low252);
    trendScore += (pos - 0.5) * 14;
  }
  trendScore = clamp(trendScore, 5, 98);

  // Pillar 2: Relative Strength vs Nifty 50 (0..100, 33% weight)
  const ex1m = ret21 !== null && niftyRet21 !== null ? ret21 - niftyRet21 : ret21 ?? 0;
  const ex3m = ret63 !== null && niftyRet63 !== null ? ret63 - niftyRet63 : ret63 ?? 0;
  const ex6m = ret126 !== null && niftyRet126 !== null ? ret126 - niftyRet126 : ret126 ?? 0;
  const blendedExcess = ex1m * 0.25 + ex3m * 0.35 + ex6m * 0.4;
  const rsScore = clamp(52 + blendedExcess * 1.65, 5, 98);

  // Pillar 3: Momentum & Volatility Quality (0..100, 27% weight)
  let momScore = 52;
  if (rsi14 !== null) {
    if (rsi14 >= 50 && rsi14 <= 68) momScore += 18;
    else if (rsi14 >= 42 && rsi14 < 50) momScore += 8;
    else if (rsi14 > 68 && rsi14 <= 76) momScore += 6;
    else if (rsi14 > 76) momScore -= 10; // stretched overbought penalty
    else if (rsi14 >= 32 && rsi14 < 42) momScore -= 6;
    else momScore -= 16; // capitulation downtrend
  }
  if (ret63 !== null) {
    momScore += clamp(ret63 * 0.45, -14, 16);
  }
  if (vol30Ann !== null) {
    if (vol30Ann <= 24) momScore += 8;
    else if (vol30Ann <= 36) momScore += 2;
    else if (vol30Ann >= 52) momScore -= 12;
  }
  momScore = clamp(momScore, 5, 98);

  const rawConfidence = round2(
    clamp(trendScore * 0.4 + rsScore * 0.33 + momScore * 0.27, 15, 95)
  );

  const above200 = sma200 !== null ? price >= sma200 : true;
  const above50 = sma50 !== null ? price >= sma50 : true;
  const rsiOverbought = rsi14 !== null && rsi14 >= 78;

  let verdict: AiRatingVerdict = 'HOLD';
  if (rawConfidence >= 60 && above200 && !rsiOverbought) {
    verdict = 'BUY';
  } else if (rawConfidence >= 68 && above50 && !rsiOverbought) {
    verdict = 'BUY';
  } else if (
    rawConfidence < 44 ||
    (!above200 && rawConfidence < 50 && ex6m < -6)
  ) {
    verdict = 'EXIT';
  }

  const conviction: 'High' | 'Medium' | 'Low' =
    (verdict === 'BUY' && rawConfidence >= 72) || (verdict === 'EXIT' && rawConfidence <= 35)
      ? 'High'
      : rawConfidence >= 52 || verdict === 'EXIT'
      ? 'Medium'
      : 'Low';

  // Beta-calibrated Target & Stop-Loss anchored strictly to Day T signal close
  const targetUpsidePct =
    verdict === 'BUY'
      ? clamp(12 + 5.5 * beta + (rawConfidence - 60) * 0.16, 11, 26)
      : verdict === 'HOLD'
      ? clamp(9 + 4 * beta, 8, 18)
      : clamp(6 + 2 * beta, 5, 11);

  const stopDownsidePct =
    verdict === 'BUY'
      ? clamp(6.5 + 3.5 * beta, 6.5, 14)
      : clamp(6 + 3.2 * beta, 6, 13.5);

  return {
    verdict,
    conviction,
    rawConfidence,
    targetPrice: round2(price * (1 + targetUpsidePct / 100)),
    stopLossPrice: round2(price * (1 - stopDownsidePct / 100)),
    betaEst: round2(beta),
  };
}

/**
 * Pure execution simulator for a single signal & horizon.
 * Enforces:
 * - Next-day (T+1) open entry
 * - Gap-open fills if market opens beyond stop or target
 * - Conservative STOP_FIRST convention when both barriers trigger on the same candle
 * - Pending detection when forward horizon extends beyond available bars
 * - Separate Price Return vs Dividend+Split-Adjusted Total Return + NSE round-trip transaction costs
 */
export function simulateSignalExecution(params: {
  bars: HistoricalDailyBar[];
  signalIdx: number;
  verdict: AiRatingVerdict;
  targetPrice: number;
  stopLossPrice: number;
  horizonDays: BacktestHorizonDays;
  horizonLabel: '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';
  costBps: number;
  niftyByDate: Map<string, number>;
  niftyDatesSorted?: string[];
}): BacktestSignalOutcome {
  const {
    bars,
    signalIdx,
    verdict,
    targetPrice,
    stopLossPrice,
    horizonDays,
    horizonLabel,
    costBps,
    niftyByDate,
  } = params;

  const entryIdx = signalIdx + 1;
  if (entryIdx >= bars.length || entryIdx < 0) {
    return {
      horizonDays,
      horizonLabel,
      status: 'DATA_UNAVAILABLE',
      firstHit: 'PENDING',
      exitDate: null,
      exitPrice: null,
      daysHeld: null,
      grossPriceReturnPct: null,
      netPriceReturnPct: null,
      grossTotalReturnPct: null,
      netTotalReturnPct: null,
      niftyReturnPct: null,
      excessReturnPct: null,
      maxDrawdownPct: null,
      maxFavorableExcursionPct: null,
      won: null,
      exitAvoidedLoss: null,
    };
  }

  const entryBar = bars[entryIdx];
  const entryPrice = entryBar.open;
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return {
      horizonDays,
      horizonLabel,
      status: 'DATA_UNAVAILABLE',
      firstHit: 'PENDING',
      exitDate: null,
      exitPrice: null,
      daysHeld: null,
      grossPriceReturnPct: null,
      netPriceReturnPct: null,
      grossTotalReturnPct: null,
      netTotalReturnPct: null,
      niftyReturnPct: null,
      excessReturnPct: null,
      maxDrawdownPct: null,
      maxFavorableExcursionPct: null,
      won: null,
      exitAvoidedLoss: null,
    };
  }

  const horizonEndIdx = entryIdx + horizonDays;
  const maxScanIdx = Math.min(horizonEndIdx, bars.length - 1);

  let status: BacktestOutcomeStatus | null = null;
  let firstHit: 'TARGET' | 'STOP' | 'NONE' | 'PENDING' = 'NONE';
  let exitIdx = maxScanIdx;
  let exitPrice = bars[maxScanIdx].close;

  let runningPeak = entryPrice;
  let maxDd = 0;
  let maxMfe = 0;

  // For EXIT verdicts we measure pure buy-and-hold forward path over the horizon (to test if exiting avoided losses)
  // For BUY / HOLD verdicts we actively monitor Target & Stop-Loss barriers daily
  const monitorBarriers = verdict !== 'EXIT';

  for (let j = entryIdx; j <= maxScanIdx; j++) {
    const bar = bars[j];
    const barHigh = Math.max(bar.high, bar.open, bar.close);
    const barLow = Math.min(bar.low, bar.open, bar.close);

    if (barHigh > runningPeak) runningPeak = barHigh;
    const ddHere = runningPeak > 0 ? ((barLow - runningPeak) / runningPeak) * 100 : 0;
    if (ddHere < maxDd) maxDd = ddHere;
    const mfeHere = ((barHigh - entryPrice) / entryPrice) * 100;
    if (mfeHere > maxMfe) maxMfe = mfeHere;

    if (!monitorBarriers) continue;

    // 1. Check overnight gap beyond barrier on open (j > entryIdx; on entryIdx open IS our entry fill)
    if (j > entryIdx) {
      if (bar.open <= stopLossPrice) {
        status = 'STOP_HIT';
        firstHit = 'STOP';
        exitIdx = j;
        exitPrice = bar.open;
        break;
      }
      if (bar.open >= targetPrice) {
        status = 'TARGET_HIT';
        firstHit = 'TARGET';
        exitIdx = j;
        exitPrice = bar.open;
        break;
      }
    }

    // 2. Check intraday high/low against barriers with conservative STOP_FIRST rule on same-bar dual hit
    const hitStop = barLow <= stopLossPrice;
    const hitTarget = barHigh >= targetPrice;

    if (hitStop && hitTarget) {
      status = 'BOTH_SAME_BAR';
      firstHit = 'STOP';
      exitIdx = j;
      exitPrice = stopLossPrice;
      break;
    }
    if (hitStop) {
      status = 'STOP_HIT';
      firstHit = 'STOP';
      exitIdx = j;
      exitPrice = stopLossPrice;
      break;
    }
    if (hitTarget) {
      status = 'TARGET_HIT';
      firstHit = 'TARGET';
      exitIdx = j;
      exitPrice = targetPrice;
      break;
    }
  }

  // If no barrier triggered and forward horizon hasn't completed yet -> PENDING
  if (status === null) {
    if (horizonEndIdx >= bars.length) {
      return {
        horizonDays,
        horizonLabel,
        status: 'PENDING',
        firstHit: 'PENDING',
        exitDate: null,
        exitPrice: null,
        daysHeld: bars.length - 1 - entryIdx,
        grossPriceReturnPct: null,
        netPriceReturnPct: null,
        grossTotalReturnPct: null,
        netTotalReturnPct: null,
        niftyReturnPct: null,
        excessReturnPct: null,
        maxDrawdownPct: round2(Math.abs(maxDd)),
        maxFavorableExcursionPct: round2(maxMfe),
        won: null,
        exitAvoidedLoss: null,
      };
    }
    status = 'HORIZON_EXPIRED';
    firstHit = 'NONE';
    exitIdx = horizonEndIdx;
    exitPrice = bars[horizonEndIdx].close;
  }

  const exitBar = bars[exitIdx];
  const costRate = clamp(costBps, 0, 200) / 10_000;

  // Gross & Net Price Return
  const grossPriceFactor = exitPrice / entryPrice;
  const grossPriceReturnPct = (grossPriceFactor - 1) * 100;
  const netPriceFactor = (exitPrice * (1 - costRate)) / (entryPrice * (1 + costRate));
  const netPriceReturnPct = (netPriceFactor - 1) * 100;

  // Total Return (Dividend + Split Adjusted via Yahoo adjClose ratio drift)
  const entryAdjRatio = entryBar.close > 0 ? entryBar.adjClose / entryBar.close : 1;
  const exitAdjRatio = exitBar.close > 0 ? exitBar.adjClose / exitBar.close : 1;
  const dividendCompoundingFactor =
    entryAdjRatio > 0 && exitAdjRatio > 0
      ? clamp(exitAdjRatio / entryAdjRatio, 0.85, 3.0)
      : 1;

  const grossTotalFactor = grossPriceFactor * dividendCompoundingFactor;
  const grossTotalReturnPct = (grossTotalFactor - 1) * 100;
  const netTotalFactor = netPriceFactor * dividendCompoundingFactor;
  const netTotalReturnPct = (netTotalFactor - 1) * 100;

  // Benchmark Nifty 50 return over exact same dates
  const niftyEntry = lookupNearestPriorValue(niftyByDate, entryBar.date);
  const niftyExit = lookupNearestPriorValue(niftyByDate, exitBar.date);
  const niftyReturnPct =
    niftyEntry !== null && niftyExit !== null && niftyEntry > 0
      ? ((niftyExit - niftyEntry) / niftyEntry) * 100
      : null;

  const excessReturnPct =
    niftyReturnPct !== null ? netTotalReturnPct - niftyReturnPct : null;

  const won = verdict === 'EXIT' ? null : netTotalReturnPct > 0;
  const exitAvoidedLoss = verdict === 'EXIT' ? netTotalReturnPct < 0 : null;

  return {
    horizonDays,
    horizonLabel,
    status,
    firstHit,
    exitDate: exitBar.date,
    exitPrice: round2(exitPrice),
    daysHeld: Math.max(1, exitIdx - entryIdx + 1),
    grossPriceReturnPct: round2(grossPriceReturnPct),
    netPriceReturnPct: round2(netPriceReturnPct),
    grossTotalReturnPct: round2(grossTotalReturnPct),
    netTotalReturnPct: round2(netTotalReturnPct),
    niftyReturnPct: niftyReturnPct !== null ? round2(niftyReturnPct) : null,
    excessReturnPct: excessReturnPct !== null ? round2(excessReturnPct) : null,
    maxDrawdownPct: round2(Math.abs(maxDd)),
    maxFavorableExcursionPct: round2(maxMfe),
    won,
    exitAvoidedLoss,
  };
}

function lookupNearestPriorValue(map: Map<string, number>, isoDate: string): number | null {
  const exact = map.get(isoDate);
  if (exact !== undefined) return exact;
  // Walk back up to 7 calendar days for exchange holiday alignment
  const baseMs = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(baseMs)) return null;
  for (let d = 1; d <= 7; d++) {
    const prevIso = new Date(baseMs - d * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const val = map.get(prevIso);
    if (val !== undefined) return val;
  }
  return null;
}

function estimatePointInTimeBeta(
  stockBars: HistoricalDailyBar[],
  idx: number,
  niftyRetByDate: Map<string, number>
): number {
  const lookback = Math.min(126, idx);
  if (lookback < 40) return 1.0;

  const sRets: number[] = [];
  const nRets: number[] = [];
  for (let i = idx - lookback + 1; i <= idx; i++) {
    const prev = stockBars[i - 1].close;
    const curr = stockBars[i].close;
    const nr = niftyRetByDate.get(stockBars[i].date);
    if (prev > 0 && curr > 0 && nr !== undefined) {
      sRets.push((curr - prev) / prev);
      nRets.push(nr);
    }
  }
  if (sRets.length < 30) return 1.0;

  const meanS = sRets.reduce((a, b) => a + b, 0) / sRets.length;
  const meanN = nRets.reduce((a, b) => a + b, 0) / nRets.length;
  let cov = 0;
  let varN = 0;
  for (let i = 0; i < sRets.length; i++) {
    cov += (sRets[i] - meanS) * (nRets[i] - meanN);
    varN += (nRets[i] - meanN) ** 2;
  }
  if (varN <= 1e-10) return 1.0;
  return clamp(cov / varN, 0.65, 1.7);
}

// Wilson 95% binomial confidence interval (%)
function wilsonIntervalPct(wins: number, n: number): { low: number | null; high: number | null } {
  if (n <= 0) return { low: null, high: null };
  const z = 1.96;
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return {
    low: round2(clamp((center - margin) * 100, 0, 100)),
    high: round2(clamp((center + margin) * 100, 0, 100)),
  };
}

// Pool-Adjacent-Violators Algorithm (isotonic non-decreasing calibration on buckets)
function fitIsotonicBuckets(
  buckets: Array<{ wins: number; count: number; fallbackProb: number }>
): number[] {
  interface Block {
    start: number;
    end: number;
    weight: number;
    sum: number;
  }

  // Smooth sparse buckets lightly with prior weight = 3 toward fallbackProb
  const priorWeight = 3;
  const blocks: Block[] = buckets.map((b, idx) => ({
    start: idx,
    end: idx,
    weight: b.count + priorWeight,
    sum: b.wins + b.fallbackProb * priorWeight,
  }));

  let i = 0;
  while (i < blocks.length - 1) {
    const avgCur = blocks[i].sum / blocks[i].weight;
    const avgNext = blocks[i + 1].sum / blocks[i + 1].weight;
    if (avgCur > avgNext) {
      blocks[i] = {
        start: blocks[i].start,
        end: blocks[i + 1].end,
        weight: blocks[i].weight + blocks[i + 1].weight,
        sum: blocks[i].sum + blocks[i + 1].sum,
      };
      blocks.splice(i + 1, 1);
      if (i > 0) i--;
    } else {
      i++;
    }
  }

  const result = new Array<number>(buckets.length).fill(0.5);
  for (const blk of blocks) {
    const val = clamp(blk.sum / blk.weight, 0.05, 0.95);
    for (let k = blk.start; k <= blk.end; k++) {
      result[k] = val;
    }
  }
  return result;
}

const CALIBRATION_BUCKET_DEFS = [
  { label: '< 45', min: 0, max: 45 },
  { label: '45–55', min: 45, max: 55 },
  { label: '55–65', min: 55, max: 65 },
  { label: '65–75', min: 65, max: 75 },
  { label: '75–85', min: 75, max: 85 },
  { label: '85+', min: 85, max: 101 },
];

export function findConfidenceBucketIndex(score: number): number {
  for (let i = 0; i < CALIBRATION_BUCKET_DEFS.length; i++) {
    const b = CALIBRATION_BUCKET_DEFS[i];
    if (score >= b.min && score < b.max) return i;
  }
  return CALIBRATION_BUCKET_DEFS.length - 1;
}

export function computeCalibrationReport(
  signals: BacktestSignalRecord[],
  horizonDays: BacktestHorizonDays,
  horizonLabel: '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y'
): BacktestCalibrationReport {
  const key = String(horizonDays);

  // Only resolved BUY/HOLD signals participate in win-probability calibration
  const resolvedLongs = signals.filter((s) => {
    const out = s.outcomes[key];
    return s.verdict !== 'EXIT' && out && out.won !== null && out.status !== 'PENDING' && out.status !== 'DATA_UNAVAILABLE';
  });

  const trainLongs = resolvedLongs.filter((s) => s.split === 'TRAIN');
  const oosLongs = resolvedLongs.filter((s) => s.split === 'OOS');

  const trainBaseRate =
    trainLongs.length > 0
      ? trainLongs.filter((s) => s.outcomes[key]?.won === true).length / trainLongs.length
      : 0.55;

  const trainPerBucket = CALIBRATION_BUCKET_DEFS.map((b) => {
    const items = trainLongs.filter((s) => s.rawConfidence >= b.min && s.rawConfidence < b.max);
    const wins = items.filter((s) => s.outcomes[key]?.won === true).length;
    return { items, wins, count: items.length };
  });

  const isotonicProbs = fitIsotonicBuckets(
    trainPerBucket.map((b) => ({
      wins: b.wins,
      count: b.count,
      fallbackProb: trainBaseRate,
    }))
  );

  // Compute OOS calibration metrics (Brier, Log Loss, ECE)
  let rawBrierSum = 0;
  let calBrierSum = 0;
  let rawLogLossSum = 0;
  let calLogLossSum = 0;
  let rawEceNum = 0;
  let calEceNum = 0;

  const buckets: BacktestCalibrationBucket[] = CALIBRATION_BUCKET_DEFS.map((def, idx) => {
    const tr = trainPerBucket[idx];
    const oosItems = oosLongs.filter((s) => s.rawConfidence >= def.min && s.rawConfidence < def.max);
    const oosWins = oosItems.filter((s) => s.outcomes[key]?.won === true).length;
    const oosCalProb = isotonicProbs[idx];

    for (const s of oosItems) {
      const y = s.outcomes[key]?.won ? 1 : 0;
      const pRaw = clamp(s.rawConfidence / 100, 0.01, 0.99);
      const pCal = clamp(oosCalProb, 0.01, 0.99);
      rawBrierSum += (pRaw - y) ** 2;
      calBrierSum += (pCal - y) ** 2;
      rawLogLossSum += -(y * Math.log(pRaw) + (1 - y) * Math.log(1 - pRaw));
      calLogLossSum += -(y * Math.log(pCal) + (1 - y) * Math.log(1 - pCal));
    }

    const oosPredAvg =
      oosItems.length > 0
        ? oosItems.reduce((sum, s) => sum + s.rawConfidence, 0) / oosItems.length
        : null;
    const oosActualPct = oosItems.length > 0 ? (oosWins / oosItems.length) * 100 : null;
    if (oosItems.length > 0 && oosPredAvg !== null && oosActualPct !== null) {
      rawEceNum += oosItems.length * Math.abs(oosPredAvg - oosActualPct);
      calEceNum += oosItems.length * Math.abs(oosCalProb * 100 - oosActualPct);
    }

    const ci = wilsonIntervalPct(oosWins, oosItems.length);
    const allBucketExcess = [...tr.items, ...oosItems]
      .map((s) => s.outcomes[key]?.excessReturnPct)
      .filter((v): v is number => typeof v === 'number');

    return {
      bucketLabel: def.label,
      minScore: def.min,
      maxScore: def.max,
      trainCount: tr.count,
      trainPredictedAvgPct:
        tr.count > 0
          ? round2(tr.items.reduce((sum, s) => sum + s.rawConfidence, 0) / tr.count)
          : null,
      trainActualWinRatePct: tr.count > 0 ? round2((tr.wins / tr.count) * 100) : null,
      oosCount: oosItems.length,
      oosPredictedAvgPct: oosPredAvg !== null ? round2(oosPredAvg) : null,
      oosActualWinRatePct: oosActualPct !== null ? round2(oosActualPct) : null,
      oosCalibratedProbPct: round2(oosCalProb * 100),
      oosCiLowPct: ci.low,
      oosCiHighPct: ci.high,
      avgExcessReturnPct: mean(allBucketExcess) !== null ? round2(mean(allBucketExcess)!) : null,
    };
  });

  // EXIT accuracy on OOS
  const resolvedOosExits = signals.filter((s) => {
    const out = s.outcomes[key];
    return (
      s.verdict === 'EXIT' &&
      s.split === 'OOS' &&
      out &&
      out.netTotalReturnPct !== null &&
      out.status !== 'PENDING' &&
      out.status !== 'DATA_UNAVAILABLE'
    );
  });

  const exitAvoidedNeg = resolvedOosExits.filter(
    (s) => (s.outcomes[key]?.netTotalReturnPct ?? 0) < 0
  ).length;
  const exitUnderperfNifty = resolvedOosExits.filter(
    (s) => (s.outcomes[key]?.excessReturnPct ?? 0) < 0
  ).length;

  const oosN = oosLongs.length;

  return {
    horizonDays,
    horizonLabel,
    trainCutoffDate: TRAIN_CUTOFF_DATE,
    trainSampleCount: trainLongs.length,
    oosSampleCount: oosN,
    rawBrierScoreOos: oosN > 0 ? round3(rawBrierSum / oosN) : null,
    calibratedBrierScoreOos: oosN > 0 ? round3(calBrierSum / oosN) : null,
    rawLogLossOos: oosN > 0 ? round3(rawLogLossSum / oosN) : null,
    calibratedLogLossOos: oosN > 0 ? round3(calLogLossSum / oosN) : null,
    rawEceOosPct: oosN > 0 ? round2(rawEceNum / oosN) : null,
    calibratedEceOosPct: oosN > 0 ? round2(calEceNum / oosN) : null,
    exitSignalCountOos: resolvedOosExits.length,
    exitAvoidedNegativeRateOosPct:
      resolvedOosExits.length > 0 ? round2((exitAvoidedNeg / resolvedOosExits.length) * 100) : null,
    exitUnderperformedNiftyRateOosPct:
      resolvedOosExits.length > 0
        ? round2((exitUnderperfNifty / resolvedOosExits.length) * 100)
        : null,
    buckets,
  };
}

function computeProfitFactor(returns: number[]): number | null {
  let grossProfit = 0;
  let grossLoss = 0;
  for (const r of returns) {
    if (r > 0) grossProfit += r;
    else if (r < 0) grossLoss += Math.abs(r);
  }
  if (grossLoss <= 0.0001) return grossProfit > 0 ? 9.99 : null;
  return round2(Math.min(9.99, grossProfit / grossLoss));
}

function classifyStockEdgeTier(
  winRate3M: number | null,
  avgExcess3M: number | null,
  profitFactor3M: number | null
): StockEdgeTier {
  if (winRate3M === null) return 'Neutral';
  const pf = profitFactor3M ?? 1;
  const ex = avgExcess3M ?? 0;
  if (winRate3M >= 60 && ex >= 1.2 && pf >= 1.5) return 'Strong';
  if (winRate3M >= 52 && ex >= -0.5 && pf >= 1.15) return 'Moderate';
  if (winRate3M < 44 || (ex < -3.0 && pf < 0.9)) return 'Weak';
  return 'Neutral';
}

function buildHorizonSummary(
  signals: BacktestSignalRecord[],
  horizonDays: BacktestHorizonDays,
  horizonLabel: '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y'
): BacktestHorizonSummary {
  const key = String(horizonDays);
  const buySignals = signals.filter((s) => s.verdict === 'BUY');
  const resolvedBuys = buySignals.filter((s) => {
    const o = s.outcomes[key];
    return o && o.status !== 'PENDING' && o.status !== 'DATA_UNAVAILABLE' && o.netTotalReturnPct !== null;
  });
  const pendingBuys = buySignals.filter((s) => s.outcomes[key]?.status === 'PENDING');

  const resolvedExits = signals.filter((s) => {
    const o = s.outcomes[key];
    return s.verdict === 'EXIT' && o && o.status !== 'PENDING' && o.status !== 'DATA_UNAVAILABLE' && o.netTotalReturnPct !== null;
  });

  const netPriceRets = resolvedBuys.map((s) => s.outcomes[key].netPriceReturnPct!);
  const netTotalRets = resolvedBuys.map((s) => s.outcomes[key].netTotalReturnPct!);
  const niftyRets = resolvedBuys
    .map((s) => s.outcomes[key].niftyReturnPct)
    .filter((v): v is number => v !== null);
  const excessRets = resolvedBuys
    .map((s) => s.outcomes[key].excessReturnPct)
    .filter((v): v is number => v !== null);
  const dds = resolvedBuys
    .map((s) => s.outcomes[key].maxDrawdownPct)
    .filter((v): v is number => v !== null);

  const wins = resolvedBuys.filter((s) => (s.outcomes[key].netTotalReturnPct ?? 0) > 0).length;
  const beatsNifty = resolvedBuys.filter((s) => (s.outcomes[key].excessReturnPct ?? -1) > 0).length;
  const targetHits = resolvedBuys.filter((s) => s.outcomes[key].status === 'TARGET_HIT').length;
  const stopHits = resolvedBuys.filter(
    (s) => s.outcomes[key].status === 'STOP_HIT' || s.outcomes[key].status === 'BOTH_SAME_BAR'
  ).length;
  const sameBarCount = resolvedBuys.filter(
    (s) => s.outcomes[key].status === 'BOTH_SAME_BAR'
  ).length;

  const exitAvoided = resolvedExits.filter((s) => (s.outcomes[key].netTotalReturnPct ?? 0) < 0).length;
  const n = resolvedBuys.length;

  return {
    horizonDays,
    horizonLabel,
    resolvedBuyCount: n,
    pendingBuyCount: pendingBuys.length,
    resolvedExitCount: resolvedExits.length,
    buyWinRatePct: n > 0 ? round2((wins / n) * 100) : null,
    buyBeatNiftyRatePct: excessRets.length > 0 ? round2((beatsNifty / excessRets.length) * 100) : null,
    avgNetPriceReturnPct: mean(netPriceRets) !== null ? round2(mean(netPriceRets)!) : null,
    avgNetTotalReturnPct: mean(netTotalRets) !== null ? round2(mean(netTotalRets)!) : null,
    medianNetReturnPct: median(netTotalRets) !== null ? round2(median(netTotalRets)!) : null,
    avgNiftyReturnPct: mean(niftyRets) !== null ? round2(mean(niftyRets)!) : null,
    avgExcessReturnPct: mean(excessRets) !== null ? round2(mean(excessRets)!) : null,
    targetHitRatePct: n > 0 ? round2((targetHits / n) * 100) : null,
    stopHitRatePct: n > 0 ? round2((stopHits / n) * 100) : null,
    sameBarStopFirstCount: sameBarCount,
    avgMaxDrawdownPct: mean(dds) !== null ? round2(mean(dds)!) : null,
    profitFactor: computeProfitFactor(netTotalRets),
    exitAvoidanceRatePct:
      resolvedExits.length > 0 ? round2((exitAvoided / resolvedExits.length) * 100) : null,
  };
}

/**
 * Capital-constrained equal-weight portfolio simulation vs Nifty 50.
 * Opens BUY positions at T+1 open up to maxConcurrentPositions, closes on target/stop/EXIT/1Y expiry,
 * applies NSE transaction costs on both legs, and samples monthly equity curve points.
 */
function simulatePortfolioEquityCurve(params: {
  seriesList: LoadedHistoricalSeries[];
  signals: BacktestSignalRecord[];
  niftyBars: HistoricalDailyBar[];
  costBps: number;
  maxConcurrentPositions: number;
}): { equityCurve: BacktestEquityPoint[]; metrics: BacktestPortfolioMetrics } {
  const { seriesList, signals, niftyBars, costBps, maxConcurrentPositions } = params;

  const emptyMetrics: BacktestPortfolioMetrics = {
    startDate: '',
    endDate: '',
    yearsSimulated: 0,
    portfolioCagrPct: 0,
    niftyCagrPct: 0,
    excessCagrPct: 0,
    portfolioTotalReturnPct: 0,
    niftyTotalReturnPct: 0,
    maxDrawdownPct: 0,
    niftyMaxDrawdownPct: 0,
    annualizedVolatilityPct: 0,
    sharpeRatio: null,
    sortinoRatio: null,
    profitFactor: null,
    avgWinPct: null,
    avgLossPct: null,
    totalClosedTrades: 0,
    annualTurnoverPct: 0,
  };

  if (niftyBars.length < 220 || signals.length === 0) {
    return { equityCurve: [], metrics: emptyMetrics };
  }

  // Build quick lookup: symbol -> Map<date, HistoricalDailyBar>
  const barBySymDate = new Map<string, Map<string, HistoricalDailyBar>>();
  for (const s of seriesList) {
    const m = new Map<string, HistoricalDailyBar>();
    for (const b of s.bars) m.set(b.date, b);
    barBySymDate.set(s.symbol, m);
  }

  // Group signals by entryDate (T+1 execution date)
  const buysByEntryDate = new Map<string, BacktestSignalRecord[]>();
  const exitsByEntryDate = new Map<string, Set<string>>();
  let earliestEntryDate = '9999-12-31';

  for (const sig of signals) {
    if (sig.entryDate < earliestEntryDate) earliestEntryDate = sig.entryDate;
    if (sig.verdict === 'BUY') {
      const list = buysByEntryDate.get(sig.entryDate) ?? [];
      list.push(sig);
      buysByEntryDate.set(sig.entryDate, list);
    } else if (sig.verdict === 'EXIT') {
      const set = exitsByEntryDate.get(sig.entryDate) ?? new Set<string>();
      set.add(sig.symbol);
      exitsByEntryDate.set(sig.entryDate, set);
    }
  }

  const timeline = niftyBars.filter((b) => b.date >= earliestEntryDate);
  if (timeline.length < 20) {
    return { equityCurve: [], metrics: emptyMetrics };
  }

  const initialCapital = 1_000_000;
  let cash = initialCapital;
  const costRate = clamp(costBps, 0, 200) / 10_000;
  const maxPos = clamp(Math.round(maxConcurrentPositions), 3, 25);

  interface OpenPos {
    symbol: string;
    shares: number;
    entryPrice: number;
    entryDate: string;
    targetPrice: number;
    stopLossPrice: number;
    lastPrice: number;
    daysHeld: number;
  }

  const openPositions = new Map<string, OpenPos>();
  const closedReturns: number[] = [];
  let totalTradedNotional = 0;

  const baseNifty = timeline[0].close;
  let peakEquity = initialCapital;
  let peakNifty = baseNifty;
  let maxPortDd = 0;
  let maxNiftyDd = 0;

  const monthlyCurve: BacktestEquityPoint[] = [];
  const monthlyReturns: number[] = [];
  let lastMonthKey = '';
  let lastMonthEquity = initialCapital;

  for (let i = 0; i < timeline.length; i++) {
    const date = timeline[i].date;
    const niftyClose = timeline[i].close;

    // 1. Check exits on existing positions (EXIT signal at open, gap/intraday stop/target, or 252-day expiry)
    const exitSymsToday = exitsByEntryDate.get(date);
    for (const [sym, pos] of Array.from(openPositions.entries())) {
      const bar = barBySymDate.get(sym)?.get(date);
      if (!bar) {
        pos.daysHeld++;
        continue;
      }
      pos.daysHeld++;

      let exitPx: number | null = null;
      if (exitSymsToday?.has(sym)) {
        exitPx = bar.open;
      } else if (bar.open <= pos.stopLossPrice) {
        exitPx = bar.open;
      } else if (bar.open >= pos.targetPrice) {
        exitPx = bar.open;
      } else {
        const hitStop = bar.low <= pos.stopLossPrice;
        const hitTarget = bar.high >= pos.targetPrice;
        if (hitStop && hitTarget) {
          exitPx = pos.stopLossPrice; // STOP_FIRST
        } else if (hitStop) {
          exitPx = pos.stopLossPrice;
        } else if (hitTarget) {
          exitPx = pos.targetPrice;
        } else if (pos.daysHeld >= 252) {
          exitPx = bar.close;
        }
      }

      if (exitPx !== null) {
        const grossProceeds = pos.shares * exitPx;
        const netProceeds = grossProceeds * (1 - costRate);
        cash += netProceeds;
        totalTradedNotional += grossProceeds;
        const tradeRetPct =
          ((exitPx * (1 - costRate)) / (pos.entryPrice * (1 + costRate)) - 1) * 100;
        closedReturns.push(tradeRetPct);
        openPositions.delete(sym);
      } else {
        pos.lastPrice = bar.close;
      }
    }

    // 2. Open new BUY positions scheduled for today's T+1 open (ranked by highest rawConfidence)
    const buyCandidates = buysByEntryDate.get(date);
    if (buyCandidates && buyCandidates.length > 0 && openPositions.size < maxPos) {
      const ranked = [...buyCandidates].sort((a, b) => b.rawConfidence - a.rawConfidence);
      for (const sig of ranked) {
        if (openPositions.size >= maxPos) break;
        if (openPositions.has(sig.symbol)) continue;
        const bar = barBySymDate.get(sig.symbol)?.get(date);
        if (!bar || bar.open <= 0) continue;

        const currentEquity =
          cash +
          Array.from(openPositions.values()).reduce((s, p) => s + p.shares * p.lastPrice, 0);
        const slotBudget = Math.min(cash * 0.99, currentEquity / maxPos);
        if (slotBudget < currentEquity * 0.03) continue;

        const effectiveEntry = bar.open * (1 + costRate);
        const shares = slotBudget / effectiveEntry;
        cash -= slotBudget;
        totalTradedNotional += slotBudget;
        openPositions.set(sig.symbol, {
          symbol: sig.symbol,
          shares,
          entryPrice: bar.open,
          entryDate: date,
          targetPrice: sig.targetPrice,
          stopLossPrice: sig.stopLossPrice,
          lastPrice: bar.close,
          daysHeld: 1,
        });
      }
    }

    // 3. Mark-to-market daily equity & drawdown
    let investedVal = 0;
    for (const pos of openPositions.values()) {
      investedVal += pos.shares * pos.lastPrice;
    }
    const equity = cash + investedVal;
    if (equity > peakEquity) peakEquity = equity;
    if (niftyClose > peakNifty) peakNifty = niftyClose;

    const portDd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    const niftyDd = peakNifty > 0 ? ((peakNifty - niftyClose) / peakNifty) * 100 : 0;
    if (portDd > maxPortDd) maxPortDd = portDd;
    if (niftyDd > maxNiftyDd) maxNiftyDd = niftyDd;

    const monthKey = date.slice(0, 7);
    const isLastBar = i === timeline.length - 1;
    if (monthKey !== lastMonthKey || isLastBar) {
      if (lastMonthKey !== '' && lastMonthEquity > 0) {
        monthlyReturns.push((equity - lastMonthEquity) / lastMonthEquity);
      }
      lastMonthKey = monthKey;
      lastMonthEquity = equity;

      const point: BacktestEquityPoint = {
        date,
        portfolioIndexed: round2((equity / initialCapital) * 100),
        niftyIndexed: round2((niftyClose / baseNifty) * 100),
        drawdownPct: round2(-portDd),
        niftyDrawdownPct: round2(-niftyDd),
        activePositions: openPositions.size,
      };
      if (
        monthlyCurve.length > 0 &&
        monthlyCurve[monthlyCurve.length - 1].date.slice(0, 7) === monthKey
      ) {
        monthlyCurve[monthlyCurve.length - 1] = point;
      } else {
        monthlyCurve.push(point);
      }
    }
  }

  const startDate = timeline[0].date;
  const endDate = timeline[timeline.length - 1].date;
  const years = Math.max(0.25, daysBetweenIso(startDate, endDate) / 365.25);

  const finalEquity =
    cash + Array.from(openPositions.values()).reduce((s, p) => s + p.shares * p.lastPrice, 0);
  const finalNifty = timeline[timeline.length - 1].close;

  const portTotalRet = ((finalEquity - initialCapital) / initialCapital) * 100;
  const niftyTotalRet = ((finalNifty - baseNifty) / baseNifty) * 100;
  const portCagr = (Math.pow(Math.max(0.01, finalEquity / initialCapital), 1 / years) - 1) * 100;
  const niftyCagr = (Math.pow(Math.max(0.01, finalNifty / baseNifty), 1 / years) - 1) * 100;

  const annVol = stdDev(monthlyReturns) * Math.sqrt(12) * 100;
  const rfPct = 6.5; // India 91-day T-bill risk-free benchmark
  const sharpe = annVol > 0.5 ? round2((portCagr - rfPct) / annVol) : null;

  const downsideMonthly = monthlyReturns.filter((r) => r < 0);
  const downsideDev =
    downsideMonthly.length > 1
      ? Math.sqrt(
          downsideMonthly.reduce((sum, r) => sum + r * r, 0) / downsideMonthly.length
        ) *
        Math.sqrt(12) *
        100
      : 0;
  const sortino = downsideDev > 0.5 ? round2((portCagr - rfPct) / downsideDev) : null;

  const winRets = closedReturns.filter((r) => r > 0);
  const lossRets = closedReturns.filter((r) => r < 0);
  const avgEquity = (initialCapital + finalEquity) / 2;
  const annualTurnover = avgEquity > 0 ? (totalTradedNotional / 2 / avgEquity / years) * 100 : 0;

  return {
    equityCurve: monthlyCurve.slice(-140),
    metrics: {
      startDate,
      endDate,
      yearsSimulated: round2(years),
      portfolioCagrPct: round2(portCagr),
      niftyCagrPct: round2(niftyCagr),
      excessCagrPct: round2(portCagr - niftyCagr),
      portfolioTotalReturnPct: round2(portTotalRet),
      niftyTotalReturnPct: round2(niftyTotalRet),
      maxDrawdownPct: round2(maxPortDd),
      niftyMaxDrawdownPct: round2(maxNiftyDd),
      annualizedVolatilityPct: round2(annVol),
      sharpeRatio: sharpe,
      sortinoRatio: sortino,
      profitFactor: computeProfitFactor(closedReturns),
      avgWinPct: mean(winRets) !== null ? round2(mean(winRets)!) : null,
      avgLossPct: mean(lossRets) !== null ? round2(mean(lossRets)!) : null,
      totalClosedTrades: closedReturns.length,
      annualTurnoverPct: round2(annualTurnover),
    },
  };
}

function selectEvaluationIndices(
  bars: HistoricalDailyBar[],
  frequency: BacktestSamplingFrequency
): number[] {
  const indices: number[] = [];
  if (bars.length <= 202) return indices;

  if (frequency === 'monthly') {
    let lastMonth = '';
    for (let i = 200; i < bars.length - 1; i++) {
      const m = bars[i].date.slice(0, 7);
      if (m !== lastMonth) {
        indices.push(i);
        lastMonth = m;
      }
    }
  } else {
    const step = frequency === 'weekly' ? 5 : 10;
    for (let i = 200; i < bars.length - 1; i += step) {
      indices.push(i);
    }
  }
  return indices;
}

export async function run10YearBacktest(
  request: BacktestRunRequest = {}
): Promise<BacktestRunResult> {
  const universeMode: BacktestUniverseMode = request.universeMode || 'portfolio_plus_flagship';
  const samplingFrequency: BacktestSamplingFrequency = request.samplingFrequency || 'monthly';
  const costBps = clamp(typeof request.costBps === 'number' ? request.costBps : 15, 0, 100);
  const maxConcurrentPositions = clamp(
    typeof request.maxConcurrentPositions === 'number' ? request.maxConcurrentPositions : 10,
    3,
    20
  );

  const normalizedPortfolio = Array.from(
    new Set(
      (request.portfolioSymbols ?? [])
        .map((s) => resolveActiveMarketSymbol(String(s || '')))
        .filter((s) => s.length >= 2 && !s.startsWith('^'))
    )
  );
  const portfolioSet = new Set(normalizedPortfolio);

  const normalizedCustom = Array.from(
    new Set(
      (request.customSymbols ?? [])
        .map((s) => resolveActiveMarketSymbol(String(s || '')))
        .filter((s) => s.length >= 2 && !s.startsWith('^'))
    )
  );

  let targetSymbols: string[] = [];
  if (normalizedCustom.length > 0) {
    targetSymbols = normalizedCustom.slice(0, 30);
  } else if (universeMode === 'portfolio_only') {
    targetSymbols =
      normalizedPortfolio.length > 0
        ? normalizedPortfolio.slice(0, 30)
        : FLAGSHIP_17_NSE_SYMBOLS.slice();
  } else if (universeMode === 'flagship') {
    targetSymbols = FLAGSHIP_17_NSE_SYMBOLS.slice();
  } else {
    // portfolio_plus_flagship
    const merged = Array.from(new Set([...normalizedPortfolio, ...FLAGSHIP_17_NSE_SYMBOLS]));
    targetSymbols = merged.slice(0, 28);
  }

  const cacheKey = `${universeMode}|${samplingFrequency}|${costBps}|${maxConcurrentPositions}|${targetSymbols
    .slice()
    .sort()
    .join(',')}`;
  const cachedRun = runCache.get(cacheKey);
  if (cachedRun && cachedRun.expiresAt > Date.now()) {
    latestCalibrationRun = cachedRun.data;
    return cachedRun.data;
  }

  // Fetch Nifty 50 benchmark + all target equities with bounded concurrency
  const [niftySeries, stockSeriesList] = await Promise.all([
    fetchYahoo10YSeries('^NSEI'),
    runWithConcurrency(targetSymbols, 5, (sym) => fetchYahoo10YSeries(sym)),
  ]);

  const niftyBars = niftySeries.bars;
  const niftyByDate = new Map<string, number>();
  const niftyRetByDate = new Map<string, number>();
  const niftyInd = precomputePointInTimeIndicators(niftyBars);
  const niftyRet21ByDate = new Map<string, number>();
  const niftyRet63ByDate = new Map<string, number>();
  const niftyRet126ByDate = new Map<string, number>();

  for (let i = 0; i < niftyBars.length; i++) {
    const d = niftyBars[i].date;
    niftyByDate.set(d, niftyBars[i].close);
    if (i > 0 && niftyBars[i - 1].close > 0) {
      niftyRetByDate.set(d, (niftyBars[i].close - niftyBars[i - 1].close) / niftyBars[i - 1].close);
    }
    if (niftyInd.ret21[i] !== null) niftyRet21ByDate.set(d, niftyInd.ret21[i]!);
    if (niftyInd.ret63[i] !== null) niftyRet63ByDate.set(d, niftyInd.ret63[i]!);
    if (niftyInd.ret126[i] !== null) niftyRet126ByDate.set(d, niftyInd.ret126[i]!);
  }

  const validSeries = stockSeriesList.filter((s) => s.quality.status !== 'UNAVAILABLE');
  const allSignals: BacktestSignalRecord[] = [];
  const signalsBySymbol = new Map<string, BacktestSignalRecord[]>();

  for (const series of validSeries) {
    const ind = precomputePointInTimeIndicators(series.bars);
    const evalIndices = selectEvaluationIndices(series.bars, samplingFrequency);
    const stockSignals: BacktestSignalRecord[] = [];

    for (const idx of evalIndices) {
      const bar = series.bars[idx];
      const nextBar = series.bars[idx + 1];
      if (!bar || !nextBar || nextBar.open <= 0) continue;

      const betaEst = estimatePointInTimeBeta(series.bars, idx, niftyRetByDate);
      const evalRes = reconstructPointInTimeSignal({
        price: bar.close,
        sma20: ind.sma20[idx],
        sma50: ind.sma50[idx],
        sma200: ind.sma200[idx],
        ema20: ind.ema20[idx],
        rsi14: ind.rsi14[idx],
        vol30Ann: ind.vol30Ann[idx],
        ret21: ind.ret21[idx],
        ret63: ind.ret63[idx],
        ret126: ind.ret126[idx],
        high252: ind.high252[idx],
        low252: ind.low252[idx],
        niftyRet21: lookupNearestPriorValue(niftyRet21ByDate, bar.date),
        niftyRet63: lookupNearestPriorValue(niftyRet63ByDate, bar.date),
        niftyRet126: lookupNearestPriorValue(niftyRet126ByDate, bar.date),
        betaEst,
      });

      const outcomes: Record<string, BacktestSignalOutcome> = {};
      for (const h of BACKTEST_HORIZONS) {
        outcomes[String(h.days)] = simulateSignalExecution({
          bars: series.bars,
          signalIdx: idx,
          verdict: evalRes.verdict,
          targetPrice: evalRes.targetPrice,
          stopLossPrice: evalRes.stopLossPrice,
          horizonDays: h.days,
          horizonLabel: h.label,
          costBps,
          niftyByDate,
        });
      }

      const record: BacktestSignalRecord = {
        id: `${series.ticker}_${bar.date}`,
        symbol: series.symbol,
        ticker: series.ticker,
        companyName: series.companyName,
        sector: series.sector,
        signalDate: bar.date,
        entryDate: nextBar.date,
        entryPrice: nextBar.open,
        signalClosePrice: bar.close,
        verdict: evalRes.verdict,
        conviction: evalRes.conviction,
        rawConfidence: evalRes.rawConfidence,
        calibratedProb3M: null,
        targetPrice: evalRes.targetPrice,
        stopLossPrice: evalRes.stopLossPrice,
        rsi14: ind.rsi14[idx] !== null ? round2(ind.rsi14[idx]!) : null,
        betaEst: evalRes.betaEst,
        split: bar.date <= TRAIN_CUTOFF_DATE ? 'TRAIN' : 'OOS',
        outcomes,
      };

      stockSignals.push(record);
      allSignals.push(record);
    }

    signalsBySymbol.set(series.symbol, stockSignals);
  }

  // Calibration across all 6 horizons
  const calibrationByHorizon: Record<string, BacktestCalibrationReport> = {};
  for (const h of BACKTEST_HORIZONS) {
    calibrationByHorizon[String(h.days)] = computeCalibrationReport(allSignals, h.days, h.label);
  }

  // Stamp calibrated 3M win probability onto every signal from Train-fitted isotonic buckets
  const cal3M = calibrationByHorizon['63'];
  if (cal3M) {
    for (const sig of allSignals) {
      const bIdx = findConfidenceBucketIndex(sig.rawConfidence);
      sig.calibratedProb3M = cal3M.buckets[bIdx]?.oosCalibratedProbPct ?? null;
    }
  }

  // Horizon summaries across all 6 horizons
  const horizonSummaries = BACKTEST_HORIZONS.map((h) =>
    buildHorizonSummary(allSignals, h.days, h.label)
  );

  // Per-stock scorecards
  const stockScorecards: BacktestStockScorecard[] = validSeries.map((series) => {
    const sList = signalsBySymbol.get(series.symbol) ?? [];
    const buys = sList.filter((s) => s.verdict === 'BUY');
    const holds = sList.filter((s) => s.verdict === 'HOLD');
    const exits = sList.filter((s) => s.verdict === 'EXIT');

    const winRateFor = (days: BacktestHorizonDays): number | null => {
      const resolved = buys.filter((s) => {
        const o = s.outcomes[String(days)];
        return o && o.status !== 'PENDING' && o.status !== 'DATA_UNAVAILABLE' && o.netTotalReturnPct !== null;
      });
      if (resolved.length === 0) return null;
      const wins = resolved.filter((s) => (s.outcomes[String(days)].netTotalReturnPct ?? 0) > 0).length;
      return round2((wins / resolved.length) * 100);
    };

    const resolved3M = buys.filter((s) => {
      const o = s.outcomes['63'];
      return o && o.status !== 'PENDING' && o.status !== 'DATA_UNAVAILABLE' && o.netTotalReturnPct !== null;
    });
    const resolved1Y = buys.filter((s) => {
      const o = s.outcomes['252'];
      return o && o.status !== 'PENDING' && o.status !== 'DATA_UNAVAILABLE' && o.netTotalReturnPct !== null;
    });
    const resolvedExits3M = exits.filter((s) => {
      const o = s.outcomes['63'];
      return o && o.status !== 'PENDING' && o.status !== 'DATA_UNAVAILABLE' && o.netTotalReturnPct !== null;
    });

    const netPrice3M = resolved3M.map((s) => s.outcomes['63'].netPriceReturnPct!);
    const netTotal3M = resolved3M.map((s) => s.outcomes['63'].netTotalReturnPct!);
    const excess3M = resolved3M
      .map((s) => s.outcomes['63'].excessReturnPct)
      .filter((v): v is number => v !== null);
    const dd3M = resolved3M
      .map((s) => s.outcomes['63'].maxDrawdownPct)
      .filter((v): v is number => v !== null);

    const netPrice1Y = resolved1Y.map((s) => s.outcomes['252'].netPriceReturnPct!);
    const netTotal1Y = resolved1Y.map((s) => s.outcomes['252'].netTotalReturnPct!);
    const excess1Y = resolved1Y
      .map((s) => s.outcomes['252'].excessReturnPct)
      .filter((v): v is number => v !== null);

    const winRate3M = winRateFor(63);
    const avgExcess3M = mean(excess3M) !== null ? round2(mean(excess3M)!) : null;
    const profitFactor3M = computeProfitFactor(netTotal3M);

    const targetHits3M = resolved3M.filter((s) => s.outcomes['63'].status === 'TARGET_HIT').length;
    const stopHits3M = resolved3M.filter(
      (s) => s.outcomes['63'].status === 'STOP_HIT' || s.outcomes['63'].status === 'BOTH_SAME_BAR'
    ).length;
    const exitAvoided3M = resolvedExits3M.filter(
      (s) => (s.outcomes['63'].netTotalReturnPct ?? 0) < 0
    ).length;

    return {
      symbol: series.symbol,
      ticker: series.ticker,
      companyName: series.companyName,
      sector: series.sector,
      historyYears: series.quality.historyYears,
      totalSignals: sList.length,
      buySignals: buys.length,
      holdSignals: holds.length,
      exitSignals: exits.length,
      winRate1M: winRateFor(21),
      winRate3M,
      winRate6M: winRateFor(126),
      winRate1Y: winRateFor(252),
      avgNetReturn3M: mean(netPrice3M) !== null ? round2(mean(netPrice3M)!) : null,
      avgTotalReturn3M: mean(netTotal3M) !== null ? round2(mean(netTotal3M)!) : null,
      avgExcessReturn3M: avgExcess3M,
      avgNetReturn1Y: mean(netPrice1Y) !== null ? round2(mean(netPrice1Y)!) : null,
      avgTotalReturn1Y: mean(netTotal1Y) !== null ? round2(mean(netTotal1Y)!) : null,
      avgExcessReturn1Y: mean(excess1Y) !== null ? round2(mean(excess1Y)!) : null,
      targetHitRate3M: resolved3M.length > 0 ? round2((targetHits3M / resolved3M.length) * 100) : null,
      stopHitRate3M: resolved3M.length > 0 ? round2((stopHits3M / resolved3M.length) * 100) : null,
      exitAvoidanceRate3M:
        resolvedExits3M.length > 0 ? round2((exitAvoided3M / resolvedExits3M.length) * 100) : null,
      profitFactor3M,
      maxDrawdown3M: mean(dd3M) !== null ? round2(mean(dd3M)!) : null,
      edgeTier: classifyStockEdgeTier(winRate3M, avgExcess3M, profitFactor3M),
      inUserPortfolio: portfolioSet.has(series.symbol),
    };
  });

  stockScorecards.sort((a, b) => (b.avgExcessReturn3M ?? -999) - (a.avgExcessReturn3M ?? -999));

  // Capital-constrained portfolio simulation vs Nifty 50
  const { equityCurve, metrics: portfolioMetrics } = simulatePortfolioEquityCurve({
    seriesList: validSeries,
    signals: allSignals,
    niftyBars,
    costBps,
    maxConcurrentPositions,
  });

  // Sort signals newest first for fast inspection
  allSignals.sort((a, b) => b.signalDate.localeCompare(a.signalDate) || a.symbol.localeCompare(b.symbol));

  const universeLabel =
    universeMode === 'portfolio_only'
      ? `My Portfolio (${validSeries.length} NSE)`
      : universeMode === 'flagship'
      ? `Flagship ${validSeries.length} NSE`
      : normalizedPortfolio.length > 0
      ? `Portfolio + Flagships (${validSeries.length} NSE)`
      : `Flagship ${validSeries.length} NSE`;

  const runResult: BacktestRunResult = {
    runId: `bt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: `${universeLabel} · ${costBps} bps`,
    methodology: 'TECH_RECONSTRUCTED_V1',
    methodologyNote:
      'Zero-look-ahead technical reconstruction (200-DMA warm-up, point-in-time Nifty 50 RS, T+1 open execution, STOP_FIRST same-bar rule, NSE slippage/STT drag, dividend-adjusted Total Return). Today’s fundamentals are excluded from historical dates to prevent look-ahead leakage.',
    universeMode,
    samplingFrequency,
    costBps,
    trainCutoffDate: TRAIN_CUTOFF_DATE,
    symbolsRequested: targetSymbols,
    symbolsEvaluated: validSeries.map((s) => s.symbol),
    portfolioMetrics,
    horizonSummaries,
    calibrationByHorizon,
    stockScorecards,
    equityCurve,
    signals: allSignals,
    totalSignalsGenerated: allSignals.length,
    dataQuality: stockSeriesList.map((s) => s.quality),
    computedAt: new Date().toISOString(),
  };

  runCache.set(cacheKey, { data: runResult, expiresAt: Date.now() + RUN_CACHE_TTL_MS });
  latestCalibrationRun = runResult;
  return runResult;
}

export async function ensureBaselineBacktest(): Promise<BacktestRunResult | null> {
  if (latestCalibrationRun) return latestCalibrationRun;
  if (!baselineWarmPromise) {
    baselineWarmPromise = run10YearBacktest({
      universeMode: 'flagship',
      samplingFrequency: 'monthly',
      costBps: 15,
    })
      .catch((err) => {
        console.warn('Baseline 10Y backtest warm-up failed:', err);
        return null;
      })
      .finally(() => {
        baselineWarmPromise = null;
      });
  }
  return baselineWarmPromise;
}

export async function getLiveCalibrationForSymbol(params: {
  symbol: string;
  rawConfidence: number;
  waitMs?: number;
}): Promise<LiveCalibrationContext | null> {
  const sym = resolveActiveMarketSymbol(params.symbol);
  if (!sym || sym.startsWith('^')) return null;

  let run = latestCalibrationRun;
  if (!run) {
    const waitMs = params.waitMs ?? 2500;
    const warmPromise = ensureBaselineBacktest();
    if (waitMs > 0) {
      run = await Promise.race([
        warmPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
      ]);
    }
  }
  if (!run) return null;

  const cal3M = run.calibrationByHorizon['63'];
  const cal1Y = run.calibrationByHorizon['252'];
  if (!cal3M) return null;

  const bucketIdx = findConfidenceBucketIndex(params.rawConfidence);
  const bucket3M = cal3M.buckets[bucketIdx];
  const bucket1Y = cal1Y?.buckets[bucketIdx];
  const scorecard = run.stockScorecards.find((s) => s.symbol === sym) ?? null;

  return {
    calibratedWinProb3M: bucket3M?.oosCalibratedProbPct ?? null,
    calibratedWinProb1Y: bucket1Y?.oosCalibratedProbPct ?? null,
    rawConfidenceBucket: bucket3M?.bucketLabel ?? '55–65',
    oosSampleCount: cal3M.oosSampleCount,
    stockEdgeTier: scorecard?.edgeTier ?? null,
    stockWinRate3M: scorecard?.winRate3M ?? null,
    stockExcessReturn3M: scorecard?.avgExcessReturn3M ?? null,
    stockProfitFactor: scorecard?.profitFactor3M ?? null,
    exitAvoidanceRate3M: scorecard?.exitAvoidanceRate3M ?? null,
    sampleHorizonLabel: '3M OOS (2024–2026)',
    methodologyTag: 'TECH_RECONSTRUCTED_V1',
    sourceRunLabel: run.label,
  };
}

/**
 * Deterministic Synthetic Financial Validation Suite (9 required fixtures).
 * Verifies zero look-ahead, T+1 open fill, STOP_FIRST tie-breaking, gap-down execution,
 * dividend total return, split continuity, and PENDING forward window handling.
 */
export function runDeterministicValidationSuite(): {
  passed: number;
  failed: number;
  cases: Array<{ name: string; pass: boolean; detail: string }>;
} {
  const cases: Array<{ name: string; pass: boolean; detail: string }> = [];

  const makeDate = (idx: number): string => {
    const d = new Date(Date.UTC(2024, 0, 2 + idx));
    return d.toISOString().slice(0, 10);
  };

  const flatNifty = new Map<string, number>();
  for (let i = 0; i < 120; i++) flatNifty.set(makeDate(i), 20000);

  // 1. Continuously rising stock -> TARGET_HIT
  {
    const bars: HistoricalDailyBar[] = Array.from({ length: 40 }, (_, i) => {
      const px = 100 + i * 2;
      return {
        date: makeDate(i),
        timestamp: i,
        open: px,
        high: px + 1,
        low: px - 0.5,
        close: px + 0.5,
        adjClose: px + 0.5,
        volume: 1000,
      };
    });
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: 'BUY',
      targetPrice: 112,
      stopLossPrice: 92,
      horizonDays: 21,
      horizonLabel: '1M',
      costBps: 15,
      niftyByDate: flatNifty,
    });
    const pass =
      res.status === 'TARGET_HIT' &&
      res.firstHit === 'TARGET' &&
      res.exitPrice === 112 &&
      (res.netPriceReturnPct ?? 0) > 9.3 &&
      (res.netPriceReturnPct ?? 0) < 9.7;
    cases.push({
      name: '1. Continuously rising stock hits TARGET on T+1 entry',
      pass,
      detail: `status=${res.status}, exit=${res.exitPrice}, net=${res.netPriceReturnPct}%`,
    });
  }

  // 2. Continuously falling stock -> STOP_HIT
  {
    const bars: HistoricalDailyBar[] = Array.from({ length: 40 }, (_, i) => {
      const px = Math.max(20, 100 - i * 2);
      return {
        date: makeDate(i),
        timestamp: i,
        open: px,
        high: px + 0.5,
        low: px - 1,
        close: px - 0.5,
        adjClose: px - 0.5,
        volume: 1000,
      };
    });
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: 'BUY',
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: '1M',
      costBps: 15,
      niftyByDate: flatNifty,
    });
    const pass = res.status === 'STOP_HIT' && res.firstHit === 'STOP' && (res.netPriceReturnPct ?? 0) < -7;
    cases.push({
      name: '2. Continuously falling stock hits STOP_LOSS',
      pass,
      detail: `status=${res.status}, exit=${res.exitPrice}, net=${res.netPriceReturnPct}%`,
    });
  }

  // 3. Target hit before stop
  {
    const bars: HistoricalDailyBar[] = [
      { date: makeDate(0), timestamp: 0, open: 100, high: 101, low: 99, close: 100, adjClose: 100, volume: 1000 },
      { date: makeDate(1), timestamp: 1, open: 100, high: 104, low: 98, close: 103, adjClose: 103, volume: 1000 },
      { date: makeDate(2), timestamp: 2, open: 104, high: 116, low: 103, close: 114, adjClose: 114, volume: 1000 },
      { date: makeDate(3), timestamp: 3, open: 112, high: 113, low: 85, close: 88, adjClose: 88, volume: 1000 },
    ];
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: 'BUY',
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: '1M',
      costBps: 0,
      niftyByDate: flatNifty,
    });
    const pass = res.status === 'TARGET_HIT' && res.exitDate === makeDate(2) && res.exitPrice === 115;
    cases.push({
      name: '3. Target hit before subsequent stop drop',
      pass,
      detail: `status=${res.status}, exitDate=${res.exitDate}, exitPrice=${res.exitPrice}`,
    });
  }

  // 4. Stop hit before subsequent target rally
  {
    const bars: HistoricalDailyBar[] = [
      { date: makeDate(0), timestamp: 0, open: 100, high: 101, low: 99, close: 100, adjClose: 100, volume: 1000 },
      { date: makeDate(1), timestamp: 1, open: 100, high: 102, low: 89, close: 92, adjClose: 92, volume: 1000 },
      { date: makeDate(2), timestamp: 2, open: 95, high: 120, low: 95, close: 118, adjClose: 118, volume: 1000 },
    ];
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: 'BUY',
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: '1M',
      costBps: 0,
      niftyByDate: flatNifty,
    });
    const pass = res.status === 'STOP_HIT' && res.exitDate === makeDate(1) && res.exitPrice === 90;
    cases.push({
      name: '4. Stop hit before subsequent rally',
      pass,
      detail: `status=${res.status}, exitDate=${res.exitDate}, exitPrice=${res.exitPrice}`,
    });
  }

  // 5. Same-bar dual hit -> conservative STOP_FIRST
  {
    const bars: HistoricalDailyBar[] = [
      { date: makeDate(0), timestamp: 0, open: 100, high: 101, low: 99, close: 100, adjClose: 100, volume: 1000 },
      { date: makeDate(1), timestamp: 1, open: 100, high: 118, low: 88, close: 105, adjClose: 105, volume: 1000 },
    ];
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: 'BUY',
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: '1M',
      costBps: 0,
      niftyByDate: flatNifty,
    });
    const pass = res.status === 'BOTH_SAME_BAR' && res.firstHit === 'STOP' && res.exitPrice === 90;
    cases.push({
      name: '5. Same-candle dual hit resolves conservatively to STOP_FIRST',
      pass,
      detail: `status=${res.status}, firstHit=${res.firstHit}, exitPrice=${res.exitPrice}`,
    });
  }

  // 6. Overnight gap-down below stop fills at realistic gap open
  {
    const bars: HistoricalDailyBar[] = [
      { date: makeDate(0), timestamp: 0, open: 100, high: 101, low: 99, close: 100, adjClose: 100, volume: 1000 },
      { date: makeDate(1), timestamp: 1, open: 100, high: 102, low: 99, close: 101, adjClose: 101, volume: 1000 },
      { date: makeDate(2), timestamp: 2, open: 82, high: 86, low: 80, close: 84, adjClose: 84, volume: 1000 },
    ];
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: 'BUY',
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: '1M',
      costBps: 0,
      niftyByDate: flatNifty,
    });
    const pass = res.status === 'STOP_HIT' && res.exitPrice === 82 && res.grossPriceReturnPct === -18;
    cases.push({
      name: '6. Overnight gap below stop fills at gap open (82 vs 90 stop)',
      pass,
      detail: `status=${res.status}, exitPrice=${res.exitPrice}, gross=${res.grossPriceReturnPct}%`,
    });
  }

  // 7. Split-adjusted continuity (already split-adjusted Yahoo series produces 0% phantom jump)
  {
    const bars: HistoricalDailyBar[] = Array.from({ length: 25 }, (_, i) => ({
      date: makeDate(i),
      timestamp: i,
      open: 500,
      high: 505,
      low: 495,
      close: 500,
      adjClose: 500,
      volume: 1000,
    }));
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: 'BUY',
      targetPrice: 580,
      stopLossPrice: 450,
      horizonDays: 21,
      horizonLabel: '1M',
      costBps: 0,
      niftyByDate: flatNifty,
    });
    const pass = res.status === 'HORIZON_EXPIRED' && res.grossPriceReturnPct === 0;
    cases.push({
      name: '7. Split-adjusted series shows zero phantom return jump',
      pass,
      detail: `status=${res.status}, grossPriceReturn=${res.grossPriceReturnPct}%`,
    });
  }

  // 8. Dividend Total Return > Price Return via adjClose compounding
  {
    const bars: HistoricalDailyBar[] = Array.from({ length: 25 }, (_, i) => ({
      date: makeDate(i),
      timestamp: i,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      // 4% dividend ex-date on bar 10 raises adjClose ratio from 0.96 -> 1.00
      adjClose: i < 10 ? 96 : 100,
      volume: 1000,
    }));
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: 'BUY',
      targetPrice: 120,
      stopLossPrice: 85,
      horizonDays: 21,
      horizonLabel: '1M',
      costBps: 0,
      niftyByDate: flatNifty,
    });
    const pass =
      res.status === 'HORIZON_EXPIRED' &&
      res.grossPriceReturnPct === 0 &&
      (res.grossTotalReturnPct ?? 0) > 4.0;
    cases.push({
      name: '8. Dividend-adjusted Total Return captures yield above Price Return',
      pass,
      detail: `priceRet=${res.grossPriceReturnPct}%, totalRet=${res.grossTotalReturnPct}%`,
    });
  }

  // 9. Incomplete forward horizon returns PENDING & null won
  {
    const bars: HistoricalDailyBar[] = Array.from({ length: 15 }, (_, i) => ({
      date: makeDate(i),
      timestamp: i,
      open: 100,
      high: 103,
      low: 98,
      close: 101,
      adjClose: 101,
      volume: 1000,
    }));
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: 'BUY',
      targetPrice: 120,
      stopLossPrice: 85,
      horizonDays: 63,
      horizonLabel: '3M',
      costBps: 15,
      niftyByDate: flatNifty,
    });
    const pass = res.status === 'PENDING' && res.won === null && res.netTotalReturnPct === null;
    cases.push({
      name: '9. Incomplete forward window marked PENDING and excluded from win rate',
      pass,
      detail: `status=${res.status}, won=${String(res.won)}, netTotal=${String(res.netTotalReturnPct)}`,
    });
  }

  const passed = cases.filter((c) => c.pass).length;
  return { passed, failed: cases.length - passed, cases };
}
