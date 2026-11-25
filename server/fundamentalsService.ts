import { findCatalogEntry } from './marketService.ts';
import type {
  AnalystConsensusSnapshot,
  LiveFundamentalsSnapshot,
  MarketQuote,
} from '../src/types/market.ts';

interface CrumbSession {
  cookie: string;
  crumb: string;
  expiresAt: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CRUMB_TTL_MS = 30 * 60 * 1000;
const FUNDAMENTALS_TTL_MS = 6 * 60 * 60 * 1000;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let crumbSession: CrumbSession | null = null;
let crumbRefreshPromise: Promise<CrumbSession | null> | null = null;

const fundamentalsCache = new Map<string, CacheEntry<LiveFundamentalsSnapshot>>();

interface YahooRawField {
  raw?: number;
  fmt?: string;
}

interface YahooQuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      summaryDetail?: {
        trailingPE?: YahooRawField;
        forwardPE?: YahooRawField;
      };
      defaultKeyStatistics?: {
        forwardPE?: YahooRawField;
        trailingEps?: YahooRawField;
        priceToBook?: YahooRawField;
        enterpriseToEbitda?: YahooRawField;
      };
      financialData?: {
        returnOnEquity?: YahooRawField;
        returnOnAssets?: YahooRawField;
        revenueGrowth?: YahooRawField;
        earningsGrowth?: YahooRawField;
        operatingMargins?: YahooRawField;
        profitMargins?: YahooRawField;
        freeCashflow?: YahooRawField;
        operatingCashflow?: YahooRawField;
        totalRevenue?: YahooRawField;
        debtToEquity?: YahooRawField;
        targetMeanPrice?: YahooRawField;
        targetMedianPrice?: YahooRawField;
        targetHighPrice?: YahooRawField;
        targetLowPrice?: YahooRawField;
        numberOfAnalystOpinions?: YahooRawField;
        recommendationMean?: YahooRawField;
        recommendationKey?: string;
      };
      calendarEvents?: {
        earnings?: {
          earningsDate?: YahooRawField[];
        };
      };
    }>;
  };
}

function extractRawNumber(field?: YahooRawField): number | null {
  if (!field || typeof field.raw !== 'number' || !Number.isFinite(field.raw)) {
    return null;
  }
  return field.raw;
}

function extractCookieHeader(res: Response): string {
  const headersWithGetSetCookie = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headersWithGetSetCookie.getSetCookie === 'function') {
    const cookies = headersWithGetSetCookie.getSetCookie();
    if (cookies.length > 0) {
      return cookies.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
    }
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function fetchFreshCrumbSession(): Promise<CrumbSession | null> {
  try {
    const initRes = await fetch('https://fc.yahoo.com', {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });

    const cookie = extractCookieHeader(initRes);
    if (!cookie) return null;

    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: '*/*',
        Cookie: cookie,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.startsWith('<') || crumb.length > 64) return null;

    const session: CrumbSession = {
      cookie,
      crumb,
      expiresAt: Date.now() + CRUMB_TTL_MS,
    };
    crumbSession = session;
    return session;
  } catch {
    return null;
  }
}

async function getYahooCrumbSession(forceRefresh = false): Promise<CrumbSession | null> {
  if (!forceRefresh && crumbSession && crumbSession.expiresAt > Date.now()) {
    return crumbSession;
  }
  if (!crumbRefreshPromise) {
    crumbRefreshPromise = fetchFreshCrumbSession().finally(() => {
      crumbRefreshPromise = null;
    });
  }
  return crumbRefreshPromise;
}

function normalizeRecommendationLabel(
  key?: string | null,
  mean?: number | null
): AnalystConsensusSnapshot['recommendationLabel'] {
  const k = (key || '').trim().toLowerCase();
  if (k === 'strong_buy' || k === 'strongbuy') return 'Strong Buy';
  if (k === 'buy') return 'Buy';
  if (k === 'hold') return 'Hold';
  if (k === 'underperform') return 'Underperform';
  if (k === 'sell' || k === 'strong_sell') return 'Sell';
  if (typeof mean === 'number' && Number.isFinite(mean)) {
    if (mean <= 1.75) return 'Strong Buy';
    if (mean <= 2.45) return 'Buy';
    if (mean <= 3.35) return 'Hold';
    if (mean <= 4.15) return 'Underperform';
    return 'Sell';
  }
  return null;
}

function buildCatalogFallback(symbol: string): LiveFundamentalsSnapshot {
  const catalog = findCatalogEntry(symbol);
  return {
    symbol: symbol.toUpperCase(),
    trailingPE: catalog?.peRatio ?? null,
    forwardPE: null,
    priceToBook: null,
    evToEbitda: null,
    roePct: null,
    roaPct: null,
    roceProxyPct: catalog?.roce ?? null,
    revenueGrowthPct: null,
    earningsGrowthPct: null,
    operatingMarginPct: null,
    profitMarginPct: null,
    fcfMarginPct: null,
    debtToEquity: catalog?.debtToEquity ?? null,
    nextEarningsDate: null,
    daysToEarnings: null,
    earningsRiskFlag: false,
    analystConsensus: null,
    source: 'catalog_fallback',
    fetchedAt: new Date().toISOString(),
  };
}

function computeDaysToDate(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(target)) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  return Math.round((target - todayMs) / (24 * 60 * 60 * 1000));
}

async function fetchQuoteSummaryPayload(
  symbol: string,
  session: CrumbSession
): Promise<{ status: number; payload: YahooQuoteSummaryResponse | null }> {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol
  )}?modules=financialData,defaultKeyStatistics,calendarEvents,summaryDetail&crumb=${encodeURIComponent(
    session.crumb
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json',
        Cookie: session.cookie,
      },
      signal: AbortSignal.timeout(6500),
    });

    if (!res.ok) {
      return { status: res.status, payload: null };
    }

    const payload = (await res.json()) as YahooQuoteSummaryResponse;
    return { status: res.status, payload };
  } catch {
    return { status: 0, payload: null };
  }
}

export async function getLiveFundamentals(symbolInput: string): Promise<LiveFundamentalsSnapshot> {
  const symbol = symbolInput.trim().toUpperCase();
  if (!symbol || symbol.startsWith('^')) {
    return buildCatalogFallback(symbol);
  }

  const cached = fundamentalsCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const catalog = findCatalogEntry(symbol);
  let session = await getYahooCrumbSession(false);

  if (!session) {
    const fallback = buildCatalogFallback(symbol);
    fundamentalsCache.set(symbol, {
      data: fallback,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return fallback;
  }

  let result = await fetchQuoteSummaryPayload(symbol, session);
  if (result.status === 401 || result.status === 403) {
    session = await getYahooCrumbSession(true);
    if (session) {
      result = await fetchQuoteSummaryPayload(symbol, session);
    }
  }

  const entry = result.payload?.quoteSummary?.result?.[0];
  if (!entry) {
    const fallback = buildCatalogFallback(symbol);
    fundamentalsCache.set(symbol, {
      data: fallback,
      expiresAt: Date.now() + (result.status === 404 ? FUNDAMENTALS_TTL_MS : 20 * 60 * 1000),
    });
    return fallback;
  }

  const fin = entry.financialData;
  const stats = entry.defaultKeyStatistics;
  const detail = entry.summaryDetail;
  const cal = entry.calendarEvents;

  const rawTrailingPE = extractRawNumber(detail?.trailingPE);
  const rawForwardPE =
    extractRawNumber(detail?.forwardPE) ?? extractRawNumber(stats?.forwardPE);
  const rawPriceToBook = extractRawNumber(stats?.priceToBook);
  const rawEvToEbitda = extractRawNumber(stats?.enterpriseToEbitda);
  const rawRoe = extractRawNumber(fin?.returnOnEquity);
  const rawRoa = extractRawNumber(fin?.returnOnAssets);
  const rawRevGrowth = extractRawNumber(fin?.revenueGrowth);
  const rawEarnGrowth = extractRawNumber(fin?.earningsGrowth);
  const rawOpMargin = extractRawNumber(fin?.operatingMargins);
  const rawProfitMargin = extractRawNumber(fin?.profitMargins);
  const rawFcf = extractRawNumber(fin?.freeCashflow);
  const rawOcf = extractRawNumber(fin?.operatingCashflow);
  const rawTotalRev = extractRawNumber(fin?.totalRevenue);
  const rawDePct = extractRawNumber(fin?.debtToEquity);

  const rawTargetMean = extractRawNumber(fin?.targetMeanPrice);
  const rawTargetMedian = extractRawNumber(fin?.targetMedianPrice);
  const rawTargetHigh = extractRawNumber(fin?.targetHighPrice);
  const rawTargetLow = extractRawNumber(fin?.targetLowPrice);
  const rawAnalystCount = extractRawNumber(fin?.numberOfAnalystOpinions);
  const rawRecMean = extractRawNumber(fin?.recommendationMean);
  const rawRecKey = typeof fin?.recommendationKey === 'string' ? fin.recommendationKey : null;

  const trailingPE =
    rawTrailingPE !== null && rawTrailingPE > 0 && rawTrailingPE < 600
      ? Number(rawTrailingPE.toFixed(2))
      : catalog?.peRatio ?? null;
  const forwardPE =
    rawForwardPE !== null && rawForwardPE > 0 && rawForwardPE < 600
      ? Number(rawForwardPE.toFixed(2))
      : null;
  const priceToBook =
    rawPriceToBook !== null && rawPriceToBook > 0 && rawPriceToBook < 150
      ? Number(rawPriceToBook.toFixed(2))
      : null;
  const evToEbitda =
    rawEvToEbitda !== null && rawEvToEbitda > 1 && rawEvToEbitda < 120
      ? Number(rawEvToEbitda.toFixed(2))
      : null;

  const roePct = rawRoe !== null ? Number((rawRoe * 100).toFixed(2)) : null;
  const roaPct = rawRoa !== null ? Number((rawRoa * 100).toFixed(2)) : null;
  const roceProxyPct =
    roePct !== null
      ? roePct
      : catalog?.roce !== undefined && catalog?.roce !== null
      ? catalog.roce
      : roaPct !== null
      ? Number((roaPct * 1.45).toFixed(2))
      : null;

  const revenueGrowthPct =
    rawRevGrowth !== null ? Number((rawRevGrowth * 100).toFixed(2)) : null;
  const earningsGrowthPct =
    rawEarnGrowth !== null ? Number((rawEarnGrowth * 100).toFixed(2)) : null;
  const operatingMarginPct =
    rawOpMargin !== null ? Number((rawOpMargin * 100).toFixed(2)) : null;
  const profitMarginPct =
    rawProfitMargin !== null ? Number((rawProfitMargin * 100).toFixed(2)) : null;

  const isFinancialSector = /bank|financ|insur|nbfc/i.test(catalog?.sector || '');
  let fcfMarginPct: number | null = null;
  if (!isFinancialSector && rawTotalRev !== null && rawTotalRev > 0) {
    if (rawFcf !== null) {
      const pct = (rawFcf / rawTotalRev) * 100;
      if (pct >= -100 && pct <= 100) fcfMarginPct = Number(pct.toFixed(2));
    } else if (rawOcf !== null) {
      const pct = ((rawOcf * 0.7) / rawTotalRev) * 100;
      if (pct >= -100 && pct <= 100) fcfMarginPct = Number(pct.toFixed(2));
    }
  }

  // Yahoo returns debtToEquity as percentage (e.g. 44.325 => 0.44x)
  const debtToEquity =
    rawDePct !== null && rawDePct >= 0
      ? Number((rawDePct / 100).toFixed(2))
      : catalog?.debtToEquity ?? null;

  const targetMean =
    rawTargetMean !== null && rawTargetMean > 0 ? Number(rawTargetMean.toFixed(2)) : null;
  const targetMedian =
    rawTargetMedian !== null && rawTargetMedian > 0 ? Number(rawTargetMedian.toFixed(2)) : null;
  const targetHigh =
    rawTargetHigh !== null && rawTargetHigh > 0 ? Number(rawTargetHigh.toFixed(2)) : null;
  const targetLow =
    rawTargetLow !== null && rawTargetLow > 0 ? Number(rawTargetLow.toFixed(2)) : null;
  const analystCount =
    rawAnalystCount !== null && rawAnalystCount > 0 ? Math.round(rawAnalystCount) : null;
  const recommendationMean =
    rawRecMean !== null && rawRecMean >= 1 && rawRecMean <= 5
      ? Number(rawRecMean.toFixed(2))
      : null;
  const recommendationLabel = normalizeRecommendationLabel(rawRecKey, recommendationMean);

  const analystConsensus: AnalystConsensusSnapshot | null =
    targetMean !== null || recommendationLabel !== null
      ? {
          targetMean,
          targetMedian,
          targetHigh,
          targetLow,
          analystCount,
          recommendationKey: rawRecKey,
          recommendationLabel,
          recommendationMean,
        }
      : null;

  const earningsTimestamps = (cal?.earnings?.earningsDate ?? [])
    .map((d) => extractRawNumber(d))
    .filter((v): v is number => v !== null && v > 0)
    .sort((a, b) => a - b);

  const nowSec = Math.floor(Date.now() / 1000) - 86400;
  const upcomingEpoch =
    earningsTimestamps.find((ts) => ts >= nowSec) ?? null;
  const nextEarningsDate = upcomingEpoch
    ? new Date(upcomingEpoch * 1000).toISOString().slice(0, 10)
    : null;
  const daysToEarnings = computeDaysToDate(nextEarningsDate);
  const earningsRiskFlag =
    daysToEarnings !== null && daysToEarnings >= -1 && daysToEarnings <= 14;

  const hasAnyLiveMetric =
    rawTrailingPE !== null ||
    rawForwardPE !== null ||
    rawRoe !== null ||
    rawRoa !== null ||
    rawRevGrowth !== null ||
    rawEarnGrowth !== null ||
    rawDePct !== null ||
    nextEarningsDate !== null;

  const snapshot: LiveFundamentalsSnapshot = {
    symbol,
    trailingPE,
    forwardPE,
    priceToBook,
    evToEbitda: isFinancialSector ? null : evToEbitda,
    roePct,
    roaPct,
    roceProxyPct,
    revenueGrowthPct,
    earningsGrowthPct,
    operatingMarginPct,
    profitMarginPct,
    fcfMarginPct,
    debtToEquity,
    nextEarningsDate,
    daysToEarnings,
    earningsRiskFlag,
    analystConsensus,
    source: hasAnyLiveMetric ? 'live_yahoo' : 'catalog_fallback',
    fetchedAt: new Date().toISOString(),
  };

  fundamentalsCache.set(symbol, {
    data: snapshot,
    expiresAt: Date.now() + FUNDAMENTALS_TTL_MS,
  });

  return snapshot;
}

export async function getLiveFundamentalsBatch(
  symbols: string[],
  concurrency = 6
): Promise<Record<string, LiveFundamentalsSnapshot>> {
  const unique = Array.from(
    new Set(
      symbols
        .map((s) => s.trim().toUpperCase())
        .filter((s) => Boolean(s) && !s.startsWith('^'))
    )
  );

  if (unique.length === 0) return {};

  // Warm the crumb session once before launching parallel workers
  await getYahooCrumbSession(false);

  const out: Record<string, LiveFundamentalsSnapshot> = {};
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < unique.length) {
      const sym = unique[nextIdx++];
      out[sym] = await getLiveFundamentals(sym);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, unique.length) }, () => worker());
  await Promise.all(runners);
  return out;
}

export function mergeQuoteWithFundamentals(
  quote: MarketQuote,
  fundamentals?: LiveFundamentalsSnapshot | null
): MarketQuote {
  if (!fundamentals) return quote;
  return {
    ...quote,
    peRatio: fundamentals.trailingPE ?? quote.peRatio,
    forwardPE: fundamentals.forwardPE,
    roce: fundamentals.roceProxyPct ?? quote.roce,
    roePct: fundamentals.roePct,
    roaPct: fundamentals.roaPct,
    revenueGrowthPct: fundamentals.revenueGrowthPct,
    earningsGrowthPct: fundamentals.earningsGrowthPct,
    operatingMarginPct: fundamentals.operatingMarginPct,
    debtToEquity: fundamentals.debtToEquity ?? quote.debtToEquity,
    nextEarningsDate: fundamentals.nextEarningsDate,
    daysToEarnings: fundamentals.daysToEarnings,
    earningsRiskFlag: fundamentals.earningsRiskFlag,
    fundamentalsSource: fundamentals.source,
  };
}
