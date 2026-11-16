import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AnalyzedMutualFund,
  MfAiSwitchAdviceResponse,
  MutualFundAnalysisResponse,
  MutualFundHoldingRecord,
} from '../types/market';
import { formatINR, formatPercent } from '../utils/portfolioAnalytics';
import { SortableTh } from './SortableTh';

interface MutualFundsViewProps {
  holdings: MutualFundHoldingRecord[];
  analysis: MutualFundAnalysisResponse | null;
  loadingAnalysis: boolean;
  analysisError: string | null;
  isGuestMode: boolean;
  taxSlabPct: number;
  ltcgExemptionRemaining: number;
  busyAction?: boolean;
  onChangeTaxProfile: (taxSlabPct: number, ltcgExemptionRemaining: number) => void;
  onAddFund: () => void;
  onImportCasOrScreenshot: () => void;
  onEditFund: (holding: MutualFundHoldingRecord) => void;
  onDeleteFund: (id: string) => void;
  onPreloadDemo: () => void;
  onClearAll: () => void;
  aiAdvice: MfAiSwitchAdviceResponse | null;
  aiAdviceLoading: boolean;
  aiAdviceError: string | null;
  onGenerateAiAdvice: () => void;
  onRefreshAnalysis: () => void;
}

type MfSubTab = 'ledger' | 'report_card' | 'switches';
type MfSortKey =
  | 'schemeName'
  | 'units'
  | 'avgNav'
  | 'latestNav'
  | 'currentValue'
  | 'unrealizedGain'
  | 'reportCardGrade'
  | 'action';

type SwitchSortKey =
  | 'annualCommissionSaved'
  | 'tenYearProjectedExtraWealth'
  | 'currentValue'
  | 'estimatedExitLoad';

const GRADE_RANK: Record<string, number> = {
  'A+': 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

const ACTION_RANK: Record<string, number> = {
  SWITCH_PEER: 3,
  SWITCH_TO_DIRECT: 2,
  HOLD: 1,
};

function gradeColorClass(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-green-700';
  if (grade === 'B') return 'text-blue-700';
  if (grade === 'C') return 'text-amber-700';
  return 'text-red-700';
}

export function MutualFundsView({
  holdings,
  analysis,
  loadingAnalysis,
  analysisError,
  isGuestMode,
  taxSlabPct,
  ltcgExemptionRemaining,
  busyAction = false,
  onChangeTaxProfile,
  onAddFund,
  onImportCasOrScreenshot,
  onEditFund,
  onDeleteFund,
  onPreloadDemo,
  onClearAll,
  aiAdvice,
  aiAdviceLoading,
  aiAdviceError,
  onGenerateAiAdvice,
  onRefreshAnalysis,
}: MutualFundsViewProps) {
  const [subTab, setSubTab] = useState<MfSubTab>('ledger');
  const [filterText, setFilterText] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'regular' | 'switch'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sipFilter, setSipFilter] = useState<'all' | 'sip' | 'lumpsum'>('all');
  const [sortKey, setSortKey] = useState<MfSortKey>('currentValue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [switchFilter, setSwitchFilter] = useState<
    'all' | 'immediate' | 'regular_to_direct' | 'peer_lag'
  >('all');
  const [switchSort, setSwitchSort] = useState<SwitchSortKey>('annualCommissionSaved');
  const [selectedSchemeCode, setSelectedSchemeCode] = useState<string>('');
  const [chartHorizon, setChartHorizon] = useState<'1y' | '3y' | '5y'>('3y');

  const funds = analysis?.funds ?? [];
  const summary = analysis?.summary ?? {
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
  };

  const categoryOptions = useMemo(() => {
    const set = new Set(funds.map((f) => f.holding.category).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [funds]);

  const hasActiveLedgerFilters =
    filterText.trim() !== '' ||
    ledgerFilter !== 'all' ||
    categoryFilter !== 'All' ||
    sipFilter !== 'all';

  const resetLedgerFilters = () => {
    setFilterText('');
    setLedgerFilter('all');
    setCategoryFilter('All');
    setSipFilter('all');
  };

  const toggleSort = (key: MfSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'schemeName' ? 'asc' : 'desc');
    }
  };

  const activeFund: AnalyzedMutualFund | null = useMemo(() => {
    if (funds.length === 0) return null;
    return (
      funds.find((f) => f.holding.schemeCode === selectedSchemeCode) ??
      funds[0]
    );
  }, [funds, selectedSchemeCode]);

  const filteredFunds = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const matched = funds.filter((f) => {
      if (ledgerFilter === 'regular' && f.holding.planType !== 'Regular') return false;
      if (ledgerFilter === 'switch' && f.switchSuggestion.action === 'HOLD') return false;
      if (categoryFilter !== 'All' && f.holding.category !== categoryFilter) return false;
      if (sipFilter === 'sip' && !f.holding.isSip) return false;
      if (sipFilter === 'lumpsum' && f.holding.isSip) return false;
      if (!q) return true;
      return (
        f.holding.schemeName.toLowerCase().includes(q) ||
        f.holding.category.toLowerCase().includes(q) ||
        f.holding.fundHouse.toLowerCase().includes(q) ||
        f.holding.schemeCode.includes(q) ||
        (f.holding.folioNumber || '').toLowerCase().includes(q)
      );
    });

    return [...matched].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'schemeName':
          cmp = a.holding.schemeName.localeCompare(b.holding.schemeName);
          break;
        case 'units':
          cmp = a.holding.units - b.holding.units;
          break;
        case 'avgNav':
          cmp = a.holding.avgNav - b.holding.avgNav;
          break;
        case 'latestNav':
          cmp = a.latestNav - b.latestNav;
          break;
        case 'currentValue':
          cmp = a.currentValue - b.currentValue;
          break;
        case 'unrealizedGain':
          cmp = a.unrealizedGain - b.unrealizedGain;
          break;
        case 'reportCardGrade':
          cmp = (GRADE_RANK[a.reportCardGrade] ?? 0) - (GRADE_RANK[b.reportCardGrade] ?? 0);
          break;
        case 'action':
          cmp =
            (ACTION_RANK[a.switchSuggestion.action] ?? 0) -
            (ACTION_RANK[b.switchSuggestion.action] ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    funds,
    filterText,
    ledgerFilter,
    categoryFilter,
    sipFilter,
    sortKey,
    sortDir,
  ]);

  const reportCardChartData = useMemo(() => {
    if (!activeFund || activeFund.navHistory.length === 0) return [];
    const pts = activeFund.navHistory;
    const lastDate = Date.parse(pts[pts.length - 1].date);
    const years = chartHorizon === '1y' ? 1 : chartHorizon === '3y' ? 3 : 5;
    const cutoff = lastDate - years * 365.25 * 86400 * 1000;
    const sliced = pts.filter((p) => Date.parse(p.date) >= cutoff);
    const working = sliced.length >= 2 ? sliced : pts;
    const baseNav = working[0].nav;
    const baseBench = working[0].indexedBenchmark;
    return working.map((p) => ({
      date: p.date,
      fundGrowth: baseNav > 0 ? Number(((p.nav / baseNav) * 100).toFixed(2)) : 100,
      benchmarkGrowth:
        baseBench && p.indexedBenchmark && baseBench > 0
          ? Number(((p.indexedBenchmark / baseBench) * 100).toFixed(2))
          : undefined,
    }));
  }, [activeFund, chartHorizon]);

  const actionableSwitches = useMemo(
    () => funds.filter((f) => f.switchSuggestion.action !== 'HOLD'),
    [funds]
  );

  const visibleSwitches = useMemo(() => {
    const matched = actionableSwitches.filter((f) => {
      if (switchFilter === 'immediate' && f.switchSuggestion.timingVerdict !== 'SWITCH_NOW') {
        return false;
      }
      if (
        switchFilter === 'regular_to_direct' &&
        f.switchSuggestion.action !== 'SWITCH_TO_DIRECT'
      ) {
        return false;
      }
      if (switchFilter === 'peer_lag' && f.switchSuggestion.action !== 'SWITCH_PEER') {
        return false;
      }
      return true;
    });

    return [...matched].sort((a, b) => {
      switch (switchSort) {
        case 'tenYearProjectedExtraWealth':
          return (
            b.switchSuggestion.tenYearProjectedExtraWealth -
            a.switchSuggestion.tenYearProjectedExtraWealth
          );
        case 'currentValue':
          return b.currentValue - a.currentValue;
        case 'estimatedExitLoad':
          return a.switchSuggestion.estimatedExitLoad - b.switchSuggestion.estimatedExitLoad;
        default:
          return b.switchSuggestion.annualCommissionSaved - a.switchSuggestion.annualCommissionSaved;
      }
    });
  }, [actionableSwitches, switchFilter, switchSort]);

  const handleExportMfCsv = () => {
    if (funds.length === 0) return;
    const headers = [
      'SchemeCode',
      'SchemeName',
      'Category',
      'PlanType',
      'Units',
      'AvgNAV',
      'LiveNAV',
      'InvestedValue',
      'CurrentValue',
      'UnrealizedGain',
      'ReportGrade',
      'EstTER',
      'SwitchAction',
      'TargetScheme',
      'AnnualCommissionSaved',
      'EstimatedExitLoad',
      'EstimatedTax',
    ];
    const csvRows = [
      headers.join(','),
      ...funds.map((f) =>
        [
          f.holding.schemeCode,
          `"${f.holding.schemeName.replace(/"/g, '""')}"`,
          `"${f.holding.category}"`,
          f.holding.planType,
          f.holding.units,
          f.holding.avgNav,
          f.latestNav,
          f.investedValue.toFixed(2),
          f.currentValue.toFixed(2),
          f.unrealizedGain.toFixed(2),
          f.reportCardGrade,
          f.estExpenseRatio.toFixed(2),
          f.switchSuggestion.action,
          `"${(f.switchSuggestion.targetSchemeName || 'Hold').replace(/"/g, '""')}"`,
          f.switchSuggestion.annualCommissionSaved.toFixed(2),
          f.switchSuggestion.estimatedExitLoad.toFixed(2),
          f.switchSuggestion.estimatedTax.toFixed(2),
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stoxify-mutual-funds-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gainPositive = summary.totalGain >= 0;

  return (
    <div className="space-y-6">
      {/* Guest Mode Banner (only when holdings exist) */}
      {isGuestMode && holdings.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3.5">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Guest Session Active</span>
            <span className="mx-2 text-slate-300">·</span>
            Scored against live AMFI NAV histories. Sign in with Google to persist your schemes permanently.
          </div>
          <button
            type="button"
            onClick={onImportCasOrScreenshot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" /> Import CAS / Screenshots
          </button>
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Mutual Fund Portfolio Value</div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
            {formatINR(summary.totalCurrent)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            Invested {formatINR(summary.totalInvested)} · {holdings.length}{' '}
            {holdings.length === 1 ? 'scheme' : 'schemes'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Net Gain &amp; Est. XIRR</div>
          <div
            className={`text-2xl font-bold font-mono-tabular mt-1.5 ${
              gainPositive ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {gainPositive ? '+' : ''}
            {formatINR(summary.totalGain)}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono-tabular mt-1">
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${
                gainPositive ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {gainPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {formatPercent(summary.totalGainPercent)}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-600">
              XIRR {summary.estXirr !== null ? formatPercent(summary.estXirr) : '—'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Annual Commission Leak (Regular)</div>
          <div
            className={`text-2xl font-bold font-mono-tabular mt-1.5 ${
              summary.regularCommissionLeak > 0 ? 'text-red-700' : 'text-green-700'
            }`}
          >
            {formatINR(summary.regularCommissionLeak)}
            <span className="text-xs font-normal text-slate-500">/yr</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            {summary.regularPlanCount} Regular {summary.regularPlanCount === 1 ? 'plan' : 'plans'} ·
            10Y drag {formatINR(summary.tenYearCommissionLeak)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Switch Opportunities</div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
            {summary.switchCount}{' '}
            <span className="text-sm font-medium text-slate-500">
              {summary.switchCount === 1 ? 'fund flagged' : 'funds flagged'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs mt-1">
            <span className="text-slate-500 font-mono-tabular">
              {summary.underperformerCount} lagging peer · {summary.regularPlanCount} Regular
            </span>
            {summary.switchCount > 0 && (
              <button
                type="button"
                onClick={() => setSubTab('switches')}
                className="text-blue-700 font-medium hover:underline whitespace-nowrap"
              >
                Review Switches →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workspace Navigation + Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-5 py-3.5">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setSubTab('ledger')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'ledger'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Holdings &amp; Leak Audit
          </button>
          <button
            type="button"
            onClick={() => setSubTab('report_card')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'report_card'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Fund Report Card
          </button>
          <button
            type="button"
            onClick={() => setSubTab('switches')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'switches'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Switch &amp; Tax Simulator ({actionableSwitches.length})
          </button>
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
            onClick={() => {
              setSubTab('switches');
              onGenerateAiAdvice();
            }}
            disabled={funds.length === 0 || aiAdviceLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {aiAdviceLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            AI Switch Strategy
          </button>
          <button
            type="button"
            onClick={handleExportMfCsv}
            disabled={funds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={onImportCasOrScreenshot}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/70 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV / CAS / Shot
          </button>
          <button
            type="button"
            onClick={onAddFund}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add Mutual Fund
          </button>
        </div>
      </div>

      {analysisError && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
          <span>{analysisError}</span>
          <button
            type="button"
            onClick={onRefreshAnalysis}
            className="px-3 py-1 bg-white border border-red-200 rounded-md font-medium hover:bg-red-100"
          >
            Retry AMFI Sync
          </button>
        </div>
      )}

      {/* Empty State */}
      {holdings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 px-6 text-center space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            No Mutual Fund holdings added yet
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload a Zerodha Coin/Kite CSV, CAMS/KFintech CAS PDF, or app screenshots, add any AMFI scheme manually, or pre-load 5 sample schemes to test Report Card &amp; Direct Switch analysis.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onPreloadDemo}
              disabled={busyAction}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Database className="w-3.5 h-3.5" /> Pre-load Demo Funds
            </button>
            <button
              type="button"
              onClick={onImportCasOrScreenshot}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" /> Import CSV / CAS / Shots
            </button>
            <button
              type="button"
              onClick={onAddFund}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add First Mutual Fund
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* SUBTAB 1: HOLDINGS & COMMISSION LEAK AUDIT */}
          {subTab === 'ledger' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Filter scheme, AMC, category, code..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                    {(
                      [
                        { key: 'all', label: 'All Schemes' },
                        { key: 'regular', label: 'Regular Plans' },
                        { key: 'switch', label: 'Switch Suggested' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setLedgerFilter(item.key)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          ledgerFilter === item.key
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filter by fund category"
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        Category: {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sipFilter}
                    onChange={(e) =>
                      setSipFilter(e.target.value as 'all' | 'sip' | 'lumpsum')
                    }
                    aria-label="Filter by SIP status"
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="all">Mode: All</option>
                    <option value="sip">Active SIP Only</option>
                    <option value="lumpsum">Lumpsum Only</option>
                  </select>

                  {hasActiveLedgerFilters && (
                    <button
                      type="button"
                      onClick={resetLedgerFilters}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset Filters
                    </button>
                  )}

                  <div className="text-xs text-slate-500 ml-auto font-mono-tabular">
                    Showing {filteredFunds.length} of {funds.length}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <SortableTh
                        label="Scheme & Metadata"
                        sortKey="schemeName"
                        activeKey={sortKey}
                        direction={sortDir}
                        className="px-4"
                        onSort={toggleSort}
                      />
                      <SortableTh
                        label="Units"
                        sortKey="units"
                        activeKey={sortKey}
                        direction={sortDir}
                        align="right"
                        onSort={toggleSort}
                      />
                      <SortableTh
                        label="Avg NAV"
                        sortKey="avgNav"
                        activeKey={sortKey}
                        direction={sortDir}
                        align="right"
                        onSort={toggleSort}
                      />
                      <SortableTh
                        label="Live NAV"
                        sortKey="latestNav"
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
                        label="Net Gain"
                        sortKey="unrealizedGain"
                        activeKey={sortKey}
                        direction={sortDir}
                        align="right"
                        onSort={toggleSort}
                      />
                      <SortableTh
                        label="Report Card"
                        sortKey="reportCardGrade"
                        activeKey={sortKey}
                        direction={sortDir}
                        align="center"
                        onSort={toggleSort}
                      />
                      <SortableTh
                        label="Switch Recommendation"
                        sortKey="action"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={toggleSort}
                      />
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loadingAnalysis && funds.length === 0 ? (
                      Array.from({ length: holdings.length }).map((_, i) => (
                        <tr key={i} className="h-12 animate-pulse">
                          <td colSpan={9} className="px-4 py-2 bg-slate-50/40" />
                        </tr>
                      ))
                    ) : filteredFunds.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 px-4 text-center space-y-2">
                          <div className="text-xs font-medium text-slate-700">
                            No schemes match your active search or filter criteria.
                          </div>
                          <button
                            type="button"
                            onClick={resetLedgerFilters}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                          >
                            <RotateCcw className="w-3 h-3" /> Reset Filters
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredFunds.map((f) => {
                          const pos = f.unrealizedGain >= 0;
                          const sw = f.switchSuggestion;
                          return (
                            <tr
                              key={f.holding.id}
                              onClick={() => {
                                setSelectedSchemeCode(f.holding.schemeCode);
                                setSubTab('report_card');
                              }}
                              className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                            >
                              <td className="py-3 px-4 max-w-[300px]">
                                <div className="font-semibold text-slate-900 truncate">
                                  {f.holding.schemeName}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                  <span
                                    className={
                                      f.holding.planType === 'Regular'
                                        ? 'text-red-700 font-semibold'
                                        : 'text-green-700 font-medium'
                                    }
                                  >
                                    {f.holding.planType}
                                  </span>
                                  <span className="mx-1.5 text-slate-300">·</span>
                                  <span>{f.holding.category}</span>
                                  <span className="mx-1.5 text-slate-300">·</span>
                                  <span className="font-mono-tabular">
                                    {f.estExpenseRatio.toFixed(2)}% TER ({f.terSource === 'AMC Verified' ? 'AMC' : 'Est.'})
                                  </span>
                                  {f.holding.isSip && (
                                    <>
                                      <span className="mx-1.5 text-slate-300">·</span>
                                      <span>SIP Active</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-mono-tabular text-slate-800">
                                {f.holding.units.toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono-tabular text-slate-700">
                                ₹{f.holding.avgNav.toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono-tabular">
                                <div className="font-semibold text-slate-900">
                                  ₹{f.latestNav.toFixed(2)}
                                </div>
                                <div
                                  className={`text-[10px] ${
                                    f.dayChangePercent >= 0 ? 'text-green-700' : 'text-red-700'
                                  }`}
                                >
                                  {formatPercent(f.dayChangePercent)} ({f.navDate})
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-mono-tabular font-medium text-slate-900">
                                {formatINR(f.currentValue)}
                              </td>
                              <td
                                className={`py-3 px-3 text-right font-mono-tabular font-semibold ${
                                  pos ? 'text-green-700' : 'text-red-700'
                                }`}
                              >
                                <div>
                                  {pos ? '+' : ''}
                                  {formatINR(f.unrealizedGain)}
                                </div>
                                <div className="text-[11px] font-medium">
                                  {formatPercent(f.unrealizedGainPercent)}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div
                                  className={`text-sm font-bold font-mono-tabular ${gradeColorClass(
                                    f.reportCardGrade
                                  )}`}
                                >
                                  {f.reportCardGrade}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono-tabular">
                                  3Y {f.return3Y !== null ? `${f.return3Y}%` : '—'}
                                </div>
                              </td>
                              <td
                                className="py-3 px-3 whitespace-nowrap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (sw.action !== 'HOLD') setSubTab('switches');
                                  else {
                                    setSelectedSchemeCode(f.holding.schemeCode);
                                    setSubTab('report_card');
                                  }
                                }}
                              >
                                {sw.action === 'HOLD' && (
                                  <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Hold · Direct Performer
                                  </span>
                                )}
                                {sw.action === 'SWITCH_TO_DIRECT' && (
                                  <div>
                                    <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Switch to Direct
                                    </span>
                                    <div className="text-[10px] text-slate-500 font-mono-tabular">
                                      Save {formatINR(sw.annualCommissionSaved)}/yr
                                    </div>
                                  </div>
                                )}
                                {sw.action === 'SWITCH_PEER' && (
                                  <div>
                                    <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Switch Lagging Fund
                                    </span>
                                    <div className="text-[10px] text-slate-500 font-mono-tabular">
                                      {sw.timingVerdict === 'WAIT_EXIT_LOAD'
                                        ? `Wait ${sw.daysUntilExitLoadFree}d exit-load`
                                        : 'Outperformer Direct Peer'}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td
                                className="py-3 px-4 text-right whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onEditFund(f.holding)}
                                    className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                                    title="Edit holding"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteFund(f.holding.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-700 rounded hover:bg-red-50"
                                    title="Delete holding"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBTAB 2: FUND REPORT CARD (CONSISTENCY, DOWNSIDE PROTECTION, ALPHA, SHARPE) */}
          {subTab === 'report_card' && activeFund && (
            <div className="space-y-5">
              {/* Fund Selector Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {funds.map((f) => {
                  const selected = f.holding.schemeCode === activeFund.holding.schemeCode;
                  return (
                    <button
                      key={f.holding.id}
                      type="button"
                      onClick={() => setSelectedSchemeCode(f.holding.schemeCode)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {f.holding.schemeName.split(' - ')[0]} ({f.reportCardGrade})
                    </button>
                  );
                })}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                {/* Report Card Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      {activeFund.holding.schemeName}
                    </h3>
                    <div className="text-xs text-slate-500 font-mono-tabular">
                      AMFI #{activeFund.holding.schemeCode} · {activeFund.holding.fundHouse} ·{' '}
                      {activeFund.holding.category} · {activeFund.holding.planType} Plan ·{' '}
                      {activeFund.estExpenseRatio.toFixed(2)}% TER ({activeFund.terSource || 'Category Est.'})
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div>
                      <div className="text-[11px] text-slate-500">Report Card Grade</div>
                      <div
                        className={`text-2xl font-bold font-mono-tabular ${gradeColorClass(
                          activeFund.reportCardGrade
                        )}`}
                      >
                        {activeFund.reportCardGrade}
                      </div>
                    </div>
                    <div className="w-36">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                        <span>Consistency</span>
                        <span className="font-mono-tabular font-semibold">
                          {activeFund.consistencyScore}/100
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-700 rounded-full"
                          style={{ width: `${activeFund.consistencyScore}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-36">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                        <span>Downside Protection</span>
                        <span className="font-mono-tabular font-semibold">
                          {activeFund.downsideProtectionScore}/100
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600 rounded-full"
                          style={{ width: `${activeFund.downsideProtectionScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* NAV vs Benchmark Chart + Trailing Returns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          NAV Growth Trajectory (Indexed to 100 vs {activeFund.benchmarkName})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Computed from historical AMFI daily NAVs up to {activeFund.navDate}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        {(['1y', '3y', '5y'] as const).map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setChartHorizon(h)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-md uppercase ${
                              chartHorizon === h
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={reportCardChartData}
                          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                            minTickGap={32}
                          />
                          <YAxis
                            domain={['auto', 'auto']}
                            tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                            width={48}
                          />
                          <Tooltip
                            formatter={(val: unknown, name?: string | number) => [
                              `${Number(val).toFixed(1)}`,
                              name === 'fundGrowth' ? 'Scheme (₹100 Base)' : 'Benchmark (₹100 Base)',
                            ]}
                            contentStyle={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#E2E8F0',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="fundGrowth"
                            stroke="#1D4ED8"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="benchmarkGrowth"
                            stroke="#94A3B8"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Trailing & Risk-Adjusted Table */}
                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                        Trailing CAGR vs Benchmark
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11px] text-slate-500">
                            <th className="py-2 px-3 text-left">Horizon</th>
                            <th className="py-2 px-3 text-right">Scheme</th>
                            <th className="py-2 px-3 text-right">Benchmark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono-tabular">
                          <tr>
                            <td className="py-2 px-3 text-slate-600">1Y Return</td>
                            <td className="py-2 px-3 text-right font-semibold text-slate-900">
                              {activeFund.return1Y !== null ? formatPercent(activeFund.return1Y) : '—'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-500">
                              {activeFund.benchmarkReturn1Y !== null
                                ? formatPercent(activeFund.benchmarkReturn1Y)
                                : '—'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 text-slate-600">3Y CAGR</td>
                            <td className="py-2 px-3 text-right font-semibold text-slate-900">
                              {activeFund.return3Y !== null ? formatPercent(activeFund.return3Y) : '—'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-500">
                              {activeFund.benchmarkReturn3Y !== null
                                ? formatPercent(activeFund.benchmarkReturn3Y)
                                : '—'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 text-slate-600">5Y CAGR</td>
                            <td className="py-2 px-3 text-right font-semibold text-slate-900">
                              {activeFund.return5Y !== null ? formatPercent(activeFund.return5Y) : '—'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-500">
                              {activeFund.benchmarkReturn5Y !== undefined &&
                              activeFund.benchmarkReturn5Y !== null
                                ? formatPercent(activeFund.benchmarkReturn5Y)
                                : '—'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                      <div className="px-3.5 py-2 bg-slate-50 text-[11px] font-semibold text-slate-700">
                        Risk-Adjusted Ratios (3Y Window)
                      </div>
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-slate-600">Jensen&apos;s Alpha (3Y)</span>
                        <span
                          className={`font-mono-tabular font-semibold ${
                            (activeFund.alpha3Y ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {activeFund.alpha3Y !== null ? formatPercent(activeFund.alpha3Y) : '—'}
                        </span>
                      </div>
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-slate-600">Sharpe Ratio</span>
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          {activeFund.sharpeRatio !== null ? activeFund.sharpeRatio.toFixed(2) : '—'}
                        </span>
                      </div>
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-slate-600">Portfolio Beta</span>
                        <span className="font-mono-tabular text-slate-800">
                          {activeFund.beta !== null ? activeFund.beta.toFixed(2) : '—'}
                        </span>
                      </div>
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-slate-600">Max Drawdown</span>
                        <span className="font-mono-tabular text-red-700">
                          {activeFund.maxDrawdown !== null ? `${activeFund.maxDrawdown.toFixed(2)}%` : '—'}
                        </span>
                      </div>
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-slate-600">Downside Capture</span>
                        <span className="font-mono-tabular text-slate-900">
                          {activeFund.downsideCapture !== null
                            ? `${activeFund.downsideCapture.toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-slate-600">1Y Rolling Beat Rate</span>
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          {activeFund.rollingBeatRate !== null
                            ? `${activeFund.rollingBeatRate}%`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 3: SWITCH & TAX / EXIT-LOAD SIMULATOR */}
          {subTab === 'switches' && (
            <div className="space-y-5">
              {/* Interactive Tax Profile Controls */}
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Tax &amp; Exit-Load Switch Parameters
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Adjust your remaining annual ₹1.25L Equity LTCG exemption and marginal slab rate to recalculate switch friction live
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <span className="text-slate-600">LTCG Exempt Left</span>
                    <select
                      value={ltcgExemptionRemaining}
                      onChange={(e) =>
                        onChangeTaxProfile(taxSlabPct, Number(e.target.value))
                      }
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono-tabular text-xs"
                    >
                      <option value={125000}>₹1,25,000 (Full)</option>
                      <option value={62500}>₹62,500 (Half Used)</option>
                      <option value={0}>₹0 (Exhausted)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-slate-600">Debt Income Slab</span>
                    <select
                      value={taxSlabPct}
                      onChange={(e) =>
                        onChangeTaxProfile(Number(e.target.value), ltcgExemptionRemaining)
                      }
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono-tabular text-xs"
                    >
                      <option value={0}>0% Slab</option>
                      <option value={20}>20% Slab</option>
                      <option value={30}>30% Slab</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* AI Portfolio Switch Strategy Box */}
              {(aiAdvice || aiAdviceLoading || aiAdviceError) && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-700" />
                      AI Portfolio Switch &amp; Tax Execution Plan
                    </h3>
                    {aiAdvice && (
                      <span className="text-[11px] text-slate-500 font-mono-tabular">
                        Generated {new Date(aiAdvice.generatedAt).toLocaleTimeString('en-IN')}
                      </span>
                    )}
                  </div>
                  {aiAdviceLoading ? (
                    <div className="py-6 flex items-center gap-2 text-xs text-slate-600">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
                      Synthesizing Regular-to-Direct savings, exit-load windows, and LTCG harvesting...
                    </div>
                  ) : aiAdviceError ? (
                    <div className="text-xs text-red-700">{aiAdviceError}</div>
                  ) : (
                    aiAdvice && (
                      <div className="space-y-3 text-xs">
                        {aiAdvice.quotaNotice && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2 text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">
                                Quantitative Switch Engine Active:{' '}
                              </span>
                              {aiAdvice.quotaNotice}
                            </div>
                          </div>
                        )}
                        <p className="text-slate-800 leading-relaxed">{aiAdvice.portfolioVerdict}</p>
                        {aiAdvice.portfolioProjection && (
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900">
                                Mutual Fund Corpus Projection (6M · 1Y · 5Y · 10Y)
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Current Path vs. Post-Switch Optimized Corpus
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              {(
                                [
                                  {
                                    label: 'Next 6 Months',
                                    val: aiAdvice.portfolioProjection.value6M,
                                    opt: aiAdvice.portfolioProjection.optimizedValue6M,
                                    pct: aiAdvice.portfolioProjection.return6MPercent,
                                    suffix: 'est.',
                                  },
                                  {
                                    label: 'Next 1 Year',
                                    val: aiAdvice.portfolioProjection.value1Y,
                                    opt: aiAdvice.portfolioProjection.optimizedValue1Y,
                                    pct: aiAdvice.portfolioProjection.return1YPercent,
                                    suffix: 'est.',
                                  },
                                  {
                                    label: '5-Year Outlook',
                                    val: aiAdvice.portfolioProjection.value5Y,
                                    opt: aiAdvice.portfolioProjection.optimizedValue5Y,
                                    pct: aiAdvice.portfolioProjection.cagr5YPercent,
                                    suffix: 'CAGR',
                                  },
                                  {
                                    label: '10-Year Outlook',
                                    val: aiAdvice.portfolioProjection.value10Y,
                                    opt: aiAdvice.portfolioProjection.optimizedValue10Y,
                                    pct: aiAdvice.portfolioProjection.cagr10YPercent,
                                    suffix: 'CAGR',
                                  },
                                ] as const
                              ).map((h) => {
                                const diff =
                                  h.opt !== undefined ? Math.round(h.opt - h.val) : 0;
                                return (
                                  <div
                                    key={h.label}
                                    className="p-2.5 bg-white border border-slate-200 rounded-lg"
                                  >
                                    <div className="text-[11px] text-slate-500">{h.label}</div>
                                    <div className="text-sm font-bold font-mono-tabular text-slate-900 mt-0.5">
                                      {formatINR(h.val, true)}
                                    </div>
                                    <div
                                      className={`text-[11px] font-mono-tabular font-semibold ${
                                        h.pct >= 0 ? 'text-green-700' : 'text-red-700'
                                      }`}
                                    >
                                      {h.pct >= 0 ? '+' : ''}
                                      {h.pct.toFixed(1)}% {h.suffix}
                                    </div>
                                    {diff > 0 && (
                                      <div className="text-[10px] font-mono-tabular text-blue-700 font-semibold mt-1">
                                        With Switch: {formatINR(h.opt!, true)} (+
                                        {formatINR(diff, true)})
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="font-semibold text-slate-900 mb-1">Priority Move</div>
                            <p className="text-slate-600">{aiAdvice.priorityMove}</p>
                          </div>
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="font-semibold text-slate-900 mb-1">
                              Tax &amp; Exit-Load Note
                            </div>
                            <p className="text-slate-600">{aiAdvice.taxOptimizationNote}</p>
                          </div>
                        </div>
                        {aiAdvice.guardrailWarnings && aiAdvice.guardrailWarnings.length > 0 && (
                          <div className="px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-1">
                            {aiAdvice.guardrailWarnings.map((gw, idx) => (
                              <div key={idx} className="flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700" />
                                <span>{gw}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {aiAdvice.recommendations.length > 0 && (
                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                            {aiAdvice.recommendations.map((rec, i) => (
                              <div key={i} className="p-3 space-y-2">
                                <div>
                                  <span className="font-mono-tabular font-semibold text-slate-900 mr-2">
                                    #{rec.schemeCode}
                                  </span>
                                  <span className="font-medium text-slate-800">{rec.actionSummary}</span>
                                  <div className="text-slate-500 mt-0.5">{rec.executionSteps}</div>
                                </div>
                                {rec.projection && (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                                    {(
                                      [
                                        {
                                          horizon: '6M',
                                          val: rec.projection.value6M,
                                          pct: rec.projection.return6MPercent,
                                          isCagr: false,
                                        },
                                        {
                                          horizon: '1Y',
                                          val: rec.projection.value1Y,
                                          pct: rec.projection.return1YPercent,
                                          isCagr: false,
                                        },
                                        {
                                          horizon: '5Y',
                                          val: rec.projection.value5Y,
                                          pct: rec.projection.cagr5YPercent,
                                          isCagr: true,
                                        },
                                        {
                                          horizon: '10Y',
                                          val: rec.projection.value10Y,
                                          pct: rec.projection.cagr10YPercent,
                                          isCagr: true,
                                          opt: rec.projection.optimizedValue10Y,
                                        },
                                      ] as Array<{
                                        horizon: string;
                                        val: number;
                                        pct: number;
                                        isCagr: boolean;
                                        opt?: number;
                                      }>
                                    ).map((cell) => (
                                      <div
                                        key={cell.horizon}
                                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded"
                                      >
                                        <span className="text-slate-500">
                                          {cell.horizon} {cell.isCagr ? 'CAGR' : 'Est.'}:{' '}
                                        </span>
                                        <span className="font-mono-tabular font-semibold text-slate-900">
                                          {formatINR(cell.val, true)}
                                        </span>{' '}
                                        <span
                                          className={`font-mono-tabular font-semibold ${
                                            cell.pct >= 0 ? 'text-green-700' : 'text-red-700'
                                          }`}
                                        >
                                          ({cell.pct >= 0 ? '+' : ''}
                                          {cell.pct.toFixed(1)}%)
                                        </span>
                                        {cell.opt !== undefined && cell.opt > cell.val + 1000 && (
                                          <div className="text-[10px] font-mono-tabular text-blue-700 font-medium">
                                            Opt: {formatINR(cell.opt, true)}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Switch Cards */}
              {actionableSwitches.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                  <CheckCircle2 className="w-7 h-7 text-green-700 mx-auto" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    All Mutual Funds are Optimal Direct Performers
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    No Regular plan commission leaks or lagging schemes detected in your current mutual fund basket.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                      {(
                        [
                          { key: 'all', label: `All (${actionableSwitches.length})` },
                          { key: 'immediate', label: '0% Exit Load Ready' },
                          { key: 'regular_to_direct', label: 'Regular → Direct' },
                          { key: 'peer_lag', label: 'Lagging Peer' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSwitchFilter(opt.key)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            switchFilter === opt.key
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Sort by</span>
                      <select
                        value={switchSort}
                        onChange={(e) => setSwitchSort(e.target.value as SwitchSortKey)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                      >
                        <option value="annualCommissionSaved">Highest Annual Fee Saved</option>
                        <option value="tenYearProjectedExtraWealth">Highest 10Y Wealth Gain</option>
                        <option value="currentValue">Highest Position Value</option>
                        <option value="estimatedExitLoad">Lowest Exit Load Friction</option>
                      </select>
                    </div>
                  </div>

                  {visibleSwitches.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                      <div className="text-xs font-medium text-slate-700">
                        No switch candidates match the selected filter.
                      </div>
                      <button
                        type="button"
                        onClick={() => setSwitchFilter('all')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                      >
                        <RotateCcw className="w-3 h-3" /> Show All Switch Candidates
                      </button>
                    </div>
                  ) : (
                    visibleSwitches.map((f) => {
                      const sw = f.switchSuggestion;
                      const isImmediate = sw.timingVerdict === 'SWITCH_NOW';
                      return (
                        <div
                          key={f.holding.id}
                          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                        >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div>
                            <div className="text-xs font-semibold text-slate-900">
                              {sw.action === 'SWITCH_TO_DIRECT'
                                ? 'Direct Plan Upgrade (Commission Leak Detected)'
                                : 'Underperforming Scheme — Peer Reallocation'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
                              Held {sw.holdingDays} days · Value {formatINR(f.currentValue)} · Gain{' '}
                              {formatINR(f.unrealizedGain)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isImmediate ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                <CheckCircle2 className="w-4 h-4" /> Switch Immediately (0% Exit Load)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                <Clock className="w-4 h-4" />{' '}
                                {sw.timingVerdict === 'WAIT_EXIT_LOAD'
                                  ? `Wait ${sw.daysUntilExitLoadFree}d for 0% Exit Load`
                                  : 'Stagger Switch for LTCG Threshold'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Side-by-side Current vs Recommended */}
                        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
                          <div className="lg:col-span-5 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                            <div className="text-[11px] font-medium text-red-700">
                              Current Holding ({f.holding.planType})
                            </div>
                            <div className="text-xs font-semibold text-slate-900">
                              {f.holding.schemeName}
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono-tabular">
                              <div>
                                <div className="text-slate-500">Est. TER</div>
                                <div className="font-semibold text-red-700">
                                  {f.estExpenseRatio.toFixed(2)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">3Y CAGR</div>
                                <div className="font-semibold text-slate-900">
                                  {f.return3Y !== null ? `${f.return3Y}%` : '—'}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">Grade</div>
                                <div className={`font-bold ${gradeColorClass(f.reportCardGrade)}`}>
                                  {f.reportCardGrade}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="lg:col-span-1 flex justify-center">
                            <ArrowRight className="w-5 h-5 text-slate-400 rotate-90 lg:rotate-0" />
                          </div>

                          <div className="lg:col-span-5 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                            <div className="text-[11px] font-medium text-green-700">
                              Recommended Target (Direct Growth)
                            </div>
                            <div className="text-xs font-semibold text-slate-900">
                              {sw.targetSchemeName || 'Direct Growth Counterpart'}
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono-tabular">
                              <div>
                                <div className="text-slate-500">Est. TER</div>
                                <div className="font-semibold text-green-700">
                                  {sw.targetExpenseRatio !== null
                                    ? `${sw.targetExpenseRatio.toFixed(2)}%`
                                    : '—'}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">3Y CAGR</div>
                                <div className="font-semibold text-slate-900">
                                  {sw.targetReturn3Y !== null ? `${sw.targetReturn3Y}%` : '—'}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">Target Grade</div>
                                <div className="font-bold text-green-700">
                                  {sw.targetGrade || 'A+'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Cost vs Benefit Breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2 border-t border-slate-100 text-xs">
                          <div>
                            <div className="text-[11px] text-slate-500">Annual Fee Saved</div>
                            <div className="font-mono-tabular font-bold text-green-700 mt-0.5">
                              {formatINR(sw.annualCommissionSaved)}/yr
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">10Y Extra Wealth</div>
                            <div className="font-mono-tabular font-bold text-green-700 mt-0.5">
                              +{formatINR(sw.tenYearProjectedExtraWealth)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">
                              Exit Load ({sw.exitLoadRatePct}%)
                            </div>
                            <div className="font-mono-tabular font-semibold text-slate-900 mt-0.5">
                              {formatINR(sw.estimatedExitLoad)}
                            </div>
                            {sw.exitLoadRuleLabel && (
                              <div className="text-[10px] text-slate-500 truncate">
                                {sw.exitLoadRuleLabel}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">
                              Est. Tax ({sw.taxType})
                            </div>
                            <div className="font-mono-tabular font-semibold text-slate-900 mt-0.5">
                              {formatINR(sw.estimatedTax)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Friction Break-Even</div>
                            <div className="font-mono-tabular font-semibold text-slate-900 mt-0.5">
                              {sw.breakEvenMonths !== null
                                ? `${sw.breakEvenMonths} ${
                                    sw.breakEvenMonths === 1 ? 'month' : 'months'
                                  }`
                                : '—'}
                            </div>
                          </div>
                        </div>

                        {sw.fifoBreakdown && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono-tabular">
                            <div>
                              <span className="text-slate-500 block font-sans">FIFO Schedule</span>
                              <span className="font-semibold text-slate-900">
                                {sw.fifoBreakdown.lotCount}{' '}
                                {sw.fifoBreakdown.lotCount === 1 ? 'lot' : 'monthly SIP lots'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block font-sans">0% Exit-Load Eligible</span>
                              <span className="font-semibold text-green-700">
                                {formatINR(sw.fifoBreakdown.exitLoadFreeValue)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block font-sans">LTCG (&gt;1Y) Split</span>
                              <span className="font-semibold text-slate-900">
                                {formatINR(sw.fifoBreakdown.ltcgEligibleValue)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block font-sans">STCG / Locked Split</span>
                              <span className="font-semibold text-amber-700">
                                {formatINR(sw.fifoBreakdown.stcgValue)}
                              </span>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-slate-600 leading-relaxed">{sw.rationale}</p>
                      </div>
                    );
                  })
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
