import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Database,
  Layers,
  Plus,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { EnrichedHolding, MutualFundAnalysisResponse, MutualFundHoldingRecord } from '../types/market';
import { formatINR, formatPercent, type PortfolioDiagnosticsSummary } from '../utils/portfolioAnalytics';

interface OverviewDashboardViewProps {
  holdings: EnrichedHolding[];
  diagnostics: PortfolioDiagnosticsSummary;
  mfHoldings: MutualFundHoldingRecord[];
  mfAnalysis: MutualFundAnalysisResponse | null;
  loadingMfAnalysis: boolean;
  isGuestMode: boolean;
  busyDemo?: boolean;
  onNavigate: (
    tab: 'portfolio' | 'mutualFunds' | 'diagnostics' | 'charts' | 'screener' | 'signals'
  ) => void;
  onAddStock: () => void;
  onUploadStockScreenshot: () => void;
  onAddMutualFund: () => void;
  onImportMutualFunds: () => void;
  onPreloadAllDemo: () => void;
  onInspectChart: (symbol: string, avgBuyPrice?: number) => void;
}

export function OverviewDashboardView({
  holdings,
  diagnostics,
  mfHoldings,
  mfAnalysis,
  loadingMfAnalysis,
  isGuestMode,
  busyDemo = false,
  onNavigate,
  onAddStock,
  onUploadStockScreenshot,
  onAddMutualFund,
  onImportMutualFunds,
  onPreloadAllDemo,
  onInspectChart,
}: OverviewDashboardViewProps) {
  const mfSummary = mfAnalysis?.summary ?? {
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

  const hasEquities = holdings.length > 0;
  const hasMf = mfHoldings.length > 0;
  const hasAnyPortfolio = hasEquities || hasMf;

  const combinedCurrent = diagnostics.totalCurrent + mfSummary.totalCurrent;
  const combinedInvested = diagnostics.totalInvested + mfSummary.totalInvested;
  const combinedGain = combinedCurrent - combinedInvested;
  const combinedGainPct = combinedInvested > 0 ? (combinedGain / combinedInvested) * 100 : 0;
  const combinedGainPos = combinedGain >= 0;

  const equitySharePct = combinedCurrent > 0 ? (diagnostics.totalCurrent / combinedCurrent) * 100 : 0;
  const mfSharePct = combinedCurrent > 0 ? (mfSummary.totalCurrent / combinedCurrent) * 100 : 0;

  const topMovers = [
    ...holdings.map((h) => ({
      key: `eq_${h.id}`,
      kind: 'Equity' as const,
      name: h.symbol.replace(/\.(NS|BO)$/, ''),
      subtitle: h.sector,
      value: h.currentValue,
      gain: h.totalPnl,
      gainPct: h.totalPnlPercent,
      onClick: () => onInspectChart(h.symbol, h.avgBuyPrice),
    })),
    ...(mfAnalysis?.funds ?? []).map((f) => ({
      key: `mf_${f.holding.id}`,
      kind: 'Mutual Fund' as const,
      name: f.holding.schemeName.split(' - ')[0],
      subtitle: `${f.holding.planType} · ${f.holding.category}`,
      value: f.currentValue,
      gain: f.unrealizedGain,
      gainPct: f.unrealizedGainPercent,
      onClick: () => onNavigate('mutualFunds'),
    })),
  ]
    .sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain))
    .slice(0, 6);

  if (!hasAnyPortfolio) {
    return (
      <div className="space-y-6">
        <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-medium text-blue-700">
              {isGuestMode ? 'Guest Workspace · Clean Start' : 'Cloud Portfolio · Clean Start'}
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Welcome to Stoxify — start with your own portfolio or test with sample data
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your equity and mutual fund workspaces start empty by default so zero dummy numbers mix with your real investments. Import broker screenshots or CAS statements, log a position manually, or load a sample portfolio to preview live analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 bg-slate-50/50">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <Briefcase className="w-4 h-4 text-blue-700" />
                  <span>NSE / BSE Equities</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Import holdings via Zerodha Kite CSV or broker screenshots, or add stocks manually for live P&amp;L and dividend tracking.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onUploadStockScreenshot}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" /> Import CSV / Shot
                </button>
                <button
                  type="button"
                  onClick={onAddStock}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Stock
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 bg-slate-50/50">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <Layers className="w-4 h-4 text-blue-700" />
                  <span>Mutual Funds Pro</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Upload Zerodha Coin/Kite CSVs, CAS PDFs, or screenshots, or add AMFI schemes to audit TER leaks, grades, and FIFO exit loads.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onImportMutualFunds}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" /> Import CSV / CAS
                </button>
                <button
                  type="button"
                  onClick={onAddMutualFund}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Fund
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 bg-white">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <Database className="w-4 h-4 text-slate-700" />
                  <span>Explore Sample Portfolio</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pre-load 6 sample NSE stocks and 5 AMFI mutual funds (including Regular leaks &amp; dead-stock flags) to test filters and analytics. Clear anytime in one click.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={onPreloadAllDemo}
                  disabled={busyDemo}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Database className="w-3.5 h-3.5" />
                  {busyDemo ? 'Pre-loading Demo...' : 'Pre-load Demo Portfolio'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('charts')}
            className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
          >
            <div className="text-xs font-semibold text-slate-900">Live NSE/BSE Chart Terminal</div>
            <div className="text-xs text-slate-500 mt-1">
              Inspect NIFTY 50, SENSEX, Bank NIFTY, and OHLC candles with 50/200-DMA overlays.
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('screener')}
            className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
          >
            <div className="text-xs font-semibold text-slate-900">Pro Stock Screener</div>
            <div className="text-xs text-slate-500 mt-1">
              Screen and sort NSE/BSE stocks by Golden Crossover, Volume Shockers, ROCE, P/E, and RSI.
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('signals')}
            className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
          >
            <div className="text-xs font-semibold text-slate-900">Research Signals</div>
            <div className="text-xs text-slate-500 mt-1">
              Review high-conviction technical setups with live risk/reward target and stop levels.
            </div>
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4-Column Combined Wealth KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Combined Net Worth</div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
            {formatINR(combinedCurrent)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            Invested {formatINR(combinedInvested)} · {holdings.length + mfHoldings.length} positions
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Combined Unrealized P&amp;L</div>
          <div
            className={`text-2xl font-bold font-mono-tabular mt-1.5 ${
              combinedGainPos ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {combinedGainPos ? '+' : ''}
            {formatINR(combinedGain)}
          </div>
          <div
            className={`inline-flex items-center gap-1 text-xs font-semibold font-mono-tabular mt-1 ${
              combinedGainPos ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {combinedGainPos ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {formatPercent(combinedGainPct)} overall
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('portfolio')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Equity Portfolio</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
            {formatINR(diagnostics.totalCurrent)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            {holdings.length} stocks ·{' '}
            <span className={diagnostics.totalPnl >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
              {formatPercent(diagnostics.totalPnlPercent)}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('mutualFunds')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Mutual Funds Pro</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
            {loadingMfAnalysis && mfSummary.totalCurrent === 0
              ? 'Loading...'
              : formatINR(mfSummary.totalCurrent)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            {mfHoldings.length} schemes ·{' '}
            <span className={mfSummary.totalGain >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
              {formatPercent(mfSummary.totalGainPercent)}
            </span>
          </div>
        </button>
      </div>

      {/* Asset Allocation Bar + Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Asset Class Split</h3>
            <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
              Equities {equitySharePct.toFixed(1)}% ({formatINR(diagnostics.totalCurrent)}) · Mutual Funds{' '}
              {mfSharePct.toFixed(1)}% ({formatINR(mfSummary.totalCurrent)})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onUploadStockScreenshot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/70 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" /> Import Stock CSV / Shot
            </button>
            <button
              type="button"
              onClick={onImportMutualFunds}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/70 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" /> Import MF CSV / CAS
            </button>
          </div>
        </div>

        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-blue-700"
            style={{ width: `${Math.max(0, Math.min(100, equitySharePct))}%` }}
            title={`Equities ${equitySharePct.toFixed(1)}%`}
          />
          <div
            className="h-full bg-teal-600"
            style={{ width: `${Math.max(0, Math.min(100, mfSharePct))}%` }}
            title={`Mutual Funds ${mfSharePct.toFixed(1)}%`}
          />
        </div>
      </div>

      {/* 2-Column Split: Top Movers + Priority Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Largest Positions by Impact</h3>
              <p className="text-xs text-slate-500">Top contributors across stocks and mutual funds</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {topMovers.map((item) => {
              const pos = item.gain >= 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className="w-full px-5 py-3 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{item.name}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.kind} · {item.subtitle}
                    </div>
                  </div>
                  <div className="text-right font-mono-tabular shrink-0">
                    <div className="text-xs font-semibold text-slate-900">{formatINR(item.value)}</div>
                    <div
                      className={`text-[11px] font-medium ${
                        pos ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {pos ? '+' : ''}
                      {formatINR(item.gain)} ({formatPercent(item.gainPct)})
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Attention Required</h3>
            <p className="text-xs text-slate-500">Live diagnostics across both asset classes</p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 shrink-0 ${
                      diagnostics.deadStocks.length > 0 ? 'text-red-700' : 'text-green-700'
                    }`}
                  />
                  <span>
                    {diagnostics.deadStocks.length > 0
                      ? `${diagnostics.deadStocks.length} Dead-Stock Equity Flags`
                      : 'No Dead-Stock Equity Traps'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {hasEquities
                    ? `Annual dividend run-rate ${formatINR(diagnostics.totalExpectedAnnualDividends)}`
                    : 'No equity holdings tracked yet'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(hasEquities ? 'diagnostics' : 'portfolio')}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
              >
                {hasEquities ? 'Inspect →' : 'Add Stocks →'}
              </button>
            </div>

            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Sparkles
                    className={`w-3.5 h-3.5 shrink-0 ${
                      mfSummary.switchCount > 0 ? 'text-amber-700' : 'text-green-700'
                    }`}
                  />
                  <span>
                    {mfSummary.switchCount > 0
                      ? `${mfSummary.switchCount} MF Switch Opportunities`
                      : 'No Mutual Fund Switch Flags'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
                  {hasMf
                    ? mfSummary.regularCommissionLeak > 0
                      ? `Est. Regular commission leak: ${formatINR(mfSummary.regularCommissionLeak)}/yr`
                      : `${mfHoldings.length} schemes tracked against AMFI benchmarks`
                    : 'No mutual fund schemes tracked yet'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('mutualFunds')}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
              >
                {hasMf ? 'Review →' : 'Add Funds →'}
              </button>
            </div>
          </div>

          {!hasEquities || !hasMf ? (
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>Want to fill the empty asset class with sample data?</span>
              <button
                type="button"
                onClick={onPreloadAllDemo}
                disabled={busyDemo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/70 whitespace-nowrap shrink-0"
              >
                <Database className="w-3.5 h-3.5" /> Pre-load Missing Demo
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
