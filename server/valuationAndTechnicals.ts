import { INDIAN_STOCK_UNIVERSE } from './indianMarketCatalog.ts';
import type {
  CandlePoint,
  IntrinsicFairValue,
  LiveFundamentalsSnapshot,
  PivotPointsSnapshot,
  TechnicalIndicatorReading,
  TechnicalSignalVote,
  TechnicalSummary,
  TechnicalSummaryRating,
  TechnicalTimeframeSummary,
  ValuationModelPoint,
} from '../src/types/market.ts';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round2(v: number): number {
  return Number(v.toFixed(2));
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i];
  }
  return sum / period;
}

function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let cur = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out: number[] = [cur];
  for (let i = period; i < values.length; i++) {
    cur = values[i] * k + cur * (1 - k);
    out.push(cur);
  }
  return out;
}

function computeRsi14(closes: number[]): number | null {
  const period = 14;
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function computeMacd(closes: number[]): { macd: number; signal: number; hist: number } | null {
  if (closes.length < 36) return null;
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const offset = 26 - 12;
  const macdLine: number[] = [];
  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + offset] - ema26[i]);
  }
  if (macdLine.length < 9) return null;
  const signalSeries = emaSeries(macdLine, 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  return { macd, signal, hist: macd - signal };
}

function computeStochastic14(
  highs: number[],
  lows: number[],
  closes: number[]
): { k: number; d: number } | null {
  const period = 14;
  if (closes.length < period + 3) return null;
  const kSeries: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    const denom = hh - ll;
    kSeries.push(denom > 0 ? ((closes[i] - ll) / denom) * 100 : 50);
  }
  const k = kSeries[kSeries.length - 1];
  const d =
    (kSeries[kSeries.length - 1] + kSeries[kSeries.length - 2] + kSeries[kSeries.length - 3]) / 3;
  return { k, d };
}

function computeAdx14(
  highs: number[],
  lows: number[],
  closes: number[]
): { adx: number; plusDi: number; minusDi: number } | null {
  const period = 14;
  if (closes.length < period * 2 + 2) return null;

  const trList: number[] = [];
  const plusDmList: number[] = [];
  const minusDmList: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trList.push(tr);
    plusDmList.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDmList.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let trSmooth = trList.slice(0, period).reduce((a, b) => a + b, 0);
  let plusSmooth = plusDmList.slice(0, period).reduce((a, b) => a + b, 0);
  let minusSmooth = minusDmList.slice(0, period).reduce((a, b) => a + b, 0);

  const dxList: number[] = [];
  let lastPlusDi = 0;
  let lastMinusDi = 0;

  for (let i = period; i < trList.length; i++) {
    trSmooth = trSmooth - trSmooth / period + trList[i];
    plusSmooth = plusSmooth - plusSmooth / period + plusDmList[i];
    minusSmooth = minusSmooth - minusSmooth / period + minusDmList[i];
    const plusDi = trSmooth > 0 ? (plusSmooth / trSmooth) * 100 : 0;
    const minusDi = trSmooth > 0 ? (minusSmooth / trSmooth) * 100 : 0;
    lastPlusDi = plusDi;
    lastMinusDi = minusDi;
    const sumDi = plusDi + minusDi;
    dxList.push(sumDi > 0 ? (Math.abs(plusDi - minusDi) / sumDi) * 100 : 0);
  }

  if (dxList.length < period) return null;
  let adx = dxList.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxList.length; i++) {
    adx = (adx * (period - 1) + dxList[i]) / period;
  }

  return { adx, plusDi: lastPlusDi, minusDi: lastMinusDi };
}

function computeCci20(highs: number[], lows: number[], closes: number[]): number | null {
  const period = 20;
  if (closes.length < period) return null;
  const tp: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
  }
  const mean = tp.reduce((a, b) => a + b, 0) / period;
  const meanDev = tp.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
  if (meanDev === 0) return 0;
  return (tp[tp.length - 1] - mean) / (0.015 * meanDev);
}

function computeWilliamsR14(highs: number[], lows: number[], closes: number[]): number | null {
  const period = 14;
  if (closes.length < period) return null;
  let hh = -Infinity;
  let ll = Infinity;
  for (let i = closes.length - period; i < closes.length; i++) {
    if (highs[i] > hh) hh = highs[i];
    if (lows[i] < ll) ll = lows[i];
  }
  const denom = hh - ll;
  if (denom <= 0) return -50;
  return ((hh - closes[closes.length - 1]) / denom) * -100;
}

function classifyVoteRatio(buy: number, sell: number, total: number): TechnicalSummaryRating {
  if (total <= 0) return 'Neutral';
  const net = (buy - sell) / total;
  if (net >= 0.5) return 'Strong Buy';
  if (net >= 0.16) return 'Buy';
  if (net <= -0.5) return 'Strong Sell';
  if (net <= -0.16) return 'Sell';
  return 'Neutral';
}

function computeTimeframeSummary(
  clean: CandlePoint[],
  livePrice: number
): TechnicalTimeframeSummary | null {
  if (clean.length < 18 || !Number.isFinite(livePrice) || livePrice <= 0) {
    return null;
  }

  const closes = clean.map((c) => c.close);
  const highs = clean.map((c) => c.high);
  const lows = clean.map((c) => c.low);

  // 1. Moving Averages (up to 6 depending on lookback depth)
  const maSpecs: Array<{ name: string; val: number | null }> = [
    { name: 'EMA (10)', val: emaSeries(closes, 10).at(-1) ?? null },
    { name: 'SMA (20)', val: sma(closes, 20) },
    { name: 'EMA (20)', val: emaSeries(closes, 20).at(-1) ?? null },
    { name: 'SMA (50)', val: sma(closes, 50) },
    { name: 'SMA (100)', val: sma(closes, 100) },
    { name: 'SMA (200)', val: sma(closes, 200) },
  ];

  const maItems: TechnicalIndicatorReading[] = [];
  for (const spec of maSpecs) {
    if (spec.val === null) continue;
    let signal: TechnicalSignalVote = 'Neutral';
    if (livePrice > spec.val * 1.003) signal = 'Buy';
    else if (livePrice < spec.val * 0.997) signal = 'Sell';
    maItems.push({
      name: spec.name,
      value: `₹${spec.val.toFixed(2)}`,
      signal,
    });
  }

  // 2. Oscillators & Trend Indicators (up to 6)
  const oscItems: TechnicalIndicatorReading[] = [];

  const rsi = computeRsi14(closes);
  if (rsi !== null) {
    let signal: TechnicalSignalVote = 'Neutral';
    if ((rsi >= 55 && rsi < 75) || rsi <= 30) signal = 'Buy';
    else if (rsi >= 75 || (rsi > 30 && rsi <= 45)) signal = 'Sell';
    oscItems.push({ name: 'RSI (14)', value: rsi.toFixed(1), signal });
  }

  const macd = computeMacd(closes);
  if (macd) {
    let signal: TechnicalSignalVote = 'Neutral';
    if (macd.macd > macd.signal && macd.hist > 0) signal = 'Buy';
    else if (macd.macd < macd.signal && macd.hist < 0) signal = 'Sell';
    oscItems.push({
      name: 'MACD (12,26)',
      value: `${macd.macd >= 0 ? '+' : ''}${macd.macd.toFixed(2)}`,
      signal,
    });
  }

  const stoch = computeStochastic14(highs, lows, closes);
  if (stoch) {
    let signal: TechnicalSignalVote = 'Neutral';
    if (stoch.k < 20 || (stoch.k > stoch.d && stoch.k > 50 && stoch.k < 82)) signal = 'Buy';
    else if (stoch.k > 82 || (stoch.k < stoch.d && stoch.k < 50)) signal = 'Sell';
    oscItems.push({ name: 'Stoch %K (14)', value: stoch.k.toFixed(1), signal });
  }

  const adx = computeAdx14(highs, lows, closes);
  if (adx) {
    let signal: TechnicalSignalVote = 'Neutral';
    if (adx.adx >= 18 && adx.plusDi > adx.minusDi + 1.5) signal = 'Buy';
    else if (adx.adx >= 18 && adx.minusDi > adx.plusDi + 1.5) signal = 'Sell';
    oscItems.push({ name: 'ADX (14)', value: adx.adx.toFixed(1), signal });
  }

  const cci = computeCci20(highs, lows, closes);
  if (cci !== null) {
    let signal: TechnicalSignalVote = 'Neutral';
    if (cci >= 60) signal = 'Buy';
    else if (cci <= -60) signal = 'Sell';
    oscItems.push({ name: 'CCI (20)', value: cci.toFixed(0), signal });
  }

  const willR = computeWilliamsR14(highs, lows, closes);
  if (willR !== null) {
    let signal: TechnicalSignalVote = 'Neutral';
    if ((willR >= -38 && willR <= -8) || willR <= -82) signal = 'Buy';
    else if (willR < -62 && willR > -82) signal = 'Sell';
    oscItems.push({ name: 'Williams %R', value: willR.toFixed(1), signal });
  }

  const countVotes = (items: TechnicalIndicatorReading[]) => ({
    buyCount: items.filter((i) => i.signal === 'Buy').length,
    neutralCount: items.filter((i) => i.signal === 'Neutral').length,
    sellCount: items.filter((i) => i.signal === 'Sell').length,
  });

  const maCounts = countVotes(maItems);
  const oscCounts = countVotes(oscItems);
  const totalBuy = maCounts.buyCount + oscCounts.buyCount;
  const totalNeutral = maCounts.neutralCount + oscCounts.neutralCount;
  const totalSell = maCounts.sellCount + oscCounts.sellCount;
  const totalCount = totalBuy + totalNeutral + totalSell;

  if (totalCount === 0) return null;

  return {
    rating: classifyVoteRatio(totalBuy, totalSell, totalCount),
    buyCount: totalBuy,
    neutralCount: totalNeutral,
    sellCount: totalSell,
    movingAverages: {
      rating: classifyVoteRatio(maCounts.buyCount, maCounts.sellCount, maItems.length),
      ...maCounts,
      items: maItems,
    },
    oscillators: {
      rating: classifyVoteRatio(oscCounts.buyCount, oscCounts.sellCount, oscItems.length),
      ...oscCounts,
      items: oscItems,
    },
  };
}

function toEpochMs(timestamp: number): number {
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}

function getIsoWeekKey(timestamp: number): string {
  const d = new Date(toEpochMs(timestamp));
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function aggregateWeeklyCandles(daily: CandlePoint[]): CandlePoint[] {
  const buckets = new Map<string, CandlePoint>();
  for (const c of daily) {
    if (!Number.isFinite(c.timestamp) || c.timestamp <= 0) continue;
    const key = getIsoWeekKey(c.timestamp);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...c });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume = (existing.volume || 0) + (c.volume || 0);
      existing.timestamp = c.timestamp;
      existing.dateLabel = c.dateLabel;
    }
  }
  return Array.from(buckets.values());
}

function computeClassicPivots(clean: CandlePoint[]): PivotPointsSnapshot | null {
  if (clean.length < 2) return null;
  // Use the latest completed daily session (prior bar if latest bar looks flat/partial, else last bar)
  const latest = clean[clean.length - 1];
  const ref =
    latest.high > latest.low && latest.close > 0 ? latest : clean[clean.length - 2];
  if (!ref || !Number.isFinite(ref.high) || !Number.isFinite(ref.low) || !Number.isFinite(ref.close)) {
    return null;
  }

  const H = ref.high;
  const L = ref.low;
  const C = ref.close;
  const P = (H + L + C) / 3;
  const r1 = 2 * P - L;
  const s1 = 2 * P - H;
  const r2 = P + (H - L);
  const s2 = P - (H - L);
  const r3 = H + 2 * (P - L);
  const s3 = L - 2 * (H - P);

  const basisDate =
    ref.timestamp > 0
      ? new Date(toEpochMs(ref.timestamp)).toISOString().slice(0, 10)
      : ref.dateLabel || new Date().toISOString().slice(0, 10);

  return {
    pivot: round2(P),
    r1: round2(r1),
    r2: round2(r2),
    r3: round2(r3),
    s1: round2(s1),
    s2: round2(s2),
    s3: round2(s3),
    basisDate,
  };
}

export function computeTechnicalSummaryFromCandles(
  candles: CandlePoint[],
  livePrice: number
): TechnicalSummary | null {
  const clean = candles.filter(
    (c) =>
      Number.isFinite(c.close) &&
      c.close > 0 &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low)
  );
  if (clean.length < 25 || !Number.isFinite(livePrice) || livePrice <= 0) {
    return null;
  }

  const daily = computeTimeframeSummary(clean, livePrice);
  if (!daily) return null;

  const weeklyCandles = aggregateWeeklyCandles(clean);
  const weekly =
    weeklyCandles.length >= 22 ? computeTimeframeSummary(weeklyCandles, livePrice) : null;
  const pivots = computeClassicPivots(clean);

  return {
    ...daily,
    weekly,
    pivots,
    computedAt: new Date().toISOString(),
  };
}

const INDIAN_SECTOR_BASELINES: Array<{
  match: RegExp;
  pe: number;
  evEbitda: number;
  isFinancial?: boolean;
}> = [
  { match: /bank/i, pe: 16.5, evEbitda: 11.0, isFinancial: true },
  { match: /financ|nbfc|insur|capital market/i, pe: 24.5, evEbitda: 14.0, isFinancial: true },
  { match: /\bit\b|tech|software|services/i, pe: 23.0, evEbitda: 15.5 },
  { match: /energy|oil|gas|power|utilit|conglomerate/i, pe: 19.5, evEbitda: 12.8 },
  { match: /metal|mining|commodit|cement|material/i, pe: 15.5, evEbitda: 9.2 },
  { match: /auto|mobility/i, pe: 23.5, evEbitda: 14.5 },
  { match: /pharma|health|hospital/i, pe: 26.5, evEbitda: 17.5 },
  { match: /fmcg|consumer|retail|telecom/i, pe: 29.0, evEbitda: 20.5 },
  { match: /infra|capital goods|industrial|defence|engineering/i, pe: 24.5, evEbitda: 15.5 },
];

function getSectorBaseline(sector: string): {
  pe: number;
  evEbitda: number;
  isFinancial: boolean;
} {
  const sectorClean = (sector || '').trim();
  for (const rule of INDIAN_SECTOR_BASELINES) {
    if (rule.match.test(sectorClean)) {
      return {
        pe: rule.pe,
        evEbitda: rule.evEbitda,
        isFinancial: Boolean(rule.isFinancial),
      };
    }
  }

  const sectorLower = sectorClean.toLowerCase();
  const sectorPeers = INDIAN_STOCK_UNIVERSE.filter(
    (s) =>
      s.sector.toLowerCase() === sectorLower &&
      typeof s.peRatio === 'number' &&
      s.peRatio > 6 &&
      s.peRatio < 85
  )
    .map((s) => s.peRatio as number)
    .sort((a, b) => a - b);

  if (sectorPeers.length >= 2) {
    const mid = Math.floor(sectorPeers.length / 2);
    const med =
      sectorPeers.length % 2 === 1
        ? sectorPeers[mid]
        : (sectorPeers[mid - 1] + sectorPeers[mid]) / 2;
    return {
      pe: clamp(med, 14, 30),
      evEbitda: 14.0,
      isFinancial: /bank|financ|nbfc|insur/i.test(sectorLower),
    };
  }

  return { pe: 22.0, evEbitda: 14.0, isFinancial: false };
}

export function computeIntrinsicFairValue(params: {
  symbol: string;
  sector: string;
  livePrice: number;
  peRatio: number | null;
  roce: number | null;
  fundamentals: LiveFundamentalsSnapshot | null;
}): IntrinsicFairValue | null {
  const { symbol, sector, livePrice, peRatio, roce, fundamentals } = params;
  if (!symbol || symbol.startsWith('^') || !Number.isFinite(livePrice) || livePrice <= 0) {
    return null;
  }

  const trailingPE = fundamentals?.trailingPE ?? peRatio ?? null;
  const forwardPE = fundamentals?.forwardPE ?? null;
  const priceToBook = fundamentals?.priceToBook ?? null;
  const evToEbitda = fundamentals?.evToEbitda ?? null;
  const roe = fundamentals?.roePct ?? fundamentals?.roceProxyPct ?? roce ?? null;
  const revGrowth = fundamentals?.revenueGrowthPct ?? null;
  const earnGrowth = fundamentals?.earningsGrowthPct ?? null;
  const fcfMargin = fundamentals?.fcfMarginPct ?? null;
  const opMargin = fundamentals?.operatingMarginPct ?? null;

  const sectorInfo = getSectorBaseline(sector);
  const sectorMedianPE = round2(sectorInfo.pe);

  const validTrailingPE =
    trailingPE !== null && trailingPE > 3 && trailingPE < 220 ? trailingPE : null;
  const validForwardPE =
    forwardPE !== null && forwardPE > 3 && forwardPE < 220 ? forwardPE : null;

  const trailingEps = validTrailingPE !== null ? livePrice / validTrailingPE : null;
  const rawForwardEps = validForwardPE !== null ? livePrice / validForwardPE : null;
  // Cap forward EPS uplift at +28% / -20% vs trailing EPS to guard against noisy consensus outliers
  const cappedForwardEps =
    rawForwardEps !== null && trailingEps !== null
      ? clamp(rawForwardEps, trailingEps * 0.8, trailingEps * 1.28)
      : rawForwardEps;

  const anchorEps =
    trailingEps !== null && cappedForwardEps !== null
      ? trailingEps * 0.55 + cappedForwardEps * 0.45
      : cappedForwardEps ?? trailingEps;

  const growthInputs = [earnGrowth, revGrowth].filter(
    (g): g is number => typeof g === 'number' && Number.isFinite(g)
  );
  // Dampen single-year cyclical spikes toward sustainable multi-year compounding pace
  const rawBlendedGrowth =
    growthInputs.length > 0
      ? growthInputs.reduce((a, b) => a + b, 0) / growthInputs.length
      : roe !== null
      ? clamp(roe * 0.48, 4, 18)
      : 10;
  const sustainableGrowth = clamp(
    rawBlendedGrowth > 20 ? 20 + (rawBlendedGrowth - 20) * 0.35 : rawBlendedGrowth,
    -5,
    25
  );

  const rawModels: Array<{ name: string; value: number; rawWeight: number; basis: string }> = [];

  // Model 1: Sector Peer P/E Multiple (quality + growth adjusted)
  if (anchorEps !== null && anchorEps > 0) {
    const roeAdj = roe !== null ? clamp(1 + (roe - 16) * 0.006, 0.9, 1.15) : 1.0;
    const highGrowthFinBonus =
      sectorInfo.isFinancial && sustainableGrowth >= 18 ? clamp(1 + (sustainableGrowth - 16) * 0.015, 1.0, 1.16) : 1.0;
    const peerTargetPE = clamp(sectorMedianPE * roeAdj * highGrowthFinBonus, 10, 36);
    const val = clamp(anchorEps * peerTargetPE, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: 'Sector Peer P/E',
      value: round2(val),
      rawWeight: 0.38,
      basis: `${peerTargetPE.toFixed(1)}x adj. multiple (sector baseline ${sectorMedianPE.toFixed(1)}x)`,
    });
  }

  // Model 2: GARP Growth-Adjusted Multiple (sustainable earnings compounding)
  if (anchorEps !== null && anchorEps > 0) {
    const baseMultiple = sectorInfo.isFinancial ? 11.5 : 12.0;
    const growthSlope = sectorInfo.isFinancial ? 0.56 : 0.52;
    const qualityBonus =
      (roe !== null ? clamp((roe - 15) * 0.14, -2.0, 3.5) : 0) +
      (!sectorInfo.isFinancial && fcfMargin !== null
        ? fcfMargin >= 12
          ? 1.8
          : fcfMargin < 0
          ? -1.8
          : 0
        : 0);

    const garpPE = clamp(baseMultiple + sustainableGrowth * growthSlope + qualityBonus, 10, 36);
    const val = clamp(anchorEps * garpPE, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: 'GARP Growth Multiple',
      value: round2(val),
      rawWeight: 0.36,
      basis: `${garpPE.toFixed(1)}x fair P/E (${sustainableGrowth >= 0 ? '+' : ''}${sustainableGrowth.toFixed(1)}% sustainable pace)`,
    });
  }

  // Model 3: Sector-appropriate third anchor
  // - Non-financials with live EV/EBITDA (e.g., conglomerates, energy, industrials): EV/EBITDA Multiple
  // - Banks & NBFCs: 2-Stage Residual Income P/B calibrated to India CoE (10.8%) & compounding franchise
  // - Asset-light compounders without EV/EBITDA: Earnings Yield DCF proxy vs India 10Y G-Sec
  if (
    !sectorInfo.isFinancial &&
    evToEbitda !== null &&
    evToEbitda > 3 &&
    evToEbitda < 55
  ) {
    const growthAdj = clamp(1 + (sustainableGrowth - 12) * 0.012, 0.88, 1.18);
    const marginAdj =
      opMargin !== null ? clamp(1 + (opMargin - 14) * 0.004, 0.92, 1.12) : 1.0;
    const fairEvEbitda = clamp(sectorInfo.evEbitda * growthAdj * marginAdj, 6.5, 28);
    const ratio = clamp(fairEvEbitda / evToEbitda, 0.68, 1.5);
    const val = clamp(livePrice * ratio, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: 'EV/EBITDA Multiple',
      value: round2(val),
      rawWeight: 0.26,
      basis: `${fairEvEbitda.toFixed(1)}x fair EV/EBITDA vs live ${evToEbitda.toFixed(1)}x`,
    });
  } else if (
    sectorInfo.isFinancial &&
    priceToBook !== null &&
    priceToBook > 0.3 &&
    priceToBook < 12 &&
    roe !== null &&
    roe > 4
  ) {
    const bvps = livePrice / priceToBook;
    // 2-Stage Residual Income / Franchise P/B calibrated for India financials (CoE 10.8%)
    const costOfEquity = 10.8;
    const retainedG = clamp(sustainableGrowth * 0.36, 2.5, Math.min(8.6, roe * 0.5));
    const baseGordonPB = (roe - retainedG) / Math.max(2.2, costOfEquity - retainedG);
    const franchisePremium =
      sustainableGrowth >= 16 && roe >= 16
        ? clamp((sustainableGrowth - 15) * 0.08, 0, 0.8)
        : 0;
    const fairPB = clamp(baseGordonPB + franchisePremium, 0.95, 5.8);
    const val = clamp(bvps * fairPB, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: '2-Stage Franchise P/B',
      value: round2(val),
      rawWeight: 0.26,
      basis: `${fairPB.toFixed(2)}x fair P/B (ROE ${roe.toFixed(1)}% vs live ${priceToBook.toFixed(2)}x)`,
    });
  } else if (anchorEps !== null && anchorEps > 0) {
    const indiaRiskFree = 6.9;
    const marginQualityAdj =
      (opMargin !== null ? clamp((opMargin - 16) * 0.04, -0.6, 0.7) : 0) +
      (fcfMargin !== null ? clamp((fcfMargin - 8) * 0.05, -0.5, 0.6) : 0);
    const targetEarningsYieldPct = clamp(
      indiaRiskFree - sustainableGrowth * 0.14 - marginQualityAdj,
      3.5,
      8.5
    );
    const yieldFairPE = 100 / targetEarningsYieldPct;
    const val = clamp(anchorEps * yieldFairPE, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: 'Earnings Yield DCF',
      value: round2(val),
      rawWeight: 0.26,
      basis: `${targetEarningsYieldPct.toFixed(1)}% req. yield (${yieldFairPE.toFixed(1)}x vs 6.9% G-Sec)`,
    });
  }

  if (rawModels.length === 0) return null;

  const weightSum = rawModels.reduce((acc, m) => acc + m.rawWeight, 0);
  const models: ValuationModelPoint[] = rawModels.map((m) => ({
    name: m.name,
    value: m.value,
    weightPct: Math.round((m.rawWeight / weightSum) * 100),
    basis: m.basis,
  }));

  const fairValue = round2(
    rawModels.reduce((acc, m) => acc + m.value * (m.rawWeight / weightSum), 0)
  );
  const upsidePercent = round2(((fairValue - livePrice) / livePrice) * 100);

  const values = models.map((m) => m.value);
  const spreadPct =
    values.length >= 2
      ? ((Math.max(...values) - Math.min(...values)) / Math.max(1, fairValue)) * 100
      : 16;

  const uncertainty: 'Low' | 'Medium' | 'High' =
    models.length >= 3 && spreadPct <= 20
      ? 'Low'
      : models.length >= 2 && spreadPct <= 35
      ? 'Medium'
      : 'High';

  const bandPct = uncertainty === 'Low' ? 0.08 : uncertainty === 'Medium' ? 0.12 : 0.16;
  const lowEstimate = round2(Math.min(Math.min(...values), fairValue * (1 - bandPct)));
  const highEstimate = round2(Math.max(Math.max(...values), fairValue * (1 + bandPct)));

  const verdict: IntrinsicFairValue['verdict'] =
    upsidePercent >= 8 ? 'Undervalued' : upsidePercent <= -8 ? 'Overvalued' : 'Fairly Valued';

  return {
    fairValue,
    lowEstimate,
    highEstimate,
    upsidePercent,
    verdict,
    uncertainty,
    sectorMedianPE,
    models,
    basisNote: `Blends ${models.length} valuation ${models.length === 1 ? 'model' : 'models'} (${models.map((m) => m.name).join(' · ')}) vs live ₹${livePrice.toFixed(0)}.`,
  };
}
