// app/dashboard/staff/inventory/sales/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { saleAPI, staffAPI } from '@/lib/api';
import { Sale, Staff } from '@/lib/types';
import {
  CreditCard, Search, X, Check, AlertCircle, AlertTriangle, Loader2,
  RefreshCw, Eye, ChevronLeft, ChevronRight, Plus, Download,
  FileSpreadsheet, FileText, ChevronDown, ShoppingBag, User,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Refund Modal ──────────────────────────────────────────────────────────────
function RefundModal({ open, sale, isProcessing, onConfirm, onCancel }: {
  open: boolean; sale: Sale | null; isProcessing: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !sale) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Process Refund</h3>
        <p className="text-sm text-slate-500 text-center mb-4">
          Are you sure you want to refund order <span className="font-mono font-semibold">{sale.transaction_id}</span>?
        </p>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 mb-4">
          <strong>Note:</strong> This action will restore the items to inventory and mark the order as refunded. Wallet balances will be updated automatically.
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isProcessing} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isProcessing} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <><AlertTriangle className="h-4 w-4" /> Confirm Refund</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Download Dropdown ─────────────────────────────────────────────────────────
function DownloadDropdown({ onExcel, onPDF, downloading }: {
  onExcel: () => void; onPDF: () => void; downloading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(p => !p)} disabled={downloading} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50">
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
          <div className="p-1.5">
            <button onClick={() => { onExcel(); setOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left">
              <div className="w-8 h-8 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0"><FileSpreadsheet className="h-4 w-4 text-emerald-600" /></div>
              <div><p className="font-semibold text-slate-800 text-xs">Excel (.csv)</p><p className="text-[11px] text-slate-400">Sales history</p></div>
            </button>
            <button onClick={() => { onPDF(); setOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left">
              <div className="w-8 h-8 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center flex-shrink-0"><FileText className="h-4 w-4 text-red-500" /></div>
              <div><p className="font-semibold text-slate-800 text-xs">PDF</p><p className="text-[11px] text-slate-400">Printable receipt log</p></div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SalesPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 20;

  // Refund Modal
  const [refundSale, setRefundSale] = useState<Sale | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  const canSell = user?.is_superuser || hasPermission('inventory.add_salemodel');
  const canRefund = user?.is_superuser || hasPermission('inventory.add_salemodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    staffAPI.list({ page_size: 100 }).then((res: any) => {
      setStaffList(res?.results || []);
    }).catch(() => {});
  }, []);

  const fetchSales = useCallback(async (pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (staffFilter) params.created_by = staffFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await saleAPI.list(params) as any;
      const results = data?.results ?? data?.data ?? [];
      setSales(Array.isArray(results) ? results : []);
      setTotal(data?.count ?? results.length);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [search, statusFilter, staffFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchSales(1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search]);

  useEffect(() => { fetchSales(1); }, [statusFilter, staffFilter, dateFrom, dateTo]);

  const handleRefund = async () => {
    if (!refundSale) return;
    setIsRefunding(true);
    try {
      const updated = await saleAPI.refund(refundSale.id);
      setSales(prev => prev.map(s => s.id === updated.id ? updated : s));
      showToast('success', `Order ${updated.transaction_id} refunded successfully.`);
      setRefundSale(null);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setIsRefunding(false); }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      // Fetch ALL records matching current filters
      const params: Record<string, any> = { page_size: 99999 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (staffFilter) params.created_by = staffFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await saleAPI.list(params) as any;
      const allSales = data?.results || [];

      if (allSales.length === 0) {
        showToast('error', 'No data available to export.');
        setDownloading(false);
        return;
      }

      // Format data for CSV
      const headers = ['Transaction ID', 'Date', 'Customer Type', 'Customer Name', 'Total Amount', 'Status', 'Processed By'];
      const rows = allSales.map((s: Sale) => [
        s.transaction_id,
        new Date(s.sale_date).toLocaleString(),
        s.customer ? 'Student' : s.staff_customer ? 'Staff' : 'Walk-in',
        s.customer_name || s.staff_customer_name || 'Walk-in Customer',
        s.total_amount,
        s.status,
        s.created_by_name || '—'
      ]);

      // Convert to CSV string
      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map(item => `"${String(item).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Create Blob and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('success', 'Excel export downloaded successfully.');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPDF = () => {
    // Trigger native browser print dialog to save as PDF
    setDownloading(true);
    setTimeout(() => {
      window.print();
      setDownloading(false);
    }, 500);
  };

  const clearFilters = () => { setStatusFilter(''); setStaffFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); };
  const hasFilters = !!(search || statusFilter || staffFilter || dateFrom || dateTo);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <RefundModal open={!!refundSale} sale={refundSale} isProcessing={isRefunding} onConfirm={handleRefund} onCancel={() => setRefundSale(null)} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            All Orders
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">View sales history and process refunds</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DownloadDropdown onExcel={handleDownloadExcel} onPDF={handleDownloadPDF} downloading={downloading} />
          {canSell && (
            <button onClick={() => router.push('/dashboard/staff/inventory/pos')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> Place New Order
            </button>
          )}
        </div>
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-50 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search by Transaction ID, Customer Name..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white ${statusFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'}`}>
                <option value="">All Status</option>
                <option value="completed">Completed</option>
                <option value="refunded">Refunded</option>
              </select>
              <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white ${staffFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'}`}>
                <option value="">All Staff</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600" />
              {hasFilters && <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"><X className="h-3.5 w-3.5" /> Clear</button>}
              <button onClick={() => fetchSales(page)} title="Refresh" className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><RefreshCw className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" /><p className="mt-2 text-sm text-slate-400">Loading orders...</p></div>
        ) : pageError ? (
          <div className="p-10 text-center"><AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-red-600 mb-3">{pageError}</p><button onClick={() => fetchSales(1)} className="text-sm text-blue-600 underline inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Retry</button></div>
        ) : sales.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><ShoppingBag className="h-7 w-7 text-blue-300" /></div>
            <h3 className="font-semibold text-slate-700 mb-1">No orders found</h3>
            <p className="text-sm text-slate-400 mb-5">{hasFilters ? 'Try adjusting your search or filters.' : 'Place your first order to get started.'}</p>
            {!hasFilters && canSell && <button onClick={() => router.push('/dashboard/staff/inventory/pos')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200"><Plus className="h-4 w-4" /> Place New Order</button>}
          </div>
        ) : (
          <>
            <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100" style={{ gridTemplateColumns: '1fr 140px 220px 120px 110px 90px' }}>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Transaction ID</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total (₦)</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {sales.map(s => (
                <div key={s.id} className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors" style={{ gridTemplateColumns: '1fr 140px 220px 120px 110px 90px' }}>
                  <div className="min-w-0"><p className="font-mono text-xs text-slate-700 truncate">{s.transaction_id}</p><p className="text-[10px] text-slate-400 truncate sm:hidden">{new Date(s.sale_date).toLocaleDateString()}</p></div>
                  <div className="hidden sm:block text-xs text-slate-500">{new Date(s.sale_date).toLocaleDateString()}</div>
                  <div className="min-w-0">
                    {s.customer ? <span className="inline-flex items-center gap-1.5"><span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 rounded">Student</span><span className="text-xs text-slate-700 truncate">{s.customer_name}</span></span> :
                     s.staff_customer ? <span className="inline-flex items-center gap-1.5"><span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded">Staff</span><span className="text-xs text-slate-700 truncate">{s.staff_customer_name}</span></span> :
                     <span className="inline-flex items-center gap-1.5"><User className="h-3 w-3 text-slate-400" /><span className="text-xs text-slate-500 truncate">Walk-in</span></span>}
                  </div>
                  <div className="text-sm font-bold text-slate-800">{Number(s.total_amount || 0).toLocaleString()}</div>
                  <div>
                    {s.status === 'completed' ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-100"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Completed</span> :
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-100"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Refunded</span>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => router.push(`/dashboard/staff/inventory/sales/${s.id}`)} title="View Details" className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all"><Eye className="h-3.5 w-3.5" /></button>
                    {canRefund && s.status === 'completed' && <button onClick={() => setRefundSale(s)} title="Process Refund" className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all"><AlertTriangle className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of <span className="font-semibold text-slate-600">{total}</span> orders</p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchSales(page - 1)} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                    return <button key={pg} onClick={() => fetchSales(pg)} className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${pg === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{pg}</button>;
                  })}
                  <button onClick={() => fetchSales(page + 1)} disabled={page === totalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}