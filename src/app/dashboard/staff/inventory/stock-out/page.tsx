// app/dashboard/staff/inventory/stock-out/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { stockOutAPI } from '@/lib/api';
import { StockOut } from '@/lib/types';
import {
  PackageMinus, Plus, Search, X, AlertCircle, Loader2,
  RefreshCw, ChevronLeft, ChevronRight, MapPin, CalendarDays,
  User, Tag, Check,
} from 'lucide-react';

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

const REASON_LABELS: Record<string, string> = {
  staff_collection: 'Staff Collection',
  damage: 'Damage',
  expired: 'Expired',
  adjustment: 'Adjustment',
  wastage: 'Wastage',
  transfer: 'Transfer',
  disbursement: 'Disbursement',
};

const REASON_COLORS: Record<string, string> = {
  staff_collection: 'bg-blue-50 text-blue-700 border-blue-100',
  damage:           'bg-red-50 text-red-700 border-red-100',
  expired:          'bg-orange-50 text-orange-700 border-orange-100',
  adjustment:       'bg-violet-50 text-violet-700 border-violet-100',
  wastage:          'bg-amber-50 text-amber-700 border-amber-100',
  transfer:         'bg-teal-50 text-teal-700 border-teal-100',
  disbursement:     'bg-emerald-50 text-emerald-700 border-emerald-100',
};

// Group records by date string
function groupByDate(records: StockOut[]): { date: string; items: StockOut[] }[] {
  const map = new Map<string, StockOut[]>();
  for (const r of records) {
    const key = r.date_removed;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

const PAGE_SIZE = 20;

export default function StockOutListPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [records, setRecords] = useState<StockOut[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingSearch, setPendingSearch] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canManage = user?.is_superuser || hasPermission('inventory.add_stockoutmodel');
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchRecords = useCallback(async (search: string, reason: string, pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const params: any = { page: pg };
      if (search) params.search = search;
      if (reason) params.reason = reason;
      const data = await stockOutAPI.list(params);
      let results: StockOut[] = [];
      let totalCount = 0;
      if (Array.isArray(data)) { results = data; totalCount = data.length; }
      else if (data?.results && Array.isArray(data.results)) { results = data.results; totalCount = data.count || results.length; }
      setRecords(results);
      setTotal(totalCount);
      setPage(pg);
    } catch (err) { setPageError(extractError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords('', '', 1); }, []);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchRecords(pendingSearch, selectedReason, 1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [pendingSearch, selectedReason]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const grouped = groupByDate(records);

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center shadow-md shadow-rose-200">
              <PackageMinus className="h-5 w-5 text-white" />
            </div>
            Stock Out Records
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Stock removed from inventory locations</p>
        </div>
        {canManage && (
          <button
            onClick={() => router.push('/dashboard/staff/inventory/stock-out/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-semibold rounded-xl hover:from-rose-600 hover:to-red-700 transition-all shadow-md shadow-rose-200"
          >
            <Plus className="h-4 w-4" /> New Stock Out
          </button>
        )}
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: total, color: 'from-rose-500 to-red-600' },
          { label: 'This Page', value: records.length, color: 'from-slate-500 to-slate-600' },
          { label: 'Date Groups', value: grouped.length, color: 'from-blue-500 to-indigo-600' },
          { label: 'Total Removed', value: records.reduce((s, r) => s + Number(r.quantity_removed), 0).toFixed(0), color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <PackageMinus className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search by item name or barcode..."
                value={pendingSearch} onChange={e => setPendingSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none" />
              {pendingSearch && (
                <button onClick={() => setPendingSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select value={selectedReason} onChange={e => setSelectedReason(e.target.value)}
              className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none bg-white">
              <option value="">All Reasons</option>
              {Object.entries(REASON_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button onClick={() => fetchRecords(pendingSearch, selectedReason, page)} title="Refresh"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-rose-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading records...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchRecords(pendingSearch, selectedReason, 1)}
              className="text-sm text-rose-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PackageMinus className="h-7 w-7 text-rose-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No stock-out records found</h3>
            <p className="text-sm text-slate-400 mb-5">
              {pendingSearch || selectedReason ? 'Try adjusting your filters.' : 'Record your first stock out to get started.'}
            </p>
            {!pendingSearch && !selectedReason && canManage && (
              <button onClick={() => router.push('/dashboard/staff/inventory/stock-out/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-rose-200">
                <Plus className="h-4 w-4" /> New Stock Out
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Column header */}
            <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '1fr 120px 140px 120px 120px 100px' }}>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Qty Removed</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</span>
            </div>

            {/* Grouped rows */}
            {grouped.map(({ date, items }) => (
              <div key={date}>
                {/* Date header row */}
                <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-100/80 border-y border-slate-200">
                  <CalendarDays className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{formatDate(date)}</span>
                  <span className="ml-auto text-[11px] text-slate-400 font-medium">{items.length} record{items.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Records for this date */}
                <div className="divide-y divide-slate-50">
                  {items.map(record => (
                    <div key={record.id}
                      className="hidden sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                      style={{ gridTemplateColumns: '1fr 120px 140px 120px 120px 100px' }}>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{record.item_name ?? `Item #${record.item}`}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-rose-600">-{Number(record.quantity_removed).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${REASON_COLORS[record.reason] ?? 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                          {REASON_LABELS[record.reason] ?? record.reason}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                        <span className="text-xs text-slate-600 truncate">{record.location_name ?? `Loc #${record.location}`}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                        <span className="text-xs text-slate-600 truncate">{record.staff_recipient ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Tag className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                        <span className="text-xs text-slate-600 truncate">{record.department ?? '—'}</span>
                      </div>
                    </div>
                  ))}
                  {/* Mobile cards */}
                  {items.map(record => (
                    <div key={`m-${record.id}`} className="sm:hidden px-5 py-3.5 space-y-1 border-b border-slate-50">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-slate-800">{record.item_name ?? `Item #${record.item}`}</p>
                        <span className="text-sm font-bold text-rose-600">-{Number(record.quantity_removed).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${REASON_COLORS[record.reason] ?? ''}`}>
                          {REASON_LABELS[record.reason] ?? record.reason}
                        </span>
                        <span className="text-xs text-slate-400">{record.location_name}</span>
                        {record.staff_recipient && <span className="text-xs text-slate-400">• {record.staff_recipient}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> record{total !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchRecords(pendingSearch, selectedReason, page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchRecords(pendingSearch, selectedReason, pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${pg === page ? 'bg-rose-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchRecords(pendingSearch, selectedReason, page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}