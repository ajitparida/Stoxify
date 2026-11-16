export type Exchange = 'NSE' | 'BSE';

export type HoldingSource = 'manual' | 'screenshot' | 'signal';

export type ChartRange = '1d' | '5d' | '1mo' | '6mo' | '1y';

export interface MarketQuote {
  symbol: string;
  ticker: string;
  shortName: string;
  exchange: Exchange | 'INDEX';
  sector: string;
  capCategory: 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Index';
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  volume: number;
  avgVolume20d: number;
  volumeRatio: number;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  return1M: number | null;
  return6M: number | null;
  return1Y: number | null;
  peRatio: number | null;
  roce: number | null;
  debtToEquity: number | null;
  beta: number;
  annualDividendPerShare: number;
  dividendYield: number;
  lastDividendDate: string | null;
  lastDividendAmount: number | null;
  dividendPayoutCount1Y: number;
  marketState: string;
  updatedAt: string;
  isCachedFallback?: boolean;
}

export interface CandlePoint {
  timestamp: number;
  dateLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma50: number | null;
  ema20: number | null;
}

export interface ChartResponse {
  symbol: string;
  range: ChartRange;
  quote: MarketQuote;
  candles: CandlePoint[];
}

export interface SearchResultItem {
  symbol: string;
  ticker: string;
  name: string;
  exchange: Exchange;
  sector: string;
  type: string;
}

export interface HoldingRecord {
  id: string;
  userId: string;
  symbol: string;
  companyName: string;
  exchange: Exchange;
  sector: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string;
  notes?: string;
  source: HoldingSource;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WatchlistRecord {
  id: string;
  userId: string;
  symbol: string;
  companyName: string;
  exchange: Exchange;
  sector: string;
  targetAlertPrice?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EnrichedHolding extends HoldingRecord {
  livePrice: number;
  previousClose: number;
  investedValue: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  dayGain: number;
  dayGainPercent: number;
  weightPercent: number;
  dividendYield: number;
  annualDividendPerShare: number;
  expectedAnnualDividend: number;
  yieldOnCost: number;
  lastDividendDate: string | null;
  quote?: MarketQuote;
  healthStatus: 'Healthy' | 'Watch' | 'Dead Stock';
  healthReason: string;
}

export interface ResearchSignal {
  id: string;
  symbol: string;
  ticker: string;
  companyName: string;
  exchange: Exchange;
  sector: string;
  segment: 'Equity Swing' | 'Positional' | 'Long Term';
  action: 'BUY' | 'HOLD';
  entryLow: number;
  entryHigh: number;
  targetPrice: number;
  stopLoss: number;
  horizon: string;
  rationale: string;
  publishedDate: string;
}

export interface ParsedScreenshotHolding {
  tempId: string;
  rawName: string;
  resolvedSymbol: string;
  resolvedName: string;
  exchange: Exchange;
  sector: string;
  quantity: number;
  avgBuyPrice: number;
  screenshotLtp: number | null;
  livePrice: number | null;
  priceDeviationPct: number | null;
  verified: boolean;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export interface ScreenshotParseResponse {
  brokerDetected: string;
  holdings: ParsedScreenshotHolding[];
  warnings: string[];
}

export type ScreenerPreset =
  | 'all'
  | 'golden_crossover'
  | 'volume_shockers'
  | 'multibagger_value'
  | 'oversold_rebound'
  | 'top_gainers';

export type AiRatingVerdict = 'BUY' | 'HOLD' | 'EXIT';

export interface HorizonProjection {
  return6MPercent: number;
  value6M: number;
  return1YPercent: number;
  value1Y: number;
  cagr5YPercent: number;
  value5Y: number;
  cagr10YPercent: number;
  value10Y: number;
  optimizedValue6M?: number;
  optimizedValue1Y?: number;
  optimizedValue5Y?: number;
  optimizedValue10Y?: number;
  basisNote?: string;
}

export interface HoldingAiRating {
  symbol: string;
  rating: AiRatingVerdict;
  conviction: 'High' | 'Medium' | 'Low';
  headline: string;
  rationale: string;
  keyRisk: string;
  suggestedTarget: number;
  suggestedStopLoss: number;
  projection?: HorizonProjection;
  guardrailStatus?: 'PASSED' | 'ADJUSTED' | 'FLAGGED';
  guardrailNote?: string;
}

export interface PortfolioAnalysisResponse {
  overallSummary: string;
  diversificationNote: string;
  actionPriority: string;
  ratings: HoldingAiRating[];
  portfolioProjection?: HorizonProjection;
  benchmarkNifty6M: number | null;
  analysisSource?: 'gemini' | 'fallback_engine';
  quotaNotice?: string;
  analyzedAt: string;
}

export type MfPlanType = 'Direct' | 'Regular';
export type MfOptionType = 'Growth' | 'IDCW';
export type MfHoldingSource = 'manual' | 'screenshot' | 'cas_pdf';
export type MfReportGrade = 'A+' | 'A' | 'B' | 'C' | 'D';
export type MfSwitchAction = 'HOLD' | 'SWITCH_TO_DIRECT' | 'SWITCH_PEER';
export type MfTimingVerdict =
  | 'SWITCH_NOW'
  | 'WAIT_EXIT_LOAD'
  | 'STAGGER_FOR_LTCG'
  | 'HOLD_STEADY';

export interface MutualFundHoldingRecord {
  id: string;
  userId: string;
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
  monthlySipAmount?: number;
  folioNumber?: string;
  source: MfHoldingSource;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MfSearchResult {
  schemeCode: string;
  schemeName: string;
  planType: MfPlanType;
  optionType: MfOptionType;
}

export interface MfNavPoint {
  date: string;
  nav: number;
  indexedFund?: number;
  indexedBenchmark?: number;
}

export interface MfFifoBreakdown {
  lotCount: number;
  isSipReconstructed: boolean;
  exitLoadFreeUnits: number;
  exitLoadFreeValue: number;
  ltcgEligibleUnits: number;
  ltcgEligibleValue: number;
  stcgUnits: number;
  stcgValue: number;
  exitLoadTaxedUnits: number;
  exitLoadTaxedValue: number;
  oldestLotDate: string;
  newestLotDate: string;
}

export interface MfSwitchSuggestion {
  action: MfSwitchAction;
  timingVerdict: MfTimingVerdict;
  targetSchemeCode: string | null;
  targetSchemeName: string | null;
  targetCategory: string | null;
  targetExpenseRatio: number | null;
  targetReturn1Y: number | null;
  targetReturn3Y: number | null;
  targetGrade: MfReportGrade | null;
  annualCommissionSaved: number;
  tenYearProjectedExtraWealth: number;
  holdingDays: number;
  exitLoadWindowDays: number;
  exitLoadRatePct: number;
  exitLoadRuleLabel?: string;
  daysUntilExitLoadFree: number;
  estimatedExitLoad: number;
  taxCategory: 'EQUITY' | 'DEBT';
  taxType: 'STCG' | 'LTCG' | 'SLAB' | 'NO_GAIN';
  estimatedTax: number;
  netFirstYearBenefit: number;
  breakEvenMonths: number | null;
  fifoBreakdown?: MfFifoBreakdown;
  rationale: string;
}

export interface AnalyzedMutualFund {
  holding: MutualFundHoldingRecord;
  latestNav: number;
  previousNav: number;
  navDate: string;
  dayChangePercent: number;
  investedValue: number;
  currentValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  estExpenseRatio: number;
  terSource?: 'AMC Verified' | 'Category Est.';
  annualFeeDrag: number;
  benchmarkName: string;
  return1Y: number | null;
  return3Y: number | null;
  return5Y: number | null;
  benchmarkReturn1Y: number | null;
  benchmarkReturn3Y: number | null;
  benchmarkReturn5Y?: number | null;
  alpha3Y: number | null;
  beta: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  downsideCapture: number | null;
  rollingBeatRate: number | null;
  consistencyScore: number;
  downsideProtectionScore: number;
  reportCardGrade: MfReportGrade;
  navHistory: MfNavPoint[];
  switchSuggestion: MfSwitchSuggestion;
}

export interface MutualFundSummaryMetrics {
  totalInvested: number;
  totalCurrent: number;
  totalGain: number;
  totalGainPercent: number;
  estXirr: number | null;
  totalAnnualFeeDrag: number;
  regularCommissionLeak: number;
  tenYearCommissionLeak: number;
  switchCount: number;
  regularPlanCount: number;
  underperformerCount: number;
}

export interface MutualFundAnalysisResponse {
  funds: AnalyzedMutualFund[];
  summary: MutualFundSummaryMetrics;
  analyzedAt: string;
}

export interface ParsedMutualFundImportRow {
  tempId: string;
  rawSchemeName: string;
  resolvedSchemeCode: string;
  resolvedSchemeName: string;
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
  latestNav: number | null;
  verified: boolean;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  screenshotInvestedAmount?: number;
  screenshotCurrentValue?: number;
}

export interface MutualFundImportParseResponse {
  sourceDetected: string;
  holdings: ParsedMutualFundImportRow[];
  warnings: string[];
}

export interface MfAiSwitchAdviceResponse {
  portfolioVerdict: string;
  priorityMove: string;
  taxOptimizationNote: string;
  portfolioProjection?: HorizonProjection;
  recommendations: Array<{
    schemeCode: string;
    actionSummary: string;
    executionSteps: string;
    projection?: HorizonProjection;
  }>;
  guardrailWarnings?: string[];
  analysisSource?: 'gemini' | 'fallback_engine';
  quotaNotice?: string;
  generatedAt: string;
}


