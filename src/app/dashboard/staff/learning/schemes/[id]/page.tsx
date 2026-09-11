'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { schemeOfWorkAPI, schemeWeeksAPI, academicCalendarAPI } from '@/lib/api';
import { SchemeOfWorkDetail, SchemeOfWorkStatus, SchemeOfWorkWeek } from '@/lib/types';
import {
  ArrowLeft, BookOpen, CheckCircle, AlertCircle, Loader2, Edit3,
  Trash2, Send, ShieldCheck, X, Calendar, User, FileText, Check,
  Plus, RotateCcw, ChevronDown, ChevronRight, Link as LinkIcon,
  Clock, BookMarked, Sparkles, Printer, Eye
} from 'lucide-react';

const STATUS_CONFIG: Record<SchemeOfWorkStatus, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  submitted: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function StatusBadge({ status, declinedAt }: { status: SchemeOfWorkStatus; declinedAt: string | null }) {
  const isRevising = status === 'draft' && !!declinedAt;
  const isResubmission = status === 'submitted' && !!declinedAt;

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
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ────────────────────────────────────────────────────────────────
   On-screen week row (accordion)
──────────────────────────────────────────────────────────────── */
function WeekRow({
  week, schemeStatus, isCurrentPeriod, isCurrentWeek,
  onConvert, isConverting, canCreateNote,
}: {
  week: SchemeOfWorkWeek;
  schemeStatus: SchemeOfWorkStatus;
  isCurrentPeriod: boolean;
  isCurrentWeek: boolean;
  onConvert: (weekId: number) => void;
  isConverting: boolean;
  canCreateNote: boolean;
}) {
  const [expanded, setExpanded] = useState(isCurrentWeek);

  const showCreateNote =
    schemeStatus === 'approved' &&
    isCurrentPeriod &&
    !week.lesson_note &&
    !week.is_holiday_or_break &&
    canCreateNote;

  const showOverdue =
    !week.lesson_note &&
    !week.is_holiday_or_break &&
    week.is_overdue;

  return (
    <div className={`border-b border-slate-100 last:border-b-0 transition-colors print:hidden ${isCurrentWeek ? 'bg-blue-50/40' : ''}`}>
      {/* Desktop row */}
      <div className="hidden md:flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
          aria-label={expanded ? 'Collapse week' : 'Expand week'}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="w-16 flex-shrink-0">
          <p className="text-[11px] font-medium text-slate-400">Week</p>
          <p className="text-sm font-semibold text-slate-800 tabular-nums">{week.week_number}</p>
        </div>

        <div className="w-28 flex-shrink-0">
          <p className="text-[11px] font-medium text-slate-400">Dates</p>
          <p className="text-xs text-slate-600 font-medium tabular-nums">
            {week.week_start_date && week.week_end_date
              ? `${fmtDate(week.week_start_date)} – ${fmtDate(week.week_end_date)}`
              : '—'}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-slate-400">
            {week.is_holiday_or_break ? 'Label' : 'Topic'}
          </p>
          <p className="text-sm font-medium text-slate-800 truncate">
            {week.topic || '—'}
            {isCurrentWeek && (
              <span className="ml-2 inline-flex items-center text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                This week
              </span>
            )}
            {week.is_holiday_or_break && (
              <span className="ml-2 inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                Non-teaching
              </span>
            )}
          </p>
        </div>

        <div className="w-40 flex-shrink-0 text-right">
          {week.lesson_note ? (
            <Link
              href={`/dashboard/staff/learning/notes/${week.lesson_note}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" /> View Note
            </Link>
          ) : week.is_holiday_or_break ? (
            <span className="text-xs text-slate-400">—</span>
          ) : showCreateNote ? (
            <button
              onClick={() => onConvert(week.id)}
              disabled={isConverting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {isConverting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Note
            </button>
          ) : showOverdue ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
              <Clock className="h-3.5 w-3.5" /> No note
            </span>
          ) : (
            <span className="text-xs text-slate-400">No note</span>
          )}
        </div>
      </div>

      {/* Mobile row */}
      <div className="md:hidden px-4 py-3">
        <button onClick={() => setExpanded(v => !v)} className="w-full text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {expanded ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400">Week {week.week_number}</p>
                <p className="text-sm font-medium text-slate-800 truncate">{week.topic || '—'}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {week.week_start_date && week.week_end_date
                    ? `${fmtDate(week.week_start_date)} – ${fmtDate(week.week_end_date)}`
                    : 'No dates'}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {week.lesson_note ? (
                <Link
                  href={`/dashboard/staff/learning/notes/${week.lesson_note}`}
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1"
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </Link>
              ) : week.is_holiday_or_break ? (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Break</span>
              ) : showCreateNote ? (
                <button
                  onClick={e => { e.stopPropagation(); onConvert(week.id); }}
                  disabled={isConverting}
                  className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1 disabled:opacity-50"
                >
                  {isConverting ? <Loader2 className="h-3 w-3 animate-spin" /> : '+ Note'}
                </button>
              ) : showOverdue ? (
                <Clock className="h-5 w-5 text-red-500" />
              ) : null}
            </div>
          </div>
        </button>
      </div>

      {/* Expanded content */}
      {expanded && !week.is_holiday_or_break && (
        <div className="px-5 md:px-20 pb-5 pt-1 space-y-4">
          {week.sub_topics && week.sub_topics.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-1.5">Sub-Topics</p>
              <ul className="space-y-1">
                {week.sub_topics.map((st, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-blue-500 leading-6 select-none">★</span>
                    <span className="leading-6">{st}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-1">Planned Objectives</p>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{week.planned_objectives || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-1">Planned Activities</p>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{week.planned_activities || '—'}</p>
            </div>
          </div>

          {week.reference_materials && (
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> Reference Materials
              </p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{week.reference_materials}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Print-only document — a clean, formal rendering independent of
   the on-screen accordion state, styled like a printed handout
   rather than a webpage.
──────────────────────────────────────────────────────────────── */
function PrintDocument({ scheme, classesString }: { scheme: SchemeOfWorkDetail; classesString: string }) {
  const teachingWeeks = scheme.weeks.filter(w => !w.is_holiday_or_break);
  const breakWeeks = scheme.weeks.filter(w => w.is_holiday_or_break);

  return (
    <div className="hidden print:block print-doc">
      <header className="print-doc-header">
        <p className="print-doc-eyebrow">Scheme of Work</p>
        <h1>{scheme.title}</h1>
        <table className="print-doc-meta">
          <tbody>
            <tr>
              <td>Subject</td><td>{scheme.subject.name}</td>
              <td>Class</td><td>{classesString}</td>
            </tr>
            <tr>
              <td>Session</td><td>{scheme.session_name || scheme.session}</td>
              <td>Term</td><td>{scheme.term_name || scheme.term}</td>
            </tr>
            <tr>
              <td>Prepared by</td><td>{scheme.created_by?.full_name || 'Unknown'}</td>
              <td>Date</td><td>{fmtDateLong(scheme.created_at)}</td>
            </tr>
            {scheme.approved_by && (
              <tr>
                <td>Approved by</td><td>{scheme.approved_by.full_name}</td>
                <td>Approved on</td><td>{scheme.approved_at ? fmtDateLong(scheme.approved_at) : '—'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </header>

      <hr className="print-doc-rule" />

      <main>
        {teachingWeeks.map(week => (
          <section className="print-doc-week" key={week.id}>
            <div className="print-doc-week-title">
              <span>Week {week.week_number}</span>
              {week.week_start_date && week.week_end_date && (
                <span className="print-doc-week-dates">
                  {fmtDate(week.week_start_date)} – {fmtDate(week.week_end_date)}
                </span>
              )}
            </div>
            <h2>{week.topic || 'Untitled topic'}</h2>

            {week.sub_topics && week.sub_topics.length > 0 && (
              <div className="print-doc-field">
                <h3>Sub-Topics</h3>
                <ul>
                  {week.sub_topics.map((st, i) => <li key={i}>{st}</li>)}
                </ul>
              </div>
            )}

            <div className="print-doc-two-col">
              <div className="print-doc-field">
                <h3>Objectives</h3>
                <p>{week.planned_objectives || '—'}</p>
              </div>
              <div className="print-doc-field">
                <h3>Activities</h3>
                <p>{week.planned_activities || '—'}</p>
              </div>
            </div>

            {week.reference_materials && (
              <div className="print-doc-field">
                <h3>Reference Materials</h3>
                <p>{week.reference_materials}</p>
              </div>
            )}
          </section>
        ))}

        {breakWeeks.length > 0 && (
          <section className="print-doc-week print-doc-breaks">
            <h3>Non-teaching Weeks</h3>
            <ul>
              {breakWeeks.map(w => (
                <li key={w.id}>
                  Week {w.week_number}
                  {w.week_start_date && w.week_end_date && ` (${fmtDate(w.week_start_date)} – ${fmtDate(w.week_end_date)})`}
                  {w.topic ? ` — ${w.topic}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="print-doc-footer">
        EduMax360 · Scheme of Work · {scheme.title} · Printed {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </footer>

      <style jsx global>{`
        @media print {
          @page { margin: 20mm 18mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-doc {
          font-family: Georgia, 'Times New Roman', serif;
          color: #1a1a1a;
          max-width: 100%;
        }
        .print-doc-eyebrow {
          font-size: 10pt;
          letter-spacing: 0.04em;
          color: #555;
          margin: 0 0 4pt 0;
          font-family: Georgia, serif;
          font-style: italic;
        }
        .print-doc-header h1 {
          font-size: 20pt;
          margin: 0 0 10pt 0;
          font-weight: 700;
          line-height: 1.25;
        }
        .print-doc-meta {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
          margin-bottom: 4pt;
        }
        .print-doc-meta td {
          padding: 2pt 6pt 2pt 0;
          vertical-align: top;
        }
        .print-doc-meta td:nth-child(odd) {
          color: #666;
          white-space: nowrap;
          width: 1%;
        }
        .print-doc-meta td:nth-child(even) {
          font-weight: 600;
          padding-right: 24pt;
        }
        .print-doc-rule {
          border: none;
          border-top: 1.5pt solid #1a1a1a;
          margin: 10pt 0 16pt 0;
        }
        .print-doc-week {
          break-inside: avoid;
          page-break-inside: avoid;
          margin-bottom: 18pt;
          padding-bottom: 14pt;
          border-bottom: 0.75pt solid #ccc;
        }
        .print-doc-week:last-child { border-bottom: none; }
        .print-doc-week-title {
          display: flex;
          justify-content: space-between;
          font-size: 9.5pt;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #666;
          margin-bottom: 2pt;
        }
        .print-doc-week h2 {
          font-size: 13pt;
          margin: 0 0 8pt 0;
          font-weight: 700;
        }
        .print-doc-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 20pt;
        }
        .print-doc-field { margin-bottom: 8pt; }
        .print-doc-field h3 {
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #666;
          font-weight: 600;
          margin: 0 0 3pt 0;
        }
        .print-doc-field p {
          font-size: 10.5pt;
          line-height: 1.5;
          margin: 0;
          white-space: pre-line;
        }
        .print-doc-field ul {
          margin: 0;
          padding-left: 14pt;
          font-size: 10.5pt;
          line-height: 1.5;
        }
        .print-doc-breaks { border-bottom: none; }
        .print-doc-footer {
          margin-top: 24pt;
          padding-top: 8pt;
          border-top: 0.75pt solid #ccc;
          font-size: 8.5pt;
          color: #888;
          text-align: center;
        }
      `}</style>
    </div>
  );
}

export default function SchemeOfWorkDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [scheme, setScheme] = useState<SchemeOfWorkDetail | null>(null);
  const [isCurrentPeriod, setIsCurrentPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const [convertingWeekId, setConvertingWeekId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('learning_resources.add_schemeofworkmodel');
  const canApprove = user?.is_superuser || hasPermission('learning_resources.approve_scheme_of_work') || hasPermission('learning_resources.decline_scheme_of_work');
  const canCreateNote = user?.is_superuser || hasPermission('learning_resources.add_lessonnotemodel');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const toastId = ++_toastId;
    setToasts(prev => [...prev, { id: toastId, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 4500);
  };
  const dismissToast = (toastId: number) => setToasts(prev => prev.filter(t => t.id !== toastId));

  const fetchScheme = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const [data, curTerm] = await Promise.all([
        schemeOfWorkAPI.get(Number(id)),
        academicCalendarAPI.getCurrentPeriod().catch(() => null),
      ]);
      setScheme(data);
      // Current period check: current term's id matches scheme's term,
      // and the current term's session matches scheme's session.
      setIsCurrentPeriod(
        !!curTerm &&
        curTerm.id === data.term &&
        curTerm.session?.id === data.session
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchScheme(); }, [fetchScheme]);

  const handleSubmit = async () => {
    try {
      await schemeOfWorkAPI.submit(Number(id));
      showToast('success', 'Scheme submitted for approval.');
      fetchScheme();
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to submit scheme.');
    }
  };

  const handleReview = async (action: 'approve' | 'decline') => {
    if (action === 'decline' && !declineReason.trim()) {
      showToast('error', 'A decline reason is required.');
      return;
    }
    setIsActioning(true);
    try {
      await schemeOfWorkAPI.review(Number(id), {
        action,
        decline_reason: action === 'decline' ? declineReason : undefined,
      });
      showToast('success', `Scheme ${action === 'approve' ? 'approved' : 'declined'}.`);
      setShowReviewModal(false);
      setDeclineReason('');
      fetchScheme();
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || `Failed to ${action} scheme.`);
    } finally {
      setIsActioning(false);
    }
  };

  const handleDelete = async () => {
    setIsActioning(true);
    try {
      await schemeOfWorkAPI.delete(Number(id));
      showToast('success', 'Scheme deleted.');
      router.push('/dashboard/staff/learning/schemes');
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to delete scheme.');
      setIsActioning(false);
    }
  };

  const handleReopen = async () => {
    setIsActioning(true);
    try {
      await schemeOfWorkAPI.reopen(Number(id));
      showToast('success', 'Scheme reopened for editing.');
      setShowReopenModal(false);
      fetchScheme();
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to reopen scheme.');
    } finally {
      setIsActioning(false);
    }
  };

  const handleConvertWeek = async (weekId: number) => {
    setConvertingWeekId(weekId);
    try {
      const res = await schemeWeeksAPI.convertToNote(weekId);
      const noteId = res?.data?.note_id;
      if (noteId) {
        showToast('success', 'Draft note created. Opening editor...');
        router.push(`/dashboard/staff/learning/notes/${noteId}/edit`);
      } else {
        showToast('error', 'Note created but ID missing in response.');
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to create lesson note.');
    } finally {
      setConvertingWeekId(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('error', 'Could not copy link.');
    }
  };

  const currentWeekId = useMemo(() => {
    if (!scheme) return null;
    const today = new Date().toISOString().split('T')[0];
    const w = scheme.weeks.find(w =>
      w.week_start_date && w.week_end_date &&
      w.week_start_date <= today && today <= w.week_end_date
    );
    return w?.id ?? null;
  }, [scheme]);

  const stats = useMemo(() => {
    if (!scheme) return { total: 0, withNotes: 0, holidays: 0 };
    const total = scheme.weeks.length;
    const withNotes = scheme.weeks.filter(w => !!w.lesson_note).length;
    const holidays = scheme.weeks.filter(w => w.is_holiday_or_break).length;
    return { total, withNotes, holidays };
  }, [scheme]);

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );

  if (error || !scheme) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="h-10 w-10 text-red-400 mb-4" />
      <h3 className="text-lg font-semibold text-slate-800">Failed to load scheme</h3>
      <button onClick={() => router.back()} className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700">Go back</button>
    </div>
  );

  const classesString = scheme.class_configurations_detail.map(c => c.name).join(', ') || 'N/A';
  const isAutoApproved = scheme.status === 'approved' && !scheme.approved_by;
  const isManualApproved = scheme.status === 'approved' && !!scheme.approved_by;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <PrintDocument scheme={scheme} classesString={classesString} />

      {/* ── Review Modal ── */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Review Scheme</h3>
                <p className="text-xs text-slate-500 truncate">{scheme.title}</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="ml-auto text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {scheme.decline_reason && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                <strong className="block mb-0.5 font-semibold">Previously declined</strong>
                {scheme.decline_reason}
              </div>
            )}
            <div className="mb-5 space-y-3">
              <p className="text-sm text-slate-600">Approve to accept, or decline with feedback.</p>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Decline reason (required if declining)
                </label>
                <textarea
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  placeholder="Explain what needs to change..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none resize-none transition-shadow"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3">
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
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-4.5 w-4.5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Delete scheme?</h3>
                <p className="text-xs text-slate-500 truncate">{scheme.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">This cannot be undone. All weekly plans for this scheme will be lost.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={isActioning}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleDelete} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold text-sm rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen Modal ── */}
      {showReopenModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="h-4.5 w-4.5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">
                  {scheme.status === 'declined' ? 'Reopen for editing?' : 'Revert to draft?'}
                </h3>
                <p className="text-xs text-slate-500 truncate">{scheme.title}</p>
              </div>
            </div>
            {scheme.decline_reason && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                <strong className="block mb-0.5 font-semibold">Previous decline reason</strong>
                {scheme.decline_reason}
              </div>
            )}
            <p className="text-sm text-slate-600 mb-5">This scheme will return to draft and need to be resubmitted for approval.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowReopenModal(false)} disabled={isActioning}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleReopen} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-orange-600 text-white font-semibold text-sm rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="space-y-3 print:hidden">
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-slate-200 flex-shrink-0 mt-0.5">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight leading-tight">{scheme.title}</h1>
              <StatusBadge status={scheme.status} declinedAt={scheme.declined_at} />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pl-11">
          <p className="text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
            <User className="h-3.5 w-3.5" />
            {scheme.created_by?.full_name || 'Unknown'} · {fmtDateLong(scheme.created_at)}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleCopyLink}
              className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Copy link">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <LinkIcon className="h-4 w-4" />}
            </button>

            <button onClick={() => window.print()}
              className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Print">
              <Printer className="h-4 w-4" />
            </button>

            {scheme.status === 'draft' && canCreate && (
              <>
                <Link href={`/dashboard/staff/learning/schemes/${scheme.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </Link>
                <button onClick={() => setShowDeleteModal(true)}
                  className="p-2 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={handleSubmit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/20">
                  <Send className="h-3.5 w-3.5" /> Submit
                </button>
              </>
            )}

            {scheme.status === 'declined' && canCreate && (
              <button onClick={() => setShowReopenModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition-colors shadow-sm shadow-orange-600/20">
                <RotateCcw className="h-3.5 w-3.5" /> Reopen for Editing
              </button>
            )}

            {isAutoApproved && canCreate && (
              <Link href={`/dashboard/staff/learning/schemes/${scheme.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                <Edit3 className="h-3.5 w-3.5" /> Edit
              </Link>
            )}

            {isManualApproved && canApprove && (
              <button onClick={() => setShowReopenModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Revert to Draft
              </button>
            )}

            {scheme.status === 'submitted' && canApprove && (
              <button onClick={() => setShowReviewModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
                <ShieldCheck className="h-3.5 w-3.5" /> Review Scheme
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Status Banner ── */}
      {scheme.status === 'declined' && scheme.decline_reason && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 print:hidden">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-red-800">
              Declined by {scheme.declined_by?.full_name || 'Admin'}
              {scheme.declined_at && ` on ${fmtDateLong(scheme.declined_at)}`}
            </h4>
            <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{scheme.decline_reason}</p>
          </div>
        </div>
      )}

      {scheme.status === 'draft' && scheme.declined_at && scheme.decline_reason && (
        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3 print:hidden">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-orange-800">
              Previously declined on {fmtDateLong(scheme.declined_at)}
            </h4>
            <p className="text-sm text-orange-700 mt-1 whitespace-pre-line">{scheme.decline_reason}</p>
          </div>
        </div>
      )}

      {scheme.status === 'submitted' && scheme.declined_at && scheme.decline_reason && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 print:hidden">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-blue-800">
              Resubmission — previously declined on {fmtDateLong(scheme.declined_at)}
            </h4>
            <p className="text-sm text-blue-700 mt-1 whitespace-pre-line">{scheme.decline_reason}</p>
          </div>
        </div>
      )}

      {isManualApproved && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 print:hidden">
          <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
            Approved by {scheme.approved_by?.full_name || 'Admin'}
            {scheme.approved_at && ` on ${fmtDateLong(scheme.approved_at)}`}
          </p>
        </div>
      )}

      {isAutoApproved && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 print:hidden">
          <Sparkles className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
            Auto-approved — directly editable without a review step.
          </p>
        </div>
      )}

      {/* ── Stats Strip ── */}
      <div className="grid grid-cols-3 gap-3 print:hidden">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <p className="text-xs font-medium text-slate-500">Weeks</p>
          </div>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <BookMarked className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="text-xs font-medium text-slate-500">Notes</p>
          </div>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">
            {stats.withNotes}<span className="text-sm text-slate-400 font-medium"> / {stats.total}</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="text-xs font-medium text-slate-500">Breaks</p>
          </div>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">{stats.holidays}</p>
        </div>
      </div>

      {/* ── Metadata Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 grid grid-cols-2 md:grid-cols-4 gap-6 print:hidden">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Subject</p>
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" /> {scheme.subject.name}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Class</p>
          <p className="text-sm font-semibold text-slate-800">{classesString}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Session</p>
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" /> {scheme.session_name || scheme.session}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Term</p>
          <p className="text-sm font-semibold text-slate-800">{scheme.term_name || scheme.term}</p>
        </div>
      </div>

      {/* ── Weekly Plan ── */}
      <div className="space-y-3 print:hidden">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-blue-600" />
          Weekly Plan
          <span className="text-sm font-normal text-slate-400">({stats.total})</span>
        </h3>

        {scheme.weeks.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-100 rounded-2xl">
            <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No weeks planned for this scheme.</p>
            {scheme.status === 'draft' && canCreate && (
              <Link href={`/dashboard/staff/learning/schemes/${scheme.id}/edit`}
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                <Plus className="h-4 w-4" /> Add weeks
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {scheme.weeks.map(week => (
                <WeekRow
                  key={week.id}
                  week={week}
                  schemeStatus={scheme.status}
                  isCurrentPeriod={isCurrentPeriod}
                  isCurrentWeek={week.id === currentWeekId}
                  onConvert={handleConvertWeek}
                  isConverting={convertingWeekId === week.id}
                  canCreateNote={canCreateNote}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}