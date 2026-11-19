import { CalendarClock } from 'lucide-react';
import type { ConfidenceBreakdown } from '../types/market';

interface ConfidenceBreakdownBarProps {
  confidence: ConfidenceBreakdown;
  variant?: 'compact' | 'expanded';
  showDisclaimer?: boolean;
}

const PILLAR_CONFIG = [
  {
    key: 'trendStructure' as const,
    label: 'Trend Structure',
    shortLabel: 'Trend',
    weightLabel: '30%',
    barClass: 'bg-blue-700',
  },
  {
    key: 'relativeStrength' as const,
    label: 'Relative Strength vs Nifty',
    shortLabel: 'RS vs Nifty',
    weightLabel: '25%',
    barClass: 'bg-sky-600',
  },
  {
    key: 'momentumQuality' as const,
    label: 'Momentum Quality',
    shortLabel: 'Momentum',
    weightLabel: '20%',
    barClass: 'bg-teal-600',
  },
  {
    key: 'fundamentalHealth' as const,
    label: 'Fundamental Health',
    shortLabel: 'Fundamentals',
    weightLabel: '25%',
    barClass: 'bg-emerald-700',
  },
];

export function getConfidenceScoreTone(score: number): string {
  if (score >= 66) return 'text-emerald-700';
  if (score >= 50) return 'text-blue-700';
  return 'text-amber-700';
}

export function getConfidenceBadgeClasses(score: number): string {
  if (score >= 66) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (score >= 50) return 'bg-blue-50 text-blue-800 border-blue-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

export function ConfidenceBreakdownBar({
  confidence,
  variant = 'expanded',
  showDisclaimer = false,
}: ConfidenceBreakdownBarProps) {
  const adjustments = confidence.adjustments ?? [];
  const totalAdjustment = confidence.totalAdjustment ?? 0;
  const baseScore = confidence.baseScore ?? confidence.overallScore;
  const hasDeductions = adjustments.length > 0 && totalAdjustment < 0;

  if (variant === 'compact') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-[11px] font-medium text-slate-500">
            Net Confidence
            {hasDeductions && (
              <span className="ml-1.5 font-mono-tabular text-[10px] text-amber-700 font-semibold">
                (Base {baseScore.toFixed(0)}% {totalAdjustment} pts)
              </span>
            )}
          </span>
          <span
            className={`font-mono-tabular font-bold ${getConfidenceScoreTone(
              confidence.overallScore
            )}`}
          >
            {confidence.overallScore.toFixed(1)}%
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {PILLAR_CONFIG.map((p) => {
            const detail = confidence.pillars[p.key];
            return (
              <div
                key={p.key}
                title={`${p.label} (${p.weightLabel}): ${detail.score.toFixed(0)}/100 — ${detail.summary}`}
                className="space-y-0.5"
              >
                <div className="h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                  <div
                    className={`h-full ${p.barClass}`}
                    style={{ width: `${Math.min(100, Math.max(4, detail.score))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono-tabular">
                  <span className="truncate">{p.shortLabel}</span>
                  <span>{Math.round(detail.score)}</span>
                </div>
              </div>
            );
          })}
        </div>
        {hasDeductions && (
          <div className="text-[11px] text-amber-800 pt-0.5 leading-snug">
            <span className="font-semibold">Deductions:</span>{' '}
            {adjustments.map((adj, idx) => (
              <span key={adj.code} title={adj.reason}>
                {idx > 0 && <span className="mx-1 text-slate-300">·</span>}
                <span>{adj.label}</span>{' '}
                <span className="font-mono-tabular font-semibold">{adj.delta} pts</span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-900">
            Calibrated Rule Confidence Score
          </div>
          <div className="text-[11px] text-slate-500">
            Fixed institutional weights: Trend 30% · RS vs Nifty 25% · Momentum 20% · Fundamentals 25%
          </div>
        </div>
        <div className="flex items-baseline gap-2.5">
          {hasDeductions && (
            <span className="text-xs font-mono-tabular text-slate-500">
              Base {baseScore.toFixed(1)}%{' '}
              <span className="text-amber-700 font-semibold">{totalAdjustment} pts</span> →
            </span>
          )}
          <span
            className={`text-xl font-bold font-mono-tabular ${getConfidenceScoreTone(
              confidence.overallScore
            )}`}
          >
            {confidence.overallScore.toFixed(1)}%
          </span>
          <span
            className={`px-2 py-0.5 text-[11px] font-semibold border rounded-md ${getConfidenceBadgeClasses(
              confidence.overallScore
            )}`}
          >
            {confidence.tier}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PILLAR_CONFIG.map((p) => {
          const detail = confidence.pillars[p.key];
          return (
            <div key={p.key} className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-700 truncate">
                  {p.label}{' '}
                  <span className="text-[10px] text-slate-400 font-mono-tabular">
                    ({p.weightLabel})
                  </span>
                </span>
                <span className="font-mono-tabular font-semibold text-slate-900 shrink-0">
                  {detail.score.toFixed(0)}/100
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                <div
                  className={`h-full ${p.barClass}`}
                  style={{ width: `${Math.min(100, Math.max(4, detail.score))}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="truncate">{detail.summary}</span>
                <span className="font-mono-tabular text-slate-400 shrink-0">
                  +{detail.weightedPoints.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {hasDeductions && (
        <div className="pt-2.5 border-t border-slate-100 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-amber-800">
              Risk &amp; Data-Completeness Deductions
            </span>
            <span className="font-mono-tabular text-slate-600">
              Base {baseScore.toFixed(1)}% {totalAdjustment} pts = Net{' '}
              <span className="font-semibold text-slate-900">
                {confidence.overallScore.toFixed(1)}%
              </span>
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {adjustments.map((adj) => (
              <div
                key={adj.code}
                className="py-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]"
              >
                <div className="text-slate-700">
                  <span className="font-semibold text-slate-900">{adj.label}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="text-slate-600">{adj.reason}</span>
                </div>
                <span className="font-mono-tabular font-semibold text-amber-700 shrink-0">
                  {adj.delta} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDisclaimer && (
        <p className="text-[11px] text-slate-500 pt-1">
          Confidence ranks setups within Stoxify&apos;s quantitative model; it is not a probability of profit, guarantee of future returns, or SEBI-registered investment advice.
        </p>
      )}
    </div>
  );
}

interface EarningsRiskTagProps {
  nextEarningsDate?: string | null;
  daysToEarnings?: number | null;
  earningsRiskFlag?: boolean;
  compact?: boolean;
}

export function EarningsRiskTag({
  nextEarningsDate,
  daysToEarnings,
  earningsRiskFlag,
  compact = false,
}: EarningsRiskTagProps) {
  if (!nextEarningsDate) return null;
  const isImminent = Boolean(earningsRiskFlag) || (daysToEarnings !== null && daysToEarnings !== undefined && daysToEarnings >= -1 && daysToEarnings <= 21);
  if (!isImminent && compact) return null;

  const formattedDate = (() => {
    const d = new Date(`${nextEarningsDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return nextEarningsDate;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  })();

  if (isImminent) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded-md whitespace-nowrap shrink-0"
        title="Companies with upcoming quarterly results can experience sharper price movements."
      >
        <CalendarClock className="w-3 h-3 shrink-0" />
        Results {formattedDate}
        {daysToEarnings !== null && daysToEarnings !== undefined && daysToEarnings >= 0
          ? ` (${daysToEarnings}d)`
          : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono-tabular whitespace-nowrap">
      <CalendarClock className="w-3 h-3 text-slate-400 shrink-0" />
      Next Results {formattedDate}
    </span>
  );
}
