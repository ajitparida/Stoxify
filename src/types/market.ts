export type Exchange = 'NSE' | 'BSE';

export type HoldingSource = 'manual' | 'screenshot' | 'signal';

export type AlgoTimeframe = '1d' | '5d' | '1mo' | '6mo' | '1y';

export type ChartRange = AlgoTimeframe | '3y' | '5y' | 'max';

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
  return3M?: number | null;
  return6M: number | null;
  return1Y: number | null;
  peRatio: number | null;
  forwardPE?: number | null;
  roce: number | null;
  roePct?: number | null;
  roaPct?: number | null;
  revenueGrowthPct?: number | null;
  earningsGrowthPct?: number | null;
  operatingMarginPct?: number | null;
  debtToEquity: number | null;
  nextEarningsDate?: string | null;
  daysToEarnings?: number | null;
  earningsRiskFlag?: boolean;
  fundamentalsSource?: 'live_yahoo' | 'catalog_fallback';
  confidence?: ConfidenceBreakdown;
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
  return1MPercent?: number;
  value1M?: number;
  return3MPercent?: number;
  value3M?: number;
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
  confidence?: ConfidenceBreakdown;
  fundamentals?: LiveFundamentalsSnapshot | null;
  calibration?: LiveCalibrationContext | null;
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

export interface SymbolAiOutlook {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  livePrice: number;
  rating: AiRatingVerdict;
  conviction: 'High' | 'Medium' | 'Low';
  headline: string;
  rationale: string;
  keyRisk: string;
  suggestedTarget: number;
  suggestedStopLoss: number;
  projection: HorizonProjection;
  guardrailStatus: 'PASSED' | 'ADJUSTED' | 'FLAGGED';
  guardrailNote: string;
  confidence?: ConfidenceBreakdown;
  fundamentals?: LiveFundamentalsSnapshot | null;
  technicalSummary?: TechnicalSummary | null;
  fairValue?: IntrinsicFairValue | null;
  calibration?: LiveCalibrationContext | null;
  benchmarkNifty6M: number | null;
  analysisSource: 'gemini' | 'fallback_engine';
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

export type RotationActionType = 'TRIM_PROFIT' | 'EXIT_LAGGARD';

export interface RotationReplacementPick {
  symbol: string;
  ticker: string;
  companyName: string;
  exchange: Exchange;
  sector: string;
  capCategory: string;
  livePrice: number;
  roce: number | null;
  peRatio: number | null;
  debtToEquity: number | null;
  rsi14: number | null;
  return6M: number | null;
  return1Y: number | null;
  undervaluedScore: number;
  sectorDiversificationBonus: boolean;
  rotationThesis: string;
  suggestedTarget: number;
  suggestedStopLoss: number;
}

export interface CapitalRotationPair {
  sourceSymbol: string;
  sourceTicker: string;
  sourceCompanyName: string;
  sourceSector: string;
  actionType: RotationActionType;
  currentValue: number;
  livePrice: number;
  unrealizedPnlPercent: number;
  portfolioWeightPercent: number;
  suggestedTrimPercent: number;
  estimatedFreedCapital: number;
  triggerReason: string;
  candidates: RotationReplacementPick[];
}

export interface CapitalRotationResponse {
  totalEligibleFreedCapital: number;
  trimCount: number;
  exitCount: number;
  avgSourceRoce: number | null;
  avgReplacementRoce: number | null;
  pairs: CapitalRotationPair[];
  standaloneIdeas: RotationReplacementPick[];
  benchmarkNifty6M: number | null;
  analysisSource: 'gemini' | 'fallback_engine';
  quotaNotice?: string;
  generatedAt: string;
}

export type AiStrategyRisk = 'Low' | 'Moderate' | 'Aggressive';

export interface StrategyConstituent {
  symbol: string;
  ticker: string;
  name: string;
  exchange: Exchange;
  sector: string;
  capCategory: string;
  price: number;
  changePercent: number;
  peRatio: number | null;
  roce: number | null;
  debtToEquity: number | null;
  rsi14: number | null;
  return6M: number | null;
  return1Y: number | null;
  weightPercent: number;
  factorScore: number;
  selectionReason: string;
}

export interface StrategyRotationLogItem {
  action: 'ROTATE_OUT' | 'ROTATE_IN';
  symbol: string;
  ticker: string;
  companyName: string;
  sector: string;
  reason: string;
  returnTag: string;
}

export interface StrategyChartPoint {
  dateLabel: string;
  strategyIndexed: number;
  niftyIndexed: number;
}

export interface AiStrategyBasket {
  id: string;
  name: string;
  tagline: string;
  methodology: string;
  riskProfile: AiStrategyRisk;
  rebalanceCadence: string;
  return1M: number | null;
  return6M: number | null;
  return1Y: number | null;
  nifty1M: number | null;
  nifty6M: number | null;
  nifty1Y: number | null;
  alpha6M: number | null;
  alpha1Y: number | null;
  avgRoce: number | null;
  avgPe: number | null;
  chartSeries: StrategyChartPoint[];
  constituents: StrategyConstituent[];
  recentRotations: StrategyRotationLogItem[];
}

export interface AiStrategiesResponse {
  strategies: AiStrategyBasket[];
  niftyBenchmark: MarketQuote | null;
  fetchedAt: string;
}

export type AlgoIndicator =
  | 'RSI_14'
  | 'PRICE_VS_SMA50'
  | 'PRICE_VS_SMA200'
  | 'EMA20_VS_SMA50'
  | 'VOLUME_RATIO'
  | 'DAY_CHANGE_PCT'
  | 'SMA50_SLOPE_PCT';

export type AlgoComparator = 'LT' | 'LTE' | 'GT' | 'GTE' | 'CROSS_ABOVE' | 'CROSS_BELOW';

export type AlgoLogicOperator = 'AND' | 'OR';

export type AlgoStrategyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'PAUSED_RISK_CAP';

export interface AlgoRuleCondition {
  id: string;
  indicator: AlgoIndicator;
  comparator: AlgoComparator;
  threshold: number;
  label: string;
}

export interface AlgoStrategyDraft {
  name: string;
  prompt: string;
  summary: string;
  symbols: string[];
  timeframe: AlgoTimeframe;
  logicOperator: AlgoLogicOperator;
  entryConditions: AlgoRuleCondition[];
  exitConditions: AlgoRuleCondition[];
  virtualCapital: number;
  allocationPercent: number;
  stopLossPct: number;
  takeProfitPct: number;
  trailingStopPct: number;
  maxOpenPositions: number;
  dailyLossCapPct: number;
  slippageBps: number;
}

export interface AlgoStrategyRecord extends AlgoStrategyDraft {
  id: string;
  userId: string;
  status: AlgoStrategyStatus;
  lastBacktestReturnPct?: number;
  lastBacktestSharpe?: number;
  lastBacktestMaxDrawdownPct?: number;
  lastBacktestWinRatePct?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AlgoCompileResponse {
  strategy: AlgoStrategyDraft;
  analysisSource: 'gemini' | 'fallback_engine';
  quotaNotice?: string;
  generatedAt: string;
}

export interface AlgoEquityCurvePoint {
  dateLabel: string;
  equity: number;
  benchmarkEquity: number;
  equityIndexed: number;
  niftyIndexed: number;
  drawdownPct: number;
}

export type AlgoExitReason =
  | 'TARGET'
  | 'STOP_LOSS'
  | 'TRAILING_STOP'
  | 'EXIT_SIGNAL'
  | 'DAILY_LOSS_CAP'
  | 'END_OF_WINDOW';

export interface AlgoBacktestTrade {
  id: string;
  symbol: string;
  ticker: string;
  entryDate: string;
  exitDate: string;
  barsHeld: number;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  netPnl: number;
  pnlPct: number;
  exitReason: AlgoExitReason;
}

export interface AlgoBacktestSummary {
  initialCapital: number;
  finalEquity: number;
  netPnl: number;
  totalReturnPct: number;
  niftyReturnPct: number;
  alphaPct: number;
  cagrPct: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  winRatePct: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  guardrailHaltsTriggered: number;
  avgHoldingBars: number;
}

export interface AlgoBacktestResult {
  strategyName: string;
  timeframe: AlgoTimeframe;
  symbolsTested: string[];
  barCount: number;
  summary: AlgoBacktestSummary;
  equityCurve: AlgoEquityCurvePoint[];
  trades: AlgoBacktestTrade[];
  guardrailEvents: Array<{ dateLabel: string; message: string }>;
  ranAt: string;
}

export type AlgoOrderSide = 'BUY' | 'SELL';

export type AlgoOrderStatus = 'FILLED' | 'BLOCKED_RISK_CAP' | 'BLOCKED_FUNDS' | 'CANCELLED';

export interface AlgoOrderRecord {
  id: string;
  userId: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  side: AlgoOrderSide;
  status: AlgoOrderStatus;
  quantity: number;
  price: number;
  notionalValue: number;
  realizedPnl: number;
  triggerReason: string;
  executedAtIso: string;
  tradingDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AlgoOrderDraft = Omit<AlgoOrderRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export interface PaperPositionSnapshot {
  strategyId: string;
  strategyName: string;
  symbol: string;
  ticker: string;
  quantity: number;
  avgEntryPrice: number;
  livePrice: number;
  investedValue: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  stopLossPrice: number;
  targetPrice: number;
  enteredAtIso: string;
}

export interface AlgoPaperStrategyTelemetry {
  strategyId: string;
  strategyName: string;
  status: AlgoStrategyStatus;
  virtualCapital: number;
  availableCash: number;
  investedCapital: number;
  realizedPnlTotal: number;
  todayRealizedPnl: number;
  todayUnrealizedPnl: number;
  todayTotalPnl: number;
  todayLossPct: number;
  dailyLossCapPct: number;
  dailyCapBreached: boolean;
  openPositionsCount: number;
  maxOpenPositions: number;
}

export interface AlgoPaperEvaluateResponse {
  newOrders: AlgoOrderDraft[];
  strategyStatusUpdates: Array<{ strategyId: string; status: AlgoStrategyStatus; reason: string }>;
  openPositions: PaperPositionSnapshot[];
  strategyTelemetry: AlgoPaperStrategyTelemetry[];
  evaluatedAt: string;
}

export type PatternId =
  | 'high_confidence'
  | 'fresh_upward_move'
  | 'steady_upward_trend'
  | 'strong_on_dip'
  | 'momentum_reset'
  | 'higher_fundamental';

export interface AnalystConsensusSnapshot {
  targetMean: number | null;
  targetMedian: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  analystCount: number | null;
  recommendationKey: string | null;
  recommendationLabel: 'Strong Buy' | 'Buy' | 'Hold' | 'Underperform' | 'Sell' | null;
  recommendationMean: number | null;
}

export interface LiveFundamentalsSnapshot {
  symbol: string;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook?: number | null;
  evToEbitda?: number | null;
  roePct: number | null;
  roaPct: number | null;
  roceProxyPct: number | null;
  revenueGrowthPct: number | null;
  earningsGrowthPct: number | null;
  operatingMarginPct: number | null;
  profitMarginPct?: number | null;
  fcfMarginPct?: number | null;
  debtToEquity: number | null;
  nextEarningsDate: string | null;
  daysToEarnings: number | null;
  earningsRiskFlag: boolean;
  analystConsensus?: AnalystConsensusSnapshot | null;
  source: 'live_yahoo' | 'catalog_fallback';
  fetchedAt: string;
}

export type TechnicalSignalVote = 'Buy' | 'Neutral' | 'Sell';
export type TechnicalSummaryRating =
  | 'Strong Buy'
  | 'Buy'
  | 'Neutral'
  | 'Sell'
  | 'Strong Sell';

export interface TechnicalIndicatorReading {
  name: string;
  value: string;
  signal: TechnicalSignalVote;
}

export interface TechnicalTimeframeSummary {
  rating: TechnicalSummaryRating;
  buyCount: number;
  neutralCount: number;
  sellCount: number;
  movingAverages: {
    rating: TechnicalSummaryRating;
    buyCount: number;
    neutralCount: number;
    sellCount: number;
    items: TechnicalIndicatorReading[];
  };
  oscillators: {
    rating: TechnicalSummaryRating;
    buyCount: number;
    neutralCount: number;
    sellCount: number;
    items: TechnicalIndicatorReading[];
  };
}

export interface PivotPointsSnapshot {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
  basisDate: string;
}

export interface TechnicalSummary extends TechnicalTimeframeSummary {
  weekly?: TechnicalTimeframeSummary | null;
  pivots?: PivotPointsSnapshot | null;
  computedAt: string;
}

export interface ValuationModelPoint {
  name: string;
  value: number;
  weightPct: number;
  basis: string;
}

export interface IntrinsicFairValue {
  fairValue: number;
  lowEstimate: number;
  highEstimate: number;
  upsidePercent: number;
  verdict: 'Undervalued' | 'Fairly Valued' | 'Overvalued';
  uncertainty: 'Low' | 'Medium' | 'High';
  sectorMedianPE: number | null;
  models: ValuationModelPoint[];
  basisNote: string;
}

export interface ConfidencePillarDetail {
  score: number;
  weight: number;
  weightedPoints: number;
  summary: string;
}

export type ConfidenceAdjustmentCode =
  | 'EARNINGS_IMMINENT'
  | 'EARNINGS_UPCOMING'
  | 'FUNDAMENTALS_FALLBACK'
  | 'FUNDAMENTALS_PARTIAL';

export interface ConfidenceAdjustment {
  code: ConfidenceAdjustmentCode;
  label: string;
  delta: number;
  reason: string;
}

export interface ConfidenceBreakdown {
  baseScore?: number;
  adjustments?: ConfidenceAdjustment[];
  totalAdjustment?: number;
  overallScore: number;
  tier: 'Strong' | 'Moderate' | 'Caution';
  pillars: {
    trendStructure: ConfidencePillarDetail;
    relativeStrength: ConfidencePillarDetail;
    momentumQuality: ConfidencePillarDetail;
    fundamentalHealth: ConfidencePillarDetail;
  };
  matchedPatterns: PatternId[];
  primaryPattern: PatternId | null;
  computedAt: string;
}

export interface WalkForwardStats {
  sampleCount: number;
  winRate1M: number | null;
  avgReturn1M: number | null;
  winRate3M: number | null;
  avgReturn3M: number | null;
  lookbackMonths: number;
  basisNote: string;
}

export interface MonthlyCohortEntry {
  symbol: string;
  ticker: string;
  companyName: string;
  exchange: Exchange;
  sector: string;
  confidenceScore: number;
  return1M: number | null;
  return3M: number | null;
  ltp: number;
  nextEarningsDate: string | null;
  daysToEarnings: number | null;
  earningsRiskFlag: boolean;
  breakdown?: ConfidenceBreakdown;
}

export interface MonthlyCohortGroup {
  monthKey: string;
  monthLabel: string;
  isLatest: boolean;
  entries: MonthlyCohortEntry[];
}

export interface PatternDiscoveryItem {
  id: PatternId;
  title: string;
  subtitle: string;
  ruleSummary: string;
  liveCount: number;
  liveSymbols: string[];
  hasUpcomingEarningsAlert: boolean;
  upcomingEarningsCount: number;
  walkForward: WalkForwardStats;
  monthlyCohorts: MonthlyCohortGroup[];
}

export interface PatternDiscoveryResponse {
  patterns: PatternDiscoveryItem[];
  benchmarkSymbol: string;
  universeCount: number;
  computedAt: string;
}

export interface LiveResearchSignal extends ResearchSignal {
  liveQuote: MarketQuote | null;
  confidence?: ConfidenceBreakdown;
  primaryPattern?: PatternId | null;
  walkForward?: WalkForwardStats | null;
  fundamentals?: LiveFundamentalsSnapshot | null;
}

export type BacktestHorizonDays = 21 | 63 | 126 | 252 | 1260 | 2520;

export type BacktestUniverseMode = 'portfolio_plus_flagship' | 'flagship' | 'portfolio_only';

export type BacktestSamplingFrequency = 'monthly' | 'biweekly' | 'weekly';

export type BacktestOutcomeStatus =
  | 'TARGET_HIT'
  | 'STOP_HIT'
  | 'HORIZON_EXPIRED'
  | 'BOTH_SAME_BAR'
  | 'PENDING'
  | 'DATA_UNAVAILABLE';

export type BacktestFirstHit = 'TARGET' | 'STOP' | 'NONE' | 'PENDING';

export type BacktestSplitSegment = 'TRAIN' | 'OOS';

export type StockEdgeTier = 'Strong' | 'Moderate' | 'Neutral' | 'Weak';

export interface LiveCalibrationContext {
  calibratedWinProb3M: number | null;
  calibratedWinProb1Y: number | null;
  rawConfidenceBucket: string;
  oosSampleCount: number;
  stockEdgeTier: StockEdgeTier | null;
  stockWinRate3M: number | null;
  stockExcessReturn3M: number | null;
  stockProfitFactor: number | null;
  exitAvoidanceRate3M: number | null;
  sampleHorizonLabel: string;
  methodologyTag: 'TECH_RECONSTRUCTED_V1';
  sourceRunLabel: string;
}

export interface BacktestSignalOutcome {
  horizonDays: BacktestHorizonDays;
  horizonLabel: '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';
  status: BacktestOutcomeStatus;
  firstHit: BacktestFirstHit;
  exitDate: string | null;
  exitPrice: number | null;
  daysHeld: number | null;
  grossPriceReturnPct: number | null;
  netPriceReturnPct: number | null;
  grossTotalReturnPct: number | null;
  netTotalReturnPct: number | null;
  niftyReturnPct: number | null;
  excessReturnPct: number | null;
  maxDrawdownPct: number | null;
  maxFavorableExcursionPct: number | null;
  won: boolean | null;
  exitAvoidedLoss: boolean | null;
}

export interface BacktestSignalRecord {
  id: string;
  symbol: string;
  ticker: string;
  companyName: string;
  sector: string;
  signalDate: string;
  entryDate: string;
  entryPrice: number;
  signalClosePrice: number;
  verdict: AiRatingVerdict;
  conviction: 'High' | 'Medium' | 'Low';
  rawConfidence: number;
  calibratedProb3M: number | null;
  targetPrice: number;
  stopLossPrice: number;
  rsi14: number | null;
  betaEst: number;
  split: BacktestSplitSegment;
  outcomes: Record<string, BacktestSignalOutcome>;
}

export interface BacktestStockScorecard {
  symbol: string;
  ticker: string;
  companyName: string;
  sector: string;
  historyYears: number;
  totalSignals: number;
  buySignals: number;
  holdSignals: number;
  exitSignals: number;
  winRate1M: number | null;
  winRate3M: number | null;
  winRate6M: number | null;
  winRate1Y: number | null;
  avgNetReturn3M: number | null;
  avgTotalReturn3M: number | null;
  avgExcessReturn3M: number | null;
  avgNetReturn1Y: number | null;
  avgTotalReturn1Y: number | null;
  avgExcessReturn1Y: number | null;
  targetHitRate3M: number | null;
  stopHitRate3M: number | null;
  exitAvoidanceRate3M: number | null;
  profitFactor3M: number | null;
  maxDrawdown3M: number | null;
  edgeTier: StockEdgeTier;
  inUserPortfolio: boolean;
}

export interface BacktestCalibrationBucket {
  bucketLabel: string;
  minScore: number;
  maxScore: number;
  trainCount: number;
  trainPredictedAvgPct: number | null;
  trainActualWinRatePct: number | null;
  oosCount: number;
  oosPredictedAvgPct: number | null;
  oosActualWinRatePct: number | null;
  oosCalibratedProbPct: number | null;
  oosCiLowPct: number | null;
  oosCiHighPct: number | null;
  avgExcessReturnPct: number | null;
}

export interface BacktestCalibrationReport {
  horizonDays: BacktestHorizonDays;
  horizonLabel: '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';
  trainCutoffDate: string;
  trainSampleCount: number;
  oosSampleCount: number;
  rawBrierScoreOos: number | null;
  calibratedBrierScoreOos: number | null;
  rawLogLossOos: number | null;
  calibratedLogLossOos: number | null;
  rawEceOosPct: number | null;
  calibratedEceOosPct: number | null;
  exitSignalCountOos: number;
  exitAvoidedNegativeRateOosPct: number | null;
  exitUnderperformedNiftyRateOosPct: number | null;
  buckets: BacktestCalibrationBucket[];
}

export interface BacktestHorizonSummary {
  horizonDays: BacktestHorizonDays;
  horizonLabel: '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';
  resolvedBuyCount: number;
  pendingBuyCount: number;
  resolvedExitCount: number;
  buyWinRatePct: number | null;
  buyBeatNiftyRatePct: number | null;
  avgNetPriceReturnPct: number | null;
  avgNetTotalReturnPct: number | null;
  medianNetReturnPct: number | null;
  avgNiftyReturnPct: number | null;
  avgExcessReturnPct: number | null;
  targetHitRatePct: number | null;
  stopHitRatePct: number | null;
  sameBarStopFirstCount: number;
  avgMaxDrawdownPct: number | null;
  profitFactor: number | null;
  exitAvoidanceRatePct: number | null;
}

export interface BacktestEquityPoint {
  date: string;
  portfolioIndexed: number;
  niftyIndexed: number;
  drawdownPct: number;
  niftyDrawdownPct: number;
  activePositions: number;
}

export interface BacktestPortfolioMetrics {
  startDate: string;
  endDate: string;
  yearsSimulated: number;
  portfolioCagrPct: number;
  niftyCagrPct: number;
  excessCagrPct: number;
  portfolioTotalReturnPct: number;
  niftyTotalReturnPct: number;
  maxDrawdownPct: number;
  niftyMaxDrawdownPct: number;
  annualizedVolatilityPct: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  profitFactor: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
  totalClosedTrades: number;
  annualTurnoverPct: number;
}

export interface BacktestDataQualityItem {
  symbol: string;
  ticker: string;
  status: 'OK' | 'PARTIAL_HISTORY' | 'UNAVAILABLE';
  barsCount: number;
  startDate: string | null;
  endDate: string | null;
  historyYears: number;
  dividendEvents: number;
  splitEvents: number;
  missingGapWarnings: number;
  note: string;
}

export interface BacktestRunRequest {
  universeMode?: BacktestUniverseMode;
  portfolioSymbols?: string[];
  customSymbols?: string[];
  costBps?: number;
  samplingFrequency?: BacktestSamplingFrequency;
  maxConcurrentPositions?: number;
}

export interface BacktestRunResult {
  runId: string;
  label: string;
  methodology: 'TECH_RECONSTRUCTED_V1';
  methodologyNote: string;
  universeMode: BacktestUniverseMode;
  samplingFrequency: BacktestSamplingFrequency;
  costBps: number;
  trainCutoffDate: string;
  symbolsRequested: string[];
  symbolsEvaluated: string[];
  portfolioMetrics: BacktestPortfolioMetrics;
  horizonSummaries: BacktestHorizonSummary[];
  calibrationByHorizon: Record<string, BacktestCalibrationReport>;
  stockScorecards: BacktestStockScorecard[];
  equityCurve: BacktestEquityPoint[];
  signals: BacktestSignalRecord[];
  totalSignalsGenerated: number;
  dataQuality: BacktestDataQualityItem[];
  computedAt: string;
}

export interface BacktestRunFirestoreRecord {
  id: string;
  userId: string;
  label: string;
  methodology: 'TECH_RECONSTRUCTED_V1';
  universeMode: BacktestUniverseMode;
  samplingFrequency: BacktestSamplingFrequency;
  costBps: number;
  trainCutoffDate: string;
  symbols: string[];
  portfolioMetrics: BacktestPortfolioMetrics;
  horizonSummaries: BacktestHorizonSummary[];
  calibration3M: BacktestCalibrationReport;
  calibration1Y: BacktestCalibrationReport;
  stockScorecards: BacktestStockScorecard[];
  equityCurve: BacktestEquityPoint[];
  recentSignals: BacktestSignalRecord[];
  totalSignalsGenerated: number;
  dataQuality: BacktestDataQualityItem[];
  computedAt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}



