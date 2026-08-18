'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  Wallet, Plus, Search, X, AlertCircle, Loader2,
  RefreshCw, ChevronLeft, ChevronRight, Eye, User,
  CalendarDays, Check, Filter, Banknote
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
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  disbursed: 'Disbursed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-sky-50 text-sky-700 border-sky-200',
  disbursed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

interface PurchaseAdvance {
  id: number;
  advance_number: string;
  staff_name: string;
  status: string;
  purpose: string;
  requested_amount: string | number;
  request_date: string;
}

export default function PurchaseAdvanceListPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [advances, setAdvances] = useState<PurchaseAdvance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Filters
  const [pendingSearch, setPendingSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Permission check based on views.py & permissions.py
  const canManage = user?.is_superuser || hasPermission('inventory.add_inventorypurchaseordermodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchAdvances = useCallback(async (search: string, statusFilter: string, pg = 1) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/api/inventory/advances/', { params });
      const data = res.data;

      let results: PurchaseAdvance[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        results = data;
        totalCount = data.length;
      } else if (data?.results?.data) {
        results = data.results.data;
        totalCount = data.count || results.length;
      } else if (data?.results) {
        results = data.results;
        totalCount = data.count || results.length;
      }

      setAdvances(results);
      setTotal(totalCount);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchAdvances('', '', 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search and status filters
  useEffect(() => {
    if (loading && page === 1 && !pendingSearch && !selectedStatus) return;

    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchAdvances(pendingSearch, selectedStatus, 1);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSearch, selectedStatus]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            Purchase Advances
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage staff market requests and disbursements</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canManage && (
            <button
              onClick={() => router.push('/dashboard/staff/inventory/advances/new')}
              className="inline-flex flex-1 sm:flex-none justify-center items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-800 transition-all shadow-md shadow-indigo-200"
            >
              <Plus className="h-4 w-4" /> New Advance
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Advances', value: total, color: 'from-indigo-600 to-purple-700', shadow: 'shadow-indigo-100', icon: <Wallet className="h-4 w-4 text-white" /> },
          { label: 'Pending Requests', value: advances.filter(a => a.status === 'pending').length, color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-100', icon: <AlertCircle className="h-4 w-4 text-white" /> },
          { label: 'Disbursed (Active)', value: advances.filter(a => a.status === 'disbursed').length, color: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-100', icon: <Banknote className="h-4 w-4 text-white" /> },
          { label: 'Page Total Req.', value: `₦${advances.reduce((sum, a) => sum + Number(a.requested_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-100', icon: <Banknote className="h-4 w-4 text-white" /> },
        ].map(({ label, value, color, shadow, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${shadow}`}>
              {icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800 truncate">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">

            {/* Global Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by advance number or staff name..."
                value={pendingSearch}
                onChange={e => setPendingSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
              {pendingSearch && (
                <button onClick={() => setPendingSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative w-full sm:w-auto">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full sm:w-auto pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={() => fetchAdvances(pendingSearch, selectedStatus, page)}
              title="Refresh"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors hidden sm:block flex-shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading purchase advances...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchAdvances(pendingSearch, selectedStatus, 1)}
              className="text-sm text-indigo-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : advances.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-7 w-7 text-indigo-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No purchase advances found</h3>
            <p className="text-sm text-slate-400 mb-5">
              {pendingSearch || selectedStatus ? 'Try adjusting your filters.' : 'Create your first purchase advance to request funds.'}
            </p>
            {!pendingSearch && !selectedStatus && canManage && (
              <button
                onClick={() => router.push('/dashboard/staff/inventory/advances/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200"
              >
                <Plus className="h-4 w-4" /> New Advance
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div
              className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1.2fr 1.2fr 1fr 120px 100px 56px' }}
            >
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Advance Ref</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Req. Amount</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Action</span>
            </div>

            <div className="divide-y divide-slate-50">
              {advances.map(advance => (
                <div
                  key={advance.id}
                  className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                  style={{ gridTemplateColumns: '2.5rem 1.2fr 1.2fr 1fr 120px 100px 56px' }}
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Wallet className="h-4 w-4 text-indigo-600" />
                  </div>

                  {/* Advance Number & Purpose */}
                  <div className="min-w-0 flex-1 sm:flex-none">
                    <p className="font-semibold text-slate-900 text-sm font-mono truncate">{advance.advance_number}</p>
                    <p className="text-[11px] text-slate-400 truncate max-w-[150px]" title={advance.purpose}>
                      {advance.purpose || 'No purpose specified'}
                    </p>
                  </div>

                  {/* Staff Name */}
                  <div className="hidden sm:flex items-center gap-2 min-w-0">
                    <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate">{advance.staff_name || '—'}</span>
                  </div>

                  {/* Date */}
                  <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate">
                      {new Date(advance.request_date).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="hidden sm:block text-right">
                    <span className="text-sm font-bold text-slate-800">
                      ₦{Number(advance.requested_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="hidden sm:flex justify-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${STATUS_STYLES[advance.status] || STATUS_STYLES.pending}`}>
                      {STATUS_LABELS[advance.status] || advance.status}
                    </span>
                  </div>

                  {/* Mobile Only Meta View */}
                  <div className="sm:hidden flex flex-col items-end gap-1 min-w-0 shrink-0 ml-auto">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${STATUS_STYLES[advance.status] || STATUS_STYLES.pending}`}>
                      {STATUS_LABELS[advance.status] || advance.status}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      ₦{Number(advance.requested_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-end shrink-0 ml-3 sm:ml-0">
                    <button
                      onClick={() => router.push(`/dashboard/staff/inventory/advances/${advance.id}`)}
                      title="View"
                      className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all"
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
                <span className="font-semibold text-slate-600">{total}</span> advance{total !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchAdvances(pendingSearch, selectedStatus, page - 1)}
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
                        onClick={() => fetchAdvances(pendingSearch, selectedStatus, pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchAdvances(pendingSearch, selectedStatus, page + 1)}
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