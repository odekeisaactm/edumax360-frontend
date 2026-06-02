'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { topicsAPI, academicAPI } from '@/lib/api';
import { Topic, TopicFormValues, Subject, ClassModel } from '@/lib/types';
import {
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  Tag,
  GraduationCap,
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
function ConfirmModal({ open, topicTitle, isDeleting, onConfirm, onCancel }: {
  open: boolean; topicTitle: string; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Topic</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{topicTitle}"</span>?
          This cannot be undone.
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

// ─── Topic Form Modal ─────────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

function TopicFormModal({ open, editing, subjects, classes, onClose, onSave }: {
  open: boolean;
  editing: Topic | null;
  subjects: Subject[];
  classes: ClassModel[];
  onClose: () => void;
  onSave: (data: TopicFormValues) => Promise<void>;
}) {
  const [formData, setFormData] = useState<TopicFormValues>({
    title: '', description: '', subject: 0, student_class: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editing) {
        setFormData({
          title: editing.title,
          description: editing.description || '',
          subject: typeof editing.subject === 'object' ? (editing.subject as any).id : editing.subject,
          student_class: typeof editing.student_class === 'object' ? (editing.student_class as any).id : editing.student_class,
        });
      } else {
        setFormData({ title: '', description: '', subject: 0, student_class: 0 });
      }
      setError(null);
    }
  }, [open, editing]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!formData.title.trim()) { setError('Topic title is required.'); return; }
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{editing ? 'Edit Topic' : 'Add Topic'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{editing ? 'Update topic details' : 'Create a new curriculum topic'}</p>
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
            <label className={labelCls}>Topic Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Quadratic Equations"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Brief description of what this topic covers..."
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Subject <span className="text-red-500">*</span></label>
              <select
                value={formData.subject || ''}
                onChange={e => setFormData({ ...formData, subject: parseInt(e.target.value) })}
                className={inputCls}
              >
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Class <span className="text-red-500">*</span></label>
              <select
                value={formData.student_class || ''}
                onChange={e => setFormData({ ...formData, student_class: parseInt(e.target.value) })}
                className={inputCls}
              >
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
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
              : <><Check className="h-4 w-4" /> {editing ? 'Update Topic' : 'Create Topic'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TopicsPage() {
  const { hasPermission, user } = useAuth();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView   = user?.is_superuser || hasPermission('assessment_center.view_topicmodel');
  const canCreate = user?.is_superuser || hasPermission('assessment_center.add_topicmodel');
  const canEdit   = user?.is_superuser || hasPermission('assessment_center.change_topicmodel');
  const canDelete = user?.is_superuser || hasPermission('assessment_center.delete_topicmodel');

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
      const [topicsData, subjectsData, classesData] = await Promise.all([
        topicsAPI.list({}),
        academicAPI.listSubjects({ is_active: true }),
        academicAPI.listClasses({ is_active: true }),
      ]);
      setTopics(topicsData);
      setSubjects(subjectsData);
      setClasses(classesData);
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──
  const getSubjectName = (subjectId: number | Subject): string => {
    if (typeof subjectId === 'object' && subjectId !== null) return (subjectId as any).name || 'Unknown';
    return subjects.find(s => s.id === subjectId)?.name || 'Unknown';
  };

  const getClassName = (classId: number | ClassModel): string => {
    if (typeof classId === 'object' && classId !== null) return (classId as any).name || 'Unknown';
    return classes.find(c => c.id === classId)?.name || 'Unknown';
  };

  const getSubjectId = (s: number | Subject): number =>
    typeof s === 'object' ? (s as any).id : s;

  const getClassId = (c: number | ClassModel): number =>
    typeof c === 'object' ? (c as any).id : c;

  // ── Filtered list ──
  const filtered = topics.filter(t => {
    if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(t.description || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterSubject && getSubjectId(t.subject) !== parseInt(filterSubject)) return false;
    if (filterClass && getClassId(t.student_class) !== parseInt(filterClass)) return false;
    return true;
  });

  // ── Stats ──
  const uniqueSubjects = new Set(topics.map(t => getSubjectId(t.subject))).size;
  const uniqueClasses  = new Set(topics.map(t => getClassId(t.student_class))).size;

  // ── Handlers ──
  const handleSave = async (data: TopicFormValues) => {
    if (editingTopic) {
      const updated = await topicsAPI.update(editingTopic.id, data);
      setTopics(prev => prev.map(t => t.id === updated.id ? updated : t));
      showToast('success', 'Topic updated successfully!');
    } else {
      const created = await topicsAPI.create(data);
      setTopics(prev => [created, ...prev]);
      showToast('success', 'Topic created successfully!');
    }
    setShowForm(false);
    setEditingTopic(null);
  };

  const handleDelete = async () => {
    if (!deletingTopic) return;
    setIsDeleting(true);
    try {
      await topicsAPI.delete(deletingTopic.id);
      setTopics(prev => prev.filter(t => t.id !== deletingTopic.id));
      showToast('success', `"${deletingTopic.title}" deleted.`);
      setShowDeleteModal(false);
      setDeletingTopic(null);
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Access denied ──
  if (!canView) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">You don't have permission to view topics.</p>
        </div>
      </div>
    );
  }

  // Exact column sizing guarantees alignment for headers and rows
  const gridClasses = "grid grid-cols-[minmax(0,1fr)_180px_140px_90px_40px] items-center gap-4";

  return (
    <div className="space-y-6 pb-8">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={showDeleteModal}
        topicTitle={deletingTopic?.title || ''}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteModal(false); setDeletingTopic(null); }}
      />

      <TopicFormModal
        open={showForm}
        editing={editingTopic}
        subjects={subjects}
        classes={classes}
        onClose={() => { setShowForm(false); setEditingTopic(null); }}
        onSave={handleSave}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            Topics
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Organize curriculum topics for question management</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingTopic(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200 hover:shadow-lg hover:-translate-y-0.5">
            <Plus className="h-4 w-4" />
            Add Topic
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
        { label: 'Total Topics', value: topics.length, icon: BookOpen, color: 'violet' },
          { label: 'Subjects Covered', value: uniqueSubjects, icon: Tag, color: 'purple' },
          { label: 'Classes Covered', value: uniqueClasses, icon: GraduationCap, color: 'indigo' },
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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3 px-5 py-4 border-b border-slate-100">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search topics..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-slate-700 bg-white">
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-slate-700 bg-white">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Table header */}
          <div className={`${gridClasses} px-5 py-3 bg-slate-50/60 border-b border-slate-100`}>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Topic</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</span>
            <span></span>
          </div>

          {/* Rows */}
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading topics...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                <BookOpen className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {searchTerm || filterSubject || filterClass ? 'No topics match your filters' : 'No topics yet'}
              </p>
              {canCreate && !searchTerm && !filterSubject && !filterClass && (
                <button onClick={() => { setEditingTopic(null); setShowForm(true); }}
                  className="mt-1 text-sm text-violet-600 font-semibold hover:text-violet-700 flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add your first topic
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(topic => {
                const isExpanded = expandedId === topic.id;
                return (
                  <div key={topic.id}>
                    <div className={`${gridClasses} px-5 py-4 hover:bg-slate-50/50 transition-colors`}>

                      {/* Topic name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                          <Layers className="h-4 w-4 text-violet-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{topic.title}</p>
                          {topic.created_by_name && (
                            <p className="text-xs text-slate-400 truncate">by {topic.created_by_name}</p>
                          )}
                        </div>
                      </div>

                      {/* Subject badge */}
                      <div className="min-w-0 truncate">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap">
                          {getSubjectName(topic.subject)}
                        </span>
                      </div>

                      {/* Class badge */}
                      <div className="min-w-0 truncate">
                        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full whitespace-nowrap">
                          {getClassName(topic.student_class)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button onClick={() => { setEditingTopic(topic); setShowForm(true); }} title="Edit"
                            className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => { setDeletingTopic(topic); setShowDeleteModal(true); }} title="Delete"
                            className="p-2 rounded-lg text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Expand toggle */}
                      <div>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                          className="p-2 rounded-lg text-slate-400 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all w-full flex justify-center">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="ml-14 mr-5 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                        <div className="mb-4 pb-3 border-b border-slate-200/60">
                          <p className="text-xs text-slate-400 font-medium mb-1">Full Topic Title</p>
                          <p className="text-slate-800 font-medium">{topic.title}</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-slate-400 font-medium mb-1">Description</p>
                            <p className="text-slate-700">{topic.description || <span className="italic text-slate-400">No description</span>}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-medium mb-1">Created</p>
                            <p className="text-slate-700">{new Date(topic.created_at).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-medium mb-1">Last Updated</p>
                            <p className="text-slate-700">{new Date(topic.updated_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of{' '}
                <span className="font-semibold text-slate-600">{topics.length}</span> topics
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}