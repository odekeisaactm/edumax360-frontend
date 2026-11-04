'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { questionsAPI, api, topicsAPI } from '@/lib/api';
import { Question, Topic } from '@/lib/types';
import {
  FileQuestion,
  Search,
  Eye,
  Edit3,
  Trash2,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Target,
  Loader2,
  Hash,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BookMarked,
  GraduationCap,
  Library,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AllowedClass {
  id: number;
  name: string;
  subjects: { id: number; name: string }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.error) return String(d.error);
    if (d.message) return String(d.message);
    if (d.non_field_errors?.length) return d.non_field_errors[0];
    if (typeof d === 'object') {
      const msgs = Object.entries(d)
        .map(([f, v]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ─────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug whitespace-pre-line">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmModal({ open, isDeleting, onConfirm, onCancel }: {
  open: boolean; isDeleting: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Question</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete this question? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────
function DifficultyBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    hard: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${map[level] || map.medium}`}>
      <Target className="h-3 w-3" />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function QuestionTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    objective:  'bg-blue-50 text-blue-700 border-blue-100',
    theory:     'bg-purple-50 text-purple-700 border-purple-100',
    subjective: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    true_false: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    fill_blank: 'bg-amber-50 text-amber-700 border-amber-100',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${map[type] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
      {type.replace('_', ' ')}
    </span>
  );
}

// ─── Question Row (Simplified Grid Layout) ──────────────────────────────────────
function QuestionRow({ question, bankName, subjectName, className, index, canEdit, canDelete, onViewBank, onEdit, onDelete }: {
  question: Question; bankName: string; subjectName: string; className: string; index: number;
  canEdit: boolean; canDelete: boolean;
  onViewBank: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isObjective = question.question_type === 'objective';
  const isTrueFalse = question.question_type === 'true_false';
  const isWritten = !isObjective && !isTrueFalse;

  return (
    <div className="border-b border-slate-50 last:border-0">
      {/* 3-Column Grid: Details (1fr) | Actions (110px) | Expand (40px) */}
      <div className="grid grid-cols-[minmax(0,1fr)_110px_40px] items-start gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

        {/* Main Content (Question + Badges) */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {question.question_number && (
              <span className="text-xs font-bold text-slate-600">
                Q{question.question_number}{question.sub_question_number || ''}
              </span>
            )}
            <QuestionTypeBadge type={question.question_type} />
            <DifficultyBadge level={question.difficulty_level} />
            <span className="text-xs text-slate-400">{question.max_mark} mark{parseFloat(question.max_mark.toString()) !== 1 ? 's' : ''}</span>
          </div>

          <p className="text-sm text-slate-800 leading-relaxed line-clamp-2 mb-2">{question.question_text}</p>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 text-violet-700 text-[10px] font-semibold rounded-md border border-violet-100 max-w-[200px] truncate">
              <Library className="h-3 w-3 flex-shrink-0" /> {bankName || '—'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-md border border-blue-100 whitespace-nowrap">
              <BookMarked className="h-3 w-3 flex-shrink-0" /> {subjectName || '—'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 text-[10px] font-semibold rounded-md border border-purple-100 whitespace-nowrap">
              <GraduationCap className="h-3 w-3 flex-shrink-0" /> {className || '—'}
            </span>
          </div>

          {/* Inline Answer Display */}
          {isTrueFalse && (
            <p className="text-xs mt-1">
              <span className="text-slate-400">Answer: </span>
              <span className={`font-semibold ${question.correct_answer === 'True' ? 'text-emerald-600' : 'text-red-500'}`}>
                {question.correct_answer}
              </span>
            </p>
          )}
          {isObjective && question.correct_answer && (
            <p className="text-xs mt-1">
              <span className="text-slate-400">Correct: </span>
              <span className="font-semibold text-emerald-600">{question.correct_answer}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-0.5">
          <button onClick={onViewBank} title="View in bank"
            className="p-2 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
            <Eye className="h-3.5 w-3.5" />
          </button>
          {canEdit && (
            <button onClick={onEdit} title="Edit question"
              className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} title="Delete question"
              className="p-2 rounded-lg text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Expand */}
        <div className="flex justify-end pt-0.5">
          <button onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg text-slate-400 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="ml-5 mr-5 mb-4 space-y-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed">
            {question.question_text}
          </div>

          {isObjective && question.options && (
            <div className="space-y-1.5">
              {Object.entries(question.options).map(([key, val]) => (
                <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${
                  question.correct_answer === key ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    question.correct_answer === key ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{key}</div>
                  <span className="text-sm text-slate-700 flex-1">{val}</span>
                  {question.correct_answer === key && <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                </div>
              ))}
            </div>
          )}

          {isWritten && question.model_answer && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs font-semibold text-blue-700 mb-1">Model Answer</p>
              <p className="text-sm text-blue-800">{question.model_answer}</p>
            </div>
          )}

          {question.keywords && question.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-400 font-medium">Keywords:</span>
              {question.keywords.map((kw, i) => (
                <span key={i} className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 rounded-full text-xs font-semibold">{kw}</span>
              ))}
            </div>
          )}

          {question.diagram_url && (
            <img src={question.diagram_url} alt="Question diagram"
              className="max-h-48 rounded-xl border border-slate-200 object-contain" />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type QType = 'objective' | 'theory' | 'subjective' | 'true_false' | 'fill_blank';
const TYPE_ORDER: QType[] = ['objective', 'theory', 'subjective', 'true_false', 'fill_blank'];
const TYPE_LABELS: Record<QType, string> = {
  objective: 'Objective', theory: 'Theory', subjective: 'Subjective',
  true_false: 'True / False', fill_blank: 'Fill in Blank',
};

export default function AllQuestionsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const [mounted, setMounted] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [allowedClasses, setAllowedClasses] = useState<AllowedClass[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Filters
  const [filterSubject, setFilterSubject] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');

  // Search with debounce
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [activeTab, setActiveTab] = useState<string>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView   = user?.is_superuser || hasPermission('assessment_center.view_questionmodel');
  const canEdit   = user?.is_superuser || hasPermission('assessment_center.change_questionmodel');
  const canDelete = user?.is_superuser || hasPermission('assessment_center.delete_questionmodel');

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Toast Helpers ──
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };
  const dismissToast = (id: number) => setToasts(p => p.filter(t => t.id !== id));

  // ── Debounce Search ──
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // ── Initial Setup (Fetch classes, topics) ──
  useEffect(() => {
    if (!mounted || !canView) return;

    const initData = async () => {
      try {
        const [uploadableRes, classesRes, topicsData] = await Promise.all([
          api.get('/api/academic/class-subjects/uploadable/', { params: { result_type: 'score' } }),
          api.get('/api/academic/classes/', { params: { is_active: true } }),
          topicsAPI.list({}),
        ]);

        setTopics(topicsData);

        // Process allowed classes & subjects (for filters)
        const rawClasses = uploadableRes.data?.data?.classes || [];
        const baseClasses = classesRes.data?.data || classesRes.data || [];

        const grouped = new Map<string, AllowedClass>();
        rawClasses.forEach((cls: any) => {
          const cName = cls.class_name;
          const baseClass = baseClasses.find((c: any) => c.name === cName);
          const classId = baseClass ? baseClass.id : cls.student_class_id;

          if (!grouped.has(cName)) {
            grouped.set(cName, { id: classId, name: cName, subjects: [] });
          }

          const g = grouped.get(cName)!;
          cls.subjects.forEach((sub: any) => {
            if (!g.subjects.some(s => s.id === sub.id)) {
              g.subjects.push({ id: sub.id, name: sub.name });
            }
          });
        });

        const allowed = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
        allowed.forEach(a => a.subjects.sort((x, y) => x.name.localeCompare(y.name)));
        setAllowedClasses(allowed);

      } catch (err) {
        console.error('Failed to load filter options', err);
      }
    };

    initData();
  }, [mounted, canView]);

  // ── Fetch Questions (Backend Filtered) ──
  const fetchQuestions = useCallback(async () => {
    if (!mounted || !canView) return;
    setLoading(true);
    setPageError(null);

    const filters: Record<string, any> = {};
    if (filterDifficulty) filters.difficulty_level = filterDifficulty;
    if (filterSubject)    filters['question_bank__subject'] = filterSubject;
    if (filterClass)      filters['question_bank__student_class'] = filterClass;
    if (filterTopic)      filters['question_bank__topic'] = filterTopic;
    if (debouncedSearch)  filters.search = debouncedSearch;

    try {
      const data = await questionsAPI.list(filters);
      setQuestions(data);
    } catch (err: any) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [mounted, canView, filterDifficulty, filterSubject, filterClass, filterTopic, debouncedSearch]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // ── Derived Values ──
  const getId = (v: any): number | null => typeof v === 'object' && v !== null ? v.id : (v ?? null);

  const filteredTopics = topics.filter(t => {
    if (filterSubject && getId(t.subject) !== parseInt(filterSubject)) return false;
    if (filterClass && getId(t.student_class) !== parseInt(filterClass)) return false;
    return true;
  });

  const presentTypes = TYPE_ORDER.filter(t => questions.some(q => q.question_type === t));
  const tabs = [
    { key: 'all', label: 'All', count: questions.length },
    ...presentTypes.map(t => ({ key: t, label: TYPE_LABELS[t], count: questions.filter(q => q.question_type === t).length })),
  ];

  const safeTab = tabs.find(t => t.key === activeTab) ? activeTab : 'all';
  const visibleQuestions = safeTab === 'all' ? questions : questions.filter(q => q.question_type === safeTab);

  const totalMarks = questions.reduce((sum, q) => sum + parseFloat(q.max_mark?.toString() || '0'), 0);

  // Static Tailwind classes for stat chips
  const statCards = [
    { label: 'Total Questions', value: questions.length, icon: FileQuestion, bg: 'bg-violet-50', text: 'text-violet-600' },
    { label: 'Objective', value: questions.filter(q => q.question_type === 'objective').length, icon: CheckCircle2, bg: 'bg-blue-50', text: 'text-blue-600' },
    { label: 'Theory / Written', value: questions.filter(q => q.question_type === 'theory' || q.question_type === 'subjective').length, icon: Hash, bg: 'bg-purple-50', text: 'text-purple-600' },
    { label: 'Total Marks', value: totalMarks, icon: Target, bg: 'bg-amber-50', text: 'text-amber-600' },
  ];

  // ── Handlers ──
  const handleDelete = async () => {
    if (!deletingQuestion) return;
    setIsDeleting(true);
    try {
      await questionsAPI.delete(deletingQuestion.id);
      setQuestions(prev => prev.filter(q => q.id !== deletingQuestion.id));
      showToast('success', 'Question deleted.');
      setShowDeleteModal(false);
      setDeletingQuestion(null);
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">You don't have permission to view questions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={showDeleteModal}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteModal(false); setDeletingQuestion(null); }}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <FileQuestion className="h-5 w-5 text-white" />
            </div>
            All Questions
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Browse and manage questions across all banks</p>
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
              <Icon className={`h-4 w-4 ${text}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide truncate">{label}</p>
              <p className="text-xl font-bold text-slate-900 leading-tight">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
        <div className="min-w-[750px]">

          {/* Search + Filters */}
          <div className="flex flex-col gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search questions..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
              </div>
              <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterTopic(''); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white truncate max-w-[160px]">
                <option value="">All Classes</option>
                {allowedClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterTopic(''); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white truncate max-w-[160px]">
                <option value="">All Subjects</option>
                {Array.from(new Map(allowedClasses.flatMap(c => c.subjects).map(s => [s.id, s])).values()).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white truncate max-w-[160px]"
                disabled={filteredTopics.length === 0}>
                <option value="">All Topics</option>
                {filteredTopics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white">
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              {(filterSubject || filterClass || filterTopic || filterDifficulty || searchTerm) && (
                <button onClick={() => {
                    setFilterSubject(''); setFilterClass(''); setFilterTopic('');
                    setFilterDifficulty(''); setSearchTerm('');
                  }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              )}
              <button onClick={fetchQuestions} className="p-2 ml-auto rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          {!loading && questions.length > 0 && (
            <div className="flex items-center gap-0.5 px-4 pt-3 pb-0 border-b border-slate-100 overflow-x-auto">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap border-b-2 transition-colors -mb-px
                    ${safeTab === tab.key
                      ? 'border-violet-600 text-violet-700 bg-violet-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold leading-none
                    ${safeTab === tab.key ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Table header */}
          {!loading && visibleQuestions.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_110px_40px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Question Details</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</span>
              <span></span>
            </div>
          )}

          {/* Rows */}
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading questions...</span>
            </div>
          ) : pageError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
               <AlertCircle className="h-8 w-8 text-red-400" />
               <p className="text-sm text-red-600 max-w-sm text-center">{pageError}</p>
               <button onClick={fetchQuestions} className="mt-2 text-sm text-violet-600 font-semibold flex items-center gap-1 hover:text-violet-700">
                 <RefreshCw className="h-3.5 w-3.5" /> Try Again
               </button>
            </div>
          ) : visibleQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                <FileQuestion className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {searchTerm || filterSubject || filterClass || filterTopic || filterDifficulty
                  ? 'No questions match your filters'
                  : 'No questions yet'}
              </p>
              <p className="text-xs text-slate-400">Questions appear here once added to question banks</p>
            </div>
          ) : (
            <div>
              {visibleQuestions.map((q, i) => {
                const bankId = getId(q.question_bank);
                return (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    bankName={(q as any).question_bank_name || '—'}
                    subjectName={(q as any).subject_name || '—'}
                    className={(q as any).class_name || '—'}
                    index={i}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onViewBank={() => bankId && router.push(`/dashboard/staff/assessment/question-banks/${bankId}`)}
                    onEdit={() => bankId && router.push(`/dashboard/staff/assessment/question-banks/${bankId}?edit=${q.id}`)}
                    onDelete={() => { setDeletingQuestion(q); setShowDeleteModal(true); }}
                  />
                );
              })}
            </div>
          )}

          {/* Footer */}
          {!loading && !pageError && visibleQuestions.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-600">{visibleQuestions.length}</span> of{' '}
                <span className="font-semibold text-slate-600">{questions.length}</span> questions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}