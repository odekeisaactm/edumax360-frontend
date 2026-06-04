// app/dashboard/staff/academic/classes/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, academicCalendarAPI } from '@/lib/api';
import { ClassModel, ClassSection, SchoolSection, AcademicSettings } from '@/lib/types';
import {
  GraduationCap, Plus, Edit3, Trash2, Users, Search,
  X, Check, AlertCircle, AlertTriangle, Loader2,
  Eye, ChevronDown, ChevronUp, RefreshCw, Building,
  ArrowRight, BookOpen,
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
function ConfirmModal({ open, classObj, isDeleting, onConfirm, onCancel }: {
  open: boolean; classObj: ClassModel | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !classObj) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Class</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{classObj.name}"</span>?
          This will also delete all associated configurations and cannot be undone.
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

// ─── Form Values ───────────────────────────────────────────────────────────────
interface ClassFormValues {
  name: string;
  short_name: string;
  school_section: number | null;
  result_type: 'score' | 'text' | 'combined';
  is_graduation_class: boolean;
  can_have_special_student: boolean;
  next_class: number | '';
  order: number;
  section_ids: number[];
}

// ─── Class Form Modal ──────────────────────────────────────────────────────────
function ClassModal({ editing, classes, schoolSections, classSections, academicSettings, isSaving, onSave, onClose }: {
  editing: ClassModel | null;
  classes: ClassModel[];
  schoolSections: SchoolSection[];
  classSections: ClassSection[];
  academicSettings: AcademicSettings | null;
  isSaving: boolean;
  onSave: (data: ClassFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ClassFormValues>(
    editing
      ? {
          name: editing.name,
          short_name: editing.short_name || '',
          school_section: typeof editing.school_section === 'object'
            ? editing.school_section?.id ?? null
            : editing.school_section ?? null,
          result_type: editing.result_type,
          is_graduation_class: editing.is_graduation_class,
          can_have_special_student: editing.can_have_special_student,
          next_class: editing.next_class || '',
          order: editing.order,
          section_ids: [],
        }
      : { name: '', short_name: '', school_section: null, result_type: 'score', is_graduation_class: false, can_have_special_student: false, next_class: '', order: 0, section_ids: [] }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof ClassFormValues>(key: K, value: ClassFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const availableSections = classSections.filter(sec => {
    const active = sec.is_active;
    if (!form.school_section) return active;
    const secSchool = typeof sec.school_section === 'object' ? sec.school_section?.id : sec.school_section;
    return active && secSchool === form.school_section;
  });

  const handleSectionToggle = (id: number) =>
    set('section_ids', form.section_ids.includes(id)
      ? form.section_ids.filter(s => s !== id)
      : [...form.section_ids, id]);

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {editing ? 'Edit Class' : 'New Class'}
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
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Form */}
        <form id="class-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Class Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. JSS1, SS2, Primary 3" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Short Name</label>
                <input type="text" value={form.short_name} onChange={e => set('short_name', e.target.value)}
                  placeholder="e.g. J1, S2, P3" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Display Order</label>
                <input type="number" min={0} value={form.order} onChange={e => set('order', Number(e.target.value))}
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Lower numbers appear first</p>
              </div>
              <div>
                <label className={labelCls}>School Section</label>
                <select value={form.school_section ?? ''} onChange={e => set('school_section', e.target.value ? Number(e.target.value) : null)}
                  className={inputCls}>
                  <option value="">All Sections (Global)</option>
                  {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Result Type <span className="text-red-400 normal-case">*</span></label>
                <select required value={form.result_type} onChange={e => set('result_type', e.target.value as any)} className={inputCls}>
                  <option value="score">Score Based</option>
                  <option value="text">Text Based</option>
                  <option value="combined">Combined</option>
                </select>
              </div>
            </div>

            {/* Promotion Settings */}
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Promotion Settings</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Graduation Class</p>
                    <p className="text-xs text-slate-400">Students graduate after completing this class</p>
                  </div>
                  <button type="button" role="switch" aria-checked={form.is_graduation_class}
                    onClick={() => set('is_graduation_class', !form.is_graduation_class)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_graduation_class ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_graduation_class ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                 {/* Can Have Special Student Toggle - ADD THIS */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Can Have Special Needs Students</p>
                    <p className="text-xs text-slate-400">Class can accommodate special needs students</p>
                  </div>
                  <button type="button" role="switch" aria-checked={form.can_have_special_student}
                    onClick={() => set('can_have_special_student', !form.can_have_special_student)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.can_have_special_student ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.can_have_special_student ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {!form.is_graduation_class && (
                  <div>
                    <label className={labelCls}>Next Class (Promotion Target)</label>
                    <select value={form.next_class} onChange={e => set('next_class', e.target.value ? Number(e.target.value) : '')} className={inputCls}>
                      <option value="">Select Next Class</option>
                      {classes.filter(c => c.id !== editing?.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Students will be promoted to this class</p>
                  </div>
                )}
              </div>
            </div>

            {/* Class Sections */}
            {academicSettings?.use_class_sections && !editing && (
              <div className="border-t border-slate-100 pt-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Class Sections / Arms</p>
                <p className="text-xs text-slate-400 mb-3">Select sections to create configurations (e.g. A, B, Gold)</p>

                {availableSections.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    No active sections found. Please create class sections first.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableSections.map(sec => (
                      <label key={sec.id}
                        className={`flex items-center gap-2.5 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                          form.section_ids.includes(sec.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          form.section_ids.includes(sec.id) ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                        }`}>
                          {form.section_ids.includes(sec.id) && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <input type="checkbox" className="sr-only" checked={form.section_ids.includes(sec.id)}
                          onChange={() => handleSectionToggle(sec.id)} />
                        <span className="text-sm font-medium text-slate-800">{sec.name}</span>
                        <span className="text-xs text-slate-400 font-mono ml-auto">{sec.code}</span>
                      </label>
                    ))}
                  </div>
                )}

                {form.section_ids.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    {form.section_ids.length} section{form.section_ids.length !== 1 ? 's' : ''} selected — configurations will be created automatically.
                  </p>
                )}
              </div>
            )}

            {/* Edit note */}
            {editing && (
              <div className="border-t border-slate-100 pt-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                  To add or remove sections, visit the class detail page after saving.
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="class-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Class' : 'Create Class'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ClassesPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [schoolSections, setSchoolSections] = useState<SchoolSection[]>([]);
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingClass, setDeletingClass] = useState<ClassModel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolSection, setSelectedSchoolSection] = useState<number | ''>('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('academic.add_classmodel');
  const canEdit   = user?.is_superuser || hasPermission('academic.change_classmodel');
  const canDelete = user?.is_superuser || hasPermission('academic.delete_classmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [classesData, sectionsData, schoolSectionsData, settingsData] = await Promise.all([
        academicAPI.listClasses(),
        academicAPI.listClassSections(),
        academicCalendarAPI.listSchoolSections(),
        academicAPI.getSettings(),
      ]);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setClassSections(Array.isArray(sectionsData) ? sectionsData : []);
      setSchoolSections(Array.isArray(schoolSectionsData) ? schoolSectionsData : []);
      setAcademicSettings(settingsData);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingClass(null); setShowModal(true); };
  const openEdit = (cls: ClassModel) => { setEditingClass(cls); setShowModal(true); };

   const handleSave = async (form: ClassFormValues) => {
      setIsSaving(true);
      try {
        const submitData: any = {
          name: form.name,
          short_name: form.short_name || undefined,
          school_section: form.school_section,
          result_type: form.result_type,
          is_graduation_class: form.is_graduation_class,
          next_class: form.next_class || undefined,
          order: form.order,
          can_have_special_student: form.can_have_special_student,
        };

        // ONLY include section_ids when creating a NEW class
        if (!editingClass && academicSettings?.use_class_sections) {
          submitData.section_ids = form.section_ids;
        }

        if (editingClass) {
          const updated = await academicAPI.updateClass(editingClass.id, submitData);
          const refreshed = await academicAPI.getClass(updated.id);
          setClasses(prev => prev.map(c => c.id === refreshed.id ? refreshed : c));
          showToast('success', `"${refreshed.name}" updated successfully`);
        } else {
          const created = await academicAPI.createClass(submitData);
          const refreshed = await academicAPI.getClass(created.id);
          setClasses(prev => [refreshed, ...prev]);
          showToast('success', `"${refreshed.name}" created successfully`);
        }
        setShowModal(false);
      } catch (err) {
        throw err;
      } finally {
        setIsSaving(false);
      }
    };

  const handleDelete = async () => {
    if (!deletingClass) return;
    setIsDeleting(true);
    try {
      await academicAPI.deleteClass(deletingClass.id);
      setClasses(prev => prev.filter(c => c.id !== deletingClass.id));
      showToast('success', `"${deletingClass.name}" deleted`);
      setDeletingClass(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingClass(null);
    } finally { setIsDeleting(false); }
  };

  const getSchoolSectionName = (val: number | SchoolSection | null | undefined): string => {
    if (!val) return 'All Sections';
    if (typeof val === 'object') return val.name;
    return schoolSections.find(s => s.id === val)?.name ?? 'Unknown';
  };

  const getClassName = (id: number): string =>
    classes.find(c => c.id === id)?.name ?? 'Unknown';

  const filtered = classes.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.short_name ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchSchool = !selectedSchoolSection ||
      (typeof c.school_section === 'object'
        ? c.school_section?.id === selectedSchoolSection
        : c.school_section === selectedSchoolSection);
    const matchActive = !showActiveOnly || c.is_active;
    return matchSearch && matchSchool && matchActive;
  });

  const totalActive = classes.filter(c => c.is_active).length;
  const totalConfigs = classes.reduce((sum, c) => sum + (c.configurations?.length ?? 0), 0);
  const totalStudents = classes.reduce((sum, c) =>
    sum + (c.configurations?.reduce((s, cfg) => s + (cfg.student_count ?? 0), 0) ?? 0), 0);

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingClass} classObj={deletingClass} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingClass(null)}
      />

      {showModal && (
        <ClassModal
          editing={editingClass} classes={classes} schoolSections={schoolSections}
          classSections={classSections} academicSettings={academicSettings}
          isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            Classes
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage school classes and their configurations</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Class
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Classes', value: classes.length, icon: GraduationCap, color: 'from-blue-500 to-blue-600' },
          { label: 'Active', value: totalActive, icon: Check, color: 'from-emerald-500 to-teal-600' },
          { label: 'Configurations', value: totalConfigs, icon: BookOpen, color: 'from-violet-500 to-purple-600' },
          { label: 'Total Students', value: totalStudents, icon: Users, color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Search + filter bar */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by name or short name..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <select value={selectedSchoolSection}
            onChange={e => setSelectedSchoolSection(e.target.value ? Number(e.target.value) : '')}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white">
            <option value="">All School Sections</option>
            {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={showActiveOnly}
                onClick={() => setShowActiveOnly(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-slate-600">Active only</span>
            </label>
            <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading classes...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchData} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || selectedSchoolSection ? 'No classes match your search' : 'No classes yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || selectedSchoolSection ? 'Try different keywords or filters.' : 'Add your first class to get started.'}
            </p>
            {!searchTerm && !selectedSchoolSection && canCreate && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Class
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_80px_120px_90px_140px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Sections</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Students</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Next Class</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(cls => {
                const totalStudentsInClass = cls.configurations?.reduce((s, cfg) => s + (cfg.student_count ?? 0), 0) ?? 0;
                return (
                  <div key={cls.id}>
                    <div className="grid grid-cols-[1fr_80px_80px_120px_90px_140px] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cls.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                          <GraduationCap className={`h-4 w-4 ${cls.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 truncate">{cls.name}</p>
                            {cls.short_name && <span className="text-xs text-slate-400 font-mono">({cls.short_name})</span>}
                            {cls.is_graduation_class && (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-md font-medium">Grad</span>
                            )}
                            {cls.can_have_special_student && (  // ADD THIS
                                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-medium">Special</span>
                              )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">{getSchoolSectionName(cls.school_section)}</span>
                            <span className="text-xs text-slate-300">·</span>
                            <span className="text-xs text-slate-400 capitalize">{cls.result_type}</span>
                          </div>
                        </div>
                      </div>

                      {/* Configs count */}
                      <div className="flex items-center justify-center">
                        <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {cls.configurations?.length ?? 0}
                        </span>
                      </div>

                      {/* Students count */}
                      <div className="flex items-center justify-center gap-1 text-sm text-slate-600">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium">{totalStudentsInClass}</span>
                      </div>

                      {/* Next class */}
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        {cls.is_graduation_class ? (
                          <span className="text-xs text-purple-600 font-medium">Graduates</span>
                        ) : cls.next_class ? (
                          <>
                            <ArrowRight className="h-3 w-3 text-slate-300" />
                            <span className="text-xs truncate max-w-[80px]">{getClassName(cls.next_class)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>

                      {/* Status */}
                      {cls.is_active ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                        </span>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => router.push(`/dashboard/staff/academic/classes/${cls.id}`)} title="View details"
                          className="p-2 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {canEdit && (
                          <button onClick={() => openEdit(cls)} title="Edit"
                            className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeletingClass(cls)} title="Delete"
                            className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => setExpandedId(expandedId === cls.id ? null : cls.id)} title="Toggle details"
                          className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                          {expandedId === cls.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded row */}
                    {expandedId === cls.id && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                          {cls.configurations && cls.configurations.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Configurations</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {cls.configurations.map(cfg => (
                                  <div key={cfg.id} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-slate-100">
                                    <span className="text-sm text-slate-700 font-medium">
                                      {cls.name}{cfg.class_section_name ? ` ${cfg.class_section_name}` : ''}
                                    </span>
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                      <Users className="h-3 w-3" />{cfg.student_count ?? 0}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm pt-1">
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class ID</span>
                              <p className="mt-1 text-slate-700 font-medium">#{cls.id}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order</span>
                              <p className="mt-1 text-slate-700">{cls.order}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</span>
                              <p className="mt-1 text-slate-700">{new Date(cls.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {classes.length} class{classes.length !== 1 ? 'es' : ''}
                {showActiveOnly ? ' (active only)' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}