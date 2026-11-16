import { useEffect, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Plus, RefreshCw, Search, Star } from 'lucide-react';
import type { ChartRange, ChartResponse, SearchResultItem } from '../types/market';
import { formatINR, formatPercent, formatVolume } from '../utils/portfolioAnalytics';

export interface ChartOverlayLevels {
  entryLow?: number;
  entryHigh?: number;
  targetPrice?: number;
  stopLoss?: number;
  avgBuyPrice?: number;
}

interface MarketChartTerminalProps {
  symbol: string;
  onSelectSymbol: (symbol: string) => void;
  overlayLevels?: ChartOverlayLevels | null;
  onClearOverlay?: () => void;
  onAddHoldingClick: (prefillSymbol?: string) => void;
  onToggleWatchlist: (symbol: string, name: string, exchange: 'NSE' | 'BSE', sector: string) => void;
  isInWatchlist: (symbol: string) => boolean;
}

const RANGES: Array<{ key: ChartRange; label: string }> = [
  { key: '1d', label: '1D' },
  { key: '5d', label: '1W' },
  { key: '1mo', label: '1M' },
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1Y' },
];

export function MarketChartTerminal({
  symbol,
  onSelectSymbol,
  overlayLevels,
  onClearOverlay,
  onAddHoldingClick,
  onToggleWatchlist,
  isInWatchlist,
}: MarketChartTerminalProps) {
  const [range, setRange] = useState<ChartRange>('6mo');
  const [chartData, setChartData] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSma50, setShowSma50] = useState(true);
  const [showEma20, setShowEma20] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const fetchChart = async (sym: string, r: ChartRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market/chart/${encodeURIComponent(sym)}?range=${r}`);
      if (!res.ok) {
        throw new Error(`Unable to load chart for ${sym}`);
      }
      const data = (await res.json()) as ChartResponse;
      setChartData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chart data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChart(symbol, range);
  }, [symbol, range]);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const json = (await res.json()) as { results: SearchResultItem[] };
          setSearchResults(json.results || []);
        }
      } catch {
        // Ignore transient search failures
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen]);

  const quote = chartData?.quote;
  const candles = chartData?.candles ?? [];
  const isPositive = (quote?.change ?? 0) >= 0;
  const strokeColor = isPositive ? '#16A34A' : '#DC2626';

  const priceValues = candles.map((c) => c.close);
  if (overlayLevels?.targetPrice) priceValues.push(overlayLevels.targetPrice);
  if (overlayLevels?.stopLoss) priceValues.push(overlayLevels.stopLoss);
  if (overlayLevels?.avgBuyPrice) priceValues.push(overlayLevels.avgBuyPrice);

  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) * 0.985 : 0;
  const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) * 1.015 : 100;

  const fiftyTwoRangePct =
    quote && quote.fiftyTwoWeekHigh > quote.fiftyTwoWeekLow
      ? Math.min(
          100,
          Math.max(
            0,
            ((quote.price - quote.fiftyTwoWeekLow) /
              (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) *
              100
          )
        )
      : 50;

  return (
    <div className="space-y-6">
      {/* Symbol Search & Quick Index Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search any NSE/BSE ticker (e.g. RELIANCE, TATAMOTORS, BEL)..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
          {searchOpen && (
            <div
              className="fixed inset-0 z-20"
              onClick={() => setSearchOpen(false)}
              aria-hidden="true"
            />
          )}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-72 overflow-y-auto divide-y divide-slate-100">
              {searchResults.map((item, idx) => (
                <button
                  key={`${item.symbol}_${idx}`}
                  type="button"
                  onClick={() => {
                    onSelectSymbol(item.symbol);
                    setSearchQuery('');
                    setSearchOpen(false);
                    onClearOverlay?.();
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {item.ticker}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{item.name}</div>
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                    {item.exchange} · {item.sector}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {['^NSEI', '^BSESN', '^NSEBANK', 'RELIANCE.NS', 'HDFCBANK.NS', 'TCS.NS'].map((quickSym) => {
            const label =
              quickSym === '^NSEI'
                ? 'NIFTY 50'
                : quickSym === '^BSESN'
                ? 'SENSEX'
                : quickSym === '^NSEBANK'
                ? 'BANKNIFTY'
                : quickSym.replace('.NS', '');
            const active = symbol === quickSym;
            return (
              <button
                key={quickSym}
                type="button"
                onClick={() => {
                  onSelectSymbol(quickSym);
                  onClearOverlay?.();
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {error ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void fetchChart(symbol, range)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Fetch
            </button>
          </div>
        ) : (
          <>
            {/* Quote Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{quote?.exchange ?? 'NSE'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{quote?.sector ?? 'Equities'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{quote?.capCategory ?? 'Market Quote'}</span>
                  {quote?.marketState && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Market {quote.marketState}</span>
                    </>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {quote?.shortName ?? symbol}
                </h2>
                <div className="flex items-baseline gap-3 pt-1">
                  <span className="text-3xl font-bold font-mono-tabular text-slate-900">
                    {quote ? formatINR(quote.price) : '—'}
                  </span>
                  {quote && (
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-semibold font-mono-tabular ${
                        isPositive ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {isPositive ? '+' : ''}
                      {formatINR(quote.change)} ({formatPercent(quote.changePercent)})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {quote && quote.exchange !== 'INDEX' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onToggleWatchlist(
                          quote.symbol,
                          quote.shortName,
                          quote.exchange as 'NSE' | 'BSE',
                          quote.sector
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        isInWatchlist(quote.symbol)
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          isInWatchlist(quote.symbol) ? 'fill-amber-500 text-amber-500' : ''
                        }`}
                      />
                      {isInWatchlist(quote.symbol) ? 'Watchlisted' : 'Watchlist'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddHoldingClick(quote.symbol)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add to Portfolio
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Chart Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {RANGES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setRange(item.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      range === item.key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEma20}
                    onChange={(e) => setShowEma20(e.target.checked)}
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>EMA 20</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSma50}
                    onChange={(e) => setShowSma50(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>SMA 50</span>
                </label>
                {overlayLevels && (overlayLevels.targetPrice || overlayLevels.avgBuyPrice) && (
                  <button
                    type="button"
                    onClick={onClearOverlay}
                    className="text-blue-700 hover:underline font-medium"
                  >
                    Clear Price Levels
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void fetchChart(symbol, range)}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                  title="Refresh chart"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Price Chart Viewport */}
            <div className="h-[340px] w-full">
              {loading && candles.length === 0 ? (
                <div className="h-full w-full bg-slate-50 border border-slate-100 rounded-lg animate-pulse flex items-center justify-center text-xs text-slate-400">
                  Loading live exchange price series...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={candles} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={strokeColor} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      minTickGap={38}
                    />
                    <YAxis
                      domain={[minPrice, maxPrice]}
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                      tickFormatter={(v: number) => `₹${v.toLocaleString('en-IN')}`}
                      tickLine={false}
                      axisLine={false}
                      width={78}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                      }}
                      formatter={(val: unknown, name?: string | number) => {
                        const num = Number(val);
                        const label = String(name ?? 'close');
                        if (label === 'volume') return [formatVolume(num), 'Volume'];
                        return [formatINR(num), label === 'close' ? 'Close' : label.toUpperCase()];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke={strokeColor}
                      strokeWidth={2}
                      fill="url(#priceFill)"
                      isAnimationActive={false}
                    />
                    {showEma20 && (
                      <Line
                        type="monotone"
                        dataKey="ema20"
                        stroke="#1D4ED8"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                    {showSma50 && (
                      <Line
                        type="monotone"
                        dataKey="sma50"
                        stroke="#D97706"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                    {overlayLevels?.targetPrice && (
                      <ReferenceLine
                        y={overlayLevels.targetPrice}
                        stroke="#16A34A"
                        strokeDasharray="4 4"
                        label={{
                          value: `Target ${formatINR(overlayLevels.targetPrice)}`,
                          fill: '#15803D',
                          fontSize: 11,
                          position: 'insideTopLeft',
                        }}
                      />
                    )}
                    {overlayLevels?.avgBuyPrice && (
                      <ReferenceLine
                        y={overlayLevels.avgBuyPrice}
                        stroke="#1D4ED8"
                        strokeDasharray="3 3"
                        label={{
                          value: `Avg Cost ${formatINR(overlayLevels.avgBuyPrice)}`,
                          fill: '#1D4ED8',
                          fontSize: 11,
                          position: 'insideBottomLeft',
                        }}
                      />
                    )}
                    {overlayLevels?.stopLoss && (
                      <ReferenceLine
                        y={overlayLevels.stopLoss}
                        stroke="#DC2626"
                        strokeDasharray="4 4"
                        label={{
                          value: `Stop-Loss ${formatINR(overlayLevels.stopLoss)}`,
                          fill: '#B91C1C',
                          fontSize: 11,
                          position: 'insideBottomLeft',
                        }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Volume Histogram */}
            <div className="h-[90px] w-full mt-2 pt-2 border-t border-slate-100">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={candles} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="dateLabel" hide />
                  <YAxis
                    orientation="right"
                    tick={{ fontSize: 10, fill: '#94A3B8', fontFamily: 'JetBrains Mono' }}
                    tickFormatter={(v: number) => formatVolume(v)}
                    tickLine={false}
                    axisLine={false}
                    width={78}
                    tickCount={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: unknown) => [formatVolume(Number(val)), 'Volume']}
                  />
                  <Bar dataKey="volume" fill="#94A3B8" opacity={0.45} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Key Technical & Range Strip */}
            {quote && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 pt-5 mt-5 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">Day High / Low</div>
                  <div className="text-sm font-semibold font-mono-tabular text-slate-900 mt-0.5">
                    {formatINR(quote.dayHigh)} / {formatINR(quote.dayLow)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">52W Range</div>
                  <div className="text-xs font-mono-tabular text-slate-800 mt-1 flex items-center gap-2">
                    <span>{formatINR(quote.fiftyTwoWeekLow)}</span>
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden min-w-[40px]">
                      <div
                        className="h-full bg-blue-700"
                        style={{ width: `${fiftyTwoRangePct}%` }}
                      />
                    </div>
                    <span>{formatINR(quote.fiftyTwoWeekHigh)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">RSI (14)</div>
                  <div
                    className={`text-sm font-semibold font-mono-tabular mt-0.5 ${
                      (quote.rsi14 ?? 50) < 35
                        ? 'text-green-700'
                        : (quote.rsi14 ?? 50) > 70
                        ? 'text-red-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {quote.rsi14 !== null ? quote.rsi14.toFixed(1) : '—'}
                    <span className="text-xs font-normal text-slate-500 ml-1">
                      {quote.rsi14 === null
                        ? ''
                        : quote.rsi14 < 35
                        ? 'Oversold'
                        : quote.rsi14 > 70
                        ? 'Overbought'
                        : 'Neutral'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">50-DMA / 200-DMA</div>
                  <div className="text-sm font-semibold font-mono-tabular text-slate-900 mt-0.5">
                    {quote.sma50 ? formatINR(quote.sma50) : '—'} /{' '}
                    {quote.sma200 ? formatINR(quote.sma200) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Volume vs 20D Avg</div>
                  <div className="text-sm font-semibold font-mono-tabular text-slate-900 mt-0.5">
                    {formatVolume(quote.volume)}{' '}
                    <span className="text-xs text-slate-500">({quote.volumeRatio.toFixed(2)}x)</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">6M / 1Y Return</div>
                  <div className="text-sm font-semibold font-mono-tabular text-slate-900 mt-0.5">
                    <span className={(quote.return6M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {formatPercent(quote.return6M)}
                    </span>{' '}
                    /{' '}
                    <span className={(quote.return1Y ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {formatPercent(quote.return1Y)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
