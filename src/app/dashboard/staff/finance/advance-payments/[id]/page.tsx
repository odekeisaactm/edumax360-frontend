'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  advancePaymentsAPI,
  bankDetailsAPI,
  financeSettingsAPI,
} from '@/lib/finance.service';
import { schoolInfoAPI } from '@/lib/api';
import { purchaseAdvanceAPI } from '@/lib/inventory.service';
import type { PurchaseAdvancePayment, SchoolBankDetail, GeneralPaymentMethod, FinanceSettings } from '@/lib/finance.types';
import {
  ArrowLeft, Wallet, Check, Loader2, AlertCircle, AlertTriangle, X,
  Landmark, Printer, FileText, Edit3, Undo2, Trash2, Building2, User,
  ArrowUpRight, ArrowDownRight, Package,
} from 'lucide-react';

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (Array.isArray(d.non_field_errors) && d.non_field_errors.length) return String(d.non_field_errors[0]);
    for (const [key, val] of Object.entries(d)) {
      if (Array.isArray(val) && val.length) return `${key}: ${val[0]}`;
      if (typeof val === 'string') return val;
    }
  }
  return err?.message || 'An error occurred';
}

function cleanName(name: string | null | undefined, fallback = '—'): string {
  if (!name || String(name).includes('<method-wrapper')) return fallback;
  return String(name);
}

function fmtMoney(amount: string | number, symbol = '₦'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${symbol}0.00`;
  return symbol + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPaymentMethod(method?: string): string {
  if (!method) return '—';
  const map: Record<string, string> = { bank_transfer: 'Bank Transfer', cash: 'Cash', cheque: 'Cheque' };
  return map[method] || method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  reverted: 'bg-red-100 text-red-700',
};

const DIRECTION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  to_staff: { label: 'Paid to Staff', color: 'text-red-600', icon: <ArrowUpRight className="h-4 w-4" /> },
  from_staff: { label: 'Refunded by Staff', color: 'text-emerald-600', icon: <ArrowDownRight className="h-4 w-4" /> },
};

function MetaChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <div className="text-sm font-semibold text-slate-800 truncate mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ─── Revert Modal ───
function ConfirmRevertModal({ open, payment, onConfirm, onCancel, loading }: any) {
  if (!open || !payment) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-amber-600"><Undo2 className="h-6 w-6" /></div>
        <h3 className="text-lg font-bold text-slate-900 text-center">Revert Payment</h3>
        <p className="text-sm text-slate-500 text-center leading-relaxed">
          Revert <strong className="text-slate-800">{payment.voucher_number}</strong> ({fmtMoney(payment.amount)})?
          This reverses the ledger entry and re-calculates the advance balance.
        </p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 text-sm font-bold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 flex items-center justify-center gap-1.5 shadow-md shadow-amber-200 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Revert Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ───
function ConfirmDeleteModal({ open, payment, onConfirm, onCancel, loading }: any) {
  if (!open || !payment) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600"><Trash2 className="h-6 w-6" /></div>
        <h3 className="text-lg font-bold text-slate-900 text-center">Delete Payment</h3>
        <p className="text-sm text-slate-500 text-center leading-relaxed">
          Delete <strong className="text-slate-800">{payment.voucher_number}</strong> ({fmtMoney(payment.amount)}) permanently?
          This reverses the ledger entry and cannot be undone.
        </p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 text-sm font-bold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-1.5 shadow-md shadow-red-200 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete & Reverse'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───
function EditPaymentModal({ open, payment, advance, banks, onClose, onSave, loading }: any) {
  const [form, setForm] = useState<any>({});
  const [initialForm, setInitialForm] = useState<any>({});

  useEffect(() => {
    if (payment) {
      const initData = {
        amount: payment.amount || '',
        payment_method: payment.payment_method || 'bank_transfer',
        bank_account: payment.bank_account || '',
        reference: payment.reference || '',
        notes: payment.notes || '',
      };
      setForm(initData);
      setInitialForm(initData);
    }
  }, [payment]);

  if (!open || !payment) return null;

  const isModified = JSON.stringify(form) !== JSON.stringify(initialForm);
  const isAmountInvalid = form.amount && parseFloat(form.amount) <= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isModified || isAmountInvalid) return;
    const payload: any = { ...form };
    if (payload.payment_method === 'cash') payload.bank_account = null;
    onSave(payment.id, payload);
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase mb-1";
  const safeBanks = Array.isArray(banks) ? banks : [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-700 text-white flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2"><Edit3 className="h-4 w-4" /> Edit Payment ({payment.voucher_number})</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div><strong>Ledger Reversal:</strong> Changing the amount, method, or source account reverses the original entry and posts a new one. The advance and direction cannot be changed — delete and re-create instead.</div>
          </div>

          <div>
            <label className={labelCls}>Amount</label>
            <input
              type="number" step="0.01"
              value={form.amount || ''}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className={`${inputCls} ${isAmountInvalid ? 'border-red-300 bg-red-50' : ''}`}
              required
            />
            {isAmountInvalid && <p className="text-xs text-red-600 mt-1">Amount must be greater than zero.</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Payment Method</label>
              <select
                value={form.payment_method}
                onChange={e => setForm({ ...form, payment_method: e.target.value, bank_account: e.target.value === 'cash' ? '' : form.bank_account })}
                className={inputCls}
                required
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Source Account</label>
              <select
                value={form.bank_account || ''}
                onChange={e => setForm({ ...form, bank_account: e.target.value })}
                className={inputCls}
                disabled={form.payment_method === 'cash'}
                required={form.payment_method !== 'cash'}
              >
                <option value="">{form.payment_method === 'cash' ? 'Auto: Cash Vault' : 'Select Bank...'}</option>
                {safeBanks.map((b: any) => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
              </select>
            </div>
          </div>

          <div><label className={labelCls}>Reference</label><input type="text" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Notes</label><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls + ' resize-none'} /></div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={loading || !isModified || isAmountInvalid} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-40">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function AdvancePaymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const { hasPermission, user } = useAuth();

  const [payment, setPayment] = useState<any>(null);
  const [advance, setAdvance] = useState<any>(null);
  const [advancePayments, setAdvancePayments] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [banks, setBanks] = useState<SchoolBankDetail[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReceiptPrint, setShowReceiptPrint] = useState(false);
  const [showSummaryPrint, setShowSummaryPrint] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('finance.change_purchaseadvancepaymentmodel') || hasPermission('finance.add_purchaseadvancepaymentmodel');
  const canDelete = user?.is_superuser || hasPermission('finance.delete_purchaseadvancepaymentmodel') || hasPermission('finance.add_purchaseadvancepaymentmodel');

  const baseCurrencySymbol = settings?.currency_config?.base_currency === 'USD' ? '$' : '₦';
  const windowHours = settings?.reversal_window_hours ?? 24;
  const isExpired = payment ? (windowHours > 0 && (Date.now() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60) > windowHours) : false;
  const isActionable = payment?.status === 'completed' && !isExpired;

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pmt = await advancePaymentsAPI.get(id);
      setPayment(pmt);

      const [advDetails, advPmts] = await Promise.all([
        purchaseAdvanceAPI.get(pmt.advance),
        advancePaymentsAPI.list({ advance: pmt.advance, page_size: 1000 }),
      ]);
      setAdvance(advDetails);
      const allPmts = Array.isArray(advPmts) ? advPmts : (advPmts as any)?.results || [];
      setAdvancePayments(allPmts);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchAll();
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => null);
    financeSettingsAPI.get().then((res: any) => setSettings(res?.data || res)).catch(() => null);
    bankDetailsAPI.list({ is_active: true }).then((data: any) => {
      const arr = Array.isArray(data) ? data : (data?.results ?? []);
      setBanks(arr.filter((b: SchoolBankDetail) => b.account_type !== 'cash_vault'));
    }).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const printMode = searchParams.get('print');
    if (printMode === 'receipt') setShowReceiptPrint(true);
    if (printMode === 'summary') setShowSummaryPrint(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showReceiptPrint && !showSummaryPrint) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowReceiptPrint(false); setShowSummaryPrint(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showReceiptPrint, showSummaryPrint]);

  const handleEditSave = async (paymentId: number, payload: any) => {
    setActionLoading(true);
    try {
      await advancePaymentsAPI.update(paymentId, payload);
      showToast('success', 'Payment updated successfully.');
      setShowEdit(false);
      fetchAll();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevert = async () => {
    setActionLoading(true);
    try {
      await advancePaymentsAPI.revert(id);
      showToast('success', 'Payment reverted successfully.');
      setShowRevertConfirm(false);
      fetchAll();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await advancePaymentsAPI.delete(id);
      showToast('success', 'Payment deleted.');
      router.push('/dashboard/staff/finance/advance-payments');
    } catch (err) {
      showToast('error', extractError(err));
      setActionLoading(false);
    }
  };

  const totalNetDisbursed = advancePayments
    .filter((p: any) => p.status === 'completed')
    .reduce((sum: number, p: any) => sum + (p.direction === 'to_staff' ? parseFloat(p.amount || '0') : -parseFloat(p.amount || '0')), 0);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Failed to load</p>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard/staff/finance/advance-payments')} className="text-sm text-indigo-600 underline">
            Back to Advance Payments
          </button>
        </div>
      </div>
    );
  }

  const directionMeta = DIRECTION_META[payment.direction] || DIRECTION_META.to_staff;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      {toast && (
        <div className={`fixed top-4 right-4 z-[90] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in
          ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {toast.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />}
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #advance-payment-print-area, #advance-payment-print-area * { visibility: visible; }
          #advance-payment-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
        }
      `}} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/staff/finance/advance-payments')}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              Advance Payment
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">{payment.voucher_number}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setShowReceiptPrint(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 shadow-sm">
            <Printer className="h-4 w-4" /> Receipt
          </button>
          <button onClick={() => setShowSummaryPrint(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm">
            <FileText className="h-4 w-4" /> Advance Summary
          </button>
        </div>
      </div>

      {/* Action Bar */}
      {(canEdit || canDelete) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-slate-700">Status:</span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${STATUS_STYLES[payment.status]}`}>
              {payment.status_display || payment.status}
            </span>
            {isExpired && payment.status === 'completed' && (
              <span className="text-xs text-amber-600 font-medium">Reversal window ({windowHours}h) expired</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {canEdit && (
              <button onClick={() => setShowEdit(true)} disabled={!isActionable} className="flex-1 sm:flex-none px-4 py-2 bg-amber-50 text-amber-800 hover:bg-amber-100 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <Edit3 className="h-4 w-4" /> Edit
              </button>
            )}
            {canDelete && (
              <button onClick={() => setShowRevertConfirm(true)} disabled={!isActionable} className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <Undo2 className="h-4 w-4" /> Revert
              </button>
            )}
            {canDelete && (
              <button onClick={() => setShowDeleteConfirm(true)} disabled={!isActionable} className="flex-1 sm:flex-none px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Payment Identity Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-700">
          <div>
            <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Voucher Number</p>
            <p className="text-xl font-bold text-white font-mono mt-1">{payment.voucher_number}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Amount</p>
            <p className="text-2xl font-black text-white mt-1">{fmtMoney(payment.amount, baseCurrencySymbol)}</p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetaChip icon={<User className="h-3.5 w-3.5 text-indigo-500" />} label="Staff" value={payment.staff_name} />
          <MetaChip icon={payment.payment_method === 'cash' ? <Wallet className="h-3.5 w-3.5 text-slate-500" /> : <Landmark className="h-3.5 w-3.5 text-slate-500" />} label="Method" value={formatPaymentMethod(payment.payment_method)} />
          <MetaChip icon={<Landmark className="h-3.5 w-3.5 text-slate-500" />} label="Source Account" value={cleanName(payment.bank_account_name, 'Physical Cash Vault')} />
          <MetaChip icon={<User className="h-3.5 w-3.5 text-slate-500" />} label="Recorded By" value={cleanName(payment.created_by_name, 'System User')} />
        </div>

        <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div><span className="text-slate-400">Direction:</span> <span className={`font-bold ml-1 ${directionMeta.color}`}>{directionMeta.label}</span></div>
          <div><span className="text-slate-400">Payment Date:</span> <span className="font-medium ml-1">{formatDate(payment.payment_date)}</span></div>
          <div><span className="text-slate-400">Status:</span> <span className={`font-medium ml-1 ${payment.status === 'completed' ? 'text-emerald-600' : 'text-red-600'}`}>{payment.status_display || payment.status}</span></div>
        </div>

        {payment.notes && (
          <div className="px-5 pb-5">
            <div className="flex items-start gap-3 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
              <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">{payment.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Linked Advance Summary */}
      {advance && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Advance {advance.advance_number}</h3>
                <p className="text-xs text-slate-400">Staff: {advance.staff_name}</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/dashboard/staff/inventory/advances/${advance.id}`)}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Open full advance →
            </button>
          </div>

          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetaChip icon={<Wallet className="h-3.5 w-3.5 text-slate-500" />} label="Requested" value={fmtMoney(advance.requested_amount, baseCurrencySymbol)} />
            <MetaChip icon={<Check className="h-3.5 w-3.5 text-emerald-500" />} label="Approved" value={fmtMoney(advance.approved_amount, baseCurrencySymbol)} />
            <MetaChip icon={<ArrowUpRight className="h-3.5 w-3.5 text-indigo-500" />} label="Disbursed (net)" value={fmtMoney(advance.disbursed_amount, baseCurrencySymbol)} />
            <MetaChip icon={<FileText className="h-3.5 w-3.5 text-amber-500" />} label="Balance Due" value={fmtMoney(advance.balance_due, baseCurrencySymbol)} />
          </div>
        </div>
      )}

      {/* Payment History for this Advance */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h3 className="text-sm font-bold text-slate-800">Payment History</h3>
          <p className="text-xs text-slate-400">All payments recorded against {advance?.advance_number}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Voucher #</th>
                <th className="px-4 py-3 text-left">Direction</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {advancePayments.map((p: any) => {
                const meta = DIRECTION_META[p.direction] || DIRECTION_META.to_staff;
                return (
                  <tr key={p.id} className={p.id === payment.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-mono text-indigo-600">
                      {p.voucher_number} {p.id === payment.id && <span className="ml-1 text-[10px] font-bold text-indigo-400 uppercase">(this)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.color}`}>{meta.icon}{meta.label}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{fmtMoney(p.amount, baseCurrencySymbol)}</td>
                    <td className="px-4 py-3 capitalize">{formatPaymentMethod(p.payment_method)}</td>
                    <td className="px-4 py-3">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[p.status] || ''}`}>{p.status_display || p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.id !== payment.id && (
                        <button onClick={() => router.push(`/dashboard/staff/finance/advance-payments/${p.id}`)} className="text-xs font-semibold text-indigo-600 hover:underline">
                          View →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end text-sm">
          <span className="text-slate-500">Net Disbursed (all completed):</span>
          <span className={`font-bold ml-2 ${totalNetDisbursed >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmtMoney(Math.abs(totalNetDisbursed), baseCurrencySymbol)}
          </span>
        </div>
      </div>

      {/* Modals */}
      <EditPaymentModal open={showEdit} payment={payment} advance={advance} banks={banks} onClose={() => setShowEdit(false)} onSave={handleEditSave} loading={actionLoading} />
      <ConfirmRevertModal open={showRevertConfirm} payment={payment} onConfirm={handleRevert} onCancel={() => setShowRevertConfirm(false)} loading={actionLoading} />
      <ConfirmDeleteModal open={showDeleteConfirm} payment={payment} onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} loading={actionLoading} />

      {/* PRINT: Receipt */}
      {showReceiptPrint && (
        <div onClick={() => setShowReceiptPrint(false)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="advance-payment-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setShowReceiptPrint(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"><X className="w-4 h-4" /> Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm"><Printer className="w-3.5 h-3.5" /> Print Receipt</button>
            </div>

            <div className="p-10 print:p-6 text-slate-800">
              <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-6 mb-6">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-16 w-16 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Building2 className="h-8 w-8 text-slate-400" /></div>
                )}
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">{schoolInfo?.name || 'School Name Not Set'}</h1>
                  <p className="text-xs font-medium text-slate-500 mt-1">{schoolInfo?.address || 'Official Procurement Address'}</p>
                  <p className="text-xs font-medium text-slate-500">{[schoolInfo?.email, schoolInfo?.phone].filter(Boolean).join(' · ')}</p>
                </div>
              </div>

              <div className="bg-indigo-600 text-white text-center py-2.5 text-sm font-bold mb-5 uppercase rounded-lg">
                Advance Payment Receipt
              </div>

              <div className="flex justify-between text-xs mb-5">
                <div><span className="text-slate-400">Voucher No:</span> <strong className="font-mono">{payment.voucher_number}</strong></div>
                <div><span className="text-slate-400">Date:</span> <strong>{formatDate(payment.payment_date)}</strong></div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 mb-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Paid {payment.direction === 'to_staff' ? 'To Staff' : 'By Staff'}</p>
                <p className="text-base font-black text-slate-900">{payment.staff_name}</p>
                <p className="text-xs text-slate-500 mt-1">For Advance: {payment.advance_number}</p>
              </div>

              <div className="text-center py-6 my-5 border-y-2 border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{fmtMoney(payment.amount, baseCurrencySymbol)}</p>
                <p className={`text-xs font-bold mt-1 ${directionMeta.color}`}>{directionMeta.label}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs mb-8">
                <div><span className="text-slate-400">Payment Method:</span> <strong>{formatPaymentMethod(payment.payment_method)}</strong></div>
                <div><span className="text-slate-400">Source Account:</span> <strong>{cleanName(payment.bank_account_name, 'Physical Cash Vault')}</strong></div>
              </div>

              <div className="grid grid-cols-2 gap-12 mt-14 pt-8">
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">{cleanName(payment.created_by_name, 'System User')}</p>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Prepared By</p>
                </div>
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-400">&nbsp;</p>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Received By</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT: Advance Summary */}
      {showSummaryPrint && (
        <div onClick={() => setShowSummaryPrint(false)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="advance-payment-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setShowSummaryPrint(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"><X className="w-4 h-4" /> Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm"><Printer className="w-3.5 h-3.5" /> Print Summary</button>
            </div>

            <div className="p-10 print:p-6 text-slate-800">
              <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-6 mb-6">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-16 w-16 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Building2 className="h-8 w-8 text-slate-400" /></div>
                )}
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">{schoolInfo?.name || 'School Name Not Set'}</h1>
                  <p className="text-xs font-medium text-slate-500 mt-1">{schoolInfo?.address || 'Official Procurement Address'}</p>
                </div>
              </div>

              <h2 className="text-lg font-black text-indigo-600 uppercase tracking-widest mb-1">Advance Payment Summary</h2>
              <p className="text-xs text-slate-500 mb-5">Advance {advance?.advance_number} — {advance?.staff_name}</p>

              <table className="w-full text-left text-sm border-collapse mb-5">
                <thead className="bg-slate-800 text-white font-bold">
                  <tr>
                    <th className="px-3 py-2 rounded-tl-lg">Voucher #</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Direction</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right rounded-tr-lg">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                  {advancePayments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2.5 font-mono text-xs">{p.voucher_number}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className={DIRECTION_META[p.direction]?.color}>{DIRECTION_META[p.direction]?.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatPaymentMethod(p.payment_method)}</td>
                      <td className="px-3 py-2.5 text-xs">{p.status_display || p.status}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{fmtMoney(p.amount, baseCurrencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-72 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Approved:</span><strong>{fmtMoney(advance?.approved_amount || 0, baseCurrencySymbol)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Actual Total:</span><strong>{fmtMoney(advance?.actual_total || 0, baseCurrencySymbol)}</strong></div>
                  <div className="flex justify-between text-emerald-700"><span>Net Paid to Staff:</span><strong>{fmtMoney(totalNetDisbursed, baseCurrencySymbol)}</strong></div>
                  <div className="flex justify-between text-lg font-black border-t-2 border-slate-800 pt-1.5"><span>Balance Due:</span><span>{fmtMoney(advance?.balance_due || 0, baseCurrencySymbol)}</span></div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-8">Generated {new Date().toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short' })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}