import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Activity,
  Bot,
  Briefcase,
  CandlestickChart,
  Filter,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import {
  auth,
  batchCreateAlgoOrders,
  batchCreateHoldings,
  batchCreateMutualFundHoldings,
  batchDeleteAlgoOrders,
  batchDeleteHoldings,
  batchDeleteMutualFundHoldings,
  createAlgoStrategy,
  createHolding,
  createMutualFundHolding,
  deleteAlgoStrategy,
  deleteHolding,
  deleteMutualFundHolding,
  removeWatchlistItem,
  signInWithGoogle,
  signOutUser,
  subscribeAlgoOrders,
  subscribeAlgoStrategies,
  subscribeHoldings,
  subscribeMutualFunds,
  subscribeWatchlist,
  updateAlgoStrategy,
  updateAlgoStrategyStatus,
  updateHolding,
  updateMutualFundHolding,
  upsertWatchlistItem,
} from './firebase';
import { AddHoldingModal } from './components/AddHoldingModal';
import { AddMutualFundModal } from './components/AddMutualFundModal';
import { AlgoTradingView } from './components/AlgoTradingView';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { HealthDiagnosticsView } from './components/HealthDiagnosticsView';
import { MarketChartTerminal, type ChartOverlayLevels } from './components/MarketChartTerminal';
import { MfImportModal } from './components/MfImportModal';
import { MutualFundsView } from './components/MutualFundsView';
import { OverviewDashboardView } from './components/OverviewDashboardView';
import { PortfolioView } from './components/PortfolioView';
import { ProScreenerView } from './components/ProScreenerView';
import { ResearchSignalsView } from './components/ResearchSignalsView';
import { ScreenshotImportModal } from './components/ScreenshotImportModal';
import { AiStrategiesView } from './components/AiStrategiesView';
import type {
  AlgoOrderDraft,
  AlgoOrderRecord,
  AlgoPaperEvaluateResponse,
  AlgoStrategyDraft,
  AlgoStrategyRecord,
  AlgoStrategyStatus,
  CapitalRotationResponse,
  Exchange,
  HoldingRecord,
  HoldingSource,
  MarketQuote,
  MfAiSwitchAdviceResponse,
  MfHoldingSource,
  MfOptionType,
  MfPlanType,
  MutualFundAnalysisResponse,
  MutualFundHoldingRecord,
  PaperPositionSnapshot,
  PortfolioAnalysisResponse,
  RotationReplacementPick,
  WatchlistRecord,
} from './types/market';
import {
  computePortfolioDiagnostics,
  DEFAULT_WATCHLIST_SYMBOLS,
  enrichHoldings,
  formatINR,
  formatPercent,
  SAMPLE_HOLDINGS,
  SAMPLE_MF_HOLDINGS,
} from './utils/portfolioAnalytics';

type WorkspaceTab =
  | 'overview'
  | 'portfolio'
  | 'mutualFunds'
  | 'diagnostics'
  | 'charts'
  | 'screener'
  | 'signals'
  | 'strategies'
  | 'algo';

const NAV_GROUPS: Array<{
  groupLabel: string | null;
  items: Array<{ key: WorkspaceTab; label: string; icon: typeof Briefcase }>;
}> = [
  {
    groupLabel: null,
    items: [{ key: 'overview', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    groupLabel: 'Portfolios',
    items: [
      { key: 'portfolio', label: 'Equity Holdings', icon: Briefcase },
      { key: 'mutualFunds', label: 'Mutual Funds Pro', icon: Layers },
      { key: 'diagnostics', label: 'Health Diagnostics', icon: Activity },
    ],
  },
  {
    groupLabel: 'Market Intelligence',
    items: [
      { key: 'charts', label: 'Live Market Charts', icon: CandlestickChart },
      { key: 'screener', label: 'Pro Stock Screener', icon: Filter },
      { key: 'signals', label: 'Research Signals', icon: Sparkles },
      { key: 'strategies', label: 'AI Strategies', icon: TrendingUp },
      { key: 'algo', label: 'Algo Trading Lab', icon: Bot },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function formatApiError(rawMsg: string, fallback: string): string {
  const trimmed = (rawMsg || '').trim();
  if (!trimmed) return fallback;
  if (/429|RESOURCE_EXHAUSTED|quota|rate[-_\s]?limit/i.test(trimmed)) {
    return 'Gemini API daily free-tier quota (20 requests/day) was reached. Upload CSV files instead (0 AI quota used) or select a billing-enabled Gemini API key in Settings > Secrets.';
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string } | string };
      if (typeof parsed.error === 'string' && parsed.error) return parsed.error;
      if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
        return parsed.error.message.slice(0, 220);
      }
    } catch {
      // ignore invalid JSON
    }
  }
  return trimmed.slice(0, 260);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth & Firestore Cloud State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudHoldings, setCloudHoldings] = useState<HoldingRecord[]>([]);
  const [cloudWatchlist, setCloudWatchlist] = useState<WatchlistRecord[]>([]);
  const [cloudMutualFunds, setCloudMutualFunds] = useState<MutualFundHoldingRecord[]>([]);
  const [cloudAlgoStrategies, setCloudAlgoStrategies] = useState<AlgoStrategyRecord[]>([]);
  const [cloudAlgoOrders, setCloudAlgoOrders] = useState<AlgoOrderRecord[]>([]);
  const [guestHoldings, setGuestHoldings] = useState<HoldingRecord[]>([]);
  const [guestWatchlist, setGuestWatchlist] = useState<string[]>(DEFAULT_WATCHLIST_SYMBOLS);
  const [guestMutualFunds, setGuestMutualFunds] = useState<MutualFundHoldingRecord[]>([]);
  const [guestAlgoStrategies, setGuestAlgoStrategies] = useState<AlgoStrategyRecord[]>([]);
  const [guestAlgoOrders, setGuestAlgoOrders] = useState<AlgoOrderRecord[]>([]);
  const [paperEvalResult, setPaperEvalResult] = useState<AlgoPaperEvaluateResponse | null>(null);
  const [paperEvalLoading, setPaperEvalLoading] = useState(false);
  const [autoTickAlgo, setAutoTickAlgo] = useState(true);

  // Market Data State
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [autoPoll, setAutoPoll] = useState(true);

  // Mutual Fund Analytics State
  const [mfAnalysis, setMfAnalysis] = useState<MutualFundAnalysisResponse | null>(null);
  const [loadingMfAnalysis, setLoadingMfAnalysis] = useState(false);
  const [mfAnalysisError, setMfAnalysisError] = useState<string | null>(null);
  const [mfTaxSlabPct, setMfTaxSlabPct] = useState(30);
  const [mfLtcgExemption, setMfLtcgExemption] = useState(125000);
  const [mfAiAdvice, setMfAiAdvice] = useState<MfAiSwitchAdviceResponse | null>(null);
  const [mfAiLoading, setMfAiLoading] = useState(false);
  const [mfAiError, setMfAiError] = useState<string | null>(null);

  // Chart Selection
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>('^NSEI');
  const [chartOverlays, setChartOverlays] = useState<ChartOverlayLevels | null>(null);

  // Modals & Notifications
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingRecord | null>(null);
  const [prefillHolding, setPrefillHolding] = useState<{
    symbol?: string;
    companyName?: string;
    exchange?: Exchange;
    sector?: string;
    avgBuyPrice?: number;
    quantity?: number;
    notes?: string;
    source?: HoldingSource;
  } | null>(null);
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);
  const [addMfModalOpen, setAddMfModalOpen] = useState(false);
  const [editingMfHolding, setEditingMfHolding] = useState<MutualFundHoldingRecord | null>(null);
  const [mfImportModalOpen, setMfImportModalOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<PortfolioAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiBatchProgress, setAiBatchProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    evaluatedCount: number;
    totalCount: number;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [rotationData, setRotationData] = useState<CapitalRotationResponse | null>(null);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [portfolioActionBusy, setPortfolioActionBusy] = useState(false);
  const [clearConfirmTarget, setClearConfirmTarget] = useState<'equities' | 'mutualFunds' | null>(
    null
  );
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore Subscriptions when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setCloudHoldings([]);
      setCloudWatchlist([]);
      setCloudMutualFunds([]);
      setCloudAlgoStrategies([]);
      setCloudAlgoOrders([]);
      return;
    }

    const unsubHoldings = subscribeHoldings(
      user.uid,
      (items) => setCloudHoldings(items),
      (err) => {
        console.error(err);
        showToast('Unable to sync cloud holdings.', 'error');
      }
    );

    const unsubWatchlist = subscribeWatchlist(
      user.uid,
      (items) => setCloudWatchlist(items),
      (err) => {
        console.error(err);
        showToast('Unable to sync cloud watchlist.', 'error');
      }
    );

    const unsubMutualFunds = subscribeMutualFunds(
      user.uid,
      (items) => setCloudMutualFunds(items),
      (err) => {
        console.error(err);
        showToast('Unable to sync cloud mutual funds.', 'error');
      }
    );

    const unsubAlgoStrategies = subscribeAlgoStrategies(
      user.uid,
      (items) => setCloudAlgoStrategies(items),
      (err) => {
        console.error(err);
        showToast('Unable to sync cloud algo strategies.', 'error');
      }
    );

    const unsubAlgoOrders = subscribeAlgoOrders(
      user.uid,
      (items) => setCloudAlgoOrders(items),
      (err) => {
        console.error(err);
        showToast('Unable to sync cloud paper order book.', 'error');
      }
    );

    return () => {
      unsubHoldings();
      unsubWatchlist();
      unsubMutualFunds();
      unsubAlgoStrategies();
      unsubAlgoOrders();
    };
  }, [authReady, user, showToast]);

  const activeHoldings = user ? cloudHoldings : guestHoldings;
  const activeMutualFunds = user ? cloudMutualFunds : guestMutualFunds;
  const activeAlgoStrategies = user ? cloudAlgoStrategies : guestAlgoStrategies;
  const activeAlgoOrders = user ? cloudAlgoOrders : guestAlgoOrders;
  const activeWatchlistSymbols = useMemo(() => {
    if (user) {
      return cloudWatchlist.length > 0
        ? Array.from(new Set(cloudWatchlist.map((w) => w.symbol)))
        : DEFAULT_WATCHLIST_SYMBOLS.slice(0, 5);
    }
    return Array.from(new Set(guestWatchlist));
  }, [user, cloudWatchlist, guestWatchlist]);

  const symbolsToPoll = useMemo(() => {
    const set = new Set<string>([
      '^NSEI',
      '^BSESN',
      '^NSEBANK',
      ...activeHoldings.map((h) => h.symbol),
      ...activeWatchlistSymbols,
      ...activeAlgoStrategies.flatMap((s) => s.symbols),
    ]);
    return Array.from(set);
  }, [activeHoldings, activeWatchlistSymbols, activeAlgoStrategies]);

  const fetchQuotes = useCallback(async () => {
    if (symbolsToPoll.length === 0) return;
    try {
      const symbolChunks: string[][] = [];
      for (let i = 0; i < symbolsToPoll.length; i += 50) {
        symbolChunks.push(symbolsToPoll.slice(i, i + 50));
      }

      const responses = await Promise.all(
        symbolChunks.map(async (chunk) => {
          const res = await fetch(
            `/api/market/quotes?symbols=${encodeURIComponent(chunk.join(','))}`
          );
          if (!res.ok) throw new Error('Quote refresh failed');
          return (await res.json()) as {
            quotes: Record<string, MarketQuote>;
            fetchedAt: string;
          };
        })
      );

      const mergedQuotes: Record<string, MarketQuote> = {};
      let latestFetchedAt = new Date().toISOString();
      for (const r of responses) {
        Object.assign(mergedQuotes, r.quotes || {});
        if (r.fetchedAt) latestFetchedAt = r.fetchedAt;
      }

      setQuotes((prev) => ({ ...prev, ...mergedQuotes }));
      setLastUpdated(latestFetchedAt);
    } catch {
      // Keep stale quotes silently on transient polling blip
    } finally {
      setLoadingQuotes(false);
    }
  }, [symbolsToPoll]);

  useEffect(() => {
    void fetchQuotes();
    if (!autoPoll) return;
    const interval = setInterval(() => {
      void fetchQuotes();
    }, 20_000);
    return () => clearInterval(interval);
  }, [fetchQuotes, autoPoll]);

  const fetchMutualFundAnalysis = useCallback(async () => {
    if (activeMutualFunds.length === 0) {
      setMfAnalysis({
        funds: [],
        summary: {
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
        },
        analyzedAt: new Date().toISOString(),
      });
      setMfAnalysisError(null);
      return;
    }

    setLoadingMfAnalysis(true);
    setMfAnalysisError(null);
    try {
      const res = await fetch('/api/mf/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdings: activeMutualFunds,
          taxSlabPct: mfTaxSlabPct,
          ltcgExemptionRemaining: mfLtcgExemption,
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'AMFI mutual fund analytics unavailable.');
      }
      const data = (await res.json()) as MutualFundAnalysisResponse;
      setMfAnalysis(data);
    } catch (err) {
      setMfAnalysisError(
        err instanceof Error ? err.message : 'Unable to analyze mutual funds against AMFI.'
      );
    } finally {
      setLoadingMfAnalysis(false);
    }
  }, [activeMutualFunds, mfTaxSlabPct, mfLtcgExemption]);

  useEffect(() => {
    void fetchMutualFundAnalysis();
  }, [fetchMutualFundAnalysis]);

  const niftyQuote = quotes['^NSEI'] ?? null;
  const sensexQuote = quotes['^BSESN'] ?? null;

  const enrichedHoldings = useMemo(
    () => enrichHoldings(activeHoldings, quotes, niftyQuote),
    [activeHoldings, quotes, niftyQuote]
  );

  const diagnostics = useMemo(
    () => computePortfolioDiagnostics(enrichedHoldings),
    [enrichedHoldings]
  );

  const handleAuthAction = async () => {
    try {
      if (user) {
        await signOutUser();
        showToast('Signed out of cloud portfolio.');
      } else {
        await signInWithGoogle();
        showToast('Signed in — cloud portfolio sync active.');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Authentication failed.', 'error');
    }
  };

  const handleSaveHolding = async (data: {
    id?: string;
    symbol: string;
    companyName: string;
    exchange: Exchange;
    sector: string;
    quantity: number;
    avgBuyPrice: number;
    buyDate: string;
    notes: string;
    source: HoldingSource;
  }) => {
    if (user) {
      if (data.id) {
        await updateHolding(user.uid, data.id, {
          quantity: data.quantity,
          avgBuyPrice: data.avgBuyPrice,
          buyDate: data.buyDate,
          sector: data.sector,
          notes: data.notes,
        });
        showToast(`Updated ${data.symbol} in cloud portfolio.`);
      } else {
        await createHolding(user.uid, data);
        showToast(`Added ${data.symbol} to cloud portfolio.`);
      }
    } else {
      if (data.id) {
        setGuestHoldings((prev) =>
          prev.map((h) => (h.id === data.id ? { ...h, ...data } : h))
        );
        showToast(`Updated ${data.symbol} in session portfolio.`);
      } else {
        setGuestHoldings((prev) => [
          ...prev,
          {
            ...data,
            id: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId: 'guest',
          },
        ]);
        showToast(`Added ${data.symbol} (sign in to save permanently).`);
      }
    }
  };

  const handleDeleteHolding = async (holdingId: string) => {
    if (user) {
      try {
        await deleteHolding(user.uid, holdingId);
        showToast('Holding removed from cloud portfolio.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete holding.', 'error');
      }
    } else {
      setGuestHoldings((prev) => prev.filter((h) => h.id !== holdingId));
      showToast('Holding removed from session.');
    }
  };

  const handleImportScreenshotHoldings = async (
    rows: Array<{
      symbol: string;
      companyName: string;
      exchange: Exchange;
      sector: string;
      quantity: number;
      avgBuyPrice: number;
      buyDate: string;
      notes: string;
    }>
  ) => {
    if (user) {
      await batchCreateHoldings(
        user.uid,
        rows.map((r) => ({ ...r, source: 'screenshot' as const }))
      );
      showToast(`Imported ${rows.length} verified holdings to your cloud portfolio.`);
    } else {
      const mapped: HoldingRecord[] = rows.map((r, i) => ({
        ...r,
        id: `shot_${Date.now()}_${i}`,
        userId: 'guest',
        source: 'screenshot',
      }));
      setGuestHoldings((prev) => [...mapped, ...prev]);
      showToast(`Loaded ${rows.length} holdings into active workspace. Sign in to sync permanently.`);
    }
  };

  const isInWatchlist = useCallback(
    (sym: string) => {
      if (user) return cloudWatchlist.some((w) => w.symbol === sym);
      return guestWatchlist.includes(sym);
    },
    [user, cloudWatchlist, guestWatchlist]
  );

  const handleToggleWatchlist = async (
    symbol: string,
    companyName: string,
    exchange: Exchange,
    sector: string
  ) => {
    if (user) {
      const existing = cloudWatchlist.find((w) => w.symbol === symbol);
      if (existing) {
        await removeWatchlistItem(user.uid, existing.id);
        showToast(`Removed ${symbol} from watchlist.`);
      } else {
        await upsertWatchlistItem(user.uid, { symbol, companyName, exchange, sector });
        showToast(`Added ${symbol} to cloud watchlist.`);
      }
    } else {
      setGuestWatchlist((prev) =>
        prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [symbol, ...prev]
      );
      showToast(
        guestWatchlist.includes(symbol)
          ? `Removed ${symbol} from watchlist.`
          : `Added ${symbol} to watchlist.`
      );
    }
  };

  const openChartForSymbol = (symbol: string, overlays: ChartOverlayLevels | null = null) => {
    setSelectedChartSymbol(symbol);
    setChartOverlays(overlays);
    setActiveTab('charts');
    setMobileMenuOpen(false);
  };

  const getConsolidatedHoldings = useCallback(() => {
    const valueBySymbol = new Map<string, number>();
    for (const eh of enrichedHoldings) {
      const sym = eh.symbol.toUpperCase();
      valueBySymbol.set(sym, (valueBySymbol.get(sym) ?? 0) + eh.currentValue);
    }

    const consolidatedMap = new Map<
      string,
      {
        symbol: string;
        companyName: string;
        exchange: string;
        sector: string;
        quantity: number;
        avgBuyPrice: number;
        buyDate: string;
      }
    >();

    for (const h of activeHoldings) {
      const sym = h.symbol.toUpperCase();
      const existing = consolidatedMap.get(sym);
      if (!existing) {
        consolidatedMap.set(sym, {
          symbol: sym,
          companyName: h.companyName,
          exchange: h.exchange,
          sector: h.sector,
          quantity: h.quantity,
          avgBuyPrice: h.avgBuyPrice,
          buyDate: h.buyDate,
        });
      } else {
        const totalQty = existing.quantity + h.quantity;
        const totalCost = existing.quantity * existing.avgBuyPrice + h.quantity * h.avgBuyPrice;
        consolidatedMap.set(sym, {
          ...existing,
          quantity: Number(totalQty.toFixed(4)),
          avgBuyPrice: totalQty > 0 ? Number((totalCost / totalQty).toFixed(2)) : existing.avgBuyPrice,
          buyDate: existing.buyDate <= h.buyDate ? existing.buyDate : h.buyDate,
        });
      }
    }

    return {
      valueBySymbol,
      uniqueSortedHoldings: Array.from(consolidatedMap.values()).sort(
        (a, b) => (valueBySymbol.get(b.symbol) ?? 0) - (valueBySymbol.get(a.symbol) ?? 0)
      ),
    };
  }, [activeHoldings, enrichedHoldings]);

  const handleRunCapitalRotation = useCallback(async () => {
    if (activeHoldings.length === 0) return;
    setRotationLoading(true);
    setRotationError(null);
    const { uniqueSortedHoldings } = getConsolidatedHoldings();

    try {
      const res = await fetch('/api/portfolio/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdings: uniqueSortedHoldings }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          formatApiError(errBody.error || '', 'Failed to compute Smart Capital Rotation.')
        );
      }
      const json = (await res.json()) as CapitalRotationResponse;
      setRotationData(json);
    } catch (err) {
      const rawMsg =
        err instanceof Error ? err.message : 'Unable to scan Smart Capital Rotation setups.';
      setRotationError(formatApiError(rawMsg, 'Unable to scan Smart Capital Rotation setups.'));
    } finally {
      setRotationLoading(false);
    }
  }, [activeHoldings.length, getConsolidatedHoldings]);

  const handleRunAiAnalysis = async () => {
    if (activeHoldings.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    void handleRunCapitalRotation();

    // Consolidate by symbol first & prioritize largest positions so batch #1 covers key exposure first
    const { valueBySymbol, uniqueSortedHoldings } = getConsolidatedHoldings();

    const CLIENT_AI_BATCH_SIZE = 40;
    const batches: Array<typeof uniqueSortedHoldings> = [];
    for (let i = 0; i < uniqueSortedHoldings.length; i += CLIENT_AI_BATCH_SIZE) {
      batches.push(uniqueSortedHoldings.slice(i, i + CLIENT_AI_BATCH_SIZE));
    }

    const totalCount = uniqueSortedHoldings.length;
    setAiBatchProgress({
      currentBatch: 1,
      totalBatches: batches.length,
      evaluatedCount: 0,
      totalCount,
    });

    try {
      let accumulated: PortfolioAnalysisResponse | null = null;
      let evaluatedCount = 0;

      for (let i = 0; i < batches.length; i++) {
        setAiBatchProgress({
          currentBatch: i + 1,
          totalBatches: batches.length,
          evaluatedCount,
          totalCount,
        });

        const res = await fetch('/api/portfolio/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            holdings: batches[i],
            totalPortfolioValue: diagnostics.totalCurrent,
            skipPortfolioSummary: i > 0,
          }),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            formatApiError(
              errBody.error || '',
              `AI portfolio evaluation failed on batch ${i + 1} of ${batches.length}.`
            )
          );
        }

        const batchData = (await res.json()) as PortfolioAnalysisResponse;
        evaluatedCount += batches[i].length;

        if (!accumulated) {
          accumulated = batchData;
        } else {
          const prevAcc: PortfolioAnalysisResponse = accumulated;
          const seenSyms = new Set(prevAcc.ratings.map((r) => r.symbol.toUpperCase()));
          const mergedRatings: PortfolioAnalysisResponse['ratings'] = [
            ...prevAcc.ratings,
            ...batchData.ratings.filter((r) => !seenSyms.has(r.symbol.toUpperCase())),
          ];

          const qtyMap = new Map(uniqueSortedHoldings.map((h) => [h.symbol.toUpperCase(), h.quantity]));
          let aggBase = 0;
          let agg6m = 0;
          let agg1y = 0;
          let agg5y = 0;
          let agg10y = 0;
          for (const rt of mergedRatings) {
            const symKey = rt.symbol.toUpperCase();
            const posVal = valueBySymbol.get(symKey) ?? 0;
            const qty = qtyMap.get(symKey) ?? 0;
            if (!rt.projection || posVal <= 0 || qty <= 0) continue;
            aggBase += posVal;
            agg6m += qty * rt.projection.value6M;
            agg1y += qty * rt.projection.value1Y;
            agg5y += qty * rt.projection.value5Y;
            agg10y += qty * rt.projection.value10Y;
          }

          accumulated = {
            ...prevAcc,
            ratings: mergedRatings,
            portfolioProjection:
              aggBase > 0
                ? {
                    return6MPercent: Number((((agg6m - aggBase) / aggBase) * 100).toFixed(1)),
                    value6M: Math.round(agg6m),
                    return1YPercent: Number((((agg1y - aggBase) / aggBase) * 100).toFixed(1)),
                    value1Y: Math.round(agg1y),
                    cagr5YPercent: Number(((Math.pow(agg5y / aggBase, 1 / 5) - 1) * 100).toFixed(1)),
                    value5Y: Math.round(agg5y),
                    cagr10YPercent: Number(((Math.pow(agg10y / aggBase, 1 / 10) - 1) * 100).toFixed(1)),
                    value10Y: Math.round(agg10y),
                    basisNote: prevAcc.portfolioProjection?.basisNote,
                  }
                : prevAcc.portfolioProjection,
            analyzedAt: batchData.analyzedAt,
            analysisSource:
              batchData.analysisSource === 'fallback_engine' ||
              prevAcc.analysisSource === 'fallback_engine'
                ? 'fallback_engine'
                : prevAcc.analysisSource,
            quotaNotice: batchData.quotaNotice || prevAcc.quotaNotice,
          };
        }

        setAiAnalysis(accumulated);
        setAiBatchProgress({
          currentBatch: i + 1,
          totalBatches: batches.length,
          evaluatedCount,
          totalCount,
        });
      }

      if (accumulated) {
        showToast(
          accumulated.analysisSource === 'fallback_engine'
            ? `Quantitative engine evaluated ${accumulated.ratings.length} holdings (Gemini free-tier quota reached).`
            : `AI evaluation completed for ${accumulated.ratings.length} unique holdings across ${batches.length} ${batches.length === 1 ? 'batch' : 'batches'}.`
        );
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Unable to evaluate portfolio.';
      const msg = formatApiError(rawMsg, 'Unable to evaluate portfolio.');
      setAiError(msg);
      showToast(msg, 'error');
    } finally {
      setAiLoading(false);
      setAiBatchProgress(null);
    }
  };

  const handleSaveMutualFund = async (data: {
    id?: string;
    schemeCode: string;
    schemeName: string;
    fundHouse: string;
    category: string;
    planType: MfPlanType;
    optionType: MfOptionType;
    units: number;
    avgNav: number;
    purchaseDate: string;
    isSip: boolean;
    monthlySipAmount: number;
    folioNumber: string;
    source: MfHoldingSource;
  }) => {
    if (user) {
      if (data.id) {
        await updateMutualFundHolding(user.uid, data.id, {
          units: data.units,
          avgNav: data.avgNav,
          purchaseDate: data.purchaseDate,
          isSip: data.isSip,
          monthlySipAmount: data.monthlySipAmount,
          folioNumber: data.folioNumber,
        });
        showToast(`Updated ${data.schemeName.split(' - ')[0]} in cloud portfolio.`);
      } else {
        await createMutualFundHolding(user.uid, data);
        showToast(`Added ${data.schemeName.split(' - ')[0]} to cloud portfolio.`);
      }
    } else {
      if (data.id) {
        setGuestMutualFunds((prev) =>
          prev.map((m) => (m.id === data.id ? { ...m, ...data } : m))
        );
        showToast(`Updated ${data.schemeName.split(' - ')[0]} in session.`);
      } else {
        setGuestMutualFunds((prev) => [
          {
            ...data,
            id: `guest_mf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId: 'guest',
          },
          ...prev,
        ]);
        showToast(`Added ${data.schemeName.split(' - ')[0]} (sign in to sync permanently).`);
      }
    }
  };

  const handleDeleteMutualFund = async (id: string) => {
    if (user) {
      try {
        await deleteMutualFundHolding(user.uid, id);
        showToast('Mutual fund holding removed.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete mutual fund.', 'error');
      }
    } else {
      setGuestMutualFunds((prev) => prev.filter((m) => m.id !== id));
      showToast('Mutual fund removed from session.');
    }
  };

  const handleImportMutualFunds = async (
    rows: Array<{
      schemeCode: string;
      schemeName: string;
      fundHouse: string;
      category: string;
      planType: MfPlanType;
      optionType: MfOptionType;
      units: number;
      avgNav: number;
      purchaseDate: string;
      isSip: boolean;
      monthlySipAmount: number;
      folioNumber: string;
      source: MfHoldingSource;
    }>
  ) => {
    if (user) {
      await batchCreateMutualFundHoldings(user.uid, rows);
      showToast(`Imported ${rows.length} mutual funds to your cloud portfolio.`);
    } else {
      const mapped: MutualFundHoldingRecord[] = rows.map((r, i) => ({
        ...r,
        id: `mf_imp_${Date.now()}_${i}`,
        userId: 'guest',
      }));
      setGuestMutualFunds((prev) => [...mapped, ...prev]);
      showToast(`Loaded ${rows.length} mutual funds into active workspace.`);
    }
  };

  const handleGenerateMfAiAdvice = async () => {
    if (!mfAnalysis || mfAnalysis.funds.length === 0) return;
    setMfAiLoading(true);
    setMfAiError(null);
    try {
      const res = await fetch('/api/mf/ai-switch-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funds: mfAnalysis.funds,
          summary: mfAnalysis.summary,
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          formatApiError(errBody.error || '', 'AI mutual fund switch strategy failed.')
        );
      }
      const data = (await res.json()) as MfAiSwitchAdviceResponse;
      setMfAiAdvice(data);
      showToast(
        data.analysisSource === 'fallback_engine'
          ? 'Switch execution plan generated via AMFI Quant Engine (Gemini free-tier quota reached).'
          : 'AI mutual fund switch strategy ready.'
      );
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to generate switch strategy.';
      const msg = formatApiError(rawMsg, 'Failed to generate switch strategy.');
      setMfAiError(msg);
      showToast(msg, 'error');
    } finally {
      setMfAiLoading(false);
    }
  };

  const handlePreloadDemoEquities = async () => {
    setPortfolioActionBusy(true);
    try {
      if (user) {
        await batchCreateHoldings(
          user.uid,
          SAMPLE_HOLDINGS.map((h) => ({
            symbol: h.symbol,
            companyName: h.companyName,
            exchange: h.exchange,
            sector: h.sector,
            quantity: h.quantity,
            avgBuyPrice: h.avgBuyPrice,
            buyDate: h.buyDate,
            notes: h.notes || '',
            source: h.source,
          }))
        );
      } else {
        setGuestHoldings(SAMPLE_HOLDINGS);
      }
      showToast('Pre-loaded 6 sample NSE holdings.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to pre-load sample stocks.', 'error');
    } finally {
      setPortfolioActionBusy(false);
    }
  };

  const handlePreloadDemoMutualFunds = async () => {
    setPortfolioActionBusy(true);
    try {
      if (user) {
        await batchCreateMutualFundHoldings(
          user.uid,
          SAMPLE_MF_HOLDINGS.map((m) => ({
            schemeCode: m.schemeCode,
            schemeName: m.schemeName,
            fundHouse: m.fundHouse,
            category: m.category,
            planType: m.planType,
            optionType: m.optionType,
            units: m.units,
            avgNav: m.avgNav,
            purchaseDate: m.purchaseDate,
            isSip: m.isSip,
            monthlySipAmount: m.monthlySipAmount,
            folioNumber: m.folioNumber,
            source: m.source,
          }))
        );
      } else {
        setGuestMutualFunds(SAMPLE_MF_HOLDINGS);
      }
      showToast('Pre-loaded 5 sample AMFI mutual funds.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to pre-load sample mutual funds.',
        'error'
      );
    } finally {
      setPortfolioActionBusy(false);
    }
  };

  const handlePreloadAllDemo = async () => {
    setPortfolioActionBusy(true);
    try {
      let seededEquities = false;
      let seededMfs = false;
      if (activeHoldings.length === 0) {
        if (user) {
          await batchCreateHoldings(
            user.uid,
            SAMPLE_HOLDINGS.map((h) => ({
              symbol: h.symbol,
              companyName: h.companyName,
              exchange: h.exchange,
              sector: h.sector,
              quantity: h.quantity,
              avgBuyPrice: h.avgBuyPrice,
              buyDate: h.buyDate,
              notes: h.notes || '',
              source: h.source,
            }))
          );
        } else {
          setGuestHoldings(SAMPLE_HOLDINGS);
        }
        seededEquities = true;
      }

      if (activeMutualFunds.length === 0) {
        if (user) {
          await batchCreateMutualFundHoldings(
            user.uid,
            SAMPLE_MF_HOLDINGS.map((m) => ({
              schemeCode: m.schemeCode,
              schemeName: m.schemeName,
              fundHouse: m.fundHouse,
              category: m.category,
              planType: m.planType,
              optionType: m.optionType,
              units: m.units,
              avgNav: m.avgNav,
              purchaseDate: m.purchaseDate,
              isSip: m.isSip,
              monthlySipAmount: m.monthlySipAmount,
              folioNumber: m.folioNumber,
              source: m.source,
            }))
          );
        } else {
          setGuestMutualFunds(SAMPLE_MF_HOLDINGS);
        }
        seededMfs = true;
      }

      if (seededEquities || seededMfs) {
        showToast('Sample portfolio pre-loaded into your workspace.');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to pre-load sample portfolio.',
        'error'
      );
    } finally {
      setPortfolioActionBusy(false);
    }
  };

  const handleExecuteClearAll = async () => {
    if (!clearConfirmTarget) return;
    setPortfolioActionBusy(true);
    try {
      if (clearConfirmTarget === 'equities') {
        if (user) {
          await batchDeleteHoldings(
            user.uid,
            cloudHoldings.map((h) => h.id)
          );
        } else {
          setGuestHoldings([]);
        }
        setAiAnalysis(null);
        setRotationData(null);
        setRotationError(null);
        showToast('All equity holdings cleared.');
      } else {
        if (user) {
          await batchDeleteMutualFundHoldings(
            user.uid,
            cloudMutualFunds.map((m) => m.id)
          );
        } else {
          setGuestMutualFunds([]);
        }
        setMfAiAdvice(null);
        showToast('All mutual fund holdings cleared.');
      }
      setClearConfirmTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear portfolio.', 'error');
    } finally {
      setPortfolioActionBusy(false);
    }
  };

  const evaluatePaperEngine = useCallback(
    async (
      strategiesOverride?: AlgoStrategyRecord[],
      ordersOverride?: AlgoOrderRecord[]
    ) => {
      const targetStrategies = strategiesOverride ?? activeAlgoStrategies;
      const targetOrders = ordersOverride ?? activeAlgoOrders;

      if (targetStrategies.length === 0) {
        setPaperEvalResult({
          newOrders: [],
          strategyStatusUpdates: [],
          openPositions: [],
          strategyTelemetry: [],
          evaluatedAt: new Date().toISOString(),
        });
        return;
      }

      setPaperEvalLoading(true);
      try {
        const res = await fetch('/api/algo/paper-evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategies: targetStrategies,
            orders: targetOrders,
          }),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error || 'Paper engine scan failed.');
        }
        const evalData = (await res.json()) as AlgoPaperEvaluateResponse;
        setPaperEvalResult(evalData);

        if (evalData.newOrders.length > 0) {
          if (user) {
            await batchCreateAlgoOrders(user.uid, evalData.newOrders);
          } else {
            const stamped: AlgoOrderRecord[] = evalData.newOrders.map((o, idx) => ({
              ...o,
              id: `g_ord_${Date.now()}_${idx}`,
              userId: 'guest',
            }));
            setGuestAlgoOrders((prev) => [...stamped, ...prev]);
          }
        }

        if (evalData.strategyStatusUpdates.length > 0) {
          for (const upd of evalData.strategyStatusUpdates) {
            if (user) {
              await updateAlgoStrategyStatus(user.uid, upd.strategyId, upd.status);
            } else {
              setGuestAlgoStrategies((prev) =>
                prev.map((s) => (s.id === upd.strategyId ? { ...s, status: upd.status } : s))
              );
            }
          }
          showToast(evalData.strategyStatusUpdates[0].reason, 'error');
        } else if (evalData.newOrders.length > 0) {
          showToast(
            `Paper bot executed ${evalData.newOrders.length} simulated ${
              evalData.newOrders.length === 1 ? 'order' : 'orders'
            }.`
          );
        }
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Unable to evaluate live paper bots.',
          'error'
        );
      } finally {
        setPaperEvalLoading(false);
      }
    },
    [activeAlgoStrategies, activeAlgoOrders, user, showToast]
  );

  // Periodically evaluate active paper bots every 30s when Auto-Scan is active
  useEffect(() => {
    const hasActiveBot = activeAlgoStrategies.some((s) => s.status === 'ACTIVE');
    if (!autoTickAlgo || !hasActiveBot) return;
    const timer = setInterval(() => {
      void evaluatePaperEngine();
    }, 30_000);
    return () => clearInterval(timer);
  }, [autoTickAlgo, activeAlgoStrategies, evaluatePaperEngine]);

  // Refresh open positions view on entering Algo Lab if strategies already exist
  useEffect(() => {
    if (activeTab === 'algo' && activeAlgoStrategies.length > 0 && !paperEvalResult) {
      void evaluatePaperEngine();
    }
  }, [activeTab, activeAlgoStrategies.length, paperEvalResult, evaluatePaperEngine]);

  const handleSaveAlgoStrategy = async (
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
  ): Promise<string | void> => {
    const targetStatus: AlgoStrategyStatus = options?.status ?? 'DRAFT';
    const btPatch = options?.backtestSummary
      ? {
          lastBacktestReturnPct: options.backtestSummary.totalReturnPct,
          lastBacktestSharpe: options.backtestSummary.sharpeRatio,
          lastBacktestMaxDrawdownPct: options.backtestSummary.maxDrawdownPct,
          lastBacktestWinRatePct: options.backtestSummary.winRatePct,
        }
      : {};

    try {
      let savedId = options?.existingId;
      let nextStrategiesList = activeAlgoStrategies;

      if (user) {
        if (savedId) {
          await updateAlgoStrategy(user.uid, savedId, {
            ...draft,
            status: targetStatus,
            ...btPatch,
          });
        } else {
          savedId = await createAlgoStrategy(user.uid, {
            ...draft,
            status: targetStatus,
            ...btPatch,
          });
        }
        const newRec: AlgoStrategyRecord = {
          ...draft,
          ...btPatch,
          id: savedId,
          userId: user.uid,
          status: targetStatus,
        };
        nextStrategiesList = activeAlgoStrategies.some((s) => s.id === savedId)
          ? activeAlgoStrategies.map((s) => (s.id === savedId ? newRec : s))
          : [newRec, ...activeAlgoStrategies];
      } else {
        savedId = savedId || `guest_algo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const newRec: AlgoStrategyRecord = {
          ...draft,
          ...btPatch,
          id: savedId,
          userId: 'guest',
          status: targetStatus,
        };
        nextStrategiesList = activeAlgoStrategies.some((s) => s.id === savedId)
          ? activeAlgoStrategies.map((s) => (s.id === savedId ? newRec : s))
          : [newRec, ...activeAlgoStrategies];
        setGuestAlgoStrategies(nextStrategiesList);
      }

      showToast(
        targetStatus === 'ACTIVE'
          ? `Strategy "${draft.name}" saved and activated for paper trading.`
          : `Strategy "${draft.name}" saved as draft.`
      );

      if (targetStatus === 'ACTIVE') {
        await evaluatePaperEngine(nextStrategiesList, activeAlgoOrders);
      }
      return savedId;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save algo strategy.', 'error');
    }
  };

  const handleToggleAlgoStatus = async (
    strategy: AlgoStrategyRecord,
    nextStatus: AlgoStrategyStatus
  ) => {
    try {
      const nextList = activeAlgoStrategies.map((s) =>
        s.id === strategy.id ? { ...s, status: nextStatus } : s
      );
      if (user) {
        await updateAlgoStrategyStatus(user.uid, strategy.id, nextStatus);
      } else {
        setGuestAlgoStrategies(nextList);
      }
      showToast(`"${strategy.name}" status set to ${nextStatus}.`);
      if (nextStatus === 'ACTIVE') {
        await evaluatePaperEngine(nextList, activeAlgoOrders);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update bot status.', 'error');
    }
  };

  const handleDeleteAlgoStrategy = async (strategyId: string) => {
    try {
      if (user) {
        await deleteAlgoStrategy(user.uid, strategyId);
      } else {
        setGuestAlgoStrategies((prev) => prev.filter((s) => s.id !== strategyId));
      }
      showToast('Algo strategy deleted.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete strategy.', 'error');
    }
  };

  const handleHaltAllBots = async () => {
    const activeOnes = activeAlgoStrategies.filter((s) => s.status === 'ACTIVE');
    if (activeOnes.length === 0) return;
    try {
      setAutoTickAlgo(false);
      const nextList = activeAlgoStrategies.map((s) =>
        s.status === 'ACTIVE' ? { ...s, status: 'PAUSED' as AlgoStrategyStatus } : s
      );
      if (user) {
        await Promise.all(
          activeOnes.map((s) => updateAlgoStrategyStatus(user.uid, s.id, 'PAUSED'))
        );
      } else {
        setGuestAlgoStrategies(nextList);
      }
      setPaperEvalResult((prev) =>
        prev
          ? {
              ...prev,
              strategyTelemetry: prev.strategyTelemetry.map((t) =>
                t.status === 'ACTIVE' ? { ...t, status: 'PAUSED' } : t
              ),
              evaluatedAt: new Date().toISOString(),
            }
          : prev
      );
      showToast(`Emergency halt executed: paused ${activeOnes.length} active paper trading bots.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to halt active bots.', 'error');
    }
  };

  const handleSquareOffPaperPosition = async (pos: PaperPositionSnapshot) => {
    const livePrice = quotes[pos.symbol]?.price ?? pos.livePrice;
    const proceeds = Number((pos.quantity * livePrice).toFixed(2));
    const realizedPnl = Number((proceeds - pos.investedValue).toFixed(2));
    const nowIso = new Date().toISOString();
    const todayIst = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const draftOrder: AlgoOrderDraft = {
      strategyId: pos.strategyId,
      strategyName: pos.strategyName,
      symbol: pos.symbol,
      side: 'SELL',
      status: 'FILLED',
      quantity: pos.quantity,
      price: livePrice,
      notionalValue: proceeds,
      realizedPnl,
      triggerReason: `Manual square-off at ₹${livePrice}`,
      executedAtIso: nowIso,
      tradingDate: todayIst,
    };

    try {
      let nextOrders = activeAlgoOrders;
      if (user) {
        await batchCreateAlgoOrders(user.uid, [draftOrder]);
        nextOrders = [
          { ...draftOrder, id: `tmp_${Date.now()}`, userId: user.uid },
          ...activeAlgoOrders,
        ];
      } else {
        const rec: AlgoOrderRecord = {
          ...draftOrder,
          id: `g_sq_${Date.now()}`,
          userId: 'guest',
        };
        nextOrders = [rec, ...activeAlgoOrders];
        setGuestAlgoOrders(nextOrders);
      }
      showToast(`Squared off ${pos.quantity} ${pos.ticker} at ${formatINR(livePrice)}.`);
      await evaluatePaperEngine(activeAlgoStrategies, nextOrders);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to square off paper position.', 'error');
    }
  };

  const handleClearAlgoOrders = async () => {
    if (activeAlgoOrders.length === 0) return;
    try {
      if (user) {
        await batchDeleteAlgoOrders(
          user.uid,
          cloudAlgoOrders.map((o) => o.id)
        );
      } else {
        setGuestAlgoOrders([]);
      }
      await evaluatePaperEngine(activeAlgoStrategies, []);
      showToast('Paper order book cleared.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear order book.', 'error');
    }
  };

  const activeNavTitle = ALL_NAV_ITEMS.find((n) => n.key === activeTab)?.label || 'Workspace';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Left Sidebar Navigation (Desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-14 px-5 flex items-center border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Stoxify
          </span>
        </div>

        <nav className="p-3 space-y-4">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.groupLabel || `group_${gIdx}`} className="space-y-1">
              {group.groupLabel && (
                <div className="px-3 pb-0.5 text-[11px] font-semibold text-slate-400">
                  {group.groupLabel}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-blue-50 text-blue-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.key === 'portfolio' && activeHoldings.length > 0 && (
                      <span className="font-mono-tabular text-[11px] text-slate-400">
                        {activeHoldings.length}
                      </span>
                    )}
                    {item.key === 'mutualFunds' && activeMutualFunds.length > 0 && (
                      <span className="font-mono-tabular text-[11px] text-slate-400">
                        {activeMutualFunds.length}
                      </span>
                    )}
                    {item.key === 'diagnostics' && diagnostics.deadStocks.length > 0 && (
                      <span className="font-mono-tabular text-[11px] font-bold text-red-700">
                        {diagnostics.deadStocks.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Live Watchlist Panel */}
        <div className="mt-2 px-4 pt-4 border-t border-slate-100 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-slate-500">Live Watchlist</span>
            <button
              type="button"
              onClick={() => setScreenshotModalOpen(true)}
              className="text-[11px] font-medium text-blue-700 hover:underline inline-flex items-center gap-1"
            >
              <Upload className="w-3 h-3" /> Import
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {activeWatchlistSymbols.map((sym) => {
              const q = quotes[sym];
              const pos = (q?.changePercent ?? 0) >= 0;
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => openChartForSymbol(sym)}
                  className="w-full py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-50 rounded px-1.5 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {sym.replace(/\.(NS|BO)$/, '')}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {q?.exchange ?? 'NSE'}
                    </div>
                  </div>
                  <div className="text-right font-mono-tabular shrink-0">
                    <div className="text-xs font-semibold text-slate-900">
                      {q ? formatINR(q.price) : '—'}
                    </div>
                    <div
                      className={`text-[11px] font-medium ${
                        pos ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {q ? formatPercent(q.changePercent) : '—'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Account Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70">
          {user ? (
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {user.displayName || 'Investor'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={() => void handleAuthAction()}
                className="p-1.5 text-slate-500 hover:text-red-700 rounded hover:bg-white shrink-0"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleAuthAction()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In with Google
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="font-display text-base font-bold text-slate-900">
                Stoxify
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="p-3 space-y-4 flex-1 overflow-y-auto">
              {NAV_GROUPS.map((group, gIdx) => (
                <div key={group.groupLabel || `mgroup_${gIdx}`} className="space-y-1">
                  {group.groupLabel && (
                    <div className="px-3 pb-0.5 text-[11px] font-semibold text-slate-400">
                      {group.groupLabel}
                    </div>
                  )}
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.key);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-xs font-medium rounded-lg ${
                          active ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">Workspace</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{activeNavTitle}</h1>
            </div>
          </div>

          {/* Live Index Bar + Primary Action */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-4 text-xs font-mono-tabular">
              <button
                type="button"
                onClick={() => openChartForSymbol('^NSEI')}
                className="hover:bg-slate-50 px-2 py-1 rounded transition-colors whitespace-nowrap shrink-0"
              >
                <span className="text-slate-500 mr-1.5">NIFTY 50</span>
                <span className="font-semibold text-slate-900">
                  {niftyQuote ? niftyQuote.price.toLocaleString('en-IN') : '—'}
                </span>
                {niftyQuote && (
                  <span
                    className={`ml-1.5 font-medium ${
                      niftyQuote.changePercent >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {formatPercent(niftyQuote.changePercent)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => openChartForSymbol('^BSESN')}
                className="hover:bg-slate-50 px-2 py-1 rounded transition-colors whitespace-nowrap shrink-0"
              >
                <span className="text-slate-500 mr-1.5">SENSEX</span>
                <span className="font-semibold text-slate-900">
                  {sensexQuote ? sensexQuote.price.toLocaleString('en-IN') : '—'}
                </span>
                {sensexQuote && (
                  <span
                    className={`ml-1.5 font-medium ${
                      sensexQuote.changePercent >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {formatPercent(sensexQuote.changePercent)}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAutoPoll((p) => !p);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
                title="Toggle 20-second live refresh"
              >
                <RefreshCw
                  className={`w-3 h-3 ${loadingQuotes ? 'animate-spin text-blue-700' : ''}`}
                />
                <span>
                  {autoPoll ? 'Live 20s' : 'Paused'}
                  {lastUpdated
                    ? ` · ${new Date(lastUpdated).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })}`
                    : ''}
                </span>
              </button>

              {!user && (
                <button
                  type="button"
                  onClick={() => void handleAuthAction()}
                  className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1360px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewDashboardView
              holdings={enrichedHoldings}
              diagnostics={diagnostics}
              mfHoldings={activeMutualFunds}
              mfAnalysis={mfAnalysis}
              loadingMfAnalysis={loadingMfAnalysis}
              isGuestMode={!user}
              busyDemo={portfolioActionBusy}
              onNavigate={(tab) => setActiveTab(tab)}
              onAddStock={() => {
                setEditingHolding(null);
                setPrefillHolding(null);
                setAddModalOpen(true);
              }}
              onUploadStockScreenshot={() => setScreenshotModalOpen(true)}
              onAddMutualFund={() => {
                setEditingMfHolding(null);
                setAddMfModalOpen(true);
              }}
              onImportMutualFunds={() => setMfImportModalOpen(true)}
              onPreloadAllDemo={() => void handlePreloadAllDemo()}
              onInspectChart={(sym, avgBuy) =>
                openChartForSymbol(sym, avgBuy ? { avgBuyPrice: avgBuy } : null)
              }
            />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioView
              holdings={enrichedHoldings}
              diagnostics={diagnostics}
              loadingQuotes={loadingQuotes}
              isGuestMode={!user}
              aiRatings={aiAnalysis?.ratings}
              busyAction={portfolioActionBusy}
              onAddHolding={() => {
                setEditingHolding(null);
                setPrefillHolding(null);
                setAddModalOpen(true);
              }}
              onUploadScreenshot={() => setScreenshotModalOpen(true)}
              onEditHolding={(holding) => {
                setEditingHolding(holding);
                setPrefillHolding(null);
                setAddModalOpen(true);
              }}
              onDeleteHolding={(id) => void handleDeleteHolding(id)}
              onInspectChart={(sym, avgBuy) =>
                openChartForSymbol(sym, avgBuy ? { avgBuyPrice: avgBuy } : null)
              }
              onOpenDiagnostics={() => setActiveTab('diagnostics')}
              onRunAiAudit={() => {
                setActiveTab('diagnostics');
                void handleRunAiAnalysis();
              }}
              onPreloadDemo={() => void handlePreloadDemoEquities()}
              onClearAll={() => setClearConfirmTarget('equities')}
            />
          )}

          {activeTab === 'charts' && (
            <MarketChartTerminal
              symbol={selectedChartSymbol}
              onSelectSymbol={(sym) => setSelectedChartSymbol(sym)}
              overlayLevels={chartOverlays}
              onClearOverlay={() => setChartOverlays(null)}
              portfolioRating={
                aiAnalysis?.ratings.find(
                  (r) => r.symbol.toUpperCase() === selectedChartSymbol.toUpperCase()
                ) ?? null
              }
              portfolioAnalysisMeta={
                aiAnalysis
                  ? {
                      analyzedAt: aiAnalysis.analyzedAt,
                      analysisSource: aiAnalysis.analysisSource ?? 'gemini',
                      quotaNotice: aiAnalysis.quotaNotice,
                      benchmarkNifty6M: aiAnalysis.benchmarkNifty6M,
                      livePrice: quotes[selectedChartSymbol]?.price,
                      companyName: quotes[selectedChartSymbol]?.shortName,
                      exchange: quotes[selectedChartSymbol]?.exchange,
                      sector: quotes[selectedChartSymbol]?.sector,
                    }
                  : null
              }
              onOutlookUpdated={(updated) => {
                setAiAnalysis((prev) => {
                  if (!prev) return prev;
                  const targetSym = updated.symbol.toUpperCase();
                  if (!prev.ratings.some((r) => r.symbol.toUpperCase() === targetSym)) {
                    return prev;
                  }
                  return {
                    ...prev,
                    ratings: prev.ratings.map((r) =>
                      r.symbol.toUpperCase() === targetSym
                        ? {
                            ...r,
                            rating: updated.rating,
                            conviction: updated.conviction,
                            headline: updated.headline,
                            rationale: updated.rationale,
                            keyRisk: updated.keyRisk,
                            suggestedTarget: updated.suggestedTarget,
                            suggestedStopLoss: updated.suggestedStopLoss,
                            projection: updated.projection,
                            guardrailStatus: updated.guardrailStatus,
                            guardrailNote: updated.guardrailNote,
                          }
                        : r
                    ),
                    analyzedAt: updated.analyzedAt,
                  };
                });
              }}
              onAddHoldingClick={(sym) => {
                setEditingHolding(null);
                setPrefillHolding(
                  sym
                    ? {
                        symbol: sym,
                        companyName: quotes[sym]?.shortName,
                        exchange: quotes[sym]?.exchange === 'BSE' ? 'BSE' : 'NSE',
                        sector: quotes[sym]?.sector,
                        avgBuyPrice: quotes[sym]?.price,
                        source: 'manual',
                      }
                    : null
                );
                setAddModalOpen(true);
              }}
              onToggleWatchlist={(sym, name, exch, sec) =>
                void handleToggleWatchlist(sym, name, exch, sec)
              }
              isInWatchlist={isInWatchlist}
            />
          )}

          {activeTab === 'diagnostics' && (
            <HealthDiagnosticsView
              holdings={enrichedHoldings}
              diagnostics={diagnostics}
              niftyQuote={niftyQuote}
              aiAnalysis={aiAnalysis}
              aiLoading={aiLoading}
              aiProgress={aiBatchProgress}
              aiError={aiError}
              onRunAiAnalysis={() => void handleRunAiAnalysis()}
              rotationData={rotationData}
              rotationLoading={rotationLoading}
              rotationError={rotationError}
              onRunCapitalRotation={() => void handleRunCapitalRotation()}
              onToggleWatchlist={(sym, name, exch, sec) =>
                void handleToggleWatchlist(sym, name, exch, sec)
              }
              isInWatchlist={isInWatchlist}
              onStageRotationBuy={(
                pick: RotationReplacementPick,
                freedCapitalInr?: number,
                sourceTicker?: string
              ) => {
                const estQty =
                  freedCapitalInr && pick.livePrice > 0
                    ? Math.max(1, Math.floor(freedCapitalInr / pick.livePrice))
                    : 10;
                setEditingHolding(null);
                setPrefillHolding({
                  symbol: pick.symbol,
                  companyName: pick.companyName,
                  exchange: pick.exchange,
                  sector: pick.sector,
                  avgBuyPrice: pick.livePrice,
                  quantity: estQty,
                  notes: sourceTicker
                    ? `Rotated from ${sourceTicker} (Target ${formatINR(pick.suggestedTarget)} / SL ${formatINR(pick.suggestedStopLoss)})`
                    : `Rotation Setup (Score ${pick.undervaluedScore})`,
                  source: 'signal',
                });
                setAddModalOpen(true);
              }}
              onInspectChart={(sym, levels) => openChartForSymbol(sym, levels ?? null)}
            />
          )}

          {activeTab === 'screener' && (
            <ProScreenerView
              onInspectChart={(sym) => openChartForSymbol(sym)}
              onToggleWatchlist={(sym, name, exch, sec) =>
                void handleToggleWatchlist(sym, name, exch, sec)
              }
              isInWatchlist={isInWatchlist}
            />
          )}

          {activeTab === 'signals' && (
            <ResearchSignalsView
              onInspectSignalChart={(sym, levels) => openChartForSymbol(sym, levels)}
              onLogSignalPosition={(prefill) => {
                setEditingHolding(null);
                setPrefillHolding(prefill);
                setAddModalOpen(true);
              }}
            />
          )}

          {activeTab === 'strategies' && (
            <AiStrategiesView
              onInspectChart={(sym) => openChartForSymbol(sym)}
              onToggleWatchlist={(sym, name, exch, sec) =>
                void handleToggleWatchlist(sym, name, exch, sec)
              }
              isInWatchlist={isInWatchlist}
              onStageBuy={(constituent, strategyName) => {
                const defaultQty =
                  constituent.price > 0 ? Math.max(1, Math.round(25000 / constituent.price)) : 10;
                setEditingHolding(null);
                setPrefillHolding({
                  symbol: constituent.symbol,
                  companyName: constituent.name,
                  exchange: constituent.exchange,
                  sector: constituent.sector,
                  avgBuyPrice: constituent.price,
                  quantity: defaultQty,
                  notes: `${strategyName} constituent (${constituent.weightPercent}% basket weight)`,
                  source: 'signal',
                });
                setAddModalOpen(true);
              }}
            />
          )}

          {activeTab === 'algo' && (
            <AlgoTradingView
              strategies={activeAlgoStrategies}
              orders={activeAlgoOrders}
              quotes={quotes}
              isGuestMode={!user}
              paperEvalResult={paperEvalResult}
              paperEvalLoading={paperEvalLoading}
              autoTickEnabled={autoTickAlgo}
              onToggleAutoTick={() => setAutoTickAlgo((prev) => !prev)}
              onEvaluatePaperNow={() => void evaluatePaperEngine()}
              onSaveStrategy={handleSaveAlgoStrategy}
              onToggleStrategyStatus={handleToggleAlgoStatus}
              onDeleteStrategy={handleDeleteAlgoStrategy}
              onHaltAllBots={handleHaltAllBots}
              onSquareOffPosition={handleSquareOffPaperPosition}
              onClearOrders={handleClearAlgoOrders}
              onInspectChart={(sym, levels) => openChartForSymbol(sym, levels ?? null)}
            />
          )}

          {activeTab === 'mutualFunds' && (
            <MutualFundsView
              holdings={activeMutualFunds}
              analysis={mfAnalysis}
              loadingAnalysis={loadingMfAnalysis}
              analysisError={mfAnalysisError}
              isGuestMode={!user}
              taxSlabPct={mfTaxSlabPct}
              ltcgExemptionRemaining={mfLtcgExemption}
              busyAction={portfolioActionBusy}
              onChangeTaxProfile={(slab, ltcg) => {
                setMfTaxSlabPct(slab);
                setMfLtcgExemption(ltcg);
              }}
              onAddFund={() => {
                setEditingMfHolding(null);
                setAddMfModalOpen(true);
              }}
              onImportCasOrScreenshot={() => setMfImportModalOpen(true)}
              onEditFund={(holding) => {
                setEditingMfHolding(holding);
                setAddMfModalOpen(true);
              }}
              onDeleteFund={(id) => void handleDeleteMutualFund(id)}
              onPreloadDemo={() => void handlePreloadDemoMutualFunds()}
              onClearAll={() => setClearConfirmTarget('mutualFunds')}
              aiAdvice={mfAiAdvice}
              aiAdviceLoading={mfAiLoading}
              aiAdviceError={mfAiError}
              onGenerateAiAdvice={() => void handleGenerateMfAiAdvice()}
              onRefreshAnalysis={() => void fetchMutualFundAnalysis()}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <AddHoldingModal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setEditingHolding(null);
          setPrefillHolding(null);
        }}
        editingHolding={editingHolding}
        prefill={prefillHolding}
        onSave={handleSaveHolding}
      />

      <ScreenshotImportModal
        open={screenshotModalOpen}
        onClose={() => setScreenshotModalOpen(false)}
        onImportConfirmed={handleImportScreenshotHoldings}
      />

      <AddMutualFundModal
        open={addMfModalOpen}
        onClose={() => {
          setAddMfModalOpen(false);
          setEditingMfHolding(null);
        }}
        editingHolding={editingMfHolding}
        onSave={handleSaveMutualFund}
      />

      <MfImportModal
        open={mfImportModalOpen}
        onClose={() => setMfImportModalOpen(false)}
        onImportConfirmed={handleImportMutualFunds}
      />

      <ConfirmActionModal
        open={clearConfirmTarget !== null}
        title={
          clearConfirmTarget === 'equities'
            ? 'Clear All Equity Holdings?'
            : 'Clear All Mutual Fund Holdings?'
        }
        description={
          clearConfirmTarget === 'equities'
            ? `This will permanently delete all ${activeHoldings.length} stock ${
                activeHoldings.length === 1 ? 'position' : 'positions'
              } from your ${user ? 'cloud portfolio' : 'current session'}. You can re-import screenshots or pre-load demo stocks anytime.`
            : `This will permanently delete all ${activeMutualFunds.length} mutual fund ${
                activeMutualFunds.length === 1 ? 'scheme' : 'schemes'
              } from your ${user ? 'cloud portfolio' : 'current session'}. You can re-import a CAS PDF / screenshot or pre-load demo funds anytime.`
        }
        confirmLabel={
          clearConfirmTarget === 'equities' ? 'Delete All Stocks' : 'Delete All Mutual Funds'
        }
        busy={portfolioActionBusy}
        onCancel={() => setClearConfirmTarget(null)}
        onConfirm={() => void handleExecuteClearAll()}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg border shadow-lg text-xs font-medium flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}
        >
          {toast.type === 'error' && <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
