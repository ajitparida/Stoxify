import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, LineChart, RefreshCw, RotateCcw, Search, Star } from 'lucide-react';
import type {
  Exchange,
  MarketQuote,
  PatternDiscoveryResponse,
  PatternId,
  ScreenerPreset,
} from '../types/market';
import { formatINR, formatPercent, formatVolume } from '../utils/portfolioAnalytics';
import { SortableTh } from './SortableTh';
import {
  ConfidenceBreakdownBar,
  EarningsRiskTag,
  getConfidenceScoreTone,
} from './ConfidenceBreakdownBar';
import { PatternDiscoveryHub } from './PatternDiscoveryHub';

interface ProScreenerViewProps {
  onInspectChart: (symbol: string) => void;
  onToggleWatchlist: (symbol: string, name: string, exchange: Exchange, sector: string) => void;
  isInWatchlist: (symbol: string) => boolean;
}

const PRESETS: Array<{ key: ScreenerPreset; label: string; hint: string }> = [
  { key: 'all', label: 'All NSE/BSE', hint: 'Full tracked liquid universe' },
  { key: 'golden_crossover', label: 'Golden Crossover', hint: '50-DMA > 200-DMA & Price > 50-DMA' },
  { key: 'volume_shockers', label: 'Volume Shockers', hint: 'Volume >= 1.3x 20-Day Average' },
  { key: 'multibagger_value', label: 'Multibagger Value', hint: 'ROCE >= 20% & Debt/Eq <= 0.5' },
  { key: 'oversold_rebound', label: 'Oversold RSI < 40', hint: 'Potential mean-reversion setups' },
  { key: 'top_gainers', label: 'Today Gainers', hint: 'Positive daily momentum leaders' },
];

type SortField =
  | 'ticker'
  | 'confidence'
  | 'price'
  | 'changePercent'
  | 'rsi14'
  | 'volumeRatio'
  | 'peRatio'
  | 'return6M';

export function ProScreenerView({
  onInspectChart,
  onToggleWatchlist,
  isInWatchlist,
}: ProScreenerViewProps) {
  const [stocks, setStocks] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [patternHub, setPatternHub] = useState<PatternDiscoveryResponse | null>(null);
  const [patternsLoading, setPatternsLoading] = useState(true);
  const [activePatternId, setActivePatternId] = useState<PatternId | null>(null);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const [preset, setPreset] = useState<ScreenerPreset>('all');
  const [searchText, setSearchText] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [capFilter, setCapFilter] = useState('All');
  const [rsiFilter, setRsiFilter] = useState<'All' | 'oversold' | 'neutral' | 'overbought'>('All');
  const [peFilter, setPeFilter] = useState<'All' | 'value' | 'moderate' | 'premium'>('All');
  const [confidenceFilter, setConfidenceFilter] = useState<'All' | 'high' | 'medium' | 'low'>('All');
  const [trendFilter, setTrendFilter] = useState<'All' | 'above_200' | 'below_200' | 'above_50'>('All');
  const [sortField, setSortField] = useState<SortField>('confidence');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchScreener = async (forceRefreshPatterns = false) => {
    setLoading(true);
    setPatternsLoading(true);
    setError(null);
    try {
      const [screenerRes, patternsRes] = await Promise.all([
        fetch('/api/market/screener'),
        fetch(`/api/market/patterns${forceRefreshPatterns ? '?refresh=1' : ''}`),
      ]);
      if (!screenerRes.ok) throw new Error('Failed to load live NSE/BSE screener universe.');
      const data = (await screenerRes.json()) as { stocks: MarketQuote[] };
      setStocks(data.stocks || []);

      if (patternsRes.ok) {
        const patData = (await patternsRes.json()) as PatternDiscoveryResponse;
        setPatternHub(patData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch screener data.');
    } finally {
      setLoading(false);
      setPatternsLoading(false);
    }
  };

  useEffect(() => {
    void fetchScreener(false);
  }, []);

  const sectors = useMemo(() => {
    const set = new Set(stocks.map((s) => s.sector));
    return ['All', ...Array.from(set).sort()];
  }, [stocks]);

  const capOptions = useMemo(() => {
    const set = new Set(stocks.map((s) => s.capCategory).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [stocks]);

  const hasActiveFilters =
    preset !== 'all' ||
    activePatternId !== null ||
    searchText.trim() !== '' ||
    sectorFilter !== 'All' ||
    capFilter !== 'All' ||
    rsiFilter !== 'All' ||
    peFilter !== 'All' ||
    confidenceFilter !== 'All' ||
    trendFilter !== 'All';

  const resetFilters = () => {
    setPreset('all');
    setActivePatternId(null);
    setSearchText('');
    setSectorFilter('All');
    setCapFilter('All');
    setRsiFilter('All');
    setPeFilter('All');
    setConfidenceFilter('All');
    setTrendFilter('All');
  };

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return stocks
      .filter((s) => {
        if (q && !s.ticker.toLowerCase().includes(q) && !s.shortName.toLowerCase().includes(q)) {
          return false;
        }
        if (sectorFilter !== 'All' && s.sector !== sectorFilter) return false;
        if (capFilter !== 'All' && s.capCategory !== capFilter) return false;
        if (
          activePatternId &&
          !(s.confidence?.matchedPatterns ?? []).includes(activePatternId)
        ) {
          return false;
        }

        if (rsiFilter !== 'All') {
          if (s.rsi14 === null) return false;
          if (rsiFilter === 'oversold' && s.rsi14 >= 40) return false;
          if (rsiFilter === 'neutral' && (s.rsi14 < 40 || s.rsi14 > 70)) return false;
          if (rsiFilter === 'overbought' && s.rsi14 <= 70) return false;
        }

        if (peFilter !== 'All') {
          if (s.peRatio === null || s.peRatio <= 0) return false;
          if (peFilter === 'value' && s.peRatio > 22) return false;
          if (peFilter === 'moderate' && (s.peRatio <= 22 || s.peRatio > 40)) return false;
          if (peFilter === 'premium' && s.peRatio <= 40) return false;
        }

        if (confidenceFilter !== 'All') {
          const score = s.confidence?.overallScore ?? null;
          if (score === null) return false;
          if (confidenceFilter === 'high' && score < 70) return false;
          if (confidenceFilter === 'medium' && (score < 55 || score >= 70)) return false;
          if (confidenceFilter === 'low' && score >= 55) return false;
        }

        if (trendFilter !== 'All') {
          if (trendFilter === 'above_200' && (!s.sma200 || s.price < s.sma200)) return false;
          if (trendFilter === 'below_200' && (!s.sma200 || s.price >= s.sma200)) return false;
          if (trendFilter === 'above_50' && (!s.sma50 || s.price < s.sma50)) return false;
        }

        switch (preset) {
          case 'golden_crossover':
            return Boolean(s.sma50 && s.sma200 && s.sma50 > s.sma200 && s.price >= s.sma50);
          case 'volume_shockers':
            return s.volumeRatio >= 1.3;
          case 'multibagger_value':
            return (s.roce ?? 0) >= 20 && (s.debtToEquity === null || s.debtToEquity <= 0.5);
          case 'oversold_rebound':
            return s.rsi14 !== null && s.rsi14 < 40;
          case 'top_gainers':
            return s.changePercent > 0;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        if (sortField === 'ticker') {
          const cmp = a.ticker.localeCompare(b.ticker);
          return sortDir === 'asc' ? cmp : -cmp;
        }
        if (sortField === 'confidence') {
          const av = a.confidence?.overallScore ?? -1;
          const bv = b.confidence?.overallScore ?? -1;
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        const av = a[sortField];
        const bv = b[sortField];
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
      });
  }, [
    stocks,
    searchText,
    sectorFilter,
    capFilter,
    activePatternId,
    rsiFilter,
    peFilter,
    confidenceFilter,
    trendFilter,
    preset,
    sortField,
    sortDir,
  ]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'ticker' ? 'asc' : 'desc');
    }
  };

  const activePresetHint = PRESETS.find((p) => p.key === preset)?.hint || '';

  return (
    <div className="space-y-5">
      {/* Illustrated 6-Pattern Discovery Hub with Walk-Forward 1M/3M Stats */}
      <PatternDiscoveryHub
        data={patternHub}
        loading={patternsLoading}
        activePatternId={activePatternId}
        onSelectPatternFilter={setActivePatternId}
        onInspectChart={onInspectChart}
        onToggleWatchlist={onToggleWatchlist}
        isInWatchlist={isInWatchlist}
      />

      {/* Preset Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Stoxify Pro Stock Screener</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activePresetHint} · Live Yahoo Finance fundamentals &amp; calibrated 4-pillar Confidence Score
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchScreener(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Universe
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          {PRESETS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPreset(item.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                preset === item.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search ticker or company..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            aria-label="Filter by sector"
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            {sectors.map((sec) => (
              <option key={sec} value={sec}>
                Sector: {sec}
              </option>
            ))}
          </select>

          <select
            value={capFilter}
            onChange={(e) => setCapFilter(e.target.value)}
            aria-label="Filter by market cap"
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            {capOptions.map((cap) => (
              <option key={cap} value={cap}>
                Cap: {cap}
              </option>
            ))}
          </select>

          <select
            value={rsiFilter}
            onChange={(e) =>
              setRsiFilter(e.target.value as 'All' | 'oversold' | 'neutral' | 'overbought')
            }
            aria-label="Filter by RSI zone"
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="All">RSI: All</option>
            <option value="oversold">Oversold (&lt; 40)</option>
            <option value="neutral">Neutral (40–70)</option>
            <option value="overbought">Overbought (&gt; 70)</option>
          </select>

          <select
            value={peFilter}
            onChange={(e) =>
              setPeFilter(e.target.value as 'All' | 'value' | 'moderate' | 'premium')
            }
            aria-label="Filter by P/E valuation"
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="All">P/E: All</option>
            <option value="value">Value (&le; 22x)</option>
            <option value="moderate">Moderate (22–40x)</option>
            <option value="premium">Premium (&gt; 40x)</option>
          </select>

          <select
            value={confidenceFilter}
            onChange={(e) =>
              setConfidenceFilter(e.target.value as 'All' | 'high' | 'medium' | 'low')
            }
            aria-label="Filter by confidence score tier"
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="All">Confidence: All</option>
            <option value="high">High (&ge; 70%)</option>
            <option value="medium">Medium (55–70%)</option>
            <option value="low">Low (&lt; 55%)</option>
          </select>

          <select
            value={trendFilter}
            onChange={(e) =>
              setTrendFilter(e.target.value as 'All' | 'above_200' | 'below_200' | 'above_50')
            }
            aria-label="Filter by DMA trend"
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="All">Trend: All</option>
            <option value="above_200">Above 200-DMA</option>
            <option value="below_200">Below 200-DMA</option>
            <option value="above_50">Above 50-DMA</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}

          <div className="text-xs text-slate-500 ml-auto font-mono-tabular">
            Showing {filtered.length} of {stocks.length}
          </div>
        </div>
      </div>

      {/* Screener Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {error ? (
          <div className="py-12 text-center text-xs text-red-700 font-medium">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <SortableTh
                    label="Ticker · Sector"
                    sortKey="ticker"
                    activeKey={sortField}
                    direction={sortDir}
                    className="px-4"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Confidence"
                    sortKey="confidence"
                    activeKey={sortField}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="LTP"
                    sortKey="price"
                    activeKey={sortField}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="1D Chg"
                    sortKey="changePercent"
                    activeKey={sortField}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="RSI (14)"
                    sortKey="rsi14"
                    activeKey={sortField}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <th className="py-2.5 px-3 text-right">50 / 200 DMA</th>
                  <SortableTh
                    label="Vol Ratio"
                    sortKey="volumeRatio"
                    activeKey={sortField}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Live P/E · ROE"
                    sortKey="peRatio"
                    activeKey={sortField}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="6M Ret"
                    sortKey="return6M"
                    activeKey={sortField}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading && stocks.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="h-11 animate-pulse">
                      <td colSpan={10} className="px-4 py-2 bg-slate-50/40" />
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 px-4 text-center space-y-2">
                      <div className="text-slate-600 font-medium">
                        No stocks match the selected technical, pattern, or fundamental filters.
                      </div>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s, idx) => {
                    const pos = s.changePercent >= 0;
                    const bullishDma = s.sma50 && s.sma200 && s.sma50 > s.sma200;
                    const isExpanded = expandedSymbol === s.symbol;
                    const confScore = s.confidence?.overallScore ?? null;
                    const returnQuality = s.roePct ?? s.roce;

                    return (
                      <Fragment key={`${s.symbol}_${idx}`}>
                        <tr
                          onClick={() => onInspectChart(s.symbol)}
                          className="hover:bg-slate-50 cursor-pointer"
                        >
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900">{s.ticker}</span>
                              <EarningsRiskTag
                                nextEarningsDate={s.nextEarningsDate}
                                daysToEarnings={s.daysToEarnings}
                                earningsRiskFlag={s.earningsRiskFlag}
                                compact
                              />
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[210px]">
                              {s.exchange} · {s.sector} · {s.capCategory}
                            </div>
                          </td>
                          <td
                            className="py-2.5 px-3 text-right"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSymbol(isExpanded ? null : s.symbol);
                            }}
                          >
                            {confScore !== null ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-right hover:underline"
                                title="Click to inspect 4-pillar Confidence breakdown"
                              >
                                <span
                                  className={`font-mono-tabular font-bold ${getConfidenceScoreTone(
                                    confScore
                                  )}`}
                                >
                                  {confScore.toFixed(1)}%
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                            {formatINR(s.price)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                              pos ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {formatPercent(s.changePercent)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono-tabular ${
                              (s.rsi14 ?? 50) < 38
                                ? 'text-green-700 font-semibold'
                                : (s.rsi14 ?? 50) > 70
                                ? 'text-red-700 font-semibold'
                                : 'text-slate-700'
                            }`}
                          >
                            {s.rsi14 !== null ? s.rsi14.toFixed(1) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular">
                            <span
                              className={bullishDma ? 'text-green-700 font-medium' : 'text-slate-600'}
                            >
                              {bullishDma ? 'Golden' : 'Neutral'}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {s.sma50 ? `₹${Math.round(s.sma50)}` : '—'} /{' '}
                              {s.sma200 ? `₹${Math.round(s.sma200)}` : '—'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular">
                            <span
                              className={
                                s.volumeRatio >= 1.3
                                  ? 'text-blue-700 font-semibold'
                                  : 'text-slate-700'
                              }
                            >
                              {s.volumeRatio.toFixed(2)}x
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {formatVolume(s.volume)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            <div>
                              {s.peRatio ? `${s.peRatio.toFixed(1)}x` : '—'}
                              {s.fundamentalsSource === 'live_yahoo' && (
                                <span
                                  className="text-[9px] text-emerald-700 ml-1 font-sans font-semibold"
                                  title="Live Yahoo Finance fundamentals"
                                >
                                  LIVE
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {s.roePct !== null && s.roePct !== undefined ? 'ROE' : 'ROCE'}{' '}
                              {returnQuality !== null ? `${returnQuality.toFixed(1)}%` : '—'}
                            </div>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                              (s.return6M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {formatPercent(s.return6M)}
                          </td>
                          <td
                            className="py-2.5 px-4 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onInspectChart(s.symbol)}
                                className="p-1.5 text-slate-500 hover:text-blue-700 rounded hover:bg-blue-50"
                                title="Open chart"
                              >
                                <LineChart className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onToggleWatchlist(
                                    s.symbol,
                                    s.shortName,
                                    s.exchange === 'BSE' ? 'BSE' : 'NSE',
                                    s.sector
                                  )
                                }
                                className="p-1.5 text-slate-500 hover:text-amber-600 rounded hover:bg-amber-50"
                                title="Toggle watchlist"
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    isInWatchlist(s.symbol)
                                      ? 'fill-amber-500 text-amber-500'
                                      : ''
                                  }`}
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && s.confidence && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={10} className="px-5 py-4 space-y-3">
                              <ConfidenceBreakdownBar
                                confidence={s.confidence}
                                variant="expanded"
                              />
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 pt-2 border-t border-slate-200 text-[11px] font-mono-tabular text-slate-600">
                                <span>
                                  Fwd P/E:{' '}
                                  <strong className="text-slate-900">
                                    {s.forwardPE ? `${s.forwardPE.toFixed(1)}x` : '—'}
                                  </strong>
                                </span>
                                <span>
                                  Rev Growth:{' '}
                                  <strong className="text-slate-900">
                                    {s.revenueGrowthPct !== null && s.revenueGrowthPct !== undefined
                                      ? formatPercent(s.revenueGrowthPct)
                                      : '—'}
                                  </strong>
                                </span>
                                <span>
                                  EPS Growth:{' '}
                                  <strong className="text-slate-900">
                                    {s.earningsGrowthPct !== null &&
                                    s.earningsGrowthPct !== undefined
                                      ? formatPercent(s.earningsGrowthPct)
                                      : '—'}
                                  </strong>
                                </span>
                                <span>
                                  D/E:{' '}
                                  <strong className="text-slate-900">
                                    {s.debtToEquity !== null ? `${s.debtToEquity.toFixed(2)}x` : '—'}
                                  </strong>
                                </span>
                                {s.nextEarningsDate && (
                                  <EarningsRiskTag
                                    nextEarningsDate={s.nextEarningsDate}
                                    daysToEarnings={s.daysToEarnings}
                                    earningsRiskFlag={s.earningsRiskFlag}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
