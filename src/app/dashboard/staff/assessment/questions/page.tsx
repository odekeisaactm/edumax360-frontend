'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { questionsAPI, academicAPI, topicsAPI } from '@/lib/api';
import { Question, QuestionBank, Subject, ClassModel, Topic } from '@/lib/types';
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
  BookMarked,
  GraduationCap,
  Target,
  Library,
  Loader2,
  Hash,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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

// ─── Question Row ─────────────────────────────────────────────────────────────
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
      <div className="grid grid-cols-[1fr_auto_auto_auto_88px_36px] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

        {/* Question text + badges */}
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
          <p className="text-sm text-slate-800 leading-relaxed line-clamp-2">{question.question_text}</p>
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

        {/* Bank name */}
        <span className="px-2.5 py-1 bg-violet-50 text-violet-700 text-xs font-semibold rounded-full whitespace-nowrap max-w-[160px] truncate">
          {bankName || '—'}
        </span>

        {/* Subject */}
        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap">
          {subjectName || '—'}
        </span>

        {/* Class */}
        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full whitespace-nowrap">
          {className || '—'}
        </span>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1">
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
        <button onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-lg text-slate-400 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
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

// ─── Question type tab config ─────────────────────────────────────────────────
type QType = 'objective' | 'theory' | 'subjective' | 'true_false' | 'fill_blank';
const TYPE_ORDER: QType[] = ['objective', 'theory', 'subjective', 'true_false', 'fill_blank'];
const TYPE_LABELS: Record<QType, string> = {
  objective: 'Objective', theory: 'Theory', subjective: 'Subjective',
  true_false: 'True / False', fill_blank: 'Fill in Blank',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AllQuestionsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterSubject, setFilterSubject] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView   = user?.is_superuser || hasPermission('assessment_center.view_questionmodel');
  const canEdit   = user?.is_superuser || hasPermission('assessment_center.change_questionmodel');
  const canDelete = user?.is_superuser || hasPermission('assessment_center.delete_questionmodel');

  // ── Toasts ──
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };
  const dismissToast = (id: number) => setToasts(p => p.filter(t => t.id !== id));

  // ── Initial load ──
  useEffect(() => {
    if (canView) fetchAll();
  }, [canView]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [qData, subjectsData, classesData, topicsData] = await Promise.all([
        questionsAPI.list({}),
        academicAPI.listSubjects({ is_active: true }),
        academicAPI.listClasses({ is_active: true }),
        topicsAPI.list({}),
      ]);
      setQuestions(qData);
      setSubjects(subjectsData);
      setClasses(classesData);
      setTopics(topicsData);
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Refetch questions whenever any server-side filter changes ──
  // All filters go to the backend — no client-side filtering at all.
  // Param names match filterset_fields on QuestionViewSet:
  //   question_bank, question_type (handled by tab), difficulty_level,
  //   question_bank__subject, question_bank__student_class, question_bank__topic
  useEffect(() => {
    if (!canView || loading) return;
    const filters: Record<string, any> = {};
    if (filterDifficulty) filters.difficulty_level = filterDifficulty;
    if (filterSubject)    filters['question_bank__subject'] = filterSubject;
    if (filterClass)      filters['question_bank__student_class'] = filterClass;
    if (filterTopic)      filters['question_bank__topic'] = filterTopic;

    questionsAPI.list(filters)
      .then(data => setQuestions(data))
      .catch(err => showToast('error', extractError(err)));
  }, [filterDifficulty, filterSubject, filterClass, filterTopic]);

  // ── Filter topics dropdown based on selected subject/class ──
  const getId = (v: any): number | null => typeof v === 'object' && v !== null ? v.id : (v ?? null);
  const filteredTopics = topics.filter(t => {
    if (filterSubject && getId(t.subject) !== parseInt(filterSubject)) return false;
    if (filterClass && getId(t.student_class) !== parseInt(filterClass)) return false;
    return true;
  });

  // ── Client-side: search only (text match on already-fetched page) ──
  const searched = !searchTerm ? questions : questions.filter(q => {
    const s = searchTerm.toLowerCase();
    return q.question_text.toLowerCase().includes(s) ||
      (q.question_number?.toString() || '').includes(s) ||
      (q.sub_question_number || '').toLowerCase().includes(s) ||
      ((q as any).question_bank_name || '').toLowerCase().includes(s);
  });

  // ── Tabs: only show types that exist in current result set ──
  const presentTypes = TYPE_ORDER.filter(t => searched.some(q => q.question_type === t));
  const tabs = [
    { key: 'all', label: 'All', count: searched.length },
    ...presentTypes.map(t => ({ key: t, label: TYPE_LABELS[t], count: searched.filter(q => q.question_type === t).length })),
  ];
  const safeTab = tabs.find(t => t.key === activeTab) ? activeTab : 'all';
  const visibleQuestions = safeTab === 'all' ? searched : searched.filter(q => q.question_type === safeTab);

  // ── Stats ──
  const totalMarks = questions.reduce((sum, q) => sum + parseFloat(q.max_mark?.toString() || '0'), 0);

  // ── Delete ──
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
        {[
          { label: 'Total Questions', value: loading ? '—' : questions.length, icon: FileQuestion, color: 'violet' },
          { label: 'Objective', value: loading ? '—' : questions.filter(q => q.question_type === 'objective').length, icon: CheckCircle2, color: 'blue' },
          { label: 'Theory / Written', value: loading ? '—' : questions.filter(q => q.question_type === 'theory' || q.question_type === 'subjective').length, icon: Hash, color: 'purple' },
          { label: 'Total Marks', value: loading ? '—' : totalMarks, icon: Target, color: 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-${color}-50`}>
              <Icon className={`h-4 w-4 text-${color}-600`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide truncate">{label}</p>
              <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Search + Filters */}
        <div className="flex flex-col gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search questions..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
            </div>
            <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterTopic(''); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white">
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterTopic(''); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white"
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
          <div className="grid grid-cols-[1fr_auto_auto_auto_88px_36px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Question</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            <span></span>
          </div>
        )}

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading questions...</span>
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
              const bankId = typeof q.question_bank === 'object' ? (q.question_bank as any).id : q.question_bank;
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
        {!loading && visibleQuestions.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
            <p className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-600">{visibleQuestions.length}</span> of{' '}
              <span className="font-semibold text-slate-600">{questions.length}</span> questions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}