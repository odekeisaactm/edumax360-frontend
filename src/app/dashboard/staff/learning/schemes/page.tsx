'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { schemeOfWorkAPI, academicAPI, academicCalendarAPI } from '@/lib/api';
import { SchemeOfWorkList, SchemeOfWorkStatus } from '@/lib/types';
import {
  Plus, Search, Filter, CheckCircle, AlertCircle, ChevronRight,
  Loader2, RefreshCw, BookOpen, Edit3, Trash2, Send, X,
  ShieldCheck, ChevronLeft, RotateCcw
} from 'lucide-react';

const STATUS_CONFIG: Record<SchemeOfWorkStatus, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  submitted: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const PAGE_SIZE = 25;
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

interface FilterState {
  session_id: string; period_id: string; class_level_id: string;
  class_section_id: string; subject_id: string; status: string;
}
const EMPTY_FILTERS: FilterState = {
  session_id: '', period_id: '', class_level_id: '',
  class_section_id: '', subject_id: '', status: ''
};

function StatusBadge({ scheme }: { scheme: SchemeOfWorkList }) {
  const isRevising = scheme.status === 'draft' && !!scheme.declined_at;
  const isResubmission = scheme.status === 'submitted' && !!scheme.declined_at;

  if (isRevising || isResubmission) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
        isRevising ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isRevising ? 'bg-orange-500' : 'bg-blue-500'}`} />
        {isRevising ? 'Revising' : 'Resubmission'}
      </span>
    );
  }

  const cfg = STATUS_CONFIG[scheme.status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
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

export default function SchemeOfWorkListPage() {
  const { hasPermission, user } = useAuth();

  const [schemes, setSchemes] = useState<SchemeOfWorkList[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [pendingSearch, setPendingSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  const [options, setOptions] = useState({
    sessions: [] as any[], periods: [] as any[],
    classLevels: [] as any[], classSections: [] as any[],
    classConfigs: [] as any[], subjects: [] as any[],
  });

  const [reviewingScheme, setReviewingScheme] = useState<SchemeOfWorkList | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const [deletingScheme, setDeletingScheme] = useState<SchemeOfWorkList | null>(null);
  const [reopeningScheme, setReopeningScheme] = useState<SchemeOfWorkList | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('learning_resources.add_schemeofworkmodel');
  const canApprove = user?.is_superuser || hasPermission('learning_resources.approve_scheme_of_work') || hasPermission('learning_resources.decline_scheme_of_work');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [sessions, classLevels, classSections, classConfigs, subjects] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicAPI.listClasses(),
          academicAPI.listClassSections(),
          academicAPI.listClassConfigurations(),
          academicAPI.listSubjects(),
        ]);
        setOptions(prev => ({ ...prev, sessions, classLevels, classSections, classConfigs, subjects }));
      } catch {
        showToast('error', 'Failed to load filter options.');
      }
    };
    fetchOptions();
  }, []);

  const handleSessionChange = async (sessionId: string) => {
    setFilters(prev => ({ ...prev, session_id: sessionId, period_id: '' }));
    if (!sessionId) { setOptions(prev => ({ ...prev, periods: [] })); return; }
    const periods = await academicCalendarAPI.listSessionPeriods({ session_id: Number(sessionId) });
    setOptions(prev => ({ ...prev, periods }));
  };

  const filteredClassSections = filters.class_level_id
    ? options.classSections.filter(s => {
        const configs = options.classConfigs.filter(c => String(c.student_class) === filters.class_level_id);
        return configs.some(c => String(c.class_section) === String(s.id));
      })
    : options.classSections;

  const fetchSchemes = useCallback(async (f: FilterState, pg: number, search: string) => {
    if (isFirstLoad.current) setLoading(true);
    else setRefreshing(true);
    setError(false);

    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (search)       params.search  = search;
      if (f.session_id) params.session = f.session_id;
      if (f.period_id)  params.term    = f.period_id;
      if (f.subject_id) params.subject = f.subject_id;
      if (f.status)     params.status  = f.status;

      if (f.class_level_id && f.class_section_id) {
        const cfg = options.classConfigs.find(c =>
          String(c.student_class) === f.class_level_id &&
          String(c.class_section) === f.class_section_id
        );
        if (cfg) params.class_config = cfg.id;
      }

      const data: any = await schemeOfWorkAPI.list(params);
      const results = data?.results || data || [];
      setSchemes(Array.isArray(results) ? results : []);
      setTotal(data?.count ?? results.length);
      setPage(pg);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFirstLoad.current = false;
    }
  }, [options.classConfigs]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchSchemes(filters, 1, pendingSearch), 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [filters, pendingSearch, fetchSchemes]);

  const resetFilters = () => { setFilters(EMPTY_FILTERS); setPendingSearch(''); };

  const handleSubmit = async (id: number) => {
    try {
      await schemeOfWorkAPI.submit(id);
      showToast('success', 'Scheme submitted for approval.');
      fetchSchemes(filters, page, pendingSearch);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to submit scheme.');
    }
  };

  const handleReview = async (action: 'approve' | 'decline') => {
    if (!reviewingScheme) return;
    if (action === 'decline' && !declineReason.trim()) {
      showToast('error', 'A decline reason is required.'); return;
    }
    setIsActioning(true);
    try {
      await schemeOfWorkAPI.review(reviewingScheme.id, {
        action, decline_reason: action === 'decline' ? declineReason : undefined
      });
      showToast('success', `Scheme ${action === 'approve' ? 'approved' : 'declined'}.`);
      setReviewingScheme(null); setDeclineReason('');
      fetchSchemes(filters, page, pendingSearch);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || `Failed to ${action} scheme.`);
    } finally { setIsActioning(false); }
  };

  const confirmDelete = async () => {
    if (!deletingScheme) return;
    setIsActioning(true);
    try {
      await schemeOfWorkAPI.delete(deletingScheme.id);
      showToast('success', 'Scheme deleted.');
      setDeletingScheme(null);
      fetchSchemes(filters, page, pendingSearch);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to delete scheme.');
    } finally { setIsActioning(false); }
  };

  const confirmReopen = async () => {
    if (!reopeningScheme) return;
    setIsActioning(true);
    try {
      await schemeOfWorkAPI.reopen(reopeningScheme.id);
      showToast('success', 'Scheme reopened for editing.');
      setReopeningScheme(null);
      fetchSchemes(filters, page, pendingSearch);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to reopen scheme.');
    } finally { setIsActioning(false); }
  };

  const setF = (key: keyof FilterState, val: string) => setFilters(prev => ({ ...prev, [key]: val }));
  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasActiveFilters = Object.values(filters).some(v => v !== '') || !!pendingSearch;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Review Modal ── */}
      {reviewingScheme && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">Review Scheme</h3>
                <p className="text-xs text-slate-500 truncate">{reviewingScheme.title}</p>
              </div>
              <button onClick={() => setReviewingScheme(null)} className="ml-auto text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-5 space-y-3">
              <p className="text-sm text-slate-600">Approve to accept, or decline with feedback so the teacher can revise and resubmit.</p>
              <div>
                <label className={labelCls}>Decline Reason (required if declining)</label>
                <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Explain what needs to change..." rows={3}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleReview('decline')} disabled={isActioning || !declineReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-50 text-red-700 font-semibold rounded-xl border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Decline'}
              </button>
              <button onClick={() => handleReview('approve')} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deletingScheme && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">Delete Scheme?</h3>
                <p className="text-xs text-slate-500 truncate">{deletingScheme.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingScheme(null)} disabled={isActioning}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={confirmDelete} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen Modal ── */}
      {reopeningScheme && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="h-5 w-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">
                  {reopeningScheme.status === 'declined' ? 'Reopen for Editing?' : 'Revert to Draft?'}
                </h3>
                <p className="text-xs text-slate-500 truncate">{reopeningScheme.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">This scheme will return to draft and need to be resubmitted for approval.</p>
            <div className="flex gap-3">
              <button onClick={() => setReopeningScheme(null)} disabled={isActioning}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={confirmReopen} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            Schemes of Work
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage termly curriculum outlines</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/staff/learning/schemes/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> New Scheme
          </Link>
        )}
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search schemes by title..." value={pendingSearch} onChange={e => setPendingSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white" />
          {pendingSearch && (
            <button onClick={() => setPendingSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-xl transition-colors ${
              showFilters || hasActiveFilters ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            <Filter className="h-4 w-4" /> Filters
          </button>
          <button onClick={() => fetchSchemes(filters, page, pendingSearch)} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Advanced Filters</h3>
            <button onClick={resetFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Clear all</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Session</label>
              <select value={filters.session_id} onChange={e => handleSessionChange(e.target.value)} className={inputCls}>
                <option value="">All Sessions</option>
                {options.sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Term</label>
              <select value={filters.period_id} onChange={e => setF('period_id', e.target.value)} disabled={!filters.session_id} className={inputCls + (!filters.session_id ? ' opacity-50' : '')}>
                <option value="">All Terms</option>
                {options.periods.map(p => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Class</label>
              <select value={filters.class_level_id} onChange={e => { setF('class_level_id', e.target.value); setF('class_section_id', ''); }} className={inputCls}>
                <option value="">All Classes</option>
                {options.classLevels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Section / Arm</label>
              <select value={filters.class_section_id} onChange={e => setF('class_section_id', e.target.value)} disabled={!filters.class_level_id || filteredClassSections.length === 0} className={inputCls + (!filters.class_level_id ? ' opacity-50' : '')}>
                <option value="">All Sections</option>
                {filteredClassSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Subject</label>
              <select value={filters.subject_id} onChange={e => setF('subject_id', e.target.value)} className={inputCls}>
                <option value="">All Subjects</option>
                {options.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={filters.status} onChange={e => setF('status', e.target.value)} className={inputCls}>
                <option value="">All Statuses</option>
                {(Object.keys(STATUS_CONFIG) as SchemeOfWorkStatus[]).map(k => (
                  <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm text-slate-400">Loading schemes of work...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-sm text-slate-500">Failed to load schemes.</p>
            <button onClick={() => fetchSchemes(filters, page, pendingSearch)} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 mx-auto">
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        </div>
      ) : schemes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
            <BookOpen className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">
            {hasActiveFilters ? 'No schemes match your filters' : 'No schemes of work yet'}
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            {hasActiveFilters ? 'Try adjusting your search or filters.' : 'Create your first scheme of work to plan your term.'}
          </p>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-sm px-4 py-2 bg-slate-50 text-blue-600 rounded-lg font-medium hover:bg-slate-100 transition-colors">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-opacity ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
          <div className="divide-y divide-slate-50 flex-1">
            {schemes.map(scheme => {
              const isAutoApproved = scheme.status === 'approved' && !scheme.approved_by;
              const isManualApproved = scheme.status === 'approved' && !!scheme.approved_by;

              return (
                <div key={scheme.id} className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group">
                  <div className="hidden sm:flex w-10 h-10 rounded-xl bg-blue-50 items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 truncate">{scheme.title}</p>
                      <StatusBadge scheme={scheme} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="font-semibold text-slate-600">{scheme.subject_name}</span>
                      <span>•</span>
                      <span>{scheme.week_count} Weeks planned</span>
                      <span>•</span>
                      <span>Updated {new Date(scheme.updated_at).toLocaleDateString()}</span>
                      {isManualApproved && scheme.approved_by_name && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 font-medium">Approved by {scheme.approved_by_name}</span>
                        </>
                      )}
                      {isAutoApproved && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 font-medium">Auto-approved</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-3 sm:mt-0">
                    {/* Draft — creator edits, deletes, submits */}
                    {scheme.status === 'draft' && canCreate && (
                      <>
                        <Link href={`/dashboard/staff/learning/schemes/${scheme.id}/edit`} title="Edit"
                          className="p-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors">
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        <button onClick={() => setDeletingScheme(scheme)} title="Delete"
                          className="p-2 text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleSubmit(scheme.id)} title="Submit for Approval"
                          className="p-2 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors">
                          <Send className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    {/* Declined — creator reopens */}
                    {scheme.status === 'declined' && canCreate && (
                      <button onClick={() => setReopeningScheme(scheme)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-orange-700 bg-orange-50 border border-orange-100 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                        <RotateCcw className="h-3.5 w-3.5" /> Reopen
                      </button>
                    )}

                    {/* Approved auto — creator edits directly */}
                    {isAutoApproved && canCreate && (
                      <Link href={`/dashboard/staff/learning/schemes/${scheme.id}/edit`} title="Edit"
                        className="p-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors">
                        <Edit3 className="h-4 w-4" />
                      </Link>
                    )}

                    {/* Approved manual — approver reverts */}
                    {isManualApproved && canApprove && (
                      <button onClick={() => setReopeningScheme(scheme)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-orange-700 bg-orange-50 border border-orange-100 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                        <RotateCcw className="h-3.5 w-3.5" /> Revert
                      </button>
                    )}

                    {/* Submitted — approver reviews */}
                    {scheme.status === 'submitted' && canApprove && (
                      <button onClick={() => setReviewingScheme(scheme)}
                        className="px-3 py-1.5 text-blue-600 bg-blue-50 border border-blue-100 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                        Review
                      </button>
                    )}

                    <Link href={`/dashboard/staff/learning/schemes/${scheme.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-all">
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap mt-auto">
            <p className="text-xs text-slate-400">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
              <span className="font-semibold text-slate-600">{total}</span>
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => fetchSchemes(filters, page - 1, pendingSearch)} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pg = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                  return (
                    <button key={pg} onClick={() => fetchSchemes(filters, pg, pendingSearch)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        pg === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => fetchSchemes(filters, page + 1, pendingSearch)} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}