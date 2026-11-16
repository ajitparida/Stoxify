import { resolveSymbolForScreenshot } from './marketService.ts';
import { resolveAmfiMatch } from './mutualFundAiService.ts';
import type {
  Exchange,
  MutualFundImportParseResponse,
  ParsedMutualFundImportRow,
  ParsedScreenshotHolding,
  ScreenshotParseResponse,
} from '../src/types/market.ts';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
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

function detectDelimiter(text: string): ',' | '\t' | ';' {
  const sampleLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
  const sample = sampleLines.join('\n');
  const commaCount = (sample.match(/,/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  if (tabCount > commaCount && tabCount >= semiCount) return '\t';
  if (semiCount > commaCount && commaCount === 0) return ';';
  return ',';
}

export function parseCsvGrid(rawInput: string): string[][] {
  const text = stripBom(rawInput || '').trim();
  if (!text) return [];
  const delimiter = detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
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
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else if (ch !== '\r') {
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

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/\(₹\)|\(inr\)|\(rs\.?\)/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseIndianNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[₹,\s%]/g, '')
    .replace(/^(rs\.?|inr)/i, '')
    .trim();
  if (!cleaned || cleaned === '-' || cleaned === '--' || cleaned === 'N/A') return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseIsoOrIndianDate(raw: string | undefined): string {
  const s = (raw || '').trim();
  if (!s) return new Date(Date.now() - 420 * 86400000).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const mon = dmy[2].padStart(2, '0');
    const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yr}-${mon}-${day}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date(Date.now() - 420 * 86400000).toISOString().slice(0, 10);
}

function findColumnIndex(headers: string[], aliases: string[]): number {
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

function isSummaryOrTotalRow(nameValue: string): boolean {
  const norm = nameValue.trim().toLowerCase();
  return !norm || norm === 'total' || norm === 'grand total' || norm.startsWith('total ');
}

function cleanKiteTicker(rawInstrument: string): string {
  return rawInstrument
    .trim()
    .toUpperCase()
    .replace(/^(NSE|BSE)\s*[:/-]\s*/i, '')
    .replace(/-(EQ|BE|BZ|SM|ST|GC|GS|T2T)$/i, '')
    .trim();
}

export async function parseStockPortfolioCsv(
  csvText: string,
  fileName?: string
): Promise<ScreenshotParseResponse> {
  const grid = parseCsvGrid(csvText);
  if (grid.length < 2) {
    throw new Error('The CSV file is empty or missing data rows.');
  }

  // Locate actual table header row within first 12 rows (handles Kite Console metadata preambles)
  let headerRowIdx = -1;
  let normalizedHeaders: string[] = [];

  for (let i = 0; i < Math.min(grid.length, 12); i++) {
    const norm = grid[i].map(normalizeHeaderKey);
    const hasSymbolCol =
      findColumnIndex(norm, [
        'instrument',
        'symbol',
        'trading symbol',
        'tradingsymbol',
        'stock name',
        'stock',
        'company',
        'scrip',
      ]) !== -1;
    const hasQtyCol =
      findColumnIndex(norm, [
        'qty',
        'quantity',
        'quantity available',
        'net qty',
        'shares',
      ]) !== -1;
    const hasAvgCol =
      findColumnIndex(norm, [
        'avg cost',
        'average price',
        'avg price',
        'avg buy',
        'buy price',
        'avg',
      ]) !== -1;

    if (hasSymbolCol && (hasQtyCol || hasAvgCol)) {
      headerRowIdx = i;
      normalizedHeaders = norm;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error(
      'Could not find Zerodha Kite CSV headers (expected Instrument/Symbol, Qty., and Avg. cost columns).'
    );
  }

  const symbolIdx = findColumnIndex(normalizedHeaders, [
    'instrument',
    'trading symbol',
    'tradingsymbol',
    'symbol',
    'scrip',
    'stock name',
    'stock',
  ]);
  const companyIdx = findColumnIndex(normalizedHeaders, ['company', 'company name', 'name']);
  const qtyIdx = findColumnIndex(normalizedHeaders, [
    'qty',
    'quantity available',
    'net qty',
    'quantity',
    'shares',
  ]);
  const avgIdx = findColumnIndex(normalizedHeaders, [
    'avg cost',
    'average price',
    'avg price',
    'avg buy',
    'buy price',
    'cost price',
    'avg',
  ]);
  const ltpIdx = findColumnIndex(normalizedHeaders, [
    'ltp',
    'last price',
    'live price',
    'previous closing price',
    'close price',
  ]);
  const exchangeIdx = findColumnIndex(normalizedHeaders, ['exchange', 'exch']);
  const investedIdx = findColumnIndex(normalizedHeaders, [
    'invested',
    'invested amount',
    'buy value',
  ]);
  const isinIdx = findColumnIndex(normalizedHeaders, ['isin']);

  const warnings: string[] = [];
  const dataRows = grid.slice(headerRowIdx + 1);

  interface RawCsvStockRow {
    rawName: string;
    guessedSymbol: string;
    exchange: Exchange;
    quantity: number;
    avgBuyPrice: number;
    ltp: number;
    isin: string;
  }

  const extracted: RawCsvStockRow[] = [];

  for (const row of dataRows) {
    const rawSym = symbolIdx >= 0 ? (row[symbolIdx] || '').trim() : '';
    const rawCompany = companyIdx >= 0 ? (row[companyIdx] || '').trim() : '';
    const label = rawSym || rawCompany;
    if (isSummaryOrTotalRow(label)) continue;

    // Skip Mutual Fund / Sovereign Gold Bond / T-Bill lines if mixed inside a consolidated sheet
    const isin = isinIdx >= 0 ? (row[isinIdx] || '').trim().toUpperCase() : '';
    if (isin.startsWith('INF')) {
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

    const rawExchange = exchangeIdx >= 0 ? (row[exchangeIdx] || '').trim().toUpperCase() : '';
    const cleanedTicker = cleanKiteTicker(rawSym || rawCompany);
    const exchange: Exchange =
      rawExchange === 'BSE' || rawSym.toUpperCase().startsWith('BSE:') || /^\d{5,6}$/.test(cleanedTicker)
        ? 'BSE'
        : 'NSE';

    extracted.push({
      rawName: rawCompany && rawSym ? `${rawCompany} (${rawSym})` : label,
      guessedSymbol: cleanedTicker,
      exchange,
      quantity: Number(qty),
      avgBuyPrice: Number(avgBuy.toFixed(2)),
      ltp: ltp > 0 ? Number(ltp.toFixed(2)) : 0,
      isin,
    });
  }

  if (extracted.length === 0) {
    throw new Error('No valid equity rows with positive Quantity and Avg. cost were found in the CSV.');
  }

  const resolvedList: ParsedScreenshotHolding[] = await mapWithConcurrency(
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
      const priceDeviationPct =
        csvLtp && livePrice
          ? Number((((livePrice - csvLtp) / csvLtp) * 100).toFixed(2))
          : null;

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
        confidence: resolved.quote ? 'high' : 'low',
        notes: item.isin ? `CSV Import · ISIN ${item.isin}` : 'Zerodha Kite / Broker CSV Import',
      };
    }
  );

  if (extracted.length > 250) {
    warnings.push(`Imported first 250 equity rows from ${fileName || 'CSV'} (${extracted.length} total rows).`);
  }

  const isKiteFormat =
    normalizedHeaders.includes('instrument') &&
    (normalizedHeaders.includes('avg cost') || normalizedHeaders.includes('cur val'));

  return {
    brokerDetected: isKiteFormat ? 'Zerodha Kite CSV' : 'Broker CSV Export',
    holdings: resolvedList,
    warnings,
  };
}

export async function parseMutualFundCsv(
  csvText: string,
  fileName?: string
): Promise<MutualFundImportParseResponse> {
  const grid = parseCsvGrid(csvText);
  if (grid.length < 2) {
    throw new Error('The CSV file is empty or missing mutual fund rows.');
  }

  let headerRowIdx = -1;
  let normalizedHeaders: string[] = [];

  for (let i = 0; i < Math.min(grid.length, 12); i++) {
    const norm = grid[i].map(normalizeHeaderKey);
    const hasSchemeCol =
      findColumnIndex(norm, [
        'instrument',
        'scheme name',
        'fund name',
        'scheme',
        'fund',
        'symbol',
      ]) !== -1;
    const hasUnitsOrValCol =
      findColumnIndex(norm, [
        'qty',
        'units',
        'quantity',
        'quantity available',
        'cur val',
        'current value',
        'invested',
        'invested amount',
      ]) !== -1;

    if (hasSchemeCol && hasUnitsOrValCol) {
      headerRowIdx = i;
      normalizedHeaders = norm;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error(
      'Could not find Mutual Fund CSV headers (expected Instrument/Scheme Name, Qty./Units, and Avg. cost/Avg NAV columns).'
    );
  }

  const schemeIdx = findColumnIndex(normalizedHeaders, [
    'scheme name',
    'fund name',
    'instrument',
    'scheme',
    'fund',
    'symbol',
  ]);
  const unitsIdx = findColumnIndex(normalizedHeaders, [
    'units',
    'qty',
    'quantity available',
    'quantity',
  ]);
  const avgNavIdx = findColumnIndex(normalizedHeaders, [
    'avg cost',
    'avg nav',
    'average price',
    'avg price',
    'purchase price',
    'purchase nav',
    'cost nav',
  ]);
  const ltpNavIdx = findColumnIndex(normalizedHeaders, [
    'ltp',
    'latest nav',
    'current nav',
    'nav',
    'previous closing price',
  ]);
  const investedIdx = findColumnIndex(normalizedHeaders, [
    'invested',
    'invested amount',
    'invested value',
    'investment',
    'cost value',
    'buy value',
  ]);
  const curValIdx = findColumnIndex(normalizedHeaders, [
    'cur val',
    'current value',
    'present value',
    'market value',
  ]);
  const planIdx = findColumnIndex(normalizedHeaders, ['plan', 'plan type']);
  const optionIdx = findColumnIndex(normalizedHeaders, ['option', 'option type']);
  const folioIdx = findColumnIndex(normalizedHeaders, ['folio', 'folio no', 'folio number']);
  const dateIdx = findColumnIndex(normalizedHeaders, ['purchase date', 'date', 'start date']);
  const sipIdx = findColumnIndex(normalizedHeaders, ['sip', 'is sip', 'monthly sip']);

  const warnings: string[] = [];
  const dataRows = grid.slice(headerRowIdx + 1);

  interface RawCsvMfRow {
    rawSchemeName: string;
    units: number;
    avgNav: number;
    latestNavShown: number;
    investedAmount: number;
    currentValue: number;
    planCell: string;
    optionCell: string;
    folioNumber: string;
    purchaseDate: string;
    isSip: boolean;
    monthlySipAmount: number;
  }

  const extracted: RawCsvMfRow[] = [];

  for (const row of dataRows) {
    const rawSchemeName = schemeIdx >= 0 ? (row[schemeIdx] || '').trim() : '';
    if (isSummaryOrTotalRow(rawSchemeName)) continue;

    const units = unitsIdx >= 0 ? parseIndianNumber(row[unitsIdx]) : 0;
    const avgNav = avgNavIdx >= 0 ? parseIndianNumber(row[avgNavIdx]) : 0;
    const latestNavShown = ltpNavIdx >= 0 ? parseIndianNumber(row[ltpNavIdx]) : 0;
    const investedAmount = investedIdx >= 0 ? parseIndianNumber(row[investedIdx]) : 0;
    const currentValue = curValIdx >= 0 ? parseIndianNumber(row[curValIdx]) : 0;

    if (units <= 0 && investedAmount <= 0 && currentValue <= 0) continue;

    const sipRaw = sipIdx >= 0 ? (row[sipIdx] || '').trim() : '';
    const sipNum = parseIndianNumber(sipRaw);
    const isSip = sipNum > 0 || /^(yes|true|sip|active)$/i.test(sipRaw);

    extracted.push({
      rawSchemeName,
      units,
      avgNav,
      latestNavShown,
      investedAmount,
      currentValue,
      planCell: planIdx >= 0 ? (row[planIdx] || '').trim() : '',
      optionCell: optionIdx >= 0 ? (row[optionIdx] || '').trim() : '',
      folioNumber: folioIdx >= 0 ? (row[folioIdx] || '').trim() : '',
      purchaseDate: parseIsoOrIndianDate(dateIdx >= 0 ? row[dateIdx] : ''),
      isSip,
      monthlySipAmount: sipNum > 0 ? sipNum : 0,
    });
  }

  if (extracted.length === 0) {
    throw new Error('No valid mutual fund holdings found in the CSV file.');
  }

  const isZerodhaCsv =
    /kite|coin|zerodha/i.test(fileName || '') ||
    (normalizedHeaders.includes('instrument') &&
      (normalizedHeaders.includes('avg cost') || normalizedHeaders.includes('cur val')));

  const resolvedRows: ParsedMutualFundImportRow[] = await mapWithConcurrency(
    extracted.slice(0, 250),
    8,
    async (row, idx) => {
      const combinedPlanHint = `${row.planCell} ${row.rawSchemeName}`;
      const hasExplicitRegular = /\b(regular|reg|arn-)\b/i.test(combinedPlanHint);
      const hasExplicitDirect = /\b(direct|dir)\b/i.test(combinedPlanHint);

      const prefPlan: 'Direct' | 'Regular' = hasExplicitRegular
        ? 'Regular'
        : hasExplicitDirect
        ? 'Direct'
        : 'Direct';

      const prefOpt: 'Growth' | 'IDCW' = /idcw|dividend/i.test(
        `${row.optionCell} ${row.rawSchemeName}`
      )
        ? 'IDCW'
        : 'Growth';

      const targetNavHint =
        row.latestNavShown > 0
          ? row.latestNavShown
          : row.units > 0 && row.currentValue > 0
          ? row.currentValue / row.units
          : undefined;

      const match = await resolveAmfiMatch(
        row.rawSchemeName,
        prefPlan,
        prefOpt,
        targetNavHint,
        hasExplicitRegular || hasExplicitDirect
      );

      const liveNav = match.latestNav && match.latestNav > 0 ? match.latestNav : 0;
      let units = row.units;
      let notes = isZerodhaCsv ? 'Imported from Zerodha Coin / Kite CSV' : 'Imported from MF CSV';

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
          notes = `${notes} · Reconciled units from CSV current value ÷ live AMFI NAV.`;
        }
      }

      units = Number(Math.max(0.0001, units).toFixed(4));

      let avgNav = row.avgNav;
      if (avgNav <= 0 && row.investedAmount > 0 && units > 0) {
        avgNav = row.investedAmount / units;
      } else if (row.investedAmount > 0 && units > 0) {
        // Keep Invested Capital faithful if CSV gave exact invested amount
        const impliedInvested = units * row.avgNav;
        if (Math.abs(impliedInvested - row.investedAmount) / row.investedAmount > 0.02) {
          avgNav = row.investedAmount / units;
        }
      }
      if (avgNav <= 0) {
        avgNav = liveNav > 0 ? liveNav : 50;
      }
      avgNav = Number(Math.max(0.0001, avgNav).toFixed(4));

      const investedCheck =
        row.investedAmount > 0
          ? row.investedAmount
          : Number((units * avgNav).toFixed(2));
      const currentCheck =
        row.currentValue > 0
          ? row.currentValue
          : liveNav > 0
          ? Number((units * liveNav).toFixed(2))
          : undefined;

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
        confidence: match.verified ? 'high' : 'low',
        notes,
        screenshotInvestedAmount: investedCheck,
        screenshotCurrentValue: currentCheck,
      };
    }
  );

  if (extracted.length > 250) {
    warnings.push(`Imported first 250 mutual fund rows from ${fileName || 'CSV'} (${extracted.length} total rows).`);
  }

  return {
    sourceDetected: isZerodhaCsv ? 'Zerodha Kite / Coin CSV' : 'Mutual Fund CSV Export',
    holdings: resolvedRows,
    warnings,
  };
}
