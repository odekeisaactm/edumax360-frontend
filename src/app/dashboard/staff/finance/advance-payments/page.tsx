'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { advancePaymentsAPI } from '@/lib/finance.service';
import type { PurchaseAdvancePayment } from '@/lib/finance.types';
import {
  Wallet, Plus, Search, X, AlertCircle, Loader2, RefreshCw,
  ChevronLeft, ChevronRight, Filter, Eye, Printer, ArrowUpRight, ArrowDownRight
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

const PAGE_SIZE = 20;

const DIRECTION_LABELS: Record<string, string> = {
  to_staff: 'Paid to Staff',
  from_staff: 'Refunded by Staff',
};

const DIRECTION_STYLES: Record<string, string> = {
  to_staff: 'bg-red-50 text-red-700 border-red-200',
  from_staff: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  reverted: 'Reverted',
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reverted: 'bg-red-50 text-red-700 border-red-200',
};

export default function AdvancePaymentsPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const [payments, setPayments] = useState<PurchaseAdvancePayment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const canCreate = user?.is_superuser || hasPermission('finance.add_purchaseadvancepaymentmodel');

  const fetchPayments = useCallback(async (pg = 1) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (directionFilter) params.direction = directionFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await advancePaymentsAPI.list(params);
      let results: PurchaseAdvancePayment[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        results = data;
        totalCount = data.length;
      } else if (data?.results) {
        results = data.results;
        totalCount = typeof data.count === 'number' ? data.count : results.length;
      }

      setPayments(results);
      setTotal(totalCount);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [search, directionFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchPayments(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterApply = () => {
    fetchPayments(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNextPage = total > 0 ? page * PAGE_SIZE < total : payments.length >= PAGE_SIZE;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            Advance Payments & Refunds
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Disbursements to staff and refunds received back</p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/dashboard/staff/finance/advance-payments/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-800 shadow-md"
          >
            <Plus className="h-4 w-4" /> Record Payment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search voucher, advance, or staff..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Direction filter */}
        <select
          value={directionFilter}
          onChange={e => setDirectionFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl"
        >
          <option value="">All Directions</option>
          <option value="to_staff">Paid to Staff</option>
          <option value="from_staff">Refunded by Staff</option>
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl"
        >
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="reverted">Reverted</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl"
        />

        <button
          onClick={handleFilterApply}
          className="px-3 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 inline-flex items-center gap-1"
        >
          <Filter className="h-3.5 w-3.5" /> Apply
        </button>
        <button
          onClick={() => fetchPayments(page)}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400">Loading advance payments...</p>
        </div>
      ) : pageError ? (
        <div className="p-10 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-3">{pageError}</p>
          <button onClick={() => fetchPayments(1)} className="text-sm text-indigo-600 underline inline-flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="h-7 w-7 text-indigo-300" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">No advance payments found</h3>
          <p className="text-sm text-slate-400 mb-5">Try adjusting filters or record a new payment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Voucher #</th>
                  <th className="px-4 py-3 text-left">Advance Ref</th>
                  <th className="px-4 py-3 text-left">Staff</th>
                  <th className="px-4 py-3 text-left">Direction</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-indigo-600">{p.voucher_number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.advance_number || '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.staff_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${DIRECTION_STYLES[p.direction] || ''}`}>
                        {DIRECTION_LABELS[p.direction] || p.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      ₦{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 capitalize">{(p.payment_method || '').replace('_', ' ')}</td>
                    <td className="px-4 py-3">{new Date(p.payment_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[p.status] || ''}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/dashboard/staff/finance/advance-payments/${p.id}`)}
                          title="View Details"
                          className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/staff/finance/advance-payments/${p.id}?print=receipt`)}
                          title="Print Receipt"
                          className="p-1.5 rounded-lg text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Pg {page} {total > 0 ? `of ${totalPages} (${total} total)` : ''}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => fetchPayments(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 inline-flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <span className="px-3 py-1.5 text-sm">{page}</span>
              <button
                disabled={!hasNextPage}
                onClick={() => fetchPayments(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 inline-flex items-center gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}