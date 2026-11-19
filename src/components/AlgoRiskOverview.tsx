import { useState } from 'react';
import {
  AlertTriangle,
  OctagonAlert,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  AlgoPaperStrategyTelemetry,
  AlgoStrategyRecord,
  AlgoStrategyStatus,
} from '../types/market';
import { formatINR } from '../utils/portfolioAnalytics';

interface AlgoRiskOverviewProps {
  strategies: AlgoStrategyRecord[];
  telemetry: AlgoPaperStrategyTelemetry[];
  draftCapital: number;
  draftDailyLossCapPct: number;
  evaluatedAt?: string | null;
  paperEvalLoading: boolean;
  autoTickEnabled: boolean;
  onToggleAutoTick: () => void;
  onEvaluatePaperNow: () => void;
  onHaltAllBots: () => Promise<void>;
  onToggleStrategyStatus: (
    strategy: AlgoStrategyRecord,
    nextStatus: AlgoStrategyStatus
  ) => Promise<void>;
}

const ARC_RADIUS = 88;
const ARC_CX = 120;
const ARC_CY = 114;
const ARC_LENGTH = Math.PI * ARC_RADIUS;

export function AlgoRiskOverview({
  strategies,
  telemetry,
  draftCapital,
  draftDailyLossCapPct,
  evaluatedAt,
  paperEvalLoading,
  autoTickEnabled,
  onToggleAutoTick,
  onEvaluatePaperNow,
  onHaltAllBots,
  onToggleStrategyStatus,
}: AlgoRiskOverviewProps) {
  const [haltingAll, setHaltingAll] = useState(false);

  const activeStrategies = strategies.filter((s) => s.status === 'ACTIVE');
  const riskHaltedStrategies = strategies.filter((s) => s.status === 'PAUSED_RISK_CAP');
  const pausedOrDraftStrategies = strategies.filter(
    (s) => s.status === 'PAUSED' || s.status === 'DRAFT'
  );

  // Scope session risk aggregation to Active + Risk-Halted bots first; fall back to all saved telemetry or Rule Studio draft
  const telemetryByStrategyId = new Map<string, AlgoPaperStrategyTelemetry>(
    telemetry.map((t) => [t.strategyId, t])
  );

  const sessionStrategies =
    activeStrategies.length > 0 || riskHaltedStrategies.length > 0
      ? [...activeStrategies, ...riskHaltedStrategies]
      : strategies;

  const sessionRows = sessionStrategies.map((strat) => {
    const tel = telemetryByStrategyId.get(strat.id);
    const virtualCapital = tel?.virtualCapital ?? strat.virtualCapital;
    const dailyLossCapPct = tel?.dailyLossCapPct ?? strat.dailyLossCapPct;
    const capBudgetInr = (virtualCapital * dailyLossCapPct) / 100;
    const todayRealizedPnl = tel?.todayRealizedPnl ?? 0;
    const todayUnrealizedPnl = tel?.todayUnrealizedPnl ?? 0;
    const todayTotalPnl = tel?.todayTotalPnl ?? 0;
    const todayLossPct = tel?.todayLossPct ?? 0;
    const utilPct =
      dailyLossCapPct > 0
        ? Math.min(100, Math.max(0, (todayLossPct / dailyLossCapPct) * 100))
        : 0;
    const dailyCapBreached =
      Boolean(tel?.dailyCapBreached) || strat.status === 'PAUSED_RISK_CAP';

    return {
      strategy: strat,
      virtualCapital,
      dailyLossCapPct,
      capBudgetInr,
      todayRealizedPnl,
      todayUnrealizedPnl,
      todayTotalPnl,
      todayLossPct,
      utilPct,
      dailyCapBreached,
      openPositionsCount: tel?.openPositionsCount ?? 0,
    };
  });

  const hasSavedStrategies = sessionRows.length > 0;

  const totalSessionCapital = hasSavedStrategies
    ? sessionRows.reduce((s, r) => s + r.virtualCapital, 0)
    : draftCapital;

  const totalCapBudgetInr = hasSavedStrategies
    ? sessionRows.reduce((s, r) => s + r.capBudgetInr, 0)
    : (draftCapital * draftDailyLossCapPct) / 100;

  const effectiveCapPct =
    totalSessionCapital > 0
      ? (totalCapBudgetInr / totalSessionCapital) * 100
      : draftDailyLossCapPct;

  const totalTodayPnl = sessionRows.reduce((s, r) => s + r.todayTotalPnl, 0);
  const totalTodayRealized = sessionRows.reduce((s, r) => s + r.todayRealizedPnl, 0);
  const totalTodayUnrealized = sessionRows.reduce((s, r) => s + r.todayUnrealizedPnl, 0);
  const todayPnlPct =
    totalSessionCapital > 0 ? (totalTodayPnl / totalSessionCapital) * 100 : 0;

  // Compute aggregate loss utilization AND single-bot tightest utilization so circuit-breaker proximity never hides behind profitable bots
  const aggregateLossInr = totalTodayPnl < 0 ? Math.abs(totalTodayPnl) : 0;
  const aggregateCapUtilPct =
    totalCapBudgetInr > 0
      ? Math.min(100, (aggregateLossInr / totalCapBudgetInr) * 100)
      : 0;
  const peakSingleBotUtilPct =
    sessionRows.length > 0 ? Math.max(...sessionRows.map((r) => r.utilPct)) : 0;

  const gaugeUtilPct = Number(
    Math.min(100, Math.max(aggregateCapUtilPct, peakSingleBotUtilPct)).toFixed(1)
  );

  const anyCapBreached = riskHaltedStrategies.length > 0 || sessionRows.some((r) => r.dailyCapBreached);
  const remainingLossBufferInr = Math.max(0, totalCapBudgetInr - aggregateLossInr);

  // Linear comparison scale: maps P&L smoothly from [-totalCapBudgetInr, +totalCapBudgetInr]
  const barRatio =
    totalCapBudgetInr > 0
      ? Math.max(-1, Math.min(1, totalTodayPnl / totalCapBudgetInr))
      : 0;

  // Risk state classification (never hue-only; paired with explicit text label)
  const riskState: {
    label: string;
    detail: string;
    strokeColor: string;
    textClass: string;
    barClass: string;
  } = anyCapBreached || gaugeUtilPct >= 100
    ? {
        label: 'Cap Breached · Halted',
        detail: 'Daily loss threshold reached; affected strategies auto-paused.',
        strokeColor: '#dc2626',
        textClass: 'text-red-700',
        barClass: 'bg-red-600',
      }
    : gaugeUtilPct >= 75
    ? {
        label: 'Critical Approaching Cap',
        detail: 'Intraday drawdown exceeds 75% of configured daily loss limit.',
        strokeColor: '#dc2626',
        textClass: 'text-red-700',
        barClass: 'bg-red-600',
      }
    : gaugeUtilPct >= 40
    ? {
        label: 'Elevated Drawdown',
        detail: 'Session drawdown within guardrails; monitor open stop-losses.',
        strokeColor: '#d97706',
        textClass: 'text-amber-700',
        barClass: 'bg-amber-600',
      }
    : totalTodayPnl > 0
    ? {
        label: 'Nominal · Profit Cushion',
        detail: 'Net session P&L is positive; full daily loss cap buffer intact.',
        strokeColor: '#16a34a',
        textClass: 'text-green-700',
        barClass: 'bg-green-600',
      }
    : {
        label: activeStrategies.length > 0 ? 'Nominal · Guarded' : 'Standby · Guarded',
        detail:
          activeStrategies.length > 0
            ? 'Daily loss cap circuit-breaker armed across active paper bots.'
            : 'Activate a paper bot to enforce live intraday risk limits.',
        strokeColor: '#16a34a',
        textClass: 'text-slate-700',
        barClass: 'bg-slate-600',
      };

  // Semi-circle SVG coordinates
  const clampedPct = Math.min(100, Math.max(0, gaugeUtilPct));
  const arcDashOffset = ARC_LENGTH * (1 - clampedPct / 100);
  const needleTheta = Math.PI * (1 - clampedPct / 100);
  const knobX = ARC_CX + ARC_RADIUS * Math.cos(needleTheta);
  const knobY = ARC_CY - ARC_RADIUS * Math.sin(needleTheta);

  // 80% critical warning marker on gauge
  const warnTheta = Math.PI * (1 - 0.8);
  const warnX1 = ARC_CX + (ARC_RADIUS - 10) * Math.cos(warnTheta);
  const warnY1 = ARC_CY - (ARC_RADIUS - 10) * Math.sin(warnTheta);
  const warnX2 = ARC_CX + (ARC_RADIUS + 10) * Math.cos(warnTheta);
  const warnY2 = ARC_CY - (ARC_RADIUS + 10) * Math.sin(warnTheta);

  const handleEmergencyKillSwitch = async () => {
    if (activeStrategies.length === 0 || haltingAll) return;
    setHaltingAll(true);
    try {
      await onHaltAllBots();
    } finally {
      setHaltingAll(false);
    }
  };

  const lastScanText = evaluatedAt
    ? new Date(evaluatedAt).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : null;

  return (
    <section
      aria-label="Risk Overview"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-5"
    >
      {/* Top Header Row + Emergency Kill-Switch */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Intraday Circuit-Breaker Monitor</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {activeStrategies.length} Active {activeStrategies.length === 1 ? 'Session' : 'Sessions'}
            </span>
            {riskHaltedStrategies.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular font-semibold text-red-700">
                  {riskHaltedStrategies.length} Cap-Halted
                </span>
              </>
            )}
            {lastScanText && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">Tick {lastScanText} IST</span>
              </>
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            {anyCapBreached ? (
              <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-green-700 shrink-0" />
            )}
            <span>Risk Overview: Daily Loss Cap vs. Current Day P&amp;L</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleAutoTick}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              autoTickEnabled
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {autoTickEnabled ? 'Auto-Scan 30s On' : 'Auto-Scan Off'}
          </button>

          <button
            type="button"
            onClick={onEvaluatePaperNow}
            disabled={paperEvalLoading || strategies.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${paperEvalLoading ? 'animate-spin' : ''}`} />
            <span>{paperEvalLoading ? 'Scanning Ticks...' : 'Scan Live Ticks'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleEmergencyKillSwitch()}
            disabled={activeStrategies.length === 0 || haltingAll}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeStrategies.length > 0
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
            title={
              activeStrategies.length > 0
                ? 'Immediately pause all active automated paper-trading bots'
                : 'No active bots currently running'
            }
          >
            <OctagonAlert className="w-4 h-4 shrink-0" />
            <span>
              {haltingAll
                ? 'Halting Bots...'
                : activeStrategies.length > 0
                ? `Halt All Bots (${activeStrategies.length})`
                : 'Halt All Bots'}
            </span>
          </button>
        </div>
      </div>

      {/* Circuit-Breaker Alert Banner (shown when breached or high warning) */}
      {anyCapBreached && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-red-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
            <span>
              <strong>Daily Loss Circuit-Breaker Triggered:</strong>{' '}
              {riskHaltedStrategies.map((s) => s.name).join(', ')} exceeded daily loss cap and{' '}
              {riskHaltedStrategies.length === 1 ? 'was' : 'were'} automatically paused to protect capital.
            </span>
          </div>
          <span className="font-mono-tabular font-semibold text-red-800 whitespace-nowrap shrink-0">
            Utilization {gaugeUtilPct.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Main Risk Visualization Grid: Progress Gauge + Head-to-Head Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Semi-Circular Daily Loss Cap Progress Gauge */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center py-2">
          <div className="w-full max-w-[260px]">
            <svg
              viewBox="0 0 240 134"
              className="w-full h-auto overflow-visible"
              role="img"
              aria-label={`Daily loss cap utilization gauge at ${gaugeUtilPct.toFixed(1)} percent`}
            >
              {/* Track Arc */}
              <path
                d={`M ${ARC_CX - ARC_RADIUS} ${ARC_CY} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${
                  ARC_CX + ARC_RADIUS
                } ${ARC_CY}`}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="14"
                strokeLinecap="round"
              />

              {/* 80% Warning Threshold Tick */}
              <line
                x1={warnX1}
                y1={warnY1}
                x2={warnX2}
                y2={warnY2}
                stroke="#d97706"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Active Progress Arc */}
              <path
                d={`M ${ARC_CX - ARC_RADIUS} ${ARC_CY} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${
                  ARC_CX + ARC_RADIUS
                } ${ARC_CY}`}
                fill="none"
                stroke={riskState.strokeColor}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={ARC_LENGTH}
                strokeDashoffset={arcDashOffset}
                className="transition-all duration-300"
              />

              {/* Indicator Position Marker */}
              <circle
                cx={knobX}
                cy={knobY}
                r="5.5"
                fill="#ffffff"
                stroke={riskState.strokeColor}
                strokeWidth="3"
              />

              {/* Center Tabular Readout */}
              <text
                x={ARC_CX}
                y={ARC_CY - 22}
                textAnchor="middle"
                className="fill-slate-900 font-mono-tabular font-bold"
                style={{ fontSize: '26px' }}
              >
                {gaugeUtilPct.toFixed(1)}%
              </text>
              <text
                x={ARC_CX}
                y={ARC_CY - 3}
                textAnchor="middle"
                className="fill-slate-500 font-medium"
                style={{ fontSize: '11px' }}
              >
                Daily Cap Consumed
              </text>

              {/* Scale Endpoints */}
              <text
                x={ARC_CX - ARC_RADIUS}
                y={ARC_CY + 17}
                textAnchor="middle"
                className="fill-slate-400 font-mono-tabular"
                style={{ fontSize: '10px' }}
              >
                0%
              </text>
              <text
                x={warnX2 + 12}
                y={warnY2 - 2}
                textAnchor="start"
                className="fill-amber-700 font-mono-tabular font-semibold"
                style={{ fontSize: '10px' }}
              >
                80% Warn
              </text>
              <text
                x={ARC_CX + ARC_RADIUS}
                y={ARC_CY + 17}
                textAnchor="middle"
                className="fill-red-700 font-mono-tabular font-semibold"
                style={{ fontSize: '10px' }}
              >
                100% Halt
              </text>
            </svg>
          </div>

          <div className="text-center mt-1 space-y-0.5">
            <div className={`text-xs font-semibold ${riskState.textClass}`}>
              {riskState.label}
            </div>
            <p className="text-[11px] text-slate-500 max-w-xs">{riskState.detail}</p>
          </div>
        </div>

        {/* Right: Daily Loss Cap vs Current Day P&L Divergence Bar & 4 KPI Metrics */}
        <div className="lg:col-span-7 space-y-5 lg:border-l lg:border-slate-100 lg:pl-6">
          {/* Diverging Progress Comparison Bar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Current Day P&amp;L vs. Daily Loss Cap Floor
              </span>
              <span className="text-xs font-mono-tabular">
                <span
                  className={`font-bold ${
                    totalTodayPnl >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {totalTodayPnl >= 0 ? '+' : ''}
                  {formatINR(totalTodayPnl)}
                </span>
                <span className="text-slate-400 mx-1.5">/</span>
                <span className="font-semibold text-slate-700">
                  -{formatINR(totalCapBudgetInr)} Cap
                </span>
              </span>
            </div>

            {/* Center-Zero Diverging Gauge Bar */}
            <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
              {/* Left half (Drawdown toward -Cap) / Right half (Profit Cushion toward +Cap) */}
              <div
                className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-400 z-10"
                aria-hidden="true"
              />
              {barRatio < 0 ? (
                <div
                  className={`absolute top-0 bottom-0 transition-all duration-300 ${
                    Math.abs(barRatio) >= 0.75
                      ? 'bg-red-600'
                      : Math.abs(barRatio) >= 0.4
                      ? 'bg-amber-500'
                      : 'bg-red-400'
                  }`}
                  style={{
                    right: '50%',
                    width: `${Math.min(50, Math.abs(barRatio) * 50)}%`,
                  }}
                />
              ) : barRatio > 0 ? (
                <div
                  className="absolute top-0 bottom-0 bg-green-600 transition-all duration-300"
                  style={{
                    left: '50%',
                    width: `${Math.min(50, barRatio * 50)}%`,
                  }}
                />
              ) : null}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-500">
              <span className="text-red-700 font-medium">
                -{formatINR(totalCapBudgetInr)} (-{effectiveCapPct.toFixed(2)}% Halt)
              </span>
              <span>Break-Even ₹0</span>
              <span className="text-green-700 font-medium">
                +{formatINR(totalCapBudgetInr)} Cushion
              </span>
            </div>
          </div>

          {/* 4-Metric Hairline KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            <div>
              <div className="text-[11px] text-slate-500">Current Day P&amp;L</div>
              <div
                className={`text-sm font-bold font-mono-tabular mt-0.5 ${
                  totalTodayPnl >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {totalTodayPnl >= 0 ? '+' : ''}
                {formatINR(totalTodayPnl)}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                {todayPnlPct >= 0 ? '+' : ''}
                {todayPnlPct.toFixed(2)}% · R {totalTodayRealized >= 0 ? '+' : ''}
                {formatINR(totalTodayRealized)} / U {totalTodayUnrealized >= 0 ? '+' : ''}
                {formatINR(totalTodayUnrealized)}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500">Daily Loss Cap</div>
              <div className="text-sm font-bold font-mono-tabular text-slate-900 mt-0.5">
                -{formatINR(totalCapBudgetInr)}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                -{effectiveCapPct.toFixed(2)}% of {formatINR(totalSessionCapital)}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500">Remaining Risk Buffer</div>
              <div className="text-sm font-bold font-mono-tabular text-slate-900 mt-0.5">
                {formatINR(remainingLossBufferInr)}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                {Math.max(0, 100 - gaugeUtilPct).toFixed(1)}% before halt
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500">Session Bots</div>
              <div className="text-sm font-bold font-mono-tabular text-slate-900 mt-0.5">
                {activeStrategies.length} Active
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {riskHaltedStrategies.length} Risk Halt · {pausedOrDraftStrategies.length} Idle
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Bot Risk Cap Breakdown Table (when strategies exist) */}
      {sessionRows.length > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">
              Per-Strategy Daily Cap Exposure ({sessionRows.length})
            </span>
            <span className="text-[11px] text-slate-500">
              Auto-pauses bot when single-day drawdown reaches its cap
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2 pr-3">Strategy</th>
                  <th className="py-2 px-3">Session State</th>
                  <th className="py-2 px-3 text-right">Today P&amp;L</th>
                  <th className="py-2 px-3 text-right">Loss Cap Limit</th>
                  <th className="py-2 px-3 w-40">Cap Utilization</th>
                  <th className="py-2 pl-3 text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sessionRows.map((row) => {
                  const isActive = row.strategy.status === 'ACTIVE';
                  const isHalted = row.strategy.status === 'PAUSED_RISK_CAP';
                  return (
                    <tr key={row.strategy.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-slate-900">{row.strategy.name}</div>
                        <div className="text-[11px] font-mono-tabular text-slate-500">
                          {row.openPositionsCount}/{row.strategy.maxOpenPositions} open ·{' '}
                          {formatINR(row.virtualCapital)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            isActive
                              ? 'text-green-700'
                              : isHalted
                              ? 'text-red-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {isActive
                            ? 'Active'
                            : isHalted
                            ? 'Cap Breached'
                            : row.strategy.status === 'PAUSED'
                            ? 'Paused'
                            : 'Draft'}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                          row.todayTotalPnl >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {row.todayTotalPnl >= 0 ? '+' : ''}
                        {formatINR(row.todayTotalPnl)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                        -{formatINR(row.capBudgetInr)} (-{row.dailyLossCapPct}%)
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                row.utilPct >= 80 || isHalted
                                  ? 'bg-red-600'
                                  : row.utilPct >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-green-600'
                              }`}
                              style={{ width: `${Math.min(100, row.utilPct)}%` }}
                            />
                          </div>
                          <span className="font-mono-tabular text-[11px] text-slate-700 w-11 text-right">
                            {row.utilPct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => void onToggleStrategyStatus(row.strategy, 'PAUSED')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 whitespace-nowrap shrink-0"
                          >
                            <Pause className="w-3 h-3" /> Pause
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void onToggleStrategyStatus(row.strategy, 'ACTIVE')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-800 bg-blue-50 rounded hover:bg-blue-100 whitespace-nowrap shrink-0"
                          >
                            {isHalted ? (
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
