import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Filter,
  LineChart,
  Star,
  X,
} from 'lucide-react';
import type {
  Exchange,
  PatternDiscoveryItem,
  PatternDiscoveryResponse,
  PatternId,
} from '../types/market';
import { formatINR, formatPercent } from '../utils/portfolioAnalytics';
import {
  ConfidenceBreakdownBar,
  EarningsRiskTag,
  getConfidenceScoreTone,
} from './ConfidenceBreakdownBar';

interface PatternDiscoveryHubProps {
  data: PatternDiscoveryResponse | null;
  loading: boolean;
  activePatternId: PatternId | null;
  onSelectPatternFilter: (patternId: PatternId | null) => void;
  onInspectChart: (symbol: string) => void;
  onToggleWatchlist: (symbol: string, name: string, exchange: Exchange, sector: string) => void;
  isInWatchlist: (symbol: string) => boolean;
}

function PatternSchematicSvg({ patternId }: { patternId: PatternId }) {
  switch (patternId) {
    case 'high_confidence':
      return (
        <svg viewBox="0 0 180 68" className="w-full h-16" aria-hidden="true">
          <line x1="8" y1="54" x2="172" y2="54" stroke="#E2E8F0" strokeWidth="1" />
          <line x1="8" y1="34" x2="172" y2="34" stroke="#F1F5F9" strokeWidth="1" />
          <path
            d="M12 52 Q 48 48, 86 36 T 166 14"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <path
            d="M12 49 L 38 43 L 62 45 L 92 31 L 122 25 L 146 18 L 166 10"
            fill="none"
            stroke="#1D4ED8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="166" cy="10" r="3.5" fill="#15803D" />
          <text x="12" y="16" fontSize="9" fill="#1E40AF" fontWeight="600">
            4-Pillar Alignment
          </text>
        </svg>
      );
    case 'fresh_upward_move':
      return (
        <svg viewBox="0 0 180 68" className="w-full h-16" aria-hidden="true">
          <line x1="8" y1="40" x2="172" y2="40" stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="3 3" />
          <rect x="120" y="48" width="8" height="14" rx="1" fill="#CBD5E1" />
          <rect x="132" y="44" width="8" height="18" rx="1" fill="#93C5FD" />
          <rect x="144" y="36" width="8" height="26" rx="1" fill="#1D4ED8" />
          <path
            d="M12 46 L 44 48 L 76 44 L 106 43 L 126 36 L 148 20 L 168 13"
            fill="none"
            stroke="#15803D"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="126" cy="36" r="3.5" fill="#1D4ED8" />
          <text x="12" y="16" fontSize="9" fill="#15803D" fontWeight="600">
            50-DMA Breakout
          </text>
        </svg>
      );
    case 'steady_upward_trend':
      return (
        <svg viewBox="0 0 180 68" className="w-full h-16" aria-hidden="true">
          <path
            d="M12 58 L 168 34"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <path
            d="M12 50 L 168 22"
            fill="none"
            stroke="#0284C7"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <path
            d="M12 45 L 42 39 L 70 35 L 98 28 L 128 22 L 168 12"
            fill="none"
            stroke="#1D4ED8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="12" y="16" fontSize="9" fill="#0369A1" fontWeight="600">
            50 &gt; 200 DMA Stack
          </text>
        </svg>
      );
    case 'strong_on_dip':
      return (
        <svg viewBox="0 0 180 68" className="w-full h-16" aria-hidden="true">
          <path
            d="M12 54 Q 90 42, 168 28"
            fill="none"
            stroke="#0F766E"
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />
          <path
            d="M12 46 L 46 32 L 80 20 L 106 16 L 128 34 L 146 32 L 166 22"
            fill="none"
            stroke="#1D4ED8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="128" cy="34" r="3.5" fill="#D97706" />
          <text x="12" y="16" fontSize="9" fill="#0F766E" fontWeight="600">
            Support Pullback
          </text>
        </svg>
      );
    case 'momentum_reset':
      return (
        <svg viewBox="0 0 180 68" className="w-full h-16" aria-hidden="true">
          <rect x="10" y="28" width="160" height="18" fill="#EFF6FF" />
          <line x1="10" y1="28" x2="170" y2="28" stroke="#BFDBFE" strokeWidth="1" />
          <line x1="10" y1="46" x2="170" y2="46" stroke="#BFDBFE" strokeWidth="1" />
          <path
            d="M14 48 L 44 22 L 72 16 L 104 38 L 136 36 L 166 24"
            fill="none"
            stroke="#0F766E"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="136" cy="36" r="3.5" fill="#1D4ED8" />
          <text x="12" y="16" fontSize="9" fill="#0F766E" fontWeight="600">
            RSI 40–58 Reset
          </text>
        </svg>
      );
    case 'higher_fundamental':
      return (
        <svg viewBox="0 0 180 68" className="w-full h-16" aria-hidden="true">
          <line x1="12" y1="58" x2="168" y2="58" stroke="#E2E8F0" strokeWidth="1" />
          <rect x="26" y="42" width="20" height="16" rx="2" fill="#BFDBFE" />
          <rect x="58" y="34" width="20" height="24" rx="2" fill="#60A5FA" />
          <rect x="90" y="25" width="20" height="33" rx="2" fill="#1D4ED8" />
          <rect x="122" y="15" width="20" height="43" rx="2" fill="#15803D" />
          <path
            d="M36 38 L 68 30 L 100 21 L 132 11"
            fill="none"
            stroke="#15803D"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <text x="12" y="16" fontSize="9" fill="#15803D" fontWeight="600">
            ROE &amp; Growth Quality
          </text>
        </svg>
      );
  }
}

export function PatternDiscoveryHub({
  data,
  loading,
  activePatternId,
  onSelectPatternFilter,
  onInspectChart,
  onToggleWatchlist,
  isInWatchlist,
}: PatternDiscoveryHubProps) {
  const [modalPattern, setModalPattern] = useState<PatternDiscoveryItem | null>(null);
  const [expandedSymbolKey, setExpandedSymbolKey] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Evidence-Backed Pattern Discovery
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Running walk-forward 1M &amp; 3M validation across NSE history...
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 bg-slate-50 border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.patterns.length === 0) return null;

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Evidence-Backed Pattern Discovery
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              6 structured setups backed by 24-month walk-forward NSE backtesting. Click any card to inspect monthly shortlist cohorts &amp; realized 1M returns.
            </p>
          </div>
          {activePatternId && (
            <button
              type="button"
              onClick={() => onSelectPatternFilter(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" /> Clear Pattern Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.patterns.map((pattern) => {
            const isActive = activePatternId === pattern.id;
            const wf = pattern.walkForward;

            return (
              <div
                key={pattern.id}
                onClick={() => {
                  setExpandedSymbolKey(null);
                  setModalPattern(pattern);
                }}
                className={`group rounded-xl border p-4 flex flex-col justify-between gap-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/30'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                        {pattern.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {pattern.subtitle}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold font-mono-tabular text-blue-700 leading-none">
                        {pattern.liveCount}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {pattern.liveCount === 1 ? 'stock' : 'stocks'}
                      </div>
                    </div>
                  </div>

                  {/* Schematic Chart Illustration */}
                  <div className="bg-slate-50/80 rounded-lg px-2 py-1">
                    <PatternSchematicSvg patternId={pattern.id} />
                  </div>
                </div>

                {/* Walk-Forward Empirical Evidence Strip + Actions */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular">
                    <div>
                      <span className="text-slate-500">1M Win </span>
                      <span className="font-semibold text-slate-900">
                        {wf.winRate1M !== null ? `${wf.winRate1M.toFixed(0)}%` : '—'}
                      </span>
                      <span className="text-slate-300 mx-1.5">·</span>
                      <span className="text-slate-500">3M Avg </span>
                      <span
                        className={`font-semibold ${
                          (wf.avgReturn3M ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {formatPercent(wf.avgReturn3M)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      n={wf.sampleCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-blue-700 group-hover:underline">
                      View Monthly Timeline →
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPatternFilter(isActive ? null : pattern.id);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors ${
                        isActive
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Filter className="w-3 h-3" />
                      {isActive ? 'Filtered' : 'Filter Table'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Shortlist Timeline Modal */}
      {modalPattern && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
          onClick={() => setModalPattern(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{modalPattern.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{modalPattern.subtitle}</p>
                <p className="text-[11px] text-slate-400 mt-1">{modalPattern.ruleSummary}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalPattern(null)}
                className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-lg shrink-0"
                aria-label="Close pattern modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Earnings Risk Warning Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Companies with upcoming results can experience sharper price movements.
                  {modalPattern.upcomingEarningsCount > 0
                    ? ` ${modalPattern.upcomingEarningsCount} matched ${
                        modalPattern.upcomingEarningsCount === 1 ? 'stock reports' : 'stocks report'
                      } within 14 days.`
                    : ''}
                </span>
              </div>

              {/* Walk-Forward Empirical Evidence Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs">
                <div>
                  <div className="text-[11px] text-slate-500">1M Historical Win Rate</div>
                  <div className="text-base font-bold font-mono-tabular text-slate-900 mt-0.5">
                    {modalPattern.walkForward.winRate1M !== null
                      ? `${modalPattern.walkForward.winRate1M.toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Avg 1M Return</div>
                  <div
                    className={`text-base font-bold font-mono-tabular mt-0.5 ${
                      (modalPattern.walkForward.avgReturn1M ?? 0) >= 0
                        ? 'text-green-700'
                        : 'text-red-700'
                    }`}
                  >
                    {formatPercent(modalPattern.walkForward.avgReturn1M)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">3M Historical Win Rate</div>
                  <div className="text-base font-bold font-mono-tabular text-slate-900 mt-0.5">
                    {modalPattern.walkForward.winRate3M !== null
                      ? `${modalPattern.walkForward.winRate3M.toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Avg 3M Return (n={modalPattern.walkForward.sampleCount})</div>
                  <div
                    className={`text-base font-bold font-mono-tabular mt-0.5 ${
                      (modalPattern.walkForward.avgReturn3M ?? 0) >= 0
                        ? 'text-green-700'
                        : 'text-red-700'
                    }`}
                  >
                    {formatPercent(modalPattern.walkForward.avgReturn3M)}
                  </div>
                </div>
              </div>

              {/* Chronological Monthly Shortlist Timeline */}
              {modalPattern.monthlyCohorts.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No stocks currently match this pattern criteria.
                </div>
              ) : (
                <div className="space-y-6">
                  {modalPattern.monthlyCohorts.map((cohort) => (
                    <div key={cohort.monthKey} className="relative pl-6 border-l border-slate-200">
                      <span
                        className={`w-3 h-3 rounded-full absolute -left-[6.5px] top-1 ring-4 ring-white ${
                          cohort.isLatest ? 'bg-blue-700' : 'bg-amber-500'
                        }`}
                      />
                      <div className="flex items-baseline justify-between gap-2 mb-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {cohort.monthLabel}
                          </div>
                          {cohort.isLatest && (
                            <div className="text-[10px] font-bold tracking-wider uppercase text-blue-700">
                              Latest Shortlist
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-mono-tabular">
                          {cohort.entries.length}{' '}
                          {cohort.entries.length === 1 ? 'stock' : 'stocks'}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {cohort.entries.map((entry) => {
                          const rowKey = `${cohort.monthKey}_${entry.symbol}`;
                          const isExpanded = expandedSymbolKey === rowKey;
                          const inWatch = isInWatchlist(entry.symbol);

                          return (
                            <div key={rowKey} className="py-3 space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-900">
                                      {entry.companyName}
                                    </span>
                                    <EarningsRiskTag
                                      nextEarningsDate={entry.nextEarningsDate}
                                      daysToEarnings={entry.daysToEarnings}
                                      earningsRiskFlag={entry.earningsRiskFlag}
                                      compact
                                    />
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {entry.ticker} · {entry.sector} · LTP {formatINR(entry.ltp)}
                                  </div>
                                </div>

                                <div className="flex items-center gap-5 shrink-0">
                                  <div className="text-right">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                      Confidence
                                    </div>
                                    <div
                                      className={`text-sm font-bold font-mono-tabular ${getConfidenceScoreTone(
                                        entry.confidenceScore
                                      )}`}
                                    >
                                      {entry.confidenceScore.toFixed(2)}%
                                    </div>
                                  </div>
                                  <div className="text-right min-w-[74px]">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                      {cohort.isLatest ? '1M Trend' : '1M Return'}
                                    </div>
                                    <div
                                      className={`text-sm font-bold font-mono-tabular ${
                                        (entry.return1M ?? 0) >= 0
                                          ? 'text-green-700'
                                          : 'text-red-700'
                                      }`}
                                    >
                                      {formatPercent(entry.return1M)}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {entry.breakdown && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedSymbolKey(isExpanded ? null : rowKey)
                                        }
                                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                                        title="Inspect 4-pillar Confidence breakdown"
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setModalPattern(null);
                                        onInspectChart(entry.symbol);
                                      }}
                                      className="p-1.5 text-slate-500 hover:text-blue-700 rounded hover:bg-blue-50"
                                      title="Open live chart"
                                    >
                                      <LineChart className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onToggleWatchlist(
                                          entry.symbol,
                                          entry.companyName,
                                          entry.exchange,
                                          entry.sector
                                        )
                                      }
                                      className="p-1.5 text-slate-500 hover:text-amber-600 rounded hover:bg-amber-50"
                                      title="Toggle watchlist"
                                    >
                                      <Star
                                        className={`w-3.5 h-3.5 ${
                                          inWatch ? 'fill-amber-500 text-amber-500' : ''
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {isExpanded && entry.breakdown && (
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <ConfidenceBreakdownBar
                                    confidence={entry.breakdown}
                                    variant="compact"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                {modalPattern.walkForward.basisNote} Confidence ranks setups within Stoxify&apos;s model and is not a guarantee of future returns or SEBI-registered investment advice.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
