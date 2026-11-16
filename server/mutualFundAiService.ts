import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { fetchMfSchemeSeries, searchMutualFunds } from './mutualFundService.ts';
import type {
  AnalyzedMutualFund,
  HorizonProjection,
  MfAiSwitchAdviceResponse,
  MutualFundImportParseResponse,
  MutualFundSummaryMetrics,
  ParsedMutualFundImportRow,
} from '../src/types/market.ts';

export interface MfImportFileInput {
  mimeType: string;
  data: string;
  fileName?: string;
}

interface GeminiMfRow {
  rawSchemeName: string;
  planType: string;
  optionType: string;
  units: number;
  avgNav: number;
  investedAmount: number;
  currentValue: number;
  latestNavShown: number;
  returnsPercent: number;
  purchaseDate: string;
  isSip: boolean;
  monthlySipAmount: number;
  folioNumber: string;
  confidence: string;
  notes: string;
}

interface GeminiMfParsePayload {
  sourceDetected?: string;
  portfolioTotals?: {
    totalInvested?: number;
    totalCurrent?: number;
  };
  holdings?: GeminiMfRow[];
  warnings?: string[];
}

const DIRECT_DEFAULT_BROKERS =
  /\b(groww|zerodha|coin|kuvera|paytm\s*money|indmoney|mfcentral|mf\s*central)\b/i;

const REGULAR_DEFAULT_BROKERS =
  /\b(nj\s*wealth|prudent|fundsindia|icici\s*direct|hdfc\s*sec|kotak\s*sec|sharekhan|motilal\s*oswal\s*wealth|distributor|arn-)\b/i;

function createGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isQuotaError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err || '');
  return /429|RESOURCE_EXHAUSTED|quota|rate[-_\s]?limit|retryDelay/i.test(msg);
}

const MF_IMPORT_PROMPT_RULES = `Rules:
1. Capture the complete scheme name as rawSchemeName (preserve "Direct", "Regular", "Growth", or "IDCW" if visible).
2. Plan detection rules (IMPORTANT):
   - Set planType to "Regular" ONLY if "Regular", "Reg", "Regular Plan", or a distributor/ARN is explicitly indicated, or if the screenshot is from a distributor platform (e.g., NJ Wealth, bank wealth portal).
   - Set planType to "Direct" if "Direct" or "Dir" is printed OR if the app is a Direct-plan platform (Groww, Zerodha Coin, Kuvera, Paytm Money, INDmoney, MFCentral Direct) and "Regular" is not printed.
   - Otherwise set planType to "Unknown".
3. Set optionType to "IDCW" if Dividend/IDCW/Payout/Reinvestment is mentioned, otherwise "Growth".
4. Extract BOTH investedAmount (total invested in INR) and currentValue (current market value in INR) accurately for each scheme, stripping Indian commas (e.g. 7,69,722.31 -> 769722.31) and currency symbols.
5. Extract units and avgNav ONLY if explicitly visible in the image/statement. NEVER guess, estimate, or invent placeholder units or avgNav (output 0 if not printed). If portfolio header totals ("Total investment", "Current value") are visible, extract them into portfolioTotals.
6. Extract latestNavShown and returnsPercent if visible, otherwise 0.
7. Format purchaseDate as YYYY-MM-DD if visible; otherwise leave empty string. Extract folioNumber and monthlySipAmount if visible, and set isSip = true if SIP is indicated.`;

const MF_IMPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sourceDetected: {
      type: Type.STRING,
      description:
        'Detected app or statement format (e.g., Groww, Zerodha Coin, Kuvera, Paytm Money, INDmoney, MFCentral, CAMS CAS PDF).',
    },
    portfolioTotals: {
      type: Type.OBJECT,
      properties: {
        totalInvested: { type: Type.NUMBER },
        totalCurrent: { type: Type.NUMBER },
      },
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    holdings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          rawSchemeName: { type: Type.STRING },
          planType: { type: Type.STRING },
          optionType: { type: Type.STRING },
          units: { type: Type.NUMBER },
          avgNav: { type: Type.NUMBER },
          investedAmount: { type: Type.NUMBER },
          currentValue: { type: Type.NUMBER },
          latestNavShown: { type: Type.NUMBER },
          returnsPercent: { type: Type.NUMBER },
          purchaseDate: { type: Type.STRING },
          isSip: { type: Type.BOOLEAN },
          monthlySipAmount: { type: Type.NUMBER },
          folioNumber: { type: Type.STRING },
          confidence: { type: Type.STRING },
          notes: { type: Type.STRING },
        },
        required: ['rawSchemeName', 'planType', 'confidence'],
      },
    },
  },
  required: ['sourceDetected', 'holdings'],
};

async function parseImportBatch(
  ai: GoogleGenAI,
  files: MfImportFileInput[],
  rawText?: string
): Promise<GeminiMfParsePayload> {
  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = files.map(
    (f) => ({
      inlineData: {
        mimeType: f.mimeType || 'image/png',
        data: f.data,
      },
    })
  );

  parts.push({
    text: `Extract every Indian Mutual Fund holding and overall portfolio totals from the attached broker portfolio screenshots, CAMS/KFintech CAS PDF statement, or pasted statement text.
${rawText ? `\nPasted CAS/Statement Text:\n${rawText.slice(0, 20000)}\n` : ''}
${MF_IMPORT_PROMPT_RULES}`,
  });

  const modelCandidates: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
  ];

  let lastErr: unknown = null;
  for (const candidate of modelCandidates) {
    try {
      const response = await ai.models.generateContent({
        model: candidate.model,
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
          responseMimeType: 'application/json',
          responseSchema: MF_IMPORT_SCHEMA,
        },
      });
      return JSON.parse((response.text ?? '{}').trim()) as GeminiMfParsePayload;
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err)) {
        throw err;
      }
    }
  }

  if (isQuotaError(lastErr)) {
    throw new Error(
      'Gemini free-tier daily quota (20 req/day) was reached while scanning this screenshot/PDF. Use the Zerodha Coin / Kite CSV upload tab (uses 0 AI quota), or add a billing-enabled Gemini API key in Settings > Secrets.'
    );
  }
  throw lastErr instanceof Error ? lastErr : new Error('Unable to parse mutual fund statement.');
}

function normalizeSchemeQueryName(rawName: string): string {
  return rawName
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(direct|regular|plan|growth|option|opt|idcw|dividend|payout|reinvestment|dir|reg)\b/gi, ' ')
    .replace(/\bPPFAS\b/gi, 'Parag Parikh')
    .replace(/\bICICI\s+Pru\b/gi, 'ICICI Prudential')
    .replace(/\bABSL\b/gi, 'Aditya Birla Sun Life')
    .replace(/\bAxis\s+Bluechip\b/gi, 'Axis Large Cap')
    .replace(/\bHDFC\s+Mid[-\s]*Cap\s+Opportunities\b/gi, 'HDFC Mid Cap')
    .replace(/\bMirae\s+Asset\s+Emerging\s+Bluechip\b/gi, 'Mirae Asset Large & Midcap')
    .replace(/\bKotak\s+Standard\s+Multicap\b/gi, 'Kotak Flexi Cap')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTokenSimilarity(targetName: string, candidateName: string): number {
  const stopWords = new Set(['fund', 'mutual', 'scheme', 'plan', 'direct', 'regular', 'growth', 'option', 'india', 'the', 'of', 'and']);
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !stopWords.has(t));

  const targetTokens = new Set(tokenize(targetName));
  const candTokens = new Set(tokenize(candidateName));
  if (targetTokens.size === 0 || candTokens.size === 0) return 0;

  let overlap = 0;
  for (const t of targetTokens) {
    if (candTokens.has(t)) overlap += 1;
  }
  return overlap / Math.max(targetTokens.size, 1);
}

export async function resolveAmfiMatch(
  rawName: string,
  preferredPlan: 'Direct' | 'Regular',
  preferredOption: 'Growth' | 'IDCW',
  targetNavHint?: number,
  strictPlan = false
) {
  const cleaned = normalizeSchemeQueryName(rawName);
  const words = cleaned.split(' ').filter(Boolean);
  const queries = Array.from(
    new Set(
      [
        cleaned,
        cleaned.replace(/\s*&\s*/g, ' and '),
        words.slice(0, 4).join(' '),
        words.slice(0, 3).join(' '),
      ].filter((q) => q.length >= 3)
    )
  );

  const candidateMap = new Map<string, { item: (Awaited<ReturnType<typeof searchMutualFunds>>)[number]; score: number }>();

  for (const q of queries) {
    const results = await searchMutualFunds(q);
    if (results.length === 0) continue;

    const wantsBonus = /\bbonus\b/i.test(rawName);
    for (const r of results) {
      const sim = scoreTokenSimilarity(cleaned, r.schemeName);
      const isBonus = /\bbonus\b/i.test(r.schemeName);
      const hasGrowthWord = /\bgrowth\b/i.test(r.schemeName);
      const optBonus =
        r.optionType === preferredOption
          ? preferredOption === 'Growth' && isBonus && !wantsBonus
            ? -0.45
            : preferredOption === 'Growth' && hasGrowthWord
            ? 0.45
            : 0.3
          : -0.45;
      const planBonus = r.planType === preferredPlan ? 0.25 : 0;
      const totalScore = sim + optBonus + planBonus;

      const existing = candidateMap.get(r.schemeCode);
      if (!existing || totalScore > existing.score) {
        candidateMap.set(r.schemeCode, { item: r, score: totalScore });
      }
    }

    // Stop querying shorter prefixes once we already have strong exact matches
    const bestSoFar = Math.max(0, ...Array.from(candidateMap.values()).map((c) => c.score));
    if (bestSoFar >= 1.2) break;
  }

  const ranked = Array.from(candidateMap.values())
    .sort((a, b) => b.score - a.score)
    .map((c) => c.item);

  if (ranked.length > 0) {
    // If we know the target NAV (from latestNavShown or currentValue / units), compare top candidates
    // (including both Direct & Regular variants of top match) to pick the exact NAV-verified plan.
    const preferredPool = strictPlan
      ? ranked.filter((r) => r.planType === preferredPlan)
      : [];
    const candidatePool = preferredPool.length > 0 ? preferredPool : ranked;

    const topPool: typeof ranked = [];
    const topPreferred = candidatePool.find(
      (r) => r.planType === preferredPlan && r.optionType === preferredOption
    );
    if (topPreferred) topPool.push(topPreferred);
    for (const cand of candidatePool) {
      if (topPool.length >= (targetNavHint && targetNavHint > 0 ? 4 : 1)) break;
      if (!topPool.some((p) => p.schemeCode === cand.schemeCode)) {
        topPool.push(cand);
      }
    }

    const fetchedCandidates = await Promise.all(
      topPool.map(async (cand) => ({
        cand,
        series: await fetchMfSchemeSeries(cand.schemeCode),
      }))
    );

    const validFetched = fetchedCandidates
      .map(({ cand, series }) => {
        const latestNav =
          series && series.points.length > 0
            ? series.points[series.points.length - 1].nav
            : null;
        const sim = scoreTokenSimilarity(cleaned, series?.schemeName || cand.schemeName);
        const navDiffPct =
          targetNavHint && targetNavHint > 0 && latestNav && latestNav > 0
            ? Math.abs(latestNav - targetNavHint) / targetNavHint
            : null;
        return { cand, series, latestNav, sim, navDiffPct };
      })
      .filter((x) => x.series !== null);

    let chosen = validFetched[0] || null;
    if (targetNavHint && targetNavHint > 0 && validFetched.length > 1) {
      const navMatches = validFetched
        .filter((x) => x.navDiffPct !== null && x.navDiffPct <= 0.12 && x.sim >= 0.45)
        .sort((a, b) => (a.navDiffPct ?? 999) - (b.navDiffPct ?? 999));
      if (navMatches.length > 0) {
        chosen = navMatches[0];
      }
    }

    if (chosen && chosen.series) {
      return {
        schemeCode: chosen.cand.schemeCode,
        schemeName: chosen.series.schemeName,
        fundHouse: chosen.series.fundHouse || 'Indian Mutual Fund',
        category: chosen.series.category || 'Flexi Cap',
        planType: chosen.series.planType,
        optionType: chosen.series.optionType,
        latestNav: chosen.latestNav,
        verified: true,
      };
    }

    const fallbackCand = ranked[0];
    return {
      schemeCode: fallbackCand.schemeCode,
      schemeName: fallbackCand.schemeName,
      fundHouse: 'Indian Mutual Fund',
      category: 'Flexi Cap',
      planType: fallbackCand.planType,
      optionType: fallbackCand.optionType,
      latestNav: null,
      verified: false,
    };
  }

  return {
    schemeCode: '122639',
    schemeName: rawName.trim() || 'Unmatched Mutual Fund Scheme',
    fundHouse: 'Indian Mutual Fund',
    category: 'Flexi Cap',
    planType: preferredPlan,
    optionType: preferredOption,
    latestNav: null,
    verified: false,
  };
}

export async function parseMutualFundImport(params: {
  files: MfImportFileInput[];
  rawText?: string;
}): Promise<MutualFundImportParseResponse> {
  const ai = createGeminiClient();
  const batches: MfImportFileInput[][] = [];

  if (params.files.length > 0) {
    for (let i = 0; i < params.files.length; i += 5) {
      batches.push(params.files.slice(i, i + 5));
    }
  } else {
    batches.push([]);
  }

  const batchResults = await Promise.all(
    batches.map((b, idx) => parseImportBatch(ai, b, idx === 0 ? params.rawText : undefined))
  );

  const sources = Array.from(
    new Set(batchResults.map((r) => r.sourceDetected).filter((s): s is string => Boolean(s)))
  );
  const sourceLabel = sources.join(' / ') || 'Mutual Fund Statement / Screenshot';
  const brokerDefaultsDirect =
    DIRECT_DEFAULT_BROKERS.test(sourceLabel) || DIRECT_DEFAULT_BROKERS.test(params.rawText || '');
  const brokerDefaultsRegular =
    REGULAR_DEFAULT_BROKERS.test(sourceLabel) || REGULAR_DEFAULT_BROKERS.test(params.rawText || '');

  const warnings = Array.from(
    new Set(batchResults.flatMap((r) => (Array.isArray(r.warnings) ? r.warnings : [])))
  );
  const rows = batchResults.flatMap((r) => (Array.isArray(r.holdings) ? r.holdings : []));

  const resolvedRows: ParsedMutualFundImportRow[] = await Promise.all(
    rows
      .filter(
        (r) =>
          Number(r.units) > 0 ||
          Number(r.investedAmount) > 0 ||
          Number(r.currentValue) > 0
      )
      .map(async (row, idx) => {
        const hasExplicitRegular = /\b(regular|reg|arn-)\b/i.test(
          `${row.planType || ''} ${row.rawSchemeName || ''}`
        );
        const hasExplicitDirect = /\b(direct|dir)\b/i.test(
          `${row.planType || ''} ${row.rawSchemeName || ''}`
        );

        const prefPlan: 'Direct' | 'Regular' = hasExplicitRegular
          ? 'Regular'
          : hasExplicitDirect
          ? 'Direct'
          : brokerDefaultsRegular
          ? 'Regular'
          : brokerDefaultsDirect
          ? 'Direct'
          : 'Direct';

        const prefOpt: 'Growth' | 'IDCW' = /idcw|dividend/i.test(
          `${row.optionType || ''} ${row.rawSchemeName || ''}`
        )
          ? 'IDCW'
          : 'Growth';

        const extUnits = Number(row.units) > 0 ? Number(row.units) : 0;
        const extInvested = Number(row.investedAmount) > 0 ? Number(row.investedAmount) : 0;
        const extCurrent = Number(row.currentValue) > 0 ? Number(row.currentValue) : 0;
        const extLatestNav = Number(row.latestNavShown) > 0 ? Number(row.latestNavShown) : 0;

        const targetNavHint =
          extLatestNav > 0
            ? extLatestNav
            : extUnits > 0 && extCurrent > 0
            ? extCurrent / extUnits
            : undefined;

        const match = await resolveAmfiMatch(
          row.rawSchemeName,
          prefPlan,
          prefOpt,
          targetNavHint,
          hasExplicitRegular || hasExplicitDirect
        );

        const liveNav = match.latestNav && match.latestNav > 0 ? match.latestNav : 0;
        let units = extUnits;
        let reconciledNote = '';

        if (extCurrent > 0 && liveNav > 0) {
          const impliedCurrent = extUnits > 0 ? extUnits * liveNav : 0;
          const withinTolerance =
            extUnits > 0 && Math.abs(impliedCurrent - extCurrent) / extCurrent <= 0.05;
          if (!withinTolerance) {
            units = extCurrent / liveNav;
            if (extUnits > 0) {
              reconciledNote = `Reconciled units from screenshot current value ₹${extCurrent.toFixed(0)} ÷ live NAV ₹${liveNav.toFixed(2)}.`;
            }
          }
        } else if (units <= 0 && extInvested > 0) {
          const fallbackNav =
            Number(row.avgNav) > 0 ? Number(row.avgNav) : liveNav > 0 ? liveNav : 50;
          units = extInvested / fallbackNav;
        }

        units = Number(Math.max(0.0001, units).toFixed(4));

        let avgNav: number;
        if (extInvested > 0 && units > 0) {
          // Derive avgNav from investedAmount / reconciled units so Invested, Current, and Gain % match screenshot
          avgNav = extInvested / units;
        } else if (Number(row.avgNav) > 0) {
          avgNav = Number(row.avgNav);
        } else {
          avgNav = liveNav > 0 ? liveNav : 50;
        }
        avgNav = Number(Math.max(0.0001, avgNav).toFixed(4));

        const purchaseDate =
          row.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(row.purchaseDate)
            ? row.purchaseDate
            : new Date(Date.now() - 420 * 86400000).toISOString().slice(0, 10);

        const conf =
          row.confidence === 'high' || row.confidence === 'medium' || row.confidence === 'low'
            ? row.confidence
            : 'medium';

        return {
          tempId: `mf_imp_${Date.now()}_${idx}`,
          rawSchemeName: row.rawSchemeName,
          resolvedSchemeCode: match.schemeCode,
          resolvedSchemeName: match.schemeName,
          fundHouse: match.fundHouse,
          category: match.category,
          planType: match.planType,
          optionType: match.optionType,
          units,
          avgNav,
          purchaseDate,
          isSip: Boolean(row.isSip),
          monthlySipAmount: Number(row.monthlySipAmount) > 0 ? Number(row.monthlySipAmount) : 0,
          folioNumber: (row.folioNumber || '').slice(0, 40),
          latestNav: match.latestNav,
          verified: match.verified,
          confidence: match.verified ? conf : 'low',
          notes: [row.notes || '', reconciledNote].filter(Boolean).join(' ').trim(),
          screenshotInvestedAmount: extInvested > 0 ? Number(extInvested.toFixed(2)) : undefined,
          screenshotCurrentValue: extCurrent > 0 ? Number(extCurrent.toFixed(2)) : undefined,
        };
      })
  );

  // Deduplicate exact scheme + folio + units rows across overlapping screenshots
  const seen = new Set<string>();
  const deduped: ParsedMutualFundImportRow[] = [];
  for (const r of resolvedRows) {
    const key = `${r.resolvedSchemeCode}|${r.folioNumber}|${r.units.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // Validate extracted rows against portfolio header totals if present
  const reportedTotals = batchResults
    .map((r) => r.portfolioTotals)
    .find((t) => t && (Number(t.totalCurrent) > 0 || Number(t.totalInvested) > 0));

  if (reportedTotals && deduped.length > 0) {
    const sumInvested = deduped.reduce((acc, r) => acc + r.units * r.avgNav, 0);
    const sumCurrent = deduped.reduce(
      (acc, r) => acc + r.units * (r.latestNav || r.avgNav),
      0
    );
    const headerCurrent = Number(reportedTotals.totalCurrent || 0);
    const headerInvested = Number(reportedTotals.totalInvested || 0);

    if (
      headerCurrent > 0 &&
      Math.abs(sumCurrent - headerCurrent) / headerCurrent > 0.03
    ) {
      warnings.push(
        `Parsed holdings value (₹${Math.round(sumCurrent).toLocaleString('en-IN')}) differs from screenshot header Current Value (₹${Math.round(headerCurrent).toLocaleString('en-IN')}) — check if all scrolled schemes were included.`
      );
    }
    if (
      headerInvested > 0 &&
      Math.abs(sumInvested - headerInvested) / headerInvested > 0.03
    ) {
      warnings.push(
        `Parsed invested capital (₹${Math.round(sumInvested).toLocaleString('en-IN')}) differs from screenshot header Invested (₹${Math.round(headerInvested).toLocaleString('en-IN')}) — check if all schemes are staged.`
      );
    }
  }

  return {
    sourceDetected: sourceLabel,
    holdings: deduped,
    warnings,
  };
}

const formatRupees = (v: number): string =>
  `₹${Math.round(v).toLocaleString('en-IN')}`;

function clampMfNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getCategoryLongTermBaseCagr(category: string): {
  baseCagr: number;
  min1Y: number;
  max1Y: number;
  minLong: number;
  maxLong: number;
} {
  const lower = (category || '').toLowerCase();
  if (/liquid|overnight|money market/i.test(lower)) {
    return { baseCagr: 6.5, min1Y: 4.5, max1Y: 8.5, minLong: 5.5, maxLong: 7.5 };
  }
  if (/debt|gilt|bond|corporate|banking & psu|short duration|dynamic bond/i.test(lower)) {
    return { baseCagr: 7.4, min1Y: 3.5, max1Y: 11.5, minLong: 6.0, maxLong: 9.0 };
  }
  if (/hybrid|balanced|equity savings|multi asset|arbitrage/i.test(lower)) {
    return { baseCagr: 10.5, min1Y: -4, max1Y: 18, minLong: 8.0, maxLong: 13.5 };
  }
  if (/small\s*cap/i.test(lower)) {
    return { baseCagr: 14.8, min1Y: -15, max1Y: 32, minLong: 9.5, maxLong: 18.5 };
  }
  if (/mid\s*cap/i.test(lower)) {
    return { baseCagr: 13.8, min1Y: -12, max1Y: 28, minLong: 9.0, maxLong: 17.5 };
  }
  if (/flexi|multi\s*cap|large\s*&|elss|focused/i.test(lower)) {
    return { baseCagr: 12.6, min1Y: -10, max1Y: 25, minLong: 8.5, maxLong: 16.5 };
  }
  return { baseCagr: 11.8, min1Y: -10, max1Y: 24, minLong: 8.0, maxLong: 15.5 };
}

function buildMfHorizonProjection(
  f: AnalyzedMutualFund,
  aiHint?: { p6m?: number; p1y?: number; cagr5y?: number; cagr10y?: number }
): HorizonProjection {
  const val = Math.max(1, f.currentValue);
  const bounds = getCategoryLongTermBaseCagr(f.holding.category);

  const histAnchor =
    f.return5Y !== null && f.return3Y !== null
      ? f.return5Y * 0.5 + f.return3Y * 0.5
      : f.return3Y !== null
      ? f.return3Y
      : f.return1Y !== null
      ? f.return1Y * 0.6 + bounds.baseCagr * 0.4
      : bounds.baseCagr;

  const alphaEdge = f.alpha3Y !== null ? clampMfNum(f.alpha3Y * 0.25, -2.5, 2.5) : 0;
  const terDrag = clampMfNum(f.estExpenseRatio - 0.65, 0, 1.5);

  const base1Y = clampMfNum(
    bounds.baseCagr * 0.6 + (f.return1Y ?? bounds.baseCagr) * 0.4 + alphaEdge - terDrag,
    bounds.min1Y,
    bounds.max1Y
  );
  const base6M = clampMfNum(base1Y * 0.48, bounds.min1Y * 0.55, bounds.max1Y * 0.55);
  const base5Y = clampMfNum(
    bounds.baseCagr * 0.65 + histAnchor * 0.35 + alphaEdge * 0.6 - terDrag,
    bounds.minLong,
    bounds.maxLong
  );
  const base10Y = clampMfNum(
    bounds.baseCagr * 0.78 + base5Y * 0.22 - terDrag * 0.85,
    bounds.minLong,
    bounds.maxLong - 0.5
  );

  const r6m =
    typeof aiHint?.p6m === 'number' && Number.isFinite(aiHint.p6m)
      ? clampMfNum(aiHint.p6m * 0.5 + base6M * 0.5, bounds.min1Y * 0.6, bounds.max1Y * 0.6)
      : base6M;
  const r1y =
    typeof aiHint?.p1y === 'number' && Number.isFinite(aiHint.p1y)
      ? clampMfNum(aiHint.p1y * 0.5 + base1Y * 0.5, bounds.min1Y, bounds.max1Y)
      : base1Y;
  const c5y =
    typeof aiHint?.cagr5y === 'number' && Number.isFinite(aiHint.cagr5y)
      ? clampMfNum(aiHint.cagr5y * 0.5 + base5Y * 0.5, bounds.minLong, bounds.maxLong)
      : base5Y;
  const c10y =
    typeof aiHint?.cagr10y === 'number' && Number.isFinite(aiHint.cagr10y)
      ? clampMfNum(aiHint.cagr10y * 0.5 + base10Y * 0.5, bounds.minLong, bounds.maxLong - 0.5)
      : base10Y;

  const hasSwitchGain = f.switchSuggestion.action !== 'HOLD';
  const extraAnnualPct = hasSwitchGain
    ? clampMfNum(
        (f.switchSuggestion.annualCommissionSaved / val) * 100 +
          (f.switchSuggestion.action === 'SWITCH_PEER' ? 1.1 : 0.15),
        0.3,
        2.5
      )
    : 0;
  const immediateFriction = hasSwitchGain
    ? (f.switchSuggestion.estimatedExitLoad || 0) + (f.switchSuggestion.estimatedTax || 0)
    : 0;

  const optNetBase = Math.max(0, val - immediateFriction);
  const opt6m = hasSwitchGain
    ? optNetBase * (1 + (r6m + extraAnnualPct * 0.5) / 100)
    : val * (1 + r6m / 100);
  const opt1y = hasSwitchGain
    ? optNetBase * (1 + (r1y + extraAnnualPct) / 100)
    : val * (1 + r1y / 100);
  const opt5y = hasSwitchGain
    ? optNetBase * Math.pow(1 + (c5y + extraAnnualPct) / 100, 5)
    : val * Math.pow(1 + c5y / 100, 5);
  const opt10y = hasSwitchGain
    ? optNetBase * Math.pow(1 + (c10y + extraAnnualPct) / 100, 10)
    : val * Math.pow(1 + c10y / 100, 10);

  return {
    return6MPercent: Number(r6m.toFixed(1)),
    value6M: Math.round(val * (1 + r6m / 100)),
    return1YPercent: Number(r1y.toFixed(1)),
    value1Y: Math.round(val * (1 + r1y / 100)),
    cagr5YPercent: Number(c5y.toFixed(1)),
    value5Y: Math.round(val * Math.pow(1 + c5y / 100, 5)),
    cagr10YPercent: Number(c10y.toFixed(1)),
    value10Y: Math.round(val * Math.pow(1 + c10y / 100, 10)),
    optimizedValue6M: Math.round(opt6m),
    optimizedValue1Y: Math.round(opt1y),
    optimizedValue5Y: Math.round(opt5y),
    optimizedValue10Y: Math.round(opt10y),
    basisNote: `Mean-reverted ${f.holding.category} trajectory net of ${f.estExpenseRatio.toFixed(2)}% TER.`,
  };
}

function aggregateMfPortfolioProjection(
  funds: AnalyzedMutualFund[],
  recProjectionsByCode: Map<string, HorizonProjection>
): HorizonProjection | undefined {
  let baseVal = 0;
  let v6m = 0;
  let v1y = 0;
  let v5y = 0;
  let v10y = 0;
  let o6m = 0;
  let o1y = 0;
  let o5y = 0;
  let o10y = 0;

  for (const f of funds) {
    const p = recProjectionsByCode.get(f.holding.schemeCode) || buildMfHorizonProjection(f);
    baseVal += Math.max(0, f.currentValue);
    v6m += p.value6M;
    v1y += p.value1Y;
    v5y += p.value5Y;
    v10y += p.value10Y;
    o6m += p.optimizedValue6M ?? p.value6M;
    o1y += p.optimizedValue1Y ?? p.value1Y;
    o5y += p.optimizedValue5Y ?? p.value5Y;
    o10y += p.optimizedValue10Y ?? p.value10Y;
  }

  if (baseVal <= 0) return undefined;

  return {
    return6MPercent: Number((((v6m - baseVal) / baseVal) * 100).toFixed(1)),
    value6M: Math.round(v6m),
    return1YPercent: Number((((v1y - baseVal) / baseVal) * 100).toFixed(1)),
    value1Y: Math.round(v1y),
    cagr5YPercent: Number(((Math.pow(v5y / baseVal, 1 / 5) - 1) * 100).toFixed(1)),
    value5Y: Math.round(v5y),
    cagr10YPercent: Number(((Math.pow(v10y / baseVal, 1 / 10) - 1) * 100).toFixed(1)),
    value10Y: Math.round(v10y),
    optimizedValue6M: Math.round(o6m),
    optimizedValue1Y: Math.round(o1y),
    optimizedValue5Y: Math.round(o5y),
    optimizedValue10Y: Math.round(o10y),
    basisNote:
      'Compounded portfolio projection comparing current path vs. post-switch Direct/Peer optimization (net of TER & Year-1 switch tax/exit load).',
  };
}

function buildDeterministicMfRecommendation(f: AnalyzedMutualFund) {
  const sw = f.switchSuggestion;
  const shortName = f.holding.schemeName.split(' - ')[0];
  const targetShort = (sw.targetSchemeName || 'Direct Growth peer').split(' - ')[0];
  const commissionSaved = Math.round(sw.annualCommissionSaved || 0);
  const exitFriction = Math.round((sw.estimatedExitLoad || 0) + (sw.estimatedTax || 0));
  const projection = buildMfHorizonProjection(f);
  const exitLoadDateLabel =
    sw.daysUntilExitLoadFree > 0
      ? new Date(Date.now() + sw.daysUntilExitLoadFree * 86400000).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'now';

  if (sw.action === 'SWITCH_TO_DIRECT') {
    const timingClause =
      sw.timingVerdict === 'WAIT_EXIT_LOAD' && sw.daysUntilExitLoadFree > 0
        ? `Wait ${sw.daysUntilExitLoadFree} days until the ${sw.exitLoadRuleLabel || '1Y exit-load'} window clears (${exitLoadDateLabel}), then switch full exit-load-free units to Direct Growth.`
        : `Switch immediately to ${targetShort} (Direct Growth)${exitFriction > 0 ? `; estimated tax + exit friction ~${formatRupees(exitFriction)} pays back via fee savings.` : ' with zero exit load.'}`;
    return {
      schemeCode: f.holding.schemeCode,
      actionSummary: `Switch ${shortName} from Regular to Direct to save ~${formatRupees(commissionSaved)}/yr`,
      executionSteps: `${timingClause} Stop any active Regular SIPs immediately and restart them in Direct mode.`,
      projection,
    };
  }

  if (sw.action === 'SWITCH_PEER') {
    const alphaStr = f.alpha3Y !== null ? `${f.alpha3Y >= 0 ? '+' : ''}${f.alpha3Y.toFixed(1)}% 3Y alpha` : `Grade ${f.reportCardGrade}`;
    const timingClause =
      sw.timingVerdict === 'WAIT_EXIT_LOAD' && sw.daysUntilExitLoadFree > 0
        ? `Stagger switch after ${sw.daysUntilExitLoadFree} days (${exitLoadDateLabel}) once exit load reaches zero.`
        : `Reallocate within your ₹1.25L annual Equity LTCG exemption toward ${targetShort}.`;
    return {
      schemeCode: f.holding.schemeCode,
      actionSummary: `Upgrade lagging ${shortName} (${alphaStr}) → ${targetShort}`,
      executionSteps: timingClause,
      projection,
    };
  }

  return {
    schemeCode: f.holding.schemeCode,
    actionSummary: `Hold ${shortName} (Grade ${f.reportCardGrade}, ${f.holding.planType} plan)`,
    executionSteps:
      sw.rationale ||
      'Continue existing SIP / allocation; expense ratio and benchmark-adjusted performance remain healthy.',
    projection,
  };
}

function buildDeterministicMfAdvice(
  funds: AnalyzedMutualFund[],
  summary: MutualFundSummaryMetrics,
  quotaNotice?: string
): MfAiSwitchAdviceResponse {
  const regularFunds = funds.filter((f) => f.holding.planType === 'Regular');
  const sortedActionable = [...funds].sort(
    (a, b) =>
      b.switchSuggestion.annualCommissionSaved - a.switchSuggestion.annualCommissionSaved ||
      (b.switchSuggestion.action !== 'HOLD' ? 1 : 0) - (a.switchSuggestion.action !== 'HOLD' ? 1 : 0)
  );

  const topSwitch = sortedActionable.find((f) => f.switchSuggestion.action !== 'HOLD');
  const waitLoadCount = funds.filter((f) => f.switchSuggestion.timingVerdict === 'WAIT_EXIT_LOAD').length;

  const portfolioVerdict =
    summary.regularPlanCount > 0
      ? `Across ${funds.length} schemes (${formatRupees(summary.totalCurrent)}), ${summary.regularPlanCount} Regular plan(s) leak ${formatRupees(summary.regularCommissionLeak)}/yr in distributor commissions (${formatRupees(summary.tenYearCommissionLeak)} compounded over 10 years), while ${summary.underperformerCount} fund(s) lag category peers.`
      : `Across ${funds.length} Direct-plan schemes (${formatRupees(summary.totalCurrent)}), zero distributor commission leak was detected; ${summary.underperformerCount} fund(s) warrant peer alpha review.`;

  const priorityMove = topSwitch
    ? `Prioritize ${topSwitch.holding.schemeName.split(' - ')[0]} (${topSwitch.switchSuggestion.action === 'SWITCH_TO_DIRECT' ? `saves ${formatRupees(topSwitch.switchSuggestion.annualCommissionSaved)}/yr` : `upgrade to ${(topSwitch.switchSuggestion.targetSchemeName || 'top peer').split(' - ')[0]}`}) and pause any ongoing Regular-plan SIP instalments immediately.`
    : regularFunds.length === 0
    ? 'Maintain Direct SIP discipline and rebalance annually to keep equity-debt weights on target.'
    : 'Convert Regular plans to Direct in order of highest annual commission drag.';

  const taxOptimizationNote =
    waitLoadCount > 0
      ? `${waitLoadCount} scheme(s) currently sit inside an exit-load or ELSS lock-in window — harvest your ₹1.25L annual Equity LTCG exemption only on exit-load-free lots first and stagger remaining redemptions past the 1-year date.`
      : 'Use Systematic Transfer / annual LTCG harvesting up to ₹1.25L unrealized Equity gain per financial year to migrate units tax-efficiently.';

  const recommendations = funds.map(buildDeterministicMfRecommendation);
  const projMap = new Map<string, HorizonProjection>();
  for (const rec of recommendations) {
    if (rec.projection) projMap.set(rec.schemeCode, rec.projection);
  }

  return {
    portfolioVerdict,
    priorityMove,
    taxOptimizationNote,
    portfolioProjection: aggregateMfPortfolioProjection(funds, projMap),
    recommendations,
    guardrailWarnings: [],
    generatedAt: new Date().toISOString(),
    analysisSource: 'fallback_engine',
    quotaNotice,
  };
}

interface RawGeminiMfRec {
  schemeCode: string;
  actionSummary: string;
  executionSteps: string;
  p6m?: number;
  p1y?: number;
  cagr5y?: number;
  cagr10y?: number;
}

export async function generateMfSwitchAdvice(params: {
  funds: AnalyzedMutualFund[];
  summary: MutualFundSummaryMetrics;
}): Promise<MfAiSwitchAdviceResponse> {
  if (!process.env.GEMINI_API_KEY) {
    return buildDeterministicMfAdvice(
      params.funds,
      params.summary,
      'Gemini API key is not configured — showing quantitative AMFI switch & tax execution plan instead. Configure a key in Settings > Secrets to enable LLM commentary.'
    );
  }

  const ai = createGeminiClient();
  const MF_AI_BATCH_SIZE = 30;

  const compactSnapshot = params.funds.map((f) => ({
    schemeCode: f.holding.schemeCode,
    schemeName: f.holding.schemeName,
    planType: f.holding.planType,
    category: f.holding.category,
    currentValue: f.currentValue,
    unrealizedGain: f.unrealizedGain,
    grade: f.reportCardGrade,
    return1Y: f.return1Y,
    return3Y: f.return3Y,
    return5Y: f.return5Y,
    alpha3Y: f.alpha3Y,
    sharpeRatio: f.sharpeRatio,
    ter: f.estExpenseRatio,
    action: f.switchSuggestion.action,
    timingVerdict: f.switchSuggestion.timingVerdict,
    targetSchemeName: f.switchSuggestion.targetSchemeName,
    annualCommissionSaved: f.switchSuggestion.annualCommissionSaved,
    estimatedExitLoad: f.switchSuggestion.estimatedExitLoad,
    estimatedTax: f.switchSuggestion.estimatedTax,
    daysUntilExitLoadFree: f.switchSuggestion.daysUntilExitLoadFree,
  }));

  const batches: Array<typeof compactSnapshot> = [];
  for (let i = 0; i < compactSnapshot.length; i += MF_AI_BATCH_SIZE) {
    batches.push(compactSnapshot.slice(i, i + MF_AI_BATCH_SIZE));
  }

  const modelCandidates: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
  ];

  let usedFallbackEngine = false;
  let quotaHit = false;

  const batchResponses = await Promise.all(
    batches.map(async (batch, idx) => {
      const prompt = `You are a Stoxify SEBI-grade Indian Mutual Fund portfolio advisor. Review this investor's live mutual fund analytics and switch simulation (${idx === 0 ? 'Full Summary + Batch 1' : `Continuation Batch ${idx + 1} of ${batches.length}`}):
Summary: ${JSON.stringify(params.summary)}
Holdings in Batch (${batch.length} schemes): ${JSON.stringify(batch)}

Provide a concise, actionable switch execution plan in Indian Rupees (₹), factoring in Regular->Direct commission leaks, underperforming peer switches, 1-year exit load windows, and ₹1.25L annual Equity LTCG exemption harvesting. For EVERY scheme in this batch also output realistic expected return/CAGR predictions: p6m (6-month total %), p1y (1-year total %), cagr5y (5-year annualized % CAGR), and cagr10y (10-year annualized % CAGR).`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          portfolioVerdict: { type: Type.STRING },
          priorityMove: { type: Type.STRING },
          taxOptimizationNote: { type: Type.STRING },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                schemeCode: { type: Type.STRING },
                actionSummary: { type: Type.STRING },
                executionSteps: { type: Type.STRING },
                p6m: { type: Type.NUMBER },
                p1y: { type: Type.NUMBER },
                cagr5y: { type: Type.NUMBER },
                cagr10y: { type: Type.NUMBER },
              },
              required: ['schemeCode', 'actionSummary', 'executionSteps'],
            },
          },
        },
        required: [
          'portfolioVerdict',
          'priorityMove',
          'taxOptimizationNote',
          'recommendations',
        ],
      };

      for (const candidate of modelCandidates) {
        try {
          const response = await ai.models.generateContent({
            model: candidate.model,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
              responseMimeType: 'application/json',
              responseSchema: schema,
            },
          });

          return JSON.parse((response.text ?? '{}').trim()) as {
            portfolioVerdict: string;
            priorityMove: string;
            taxOptimizationNote: string;
            recommendations: RawGeminiMfRec[];
          };
        } catch (err) {
          if (isQuotaError(err)) {
            quotaHit = true;
            continue;
          }
          break;
        }
      }

      usedFallbackEngine = true;
      const batchCodes = new Set(batch.map((b) => b.schemeCode));
      const batchFunds = params.funds.filter((f) => batchCodes.has(f.holding.schemeCode));
      const det = buildDeterministicMfAdvice(batchFunds, params.summary);
      return {
        portfolioVerdict: det.portfolioVerdict,
        priorityMove: det.priorityMove,
        taxOptimizationNote: det.taxOptimizationNote,
        recommendations: det.recommendations.map((rec) => ({
          ...rec,
          p6m: rec.projection?.return6MPercent,
          p1y: rec.projection?.return1YPercent,
          cagr5y: rec.projection?.cagr5YPercent,
          cagr10y: rec.projection?.cagr10YPercent,
        })),
      };
    })
  );

  const primary = batchResponses[0] || {
    portfolioVerdict: 'Mutual fund portfolio evaluated.',
    priorityMove: '',
    taxOptimizationNote: '',
    recommendations: [],
  };

  const allRecommendations = batchResponses.flatMap((b) =>
    Array.isArray(b.recommendations) ? b.recommendations : []
  );

  const fundByCode = new Map(params.funds.map((f) => [f.holding.schemeCode, f]));
  const guardrailWarnings: string[] = [];
  const seenCodes = new Set<string>();
  const validatedRecs: MfAiSwitchAdviceResponse['recommendations'] = [];
  const recProjMap = new Map<string, HorizonProjection>();

  for (const rec of allRecommendations) {
    const cleanCode = String(rec.schemeCode || '').replace(/[^0-9]/g, '');
    if (!cleanCode || seenCodes.has(cleanCode)) continue;
    const matched = fundByCode.get(cleanCode);
    if (!matched) {
      guardrailWarnings.push(
        `Filtered out unverified AI scheme recommendation (#${rec.schemeCode}) not present in your analyzed portfolio.`
      );
      continue;
    }
    seenCodes.add(cleanCode);
    if (
      matched.switchSuggestion.timingVerdict === 'WAIT_EXIT_LOAD' &&
      /redeem all|switch entire|exit immediately/i.test(
        `${rec.actionSummary} ${rec.executionSteps}`
      )
    ) {
      guardrailWarnings.push(
        `Guardrail notice for #${cleanCode} (${matched.holding.schemeName.split(' - ')[0]}): Deterministic engine flags active ${matched.switchSuggestion.exitLoadRuleLabel || 'exit-load / ELSS lock-in'} window — prefer staggering or waiting.`
      );
    }
    const projection = buildMfHorizonProjection(matched, {
      p6m: rec.p6m,
      p1y: rec.p1y,
      cagr5y: rec.cagr5y,
      cagr10y: rec.cagr10y,
    });
    recProjMap.set(cleanCode, projection);
    validatedRecs.push({
      schemeCode: cleanCode,
      actionSummary: rec.actionSummary,
      executionSteps: rec.executionSteps,
      projection,
    });
  }

  for (const f of params.funds) {
    if (!seenCodes.has(f.holding.schemeCode)) {
      const detRec = buildDeterministicMfRecommendation(f);
      validatedRecs.push(detRec);
      if (detRec.projection) recProjMap.set(f.holding.schemeCode, detRec.projection);
      seenCodes.add(f.holding.schemeCode);
    }
  }

  return {
    portfolioVerdict: primary.portfolioVerdict,
    priorityMove: primary.priorityMove,
    taxOptimizationNote: primary.taxOptimizationNote,
    portfolioProjection: aggregateMfPortfolioProjection(params.funds, recProjMap),
    recommendations: validatedRecs,
    guardrailWarnings,
    generatedAt: new Date().toISOString(),
    analysisSource: usedFallbackEngine ? 'fallback_engine' : 'gemini',
    quotaNotice: usedFallbackEngine
      ? quotaHit
        ? 'Gemini free-tier daily quota (20 requests/day) was reached, so Stoxify generated this plan using its deterministic AMFI Commission, Tax & Exit-Load Engine. To restore LLM narrative insights, select a billing-enabled Gemini API key in Settings > Secrets.'
        : 'Generated via Stoxify deterministic AMFI Commission, Tax & Exit-Load Engine due to transient LLM unavailability.'
      : undefined,
  };
}
