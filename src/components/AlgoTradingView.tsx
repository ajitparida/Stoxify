import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CandlestickChart,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AlgoBacktestResult,
  AlgoComparator,
  AlgoCompileResponse,
  AlgoIndicator,
  AlgoLogicOperator,
  AlgoOrderRecord,
  AlgoPaperEvaluateResponse,
  AlgoRuleCondition,
  AlgoStrategyDraft,
  AlgoStrategyRecord,
  AlgoStrategyStatus,
  AlgoTimeframe,
  MarketQuote,
  PaperPositionSnapshot,
  SearchResultItem,
} from '../types/market';
import { formatINR, formatPercent } from '../utils/portfolioAnalytics';
import { AlgoRiskOverview } from './AlgoRiskOverview';

interface AlgoTradingViewProps {
  strategies: AlgoStrategyRecord[];
  orders: AlgoOrderRecord[];
  quotes: Record<string, MarketQuote>;
  isGuestMode: boolean;
  paperEvalResult: AlgoPaperEvaluateResponse | null;
  paperEvalLoading: boolean;
  autoTickEnabled: boolean;
  onToggleAutoTick: () => void;
  onEvaluatePaperNow: () => void;
  onSaveStrategy: (
    draft: AlgoStrategyDraft,
    options?: {
      existingId?: string;
      status?: AlgoStrategyStatus;
      backtestSummary?: {
        totalReturnPct: number;
        sharpeRatio: number;
        maxDrawdownPct: number;
        winRatePct: number;
      };
    }
  ) => Promise<string | void>;
  onToggleStrategyStatus: (strategy: AlgoStrategyRecord, nextStatus: AlgoStrategyStatus) => Promise<void>;
  onDeleteStrategy: (strategyId: string) => Promise<void>;
  onHaltAllBots: () => Promise<void>;
  onSquareOffPosition: (pos: PaperPositionSnapshot) => Promise<void>;
  onClearOrders: () => Promise<void>;
  onInspectChart: (symbol: string, levels?: { stopLoss?: number; targetPrice?: number; avgBuyPrice?: number }) => void;
}

const QUICK_PROMPTS: Array<{ title: string; prompt: string }> = [
  {
    title: 'RSI Mean Reversion',
    prompt:
      'Buy RELIANCE, TCS, HDFCBANK, and INFY when RSI(14) drops below 38 while price stays above 200-DMA. Sell when RSI(14) rises above 68, with 4% stop-loss, 10% target, and 2.5% daily loss cap over 1Y.',
  },
  {
    title: 'EMA20 / SMA50 Golden Breakout',
    prompt:
      'Enter ICICIBANK, SBIN, LT, and BHARTIARTL on EMA 20 crossing above SMA 50 with volume surge above 1.4x 20D avg. Exit when RSI > 75, 5% stop-loss, 14% target, 3% trailing stop over 1Y.',
  },
  {
    title: 'Large-Cap Dip Buyer',
    prompt:
      'Buy TMPV, TITAN, SUNPHARMA, and BAJFINANCE on a 1.8% single-day dip when RSI(14) is below 48. Sell on RSI > 65, 3.5% stop-loss, 8% target, and 2% daily loss cap over 6M.',
  },
  {
    title: 'Trend Compounder',
    prompt:
      'Accumulate TRENT, BEL, HAL, and NTPC above SMA(50) with RSI(14) above 52 and positive 50-DMA slope. 6% stop-loss, 18% target, 4% trailing stop over 1Y.',
  },
];

const INDICATOR_OPTIONS: Array<{ value: AlgoIndicator; label: string; defaultThreshold: number }> = [
  { value: 'RSI_14', label: 'RSI (14)', defaultThreshold: 38 },
  { value: 'PRICE_VS_SMA50', label: 'Price vs SMA 50 (%)', defaultThreshold: 0 },
  { value: 'PRICE_VS_SMA200', label: 'Price vs SMA 200 (%)', defaultThreshold: 0 },
  { value: 'EMA20_VS_SMA50', label: 'EMA 20 vs SMA 50 (%)', defaultThreshold: 0 },
  { value: 'VOLUME_RATIO', label: 'Volume Ratio (x 20D)', defaultThreshold: 1.4 },
  { value: 'DAY_CHANGE_PCT', label: 'Bar Change (%)', defaultThreshold: -1.8 },
  { value: 'SMA50_SLOPE_PCT', label: 'SMA 50 Slope (%)', defaultThreshold: 0.5 },
];

const COMPARATOR_OPTIONS: Array<{ value: AlgoComparator; label: string }> = [
  { value: 'LT', label: '<' },
  { value: 'LTE', label: '<=' },
  { value: 'GT', label: '>' },
  { value: 'GTE', label: '>=' },
  { value: 'CROSS_ABOVE', label: 'Crosses Above' },
  { value: 'CROSS_BELOW', label: 'Crosses Below' },
];

const TIMEFRAME_OPTIONS: Array<{ value: AlgoTimeframe; label: string }> = [
  { value: '1d', label: '1D (5m)' },
  { value: '5d', label: '5D (15m)' },
  { value: '1mo', label: '1M (1D)' },
  { value: '6mo', label: '6M (1D)' },
  { value: '1y', label: '1Y (1D)' },
];

function createDefaultDraft(): AlgoStrategyDraft {
  return {
    name: 'Nifty Bluechip RSI Mean Reversion',
    prompt: QUICK_PROMPTS[0].prompt,
    summary:
      'Enters large-cap NSE leaders when RSI(14) dips into oversold support above 200-DMA, protected by 4% stop-loss and 2.5% daily loss cap.',
    symbols: ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS'],
    timeframe: '1y',
    logicOperator: 'AND',
    entryConditions: [
      {
        id: 'entry_1',
        indicator: 'RSI_14',
        comparator: 'LT',
        threshold: 38,
        label: 'RSI(14) < 38',
      },
      {
        id: 'entry_2',
        indicator: 'PRICE_VS_SMA200',
        comparator: 'GT',
        threshold: 0,
        label: 'Price > SMA(200)',
      },
    ],
    exitConditions: [
      {
        id: 'exit_1',
        indicator: 'RSI_14',
        comparator: 'GT',
        threshold: 68,
        label: 'RSI(14) > 68',
      },
    ],
    virtualCapital: 1000000,
    allocationPercent: 25,
    stopLossPct: 4,
    takeProfitPct: 10,
    trailingStopPct: 0,
    maxOpenPositions: 4,
    dailyLossCapPct: 2.5,
    slippageBps: 10,
  };
}

function buildConditionLabel(
  indicator: AlgoIndicator,
  comparator: AlgoComparator,
  threshold: number
): string {
  const compMap: Record<AlgoComparator, string> = {
    LT: '<',
    LTE: '<=',
    GT: '>',
    GTE: '>=',
    CROSS_ABOVE: 'crosses above',
    CROSS_BELOW: 'crosses below',
  };
  if (indicator === 'RSI_14') return `RSI(14) ${compMap[comparator]} ${threshold}`;
  if (indicator === 'PRICE_VS_SMA50') {
    return threshold === 0
      ? `Price ${compMap[comparator]} SMA(50)`
      : `Price vs SMA(50) ${compMap[comparator]} ${threshold}%`;
  }
  if (indicator === 'PRICE_VS_SMA200') {
    return threshold === 0
      ? `Price ${compMap[comparator]} SMA(200)`
      : `Price vs SMA(200) ${compMap[comparator]} ${threshold}%`;
  }
  if (indicator === 'EMA20_VS_SMA50') {
    return threshold === 0
      ? `EMA(20) ${compMap[comparator]} SMA(50)`
      : `EMA(20) vs SMA(50) ${compMap[comparator]} ${threshold}%`;
  }
  if (indicator === 'VOLUME_RATIO') return `Volume ${compMap[comparator]} ${threshold}x 20D avg`;
  if (indicator === 'DAY_CHANGE_PCT') return `Bar Change ${compMap[comparator]} ${threshold}%`;
  return `SMA(50) Slope ${compMap[comparator]} ${threshold}%`;
}

export function AlgoTradingView({
  strategies,
  orders,
  quotes,
  isGuestMode,
  paperEvalResult,
  paperEvalLoading,
  autoTickEnabled,
  onToggleAutoTick,
  onEvaluatePaperNow,
  onSaveStrategy,
  onToggleStrategyStatus,
  onDeleteStrategy,
  onHaltAllBots,
  onSquareOffPosition,
  onClearOrders,
  onInspectChart,
}: AlgoTradingViewProps) {
  const [draft, setDraft] = useState<AlgoStrategyDraft>(() => createDefaultDraft());
  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);

  // AI Rule Compiler State
  const [compiling, setCompiling] = useState(false);
  const [compileNotice, setCompileNotice] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);

  // Symbol Search Picker
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolResults, setSymbolResults] = useState<SearchResultItem[]>([]);
  const [searchingSymbols, setSearchingSymbols] = useState(false);

  // Backtest State
  const [backtesting, setBacktesting] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestResult, setBacktestResult] = useState<AlgoBacktestResult | null>(null);
  const [chartMode, setChartMode] = useState<'equity' | 'drawdown'>('equity');

  // Saving / Ledger State
  const [savingBot, setSavingBot] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<'backtest' | 'positions' | 'orders'>('backtest');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'FILLED' | 'BLOCKED_RISK_CAP'>(
    'ALL'
  );

  // Symbol search debounced fetch
  useEffect(() => {
    const q = symbolQuery.trim();
    if (q.length < 2) {
      setSymbolResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingSymbols(true);
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const json = (await res.json()) as { results?: SearchResultItem[] };
          setSymbolResults(json.results || []);
        }
      } catch {
        setSymbolResults([]);
      } finally {
        setSearchingSymbols(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [symbolQuery]);

  const handleRunCompile = async () => {
    if (draft.prompt.trim().length < 6) {
      setCompileError('Enter a trading rule description in plain English first.');
      return;
    }
    setCompiling(true);
    setCompileError(null);
    setCompileNotice(null);
    try {
      const res = await fetch('/api/algo/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: draft.prompt }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Failed to compile strategy rules.');
      }
      const json = (await res.json()) as AlgoCompileResponse;
      setDraft(json.strategy);
      setEditingStrategyId(null);
      if (json.quotaNotice) {
        setCompileNotice(json.quotaNotice);
      } else {
        setCompileNotice('AI compiled structured entry/exit conditions and risk guardrails.');
      }
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : 'Unable to compile strategy prompt.');
    } finally {
      setCompiling(false);
    }
  };

  const handleRunBacktest = useCallback(
    async (strategyToRun: AlgoStrategyDraft = draft) => {
      setBacktesting(true);
      setBacktestError(null);
      try {
        const res = await fetch('/api/algo/backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: strategyToRun }),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error || 'Historical backtest failed.');
        }
        const json = (await res.json()) as AlgoBacktestResult;
        setBacktestResult(json);
        setLedgerTab('backtest');
      } catch (err) {
        setBacktestError(err instanceof Error ? err.message : 'Unable to execute backtest.');
      } finally {
        setBacktesting(false);
      }
    },
    [draft]
  );

  // Run an initial backtest on mount so the equity curve & trade ledger immediately display real NSE OHLCV data
  useEffect(() => {
    void handleRunBacktest(createDefaultDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveAndOptionallyActivate = async (activate: boolean) => {
    setSavingBot(true);
    try {
      const backtestSummary = backtestResult
        ? {
            totalReturnPct: backtestResult.summary.totalReturnPct,
            sharpeRatio: backtestResult.summary.sharpeRatio,
            maxDrawdownPct: backtestResult.summary.maxDrawdownPct,
            winRatePct: backtestResult.summary.winRatePct,
          }
        : undefined;

      const savedId = await onSaveStrategy(draft, {
        existingId: editingStrategyId ?? undefined,
        status: activate ? 'ACTIVE' : 'DRAFT',
        backtestSummary,
      });
      if (savedId) setEditingStrategyId(savedId);
      if (activate) {
        setLedgerTab('positions');
      }
    } finally {
      setSavingBot(false);
    }
  };

  const handleLoadStrategyIntoStudio = (strat: AlgoStrategyRecord) => {
    setDraft({
      name: strat.name,
      prompt: strat.prompt,
      summary: strat.summary,
      symbols: strat.symbols,
      timeframe: strat.timeframe,
      logicOperator: strat.logicOperator,
      entryConditions: strat.entryConditions,
      exitConditions: strat.exitConditions,
      virtualCapital: strat.virtualCapital,
      allocationPercent: strat.allocationPercent,
      stopLossPct: strat.stopLossPct,
      takeProfitPct: strat.takeProfitPct,
      trailingStopPct: strat.trailingStopPct,
      maxOpenPositions: strat.maxOpenPositions,
      dailyLossCapPct: strat.dailyLossCapPct,
      slippageBps: strat.slippageBps,
    });
    setEditingStrategyId(strat.id);
    setCompileNotice(`Loaded "${strat.name}" into Rule Studio.`);
  };

  const addSymbolToDraft = (sym: string) => {
    const normalized = sym.trim().toUpperCase();
    if (!normalized) return;
    setDraft((prev) => {
      if (prev.symbols.includes(normalized) || prev.symbols.length >= 10) return prev;
      return { ...prev, symbols: [...prev.symbols, normalized] };
    });
    setSymbolQuery('');
    setSymbolResults([]);
  };

  const removeSymbolFromDraft = (sym: string) => {
    setDraft((prev) => {
      if (prev.symbols.length <= 1) return prev;
      return { ...prev, symbols: prev.symbols.filter((s) => s !== sym) };
    });
  };

  const updateCondition = (
    group: 'entryConditions' | 'exitConditions',
    idx: number,
    patch: Partial<AlgoRuleCondition>
  ) => {
    setDraft((prev) => {
      const updated = prev[group].map((cond, cIdx) => {
        if (cIdx !== idx) return cond;
        const nextInd = patch.indicator ?? cond.indicator;
        const nextComp = patch.comparator ?? cond.comparator;
        const nextThresh =
          patch.threshold !== undefined ? patch.threshold : cond.threshold;
        return {
          ...cond,
          indicator: nextInd,
          comparator: nextComp,
          threshold: nextThresh,
          label: buildConditionLabel(nextInd, nextComp, nextThresh),
        };
      });
      return { ...prev, [group]: updated };
    });
  };

  const addCondition = (group: 'entryConditions' | 'exitConditions') => {
    setDraft((prev) => {
      if (prev[group].length >= 6) return prev;
      const defaultInd: AlgoIndicator = group === 'entryConditions' ? 'RSI_14' : 'RSI_14';
      const defaultComp: AlgoComparator = group === 'entryConditions' ? 'LT' : 'GT';
      const defaultThresh = group === 'entryConditions' ? 40 : 72;
      return {
        ...prev,
        [group]: [
          ...prev[group],
          {
            id: `${group === 'entryConditions' ? 'entry' : 'exit'}_${Date.now()}`,
            indicator: defaultInd,
            comparator: defaultComp,
            threshold: defaultThresh,
            label: buildConditionLabel(defaultInd, defaultComp, defaultThresh),
          },
        ],
      };
    });
  };

  const removeCondition = (group: 'entryConditions' | 'exitConditions', idx: number) => {
    setDraft((prev) => {
      if (group === 'entryConditions' && prev.entryConditions.length <= 1) return prev;
      return {
        ...prev,
        [group]: prev[group].filter((_, i) => i !== idx),
      };
    });
  };

  const openPositions = paperEvalResult?.openPositions ?? [];

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'ALL') return orders;
    return orders.filter((o) => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Workspace Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Paper Simulation & Backtest Lab</span>
            <span aria-hidden="true">·</span>
            <span>Live NSE OHLCV Data</span>
            <span aria-hidden="true">·</span>
            <span>{isGuestMode ? 'Guest Sandbox (Sign in to sync)' : 'Cloud Firestore Synced'}</span>
          </div>
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Algo Trading & Historical Backtesting Lab
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Compile plain-English trading rules with AI, backtest against historical NSE OHLCV bars vs Nifty 50, and automate live paper execution protected by hard stop-loss and daily loss circuit-breakers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleRunBacktest(draft)}
            disabled={backtesting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {backtesting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{backtesting ? 'Simulating Bars...' : 'Run Historical Backtest'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSaveAndOptionallyActivate(true)}
            disabled={savingBot}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>{editingStrategyId ? 'Update & Activate Bot' : 'Save & Activate Paper Bot'}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Live Session Risk Overview (Daily Loss Cap vs. Current Day P&L & Kill-Switch) */}
      <AlgoRiskOverview
        strategies={strategies}
        telemetry={paperEvalResult?.strategyTelemetry ?? []}
        draftCapital={draft.virtualCapital}
        draftDailyLossCapPct={draft.dailyLossCapPct}
        evaluatedAt={paperEvalResult?.evaluatedAt ?? null}
        paperEvalLoading={paperEvalLoading}
        autoTickEnabled={autoTickEnabled}
        onToggleAutoTick={onToggleAutoTick}
        onEvaluatePaperNow={onEvaluatePaperNow}
        onHaltAllBots={onHaltAllBots}
        onToggleStrategyStatus={onToggleStrategyStatus}
      />

      {/* Section 2: AI Natural-Language Strategy Composer & Structured Guardrails */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-700" />
              <span>AI Natural-Language Rule Compiler</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Describe entry triggers, target NSE stocks, stop-loss, profit targets, and daily loss limits in plain English.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.title}
                type="button"
                onClick={() => {
                  setDraft((prev) => ({ ...prev, prompt: qp.prompt }));
                  setCompileError(null);
                  setCompileNotice(null);
                }}
                className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                {qp.title}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input Row */}
        <div className="flex flex-col md:flex-row gap-3">
          <textarea
            value={draft.prompt}
            onChange={(e) => setDraft((prev) => ({ ...prev, prompt: e.target.value.slice(0, 500) }))}
            rows={2}
            placeholder="e.g. Buy RELIANCE and TCS when RSI(14) drops below 35 above the 200-DMA, sell on RSI > 70, 4% stop-loss, 10% target, 2.5% daily loss cap"
            className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white resize-none"
          />
          <div className="flex md:flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleRunCompile()}
              disabled={compiling}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {compiling ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{compiling ? 'Compiling...' : 'Generate Rules with AI'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAndOptionallyActivate(false)}
              disabled={savingBot}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingStrategyId ? 'Save Changes' : 'Save Draft'}</span>
            </button>
          </div>
        </div>

        {compileNotice && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
            {compileNotice}
          </div>
        )}
        {compileError && (
          <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{compileError}</span>
          </div>
        )}

        {/* Structured Rule Inspector & Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          {/* Strategy Metadata & Target Universe */}
          <div className="lg:col-span-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Strategy Name
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value.slice(0, 100) }))}
                  className="w-full px-3 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Timeframe
                  </label>
                  <select
                    value={draft.timeframe}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, timeframe: e.target.value as AlgoTimeframe }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {TIMEFRAME_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Entry Logic
                  </label>
                  <select
                    value={draft.logicOperator}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        logicOperator: e.target.value as AlgoLogicOperator,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="AND">ALL (AND)</option>
                    <option value="OR">ANY (OR)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Target NSE/BSE Symbols Picker */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-500">
                  Target NSE/BSE Symbols ({draft.symbols.length}/10)
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {draft.symbols.map((sym) => (
                  <span
                    key={sym}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono-tabular font-semibold bg-slate-100 text-slate-800 border border-slate-200 rounded-md"
                  >
                    <span>{sym.replace(/\.(NS|BO)$/, '')}</span>
                    {draft.symbols.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSymbolFromDraft(sym)}
                        className="text-slate-400 hover:text-red-700"
                        aria-label={`Remove ${sym}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={symbolQuery}
                  onChange={(e) => setSymbolQuery(e.target.value)}
                  placeholder="Add NSE stock (e.g. SBIN, TITAN, HAL)..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
                {(symbolResults.length > 0 || searchingSymbols) && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {searchingSymbols && (
                      <div className="px-3 py-2 text-xs text-slate-500">Searching NSE/BSE...</div>
                    )}
                    {symbolResults.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => addSymbolToDraft(item.symbol)}
                        className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-50 text-xs"
                      >
                        <span className="font-semibold text-slate-900">{item.ticker}</span>
                        <span className="text-slate-500 truncate flex-1">{item.name}</span>
                        <span className="text-[11px] font-mono-tabular text-blue-700">Add</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Compiled Entry & Exit Predicates */}
          <div className="lg:col-span-7 space-y-4">
            {/* Entry Conditions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-500">
                  Entry Conditions ({draft.logicOperator})
                </span>
                {draft.entryConditions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => addCondition('entryConditions')}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" /> Add Entry Rule
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {draft.entryConditions.map((cond, idx) => (
                  <div
                    key={cond.id}
                    className="grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 rounded-lg p-2"
                  >
                    <select
                      value={cond.indicator}
                      onChange={(e) => {
                        const nextInd = e.target.value as AlgoIndicator;
                        const def = INDICATOR_OPTIONS.find((o) => o.value === nextInd);
                        updateCondition('entryConditions', idx, {
                          indicator: nextInd,
                          threshold: def?.defaultThreshold ?? cond.threshold,
                        });
                      }}
                      className="col-span-5 px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-900"
                    >
                      {INDICATOR_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cond.comparator}
                      onChange={(e) =>
                        updateCondition('entryConditions', idx, {
                          comparator: e.target.value as AlgoComparator,
                        })
                      }
                      className="col-span-4 px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-900"
                    >
                      {COMPARATOR_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      value={cond.threshold}
                      onChange={(e) =>
                        updateCondition('entryConditions', idx, {
                          threshold: Number(e.target.value),
                        })
                      }
                      className="col-span-2 px-2 py-1 text-xs font-mono-tabular bg-white border border-slate-200 rounded text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={draft.entryConditions.length <= 1}
                      onClick={() => removeCondition('entryConditions', idx)}
                      className="col-span-1 flex items-center justify-center p-1 text-slate-400 hover:text-red-700 disabled:opacity-30"
                      aria-label="Remove entry condition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Exit Conditions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-500">
                  Technical Exit Triggers (Optional alongside SL/Target)
                </span>
                {draft.exitConditions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => addCondition('exitConditions')}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" /> Add Exit Rule
                  </button>
                )}
              </div>
              {draft.exitConditions.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">
                  Exits managed purely via Stop-Loss, Trailing Stop, and Take-Profit Target.
                </div>
              ) : (
                <div className="space-y-2">
                  {draft.exitConditions.map((cond, idx) => (
                    <div
                      key={cond.id}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 rounded-lg p-2"
                    >
                      <select
                        value={cond.indicator}
                        onChange={(e) => {
                          const nextInd = e.target.value as AlgoIndicator;
                          const def = INDICATOR_OPTIONS.find((o) => o.value === nextInd);
                          updateCondition('exitConditions', idx, {
                            indicator: nextInd,
                            threshold: def?.defaultThreshold ?? cond.threshold,
                          });
                        }}
                        className="col-span-5 px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-900"
                      >
                        {INDICATOR_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={cond.comparator}
                        onChange={(e) =>
                          updateCondition('exitConditions', idx, {
                            comparator: e.target.value as AlgoComparator,
                          })
                        }
                        className="col-span-4 px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-900"
                      >
                        {COMPARATOR_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        value={cond.threshold}
                        onChange={(e) =>
                          updateCondition('exitConditions', idx, {
                            threshold: Number(e.target.value),
                          })
                        }
                        className="col-span-2 px-2 py-1 text-xs font-mono-tabular bg-white border border-slate-200 rounded text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => removeCondition('exitConditions', idx)}
                        className="col-span-1 flex items-center justify-center p-1 text-slate-400 hover:text-red-700"
                        aria-label="Remove exit condition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Risk Guardrails & Position Sizing Strip */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Virtual Capital (₹)
            </label>
            <input
              type="number"
              min={10000}
              max={100000000}
              step={50000}
              value={draft.virtualCapital}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  virtualCapital: Math.max(10000, Number(e.target.value) || 100000),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Size / Trade (%)
            </label>
            <input
              type="number"
              min={5}
              max={100}
              step={5}
              value={draft.allocationPercent}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  allocationPercent: Math.min(100, Math.max(5, Number(e.target.value) || 25)),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Stop-Loss (%)
            </label>
            <input
              type="number"
              min={0.5}
              max={50}
              step={0.5}
              value={draft.stopLossPct}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  stopLossPct: Math.min(50, Math.max(0.5, Number(e.target.value) || 4)),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono-tabular text-red-700 font-semibold bg-red-50/40 border border-red-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Take-Profit (%)
            </label>
            <input
              type="number"
              min={0.5}
              max={200}
              step={0.5}
              value={draft.takeProfitPct}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  takeProfitPct: Math.min(200, Math.max(0.5, Number(e.target.value) || 10)),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono-tabular text-green-700 font-semibold bg-green-50/40 border border-green-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Trailing SL (%)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={draft.trailingStopPct}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  trailingStopPct: Math.min(50, Math.max(0, Number(e.target.value) || 0)),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Max Positions
            </label>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              value={draft.maxOpenPositions}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  maxOpenPositions: Math.min(20, Math.max(1, Math.round(Number(e.target.value) || 4))),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Daily Loss Cap (%)
            </label>
            <input
              type="number"
              min={0.5}
              max={25}
              step={0.5}
              value={draft.dailyLossCapPct}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  dailyLossCapPct: Math.min(25, Math.max(0.5, Number(e.target.value) || 2.5)),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono-tabular text-amber-800 font-semibold bg-amber-50/50 border border-amber-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Slippage (bps)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={draft.slippageBps}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  slippageBps: Math.min(100, Math.max(0, Number(e.target.value) || 10)),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Analytical Split Viewport (Backtest Equity Curve + Paper Guardrail Console) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Backtest Chart & Scorecard */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-700" />
                <span>
                  {backtestResult
                    ? `Backtest Equity Curve: ${backtestResult.strategyName}`
                    : 'Historical OHLCV Backtest Curve'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {backtestResult
                  ? `${backtestResult.barCount} bars · ${backtestResult.symbolsTested
                      .map((s) => s.replace(/\.(NS|BO)$/, ''))
                      .join(', ')} vs NIFTY 50`
                  : 'Run a historical simulation to benchmark against Nifty 50.'}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setChartMode('equity')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartMode === 'equity'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Equity vs Nifty (100)
              </button>
              <button
                type="button"
                onClick={() => setChartMode('drawdown')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartMode === 'drawdown'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Drawdown (%)
              </button>
            </div>
          </div>

          {backtestError && (
            <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{backtestError}</span>
            </div>
          )}

          {/* Chart Viewport */}
          <div className="h-72 w-full">
            {backtesting ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 gap-2 bg-slate-50/70 rounded-lg border border-slate-100">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-700" />
                <span>Running bar-by-bar OHLCV backtest & guardrail checks...</span>
              </div>
            ) : backtestResult && backtestResult.equityCurve.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'equity' ? (
                  <LineChart
                    data={backtestResult.equityCurve}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      minTickGap={28}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      width={46}
                    />
                    <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        `${Number(value).toFixed(2)}`,
                        name === 'equityIndexed' ? 'Algo Strategy (Base 100)' : 'NIFTY 50 (Base 100)',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="equityIndexed"
                      name="equityIndexed"
                      stroke="#1d4ed8"
                      strokeWidth={2.2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="niftyIndexed"
                      name="niftyIndexed"
                      stroke="#64748b"
                      strokeWidth={1.6}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <AreaChart
                    data={backtestResult.equityCurve}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      minTickGap={28}
                    />
                    <YAxis
                      domain={['auto', 0]}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      width={46}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                      formatter={(value: unknown) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
                    />
                    <Area
                      type="monotone"
                      dataKey="drawdownPct"
                      stroke="#dc2626"
                      fill="#fee2e2"
                      strokeWidth={1.8}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                No historical backtest data yet. Click Run Historical Backtest above.
              </div>
            )}
          </div>

          {/* 8-Metric Backtest KPI Grid */}
          {backtestResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              <div>
                <div className="text-[11px] text-slate-500">Final Equity</div>
                <div className="text-sm font-bold font-mono-tabular text-slate-900">
                  {formatINR(backtestResult.summary.finalEquity)}
                </div>
                <div
                  className={`text-[11px] font-mono-tabular font-semibold ${
                    backtestResult.summary.netPnl >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {backtestResult.summary.netPnl >= 0 ? '+' : ''}
                  {formatINR(backtestResult.summary.netPnl)}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">Total Return vs Nifty</div>
                <div
                  className={`text-sm font-bold font-mono-tabular ${
                    backtestResult.summary.totalReturnPct >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {formatPercent(backtestResult.summary.totalReturnPct)}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500">
                  Alpha {formatPercent(backtestResult.summary.alphaPct)}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">Sharpe / Max DD</div>
                <div className="text-sm font-bold font-mono-tabular text-slate-900">
                  {backtestResult.summary.sharpeRatio.toFixed(2)}
                </div>
                <div className="text-[11px] font-mono-tabular text-red-700">
                  -{backtestResult.summary.maxDrawdownPct.toFixed(2)}% DD
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">Win Rate / Profit Factor</div>
                <div className="text-sm font-bold font-mono-tabular text-slate-900">
                  {backtestResult.summary.winRatePct.toFixed(1)}% ({backtestResult.summary.winningTrades}/
                  {backtestResult.summary.totalTrades})
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500">
                  PF {backtestResult.summary.profitFactor.toFixed(2)} · {backtestResult.summary.guardrailHaltsTriggered} halts
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Saved Paper Strategies */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Saved Paper Strategies ({strategies.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click any strategy to load its rules into Rule Studio
                </p>
              </div>
            </div>

            {/* Saved Strategies List */}
            <div>

              {strategies.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3.5 text-center">
                  No saved bots yet. Click <strong>Save & Activate Paper Bot</strong> above to deploy your rules in paper mode.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                  {strategies.map((strat) => {
                    const isActive = strat.status === 'ACTIVE';
                    const isRiskHalted = strat.status === 'PAUSED_RISK_CAP';
                    return (
                      <div key={strat.id} className="py-2.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleLoadStrategyIntoStudio(strat)}
                            className="text-left min-w-0 hover:text-blue-700"
                          >
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {strat.name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono-tabular truncate">
                              {strat.symbols.map((s) => s.replace(/\.(NS|BO)$/, '')).join(', ')} · SL {strat.stopLossPct}% · Cap {strat.dailyLossCapPct}%
                            </div>
                          </button>

                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${
                              isActive
                                ? 'bg-green-50 text-green-800 border-green-200'
                                : isRiskHalted
                                ? 'bg-red-50 text-red-800 border-red-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isRiskHalted ? 'RISK HALT' : strat.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono-tabular text-slate-500">
                            {strat.lastBacktestReturnPct !== undefined
                              ? `Backtest ${formatPercent(strat.lastBacktestReturnPct)}`
                              : formatINR(strat.virtualCapital)}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isActive ? (
                              <button
                                type="button"
                                onClick={() => void onToggleStrategyStatus(strat, 'PAUSED')}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200"
                              >
                                <Pause className="w-3 h-3" /> Pause
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void onToggleStrategyStatus(strat, 'ACTIVE')}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-blue-800 bg-blue-50 rounded hover:bg-blue-100"
                              >
                                {isRiskHalted ? (
                                  <>
                                    <RotateCcw className="w-3 h-3" /> Reset Cap
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3 h-3" /> Activate
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void onDeleteStrategy(strat.id)}
                              className="p-1 text-slate-400 hover:text-red-700 rounded"
                              aria-label={`Delete ${strat.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Tabbed Execution Ledgers (Backtest Trades, Open Paper Positions, Order Book) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setLedgerTab('backtest')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                ledgerTab === 'backtest'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Backtest Trade Log ({backtestResult?.trades.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setLedgerTab('positions')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                ledgerTab === 'positions'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Paper Positions ({openPositions.length})
            </button>
            <button
              type="button"
              onClick={() => setLedgerTab('orders')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                ledgerTab === 'orders'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paper Order Book ({orders.length})
            </button>
          </div>

          {ledgerTab === 'orders' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['ALL', 'FILLED', 'BLOCKED_RISK_CAP'] as const).map((statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setOrderStatusFilter(statusKey)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      orderStatusFilter === statusKey
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {statusKey === 'ALL'
                      ? 'All'
                      : statusKey === 'FILLED'
                      ? 'Filled'
                      : 'Risk Blocked'}
                  </button>
                ))}
              </div>
              {orders.length > 0 && (
                <button
                  type="button"
                  onClick={() => void onClearOrders()}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 whitespace-nowrap shrink-0"
                >
                  Clear Order Log
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab 1: Historical Backtest Trades */}
        {ledgerTab === 'backtest' && (
          <div className="space-y-4">
            {backtestResult && backtestResult.guardrailEvents.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Daily Loss Cap Circuit-Breakers Triggered During Simulation</span>
                </div>
                <div className="text-xs text-amber-800 space-y-0.5">
                  {backtestResult.guardrailEvents.slice(0, 5).map((ev, i) => (
                    <div key={i}>
                      <span className="font-mono-tabular font-semibold">{ev.dateLabel}</span>: {ev.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!backtestResult || backtestResult.trades.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center">
                No historical trades triggered for these entry rules in this timeframe. Try loosening RSI/DMA thresholds or switching to a 1Y window.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2 pr-3">Stock</th>
                      <th className="py-2 px-3">Entry Date</th>
                      <th className="py-2 px-3">Exit Date</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Entry ₹</th>
                      <th className="py-2 px-3 text-right">Exit ₹</th>
                      <th className="py-2 px-3 text-right">Net P&L</th>
                      <th className="py-2 px-3 text-right">Return</th>
                      <th className="py-2 pl-3">Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {backtestResult.trades.slice(0, 60).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 font-semibold text-slate-900">
                          <button
                            type="button"
                            onClick={() => onInspectChart(t.symbol)}
                            className="hover:text-blue-700 inline-flex items-center gap-1"
                          >
                            <span>{t.ticker}</span>
                            <CandlestickChart className="w-3 h-3 text-slate-400" />
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-slate-600">{t.entryDate}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-slate-600">{t.exitDate}</td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-900">
                          {t.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                          {formatINR(t.entryPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                          {formatINR(t.exitPrice)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                            t.netPnl >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {t.netPnl >= 0 ? '+' : ''}
                          {formatINR(t.netPnl)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                            t.pnlPct >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {formatPercent(t.pnlPct)}
                        </td>
                        <td className="py-2.5 pl-3 text-[11px] font-medium text-slate-700">
                          {t.exitReason.replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Live Paper Positions */}
        {ledgerTab === 'positions' && (
          <div>
            {openPositions.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center">
                No open simulated paper positions. Activate a strategy and click <strong>Scan Live Ticks</strong> when NSE market rules trigger.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2 pr-3">Stock / Bot</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Avg Entry</th>
                      <th className="py-2 px-3 text-right">Live LTP</th>
                      <th className="py-2 px-3 text-right">Guardrail SL / Target</th>
                      <th className="py-2 px-3 text-right">Unrealized P&L</th>
                      <th className="py-2 pl-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {openPositions.map((pos) => {
                      const live = quotes[pos.symbol]?.price ?? pos.livePrice;
                      const mktVal = live * pos.quantity;
                      const uPnl = mktVal - pos.investedValue;
                      const uPct = pos.investedValue > 0 ? (uPnl / pos.investedValue) * 100 : 0;
                      return (
                        <tr key={`${pos.strategyId}_${pos.symbol}`} className="hover:bg-slate-50/70">
                          <td className="py-2.5 pr-3">
                            <div className="font-semibold text-slate-900">{pos.ticker}</div>
                            <div className="text-[11px] text-slate-500">{pos.strategyName}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-900">
                            {pos.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {formatINR(pos.avgEntryPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                            {formatINR(live)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-[11px]">
                            <span className="text-red-700">{formatINR(pos.stopLossPrice)}</span>
                            <span className="text-slate-400"> / </span>
                            <span className="text-green-700">{formatINR(pos.targetPrice)}</span>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                              uPnl >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {uPnl >= 0 ? '+' : ''}
                            {formatINR(uPnl)} ({formatPercent(uPct)})
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onInspectChart(pos.symbol, {
                                    avgBuyPrice: pos.avgEntryPrice,
                                    stopLoss: pos.stopLossPrice,
                                    targetPrice: pos.targetPrice,
                                  })
                                }
                                className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 whitespace-nowrap shrink-0"
                              >
                                Chart
                              </button>
                              <button
                                type="button"
                                onClick={() => void onSquareOffPosition(pos)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-red-800 bg-red-50 border border-red-200 rounded hover:bg-red-100 whitespace-nowrap shrink-0"
                              >
                                Square Off
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Paper Order Book */}
        {ledgerTab === 'orders' && (
          <div>
            {filteredOrders.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center">
                No simulated orders recorded yet. Activate a paper strategy to start logging fills and guardrail checks.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2 pr-3">Timestamp</th>
                      <th className="py-2 px-3">Strategy</th>
                      <th className="py-2 px-3">Stock</th>
                      <th className="py-2 px-3">Side / Status</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Fill Price</th>
                      <th className="py-2 px-3 text-right">Realized P&L</th>
                      <th className="py-2 pl-3">Trigger / Guardrail Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 font-mono-tabular text-[11px] text-slate-600 whitespace-nowrap">
                          {new Date(ord.executedAtIso).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {ord.strategyName}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular font-semibold text-slate-900">
                          {ord.symbol.replace(/\.(NS|BO)$/, '')}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              ord.status !== 'FILLED'
                                ? 'text-amber-800'
                                : ord.side === 'BUY'
                                ? 'text-blue-700'
                                : 'text-red-700'
                            }`}
                          >
                            {ord.side} · {ord.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-900">
                          {ord.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-800">
                          {formatINR(ord.price)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                            ord.realizedPnl > 0
                              ? 'text-green-700'
                              : ord.realizedPnl < 0
                              ? 'text-red-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {ord.side === 'SELL' && ord.status === 'FILLED'
                            ? `${ord.realizedPnl >= 0 ? '+' : ''}${formatINR(ord.realizedPnl)}`
                            : '—'}
                        </td>
                        <td className="py-2.5 pl-3 text-[11px] text-slate-600 max-w-xs">
                          {ord.triggerReason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
