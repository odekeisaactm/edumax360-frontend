// app/dashboard/staff/academic/subject-groups/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, academicCalendarAPI } from '@/lib/api';
import { SubjectGroup, Subject, ClassModel, SchoolSection } from '@/lib/types';
import {
  Layers, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, ChevronDown, ChevronUp,
  BookOpen, GraduationCap, Building, Loader2, RefreshCw,
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
function ConfirmDeleteModal({ open, group, isDeleting, onConfirm, onCancel }: {
  open: boolean; group: SubjectGroup | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !group) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Subject Group</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete <span className="font-semibold text-slate-700">"{group.name}"</span>? This cannot be undone.
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

// ─── Checkbox Card ─────────────────────────────────────────────────────────────
function CheckCard({ checked, label, sublabel, onClick }: {
  checked: boolean; label: string; sublabel?: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2.5 p-3 border-2 rounded-xl text-left w-full transition-all ${
        checked ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
      }`}>
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        checked ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
      }`}>
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 truncate">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 font-mono">{sublabel}</p>}
      </div>
    </button>
  );
}

// ─── Form Values ───────────────────────────────────────────────────────────────
interface FormValues {
  name: string;
  code: string;
  school_section: number | null;
  description: string;
  applicable_classes: number[];
  subjects: number[];
  is_active: boolean;
}

const defaultForm: FormValues = {
  name: '', code: '', school_section: null,
  description: '', applicable_classes: [], subjects: [], is_active: true,
};

// ─── Subject Group Modal ───────────────────────────────────────────────────────
function SubjectGroupModal({ editing, schoolSections, allClasses, allSubjects,
  isSaving, onSave, onClose }: {
  editing: SubjectGroup | null;
  schoolSections: SchoolSection[];
  allClasses: ClassModel[];
  allSubjects: Subject[];
  isSaving: boolean;
  onSave: (data: FormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormValues>(() => {
    if (!editing) return { ...defaultForm };
    return {
      name: editing.name,
      code: editing.code,
      school_section: typeof editing.school_section === 'object'
        ? editing.school_section?.id ?? null : editing.school_section ?? null,
      description: editing.description || '',
      applicable_classes: editing.applicable_classes?.map((c: any) => typeof c === 'object' ? c.id : c) ?? [],
      subjects: editing.subjects?.map((s: any) => typeof s === 'object' ? s.id : s) ?? [],
      is_active: editing.is_active,
    };
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [subjectSearch, setSubjectSearch] = useState('');

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleClass = (id: number) =>
    set('applicable_classes', form.applicable_classes.includes(id)
      ? form.applicable_classes.filter(x => x !== id)
      : [...form.applicable_classes, id]);

  const toggleSubject = (id: number) =>
    set('subjects', form.subjects.includes(id)
      ? form.subjects.filter(x => x !== id)
      : [...form.subjects, id]);

  const filteredSubjects = allSubjects.filter(s =>
    s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
  const canSubmit = form.applicable_classes.length > 0 && form.subjects.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {editing ? 'Edit Subject Group' : 'Add New Subject Group'}
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

        <form id="group-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

            {/* Basic info */}
            <div>
              <label className={labelCls}>School Section</label>
              <select value={form.school_section ?? ''} onChange={e => set('school_section', e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                <option value="">All Sections (Global)</option>
                {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">Leave blank for groups available to all sections</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Group Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Science Subjects" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Group Code <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="e.g. SCI" className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Auto-uppercased</p>
              </div>
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={2} placeholder="Brief description of this subject group" className={inputCls} />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-800">Active</p>
                <p className="text-xs text-slate-400">Group is available for use</p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active}
                onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Applicable Classes */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-indigo-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Applicable Classes <span className="text-red-400 normal-case">*</span>
                  </p>
                </div>
                {form.applicable_classes.length > 0 && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                    {form.applicable_classes.length} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-3">Select the classes where this group will be available</p>
              {allClasses.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  No active classes found. Please create classes first.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {allClasses.map(cls => (
                    <CheckCard key={cls.id}
                      checked={form.applicable_classes.includes(cls.id)}
                      label={cls.name}
                      sublabel={cls.short_name}
                      onClick={() => toggleClass(cls.id)} />
                  ))}
                </div>
              )}
            </div>

            {/* Subjects */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Subjects <span className="text-red-400 normal-case">*</span>
                  </p>
                </div>
                {form.subjects.length > 0 && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                    {form.subjects.length} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-3">Select the subjects included in this group</p>

              {allSubjects.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  No active subjects found. Please create subjects first.
                </div>
              ) : (
                <>
                  {/* Subject search */}
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input type="text" placeholder="Search subjects..." value={subjectSearch}
                      onChange={e => setSubjectSearch(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {filteredSubjects.map(sub => (
                        <CheckCard key={sub.id}
                          checked={form.subjects.includes(sub.id)}
                          label={sub.name}
                          sublabel={sub.code}
                          onClick={() => toggleSubject(sub.id)} />
                      ))}
                    </div>
                    {filteredSubjects.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">No subjects match your search</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="group-form" disabled={isSaving || !canSubmit}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Group' : 'Create Group'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SubjectGroupsPage() {
  const { hasPermission, user } = useAuth();

  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allClasses, setAllClasses] = useState<ClassModel[]>([]);
  const [schoolSections, setSchoolSections] = useState<SchoolSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SubjectGroup | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingGroup, setDeletingGroup] = useState<SubjectGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolSection, setSelectedSchoolSection] = useState<number | ''>('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView = user?.is_superuser || hasPermission('academic_structure.view_subject_groups');
  const canCreate = user?.is_superuser || hasPermission('academic_structure.manage_subject_groups');
  const canEdit = user?.is_superuser || hasPermission('academic_structure.manage_subject_groups');
  const canDelete = user?.is_superuser || hasPermission('academic_structure.manage_subject_groups');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [groupsData, subjectsData, classesData, sectionsData] = await Promise.all([
        academicAPI.listSubjectGroups(),
        academicAPI.listSubjects({ is_active: true }),
        academicAPI.listClasses({ is_active: true }),
        academicCalendarAPI.listSchoolSections(),
      ]);
      setSubjectGroups(groupsData);
      setAllSubjects(subjectsData);
      setAllClasses(classesData);
      setSchoolSections(sectionsData);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (canView) fetchData(); }, [canView, fetchData]);

  const handleSave = async (data: FormValues) => {
    setIsSaving(true);
    try {
      const payload = { ...data, school_section: data.school_section ?? null };
      if (editingGroup) {
        const updated = await academicAPI.updateSubjectGroup(editingGroup.id, payload as any);

        setSubjectGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
        showToast('success', 'Subject group updated successfully');
      } else {
        const created = await academicAPI.createSubjectGroup(payload as any);

        setSubjectGroups(prev => [created, ...prev]);
        showToast('success', 'Subject group created successfully');
      }
      setShowModal(false);
      setEditingGroup(null);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    setIsDeleting(true);
    try {
      await academicAPI.deleteSubjectGroup(deletingGroup.id);
      setSubjectGroups(prev => prev.filter(g => g.id !== deletingGroup.id));
      showToast('success', 'Subject group deleted successfully');
      setDeletingGroup(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingGroup(null);
    } finally { setIsDeleting(false); }
  };

  const getSchoolSectionName = (val: number | SchoolSection | null | undefined): string => {
    if (!val) return 'All Sections';
    if (typeof val === 'object') return val.name;
    return schoolSections.find(s => s.id === val)?.name || 'Unknown';
  };

  const filtered = subjectGroups.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSection = !selectedSchoolSection ||
      (typeof g.school_section === 'object' ? g.school_section?.id === selectedSchoolSection : g.school_section === selectedSchoolSection);
    const matchActive = !showActiveOnly || g.is_active;
    return matchSearch && matchSection && matchActive;
  });

  const activeCount = subjectGroups.filter(g => g.is_active).length;
  const totalClasses = [...new Set(subjectGroups.flatMap(g => g.applicable_classes?.map((c: any) => typeof c === 'object' ? c.id : c) ?? []))].length;
  const totalSubjects = [...new Set(subjectGroups.flatMap(g => g.subjects?.map((s: any) => typeof s === 'object' ? s.id : s) ?? []))].length;

  if (!canView) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 text-sm">You don't have permission to view subject groups.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDeleteModal
        open={!!deletingGroup} group={deletingGroup} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingGroup(null)}
      />

      {showModal && (
        <SubjectGroupModal
          editing={editingGroup} schoolSections={schoolSections}
          allClasses={allClasses} allSubjects={allSubjects}
          isSaving={isSaving} onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingGroup(null); }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Layers className="h-5 w-5 text-white" />
            </div>
            Subject Groups
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Group subjects for specific classes and sections</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditingGroup(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Group
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Groups', value: subjectGroups.length, icon: Layers, color: 'from-blue-500 to-blue-600' },
          { label: 'Active', value: activeCount, icon: Check, color: 'from-emerald-500 to-teal-600' },
          { label: 'Classes Covered', value: totalClasses, icon: GraduationCap, color: 'from-violet-500 to-purple-600' },
          { label: 'Subjects Covered', value: totalSubjects, icon: BookOpen, color: 'from-orange-400 to-amber-500' },
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
        <div className="grid grid-cols-[1fr_90px_80px_80px_90px_100px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Classes</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Subjects</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading subject groups...</p>
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
              <Layers className="h-6 w-6 text-slate-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No subject groups found</h3>
            <p className="text-sm text-slate-400">
              {searchTerm || selectedSchoolSection ? 'Try adjusting your filters' : 'Get started by creating your first subject group'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(group => (
              <div key={group.id}>
                <div className="grid grid-cols-[1fr_90px_80px_80px_90px_100px] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">

                  {/* Group name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Layers className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{group.name}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Building className="h-3 w-3" />
                        <span>{getSchoolSectionName(group.school_section)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Code */}
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg w-fit">{group.code}</span>

                  {/* Classes count */}
                  <div className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-700">
                    <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                    {group.applicable_classes?.length ?? 0}
                  </div>

                  {/* Subjects count */}
                  <div className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-700">
                    <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                    {group.subjects?.length ?? 0}
                  </div>

                  {/* Status */}
                  {group.is_active
                    ? <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
                    : <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Inactive</span>}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <button onClick={() => { setEditingGroup(group); setShowModal(true); }}
                        title="Edit" className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingGroup(group)}
                        title="Delete" className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                      title="Details" className="p-1.5 rounded-lg text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all">
                      {expandedGroup === group.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded row */}
                {expandedGroup === group.id && (
                  <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-100 space-y-4">

                    {/* Description */}
                    {group.description && (
                      <p className="text-sm text-slate-500">{group.description}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Classes */}
                      {group.applicable_class_names && group.applicable_class_names.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Applicable Classes</p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.applicable_class_names.map((name, i) => (
                              <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-medium rounded-lg">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Subjects */}
                      {group.subject_names && group.subject_names.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Subjects</p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.subject_names.map((name, i) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium rounded-lg">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex gap-6 text-xs text-slate-400 pt-1">
                      <span>Created: <span className="font-medium text-slate-600">{new Date(group.created_at).toLocaleDateString()}</span></span>
                      <span>Updated: <span className="font-medium text-slate-600">{new Date(group.updated_at).toLocaleDateString()}</span></span>
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