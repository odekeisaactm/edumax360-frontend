'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { staffAPI, departmentsAPI } from '@/lib/api';
import { Staff, Department } from '@/lib/types';
import {
  Users, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw, Eye,
  ChevronLeft, ChevronRight, Building2, Briefcase,
  UserCircle,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

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

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, staff, isDeleting, onConfirm, onCancel }: {
  open: boolean; staff: Staff | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !staff) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Staff</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">
            "{staff.full_name ?? `${staff.first_name} ${staff.last_name}`}"
          </span>?
          This will also remove their login account and cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  active:     { label: 'Active',     dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  inactive:   { label: 'Inactive',   dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-100',   border: 'border-slate-200'   },
  on_leave:   { label: 'On Leave',   dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-100'   },
  suspended:  { label: 'Suspended',  dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-100'  },
  terminated: { label: 'Terminated', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-100'     },
};

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  academic:     { label: 'Academic',     color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  non_academic: { label: 'Non-Academic', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
  both:         { label: 'Both',         color: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-100'   },
};

const PAGE_SIZE = 20;

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StaffListPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [staff, setStaff]             = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [toasts, setToasts]           = useState<ToastItem[]>([]);
  const [deletingStaff, setDeletingStaff] = useState<Staff | null>(null);
  const [isDeleting, setIsDeleting]   = useState(false);

  // Filters — all auto-apply via useEffect debounce
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter]     = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canCreate = user?.is_superuser || hasPermission('human_resource.add_staffmodel');
  const canEdit   = user?.is_superuser || hasPermission('human_resource.change_staffmodel');
  const canDelete = user?.is_superuser || hasPermission('human_resource.delete_staffmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Fetch departments once for the dropdown
  useEffect(() => {
    departmentsAPI.list().then((data: any) => {
      const list = data?.results ?? data?.data ?? data ?? [];
      setDepartments(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  const fetchStaff = useCallback(async (pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (search)       params.search     = search;
      if (statusFilter) params.status     = statusFilter;
      if (deptFilter)   params.department = deptFilter;
      if (typeFilter)   params.staff_type = typeFilter;

      const data = await staffAPI.list(params);
      const results = data?.results ?? data?.data ?? data ?? [];
      setStaff(Array.isArray(results) ? results : []);
      setTotal(data?.count ?? results.length);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [search, statusFilter, deptFilter, typeFilter]);

  // Dropdowns apply immediately; search debounces 400ms
  useEffect(() => { fetchStaff(1); }, [statusFilter, deptFilter, typeFilter]);
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchStaff(1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search]);

  const handleDelete = async () => {
    if (!deletingStaff) return;
    setIsDeleting(true);
    try {
      await staffAPI.delete(deletingStaff.id);
      setStaff(prev => prev.filter(s => s.id !== deletingStaff.id));
      setTotal(prev => prev - 1);
      showToast('success', `"${deletingStaff.full_name ?? deletingStaff.first_name}" deleted`);
      setDeletingStaff(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingStaff(null);
    } finally { setIsDeleting(false); }
  };

  const clearFilters = () => { setStatusFilter(''); setDeptFilter(''); setTypeFilter(''); setSearch(''); };
  const hasFilters   = !!(search || statusFilter || deptFilter || typeFilter);
  const totalPages   = Math.ceil(total / PAGE_SIZE);

  // Derived stat chips — from current full list for display (or use backend totals if available)
  const activeCount   = staff.filter(s => s.status === 'active').length;
  const onLeaveCount  = staff.filter(s => s.status === 'on_leave').length;
  const inactiveCount = staff.filter(s => ['inactive', 'suspended', 'terminated'].includes(s.status ?? '')).length;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={!!deletingStaff} staff={deletingStaff} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingStaff(null)}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Users className="h-5 w-5 text-white" />
            </div>
            Staff
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage all staff members</p>
        </div>
        {canCreate && (
          <button onClick={() => router.push('/dashboard/staff/staff/create')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Staff
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Staff',  value: total,        color: 'from-blue-500 to-blue-600',     icon: Users },
          { label: 'Active',       value: activeCount,  color: 'from-emerald-500 to-teal-600',  icon: Users },
          { label: 'On Leave',     value: onLeaveCount, color: 'from-amber-400 to-orange-500',  icon: Users },
          { label: 'Inactive',     value: inactiveCount,color: 'from-slate-400 to-slate-500',   icon: Users },
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
              placeholder="Search by name, email, staff ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter dropdowns — auto-apply on change, no button */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors ${statusFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'}`}>
              <option value="">All Status</option>
              {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>

            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors ${deptFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'}`}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors ${typeFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600'}`}>
              <option value="">All Types</option>
              {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>

            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}

            <button onClick={() => fetchStaff(page)} title="Refresh"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body States ── */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading staff...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchStaff(1)} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No staff match your filters' : 'No staff yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Add your first staff member to get started.'}
            </p>
            {!hasFilters && canCreate && (
              <button onClick={() => router.push('/dashboard/staff/staff/create')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Staff
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_140px_110px_100px_90px] items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="w-8" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff Member</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {staff.map(s => {
                const status   = STATUS_META[s.status ?? ''] ?? STATUS_META.inactive;
                const type     = TYPE_META[s.staff_type ?? ''];
                const deptName = (s as any).department_name ?? departments.find(d => d.id === s.department)?.name ?? '—';
                const posName  = (s as any).position_name ?? null;
                const fullName = s.full_name ?? (`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Staff #${s.id}`);
                 return (
                  <div key={s.id}
                    className="grid grid-cols-[2rem_1fr_140px_110px_100px_90px] items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">

                    {/* Avatar */}
                    {s.image ? (
                      <img src={s.image} alt={fullName}
                        className="w-8 h-8 rounded-xl object-cover border border-slate-100 flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                        <UserCircle className="h-4.5 w-4.5 text-indigo-400" />
                      </div>
                    )}

                    {/* Name + meta */}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] font-mono text-slate-400">{s.staff_id}</span>
                        {posName && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                            <Briefcase className="h-2.5 w-2.5" /> {posName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Department */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                      <span className="text-xs text-slate-500 truncate max-w-[110px]">{deptName}</span>
                    </div>

                    {/* Type */}
                    <div className="min-w-0">
                      {type ? (
                        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${type.bg} ${type.color} ${type.border}`}>
                          {type.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>

                    {/* Status */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                      {status.label}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => router.push(`/dashboard/staff/staff/${s.id}`)} title="View"
                        className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canEdit && (
                        <button onClick={() => router.push(`/dashboard/staff/staff/${s.id}/edit`)} title="Edit"
                          className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingStaff(s)} title="Delete"
                          className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
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
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> staff
                {hasFilters && <span className="ml-1 text-blue-500 font-medium">(filtered)</span>}
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchStaff(page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchStaff(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchStaff(page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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