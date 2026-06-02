'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { examsAPI, academicCalendarAPI } from '@/lib/api';
import { Exam, SchedulesProgress } from '@/types/assessment.types';
import {
  ClipboardList, Plus, Search, Eye, Trash2, X, Check,
  AlertCircle, BookOpen, Calendar, Users, CheckCircle2,
  Clock, BarChart3, Globe, Lock, FlaskConical, ChevronRight,
  RefreshCw, Loader2, AlertTriangle,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const EXAM_TYPE_LABELS: Record<string, string> = {
  test: 'Class Test',
  quiz: 'Quiz',
  ca: 'Continuous Assessment',
  midterm: 'Mid-term Exam',
  exam: 'End of Term Exam',
  practice: 'Practice / Mock',
};

const EXAM_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  test:     { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  quiz:     { bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200' },
  ca:       { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  midterm:  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  exam:     { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  practice: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractError(err: any): string {
  if (!err) return 'An unknown error occurred';
  if (err.response?.data) {
    const d = err.response.data;
    if (typeof d === 'string') return d;
    if (d.detail) return d.detail;
    if (d.error) return d.error;
    if (d.message) return d.message;
    const first = Object.values(d)[0];
    if (Array.isArray(first)) return first[0] as string;
    if (typeof first === 'string') return first;
  }
  return err.message || 'An error occurred';
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto
            ${t.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 text-green-600 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
          <span className="text-sm font-medium">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const show = (type: Toast['type'], message: string) => {
    const id = ++counter.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };
  const remove = (id: number) => setToasts(p => p.filter(t => t.id !== id));
  return { toasts, showToast: show, removeToast: remove };
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  open, title, message, subMessage, confirmLabel = 'Confirm', confirmClass = 'bg-red-600 hover:bg-red-700',
  loading, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string; subMessage?: string;
  confirmLabel?: string; confirmClass?: string;
  loading: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-center text-slate-900 mb-1">{title}</h3>
        <p className="text-center text-slate-600 text-sm mb-1">{message}</p>
        {subMessage && <p className="text-center text-red-600 text-xs mb-6">{subMessage}</p>}
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={onCancel} disabled={loading}
            className="px-5 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-5 py-2.5 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center gap-2 transition-colors ${confirmClass}`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface SessionPeriod {
  id: number;
  session: number | { id: number; start_year: number; end_year: number; name: string };
  period: number | { id: number; name: string };
  is_current: boolean;
}

export default function ExamsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const { toasts, showToast, removeToast } = useToasts();

  const [exams, setExams] = useState<Exam[]>([]);
  const [sessionPeriods, setSessionPeriods] = useState<SessionPeriod[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<SessionPeriod | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters (server-side)
  const [filterType, setFilterType] = useState('');
  const [filterPublished, setFilterPublished] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modal
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canView   = user?.is_superuser || hasPermission('assessment_center.view_exammodel');
  const canCreate = user?.is_superuser || hasPermission('assessment_center.add_exammodel');
  const canDelete = user?.is_superuser || hasPermission('assessment_center.delete_exammodel');

  useEffect(() => {
    if (canView) fetchAll();
  }, [canView]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [examsData, periodsData] = await Promise.all([
        examsAPI.list(),
        academicCalendarAPI.listSessionPeriods(),
      ]);
      setExams(examsData);
      setSessionPeriods(periodsData);
      setCurrentPeriod(periodsData.find((p: SessionPeriod) => p.is_current) ?? null);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingExam) return;
    setDeleteLoading(true);
    try {
      await examsAPI.delete(deletingExam.id);
      setExams(p => p.filter(e => e.id !== deletingExam.id));
      setDeletingExam(null);
      showToast('success', `"${deletingExam.name}" deleted`);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getId = (v: any): number => (typeof v === 'object' && v !== null ? v.id : v);

  const getSessionLabel = (exam: Exam): string => {
    const period = sessionPeriods.find(p => getId(p.session) === exam.session);
    if (!period) return exam.session_name || `Session ${exam.session}`;
    const s = period.session;
    if (typeof s === 'object') return `${s.start_year}/${s.end_year}`;
    return exam.session_name || `Session ${exam.session}`;
  };

  const getTermLabel = (exam: Exam): string =>
    exam.term_name || `Term ${exam.term}`;

  const isCurrentPeriodExam = (exam: Exam): boolean => {
    if (!currentPeriod) return false;
    return exam.term === currentPeriod.id;
  };

  // ── Client-side filtering (search + type + published — all small filters) ──
  const filtered = exams.filter(exam => {
    if (filterType && exam.exam_type !== filterType) return false;
    if (filterPublished === 'published' && !exam.is_published) return false;
    if (filterPublished === 'unpublished' && exam.is_published) return false;
    if (filterPublished === 'practice' && !exam.is_practice_mode) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return exam.name.toLowerCase().includes(q) ||
        getSessionLabel(exam).toLowerCase().includes(q) ||
        getTermLabel(exam).toLowerCase().includes(q) ||
        (EXAM_TYPE_LABELS[exam.exam_type] || '').toLowerCase().includes(q);
    }
    return true;
  });

  const currentExams = filtered.filter(isCurrentPeriodExam);
  const otherExams   = filtered.filter(e => !isCurrentPeriodExam(e));

  const hasFilter = !!(filterType || filterPublished || searchTerm);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Total Exams',      value: filtered.length,                               color: 'text-violet-600' },
    { label: 'Current Term',     value: filtered.filter(isCurrentPeriodExam).length,   color: 'text-violet-600' },
    { label: 'Published',        value: filtered.filter(e => e.is_published).length,    color: 'text-emerald-600' },
    { label: 'Practice',         value: filtered.filter(e => e.is_practice_mode).length, color: 'text-blue-600' },
  ];

  if (!canView) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500">You don't have permission to view exams.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onRemove={removeToast} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Exams</h1>
            <p className="text-sm text-slate-500">
              Manage examinations
              {currentPeriod && (() => {
                const s = currentPeriod.session;
                const p = currentPeriod.period;
                const sLabel = typeof s === 'object' ? `${s.start_year}/${s.end_year}` : '';
                const pLabel = typeof p === 'object' ? p.name : '';
                return sLabel ? (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                    {sLabel}{pLabel ? ` · ${pLabel}` : ''}
                  </span>
                ) : null;
              })()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll}
            className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          {canCreate && (
            <button
              onClick={() => router.push('/dashboard/staff/assessment/exams/create')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl shadow-sm hover:from-violet-700 hover:to-indigo-700 transition-all text-sm">
              <Plus className="h-4 w-4" />
              Create Exam
            </button>
          )}
        </div>
      </div>

      {/* ── Stat chips ─────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-xs font-medium text-slate-500 mb-0.5">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm px-4 py-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search exams..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white">
            <option value="">All Types</option>
            {Object.entries(EXAM_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select value={filterPublished} onChange={e => setFilterPublished(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white">
            <option value="">All Status</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
            <option value="practice">Practice Mode</option>
          </select>
          {hasFilter && (
            <button onClick={() => { setSearchTerm(''); setFilterType(''); setFilterPublished(''); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Delete modal ───────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!deletingExam}
        title="Delete Exam"
        message={`Are you sure you want to delete "${deletingExam?.name}"?`}
        subMessage="This will also delete all schedules, questions, and student attempts."
        confirmLabel="Delete Exam"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeletingExam(null)}
      />

      {/* ── List ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-violet-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading exams...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-3">
          <ClipboardList className="h-14 w-14 text-slate-200" />
          <p className="text-base font-semibold text-slate-700">
            {hasFilter ? 'No exams match your filters' : 'No exams yet'}
          </p>
          <p className="text-sm text-slate-400">
            {hasFilter ? 'Try adjusting your search or filters' : 'Create your first exam to get started'}
          </p>
          {!hasFilter && canCreate && (
            <button onClick={() => router.push('/dashboard/staff/assessment/exams/create')}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors text-sm">
              <Plus className="h-4 w-4" /> Create Exam
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current session */}
          {currentExams.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-violet-100" />
                <span className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-3 py-1 rounded-full">
                  Current Session
                </span>
                <div className="h-px flex-1 bg-violet-100" />
              </div>
              <div className="space-y-2.5">
                {currentExams.map(exam => (
                  <ExamCard
                    key={exam.id} exam={exam}
                    sessionLabel={getSessionLabel(exam)}
                    termLabel={getTermLabel(exam)}
                    isCurrent
                    canDelete={canDelete}
                    onView={() => router.push(`/dashboard/staff/assessment/exams/${exam.id}`)}
                    onDelete={() => setDeletingExam(exam)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Other sessions */}
          {otherExams.length > 0 && (
            <section>
              {currentExams.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
                    Previous Sessions
                  </span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
              )}
              <div className="space-y-2.5">
                {otherExams.map(exam => (
                  <ExamCard
                    key={exam.id} exam={exam}
                    sessionLabel={getSessionLabel(exam)}
                    termLabel={getTermLabel(exam)}
                    isCurrent={false}
                    canDelete={canDelete}
                    onView={() => router.push(`/dashboard/staff/assessment/exams/${exam.id}`)}
                    onDelete={() => setDeletingExam(exam)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Exam Card ────────────────────────────────────────────────────────────────

function ExamCard({
  exam, sessionLabel, termLabel, isCurrent, canDelete, onView, onDelete,
}: {
  exam: Exam; sessionLabel: string; termLabel: string; isCurrent: boolean;
  canDelete: boolean; onView: () => void; onDelete: () => void;
}) {
  const typeColor = EXAM_TYPE_COLORS[exam.exam_type] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  const progress = exam.schedules_progress;

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group
      ${isCurrent ? 'border-violet-200 hover:border-violet-300' : 'border-slate-100 hover:border-slate-200'}`}
      onClick={onView}>
      <div className="p-4">
        <div className="flex items-start gap-3">

          {/* Icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
            ${exam.is_practice_mode ? 'bg-green-100' : exam.is_published ? 'bg-violet-100' : 'bg-slate-100'}`}>
            {exam.is_practice_mode
              ? <FlaskConical className="h-5 w-5 text-green-600" />
              : exam.is_published
              ? <Globe className="h-5 w-5 text-violet-600" />
              : <Lock className="h-5 w-5 text-slate-500" />}
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-slate-900 truncate group-hover:text-violet-700 transition-colors">
                    {exam.name}
                  </h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border
                    ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}>
                    {EXAM_TYPE_LABELS[exam.exam_type] || exam.exam_type}
                  </span>
                  {exam.is_published && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Published
                    </span>
                  )}
                  {!exam.schedules_created && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                      <Clock className="h-3 w-3" /> Generating schedules…
                    </span>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {sessionLabel}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="font-medium text-slate-600 capitalize">{termLabel}</span>
                  <span className="text-slate-300">·</span>
                  <span>{exam.start_date} → {exam.end_date}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={onView}
                  className="p-1.5 text-violet-500 hover:bg-violet-50 rounded-lg transition-colors border border-transparent hover:border-violet-200"
                  title="View">
                  <Eye className="h-4 w-4" />
                </button>
                {canDelete && !exam.is_published && (
                  <button onClick={onDelete}
                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                    title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400 transition-colors ml-1" />
              </div>
            </div>

            {/* Bottom info row */}
            <div className="flex items-center gap-4 mt-2.5 flex-wrap">
              {exam.subjects_count !== undefined && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <BookOpen className="h-3 w-3 text-slate-400" />
                  {exam.subjects_count} subject{exam.subjects_count !== 1 ? 's' : ''}
                </div>
              )}
              {exam.classes_count !== undefined && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Users className="h-3 w-3 text-slate-400" />
                  {exam.classes_count} class{exam.classes_count !== 1 ? 'es' : ''}
                </div>
              )}
              {progress && progress.total > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <BarChart3 className="h-3 w-3 text-slate-400" />
                    <span className={progress.ready === progress.total ? 'text-emerald-600 font-medium' : ''}>
                      {progress.ready}/{progress.total} schedules ready
                    </span>
                  </div>
                  <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress.percentage === 100 ? 'bg-emerald-500' : 'bg-violet-500'
                      }`}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}