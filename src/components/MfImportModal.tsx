import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  MfHoldingSource,
  MfOptionType,
  MfPlanType,
  MutualFundImportParseResponse,
  ParsedMutualFundImportRow,
} from '../types/market';

interface MfImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportConfirmed: (
    rows: Array<{
      schemeCode: string;
      schemeName: string;
      fundHouse: string;
      category: string;
      planType: MfPlanType;
      optionType: MfOptionType;
      units: number;
      avgNav: number;
      purchaseDate: string;
      isSip: boolean;
      monthlySipAmount: number;
      folioNumber: string;
      source: MfHoldingSource;
    }>
  ) => Promise<void>;
}

const MAX_MF_FILES = 15;

function isCsvFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith('.csv') ||
    lower.endsWith('.tsv') ||
    file.type === 'text/csv' ||
    file.type === 'application/vnd.ms-excel'
  );
}

function looksLikeCsvText(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  const header = lines[0].toLowerCase();
  return (
    (header.includes(',') || header.includes('\t')) &&
    /(instrument|scheme|fund)/i.test(header) &&
    /(qty|units|avg|invested|cur)/i.test(header)
  );
}

export function MfImportModal({ open, onClose, onImportConfirmed }: MfImportModalProps) {
  const [csvFile, setCsvFile] = useState<{ fileName: string; size: number; text: string } | null>(
    null
  );
  const [files, setFiles] = useState<Array<{ fileName: string; mimeType: string; data: string }>>(
    []
  );
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<MutualFundImportParseResponse | null>(null);
  const [rows, setRows] = useState<ParsedMutualFundImportRow[]>([]);
  const [dragActive, setDragActive] = useState(false);

  if (!open) return null;

  const readFileAsBase64 = (file: File): Promise<{ fileName: string; mimeType: string; data: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve({
          fileName: file.name,
          mimeType: file.type || 'image/png',
          data: base64,
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    });

  const handleFilesSelected = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError(null);
    try {
      const all = Array.from(list);
      const pickedCsv = all.find(isCsvFile);
      if (pickedCsv) {
        const text = await readFileAsText(pickedCsv);
        setCsvFile({ fileName: pickedCsv.name, size: pickedCsv.size, text });
      }

      const incoming = all.slice(0, MAX_MF_FILES - files.length);
      const valid = incoming.filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
      );
      if (!pickedCsv && valid.length === 0) {
        setError('Upload a Zerodha Coin/Kite .csv file, PNG/JPG screenshots, or a CAS PDF file.');
        return;
      }
      if (valid.length > 0) {
        const loaded = await Promise.all(valid.map(readFileAsBase64));
        setFiles((prev) => [...prev, ...loaded].slice(0, MAX_MF_FILES));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read selected files.');
    }
  };

  const handleExtract = async () => {
    const useCsvEndpoint = Boolean(csvFile) || (files.length === 0 && looksLikeCsvText(rawText));

    if (!useCsvEndpoint && files.length === 0 && rawText.trim().length < 15) {
      setError('Upload a Kite/Coin CSV, CAS PDF, screenshots, or paste CSV/CAS summary text first.');
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const res = useCsvEndpoint
        ? await fetch('/api/mf/parse-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              csvText: csvFile ? csvFile.text : rawText,
              fileName: csvFile?.fileName,
            }),
          })
        : await fetch('/api/mf/parse-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files, rawText }),
          });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Unable to parse mutual fund statement.');
      }
      const parsed = (await res.json()) as MutualFundImportParseResponse;
      setParseResult(parsed);
      setRows(parsed.holdings);
      if (parsed.holdings.length === 0) {
        setError('No mutual fund rows were detected. Ensure scheme names and units are legible.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse statement.');
    } finally {
      setParsing(false);
    }
  };


  const updateRow = (tempId: string, patch: Partial<ParsedMutualFundImportRow>) => {
    setRows((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)));
  };

  const removeRow = (tempId: string) => {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const previewInvested = rows.reduce((acc, r) => acc + r.units * r.avgNav, 0);
  const previewCurrent = rows.reduce(
    (acc, r) => acc + r.units * (r.latestNav && r.latestNav > 0 ? r.latestNav : r.avgNav),
    0
  );
  const previewGain = previewCurrent - previewInvested;
  const previewGainPct = previewInvested > 0 ? (previewGain / previewInvested) * 100 : 0;
  const previewDirectCount = rows.filter((r) => r.planType === 'Direct').length;
  const previewRegularCount = rows.filter((r) => r.planType === 'Regular').length;

  const formatInr = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleConfirmImport = async () => {
    const validRows = rows.filter((r) => r.units > 0 && r.avgNav > 0 && r.resolvedSchemeCode);
    if (validRows.length === 0) {
      setError('Keep at least one valid mutual fund row with units and average NAV > 0.');
      return;
    }
    const isStructuredStatement =
      Boolean(csvFile) ||
      looksLikeCsvText(rawText) ||
      files.some((f) => f.mimeType === 'application/pdf') ||
      rawText.trim().length > 20;
    setImporting(true);
    setError(null);
    try {
      await onImportConfirmed(
        validRows.map((r) => ({
          schemeCode: r.resolvedSchemeCode,
          schemeName: r.resolvedSchemeName,
          fundHouse: r.fundHouse,
          category: r.category,
          planType: r.planType,
          optionType: r.optionType,
          units: Number(r.units),
          avgNav: Number(r.avgNav),
          purchaseDate: r.purchaseDate,
          isSip: r.isSip,
          monthlySipAmount: r.monthlySipAmount,
          folioNumber: r.folioNumber,
          source: isStructuredStatement ? 'cas_pdf' : 'screenshot',
        }))
      );
      setCsvFile(null);
      setFiles([]);
      setRawText('');
      setRows([]);
      setParseResult(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setFiles([]);
    setRawText('');
    setParseResult(null);
    setRows([]);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Import Mutual Funds (Kite / Coin CSV, CAS PDF, or Screenshots)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a Zerodha Kite / Coin CSV, a CAMS/KFintech CAS PDF, or up to 15 portfolio screenshots — verified against live AMFI scheme codes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {!parseResult ? (
            <>

              <div
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
                className={`border border-dashed rounded-xl p-7 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-600 bg-blue-50/40'
                    : 'border-slate-300 bg-slate-50/60'
                }`}
              >
                <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2.5" />
                <p className="text-sm font-medium text-slate-900">
                  Drop Zerodha Coin / Kite CSV, CAS PDF, or up to {MAX_MF_FILES} portfolio screenshots
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports .CSV exports (Kite / Console / Kuvera), CAMS / KFintech CAS PDF, and PNG/JPG/WEBP screenshots
                </p>
                <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer">
                  <span>Browse CSV / PDF / Images</span>
                  <input
                    type="file"
                    accept=".csv,.tsv,text/csv,image/*,application/pdf"
                    multiple
                    onChange={(e) => void handleFilesSelected(e.target.files)}
                    className="hidden"
                  />
                </label>
              </div>

              {csvFile && (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-blue-50/60 border border-blue-200 rounded-lg text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-blue-700 shrink-0" />
                    <span className="font-semibold text-slate-900 truncate">{csvFile.fileName}</span>
                    <span className="text-slate-500 font-mono-tabular shrink-0">
                      {(csvFile.size / 1024).toFixed(1)} KB · CSV
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCsvFile(null)}
                    className="text-slate-500 hover:text-red-700 shrink-0"
                    aria-label="Remove CSV file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {files.length} / {MAX_MF_FILES} file(s) staged
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="text-red-700 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {files.map((f, idx) => (
                      <div
                        key={`${f.fileName}_${idx}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate text-slate-800">{f.fileName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-red-700 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Or paste Kite/Coin CSV rows or CAS summary text directly (Optional)
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={4}
                  placeholder="Paste Zerodha Coin/Kite MF CSV rows or CAMS/KFintech CAS summary lines..."
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">{parseResult.sourceDetected}</span>
                  <span className="mx-2 text-slate-300">·</span>
                  <span>{rows.length} mutual fund positions resolved against AMFI</span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Upload Another Statement
                </button>
              </div>


              {parseResult.warnings.length > 0 && (
                <div className="px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  {parseResult.warnings.map((w, i) => (
                    <div key={i}>• {w}</div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="text-[11px] text-slate-500">Total Invested</div>
                  <div className="text-sm font-semibold text-slate-900 font-mono-tabular mt-0.5">
                    {formatInr(previewInvested)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Est. Live Value (AMFI)</div>
                  <div className="text-sm font-semibold text-slate-900 font-mono-tabular mt-0.5">
                    {formatInr(previewCurrent)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Net P&amp;L</div>
                  <div
                    className={`text-sm font-semibold font-mono-tabular mt-0.5 ${
                      previewGain >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {previewGain >= 0 ? '+' : ''}
                    {formatInr(previewGain)} ({previewGain >= 0 ? '+' : ''}
                    {previewGainPct.toFixed(2)}%)
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Plan Classification</div>
                  <div className="text-sm font-semibold text-slate-900 font-mono-tabular mt-0.5">
                    {previewDirectCount} Direct · {previewRegularCount} Regular
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2 px-3">Matched AMFI Scheme</th>
                      <th className="py-2 px-2">Plan</th>
                      <th className="py-2 px-2 text-right">Units</th>
                      <th className="py-2 px-2 text-right">Avg NAV</th>
                      <th className="py-2 px-2 text-right">Live NAV</th>
                      <th className="py-2 px-2 text-right">Invested / Value</th>
                      <th className="py-2 px-2">Purchase Date</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2 text-right">Drop</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const rowInvested = row.units * row.avgNav;
                      const rowValue =
                        row.units *
                        (row.latestNav && row.latestNav > 0 ? row.latestNav : row.avgNav);
                      return (
                        <tr key={row.tempId} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 max-w-[240px]">
                            <div className="font-semibold text-slate-900 truncate">
                              {row.resolvedSchemeName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono-tabular truncate">
                              AMFI #{row.resolvedSchemeCode} · {row.category}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={row.planType}
                              onChange={(e) =>
                                updateRow(row.tempId, {
                                  planType: e.target.value as MfPlanType,
                                })
                              }
                              className="px-1.5 py-1 border border-slate-200 rounded text-xs bg-white"
                            >
                              <option value="Direct">Direct</option>
                              <option value="Regular">Regular</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="any"
                              value={row.units}
                              onChange={(e) =>
                                updateRow(row.tempId, { units: Number(e.target.value) || 0 })
                              }
                              className="w-24 text-right px-2 py-1 font-mono-tabular border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="any"
                              value={row.avgNav}
                              onChange={(e) =>
                                updateRow(row.tempId, { avgNav: Number(e.target.value) || 0 })
                              }
                              className="w-24 text-right px-2 py-1 font-mono-tabular border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono-tabular text-slate-700">
                            {row.latestNav ? `₹${row.latestNav.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono-tabular whitespace-nowrap">
                            <div className="font-medium text-slate-900">{formatInr(rowValue)}</div>
                            <div className="text-[11px] text-slate-500">
                              Inv {formatInr(rowInvested)}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="date"
                              value={row.purchaseDate}
                              onChange={(e) =>
                                updateRow(row.tempId, { purchaseDate: e.target.value })
                              }
                              className="px-1.5 py-1 font-mono-tabular border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            {row.verified ? (
                              <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> AMFI Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                <AlertTriangle className="w-3.5 h-3.5" /> Check Scheme
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(row.tempId)}
                              className="p-1 text-slate-400 hover:text-red-700 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          {!parseResult ? (
            <button
              type="button"
              onClick={() => void handleExtract()}
              disabled={parsing}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              {parsing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {parsing ? 'Extracting with AI...' : 'Extract & Verify AMFI Schemes'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleConfirmImport()}
              disabled={importing || rows.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50"
            >
              {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Import {rows.length} Funds to Portfolio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
