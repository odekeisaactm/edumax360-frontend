'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { salaryStructuresAPI } from '@/lib/salary_management.service';
import { SalaryStructure } from '@/lib/salary_management.types';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Search,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Building2,
  DollarSign,
  Calendar,
  UserCircle,
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
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([, v]) => (Array.isArray(v) ? (v as any[])[0] : String(v)))
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
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

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
function ConfirmModal({
  open,
  structure,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  structure: SalaryStructure | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open || !structure) return null;

  const staffName = (structure as any).staff_detail?.full_name ||
                  (structure as any).staff_name ||
                  `Staff #${structure.staff}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Salary Structure</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete the salary structure for{' '}
          <span className="font-semibold text-slate-700">"{staffName}"</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
            ) : (
              <><Trash2 className="h-4 w-4" /> Delete</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SalaryStructureListPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [deletingStructure, setDeletingStructure] = useState<SalaryStructure | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canCreate = user?.is_superuser || hasPermission('salary_management.add_salaryrecordmodel');
  const canEdit = user?.is_superuser || hasPermission('salary_management.change_salaryrecordmodel');
  const canDelete = user?.is_superuser || hasPermission('salary_management.delete_salaryrecordmodel');
  const canView = user?.is_superuser || hasPermission('salary_management.view_salaryrecordmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const fetchStructures = useCallback(
    async (pg = 1) => {
      setLoading(true);
      setPageError(null);
      try {
        const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
        if (search) params.search = search;
        // The backend view uses `is_active` filter
        if (statusFilter === 'active') params.is_active = true;
        else if (statusFilter === 'inactive') params.is_active = false;

        const data = await salaryStructuresAPI.list(params) as any;

        // Handle paginated response from backend
        const results = data?.results?.data ?? data?.data ?? [];
        setStructures(Array.isArray(results) ? results : []);
        setTotal(data?.count ?? results.length);
        setPage(pg);
      } catch (err) {
        setPageError(extractError(err));
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter]
  );

  // Search debounce
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchStructures(1), 400);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [search, statusFilter]);

  // Initial load
  useEffect(() => {
    if (canView) {
      fetchStructures(1);
    }
  }, [canView]);

  const handleDelete = async () => {
      if (!deletingStructure) return;
      const target = deletingStructure; // capture before any state changes
      setIsDeleting(true);
      try {
        await salaryStructuresAPI.delete(target.id);
        setStructures((prev) => prev.filter((s) => s.id !== target.id));
        setTotal((prev) => prev - 1);
        const staffName =
          (target as any).staff_detail?.full_name ||
          (target as any).staff_name ||
          `Staff #${target.staff}`;
        setDeletingStructure(null);
        showToast('success', `Salary structure for "${staffName}" deleted`);
      } catch (err) {
        showToast('error', extractError(err));
        setDeletingStructure(null);
      } finally {
        setIsDeleting(false);
      }
    };

  const clearFilters = () => {
    setStatusFilter('');
    setSearch('');
  };
  const hasFilters = !!(search || statusFilter);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Stat chips
  const activeCount = structures.filter((s) => s.is_active).length;
  const totalMonthly = structures.reduce((sum, s) => sum + parseFloat(s.monthly_salary), 0);
  const totalAnnual = structures.reduce((sum, s) => sum + parseFloat(s.annual_salary || '0'), 0);

  // ── Permission guard ──
  if (!canView) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to view salary structures.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={!!deletingStructure}
        structure={deletingStructure}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingStructure(null)}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            Salary Structures
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage staff salary structures</p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/dashboard/staff/salary/structure/create')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
          >
            <Plus className="h-4 w-4" /> Add Staff Salary
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Structures', value: total, color: 'from-blue-500 to-blue-600', icon: Users },
          { label: 'Active', value: activeCount, color: 'from-emerald-500 to-teal-600', icon: Check },
          { label: 'Monthly Payroll', value: fmtMoney(totalMonthly), color: 'from-violet-500 to-purple-600', icon: DollarSign },
          { label: 'Annual Payroll', value: fmtMoney(totalAnnual), color: 'from-orange-400 to-amber-500', icon: DollarSign },
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
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by staff name or ID..."
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

          {/* Filter dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors ${
                statusFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'
              }`}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}

            <button
              onClick={() => fetchStructures(page)}
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
            <p className="mt-2 text-sm text-slate-400">Loading salary structures...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchStructures(1)} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : structures.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No structures match your filters' : 'No salary structures yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Add a staff salary structure to get started.'}
            </p>
            {!hasFilters && canCreate && (
              <button
                onClick={() => router.push('/dashboard/staff/salary/structure/create')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
              >
                <Plus className="h-4 w-4" /> Add Staff Salary
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_140px_130px_110px_100px_90px] items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="w-8" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Monthly</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Annual</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Effective</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {structures.map((s) => {
                const staffName = (s as any).staff_detail?.full_name || (s as any).staff_name || `Staff #${s.staff}`;
                const staffId = (s as any).staff_detail?.staff_id || null;
                const deptName = (s as any).staff_detail?.department_name || null;

                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[2rem_1fr_140px_130px_110px_100px_90px] items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="h-4.5 w-4.5 text-indigo-400" />
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{staffName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {staffId && <span className="text-[11px] font-mono text-slate-400">{staffId}</span>}
                        {deptName && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                            <Building2 className="h-2.5 w-2.5" /> {deptName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Monthly Salary */}
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-800">{fmtMoney(s.monthly_salary)}</span>
                    </div>

                    {/* Annual Salary */}
                    <div className="text-right">
                      <span className="text-sm text-slate-600">{fmtMoney(s.annual_salary || Number(s.monthly_salary) * 12)}</span>
                    </div>

                    {/* Effective From */}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                      <span className="text-xs text-slate-500">{new Date(s.effective_from).toLocaleDateString()}</span>
                    </div>

                    {/* Status */}
                    {s.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border bg-slate-100 text-slate-500 border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-slate-400" />
                        Inactive
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/dashboard/staff/salary/structure/${s.id}`)}
                        title="View"
                        className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => router.push(`/dashboard/staff/salary/structure/${s.id}/edit`)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeletingStructure(s)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer + Pagination */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-400">
                Showing {structures.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
                {Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> structures
                {hasFilters && <span className="ml-1 text-blue-500 font-medium">(filtered)</span>}
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchStructures(page - 1)}
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
                        onClick={() => fetchStructures(pg)}
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
                    onClick={() => fetchStructures(page + 1)}
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