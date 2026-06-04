// app/dashboard/staff/academic/classes/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, studentsAPI, utilityAPI, studentCustomFieldsAPI } from '@/lib/api';
import { ClassModel, ClassConfiguration, AcademicSettings, ClassSection, Subject } from '@/lib/types';
import {
  GraduationCap, ArrowLeft, Edit3, Users, Building, Eye,
  AlertCircle, AlertTriangle, Check, X, Trash2, Loader2,
  RefreshCw, BookOpen, ArrowRight, Shield, Calendar, Search, UserCircle, Plus,
  SlidersHorizontal, Filter, Download, FileSpreadsheet, FileText,
  ChevronDown, ChevronLeft, ChevronRight, Heart, Minus,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }
interface Option { id: number; name: string; sub?: string; }

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

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
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
function ConfirmDeleteModal({ open, title, description, warning, isDeleting, onConfirm, onCancel }: {
  open: boolean; title: string; description: string; warning?: string; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">{title}</h3>
        <p className="text-sm text-slate-500 text-center mb-2">{description}</p>
        {warning && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center font-medium">
            {warning}
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <><Trash2 className="h-4 w-4" /> Confirm</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Form Values ──────────────────────────────────────────────────────────
interface EditFormValues {
  name: string;
  short_name: string;
  result_type: 'score' | 'text' | 'combined';
  is_graduation_class: boolean;
  next_class: number | '';
  order: number;
  is_active: boolean;
  subjects?: number[];
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditClassModal({ classData, academicSettings, allClassSections, selectedSectionIds,
  onSectionToggle, isSaving, onSave, onClose, allSubjects }: {
  classData: ClassModel;
  academicSettings: AcademicSettings | null;
  allClassSections: ClassSection[];
  selectedSectionIds: number[];
  onSectionToggle: (id: number) => void;
  isSaving: boolean;
  onSave: (form: EditFormValues, sectionIds: number[]) => Promise<void>;
  onClose: () => void;
  allSubjects: Subject[];
}) {
  const [form, setForm] = useState<EditFormValues>({
    name: classData.name,
    short_name: classData.short_name || '',
    result_type: classData.result_type,
    is_graduation_class: classData.is_graduation_class,
    next_class: classData.next_class || '',
    order: classData.order,
    is_active: classData.is_active,
    subjects: classData.subjects || [],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [subjectSearch, setSubjectSearch] = useState('');

  const filteredSubjects = allSubjects.filter(s =>
    s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  const toggleSubject = (id: number) => {
    setForm(prev => ({
      ...prev,
      subjects: prev.subjects?.includes(id)
        ? prev.subjects.filter(s => s !== id)
        : [...(prev.subjects || []), id],
    }));
  };

  const set = <K extends keyof EditFormValues>(key: K, value: EditFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try { await onSave(form, selectedSectionIds); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <GraduationCap className="h-4 w-4" /> Edit Class
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        )}

        <form id="edit-class-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

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

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Settings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Active</p>
                    <p className="text-xs text-slate-400">Class is operational</p>
                  </div>
                  <button type="button" role="switch" aria-checked={form.is_active}
                    onClick={() => set('is_active', !form.is_active)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Graduation Class</p>
                    <p className="text-xs text-slate-400">Students graduate here</p>
                  </div>
                  <button type="button" role="switch" aria-checked={form.is_graduation_class}
                    onClick={() => set('is_graduation_class', !form.is_graduation_class)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_graduation_class ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_graduation_class ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {academicSettings?.use_class_sections && allClassSections.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Class Sections / Arms</p>
                <p className="text-xs text-slate-400 mb-3">Unchecking a section removes its configuration (only if it has no students).</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allClassSections.map(sec => {
                    const isSelected = selectedSectionIds.includes(sec.id);
                    const currentConfig = classData.configurations?.find(cfg => {
                      const sId = typeof cfg.class_section === 'object' ? cfg.class_section?.id : cfg.class_section;
                      return sId === sec.id;
                    });
                    const hasStudents = currentConfig && currentConfig.student_count > 0;

                    return (
                      <label key={sec.id}
                        className={`flex items-center gap-2.5 p-3 border-2 rounded-xl transition-all ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                        } ${hasStudents && isSelected ? 'opacity-60' : 'cursor-pointer'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <input type="checkbox" className="sr-only" checked={isSelected}
                          onChange={() => !(hasStudents && isSelected) && onSectionToggle(sec.id)}
                          disabled={!!(hasStudents && isSelected)} />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-slate-800">{sec.name}</span>
                          {hasStudents && currentConfig && (
                            <p className="text-xs text-slate-400">{currentConfig.student_count} student(s)</p>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{sec.code}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedSectionIds.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">{selectedSectionIds.length} section{selectedSectionIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="edit-class-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</>
              : <><Check className="h-4 w-4" /> Update Class</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

// ─── Student Tab Constants ─────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  active:      { label: 'Active',      dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  suspended:   { label: 'Suspended',   dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-100'  },
  graduated:   { label: 'Graduated',   dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-100'    },
  withdrawn:   { label: 'Withdrawn',   dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200'   },
  transferred: { label: 'Transferred', dot: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-100'  },
};

const GENDER_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  male:   { label: 'Male',   color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
  female: { label: 'Female', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-100' },
};

const STUDENT_TAB_PAGE_SIZE = 25;

const STUDENT_EXPORT_FIELDS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'full_name',           label: 'Full Name',     defaultOn: true  },
  { key: 'registration_number', label: 'Reg Number',    defaultOn: true  },
  { key: 'gender',              label: 'Gender',        defaultOn: true  },
  { key: 'current_class',       label: 'Class',         defaultOn: true  },
  { key: 'status',              label: 'Status',        defaultOn: false },
  { key: 'date_of_birth',       label: 'Date of Birth', defaultOn: false },
];

const DEFAULT_STUDENT_EXPORT_FIELDS = new Set(
  STUDENT_EXPORT_FIELDS.filter(f => f.defaultOn).map(f => f.key)
);

interface StudentTabFilterState {
  status: string;
  gender: string;
  current_class_section: string;
}

const EMPTY_STUDENT_FILTERS: StudentTabFilterState = {
  status: 'active',
  gender: '',
  current_class_section: '',
};

// ─── Field Checkbox ────────────────────────────────────────────────────────────
function FieldCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group" onClick={onChange}>
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
        checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'
      }`}>
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      <span className="text-xs text-slate-600 group-hover:text-slate-800 transition-colors select-none">{label}</span>
    </label>
  );
}

// ─── Filter Chip ───────────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900"><X className="h-3 w-3" /></button>
    </span>
  );
}

// ─── Download Dropdown ─────────────────────────────────────────────────────────
function DownloadDropdown({ onExcel, onPDF, downloading }: { onExcel: () => void; onPDF: () => void; downloading: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(p => !p)} disabled={downloading}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50">
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
          <div className="p-1.5">
            <button onClick={() => { onExcel(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left">
              <div className="w-8 h-8 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Excel (.xlsx)</p>
                <p className="text-[11px] text-slate-400">Selected fields only</p>
              </div>
            </button>
            <button onClick={() => { onPDF(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left">
              <div className="w-8 h-8 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">PDF</p>
                <p className="text-[11px] text-slate-400">Printable student list</p>
              </div>
            </button>
          </div>
          <div className="px-3 py-2 border-t border-slate-50 bg-slate-50/60">
            <p className="text-[11px] text-slate-400">Open <span className="font-semibold text-slate-500">Filters</span> to change export columns</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student Tab Filter Modal ──────────────────────────────────────────────────
function StudentFilterModal({
  open, filters, sections, selectedFields,
  onApply, onClose, onReset,
}: {
  open: boolean;
  filters: StudentTabFilterState;
  sections: any[];
  selectedFields: Set<string>;
  onApply: (f: StudentTabFilterState, fields: Set<string>) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const [local, setLocal] = useState<StudentTabFilterState>(filters);
  const [localFields, setLocalFields] = useState<Set<string>>(new Set(selectedFields));

  useEffect(() => {
    if (open) {
      setLocal(filters);
      setLocalFields(new Set(selectedFields));
    }
  }, [open, filters, selectedFields]);

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  const toggleField = (key: string) => setLocalFields(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <SlidersHorizontal className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Filters & Export Fields</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6 flex-1">

          {/* Filters */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Filters</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={local.status} onChange={e => setLocal(p => ({ ...p, status: e.target.value }))}>
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select className={inputCls} value={local.gender} onChange={e => setLocal(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">All genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              {sections.length > 0 && (
                <div>
                  <label className={labelCls}>Class Section / Arm</label>
                  <select className={inputCls} value={local.current_class_section}
                    onChange={e => setLocal(p => ({ ...p, current_class_section: e.target.value }))}>
                    <option value="">All sections</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Export Fields */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Export Fields</p>
            </div>
            <p className="text-xs text-slate-400 mb-4">Choose which columns appear in Excel / PDF downloads.</p>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              {STUDENT_EXPORT_FIELDS.map(f => (
                <FieldCheckbox key={f.key} label={f.label}
                  checked={localFields.has(f.key)} onChange={() => toggleField(f.key)} />
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={() => {
            setLocal({ ...EMPTY_STUDENT_FILTERS });
            setLocalFields(new Set(DEFAULT_STUDENT_EXPORT_FIELDS));
            onReset();
          }} className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
            Reset all
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={() => onApply(local, localFields)}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm">
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Students Tab ──────────────────────────────────────────────────────────────
function StudentsTab({
  classId, className, configurations, useClassSections,
}: {
  classId: number;
  className: string;
  configurations: ClassConfiguration[];
  useClassSections: boolean;
}) {
  const router = useRouter();

  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [filters, setFilters] = useState<StudentTabFilterState>(EMPTY_STUDENT_FILTERS);
  const [pendingSearch, setPendingSearch] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_STUDENT_EXPORT_FIELDS));

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build sections list from configurations
  const sections = React.useMemo(() => {
    const seen = new Set<number>();
    const list: { id: number; name: string }[] = [];
    for (const cfg of configurations) {
      if (cfg.class_section && !seen.has(cfg.class_section as number)) {
        seen.add(cfg.class_section as number);
        list.push({ id: cfg.class_section as number, name: cfg.class_section_name || `Section ${cfg.class_section}` });
      }
    }
    return list;
  }, [configurations]);

  const buildParams = useCallback((f: StudentTabFilterState, pg: number, search: string) => {
    const p: Record<string, any> = { page: pg, page_size: STUDENT_TAB_PAGE_SIZE, current_class: classId };
    if (search)                    p.search                  = search;
    if (f.status)                  p.status                  = f.status;
    if (f.gender)                  p.gender                  = f.gender;
    if (f.current_class_section)   p.current_class_section   = f.current_class_section;
    return p;
  }, [classId]);

  const fetchStudents = useCallback(async (f: StudentTabFilterState, pg = 1, search = pendingSearch) => {
    setLoading(true); setPageError(null);
    try {
      const data = await studentsAPI.list(buildParams(f, pg, search));
      const results = (data as any)?.results ?? (data as any)?.data ?? data ?? [];
      setStudents(Array.isArray(results) ? results : []);
      setTotal((data as any)?.count ?? results.length);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [buildParams, pendingSearch]);

  useEffect(() => { fetchStudents(EMPTY_STUDENT_FILTERS, 1, ''); }, [classId]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchStudents(filters, 1, pendingSearch), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [pendingSearch]);

  const applyFilters = (f: StudentTabFilterState, fields: Set<string>) => {
    setFilters(f);
    setSelectedFields(fields);
    fetchStudents(f, 1, pendingSearch);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setPendingSearch('');
    setFilters(EMPTY_STUDENT_FILTERS);
    setSelectedFields(new Set(DEFAULT_STUDENT_EXPORT_FIELDS));
    fetchStudents(EMPTY_STUDENT_FILTERS, 1, '');
    setShowFilterModal(false);
  };

  const removeFilter = (key: keyof StudentTabFilterState) => {
    const next = { ...filters, [key]: '' };
    setFilters(next);
    fetchStudents(next, 1, pendingSearch);
  };

  const buildExportParams = useCallback((f: StudentTabFilterState) => {
    const p: Record<string, any> = { ...buildParams(f, 1, pendingSearch) };
    delete p.page; delete p.page_size;
    if (selectedFields.size > 0) p.fields = Array.from(selectedFields).join(',');
    return p;
  }, [buildParams, pendingSearch, selectedFields]);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try { await studentsAPI.downloadListExcel(buildExportParams(filters)); }
    catch { }
    finally { setDownloading(false); }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try { await studentsAPI.downloadListPDF(buildExportParams(filters)); }
    catch { }
    finally { setDownloading(false); }
  };

  const sectionName = sections.find(s => String(s.id) === filters.current_class_section)?.name || filters.current_class_section;

  const activeFilterChips: { key: keyof StudentTabFilterState; label: string }[] = [
    filters.status !== 'active' && filters.status && { key: 'status', label: `Status: ${filters.status}` },
    filters.gender             && { key: 'gender', label: `Gender: ${filters.gender}` },
    filters.current_class_section && { key: 'current_class_section', label: `Section: ${sectionName}` },
  ].filter(Boolean) as { key: keyof StudentTabFilterState; label: string }[];

  const hasFilters = !!(pendingSearch || activeFilterChips.length);
  const totalPages = Math.ceil(total / STUDENT_TAB_PAGE_SIZE);
  const activeCount = students.filter(s => s.status === 'active').length;

  return (
    <>
      <StudentFilterModal
        open={showFilterModal}
        filters={filters}
        sections={sections}
        selectedFields={selectedFields}
        onApply={applyFilters}
        onClose={() => setShowFilterModal(false)}
        onReset={resetFilters}
      />

      <div className="space-y-0">
        {/* Stat chips */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100">
          {[
            { label: 'Total',   value: total,       color: 'from-blue-500 to-blue-600' },
            { label: 'Active',  value: activeCount, color: 'from-emerald-500 to-teal-600' },
            { label: 'This Page', value: students.length, color: 'from-violet-500 to-purple-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-2.5">
              <div className={`w-7 h-7 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Users className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">{label}</p>
                <p className="text-sm font-bold text-slate-800">{loading ? '—' : value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search by name, reg number…"
                value={pendingSearch} onChange={e => setPendingSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              {pendingSearch && (
                <button onClick={() => setPendingSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowFilterModal(true)}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border rounded-xl transition-all ${
                  activeFilterChips.length > 0
                    ? 'border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterChips.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeFilterChips.length}
                  </span>
                )}
              </button>
              {hasFilters && (
                <button onClick={resetFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors">
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
              <DownloadDropdown onExcel={handleDownloadExcel} onPDF={handleDownloadPDF} downloading={downloading} />
              <button onClick={() => fetchStudents(filters, page, pendingSearch)} title="Refresh"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilterChips.map(({ key, label }) => (
                <FilterChip key={key} label={label} onRemove={() => removeFilter(key)} />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading students...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchStudents(filters, 1, pendingSearch)}
              className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No students match your filters' : 'No students in this class'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Students assigned to this class will appear here.'}
            </p>
            {hasFilters && (
              <button onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1fr 140px 100px 70px' }}>
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {students.map(s => {
                const status = STATUS_META[s.status ?? 'active'] ?? STATUS_META.active;
                const gender = GENDER_META[s.gender ?? ''];
                const fullName = toTitleCase(s.full_name ?? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim());
                const classDisplay = [s.current_class_name, s.current_class_section_name].filter(Boolean).join(' — ');

                return (
                  <div key={s.id}
                    className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                    style={{ gridTemplateColumns: '2.5rem 1fr 140px 100px 70px' }}>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {s.image_url ? (
                        <img src={s.image_url} alt={fullName}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-100 shadow-sm"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                          <GraduationCap className="h-4 w-4 text-blue-400" />
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 text-sm truncate">{fullName}</p>
                        {s.is_special_need && (
                           <span title="Special needs">
                          <Heart className="h-3 w-3 text-rose-400 flex-shrink-0" />
                        </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {s.registration_number && (
                          <span className="text-[11px] font-mono text-slate-400">{s.registration_number}</span>
                        )}
                        {gender && (
                          <span className={`px-1.5 py-0 rounded text-[11px] font-semibold border ${gender.bg} ${gender.color} ${gender.border}`}>
                            {gender.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Class */}
                    <div className="hidden sm:block min-w-0">
                      <p className="text-sm text-slate-700 font-medium truncate">{classDisplay || '—'}</p>
                    </div>

                    {/* Status */}
                    <div className="hidden sm:block">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => router.push(`/dashboard/staff/students/${s.id}`)}
                        title="View student"
                        className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * STUDENT_TAB_PAGE_SIZE) + 1}–{Math.min(page * STUDENT_TAB_PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> student{total !== 1 ? 's' : ''}
                {hasFilters && <span className="ml-1 text-blue-500 font-medium">(filtered)</span>}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchStudents(filters, page - 1, pendingSearch)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchStudents(filters, pg, pendingSearch)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchStudents(filters, page + 1, pendingSearch)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ClassDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { hasPermission, user } = useAuth();

  const [classData, setClassData] = useState<ClassModel | null>(null);
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);
  const [allClassSections, setAllClassSections] = useState<ClassSection[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingConfig, setDeletingConfig] = useState<ClassConfiguration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [isDeletingSubject, setIsDeletingSubject] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'students'>('overview');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectModalSearch, setSubjectModalSearch] = useState('');
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('academic.change_classmodel');
  const canDeleteConfig = user?.is_superuser || hasPermission('academic.delete_classconfigurationmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchClassData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [classResponse, settingsResponse, subjectsResponse] = await Promise.all([
        academicAPI.getClass(Number(params.id)),
        academicAPI.getSettings(),
        academicAPI.listSubjects(),
      ]);
      setClassData(classResponse);
      setAcademicSettings(settingsResponse);
      setAllSubjects(subjectsResponse.filter((s: Subject) => s.is_active));

      if (settingsResponse?.use_class_sections) {
        const allSections = await academicAPI.listClassSections();
        setAllClassSections(allSections.filter((s: ClassSection) => s.is_active));
      }
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [params.id]);

  useEffect(() => { fetchClassData(); }, [fetchClassData]);

  const handleOpenEditModal = () => {
    if (!classData) return;
    const currentSectionIds = classData.configurations
      ?.map(cfg => {
        if (!cfg.class_section) return null;
        return typeof cfg.class_section === 'object' ? cfg.class_section.id : cfg.class_section;
      })
      .filter((id): id is number => id !== null) ?? [];
    setSelectedSectionIds(currentSectionIds);
    setShowEditModal(true);
  };

  const handleSectionToggle = (id: number) =>
    setSelectedSectionIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );

  const handleSave = async (form: EditFormValues, sectionIds: number[]) => {
    setIsSaving(true);
    try {
      const updateData: any = {
        ...form,
        short_name: form.short_name || undefined,
        next_class: form.next_class || undefined,
      };
      if (academicSettings?.use_class_sections) {
        updateData.section_ids = sectionIds;
      }
      await academicAPI.updateClass(Number(params.id), updateData);
      await fetchClassData();
      setShowEditModal(false);
      showToast('success', 'Class updated successfully');
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleOpenSubjectModal = () => {
    setSelectedSubjectIds(classData?.subjects || []);
    setSubjectModalSearch('');
    setShowSubjectModal(true);
  };

  const handleSaveSubjects = async () => {
    setSavingSubjects(true);
    try {
      await academicAPI.updateClass(Number(params.id), { subjects: selectedSubjectIds } as any);
      await fetchClassData();
      setShowSubjectModal(false);
      setSelectedSubjectIds([]);
      showToast('success', 'Subjects updated successfully');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSavingSubjects(false);
    }
  };

  const handleRemoveSubject = async (subjectId: number) => {
    if (!classData) return;
    const newSubjects = (classData.subjects || []).filter(id => id !== subjectId);
    try {
      await academicAPI.updateClass(Number(params.id), { subjects: newSubjects } as any);
      await fetchClassData();
      showToast('success', 'Subject removed successfully');
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleDeleteConfig = async () => {
    if (!deletingConfig) return;
    setIsDeleting(true);
    try {
      await academicAPI.deleteClassConfiguration(deletingConfig.id);
      await fetchClassData();
      setDeletingConfig(null);
      showToast('success', 'Configuration deleted successfully');
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingConfig(null);
    } finally { setIsDeleting(false); }
  };

  const getSchoolSectionName = (): string => {
    if (!classData) return 'Unknown';
    if (!classData.school_section) return 'All Sections';
    if (typeof classData.school_section === 'object') return classData.school_section.name;
    return classData.school_section_name || 'Unknown';
  };

  // ── Subject modal helpers ──
  const filteredModalSubjects = allSubjects.filter(s =>
    !subjectModalSearch ||
    s.name.toLowerCase().includes(subjectModalSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(subjectModalSearch.toLowerCase())
  );

  const allModalSubjectIds = filteredModalSubjects.map(s => s.id);
  const allModalSelected = allModalSubjectIds.length > 0 && allModalSubjectIds.every(id => selectedSubjectIds.includes(id));
  const someModalSelected = allModalSubjectIds.some(id => selectedSubjectIds.includes(id)) && !allModalSelected;

  const toggleAllModalSubjects = () => {
    if (allModalSelected) {
      // Deselect only the currently filtered ones
      setSelectedSubjectIds(prev => prev.filter(id => !allModalSubjectIds.includes(id)));
    } else {
      // Select all filtered ones, keeping any already selected outside the filter
      setSelectedSubjectIds(prev => Array.from(new Set([...prev, ...allModalSubjectIds])));
    }
  };

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading class details...</p>
      </div>
    </div>
  );

  if (pageError || !classData) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">{pageError || 'Class not found'}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
          <button onClick={fetchClassData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    </div>
  );

  const totalStudents = classData.configurations?.reduce((s, c) => s + (c.student_count ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDeleteModal
        open={!!deletingConfig}
        title="Delete Configuration"
        description={`Are you sure you want to delete the configuration for "${deletingConfig?.class_section_name || 'this section'}"? This cannot be undone.`}
        warning={deletingConfig && deletingConfig.student_count > 0 ? `Warning: This configuration has ${deletingConfig.student_count} student(s) enrolled.` : undefined}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfig}
        onCancel={() => setDeletingConfig(null)}
      />

      <ConfirmDeleteModal
        open={!!deletingSubject}
        title="Remove Subject from Class"
        description={`Are you sure you want to remove "${deletingSubject?.name}"? It will be removed from all class configurations/arms.`}
        isDeleting={isDeletingSubject}
        onConfirm={async () => {
          if (!deletingSubject) return;
          setIsDeletingSubject(true);
          try {
            await handleRemoveSubject(deletingSubject.id);
            setDeletingSubject(null);
          } finally {
            setIsDeletingSubject(false);
          }
        }}
        onCancel={() => setDeletingSubject(null)}
      />

      {showEditModal && (
        <EditClassModal
          classData={classData} academicSettings={academicSettings}
          allClassSections={allClassSections} selectedSectionIds={selectedSectionIds}
          onSectionToggle={handleSectionToggle} isSaving={isSaving}
          onSave={handleSave} onClose={() => setShowEditModal(false)}
          allSubjects={allSubjects}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              {classData.name}
              {classData.short_name && (
                <span className="text-lg text-slate-400 font-normal">({classData.short_name})</span>
              )}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">{getSchoolSectionName()}</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={handleOpenEditModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Edit3 className="h-4 w-4" /> Edit Class
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Configurations', value: classData.configurations?.length ?? 0, icon: BookOpen, color: 'from-blue-500 to-blue-600' },
          { label: 'Total Students', value: totalStudents, icon: Users, color: 'from-emerald-500 to-teal-600' },
          { label: 'Result Type', value: classData.result_type, icon: Shield, color: 'from-violet-500 to-purple-600' },
          { label: 'Display Order', value: classData.order, icon: Calendar, color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800 capitalize truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {([
            { key: 'overview',  label: 'Overview',                                   icon: Building },
            { key: 'subjects',  label: `Subjects (${classData.subjects?.length ?? 0})`, icon: BookOpen },
            { key: 'students',  label: `Students (${totalStudents})`,                icon: Users },
          ] as { key: 'overview' | 'subjects' | 'students'; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === key
                  ? 'text-blue-600 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* ══ TAB 1: OVERVIEW ══ */}
        {activeTab === 'overview' && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5 bg-slate-50">

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                  <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Class Information</h3>
              </div>
              <div className="px-5 py-2">
                <InfoRow label="School Section" value={
                  <span className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    {getSchoolSectionName()}
                  </span>
                } />
                <InfoRow label="Result Type" value={
                  <span className="capitalize px-2 py-0.5 bg-slate-100 rounded-lg text-xs font-semibold">{classData.result_type}</span>
                } />
                <InfoRow label="Display Order" value={classData.order} />
                <InfoRow label="Status" value={
                  classData.is_active
                    ? <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
                    : <span className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactive</span>
                } />
                <InfoRow label="Graduation Class" value={
                  classData.is_graduation_class
                    ? <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold">Yes</span>
                    : <span className="text-slate-400 text-xs">No</span>
                } />
                {classData.next_class && (
                  <InfoRow label="Promotes To" value={
                    <span className="flex items-center gap-1 text-blue-600 text-xs font-medium">
                      <ArrowRight className="h-3 w-3" /> {classData.next_class_name}
                    </span>
                  } />
                )}
                <InfoRow label="Created" value={new Date(classData.created_at).toLocaleDateString()} />
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Class Configurations</h3>
                </div>
                <span className="text-xs text-slate-400">{classData.configurations?.length ?? 0} total</span>
              </div>

              {!classData.configurations || classData.configurations.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-slate-300" />
                  </div>
                  <h3 className="font-semibold text-slate-700 mb-1">No Configurations</h3>
                  <p className="text-sm text-slate-400">
                    {academicSettings?.use_class_sections
                      ? 'Use the Edit button to add sections to this class.'
                      : 'A default configuration should have been created automatically.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {classData.configurations.map(config => (
                    <div key={config.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                              <GraduationCap className={`h-4 w-4 ${config.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">
                                {classData.name}{config.class_section_name ? ` — ${config.class_section_name}` : ''}
                              </p>
                              {config.is_active
                                ? <span className="text-xs text-emerald-600 font-medium">Active</span>
                                : <span className="text-xs text-slate-400">Inactive</span>}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="p-2.5 bg-slate-50 rounded-xl">
                              <p className="text-xs text-slate-400 mb-0.5">Form Teacher</p>
                              <p className="text-xs font-semibold text-slate-700 truncate">
                                {config.form_teacher_name || <span className="text-slate-300">Not assigned</span>}
                              </p>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-xl">
                              <p className="text-xs text-slate-400 mb-0.5">Asst. Form Teacher</p>
                              <p className="text-xs font-semibold text-slate-700 truncate">
                                {config.assistant_form_teacher_name || <span className="text-slate-300">Not assigned</span>}
                              </p>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-xl">
                              <p className="text-xs text-slate-400 mb-0.5">Max Capacity</p>
                              <p className="text-xs font-semibold text-slate-700">
                                {config.max_capacity ?? <span className="text-slate-300">Default</span>}
                              </p>
                            </div>
                            <div className="p-2.5 bg-blue-50 rounded-xl">
                              <p className="text-xs text-blue-400 mb-0.5">Students</p>
                              <p className="text-sm font-bold text-blue-700 flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />{config.student_count ?? 0}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button onClick={() => router.push(`/dashboard/staff/academic/class-configurations/${config.id}`)}
                            title="View configuration"
                            className="p-2 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canDeleteConfig && (
                            <button onClick={() => setDeletingConfig(config)} title="Delete configuration"
                              className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB 2: SUBJECTS ══ */}
        {activeTab === 'subjects' && (
          <div>
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search inherited subjects..."
                  value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
              {canEdit && (
                <button onClick={handleOpenSubjectModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200 flex-shrink-0">
                  <Edit3 className="h-4 w-4" /> Manage Class Subjects
                </button>
              )}
            </div>

            {!classData.subjects || classData.subjects.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-6 w-6 text-slate-300" />
                </div>
                <h3 className="font-semibold text-slate-700 mb-1">No subjects assigned to class</h3>
                <p className="text-sm text-slate-400">Click "Manage Class Subjects" to select subjects that will auto-inherit to all configurations.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subjects</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide pr-4">Action</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {allSubjects
                    .filter(s => classData.subjects?.includes(s.id))
                    .filter(s => !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase()) || s.code.toLowerCase().includes(subjectSearch.toLowerCase()))
                    .map(sub => (
                      <div key={sub.id} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 truncate">{sub.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{sub.subject_type} · {sub.code}</p>
                          </div>
                        </div>
                        {canEdit && (
                          <button onClick={() => setDeletingSubject(sub)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove subject">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ TAB 3: STUDENTS ══ */}
        {activeTab === 'students' && (
          <StudentsTab
            classId={Number(params.id)}
            className={classData.name}
            configurations={classData.configurations || []}
            useClassSections={academicSettings?.use_class_sections ?? false}
          />
        )}
      </div>

      {/* ══ Add/Manage Subjects Modal ══ */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '88vh' }}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Manage Class Subjects
              </h3>
              <button onClick={() => { setShowSubjectModal(false); setSelectedSubjectIds([]); }}
                disabled={savingSubjects}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <p className="text-sm text-slate-500">
                  Select subjects to assign.
                  {selectedSubjectIds.length > 0 && (
                    <span className="ml-1 font-semibold text-blue-600">{selectedSubjectIds.length} selected</span>
                  )}
                </p>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" placeholder="Search subjects..."
                    value={subjectModalSearch} onChange={e => setSubjectModalSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              {/* ── Check all / Uncheck all ── */}
              {allSubjects.length > 0 && (
                <div className="flex items-center justify-between p-3 mb-4 bg-slate-50 rounded-xl border border-slate-100">
                  <button type="button" onClick={toggleAllModalSubjects}
                    className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                      allModalSelected ? 'border-blue-500 bg-blue-500'
                      : someModalSelected ? 'border-blue-500 bg-blue-100'
                      : 'border-slate-300'
                    }`}>
                      {allModalSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      {someModalSelected && <Minus className="h-2.5 w-2.5 text-blue-600" />}
                    </div>
                    {allModalSelected ? 'Uncheck All' : 'Check All'}
                    {subjectModalSearch && <span className="text-slate-400 font-normal text-xs">(filtered)</span>}
                  </button>
                  <span className="text-xs text-slate-400">
                    {filteredModalSubjects.length} subject{filteredModalSubjects.length !== 1 ? 's' : ''}
                    {subjectModalSearch ? ' shown' : ' total'}
                  </span>
                </div>
              )}

              {allSubjects.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No subjects available in the system.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredModalSubjects.map(subject => {
                    const checked = selectedSubjectIds.includes(subject.id);
                    return (
                      <div key={subject.id}
                          onClick={() => setSelectedSubjectIds(prev =>
                            checked ? prev.filter(id => id !== subject.id) : [...prev, subject.id]
                          )}
                          className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                            checked ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200 bg-white'
                          }`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                          }`}>
                            {checked && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 truncate">{subject.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{subject.subject_type} · {subject.code}</p>
                          </div>
                        </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
              <button type="button" onClick={() => { setShowSubjectModal(false); setSelectedSubjectIds([]); }}
                disabled={savingSubjects}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSaveSubjects} disabled={savingSubjects}
                className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
                {savingSubjects
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                  : <><Check className="h-4 w-4" />Update Subjects</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}