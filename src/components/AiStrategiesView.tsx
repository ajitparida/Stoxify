import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  LineChart as LineChartIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Star,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SortableTh } from './SortableTh';
import type {
  AiStrategiesResponse,
  AiStrategyBasket,
  Exchange,
  StrategyConstituent,
} from '../types/market';
import { formatINR, formatPercent } from '../utils/portfolioAnalytics';

type StrategySortKey =
  | 'ticker'
  | 'price'
  | 'peRatio'
  | 'roce'
  | 'rsi14'
  | 'return6M'
  | 'weightPercent'
  | 'factorScore';

interface AiStrategiesViewProps {
  onInspectChart: (symbol: string) => void;
  onToggleWatchlist: (
    symbol: string,
    companyName: string,
    exchange: Exchange,
    sector: string
  ) => void;
  isInWatchlist: (symbol: string) => boolean;
  onStageBuy: (constituent: StrategyConstituent, strategyName: string) => void;
}

export function AiStrategiesView({
  onInspectChart,
  onToggleWatchlist,
  isInWatchlist,
  onStageBuy,
}: AiStrategiesViewProps) {
  const [data, setData] = useState<AiStrategiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('bharat_momentum');
  const [chartHorizon, setChartHorizon] = useState<'6m' | '1y'>('1y');

  // Constituent Table Filters & Sort
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [capFilter, setCapFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState<StrategySortKey>('factorScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/strategies');
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Failed to load AI strategy baskets.');
      }
      const json = (await res.json()) as AiStrategiesResponse;
      setData(json);
      if (json.strategies.length > 0) {
        setSelectedStrategyId((prev) =>
          json.strategies.some((s) => s.id === prev) ? prev : json.strategies[0].id
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI stock strategies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStrategies();
  }, [fetchStrategies]);

  const activeStrategy: AiStrategyBasket | null = useMemo(() => {
    if (!data || data.strategies.length === 0) return null;
    return (
      data.strategies.find((s) => s.id === selectedStrategyId) ?? data.strategies[0]
    );
  }, [data, selectedStrategyId]);

  // Reset constituent filters when switching strategy basket
  useEffect(() => {
    setSearch('');
    setSectorFilter('ALL');
    setCapFilter('ALL');
  }, [selectedStrategyId]);

  const normalizedChartPoints = useMemo(() => {
    if (!activeStrategy || activeStrategy.chartSeries.length === 0) return [];
    const series = activeStrategy.chartSeries;
    const windowSlice =
      chartHorizon === '6m' && series.length > 126
        ? series.slice(series.length - 126)
        : series;
    const baseStrat = windowSlice[0]?.strategyIndexed || 100;
    const baseNifty = windowSlice[0]?.niftyIndexed || 100;

    return windowSlice.map((pt) => ({
      dateLabel: pt.dateLabel,
      strategyIndexed: Number(((pt.strategyIndexed / baseStrat) * 100).toFixed(2)),
      niftyIndexed: Number(((pt.niftyIndexed / baseNifty) * 100).toFixed(2)),
    }));
  }, [activeStrategy, chartHorizon]);

  const activeSectors = useMemo(() => {
    if (!activeStrategy) return [];
    return Array.from(new Set(activeStrategy.constituents.map((c) => c.sector))).sort();
  }, [activeStrategy]);

  const handleSort = (key: StrategySortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ticker' || key === 'peRatio' ? 'asc' : 'desc');
    }
  };

  const filteredConstituents = useMemo(() => {
    if (!activeStrategy) return [];
    const q = search.trim().toLowerCase();
    const list = activeStrategy.constituents.filter((item) => {
      const matchesSearch =
        !q ||
        item.ticker.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q);
      const matchesSector = sectorFilter === 'ALL' || item.sector === sectorFilter;
      const matchesCap = capFilter === 'ALL' || item.capCategory === capFilter;
      return matchesSearch && matchesSector && matchesCap;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'ticker') return a.ticker.localeCompare(b.ticker) * dir;
      const fallback = sortDir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      const getVal = (c: StrategyConstituent) => {
        switch (sortKey) {
          case 'price':
            return c.price;
          case 'peRatio':
            return c.peRatio ?? fallback;
          case 'roce':
            return c.roce ?? fallback;
          case 'rsi14':
            return c.rsi14 ?? fallback;
          case 'return6M':
            return c.return6M ?? fallback;
          case 'weightPercent':
            return c.weightPercent;
          case 'factorScore':
            return c.factorScore;
        }
      };
      return (getVal(a) - getVal(b)) * dir;
    });
  }, [activeStrategy, search, sectorFilter, capFilter, sortKey, sortDir]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-[340px] bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 text-center space-y-3">
        <ShieldAlert className="w-7 h-7 text-red-700 mx-auto" />
        <div className="text-sm font-bold text-slate-900">
          Unable to Load AI Strategy Baskets
        </div>
        <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
        <button
          type="button"
          onClick={() => void fetchStrategies()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry Live Fetch
        </button>
      </div>
    );
  }

  const strategies = data?.strategies ?? [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-700 shrink-0" />
            <h2 className="text-base font-bold text-slate-900">
              AI Quantitative Stock Strategies — NSE Model Baskets
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Systematic factor baskets constructed from live NSE valuation, ROCE, 50/200-DMA, and RSI-14 telemetry, benchmarked daily against Nifty 50.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {data?.niftyBenchmark && (
            <div className="text-right hidden md:block">
              <div className="text-[11px] text-slate-500">Nifty 50 Benchmark</div>
              <div className="text-xs font-bold font-mono-tabular text-slate-900">
                {data.niftyBenchmark.price.toLocaleString('en-IN')}{' '}
                <span
                  className={
                    (data.niftyBenchmark.return6M ?? 0) >= 0
                      ? 'text-green-700'
                      : 'text-red-700'
                  }
                >
                  ({formatPercent(data.niftyBenchmark.return6M)} 6M)
                </span>
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchStrategies()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh Baskets'}
          </button>
        </div>
      </div>

      {/* 4 Strategy Basket Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {strategies.map((basket) => {
          const active = activeStrategy?.id === basket.id;
          const riskClasses =
            basket.riskProfile === 'Low'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : basket.riskProfile === 'Aggressive'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-blue-200 bg-blue-50 text-blue-800';

          return (
            <button
              key={basket.id}
              type="button"
              onClick={() => setSelectedStrategyId(basket.id)}
              className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                active
                  ? 'bg-white border-blue-700 ring-1 ring-blue-700/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold border rounded-md ${riskClasses}`}
                  >
                    {basket.riskProfile}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono-tabular">
                    {basket.constituents.length} stocks
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{basket.name}</div>
                <p className="text-xs text-slate-500 line-clamp-2">{basket.tagline}</p>
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono-tabular">
                <div>
                  <div className="text-[10px] text-slate-400">1Y Return</div>
                  <div
                    className={`font-bold ${
                      (basket.return1Y ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {formatPercent(basket.return1Y)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Alpha vs Nifty</div>
                  <div
                    className={`font-bold ${
                      (basket.alpha1Y ?? 0) >= 0 ? 'text-blue-700' : 'text-red-700'
                    }`}
                  >
                    {formatPercent(basket.alpha1Y)}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeStrategy && (
        <>
          {/* Selected Strategy KPI Strip + Methodology */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="text-xs text-slate-500">
                  {activeStrategy.rebalanceCadence}
                  <span className="mx-1.5">·</span>
                  <span>{activeStrategy.riskProfile} Risk Mandate</span>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono-tabular">
                    Equal-weight ({activeStrategy.constituents[0]?.weightPercent ?? 12.5}% target/stock)
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {activeStrategy.name}
                </h3>
              </div>
              <div className="text-xs text-slate-600 max-w-xl leading-relaxed">
                {activeStrategy.methodology}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">6-Month Basket Return</div>
                <div
                  className={`text-xl font-bold font-mono-tabular mt-1 ${
                    (activeStrategy.return6M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {formatPercent(activeStrategy.return6M)}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                  Alpha {formatPercent(activeStrategy.alpha6M)} vs Nifty ({formatPercent(activeStrategy.nifty6M)})
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">1-Year Basket Return</div>
                <div
                  className={`text-xl font-bold font-mono-tabular mt-1 ${
                    (activeStrategy.return1Y ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {formatPercent(activeStrategy.return1Y)}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                  Alpha {formatPercent(activeStrategy.alpha1Y)} vs Nifty ({formatPercent(activeStrategy.nifty1Y)})
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">1-Month Short Momentum</div>
                <div
                  className={`text-xl font-bold font-mono-tabular mt-1 ${
                    (activeStrategy.return1M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {formatPercent(activeStrategy.return1M)}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                  Nifty 1M: {formatPercent(activeStrategy.nifty1M)}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Portfolio Fundamental Profile</div>
                <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
                  {activeStrategy.avgRoce !== null ? `${activeStrategy.avgRoce.toFixed(1)}% ROCE` : '—'}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                  Avg P/E:{' '}
                  {activeStrategy.avgPe !== null ? `${activeStrategy.avgPe.toFixed(1)}x` : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Benchmark Chart + Monthly Rotation Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Indexed Performance vs Nifty 50 (Base 100)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Equal-weighted constituent basket tracked daily against live ^NSEI closes
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 shrink-0">
                  {(['6m', '1y'] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setChartHorizon(h)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        chartHorizon === h
                          ? 'bg-white text-blue-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {h.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {normalizedChartPoints.length === 0 ? (
                <div className="h-[270px] flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  Historical benchmark curve unavailable for this basket.
                </div>
              ) : (
                <div className="h-[270px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={normalizedChartPoints}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        minTickGap={28}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        width={46}
                      />
                      <ReferenceLine y={100} stroke="#CBD5E1" strokeDasharray="2 2" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(val: unknown, name: unknown) => [
                          `${Number(val).toFixed(2)}`,
                          name === 'strategyIndexed' ? activeStrategy.name : 'Nifty 50 (^NSEI)',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="strategyIndexed"
                        stroke="#1D4ED8"
                        strokeWidth={2.2}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="niftyIndexed"
                        stroke="#64748B"
                        strokeWidth={1.75}
                        strokeDasharray="4 4"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="flex items-center gap-5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-blue-700 inline-block" />
                  <span className="font-semibold text-slate-800">{activeStrategy.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-500 inline-block" />
                  <span>Nifty 50 (^NSEI)</span>
                </div>
              </div>
            </div>

            {/* Recent Monthly Rotation Ledger */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Recent Rebalance Rotation Log
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trims stretched profits and rotates fresh weight into higher-score setups
                  </p>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {activeStrategy.recentRotations.map((rot, idx) => {
                    const isIn = rot.action === 'ROTATE_IN';
                    return (
                      <button
                        key={`${rot.symbol}_${rot.action}_${idx}`}
                        type="button"
                        onClick={() => onInspectChart(rot.symbol)}
                        className="w-full p-3 text-left hover:bg-slate-50 transition-colors flex items-start justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold border rounded ${
                                isIn
                                  ? 'bg-green-50 text-green-800 border-green-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {isIn ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {isIn ? 'ROTATE IN' : 'BOOKED OUT'}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {rot.ticker}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {rot.companyName} · {rot.sector}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                            {rot.reason}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono-tabular font-semibold text-slate-700 shrink-0">
                          {rot.returnTag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                Click any rotated ticker to open its live candlestick chart &amp; AI Outlook.
              </p>
            </div>
          </div>

          {/* Filter Toolbar + Constituents Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Strategy Constituents ({filteredConstituents.length} of{' '}
                  {activeStrategy.constituents.length})
                </h4>
                <p className="text-xs text-slate-500">
                  Equal-weighted model constituents ranked by quantitative factor score
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter ticker or sector..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 w-44"
                  />
                </div>

                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Sectors</option>
                  {activeSectors.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>

                <select
                  value={capFilter}
                  onChange={(e) => setCapFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Caps</option>
                  <option value="Large Cap">Large Cap</option>
                  <option value="Mid Cap">Mid Cap</option>
                  <option value="Small Cap">Small Cap</option>
                </select>

                {(search || sectorFilter !== 'ALL' || capFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSectorFilter('ALL');
                      setCapFilter('ALL');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px]">
                    <SortableTh
                      label="Stock"
                      sortKey="ticker"
                      activeKey={sortKey}
                      direction={sortDir}
                      onSort={handleSort}
                    />
                    <th className="py-2.5 px-3 font-semibold text-slate-600">Sector · Cap</th>
                    <SortableTh
                      label="LTP"
                      sortKey="price"
                      activeKey={sortKey}
                      direction={sortDir}
                      align="right"
                      onSort={handleSort}
                    />
                    <SortableTh
                      label="P/E"
                      sortKey="peRatio"
                      activeKey={sortKey}
                      direction={sortDir}
                      align="right"
                      onSort={handleSort}
                    />
                    <SortableTh
                      label="ROCE"
                      sortKey="roce"
                      activeKey={sortKey}
                      direction={sortDir}
                      align="right"
                      onSort={handleSort}
                    />
                    <SortableTh
                      label="RSI (14)"
                      sortKey="rsi14"
                      activeKey={sortKey}
                      direction={sortDir}
                      align="right"
                      onSort={handleSort}
                    />
                    <SortableTh
                      label="6M Return"
                      sortKey="return6M"
                      activeKey={sortKey}
                      direction={sortDir}
                      align="right"
                      onSort={handleSort}
                    />
                    <SortableTh
                      label="Weight"
                      sortKey="weightPercent"
                      activeKey={sortKey}
                      direction={sortDir}
                      align="right"
                      onSort={handleSort}
                    />
                    <SortableTh
                      label="Factor"
                      sortKey="factorScore"
                      activeKey={sortKey}
                      direction={sortDir}
                      align="right"
                      onSort={handleSort}
                    />
                    <th className="py-2.5 px-4 text-right font-semibold text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredConstituents.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-xs text-slate-500">
                        No constituents match your current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredConstituents.map((item) => {
                      const inWatch = isInWatchlist(item.symbol);
                      return (
                        <tr key={item.symbol} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">{item.ticker}</div>
                            <div className="text-[11px] text-slate-500 max-w-[200px] truncate">
                              {item.name}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-slate-800">{item.sector}</div>
                            <div className="text-[11px] text-slate-500">{item.capCategory}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                            <div>{formatINR(item.price)}</div>
                            <div
                              className={`text-[11px] ${
                                item.changePercent >= 0 ? 'text-green-700' : 'text-red-700'
                              }`}
                            >
                              {formatPercent(item.changePercent)}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-tabular text-slate-700">
                            {item.peRatio !== null ? `${item.peRatio.toFixed(1)}x` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-tabular text-slate-700">
                            {item.roce !== null ? `${item.roce.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-tabular text-slate-700">
                            {item.rsi14 !== null ? item.rsi14.toFixed(1) : '—'}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-mono-tabular font-semibold ${
                              (item.return6M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {formatPercent(item.return6M)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-tabular text-slate-700">
                            {item.weightPercent.toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono-tabular font-bold text-blue-800">
                            {item.factorScore}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onInspectChart(item.symbol)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap shrink-0"
                                title="Open Live Chart & AI Outlook"
                              >
                                <LineChartIcon className="w-3 h-3 text-blue-700" /> Chart
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onToggleWatchlist(
                                    item.symbol,
                                    item.name,
                                    item.exchange,
                                    item.sector
                                  )
                                }
                                className={`p-1.5 border rounded transition-colors shrink-0 ${
                                  inWatch
                                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                                    : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
                                }`}
                                title={inWatch ? 'Remove from Watchlist' : 'Add to Watchlist'}
                              >
                                <Star className={`w-3.5 h-3.5 ${inWatch ? 'fill-amber-500' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onStageBuy(item, activeStrategy.name)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-blue-700 rounded hover:bg-blue-800 whitespace-nowrap shrink-0"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
