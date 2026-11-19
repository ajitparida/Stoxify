import {
  INDIAN_INDICES,
  INDIAN_STOCK_UNIVERSE,
  RESEARCH_SIGNAL_TEMPLATES,
  type CatalogStock,
} from './indianMarketCatalog.ts';
import type {
  CandlePoint,
  ChartRange,
  ChartResponse,
  Exchange,
  MarketQuote,
  ResearchSignal,
  SearchResultItem,
} from '../src/types/market.ts';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const QUOTE_TTL_MS = 25_000;
const CHART_TTL_MS = 180_000;
const SEARCH_TTL_MS = 300_000;

const quoteCache = new Map<string, CacheEntry<MarketQuote>>();
const chartCache = new Map<string, CacheEntry<ChartResponse>>();
const searchCache = new Map<string, CacheEntry<SearchResultItem[]>>();

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

const CATALOG_BY_SYMBOL = new Map<string, CatalogStock>();
for (const item of [...INDIAN_INDICES, ...INDIAN_STOCK_UNIVERSE]) {
  CATALOG_BY_SYMBOL.set(item.symbol.toUpperCase(), item);
}

// Corporate-action / demerger symbol remaps so legacy saved watchlists & holdings never 404
const RETIRED_SYMBOL_REMAP: Record<string, string> = {
  'TATAMOTORS.NS': 'TMPV.NS',
  'TATAMOTORS.BO': 'TMPV.BO',
  TATAMOTORS: 'TMPV.NS',
};

export function resolveActiveMarketSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  return RETIRED_SYMBOL_REMAP[upper] ?? upper;
}

export function findCatalogEntry(symbol: string): CatalogStock | undefined {
  const upper = resolveActiveMarketSymbol(symbol);
  if (CATALOG_BY_SYMBOL.has(upper)) return CATALOG_BY_SYMBOL.get(upper);
  const tickerOnly = upper.replace(/\.(NS|BO)$/, '');
  return INDIAN_STOCK_UNIVERSE.find(
    (s) =>
      s.ticker.toUpperCase() === tickerOnly ||
      s.aliases?.some((a) => a.toUpperCase() === tickerOnly)
  );
}

function computeSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i];
  }
  return Number((sum / period).toFixed(2));
}

function computeSMASeries(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  let rolling = 0;
  for (let i = 0; i < values.length; i++) {
    rolling += values[i];
    if (i >= period) {
      rolling -= values[i - period];
    }
    if (i >= period - 1) {
      result.push(Number((rolling / period).toFixed(2)));
    } else {
      result.push(null);
    }
  }
  return result;
}

function computeEMASeries(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const initSum = values.slice(0, period).reduce((acc, v) => acc + v, 0);
      ema = initSum / period;
      result.push(Number(ema.toFixed(2)));
    } else if (ema !== null) {
      ema = values[i] * k + ema * (1 - k);
      result.push(Number(ema.toFixed(2)));
    }
  }
  return result;
}

function computeRSI14(closes: number[]): number | null {
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
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

function pctReturn(closes: number[], lookbackBars: number): number | null {
  if (closes.length <= lookbackBars) return null;
  const latest = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - lookbackBars];
  if (!prev || prev <= 0) return null;
  return Number((((latest - prev) / prev) * 100).toFixed(2));
}

interface YahooChartPayload {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
        exchangeName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketVolume?: number;
        marketState?: string;
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
      };
      events?: {
        dividends?: Record<
          string,
          {
            amount?: number;
            date?: number;
          }
        >;
      };
    }>;
  };
}

async function fetchYahooChartRaw(
  symbol: string,
  range: string,
  interval: string,
  includeDividends = false
): Promise<NonNullable<NonNullable<YahooChartPayload['chart']>['result']>[0] | null> {
  const eventsParam = includeDividends ? '&events=div' : '';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false${eventsParam}`;

  try {
    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as YahooChartPayload;
    return json.chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

function buildQuoteFromDailyResult(
  symbol: string,
  result: NonNullable<NonNullable<YahooChartPayload['chart']>['result']>[0]
): MarketQuote | null {
  const meta = result.meta;
  if (!meta) return null;

  const quoteObj = result.indicators?.quote?.[0];
  const rawCloses = quoteObj?.close ?? [];
  const rawVolumes = quoteObj?.volume ?? [];

  const validCloses: number[] = [];
  const validVolumes: number[] = [];

  for (let i = 0; i < rawCloses.length; i++) {
    const c = rawCloses[i];
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
      validCloses.push(c);
      const v = rawVolumes[i];
      validVolumes.push(typeof v === 'number' && Number.isFinite(v) ? v : 0);
    }
  }

  const price =
    typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0
      ? meta.regularMarketPrice
      : validCloses[validCloses.length - 1] ?? 0;

  if (price <= 0) return null;

  const prevClose =
    typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0
      ? meta.chartPreviousClose
      : validCloses.length >= 2
      ? validCloses[validCloses.length - 2]
      : price;

  // For range=1y, meta.chartPreviousClose is 1 year ago; previous trading day close is validCloses[length-2]
  const dayPrevClose =
    validCloses.length >= 2
      ? validCloses[validCloses.length - 2]
      : prevClose;

  const effectivePrev =
    typeof meta.previousClose === 'number' && meta.previousClose > 0
      ? meta.previousClose
      : dayPrevClose;

  const change = Number((price - effectivePrev).toFixed(2));
  const changePercent =
    effectivePrev > 0 ? Number(((change / effectivePrev) * 100).toFixed(2)) : 0;

  const recent20Vols = validVolumes.slice(-21, -1);
  const avgVol20d =
    recent20Vols.length > 0
      ? Math.round(recent20Vols.reduce((a, b) => a + b, 0) / recent20Vols.length)
      : 0;

  const latestVol =
    typeof meta.regularMarketVolume === 'number' && meta.regularMarketVolume > 0
      ? meta.regularMarketVolume
      : validVolumes[validVolumes.length - 1] ?? 0;

  const volumeRatio =
    avgVol20d > 0 ? Number((latestVol / avgVol20d).toFixed(2)) : 1;

  const catalog = findCatalogEntry(symbol);
  const upperSymbol = (meta.symbol || symbol).toUpperCase();
  const exchange: Exchange | 'INDEX' = upperSymbol.startsWith('^')
    ? 'INDEX'
    : upperSymbol.endsWith('.BO')
    ? 'BSE'
    : 'NSE';

  const ticker =
    catalog?.ticker ?? upperSymbol.replace(/\.(NS|BO)$/, '').replace(/^\^/, '');

  const minClose = validCloses.length > 0 ? Math.min(...validCloses) : price;
  const maxClose = validCloses.length > 0 ? Math.max(...validCloses) : price;

  // Compute trailing 12-month cash dividends from Yahoo Finance events.dividends
  const divEntries = Object.values(result.events?.dividends ?? {})
    .filter((d) => typeof d.amount === 'number' && Number.isFinite(d.amount) && d.amount > 0)
    .sort((a, b) => (a.date ?? 0) - (b.date ?? 0));

  const annualDividendPerShare = Number(
    divEntries.reduce((sum, d) => sum + (d.amount ?? 0), 0).toFixed(2)
  );
  const dividendYield =
    price > 0 && annualDividendPerShare > 0
      ? Number(((annualDividendPerShare / price) * 100).toFixed(2))
      : 0;
  const latestDiv = divEntries.length > 0 ? divEntries[divEntries.length - 1] : null;
  const lastDividendDate =
    latestDiv?.date && Number.isFinite(latestDiv.date)
      ? new Date(latestDiv.date * 1000).toISOString().slice(0, 10)
      : null;
  const lastDividendAmount =
    latestDiv?.amount !== undefined ? Number(latestDiv.amount.toFixed(2)) : null;

  return {
    symbol: upperSymbol,
    ticker,
    shortName: catalog?.name || meta.shortName || meta.longName || ticker,
    exchange,
    sector: catalog?.sector || 'Equities',
    capCategory: catalog?.capCategory || 'Mid Cap',
    price: Number(price.toFixed(2)),
    previousClose: Number(effectivePrev.toFixed(2)),
    change,
    changePercent,
    dayHigh: Number((meta.regularMarketDayHigh ?? price).toFixed(2)),
    dayLow: Number((meta.regularMarketDayLow ?? price).toFixed(2)),
    fiftyTwoWeekHigh: Number((meta.fiftyTwoWeekHigh ?? maxClose).toFixed(2)),
    fiftyTwoWeekLow: Number((meta.fiftyTwoWeekLow ?? minClose).toFixed(2)),
    volume: latestVol,
    avgVolume20d: avgVol20d,
    volumeRatio,
    sma50: computeSMA(validCloses, 50),
    sma200: computeSMA(validCloses, 200),
    rsi14: computeRSI14(validCloses),
    return1M: pctReturn(validCloses, 21),
    return3M: pctReturn(validCloses, 63),
    return6M: pctReturn(validCloses, 126),
    return1Y: pctReturn(validCloses, Math.min(250, validCloses.length - 1)),
    peRatio: catalog?.peRatio ?? null,
    roce: catalog?.roce ?? null,
    debtToEquity: catalog?.debtToEquity ?? null,
    beta: catalog?.beta ?? 1.0,
    annualDividendPerShare,
    dividendYield,
    lastDividendDate,
    lastDividendAmount,
    dividendPayoutCount1Y: divEntries.length,
    marketState: meta.marketState || 'CLOSED',
    updatedAt: new Date().toISOString(),
  };
}

export async function getQuote(symbol: string): Promise<MarketQuote | null> {
  const normalized = resolveActiveMarketSymbol(symbol);
  const cached = quoteCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const raw = await fetchYahooChartRaw(normalized, '1y', '1d', true);
  if (raw) {
    const parsed = buildQuoteFromDailyResult(normalized, raw);
    if (parsed) {
      quoteCache.set(normalized, {
        data: parsed,
        expiresAt: Date.now() + QUOTE_TTL_MS,
      });
      return parsed;
    }
  }

  // Fallback to stale cache if upstream temporarily throttles
  if (cached) {
    return { ...cached.data, isCachedFallback: true };
  }

  return null;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  async function next() {
    while (nextIdx < items.length) {
      const current = nextIdx++;
      results[current] = await worker(items[current]);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

export async function getQuotes(symbols: string[]): Promise<Record<string, MarketQuote>> {
  const unique = Array.from(
    new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))
  );
  const fetched = await runWithConcurrency(unique, 8, async (sym) => ({
    sym,
    quote: await getQuote(sym),
  }));

  const map: Record<string, MarketQuote> = {};
  for (const entry of fetched) {
    if (entry.quote) {
      map[entry.sym] = entry.quote;
    }
  }
  return map;
}

function formatDateLabel(tsSec: number, range: ChartRange): string {
  const d = new Date(tsSec * 1000);
  if (range === '1d' || range === '5d') {
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  if (range === 'max') {
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      year: 'numeric',
    });
  }
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: range === '1y' || range === '3y' || range === '5y' ? '2-digit' : undefined,
  });
}

export async function getChart(
  symbol: string,
  range: ChartRange = '6mo'
): Promise<ChartResponse | null> {
  const normalized = resolveActiveMarketSymbol(symbol);
  const cacheKey = `${normalized}:${range}`;
  const cached = chartCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const intervalMap: Record<ChartRange, string> = {
    '1d': '5m',
    '5d': '15m',
    '1mo': '1d',
    '6mo': '1d',
    '1y': '1d',
    '3y': '1d',
    '5y': '1wk',
    max: '1mo',
  };

  const [rawRange, quote] = await Promise.all([
    fetchYahooChartRaw(normalized, range, intervalMap[range]),
    getQuote(normalized),
  ]);

  if (!rawRange || !quote) {
    return cached ? cached.data : null;
  }

  const timestamps = rawRange.timestamp ?? [];
  const q = rawRange.indicators?.quote?.[0];
  const opens = q?.open ?? [];
  const highs = q?.high ?? [];
  const lows = q?.low ?? [];
  const closes = q?.close ?? [];
  const volumes = q?.volume ?? [];

  const points: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];

  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
      points.push({
        timestamp: timestamps[i],
        open: Number(((opens[i] ?? c) as number).toFixed(2)),
        high: Number(((highs[i] ?? c) as number).toFixed(2)),
        low: Number(((lows[i] ?? c) as number).toFixed(2)),
        close: Number(c.toFixed(2)),
        volume: typeof volumes[i] === 'number' && Number.isFinite(volumes[i]) ? (volumes[i] as number) : 0,
      });
    }
  }

  const closeArr = points.map((p) => p.close);
  const sma50Series = computeSMASeries(closeArr, Math.min(50, Math.max(10, Math.floor(closeArr.length / 3))));
  const ema20Series = computeEMASeries(closeArr, Math.min(20, Math.max(5, Math.floor(closeArr.length / 6))));

  const candles: CandlePoint[] = points.map((p, idx) => ({
    ...p,
    dateLabel: formatDateLabel(p.timestamp, range),
    sma50: sma50Series[idx],
    ema20: ema20Series[idx],
  }));

  const response: ChartResponse = {
    symbol: normalized,
    range,
    quote,
    candles,
  };

  chartCache.set(cacheKey, {
    data: response,
    expiresAt: Date.now() + CHART_TTL_MS,
  });

  return response;
}

export interface RawOhlcvBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const rawOhlcvCache = new Map<string, CacheEntry<RawOhlcvBar[]>>();

export async function getRawOhlcvCandles(
  symbol: string,
  range: string,
  interval: string
): Promise<RawOhlcvBar[]> {
  const normalized = symbol.trim().toUpperCase();
  const cacheKey = `${normalized}:${range}:${interval}`;
  const cached = rawOhlcvCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const rawRange = await fetchYahooChartRaw(normalized, range, interval);
  if (!rawRange) {
    return cached ? cached.data : [];
  }

  const timestamps = rawRange.timestamp ?? [];
  const q = rawRange.indicators?.quote?.[0];
  const opens = q?.open ?? [];
  const highs = q?.high ?? [];
  const lows = q?.low ?? [];
  const closes = q?.close ?? [];
  const volumes = q?.volume ?? [];

  const bars: RawOhlcvBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
      bars.push({
        timestamp: timestamps[i],
        open: Number(((opens[i] ?? c) as number).toFixed(2)),
        high: Number(((highs[i] ?? c) as number).toFixed(2)),
        low: Number(((lows[i] ?? c) as number).toFixed(2)),
        close: Number(c.toFixed(2)),
        volume:
          typeof volumes[i] === 'number' && Number.isFinite(volumes[i])
            ? (volumes[i] as number)
            : 0,
      });
    }
  }

  rawOhlcvCache.set(cacheKey, {
    data: bars,
    expiresAt: Date.now() + CHART_TTL_MS,
  });
  return bars;
}

export async function searchIndianStocks(queryText: string): Promise<SearchResultItem[]> {
  const q = queryText.trim();
  if (!q) {
    return INDIAN_STOCK_UNIVERSE.slice(0, 12).map((item) => ({
      symbol: item.symbol,
      ticker: item.ticker,
      name: item.name,
      exchange: item.exchange === 'BSE' ? 'BSE' : 'NSE',
      sector: item.sector,
      type: 'EQUITY',
    }));
  }

  const upper = q.toUpperCase();
  const cached = searchCache.get(upper);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Local catalog matches first
  const localMatches: SearchResultItem[] = INDIAN_STOCK_UNIVERSE.filter(
    (s) =>
      s.ticker.toUpperCase().includes(upper) ||
      s.name.toUpperCase().includes(upper) ||
      s.symbol.toUpperCase().includes(upper) ||
      s.aliases?.some((a) => a.toUpperCase().includes(upper))
  ).map((s) => ({
    symbol: s.symbol,
    ticker: s.ticker,
    name: s.name,
    exchange: s.exchange === 'BSE' ? 'BSE' : 'NSE',
    sector: s.sector,
    type: 'EQUITY',
  }));

  // Live Yahoo Finance v1 search for any NSE/BSE stock outside the curated 36
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q
    )}&quotesCount=14&newsCount=0&region=IN&lang=en-IN`;
    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        quotes?: Array<{
          symbol?: string;
          shortname?: string;
          longname?: string;
          quoteType?: string;
          sector?: string;
        }>;
      };
      const seen = new Set(localMatches.map((m) => m.symbol));
      for (const item of json.quotes ?? []) {
        const sym = (item.symbol ?? '').toUpperCase();
        if (!sym.endsWith('.NS') && !sym.endsWith('.BO')) continue;
        if (seen.has(sym)) continue;
        seen.add(sym);
        localMatches.push({
          symbol: sym,
          ticker: sym.replace(/\.(NS|BO)$/, ''),
          name: item.longname || item.shortname || sym,
          exchange: sym.endsWith('.BO') ? 'BSE' : 'NSE',
          sector: item.sector || 'Equities',
          type: item.quoteType || 'EQUITY',
        });
      }
    }
  } catch {
    // Graceful fallback to localMatches
  }

  const sliced = localMatches.slice(0, 15);
  searchCache.set(upper, {
    data: sliced,
    expiresAt: Date.now() + SEARCH_TTL_MS,
  });
  return sliced;
}

export async function getScreenerUniverse(): Promise<MarketQuote[]> {
  const symbols = INDIAN_STOCK_UNIVERSE.map((s) => s.symbol);
  const quotes = await getQuotes(symbols);
  return symbols.map((sym) => quotes[sym]).filter((q): q is MarketQuote => Boolean(q));
}

export async function getLiveResearchSignals(): Promise<
  Array<ResearchSignal & { liveQuote: MarketQuote | null }>
> {
  const symbols = RESEARCH_SIGNAL_TEMPLATES.map((t) => t.symbol);
  const quotes = await getQuotes(symbols);

  return RESEARCH_SIGNAL_TEMPLATES.map((tpl) => {
    const quote = quotes[tpl.symbol] ?? null;
    const anchor = quote?.price ?? 1000;
    const roundToTick = (n: number) => Number(n.toFixed(1));

    return {
      id: tpl.id,
      symbol: tpl.symbol,
      ticker: tpl.ticker,
      companyName: tpl.companyName,
      exchange: tpl.exchange,
      sector: tpl.sector,
      segment: tpl.segment,
      action: tpl.action,
      entryLow: roundToTick(anchor * (1 + tpl.entryPctLow)),
      entryHigh: roundToTick(anchor * (1 + tpl.entryPctHigh)),
      targetPrice: roundToTick(anchor * (1 + tpl.targetPct)),
      stopLoss: roundToTick(anchor * (1 + tpl.stopLossPct)),
      horizon: tpl.horizon,
      rationale: tpl.rationale,
      publishedDate: tpl.publishedDate,
      liveQuote: quote,
    };
  });
}

export async function resolveSymbolForScreenshot(
  rawName: string,
  guessedSymbol?: string,
  preferredExchange: Exchange = 'NSE'
): Promise<{
  symbol: string;
  name: string;
  exchange: Exchange;
  sector: string;
  quote: MarketQuote | null;
}> {
  const candidates: string[] = [];
  const cleanGuess = (guessedSymbol ?? '').trim().toUpperCase().replace(/[^A-Z0-9.&-]/g, '');
  const cleanRaw = rawName.trim().toUpperCase();

  // 1. Check catalog by symbol, ticker, alias, or fuzzy company name
  const catalogMatch = INDIAN_STOCK_UNIVERSE.find((s) => {
    const baseTicker = s.ticker.toUpperCase();
    if (cleanGuess && (s.symbol === cleanGuess || baseTicker === cleanGuess.replace(/\.(NS|BO)$/, ''))) {
      return true;
    }
    if (cleanRaw === baseTicker || s.name.toUpperCase().includes(cleanRaw) || cleanRaw.includes(baseTicker)) {
      return true;
    }
    return s.aliases?.some((a) => cleanRaw.includes(a.toUpperCase()));
  });

  if (catalogMatch) {
    const suffix = preferredExchange === 'BSE' ? '.BO' : '.NS';
    const targetSym =
      preferredExchange === 'BSE' ? `${catalogMatch.ticker}.BO` : catalogMatch.symbol;
    const q = (await getQuote(targetSym)) ?? (await getQuote(`${catalogMatch.ticker}${suffix === '.BO' ? '.NS' : '.BO'}`));
    if (q) {
      return {
        symbol: q.symbol,
        name: catalogMatch.name,
        exchange: q.symbol.endsWith('.BO') ? 'BSE' : 'NSE',
        sector: catalogMatch.sector,
        quote: q,
      };
    }
  }

  // 2. Try direct guessed symbol with .NS / .BO
  if (cleanGuess) {
    const bare = cleanGuess.replace(/\.(NS|BO)$/, '');
    if (preferredExchange === 'BSE') {
      candidates.push(`${bare}.BO`, `${bare}.NS`);
    } else {
      candidates.push(`${bare}.NS`, `${bare}.BO`);
    }
  }

  for (const sym of candidates) {
    const q = await getQuote(sym);
    if (q) {
      return {
        symbol: q.symbol,
        name: q.shortName,
        exchange: q.symbol.endsWith('.BO') ? 'BSE' : 'NSE',
        sector: q.sector,
        quote: q,
      };
    }
  }

  // 3. Fallback to Yahoo search using raw company name
  const searchResults = await searchIndianStocks(rawName);
  for (const sr of searchResults.slice(0, 3)) {
    const q = await getQuote(sr.symbol);
    if (q) {
      return {
        symbol: q.symbol,
        name: sr.name,
        exchange: sr.exchange,
        sector: sr.sector,
        quote: q,
      };
    }
  }

  const fallbackTicker = (cleanGuess || cleanRaw.split(/\s+/)[0] || 'UNKNOWN')
    .replace(/\.(NS|BO)$/, '')
    .replace(/[^A-Z0-9&-]/g, '');

  return {
    symbol: `${fallbackTicker}.${preferredExchange === 'BSE' ? 'BO' : 'NS'}`,
    name: rawName,
    exchange: preferredExchange,
    sector: 'Equities',
    quote: null,
  };
}
