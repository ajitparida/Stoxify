import type {
  AnalyzedMutualFund,
  MfFifoBreakdown,
  MfNavPoint,
  MfOptionType,
  MfPlanType,
  MfReportGrade,
  MfSearchResult,
  MfSwitchAction,
  MfSwitchSuggestion,
  MfTimingVerdict,
  MutualFundAnalysisResponse,
  MutualFundHoldingRecord,
  MutualFundImportParseResponse,
  MutualFundSummaryMetrics,
  ParsedMutualFundImportRow,
} from '../src/types/market.ts';
import {
  evaluateTieredExitLoadPct,
  resolveSchemeCostProfile,
} from './schemeMetadataCatalog.ts';

interface MfApiSearchEntry {
  schemeCode: number | string;
  schemeName: string;
}

interface MfApiNavRaw {
  date: string; // DD-MM-YYYY
  nav: string;
}

interface MfApiSchemeResponse {
  meta?: {
    fund_house?: string;
    scheme_type?: string;
    scheme_category?: string;
    scheme_code?: number | string;
    scheme_name?: string;
    isin_growth?: string | null;
  };
  data?: MfApiNavRaw[];
  status?: string;
}

export interface ParsedSchemeSeries {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  planType: MfPlanType;
  optionType: MfOptionType;
  points: Array<{ date: string; timestamp: number; nav: number }>;
}

interface BenchmarkSeries {
  symbol: string;
  name: string;
  points: Array<{ date: string; timestamp: number; close: number }>;
}

interface CategoryPeerEntry {
  schemeCode: string;
  label: string;
}

const MFAPI_BASE = 'https://api.mfapi.in';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const RISK_FREE_ANNUAL_RATE = 0.065; // India 10Y / T-Bill proxy 6.5%

const schemeCache = new Map<string, { expiresAt: number; data: ParsedSchemeSeries }>();
const searchCache = new Map<string, { expiresAt: number; data: MfSearchResult[] }>();
const benchmarkCache = new Map<string, { expiresAt: number; data: BenchmarkSeries }>();

const CATEGORY_PEERS: Record<string, CategoryPeerEntry[]> = {
  'Flexi Cap': [
    { schemeCode: '122639', label: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth' },
    { schemeCode: '118955', label: 'HDFC Flexi Cap Fund - Direct Plan - Growth Option' },
  ],
  'Large Cap': [
    { schemeCode: '120586', label: 'ICICI Prudential Large Cap Fund - Direct Plan - Growth' },
    { schemeCode: '120716', label: 'UTI Nifty 50 Index Fund - Direct Plan - Growth' },
  ],
  'Large & Mid Cap': [
    { schemeCode: '118834', label: 'Mirae Asset Large & Midcap Fund - Direct Plan - Growth' },
    { schemeCode: '130498', label: 'HDFC Large & Mid Cap Fund - Direct Plan - Growth Option' },
  ],
  'Mid Cap': [
    { schemeCode: '118989', label: 'HDFC Mid Cap Fund - Direct Plan - Growth Option' },
    { schemeCode: '147622', label: 'Motilal Oswal Nifty Midcap 150 Index Fund - Direct Plan - Growth' },
  ],
  'Small Cap': [
    { schemeCode: '118778', label: 'Nippon India Small Cap Fund - Direct Plan - Growth Option' },
    { schemeCode: '125497', label: 'SBI SMALL CAP FUND - Direct Plan - Growth' },
  ],
  ELSS: [
    { schemeCode: '135781', label: 'Mirae Asset ELSS Tax Saver Fund - Direct Plan - Growth' },
    { schemeCode: '120847', label: 'Quant ELSS Tax Saver Fund - Direct Plan - Growth Option' },
  ],
  'Index / ETF': [
    { schemeCode: '120716', label: 'UTI Nifty 50 Index Fund - Direct Plan - Growth' },
    { schemeCode: '147622', label: 'Motilal Oswal Nifty Midcap 150 Index Fund - Direct Plan - Growth' },
  ],
  'Debt / Corporate Bond': [
    { schemeCode: '118987', label: 'HDFC Corporate Bond Fund - Direct Plan - Growth Option' },
  ],
};

function detectPlanType(name: string): MfPlanType {
  if (/\bregular\b/i.test(name)) return 'Regular';
  if (/\bdirect\b/i.test(name)) return 'Direct';
  return 'Regular';
}

function detectOptionType(name: string): MfOptionType {
  if (/\b(idcw|dividend|payout|reinvest)\b/i.test(name)) return 'IDCW';
  return 'Growth';
}

export function normalizeCategoryLabel(rawCategory: string, schemeName: string): string {
  const text = `${rawCategory} ${schemeName}`.toLowerCase();
  if (text.includes('elss') || text.includes('tax saver')) return 'ELSS';
  if (text.includes('flexi cap') || text.includes('multi cap') || text.includes('focused')) {
    return 'Flexi Cap';
  }
  if (text.includes('large & mid') || text.includes('large and mid')) return 'Large & Mid Cap';
  if (text.includes('small cap')) return 'Small Cap';
  if (text.includes('mid cap') || text.includes('midcap')) return 'Mid Cap';
  if (text.includes('index') || text.includes('nifty 50') || text.includes('sensex')) {
    return 'Index / ETF';
  }
  if (text.includes('large cap') || text.includes('bluechip')) return 'Large Cap';
  if (
    text.includes('debt') ||
    text.includes('corporate bond') ||
    text.includes('short duration') ||
    text.includes('liquid') ||
    text.includes('gilt') ||
    text.includes('money market')
  ) {
    return 'Debt / Corporate Bond';
  }
  if (text.includes('hybrid') || text.includes('balanced') || text.includes('advantage')) {
    return 'Hybrid / Balanced';
  }
  return rawCategory.replace(/^Equity Scheme\s*-\s*/i, '').trim() || 'Flexi Cap';
}

function isDebtCategory(category: string): boolean {
  const c = category.toLowerCase();
  return (
    c.includes('debt') ||
    c.includes('bond') ||
    c.includes('liquid') ||
    c.includes('gilt') ||
    c.includes('money market')
  );
}

function parseDdMmYyyyToIso(raw: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export async function searchMutualFunds(query: string): Promise<MfSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = trimmed.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const res = await fetch(`${MFAPI_BASE}/mf/search?q=${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const rawList = (await res.json()) as MfApiSearchEntry[];
    const mapped: MfSearchResult[] = (Array.isArray(rawList) ? rawList : [])
      .filter((item) => item.schemeCode && item.schemeName)
      .map((item) => ({
        schemeCode: String(item.schemeCode),
        schemeName: item.schemeName.trim(),
        planType: detectPlanType(item.schemeName),
        optionType: detectOptionType(item.schemeName),
      }))
      .sort((a, b) => {
        if (a.optionType !== b.optionType) return a.optionType === 'Growth' ? -1 : 1;
        const aBonus = /\bbonus\b/i.test(a.schemeName) ? 1 : 0;
        const bBonus = /\bbonus\b/i.test(b.schemeName) ? 1 : 0;
        if (aBonus !== bBonus) return aBonus - bBonus;
        const aGrowth = /\bgrowth\b/i.test(a.schemeName) ? 1 : 0;
        const bGrowth = /\bgrowth\b/i.test(b.schemeName) ? 1 : 0;
        if (aGrowth !== bGrowth) return bGrowth - aGrowth;
        if (a.planType !== b.planType) return a.planType === 'Direct' ? -1 : 1;
        return a.schemeName.length - b.schemeName.length;
      })
      .slice(0, 25);

    searchCache.set(cacheKey, { expiresAt: Date.now() + 30 * 60 * 1000, data: mapped });
    return mapped;
  } catch {
    return [];
  }
}

export async function fetchMfSchemeSeries(schemeCode: string): Promise<ParsedSchemeSeries | null> {
  const cleanCode = schemeCode.replace(/[^0-9]/g, '');
  if (!cleanCode) return null;

  const cached = schemeCache.get(cleanCode);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${MFAPI_BASE}/mf/${cleanCode}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        return null;
      }
      const payload = (await res.json()) as MfApiSchemeResponse;
      const meta = payload.meta ?? {};
      const rawData = Array.isArray(payload.data) ? payload.data : [];
      if (rawData.length === 0) return null;

      const points: Array<{ date: string; timestamp: number; nav: number }> = [];
      for (const row of rawData) {
        const iso = parseDdMmYyyyToIso(row.date);
        const nav = Number(row.nav);
        if (!iso || !Number.isFinite(nav) || nav <= 0) continue;
        const ts = Date.parse(`${iso}T00:00:00Z`);
        if (!Number.isFinite(ts)) continue;
        points.push({ date: iso, timestamp: ts, nav: Number(nav.toFixed(4)) });
      }

      points.sort((a, b) => a.timestamp - b.timestamp);
      if (points.length === 0) return null;

      const schemeName = meta.scheme_name || `Scheme ${cleanCode}`;
      const series: ParsedSchemeSeries = {
        schemeCode: cleanCode,
        schemeName,
        fundHouse: meta.fund_house || 'Indian Mutual Fund',
        category: normalizeCategoryLabel(meta.scheme_category || '', schemeName),
        planType: detectPlanType(schemeName),
        optionType: detectOptionType(schemeName),
        points,
      };

      schemeCache.set(cleanCode, { expiresAt: Date.now() + 6 * 60 * 60 * 1000, data: series });
      return series;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }
  return null;
}

interface TriBenchmarkSpec {
  cacheKey: string;
  amfiSchemeCode: string;
  terAddBackPct: number;
  name: string;
}

function getCategoryBenchmarkSpec(category: string): TriBenchmarkSpec | null {
  if (isDebtCategory(category)) return null;
  if (category === 'Large Cap' || category === 'Index / ETF') {
    return {
      cacheKey: 'TRI_NIFTY50',
      amfiSchemeCode: '120716',
      terAddBackPct: 0.18,
      name: 'NIFTY 50 TRI',
    };
  }
  if (category === 'Mid Cap') {
    return {
      cacheKey: 'TRI_MIDCAP150',
      amfiSchemeCode: '147622',
      terAddBackPct: 0.3,
      name: 'NIFTY Midcap 150 TRI',
    };
  }
  if (category === 'Small Cap') {
    return {
      cacheKey: 'TRI_SMALLCAP250',
      amfiSchemeCode: '147623',
      terAddBackPct: 0.36,
      name: 'NIFTY Smallcap 250 TRI',
    };
  }
  return {
    cacheKey: 'TRI_NIFTY500',
    amfiSchemeCode: '147625',
    terAddBackPct: 0.33,
    name: category === 'Hybrid / Balanced' ? 'NIFTY 500 TRI (Equity Benchmark)' : 'NIFTY 500 TRI',
  };
}

async function fetchYahooNiftyTriFallback(): Promise<BenchmarkSeries> {
  const cached = benchmarkCache.get('TRI_YAHOO_NSEI');
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent('^NSEI')}?range=5y&interval=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Stoxify/1.0)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error('Yahoo benchmark unavailable');
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };

    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const rawPts: Array<{ date: string; timestamp: number; close: number }> = [];

    for (let i = 0; i < timestamps.length; i += 1) {
      const c = closes[i];
      if (typeof c !== 'number' || !Number.isFinite(c) || c <= 0) continue;
      const iso = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      rawPts.push({
        date: iso,
        timestamp: Date.parse(`${iso}T00:00:00Z`),
        close: c,
      });
    }

    const startTs = rawPts[0]?.timestamp ?? Date.now();
    const points = rawPts.map((pt) => {
      const years = Math.max(0, (pt.timestamp - startTs) / (365.25 * 86400 * 1000));
      const triAdjusted = pt.close * Math.pow(1.0135, years);
      return {
        date: pt.date,
        timestamp: pt.timestamp,
        close: Number(triAdjusted.toFixed(2)),
      };
    });

    const out: BenchmarkSeries = {
      symbol: '^NSEI_TRI',
      name: 'NIFTY 50 TRI (Div. Adjusted)',
      points,
    };
    benchmarkCache.set('TRI_YAHOO_NSEI', { expiresAt: Date.now() + 3 * 60 * 60 * 1000, data: out });
    return out;
  } catch {
    return { symbol: '^NSEI_TRI', name: 'NIFTY 50 TRI (Unavailable)', points: [] };
  }
}

async function fetchBenchmarkSeries(category: string): Promise<BenchmarkSeries> {
  const spec = getCategoryBenchmarkSpec(category);
  if (!spec) {
    return {
      symbol: 'BOND_68',
      name: 'CRISIL Short Term / 6.8% TRI Proxy',
      points: [],
    };
  }

  const cached = benchmarkCache.get(spec.cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, name: spec.name };
  }

  const indexSeries = await fetchMfSchemeSeries(spec.amfiSchemeCode);
  if (indexSeries && indexSeries.points.length >= 60) {
    const startTs = indexSeries.points[0].timestamp;
    const annualAddBack = spec.terAddBackPct / 100;
    const points = indexSeries.points.map((pt) => {
      const years = Math.max(0, (pt.timestamp - startTs) / (365.25 * 86400 * 1000));
      const grossTriVal = pt.nav * Math.pow(1 + annualAddBack, years);
      return {
        date: pt.date,
        timestamp: pt.timestamp,
        close: Number(grossTriVal.toFixed(4)),
      };
    });

    const out: BenchmarkSeries = {
      symbol: spec.cacheKey,
      name: spec.name,
      points,
    };
    benchmarkCache.set(spec.cacheKey, {
      expiresAt: Date.now() + 6 * 60 * 60 * 1000,
      data: out,
    });
    return out;
  }

  return fetchYahooNiftyTriFallback();
}

function findPointAtOrBefore(
  points: Array<{ timestamp: number; nav?: number; close?: number }>,
  targetTs: number
): number | null {
  if (points.length === 0) return null;
  let lo = 0;
  let hi = points.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].timestamp <= targetTs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best < 0) return null;
  // Reject if nearest older observation is > 25 days away from target horizon
  if (targetTs - points[best].timestamp > 25 * 86400 * 1000) return null;
  const pt = points[best];
  return pt.nav ?? pt.close ?? null;
}

function computeCagr(
  points: Array<{ timestamp: number; nav?: number; close?: number }>,
  years: number
): number | null {
  if (points.length < 30) return null;
  const last = points[points.length - 1];
  const latestVal = last.nav ?? last.close ?? 0;
  if (latestVal <= 0) return null;
  const targetTs = last.timestamp - years * 365.25 * 86400 * 1000;
  const pastVal = findPointAtOrBefore(points, targetTs);
  if (!pastVal || pastVal <= 0) return null;
  const cagr = (Math.pow(latestVal / pastVal, 1 / years) - 1) * 100;
  return Number(cagr.toFixed(2));
}

function computeRiskMetrics(
  fundPoints: Array<{ date: string; timestamp: number; nav: number }>,
  benchmarkPoints: Array<{ date: string; timestamp: number; close: number }>,
  isDebt: boolean
): {
  alpha3Y: number | null;
  beta: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  downsideCapture: number | null;
  rollingBeatRate: number | null;
  benchReturn1Y: number | null;
  benchReturn3Y: number | null;
  benchReturn5Y: number | null;
} {
  if (fundPoints.length < 60) {
    return {
      alpha3Y: null,
      beta: null,
      sharpeRatio: null,
      maxDrawdown: null,
      downsideCapture: null,
      rollingBeatRate: null,
      benchReturn1Y: null,
      benchReturn3Y: null,
      benchReturn5Y: null,
    };
  }

  const latestTs = fundPoints[fundPoints.length - 1].timestamp;
  const threeYearsAgo = latestTs - 3 * 365.25 * 86400 * 1000;
  const windowPoints = fundPoints.filter((p) => p.timestamp >= threeYearsAgo);
  const series = windowPoints.length >= 60 ? windowPoints : fundPoints;

  // Daily simple returns + Max Drawdown
  const dailyReturns: number[] = [];
  let peak = series[0].nav;
  let maxDd = 0;
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1].nav;
    const curr = series[i].nav;
    if (curr > peak) peak = curr;
    const dd = ((curr - peak) / peak) * 100;
    if (dd < maxDd) maxDd = dd;
    if (prev > 0) dailyReturns.push((curr - prev) / prev);
  }

  const meanDaily =
    dailyReturns.length > 0
      ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
      : 0;
  const varianceDaily =
    dailyReturns.length > 1
      ? dailyReturns.reduce((s, r) => s + (r - meanDaily) ** 2, 0) / (dailyReturns.length - 1)
      : 0;
  const annVol = Math.sqrt(varianceDaily) * Math.sqrt(252);
  const annReturn = meanDaily * 252;
  const sharpeRatio =
    annVol > 0.005 ? Number(((annReturn - RISK_FREE_ANNUAL_RATE) / annVol).toFixed(2)) : null;
  const maxDrawdown = Number(maxDd.toFixed(2));

  // If Debt fund, benchmark against 6.8% stable fixed income baseline
  if (isDebt || benchmarkPoints.length < 60) {
    const r3 = computeCagr(fundPoints, 3);
    const r1 = computeCagr(fundPoints, 1);
    const alpha = r3 !== null ? Number((r3 - 6.8).toFixed(2)) : null;
    return {
      alpha3Y: alpha,
      beta: isDebt ? 0.12 : null,
      sharpeRatio,
      maxDrawdown,
      downsideCapture: isDebt ? 18 : null,
      rollingBeatRate: r1 !== null ? (r1 >= 6.8 ? 78 : 42) : null,
      benchReturn1Y: isDebt ? 6.8 : null,
      benchReturn3Y: isDebt ? 6.8 : null,
      benchReturn5Y: isDebt ? 6.8 : null,
    };
  }

  const benchReturn1Y = computeCagr(benchmarkPoints, 1);
  const benchReturn3Y = computeCagr(benchmarkPoints, 3);
  const benchReturn5Y = computeCagr(benchmarkPoints, 5);

  // Build monthly snapshots over past 3Y for Beta, Downside Capture, and 1Y Rolling Beat Rate
  const benchMap = new Map<string, number>();
  for (const b of benchmarkPoints) {
    benchMap.set(b.date.slice(0, 7), b.close);
  }
  const fundMonthMap = new Map<string, number>();
  for (const f of fundPoints) {
    fundMonthMap.set(f.date.slice(0, 7), f.nav);
  }

  const commonMonths = Array.from(fundMonthMap.keys())
    .filter((ym) => benchMap.has(ym))
    .sort();

  // Monthly returns over last 36 months
  const recentMonths = commonMonths.slice(-37);
  const fundMonthly: number[] = [];
  const benchMonthly: number[] = [];
  for (let i = 1; i < recentMonths.length; i += 1) {
    const fPrev = fundMonthMap.get(recentMonths[i - 1])!;
    const fCurr = fundMonthMap.get(recentMonths[i])!;
    const bPrev = benchMap.get(recentMonths[i - 1])!;
    const bCurr = benchMap.get(recentMonths[i])!;
    if (fPrev > 0 && bPrev > 0) {
      fundMonthly.push((fCurr - fPrev) / fPrev);
      benchMonthly.push((bCurr - bPrev) / bPrev);
    }
  }

  let beta: number | null = null;
  let downsideCapture: number | null = null;
  if (fundMonthly.length >= 12) {
    const meanF = fundMonthly.reduce((a, b) => a + b, 0) / fundMonthly.length;
    const meanB = benchMonthly.reduce((a, b) => a + b, 0) / benchMonthly.length;
    let cov = 0;
    let varB = 0;
    for (let i = 0; i < fundMonthly.length; i += 1) {
      cov += (fundMonthly[i] - meanF) * (benchMonthly[i] - meanB);
      varB += (benchMonthly[i] - meanB) ** 2;
    }
    beta = varB > 0 ? Number(Math.max(0.2, Math.min(1.8, cov / varB)).toFixed(2)) : 1.0;

    let downFundSum = 0;
    let downBenchSum = 0;
    let downCount = 0;
    for (let i = 0; i < benchMonthly.length; i += 1) {
      if (benchMonthly[i] < 0) {
        downFundSum += fundMonthly[i];
        downBenchSum += benchMonthly[i];
        downCount += 1;
      }
    }
    if (downCount >= 3 && downBenchSum < 0) {
      downsideCapture = Number(((downFundSum / downBenchSum) * 100).toFixed(1));
    }
  }

  // Rolling 12M beat rate over last 36 months
  let beatWins = 0;
  let beatTotal = 0;
  for (let i = 12; i < recentMonths.length; i += 1) {
    const fStart = fundMonthMap.get(recentMonths[i - 12])!;
    const fEnd = fundMonthMap.get(recentMonths[i])!;
    const bStart = benchMap.get(recentMonths[i - 12])!;
    const bEnd = benchMap.get(recentMonths[i])!;
    if (fStart > 0 && bStart > 0) {
      const f1y = fEnd / fStart - 1;
      const b1y = bEnd / bStart - 1;
      if (f1y >= b1y) beatWins += 1;
      beatTotal += 1;
    }
  }
  const rollingBeatRate = beatTotal >= 4 ? Math.round((beatWins / beatTotal) * 100) : null;

  const fund3Y = computeCagr(fundPoints, 3);
  let alpha3Y: number | null = null;
  if (fund3Y !== null && benchReturn3Y !== null) {
    const effectiveBeta = beta ?? 1;
    const expected = RISK_FREE_ANNUAL_RATE * 100 + effectiveBeta * (benchReturn3Y - RISK_FREE_ANNUAL_RATE * 100);
    alpha3Y = Number((fund3Y - expected).toFixed(2));
  }

  return {
    alpha3Y,
    beta,
    sharpeRatio,
    maxDrawdown,
    downsideCapture,
    rollingBeatRate,
    benchReturn1Y,
    benchReturn3Y,
    benchReturn5Y,
  };
}

function computeReportCardScores(params: {
  alpha3Y: number | null;
  sharpeRatio: number | null;
  downsideCapture: number | null;
  rollingBeatRate: number | null;
  return1Y: number | null;
  benchmarkReturn1Y: number | null;
  planType: MfPlanType;
  isDebt: boolean;
}): {
  consistencyScore: number;
  downsideProtectionScore: number;
  grade: MfReportGrade;
} {
  let consistency = 58;
  if (params.rollingBeatRate !== null) {
    consistency = Math.round(params.rollingBeatRate * 0.65 + (params.alpha3Y !== null ? Math.max(0, Math.min(35, 18 + params.alpha3Y * 2.5)) : 18));
  } else if (params.return1Y !== null && params.benchmarkReturn1Y !== null) {
    consistency = Math.round(55 + (params.return1Y - params.benchmarkReturn1Y) * 2.5);
  }
  consistency = Math.max(18, Math.min(98, consistency));

  let downside = 64;
  if (params.downsideCapture !== null) {
    // Lower downside capture = stronger downside protection
    downside = Math.round(135 - params.downsideCapture * 0.72);
  } else if (params.sharpeRatio !== null) {
    downside = Math.round(50 + params.sharpeRatio * 22);
  }
  downside = Math.max(20, Math.min(97, downside));

  let composite = consistency * 0.55 + downside * 0.45;
  if (params.sharpeRatio !== null && params.sharpeRatio >= 1.1) composite += 6;
  if (params.alpha3Y !== null && params.alpha3Y < -2.5) composite -= 10;
  if (params.planType === 'Regular') composite -= 5;
  if (params.isDebt && params.alpha3Y !== null && params.alpha3Y >= 0) composite = Math.max(composite, 78);

  let grade: MfReportGrade = 'B';
  if (composite >= 82) grade = 'A+';
  else if (composite >= 70) grade = 'A';
  else if (composite >= 56) grade = 'B';
  else if (composite >= 42) grade = 'C';
  else grade = 'D';

  return {
    consistencyScore: consistency,
    downsideProtectionScore: downside,
    grade,
  };
}

function buildNavChartSeries(
  fundPoints: Array<{ date: string; timestamp: number; nav: number }>,
  benchPoints: Array<{ date: string; timestamp: number; close: number }>
): MfNavPoint[] {
  if (fundPoints.length === 0) return [];
  const latestTs = fundPoints[fundPoints.length - 1].timestamp;
  const fiveYearsAgo = latestTs - 5 * 365.25 * 86400 * 1000;
  const filtered = fundPoints.filter((p) => p.timestamp >= fiveYearsAgo);

  // Sample down to <= 90 points for fast crisp Recharts rendering
  const step = Math.max(1, Math.floor(filtered.length / 85));
  const sampled: Array<{ date: string; timestamp: number; nav: number }> = [];
  for (let i = 0; i < filtered.length; i += step) {
    sampled.push(filtered[i]);
  }
  const last = filtered[filtered.length - 1];
  if (sampled[sampled.length - 1]?.date !== last.date) {
    sampled.push(last);
  }

  const baseFund = sampled[0].nav;
  const baseBench = findPointAtOrBefore(benchPoints, sampled[0].timestamp);

  return sampled.map((pt) => {
    const benchVal = baseBench ? findPointAtOrBefore(benchPoints, pt.timestamp) : null;
    return {
      date: pt.date,
      nav: Number(pt.nav.toFixed(2)),
      indexedFund: baseFund > 0 ? Number(((pt.nav / baseFund) * 100).toFixed(2)) : undefined,
      indexedBenchmark:
        baseBench && benchVal && baseBench > 0
          ? Number(((benchVal / baseBench) * 100).toFixed(2))
          : undefined,
    };
  });
}

async function findDirectTwinScheme(series: ParsedSchemeSeries): Promise<ParsedSchemeSeries | null> {
  if (series.planType === 'Direct') return null;

  const cleanedStem = series.schemeName
    .replace(/\bregular\b/gi, '')
    .replace(/\bplan\b/gi, '')
    .replace(/\bgrowth\b/gi, '')
    .replace(/\boption\b/gi, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const queries = [
    `${cleanedStem} Direct Growth`,
    cleanedStem.split(' ').slice(0, 4).join(' '),
  ];

  for (const q of queries) {
    const matches = await searchMutualFunds(q);
    const directMatch = matches.find(
      (m) =>
        m.planType === 'Direct' &&
        m.optionType === 'Growth' &&
        m.schemeCode !== series.schemeCode &&
        m.schemeName.toLowerCase().includes(cleanedStem.split(' ')[0].toLowerCase())
    );
    if (directMatch) {
      const directSeries = await fetchMfSchemeSeries(directMatch.schemeCode);
      if (directSeries) return directSeries;
    }
  }
  return null;
}

function estimatePortfolioXirr(
  funds: Array<{ investedValue: number; currentValue: number; purchaseDate: string }>
): number | null {
  const totalInv = funds.reduce((s, f) => s + f.investedValue, 0);
  const totalCur = funds.reduce((s, f) => s + f.currentValue, 0);
  if (totalInv <= 0 || totalCur <= 0) return null;

  const now = Date.now();
  let weightedDays = 0;
  for (const f of funds) {
    const ts = Date.parse(f.purchaseDate || '');
    const days = Number.isFinite(ts) ? Math.max(45, (now - ts) / 86400000) : 365;
    weightedDays += days * f.investedValue;
  }
  const avgYears = Math.max(0.25, weightedDays / totalInv / 365.25);
  const xirr = (Math.pow(totalCur / totalInv, 1 / avgYears) - 1) * 100;
  return Number(Math.max(-95, Math.min(250, xirr)).toFixed(2));
}

interface FifoLot {
  date: string;
  units: number;
  costBasis: number;
  currentVal: number;
  holdingDays: number;
}

function buildFifoLots(
  holding: MutualFundHoldingRecord,
  schemePoints: Array<{ date: string; timestamp: number; nav: number }>,
  latestNav: number
): { lots: FifoLot[]; isSipReconstructed: boolean } {
  const nowMs = Date.now();
  const parsedStart = Date.parse(holding.purchaseDate || '');
  const fallbackStart = new Date(nowMs - 400 * 86400000);
  const startDate = Number.isFinite(parsedStart) ? new Date(parsedStart) : fallbackStart;

  const isSipActive = Boolean(holding.isSip && (holding.monthlySipAmount ?? 0) > 0);
  const totalCost = holding.units * holding.avgNav;

  if (!isSipActive) {
    const holdingDays = Math.max(1, Math.floor((nowMs - startDate.getTime()) / 86400000));
    const dateStr = startDate.toISOString().slice(0, 10);
    return {
      isSipReconstructed: false,
      lots: [
        {
          date: dateStr,
          units: holding.units,
          costBasis: totalCost,
          currentVal: holding.units * latestNav,
          holdingDays,
        },
      ],
    };
  }

  // Reconstruct monthly SIP installments in FIFO order from purchaseDate up to today (capped at 120 months)
  const monthlyDates: Date[] = [];
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const todayCutoff = new Date(nowMs);
  while (cursor <= todayCutoff && monthlyDates.length < 120) {
    monthlyDates.push(new Date(cursor.getTime()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  if (monthlyDates.length <= 1) {
    const holdingDays = Math.max(1, Math.floor((nowMs - startDate.getTime()) / 86400000));
    return {
      isSipReconstructed: false,
      lots: [
        {
          date: startDate.toISOString().slice(0, 10),
          units: holding.units,
          costBasis: totalCost,
          currentVal: holding.units * latestNav,
          holdingDays,
        },
      ],
    };
  }

  const sipAmt = Number(holding.monthlySipAmount) || 5000;
  const rawLots = monthlyDates.map((d) => {
    const ts = d.getTime();
    const navAtLot = findPointAtOrBefore(schemePoints, ts) || holding.avgNav || latestNav;
    const rawUnits = navAtLot > 0 ? sipAmt / navAtLot : 0;
    return {
      date: d.toISOString().slice(0, 10),
      holdingDays: Math.max(1, Math.floor((nowMs - ts) / 86400000)),
      rawUnits,
    };
  });

  const sumRawUnits = rawLots.reduce((s, l) => s + l.rawUnits, 0);
  const scaleFactor = sumRawUnits > 0 ? holding.units / sumRawUnits : 1;

  const lots: FifoLot[] = rawLots.map((l) => {
    const scaledUnits = Number((l.rawUnits * scaleFactor).toFixed(4));
    const unitShare = holding.units > 0 ? scaledUnits / holding.units : 1 / rawLots.length;
    return {
      date: l.date,
      units: scaledUnits,
      costBasis: totalCost * unitShare,
      currentVal: scaledUnits * latestNav,
      holdingDays: l.holdingDays,
    };
  });

  return { lots, isSipReconstructed: true };
}

export async function analyzeMutualFundPortfolio(params: {
  holdings: MutualFundHoldingRecord[];
  taxSlabPct?: number;
  ltcgExemptionRemaining?: number;
}): Promise<MutualFundAnalysisResponse> {
  const { holdings, taxSlabPct = 30, ltcgExemptionRemaining = 125000 } = params;
  if (holdings.length === 0) {
    return {
      funds: [],
      summary: {
        totalInvested: 0,
        totalCurrent: 0,
        totalGain: 0,
        totalGainPercent: 0,
        estXirr: null,
        totalAnnualFeeDrag: 0,
        regularCommissionLeak: 0,
        tenYearCommissionLeak: 0,
        switchCount: 0,
        regularPlanCount: 0,
        underperformerCount: 0,
      },
      analyzedAt: new Date().toISOString(),
    };
  }

  // Preload scheme series in parallel
  const schemeResults = await Promise.all(
    holdings.map(async (h) => ({
      holding: h,
      series: await fetchMfSchemeSeries(h.schemeCode),
    }))
  );

  // Preload category-matched TRI benchmarks in parallel
  const uniqueCategories = Array.from(
    new Set(schemeResults.map((r) => r.series?.category || r.holding.category || 'Flexi Cap'))
  );
  const benchmarkEntries = await Promise.all(
    uniqueCategories.map(async (cat) => [cat, await fetchBenchmarkSeries(cat)] as const)
  );
  const benchmarkByCategory = new Map<string, BenchmarkSeries>(benchmarkEntries);

  // Track LTCG exemption across FIFO lots and funds deterministically
  let remainingLtcgPool = Math.max(0, ltcgExemptionRemaining);

  const analyzedFunds: AnalyzedMutualFund[] = [];

  for (const { holding, series } of schemeResults) {
    const points = series?.points ?? [];
    const latestNav = points.length > 0 ? points[points.length - 1].nav : holding.avgNav;
    const previousNav = points.length > 1 ? points[points.length - 2].nav : latestNav;
    const navDate =
      points.length > 0 ? points[points.length - 1].date : new Date().toISOString().slice(0, 10);
    const dayChangePercent =
      previousNav > 0 ? Number((((latestNav - previousNav) / previousNav) * 100).toFixed(2)) : 0;

    const category = series?.category || holding.category || 'Flexi Cap';
    const planType = series?.planType || holding.planType;
    const isDebt = isDebtCategory(category);
    const benchmark =
      benchmarkByCategory.get(category) ??
      (isDebt
        ? { symbol: 'BOND_68', name: 'CRISIL Short Term / 6.8% TRI Proxy', points: [] }
        : await fetchBenchmarkSeries('Flexi Cap'));

    const costProfile = resolveSchemeCostProfile({
      schemeCode: holding.schemeCode,
      schemeName: series?.schemeName || holding.schemeName,
      category,
      planType,
    });

    const investedValue = Number((holding.units * holding.avgNav).toFixed(2));
    const currentValue = Number((holding.units * latestNav).toFixed(2));
    const unrealizedGain = Number((currentValue - investedValue).toFixed(2));
    const unrealizedGainPercent =
      investedValue > 0 ? Number(((unrealizedGain / investedValue) * 100).toFixed(2)) : 0;

    const estExpenseRatio = costProfile.terPct;
    const annualFeeDrag = Number(((currentValue * estExpenseRatio) / 100).toFixed(2));

    const return1Y = computeCagr(points, 1);
    const return3Y = computeCagr(points, 3);
    const return5Y = computeCagr(points, 5);
    const risk = computeRiskMetrics(points, benchmark.points, isDebt);

    const score = computeReportCardScores({
      alpha3Y: risk.alpha3Y,
      sharpeRatio: risk.sharpeRatio,
      downsideCapture: risk.downsideCapture,
      rollingBeatRate: risk.rollingBeatRate,
      return1Y,
      benchmarkReturn1Y: risk.benchReturn1Y,
      planType,
      isDebt,
    });

    // Determine Switch Suggestion (Direct Twin vs Category Peer vs Hold)
    let action: MfSwitchAction = 'HOLD';
    let targetSeries: ParsedSchemeSeries | null = null;
    let targetReturn1Y: number | null = null;
    let targetReturn3Y: number | null = null;
    let targetExpenseRatio: number | null = null;
    let targetGrade: MfReportGrade | null = null;

    const directTwin = planType === 'Regular' && series ? await findDirectTwinScheme(series) : null;

    const peerList = CATEGORY_PEERS[category] || CATEGORY_PEERS['Flexi Cap'];
    const bestPeerCandidate = peerList.find((p) => p.schemeCode !== holding.schemeCode);
    const peerSeries = bestPeerCandidate ? await fetchMfSchemeSeries(bestPeerCandidate.schemeCode) : null;

    const peer3Y = peerSeries ? computeCagr(peerSeries.points, 3) : null;
    const peer1Y = peerSeries ? computeCagr(peerSeries.points, 1) : null;

    const isLagging =
      (return3Y !== null &&
        risk.benchReturn3Y !== null &&
        !isDebt &&
        return3Y < risk.benchReturn3Y - 1.75) ||
      (return3Y !== null && peer3Y !== null && peer3Y - return3Y >= 2.2) ||
      score.grade === 'C' ||
      score.grade === 'D';

    if (isLagging && peerSeries) {
      action = 'SWITCH_PEER';
      targetSeries = peerSeries;
      targetReturn1Y = peer1Y;
      targetReturn3Y = peer3Y;
      targetExpenseRatio = resolveSchemeCostProfile({
        schemeCode: peerSeries.schemeCode,
        schemeName: peerSeries.schemeName,
        category: peerSeries.category,
        planType: 'Direct',
      }).terPct;
      targetGrade = 'A+';
    } else if (planType === 'Regular') {
      action = 'SWITCH_TO_DIRECT';
      if (directTwin) {
        targetSeries = directTwin;
        targetReturn1Y = computeCagr(directTwin.points, 1);
        targetReturn3Y = computeCagr(directTwin.points, 3);
        targetExpenseRatio = resolveSchemeCostProfile({
          schemeCode: directTwin.schemeCode,
          schemeName: directTwin.schemeName,
          category: directTwin.category,
          planType: 'Direct',
        }).terPct;
        targetGrade = score.grade === 'B' ? 'A' : 'A+';
      } else {
        targetExpenseRatio = resolveSchemeCostProfile({
          schemeCode: holding.schemeCode,
          schemeName: series?.schemeName || holding.schemeName,
          category,
          planType: 'Direct',
        }).terPct;
        targetReturn1Y =
          return1Y !== null ? Number((return1Y + (estExpenseRatio - targetExpenseRatio)).toFixed(2)) : null;
        targetReturn3Y =
          return3Y !== null ? Number((return3Y + (estExpenseRatio - targetExpenseRatio)).toFixed(2)) : null;
        targetGrade = score.grade === 'B' ? 'A' : 'A+';
      }
    }

    // Multi-lot SIP FIFO Exit Load & Capital Gains Tax evaluation
    const { lots, isSipReconstructed } = buildFifoLots(holding, points, latestNav);
    const oldestHoldingDays = lots[0]?.holdingDays ?? 400;
    const newestHoldingDays = lots[lots.length - 1]?.holdingDays ?? oldestHoldingDays;

    let totalExitLoad = 0;
    let totalTax = 0;
    let exitLoadFreeUnits = 0;
    let exitLoadFreeValue = 0;
    let ltcgEligibleUnits = 0;
    let ltcgEligibleValue = 0;
    let stcgUnits = 0;
    let stcgValue = 0;
    let exitLoadTaxedUnits = 0;
    let exitLoadTaxedValue = 0;

    for (const lot of lots) {
      const lotExitLoadPct = evaluateTieredExitLoadPct(costProfile.exitLoadTiers, lot.holdingDays);
      const isElssLocked = costProfile.isElssLockIn && lot.holdingDays < 1095;
      const lotHasExitRestriction = lotExitLoadPct > 0 || isElssLocked;

      if (lotHasExitRestriction) {
        exitLoadTaxedUnits += lot.units;
        exitLoadTaxedValue += lot.currentVal;
      } else {
        exitLoadFreeUnits += lot.units;
        exitLoadFreeValue += lot.currentVal;
      }

      if (action !== 'HOLD') {
        totalExitLoad += (lot.currentVal * lotExitLoadPct) / 100;
      }

      const lotGain = lot.currentVal - lot.costBasis;
      if (isDebt) {
        if (lotGain > 0 && action !== 'HOLD') {
          totalTax += (lotGain * taxSlabPct) / 100;
        }
        stcgUnits += lot.units;
        stcgValue += lot.currentVal;
      } else if (lot.holdingDays > 365) {
        ltcgEligibleUnits += lot.units;
        ltcgEligibleValue += lot.currentVal;
        if (lotGain > 0 && action !== 'HOLD') {
          const taxableGain = Math.max(0, lotGain - remainingLtcgPool);
          remainingLtcgPool = Math.max(0, remainingLtcgPool - lotGain);
          totalTax += taxableGain * 0.125;
        }
      } else {
        stcgUnits += lot.units;
        stcgValue += lot.currentVal;
        if (lotGain > 0 && action !== 'HOLD') {
          totalTax += lotGain * 0.2;
        }
      }
    }

    const estimatedExitLoad = Number(totalExitLoad.toFixed(2));
    const estimatedTax = Number(totalTax.toFixed(2));
    const effectiveExitLoadPct =
      currentValue > 0 && estimatedExitLoad > 0
        ? Number(((estimatedExitLoad / currentValue) * 100).toFixed(2))
        : 0;

    const exitLoadWindowDays = costProfile.exitLoadWindowDays;
    const daysUntilExitLoadFree =
      exitLoadWindowDays > 0 ? Math.max(0, exitLoadWindowDays - newestHoldingDays) : 0;

    let taxType: 'STCG' | 'LTCG' | 'SLAB' | 'NO_GAIN' = 'NO_GAIN';
    if (action !== 'HOLD' && unrealizedGain > 0) {
      if (isDebt) taxType = 'SLAB';
      else if (ltcgEligibleUnits > 0 && stcgUnits > 0) taxType = 'STCG';
      else if (ltcgEligibleUnits > 0) taxType = 'LTCG';
      else taxType = 'STCG';
    }

    const fifoBreakdown: MfFifoBreakdown = {
      lotCount: lots.length,
      isSipReconstructed,
      exitLoadFreeUnits: Number(exitLoadFreeUnits.toFixed(2)),
      exitLoadFreeValue: Number(exitLoadFreeValue.toFixed(0)),
      ltcgEligibleUnits: Number(ltcgEligibleUnits.toFixed(2)),
      ltcgEligibleValue: Number(ltcgEligibleValue.toFixed(0)),
      stcgUnits: Number(stcgUnits.toFixed(2)),
      stcgValue: Number(stcgValue.toFixed(0)),
      exitLoadTaxedUnits: Number(exitLoadTaxedUnits.toFixed(2)),
      exitLoadTaxedValue: Number(exitLoadTaxedValue.toFixed(0)),
      oldestLotDate: lots[0]?.date || holding.purchaseDate,
      newestLotDate: lots[lots.length - 1]?.date || holding.purchaseDate,
    };

    const effectiveTargetTer = targetExpenseRatio ?? estExpenseRatio;
    const terSavedPct = Math.max(0, estExpenseRatio - effectiveTargetTer);
    const annualCommissionSaved =
      action === 'HOLD' ? 0 : Number(((currentValue * terSavedPct) / 100).toFixed(2));

    const rawPerformanceGap =
      action === 'SWITCH_PEER' && targetReturn3Y !== null && return3Y !== null
        ? Math.max(0, Math.min(4.0, (targetReturn3Y - return3Y) * 0.6))
        : 0;
    const totalAnnualBenefitPct = terSavedPct + rawPerformanceGap;
    const annualBenefitRupees = (currentValue * totalAnnualBenefitPct) / 100;

    const baseCompounded = currentValue * Math.pow(1.12, 10);
    const targetCompounded = currentValue * Math.pow(1.12 + totalAnnualBenefitPct / 100, 10);
    const tenYearProjectedExtraWealth =
      action === 'HOLD' ? 0 : Number(Math.max(0, targetCompounded - baseCompounded).toFixed(0));

    const totalFriction = estimatedExitLoad + estimatedTax;
    const netFirstYearBenefit = Number((annualBenefitRupees - totalFriction).toFixed(2));
    const breakEvenMonths =
      annualBenefitRupees > 0 && totalFriction > 0
        ? Math.min(120, Math.ceil((totalFriction / annualBenefitRupees) * 12))
        : totalFriction === 0 && action !== 'HOLD'
        ? 1
        : null;

    let timingVerdict: MfTimingVerdict = 'HOLD_STEADY';
    if (action !== 'HOLD') {
      if (costProfile.isElssLockIn && exitLoadFreeValue < currentValue * 0.1) {
        timingVerdict = 'WAIT_EXIT_LOAD';
      } else if (
        exitLoadTaxedValue > currentValue * 0.65 &&
        daysUntilExitLoadFree > 0 &&
        daysUntilExitLoadFree <= 180
      ) {
        timingVerdict = 'WAIT_EXIT_LOAD';
      } else if (stcgValue > ltcgEligibleValue && !isDebt && action === 'SWITCH_TO_DIRECT') {
        timingVerdict = 'STAGGER_FOR_LTCG';
      } else {
        timingVerdict = 'SWITCH_NOW';
      }
    }

    const fifoLotNote =
      isSipReconstructed && lots.length > 1
        ? ` FIFO (${lots.length} monthly SIP lots): ${formatSimpleInr(exitLoadFreeValue)} is 0% exit-load eligible now${
            exitLoadTaxedValue > 0 ? ` and ${formatSimpleInr(exitLoadTaxedValue)} remains within exit-load/lock-in window` : ''
          }.`
        : '';

    let rationale = `Outperforming ${benchmark.name} with strong risk-adjusted consistency.`;
    if (action === 'SWITCH_TO_DIRECT') {
      rationale = `Regular plan TER (${estExpenseRatio.toFixed(2)}%, ${costProfile.terSource}) vs Direct Growth (${effectiveTargetTer.toFixed(2)}%) drains ${formatSimpleInr(annualCommissionSaved)}/yr.${fifoLotNote}${
        timingVerdict === 'WAIT_EXIT_LOAD'
          ? ` Wait for ${costProfile.exitLoadRuleLabel} expiry (pause Regular SIP now and start Direct SIP immediately).`
          : timingVerdict === 'STAGGER_FOR_LTCG'
          ? ` Switch the LTCG-eligible portion now and stagger remaining STCG lots as they cross 365 days.`
          : ' Execute Direct switch now to stop ongoing distributor commission drag.'
      }`;
    } else if (action === 'SWITCH_PEER') {
      const peerName = targetSeries?.schemeName || bestPeerCandidate?.label || 'category leader';
      rationale = `Trailing ${benchmark.name} / peer (${return3Y !== null ? `${return3Y}%` : 'N/A'} 3Y CAGR vs ${targetReturn3Y !== null ? `${targetReturn3Y}%` : 'peer'} in ${peerName}).${
        planType === 'Regular' ? ' Also incurs Regular plan distributor fees.' : ''
      }${fifoLotNote}${
        costProfile.isElssLockIn && exitLoadFreeValue < currentValue
          ? ` Switch only unlocked ELSS units (>3Y) first; stop fresh ELSS SIPs into this scheme.`
          : ''
      }`;
    }

    const targetName =
      action === 'SWITCH_TO_DIRECT'
        ? targetSeries?.schemeName || holding.schemeName.replace(/Regular/gi, 'Direct')
        : action === 'SWITCH_PEER'
        ? targetSeries?.schemeName || bestPeerCandidate?.label || null
        : null;

    const switchSuggestion: MfSwitchSuggestion = {
      action,
      timingVerdict,
      targetSchemeCode:
        action === 'HOLD'
          ? null
          : targetSeries?.schemeCode ||
            (action === 'SWITCH_PEER' ? bestPeerCandidate?.schemeCode || null : null),
      targetSchemeName: targetName,
      targetCategory: action === 'HOLD' ? null : targetSeries?.category || category,
      targetExpenseRatio: action === 'HOLD' ? null : targetExpenseRatio,
      targetReturn1Y,
      targetReturn3Y,
      targetGrade,
      annualCommissionSaved,
      tenYearProjectedExtraWealth,
      holdingDays: oldestHoldingDays,
      exitLoadWindowDays,
      exitLoadRatePct: effectiveExitLoadPct,
      exitLoadRuleLabel: costProfile.exitLoadRuleLabel,
      daysUntilExitLoadFree,
      estimatedExitLoad,
      taxCategory: isDebt ? 'DEBT' : 'EQUITY',
      taxType,
      estimatedTax,
      netFirstYearBenefit,
      breakEvenMonths,
      fifoBreakdown,
      rationale,
    };

    analyzedFunds.push({
      holding: {
        ...holding,
        schemeName: series?.schemeName || holding.schemeName,
        fundHouse: series?.fundHouse || holding.fundHouse,
        category,
        planType,
      },
      latestNav,
      previousNav,
      navDate,
      hasLiveNav: points.length > 0,
      dayChangePercent,
      investedValue,
      currentValue,
      unrealizedGain,
      unrealizedGainPercent,
      estExpenseRatio,
      terSource: costProfile.terSource,
      annualFeeDrag,
      benchmarkName: benchmark.name,
      return1Y,
      return3Y,
      return5Y,
      benchmarkReturn1Y: risk.benchReturn1Y,
      benchmarkReturn3Y: risk.benchReturn3Y,
      benchmarkReturn5Y: risk.benchReturn5Y,
      alpha3Y: risk.alpha3Y,
      beta: risk.beta,
      sharpeRatio: risk.sharpeRatio,
      maxDrawdown: risk.maxDrawdown,
      downsideCapture: risk.downsideCapture,
      rollingBeatRate: risk.rollingBeatRate,
      consistencyScore: score.consistencyScore,
      downsideProtectionScore: score.downsideProtectionScore,
      reportCardGrade: score.grade,
      navHistory: buildNavChartSeries(points, benchmark.points),
      switchSuggestion,
    });
  }

  const totalInvested = Number(
    analyzedFunds.reduce((s, f) => s + f.investedValue, 0).toFixed(2)
  );
  const totalCurrent = Number(
    analyzedFunds.reduce((s, f) => s + f.currentValue, 0).toFixed(2)
  );
  const totalGain = Number((totalCurrent - totalInvested).toFixed(2));
  const totalGainPercent =
    totalInvested > 0 ? Number(((totalGain / totalInvested) * 100).toFixed(2)) : 0;
  const totalAnnualFeeDrag = Number(
    analyzedFunds.reduce((s, f) => s + f.annualFeeDrag, 0).toFixed(2)
  );
  const regularCommissionLeak = Number(
    analyzedFunds
      .filter((f) => f.holding.planType === 'Regular')
      .reduce((s, f) => s + f.switchSuggestion.annualCommissionSaved, 0)
      .toFixed(2)
  );
  const tenYearCommissionLeak = Number(
    analyzedFunds
      .reduce((s, f) => s + f.switchSuggestion.tenYearProjectedExtraWealth, 0)
      .toFixed(0)
  );

  const summary: MutualFundSummaryMetrics = {
    totalInvested,
    totalCurrent,
    totalGain,
    totalGainPercent,
    estXirr: estimatePortfolioXirr(
      analyzedFunds.map((f) => ({
        investedValue: f.investedValue,
        currentValue: f.currentValue,
        purchaseDate: f.holding.purchaseDate,
      }))
    ),
    totalAnnualFeeDrag,
    regularCommissionLeak,
    tenYearCommissionLeak,
    switchCount: analyzedFunds.filter((f) => f.switchSuggestion.action !== 'HOLD').length,
    regularPlanCount: analyzedFunds.filter((f) => f.holding.planType === 'Regular').length,
    underperformerCount: analyzedFunds.filter(
      (f) => f.switchSuggestion.action === 'SWITCH_PEER'
    ).length,
  };

  return {
    funds: analyzedFunds,
    summary,
    analyzedAt: new Date().toISOString(),
  };
}

function formatSimpleInr(val: number): string {
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

