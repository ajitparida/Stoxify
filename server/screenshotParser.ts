import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { resolveSymbolForScreenshot } from './marketService.ts';
import type { Exchange, ParsedScreenshotHolding, ScreenshotParseResponse } from '../src/types/market.ts';

interface GeminiExtractedRow {
  rawName: string;
  guessedSymbol: string;
  exchange: string;
  quantity: number;
  avgBuyPrice: number;
  screenshotLtp: number;
  confidence: string;
  notes: string;
}

interface GeminiParsedPayload {
  brokerDetected?: string;
  holdings?: GeminiExtractedRow[];
  warnings?: string[];
}

export interface ScreenshotInput {
  mimeType: string;
  data: string;
  fileName?: string;
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /429|RESOURCE_EXHAUSTED|quota exceeded/i.test(msg);
}

async function parseScreenshotBatch(
  ai: GoogleGenAI,
  batch: ScreenshotInput[]
): Promise<GeminiParsedPayload> {
  const parts = [
    ...batch.map((img) => ({
      inlineData: {
        mimeType: img.mimeType || 'image/png',
        data: img.data,
      },
    })),
    {
      text: `Extract every Indian stock/equity holding visible in these broker portfolio screenshots (e.g., Zerodha Kite, Groww, Upstox, Angel One, ICICI Direct, HDFC Securities, INDmoney).
Rules:
1. Extract the exact visible stock name or symbol as rawName, and provide the standard NSE/BSE ticker without suffix in guessedSymbol (e.g., RELIANCE, HDFCBANK, TMPV, TMCV, TCS, INFOSYS -> INFY).
2. Read quantity (Qty / Shares), average buy price (Avg. / Buy Avg / Avg Cost), and screenshot Last Traded Price (LTP) accurately. Do not confuse Invested Value or Current Value or P&L with Avg Buy Price or LTP.
3. If multiple screenshots overlap or duplicate the exact same stock, include each distinct row clearly.
4. Use exchange "NSE" unless BSE is explicitly displayed.
5. Rate confidence as "high", "medium", or "low" depending on image clarity and whether Avg Buy Price & Qty are unambiguous.`,
    },
  ];

  const schema = {
    type: Type.OBJECT,
    properties: {
      brokerDetected: {
        type: Type.STRING,
        description: 'Detected broker or app UI name (e.g. Zerodha Kite, Groww, Upstox, Angel One, Unknown).',
      },
      warnings: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Any ambiguity, cropped columns, or low-readability warnings.',
      },
      holdings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            rawName: { type: Type.STRING },
            guessedSymbol: { type: Type.STRING },
            exchange: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            avgBuyPrice: { type: Type.NUMBER },
            screenshotLtp: { type: Type.NUMBER },
            confidence: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: ['rawName', 'guessedSymbol', 'quantity', 'avgBuyPrice', 'confidence'],
        },
      },
    },
    required: ['brokerDetected', 'holdings'],
  };

  const candidates: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
  ];

  let lastErr: unknown;
  for (const cfg of candidates) {
    try {
      const response = await ai.models.generateContent({
        model: cfg.model,
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: cfg.thinkingLevel },
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      const rawJson = (response.text ?? '{}').trim();
      return JSON.parse(rawJson) as GeminiParsedPayload;
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err)) throw err;
    }
  }

  if (isQuotaError(lastErr)) {
    throw new Error(
      'Gemini AI free-tier daily quota reached for screenshot OCR. Use the "Zerodha Kite / Broker CSV" tab for instant zero-quota imports, or select a billing-enabled API key in Settings > Secrets.'
    );
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to parse portfolio screenshot.');
}

export async function parsePortfolioScreenshots(
  images: ScreenshotInput[]
): Promise<ScreenshotParseResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Process in parallel chunks of up to 5 screenshots so up to 15 images parse reliably without output truncation
  const batches: ScreenshotInput[][] = [];
  for (let i = 0; i < images.length; i += 5) {
    batches.push(images.slice(i, i + 5));
  }

  const batchResults = await Promise.all(batches.map((b) => parseScreenshotBatch(ai, b)));

  const brokers = Array.from(
    new Set(
      batchResults
        .map((r) => r.brokerDetected)
        .filter((b): b is string => Boolean(b && b !== 'Unknown'))
    )
  );
  const allWarnings = Array.from(
    new Set(batchResults.flatMap((r) => (Array.isArray(r.warnings) ? r.warnings : [])))
  );
  const allRows = batchResults.flatMap((r) => (Array.isArray(r.holdings) ? r.holdings : []));

  const resolvedList: ParsedScreenshotHolding[] = await Promise.all(
    allRows
      .filter((r) => Number(r.quantity) > 0 && Number(r.avgBuyPrice) > 0)
      .map(async (row, idx) => {
        const preferredExchange: Exchange =
          row.exchange?.toUpperCase() === 'BSE' ? 'BSE' : 'NSE';
        const resolved = await resolveSymbolForScreenshot(
          row.rawName,
          row.guessedSymbol,
          preferredExchange
        );

        const screenshotLtp =
          typeof row.screenshotLtp === 'number' && row.screenshotLtp > 0
            ? Number(row.screenshotLtp.toFixed(2))
            : null;
        const livePrice = resolved.quote?.price ?? null;
        const priceDeviationPct =
          screenshotLtp && livePrice
            ? Number((((livePrice - screenshotLtp) / screenshotLtp) * 100).toFixed(2))
            : null;

        const conf =
          row.confidence === 'high' || row.confidence === 'medium' || row.confidence === 'low'
            ? row.confidence
            : 'medium';

        return {
          tempId: `shot_${Date.now()}_${idx}`,
          rawName: row.rawName,
          resolvedSymbol: resolved.symbol,
          resolvedName: resolved.name,
          exchange: resolved.exchange,
          sector: resolved.sector,
          quantity: Number(row.quantity),
          avgBuyPrice: Number(Number(row.avgBuyPrice).toFixed(2)),
          screenshotLtp,
          livePrice,
          priceDeviationPct,
          verified: Boolean(resolved.quote),
          confidence: resolved.quote ? conf : 'low',
          notes: row.notes || '',
        };
      })
  );

  // Deduplicate exact overlapping rows across adjacent scrolling screenshots
  const seenKeys = new Set<string>();
  const deduplicated: ParsedScreenshotHolding[] = [];
  for (const item of resolvedList) {
    const key = `${item.resolvedSymbol}|${item.quantity}|${item.avgBuyPrice}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduplicated.push(item);
  }

  return {
    brokerDetected: brokers.join(' / ') || 'Broker Screenshot',
    holdings: deduplicated,
    warnings: allWarnings,
  };
}
