'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  lessonNotesAPI, materialSummariesAPI, flashcardSetsAPI,
  autoQuizzesAPI, ttsAudioAPI, aiAccessAPI, learningAISettingsAPI,
} from '@/lib/api';
import {
  ArrowLeft, BookOpen, CheckCircle, AlertCircle, Loader2, Edit3,
  Trash2, Send, ShieldCheck, X, Calendar, User, FileText, Download,
  Sparkles, Zap, Headphones, Layers, RotateCcw, Printer, Eye,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  pending_approval: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function absUrl(p: string | null | undefined): string {
  if (!p) return '';
  if (p.startsWith('http') || p.startsWith('blob:')) return p;
  return `${API_BASE}${p}`;
}

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\- ]/gi, '_').slice(0, 80) || 'note';
}

let _tid = 0;
interface Toast { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function fmtDateLong(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

type Tab = 'content' | 'summary' | 'flashcards' | 'quiz' | 'tts';

// ─── KaTeX loader (shared with MathInline) ─────────────────────────────────────
let _katexReady = false;
let _katexLoading: Promise<void> | null = null;

function loadKatex(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (_katexReady || (window as any).katex) { _katexReady = true; return Promise.resolve(); }
  if (_katexLoading) return _katexLoading;
  _katexLoading = new Promise((resolve) => {
    if (!document.querySelector('link[data-katex-css]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
      l.setAttribute('data-katex-css', '1');
      document.head.appendChild(l);
    }
    const existing = document.querySelector('script[data-katex]');
    if (existing) {
      const wait = setInterval(() => {
        if ((window as any).katex) { clearInterval(wait); _katexReady = true; resolve(); }
      }, 60);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
    s.setAttribute('data-katex', '1');
    s.onload = () => { _katexReady = true; resolve(); };
    document.head.appendChild(s);
  });
  return _katexLoading;
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function NoteDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [note, setNote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [learningSettings, setLearningSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('content');

  const [summary, setSummary] = useState<any>(null);
  const [flashcards, setFlashcards] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [tts, setTts] = useState<any>(null);

  const [isActioning, setIsActioning] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const contentRef = useRef<HTMLDivElement>(null);

  const canCreate = user?.is_superuser || hasPermission('learning_resources.add_lessonnotemodel');
  const canApprove = user?.is_superuser
    || hasPermission('learning_resources.approve_lesson_note')
    || hasPermission('learning_resources.decline_lesson_note');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const tid = ++_tid;
    setToasts(prev => [...prev, { id: tid, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4500);
  };

  // ── Data load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const [data, access, lSettings] = await Promise.all([
        lessonNotesAPI.get(Number(id)),
        aiAccessAPI.check('learning').catch(() => ({ enabled: false })),
        learningAISettingsAPI.getGlobal().catch(() => null),
      ]);
      setNote(data);
      setIsAIEnabled(!!(access as any)?.enabled);
      setLearningSettings(lSettings);

      if ((access as any)?.enabled) {
        const [sums, fcs, quizzes, ttss] = await Promise.all([
          materialSummariesAPI.list({ lesson_note: Number(id) }).catch(() => []),
          flashcardSetsAPI.list({}).catch(() => []),
          autoQuizzesAPI.list({}).catch(() => []),
          ttsAudioAPI.list({ lesson_note: Number(id) }).catch(() => []),
        ]);
        setSummary(Array.isArray(sums) ? sums[0] : null);
        setFlashcards(Array.isArray(fcs) ? fcs.find((x: any) => x.lesson_note === Number(id)) : null);
        setQuiz(Array.isArray(quizzes) ? quizzes.find((x: any) => x.lesson_note === Number(id)) : null);
        setTts(Array.isArray(ttss) ? ttss[0] : null);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Tab list, gated per-feature-flag ──────────────────────────────────────
  const visibleTabs = useMemo(() => {
    const list: { id: Tab; label: string; icon: any }[] = [
      { id: 'content', label: 'Content', icon: FileText },
    ];
    if (!isAIEnabled || !learningSettings) return list;
    const s = learningSettings;
    if (s.enable_auto_summary)           list.push({ id: 'summary',    label: 'Summary',    icon: Sparkles });
    if (s.enable_auto_flashcards)        list.push({ id: 'flashcards', label: 'Flashcards', icon: Layers });
    if (s.enable_auto_quiz_generation)   list.push({ id: 'quiz',       label: 'Quiz',       icon: Zap });
    if (s.enable_text_to_speech)         list.push({ id: 'tts',        label: 'Audio',      icon: Headphones });
    return list;
  }, [isAIEnabled, learningSettings]);

  // If active tab drops out of the visible list, fall back to content
  useEffect(() => {
    if (!visibleTabs.some(t => t.id === activeTab)) setActiveTab('content');
  }, [visibleTabs, activeTab]);

  // ── KaTeX post-render in the content tab ──────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'content') return;
    const el = contentRef.current;
    if (!el) return;
    const spans = el.querySelectorAll('.katex-inline[data-latex]');
    if (spans.length === 0) return;
    let cancelled = false;
    loadKatex().then(() => {
      if (cancelled) return;
      const katex = (window as any).katex;
      if (!katex) return;
      spans.forEach((span) => {
        const latex = span.getAttribute('data-latex');
        if (!latex) return;
        try {
          (span as HTMLElement).innerHTML = katex.renderToString(latex, { throwOnError: false });
        } catch { /* leave as-is */ }
      });
    });
    return () => { cancelled = true; };
  }, [activeTab, note, summary]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      await lessonNotesAPI.submit(Number(id));
      showToast('success', 'Note submitted for approval.');
      load();
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || 'Failed to submit.');
    }
  };

  const handleEditClick = async () => {
    if (!note) return;
    if (note.status === 'pending_approval') {
      try { await lessonNotesAPI.reopen(note.id); } catch { /* ignore */ }
    }
    router.push(`/dashboard/staff/learning/notes/${note.id}/edit`);
  };

  const handleReview = async (action: 'approve' | 'decline') => {
    if (action === 'decline' && !declineReason.trim()) {
      showToast('error', 'Decline reason is required.'); return;
    }
    setIsActioning(true);
    try {
      await lessonNotesAPI.review(Number(id), {
        action,
        decline_reason: action === 'decline' ? declineReason : undefined,
      });
      showToast('success', `Note ${action === 'approve' ? 'approved' : 'declined'}.`);
      setShowReviewModal(false); setDeclineReason('');
      load();
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || `Failed to ${action}.`);
    } finally { setIsActioning(false); }
  };

  const handleDelete = async () => {
    setIsActioning(true);
    try {
      await lessonNotesAPI.delete(Number(id));
      showToast('success', 'Note deleted.');
      router.push('/dashboard/staff/learning/notes');
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || 'Delete failed.');
      setIsActioning(false);
    }
  };

  const handleReopen = async () => {
    setIsActioning(true);
    try {
      await lessonNotesAPI.reopen(Number(id));
      showToast('success', 'Note reopened for editing.');
      setShowReopenModal(false);
      load();
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || 'Reopen failed.');
    } finally { setIsActioning(false); }
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await lessonNotesAPI.downloadPdf(Number(id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${safeFilename(note.title)}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { showToast('error', 'PDF download failed.'); }
  };

  const handleGenerate = async (type: 'summary' | 'tts') => {
    try {
      if (type === 'summary') await lessonNotesAPI.generateSummary(Number(id));
      if (type === 'tts') await lessonNotesAPI.generateTTS(Number(id));
      showToast('success', `${type === 'summary' ? 'Summary' : 'Audio'} generation queued. Refresh in a moment.`);
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || `${type} generation failed.`);
    }
  };

  const handleGenerateViaSummary = async (forWhat: 'flashcards' | 'quiz') => {
    try {
      await lessonNotesAPI.generateSummary(Number(id));
      showToast('success', `Generating a summary — ${forWhat} will follow. Refresh in a moment.`);
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || 'Generation failed.');
    }
  };

  const isAutoApproved = note?.status === 'approved' && !note?.approved_by;
  const isManualApproved = note?.status === 'approved' && !!note?.approved_by;
  const isAttachmentOnly = useMemo(() => {
    if (!note?.attachment) return false;
    const stripped = (note.content || '').replace(/<[^>]*>/g, '').trim();
    return stripped.length < 200 && !/<[a-z][\s\S]*>/i.test(note.content || '');
  }, [note]);

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
    </div>
  );

  if (error || !note) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <AlertCircle className="h-10 w-10 text-red-400 mb-4" />
      <h3 className="text-lg font-semibold text-slate-800">Failed to load note</h3>
      <button onClick={() => router.back()} className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700">Go back</button>
    </div>
  );

  const cfg = STATUS_CONFIG[note.status] || STATUS_CONFIG.draft;
  const attachmentUrl = absUrl(note.attachment);
  const attachmentName = note.attachment ? String(note.attachment).split('/').pop() : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10 px-4 sm:px-6 lg:px-8">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none print:hidden">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
            ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-red-50 border-red-200 text-red-900'}`}>
            {t.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
            <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Review modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6 flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-900">Review Note</h3>
                <p className="text-xs text-slate-500 truncate">{note.title}</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 -mx-1 px-1">
              {note.ai_vetting_score != null && (
                <div className="mb-3 p-3 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-800 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                  AI vetting score: <strong>{Math.round((note.ai_vetting_score || 0) * 100)}%</strong>
                </div>
              )}
              {note.ai_vetting_feedback && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">AI Feedback</p>
                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{note.ai_vetting_feedback}</p>
                </div>
              )}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Decline reason (required if declining)
                </label>
                <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)}
                  rows={3} placeholder="Explain what needs to change..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2">
              <button onClick={() => handleReview('decline')} disabled={isActioning || !declineReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-50 text-red-700 font-semibold text-sm rounded-xl border border-red-100 hover:bg-red-100 disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Decline'}
              </button>
              <button onClick={() => handleReview('approve')} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Delete note?</h3>
                <p className="text-xs text-slate-500 truncate">{note.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={isActioning}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleDelete} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold text-sm rounded-xl hover:bg-red-700 disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center">
                <RotateCcw className="h-4 w-4 text-orange-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">
                  {note.status === 'declined' ? 'Reopen for editing?' : 'Revert to draft?'}
                </h3>
                <p className="text-xs text-slate-500 truncate">{note.title}</p>
              </div>
            </div>
            {note.decline_reason && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                <strong className="block mb-0.5 font-semibold">Previous decline reason</strong>
                {note.decline_reason}
              </div>
            )}
            <p className="text-sm text-slate-600 mb-5">The note returns to draft and must be resubmitted for approval.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowReopenModal(false)} disabled={isActioning}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleReopen} disabled={isActioning}
                className="flex-1 px-4 py-2.5 bg-orange-600 text-white font-semibold text-sm rounded-xl hover:bg-orange-700 disabled:opacity-50">
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-3 print:hidden">
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors flex-shrink-0 mt-0.5">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900 leading-tight">{note.title}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              {note.creation_method === 'ai_generated' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                  <Sparkles className="h-2.5 w-2.5" /> AI
                </span>
              )}
              {note.grant_student_access && note.status === 'approved' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Eye className="h-2.5 w-2.5" /> Student Access
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pl-11">
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {note.created_by?.full_name || 'Unknown'} · {fmtDateLong(note.created_at)}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleDownloadPdf}
              className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" title="Download PDF">
              <Download className="h-4 w-4" />
            </button>
            <button onClick={() => window.print()}
              className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" title="Print">
              <Printer className="h-4 w-4" />
            </button>

            {note.status === 'draft' && canCreate && (
              <>
                <Link href={`/dashboard/staff/learning/notes/${note.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-amber-700 bg-amber-50 border border-amber-100 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors">
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </Link>
                <button onClick={() => setShowDeleteModal(true)}
                  className="p-2 text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={handleSubmit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
                  <Send className="h-3.5 w-3.5" /> Submit
                </button>
              </>
            )}

            {note.status === 'pending_approval' && (
              <>
                {canCreate && (
                  <button onClick={handleEditClick}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-amber-700 bg-amber-50 border border-amber-100 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors">
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {canApprove && (
                  <button onClick={() => setShowReviewModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                    <ShieldCheck className="h-3.5 w-3.5" /> Review
                  </button>
                )}
              </>
            )}

            {note.status === 'declined' && canCreate && (
              <>
                <button onClick={() => setShowReopenModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-orange-700 bg-orange-50 border border-orange-100 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen
                </button>
                <button onClick={() => setShowDeleteModal(true)}
                  className="p-2 text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}

            {isAutoApproved && canCreate && (
              <Link href={`/dashboard/staff/learning/notes/${note.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-amber-700 bg-amber-50 border border-amber-100 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors">
                <Edit3 className="h-3.5 w-3.5" /> Edit
              </Link>
            )}

            {isManualApproved && canApprove && (
              <button onClick={() => setShowReopenModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-orange-700 bg-orange-50 border border-orange-200 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Revert to Draft
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status banners */}
      {note.status === 'declined' && note.decline_reason && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 print:hidden">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-800">
              Declined by {note.declined_by?.full_name || 'Admin'} on {fmtDateLong(note.declined_at)}
            </h4>
            <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{note.decline_reason}</p>
          </div>
        </div>
      )}
      {note.status === 'draft' && note.declined_at && note.decline_reason && (
        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3 print:hidden">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-orange-800">Previously declined on {fmtDateLong(note.declined_at)}</h4>
            <p className="text-sm text-orange-700 mt-1 whitespace-pre-line">{note.decline_reason}</p>
          </div>
        </div>
      )}
      {note.status === 'pending_approval' && note.declined_at && note.decline_reason && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 print:hidden">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-800">Resubmission — previously declined on {fmtDateLong(note.declined_at)}</h4>
            <p className="text-sm text-blue-700 mt-1 whitespace-pre-line">{note.decline_reason}</p>
          </div>
        </div>
      )}
      {isManualApproved && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 print:hidden">
          <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
            Approved by {note.approved_by?.full_name || 'Admin'} on {fmtDateLong(note.approved_at)}
          </p>
        </div>
      )}
      {isAutoApproved && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 print:hidden">
          <Sparkles className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">Auto-approved — directly editable.</p>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Subject</p>
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" /> {note.subject?.name}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Class</p>
          <p className="text-sm font-semibold text-slate-800">
            {note.class_configurations_detail?.map((c: any) => c.name).join(', ') || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Session</p>
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" /> {note.session_name || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Term</p>
          <p className="text-sm font-semibold text-slate-800">{note.term_name || '—'}</p>
        </div>
        {note.topic && (
          <div className="md:col-span-4 pt-2 border-t border-slate-50">
            <p className="text-xs font-medium text-slate-400 mb-1">Topic</p>
            <p className="text-sm text-slate-700">{note.topic}</p>
          </div>
        )}
        {note.learning_objectives && (
          <div className="md:col-span-4 pt-2 border-t border-slate-50">
            <p className="text-xs font-medium text-slate-400 mb-1">Learning Objectives</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{note.learning_objectives}</p>
          </div>
        )}
        {note.instructional_materials && (
          <div className="md:col-span-4 pt-2 border-t border-slate-50">
            <p className="text-xs font-medium text-slate-400 mb-1">Instructional Materials</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{note.instructional_materials}</p>
          </div>
        )}
      </div>

      {/* Tabs — always visible, even with just Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {visibleTabs.map(({ id: tid, label, icon: Icon }) => (
            <button key={tid} onClick={() => setActiveTab(tid)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tid ? 'text-emerald-600 border-emerald-600'
                                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Content tab */}
          {activeTab === 'content' && (
            isAttachmentOnly ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Attached Document</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{attachmentName}</p>
                  {note.content && <p className="text-xs text-slate-500 mt-0.5">{note.content}</p>}
                </div>
                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" download
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex-shrink-0">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </div>
            ) : (
              <>
                <div ref={contentRef}
                  className="rich-content text-slate-800"
                  dangerouslySetInnerHTML={{ __html: note.content || '<p><em>No content.</em></p>' }} />
                {note.attachment && (
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
                      <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{attachmentName}</span>
                    </div>
                    <a href={attachmentUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex-shrink-0">
                      Download →
                    </a>
                  </div>
                )}
              </>
            )
          )}

          {/* Summary */}
          {activeTab === 'summary' && (
            summary ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{summary.summary_text}</p>
                {summary.key_points?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Key Points</p>
                    <ul className="space-y-1.5">
                      {summary.key_points.map((p: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-emerald-500 mt-0.5">•</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <EmptyAITab label="summary" buttonLabel="Generate Summary" onGenerate={() => handleGenerate('summary')} />
            )
          )}

          {/* Flashcards */}
          {activeTab === 'flashcards' && (
            flashcards ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-700">
                  Flashcard set generated with <strong>{flashcards.card_count ?? 0}</strong> cards.
                </p>
                <Link href={`/dashboard/staff/learning/flashcards?lesson_note=${note.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                  Open flashcard set →
                </Link>
              </div>
            ) : (
              <EmptyAITab
                label="flashcards"
                note="Flashcards are generated alongside summaries."
                buttonLabel="Generate via Summary"
                onGenerate={() => handleGenerateViaSummary('flashcards')}
              />
            )
          )}

          {/* Quiz */}
          {activeTab === 'quiz' && (
            quiz ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-700">
                  Quiz generated with <strong>{quiz.total_questions ?? 0}</strong> questions
                  {quiz.is_ready_for_attempts ? '' : ' (not yet imported for students)'}.
                </p>
                <Link href={`/dashboard/staff/learning/quizzes?lesson_note=${note.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                  Open quiz →
                </Link>
              </div>
            ) : (
              <EmptyAITab
                label="quiz"
                note="Quizzes are generated alongside summaries."
                buttonLabel="Generate via Summary"
                onGenerate={() => handleGenerateViaSummary('quiz')}
              />
            )
          )}

          {/* Audio (TTS) */}
          {activeTab === 'tts' && (
            tts ? (
              tts.status === 'completed' && tts.audio_file ? (
                <audio controls src={absUrl(tts.audio_file)} className="w-full" />
              ) : (
                <p className="text-sm text-slate-600">Audio is being generated. Check back shortly.</p>
              )
            ) : (
              <EmptyAITab label="audio" buttonLabel="Generate Audio" onGenerate={() => handleGenerate('tts')} />
            )
          )}
        </div>
      </div>

      {/* Print-only content fallback (visible when printing) */}
      <div className="hidden print:block">
        <div className="rich-content text-slate-900"
          dangerouslySetInnerHTML={{ __html: note.content || '' }} />
        {attachmentName && (
          <p className="mt-4 text-sm text-slate-500">Attachment: {attachmentName}</p>
        )}
      </div>
    </div>
  );
}

// ─── Empty AI tab ─────────────────────────────────────────────────────────────
function EmptyAITab({
  label, buttonLabel, note, onGenerate,
}: { label: string; buttonLabel: string; note?: string; onGenerate: () => void }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
        <Sparkles className="h-6 w-6 text-violet-500" />
      </div>
      <p className="text-sm text-slate-500 mb-1">No {label} generated yet.</p>
      {note ? <p className="text-xs text-slate-400 mb-4">{note}</p> : <div className="mb-3" />}
      <button onClick={onGenerate}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all">
        <Sparkles className="h-4 w-4" /> {buttonLabel}
      </button>
    </div>
  );
}