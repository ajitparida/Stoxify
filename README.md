# Stoxify — Indian Equity & Mutual Fund Portfolio Terminal

**Stoxify** is a full-stack Indian market analytics platform for NSE/BSE equities and AMFI-tracked mutual funds. It combines live market quotes and fundamentals, interactive multi-year technical charting, broker CSV/screenshot imports, an evidence-backed 0–100% Rule Confidence Engine with 24-month walk-forward backtesting, algorithmic paper-trading & risk controls, mutual fund direct-switch & tax optimization, and Gemini-powered investment outlooks with a deterministic quantitative fallback engine.

---

## Key Features

### 1. Unified Overview & Portfolio Workspace
- **Guest & Cloud Sync Modes**: Explore immediately in guest mode or sign in with Google (Firebase Auth) to persist equities, mutual funds, and watchlists in real time via Cloud Firestore.
- **Empty-State Onboarding & Demo Controls**: Starts clean with one-click **Pre-load Demo** actions (for Equities and Mutual Funds) and confirmation-gated **Clear All** reset controls.
- **Consolidated Wealth Snapshot**: Combines equity and mutual fund invested capital, current value, day change, unrealized P&L, Nifty 50 / Sensex / Bank Nifty live strip, and sector/asset allocation breakdowns.

### 2. Equity Holdings (`PortfolioView`)
- **Live NSE/BSE Pricing**: Server-backed Yahoo Finance quote polling (`25s` cache TTL) with configurable auto-refresh toggle.
- **Zero-Quota CSV Import**: Parse Zerodha Kite (`holdings.csv`) and generic broker equity CSV exports deterministically with zero Gemini quota usage.
- **AI Screenshot Parser**: Upload up to 15 broker portfolio screenshots (Kite, Groww, Upstox, Angel One, INDmoney, etc.) parsed via Gemini Vision (`@google/genai`).
- **Sortable & Filterable Table**: Multi-column sorting (`SortableTh`), search, exchange, sector, cap-size, and P&L status filtering.

### 3. Mutual Funds Pro (`MutualFundsView`)
- **AMFI Live NAV & History (`api.mfapi.in`)**: Resolves 6-digit AMFI scheme codes, historical NAV series, rolling returns, benchmark comparison, Sharpe ratio proxies, and XIRR calculations.
- **FIFO Tax & Tiered Exit-Load Engine**: Evaluates Short-Term vs. Long-Term Capital Gains (`taxSlabPct` and remaining ₹1.25L LTCG exemption), scheme-specific exit-load free dates, and Direct vs. Regular expense ratio (TER) drag.
- **Zero-Quota Zerodha Coin CSV & CAS/Screenshot Import**: Supports deterministic Coin CSV parsing alongside AI-assisted screenshot/CAS PDF parsing.
- **AI Switch Strategy & Multi-Horizon Forecasts**: Recommends `HOLD`, `SWITCH_TO_DIRECT`, or `SWITCH_PEER` with timing verdicts (`SWITCH_NOW`, `WAIT_EXIT_LOAD`, `STAGGER_FOR_LTCG`, `HOLD_STEADY`) and **6M, 1Y, 5Y, and 10Y CAGR** value projections.

### 4. Health Diagnostics, Calibrated Audit & Index Hedge Calculator (`HealthDiagnosticsView`, `PortfolioHedgeCalculator`)
- **Dead-Stock & Concentration Diagnostics**: Flags laggards trailing Nifty 50 below the 200-DMA, computes portfolio weighted beta, market-cap distribution, and sector weights.
- **Batched Calibrated Portfolio Audit**: Chunks large portfolios into server batches of up to 40 unique holdings with concurrency `2`, attaching a deterministic **0–100% 4-Pillar Confidence Score** (Trend 30% · RS vs Nifty 25% · Momentum 20% · Fundamentals 25%), live Yahoo fundamentals, and upcoming earnings risk tags to every holding.
- **Volatility-Calibrated Guardrails & Horizon Forecasts**: Clamps suggested targets and stop-loss levels relative to stock beta (`β`) and 50/200-DMA support, flagging trend conflicts and outputting per-stock and capital-weighted **6M / 1Y / 5Y / 10Y** projections.
- **80/20 Cash Reserve Check & Bear Put Spread Hedge Calculator**: Compares live deployed equity against user cash reserves (`80% Equity / 20% Reserve` guideline) and sizes illustrative **NIFTY 50 (`^NSEI`) / MIDCPNIFTY (`^NSEMDCP50`) Bear Put Spreads** with beta-adjusted lots, NSE strike rounding, estimated spread debit, and `-5% / -10% / -15%` crash stress comparisons.

### 5. Live Market Charts & Evidence-Backed AI Outlook (`MarketChartTerminal`)
- **Interactive Multi-Year Price & Volume Terminal**: Recharts `ComposedChart` across `1D`, `1W`, `1M`, `6M`, `1Y`, `3Y`, `5Y`, and `All` (`max`) timeframes with `EMA 20`, `SMA 50`, RSI-14, 52-week range gauge, and 20-day volume ratio telemetry.
- **Integrated `AI Outlook` with 4-Pillar Confidence & Live Fundamentals**: Automatically fetches single-symbol analysis for any searched NSE/BSE stock or index (`^NSEI`, `^BSESN`, `^NSEBANK`, `RELIANCE.NS`, `PAYTM.NS`, etc.), displaying the **0–100% Calibrated Confidence Breakdown**, live **Trailing/Forward P/E, ROE/ROCE, Revenue/Earnings Growth, D/E, and Next Results Date** (with earnings proximity alerts), `BUY`/`HOLD`/`EXIT` thesis, Target/Stop-Loss levels, and **6M / 1Y / 5Y / 10Y** forecasts.
- **Chart Level Overlays**: One-click **Plot Target / SL** toggle draws predicted Target and Stop-Loss reference lines directly onto the chart (alongside Avg Buy Cost when inspecting from a portfolio holding).

### 6. Pattern Discovery Hub, Pro Screener, Research Signals & AI Strategies (`ProScreenerView`, `PatternDiscoveryHub`, `ResearchSignalsView`, `AiStrategiesView`)
- **Illustrated 6-Pattern Discovery Hub & Walk-Forward Validation**: Displays 6 custom SVG schematic cards (*High confidence*, *Fresh upward move*, *Steady upward trend*, *Strong stocks on a dip*, *Healthy momentum reset*, *Higher fundamental confidence*) with live match counts, 24-month point-in-time NSE walk-forward **1M & 3M win rates and average returns**, table-filter controls, and a **Monthly Shortlist Timeline Modal** showing monthly cohorts, realized 1M returns, and earnings volatility banners.
- **Calibrated Pro Stock Screener**: Presets (`all`, `golden_crossover`, `volume_shockers`, `multibagger_value`, `oversold_rebound`, `top_gainers`) plus pattern filtering, default **Confidence %** sorting with inline expandable 4-pillar breakdowns, live Yahoo P/E & ROE columns, and upcoming earnings alerts.
- **Evidence-Backed Research Signals**: Live swing, positional, and long-term setups displaying calibrated 4-pillar Confidence bars, matched pattern walk-forward **1M/3M historical win rates**, earnings risk flags, and one-click chart level plotting.
- **AI Quantitative Stock Strategies & Smart Capital Rotation**: 4 live NSE model baskets (*Bharat Momentum Leaders*, *Undervalued Compounders*, *Domestic Capex & Mid-Cap Alpha*, *Quality Value & Low-Beta Shield*) benchmarked against Nifty 50 (`^NSEI`), plus paired `TRIM_PROFIT` / `EXIT_LAGGARD` capital rotation recommendations.

### 7. Algo Trading, Historical Backtesting & Risk Overview (`AlgoTradingView`, `AlgoRiskOverview`)
- **AI Natural-Language Strategy Compiler**: Converts plain-English strategy ideas into structured, editable technical predicates (`RSI_14`, `PRICE_VS_SMA50`, `PRICE_VS_SMA200`, `EMA20_VS_SMA50`, `VOLUME_RATIO`, `DAY_CHANGE_PCT`, `SMA50_SLOPE_PCT`) via Gemini with deterministic regex/rule-parser fallback.
- **Historical OHLCV Backtester**: Simulates multi-symbol bar-by-bar execution over warmed-up `1D / 5D / 1M / 6M / 1Y` Yahoo Finance OHLCV candles, outputting an indexed Equity Curve vs. Nifty 50 (`^NSEI`), Drawdown chart, Sharpe ratio, Max Drawdown, Win Rate, Profit Factor, and trade-by-trade execution ledger.
- **Live Paper-Trade Engine & Risk Overview Kill-Switch**: Evaluates active bots against live NSE prices (`Scan Live Ticks` + 30s auto-scan toggle) with per-trade Stop-Loss, Take-Profit, Trailing Stop, Max Open Positions, Daily Loss Cap Circuit-Breakers (`PAUSED_RISK_CAP`), a visual **Daily Loss Cap vs. Current Day PnL** risk gauge, and an emergency **Halt All Bots** kill-switch synced to Cloud Firestore.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Recharts 3, Lucide React, Motion |
| **Backend** | Node.js, Express 4, `tsx`, `dotenv` |
| **AI & Analytics** | `@google/genai` (`gemini-4-hydrogen` primary, `gemini-3.1-flash-lite` fallback) + quantitative projection engine |
| **Market & MF Data** | Yahoo Finance v8 Chart/Quote & authenticated v10 `quoteSummary` (live fundamentals & earnings dates), AMFI `api.mfapi.in`, curated `indianMarketCatalog.ts` & `schemeMetadataCatalog.ts` |
| **Auth & Persistence** | Firebase Authentication (Google Sign-In) & Cloud Firestore (`firebase-applet-config.json`) |

---

## Project Structure

```text
.
├── server.ts                          # Express HTTP server + Vite dev middleware (port 3000)
├── metadata.json                      # App manifest & server-side Gemini capability declaration
├── .env.example                       # Environment variable template (GEMINI_API_KEY, APP_URL)
├── firebase-applet-config.json        # Firebase project & database configuration
├── firebase-blueprint.json            # Canonical entity schemas for Firestore collections
├── firestore.rules                    # Strict owner-only & schema-validated Firestore security rules
├── server/
│   ├── marketService.ts               # Live NSE/BSE quotes, OHLCV charts (1D–All), SMA/EMA/RSI, search & signal base
│   ├── fundamentalsService.ts         # Authenticated Yahoo Finance v10 live fundamentals, earnings dates & 6h cache
│   ├── confidenceEngineService.ts     # Calibrated 4-pillar Confidence scorer, 6-pattern classifier & 24M walk-forward backtester
│   ├── portfolioAnalyzer.ts           # Single-symbol AI Outlook, batched portfolio audit, guardrails & 6M-10Y forecasts
│   ├── capitalRotationService.ts      # Smart Capital Rotation pairings & 4 Nifty-benchmarked NSE quantitative strategy baskets
│   ├── algoEngineService.ts           # AI strategy rule compiler, OHLCV historical backtester & live paper-trade risk evaluator
│   ├── screenshotParser.ts            # Multi-image equity broker screenshot parser via Gemini Vision
│   ├── csvParser.ts                   # Zero-AI Zerodha Kite (equity) & Zerodha Coin (MF) CSV parsers
│   ├── mutualFundService.ts           # AMFI scheme search, NAV history, XIRR, FIFO tax, tiered exit load & TER bleed
│   ├── mutualFundAiService.ts         # Gemini MF CAS/screenshot import & AI switch strategy with 6M-10Y projections
│   ├── indianMarketCatalog.ts         # NSE/BSE stock universe, indices (^NSEI, ^BSESN, ^NSEBANK, ^NSEMDCP50) & fallback metadata
│   └── schemeMetadataCatalog.ts       # Mutual fund TER ratios & tiered exit-load schedule metadata
└── src/
    ├── App.tsx                        # Main workspace state, navigation, batch orchestration & modals
    ├── firebase.ts                    # Firebase init, Google Auth & Firestore CRUD + input sanitizers
    ├── types/market.ts                # Shared TypeScript interfaces across client & server
    ├── utils/portfolioAnalytics.ts    # Portfolio enrichment, INR/percent formatters, diagnostics & demo datasets
    └── components/
        ├── OverviewDashboardView.tsx  # Unified Wealth Overview (Equities + Mutual Funds + Benchmarks + Watchlist)
        ├── PortfolioView.tsx          # Equity holdings table, sorting, filters, CSV/Screenshot upload triggers
        ├── MutualFundsView.tsx        # Mutual fund analytics, tax/exit-load settings & AI switch panel
        ├── HealthDiagnosticsView.tsx  # Dead-stock flags, beta/cap diagnostics, calibrated AI audit & rotation UI
        ├── PortfolioHedgeCalculator.tsx # 80/20 cash reserve check & live NIFTY / MIDCPNIFTY Bear Put Spread calculator
        ├── MarketChartTerminal.tsx    # Interactive Recharts price/volume terminal (1D–All) & evidence-backed AI Outlook
        ├── ProScreenerView.tsx        # Sortable/filterable NSE/BSE screener with expandable Confidence & live ratios
        ├── PatternDiscoveryHub.tsx    # Illustrated 6-pattern SVG discovery cards & Monthly Shortlist Timeline modal
        ├── ConfidenceBreakdownBar.tsx # Reusable 4-pillar Rule Confidence visualizer & EarningsRiskTag helper
        ├── ResearchSignalsView.tsx    # Evidence-backed trade signal cards with walk-forward 1M/3M win rates
        ├── AiStrategiesView.tsx       # 4 benchmarked NSE quantitative strategy baskets & rotation ledger
        ├── AlgoTradingView.tsx        # AI rule compiler, historical OHLCV backtester, live paper positions & order book
        ├── AlgoRiskOverview.tsx       # Daily loss cap vs. current day PnL progress gauge & Halt All Bots kill-switch
        ├── AddHoldingModal.tsx        # Add/edit equity holding modal with ticker search
        ├── AddMutualFundModal.tsx     # Add/edit mutual fund holding modal with AMFI search
        ├── ScreenshotImportModal.tsx  # Equity CSV & screenshot multi-file upload/review modal
        ├── MfImportModal.tsx          # Mutual fund Coin CSV, CAS PDF & screenshot upload/review modal
        ├── ConfirmActionModal.tsx     # Reusable destructive action confirmation modal
        └── SortableTh.tsx             # Reusable accessible table sort header component
```

---

## Backend REST API Reference

All API routes are served from `server.ts` on `/api/*`.

### Market & Chart Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check returning `{ status: 'ok', timestamp }`. |
| `GET` | `/api/market/quotes?symbols=RELIANCE.NS,TCS.NS` | Batch quote lookup (up to 250 symbols, including `^NSEI` and `^NSEMDCP50`) with RSI-14, 50/200-DMA, 1M/3M/6M/1Y returns, beta, and volume ratio. |
| `GET` | `/api/market/chart/:symbol?range=6mo` | Historical OHLCV series (`1d`, `5d`, `1mo`, `6mo`, `1y`, `3y`, `5y`, `max`) with computed `ema20` and `sma50` overlays. |
| `GET` | `/api/market/search?q=...` | Autocomplete Indian NSE/BSE stocks & indices against local catalog + Yahoo search fallback. |
| `GET` | `/api/market/screener` | Live NSE/BSE screener universe enriched with live Yahoo Finance fundamentals, upcoming earnings dates, and 4-pillar Confidence breakdowns. |
| `GET` | `/api/market/patterns?refresh=1` | Returns the 6 illustrated discovery patterns with live matched stocks, 24-month walk-forward 1M/3M win rates & average returns, and monthly shortlist cohorts (6-hour server cache). |
| `GET` | `/api/market/signals` | Live research signal feed enriched with calibrated 4-pillar Confidence Scores, matched walk-forward 1M/3M win rates, and upcoming earnings alerts. |
| `GET` | `/api/market/ai-outlook/:symbol?refresh=1` | Single-symbol AI Outlook (`BUY`/`HOLD`/`EXIT`, calibrated 4-pillar Confidence Score, live Yahoo fundamentals & earnings date, Target, Stop-Loss, and `6M / 1Y / 5Y / 10Y` predictions). Server-cached for 10 minutes unless `refresh=1`. |
| `GET` | `/api/strategies` | Returns 4 live NSE quantitative stock strategy baskets with `1M / 6M / 1Y` normalized performance curves vs. Nifty 50 (`^NSEI`), monthly rotation logs, and constituent metrics. |
| `POST` | `/api/algo/compile` | Compiles plain-English trading rules (`{ prompt }`) into structured entry/exit predicates and risk guardrails via Gemini (`fallback_engine` on quota exhaustion). |
| `POST` | `/api/algo/backtest` | Executes multi-symbol bar-by-bar OHLCV historical simulation (`{ strategy }`) with Nifty 50 benchmark, drawdown, Sharpe, win rate, and trade ledger. |
| `POST` | `/api/algo/paper-evaluate` | Evaluates active paper-trading strategies (`{ strategies, orders }`) against live NSE quotes and triggers simulated fills or daily loss cap circuit-breakers. |

### Equity Portfolio Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/portfolio/parse-csv` | Parses Zerodha Kite / broker equity CSV text (`{ csvText, fileName }`) with zero Gemini quota usage and resolves live quotes. |
| `POST` | `/api/portfolio/parse-screenshot` | Parses 1–15 base64 broker screenshots (`{ images }`) via Gemini Vision and validates prices against live quotes. |
| `POST` | `/api/portfolio/analyze` | Evaluates up to 250 holdings (`{ holdings, totalPortfolioValue?, skipPortfolioSummary? }`) in batches of 40 with live fundamentals, 4-pillar Confidence Scores, volatility guardrails, and `6M / 1Y / 5Y / 10Y` projections. |
| `POST` | `/api/portfolio/rotation` | Scans equity holdings for `TRIM_PROFIT` / `EXIT_LAGGARD` rotation triggers and pairs freed rupee capital with top undervalued high-ROCE NSE replacement picks. |

### Mutual Fund Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/mf/search?q=...` | Searches AMFI mutual fund schemes by name or scheme code (`api.mfapi.in`). |
| `POST` | `/api/mf/analyze` | Computes XIRR, benchmark alpha, rolling returns, FIFO tax liability, tiered exit loads, and TER fee drag for mutual fund holdings (`{ holdings, taxSlabPct, ltcgExemptionRemaining }`). |
| `POST` | `/api/mf/parse-csv` | Parses Zerodha Coin / Kite Mutual Fund CSV exports (`{ csvText, fileName }`) deterministically and maps schemes to AMFI codes. |
| `POST` | `/api/mf/parse-import` | Parses CAS PDFs, MF app screenshots, or pasted CAS summary text (`{ files, rawText }`) via Gemini Vision + AMFI matching. |
| `POST` | `/api/mf/ai-switch-advice` | Generates actionable switch timing advice (`SWITCH_NOW` / `WAIT_EXIT_LOAD` / `STAGGER_FOR_LTCG` / `HOLD_STEADY`) and **6M, 1Y, 5Y, 10Y** compound wealth projections per scheme. |

---

## Firestore Database & Security Rules

When signed in with a verified Google account, Stoxify scopes all persistent documents under the authenticated user's UID:

- `/users/{userId}/holdings/{holdingId}` — Equity holdings (`symbol`, `companyName`, `exchange` in `NSE|BSE`, `sector`, `quantity`, `avgBuyPrice`, `buyDate`, `notes`, `source` in `manual|screenshot|signal`).
- `/users/{userId}/watchlist/{itemId}` — Watchlist items (`symbol`, `companyName`, `exchange`, `sector`, `targetAlertPrice`).
- `/users/{userId}/mutualFunds/{fundHoldingId}` — Mutual fund holdings (`schemeCode`, `schemeName`, `fundHouse`, `category`, `planType` in `Direct|Regular`, `optionType` in `Growth|IDCW`, `units`, `avgNav`, `purchaseDate`, `isSip`, `monthlySipAmount`, `folioNumber`, `source` in `manual|screenshot|cas_pdf`).
- `/users/{userId}/algoStrategies/{strategyId}` — Algorithmic trading strategies (`name`, `prompt`, `symbols`, `entryConditions`, `exitConditions`, `stopLossPct`, `takeProfitPct`, `dailyLossCapPct`, `status` in `DRAFT|ACTIVE|PAUSED|PAUSED_RISK_CAP`).
- `/users/{userId}/algoOrders/{orderId}` — Append-only simulated paper-trade order & guardrail audit ledger (`strategyId`, `symbol`, `side` in `BUY|SELL`, `status` in `FILLED|BLOCKED_RISK_CAP|BLOCKED_FUNDS|CANCELLED`, `quantity`, `price`, `realizedPnl`, `tradingDate`).

Security rules (`firestore.rules`) enforce:
- Default-deny catch-all at root.
- Verified email + strict owner UID match (`request.auth.token.email_verified == true && request.auth.uid == userId`).
- Server-timestamp enforcement (`createdAt == request.time`, `updatedAt == request.time`).
- Strict field allowlists, type/range checks, and immutable identity/ticker fields on updates.

---

## Getting Started (Local Development)

### Prerequisites
- Node.js 20+
- A Gemini API key (`GEMINI_API_KEY`) configured via `.env` or runtime environment secrets (optional for basic tracking/CSV workflows; quantitative fallback activates automatically if missing or quota-limited).

### Setup & Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env and set GEMINI_API_KEY (and optional APP_URL)

# 3. Start full-stack Express + Vite dev server on port 3000
npm run dev

# 4. Type-check and lint TypeScript
npm run lint

# 5. Build frontend bundle for production
npm run build

# 6. Run production server
npm start
```

> **Note**: Both development (`npm run dev`) and production (`npm start`) bind to port `3000` (`0.0.0.0:3000`). In development, `server.ts` mounts Vite middleware directly; never place API routes inside `vite.config.ts`.

---

## Disclaimer

Stoxify is an educational and quantitative research platform—not a SEBI-registered investment adviser, research analyst, or broker-dealer. Confidence Scores rank setups within Stoxify's rule model, walk-forward backtests reflect historical OHLCV simulations, and index Bear Put Spread calculations use Black-Scholes approximations for illustrative risk modeling only. Always verify live broker/exchange data and consult a qualified financial adviser before investing or trading derivatives.

