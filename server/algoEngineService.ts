import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { INDIAN_STOCK_UNIVERSE } from './indianMarketCatalog.ts';
import {
  getQuotes,
  getRawOhlcvCandles,
  searchIndianStocks,
  type RawOhlcvBar,
} from './marketService.ts';
import type {
  AlgoBacktestResult,
  AlgoBacktestTrade,
  AlgoComparator,
  AlgoCompileResponse,
  AlgoEquityCurvePoint,
  AlgoExitReason,
  AlgoIndicator,
  AlgoLogicOperator,
  AlgoOrderDraft,
  AlgoOrderRecord,
  AlgoPaperEvaluateResponse,
  AlgoPaperStrategyTelemetry,
  AlgoRuleCondition,
  AlgoStrategyDraft,
  AlgoStrategyRecord,
  AlgoStrategyStatus,
  AlgoTimeframe,
  PaperPositionSnapshot,
} from '../src/types/market.ts';

const VALID_INDICATORS: AlgoIndicator[] = [
  'RSI_14',
  'PRICE_VS_SMA50',
  'PRICE_VS_SMA200',
  'EMA20_VS_SMA50',
  'VOLUME_RATIO',
  'DAY_CHANGE_PCT',
  'SMA50_SLOPE_PCT',
];

const VALID_COMPARATORS: AlgoComparator[] = [
  'LT',
  'LTE',
  'GT',
  'GTE',
  'CROSS_ABOVE',
  'CROSS_BELOW',
];

const VALID_TIMEFRAMES: AlgoTimeframe[] = ['1d', '5d', '1mo', '6mo', '1y'];

const DEFAULT_BLUECHIPS = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS'];

const ALGO_QUOTA_NOTICE =
  'Gemini API free-tier quota was reached. Compiled strategy rules deterministically from your prompt parameters.';

function clampNum(v: number, min: number, max: number, decimals = 2): number {
  if (!Number.isFinite(v)) return min;
  const clamped = Math.max(min, Math.min(max, v));
  return Number(clamped.toFixed(decimals));
}

function isQuotaOrNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /429|RESOURCE_EXHAUSTED|quota|rate[-_\s]?limit|fetch failed/i.test(msg);
}

function getIstDateString(tsMs = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(tsMs));
}

function formatIstLabel(tsSec: number, range: AlgoTimeframe): string {
  const d = new Date(tsSec * 1000);
  if (range === '1d' || range === '5d') {
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: range === '1y' ? '2-digit' : undefined,
  });
}

export function formatRuleLabel(
  indicator: AlgoIndicator,
  comparator: AlgoComparator,
  threshold: number
): string {
  const compText: Record<AlgoComparator, string> = {
    LT: '<',
    LTE: '<=',
    GT: '>',
    GTE: '>=',
    CROSS_ABOVE: 'crosses above',
    CROSS_BELOW: 'crosses below',
  };

  switch (indicator) {
    case 'RSI_14':
      return `RSI(14) ${compText[comparator]} ${threshold}`;
    case 'PRICE_VS_SMA50':
      return threshold === 0
        ? `Price ${compText[comparator]} SMA(50)`
        : `Price vs SMA(50) ${compText[comparator]} ${threshold}%`;
    case 'PRICE_VS_SMA200':
      return threshold === 0
        ? `Price ${compText[comparator]} SMA(200)`
        : `Price vs SMA(200) ${compText[comparator]} ${threshold}%`;
    case 'EMA20_VS_SMA50':
      return threshold === 0
        ? `EMA(20) ${compText[comparator]} SMA(50)`
        : `EMA(20) vs SMA(50) ${compText[comparator]} ${threshold}%`;
    case 'VOLUME_RATIO':
      return `Volume ${compText[comparator]} ${threshold}x 20D avg`;
    case 'DAY_CHANGE_PCT':
      return `Bar Change ${compText[comparator]} ${threshold}%`;
    case 'SMA50_SLOPE_PCT':
      return `SMA(50) 5-bar Slope ${compText[comparator]} ${threshold}%`;
    default:
      return `${indicator} ${compText[comparator]} ${threshold}`;
  }
}

async function resolvePromptSymbols(
  rawSymbols: string[],
  fullPrompt: string
): Promise<string[]> {
  const resolved = new Set<string>();

  const tryMatchCatalog = (token: string): string | null => {
    const clean = token.trim().toUpperCase().replace(/[^A-Z0-9.&-]/g, '');
    if (!clean) return null;
    const bare = clean.replace(/\.(NS|BO)$/, '');
    const hit = INDIAN_STOCK_UNIVERSE.find(
      (s) =>
        s.symbol.toUpperCase() === clean ||
        s.ticker.toUpperCase() === bare ||
        s.aliases?.some((a) => a.toUpperCase() === bare || a.toUpperCase() === clean)
    );
    if (hit) return hit.symbol;
    if (clean.endsWith('.NS') || clean.endsWith('.BO')) return clean;
    return null;
  };

  for (const sym of rawSymbols) {
    const matched = tryMatchCatalog(sym);
    if (matched) {
      resolved.add(matched);
      continue;
    }
    const found = await searchIndianStocks(sym).catch(() => []);
    if (found[0]) {
      resolved.add(found[0].symbol);
    }
  }

  // Scan full prompt text for any Indian catalog ticker/name mentioned directly
  if (resolved.size === 0) {
    const upperPrompt = fullPrompt.toUpperCase();
    for (const stock of INDIAN_STOCK_UNIVERSE) {
      const tickerRegex = new RegExp(`\\b${stock.ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (
        tickerRegex.test(upperPrompt) ||
        upperPrompt.includes(stock.name.toUpperCase()) ||
        stock.aliases?.some((a) => upperPrompt.includes(a.toUpperCase()))
      ) {
        resolved.add(stock.symbol);
        if (resolved.size >= 6) break;
      }
    }
  }

  if (resolved.size === 0) {
    for (const sym of DEFAULT_BLUECHIPS) {
      resolved.add(sym);
    }
  }

  return Array.from(resolved).slice(0, 10);
}

function normalizeConditions(
  raw: Array<Partial<AlgoRuleCondition>> | undefined,
  prefix: string,
  fallbackIfEmpty: AlgoRuleCondition[]
): AlgoRuleCondition[] {
  const list = Array.isArray(raw) ? raw : [];
  const cleaned: AlgoRuleCondition[] = [];

  list.slice(0, 6).forEach((item, idx) => {
    const indicator = VALID_INDICATORS.includes(item.indicator as AlgoIndicator)
      ? (item.indicator as AlgoIndicator)
      : 'RSI_14';
    const comparator = VALID_COMPARATORS.includes(item.comparator as AlgoComparator)
      ? (item.comparator as AlgoComparator)
      : 'LT';
    const threshold = clampNum(Number(item.threshold ?? 0), -1000, 1000, 2);
    cleaned.push({
      id: `${prefix}_${idx + 1}`,
      indicator,
      comparator,
      threshold,
      label: formatRuleLabel(indicator, comparator, threshold),
    });
  });

  if (cleaned.length === 0) {
    return fallbackIfEmpty;
  }
  return cleaned;
}

function normalizeStrategyDraft(
  draft: Partial<AlgoStrategyDraft>,
  prompt: string,
  resolvedSymbols: string[]
): AlgoStrategyDraft {
  const timeframe: AlgoTimeframe = VALID_TIMEFRAMES.includes(draft.timeframe as AlgoTimeframe)
    ? (draft.timeframe as AlgoTimeframe)
    : '6mo';
  const logicOperator: AlgoLogicOperator = draft.logicOperator === 'OR' ? 'OR' : 'AND';

  const defaultEntry: AlgoRuleCondition[] = [
    {
      id: 'entry_1',
      indicator: 'RSI_14',
      comparator: 'LT',
      threshold: 40,
      label: formatRuleLabel('RSI_14', 'LT', 40),
    },
  ];
  const defaultExit: AlgoRuleCondition[] = [
    {
      id: 'exit_1',
      indicator: 'RSI_14',
      comparator: 'GT',
      threshold: 70,
      label: formatRuleLabel('RSI_14', 'GT', 70),
    },
  ];

  const stopLossPct = clampNum(Number(draft.stopLossPct ?? 4), 0.5, 50, 2);
  const takeProfitPct = clampNum(
    Number(draft.takeProfitPct ?? Math.max(stopLossPct * 2, 8)),
    0.5,
    200,
    2
  );

  return {
    name: String(draft.name || 'Custom NSE Strategy').trim().slice(0, 100) || 'Custom NSE Strategy',
    prompt: prompt.trim().slice(0, 500),
    summary:
      String(draft.summary || 'Systematic Indian equity strategy with automated stop-loss and daily loss circuit-breaker.')
        .trim()
        .slice(0, 300),
    symbols: resolvedSymbols.slice(0, 10),
    timeframe,
    logicOperator,
    entryConditions: normalizeConditions(draft.entryConditions, 'entry', defaultEntry),
    exitConditions: normalizeConditions(draft.exitConditions, 'exit', defaultExit),
    virtualCapital: clampNum(Number(draft.virtualCapital ?? 1000000), 10000, 100000000, 0),
    allocationPercent: clampNum(Number(draft.allocationPercent ?? 25), 5, 100, 1),
    stopLossPct,
    takeProfitPct,
    trailingStopPct: clampNum(Number(draft.trailingStopPct ?? 0), 0, 50, 2),
    maxOpenPositions: Math.round(clampNum(Number(draft.maxOpenPositions ?? 4), 1, 20, 0)),
    dailyLossCapPct: clampNum(Number(draft.dailyLossCapPct ?? 2.5), 0.5, 25, 2),
    slippageBps: clampNum(Number(draft.slippageBps ?? 10), 0, 100, 1),
  };
}

async function parsePromptDeterministic(prompt: string): Promise<AlgoStrategyDraft> {
  const lower = prompt.toLowerCase();
  const entryConditions: AlgoRuleCondition[] = [];
  const exitConditions: AlgoRuleCondition[] = [];

  // Extract RSI thresholds
  const rsiBuyMatch = lower.match(/rsi(?:\s*\(\s*14\s*\))?\s*(?:drops\s+below|below|under|<|<=)\s*(\d+(?:\.\d+)?)/i);
  const rsiSellMatch = lower.match(/(?:sell|exit).*?rsi(?:\s*\(\s*14\s*\))?\s*(?:above|over|>|>=)\s*(\d+(?:\.\d+)?)/i);

  if (rsiBuyMatch) {
    const val = clampNum(Number(rsiBuyMatch[1]), 10, 85, 1);
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: 'RSI_14',
      comparator: lower.includes('cross') ? 'CROSS_BELOW' : 'LT',
      threshold: val,
      label: formatRuleLabel('RSI_14', lower.includes('cross') ? 'CROSS_BELOW' : 'LT', val),
    });
  } else if (lower.includes('oversold') || lower.includes('mean reversion')) {
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: 'RSI_14',
      comparator: 'LT',
      threshold: 38,
      label: formatRuleLabel('RSI_14', 'LT', 38),
    });
  } else if (lower.includes('momentum')) {
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: 'RSI_14',
      comparator: 'GT',
      threshold: 55,
      label: formatRuleLabel('RSI_14', 'GT', 55),
    });
  }

  if (rsiSellMatch) {
    const val = clampNum(Number(rsiSellMatch[1]), 20, 95, 1);
    exitConditions.push({
      id: `exit_${exitConditions.length + 1}`,
      indicator: 'RSI_14',
      comparator: 'GT',
      threshold: val,
      label: formatRuleLabel('RSI_14', 'GT', val),
    });
  } else if (lower.includes('overbought')) {
    exitConditions.push({
      id: `exit_${exitConditions.length + 1}`,
      indicator: 'RSI_14',
      comparator: 'GT',
      threshold: 72,
      label: formatRuleLabel('RSI_14', 'GT', 72),
    });
  }

  // Moving averages & crossovers
  if (/golden\s*cross|ema\s*20.*sma\s*50|20.*ema.*50.*sma/i.test(prompt)) {
    const comp: AlgoComparator = lower.includes('cross') ? 'CROSS_ABOVE' : 'GT';
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: 'EMA20_VS_SMA50',
      comparator: comp,
      threshold: 0,
      label: formatRuleLabel('EMA20_VS_SMA50', comp, 0),
    });
  }
  if (/below\s*(?:the\s*)?200[\s-]*dma|below\s*sma\s*200/i.test(prompt)) {
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: 'PRICE_VS_SMA200',
      comparator: 'LT',
      threshold: 0,
      label: formatRuleLabel('PRICE_VS_SMA200', 'LT', 0),
    });
  } else if (/200[\s-]*dma|sma\s*200/i.test(prompt)) {
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: 'PRICE_VS_SMA200',
      comparator: 'GT',
      threshold: 0,
      label: formatRuleLabel('PRICE_VS_SMA200', 'GT', 0),
    });
  }
  if (/50[\s-]*dma|sma\s*50/i.test(prompt) && !/golden\s*cross|ema/i.test(prompt)) {
    const comp: AlgoComparator = lower.includes('below') ? 'LT' : 'GT';
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: 'PRICE_VS_SMA50',
      comparator: comp,
      threshold: 0,
      label: formatRuleLabel('PRICE_VS_SMA50', comp, 0),
    });
  }

  // Volume spike
  const volMatch = lower.match(/(\d+(?:\.\d+)?)\s*x\s*(?:avg|average)?\s*vol/i);
  if (volMatch || /volume\s*(?:spike|surge|shock|breakout)/i.test(prompt)) {
    const mult = volMatch ? clampNum(Number(volMatch[1]), 1.1, 10, 1) : 1.5;
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: 'VOLUME_RATIO',
      comparator: 'GT',
      threshold: mult,
      label: formatRuleLabel('VOLUME_RATIO', 'GT', mult),
    });
  }

  // Dip buy
  const dipMatch = lower.match(/(?:dip|drop|fall|down)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%/i);
  if (dipMatch) {
    const pct = -Math.abs(clampNum(Number(dipMatch[1]), 0.5, 15, 1));
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: 'DAY_CHANGE_PCT',
      comparator: 'LTE',
      threshold: pct,
      label: formatRuleLabel('DAY_CHANGE_PCT', 'LTE', pct),
    });
  }

  if (entryConditions.length === 0) {
    entryConditions.push({
      id: 'entry_1',
      indicator: 'PRICE_VS_SMA50',
      comparator: 'GT',
      threshold: 0,
      label: formatRuleLabel('PRICE_VS_SMA50', 'GT', 0),
    });
    entryConditions.push({
      id: 'entry_2',
      indicator: 'RSI_14',
      comparator: 'LT',
      threshold: 55,
      label: formatRuleLabel('RSI_14', 'LT', 55),
    });
  }

  if (exitConditions.length === 0) {
    exitConditions.push({
      id: 'exit_1',
      indicator: 'RSI_14',
      comparator: 'GT',
      threshold: 72,
      label: formatRuleLabel('RSI_14', 'GT', 72),
    });
  }

  // Risk guardrails extraction
  const slMatch = lower.match(/(?:stop[\s-]*loss|sl)\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const tpMatch = lower.match(/(?:target|take[\s-]*profit|tp)\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const trailMatch = lower.match(/trailing\s*(?:stop|sl)?\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const dailyCapMatch = lower.match(/daily\s*(?:loss\s*)?(?:cap|limit)\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%/i);

  const stopLossPct = slMatch ? clampNum(Number(slMatch[1]), 0.5, 30, 2) : 4;
  const takeProfitPct = tpMatch ? clampNum(Number(tpMatch[1]), 1, 100, 2) : 10;
  const trailingStopPct = trailMatch ? clampNum(Number(trailMatch[1]), 0.5, 30, 2) : 0;
  const dailyLossCapPct = dailyCapMatch ? clampNum(Number(dailyCapMatch[1]), 0.5, 15, 2) : 2.5;

  let timeframe: AlgoTimeframe = '6mo';
  if (/\b1\s*y(?:ear|r)?\b/i.test(prompt)) timeframe = '1y';
  else if (/\b1\s*m(?:onth|o)?\b/i.test(prompt)) timeframe = '1mo';
  else if (/\b5\s*d(?:ay)?\b/i.test(prompt)) timeframe = '5d';
  else if (/\b1\s*d(?:ay)?\b|intraday/i.test(prompt)) timeframe = '1d';

  const resolvedSymbols = await resolvePromptSymbols([], prompt);
  const tickerList = resolvedSymbols.map((s) => s.replace(/\.(NS|BO)$/, '')).slice(0, 3).join(', ');
  const styleTag = lower.includes('momentum') || lower.includes('breakout')
    ? 'Momentum Breakout'
    : lower.includes('dip') || lower.includes('oversold') || lower.includes('reversion')
    ? 'Mean Reversion'
    : 'Systematic Swing';

  return normalizeStrategyDraft(
    {
      name: `${tickerList} ${styleTag}`.slice(0, 100),
      summary: `Entry on ${entryConditions.map((c) => c.label).join(` ${lower.includes(' or ') ? 'OR' : 'AND'} `)} with ${stopLossPct}% stop-loss, ${takeProfitPct}% target, and ${dailyLossCapPct}% daily loss cap.`,
      timeframe,
      logicOperator: lower.includes(' or ') ? 'OR' : 'AND',
      entryConditions,
      exitConditions,
      virtualCapital: 1000000,
      allocationPercent: Math.round(100 / Math.min(Math.max(resolvedSymbols.length, 2), 5)),
      stopLossPct,
      takeProfitPct,
      trailingStopPct,
      maxOpenPositions: Math.min(Math.max(resolvedSymbols.length, 2), 5),
      dailyLossCapPct,
      slippageBps: 10,
    },
    prompt,
    resolvedSymbols
  );
}

export async function compileAlgoStrategyFromPrompt(
  prompt: string
): Promise<AlgoCompileResponse> {
  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length < 6) {
    throw new Error('Describe your algorithmic trading rules in at least a few words.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallback = await parsePromptDeterministic(cleanPrompt);
    return {
      strategy: fallback,
      analysisSource: 'fallback_engine',
      quotaNotice: 'GEMINI_API_KEY is not configured; compiled rules using the deterministic rule parser.',
      generatedAt: new Date().toISOString(),
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const conditionSchema = {
    type: Type.OBJECT,
    properties: {
      indicator: {
        type: Type.STRING,
        description:
          'One of: RSI_14, PRICE_VS_SMA50, PRICE_VS_SMA200, EMA20_VS_SMA50, VOLUME_RATIO, DAY_CHANGE_PCT, SMA50_SLOPE_PCT',
      },
      comparator: {
        type: Type.STRING,
        description: 'One of: LT, LTE, GT, GTE, CROSS_ABOVE, CROSS_BELOW',
      },
      threshold: {
        type: Type.NUMBER,
        description:
          'Numeric threshold: e.g. 35 for RSI_14 < 35, 0 for PRICE_VS_SMA200 > 0, 1.5 for VOLUME_RATIO > 1.5, -2 for DAY_CHANGE_PCT <= -2',
      },
    },
    required: ['indicator', 'comparator', 'threshold'],
  };

  const schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Concise strategy name (under 60 chars)' },
      summary: { type: Type.STRING, description: 'Clear 1-sentence strategy thesis and risk summary' },
      symbols: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'NSE/BSE symbols (e.g. RELIANCE.NS, TCS.NS). Default 3-5 liquid Nifty stocks if none named.',
      },
      timeframe: {
        type: Type.STRING,
        description: 'Backtest lookback range: one of 1d, 5d, 1mo, 6mo, 1y',
      },
      logicOperator: {
        type: Type.STRING,
        description: 'AND if all entryConditions must trigger together, OR if any suffices.',
      },
      entryConditions: {
        type: Type.ARRAY,
        items: conditionSchema,
      },
      exitConditions: {
        type: Type.ARRAY,
        items: conditionSchema,
      },
      virtualCapital: { type: Type.NUMBER, description: 'Initial INR capital (e.g. 1000000)' },
      allocationPercent: { type: Type.NUMBER, description: 'Capital % per trade (5 to 100)' },
      stopLossPct: { type: Type.NUMBER, description: 'Hard stop-loss % (0.5 to 25)' },
      takeProfitPct: { type: Type.NUMBER, description: 'Target profit % (1 to 100)' },
      trailingStopPct: { type: Type.NUMBER, description: 'Optional trailing stop % (0 if disabled)' },
      maxOpenPositions: { type: Type.NUMBER, description: 'Max concurrent positions (1 to 10)' },
      dailyLossCapPct: { type: Type.NUMBER, description: 'Daily loss circuit-breaker % (0.5 to 15)' },
    },
    required: [
      'name',
      'summary',
      'symbols',
      'timeframe',
      'logicOperator',
      'entryConditions',
      'exitConditions',
      'virtualCapital',
      'allocationPercent',
      'stopLossPct',
      'takeProfitPct',
      'trailingStopPct',
      'maxOpenPositions',
      'dailyLossCapPct',
    ],
  };

  const systemInstruction = `You are Stoxify's quantitative algorithmic strategy compiler for Indian NSE/BSE equities.
Convert the user's natural-language trading prompt into structured technical rule predicates and risk guardrails.
Valid indicators:
- RSI_14 (0..100, e.g. < 35 oversold, > 70 overbought)
- PRICE_VS_SMA50 (% diff vs 50-DMA; threshold 0 means Price above/below SMA50)
- PRICE_VS_SMA200 (% diff vs 200-DMA; threshold 0 means Price above/below SMA200)
- EMA20_VS_SMA50 (% diff between EMA20 and SMA50; CROSS_ABOVE 0 means Golden Crossover)
- VOLUME_RATIO (bar volume / 20-bar avg volume; e.g. > 1.5 means 1.5x volume surge)
- DAY_CHANGE_PCT (single-bar % change; e.g. <= -2 means 2% dip)
- SMA50_SLOPE_PCT (5-bar slope % of SMA50)
Valid comparators: LT, LTE, GT, GTE, CROSS_ABOVE, CROSS_BELOW.
Keep stopLossPct (default 4), takeProfitPct (default 10), and dailyLossCapPct (default 2.5) prudent unless specified.`;

  const tryCompileModel = async (
    model: string,
    thinkingLevel: ThinkingLevel
  ): Promise<Partial<AlgoStrategyDraft>> => {
    const response = await ai.models.generateContent({
      model,
      contents: `Compile this Indian stock trading strategy:\n"${cleanPrompt}"`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel },
      },
    });
    const text = (response.text ?? '{}').trim();
    return JSON.parse(text) as Partial<AlgoStrategyDraft>;
  };

  try {
    let rawDraft: Partial<AlgoStrategyDraft>;
    try {
      rawDraft = await tryCompileModel('gemini-4-hydrogen', ThinkingLevel.LOW);
    } catch (primaryErr) {
      if (isQuotaOrNetworkError(primaryErr)) {
        rawDraft = await tryCompileModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL);
      } else {
        throw primaryErr;
      }
    }

    const resolvedSymbols = await resolvePromptSymbols(
      Array.isArray(rawDraft.symbols) ? rawDraft.symbols : [],
      cleanPrompt
    );
    const normalized = normalizeStrategyDraft(rawDraft, cleanPrompt, resolvedSymbols);

    return {
      strategy: normalized,
      analysisSource: 'gemini',
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (isQuotaOrNetworkError(err)) {
      const fallback = await parsePromptDeterministic(cleanPrompt);
      return {
        strategy: fallback,
        analysisSource: 'fallback_engine',
        quotaNotice: ALGO_QUOTA_NOTICE,
        generatedAt: new Date().toISOString(),
      };
    }
    const fallback = await parsePromptDeterministic(cleanPrompt);
    return {
      strategy: fallback,
      analysisSource: 'fallback_engine',
      quotaNotice: 'AI rule compiler fallback active; structured rules compiled deterministically.',
      generatedAt: new Date().toISOString(),
    };
  }
}

interface IndicatorSeries {
  bars: RawOhlcvBar[];
  sma50: (number | null)[];
  sma200: (number | null)[];
  ema20: (number | null)[];
  rsi14: (number | null)[];
  volumeRatio: (number | null)[];
  dayChangePct: (number | null)[];
  sma50SlopePct: (number | null)[];
}

function buildIndicatorSeries(bars: RawOhlcvBar[]): IndicatorSeries {
  const n = bars.length;
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const sma = (period: number): (number | null)[] => {
    const out: (number | null)[] = new Array(n).fill(null);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += closes[i];
      if (i >= period) sum -= closes[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  };

  const ema20: (number | null)[] = new Array(n).fill(null);
  const k = 2 / 21;
  let emaVal: number | null = null;
  for (let i = 0; i < n; i++) {
    if (i === 19) {
      let s = 0;
      for (let j = 0; j < 20; j++) s += closes[j];
      emaVal = s / 20;
      ema20[i] = emaVal;
    } else if (i > 19 && emaVal !== null) {
      emaVal = closes[i] * k + emaVal * (1 - k);
      ema20[i] = emaVal;
    }
  }

  const rsi14: (number | null)[] = new Array(n).fill(null);
  if (n > 14) {
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / 14;
    let avgLoss = losses / 14;
    rsi14[14] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = 15; i < n; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;
      rsi14[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  const sma50 = sma(50);
  const sma200 = sma(200);

  const volumeRatio: (number | null)[] = new Array(n).fill(null);
  let volSum = 0;
  for (let i = 0; i < n; i++) {
    volSum += volumes[i];
    if (i >= 20) volSum -= volumes[i - 20];
    if (i >= 20) {
      const avg20 = (volSum - volumes[i]) / 20;
      volumeRatio[i] = avg20 > 0 ? volumes[i] / avg20 : 1;
    } else {
      volumeRatio[i] = 1;
    }
  }

  const dayChangePct: (number | null)[] = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    dayChangePct[i] =
      closes[i - 1] > 0 ? ((closes[i] - closes[i - 1]) / closes[i - 1]) * 100 : 0;
  }

  const sma50SlopePct: (number | null)[] = new Array(n).fill(null);
  for (let i = 5; i < n; i++) {
    const cur = sma50[i];
    const prev = sma50[i - 5];
    if (cur !== null && prev !== null && prev > 0) {
      sma50SlopePct[i] = ((cur - prev) / prev) * 100;
    }
  }

  return {
    bars,
    sma50,
    sma200,
    ema20,
    rsi14,
    volumeRatio,
    dayChangePct,
    sma50SlopePct,
  };
}

function getMetricAtBar(series: IndicatorSeries, idx: number, indicator: AlgoIndicator): number | null {
  if (idx < 0 || idx >= series.bars.length) return null;
  const close = series.bars[idx].close;
  switch (indicator) {
    case 'RSI_14':
      return series.rsi14[idx];
    case 'PRICE_VS_SMA50': {
      const m = series.sma50[idx];
      return m && m > 0 ? ((close - m) / m) * 100 : null;
    }
    case 'PRICE_VS_SMA200': {
      const m = series.sma200[idx] ?? series.sma50[idx];
      return m && m > 0 ? ((close - m) / m) * 100 : null;
    }
    case 'EMA20_VS_SMA50': {
      const e = series.ema20[idx];
      const s = series.sma50[idx];
      return e !== null && s !== null && s > 0 ? ((e - s) / s) * 100 : null;
    }
    case 'VOLUME_RATIO':
      return series.volumeRatio[idx];
    case 'DAY_CHANGE_PCT':
      return series.dayChangePct[idx];
    case 'SMA50_SLOPE_PCT':
      return series.sma50SlopePct[idx];
    default:
      return null;
  }
}

function evaluateSingleCondition(
  series: IndicatorSeries,
  idx: number,
  cond: AlgoRuleCondition
): boolean {
  const curr = getMetricAtBar(series, idx, cond.indicator);
  if (curr === null) return false;
  const prev = idx > 0 ? getMetricAtBar(series, idx - 1, cond.indicator) : null;

  switch (cond.comparator) {
    case 'LT':
      return curr < cond.threshold;
    case 'LTE':
      return curr <= cond.threshold;
    case 'GT':
      return curr > cond.threshold;
    case 'GTE':
      return curr >= cond.threshold;
    case 'CROSS_ABOVE':
      return prev !== null && prev <= cond.threshold && curr > cond.threshold;
    case 'CROSS_BELOW':
      return prev !== null && prev >= cond.threshold && curr < cond.threshold;
    default:
      return false;
  }
}

function evaluateConditionGroup(
  series: IndicatorSeries,
  idx: number,
  conditions: AlgoRuleCondition[],
  op: AlgoLogicOperator
): boolean {
  if (conditions.length === 0) return false;
  if (op === 'OR') {
    return conditions.some((c) => evaluateSingleCondition(series, idx, c));
  }
  return conditions.every((c) => evaluateSingleCondition(series, idx, c));
}

function getWarmupParams(timeframe: AlgoTimeframe): {
  fetchRange: string;
  fetchInterval: string;
  windowSeconds: number;
} {
  switch (timeframe) {
    case '1d':
      return { fetchRange: '5d', fetchInterval: '5m', windowSeconds: 24 * 3600 };
    case '5d':
      return { fetchRange: '1mo', fetchInterval: '15m', windowSeconds: 5 * 24 * 3600 };
    case '1mo':
      return { fetchRange: '2y', fetchInterval: '1d', windowSeconds: 32 * 24 * 3600 };
    case '6mo':
      return { fetchRange: '2y', fetchInterval: '1d', windowSeconds: 185 * 24 * 3600 };
    case '1y':
    default:
      return { fetchRange: '2y', fetchInterval: '1d', windowSeconds: 368 * 24 * 3600 };
  }
}

export async function runHistoricalBacktest(
  rawStrategy: AlgoStrategyDraft
): Promise<AlgoBacktestResult> {
  const symbols = Array.from(
    new Set(
      (rawStrategy.symbols || [])
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0)
    )
  ).slice(0, 10);

  if (symbols.length === 0) {
    throw new Error('Select at least one valid NSE/BSE symbol to run a historical backtest.');
  }

  const strategy = normalizeStrategyDraft(rawStrategy, rawStrategy.prompt || rawStrategy.name, symbols);
  const { fetchRange, fetchInterval, windowSeconds } = getWarmupParams(strategy.timeframe);

  // Fetch target symbols + Nifty 50 benchmark in parallel
  const allFetchTargets = Array.from(new Set([...symbols, '^NSEI']));
  const rawSeriesEntries = await Promise.all(
    allFetchTargets.map(async (sym) => {
      const bars = await getRawOhlcvCandles(sym, fetchRange, fetchInterval);
      return { sym, bars };
    })
  );

  const seriesMap = new Map<string, IndicatorSeries>();
  const timestampIndexMap = new Map<string, Map<number, number>>();

  for (const entry of rawSeriesEntries) {
    if (entry.bars.length < 15) continue;
    const indSeries = buildIndicatorSeries(entry.bars);
    seriesMap.set(entry.sym, indSeries);
    const tsMap = new Map<number, number>();
    entry.bars.forEach((b, idx) => tsMap.set(b.timestamp, idx));
    timestampIndexMap.set(entry.sym, tsMap);
  }

  const validSymbols = symbols.filter((s) => seriesMap.has(s));
  if (validSymbols.length === 0) {
    throw new Error(
      `Unable to load historical OHLCV bars for ${symbols.join(', ')}. Verify valid NSE (.NS) or BSE (.BO) tickers.`
    );
  }

  // Build sorted timeline of simulation timestamps within the requested lookback window
  const allTimestampsSet = new Set<number>();
  let maxTs = 0;
  for (const sym of validSymbols) {
    const bars = seriesMap.get(sym)!.bars;
    for (const b of bars) {
      allTimestampsSet.add(b.timestamp);
      if (b.timestamp > maxTs) maxTs = b.timestamp;
    }
  }

  const windowStartTs = maxTs - windowSeconds;
  let timeline = Array.from(allTimestampsSet)
    .filter((ts) => ts >= windowStartTs)
    .sort((a, b) => a - b);

  // For intraday 1d, ensure at least last trading session bars (~50-75)
  if (strategy.timeframe === '1d' && timeline.length < 20) {
    const sortedAll = Array.from(allTimestampsSet).sort((a, b) => a - b);
    timeline = sortedAll.slice(-75);
  }

  if (timeline.length < 5) {
    throw new Error('Insufficient OHLCV bars in the requested timeframe to execute simulation.');
  }

  const niftySeries = seriesMap.get('^NSEI') ?? null;
  const niftyTsMap = timestampIndexMap.get('^NSEI') ?? null;
  let niftyFirstClose: number | null = null;
  let lastNiftyClose: number | null = null;

  let cash = strategy.virtualCapital;
  const slippageFrac = strategy.slippageBps / 10_000;
  const lastPriceBySymbol = new Map<string, number>();

  interface OpenPos {
    symbol: string;
    quantity: number;
    entryPrice: number;
    entryDate: string;
    entryTimelineIdx: number;
    highestPrice: number;
    stopLossPrice: number;
    targetPrice: number;
  }

  const openPositions = new Map<string, OpenPos>();
  const trades: AlgoBacktestTrade[] = [];
  const equityCurve: AlgoEquityCurvePoint[] = [];
  const guardrailEvents: Array<{ dateLabel: string; message: string }> = [];

  let currentDay = '';
  let dayStartEquity = strategy.virtualCapital;
  let haltedForDay = false;
  let guardrailHaltsTriggered = 0;
  let peakEquity = strategy.virtualCapital;
  let maxDrawdownPct = 0;

  const computeTotalEquity = () => {
    let holdingsVal = 0;
    for (const pos of openPositions.values()) {
      const p = lastPriceBySymbol.get(pos.symbol) ?? pos.entryPrice;
      holdingsVal += pos.quantity * p;
    }
    return cash + holdingsVal;
  };

  const closePosition = (
    pos: OpenPos,
    rawExitPrice: number,
    exitDate: string,
    exitBarIdx: number,
    exitReason: AlgoExitReason
  ) => {
    const execExitPrice = Number((rawExitPrice * (1 - slippageFrac)).toFixed(2));
    const exitProceeds = pos.quantity * execExitPrice;
    const entryCost = pos.quantity * pos.entryPrice;
    const netPnl = Number((exitProceeds - entryCost).toFixed(2));
    const grossPnl = Number(((rawExitPrice - pos.entryPrice) * pos.quantity).toFixed(2));
    const pnlPct = entryCost > 0 ? Number(((netPnl / entryCost) * 100).toFixed(2)) : 0;

    cash += exitProceeds;
    openPositions.delete(pos.symbol);

    trades.push({
      id: `bt_${trades.length + 1}_${pos.symbol}`,
      symbol: pos.symbol,
      ticker: pos.symbol.replace(/\.(NS|BO)$/, ''),
      entryDate: pos.entryDate,
      exitDate,
      barsHeld: Math.max(1, exitBarIdx - pos.entryTimelineIdx),
      quantity: pos.quantity,
      entryPrice: pos.entryPrice,
      exitPrice: execExitPrice,
      grossPnl,
      netPnl,
      pnlPct,
      exitReason,
    });
  };

  for (let tIdx = 0; tIdx < timeline.length; tIdx++) {
    const ts = timeline[tIdx];
    const barDateIst = getIstDateString(ts * 1000);
    const dateLabel = formatIstLabel(ts, strategy.timeframe);

    // Update latest prices across symbols present at timestamp ts
    for (const sym of validSymbols) {
      const sIdx = timestampIndexMap.get(sym)?.get(ts);
      if (sIdx !== undefined) {
        const bar = seriesMap.get(sym)!.bars[sIdx];
        lastPriceBySymbol.set(sym, bar.close);
      }
    }

    // Track daily start equity & reset daily circuit-breaker at new IST trading day
    if (barDateIst !== currentDay) {
      currentDay = barDateIst;
      dayStartEquity = computeTotalEquity();
      haltedForDay = false;
    }

    // 1. Evaluate exits on open positions (Stop-Loss, Trailing Stop, Take-Profit, Exit Signal)
    for (const pos of Array.from(openPositions.values())) {
      const sIdx = timestampIndexMap.get(pos.symbol)?.get(ts);
      if (sIdx === undefined) continue;
      const series = seriesMap.get(pos.symbol)!;
      const bar = series.bars[sIdx];

      const trailingStop =
        strategy.trailingStopPct > 0
          ? pos.highestPrice * (1 - strategy.trailingStopPct / 100)
          : 0;
      const effectiveStop = Math.max(pos.stopLossPrice, trailingStop);

      if (bar.low <= effectiveStop) {
        const fillPrice = Math.min(bar.open, effectiveStop);
        const reason: AlgoExitReason =
          trailingStop > pos.stopLossPrice ? 'TRAILING_STOP' : 'STOP_LOSS';
        closePosition(pos, fillPrice, dateLabel, tIdx, reason);
        continue;
      }

      if (bar.high >= pos.targetPrice) {
        const fillPrice = Math.max(bar.open, pos.targetPrice);
        closePosition(pos, fillPrice, dateLabel, tIdx, 'TARGET');
        continue;
      }

      if (bar.high > pos.highestPrice) {
        pos.highestPrice = bar.high;
      }

      if (evaluateConditionGroup(series, sIdx, strategy.exitConditions, 'OR')) {
        closePosition(pos, bar.close, dateLabel, tIdx, 'EXIT_SIGNAL');
      }
    }

    // 2. Check Daily Loss Cap Circuit-Breaker
    const midEquity = computeTotalEquity();
    const dayLossPct =
      dayStartEquity > 0 ? ((dayStartEquity - midEquity) / dayStartEquity) * 100 : 0;

    if (!haltedForDay && dayLossPct >= strategy.dailyLossCapPct) {
      haltedForDay = true;
      guardrailHaltsTriggered += 1;
      guardrailEvents.push({
        dateLabel,
        message: `Daily loss cap (-${strategy.dailyLossCapPct}%) triggered at -${dayLossPct.toFixed(
          2
        )}%; blocked new entries and flattened open risk.`,
      });

      // Flatten losing positions on circuit-breaker
      for (const pos of Array.from(openPositions.values())) {
        const p = lastPriceBySymbol.get(pos.symbol) ?? pos.entryPrice;
        closePosition(pos, p, dateLabel, tIdx, 'DAILY_LOSS_CAP');
      }
    }

    // 3. Evaluate entries if not halted and position slots remain
    if (!haltedForDay && openPositions.size < strategy.maxOpenPositions) {
      for (const sym of validSymbols) {
        if (openPositions.size >= strategy.maxOpenPositions) break;
        if (openPositions.has(sym)) continue;

        const sIdx = timestampIndexMap.get(sym)?.get(ts);
        if (sIdx === undefined) continue;
        const series = seriesMap.get(sym)!;
        const bar = series.bars[sIdx];

        const shouldEnter = evaluateConditionGroup(
          series,
          sIdx,
          strategy.entryConditions,
          strategy.logicOperator
        );
        if (!shouldEnter) continue;

        const currentEquity = computeTotalEquity();
        const targetBudget = Math.min(cash, (currentEquity * strategy.allocationPercent) / 100);
        const execEntryPrice = Number((bar.close * (1 + slippageFrac)).toFixed(2));
        const qty = Math.floor(targetBudget / execEntryPrice);

        if (qty >= 1 && qty * execEntryPrice <= cash) {
          cash -= qty * execEntryPrice;
          openPositions.set(sym, {
            symbol: sym,
            quantity: qty,
            entryPrice: execEntryPrice,
            entryDate: dateLabel,
            entryTimelineIdx: tIdx,
            highestPrice: bar.close,
            stopLossPrice: Number((execEntryPrice * (1 - strategy.stopLossPct / 100)).toFixed(2)),
            targetPrice: Number((execEntryPrice * (1 + strategy.takeProfitPct / 100)).toFixed(2)),
          });
        }
      }
    }

    // 4. Record Equity Curve & Nifty Benchmark point
    const endBarEquity = computeTotalEquity();
    if (endBarEquity > peakEquity) peakEquity = endBarEquity;
    const ddPct = peakEquity > 0 ? -((peakEquity - endBarEquity) / peakEquity) * 100 : 0;
    if (Math.abs(ddPct) > maxDrawdownPct) maxDrawdownPct = Math.abs(ddPct);

    if (niftySeries && niftyTsMap) {
      const nIdx = niftyTsMap.get(ts);
      if (nIdx !== undefined) {
        const nc = niftySeries.bars[nIdx].close;
        if (niftyFirstClose === null) niftyFirstClose = nc;
        lastNiftyClose = nc;
      }
    }

    const benchEquity =
      niftyFirstClose && lastNiftyClose
        ? strategy.virtualCapital * (lastNiftyClose / niftyFirstClose)
        : strategy.virtualCapital;

    equityCurve.push({
      dateLabel,
      equity: Number(endBarEquity.toFixed(0)),
      benchmarkEquity: Number(benchEquity.toFixed(0)),
      equityIndexed: Number(((endBarEquity / strategy.virtualCapital) * 100).toFixed(2)),
      niftyIndexed: Number(((benchEquity / strategy.virtualCapital) * 100).toFixed(2)),
      drawdownPct: Number(ddPct.toFixed(2)),
    });
  }

  // Close remaining open positions cleanly on final bar so trade ledger balances final equity
  const lastTs = timeline[timeline.length - 1];
  const lastDateLabel = formatIstLabel(lastTs, strategy.timeframe);
  for (const pos of Array.from(openPositions.values())) {
    const lastP = lastPriceBySymbol.get(pos.symbol) ?? pos.entryPrice;
    closePosition(pos, lastP, lastDateLabel, timeline.length - 1, 'END_OF_WINDOW');
  }

  const finalEquity = Number(cash.toFixed(2));
  const netPnl = Number((finalEquity - strategy.virtualCapital).toFixed(2));
  const totalReturnPct = Number(((netPnl / strategy.virtualCapital) * 100).toFixed(2));

  const lastPoint = equityCurve[equityCurve.length - 1];
  if (lastPoint) {
    lastPoint.equity = Number(finalEquity.toFixed(0));
    lastPoint.equityIndexed = Number(((finalEquity / strategy.virtualCapital) * 100).toFixed(2));
  }

  const niftyReturnPct =
    niftyFirstClose && lastNiftyClose
      ? Number((((lastNiftyClose - niftyFirstClose) / niftyFirstClose) * 100).toFixed(2))
      : 0;
  const alphaPct = Number((totalReturnPct - niftyReturnPct).toFixed(2));

  // Annualize CAGR & Sharpe based on elapsed years
  const elapsedDays = Math.max(1, (timeline[timeline.length - 1] - timeline[0]) / 86400);
  const years = Math.max(elapsedDays / 365.25, 1 / 252);
  const cagrPct =
    years >= 0.08 && finalEquity > 0
      ? Number(((Math.pow(finalEquity / strategy.virtualCapital, 1 / years) - 1) * 100).toFixed(2))
      : totalReturnPct;

  const barReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEq = equityCurve[i - 1].equity;
    if (prevEq > 0) {
      barReturns.push((equityCurve[i].equity - prevEq) / prevEq);
    }
  }
  const barsPerYear =
    strategy.timeframe === '1d'
      ? 252 * 75
      : strategy.timeframe === '5d'
      ? 252 * 25
      : 252;
  let sharpeRatio = 0;
  if (barReturns.length > 2) {
    const mean = barReturns.reduce((a, b) => a + b, 0) / barReturns.length;
    const variance =
      barReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (barReturns.length - 1);
    const std = Math.sqrt(variance);
    if (std > 0) {
      sharpeRatio = Number((((mean - 0.065 / barsPerYear) / std) * Math.sqrt(barsPerYear)).toFixed(2));
    }
  }

  const winningTrades = trades.filter((t) => t.netPnl > 0).length;
  const losingTrades = trades.filter((t) => t.netPnl <= 0).length;
  const totalTrades = trades.length;
  const winRatePct =
    totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

  const grossWins = trades.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
  const grossLossesAbs = Math.abs(
    trades.filter((t) => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0)
  );
  const profitFactor =
    grossLossesAbs > 0
      ? Number((grossWins / grossLossesAbs).toFixed(2))
      : grossWins > 0
      ? 9.99
      : 0;

  const avgHoldingBars =
    totalTrades > 0
      ? Number((trades.reduce((s, t) => s + t.barsHeld, 0) / totalTrades).toFixed(1))
      : 0;

  return {
    strategyName: strategy.name,
    timeframe: strategy.timeframe,
    symbolsTested: validSymbols,
    barCount: timeline.length,
    summary: {
      initialCapital: strategy.virtualCapital,
      finalEquity: Math.round(finalEquity),
      netPnl: Math.round(netPnl),
      totalReturnPct,
      niftyReturnPct,
      alphaPct,
      cagrPct,
      sharpeRatio,
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      winRatePct,
      profitFactor,
      totalTrades,
      winningTrades,
      losingTrades,
      guardrailHaltsTriggered,
      avgHoldingBars,
    },
    equityCurve,
    trades: trades.slice().reverse(),
    guardrailEvents,
    ranAt: new Date().toISOString(),
  };
}

interface ReconstructedPos {
  symbol: string;
  quantity: number;
  avgEntryPrice: number;
  enteredAtIso: string;
}

function reconstructStrategyBook(
  strategy: AlgoStrategyRecord,
  orders: AlgoOrderRecord[],
  todayDateIst: string
) {
  const stratOrders = orders
    .filter((o) => o.strategyId === strategy.id && o.status === 'FILLED')
    .sort((a, b) => (a.executedAtIso || '').localeCompare(b.executedAtIso || ''));

  let cash = strategy.virtualCapital;
  let realizedPnlTotal = 0;
  let todayRealizedPnl = 0;
  const positions = new Map<string, ReconstructedPos>();

  for (const ord of stratOrders) {
    const sym = ord.symbol.toUpperCase();
    if (ord.side === 'BUY') {
      cash -= ord.notionalValue;
      const prev = positions.get(sym);
      if (!prev) {
        positions.set(sym, {
          symbol: sym,
          quantity: ord.quantity,
          avgEntryPrice: ord.price,
          enteredAtIso: ord.executedAtIso,
        });
      } else {
        const newQty = prev.quantity + ord.quantity;
        const totalCost = prev.quantity * prev.avgEntryPrice + ord.notionalValue;
        positions.set(sym, {
          symbol: sym,
          quantity: newQty,
          avgEntryPrice: newQty > 0 ? Number((totalCost / newQty).toFixed(2)) : ord.price,
          enteredAtIso: prev.enteredAtIso,
        });
      }
    } else if (ord.side === 'SELL') {
      cash += ord.notionalValue;
      realizedPnlTotal += ord.realizedPnl;
      if (ord.tradingDate === todayDateIst) {
        todayRealizedPnl += ord.realizedPnl;
      }
      const prev = positions.get(sym);
      if (prev) {
        const rem = prev.quantity - ord.quantity;
        if (rem <= 0) positions.delete(sym);
        else positions.set(sym, { ...prev, quantity: rem });
      }
    }
  }

  return {
    cash: Number(cash.toFixed(2)),
    realizedPnlTotal: Number(realizedPnlTotal.toFixed(2)),
    todayRealizedPnl: Number(todayRealizedPnl.toFixed(2)),
    positions,
  };
}

export async function evaluateLivePaperStrategies(
  strategies: AlgoStrategyRecord[],
  existingOrders: AlgoOrderRecord[]
): Promise<AlgoPaperEvaluateResponse> {
  const todayIst = getIstDateString();
  const nowIso = new Date().toISOString();

  // Gather all symbols across strategies + existing open positions
  const allSymbolsSet = new Set<string>();
  for (const st of strategies) {
    for (const s of st.symbols) allSymbolsSet.add(s.toUpperCase());
  }
  for (const o of existingOrders) {
    if (o.symbol) allSymbolsSet.add(o.symbol.toUpperCase());
  }

  const allSymbols = Array.from(allSymbolsSet);
  const quotes = allSymbols.length > 0 ? await getQuotes(allSymbols) : {};

  // Load 1y daily bars (for SMA50/SMA200/EMA20/RSI14) only for symbols in ACTIVE strategies
  const activeSymbols = Array.from(
    new Set(
      strategies
        .filter((s) => s.status === 'ACTIVE')
        .flatMap((s) => s.symbols.map((sym) => sym.toUpperCase()))
    )
  );

  const indicatorBySymbol = new Map<string, IndicatorSeries>();
  await Promise.all(
    activeSymbols.map(async (sym) => {
      const bars = await getRawOhlcvCandles(sym, '1y', '1d');
      if (bars.length >= 20) {
        indicatorBySymbol.set(sym, buildIndicatorSeries(bars));
      }
    })
  );

  const newOrders: AlgoOrderDraft[] = [];
  const strategyStatusUpdates: Array<{
    strategyId: string;
    status: AlgoStrategyStatus;
    reason: string;
  }> = [];
  const openPositions: PaperPositionSnapshot[] = [];
  const strategyTelemetry: AlgoPaperStrategyTelemetry[] = [];

  for (const strategy of strategies) {
    const book = reconstructStrategyBook(strategy, existingOrders, todayIst);
    let investedCapital = 0;
    let todayUnrealizedPnl = 0;

    // 1. Evaluate open positions for mark-to-market & exit triggers
    const openPosList = Array.from(book.positions.values());
    for (const pos of openPosList) {
      const liveQuote = quotes[pos.symbol];
      const livePrice = liveQuote?.price ?? pos.avgEntryPrice;
      const investedValue = pos.quantity * pos.avgEntryPrice;
      const marketValue = pos.quantity * livePrice;
      const unrealizedPnl = Number((marketValue - investedValue).toFixed(2));
      const unrealizedPnlPct =
        investedValue > 0 ? Number(((unrealizedPnl / investedValue) * 100).toFixed(2)) : 0;

      const stopLossPrice = Number((pos.avgEntryPrice * (1 - strategy.stopLossPct / 100)).toFixed(2));
      const targetPrice = Number((pos.avgEntryPrice * (1 + strategy.takeProfitPct / 100)).toFixed(2));

      let closedThisTick = false;
      if (strategy.status === 'ACTIVE') {
        const indSeries = indicatorBySymbol.get(pos.symbol);
        const exitSignalHit =
          indSeries &&
          evaluateConditionGroup(
            indSeries,
            indSeries.bars.length - 1,
            strategy.exitConditions,
            'OR'
          );

        let sellReason: string | null = null;
        if (livePrice <= stopLossPrice) {
          sellReason = `Stop-loss hit at ₹${livePrice} (SL ₹${stopLossPrice})`;
        } else if (livePrice >= targetPrice) {
          sellReason = `Target profit reached at ₹${livePrice} (Target ₹${targetPrice})`;
        } else if (exitSignalHit) {
          sellReason = `Exit technical condition matched at ₹${livePrice}`;
        }

        if (sellReason) {
          closedThisTick = true;
          const execSellPrice = Number(
            (livePrice * (1 - strategy.slippageBps / 10_000)).toFixed(2)
          );
          const proceeds = Number((pos.quantity * execSellPrice).toFixed(2));
          const realized = Number((proceeds - pos.quantity * pos.avgEntryPrice).toFixed(2));

          book.cash += proceeds;
          book.realizedPnlTotal += realized;
          book.todayRealizedPnl += realized;

          newOrders.push({
            strategyId: strategy.id,
            strategyName: strategy.name,
            symbol: pos.symbol,
            side: 'SELL',
            status: 'FILLED',
            quantity: pos.quantity,
            price: execSellPrice,
            notionalValue: proceeds,
            realizedPnl: realized,
            triggerReason: sellReason,
            executedAtIso: nowIso,
            tradingDate: todayIst,
          });
        }
      }

      if (!closedThisTick) {
        investedCapital += investedValue;
        todayUnrealizedPnl += unrealizedPnl;
        openPositions.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: pos.symbol,
          ticker: pos.symbol.replace(/\.(NS|BO)$/, ''),
          quantity: pos.quantity,
          avgEntryPrice: pos.avgEntryPrice,
          livePrice,
          investedValue: Number(investedValue.toFixed(2)),
          marketValue: Number(marketValue.toFixed(2)),
          unrealizedPnl,
          unrealizedPnlPct,
          stopLossPrice,
          targetPrice,
          enteredAtIso: pos.enteredAtIso,
        });
      }
    }

    // 2. Enforce Daily Loss Cap Circuit-Breaker before evaluating new entries
    const todayTotalPnl = Number((book.todayRealizedPnl + todayUnrealizedPnl).toFixed(2));
    const todayLossPct =
      todayTotalPnl < 0 && strategy.virtualCapital > 0
        ? Number(((Math.abs(todayTotalPnl) / strategy.virtualCapital) * 100).toFixed(2))
        : 0;
    const dailyCapBreached = todayLossPct >= strategy.dailyLossCapPct;

    let currentOpenCount = openPositions.filter((p) => p.strategyId === strategy.id).length;

    if (strategy.status === 'ACTIVE' && dailyCapBreached) {
      strategyStatusUpdates.push({
        strategyId: strategy.id,
        status: 'PAUSED_RISK_CAP',
        reason: `Daily loss -${todayLossPct.toFixed(2)}% reached circuit-breaker cap (-${strategy.dailyLossCapPct}%).`,
      });
      const fallbackSym = strategy.symbols[0] || 'RELIANCE.NS';
      const fallbackPrice = quotes[fallbackSym]?.price ?? 1000;
      newOrders.push({
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: fallbackSym,
        side: 'BUY',
        status: 'BLOCKED_RISK_CAP',
        quantity: 0,
        price: fallbackPrice,
        notionalValue: 0,
        realizedPnl: 0,
        triggerReason: `Daily loss cap (-${strategy.dailyLossCapPct}%) breached; bot auto-paused.`,
        executedAtIso: nowIso,
        tradingDate: todayIst,
      });
    } else if (strategy.status === 'ACTIVE') {
      // 3. Evaluate Entry Signals across target symbols
      for (const rawSym of strategy.symbols) {
        if (currentOpenCount >= strategy.maxOpenPositions) break;
        const sym = rawSym.toUpperCase();
        const alreadyOpen = openPositions.some(
          (p) => p.strategyId === strategy.id && p.symbol === sym
        );
        if (alreadyOpen) continue;

        const indSeries = indicatorBySymbol.get(sym);
        const liveQuote = quotes[sym];
        if (!indSeries || !liveQuote || liveQuote.price <= 0) continue;

        const shouldEnter = evaluateConditionGroup(
          indSeries,
          indSeries.bars.length - 1,
          strategy.entryConditions,
          strategy.logicOperator
        );
        if (!shouldEnter) continue;

        const totalEquity = book.cash + investedCapital + todayUnrealizedPnl;
        const budget = Math.min(book.cash, (totalEquity * strategy.allocationPercent) / 100);
        const execBuyPrice = Number(
          (liveQuote.price * (1 + strategy.slippageBps / 10_000)).toFixed(2)
        );
        const qty = Math.floor(budget / execBuyPrice);

        if (qty < 1) {
          newOrders.push({
            strategyId: strategy.id,
            strategyName: strategy.name,
            symbol: sym,
            side: 'BUY',
            status: 'BLOCKED_FUNDS',
            quantity: 0,
            price: execBuyPrice,
            notionalValue: 0,
            realizedPnl: 0,
            triggerReason: `Entry signal triggered at ₹${execBuyPrice}, insufficient virtual cash (₹${Math.round(book.cash)}).`,
            executedAtIso: nowIso,
            tradingDate: todayIst,
          });
          continue;
        }

        const notional = Number((qty * execBuyPrice).toFixed(2));
        book.cash -= notional;
        investedCapital += notional;
        currentOpenCount += 1;

        newOrders.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: sym,
          side: 'BUY',
          status: 'FILLED',
          quantity: qty,
          price: execBuyPrice,
          notionalValue: notional,
          realizedPnl: 0,
          triggerReason: `Entry rule matched: ${strategy.entryConditions.map((c) => c.label).join(` ${strategy.logicOperator} `)}`,
          executedAtIso: nowIso,
          tradingDate: todayIst,
        });

        openPositions.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: sym,
          ticker: sym.replace(/\.(NS|BO)$/, ''),
          quantity: qty,
          avgEntryPrice: execBuyPrice,
          livePrice: liveQuote.price,
          investedValue: notional,
          marketValue: Number((qty * liveQuote.price).toFixed(2)),
          unrealizedPnl: Number(((liveQuote.price - execBuyPrice) * qty).toFixed(2)),
          unrealizedPnlPct: Number((((liveQuote.price - execBuyPrice) / execBuyPrice) * 100).toFixed(2)),
          stopLossPrice: Number((execBuyPrice * (1 - strategy.stopLossPct / 100)).toFixed(2)),
          targetPrice: Number((execBuyPrice * (1 + strategy.takeProfitPct / 100)).toFixed(2)),
          enteredAtIso: nowIso,
        });
      }
    }

    strategyTelemetry.push({
      strategyId: strategy.id,
      strategyName: strategy.name,
      status: dailyCapBreached && strategy.status === 'ACTIVE' ? 'PAUSED_RISK_CAP' : strategy.status,
      virtualCapital: strategy.virtualCapital,
      availableCash: Number(book.cash.toFixed(2)),
      investedCapital: Number(investedCapital.toFixed(2)),
      realizedPnlTotal: Number(book.realizedPnlTotal.toFixed(2)),
      todayRealizedPnl: Number(book.todayRealizedPnl.toFixed(2)),
      todayUnrealizedPnl: Number(todayUnrealizedPnl.toFixed(2)),
      todayTotalPnl,
      todayLossPct,
      dailyLossCapPct: strategy.dailyLossCapPct,
      dailyCapBreached,
      openPositionsCount: currentOpenCount,
      maxOpenPositions: strategy.maxOpenPositions,
    });
  }

  return {
    newOrders,
    strategyStatusUpdates,
    openPositions,
    strategyTelemetry,
    evaluatedAt: nowIso,
  };
}
