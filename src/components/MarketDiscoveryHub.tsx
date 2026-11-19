import { Filter, Sparkles, TrendingUp } from 'lucide-react';
import type { Exchange, StrategyConstituent } from '../types/market';
import type { ChartOverlayLevels } from './MarketChartTerminal';
import { ProScreenerView } from './ProScreenerView';
import { ResearchSignalsView } from './ResearchSignalsView';
import { AiStrategiesView } from './AiStrategiesView';

export type DiscoverySubTab = 'screener' | 'signals' | 'strategies';

interface MarketDiscoveryHubProps {
  activeSubTab: DiscoverySubTab;
  onChangeSubTab: (tab: DiscoverySubTab) => void;
  onInspectChart: (symbol: string, levels?: ChartOverlayLevels | null) => void;
  onToggleWatchlist: (
    symbol: string,
    companyName: string,
    exchange: Exchange,
    sector: string
  ) => void;
  isInWatchlist: (symbol: string) => boolean;
  onLogSignalPosition: (prefill: {
    symbol: string;
    companyName: string;
    exchange: Exchange;
    sector: string;
    avgBuyPrice: number;
    source: 'signal';
  }) => void;
  onStageStrategyBuy: (constituent: StrategyConstituent, strategyName: string) => void;
}

const TABS: Array<{
  key: DiscoverySubTab;
  label: string;
  description: string;
  icon: typeof Filter;
}> = [
  {
    key: 'screener',
    label: 'Screener & Patterns',
    description: 'Live NSE/BSE universe, 4-pillar confidence & 24M walk-forward patterns',
    icon: Filter,
  },
  {
    key: 'signals',
    label: 'Research Signals',
    description: 'Actionable swing & positional setups with live targets and stop-loss levels',
    icon: Sparkles,
  },
  {
    key: 'strategies',
    label: 'AI Baskets',
    description: '4 Nifty-benchmarked NSE factor baskets with monthly rotation ledgers',
    icon: TrendingUp,
  },
];

export function MarketDiscoveryHub({
  activeSubTab,
  onChangeSubTab,
  onInspectChart,
  onToggleWatchlist,
  isInWatchlist,
  onLogSignalPosition,
  onStageStrategyBuy,
}: MarketDiscoveryHubProps) {
  const activeMeta = TABS.find((t) => t.key === activeSubTab) ?? TABS[0];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit overflow-x-auto max-w-full">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChangeSubTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-500 truncate">{activeMeta.description}</div>
      </div>

      {activeSubTab === 'screener' && (
        <ProScreenerView
          onInspectChart={(sym) => onInspectChart(sym, null)}
          onToggleWatchlist={onToggleWatchlist}
          isInWatchlist={isInWatchlist}
        />
      )}

      {activeSubTab === 'signals' && (
        <ResearchSignalsView
          onInspectSignalChart={(sym, levels) => onInspectChart(sym, levels)}
          onLogSignalPosition={onLogSignalPosition}
        />
      )}

      {activeSubTab === 'strategies' && (
        <AiStrategiesView
          onInspectChart={(sym) => onInspectChart(sym, null)}
          onToggleWatchlist={onToggleWatchlist}
          isInWatchlist={isInWatchlist}
          onStageBuy={onStageStrategyBuy}
        />
      )}
    </div>
  );
}
