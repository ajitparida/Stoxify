import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Exchange, ParsedScreenshotHolding, ScreenshotParseResponse } from '../types/market';
import { formatINR, formatPercent } from '../utils/portfolioAnalytics';

interface EditableParsedRow extends ParsedScreenshotHolding {
  included: boolean;
}

interface ScreenshotImportModalProps {
  open: boolean;
  existingCount?: number;
  onClose: () => void;
  onImportConfirmed: (
    rows: Array<{
      symbol: string;
      companyName: string;
      exchange: Exchange;
      sector: string;
      quantity: number;
      avgBuyPrice: number;
      buyDate: string;
      notes: string;
    }>,
    options?: { replaceExisting?: boolean }
  ) => Promise<void>;
}

interface SelectedImageFile {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  previewUrl: string;
}

interface SelectedCsvFile {
  name: string;
  size: number;
  text: string;
}

type ImportMode = 'csv' | 'screenshots';

function readFileAsBase64(file: File): Promise<{ base64: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      resolve({ base64, previewUrl: result });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function isCsvFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith('.csv') ||
    lower.endsWith('.tsv') ||
    file.type === 'text/csv' ||
    file.type === 'application/vnd.ms-excel'
  );
}

export function ScreenshotImportModal({
  open,
  existingCount = 0,
  onClose,
  onImportConfirmed,
}: ScreenshotImportModalProps) {
  const [mode, setMode] = useState<ImportMode>('csv');
  const [csvFile, setCsvFile] = useState<SelectedCsvFile | null>(null);
  const [csvRawText, setCsvRawText] = useState('');
  const [files, setFiles] = useState<SelectedImageFile[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokerDetected, setBrokerDetected] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<EditableParsedRow[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  if (!open) return null;

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const list = Array.from(fileList);

    const firstCsv = list.find(isCsvFile);
    if (firstCsv) {
      try {
        const text = await readFileAsText(firstCsv);
        setMode('csv');
        setCsvFile({ name: firstCsv.name, size: firstCsv.size, text });
        setCsvRawText('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to read CSV file.');
      }
      return;
    }

    const imageCandidates = list.filter((f) => f.type.startsWith('image/'));
    if (imageCandidates.length === 0) {
      setError('Upload a Zerodha Kite .csv file or PNG, JPEG, or WebP screenshots.');
      return;
    }

    setMode('screenshots');
    const incoming = imageCandidates.slice(0, 15 - files.length);
    const loaded: SelectedImageFile[] = [];

    for (const file of incoming) {
      const { base64, previewUrl } = await readFileAsBase64(file);
      loaded.push({
        id: `${file.name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        mimeType: file.type,
        base64,
        previewUrl,
      });
    }
    setFiles((prev) => [...prev, ...loaded].slice(0, 15));
  };

  const handleParseInput = async () => {
    setParsing(true);
    setError(null);
    setRows([]);

    try {
      let res: Response;
      if (mode === 'csv') {
        const textToParse = csvFile?.text || csvRawText;
        if (textToParse.trim().length < 10) {
          throw new Error('Upload a Zerodha Kite holdings .csv file or paste CSV rows first.');
        }
        res = await fetch('/api/portfolio/parse-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            csvText: textToParse,
            fileName: csvFile?.name,
          }),
        });
      } else {
        if (files.length === 0) {
          throw new Error('Select at least one portfolio screenshot first.');
        }
        res = await fetch('/api/portfolio/parse-screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: files.map((f) => ({
              mimeType: f.mimeType,
              data: f.base64,
              fileName: f.name,
            })),
          }),
        });
      }

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          errBody.error ||
            (mode === 'csv'
              ? 'Failed to parse equity CSV file.'
              : 'Failed to parse portfolio screenshot.')
        );
      }

      const data = (await res.json()) as ScreenshotParseResponse;
      setBrokerDetected(data.brokerDetected);
      setWarnings(data.warnings || []);
      const parsedRows = (data.holdings || []).map((h) => ({
        ...h,
        included: true,
      }));
      setRows(parsedRows);
      setReplaceExisting(mode === 'csv' && existingCount > 0 && parsedRows.length >= 10);
      if (!data.holdings || data.holdings.length === 0) {
        setError(
          mode === 'csv'
            ? 'No equity holdings with positive quantity and buy price were found in that CSV.'
            : 'No readable equity holdings were detected. Please upload a clearer portfolio screenshot.'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'csv'
          ? 'CSV parsing failed.'
          : 'Screenshot parsing failed.'
      );
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (tempId: string, patch: Partial<EditableParsedRow>) => {
    setRows((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)));
  };

  const handleConfirmImport = async () => {
    const selected = rows.filter(
      (r) => r.included && r.resolvedSymbol.trim() && r.quantity > 0 && r.avgBuyPrice > 0
    );
    if (selected.length === 0) {
      setError('Select at least one valid holding row to import.');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await onImportConfirmed(
        selected.map((r) => ({
          symbol: r.resolvedSymbol.trim().toUpperCase(),
          companyName: r.resolvedName.trim() || r.rawName,
          exchange: r.exchange,
          sector: r.sector || 'Equities',
          quantity: Number(r.quantity),
          avgBuyPrice: Number(r.avgBuyPrice),
          buyDate: today,
          notes: `Imported from ${brokerDetected || 'broker'}`,
        })),
        { replaceExisting: existingCount > 0 && replaceExisting }
      );
      resetAll();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save imported holdings.');
    } finally {
      setImporting(false);
    }
  };

  const resetAll = () => {
    setCsvFile(null);
    setCsvRawText('');
    setFiles([]);
    setRows([]);
    setBrokerDetected(null);
    setWarnings([]);
    setError(null);
  };

  const canExtract =
    mode === 'csv'
      ? Boolean(csvFile) || csvRawText.trim().length >= 10
      : files.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Import Equity Holdings (Kite CSV or Broker Screenshot)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload your Zerodha Kite holdings CSV export or broker screenshots — symbols are fact-checked against live NSE/BSE feeds before saving.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            aria-label="Close importer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {rows.length === 0 && !parsing && (
            <div className="space-y-4">
              {/* Source Switcher */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('csv');
                      setError(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      mode === 'csv'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Zerodha Kite / Broker CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('screenshots');
                      setError(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      mode === 'screenshots'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    Broker Screenshots ({files.length}/15)
                  </button>
                </div>

                {mode === 'csv' && (
                  <span className="text-[11px] text-slate-500">
                    Kite / Console path: Holdings -&gt; Download CSV (Instrument, Qty., Avg. cost, LTP)
                  </span>
                )}
              </div>

              {mode === 'csv' ? (
                <div className="space-y-4">
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      void handleFilesSelected(e.dataTransfer.files);
                    }}
                    className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-7 cursor-pointer transition-colors ${
                      dragActive
                        ? 'border-blue-600 bg-blue-50/40'
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
                    }`}
                  >
                    <FileSpreadsheet className="w-7 h-7 text-blue-700 mb-2" />
                    <span className="text-sm font-semibold text-slate-900">
                      Drop or click to upload Zerodha Kite holdings CSV
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Supports Kite holdings.csv, Zerodha Console CSV, Groww/Upstox &amp; Stoxify exports (.csv)
                    </span>
                    <input
                      type="file"
                      accept=".csv,.tsv,text/csv"
                      onChange={(e) => void handleFilesSelected(e.target.files)}
                      className="hidden"
                    />
                  </label>

                  {csvFile && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="w-4 h-4 text-blue-700 shrink-0" />
                        <span className="font-semibold text-slate-900 truncate">{csvFile.name}</span>
                        <span className="text-slate-500 font-mono-tabular shrink-0">
                          {(csvFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCsvFile(null)}
                        className="text-slate-400 hover:text-red-700 shrink-0"
                        aria-label="Remove CSV file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      Or paste Kite CSV rows directly (Optional)
                    </label>
                    <textarea
                      value={csvRawText}
                      onChange={(e) => setCsvRawText(e.target.value)}
                      rows={4}
                      placeholder={
                        'Instrument,Qty.,Avg. cost,LTP,Cur. val,P&L\nRELIANCE,12,2450.00,2910.50,34926.00,5526.00\nHDFCBANK,25,1540.00,1712.20,42805.00,4305.00'
                      }
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      void handleFilesSelected(e.dataTransfer.files);
                    }}
                    className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
                      dragActive
                        ? 'border-blue-600 bg-blue-50/40'
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
                    }`}
                  >
                    <Upload className="w-7 h-7 text-blue-700 mb-2" />
                    <span className="text-sm font-semibold text-slate-900">
                      Click or drop up to 15 portfolio screenshots
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      PNG, JPG, or WebP showing Stock Name, Qty, Avg Cost, and LTP ({files.length}/15 selected)
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      onChange={(e) => void handleFilesSelected(e.target.files)}
                      className="hidden"
                    />
                  </label>

                  {files.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-h-60 overflow-y-auto pr-1">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="relative border border-slate-200 rounded-lg p-2 bg-white"
                        >
                          <img
                            src={file.previewUrl}
                            alt={file.name}
                            className="w-full h-24 object-cover rounded"
                          />
                          <div className="flex items-center justify-between gap-1 mt-1.5">
                            <span className="text-[11px] text-slate-600 truncate flex items-center gap-1">
                              <FileImage className="w-3 h-3 shrink-0" />
                              {file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setFiles((prev) => prev.filter((f) => f.id !== file.id))
                              }
                              className="text-slate-400 hover:text-red-600"
                              aria-label="Remove screenshot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {parsing && (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-600">
              <Loader2 className="w-6 h-6 animate-spin text-blue-700" />
              <div className="text-sm font-medium text-slate-900">
                {mode === 'csv'
                  ? 'Parsing CSV & verifying NSE/BSE ticker symbols...'
                  : 'Extracting holdings & verifying NSE/BSE ticker symbols...'}
              </div>
              <div className="text-xs text-slate-500">
                Matching stock names against live Yahoo Finance NSE/BSE exchange quotes
              </div>
            </div>
          )}

          {/* Verification Review Table */}
          {rows.length > 0 && !parsing && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <div className="text-xs text-slate-700">
                  Detected Source: <span className="font-semibold text-slate-900">{brokerDetected}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span>{rows.length} holdings parsed &amp; cross-checked</span>
                </div>
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Upload Another File
                </button>
              </div>

              {warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                  {warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-3 w-10">Use</th>
                      <th className="py-2.5 px-3">Source Name -&gt; Resolved NSE/BSE Symbol</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Avg Buy (₹)</th>
                      <th className="py-2.5 px-3 text-right">File LTP vs Live LTP</th>
                      <th className="py-2.5 px-3">Fact Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {rows.map((row) => (
                      <tr key={row.tempId} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={row.included}
                            onChange={(e) =>
                              updateRow(row.tempId, { included: e.target.checked })
                            }
                            className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                          />
                        </td>
                        <td className="py-2.5 px-3 min-w-[230px]">
                          <div className="text-[11px] text-slate-500 mb-1">
                            Source: {row.rawName}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={row.resolvedSymbol}
                              onChange={(e) =>
                                updateRow(row.tempId, {
                                  resolvedSymbol: e.target.value.toUpperCase(),
                                })
                              }
                              className="w-36 px-2 py-1 text-xs font-mono-tabular font-semibold border border-slate-200 rounded bg-white"
                            />
                            <select
                              value={row.exchange}
                              onChange={(e) =>
                                updateRow(row.tempId, {
                                  exchange: e.target.value as Exchange,
                                })
                              }
                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                            >
                              <option value="NSE">NSE</option>
                              <option value="BSE">BSE</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={row.quantity}
                            onChange={(e) =>
                              updateRow(row.tempId, { quantity: Number(e.target.value) })
                            }
                            className="w-20 px-2 py-1 text-right font-mono-tabular border border-slate-200 rounded bg-white"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="0.05"
                            min="0.05"
                            value={row.avgBuyPrice}
                            onChange={(e) =>
                              updateRow(row.tempId, { avgBuyPrice: Number(e.target.value) })
                            }
                            className="w-24 px-2 py-1 text-right font-mono-tabular border border-slate-200 rounded bg-white"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">
                          <div className="text-slate-900 font-medium">
                            {row.livePrice ? formatINR(row.livePrice) : '—'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            File: {row.screenshotLtp ? formatINR(row.screenshotLtp) : 'N/A'}
                            {row.priceDeviationPct !== null && (
                              <span className="ml-1">({formatPercent(row.priceDeviationPct)})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {row.verified ? (
                            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Verified ({row.confidence})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Check Ticker
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800 font-medium">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <div>
            {rows.length > 0 && existingCount > 0 && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700"
                />
                <span>
                  Replace existing <span className="font-semibold">{existingCount}</span> holdings
                  (recommended for full broker CSV sync)
                </span>
              </label>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            {rows.length === 0 ? (
              <button
                type="button"
                disabled={!canExtract || parsing}
                onClick={() => void handleParseInput()}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {parsing
                  ? mode === 'csv'
                    ? 'Verifying CSV Tickers...'
                    : 'Analyzing Screenshots...'
                  : mode === 'csv'
                  ? 'Parse CSV & Verify NSE/BSE'
                  : `Extract & Fact-Check (${files.length})`}
              </button>
            ) : (
              <button
                type="button"
                disabled={importing}
                onClick={() => void handleConfirmImport()}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {importing
                  ? replaceExisting && existingCount > 0
                    ? 'Replacing Portfolio...'
                    : 'Importing...'
                  : replaceExisting && existingCount > 0
                  ? `Replace with ${rows.filter((r) => r.included).length} Holdings`
                  : `Import ${rows.filter((r) => r.included).length} Verified Holdings`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
