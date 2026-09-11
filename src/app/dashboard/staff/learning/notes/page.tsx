'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { lessonNotesAPI, academicAPI } from '@/lib/api';
import { LessonNoteList, LessonNoteStatus } from '@/lib/types';
import {
  Plus, Search, Filter, CheckCircle, AlertCircle, ChevronRight,
  Loader2, RefreshCw, FileText, Edit3, Trash2, Send, X,
  ShieldCheck, ChevronLeft, RotateCcw, Sparkles, Upload, PenLine,
  Clock, Eye,
} from 'lucide-react';

const STATUS_CONFIG: Record<LessonNoteStatus, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  pending_approval: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
};

const PAGE_SIZE = 25;
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

interface FilterState {
  subject_id: string;
  class_level_id: string;
  class_section_id: string;
  status: string;
}
const EMPTY_FILTERS: FilterState = {
  subject_id: '', class_level_id: '', class_section_id: '', status: '',
};

function StatusBadge({ note }: { note: LessonNoteList }) {
  const isRevising = note.status === 'draft' && !!note.declined_at;
  const isResubmission = note.status === 'pending_approval' && !!note.declined_at;

  if (isRevising || isResubmission) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
        isRevising ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isRevising ? 'bg-orange-500' : 'bg-blue-500'}`} />
        {isRevising ? 'Revising' : 'Resubmission'}
      </span>
    );
  }

  const cfg = STATUS_CONFIG[note.status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function CreationMethodBadge({ method }: { method: string }) {
  if (method === 'ai_generated') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-100">
        <Sparkles className="h-2.5 w-2.5" /> AI
      </span>
    );
  }
  if (method === 'uploaded') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
        <Upload className="h-2.5 w-2.5" /> Uploaded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
      <PenLine className="h-2.5 w-2.5" /> Manual
    </span>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            : <AlertCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${t.type === 'warn' ? 'text-amber-500' : 'text-red-500'}`} />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LessonNotesListPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [notes, setNotes] = useState<LessonNoteList[]>([]);
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
    subjects: [] as any[],
    classLevels: [] as any[],
    classSections: [] as any[],
    classConfigs: [] as any[],
  });

  const [reviewingNote, setReviewingNote] = useState<LessonNoteList | null>(null);
  const [reviewDetail, setReviewDetail] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const [deletingNote, setDeletingNote] = useState<LessonNoteList | null>(null);
  const [reopeningNote, setReopeningNote] = useState<LessonNoteList | null>(null);
  const [isActioning, setIsActioning] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('learning_resources.add_lessonnotemodel');
  const canApprove = user?.is_superuser || hasPermission('learning_resources.approve_lesson_note') || hasPermission('learning_resources.decline_lesson_note');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [subjects, classLevels, classSections, classConfigs] = await Promise.all([
          academicAPI.listSubjects(),
          academicAPI.listClasses(),
          academicAPI.listClassSections(),
          academicAPI.listClassConfigurations(),
        ]);
        setOptions({ subjects, classLevels, classSections, classConfigs });
      } catch {
        showToast('error', 'Failed to load filter options.');
      }
    };
    fetchOptions();
  }, []);

  const filteredClassSections = filters.class_level_id
    ? options.classSections.filter(s => {
        const configs = options.classConfigs.filter(c => String(c.student_class) === filters.class_level_id);
        return configs.some(c => String(c.class_section) === String(s.id));
      })
    : options.classSections;

  const fetchNotes = useCallback(async (f: FilterState, pg: number, search: string) => {
    if (isFirstLoad.current) setLoading(true);
    else setRefreshing(true);
    setError(false);

    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (search)       params.search  = search;
      if (f.subject_id) params.subject = f.subject_id;
      if (f.status)     params.status  = f.status;

      if (f.class_level_id) {
        if (f.class_section_id) {
          const cfg = options.classConfigs.find(c =>
            String(c.student_class) === f.class_level_id &&
            String(c.class_section) === f.class_section_id
          );
          if (cfg) params.class_config = cfg.id;
        } else {
          params.student_class = f.class_level_id;
        }
      }

      const data: any = await lessonNotesAPI.list(params);
      const results = data?.results || data || [];
      setNotes(Array.isArray(results) ? results : []);
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
    searchDebounce.current = setTimeout(() => fetchNotes(filters, 1, pendingSearch), 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [filters, pendingSearch, fetchNotes]);

  // Lazy-fetch full detail for the review modal to show AI vetting feedback
  useEffect(() => {
    if (!reviewingNote) { setReviewDetail(null); return; }
    setReviewLoading(true);
    lessonNotesAPI.get(reviewingNote.id)
      .then(d => setReviewDetail(d))
      .catch(() => setReviewDetail(null))
      .finally(() => setReviewLoading(false));
  }, [reviewingNote]);

  const resetFilters = () => { setFilters(EMPTY_FILTERS); setPendingSearch(''); };
  const setF = (key: keyof FilterState, val: string) => setFilters(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (id: number) => {
    try {
      await lessonNotesAPI.submit(id);
      showToast('success', 'Note submitted for approval.');
      fetchNotes(filters, page, pendingSearch);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to submit note.');
    }
  };

  // Silent-withdraw pattern: if the note is pending, reopen (draft) first, then
  // navigate to the edit page. If reopen fails (raced with an approver action),
  // navigate anyway — the edit page's own guard decides what's allowed.
  const handleEditClick = async (note: LessonNoteList) => {
    if (note.status === 'pending_approval') {
      try { await lessonNotesAPI.reopen(note.id); } catch { /* ignore */ }
    }
    router.push(`/dashboard/staff/learning/notes/${note.id}/edit`);
  };

  const handleReview = async (action: 'approve' | 'decline') => {
    if (!reviewingNote) return;
    if (action === 'decline' && !declineReason.trim()) {
      showToast('error', 'A decline reason is required.');
      return;
    }
    setIsActioning(true);
    try {
      await lessonNotesAPI.review(reviewingNote.id, {
        action,
        decline_reason: action === 'decline' ? declineReason : undefined,
      });
      showToast('success', `Note ${action === 'approve' ? 'approved' : 'declined'}.`);
      setReviewingNote(null);
      setDeclineReason('');
      fetchNotes(filters, page, pendingSearch);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || `Failed to ${action} note.`);
    } finally {
      setIsActioning(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingNote) return;
    setIsActioning(true);
    try {
      await lessonNotesAPI.delete(deletingNote.id);
      showToast('success', 'Note deleted.');
      setDeletingNote(null);
      fetchNotes(filters, page, pendingSearch);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to delete note.');
    } finally {
      setIsActioning(false);
    }
  };

  const confirmReopen = async () => {
    if (!reopeningNote) return;
    setIsActioning(true);
    try {
      await lessonNotesAPI.reopen(reopeningNote.id);
      showToast('success', 'Note reopened for editing.');
      setReopeningNote(null);
      fetchNotes(filters, page, pendingSearch);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to reopen note.');
    } finally {
      setIsActioning(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasActiveFilters = Object.values(filters).some(v => v !== '') || !!pendingSearch;
  const shownFrom = total > 0 ? ((page - 1) * PAGE_SIZE) + 1 : 0;
  const shownTo = total > 0 ? Math.min(page * PAGE_SIZE, total) : 0;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Review Modal ── */}
      {reviewingNote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6 flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Review Note</h3>
                <p className="text-xs text-slate-500 truncate">{reviewingNote.title}</p>
              </div>
              <button onClick={() => setReviewingNote(null)} className="ml-auto text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto -mx-1 px-1 flex-1 min-h-0">
              {reviewLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading AI feedback…
                </div>
              ) : (
                <>
                  {reviewingNote.ai_vetting_score !== null && (
                    <div className="mb-3 p-3 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-800 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        AI vetting score: <strong>{Math.round((reviewingNote.ai_vetting_score || 0) * 100)}%</strong>
                      </span>
                    </div>
                  )}
                  {reviewDetail?.ai_vetting_feedback && (
                    <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">AI Feedback</p>
                      <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{reviewDetail.ai_vetting_feedback}</p>
                    </div>
                  )}
                </>
              )}

              <div className="mb-5 space-y-3">
                <p className="text-sm text-slate-600">Approve to accept, or decline with feedback.</p>
                <div>
                  <label className={labelCls}>Decline reason (required if declining)</label>
                  <textarea
                    value={declineReason}
                    onChange={e => setDeclineReason(e.target.value)}
                    placeholder="Explain what needs to change..."
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2">
              <button onClick={() => handleReview('decline')} disabled={isActioning || !declineReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-50 text-red-700 font-semibold text-sm rounded-xl border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Decline'}
              </button>
              <button onClick={() => handleReview('approve')} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deletingNote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Delete note?</h3>
                <p className="text-xs text-slate-500 truncate">{deletingNote.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingNote(null)} disabled={isActioning}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={confirmDelete} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold text-sm rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen Modal ── */}
      {reopeningNote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="h-4 w-4 text-orange-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Reopen for editing?</h3>
                <p className="text-xs text-slate-500 truncate">{reopeningNote.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              This note will return to draft and need to be resubmitted for approval.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReopeningNote(null)} disabled={isActioning}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={confirmReopen} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-orange-600 text-white font-semibold text-sm rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50">
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
              <FileText className="h-5 w-5 text-white" />
            </div>
            Lesson Notes
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Create, submit, and manage lesson notes</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/staff/learning/notes/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> New Note
          </Link>
        )}
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search notes by title..."
            value={pendingSearch}
            onChange={e => setPendingSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          />
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
          <button onClick={() => fetchNotes(filters, page, pendingSearch)} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Advanced Filters</h3>
            <button onClick={resetFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Clear all</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Subject</label>
              <select value={filters.subject_id} onChange={e => setF('subject_id', e.target.value)} className={inputCls}>
                <option value="">All Subjects</option>
                {options.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Class</label>
              <select value={filters.class_level_id}
                onChange={e => { setF('class_level_id', e.target.value); setF('class_section_id', ''); }}
                className={inputCls}>
                <option value="">All Classes</option>
                {options.classLevels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Section / Arm</label>
              <select value={filters.class_section_id} onChange={e => setF('class_section_id', e.target.value)}
                disabled={!filters.class_level_id || filteredClassSections.length === 0}
                className={inputCls + (!filters.class_level_id ? ' opacity-50' : '')}>
                <option value="">All Sections</option>
                {filteredClassSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={filters.status} onChange={e => setF('status', e.target.value)} className={inputCls}>
                <option value="">All Statuses</option>
                {(Object.keys(STATUS_CONFIG) as LessonNoteStatus[]).map(k => (
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
            <p className="text-sm text-slate-400">Loading lesson notes...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-sm text-slate-500">Failed to load notes.</p>
            <button onClick={() => fetchNotes(filters, page, pendingSearch)} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 mx-auto">
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
            <FileText className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">
            {hasActiveFilters ? 'No notes match your filters' : 'No lesson notes yet'}
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            {hasActiveFilters ? 'Try adjusting your search or filters.' : 'Create your first lesson note to get started.'}
          </p>
          {hasActiveFilters ? (
            <button onClick={resetFilters} className="text-sm px-4 py-2 bg-slate-50 text-blue-600 rounded-lg font-medium hover:bg-slate-100 transition-colors">
              Clear filters
            </button>
          ) : canCreate ? (
            <Link href="/dashboard/staff/learning/notes/create"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800">
              <Plus className="h-4 w-4" /> Create your first note
            </Link>
          ) : null}
        </div>
      ) : (
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-opacity ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
          <div className="divide-y divide-slate-50 flex-1">
            {notes.map(note => {
              const isAutoApproved = note.status === 'approved' && !note.approved_by;

              return (
                <div key={note.id} className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group">
                  <div className="hidden sm:flex w-10 h-10 rounded-xl bg-blue-50 items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 truncate">{note.title}</p>
                      <StatusBadge note={note} />
                      <CreationMethodBadge method={note.creation_method} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="font-semibold text-slate-600">{note.subject_name}</span>
                      {note.classes.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{note.classes.join(', ')}</span>
                        </>
                      )}
                      {note.scheduled_date && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmtDate(note.scheduled_date)}
                          </span>
                        </>
                      )}
                      {note.ai_vetting_score !== null && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-violet-600 font-medium">
                            <Sparkles className="h-3 w-3" /> AI {Math.round((note.ai_vetting_score || 0) * 100)}%
                          </span>
                        </>
                      )}
                      {note.grant_student_access && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <Eye className="h-3 w-3" /> Student access
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 mt-3 sm:mt-0">
                    {/* Draft: creator edits, deletes, submits */}
                    {note.status === 'draft' && canCreate && (
                      <>
                        <Link href={`/dashboard/staff/learning/notes/${note.id}/edit`} title="Edit"
                          className="p-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors">
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        <button onClick={() => setDeletingNote(note)} title="Delete"
                          className="p-2 text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleSubmit(note.id)} title="Submit for Approval"
                          className="p-2 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors">
                          <Send className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    {/* Pending approval: creator edits (silent withdraw), approver reviews */}
                    {note.status === 'pending_approval' && (
                      <>
                        {canCreate && (
                          <button onClick={() => handleEditClick(note)} title="Edit"
                            className="p-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors">
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                        {canApprove && (
                          <button onClick={() => setReviewingNote(note)}
                            className="px-3 py-1.5 text-blue-600 bg-blue-50 border border-blue-100 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                            Review
                          </button>
                        )}
                      </>
                    )}

                    {/* Declined: creator reopens or deletes */}
                    {note.status === 'declined' && canCreate && (
                      <>
                        <button onClick={() => setReopeningNote(note)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-orange-700 bg-orange-50 border border-orange-100 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                          <RotateCcw className="h-3.5 w-3.5" /> Reopen
                        </button>
                        <button onClick={() => setDeletingNote(note)} title="Delete"
                          className="p-2 text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    {/* Approved auto: creator edits directly */}
                    {isAutoApproved && canCreate && (
                      <Link href={`/dashboard/staff/learning/notes/${note.id}/edit`} title="Edit"
                        className="p-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors">
                        <Edit3 className="h-4 w-4" />
                      </Link>
                    )}

                    <Link href={`/dashboard/staff/learning/notes/${note.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-all">
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Pagination ── */}
          <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap mt-auto">
            <p className="text-xs text-slate-400">
              Showing {shownFrom}–{shownTo} of{' '}
              <span className="font-semibold text-slate-600">{total}</span>
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => fetchNotes(filters, page - 1, pendingSearch)} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pg = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                  return (
                    <button key={pg} onClick={() => fetchNotes(filters, pg, pendingSearch)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        pg === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => fetchNotes(filters, page + 1, pendingSearch)} disabled={page === totalPages}
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