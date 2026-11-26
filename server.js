// server.ts
import express2 from "express";
import fs from "fs";
import path from "path";
import dotenv2 from "dotenv";

// server/apiApp.ts
import express from "express";
import dotenv from "dotenv";

// server/indianMarketCatalog.ts
var INDIAN_INDICES = [
  {
    symbol: "^NSEI",
    ticker: "NIFTY 50",
    name: "NIFTY 50 Index",
    exchange: "INDEX",
    sector: "Benchmark",
    capCategory: "Index",
    peRatio: 22.4,
    roce: null,
    debtToEquity: null,
    beta: 1
  },
  {
    symbol: "^BSESN",
    ticker: "SENSEX",
    name: "S&P BSE SENSEX",
    exchange: "INDEX",
    sector: "Benchmark",
    capCategory: "Index",
    peRatio: 23.1,
    roce: null,
    debtToEquity: null,
    beta: 0.98
  },
  {
    symbol: "^NSEBANK",
    ticker: "NIFTY BANK",
    name: "NIFTY Bank Index",
    exchange: "INDEX",
    sector: "Banking",
    capCategory: "Index",
    peRatio: 16.2,
    roce: null,
    debtToEquity: null,
    beta: 1.12
  },
  {
    symbol: "^NSEMDCP50",
    ticker: "MIDCPNIFTY",
    name: "NIFTY Midcap 50 Index",
    exchange: "INDEX",
    sector: "Midcap Benchmark",
    capCategory: "Index",
    peRatio: 28.5,
    roce: null,
    debtToEquity: null,
    beta: 1.18
  }
];
var INDIAN_STOCK_UNIVERSE = [
  {
    symbol: "RELIANCE.NS",
    ticker: "RELIANCE",
    name: "Reliance Industries Ltd",
    exchange: "NSE",
    sector: "Energy & Telecom",
    capCategory: "Large Cap",
    peRatio: 26.8,
    roce: 11.4,
    debtToEquity: 0.41,
    beta: 1.05,
    aliases: ["RIL", "RELIANCE IND"]
  },
  {
    symbol: "TCS.NS",
    ticker: "TCS",
    name: "Tata Consultancy Services Ltd",
    exchange: "NSE",
    sector: "IT Services",
    capCategory: "Large Cap",
    peRatio: 29.4,
    roce: 64.2,
    debtToEquity: 0.08,
    beta: 0.78,
    aliases: ["TATA CONSULTANCY"]
  },
  {
    symbol: "HDFCBANK.NS",
    ticker: "HDFCBANK",
    name: "HDFC Bank Ltd",
    exchange: "NSE",
    sector: "Banking",
    capCategory: "Large Cap",
    peRatio: 18.6,
    roce: 8.9,
    debtToEquity: null,
    beta: 0.96,
    aliases: ["HDFC BANK"]
  },
  {
    symbol: "ICICIBANK.NS",
    ticker: "ICICIBANK",
    name: "ICICI Bank Ltd",
    exchange: "NSE",
    sector: "Banking",
    capCategory: "Large Cap",
    peRatio: 19.2,
    roce: 9.4,
    debtToEquity: null,
    beta: 1.02,
    aliases: ["ICICI BANK"]
  },
  {
    symbol: "INFY.NS",
    ticker: "INFY",
    name: "Infosys Ltd",
    exchange: "NSE",
    sector: "IT Services",
    capCategory: "Large Cap",
    peRatio: 27.1,
    roce: 40.5,
    debtToEquity: 0.09,
    beta: 0.85,
    aliases: ["INFOSYS"]
  },
  {
    symbol: "BHARTIARTL.NS",
    ticker: "BHARTIARTL",
    name: "Bharti Airtel Ltd",
    exchange: "NSE",
    sector: "Telecom",
    capCategory: "Large Cap",
    peRatio: 54,
    roce: 14.8,
    debtToEquity: 1.95,
    beta: 0.89,
    aliases: ["AIRTEL", "BHARTI AIRTEL"]
  },
  {
    symbol: "SBIN.NS",
    ticker: "SBIN",
    name: "State Bank of India",
    exchange: "NSE",
    sector: "Banking",
    capCategory: "Large Cap",
    peRatio: 10.8,
    roce: 7.2,
    debtToEquity: null,
    beta: 1.18,
    aliases: ["SBI", "STATE BANK"]
  },
  {
    symbol: "LT.NS",
    ticker: "LT",
    name: "Larsen & Toubro Ltd",
    exchange: "NSE",
    sector: "Infrastructure",
    capCategory: "Large Cap",
    peRatio: 34.6,
    roce: 15.1,
    debtToEquity: 1.24,
    beta: 1.08,
    aliases: ["L&T", "LARSEN"]
  },
  {
    symbol: "ITC.NS",
    ticker: "ITC",
    name: "ITC Ltd",
    exchange: "NSE",
    sector: "FMCG",
    capCategory: "Large Cap",
    peRatio: 27.9,
    roce: 37.4,
    debtToEquity: 0.01,
    beta: 0.65
  },
  {
    symbol: "HINDUNILVR.NS",
    ticker: "HINDUNILVR",
    name: "Hindustan Unilever Ltd",
    exchange: "NSE",
    sector: "FMCG",
    capCategory: "Large Cap",
    peRatio: 55.2,
    roce: 26.8,
    debtToEquity: 0.03,
    beta: 0.58,
    aliases: ["HUL", "HINDUSTAN UNILEVER"]
  },
  {
    symbol: "TMPV.NS",
    ticker: "TMPV",
    name: "Tata Motors Passenger Vehicles Ltd",
    exchange: "NSE",
    sector: "Automobiles",
    capCategory: "Large Cap",
    peRatio: 14.8,
    roce: 18.5,
    debtToEquity: 0.78,
    beta: 1.24,
    aliases: [
      "TATAMOTORS",
      "TATA MOTORS",
      "TATA MOTORS PV",
      "TATA MOTORS PASSENGER",
      "TATA MOTORS EV",
      "JLR",
      "500570"
    ]
  },
  {
    symbol: "TMCV.NS",
    ticker: "TMCV",
    name: "Tata Motors Ltd (Commercial Vehicles)",
    exchange: "NSE",
    sector: "Automobiles",
    capCategory: "Large Cap",
    peRatio: 16.2,
    roce: 24.1,
    debtToEquity: 0.42,
    beta: 1.15,
    aliases: ["TATA MOTORS CV", "TATA MOTORS COMMERCIAL", "TATA MOTORS LIMITED", "544569"]
  },
  {
    symbol: "M&M.NS",
    ticker: "M&M",
    name: "Mahindra & Mahindra Ltd",
    exchange: "NSE",
    sector: "Automobiles",
    capCategory: "Large Cap",
    peRatio: 29.8,
    roce: 17.6,
    debtToEquity: 1.12,
    beta: 1.04,
    aliases: ["MAHINDRA"]
  },
  {
    symbol: "MARUTI.NS",
    ticker: "MARUTI",
    name: "Maruti Suzuki India Ltd",
    exchange: "NSE",
    sector: "Automobiles",
    capCategory: "Large Cap",
    peRatio: 26.5,
    roce: 21.8,
    debtToEquity: 0.02,
    beta: 0.86,
    aliases: ["MARUTI SUZUKI"]
  },
  {
    symbol: "SUNPHARMA.NS",
    ticker: "SUNPHARMA",
    name: "Sun Pharmaceutical Industries Ltd",
    exchange: "NSE",
    sector: "Pharma",
    capCategory: "Large Cap",
    peRatio: 38.4,
    roce: 19.6,
    debtToEquity: 0.05,
    beta: 0.72,
    aliases: ["SUN PHARMA"]
  },
  {
    symbol: "TITAN.NS",
    ticker: "TITAN",
    name: "Titan Company Ltd",
    exchange: "NSE",
    sector: "Consumer Durables",
    capCategory: "Large Cap",
    peRatio: 82,
    roce: 23.4,
    debtToEquity: 0.78,
    beta: 0.94
  },
  {
    symbol: "BAJFINANCE.NS",
    ticker: "BAJFINANCE",
    name: "Bajaj Finance Ltd",
    exchange: "NSE",
    sector: "Financials",
    capCategory: "Large Cap",
    peRatio: 29.1,
    roce: 11.9,
    debtToEquity: null,
    beta: 1.24,
    aliases: ["BAJAJ FINANCE"]
  },
  {
    symbol: "AXISBANK.NS",
    ticker: "AXISBANK",
    name: "Axis Bank Ltd",
    exchange: "NSE",
    sector: "Banking",
    capCategory: "Large Cap",
    peRatio: 13.7,
    roce: 8.6,
    debtToEquity: null,
    beta: 1.14,
    aliases: ["AXIS BANK"]
  },
  {
    symbol: "KOTAKBANK.NS",
    ticker: "KOTAKBANK",
    name: "Kotak Mahindra Bank Ltd",
    exchange: "NSE",
    sector: "Banking",
    capCategory: "Large Cap",
    peRatio: 18.8,
    roce: 9.1,
    debtToEquity: null,
    beta: 0.92,
    aliases: ["KOTAK BANK"]
  },
  {
    symbol: "WIPRO.NS",
    ticker: "WIPRO",
    name: "Wipro Ltd",
    exchange: "NSE",
    sector: "IT Services",
    capCategory: "Large Cap",
    peRatio: 24.5,
    roce: 17.8,
    debtToEquity: 0.21,
    beta: 0.91
  },
  {
    symbol: "HCLTECH.NS",
    ticker: "HCLTECH",
    name: "HCL Technologies Ltd",
    exchange: "NSE",
    sector: "IT Services",
    capCategory: "Large Cap",
    peRatio: 27.3,
    roce: 29.4,
    debtToEquity: 0.08,
    beta: 0.84,
    aliases: ["HCL TECH"]
  },
  {
    symbol: "NTPC.NS",
    ticker: "NTPC",
    name: "NTPC Ltd",
    exchange: "NSE",
    sector: "Power & Utilities",
    capCategory: "Large Cap",
    peRatio: 18.4,
    roce: 10.6,
    debtToEquity: 1.41,
    beta: 0.95
  },
  {
    symbol: "POWERGRID.NS",
    ticker: "POWERGRID",
    name: "Power Grid Corporation of India",
    exchange: "NSE",
    sector: "Power & Utilities",
    capCategory: "Large Cap",
    peRatio: 19.1,
    roce: 13.2,
    debtToEquity: 1.38,
    beta: 0.77
  },
  {
    symbol: "TRENT.NS",
    ticker: "TRENT",
    name: "Trent Ltd",
    exchange: "NSE",
    sector: "Retail",
    capCategory: "Large Cap",
    peRatio: 124,
    roce: 28.9,
    debtToEquity: 0.42,
    beta: 1.15
  },
  {
    symbol: "BEL.NS",
    ticker: "BEL",
    name: "Bharat Electronics Ltd",
    exchange: "NSE",
    sector: "Defence & Aerospace",
    capCategory: "Large Cap",
    peRatio: 44.5,
    roce: 34.8,
    debtToEquity: 0,
    beta: 1.19,
    aliases: ["BHARAT ELECTRONICS"]
  },
  {
    symbol: "HAL.NS",
    ticker: "HAL",
    name: "Hindustan Aeronautics Ltd",
    exchange: "NSE",
    sector: "Defence & Aerospace",
    capCategory: "Large Cap",
    peRatio: 35.2,
    roce: 38.6,
    debtToEquity: 0,
    beta: 1.22,
    aliases: ["HINDUSTAN AERONAUTICS"]
  },
  {
    symbol: "COALINDIA.NS",
    ticker: "COALINDIA",
    name: "Coal India Ltd",
    exchange: "NSE",
    sector: "Metals & Mining",
    capCategory: "Large Cap",
    peRatio: 7.8,
    roce: 62.4,
    debtToEquity: 0.08,
    beta: 0.98,
    aliases: ["COAL INDIA"]
  },
  {
    symbol: "TATASTEEL.NS",
    ticker: "TATASTEEL",
    name: "Tata Steel Ltd",
    exchange: "NSE",
    sector: "Metals & Mining",
    capCategory: "Large Cap",
    peRatio: 38,
    roce: 7.9,
    debtToEquity: 0.95,
    beta: 1.35,
    aliases: ["TATA STEEL"]
  },
  {
    symbol: "JSWSTEEL.NS",
    ticker: "JSWSTEEL",
    name: "JSW Steel Ltd",
    exchange: "NSE",
    sector: "Metals & Mining",
    capCategory: "Large Cap",
    peRatio: 31.2,
    roce: 13.4,
    debtToEquity: 1.08,
    beta: 1.26
  },
  {
    symbol: "ASIANPAINT.NS",
    ticker: "ASIANPAINT",
    name: "Asian Paints Ltd",
    exchange: "NSE",
    sector: "Consumer Durables",
    capCategory: "Large Cap",
    peRatio: 52,
    roce: 35.6,
    debtToEquity: 0.12,
    beta: 0.71,
    aliases: ["ASIAN PAINTS"]
  },
  {
    symbol: "DRREDDY.NS",
    ticker: "DRREDDY",
    name: "Dr. Reddys Laboratories Ltd",
    exchange: "NSE",
    sector: "Pharma",
    capCategory: "Large Cap",
    peRatio: 19.6,
    roce: 24.5,
    debtToEquity: 0.07,
    beta: 0.68,
    aliases: ["DR REDDY"]
  },
  {
    symbol: "CIPLA.NS",
    ticker: "CIPLA",
    name: "Cipla Ltd",
    exchange: "NSE",
    sector: "Pharma",
    capCategory: "Large Cap",
    peRatio: 26.2,
    roce: 21.4,
    debtToEquity: 0.02,
    beta: 0.64
  },
  {
    symbol: "PERSISTENT.NS",
    ticker: "PERSISTENT",
    name: "Persistent Systems Ltd",
    exchange: "NSE",
    sector: "IT Services",
    capCategory: "Mid Cap",
    peRatio: 61.5,
    roce: 28.2,
    debtToEquity: 0.04,
    beta: 1.11
  },
  {
    symbol: "POLYCAB.NS",
    ticker: "POLYCAB",
    name: "Polycab India Ltd",
    exchange: "NSE",
    sector: "Capital Goods",
    capCategory: "Mid Cap",
    peRatio: 46.8,
    roce: 29.7,
    debtToEquity: 0.02,
    beta: 1.06
  },
  {
    symbol: "CDSL.NS",
    ticker: "CDSL",
    name: "Central Depository Services (India) Ltd",
    exchange: "NSE",
    sector: "Financials",
    capCategory: "Mid Cap",
    peRatio: 58.2,
    roce: 42.1,
    debtToEquity: 0,
    beta: 1.25
  },
  {
    symbol: "KPITTECH.NS",
    ticker: "KPITTECH",
    name: "KPIT Technologies Ltd",
    exchange: "NSE",
    sector: "IT Services",
    capCategory: "Mid Cap",
    peRatio: 52.4,
    roce: 34.5,
    debtToEquity: 0.14,
    beta: 1.21
  },
  {
    symbol: "YESBANK.NS",
    ticker: "YESBANK",
    name: "Yes Bank Ltd",
    exchange: "NSE",
    sector: "Banking",
    capCategory: "Mid Cap",
    peRatio: 32,
    roce: 4.2,
    debtToEquity: null,
    beta: 1.42,
    aliases: ["YES BANK"]
  },
  {
    symbol: "IDEA.NS",
    ticker: "IDEA",
    name: "Vodafone Idea Ltd",
    exchange: "NSE",
    sector: "Telecom",
    capCategory: "Mid Cap",
    peRatio: null,
    roce: -3.5,
    debtToEquity: null,
    beta: 1.55,
    aliases: ["IDEA", "VI", "VODAFONE IDEA"]
  }
];
var RESEARCH_SIGNAL_TEMPLATES = [
  {
    id: "sig_icicibank",
    symbol: "ICICIBANK.NS",
    ticker: "ICICIBANK",
    companyName: "ICICI Bank Ltd",
    exchange: "NSE",
    sector: "Banking",
    segment: "Positional",
    action: "BUY",
    horizon: "1 - 3 Months",
    rationale: "Consistent NIM resilience with strong retail deposit accretion and bullish 50-DMA support.",
    publishedDate: "2026-11-12",
    entryPctLow: -0.02,
    entryPctHigh: 0.01,
    targetPct: 0.11,
    stopLossPct: -0.055
  },
  {
    id: "sig_bel",
    symbol: "BEL.NS",
    ticker: "BEL",
    companyName: "Bharat Electronics Ltd",
    exchange: "NSE",
    sector: "Defence & Aerospace",
    segment: "Long Term",
    action: "BUY",
    horizon: "6 - 12 Months",
    rationale: "Debt-free balance sheet, 34.8% ROCE, and multi-year defence order book visibility.",
    publishedDate: "2026-11-10",
    entryPctLow: -0.03,
    entryPctHigh: 0.015,
    targetPct: 0.22,
    stopLossPct: -0.09
  },
  {
    id: "sig_tcs",
    symbol: "TCS.NS",
    ticker: "TCS",
    companyName: "Tata Consultancy Services Ltd",
    exchange: "NSE",
    sector: "IT Services",
    segment: "Equity Swing",
    action: "BUY",
    horizon: "2 - 4 Weeks",
    rationale: "Mean-reversion bounce setup near lower Bollinger band with high institutional dividend floor.",
    publishedDate: "2026-11-14",
    entryPctLow: -0.015,
    entryPctHigh: 8e-3,
    targetPct: 0.075,
    stopLossPct: -0.035
  },
  {
    id: "sig_lt",
    symbol: "LT.NS",
    ticker: "LT",
    companyName: "Larsen & Toubro Ltd",
    exchange: "NSE",
    sector: "Infrastructure",
    segment: "Positional",
    action: "BUY",
    horizon: "2 - 4 Months",
    rationale: "Record domestic capex execution pipeline and expanding international EPC margins.",
    publishedDate: "2026-11-11",
    entryPctLow: -0.025,
    entryPctHigh: 0.01,
    targetPct: 0.14,
    stopLossPct: -0.06
  },
  {
    id: "sig_sunpharma",
    symbol: "SUNPHARMA.NS",
    ticker: "SUNPHARMA",
    companyName: "Sun Pharmaceutical Industries Ltd",
    exchange: "NSE",
    sector: "Pharma",
    segment: "Long Term",
    action: "HOLD",
    horizon: "6 - 9 Months",
    rationale: "Specialty portfolio growth remains intact; trail stop-loss near 50-DMA after recent rally.",
    publishedDate: "2026-11-08",
    entryPctLow: -0.04,
    entryPctHigh: -0.01,
    targetPct: 0.16,
    stopLossPct: -0.07
  },
  {
    id: "sig_coalindia",
    symbol: "COALINDIA.NS",
    ticker: "COALINDIA",
    companyName: "Coal India Ltd",
    exchange: "NSE",
    sector: "Metals & Mining",
    segment: "Equity Swing",
    action: "BUY",
    horizon: "3 - 6 Weeks",
    rationale: "Low valuation multiple (P/E < 8x) paired with >60% ROCE and volume accumulation.",
    publishedDate: "2026-11-13",
    entryPctLow: -0.02,
    entryPctHigh: 0.01,
    targetPct: 0.09,
    stopLossPct: -0.04
  }
];

// server/marketService.ts
var QUOTE_TTL_MS = 25e3;
var CHART_TTL_MS = 18e4;
var SEARCH_TTL_MS = 3e5;
var quoteCache = /* @__PURE__ */ new Map();
var chartCache = /* @__PURE__ */ new Map();
var searchCache = /* @__PURE__ */ new Map();
var YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json"
};
var CATALOG_BY_SYMBOL = /* @__PURE__ */ new Map();
for (const item of [...INDIAN_INDICES, ...INDIAN_STOCK_UNIVERSE]) {
  CATALOG_BY_SYMBOL.set(item.symbol.toUpperCase(), item);
}
var RETIRED_SYMBOL_REMAP = {
  "TATAMOTORS.NS": "TMPV.NS",
  "TATAMOTORS.BO": "TMPV.BO",
  TATAMOTORS: "TMPV.NS"
};
function resolveActiveMarketSymbol(symbol) {
  const upper = symbol.trim().toUpperCase();
  return RETIRED_SYMBOL_REMAP[upper] ?? upper;
}
function findCatalogEntry(symbol) {
  const upper = resolveActiveMarketSymbol(symbol);
  if (CATALOG_BY_SYMBOL.has(upper)) return CATALOG_BY_SYMBOL.get(upper);
  const tickerOnly = upper.replace(/\.(NS|BO)$/, "");
  return INDIAN_STOCK_UNIVERSE.find(
    (s) => s.ticker.toUpperCase() === tickerOnly || s.aliases?.some((a) => a.toUpperCase() === tickerOnly)
  );
}
function computeSMA(values, period) {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i];
  }
  return Number((sum / period).toFixed(2));
}
function computeSMASeries(values, period) {
  const result = [];
  let rolling = 0;
  for (let i = 0; i < values.length; i++) {
    rolling += values[i];
    if (i >= period) {
      rolling -= values[i - period];
    }
    if (i >= period - 1) {
      result.push(Number((rolling / period).toFixed(2)));
    } else {
      result.push(null);
    }
  }
  return result;
}
function computeEMASeries(values, period) {
  const result = [];
  const k = 2 / (period + 1);
  let ema = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const initSum = values.slice(0, period).reduce((acc, v) => acc + v, 0);
      ema = initSum / period;
      result.push(Number(ema.toFixed(2)));
    } else if (ema !== null) {
      ema = values[i] * k + ema * (1 - k);
      result.push(Number(ema.toFixed(2)));
    }
  }
  return result;
}
function computeRSI14(closes) {
  const period = 14;
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}
function pctReturn(closes, lookbackBars) {
  if (closes.length <= lookbackBars) return null;
  const latest = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - lookbackBars];
  if (!prev || prev <= 0) return null;
  return Number(((latest - prev) / prev * 100).toFixed(2));
}
async function fetchYahooChartRaw(symbol, range, interval, includeDividends = false) {
  const eventsParam = includeDividends ? "&events=div" : "";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false${eventsParam}`;
  try {
    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(7e3)
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}
function buildQuoteFromDailyResult(symbol, result) {
  const meta = result.meta;
  if (!meta) return null;
  const quoteObj = result.indicators?.quote?.[0];
  const rawCloses = quoteObj?.close ?? [];
  const rawVolumes = quoteObj?.volume ?? [];
  const validCloses = [];
  const validVolumes = [];
  for (let i = 0; i < rawCloses.length; i++) {
    const c = rawCloses[i];
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      validCloses.push(c);
      const v = rawVolumes[i];
      validVolumes.push(typeof v === "number" && Number.isFinite(v) ? v : 0);
    }
  }
  const price = typeof meta.regularMarketPrice === "number" && meta.regularMarketPrice > 0 ? meta.regularMarketPrice : validCloses[validCloses.length - 1] ?? 0;
  if (price <= 0) return null;
  const prevClose = typeof meta.chartPreviousClose === "number" && meta.chartPreviousClose > 0 ? meta.chartPreviousClose : validCloses.length >= 2 ? validCloses[validCloses.length - 2] : price;
  const dayPrevClose = validCloses.length >= 2 ? validCloses[validCloses.length - 2] : prevClose;
  const effectivePrev = typeof meta.previousClose === "number" && meta.previousClose > 0 ? meta.previousClose : dayPrevClose;
  const change = Number((price - effectivePrev).toFixed(2));
  const changePercent = effectivePrev > 0 ? Number((change / effectivePrev * 100).toFixed(2)) : 0;
  const recent20Vols = validVolumes.slice(-21, -1);
  const avgVol20d = recent20Vols.length > 0 ? Math.round(recent20Vols.reduce((a, b) => a + b, 0) / recent20Vols.length) : 0;
  const latestVol = typeof meta.regularMarketVolume === "number" && meta.regularMarketVolume > 0 ? meta.regularMarketVolume : validVolumes[validVolumes.length - 1] ?? 0;
  const volumeRatio = avgVol20d > 0 ? Number((latestVol / avgVol20d).toFixed(2)) : 1;
  const catalog = findCatalogEntry(symbol);
  const upperSymbol = (meta.symbol || symbol).toUpperCase();
  const exchange = upperSymbol.startsWith("^") ? "INDEX" : upperSymbol.endsWith(".BO") ? "BSE" : "NSE";
  const ticker = catalog?.ticker ?? upperSymbol.replace(/\.(NS|BO)$/, "").replace(/^\^/, "");
  const minClose = validCloses.length > 0 ? Math.min(...validCloses) : price;
  const maxClose = validCloses.length > 0 ? Math.max(...validCloses) : price;
  const divEntries = Object.values(result.events?.dividends ?? {}).filter((d) => typeof d.amount === "number" && Number.isFinite(d.amount) && d.amount > 0).sort((a, b) => (a.date ?? 0) - (b.date ?? 0));
  const annualDividendPerShare = Number(
    divEntries.reduce((sum, d) => sum + (d.amount ?? 0), 0).toFixed(2)
  );
  const dividendYield = price > 0 && annualDividendPerShare > 0 ? Number((annualDividendPerShare / price * 100).toFixed(2)) : 0;
  const latestDiv = divEntries.length > 0 ? divEntries[divEntries.length - 1] : null;
  const lastDividendDate = latestDiv?.date && Number.isFinite(latestDiv.date) ? new Date(latestDiv.date * 1e3).toISOString().slice(0, 10) : null;
  const lastDividendAmount = latestDiv?.amount !== void 0 ? Number(latestDiv.amount.toFixed(2)) : null;
  return {
    symbol: upperSymbol,
    ticker,
    shortName: catalog?.name || meta.shortName || meta.longName || ticker,
    exchange,
    sector: catalog?.sector || "Equities",
    capCategory: catalog?.capCategory || "Mid Cap",
    price: Number(price.toFixed(2)),
    previousClose: Number(effectivePrev.toFixed(2)),
    change,
    changePercent,
    dayHigh: Number((meta.regularMarketDayHigh ?? price).toFixed(2)),
    dayLow: Number((meta.regularMarketDayLow ?? price).toFixed(2)),
    fiftyTwoWeekHigh: Number((meta.fiftyTwoWeekHigh ?? maxClose).toFixed(2)),
    fiftyTwoWeekLow: Number((meta.fiftyTwoWeekLow ?? minClose).toFixed(2)),
    volume: latestVol,
    avgVolume20d: avgVol20d,
    volumeRatio,
    sma50: computeSMA(validCloses, 50),
    sma200: computeSMA(validCloses, 200),
    rsi14: computeRSI14(validCloses),
    return1M: pctReturn(validCloses, 21),
    return3M: pctReturn(validCloses, 63),
    return6M: pctReturn(validCloses, 126),
    return1Y: pctReturn(validCloses, Math.min(250, validCloses.length - 1)),
    peRatio: catalog?.peRatio ?? null,
    roce: catalog?.roce ?? null,
    debtToEquity: catalog?.debtToEquity ?? null,
    beta: catalog?.beta ?? 1,
    annualDividendPerShare,
    dividendYield,
    lastDividendDate,
    lastDividendAmount,
    dividendPayoutCount1Y: divEntries.length,
    marketState: meta.marketState || "CLOSED",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function getQuote(symbol) {
  const normalized = resolveActiveMarketSymbol(symbol);
  const cached = quoteCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const raw = await fetchYahooChartRaw(normalized, "1y", "1d", true);
  if (raw) {
    const parsed = buildQuoteFromDailyResult(normalized, raw);
    if (parsed) {
      quoteCache.set(normalized, {
        data: parsed,
        expiresAt: Date.now() + QUOTE_TTL_MS
      });
      return parsed;
    }
  }
  if (cached) {
    return { ...cached.data, isCachedFallback: true };
  }
  return null;
}
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function next() {
    while (nextIdx < items.length) {
      const current = nextIdx++;
      results[current] = await worker(items[current]);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}
async function getQuotes(symbols) {
  const unique = Array.from(
    new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))
  );
  const fetched = await runWithConcurrency(unique, 8, async (sym) => ({
    sym,
    quote: await getQuote(sym)
  }));
  const map = {};
  for (const entry of fetched) {
    if (entry.quote) {
      map[entry.sym] = entry.quote;
    }
  }
  return map;
}
function formatDateLabel(tsSec, range) {
  const d = new Date(tsSec * 1e3);
  if (range === "1d" || range === "5d") {
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }
  if (range === "max") {
    return d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      month: "short",
      year: "numeric"
    });
  }
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: range === "1y" || range === "3y" || range === "5y" ? "2-digit" : void 0
  });
}
async function getChart(symbol, range = "6mo") {
  const normalized = resolveActiveMarketSymbol(symbol);
  const cacheKey = `${normalized}:${range}`;
  const cached = chartCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const intervalMap = {
    "1d": "5m",
    "5d": "15m",
    "1mo": "1d",
    "6mo": "1d",
    "1y": "1d",
    "3y": "1d",
    "5y": "1wk",
    max: "1mo"
  };
  const [rawRange, quote] = await Promise.all([
    fetchYahooChartRaw(normalized, range, intervalMap[range]),
    getQuote(normalized)
  ]);
  if (!rawRange || !quote) {
    return cached ? cached.data : null;
  }
  const timestamps = rawRange.timestamp ?? [];
  const q = rawRange.indicators?.quote?.[0];
  const opens = q?.open ?? [];
  const highs = q?.high ?? [];
  const lows = q?.low ?? [];
  const closes = q?.close ?? [];
  const volumes = q?.volume ?? [];
  const points = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      points.push({
        timestamp: timestamps[i],
        open: Number((opens[i] ?? c).toFixed(2)),
        high: Number((highs[i] ?? c).toFixed(2)),
        low: Number((lows[i] ?? c).toFixed(2)),
        close: Number(c.toFixed(2)),
        volume: typeof volumes[i] === "number" && Number.isFinite(volumes[i]) ? volumes[i] : 0
      });
    }
  }
  const closeArr = points.map((p) => p.close);
  const sma50Series = computeSMASeries(closeArr, Math.min(50, Math.max(10, Math.floor(closeArr.length / 3))));
  const ema20Series = computeEMASeries(closeArr, Math.min(20, Math.max(5, Math.floor(closeArr.length / 6))));
  const candles = points.map((p, idx) => ({
    ...p,
    dateLabel: formatDateLabel(p.timestamp, range),
    sma50: sma50Series[idx],
    ema20: ema20Series[idx]
  }));
  const response = {
    symbol: normalized,
    range,
    quote,
    candles
  };
  chartCache.set(cacheKey, {
    data: response,
    expiresAt: Date.now() + CHART_TTL_MS
  });
  return response;
}
var rawOhlcvCache = /* @__PURE__ */ new Map();
async function getRawOhlcvCandles(symbol, range, interval) {
  const normalized = symbol.trim().toUpperCase();
  const cacheKey = `${normalized}:${range}:${interval}`;
  const cached = rawOhlcvCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const rawRange = await fetchYahooChartRaw(normalized, range, interval);
  if (!rawRange) {
    return cached ? cached.data : [];
  }
  const timestamps = rawRange.timestamp ?? [];
  const q = rawRange.indicators?.quote?.[0];
  const opens = q?.open ?? [];
  const highs = q?.high ?? [];
  const lows = q?.low ?? [];
  const closes = q?.close ?? [];
  const volumes = q?.volume ?? [];
  const bars = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      bars.push({
        timestamp: timestamps[i],
        open: Number((opens[i] ?? c).toFixed(2)),
        high: Number((highs[i] ?? c).toFixed(2)),
        low: Number((lows[i] ?? c).toFixed(2)),
        close: Number(c.toFixed(2)),
        volume: typeof volumes[i] === "number" && Number.isFinite(volumes[i]) ? volumes[i] : 0
      });
    }
  }
  rawOhlcvCache.set(cacheKey, {
    data: bars,
    expiresAt: Date.now() + CHART_TTL_MS
  });
  return bars;
}
async function searchIndianStocks(queryText) {
  const q = queryText.trim();
  if (!q) {
    return INDIAN_STOCK_UNIVERSE.slice(0, 12).map((item) => ({
      symbol: item.symbol,
      ticker: item.ticker,
      name: item.name,
      exchange: item.exchange === "BSE" ? "BSE" : "NSE",
      sector: item.sector,
      type: "EQUITY"
    }));
  }
  const upper = q.toUpperCase();
  const cached = searchCache.get(upper);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const localMatches = INDIAN_STOCK_UNIVERSE.filter(
    (s) => s.ticker.toUpperCase().includes(upper) || s.name.toUpperCase().includes(upper) || s.symbol.toUpperCase().includes(upper) || s.aliases?.some((a) => a.toUpperCase().includes(upper))
  ).map((s) => ({
    symbol: s.symbol,
    ticker: s.ticker,
    name: s.name,
    exchange: s.exchange === "BSE" ? "BSE" : "NSE",
    sector: s.sector,
    type: "EQUITY"
  }));
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q
    )}&quotesCount=14&newsCount=0&region=IN&lang=en-IN`;
    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(5e3)
    });
    if (res.ok) {
      const json = await res.json();
      const seen = new Set(localMatches.map((m) => m.symbol));
      for (const item of json.quotes ?? []) {
        const sym = (item.symbol ?? "").toUpperCase();
        if (!sym.endsWith(".NS") && !sym.endsWith(".BO")) continue;
        if (seen.has(sym)) continue;
        seen.add(sym);
        localMatches.push({
          symbol: sym,
          ticker: sym.replace(/\.(NS|BO)$/, ""),
          name: item.longname || item.shortname || sym,
          exchange: sym.endsWith(".BO") ? "BSE" : "NSE",
          sector: item.sector || "Equities",
          type: item.quoteType || "EQUITY"
        });
      }
    }
  } catch {
  }
  const sliced = localMatches.slice(0, 15);
  searchCache.set(upper, {
    data: sliced,
    expiresAt: Date.now() + SEARCH_TTL_MS
  });
  return sliced;
}
async function getScreenerUniverse() {
  const symbols = INDIAN_STOCK_UNIVERSE.map((s) => s.symbol);
  const quotes = await getQuotes(symbols);
  return symbols.map((sym) => quotes[sym]).filter((q) => Boolean(q));
}
async function getLiveResearchSignals() {
  const symbols = RESEARCH_SIGNAL_TEMPLATES.map((t) => t.symbol);
  const quotes = await getQuotes(symbols);
  return RESEARCH_SIGNAL_TEMPLATES.map((tpl) => {
    const quote = quotes[tpl.symbol] ?? null;
    const anchor = quote?.price ?? 1e3;
    const roundToTick = (n) => Number(n.toFixed(1));
    return {
      id: tpl.id,
      symbol: tpl.symbol,
      ticker: tpl.ticker,
      companyName: tpl.companyName,
      exchange: tpl.exchange,
      sector: tpl.sector,
      segment: tpl.segment,
      action: tpl.action,
      entryLow: roundToTick(anchor * (1 + tpl.entryPctLow)),
      entryHigh: roundToTick(anchor * (1 + tpl.entryPctHigh)),
      targetPrice: roundToTick(anchor * (1 + tpl.targetPct)),
      stopLoss: roundToTick(anchor * (1 + tpl.stopLossPct)),
      horizon: tpl.horizon,
      rationale: tpl.rationale,
      publishedDate: tpl.publishedDate,
      liveQuote: quote
    };
  });
}
async function resolveSymbolForScreenshot(rawName, guessedSymbol, preferredExchange = "NSE") {
  const candidates = [];
  const cleanGuess = (guessedSymbol ?? "").trim().toUpperCase().replace(/[^A-Z0-9.&-]/g, "");
  const cleanRaw = rawName.trim().toUpperCase();
  const catalogMatch = INDIAN_STOCK_UNIVERSE.find((s) => {
    const baseTicker = s.ticker.toUpperCase();
    if (cleanGuess && (s.symbol === cleanGuess || baseTicker === cleanGuess.replace(/\.(NS|BO)$/, ""))) {
      return true;
    }
    if (cleanRaw === baseTicker || s.name.toUpperCase().includes(cleanRaw) || cleanRaw.includes(baseTicker)) {
      return true;
    }
    return s.aliases?.some((a) => cleanRaw.includes(a.toUpperCase()));
  });
  if (catalogMatch) {
    const suffix = preferredExchange === "BSE" ? ".BO" : ".NS";
    const targetSym = preferredExchange === "BSE" ? `${catalogMatch.ticker}.BO` : catalogMatch.symbol;
    const q = await getQuote(targetSym) ?? await getQuote(`${catalogMatch.ticker}${suffix === ".BO" ? ".NS" : ".BO"}`);
    if (q) {
      return {
        symbol: q.symbol,
        name: catalogMatch.name,
        exchange: q.symbol.endsWith(".BO") ? "BSE" : "NSE",
        sector: catalogMatch.sector,
        quote: q
      };
    }
  }
  if (cleanGuess) {
    const bare = cleanGuess.replace(/\.(NS|BO)$/, "");
    if (preferredExchange === "BSE") {
      candidates.push(`${bare}.BO`, `${bare}.NS`);
    } else {
      candidates.push(`${bare}.NS`, `${bare}.BO`);
    }
  }
  for (const sym of candidates) {
    const q = await getQuote(sym);
    if (q) {
      return {
        symbol: q.symbol,
        name: q.shortName,
        exchange: q.symbol.endsWith(".BO") ? "BSE" : "NSE",
        sector: q.sector,
        quote: q
      };
    }
  }
  const searchResults = await searchIndianStocks(rawName);
  for (const sr of searchResults.slice(0, 3)) {
    const q = await getQuote(sr.symbol);
    if (q) {
      return {
        symbol: q.symbol,
        name: sr.name,
        exchange: sr.exchange,
        sector: sr.sector,
        quote: q
      };
    }
  }
  const fallbackTicker = (cleanGuess || cleanRaw.split(/\s+/)[0] || "UNKNOWN").replace(/\.(NS|BO)$/, "").replace(/[^A-Z0-9&-]/g, "");
  return {
    symbol: `${fallbackTicker}.${preferredExchange === "BSE" ? "BO" : "NS"}`,
    name: rawName,
    exchange: preferredExchange,
    sector: "Equities",
    quote: null
  };
}

// server/fundamentalsService.ts
var CRUMB_TTL_MS = 30 * 60 * 1e3;
var FUNDAMENTALS_TTL_MS = 6 * 60 * 60 * 1e3;
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var crumbSession = null;
var crumbRefreshPromise = null;
var fundamentalsCache = /* @__PURE__ */ new Map();
function extractRawNumber(field) {
  if (!field || typeof field.raw !== "number" || !Number.isFinite(field.raw)) {
    return null;
  }
  return field.raw;
}
function extractCookieHeader(res) {
  const headersWithGetSetCookie = res.headers;
  if (typeof headersWithGetSetCookie.getSetCookie === "function") {
    const cookies = headersWithGetSetCookie.getSetCookie();
    if (cookies.length > 0) {
      return cookies.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
    }
  }
  const raw = res.headers.get("set-cookie");
  if (!raw) return "";
  return raw.split(/,(?=\s*[A-Za-z0-9_-]+=)/).map((part) => part.split(";")[0].trim()).filter(Boolean).join("; ");
}
async function fetchFreshCrumbSession() {
  try {
    const initRes = await fetch("https://fc.yahoo.com", {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "manual",
      signal: AbortSignal.timeout(5e3)
    });
    const cookie = extractCookieHeader(initRes);
    if (!cookie) return null;
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "*/*",
        Cookie: cookie
      },
      signal: AbortSignal.timeout(5e3)
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.startsWith("<") || crumb.length > 64) return null;
    const session = {
      cookie,
      crumb,
      expiresAt: Date.now() + CRUMB_TTL_MS
    };
    crumbSession = session;
    return session;
  } catch {
    return null;
  }
}
async function getYahooCrumbSession(forceRefresh = false) {
  if (!forceRefresh && crumbSession && crumbSession.expiresAt > Date.now()) {
    return crumbSession;
  }
  if (!crumbRefreshPromise) {
    crumbRefreshPromise = fetchFreshCrumbSession().finally(() => {
      crumbRefreshPromise = null;
    });
  }
  return crumbRefreshPromise;
}
function normalizeRecommendationLabel(key, mean2) {
  const k = (key || "").trim().toLowerCase();
  if (k === "strong_buy" || k === "strongbuy") return "Strong Buy";
  if (k === "buy") return "Buy";
  if (k === "hold") return "Hold";
  if (k === "underperform") return "Underperform";
  if (k === "sell" || k === "strong_sell") return "Sell";
  if (typeof mean2 === "number" && Number.isFinite(mean2)) {
    if (mean2 <= 1.75) return "Strong Buy";
    if (mean2 <= 2.45) return "Buy";
    if (mean2 <= 3.35) return "Hold";
    if (mean2 <= 4.15) return "Underperform";
    return "Sell";
  }
  return null;
}
function buildCatalogFallback(symbol) {
  const catalog = findCatalogEntry(symbol);
  return {
    symbol: symbol.toUpperCase(),
    trailingPE: catalog?.peRatio ?? null,
    forwardPE: null,
    priceToBook: null,
    evToEbitda: null,
    roePct: null,
    roaPct: null,
    roceProxyPct: catalog?.roce ?? null,
    revenueGrowthPct: null,
    earningsGrowthPct: null,
    operatingMarginPct: null,
    profitMarginPct: null,
    fcfMarginPct: null,
    debtToEquity: catalog?.debtToEquity ?? null,
    nextEarningsDate: null,
    daysToEarnings: null,
    earningsRiskFlag: false,
    analystConsensus: null,
    source: "catalog_fallback",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function computeDaysToDate(isoDate) {
  if (!isoDate) return null;
  const target = (/* @__PURE__ */ new Date(`${isoDate}T00:00:00Z`)).getTime();
  if (!Number.isFinite(target)) return null;
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const todayMs = (/* @__PURE__ */ new Date(`${todayStr}T00:00:00Z`)).getTime();
  return Math.round((target - todayMs) / (24 * 60 * 60 * 1e3));
}
async function fetchQuoteSummaryPayload(symbol, session) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol
  )}?modules=financialData,defaultKeyStatistics,calendarEvents,summaryDetail&crumb=${encodeURIComponent(
    session.crumb
  )}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        Cookie: session.cookie
      },
      signal: AbortSignal.timeout(6500)
    });
    if (!res.ok) {
      return { status: res.status, payload: null };
    }
    const payload = await res.json();
    return { status: res.status, payload };
  } catch {
    return { status: 0, payload: null };
  }
}
async function getLiveFundamentals(symbolInput) {
  const symbol = symbolInput.trim().toUpperCase();
  if (!symbol || symbol.startsWith("^")) {
    return buildCatalogFallback(symbol);
  }
  const cached = fundamentalsCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const catalog = findCatalogEntry(symbol);
  let session = await getYahooCrumbSession(false);
  if (!session) {
    const fallback = buildCatalogFallback(symbol);
    fundamentalsCache.set(symbol, {
      data: fallback,
      expiresAt: Date.now() + 15 * 60 * 1e3
    });
    return fallback;
  }
  let result = await fetchQuoteSummaryPayload(symbol, session);
  if (result.status === 401 || result.status === 403) {
    session = await getYahooCrumbSession(true);
    if (session) {
      result = await fetchQuoteSummaryPayload(symbol, session);
    }
  }
  const entry = result.payload?.quoteSummary?.result?.[0];
  if (!entry) {
    const fallback = buildCatalogFallback(symbol);
    fundamentalsCache.set(symbol, {
      data: fallback,
      expiresAt: Date.now() + (result.status === 404 ? FUNDAMENTALS_TTL_MS : 20 * 60 * 1e3)
    });
    return fallback;
  }
  const fin = entry.financialData;
  const stats = entry.defaultKeyStatistics;
  const detail = entry.summaryDetail;
  const cal = entry.calendarEvents;
  const rawTrailingPE = extractRawNumber(detail?.trailingPE);
  const rawForwardPE = extractRawNumber(detail?.forwardPE) ?? extractRawNumber(stats?.forwardPE);
  const rawPriceToBook = extractRawNumber(stats?.priceToBook);
  const rawEvToEbitda = extractRawNumber(stats?.enterpriseToEbitda);
  const rawRoe = extractRawNumber(fin?.returnOnEquity);
  const rawRoa = extractRawNumber(fin?.returnOnAssets);
  const rawRevGrowth = extractRawNumber(fin?.revenueGrowth);
  const rawEarnGrowth = extractRawNumber(fin?.earningsGrowth);
  const rawOpMargin = extractRawNumber(fin?.operatingMargins);
  const rawProfitMargin = extractRawNumber(fin?.profitMargins);
  const rawFcf = extractRawNumber(fin?.freeCashflow);
  const rawOcf = extractRawNumber(fin?.operatingCashflow);
  const rawTotalRev = extractRawNumber(fin?.totalRevenue);
  const rawDePct = extractRawNumber(fin?.debtToEquity);
  const rawTargetMean = extractRawNumber(fin?.targetMeanPrice);
  const rawTargetMedian = extractRawNumber(fin?.targetMedianPrice);
  const rawTargetHigh = extractRawNumber(fin?.targetHighPrice);
  const rawTargetLow = extractRawNumber(fin?.targetLowPrice);
  const rawAnalystCount = extractRawNumber(fin?.numberOfAnalystOpinions);
  const rawRecMean = extractRawNumber(fin?.recommendationMean);
  const rawRecKey = typeof fin?.recommendationKey === "string" ? fin.recommendationKey : null;
  const trailingPE = rawTrailingPE !== null && rawTrailingPE > 0 && rawTrailingPE < 600 ? Number(rawTrailingPE.toFixed(2)) : catalog?.peRatio ?? null;
  const forwardPE = rawForwardPE !== null && rawForwardPE > 0 && rawForwardPE < 600 ? Number(rawForwardPE.toFixed(2)) : null;
  const priceToBook = rawPriceToBook !== null && rawPriceToBook > 0 && rawPriceToBook < 150 ? Number(rawPriceToBook.toFixed(2)) : null;
  const evToEbitda = rawEvToEbitda !== null && rawEvToEbitda > 1 && rawEvToEbitda < 120 ? Number(rawEvToEbitda.toFixed(2)) : null;
  const roePct = rawRoe !== null ? Number((rawRoe * 100).toFixed(2)) : null;
  const roaPct = rawRoa !== null ? Number((rawRoa * 100).toFixed(2)) : null;
  const roceProxyPct = roePct !== null ? roePct : catalog?.roce !== void 0 && catalog?.roce !== null ? catalog.roce : roaPct !== null ? Number((roaPct * 1.45).toFixed(2)) : null;
  const revenueGrowthPct = rawRevGrowth !== null ? Number((rawRevGrowth * 100).toFixed(2)) : null;
  const earningsGrowthPct = rawEarnGrowth !== null ? Number((rawEarnGrowth * 100).toFixed(2)) : null;
  const operatingMarginPct = rawOpMargin !== null ? Number((rawOpMargin * 100).toFixed(2)) : null;
  const profitMarginPct = rawProfitMargin !== null ? Number((rawProfitMargin * 100).toFixed(2)) : null;
  const isFinancialSector = /bank|financ|insur|nbfc/i.test(catalog?.sector || "");
  let fcfMarginPct = null;
  if (!isFinancialSector && rawTotalRev !== null && rawTotalRev > 0) {
    if (rawFcf !== null) {
      const pct = rawFcf / rawTotalRev * 100;
      if (pct >= -100 && pct <= 100) fcfMarginPct = Number(pct.toFixed(2));
    } else if (rawOcf !== null) {
      const pct = rawOcf * 0.7 / rawTotalRev * 100;
      if (pct >= -100 && pct <= 100) fcfMarginPct = Number(pct.toFixed(2));
    }
  }
  const debtToEquity = rawDePct !== null && rawDePct >= 0 ? Number((rawDePct / 100).toFixed(2)) : catalog?.debtToEquity ?? null;
  const targetMean = rawTargetMean !== null && rawTargetMean > 0 ? Number(rawTargetMean.toFixed(2)) : null;
  const targetMedian = rawTargetMedian !== null && rawTargetMedian > 0 ? Number(rawTargetMedian.toFixed(2)) : null;
  const targetHigh = rawTargetHigh !== null && rawTargetHigh > 0 ? Number(rawTargetHigh.toFixed(2)) : null;
  const targetLow = rawTargetLow !== null && rawTargetLow > 0 ? Number(rawTargetLow.toFixed(2)) : null;
  const analystCount = rawAnalystCount !== null && rawAnalystCount > 0 ? Math.round(rawAnalystCount) : null;
  const recommendationMean = rawRecMean !== null && rawRecMean >= 1 && rawRecMean <= 5 ? Number(rawRecMean.toFixed(2)) : null;
  const recommendationLabel = normalizeRecommendationLabel(rawRecKey, recommendationMean);
  const analystConsensus = targetMean !== null || recommendationLabel !== null ? {
    targetMean,
    targetMedian,
    targetHigh,
    targetLow,
    analystCount,
    recommendationKey: rawRecKey,
    recommendationLabel,
    recommendationMean
  } : null;
  const earningsTimestamps = (cal?.earnings?.earningsDate ?? []).map((d) => extractRawNumber(d)).filter((v) => v !== null && v > 0).sort((a, b) => a - b);
  const nowSec = Math.floor(Date.now() / 1e3) - 86400;
  const upcomingEpoch = earningsTimestamps.find((ts) => ts >= nowSec) ?? null;
  const nextEarningsDate = upcomingEpoch ? new Date(upcomingEpoch * 1e3).toISOString().slice(0, 10) : null;
  const daysToEarnings = computeDaysToDate(nextEarningsDate);
  const earningsRiskFlag = daysToEarnings !== null && daysToEarnings >= -1 && daysToEarnings <= 14;
  const hasAnyLiveMetric = rawTrailingPE !== null || rawForwardPE !== null || rawRoe !== null || rawRoa !== null || rawRevGrowth !== null || rawEarnGrowth !== null || rawDePct !== null || nextEarningsDate !== null;
  const snapshot = {
    symbol,
    trailingPE,
    forwardPE,
    priceToBook,
    evToEbitda: isFinancialSector ? null : evToEbitda,
    roePct,
    roaPct,
    roceProxyPct,
    revenueGrowthPct,
    earningsGrowthPct,
    operatingMarginPct,
    profitMarginPct,
    fcfMarginPct,
    debtToEquity,
    nextEarningsDate,
    daysToEarnings,
    earningsRiskFlag,
    analystConsensus,
    source: hasAnyLiveMetric ? "live_yahoo" : "catalog_fallback",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  fundamentalsCache.set(symbol, {
    data: snapshot,
    expiresAt: Date.now() + FUNDAMENTALS_TTL_MS
  });
  return snapshot;
}
async function getLiveFundamentalsBatch(symbols, concurrency = 6) {
  const unique = Array.from(
    new Set(
      symbols.map((s) => s.trim().toUpperCase()).filter((s) => Boolean(s) && !s.startsWith("^"))
    )
  );
  if (unique.length === 0) return {};
  await getYahooCrumbSession(false);
  const out = {};
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < unique.length) {
      const sym = unique[nextIdx++];
      out[sym] = await getLiveFundamentals(sym);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, unique.length) }, () => worker());
  await Promise.all(runners);
  return out;
}
function mergeQuoteWithFundamentals(quote, fundamentals) {
  if (!fundamentals) return quote;
  return {
    ...quote,
    peRatio: fundamentals.trailingPE ?? quote.peRatio,
    forwardPE: fundamentals.forwardPE,
    roce: fundamentals.roceProxyPct ?? quote.roce,
    roePct: fundamentals.roePct,
    roaPct: fundamentals.roaPct,
    revenueGrowthPct: fundamentals.revenueGrowthPct,
    earningsGrowthPct: fundamentals.earningsGrowthPct,
    operatingMarginPct: fundamentals.operatingMarginPct,
    debtToEquity: fundamentals.debtToEquity ?? quote.debtToEquity,
    nextEarningsDate: fundamentals.nextEarningsDate,
    daysToEarnings: fundamentals.daysToEarnings,
    earningsRiskFlag: fundamentals.earningsRiskFlag,
    fundamentalsSource: fundamentals.source
  };
}

// server/confidenceEngineService.ts
var WEIGHTS = {
  trendStructure: 0.3,
  relativeStrength: 0.25,
  momentumQuality: 0.2,
  fundamentalHealth: 0.25
};
var PATTERN_METADATA = {
  high_confidence: {
    title: "High confidence",
    subtitle: "Stocks lining up across trend, Nifty relative strength, momentum, and fundamentals.",
    ruleSummary: "Confidence \u2265 65% with bullish trend structure & positive benchmark alignment"
  },
  fresh_upward_move: {
    title: "Fresh upward move",
    subtitle: "Recent upward breakouts regaining 50-DMA with fresh momentum and volume expansion.",
    ruleSummary: "Above 50-DMA with +3.5% 1M acceleration and constructive volume or RSI 54\u201372"
  },
  steady_upward_trend: {
    title: "Steady upward trend",
    subtitle: "Stocks staying strong across multiple periods rather than relying on one sudden jump.",
    ruleSummary: "Price > 50-DMA > 200-DMA (Golden alignment), 6M gain \u2265 6%, non-parabolic RSI \u2264 72"
  },
  strong_on_dip: {
    title: "Strong stocks on a dip",
    subtitle: "Stronger-confidence uptrends pulling back closer to moving-average support.",
    ruleSummary: "Long-term uptrend above 200-DMA with mild short-term pullback near 50-DMA support"
  },
  momentum_reset: {
    title: "Healthy momentum reset",
    subtitle: "Taking a short breather after strength while the broader price structure stays intact.",
    ruleSummary: "Price holding above 200-DMA while RSI-14 cools cleanly into the 40\u201358 reset zone"
  },
  higher_fundamental: {
    title: "Higher fundamental confidence",
    subtitle: "Backed by stronger ROE/ROCE, revenue & earnings growth, and disciplined leverage.",
    ruleSummary: "Fundamental Health pillar \u2265 76% from live Yahoo Finance ratios & balance-sheet checks"
  }
};
var PATTERN_ORDER = [
  "high_confidence",
  "fresh_upward_move",
  "steady_upward_trend",
  "strong_on_dip",
  "momentum_reset",
  "higher_fundamental"
];
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function round1(v) {
  return Number(v.toFixed(1));
}
function round2(v) {
  return Number(v.toFixed(2));
}
function computeConfidenceBreakdown(input) {
  const { price, sma50, sma200, rsi14, volumeRatio } = input;
  const safePrice = Math.max(0.01, price);
  let trendScore = 50;
  const trendNotes = [];
  if (sma200 && sma200 > 0) {
    const diff200 = (safePrice - sma200) / sma200 * 100;
    if (diff200 >= 0) {
      trendScore += clamp(12 + diff200 * 0.75, 12, 24);
      trendNotes.push(`+${diff200.toFixed(1)}% vs 200-DMA`);
    } else {
      trendScore -= clamp(12 + Math.abs(diff200) * 0.9, 12, 32);
      trendNotes.push(`${diff200.toFixed(1)}% vs 200-DMA`);
    }
  }
  if (sma50 && sma50 > 0) {
    const diff50 = (safePrice - sma50) / sma50 * 100;
    if (diff50 >= 0) {
      trendScore += clamp(8 + diff50 * 0.6, 8, 16);
      trendNotes.push("above 50-DMA");
    } else {
      trendScore -= clamp(6 + Math.abs(diff50) * 0.75, 6, 18);
      trendNotes.push("below 50-DMA");
    }
  }
  if (sma50 && sma200 && sma50 > 0 && sma200 > 0) {
    if (sma50 > sma200) {
      trendScore += 10;
      trendNotes.push("Golden alignment");
    } else {
      trendScore -= 8;
    }
  }
  if (input.fiftyTwoWeekHigh && input.fiftyTwoWeekLow && input.fiftyTwoWeekHigh > input.fiftyTwoWeekLow) {
    const pos52w = (safePrice - input.fiftyTwoWeekLow) / (input.fiftyTwoWeekHigh - input.fiftyTwoWeekLow);
    trendScore += (pos52w - 0.5) * 14;
  }
  trendScore = round1(clamp(trendScore, 5, 98));
  const alpha1M = input.return1M !== null && input.niftyReturn1M !== null && input.niftyReturn1M !== void 0 ? input.return1M - input.niftyReturn1M : input.return1M;
  const alpha3M = input.return3M !== null && input.return3M !== void 0 && input.niftyReturn3M !== null && input.niftyReturn3M !== void 0 ? input.return3M - input.niftyReturn3M : input.return3M ?? null;
  const alpha6M = input.return6M !== null && input.niftyReturn6M !== null && input.niftyReturn6M !== void 0 ? input.return6M - input.niftyReturn6M : input.return6M;
  let blendedAlpha = 0;
  let alphaWeightSum = 0;
  if (alpha1M !== null && alpha1M !== void 0) {
    blendedAlpha += alpha1M * 0.35;
    alphaWeightSum += 0.35;
  }
  if (alpha3M !== null && alpha3M !== void 0) {
    blendedAlpha += alpha3M * 0.35;
    alphaWeightSum += 0.35;
  }
  if (alpha6M !== null && alpha6M !== void 0) {
    blendedAlpha += alpha6M * 0.55 * 0.3;
    alphaWeightSum += 0.3;
  }
  const normalizedAlpha = alphaWeightSum > 0 ? blendedAlpha / alphaWeightSum : 0;
  const rsScore = round1(clamp(52 + normalizedAlpha * 2.1, 8, 97));
  const rsParts = [];
  if (alpha1M !== null && alpha1M !== void 0) {
    rsParts.push(`1M \u03B1 ${alpha1M >= 0 ? "+" : ""}${alpha1M.toFixed(1)}%`);
  }
  if (alpha6M !== null && alpha6M !== void 0) {
    rsParts.push(`6M \u03B1 ${alpha6M >= 0 ? "+" : ""}${alpha6M.toFixed(1)}%`);
  }
  let momentumScore = 55;
  const momNotes = [];
  if (rsi14 !== null) {
    if (rsi14 >= 52 && rsi14 <= 68) {
      momentumScore = 84 + (1 - Math.abs(rsi14 - 60) / 8) * 10;
      momNotes.push(`RSI ${rsi14.toFixed(1)} sweet spot`);
    } else if (rsi14 >= 42 && rsi14 < 52) {
      momentumScore = 70 + (rsi14 - 42) / 10 * 12;
      momNotes.push(`RSI ${rsi14.toFixed(1)} reset zone`);
    } else if (rsi14 > 68 && rsi14 <= 76) {
      momentumScore = 74 - (rsi14 - 68) / 8 * 14;
      momNotes.push(`RSI ${rsi14.toFixed(1)} firm`);
    } else if (rsi14 > 76) {
      momentumScore = clamp(56 - (rsi14 - 76) * 1.6, 30, 56);
      momNotes.push(`RSI ${rsi14.toFixed(1)} stretched`);
    } else if (rsi14 >= 32 && rsi14 < 42) {
      const aboveLongTrend = Boolean(sma200 && safePrice > sma200);
      momentumScore = aboveLongTrend ? 62 : 44;
      momNotes.push(`RSI ${rsi14.toFixed(1)} cooling`);
    } else {
      const aboveLongTrend = Boolean(sma200 && safePrice > sma200);
      momentumScore = aboveLongTrend ? 52 : 30;
      momNotes.push(`RSI ${rsi14.toFixed(1)} oversold`);
    }
  }
  if (volumeRatio >= 1.25 && (input.dayChangePercent ?? 0) >= 0) {
    momentumScore += clamp((volumeRatio - 1) * 7, 3, 10);
    momNotes.push(`${volumeRatio.toFixed(2)}x vol`);
  } else if (volumeRatio >= 1.5 && (input.dayChangePercent ?? 0) < -1.2) {
    momentumScore -= 8;
    momNotes.push(`${volumeRatio.toFixed(2)}x distribution`);
  }
  momentumScore = round1(clamp(momentumScore, 10, 96));
  const f = input.fundamentals;
  const isFinancialSector = /bank|financ|insur|nbfc/i.test(input.sector || "");
  let fundScore = 54;
  const fundNotes = [];
  const returnQuality = f?.roePct ?? f?.roceProxyPct ?? null;
  if (returnQuality !== null) {
    if (returnQuality >= 24) {
      fundScore += 20;
      fundNotes.push(`ROE/ROCE ${returnQuality.toFixed(1)}%`);
    } else if (returnQuality >= 15) {
      fundScore += 13;
      fundNotes.push(`ROE/ROCE ${returnQuality.toFixed(1)}%`);
    } else if (returnQuality >= 10) {
      fundScore += 5;
      fundNotes.push(`ROE/ROCE ${returnQuality.toFixed(1)}%`);
    } else if (returnQuality < 6) {
      fundScore -= 14;
      fundNotes.push(`Low return ${returnQuality.toFixed(1)}%`);
    }
  }
  const revGr = f?.revenueGrowthPct ?? null;
  if (revGr !== null) {
    if (revGr >= 18) {
      fundScore += 12;
      fundNotes.push(`Rev +${revGr.toFixed(1)}%`);
    } else if (revGr >= 8) {
      fundScore += 7;
      fundNotes.push(`Rev +${revGr.toFixed(1)}%`);
    } else if (revGr < 0) {
      fundScore -= 10;
      fundNotes.push(`Rev ${revGr.toFixed(1)}%`);
    }
  }
  const earnGr = f?.earningsGrowthPct ?? null;
  if (earnGr !== null) {
    if (earnGr >= 20) {
      fundScore += 10;
      fundNotes.push(`EPS +${earnGr.toFixed(1)}%`);
    } else if (earnGr >= 8) {
      fundScore += 5;
    } else if (earnGr < -10) {
      fundScore -= 10;
    }
  }
  const pe = f?.forwardPE ?? f?.trailingPE ?? null;
  if (pe !== null && pe > 0) {
    if (pe <= 24) {
      fundScore += 8;
      fundNotes.push(`P/E ${pe.toFixed(1)}x`);
    } else if (pe <= 42) {
      fundScore += 3;
      fundNotes.push(`P/E ${pe.toFixed(1)}x`);
    } else if (pe > 75) {
      fundScore -= 10;
      fundNotes.push(`Rich P/E ${pe.toFixed(0)}x`);
    } else if (pe > 55) {
      fundScore -= 4;
    }
  }
  const de = f?.debtToEquity ?? null;
  if (!isFinancialSector && de !== null) {
    if (de <= 0.35) {
      fundScore += 7;
      fundNotes.push(`D/E ${de.toFixed(2)}x`);
    } else if (de <= 0.85) {
      fundScore += 2;
    } else if (de > 1.8) {
      fundScore -= 12;
      fundNotes.push(`High D/E ${de.toFixed(2)}x`);
    } else if (de > 1.2) {
      fundScore -= 5;
    }
  }
  const opMargin = f?.operatingMarginPct ?? null;
  if (!isFinancialSector && opMargin !== null) {
    if (opMargin >= 20) {
      fundScore += 4;
      fundNotes.push(`OpM ${opMargin.toFixed(0)}%`);
    } else if (opMargin >= 12) {
      fundScore += 2;
    } else if (opMargin < 5) {
      fundScore -= 5;
      fundNotes.push(`Thin OpM ${opMargin.toFixed(1)}%`);
    }
  }
  const fcfMargin = f?.fcfMarginPct ?? null;
  if (!isFinancialSector && fcfMargin !== null) {
    if (fcfMargin >= 10) {
      fundScore += 4;
      fundNotes.push(`FCF ${fcfMargin.toFixed(0)}%`);
    } else if (fcfMargin < -5) {
      fundScore -= 6;
      fundNotes.push(`Neg FCF ${fcfMargin.toFixed(0)}%`);
    }
  }
  fundScore = round1(clamp(fundScore, 15, 97));
  const trendPts = round2(trendScore * WEIGHTS.trendStructure);
  const rsPts = round2(rsScore * WEIGHTS.relativeStrength);
  const momPts = round2(momentumScore * WEIGHTS.momentumQuality);
  const fundPts = round2(fundScore * WEIGHTS.fundamentalHealth);
  const baseScore = round2(clamp(trendPts + rsPts + momPts + fundPts, 5, 97));
  const adjustments = [];
  if (input.applyRiskDeductions !== false) {
    const dte = input.daysToEarnings;
    if (typeof dte === "number" && Number.isFinite(dte) && dte >= 0 && dte <= 14) {
      const dateSuffix = input.nextEarningsDate ? ` (${input.nextEarningsDate})` : "";
      if (dte <= 5) {
        adjustments.push({
          code: "EARNINGS_IMMINENT",
          label: `Earnings in ${dte}d`,
          delta: -6,
          reason: `Quarterly results due in ${dte} ${dte === 1 ? "day" : "days"}${dateSuffix} \u2014 elevated binary gap risk.`
        });
      } else {
        adjustments.push({
          code: "EARNINGS_UPCOMING",
          label: `Earnings in ${dte}d`,
          delta: -4,
          reason: `Quarterly results due in ${dte} days${dateSuffix} \u2014 near-term event volatility.`
        });
      }
    }
    if (input.fundamentalsSource === "catalog_fallback") {
      adjustments.push({
        code: "FUNDAMENTALS_FALLBACK",
        label: "Baseline fundamentals",
        delta: -5,
        reason: "Live Yahoo Finance ratios unavailable; scored using catalog baseline."
      });
    } else if (input.fundamentalsSource === "live_yahoo") {
      const missingFields = [];
      if (f?.roePct === null || f?.roePct === void 0) missingFields.push("ROE");
      if (f?.revenueGrowthPct === null || f?.revenueGrowthPct === void 0) {
        missingFields.push("Rev Growth");
      }
      if (f?.earningsGrowthPct === null || f?.earningsGrowthPct === void 0) {
        missingFields.push("EPS Growth");
      }
      if (missingFields.length >= 2) {
        adjustments.push({
          code: "FUNDAMENTALS_PARTIAL",
          label: "Incomplete live ratios",
          delta: -3,
          reason: `Live Yahoo feed missing ${missingFields.join(" & ")}.`
        });
      }
    }
  }
  const totalAdjustment = round2(adjustments.reduce((sum, item) => sum + item.delta, 0));
  const overallScore = round2(clamp(baseScore + totalAdjustment, 5, 97));
  const tier = overallScore >= 66 ? "Strong" : overallScore >= 50 ? "Moderate" : "Caution";
  const matchedPatterns = classifyStockPatterns({
    price: safePrice,
    sma50,
    sma200,
    rsi14,
    volumeRatio,
    return1M: input.return1M,
    return6M: input.return6M,
    overallScore,
    trendScore,
    rsScore,
    fundScore
  });
  return {
    baseScore,
    adjustments,
    totalAdjustment,
    overallScore,
    tier,
    pillars: {
      trendStructure: {
        score: trendScore,
        weight: WEIGHTS.trendStructure,
        weightedPoints: trendPts,
        summary: trendNotes.length > 0 ? trendNotes.slice(0, 2).join(" \xB7 ") : "Moving-average baseline"
      },
      relativeStrength: {
        score: rsScore,
        weight: WEIGHTS.relativeStrength,
        weightedPoints: rsPts,
        summary: rsParts.length > 0 ? rsParts.join(" \xB7 ") : "Tracked vs Nifty 50"
      },
      momentumQuality: {
        score: momentumScore,
        weight: WEIGHTS.momentumQuality,
        weightedPoints: momPts,
        summary: momNotes.length > 0 ? momNotes.slice(0, 2).join(" \xB7 ") : "Neutral momentum"
      },
      fundamentalHealth: {
        score: fundScore,
        weight: WEIGHTS.fundamentalHealth,
        weightedPoints: fundPts,
        summary: fundNotes.length > 0 ? fundNotes.slice(0, 2).join(" \xB7 ") : "Baseline sector valuation"
      }
    },
    matchedPatterns,
    primaryPattern: matchedPatterns[0] ?? null,
    computedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function classifyStockPatterns(p) {
  const matched = [];
  const above50 = Boolean(p.sma50 && p.price >= p.sma50);
  const above200 = Boolean(p.sma200 && p.price >= p.sma200);
  const golden = Boolean(p.sma50 && p.sma200 && p.sma50 > p.sma200);
  const dist50Pct = p.sma50 && p.sma50 > 0 ? (p.price - p.sma50) / p.sma50 * 100 : null;
  const rsi = p.rsi14 ?? 50;
  if (p.overallScore >= 65 && p.trendScore >= 58 && p.rsScore >= 52) {
    matched.push("high_confidence");
  }
  if (above50 && (p.return1M ?? 0) >= 3.5 && (p.volumeRatio >= 1.1 && rsi <= 76 || rsi >= 54 && rsi <= 72)) {
    matched.push("fresh_upward_move");
  }
  if (above50 && above200 && golden && (p.return6M ?? 0) >= 6 && rsi <= 72) {
    matched.push("steady_upward_trend");
  }
  if ((above200 || p.overallScore >= 58) && (p.return6M ?? 0) >= 3 && (p.return1M !== null && p.return1M <= 1.5 && p.return1M >= -11 || dist50Pct !== null && dist50Pct >= -5.5 && dist50Pct <= 2.5)) {
    matched.push("strong_on_dip");
  }
  if (above200 && rsi >= 40 && rsi <= 58 && p.trendScore >= 54) {
    matched.push("momentum_reset");
  }
  if (p.fundScore >= 76) {
    matched.push("higher_fundamental");
  }
  return matched;
}
function smaAt(closes, endIdx, period) {
  if (endIdx + 1 < period) return null;
  let sum = 0;
  for (let i = endIdx - period + 1; i <= endIdx; i++) {
    sum += closes[i];
  }
  return sum / period;
}
function rsiAt(closes, endIdx) {
  const period = 14;
  if (endIdx < period + 2) return null;
  const start = Math.max(1, endIdx - 60);
  let gains = 0;
  let losses = 0;
  for (let i = start; i < start + period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = start + period; i <= endIdx; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}
function retAt(closes, endIdx, lookback) {
  if (endIdx < lookback) return null;
  const prev = closes[endIdx - lookback];
  if (!prev || prev <= 0) return null;
  return Number(((closes[endIdx] - prev) / prev * 100).toFixed(2));
}
function formatMonthLabel(tsSec) {
  const d = new Date(tsSec * 1e3);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  return { monthKey, monthLabel: `${monthNames[month]} ${year}` };
}
async function runWithConcurrency2(items, limit, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function runner() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runner())
  );
  return results;
}
var PATTERN_HUB_TTL_MS = 6 * 60 * 60 * 1e3;
var patternHubCache = null;
var patternHubInFlight = null;
async function getEnrichedScreenerUniverse() {
  const [rawStocks, niftyQuote] = await Promise.all([
    getScreenerUniverse(),
    getQuote("^NSEI")
  ]);
  const fundamentalsMap = await getLiveFundamentalsBatch(
    rawStocks.map((s) => s.symbol),
    8
  );
  return rawStocks.map((stock) => {
    const fund = fundamentalsMap[stock.symbol.toUpperCase()] ?? null;
    const merged = mergeQuoteWithFundamentals(stock, fund);
    const confidence = computeConfidenceBreakdown({
      price: merged.price,
      sma50: merged.sma50,
      sma200: merged.sma200,
      fiftyTwoWeekHigh: merged.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: merged.fiftyTwoWeekLow,
      rsi14: merged.rsi14,
      volumeRatio: merged.volumeRatio,
      dayChangePercent: merged.changePercent,
      return1M: merged.return1M,
      return3M: merged.return3M ?? null,
      return6M: merged.return6M,
      niftyReturn1M: niftyQuote?.return1M ?? null,
      niftyReturn3M: niftyQuote?.return3M ?? null,
      niftyReturn6M: niftyQuote?.return6M ?? null,
      sector: merged.sector,
      applyRiskDeductions: true,
      nextEarningsDate: merged.nextEarningsDate ?? null,
      daysToEarnings: merged.daysToEarnings ?? null,
      earningsRiskFlag: merged.earningsRiskFlag ?? false,
      fundamentalsSource: merged.fundamentalsSource ?? fund?.source ?? null,
      fundamentals: {
        trailingPE: merged.peRatio,
        forwardPE: merged.forwardPE,
        roePct: merged.roePct,
        roceProxyPct: merged.roce,
        revenueGrowthPct: merged.revenueGrowthPct,
        earningsGrowthPct: merged.earningsGrowthPct,
        operatingMarginPct: merged.operatingMarginPct,
        fcfMarginPct: fund?.fcfMarginPct ?? null,
        debtToEquity: merged.debtToEquity
      }
    });
    return {
      ...merged,
      confidence
    };
  });
}
async function buildPatternDiscoveryHub() {
  const enrichedStocks = await getEnrichedScreenerUniverse();
  const stockBySymbol = new Map(enrichedStocks.map((s) => [s.symbol.toUpperCase(), s]));
  const [niftyBars, universeSeries] = await Promise.all([
    getRawOhlcvCandles("^NSEI", "3y", "1d"),
    runWithConcurrency2(INDIAN_STOCK_UNIVERSE, 8, async (item) => ({
      symbol: item.symbol.toUpperCase(),
      bars: await getRawOhlcvCandles(item.symbol, "3y", "1d")
    }))
  ]);
  const niftyCloses = niftyBars.map((b) => b.close);
  const niftyDateToIdx = /* @__PURE__ */ new Map();
  niftyBars.forEach((b, idx) => {
    niftyDateToIdx.set(new Date(b.timestamp * 1e3).toISOString().slice(0, 10), idx);
  });
  const wfBuckets = {
    high_confidence: [],
    fresh_upward_move: [],
    steady_upward_trend: [],
    strong_on_dip: [],
    momentum_reset: [],
    higher_fundamental: []
  };
  const historicalCohorts = /* @__PURE__ */ new Map();
  for (const { symbol, bars } of universeSeries) {
    if (bars.length < 235) continue;
    const stockMeta = stockBySymbol.get(symbol);
    if (!stockMeta) continue;
    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume);
    const checkpointIndices = [];
    let lastMonthKey = "";
    for (let i = 205; i < bars.length - 21; i++) {
      const { monthKey, monthLabel } = formatMonthLabel(bars[i].timestamp);
      if (monthKey !== lastMonthKey) {
        lastMonthKey = monthKey;
        checkpointIndices.push({ idx: i, monthKey, monthLabel });
      }
    }
    const recentCheckpoints = checkpointIndices.slice(-24);
    for (const cp of recentCheckpoints) {
      const i = cp.idx;
      const price = closes[i];
      const sma50 = smaAt(closes, i, 50);
      const sma200 = smaAt(closes, i, 200);
      const rsi14 = rsiAt(closes, i);
      const r1m = retAt(closes, i, 21);
      const r3m = retAt(closes, i, 63);
      const r6m = retAt(closes, i, 126);
      let volSum = 0;
      const volStart = Math.max(0, i - 20);
      for (let v = volStart; v < i; v++) volSum += volumes[v];
      const avgVol = i > volStart ? volSum / (i - volStart) : 0;
      const volRatio = avgVol > 0 ? volumes[i] / avgVol : 1;
      const dateStr = new Date(bars[i].timestamp * 1e3).toISOString().slice(0, 10);
      const niftyIdx = niftyDateToIdx.get(dateStr) ?? -1;
      const n1m = niftyIdx >= 21 ? retAt(niftyCloses, niftyIdx, 21) : null;
      const n3m = niftyIdx >= 63 ? retAt(niftyCloses, niftyIdx, 63) : null;
      const n6m = niftyIdx >= 126 ? retAt(niftyCloses, niftyIdx, 126) : null;
      const lookStart = Math.max(0, i - 250);
      let hi52 = price;
      let lo52 = price;
      for (let k = lookStart; k <= i; k++) {
        if (closes[k] > hi52) hi52 = closes[k];
        if (closes[k] < lo52) lo52 = closes[k];
      }
      const dayChg = i > 0 && closes[i - 1] > 0 ? (price - closes[i - 1]) / closes[i - 1] * 100 : 0;
      const breakdown = computeConfidenceBreakdown({
        price,
        sma50,
        sma200,
        fiftyTwoWeekHigh: hi52,
        fiftyTwoWeekLow: lo52,
        rsi14,
        volumeRatio: volRatio,
        dayChangePercent: dayChg,
        return1M: r1m,
        return3M: r3m,
        return6M: r6m,
        niftyReturn1M: n1m,
        niftyReturn3M: n3m,
        niftyReturn6M: n6m,
        sector: stockMeta.sector,
        applyRiskDeductions: false,
        fundamentals: {
          trailingPE: stockMeta.peRatio,
          forwardPE: stockMeta.forwardPE,
          roePct: stockMeta.roePct,
          roceProxyPct: stockMeta.roce,
          revenueGrowthPct: stockMeta.revenueGrowthPct,
          earningsGrowthPct: stockMeta.earningsGrowthPct,
          operatingMarginPct: stockMeta.operatingMarginPct,
          debtToEquity: stockMeta.debtToEquity
        }
      });
      const fwd1M = i + 21 < closes.length && price > 0 ? Number(((closes[i + 21] - price) / price * 100).toFixed(2)) : null;
      const fwd3M = i + 63 < closes.length && price > 0 ? Number(((closes[i + 63] - price) / price * 100).toFixed(2)) : null;
      if (fwd1M === null) continue;
      for (const pat of breakdown.matchedPatterns) {
        wfBuckets[pat].push({ fwd1M, fwd3M });
        if (!historicalCohorts.has(cp.monthKey)) {
          historicalCohorts.set(cp.monthKey, {
            monthLabel: cp.monthLabel,
            byPattern: {
              high_confidence: [],
              fresh_upward_move: [],
              steady_upward_trend: [],
              strong_on_dip: [],
              momentum_reset: [],
              higher_fundamental: []
            }
          });
        }
        historicalCohorts.get(cp.monthKey).byPattern[pat].push({
          symbol: stockMeta.symbol,
          ticker: stockMeta.ticker,
          companyName: stockMeta.shortName,
          exchange: stockMeta.exchange === "BSE" ? "BSE" : "NSE",
          sector: stockMeta.sector,
          confidenceScore: breakdown.overallScore,
          return1M: fwd1M,
          return3M: fwd3M,
          ltp: stockMeta.price,
          nextEarningsDate: stockMeta.nextEarningsDate ?? null,
          daysToEarnings: stockMeta.daysToEarnings ?? null,
          earningsRiskFlag: Boolean(stockMeta.earningsRiskFlag),
          breakdown
        });
      }
    }
  }
  const nowEpochSec = Math.floor(Date.now() / 1e3);
  const currentMonth = formatMonthLabel(nowEpochSec);
  const sortedHistoricalKeys = Array.from(historicalCohorts.keys()).filter((k) => k < currentMonth.monthKey).sort((a, b) => b.localeCompare(a)).slice(0, 3);
  const patterns = PATTERN_ORDER.map((patId) => {
    const meta = PATTERN_METADATA[patId];
    const obs = wfBuckets[patId];
    const obs3M = obs.filter((o) => o.fwd3M !== null);
    const winRate1M = obs.length > 0 ? round1(obs.filter((o) => o.fwd1M > 0).length / obs.length * 100) : null;
    const avgReturn1M = obs.length > 0 ? round2(obs.reduce((sum, o) => sum + o.fwd1M, 0) / obs.length) : null;
    const winRate3M = obs3M.length > 0 ? round1(obs3M.filter((o) => o.fwd3M > 0).length / obs3M.length * 100) : null;
    const avgReturn3M = obs3M.length > 0 ? round2(obs3M.reduce((sum, o) => sum + o.fwd3M, 0) / obs3M.length) : null;
    const liveMatches = enrichedStocks.filter((s) => s.confidence?.matchedPatterns.includes(patId)).sort((a, b) => (b.confidence?.overallScore ?? 0) - (a.confidence?.overallScore ?? 0));
    const latestEntries = liveMatches.map((s) => ({
      symbol: s.symbol,
      ticker: s.ticker,
      companyName: s.shortName,
      exchange: s.exchange === "BSE" ? "BSE" : "NSE",
      sector: s.sector,
      confidenceScore: s.confidence?.overallScore ?? 50,
      return1M: s.return1M,
      return3M: s.return3M ?? null,
      ltp: s.price,
      nextEarningsDate: s.nextEarningsDate ?? null,
      daysToEarnings: s.daysToEarnings ?? null,
      earningsRiskFlag: Boolean(s.earningsRiskFlag),
      breakdown: s.confidence
    }));
    const cohorts = [];
    if (latestEntries.length > 0) {
      cohorts.push({
        monthKey: currentMonth.monthKey,
        monthLabel: currentMonth.monthLabel,
        isLatest: true,
        entries: latestEntries
      });
    }
    for (const mKey of sortedHistoricalKeys) {
      const bucket = historicalCohorts.get(mKey);
      if (!bucket) continue;
      const list = bucket.byPattern[patId].slice().sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, 8);
      if (list.length > 0) {
        cohorts.push({
          monthKey: mKey,
          monthLabel: bucket.monthLabel,
          isLatest: false,
          entries: list
        });
      }
    }
    const upcomingEarningsCount = liveMatches.filter((s) => s.earningsRiskFlag).length;
    return {
      id: patId,
      title: meta.title,
      subtitle: meta.subtitle,
      ruleSummary: meta.ruleSummary,
      liveCount: liveMatches.length,
      liveSymbols: liveMatches.map((s) => s.symbol),
      hasUpcomingEarningsAlert: upcomingEarningsCount > 0,
      upcomingEarningsCount,
      walkForward: {
        sampleCount: obs.length,
        winRate1M,
        avgReturn1M,
        winRate3M,
        avgReturn3M,
        lookbackMonths: 24,
        basisNote: "Walk-forward monthly NSE OHLCV simulation (point-in-time technical & Nifty 50 relative strength rules, zero lookahead)."
      },
      monthlyCohorts: cohorts
    };
  });
  return {
    patterns,
    benchmarkSymbol: "^NSEI",
    universeCount: enrichedStocks.length,
    computedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function getPatternDiscoveryHub(forceRefresh = false) {
  if (!forceRefresh && patternHubCache && patternHubCache.expiresAt > Date.now()) {
    return patternHubCache.data;
  }
  if (!patternHubInFlight) {
    patternHubInFlight = buildPatternDiscoveryHub().then((data) => {
      patternHubCache = {
        data,
        expiresAt: Date.now() + PATTERN_HUB_TTL_MS
      };
      return data;
    }).finally(() => {
      patternHubInFlight = null;
    });
  }
  return patternHubInFlight;
}
async function getEnrichedResearchSignals() {
  const [baseSignals, niftyQuote, patternHub] = await Promise.all([
    getLiveResearchSignals(),
    getQuote("^NSEI"),
    getPatternDiscoveryHub().catch(() => null)
  ]);
  const fundamentalsMap = await getLiveFundamentalsBatch(
    baseSignals.map((s) => s.symbol),
    6
  );
  const walkForwardByPattern = /* @__PURE__ */ new Map();
  for (const pat of patternHub?.patterns ?? []) {
    walkForwardByPattern.set(pat.id, pat.walkForward);
  }
  return baseSignals.map((sig) => {
    const fund = fundamentalsMap[sig.symbol.toUpperCase()] ?? null;
    const mergedQuote = sig.liveQuote ? mergeQuoteWithFundamentals(sig.liveQuote, fund) : null;
    if (!mergedQuote) {
      return {
        ...sig,
        liveQuote: null,
        fundamentals: fund
      };
    }
    const confidence = computeConfidenceBreakdown({
      price: mergedQuote.price,
      sma50: mergedQuote.sma50,
      sma200: mergedQuote.sma200,
      fiftyTwoWeekHigh: mergedQuote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: mergedQuote.fiftyTwoWeekLow,
      rsi14: mergedQuote.rsi14,
      volumeRatio: mergedQuote.volumeRatio,
      dayChangePercent: mergedQuote.changePercent,
      return1M: mergedQuote.return1M,
      return3M: mergedQuote.return3M ?? null,
      return6M: mergedQuote.return6M,
      niftyReturn1M: niftyQuote?.return1M ?? null,
      niftyReturn3M: niftyQuote?.return3M ?? null,
      niftyReturn6M: niftyQuote?.return6M ?? null,
      sector: mergedQuote.sector,
      applyRiskDeductions: true,
      nextEarningsDate: mergedQuote.nextEarningsDate ?? null,
      daysToEarnings: mergedQuote.daysToEarnings ?? null,
      earningsRiskFlag: mergedQuote.earningsRiskFlag ?? false,
      fundamentalsSource: mergedQuote.fundamentalsSource ?? fund?.source ?? null,
      fundamentals: {
        trailingPE: mergedQuote.peRatio,
        forwardPE: mergedQuote.forwardPE,
        roePct: mergedQuote.roePct,
        roceProxyPct: mergedQuote.roce,
        revenueGrowthPct: mergedQuote.revenueGrowthPct,
        earningsGrowthPct: mergedQuote.earningsGrowthPct,
        operatingMarginPct: mergedQuote.operatingMarginPct,
        fcfMarginPct: fund?.fcfMarginPct ?? null,
        debtToEquity: mergedQuote.debtToEquity
      }
    });
    const primaryPattern = confidence.primaryPattern ?? "high_confidence";
    const walkForward = walkForwardByPattern.get(primaryPattern) ?? walkForwardByPattern.get("high_confidence") ?? null;
    const dte = mergedQuote.daysToEarnings;
    const isImminentEarningsLowConf = typeof dte === "number" && dte >= 0 && dte <= 5 && confidence.overallScore < 65;
    const unifiedAction = sig.action === "BUY" && (confidence.overallScore < 52 || isImminentEarningsLowConf) ? "HOLD" : sig.action;
    return {
      ...sig,
      action: unifiedAction,
      liveQuote: { ...mergedQuote, confidence },
      confidence,
      primaryPattern,
      walkForward,
      fundamentals: fund
    };
  });
}

// server/screenshotParser.ts
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
function isQuotaError(err) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /429|RESOURCE_EXHAUSTED|quota exceeded/i.test(msg);
}
async function parseScreenshotBatch(ai, batch) {
  const parts = [
    ...batch.map((img) => ({
      inlineData: {
        mimeType: img.mimeType || "image/png",
        data: img.data
      }
    })),
    {
      text: `Extract every Indian stock/equity holding visible in these broker portfolio screenshots (e.g., Zerodha Kite, Groww, Upstox, Angel One, ICICI Direct, HDFC Securities, INDmoney).
Rules:
1. Extract the exact visible stock name or symbol as rawName, and provide the standard NSE/BSE ticker without suffix in guessedSymbol (e.g., RELIANCE, HDFCBANK, TMPV, TMCV, TCS, INFOSYS -> INFY).
2. Read quantity (Qty / Shares), average buy price (Avg. / Buy Avg / Avg Cost), and screenshot Last Traded Price (LTP) accurately. Do not confuse Invested Value or Current Value or P&L with Avg Buy Price or LTP.
3. If multiple screenshots overlap or duplicate the exact same stock, include each distinct row clearly.
4. Use exchange "NSE" unless BSE is explicitly displayed.
5. Rate confidence as "high", "medium", or "low" depending on image clarity and whether Avg Buy Price & Qty are unambiguous.`
    }
  ];
  const schema = {
    type: Type.OBJECT,
    properties: {
      brokerDetected: {
        type: Type.STRING,
        description: "Detected broker or app UI name (e.g. Zerodha Kite, Groww, Upstox, Angel One, Unknown)."
      },
      warnings: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Any ambiguity, cropped columns, or low-readability warnings."
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
            notes: { type: Type.STRING }
          },
          required: ["rawName", "guessedSymbol", "quantity", "avgBuyPrice", "confidence"]
        }
      }
    },
    required: ["brokerDetected", "holdings"]
  };
  const candidates = [
    { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW },
    { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL }
  ];
  let lastErr;
  for (const cfg of candidates) {
    try {
      const response = await ai.models.generateContent({
        model: cfg.model,
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: cfg.thinkingLevel },
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
      const rawJson = (response.text ?? "{}").trim();
      return JSON.parse(rawJson);
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
  throw lastErr instanceof Error ? lastErr : new Error("Failed to parse portfolio screenshot.");
}
async function parsePortfolioScreenshots(images) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  const batches = [];
  for (let i = 0; i < images.length; i += 5) {
    batches.push(images.slice(i, i + 5));
  }
  const batchResults = await Promise.all(batches.map((b) => parseScreenshotBatch(ai, b)));
  const brokers = Array.from(
    new Set(
      batchResults.map((r) => r.brokerDetected).filter((b) => Boolean(b && b !== "Unknown"))
    )
  );
  const allWarnings = Array.from(
    new Set(batchResults.flatMap((r) => Array.isArray(r.warnings) ? r.warnings : []))
  );
  const allRows = batchResults.flatMap((r) => Array.isArray(r.holdings) ? r.holdings : []);
  const resolvedList = await Promise.all(
    allRows.filter((r) => Number(r.quantity) > 0 && Number(r.avgBuyPrice) > 0).map(async (row, idx) => {
      const preferredExchange = row.exchange?.toUpperCase() === "BSE" ? "BSE" : "NSE";
      const resolved = await resolveSymbolForScreenshot(
        row.rawName,
        row.guessedSymbol,
        preferredExchange
      );
      const screenshotLtp = typeof row.screenshotLtp === "number" && row.screenshotLtp > 0 ? Number(row.screenshotLtp.toFixed(2)) : null;
      const livePrice = resolved.quote?.price ?? null;
      const priceDeviationPct = screenshotLtp && livePrice ? Number(((livePrice - screenshotLtp) / screenshotLtp * 100).toFixed(2)) : null;
      const conf = row.confidence === "high" || row.confidence === "medium" || row.confidence === "low" ? row.confidence : "medium";
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
        confidence: resolved.quote ? conf : "low",
        notes: row.notes || ""
      };
    })
  );
  const seenKeys = /* @__PURE__ */ new Set();
  const deduplicated = [];
  for (const item of resolvedList) {
    const key = `${item.resolvedSymbol}|${item.quantity}|${item.avgBuyPrice}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduplicated.push(item);
  }
  return {
    brokerDetected: brokers.join(" / ") || "Broker Screenshot",
    holdings: deduplicated,
    warnings: allWarnings
  };
}

// server/portfolioAnalyzer.ts
import { GoogleGenAI as GoogleGenAI2, ThinkingLevel as ThinkingLevel2, Type as Type2 } from "@google/genai";

// server/valuationAndTechnicals.ts
function clamp2(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function round22(v) {
  return Number(v.toFixed(2));
}
function sma(values, period) {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i];
  }
  return sum / period;
}
function emaSeries(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let cur = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [cur];
  for (let i = period; i < values.length; i++) {
    cur = values[i] * k + cur * (1 - k);
    out.push(cur);
  }
  return out;
}
function computeRsi14(closes) {
  const period = 14;
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
function computeMacd(closes) {
  if (closes.length < 36) return null;
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const offset = 26 - 12;
  const macdLine = [];
  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + offset] - ema26[i]);
  }
  if (macdLine.length < 9) return null;
  const signalSeries = emaSeries(macdLine, 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  return { macd, signal, hist: macd - signal };
}
function computeStochastic14(highs, lows, closes) {
  const period = 14;
  if (closes.length < period + 3) return null;
  const kSeries = [];
  for (let i = period - 1; i < closes.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    const denom = hh - ll;
    kSeries.push(denom > 0 ? (closes[i] - ll) / denom * 100 : 50);
  }
  const k = kSeries[kSeries.length - 1];
  const d = (kSeries[kSeries.length - 1] + kSeries[kSeries.length - 2] + kSeries[kSeries.length - 3]) / 3;
  return { k, d };
}
function computeAdx14(highs, lows, closes) {
  const period = 14;
  if (closes.length < period * 2 + 2) return null;
  const trList = [];
  const plusDmList = [];
  const minusDmList = [];
  for (let i = 1; i < closes.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trList.push(tr);
    plusDmList.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDmList.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  let trSmooth = trList.slice(0, period).reduce((a, b) => a + b, 0);
  let plusSmooth = plusDmList.slice(0, period).reduce((a, b) => a + b, 0);
  let minusSmooth = minusDmList.slice(0, period).reduce((a, b) => a + b, 0);
  const dxList = [];
  let lastPlusDi = 0;
  let lastMinusDi = 0;
  for (let i = period; i < trList.length; i++) {
    trSmooth = trSmooth - trSmooth / period + trList[i];
    plusSmooth = plusSmooth - plusSmooth / period + plusDmList[i];
    minusSmooth = minusSmooth - minusSmooth / period + minusDmList[i];
    const plusDi = trSmooth > 0 ? plusSmooth / trSmooth * 100 : 0;
    const minusDi = trSmooth > 0 ? minusSmooth / trSmooth * 100 : 0;
    lastPlusDi = plusDi;
    lastMinusDi = minusDi;
    const sumDi = plusDi + minusDi;
    dxList.push(sumDi > 0 ? Math.abs(plusDi - minusDi) / sumDi * 100 : 0);
  }
  if (dxList.length < period) return null;
  let adx = dxList.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxList.length; i++) {
    adx = (adx * (period - 1) + dxList[i]) / period;
  }
  return { adx, plusDi: lastPlusDi, minusDi: lastMinusDi };
}
function computeCci20(highs, lows, closes) {
  const period = 20;
  if (closes.length < period) return null;
  const tp = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
  }
  const mean2 = tp.reduce((a, b) => a + b, 0) / period;
  const meanDev = tp.reduce((a, b) => a + Math.abs(b - mean2), 0) / period;
  if (meanDev === 0) return 0;
  return (tp[tp.length - 1] - mean2) / (0.015 * meanDev);
}
function computeWilliamsR14(highs, lows, closes) {
  const period = 14;
  if (closes.length < period) return null;
  let hh = -Infinity;
  let ll = Infinity;
  for (let i = closes.length - period; i < closes.length; i++) {
    if (highs[i] > hh) hh = highs[i];
    if (lows[i] < ll) ll = lows[i];
  }
  const denom = hh - ll;
  if (denom <= 0) return -50;
  return (hh - closes[closes.length - 1]) / denom * -100;
}
function classifyVoteRatio(buy, sell, total) {
  if (total <= 0) return "Neutral";
  const net = (buy - sell) / total;
  if (net >= 0.5) return "Strong Buy";
  if (net >= 0.16) return "Buy";
  if (net <= -0.5) return "Strong Sell";
  if (net <= -0.16) return "Sell";
  return "Neutral";
}
function computeTimeframeSummary(clean, livePrice) {
  if (clean.length < 18 || !Number.isFinite(livePrice) || livePrice <= 0) {
    return null;
  }
  const closes = clean.map((c) => c.close);
  const highs = clean.map((c) => c.high);
  const lows = clean.map((c) => c.low);
  const maSpecs = [
    { name: "EMA (10)", val: emaSeries(closes, 10).at(-1) ?? null },
    { name: "SMA (20)", val: sma(closes, 20) },
    { name: "EMA (20)", val: emaSeries(closes, 20).at(-1) ?? null },
    { name: "SMA (50)", val: sma(closes, 50) },
    { name: "SMA (100)", val: sma(closes, 100) },
    { name: "SMA (200)", val: sma(closes, 200) }
  ];
  const maItems = [];
  for (const spec of maSpecs) {
    if (spec.val === null) continue;
    let signal = "Neutral";
    if (livePrice > spec.val * 1.003) signal = "Buy";
    else if (livePrice < spec.val * 0.997) signal = "Sell";
    maItems.push({
      name: spec.name,
      value: `\u20B9${spec.val.toFixed(2)}`,
      signal
    });
  }
  const oscItems = [];
  const rsi = computeRsi14(closes);
  if (rsi !== null) {
    let signal = "Neutral";
    if (rsi >= 55 && rsi < 75 || rsi <= 30) signal = "Buy";
    else if (rsi >= 75 || rsi > 30 && rsi <= 45) signal = "Sell";
    oscItems.push({ name: "RSI (14)", value: rsi.toFixed(1), signal });
  }
  const macd = computeMacd(closes);
  if (macd) {
    let signal = "Neutral";
    if (macd.macd > macd.signal && macd.hist > 0) signal = "Buy";
    else if (macd.macd < macd.signal && macd.hist < 0) signal = "Sell";
    oscItems.push({
      name: "MACD (12,26)",
      value: `${macd.macd >= 0 ? "+" : ""}${macd.macd.toFixed(2)}`,
      signal
    });
  }
  const stoch = computeStochastic14(highs, lows, closes);
  if (stoch) {
    let signal = "Neutral";
    if (stoch.k < 20 || stoch.k > stoch.d && stoch.k > 50 && stoch.k < 82) signal = "Buy";
    else if (stoch.k > 82 || stoch.k < stoch.d && stoch.k < 50) signal = "Sell";
    oscItems.push({ name: "Stoch %K (14)", value: stoch.k.toFixed(1), signal });
  }
  const adx = computeAdx14(highs, lows, closes);
  if (adx) {
    let signal = "Neutral";
    if (adx.adx >= 18 && adx.plusDi > adx.minusDi + 1.5) signal = "Buy";
    else if (adx.adx >= 18 && adx.minusDi > adx.plusDi + 1.5) signal = "Sell";
    oscItems.push({ name: "ADX (14)", value: adx.adx.toFixed(1), signal });
  }
  const cci = computeCci20(highs, lows, closes);
  if (cci !== null) {
    let signal = "Neutral";
    if (cci >= 60) signal = "Buy";
    else if (cci <= -60) signal = "Sell";
    oscItems.push({ name: "CCI (20)", value: cci.toFixed(0), signal });
  }
  const willR = computeWilliamsR14(highs, lows, closes);
  if (willR !== null) {
    let signal = "Neutral";
    if (willR >= -38 && willR <= -8 || willR <= -82) signal = "Buy";
    else if (willR < -62 && willR > -82) signal = "Sell";
    oscItems.push({ name: "Williams %R", value: willR.toFixed(1), signal });
  }
  const countVotes = (items) => ({
    buyCount: items.filter((i) => i.signal === "Buy").length,
    neutralCount: items.filter((i) => i.signal === "Neutral").length,
    sellCount: items.filter((i) => i.signal === "Sell").length
  });
  const maCounts = countVotes(maItems);
  const oscCounts = countVotes(oscItems);
  const totalBuy = maCounts.buyCount + oscCounts.buyCount;
  const totalNeutral = maCounts.neutralCount + oscCounts.neutralCount;
  const totalSell = maCounts.sellCount + oscCounts.sellCount;
  const totalCount = totalBuy + totalNeutral + totalSell;
  if (totalCount === 0) return null;
  return {
    rating: classifyVoteRatio(totalBuy, totalSell, totalCount),
    buyCount: totalBuy,
    neutralCount: totalNeutral,
    sellCount: totalSell,
    movingAverages: {
      rating: classifyVoteRatio(maCounts.buyCount, maCounts.sellCount, maItems.length),
      ...maCounts,
      items: maItems
    },
    oscillators: {
      rating: classifyVoteRatio(oscCounts.buyCount, oscCounts.sellCount, oscItems.length),
      ...oscCounts,
      items: oscItems
    }
  };
}
function toEpochMs(timestamp) {
  return timestamp > 1e12 ? timestamp : timestamp * 1e3;
}
function getIsoWeekKey(timestamp) {
  const d = new Date(toEpochMs(timestamp));
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function aggregateWeeklyCandles(daily) {
  const buckets = /* @__PURE__ */ new Map();
  for (const c of daily) {
    if (!Number.isFinite(c.timestamp) || c.timestamp <= 0) continue;
    const key = getIsoWeekKey(c.timestamp);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...c });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume = (existing.volume || 0) + (c.volume || 0);
      existing.timestamp = c.timestamp;
      existing.dateLabel = c.dateLabel;
    }
  }
  return Array.from(buckets.values());
}
function computeClassicPivots(clean) {
  if (clean.length < 2) return null;
  const latest = clean[clean.length - 1];
  const ref = latest.high > latest.low && latest.close > 0 ? latest : clean[clean.length - 2];
  if (!ref || !Number.isFinite(ref.high) || !Number.isFinite(ref.low) || !Number.isFinite(ref.close)) {
    return null;
  }
  const H = ref.high;
  const L = ref.low;
  const C = ref.close;
  const P = (H + L + C) / 3;
  const r1 = 2 * P - L;
  const s1 = 2 * P - H;
  const r2 = P + (H - L);
  const s2 = P - (H - L);
  const r3 = H + 2 * (P - L);
  const s3 = L - 2 * (H - P);
  const basisDate = ref.timestamp > 0 ? new Date(toEpochMs(ref.timestamp)).toISOString().slice(0, 10) : ref.dateLabel || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return {
    pivot: round22(P),
    r1: round22(r1),
    r2: round22(r2),
    r3: round22(r3),
    s1: round22(s1),
    s2: round22(s2),
    s3: round22(s3),
    basisDate
  };
}
function computeTechnicalSummaryFromCandles(candles, livePrice) {
  const clean = candles.filter(
    (c) => Number.isFinite(c.close) && c.close > 0 && Number.isFinite(c.high) && Number.isFinite(c.low)
  );
  if (clean.length < 25 || !Number.isFinite(livePrice) || livePrice <= 0) {
    return null;
  }
  const daily = computeTimeframeSummary(clean, livePrice);
  if (!daily) return null;
  const weeklyCandles = aggregateWeeklyCandles(clean);
  const weekly = weeklyCandles.length >= 22 ? computeTimeframeSummary(weeklyCandles, livePrice) : null;
  const pivots = computeClassicPivots(clean);
  return {
    ...daily,
    weekly,
    pivots,
    computedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var INDIAN_SECTOR_BASELINES = [
  { match: /bank/i, pe: 16.5, evEbitda: 11, isFinancial: true },
  { match: /financ|nbfc|insur|capital market/i, pe: 24.5, evEbitda: 14, isFinancial: true },
  { match: /\bit\b|tech|software|services/i, pe: 23, evEbitda: 15.5 },
  { match: /energy|oil|gas|power|utilit|conglomerate/i, pe: 19.5, evEbitda: 12.8 },
  { match: /metal|mining|commodit|cement|material/i, pe: 15.5, evEbitda: 9.2 },
  { match: /auto|mobility/i, pe: 23.5, evEbitda: 14.5 },
  { match: /pharma|health|hospital/i, pe: 26.5, evEbitda: 17.5 },
  { match: /fmcg|consumer|retail|telecom/i, pe: 29, evEbitda: 20.5 },
  { match: /infra|capital goods|industrial|defence|engineering/i, pe: 24.5, evEbitda: 15.5 }
];
function getSectorBaseline(sector) {
  const sectorClean = (sector || "").trim();
  for (const rule of INDIAN_SECTOR_BASELINES) {
    if (rule.match.test(sectorClean)) {
      return {
        pe: rule.pe,
        evEbitda: rule.evEbitda,
        isFinancial: Boolean(rule.isFinancial)
      };
    }
  }
  const sectorLower = sectorClean.toLowerCase();
  const sectorPeers = INDIAN_STOCK_UNIVERSE.filter(
    (s) => s.sector.toLowerCase() === sectorLower && typeof s.peRatio === "number" && s.peRatio > 6 && s.peRatio < 85
  ).map((s) => s.peRatio).sort((a, b) => a - b);
  if (sectorPeers.length >= 2) {
    const mid = Math.floor(sectorPeers.length / 2);
    const med = sectorPeers.length % 2 === 1 ? sectorPeers[mid] : (sectorPeers[mid - 1] + sectorPeers[mid]) / 2;
    return {
      pe: clamp2(med, 14, 30),
      evEbitda: 14,
      isFinancial: /bank|financ|nbfc|insur/i.test(sectorLower)
    };
  }
  return { pe: 22, evEbitda: 14, isFinancial: false };
}
function computeIntrinsicFairValue(params) {
  const { symbol, sector, livePrice, peRatio, roce, fundamentals } = params;
  if (!symbol || symbol.startsWith("^") || !Number.isFinite(livePrice) || livePrice <= 0) {
    return null;
  }
  const trailingPE = fundamentals?.trailingPE ?? peRatio ?? null;
  const forwardPE = fundamentals?.forwardPE ?? null;
  const priceToBook = fundamentals?.priceToBook ?? null;
  const evToEbitda = fundamentals?.evToEbitda ?? null;
  const roe = fundamentals?.roePct ?? fundamentals?.roceProxyPct ?? roce ?? null;
  const revGrowth = fundamentals?.revenueGrowthPct ?? null;
  const earnGrowth = fundamentals?.earningsGrowthPct ?? null;
  const fcfMargin = fundamentals?.fcfMarginPct ?? null;
  const opMargin = fundamentals?.operatingMarginPct ?? null;
  const sectorInfo = getSectorBaseline(sector);
  const sectorMedianPE = round22(sectorInfo.pe);
  const validTrailingPE = trailingPE !== null && trailingPE > 3 && trailingPE < 220 ? trailingPE : null;
  const validForwardPE = forwardPE !== null && forwardPE > 3 && forwardPE < 220 ? forwardPE : null;
  const trailingEps = validTrailingPE !== null ? livePrice / validTrailingPE : null;
  const rawForwardEps = validForwardPE !== null ? livePrice / validForwardPE : null;
  const cappedForwardEps = rawForwardEps !== null && trailingEps !== null ? clamp2(rawForwardEps, trailingEps * 0.8, trailingEps * 1.28) : rawForwardEps;
  const anchorEps = trailingEps !== null && cappedForwardEps !== null ? trailingEps * 0.55 + cappedForwardEps * 0.45 : cappedForwardEps ?? trailingEps;
  const growthInputs = [earnGrowth, revGrowth].filter(
    (g) => typeof g === "number" && Number.isFinite(g)
  );
  const rawBlendedGrowth = growthInputs.length > 0 ? growthInputs.reduce((a, b) => a + b, 0) / growthInputs.length : roe !== null ? clamp2(roe * 0.48, 4, 18) : 10;
  const sustainableGrowth = clamp2(
    rawBlendedGrowth > 20 ? 20 + (rawBlendedGrowth - 20) * 0.35 : rawBlendedGrowth,
    -5,
    25
  );
  const rawModels = [];
  if (anchorEps !== null && anchorEps > 0) {
    const roeAdj = roe !== null ? clamp2(1 + (roe - 16) * 6e-3, 0.9, 1.15) : 1;
    const highGrowthFinBonus = sectorInfo.isFinancial && sustainableGrowth >= 18 ? clamp2(1 + (sustainableGrowth - 16) * 0.015, 1, 1.16) : 1;
    const peerTargetPE = clamp2(sectorMedianPE * roeAdj * highGrowthFinBonus, 10, 36);
    const val = clamp2(anchorEps * peerTargetPE, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: "Sector Peer P/E",
      value: round22(val),
      rawWeight: 0.38,
      basis: `${peerTargetPE.toFixed(1)}x adj. multiple (sector baseline ${sectorMedianPE.toFixed(1)}x)`
    });
  }
  if (anchorEps !== null && anchorEps > 0) {
    const baseMultiple = sectorInfo.isFinancial ? 11.5 : 12;
    const growthSlope = sectorInfo.isFinancial ? 0.56 : 0.52;
    const qualityBonus = (roe !== null ? clamp2((roe - 15) * 0.14, -2, 3.5) : 0) + (!sectorInfo.isFinancial && fcfMargin !== null ? fcfMargin >= 12 ? 1.8 : fcfMargin < 0 ? -1.8 : 0 : 0);
    const garpPE = clamp2(baseMultiple + sustainableGrowth * growthSlope + qualityBonus, 10, 36);
    const val = clamp2(anchorEps * garpPE, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: "GARP Growth Multiple",
      value: round22(val),
      rawWeight: 0.36,
      basis: `${garpPE.toFixed(1)}x fair P/E (${sustainableGrowth >= 0 ? "+" : ""}${sustainableGrowth.toFixed(1)}% sustainable pace)`
    });
  }
  if (!sectorInfo.isFinancial && evToEbitda !== null && evToEbitda > 3 && evToEbitda < 55) {
    const growthAdj = clamp2(1 + (sustainableGrowth - 12) * 0.012, 0.88, 1.18);
    const marginAdj = opMargin !== null ? clamp2(1 + (opMargin - 14) * 4e-3, 0.92, 1.12) : 1;
    const fairEvEbitda = clamp2(sectorInfo.evEbitda * growthAdj * marginAdj, 6.5, 28);
    const ratio = clamp2(fairEvEbitda / evToEbitda, 0.68, 1.5);
    const val = clamp2(livePrice * ratio, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: "EV/EBITDA Multiple",
      value: round22(val),
      rawWeight: 0.26,
      basis: `${fairEvEbitda.toFixed(1)}x fair EV/EBITDA vs live ${evToEbitda.toFixed(1)}x`
    });
  } else if (sectorInfo.isFinancial && priceToBook !== null && priceToBook > 0.3 && priceToBook < 12 && roe !== null && roe > 4) {
    const bvps = livePrice / priceToBook;
    const costOfEquity = 10.8;
    const retainedG = clamp2(sustainableGrowth * 0.36, 2.5, Math.min(8.6, roe * 0.5));
    const baseGordonPB = (roe - retainedG) / Math.max(2.2, costOfEquity - retainedG);
    const franchisePremium = sustainableGrowth >= 16 && roe >= 16 ? clamp2((sustainableGrowth - 15) * 0.08, 0, 0.8) : 0;
    const fairPB = clamp2(baseGordonPB + franchisePremium, 0.95, 5.8);
    const val = clamp2(bvps * fairPB, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: "2-Stage Franchise P/B",
      value: round22(val),
      rawWeight: 0.26,
      basis: `${fairPB.toFixed(2)}x fair P/B (ROE ${roe.toFixed(1)}% vs live ${priceToBook.toFixed(2)}x)`
    });
  } else if (anchorEps !== null && anchorEps > 0) {
    const indiaRiskFree = 6.9;
    const marginQualityAdj = (opMargin !== null ? clamp2((opMargin - 16) * 0.04, -0.6, 0.7) : 0) + (fcfMargin !== null ? clamp2((fcfMargin - 8) * 0.05, -0.5, 0.6) : 0);
    const targetEarningsYieldPct = clamp2(
      indiaRiskFree - sustainableGrowth * 0.14 - marginQualityAdj,
      3.5,
      8.5
    );
    const yieldFairPE = 100 / targetEarningsYieldPct;
    const val = clamp2(anchorEps * yieldFairPE, livePrice * 0.65, livePrice * 1.55);
    rawModels.push({
      name: "Earnings Yield DCF",
      value: round22(val),
      rawWeight: 0.26,
      basis: `${targetEarningsYieldPct.toFixed(1)}% req. yield (${yieldFairPE.toFixed(1)}x vs 6.9% G-Sec)`
    });
  }
  if (rawModels.length === 0) return null;
  const weightSum = rawModels.reduce((acc, m) => acc + m.rawWeight, 0);
  const models = rawModels.map((m) => ({
    name: m.name,
    value: m.value,
    weightPct: Math.round(m.rawWeight / weightSum * 100),
    basis: m.basis
  }));
  const fairValue = round22(
    rawModels.reduce((acc, m) => acc + m.value * (m.rawWeight / weightSum), 0)
  );
  const upsidePercent = round22((fairValue - livePrice) / livePrice * 100);
  const values = models.map((m) => m.value);
  const spreadPct = values.length >= 2 ? (Math.max(...values) - Math.min(...values)) / Math.max(1, fairValue) * 100 : 16;
  const uncertainty = models.length >= 3 && spreadPct <= 20 ? "Low" : models.length >= 2 && spreadPct <= 35 ? "Medium" : "High";
  const bandPct = uncertainty === "Low" ? 0.08 : uncertainty === "Medium" ? 0.12 : 0.16;
  const lowEstimate = round22(Math.min(Math.min(...values), fairValue * (1 - bandPct)));
  const highEstimate = round22(Math.max(Math.max(...values), fairValue * (1 + bandPct)));
  const verdict = upsidePercent >= 8 ? "Undervalued" : upsidePercent <= -8 ? "Overvalued" : "Fairly Valued";
  return {
    fairValue,
    lowEstimate,
    highEstimate,
    upsidePercent,
    verdict,
    uncertainty,
    sectorMedianPE,
    models,
    basisNote: `Blends ${models.length} valuation ${models.length === 1 ? "model" : "models"} (${models.map((m) => m.name).join(" \xB7 ")}) vs live \u20B9${livePrice.toFixed(0)}.`
  };
}

// server/historicalBacktestService.ts
var FLAGSHIP_17_NSE_SYMBOLS = [
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "ICICIBANK.NS",
  "INFY.NS",
  "BAJFINANCE.NS",
  "SBIN.NS",
  "BHARTIARTL.NS",
  "LT.NS",
  "ITC.NS",
  "KOTAKBANK.NS",
  "SUNPHARMA.NS",
  "M&M.NS",
  "AXISBANK.NS",
  "HCLTECH.NS",
  "TITAN.NS",
  "NTPC.NS"
];
var BACKTEST_HORIZONS = [
  { days: 21, label: "1M" },
  { days: 63, label: "3M" },
  { days: 126, label: "6M" },
  { days: 252, label: "1Y" },
  { days: 1260, label: "5Y" },
  { days: 2520, label: "10Y" }
];
var TRAIN_CUTOFF_DATE = "2023-12-31";
var HISTORY_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
var RUN_CACHE_TTL_MS = 60 * 60 * 1e3;
var YAHOO_HEADERS2 = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json"
};
var historyCache = /* @__PURE__ */ new Map();
var runCache = /* @__PURE__ */ new Map();
var latestCalibrationRun = null;
var baselineWarmPromise = null;
function clamp3(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function round23(v) {
  return Number(v.toFixed(2));
}
function round3(v) {
  return Number(v.toFixed(3));
}
function mean(arr) {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function median(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, x) => sum + (x - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(Math.max(0, variance));
}
function toIsoDateFromEpochSec(tsSec) {
  const istMs = tsSec * 1e3 + 5.5 * 3600 * 1e3;
  return new Date(istMs).toISOString().slice(0, 10);
}
function daysBetweenIso(d1, d2) {
  const t1 = Date.parse(`${d1}T00:00:00Z`);
  const t2 = Date.parse(`${d2}T00:00:00Z`);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 0;
  return Math.round((t2 - t1) / (24 * 3600 * 1e3));
}
async function runWithConcurrency3(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => runner());
  await Promise.all(workers);
  return results;
}
async function fetchYahoo10YSeries(symbolInput) {
  const symbol = resolveActiveMarketSymbol(symbolInput);
  const cached = historyCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const catalog = findCatalogEntry(symbol);
  const ticker = catalog?.ticker || symbol.replace(/\.(NS|BO)$/, "");
  const companyName = catalog?.name || ticker;
  const sector = catalog?.sector || (symbol.startsWith("^") ? "Index" : "Equities");
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=10y&interval=1d&includePrePost=false&events=div,split`;
  let payload = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: YAHOO_HEADERS2,
        signal: AbortSignal.timeout(12e3)
      });
      if (res.ok) {
        payload = await res.json();
        break;
      }
      if (res.status === 404) break;
    } catch {
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const adjCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  const dividendEvents = Object.keys(result?.events?.dividends ?? {}).length;
  const splitEvents = Object.keys(result?.events?.splits ?? {}).length;
  const dedupedByDate = /* @__PURE__ */ new Map();
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const close = quote?.close?.[i];
    if (typeof ts !== "number" || typeof close !== "number" || !Number.isFinite(close) || close <= 0) {
      continue;
    }
    const rawOpen = quote?.open?.[i];
    const rawHigh = quote?.high?.[i];
    const rawLow = quote?.low?.[i];
    const rawVol = quote?.volume?.[i];
    const rawAdj = adjCloses[i];
    const open = typeof rawOpen === "number" && Number.isFinite(rawOpen) && rawOpen > 0 ? rawOpen : close;
    const highCandidate = typeof rawHigh === "number" && Number.isFinite(rawHigh) && rawHigh > 0 ? rawHigh : Math.max(open, close);
    const lowCandidate = typeof rawLow === "number" && Number.isFinite(rawLow) && rawLow > 0 ? rawLow : Math.min(open, close);
    const high = Math.max(highCandidate, open, close);
    const low = Math.min(lowCandidate, open, close);
    const adjClose = typeof rawAdj === "number" && Number.isFinite(rawAdj) && rawAdj > 0 ? rawAdj : close;
    const volume = typeof rawVol === "number" && Number.isFinite(rawVol) && rawVol >= 0 ? rawVol : 0;
    const date = toIsoDateFromEpochSec(ts);
    dedupedByDate.set(date, {
      date,
      timestamp: ts,
      open: round23(open),
      high: round23(high),
      low: round23(low),
      close: round23(close),
      adjClose: round3(adjClose),
      volume
    });
  }
  const bars = Array.from(dedupedByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  let missingGapWarnings = 0;
  for (let i = 1; i < bars.length; i++) {
    if (daysBetweenIso(bars[i - 1].date, bars[i].date) > 12) {
      missingGapWarnings++;
    }
  }
  const startDate = bars.length > 0 ? bars[0].date : null;
  const endDate = bars.length > 0 ? bars[bars.length - 1].date : null;
  const historyYears = startDate && endDate ? round23(Math.max(0, daysBetweenIso(startDate, endDate) / 365.25)) : 0;
  let status = "OK";
  let note = `${bars.length} daily bars \xB7 ${dividendEvents} dividends \xB7 ${splitEvents} splits`;
  if (bars.length < 240) {
    status = "UNAVAILABLE";
    note = bars.length === 0 ? "No 10Y Yahoo Finance OHLCV history available for this symbol." : `Insufficient history (${bars.length} sessions; minimum 240 required after 200-DMA warm-up).`;
  } else if (historyYears < 7.5) {
    status = "PARTIAL_HISTORY";
    note = `Recent listing or partial Yahoo history (${historyYears.toFixed(1)} yrs, ${bars.length} bars).`;
  }
  const loaded = {
    symbol,
    ticker,
    companyName: result?.meta?.shortName || companyName,
    sector,
    bars,
    dividendEvents,
    splitEvents,
    missingGapWarnings,
    quality: {
      symbol,
      ticker,
      status,
      barsCount: bars.length,
      startDate,
      endDate,
      historyYears,
      dividendEvents,
      splitEvents,
      missingGapWarnings,
      note
    }
  };
  historyCache.set(symbol, { data: loaded, expiresAt: Date.now() + HISTORY_CACHE_TTL_MS });
  return loaded;
}
function precomputePointInTimeIndicators(bars) {
  const n = bars.length;
  const closes = bars.map((b) => b.close);
  const sma2 = (period) => {
    const out = new Array(n).fill(null);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += closes[i];
      if (i >= period) sum -= closes[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  };
  const ema20 = new Array(n).fill(null);
  const k = 2 / 21;
  let emaVal = null;
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
  const rsi14 = new Array(n).fill(null);
  if (n > 14) {
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gainSum += diff;
      else lossSum -= diff;
    }
    let avgGain = gainSum / 14;
    let avgLoss = lossSum / 14;
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
  const dailyRets = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    dailyRets[i] = closes[i - 1] > 0 ? (closes[i] - closes[i - 1]) / closes[i - 1] : 0;
  }
  const vol30Ann = new Array(n).fill(null);
  for (let i = 30; i < n; i++) {
    const window = dailyRets.slice(i - 29, i + 1);
    vol30Ann[i] = stdDev(window) * Math.sqrt(252) * 100;
  }
  const pctRet = (lookback) => {
    const out = new Array(n).fill(null);
    for (let i = lookback; i < n; i++) {
      const base = closes[i - lookback];
      if (base > 0) out[i] = (closes[i] - base) / base * 100;
    }
    return out;
  };
  const high252 = new Array(n).fill(null);
  const low252 = new Array(n).fill(null);
  for (let i = 200; i < n; i++) {
    const start = Math.max(0, i - 251);
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = start; j <= i; j++) {
      if (bars[j].high > hi) hi = bars[j].high;
      if (bars[j].low < lo) lo = bars[j].low;
    }
    high252[i] = hi;
    low252[i] = lo;
  }
  return {
    sma20: sma2(20),
    sma50: sma2(50),
    sma200: sma2(200),
    ema20,
    rsi14,
    vol30Ann,
    ret21: pctRet(21),
    ret63: pctRet(63),
    ret126: pctRet(126),
    high252,
    low252
  };
}
function reconstructPointInTimeSignal(params) {
  const {
    price,
    sma50,
    sma200,
    ema20,
    rsi14,
    vol30Ann,
    ret21,
    ret63,
    ret126,
    high252,
    low252,
    niftyRet21,
    niftyRet63,
    niftyRet126
  } = params;
  const beta = clamp3(params.betaEst || 1, 0.65, 1.7);
  let trendScore = 50;
  if (sma200 && sma200 > 0) {
    const dist200 = (price - sma200) / sma200 * 100;
    trendScore += dist200 >= 0 ? clamp3(8 + dist200 * 0.7, 8, 22) : clamp3(dist200 * 1.1, -24, -6);
  }
  if (sma50 && sma50 > 0) {
    const dist50 = (price - sma50) / sma50 * 100;
    trendScore += dist50 >= 0 ? clamp3(6 + dist50 * 0.6, 6, 14) : clamp3(dist50 * 0.9, -14, -4);
  }
  if (ema20 && sma50 && sma50 > 0) {
    trendScore += ema20 >= sma50 ? 6 : -6;
  }
  if (sma50 && sma200 && sma200 > 0) {
    trendScore += sma50 >= sma200 ? 6 : -6;
  }
  if (high252 && low252 && high252 > low252) {
    const pos = (price - low252) / (high252 - low252);
    trendScore += (pos - 0.5) * 14;
  }
  trendScore = clamp3(trendScore, 5, 98);
  const ex1m = ret21 !== null && niftyRet21 !== null ? ret21 - niftyRet21 : ret21 ?? 0;
  const ex3m = ret63 !== null && niftyRet63 !== null ? ret63 - niftyRet63 : ret63 ?? 0;
  const ex6m = ret126 !== null && niftyRet126 !== null ? ret126 - niftyRet126 : ret126 ?? 0;
  const blendedExcess = ex1m * 0.25 + ex3m * 0.35 + ex6m * 0.4;
  const rsScore = clamp3(52 + blendedExcess * 1.65, 5, 98);
  let momScore = 52;
  if (rsi14 !== null) {
    if (rsi14 >= 50 && rsi14 <= 68) momScore += 18;
    else if (rsi14 >= 42 && rsi14 < 50) momScore += 8;
    else if (rsi14 > 68 && rsi14 <= 76) momScore += 6;
    else if (rsi14 > 76) momScore -= 10;
    else if (rsi14 >= 32 && rsi14 < 42) momScore -= 6;
    else momScore -= 16;
  }
  if (ret63 !== null) {
    momScore += clamp3(ret63 * 0.45, -14, 16);
  }
  if (vol30Ann !== null) {
    if (vol30Ann <= 24) momScore += 8;
    else if (vol30Ann <= 36) momScore += 2;
    else if (vol30Ann >= 52) momScore -= 12;
  }
  momScore = clamp3(momScore, 5, 98);
  const rawConfidence = round23(
    clamp3(trendScore * 0.4 + rsScore * 0.33 + momScore * 0.27, 15, 95)
  );
  const above200 = sma200 !== null ? price >= sma200 : true;
  const above50 = sma50 !== null ? price >= sma50 : true;
  const rsiOverbought = rsi14 !== null && rsi14 >= 78;
  let verdict = "HOLD";
  if (rawConfidence >= 60 && above200 && !rsiOverbought) {
    verdict = "BUY";
  } else if (rawConfidence >= 68 && above50 && !rsiOverbought) {
    verdict = "BUY";
  } else if (rawConfidence < 44 || !above200 && rawConfidence < 50 && ex6m < -6) {
    verdict = "EXIT";
  }
  const conviction = verdict === "BUY" && rawConfidence >= 72 || verdict === "EXIT" && rawConfidence <= 35 ? "High" : rawConfidence >= 52 || verdict === "EXIT" ? "Medium" : "Low";
  const targetUpsidePct = verdict === "BUY" ? clamp3(12 + 5.5 * beta + (rawConfidence - 60) * 0.16, 11, 26) : verdict === "HOLD" ? clamp3(9 + 4 * beta, 8, 18) : clamp3(6 + 2 * beta, 5, 11);
  const stopDownsidePct = verdict === "BUY" ? clamp3(6.5 + 3.5 * beta, 6.5, 14) : clamp3(6 + 3.2 * beta, 6, 13.5);
  return {
    verdict,
    conviction,
    rawConfidence,
    targetPrice: round23(price * (1 + targetUpsidePct / 100)),
    stopLossPrice: round23(price * (1 - stopDownsidePct / 100)),
    betaEst: round23(beta)
  };
}
function simulateSignalExecution(params) {
  const {
    bars,
    signalIdx,
    verdict,
    targetPrice,
    stopLossPrice,
    horizonDays,
    horizonLabel,
    costBps,
    niftyByDate
  } = params;
  const entryIdx = signalIdx + 1;
  if (entryIdx >= bars.length || entryIdx < 0) {
    return {
      horizonDays,
      horizonLabel,
      status: "DATA_UNAVAILABLE",
      firstHit: "PENDING",
      exitDate: null,
      exitPrice: null,
      daysHeld: null,
      grossPriceReturnPct: null,
      netPriceReturnPct: null,
      grossTotalReturnPct: null,
      netTotalReturnPct: null,
      niftyReturnPct: null,
      excessReturnPct: null,
      maxDrawdownPct: null,
      maxFavorableExcursionPct: null,
      won: null,
      exitAvoidedLoss: null
    };
  }
  const entryBar = bars[entryIdx];
  const entryPrice = entryBar.open;
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return {
      horizonDays,
      horizonLabel,
      status: "DATA_UNAVAILABLE",
      firstHit: "PENDING",
      exitDate: null,
      exitPrice: null,
      daysHeld: null,
      grossPriceReturnPct: null,
      netPriceReturnPct: null,
      grossTotalReturnPct: null,
      netTotalReturnPct: null,
      niftyReturnPct: null,
      excessReturnPct: null,
      maxDrawdownPct: null,
      maxFavorableExcursionPct: null,
      won: null,
      exitAvoidedLoss: null
    };
  }
  const horizonEndIdx = entryIdx + horizonDays;
  const maxScanIdx = Math.min(horizonEndIdx, bars.length - 1);
  let status = null;
  let firstHit = "NONE";
  let exitIdx = maxScanIdx;
  let exitPrice = bars[maxScanIdx].close;
  let runningPeak = entryPrice;
  let maxDd = 0;
  let maxMfe = 0;
  const monitorBarriers = verdict !== "EXIT";
  for (let j = entryIdx; j <= maxScanIdx; j++) {
    const bar = bars[j];
    const barHigh = Math.max(bar.high, bar.open, bar.close);
    const barLow = Math.min(bar.low, bar.open, bar.close);
    if (barHigh > runningPeak) runningPeak = barHigh;
    const ddHere = runningPeak > 0 ? (barLow - runningPeak) / runningPeak * 100 : 0;
    if (ddHere < maxDd) maxDd = ddHere;
    const mfeHere = (barHigh - entryPrice) / entryPrice * 100;
    if (mfeHere > maxMfe) maxMfe = mfeHere;
    if (!monitorBarriers) continue;
    if (j > entryIdx) {
      if (bar.open <= stopLossPrice) {
        status = "STOP_HIT";
        firstHit = "STOP";
        exitIdx = j;
        exitPrice = bar.open;
        break;
      }
      if (bar.open >= targetPrice) {
        status = "TARGET_HIT";
        firstHit = "TARGET";
        exitIdx = j;
        exitPrice = bar.open;
        break;
      }
    }
    const hitStop = barLow <= stopLossPrice;
    const hitTarget = barHigh >= targetPrice;
    if (hitStop && hitTarget) {
      status = "BOTH_SAME_BAR";
      firstHit = "STOP";
      exitIdx = j;
      exitPrice = stopLossPrice;
      break;
    }
    if (hitStop) {
      status = "STOP_HIT";
      firstHit = "STOP";
      exitIdx = j;
      exitPrice = stopLossPrice;
      break;
    }
    if (hitTarget) {
      status = "TARGET_HIT";
      firstHit = "TARGET";
      exitIdx = j;
      exitPrice = targetPrice;
      break;
    }
  }
  if (status === null) {
    if (horizonEndIdx >= bars.length) {
      return {
        horizonDays,
        horizonLabel,
        status: "PENDING",
        firstHit: "PENDING",
        exitDate: null,
        exitPrice: null,
        daysHeld: bars.length - 1 - entryIdx,
        grossPriceReturnPct: null,
        netPriceReturnPct: null,
        grossTotalReturnPct: null,
        netTotalReturnPct: null,
        niftyReturnPct: null,
        excessReturnPct: null,
        maxDrawdownPct: round23(Math.abs(maxDd)),
        maxFavorableExcursionPct: round23(maxMfe),
        won: null,
        exitAvoidedLoss: null
      };
    }
    status = "HORIZON_EXPIRED";
    firstHit = "NONE";
    exitIdx = horizonEndIdx;
    exitPrice = bars[horizonEndIdx].close;
  }
  const exitBar = bars[exitIdx];
  const costRate = clamp3(costBps, 0, 200) / 1e4;
  const grossPriceFactor = exitPrice / entryPrice;
  const grossPriceReturnPct = (grossPriceFactor - 1) * 100;
  const netPriceFactor = exitPrice * (1 - costRate) / (entryPrice * (1 + costRate));
  const netPriceReturnPct = (netPriceFactor - 1) * 100;
  const entryAdjRatio = entryBar.close > 0 ? entryBar.adjClose / entryBar.close : 1;
  const exitAdjRatio = exitBar.close > 0 ? exitBar.adjClose / exitBar.close : 1;
  const dividendCompoundingFactor = entryAdjRatio > 0 && exitAdjRatio > 0 ? clamp3(exitAdjRatio / entryAdjRatio, 0.85, 3) : 1;
  const grossTotalFactor = grossPriceFactor * dividendCompoundingFactor;
  const grossTotalReturnPct = (grossTotalFactor - 1) * 100;
  const netTotalFactor = netPriceFactor * dividendCompoundingFactor;
  const netTotalReturnPct = (netTotalFactor - 1) * 100;
  const niftyEntry = lookupNearestPriorValue(niftyByDate, entryBar.date);
  const niftyExit = lookupNearestPriorValue(niftyByDate, exitBar.date);
  const niftyReturnPct = niftyEntry !== null && niftyExit !== null && niftyEntry > 0 ? (niftyExit - niftyEntry) / niftyEntry * 100 : null;
  const excessReturnPct = niftyReturnPct !== null ? netTotalReturnPct - niftyReturnPct : null;
  const won = verdict === "EXIT" ? null : netTotalReturnPct > 0;
  const exitAvoidedLoss = verdict === "EXIT" ? netTotalReturnPct < 0 : null;
  return {
    horizonDays,
    horizonLabel,
    status,
    firstHit,
    exitDate: exitBar.date,
    exitPrice: round23(exitPrice),
    daysHeld: Math.max(1, exitIdx - entryIdx + 1),
    grossPriceReturnPct: round23(grossPriceReturnPct),
    netPriceReturnPct: round23(netPriceReturnPct),
    grossTotalReturnPct: round23(grossTotalReturnPct),
    netTotalReturnPct: round23(netTotalReturnPct),
    niftyReturnPct: niftyReturnPct !== null ? round23(niftyReturnPct) : null,
    excessReturnPct: excessReturnPct !== null ? round23(excessReturnPct) : null,
    maxDrawdownPct: round23(Math.abs(maxDd)),
    maxFavorableExcursionPct: round23(maxMfe),
    won,
    exitAvoidedLoss
  };
}
function lookupNearestPriorValue(map, isoDate) {
  const exact = map.get(isoDate);
  if (exact !== void 0) return exact;
  const baseMs = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(baseMs)) return null;
  for (let d = 1; d <= 7; d++) {
    const prevIso = new Date(baseMs - d * 24 * 3600 * 1e3).toISOString().slice(0, 10);
    const val = map.get(prevIso);
    if (val !== void 0) return val;
  }
  return null;
}
function estimatePointInTimeBeta(stockBars, idx, niftyRetByDate) {
  const lookback = Math.min(126, idx);
  if (lookback < 40) return 1;
  const sRets = [];
  const nRets = [];
  for (let i = idx - lookback + 1; i <= idx; i++) {
    const prev = stockBars[i - 1].close;
    const curr = stockBars[i].close;
    const nr = niftyRetByDate.get(stockBars[i].date);
    if (prev > 0 && curr > 0 && nr !== void 0) {
      sRets.push((curr - prev) / prev);
      nRets.push(nr);
    }
  }
  if (sRets.length < 30) return 1;
  const meanS = sRets.reduce((a, b) => a + b, 0) / sRets.length;
  const meanN = nRets.reduce((a, b) => a + b, 0) / nRets.length;
  let cov = 0;
  let varN = 0;
  for (let i = 0; i < sRets.length; i++) {
    cov += (sRets[i] - meanS) * (nRets[i] - meanN);
    varN += (nRets[i] - meanN) ** 2;
  }
  if (varN <= 1e-10) return 1;
  return clamp3(cov / varN, 0.65, 1.7);
}
function wilsonIntervalPct(wins, n) {
  if (n <= 0) return { low: null, high: null };
  const z = 1.96;
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n) / denom;
  return {
    low: round23(clamp3((center - margin) * 100, 0, 100)),
    high: round23(clamp3((center + margin) * 100, 0, 100))
  };
}
function fitIsotonicBuckets(buckets) {
  const priorWeight = 3;
  const blocks = buckets.map((b, idx) => ({
    start: idx,
    end: idx,
    weight: b.count + priorWeight,
    sum: b.wins + b.fallbackProb * priorWeight
  }));
  let i = 0;
  while (i < blocks.length - 1) {
    const avgCur = blocks[i].sum / blocks[i].weight;
    const avgNext = blocks[i + 1].sum / blocks[i + 1].weight;
    if (avgCur > avgNext) {
      blocks[i] = {
        start: blocks[i].start,
        end: blocks[i + 1].end,
        weight: blocks[i].weight + blocks[i + 1].weight,
        sum: blocks[i].sum + blocks[i + 1].sum
      };
      blocks.splice(i + 1, 1);
      if (i > 0) i--;
    } else {
      i++;
    }
  }
  const result = new Array(buckets.length).fill(0.5);
  for (const blk of blocks) {
    const val = clamp3(blk.sum / blk.weight, 0.05, 0.95);
    for (let k = blk.start; k <= blk.end; k++) {
      result[k] = val;
    }
  }
  return result;
}
var CALIBRATION_BUCKET_DEFS = [
  { label: "< 45", min: 0, max: 45 },
  { label: "45\u201355", min: 45, max: 55 },
  { label: "55\u201365", min: 55, max: 65 },
  { label: "65\u201375", min: 65, max: 75 },
  { label: "75\u201385", min: 75, max: 85 },
  { label: "85+", min: 85, max: 101 }
];
function findConfidenceBucketIndex(score) {
  for (let i = 0; i < CALIBRATION_BUCKET_DEFS.length; i++) {
    const b = CALIBRATION_BUCKET_DEFS[i];
    if (score >= b.min && score < b.max) return i;
  }
  return CALIBRATION_BUCKET_DEFS.length - 1;
}
function computeCalibrationReport(signals, horizonDays, horizonLabel) {
  const key = String(horizonDays);
  const resolvedLongs = signals.filter((s) => {
    const out = s.outcomes[key];
    return s.verdict !== "EXIT" && out && out.won !== null && out.status !== "PENDING" && out.status !== "DATA_UNAVAILABLE";
  });
  const trainLongs = resolvedLongs.filter((s) => s.split === "TRAIN");
  const oosLongs = resolvedLongs.filter((s) => s.split === "OOS");
  const trainBaseRate = trainLongs.length > 0 ? trainLongs.filter((s) => s.outcomes[key]?.won === true).length / trainLongs.length : 0.55;
  const trainPerBucket = CALIBRATION_BUCKET_DEFS.map((b) => {
    const items = trainLongs.filter((s) => s.rawConfidence >= b.min && s.rawConfidence < b.max);
    const wins = items.filter((s) => s.outcomes[key]?.won === true).length;
    return { items, wins, count: items.length };
  });
  const isotonicProbs = fitIsotonicBuckets(
    trainPerBucket.map((b) => ({
      wins: b.wins,
      count: b.count,
      fallbackProb: trainBaseRate
    }))
  );
  let rawBrierSum = 0;
  let calBrierSum = 0;
  let rawLogLossSum = 0;
  let calLogLossSum = 0;
  let rawEceNum = 0;
  let calEceNum = 0;
  const buckets = CALIBRATION_BUCKET_DEFS.map((def, idx) => {
    const tr = trainPerBucket[idx];
    const oosItems = oosLongs.filter((s) => s.rawConfidence >= def.min && s.rawConfidence < def.max);
    const oosWins = oosItems.filter((s) => s.outcomes[key]?.won === true).length;
    const oosCalProb = isotonicProbs[idx];
    for (const s of oosItems) {
      const y = s.outcomes[key]?.won ? 1 : 0;
      const pRaw = clamp3(s.rawConfidence / 100, 0.01, 0.99);
      const pCal = clamp3(oosCalProb, 0.01, 0.99);
      rawBrierSum += (pRaw - y) ** 2;
      calBrierSum += (pCal - y) ** 2;
      rawLogLossSum += -(y * Math.log(pRaw) + (1 - y) * Math.log(1 - pRaw));
      calLogLossSum += -(y * Math.log(pCal) + (1 - y) * Math.log(1 - pCal));
    }
    const oosPredAvg = oosItems.length > 0 ? oosItems.reduce((sum, s) => sum + s.rawConfidence, 0) / oosItems.length : null;
    const oosActualPct = oosItems.length > 0 ? oosWins / oosItems.length * 100 : null;
    if (oosItems.length > 0 && oosPredAvg !== null && oosActualPct !== null) {
      rawEceNum += oosItems.length * Math.abs(oosPredAvg - oosActualPct);
      calEceNum += oosItems.length * Math.abs(oosCalProb * 100 - oosActualPct);
    }
    const ci = wilsonIntervalPct(oosWins, oosItems.length);
    const allBucketExcess = [...tr.items, ...oosItems].map((s) => s.outcomes[key]?.excessReturnPct).filter((v) => typeof v === "number");
    return {
      bucketLabel: def.label,
      minScore: def.min,
      maxScore: def.max,
      trainCount: tr.count,
      trainPredictedAvgPct: tr.count > 0 ? round23(tr.items.reduce((sum, s) => sum + s.rawConfidence, 0) / tr.count) : null,
      trainActualWinRatePct: tr.count > 0 ? round23(tr.wins / tr.count * 100) : null,
      oosCount: oosItems.length,
      oosPredictedAvgPct: oosPredAvg !== null ? round23(oosPredAvg) : null,
      oosActualWinRatePct: oosActualPct !== null ? round23(oosActualPct) : null,
      oosCalibratedProbPct: round23(oosCalProb * 100),
      oosCiLowPct: ci.low,
      oosCiHighPct: ci.high,
      avgExcessReturnPct: mean(allBucketExcess) !== null ? round23(mean(allBucketExcess)) : null
    };
  });
  const resolvedOosExits = signals.filter((s) => {
    const out = s.outcomes[key];
    return s.verdict === "EXIT" && s.split === "OOS" && out && out.netTotalReturnPct !== null && out.status !== "PENDING" && out.status !== "DATA_UNAVAILABLE";
  });
  const exitAvoidedNeg = resolvedOosExits.filter(
    (s) => (s.outcomes[key]?.netTotalReturnPct ?? 0) < 0
  ).length;
  const exitUnderperfNifty = resolvedOosExits.filter(
    (s) => (s.outcomes[key]?.excessReturnPct ?? 0) < 0
  ).length;
  const oosN = oosLongs.length;
  return {
    horizonDays,
    horizonLabel,
    trainCutoffDate: TRAIN_CUTOFF_DATE,
    trainSampleCount: trainLongs.length,
    oosSampleCount: oosN,
    rawBrierScoreOos: oosN > 0 ? round3(rawBrierSum / oosN) : null,
    calibratedBrierScoreOos: oosN > 0 ? round3(calBrierSum / oosN) : null,
    rawLogLossOos: oosN > 0 ? round3(rawLogLossSum / oosN) : null,
    calibratedLogLossOos: oosN > 0 ? round3(calLogLossSum / oosN) : null,
    rawEceOosPct: oosN > 0 ? round23(rawEceNum / oosN) : null,
    calibratedEceOosPct: oosN > 0 ? round23(calEceNum / oosN) : null,
    exitSignalCountOos: resolvedOosExits.length,
    exitAvoidedNegativeRateOosPct: resolvedOosExits.length > 0 ? round23(exitAvoidedNeg / resolvedOosExits.length * 100) : null,
    exitUnderperformedNiftyRateOosPct: resolvedOosExits.length > 0 ? round23(exitUnderperfNifty / resolvedOosExits.length * 100) : null,
    buckets
  };
}
function computeProfitFactor(returns) {
  let grossProfit = 0;
  let grossLoss = 0;
  for (const r of returns) {
    if (r > 0) grossProfit += r;
    else if (r < 0) grossLoss += Math.abs(r);
  }
  if (grossLoss <= 1e-4) return grossProfit > 0 ? 9.99 : null;
  return round23(Math.min(9.99, grossProfit / grossLoss));
}
function classifyStockEdgeTier(winRate3M, avgExcess3M, profitFactor3M) {
  if (winRate3M === null) return "Neutral";
  const pf = profitFactor3M ?? 1;
  const ex = avgExcess3M ?? 0;
  if (winRate3M >= 60 && ex >= 1.2 && pf >= 1.5) return "Strong";
  if (winRate3M >= 52 && ex >= -0.5 && pf >= 1.15) return "Moderate";
  if (winRate3M < 44 || ex < -3 && pf < 0.9) return "Weak";
  return "Neutral";
}
function buildHorizonSummary(signals, horizonDays, horizonLabel) {
  const key = String(horizonDays);
  const buySignals = signals.filter((s) => s.verdict === "BUY");
  const resolvedBuys = buySignals.filter((s) => {
    const o = s.outcomes[key];
    return o && o.status !== "PENDING" && o.status !== "DATA_UNAVAILABLE" && o.netTotalReturnPct !== null;
  });
  const pendingBuys = buySignals.filter((s) => s.outcomes[key]?.status === "PENDING");
  const resolvedExits = signals.filter((s) => {
    const o = s.outcomes[key];
    return s.verdict === "EXIT" && o && o.status !== "PENDING" && o.status !== "DATA_UNAVAILABLE" && o.netTotalReturnPct !== null;
  });
  const netPriceRets = resolvedBuys.map((s) => s.outcomes[key].netPriceReturnPct);
  const netTotalRets = resolvedBuys.map((s) => s.outcomes[key].netTotalReturnPct);
  const niftyRets = resolvedBuys.map((s) => s.outcomes[key].niftyReturnPct).filter((v) => v !== null);
  const excessRets = resolvedBuys.map((s) => s.outcomes[key].excessReturnPct).filter((v) => v !== null);
  const dds = resolvedBuys.map((s) => s.outcomes[key].maxDrawdownPct).filter((v) => v !== null);
  const wins = resolvedBuys.filter((s) => (s.outcomes[key].netTotalReturnPct ?? 0) > 0).length;
  const beatsNifty = resolvedBuys.filter((s) => (s.outcomes[key].excessReturnPct ?? -1) > 0).length;
  const targetHits = resolvedBuys.filter((s) => s.outcomes[key].status === "TARGET_HIT").length;
  const stopHits = resolvedBuys.filter(
    (s) => s.outcomes[key].status === "STOP_HIT" || s.outcomes[key].status === "BOTH_SAME_BAR"
  ).length;
  const sameBarCount = resolvedBuys.filter(
    (s) => s.outcomes[key].status === "BOTH_SAME_BAR"
  ).length;
  const exitAvoided = resolvedExits.filter((s) => (s.outcomes[key].netTotalReturnPct ?? 0) < 0).length;
  const n = resolvedBuys.length;
  return {
    horizonDays,
    horizonLabel,
    resolvedBuyCount: n,
    pendingBuyCount: pendingBuys.length,
    resolvedExitCount: resolvedExits.length,
    buyWinRatePct: n > 0 ? round23(wins / n * 100) : null,
    buyBeatNiftyRatePct: excessRets.length > 0 ? round23(beatsNifty / excessRets.length * 100) : null,
    avgNetPriceReturnPct: mean(netPriceRets) !== null ? round23(mean(netPriceRets)) : null,
    avgNetTotalReturnPct: mean(netTotalRets) !== null ? round23(mean(netTotalRets)) : null,
    medianNetReturnPct: median(netTotalRets) !== null ? round23(median(netTotalRets)) : null,
    avgNiftyReturnPct: mean(niftyRets) !== null ? round23(mean(niftyRets)) : null,
    avgExcessReturnPct: mean(excessRets) !== null ? round23(mean(excessRets)) : null,
    targetHitRatePct: n > 0 ? round23(targetHits / n * 100) : null,
    stopHitRatePct: n > 0 ? round23(stopHits / n * 100) : null,
    sameBarStopFirstCount: sameBarCount,
    avgMaxDrawdownPct: mean(dds) !== null ? round23(mean(dds)) : null,
    profitFactor: computeProfitFactor(netTotalRets),
    exitAvoidanceRatePct: resolvedExits.length > 0 ? round23(exitAvoided / resolvedExits.length * 100) : null
  };
}
function simulatePortfolioEquityCurve(params) {
  const { seriesList, signals, niftyBars, costBps, maxConcurrentPositions } = params;
  const emptyMetrics = {
    startDate: "",
    endDate: "",
    yearsSimulated: 0,
    portfolioCagrPct: 0,
    niftyCagrPct: 0,
    excessCagrPct: 0,
    portfolioTotalReturnPct: 0,
    niftyTotalReturnPct: 0,
    maxDrawdownPct: 0,
    niftyMaxDrawdownPct: 0,
    annualizedVolatilityPct: 0,
    sharpeRatio: null,
    sortinoRatio: null,
    profitFactor: null,
    avgWinPct: null,
    avgLossPct: null,
    totalClosedTrades: 0,
    annualTurnoverPct: 0
  };
  if (niftyBars.length < 220 || signals.length === 0) {
    return { equityCurve: [], metrics: emptyMetrics };
  }
  const barBySymDate = /* @__PURE__ */ new Map();
  for (const s of seriesList) {
    const m = /* @__PURE__ */ new Map();
    for (const b of s.bars) m.set(b.date, b);
    barBySymDate.set(s.symbol, m);
  }
  const buysByEntryDate = /* @__PURE__ */ new Map();
  const exitsByEntryDate = /* @__PURE__ */ new Map();
  let earliestEntryDate = "9999-12-31";
  for (const sig of signals) {
    if (sig.entryDate < earliestEntryDate) earliestEntryDate = sig.entryDate;
    if (sig.verdict === "BUY") {
      const list = buysByEntryDate.get(sig.entryDate) ?? [];
      list.push(sig);
      buysByEntryDate.set(sig.entryDate, list);
    } else if (sig.verdict === "EXIT") {
      const set = exitsByEntryDate.get(sig.entryDate) ?? /* @__PURE__ */ new Set();
      set.add(sig.symbol);
      exitsByEntryDate.set(sig.entryDate, set);
    }
  }
  const timeline = niftyBars.filter((b) => b.date >= earliestEntryDate);
  if (timeline.length < 20) {
    return { equityCurve: [], metrics: emptyMetrics };
  }
  const initialCapital = 1e6;
  let cash = initialCapital;
  const costRate = clamp3(costBps, 0, 200) / 1e4;
  const maxPos = clamp3(Math.round(maxConcurrentPositions), 3, 25);
  const openPositions = /* @__PURE__ */ new Map();
  const closedReturns = [];
  let totalTradedNotional = 0;
  const baseNifty = timeline[0].close;
  let peakEquity = initialCapital;
  let peakNifty = baseNifty;
  let maxPortDd = 0;
  let maxNiftyDd = 0;
  const monthlyCurve = [];
  const monthlyReturns = [];
  let lastMonthKey = "";
  let lastMonthEquity = initialCapital;
  for (let i = 0; i < timeline.length; i++) {
    const date = timeline[i].date;
    const niftyClose = timeline[i].close;
    const exitSymsToday = exitsByEntryDate.get(date);
    for (const [sym, pos] of Array.from(openPositions.entries())) {
      const bar = barBySymDate.get(sym)?.get(date);
      if (!bar) {
        pos.daysHeld++;
        continue;
      }
      pos.daysHeld++;
      let exitPx = null;
      if (exitSymsToday?.has(sym)) {
        exitPx = bar.open;
      } else if (bar.open <= pos.stopLossPrice) {
        exitPx = bar.open;
      } else if (bar.open >= pos.targetPrice) {
        exitPx = bar.open;
      } else {
        const hitStop = bar.low <= pos.stopLossPrice;
        const hitTarget = bar.high >= pos.targetPrice;
        if (hitStop && hitTarget) {
          exitPx = pos.stopLossPrice;
        } else if (hitStop) {
          exitPx = pos.stopLossPrice;
        } else if (hitTarget) {
          exitPx = pos.targetPrice;
        } else if (pos.daysHeld >= 252) {
          exitPx = bar.close;
        }
      }
      if (exitPx !== null) {
        const grossProceeds = pos.shares * exitPx;
        const netProceeds = grossProceeds * (1 - costRate);
        cash += netProceeds;
        totalTradedNotional += grossProceeds;
        const tradeRetPct = (exitPx * (1 - costRate) / (pos.entryPrice * (1 + costRate)) - 1) * 100;
        closedReturns.push(tradeRetPct);
        openPositions.delete(sym);
      } else {
        pos.lastPrice = bar.close;
      }
    }
    const buyCandidates = buysByEntryDate.get(date);
    if (buyCandidates && buyCandidates.length > 0 && openPositions.size < maxPos) {
      const ranked = [...buyCandidates].sort((a, b) => b.rawConfidence - a.rawConfidence);
      for (const sig of ranked) {
        if (openPositions.size >= maxPos) break;
        if (openPositions.has(sig.symbol)) continue;
        const bar = barBySymDate.get(sig.symbol)?.get(date);
        if (!bar || bar.open <= 0) continue;
        const currentEquity = cash + Array.from(openPositions.values()).reduce((s, p) => s + p.shares * p.lastPrice, 0);
        const slotBudget = Math.min(cash * 0.99, currentEquity / maxPos);
        if (slotBudget < currentEquity * 0.03) continue;
        const effectiveEntry = bar.open * (1 + costRate);
        const shares = slotBudget / effectiveEntry;
        cash -= slotBudget;
        totalTradedNotional += slotBudget;
        openPositions.set(sig.symbol, {
          symbol: sig.symbol,
          shares,
          entryPrice: bar.open,
          entryDate: date,
          targetPrice: sig.targetPrice,
          stopLossPrice: sig.stopLossPrice,
          lastPrice: bar.close,
          daysHeld: 1
        });
      }
    }
    let investedVal = 0;
    for (const pos of openPositions.values()) {
      investedVal += pos.shares * pos.lastPrice;
    }
    const equity = cash + investedVal;
    if (equity > peakEquity) peakEquity = equity;
    if (niftyClose > peakNifty) peakNifty = niftyClose;
    const portDd = peakEquity > 0 ? (peakEquity - equity) / peakEquity * 100 : 0;
    const niftyDd = peakNifty > 0 ? (peakNifty - niftyClose) / peakNifty * 100 : 0;
    if (portDd > maxPortDd) maxPortDd = portDd;
    if (niftyDd > maxNiftyDd) maxNiftyDd = niftyDd;
    const monthKey = date.slice(0, 7);
    const isLastBar = i === timeline.length - 1;
    if (monthKey !== lastMonthKey || isLastBar) {
      if (lastMonthKey !== "" && lastMonthEquity > 0) {
        monthlyReturns.push((equity - lastMonthEquity) / lastMonthEquity);
      }
      lastMonthKey = monthKey;
      lastMonthEquity = equity;
      const point = {
        date,
        portfolioIndexed: round23(equity / initialCapital * 100),
        niftyIndexed: round23(niftyClose / baseNifty * 100),
        drawdownPct: round23(-portDd),
        niftyDrawdownPct: round23(-niftyDd),
        activePositions: openPositions.size
      };
      if (monthlyCurve.length > 0 && monthlyCurve[monthlyCurve.length - 1].date.slice(0, 7) === monthKey) {
        monthlyCurve[monthlyCurve.length - 1] = point;
      } else {
        monthlyCurve.push(point);
      }
    }
  }
  const startDate = timeline[0].date;
  const endDate = timeline[timeline.length - 1].date;
  const years = Math.max(0.25, daysBetweenIso(startDate, endDate) / 365.25);
  const finalEquity = cash + Array.from(openPositions.values()).reduce((s, p) => s + p.shares * p.lastPrice, 0);
  const finalNifty = timeline[timeline.length - 1].close;
  const portTotalRet = (finalEquity - initialCapital) / initialCapital * 100;
  const niftyTotalRet = (finalNifty - baseNifty) / baseNifty * 100;
  const portCagr = (Math.pow(Math.max(0.01, finalEquity / initialCapital), 1 / years) - 1) * 100;
  const niftyCagr = (Math.pow(Math.max(0.01, finalNifty / baseNifty), 1 / years) - 1) * 100;
  const annVol = stdDev(monthlyReturns) * Math.sqrt(12) * 100;
  const rfPct = 6.5;
  const sharpe = annVol > 0.5 ? round23((portCagr - rfPct) / annVol) : null;
  const downsideMonthly = monthlyReturns.filter((r) => r < 0);
  const downsideDev = downsideMonthly.length > 1 ? Math.sqrt(
    downsideMonthly.reduce((sum, r) => sum + r * r, 0) / downsideMonthly.length
  ) * Math.sqrt(12) * 100 : 0;
  const sortino = downsideDev > 0.5 ? round23((portCagr - rfPct) / downsideDev) : null;
  const winRets = closedReturns.filter((r) => r > 0);
  const lossRets = closedReturns.filter((r) => r < 0);
  const avgEquity = (initialCapital + finalEquity) / 2;
  const annualTurnover = avgEquity > 0 ? totalTradedNotional / 2 / avgEquity / years * 100 : 0;
  return {
    equityCurve: monthlyCurve.slice(-140),
    metrics: {
      startDate,
      endDate,
      yearsSimulated: round23(years),
      portfolioCagrPct: round23(portCagr),
      niftyCagrPct: round23(niftyCagr),
      excessCagrPct: round23(portCagr - niftyCagr),
      portfolioTotalReturnPct: round23(portTotalRet),
      niftyTotalReturnPct: round23(niftyTotalRet),
      maxDrawdownPct: round23(maxPortDd),
      niftyMaxDrawdownPct: round23(maxNiftyDd),
      annualizedVolatilityPct: round23(annVol),
      sharpeRatio: sharpe,
      sortinoRatio: sortino,
      profitFactor: computeProfitFactor(closedReturns),
      avgWinPct: mean(winRets) !== null ? round23(mean(winRets)) : null,
      avgLossPct: mean(lossRets) !== null ? round23(mean(lossRets)) : null,
      totalClosedTrades: closedReturns.length,
      annualTurnoverPct: round23(annualTurnover)
    }
  };
}
function selectEvaluationIndices(bars, frequency) {
  const indices = [];
  if (bars.length <= 202) return indices;
  if (frequency === "monthly") {
    let lastMonth = "";
    for (let i = 200; i < bars.length - 1; i++) {
      const m = bars[i].date.slice(0, 7);
      if (m !== lastMonth) {
        indices.push(i);
        lastMonth = m;
      }
    }
  } else {
    const step = frequency === "weekly" ? 5 : 10;
    for (let i = 200; i < bars.length - 1; i += step) {
      indices.push(i);
    }
  }
  return indices;
}
async function run10YearBacktest(request = {}) {
  const universeMode = request.universeMode || "portfolio_plus_flagship";
  const samplingFrequency = request.samplingFrequency || "monthly";
  const costBps = clamp3(typeof request.costBps === "number" ? request.costBps : 15, 0, 100);
  const maxConcurrentPositions = clamp3(
    typeof request.maxConcurrentPositions === "number" ? request.maxConcurrentPositions : 10,
    3,
    20
  );
  const normalizedPortfolio = Array.from(
    new Set(
      (request.portfolioSymbols ?? []).map((s) => resolveActiveMarketSymbol(String(s || ""))).filter((s) => s.length >= 2 && !s.startsWith("^"))
    )
  );
  const portfolioSet = new Set(normalizedPortfolio);
  const normalizedCustom = Array.from(
    new Set(
      (request.customSymbols ?? []).map((s) => resolveActiveMarketSymbol(String(s || ""))).filter((s) => s.length >= 2 && !s.startsWith("^"))
    )
  );
  let targetSymbols = [];
  if (normalizedCustom.length > 0) {
    targetSymbols = normalizedCustom.slice(0, 30);
  } else if (universeMode === "portfolio_only") {
    targetSymbols = normalizedPortfolio.length > 0 ? normalizedPortfolio.slice(0, 30) : FLAGSHIP_17_NSE_SYMBOLS.slice();
  } else if (universeMode === "flagship") {
    targetSymbols = FLAGSHIP_17_NSE_SYMBOLS.slice();
  } else {
    const merged = Array.from(/* @__PURE__ */ new Set([...normalizedPortfolio, ...FLAGSHIP_17_NSE_SYMBOLS]));
    targetSymbols = merged.slice(0, 28);
  }
  const cacheKey = `${universeMode}|${samplingFrequency}|${costBps}|${maxConcurrentPositions}|${targetSymbols.slice().sort().join(",")}`;
  const cachedRun = runCache.get(cacheKey);
  if (cachedRun && cachedRun.expiresAt > Date.now()) {
    latestCalibrationRun = cachedRun.data;
    return cachedRun.data;
  }
  const [niftySeries, stockSeriesList] = await Promise.all([
    fetchYahoo10YSeries("^NSEI"),
    runWithConcurrency3(targetSymbols, 5, (sym) => fetchYahoo10YSeries(sym))
  ]);
  const niftyBars = niftySeries.bars;
  const niftyByDate = /* @__PURE__ */ new Map();
  const niftyRetByDate = /* @__PURE__ */ new Map();
  const niftyInd = precomputePointInTimeIndicators(niftyBars);
  const niftyRet21ByDate = /* @__PURE__ */ new Map();
  const niftyRet63ByDate = /* @__PURE__ */ new Map();
  const niftyRet126ByDate = /* @__PURE__ */ new Map();
  for (let i = 0; i < niftyBars.length; i++) {
    const d = niftyBars[i].date;
    niftyByDate.set(d, niftyBars[i].close);
    if (i > 0 && niftyBars[i - 1].close > 0) {
      niftyRetByDate.set(d, (niftyBars[i].close - niftyBars[i - 1].close) / niftyBars[i - 1].close);
    }
    if (niftyInd.ret21[i] !== null) niftyRet21ByDate.set(d, niftyInd.ret21[i]);
    if (niftyInd.ret63[i] !== null) niftyRet63ByDate.set(d, niftyInd.ret63[i]);
    if (niftyInd.ret126[i] !== null) niftyRet126ByDate.set(d, niftyInd.ret126[i]);
  }
  const validSeries = stockSeriesList.filter((s) => s.quality.status !== "UNAVAILABLE");
  const allSignals = [];
  const signalsBySymbol = /* @__PURE__ */ new Map();
  for (const series of validSeries) {
    const ind = precomputePointInTimeIndicators(series.bars);
    const evalIndices = selectEvaluationIndices(series.bars, samplingFrequency);
    const stockSignals = [];
    for (const idx of evalIndices) {
      const bar = series.bars[idx];
      const nextBar = series.bars[idx + 1];
      if (!bar || !nextBar || nextBar.open <= 0) continue;
      const betaEst = estimatePointInTimeBeta(series.bars, idx, niftyRetByDate);
      const evalRes = reconstructPointInTimeSignal({
        price: bar.close,
        sma20: ind.sma20[idx],
        sma50: ind.sma50[idx],
        sma200: ind.sma200[idx],
        ema20: ind.ema20[idx],
        rsi14: ind.rsi14[idx],
        vol30Ann: ind.vol30Ann[idx],
        ret21: ind.ret21[idx],
        ret63: ind.ret63[idx],
        ret126: ind.ret126[idx],
        high252: ind.high252[idx],
        low252: ind.low252[idx],
        niftyRet21: lookupNearestPriorValue(niftyRet21ByDate, bar.date),
        niftyRet63: lookupNearestPriorValue(niftyRet63ByDate, bar.date),
        niftyRet126: lookupNearestPriorValue(niftyRet126ByDate, bar.date),
        betaEst
      });
      const outcomes = {};
      for (const h of BACKTEST_HORIZONS) {
        outcomes[String(h.days)] = simulateSignalExecution({
          bars: series.bars,
          signalIdx: idx,
          verdict: evalRes.verdict,
          targetPrice: evalRes.targetPrice,
          stopLossPrice: evalRes.stopLossPrice,
          horizonDays: h.days,
          horizonLabel: h.label,
          costBps,
          niftyByDate
        });
      }
      const record = {
        id: `${series.ticker}_${bar.date}`,
        symbol: series.symbol,
        ticker: series.ticker,
        companyName: series.companyName,
        sector: series.sector,
        signalDate: bar.date,
        entryDate: nextBar.date,
        entryPrice: nextBar.open,
        signalClosePrice: bar.close,
        verdict: evalRes.verdict,
        conviction: evalRes.conviction,
        rawConfidence: evalRes.rawConfidence,
        calibratedProb3M: null,
        targetPrice: evalRes.targetPrice,
        stopLossPrice: evalRes.stopLossPrice,
        rsi14: ind.rsi14[idx] !== null ? round23(ind.rsi14[idx]) : null,
        betaEst: evalRes.betaEst,
        split: bar.date <= TRAIN_CUTOFF_DATE ? "TRAIN" : "OOS",
        outcomes
      };
      stockSignals.push(record);
      allSignals.push(record);
    }
    signalsBySymbol.set(series.symbol, stockSignals);
  }
  const calibrationByHorizon = {};
  for (const h of BACKTEST_HORIZONS) {
    calibrationByHorizon[String(h.days)] = computeCalibrationReport(allSignals, h.days, h.label);
  }
  const cal3M = calibrationByHorizon["63"];
  if (cal3M) {
    for (const sig of allSignals) {
      const bIdx = findConfidenceBucketIndex(sig.rawConfidence);
      sig.calibratedProb3M = cal3M.buckets[bIdx]?.oosCalibratedProbPct ?? null;
    }
  }
  const horizonSummaries = BACKTEST_HORIZONS.map(
    (h) => buildHorizonSummary(allSignals, h.days, h.label)
  );
  const stockScorecards = validSeries.map((series) => {
    const sList = signalsBySymbol.get(series.symbol) ?? [];
    const buys = sList.filter((s) => s.verdict === "BUY");
    const holds = sList.filter((s) => s.verdict === "HOLD");
    const exits = sList.filter((s) => s.verdict === "EXIT");
    const winRateFor = (days) => {
      const resolved = buys.filter((s) => {
        const o = s.outcomes[String(days)];
        return o && o.status !== "PENDING" && o.status !== "DATA_UNAVAILABLE" && o.netTotalReturnPct !== null;
      });
      if (resolved.length === 0) return null;
      const wins = resolved.filter((s) => (s.outcomes[String(days)].netTotalReturnPct ?? 0) > 0).length;
      return round23(wins / resolved.length * 100);
    };
    const resolved3M = buys.filter((s) => {
      const o = s.outcomes["63"];
      return o && o.status !== "PENDING" && o.status !== "DATA_UNAVAILABLE" && o.netTotalReturnPct !== null;
    });
    const resolved1Y = buys.filter((s) => {
      const o = s.outcomes["252"];
      return o && o.status !== "PENDING" && o.status !== "DATA_UNAVAILABLE" && o.netTotalReturnPct !== null;
    });
    const resolvedExits3M = exits.filter((s) => {
      const o = s.outcomes["63"];
      return o && o.status !== "PENDING" && o.status !== "DATA_UNAVAILABLE" && o.netTotalReturnPct !== null;
    });
    const netPrice3M = resolved3M.map((s) => s.outcomes["63"].netPriceReturnPct);
    const netTotal3M = resolved3M.map((s) => s.outcomes["63"].netTotalReturnPct);
    const excess3M = resolved3M.map((s) => s.outcomes["63"].excessReturnPct).filter((v) => v !== null);
    const dd3M = resolved3M.map((s) => s.outcomes["63"].maxDrawdownPct).filter((v) => v !== null);
    const netPrice1Y = resolved1Y.map((s) => s.outcomes["252"].netPriceReturnPct);
    const netTotal1Y = resolved1Y.map((s) => s.outcomes["252"].netTotalReturnPct);
    const excess1Y = resolved1Y.map((s) => s.outcomes["252"].excessReturnPct).filter((v) => v !== null);
    const winRate3M = winRateFor(63);
    const avgExcess3M = mean(excess3M) !== null ? round23(mean(excess3M)) : null;
    const profitFactor3M = computeProfitFactor(netTotal3M);
    const targetHits3M = resolved3M.filter((s) => s.outcomes["63"].status === "TARGET_HIT").length;
    const stopHits3M = resolved3M.filter(
      (s) => s.outcomes["63"].status === "STOP_HIT" || s.outcomes["63"].status === "BOTH_SAME_BAR"
    ).length;
    const exitAvoided3M = resolvedExits3M.filter(
      (s) => (s.outcomes["63"].netTotalReturnPct ?? 0) < 0
    ).length;
    return {
      symbol: series.symbol,
      ticker: series.ticker,
      companyName: series.companyName,
      sector: series.sector,
      historyYears: series.quality.historyYears,
      totalSignals: sList.length,
      buySignals: buys.length,
      holdSignals: holds.length,
      exitSignals: exits.length,
      winRate1M: winRateFor(21),
      winRate3M,
      winRate6M: winRateFor(126),
      winRate1Y: winRateFor(252),
      avgNetReturn3M: mean(netPrice3M) !== null ? round23(mean(netPrice3M)) : null,
      avgTotalReturn3M: mean(netTotal3M) !== null ? round23(mean(netTotal3M)) : null,
      avgExcessReturn3M: avgExcess3M,
      avgNetReturn1Y: mean(netPrice1Y) !== null ? round23(mean(netPrice1Y)) : null,
      avgTotalReturn1Y: mean(netTotal1Y) !== null ? round23(mean(netTotal1Y)) : null,
      avgExcessReturn1Y: mean(excess1Y) !== null ? round23(mean(excess1Y)) : null,
      targetHitRate3M: resolved3M.length > 0 ? round23(targetHits3M / resolved3M.length * 100) : null,
      stopHitRate3M: resolved3M.length > 0 ? round23(stopHits3M / resolved3M.length * 100) : null,
      exitAvoidanceRate3M: resolvedExits3M.length > 0 ? round23(exitAvoided3M / resolvedExits3M.length * 100) : null,
      profitFactor3M,
      maxDrawdown3M: mean(dd3M) !== null ? round23(mean(dd3M)) : null,
      edgeTier: classifyStockEdgeTier(winRate3M, avgExcess3M, profitFactor3M),
      inUserPortfolio: portfolioSet.has(series.symbol)
    };
  });
  stockScorecards.sort((a, b) => (b.avgExcessReturn3M ?? -999) - (a.avgExcessReturn3M ?? -999));
  const { equityCurve, metrics: portfolioMetrics } = simulatePortfolioEquityCurve({
    seriesList: validSeries,
    signals: allSignals,
    niftyBars,
    costBps,
    maxConcurrentPositions
  });
  allSignals.sort((a, b) => b.signalDate.localeCompare(a.signalDate) || a.symbol.localeCompare(b.symbol));
  const universeLabel = universeMode === "portfolio_only" ? `My Portfolio (${validSeries.length} NSE)` : universeMode === "flagship" ? `Flagship ${validSeries.length} NSE` : normalizedPortfolio.length > 0 ? `Portfolio + Flagships (${validSeries.length} NSE)` : `Flagship ${validSeries.length} NSE`;
  const runResult = {
    runId: `bt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: `${universeLabel} \xB7 ${costBps} bps`,
    methodology: "TECH_RECONSTRUCTED_V1",
    methodologyNote: "Zero-look-ahead technical reconstruction (200-DMA warm-up, point-in-time Nifty 50 RS, T+1 open execution, STOP_FIRST same-bar rule, NSE slippage/STT drag, dividend-adjusted Total Return). Today\u2019s fundamentals are excluded from historical dates to prevent look-ahead leakage.",
    universeMode,
    samplingFrequency,
    costBps,
    trainCutoffDate: TRAIN_CUTOFF_DATE,
    symbolsRequested: targetSymbols,
    symbolsEvaluated: validSeries.map((s) => s.symbol),
    portfolioMetrics,
    horizonSummaries,
    calibrationByHorizon,
    stockScorecards,
    equityCurve,
    signals: allSignals,
    totalSignalsGenerated: allSignals.length,
    dataQuality: stockSeriesList.map((s) => s.quality),
    computedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  runCache.set(cacheKey, { data: runResult, expiresAt: Date.now() + RUN_CACHE_TTL_MS });
  latestCalibrationRun = runResult;
  return runResult;
}
async function ensureBaselineBacktest() {
  if (latestCalibrationRun) return latestCalibrationRun;
  if (!baselineWarmPromise) {
    baselineWarmPromise = run10YearBacktest({
      universeMode: "flagship",
      samplingFrequency: "monthly",
      costBps: 15
    }).catch((err) => {
      console.warn("Baseline 10Y backtest warm-up failed:", err);
      return null;
    }).finally(() => {
      baselineWarmPromise = null;
    });
  }
  return baselineWarmPromise;
}
async function getLiveCalibrationForSymbol(params) {
  const sym = resolveActiveMarketSymbol(params.symbol);
  if (!sym || sym.startsWith("^")) return null;
  let run = latestCalibrationRun;
  if (!run) {
    const waitMs = params.waitMs ?? 2500;
    const warmPromise = ensureBaselineBacktest();
    if (waitMs > 0) {
      run = await Promise.race([
        warmPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), waitMs))
      ]);
    }
  }
  if (!run) return null;
  const cal3M = run.calibrationByHorizon["63"];
  const cal1Y = run.calibrationByHorizon["252"];
  if (!cal3M) return null;
  const bucketIdx = findConfidenceBucketIndex(params.rawConfidence);
  const bucket3M = cal3M.buckets[bucketIdx];
  const bucket1Y = cal1Y?.buckets[bucketIdx];
  const scorecard = run.stockScorecards.find((s) => s.symbol === sym) ?? null;
  return {
    calibratedWinProb3M: bucket3M?.oosCalibratedProbPct ?? null,
    calibratedWinProb1Y: bucket1Y?.oosCalibratedProbPct ?? null,
    rawConfidenceBucket: bucket3M?.bucketLabel ?? "55\u201365",
    oosSampleCount: cal3M.oosSampleCount,
    stockEdgeTier: scorecard?.edgeTier ?? null,
    stockWinRate3M: scorecard?.winRate3M ?? null,
    stockExcessReturn3M: scorecard?.avgExcessReturn3M ?? null,
    stockProfitFactor: scorecard?.profitFactor3M ?? null,
    exitAvoidanceRate3M: scorecard?.exitAvoidanceRate3M ?? null,
    sampleHorizonLabel: "3M OOS (2024\u20132026)",
    methodologyTag: "TECH_RECONSTRUCTED_V1",
    sourceRunLabel: run.label
  };
}
function runDeterministicValidationSuite() {
  const cases = [];
  const makeDate = (idx) => {
    const d = new Date(Date.UTC(2024, 0, 2 + idx));
    return d.toISOString().slice(0, 10);
  };
  const flatNifty = /* @__PURE__ */ new Map();
  for (let i = 0; i < 120; i++) flatNifty.set(makeDate(i), 2e4);
  {
    const bars = Array.from({ length: 40 }, (_, i) => {
      const px = 100 + i * 2;
      return {
        date: makeDate(i),
        timestamp: i,
        open: px,
        high: px + 1,
        low: px - 0.5,
        close: px + 0.5,
        adjClose: px + 0.5,
        volume: 1e3
      };
    });
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: "BUY",
      targetPrice: 112,
      stopLossPrice: 92,
      horizonDays: 21,
      horizonLabel: "1M",
      costBps: 15,
      niftyByDate: flatNifty
    });
    const pass = res.status === "TARGET_HIT" && res.firstHit === "TARGET" && res.exitPrice === 112 && (res.netPriceReturnPct ?? 0) > 9.3 && (res.netPriceReturnPct ?? 0) < 9.7;
    cases.push({
      name: "1. Continuously rising stock hits TARGET on T+1 entry",
      pass,
      detail: `status=${res.status}, exit=${res.exitPrice}, net=${res.netPriceReturnPct}%`
    });
  }
  {
    const bars = Array.from({ length: 40 }, (_, i) => {
      const px = Math.max(20, 100 - i * 2);
      return {
        date: makeDate(i),
        timestamp: i,
        open: px,
        high: px + 0.5,
        low: px - 1,
        close: px - 0.5,
        adjClose: px - 0.5,
        volume: 1e3
      };
    });
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: "BUY",
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: "1M",
      costBps: 15,
      niftyByDate: flatNifty
    });
    const pass = res.status === "STOP_HIT" && res.firstHit === "STOP" && (res.netPriceReturnPct ?? 0) < -7;
    cases.push({
      name: "2. Continuously falling stock hits STOP_LOSS",
      pass,
      detail: `status=${res.status}, exit=${res.exitPrice}, net=${res.netPriceReturnPct}%`
    });
  }
  {
    const bars = [
      { date: makeDate(0), timestamp: 0, open: 100, high: 101, low: 99, close: 100, adjClose: 100, volume: 1e3 },
      { date: makeDate(1), timestamp: 1, open: 100, high: 104, low: 98, close: 103, adjClose: 103, volume: 1e3 },
      { date: makeDate(2), timestamp: 2, open: 104, high: 116, low: 103, close: 114, adjClose: 114, volume: 1e3 },
      { date: makeDate(3), timestamp: 3, open: 112, high: 113, low: 85, close: 88, adjClose: 88, volume: 1e3 }
    ];
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: "BUY",
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: "1M",
      costBps: 0,
      niftyByDate: flatNifty
    });
    const pass = res.status === "TARGET_HIT" && res.exitDate === makeDate(2) && res.exitPrice === 115;
    cases.push({
      name: "3. Target hit before subsequent stop drop",
      pass,
      detail: `status=${res.status}, exitDate=${res.exitDate}, exitPrice=${res.exitPrice}`
    });
  }
  {
    const bars = [
      { date: makeDate(0), timestamp: 0, open: 100, high: 101, low: 99, close: 100, adjClose: 100, volume: 1e3 },
      { date: makeDate(1), timestamp: 1, open: 100, high: 102, low: 89, close: 92, adjClose: 92, volume: 1e3 },
      { date: makeDate(2), timestamp: 2, open: 95, high: 120, low: 95, close: 118, adjClose: 118, volume: 1e3 }
    ];
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: "BUY",
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: "1M",
      costBps: 0,
      niftyByDate: flatNifty
    });
    const pass = res.status === "STOP_HIT" && res.exitDate === makeDate(1) && res.exitPrice === 90;
    cases.push({
      name: "4. Stop hit before subsequent rally",
      pass,
      detail: `status=${res.status}, exitDate=${res.exitDate}, exitPrice=${res.exitPrice}`
    });
  }
  {
    const bars = [
      { date: makeDate(0), timestamp: 0, open: 100, high: 101, low: 99, close: 100, adjClose: 100, volume: 1e3 },
      { date: makeDate(1), timestamp: 1, open: 100, high: 118, low: 88, close: 105, adjClose: 105, volume: 1e3 }
    ];
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: "BUY",
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: "1M",
      costBps: 0,
      niftyByDate: flatNifty
    });
    const pass = res.status === "BOTH_SAME_BAR" && res.firstHit === "STOP" && res.exitPrice === 90;
    cases.push({
      name: "5. Same-candle dual hit resolves conservatively to STOP_FIRST",
      pass,
      detail: `status=${res.status}, firstHit=${res.firstHit}, exitPrice=${res.exitPrice}`
    });
  }
  {
    const bars = [
      { date: makeDate(0), timestamp: 0, open: 100, high: 101, low: 99, close: 100, adjClose: 100, volume: 1e3 },
      { date: makeDate(1), timestamp: 1, open: 100, high: 102, low: 99, close: 101, adjClose: 101, volume: 1e3 },
      { date: makeDate(2), timestamp: 2, open: 82, high: 86, low: 80, close: 84, adjClose: 84, volume: 1e3 }
    ];
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: "BUY",
      targetPrice: 115,
      stopLossPrice: 90,
      horizonDays: 21,
      horizonLabel: "1M",
      costBps: 0,
      niftyByDate: flatNifty
    });
    const pass = res.status === "STOP_HIT" && res.exitPrice === 82 && res.grossPriceReturnPct === -18;
    cases.push({
      name: "6. Overnight gap below stop fills at gap open (82 vs 90 stop)",
      pass,
      detail: `status=${res.status}, exitPrice=${res.exitPrice}, gross=${res.grossPriceReturnPct}%`
    });
  }
  {
    const bars = Array.from({ length: 25 }, (_, i) => ({
      date: makeDate(i),
      timestamp: i,
      open: 500,
      high: 505,
      low: 495,
      close: 500,
      adjClose: 500,
      volume: 1e3
    }));
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: "BUY",
      targetPrice: 580,
      stopLossPrice: 450,
      horizonDays: 21,
      horizonLabel: "1M",
      costBps: 0,
      niftyByDate: flatNifty
    });
    const pass = res.status === "HORIZON_EXPIRED" && res.grossPriceReturnPct === 0;
    cases.push({
      name: "7. Split-adjusted series shows zero phantom return jump",
      pass,
      detail: `status=${res.status}, grossPriceReturn=${res.grossPriceReturnPct}%`
    });
  }
  {
    const bars = Array.from({ length: 25 }, (_, i) => ({
      date: makeDate(i),
      timestamp: i,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      // 4% dividend ex-date on bar 10 raises adjClose ratio from 0.96 -> 1.00
      adjClose: i < 10 ? 96 : 100,
      volume: 1e3
    }));
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: "BUY",
      targetPrice: 120,
      stopLossPrice: 85,
      horizonDays: 21,
      horizonLabel: "1M",
      costBps: 0,
      niftyByDate: flatNifty
    });
    const pass = res.status === "HORIZON_EXPIRED" && res.grossPriceReturnPct === 0 && (res.grossTotalReturnPct ?? 0) > 4;
    cases.push({
      name: "8. Dividend-adjusted Total Return captures yield above Price Return",
      pass,
      detail: `priceRet=${res.grossPriceReturnPct}%, totalRet=${res.grossTotalReturnPct}%`
    });
  }
  {
    const bars = Array.from({ length: 15 }, (_, i) => ({
      date: makeDate(i),
      timestamp: i,
      open: 100,
      high: 103,
      low: 98,
      close: 101,
      adjClose: 101,
      volume: 1e3
    }));
    const res = simulateSignalExecution({
      bars,
      signalIdx: 0,
      verdict: "BUY",
      targetPrice: 120,
      stopLossPrice: 85,
      horizonDays: 63,
      horizonLabel: "3M",
      costBps: 15,
      niftyByDate: flatNifty
    });
    const pass = res.status === "PENDING" && res.won === null && res.netTotalReturnPct === null;
    cases.push({
      name: "9. Incomplete forward window marked PENDING and excluded from win rate",
      pass,
      detail: `status=${res.status}, won=${String(res.won)}, netTotal=${String(res.netTotalReturnPct)}`
    });
  }
  const passed = cases.filter((c) => c.pass).length;
  return { passed, failed: cases.length - passed, cases };
}

// server/portfolioAnalyzer.ts
var STOCK_AI_BATCH_SIZE = 15;
var AI_BATCH_CONCURRENCY = 2;
var RATING_CRITERIA = "Criteria: Strictly align rating & conviction with Net Confidence (confPct): BUY requires confPct>=52 (confPct>=65 if daysToEarnings<=5) with constructive trend above 50/200-DMA (wtPct<25 when given) or quality oversold RSI<40 with healthy ROCE; HOLD=moderate confidence, consolidation, stretched RSI>=75, imminent earnings caution, or oversized weight; EXIT=weak confidence (<50) with persistent 6M lag vs Nifty below 200-DMA or weak ROCE drag.";
var QUOTA_EXHAUSTED_NOTICE = "Gemini API free-tier daily quota (20 req/day) was reached. Displaying quantitative ratings grounded in live NSE/BSE prices, 50/200-DMA, RSI-14, ROCE, and Nifty 50 relative strength. Select a billing-enabled key in Settings > Secrets for full LLM commentary.";
var TRANSIENT_FALLBACK_NOTICE = "AI commentary temporarily fell back to the quantitative telemetry engine for one or more holdings. All verdicts, guardrails, and 1M\u201310Y projections remain grounded in live NSE/BSE prices, 50/200-DMA, RSI-14, ROCE, and Nifty 50 relative strength.";
function isQuotaOrRateLimitError(err) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /429|RESOURCE_EXHAUSTED|quota exceeded|rate[- ]limit/i.test(msg);
}
function safeParseJsonObject(rawText) {
  if (!rawText) return null;
  const stripped = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!stripped) return null;
  try {
    return JSON.parse(stripped);
  } catch {
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
function clampNum(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function buildStockProjection(t, rating, suggestedTarget, aiHint) {
  const live = Math.max(0.01, t.livePrice);
  const beta = clampNum(t.beta || 1, 0.6, 1.75);
  const targetUpsidePct = (suggestedTarget - live) / live * 100;
  const momAdj = t.sma50 && t.sma200 ? live > t.sma50 && live > t.sma200 ? 3 : live < t.sma200 ? -4 : 0 : 0;
  const roceScore = t.roce !== null ? t.roce >= 22 ? 15.5 : t.roce >= 15 ? 13.5 : t.roce >= 10 ? 11.2 : 8 : 11.5;
  const pePenalty = t.peRatio !== null && t.peRatio > 60 ? -1.8 : t.peRatio !== null && t.peRatio < 18 ? 1 : 0;
  const ratingBias = rating === "BUY" ? 2 : rating === "EXIT" ? -4 : 0;
  const final1y = Number(targetUpsidePct.toFixed(1));
  const halfYearComp = (Math.pow(Math.max(0.45, 1 + final1y / 100), 0.5) - 1) * 100;
  const base6m = clampNum(halfYearComp + (t.return6M ?? 0) * 0.05 + momAdj * 0.25, -18, 28);
  const raw6m = typeof aiHint?.p6m === "number" && Number.isFinite(aiHint.p6m) ? aiHint.p6m * 0.35 + base6m * 0.65 : base6m;
  const r6m = final1y >= 0 ? clampNum(raw6m, Math.max(-4, final1y * 0.25), Math.max(0.5, final1y * 0.85)) : clampNum(raw6m, final1y * 0.9, Math.min(2, final1y * 0.25));
  const base5yCagr = clampNum(roceScore + pePenalty + ratingBias * 0.65, 4, 22);
  const base10yCagr = clampNum(base5yCagr * 0.72 + 12 * 0.28, 5, 18.5);
  const c5y = typeof aiHint?.cagr5y === "number" && Number.isFinite(aiHint.cagr5y) ? clampNum(aiHint.cagr5y * 0.5 + base5yCagr * 0.5, 4, 22) : base5yCagr;
  const c10y = typeof aiHint?.cagr10y === "number" && Number.isFinite(aiHint.cagr10y) ? clampNum(aiHint.cagr10y * 0.5 + base10yCagr * 0.5, 5, 18.5) : base10yCagr;
  const comp1m = (Math.pow(Math.max(0.5, 1 + r6m / 100), 1 / 6) - 1) * 100;
  const comp3m = (Math.pow(Math.max(0.5, 1 + r6m / 100), 0.5) - 1) * 100;
  const rsiVal = t.rsi14 ?? 50;
  const rsi1mNudge = rsiVal >= 74 ? -1 : rsiVal <= 35 && rating !== "EXIT" ? 1 : 0;
  const mom1mNudge = clampNum((t.return1M ?? 0) * 0.06, -1.8, 1.8);
  const mom3mNudge = clampNum((t.return3M ?? 0) * 0.06, -2.4, 2.4);
  const base1m = clampNum(comp1m + rsi1mNudge + mom1mNudge, -9, 10);
  const base3m = clampNum(comp3m + mom3mNudge, -14, 16);
  const raw1m = typeof aiHint?.p1m === "number" && Number.isFinite(aiHint.p1m) ? clampNum(aiHint.p1m * 0.4 + base1m * 0.6, -9, 10) : base1m;
  const raw3m = typeof aiHint?.p3m === "number" && Number.isFinite(aiHint.p3m) ? clampNum(aiHint.p3m * 0.4 + base3m * 0.6, -14, 16) : base3m;
  const r3m = r6m >= 0 ? clampNum(raw3m, Math.min(raw3m, r6m * 0.85), Math.max(0.5, r6m * 0.85)) : clampNum(raw3m, r6m * 0.85, Math.max(raw3m, r6m * 0.25));
  const r1m = r3m >= 0 ? clampNum(raw1m, -4, Math.max(0.4, r3m * 0.78)) : clampNum(raw1m, Math.min(-0.4, r3m * 0.8), 3);
  return {
    return1MPercent: Number(r1m.toFixed(1)),
    value1M: Number((live * (1 + r1m / 100)).toFixed(2)),
    return3MPercent: Number(r3m.toFixed(1)),
    value3M: Number((live * (1 + r3m / 100)).toFixed(2)),
    return6MPercent: Number(r6m.toFixed(1)),
    value6M: Number((live * (1 + r6m / 100)).toFixed(2)),
    return1YPercent: final1y,
    value1Y: Number(suggestedTarget.toFixed(2)),
    cagr5YPercent: Number(c5y.toFixed(1)),
    value5Y: Number((live * Math.pow(1 + c5y / 100, 5)).toFixed(2)),
    cagr10YPercent: Number(c10y.toFixed(1)),
    value10Y: Number((live * Math.pow(1 + c10y / 100, 10)).toFixed(2)),
    basisNote: t.roce !== null ? `Anchored to 1Y target \u20B9${suggestedTarget.toFixed(0)}, ROCE ${t.roce.toFixed(1)}%, \u03B2 ${beta.toFixed(2)}x & DMA momentum.` : `Anchored to 1Y target \u20B9${suggestedTarget.toFixed(0)}, \u03B2 ${beta.toFixed(2)}x & 50/200-DMA momentum.`
  };
}
async function runWithConcurrency4(items, limit, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function next() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}
function evaluateBatchQuantFallback(params) {
  const { batch, nifty, sectorBreakdownText, includeExecutiveSummary } = params;
  const nifty6M = nifty?.return6M ?? 0;
  const ratings = batch.map((t) => {
    const live = t.livePrice;
    const beta = Math.max(0.65, Math.min(1.65, t.beta || 1));
    const above50 = t.sma50 ? live >= t.sma50 : null;
    const above200 = t.sma200 ? live >= t.sma200 : null;
    const rsi = t.rsi14 ?? 50;
    const ret6m = t.return6M;
    const relNifty6M = ret6m !== null ? Number((ret6m - nifty6M).toFixed(1)) : null;
    const netConf = t.confidence?.overallScore ?? 55;
    const dte = t.fundamentals?.daysToEarnings ?? null;
    const imminentEarnings = typeof dte === "number" && dte >= 0 && dte <= 5;
    let verdict = "HOLD";
    let conviction = "Medium";
    let headline = "Consolidating near trend baseline \u2014 trail stop-loss";
    const deepBelow200 = t.sma200 ? live < t.sma200 * 0.88 : false;
    const severeLag = relNifty6M !== null && relNifty6M <= -12 && above200 === false;
    const weakFundamentals = t.roce !== null && t.roce < 7 && t.unrealizedPnlPercent < -15;
    if ((severeLag || deepBelow200 && (ret6m ?? 0) < -10 || weakFundamentals || netConf < 36) && !(netConf >= 70 && above200 === true)) {
      verdict = "EXIT";
      conviction = netConf <= 38 ? "High" : "Medium";
      headline = above200 === false ? `Below 200-DMA (${ret6m !== null ? `${ret6m}% 6M` : "weak momentum"}) \u2014 capital-drag exit` : "Sustained benchmark underperformance & weak confidence profile";
    } else if (netConf >= 52 && (!imminentEarnings || netConf >= 65) && (above50 === true && above200 === true && rsi <= 68 && t.portfolioWeightPercent < 22 || rsi <= 38 && (t.roce ?? 12) >= 12 && !deepBelow200 || netConf >= 68 && t.portfolioWeightPercent < 22 && rsi <= 70)) {
      verdict = "BUY";
      conviction = netConf >= 68 ? "High" : "Medium";
      headline = rsi <= 38 ? `Oversold quality support (RSI ${rsi.toFixed(1)}) \u2014 accumulation zone` : `Uptrend above 50/200-DMA with ${relNifty6M !== null && relNifty6M >= 0 ? "Nifty outperformance" : "steady momentum"}`;
    } else if (imminentEarnings && netConf < 65) {
      verdict = "HOLD";
      conviction = "Medium";
      headline = `Results due in ${dte}d \u2014 hold steady ahead of earnings event`;
    } else if (t.portfolioWeightPercent >= 22) {
      verdict = "HOLD";
      conviction = netConf >= 66 ? "High" : "Medium";
      headline = `Oversized weight (${t.portfolioWeightPercent.toFixed(1)}%) \u2014 hold & cap incremental adds`;
    } else if (rsi >= 72 && t.unrealizedPnlPercent > 15) {
      verdict = "HOLD";
      conviction = "Medium";
      headline = `Extended RSI (${rsi.toFixed(1)}) \u2014 hold with tighter trailing stop`;
    }
    const techParts = [
      t.portfolioWeightPercent > 0 ? `LTP \u20B9${live.toFixed(2)} (${t.unrealizedPnlPercent >= 0 ? "+" : ""}${t.unrealizedPnlPercent.toFixed(1)}% P&L)` : `LTP \u20B9${live.toFixed(2)}`
    ];
    if (t.sma50) techParts.push(`50-DMA \u20B9${t.sma50.toFixed(0)} (${above50 ? "above" : "below"})`);
    if (t.sma200) techParts.push(`200-DMA \u20B9${t.sma200.toFixed(0)} (${above200 ? "above" : "below"})`);
    if (t.rsi14 !== null) techParts.push(`RSI ${t.rsi14.toFixed(1)}`);
    if (relNifty6M !== null) {
      techParts.push(`6M vs Nifty: ${relNifty6M >= 0 ? "+" : ""}${relNifty6M}%`);
    }
    if (t.roce !== null) techParts.push(`ROCE ${t.roce.toFixed(1)}%`);
    const rationale = t.portfolioWeightPercent > 0 ? `${techParts.join(" \xB7 ")}. Position represents ${t.portfolioWeightPercent.toFixed(1)}% of portfolio value.` : `${techParts.join(" \xB7 ")}. Grounded in Nifty 50 relative momentum and volatility telemetry.`;
    const keyRisk = verdict === "EXIT" ? "Continued trend breakdown below moving averages may compound opportunity cost." : t.portfolioWeightPercent > 18 ? `Single-stock concentration (${t.portfolioWeightPercent.toFixed(1)}% weight) amplifies sector drawdown.` : rsi > 70 ? "Short-term mean reversion pullback risk due to elevated RSI." : "Broad market volatility around earnings and Nifty 50 liquidity shifts.";
    const suggestedTarget = verdict === "EXIT" ? Number((live * 1.05).toFixed(2)) : Number((live * (1 + (verdict === "BUY" ? 0.16 : 0.1) * beta)).toFixed(2));
    const suggestedStopLoss = verdict === "EXIT" ? Number((live * 0.95).toFixed(2)) : t.sma50 && t.sma50 < live * 0.97 && t.sma50 > live * 0.82 ? Number((t.sma50 * 0.985).toFixed(2)) : Number((live * (1 - 0.08 * beta)).toFixed(2));
    return {
      symbol: t.symbol,
      rating: verdict,
      conviction,
      headline,
      rationale,
      keyRisk,
      suggestedTarget,
      suggestedStopLoss
    };
  });
  if (!includeExecutiveSummary) {
    return { ratings, usedFallbackEngine: true };
  }
  const buys = ratings.filter((r) => r.rating === "BUY").length;
  const holds = ratings.filter((r) => r.rating === "HOLD").length;
  const exits = ratings.filter((r) => r.rating === "EXIT");
  return {
    overallSummary: `Quantitative telemetry evaluated ${batch.length} positions in this batch (${buys} BUY, ${holds} HOLD, ${exits.length} EXIT) against Nifty 50 (${nifty ? `${nifty.price.toLocaleString("en-IN")}` : "live"}).`,
    diversificationNote: sectorBreakdownText ? `Top sector weights: ${sectorBreakdownText}.` : "Review sector concentration across top weighted positions.",
    actionPriority: exits.length > 0 ? `Prioritize reviewing ${exits.slice(0, 3).map((e) => e.symbol.replace(/\.(NS|BO)$/, "")).join(", ")} flagged below 200-DMA / trailing Nifty 50.` : "Maintain disciplined trailing stop-losses near 50-DMA support on core winners.",
    ratings,
    usedFallbackEngine: true
  };
}
async function evaluateTelemetryBatch(params) {
  const { ai, batch, nifty, includeExecutiveSummary, sectorBreakdownText } = params;
  const compactTelemetry = batch.map((t) => ({
    s: t.symbol,
    sec: t.sector,
    cap: t.capCategory,
    ltp: t.livePrice,
    pnlPct: t.unrealizedPnlPercent,
    wtPct: t.portfolioWeightPercent,
    ...t.rsi14 !== null ? { rsi: t.rsi14 } : {},
    ...t.sma50 !== null ? { sma50: t.sma50 } : {},
    ...t.sma200 !== null ? { sma200: t.sma200 } : {},
    ...t.return6M !== null ? { r6m: t.return6M } : {},
    ...t.roce !== null ? { roce: t.roce } : {},
    ...t.peRatio !== null ? { pe: t.peRatio } : {},
    ...t.confidence ? { confPct: t.confidence.overallScore } : {},
    ...t.confidence?.totalAdjustment ? { confAdj: t.confidence.totalAdjustment } : {},
    ...typeof t.fundamentals?.daysToEarnings === "number" && t.fundamentals.daysToEarnings >= 0 && t.fundamentals.daysToEarnings <= 14 ? { daysToEarnings: t.fundamentals.daysToEarnings } : {},
    ...t.fundamentals?.earningsRiskFlag && t.fundamentals.nextEarningsDate ? { earnings: t.fundamentals.nextEarningsDate } : {},
    beta: t.beta
  }));
  const summaryHint = includeExecutiveSummary ? sectorBreakdownText ? `Sector weights: ${sectorBreakdownText}. Return portfolio overallSummary, diversificationNote, actionPriority.` : "Return portfolio overallSummary, diversificationNote, actionPriority." : "Use short placeholder strings for overallSummary, diversificationNote, and actionPriority (continuation batch).";
  const prompt = `Rate EVERY Indian NSE/BSE stock in the JSON array (${compactTelemetry.length} items) with BUY, HOLD, or EXIT, and estimate expected return/CAGR forecasts (p1m, p3m, p6m, p1y, cagr5y, cagr10y).
Nifty50: level=${nifty ? nifty.price : "N/A"}, 1D=${nifty ? `${nifty.changePercent}%` : "N/A"}, 6M=${nifty?.return6M ?? "N/A"}%.
${summaryHint}
Fields: s=symbol, ltp=livePrice, pnlPct=unrealizedPnl%, wtPct=portfolioWeight%, rsi=RSI14, sma50/sma200, r6m=6M return%, roce, pe, beta.
${RATING_CRITERIA} Keep headline (<=12 words), rationale (<=22 words), and keyRisk (<=16 words) crisp and single-line (no raw newlines or unescaped quotes), and set realistic INR suggestedTarget and suggestedStopLoss relative to ltp plus p1m/p3m/p6m/p1y total % and cagr5y/cagr10y annual % CAGR.
Data:${JSON.stringify(compactTelemetry)}`;
  const schema = {
    type: Type2.OBJECT,
    properties: {
      overallSummary: { type: Type2.STRING },
      diversificationNote: { type: Type2.STRING },
      actionPriority: { type: Type2.STRING },
      ratings: {
        type: Type2.ARRAY,
        items: {
          type: Type2.OBJECT,
          properties: {
            symbol: { type: Type2.STRING },
            rating: { type: Type2.STRING, enum: ["BUY", "HOLD", "EXIT"] },
            conviction: { type: Type2.STRING, enum: ["High", "Medium", "Low"] },
            headline: { type: Type2.STRING },
            rationale: { type: Type2.STRING },
            keyRisk: { type: Type2.STRING },
            suggestedTarget: { type: Type2.NUMBER },
            suggestedStopLoss: { type: Type2.NUMBER },
            p1m: { type: Type2.NUMBER },
            p3m: { type: Type2.NUMBER },
            p6m: { type: Type2.NUMBER },
            p1y: { type: Type2.NUMBER },
            cagr5y: { type: Type2.NUMBER },
            cagr10y: { type: Type2.NUMBER }
          },
          required: [
            "symbol",
            "rating",
            "conviction",
            "headline",
            "rationale",
            "keyRisk",
            "suggestedTarget",
            "suggestedStopLoss"
          ]
        }
      }
    },
    required: ["overallSummary", "diversificationNote", "actionPriority", "ratings"]
  };
  const modelCandidates = [
    { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel2.LOW },
    { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel2.MINIMAL }
  ];
  let lastError;
  for (const candidate of modelCandidates) {
    try {
      const response = await ai.models.generateContent({
        model: candidate.model,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
          maxOutputTokens: 8192,
          systemInstruction: "You are a quantitative Indian equity portfolio analyst. Output concise, objective, data-grounded portfolio diagnostics in strictly valid JSON. Rate every holding provided.",
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
      const parsed = safeParseJsonObject(response.text);
      if (!parsed) {
        lastError = new Error(`Malformed or truncated JSON response from ${candidate.model}`);
        continue;
      }
      const ratings = Array.isArray(parsed.ratings) ? parsed.ratings.filter((r) => Boolean(r && typeof r.symbol === "string" && r.rating)) : [];
      if (ratings.length > 0) {
        const ratedSet = new Set(ratings.map((r) => r.symbol.toUpperCase()));
        const missingItems = batch.filter((item) => !ratedSet.has(item.symbol.toUpperCase()));
        const supplementedRatings = missingItems.length > 0 ? [
          ...ratings,
          ...evaluateBatchQuantFallback({
            batch: missingItems,
            nifty,
            sectorBreakdownText,
            includeExecutiveSummary: false
          }).ratings
        ] : ratings;
        return {
          overallSummary: parsed.overallSummary,
          diversificationNote: parsed.diversificationNote,
          actionPriority: parsed.actionPriority,
          ratings: supplementedRatings,
          usedFallbackEngine: false
        };
      }
      lastError = new Error(`Empty ratings array returned from ${candidate.model}`);
    } catch (err) {
      lastError = err;
    }
  }
  const quotaExhausted = isQuotaOrRateLimitError(lastError);
  if (lastError && !quotaExhausted) {
    console.warn("Portfolio AI batch fell back to quantitative engine:", lastError);
  }
  return {
    ...evaluateBatchQuantFallback({
      batch,
      nifty,
      sectorBreakdownText,
      includeExecutiveSummary
    }),
    quotaExhausted
  };
}
function applyGuardrails(rawRatings, telemetryBySymbol) {
  const seenRatings = /* @__PURE__ */ new Set();
  return rawRatings.filter((r) => {
    const key = String(r.symbol || "").toUpperCase();
    if (!key || seenRatings.has(key)) return false;
    seenRatings.add(key);
    return true;
  }).map((r) => {
    const sym = String(r.symbol || "").toUpperCase();
    const t = telemetryBySymbol.get(sym);
    const { p1m, p3m, p6m, p1y, cagr5y, cagr10y, ...cleanRating } = r;
    if (!t || t.livePrice <= 0) {
      return {
        ...cleanRating,
        guardrailStatus: "PASSED",
        guardrailNote: "Verified against live quote telemetry."
      };
    }
    const live = t.livePrice;
    const beta = Math.max(0.6, Math.min(1.8, t.beta || 1));
    const maxUpsidePct = Math.round(45 * beta);
    const maxStopPct = Math.min(32, Math.max(12, Math.round(24 * beta)));
    const minStopPct = 2;
    let target = Number(cleanRating.suggestedTarget);
    let stop = Number(cleanRating.suggestedStopLoss);
    let status = "PASSED";
    const notes = [];
    let unifiedRating = cleanRating.rating;
    let unifiedConviction = cleanRating.conviction;
    const netConf = t.confidence?.overallScore ?? null;
    const totalAdj = t.confidence?.totalAdjustment ?? 0;
    const dte = t.fundamentals?.daysToEarnings ?? null;
    if (unifiedRating === "BUY" && netConf !== null && netConf < 52) {
      if (netConf < 36 && t.sma200 && live < t.sma200 * 0.92) {
        unifiedRating = "EXIT";
        status = "ADJUSTED";
        notes.push(
          `Unified BUY \u2192 EXIT: net confidence ${netConf.toFixed(1)}% (<36%) while trading below 200-DMA.`
        );
      } else {
        unifiedRating = "HOLD";
        status = "ADJUSTED";
        notes.push(
          `Unified BUY \u2192 HOLD: net confidence ${netConf.toFixed(1)}% is below the 52% BUY threshold${totalAdj < 0 ? ` (after ${totalAdj} pts risk deduction)` : ""}.`
        );
      }
    } else if (unifiedRating === "BUY" && typeof dte === "number" && dte >= 0 && dte <= 5 && netConf !== null && netConf < 65) {
      unifiedRating = "HOLD";
      status = "ADJUSTED";
      notes.push(
        `Unified BUY \u2192 HOLD: earnings due in ${dte}d with ${netConf.toFixed(1)}% net confidence (<65% event buffer).`
      );
    } else if (unifiedRating === "EXIT" && netConf !== null && netConf >= 70 && t.sma200 && live > t.sma200) {
      unifiedRating = "HOLD";
      status = "ADJUSTED";
      notes.push(
        `Unified EXIT \u2192 HOLD: strong ${netConf.toFixed(1)}% confidence above 200-DMA (consider partial trim instead of full exit).`
      );
    }
    if (unifiedRating === "BUY" || unifiedRating === "HOLD") {
      if (!Number.isFinite(target) || target <= live * 1.01) {
        const fallbackTarget = t.sma200 && t.sma200 > live * 1.04 ? Math.min(t.sma200, live * 1.25) : live * (1 + 0.12 * beta);
        target = Number(fallbackTarget.toFixed(2));
        status = "ADJUSTED";
        notes.push("Upside target calibrated above live market price.");
      } else if (target > live * (1 + maxUpsidePct / 100)) {
        target = Number((live * (1 + maxUpsidePct / 100)).toFixed(2));
        status = "ADJUSTED";
        notes.push(`Target clamped within ${maxUpsidePct}% \u03B2-volatility ceiling.`);
      }
      if (!Number.isFinite(stop) || stop <= 0 || stop >= live * (1 - minStopPct / 100)) {
        const supportRef = t.sma50 && t.sma50 < live * 0.97 && t.sma50 > live * (1 - maxStopPct / 100) ? t.sma50 * 0.985 : live * (1 - Math.min(10, 6 * beta) / 100);
        stop = Number(supportRef.toFixed(2));
        status = "ADJUSTED";
        notes.push("Stop-loss snapped to technical support below live price.");
      } else if (stop < live * (1 - maxStopPct / 100)) {
        stop = Number((live * (1 - maxStopPct / 100)).toFixed(2));
        status = "ADJUSTED";
        notes.push(`Stop-loss tightened inside ${maxStopPct}% max drawdown guardrail.`);
      }
    } else {
      if (!Number.isFinite(target) || target > live * 1.15 || target <= 0) {
        target = Number((live * 1.05).toFixed(2));
        status = "ADJUSTED";
        notes.push("EXIT target capped near immediate overhead supply.");
      }
      if (!Number.isFinite(stop) || stop <= 0 || stop >= live * 0.995) {
        stop = Number((live * 0.95).toFixed(2));
        status = "ADJUSTED";
        notes.push("EXIT stop-loss adjusted below live price.");
      }
    }
    if (unifiedRating === "BUY" && t.sma200 && live < t.sma200 * 0.88 && (t.return6M ?? 0) < -12 && (t.rsi14 ?? 50) > 38) {
      if (status === "PASSED") status = "FLAGGED";
      notes.push(
        `Trend conflict: trading >12% below 200-DMA (6M ${t.return6M}%) \u2014 falling-knife risk on BUY.`
      );
    } else if (unifiedRating === "EXIT" && t.sma50 && t.sma200 && live > t.sma50 && live > t.sma200 && (t.return6M ?? 0) > 12) {
      if (status === "PASSED") status = "FLAGGED";
      notes.push(
        "Trend conflict: above both 50-DMA & 200-DMA with positive 6M momentum \u2014 verify before exiting."
      );
    }
    if (netConf !== null) {
      if (unifiedRating === "BUY") {
        unifiedConviction = netConf >= 68 && status !== "FLAGGED" && totalAdj > -7 ? "High" : netConf >= 52 ? "Medium" : "Low";
      } else if (unifiedRating === "EXIT") {
        unifiedConviction = netConf <= 38 && status !== "FLAGGED" ? "High" : netConf <= 55 ? "Medium" : "Low";
      } else {
        unifiedConviction = totalAdj <= -7 || netConf < 48 ? "Low" : netConf >= 66 && status === "PASSED" ? "High" : "Medium";
      }
    }
    const finalTarget = Number(target.toFixed(2));
    const projection = buildStockProjection(t, unifiedRating, finalTarget, {
      p1m,
      p3m,
      p6m,
      p1y,
      cagr5y,
      cagr10y
    });
    return {
      ...cleanRating,
      rating: unifiedRating,
      conviction: unifiedConviction,
      suggestedTarget: finalTarget,
      suggestedStopLoss: Number(stop.toFixed(2)),
      projection,
      guardrailStatus: status,
      guardrailNote: notes.length > 0 ? notes.join(" ") : `Verified: verdict aligned with ${netConf !== null ? `${netConf.toFixed(1)}% net confidence` : "live telemetry"}, \u03B2 (${beta.toFixed(2)}x) & DMA support.`,
      confidence: t.confidence,
      fundamentals: t.fundamentals ?? null
    };
  });
}
async function analyzePortfolioHoldings(holdings, options) {
  if (holdings.length === 0) {
    throw new Error("Add at least one holding before running AI portfolio analysis.");
  }
  const consolidatedMap = /* @__PURE__ */ new Map();
  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();
    const existing = consolidatedMap.get(sym);
    if (!existing) {
      consolidatedMap.set(sym, { ...h, symbol: sym });
    } else {
      const totalQty = existing.quantity + h.quantity;
      const totalCost = existing.quantity * existing.avgBuyPrice + h.quantity * h.avgBuyPrice;
      consolidatedMap.set(sym, {
        ...existing,
        quantity: Number(totalQty.toFixed(4)),
        avgBuyPrice: totalQty > 0 ? Number((totalCost / totalQty).toFixed(2)) : existing.avgBuyPrice,
        buyDate: existing.buyDate <= h.buyDate ? existing.buyDate : h.buyDate
      });
    }
  }
  const uniqueHoldings = Array.from(consolidatedMap.values());
  const symbols = Array.from(/* @__PURE__ */ new Set(["^NSEI", ...uniqueHoldings.map((h) => h.symbol)]));
  const [quotes, fundamentalsMap] = await Promise.all([
    getQuotes(symbols),
    getLiveFundamentalsBatch(uniqueHoldings.map((h) => h.symbol), 6)
  ]);
  const nifty = quotes["^NSEI"] ?? null;
  const enrichedPayload = uniqueHoldings.map((h) => {
    const sym = h.symbol.toUpperCase();
    const fund = fundamentalsMap[sym] ?? null;
    const rawQ = quotes[sym];
    const q = rawQ ? mergeQuoteWithFundamentals(rawQ, fund) : void 0;
    const livePrice = q?.price ?? h.avgBuyPrice;
    const invested = h.quantity * h.avgBuyPrice;
    const currentValue = h.quantity * livePrice;
    const pnlPct = invested > 0 ? (currentValue - invested) / invested * 100 : 0;
    const confidence = computeConfidenceBreakdown({
      price: livePrice,
      sma50: q?.sma50 ?? null,
      sma200: q?.sma200 ?? null,
      fiftyTwoWeekHigh: q?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: q?.fiftyTwoWeekLow ?? null,
      rsi14: q?.rsi14 ?? null,
      volumeRatio: q?.volumeRatio ?? 1,
      dayChangePercent: q?.changePercent ?? 0,
      return1M: q?.return1M ?? null,
      return3M: q?.return3M ?? null,
      return6M: q?.return6M ?? null,
      niftyReturn1M: nifty?.return1M ?? null,
      niftyReturn3M: nifty?.return3M ?? null,
      niftyReturn6M: nifty?.return6M ?? null,
      sector: q?.sector || h.sector,
      applyRiskDeductions: true,
      nextEarningsDate: fund?.nextEarningsDate ?? q?.nextEarningsDate ?? null,
      daysToEarnings: fund?.daysToEarnings ?? q?.daysToEarnings ?? null,
      earningsRiskFlag: fund?.earningsRiskFlag ?? q?.earningsRiskFlag ?? false,
      fundamentalsSource: sym.startsWith("^") ? null : fund?.source ?? q?.fundamentalsSource ?? "catalog_fallback",
      fundamentals: {
        trailingPE: fund?.trailingPE ?? q?.peRatio ?? null,
        forwardPE: fund?.forwardPE ?? null,
        roePct: fund?.roePct ?? null,
        roceProxyPct: fund?.roceProxyPct ?? q?.roce ?? null,
        revenueGrowthPct: fund?.revenueGrowthPct ?? null,
        earningsGrowthPct: fund?.earningsGrowthPct ?? null,
        operatingMarginPct: fund?.operatingMarginPct ?? null,
        fcfMarginPct: fund?.fcfMarginPct ?? null,
        debtToEquity: fund?.debtToEquity ?? q?.debtToEquity ?? null
      }
    });
    return {
      symbol: sym,
      companyName: h.companyName,
      sector: q?.sector || h.sector,
      capCategory: q?.capCategory || "Mid Cap",
      quantity: h.quantity,
      avgBuyPrice: h.avgBuyPrice,
      buyDate: h.buyDate,
      livePrice,
      currentValue: Number(currentValue.toFixed(2)),
      unrealizedPnlPercent: Number(pnlPct.toFixed(2)),
      dayChangePercent: q?.changePercent ?? 0,
      rsi14: q?.rsi14 ?? null,
      sma50: q?.sma50 ?? null,
      sma200: q?.sma200 ?? null,
      return1M: q?.return1M ?? null,
      return3M: q?.return3M ?? null,
      return6M: q?.return6M ?? null,
      return1Y: q?.return1Y ?? null,
      peRatio: fund?.trailingPE ?? q?.peRatio ?? null,
      roce: fund?.roceProxyPct ?? q?.roce ?? null,
      debtToEquity: fund?.debtToEquity ?? q?.debtToEquity ?? null,
      beta: q?.beta ?? 1,
      volumeRatio: q?.volumeRatio ?? 1,
      confidence,
      fundamentals: fund
    };
  });
  const localTotalCurrent = enrichedPayload.reduce((s, r) => s + r.currentValue, 0);
  const totalCurrent = options?.totalPortfolioValue && options.totalPortfolioValue > 0 ? options.totalPortfolioValue : localTotalCurrent;
  const portfolioWithWeights = enrichedPayload.map((r) => ({
    ...r,
    portfolioWeightPercent: totalCurrent > 0 ? Number((r.currentValue / totalCurrent * 100).toFixed(2)) : 0
  }));
  const sectorTotals = /* @__PURE__ */ new Map();
  for (const item of portfolioWithWeights) {
    sectorTotals.set(item.sector, (sectorTotals.get(item.sector) ?? 0) + item.portfolioWeightPercent);
  }
  const sectorBreakdownText = Array.from(sectorTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([sec, wt]) => `${sec}: ${wt.toFixed(1)}%`).join(", ");
  const batches = [];
  for (let i = 0; i < portfolioWithWeights.length; i += STOCK_AI_BATCH_SIZE) {
    batches.push(portfolioWithWeights.slice(i, i + STOCK_AI_BATCH_SIZE));
  }
  let batchResults;
  if (!process.env.GEMINI_API_KEY) {
    batchResults = batches.map((batch, idx) => ({
      ...evaluateBatchQuantFallback({
        batch,
        nifty,
        sectorBreakdownText,
        includeExecutiveSummary: idx === 0 && !options?.skipPortfolioSummary
      }),
      quotaExhausted: false
    }));
  } else {
    const ai = new GoogleGenAI2({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    batchResults = await runWithConcurrency4(
      batches,
      AI_BATCH_CONCURRENCY,
      (batch, idx) => evaluateTelemetryBatch({
        ai,
        batch,
        nifty,
        includeExecutiveSummary: idx === 0 && !options?.skipPortfolioSummary,
        sectorBreakdownText
      })
    );
  }
  const usedFallback = batchResults.some((r) => r.usedFallbackEngine);
  const hadQuotaError = batchResults.some((r) => r.quotaExhausted);
  const combinedRawRatings = batchResults.flatMap((r) => r.ratings);
  const telemetryBySymbol = new Map(portfolioWithWeights.map((item) => [item.symbol, item]));
  const guardedRatings = applyGuardrails(combinedRawRatings, telemetryBySymbol);
  let baseValue = 0;
  let sum1m = 0;
  let sum3m = 0;
  let sum6m = 0;
  let sum1y = 0;
  let sum5y = 0;
  let sum10y = 0;
  for (const r of guardedRatings) {
    const t = telemetryBySymbol.get(r.symbol.toUpperCase());
    if (!t || !r.projection || t.livePrice <= 0) continue;
    const posVal = t.quantity * t.livePrice;
    baseValue += posVal;
    sum1m += t.quantity * (r.projection.value1M ?? t.livePrice);
    sum3m += t.quantity * (r.projection.value3M ?? t.livePrice);
    sum6m += t.quantity * r.projection.value6M;
    sum1y += t.quantity * r.projection.value1Y;
    sum5y += t.quantity * r.projection.value5Y;
    sum10y += t.quantity * r.projection.value10Y;
  }
  const portfolioProjection = baseValue > 0 ? {
    return1MPercent: Number(((sum1m - baseValue) / baseValue * 100).toFixed(1)),
    value1M: Math.round(sum1m),
    return3MPercent: Number(((sum3m - baseValue) / baseValue * 100).toFixed(1)),
    value3M: Math.round(sum3m),
    return6MPercent: Number(((sum6m - baseValue) / baseValue * 100).toFixed(1)),
    value6M: Math.round(sum6m),
    return1YPercent: Number(((sum1y - baseValue) / baseValue * 100).toFixed(1)),
    value1Y: Math.round(sum1y),
    cagr5YPercent: Number(((Math.pow(sum5y / baseValue, 1 / 5) - 1) * 100).toFixed(1)),
    value5Y: Math.round(sum5y),
    cagr10YPercent: Number(((Math.pow(sum10y / baseValue, 1 / 10) - 1) * 100).toFixed(1)),
    value10Y: Math.round(sum10y),
    basisNote: "Capital-weighted forecast aggregated across every rated NSE/BSE holding."
  } : void 0;
  const first = batchResults[0];
  const ratingsWithCalibration = await Promise.all(
    guardedRatings.map(async (r, idx) => {
      const calibration = await getLiveCalibrationForSymbol({
        symbol: r.symbol,
        rawConfidence: r.confidence?.overallScore ?? 60,
        waitMs: idx === 0 ? 1200 : 0
      }).catch(() => null);
      return {
        ...r,
        calibration
      };
    })
  );
  return {
    overallSummary: first?.overallSummary || "Portfolio evaluation complete.",
    diversificationNote: first?.diversificationNote || "",
    actionPriority: first?.actionPriority || "",
    ratings: ratingsWithCalibration,
    portfolioProjection,
    benchmarkNifty6M: nifty?.return6M ?? null,
    analysisSource: usedFallback ? "fallback_engine" : "gemini",
    quotaNotice: usedFallback ? hadQuotaError || !process.env.GEMINI_API_KEY ? QUOTA_EXHAUSTED_NOTICE : TRANSIENT_FALLBACK_NOTICE : void 0,
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var SYMBOL_OUTLOOK_TTL_MS = 10 * 60 * 1e3;
var symbolOutlookCache = /* @__PURE__ */ new Map();
async function analyzeSingleSymbolOutlook(symbolInput, options) {
  const symbol = resolveActiveMarketSymbol(symbolInput);
  if (!symbol) {
    throw new Error("A valid stock or index symbol is required.");
  }
  if (!options?.forceRefresh) {
    const cached = symbolOutlookCache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }
  const fetchList = Array.from(/* @__PURE__ */ new Set(["^NSEI", symbol]));
  const [quotes, liveFundamentals, chart1Y] = await Promise.all([
    getQuotes(fetchList),
    symbol.startsWith("^") ? Promise.resolve(null) : getLiveFundamentals(symbol),
    getChart(symbol, "1y").catch(() => null)
  ]);
  const rawQuote = quotes[symbol];
  const quote = rawQuote ? mergeQuoteWithFundamentals(rawQuote, liveFundamentals) : void 0;
  const nifty = quotes["^NSEI"] ?? null;
  if (!quote || quote.price <= 0) {
    throw new Error(`No live market quote available for ${symbol}.`);
  }
  const technicalSummary = computeTechnicalSummaryFromCandles(
    chart1Y?.candles ?? [],
    quote.price
  );
  const fairValue = computeIntrinsicFairValue({
    symbol,
    sector: quote.sector || "Equities",
    livePrice: quote.price,
    peRatio: quote.peRatio ?? null,
    roce: quote.roce ?? null,
    fundamentals: liveFundamentals
  });
  const confidence = computeConfidenceBreakdown({
    price: quote.price,
    sma50: quote.sma50 ?? null,
    sma200: quote.sma200 ?? null,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
    rsi14: quote.rsi14 ?? null,
    volumeRatio: quote.volumeRatio ?? 1,
    dayChangePercent: quote.changePercent ?? 0,
    return1M: quote.return1M ?? null,
    return3M: quote.return3M ?? null,
    return6M: quote.return6M ?? null,
    niftyReturn1M: nifty?.return1M ?? null,
    niftyReturn3M: nifty?.return3M ?? null,
    niftyReturn6M: nifty?.return6M ?? null,
    sector: quote.sector || "Equities",
    applyRiskDeductions: true,
    nextEarningsDate: liveFundamentals?.nextEarningsDate ?? quote.nextEarningsDate ?? null,
    daysToEarnings: liveFundamentals?.daysToEarnings ?? quote.daysToEarnings ?? null,
    earningsRiskFlag: liveFundamentals?.earningsRiskFlag ?? quote.earningsRiskFlag ?? false,
    fundamentalsSource: symbol.startsWith("^") ? null : liveFundamentals?.source ?? quote.fundamentalsSource ?? "catalog_fallback",
    fundamentals: liveFundamentals ? {
      trailingPE: liveFundamentals.trailingPE,
      forwardPE: liveFundamentals.forwardPE,
      roePct: liveFundamentals.roePct,
      roceProxyPct: liveFundamentals.roceProxyPct,
      revenueGrowthPct: liveFundamentals.revenueGrowthPct,
      earningsGrowthPct: liveFundamentals.earningsGrowthPct,
      operatingMarginPct: liveFundamentals.operatingMarginPct,
      fcfMarginPct: liveFundamentals.fcfMarginPct ?? null,
      debtToEquity: liveFundamentals.debtToEquity
    } : {
      trailingPE: quote.peRatio,
      roceProxyPct: quote.roce,
      debtToEquity: quote.debtToEquity
    }
  });
  const telemetryItem = {
    symbol,
    companyName: quote.shortName || symbol,
    sector: quote.sector || "Equities",
    capCategory: quote.capCategory || "Large Cap",
    quantity: 1,
    avgBuyPrice: quote.price,
    buyDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    livePrice: quote.price,
    currentValue: quote.price,
    unrealizedPnlPercent: 0,
    dayChangePercent: quote.changePercent ?? 0,
    rsi14: quote.rsi14 ?? null,
    sma50: quote.sma50 ?? null,
    sma200: quote.sma200 ?? null,
    return1M: quote.return1M ?? null,
    return3M: quote.return3M ?? null,
    return6M: quote.return6M ?? null,
    return1Y: quote.return1Y ?? null,
    peRatio: quote.peRatio ?? null,
    roce: quote.roce ?? null,
    debtToEquity: quote.debtToEquity ?? null,
    beta: quote.beta ?? 1,
    volumeRatio: quote.volumeRatio ?? 1,
    portfolioWeightPercent: 0,
    confidence,
    fundamentals: liveFundamentals
  };
  let rawRatings = [];
  let usedFallback = false;
  if (!process.env.GEMINI_API_KEY) {
    const fallback = evaluateBatchQuantFallback({
      batch: [telemetryItem],
      nifty,
      sectorBreakdownText: quote.sector || "Equities",
      includeExecutiveSummary: false
    });
    rawRatings = fallback.ratings;
    usedFallback = true;
  } else {
    const ai = new GoogleGenAI2({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const compactPayload = {
      symbol: telemetryItem.symbol,
      name: telemetryItem.companyName,
      exchange: quote.exchange,
      sector: telemetryItem.sector,
      cap: telemetryItem.capCategory,
      ltp: telemetryItem.livePrice,
      dayChgPct: telemetryItem.dayChangePercent,
      rsi14: telemetryItem.rsi14,
      sma50: telemetryItem.sma50,
      sma200: telemetryItem.sma200,
      r1m: telemetryItem.return1M,
      r3m: telemetryItem.return3M,
      r6m: telemetryItem.return6M,
      r1y: telemetryItem.return1Y,
      roce: telemetryItem.roce,
      roe: liveFundamentals?.roePct ?? null,
      revGrowthPct: liveFundamentals?.revenueGrowthPct ?? null,
      earnGrowthPct: liveFundamentals?.earningsGrowthPct ?? null,
      pe: telemetryItem.peRatio,
      fwdPe: liveFundamentals?.forwardPE ?? null,
      de: telemetryItem.debtToEquity,
      nextEarningsDate: liveFundamentals?.nextEarningsDate ?? null,
      daysToEarnings: liveFundamentals?.daysToEarnings ?? null,
      confidenceScore: confidence.overallScore,
      baseConfidenceScore: confidence.baseScore ?? confidence.overallScore,
      confidenceAdjustment: confidence.totalAdjustment ?? 0,
      beta: telemetryItem.beta,
      volRatio: telemetryItem.volumeRatio
    };
    const prompt = `Evaluate this single Indian NSE/BSE stock or index (${telemetryItem.symbol}) and provide a forward outlook with 1-month (p1m), 3-month (p3m), 6-month (p6m), 1-year (p1y), 5-year annual CAGR (cagr5y), and 10-year annual CAGR (cagr10y) return estimates.
Nifty50 benchmark: level=${nifty ? nifty.price : "N/A"}, 1D=${nifty ? `${nifty.changePercent}%` : "N/A"}, 6M=${nifty?.return6M ?? "N/A"}%.
${RATING_CRITERIA}
Give:
- rating: BUY, HOLD, or EXIT (strictly applying the criteria above)
- conviction: High, Medium, or Low
- headline: crisp 1-sentence technical + fundamental thesis
- rationale: 1-2 concise sentences citing live price, 50/200-DMA alignment, RSI-14, ROCE/valuation, or Nifty relative strength
- keyRisk: 1 concise sentence on primary downside risk
- suggestedTarget & suggestedStopLoss: realistic INR levels relative to LTP
- p1m, p3m, p6m & p1y: expected cumulative percentage price return over next 1 month, 3 months, 6 months, and 1 year
- cagr5y & cagr10y: expected annualized CAGR percentage over 5-year and 10-year compounding horizons
Data: ${JSON.stringify(compactPayload)}`;
    const singleSchema = {
      type: Type2.OBJECT,
      properties: {
        rating: { type: Type2.STRING, enum: ["BUY", "HOLD", "EXIT"] },
        conviction: { type: Type2.STRING, enum: ["High", "Medium", "Low"] },
        headline: { type: Type2.STRING },
        rationale: { type: Type2.STRING },
        keyRisk: { type: Type2.STRING },
        suggestedTarget: { type: Type2.NUMBER },
        suggestedStopLoss: { type: Type2.NUMBER },
        p1m: { type: Type2.NUMBER },
        p3m: { type: Type2.NUMBER },
        p6m: { type: Type2.NUMBER },
        p1y: { type: Type2.NUMBER },
        cagr5y: { type: Type2.NUMBER },
        cagr10y: { type: Type2.NUMBER }
      },
      required: [
        "rating",
        "conviction",
        "headline",
        "rationale",
        "keyRisk",
        "suggestedTarget",
        "suggestedStopLoss",
        "p1m",
        "p3m",
        "p6m",
        "p1y",
        "cagr5y",
        "cagr10y"
      ]
    };
    const modelCandidates = [
      { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel2.LOW },
      { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel2.MINIMAL }
    ];
    let lastError;
    for (const candidate of modelCandidates) {
      try {
        const response = await ai.models.generateContent({
          model: candidate.model,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
            systemInstruction: "You are a quantitative Indian equity analyst for Stoxify. Produce crisp, objective JSON outlooks strictly grounded in the live market telemetry.",
            responseMimeType: "application/json",
            responseSchema: singleSchema
          }
        });
        const parsed = safeParseJsonObject(response.text);
        if (parsed?.rating) {
          rawRatings = [{ ...parsed, symbol }];
          break;
        }
        lastError = new Error(`Malformed or empty JSON outlook from ${candidate.model}`);
      } catch (err) {
        lastError = err;
      }
    }
    if (rawRatings.length === 0) {
      const fallback = evaluateBatchQuantFallback({
        batch: [telemetryItem],
        nifty,
        sectorBreakdownText: quote.sector || "Equities",
        includeExecutiveSummary: false
      });
      rawRatings = fallback.ratings;
      usedFallback = true;
    }
    if (usedFallback && lastError && !isQuotaOrRateLimitError(lastError)) {
      console.warn(`AI outlook fell back to quantitative engine for ${symbol}:`, lastError);
    }
  }
  const telemetryMap = /* @__PURE__ */ new Map([[symbol, telemetryItem]]);
  const [guarded] = applyGuardrails(rawRatings, telemetryMap);
  const projection = guarded.projection ?? buildStockProjection(telemetryItem, guarded.rating, guarded.suggestedTarget);
  const calibration = await getLiveCalibrationForSymbol({
    symbol,
    rawConfidence: confidence.overallScore,
    waitMs: 1800
  }).catch(() => null);
  const result = {
    symbol,
    companyName: quote.shortName || symbol,
    exchange: quote.exchange || "NSE",
    sector: quote.sector || "Equities",
    livePrice: Number(quote.price.toFixed(2)),
    rating: guarded.rating,
    conviction: guarded.conviction,
    headline: guarded.headline,
    rationale: guarded.rationale,
    keyRisk: guarded.keyRisk,
    suggestedTarget: guarded.suggestedTarget,
    suggestedStopLoss: guarded.suggestedStopLoss,
    projection,
    guardrailStatus: guarded.guardrailStatus ?? "PASSED",
    guardrailNote: guarded.guardrailNote ?? "Verified against live quote telemetry.",
    confidence,
    fundamentals: liveFundamentals,
    technicalSummary,
    fairValue,
    calibration,
    benchmarkNifty6M: nifty?.return6M ?? null,
    analysisSource: usedFallback ? "fallback_engine" : "gemini",
    quotaNotice: usedFallback ? QUOTA_EXHAUSTED_NOTICE : void 0,
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  symbolOutlookCache.set(symbol, {
    data: result,
    expiresAt: Date.now() + SYMBOL_OUTLOOK_TTL_MS
  });
  return result;
}

// server/schemeMetadataCatalog.ts
var VERIFIED_SCHEME_METADATA = {
  // Parag Parikh Flexi Cap Fund (Direct & Regular)
  "122639": {
    directTer: 0.63,
    regularTer: 1.33,
    exitLoadTiers: [
      { maxDays: 365, ratePct: 2 },
      { maxDays: 730, ratePct: 1 }
    ],
    exitLoadRuleLabel: "2% \u2264 365d, 1% \u2264 730d"
  },
  "122640": {
    directTer: 0.63,
    regularTer: 1.33,
    exitLoadTiers: [
      { maxDays: 365, ratePct: 2 },
      { maxDays: 730, ratePct: 1 }
    ],
    exitLoadRuleLabel: "2% \u2264 365d, 1% \u2264 730d"
  },
  // HDFC Flexi Cap Fund
  "118955": {
    directTer: 0.78,
    regularTer: 1.47,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  "101762": {
    directTer: 0.78,
    regularTer: 1.47,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  // Axis Large Cap Fund
  "120465": {
    directTer: 0.73,
    regularTer: 1.59,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  "112277": {
    directTer: 0.73,
    regularTer: 1.59,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  // SBI Small Cap Fund
  "125497": {
    directTer: 0.7,
    regularTer: 1.64,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  "125494": {
    directTer: 0.7,
    regularTer: 1.64,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  // Nippon India Small Cap Fund
  "118778": {
    directTer: 0.67,
    regularTer: 1.45,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  // HDFC Mid Cap Fund
  "118989": {
    directTer: 0.76,
    regularTer: 1.46,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  // HDFC Large & Mid Cap Fund
  "130498": {
    directTer: 0.86,
    regularTer: 1.68,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  // Mirae Asset Large & Midcap Fund
  "118834": {
    directTer: 0.55,
    regularTer: 1.54,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  // Motilal Oswal Index Funds
  "147622": {
    directTer: 0.3,
    regularTer: 1,
    exitLoadTiers: [{ maxDays: 15, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 15d"
  },
  "147623": {
    directTer: 0.36,
    regularTer: 1.05,
    exitLoadTiers: [{ maxDays: 15, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 15d"
  },
  "147625": {
    directTer: 0.33,
    regularTer: 1.03,
    exitLoadTiers: [{ maxDays: 15, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 15d"
  },
  // ICICI Prudential Large Cap Fund
  "120586": {
    directTer: 0.88,
    regularTer: 1.55,
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadRuleLabel: "1% \u2264 365d"
  },
  // UTI Nifty 50 Index Fund
  "120716": {
    directTer: 0.18,
    regularTer: 0.33,
    exitLoadTiers: [],
    exitLoadRuleLabel: "Nil Exit Load"
  },
  // Mirae Asset ELSS Tax Saver Fund
  "135781": {
    directTer: 0.56,
    regularTer: 1.58,
    exitLoadTiers: [],
    exitLoadRuleLabel: "3Y Statutory ELSS Lock-in",
    isElssLockIn: true
  },
  // Quant ELSS Tax Saver Fund
  "120847": {
    directTer: 0.77,
    regularTer: 1.77,
    exitLoadTiers: [],
    exitLoadRuleLabel: "3Y Statutory ELSS Lock-in",
    isElssLockIn: true
  },
  // HDFC Corporate Bond Fund
  "118987": {
    directTer: 0.36,
    regularTer: 0.62,
    exitLoadTiers: [],
    exitLoadRuleLabel: "Nil Exit Load"
  }
};
function resolveSchemeCostProfile(params) {
  const verified = VERIFIED_SCHEME_METADATA[params.schemeCode];
  if (verified) {
    const maxWindow = verified.isElssLockIn ? 1095 : verified.exitLoadTiers.reduce((m, t) => Math.max(m, t.maxDays), 0);
    return {
      terPct: params.planType === "Direct" ? verified.directTer : verified.regularTer,
      terSource: "AMC Verified",
      exitLoadTiers: verified.exitLoadTiers,
      exitLoadWindowDays: maxWindow,
      exitLoadRuleLabel: verified.exitLoadRuleLabel,
      isElssLockIn: Boolean(verified.isElssLockIn)
    };
  }
  const c = `${params.category} ${params.schemeName}`.toLowerCase();
  if (c.includes("elss") || c.includes("tax saver")) {
    return {
      terPct: params.planType === "Direct" ? 0.65 : 1.65,
      terSource: "Category Est.",
      exitLoadTiers: [],
      exitLoadWindowDays: 1095,
      exitLoadRuleLabel: "3Y Statutory ELSS Lock-in",
      isElssLockIn: true
    };
  }
  if (c.includes("index") || c.includes("nifty") || c.includes("sensex")) {
    return {
      terPct: params.planType === "Direct" ? 0.22 : 0.65,
      terSource: "Category Est.",
      exitLoadTiers: [],
      exitLoadWindowDays: 0,
      exitLoadRuleLabel: "Nil / Minimal Exit Load",
      isElssLockIn: false
    };
  }
  if (c.includes("debt") || c.includes("bond") || c.includes("liquid") || c.includes("gilt") || c.includes("money market")) {
    return {
      terPct: params.planType === "Direct" ? 0.34 : 0.72,
      terSource: "Category Est.",
      exitLoadTiers: [],
      exitLoadWindowDays: 0,
      exitLoadRuleLabel: "Nil Exit Load",
      isElssLockIn: false
    };
  }
  if (c.includes("small cap") || c.includes("mid cap")) {
    return {
      terPct: params.planType === "Direct" ? 0.68 : 1.68,
      terSource: "Category Est.",
      exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
      exitLoadWindowDays: 365,
      exitLoadRuleLabel: "1% \u2264 365d",
      isElssLockIn: false
    };
  }
  if (c.includes("hybrid") || c.includes("balanced") || c.includes("advantage")) {
    return {
      terPct: params.planType === "Direct" ? 0.58 : 1.55,
      terSource: "Category Est.",
      exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
      exitLoadWindowDays: 365,
      exitLoadRuleLabel: "1% \u2264 365d",
      isElssLockIn: false
    };
  }
  return {
    terPct: params.planType === "Direct" ? 0.65 : 1.58,
    terSource: "Category Est.",
    exitLoadTiers: [{ maxDays: 365, ratePct: 1 }],
    exitLoadWindowDays: 365,
    exitLoadRuleLabel: "1% \u2264 365d",
    isElssLockIn: false
  };
}
function evaluateTieredExitLoadPct(tiers, holdingDays) {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.maxDays - b.maxDays);
  for (const tier of sorted) {
    if (holdingDays <= tier.maxDays) {
      return tier.ratePct;
    }
  }
  return 0;
}

// server/mutualFundService.ts
var MFAPI_BASE = "https://api.mfapi.in";
var YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
var RISK_FREE_ANNUAL_RATE = 0.065;
var schemeCache = /* @__PURE__ */ new Map();
var searchCache2 = /* @__PURE__ */ new Map();
var benchmarkCache = /* @__PURE__ */ new Map();
var CATEGORY_PEERS = {
  "Flexi Cap": [
    { schemeCode: "122639", label: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth" },
    { schemeCode: "118955", label: "HDFC Flexi Cap Fund - Direct Plan - Growth Option" }
  ],
  "Large Cap": [
    { schemeCode: "120586", label: "ICICI Prudential Large Cap Fund - Direct Plan - Growth" },
    { schemeCode: "120716", label: "UTI Nifty 50 Index Fund - Direct Plan - Growth" }
  ],
  "Large & Mid Cap": [
    { schemeCode: "118834", label: "Mirae Asset Large & Midcap Fund - Direct Plan - Growth" },
    { schemeCode: "130498", label: "HDFC Large & Mid Cap Fund - Direct Plan - Growth Option" }
  ],
  "Mid Cap": [
    { schemeCode: "118989", label: "HDFC Mid Cap Fund - Direct Plan - Growth Option" },
    { schemeCode: "147622", label: "Motilal Oswal Nifty Midcap 150 Index Fund - Direct Plan - Growth" }
  ],
  "Small Cap": [
    { schemeCode: "118778", label: "Nippon India Small Cap Fund - Direct Plan - Growth Option" },
    { schemeCode: "125497", label: "SBI SMALL CAP FUND - Direct Plan - Growth" }
  ],
  ELSS: [
    { schemeCode: "135781", label: "Mirae Asset ELSS Tax Saver Fund - Direct Plan - Growth" },
    { schemeCode: "120847", label: "Quant ELSS Tax Saver Fund - Direct Plan - Growth Option" }
  ],
  "Index / ETF": [
    { schemeCode: "120716", label: "UTI Nifty 50 Index Fund - Direct Plan - Growth" },
    { schemeCode: "147622", label: "Motilal Oswal Nifty Midcap 150 Index Fund - Direct Plan - Growth" }
  ],
  "Debt / Corporate Bond": [
    { schemeCode: "118987", label: "HDFC Corporate Bond Fund - Direct Plan - Growth Option" }
  ]
};
function detectPlanType(name) {
  if (/\bregular\b/i.test(name)) return "Regular";
  if (/\bdirect\b/i.test(name)) return "Direct";
  return "Regular";
}
function detectOptionType(name) {
  if (/\b(idcw|dividend|payout|reinvest)\b/i.test(name)) return "IDCW";
  return "Growth";
}
function normalizeCategoryLabel(rawCategory, schemeName) {
  const text = `${rawCategory} ${schemeName}`.toLowerCase();
  if (text.includes("elss") || text.includes("tax saver")) return "ELSS";
  if (text.includes("flexi cap") || text.includes("multi cap") || text.includes("focused")) {
    return "Flexi Cap";
  }
  if (text.includes("large & mid") || text.includes("large and mid")) return "Large & Mid Cap";
  if (text.includes("small cap")) return "Small Cap";
  if (text.includes("mid cap") || text.includes("midcap")) return "Mid Cap";
  if (text.includes("index") || text.includes("nifty 50") || text.includes("sensex")) {
    return "Index / ETF";
  }
  if (text.includes("large cap") || text.includes("bluechip")) return "Large Cap";
  if (text.includes("debt") || text.includes("corporate bond") || text.includes("short duration") || text.includes("liquid") || text.includes("gilt") || text.includes("money market")) {
    return "Debt / Corporate Bond";
  }
  if (text.includes("hybrid") || text.includes("balanced") || text.includes("advantage")) {
    return "Hybrid / Balanced";
  }
  return rawCategory.replace(/^Equity Scheme\s*-\s*/i, "").trim() || "Flexi Cap";
}
function isDebtCategory(category) {
  const c = category.toLowerCase();
  return c.includes("debt") || c.includes("bond") || c.includes("liquid") || c.includes("gilt") || c.includes("money market");
}
function parseDdMmYyyyToIso(raw) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}
async function searchMutualFunds(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = trimmed.toLowerCase();
  const cached = searchCache2.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  try {
    const res = await fetch(`${MFAPI_BASE}/mf/search?q=${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return [];
    const rawList = await res.json();
    const mapped = (Array.isArray(rawList) ? rawList : []).filter((item) => item.schemeCode && item.schemeName).map((item) => ({
      schemeCode: String(item.schemeCode),
      schemeName: item.schemeName.trim(),
      planType: detectPlanType(item.schemeName),
      optionType: detectOptionType(item.schemeName)
    })).sort((a, b) => {
      if (a.optionType !== b.optionType) return a.optionType === "Growth" ? -1 : 1;
      const aBonus = /\bbonus\b/i.test(a.schemeName) ? 1 : 0;
      const bBonus = /\bbonus\b/i.test(b.schemeName) ? 1 : 0;
      if (aBonus !== bBonus) return aBonus - bBonus;
      const aGrowth = /\bgrowth\b/i.test(a.schemeName) ? 1 : 0;
      const bGrowth = /\bgrowth\b/i.test(b.schemeName) ? 1 : 0;
      if (aGrowth !== bGrowth) return bGrowth - aGrowth;
      if (a.planType !== b.planType) return a.planType === "Direct" ? -1 : 1;
      return a.schemeName.length - b.schemeName.length;
    }).slice(0, 25);
    searchCache2.set(cacheKey, { expiresAt: Date.now() + 30 * 60 * 1e3, data: mapped });
    return mapped;
  } catch {
    return [];
  }
}
async function fetchMfSchemeSeries(schemeCode) {
  const cleanCode = schemeCode.replace(/[^0-9]/g, "");
  if (!cleanCode) return null;
  const cached = schemeCache.get(cleanCode);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  try {
    const res = await fetch(`${MFAPI_BASE}/mf/${cleanCode}`, {
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const meta = payload.meta ?? {};
    const rawData = Array.isArray(payload.data) ? payload.data : [];
    if (rawData.length === 0) return null;
    const points = [];
    for (const row of rawData) {
      const iso = parseDdMmYyyyToIso(row.date);
      const nav = Number(row.nav);
      if (!iso || !Number.isFinite(nav) || nav <= 0) continue;
      const ts = Date.parse(`${iso}T00:00:00Z`);
      if (!Number.isFinite(ts)) continue;
      points.push({ date: iso, timestamp: ts, nav: Number(nav.toFixed(4)) });
    }
    points.sort((a, b) => a.timestamp - b.timestamp);
    if (points.length === 0) return null;
    const schemeName = meta.scheme_name || `Scheme ${cleanCode}`;
    const series = {
      schemeCode: cleanCode,
      schemeName,
      fundHouse: meta.fund_house || "Indian Mutual Fund",
      category: normalizeCategoryLabel(meta.scheme_category || "", schemeName),
      planType: detectPlanType(schemeName),
      optionType: detectOptionType(schemeName),
      points
    };
    schemeCache.set(cleanCode, { expiresAt: Date.now() + 6 * 60 * 60 * 1e3, data: series });
    return series;
  } catch {
    return null;
  }
}
function getCategoryBenchmarkSpec(category) {
  if (isDebtCategory(category)) return null;
  if (category === "Large Cap" || category === "Index / ETF") {
    return {
      cacheKey: "TRI_NIFTY50",
      amfiSchemeCode: "120716",
      terAddBackPct: 0.18,
      name: "NIFTY 50 TRI"
    };
  }
  if (category === "Mid Cap") {
    return {
      cacheKey: "TRI_MIDCAP150",
      amfiSchemeCode: "147622",
      terAddBackPct: 0.3,
      name: "NIFTY Midcap 150 TRI"
    };
  }
  if (category === "Small Cap") {
    return {
      cacheKey: "TRI_SMALLCAP250",
      amfiSchemeCode: "147623",
      terAddBackPct: 0.36,
      name: "NIFTY Smallcap 250 TRI"
    };
  }
  return {
    cacheKey: "TRI_NIFTY500",
    amfiSchemeCode: "147625",
    terAddBackPct: 0.33,
    name: category === "Hybrid / Balanced" ? "NIFTY 500 TRI (Equity Benchmark)" : "NIFTY 500 TRI"
  };
}
async function fetchYahooNiftyTriFallback() {
  const cached = benchmarkCache.get("TRI_YAHOO_NSEI");
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent("^NSEI")}?range=5y&interval=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Stoxify/1.0)",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(9e3)
    });
    if (!res.ok) throw new Error("Yahoo benchmark unavailable");
    const json = await res.json();
    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const rawPts = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const c = closes[i];
      if (typeof c !== "number" || !Number.isFinite(c) || c <= 0) continue;
      const iso = new Date(timestamps[i] * 1e3).toISOString().slice(0, 10);
      rawPts.push({
        date: iso,
        timestamp: Date.parse(`${iso}T00:00:00Z`),
        close: c
      });
    }
    const startTs = rawPts[0]?.timestamp ?? Date.now();
    const points = rawPts.map((pt) => {
      const years = Math.max(0, (pt.timestamp - startTs) / (365.25 * 86400 * 1e3));
      const triAdjusted = pt.close * Math.pow(1.0135, years);
      return {
        date: pt.date,
        timestamp: pt.timestamp,
        close: Number(triAdjusted.toFixed(2))
      };
    });
    const out = {
      symbol: "^NSEI_TRI",
      name: "NIFTY 50 TRI (Div. Adjusted)",
      points
    };
    benchmarkCache.set("TRI_YAHOO_NSEI", { expiresAt: Date.now() + 3 * 60 * 60 * 1e3, data: out });
    return out;
  } catch {
    return { symbol: "^NSEI_TRI", name: "NIFTY 50 TRI (Unavailable)", points: [] };
  }
}
async function fetchBenchmarkSeries(category) {
  const spec = getCategoryBenchmarkSpec(category);
  if (!spec) {
    return {
      symbol: "BOND_68",
      name: "CRISIL Short Term / 6.8% TRI Proxy",
      points: []
    };
  }
  const cached = benchmarkCache.get(spec.cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, name: spec.name };
  }
  const indexSeries = await fetchMfSchemeSeries(spec.amfiSchemeCode);
  if (indexSeries && indexSeries.points.length >= 60) {
    const startTs = indexSeries.points[0].timestamp;
    const annualAddBack = spec.terAddBackPct / 100;
    const points = indexSeries.points.map((pt) => {
      const years = Math.max(0, (pt.timestamp - startTs) / (365.25 * 86400 * 1e3));
      const grossTriVal = pt.nav * Math.pow(1 + annualAddBack, years);
      return {
        date: pt.date,
        timestamp: pt.timestamp,
        close: Number(grossTriVal.toFixed(4))
      };
    });
    const out = {
      symbol: spec.cacheKey,
      name: spec.name,
      points
    };
    benchmarkCache.set(spec.cacheKey, {
      expiresAt: Date.now() + 6 * 60 * 60 * 1e3,
      data: out
    });
    return out;
  }
  return fetchYahooNiftyTriFallback();
}
function findPointAtOrBefore(points, targetTs) {
  if (points.length === 0) return null;
  let lo = 0;
  let hi = points.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = lo + hi >> 1;
    if (points[mid].timestamp <= targetTs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best < 0) return null;
  if (targetTs - points[best].timestamp > 25 * 86400 * 1e3) return null;
  const pt = points[best];
  return pt.nav ?? pt.close ?? null;
}
function computeCagr(points, years) {
  if (points.length < 30) return null;
  const last = points[points.length - 1];
  const latestVal = last.nav ?? last.close ?? 0;
  if (latestVal <= 0) return null;
  const targetTs = last.timestamp - years * 365.25 * 86400 * 1e3;
  const pastVal = findPointAtOrBefore(points, targetTs);
  if (!pastVal || pastVal <= 0) return null;
  const cagr = (Math.pow(latestVal / pastVal, 1 / years) - 1) * 100;
  return Number(cagr.toFixed(2));
}
function computeRiskMetrics(fundPoints, benchmarkPoints, isDebt) {
  if (fundPoints.length < 60) {
    return {
      alpha3Y: null,
      beta: null,
      sharpeRatio: null,
      maxDrawdown: null,
      downsideCapture: null,
      rollingBeatRate: null,
      benchReturn1Y: null,
      benchReturn3Y: null,
      benchReturn5Y: null
    };
  }
  const latestTs = fundPoints[fundPoints.length - 1].timestamp;
  const threeYearsAgo = latestTs - 3 * 365.25 * 86400 * 1e3;
  const windowPoints = fundPoints.filter((p) => p.timestamp >= threeYearsAgo);
  const series = windowPoints.length >= 60 ? windowPoints : fundPoints;
  const dailyReturns = [];
  let peak = series[0].nav;
  let maxDd = 0;
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1].nav;
    const curr = series[i].nav;
    if (curr > peak) peak = curr;
    const dd = (curr - peak) / peak * 100;
    if (dd < maxDd) maxDd = dd;
    if (prev > 0) dailyReturns.push((curr - prev) / prev);
  }
  const meanDaily = dailyReturns.length > 0 ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length : 0;
  const varianceDaily = dailyReturns.length > 1 ? dailyReturns.reduce((s, r) => s + (r - meanDaily) ** 2, 0) / (dailyReturns.length - 1) : 0;
  const annVol = Math.sqrt(varianceDaily) * Math.sqrt(252);
  const annReturn = meanDaily * 252;
  const sharpeRatio = annVol > 5e-3 ? Number(((annReturn - RISK_FREE_ANNUAL_RATE) / annVol).toFixed(2)) : null;
  const maxDrawdown = Number(maxDd.toFixed(2));
  if (isDebt || benchmarkPoints.length < 60) {
    const r3 = computeCagr(fundPoints, 3);
    const r1 = computeCagr(fundPoints, 1);
    const alpha = r3 !== null ? Number((r3 - 6.8).toFixed(2)) : null;
    return {
      alpha3Y: alpha,
      beta: isDebt ? 0.12 : null,
      sharpeRatio,
      maxDrawdown,
      downsideCapture: isDebt ? 18 : null,
      rollingBeatRate: r1 !== null ? r1 >= 6.8 ? 78 : 42 : null,
      benchReturn1Y: isDebt ? 6.8 : null,
      benchReturn3Y: isDebt ? 6.8 : null,
      benchReturn5Y: isDebt ? 6.8 : null
    };
  }
  const benchReturn1Y = computeCagr(benchmarkPoints, 1);
  const benchReturn3Y = computeCagr(benchmarkPoints, 3);
  const benchReturn5Y = computeCagr(benchmarkPoints, 5);
  const benchMap = /* @__PURE__ */ new Map();
  for (const b of benchmarkPoints) {
    benchMap.set(b.date.slice(0, 7), b.close);
  }
  const fundMonthMap = /* @__PURE__ */ new Map();
  for (const f of fundPoints) {
    fundMonthMap.set(f.date.slice(0, 7), f.nav);
  }
  const commonMonths = Array.from(fundMonthMap.keys()).filter((ym) => benchMap.has(ym)).sort();
  const recentMonths = commonMonths.slice(-37);
  const fundMonthly = [];
  const benchMonthly = [];
  for (let i = 1; i < recentMonths.length; i += 1) {
    const fPrev = fundMonthMap.get(recentMonths[i - 1]);
    const fCurr = fundMonthMap.get(recentMonths[i]);
    const bPrev = benchMap.get(recentMonths[i - 1]);
    const bCurr = benchMap.get(recentMonths[i]);
    if (fPrev > 0 && bPrev > 0) {
      fundMonthly.push((fCurr - fPrev) / fPrev);
      benchMonthly.push((bCurr - bPrev) / bPrev);
    }
  }
  let beta = null;
  let downsideCapture = null;
  if (fundMonthly.length >= 12) {
    const meanF = fundMonthly.reduce((a, b) => a + b, 0) / fundMonthly.length;
    const meanB = benchMonthly.reduce((a, b) => a + b, 0) / benchMonthly.length;
    let cov = 0;
    let varB = 0;
    for (let i = 0; i < fundMonthly.length; i += 1) {
      cov += (fundMonthly[i] - meanF) * (benchMonthly[i] - meanB);
      varB += (benchMonthly[i] - meanB) ** 2;
    }
    beta = varB > 0 ? Number(Math.max(0.2, Math.min(1.8, cov / varB)).toFixed(2)) : 1;
    let downFundSum = 0;
    let downBenchSum = 0;
    let downCount = 0;
    for (let i = 0; i < benchMonthly.length; i += 1) {
      if (benchMonthly[i] < 0) {
        downFundSum += fundMonthly[i];
        downBenchSum += benchMonthly[i];
        downCount += 1;
      }
    }
    if (downCount >= 3 && downBenchSum < 0) {
      downsideCapture = Number((downFundSum / downBenchSum * 100).toFixed(1));
    }
  }
  let beatWins = 0;
  let beatTotal = 0;
  for (let i = 12; i < recentMonths.length; i += 1) {
    const fStart = fundMonthMap.get(recentMonths[i - 12]);
    const fEnd = fundMonthMap.get(recentMonths[i]);
    const bStart = benchMap.get(recentMonths[i - 12]);
    const bEnd = benchMap.get(recentMonths[i]);
    if (fStart > 0 && bStart > 0) {
      const f1y = fEnd / fStart - 1;
      const b1y = bEnd / bStart - 1;
      if (f1y >= b1y) beatWins += 1;
      beatTotal += 1;
    }
  }
  const rollingBeatRate = beatTotal >= 4 ? Math.round(beatWins / beatTotal * 100) : null;
  const fund3Y = computeCagr(fundPoints, 3);
  let alpha3Y = null;
  if (fund3Y !== null && benchReturn3Y !== null) {
    const effectiveBeta = beta ?? 1;
    const expected = RISK_FREE_ANNUAL_RATE * 100 + effectiveBeta * (benchReturn3Y - RISK_FREE_ANNUAL_RATE * 100);
    alpha3Y = Number((fund3Y - expected).toFixed(2));
  }
  return {
    alpha3Y,
    beta,
    sharpeRatio,
    maxDrawdown,
    downsideCapture,
    rollingBeatRate,
    benchReturn1Y,
    benchReturn3Y,
    benchReturn5Y
  };
}
function computeReportCardScores(params) {
  let consistency = 58;
  if (params.rollingBeatRate !== null) {
    consistency = Math.round(params.rollingBeatRate * 0.65 + (params.alpha3Y !== null ? Math.max(0, Math.min(35, 18 + params.alpha3Y * 2.5)) : 18));
  } else if (params.return1Y !== null && params.benchmarkReturn1Y !== null) {
    consistency = Math.round(55 + (params.return1Y - params.benchmarkReturn1Y) * 2.5);
  }
  consistency = Math.max(18, Math.min(98, consistency));
  let downside = 64;
  if (params.downsideCapture !== null) {
    downside = Math.round(135 - params.downsideCapture * 0.72);
  } else if (params.sharpeRatio !== null) {
    downside = Math.round(50 + params.sharpeRatio * 22);
  }
  downside = Math.max(20, Math.min(97, downside));
  let composite = consistency * 0.55 + downside * 0.45;
  if (params.sharpeRatio !== null && params.sharpeRatio >= 1.1) composite += 6;
  if (params.alpha3Y !== null && params.alpha3Y < -2.5) composite -= 10;
  if (params.planType === "Regular") composite -= 5;
  if (params.isDebt && params.alpha3Y !== null && params.alpha3Y >= 0) composite = Math.max(composite, 78);
  let grade = "B";
  if (composite >= 82) grade = "A+";
  else if (composite >= 70) grade = "A";
  else if (composite >= 56) grade = "B";
  else if (composite >= 42) grade = "C";
  else grade = "D";
  return {
    consistencyScore: consistency,
    downsideProtectionScore: downside,
    grade
  };
}
function buildNavChartSeries(fundPoints, benchPoints) {
  if (fundPoints.length === 0) return [];
  const latestTs = fundPoints[fundPoints.length - 1].timestamp;
  const fiveYearsAgo = latestTs - 5 * 365.25 * 86400 * 1e3;
  const filtered = fundPoints.filter((p) => p.timestamp >= fiveYearsAgo);
  const step = Math.max(1, Math.floor(filtered.length / 85));
  const sampled = [];
  for (let i = 0; i < filtered.length; i += step) {
    sampled.push(filtered[i]);
  }
  const last = filtered[filtered.length - 1];
  if (sampled[sampled.length - 1]?.date !== last.date) {
    sampled.push(last);
  }
  const baseFund = sampled[0].nav;
  const baseBench = findPointAtOrBefore(benchPoints, sampled[0].timestamp);
  return sampled.map((pt) => {
    const benchVal = baseBench ? findPointAtOrBefore(benchPoints, pt.timestamp) : null;
    return {
      date: pt.date,
      nav: Number(pt.nav.toFixed(2)),
      indexedFund: baseFund > 0 ? Number((pt.nav / baseFund * 100).toFixed(2)) : void 0,
      indexedBenchmark: baseBench && benchVal && baseBench > 0 ? Number((benchVal / baseBench * 100).toFixed(2)) : void 0
    };
  });
}
async function findDirectTwinScheme(series) {
  if (series.planType === "Direct") return null;
  const cleanedStem = series.schemeName.replace(/\bregular\b/gi, "").replace(/\bplan\b/gi, "").replace(/\bgrowth\b/gi, "").replace(/\boption\b/gi, "").replace(/\([^)]*\)/g, " ").replace(/\s*-\s*/g, " ").replace(/\s+/g, " ").trim();
  const queries = [
    `${cleanedStem} Direct Growth`,
    cleanedStem.split(" ").slice(0, 4).join(" ")
  ];
  for (const q of queries) {
    const matches = await searchMutualFunds(q);
    const directMatch = matches.find(
      (m) => m.planType === "Direct" && m.optionType === "Growth" && m.schemeCode !== series.schemeCode && m.schemeName.toLowerCase().includes(cleanedStem.split(" ")[0].toLowerCase())
    );
    if (directMatch) {
      const directSeries = await fetchMfSchemeSeries(directMatch.schemeCode);
      if (directSeries) return directSeries;
    }
  }
  return null;
}
function estimatePortfolioXirr(funds) {
  const totalInv = funds.reduce((s, f) => s + f.investedValue, 0);
  const totalCur = funds.reduce((s, f) => s + f.currentValue, 0);
  if (totalInv <= 0 || totalCur <= 0) return null;
  const now = Date.now();
  let weightedDays = 0;
  for (const f of funds) {
    const ts = Date.parse(f.purchaseDate || "");
    const days = Number.isFinite(ts) ? Math.max(45, (now - ts) / 864e5) : 365;
    weightedDays += days * f.investedValue;
  }
  const avgYears = Math.max(0.25, weightedDays / totalInv / 365.25);
  const xirr = (Math.pow(totalCur / totalInv, 1 / avgYears) - 1) * 100;
  return Number(Math.max(-95, Math.min(250, xirr)).toFixed(2));
}
function buildFifoLots(holding, schemePoints, latestNav) {
  const nowMs = Date.now();
  const parsedStart = Date.parse(holding.purchaseDate || "");
  const fallbackStart = new Date(nowMs - 400 * 864e5);
  const startDate = Number.isFinite(parsedStart) ? new Date(parsedStart) : fallbackStart;
  const isSipActive = Boolean(holding.isSip && (holding.monthlySipAmount ?? 0) > 0);
  const totalCost = holding.units * holding.avgNav;
  if (!isSipActive) {
    const holdingDays = Math.max(1, Math.floor((nowMs - startDate.getTime()) / 864e5));
    const dateStr = startDate.toISOString().slice(0, 10);
    return {
      isSipReconstructed: false,
      lots: [
        {
          date: dateStr,
          units: holding.units,
          costBasis: totalCost,
          currentVal: holding.units * latestNav,
          holdingDays
        }
      ]
    };
  }
  const monthlyDates = [];
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const todayCutoff = new Date(nowMs);
  while (cursor <= todayCutoff && monthlyDates.length < 120) {
    monthlyDates.push(new Date(cursor.getTime()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  if (monthlyDates.length <= 1) {
    const holdingDays = Math.max(1, Math.floor((nowMs - startDate.getTime()) / 864e5));
    return {
      isSipReconstructed: false,
      lots: [
        {
          date: startDate.toISOString().slice(0, 10),
          units: holding.units,
          costBasis: totalCost,
          currentVal: holding.units * latestNav,
          holdingDays
        }
      ]
    };
  }
  const sipAmt = Number(holding.monthlySipAmount) || 5e3;
  const rawLots = monthlyDates.map((d) => {
    const ts = d.getTime();
    const navAtLot = findPointAtOrBefore(schemePoints, ts) || holding.avgNav || latestNav;
    const rawUnits = navAtLot > 0 ? sipAmt / navAtLot : 0;
    return {
      date: d.toISOString().slice(0, 10),
      holdingDays: Math.max(1, Math.floor((nowMs - ts) / 864e5)),
      rawUnits
    };
  });
  const sumRawUnits = rawLots.reduce((s, l) => s + l.rawUnits, 0);
  const scaleFactor = sumRawUnits > 0 ? holding.units / sumRawUnits : 1;
  const lots = rawLots.map((l) => {
    const scaledUnits = Number((l.rawUnits * scaleFactor).toFixed(4));
    const unitShare = holding.units > 0 ? scaledUnits / holding.units : 1 / rawLots.length;
    return {
      date: l.date,
      units: scaledUnits,
      costBasis: totalCost * unitShare,
      currentVal: scaledUnits * latestNav,
      holdingDays: l.holdingDays
    };
  });
  return { lots, isSipReconstructed: true };
}
async function analyzeMutualFundPortfolio(params) {
  const { holdings, taxSlabPct = 30, ltcgExemptionRemaining = 125e3 } = params;
  if (holdings.length === 0) {
    return {
      funds: [],
      summary: {
        totalInvested: 0,
        totalCurrent: 0,
        totalGain: 0,
        totalGainPercent: 0,
        estXirr: null,
        totalAnnualFeeDrag: 0,
        regularCommissionLeak: 0,
        tenYearCommissionLeak: 0,
        switchCount: 0,
        regularPlanCount: 0,
        underperformerCount: 0
      },
      analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const schemeResults = await Promise.all(
    holdings.map(async (h) => ({
      holding: h,
      series: await fetchMfSchemeSeries(h.schemeCode)
    }))
  );
  const uniqueCategories = Array.from(
    new Set(schemeResults.map((r) => r.series?.category || r.holding.category || "Flexi Cap"))
  );
  const benchmarkEntries = await Promise.all(
    uniqueCategories.map(async (cat) => [cat, await fetchBenchmarkSeries(cat)])
  );
  const benchmarkByCategory = new Map(benchmarkEntries);
  let remainingLtcgPool = Math.max(0, ltcgExemptionRemaining);
  const analyzedFunds = [];
  for (const { holding, series } of schemeResults) {
    const points = series?.points ?? [];
    const latestNav = points.length > 0 ? points[points.length - 1].nav : holding.avgNav;
    const previousNav = points.length > 1 ? points[points.length - 2].nav : latestNav;
    const navDate = points.length > 0 ? points[points.length - 1].date : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const dayChangePercent = previousNav > 0 ? Number(((latestNav - previousNav) / previousNav * 100).toFixed(2)) : 0;
    const category = series?.category || holding.category || "Flexi Cap";
    const planType = series?.planType || holding.planType;
    const isDebt = isDebtCategory(category);
    const benchmark = benchmarkByCategory.get(category) ?? (isDebt ? { symbol: "BOND_68", name: "CRISIL Short Term / 6.8% TRI Proxy", points: [] } : await fetchBenchmarkSeries("Flexi Cap"));
    const costProfile = resolveSchemeCostProfile({
      schemeCode: holding.schemeCode,
      schemeName: series?.schemeName || holding.schemeName,
      category,
      planType
    });
    const investedValue = Number((holding.units * holding.avgNav).toFixed(2));
    const currentValue = Number((holding.units * latestNav).toFixed(2));
    const unrealizedGain = Number((currentValue - investedValue).toFixed(2));
    const unrealizedGainPercent = investedValue > 0 ? Number((unrealizedGain / investedValue * 100).toFixed(2)) : 0;
    const estExpenseRatio = costProfile.terPct;
    const annualFeeDrag = Number((currentValue * estExpenseRatio / 100).toFixed(2));
    const return1Y = computeCagr(points, 1);
    const return3Y = computeCagr(points, 3);
    const return5Y = computeCagr(points, 5);
    const risk = computeRiskMetrics(points, benchmark.points, isDebt);
    const score = computeReportCardScores({
      alpha3Y: risk.alpha3Y,
      sharpeRatio: risk.sharpeRatio,
      downsideCapture: risk.downsideCapture,
      rollingBeatRate: risk.rollingBeatRate,
      return1Y,
      benchmarkReturn1Y: risk.benchReturn1Y,
      planType,
      isDebt
    });
    let action = "HOLD";
    let targetSeries = null;
    let targetReturn1Y = null;
    let targetReturn3Y = null;
    let targetExpenseRatio = null;
    let targetGrade = null;
    const directTwin = planType === "Regular" && series ? await findDirectTwinScheme(series) : null;
    const peerList = CATEGORY_PEERS[category] || CATEGORY_PEERS["Flexi Cap"];
    const bestPeerCandidate = peerList.find((p) => p.schemeCode !== holding.schemeCode);
    const peerSeries = bestPeerCandidate ? await fetchMfSchemeSeries(bestPeerCandidate.schemeCode) : null;
    const peer3Y = peerSeries ? computeCagr(peerSeries.points, 3) : null;
    const peer1Y = peerSeries ? computeCagr(peerSeries.points, 1) : null;
    const isLagging = return3Y !== null && risk.benchReturn3Y !== null && !isDebt && return3Y < risk.benchReturn3Y - 1.75 || return3Y !== null && peer3Y !== null && peer3Y - return3Y >= 2.2 || score.grade === "C" || score.grade === "D";
    if (isLagging && peerSeries) {
      action = "SWITCH_PEER";
      targetSeries = peerSeries;
      targetReturn1Y = peer1Y;
      targetReturn3Y = peer3Y;
      targetExpenseRatio = resolveSchemeCostProfile({
        schemeCode: peerSeries.schemeCode,
        schemeName: peerSeries.schemeName,
        category: peerSeries.category,
        planType: "Direct"
      }).terPct;
      targetGrade = "A+";
    } else if (planType === "Regular") {
      action = "SWITCH_TO_DIRECT";
      if (directTwin) {
        targetSeries = directTwin;
        targetReturn1Y = computeCagr(directTwin.points, 1);
        targetReturn3Y = computeCagr(directTwin.points, 3);
        targetExpenseRatio = resolveSchemeCostProfile({
          schemeCode: directTwin.schemeCode,
          schemeName: directTwin.schemeName,
          category: directTwin.category,
          planType: "Direct"
        }).terPct;
        targetGrade = score.grade === "B" ? "A" : "A+";
      } else {
        targetExpenseRatio = resolveSchemeCostProfile({
          schemeCode: holding.schemeCode,
          schemeName: series?.schemeName || holding.schemeName,
          category,
          planType: "Direct"
        }).terPct;
        targetReturn1Y = return1Y !== null ? Number((return1Y + (estExpenseRatio - targetExpenseRatio)).toFixed(2)) : null;
        targetReturn3Y = return3Y !== null ? Number((return3Y + (estExpenseRatio - targetExpenseRatio)).toFixed(2)) : null;
        targetGrade = score.grade === "B" ? "A" : "A+";
      }
    }
    const { lots, isSipReconstructed } = buildFifoLots(holding, points, latestNav);
    const oldestHoldingDays = lots[0]?.holdingDays ?? 400;
    const newestHoldingDays = lots[lots.length - 1]?.holdingDays ?? oldestHoldingDays;
    let totalExitLoad = 0;
    let totalTax = 0;
    let exitLoadFreeUnits = 0;
    let exitLoadFreeValue = 0;
    let ltcgEligibleUnits = 0;
    let ltcgEligibleValue = 0;
    let stcgUnits = 0;
    let stcgValue = 0;
    let exitLoadTaxedUnits = 0;
    let exitLoadTaxedValue = 0;
    for (const lot of lots) {
      const lotExitLoadPct = evaluateTieredExitLoadPct(costProfile.exitLoadTiers, lot.holdingDays);
      const isElssLocked = costProfile.isElssLockIn && lot.holdingDays < 1095;
      const lotHasExitRestriction = lotExitLoadPct > 0 || isElssLocked;
      if (lotHasExitRestriction) {
        exitLoadTaxedUnits += lot.units;
        exitLoadTaxedValue += lot.currentVal;
      } else {
        exitLoadFreeUnits += lot.units;
        exitLoadFreeValue += lot.currentVal;
      }
      if (action !== "HOLD") {
        totalExitLoad += lot.currentVal * lotExitLoadPct / 100;
      }
      const lotGain = lot.currentVal - lot.costBasis;
      if (isDebt) {
        if (lotGain > 0 && action !== "HOLD") {
          totalTax += lotGain * taxSlabPct / 100;
        }
        stcgUnits += lot.units;
        stcgValue += lot.currentVal;
      } else if (lot.holdingDays > 365) {
        ltcgEligibleUnits += lot.units;
        ltcgEligibleValue += lot.currentVal;
        if (lotGain > 0 && action !== "HOLD") {
          const taxableGain = Math.max(0, lotGain - remainingLtcgPool);
          remainingLtcgPool = Math.max(0, remainingLtcgPool - lotGain);
          totalTax += taxableGain * 0.125;
        }
      } else {
        stcgUnits += lot.units;
        stcgValue += lot.currentVal;
        if (lotGain > 0 && action !== "HOLD") {
          totalTax += lotGain * 0.2;
        }
      }
    }
    const estimatedExitLoad = Number(totalExitLoad.toFixed(2));
    const estimatedTax = Number(totalTax.toFixed(2));
    const effectiveExitLoadPct = currentValue > 0 && estimatedExitLoad > 0 ? Number((estimatedExitLoad / currentValue * 100).toFixed(2)) : 0;
    const exitLoadWindowDays = costProfile.exitLoadWindowDays;
    const daysUntilExitLoadFree = exitLoadWindowDays > 0 ? Math.max(0, exitLoadWindowDays - newestHoldingDays) : 0;
    let taxType = "NO_GAIN";
    if (action !== "HOLD" && unrealizedGain > 0) {
      if (isDebt) taxType = "SLAB";
      else if (ltcgEligibleUnits > 0 && stcgUnits > 0) taxType = "STCG";
      else if (ltcgEligibleUnits > 0) taxType = "LTCG";
      else taxType = "STCG";
    }
    const fifoBreakdown = {
      lotCount: lots.length,
      isSipReconstructed,
      exitLoadFreeUnits: Number(exitLoadFreeUnits.toFixed(2)),
      exitLoadFreeValue: Number(exitLoadFreeValue.toFixed(0)),
      ltcgEligibleUnits: Number(ltcgEligibleUnits.toFixed(2)),
      ltcgEligibleValue: Number(ltcgEligibleValue.toFixed(0)),
      stcgUnits: Number(stcgUnits.toFixed(2)),
      stcgValue: Number(stcgValue.toFixed(0)),
      exitLoadTaxedUnits: Number(exitLoadTaxedUnits.toFixed(2)),
      exitLoadTaxedValue: Number(exitLoadTaxedValue.toFixed(0)),
      oldestLotDate: lots[0]?.date || holding.purchaseDate,
      newestLotDate: lots[lots.length - 1]?.date || holding.purchaseDate
    };
    const effectiveTargetTer = targetExpenseRatio ?? estExpenseRatio;
    const terSavedPct = Math.max(0, estExpenseRatio - effectiveTargetTer);
    const annualCommissionSaved = action === "HOLD" ? 0 : Number((currentValue * terSavedPct / 100).toFixed(2));
    const rawPerformanceGap = action === "SWITCH_PEER" && targetReturn3Y !== null && return3Y !== null ? Math.max(0, Math.min(4, (targetReturn3Y - return3Y) * 0.6)) : 0;
    const totalAnnualBenefitPct = terSavedPct + rawPerformanceGap;
    const annualBenefitRupees = currentValue * totalAnnualBenefitPct / 100;
    const baseCompounded = currentValue * Math.pow(1.12, 10);
    const targetCompounded = currentValue * Math.pow(1.12 + totalAnnualBenefitPct / 100, 10);
    const tenYearProjectedExtraWealth = action === "HOLD" ? 0 : Number(Math.max(0, targetCompounded - baseCompounded).toFixed(0));
    const totalFriction = estimatedExitLoad + estimatedTax;
    const netFirstYearBenefit = Number((annualBenefitRupees - totalFriction).toFixed(2));
    const breakEvenMonths = annualBenefitRupees > 0 && totalFriction > 0 ? Math.min(120, Math.ceil(totalFriction / annualBenefitRupees * 12)) : totalFriction === 0 && action !== "HOLD" ? 1 : null;
    let timingVerdict = "HOLD_STEADY";
    if (action !== "HOLD") {
      if (costProfile.isElssLockIn && exitLoadFreeValue < currentValue * 0.1) {
        timingVerdict = "WAIT_EXIT_LOAD";
      } else if (exitLoadTaxedValue > currentValue * 0.65 && daysUntilExitLoadFree > 0 && daysUntilExitLoadFree <= 180) {
        timingVerdict = "WAIT_EXIT_LOAD";
      } else if (stcgValue > ltcgEligibleValue && !isDebt && action === "SWITCH_TO_DIRECT") {
        timingVerdict = "STAGGER_FOR_LTCG";
      } else {
        timingVerdict = "SWITCH_NOW";
      }
    }
    const fifoLotNote = isSipReconstructed && lots.length > 1 ? ` FIFO (${lots.length} monthly SIP lots): ${formatSimpleInr(exitLoadFreeValue)} is 0% exit-load eligible now${exitLoadTaxedValue > 0 ? ` and ${formatSimpleInr(exitLoadTaxedValue)} remains within exit-load/lock-in window` : ""}.` : "";
    let rationale = `Outperforming ${benchmark.name} with strong risk-adjusted consistency.`;
    if (action === "SWITCH_TO_DIRECT") {
      rationale = `Regular plan TER (${estExpenseRatio.toFixed(2)}%, ${costProfile.terSource}) vs Direct Growth (${effectiveTargetTer.toFixed(2)}%) drains ${formatSimpleInr(annualCommissionSaved)}/yr.${fifoLotNote}${timingVerdict === "WAIT_EXIT_LOAD" ? ` Wait for ${costProfile.exitLoadRuleLabel} expiry (pause Regular SIP now and start Direct SIP immediately).` : timingVerdict === "STAGGER_FOR_LTCG" ? ` Switch the LTCG-eligible portion now and stagger remaining STCG lots as they cross 365 days.` : " Execute Direct switch now to stop ongoing distributor commission drag."}`;
    } else if (action === "SWITCH_PEER") {
      const peerName = targetSeries?.schemeName || bestPeerCandidate?.label || "category leader";
      rationale = `Trailing ${benchmark.name} / peer (${return3Y !== null ? `${return3Y}%` : "N/A"} 3Y CAGR vs ${targetReturn3Y !== null ? `${targetReturn3Y}%` : "peer"} in ${peerName}).${planType === "Regular" ? " Also incurs Regular plan distributor fees." : ""}${fifoLotNote}${costProfile.isElssLockIn && exitLoadFreeValue < currentValue ? ` Switch only unlocked ELSS units (>3Y) first; stop fresh ELSS SIPs into this scheme.` : ""}`;
    }
    const targetName = action === "SWITCH_TO_DIRECT" ? targetSeries?.schemeName || holding.schemeName.replace(/Regular/gi, "Direct") : action === "SWITCH_PEER" ? targetSeries?.schemeName || bestPeerCandidate?.label || null : null;
    const switchSuggestion = {
      action,
      timingVerdict,
      targetSchemeCode: action === "HOLD" ? null : targetSeries?.schemeCode || (action === "SWITCH_PEER" ? bestPeerCandidate?.schemeCode || null : null),
      targetSchemeName: targetName,
      targetCategory: action === "HOLD" ? null : targetSeries?.category || category,
      targetExpenseRatio: action === "HOLD" ? null : targetExpenseRatio,
      targetReturn1Y,
      targetReturn3Y,
      targetGrade,
      annualCommissionSaved,
      tenYearProjectedExtraWealth,
      holdingDays: oldestHoldingDays,
      exitLoadWindowDays,
      exitLoadRatePct: effectiveExitLoadPct,
      exitLoadRuleLabel: costProfile.exitLoadRuleLabel,
      daysUntilExitLoadFree,
      estimatedExitLoad,
      taxCategory: isDebt ? "DEBT" : "EQUITY",
      taxType,
      estimatedTax,
      netFirstYearBenefit,
      breakEvenMonths,
      fifoBreakdown,
      rationale
    };
    analyzedFunds.push({
      holding: {
        ...holding,
        schemeName: series?.schemeName || holding.schemeName,
        fundHouse: series?.fundHouse || holding.fundHouse,
        category,
        planType
      },
      latestNav,
      previousNav,
      navDate,
      dayChangePercent,
      investedValue,
      currentValue,
      unrealizedGain,
      unrealizedGainPercent,
      estExpenseRatio,
      terSource: costProfile.terSource,
      annualFeeDrag,
      benchmarkName: benchmark.name,
      return1Y,
      return3Y,
      return5Y,
      benchmarkReturn1Y: risk.benchReturn1Y,
      benchmarkReturn3Y: risk.benchReturn3Y,
      benchmarkReturn5Y: risk.benchReturn5Y,
      alpha3Y: risk.alpha3Y,
      beta: risk.beta,
      sharpeRatio: risk.sharpeRatio,
      maxDrawdown: risk.maxDrawdown,
      downsideCapture: risk.downsideCapture,
      rollingBeatRate: risk.rollingBeatRate,
      consistencyScore: score.consistencyScore,
      downsideProtectionScore: score.downsideProtectionScore,
      reportCardGrade: score.grade,
      navHistory: buildNavChartSeries(points, benchmark.points),
      switchSuggestion
    });
  }
  const totalInvested = Number(
    analyzedFunds.reduce((s, f) => s + f.investedValue, 0).toFixed(2)
  );
  const totalCurrent = Number(
    analyzedFunds.reduce((s, f) => s + f.currentValue, 0).toFixed(2)
  );
  const totalGain = Number((totalCurrent - totalInvested).toFixed(2));
  const totalGainPercent = totalInvested > 0 ? Number((totalGain / totalInvested * 100).toFixed(2)) : 0;
  const totalAnnualFeeDrag = Number(
    analyzedFunds.reduce((s, f) => s + f.annualFeeDrag, 0).toFixed(2)
  );
  const regularCommissionLeak = Number(
    analyzedFunds.filter((f) => f.holding.planType === "Regular").reduce((s, f) => s + f.switchSuggestion.annualCommissionSaved, 0).toFixed(2)
  );
  const tenYearCommissionLeak = Number(
    analyzedFunds.reduce((s, f) => s + f.switchSuggestion.tenYearProjectedExtraWealth, 0).toFixed(0)
  );
  const summary = {
    totalInvested,
    totalCurrent,
    totalGain,
    totalGainPercent,
    estXirr: estimatePortfolioXirr(
      analyzedFunds.map((f) => ({
        investedValue: f.investedValue,
        currentValue: f.currentValue,
        purchaseDate: f.holding.purchaseDate
      }))
    ),
    totalAnnualFeeDrag,
    regularCommissionLeak,
    tenYearCommissionLeak,
    switchCount: analyzedFunds.filter((f) => f.switchSuggestion.action !== "HOLD").length,
    regularPlanCount: analyzedFunds.filter((f) => f.holding.planType === "Regular").length,
    underperformerCount: analyzedFunds.filter(
      (f) => f.switchSuggestion.action === "SWITCH_PEER"
    ).length
  };
  return {
    funds: analyzedFunds,
    summary,
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function formatSimpleInr(val) {
  return `\u20B9${Math.round(val).toLocaleString("en-IN")}`;
}

// server/mutualFundAiService.ts
import { GoogleGenAI as GoogleGenAI3, ThinkingLevel as ThinkingLevel3, Type as Type3 } from "@google/genai";
var DIRECT_DEFAULT_BROKERS = /\b(groww|zerodha|coin|kuvera|paytm\s*money|indmoney|mfcentral|mf\s*central)\b/i;
var REGULAR_DEFAULT_BROKERS = /\b(nj\s*wealth|prudent|fundsindia|icici\s*direct|hdfc\s*sec|kotak\s*sec|sharekhan|motilal\s*oswal\s*wealth|distributor|arn-)\b/i;
function createGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI3({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function isQuotaError2(err) {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err || "");
  return /429|RESOURCE_EXHAUSTED|quota|rate[-_\s]?limit|retryDelay/i.test(msg);
}
var MF_IMPORT_PROMPT_RULES = `Rules:
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
var MF_IMPORT_SCHEMA = {
  type: Type3.OBJECT,
  properties: {
    sourceDetected: {
      type: Type3.STRING,
      description: "Detected app or statement format (e.g., Groww, Zerodha Coin, Kuvera, Paytm Money, INDmoney, MFCentral, CAMS CAS PDF)."
    },
    portfolioTotals: {
      type: Type3.OBJECT,
      properties: {
        totalInvested: { type: Type3.NUMBER },
        totalCurrent: { type: Type3.NUMBER }
      }
    },
    warnings: {
      type: Type3.ARRAY,
      items: { type: Type3.STRING }
    },
    holdings: {
      type: Type3.ARRAY,
      items: {
        type: Type3.OBJECT,
        properties: {
          rawSchemeName: { type: Type3.STRING },
          planType: { type: Type3.STRING },
          optionType: { type: Type3.STRING },
          units: { type: Type3.NUMBER },
          avgNav: { type: Type3.NUMBER },
          investedAmount: { type: Type3.NUMBER },
          currentValue: { type: Type3.NUMBER },
          latestNavShown: { type: Type3.NUMBER },
          returnsPercent: { type: Type3.NUMBER },
          purchaseDate: { type: Type3.STRING },
          isSip: { type: Type3.BOOLEAN },
          monthlySipAmount: { type: Type3.NUMBER },
          folioNumber: { type: Type3.STRING },
          confidence: { type: Type3.STRING },
          notes: { type: Type3.STRING }
        },
        required: ["rawSchemeName", "planType", "confidence"]
      }
    }
  },
  required: ["sourceDetected", "holdings"]
};
async function parseImportBatch(ai, files, rawText) {
  const parts = files.map(
    (f) => ({
      inlineData: {
        mimeType: f.mimeType || "image/png",
        data: f.data
      }
    })
  );
  parts.push({
    text: `Extract every Indian Mutual Fund holding and overall portfolio totals from the attached broker portfolio screenshots, CAMS/KFintech CAS PDF statement, or pasted statement text.
${rawText ? `
Pasted CAS/Statement Text:
${rawText.slice(0, 2e4)}
` : ""}
${MF_IMPORT_PROMPT_RULES}`
  });
  const modelCandidates = [
    { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel3.LOW },
    { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel3.MINIMAL }
  ];
  let lastErr = null;
  for (const candidate of modelCandidates) {
    try {
      const response = await ai.models.generateContent({
        model: candidate.model,
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
          responseMimeType: "application/json",
          responseSchema: MF_IMPORT_SCHEMA
        }
      });
      return JSON.parse((response.text ?? "{}").trim());
    } catch (err) {
      lastErr = err;
      if (!isQuotaError2(err)) {
        throw err;
      }
    }
  }
  if (isQuotaError2(lastErr)) {
    throw new Error(
      "Gemini free-tier daily quota (20 req/day) was reached while scanning this screenshot/PDF. Use the Zerodha Coin / Kite CSV upload tab (uses 0 AI quota), or add a billing-enabled Gemini API key in Settings > Secrets."
    );
  }
  throw lastErr instanceof Error ? lastErr : new Error("Unable to parse mutual fund statement.");
}
function normalizeSchemeQueryName(rawName) {
  return rawName.replace(/\([^)]*\)/g, " ").replace(/\b(direct|regular|plan|growth|option|opt|idcw|dividend|payout|reinvestment|dir|reg)\b/gi, " ").replace(/\bPPFAS\b/gi, "Parag Parikh").replace(/\bICICI\s+Pru\b/gi, "ICICI Prudential").replace(/\bABSL\b/gi, "Aditya Birla Sun Life").replace(/\bAxis\s+Bluechip\b/gi, "Axis Large Cap").replace(/\bHDFC\s+Mid[-\s]*Cap\s+Opportunities\b/gi, "HDFC Mid Cap").replace(/\bMirae\s+Asset\s+Emerging\s+Bluechip\b/gi, "Mirae Asset Large & Midcap").replace(/\bKotak\s+Standard\s+Multicap\b/gi, "Kotak Flexi Cap").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}
function scoreTokenSimilarity(targetName, candidateName) {
  const stopWords = /* @__PURE__ */ new Set(["fund", "mutual", "scheme", "plan", "direct", "regular", "growth", "option", "india", "the", "of", "and"]);
  const tokenize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 2 && !stopWords.has(t));
  const targetTokens = new Set(tokenize(targetName));
  const candTokens = new Set(tokenize(candidateName));
  if (targetTokens.size === 0 || candTokens.size === 0) return 0;
  let overlap = 0;
  for (const t of targetTokens) {
    if (candTokens.has(t)) overlap += 1;
  }
  return overlap / Math.max(targetTokens.size, 1);
}
async function resolveAmfiMatch(rawName, preferredPlan, preferredOption, targetNavHint, strictPlan = false) {
  const cleaned = normalizeSchemeQueryName(rawName);
  const words = cleaned.split(" ").filter(Boolean);
  const queries = Array.from(
    new Set(
      [
        cleaned,
        cleaned.replace(/\s*&\s*/g, " and "),
        words.slice(0, 4).join(" "),
        words.slice(0, 3).join(" ")
      ].filter((q) => q.length >= 3)
    )
  );
  const candidateMap = /* @__PURE__ */ new Map();
  for (const q of queries) {
    const results = await searchMutualFunds(q);
    if (results.length === 0) continue;
    const wantsBonus = /\bbonus\b/i.test(rawName);
    for (const r of results) {
      const sim = scoreTokenSimilarity(cleaned, r.schemeName);
      const isBonus = /\bbonus\b/i.test(r.schemeName);
      const hasGrowthWord = /\bgrowth\b/i.test(r.schemeName);
      const optBonus = r.optionType === preferredOption ? preferredOption === "Growth" && isBonus && !wantsBonus ? -0.45 : preferredOption === "Growth" && hasGrowthWord ? 0.45 : 0.3 : -0.45;
      const planBonus = r.planType === preferredPlan ? 0.25 : 0;
      const totalScore = sim + optBonus + planBonus;
      const existing = candidateMap.get(r.schemeCode);
      if (!existing || totalScore > existing.score) {
        candidateMap.set(r.schemeCode, { item: r, score: totalScore });
      }
    }
    const bestSoFar = Math.max(0, ...Array.from(candidateMap.values()).map((c) => c.score));
    if (bestSoFar >= 1.2) break;
  }
  const ranked = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score).map((c) => c.item);
  if (ranked.length > 0) {
    const preferredPool = strictPlan ? ranked.filter((r) => r.planType === preferredPlan) : [];
    const candidatePool = preferredPool.length > 0 ? preferredPool : ranked;
    const topPool = [];
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
        series: await fetchMfSchemeSeries(cand.schemeCode)
      }))
    );
    const validFetched = fetchedCandidates.map(({ cand, series }) => {
      const latestNav = series && series.points.length > 0 ? series.points[series.points.length - 1].nav : null;
      const sim = scoreTokenSimilarity(cleaned, series?.schemeName || cand.schemeName);
      const navDiffPct = targetNavHint && targetNavHint > 0 && latestNav && latestNav > 0 ? Math.abs(latestNav - targetNavHint) / targetNavHint : null;
      return { cand, series, latestNav, sim, navDiffPct };
    }).filter((x) => x.series !== null);
    let chosen = validFetched[0] || null;
    if (targetNavHint && targetNavHint > 0 && validFetched.length > 1) {
      const navMatches = validFetched.filter((x) => x.navDiffPct !== null && x.navDiffPct <= 0.12 && x.sim >= 0.45).sort((a, b) => (a.navDiffPct ?? 999) - (b.navDiffPct ?? 999));
      if (navMatches.length > 0) {
        chosen = navMatches[0];
      }
    }
    if (chosen && chosen.series) {
      return {
        schemeCode: chosen.cand.schemeCode,
        schemeName: chosen.series.schemeName,
        fundHouse: chosen.series.fundHouse || "Indian Mutual Fund",
        category: chosen.series.category || "Flexi Cap",
        planType: chosen.series.planType,
        optionType: chosen.series.optionType,
        latestNav: chosen.latestNav,
        verified: true
      };
    }
    const fallbackCand = ranked[0];
    return {
      schemeCode: fallbackCand.schemeCode,
      schemeName: fallbackCand.schemeName,
      fundHouse: "Indian Mutual Fund",
      category: "Flexi Cap",
      planType: fallbackCand.planType,
      optionType: fallbackCand.optionType,
      latestNav: null,
      verified: false
    };
  }
  return {
    schemeCode: "122639",
    schemeName: rawName.trim() || "Unmatched Mutual Fund Scheme",
    fundHouse: "Indian Mutual Fund",
    category: "Flexi Cap",
    planType: preferredPlan,
    optionType: preferredOption,
    latestNav: null,
    verified: false
  };
}
async function parseMutualFundImport(params) {
  const ai = createGeminiClient();
  const batches = [];
  if (params.files.length > 0) {
    for (let i = 0; i < params.files.length; i += 5) {
      batches.push(params.files.slice(i, i + 5));
    }
  } else {
    batches.push([]);
  }
  const batchResults = await Promise.all(
    batches.map((b, idx) => parseImportBatch(ai, b, idx === 0 ? params.rawText : void 0))
  );
  const sources = Array.from(
    new Set(batchResults.map((r) => r.sourceDetected).filter((s) => Boolean(s)))
  );
  const sourceLabel = sources.join(" / ") || "Mutual Fund Statement / Screenshot";
  const brokerDefaultsDirect = DIRECT_DEFAULT_BROKERS.test(sourceLabel) || DIRECT_DEFAULT_BROKERS.test(params.rawText || "");
  const brokerDefaultsRegular = REGULAR_DEFAULT_BROKERS.test(sourceLabel) || REGULAR_DEFAULT_BROKERS.test(params.rawText || "");
  const warnings = Array.from(
    new Set(batchResults.flatMap((r) => Array.isArray(r.warnings) ? r.warnings : []))
  );
  const rows = batchResults.flatMap((r) => Array.isArray(r.holdings) ? r.holdings : []);
  const resolvedRows = await Promise.all(
    rows.filter(
      (r) => Number(r.units) > 0 || Number(r.investedAmount) > 0 || Number(r.currentValue) > 0
    ).map(async (row, idx) => {
      const hasExplicitRegular = /\b(regular|reg|arn-)\b/i.test(
        `${row.planType || ""} ${row.rawSchemeName || ""}`
      );
      const hasExplicitDirect = /\b(direct|dir)\b/i.test(
        `${row.planType || ""} ${row.rawSchemeName || ""}`
      );
      const prefPlan = hasExplicitRegular ? "Regular" : hasExplicitDirect ? "Direct" : brokerDefaultsRegular ? "Regular" : brokerDefaultsDirect ? "Direct" : "Direct";
      const prefOpt = /idcw|dividend/i.test(
        `${row.optionType || ""} ${row.rawSchemeName || ""}`
      ) ? "IDCW" : "Growth";
      const extUnits = Number(row.units) > 0 ? Number(row.units) : 0;
      const extInvested = Number(row.investedAmount) > 0 ? Number(row.investedAmount) : 0;
      const extCurrent = Number(row.currentValue) > 0 ? Number(row.currentValue) : 0;
      const extLatestNav = Number(row.latestNavShown) > 0 ? Number(row.latestNavShown) : 0;
      const targetNavHint = extLatestNav > 0 ? extLatestNav : extUnits > 0 && extCurrent > 0 ? extCurrent / extUnits : void 0;
      const match = await resolveAmfiMatch(
        row.rawSchemeName,
        prefPlan,
        prefOpt,
        targetNavHint,
        hasExplicitRegular || hasExplicitDirect
      );
      const liveNav = match.latestNav && match.latestNav > 0 ? match.latestNav : 0;
      let units = extUnits;
      let reconciledNote = "";
      if (extCurrent > 0 && liveNav > 0) {
        const impliedCurrent = extUnits > 0 ? extUnits * liveNav : 0;
        const withinTolerance = extUnits > 0 && Math.abs(impliedCurrent - extCurrent) / extCurrent <= 0.05;
        if (!withinTolerance) {
          units = extCurrent / liveNav;
          if (extUnits > 0) {
            reconciledNote = `Reconciled units from screenshot current value \u20B9${extCurrent.toFixed(0)} \xF7 live NAV \u20B9${liveNav.toFixed(2)}.`;
          }
        }
      } else if (units <= 0 && extInvested > 0) {
        const fallbackNav = Number(row.avgNav) > 0 ? Number(row.avgNav) : liveNav > 0 ? liveNav : 50;
        units = extInvested / fallbackNav;
      }
      units = Number(Math.max(1e-4, units).toFixed(4));
      let avgNav;
      if (extInvested > 0 && units > 0) {
        avgNav = extInvested / units;
      } else if (Number(row.avgNav) > 0) {
        avgNav = Number(row.avgNav);
      } else {
        avgNav = liveNav > 0 ? liveNav : 50;
      }
      avgNav = Number(Math.max(1e-4, avgNav).toFixed(4));
      const purchaseDate = row.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(row.purchaseDate) ? row.purchaseDate : new Date(Date.now() - 420 * 864e5).toISOString().slice(0, 10);
      const conf = row.confidence === "high" || row.confidence === "medium" || row.confidence === "low" ? row.confidence : "medium";
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
        folioNumber: (row.folioNumber || "").slice(0, 40),
        latestNav: match.latestNav,
        verified: match.verified,
        confidence: match.verified ? conf : "low",
        notes: [row.notes || "", reconciledNote].filter(Boolean).join(" ").trim(),
        screenshotInvestedAmount: extInvested > 0 ? Number(extInvested.toFixed(2)) : void 0,
        screenshotCurrentValue: extCurrent > 0 ? Number(extCurrent.toFixed(2)) : void 0
      };
    })
  );
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const r of resolvedRows) {
    const key = `${r.resolvedSchemeCode}|${r.folioNumber}|${r.units.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  const reportedTotals = batchResults.map((r) => r.portfolioTotals).find((t) => t && (Number(t.totalCurrent) > 0 || Number(t.totalInvested) > 0));
  if (reportedTotals && deduped.length > 0) {
    const sumInvested = deduped.reduce((acc, r) => acc + r.units * r.avgNav, 0);
    const sumCurrent = deduped.reduce(
      (acc, r) => acc + r.units * (r.latestNav || r.avgNav),
      0
    );
    const headerCurrent = Number(reportedTotals.totalCurrent || 0);
    const headerInvested = Number(reportedTotals.totalInvested || 0);
    if (headerCurrent > 0 && Math.abs(sumCurrent - headerCurrent) / headerCurrent > 0.03) {
      warnings.push(
        `Parsed holdings value (\u20B9${Math.round(sumCurrent).toLocaleString("en-IN")}) differs from screenshot header Current Value (\u20B9${Math.round(headerCurrent).toLocaleString("en-IN")}) \u2014 check if all scrolled schemes were included.`
      );
    }
    if (headerInvested > 0 && Math.abs(sumInvested - headerInvested) / headerInvested > 0.03) {
      warnings.push(
        `Parsed invested capital (\u20B9${Math.round(sumInvested).toLocaleString("en-IN")}) differs from screenshot header Invested (\u20B9${Math.round(headerInvested).toLocaleString("en-IN")}) \u2014 check if all schemes are staged.`
      );
    }
  }
  return {
    sourceDetected: sourceLabel,
    holdings: deduped,
    warnings
  };
}
var formatRupees = (v) => `\u20B9${Math.round(v).toLocaleString("en-IN")}`;
function clampMfNum(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function getCategoryLongTermBaseCagr(category) {
  const lower = (category || "").toLowerCase();
  if (/liquid|overnight|money market/i.test(lower)) {
    return { baseCagr: 6.5, min1Y: 4.5, max1Y: 8.5, minLong: 5.5, maxLong: 7.5 };
  }
  if (/debt|gilt|bond|corporate|banking & psu|short duration|dynamic bond/i.test(lower)) {
    return { baseCagr: 7.4, min1Y: 3.5, max1Y: 11.5, minLong: 6, maxLong: 9 };
  }
  if (/hybrid|balanced|equity savings|multi asset|arbitrage/i.test(lower)) {
    return { baseCagr: 10.5, min1Y: -4, max1Y: 18, minLong: 8, maxLong: 13.5 };
  }
  if (/small\s*cap/i.test(lower)) {
    return { baseCagr: 14.8, min1Y: -15, max1Y: 32, minLong: 9.5, maxLong: 18.5 };
  }
  if (/mid\s*cap/i.test(lower)) {
    return { baseCagr: 13.8, min1Y: -12, max1Y: 28, minLong: 9, maxLong: 17.5 };
  }
  if (/flexi|multi\s*cap|large\s*&|elss|focused/i.test(lower)) {
    return { baseCagr: 12.6, min1Y: -10, max1Y: 25, minLong: 8.5, maxLong: 16.5 };
  }
  return { baseCagr: 11.8, min1Y: -10, max1Y: 24, minLong: 8, maxLong: 15.5 };
}
function buildMfHorizonProjection(f, aiHint) {
  const val = Math.max(1, f.currentValue);
  const bounds = getCategoryLongTermBaseCagr(f.holding.category);
  const histAnchor = f.return5Y !== null && f.return3Y !== null ? f.return5Y * 0.5 + f.return3Y * 0.5 : f.return3Y !== null ? f.return3Y : f.return1Y !== null ? f.return1Y * 0.6 + bounds.baseCagr * 0.4 : bounds.baseCagr;
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
  const r6m = typeof aiHint?.p6m === "number" && Number.isFinite(aiHint.p6m) ? clampMfNum(aiHint.p6m * 0.5 + base6M * 0.5, bounds.min1Y * 0.6, bounds.max1Y * 0.6) : base6M;
  const r1y = typeof aiHint?.p1y === "number" && Number.isFinite(aiHint.p1y) ? clampMfNum(aiHint.p1y * 0.5 + base1Y * 0.5, bounds.min1Y, bounds.max1Y) : base1Y;
  const c5y = typeof aiHint?.cagr5y === "number" && Number.isFinite(aiHint.cagr5y) ? clampMfNum(aiHint.cagr5y * 0.5 + base5Y * 0.5, bounds.minLong, bounds.maxLong) : base5Y;
  const c10y = typeof aiHint?.cagr10y === "number" && Number.isFinite(aiHint.cagr10y) ? clampMfNum(aiHint.cagr10y * 0.5 + base10Y * 0.5, bounds.minLong, bounds.maxLong - 0.5) : base10Y;
  const hasSwitchGain = f.switchSuggestion.action !== "HOLD";
  const extraAnnualPct = hasSwitchGain ? clampMfNum(
    f.switchSuggestion.annualCommissionSaved / val * 100 + (f.switchSuggestion.action === "SWITCH_PEER" ? 1.1 : 0.15),
    0.3,
    2.5
  ) : 0;
  const immediateFriction = hasSwitchGain ? (f.switchSuggestion.estimatedExitLoad || 0) + (f.switchSuggestion.estimatedTax || 0) : 0;
  const optNetBase = Math.max(0, val - immediateFriction);
  const opt6m = hasSwitchGain ? optNetBase * (1 + (r6m + extraAnnualPct * 0.5) / 100) : val * (1 + r6m / 100);
  const opt1y = hasSwitchGain ? optNetBase * (1 + (r1y + extraAnnualPct) / 100) : val * (1 + r1y / 100);
  const opt5y = hasSwitchGain ? optNetBase * Math.pow(1 + (c5y + extraAnnualPct) / 100, 5) : val * Math.pow(1 + c5y / 100, 5);
  const opt10y = hasSwitchGain ? optNetBase * Math.pow(1 + (c10y + extraAnnualPct) / 100, 10) : val * Math.pow(1 + c10y / 100, 10);
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
    basisNote: `Mean-reverted ${f.holding.category} trajectory net of ${f.estExpenseRatio.toFixed(2)}% TER.`
  };
}
function aggregateMfPortfolioProjection(funds, recProjectionsByCode) {
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
  if (baseVal <= 0) return void 0;
  return {
    return6MPercent: Number(((v6m - baseVal) / baseVal * 100).toFixed(1)),
    value6M: Math.round(v6m),
    return1YPercent: Number(((v1y - baseVal) / baseVal * 100).toFixed(1)),
    value1Y: Math.round(v1y),
    cagr5YPercent: Number(((Math.pow(v5y / baseVal, 1 / 5) - 1) * 100).toFixed(1)),
    value5Y: Math.round(v5y),
    cagr10YPercent: Number(((Math.pow(v10y / baseVal, 1 / 10) - 1) * 100).toFixed(1)),
    value10Y: Math.round(v10y),
    optimizedValue6M: Math.round(o6m),
    optimizedValue1Y: Math.round(o1y),
    optimizedValue5Y: Math.round(o5y),
    optimizedValue10Y: Math.round(o10y),
    basisNote: "Compounded portfolio projection comparing current path vs. post-switch Direct/Peer optimization (net of TER & Year-1 switch tax/exit load)."
  };
}
function buildDeterministicMfRecommendation(f) {
  const sw = f.switchSuggestion;
  const shortName = f.holding.schemeName.split(" - ")[0];
  const targetShort = (sw.targetSchemeName || "Direct Growth peer").split(" - ")[0];
  const commissionSaved = Math.round(sw.annualCommissionSaved || 0);
  const exitFriction = Math.round((sw.estimatedExitLoad || 0) + (sw.estimatedTax || 0));
  const projection = buildMfHorizonProjection(f);
  const exitLoadDateLabel = sw.daysUntilExitLoadFree > 0 ? new Date(Date.now() + sw.daysUntilExitLoadFree * 864e5).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }) : "now";
  if (sw.action === "SWITCH_TO_DIRECT") {
    const timingClause = sw.timingVerdict === "WAIT_EXIT_LOAD" && sw.daysUntilExitLoadFree > 0 ? `Wait ${sw.daysUntilExitLoadFree} days until the ${sw.exitLoadRuleLabel || "1Y exit-load"} window clears (${exitLoadDateLabel}), then switch full exit-load-free units to Direct Growth.` : `Switch immediately to ${targetShort} (Direct Growth)${exitFriction > 0 ? `; estimated tax + exit friction ~${formatRupees(exitFriction)} pays back via fee savings.` : " with zero exit load."}`;
    return {
      schemeCode: f.holding.schemeCode,
      actionSummary: `Switch ${shortName} from Regular to Direct to save ~${formatRupees(commissionSaved)}/yr`,
      executionSteps: `${timingClause} Stop any active Regular SIPs immediately and restart them in Direct mode.`,
      projection
    };
  }
  if (sw.action === "SWITCH_PEER") {
    const alphaStr = f.alpha3Y !== null ? `${f.alpha3Y >= 0 ? "+" : ""}${f.alpha3Y.toFixed(1)}% 3Y alpha` : `Grade ${f.reportCardGrade}`;
    const timingClause = sw.timingVerdict === "WAIT_EXIT_LOAD" && sw.daysUntilExitLoadFree > 0 ? `Stagger switch after ${sw.daysUntilExitLoadFree} days (${exitLoadDateLabel}) once exit load reaches zero.` : `Reallocate within your \u20B91.25L annual Equity LTCG exemption toward ${targetShort}.`;
    return {
      schemeCode: f.holding.schemeCode,
      actionSummary: `Upgrade lagging ${shortName} (${alphaStr}) \u2192 ${targetShort}`,
      executionSteps: timingClause,
      projection
    };
  }
  return {
    schemeCode: f.holding.schemeCode,
    actionSummary: `Hold ${shortName} (Grade ${f.reportCardGrade}, ${f.holding.planType} plan)`,
    executionSteps: sw.rationale || "Continue existing SIP / allocation; expense ratio and benchmark-adjusted performance remain healthy.",
    projection
  };
}
function buildDeterministicMfAdvice(funds, summary, quotaNotice) {
  const regularFunds = funds.filter((f) => f.holding.planType === "Regular");
  const sortedActionable = [...funds].sort(
    (a, b) => b.switchSuggestion.annualCommissionSaved - a.switchSuggestion.annualCommissionSaved || (b.switchSuggestion.action !== "HOLD" ? 1 : 0) - (a.switchSuggestion.action !== "HOLD" ? 1 : 0)
  );
  const topSwitch = sortedActionable.find((f) => f.switchSuggestion.action !== "HOLD");
  const waitLoadCount = funds.filter((f) => f.switchSuggestion.timingVerdict === "WAIT_EXIT_LOAD").length;
  const portfolioVerdict = summary.regularPlanCount > 0 ? `Across ${funds.length} schemes (${formatRupees(summary.totalCurrent)}), ${summary.regularPlanCount} Regular plan(s) leak ${formatRupees(summary.regularCommissionLeak)}/yr in distributor commissions (${formatRupees(summary.tenYearCommissionLeak)} compounded over 10 years), while ${summary.underperformerCount} fund(s) lag category peers.` : `Across ${funds.length} Direct-plan schemes (${formatRupees(summary.totalCurrent)}), zero distributor commission leak was detected; ${summary.underperformerCount} fund(s) warrant peer alpha review.`;
  const priorityMove = topSwitch ? `Prioritize ${topSwitch.holding.schemeName.split(" - ")[0]} (${topSwitch.switchSuggestion.action === "SWITCH_TO_DIRECT" ? `saves ${formatRupees(topSwitch.switchSuggestion.annualCommissionSaved)}/yr` : `upgrade to ${(topSwitch.switchSuggestion.targetSchemeName || "top peer").split(" - ")[0]}`}) and pause any ongoing Regular-plan SIP instalments immediately.` : regularFunds.length === 0 ? "Maintain Direct SIP discipline and rebalance annually to keep equity-debt weights on target." : "Convert Regular plans to Direct in order of highest annual commission drag.";
  const taxOptimizationNote = waitLoadCount > 0 ? `${waitLoadCount} scheme(s) currently sit inside an exit-load or ELSS lock-in window \u2014 harvest your \u20B91.25L annual Equity LTCG exemption only on exit-load-free lots first and stagger remaining redemptions past the 1-year date.` : "Use Systematic Transfer / annual LTCG harvesting up to \u20B91.25L unrealized Equity gain per financial year to migrate units tax-efficiently.";
  const recommendations = funds.map(buildDeterministicMfRecommendation);
  const projMap = /* @__PURE__ */ new Map();
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
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    analysisSource: "fallback_engine",
    quotaNotice
  };
}
async function generateMfSwitchAdvice(params) {
  if (!process.env.GEMINI_API_KEY) {
    return buildDeterministicMfAdvice(
      params.funds,
      params.summary,
      "Gemini API key is not configured \u2014 showing quantitative AMFI switch & tax execution plan instead. Configure a key in Settings > Secrets to enable LLM commentary."
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
    daysUntilExitLoadFree: f.switchSuggestion.daysUntilExitLoadFree
  }));
  const batches = [];
  for (let i = 0; i < compactSnapshot.length; i += MF_AI_BATCH_SIZE) {
    batches.push(compactSnapshot.slice(i, i + MF_AI_BATCH_SIZE));
  }
  const modelCandidates = [
    { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel3.LOW },
    { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel3.MINIMAL }
  ];
  let usedFallbackEngine = false;
  let quotaHit = false;
  const batchResponses = await Promise.all(
    batches.map(async (batch, idx) => {
      const prompt = `You are a Stoxify SEBI-grade Indian Mutual Fund portfolio advisor. Review this investor's live mutual fund analytics and switch simulation (${idx === 0 ? "Full Summary + Batch 1" : `Continuation Batch ${idx + 1} of ${batches.length}`}):
Summary: ${JSON.stringify(params.summary)}
Holdings in Batch (${batch.length} schemes): ${JSON.stringify(batch)}

Provide a concise, actionable switch execution plan in Indian Rupees (\u20B9), factoring in Regular->Direct commission leaks, underperforming peer switches, 1-year exit load windows, and \u20B91.25L annual Equity LTCG exemption harvesting. For EVERY scheme in this batch also output realistic expected return/CAGR predictions: p6m (6-month total %), p1y (1-year total %), cagr5y (5-year annualized % CAGR), and cagr10y (10-year annualized % CAGR).`;
      const schema = {
        type: Type3.OBJECT,
        properties: {
          portfolioVerdict: { type: Type3.STRING },
          priorityMove: { type: Type3.STRING },
          taxOptimizationNote: { type: Type3.STRING },
          recommendations: {
            type: Type3.ARRAY,
            items: {
              type: Type3.OBJECT,
              properties: {
                schemeCode: { type: Type3.STRING },
                actionSummary: { type: Type3.STRING },
                executionSteps: { type: Type3.STRING },
                p6m: { type: Type3.NUMBER },
                p1y: { type: Type3.NUMBER },
                cagr5y: { type: Type3.NUMBER },
                cagr10y: { type: Type3.NUMBER }
              },
              required: ["schemeCode", "actionSummary", "executionSteps"]
            }
          }
        },
        required: [
          "portfolioVerdict",
          "priorityMove",
          "taxOptimizationNote",
          "recommendations"
        ]
      };
      for (const candidate of modelCandidates) {
        try {
          const response = await ai.models.generateContent({
            model: candidate.model,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
              responseMimeType: "application/json",
              responseSchema: schema
            }
          });
          return JSON.parse((response.text ?? "{}").trim());
        } catch (err) {
          if (isQuotaError2(err)) {
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
          cagr10y: rec.projection?.cagr10YPercent
        }))
      };
    })
  );
  const primary = batchResponses[0] || {
    portfolioVerdict: "Mutual fund portfolio evaluated.",
    priorityMove: "",
    taxOptimizationNote: "",
    recommendations: []
  };
  const allRecommendations = batchResponses.flatMap(
    (b) => Array.isArray(b.recommendations) ? b.recommendations : []
  );
  const fundByCode = new Map(params.funds.map((f) => [f.holding.schemeCode, f]));
  const guardrailWarnings = [];
  const seenCodes = /* @__PURE__ */ new Set();
  const validatedRecs = [];
  const recProjMap = /* @__PURE__ */ new Map();
  for (const rec of allRecommendations) {
    const cleanCode = String(rec.schemeCode || "").replace(/[^0-9]/g, "");
    if (!cleanCode || seenCodes.has(cleanCode)) continue;
    const matched = fundByCode.get(cleanCode);
    if (!matched) {
      guardrailWarnings.push(
        `Filtered out unverified AI scheme recommendation (#${rec.schemeCode}) not present in your analyzed portfolio.`
      );
      continue;
    }
    seenCodes.add(cleanCode);
    if (matched.switchSuggestion.timingVerdict === "WAIT_EXIT_LOAD" && /redeem all|switch entire|exit immediately/i.test(
      `${rec.actionSummary} ${rec.executionSteps}`
    )) {
      guardrailWarnings.push(
        `Guardrail notice for #${cleanCode} (${matched.holding.schemeName.split(" - ")[0]}): Deterministic engine flags active ${matched.switchSuggestion.exitLoadRuleLabel || "exit-load / ELSS lock-in"} window \u2014 prefer staggering or waiting.`
      );
    }
    const projection = buildMfHorizonProjection(matched, {
      p6m: rec.p6m,
      p1y: rec.p1y,
      cagr5y: rec.cagr5y,
      cagr10y: rec.cagr10y
    });
    recProjMap.set(cleanCode, projection);
    validatedRecs.push({
      schemeCode: cleanCode,
      actionSummary: rec.actionSummary,
      executionSteps: rec.executionSteps,
      projection
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
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    analysisSource: usedFallbackEngine ? "fallback_engine" : "gemini",
    quotaNotice: usedFallbackEngine ? quotaHit ? "Gemini free-tier daily quota (20 requests/day) was reached, so Stoxify generated this plan using its deterministic AMFI Commission, Tax & Exit-Load Engine. To restore LLM narrative insights, select a billing-enabled Gemini API key in Settings > Secrets." : "Generated via Stoxify deterministic AMFI Commission, Tax & Exit-Load Engine due to transient LLM unavailability." : void 0
  };
}

// server/csvParser.ts
function stripBom(text) {
  return text.charCodeAt(0) === 65279 ? text.slice(1) : text;
}
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function next() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}
function detectDelimiter(text) {
  const sampleLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6);
  const sample = sampleLines.join("\n");
  const commaCount = (sample.match(/,/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  if (tabCount > commaCount && tabCount >= semiCount) return "	";
  if (semiCount > commaCount && commaCount === 0) return ";";
  return ",";
}
function parseCsvGrid(rawInput) {
  const text = stripBom(rawInput || "").trim();
  if (!text) return [];
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}
function normalizeHeaderKey(header) {
  return header.toLowerCase().replace(/\(₹\)|\(inr\)|\(rs\.?\)/gi, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function parseIndianNumber(raw) {
  if (!raw) return 0;
  const cleaned = raw.replace(/[₹,\s%]/g, "").replace(/^(rs\.?|inr)/i, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "--" || cleaned === "N/A") return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}
function parseIsoOrIndianDate(raw) {
  const s = (raw || "").trim();
  if (!s) return new Date(Date.now() - 420 * 864e5).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const mon = dmy[2].padStart(2, "0");
    const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yr}-${mon}-${day}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date(Date.now() - 420 * 864e5).toISOString().slice(0, 10);
}
function findColumnIndex(headers, aliases) {
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h === alias);
    if (idx !== -1) return idx;
  }
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}
function isSummaryOrTotalRow(nameValue) {
  const norm = nameValue.trim().toLowerCase();
  return !norm || norm === "total" || norm === "grand total" || norm.startsWith("total ");
}
function cleanKiteTicker(rawInstrument) {
  return rawInstrument.trim().toUpperCase().replace(/^(NSE|BSE)\s*[:/-]\s*/i, "").replace(/-(EQ|BE|BZ|SM|ST|GC|GS|T2T)$/i, "").trim();
}
async function parseStockPortfolioCsv(csvText, fileName) {
  const grid = parseCsvGrid(csvText);
  if (grid.length < 2) {
    throw new Error("The CSV file is empty or missing data rows.");
  }
  let headerRowIdx = -1;
  let normalizedHeaders = [];
  for (let i = 0; i < Math.min(grid.length, 12); i++) {
    const norm = grid[i].map(normalizeHeaderKey);
    const hasSymbolCol = findColumnIndex(norm, [
      "instrument",
      "symbol",
      "trading symbol",
      "tradingsymbol",
      "stock name",
      "stock",
      "company",
      "scrip"
    ]) !== -1;
    const hasQtyCol = findColumnIndex(norm, [
      "qty",
      "quantity",
      "quantity available",
      "net qty",
      "shares"
    ]) !== -1;
    const hasAvgCol = findColumnIndex(norm, [
      "avg cost",
      "average price",
      "avg price",
      "avg buy",
      "buy price",
      "avg"
    ]) !== -1;
    if (hasSymbolCol && (hasQtyCol || hasAvgCol)) {
      headerRowIdx = i;
      normalizedHeaders = norm;
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error(
      "Could not find Zerodha Kite CSV headers (expected Instrument/Symbol, Qty., and Avg. cost columns)."
    );
  }
  const symbolIdx = findColumnIndex(normalizedHeaders, [
    "instrument",
    "trading symbol",
    "tradingsymbol",
    "symbol",
    "scrip",
    "stock name",
    "stock"
  ]);
  const companyIdx = findColumnIndex(normalizedHeaders, ["company", "company name", "name"]);
  const qtyIdx = findColumnIndex(normalizedHeaders, [
    "qty",
    "quantity available",
    "net qty",
    "quantity",
    "shares"
  ]);
  const avgIdx = findColumnIndex(normalizedHeaders, [
    "avg cost",
    "average price",
    "avg price",
    "avg buy",
    "buy price",
    "cost price",
    "avg"
  ]);
  const ltpIdx = findColumnIndex(normalizedHeaders, [
    "ltp",
    "last price",
    "live price",
    "previous closing price",
    "close price"
  ]);
  const exchangeIdx = findColumnIndex(normalizedHeaders, ["exchange", "exch"]);
  const investedIdx = findColumnIndex(normalizedHeaders, [
    "invested",
    "invested amount",
    "buy value"
  ]);
  const isinIdx = findColumnIndex(normalizedHeaders, ["isin"]);
  const warnings = [];
  const dataRows = grid.slice(headerRowIdx + 1);
  const extracted = [];
  for (const row of dataRows) {
    const rawSym = symbolIdx >= 0 ? (row[symbolIdx] || "").trim() : "";
    const rawCompany = companyIdx >= 0 ? (row[companyIdx] || "").trim() : "";
    const label = rawSym || rawCompany;
    if (isSummaryOrTotalRow(label)) continue;
    const isin = isinIdx >= 0 ? (row[isinIdx] || "").trim().toUpperCase() : "";
    if (isin.startsWith("INF")) {
      warnings.push(`Skipped mutual fund ISIN "${label}" (${isin}) in equity CSV import.`);
      continue;
    }
    const qty = qtyIdx >= 0 ? parseIndianNumber(row[qtyIdx]) : 0;
    let avgBuy = avgIdx >= 0 ? parseIndianNumber(row[avgIdx]) : 0;
    const invested = investedIdx >= 0 ? parseIndianNumber(row[investedIdx]) : 0;
    const ltp = ltpIdx >= 0 ? parseIndianNumber(row[ltpIdx]) : 0;
    if (avgBuy <= 0 && qty > 0 && invested > 0) {
      avgBuy = invested / qty;
    }
    if (qty <= 0 || avgBuy <= 0) continue;
    const rawExchange = exchangeIdx >= 0 ? (row[exchangeIdx] || "").trim().toUpperCase() : "";
    const cleanedTicker = cleanKiteTicker(rawSym || rawCompany);
    const exchange = rawExchange === "BSE" || rawSym.toUpperCase().startsWith("BSE:") || /^\d{5,6}$/.test(cleanedTicker) ? "BSE" : "NSE";
    extracted.push({
      rawName: rawCompany && rawSym ? `${rawCompany} (${rawSym})` : label,
      guessedSymbol: cleanedTicker,
      exchange,
      quantity: Number(qty),
      avgBuyPrice: Number(avgBuy.toFixed(2)),
      ltp: ltp > 0 ? Number(ltp.toFixed(2)) : 0,
      isin
    });
  }
  if (extracted.length === 0) {
    throw new Error("No valid equity rows with positive Quantity and Avg. cost were found in the CSV.");
  }
  const resolvedList = await mapWithConcurrency(
    extracted.slice(0, 250),
    10,
    async (item, idx) => {
      const resolved = await resolveSymbolForScreenshot(
        item.rawName,
        item.guessedSymbol,
        item.exchange
      );
      const csvLtp = item.ltp > 0 ? item.ltp : null;
      const livePrice = resolved.quote?.price ?? null;
      const priceDeviationPct = csvLtp && livePrice ? Number(((livePrice - csvLtp) / csvLtp * 100).toFixed(2)) : null;
      return {
        tempId: `csv_eq_${Date.now()}_${idx}`,
        rawName: item.rawName,
        resolvedSymbol: resolved.symbol,
        resolvedName: resolved.name,
        exchange: resolved.exchange,
        sector: resolved.sector,
        quantity: item.quantity,
        avgBuyPrice: item.avgBuyPrice,
        screenshotLtp: csvLtp,
        livePrice,
        priceDeviationPct,
        verified: Boolean(resolved.quote),
        confidence: resolved.quote ? "high" : "low",
        notes: item.isin ? `CSV Import \xB7 ISIN ${item.isin}` : "Zerodha Kite / Broker CSV Import"
      };
    }
  );
  if (extracted.length > 250) {
    warnings.push(`Imported first 250 equity rows from ${fileName || "CSV"} (${extracted.length} total rows).`);
  }
  const isKiteFormat = normalizedHeaders.includes("instrument") && (normalizedHeaders.includes("avg cost") || normalizedHeaders.includes("cur val"));
  return {
    brokerDetected: isKiteFormat ? "Zerodha Kite CSV" : "Broker CSV Export",
    holdings: resolvedList,
    warnings
  };
}
async function parseMutualFundCsv(csvText, fileName) {
  const grid = parseCsvGrid(csvText);
  if (grid.length < 2) {
    throw new Error("The CSV file is empty or missing mutual fund rows.");
  }
  let headerRowIdx = -1;
  let normalizedHeaders = [];
  for (let i = 0; i < Math.min(grid.length, 12); i++) {
    const norm = grid[i].map(normalizeHeaderKey);
    const hasSchemeCol = findColumnIndex(norm, [
      "instrument",
      "scheme name",
      "fund name",
      "scheme",
      "fund",
      "symbol"
    ]) !== -1;
    const hasUnitsOrValCol = findColumnIndex(norm, [
      "qty",
      "units",
      "quantity",
      "quantity available",
      "cur val",
      "current value",
      "invested",
      "invested amount"
    ]) !== -1;
    if (hasSchemeCol && hasUnitsOrValCol) {
      headerRowIdx = i;
      normalizedHeaders = norm;
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error(
      "Could not find Mutual Fund CSV headers (expected Instrument/Scheme Name, Qty./Units, and Avg. cost/Avg NAV columns)."
    );
  }
  const schemeIdx = findColumnIndex(normalizedHeaders, [
    "scheme name",
    "fund name",
    "instrument",
    "scheme",
    "fund",
    "symbol"
  ]);
  const unitsIdx = findColumnIndex(normalizedHeaders, [
    "units",
    "qty",
    "quantity available",
    "quantity"
  ]);
  const avgNavIdx = findColumnIndex(normalizedHeaders, [
    "avg cost",
    "avg nav",
    "average price",
    "avg price",
    "purchase price",
    "purchase nav",
    "cost nav"
  ]);
  const ltpNavIdx = findColumnIndex(normalizedHeaders, [
    "ltp",
    "latest nav",
    "current nav",
    "nav",
    "previous closing price"
  ]);
  const investedIdx = findColumnIndex(normalizedHeaders, [
    "invested",
    "invested amount",
    "invested value",
    "investment",
    "cost value",
    "buy value"
  ]);
  const curValIdx = findColumnIndex(normalizedHeaders, [
    "cur val",
    "current value",
    "present value",
    "market value"
  ]);
  const planIdx = findColumnIndex(normalizedHeaders, ["plan", "plan type"]);
  const optionIdx = findColumnIndex(normalizedHeaders, ["option", "option type"]);
  const folioIdx = findColumnIndex(normalizedHeaders, ["folio", "folio no", "folio number"]);
  const dateIdx = findColumnIndex(normalizedHeaders, ["purchase date", "date", "start date"]);
  const sipIdx = findColumnIndex(normalizedHeaders, ["sip", "is sip", "monthly sip"]);
  const warnings = [];
  const dataRows = grid.slice(headerRowIdx + 1);
  const extracted = [];
  for (const row of dataRows) {
    const rawSchemeName = schemeIdx >= 0 ? (row[schemeIdx] || "").trim() : "";
    if (isSummaryOrTotalRow(rawSchemeName)) continue;
    const units = unitsIdx >= 0 ? parseIndianNumber(row[unitsIdx]) : 0;
    const avgNav = avgNavIdx >= 0 ? parseIndianNumber(row[avgNavIdx]) : 0;
    const latestNavShown = ltpNavIdx >= 0 ? parseIndianNumber(row[ltpNavIdx]) : 0;
    const investedAmount = investedIdx >= 0 ? parseIndianNumber(row[investedIdx]) : 0;
    const currentValue = curValIdx >= 0 ? parseIndianNumber(row[curValIdx]) : 0;
    if (units <= 0 && investedAmount <= 0 && currentValue <= 0) continue;
    const sipRaw = sipIdx >= 0 ? (row[sipIdx] || "").trim() : "";
    const sipNum = parseIndianNumber(sipRaw);
    const isSip = sipNum > 0 || /^(yes|true|sip|active)$/i.test(sipRaw);
    extracted.push({
      rawSchemeName,
      units,
      avgNav,
      latestNavShown,
      investedAmount,
      currentValue,
      planCell: planIdx >= 0 ? (row[planIdx] || "").trim() : "",
      optionCell: optionIdx >= 0 ? (row[optionIdx] || "").trim() : "",
      folioNumber: folioIdx >= 0 ? (row[folioIdx] || "").trim() : "",
      purchaseDate: parseIsoOrIndianDate(dateIdx >= 0 ? row[dateIdx] : ""),
      isSip,
      monthlySipAmount: sipNum > 0 ? sipNum : 0
    });
  }
  if (extracted.length === 0) {
    throw new Error("No valid mutual fund holdings found in the CSV file.");
  }
  const isZerodhaCsv = /kite|coin|zerodha/i.test(fileName || "") || normalizedHeaders.includes("instrument") && (normalizedHeaders.includes("avg cost") || normalizedHeaders.includes("cur val"));
  const resolvedRows = await mapWithConcurrency(
    extracted.slice(0, 250),
    8,
    async (row, idx) => {
      const combinedPlanHint = `${row.planCell} ${row.rawSchemeName}`;
      const hasExplicitRegular = /\b(regular|reg|arn-)\b/i.test(combinedPlanHint);
      const hasExplicitDirect = /\b(direct|dir)\b/i.test(combinedPlanHint);
      const prefPlan = hasExplicitRegular ? "Regular" : hasExplicitDirect ? "Direct" : "Direct";
      const prefOpt = /idcw|dividend/i.test(
        `${row.optionCell} ${row.rawSchemeName}`
      ) ? "IDCW" : "Growth";
      const targetNavHint = row.latestNavShown > 0 ? row.latestNavShown : row.units > 0 && row.currentValue > 0 ? row.currentValue / row.units : void 0;
      const match = await resolveAmfiMatch(
        row.rawSchemeName,
        prefPlan,
        prefOpt,
        targetNavHint,
        hasExplicitRegular || hasExplicitDirect
      );
      const liveNav = match.latestNav && match.latestNav > 0 ? match.latestNav : 0;
      let units = row.units;
      let notes = isZerodhaCsv ? "Imported from Zerodha Coin / Kite CSV" : "Imported from MF CSV";
      if (units <= 0 && row.currentValue > 0 && liveNav > 0) {
        units = row.currentValue / liveNav;
      } else if (units <= 0 && row.investedAmount > 0) {
        const navGuess = row.avgNav > 0 ? row.avgNav : liveNav > 0 ? liveNav : 50;
        units = row.investedAmount / navGuess;
      }
      if (row.currentValue > 0 && liveNav > 0 && units > 0) {
        const impliedCurrent = units * liveNav;
        if (Math.abs(impliedCurrent - row.currentValue) / row.currentValue > 0.05) {
          units = row.currentValue / liveNav;
          notes = `${notes} \xB7 Reconciled units from CSV current value \xF7 live AMFI NAV.`;
        }
      }
      units = Number(Math.max(1e-4, units).toFixed(4));
      let avgNav = row.avgNav;
      if (avgNav <= 0 && row.investedAmount > 0 && units > 0) {
        avgNav = row.investedAmount / units;
      } else if (row.investedAmount > 0 && units > 0) {
        const impliedInvested = units * row.avgNav;
        if (Math.abs(impliedInvested - row.investedAmount) / row.investedAmount > 0.02) {
          avgNav = row.investedAmount / units;
        }
      }
      if (avgNav <= 0) {
        avgNav = liveNav > 0 ? liveNav : 50;
      }
      avgNav = Number(Math.max(1e-4, avgNav).toFixed(4));
      const investedCheck = row.investedAmount > 0 ? row.investedAmount : Number((units * avgNav).toFixed(2));
      const currentCheck = row.currentValue > 0 ? row.currentValue : liveNav > 0 ? Number((units * liveNav).toFixed(2)) : void 0;
      return {
        tempId: `mf_csv_${Date.now()}_${idx}`,
        rawSchemeName: row.rawSchemeName,
        resolvedSchemeCode: match.schemeCode,
        resolvedSchemeName: match.schemeName,
        fundHouse: match.fundHouse,
        category: match.category,
        planType: match.planType,
        optionType: match.optionType,
        units,
        avgNav,
        purchaseDate: row.purchaseDate,
        isSip: row.isSip,
        monthlySipAmount: row.monthlySipAmount,
        folioNumber: row.folioNumber.slice(0, 40),
        latestNav: match.latestNav,
        verified: match.verified,
        confidence: match.verified ? "high" : "low",
        notes,
        screenshotInvestedAmount: investedCheck,
        screenshotCurrentValue: currentCheck
      };
    }
  );
  if (extracted.length > 250) {
    warnings.push(`Imported first 250 mutual fund rows from ${fileName || "CSV"} (${extracted.length} total rows).`);
  }
  return {
    sourceDetected: isZerodhaCsv ? "Zerodha Kite / Coin CSV" : "Mutual Fund CSV Export",
    holdings: resolvedRows,
    warnings
  };
}

// server/capitalRotationService.ts
import { GoogleGenAI as GoogleGenAI4, ThinkingLevel as ThinkingLevel4, Type as Type4 } from "@google/genai";
var STRATEGY_TTL_MS = 5 * 60 * 1e3;
var strategyCache = null;
var ROTATION_QUOTA_NOTICE = "Gemini API free-tier daily quota was reached. Showing quantitative Smart Capital Rotation pairings grounded in live NSE/BSE valuation, ROCE, 50/200-DMA, and RSI-14 telemetry.";
function clampNum2(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function isQuotaError3(err) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /429|RESOURCE_EXHAUSTED|quota|rate[-_\s]?limit/i.test(msg);
}
async function mapWithConcurrency2(items, limit, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function next() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}
function scoreUndervaluedCandidate(q, sectorWeights) {
  let score = 38;
  if (q.sector === "Banking") {
    if (q.peRatio !== null && q.peRatio <= 16) score += 20;
    else if (q.peRatio !== null && q.peRatio <= 22) score += 14;
  } else if (q.roce !== null) {
    if (q.roce >= 28) score += 24;
    else if (q.roce >= 20) score += 18;
    else if (q.roce >= 14) score += 11;
    else if (q.roce < 8) score -= 18;
  }
  if (q.peRatio !== null) {
    if (q.peRatio > 0 && q.peRatio <= 18) score += 22;
    else if (q.peRatio <= 28) score += 15;
    else if (q.peRatio <= 38) score += 7;
    else if (q.peRatio > 60) score -= 14;
  } else {
    score -= 10;
  }
  if (q.debtToEquity !== null) {
    if (q.debtToEquity <= 0.3) score += 10;
    else if (q.debtToEquity <= 0.7) score += 5;
    else if (q.debtToEquity > 1.5) score -= 8;
  }
  const rsi = q.rsi14 ?? 50;
  if (rsi >= 34 && rsi <= 56) score += 16;
  else if (rsi < 34 && (q.roce ?? 12) >= 12) score += 14;
  else if (rsi >= 72) score -= 14;
  if (q.sma200 && q.price >= q.sma200) score += 6;
  if (q.sma50 && q.price >= q.sma50 * 0.96 && q.price <= q.sma50 * 1.08) score += 5;
  const sectorWt = sectorWeights.get(q.sector) ?? 0;
  const diversificationBonus = sectorWt < 10;
  if (diversificationBonus) {
    score += 10;
  }
  const finalScore = Math.round(clampNum2(score, 15, 98));
  const reasons = [];
  if (q.roce !== null && q.roce >= 18) reasons.push(`${q.roce.toFixed(1)}% ROCE`);
  if (q.peRatio !== null && q.peRatio <= 30) reasons.push(`fair ${q.peRatio.toFixed(1)}x P/E`);
  if (rsi < 45) reasons.push(`accumulation RSI (${rsi.toFixed(1)})`);
  else if (q.sma50 && q.price >= q.sma50) reasons.push("holding 50-DMA support");
  if (diversificationBonus) reasons.push(`adds ${q.sector} diversification`);
  const defaultThesis = reasons.length > 0 ? `Attractive risk-reward backed by ${reasons.join(", ")}.` : `Balanced valuation and steady momentum in ${q.sector}.`;
  return { score: finalScore, diversificationBonus, defaultThesis };
}
function buildReplacementPick(q, scored) {
  const beta = clampNum2(q.beta || 1, 0.65, 1.65);
  const live = Number(q.price.toFixed(2));
  const suggestedTarget = Number((live * (1 + 0.17 * beta)).toFixed(2));
  const supportStop = q.sma50 && q.sma50 < live * 0.96 && q.sma50 > live * 0.84 ? Number((q.sma50 * 0.985).toFixed(2)) : Number((live * (1 - 0.08 * beta)).toFixed(2));
  return {
    symbol: q.symbol,
    ticker: q.ticker,
    companyName: q.shortName,
    exchange: q.exchange === "BSE" ? "BSE" : "NSE",
    sector: q.sector,
    capCategory: q.capCategory,
    livePrice: live,
    roce: q.roce,
    peRatio: q.peRatio,
    debtToEquity: q.debtToEquity,
    rsi14: q.rsi14,
    return6M: q.return6M,
    return1Y: q.return1Y,
    undervaluedScore: scored.score,
    sectorDiversificationBonus: scored.diversificationBonus,
    rotationThesis: scored.defaultThesis,
    suggestedTarget,
    suggestedStopLoss: supportStop
  };
}
async function generateCapitalRotation(holdings) {
  if (holdings.length === 0) {
    throw new Error("Add at least one equity holding to scan Smart Capital Rotation opportunities.");
  }
  const consolidated = /* @__PURE__ */ new Map();
  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();
    const existing = consolidated.get(sym);
    if (!existing) {
      consolidated.set(sym, { ...h, symbol: sym });
    } else {
      const totalQty = existing.quantity + h.quantity;
      const totalCost = existing.quantity * existing.avgBuyPrice + h.quantity * h.avgBuyPrice;
      consolidated.set(sym, {
        ...existing,
        quantity: Number(totalQty.toFixed(4)),
        avgBuyPrice: totalQty > 0 ? Number((totalCost / totalQty).toFixed(2)) : existing.avgBuyPrice,
        buyDate: existing.buyDate <= h.buyDate ? existing.buyDate : h.buyDate
      });
    }
  }
  const uniqueHoldings = Array.from(consolidated.values());
  const [holdingQuotes, universeQuotes] = await Promise.all([
    getQuotes(Array.from(/* @__PURE__ */ new Set(["^NSEI", ...uniqueHoldings.map((h) => h.symbol)]))),
    getScreenerUniverse()
  ]);
  const nifty = holdingQuotes["^NSEI"] ?? null;
  const nifty6M = nifty?.return6M ?? 0;
  let totalPortfolioValue = 0;
  const enrichedHoldings = uniqueHoldings.map((h) => {
    const q = holdingQuotes[h.symbol] ?? null;
    const livePrice = q?.price && q.price > 0 ? q.price : h.avgBuyPrice;
    const invested = h.quantity * h.avgBuyPrice;
    const currentValue = h.quantity * livePrice;
    totalPortfolioValue += currentValue;
    const unrealizedPnlPercent = invested > 0 ? Number(((currentValue - invested) / invested * 100).toFixed(2)) : 0;
    return {
      ...h,
      ticker: h.symbol.replace(/\.(NS|BO)$/, ""),
      sector: q?.sector || h.sector,
      quote: q,
      livePrice: Number(livePrice.toFixed(2)),
      currentValue: Number(currentValue.toFixed(2)),
      unrealizedPnlPercent
    };
  });
  const sectorWeights = /* @__PURE__ */ new Map();
  const weightBySymbol = /* @__PURE__ */ new Map();
  for (const eh of enrichedHoldings) {
    const wt = totalPortfolioValue > 0 ? eh.currentValue / totalPortfolioValue * 100 : 0;
    weightBySymbol.set(eh.symbol.toUpperCase(), wt);
    sectorWeights.set(eh.sector, (sectorWeights.get(eh.sector) ?? 0) + wt);
  }
  const heldSymbols = new Set(enrichedHoldings.map((h) => h.symbol.toUpperCase()));
  const scoredPool = universeQuotes.filter((q) => {
    if (q.price <= 0) return false;
    const sym = q.symbol.toUpperCase();
    if ((weightBySymbol.get(sym) ?? 0) >= 14) return false;
    if (q.roce !== null && q.roce < 7) return false;
    return true;
  }).map((q) => {
    const scored = scoreUndervaluedCandidate(q, sectorWeights);
    return buildReplacementPick(q, scored);
  }).sort((a, b) => b.undervaluedScore - a.undervaluedScore);
  const standaloneIdeas = scoredPool.filter((c) => !heldSymbols.has(c.symbol)).slice(0, 4);
  const flaggedSources = [];
  for (const eh of enrichedHoldings) {
    const q = eh.quote;
    const weight = weightBySymbol.get(eh.symbol.toUpperCase()) ?? 0;
    const rsi = q?.rsi14 ?? 50;
    const ret6m = q?.return6M ?? null;
    const relNifty6M = ret6m !== null ? ret6m - nifty6M : null;
    const above50 = q?.sma50 ? eh.livePrice >= q.sma50 : null;
    const deepBelow200 = q?.sma200 ? eh.livePrice < q.sma200 * 0.92 : false;
    const pe = q?.peRatio ?? null;
    const roce = q?.roce ?? null;
    if (deepBelow200 && ((ret6m ?? 0) < -8 || (relNifty6M ?? 0) <= -10) || roce !== null && roce < 7 && eh.unrealizedPnlPercent < -10) {
      flaggedSources.push({
        holding: eh,
        actionType: "EXIT_LAGGARD",
        suggestedTrimPercent: 100,
        estimatedFreedCapital: Math.round(eh.currentValue),
        portfolioWeightPercent: Number(weight.toFixed(1)),
        triggerReason: roce !== null && roce < 7 ? `Low capital efficiency (${roce.toFixed(1)}% ROCE) with ${eh.unrealizedPnlPercent.toFixed(1)}% drawdown \u2014 rotate out to stop opportunity bleed.` : `Trading below 200-DMA (${ret6m !== null ? `${ret6m.toFixed(1)}% 6M` : "weak trend"}) and lagging Nifty 50 \u2014 redeploy into stronger setups.`
      });
      continue;
    }
    const isTripleDigitRun = eh.unrealizedPnlPercent >= 85;
    const isOverextendedWinner = eh.unrealizedPnlPercent >= 35 && (rsi >= 67 || weight >= 16 || pe !== null && pe >= 55 && above50 === true);
    const isOversizedWinner = weight >= 22 && eh.unrealizedPnlPercent > 15;
    if (isTripleDigitRun || isOverextendedWinner || isOversizedWinner) {
      const trimPct = isTripleDigitRun ? rsi >= 70 || weight >= 18 ? 45 : 35 : isOversizedWinner ? 30 : 30;
      const freed = Math.round(eh.currentValue * (trimPct / 100));
      const reasonParts = [
        `${eh.unrealizedPnlPercent >= 0 ? "+" : ""}${eh.unrealizedPnlPercent.toFixed(1)}% unrealized gain`
      ];
      if (rsi >= 67) reasonParts.push(`extended RSI ${rsi.toFixed(1)}`);
      if (pe !== null && pe >= 50) reasonParts.push(`rich ${pe.toFixed(1)}x P/E`);
      if (weight >= 16) reasonParts.push(`${weight.toFixed(1)}% concentration`);
      flaggedSources.push({
        holding: eh,
        actionType: "TRIM_PROFIT",
        suggestedTrimPercent: trimPct,
        estimatedFreedCapital: freed,
        portfolioWeightPercent: Number(weight.toFixed(1)),
        triggerReason: `Lock partial profits (${reasonParts.join(" \xB7 ")}) and rotate ${trimPct}% into undervalued sectors.`
      });
    }
  }
  const pairs = flaggedSources.sort((a, b) => b.estimatedFreedCapital - a.estimatedFreedCapital).map((src, idx) => {
    const preferred = scoredPool.filter((cand) => cand.symbol !== src.holding.symbol).sort((a, b) => {
      const aDiffSector = a.sector !== src.holding.sector ? 8 : 0;
      const bDiffSector = b.sector !== src.holding.sector ? 8 : 0;
      return b.undervaluedScore + bDiffSector - (a.undervaluedScore + aDiffSector);
    });
    const startOffset = preferred.length > 6 ? idx * 2 % Math.max(1, preferred.length - 4) : 0;
    const picks = preferred.slice(startOffset, startOffset + 2);
    const finalPicks = picks.length >= 2 ? picks : preferred.slice(0, 2);
    return {
      sourceSymbol: src.holding.symbol,
      sourceTicker: src.holding.ticker,
      sourceCompanyName: src.holding.companyName,
      sourceSector: src.holding.sector,
      actionType: src.actionType,
      currentValue: src.holding.currentValue,
      livePrice: src.holding.livePrice,
      unrealizedPnlPercent: src.holding.unrealizedPnlPercent,
      portfolioWeightPercent: src.portfolioWeightPercent,
      suggestedTrimPercent: src.suggestedTrimPercent,
      estimatedFreedCapital: src.estimatedFreedCapital,
      triggerReason: src.triggerReason,
      candidates: finalPicks
    };
  });
  let analysisSource = "fallback_engine";
  let quotaNotice;
  if (pairs.length > 0 && process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI4({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" }
        }
      });
      const compactPairs = pairs.slice(0, 12).map((p) => ({
        src: p.sourceSymbol,
        act: p.actionType,
        pnlPct: p.unrealizedPnlPercent,
        trimPct: p.suggestedTrimPercent,
        freedInr: p.estimatedFreedCapital,
        srcSec: p.sourceSector,
        picks: p.candidates.map((c) => ({
          sym: c.symbol,
          sec: c.sector,
          roce: c.roce,
          pe: c.peRatio,
          rsi: c.rsi14,
          r6m: c.return6M
        }))
      }));
      const prompt = `Write crisp 1-sentence institutional Smart Capital Rotation rationales for these Indian NSE pairs (source profit-book/exit -> undervalued replacement picks). Keep triggerReason focused on why locking gains/exiting protects capital and rotationThesis focused on why each replacement captures better risk-reward.
Pairs: ${JSON.stringify(compactPairs)}`;
      const schema = {
        type: Type4.OBJECT,
        properties: {
          items: {
            type: Type4.ARRAY,
            items: {
              type: Type4.OBJECT,
              properties: {
                sourceSymbol: { type: Type4.STRING },
                triggerReason: { type: Type4.STRING },
                pickTheses: {
                  type: Type4.ARRAY,
                  items: {
                    type: Type4.OBJECT,
                    properties: {
                      symbol: { type: Type4.STRING },
                      rotationThesis: { type: Type4.STRING }
                    },
                    required: ["symbol", "rotationThesis"]
                  }
                }
              },
              required: ["sourceSymbol", "triggerReason", "pickTheses"]
            }
          }
        },
        required: ["items"]
      };
      const modelCandidates = [
        { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel4.LOW },
        { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel4.MINIMAL }
      ];
      let lastErr;
      for (const candidate of modelCandidates) {
        try {
          const response = await ai.models.generateContent({
            model: candidate.model,
            contents: prompt,
            config: {
              temperature: 0.1,
              thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
              systemInstruction: "You are an institutional Indian equity portfolio strategist. Ground every sentence strictly in the provided telemetry numbers.",
              responseMimeType: "application/json",
              responseSchema: schema
            }
          });
          const parsed = JSON.parse((response.text ?? "{}").trim());
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            const aiBySource = new Map(
              parsed.items.filter((i) => i.sourceSymbol).map((i) => [i.sourceSymbol.toUpperCase(), i])
            );
            for (const p of pairs) {
              const match = aiBySource.get(p.sourceSymbol.toUpperCase());
              if (!match) continue;
              if (match.triggerReason) p.triggerReason = match.triggerReason;
              if (Array.isArray(match.pickTheses)) {
                const thesisBySym = new Map(
                  match.pickTheses.filter((pt) => pt.symbol && pt.rotationThesis).map((pt) => [pt.symbol.toUpperCase(), pt.rotationThesis])
                );
                p.candidates = p.candidates.map((c) => ({
                  ...c,
                  rotationThesis: thesisBySym.get(c.symbol.toUpperCase()) ?? c.rotationThesis
                }));
              }
            }
            analysisSource = "gemini";
            break;
          }
        } catch (err) {
          lastErr = err;
        }
      }
      if (analysisSource !== "gemini" && lastErr) {
        quotaNotice = isQuotaError3(lastErr) ? ROTATION_QUOTA_NOTICE : "Live AI narrative unavailable; displaying deterministic quantitative Smart Capital Rotation pairings.";
      }
    } catch {
      quotaNotice = ROTATION_QUOTA_NOTICE;
    }
  } else if (!process.env.GEMINI_API_KEY && pairs.length > 0) {
    analysisSource = "fallback_engine";
  }
  const totalEligibleFreedCapital = pairs.reduce((s, p) => s + p.estimatedFreedCapital, 0);
  const trimCount = pairs.filter((p) => p.actionType === "TRIM_PROFIT").length;
  const exitCount = pairs.filter((p) => p.actionType === "EXIT_LAGGARD").length;
  const sourceRoces = flaggedSources.map((s) => s.holding.quote?.roce).filter((v) => v !== null && v !== void 0);
  const repRoces = pairs.flatMap((p) => p.candidates.map((c) => c.roce)).filter((v) => v !== null && v !== void 0);
  const avgSourceRoce = sourceRoces.length > 0 ? Number((sourceRoces.reduce((a, b) => a + b, 0) / sourceRoces.length).toFixed(1)) : null;
  const avgReplacementRoce = repRoces.length > 0 ? Number((repRoces.reduce((a, b) => a + b, 0) / repRoces.length).toFixed(1)) : null;
  return {
    totalEligibleFreedCapital,
    trimCount,
    exitCount,
    avgSourceRoce,
    avgReplacementRoce,
    pairs,
    standaloneIdeas,
    benchmarkNifty6M: nifty?.return6M ?? null,
    analysisSource,
    quotaNotice,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var STRATEGY_DEFS = [
  {
    id: "bharat_momentum",
    name: "Bharat Momentum Leaders",
    tagline: "Institutional trend leaders outperforming Nifty 50 above 50 & 200-DMA",
    methodology: "Ranks liquid NSE equities trading above key moving averages by 6M relative alpha vs. Nifty 50, volume confirmation, and disciplined non-extreme RSI.",
    riskProfile: "Aggressive",
    rebalanceCadence: "Monthly Quantitative",
    scoreStock: (q, nifty6M) => {
      if (q.price <= 0) return { eligible: false, score: 0, reason: "" };
      const above50 = q.sma50 ? q.price >= q.sma50 : false;
      const above200 = q.sma200 ? q.price >= q.sma200 : false;
      const rel6m = (q.return6M ?? 0) - nifty6M;
      const rsi = q.rsi14 ?? 50;
      const score = 40 + (above50 ? 18 : 0) + (above200 ? 16 : -10) + clampNum2(rel6m * 0.9, -15, 25) + (q.volumeRatio >= 1.1 ? 8 : 0) + (rsi > 78 ? -12 : 4);
      const reason = `6M vs Nifty ${rel6m >= 0 ? "+" : ""}${rel6m.toFixed(1)}% \xB7 ${above50 && above200 ? "Above 50 & 200-DMA" : above200 ? "Above 200-DMA" : "Momentum recovery"}`;
      return { eligible: (q.roce ?? 12) >= 6, score: Math.round(clampNum2(score, 10, 99)), reason };
    }
  },
  {
    id: "undervalued_compounders",
    name: "Undervalued Compounders",
    tagline: "High-ROCE capital compounders at reasonable P/E multiples",
    methodology: "Screens India\u2019s core franchises combining ROCE >= 15%, controlled leverage (D/E <= 0.7), and disciplined valuation multiples before crowded breakouts.",
    riskProfile: "Moderate",
    rebalanceCadence: "Monthly Quantitative",
    scoreStock: (q) => {
      if (q.price <= 0 || q.peRatio !== null && q.peRatio <= 0) {
        return { eligible: false, score: 0, reason: "" };
      }
      const roce = q.roce ?? 0;
      const pe = q.peRatio ?? 40;
      const de = q.debtToEquity ?? 0.3;
      const rsi = q.rsi14 ?? 50;
      const score = 30 + clampNum2(roce * 0.85, 0, 32) + (pe <= 20 ? 22 : pe <= 32 ? 14 : pe > 55 ? -14 : 4) + (de <= 0.5 ? 10 : de > 1.4 ? -10 : 3) + (rsi >= 35 && rsi <= 58 ? 8 : 0);
      const reason = `ROCE ${roce > 0 ? `${roce.toFixed(1)}%` : "Bank proxy"} \xB7 P/E ${pe.toFixed(1)}x \xB7 RSI ${rsi.toFixed(1)}`;
      return {
        eligible: q.sector === "Banking" ? pe <= 22 : roce >= 12,
        score: Math.round(clampNum2(score, 10, 99)),
        reason
      };
    }
  },
  {
    id: "capex_midcap_alpha",
    name: "Domestic Capex & Mid-Cap Alpha",
    tagline: "Defence, infrastructure, manufacturing & high-growth challengers",
    methodology: "Captures India\u2019s domestic capital expenditure cycle and non-Nifty-heavy growth sectors exhibiting strong capital efficiency and earnings runway.",
    riskProfile: "Aggressive",
    rebalanceCadence: "Monthly Quantitative",
    scoreStock: (q) => {
      const capexSectors = /* @__PURE__ */ new Set([
        "Defence & Aerospace",
        "Infrastructure",
        "Auto",
        "Metals & Mining",
        "Capital Goods",
        "Healthcare",
        "Consumer Durables",
        "Retail"
      ]);
      const isCapexOrMid = capexSectors.has(q.sector) || q.capCategory === "Mid Cap";
      if (!isCapexOrMid || q.price <= 0) return { eligible: false, score: 0, reason: "" };
      const score = 42 + clampNum2((q.roce ?? 12) * 0.65, 0, 24) + clampNum2((q.return6M ?? 0) * 0.6, -12, 22) + (q.capCategory === "Mid Cap" ? 8 : 2) + (q.sma50 && q.price >= q.sma50 ? 6 : 0);
      const reason = `${q.capCategory} \xB7 ${q.sector} \xB7 6M ${(q.return6M ?? 0) >= 0 ? "+" : ""}${(q.return6M ?? 0).toFixed(1)}%`;
      return { eligible: (q.roce ?? 10) >= 8, score: Math.round(clampNum2(score, 10, 99)), reason };
    }
  },
  {
    id: "defensive_shield",
    name: "Quality Value & Low-Beta Shield",
    tagline: "Resilient large-cap cash compounders built to contain drawdowns",
    methodology: "Prioritizes beta <= 1.05, established large-cap balance sheets, low P/E multiples, and stable capital returns to dampen volatility during market pullbacks.",
    riskProfile: "Low",
    rebalanceCadence: "Monthly Quantitative",
    scoreStock: (q) => {
      if (q.price <= 0 || q.capCategory !== "Large Cap") {
        return { eligible: false, score: 0, reason: "" };
      }
      const pe = q.peRatio ?? 35;
      const beta = q.beta || 1;
      const score = 44 + (beta <= 0.85 ? 20 : beta <= 1 ? 14 : beta > 1.2 ? -15 : 4) + (pe <= 24 ? 18 : pe <= 35 ? 10 : -8) + clampNum2((q.roce ?? 10) * 0.5, 0, 18);
      const reason = `Beta ${beta.toFixed(2)}x \xB7 P/E ${pe.toFixed(1)}x \xB7 ${q.sector}`;
      return { eligible: (q.roce ?? 8) >= 7, score: Math.round(clampNum2(score, 10, 99)), reason };
    }
  }
];
function computeSeriesReturnPct(values, lookbackBars) {
  if (values.length < 5) return null;
  const latest = values[values.length - 1];
  const baseIdx = Math.max(0, values.length - 1 - lookbackBars);
  const base = values[baseIdx];
  if (!base || base <= 0) return null;
  return Number(((latest - base) / base * 100).toFixed(2));
}
function buildIndexedStrategyCurve(constituents, candlesBySymbol, niftyCandles) {
  if (niftyCandles.length < 20) {
    return {
      chartSeries: [],
      return1M: null,
      return6M: null,
      return1Y: null,
      nifty1M: null,
      nifty6M: null,
      nifty1Y: null
    };
  }
  const priceBySymAndDate = /* @__PURE__ */ new Map();
  for (const c of constituents) {
    const pts = candlesBySymbol.get(c.symbol) ?? [];
    const m = /* @__PURE__ */ new Map();
    for (const p of pts) {
      if (p.close > 0) m.set(p.dateLabel, p.close);
    }
    priceBySymAndDate.set(c.symbol, m);
  }
  const baseCloseBySym = /* @__PURE__ */ new Map();
  const lastKnownBySym = /* @__PURE__ */ new Map();
  for (const c of constituents) {
    const map = priceBySymAndDate.get(c.symbol);
    if (!map || map.size === 0) continue;
    for (const np of niftyCandles.slice(0, 15)) {
      const val = map.get(np.dateLabel);
      if (val && val > 0) {
        baseCloseBySym.set(c.symbol, val);
        lastKnownBySym.set(c.symbol, val);
        break;
      }
    }
  }
  const niftyBase = niftyCandles[0].close || 1;
  const rawSeries = [];
  for (const np of niftyCandles) {
    let sumIdx = 0;
    let count = 0;
    for (const c of constituents) {
      const base = baseCloseBySym.get(c.symbol);
      if (!base) continue;
      const map = priceBySymAndDate.get(c.symbol);
      const dayClose = map?.get(np.dateLabel);
      if (dayClose && dayClose > 0) {
        lastKnownBySym.set(c.symbol, dayClose);
      }
      const activeClose = lastKnownBySym.get(c.symbol) ?? base;
      sumIdx += activeClose / base * 100;
      count += 1;
    }
    const stratVal = count > 0 ? Number((sumIdx / count).toFixed(2)) : 100;
    const niftyVal = Number((np.close / niftyBase * 100).toFixed(2));
    rawSeries.push({
      dateLabel: np.dateLabel,
      strategyIndexed: stratVal,
      niftyIndexed: niftyVal
    });
  }
  const stratValues = rawSeries.map((r) => r.strategyIndexed);
  const niftyValues = rawSeries.map((r) => r.niftyIndexed);
  return {
    chartSeries: rawSeries,
    return1M: computeSeriesReturnPct(stratValues, 21),
    return6M: computeSeriesReturnPct(stratValues, 126),
    return1Y: computeSeriesReturnPct(stratValues, rawSeries.length - 1),
    nifty1M: computeSeriesReturnPct(niftyValues, 21),
    nifty6M: computeSeriesReturnPct(niftyValues, 126),
    nifty1Y: computeSeriesReturnPct(niftyValues, rawSeries.length - 1)
  };
}
async function getAiStrategyBaskets() {
  if (strategyCache && strategyCache.expiresAt > Date.now()) {
    return strategyCache.data;
  }
  const [universeQuotes, niftyChart] = await Promise.all([
    getScreenerUniverse(),
    getChart("^NSEI", "1y")
  ]);
  const draftBaskets = STRATEGY_DEFS.map((def) => {
    const ranked = universeQuotes.map((q) => {
      const res = def.scoreStock(q, niftyChart?.quote?.return6M ?? 0);
      return { quote: q, ...res };
    }).filter((item) => item.eligible).sort((a, b) => b.score - a.score);
    const selected = ranked.slice(0, 8);
    const weight = selected.length > 0 ? Number((100 / selected.length).toFixed(1)) : 0;
    const constituents = selected.map((item) => ({
      symbol: item.quote.symbol,
      ticker: item.quote.ticker,
      name: item.quote.shortName,
      exchange: item.quote.exchange === "BSE" ? "BSE" : "NSE",
      sector: item.quote.sector,
      capCategory: item.quote.capCategory,
      price: item.quote.price,
      changePercent: item.quote.changePercent,
      peRatio: item.quote.peRatio,
      roce: item.quote.roce,
      debtToEquity: item.quote.debtToEquity,
      rsi14: item.quote.rsi14,
      return6M: item.quote.return6M,
      return1Y: item.quote.return1Y,
      weightPercent: weight,
      factorScore: item.score,
      selectionReason: item.reason
    }));
    const selectedSyms = new Set(constituents.map((c) => c.symbol));
    const rotateOutPool = universeQuotes.filter(
      (q) => !selectedSyms.has(q.symbol) && ((q.rsi14 ?? 50) >= 68 || (q.return6M ?? 0) >= 30 || (q.peRatio ?? 0) >= 55)
    ).sort((a, b) => (b.rsi14 ?? 50) - (a.rsi14 ?? 50)).slice(0, 2);
    const recentRotations = [
      ...rotateOutPool.map((q) => ({
        action: "ROTATE_OUT",
        symbol: q.symbol,
        ticker: q.ticker,
        companyName: q.shortName,
        sector: q.sector,
        reason: (q.rsi14 ?? 50) >= 68 ? `Booked gains on stretched momentum (RSI ${q.rsi14?.toFixed(1)})` : `Locked valuation upside (${q.peRatio?.toFixed(1)}x P/E)`,
        returnTag: q.return6M !== null ? `${q.return6M >= 0 ? "+" : ""}${q.return6M.toFixed(1)}% 6M` : "Profit Locked"
      })),
      ...constituents.slice(0, 2).map((c) => ({
        action: "ROTATE_IN",
        symbol: c.symbol,
        ticker: c.ticker,
        companyName: c.name,
        sector: c.sector,
        reason: c.selectionReason,
        returnTag: `Score ${c.factorScore}`
      }))
    ];
    return { def, constituents, recentRotations };
  });
  const uniqueSymbols = Array.from(
    new Set(draftBaskets.flatMap((b) => b.constituents.map((c) => c.symbol)))
  );
  const chartEntries = await mapWithConcurrency2(uniqueSymbols, 6, async (sym) => {
    const ch = await getChart(sym, "1y");
    return [sym, ch?.candles ?? []];
  });
  const candlesBySymbol = new Map(chartEntries);
  const niftyCandles = niftyChart?.candles ?? [];
  const strategies = draftBaskets.map((b) => {
    const curve = buildIndexedStrategyCurve(b.constituents, candlesBySymbol, niftyCandles);
    const roces = b.constituents.map((c) => c.roce).filter((v) => v !== null && v > 0);
    const pes = b.constituents.map((c) => c.peRatio).filter((v) => v !== null && v > 0);
    return {
      id: b.def.id,
      name: b.def.name,
      tagline: b.def.tagline,
      methodology: b.def.methodology,
      riskProfile: b.def.riskProfile,
      rebalanceCadence: b.def.rebalanceCadence,
      return1M: curve.return1M,
      return6M: curve.return6M,
      return1Y: curve.return1Y,
      nifty1M: curve.nifty1M,
      nifty6M: curve.nifty6M,
      nifty1Y: curve.nifty1Y,
      alpha6M: curve.return6M !== null && curve.nifty6M !== null ? Number((curve.return6M - curve.nifty6M).toFixed(2)) : null,
      alpha1Y: curve.return1Y !== null && curve.nifty1Y !== null ? Number((curve.return1Y - curve.nifty1Y).toFixed(2)) : null,
      avgRoce: roces.length > 0 ? Number((roces.reduce((s, v) => s + v, 0) / roces.length).toFixed(1)) : null,
      avgPe: pes.length > 0 ? Number((pes.reduce((s, v) => s + v, 0) / pes.length).toFixed(1)) : null,
      chartSeries: curve.chartSeries,
      constituents: b.constituents,
      recentRotations: b.recentRotations
    };
  });
  const payload = {
    strategies,
    niftyBenchmark: niftyChart?.quote ?? null,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  strategyCache = {
    data: payload,
    expiresAt: Date.now() + STRATEGY_TTL_MS
  };
  return payload;
}

// server/algoEngineService.ts
import { GoogleGenAI as GoogleGenAI5, ThinkingLevel as ThinkingLevel5, Type as Type5 } from "@google/genai";
var VALID_INDICATORS = [
  "RSI_14",
  "PRICE_VS_SMA50",
  "PRICE_VS_SMA200",
  "EMA20_VS_SMA50",
  "VOLUME_RATIO",
  "DAY_CHANGE_PCT",
  "SMA50_SLOPE_PCT"
];
var VALID_COMPARATORS = [
  "LT",
  "LTE",
  "GT",
  "GTE",
  "CROSS_ABOVE",
  "CROSS_BELOW"
];
var VALID_TIMEFRAMES = ["1d", "5d", "1mo", "6mo", "1y"];
var DEFAULT_BLUECHIPS = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS"];
var ALGO_QUOTA_NOTICE = "Gemini API free-tier quota was reached. Compiled strategy rules deterministically from your prompt parameters.";
function clampNum3(v, min, max, decimals = 2) {
  if (!Number.isFinite(v)) return min;
  const clamped = Math.max(min, Math.min(max, v));
  return Number(clamped.toFixed(decimals));
}
function isQuotaOrNetworkError(err) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /429|RESOURCE_EXHAUSTED|quota|rate[-_\s]?limit|fetch failed/i.test(msg);
}
function getIstDateString(tsMs = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(tsMs));
}
function formatIstLabel(tsSec, range) {
  const d = new Date(tsSec * 1e3);
  if (range === "1d" || range === "5d") {
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: range === "1y" ? "2-digit" : void 0
  });
}
function formatRuleLabel(indicator, comparator, threshold) {
  const compText = {
    LT: "<",
    LTE: "<=",
    GT: ">",
    GTE: ">=",
    CROSS_ABOVE: "crosses above",
    CROSS_BELOW: "crosses below"
  };
  switch (indicator) {
    case "RSI_14":
      return `RSI(14) ${compText[comparator]} ${threshold}`;
    case "PRICE_VS_SMA50":
      return threshold === 0 ? `Price ${compText[comparator]} SMA(50)` : `Price vs SMA(50) ${compText[comparator]} ${threshold}%`;
    case "PRICE_VS_SMA200":
      return threshold === 0 ? `Price ${compText[comparator]} SMA(200)` : `Price vs SMA(200) ${compText[comparator]} ${threshold}%`;
    case "EMA20_VS_SMA50":
      return threshold === 0 ? `EMA(20) ${compText[comparator]} SMA(50)` : `EMA(20) vs SMA(50) ${compText[comparator]} ${threshold}%`;
    case "VOLUME_RATIO":
      return `Volume ${compText[comparator]} ${threshold}x 20D avg`;
    case "DAY_CHANGE_PCT":
      return `Bar Change ${compText[comparator]} ${threshold}%`;
    case "SMA50_SLOPE_PCT":
      return `SMA(50) 5-bar Slope ${compText[comparator]} ${threshold}%`;
    default:
      return `${indicator} ${compText[comparator]} ${threshold}`;
  }
}
async function resolvePromptSymbols(rawSymbols, fullPrompt) {
  const resolved = /* @__PURE__ */ new Set();
  const tryMatchCatalog = (token) => {
    const clean = token.trim().toUpperCase().replace(/[^A-Z0-9.&-]/g, "");
    if (!clean) return null;
    const bare = clean.replace(/\.(NS|BO)$/, "");
    const hit = INDIAN_STOCK_UNIVERSE.find(
      (s) => s.symbol.toUpperCase() === clean || s.ticker.toUpperCase() === bare || s.aliases?.some((a) => a.toUpperCase() === bare || a.toUpperCase() === clean)
    );
    if (hit) return hit.symbol;
    if (clean.endsWith(".NS") || clean.endsWith(".BO")) return clean;
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
  if (resolved.size === 0) {
    const upperPrompt = fullPrompt.toUpperCase();
    for (const stock of INDIAN_STOCK_UNIVERSE) {
      const tickerRegex = new RegExp(`\\b${stock.ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (tickerRegex.test(upperPrompt) || upperPrompt.includes(stock.name.toUpperCase()) || stock.aliases?.some((a) => upperPrompt.includes(a.toUpperCase()))) {
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
function normalizeConditions(raw, prefix, fallbackIfEmpty) {
  const list = Array.isArray(raw) ? raw : [];
  const cleaned = [];
  list.slice(0, 6).forEach((item, idx) => {
    const indicator = VALID_INDICATORS.includes(item.indicator) ? item.indicator : "RSI_14";
    const comparator = VALID_COMPARATORS.includes(item.comparator) ? item.comparator : "LT";
    const threshold = clampNum3(Number(item.threshold ?? 0), -1e3, 1e3, 2);
    cleaned.push({
      id: `${prefix}_${idx + 1}`,
      indicator,
      comparator,
      threshold,
      label: formatRuleLabel(indicator, comparator, threshold)
    });
  });
  if (cleaned.length === 0) {
    return fallbackIfEmpty;
  }
  return cleaned;
}
function normalizeStrategyDraft(draft, prompt, resolvedSymbols) {
  const timeframe = VALID_TIMEFRAMES.includes(draft.timeframe) ? draft.timeframe : "6mo";
  const logicOperator = draft.logicOperator === "OR" ? "OR" : "AND";
  const defaultEntry = [
    {
      id: "entry_1",
      indicator: "RSI_14",
      comparator: "LT",
      threshold: 40,
      label: formatRuleLabel("RSI_14", "LT", 40)
    }
  ];
  const defaultExit = [
    {
      id: "exit_1",
      indicator: "RSI_14",
      comparator: "GT",
      threshold: 70,
      label: formatRuleLabel("RSI_14", "GT", 70)
    }
  ];
  const stopLossPct = clampNum3(Number(draft.stopLossPct ?? 4), 0.5, 50, 2);
  const takeProfitPct = clampNum3(
    Number(draft.takeProfitPct ?? Math.max(stopLossPct * 2, 8)),
    0.5,
    200,
    2
  );
  return {
    name: String(draft.name || "Custom NSE Strategy").trim().slice(0, 100) || "Custom NSE Strategy",
    prompt: prompt.trim().slice(0, 500),
    summary: String(draft.summary || "Systematic Indian equity strategy with automated stop-loss and daily loss circuit-breaker.").trim().slice(0, 300),
    symbols: resolvedSymbols.slice(0, 10),
    timeframe,
    logicOperator,
    entryConditions: normalizeConditions(draft.entryConditions, "entry", defaultEntry),
    exitConditions: normalizeConditions(draft.exitConditions, "exit", defaultExit),
    virtualCapital: clampNum3(Number(draft.virtualCapital ?? 1e6), 1e4, 1e8, 0),
    allocationPercent: clampNum3(Number(draft.allocationPercent ?? 25), 5, 100, 1),
    stopLossPct,
    takeProfitPct,
    trailingStopPct: clampNum3(Number(draft.trailingStopPct ?? 0), 0, 50, 2),
    maxOpenPositions: Math.round(clampNum3(Number(draft.maxOpenPositions ?? 4), 1, 20, 0)),
    dailyLossCapPct: clampNum3(Number(draft.dailyLossCapPct ?? 2.5), 0.5, 25, 2),
    slippageBps: clampNum3(Number(draft.slippageBps ?? 10), 0, 100, 1)
  };
}
async function parsePromptDeterministic(prompt) {
  const lower = prompt.toLowerCase();
  const entryConditions = [];
  const exitConditions = [];
  const rsiBuyMatch = lower.match(/rsi(?:\s*\(\s*14\s*\))?\s*(?:drops\s+below|below|under|<|<=)\s*(\d+(?:\.\d+)?)/i);
  const rsiSellMatch = lower.match(/(?:sell|exit).*?rsi(?:\s*\(\s*14\s*\))?\s*(?:above|over|>|>=)\s*(\d+(?:\.\d+)?)/i);
  if (rsiBuyMatch) {
    const val = clampNum3(Number(rsiBuyMatch[1]), 10, 85, 1);
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: "RSI_14",
      comparator: lower.includes("cross") ? "CROSS_BELOW" : "LT",
      threshold: val,
      label: formatRuleLabel("RSI_14", lower.includes("cross") ? "CROSS_BELOW" : "LT", val)
    });
  } else if (lower.includes("oversold") || lower.includes("mean reversion")) {
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: "RSI_14",
      comparator: "LT",
      threshold: 38,
      label: formatRuleLabel("RSI_14", "LT", 38)
    });
  } else if (lower.includes("momentum")) {
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: "RSI_14",
      comparator: "GT",
      threshold: 55,
      label: formatRuleLabel("RSI_14", "GT", 55)
    });
  }
  if (rsiSellMatch) {
    const val = clampNum3(Number(rsiSellMatch[1]), 20, 95, 1);
    exitConditions.push({
      id: `exit_${exitConditions.length + 1}`,
      indicator: "RSI_14",
      comparator: "GT",
      threshold: val,
      label: formatRuleLabel("RSI_14", "GT", val)
    });
  } else if (lower.includes("overbought")) {
    exitConditions.push({
      id: `exit_${exitConditions.length + 1}`,
      indicator: "RSI_14",
      comparator: "GT",
      threshold: 72,
      label: formatRuleLabel("RSI_14", "GT", 72)
    });
  }
  if (/golden\s*cross|ema\s*20.*sma\s*50|20.*ema.*50.*sma/i.test(prompt)) {
    const comp = lower.includes("cross") ? "CROSS_ABOVE" : "GT";
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: "EMA20_VS_SMA50",
      comparator: comp,
      threshold: 0,
      label: formatRuleLabel("EMA20_VS_SMA50", comp, 0)
    });
  }
  if (/below\s*(?:the\s*)?200[\s-]*dma|below\s*sma\s*200/i.test(prompt)) {
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: "PRICE_VS_SMA200",
      comparator: "LT",
      threshold: 0,
      label: formatRuleLabel("PRICE_VS_SMA200", "LT", 0)
    });
  } else if (/200[\s-]*dma|sma\s*200/i.test(prompt)) {
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: "PRICE_VS_SMA200",
      comparator: "GT",
      threshold: 0,
      label: formatRuleLabel("PRICE_VS_SMA200", "GT", 0)
    });
  }
  if (/50[\s-]*dma|sma\s*50/i.test(prompt) && !/golden\s*cross|ema/i.test(prompt)) {
    const comp = lower.includes("below") ? "LT" : "GT";
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: "PRICE_VS_SMA50",
      comparator: comp,
      threshold: 0,
      label: formatRuleLabel("PRICE_VS_SMA50", comp, 0)
    });
  }
  const volMatch = lower.match(/(\d+(?:\.\d+)?)\s*x\s*(?:avg|average)?\s*vol/i);
  if (volMatch || /volume\s*(?:spike|surge|shock|breakout)/i.test(prompt)) {
    const mult = volMatch ? clampNum3(Number(volMatch[1]), 1.1, 10, 1) : 1.5;
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: "VOLUME_RATIO",
      comparator: "GT",
      threshold: mult,
      label: formatRuleLabel("VOLUME_RATIO", "GT", mult)
    });
  }
  const dipMatch = lower.match(/(?:dip|drop|fall|down)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%/i);
  if (dipMatch) {
    const pct = -Math.abs(clampNum3(Number(dipMatch[1]), 0.5, 15, 1));
    entryConditions.push({
      id: `entry_${entryConditions.length + 1}`,
      indicator: "DAY_CHANGE_PCT",
      comparator: "LTE",
      threshold: pct,
      label: formatRuleLabel("DAY_CHANGE_PCT", "LTE", pct)
    });
  }
  if (entryConditions.length === 0) {
    entryConditions.push({
      id: "entry_1",
      indicator: "PRICE_VS_SMA50",
      comparator: "GT",
      threshold: 0,
      label: formatRuleLabel("PRICE_VS_SMA50", "GT", 0)
    });
    entryConditions.push({
      id: "entry_2",
      indicator: "RSI_14",
      comparator: "LT",
      threshold: 55,
      label: formatRuleLabel("RSI_14", "LT", 55)
    });
  }
  if (exitConditions.length === 0) {
    exitConditions.push({
      id: "exit_1",
      indicator: "RSI_14",
      comparator: "GT",
      threshold: 72,
      label: formatRuleLabel("RSI_14", "GT", 72)
    });
  }
  const slMatch = lower.match(/(?:stop[\s-]*loss|sl)\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const tpMatch = lower.match(/(?:target|take[\s-]*profit|tp)\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const trailMatch = lower.match(/trailing\s*(?:stop|sl)?\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const dailyCapMatch = lower.match(/daily\s*(?:loss\s*)?(?:cap|limit)\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const stopLossPct = slMatch ? clampNum3(Number(slMatch[1]), 0.5, 30, 2) : 4;
  const takeProfitPct = tpMatch ? clampNum3(Number(tpMatch[1]), 1, 100, 2) : 10;
  const trailingStopPct = trailMatch ? clampNum3(Number(trailMatch[1]), 0.5, 30, 2) : 0;
  const dailyLossCapPct = dailyCapMatch ? clampNum3(Number(dailyCapMatch[1]), 0.5, 15, 2) : 2.5;
  let timeframe = "6mo";
  if (/\b1\s*y(?:ear|r)?\b/i.test(prompt)) timeframe = "1y";
  else if (/\b1\s*m(?:onth|o)?\b/i.test(prompt)) timeframe = "1mo";
  else if (/\b5\s*d(?:ay)?\b/i.test(prompt)) timeframe = "5d";
  else if (/\b1\s*d(?:ay)?\b|intraday/i.test(prompt)) timeframe = "1d";
  const resolvedSymbols = await resolvePromptSymbols([], prompt);
  const tickerList = resolvedSymbols.map((s) => s.replace(/\.(NS|BO)$/, "")).slice(0, 3).join(", ");
  const styleTag = lower.includes("momentum") || lower.includes("breakout") ? "Momentum Breakout" : lower.includes("dip") || lower.includes("oversold") || lower.includes("reversion") ? "Mean Reversion" : "Systematic Swing";
  return normalizeStrategyDraft(
    {
      name: `${tickerList} ${styleTag}`.slice(0, 100),
      summary: `Entry on ${entryConditions.map((c) => c.label).join(` ${lower.includes(" or ") ? "OR" : "AND"} `)} with ${stopLossPct}% stop-loss, ${takeProfitPct}% target, and ${dailyLossCapPct}% daily loss cap.`,
      timeframe,
      logicOperator: lower.includes(" or ") ? "OR" : "AND",
      entryConditions,
      exitConditions,
      virtualCapital: 1e6,
      allocationPercent: Math.round(100 / Math.min(Math.max(resolvedSymbols.length, 2), 5)),
      stopLossPct,
      takeProfitPct,
      trailingStopPct,
      maxOpenPositions: Math.min(Math.max(resolvedSymbols.length, 2), 5),
      dailyLossCapPct,
      slippageBps: 10
    },
    prompt,
    resolvedSymbols
  );
}
async function compileAlgoStrategyFromPrompt(prompt) {
  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length < 6) {
    throw new Error("Describe your algorithmic trading rules in at least a few words.");
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallback = await parsePromptDeterministic(cleanPrompt);
    return {
      strategy: fallback,
      analysisSource: "fallback_engine",
      quotaNotice: "GEMINI_API_KEY is not configured; compiled rules using the deterministic rule parser.",
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const ai = new GoogleGenAI5({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });
  const conditionSchema = {
    type: Type5.OBJECT,
    properties: {
      indicator: {
        type: Type5.STRING,
        description: "One of: RSI_14, PRICE_VS_SMA50, PRICE_VS_SMA200, EMA20_VS_SMA50, VOLUME_RATIO, DAY_CHANGE_PCT, SMA50_SLOPE_PCT"
      },
      comparator: {
        type: Type5.STRING,
        description: "One of: LT, LTE, GT, GTE, CROSS_ABOVE, CROSS_BELOW"
      },
      threshold: {
        type: Type5.NUMBER,
        description: "Numeric threshold: e.g. 35 for RSI_14 < 35, 0 for PRICE_VS_SMA200 > 0, 1.5 for VOLUME_RATIO > 1.5, -2 for DAY_CHANGE_PCT <= -2"
      }
    },
    required: ["indicator", "comparator", "threshold"]
  };
  const schema = {
    type: Type5.OBJECT,
    properties: {
      name: { type: Type5.STRING, description: "Concise strategy name (under 60 chars)" },
      summary: { type: Type5.STRING, description: "Clear 1-sentence strategy thesis and risk summary" },
      symbols: {
        type: Type5.ARRAY,
        items: { type: Type5.STRING },
        description: "NSE/BSE symbols (e.g. RELIANCE.NS, TCS.NS). Default 3-5 liquid Nifty stocks if none named."
      },
      timeframe: {
        type: Type5.STRING,
        description: "Backtest lookback range: one of 1d, 5d, 1mo, 6mo, 1y"
      },
      logicOperator: {
        type: Type5.STRING,
        description: "AND if all entryConditions must trigger together, OR if any suffices."
      },
      entryConditions: {
        type: Type5.ARRAY,
        items: conditionSchema
      },
      exitConditions: {
        type: Type5.ARRAY,
        items: conditionSchema
      },
      virtualCapital: { type: Type5.NUMBER, description: "Initial INR capital (e.g. 1000000)" },
      allocationPercent: { type: Type5.NUMBER, description: "Capital % per trade (5 to 100)" },
      stopLossPct: { type: Type5.NUMBER, description: "Hard stop-loss % (0.5 to 25)" },
      takeProfitPct: { type: Type5.NUMBER, description: "Target profit % (1 to 100)" },
      trailingStopPct: { type: Type5.NUMBER, description: "Optional trailing stop % (0 if disabled)" },
      maxOpenPositions: { type: Type5.NUMBER, description: "Max concurrent positions (1 to 10)" },
      dailyLossCapPct: { type: Type5.NUMBER, description: "Daily loss circuit-breaker % (0.5 to 15)" }
    },
    required: [
      "name",
      "summary",
      "symbols",
      "timeframe",
      "logicOperator",
      "entryConditions",
      "exitConditions",
      "virtualCapital",
      "allocationPercent",
      "stopLossPct",
      "takeProfitPct",
      "trailingStopPct",
      "maxOpenPositions",
      "dailyLossCapPct"
    ]
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
  const tryCompileModel = async (model, thinkingLevel) => {
    const response = await ai.models.generateContent({
      model,
      contents: `Compile this Indian stock trading strategy:
"${cleanPrompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig: { thinkingLevel }
      }
    });
    const text = (response.text ?? "{}").trim();
    return JSON.parse(text);
  };
  try {
    let rawDraft;
    try {
      rawDraft = await tryCompileModel("gemini-4-hydrogen", ThinkingLevel5.LOW);
    } catch (primaryErr) {
      if (isQuotaOrNetworkError(primaryErr)) {
        rawDraft = await tryCompileModel("gemini-3.1-flash-lite", ThinkingLevel5.MINIMAL);
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
      analysisSource: "gemini",
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (err) {
    if (isQuotaOrNetworkError(err)) {
      const fallback2 = await parsePromptDeterministic(cleanPrompt);
      return {
        strategy: fallback2,
        analysisSource: "fallback_engine",
        quotaNotice: ALGO_QUOTA_NOTICE,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const fallback = await parsePromptDeterministic(cleanPrompt);
    return {
      strategy: fallback,
      analysisSource: "fallback_engine",
      quotaNotice: "AI rule compiler fallback active; structured rules compiled deterministically.",
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function buildIndicatorSeries(bars) {
  const n = bars.length;
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const sma2 = (period) => {
    const out = new Array(n).fill(null);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += closes[i];
      if (i >= period) sum -= closes[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  };
  const ema20 = new Array(n).fill(null);
  const k = 2 / 21;
  let emaVal = null;
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
  const rsi14 = new Array(n).fill(null);
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
  const sma50 = sma2(50);
  const sma200 = sma2(200);
  const volumeRatio = new Array(n).fill(null);
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
  const dayChangePct = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    dayChangePct[i] = closes[i - 1] > 0 ? (closes[i] - closes[i - 1]) / closes[i - 1] * 100 : 0;
  }
  const sma50SlopePct = new Array(n).fill(null);
  for (let i = 5; i < n; i++) {
    const cur = sma50[i];
    const prev = sma50[i - 5];
    if (cur !== null && prev !== null && prev > 0) {
      sma50SlopePct[i] = (cur - prev) / prev * 100;
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
    sma50SlopePct
  };
}
function getMetricAtBar(series, idx, indicator) {
  if (idx < 0 || idx >= series.bars.length) return null;
  const close = series.bars[idx].close;
  switch (indicator) {
    case "RSI_14":
      return series.rsi14[idx];
    case "PRICE_VS_SMA50": {
      const m = series.sma50[idx];
      return m && m > 0 ? (close - m) / m * 100 : null;
    }
    case "PRICE_VS_SMA200": {
      const m = series.sma200[idx] ?? series.sma50[idx];
      return m && m > 0 ? (close - m) / m * 100 : null;
    }
    case "EMA20_VS_SMA50": {
      const e = series.ema20[idx];
      const s = series.sma50[idx];
      return e !== null && s !== null && s > 0 ? (e - s) / s * 100 : null;
    }
    case "VOLUME_RATIO":
      return series.volumeRatio[idx];
    case "DAY_CHANGE_PCT":
      return series.dayChangePct[idx];
    case "SMA50_SLOPE_PCT":
      return series.sma50SlopePct[idx];
    default:
      return null;
  }
}
function evaluateSingleCondition(series, idx, cond) {
  const curr = getMetricAtBar(series, idx, cond.indicator);
  if (curr === null) return false;
  const prev = idx > 0 ? getMetricAtBar(series, idx - 1, cond.indicator) : null;
  switch (cond.comparator) {
    case "LT":
      return curr < cond.threshold;
    case "LTE":
      return curr <= cond.threshold;
    case "GT":
      return curr > cond.threshold;
    case "GTE":
      return curr >= cond.threshold;
    case "CROSS_ABOVE":
      return prev !== null && prev <= cond.threshold && curr > cond.threshold;
    case "CROSS_BELOW":
      return prev !== null && prev >= cond.threshold && curr < cond.threshold;
    default:
      return false;
  }
}
function evaluateConditionGroup(series, idx, conditions, op) {
  if (conditions.length === 0) return false;
  if (op === "OR") {
    return conditions.some((c) => evaluateSingleCondition(series, idx, c));
  }
  return conditions.every((c) => evaluateSingleCondition(series, idx, c));
}
function getWarmupParams(timeframe) {
  switch (timeframe) {
    case "1d":
      return { fetchRange: "5d", fetchInterval: "5m", windowSeconds: 24 * 3600 };
    case "5d":
      return { fetchRange: "1mo", fetchInterval: "15m", windowSeconds: 5 * 24 * 3600 };
    case "1mo":
      return { fetchRange: "2y", fetchInterval: "1d", windowSeconds: 32 * 24 * 3600 };
    case "6mo":
      return { fetchRange: "2y", fetchInterval: "1d", windowSeconds: 185 * 24 * 3600 };
    case "1y":
    default:
      return { fetchRange: "2y", fetchInterval: "1d", windowSeconds: 368 * 24 * 3600 };
  }
}
async function runHistoricalBacktest(rawStrategy) {
  const symbols = Array.from(
    new Set(
      (rawStrategy.symbols || []).map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0)
    )
  ).slice(0, 10);
  if (symbols.length === 0) {
    throw new Error("Select at least one valid NSE/BSE symbol to run a historical backtest.");
  }
  const strategy = normalizeStrategyDraft(rawStrategy, rawStrategy.prompt || rawStrategy.name, symbols);
  const { fetchRange, fetchInterval, windowSeconds } = getWarmupParams(strategy.timeframe);
  const allFetchTargets = Array.from(/* @__PURE__ */ new Set([...symbols, "^NSEI"]));
  const rawSeriesEntries = await Promise.all(
    allFetchTargets.map(async (sym) => {
      const bars = await getRawOhlcvCandles(sym, fetchRange, fetchInterval);
      return { sym, bars };
    })
  );
  const seriesMap = /* @__PURE__ */ new Map();
  const timestampIndexMap = /* @__PURE__ */ new Map();
  for (const entry of rawSeriesEntries) {
    if (entry.bars.length < 15) continue;
    const indSeries = buildIndicatorSeries(entry.bars);
    seriesMap.set(entry.sym, indSeries);
    const tsMap = /* @__PURE__ */ new Map();
    entry.bars.forEach((b, idx) => tsMap.set(b.timestamp, idx));
    timestampIndexMap.set(entry.sym, tsMap);
  }
  const validSymbols = symbols.filter((s) => seriesMap.has(s));
  if (validSymbols.length === 0) {
    throw new Error(
      `Unable to load historical OHLCV bars for ${symbols.join(", ")}. Verify valid NSE (.NS) or BSE (.BO) tickers.`
    );
  }
  const allTimestampsSet = /* @__PURE__ */ new Set();
  let maxTs = 0;
  for (const sym of validSymbols) {
    const bars = seriesMap.get(sym).bars;
    for (const b of bars) {
      allTimestampsSet.add(b.timestamp);
      if (b.timestamp > maxTs) maxTs = b.timestamp;
    }
  }
  const windowStartTs = maxTs - windowSeconds;
  let timeline = Array.from(allTimestampsSet).filter((ts) => ts >= windowStartTs).sort((a, b) => a - b);
  if (strategy.timeframe === "1d" && timeline.length < 20) {
    const sortedAll = Array.from(allTimestampsSet).sort((a, b) => a - b);
    timeline = sortedAll.slice(-75);
  }
  if (timeline.length < 5) {
    throw new Error("Insufficient OHLCV bars in the requested timeframe to execute simulation.");
  }
  const niftySeries = seriesMap.get("^NSEI") ?? null;
  const niftyTsMap = timestampIndexMap.get("^NSEI") ?? null;
  let niftyFirstClose = null;
  let lastNiftyClose = null;
  let cash = strategy.virtualCapital;
  const slippageFrac = strategy.slippageBps / 1e4;
  const lastPriceBySymbol = /* @__PURE__ */ new Map();
  const openPositions = /* @__PURE__ */ new Map();
  const trades = [];
  const equityCurve = [];
  const guardrailEvents = [];
  let currentDay = "";
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
  const closePosition = (pos, rawExitPrice, exitDate, exitBarIdx, exitReason) => {
    const execExitPrice = Number((rawExitPrice * (1 - slippageFrac)).toFixed(2));
    const exitProceeds = pos.quantity * execExitPrice;
    const entryCost = pos.quantity * pos.entryPrice;
    const netPnl2 = Number((exitProceeds - entryCost).toFixed(2));
    const grossPnl = Number(((rawExitPrice - pos.entryPrice) * pos.quantity).toFixed(2));
    const pnlPct = entryCost > 0 ? Number((netPnl2 / entryCost * 100).toFixed(2)) : 0;
    cash += exitProceeds;
    openPositions.delete(pos.symbol);
    trades.push({
      id: `bt_${trades.length + 1}_${pos.symbol}`,
      symbol: pos.symbol,
      ticker: pos.symbol.replace(/\.(NS|BO)$/, ""),
      entryDate: pos.entryDate,
      exitDate,
      barsHeld: Math.max(1, exitBarIdx - pos.entryTimelineIdx),
      quantity: pos.quantity,
      entryPrice: pos.entryPrice,
      exitPrice: execExitPrice,
      grossPnl,
      netPnl: netPnl2,
      pnlPct,
      exitReason
    });
  };
  for (let tIdx = 0; tIdx < timeline.length; tIdx++) {
    const ts = timeline[tIdx];
    const barDateIst = getIstDateString(ts * 1e3);
    const dateLabel = formatIstLabel(ts, strategy.timeframe);
    for (const sym of validSymbols) {
      const sIdx = timestampIndexMap.get(sym)?.get(ts);
      if (sIdx !== void 0) {
        const bar = seriesMap.get(sym).bars[sIdx];
        lastPriceBySymbol.set(sym, bar.close);
      }
    }
    if (barDateIst !== currentDay) {
      currentDay = barDateIst;
      dayStartEquity = computeTotalEquity();
      haltedForDay = false;
    }
    for (const pos of Array.from(openPositions.values())) {
      const sIdx = timestampIndexMap.get(pos.symbol)?.get(ts);
      if (sIdx === void 0) continue;
      const series = seriesMap.get(pos.symbol);
      const bar = series.bars[sIdx];
      const trailingStop = strategy.trailingStopPct > 0 ? pos.highestPrice * (1 - strategy.trailingStopPct / 100) : 0;
      const effectiveStop = Math.max(pos.stopLossPrice, trailingStop);
      if (bar.low <= effectiveStop) {
        const fillPrice = Math.min(bar.open, effectiveStop);
        const reason = trailingStop > pos.stopLossPrice ? "TRAILING_STOP" : "STOP_LOSS";
        closePosition(pos, fillPrice, dateLabel, tIdx, reason);
        continue;
      }
      if (bar.high >= pos.targetPrice) {
        const fillPrice = Math.max(bar.open, pos.targetPrice);
        closePosition(pos, fillPrice, dateLabel, tIdx, "TARGET");
        continue;
      }
      if (bar.high > pos.highestPrice) {
        pos.highestPrice = bar.high;
      }
      if (evaluateConditionGroup(series, sIdx, strategy.exitConditions, "OR")) {
        closePosition(pos, bar.close, dateLabel, tIdx, "EXIT_SIGNAL");
      }
    }
    const midEquity = computeTotalEquity();
    const dayLossPct = dayStartEquity > 0 ? (dayStartEquity - midEquity) / dayStartEquity * 100 : 0;
    if (!haltedForDay && dayLossPct >= strategy.dailyLossCapPct) {
      haltedForDay = true;
      guardrailHaltsTriggered += 1;
      guardrailEvents.push({
        dateLabel,
        message: `Daily loss cap (-${strategy.dailyLossCapPct}%) triggered at -${dayLossPct.toFixed(
          2
        )}%; blocked new entries and flattened open risk.`
      });
      for (const pos of Array.from(openPositions.values())) {
        const p = lastPriceBySymbol.get(pos.symbol) ?? pos.entryPrice;
        closePosition(pos, p, dateLabel, tIdx, "DAILY_LOSS_CAP");
      }
    }
    if (!haltedForDay && openPositions.size < strategy.maxOpenPositions) {
      for (const sym of validSymbols) {
        if (openPositions.size >= strategy.maxOpenPositions) break;
        if (openPositions.has(sym)) continue;
        const sIdx = timestampIndexMap.get(sym)?.get(ts);
        if (sIdx === void 0) continue;
        const series = seriesMap.get(sym);
        const bar = series.bars[sIdx];
        const shouldEnter = evaluateConditionGroup(
          series,
          sIdx,
          strategy.entryConditions,
          strategy.logicOperator
        );
        if (!shouldEnter) continue;
        const currentEquity = computeTotalEquity();
        const targetBudget = Math.min(cash, currentEquity * strategy.allocationPercent / 100);
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
            targetPrice: Number((execEntryPrice * (1 + strategy.takeProfitPct / 100)).toFixed(2))
          });
        }
      }
    }
    const endBarEquity = computeTotalEquity();
    if (endBarEquity > peakEquity) peakEquity = endBarEquity;
    const ddPct = peakEquity > 0 ? -((peakEquity - endBarEquity) / peakEquity) * 100 : 0;
    if (Math.abs(ddPct) > maxDrawdownPct) maxDrawdownPct = Math.abs(ddPct);
    if (niftySeries && niftyTsMap) {
      const nIdx = niftyTsMap.get(ts);
      if (nIdx !== void 0) {
        const nc = niftySeries.bars[nIdx].close;
        if (niftyFirstClose === null) niftyFirstClose = nc;
        lastNiftyClose = nc;
      }
    }
    const benchEquity = niftyFirstClose && lastNiftyClose ? strategy.virtualCapital * (lastNiftyClose / niftyFirstClose) : strategy.virtualCapital;
    equityCurve.push({
      dateLabel,
      equity: Number(endBarEquity.toFixed(0)),
      benchmarkEquity: Number(benchEquity.toFixed(0)),
      equityIndexed: Number((endBarEquity / strategy.virtualCapital * 100).toFixed(2)),
      niftyIndexed: Number((benchEquity / strategy.virtualCapital * 100).toFixed(2)),
      drawdownPct: Number(ddPct.toFixed(2))
    });
  }
  const lastTs = timeline[timeline.length - 1];
  const lastDateLabel = formatIstLabel(lastTs, strategy.timeframe);
  for (const pos of Array.from(openPositions.values())) {
    const lastP = lastPriceBySymbol.get(pos.symbol) ?? pos.entryPrice;
    closePosition(pos, lastP, lastDateLabel, timeline.length - 1, "END_OF_WINDOW");
  }
  const finalEquity = Number(cash.toFixed(2));
  const netPnl = Number((finalEquity - strategy.virtualCapital).toFixed(2));
  const totalReturnPct = Number((netPnl / strategy.virtualCapital * 100).toFixed(2));
  const lastPoint = equityCurve[equityCurve.length - 1];
  if (lastPoint) {
    lastPoint.equity = Number(finalEquity.toFixed(0));
    lastPoint.equityIndexed = Number((finalEquity / strategy.virtualCapital * 100).toFixed(2));
  }
  const niftyReturnPct = niftyFirstClose && lastNiftyClose ? Number(((lastNiftyClose - niftyFirstClose) / niftyFirstClose * 100).toFixed(2)) : 0;
  const alphaPct = Number((totalReturnPct - niftyReturnPct).toFixed(2));
  const elapsedDays = Math.max(1, (timeline[timeline.length - 1] - timeline[0]) / 86400);
  const years = Math.max(elapsedDays / 365.25, 1 / 252);
  const cagrPct = years >= 0.08 && finalEquity > 0 ? Number(((Math.pow(finalEquity / strategy.virtualCapital, 1 / years) - 1) * 100).toFixed(2)) : totalReturnPct;
  const barReturns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEq = equityCurve[i - 1].equity;
    if (prevEq > 0) {
      barReturns.push((equityCurve[i].equity - prevEq) / prevEq);
    }
  }
  const barsPerYear = strategy.timeframe === "1d" ? 252 * 75 : strategy.timeframe === "5d" ? 252 * 25 : 252;
  let sharpeRatio = 0;
  if (barReturns.length > 2) {
    const mean2 = barReturns.reduce((a, b) => a + b, 0) / barReturns.length;
    const variance = barReturns.reduce((acc, r) => acc + Math.pow(r - mean2, 2), 0) / (barReturns.length - 1);
    const std = Math.sqrt(variance);
    if (std > 0) {
      sharpeRatio = Number(((mean2 - 0.065 / barsPerYear) / std * Math.sqrt(barsPerYear)).toFixed(2));
    }
  }
  const winningTrades = trades.filter((t) => t.netPnl > 0).length;
  const losingTrades = trades.filter((t) => t.netPnl <= 0).length;
  const totalTrades = trades.length;
  const winRatePct = totalTrades > 0 ? Number((winningTrades / totalTrades * 100).toFixed(1)) : 0;
  const grossWins = trades.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
  const grossLossesAbs = Math.abs(
    trades.filter((t) => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0)
  );
  const profitFactor = grossLossesAbs > 0 ? Number((grossWins / grossLossesAbs).toFixed(2)) : grossWins > 0 ? 9.99 : 0;
  const avgHoldingBars = totalTrades > 0 ? Number((trades.reduce((s, t) => s + t.barsHeld, 0) / totalTrades).toFixed(1)) : 0;
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
      avgHoldingBars
    },
    equityCurve,
    trades: trades.slice().reverse(),
    guardrailEvents,
    ranAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function reconstructStrategyBook(strategy, orders, todayDateIst) {
  const stratOrders = orders.filter((o) => o.strategyId === strategy.id && o.status === "FILLED").sort((a, b) => (a.executedAtIso || "").localeCompare(b.executedAtIso || ""));
  let cash = strategy.virtualCapital;
  let realizedPnlTotal = 0;
  let todayRealizedPnl = 0;
  const positions = /* @__PURE__ */ new Map();
  for (const ord of stratOrders) {
    const sym = ord.symbol.toUpperCase();
    if (ord.side === "BUY") {
      cash -= ord.notionalValue;
      const prev = positions.get(sym);
      if (!prev) {
        positions.set(sym, {
          symbol: sym,
          quantity: ord.quantity,
          avgEntryPrice: ord.price,
          enteredAtIso: ord.executedAtIso
        });
      } else {
        const newQty = prev.quantity + ord.quantity;
        const totalCost = prev.quantity * prev.avgEntryPrice + ord.notionalValue;
        positions.set(sym, {
          symbol: sym,
          quantity: newQty,
          avgEntryPrice: newQty > 0 ? Number((totalCost / newQty).toFixed(2)) : ord.price,
          enteredAtIso: prev.enteredAtIso
        });
      }
    } else if (ord.side === "SELL") {
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
    positions
  };
}
async function evaluateLivePaperStrategies(strategies, existingOrders) {
  const todayIst = getIstDateString();
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const allSymbolsSet = /* @__PURE__ */ new Set();
  for (const st of strategies) {
    for (const s of st.symbols) allSymbolsSet.add(s.toUpperCase());
  }
  for (const o of existingOrders) {
    if (o.symbol) allSymbolsSet.add(o.symbol.toUpperCase());
  }
  const allSymbols = Array.from(allSymbolsSet);
  const quotes = allSymbols.length > 0 ? await getQuotes(allSymbols) : {};
  const activeSymbols = Array.from(
    new Set(
      strategies.filter((s) => s.status === "ACTIVE").flatMap((s) => s.symbols.map((sym) => sym.toUpperCase()))
    )
  );
  const indicatorBySymbol = /* @__PURE__ */ new Map();
  await Promise.all(
    activeSymbols.map(async (sym) => {
      const bars = await getRawOhlcvCandles(sym, "1y", "1d");
      if (bars.length >= 20) {
        indicatorBySymbol.set(sym, buildIndicatorSeries(bars));
      }
    })
  );
  const newOrders = [];
  const strategyStatusUpdates = [];
  const openPositions = [];
  const strategyTelemetry = [];
  for (const strategy of strategies) {
    const book = reconstructStrategyBook(strategy, existingOrders, todayIst);
    let investedCapital = 0;
    let todayUnrealizedPnl = 0;
    const openPosList = Array.from(book.positions.values());
    for (const pos of openPosList) {
      const liveQuote = quotes[pos.symbol];
      const livePrice = liveQuote?.price ?? pos.avgEntryPrice;
      const investedValue = pos.quantity * pos.avgEntryPrice;
      const marketValue = pos.quantity * livePrice;
      const unrealizedPnl = Number((marketValue - investedValue).toFixed(2));
      const unrealizedPnlPct = investedValue > 0 ? Number((unrealizedPnl / investedValue * 100).toFixed(2)) : 0;
      const stopLossPrice = Number((pos.avgEntryPrice * (1 - strategy.stopLossPct / 100)).toFixed(2));
      const targetPrice = Number((pos.avgEntryPrice * (1 + strategy.takeProfitPct / 100)).toFixed(2));
      let closedThisTick = false;
      if (strategy.status === "ACTIVE") {
        const indSeries = indicatorBySymbol.get(pos.symbol);
        const exitSignalHit = indSeries && evaluateConditionGroup(
          indSeries,
          indSeries.bars.length - 1,
          strategy.exitConditions,
          "OR"
        );
        let sellReason = null;
        if (livePrice <= stopLossPrice) {
          sellReason = `Stop-loss hit at \u20B9${livePrice} (SL \u20B9${stopLossPrice})`;
        } else if (livePrice >= targetPrice) {
          sellReason = `Target profit reached at \u20B9${livePrice} (Target \u20B9${targetPrice})`;
        } else if (exitSignalHit) {
          sellReason = `Exit technical condition matched at \u20B9${livePrice}`;
        }
        if (sellReason) {
          closedThisTick = true;
          const execSellPrice = Number(
            (livePrice * (1 - strategy.slippageBps / 1e4)).toFixed(2)
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
            side: "SELL",
            status: "FILLED",
            quantity: pos.quantity,
            price: execSellPrice,
            notionalValue: proceeds,
            realizedPnl: realized,
            triggerReason: sellReason,
            executedAtIso: nowIso,
            tradingDate: todayIst
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
          ticker: pos.symbol.replace(/\.(NS|BO)$/, ""),
          quantity: pos.quantity,
          avgEntryPrice: pos.avgEntryPrice,
          livePrice,
          investedValue: Number(investedValue.toFixed(2)),
          marketValue: Number(marketValue.toFixed(2)),
          unrealizedPnl,
          unrealizedPnlPct,
          stopLossPrice,
          targetPrice,
          enteredAtIso: pos.enteredAtIso
        });
      }
    }
    const todayTotalPnl = Number((book.todayRealizedPnl + todayUnrealizedPnl).toFixed(2));
    const todayLossPct = todayTotalPnl < 0 && strategy.virtualCapital > 0 ? Number((Math.abs(todayTotalPnl) / strategy.virtualCapital * 100).toFixed(2)) : 0;
    const dailyCapBreached = todayLossPct >= strategy.dailyLossCapPct;
    let currentOpenCount = openPositions.filter((p) => p.strategyId === strategy.id).length;
    if (strategy.status === "ACTIVE" && dailyCapBreached) {
      strategyStatusUpdates.push({
        strategyId: strategy.id,
        status: "PAUSED_RISK_CAP",
        reason: `Daily loss -${todayLossPct.toFixed(2)}% reached circuit-breaker cap (-${strategy.dailyLossCapPct}%).`
      });
      const fallbackSym = strategy.symbols[0] || "RELIANCE.NS";
      const fallbackPrice = quotes[fallbackSym]?.price ?? 1e3;
      newOrders.push({
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: fallbackSym,
        side: "BUY",
        status: "BLOCKED_RISK_CAP",
        quantity: 0,
        price: fallbackPrice,
        notionalValue: 0,
        realizedPnl: 0,
        triggerReason: `Daily loss cap (-${strategy.dailyLossCapPct}%) breached; bot auto-paused.`,
        executedAtIso: nowIso,
        tradingDate: todayIst
      });
    } else if (strategy.status === "ACTIVE") {
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
        const budget = Math.min(book.cash, totalEquity * strategy.allocationPercent / 100);
        const execBuyPrice = Number(
          (liveQuote.price * (1 + strategy.slippageBps / 1e4)).toFixed(2)
        );
        const qty = Math.floor(budget / execBuyPrice);
        if (qty < 1) {
          newOrders.push({
            strategyId: strategy.id,
            strategyName: strategy.name,
            symbol: sym,
            side: "BUY",
            status: "BLOCKED_FUNDS",
            quantity: 0,
            price: execBuyPrice,
            notionalValue: 0,
            realizedPnl: 0,
            triggerReason: `Entry signal triggered at \u20B9${execBuyPrice}, insufficient virtual cash (\u20B9${Math.round(book.cash)}).`,
            executedAtIso: nowIso,
            tradingDate: todayIst
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
          side: "BUY",
          status: "FILLED",
          quantity: qty,
          price: execBuyPrice,
          notionalValue: notional,
          realizedPnl: 0,
          triggerReason: `Entry rule matched: ${strategy.entryConditions.map((c) => c.label).join(` ${strategy.logicOperator} `)}`,
          executedAtIso: nowIso,
          tradingDate: todayIst
        });
        openPositions.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: sym,
          ticker: sym.replace(/\.(NS|BO)$/, ""),
          quantity: qty,
          avgEntryPrice: execBuyPrice,
          livePrice: liveQuote.price,
          investedValue: notional,
          marketValue: Number((qty * liveQuote.price).toFixed(2)),
          unrealizedPnl: Number(((liveQuote.price - execBuyPrice) * qty).toFixed(2)),
          unrealizedPnlPct: Number(((liveQuote.price - execBuyPrice) / execBuyPrice * 100).toFixed(2)),
          stopLossPrice: Number((execBuyPrice * (1 - strategy.stopLossPct / 100)).toFixed(2)),
          targetPrice: Number((execBuyPrice * (1 + strategy.takeProfitPct / 100)).toFixed(2)),
          enteredAtIso: nowIso
        });
      }
    }
    strategyTelemetry.push({
      strategyId: strategy.id,
      strategyName: strategy.name,
      status: dailyCapBreached && strategy.status === "ACTIVE" ? "PAUSED_RISK_CAP" : strategy.status,
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
      maxOpenPositions: strategy.maxOpenPositions
    });
  }
  return {
    newOrders,
    strategyStatusUpdates,
    openPositions,
    strategyTelemetry,
    evaluatedAt: nowIso
  };
}

// server/apiApp.ts
dotenv.config();
var VALID_RANGES = /* @__PURE__ */ new Set(["1d", "5d", "1mo", "6mo", "1y", "3y", "5y", "max"]);
function formatRouteError(err, fallback) {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/429|RESOURCE_EXHAUSTED|quota|rate[-_\s]?limit|retryDelay/i.test(raw)) {
    return "Gemini free-tier daily quota (20 requests/day) reached. Use Zerodha Kite / Coin CSV upload (uses 0 AI quota), or add a billing-enabled Gemini API key in Settings > Secrets.";
  }
  return raw || fallback;
}
function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "64mb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/market/quotes", async (req, res) => {
    try {
      const raw = String(req.query.symbols ?? "");
      const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 250);
      if (symbols.length === 0) {
        res.json({ quotes: {} });
        return;
      }
      const quotes = await getQuotes(symbols);
      res.json({ quotes, fetchedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (error) {
      console.error("Quotes endpoint error:", error);
      res.status(500).json({ error: "Failed to fetch market quotes." });
    }
  });
  app.get("/api/market/chart/:symbol", async (req, res) => {
    try {
      const symbol = decodeURIComponent(req.params.symbol || "");
      const requestedRange = String(req.query.range ?? "6mo");
      const range = VALID_RANGES.has(requestedRange) ? requestedRange : "6mo";
      const data = await getChart(symbol, range);
      if (!data) {
        res.status(404).json({ error: `No chart data found for ${symbol}` });
        return;
      }
      res.json(data);
    } catch (error) {
      console.error("Chart endpoint error:", error);
      res.status(500).json({ error: "Failed to fetch chart history." });
    }
  });
  app.get("/api/market/search", async (req, res) => {
    try {
      const q = String(req.query.q ?? "");
      const results = await searchIndianStocks(q);
      res.json({ results });
    } catch (error) {
      console.error("Search endpoint error:", error);
      res.status(500).json({ error: "Failed to search Indian equities." });
    }
  });
  app.get("/api/market/screener", async (_req, res) => {
    try {
      const stocks = await getEnrichedScreenerUniverse();
      res.json({ stocks, fetchedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (error) {
      console.error("Screener endpoint error:", error);
      res.status(500).json({ error: "Failed to load screener data." });
    }
  });
  app.get("/api/market/patterns", async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
      const data = await getPatternDiscoveryHub(forceRefresh);
      res.json(data);
    } catch (error) {
      console.error("Patterns discovery endpoint error:", error);
      res.status(500).json({ error: "Failed to compute pattern discovery & walk-forward stats." });
    }
  });
  app.get("/api/market/signals", async (_req, res) => {
    try {
      const signals = await getEnrichedResearchSignals();
      res.json({ signals, fetchedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (error) {
      console.error("Signals endpoint error:", error);
      res.status(500).json({ error: "Failed to load research signals." });
    }
  });
  app.get("/api/market/ai-outlook/:symbol", async (req, res) => {
    try {
      const symbol = decodeURIComponent(req.params.symbol || "").trim();
      if (!symbol) {
        res.status(400).json({ error: "A valid market symbol is required." });
        return;
      }
      const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
      const outlook = await analyzeSingleSymbolOutlook(symbol, { forceRefresh });
      res.json(outlook);
    } catch (error) {
      console.error("Symbol AI outlook endpoint error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate AI outlook for symbol.";
      const status = /no live market quote available/i.test(message) ? 404 : 500;
      res.status(status).json({
        error: status === 404 ? message : formatRouteError(error, message)
      });
    }
  });
  app.get("/api/strategies", async (_req, res) => {
    try {
      const data = await getAiStrategyBaskets();
      res.json(data);
    } catch (error) {
      console.error("AI strategies endpoint error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to load AI stock strategies.")
      });
    }
  });
  app.post("/api/algo/compile", async (req, res) => {
    try {
      const body = req.body;
      const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
      if (prompt.length < 6) {
        res.status(400).json({
          error: "Describe your trading rules in plain English (e.g. RSI, moving averages, stop-loss, and target)."
        });
        return;
      }
      const compiled = await compileAlgoStrategyFromPrompt(prompt);
      res.json(compiled);
    } catch (error) {
      console.error("Algo compile endpoint error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to compile algorithmic strategy rules.")
      });
    }
  });
  app.post("/api/algo/backtest", async (req, res) => {
    try {
      const body = req.body;
      if (!body?.strategy || !Array.isArray(body.strategy.symbols) || body.strategy.symbols.length === 0) {
        res.status(400).json({
          error: "Strategy parameters and at least one target NSE/BSE symbol are required."
        });
        return;
      }
      const result = await runHistoricalBacktest(body.strategy);
      res.json(result);
    } catch (error) {
      console.error("Algo backtest endpoint error:", error);
      const message = error instanceof Error ? error.message : "Failed to run historical backtest.";
      res.status(400).json({ error: message });
    }
  });
  app.post("/api/algo/paper-evaluate", async (req, res) => {
    try {
      const body = req.body;
      const strategies = Array.isArray(body?.strategies) ? body.strategies.slice(0, 50) : [];
      const orders = Array.isArray(body?.orders) ? body.orders.slice(0, 500) : [];
      if (strategies.length === 0) {
        res.json({
          newOrders: [],
          strategyStatusUpdates: [],
          openPositions: [],
          strategyTelemetry: [],
          evaluatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        return;
      }
      const evaluation = await evaluateLivePaperStrategies(strategies, orders);
      res.json(evaluation);
    } catch (error) {
      console.error("Algo paper-evaluate endpoint error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to evaluate live paper-trading strategies.")
      });
    }
  });
  app.post("/api/portfolio/parse-screenshot", async (req, res) => {
    try {
      const body = req.body;
      const images = Array.isArray(body?.images) ? body.images : [];
      if (images.length === 0 || images.length > 15) {
        res.status(400).json({ error: "Please upload between 1 and 15 portfolio screenshots." });
        return;
      }
      const validImages = images.filter(
        (img) => typeof img.data === "string" && img.data.length > 20
      );
      if (validImages.length === 0) {
        res.status(400).json({ error: "Uploaded screenshot payload is invalid." });
        return;
      }
      const parsed = await parsePortfolioScreenshots(validImages);
      res.json(parsed);
    } catch (error) {
      console.error("Screenshot parse error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to parse portfolio screenshot.")
      });
    }
  });
  app.post("/api/portfolio/parse-csv", async (req, res) => {
    try {
      const body = req.body;
      const csvText = typeof body?.csvText === "string" ? body.csvText : "";
      if (csvText.trim().length < 10) {
        res.status(400).json({ error: "Please upload a valid Zerodha Kite or broker CSV file." });
        return;
      }
      const parsed = await parseStockPortfolioCsv(csvText, body?.fileName);
      res.json(parsed);
    } catch (error) {
      console.error("Stock CSV parse error:", error);
      const message = error instanceof Error ? error.message : "Failed to parse equity CSV file.";
      res.status(400).json({ error: message });
    }
  });
  app.post("/api/portfolio/analyze", async (req, res) => {
    try {
      const body = req.body;
      const holdings = Array.isArray(body?.holdings) ? body.holdings.slice(0, 250) : [];
      if (holdings.length === 0) {
        res.status(400).json({ error: "At least one holding is required for AI analysis." });
        return;
      }
      const analysis = await analyzePortfolioHoldings(holdings, {
        totalPortfolioValue: typeof body?.totalPortfolioValue === "number" ? body.totalPortfolioValue : void 0,
        skipPortfolioSummary: Boolean(body?.skipPortfolioSummary)
      });
      res.json(analysis);
    } catch (error) {
      console.error("Portfolio AI analysis error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to evaluate portfolio holdings.")
      });
    }
  });
  app.post("/api/portfolio/rotation", async (req, res) => {
    try {
      const body = req.body;
      const holdings = Array.isArray(body?.holdings) ? body.holdings.slice(0, 250) : [];
      if (holdings.length === 0) {
        res.status(400).json({
          error: "At least one equity holding is required to scan Smart Capital Rotation."
        });
        return;
      }
      const rotation = await generateCapitalRotation(holdings);
      res.json(rotation);
    } catch (error) {
      console.error("Capital rotation endpoint error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to compute Smart Capital Rotation.")
      });
    }
  });
  app.get("/api/mf/search", async (req, res) => {
    try {
      const q = String(req.query.q ?? "");
      const results = await searchMutualFunds(q);
      res.json({ results });
    } catch (error) {
      console.error("MF search endpoint error:", error);
      res.status(500).json({ error: "Failed to search AMFI mutual fund schemes." });
    }
  });
  app.post("/api/mf/analyze", async (req, res) => {
    try {
      const body = req.body;
      const holdings = Array.isArray(body?.holdings) ? body.holdings.slice(0, 250) : [];
      const result = await analyzeMutualFundPortfolio({
        holdings,
        taxSlabPct: typeof body?.taxSlabPct === "number" ? body.taxSlabPct : 30,
        ltcgExemptionRemaining: typeof body?.ltcgExemptionRemaining === "number" ? body.ltcgExemptionRemaining : 125e3
      });
      res.json(result);
    } catch (error) {
      console.error("MF analyze endpoint error:", error);
      const message = error instanceof Error ? error.message : "Failed to analyze mutual fund holdings.";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/mf/parse-import", async (req, res) => {
    try {
      const body = req.body;
      const files = Array.isArray(body?.files) ? body.files.slice(0, 15) : [];
      const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
      if (files.length === 0 && rawText.length < 15) {
        res.status(400).json({
          error: "Upload up to 15 screenshots or a CAS PDF, or paste your CAS summary text."
        });
        return;
      }
      const validFiles = files.filter((f) => typeof f.data === "string" && f.data.length > 20);
      const parsed = await parseMutualFundImport({ files: validFiles, rawText });
      res.json(parsed);
    } catch (error) {
      console.error("MF parse-import endpoint error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to parse mutual fund statement.")
      });
    }
  });
  app.post("/api/mf/parse-csv", async (req, res) => {
    try {
      const body = req.body;
      const csvText = typeof body?.csvText === "string" ? body.csvText : "";
      if (csvText.trim().length < 10) {
        res.status(400).json({
          error: "Please upload a valid Zerodha Coin / Kite Mutual Fund CSV file."
        });
        return;
      }
      const parsed = await parseMutualFundCsv(csvText, body?.fileName);
      res.json(parsed);
    } catch (error) {
      console.error("MF CSV parse error:", error);
      const message = error instanceof Error ? error.message : "Failed to parse mutual fund CSV file.";
      res.status(400).json({ error: message });
    }
  });
  app.post("/api/mf/ai-switch-advice", async (req, res) => {
    try {
      const body = req.body;
      const funds = Array.isArray(body?.funds) ? body.funds.slice(0, 250) : [];
      if (funds.length === 0 || !body?.summary) {
        res.status(400).json({ error: "Analyzed mutual fund data is required." });
        return;
      }
      const advice = await generateMfSwitchAdvice({
        funds,
        summary: body.summary
      });
      res.json(advice);
    } catch (error) {
      console.error("MF AI switch advice error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to generate AI switch strategy.")
      });
    }
  });
  app.post("/api/backtest/run", async (req, res) => {
    try {
      const body = req.body ?? {};
      const validUniverse = /* @__PURE__ */ new Set(["portfolio_plus_flagship", "flagship", "portfolio_only"]);
      const validFreq = /* @__PURE__ */ new Set(["monthly", "biweekly", "weekly"]);
      const payload = {
        universeMode: body.universeMode && validUniverse.has(body.universeMode) ? body.universeMode : "portfolio_plus_flagship",
        portfolioSymbols: Array.isArray(body.portfolioSymbols) ? body.portfolioSymbols.map((s) => String(s)).slice(0, 30) : [],
        customSymbols: Array.isArray(body.customSymbols) ? body.customSymbols.map((s) => String(s)).slice(0, 30) : [],
        costBps: typeof body.costBps === "number" && Number.isFinite(body.costBps) ? Math.max(0, Math.min(100, body.costBps)) : 15,
        samplingFrequency: body.samplingFrequency && validFreq.has(body.samplingFrequency) ? body.samplingFrequency : "monthly",
        maxConcurrentPositions: typeof body.maxConcurrentPositions === "number" && Number.isFinite(body.maxConcurrentPositions) ? Math.max(3, Math.min(20, Math.round(body.maxConcurrentPositions))) : 10
      };
      const result = await run10YearBacktest(payload);
      res.json(result);
    } catch (error) {
      console.error("10Y backtest run endpoint error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to run 10-year historical backtest.")
      });
    }
  });
  app.get("/api/backtest/baseline", async (_req, res) => {
    try {
      const result = await ensureBaselineBacktest();
      if (!result) {
        res.status(503).json({ error: "Unable to compute flagship 10-year baseline backtest." });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error("10Y baseline endpoint error:", error);
      res.status(500).json({
        error: formatRouteError(error, "Failed to load baseline 10-year backtest.")
      });
    }
  });
  app.get("/api/backtest/calibration/:symbol", async (req, res) => {
    try {
      const symbol = decodeURIComponent(req.params.symbol || "").trim();
      if (!symbol) {
        res.status(400).json({ error: "A valid stock symbol is required." });
        return;
      }
      const rawConf = Number(req.query.confidence ?? 65);
      const calibration = await getLiveCalibrationForSymbol({
        symbol,
        rawConfidence: Number.isFinite(rawConf) ? rawConf : 65,
        waitMs: 12e3
      });
      res.json({ calibration });
    } catch (error) {
      console.error("Calibration lookup error:", error);
      res.status(500).json({ error: "Failed to retrieve historical calibration." });
    }
  });
  app.get("/api/backtest/self-test", (_req, res) => {
    const report = runDeterministicValidationSuite();
    res.json(report);
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found." });
  });
  return app;
}

// server.ts
dotenv2.config();
var PORT = Number(process.env.PORT) || 3e3;
async function startServer() {
  const app = createApiApp();
  const distPath = path.resolve(process.cwd(), "dist");
  const distIndexPath = path.join(distPath, "index.html");
  const runningCompiledServer = Boolean(process.argv[1]?.endsWith("server.js"));
  const serveBuiltAssets = process.env.NODE_ENV === "production" || runningCompiledServer && fs.existsSync(distIndexPath);
  if (serveBuiltAssets) {
    app.use(express2.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(distIndexPath);
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Stoxify server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Fatal server startup error:", err);
  process.exit(1);
});
