'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { feeAPI } from '@/lib/api';
import { SchoolBankDetail } from '@/lib/type'; // adjust import to your actual type
import {
  Landmark, Plus, Edit3, Trash2, Check, X,
  AlertCircle, AlertTriangle, Loader2, Search,
  RefreshCw, HelpCircle, ChevronDown, Eye,
  DollarSign, TrendingUp, Building2, Activity,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function formatCurrency(amount: string | number, currency = 'NGN'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  // Show currency symbol based on value
  const symbol = currency.toLowerCase() === 'usd' ? '$' : '₦';
  return `${symbol}${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────

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
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Searchable Bank Select ──────────────────────────────────────────────────
// FIX #3: Searchable bank dropdown (mirrors the HTML select2 behaviour)

interface BankOption { bank_name: string; code: string; }

function SearchableBankSelect({
  value, onChange, disabled
}: {
  value: string;
  onChange: (bankName: string, bankCode: string) => void;
  disabled?: boolean;
}) {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingBanks(true);
    fetch('https://app.nuban.com.ng/bank_codes.json')
      .then(r => r.json())
      .then((data: BankOption[]) => setBanks(data))
      .catch(() => setBanks([]))
      .finally(() => setLoadingBanks(false));
  }, []);

  // Keep query in sync when value changes externally (e.g. editing pre-fills)
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = banks.filter(b =>
    b.bank_name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 50);

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white pr-9";

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={loadingBanks ? 'Loading banks...' : 'Search & select bank...'}
          className={inputCls}
        />
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {loadingBanks ? (
            <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading banks...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">No banks found</div>
          ) : filtered.map(b => (
            <button
              key={b.code}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                onChange(b.bank_name, b.code);
                setQuery(b.bank_name);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 transition-colors ${b.bank_name === value ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700'}`}
            >
              {b.bank_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helper Modal ──────────────────────────────────────────────────────────────

function HelperModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="h-4 w-4" /> Bank Accounts — Helper
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong>School Bank Accounts</strong> track where collected fees and wallet funding land. The running balance is updated automatically as payments are confirmed or reversed.
          </p>
          <div className="space-y-3">
            {[
              { title: 'Opening Balance', color: 'bg-emerald-100 text-emerald-700', desc: 'Set once when the account is first registered. It cannot be changed later — use the Adjust Balance action for manual corrections.' },
              { title: 'Current Balance', color: 'bg-teal-100 text-teal-700', desc: 'Maintained automatically by the system as payments are confirmed, reverted, or transfers out are approved.' },
              { title: 'Purpose', color: 'bg-slate-100 text-slate-600', desc: 'Restrict the account to Fee Payment, Wallet Funding, or both — mirrors how payment gateways are scoped.' },
            ].map(({ title, color, desc }) => (
              <div key={title} className="flex gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0 h-fit mt-0.5 ${color}`}>{title}</span>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
            <p className="text-xs text-emerald-700 leading-relaxed">
              <strong>Tip:</strong> The <strong>opening balance</strong> is a one-time seed value. If you made a mistake, use the <em>Adjust Balance</em> action on the detail page to correct it with a logged reason.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────

function ConfirmModal({ open, account, isDeleting, onConfirm, onCancel }: {
  open: boolean; account: SchoolBankDetail | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !account) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Bank Account</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{account.account_name}"</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</> : <><Trash2 className="h-4 w-4" />Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bank Account Form Modal ──────────────────────────────────────────────────

type BankPurpose = 'fee_payment' | 'wallet_funding' | 'both';

interface BankFormData {
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  currency: string;
  purpose: BankPurpose;
  opening_balance: string;
  is_active: boolean;
}

const EMPTY_FORM: BankFormData = {
  bank_name: '', bank_code: '', account_number: '', account_name: '',
  currency: 'naira', purpose: 'both', opening_balance: '0.00', is_active: true,
};

function BankAccountModal({ editing, isSaving, onSave, onClose }: {
  editing: SchoolBankDetail | null; isSaving: boolean;
  onSave: (data: BankFormData) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<BankFormData>(
    editing ? {
      bank_name: editing.bank_name,
      bank_code: (editing as any).bank_code || '',
      account_number: editing.account_number,
      account_name: editing.account_name,
      // FIX #1: currency field appears once — do not duplicate
      currency: editing.currency || 'naira',
      purpose: editing.purpose as BankPurpose,
      opening_balance: editing.opening_balance?.toString() || '0.00',
      is_active: editing.is_active,
    } : EMPTY_FORM
  );
  const [formError, setFormError] = useState<string | null>(null);

  const isNaira = form.currency === 'naira';

  const validateForm = (): string | null => {
    if (!form.bank_name.trim()) return isNaira ? 'Please select a bank.' : 'Bank / institution name is required.';
    if (form.account_number.trim().length < 5) return 'Account number must be at least 5 characters.';
    // Naira (NUBAN) = digits only; foreign accounts may contain letters
    if (isNaira && !/^[0-9]+$/.test(form.account_number.trim())) return 'Account number must contain digits only.';
    if (form.account_name.trim().length < 5) return 'Account name must be at least 5 characters.';
    if (!editing && (isNaN(parseFloat(form.opening_balance)) || parseFloat(form.opening_balance) < 0))
      return 'Opening balance must be a non-negative number.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const err = validateForm();
    if (err) { setFormError(err); return; }
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
  const readonlyCls = "w-full px-3.5 py-2.5 text-sm border border-slate-100 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            {editing ? 'Edit Bank Account' : 'New Bank Account'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form id="bank-account-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{formError}</span>
              </div>
            )}

            {/* Currency first — controls whether bank field is a picker or free text */}
            <div>
              <label className={labelCls}>Currency <span className="text-red-400 normal-case">*</span></label>
              <select value={form.currency}
                onChange={e => {
                  // When switching away from naira, clear the bank code (not meaningful for foreign banks)
                  const next = e.target.value;
                  setForm(f => ({ ...f, currency: next, bank_code: next === 'naira' ? f.bank_code : '' }));
                }}
                className={inputCls}>
                <option value="naira">Naira (₦)</option>
                <option value="usd">US Dollar ($)</option>
                <option value="gbp">British Pound (£)</option>
                <option value="eur">Euro (€)</option>
              </select>
            </div>

            {/* Bank name — searchable picker for Naira, free text for foreign currencies */}
            <div>
              <label className={labelCls}>
                {isNaira ? 'Bank Name' : 'Bank / Institution Name'}
                {' '}<span className="text-red-400 normal-case">*</span>
              </label>
              {isNaira ? (
                <SearchableBankSelect
                  value={form.bank_name}
                  onChange={(name, code) => setForm(f => ({ ...f, bank_name: name, bank_code: code }))}
                  disabled={isSaving}
                />
              ) : (
                <input
                  type="text" value={form.bank_name}
                  onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                  placeholder="e.g. Barclays, Chase, HSBC..."
                  className={inputCls}
                />
              )}
            </div>

            {/* FIX #2: Account name takes full row */}
            <div>
              <label className={labelCls}>Account Name <span className="text-red-400 normal-case">*</span></label>
              <input
                type="text" value={form.account_name} minLength={5}
                onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                placeholder="e.g. School Fees Collection Account"
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1">Minimum 5 characters.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* FIX #6: account number numeric */}
              <div>
                <label className={labelCls}>Account Number <span className="text-red-400 normal-case">*</span></label>
                <input
                  type="text" value={form.account_number} minLength={5}
                  onChange={e => {
                    // Naira: digits only (NUBAN); foreign: alphanumeric (IBAN etc.)
                    const val = isNaira
                      ? e.target.value.replace(/[^0-9]/g, '')
                      : e.target.value.replace(/\s/g, '').toUpperCase();
                    setForm(f => ({ ...f, account_number: val }));
                  }}
                  placeholder={isNaira ? 'e.g. 0123456789' : 'e.g. GB29NWBK60161331926819'}
                  className={`${inputCls} font-mono`}
                  inputMode={isNaira ? 'numeric' : 'text'}
                  maxLength={34}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {isNaira ? 'Digits only, min 5.' : 'Alphanumeric, min 5 characters.'}
                </p>
              </div>

              {/* account number hint only shown for naira */}
              {isNaira && (
                <div className="col-span-1 flex items-end pb-1">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Nigerian NUBAN accounts are 10 digits.
                  </p>
                </div>
              )}
            </div>

            {/* Purpose */}
            <div>
              <label className={labelCls}>Purpose <span className="text-red-400 normal-case">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'fee_payment', label: 'Fees Only' },
                  { id: 'wallet_funding', label: 'Wallet Only' },
                  { id: 'both', label: 'Fees & Wallet' },
                ].map(p => (
                  <button key={p.id} type="button"
                    onClick={() => setForm(f => ({ ...f, purpose: p.id as BankPurpose }))}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                      form.purpose === p.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* FIX #4: Opening balance — readonly on edit */}
            <div>
              <label className={labelCls}>
                Opening Balance
                {editing && <span className="text-slate-300 normal-case font-normal ml-1">(set at creation — use Adjust Balance to correct)</span>}
                {!editing && <span className="text-red-400 normal-case ml-1">*</span>}
              </label>
              {editing ? (
                <div className="relative">
                  <input
                    type="text"
                    value={formatCurrency(editing.opening_balance, editing.currency)}
                    readOnly
                    className={readonlyCls}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-lg">Locked</span>
                </div>
              ) : (
                <input
                  type="number" min="0" step="0.01" value={form.opening_balance}
                  onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                  placeholder="0.00" className={inputCls}
                />
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs font-bold text-slate-700">Active</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="bank-account-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Account' : 'Create Account'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BankAccountsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [accounts, setAccounts]       = useState<SchoolBankDetail[]>([]);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [showHelper, setShowHelper]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [editingAccount, setEditingAccount] = useState<SchoolBankDetail | null>(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<SchoolBankDetail | null>(null);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [toasts, setToasts]           = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const res = await feeAPI.getBankAccounts();
      setAccounts(Array.isArray(res) ? res : (res.results || []));
    } catch (err) { setPageError(extractError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingAccount(null); setShowModal(true); };
  const openEdit   = (a: SchoolBankDetail) => { setEditingAccount(a); setShowModal(true); };

  const handleSave = async (data: BankFormData) => {
    setIsSaving(true);
    try {
      if (editingAccount) {
        // FIX #4: Do NOT send opening_balance on update — backend should ignore it,
        // but we exclude it here to be safe and explicit.
        const { opening_balance, ...updatePayload } = data;
        const updated = await feeAPI.updateBankAccount(editingAccount.id, updatePayload);
        setAccounts(prev => prev.map(a => a.id === editingAccount.id ? updated : a));
        showToast('success', `"${updated.account_name}" updated successfully`);
      } else {
        const created = await feeAPI.createBankAccount(data);
        setAccounts(prev => [created, ...prev]);
        showToast('success', `"${created.account_name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) { throw err; }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    setIsDeleting(true);
    try {
      await feeAPI.deleteBankAccount(deletingAccount.id);
      setAccounts(prev => prev.filter(a => a.id !== deletingAccount.id));
      showToast('success', `"${deletingAccount.account_name}" deleted`);
      setDeletingAccount(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingAccount(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = accounts.filter(a =>
    !search ||
    a.bank_name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_number.includes(search)
  );

  // Aggregate stats
  const totalBalance = accounts.reduce((s, a) => s + parseFloat(String(a.current_balance || 0)), 0);
  const activeCount  = accounts.filter(a => a.is_active).length;
  const currencies   = new Set(accounts.map(a => a.currency)).size;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showHelper && <HelperModal onClose={() => setShowHelper(false)} />}

      <ConfirmModal
        open={!!deletingAccount} account={deletingAccount} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingAccount(null)}
      />

      {showModal && (
        <BankAccountModal
          editing={editingAccount} isSaving={isSaving}
          onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Landmark className="h-5 w-5 text-white" />
            </div>
            Bank Accounts
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">School bank accounts for fee collection &amp; wallet funding</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelper(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            <HelpCircle className="h-4 w-4 text-sky-500" /> Helper
          </button>
          {canManage && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all shadow-md shadow-emerald-200">
              <Plus className="h-4 w-4" /> Add Account
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Accounts', value: loading ? '—' : accounts.length, icon: Building2, color: 'from-emerald-500 to-teal-600' },
          { label: 'Active',         value: loading ? '—' : activeCount,     icon: Activity,  color: 'from-blue-500 to-indigo-600' },
          { label: 'Total Balance',  value: loading ? '—' : `₦${totalBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'from-amber-500 to-orange-600' },
          { label: 'Currencies',     value: loading ? '—' : currencies,      icon: DollarSign, color: 'from-purple-500 to-indigo-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List ── */}
      <div className="space-y-4">
        {/* Search + Refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search accounts..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 shadow-sm" />
          </div>
          <button onClick={fetchData} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border p-20 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mx-auto" />
            <p className="mt-4 text-slate-400 text-sm">Loading bank accounts...</p>
          </div>
        ) : pageError ? (
          <div className="bg-white rounded-2xl border border-red-100 p-16 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 mb-4">{pageError}</p>
            <button onClick={fetchData} className="px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-20 text-center">
            <Landmark className="h-14 w-14 text-slate-200 mx-auto mb-4" />
            <h3 className="font-bold text-slate-700">{search ? 'No match found' : 'No bank accounts yet'}</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
              {search ? 'Try a different name, account number, or bank.' : 'Add your first school bank account to start tracking balances.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map(a => (
              <div key={a.id} className={`group bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md hover:border-emerald-200 transition-all ${!a.is_active && 'opacity-70'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Landmark className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{a.bank_name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{a.account_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* FIX #8: Detail page link */}
                    <a
                      href={`/dashboard/staff/fee/bank-accounts/${a.id}`}
                      className="p-2 text-sky-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(a)} className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Account">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeletingAccount(a)} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Account">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Account No.</span>
                    <span className="text-xs font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                      {a.account_number}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Purpose</span>
                    <span className="text-[10px] font-bold text-slate-700 capitalize px-2 py-0.5 bg-slate-100 rounded-lg">
                      {a.purpose === 'both' ? 'Fees & Wallet' : a.purpose?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Opening Bal.</span>
                    <span className="text-xs font-semibold text-slate-600">
                      {formatCurrency(a.opening_balance, a.currency)}
                    </span>
                  </div>

                  {/* Current balance — prominent */}
                  <div className="mt-3 pt-3 border-t border-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Current Balance</span>
                      <span className={`text-sm font-bold ${parseFloat(String(a.current_balance)) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {formatCurrency(a.current_balance, a.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${a.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-50 text-slate-500 border border-slate-100 capitalize">
                      {a.currency}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}