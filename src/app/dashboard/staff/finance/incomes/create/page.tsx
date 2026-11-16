'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  incomeAPI,
  incomeCategoriesAPI,
  bankDetailsAPI,
  financeSettingsAPI
} from '@/lib/api';
import type {
  IncomeCategory,
  SchoolBankDetail,
  FinanceSettings,
  GeneralPaymentMethod
} from '@/lib/finance.types';
import {
  TrendingUp, ArrowLeft, Check, AlertCircle, Loader2, UploadCloud,
  Coins, Wallet, FileText, Tag, Lock, Search, ChevronDown, X, Info,
} from 'lucide-react';
import { buildCurrencyCatalog, currencySymbol, fmtCurrency } from '@/lib/currency';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractErrorMessage(err: any): string {
  if (err instanceof Error) return err.message;
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    for (const [key, val] of Object.entries(d)) {
      if (Array.isArray(val) && val.length > 0) return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${val[0]}`;
      if (typeof val === 'string') return `${key}: ${val}`;
    }
  }
  return err?.message || 'An unexpected error occurred while saving.';
}

function titleCase(str: string): string {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Searchable Category Picker ────────────────────────────────────────────────
function CategoryPicker({
  label, value, onChange, categories, placeholder = 'Search category...'
}: {
  label: string; value: number | ''; onChange: (id: number | '') => void;
  categories: IncomeCategory[]; placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCategory = useMemo(() => categories.find(c => c.id === Number(value)), [categories, value]);

  const filtered = useMemo(() => {
    // If no search, return full list. The DOM internal scroll will handle the length smoothly.
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  }, [categories, search]);

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label} <span className="text-red-500">*</span></label>
      {selectedCategory ? (
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800">
          <div className="min-w-0">
            <span className="font-bold truncate">{titleCase(selectedCategory.name)}</span>
          </div>
          <button type="button" onClick={() => onChange('')} className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div>
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-400 cursor-pointer flex items-center justify-between hover:border-slate-300 transition-colors"
          >
            <span className="truncate">{placeholder}</span>
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          </div>

          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <Search className="h-4 w-4 text-slate-400 ml-1 shrink-0" />
                <input
                  type="text"
                  placeholder="Type to filter categories..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-transparent text-xs outline-none font-medium text-slate-700 py-1"
                  autoFocus
                />
              </div>
              {/* Internal scroll limit: max-h-60 ensures it never overflows the screen height */}
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-medium">No matches found</div>
                ) : (
                  filtered.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { onChange(c.id); setIsOpen(false); setSearch(''); }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 flex items-center justify-between transition-colors"
                    >
                      <span className="font-bold text-slate-800 truncate pr-2">{titleCase(c.name)}</span>
                      {c.description && <span className="text-[10px] text-slate-400 truncate max-w-[120px] hidden sm:block">{c.description}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function IncomeCreatePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Reference Data State
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [banks, setBanks] = useState<SchoolBankDetail[]>([]);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form State
  const [category, setCategory] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<GeneralPaymentMethod>('bank_transfer');
  const [bankAccount, setBankAccount] = useState<number | ''>('');
  const [incomeDate, setIncomeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [source, setSource] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Amount — always entered in the receiving account's own currency (no conversion)
  const [amount, setAmount] = useState<string>('');

  // Post-Submit Redirect Selection
  const [postSubmitAction, setPostSubmitAction] = useState<'list' | 'create_another' | 'detail'>('list');

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // 1. Fetch References
  const fetchReferences = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const [catsRes, banksRes, settingsData] = await Promise.all([
        incomeCategoriesAPI.list({ page_size: 1000 }), // Safely load all categories
        bankDetailsAPI.list({ is_active: true }),
        financeSettingsAPI.get()
      ]);

      const listCats = Array.isArray(catsRes) ? catsRes : (catsRes as any)?.results || [];
      const listBanks = Array.isArray(banksRes) ? banksRes : (banksRes as any)?.results || [];

      setCategories(listCats.filter((c: any) => c.is_active));
      setBanks(listBanks);
      setSettings(settingsData);
    } catch (err: any) {
      showToast('error', extractErrorMessage(err));
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  useEffect(() => { fetchReferences(); }, [fetchReferences]);

  // ─── Currency: always the currency of the account the money lands in ───
  const catalog = useMemo(
    () => buildCurrencyCatalog(settings, banks.map(b => b.currency)),
    [settings, banks],
  );
  const baseCurrencyCode = catalog.base;
  const cashVaults = useMemo(() => banks.filter(b => b.account_type === 'cash_vault'), [banks]);
  const selectedBank = useMemo(() => banks.find(b => b.id === Number(bankAccount)), [banks, bankAccount]);

  const selectedCurrency = useMemo(() => {
    if (paymentMethod === 'cash') {
      // The backend credits the cashier's assigned vault; with a single vault we know its currency.
      return String((cashVaults.length === 1 ? cashVaults[0].currency : null) || baseCurrencyCode).toUpperCase();
    }
    return String(selectedBank?.currency || baseCurrencyCode).toUpperCase();
  }, [paymentMethod, cashVaults, selectedBank, baseCurrencyCode]);

  const currencyMeta = catalog.byCode[selectedCurrency];
  const symbol = currencySymbol(selectedCurrency, catalog) || selectedCurrency;
  const isNonBase = selectedCurrency !== baseCurrencyCode;

  const handleMethodChange = (method: GeneralPaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'cash') setBankAccount('');
  };

  // Strict Frontend File Extension Interception
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExts.includes(ext)) {
      showToast('error', `File extension "${ext}" is not allowed. Allowed extensions are: pdf, jpg, jpeg, png.`);
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Receipt file size must not exceed 5MB.');
      e.target.value = '';
      return;
    }
    setReceiptFile(file);
  };

  // 3. Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return showToast('error', 'Please select an income category.');
    if (!amount || parseFloat(amount) <= 0) return showToast('error', 'Amount must be greater than zero.');
    if (paymentMethod !== 'cash' && !bankAccount && settings?.track_bank_balance) {
      return showToast('error', `A destination bank account is strictly required for ${paymentMethod}.`);
    }
    if (paymentMethod !== 'cash' && settings?.require_proof_for_funding && !receiptFile) {
      return showToast('error', 'System settings strictly require uploading a proof of payment / receipt for non-cash income.');
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('category', String(category));
      formData.append('amount', amount);
      formData.append('payment_method', paymentMethod);
      formData.append('income_date', incomeDate);

      if (paymentMethod !== 'cash' && bankAccount) {
        formData.append('bank_account', String(bankAccount));
      }

      // The amount is in the receiving account's currency. Sent so the server can
      // reject a mismatch; for cash with several vaults the server decides.
      if (paymentMethod !== 'cash' || cashVaults.length === 1) formData.append('currency', selectedCurrency);

      if (source) formData.append('source', source);
      if (reference) formData.append('reference', reference);
      if (notes) formData.append('notes', notes);
      if (receiptFile) formData.append('receipt', receiptFile);

      const created: any = await incomeAPI.create(formData);
      showToast('success', 'Income record recorded and ledger updated successfully!');

      setTimeout(() => {
        if (postSubmitAction === 'create_another') {
          setAmount(''); setSource(''); setReference(''); setNotes(''); setReceiptFile(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setIsSubmitting(false);
        } else if (postSubmitAction === 'detail' && created?.id) {
          router.push(`/dashboard/staff/finance/incomes?open_detail=${created.id}`);
        } else {
          router.push('/dashboard/staff/finance/incomes');
        }
      }, 1000);
    } catch (err: any) {
      showToast('error', extractErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  if (loadingRefs) {
    return (
      <div className="p-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-2 text-sm text-slate-400">Loading income creation environment...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28 px-4 sm:px-0">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-blue-600" /> Record New Income
            </h1>
            <p className="text-sm text-slate-400">Log institutional inflows directly to ledger accounts</p>
          </div>
        </div>
      </div>

      <form id="income-create-form" onSubmit={handleSubmit} className="space-y-6">

        {/* Card 1: Core Details */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-blue-600" /> Classification & Method
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <CategoryPicker
                label="Income Category"
                value={category}
                onChange={setCategory}
                categories={categories}
              />
            </div>

            <div>
              <label className={labelCls}>Date Received <span className="text-red-500">*</span></label>
              <input required type="date" value={incomeDate} onChange={e => setIncomeDate(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Payment Method <span className="text-red-500">*</span></label>
              <select value={paymentMethod} onChange={e => handleMethodChange(e.target.value as GeneralPaymentMethod)} className={inputCls}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="pos">POS Terminal</option>
                <option value="cash">Physical Cash</option>
                <option value="cheque">Cheque</option>
                <option value="others">Other Clearance</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>
                Destination Account {paymentMethod !== 'cash' && <span className="text-red-500">*</span>}
              </label>
              {paymentMethod === 'cash' ? (
                <div className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-between">
                  <span>Targeting Assigned Physical Cash Vault</span>
                  <Wallet className="h-4 w-4 text-slate-400" />
                </div>
              ) : (
                <select
                  required={settings?.track_bank_balance}
                  value={bankAccount}
                  onChange={e => setBankAccount(Number(e.target.value))}
                  className={inputCls}
                >
                  <option value="">Select destination bank...</option>
                  {banks.filter(b => b.account_type !== 'cash_vault').map(b => (
                    <option key={b.id} value={b.id}>
                      [{String(b.currency || baseCurrencyCode).toUpperCase()}] {b.bank_name} ({b.account_number}) — Bal: {fmtCurrency(b.current_balance, b.currency || baseCurrencyCode, catalog)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Currency & Amounts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Coins className="h-4 w-4 text-emerald-600" /> Amount
            </h3>

            <div
              title="The currency follows the receiving account — money lands in that account in its own currency."
              className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-bold ${isNonBase ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-100 border-slate-200 text-slate-700'}`}
            >
              <Lock className="h-3 w-3 opacity-60" />
              <span>{selectedCurrency}{currencyMeta?.name && currencyMeta.name !== selectedCurrency ? ` · ${currencyMeta.name}` : ''}</span>
            </div>
          </div>

          {isNonBase && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <p className="text-xs font-medium leading-relaxed">
                This is going into a <strong>{selectedCurrency}</strong> account. Enter the amount in <strong>{currencyMeta?.name || selectedCurrency}</strong>.
                It is recorded and credited exactly as entered, with no conversion to {baseCurrencyCode}.
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>
              Amount Received ({selectedCurrency}) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400 pointer-events-none">{symbol}</span>
              <input
                type="number" step="0.01" min="0.01" required
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={`${inputCls} text-lg font-bold text-slate-900 ${symbol.length > 2 ? 'pl-14' : 'pl-9'}`}
              />
            </div>
            {selectedBank && paymentMethod !== 'cash' && (
              <p className="text-[11px] font-medium mt-1.5 text-slate-400">
                Current balance of {selectedBank.bank_name}: {fmtCurrency(selectedBank.current_balance, selectedCurrency, catalog)}
              </p>
            )}
          </div>
        </div>

        {/* Card 3: Supporting Information */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" /> Metadata & Proof
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Received From / Source</label>
              <input type="text" placeholder="e.g. PTA Committee, Ministry" value={source} onChange={e => setSource(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Reference Number</label>
              <input type="text" placeholder="e.g. TRF-908123" value={reference} onChange={e => setReference(e.target.value)} className={inputCls} />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Notes / Remarks</label>
              <textarea rows={3} placeholder="Additional context..." value={notes} onChange={e => setNotes(e.target.value)} className={inputCls + ' resize-none'} />
            </div>

            {/* File Upload */}
            <div className="md:col-span-2">
              <label className={labelCls}>
                Attach Receipt / Proof {paymentMethod !== 'cash' && settings?.require_proof_for_funding && <span className="text-red-500">* (Required)</span>}
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors bg-slate-50/50">
                <input type="file" id="receipt-upload" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center">
                  <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm font-semibold text-blue-600 hover:text-blue-700">Click to upload document</span>
                  <span className="text-xs text-slate-400 mt-1">Max 5MB (Allowed: PDF, JPG, PNG)</span>
                </label>
                {receiptFile && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
                    <span>Selected: {receiptFile.name}</span>
                    <button type="button" onClick={() => setReceiptFile(null)} className="text-blue-500 hover:text-red-500 font-bold ml-1">×</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </form>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl py-3 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Post-Submit Action Selector */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            <span className="w-full sm:w-auto">After Saving:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="redirectAction" checked={postSubmitAction === 'list'} onChange={() => setPostSubmitAction('list')} className="text-blue-600 focus:ring-blue-500" />
              Back to List
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="redirectAction" checked={postSubmitAction === 'create_another'} onChange={() => setPostSubmitAction('create_another')} className="text-blue-600 focus:ring-blue-500" />
              Stay & Add Another
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="redirectAction" checked={postSubmitAction === 'detail'} onChange={() => setPostSubmitAction('detail')} className="text-blue-600 focus:ring-blue-500" />
              View Details
            </label>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button type="button" disabled={isSubmitting} onClick={() => router.back()}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" form="income-create-form" disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Posting...</> : <><Check className="h-4 w-4" /> Save & Post Income</>}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}