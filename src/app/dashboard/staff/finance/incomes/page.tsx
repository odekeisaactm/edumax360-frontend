'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import {
  incomeAPI,
  incomeCategoriesAPI,
  academicCalendarAPI,
  financeSettingsAPI,
} from '@/lib/api';
import type { Income, IncomeCategory } from '@/lib/finance.types';
import {
  TrendingUp, Search, X, Loader2, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Eye, Check, FileText, DollarSign, Plus,
  ExternalLink, FilterX, Trash2, Landmark, Wallet,
} from 'lucide-react';
import type { ExportRow } from './IncomeExporter';

const IncomeExporter = dynamic(() => import('./IncomeExporter'), { ssr: false });

// ─── Helpers & Types ──────────────────────────────────────────────────────────
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

function fmtMoney(amount: string | number, symbol = '₦'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${symbol}0.00`;
  return symbol + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const PAGE_SIZE = 20;

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in slide-in-from-top-2
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({ open, item, onConfirm, onCancel, loading }: any) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600">
          <Trash2 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center">Delete & Reverse Income</h3>
        <p className="text-xs text-slate-500 text-center leading-relaxed">
          Are you sure you want to delete <strong className="text-slate-800">Ref: {item.reference || `#${item.id}`}</strong> ({fmtMoney(item.amount)})? This will atomically debit the target bank or cash box balance.
        </p>
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 text-xs font-semibold border rounded-xl hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-1.5 shadow-md shadow-red-200">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete & Debit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Thermal/A4 Receipt Generator ─────────────────────────────────────────────
function triggerPrintReceipt(item: Income, schoolName?: string, baseCurrency = '₦') {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to print receipts.'); return; }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Income Receipt - Ref #${item.reference || item.id}</title>
  <style>
    body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-w: 420px; margin: 0 auto; color: #111; }
    .text-center { text-align: center; }
    .border-b { border-bottom: 1px dashed #444; padding-bottom: 12px; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
    .bold { font-weight: bold; }
    .amount { font-size: 20px; margin: 16px 0; text-align: center; border: 2px solid #111; padding: 10px; font-weight: 800; }
    .no-print { margin-bottom: 20px; text-align: center; }
    .btn { padding: 8px 16px; font-size: 13px; cursor: pointer; border-radius: 6px; border: 1px solid #ccc; background: #f0f0f0; font-weight: bold; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" class="btn" style="background:#2563eb;color:#fff;border:none;">🖨️ Print Receipt</button>
    <button onclick="window.close()" class="btn" style="margin-left:8px;">❌ Close Window</button>
  </div>
  <div class="text-center border-b">
    <h2 style="margin:0;font-size:16px;">${schoolName || 'SCHOOL MANAGEMENT SYSTEM'}</h2>
    <p style="margin:4px 0 0;font-size:12px;">OFFICIAL INFLOW RECEIPT</p>
  </div>
  <div class="row"><span>Reference:</span><span class="bold">${item.reference || `INC-${item.id}`}</span></div>
  <div class="row"><span>Date Received:</span><span>${formatDate(item.income_date)}</span></div>
  <div class="border-b"></div>
  <div class="row"><span>Category:</span><span class="bold">${item.category_name || 'General Revenue'}</span></div>
  <div class="row"><span>Received From:</span><span>${item.source || 'Institutional Inflow'}</span></div>
  <div class="row"><span>Payment Method:</span><span class="capitalize">${item.payment_method || 'Bank Transfer'}</span></div>
  <div class="row"><span>Destination Account:</span><span class="bold">${item.bank_account_name || 'Physical Cash Vault'}</span></div>
  <div class="amount">${fmtMoney(item.amount, baseCurrency)}</div>
  ${item.foreign_currency ? `<div class="row" style="color:#059669;"><span>Foreign Inflow:</span><span class="bold">${item.foreign_currency} ${item.foreign_amount}</span></div>` : ''}
  <div class="border-b"></div>
  <div class="text-center" style="font-size:11px;margin-top:16px;">Recorded by ${item.created_by_name || 'System User'}.<br/>Printed on ${new Date().toLocaleString()}</div>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Slide-Out Audit Drawer ───────────────────────────────────────────────────
function AuditDrawer({ item, onClose, onDelete, canDelete, schoolName, baseCurrency, settings }: any) {
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        triggerPrintReceipt(item, schoolName, baseCurrency);
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, schoolName, baseCurrency, onClose]);

  if (!item) return null;

  // Reversal Window Calculation
  const windowHours = settings?.reversal_window_hours ?? 24;
  const hoursOld = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
  const isExpired = windowHours > 0 && hoursOld > windowHours;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Revenue Ledger Audit</span>
            <h3 className="text-base font-bold truncate max-w-[320px]">Ref: {item.reference || `INC-${item.id}`}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Amount Banner */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Total Amount Recorded</p>
              <p className="text-2xl font-black text-slate-900">{fmtMoney(item.amount, baseCurrency)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-bold uppercase px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md">
                {item.category_name || 'Revenue'}
              </span>
              <span className="text-[11px] text-slate-500 capitalize">{item.payment_method || 'transfer'}</span>
            </div>
          </div>

          {/* Multi-Currency Conversion Info */}
          {item.foreign_currency && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Foreign Exchange Conversion
              </span>
              <p className="text-xs text-emerald-950 font-medium">
                Received <strong className="font-bold">{item.foreign_currency} {Number(item.foreign_amount).toLocaleString()}</strong> converted at a locked rate of <strong className="font-mono">1 {item.foreign_currency} = {baseCurrency} {Number(item.exchange_rate).toLocaleString()}</strong>.
              </p>
            </div>
          )}

          {/* Attached Supporting Receipt */}
          {item.receipt ? (
            <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" /> Attached Supporting Receipt
                </span>
                <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">Verified Upload</span>
              </div>
              <a href={typeof item.receipt === 'string' ? item.receipt : '#'} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors shadow-2xs">
                <span className="text-xs font-bold truncate max-w-[280px]">Open Document / Bank Slip</span>
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
              </a>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400 italic flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-300" /> No supporting document attached to this income record.
            </div>
          )}

          {/* Destination Routing */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destination Account Routing</h4>
            <div className="p-4 rounded-2xl border border-slate-100 bg-white flex items-center gap-3.5 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                {item.payment_method === 'cash' ? <Wallet className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">
                  {item.bank_account_name || 'Assigned Physical Cash Vault'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ledger entry posted on {formatDate(item.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Ledger Trail & Source Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Metadata</h4>
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm bg-white">
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Source / Received From</span><span className="font-bold text-slate-800">{item.source || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Income Date</span><span className="font-semibold text-slate-800">{formatDate(item.income_date)}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Reference Number</span><span className="font-mono font-medium text-slate-800">{item.reference || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Recorded By</span><span className="font-medium text-slate-800">{item.created_by_name || 'System User'}</span></div>
              {item.notes && (
                <div className="p-3.5 space-y-1">
                  <span className="text-slate-400 text-xs block uppercase">Remarks</span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">{item.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <button onClick={() => triggerPrintReceipt(item, schoolName, baseCurrency)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs">
            <FileText className="h-3.5 w-3.5 text-blue-600" /> Print Receipt
          </button>

          {canDelete && (
            <button
              onClick={() => onDelete(item)}
              disabled={isExpired}
              title={isExpired ? `Reversal grace period (${windowHours}h) expired` : 'Delete & Reverse'}
              className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5" /> {isExpired ? 'Reversal Expired' : 'Delete & Reverse'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Consolidated Income Page ─────────────────────────────────────────────
export default function ConsolidatedIncomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user, schoolInfo } = useAuth();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const canViewIncome   = user?.is_superuser || hasPermission('finance.view_incomemodel');
  const canDeleteIncome = user?.is_superuser || hasPermission('finance.delete_incomemodel');

  // State
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

  // References
  const [categories, setCategories]         = useState<IncomeCategory[]>([]);
  const [sessionPeriods, setSessionPeriods] = useState<any[]>([]);
  const [sessions, setSessions]             = useState<any[]>([]);
  const [settings, setSettings]             = useState<any>(null);

  // Drawer & Modals
  const [selectedItem, setSelectedItem]     = useState<Income | null>(null);
  const [deleteModal, setDeleteModal]       = useState<{ open: boolean; item: Income | null }>({ open: false, item: null });
  const [actionLoading, setActionLoading]   = useState(false);

  const [toasts, setToasts]                 = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const hasActiveFilters = Boolean(categoryFilter || searchQuery.trim() || sessionId || periodId || startDate || endDate);

  const clearAllFilters = () => {
    setCategoryFilter('');
    setSearchQuery('');
    setSessionId('');
    setPeriodId('');
    setStartDate('');
    setEndDate('');
  };

  // 1. Load Reference Data
  useEffect(() => {
    Promise.all([
      incomeCategoriesAPI.list().catch(() => []),
      academicCalendarAPI.listSessions().catch(() => []),
      academicCalendarAPI.listSessionPeriods().catch(() => []),
      financeSettingsAPI.get().catch(() => ({})),
    ]).then(([catsData, sessData, spData, settingsData]) => {
      setCategories(Array.isArray(catsData) ? catsData : (catsData as any)?.results ?? []);
      setSessions(Array.isArray(sessData) ? sessData : (sessData as any)?.results ?? []);
      setSessionPeriods(Array.isArray(spData) ? spData : (spData as any)?.results ?? []);
      setSettings(settingsData);
    });
  }, []);

  const availablePeriods = useMemo(() => {
    if (!sessionId) return [];
    return sessionPeriods
      .filter((sp: any) => String(sp.session?.id) === String(sessionId))
      .map((sp: any) => sp.period)
      .filter(Boolean);
  }, [sessionId, sessionPeriods]);

  const baseCurrencySymbol = settings?.currency_config?.base_currency === 'USD' ? '$' : '₦';

  // 2. Build Query Params
  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (categoryFilter)                       params.category            = categoryFilter;
    if (searchQuery.trim())                   params.search              = searchQuery.trim();
    if (sessionId)                            params.session_id          = sessionId;
    if (periodId)                             params.academic_period_id  = periodId;
    if (startDate)                            params.start_date          = startDate;
    if (endDate)                              params.end_date            = endDate;
    return params;
  }, [page, categoryFilter, searchQuery, sessionId, periodId, startDate, endDate]);

  // 3. Fetch Data
  const fetchData = useCallback(async () => {
    if (!canViewIncome) return;
    setLoading(true); setPageError(null);
    try {
      const response = await incomeAPI.list(buildParams());
      const results = Array.isArray(response) ? response : (response as any)?.results ?? [];
      const totalCount = typeof (response as any)?.count === 'number' ? (response as any).count : results.length;
      setData(results);
      setTotal(totalCount);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [buildParams, canViewIncome]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [categoryFilter, searchQuery, sessionId, periodId, startDate, endDate]);

  // 4. Auto-Open Drawer ONCE on landing & clean URL
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    const targetId = searchParams.get('open_detail');
    if (!targetId || autoOpenedRef.current) return;

    const numId = Number(targetId);
    autoOpenedRef.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('open_detail');
    const newQuery = params.toString();
    const cleanUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
    router.replace(cleanUrl, { scroll: false });

    const existing = data.find((d: any) => d.id === numId);
    if (existing) {
      setSelectedItem(existing);
    } else {
      incomeAPI.get(numId).then((res: any) => {
        if (res) setSelectedItem(res);
      }).catch(() => {});
    }
  }, [searchParams, data, router]);

  // 5. Delete Action Handler
  const handleDeleteSubmit = async () => {
    if (!deleteModal.item) return;
    setActionLoading(true);
    try {
      await incomeAPI.delete(deleteModal.item.id);
      showToast('success', 'Income record deleted and bank ledger debited.');
      setDeleteModal({ open: false, item: null });
      setSelectedItem(null);
      fetchData();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const getExportRows = useCallback(async (): Promise<ExportRow[]> => {
    const params: any = { ...buildParams(), page_size: 2000 }; delete params.page;
    const response = await incomeAPI.list(params);
    const results = Array.isArray(response) ? response : (response as any)?.results ?? [];
    return results.map((item: Income) => ({
      id: item.id,
      categoryName: item.category_name || 'General Revenue',
      source: item.source || '—',
      paymentMethod: item.payment_method || 'transfer',
      bankAccountName: item.bank_account_name || 'Physical Cash Vault',
      amount: item.amount,
      incomeDate: formatDate(item.income_date),
      reference: item.reference || `INC-${item.id}`,
      notes: item.notes || '—',
    }));
  }, [buildParams]);

  if (!canViewIncome) {
    return <div className="p-16 text-center font-bold text-red-600">Access Denied: Missing income view permissions.</div>;
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Slide-out Audit Drawer */}
      <AuditDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={(item: Income) => setDeleteModal({ open: true, item })}
        canDelete={canDeleteIncome}
        schoolName={schoolInfo?.name}
        baseCurrency={baseCurrencySymbol}
        settings={settings}
      />

      {/* Delete Modal */}
      <ConfirmDeleteModal
        open={deleteModal.open}
        item={deleteModal.item}
        onConfirm={handleDeleteSubmit}
        onCancel={() => setDeleteModal({ open: false, item: null })}
        loading={actionLoading}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            Master Revenue Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Audit, track, and export institutional inflows and school revenues</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/finance/income/create')} className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-200 hover:from-blue-700 transition-all flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record New Income
          </button>
          <IncomeExporter schoolName={schoolInfo?.name} getExportRows={getExportRows} baseCurrency={baseCurrencySymbol} />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference number or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setPeriodId(''); }} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium">
            <option value="">All Sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
          </select>

          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={!sessionId || availablePeriods.length === 0} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50 disabled:text-slate-400">
            <option value="">All Periods</option>
            {availablePeriods.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Date Pickers */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              max={todayStr}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <span className="text-slate-300 text-xs font-bold">—</span>
            <input
              type="date"
              max={todayStr}
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                title="Clear all active filters"
                className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <FilterX className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
            <button onClick={fetchData} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} /></button>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-xs text-slate-400 font-medium">Loading institutional income records...</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center text-red-600 font-medium">{pageError}</div>
        ) : data.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <TrendingUp className="h-10 w-10 text-slate-200 mx-auto" />
            <h3 className="font-bold text-slate-700">No revenue inflows found</h3>
            <p className="text-xs text-slate-400">Try clearing active filters or record a new institutional income.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3.5 min-w-[220px]">Classification</th>
                  <th className="px-4 py-3.5">Destination Account</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Method</th>
                  <th className="px-4 py-3.5">Date Received</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  const windowHours = settings?.reversal_window_hours ?? 24;
                  const hoursOld = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
                  const isExpired = windowHours > 0 && hoursOld > windowHours;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 min-w-[220px]">
                        <p className="font-bold text-slate-800">{item.category_name || 'General Revenue'}</p>
                        <p className="text-[11px] font-mono text-slate-400">{item.reference || `INC-${item.id}`}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          {item.bank_account_name || 'Physical Cash Vault'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">
                        {fmtMoney(item.amount, baseCurrencySymbol)}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600 font-medium">
                        {item.payment_method || 'transfer'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium">
                        {formatDate(item.income_date)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => triggerPrintReceipt(item, schoolInfo?.name, baseCurrencySymbol)} title="Print Receipt" className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors">
                            <FileText className="h-4 w-4" />
                          </button>
                          {canDeleteIncome && (
                            <button
                              onClick={() => setDeleteModal({ open: true, item })}
                              disabled={isExpired}
                              title={isExpired ? `Reversal grace period (${windowHours}h) expired` : 'Delete & Debit Ledger'}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setSelectedItem(item)} title="Open Audit Drawer" className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
                            <Eye className="h-4 w-4" />
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

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Page {page} of {Math.ceil(total / PAGE_SIZE) || 1} ({total} records)</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}