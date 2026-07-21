// app/dashboard/staff/academic/subjects/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, academicCalendarAPI } from '@/lib/api';
import { Subject, SchoolSection } from '@/lib/types';
import {
  BookOpen, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, ChevronDown, ChevronUp,
  Building, Loader2, RefreshCw, FlaskConical, Layers,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([, v]) => (Array.isArray(v) ? v[0] : String(v)))
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
    if (d.non_field_errors?.length) return d.non_field_errors[0];
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
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

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({ open, subject, isDeleting, onConfirm, onCancel }: {
  open: boolean; subject: Subject | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !subject) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Subject</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete <span className="font-semibold text-slate-700">"{subject.name}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Type Badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: 'theory' | 'practical' | 'combined' }) {
  const map = {
    theory: { cls: 'bg-blue-50 text-blue-700 border-blue-100', label: 'Theory' },
    practical: { cls: 'bg-purple-50 text-purple-700 border-purple-100', label: 'Practical' },
    combined: { cls: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Combined' },
  };
  const { cls, label } = map[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Form Values ───────────────────────────────────────────────────────────────
interface FormValues {
  name: string;
  code: string;
  school_section: number | null;
  subject_type: 'theory' | 'practical' | 'combined';
  description: string;
  is_active: boolean;
}

const defaultForm: FormValues = {
  name: '', code: '', school_section: null,
  subject_type: 'theory', description: '', is_active: true,
};

// ─── Subject Form Modal ────────────────────────────────────────────────────────
function SubjectModal({ editing, schoolSections, isSaving, onSave, onClose }: {
  editing: Subject | null;
  schoolSections: SchoolSection[];
  isSaving: boolean;
  onSave: (data: FormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormValues>(
    editing ? {
      name: editing.name,
      code: editing.code,
      school_section: typeof editing.school_section === 'object'
        ? editing.school_section?.id ?? null
        : editing.school_section ?? null,
      subject_type: editing.subject_type,
      description: editing.description || '',
      is_active: editing.is_active,
    } : { ...defaultForm }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {editing ? 'Edit Subject' : 'Add New Subject'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        )}

        <form id="subject-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

            {/* School Section */}
            <div>
              <label className={labelCls}>School Section</label>
              <select value={form.school_section ?? ''} onChange={e => set('school_section', e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                <option value="">All Sections (Global)</option>
                {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">Leave blank for subjects available to all sections</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Subject Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Mathematics" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Subject Code <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="e.g. MATH" className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Auto-uppercased</p>
              </div>
            </div>

            <div>
              <label className={labelCls}>Subject Type <span className="text-red-400 normal-case">*</span></label>
              <select required value={form.subject_type} onChange={e => set('subject_type', e.target.value as any)} className={inputCls}>
                <option value="theory">Theory</option>
                <option value="practical">Practical</option>
                <option value="combined">Combined (Theory + Practical)</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} placeholder="Brief description of the subject" className={inputCls} />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-800">Active</p>
                <p className="text-xs text-slate-400">Subject is available for assignment</p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active}
                onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="subject-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Subject' : 'Create Subject'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SubjectsPage() {
  const { hasPermission, user } = useAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schoolSections, setSchoolSections] = useState<SchoolSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolSection, setSelectedSchoolSection] = useState<number | ''>('');
  const [selectedType, setSelectedType] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView = user?.is_superuser || hasPermission('academic_structure.view_academic_setup');
  const canCreate = user?.is_superuser || hasPermission('academic_structure.manage_academic_setup');
  const canEdit = user?.is_superuser || hasPermission('academic_structure.manage_academic_setup');
  const canDelete = user?.is_superuser || hasPermission('academic_structure.manage_academic_setup');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [subjectsData, sectionsData] = await Promise.all([
        academicAPI.listSubjects(),
        academicCalendarAPI.listSchoolSections(),
      ]);
      setSubjects(subjectsData);
      setSchoolSections(sectionsData);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (canView) fetchData(); }, [canView, fetchData]);

  const handleSave = async (data: FormValues) => {
    setIsSaving(true);
    try {
      const payload = { ...data, school_section: data.school_section ?? undefined };
      if (editingSubject) {
        const updated = await academicAPI.updateSubject(editingSubject.id, payload as any);
        setSubjects(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast('success', 'Subject updated successfully');
      } else {
        const created = await academicAPI.createSubject(payload as any);
        setSubjects(prev => [created, ...prev]);
        showToast('success', 'Subject created successfully');
      }
      setShowModal(false);
      setEditingSubject(null);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingSubject) return;
    setIsDeleting(true);
    try {
      await academicAPI.deleteSubject(deletingSubject.id);
      setSubjects(prev => prev.filter(s => s.id !== deletingSubject.id));
      showToast('success', 'Subject deleted successfully');
      setDeletingSubject(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingSubject(null);
    } finally { setIsDeleting(false); }
  };

  const getSchoolSectionName = (val: number | SchoolSection | null | undefined): string => {
    if (!val) return 'All Sections';
    if (typeof val === 'object') return val.name;
    return schoolSections.find(s => s.id === val)?.name || 'Unknown';
  };

  const filtered = subjects.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSection = !selectedSchoolSection ||
      (typeof s.school_section === 'object' ? s.school_section?.id === selectedSchoolSection : s.school_section === selectedSchoolSection);
    const matchType = !selectedType || s.subject_type === selectedType;
    const matchActive = !showActiveOnly || s.is_active;
    return matchSearch && matchSection && matchType && matchActive;
  });

  // ── Stat counts ──
  const activeCount = subjects.filter(s => s.is_active).length;
  const theoryCount = subjects.filter(s => s.subject_type === 'theory').length;
  const practicalCount = subjects.filter(s => s.subject_type === 'practical').length;
  const combinedCount = subjects.filter(s => s.subject_type === 'combined').length;

  if (!canView) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 text-sm">You don't have permission to view subjects.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDeleteModal
        open={!!deletingSubject} subject={deletingSubject} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingSubject(null)}
      />

      {showModal && (
        <SubjectModal
          editing={editingSubject} schoolSections={schoolSections}
          isSaving={isSaving} onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingSubject(null); }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            Subjects
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Manage academic subjects across school sections</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditingSubject(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Subject
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Subjects', value: subjects.length, icon: BookOpen, color: 'from-blue-500 to-blue-600' },
          { label: 'Active', value: activeCount, icon: Check, color: 'from-emerald-500 to-teal-600' },
          { label: 'Theory', value: theoryCount, icon: BookOpen, color: 'from-violet-500 to-purple-600' },
          { label: 'Practical / Combined', value: practicalCount + combinedCount, icon: FlaskConical, color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by name or code..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <select value={selectedSchoolSection} onChange={e => setSelectedSchoolSection(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-600">
            <option value="">All Sections</option>
            {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-600">
            <option value="">All Types</option>
            <option value="theory">Theory</option>
            <option value="practical">Practical</option>
            <option value="combined">Combined</option>
          </select>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowActiveOnly(v => !v)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${showActiveOnly ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              Active only
            </button>
            <button onClick={fetchData} title="Refresh"
              className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_90px_130px_90px_120px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading subjects...</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-sm text-slate-500">{pageError}</p>
            <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <BookOpen className="h-6 w-6 text-slate-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No subjects found</h3>
            <p className="text-sm text-slate-400">
              {searchTerm || selectedSchoolSection || selectedType ? 'Try adjusting your filters' : 'Get started by adding your first subject'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(subject => (
              <div key={subject.id}>
                <div className="grid grid-cols-[1fr_90px_130px_90px_120px] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">

                  {/* Subject name + type badge */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      subject.subject_type === 'theory' ? 'bg-blue-50' :
                      subject.subject_type === 'practical' ? 'bg-purple-50' : 'bg-amber-50'
                    }`}>
                      {subject.subject_type === 'practical'
                        ? <FlaskConical className="h-4 w-4 text-purple-600" />
                        : subject.subject_type === 'combined'
                        ? <Layers className="h-4 w-4 text-amber-600" />
                        : <BookOpen className="h-4 w-4 text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{subject.name}</p>
                      <TypeBadge type={subject.subject_type} />
                    </div>
                  </div>

                  {/* Code */}
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg w-fit">{subject.code}</span>

                  {/* Section */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                    <Building className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{getSchoolSectionName(subject.school_section)}</span>
                  </div>

                  {/* Status */}
                  {subject.is_active
                    ? <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
                    : <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Inactive</span>}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <button onClick={() => { setEditingSubject(subject); setShowModal(true); }}
                        title="Edit" className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingSubject(subject)}
                        title="Delete" className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => setExpandedSubject(expandedSubject === subject.id ? null : subject.id)}
                      title="Details" className="p-1.5 rounded-lg text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all">
                      {expandedSubject === subject.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded row */}
                {expandedSubject === subject.id && (
                  <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-slate-400 mb-0.5">Subject ID</p>
                        <p className="font-semibold text-slate-700">#{subject.id}</p>
                      </div>
                      {subject.description && (
                        <div className="sm:col-span-2">
                          <p className="text-slate-400 mb-0.5">Description</p>
                          <p className="font-medium text-slate-600">{subject.description}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-slate-400 mb-0.5">Created</p>
                        <p className="font-semibold text-slate-700">{new Date(subject.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Last Updated</p>
                        <p className="font-semibold text-slate-700">{new Date(subject.updated_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}