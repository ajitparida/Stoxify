import { useEffect, useState } from 'react';
import { LineChart, Plus, RefreshCw } from 'lucide-react';
import type { Exchange, MarketQuote, ResearchSignal } from '../types/market';
import type { ChartOverlayLevels } from './MarketChartTerminal';
import { formatINR, formatPercent } from '../utils/portfolioAnalytics';

type LiveSignalItem = ResearchSignal & { liveQuote: MarketQuote | null };

interface ResearchSignalsViewProps {
  onInspectSignalChart: (symbol: string, levels: ChartOverlayLevels) => void;
  onLogSignalPosition: (prefill: {
    symbol: string;
    companyName: string;
    exchange: Exchange;
    sector: string;
    avgBuyPrice: number;
    source: 'signal';
  }) => void;
}

const SEGMENTS = ['All', 'Equity Swing', 'Positional', 'Long Term'] as const;

export function ResearchSignalsView({
  onInspectSignalChart,
  onLogSignalPosition,
}: ResearchSignalsViewProps) {
  const [signals, setSignals] = useState<LiveSignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('All');

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/market/signals');
      if (res.ok) {
        const data = (await res.json()) as { signals: LiveSignalItem[] };
        setSignals(data.signals || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSignals();
  }, []);

  const visibleSignals = signals.filter(
    (s) => segment === 'All' || s.segment === segment
  );

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Structured Research Signal Cards
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sample algorithmic & fundamental trade setups priced against live NSE/BSE market quotes (educational research model, not SEBI investment advice).
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {SEGMENTS.map((seg) => (
              <button
                key={seg}
                type="button"
                onClick={() => setSegment(seg)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  segment === seg
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void fetchSignals()}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-lg"
            title="Refresh live signal prices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && signals.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleSignals.map((sig) => {
            const ltp = sig.liveQuote?.price ?? (sig.entryLow + sig.entryHigh) / 2;
            const upsidePct = ((sig.targetPrice - ltp) / ltp) * 100;
            const rangeSpan = sig.targetPrice - sig.stopLoss;
            const progressPct =
              rangeSpan > 0
                ? Math.min(100, Math.max(0, ((ltp - sig.stopLoss) / rangeSpan) * 100))
                : 50;

            return (
              <div
                key={sig.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">
                        {sig.segment} · {sig.horizon} · {sig.sector}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">
                        {sig.ticker}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          {sig.companyName}
                        </span>
                      </h3>
                    </div>
                    <span
                      className={`text-xs font-bold tracking-wide px-2.5 py-1 rounded-md border shrink-0 ${
                        sig.action === 'BUY'
                          ? 'bg-green-50 text-green-800 border-green-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {sig.action}
                    </span>
                  </div>

                  {/* Live LTP + Upside */}
                  <div className="flex items-baseline justify-between py-2.5 px-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <div>
                      <div className="text-[11px] text-slate-500">Live Market LTP</div>
                      <div className="text-base font-bold font-mono-tabular text-slate-900">
                        {formatINR(ltp)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Target Upside</div>
                      <div
                        className={`text-sm font-bold font-mono-tabular ${
                          upsidePct >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {formatPercent(upsidePct)}
                      </div>
                    </div>
                  </div>

                  {/* Entry / Target / Stop-Loss Matrix */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="border border-slate-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-slate-500">Entry Zone</div>
                      <div className="font-mono-tabular font-semibold text-slate-900 mt-0.5">
                        ₹{Math.round(sig.entryLow)}–{Math.round(sig.entryHigh)}
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-slate-500">Target</div>
                      <div className="font-mono-tabular font-semibold text-green-700 mt-0.5">
                        {formatINR(sig.targetPrice)}
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-slate-500">Stop-Loss</div>
                      <div className="font-mono-tabular font-semibold text-red-700 mt-0.5">
                        {formatINR(sig.stopLoss)}
                      </div>
                    </div>
                  </div>

                  {/* Stop-Loss to Target Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-tabular">
                      <span>SL {formatINR(sig.stopLoss)}</span>
                      <span>Target {formatINR(sig.targetPrice)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-700 rounded-full"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{sig.rationale}</p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() =>
                      onInspectSignalChart(sig.symbol, {
                        entryLow: sig.entryLow,
                        entryHigh: sig.entryHigh,
                        targetPrice: sig.targetPrice,
                        stopLoss: sig.stopLoss,
                      })
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <LineChart className="w-3.5 h-3.5" /> View Levels
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onLogSignalPosition({
                        symbol: sig.symbol,
                        companyName: sig.companyName,
                        exchange: sig.exchange,
                        sector: sig.sector,
                        avgBuyPrice: Number(ltp.toFixed(2)),
                        source: 'signal',
                      })
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Position
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
