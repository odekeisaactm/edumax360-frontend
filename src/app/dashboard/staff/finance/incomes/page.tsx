'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import {
  incomeAPI, incomeCategoriesAPI, academicCalendarAPI,
  financeSettingsAPI, bankDetailsAPI, schoolInfoAPI,
} from '@/lib/api';
import type { Income } from '@/lib/finance.types';
import {
  TrendingUp, Search, X, Loader2, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Eye, Check, FileText, Plus, FilterX, Trash2, Landmark,
  Wallet, Calendar, Edit3, AlertTriangle, Printer, Building2
} from 'lucide-react';
import type { ExportRow } from './IncomeExporter';

const IncomeExporter = dynamic(() => import('./IncomeExporter'), { ssr: false });

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

// THE FIX: Clean Name Helper to remove <method-wrapper...> bugs
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
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border w-[calc(100vw-2rem)] sm:max-w-sm animate-in fade-in slide-in-from-top-2
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2"><X className="h-4 w-4" /></button>
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
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600">
          <Trash2 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center">Delete & Reverse Income</h3>
        <p className="text-sm text-slate-500 text-center leading-relaxed">
          Are you sure you want to delete <strong className="text-slate-800">Ref: {item.reference || `#${item.id}`}</strong> ({fmtMoney(item.amount)})? This will atomically debit the target bank or cash box balance.
        </p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 text-sm font-bold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-1.5 shadow-md shadow-red-200 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete & Debit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditIncomeModal({ open, item, onClose, onSave, loading, categories, banks, settings }: any) {
  const [form, setForm] = useState<any>({});
  const [initialForm, setInitialForm] = useState<any>({});

  useEffect(() => {
    if (item) {
      const initData = {
        category: item.category, amount: item.amount || '',
        payment_method: item.payment_method || 'bank_transfer',
        bank_account: item.bank_account || '', source: item.source || '', notes: item.notes || '',
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

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase mb-1";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Edit3 className="h-4 w-4" /> Edit Income Record (#{item.reference || item.id})
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {isFinancialChange ? (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
              <AlertTriangle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div><strong>Atomic Ledger Reversal:</strong> Modifying financial fields will atomically reverse the original ledger entry and post a new one.</div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
              <FileText className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div><strong>Metadata Update:</strong> Modifying categories or notes does not affect the bank ledger.</div>
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
            <div>
              <label className={labelCls}>Amount</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Payment Method</label>
              <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value, bank_account: e.target.value === 'cash' ? '' : form.bank_account })} className={inputCls} required>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="pos">POS</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Destination Account</label>
              <select value={form.bank_account || ''} onChange={e => setForm({ ...form, bank_account: e.target.value })} className={inputCls} required={form.payment_method !== 'cash' && settings?.track_bank_balance} disabled={form.payment_method === 'cash'}>
                <option value="">{form.payment_method === 'cash' ? 'Auto: Cash Vault' : 'Select Bank...'}</option>
                {(Array.isArray(banks) ? banks : []).filter((b: any) => b.account_type !== 'cash_vault').map((b: any) => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Received From / Source</label>
            <input type="text" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls + ' resize-none'} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={loading || !isModified} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-40 transition-colors">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {isFinancialChange ? 'Reverse & Update Ledger' : 'Update Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ConsolidatedIncomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const canViewIncome   = user?.is_superuser || hasPermission('finance.view_incomemodel');
  const canDeleteIncome = user?.is_superuser || hasPermission('finance.add_incomemodel');
  const canCreateIncome = user?.is_superuser || hasPermission('finance.add_incomemodel');
  const canEditIncome   = user?.is_superuser || hasPermission('finance.change_incomemodel') || hasPermission('finance.add_incomemodel');

  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery]       = useState('');
  const [sessionId, setSessionId]           = useState('');
  const [periodId, setPeriodId]             = useState('');
  const [startDate, setStartDate]           = useState('');
  const [endDate, setEndDate]               = useState('');

  const [data, setData]                     = useState<Income[]>([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [loading, setLoading]               = useState(true);
  const [pageError, setPageError]           = useState<string | null>(null);

  const [categories, setCategories]         = useState<any[]>([]);
  const [banks, setBanks]                   = useState<any[]>([]);
  const [sessionPeriods, setSessionPeriods] = useState<any[]>([]);
  const [sessions, setSessions]             = useState<any[]>([]);
  const [settings, setSettings]             = useState<any>(null);
  const [schoolInfo, setSchoolInfo]         = useState<any>(null);

  const [selectedItem, setSelectedItem]     = useState<Income | null>(null);
  const [deleteModal, setDeleteModal]       = useState<{ open: boolean; item: Income | null }>({ open: false, item: null });
  const [editModal, setEditModal]           = useState<{ open: boolean; item: Income | null }>({ open: false, item: null });
  const [actionLoading, setActionLoading]   = useState(false);
  const [toasts, setToasts]                 = useState<ToastItem[]>([]);

  // PRINT STATES
  const [printA4Item, setPrintA4Item]             = useState<Income | null>(null);
  const [printThermalItem, setPrintThermalItem]   = useState<Income | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const hasActiveFilters = Boolean(categoryFilter || searchQuery.trim() || sessionId || periodId || startDate || endDate);
  const clearAllFilters = () => { setCategoryFilter(''); setSearchQuery(''); setSessionId(''); setPeriodId(''); setStartDate(''); setEndDate(''); };

  useEffect(() => {
    Promise.all([
      incomeCategoriesAPI.list({ page_size: 1000 }).catch(() => []),
      bankDetailsAPI.list({ is_active: true }).catch(() => []),
      academicCalendarAPI.listSessions().catch(() => []),
      academicCalendarAPI.listSessionPeriods().catch(() => []),
      financeSettingsAPI.get().catch(() => ({})),
      schoolInfoAPI.get().catch(() => ({})),
    ]).then(([catsData, banksData, sessData, spData, settingsData, schoolData]) => {
      setCategories(Array.isArray(catsData) ? catsData : (catsData as any)?.results ?? []);
      setBanks(Array.isArray(banksData) ? banksData : (banksData as any)?.results ?? []);
      setSessions(Array.isArray(sessData) ? sessData : (sessData as any)?.results ?? []);
      setSessionPeriods(Array.isArray(spData) ? spData : (spData as any)?.results ?? []);
      setSettings(settingsData);
      setSchoolInfo(schoolData);
    });
  }, []);

  const availablePeriods = useMemo(() => {
    if (!sessionId) return [];
    return sessionPeriods.filter((sp: any) => String(sp.session?.id) === String(sessionId)).map((sp: any) => sp.period).filter(Boolean);
  }, [sessionId, sessionPeriods]);

  const baseCurrencySymbol = settings?.currency_config?.base_currency === 'USD' ? '$' : '₦';

  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (categoryFilter) params.category = categoryFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (sessionId) params.session_id = sessionId;
    if (periodId) params.academic_period_id = periodId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return params;
  }, [page, categoryFilter, searchQuery, sessionId, periodId, startDate, endDate]);

  const fetchData = useCallback(async () => {
    if (!canViewIncome) return;
    setLoading(true); setPageError(null);
    try {
      const response = await incomeAPI.list(buildParams());
      const results = Array.isArray(response) ? response : (response as any)?.results ?? [];
      // THE FIX: Properly fallback if count is stripped so the Next button logic doesn't break
      const totalCount = typeof (response as any)?.count === 'number' ? (response as any).count : 0;
      setData(results); setTotal(totalCount);
    } catch (err) { setPageError(extractError(err)); }
    finally { setLoading(false); }
  }, [buildParams, canViewIncome]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [categoryFilter, searchQuery, sessionId, periodId, startDate, endDate]);

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    const targetId = searchParams.get('open_detail');
    if (!targetId || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    router.replace(window.location.pathname, { scroll: false });
    const existing = data.find((d: any) => d.id === Number(targetId));
    if (existing) { setSelectedItem(existing); }
    else { incomeAPI.get(Number(targetId)).then((res: any) => { if (res) setSelectedItem(res); }).catch(() => {}); }
  }, [searchParams, data, router]);

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
      await incomeAPI.update(id, payload);
      showToast('success', 'Income record updated safely.');
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
      await incomeAPI.delete(deleteModal.item.id);
      showToast('success', 'Income record deleted and bank ledger debited.');
      setDeleteModal({ open: false, item: null });
      setSelectedItem(null);
      fetchData();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(false); }
  };

  const getExportRows = useCallback(async (): Promise<ExportRow[]> => {
    const params: any = { ...buildParams(), page_size: 2000 }; delete params.page;
    const response = await incomeAPI.list(params);
    const results = Array.isArray(response) ? response : (response as any)?.results ?? [];
    return results.map((item: Income) => ({
      id: item.id, categoryName: item.category_name || 'General Revenue', source: item.source || '—',
      paymentMethod: formatPaymentMethod(item.payment_method), bankAccountName: cleanName(item.bank_account_name, 'Physical Cash Vault'),
      amount: item.amount, incomeDate: formatDate(item.income_date), reference: item.reference || `INC-${item.id}`, notes: item.notes || '—',
    }));
  }, [buildParams]);

  if (!canViewIncome) return <div className="p-16 text-center font-bold text-red-600">Access Denied</div>;

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

      <ConfirmDeleteModal open={deleteModal.open} item={deleteModal.item} onConfirm={handleDeleteSubmit} onCancel={() => setDeleteModal({ open: false, item: null })} loading={actionLoading} />
      <EditIncomeModal open={editModal.open} item={editModal.item} onClose={() => setEditModal({ open: false, item: null })} onSave={handleEditSave} loading={actionLoading} categories={categories} banks={banks} settings={settings} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            Master Revenue Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 pl-10 sm:pl-12">Audit, track, and export institutional inflows</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canCreateIncome && (
            <button onClick={() => router.push('/dashboard/staff/finance/incomes/create')} className="flex-1 sm:flex-none justify-center px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs sm:text-sm rounded-lg sm:rounded-xl shadow-md shadow-blue-200 hover:from-blue-700 transition-all flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Income
            </button>
          )}
          <div className="flex-1 sm:flex-none">
            <IncomeExporter schoolName={schoolInfo?.name} getExportRows={getExportRows} baseCurrency={baseCurrencySymbol} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search reference or source..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full sm:w-auto px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setPeriodId(''); }} className="w-full sm:w-auto px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium">
              <option value="">All Sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-1 sm:flex-none">
              <div className="relative w-full sm:w-auto">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 sm:hidden" />
                <input type="date" max={todayStr} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-auto pl-8 sm:pl-3 pr-2 sm:pr-3 py-2 text-xs border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
              </div>
              <span className="text-slate-300 text-xs font-bold">—</span>
              <div className="relative w-full sm:w-auto">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 sm:hidden" />
                <input type="date" max={todayStr} min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-auto pl-8 sm:pl-3 pr-2 sm:pr-3 py-2 text-xs border border-slate-200 rounded-lg sm:rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasActiveFilters && (
                <button onClick={clearAllFilters} title="Clear Filters" className="p-2 sm:px-3 sm:py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg sm:rounded-xl hover:bg-red-100 text-xs font-bold flex items-center transition-colors">
                  <FilterX className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Clear</span>
                </button>
              )}
              <button onClick={fetchData} className="p-2 border border-slate-200 rounded-lg sm:rounded-xl hover:bg-slate-50 text-slate-600">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-12 sm:p-16 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-xs text-slate-400 font-medium">Loading institutional income records...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 sm:p-12 text-center text-red-600 font-medium text-sm">{pageError}</div>
        ) : data.length === 0 ? (
          <div className="p-12 sm:p-16 text-center space-y-2">
            <TrendingUp className="h-10 w-10 text-slate-200 mx-auto" />
            <h3 className="font-bold text-slate-700 text-sm sm:text-base">No revenue inflows found</h3>
            <p className="text-xs text-slate-400">Try clearing active filters or record a new institutional income.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 sm:px-4 py-3">Classification</th>
                  <th className="px-3 sm:px-4 py-3 hidden sm:table-cell">Destination Account</th>
                  <th className="px-3 sm:px-4 py-3 text-right">Amount</th>
                  <th className="px-3 sm:px-4 py-3 hidden md:table-cell">Method</th>
                  <th className="px-3 sm:px-4 py-3">Date</th>
                  <th className="px-3 sm:px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 sm:px-4 py-3">
                        <p className="font-bold text-slate-800 truncate max-w-[140px] sm:max-w-[220px]">{item.category_name || 'General Revenue'}</p>
                        <p className="text-[10px] sm:text-[11px] font-mono text-slate-400">{item.reference || `INC-${item.id}`}</p>
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                        <span className="text-[11px] sm:text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md">
                          {/* THE FIX: Applied cleanName here */}
                          {cleanName(item.bank_account_name, 'Physical Cash Vault')}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-black text-slate-900 text-xs sm:text-sm">
                        {fmtMoney(item.amount, baseCurrencySymbol)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-slate-600 font-medium text-xs hidden md:table-cell">
                        {formatPaymentMethod(item.payment_method)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-[11px] sm:text-xs text-slate-500 font-medium">
                        {formatDate(item.income_date)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button onClick={() => setSelectedItem(item)} title="Open Audit Drawer" className="px-3 py-1.5 rounded-lg text-white font-bold bg-slate-900 hover:bg-slate-800 shadow-sm transition-colors text-xs flex items-center gap-1.5">
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

        {data.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Pg {page} {total > 0 ? `of ${Math.ceil(total / PAGE_SIZE)} (${total} total)` : ''}</span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 sm:px-2.5 sm:py-1.5 border rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors flex items-center gap-1">
                <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Prev</span>
              </button>
              {/* THE FIX: Robust disabled check handling missing counts */}
              <button onClick={() => setPage(p => p + 1)} disabled={total > 0 ? page * PAGE_SIZE >= total : data.length < PAGE_SIZE} className="p-1.5 sm:px-2.5 sm:py-1.5 border rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors flex items-center gap-1">
                <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── AUDIT DRAWER ── */}
      {selectedItem && (
        <div onClick={() => setSelectedItem(null)} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

            <div className="px-5 py-4 sm:px-6 sm:py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <span className="text-[10px] sm:text-xs font-mono text-slate-400 uppercase tracking-widest">Revenue Ledger Audit</span>
                <h3 className="text-sm sm:text-base font-bold truncate max-w-[250px] sm:max-w-[320px]">Ref: {selectedItem.reference || `INC-${selectedItem.id}`}</h3>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Recorded</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900">{fmtMoney(selectedItem.amount, baseCurrencySymbol)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[10px] sm:text-xs font-bold uppercase px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md">{selectedItem.category_name || 'Revenue'}</span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm">{formatPaymentMethod(selectedItem.payment_method)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Destination Routing</h4>
                <div className="p-4 rounded-2xl border border-slate-100 bg-white flex items-center gap-3.5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                    {selectedItem.payment_method === 'cash' ? <Wallet className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                  </div>
                  <div>
                    {/* THE FIX: Applied cleanName here */}
                    <p className="font-bold text-slate-900 text-sm">{cleanName(selectedItem.bank_account_name, 'Assigned Physical Cash Vault')}</p>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Posted on {formatDate(selectedItem.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Metadata</h4>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 text-[11px] sm:text-xs bg-white">
                  <div className="p-3.5 flex justify-between"><span className="text-slate-500">Source</span><span className="font-bold text-slate-800 text-right">{selectedItem.source || '—'}</span></div>
                  <div className="p-3.5 flex justify-between"><span className="text-slate-500">Income Date</span><span className="font-semibold text-slate-800">{formatDate(selectedItem.income_date)}</span></div>
                  <div className="p-3.5 flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono font-bold text-slate-800">{selectedItem.reference || '—'}</span></div>
                  <div className="p-3.5 flex justify-between"><span className="text-slate-500">Recorded By</span><span className="font-medium text-slate-800">{cleanName(selectedItem.created_by_name, 'System User')}</span></div>
                  {selectedItem.notes && (
                    <div className="p-3.5 bg-slate-50/50 rounded-b-xl">
                      <span className="text-slate-500 font-bold block mb-1">Remarks</span>
                      <p className="text-slate-700 font-medium leading-relaxed">{selectedItem.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
              <div className="flex gap-2">
                 <button onClick={() => setPrintThermalItem(selectedItem)} title="Print POS Thermal Slip" className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
                    <Printer className="w-4 h-4" /> Thermal
                 </button>
                 <button onClick={() => setPrintA4Item(selectedItem)} title="Print Official A4 Receipt" className="px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
                    <FileText className="w-4 h-4" /> A4
                 </button>
              </div>

              <div className="flex gap-2">
                {canEditIncome && (
                  <button onClick={() => { setSelectedItem(null); setEditModal({ open: true, item: selectedItem }); }} disabled={(settings?.reversal_window_hours > 0 && ((Date.now() - new Date(selectedItem.created_at).getTime()) / (1000 * 60 * 60) > settings.reversal_window_hours))} title="Edit" className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl hover:bg-amber-100 disabled:opacity-40 transition-colors flex items-center gap-1.5">
                    <Edit3 className="h-4 w-4" /> Edit
                  </button>
                )}
                {canDeleteIncome && (
                  <button onClick={() => { setSelectedItem(null); setDeleteModal({ open: true, item: selectedItem }); }} disabled={(settings?.reversal_window_hours > 0 && ((Date.now() - new Date(selectedItem.created_at).getTime()) / (1000 * 60 * 60) > settings.reversal_window_hours))} title="Delete & Reverse" className="px-3 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm transition-colors">
                    <Trash2 className="h-4 w-4" /> Reverse
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT DOM OVERLAYS ── */}
      {printA4Item && (
        <div onClick={() => setPrintA4Item(null)} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setPrintA4Item(null)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"><X className="w-4 h-4" /> Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"><Printer className="w-3.5 h-3.5" /> Print Receipt</button>
            </div>

            <div className="p-8 print:p-6 text-slate-800">
              <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 mb-5">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-14 w-14 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-7 w-7 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-black uppercase tracking-wide text-slate-900 truncate">{schoolInfo?.name || 'School Name Not Set'}</h1>
                  <p className="text-[11px] font-medium text-slate-500 truncate">{schoolInfo?.address || 'Official Financial Record'}</p>
                  <p className="text-[11px] font-medium text-slate-500">{[schoolInfo?.email, schoolInfo?.phone].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 whitespace-nowrap">
                  Official Receipt
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">Ref: {printA4Item.reference || `INC-${printA4Item.id}`}</span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">{formatDateShort(printA4Item.income_date)} · {formatTime(printA4Item.created_at)}</span>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-4 mb-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Received From / Source</p>
                  <p className="text-base font-black text-slate-900 truncate">{printA4Item.source || 'Institutional Inflow'}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <span className="text-[9px] font-bold uppercase text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-indigo-100">{formatPaymentMethod(printA4Item.payment_method)}</span>
                    {/* THE FIX: Applied cleanName here */}
                    <span className="text-[9px] font-bold text-slate-500">Routing: {cleanName(printA4Item.bank_account_name, 'Cash Vault')}</span>
                  </div>
                </div>
                <p className="text-2xl font-black text-indigo-700 shrink-0 whitespace-nowrap">{fmtMoney(printA4Item.amount, baseCurrencySymbol)}</p>
              </div>

              <div className="mb-5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Income Details</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <span className="text-[11px] font-black text-slate-700">{printA4Item.category_name || 'General Revenue'}</span>
                  </div>
                  <div className="px-3 py-3 space-y-1">
                     {printA4Item.notes ? (
                       <p className="text-[11px] text-slate-600 font-medium">{printA4Item.notes}</p>
                     ) : (
                       <p className="text-[11px] text-slate-400 italic">No additional notes recorded.</p>
                     )}
                     {printA4Item.foreign_currency && (
                       <p className="text-[11px] text-emerald-600 font-bold mt-2 pt-2 border-t border-slate-100">
                         Foreign Inflow Logged: {printA4Item.foreign_currency} {printA4Item.foreign_amount}
                       </p>
                     )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mt-8 text-[11px]">
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">{cleanName(printA4Item.created_by_name, 'System User')}</p>
                  <p className="text-slate-400 font-medium">Processed By</p>
                </div>
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-400">&nbsp;</p>
                  <p className="text-slate-400 font-medium">Authorized Signature &amp; Stamp</p>
                </div>
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
              <h3 className="font-bold text-xs mb-3 uppercase text-center tracking-widest">INCOME RECEIPT</h3>

              <div className="flex justify-between mb-1 text-[10px]"><span>Ref:</span><span className="font-bold">{printThermalItem.reference || `INC-${printThermalItem.id}`}</span></div>
              <div className="flex justify-between mb-1 text-[10px]"><span>Date:</span><span>{formatDateShort(printThermalItem.income_date)}</span></div>
              <div className="flex justify-between mb-3 text-[10px]"><span>Time:</span><span>{formatTime(printThermalItem.created_at)}</span></div>

              <div className="border-b border-dashed border-black mb-3"></div>

              <div className="flex justify-between mb-1 text-[10px]"><span>Category:</span><span className="font-bold">{printThermalItem.category_name || 'Revenue'}</span></div>
              <div className="flex justify-between mb-1 text-[10px] text-left"><span>Source:</span><span className="font-bold text-right pl-2">{printThermalItem.source || 'Inflow'}</span></div>
              <div className="flex justify-between mb-3 text-[10px]"><span>Method:</span><span>{formatPaymentMethod(printThermalItem.payment_method)}</span></div>

              <div className="text-lg font-black my-4 text-center py-2 border-y-2 border-black">
                {fmtMoney(printThermalItem.amount, baseCurrencySymbol)}
              </div>

              {printThermalItem.foreign_currency && (
                <div className="text-center text-[9px] font-bold mt-2">Foreign: {printThermalItem.foreign_currency} {printThermalItem.foreign_amount}</div>
              )}

              <div className="border-b border-dashed border-black mb-3 mt-3"></div>
              <div className="text-center">
                <p className="text-[9px] mt-2 font-bold">Processed by {cleanName(printThermalItem.created_by_name, 'System')}</p>
                <p className="text-[8px] mt-1 text-slate-500">Printed: {new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}