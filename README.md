# Stoxify — Indian Equity & Mutual Fund Portfolio Terminal

**Stoxify** is a full-stack Indian market analytics platform for NSE/BSE equities and AMFI-tracked mutual funds. It combines live market data, interactive technical charting, broker CSV/screenshot imports, portfolio health diagnostics, mutual fund direct-switch & tax optimization, and Gemini-powered investment outlooks with a deterministic quantitative fallback engine.

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

### 4. Health Diagnostics & Batched AI Portfolio Audit (`HealthDiagnosticsView`)
- **Dead-Stock & Concentration Diagnostics**: Flags laggards trailing Nifty 50 below the 200-DMA, computes portfolio weighted beta, market-cap distribution, and sector weights.
- **Multi-Batch Evaluation**: Automatically chunks large portfolios into server batches of up to 40 unique holdings with concurrency `2` and live batch progress feedback.
- **Volatility-Calibrated Guardrails**: Clamps suggested targets and stop-loss levels relative to stock beta (`β`) and 50/200-DMA support, flagging trend conflicts.
- **Per-Stock & Portfolio 6M / 1Y / 5Y / 10Y Forecasts**: Displays capital-weighted portfolio trajectory and per-holding return/CAGR estimates.

### 5. Live Market Charts & Integrated AI Outlook (`MarketChartTerminal`)
- **Interactive Price & Volume Terminal**: Recharts `ComposedChart` across `1D`, `1W`, `1M`, `6M`, and `1Y` timeframes with `EMA 20`, `SMA 50`, RSI-14, 52-week range gauge, and 20-day volume ratio telemetry.
- **Integrated `AI Outlook` Panel**: Automatically fetches single-symbol AI analysis for the active stock or index (`^NSEI`, `^BSESN`, `^NSEBANK`, `RELIANCE.NS`, `TCS.NS`, etc.) showing `BUY` / `HOLD` / `EXIT` rating, conviction, technical rationale, key risk, 1Y Target, Stop-Loss Support, guardrail verification, and **6M / 1Y / 5Y / 10Y** price forecasts.
- **Chart Level Overlays**: One-click **Plot Target / SL** toggle draws predicted Target and Stop-Loss reference lines directly onto the chart (alongside Avg Buy Cost when inspecting from a portfolio holding).

### 6. Pro Stock Screener & Research Signals (`ProScreenerView`, `ResearchSignalsView`)
- **Screener Presets**: `all`, `golden_crossover`, `volume_shockers`, `multibagger_value`, `oversold_rebound`, and `top_gainers` over the NSE/BSE universe with multi-criteria filtering and sorting.
- **Research Signals**: Live short-term, positional, and swing trade ideas with entry ranges, target prices, stop-losses, and one-click chart plotting.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Recharts 3, Lucide React, Motion |
| **Backend** | Node.js, Express 4, `tsx`, `dotenv` |
| **AI & Analytics** | `@google/genai` (`gemini-4-hydrogen` primary, `gemini-3.1-flash-lite` fallback) + quantitative projection engine |
| **Market & MF Data** | Yahoo Finance v8 Chart/Quote endpoints, AMFI `api.mfapi.in`, curated `indianMarketCatalog.ts` & `schemeMetadataCatalog.ts` |
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
│   ├── marketService.ts               # Live NSE/BSE quotes, OHLCV charts, SMA/EMA/RSI, search, screener & signals
│   ├── portfolioAnalyzer.ts           # Single-symbol AI Outlook, batched portfolio AI audit, guardrails & 6M-10Y forecasts
│   ├── screenshotParser.ts            # Multi-image equity broker screenshot parser via Gemini Vision
│   ├── csvParser.ts                   # Zero-AI Zerodha Kite (equity) & Zerodha Coin (MF) CSV parsers
│   ├── mutualFundService.ts           # AMFI scheme search, NAV history, XIRR, FIFO tax, tiered exit load & TER bleed
│   ├── mutualFundAiService.ts         # Gemini MF CAS/screenshot import & AI switch strategy with 6M-10Y projections
│   ├── indianMarketCatalog.ts         # NSE/BSE stock universe, indices, sector tags, ROCE/PE fundamentals & signal templates
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
        ├── HealthDiagnosticsView.tsx  # Dead-stock flags, beta/cap diagnostics & batched AI portfolio audit UI
        ├── MarketChartTerminal.tsx    # Interactive Recharts price/volume terminal & integrated AI Outlook panel
        ├── ProScreenerView.tsx        # Sortable/filterable NSE/BSE screener
        ├── ResearchSignalsView.tsx    # Trade signal cards with chart level plotting
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
| `GET` | `/api/market/quotes?symbols=RELIANCE.NS,TCS.NS` | Batch quote lookup (up to 250 symbols) with RSI-14, 50/200-DMA, beta, volume ratio, and fundamentals. |
| `GET` | `/api/market/chart/:symbol?range=6mo` | Historical OHLCV series (`1d`, `5d`, `1mo`, `6mo`, `1y`) with computed `ema20` and `sma50` overlays. |
| `GET` | `/api/market/search?q=...` | Autocomplete Indian NSE/BSE stocks & indices against local catalog + Yahoo search fallback. |
| `GET` | `/api/market/screener` | Live telemetry snapshot across the Stoxify Indian equity screener universe. |
| `GET` | `/api/market/signals` | Live research signal feed calibrated with current market prices. |
| `GET` | `/api/market/ai-outlook/:symbol?refresh=1` | Single-symbol AI Outlook (`BUY`/`HOLD`/`EXIT`, thesis, key risk, Target, Stop-Loss, and `6M / 1Y / 5Y / 10Y` predictions). Server-cached for 10 minutes unless `refresh=1`. |

### Equity Portfolio Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/portfolio/parse-csv` | Parses Zerodha Kite / broker equity CSV text (`{ csvText, fileName }`) with zero Gemini quota usage and resolves live quotes. |
| `POST` | `/api/portfolio/parse-screenshot` | Parses 1–15 base64 broker screenshots (`{ images }`) via Gemini Vision and validates prices against live quotes. |
| `POST` | `/api/portfolio/analyze` | Evaluates up to 250 holdings (`{ holdings, totalPortfolioValue?, skipPortfolioSummary? }`) in batches of 40, applies volatility guardrails, and returns per-stock & portfolio `6M / 1Y / 5Y / 10Y` projections. |

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
