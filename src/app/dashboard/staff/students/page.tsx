'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  studentsAPI, parentsAPI, utilityAPI, studentCustomFieldsAPI,
  academicAPI, academicCalendarAPI, studentSettingsAPI,
} from '@/lib/api';
import { CustomField } from '@/lib/types';
import {
  Users, Plus, Search, X, Check, AlertCircle, Loader2,
  RefreshCw, Eye, ChevronLeft, ChevronRight, Phone, Mail,
  Filter, Download, FileSpreadsheet, FileText, SlidersHorizontal,
  ChevronDown, UserPlus, GraduationCap, UserCircle, Heart,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
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

// ─── Constants ─────────────────────────────────────────────────────────────────
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

const PAGE_SIZE = 25;

// ─── Export fields ─────────────────────────────────────────────────────────────
const ALL_EXPORT_FIELDS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'full_name',           label: 'Full Name',       defaultOn: true  },
  { key: 'registration_number', label: 'Reg Number',      defaultOn: true  },
  { key: 'gender',              label: 'Gender',          defaultOn: true  },
  { key: 'current_class',       label: 'Class',           defaultOn: true  },
  { key: 'status',              label: 'Status',          defaultOn: true  },
  { key: 'date_of_birth',       label: 'Date of Birth',   defaultOn: false },
  { key: 'religion',            label: 'Religion',        defaultOn: false },
  { key: 'state',               label: 'State',           defaultOn: false },
  { key: 'lga',                 label: 'LGA',             defaultOn: false },
  { key: 'mobile',              label: 'Mobile',          defaultOn: false },
  { key: 'email',               label: 'Email',           defaultOn: false },
  { key: 'current_class_section', label: 'Section',       defaultOn: false },
  { key: 'parent_name',         label: 'Parent Name',     defaultOn: false },
  { key: 'parent_mobile',       label: 'Parent Mobile',   defaultOn: false },
  { key: 'is_special_need',     label: 'Special Needs',   defaultOn: false },
  { key: 'created_at',          label: 'Registered',      defaultOn: false },
];

const DEFAULT_FIELDS = new Set(ALL_EXPORT_FIELDS.filter(f => f.defaultOn).map(f => f.key));

// ─── Filter State ──────────────────────────────────────────────────────────────
interface FilterState {
  status: string;
  gender: string;
  current_class: string;
  current_class_section: string;
  religion: string;
  state: string;
  lga: string;
  min_age: string;
  max_age: string;
  session_id: string;
  is_special_need: string;
  parent_id: string;
  parent_name: string; // display only
}

const EMPTY_FILTERS: FilterState = {
  status: 'active', gender: '', current_class: '', current_class_section: '',
  religion: '', state: '', lga: '', min_age: '', max_age: '',
  session_id: '', is_special_need: '', parent_id: '', parent_name: '',
};

// ─── Field Checkbox ────────────────────────────────────────────────────────────
function FieldCheckbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: () => void;
}) {
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

// ─── Parent Search (inside filter modal) ──────────────────────────────────────
function ParentSearch({ selectedId, selectedName, onSelect, onClear }: {
  selectedId: string; selectedName: string;
  onSelect: (id: string, name: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const debounce              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (search.trim().length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await parentsAPI.list({ search: search.trim(), page_size: 8 });
        const data = (res as any)?.results ?? (res as any)?.data ?? res ?? [];
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, [search]);

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';

  if (selectedId) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5 border border-blue-300 bg-blue-50 rounded-xl">
        <UserCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <span className="text-sm text-blue-800 font-medium flex-1 truncate">{selectedName}</span>
        <button onClick={onClear} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className={`${inputCls} pl-10`}
          placeholder="Search parent by name or ID…"
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
          {results.map(p => (
            <button key={p.id} type="button"
              onClick={() => {
                const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
                onSelect(String(p.id), toTitleCase(name));
                setSearch(''); setResults([]); setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-0">
              <UserCircle className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {toTitleCase(p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim())}
                </p>
                <p className="text-[11px] text-slate-400">{p.parent_id} {p.mobile ? `• ${p.mobile}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter + Field Modal ──────────────────────────────────────────────────────
function FilterModal({
  open, filters, classes, sections, sessions, states, lgas,
  loadingLgas, useClassSections, selectedFields, selectedCfIds, customFields,
  onClassChange, onStateChange, onApply, onClose, onReset,
}: {
  open: boolean;
  filters: FilterState;
  classes: any[];
  sections: any[];
  sessions: any[];
  states: string[];
  lgas: string[];
  loadingLgas: boolean;
  useClassSections: boolean;
  selectedFields: Set<string>;
  selectedCfIds: Set<number>;
  customFields: CustomField[];
  onClassChange: (id: string) => void;
  onStateChange: (state: string) => void;
  onApply: (f: FilterState, fields: Set<string>, cfIds: Set<number>) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const [local, setLocal]             = useState<FilterState>(filters);
  const [localFields, setLocalFields] = useState<Set<string>>(new Set(selectedFields));
  const [localCfIds, setLocalCfIds]   = useState<Set<number>>(new Set(selectedCfIds));

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  useEffect(() => {
    if (open) {
      setLocal(filters);
      setLocalFields(new Set(selectedFields));
      setLocalCfIds(new Set(selectedCfIds));
    }
  }, [open, filters, selectedFields, selectedCfIds]);

  const set = (k: keyof FilterState, v: string) => {
    setLocal(p => ({ ...p, [k]: v }));
    if (k === 'current_class') { onClassChange(v); setLocal(p => ({ ...p, current_class_section: '' })); }
    if (k === 'state') { onStateChange(v); setLocal(p => ({ ...p, lga: '' })); }
  };

  const toggleField = (key: string) => setLocalFields(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const toggleCf = (id: number) => setLocalCfIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <SlidersHorizontal className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Filters & Export Fields</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="h-4 w-4" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">

          {/* ── FILTERS ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Filters</p>
            </div>

            {/* Basic */}
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Basic</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={local.status} onChange={e => set('status', e.target.value)}>
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select className={inputCls} value={local.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">All genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Religion</label>
                <select className={inputCls} value={local.religion} onChange={e => set('religion', e.target.value)}>
                  <option value="">All religions</option>
                  <option value="christianity">Christianity</option>
                  <option value="islam">Islam</option>
                  <option value="traditional">Traditional</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Special Needs</label>
                <select className={inputCls} value={local.is_special_need} onChange={e => set('is_special_need', e.target.value)}>
                  <option value="">All</option>
                  <option value="true">Special needs only</option>
                  <option value="false">No special needs</option>
                </select>
              </div>
            </div>

            {/* Academic */}
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Academic</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>Class</label>
                <select className={inputCls} value={local.current_class} onChange={e => set('current_class', e.target.value)}>
                  <option value="">All classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {useClassSections && (
                <div>
                  <label className={labelCls}>Class Section</label>
                  <select className={inputCls} value={local.current_class_section}
                    onChange={e => set('current_class_section', e.target.value)}
                    disabled={!local.current_class || sections.length === 0}>
                    <option value="">{local.current_class ? 'All sections' : 'Select class first'}</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>Admission Session</label>
                <select className={inputCls} value={local.session_id} onChange={e => set('session_id', e.target.value)}>
                  <option value="">All sessions</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}-{s.end_year}</option>)}
                </select>
              </div>
            </div>

            {/* Age Range */}
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Age Range</p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>Min Age (years)</label>
                <input className={inputCls} type="number" min="1" max="30" placeholder="e.g. 5"
                  value={local.min_age} onChange={e => set('min_age', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Max Age (years)</label>
                <input className={inputCls} type="number" min="1" max="30" placeholder="e.g. 18"
                  value={local.max_age} onChange={e => set('max_age', e.target.value)} />
              </div>
            </div>

            {/* Location */}
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Location</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>State of Origin</label>
                <select className={inputCls} value={local.state} onChange={e => set('state', e.target.value)}>
                  <option value="">All states</option>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>LGA</label>
                <select className={inputCls} value={local.lga} onChange={e => set('lga', e.target.value)}
                  disabled={!local.state || loadingLgas}>
                  <option value="">{loadingLgas ? 'Loading…' : local.state ? 'All LGAs' : 'Select state first'}</option>
                  {lgas.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Parent */}
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Guardian</p>
            <div className="mb-2">
              <label className={labelCls}>Filter by Guardian</label>
              <ParentSearch
                selectedId={local.parent_id}
                selectedName={local.parent_name}
                onSelect={(id, name) => setLocal(p => ({ ...p, parent_id: id, parent_name: name }))}
                onClear={() => setLocal(p => ({ ...p, parent_id: '', parent_name: '' }))}
              />
            </div>
          </div>

          {/* ── EXPORT FIELDS ── */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Export Fields</p>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Choose which columns appear in Excel / PDF downloads.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
              {ALL_EXPORT_FIELDS.map(f => (
                <FieldCheckbox key={f.key} label={f.label}
                  checked={localFields.has(f.key)} onChange={() => toggleField(f.key)} />
              ))}
            </div>
            {customFields.length > 0 && (
              <>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-4 mb-3">Custom Fields</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                  {customFields.map(cf => (
                    <FieldCheckbox key={cf.id} label={cf.field_name}
                      checked={localCfIds.has(cf.id)} onChange={() => toggleCf(cf.id)} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={() => {
            setLocal({ ...EMPTY_FILTERS });
            setLocalFields(new Set(DEFAULT_FIELDS));
            setLocalCfIds(new Set());
            onReset();
          }} className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
            Reset all
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={() => onApply(local, localFields, localCfIds)}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm">
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Download Dropdown ─────────────────────────────────────────────────────────
function DownloadDropdown({ onExcel, onPDF, downloading }: {
  onExcel: () => void; onPDF: () => void; downloading: boolean;
}) {
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
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50">
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
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
            <p className="text-[11px] text-slate-400">
              To change fields, open <span className="font-semibold text-slate-500">Filters</span> → Export Fields
            </p>
          </div>
        </div>
      )}
    </div>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [students, setStudents]       = useState<any[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [toasts, setToasts]           = useState<ToastItem[]>([]);
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [filters, setFilters]               = useState<FilterState>(EMPTY_FILTERS);
  const [pendingSearch, setPendingSearch]   = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Export fields
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_FIELDS));
  const [selectedCfIds, setSelectedCfIds]   = useState<Set<number>>(new Set());

  // Reference data
  const [classes, setClasses]           = useState<any[]>([]);
  const [sections, setSections]         = useState<any[]>([]);
  const [sessions, setSessions]         = useState<any[]>([]);
  const [states, setStates]             = useState<string[]>([]);
  const [lgas, setLgas]                 = useState<string[]>([]);
  const [loadingLgas, setLoadingLgas]   = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [useClassSections, setUseClassSections] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canCreate     = user?.is_superuser || hasPermission('student_management.add_studentmodel');
  const canEdit       = user?.is_superuser || hasPermission('student_management.change_studentmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Load reference data
  useEffect(() => {
    utilityAPI.getStates().then((s: string[]) => setStates(Array.isArray(s) ? s : [])).catch(() => {});
    studentCustomFieldsAPI.list('student').then((f: CustomField[]) => {
      setCustomFields(f.filter(cf => cf.is_active));
    }).catch(() => {});
    academicAPI.listClasses().then((c: any[]) => setClasses(Array.isArray(c) ? c : [])).catch(() => {});
    academicCalendarAPI.listSessions().then((s: any[]) => setSessions(Array.isArray(s) ? s : [])).catch(() => {});
    academicAPI.getSettings().then((s: any) => {
      setUseClassSections(s?.use_class_sections === true);
    }).catch(() => {});
  }, []);

  const handleClassChange = (classId: string) => {
    if (!classId) { setSections([]); return; }
    const cls = classes.find(c => String(c.id) === classId);
    if (!cls?.configurations?.length) { setSections([]); return; }
    const seen = new Set<number>();
    const extracted: any[] = [];
    for (const config of cls.configurations) {
      if (config.is_active && !seen.has(config.class_section)) {
        seen.add(config.class_section);
        extracted.push({ id: config.class_section, name: config.class_section_name });
      }
    }
    setSections(extracted);
  };

  const handleStateChange = (state: string) => {
    if (!state) { setLgas([]); return; }
    setLoadingLgas(true);
    utilityAPI.getLGAs(state)
      .then((l: string[]) => setLgas(Array.isArray(l) ? l : []))
      .catch(() => setLgas([]))
      .finally(() => setLoadingLgas(false));
  };

  const buildParams = useCallback((f: FilterState, pg: number) => {
    const p: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
    if (pendingSearch)        p.search                = pendingSearch;
    if (f.status)             p.status                = f.status;
    if (f.gender)             p.gender                = f.gender;
    if (f.current_class)      p.current_class         = f.current_class;
    if (f.current_class_section) p.current_class_section = f.current_class_section;
    if (f.religion)           p.religion              = f.religion;
    if (f.state)              p.state                 = f.state;
    if (f.lga)                p.lga                   = f.lga;
    if (f.min_age)            p.min_age               = f.min_age;
    if (f.max_age)            p.max_age               = f.max_age;
    if (f.session_id)         p.session_id            = f.session_id;
    if (f.is_special_need)    p.is_special_need       = f.is_special_need;
    if (f.parent_id)          p.parent_id             = f.parent_id;
    return p;
  }, [pendingSearch]);

  const buildExportParams = useCallback((f: FilterState) => {
    const p: Record<string, any> = { ...buildParams(f, 1) };
    delete p.page; delete p.page_size;
    if (selectedFields.size > 0) p.fields = Array.from(selectedFields).join(',');
    if (selectedCfIds.size > 0)  p.custom_field_ids = Array.from(selectedCfIds).join(',');
    return p;
  }, [buildParams, selectedFields, selectedCfIds]);

  const fetchStudents = useCallback(async (f: FilterState, pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const data = await studentsAPI.list(buildParams(f, pg));
      const results = (data as any)?.results ?? (data as any)?.data ?? data ?? [];
      setStudents(Array.isArray(results) ? results : []);
      setTotal((data as any)?.count ?? results.length);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [buildParams]);

  // Debounce search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchStudents(filters, 1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [pendingSearch]);

  useEffect(() => { fetchStudents(EMPTY_FILTERS, 1); }, []);

  const applyFilters = (f: FilterState, fields: Set<string>, cfIds: Set<number>) => {
    setFilters(f);
    setSelectedFields(fields);
    setSelectedCfIds(cfIds);
    fetchStudents(f, 1);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setPendingSearch('');
    setFilters(EMPTY_FILTERS);
    setSelectedFields(new Set(DEFAULT_FIELDS));
    setSelectedCfIds(new Set());
    fetchStudents(EMPTY_FILTERS, 1);
    setShowFilterModal(false);
  };

  const removeFilter = (key: keyof FilterState) => {
    const next = { ...filters, [key]: '' };
    if (key === 'state') next.lga = '';
    if (key === 'current_class') next.current_class_section = '';
    if (key === 'parent_id') next.parent_name = '';
    setFilters(next);
    fetchStudents(next, 1);
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try { await studentsAPI.downloadListExcel(buildExportParams(filters)); }
    catch { showToast('error', 'Failed to download Excel file'); }
    finally { setDownloading(false); }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try { await studentsAPI.downloadListPDF(buildExportParams(filters)); }
    catch { showToast('error', 'Failed to download PDF file'); }
    finally { setDownloading(false); }
  };

  // Active filter chips
  const sessionName = sessions.find(s => String(s.id) === filters.session_id)?.name || filters.session_id;
  const className   = classes.find(c => String(c.id) === filters.current_class)?.name || filters.current_class;
  const sectionName = sections.find(s => String(s.id) === filters.current_class_section)?.name || filters.current_class_section;

  const activeFilterChips: { key: keyof FilterState; label: string }[] = [
    filters.status !== 'active' && filters.status && { key: 'status', label: `Status: ${filters.status}` },
    filters.gender             && { key: 'gender',               label: `Gender: ${filters.gender}` },
    filters.current_class      && { key: 'current_class',        label: `Class: ${className}` },
    filters.current_class_section && { key: 'current_class_section', label: `Section: ${sectionName}` },
    filters.religion           && { key: 'religion',             label: `Religion: ${filters.religion}` },
    filters.state              && { key: 'state',                label: `State: ${filters.state}` },
    filters.lga                && { key: 'lga',                  label: `LGA: ${filters.lga}` },
    filters.min_age            && { key: 'min_age',              label: `Min age: ${filters.min_age}` },
    filters.max_age            && { key: 'max_age',              label: `Max age: ${filters.max_age}` },
    filters.session_id         && { key: 'session_id',           label: `Session: ${sessionName}` },
    filters.is_special_need    && { key: 'is_special_need',      label: filters.is_special_need === 'true' ? 'Special needs' : 'No special needs' },
    filters.parent_id          && { key: 'parent_id',            label: `Guardian: ${filters.parent_name || filters.parent_id}` },
  ].filter(Boolean) as { key: keyof FilterState; label: string }[];

  const hasFilters  = !!(pendingSearch || activeFilterChips.length);
  const totalPages  = Math.ceil(total / PAGE_SIZE);
  const activeCount = students.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <FilterModal
        open={showFilterModal}
        filters={filters}
        classes={classes}
        sections={sections}
        sessions={sessions}
        states={states}
        lgas={lgas}
        loadingLgas={loadingLgas}
        useClassSections={useClassSections}
        selectedFields={selectedFields}
        selectedCfIds={selectedCfIds}
        customFields={customFields}
        onClassChange={handleClassChange}
        onStateChange={handleStateChange}
        onApply={applyFilters}
        onClose={() => setShowFilterModal(false)}
        onReset={resetFilters}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            Students
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage student records</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DownloadDropdown onExcel={handleDownloadExcel} onPDF={handleDownloadPDF} downloading={downloading} />
          {canCreate && (
            <button onClick={() => router.push('/dashboard/staff/students/register')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> Register Student
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: total,                                         color: 'from-blue-500 to-blue-600'    },
          { label: 'Active',      value: activeCount,                                   color: 'from-emerald-500 to-teal-600' },
          { label: 'This Page',   value: students.length,                               color: 'from-violet-500 to-purple-600'},
          { label: 'Special Needs', value: students.filter(s => s.is_special_need).length, color: 'from-rose-400 to-pink-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <GraduationCap className="h-4 w-4 text-white" />
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

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-50 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search by name, reg number, email, mobile…"
                value={pendingSearch} onChange={e => setPendingSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              {pendingSearch && (
                <button onClick={() => setPendingSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFilterModal(true)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold border rounded-xl transition-all ${
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
                  <X className="h-3.5 w-3.5" /> Clear all
                </button>
              )}
              <button onClick={() => fetchStudents(filters, page)} title="Refresh"
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
            <button onClick={() => fetchStudents(filters, 1)}
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
              {hasFilters ? 'No students match your filters' : 'No students yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Register your first student to get started.'}
            </p>
            {hasFilters
              ? <button onClick={resetFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              : canCreate && (
                <button onClick={() => router.push('/dashboard/staff/students/register')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200">
                  <Plus className="h-4 w-4" /> Register Student
                </button>
              )
            }
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1fr 140px 120px 80px 80px' }}>
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Guardian</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {students.map(s => {
                const status  = STATUS_META[s.status ?? 'active'] ?? STATUS_META.active;
                const gender  = GENDER_META[s.gender ?? ''];
                const fullName = toTitleCase(s.full_name ?? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim());
                const classDisplay = [s.current_class_name, s.current_class_section_name].filter(Boolean).join(' ');
                const parentName = toTitleCase(s.parent_name ?? '');

                return (
                  <div key={s.id}
                    className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                    style={{ gridTemplateColumns: '2.5rem 1fr 140px 120px 80px 80px' }}>

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
                          <span title="Special needs" className="flex-shrink-0 flex items-center">
                            <Heart className="h-3 w-3 text-rose-400" />
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

                    {/* Guardian */}
                    <div className="hidden sm:block min-w-0">
                      {parentName ? (
                        <button onClick={() => s.parent && router.push(`/dashboard/staff/students/guardians/${s.parent}`)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium truncate block text-left transition-colors">
                          {parentName}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
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
                        title="View" className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canCreate && (
                        <button onClick={() => router.push(`/dashboard/staff/students/register/${s.parent}`)}
                          title="Register Sibling" className="p-1.5 rounded-lg text-violet-600 bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-all">
                          <UserPlus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> student{total !== 1 ? 's' : ''}
                {hasFilters && <span className="ml-1 text-blue-500 font-medium">(filtered)</span>}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchStudents(filters, page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchStudents(filters, pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchStudents(filters, page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}