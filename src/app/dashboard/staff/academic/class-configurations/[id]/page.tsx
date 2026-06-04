// app/dashboard/staff/academic/class-configurations/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, academicCalendarAPI, staffAPI, studentsAPI } from '@/lib/api';
import {
  ClassConfiguration, ClassSubjectConfiguration, Subject,
  Timetable, TimetableFormValues, Day,
} from '@/lib/types';
import {
  GraduationCap, ArrowLeft, Edit3, Users, BookOpen, Check, X,
  AlertCircle, AlertTriangle, Plus, Trash2, Loader2, RefreshCw,
  UserCheck, Clock, Calendar, ChevronDown, ChevronUp, Search,
  UserCircle, Coffee, Sunset, LogOut, Save, ExternalLink, Eye,
  Heart, Filter, Download, FileSpreadsheet, FileText, ChevronLeft,
  ChevronRight, SlidersHorizontal, Minus,
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
        .map(([, v]) => (Array.isArray(v) ? v[0] : String(v))).join(' ');
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

function ConfirmDeleteModal({ open, label, isDeleting, onConfirm, onCancel }: {
  open: boolean; label: string; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Confirm Removal</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Remove <span className="font-semibold text-slate-700">"{label}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" />Removing...</> : <><Trash2 className="h-4 w-4" />Remove</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Searchable Select ─────────────────────────────────────────────────────────
interface Option { id: number; name: string; sub?: string; gender?: string; status?: string; }

function SearchSelect({ options, value, onChange, placeholder, disabled }: {
  options: Option[]; value: number | ''; onChange: (v: number | '') => void;
  placeholder: string; disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value) ?? null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    !query || o.name.toLowerCase().includes(query.toLowerCase()) ||
    o.sub?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 60);

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition";

  if (disabled) return (
    <div className={`${inputCls} text-slate-400 cursor-not-allowed`}>
      {selected ? selected.name : placeholder}
    </div>
  );

  return (
    <div ref={ref} className="relative">
      {selected && !open ? (
        <div onClick={() => setOpen(true)}
          className={`${inputCls} flex items-center gap-2 cursor-pointer hover:border-blue-400`}>
          <div className="w-5 h-5 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
            <UserCircle className="h-3 w-3 text-blue-600" />
          </div>
          <span className="flex-1 truncate font-medium text-slate-800">{selected.name}</span>
          {selected.sub && <span className="text-xs text-slate-400">{selected.sub}</span>}
          <button type="button" onClick={e => { e.stopPropagation(); onChange(''); setQuery(''); }}
            className="text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input autoFocus={open} type="text" placeholder={placeholder}
            value={query} onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            className={`${inputCls} pl-9 border-blue-400`} />
        </div>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {selected && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input autoFocus type="text" placeholder="Type to filter..."
                  value={query} onChange={e => setQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          )}
          <ul className="max-h-52 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => { onChange(''); setQuery(''); setOpen(false); }}
                className="w-full px-3.5 py-2 text-xs text-slate-400 hover:bg-slate-50 text-left italic">
                — None —
              </button>
            </li>
            {filtered.length === 0
              ? <li className="px-4 py-3 text-xs text-slate-400 text-center">No results</li>
              : filtered.map(o => (
                <li key={o.id}>
                  <button type="button" onClick={() => { onChange(o.id); setQuery(''); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-blue-50 text-left ${o.id === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'}`}>
                    <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0">
                      <UserCircle className="h-3 w-3 text-slate-400" />
                    </div>
                    <span className="flex-1 truncate">{o.name}</span>
                    {o.sub && <span className="text-xs text-slate-400">{o.sub}</span>}
                    {o.id === value && <Check className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Break badge ───────────────────────────────────────────────────────────────
const BREAK_META: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  short:   { label: 'Short Break',  bg: 'bg-amber-50',   text: 'text-amber-700',  icon: <Coffee className="h-3 w-3" /> },
  long:    { label: 'Long Break',   bg: 'bg-orange-50',  text: 'text-orange-700', icon: <Sunset className="h-3 w-3" /> },
  closing: { label: 'Closing Time', bg: 'bg-slate-100',  text: 'text-slate-600',  icon: <LogOut className="h-3 w-3" /> },
};

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

const STUDENT_PAGE_SIZE = 25;

const STUDENT_EXPORT_FIELDS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'full_name',           label: 'Full Name',     defaultOn: true  },
  { key: 'registration_number', label: 'Reg Number',    defaultOn: true  },
  { key: 'gender',              label: 'Gender',        defaultOn: true  },
  { key: 'current_class',       label: 'Class',         defaultOn: true  },
  { key: 'status',              label: 'Status',        defaultOn: false },
  { key: 'date_of_birth',       label: 'Date of Birth', defaultOn: false },
];

const DEFAULT_STUDENT_EXPORT = new Set(
  STUDENT_EXPORT_FIELDS.filter(f => f.defaultOn).map(f => f.key)
);

interface StudentFilterState { status: string; gender: string; }
const EMPTY_STUDENT_FILTERS: StudentFilterState = { status: 'active', gender: '' };

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
        </div>
      )}
    </div>
  );
}

// ─── Student Filter Modal ──────────────────────────────────────────────────────
function StudentFilterModal({
  open, filters, selectedFields,
  onApply, onClose, onReset,
}: {
  open: boolean;
  filters: StudentFilterState;
  selectedFields: Set<string>;
  onApply: (f: StudentFilterState, fields: Set<string>) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const [local, setLocal] = useState<StudentFilterState>(filters);
  const [localFields, setLocalFields] = useState<Set<string>>(new Set(selectedFields));

  useEffect(() => {
    if (open) { setLocal(filters); setLocalFields(new Set(selectedFields)); }
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
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Export Fields</p>
            </div>
            <p className="text-xs text-slate-400 mb-4">Choose which columns appear in Excel / PDF downloads.</p>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              {STUDENT_EXPORT_FIELDS.map(f => (
                <FieldCheckbox key={f.key} label={f.label} checked={localFields.has(f.key)} onChange={() => toggleField(f.key)} />
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={() => { setLocal({ ...EMPTY_STUDENT_FILTERS }); setLocalFields(new Set(DEFAULT_STUDENT_EXPORT)); onReset(); }}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
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

// ─── Timetable Entry Modal ─────────────────────────────────────────────────────
interface TimetableFormState {
  type: 'subject' | 'break';
  subject: number | '';
  break_type: 'short' | 'long' | 'closing' | '';
  day: number | '';
  start_time: string;
  end_time: string;
  teacher: number | '';
  classroom: string;
}

const defaultTimetableForm: TimetableFormState = {
  type: 'subject', subject: '', break_type: '', day: '',
  start_time: '', end_time: '', teacher: '', classroom: '',
};

function TimetableModal({ editing, configId, days, subjects, staffOptions, isSaving, onSave, onClose }: {
  editing: Timetable | null;
  configId: number;
  days: Day[];
  subjects: ClassSubjectConfiguration[];
  staffOptions: Option[];
  isSaving: boolean;
  onSave: (data: TimetableFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TimetableFormState>(() => {
    if (!editing) return { ...defaultTimetableForm };
    return {
      type: editing.subject ? 'subject' : 'break',
      subject: (editing.subject as number) ?? '',
      break_type: editing.break_type ?? '',
      day: editing.day as number,
      start_time: editing.start_time,
      end_time: editing.end_time,
      teacher: editing.teacher as number ?? '',
      classroom: editing.classroom ?? '',
    };
  });
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof TimetableFormState>(k: K, v: TimetableFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.day) { setFormError('Please select a day.'); return; }
    if (form.type === 'subject' && !form.subject) { setFormError('Please select a subject.'); return; }
    if (form.type === 'break' && !form.break_type) { setFormError('Please select a break type.'); return; }

    const payload: TimetableFormValues = {
      class_configuration: configId,
      day: form.day as number,
      start_time: form.start_time,
      end_time: form.end_time,
    };
    if (form.type === 'subject') {
      payload.subject = form.subject as number;
      if (form.teacher) payload.teacher = form.teacher as number;
      if (form.classroom) payload.classroom = form.classroom;
    } else {
      payload.break_type = form.break_type as 'short' | 'long' | 'closing';
    }

    try { await onSave(payload); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  const subjectOptions: Option[] = subjects.map(sc => ({
    id: typeof sc.subject === 'object' ? (sc.subject as any).id : sc.subject as number,
    name: sc.subject_name || `Subject #${sc.subject}`,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {editing ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{formError}</span>
            <button onClick={() => setFormError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        <form id="tt-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">
            <div>
              <label className={labelCls}>Entry Type</label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                {(['subject', 'break'] as const).map(t => (
                  <button key={t} type="button" onClick={() => set('type', t)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
                      form.type === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                    }`}>
                    {t === 'subject' ? '📚 Subject' : '☕ Break'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Day <span className="text-red-400 normal-case">*</span></label>
              <select required value={form.day} onChange={e => set('day', e.target.value ? Number(e.target.value) : '')} className={inputCls}>
                <option value="">Select day</option>
                {days.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start Time <span className="text-red-400 normal-case">*</span></label>
                <input required type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>End Time <span className="text-red-400 normal-case">*</span></label>
                <input required type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className={inputCls} />
              </div>
            </div>

            {form.type === 'subject' ? (
              <>
                <div>
                  <label className={labelCls}>Subject <span className="text-red-400 normal-case">*</span></label>
                  <select value={form.subject} onChange={e => { set('subject', e.target.value ? Number(e.target.value) : ''); set('teacher', ''); }} className={inputCls}>
                    <option value="">Select subject</option>
                    {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {subjectOptions.length === 0 && <p className="text-xs text-amber-600 mt-1">No subjects assigned to this class yet.</p>}
                </div>
                <div>
                  <label className={labelCls}>Teacher</label>
                  {!form.subject ? (
                    <div className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed">Select a subject first</div>
                  ) : (() => {
                    const subjectConfig = subjects.find(sc => {
                      const sid = typeof sc.subject === 'object' ? (sc.subject as any).id : sc.subject as number;
                      return sid === form.subject;
                    });
                    const subjectTeacherIds: number[] = subjectConfig?.teachers as number[] ?? [];
                    const subjectTeacherOptions: Option[] = staffOptions.filter(s => subjectTeacherIds.includes(s.id));
                    return (
                      <>
                        <SearchSelect options={subjectTeacherOptions} value={form.teacher}
                          onChange={v => set('teacher', v)} placeholder="Select subject teacher (optional)"
                          disabled={subjectTeacherOptions.length === 0} />
                        {subjectTeacherOptions.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">No teachers assigned to this subject yet.</p>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div>
                  <label className={labelCls}>Classroom / Venue</label>
                  <input type="text" value={form.classroom} onChange={e => set('classroom', e.target.value)}
                    placeholder="e.g. Room 12, Lab B" className={inputCls} />
                </div>
              </>
            ) : (
              <div>
                <label className={labelCls}>Break Type <span className="text-red-400 normal-case">*</span></label>
                <select value={form.break_type} onChange={e => set('break_type', e.target.value as any)} className={inputCls}>
                  <option value="">Select break type</option>
                  <option value="short">Short Break</option>
                  <option value="long">Long Break</option>
                  <option value="closing">Closing Time</option>
                </select>
              </div>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="tt-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Adding...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Entry' : 'Add Entry'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Teachers Modal (replicates text-category pattern) ─────────────────
function AssignTeachersModal({ subjectName, assignedTeacherIds, allStaff, isSaving, onSave, onClose }: {
  subjectName: string;
  assignedTeacherIds: number[];
  allStaff: Option[];
  isSaving: boolean;
  onSave: (ids: number[]) => Promise<void>;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Option[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(assignedTeacherIds);
  // localTeachers = full objects of currently selected, for display in "Currently Assigned"
  const [localTeachers, setLocalTeachers] = useState<Option[]>(() =>
    allStaff.filter(s => assignedTeacherIds.includes(s.id))
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Live search from allStaff (client-side, since staff is already loaded)
  useEffect(() => {
    if (searchTerm.trim().length < 2) { setSearchResults([]); return; }
    const q = searchTerm.toLowerCase();
    setSearchResults(allStaff.filter(s =>
      s.name.toLowerCase().includes(q) || s.sub?.toLowerCase().includes(q)
    ).slice(0, 20));
  }, [searchTerm, allStaff]);

  const toggleStaff = (staffId: number, staffObj?: Option) => {
    const isSelected = selectedIds.includes(staffId);
    if (isSelected) {
      setSelectedIds(prev => prev.filter(id => id !== staffId));
      setLocalTeachers(prev => prev.filter(t => t.id !== staffId));
    } else {
      setSelectedIds(prev => [...prev, staffId]);
      if (staffObj) setLocalTeachers(prev => [...prev, staffObj]);
    }
  };

  const handleSubmit = async () => {
    setFormError(null);
    try { await onSave(selectedIds); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assign Teachers — {subjectName}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search staff by name or ID (min 2 chars)..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className={inputCls + " pl-9"} />
          </div>

          {searchResults.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Search Results</p>
              {searchResults.map(staff => (
                <div key={staff.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="font-medium text-slate-800">{staff.name}</p>
                    <p className="text-xs text-slate-400">{staff.sub}</p>
                  </div>
                  <button type="button" onClick={() => toggleStaff(staff.id, staff)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedIds.includes(staff.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}>
                    {selectedIds.includes(staff.id) ? 'Remove' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          ) : searchTerm.length >= 2 ? (
            <p className="text-center text-sm text-slate-400 py-6">No staff found matching "{searchTerm}"</p>
          ) : (
            <p className="text-center text-sm text-slate-400 py-6">Type at least 2 characters to search for staff</p>
          )}

          {localTeachers.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Currently Assigned</p>
              <div className="flex flex-wrap gap-2">
                {localTeachers.map(staff => (
                  <div key={staff.id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                    <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-sm text-blue-700">{staff.name}</span>
                    <button onClick={() => toggleStaff(staff.id)} className="text-blue-400 hover:text-blue-600">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Check className="h-4 w-4" /> Save Teachers</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Students Tab ──────────────────────────────────────────────────────────────
function StudentsTab({ configId, configName, studentClassId, classSectionId }: {
  configId: number;
  configName: string;
  studentClassId: number;
  classSectionId: number;
}) {
  const router = useRouter();

  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [filters, setFilters] = useState<StudentFilterState>(EMPTY_STUDENT_FILTERS);
  const [pendingSearch, setPendingSearch] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_STUDENT_EXPORT));

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback((f: StudentFilterState, pg: number, search: string) => {
  const p: Record<string, any> = { page: pg, page_size: STUDENT_PAGE_SIZE };
      if (studentClassId)  p.current_class         = studentClassId;
      if (classSectionId)  p.current_class_section  = classSectionId;
      if (search)          p.search                 = search;
      if (f.status)        p.status                 = f.status;
      if (f.gender)        p.gender                 = f.gender;
      return p;
    }, [studentClassId, classSectionId]);

  const fetchStudents = useCallback(async (f: StudentFilterState, pg = 1, search = pendingSearch) => {
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

  useEffect(() => { fetchStudents(EMPTY_STUDENT_FILTERS, 1, ''); }, [configId]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchStudents(filters, 1, pendingSearch), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [pendingSearch]);

  const applyFilters = (f: StudentFilterState, fields: Set<string>) => {
    setFilters(f);
    setSelectedFields(fields);
    fetchStudents(f, 1, pendingSearch);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setPendingSearch('');
    setFilters(EMPTY_STUDENT_FILTERS);
    setSelectedFields(new Set(DEFAULT_STUDENT_EXPORT));
    fetchStudents(EMPTY_STUDENT_FILTERS, 1, '');
    setShowFilterModal(false);
  };

  const removeFilter = (key: keyof StudentFilterState) => {
    const next = { ...filters, [key]: '' };
    setFilters(next);
    fetchStudents(next, 1, pendingSearch);
  };

  const buildExportParams = useCallback((f: StudentFilterState) => {
    const p: Record<string, any> = { ...buildParams(f, 1, pendingSearch) };
    delete p.page; delete p.page_size;
    if (selectedFields.size > 0) p.fields = Array.from(selectedFields).join(',');
    return p;
  }, [buildParams, pendingSearch, selectedFields]);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try { await studentsAPI.downloadListExcel(buildExportParams(filters)); } catch {}
    finally { setDownloading(false); }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try { await studentsAPI.downloadListPDF(buildExportParams(filters)); } catch {}
    finally { setDownloading(false); }
  };

  const activeFilterChips: { key: keyof StudentFilterState; label: string }[] = [
    filters.status !== 'active' && filters.status && { key: 'status', label: `Status: ${filters.status}` },
    filters.gender && { key: 'gender', label: `Gender: ${filters.gender}` },
  ].filter(Boolean) as { key: keyof StudentFilterState; label: string }[];

  const hasFilters = !!(pendingSearch || activeFilterChips.length);
  const totalPages = Math.ceil(total / STUDENT_PAGE_SIZE);
  const activeCount = students.filter(s => s.status === 'active').length;

  return (
    <>
      <StudentFilterModal
        open={showFilterModal}
        filters={filters}
        selectedFields={selectedFields}
        onApply={applyFilters}
        onClose={() => setShowFilterModal(false)}
        onReset={resetFilters}
      />

      <div>
        {/* Stat chips */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100">
          {[
            { label: 'Total',     value: total,         color: 'from-blue-500 to-blue-600' },
            { label: 'Active',    value: activeCount,   color: 'from-emerald-500 to-teal-600' },
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
              {hasFilters ? 'No students match your filters' : 'No students in this section'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Students assigned to this class section will appear here.'}
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
              style={{ gridTemplateColumns: '2.5rem 1fr 120px 90px 60px' }}>
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</span>
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
                    style={{ gridTemplateColumns: '2.5rem 1fr 120px 90px 60px' }}>

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
                        {s.is_special_need && <span title="Special needs">
                          <Heart className="h-3 w-3 text-rose-400 flex-shrink-0" />
                        </span>
                        }
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

                    {/* Action */}
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
                Showing {((page - 1) * STUDENT_PAGE_SIZE) + 1}–{Math.min(page * STUDENT_PAGE_SIZE, total)} of{' '}
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
type Tab = 'teachers' | 'subjects' | 'students' | 'timetable';

export default function ClassConfigDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { hasPermission, user } = useAuth();
  const configId = Number(params.id);

  const [config, setConfig] = useState<ClassConfiguration | null>(null);
  const [className, setClassName] = useState<string>('');
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<ClassSubjectConfiguration[]>([]);
  const [timetable, setTimetable] = useState<Timetable[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [staffOptions, setStaffOptions] = useState<Option[]>([]);
  // FIX #6: separate student options for the class config (for reps)
  const [configStudentOptions, setConfigStudentOptions] = useState<Option[]>([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('teachers');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Teachers form
  const [editingTeachers, setEditingTeachers] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    form_teacher: '' as number | '',
    assistant_form_teacher: '' as number | '',
    class_rep: '' as number | '',
    assistant_class_rep: '' as number | '',
    max_capacity: '' as number | '',
  });
  const [savingTeachers, setSavingTeachers] = useState(false);
  const [teacherFormError, setTeacherFormError] = useState<string | null>(null);

  // Subjects
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [subjectModalError, setSubjectModalError] = useState<string | null>(null);
  const [editingSubjectConfig, setEditingSubjectConfig] = useState<ClassSubjectConfiguration | null>(null);
  const [savingSubjectTeachers, setSavingSubjectTeachers] = useState(false);
  const [deletingSubjectConfig, setDeletingSubjectConfig] = useState<ClassSubjectConfiguration | null>(null);
  const [isDeletingSubject, setIsDeletingSubject] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectModalSearch, setSubjectModalSearch] = useState('');

  // Timetable
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState<Timetable | null>(null);
  const [savingTimetable, setSavingTimetable] = useState(false);
  const [deletingTimetable, setDeletingTimetable] = useState<Timetable | null>(null);
  const [isDeletingTimetable, setIsDeletingTimetable] = useState(false);

  const canView   = user?.is_superuser || hasPermission('academic.view_classconfigurationmodel');
  const canEdit   = user?.is_superuser || hasPermission('academic.change_classconfigurationmodel');
  const canAddSub = user?.is_superuser || hasPermission('academic.add_classsubjectconfigurationmodel');
  const canDelSub = user?.is_superuser || hasPermission('academic.delete_classsubjectconfigurationmodel');
  const canEditTT = user?.is_superuser || hasPermission('academic.add_timetablemodel');
  const canDelTT  = user?.is_superuser || hasPermission('academic.delete_timetablemodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [configData, daysData, staffData] = await Promise.all([
        academicAPI.getClassConfiguration(configId),
        academicCalendarAPI.listDays(),
        staffAPI.list({ status: 'active', page_size: 500 }),
      ]);

      setConfig(configData);
      setDays(daysData);

      const staffList: any[] = (staffData as any)?.results ?? (staffData as any)?.data ?? staffData ?? [];
      setStaffOptions(staffList.map(s => ({
        id: s.id,
        name: s.full_name ?? (`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Staff #${s.id}`),
        sub: s.staff_id,
      })));

      setTeacherForm({
        form_teacher: (configData.form_teacher as number) ?? '',
        assistant_form_teacher: (configData.assistant_form_teacher as number) ?? '',
        class_rep: (configData.class_rep as number) ?? '',
        assistant_class_rep: (configData.assistant_class_rep as number) ?? '',
        max_capacity: configData.max_capacity ?? '',
      });

      const studentClassId = (configData.student_class != null && typeof configData.student_class === 'object')
        ? (configData.student_class as any).id
        : configData.student_class as number;

      const classData = await academicAPI.getClass(studentClassId);
      setClassName(classData.name);

      const schoolSectionId = (classData.school_section != null && typeof classData.school_section === 'object')
        ? (classData.school_section as any).id
        : classData.school_section as number;

      const [subjectsData, assignedData, timetableData, studentsData] = await Promise.all([
        academicAPI.listSubjects({ school_section_id: schoolSectionId, is_active: true }),
        academicAPI.listClassSubjectConfigurations({ class_configuration_id: configId }),
        academicAPI.listTimetable({ class_configuration_id: configId }),
        // FIX #5 & #6: fetch students scoped to this config only
        studentsAPI.list({
      current_class: studentClassId,        // from configData.student_class
      current_class_section: typeof configData.class_section === 'object'
      ? configData.class_section?.id
      : configData.class_section,
      page_size: 500
    }),
      ]);

      setAllSubjects(subjectsData);
      setAssignedSubjects(assignedData);
      setTimetable(timetableData);

      // FIX #6: student options for rep dropdowns = only students in THIS config
      const studentList: any[] = Array.isArray(studentsData)
        ? studentsData
        : (studentsData as any)?.results ?? (studentsData as any)?.data ?? [];
      setConfigStudentOptions(studentList.map(s => ({
        id: s.id,
        name: toTitleCase(s.full_name ?? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()),
        sub: s.registration_number,
      })));

    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [configId]);

  useEffect(() => { if (canView && configId) fetchData(); }, [canView, configId, fetchData]);

  // ── Teacher Form Save ──────────────────────────────────────────────────────
  const handleSaveTeachers = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTeachers(true); setTeacherFormError(null);
    try {
      const payload: any = {
        form_teacher: teacherForm.form_teacher !== '' ? teacherForm.form_teacher : null,
        assistant_form_teacher: teacherForm.assistant_form_teacher !== '' ? teacherForm.assistant_form_teacher : null,
        class_rep: teacherForm.class_rep !== '' ? teacherForm.class_rep : null,
        assistant_class_rep: teacherForm.assistant_class_rep !== '' ? teacherForm.assistant_class_rep : null,
      };
      if (teacherForm.max_capacity !== '') payload.max_capacity = teacherForm.max_capacity;

      const updated = await academicAPI.updateClassConfiguration(configId, payload);
      setConfig(updated);
      setEditingTeachers(false);
      showToast('success', 'Teachers & representatives updated successfully');
    } catch (err) {
      setTeacherFormError(extractError(err));
    } finally { setSavingTeachers(false); }
  };

  // ── Subject Actions ────────────────────────────────────────────────────────
  const availableSubjects = allSubjects.filter(s => {
    const assignedIds = assignedSubjects.map(as =>
      typeof as.subject === 'object' ? (as.subject as any).id : as.subject as number
    );
    return !assignedIds.includes(s.id);
  });

  const handleBulkAddSubjects = async () => {
    if (selectedSubjectIds.length === 0) return;
    setSavingSubjects(true); setSubjectModalError(null);
    try {
      await academicAPI.bulkCreateSubjectConfigurations({
        class_configuration_id: configId,
        subject_ids: selectedSubjectIds,
      });
      const updated = await academicAPI.listClassSubjectConfigurations({ class_configuration_id: configId });
      setAssignedSubjects(updated);
      showToast('success', `${selectedSubjectIds.length} subject(s) added`);
      setShowSubjectModal(false);
      setSelectedSubjectIds([]);
    } catch (err) {
      setSubjectModalError(extractError(err));
    } finally { setSavingSubjects(false); }
  };

  const handleSaveSubjectTeachers = async (teacherIds: number[]) => {
    if (!editingSubjectConfig) return;
    setSavingSubjectTeachers(true);
    try {
      await academicAPI.updateClassSubjectConfiguration(editingSubjectConfig.id, { teachers: teacherIds });
      const updated = await academicAPI.listClassSubjectConfigurations({ class_configuration_id: configId });
      setAssignedSubjects(updated);
      showToast('success', 'Subject teachers updated');
      setEditingSubjectConfig(null);
    } catch (err) {
      throw err;
    } finally { setSavingSubjectTeachers(false); }
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubjectConfig) return;
    setIsDeletingSubject(true);
    try {
      await academicAPI.deleteClassSubjectConfiguration(deletingSubjectConfig.id);
      setAssignedSubjects(prev => prev.filter(s => s.id !== deletingSubjectConfig.id));
      showToast('success', 'Subject removed');
      setDeletingSubjectConfig(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingSubjectConfig(null);
    } finally { setIsDeletingSubject(false); }
  };

  // ── Timetable Actions ──────────────────────────────────────────────────────
  const handleSaveTimetable = async (data: TimetableFormValues) => {
    setSavingTimetable(true);
    try {
      if (editingTimetable) {
        const updated = await academicAPI.updateTimetableEntry(editingTimetable.id, data);
        setTimetable(prev => prev.map(t => t.id === updated.id ? updated : t));
        showToast('success', 'Timetable entry updated');
      } else {
        const created = await academicAPI.createTimetableEntry(data);
        setTimetable(prev => [...prev, created]);
        showToast('success', 'Timetable entry added');
      }
      setShowTimetableModal(false);
      setEditingTimetable(null);
    } catch (err) {
      throw err;
    } finally { setSavingTimetable(false); }
  };

  const handleDeleteTimetable = async () => {
    if (!deletingTimetable) return;
    setIsDeletingTimetable(true);
    try {
      await academicAPI.deleteTimetableEntry(deletingTimetable.id);
      setTimetable(prev => prev.filter(t => t.id !== deletingTimetable.id));
      showToast('success', 'Timetable entry removed');
      setDeletingTimetable(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingTimetable(null);
    } finally { setIsDeletingTimetable(false); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const getConfigName = () => {
    if (!config) return '';
    const section = config.class_section_name ? ` ${config.class_section_name}` : '';
    return `${className || 'Class'}${section}`;
  };

  const getStaffName = (id: number | '' | null | undefined) => {
    if (!id) return 'Not assigned';
    return staffOptions.find(s => s.id === id)?.name ?? `Staff #${id}`;
  };
  const getStudentName = (id: number | '' | null | undefined) => {
    if (!id) return 'Not assigned';
    return configStudentOptions.find(s => s.id === id)?.name ?? `Student #${id}`;
  };

  // Subject modal helpers — check/uncheck all
  const filteredModalSubjects = availableSubjects.filter(s =>
    !subjectModalSearch ||
    s.name.toLowerCase().includes(subjectModalSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(subjectModalSearch.toLowerCase())
  );
  const allModalSubjectIds = filteredModalSubjects.map(s => s.id);
  const allModalSelected = allModalSubjectIds.length > 0 && allModalSubjectIds.every(id => selectedSubjectIds.includes(id));
  const someModalSelected = allModalSubjectIds.some(id => selectedSubjectIds.includes(id)) && !allModalSelected;

  const toggleAllModalSubjects = () => {
    if (allModalSelected) {
      setSelectedSubjectIds(prev => prev.filter(id => !allModalSubjectIds.includes(id)));
    } else {
      setSelectedSubjectIds(prev => Array.from(new Set([...prev, ...allModalSubjectIds])));
    }
  };

  // Timetable grouped by day
  const timetableByDay = days.reduce((acc, day) => {
    acc[day.id] = timetable
      .filter(t => t.day === day.id || (t.day as any)?.id === day.id)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return acc;
  }, {} as Record<number, Timetable[]>);

  const activeDays = days.filter(d => (timetableByDay[d.id] ?? []).length > 0);

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  if (!canView) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-sm text-slate-400">Loading class configuration...</p>
      </div>
    </div>
  );

  if (pageError || !config) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
        <p className="text-slate-600">{pageError || 'Configuration not found'}</p>
        <button onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDeleteModal
        open={!!deletingSubjectConfig}
        label={deletingSubjectConfig?.subject_name ?? 'this subject'}
        isDeleting={isDeletingSubject}
        onConfirm={handleDeleteSubject}
        onCancel={() => setDeletingSubjectConfig(null)}
      />
      <ConfirmDeleteModal
        open={!!deletingTimetable}
        label={deletingTimetable?.subject_name ?? deletingTimetable?.break_type ?? 'this entry'}
        isDeleting={isDeletingTimetable}
        onConfirm={handleDeleteTimetable}
        onCancel={() => setDeletingTimetable(null)}
      />

      {showTimetableModal && (
        <TimetableModal
          editing={editingTimetable}
          configId={configId}
          days={days}
          subjects={assignedSubjects}
          staffOptions={staffOptions}
          isSaving={savingTimetable}
          onSave={handleSaveTimetable}
          onClose={() => { setShowTimetableModal(false); setEditingTimetable(null); }}
        />
      )}

      {/* FIX #3: Assign teachers modal using text-category pattern */}
      {editingSubjectConfig && (
        <AssignTeachersModal
          subjectName={editingSubjectConfig.subject_name ?? 'Subject'}
          assignedTeacherIds={editingSubjectConfig.teachers as number[] ?? []}
          allStaff={staffOptions}
          isSaving={savingSubjectTeachers}
          onSave={handleSaveSubjectTeachers}
          onClose={() => setEditingSubjectConfig(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            {getConfigName()}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">
            {config.student_count ?? 0} student(s) enrolled
            {config.max_capacity ? ` · Max ${config.max_capacity}` : ''}
            {config.is_active
              ? <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
              : <span className="ml-2 inline-flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Inactive</span>}
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {[
            { key: 'teachers',  label: 'Teachers & Reps',              icon: UserCheck },
            { key: 'subjects',  label: `Subjects (${assignedSubjects.length})`, icon: BookOpen },
            { key: 'students',  label: `Students (${config.student_count ?? 0})`, icon: Users },
            { key: 'timetable', label: `Timetable (${timetable.length})`, icon: Calendar },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as Tab)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === key
                  ? 'text-blue-600 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* ══ TAB 1: TEACHERS & REPS ══ */}
        {activeTab === 'teachers' && (
          <div className="p-6">
            {!editingTeachers ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Current Assignments</h3>
                  {/* FIX #1: Fancy amber/yellow edit button */}
                  {canEdit && (
                    <button onClick={() => setEditingTeachers(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 hover:from-amber-100 hover:to-yellow-100 hover:border-amber-300 transition-all shadow-sm shadow-amber-100">
                      <Edit3 className="h-3.5 w-3.5" /> Edit Assignments
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: 'Form Teacher',       value: getStaffName(config.form_teacher as any),            icon: UserCheck, color: 'from-blue-500 to-blue-600' },
                    { label: 'Asst. Form Teacher', value: getStaffName(config.assistant_form_teacher as any),  icon: UserCheck, color: 'from-indigo-400 to-indigo-600' },
                    { label: 'Max Capacity',       value: config.max_capacity ? String(config.max_capacity) : 'School default', icon: Users, color: 'from-emerald-400 to-teal-500' },
                    { label: 'Class Rep',          value: getStudentName(config.class_rep as any),             icon: UserCircle, color: 'from-violet-400 to-purple-600' },
                    { label: 'Asst. Class Rep',    value: getStudentName(config.assistant_class_rep as any),   icon: UserCircle, color: 'from-pink-400 to-rose-500' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
                      <div className={`w-8 h-8 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                        <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveTeachers} className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Edit Assignments</h3>
                  {/* Amber banner to signal edit mode */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                    <Edit3 className="h-3 w-3" /> Editing mode
                  </span>
                </div>

                {teacherFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{teacherFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Form Teacher</label>
                    <SearchSelect options={staffOptions} value={teacherForm.form_teacher}
                      onChange={v => setTeacherForm(p => ({ ...p, form_teacher: v }))}
                      placeholder="Search form teacher" />
                  </div>
                  <div>
                    <label className={labelCls}>Assistant Form Teacher</label>
                    <SearchSelect options={staffOptions} value={teacherForm.assistant_form_teacher}
                      onChange={v => setTeacherForm(p => ({ ...p, assistant_form_teacher: v }))}
                      placeholder="Search assistant form teacher" />
                  </div>
                  <div>
                    <label className={labelCls}>Class Representative</label>
                    {/* FIX #6: uses configStudentOptions (only students in THIS config) */}
                    <SearchSelect options={configStudentOptions} value={teacherForm.class_rep}
                      onChange={v => setTeacherForm(p => ({ ...p, class_rep: v }))}
                      placeholder="Search class rep (student)" />
                    <p className="text-xs text-slate-400 mt-1">Only students in this section are shown</p>
                  </div>
                  <div>
                    <label className={labelCls}>Assistant Class Representative</label>
                    <SearchSelect options={configStudentOptions} value={teacherForm.assistant_class_rep}
                      onChange={v => setTeacherForm(p => ({ ...p, assistant_class_rep: v }))}
                      placeholder="Search assistant class rep" />
                  </div>
                  <div>
                    <label className={labelCls}>Max Capacity Override</label>
                    <input type="number" min={1} value={teacherForm.max_capacity}
                      onChange={e => setTeacherForm(p => ({ ...p, max_capacity: e.target.value ? Number(e.target.value) : '' }))}
                      placeholder="Leave blank to use school default" className={inputCls} />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                  <button type="button" onClick={() => { setEditingTeachers(false); setTeacherFormError(null); }}
                    disabled={savingTeachers}
                    className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingTeachers}
                    className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
                    {savingTeachers
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                      : <><Save className="h-4 w-4" />Save Changes</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ══ TAB 2: SUBJECTS ══ */}
        {activeTab === 'subjects' && (
          <div>
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search assigned subjects..."
                  value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
              {/* FIX #1: Amber add subjects button */}
              {canAddSub && availableSubjects.length > 0 && (
                <button onClick={() => { setSubjectModalSearch(''); setShowSubjectModal(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 hover:from-amber-100 hover:to-yellow-100 hover:border-amber-300 transition-all shadow-sm shadow-amber-100 flex-shrink-0">
                  <Plus className="h-4 w-4" /> Add Subjects
                </button>
              )}
            </div>

            {assignedSubjects.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-6 w-6 text-slate-300" />
                </div>
                <h3 className="font-semibold text-slate-700 mb-1">No subjects assigned</h3>
                <p className="text-sm text-slate-400">Add subjects to this class configuration</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_1fr_100px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assigned Teachers</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {assignedSubjects
                    .filter(sc => !subjectSearch || sc.subject_name?.toLowerCase().includes(subjectSearch.toLowerCase()))
                    .map(sc => (
                      <div key={sc.id} className="grid grid-cols-[1fr_1fr_100px] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                          </div>
                          <p className="text-sm font-semibold text-slate-800 truncate">{sc.subject_name}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 min-w-0">
                          {sc.teacher_names && sc.teacher_names.length > 0
                            ? sc.teacher_names.map((n, i) => (
                                <span key={i} className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium rounded-lg truncate">
                                  {n}
                                </span>
                              ))
                            : <span className="text-xs text-slate-400 italic">No teachers</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {canEdit && (
                            <button onClick={() => setEditingSubjectConfig(sc)}
                              title="Assign teachers"
                              className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                              <Users className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelSub && (
                            <button onClick={() => setDeletingSubjectConfig(sc)}
                              title="Remove subject"
                              className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
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
                  configId={configId}
                  configName={getConfigName()}
                  studentClassId={config.student_class as number}
                  classSectionId={config.class_section as number}
                />
        )}

        {/* ══ TAB 4: TIMETABLE ══ */}
        {activeTab === 'timetable' && (
          <div>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-500">
                {timetable.length} entr{timetable.length === 1 ? 'y' : 'ies'} across {activeDays.length} day(s)
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => router.push(`/dashboard/staff/academic/timetable?config_id=${configId}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" /> Full View
                </button>
                {canEditTT && (
                  <button onClick={() => { setEditingTimetable(null); setShowTimetableModal(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200">
                    <Plus className="h-4 w-4" /> Add Entry
                  </button>
                )}
              </div>
            </div>

            {timetable.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Calendar className="h-6 w-6 text-slate-300" />
                </div>
                <h3 className="font-semibold text-slate-700 mb-1">No timetable entries</h3>
                <p className="text-sm text-slate-400">Add schedule entries for this class</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(activeDays.length > 0 ? activeDays : days).map(day => {
                  const entries = timetableByDay[day.id] ?? [];
                  if (entries.length === 0) return null;
                  return (
                    <div key={day.id}>
                      <div className="px-5 py-2.5 bg-slate-50/80 flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{day.name}</span>
                        <span className="text-xs text-slate-400">({entries.length} period{entries.length !== 1 ? 's' : ''})</span>
                      </div>
                      {entries.map(entry => {
                        const isBreak = !!entry.break_type;
                        const breakMeta = entry.break_type ? BREAK_META[entry.break_type] : null;
                        const fmt = (t: string) => {
                          const [h, m] = t.split(':');
                          const hr = parseInt(h);
                          return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
                        };
                        return (
                          <div key={entry.id} className="grid grid-cols-[120px_1fr_auto] items-center gap-4 px-5 py-3 hover:bg-slate-50/50 transition-colors border-t border-slate-50">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                              <span className="font-mono font-semibold">{fmt(entry.start_time)}<br /><span className="text-slate-400">{fmt(entry.end_time)}</span></span>
                            </div>
                            {isBreak ? (
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${breakMeta?.bg} ${breakMeta?.text} w-fit`}>
                                {breakMeta?.icon}
                                {breakMeta?.label}
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{entry.subject_name}</p>
                                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                    {entry.teacher_name && <span className="flex items-center gap-1"><UserCircle className="h-3 w-3" />{entry.teacher_name}</span>}
                                    {entry.classroom && <span>· {entry.classroom}</span>}
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              {canEditTT && (
                                <button onClick={() => { setEditingTimetable(entry); setShowTimetableModal(true); }}
                                  className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {canDelTT && (
                                <button onClick={() => setDeletingTimetable(entry)}
                                  className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Add Subjects Modal ══ */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '88vh' }}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Add Subjects
              </h3>
              <button onClick={() => { setShowSubjectModal(false); setSelectedSubjectIds([]); setSubjectModalError(null); }}
                disabled={savingSubjects}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            {subjectModalError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{subjectModalError}</span>
              </div>
            )}

            <div className="overflow-y-auto flex-1 min-h-0 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <p className="text-sm text-slate-500">
                  Select subjects to assign.
                  {selectedSubjectIds.length > 0 && <span className="ml-1 font-semibold text-blue-600">{selectedSubjectIds.length} selected</span>}
                </p>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" placeholder="Search available subjects..."
                    value={subjectModalSearch} onChange={e => setSubjectModalSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              {/* FIX #2: Check all / Uncheck all */}
              {availableSubjects.length > 0 && (
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
                    {subjectModalSearch ? ' shown' : ' available'}
                  </span>
                </div>
              )}

              {availableSubjects.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">All available subjects are already assigned.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredModalSubjects.map(subject => {
                    const checked = selectedSubjectIds.includes(subject.id);
                    return (
                      <label key={subject.id}
                        className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                          checked ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200 bg-white'
                        }`}
                        onClick={() => setSelectedSubjectIds(prev =>
                          checked ? prev.filter(id => id !== subject.id) : [...prev, subject.id]
                        )}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                        }`}>
                          {checked && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <input type="checkbox" checked={checked} readOnly className="sr-only" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{subject.name}</p>
                          <p className="text-xs text-slate-400 capitalize">{subject.subject_type} · {subject.code}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
              <button type="button" onClick={() => { setShowSubjectModal(false); setSelectedSubjectIds([]); setSubjectModalError(null); }}
                disabled={savingSubjects}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleBulkAddSubjects}
                disabled={savingSubjects || selectedSubjectIds.length === 0}
                className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
                {savingSubjects
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Adding...</>
                  : <><Check className="h-4 w-4" />Add {selectedSubjectIds.length > 0 ? selectedSubjectIds.length : ''} Subject(s)</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}