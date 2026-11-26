import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Download,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EnrichedHolding, HoldingAiRating, HoldingRecord } from '../types/market';
import {
  formatINR,
  formatPercent,
  type PortfolioDiagnosticsSummary,
} from '../utils/portfolioAnalytics';
import { SortableTh } from './SortableTh';

interface PortfolioViewProps {
  holdings: EnrichedHolding[];
  diagnostics: PortfolioDiagnosticsSummary;
  loadingQuotes: boolean;
  isGuestMode: boolean;
  aiRatings?: HoldingAiRating[];
  busyAction?: boolean;
  onAddHolding: () => void;
  onUploadScreenshot: () => void;
  onEditHolding: (holding: HoldingRecord) => void;
  onDeleteHolding: (holdingId: string) => void;
  onInspectChart: (symbol: string, avgBuyPrice?: number) => void;
  onOpenDiagnostics: () => void;
  onRunAiAudit: () => void;
  onPreloadDemo: () => void;
  onClearAll: () => void;
  onRefreshQuotes?: () => void;
}

type EquitySortKey =
  | 'symbol'
  | 'quantity'
  | 'avgBuyPrice'
  | 'livePrice'
  | 'currentValue'
  | 'totalPnl'
  | 'dayGainPercent'
  | 'dividendYield'
  | 'healthStatus';

const HEALTH_RANK: Record<EnrichedHolding['healthStatus'], number> = {
  Healthy: 3,
  Watch: 2,
  'Dead Stock': 1,
};

export function PortfolioView({
  holdings,
  diagnostics,
  loadingQuotes,
  isGuestMode,
  aiRatings = [],
  busyAction = false,
  onAddHolding,
  onUploadScreenshot,
  onEditHolding,
  onDeleteHolding,
  onInspectChart,
  onOpenDiagnostics,
  onRunAiAudit,
  onPreloadDemo,
  onClearAll,
  onRefreshQuotes,
}: PortfolioViewProps) {
  const [subTab, setSubTab] = useState<'holdings' | 'dividends'>('holdings');
  const [filterText, setFilterText] = useState('');
  const [healthFilter, setHealthFilter] = useState<'All' | 'Healthy' | 'Watch' | 'Dead Stock'>('All');
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [exchangeFilter, setExchangeFilter] = useState<'All' | 'NSE' | 'BSE'>('All');
  const [pnlFilter, setPnlFilter] = useState<'All' | 'gainers' | 'losers'>('All');
  const [dayMoveFilter, setDayMoveFilter] = useState<'All' | 'up' | 'down'>('All');
  const [dividendFilter, setDividendFilter] = useState<'All' | 'payers' | 'non_payers'>('All');
  const [priceFeedFilter, setPriceFeedFilter] = useState<'All' | 'live' | 'fallback'>('All');
  const [aiVerdictFilter, setAiVerdictFilter] = useState<'All' | 'BUY' | 'HOLD' | 'EXIT'>('All');
  const [sortKey, setSortKey] = useState<EquitySortKey>('currentValue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Dividend table filters & sort
  const [divSearch, setDivSearch] = useState('');
  const [divSectorFilter, setDivSectorFilter] = useState('All');
  const [divYieldFilter, setDivYieldFilter] = useState<'All' | '1' | '2' | '4'>('All');
  const [divSortKey, setDivSortKey] = useState<
    'symbol' | 'annualDividendPerShare' | 'dividendYield' | 'yieldOnCost' | 'expectedAnnualDividend'
  >('expectedAnnualDividend');
  const [divSortDir, setDivSortDir] = useState<'asc' | 'desc'>('desc');

  const aiRatingMap = useMemo(
    () => new Map(aiRatings.map((r) => [r.symbol.toUpperCase(), r])),
    [aiRatings]
  );

  const sectorOptions = useMemo(() => {
    const set = new Set(holdings.map((h) => h.sector).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [holdings]);

  const divSectorOptions = useMemo(() => {
    const set = new Set(diagnostics.dividendPayers.map((h) => h.sector).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [diagnostics.dividendPayers]);

  const hasActiveFilters =
    filterText.trim() !== '' ||
    healthFilter !== 'All' ||
    sectorFilter !== 'All' ||
    exchangeFilter !== 'All' ||
    pnlFilter !== 'All' ||
    dayMoveFilter !== 'All' ||
    dividendFilter !== 'All' ||
    priceFeedFilter !== 'All' ||
    aiVerdictFilter !== 'All';

  const resetFilters = () => {
    setFilterText('');
    setHealthFilter('All');
    setSectorFilter('All');
    setExchangeFilter('All');
    setPnlFilter('All');
    setDayMoveFilter('All');
    setDividendFilter('All');
    setPriceFeedFilter('All');
    setAiVerdictFilter('All');
  };

  const hasActiveDivFilters =
    divSearch.trim() !== '' || divSectorFilter !== 'All' || divYieldFilter !== 'All';

  const resetDivFilters = () => {
    setDivSearch('');
    setDivSectorFilter('All');
    setDivYieldFilter('All');
  };

  const toggleSort = (key: EquitySortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  };

  const toggleDivSort = (
    key: 'symbol' | 'annualDividendPerShare' | 'dividendYield' | 'yieldOnCost' | 'expectedAnnualDividend'
  ) => {
    if (divSortKey === key) {
      setDivSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setDivSortKey(key);
      setDivSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  };

  const filteredHoldings = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const matched = holdings.filter((h) => {
      if (healthFilter !== 'All' && h.healthStatus !== healthFilter) return false;
      if (sectorFilter !== 'All' && h.sector !== sectorFilter) return false;
      if (exchangeFilter !== 'All' && h.exchange !== exchangeFilter) return false;
      if (pnlFilter === 'gainers' && h.totalPnl < 0) return false;
      if (pnlFilter === 'losers' && h.totalPnl >= 0) return false;
      if (dayMoveFilter === 'up' && h.dayGainPercent < 0) return false;
      if (dayMoveFilter === 'down' && h.dayGainPercent >= 0) return false;
      if (dividendFilter === 'payers' && h.dividendYield <= 0) return false;
      if (dividendFilter === 'non_payers' && h.dividendYield > 0) return false;
      if (priceFeedFilter === 'live' && !h.hasLiveQuote) return false;
      if (priceFeedFilter === 'fallback' && h.hasLiveQuote) return false;
      if (aiVerdictFilter !== 'All') {
        const rating = aiRatingMap.get(h.symbol.toUpperCase())?.rating;
        if (rating !== aiVerdictFilter) return false;
      }
      if (!q) return true;
      return (
        h.symbol.toLowerCase().includes(q) ||
        h.companyName.toLowerCase().includes(q) ||
        h.sector.toLowerCase().includes(q)
      );
    });

    return [...matched].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'symbol':
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case 'healthStatus':
          cmp = HEALTH_RANK[a.healthStatus] - HEALTH_RANK[b.healthStatus];
          break;
        default:
          cmp = Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    holdings,
    filterText,
    healthFilter,
    sectorFilter,
    exchangeFilter,
    pnlFilter,
    dayMoveFilter,
    dividendFilter,
    priceFeedFilter,
    aiVerdictFilter,
    aiRatingMap,
    sortKey,
    sortDir,
  ]);

  const filteredDividendPayers = useMemo(() => {
    const q = divSearch.trim().toLowerCase();
    const minYield = divYieldFilter === 'All' ? 0 : Number(divYieldFilter);
    const matched = diagnostics.dividendPayers.filter((item) => {
      if (divSectorFilter !== 'All' && item.sector !== divSectorFilter) return false;
      if (minYield > 0 && item.dividendYield < minYield) return false;
      if (!q) return true;
      return (
        item.symbol.toLowerCase().includes(q) ||
        item.companyName.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q)
      );
    });

    return [...matched].sort((a, b) => {
      if (divSortKey === 'symbol') {
        const cmp = a.symbol.localeCompare(b.symbol);
        return divSortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = Number(a[divSortKey] ?? 0) - Number(b[divSortKey] ?? 0);
      return divSortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    diagnostics.dividendPayers,
    divSearch,
    divSectorFilter,
    divYieldFilter,
    divSortKey,
    divSortDir,
  ]);

  const handleExportCsv = () => {
    const headers = [
      'Symbol',
      'Company',
      'Exchange',
      'Sector',
      'Qty',
      'AvgBuyPrice',
      'LiveLTP',
      'InvestedValue',
      'CurrentValue',
      'UnrealizedPnL',
      'PnLPercent',
      'DividendYieldPercent',
      'ExpectedAnnualDividendINR',
      'HealthStatus',
    ];
    const csvRows = [
      headers.join(','),
      ...holdings.map((h) =>
        [
          h.symbol,
          `"${h.companyName.replace(/"/g, '""')}"`,
          h.exchange,
          `"${h.sector}"`,
          h.quantity,
          h.avgBuyPrice,
          h.livePrice,
          h.investedValue.toFixed(2),
          h.currentValue.toFixed(2),
          h.totalPnl.toFixed(2),
          h.totalPnlPercent.toFixed(2),
          h.dividendYield.toFixed(2),
          h.expectedAnnualDividend.toFixed(2),
          h.healthStatus,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stoxify-holdings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPnlPositive = diagnostics.totalPnl >= 0;
  const dayPositive = diagnostics.dayGain >= 0;

  return (
    <div className="space-y-6">
      {/* Guest Mode Notice (only when holdings exist) */}
      {isGuestMode && holdings.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3.5">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Guest Session Active</span>
            <span className="mx-2 text-slate-300">·</span>
            P&amp;L and health diagnostics update against live NSE/BSE quotes. Sign in with Google to save permanently across sessions.
          </div>
          <button
            type="button"
            onClick={onUploadScreenshot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV / Screenshot
          </button>
        </div>
      )}

      {/* Live Quote Coverage Alert when any holding falls back to imported Avg Cost */}
      {!loadingQuotes && diagnostics.missingQuoteSymbols.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                {diagnostics.missingQuoteSymbols.length}{' '}
                {diagnostics.missingQuoteSymbols.length === 1 ? 'holding is' : 'holdings are'} using
                imported Avg Cost (live NSE/BSE quote unavailable):{' '}
              </span>
              <span className="font-mono-tabular text-amber-900">
                {diagnostics.missingQuoteSymbols.slice(0, 6).join(', ')}
                {diagnostics.missingQuoteSymbols.length > 6
                  ? ` +${diagnostics.missingQuoteSymbols.length - 6} more`
                  : ''}
              </span>
              . Click Refresh Live Prices or edit the symbol suffix (.NS / .BO) to sync live value.
            </div>
          </div>
          {onRefreshQuotes && (
            <button
              type="button"
              onClick={onRefreshQuotes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-950 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Live Prices
            </button>
          )}
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Current Portfolio Value</div>
            {onRefreshQuotes && holdings.length > 0 && (
              <button
                type="button"
                onClick={onRefreshQuotes}
                disabled={loadingQuotes}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline disabled:opacity-50 whitespace-nowrap shrink-0"
                title="Fetch latest live NSE/BSE prices"
              >
                <RefreshCw className={`w-3 h-3 ${loadingQuotes ? 'animate-spin' : ''}`} />
                Live Sync
              </button>
            )}
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
            {formatINR(diagnostics.totalCurrent)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            {diagnostics.liveQuotedCount}/{holdings.length} live quoted · Beta{' '}
            {diagnostics.weightedBeta.toFixed(2)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Invested Capital</div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
            {formatINR(diagnostics.totalInvested)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            Est. XIRR:{' '}
            <span
              className={`font-semibold ${
                (diagnostics.xirr ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {diagnostics.xirr !== null ? formatPercent(diagnostics.xirr) : '—'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Net Unrealized P&L</div>
          <div
            className={`text-2xl font-bold font-mono-tabular mt-1.5 ${
              totalPnlPositive ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {totalPnlPositive ? '+' : ''}
            {formatINR(diagnostics.totalPnl)}
          </div>
          <div
            className={`inline-flex items-center gap-1 text-xs font-semibold font-mono-tabular mt-1 ${
              totalPnlPositive ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {totalPnlPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {formatPercent(diagnostics.totalPnlPercent)} overall return
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Day&apos;s Gain / Health Flags</div>
          <div
            className={`text-2xl font-bold font-mono-tabular mt-1.5 ${
              dayPositive ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {dayPositive ? '+' : ''}
            {formatINR(diagnostics.dayGain)}
          </div>
          <div className="flex items-center justify-between gap-2 mt-1 text-xs">
            <span
              className={`font-semibold font-mono-tabular ${
                dayPositive ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {formatPercent(diagnostics.dayGainPercent)} today
            </span>
            {diagnostics.deadStocks.length > 0 && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="text-red-700 font-medium hover:underline"
              >
                {diagnostics.deadStocks.length} dead-stock alert
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Focused Sub-Tab Navigation (Holdings | Dividends) */}
      {holdings.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setSubTab('holdings')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'holdings'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Holdings ({holdings.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('dividends')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'dividends'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dividends ({formatINR(diagnostics.totalExpectedAnnualDividends, true)}/yr)
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 text-left sm:text-right"
          >
            Sector Allocation &amp; AI Audit →
          </button>
        </div>
      )}

      {/* Holdings Table & Controls */}
      {(subTab === 'holdings' || holdings.length === 0) && (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Search symbol, name, sector..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['All', 'Healthy', 'Watch', 'Dead Stock'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setHealthFilter(status)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      healthFilter === status
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {holdings.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  disabled={busyAction}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All
                </button>
              )}
              <button
                type="button"
                onClick={onRunAiAudit}
                disabled={holdings.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                AI Buy/Hold/Exit Audit
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={holdings.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button
                type="button"
                onClick={onUploadScreenshot}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/70 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" /> Upload CSV / Shot
              </button>
              <button
                type="button"
                onClick={onAddHolding}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add Holding
              </button>
            </div>
          </div>

          {holdings.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                aria-label="Filter by sector"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                {sectorOptions.map((sec) => (
                  <option key={sec} value={sec}>
                    Sector: {sec}
                  </option>
                ))}
              </select>

              <select
                value={exchangeFilter}
                onChange={(e) => setExchangeFilter(e.target.value as 'All' | 'NSE' | 'BSE')}
                aria-label="Filter by exchange"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="All">Exchange: All</option>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>

              <select
                value={pnlFilter}
                onChange={(e) => setPnlFilter(e.target.value as 'All' | 'gainers' | 'losers')}
                aria-label="Filter by P&L status"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="All">P&amp;L: All</option>
                <option value="gainers">Gainers Only</option>
                <option value="losers">Losers Only</option>
              </select>

              <select
                value={dayMoveFilter}
                onChange={(e) => setDayMoveFilter(e.target.value as 'All' | 'up' | 'down')}
                aria-label="Filter by today's price move"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="All">Today: All</option>
                <option value="up">Up Today</option>
                <option value="down">Down Today</option>
              </select>

              <select
                value={dividendFilter}
                onChange={(e) =>
                  setDividendFilter(e.target.value as 'All' | 'payers' | 'non_payers')
                }
                aria-label="Filter by dividend payout"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="All">Dividends: All</option>
                <option value="payers">Dividend Payers</option>
                <option value="non_payers">No Dividends</option>
              </select>

              <select
                value={priceFeedFilter}
                onChange={(e) =>
                  setPriceFeedFilter(e.target.value as 'All' | 'live' | 'fallback')
                }
                aria-label="Filter by live quote status"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="All">Price Feed: All</option>
                <option value="live">Live Exchange LTP</option>
                <option value="fallback">Est. Avg Cost Only</option>
              </select>

              {aiRatings.length > 0 && (
                <select
                  value={aiVerdictFilter}
                  onChange={(e) =>
                    setAiVerdictFilter(e.target.value as 'All' | 'BUY' | 'HOLD' | 'EXIT')
                  }
                  aria-label="Filter by AI rating verdict"
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option value="All">AI Rating: All</option>
                  <option value="BUY">BUY Only</option>
                  <option value="HOLD">HOLD Only</option>
                  <option value="EXIT">EXIT Only</option>
                </select>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Filters
                </button>
              )}

              <div className="text-xs text-slate-500 ml-auto font-mono-tabular">
                Showing {filteredHoldings.length} of {holdings.length}
              </div>
            </div>
          )}
        </div>

        {holdings.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Your equity portfolio is empty</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Upload your Zerodha Kite holdings CSV or broker screenshots, add a position manually, or pre-load 6 sample NSE holdings to explore analytics.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onPreloadDemo}
                disabled={busyAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Database className="w-3.5 h-3.5" /> Pre-load Demo Stocks
              </button>
              <button
                type="button"
                onClick={onUploadScreenshot}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Kite CSV / Shot
              </button>
              <button
                type="button"
                onClick={onAddHolding}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add First Holding
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <SortableTh
                    label="Instrument"
                    sortKey="symbol"
                    activeKey={sortKey}
                    direction={sortDir}
                    className="px-4"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Qty"
                    sortKey="quantity"
                    activeKey={sortKey}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Avg Cost"
                    sortKey="avgBuyPrice"
                    activeKey={sortKey}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Live LTP"
                    sortKey="livePrice"
                    activeKey={sortKey}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Cur. Value"
                    sortKey="currentValue"
                    activeKey={sortKey}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Net P&L"
                    sortKey="totalPnl"
                    activeKey={sortKey}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Day Chg"
                    sortKey="dayGainPercent"
                    activeKey={sortKey}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Div. Yield"
                    sortKey="dividendYield"
                    activeKey={sortKey}
                    direction={sortDir}
                    align="right"
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Health"
                    sortKey="healthStatus"
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={toggleSort}
                  />
                  {aiRatings.length > 0 && <th className="py-2.5 px-3">AI Rating</th>}
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingQuotes && holdings.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="h-11 animate-pulse">
                      <td colSpan={aiRatings.length > 0 ? 11 : 10} className="px-4 py-2 bg-slate-50/40" />
                    </tr>
                  ))
                ) : filteredHoldings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={aiRatings.length > 0 ? 11 : 10}
                      className="py-12 px-4 text-center space-y-2"
                    >
                      <div className="text-xs font-medium text-slate-700">
                        No holdings match your active search or filter criteria.
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
                  filteredHoldings.map((h) => {
                      const pnlPos = h.totalPnl >= 0;
                      const dayPos = h.dayGain >= 0;
                      return (
                        <tr
                          key={h.id}
                          className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                          onClick={() => onInspectChart(h.symbol, h.avgBuyPrice)}
                        >
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {h.symbol.replace(/\.(NS|BO)$/, '')}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                              {h.exchange} · {h.sector} · {h.weightPercent.toFixed(1)}% wt
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-800">
                            {h.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {formatINR(h.avgBuyPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                            <div>{formatINR(h.livePrice)}</div>
                            {!h.hasLiveQuote && (
                              <div
                                className="text-[10px] font-medium text-amber-700"
                                title="Live exchange price could not be resolved; temporarily showing Avg Cost"
                              >
                                Est. (Avg Cost)
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-medium text-slate-900">
                            {formatINR(h.currentValue)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                              pnlPos ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            <div>
                              {pnlPos ? '+' : ''}
                              {formatINR(h.totalPnl)}
                            </div>
                            <div className="text-[11px] font-medium">
                              {formatPercent(h.totalPnlPercent)}
                            </div>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono-tabular ${
                              dayPos ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {formatPercent(h.dayGainPercent)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular">
                            <div
                              className={`font-medium ${
                                h.dividendYield > 0 ? 'text-slate-900' : 'text-slate-400'
                              }`}
                            >
                              {h.dividendYield.toFixed(2)}%
                            </div>
                            {h.annualDividendPerShare > 0 && (
                              <div className="text-[10px] text-slate-500">
                                ₹{h.annualDividendPerShare.toFixed(2)}/sh
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {h.healthStatus === 'Healthy' && (
                              <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                              </span>
                            )}
                            {h.healthStatus === 'Watch' && (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                <Eye className="w-3.5 h-3.5" /> Watch
                              </span>
                            )}
                            {h.healthStatus === 'Dead Stock' && (
                              <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5" /> Dead Stock
                              </span>
                            )}
                          </td>
                          {aiRatings.length > 0 && (
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {(() => {
                                const r = aiRatingMap.get(h.symbol.toUpperCase());
                                if (!r) return <span className="text-slate-400 font-normal">—</span>;
                                return (
                                  <div className="flex items-center gap-1.5 font-mono-tabular">
                                    <span
                                      className={`font-bold ${
                                        r.rating === 'BUY'
                                          ? 'text-green-700'
                                          : r.rating === 'EXIT'
                                          ? 'text-red-700'
                                          : 'text-amber-700'
                                      }`}
                                    >
                                      {r.rating}
                                    </span>
                                    {r.confidence && (
                                      <span className="text-[11px] text-slate-500">
                                        {r.confidence.overallScore.toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          )}
                          <td
                            className="py-2.5 px-4 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditHolding(h)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                                title="Edit holding"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteHolding(h.id)}
                                className="p-1.5 text-slate-500 hover:text-red-700 rounded hover:bg-red-50"
                                title="Delete holding"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        )}
      </div>
      )}

      {/* Dividend Tracker Tab */}
      {holdings.length > 0 && subTab === 'dividends' && (
        <section
          aria-label="Dividend Tracker"
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Dividend Tracker</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Projected annual dividend cashflow computed from current holding quantities and trailing 12-month exchange payouts
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono-tabular whitespace-nowrap">
              {diagnostics.dividendPayers.length} of {holdings.length} positions paying dividends
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="text-xs font-medium text-slate-500">Expected Annual Dividends</div>
              <div className="text-xl font-bold font-mono-tabular text-green-700 mt-1">
                {formatINR(diagnostics.totalExpectedAnnualDividends)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Projected 12M cashflow</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Monthly Income Run-Rate</div>
              <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
                {formatINR(diagnostics.monthlyAverageDividend)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Annualized / 12 months</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Portfolio Dividend Yield</div>
              <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
                {diagnostics.portfolioDividendYield.toFixed(2)}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">On current market value</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Yield on Cost</div>
              <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
                {diagnostics.portfolioYieldOnCost.toFixed(2)}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">On invested capital</div>
            </div>
          </div>

          {diagnostics.dividendPayers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No trailing 12-month dividend payouts detected across your current holdings.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={divSearch}
                    onChange={(e) => setDivSearch(e.target.value)}
                    placeholder="Filter dividend stocks..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
                <select
                  value={divSectorFilter}
                  onChange={(e) => setDivSectorFilter(e.target.value)}
                  aria-label="Filter dividend payers by sector"
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  {divSectorOptions.map((sec) => (
                    <option key={sec} value={sec}>
                      Sector: {sec}
                    </option>
                  ))}
                </select>
                <select
                  value={divYieldFilter}
                  onChange={(e) => setDivYieldFilter(e.target.value as 'All' | '1' | '2' | '4')}
                  aria-label="Filter by minimum dividend yield"
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option value="All">Yield: All</option>
                  <option value="1">Yield &ge; 1%</option>
                  <option value="2">Yield &ge; 2%</option>
                  <option value="4">Yield &ge; 4%</option>
                </select>
                {hasActiveDivFilters && (
                  <button
                    type="button"
                    onClick={resetDivFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
                <div className="text-xs text-slate-500 ml-auto font-mono-tabular">
                  Showing {filteredDividendPayers.length} of {diagnostics.dividendPayers.length}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
              <div className="lg:col-span-3 overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <SortableTh
                        label="Stock"
                        sortKey="symbol"
                        activeKey={divSortKey}
                        direction={divSortDir}
                        className="px-3"
                        onSort={toggleDivSort}
                      />
                      <th className="py-2 px-3 text-right">Qty</th>
                      <SortableTh
                        label="Div / Share (TTM)"
                        sortKey="annualDividendPerShare"
                        activeKey={divSortKey}
                        direction={divSortDir}
                        align="right"
                        onSort={toggleDivSort}
                      />
                      <SortableTh
                        label="Yield"
                        sortKey="dividendYield"
                        activeKey={divSortKey}
                        direction={divSortDir}
                        align="right"
                        onSort={toggleDivSort}
                      />
                      <SortableTh
                        label="Yield on Cost"
                        sortKey="yieldOnCost"
                        activeKey={divSortKey}
                        direction={divSortDir}
                        align="right"
                        onSort={toggleDivSort}
                      />
                      <SortableTh
                        label="Expected Annual"
                        sortKey="expectedAnnualDividend"
                        activeKey={divSortKey}
                        direction={divSortDir}
                        align="right"
                        onSort={toggleDivSort}
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredDividendPayers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                          No dividend stocks match your current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredDividendPayers.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => onInspectChart(item.symbol, item.avgBuyPrice)}
                          className="hover:bg-slate-50 cursor-pointer"
                        >
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900">
                              {item.symbol.replace(/\.(NS|BO)$/, '')}
                            </div>
                            {item.lastDividendDate && (
                              <div className="text-[10px] text-slate-500 font-mono-tabular">
                                Last ex-date: {item.lastDividendDate}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular text-slate-800">
                            ₹{item.annualDividendPerShare.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular text-slate-900 font-medium">
                            {item.dividendYield.toFixed(2)}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                            {item.yieldOnCost.toFixed(2)}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-green-700">
                            {formatINR(item.expectedAnnualDividend)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="lg:col-span-2">
                <div className="text-xs font-semibold text-slate-700 mb-2">
                  Annual Dividend Contribution by Stock
                </div>
                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={diagnostics.dividendPayers.slice(0, 6).map((d) => ({
                        ticker: d.symbol.replace(/\.(NS|BO)$/, ''),
                        expectedAnnualDividend: d.expectedAnnualDividend,
                      }))}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`}
                        tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="ticker"
                        width={84}
                        tick={{ fontSize: 11, fill: '#0F172A' }}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: unknown) => [formatINR(Number(v)), 'Expected Annual']}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar
                        dataKey="expectedAnnualDividend"
                        fill="#16A34A"
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
