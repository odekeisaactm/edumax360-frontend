'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { salaryStructuresAPI, payrollAPI } from '@/lib/salary_management.service';
import { SalaryStructure, SalaryRecord } from '@/lib/salary_management.types';
import {
  FileText,
  Plus,
  Eye,
  Edit3,
  Play,
  Search,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Building2,
  DollarSign,
  Calendar,
  UserCircle,
  Filter,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem {
  id: number;
  type: 'success' | 'error';
  message: string;
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.details && typeof d.details === 'object') {
      const msgs = Object.entries(d.details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? (v as any[])[0] : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${
            t.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {t.type === 'success' ? (
            <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
          )}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'not_processed', label: 'Not Processed' },
  { value: 'processed', label: 'Processed' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'not_paid', label: 'Not Paid' },
];

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PayslipListPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState<number>(currentMonth);
  const [year, setYear] = useState<number>(currentYear);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data ──
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [recordsMap, setRecordsMap] = useState<Record<number, SalaryRecord>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView = user?.is_superuser || hasPermission('salary_management.view_salaryrecordmodel');
  const canManage = user?.is_superuser || hasPermission('salary_management.add_salaryrecordmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Fetch data ──
  const fetchData = useCallback(
    async (pg = 1) => {
      setLoading(true);
      setPageError(null);
      try {
        // 1. Fetch salary records for the selected month/year (all pages)
        const recordsResponse = await payrollAPI.listRecords({
          month,
          year,
          page_size: 1000, // fetch all at once; adjust if many staff
        }) as any;
        const records = recordsResponse?.results ?? recordsResponse?.data ?? recordsResponse ?? [];
        const recordsArray = Array.isArray(records) ? records : [];
        const map: Record<number, SalaryRecord> = {};
        recordsArray.forEach((rec: SalaryRecord) => {
          const staffId = typeof rec.staff === 'object' ? (rec.staff as any).id : rec.staff;
          map[staffId] = rec;
        });
        setRecordsMap(map);

        // 2. Fetch active salary structures with filters
        const params: Record<string, any> = {
          page: pg,
          page_size: PAGE_SIZE,
          is_active: true,
        };
        if (search) params.search = search;

        const structuresResponse = await salaryStructuresAPI.list(params) as any;
        const structuresData = structuresResponse?.results?.data ?? structuresResponse?.data ?? [];
        setStructures(Array.isArray(structuresData) ? structuresData : []);
        setTotal(structuresResponse?.count ?? structuresData.length);
        setPage(pg);
      } catch (err) {
        setPageError(extractError(err));
      } finally {
        setLoading(false);
      }
    },
    [month, year, search]
  );

  // ── Apply filters ──
  useEffect(() => {
    if (canView) fetchData(1);
  }, [month, year, fetchData, canView]);

  // ── Search debounce ──
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      if (canView) fetchData(1);
    }, 400);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [search]);

  // ── Combined data with record status ──
  const combined = React.useMemo(() => {
    return structures.map((structure) => {
      const staffId = typeof structure.staff === 'object' ? (structure.staff as any).id : structure.staff;
      const record = recordsMap[staffId] || null;
      let status: string = 'not_processed';
      if (record) {
        status = record.payment_status || 'processed';
      }
      return { ...structure, record, status };
    });
  }, [structures, recordsMap]);

  // ── Filter by status ──
  const filtered = React.useMemo(() => {
    if (statusFilter === 'all') return combined;
    return combined.filter((item) => {
      if (statusFilter === 'not_processed') return item.status === 'not_processed';
      if (statusFilter === 'processed') return item.status !== 'not_processed';
      if (statusFilter === 'not_paid') {
        return item.status !== 'not_processed' && item.status !== 'paid' && item.status !== 'partially_paid';
      }
      return item.status === statusFilter;
    });
  }, [combined, statusFilter]);

  // ── Stats ──
  const totalStructures = total;
  const processedCount = combined.filter((c) => c.status !== 'not_processed').length;
  const paidCount = combined.filter((c) => c.status === 'paid').length;
  const pendingCount = combined.filter((c) => c.status === 'pending').length;
  const notProcessedCount = combined.filter((c) => c.status === 'not_processed').length;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Navigation helpers ──
  const goToProcess = (structureId: number) => {
    router.push(
      `/dashboard/staff/salary/payroll/process?structureId=${structureId}&month=${month}&year=${year}`
    );
  };

  const goToBulkProcess = () => {
      router.push(`/dashboard/staff/salary/bulk-payslips?month=${month}&year=${year}`);
    };

  const goToView = (recordId: number) => {
    router.push(`/dashboard/staff/salary/payslips/${recordId}`);
  };

  // ── Permission guard ──
  if (!canView) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to view payslips.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <FileText className="h-5 w-5 text-white" />
            </div>
            Payslips
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage staff payslips and payroll processing</p>
        </div>
        {canManage && (
          <button
            onClick={goToBulkProcess}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
          >
            <Plus className="h-4 w-4" /> Bulk Process Payroll
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Staff', value: totalStructures, color: 'from-blue-500 to-blue-600', icon: FileText },
          { label: 'Not Processed', value: notProcessedCount, color: 'from-slate-400 to-slate-500', icon: AlertCircle },
          { label: 'Processed', value: processedCount, color: 'from-cyan-500 to-cyan-600', icon: Check },
          { label: 'Pending', value: pendingCount, color: 'from-amber-400 to-orange-500', icon: AlertTriangle },
          { label: 'Paid', value: paidCount, color: 'from-emerald-500 to-teal-600', icon: Check },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
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
        {/* ── Toolbar ── */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by staff name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600"
            >
              {MONTHS.filter(m => year < currentYear || m.value <= currentMonth).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
            </select>

            <select
              value={year}
              onChange={(e) => {
                  const y = parseInt(e.target.value);
                  setYear(y);
                  if (y === currentYear && month > currentMonth) setMonth(currentMonth);
                }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600"
            >
              {Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {(statusFilter !== 'all' || search) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSearch('');
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}

            <button
              onClick={() => fetchData(page)}
              title="Refresh"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body States ── */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading payslips...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchData(1)} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {search || statusFilter !== 'all' ? 'No payslips match your filters' : 'No payslips yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Process payroll to generate payslips for staff.'}
            </p>
            {canManage && !search && statusFilter === 'all' && (
              <button
                onClick={goToBulkProcess}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
              >
                <Play className="h-4 w-4" /> Bulk Process Payroll
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_140px_120px_120px_150px] items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="w-8" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Monthly Salary</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map((item) => {
                const staff = item.staff_detail as any;
                const staffId = staff?.id || item.staff;
                const staffName = staff?.full_name || staff?.first_name || `Staff #${staffId}`;
                const staffIdNumber = staff?.staff_id || '';
                const deptName = staff?.department_name || staff?.department?.name || 'N/A';
                const record = item.record;
                const status = item.status;
                const recordId = record?.id;

                let statusBadge;
                if (status === 'not_processed') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-slate-100 text-slate-500 border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Not Processed
                    </span>
                  );
                } else if (status === 'paid') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Paid
                    </span>
                  );
                } else if (status === 'partially_paid') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Partially Paid
                    </span>
                  );
                } else if (status === 'pending') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Pending
                    </span>
                  );
                } else {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-cyan-50 text-cyan-700 border-cyan-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                      Processed
                    </span>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[2rem_1fr_140px_120px_120px_150px] items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="h-4.5 w-4.5 text-indigo-400" />
                    </div>

                    {/* Name + ID */}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{staffName}</p>
                      <p className="text-[11px] font-mono text-slate-400">{staffIdNumber}</p>
                    </div>

                    {/* Department */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                      <span className="text-xs text-slate-500 truncate max-w-[110px]">{deptName}</span>
                    </div>

                    {/* Monthly Salary */}
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-800">{fmtMoney(item.monthly_salary)}</span>
                    </div>

                    {/* Status */}
                    <div>{statusBadge}</div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {status !== 'not_processed' && recordId ? (
                        <>
                          <button
                            onClick={() => goToView(recordId)}
                            title="View Payslip"
                            className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canManage && status !== 'paid' && status !== 'partially_paid' && (
                            <button
                              onClick={() => goToProcess(item.id)}
                              title="Edit/Reprocess"
                              className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {canManage && (
                            <button
                              onClick={() => goToProcess(item.id)}
                              className="p-1.5 rounded-lg text-green-600 bg-green-50 border border-green-100 hover:bg-green-100 transition-all flex items-center gap-1"
                            >
                              <Play className="h-3.5 w-3.5" />
                              <span className="text-[11px] font-medium">Process</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer + Pagination */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-400">
                Showing {filtered.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
                {Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> staff
                {search && <span className="ml-1 text-blue-500 font-medium">(filtered)</span>}
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchData(page - 1)}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg =
                      totalPages <= 5
                        ? i + 1
                        : page <= 3
                        ? i + 1
                        : page >= totalPages - 2
                        ? totalPages - 4 + i
                        : page - 2 + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => fetchData(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchData(page + 1)}
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