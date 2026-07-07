'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { bankDetailsAPI, financeSettingsAPI, staffAPI } from '@/lib/api';
import type { SchoolBankDetail, SchoolBankDetailFormValues, BankPurpose, AccountType, FinanceSettings } from '@/lib/finance.types';
import {
  Building, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  CreditCard, Wallet, Sliders, ArrowUpDown, PlusCircle, MinusCircle, Equal,
  ArrowRightLeft, FileText, Banknote, Landmark, UserCircle, Users
} from 'lucide-react';

// ─── Helpers & Storage Keys ────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }
const REDIRECT_PREF_KEY = 'FINANCE_TRANSFER_REDIRECT_PREF';

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d.slice(0, 150);
    if (d.detail) return String(d.detail).slice(0, 150);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v[0] : String(v)}`)
        .join('\n');
      if (fields) return fields.slice(0, 200);
    }
    if (d.message) return String(d.message).slice(0, 150);
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: number, symbol = '₦'): string {
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-fade-in
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-600" />}
          <p className="text-sm font-medium flex-1 leading-snug whitespace-pre-line">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, bank, isDeleting, strictMode, onConfirm, onCancel }: {
  open: boolean; bank: SchoolBankDetail | null; isDeleting: boolean; strictMode: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !bank) return null;
  const currentBal = Number(bank.current_balance || 0);
  const hasBalance = currentBal > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${hasBalance && strictMode ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
          {hasBalance && strictMode ? 'Deactivation Required' : 'Delete Account'}
        </h3>
        {hasBalance && strictMode ? (
          <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">
            Strict Accounting Mode is active and this account currently holds <span className="font-bold font-mono text-slate-800">{fmtMoney(currentBal, bank.currency + ' ')}</span>. You cannot delete an account with liquid funds. Please transfer the funds out or reconcile balance to zero first.
          </p>
        ) : (
          <p className="text-sm text-slate-500 text-center mb-6">
            Are you sure you want to permanently delete <span className="font-semibold text-slate-700">"{bank.bank_name}"</span>? This action cannot be undone.
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {hasBalance && strictMode ? 'Understood' : 'Cancel'}
          </button>
          {(!hasBalance || !strictMode) && (
            <button onClick={onConfirm} disabled={isDeleting}
              className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Adjust Balance Modal ──────────────────────────────────────────────────────
function AdjustBalanceModal({ open, bank, isAdjusting, onConfirm, onCancel, showToast }: {
  open: boolean; bank: SchoolBankDetail | null; isAdjusting: boolean;
  onConfirm: (adjustmentType: 'add' | 'subtract' | 'set', amount: string, reason: string) => Promise<void>;
  onCancel: () => void; showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (bank) { setAdjustmentType('add'); setAmount(''); setReason(''); }
  }, [bank]);

  if (!open || !bank) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      showToast('error', 'Please enter a valid numeric adjustment amount greater than 0.'); return;
    }
    const currentBal = Number(bank.current_balance || 0);
    if (adjustmentType === 'subtract' && numAmount > currentBal) {
      showToast('error', `Cannot subtract ${fmtMoney(numAmount, bank.currency + ' ')} because it exceeds available balance.`); return;
    }
    if (!reason.trim()) { showToast('error', 'An audit explanation is mandatory for reconciliation corrections.'); return; }
    try { await onConfirm(adjustmentType, amount, reason); }
    catch (err) { showToast('error', extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white font-medium text-slate-800";
  const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="h-5 w-5" /> Balance Reconciliation
          </h3>
          <button onClick={onCancel} disabled={isAdjusting} className="text-white/80 hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form id="adjust-form" onSubmit={handleSubmit} className="overflow-y-auto p-6 flex-1 space-y-5">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current System Balance</p>
              <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                {fmtMoney(Number(bank.current_balance || 0), bank.currency + ' ')}
              </p>
            </div>
            <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
              <p className="text-xs font-bold text-slate-800 truncate">{bank.bank_name}</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{bank.account_type === 'cash_vault' ? 'Physical Safe' : `Acc: ${bank.account_number}`}</p>
            </div>
          </div>

          <div>
            <label className={labelCls}>Reconciliation Action</label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'add' as const, label: 'Add Funds (+)', icon: PlusCircle, color: 'text-emerald-700 border-emerald-600 bg-emerald-50' },
                { id: 'subtract' as const, label: 'Remove Funds (-)', icon: MinusCircle, color: 'text-rose-700 border-rose-600 bg-rose-50' },
                { id: 'set' as const, label: 'Set Exact Balance (=)', icon: Equal, color: 'text-blue-700 border-blue-600 bg-blue-50' },
              ].map(op => (
                <button key={op.id} type="button" onClick={() => setAdjustmentType(op.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    adjustmentType === op.id ? op.color : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                  <op.icon className="h-4 w-4 mb-1" /> {op.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Amount ({bank.currency})</label>
            <input required type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Audit Explanation <span className="text-red-500">*</span></label>
            <textarea required rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Explain why the balance is being adjusted..." className={inputCls} />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <button type="button" onClick={onCancel} disabled={isAdjusting} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600">
            Cancel
          </button>
          <button type="submit" form="adjust-form" disabled={isAdjusting} className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2">
            {isAdjusting ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <><Check className="h-4 w-4" /> Post Adjustment</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Record Transfer Slide-Out Drawer ──────────────────────────────────────────
function TransferDrawer({ open, onClose, accounts, settings, onSuccess, showToast }: {
  open: boolean; onClose: () => void; accounts: SchoolBankDetail[]; settings: FinanceSettings | null;
  onSuccess: () => void; showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [redirectPref, setRedirectPref] = useState<'same_page' | 'ledger_index' | 'account_detail'>('same_page');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setSourceId(''); setDestId(''); setAmount(''); setExchangeRate(''); setReason('');
      const saved = localStorage.getItem(REDIRECT_PREF_KEY) as any;
      if (saved && ['same_page', 'ledger_index', 'account_detail'].includes(saved)) {
        setRedirectPref(saved);
      }
    }
  }, [open]);

  const sourceBank = accounts.find(a => String(a.id) === sourceId) || null;
  const destBank = accounts.find(a => String(a.id) === destId) || null;
  const isCrossCurrency = sourceBank && destBank && sourceBank.currency !== destBank.currency;

  useEffect(() => {
    if (isCrossCurrency && settings?.currency_config?.supported_currencies && !exchangeRate) {
      const srcRate = sourceBank.currency === settings.currency_config.base_currency ? 1 : (settings.currency_config.supported_currencies[sourceBank.currency]?.rate_to_base || 1);
      const dstRate = destBank.currency === settings.currency_config.base_currency ? 1 : (settings.currency_config.supported_currencies[destBank.currency]?.rate_to_base || 1);
      const calcRate = dstRate / srcRate;
      if (calcRate && calcRate !== 1) setExchangeRate(calcRate.toFixed(4));
    }
  }, [isCrossCurrency, sourceBank, destBank, settings, exchangeRate]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !destId) {
      showToast('error', 'Please select explicitly both a source and destination account.'); return;
    }
    if (sourceId === destId) {
      showToast('error', 'Source and destination accounts cannot be identical.'); return;
    }
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      showToast('error', 'Please provide a valid transfer amount greater than zero.'); return;
    }
    if (!reason.trim()) {
      showToast('error', 'Please provide both a transfer amount and an audit explanation.'); return;
    }
    if (settings?.max_funding_amount && numAmount > Number(settings.max_funding_amount)) {
      showToast('error', `Transfer amount exceeds the maximum ceiling limit of ${fmtMoney(Number(settings.max_funding_amount))}`); return;
    }
    if (sourceBank && numAmount > Number(sourceBank.current_balance || 0)) {
      showToast('error', `Insufficient funds in ${sourceBank.bank_name}. Available: ${fmtMoney(Number(sourceBank.current_balance), sourceBank.currency + ' ')}`); return;
    }

    let destAmountStr = amount;
    if (isCrossCurrency) {
      const rateNum = Number(exchangeRate);
      if (!exchangeRate || isNaN(rateNum) || rateNum <= 0) {
        showToast('error', 'Please provide a valid exchange rate for cross-currency transfers.'); return;
      }
      destAmountStr = (numAmount * rateNum).toFixed(2);
    }

    setLoading(true);
    try {
      await bankDetailsAPI.transferFunds({
          source_bank_id: Number(sourceId),
          destination_bank_id: Number(destId),
          amount: amount,
          reason: reason,
      });
      localStorage.setItem(REDIRECT_PREF_KEY, redirectPref);
      onSuccess();
      onClose();

      if (redirectPref === 'ledger_index') {
        router.push('/finance/bank-ledger');
      } else if (redirectPref === 'account_detail' && destId) {
        router.push(`/finance/bank-accounts/${destId}`);
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setLoading(false); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white font-medium text-slate-800";
  const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 flex items-center justify-between text-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <ArrowRightLeft className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold">Record Transfer</h3>
            </div>
            <button onClick={onClose} disabled={loading} className="text-white/80 hover:text-white p-1 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form id="transfer-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
            <div>
              <label className={labelCls}>Source Account (Withdraw From)</label>
              <select value={sourceId} onChange={e => setSourceId(e.target.value)} className={inputCls} required>
                <option value="">Select account</option>
                {accounts.filter(a => a.is_active).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.account_type === 'cash_vault' ? '[Cash Safe] ' : ''}{a.bank_name} ({fmtMoney(Number(a.current_balance), a.currency + ' ')})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center -my-2">
              <div className="p-2 bg-slate-100 rounded-full text-slate-400 border border-slate-200 shadow-sm">
                <ArrowUpDown className="h-4 w-4" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Destination Account (Deposit To)</label>
              <select value={destId} onChange={e => setDestId(e.target.value)} className={inputCls} required>
                <option value="">Select account</option>
                {accounts.filter(a => a.is_active).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.account_type === 'cash_vault' ? '[Cash Safe] ' : ''}{a.bank_name} ({fmtMoney(Number(a.current_balance), a.currency + ' ')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Transfer Amount ({sourceBank?.currency || 'NGN'})</label>
              <input required type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
              {amount && !isNaN(Number(amount)) && (
                <div className="mt-1 text-xs font-mono font-bold text-slate-600">
                  Formatted: {fmtMoney(Number(amount), (sourceBank?.currency || '₦') + ' ')}
                </div>
              )}
            </div>

            {isCrossCurrency && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <Sliders className="h-3.5 w-3.5 text-emerald-600" /> Cross-Currency Conversion
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Exchange Rate (1 {sourceBank?.currency} = ? {destBank?.currency})
                  </label>
                  <input required type="number" step="0.0001" min="0.0001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="e.g. 1500.00" className={inputCls} />
                </div>
                {amount && exchangeRate && !isNaN(Number(amount)) && !isNaN(Number(exchangeRate)) && (
                  <div className="text-xs font-semibold text-emerald-900 bg-white p-2.5 rounded-lg border border-emerald-200/80">
                    Destination Credit: <span className="font-mono font-bold">{fmtMoney(Number(amount) * Number(exchangeRate), destBank?.currency + ' ')}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className={labelCls}>Audit Reason <span className="text-red-500">*</span></label>
              <textarea required rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Petty cash replenishment..." className={inputCls} />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">After Saving Redirect To:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'same_page' as const, label: 'Stay Here' },
                  { id: 'ledger_index' as const, label: 'Ledger Index' },
                  { id: 'account_detail' as const, label: 'Account View' }
                ].map(p => (
                  <button key={p.id} type="button" onClick={() => setRedirectPref(p.id)}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all ${
                      redirectPref === p.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </form>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600">
              Cancel
            </button>
            <button type="submit" form="transfer-form" disabled={loading} className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Transferring...</> : <><Check className="h-4 w-4" /> Execute Transfer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Debounced Staff Search Overlay for Cash Box Assignment ────────────────────
function StaffSearchOverlay({ assignedIds, onAssign, onRemove }: {
  assignedIds: number[]; onAssign: (staff: any) => void; onRemove: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (query.trim().length < 2) { setResults([]); return; }
    searchDebounce.current = setTimeout(() => {
      setLoading(true);
      staffAPI.list({ search: query.trim(), page_size: 5 })
        .then((res: any) => {
          const list = res?.results ?? res?.data ?? res ?? [];
          setResults(Array.isArray(list) ? list : []);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [query]);

  return (
    <div className="space-y-3 pt-2 border-t border-slate-200">
      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Authorized Cashier Staff Assignment</label>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Type staff name or ID to attach to safe..."
          className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium" />
      </div>

      {loading && <div className="text-xs text-slate-400 flex items-center gap-1.5 py-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching staff records...</div>}

      {results.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-36 overflow-y-auto">
          {results.map(st => {
            const isAssigned = assignedIds.includes(st.id);
            return (
              <div key={st.id} className="p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCircle className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span className="font-bold truncate">{st.full_name || `${st.first_name || ''} ${st.last_name || ''}`}</span>
                  <span className="font-mono text-[10px] text-slate-400">({st.staff_id})</span>
                </div>
                <button type="button" disabled={isAssigned} onClick={() => onAssign(st)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${isAssigned ? 'bg-slate-200 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                  {isAssigned ? 'Assigned' : '+ Attach'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {assignedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {assignedIds.map(id => (
            <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
              <span>Staff ID #{id}</span>
              <button type="button" onClick={() => onRemove(id)} className="hover:text-red-600"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bank Registration Modal ───────────────────────────────────────────────────
interface BankOption { bank_name: string; code: string; }

function BankModal({
  editing, isSaving, onSave, onClose, configuredCurrencies, baseCurrency, strictMode, lockedType, showToast
}: {
  editing: SchoolBankDetail | null; isSaving: boolean;
  onSave: (data: SchoolBankDetailFormValues) => Promise<void>; onClose: () => void;
  configuredCurrencies: string[]; baseCurrency: string; strictMode: boolean; lockedType: AccountType | null;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [form, setForm] = useState<SchoolBankDetailFormValues>(
    editing ? {
      bank_name: editing.bank_name,
      account_number: editing.account_number,
      account_name: editing.account_name,
      currency: editing.currency || baseCurrency,
      purpose: editing.purpose || 'both',
      account_type: (editing.account_type as AccountType) || 'bank',
      assigned_cashiers: (editing as any).assigned_cashiers || [],
      opening_balance: editing.opening_balance || '0.00',
      is_active: editing.is_active,
    } : {
      bank_name: '',
      account_number: '',
      account_name: '',
      currency: baseCurrency,
      purpose: 'both',
      account_type: lockedType || 'bank',
      assigned_cashiers: [],
      opening_balance: '0.00',
      is_active: true,
    }
  );

  const [banksList, setBanksList] = useState<BankOption[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [usePlainTextInput, setUsePlainTextInput] = useState(false);

  const isCashBox = form.account_type === 'cash_vault';
  const isForeignCurrency = !isCashBox && form.currency !== baseCurrency;

  useEffect(() => {
    if (isCashBox) {
      setForm(prev => ({ ...prev, currency: baseCurrency, purpose: 'both', account_number: '', account_name: '' }));
    }
  }, [isCashBox, baseCurrency]);

  useEffect(() => {
    let active = true;
    const fetchBanksForCurrency = async () => {
      setLoadingBanks(true); setBanksList([]); setUsePlainTextInput(false);
      try {
        if (form.currency === 'NGN' && !isCashBox) {
          const res = await fetch('https://app.nuban.com.ng/bank_codes.json', { signal: AbortSignal.timeout(4000) });
          if (!res.ok) throw new Error('API down');
          const data = await res.json();
          if (active && Array.isArray(data)) setBanksList(data);
        } else {
          if (active) setUsePlainTextInput(true);
        }
      } catch { if (active) setUsePlainTextInput(true); }
      finally { if (active) setLoadingBanks(false); }
    };
    fetchBanksForCurrency();
    return () => { active = false; };
  }, [form.currency, isCashBox]);

  const set = <K extends keyof SchoolBankDetailFormValues>(key: K, value: SchoolBankDetailFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bank_name.trim()) { showToast('error', 'Account title or institution name is required.'); return; }
    if (!isCashBox && (!form.account_number?.trim() || !form.account_name?.trim())) {
      showToast('error', 'Account Number and Account Name are mandatory for commercial Bank Accounts.'); return;
    }

    let finalOpeningBalance = form.opening_balance;
    if (!strictMode && !finalOpeningBalance) finalOpeningBalance = '0.00';

    try {
      await onSave({ ...form, opening_balance: finalOpeningBalance || '0.00' });
    } catch (err) { showToast('error', extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white font-medium text-slate-800";
  const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            {isCashBox ? <Banknote className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
            {editing ? 'Edit Configuration' : 'Register Account'}
          </h3>
          <button onClick={onClose} disabled={isSaving} className="text-white/80 hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <form id="bank-form" onSubmit={handleSubmit} className="space-y-5">
            {!editing && (
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-xl border border-slate-200/80">
                <button type="button" disabled={Boolean(lockedType)} onClick={() => set('account_type', 'bank')}
                  className={`py-2.5 px-4 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    !isCashBox ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800 disabled:opacity-50'
                  }`}>
                  <Landmark className="h-4 w-4 text-emerald-600" /> Commercial Bank
                </button>
                <button type="button" disabled={Boolean(lockedType)} onClick={() => set('account_type', 'cash_vault')}
                  className={`py-2.5 px-4 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    isCashBox ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800 disabled:opacity-50'
                  }`}>
                  <Banknote className="h-4 w-4 text-amber-600" /> Physical Cash Safe
                </button>
              </div>
            )}

            {!isCashBox && (
              <div>
                <label className={labelCls}>Account Currency <span className="text-red-500">*</span></label>
                <select required value={form.currency} onChange={e => set('currency', e.target.value)} className={inputCls}>
                  {configuredCurrencies.map(curr => <option key={curr} value={curr}>{curr}</option>)}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <label className={labelCls}>
                  {isCashBox ? 'Safe / Till Identifier Title' : 'Bank Institution Name'} <span className="text-red-500">*</span>
                </label>
                {!isCashBox && !loadingBanks && banksList.length > 0 && (
                  <button type="button" onClick={() => setUsePlainTextInput(!usePlainTextInput)} className="text-[11px] font-semibold text-emerald-600 hover:underline mb-1">
                    {usePlainTextInput ? 'Select from directory' : 'Type manually'}
                  </button>
                )}
              </div>
              {loadingBanks ? (
                <div className="flex items-center gap-2 px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Checking bank directory...
                </div>
              ) : isCashBox || usePlainTextInput || banksList.length === 0 ? (
                <input required type="text" value={form.bank_name} onChange={e => set('bank_name', e.target.value)}
                  placeholder={isCashBox ? "e.g. Main Bursary Cash Box" : "e.g. Chase Bank, Zenith Bank PLC"} className={inputCls} />
              ) : (
                <select required value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className={inputCls}>
                  <option value="">Select Bank Institution</option>
                  {banksList.map(bank => <option key={bank.code} value={bank.bank_name}>{bank.bank_name}</option>)}
                </select>
              )}
            </div>

            {!isCashBox && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Registered Holder Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.account_name || ''} onChange={e => set('account_name', e.target.value)} placeholder="e.g. Greenfield Academy Revenue" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Account Number <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.account_number || ''} onChange={e => set('account_number', e.target.value)} placeholder="e.g. 0123456789" className={inputCls} />
                </div>
              </div>
            )}

            {!isCashBox && (
              <div>
                <label className={labelCls}>Account Purpose <span className="text-red-500">*</span></label>
                <select value={form.purpose} onChange={e => set('purpose', e.target.value as BankPurpose)} className={inputCls}>
                  <option value="both">Both Fees & Wallet Funding</option>
                  <option value="fee_payment">Fee Collections Only</option>
                  <option value="wallet_funding">Wallet Deposits Only</option>
                </select>
              </div>
            )}

            {isCashBox && (
              <StaffSearchOverlay
                assignedIds={form.assigned_cashiers || []}
                onAssign={st => set('assigned_cashiers', [...(form.assigned_cashiers || []), st.id])}
                onRemove={id => set('assigned_cashiers', (form.assigned_cashiers || []).filter(item => item !== id))}
              />
            )}

            {(strictMode || form.opening_balance !== '0.00') && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Day-1 Baseline Balance ({form.currency})</label>
                <input type="number" step="0.01" min="0" value={form.opening_balance}
                  onChange={e => set('opening_balance', e.target.value)} disabled={Boolean(editing)} placeholder="0.00" className={inputCls} />

                {form.opening_balance && !isNaN(Number(form.opening_balance)) && (
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs font-mono font-bold flex justify-between">
                    <span>Entered Balance Preview:</span>
                    <span className="text-emerald-700">{fmtMoney(Number(form.opening_balance), form.currency + ' ')}</span>
                  </div>
                )}
                {editing && <p className="text-[11px] text-slate-400">Locked permanently after registration.</p>}
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-800">Operational Status</p>
                <p className="text-xs text-slate-500">Allow new transactions against this account</p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active} onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl">
            Cancel
          </button>
          <button type="submit" form="bank-form" disabled={isSaving} className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Saving...'}</> : <><Check className="h-4 w-4" />{editing ? 'Update Account' : 'Register Account'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function BankAccountsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [configuredCurrencies, setConfiguredCurrencies] = useState<string[]>(['NGN']);
  const [baseCurrency, setBaseCurrency] = useState<string>('NGN');
  const [strictMode, setStrictMode] = useState<boolean>(true);

  const [accounts, setAccounts] = useState<SchoolBankDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'cash_vault' | 'bank'>('cash_vault');
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SchoolBankDetail | null>(null);
  const [lockedModalType, setLockedModalType] = useState<AccountType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState<SchoolBankDetail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [adjustingAccount, setAdjustingAccount] = useState<SchoolBankDetail | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const [showTransferDrawer, setShowTransferDrawer] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('finance.add_schoolbankdetailmodel');
  const canEdit   = user?.is_superuser || hasPermission('finance.change_schoolbankdetailmodel');
  const canDelete = user?.is_superuser || hasPermission('finance.delete_schoolbankdetailmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [accData, setData] = await Promise.all([
        bankDetailsAPI.list(),
        financeSettingsAPI.get().catch(() => null)
      ]);
      setAccounts(Array.isArray(accData) ? accData : []);
      if (setData) {
        setSettings(setData);
        setStrictMode(setData.track_bank_balance);
        if (setData.currency_config?.base_currency) setBaseCurrency(setData.currency_config.base_currency);
        if (setData.currency_config?.supported_currencies) {
          const currs = Object.keys(setData.currency_config.supported_currencies);
          if (currs.length > 0) setConfiguredCurrencies(currs);
        }
      }
    } catch (err) { showToast('error', extractError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  const openCreate = (type?: AccountType, lock = false) => {
    setEditingAccount(null);
    setLockedModalType(lock && type ? type : null);
    if (type) setActiveTab(type);
    setShowModal(true);
  };

  const openEdit = (account: SchoolBankDetail) => {
    setEditingAccount(account);
    setLockedModalType(null);
    setShowModal(true);
  };

  const handleSave = async (form: SchoolBankDetailFormValues) => {
    setIsSaving(true);
    try {
      if (editingAccount) {
        const updated = await bankDetailsAPI.update(editingAccount.id, form);
        setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
        showToast('success', `"${updated.bank_name}" updated successfully.`);
      } else {
        const created = await bankDetailsAPI.create(form);
        setAccounts(prev => [created, ...prev]);
        setActiveTab(created.account_type as AccountType);
        showToast('success', `"${created.bank_name}" registered successfully.`);
      }
      setShowModal(false);
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    setIsDeleting(true);
    try {
      await bankDetailsAPI.delete(deletingAccount.id);
      setAccounts(prev => prev.filter(a => a.id !== deletingAccount.id));
      showToast('success', `"${deletingAccount.bank_name}" removed successfully.`);
      setDeletingAccount(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingAccount(null);
    } finally { setIsDeleting(false); }
  };

  const handleAdjustBalance = async (adjustmentType: 'add' | 'subtract' | 'set', amount: string, reason: string) => {
    if (!adjustingAccount) return;
    setIsAdjusting(true);
    try {
      const updated = await bankDetailsAPI.adjustBalance(adjustingAccount.id, { adjustment_type: adjustmentType, amount, reason });
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast('success', 'Balance reconciled successfully.');
      setAdjustingAccount(null);
    } finally { setIsAdjusting(false); }
  };

  const calculateNormalizedTotal = (typeFilter?: AccountType) => {
    const list = typeFilter ? accounts.filter(a => a.account_type === typeFilter && a.is_active) : accounts.filter(a => a.is_active);
    return list.reduce((sum, acc) => {
      const bal = Number(acc.current_balance || 0);
      let rate = 1;
      if (acc.currency !== baseCurrency && settings?.currency_config?.supported_currencies) {
        rate = settings.currency_config.supported_currencies[acc.currency]?.rate_to_base || 1;
      }
      return sum + (bal * rate);
    }, 0);
  };

  const totalCashNormalized = calculateNormalizedTotal('cash_vault');
  const totalBankNormalized = calculateNormalizedTotal('bank');
  const totalLiquidNormalized = calculateNormalizedTotal();

  const hasCashBox = accounts.some(a => a.account_type === 'cash_vault');

  // Strictly order and sort list: Commercial Banks first at top, followed by Cash Boxes below
  const filteredAccounts = accounts
    .filter(a => {
      const matchTab = a.account_type === activeTab;
      const matchSearch = a.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (a.account_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (a.account_number || '').includes(searchTerm);
      const matchActive = !showActiveOnly || a.is_active;
      return matchTab && matchSearch && matchActive;
    })
    .sort((a, b) => {
      if (a.account_type === 'bank' && b.account_type === 'cash_vault') return -1;
      if (a.account_type === 'cash_vault' && b.account_type === 'bank') return 1;
      return a.bank_name.localeCompare(b.bank_name);
    });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal open={!!deletingAccount} bank={deletingAccount} isDeleting={isDeleting} strictMode={strictMode}
        onConfirm={handleDelete} onCancel={() => setDeletingAccount(null)} />

      <AdjustBalanceModal open={!!adjustingAccount} bank={adjustingAccount} isAdjusting={isAdjusting}
        onConfirm={handleAdjustBalance} onCancel={() => setAdjustingAccount(null)} showToast={showToast} />

      <TransferDrawer open={showTransferDrawer} onClose={() => setShowTransferDrawer(false)} accounts={accounts}
        settings={settings} onSuccess={() => { fetchInitialData(); showToast('success', 'Internal transfer recorded successfully.'); }} showToast={showToast} />

      {showModal && (
        <BankModal editing={editingAccount} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)}
          configuredCurrencies={configuredCurrencies} baseCurrency={baseCurrency} strictMode={strictMode} lockedType={lockedModalType} showToast={showToast} />
      )}

      {!loading && !hasCashBox && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl flex-shrink-0 shadow-sm"><AlertTriangle className="h-5 w-5" /></div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">Missing Physical Cash Safe</h4>
              <p className="text-xs text-amber-800 mt-0.5">Your school currently has no active Cash Box registered. Cash fee collections cannot be logged.</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => openCreate('cash_vault', true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all whitespace-nowrap">
              + Register Safe
            </button>
          )}
        </div>
      )}

      {/* Top Hub Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Institutional Accounts Hub</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Manage physical cash tills, commercial bank accounts, and ledger sweeps</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => router.push('/finance/bank-ledger')}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-slate-500" /> View Ledgers
          </button>
          {canEdit && (
            <button onClick={() => setShowTransferDrawer(true)}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
              <ArrowRightLeft className="h-4 w-4 text-emerald-400" /> Record Transfer
            </button>
          )}
          {canCreate && (
            <button onClick={() => openCreate()}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Register Account
            </button>
          )}
        </div>
      </div>

      {/* Normalized Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Physical Cash', value: totalCashNormalized, icon: Banknote, color: 'from-amber-500 to-orange-600' },
          { label: 'Total Commercial Bank', value: totalBankNormalized, icon: Landmark, color: 'from-blue-600 to-indigo-600' },
          { label: 'Total Liquid Assets', value: totalLiquidNormalized, icon: Wallet, color: 'from-emerald-600 to-teal-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {loading ? '—' : fmtMoney(value, baseCurrency + ' ')}
              </p>
            </div>
            <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center text-white shadow-md flex-shrink-0`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      {/* Strict Segmented Tabs */}
      <div className="flex border-b border-slate-200 gap-6 px-2">
        {[
          { id: 'cash_vault' as const, label: 'Physical Cash Tills', icon: Banknote, count: accounts.filter(a => a.account_type === 'cash_vault').length },
          { id: 'bank' as const, label: 'Commercial Bank Accounts', icon: Landmark, count: accounts.filter(a => a.account_type === 'bank').length },
        ].map(t => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2.5 py-3.5 text-sm font-bold border-b-2 transition-all -mb-px ${
              activeTab === t.id ? 'text-emerald-600 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}>
            <t.icon className="h-4 w-4" /> {t.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${activeTab === t.id ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder={`Search active ${activeTab === 'cash_vault' ? 'cash safes' : 'bank accounts'}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium" />
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <button type="button" role="switch" aria-checked={showActiveOnly} onClick={() => setShowActiveOnly(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-emerald-600' : 'bg-slate-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm font-semibold text-slate-700">Active Only</span>
          </label>
          <button onClick={fetchInitialData} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Accounts List Grid */}
      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400 font-medium">Loading institutional accounts...</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
            {activeTab === 'cash_vault' ? <Banknote className="h-8 w-8" /> : <Landmark className="h-8 w-8" />}
          </div>
          <h3 className="font-bold text-slate-800 text-base mb-1">
            {searchTerm ? 'No matching accounts found' : `No ${activeTab === 'cash_vault' ? 'Physical Cash Safes' : 'Commercial Bank Accounts'} Registered`}
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            {searchTerm ? 'Try adjusting your search query.' : `Register your ${activeTab === 'cash_vault' ? 'cash tills and safes' : 'institutional bank accounts'} to start processing funds.`}
          </p>
          {!searchTerm && canCreate && (
            <button onClick={() => openCreate(activeTab)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-xl shadow-md">
              <Plus className="h-4 w-4" /> Add First {activeTab === 'cash_vault' ? 'Safe' : 'Bank'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredAccounts.map(account => (
            <div key={account.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
              <div className={`h-1.5 w-full bg-gradient-to-r ${account.is_active ? 'from-emerald-500 to-teal-500' : 'from-slate-300 to-slate-400'}`} />
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${account.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                      {account.currency || baseCurrency}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate text-base">{account.bank_name}</h3>
                      <p className="text-xs text-slate-500 font-medium truncate">{account.account_type === 'cash_vault' ? 'Physical Cash Box' : account.account_name}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${account.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{account.account_type === 'cash_vault' ? 'Account Type' : 'Account Number'}</p>
                    <p className="font-mono font-bold text-slate-900 text-base tracking-wider mt-0.5">
                      {account.account_type === 'cash_vault' ? 'PHYSICAL SAFE' : account.account_number}
                    </p>
                  </div>
                  <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Live Ledger Balance</p>
                    <p className="font-mono font-bold text-emerald-700 text-base mt-0.5">
                      {fmtMoney(Number(account.current_balance || 0), account.currency + ' ')}
                    </p>
                  </div>
                </div>

                {account.account_type === 'bank' && (
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${account.purpose === 'wallet_funding' || account.purpose === 'both' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'}`}>
                        Wallet Funding
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${account.purpose === 'fee_payment' || account.purpose === 'both' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-400'}`}>
                        Fee Collections
                      </span>
                    </div>
                    {canEdit && (
                      <button onClick={() => setAdjustingAccount(account)} title="Reconcile Ledger Balance"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
                        <ArrowUpDown className="h-3 w-3" /> Adjust
                      </button>
                    )}
                  </div>
                )}

                {account.account_type === 'cash_vault' && canEdit && (
                  <div className="flex items-center justify-end">
                    <button onClick={() => setAdjustingAccount(account)} title="Reconcile Ledger Balance"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
                      <ArrowUpDown className="h-3 w-3" /> Reconcile Safe
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-xs font-medium text-slate-400">
                    Opening: {fmtMoney(Number(account.opening_balance || 0), account.currency + ' ')}
                  </div>
                  <div className="flex gap-1.5">
                    {canEdit && (
                      <button onClick={() => openEdit(account)} title="Edit Configuration"
                        className="p-2 rounded-lg text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all">
                        <Edit3 className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingAccount(account)} title="Delete Account"
                        className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}