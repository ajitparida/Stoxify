import { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import type {
  MfHoldingSource,
  MfOptionType,
  MfPlanType,
  MfSearchResult,
  MutualFundHoldingRecord,
} from '../types/market';

interface AddMutualFundModalProps {
  open: boolean;
  onClose: () => void;
  editingHolding?: MutualFundHoldingRecord | null;
  onSave: (data: {
    id?: string;
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
  }) => Promise<void>;
}

const POPULAR_SCHEMES: MfSearchResult[] = [
  {
    schemeCode: '122639',
    schemeName: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
    planType: 'Direct',
    optionType: 'Growth',
  },
  {
    schemeCode: '122640',
    schemeName: 'Parag Parikh Flexi Cap Fund - Regular Plan - Growth',
    planType: 'Regular',
    optionType: 'Growth',
  },
  {
    schemeCode: '118989',
    schemeName: 'HDFC Mid Cap Fund - Direct Plan - Growth Option',
    planType: 'Direct',
    optionType: 'Growth',
  },
  {
    schemeCode: '125497',
    schemeName: 'SBI SMALL CAP FUND - Direct Plan - Growth',
    planType: 'Direct',
    optionType: 'Growth',
  },
  {
    schemeCode: '120716',
    schemeName: 'UTI Nifty 50 Index Fund - Direct Plan - Growth',
    planType: 'Direct',
    optionType: 'Growth',
  },
  {
    schemeCode: '112277',
    schemeName: 'Axis Large Cap Fund - Regular Plan - Growth Option',
    planType: 'Regular',
    optionType: 'Growth',
  },
];

export function AddMutualFundModal({
  open,
  onClose,
  editingHolding,
  onSave,
}: AddMutualFundModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MfSearchResult[]>(POPULAR_SCHEMES);
  const [searching, setSearching] = useState(false);

  const [schemeCode, setSchemeCode] = useState('');
  const [schemeName, setSchemeName] = useState('');
  const [fundHouse, setFundHouse] = useState('Indian Mutual Fund');
  const [category, setCategory] = useState('Flexi Cap');
  const [planType, setPlanType] = useState<MfPlanType>('Direct');
  const [optionType, setOptionType] = useState<MfOptionType>('Growth');

  const [entryMode, setEntryMode] = useState<'units' | 'amount'>('units');
  const [units, setUnits] = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
  const [avgNav, setAvgNav] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)
  );
  const [isSip, setIsSip] = useState(false);
  const [monthlySipAmount, setMonthlySipAmount] = useState('');
  const [folioNumber, setFolioNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingHolding) {
      setSchemeCode(editingHolding.schemeCode);
      setSchemeName(editingHolding.schemeName);
      setFundHouse(editingHolding.fundHouse);
      setCategory(editingHolding.category);
      setPlanType(editingHolding.planType);
      setOptionType(editingHolding.optionType);
      setEntryMode('units');
      setUnits(String(editingHolding.units));
      setInvestedAmount(String((editingHolding.units * editingHolding.avgNav).toFixed(2)));
      setAvgNav(String(editingHolding.avgNav));
      setPurchaseDate(editingHolding.purchaseDate);
      setIsSip(Boolean(editingHolding.isSip));
      setMonthlySipAmount(
        editingHolding.monthlySipAmount ? String(editingHolding.monthlySipAmount) : ''
      );
      setFolioNumber(editingHolding.folioNumber || '');
    } else {
      setSearchQuery('');
      setSearchResults(POPULAR_SCHEMES);
      setSchemeCode('');
      setSchemeName('');
      setFundHouse('Indian Mutual Fund');
      setCategory('Flexi Cap');
      setPlanType('Direct');
      setOptionType('Growth');
      setEntryMode('units');
      setUnits('');
      setInvestedAmount('');
      setAvgNav('');
      setPurchaseDate(new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10));
      setIsSip(false);
      setMonthlySipAmount('');
      setFolioNumber('');
    }
  }, [open, editingHolding]);

  useEffect(() => {
    if (!open || editingHolding) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(POPULAR_SCHEMES);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/mf/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await res.json()) as { results?: MfSearchResult[] };
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [searchQuery, open, editingHolding]);

  if (!open) return null;

  const inferCategoryFromName = (name: string) => {
    const t = name.toLowerCase();
    if (t.includes('elss') || t.includes('tax saver')) return 'ELSS';
    if (t.includes('large & mid') || t.includes('large and mid')) return 'Large & Mid Cap';
    if (t.includes('small cap')) return 'Small Cap';
    if (t.includes('mid cap') || t.includes('midcap')) return 'Mid Cap';
    if (t.includes('index') || t.includes('nifty')) return 'Index / ETF';
    if (t.includes('large cap') || t.includes('bluechip')) return 'Large Cap';
    if (t.includes('bond') || t.includes('debt') || t.includes('liquid')) {
      return 'Debt / Corporate Bond';
    }
    return 'Flexi Cap';
  };

  const handleSelectScheme = (item: MfSearchResult) => {
    setSchemeCode(item.schemeCode);
    setSchemeName(item.schemeName);
    setPlanType(item.planType);
    setOptionType(item.optionType);
    setFundHouse(item.schemeName.split(' ')[0] + ' Mutual Fund');
    setCategory(inferCategoryFromName(item.schemeName));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const navNum = Number(avgNav);
    if (!schemeCode || !schemeName.trim()) {
      setError('Select an AMFI mutual fund scheme first.');
      return;
    }
    if (!Number.isFinite(navNum) || navNum <= 0) {
      setError('Enter a valid average purchase NAV greater than 0.');
      return;
    }

    let finalUnits = Number(units);
    if (entryMode === 'amount') {
      const invAmt = Number(investedAmount);
      if (!Number.isFinite(invAmt) || invAmt <= 0) {
        setError('Enter a valid invested rupee amount.');
        return;
      }
      finalUnits = Number((invAmt / navNum).toFixed(4));
    }

    if (!Number.isFinite(finalUnits) || finalUnits <= 0) {
      setError('Enter valid mutual fund units greater than 0.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: editingHolding?.id,
        schemeCode,
        schemeName: schemeName.trim(),
        fundHouse: fundHouse.trim() || 'Indian Mutual Fund',
        category: category.trim() || 'Flexi Cap',
        planType,
        optionType,
        units: finalUnits,
        avgNav: navNum,
        purchaseDate,
        isSip,
        monthlySipAmount: isSip ? Number(monthlySipAmount) || 0 : 0,
        folioNumber: folioNumber.trim(),
        source: editingHolding?.source ?? 'manual',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save mutual fund holding.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editingHolding ? 'Edit Mutual Fund Position' : 'Add Indian Mutual Fund'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live AMFI scheme lookup with automatic Direct / Regular plan detection
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {!editingHolding && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Search AMFI Scheme (e.g., Parag Parikh, HDFC Mid Cap, Axis Large Cap)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type fund house or scheme name..."
                  className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                {searching && (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>

              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-500">
                    No matching AMFI scheme found. Try keywords like &quot;SBI Small&quot; or &quot;HDFC Flexi&quot;.
                  </div>
                ) : (
                  searchResults.map((item) => {
                    const selected = schemeCode === item.schemeCode;
                    return (
                      <button
                        key={item.schemeCode}
                        type="button"
                        onClick={() => handleSelectScheme(item)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                          selected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{item.schemeName}</div>
                          <div className="text-[11px] text-slate-500 font-mono-tabular">
                            AMFI #{item.schemeCode} · {item.planType} · {item.optionType}
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-semibold shrink-0 ${
                            item.planType === 'Regular' ? 'text-amber-700' : 'text-green-700'
                          }`}
                        >
                          {selected ? 'Selected' : item.planType}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {schemeName && (
            <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-xs font-semibold text-slate-900">{schemeName}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
                Scheme #{schemeCode} ·{' '}
                <span className={planType === 'Regular' ? 'text-amber-700 font-semibold' : 'text-green-700 font-semibold'}>
                  {planType} Plan
                </span>{' '}
                · {optionType} · {category}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-700">Position Input Mode</span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setEntryMode('units')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  entryMode === 'units'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By Units
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('amount')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  entryMode === 'amount'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By Invested ₹
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {entryMode === 'units' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Allotted Units
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  placeholder="e.g., 1450.25"
                  required
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Invested Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="100"
                  value={investedAmount}
                  onChange={(e) => setInvestedAmount(e.target.value)}
                  placeholder="e.g., 150000"
                  required
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Avg Purchase NAV (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={avgNav}
                onChange={(e) => setAvgNav(e.target.value)}
                placeholder="e.g., 64.20"
                required
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Primary Purchase / SIP Start Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Folio Number (Optional)
              </label>
              <input
                type="text"
                value={folioNumber}
                onChange={(e) => setFolioNumber(e.target.value)}
                placeholder="e.g., 10482911/02"
                maxLength={40}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isSip}
                onChange={(e) => setIsSip(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              <span>Active Monthly SIP in this scheme</span>
            </label>

            {isSip && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Monthly SIP ₹</span>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={monthlySipAmount}
                  onChange={(e) => setMonthlySipAmount(e.target.value)}
                  placeholder="10000"
                  className="w-32 px-2.5 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingHolding ? 'Save Changes' : 'Add Mutual Fund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
