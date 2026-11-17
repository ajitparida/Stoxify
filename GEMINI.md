# GEMINI.md — Stoxify Developer & AI Agent Architecture Guide

This document is the canonical engineering reference for AI coding agents and developers modifying **Stoxify**. Follow every architectural invariant, naming convention, resilience pattern, and verification step documented below.

---

## 1. Core Architectural & Runtime Invariants

1. **Full-Stack Single-Port Runtime (`server.ts`)**:
   - The application runs a single Express server on port `3000` (`0.0.0.0:3000`).
   - In development (`npm run dev` via `tsx server.ts`), `server.ts` creates a Vite server in `middlewareMode: true` and attaches `vite.middlewares`.
   - In production (`NODE_ENV=production`), `server.ts` serves static assets from `dist/`.
   - **Rule**: Never add Express middleware or API handlers inside `vite.config.ts`, and never modify the `DISABLE_HMR` guards in `vite.config.ts`.
2. **Server-Side Secrets & API Boundaries**:
   - `GEMINI_API_KEY` must ONLY ever be read on the backend (`server/*.ts`). Never expose Gemini keys or client-side AI SDK calls in `src/`.
   - All `@google/genai` clients MUST pass `httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }`.
   - Maintain `"majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]` in `metadata.json`.
3. **Brand Identity & Removed Features (Do Not Re-introduce)**:
   - The app name is **Stoxify**. Never reference legacy or third-party advisor names (`PulseVest`, `Univest`, `ETMoney`).
   - PAN Card CAS Sync and Gmail OAuth CAS Auto-Fetch were intentionally removed (`gmail.readonly` OAuth was revoked). Do not re-add PAN inputs or Gmail OAuth flows unless explicitly requested by the user.
4. **TypeScript & Styling Rules**:
   - `tsconfig.json` uses `"allowImportingTsExtensions": true` with `"noEmit": true`. Server imports in `server.ts` and `server/*.ts` use explicit `.ts` extensions; frontend imports omit extensions cleanly via Vite bundler resolution.
   - Global Tailwind CSS v4 is imported in `src/index.css` via `@import "tailwindcss";`. Avoid inline styles and separate component CSS files.
   - Use `.font-mono-tabular` for prices, percentages, quantities, NAVs, P&L values, and forecasts.
   - Keep action buttons single-line (`whitespace-nowrap shrink-0`), avoid static pill/capsule badges (`rounded-full`) on status metadata, and avoid thick `border-l-4` accent strips.

---

## 2. Backend Architecture (`server.ts` & `server/*.ts`)

### Entry Point: `/server.ts`
- Configures `express.json({ limit: '64mb' })` to accommodate multi-image base64 screenshots and CAS PDFs.
- Exposes `formatRouteError(err, fallback)` which translates `429` / `RESOURCE_EXHAUSTED` quota errors into actionable user messages (pointing to zero-quota Zerodha Kite/Coin CSV uploads or billing-enabled Gemini keys).
- All 17 `/api/*` endpoints delegate cleanly to dedicated service modules in `server/`.

### Service Modules (`server/`)

| File | Responsibility | Key Exports | Caching / Limits |
| :--- | :--- | :--- | :--- |
| **`marketService.ts`** | Live Yahoo Finance v8 fetches, technical indicator math (`computeSMA`, `computeEMA`, `computeRSI14`), symbol resolution (`resolveSymbolForScreenshot`), stock search, screener & signals. | `getQuotes`, `getChart`, `searchIndianStocks`, `getScreenerUniverse`, `getLiveResearchSignals`, `resolveSymbolForScreenshot` | `quoteCache` (`25s`), `chartCache` (`180s`), `searchCache` (`300s`). |
| **`indianMarketCatalog.ts`** | Authoritative Indian equity universe (`INDIAN_STOCK_UNIVERSE`, `INDIAN_INDICES`, `RESEARCH_SIGNAL_TEMPLATES`) with aliases, sectors, cap categories, ROCE, P/E, and D/E metadata. | `INDIAN_INDICES`, `INDIAN_STOCK_UNIVERSE`, `RESEARCH_SIGNAL_TEMPLATES` | Static in-memory lookup map. |
| **`portfolioAnalyzer.ts`** | Single-symbol AI Outlook (`MarketChartTerminal`) and batched equity portfolio evaluation (`HealthDiagnosticsView`). Applies `applyGuardrails` (beta-calibrated targets & stops + 200-DMA conflict flags) and `buildStockProjection` (`6M`, `1Y`, `5Y`, `10Y`). | `analyzePortfolioHoldings`, `analyzeSingleSymbolOutlook`, `HoldingAnalysisInput` | `STOCK_AI_BATCH_SIZE = 40`, `AI_BATCH_CONCURRENCY = 2`, `SYMBOL_OUTLOOK_TTL_MS = 10 min` (`symbolOutlookCache`). |
| **`screenshotParser.ts`** | Multi-image Gemini Vision extraction for equity broker screenshots, validating quantities, avg buy prices, and LTP against live exchange quotes. | `parsePortfolioScreenshots`, `ScreenshotInput` | Max `15` images per request. |
| **`csvParser.ts`** | Deterministic CSV/TSV parser (`parseCsvGrid` with BOM stripping & delimiter auto-detection). Supports Zerodha Kite equity CSV and Zerodha Coin MF CSV with zero Gemini quota usage. | `parseStockPortfolioCsv`, `parseMutualFundCsv`, `parseCsvGrid` | Concurrent symbol/AMFI resolution with bounded concurrency. |
| **`mutualFundService.ts`** | Live AMFI NAV history (`api.mfapi.in`), Yahoo benchmark series, XIRR Newton-Raphson solver, FIFO lot tax classification (STCG vs. LTCG ₹1.25L exemption), tiered exit loads, Direct vs. Regular fee bleed, and peer switch scoring. | `searchMutualFunds`, `analyzeMutualFundPortfolio`, `fetchMfSchemeSeries` | `schemeCache`, `searchCache`, `benchmarkCache`. |
| **`schemeMetadataCatalog.ts`** | Mutual fund TER ratios (Direct vs. Regular) and tiered exit-load window evaluator. | `resolveSchemeCostProfile`, `evaluateTieredExitLoadPct` | Static rule catalog. |
| **`mutualFundAiService.ts`** | Gemini Vision/PDF extraction for CAS PDFs/MF app screenshots + AI Switch Strategy generator with quantitative fallback and `6M / 1Y / 5Y / 10Y` wealth projections. | `parseMutualFundImport`, `generateMfSwitchAdvice`, `MfImportFileInput` | Falls back to quantitative advice cleanly on `429`/quota exhaustion. |
| **`capitalRotationService.ts`** | Smart Capital Rotation engine (pairs `TRIM_PROFIT` / `EXIT_LAGGARD` equity holdings with undervalued high-ROCE NSE candidates) and 4 quantitative AI Strategy baskets benchmarked against Nifty 50. | `generateCapitalRotation`, `getAiStrategyBaskets` | `STRATEGY_TTL_MS = 5 min` (`strategyCache`); falls back cleanly on `429`/quota exhaustion. |

---

## 3. Gemini AI Patterns & Quota Resilience

Every Gemini-powered service module MUST follow this resilient pattern:

1. **Valid Model Cascade**:
   - Primary: `gemini-4-hydrogen` (`thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }`)
   - Fallback: `gemini-3.1-flash-lite` (`thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }`)
   - Strict JSON output via `responseMimeType: 'application/json'` and `responseSchema`.
2. **Mandatory Quantitative Fallback (`429` & Transient Error Safety)**:
   - `portfolioAnalyzer.ts` (`analyzePortfolioHoldings`, `analyzeSingleSymbolOutlook`) and `mutualFundAiService.ts` (`generateMfSwitchAdvice`) MUST never fail the UI on Gemini free-tier daily quota (`20 RPD` / `RESOURCE_EXHAUSTED`) or missing `GEMINI_API_KEY`.
   - When Gemini fails or `GEMINI_API_KEY` is absent, return deterministic quantitative results (`analysisSource: 'fallback_engine'` + `quotaNotice`) computed from real live market quotes / AMFI NAV telemetry.
   - `applyGuardrails()` must always wrap stock ratings/outlooks so `suggestedTarget`, `suggestedStopLoss`, and `HorizonProjection` (`value6M`, `value1Y`, `value5Y`, `value10Y` + percentages) are mathematically consistent.
3. **CSV First Recommendation**:
   - `screenshotParser.ts` and CAS PDF parsing require multimodal Gemini inference (`gemini-4-hydrogen` -> `gemini-3.1-flash-lite`). On `429`, return a clear error advising Zerodha Kite / Coin CSV upload (`0` AI quota).

---

## 4. Frontend Architecture (`src/`)

### Entry & Shared Types
- **`src/types/market.ts`**: Single source of truth for all frontend & backend types (`HoldingRecord`, `MarketQuote`, `ChartResponse`, `HorizonProjection`, `HoldingAiRating`, `PortfolioAnalysisResponse`, `SymbolAiOutlook`, `MutualFundHoldingRecord`, `AnalyzedMutualFund`, `MfAiSwitchAdviceResponse`, etc.). Always import server types from `../src/types/market.ts` rather than duplicating interfaces.
- **`src/utils/portfolioAnalytics.ts`**: Client-side enrichment (`enrichHoldings`, `computePortfolioDiagnostics`), Indian currency & compact formatting (`formatINR`, `formatPercent`, `formatVolume`), and opt-in demo datasets (`SAMPLE_HOLDINGS`, `SAMPLE_MF_HOLDINGS`, `DEFAULT_WATCHLIST_SYMBOLS`).

### Root Orchestrator: `/src/App.tsx`
- **Navigation Groups (`NAV_GROUPS`)**:
  - Top: `overview` (**Overview**)
  - `Portfolios`: `portfolio` (**Equity Holdings**), `mutualFunds` (**Mutual Funds Pro**), `diagnostics` (**Health Diagnostics**)
  - `Market Intelligence`: `charts` (**Live Market Charts**), `screener` (**Pro Stock Screener**), `signals` (**Research Signals**), `strategies` (**AI Strategies**)
- **Workspace Persistence State**:
  - Starts with empty arrays (`guestHoldings = []`, `guestMutualFunds = []`) until user adds positions, imports CSV/screenshots, or clicks **Pre-load Demo**.
  - On verified Google Sign-In (`onAuthStateChanged`), subscribes to `subscribeHoldings`, `subscribeWatchlist`, and `subscribeMutualFunds`.
- **Multi-Batch Stock AI Audit Orchestration**:
  - Splits holdings >40 into chunks of 40 and posts sequentially/progressively to `/api/portfolio/analyze` with `totalPortfolioValue` and `skipPortfolioSummary: batchIdx > 0`, updating `aiBatchProgress` so users can evaluate arbitrarily large portfolios.
- **Chart Navigation Bridge**:
  - `openChartForSymbol(symbol, levels?)` sets `selectedChartSymbol`, optionally sets `chartOverlays` (`ChartOverlayLevels`), and switches `activeTab` to `'charts'`.

### Key View Components (`src/components/`)
- **`OverviewDashboardView.tsx`**: Combined Equity + MF net worth KPIs, allocation split, quick demo/import onboarding when empty, benchmark strip, and watchlist actions.
- **`PortfolioView.tsx`**: Equity holdings table with search, multi-criteria filtering, column sorting (`SortableTh`), manual/CSV/screenshot import triggers, edit/delete, **Pre-load Demo**, and **Clear All** confirmation modal trigger.
- **`MutualFundsView.tsx`**: AMFI-synced MF table with sorting/filtering, tax slab (`taxSlabPct`) & LTCG exemption inputs, FIFO & exit-load drilldown, AI Switch Strategy panel with 6M/1Y/5Y/10Y projections, **Pre-load Demo**, and **Clear All**.
- **`HealthDiagnosticsView.tsx`**: Portfolio risk diagnostics + Batched AI Portfolio Audit UI displaying `HorizonProjection` (`6M · 1Y · 5Y · 10Y`), verdicts, targets, stops, guardrail status, and Smart Capital Rotation paired trim/exit -> undervalued replacement cards.
- **`MarketChartTerminal.tsx`**:
  - Charts `1D / 1W / 1M / 6M / 1Y` OHLCV data + `EMA 20` / `SMA 50` + volume bar histogram.
  - Integrates the **AI Outlook** panel: auto-fetches `/api/market/ai-outlook/:symbol` ONLY on `symbol` changes (uses `AbortController` + `outlookRequestIdRef` guard + client `outlookCacheRef` Map so timeframe changes never trigger duplicate AI calls).
  - Supports plotting AI Target & Stop-Loss lines onto the `ComposedChart` (`Plot Target / SL` toggle merged cleanly with `overlayLevels` prop).
- **`ProScreenerView.tsx`, `ResearchSignalsView.tsx` & `AiStrategiesView.tsx`**: Preset filtering, multi-column sorting (`SortableTh`), signal cards, 4 Nifty-benchmarked NSE factor baskets with 100-indexed Recharts curves & monthly rotation ledgers, and one-click chart plotting / watchlist / add-holding hooks.

---

## 5. Firebase / Firestore Synchronization Contract

If you modify any user-persisted document field, you MUST update all four locations together:
1. `src/types/market.ts` (`HoldingRecord`, `WatchlistRecord`, `MutualFundHoldingRecord`)
2. `src/firebase.ts` (sanitization helpers, `create*`, `update*`, `batchCreate*`)
3. `firebase-blueprint.json` (JSON Schema entities & required arrays)
4. `firestore.rules` (validation helper functions & `affectedKeys().hasOnly(...)` update allowlists)

**Critical Firestore Rule Details (`firestore.rules`)**:
- `isValidHolding`: `source` must be `'manual' | 'screenshot' | 'signal'`. Updates may only modify `['quantity', 'avgBuyPrice', 'buyDate', 'notes', 'sector', 'updatedAt']` (`symbol`, `exchange`, `source`, `id`, `userId`, `createdAt` are immutable).
- `isValidWatchlistItem`: Updates may only modify `['targetAlertPrice', 'sector', 'updatedAt']`.
- `isValidMutualFundHolding`: `schemeCode` must match `^[0-9]+$` (`1–16` digits), `planType` in `['Direct', 'Regular']`, `optionType` in `['Growth', 'IDCW']`, `source` in `['manual', 'screenshot', 'cas_pdf']`. Updates may only modify `['units', 'avgNav', 'purchaseDate', 'isSip', 'monthlySipAmount', 'folioNumber', 'updatedAt']`.
- Whenever `firestore.rules` is modified, validate with ESLint (`@firebase/eslint-plugin-security-rules`) and deploy rules via Firebase tooling.

---

## 6. Verification Checklist After Edits

Before concluding any code change:
1. Run TypeScript & build verification together:
   - `npm run build` (`vite build`)
   - `npm run lint` (`tsc --noEmit`)
2. If any `server.ts` or `server/*.ts` code changed, restart the dev server (`tsx server.ts` on port `3000`) and smoke-test modified `/api/*` routes via `fetch` to verify HTTP `200` and schema conformance (both normal stocks e.g. `RELIANCE.NS` and indices e.g. `^NSEI` where applicable).
