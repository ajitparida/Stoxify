import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpDown,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  Download,
  FlaskConical,
  History,
  LineChart as LineChartIcon,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import type {
  AiRatingVerdict,
  BacktestHorizonDays,
  BacktestOutcomeStatus,
  BacktestRunFirestoreRecord,
  BacktestRunResult,
  BacktestSamplingFrequency,
  BacktestStockScorecard,
  BacktestUniverseMode,
  EnrichedHolding,
  StockEdgeTier,
} from '../types/market';
import type { ChartOverlayLevels } from './MarketChartTerminal';
import { formatINR, formatPercent } from '../utils/portfolioAnalytics';

export type BacktestSubTab = 'overview' | 'scorecard' | 'calibration' | 'signals';

interface BacktestingCalibrationViewProps {
  holdings: EnrichedHolding[];
  isGuestMode: boolean;
  savedRuns: BacktestRunFirestoreRecord[];
  initialSymbolFilter?: string | null;
  onClearInitialSymbolFilter?: () => void;
  onSaveRun: (run: BacktestRunResult) => Promise<void>;
  onDeleteRun: (runId: string) => Promise<void>;
  onInspectChart: (symbol: string, levels?: ChartOverlayLevels) => void;
}

const HORIZON_OPTIONS: Array<{ days: BacktestHorizonDays; label: '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y' }> = [
  { days: 21, label: '1M' },
  { days: 63, label: '3M' },
  { days: 126, label: '6M' },
  { days: 252, label: '1Y' },
  { days: 1260, label: '5Y' },
  { days: 2520, label: '10Y' },
];

type ScorecardSortKey =
  | 'ticker'
  | 'winRate3M'
  | 'avgTotalReturn3M'
  | 'avgExcessReturn3M'
  | 'avgTotalReturn1Y'
  | 'profitFactor3M'
  | 'targetHitRate3M'
  | 'exitAvoidanceRate3M';

function formatNum(val: number | null | undefined, suffix = '%', decimals = 1): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  const sign = val > 0 && suffix === '%' ? '+' : '';
  return `${sign}${val.toFixed(decimals)}${suffix}`;
}

function formatPlainPct(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return `${val.toFixed(decimals)}%`;
}

function getEdgeTone(tier: StockEdgeTier): string {
  switch (tier) {
    case 'Strong':
      return 'bg-green-50 text-green-800 border-green-200';
    case 'Moderate':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'Weak':
      return 'bg-red-50 text-red-800 border-red-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function getStatusTone(status: BacktestOutcomeStatus): string {
  switch (status) {
    case 'TARGET_HIT':
      return 'bg-green-50 text-green-800 border-green-200';
    case 'STOP_HIT':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'BOTH_SAME_BAR':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'PENDING':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function getStatusLabel(status: BacktestOutcomeStatus): string {
  switch (status) {
    case 'TARGET_HIT':
      return 'Target Hit';
    case 'STOP_HIT':
      return 'Stop Hit';
    case 'BOTH_SAME_BAR':
      return 'Same-Bar (Stop)';
    case 'HORIZON_EXPIRED':
      return 'Horizon Exit';
    case 'PENDING':
      return 'Pending';
    default:
      return 'Unavailable';
  }
}

function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const escapeCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function convertSavedRecordToRunResult(rec: BacktestRunFirestoreRecord): BacktestRunResult {
  return {
    runId: rec.id,
    label: rec.label,
    methodology: rec.methodology,
    methodologyNote:
      'Saved 10-year zero-look-ahead technical reconstruction snapshot (T+1 open entry, STOP_FIRST same-bar rule, NSE cost drag, dividend-adjusted Total Return).',
    universeMode: rec.universeMode,
    samplingFrequency: rec.samplingFrequency,
    costBps: rec.costBps,
    trainCutoffDate: rec.trainCutoffDate,
    symbolsRequested: rec.symbols,
    symbolsEvaluated: rec.symbols,
    portfolioMetrics: rec.portfolioMetrics,
    horizonSummaries: rec.horizonSummaries,
    calibrationByHorizon: {
      '63': rec.calibration3M,
      '252': rec.calibration1Y,
    },
    stockScorecards: rec.stockScorecards,
    equityCurve: rec.equityCurve,
    signals: rec.recentSignals,
    totalSignalsGenerated: rec.totalSignalsGenerated,
    dataQuality: rec.dataQuality,
    computedAt: rec.computedAt,
  };
}

export function BacktestingCalibrationView({
  holdings,
  isGuestMode,
  savedRuns,
  initialSymbolFilter = null,
  onClearInitialSymbolFilter,
  onSaveRun,
  onDeleteRun,
  onInspectChart,
}: BacktestingCalibrationViewProps) {
  const [subTab, setSubTab] = useState<BacktestSubTab>('overview');
  const [universeMode, setUniverseMode] = useState<BacktestUniverseMode>('portfolio_plus_flagship');
  const [costBps, setCostBps] = useState<number>(15);
  const [samplingFrequency, setSamplingFrequency] = useState<BacktestSamplingFrequency>('monthly');
  const [selectedHorizon, setSelectedHorizon] = useState<BacktestHorizonDays>(63);

  const [runResult, setRunResult] = useState<BacktestRunResult | null>(null);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDataQuality, setShowDataQuality] = useState(false);

  // Scorecard filters
  const [scorecardSearch, setScorecardSearch] = useState('');
  const [edgeFilter, setEdgeFilter] = useState<'ALL' | StockEdgeTier>('ALL');
  const [portfolioOnlyScorecard, setPortfolioOnlyScorecard] = useState(false);
  const [sortKey, setSortKey] = useState<ScorecardSortKey>('avgExcessReturn3M');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Signals table filters
  const [signalSymbolFilter, setSignalSymbolFilter] = useState<string>('ALL');
  const [signalVerdictFilter, setSignalVerdictFilter] = useState<'ALL' | AiRatingVerdict>('ALL');
  const [signalStatusFilter, setSignalStatusFilter] = useState<'ALL' | BacktestOutcomeStatus>('ALL');
  const [signalSplitFilter, setSignalSplitFilter] = useState<'ALL' | 'TRAIN' | 'OOS'>('ALL');
  const [signalsPage, setSignalsPage] = useState(1);
  const SIGNALS_PAGE_SIZE = 25;

  const portfolioSymbols = useMemo(
    () => Array.from(new Set(holdings.map((h) => h.symbol.toUpperCase()).filter(Boolean))),
    [holdings]
  );

  // If navigated here from Live Charts or Health Diagnostics for a specific symbol
  useEffect(() => {
    if (initialSymbolFilter) {
      setSignalSymbolFilter(initialSymbolFilter.toUpperCase());
      setScorecardSearch(initialSymbolFilter.replace(/\.(NS|BO)$/i, ''));
      setSubTab('signals');
      setSignalsPage(1);
      onClearInitialSymbolFilter?.();
    }
  }, [initialSymbolFilter, onClearInitialSymbolFilter]);

  const executeBacktest = async (opts?: {
    mode?: BacktestUniverseMode;
    bps?: number;
    freq?: BacktestSamplingFrequency;
  }) => {
    setLoading(true);
    setError(null);
    setActiveSavedId(null);
    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universeMode: opts?.mode ?? universeMode,
          portfolioSymbols,
          costBps: opts?.bps ?? costBps,
          samplingFrequency: opts?.freq ?? samplingFrequency,
          maxConcurrentPositions: 10,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Unable to run 10-year historical backtest.');
      }
      const data = (await res.json()) as BacktestRunResult;
      setRunResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backtest execution failed.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-run baseline on first mount so user sees live 10Y data immediately
  useEffect(() => {
    if (!runResult && !loading) {
      void executeBacktest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveCurrentRun = async () => {
    if (!runResult) return;
    setSaving(true);
    try {
      await onSaveRun(runResult);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSavedRun = (rec: BacktestRunFirestoreRecord) => {
    setRunResult(convertSavedRecordToRunResult(rec));
    setActiveSavedId(rec.id);
    setUniverseMode(rec.universeMode);
    setCostBps(rec.costBps);
    setSamplingFrequency(rec.samplingFrequency);
    setSignalsPage(1);
  };

  const selectedHorizonSummary = useMemo(() => {
    if (!runResult) return null;
    return (
      runResult.horizonSummaries.find((h) => h.horizonDays === selectedHorizon) ??
      runResult.horizonSummaries[1] ??
      runResult.horizonSummaries[0] ??
      null
    );
  }, [runResult, selectedHorizon]);

  const activeCalibration = useMemo(() => {
    if (!runResult) return null;
    return (
      runResult.calibrationByHorizon[String(selectedHorizon)] ??
      runResult.calibrationByHorizon['63'] ??
      Object.values(runResult.calibrationByHorizon)[0] ??
      null
    );
  }, [runResult, selectedHorizon]);

  const reliabilityChartData = useMemo(() => {
    if (!activeCalibration) return [];
    return activeCalibration.buckets.map((b) => {
      const midpoint = b.minScore === 0 ? 35 : b.maxScore > 100 ? 90 : (b.minScore + b.maxScore) / 2;
      return {
        bucket: b.bucketLabel,
        ideal: midpoint,
        trainActual: b.trainActualWinRatePct,
        oosActual: b.oosActualWinRatePct,
        oosCalibrated: b.oosCalibratedProbPct,
        oosCount: b.oosCount,
        trainCount: b.trainCount,
      };
    });
  }, [activeCalibration]);

  // Filtered & sorted stock scorecards
  const filteredScorecards = useMemo(() => {
    if (!runResult) return [];
    const q = scorecardSearch.trim().toLowerCase();
    const list = runResult.stockScorecards.filter((s) => {
      if (edgeFilter !== 'ALL' && s.edgeTier !== edgeFilter) return false;
      if (portfolioOnlyScorecard && !s.inUserPortfolio) return false;
      if (
        q &&
        !s.ticker.toLowerCase().includes(q) &&
        !s.companyName.toLowerCase().includes(q) &&
        !s.sector.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortKey === 'ticker') {
        return sortDir === 'asc'
          ? a.ticker.localeCompare(b.ticker)
          : b.ticker.localeCompare(a.ticker);
      }
      const av = (a[sortKey] as number | null) ?? -9999;
      const bv = (b[sortKey] as number | null) ?? -9999;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [runResult, scorecardSearch, edgeFilter, portfolioOnlyScorecard, sortKey, sortDir]);

  const toggleSort = (key: ScorecardSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Filtered signals for audit table
  const filteredSignals = useMemo(() => {
    if (!runResult) return [];
    const hKey = String(selectedHorizon);
    return runResult.signals.filter((s) => {
      if (signalSymbolFilter !== 'ALL' && s.symbol.toUpperCase() !== signalSymbolFilter) return false;
      if (signalVerdictFilter !== 'ALL' && s.verdict !== signalVerdictFilter) return false;
      if (signalSplitFilter !== 'ALL' && s.split !== signalSplitFilter) return false;
      if (signalStatusFilter !== 'ALL') {
        const st = s.outcomes[hKey]?.status;
        if (st !== signalStatusFilter) return false;
      }
      return true;
    });
  }, [
    runResult,
    selectedHorizon,
    signalSymbolFilter,
    signalVerdictFilter,
    signalStatusFilter,
    signalSplitFilter,
  ]);

  const totalSignalPages = Math.max(1, Math.ceil(filteredSignals.length / SIGNALS_PAGE_SIZE));
  const paginatedSignals = useMemo(() => {
    const start = (signalsPage - 1) * SIGNALS_PAGE_SIZE;
    return filteredSignals.slice(start, start + SIGNALS_PAGE_SIZE);
  }, [filteredSignals, signalsPage]);

  const handleExportScorecardCsv = () => {
    if (filteredScorecards.length === 0) return;
    downloadCsvFile(
      `stoxify_10y_stock_scorecard_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Symbol',
        'Company',
        'Sector',
        'In Portfolio',
        'Edge Tier',
        'History Years',
        'Total Signals',
        'BUY Signals',
        'EXIT Signals',
        '1M Win %',
        '3M Win %',
        '6M Win %',
        '1Y Win %',
        '3M Avg Net Price Return %',
        '3M Avg Net Total Return %',
        '3M Excess vs Nifty %',
        '1Y Avg Net Total Return %',
        '1Y Excess vs Nifty %',
        '3M Target Hit %',
        '3M Stop Hit %',
        '3M Profit Factor',
        '3M EXIT Avoidance %',
      ],
      filteredScorecards.map((s) => [
        s.symbol,
        s.companyName,
        s.sector,
        s.inUserPortfolio ? 'Yes' : 'No',
        s.edgeTier,
        s.historyYears,
        s.totalSignals,
        s.buySignals,
        s.exitSignals,
        s.winRate1M,
        s.winRate3M,
        s.winRate6M,
        s.winRate1Y,
        s.avgNetReturn3M,
        s.avgTotalReturn3M,
        s.avgExcessReturn3M,
        s.avgTotalReturn1Y,
        s.avgExcessReturn1Y,
        s.targetHitRate3M,
        s.stopHitRate3M,
        s.profitFactor3M,
        s.exitAvoidanceRate3M,
      ])
    );
  };

  const handleExportSignalsCsv = () => {
    if (filteredSignals.length === 0) return;
    const hKey = String(selectedHorizon);
    const hLabel = HORIZON_OPTIONS.find((h) => h.days === selectedHorizon)?.label ?? '3M';
    downloadCsvFile(
      `stoxify_10y_signals_${hLabel}_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Signal Date',
        'Entry Date (T+1)',
        'Symbol',
        'Company',
        'Split',
        'Verdict',
        'Raw Confidence',
        'Calibrated 3M Prob %',
        'Entry Open',
        'Target Price',
        'Stop-Loss',
        `${hLabel} Status`,
        'Exit Date',
        'Exit Price',
        'Days Held',
        'Net Price Return %',
        'Net Total Return (Div Adj) %',
        'Nifty Return %',
        'Excess Return %',
        'Max Drawdown %',
      ],
      filteredSignals.map((s) => {
        const o = s.outcomes[hKey];
        return [
          s.signalDate,
          s.entryDate,
          s.symbol,
          s.companyName,
          s.split,
          s.verdict,
          s.rawConfidence,
          s.calibratedProb3M,
          s.entryPrice,
          s.targetPrice,
          s.stopLossPrice,
          o?.status ?? '',
          o?.exitDate ?? '',
          o?.exitPrice ?? '',
          o?.daysHeld ?? '',
          o?.netPriceReturnPct ?? '',
          o?.netTotalReturnPct ?? '',
          o?.niftyReturnPct ?? '',
          o?.excessReturnPct ?? '',
          o?.maxDrawdownPct ?? '',
        ];
      })
    );
  };

  const isSavedSnapshot = activeSavedId !== null;
  const alreadySavedCurrent =
    runResult !== null && savedRuns.some((r) => r.id === runResult.runId);

  return (
    <div className="space-y-6">
      {/* Header & Execution Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-blue-700 shrink-0" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                10-Year Historical Backtesting &amp; Confidence Calibration
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
              Point-in-time NSE walk-forward evaluation (<span className="font-mono-tabular font-medium text-slate-700">TECH_RECONSTRUCTED_V1</span>): 200-DMA warm-up, <span className="font-mono-tabular">T+1</span> open fills, conservative <span className="font-mono-tabular">STOP_FIRST</span> same-bar tie-breaking, dividend-adjusted Total Return, and out-of-sample isotonic calibration (<span className="font-mono-tabular">2024–2026</span>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={() => void executeBacktest()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {loading ? 'Running 10Y Audit...' : 'Run 10Y Backtest'}
            </button>

            {runResult && !isSavedSnapshot && (
              <button
                type="button"
                disabled={saving || alreadySavedCurrent}
                onClick={() => void handleSaveCurrentRun()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-800 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-blue-700" />
                {alreadySavedCurrent
                  ? 'Saved'
                  : saving
                  ? 'Saving...'
                  : isGuestMode
                  ? 'Save to Session'
                  : 'Save to Cloud'}
              </button>
            )}
          </div>
        </div>

        {/* Parameter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Stock Universe
            </label>
            <select
              value={universeMode}
              onChange={(e) => setUniverseMode(e.target.value as BacktestUniverseMode)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
            >
              <option value="portfolio_plus_flagship">
                My Portfolio ({portfolioSymbols.length}) + Flagship 17 NSE
              </option>
              <option value="flagship">Flagship 17 NSE Bellwethers</option>
              <option value="portfolio_only" disabled={portfolioSymbols.length === 0}>
                My Portfolio Only ({portfolioSymbols.length} stocks)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              NSE Cost + Slippage (per leg)
            </label>
            <select
              value={costBps}
              onChange={(e) => setCostBps(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono-tabular focus:outline-none focus:border-blue-600"
            >
              <option value={0}>0 bps (Gross / No Friction)</option>
              <option value={15}>15 bps (Realistic NSE STT + Slippage)</option>
              <option value={30}>30 bps (Conservative Mid-Cap Slippage)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Signal Evaluation Cadence
            </label>
            <select
              value={samplingFrequency}
              onChange={(e) => setSamplingFrequency(e.target.value as BacktestSamplingFrequency)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
            >
              <option value="monthly">Monthly (1st Trading Session)</option>
              <option value="biweekly">Bi-Weekly (Every 10 Sessions)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Saved Runs ({savedRuns.length})
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={activeSavedId ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    setActiveSavedId(null);
                    return;
                  }
                  const found = savedRuns.find((r) => r.id === id);
                  if (found) handleLoadSavedRun(found);
                }}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
              >
                <option value="">
                  {savedRuns.length === 0 ? 'No saved runs yet' : 'Live Active Run'}
                </option>
                {savedRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} ({r.computedAt.slice(0, 10)})
                  </option>
                ))}
              </select>
              {activeSavedId && (
                <button
                  type="button"
                  title="Delete saved run"
                  onClick={async () => {
                    const idToDelete = activeSavedId;
                    setActiveSavedId(null);
                    await onDeleteRun(idToDelete);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-700 border border-slate-200 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 text-xs text-red-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void executeBacktest()}
            className="px-3 py-1.5 bg-red-700 text-white font-medium rounded-lg hover:bg-red-800 whitespace-nowrap shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Initial Loading Skeleton */}
      {loading && !runResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-blue-700 animate-spin" />
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Fetching 10 years of NSE OHLCV, dividends, splits &amp; Nifty 50 history...
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Reconstructing point-in-time signals, running target/stop barrier execution, and fitting out-of-sample isotonic calibration.
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-slate-50 border border-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-slate-50 border border-slate-100 rounded-lg animate-pulse" />
        </div>
      )}

      {/* Main Content */}
      {runResult && (
        <div className={`space-y-6 ${loading ? 'opacity-65 transition-opacity' : ''}`}>
          {/* Sub-Navigation + Active Horizon Switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              {(
                [
                  { key: 'overview', label: 'Overview & Equity Curve', icon: LineChartIcon },
                  { key: 'scorecard', label: `Stock Scorecard (${runResult.stockScorecards.length})`, icon: Target },
                  { key: 'calibration', label: 'Confidence Calibration', icon: ShieldCheck },
                  { key: 'signals', label: `Signals Audit (${runResult.signals.length})`, icon: History },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = subTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSubTab(tab.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                Eval Horizon:
              </span>
              <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden bg-white">
                {HORIZON_OPTIONS.map((h) => (
                  <button
                    key={h.days}
                    type="button"
                    onClick={() => {
                      setSelectedHorizon(h.days);
                      setSignalsPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs font-mono-tabular font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selectedHorizon === h.days
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SUB-TAB 1: OVERVIEW & EQUITY CURVE */}
          {subTab === 'overview' && (
            <div className="space-y-6">
              {/* 4 Headline KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Portfolio CAGR ({runResult.portfolioMetrics.yearsSimulated.toFixed(1)}Y)
                  </div>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-2xl font-bold font-mono-tabular text-slate-900">
                      {formatNum(runResult.portfolioMetrics.portfolioCagrPct)}
                    </span>
                    <span
                      className={`text-xs font-mono-tabular font-semibold ${
                        runResult.portfolioMetrics.excessCagrPct >= 0
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      {formatNum(runResult.portfolioMetrics.excessCagrPct)} vs Nifty
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                    Nifty 50 CAGR: {formatNum(runResult.portfolioMetrics.niftyCagrPct)} · {runResult.costBps} bps cost
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Max Drawdown vs Nifty 50
                  </div>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-2xl font-bold font-mono-tabular text-red-700">
                      -{runResult.portfolioMetrics.maxDrawdownPct.toFixed(1)}%
                    </span>
                    <span className="text-xs font-mono-tabular text-slate-500">
                      Nifty -{runResult.portfolioMetrics.niftyMaxDrawdownPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                    Ann. Vol: {runResult.portfolioMetrics.annualizedVolatilityPct.toFixed(1)}% · Turnover {runResult.portfolioMetrics.annualTurnoverPct.toFixed(0)}%/yr
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Risk-Adjusted Edge (Sharpe / PF)
                  </div>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-2xl font-bold font-mono-tabular text-slate-900">
                      {runResult.portfolioMetrics.sharpeRatio !== null
                        ? runResult.portfolioMetrics.sharpeRatio.toFixed(2)
                        : '—'}
                    </span>
                    <span className="text-xs font-mono-tabular font-semibold text-blue-700">
                      PF {runResult.portfolioMetrics.profitFactor?.toFixed(2) ?? '—'}x
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                    Sortino {runResult.portfolioMetrics.sortinoRatio?.toFixed(2) ?? '—'} · {runResult.portfolioMetrics.totalClosedTrades} closed trades
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">
                    {selectedHorizonSummary?.horizonLabel ?? '3M'} BUY Win Rate &amp; Total Return
                  </div>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-2xl font-bold font-mono-tabular text-green-700">
                      {formatPlainPct(selectedHorizonSummary?.buyWinRatePct)}
                    </span>
                    <span
                      className={`text-xs font-mono-tabular font-semibold ${
                        (selectedHorizonSummary?.avgNetTotalReturnPct ?? 0) >= 0
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      {formatNum(selectedHorizonSummary?.avgNetTotalReturnPct)} avg
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                    {selectedHorizonSummary?.resolvedBuyCount ?? 0} resolved · {selectedHorizonSummary?.pendingBuyCount ?? 0} pending
                  </div>
                </div>
              </div>

              {/* 10-Year Indexed Equity Curve & Underwater Drawdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      10-Year Capital-Constrained Equity Curve vs Nifty 50 (Base = 100)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Equal-weight max 10 concurrent BUY positions, <span className="font-mono-tabular">T+1</span> open entry, daily target/stop monitoring &amp; EXIT rotation ({runResult.portfolioMetrics.startDate} to {runResult.portfolioMetrics.endDate}).
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-slate-800">
                      <span className="w-3 h-0.5 bg-blue-700 inline-block" />
                      Stoxify Signals ({formatNum(runResult.portfolioMetrics.portfolioTotalReturnPct)})
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-3 h-0.5 bg-slate-400 inline-block" />
                      Nifty 50 ({formatNum(runResult.portfolioMetrics.niftyTotalReturnPct)})
                    </span>
                  </div>
                </div>

                <div className="h-[290px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={runResult.equityCurve}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                        tickFormatter={(d: string) => d.slice(0, 7)}
                        minTickGap={36}
                        axisLine={{ stroke: '#CBD5E1' }}
                        tickLine={false}
                      />
                      <YAxis
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                        tickFormatter={(v: number) => `${v.toFixed(0)}`}
                        axisLine={false}
                        tickLine={false}
                        width={54}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(val: unknown, name) => [
                          `${Number(val).toFixed(1)}`,
                          String(name ?? '') === 'portfolioIndexed' ? 'Stoxify Portfolio' : 'Nifty 50',
                        ]}
                      />
                      <ReferenceLine y={100} stroke="#CBD5E1" strokeDasharray="3 3" />
                      <Line
                        type="monotone"
                        dataKey="portfolioIndexed"
                        stroke="#1D4ED8"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="niftyIndexed"
                        stroke="#94A3B8"
                        strokeWidth={1.75}
                        strokeDasharray="4 3"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Synchronized Underwater Drawdown */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                    <span className="font-semibold text-slate-700">Underwater Drawdown (%)</span>
                    <span>Portfolio vs Nifty 50 Peak-to-Trough</span>
                  </div>
                  <div className="h-[115px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={runResult.equityCurve}
                        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis
                          orientation="right"
                          tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                          axisLine={false}
                          tickLine={false}
                          width={54}
                          tickCount={3}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E2E8F0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(val: unknown, name) => [
                            `${Number(val).toFixed(1)}%`,
                            String(name ?? '') === 'drawdownPct' ? 'Portfolio DD' : 'Nifty 50 DD',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="niftyDrawdownPct"
                          stroke="#94A3B8"
                          fill="#E2E8F0"
                          fillOpacity={0.45}
                          strokeWidth={1}
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="drawdownPct"
                          stroke="#DC2626"
                          fill="#FEE2E2"
                          fillOpacity={0.55}
                          strokeWidth={1.5}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Multi-Horizon Performance Matrix (1M, 3M, 6M, 1Y, 5Y, 10Y) */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Multi-Horizon Signal Performance Matrix (1M · 3M · 6M · 1Y · 5Y · 10Y)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Separate Price Return vs Dividend-Adjusted Total Return after {runResult.costBps} bps/leg cost. Incomplete forward windows are marked Pending and excluded from denominators.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Horizon</th>
                        <th className="py-2.5 px-3 text-right">Resolved / Pending</th>
                        <th className="py-2.5 px-3 text-right">BUY Win %</th>
                        <th className="py-2.5 px-3 text-right">Beat Nifty %</th>
                        <th className="py-2.5 px-3 text-right">Avg Price Net</th>
                        <th className="py-2.5 px-3 text-right">Avg Total Net</th>
                        <th className="py-2.5 px-3 text-right">Excess vs Nifty</th>
                        <th className="py-2.5 px-3 text-right">Target / Stop %</th>
                        <th className="py-2.5 px-3 text-right">Profit Factor</th>
                        <th className="py-2.5 px-4 text-right">EXIT Avoided Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {runResult.horizonSummaries.map((h) => {
                        const isSelected = h.horizonDays === selectedHorizon;
                        return (
                          <tr
                            key={h.horizonDays}
                            onClick={() => setSelectedHorizon(h.horizonDays)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-4 font-semibold text-slate-900 font-mono-tabular">
                              {h.horizonLabel}{' '}
                              <span className="text-[10px] font-normal text-slate-400">
                                ({h.horizonDays}d)
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                              {h.resolvedBuyCount}
                              {h.pendingBuyCount > 0 && (
                                <span className="text-slate-400"> / {h.pendingBuyCount}p</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                              {formatPlainPct(h.buyWinRatePct)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                              {formatPlainPct(h.buyBeatNiftyRatePct)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono-tabular ${
                                (h.avgNetPriceReturnPct ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                              }`}
                            >
                              {formatNum(h.avgNetPriceReturnPct)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                                (h.avgNetTotalReturnPct ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                              }`}
                            >
                              {formatNum(h.avgNetTotalReturnPct)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                                (h.avgExcessReturnPct ?? 0) >= 0 ? 'text-blue-700' : 'text-red-700'
                              }`}
                            >
                              {formatNum(h.avgExcessReturnPct)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                              <span className="text-green-700">
                                {formatPlainPct(h.targetHitRatePct, 0)}
                              </span>{' '}
                              /{' '}
                              <span className="text-red-700">
                                {formatPlainPct(h.stopHitRatePct, 0)}
                              </span>
                              {h.sameBarStopFirstCount > 0 && (
                                <span
                                  className="text-[10px] text-amber-700 ml-1"
                                  title="Same-bar dual hits resolved conservatively as STOP_FIRST"
                                >
                                  ({h.sameBarStopFirstCount} SB)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                              {h.profitFactor !== null ? `${h.profitFactor.toFixed(2)}x` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-700">
                              {formatPlainPct(h.exitAvoidanceRatePct)}{' '}
                              <span className="text-[10px] text-slate-400">
                                ({h.resolvedExitCount})
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Collapsible Data Quality & Corporate Actions Audit */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDataQuality((v) => !v)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-900">
                      Data Quality, Corporate Actions &amp; Methodology Transparency
                    </span>
                    <span className="text-[11px] font-mono-tabular text-slate-500">
                      ({runResult.symbolsEvaluated.length}/{runResult.symbolsRequested.length} symbols loaded)
                    </span>
                  </div>
                  {showDataQuality ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {showDataQuality && (
                  <div className="border-t border-slate-100 p-5 space-y-4">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-900">Methodology Disclosure: </span>
                      {runResult.methodologyNote}
                    </div>
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                            <th className="py-2 px-3">Symbol</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">History</th>
                            <th className="py-2 px-3 text-right">Bars</th>
                            <th className="py-2 px-3 text-right">Dividends / Splits</th>
                            <th className="py-2 px-3">Date Span &amp; Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {runResult.dataQuality.map((q) => (
                            <tr key={q.symbol}>
                              <td className="py-2 px-3 font-mono-tabular font-semibold text-slate-900">
                                {q.ticker}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-semibold border rounded ${
                                    q.status === 'OK'
                                      ? 'bg-green-50 text-green-800 border-green-200'
                                      : q.status === 'PARTIAL_HISTORY'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-red-50 text-red-800 border-red-200'
                                  }`}
                                >
                                  {q.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                                {q.historyYears.toFixed(1)}y
                              </td>
                              <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                                {q.barsCount}
                              </td>
                              <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                                {q.dividendEvents} / {q.splitEvents}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {q.startDate && q.endDate ? `${q.startDate} → ${q.endDate} · ` : ''}
                                {q.note}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: PER-STOCK SCORECARD */}
          {subTab === 'scorecard' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={scorecardSearch}
                      onChange={(e) => setScorecardSearch(e.target.value)}
                      placeholder="Filter symbol or sector..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 w-52"
                    />
                  </div>
                  <select
                    value={edgeFilter}
                    onChange={(e) => setEdgeFilter(e.target.value as 'ALL' | StockEdgeTier)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="ALL">All Edge Tiers</option>
                    <option value="Strong">Strong Edge</option>
                    <option value="Moderate">Moderate Edge</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Weak">Weak Edge</option>
                  </select>
                  {portfolioSymbols.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 px-2 py-1.5 border border-slate-200 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={portfolioOnlyScorecard}
                        onChange={(e) => setPortfolioOnlyScorecard(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      My Portfolio Only
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExportScorecardCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-800 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Scorecard CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => toggleSort('ticker')}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          Stock <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3">10Y Edge</th>
                      <th className="py-2.5 px-3 text-right">BUY / EXIT</th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('winRate3M')}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          3M Win % <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('avgTotalReturn3M')}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          3M Total Net <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('avgExcessReturn3M')}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          3M vs Nifty <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('avgTotalReturn1Y')}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          1Y Total Net <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('targetHitRate3M')}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          Target / Stop <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('profitFactor3M')}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          Profit Factor <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('exitAvoidanceRate3M')}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          EXIT Avoid % <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredScorecards.map((s: BacktestStockScorecard) => (
                      <tr key={s.symbol} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{s.ticker}</span>
                            {s.inUserPortfolio && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                                Held
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {s.sector} · {s.historyYears.toFixed(1)}y
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold border rounded ${getEdgeTone(
                              s.edgeTier
                            )}`}
                          >
                            {s.edgeTier}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                          <span className="text-green-700 font-semibold">{s.buySignals}</span> /{' '}
                          <span className="text-red-700">{s.exitSignals}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                          {formatPlainPct(s.winRate3M)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                            (s.avgTotalReturn3M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {formatNum(s.avgTotalReturn3M)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                            (s.avgExcessReturn3M ?? 0) >= 0 ? 'text-blue-700' : 'text-red-700'
                          }`}
                        >
                          {formatNum(s.avgExcessReturn3M)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono-tabular ${
                            (s.avgTotalReturn1Y ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {formatNum(s.avgTotalReturn1Y)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">
                          <span className="text-green-700">
                            {formatPlainPct(s.targetHitRate3M, 0)}
                          </span>{' '}
                          /{' '}
                          <span className="text-red-700">
                            {formatPlainPct(s.stopHitRate3M, 0)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                          {s.profitFactor3M !== null ? `${s.profitFactor3M.toFixed(2)}x` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                          {formatPlainPct(s.exitAvoidanceRate3M)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSignalSymbolFilter(s.symbol);
                                setSubTab('signals');
                                setSignalsPage(1);
                              }}
                              className="text-[11px] font-medium text-blue-700 hover:underline whitespace-nowrap"
                            >
                              Signals
                            </button>
                            <button
                              type="button"
                              onClick={() => onInspectChart(s.symbol)}
                              className="text-[11px] font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                            >
                              Chart
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-TAB 3: CONFIDENCE CALIBRATION & RELIABILITY */}
          {subTab === 'calibration' && activeCalibration && (
            <div className="space-y-6">
              {/* Calibration Quality Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Train vs Out-of-Sample Split ({activeCalibration.horizonLabel})
                  </div>
                  <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1.5">
                    {activeCalibration.trainSampleCount} / {activeCalibration.oosSampleCount}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Train ≤ {activeCalibration.trainCutoffDate} · OOS 2024–2026
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">
                    OOS Brier Score (Lower is Better)
                  </div>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-xl font-bold font-mono-tabular text-blue-700">
                      {activeCalibration.calibratedBrierScoreOos !== null
                        ? activeCalibration.calibratedBrierScoreOos.toFixed(3)
                        : '—'}
                    </span>
                    <span className="text-xs font-mono-tabular text-slate-500">
                      Raw {activeCalibration.rawBrierScoreOos?.toFixed(3) ?? '—'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                    Log-Loss: {activeCalibration.calibratedLogLossOos?.toFixed(3) ?? '—'} (Raw{' '}
                    {activeCalibration.rawLogLossOos?.toFixed(3) ?? '—'})
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Expected Calibration Error (OOS ECE)
                  </div>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-xl font-bold font-mono-tabular text-green-700">
                      {formatPlainPct(activeCalibration.calibratedEceOosPct)}
                    </span>
                    <span className="text-xs font-mono-tabular text-slate-500">
                      Raw {formatPlainPct(activeCalibration.rawEceOosPct)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Isotonic PAVA fitted strictly on Train ≤2023
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">
                    OOS EXIT Signal Accuracy ({activeCalibration.exitSignalCountOos} calls)
                  </div>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-xl font-bold font-mono-tabular text-slate-900">
                      {formatPlainPct(activeCalibration.exitUnderperformedNiftyRateOosPct)}
                    </span>
                    <span className="text-xs text-slate-500">lagged Nifty</span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                    Negative return after EXIT:{' '}
                    {formatPlainPct(activeCalibration.exitAvoidedNegativeRateOosPct)}
                  </div>
                </div>
              </div>

              {/* Reliability Diagram */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Confidence Reliability Curve ({activeCalibration.horizonLabel} Horizon)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Compares raw confidence bucket midpoints (ideal diagonal) against empirical Train (≤2023) win rate, OOS (2024–2026) actual win rate, and Isotonic calibrated probability.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-3 h-0.5 bg-slate-400 inline-block" /> Perfect Calibration
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-700">
                      <span className="w-3 h-0.5 bg-blue-700 inline-block" /> Isotonic Calibrated
                    </span>
                    <span className="flex items-center gap-1.5 text-green-700">
                      <span className="w-3 h-0.5 bg-green-700 inline-block" /> OOS Actual (2024–26)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <span className="w-3 h-0.5 bg-amber-600 inline-block" /> Train Actual (≤2023)
                    </span>
                  </div>
                </div>

                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={reliabilityChartData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11, fill: '#475569', fontFamily: 'JetBrains Mono' }}
                        axisLine={{ stroke: '#CBD5E1' }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                        tickFormatter={(v: number) => `${v}%`}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(val: unknown, name) => {
                          const key = String(name ?? '');
                          return [
                            val === null || val === undefined ? '—' : `${Number(val).toFixed(1)}%`,
                            key === 'ideal'
                              ? 'Ideal Diagonal'
                              : key === 'oosCalibrated'
                              ? 'Calibrated Win Odds'
                              : key === 'oosActual'
                              ? 'OOS Actual Win %'
                              : 'Train Actual Win %',
                          ];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ideal"
                        stroke="#94A3B8"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="trainActual"
                        stroke="#D97706"
                        strokeWidth={1.5}
                        dot={{ r: 3 }}
                        connectNulls
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="oosActual"
                        stroke="#15803D"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="oosCalibrated"
                        stroke="#1D4ED8"
                        strokeWidth={2.2}
                        dot={{ r: 4 }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Calibration Bucket Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    Bucket-Level Empirical Accuracy &amp; Wilson 95% Confidence Intervals
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Confidence Bucket</th>
                        <th className="py-2.5 px-3 text-right">Train n</th>
                        <th className="py-2.5 px-3 text-right">Train Actual %</th>
                        <th className="py-2.5 px-3 text-right">OOS n</th>
                        <th className="py-2.5 px-3 text-right">OOS Raw Pred %</th>
                        <th className="py-2.5 px-3 text-right">OOS Actual Win %</th>
                        <th className="py-2.5 px-3 text-right">Calibrated Odds %</th>
                        <th className="py-2.5 px-3 text-right">OOS 95% Wilson CI</th>
                        <th className="py-2.5 px-4 text-right">Avg Excess vs Nifty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCalibration.buckets.map((b) => (
                        <tr key={b.bucketLabel} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono-tabular font-bold text-slate-900">
                            {b.bucketLabel}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-600">
                            {b.trainCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-800">
                            {formatPlainPct(b.trainActualWinRatePct)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-600">
                            {b.oosCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-600">
                            {formatPlainPct(b.oosPredictedAvgPct)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-green-700">
                            {formatPlainPct(b.oosActualWinRatePct)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-blue-700">
                            {formatPlainPct(b.oosCalibratedProbPct)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-500">
                            {b.oosCiLowPct !== null && b.oosCiHighPct !== null
                              ? `${b.oosCiLowPct.toFixed(0)}% – ${b.oosCiHighPct.toFixed(0)}%`
                              : '—'}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono-tabular font-semibold ${
                              (b.avgExcessReturnPct ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {formatNum(b.avgExcessReturnPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 4: HISTORICAL SIGNALS & TARGET/STOP AUDIT TABLE */}
          {subTab === 'signals' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={signalSymbolFilter}
                    onChange={(e) => {
                      setSignalSymbolFilter(e.target.value);
                      setSignalsPage(1);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="ALL">All Stocks ({runResult.symbolsEvaluated.length})</option>
                    {runResult.stockScorecards.map((s) => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.ticker} ({s.totalSignals})
                      </option>
                    ))}
                  </select>

                  <select
                    value={signalVerdictFilter}
                    onChange={(e) => {
                      setSignalVerdictFilter(e.target.value as 'ALL' | AiRatingVerdict);
                      setSignalsPage(1);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="ALL">All Verdicts</option>
                    <option value="BUY">BUY Only</option>
                    <option value="HOLD">HOLD Only</option>
                    <option value="EXIT">EXIT Only</option>
                  </select>

                  <select
                    value={signalStatusFilter}
                    onChange={(e) => {
                      setSignalStatusFilter(e.target.value as 'ALL' | BacktestOutcomeStatus);
                      setSignalsPage(1);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="ALL">All Outcomes</option>
                    <option value="TARGET_HIT">Target Hit</option>
                    <option value="STOP_HIT">Stop Hit</option>
                    <option value="BOTH_SAME_BAR">Same-Bar (Stop First)</option>
                    <option value="HORIZON_EXPIRED">Horizon Exit</option>
                    <option value="PENDING">Pending</option>
                  </select>

                  <select
                    value={signalSplitFilter}
                    onChange={(e) => {
                      setSignalSplitFilter(e.target.value as 'ALL' | 'TRAIN' | 'OOS');
                      setSignalsPage(1);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="ALL">Train + OOS</option>
                    <option value="OOS">OOS (2024–2026)</option>
                    <option value="TRAIN">Train (≤2023)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono-tabular text-slate-500">
                    {filteredSignals.length} signals
                  </span>
                  <button
                    type="button"
                    onClick={handleExportSignalsCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-800 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Signals CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Signal / T+1 Entry</th>
                      <th className="py-2.5 px-3">Stock</th>
                      <th className="py-2.5 px-3">Verdict</th>
                      <th className="py-2.5 px-3 text-right">Raw / Cal.</th>
                      <th className="py-2.5 px-3 text-right">Entry / Target / Stop</th>
                      <th className="py-2.5 px-3">Outcome</th>
                      <th className="py-2.5 px-3 text-right">Exit Px &amp; Days</th>
                      <th className="py-2.5 px-3 text-right">Net Total %</th>
                      <th className="py-2.5 px-3 text-right">vs Nifty</th>
                      <th className="py-2.5 px-3 text-right">Max DD</th>
                      <th className="py-2.5 px-4 text-right">Chart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSignals.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-xs text-slate-500">
                          No historical signals match your current filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedSignals.map((s) => {
                        const out = s.outcomes[String(selectedHorizon)];
                        const verdictStyle =
                          s.verdict === 'BUY'
                            ? 'bg-green-50 text-green-800 border-green-200'
                            : s.verdict === 'EXIT'
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200';
                        return (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono-tabular">
                              <div className="font-semibold text-slate-900">{s.signalDate}</div>
                              <div className="text-[10px] text-slate-400">
                                T+1 {s.entryDate} · {s.split}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{s.ticker}</div>
                              <div className="text-[10px] text-slate-500">β {s.betaEst.toFixed(2)}x</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 text-[11px] font-bold border rounded ${verdictStyle}`}
                              >
                                {s.verdict}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular">
                              <div className="font-semibold text-slate-900">
                                {s.rawConfidence.toFixed(0)}%
                              </div>
                              <div className="text-[10px] text-blue-700">
                                Cal {s.calibratedProb3M !== null ? `${s.calibratedProb3M.toFixed(0)}%` : '—'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular">
                              <div className="font-semibold text-slate-900">
                                {formatINR(s.entryPrice)}
                              </div>
                              <div className="text-[10px]">
                                <span className="text-green-700">{formatINR(s.targetPrice)}</span> /{' '}
                                <span className="text-red-700">{formatINR(s.stopLossPrice)}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {out ? (
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-semibold border rounded whitespace-nowrap ${getStatusTone(
                                    out.status
                                  )}`}
                                >
                                  {getStatusLabel(out.status)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular">
                              {out?.exitPrice ? (
                                <>
                                  <div className="text-slate-900 font-medium">
                                    {formatINR(out.exitPrice)}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {out.exitDate} ({out.daysHeld}d)
                                  </div>
                                </>
                              ) : (
                                <span className="text-slate-400">Pending</span>
                              )}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                                out?.netTotalReturnPct === null || out?.netTotalReturnPct === undefined
                                  ? 'text-slate-400'
                                  : out.netTotalReturnPct >= 0
                                  ? 'text-green-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {formatPercent(out?.netTotalReturnPct ?? null)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono-tabular ${
                                out?.excessReturnPct === null || out?.excessReturnPct === undefined
                                  ? 'text-slate-400'
                                  : out.excessReturnPct >= 0
                                  ? 'text-blue-700 font-semibold'
                                  : 'text-red-700'
                              }`}
                            >
                              {formatPercent(out?.excessReturnPct ?? null)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-600">
                              {out?.maxDrawdownPct !== null && out?.maxDrawdownPct !== undefined
                                ? `-${out.maxDrawdownPct.toFixed(1)}%`
                                : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  onInspectChart(s.symbol, {
                                    avgBuyPrice: s.entryPrice,
                                    targetPrice: s.targetPrice,
                                    stopLoss: s.stopLossPrice,
                                  })
                                }
                                className="text-[11px] font-medium text-blue-700 hover:underline whitespace-nowrap"
                              >
                                Plot
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-700" />
                  <span>
                    Page {signalsPage} of {totalSignalPages} · Showing {paginatedSignals.length} of{' '}
                    {filteredSignals.length} signals
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={signalsPage <= 1}
                    onClick={() => setSignalsPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={signalsPage >= totalSignalPages}
                    onClick={() => setSignalsPage((p) => Math.min(totalSignalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
