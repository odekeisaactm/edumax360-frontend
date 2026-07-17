'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicAPI } from '@/lib/api';
import { Discount } from '@/lib/types';
import {
  Users, Search, X, Check, AlertCircle, Loader2, RefreshCw,
  ChevronLeft, ChevronRight, Plus, ShieldCheck, UserCircle, Tag
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

export default function AllDiscountEnrollmentsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [toasts, setToasts]           = useState<ToastItem[]>([]);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [discountFilter, setDiscountFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // ── Reference Data ──
  const [masterDiscounts, setMasterDiscounts] = useState<Discount[]>([]);
  const [classes, setClasses]                 = useState<any[]>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Load Ref Data ──
  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [dData, cData] = await Promise.all([
          feeAPI.getDiscounts(),
          academicAPI.listClasses()
        ]);
        setMasterDiscounts(dData);
        setClasses(Array.isArray(cData) ? cData : []);
      } catch (err) {
        // silent fail
      }
    };
    loadRefs();
  }, []);

  const buildParams = useCallback((pg: number) => {
    const p: Record<string, any> = { page: pg, page_size: PAGE_SIZE, is_active: true };
    if (pendingSearch)  p.search = pendingSearch;
    if (discountFilter) p.discount = discountFilter;
    if (classFilter)    p.student_class = classFilter;
    return p;
  }, [pendingSearch, discountFilter, classFilter]);

  const fetchEnrollments = useCallback(async (pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const data = await feeAPI.getDiscountEnrollments(buildParams(pg));
      let results = (data as any)?.results ?? (data as any)?.data ?? data ?? [];

      // Local fallback filter if backend 'student_class' filter is missing
      if (classFilter && Array.isArray(results)) {
         results = results.filter((e: any) => {
            const stu = e.student || {};
            const cId = String(stu.current_class || stu.class_id || '');
            return cId === String(classFilter);
         });
      }

      setEnrollments(Array.isArray(results) ? results : []);
      setTotal((data as any)?.count ?? results.length);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [buildParams, classFilter]);

  // ── Auto-Fetch on Filter Change ──
  useEffect(() => {
    fetchEnrollments(1);
  }, [discountFilter, classFilter]); // Auto trigger on dropdown change

  // ── Debounce Search ──
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setPendingSearch(search);
      fetchEnrollments(1);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search]);

  const resetFilters = () => {
    setSearch('');
    setPendingSearch('');
    setDiscountFilter('');
    setClassFilter('');
  };

  const hasFilters = !!(pendingSearch || discountFilter || classFilter);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Active Discounts Ledger</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Directory of all students currently enrolled in discount programs.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {canManage && (
            <button onClick={() => router.push('/dashboard/staff/fee/discount-enrollment')} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm whitespace-nowrap">
              <Plus className="h-4 w-4" /> Manage Student
            </button>
          )}
        </div>
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* ── Inline Filters Toolbar ── */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center gap-3 bg-slate-50/50">

          {/* Search */}
          <div className="relative flex-1 w-full min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or Reg No..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Discount Dropdown */}
          <div className="flex-1 w-full min-w-[180px]">
            <select
              value={discountFilter}
              onChange={e => setDiscountFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-700 bg-white transition-all appearance-none shadow-sm cursor-pointer"
            >
              <option value="">All Discount Programs</option>
              {masterDiscounts.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>

          {/* Class Dropdown */}
          <div className="flex-1 w-full min-w-[150px]">
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-700 bg-white transition-all appearance-none shadow-sm cursor-pointer"
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors whitespace-nowrap"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <button
              onClick={() => fetchEnrollments(page)}
              title="Refresh"
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 bg-white transition-colors shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            <p className="mt-3 text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Enrollments...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-rose-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-rose-600 mb-4">{pageError}</p>
            <button onClick={() => fetchEnrollments(1)} className="text-sm font-bold text-indigo-600 underline inline-flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
            </button>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="p-16 text-center bg-slate-50/30">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <Tag className="h-8 w-8 text-indigo-300" />
            </div>
            <h3 className="font-bold text-slate-700 mb-1 text-lg">
              {hasFilters ? 'No enrollments match your filters' : 'No active discount enrollments'}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              {hasFilters ? 'Try adjusting your search or clearing the filters.' : 'Use the "Manage Student" button to assign the first discount.'}
            </p>
            {hasFilters && (
               <button onClick={resetFilters} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
                  <X className="h-4 w-4" /> Clear all filters
                </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid items-center gap-4 px-6 py-3.5 bg-slate-50 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1fr 140px 180px 100px 80px' }}>
              <span />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Student Profile</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Class</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Discount Program</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Enrolled On</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {enrollments.map(e => {
                const student = e.student || {};
                const fullName = toTitleCase(student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student #${student.id || ''}`);
                const classLabel = [student.current_class_name, student.current_class_section_name].filter(Boolean).join(' ') || 'N/A';

                return (
                  <div key={e.id}
                    className="flex sm:grid items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors group"
                    style={{ gridTemplateColumns: '2.5rem 1fr 140px 180px 100px 80px' }}>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {student.image_url ? (
                        <img src={student.image_url} alt={fullName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-100 shadow-sm"
                          onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-inner">
                          <UserCircle className="h-5 w-5 text-indigo-500" />
                        </div>
                      )}
                    </div>

                    {/* Name & Reg */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-600 transition-colors">{fullName}</p>
                      <span className="text-[11px] font-mono font-semibold text-slate-400 mt-0.5 inline-block">{student.registration_number || 'N/A'}</span>
                    </div>

                    {/* Class */}
                    <div className="hidden sm:block min-w-0">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md truncate inline-block max-w-full">
                        {classLabel}
                      </span>
                    </div>

                    {/* Discount */}
                    <div className="hidden sm:block min-w-0">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-100 truncate max-w-full">
                        <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" /> {e.discount_title || `Discount #${e.discount}`}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="hidden sm:block">
                      <p className="text-xs font-semibold text-slate-500">{new Date(e.created_at || Date.now()).toLocaleDateString('en-GB')}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1 flex-shrink-0">
                      <button onClick={() => router.push(`/dashboard/staff/fee/discount-enrollment?student_id=${student.id}`)}
                        className="px-4 py-2 bg-white border-2 border-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:border-indigo-200 hover:text-indigo-700 shadow-sm transition-all">
                        Manage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs font-semibold text-slate-500">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-bold text-slate-700">{total}</span> record{total !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => fetchEnrollments(page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition-colors bg-transparent">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchEnrollments(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          pg === page ? 'bg-indigo-600 text-white shadow-md' : 'border border-slate-200 text-slate-600 hover:bg-white bg-transparent'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchEnrollments(page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition-colors bg-transparent">
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