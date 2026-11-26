import type {
  EnrichedHolding,
  HoldingRecord,
  MarketQuote,
  MutualFundHoldingRecord,
} from '../types/market';

export const SAMPLE_HOLDINGS: HoldingRecord[] = [
  {
    id: 'sample_reliance',
    userId: 'guest',
    symbol: 'RELIANCE.NS',
    companyName: 'Reliance Industries Ltd',
    exchange: 'NSE',
    sector: 'Energy & Telecom',
    quantity: 45,
    avgBuyPrice: 1245.0,
    buyDate: '2025-05-14',
    notes: 'Core energy + Jio value unlock',
    source: 'manual',
  },
  {
    id: 'sample_icicibank',
    userId: 'guest',
    symbol: 'ICICIBANK.NS',
    companyName: 'ICICI Bank Ltd',
    exchange: 'NSE',
    sector: 'Banking',
    quantity: 80,
    avgBuyPrice: 1120.5,
    buyDate: '2025-03-22',
    notes: 'Private banking leader',
    source: 'manual',
  },
  {
    id: 'sample_tcs',
    userId: 'guest',
    symbol: 'TCS.NS',
    companyName: 'Tata Consultancy Services Ltd',
    exchange: 'NSE',
    sector: 'IT Services',
    quantity: 22,
    avgBuyPrice: 3890.0,
    buyDate: '2025-07-10',
    notes: 'IT export compounder',
    source: 'manual',
  },
  {
    id: 'sample_bel',
    userId: 'guest',
    symbol: 'BEL.NS',
    companyName: 'Bharat Electronics Ltd',
    exchange: 'NSE',
    sector: 'Defence & Aerospace',
    quantity: 240,
    avgBuyPrice: 248.0,
    buyDate: '2025-04-08',
    notes: 'Defence capex play',
    source: 'signal',
  },
  {
    id: 'sample_yesbank',
    userId: 'guest',
    symbol: 'YESBANK.NS',
    companyName: 'Yes Bank Ltd',
    exchange: 'NSE',
    sector: 'Banking',
    quantity: 1800,
    avgBuyPrice: 25.4,
    buyDate: '2024-11-18',
    notes: 'Legacy turnaround bet',
    source: 'manual',
  },
  {
    id: 'sample_asianpaint',
    userId: 'guest',
    symbol: 'ASIANPAINT.NS',
    companyName: 'Asian Paints Ltd',
    exchange: 'NSE',
    sector: 'Consumer Durables',
    quantity: 28,
    avgBuyPrice: 2940.0,
    buyDate: '2025-01-15',
    notes: 'Paint sector watchlist review',
    source: 'manual',
  },
];

export const DEFAULT_WATCHLIST_SYMBOLS = [
  'RELIANCE.NS',
  'HDFCBANK.NS',
  'TCS.NS',
  'INFY.NS',
  'ICICIBANK.NS',
  'TMPV.NS',
  'BEL.NS',
  'TRENT.NS',
];

export function formatINR(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '₹0.00';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (compact) {
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
    if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)} K`;
  }

  return `${sign}₹${abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number | null | undefined, includePlus = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const prefix = includePlus && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatVolume(vol: number): string {
  if (!Number.isFinite(vol) || vol <= 0) return '—';
  if (vol >= 1e7) return `${(vol / 1e7).toFixed(2)} Cr`;
  if (vol >= 1e5) return `${(vol / 1e5).toFixed(2)} L`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)} K`;
  return String(vol);
}

/**
 * Computes approximate portfolio XIRR using Newton-Raphson on dated holding cashflows + current value.
 */
export function calculatePortfolioXIRR(
  holdings: Array<{ investedValue: number; buyDate: string }>,
  currentTotalValue: number
): number | null {
  if (holdings.length === 0 || currentTotalValue <= 0) return null;
  const totalInvested = holdings.reduce((s, h) => s + h.investedValue, 0);
  if (totalInvested <= 0) return null;

  const now = Date.now();
  const flows = holdings.map((h) => {
    const parsed = Date.parse(h.buyDate);
    const ts = Number.isFinite(parsed) ? Math.min(parsed, now - 86400_000) : now - 180 * 86400_000;
    const years = Math.max((now - ts) / (365.25 * 86400_000), 1 / 365);
    return { amount: -h.investedValue, years };
  });
  flows.push({ amount: currentTotalValue, years: 0 });

  let rate = (currentTotalValue - totalInvested) / totalInvested;
  rate = Math.max(-0.9, Math.min(rate, 3.0));

  for (let iter = 0; iter < 40; iter++) {
    let f = 0;
    let df = 0;
    for (const cf of flows) {
      const denom = Math.pow(1 + rate, -cf.years);
      f += cf.amount * denom;
      df += -cf.years * cf.amount * Math.pow(1 + rate, -cf.years - 1);
    }
    if (Math.abs(f) < 1e-4) break;
    if (Math.abs(df) < 1e-8) break;
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.99 || next > 10) break;
    rate = next;
  }

  return Number.isFinite(rate) ? Number((rate * 100).toFixed(2)) : null;
}

export function enrichHoldings(
  holdings: HoldingRecord[],
  quotes: Record<string, MarketQuote>,
  niftyBenchmark?: MarketQuote | null
): EnrichedHolding[] {
  const nifty6M = niftyBenchmark?.return6M ?? 4.0;

  const preliminary = holdings.map((h) => {
    const rawSym = h.symbol.trim();
    const upperSym = rawSym.toUpperCase();
    const bareSym = upperSym.replace(/\.(NS|BO)$/, '');
    const quote =
      quotes[rawSym] ??
      quotes[upperSym] ??
      quotes[`${bareSym}.NS`] ??
      quotes[`${bareSym}.BO`] ??
      quotes[bareSym];
    const hasLiveQuote = Boolean(quote && Number.isFinite(quote.price) && quote.price > 0);
    const livePrice = hasLiveQuote && quote ? quote.price : h.avgBuyPrice;
    const previousClose = hasLiveQuote && quote?.previousClose ? quote.previousClose : livePrice;
    const investedValue = h.quantity * h.avgBuyPrice;
    const currentValue = h.quantity * livePrice;
    const totalPnl = currentValue - investedValue;
    const totalPnlPercent = investedValue > 0 ? (totalPnl / investedValue) * 100 : 0;
    const dayGain = (livePrice - previousClose) * h.quantity;
    const dayGainPercent = previousClose > 0 ? ((livePrice - previousClose) / previousClose) * 100 : 0;

    // Dead-Stock & Watch Diagnostics
    let healthStatus: 'Healthy' | 'Watch' | 'Dead Stock' = 'Healthy';
    let healthReason = 'Outperforming or aligned with trend support';

    const belowSma200 = quote?.sma200 ? livePrice < quote.sma200 : false;
    const belowSma50 = quote?.sma50 ? livePrice < quote.sma50 : false;
    const r6m = quote?.return6M ?? null;
    const underperformingNifty = r6m !== null && r6m < nifty6M - 10;

    if ((totalPnlPercent < -8 && belowSma200) || (r6m !== null && r6m < -10 && underperformingNifty && belowSma200)) {
      healthStatus = 'Dead Stock';
      healthReason = `Trailing Nifty 50 by ${(nifty6M - (r6m ?? 0)).toFixed(1)}% (6M) & below 200-DMA`;
    } else if (totalPnlPercent < -3 || (belowSma50 && underperformingNifty)) {
      healthStatus = 'Watch';
      healthReason = belowSma50
        ? 'Trading below 50-DMA with muted momentum'
        : 'Mild drawdown from average buy cost';
    } else if (quote?.sma50 && livePrice > quote.sma50) {
      healthReason = 'Trading above 50-DMA with positive trend structure';
    }

    const annualDividendPerShare = quote?.annualDividendPerShare ?? 0;
    const dividendYield = quote?.dividendYield ?? 0;
    const expectedAnnualDividend =
      annualDividendPerShare > 0
        ? Number((h.quantity * annualDividendPerShare).toFixed(2))
        : Number(((currentValue * dividendYield) / 100).toFixed(2));
    const yieldOnCost =
      h.avgBuyPrice > 0 && annualDividendPerShare > 0
        ? Number(((annualDividendPerShare / h.avgBuyPrice) * 100).toFixed(2))
        : 0;

    return {
      ...h,
      livePrice,
      previousClose,
      investedValue,
      currentValue,
      totalPnl,
      totalPnlPercent,
      dayGain,
      dayGainPercent,
      weightPercent: 0,
      dividendYield,
      annualDividendPerShare,
      expectedAnnualDividend,
      yieldOnCost,
      lastDividendDate: quote?.lastDividendDate ?? null,
      quote,
      hasLiveQuote,
      healthStatus,
      healthReason,
    };
  });

  const totalPortfolioValue = preliminary.reduce((sum, item) => sum + item.currentValue, 0);
  return preliminary
    .map((item) => ({
      ...item,
      weightPercent:
        totalPortfolioValue > 0
          ? Number(((item.currentValue / totalPortfolioValue) * 100).toFixed(2))
          : 0,
    }))
    .sort((a, b) => b.currentValue - a.currentValue);
}

export interface SectorAllocation {
  sector: string;
  value: number;
  weightPercent: number;
  pnl: number;
}

export interface PortfolioDiagnosticsSummary {
  totalInvested: number;
  totalCurrent: number;
  totalPnl: number;
  totalPnlPercent: number;
  dayGain: number;
  dayGainPercent: number;
  xirr: number | null;
  weightedBeta: number;
  sectorBreakdown: SectorAllocation[];
  capMix: Array<{ cap: string; weightPercent: number; value: number }>;
  deadStocks: EnrichedHolding[];
  totalExpectedAnnualDividends: number;
  monthlyAverageDividend: number;
  portfolioDividendYield: number;
  portfolioYieldOnCost: number;
  dividendPayers: EnrichedHolding[];
  liveQuotedCount: number;
  missingQuoteSymbols: string[];
  concentrationAlerts: Array<{
    title: string;
    detail: string;
    severity: 'warning' | 'critical';
    symbol?: string;
  }>;
}

export function computePortfolioDiagnostics(
  enriched: EnrichedHolding[]
): PortfolioDiagnosticsSummary {
  const totalInvested = enriched.reduce((s, h) => s + h.investedValue, 0);
  const totalCurrent = enriched.reduce((s, h) => s + h.currentValue, 0);
  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const dayGain = enriched.reduce((s, h) => s + h.dayGain, 0);
  const prevTotal = totalCurrent - dayGain;
  const dayGainPercent = prevTotal > 0 ? (dayGain / prevTotal) * 100 : 0;

  const xirr = calculatePortfolioXIRR(enriched, totalCurrent);

  const weightedBeta =
    totalCurrent > 0
      ? Number(
          enriched
            .reduce((s, h) => s + (h.quote?.beta ?? 1.0) * (h.currentValue / totalCurrent), 0)
            .toFixed(2)
        )
      : 1.0;

  const sectorMap = new Map<string, { value: number; pnl: number }>();
  const capMap = new Map<string, number>();

  for (const h of enriched) {
    const sec = h.quote?.sector || h.sector || 'Equities';
    const prevSec = sectorMap.get(sec) ?? { value: 0, pnl: 0 };
    sectorMap.set(sec, {
      value: prevSec.value + h.currentValue,
      pnl: prevSec.pnl + h.totalPnl,
    });

    const cap = h.quote?.capCategory || 'Mid Cap';
    capMap.set(cap, (capMap.get(cap) ?? 0) + h.currentValue);
  }

  const sectorBreakdown: SectorAllocation[] = Array.from(sectorMap.entries())
    .map(([sector, d]) => ({
      sector,
      value: d.value,
      pnl: d.pnl,
      weightPercent: totalCurrent > 0 ? Number(((d.value / totalCurrent) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const capMix = Array.from(capMap.entries())
    .map(([cap, value]) => ({
      cap,
      value,
      weightPercent: totalCurrent > 0 ? Number(((value / totalCurrent) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const deadStocks = enriched.filter((h) => h.healthStatus === 'Dead Stock');
  const concentrationAlerts: PortfolioDiagnosticsSummary['concentrationAlerts'] = [];

  for (const h of enriched) {
    if (h.weightPercent > 25 && enriched.length > 2) {
      concentrationAlerts.push({
        title: `High Single-Stock Weight: ${h.symbol.replace(/\.(NS|BO)$/, '')}`,
        detail: `Position accounts for ${h.weightPercent.toFixed(1)}% of portfolio value (recommended cap < 20%).`,
        severity: 'warning',
        symbol: h.symbol,
      });
    }
  }

  for (const sec of sectorBreakdown) {
    if (sec.weightPercent > 35 && sectorBreakdown.length > 2) {
      concentrationAlerts.push({
        title: `Sector Skew: ${sec.sector}`,
        detail: `${sec.weightPercent.toFixed(1)}% of capital is concentrated in ${sec.sector}.`,
        severity: 'warning',
      });
    }
  }

  for (const ds of deadStocks) {
    concentrationAlerts.push({
      title: `Dead-Stock Drag: ${ds.symbol.replace(/\.(NS|BO)$/, '')}`,
      detail: `${ds.healthReason}. Current P&L: ${formatPercent(ds.totalPnlPercent)}.`,
      severity: 'critical',
      symbol: ds.symbol,
    });
  }

  const totalExpectedAnnualDividends = Number(
    enriched.reduce((s, h) => s + h.expectedAnnualDividend, 0).toFixed(2)
  );
  const monthlyAverageDividend = Number((totalExpectedAnnualDividends / 12).toFixed(2));
  const portfolioDividendYield =
    totalCurrent > 0
      ? Number(((totalExpectedAnnualDividends / totalCurrent) * 100).toFixed(2))
      : 0;
  const portfolioYieldOnCost =
    totalInvested > 0
      ? Number(((totalExpectedAnnualDividends / totalInvested) * 100).toFixed(2))
      : 0;
  const dividendPayers = enriched
    .filter((h) => h.expectedAnnualDividend > 0)
    .sort((a, b) => b.expectedAnnualDividend - a.expectedAnnualDividend);
  const liveQuotedCount = enriched.filter((h) => h.hasLiveQuote).length;
  const missingQuoteSymbols = Array.from(
    new Set(enriched.filter((h) => !h.hasLiveQuote).map((h) => h.symbol))
  );

  return {
    totalInvested,
    totalCurrent,
    totalPnl,
    totalPnlPercent,
    dayGain,
    dayGainPercent,
    xirr,
    weightedBeta,
    sectorBreakdown,
    capMix,
    deadStocks,
    totalExpectedAnnualDividends,
    monthlyAverageDividend,
    portfolioDividendYield,
    portfolioYieldOnCost,
    dividendPayers,
    liveQuotedCount,
    missingQuoteSymbols,
    concentrationAlerts,
  };
}

export const SAMPLE_MF_HOLDINGS: MutualFundHoldingRecord[] = [
  {
    id: 'sample_mf_ppfas_reg',
    userId: 'guest',
    schemeCode: '122640',
    schemeName: 'Parag Parikh Flexi Cap Fund - Regular Plan - Growth',
    fundHouse: 'PPFAS Mutual Fund',
    category: 'Flexi Cap',
    planType: 'Regular',
    optionType: 'Growth',
    units: 3250.45,
    avgNav: 64.2,
    purchaseDate: '2024-06-15',
    isSip: true,
    monthlySipAmount: 15000,
    folioNumber: '10482911/02',
    source: 'manual',
  },
  {
    id: 'sample_mf_axis_lc_reg',
    userId: 'guest',
    schemeCode: '112277',
    schemeName: 'Axis Large Cap Fund - Regular Plan - Growth Option',
    fundHouse: 'Axis Mutual Fund',
    category: 'Large Cap',
    planType: 'Regular',
    optionType: 'Growth',
    units: 2840.0,
    avgNav: 48.5,
    purchaseDate: '2023-09-10',
    isSip: false,
    monthlySipAmount: 0,
    folioNumber: '91044821/19',
    source: 'manual',
  },
  {
    id: 'sample_mf_sbi_sc_dir',
    userId: 'guest',
    schemeCode: '125497',
    schemeName: 'SBI SMALL CAP FUND - Direct Plan - Growth',
    fundHouse: 'SBI Mutual Fund',
    category: 'Small Cap',
    planType: 'Direct',
    optionType: 'Growth',
    units: 920.5,
    avgNav: 162.4,
    purchaseDate: '2026-07-08',
    isSip: true,
    monthlySipAmount: 10000,
    folioNumber: '22019481/04',
    source: 'manual',
  },
  {
    id: 'sample_mf_hdfc_mid_dir',
    userId: 'guest',
    schemeCode: '118989',
    schemeName: 'HDFC Mid Cap Fund - Direct Plan - Growth Option',
    fundHouse: 'HDFC Mutual Fund',
    category: 'Mid Cap',
    planType: 'Direct',
    optionType: 'Growth',
    units: 1450.25,
    avgNav: 138.6,
    purchaseDate: '2024-03-18',
    isSip: true,
    monthlySipAmount: 12000,
    folioNumber: '55192014/88',
    source: 'manual',
  },
  {
    id: 'sample_mf_hdfc_corp_dir',
    userId: 'guest',
    schemeCode: '118987',
    schemeName: 'HDFC Corporate Bond Fund - Direct Plan - Growth Option',
    fundHouse: 'HDFC Mutual Fund',
    category: 'Debt / Corporate Bond',
    planType: 'Direct',
    optionType: 'Growth',
    units: 5400.0,
    avgNav: 28.4,
    purchaseDate: '2024-08-05',
    isSip: false,
    monthlySipAmount: 0,
    folioNumber: '55192014/91',
    source: 'manual',
  },
];

