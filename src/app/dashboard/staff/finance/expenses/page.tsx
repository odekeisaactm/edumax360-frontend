'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  expenseAPI, expenseCategoriesAPI, academicCalendarAPI,
  financeSettingsAPI, bankDetailsAPI, schoolInfoAPI,
} from '@/lib/api';
import type { Expense } from '@/lib/finance.types';
import {
  ArrowDownRight, Search, X, Loader2, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Eye, Check, FileText, Plus, FilterX, Trash2, Landmark,
  Wallet, Edit3, Printer, AlertTriangle, Calendar, Building2
} from 'lucide-react';
import ExpenseExporter from './ExpenseExporter';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data || err?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
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

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

function formatPaymentMethod(method?: string): string {
  if (!method) return '—';
  const map: Record<string, string> = { bank_transfer: 'Bank Transfer', pos: 'POS', cash: 'Cash', cheque: 'Cheque', others: 'Others' };
  return map[method] || method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

const PAGE_SIZE = 20;

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border w-[calc(100vw-2rem)] sm:max-w-sm animate-in fade-in slide-in-from-top-2 ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function ConfirmDeleteModal({ open, item, onConfirm, onCancel, loading }: any) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600"><Trash2 className="h-6 w-6" /></div>
        <h3 className="text-lg font-bold text-slate-900 text-center">Reverse & Delete Voucher</h3>
        <p className="text-sm text-slate-500 text-center leading-relaxed">Are you sure you want to delete <strong className="text-slate-800">{item.voucher_number || `EXP-${item.id}`}</strong> ({fmtMoney(item.amount)})? This will atomically credit money back into the source bank account or cash vault.</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 text-sm font-bold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-1.5 shadow-md shadow-red-200 transition-colors disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete & Credit'}</button>
        </div>
      </div>
    </div>
  );
}

function EditExpenseModal({ open, item, onClose, onSave, loading, categories, banks, settings }: any) {
  const [form, setForm] = useState<any>({});
  const [initialForm, setInitialForm] = useState<any>({});

  useEffect(() => {
    if (item) {
      const initData = {
        category: item.category, amount: item.amount || '', payment_method: item.payment_method || 'bank_transfer',
        bank_account: item.bank_account || '', name: item.name || '', vote_and_subhead: item.vote_and_subhead || '',
        description: item.description || '', notes: item.notes || '',
      };
      setForm(initData); setInitialForm(initData);
    }
  }, [item]);

  if (!open || !item) return null;

  const isModified = JSON.stringify(form) !== JSON.stringify(initialForm);
  const isFinancialChange = form.amount !== initialForm.amount || form.bank_account !== initialForm.bank_account || form.payment_method !== initialForm.payment_method;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isModified) return;
    onSave(item.id, form);
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase mb-1";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2"><Edit3 className="h-4 w-4" /> Edit Expenditure Record (#{item.voucher_number || item.id})</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {isFinancialChange ? (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-900">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div><strong>Atomic Ledger Reversal:</strong> Modifying the amount, method, or source account will atomically reverse the original ledger entry and post a new one. Ensure the target bank has sufficient funds.</div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
              <FileText className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div><strong>Metadata Update:</strong> Modifying names or descriptions does not affect the bank ledger.</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} required>
                <option value="">Select...</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Amount</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputCls} required /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Payment Method</label>
              <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value, bank_account: e.target.value === 'cash' ? '' : form.bank_account })} className={inputCls} required>
                <option value="bank_transfer">Bank Transfer</option><option value="pos">POS</option><option value="cash">Cash</option><option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Source Account</label>
              <select value={form.bank_account || ''} onChange={e => setForm({ ...form, bank_account: e.target.value })} className={inputCls} required={form.payment_method !== 'cash' && settings?.track_bank_balance} disabled={form.payment_method === 'cash'}>
                <option value="">{form.payment_method === 'cash' ? 'Auto: Cash Vault' : 'Select Bank...'}</option>
                {banks.filter((b: any) => b.account_type !== 'cash_vault').map((b: any) => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
            <div><label className={labelCls}>In Favour Of</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Vote & Sub-head</label><input type="text" value={form.vote_and_subhead} onChange={e => setForm({ ...form, vote_and_subhead: e.target.value })} className={inputCls} /></div>
          </div>

          <div><label className={labelCls}>Description</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Internal Notes</label><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls + ' resize-none'} /></div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={loading || !isModified} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-40 transition-colors">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {isFinancialChange ? 'Reverse & Update Ledger' : 'Update Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AuditDrawer({ item, onClose, onDelete, onEdit, canDelete, canEdit, setPrintA4Item, setPrintThermalItem, baseCurrency, settings }: any) {
  if (!item) return null;
  const windowHours = settings?.reversal_window_hours ?? 24;
  const hoursOld = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
  const isExpired = windowHours > 0 && hoursOld > windowHours;

  let parsedLineItems: any[] = [];
  try { parsedLineItems = typeof item.line_items_json === 'string' ? JSON.parse(item.line_items_json) : item.line_items_json || []; } catch {}

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end animate-in fade-in">
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">
        <div className="px-5 py-4 sm:px-6 sm:py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div><span className="text-[10px] sm:text-xs font-mono text-slate-400 uppercase tracking-widest">Expenditure Audit</span><h3 className="text-sm sm:text-base font-bold truncate max-w-[250px] sm:max-w-[320px]">{item.voucher_number || item.reference || `EXP-${item.id}`}</h3></div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Disbursed</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900">{fmtMoney(item.amount, baseCurrency)}</p>
              {item.foreign_currency && (
                <p className="text-[10px] font-bold text-red-600 mt-1 uppercase tracking-wider">Foreign: {item.foreign_currency} {item.foreign_amount}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5"><span className="text-[10px] sm:text-xs font-bold uppercase px-2.5 py-1 bg-red-100 text-red-800 rounded-md">{item.category_name || 'Expense'}</span><span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm">{formatPaymentMethod(item.payment_method)}</span></div>
          </div>

          {Array.isArray(parsedLineItems) && parsedLineItems.length > 0 && (
            <div className="space-y-2"><h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Itemized Line Items</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-[11px] sm:text-xs"><table className="w-full text-left"><thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200"><tr><th className="p-2">Date</th><th className="p-2">Particulars</th><th className="p-2 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{parsedLineItems.map((li: any, idx: number) => (<tr key={idx}><td className="p-2 text-slate-500">{li.date || '—'}</td><td className="p-2 font-medium">{li.particular}</td><td className="p-2 text-right font-bold">{fmtMoney(li.amount, baseCurrency)}</td></tr>))}</tbody></table></div>
            </div>
          )}

          <div className="space-y-3"><h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Source Routing</h4>
            <div className="p-4 rounded-2xl border border-slate-100 bg-white flex items-center gap-3.5 shadow-sm"><div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">{item.payment_method === 'cash' ? <Wallet className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}</div>
            <div><p className="font-bold text-slate-900 text-sm">{item.bank_account_name || 'Assigned Physical Cash Vault'}</p><p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Disbursed on {formatDate(item.expense_date)}</p></div></div>
          </div>

          <div className="space-y-3"><h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Signatory Routing</h4>
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 text-[11px] sm:text-xs bg-white">
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">In Favour Of</span><span className="font-bold text-slate-800 text-right">{item.name || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Vote & Sub-head</span><span className="font-mono font-bold text-slate-800">{item.vote_and_subhead || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Prepared By</span><span className="font-medium text-slate-800">{cleanName(item.prepared_by_name, 'System User')}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Authorised By</span><span className="font-medium text-slate-800">{cleanName(item.authorised_by_name)}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Collected By</span><span className="font-medium text-slate-800">{cleanName(item.collected_by_name) !== '—' ? cleanName(item.collected_by_name) : (item.collected_by_other || '—')}</span></div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="flex gap-2">
             <button onClick={() => setPrintThermalItem(item)} title="Print POS Thermal Slip" className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"><Printer className="w-4 h-4" /> Thermal</button>
             <button onClick={() => setPrintA4Item(item)} title="Print Official A4 Voucher" className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"><FileText className="w-4 h-4" /> A4</button>
             {item.receipt && (
               <a href={getImageUrl(item.receipt)} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
                 <FileText className="w-4 h-4" /> View Proof
               </a>
             )}
          </div>
          <div className="flex gap-2">
            {canEdit && <button onClick={() => { onClose(); onEdit(item); }} disabled={isExpired} title={isExpired ? 'Grace period expired' : 'Edit'} className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl hover:bg-amber-100 disabled:opacity-40 transition-colors flex items-center gap-1.5"><Edit3 className="h-4 w-4" /> Edit</button>}
            {canDelete && <button onClick={() => { onClose(); onDelete(item); }} disabled={isExpired} title={isExpired ? `Reversal grace period (${windowHours}h) expired` : 'Delete & Reverse'} className="px-3 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm transition-colors"><Trash2 className="h-4 w-4" /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Master Consolidated Expense Page ──────────────────────────────────────────
export default function ConsolidatedExpensePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const canViewExpense   = user?.is_superuser || hasPermission('finance.view_expensemodel');
  const canEditExpense   = user?.is_superuser || hasPermission('finance.change_expensemodel') || hasPermission('finance.add_expensemodel');
  const canDeleteExpense = user?.is_superuser || hasPermission('finance.delete_expensemodel') || hasPermission('finance.add_expensemodel');
  const canCreateExpense = user?.is_superuser || hasPermission('finance.add_expensemodel');

  // Filter State
  const [searchQuery, setSearchQuery]       = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [sessionId, setSessionId]           = useState('');
  const [periodId, setPeriodId]             = useState('');
  const [startDate, setStartDate]           = useState('');
  const [endDate, setEndDate]               = useState('');

  const [data, setData]                     = useState<Expense[]>([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [loading, setLoading]               = useState(true);
  const [pageError, setPageError]           = useState<string | null>(null);

  const [categories, setCategories]         = useState<any[]>([]);
  const [sessionPeriods, setSessionPeriods] = useState<any[]>([]);
  const [sessions, setSessions]             = useState<any[]>([]);
  const [settings, setSettings]             = useState<any>(null);
  const [schoolInfo, setSchoolInfo]         = useState<any>(null);

  const [selectedItem, setSelectedItem]     = useState<Expense | null>(null);
  const [editModal, setEditModal]           = useState<{ open: boolean; item: Expense | null }>({ open: false, item: null });
  const [deleteModal, setDeleteModal]       = useState<{ open: boolean; item: Expense | null }>({ open: false, item: null });
  const [actionLoading, setActionLoading]   = useState(false);
  const [toasts, setToasts]                 = useState<ToastItem[]>([]);

  // PRINT STATES
  const [printA4Item, setPrintA4Item]             = useState<Expense | null>(null);
  const [printThermalItem, setPrintThermalItem]   = useState<Expense | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const hasActiveFilters = Boolean(categoryFilter || currencyFilter || searchQuery.trim() || sessionId || periodId || startDate || endDate);
  const clearAllFilters = () => { setCategoryFilter(''); setCurrencyFilter(''); setSearchQuery(''); setSessionId(''); setPeriodId(''); setStartDate(''); setEndDate(''); };

  useEffect(() => {
    Promise.all([
      expenseCategoriesAPI.list({ page_size: 1000 }).catch(() => []),
      academicCalendarAPI.listSessions().catch(() => []),
      academicCalendarAPI.listSessionPeriods().catch(() => []),
      financeSettingsAPI.get().catch(() => ({})),
      schoolInfoAPI.get().catch(() => ({})),
    ]).then(([catsData, sessData, spData, settingsData, sData]) => {
      setCategories(Array.isArray(catsData) ? catsData : (catsData as any)?.results ?? []);
      setSessions(Array.isArray(sessData) ? sessData : (sessData as any)?.results ?? []);
      setSessionPeriods(Array.isArray(spData) ? spData : (spData as any)?.results ?? []);
      setSettings(settingsData);
      setSchoolInfo(sData);
    });
  }, []);

  const availablePeriods = useMemo(() => {
    if (!sessionId) return [];
    return sessionPeriods.filter((sp: any) => String(sp.session?.id) === String(sessionId)).map((sp: any) => sp.period).filter(Boolean);
  }, [sessionId, sessionPeriods]);

  const baseCurrencySymbol = settings?.currency_config?.base_currency === 'USD' ? '$' : '₦';
  const baseCurrencyCode = settings?.currency_config?.base_currency || 'NGN';
  const activeCurrencies = useMemo(() => {
    const arr = [baseCurrencyCode];
    if (settings?.currency_config?.supported_currencies) {
      Object.keys(settings.currency_config.supported_currencies).forEach(k => {
        if (!arr.includes(k)) arr.push(k);
      });
    }
    return arr;
  }, [settings, baseCurrencyCode]);

  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (categoryFilter) params.category = categoryFilter;
    if (currencyFilter) params.currency = currencyFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (sessionId) params.session_id = sessionId;
    if (periodId) params.academic_period_id = periodId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return params;
  }, [page, categoryFilter, currencyFilter, searchQuery, sessionId, periodId, startDate, endDate]);

  const fetchData = useCallback(async () => {
    if (!canViewExpense) return;
    setLoading(true); setPageError(null);
    try {
      const response = await expenseAPI.list(buildParams());
      const results = Array.isArray(response) ? response : (response as any)?.results ?? [];
      const totalCount = typeof (response as any)?.count === 'number' ? (response as any).count : results.length;
      setData(results); setTotal(totalCount);
    } catch (err) { setPageError(extractError(err)); }
    finally { setLoading(false); }
  }, [buildParams, canViewExpense]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [categoryFilter, currencyFilter, searchQuery, sessionId, periodId, startDate, endDate]);

  // THE FIX: open_detail hook
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    const targetId = searchParams.get('open_detail');
    if (!targetId || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    router.replace(window.location.pathname, { scroll: false });
    const existing = data.find((d: any) => d.id === Number(targetId));
    if (existing) { setSelectedItem(existing); }
    else { expenseAPI.get(Number(targetId)).then((res: any) => { if (res) setSelectedItem(res); }).catch(() => {}); }
  }, [searchParams, data, router]);

  // Keyboard Esc Hook
  useEffect(() => {
    if (!selectedItem && !printA4Item && !printThermalItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedItem(null); setPrintA4Item(null); setPrintThermalItem(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, printA4Item, printThermalItem]);

  const handleEditSave = async (id: number, payload: any) => {
    setActionLoading(true);
    try {
      await expenseAPI.update(id, payload);
      showToast('success', 'Expenditure metadata updated successfully.');
      setEditModal({ open: false, item: null });
      setSelectedItem(null);
      fetchData();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(false); }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteModal.item) return;
    setActionLoading(true);
    try {
      await expenseAPI.delete(deleteModal.item.id);
      showToast('success', 'Expenditure voucher deleted and safe credited atomically.');
      setDeleteModal({ open: false, item: null });
      setSelectedItem(null);
      fetchData();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(false); }
  };

  const getExportRows = useCallback(async (): Promise<Expense[]> => {
    const params: any = { ...buildParams(), page_size: 2000 }; delete params.page;
    const response = await expenseAPI.list(params);
    return Array.isArray(response) ? response : (response as any)?.results ?? [];
  }, [buildParams]);

  if (!canViewExpense) return <div className="p-16 text-center font-bold text-red-600">Access Denied</div>;

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 max-w-7xl mx-auto px-2 sm:px-0">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Print CSS Scope */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
        }
      `}} />

      <AuditDrawer
        item={selectedItem} onClose={() => setSelectedItem(null)}
        onDelete={(item: Expense) => { setSelectedItem(null); setDeleteModal({ open: true, item }); }}
        onEdit={(item: Expense) => { setSelectedItem(null); setEditModal({ open: true, item }); }}
        canDelete={canDeleteExpense} canEdit={canEditExpense}
        baseCurrency={baseCurrencySymbol} settings={settings}
        setPrintA4Item={setPrintA4Item} setPrintThermalItem={setPrintThermalItem}
      />

      <EditExpenseModal open={editModal.open} item={editModal.item} onClose={() => setEditModal({ open: false, item: null })} onSave={handleEditSave} loading={actionLoading} categories={categories} settings={settings} />
      <ConfirmDeleteModal open={deleteModal.open} item={deleteModal.item} onConfirm={handleDeleteSubmit} onCancel={() => setDeleteModal({ open: false, item: null })} loading={actionLoading} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-red-600 to-rose-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md shadow-red-200 shrink-0">
              <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            Master Expenditure Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 pl-10 sm:pl-12">Audit, print vouchers, and track institutional expenditures</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canCreateExpense && (
            <button onClick={() => router.push('/dashboard/staff/finance/expenses/create')} className="flex-1 sm:flex-none justify-center px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs sm:text-sm rounded-lg sm:rounded-xl shadow-md shadow-red-200 hover:from-red-700 transition-all flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Expense
            </button>
          )}
          <div className="flex-1 sm:flex-none">
            <ExpenseExporter schoolName={schoolInfo?.name} getExportRows={getExportRows} baseCurrency={baseCurrencySymbol} />
          </div>
        </div>
      </div>

      {/* TWO-ROW Filter Toolbar */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 space-y-3">
        {/* ROW 1 */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search voucher #, beneficiary..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-red-500 outline-none" />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full sm:w-auto px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} className="w-full sm:w-auto px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium uppercase">
              <option value="">All Currencies</option>
              {activeCurrencies.map(curr => <option key={curr} value={curr}>{curr}</option>)}
            </select>
          </div>
        </div>

        {/* ROW 2 */}
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setPeriodId(''); }} className="w-full sm:w-auto px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium">
              <option value="">All Sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
            </select>
            {sessionId && (
              <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="w-full sm:w-auto px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium">
                <option value="">All Terms</option>
                {availablePeriods.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-1 sm:flex-none">
              <div className="relative w-full sm:w-auto">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 sm:hidden" />
                <input type="date" max={todayStr} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-auto pl-8 sm:pl-3 pr-2 sm:pr-3 py-2 text-xs border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium" />
              </div>
              <span className="text-slate-300 text-xs font-bold">—</span>
              <div className="relative w-full sm:w-auto">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 sm:hidden" />
                <input type="date" max={todayStr} min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-auto pl-8 sm:pl-3 pr-2 sm:pr-3 py-2 text-xs border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasActiveFilters && (
                <button onClick={clearAllFilters} title="Clear Filters" className="p-2 sm:px-3 sm:py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg sm:rounded-xl hover:bg-red-100 text-xs font-bold flex items-center transition-colors">
                  <FilterX className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Clear</span>
                </button>
              )}
              <button onClick={fetchData} className="p-2 border border-slate-200 rounded-lg sm:rounded-xl hover:bg-slate-50 text-slate-600">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-red-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-12 sm:p-16 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <p className="text-xs text-slate-400 font-medium">Loading institutional expenditure vouchers...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 sm:p-12 text-center text-red-600 font-medium text-sm">{pageError}</div>
        ) : data.length === 0 ? (
          <div className="p-12 sm:p-16 text-center space-y-2">
            <ArrowDownRight className="h-10 w-10 text-slate-200 mx-auto" />
            <h3 className="font-bold text-slate-700 text-sm sm:text-base">No expenditure vouchers found</h3>
            <p className="text-xs text-slate-400">Try clearing active filters or record a new institutional expense.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 sm:px-4 py-3">Voucher #</th>
                  <th className="px-3 sm:px-4 py-3">In Favour Of</th>
                  <th className="px-3 sm:px-4 py-3 hidden sm:table-cell">Source Account</th>
                  <th className="px-3 sm:px-4 py-3 text-right">Amount</th>
                  <th className="px-3 sm:px-4 py-3 hidden md:table-cell">Date</th>
                  <th className="px-3 sm:px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 sm:px-4 py-3">
                        <p className="font-bold text-slate-800 truncate max-w-[120px] sm:max-w-[200px]">{item.voucher_number || item.reference || `EXP-${item.id}`}</p>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate max-w-[120px] sm:max-w-[200px]">{item.category_name || 'General Expense'}</p>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <span className="text-slate-800 font-bold truncate max-w-[120px] sm:max-w-[200px] block">{item.name || '—'}</span>
                        {item.description && <p className="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-[120px] sm:max-w-[200px]">{item.description}</p>}
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                        <span className="text-[11px] sm:text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md">
                          {item.bank_account_name || 'Physical Cash Vault'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-black text-slate-900 text-xs sm:text-sm">
                        {fmtMoney(item.amount, baseCurrencySymbol)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-[11px] sm:text-xs text-slate-500 font-medium hidden md:table-cell">
                        {formatDate(item.expense_date)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button onClick={() => setSelectedItem(item)} title="Open Audit Drawer" className="px-3 py-1.5 rounded-lg text-white font-bold bg-slate-900 hover:bg-slate-800 shadow-sm transition-colors text-xs flex items-center gap-1.5 ml-1">
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Pg {page} of {Math.ceil(total / PAGE_SIZE) || 1} <span className="hidden sm:inline">({total} total)</span></span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 sm:px-2.5 sm:py-1.5 border rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors flex items-center gap-1">
                <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Prev</span>
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total} className="p-1.5 sm:px-2.5 sm:py-1.5 border rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors flex items-center gap-1">
                <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── PRINT DOM OVERLAYS ── */}
      {printA4Item && (
        <div onClick={() => setPrintA4Item(null)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-[800px] border-2 border-black p-5 shadow-2xl print:shadow-none print:max-w-none print:w-full print:border-0 print:p-0">
            <div className="print:hidden flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
              <button onClick={() => setPrintA4Item(null)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"><X className="w-4 h-4" /> Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700"><Printer className="w-3.5 h-3.5" /> Print A4 Voucher</button>
            </div>

            <div className="text-black text-sm p-4 print:p-0">
              <div className="flex items-center justify-start gap-4 border-b-2 border-black pb-3 mb-4">
                {schoolInfo?.logo && <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-[60px] w-[60px] object-contain shrink-0" />}
                <div className="text-left">
                  <h1 className="text-xl font-bold text-red-600 uppercase m-0">{schoolInfo?.name || 'INSTITUTIONAL MANAGEMENT SYSTEM'}</h1>
                  {schoolInfo?.address && <p className="text-[11px] m-0 mt-1 font-medium">{schoolInfo.address}</p>}
                  {schoolInfo?.phone && <p className="text-[11px] m-0 font-medium">{schoolInfo.phone}</p>}
                </div>
              </div>

              <div className="bg-red-600 text-white text-center py-2 text-sm font-bold mb-3 uppercase">OFFICIAL PAYMENT VOUCHER</div>

              <div className="text-right text-[11px] mb-3">
                <strong>Voucher No:</strong> {printA4Item.voucher_number || printA4Item.reference || `EXP-${printA4Item.id}`}
              </div>

              <div className="border border-black p-2 mb-4">
                <div className="text-[10px] italic mb-1">In Favour of Name & Address (Beneficiary)</div>
                <div className="font-bold text-[13px]">{printA4Item.name || printA4Item.description || '_____________________________________'}</div>
              </div>

              <table className="w-full border-collapse mb-4 text-xs">
                <thead>
                  <tr>
                    <th className="bg-slate-100 border border-black p-2 text-center w-[120px]">DATE</th>
                    <th className="bg-slate-100 border border-black p-2 text-center">PARTICULARS & DETAILS</th>
                    <th className="bg-slate-100 border border-black p-2 text-center w-[150px]">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let parsedLineItems: any[] = [];
                    try { parsedLineItems = typeof printA4Item.line_items_json === 'string' ? JSON.parse(printA4Item.line_items_json) : printA4Item.line_items_json || []; } catch {}
                    if (Array.isArray(parsedLineItems) && parsedLineItems.length > 0) {
                      return parsedLineItems.map((li: any, idx: number) => (
                        <tr key={idx}>
                          <td className="border border-black p-2 text-center">{li.date || '—'}</td>
                          <td className="border border-black p-2 font-medium">{li.particular}</td>
                          <td className="border border-black p-2 text-right font-bold">{fmtMoney(li.amount, baseCurrencySymbol)}</td>
                        </tr>
                      ));
                    } else {
                      return (
                        <>
                          <tr>
                            <td className="border border-black p-2 text-center">{formatDateShort(printA4Item.expense_date)}</td>
                            <td className="border border-black p-2 font-medium">{printA4Item.category_name || 'Expenditure'} {printA4Item.description ? `— ${printA4Item.description}` : ''}</td>
                            <td className="border border-black p-2 text-right font-bold">{fmtMoney(printA4Item.amount, baseCurrencySymbol)}</td>
                          </tr>
                          <tr><td className="border border-black p-3">&nbsp;</td><td className="border border-black p-3">&nbsp;</td><td className="border border-black p-3">&nbsp;</td></tr>
                        </>
                      );
                    }
                  })()}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td colSpan={2} className="text-right p-2 border border-black font-bold uppercase">TOTAL EXPENDITURE</td>
                    <td className="text-right p-2 border border-black font-bold">{fmtMoney(printA4Item.amount, baseCurrencySymbol)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="mt-5 text-[11px]">
                <div className="flex justify-between mb-4">
                  <div className="w-[45%]"><span className="font-bold inline-block w-[120px]">Prepared By:</span><span className="font-semibold border-b border-black pb-0.5 inline-block w-[200px]">{cleanName(printA4Item.prepared_by_name, 'System User')}</span></div>
                  <div className="w-[45%]"><span className="font-bold inline-block w-[120px]">Vote & Sub-head:</span><span className="font-semibold border-b border-black pb-0.5 inline-block w-[200px]">{printA4Item.vote_and_subhead || 'N/A'}</span></div>
                </div>
                <div className="flex justify-between mb-4">
                  <div className="w-[45%]"><span className="font-bold inline-block w-[120px]">Source Account:</span><span className="font-semibold border-b border-black pb-0.5 inline-block w-[200px]">{printA4Item.bank_account_name || 'Physical Cash Vault'}</span></div>
                  <div className="w-[45%]"><span className="font-bold inline-block w-[120px]">Authorised By:</span><span className="font-semibold border-b border-black pb-0.5 inline-block w-[200px]">{cleanName(printA4Item.authorised_by_name, '______________________')}</span></div>
                </div>
              </div>

              {(printA4Item.cheque_number || printA4Item.bank_name) && (
                <div className="border-2 border-black p-3 my-4 text-[11px]">
                  <div className="mb-2"><strong>Cheque No:</strong> {printA4Item.cheque_number || '_______'} &nbsp;|&nbsp; <strong>Bank:</strong> {printA4Item.bank_name || '_______'} &nbsp;|&nbsp; <strong>Issued By:</strong> {printA4Item.cheque_by || '_______'}</div>
                  <div><strong>Date Prepared:</strong> {formatDateShort(printA4Item.cheque_prepared_date ?? undefined)} &nbsp;|&nbsp; <strong>Date Signed:</strong> {formatDateShort(printA4Item.cheque_signed_date ?? undefined)}</div>
                </div>
              )}

              <div className="flex justify-between border-t border-slate-300 pt-4 mt-6 text-[11px]">
                <div><strong>Collected By:</strong> {cleanName(printA4Item.collected_by_name) !== '—' ? cleanName(printA4Item.collected_by_name) : (printA4Item.collected_by_other || '________________________')}</div>
                <div><strong>Recipient Signature:</strong> ________________________</div>
                <div><strong>Official Stamp:</strong> [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {printThermalItem && (
        <div onClick={() => setPrintThermalItem(null)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-[300px] rounded-xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">
            <div className="print:hidden flex justify-between items-center px-4 py-3 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setPrintThermalItem(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">Close</button>
              <button onClick={() => window.print()} className="px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-lg shadow-sm">Print Slip</button>
            </div>

            <div className="p-4 print:p-2 text-black font-mono" style={{ fontSize: '11px', lineHeight: '1.4' }}>
              <div className="text-center mb-3">
                <h2 className="font-black text-sm uppercase mb-0.5">{schoolInfo?.name || 'SCHOOL NAME'}</h2>
                <p className="text-[9px] mb-0.5">{schoolInfo?.address || 'Address Not Set'}</p>
                <p className="text-[9px]">{schoolInfo?.phone || ''}</p>
              </div>

              <div className="border-b border-dashed border-black mb-3"></div>
              <h3 className="font-bold text-xs mb-3 uppercase text-center tracking-widest">DISBURSEMENT SLIP</h3>

              <div className="flex justify-between mb-1 text-[10px]"><span>Voucher:</span><span className="font-bold truncate max-w-[150px] text-right">{printThermalItem.voucher_number || printThermalItem.reference || `EXP-${printThermalItem.id}`}</span></div>
              <div className="flex justify-between mb-1 text-[10px]"><span>Date:</span><span>{formatDateShort(printThermalItem.expense_date)}</span></div>
              <div className="flex justify-between mb-3 text-[10px]"><span>Time:</span><span>{formatTime(printThermalItem.created_at)}</span></div>

              <div className="border-b border-dashed border-black mb-3"></div>

              <div className="flex justify-between mb-1 text-[10px] text-left"><span>Favour Of:</span><span className="font-bold text-right pl-2 truncate">{printThermalItem.name || 'Vendor'}</span></div>
              <div className="flex justify-between mb-1 text-[10px]"><span>Category:</span><span className="font-bold">{printThermalItem.category_name || 'Expense'}</span></div>
              <div className="flex justify-between mb-3 text-[10px]"><span>Method:</span><span>{formatPaymentMethod(printThermalItem.payment_method)}</span></div>

              <div className="text-lg font-black my-4 text-center py-2 border-y-2 border-black">
                {fmtMoney(printThermalItem.amount, baseCurrencySymbol)}
              </div>

              {printThermalItem.foreign_currency && (
                <div className="text-center text-[9px] font-bold mt-2">Foreign: {printThermalItem.foreign_currency} {printThermalItem.foreign_amount}</div>
              )}

              <div className="border-b border-dashed border-black mb-3 mt-3"></div>
              <div className="text-center">
                <p className="text-[9px] mt-2 font-bold">Prepared by {cleanName(printThermalItem.prepared_by_name, 'System')}</p>
                <p className="text-[8px] mt-1 text-slate-500">Printed: {new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}