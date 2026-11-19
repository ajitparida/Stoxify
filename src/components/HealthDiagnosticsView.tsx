import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  LineChart,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type {
  CapitalRotationResponse,
  EnrichedHolding,
  Exchange,
  MarketQuote,
  PortfolioAnalysisResponse,
  RotationReplacementPick,
} from '../types/market';
import type { ChartOverlayLevels } from './MarketChartTerminal';
import {
  formatINR,
  formatPercent,
  type PortfolioDiagnosticsSummary,
} from '../utils/portfolioAnalytics';
import {
  ConfidenceBreakdownBar,
  EarningsRiskTag,
  getConfidenceScoreTone,
} from './ConfidenceBreakdownBar';
import { PortfolioHedgeCalculator } from './PortfolioHedgeCalculator';

interface AiBatchProgress {
  currentBatch: number;
  totalBatches: number;
  evaluatedCount: number;
  totalCount: number;
}

interface HealthDiagnosticsViewProps {
  holdings: EnrichedHolding[];
  diagnostics: PortfolioDiagnosticsSummary;
  niftyQuote: MarketQuote | null;
  aiAnalysis: PortfolioAnalysisResponse | null;
  aiLoading: boolean;
  aiProgress?: AiBatchProgress | null;
  aiError: string | null;
  onRunAiAnalysis: () => void;
  rotationData: CapitalRotationResponse | null;
  rotationLoading: boolean;
  rotationError: string | null;
  onRunCapitalRotation: () => void;
  onToggleWatchlist: (
    symbol: string,
    companyName: string,
    exchange: Exchange,
    sector: string
  ) => void;
  isInWatchlist: (symbol: string) => boolean;
  onStageRotationBuy: (
    pick: RotationReplacementPick,
    freedCapitalInr?: number,
    sourceTicker?: string
  ) => void;
  onInspectChart: (symbol: string, levels?: ChartOverlayLevels) => void;
}

const CAP_COLORS = ['#1D4ED8', '#0284C7', '#0F766E', '#64748B'];

export function HealthDiagnosticsView({
  holdings,
  diagnostics,
  niftyQuote,
  aiAnalysis,
  aiLoading,
  aiProgress = null,
  aiError,
  onRunAiAnalysis,
  rotationData,
  rotationLoading,
  rotationError,
  onRunCapitalRotation,
  onToggleWatchlist,
  isInWatchlist,
  onStageRotationBuy,
  onInspectChart,
}: HealthDiagnosticsViewProps) {
  const nifty6M = niftyQuote?.return6M ?? null;
  const totalEquityValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  const ratingBySymbol = new Map(
    (aiAnalysis?.ratings ?? []).map((r) => [r.symbol.toUpperCase(), r])
  );

  return (
    <div className="space-y-6">
      {/* Top Diagnostic Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Dead-Stock Laggards</div>
          <div
            className={`text-2xl font-bold font-mono-tabular mt-1.5 ${
              diagnostics.deadStocks.length > 0 ? 'text-red-700' : 'text-green-700'
            }`}
          >
            {diagnostics.deadStocks.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Positions trailing Nifty 50 (&gt;10% lag) below 200-DMA
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Portfolio Weighted Beta</div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
            {diagnostics.weightedBeta.toFixed(2)}x
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {diagnostics.weightedBeta > 1.15
              ? 'Aggressive volatility relative to Nifty 50'
              : diagnostics.weightedBeta < 0.85
              ? 'Defensive tilt relative to Nifty 50'
              : 'Balanced market sensitivity'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Nifty 50 Benchmark (6M)</div>
          <div
            className={`text-2xl font-bold font-mono-tabular mt-1.5 ${
              (nifty6M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {formatPercent(nifty6M)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Live benchmark reference for relative stock health
          </div>
        </div>
      </div>

      {/* AI-Powered Buy / Hold / Exit Portfolio Audit */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              AI Portfolio Analyst — Buy, Hold &amp; Exit Ratings
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluates every holding against live NSE/BSE prices, RSI-14, 50/200-DMA, P&amp;L, and Nifty 50 relative strength.
            </p>
          </div>
          <button
            type="button"
            disabled={aiLoading || holdings.length === 0}
            onClick={onRunAiAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {aiLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {aiLoading
              ? aiProgress && aiProgress.totalBatches > 1
                ? `Evaluating Batch ${aiProgress.currentBatch}/${aiProgress.totalBatches}...`
                : 'Evaluating Live Telemetry...'
              : aiAnalysis
              ? 'Refresh AI Ratings'
              : 'Run AI Portfolio Audit'}
          </button>
        </div>

        {aiLoading && aiProgress && aiProgress.totalBatches > 1 && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-lg px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-blue-950">
                Running Multi-Batch Evaluation (Batch {aiProgress.currentBatch} of{' '}
                {aiProgress.totalBatches})
              </span>
              <span className="font-mono-tabular text-blue-800 font-medium">
                {aiProgress.evaluatedCount} / {aiProgress.totalCount} holdings rated
              </span>
            </div>
            <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 transition-all duration-300"
                style={{
                  width: `${Math.max(
                    8,
                    Math.min(100, (aiProgress.evaluatedCount / Math.max(1, aiProgress.totalCount)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {aiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800 font-medium">
            {aiError}
          </div>
        )}

        {aiLoading && !aiAnalysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-36 bg-slate-50 border border-slate-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {!aiLoading && !aiAnalysis && !aiError && (
          <div className="border border-slate-200 bg-slate-50/60 rounded-lg p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              Ready to audit {holdings.length} active{' '}
              {holdings.length === 1 ? 'position' : 'positions'}
            </p>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              Click &ldquo;Run AI Portfolio Audit&rdquo; to generate per-stock BUY, HOLD, or EXIT verdicts with suggested target and stop-loss levels based on real-time exchange data.
            </p>
          </div>
        )}

        {aiAnalysis && (
          <div className="space-y-5">
            {aiAnalysis.quotaNotice && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Quantitative Fallback Engine Active: </span>
                  {aiAnalysis.quotaNotice}
                </div>
              </div>
            )}

            {/* Portfolio-Wide Executive Brief */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono-tabular">
                <span>
                  Evaluated {aiAnalysis.ratings.length} unique{' '}
                  {aiAnalysis.ratings.length === 1 ? 'holding' : 'holdings'}
                  {aiAnalysis.analysisSource === 'fallback_engine'
                    ? ' · Quantitative Engine'
                    : ''}
                </span>
                <span>
                  Updated {new Date(aiAnalysis.analyzedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <div className="font-semibold text-slate-900 mb-1">Portfolio Assessment</div>
                  <p className="text-slate-600 leading-relaxed">{aiAnalysis.overallSummary}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 mb-1">Diversification &amp; Risk</div>
                  <p className="text-slate-600 leading-relaxed">
                    {aiAnalysis.diversificationNote}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 mb-1">Top Action Priority</div>
                  <p className="text-slate-600 leading-relaxed">{aiAnalysis.actionPriority}</p>
                </div>
              </div>

              {aiAnalysis.portfolioProjection && (
                <div className="p-4 border border-slate-200 rounded-lg bg-white space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-900">
                      Equity Portfolio Horizon Forecast (1M · 3M · 6M · 1Y · 5Y · 10Y)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {aiAnalysis.portfolioProjection.basisNote ||
                        'Capital-weighted model forecast (not guaranteed returns)'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      ...(typeof aiAnalysis.portfolioProjection.value1M === 'number' &&
                      typeof aiAnalysis.portfolioProjection.return1MPercent === 'number'
                        ? [
                            {
                              label: 'Next 1 Month',
                              val: aiAnalysis.portfolioProjection.value1M,
                              pct: aiAnalysis.portfolioProjection.return1MPercent,
                              suffix: 'est. return',
                            },
                          ]
                        : []),
                      ...(typeof aiAnalysis.portfolioProjection.value3M === 'number' &&
                      typeof aiAnalysis.portfolioProjection.return3MPercent === 'number'
                        ? [
                            {
                              label: 'Next 3 Months',
                              val: aiAnalysis.portfolioProjection.value3M,
                              pct: aiAnalysis.portfolioProjection.return3MPercent,
                              suffix: 'est. return',
                            },
                          ]
                        : []),
                      {
                        label: 'Next 6 Months',
                        val: aiAnalysis.portfolioProjection.value6M,
                        pct: aiAnalysis.portfolioProjection.return6MPercent,
                        suffix: 'est. return',
                      },
                      {
                        label: 'Next 1 Year',
                        val: aiAnalysis.portfolioProjection.value1Y,
                        pct: aiAnalysis.portfolioProjection.return1YPercent,
                        suffix: 'est. return',
                      },
                      {
                        label: '5-Year Outlook',
                        val: aiAnalysis.portfolioProjection.value5Y,
                        pct: aiAnalysis.portfolioProjection.cagr5YPercent,
                        suffix: 'CAGR',
                      },
                      {
                        label: '10-Year Outlook',
                        val: aiAnalysis.portfolioProjection.value10Y,
                        pct: aiAnalysis.portfolioProjection.cagr10YPercent,
                        suffix: 'CAGR',
                      },
                    ].map((h) => (
                      <div
                        key={h.label}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <div className="text-[11px] text-slate-500">{h.label}</div>
                        <div className="text-sm font-bold font-mono-tabular text-slate-900 mt-0.5">
                          {formatINR(h.val, true)}
                        </div>
                        <div
                          className={`text-[11px] font-mono-tabular font-semibold mt-0.5 ${
                            h.pct >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {formatPercent(h.pct)} {h.suffix}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Per-Stock Rating Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiAnalysis.ratings.map((item, idx) => {
                const holding = holdings.find(
                  (h) => h.symbol.toUpperCase() === item.symbol.toUpperCase()
                );
                const verdictClasses =
                  item.rating === 'BUY'
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : item.rating === 'EXIT'
                    ? 'bg-red-50 text-red-800 border-red-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <div
                    key={`${item.symbol}_${idx}`}
                    className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3 bg-white"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
                            {item.confidence ? (
                              <span
                                className={`font-mono-tabular font-bold ${getConfidenceScoreTone(
                                  item.confidence.overallScore
                                )}`}
                              >
                                {item.confidence.overallScore.toFixed(1)}% Confidence
                              </span>
                            ) : (
                              <span>{item.conviction} Conviction</span>
                            )}
                            {holding && (
                              <>
                                <span>·</span>
                                <span className="font-mono-tabular">
                                  P&amp;L {formatPercent(holding.totalPnlPercent)}
                                </span>
                              </>
                            )}
                            {item.fundamentals?.source === 'live_yahoo' && (
                              <>
                                <span>·</span>
                                <span className="text-[10px] font-semibold text-emerald-700">
                                  Live Yahoo
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <h4 className="text-sm font-bold text-slate-900">
                              {item.symbol.replace(/\.(NS|BO)$/, '')}{' '}
                              <span className="font-normal text-slate-500 text-xs">
                                {holding?.companyName}
                              </span>
                            </h4>
                            <EarningsRiskTag
                              nextEarningsDate={item.fundamentals?.nextEarningsDate}
                              daysToEarnings={item.fundamentals?.daysToEarnings}
                              earningsRiskFlag={item.fundamentals?.earningsRiskFlag}
                              compact
                            />
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 text-xs font-bold border rounded-md shrink-0 ${verdictClasses}`}
                        >
                          {item.rating}
                        </span>
                      </div>

                      {item.confidence && (
                        <div className="pt-1.5 border-t border-slate-100">
                          <ConfidenceBreakdownBar confidence={item.confidence} variant="compact" />
                        </div>
                      )}

                      <div className="text-xs font-semibold text-slate-800">{item.headline}</div>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.rationale}</p>
                      <div className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">Key Risk:</span>{' '}
                        {item.keyRisk}
                      </div>
                      {item.guardrailNote && (
                        <div
                          className={`text-[11px] px-2.5 py-1.5 rounded border ${
                            item.guardrailStatus === 'FLAGGED'
                              ? 'bg-red-50 border-red-200 text-red-800'
                              : item.guardrailStatus === 'ADJUSTED'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <span className="font-semibold">
                            Guardrail {item.guardrailStatus || 'PASSED'}:
                          </span>{' '}
                          {item.guardrailNote}
                        </div>
                      )}
                      {item.projection && (
                        <div className="pt-1.5">
                          <div className="text-[11px] font-semibold text-slate-700 mb-1.5">
                            Price &amp; Return Outlook (1M · 3M · 6M · 1Y · 5Y · 10Y)
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                            {[
                              ...(typeof item.projection.value1M === 'number' &&
                              typeof item.projection.return1MPercent === 'number'
                                ? [
                                    {
                                      horizon: '1M',
                                      price: item.projection.value1M,
                                      pct: item.projection.return1MPercent,
                                      isCagr: false,
                                    },
                                  ]
                                : []),
                              ...(typeof item.projection.value3M === 'number' &&
                              typeof item.projection.return3MPercent === 'number'
                                ? [
                                    {
                                      horizon: '3M',
                                      price: item.projection.value3M,
                                      pct: item.projection.return3MPercent,
                                      isCagr: false,
                                    },
                                  ]
                                : []),
                              {
                                horizon: '6M',
                                price: item.projection.value6M,
                                pct: item.projection.return6MPercent,
                                isCagr: false,
                              },
                              {
                                horizon: '1Y',
                                price: item.projection.value1Y,
                                pct: item.projection.return1YPercent,
                                isCagr: false,
                              },
                              {
                                horizon: '5Y',
                                price: item.projection.value5Y,
                                pct: item.projection.cagr5YPercent,
                                isCagr: true,
                              },
                              {
                                horizon: '10Y',
                                price: item.projection.value10Y,
                                pct: item.projection.cagr10YPercent,
                                isCagr: true,
                              },
                            ].map((cell) => (
                              <div
                                key={cell.horizon}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded"
                              >
                                <div className="text-[10px] font-medium text-slate-500">
                                  {cell.horizon} {cell.isCagr ? 'CAGR' : 'Est.'}
                                </div>
                                <div className="font-mono-tabular font-semibold text-slate-900 truncate">
                                  {formatINR(cell.price)}
                                </div>
                                <div
                                  className={`font-mono-tabular font-semibold ${
                                    cell.pct >= 0 ? 'text-green-700' : 'text-red-700'
                                  }`}
                                >
                                  {formatPercent(cell.pct)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-4 font-mono-tabular">
                        <span>
                          <span className="text-slate-500">Target: </span>
                          <span className="font-semibold text-green-700">
                            {formatINR(item.suggestedTarget)}
                          </span>
                        </span>
                        <span>
                          <span className="text-slate-500">SL: </span>
                          <span className="font-semibold text-red-700">
                            {formatINR(item.suggestedStopLoss)}
                          </span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onInspectChart(item.symbol, {
                            avgBuyPrice: holding?.avgBuyPrice,
                            targetPrice: item.suggestedTarget,
                            stopLoss: item.suggestedStopLoss,
                          })
                        }
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium shrink-0"
                      >
                        <LineChart className="w-3.5 h-3.5" /> Chart Levels
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Portfolio 80/20 Cash Reserve & Live Index Bear Put Spread Hedge Calculator */}
      <PortfolioHedgeCalculator
        totalEquityValue={totalEquityValue}
        weightedBeta={diagnostics.weightedBeta}
        niftyQuote={niftyQuote}
      />

      {/* Smart Capital Rotation — Lock Gains & Redeploy */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-700 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                Smart Capital Rotation — Lock Gains &amp; Redeploy
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifies triple-digit / stretched winners and 200-DMA laggards to trim or exit, pairing each with high-ROCE, undervalued NSE replacements.
            </p>
          </div>
          <button
            type="button"
            disabled={rotationLoading || holdings.length === 0}
            onClick={onRunCapitalRotation}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {rotationLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-blue-700" />
            )}
            {rotationLoading
              ? 'Scanning Rotation Setups...'
              : rotationData
              ? 'Refresh Rotation Scan'
              : 'Scan Rotation Setups'}
          </button>
        </div>

        {rotationError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800 font-medium">
            {rotationError}
          </div>
        )}

        {rotationLoading && !rotationData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-44 bg-slate-50 border border-slate-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {!rotationLoading && !rotationData && !rotationError && (
          <div className="border border-slate-200 bg-slate-50/60 rounded-lg p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              Ready to scan {holdings.length}{' '}
              {holdings.length === 1 ? 'holding' : 'holdings'} for capital rotation opportunities
            </p>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              Automatically triggers with &ldquo;Run AI Portfolio Audit&rdquo;, or click &ldquo;Scan Rotation Setups&rdquo; to pair profit trims and laggards with undervalued compounders.
            </p>
          </div>
        )}

        {rotationData && (
          <div className="space-y-5">
            {rotationData.quotaNotice && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Quantitative Rotation Engine Active: </span>
                  {rotationData.quotaNotice}
                </div>
              </div>
            )}

            {/* Rotation Summary KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500">Eligible Freed Capital</div>
                <div className="text-lg font-bold font-mono-tabular text-slate-900 mt-0.5">
                  {formatINR(rotationData.totalEligibleFreedCapital, true)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Suggested trim/exit liquidity
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500">Rotation Triggers</div>
                <div className="text-lg font-bold font-mono-tabular text-slate-900 mt-0.5">
                  {rotationData.trimCount} Trims · {rotationData.exitCount} Exits
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Profit locks &amp; 200-DMA drags
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500">Portfolio ROCE Uplift</div>
                <div className="text-lg font-bold font-mono-tabular text-green-700 mt-0.5">
                  {rotationData.avgSourceRoce !== null
                    ? `${rotationData.avgSourceRoce.toFixed(1)}%`
                    : '—'}{' '}
                  →{' '}
                  {rotationData.avgReplacementRoce !== null
                    ? `${rotationData.avgReplacementRoce.toFixed(1)}%`
                    : '—'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Source avg vs replacement avg
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500">Nifty 50 Reference (6M)</div>
                <div
                  className={`text-lg font-bold font-mono-tabular mt-0.5 ${
                    (rotationData.benchmarkNifty6M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {formatPercent(rotationData.benchmarkNifty6M)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Updated{' '}
                  {new Date(rotationData.generatedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </div>
              </div>
            </div>

            {/* Paired Trim/Exit -> Undervalued Replacements */}
            {rotationData.pairs.length > 0 ? (
              <div className="space-y-4">
                {rotationData.pairs.map((pair) => {
                  const isTrim = pair.actionType === 'TRIM_PROFIT';
                  const splitFreed =
                    pair.candidates.length > 0
                      ? Math.round(pair.estimatedFreedCapital / pair.candidates.length)
                      : pair.estimatedFreedCapital;

                  return (
                    <div
                      key={`${pair.sourceSymbol}_${pair.actionType}`}
                      className="border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12"
                    >
                      {/* Source Position to Trim / Exit */}
                      <div className="lg:col-span-4 bg-slate-50/80 p-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 text-[11px] font-bold border rounded-md ${
                                isTrim
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-red-50 text-red-800 border-red-200'
                              }`}
                            >
                              {isTrim ? 'TRIM PROFIT' : 'EXIT LAGGARD'}
                            </span>
                            <span className="text-[11px] font-mono-tabular font-semibold text-slate-600">
                              Trim {pair.suggestedTrimPercent}%
                            </span>
                          </div>

                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              {pair.sourceTicker}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {pair.sourceCompanyName} · {pair.sourceSector}
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {pair.triggerReason}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs font-mono-tabular">
                          <div>
                            <div className="text-[10px] text-slate-400">Freed Capital</div>
                            <div className="font-bold text-slate-900">
                              {formatINR(pair.estimatedFreedCapital, true)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400">Unrealized P&amp;L</div>
                            <div
                              className={`font-bold ${
                                pair.unrealizedPnlPercent >= 0 ? 'text-green-700' : 'text-red-700'
                              }`}
                            >
                              {formatPercent(pair.unrealizedPnlPercent)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Current Value</div>
                            <div className="text-slate-700">
                              {formatINR(pair.currentValue, true)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400">Weight</div>
                            <div className="text-slate-700">
                              {pair.portfolioWeightPercent.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Paired Undervalued Replacements */}
                      <div className="lg:col-span-8 p-4 bg-white">
                        <div className="text-[11px] font-semibold text-slate-500 mb-3">
                          Recommended Redeployment Candidates (~{formatINR(splitFreed, true)} each)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {pair.candidates.map((cand) => {
                            const inWatch = isInWatchlist(cand.symbol);
                            return (
                              <div
                                key={cand.symbol}
                                className="border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between gap-3 bg-white"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-bold text-slate-900">
                                          {cand.ticker}
                                        </span>
                                        {cand.sectorDiversificationBonus && (
                                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                                            Diversifier
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-500 truncate">
                                        {cand.companyName} · {cand.sector}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="text-[10px] text-slate-400">Score</div>
                                      <div className="text-xs font-bold font-mono-tabular text-blue-800">
                                        {cand.undervaluedScore}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono-tabular bg-slate-50 border border-slate-100 rounded p-2">
                                    <div>
                                      <div className="text-[10px] text-slate-400">LTP</div>
                                      <div className="font-semibold text-slate-900">
                                        {formatINR(cand.livePrice)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-slate-400">ROCE</div>
                                      <div className="font-semibold text-slate-800">
                                        {cand.roce !== null ? `${cand.roce.toFixed(1)}%` : '—'}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-slate-400">P/E</div>
                                      <div className="font-semibold text-slate-800">
                                        {cand.peRatio !== null ? `${cand.peRatio.toFixed(1)}x` : '—'}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-slate-400">RSI</div>
                                      <div className="font-semibold text-slate-800">
                                        {cand.rsi14 !== null ? cand.rsi14.toFixed(1) : '—'}
                                      </div>
                                    </div>
                                  </div>

                                  <p className="text-[11px] text-slate-600 leading-relaxed">
                                    {cand.rotationThesis}
                                  </p>
                                </div>

                                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-mono-tabular">
                                    <span className="text-green-700 font-semibold">
                                      T: {formatINR(cand.suggestedTarget)}
                                    </span>
                                    <span className="mx-1.5 text-slate-300">·</span>
                                    <span className="text-red-700 font-semibold">
                                      SL: {formatINR(cand.suggestedStopLoss)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onInspectChart(cand.symbol, {
                                          targetPrice: cand.suggestedTarget,
                                          stopLoss: cand.suggestedStopLoss,
                                        })
                                      }
                                      className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap shrink-0"
                                      title="Inspect Chart & Target/SL"
                                    >
                                      Chart
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onToggleWatchlist(
                                          cand.symbol,
                                          cand.companyName,
                                          cand.exchange,
                                          cand.sector
                                        )
                                      }
                                      className={`p-1 border rounded transition-colors shrink-0 ${
                                        inWatch
                                          ? 'bg-amber-50 border-amber-200 text-amber-600'
                                          : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
                                      }`}
                                      title={inWatch ? 'Remove Watchlist' : 'Add to Watchlist'}
                                    >
                                      <Star
                                        className={`w-3.5 h-3.5 ${inWatch ? 'fill-amber-500' : ''}`}
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onStageRotationBuy(cand, splitFreed, pair.sourceTicker)
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-blue-700 rounded hover:bg-blue-800 whitespace-nowrap shrink-0"
                                    >
                                      <Plus className="w-3 h-3" /> Stage Buy
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">No Forced Rotation Triggers: </span>
                    None of your holdings currently show extreme over-extension or chronic 200-DMA breakdown. Below are top undervalued NSE additions for fresh capital deployment.
                  </div>
                </div>

                {rotationData.standaloneIdeas.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rotationData.standaloneIdeas.map((idea) => {
                      const inWatch = isInWatchlist(idea.symbol);
                      return (
                        <div
                          key={idea.symbol}
                          className="border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between gap-2.5 bg-white"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="text-xs font-bold text-slate-900">
                                  {idea.ticker}
                                </span>
                                <span className="text-[11px] text-slate-500 ml-2">
                                  {idea.companyName} · {idea.sector}
                                </span>
                              </div>
                              <span className="text-xs font-bold font-mono-tabular text-blue-800">
                                Score {idea.undervaluedScore}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono-tabular text-slate-600">
                              LTP {formatINR(idea.livePrice)} · ROCE{' '}
                              {idea.roce !== null ? `${idea.roce.toFixed(1)}%` : '—'} · P/E{' '}
                              {idea.peRatio !== null ? `${idea.peRatio.toFixed(1)}x` : '—'} · RSI{' '}
                              {idea.rsi14 !== null ? idea.rsi14.toFixed(1) : '—'}
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {idea.rotationThesis}
                            </p>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                onInspectChart(idea.symbol, {
                                  targetPrice: idea.suggestedTarget,
                                  stopLoss: idea.suggestedStopLoss,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap shrink-0"
                            >
                              Chart
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onToggleWatchlist(
                                  idea.symbol,
                                  idea.companyName,
                                  idea.exchange,
                                  idea.sector
                                )
                              }
                              className={`p-1 border rounded transition-colors shrink-0 ${
                                inWatch
                                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${inWatch ? 'fill-amber-500' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onStageRotationBuy(idea)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-blue-700 rounded hover:bg-blue-800 whitespace-nowrap shrink-0"
                            >
                              <Plus className="w-3 h-3" /> Stage Buy
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Concentration & Dead-Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Actionable Portfolio Risk &amp; Dead-Stock Alerts
              </h3>
              <p className="text-xs text-slate-500">
                Automated flags evaluating concentration limits, 200-DMA breakdowns, and benchmark drag
              </p>
            </div>
          </div>

          {diagnostics.concentrationAlerts.length === 0 ? (
            <div className="py-10 text-center border border-slate-100 rounded-lg bg-slate-50/50 space-y-2">
              <CheckCircle2 className="w-6 h-6 text-green-700 mx-auto" />
              <div className="text-sm font-semibold text-slate-900">
                No Critical Concentration or Dead-Stock Flags
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your holdings are diversified across sectors and holding above long-term momentum baselines.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {diagnostics.concentrationAlerts.map((alert, i) => (
                <div
                  key={i}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    {alert.severity === 'critical' ? (
                      <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-slate-900">{alert.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{alert.detail}</div>
                    </div>
                  </div>
                  {alert.symbol && (
                    <button
                      type="button"
                      onClick={() => onInspectChart(alert.symbol!)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg whitespace-nowrap shrink-0"
                    >
                      <LineChart className="w-3.5 h-3.5" /> Review Chart
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Market Cap Mix Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <h3 className="text-sm font-bold text-slate-900">Market-Cap Exposure</h3>
          <p className="text-xs text-slate-500 mb-3">Allocation by SEBI market-cap tier</p>

          {diagnostics.capMix.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              No active holdings
            </div>
          ) : (
            <>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={diagnostics.capMix}
                      dataKey="weightPercent"
                      nameKey="cap"
                      innerRadius={48}
                      outerRadius={74}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {diagnostics.capMix.map((entry, idx) => (
                        <Cell key={entry.cap} fill={CAP_COLORS[idx % CAP_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: unknown) => [`${Number(val).toFixed(1)}%`, 'Weight']}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2 pt-3 border-t border-slate-100">
                {diagnostics.capMix.map((item, idx) => (
                  <div key={item.cap} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: CAP_COLORS[idx % CAP_COLORS.length] }}
                      />
                      <span>{item.cap}</span>
                    </div>
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {item.weightPercent.toFixed(1)}% · {formatINR(item.value, true)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Holding-by-Holding Technical & Benchmark Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            Position-Level Health &amp; Moving Average Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Compares every holding against its 50-DMA, 200-DMA, RSI-14, 6-month return, and AI verdict
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Stock</th>
                <th className="py-2.5 px-3 text-right">LTP</th>
                <th className="py-2.5 px-3 text-right">vs 50-DMA</th>
                <th className="py-2.5 px-3 text-right">vs 200-DMA</th>
                <th className="py-2.5 px-3 text-right">RSI (14)</th>
                <th className="py-2.5 px-3 text-right">6M Return</th>
                <th className="py-2.5 px-3 text-right">Confidence</th>
                <th className="py-2.5 px-3">AI Rating</th>
                <th className="py-2.5 px-4">Diagnostic Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {holdings.map((h) => {
                const sma50Diff =
                  h.quote?.sma50 && h.quote.sma50 > 0
                    ? ((h.livePrice - h.quote.sma50) / h.quote.sma50) * 100
                    : null;
                const sma200Diff =
                  h.quote?.sma200 && h.quote.sma200 > 0
                    ? ((h.livePrice - h.quote.sma200) / h.quote.sma200) * 100
                    : null;
                const aiRating = ratingBySymbol.get(h.symbol.toUpperCase());
                const confScore = aiRating?.confidence?.overallScore ?? h.quote?.confidence?.overallScore ?? null;

                return (
                  <tr
                    key={h.id}
                    onClick={() =>
                      onInspectChart(h.symbol, {
                        avgBuyPrice: h.avgBuyPrice,
                        targetPrice: aiRating?.suggestedTarget,
                        stopLoss: aiRating?.suggestedStopLoss,
                      })
                    }
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{h.symbol.replace(/\.(NS|BO)$/, '')}</span>
                        <EarningsRiskTag
                          nextEarningsDate={aiRating?.fundamentals?.nextEarningsDate}
                          daysToEarnings={aiRating?.fundamentals?.daysToEarnings}
                          earningsRiskFlag={aiRating?.fundamentals?.earningsRiskFlag}
                          compact
                        />
                      </div>
                      <div className="text-[11px] font-normal text-slate-500">
                        {h.weightPercent.toFixed(1)}% weight
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {formatINR(h.livePrice)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono-tabular ${
                        (sma50Diff ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {formatPercent(sma50Diff)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono-tabular ${
                        (sma200Diff ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {formatPercent(sma200Diff)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-800">
                      {h.quote?.rsi14 !== null && h.quote?.rsi14 !== undefined
                        ? h.quote.rsi14.toFixed(1)
                        : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                        (h.quote?.return6M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {formatPercent(h.quote?.return6M)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">
                      {confScore !== null ? (
                        <span className={getConfidenceScoreTone(confScore)}>
                          {confScore.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="font-normal text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      {aiRating ? (
                        <span
                          className={
                            aiRating.rating === 'BUY'
                              ? 'text-green-700'
                              : aiRating.rating === 'EXIT'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }
                        >
                          {aiRating.rating}
                        </span>
                      ) : (
                        <span className="font-normal text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`font-semibold ${
                          h.healthStatus === 'Healthy'
                            ? 'text-green-700'
                            : h.healthStatus === 'Watch'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {h.healthStatus}
                      </span>
                      <span className="text-slate-500 ml-2">{h.healthReason}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
