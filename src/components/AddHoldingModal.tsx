import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Exchange, HoldingRecord, HoldingSource, SearchResultItem } from '../types/market';

interface AddHoldingModalProps {
  open: boolean;
  onClose: () => void;
  editingHolding?: HoldingRecord | null;
  prefill?: {
    symbol?: string;
    companyName?: string;
    exchange?: Exchange;
    sector?: string;
    avgBuyPrice?: number;
    quantity?: number;
    notes?: string;
    source?: HoldingSource;
  } | null;
  onSave: (data: {
    id?: string;
    symbol: string;
    companyName: string;
    exchange: Exchange;
    sector: string;
    quantity: number;
    avgBuyPrice: number;
    buyDate: string;
    notes: string;
    source: HoldingSource;
  }) => Promise<void>;
}

export function AddHoldingModal({
  open,
  onClose,
  editingHolding,
  prefill,
  onSave,
}: AddHoldingModalProps) {
  const [symbol, setSymbol] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [exchange, setExchange] = useState<Exchange>('NSE');
  const [sector, setSector] = useState('Equities');
  const [quantity, setQuantity] = useState('');
  const [avgBuyPrice, setAvgBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<HoldingSource>('manual');

  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (editingHolding) {
      setSymbol(editingHolding.symbol);
      setCompanyName(editingHolding.companyName);
      setExchange(editingHolding.exchange);
      setSector(editingHolding.sector);
      setQuantity(String(editingHolding.quantity));
      setAvgBuyPrice(String(editingHolding.avgBuyPrice));
      setBuyDate(editingHolding.buyDate);
      setNotes(editingHolding.notes || '');
      setSource(editingHolding.source);
      setQueryText('');
    } else if (prefill?.symbol) {
      setSymbol(prefill.symbol);
      setCompanyName(prefill.companyName || prefill.symbol.replace(/\.(NS|BO)$/, ''));
      setExchange(prefill.exchange || 'NSE');
      setSector(prefill.sector || 'Equities');
      setQuantity(prefill.quantity && prefill.quantity > 0 ? String(prefill.quantity) : '10');
      setAvgBuyPrice(prefill.avgBuyPrice ? String(prefill.avgBuyPrice) : '');
      setBuyDate(new Date().toISOString().slice(0, 10));
      setNotes(prefill.notes || '');
      setSource(prefill.source || 'manual');
      setQueryText('');
    } else {
      setSymbol('');
      setCompanyName('');
      setExchange('NSE');
      setSector('Equities');
      setQuantity('');
      setAvgBuyPrice('');
      setBuyDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setSource('manual');
      setQueryText('');
    }
  }, [open, editingHolding, prefill]);

  useEffect(() => {
    if (!open || editingHolding) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(queryText)}`);
        if (res.ok) {
          const json = (await res.json()) as { results: SearchResultItem[] };
          setResults(json.results || []);
        }
      } catch {
        // ignore
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [queryText, open, editingHolding]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quantity);
    const priceNum = Number(avgBuyPrice);

    if (!symbol.trim()) {
      setError('Please select a valid NSE or BSE stock.');
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError('Average buy price must be greater than 0.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        id: editingHolding?.id,
        symbol: symbol.trim().toUpperCase(),
        companyName: companyName.trim() || symbol,
        exchange,
        sector: sector.trim() || 'Equities',
        quantity: qtyNum,
        avgBuyPrice: priceNum,
        buyDate,
        notes: notes.trim(),
        source,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save holding.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">
            {editingHolding ? `Edit Holding · ${editingHolding.symbol}` : 'Add NSE/BSE Holding'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!editingHolding && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Search Indian Stock (NSE / BSE)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="Type ticker or company name..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              {results.length > 0 && !symbol && (
                <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {results.slice(0, 6).map((item, idx) => (
                    <button
                      key={`${item.symbol}_${idx}`}
                      type="button"
                      onClick={() => {
                        setSymbol(item.symbol);
                        setCompanyName(item.name);
                        setExchange(item.exchange);
                        setSector(item.sector);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-900">
                        {item.ticker} — <span className="font-normal text-slate-600">{item.name}</span>
                      </span>
                      <span className="text-slate-500">{item.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
              {symbol && (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{symbol}</span>
                    <span className="text-slate-500 ml-2">{companyName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSymbol('');
                      setCompanyName('');
                    }}
                    className="text-blue-700 hover:underline font-medium"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder="e.g. 50"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Avg Buy Price (₹)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={avgBuyPrice}
                onChange={(e) => setAvgBuyPrice(e.target.value)}
                required
                placeholder="e.g. 1425.50"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Buy Date</label>
              <input
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sector</label>
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                required
                maxLength={64}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Thesis / Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
              placeholder="e.g. Long-term core position"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          {error && <p className="text-xs text-red-700 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingHolding ? 'Update Holding' : 'Save Holding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
