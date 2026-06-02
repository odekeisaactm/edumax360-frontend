'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { questionBanksAPI, academicAPI, topicsAPI } from '@/lib/api';
import { QuestionBank, QuestionBankFormValues, Subject, ClassModel, Topic } from '@/lib/types';
import {
  Library,
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  Search,
  Eye,
  BookMarked,
  GraduationCap,
  Target,
  ChevronDown,
  ChevronUp,
  Loader2,
  Hash,
  Layers,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────
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
function ConfirmModal({ open, bankName, isDeleting, onConfirm, onCancel }: {
  open: boolean; bankName: string; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Question Bank</h3>
        <p className="text-sm text-slate-500 text-center mb-2">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{bankName}"</span>?
        </p>
        <p className="text-xs text-red-500 text-center mb-6">This will also delete all questions in this bank and cannot be undone.</p>
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

// ─── Form Modal ───────────────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

function BankFormModal({ open, editing, subjects, classes, topics, onClose, onSave }: {
  open: boolean;
  editing: QuestionBank | null;
  subjects: Subject[];
  classes: ClassModel[];
  topics: Topic[];
  onClose: () => void;
  onSave: (data: QuestionBankFormValues) => Promise<void>;
}) {
  const [formData, setFormData] = useState<QuestionBankFormValues>({
    name: '', description: '', subject: 0, student_class: 0,
    topic: null, school_section: null, difficulty_level: 'medium', is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editing) {
        setFormData({
          name: editing.name,
          description: editing.description || '',
          subject: typeof editing.subject === 'object' ? (editing.subject as any).id : editing.subject,
          student_class: typeof editing.student_class === 'object' ? (editing.student_class as any).id : editing.student_class,
          topic: editing.topic ? (typeof editing.topic === 'object' ? (editing.topic as any).id : editing.topic) : null,
          school_section: editing.school_section ? (typeof editing.school_section === 'object' ? (editing.school_section as any).id : editing.school_section) : null,
          difficulty_level: editing.difficulty_level || 'medium',
          is_active: editing.is_active,
        });
      } else {
        setFormData({ name: '', description: '', subject: 0, student_class: 0, topic: null, school_section: null, difficulty_level: 'medium', is_active: true });
      }
      setError(null);
    }
  }, [open, editing]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!formData.name.trim()) { setError('Bank name is required.'); return; }
    if (!formData.subject) { setError('Please select a subject.'); return; }
    if (!formData.student_class) { setError('Please select a class.'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(formData);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter topics by selected subject/class in form
  const formTopics = topics.filter(t => {
    const tSubject = typeof t.subject === 'object' ? (t.subject as any).id : t.subject;
    const tClass = typeof t.student_class === 'object' ? (t.student_class as any).id : t.student_class;
    if (formData.subject && tSubject !== formData.subject) return false;
    if (formData.student_class && tClass !== formData.student_class) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Library className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{editing ? 'Edit Question Bank' : 'Add Question Bank'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{editing ? 'Update bank details' : 'Create a new question collection'}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSubmitting}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
              <span className="whitespace-pre-line">{error}</span>
            </div>
          )}

          <div>
            <label className={labelCls}>Bank Name <span className="text-red-500">*</span></label>
            <input type="text" value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Mathematics Mid-Term Questions"
              className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3} placeholder="Brief description of this question bank..."
              className={`${inputCls} resize-none`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Subject <span className="text-red-500">*</span></label>
              <select value={formData.subject || ''} className={inputCls}
                onChange={e => setFormData({ ...formData, subject: parseInt(e.target.value), topic: null })}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Class <span className="text-red-500">*</span></label>
              <select value={formData.student_class || ''} className={inputCls}
                onChange={e => setFormData({ ...formData, student_class: parseInt(e.target.value), topic: null })}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Topic <span className="text-slate-400 font-normal">(optional)</span></label>
              <select value={formData.topic || ''} className={inputCls}
                onChange={e => setFormData({ ...formData, topic: e.target.value ? parseInt(e.target.value) : null })}>
                <option value="">No specific topic</option>
                {formTopics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Difficulty Level</label>
              <select value={formData.difficulty_level || 'medium'} className={inputCls}
                onChange={e => setFormData({ ...formData, difficulty_level: e.target.value as any })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-700">Active</p>
              <p className="text-xs text-slate-400">Available for use in exams</p>
            </div>
            <button type="button" role="switch" aria-checked={formData.is_active}
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${formData.is_active ? 'bg-violet-600' : 'bg-slate-200'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${formData.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button onClick={onClose} disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="px-5 py-2 text-sm bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-violet-200">
            {isSubmitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" /> {editing ? 'Update Bank' : 'Create Bank'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────
function DifficultyBadge({ level }: { level?: string | null }) {
  if (!level) return null;
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QuestionBanksPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingBank, setDeletingBank] = useState<QuestionBank | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView   = user?.is_superuser || hasPermission('assessment_center.view_questionbankmodel');
  const canCreate = user?.is_superuser || hasPermission('assessment_center.add_questionbankmodel');
  const canEdit   = user?.is_superuser || hasPermission('assessment_center.change_questionbankmodel');
  const canDelete = user?.is_superuser || hasPermission('assessment_center.delete_questionbankmodel');

  // ── Toasts ──
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };
  const dismissToast = (id: number) => setToasts(p => p.filter(t => t.id !== id));

  // ── Fetch ──
  useEffect(() => {
    if (canView) fetchAll();
  }, [canView]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [banksData, subjectsData, classesData, topicsData] = await Promise.all([
        questionBanksAPI.list({}),
        academicAPI.listSubjects({ is_active: true }),
        academicAPI.listClasses({ is_active: true }),
        topicsAPI.list({}),
      ]);
      setQuestionBanks(banksData);
      setSubjects(subjectsData);
      setClasses(classesData);
      setTopics(topicsData);
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──
  const getId = (v: any) => typeof v === 'object' && v !== null ? v.id : v;

  // ── Filtered topics for filter bar (based on selected subject/class) ──
  const filteredTopicsForBar = topics.filter(t => {
    if (filterSubject && getId(t.subject) !== parseInt(filterSubject)) return false;
    if (filterClass && getId(t.student_class) !== parseInt(filterClass)) return false;
    return true;
  });

  // ── Filtered banks ──
  const filtered = questionBanks.filter(b => {
    if (searchTerm && !b.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(b.description || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterSubject && getId(b.subject) !== parseInt(filterSubject)) return false;
    if (filterClass && getId(b.student_class) !== parseInt(filterClass)) return false;
    if (filterTopic && getId(b.topic) !== parseInt(filterTopic)) return false;
    return true;
  });

  // ── Stats ──
  const totalQuestions = questionBanks.reduce((sum, b) => sum + (b.question_count || 0), 0);
  const activeBanks = questionBanks.filter(b => b.is_active).length;

  // ── Handlers ──
  const handleSave = async (data: QuestionBankFormValues) => {
    if (editingBank) {
      const updated = await questionBanksAPI.update(editingBank.id, data);
      setQuestionBanks(prev => prev.map(b => b.id === updated.id ? updated : b));
      showToast('success', 'Question bank updated successfully!');
      setShowForm(false);
      setEditingBank(null);
    } else {
      const created = await questionBanksAPI.create(data);
      setQuestionBanks(prev => [created, ...prev]);
      showToast('success', 'Question bank created! Redirecting...');
      setShowForm(false);
      setEditingBank(null);
      router.push(`/dashboard/staff/assessment/question-banks/${created.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deletingBank) return;
    setIsDeleting(true);
    try {
      await questionBanksAPI.delete(deletingBank.id);
      setQuestionBanks(prev => prev.filter(b => b.id !== deletingBank.id));
      showToast('success', `"${deletingBank.name}" deleted.`);
      setShowDeleteModal(false);
      setDeletingBank(null);
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
          <p className="text-slate-500">You don't have permission to view question banks.</p>
        </div>
      </div>
    );
  }

  // Exact column sizing guarantees alignment for headers and rows
  const gridClasses = "grid grid-cols-[minmax(0,1fr)_160px_160px_100px_120px_40px] items-center gap-4";

  return (
    <div className="space-y-6 pb-8">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={showDeleteModal}
        bankName={deletingBank?.name || ''}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteModal(false); setDeletingBank(null); }}
      />

      <BankFormModal
        open={showForm}
        editing={editingBank}
        subjects={subjects}
        classes={classes}
        topics={topics}
        onClose={() => { setShowForm(false); setEditingBank(null); }}
        onSave={handleSave}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <Library className="h-5 w-5 text-white" />
            </div>
            Question Banks
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Organize and manage question collections</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingBank(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200 hover:shadow-lg hover:-translate-y-0.5">
            <Plus className="h-4 w-4" />
            Add Question Bank
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Banks', value: questionBanks.length, icon: Library, color: 'violet' },
          { label: 'Active Banks', value: activeBanks, icon: Layers, color: 'purple' },
          { label: 'Total Questions', value: totalQuestions, icon: Hash, color: 'indigo' },
          { label: 'Subjects', value: new Set(questionBanks.map(b => getId(b.subject))).size, icon: BookMarked, color: 'fuchsia' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-${color}-50`}>
              <Icon className={`h-4 w-4 text-${color}-600`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide truncate">{label}</p>
              <p className="text-xl font-bold text-slate-900 leading-tight">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Search + Filters (GRID instead of flex-wrap) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-4 border-b border-slate-100">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search question banks..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
          </div>
          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterTopic(''); }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white truncate">
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterTopic(''); }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white truncate">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white truncate"
            disabled={filteredTopicsForBar.length === 0}>
            <option value="">All Topics</option>
            {filteredTopicsForBar.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>

        {/* Table wrapper for mobile scrolling */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Table header */}
            <div className={`${gridClasses} px-5 py-3 bg-slate-50/60 border-b border-slate-100`}>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Questions</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</span>
              <span></span>
            </div>

            {/* Rows */}
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading question banks...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <Library className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-500">
                  {searchTerm || filterSubject || filterClass || filterTopic ? 'No banks match your filters' : 'No question banks yet'}
                </p>
                {canCreate && !searchTerm && !filterSubject && !filterClass && !filterTopic && (
                  <button onClick={() => { setEditingBank(null); setShowForm(true); }}
                    className="mt-1 text-sm text-violet-600 font-semibold hover:text-violet-700 flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add your first question bank
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filtered.map(bank => {
                  const isExpanded = expandedId === bank.id;
                  return (
                    <div key={bank.id}>
                      <div className={`${gridClasses} px-5 py-4 hover:bg-slate-50/50 transition-colors`}>

                        {/* Bank name */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                            <Library className="h-4 w-4 text-violet-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-slate-900 truncate">{bank.name}</p>
                              {!bank.is_active && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md">INACTIVE</span>
                              )}
                            </div>
                            {bank.topic_title && (
                              <p className="text-xs text-slate-400 truncate">Topic: {bank.topic_title}</p>
                            )}
                          </div>
                        </div>

                        {/* Subject */}
                        <div className="min-w-0 truncate">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap">
                            {bank.subject_name || '—'}
                          </span>
                        </div>

                        {/* Class */}
                        <div className="min-w-0 truncate">
                          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full whitespace-nowrap">
                            {bank.class_name || '—'}
                          </span>
                        </div>

                        {/* Question count */}
                        <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {bank.question_count ?? 0} <span className="text-slate-400 font-normal text-xs">qs</span>
                        </span>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => router.push(`/dashboard/staff/assessment/question-banks/${bank.id}`)}
                            title="View questions"
                            className="p-2 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canEdit && (
                            <button onClick={() => { setEditingBank(bank); setShowForm(true); }} title="Edit"
                              className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => { setDeletingBank(bank); setShowDeleteModal(true); }} title="Delete"
                              className="p-2 rounded-lg text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Expand */}
                        <button onClick={() => setExpandedId(isExpanded ? null : bank.id)}
                          className="p-2 rounded-lg text-slate-400 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="ml-14 mr-5 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm space-y-3">
                          {bank.description && (
                            <div>
                              <p className="text-xs text-slate-400 font-medium mb-1">Description</p>
                              <p className="text-slate-700">{bank.description}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-slate-400 font-medium mb-1">Difficulty</p>
                              <DifficultyBadge level={bank.difficulty_level} />
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 font-medium mb-1">Status</p>
                              <span className={`text-xs font-semibold ${bank.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {bank.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 font-medium mb-1">Created</p>
                              <p className="text-slate-700">{new Date(bank.created_at).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 font-medium mb-1">Created By</p>
                              <p className="text-slate-700">{bank.created_by_name || '—'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
            <p className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of{' '}
              <span className="font-semibold text-slate-600">{questionBanks.length}</span> question banks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}