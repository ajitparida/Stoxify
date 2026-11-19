import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  getChart,
  getQuotes,
  searchIndianStocks,
} from './server/marketService.ts';
import {
  getEnrichedResearchSignals,
  getEnrichedScreenerUniverse,
  getPatternDiscoveryHub,
} from './server/confidenceEngineService.ts';
import { parsePortfolioScreenshots, type ScreenshotInput } from './server/screenshotParser.ts';
import {
  analyzePortfolioHoldings,
  analyzeSingleSymbolOutlook,
  type HoldingAnalysisInput,
} from './server/portfolioAnalyzer.ts';
import {
  analyzeMutualFundPortfolio,
  searchMutualFunds,
} from './server/mutualFundService.ts';
import {
  generateMfSwitchAdvice,
  parseMutualFundImport,
  type MfImportFileInput,
} from './server/mutualFundAiService.ts';
import { parseMutualFundCsv, parseStockPortfolioCsv } from './server/csvParser.ts';
import {
  generateCapitalRotation,
  getAiStrategyBaskets,
} from './server/capitalRotationService.ts';
import {
  compileAlgoStrategyFromPrompt,
  evaluateLivePaperStrategies,
  runHistoricalBacktest,
} from './server/algoEngineService.ts';
import type {
  AlgoOrderRecord,
  AlgoStrategyDraft,
  AlgoStrategyRecord,
  AnalyzedMutualFund,
  ChartRange,
  MutualFundHoldingRecord,
  MutualFundSummaryMetrics,
} from './src/types/market.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const VALID_RANGES = new Set<ChartRange>(['1d', '5d', '1mo', '6mo', '1y', '3y', '5y', 'max']);

function formatRouteError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (/429|RESOURCE_EXHAUSTED|quota|rate[-_\s]?limit|retryDelay/i.test(raw)) {
    return 'Gemini free-tier daily quota (20 requests/day) reached. Use Zerodha Kite / Coin CSV upload (uses 0 AI quota), or add a billing-enabled Gemini API key in Settings > Secrets.';
  }
  return raw || fallback;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/market/quotes', async (req, res) => {
    try {
      const raw = String(req.query.symbols ?? '');
      const symbols = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 250);

      if (symbols.length === 0) {
        res.json({ quotes: {} });
        return;
      }

      const quotes = await getQuotes(symbols);
      res.json({ quotes, fetchedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Quotes endpoint error:', error);
      res.status(500).json({ error: 'Failed to fetch market quotes.' });
    }
  });

  app.get('/api/market/chart/:symbol', async (req, res) => {
    try {
      const symbol = decodeURIComponent(req.params.symbol || '');
      const requestedRange = String(req.query.range ?? '6mo') as ChartRange;
      const range: ChartRange = VALID_RANGES.has(requestedRange) ? requestedRange : '6mo';

      const data = await getChart(symbol, range);
      if (!data) {
        res.status(404).json({ error: `No chart data found for ${symbol}` });
        return;
      }
      res.json(data);
    } catch (error) {
      console.error('Chart endpoint error:', error);
      res.status(500).json({ error: 'Failed to fetch chart history.' });
    }
  });

  app.get('/api/market/search', async (req, res) => {
    try {
      const q = String(req.query.q ?? '');
      const results = await searchIndianStocks(q);
      res.json({ results });
    } catch (error) {
      console.error('Search endpoint error:', error);
      res.status(500).json({ error: 'Failed to search Indian equities.' });
    }
  });

  app.get('/api/market/screener', async (_req, res) => {
    try {
      const stocks = await getEnrichedScreenerUniverse();
      res.json({ stocks, fetchedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Screener endpoint error:', error);
      res.status(500).json({ error: 'Failed to load screener data.' });
    }
  });

  app.get('/api/market/patterns', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const data = await getPatternDiscoveryHub(forceRefresh);
      res.json(data);
    } catch (error) {
      console.error('Patterns discovery endpoint error:', error);
      res.status(500).json({ error: 'Failed to compute pattern discovery & walk-forward stats.' });
    }
  });

  app.get('/api/market/signals', async (_req, res) => {
    try {
      const signals = await getEnrichedResearchSignals();
      res.json({ signals, fetchedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Signals endpoint error:', error);
      res.status(500).json({ error: 'Failed to load research signals.' });
    }
  });

  app.get('/api/market/ai-outlook/:symbol', async (req, res) => {
    try {
      const symbol = decodeURIComponent(req.params.symbol || '').trim();
      if (!symbol) {
        res.status(400).json({ error: 'A valid market symbol is required.' });
        return;
      }

      const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const outlook = await analyzeSingleSymbolOutlook(symbol, { forceRefresh });
      res.json(outlook);
    } catch (error) {
      console.error('Symbol AI outlook endpoint error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to generate AI outlook for symbol.';
      const status = /no live market quote available/i.test(message) ? 404 : 500;
      res.status(status).json({
        error: status === 404 ? message : formatRouteError(error, message),
      });
    }
  });

  app.get('/api/strategies', async (_req, res) => {
    try {
      const data = await getAiStrategyBaskets();
      res.json(data);
    } catch (error) {
      console.error('AI strategies endpoint error:', error);
      res.status(500).json({
        error: formatRouteError(error, 'Failed to load AI stock strategies.'),
      });
    }
  });

  app.post('/api/algo/compile', async (req, res) => {
    try {
      const body = req.body as { prompt?: string };
      const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
      if (prompt.length < 6) {
        res.status(400).json({
          error: 'Describe your trading rules in plain English (e.g. RSI, moving averages, stop-loss, and target).',
        });
        return;
      }

      const compiled = await compileAlgoStrategyFromPrompt(prompt);
      res.json(compiled);
    } catch (error) {
      console.error('Algo compile endpoint error:', error);
      res.status(500).json({
        error: formatRouteError(error, 'Failed to compile algorithmic strategy rules.'),
      });
    }
  });

  app.post('/api/algo/backtest', async (req, res) => {
    try {
      const body = req.body as { strategy?: AlgoStrategyDraft };
      if (!body?.strategy || !Array.isArray(body.strategy.symbols) || body.strategy.symbols.length === 0) {
        res.status(400).json({
          error: 'Strategy parameters and at least one target NSE/BSE symbol are required.',
        });
        return;
      }

      const result = await runHistoricalBacktest(body.strategy);
      res.json(result);
    } catch (error) {
      console.error('Algo backtest endpoint error:', error);
      const message = error instanceof Error ? error.message : 'Failed to run historical backtest.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/algo/paper-evaluate', async (req, res) => {
    try {
      const body = req.body as {
        strategies?: AlgoStrategyRecord[];
        orders?: AlgoOrderRecord[];
      };
      const strategies = Array.isArray(body?.strategies) ? body.strategies.slice(0, 50) : [];
      const orders = Array.isArray(body?.orders) ? body.orders.slice(0, 500) : [];

      if (strategies.length === 0) {
        res.json({
          newOrders: [],
          strategyStatusUpdates: [],
          openPositions: [],
          strategyTelemetry: [],
          evaluatedAt: new Date().toISOString(),
        });
        return;
      }

      const evaluation = await evaluateLivePaperStrategies(strategies, orders);
      res.json(evaluation);
    } catch (error) {
      console.error('Algo paper-evaluate endpoint error:', error);
      res.status(500).json({
        error: formatRouteError(error, 'Failed to evaluate live paper-trading strategies.'),
      });
    }
  });

  app.post('/api/portfolio/parse-screenshot', async (req, res) => {
    try {
      const body = req.body as { images?: ScreenshotInput[] };
      const images = Array.isArray(body?.images) ? body.images : [];
      if (images.length === 0 || images.length > 15) {
        res.status(400).json({ error: 'Please upload between 1 and 15 portfolio screenshots.' });
        return;
      }

      const validImages = images.filter(
        (img) => typeof img.data === 'string' && img.data.length > 20
      );
      if (validImages.length === 0) {
        res.status(400).json({ error: 'Uploaded screenshot payload is invalid.' });
        return;
      }

      const parsed = await parsePortfolioScreenshots(validImages);
      res.json(parsed);
    } catch (error) {
      console.error('Screenshot parse error:', error);
      res.status(500).json({
        error: formatRouteError(error, 'Failed to parse portfolio screenshot.'),
      });
    }
  });

  app.post('/api/portfolio/parse-csv', async (req, res) => {
    try {
      const body = req.body as { csvText?: string; fileName?: string };
      const csvText = typeof body?.csvText === 'string' ? body.csvText : '';
      if (csvText.trim().length < 10) {
        res.status(400).json({ error: 'Please upload a valid Zerodha Kite or broker CSV file.' });
        return;
      }

      const parsed = await parseStockPortfolioCsv(csvText, body?.fileName);
      res.json(parsed);
    } catch (error) {
      console.error('Stock CSV parse error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to parse equity CSV file.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/portfolio/analyze', async (req, res) => {
    try {
      const body = req.body as {
        holdings?: HoldingAnalysisInput[];
        totalPortfolioValue?: number;
        skipPortfolioSummary?: boolean;
      };
      const holdings = Array.isArray(body?.holdings) ? body.holdings.slice(0, 250) : [];
      if (holdings.length === 0) {
        res.status(400).json({ error: 'At least one holding is required for AI analysis.' });
        return;
      }

      const analysis = await analyzePortfolioHoldings(holdings, {
        totalPortfolioValue:
          typeof body?.totalPortfolioValue === 'number' ? body.totalPortfolioValue : undefined,
        skipPortfolioSummary: Boolean(body?.skipPortfolioSummary),
      });
      res.json(analysis);
    } catch (error) {
      console.error('Portfolio AI analysis error:', error);
      res.status(500).json({
        error: formatRouteError(error, 'Failed to evaluate portfolio holdings.'),
      });
    }
  });

  app.post('/api/portfolio/rotation', async (req, res) => {
    try {
      const body = req.body as { holdings?: HoldingAnalysisInput[] };
      const holdings = Array.isArray(body?.holdings) ? body.holdings.slice(0, 250) : [];
      if (holdings.length === 0) {
        res.status(400).json({
          error: 'At least one equity holding is required to scan Smart Capital Rotation.',
        });
        return;
      }

      const rotation = await generateCapitalRotation(holdings);
      res.json(rotation);
    } catch (error) {
      console.error('Capital rotation endpoint error:', error);
      res.status(500).json({
        error: formatRouteError(error, 'Failed to compute Smart Capital Rotation.'),
      });
    }
  });

  app.get('/api/mf/search', async (req, res) => {
    try {
      const q = String(req.query.q ?? '');
      const results = await searchMutualFunds(q);
      res.json({ results });
    } catch (error) {
      console.error('MF search endpoint error:', error);
      res.status(500).json({ error: 'Failed to search AMFI mutual fund schemes.' });
    }
  });

  app.post('/api/mf/analyze', async (req, res) => {
    try {
      const body = req.body as {
        holdings?: MutualFundHoldingRecord[];
        taxSlabPct?: number;
        ltcgExemptionRemaining?: number;
      };
      const holdings = Array.isArray(body?.holdings) ? body.holdings.slice(0, 250) : [];
      const result = await analyzeMutualFundPortfolio({
        holdings,
        taxSlabPct: typeof body?.taxSlabPct === 'number' ? body.taxSlabPct : 30,
        ltcgExemptionRemaining:
          typeof body?.ltcgExemptionRemaining === 'number'
            ? body.ltcgExemptionRemaining
            : 125000,
      });
      res.json(result);
    } catch (error) {
      console.error('MF analyze endpoint error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to analyze mutual fund holdings.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/mf/parse-import', async (req, res) => {
    try {
      const body = req.body as { files?: MfImportFileInput[]; rawText?: string };
      const files = Array.isArray(body?.files) ? body.files.slice(0, 15) : [];
      const rawText = typeof body?.rawText === 'string' ? body.rawText.trim() : '';

      if (files.length === 0 && rawText.length < 15) {
        res.status(400).json({
          error: 'Upload up to 15 screenshots or a CAS PDF, or paste your CAS summary text.',
        });
        return;
      }

      const validFiles = files.filter((f) => typeof f.data === 'string' && f.data.length > 20);
      const parsed = await parseMutualFundImport({ files: validFiles, rawText });
      res.json(parsed);
    } catch (error) {
      console.error('MF parse-import endpoint error:', error);
      res.status(500).json({
        error: formatRouteError(error, 'Failed to parse mutual fund statement.'),
      });
    }
  });

  app.post('/api/mf/parse-csv', async (req, res) => {
    try {
      const body = req.body as { csvText?: string; fileName?: string };
      const csvText = typeof body?.csvText === 'string' ? body.csvText : '';
      if (csvText.trim().length < 10) {
        res.status(400).json({
          error: 'Please upload a valid Zerodha Coin / Kite Mutual Fund CSV file.',
        });
        return;
      }

      const parsed = await parseMutualFundCsv(csvText, body?.fileName);
      res.json(parsed);
    } catch (error) {
      console.error('MF CSV parse error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to parse mutual fund CSV file.';
      res.status(400).json({ error: message });
    }
  });


  app.post('/api/mf/ai-switch-advice', async (req, res) => {
    try {
      const body = req.body as {
        funds?: AnalyzedMutualFund[];
        summary?: MutualFundSummaryMetrics;
      };
      const funds = Array.isArray(body?.funds) ? body.funds.slice(0, 250) : [];
      if (funds.length === 0 || !body?.summary) {
        res.status(400).json({ error: 'Analyzed mutual fund data is required.' });
        return;
      }

      const advice = await generateMfSwitchAdvice({
        funds,
        summary: body.summary,
      });
      res.json(advice);
    } catch (error) {
      console.error('MF AI switch advice error:', error);
      res.status(500).json({
        error: formatRouteError(error, 'Failed to generate AI switch strategy.'),
      });
    }
  });

  const distPath = path.resolve(process.cwd(), 'dist');
  const distIndexPath = path.join(distPath, 'index.html');
  const runningCompiledServer = Boolean(process.argv[1]?.endsWith('server.js'));
  const serveBuiltAssets =
    process.env.NODE_ENV === 'production' ||
    (runningCompiledServer && fs.existsSync(distIndexPath));

  if (serveBuiltAssets) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Stoxify server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
