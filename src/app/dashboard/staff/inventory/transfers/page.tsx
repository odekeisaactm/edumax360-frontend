// app/dashboard/staff/inventory/transfers/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { stockTransferAPI } from '@/lib/api';
import { StockTransfer } from '@/lib/types';
import {
  ArrowLeftRight, Plus, Search, X, AlertCircle, Loader2,
  RefreshCw, ChevronLeft, ChevronRight, Eye, MapPin,
  CalendarDays, ReceiptText, Check, ArrowRight,
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

const PAGE_SIZE = 20;

export default function StockTransferListPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingSearch, setPendingSearch] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canManage = user?.is_superuser || hasPermission('inventory.add_stocktransfermodel');

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchTransfers = useCallback(async (search: string, pg = 1) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = { page: pg };
      if (search) params.search = search;

      const data = await stockTransferAPI.list(params);

      let results: StockTransfer[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        results = data;
        totalCount = data.length;
      } else if (data?.results && Array.isArray(data.results)) {
        results = data.results;
        totalCount = data.count || results.length;
      }

      setTransfers(results);
      setTotal(totalCount);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTransfers('', 1); }, []);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchTransfers(pendingSearch, 1);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [pendingSearch]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <ArrowLeftRight className="h-5 w-5 text-white" />
            </div>
            Stock Transfers
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Move stock between locations</p>
        </div>
        {canManage && (
          <button
            onClick={() => router.push('/dashboard/staff/inventory/transfers/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-600 hover:to-purple-700 transition-all shadow-md shadow-violet-200"
          >
            <Plus className="h-4 w-4" /> New Transfer
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Transfers', value: total, color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-100' },
          { label: 'This Page', value: transfers.length, color: 'from-slate-500 to-slate-600', shadow: 'shadow-slate-100' },
          { label: 'Total Items Moved', value: transfers.reduce((s, t) => s + (t.items?.length ?? 0), 0), color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-100' },
        ].map(({ label, value, color, shadow }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${shadow}`}>
              <ArrowLeftRight className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by receipt number..."
                value={pendingSearch}
                onChange={e => setPendingSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
              {pendingSearch && (
                <button onClick={() => setPendingSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => fetchTransfers(pendingSearch, page)}
              title="Refresh"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading transfers...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchTransfers(pendingSearch, 1)}
              className="text-sm text-violet-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight className="h-7 w-7 text-violet-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No transfers found</h3>
            <p className="text-sm text-slate-400 mb-5">
              {pendingSearch ? 'Try adjusting your search.' : 'Record your first stock transfer to get started.'}
            </p>
            {!pendingSearch && canManage && (
              <button
                onClick={() => router.push('/dashboard/staff/inventory/transfers/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-violet-200"
              >
                <Plus className="h-4 w-4" /> New Transfer
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div
              className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1fr 1fr 1fr 100px 56px' }}
            >
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Receipt</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">From → To</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</span>
            </div>

            <div className="divide-y divide-slate-50">
              {transfers.map(transfer => (
                <div
                  key={transfer.id}
                  className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                  style={{ gridTemplateColumns: '2.5rem 1fr 1fr 1fr 100px 56px' }}
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <ReceiptText className="h-4 w-4 text-violet-600" />
                  </div>

                  {/* Receipt */}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm font-mono truncate">{transfer.receipt_number}</p>
                    <p className="text-[11px] text-slate-400">
                      {transfer.items?.length ?? 0} line item{transfer.items?.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* From → To */}
                  <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                    <MapPin className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate">{transfer.from_location_name ?? '—'}</span>
                    <ArrowRight className="h-3 w-3 text-violet-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate">{transfer.to_location_name ?? '—'}</span>
                  </div>

                  {/* Date */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                    <span className="text-xs text-slate-600">
                      {new Date(transfer.transfer_date).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Item count chip */}
                  <div className="hidden sm:block">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border bg-violet-50 text-violet-700 border-violet-100">
                      {transfer.items?.length ?? 0} item{transfer.items?.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => router.push(`/dashboard/staff/inventory/transfers/${transfer.id}`)}
                      title="View"
                      className="p-1.5 rounded-lg text-violet-600 bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-all"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> transfer{total !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchTransfers(pendingSearch, page - 1)}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => fetchTransfers(pendingSearch, pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchTransfers(pendingSearch, page + 1)}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
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