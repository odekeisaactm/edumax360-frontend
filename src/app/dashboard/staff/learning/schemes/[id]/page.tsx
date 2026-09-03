'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { schemeOfWorkAPI, academicCalendarAPI } from '@/lib/api';
import { SchemeOfWorkDetail, SchemeOfWorkStatus } from '@/lib/types';
import {
  ArrowLeft, BookOpen, Clock, CheckCircle, XCircle, AlertCircle,
  Loader2, Edit3, Trash2, Send, ShieldCheck, X, Calendar, User, FileText, Check
} from 'lucide-react';

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<SchemeOfWorkStatus, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  submitted: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SchemeOfWorkStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${cfg.color}`}>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SchemeOfWorkDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [scheme, setScheme] = useState<SchemeOfWorkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Mappings for human-readable session and term
  const [sessionName, setSessionName] = useState('Unknown Session');
  const [termName, setTermName] = useState('Unknown Term');

  // Modals & Actions
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Permissions
  const canApprove = user?.is_superuser || hasPermission('learning_resources.approve_scheme_of_work') || hasPermission('learning_resources.decline_scheme_of_work');

  const showToast = (type: 'success' | 'error', message: string) => {
    const toastId = ++_toastId;
    setToasts(prev => [...prev, { id: toastId, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 4500);
  };
  const dismissToast = (toastId: number) => setToasts(prev => prev.filter(t => t.id !== toastId));

  const fetchScheme = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const data = await schemeOfWorkAPI.get(Number(id));
      setScheme(data);

      // Fetch names for session and term
      try {
        const [sessions, periods] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.listSessionPeriods({ session_id: data.session }),
        ]);
        const sMatch = sessions.find((s: any) => s.id === data.session);
        const pMatch = periods.find((p: any) => p.id === data.term);
        if (sMatch) setSessionName(sMatch.name || `${sMatch.start_year}/${sMatch.end_year}`);
        if (pMatch) setTermName(pMatch.period?.name || pMatch.name);
      } catch (e) {
        // Fallback silently if mapping fails
      }
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
        decline_reason: action === 'decline' ? declineReason : undefined
      });
      showToast('success', `Scheme successfully ${action}d.`);
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
    if (!window.confirm('Are you sure you want to delete this scheme? This cannot be undone.')) return;
    try {
      await schemeOfWorkAPI.delete(Number(id));
      router.push('/dashboard/staff/learning/schemes');
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to delete scheme.');
    }
  };

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
  );

  if (error || !scheme) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="h-10 w-10 text-red-400 mb-4" />
      <h3 className="text-lg font-bold text-slate-800">Failed to load Scheme</h3>
      <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">Go Back</button>
    </div>
  );

  const classesString = scheme.class_configurations_detail.map(c => c.name).join(', ') || 'N/A';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Review Modal ── */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Review Scheme</h3>
                <p className="text-xs text-slate-500 truncate">{scheme.title}</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="ml-auto text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-5 space-y-3">
              <p className="text-sm text-slate-600">Please review the curriculum outline. You can approve it immediately or decline it with feedback for the teacher.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Decline Reason (Required if declining)</label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Explain what needs to be changed..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  rows={3}
                />
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

      {/* ── Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => router.back()} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-slate-200 shadow-sm mt-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">{scheme.title}</h1>
              <StatusBadge status={scheme.status} />
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <User className="h-4 w-4" /> Created by {scheme.created_by?.full_name || 'Unknown'} on {new Date(scheme.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scheme.status === 'draft' && (
            <>
              <Link href={`/dashboard/staff/learning/schemes/create?edit=${scheme.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                <Edit3 className="h-4 w-4" /> Edit Draft
              </Link>
              <button onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md">
                <Send className="h-4 w-4" /> Submit
              </button>
            </>
          )}

          <button onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors">
            <Trash2 className="h-4 w-4" /> Delete
          </button>

          {canApprove && scheme.status === 'submitted' && (
            <button onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md">
              <ShieldCheck className="h-4 w-4" /> Review Scheme
            </button>
          )}
        </div>
      </div>

      {/* ── Status Feedback Block ── */}
      {scheme.status === 'declined' && scheme.decline_reason && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-800">Declined by {scheme.declined_by?.full_name || 'Admin'} on {scheme.declined_at ? new Date(scheme.declined_at).toLocaleDateString() : ''}</h4>
            <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{scheme.decline_reason}</p>
          </div>
        </div>
      )}

      {scheme.status === 'approved' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">Approved by {scheme.approved_by?.full_name || 'Admin'} on {scheme.approved_at ? new Date(scheme.approved_at).toLocaleDateString() : ''}</p>
        </div>
      )}

      {/* ── Metadata Grid ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Subject</p>
          <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-500" /> {scheme.subject.name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Class Configuration</p>
          <p className="text-sm font-bold text-slate-800">{classesString}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Session</p>
          <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-500" /> {sessionName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Term</p>
          <p className="text-sm font-bold text-slate-800">{termName}</p>
        </div>
      </div>

      {/* ── Weekly Breakdown ── */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" /> Weekly Plan ({scheme.weeks.length})
        </h3>

        {scheme.weeks.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-2xl">
            <p className="text-slate-500 text-sm">No weeks planned for this scheme.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scheme.weeks.map(week => (
              <div key={week.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className={`px-5 py-3 border-b flex items-center justify-between ${week.is_holiday_or_break ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50/80 border-slate-100'}`}>
                  <h4 className="font-bold text-slate-800">Week {week.week_number}</h4>
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                    {week.week_start_date && week.week_end_date && (
                      <span className="bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                        {new Date(week.week_start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(week.week_end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {week.is_holiday_or_break && (
                      <span className="flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-1 rounded-md">
                        <AlertCircle className="h-3.5 w-3.5" /> Holiday / Break
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{week.is_holiday_or_break ? 'Reason / Label' : 'Topic'}</p>
                    <p className="text-base font-medium text-slate-900">{week.topic || '—'}</p>
                  </div>

                  {!week.is_holiday_or_break && (
                    <>
                      {week.sub_topics && (
                        <div className="md:col-span-2">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Sub-Topics</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{week.sub_topics}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Planned Objectives</p>
                        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{week.planned_objectives || '—'}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Planned Activities</p>
                        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{week.planned_activities || '—'}</p>
                      </div>

                      {week.reference_materials && (
                        <div className="md:col-span-2 pt-2 border-t border-slate-50 mt-2">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Reference Materials</p>
                          <p className="text-sm text-slate-600 whitespace-pre-line">{week.reference_materials}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}