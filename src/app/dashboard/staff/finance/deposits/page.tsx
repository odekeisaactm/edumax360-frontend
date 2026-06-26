'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import {
  studentFundingAPI,
  staffFundingAPI,
  academicCalendarAPI,
  academicAPI,
} from '@/lib/api';
import { StudentFunding, StaffFunding } from '@/lib/types';
import {
  Users,
  Search,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpCircle,
  Wallet,
  CreditCard,
} from 'lucide-react';
import type { ExportRow } from './DepositsExporter';

// ─── Load exporter with ssr:false so jspdf/xlsx never touch the SSR bundler ────
const DepositsExporter = dynamic(() => import('./DepositsExporter'), { ssr: false });

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const PAGE_SIZE = 20;

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    pending: {
      label: 'Pending',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: <Clock className="h-3 w-3" />,
    },
    confirmed: {
      label: 'Confirmed',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: <CheckCircle className="h-3 w-3" />,
    },
    declined: {
      label: 'Declined',
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: <XCircle className="h-3 w-3" />,
    },
    reverted: {
      label: 'Reverted',
      color: 'text-slate-600',
      bg: 'bg-slate-100',
      border: 'border-slate-200',
      icon: <ArrowUpCircle className="h-3 w-3" />,
    },
    failed: {
      label: 'Failed',
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: <XCircle className="h-3 w-3" />,
    },
  };
  const meta = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.bg} ${meta.color} ${meta.border}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DepositsIndexPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user, schoolInfo } = useAuth();

  const initialFilter = searchParams.get('filter') === 'staff' ? 'staff' : 'student';

  const canViewStudent = user?.is_superuser || hasPermission('finance.view_studentfundingmodel');
  const canViewStaff   = user?.is_superuser || hasPermission('finance.view_stafffundingmodel');

  // ── State ──
  const [viewType, setViewType]           = useState<'student' | 'staff'>(initialFilter);
  const [statusFilter, setStatusFilter]   = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [sessionId, setSessionId]         = useState('');
  const [periodId, setPeriodId]           = useState('');
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');
  const [walletTypeFilter, setWalletTypeFilter] = useState('');

  const [data, setData]           = useState<(StudentFunding | StaffFunding)[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [sessions, setSessions]               = useState<any[]>([]);
  const [periods, setPeriods]                 = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingPeriods, setLoadingPeriods]   = useState(true);

  // ─── Fetch reference data ──
  useEffect(() => {
    academicCalendarAPI.listSessions()
      .then((res: any) => setSessions(Array.isArray(res) ? res : res?.results ?? res?.data ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));

    academicCalendarAPI.listPeriods()
      .then((res: any) => setPeriods(Array.isArray(res) ? res : res?.results ?? res?.data ?? []))
      .catch(() => setPeriods([]))
      .finally(() => setLoadingPeriods(false));
  }, []);

  // ─── Build params ──
  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (statusFilter)                         params.status              = statusFilter;
    if (searchQuery.trim())                   params.search              = searchQuery.trim();
    if (sessionId)                            params.session_id          = sessionId;
    if (periodId)                             params.academic_period_id  = periodId;
    if (startDate)                            params.start_date          = startDate;
    if (endDate)                              params.end_date            = endDate;
    if (viewType === 'student' && walletTypeFilter) params.wallet_type   = walletTypeFilter;
    return params;
  }, [page, statusFilter, searchQuery, sessionId, periodId, startDate, endDate, walletTypeFilter, viewType]);

  // ─── Fetch list ──
  const fetchData = useCallback(async () => {
    if (!canViewStudent && !canViewStaff) return;
    setLoading(true);
    setPageError(null);
    try {
      const api = viewType === 'student' ? studentFundingAPI : staffFundingAPI;
      const response = await api.list(buildParams());
      const results = (response as any)?.results ?? (response as any)?.data ?? [];
      setData(Array.isArray(results) ? results : []);
      setTotal((response as any)?.count ?? results.length);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [viewType, buildParams, canViewStudent, canViewStaff]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page when any filter changes
  useEffect(() => { setPage(1); },
    [statusFilter, searchQuery, sessionId, periodId, startDate, endDate, walletTypeFilter, viewType]
  );

  const clearFilters = () => {
    setStatusFilter('');
    setSearchQuery('');
    setSessionId('');
    setPeriodId('');
    setStartDate('');
    setEndDate('');
    setWalletTypeFilter('');
  };

  const hasFilters = !!(statusFilter || searchQuery || sessionId || periodId || startDate || endDate || walletTypeFilter);

  // ─── Build filter summary string for PDF header ──
  const buildFilterSummary = (): string => {
    const parts: string[] = [];
    if (statusFilter) parts.push(`Status: ${statusFilter}`);
    const session = sessions.find((s) => String(s.id) === sessionId);
    if (session) parts.push(`Session: ${session.start_year}–${session.end_year}`);
    const period = periods.find((p) => String(p.id) === periodId);
    if (period) parts.push(`Period: ${period.name || period.short_name}`);
    if (startDate || endDate) parts.push(`Date: ${startDate || '...'} – ${endDate || '...'}`);
    if (viewType === 'student' && walletTypeFilter) parts.push(`Wallet: ${walletTypeFilter}`);
    return parts.join('  |  ');
  };

  // ─── Build export rows (called from DepositsExporter on demand) ──
  const getExportRows = useCallback(async (): Promise<ExportRow[]> => {
    const api = viewType === 'student' ? studentFundingAPI : staffFundingAPI;
    const params: any = { ...buildParams(), page_size: 2000 };
  delete params.page;
    const response = await api.list(params);
    const results: (StudentFunding | StaffFunding)[] =
      (response as any)?.results ?? (response as any)?.data ?? [];

    return results.map((item) => {
      const isStudent = viewType === 'student';
      const person    = isStudent ? (item as StudentFunding).student : (item as StaffFunding).staff;
      const personName = toTitleCase(
        (person as any)?.full_name ||
        `${(person as any)?.first_name || ''} ${(person as any)?.last_name || ''}`.trim()
      );
      return {
        id:           item.id,
        personName,
        personId:     isStudent
          ? ((person as any)?.registration_number || '—')
          : ((person as any)?.staff_id || '—'),
        walletType:   (item as StudentFunding)?.wallet_type,
        amount:       item.amount,
        method:       item.method,
        status:       item.status,
        created:      formatDate(item.created_at),
        reference:    item.reference ?? undefined,
         tellerNumber: item.teller_number ?? undefined,
      };
    });
  }, [viewType, buildParams]);

  // ─── Permission guard ──
  if (!canViewStudent && !canViewStaff) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to view deposits.</p>
        </div>
      </div>
    );
  }

  if (loading && page === 1 && data.length === 0) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm text-slate-400">Loading deposits…</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 pb-10">

      {/* ─── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            Deposits
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">View and manage wallet deposits</p>
        </div>

        {/* Export button lives inside DepositsExporter — loaded client-only */}
        <DepositsExporter
          viewType={viewType}
          schoolName={schoolInfo?.name}
          filterSummary={buildFilterSummary()}
          getExportRows={getExportRows}
        />
      </div>

      {/* ─── Student / Staff Toggle ── */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {(['student', 'staff'] as const).map((type) => (
          <button
            key={type}
            onClick={() => { setViewType(type); setPage(1); }}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              viewType === type
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="h-4 w-4 inline mr-1.5" />
            {type === 'student' ? 'Student' : 'Staff'} Deposits
          </button>
        ))}
      </div>

      {/* ─── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or reference…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
          >
            <option value="">All Statuses</option>
            {['pending','confirmed','declined','reverted','failed'].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          {/* Session */}
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            disabled={loadingSessions}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
          >
            <option value="">All Sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.start_year}–{s.end_year}</option>
            ))}
          </select>

          {/* Period */}
          <select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            disabled={loadingPeriods}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
          >
            <option value="">All Periods</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.short_name || `Period ${p.id}`}</option>
            ))}
          </select>

          {/* Wallet Type — student only */}
          {viewType === 'student' && (
            <select
              value={walletTypeFilter}
              onChange={(e) => setWalletTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="">All Wallets</option>
              <option value="canteen">Canteen</option>
              <option value="fee">Fee</option>
            </select>
          )}

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            />
          </div>
        </div>

        {/* Filter actions row */}
        <div className="flex flex-wrap items-center gap-3">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <span className="text-xs text-slate-400 ml-auto">
            {loading
              ? 'Loading…'
              : `Showing ${data.length} of ${total} records`}
          </span>
        </div>
      </div>

      {/* ─── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button
              onClick={fetchData}
              className="text-sm text-emerald-600 underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-7 w-7 text-emerald-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No deposits match your filters' : 'No deposits yet'}
            </h3>
            <p className="text-sm text-slate-400">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Deposits will appear here once created.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100">
                    {['ID', viewType === 'student' ? 'Student' : 'Staff'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                    {viewType === 'student' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Wallet</th>
                    )}
                    {['Amount', 'Method', 'Status', 'Created', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.map((item) => {
                    const isStudent  = viewType === 'student';
                    const person     = isStudent ? (item as StudentFunding).student : (item as StaffFunding).staff;
                    const personName = toTitleCase(
                      (person as any)?.full_name ||
                      `${(person as any)?.student_name || ''} ${(person as any)?.last_name || ''}`.trim()
                    );
                    const personId   = isStudent
                      ? (person as any)?.registration_number
                      : (person as any)?.staff_id;
                    const walletType = (item as StudentFunding)?.wallet_type || '';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.id}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{personName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{personId || '—'}</p>
                        </td>
                        {viewType === 'student' && (
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              walletType === 'canteen'
                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                : 'bg-purple-50 text-purple-700 border-purple-100'
                            }`}>
                              {walletType === 'canteen'
                                ? <Wallet className="h-3 w-3" />
                                : <CreditCard className="h-3 w-3" />}
                              {walletType || '—'}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 font-bold text-slate-800">{fmtMoney(item.amount)}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{item.method}</td>
                        <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(item.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => router.push(
                              viewType === 'student'
                                ? `/dashboard/staff/finance/student-funding/${item.id}`
                                : `/dashboard/staff/finance/staff-funding/${item.id}`
                            )}
                            className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all"
                            title="View detail"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> record{total !== 1 ? 's' : ''}
                {hasFilters && <span className="ml-1 text-emerald-500 font-medium">(filtered)</span>}
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pg = i + 1;
                    if (totalPages > 5) {
                      if (page <= 3)               pg = i + 1;
                      else if (page >= totalPages - 2) pg = totalPages - 4 + i;
                      else                          pg = page - 2 + i;
                    }
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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