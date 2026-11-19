import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { MarketQuote } from '../types/market';
import { formatINR } from '../utils/portfolioAnalytics';

interface PortfolioHedgeCalculatorProps {
  totalEquityValue: number;
  weightedBeta: number;
  niftyQuote: MarketQuote | null;
}

type HedgeIndexKey = 'NIFTY' | 'MIDCPNIFTY';

// Standard normal CDF approximation (Abramowitz & Stegun) for Black-Scholes put estimation
function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * absX);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t) *
      Math.exp(-absX * absX);
  return 0.5 * (1 + sign * y);
}

function blackScholesPut(spot: number, strike: number, daysToExpiry: number, volPct: number, r = 0.065): number {
  if (spot <= 0 || strike <= 0) return 0;
  const T = Math.max(1 / 365, daysToExpiry / 365);
  const sigma = Math.max(0.05, volPct / 100);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const putPrice = strike * Math.exp(-r * T) * normCdf(-d2) - spot * normCdf(-d1);
  return Math.max(0.5, Number(putPrice.toFixed(2)));
}

const CASH_STORAGE_KEY = 'stoxify_cash_reserve_inr';

export function PortfolioHedgeCalculator({
  totalEquityValue,
  weightedBeta,
  niftyQuote,
}: PortfolioHedgeCalculatorProps) {
  const [cashReserveInr, setCashReserveInr] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CASH_STORAGE_KEY);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // Ignore storage access errors
    }
    return Math.round(totalEquityValue * 0.2);
  });

  const [indexKey, setIndexKey] = useState<HedgeIndexKey>('NIFTY');
  const [coveragePct, setCoveragePct] = useState<number>(60);
  const [spreadWidthPct, setSpreadWidthPct] = useState<number>(5);
  const [dte, setDte] = useState<number>(30);
  const [ivPct, setIvPct] = useState<number>(15);
  const [lotSizes, setLotSizes] = useState<Record<HedgeIndexKey, number>>({
    NIFTY: 75,
    MIDCPNIFTY: 120,
  });

  const [indexQuotes, setIndexQuotes] = useState<Record<string, MarketQuote>>({});
  const [spotLoading, setSpotLoading] = useState(false);

  const fetchIndexSpots = async () => {
    setSpotLoading(true);
    try {
      const res = await fetch('/api/market/quotes?symbols=%5ENSEI,%5ENSEMDCP50');
      if (res.ok) {
        const json = (await res.json()) as { quotes: Record<string, MarketQuote> };
        setIndexQuotes(json.quotes || {});
      }
    } finally {
      setSpotLoading(false);
    }
  };

  useEffect(() => {
    void fetchIndexSpots();
  }, []);

  const handleCashChange = (val: number) => {
    const clean = Number.isFinite(val) && val >= 0 ? val : 0;
    setCashReserveInr(clean);
    try {
      localStorage.setItem(CASH_STORAGE_KEY, String(clean));
    } catch {
      // Ignore storage write errors
    }
  };

  // 80/20 Capital Reserve Discipline
  const totalCapital = Math.max(0, totalEquityValue) + Math.max(0, cashReserveInr);
  const equityPct = totalCapital > 0 ? (totalEquityValue / totalCapital) * 100 : 0;
  const cashPct = totalCapital > 0 ? (cashReserveInr / totalCapital) * 100 : 0;
  const targetReserveForCurrentEquity = totalEquityValue * 0.25; // 20% of total = 25% of 80% equity
  const reserveGapInr = targetReserveForCurrentEquity - cashReserveInr;
  const reserveStatus =
    totalEquityValue <= 0
      ? 'idle'
      : cashPct >= 18 && cashPct <= 25
      ? 'aligned'
      : cashPct < 18
      ? 'under_reserved'
      : 'cash_heavy';

  // Live index spot for selected hedge instrument
  const activeSymbol = indexKey === 'NIFTY' ? '^NSEI' : '^NSEMDCP50';
  const liveSpot =
    indexQuotes[activeSymbol]?.price ??
    (indexKey === 'NIFTY' ? niftyQuote?.price ?? 25000 : 17500);
  const strikeStep = indexKey === 'NIFTY' ? 50 : 25;
  const lotSize = Math.max(1, lotSizes[indexKey]);

  const hedgeCalc = useMemo(() => {
    const effectiveEquity = Math.max(0, totalEquityValue);
    const betaAdjustedExposure = effectiveEquity * Math.max(0.5, weightedBeta || 1) * (coveragePct / 100);
    const contractNotional = liveSpot * lotSize;
    const rawLots = contractNotional > 0 ? betaAdjustedExposure / contractNotional : 0;
    const suggestedLots = effectiveEquity > 0 ? Math.max(1, Math.round(rawLots)) : 0;

    const longPutStrike = Math.round(liveSpot / strikeStep) * strikeStep;
    const shortPutStrike = Math.max(
      strikeStep,
      Math.round((liveSpot * (1 - spreadWidthPct / 100)) / strikeStep) * strikeStep
    );

    const effectiveIv = indexKey === 'MIDCPNIFTY' ? ivPct + 3 : ivPct;
    const longPutPrem = blackScholesPut(liveSpot, longPutStrike, dte, effectiveIv);
    const shortPutPrem = blackScholesPut(liveSpot, shortPutStrike, dte, effectiveIv + 1);
    const netDebitPerUnit = Math.max(1, Number((longPutPrem - shortPutPrem).toFixed(2)));
    const totalDebitInr = suggestedLots * lotSize * netDebitPerUnit;
    const debitPctOfEquity = effectiveEquity > 0 ? (totalDebitInr / effectiveEquity) * 100 : 0;

    const maxSpreadWidth = Math.max(0, longPutStrike - shortPutStrike);
    const maxNetPayoffInr = Math.max(0, suggestedLots * lotSize * (maxSpreadWidth - netDebitPerUnit));

    const scenarios = [5, 10, 15].map((dropPct) => {
      const shockedSpot = liveSpot * (1 - dropPct / 100);
      const unhedgedLossInr = effectiveEquity * (dropPct / 100) * Math.max(0.6, weightedBeta || 1);
      const longIntrinsic = Math.max(0, longPutStrike - shockedSpot);
      const shortIntrinsic = Math.max(0, shortPutStrike - shockedSpot);
      const spreadExpiryValue = (longIntrinsic - shortIntrinsic) * suggestedLots * lotSize;
      const netHedgePnl = spreadExpiryValue - totalDebitInr;
      const netPortfolioDrawdownInr = Math.max(0, unhedgedLossInr - netHedgePnl);
      const protectionPct =
        unhedgedLossInr > 0 ? Math.max(0, ((unhedgedLossInr - netPortfolioDrawdownInr) / unhedgedLossInr) * 100) : 0;

      return {
        dropPct,
        shockedSpot,
        unhedgedLossInr,
        netHedgePnl,
        netPortfolioDrawdownInr,
        protectionPct,
      };
    });

    return {
      betaAdjustedExposure,
      contractNotional,
      suggestedLots,
      longPutStrike,
      shortPutStrike,
      longPutPrem,
      shortPutPrem,
      netDebitPerUnit,
      totalDebitInr,
      debitPctOfEquity,
      maxNetPayoffInr,
      scenarios,
    };
  }, [totalEquityValue, weightedBeta, coveragePct, liveSpot, lotSize, strikeStep, spreadWidthPct, dte, ivPct, indexKey]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
            <h3 className="text-base font-bold text-slate-900">
              Portfolio Risk Discipline — 80/20 Cash Reserve &amp; Index Hedge Sizing
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track cash-reserve liquidity alongside an illustrative NIFTY / MIDCPNIFTY Bear Put Spread hedge calibrated to your live equity value and portfolio beta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchIndexSpots()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${spotLoading ? 'animate-spin' : ''}`} />
          Refresh Index Spots
        </button>
      </div>

      {/* Section 1: 80/20 Capital Reserve Discipline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pb-5 border-b border-slate-100">
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">80/20 Cash Reserve Check</span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                reserveStatus === 'aligned'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : reserveStatus === 'under_reserved'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              {reserveStatus === 'aligned'
                ? 'On Target (80/20)'
                : reserveStatus === 'under_reserved'
                ? 'Reserve Below 20%'
                : reserveStatus === 'cash_heavy'
                ? 'Reserve Surplus'
                : 'Add Holdings'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Live Equity Value
              </label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono-tabular font-semibold text-slate-900">
                {formatINR(totalEquityValue, true)}
              </div>
            </div>
            <div>
              <label
                htmlFor="cash-reserve-input"
                className="block text-[11px] text-slate-500 mb-1"
              >
                Cash / Liquid Reserve (₹)
              </label>
              <input
                id="cash-reserve-input"
                type="number"
                min={0}
                step={10000}
                value={cashReserveInr}
                onChange={(e) => handleCashChange(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono-tabular font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono-tabular">
            <span className="text-slate-700 font-medium">
              Deployed Equity: <strong className="text-blue-700">{equityPct.toFixed(1)}%</strong>
            </span>
            <span className="text-slate-700 font-medium">
              Cash / Liquid Buffer:{' '}
              <strong className={cashPct >= 18 ? 'text-emerald-700' : 'text-amber-700'}>
                {cashPct.toFixed(1)}%
              </strong>
            </span>
          </div>
          <div className="relative h-3 bg-slate-100 rounded-md overflow-hidden flex">
            <div
              className="h-full bg-blue-700 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, equityPct))}%` }}
            />
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, cashPct))}%` }}
            />
            {/* 80% target marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-900/70"
              style={{ left: '80%' }}
              title="80/20 Guideline Marker"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>Guideline: 80% Equities · 20% Liquid Cash / Debt Reserve for drawdown opportunities.</span>
            {totalEquityValue > 0 && (
              <span className="font-mono-tabular font-medium text-slate-700">
                {reserveGapInr > 5000
                  ? `Add ${formatINR(reserveGapInr, true)} cash to reach 20% buffer`
                  : reserveGapInr < -5000
                  ? `${formatINR(Math.abs(reserveGapInr), true)} deployable above 20% buffer`
                  : 'Aligned with 80/20 reserve guideline'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Bear Put Spread Index Hedge Calculator */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-900">
              Live Index Bear Put Spread Hedge Calculator
            </div>
            <div className="text-[11px] text-slate-500">
              Buy ATM Put + Sell OTM Put to cap tail-risk drawdown at a defined premium cost
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            {(
              [
                { key: 'NIFTY' as const, label: 'NIFTY 50', sym: '^NSEI' },
                { key: 'MIDCPNIFTY' as const, label: 'MIDCPNIFTY', sym: '^NSEMDCP50' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setIndexKey(opt.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  indexKey === opt.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}{' '}
                <span className="font-mono-tabular text-[11px] text-slate-500 ml-1">
                  {indexQuotes[opt.sym]?.price
                    ? indexQuotes[opt.sym].price.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                    : ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Hedge Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">
              Hedge Coverage ({coveragePct}%)
            </label>
            <input
              type="range"
              min={25}
              max={100}
              step={5}
              value={coveragePct}
              onChange={(e) => setCoveragePct(Number(e.target.value))}
              className="w-full accent-blue-700 mt-1.5"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Spread Width</label>
            <select
              value={spreadWidthPct}
              onChange={(e) => setSpreadWidthPct(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value={3}>3% OTM Short Put</option>
              <option value={5}>5% OTM Short Put</option>
              <option value={8}>8% OTM Short Put</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Expiry Horizon</label>
            <select
              value={dte}
              onChange={(e) => setDte(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value={15}>15 DTE (Bi-weekly)</option>
              <option value={30}>30 DTE (Monthly)</option>
              <option value={45}>45 DTE (Next Month)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Est. IV (%)</label>
            <input
              type="number"
              min={8}
              max={45}
              value={ivPct}
              onChange={(e) => setIvPct(Math.max(8, Math.min(45, Number(e.target.value) || 15)))}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono-tabular text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">NSE Lot Size</label>
            <input
              type="number"
              min={1}
              value={lotSize}
              onChange={(e) =>
                setLotSizes((prev) => ({
                  ...prev,
                  [indexKey]: Math.max(1, Number(e.target.value) || 1),
                }))
              }
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono-tabular text-slate-800"
            />
          </div>
        </div>

        {/* Computed Spread Structure KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500">
              {indexKey} Live Spot · Suggested Lots
            </div>
            <div className="text-base font-bold font-mono-tabular text-slate-900 mt-0.5">
              {liveSpot.toLocaleString('en-IN', { maximumFractionDigits: 1 })} ·{' '}
              <span className="text-blue-700">
                {hedgeCalc.suggestedLots} {hedgeCalc.suggestedLots === 1 ? 'lot' : 'lots'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
              β-adj cover: {formatINR(hedgeCalc.betaAdjustedExposure, true)}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500">Bear Put Spread Strikes</div>
            <div className="text-sm font-bold font-mono-tabular text-slate-900 mt-1">
              Buy {hedgeCalc.longPutStrike} PE / Sell {hedgeCalc.shortPutStrike} PE
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
              Est. ₹{hedgeCalc.longPutPrem} − ₹{hedgeCalc.shortPutPrem} = ₹{hedgeCalc.netDebitPerUnit}/pt
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500">Est. Net Hedge Cost</div>
            <div className="text-base font-bold font-mono-tabular text-amber-800 mt-0.5">
              {formatINR(hedgeCalc.totalDebitInr, true)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
              {hedgeCalc.debitPctOfEquity.toFixed(2)}% of equity portfolio
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500">Max Net Hedge Payoff</div>
            <div className="text-base font-bold font-mono-tabular text-emerald-700 mt-0.5">
              {formatINR(hedgeCalc.maxNetPayoffInr, true)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
              At expiry &le; {hedgeCalc.shortPutStrike}
            </div>
          </div>
        </div>

        {/* Drawdown Stress Comparison Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-2 px-3">Index Stress Scenario</th>
                <th className="py-2 px-3 text-right">Shocked Spot</th>
                <th className="py-2 px-3 text-right">Unhedged Drawdown</th>
                <th className="py-2 px-3 text-right">Net Spread Payoff</th>
                <th className="py-2 px-3 text-right">Net Hedged Drawdown</th>
                <th className="py-2 px-3 text-right">Loss Cushioned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-tabular">
              {hedgeCalc.scenarios.map((sc) => (
                <tr key={sc.dropPct}>
                  <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                    -{sc.dropPct}% {indexKey} Correction
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700">
                    {sc.shockedSpot.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 px-3 text-right text-red-700 font-semibold">
                    -{formatINR(sc.unhedgedLossInr, true)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-semibold ${
                      sc.netHedgePnl >= 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {sc.netHedgePnl >= 0 ? '+' : ''}
                    {formatINR(sc.netHedgePnl, true)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-900 font-semibold">
                    -{formatINR(sc.netPortfolioDrawdownInr, true)}
                  </td>
                  <td className="py-2 px-3 text-right text-blue-700 font-semibold">
                    {sc.protectionPct.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-500">
          Educational risk-modeling estimate only (not SEBI-registered derivatives advice). Option premiums are illustrative Black-Scholes approximations anchored to live index spots; verify live NSE option chain bid-ask quotes, lot sizes, and margin requirements with your broker before trading.
        </p>
      </div>
    </div>
  );
}
