'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { parentsAPI, utilityAPI, studentCustomFieldsAPI } from '@/lib/api';
import { Parent, CustomField } from '@/lib/types';
import {
  UserCheck, Plus, Edit3, Search, X, Check,
  AlertCircle, Loader2, RefreshCw, Eye,
  ChevronLeft, ChevronRight, Users, Phone, Mail,
  Filter, Download, FileSpreadsheet, FileText, SlidersHorizontal,
  ChevronDown, UserPlus,
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
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
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
  active:    { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  suspended: { label: 'Suspended', dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-100'  },
  inactive:  { label: 'Inactive',  dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-100',  border: 'border-slate-200'   },
};

const GENDER_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  male:   { label: 'Male',   color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
  female: { label: 'Female', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-100' },
};

const PAGE_SIZE = 20;

// ─── Export field definitions ──────────────────────────────────────────────────
const ALL_EXPORT_FIELDS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'full_name',      label: 'Full Name',      defaultOn: true  },
  { key: 'parent_id',      label: 'Parent ID',      defaultOn: true  },
  { key: 'mobile',         label: 'Mobile',         defaultOn: true  },
  { key: 'email',          label: 'Email',          defaultOn: true  },
  { key: 'gender',         label: 'Gender',         defaultOn: false },
  { key: 'date_of_birth',  label: 'Date of Birth',  defaultOn: false },
  { key: 'marital_status', label: 'Marital Status', defaultOn: false },
  { key: 'religion',       label: 'Religion',       defaultOn: false },
  { key: 'state',          label: 'State',          defaultOn: false },
  { key: 'lga',            label: 'LGA',            defaultOn: false },
  { key: 'address',        label: 'Address',        defaultOn: false },
  { key: 'occupation',     label: 'Occupation',     defaultOn: false },
  { key: 'office_mobile',  label: 'Office Mobile',  defaultOn: false },
  { key: 'office_address', label: 'Office Address', defaultOn: false },
  { key: 'wards_count',    label: 'Wards Count',    defaultOn: false },
  { key: 'status',         label: 'Status',         defaultOn: false },
  { key: 'created_at',     label: 'Registered',     defaultOn: false },
];

const DEFAULT_FIELDS = new Set(ALL_EXPORT_FIELDS.filter(f => f.defaultOn).map(f => f.key));

// ─── Filter State ──────────────────────────────────────────────────────────────
interface FilterState {
  search: string;
  status: string;
  gender: string;
  state: string;
  lga: string;
  occupation: string;
  has_wards: string;
  min_wards: string;
}

const EMPTY_FILTERS: FilterState = {
  search: '', status: '', gender: '', state: '',
  lga: '', occupation: '', has_wards: '', min_wards: '',
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

// ─── Filter + Field Modal ──────────────────────────────────────────────────────
function FilterModal({
  open, filters, states, lgas, loadingLgas,
  selectedFields, selectedCfIds, customFields,
  onStateChange, onApply, onClose, onReset,
}: {
  open: boolean;
  filters: FilterState;
  states: string[];
  lgas: string[];
  loadingLgas: boolean;
  selectedFields: Set<string>;
  selectedCfIds: Set<number>;
  customFields: CustomField[];
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
    if (k === 'state') { onStateChange(v); setLocal(p => ({ ...p, lga: '' })); }
  };

  const toggleField = (key: string) => setLocalFields(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const toggleCf = (id: number) => setLocalCfIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">

          {/* ── FILTERS SECTION ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Filters</p>
            </div>

            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Basic</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={local.status} onChange={e => set('status', e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
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
            </div>

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

            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Employment</p>
            <div className="mb-5">
              <label className={labelCls}>Occupation</label>
              <input className={inputCls} placeholder="e.g. Civil Servant, Teacher…"
                value={local.occupation} onChange={e => set('occupation', e.target.value)} />
            </div>

            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Wards</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Has Wards</label>
                <select className={inputCls} value={local.has_wards} onChange={e => set('has_wards', e.target.value)}>
                  <option value="">Any</option>
                  <option value="true">Has at least one ward</option>
                  <option value="false">No wards</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Minimum Wards</label>
                <input className={inputCls} type="number" min="1" placeholder="e.g. 2"
                  value={local.min_wards} onChange={e => set('min_wards', e.target.value)}
                  disabled={local.has_wards === 'false'} />
                <p className="text-[11px] text-slate-400 mt-1">Show guardians with at least this many wards</p>
              </div>
            </div>
          </div>

          {/* ── EXPORT FIELDS SECTION ── */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Export Fields</p>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Choose which columns appear in Excel / PDF downloads. Checked fields are included.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
              {ALL_EXPORT_FIELDS.map(f => (
                <FieldCheckbox
                  key={f.key}
                  label={f.label}
                  checked={localFields.has(f.key)}
                  onChange={() => toggleField(f.key)}
                />
              ))}
            </div>

            {customFields.length > 0 && (
              <>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-4 mb-3">
                  Custom Fields
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                  {customFields.map(cf => (
                    <FieldCheckbox
                      key={cf.id}
                      label={cf.field_name}
                      checked={localCfIds.has(cf.id)}
                      onChange={() => toggleCf(cf.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={() => {
            setLocal(EMPTY_FILTERS);
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
                <p className="text-[11px] text-slate-400">Printable guardian list</p>
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
      <button onClick={onRemove} className="hover:text-blue-900 transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function GuardiansPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [parents, setParents]         = useState<Parent[]>([]);
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

  // Export field selection — persisted across modal opens
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_FIELDS));
  const [selectedCfIds, setSelectedCfIds]   = useState<Set<number>>(new Set());

  // Reference data
  const [states, setStates]             = useState<string[]>([]);
  const [lgas, setLgas]                 = useState<string[]>([]);
  const [loadingLgas, setLoadingLgas]   = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canCreate     = user?.is_superuser || hasPermission('student_management.add_parentmodel');
  const canEdit       = user?.is_superuser || hasPermission('student_management.add_parentmodel');
  const canAddStudent = user?.is_superuser || hasPermission('student_management.add_studentmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Load reference data on mount
  useEffect(() => {
    utilityAPI.getStates().then((s: string[]) => setStates(Array.isArray(s) ? s : [])).catch(() => {});
    studentCustomFieldsAPI.list('parent').then((fields: CustomField[]) => {
      setCustomFields(fields.filter((f: CustomField) => f.is_active));
    }).catch(() => {});
  }, []);

  const handleFilterStateChange = (state: string) => {
    if (!state) { setLgas([]); return; }
    setLoadingLgas(true);
    utilityAPI.getLGAs(state)
      .then((l: string[]) => setLgas(Array.isArray(l) ? l : []))
      .catch(() => setLgas([]))
      .finally(() => setLoadingLgas(false));
  };

  const buildParams = useCallback((f: FilterState, pg: number) => {
    const p: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
    if (f.search)     p.search     = f.search;
    if (f.status)     p.status     = f.status;
    if (f.gender)     p.gender     = f.gender;
    if (f.state)      p.state      = f.state;
    if (f.lga)        p.lga        = f.lga;
    if (f.occupation) p.occupation = f.occupation;
    if (f.has_wards)  p.has_wards  = f.has_wards;
    if (f.min_wards)  p.min_wards  = f.min_wards;
    return p;
  }, []);

  const buildExportParams = useCallback((f: FilterState) => {
    const p: Record<string, any> = { ...buildParams(f, 1) };
    delete p.page; delete p.page_size;
    if (selectedFields.size > 0) p.fields = Array.from(selectedFields).join(',');
    if (selectedCfIds.size > 0)  p.custom_field_ids = Array.from(selectedCfIds).join(',');
    return p;
  }, [buildParams, selectedFields, selectedCfIds]);

  const fetchParents = useCallback(async (f: FilterState, pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const data = await parentsAPI.list(buildParams(f, pg));
      const results = (data as any)?.results ?? (data as any)?.data ?? data ?? [];
      setParents(Array.isArray(results) ? results : []);
      setTotal((data as any)?.count ?? results.length);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [buildParams]);

  // Debounce search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      const next = { ...filters, search: pendingSearch };
      setFilters(next);
      fetchParents(next, 1);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [pendingSearch]);

  // Initial load
  useEffect(() => { fetchParents(EMPTY_FILTERS, 1); }, []);

  const applyFilters = (f: FilterState, fields: Set<string>, cfIds: Set<number>) => {
    const next = { ...f, search: pendingSearch };
    setFilters(next);
    setSelectedFields(fields);
    setSelectedCfIds(cfIds);
    fetchParents(next, 1);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setPendingSearch('');
    setFilters(EMPTY_FILTERS);
    setSelectedFields(new Set(DEFAULT_FIELDS));
    setSelectedCfIds(new Set());
    fetchParents(EMPTY_FILTERS, 1);
    setShowFilterModal(false);
  };

  const removeFilter = (key: keyof FilterState) => {
    const next = { ...filters, [key]: '' };
    if (key === 'state') next.lga = '';
    setFilters(next);
    fetchParents(next, 1);
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try { await parentsAPI.downloadListExcel(buildExportParams(filters)); }
    catch { showToast('error', 'Failed to download Excel file'); }
    finally { setDownloading(false); }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try { await parentsAPI.downloadListPDF(buildExportParams(filters)); }
    catch { showToast('error', 'Failed to download PDF file'); }
    finally { setDownloading(false); }
  };

  const activeFilterChips: { key: keyof FilterState; label: string }[] = [
    filters.status     && { key: 'status',     label: `Status: ${filters.status}` },
    filters.gender     && { key: 'gender',     label: `Gender: ${filters.gender}` },
    filters.state      && { key: 'state',      label: `State: ${filters.state}` },
    filters.lga        && { key: 'lga',        label: `LGA: ${filters.lga}` },
    filters.occupation && { key: 'occupation', label: `Occupation: ${filters.occupation}` },
    filters.has_wards  && { key: 'has_wards',  label: filters.has_wards === 'true' ? 'Has wards' : 'No wards' },
    filters.min_wards  && { key: 'min_wards',  label: `Min wards: ${filters.min_wards}` },
  ].filter(Boolean) as { key: keyof FilterState; label: string }[];

  const hasFilters  = !!(pendingSearch || activeFilterChips.length);
  const totalPages  = Math.ceil(total / PAGE_SIZE);
  const activeCount    = parents.filter(p => p.status === 'active').length;
  const suspendedCount = parents.filter(p => p.status === 'suspended').length;

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <FilterModal
        open={showFilterModal}
        filters={filters}
        states={states}
        lgas={lgas}
        loadingLgas={loadingLgas}
        selectedFields={selectedFields}
        selectedCfIds={selectedCfIds}
        customFields={customFields}
        onStateChange={handleFilterStateChange}
        onApply={applyFilters}
        onClose={() => setShowFilterModal(false)}
        onReset={resetFilters}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            Student Guardians
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage parents and guardians</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DownloadDropdown onExcel={handleDownloadExcel} onPDF={handleDownloadPDF} downloading={downloading} />
          {canCreate && (
            <button onClick={() => router.push('/dashboard/staff/students/guardians/create')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> Add Guardian
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: total,          color: 'from-blue-500 to-blue-600'    },
          { label: 'Active',    value: activeCount,    color: 'from-emerald-500 to-teal-600' },
          { label: 'Suspended', value: suspendedCount, color: 'from-orange-400 to-amber-500' },
          { label: 'This Page', value: parents.length, color: 'from-violet-500 to-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <UserCheck className="h-4 w-4 text-white" />
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
              <input type="text" placeholder="Search by name, email, mobile, parent ID…"
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
              <button onClick={() => fetchParents(filters, page)} title="Refresh"
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
            <p className="mt-2 text-sm text-slate-400">Loading guardians...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchParents(filters, 1)}
              className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : parents.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UserCheck className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No guardians match your filters' : 'No guardians yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Add your first guardian to get started.'}
            </p>
            {hasFilters
              ? <button onClick={resetFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              : canCreate && (
                <button onClick={() => router.push('/dashboard/staff/students/guardians/create')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200">
                  <Plus className="h-4 w-4" /> Add Guardian
                </button>
              )
            }
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1fr 160px 90px 80px 108px' }}>
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Guardian</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Wards</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {parents.map(p => {
                const status   = STATUS_META[p.status ?? 'active'] ?? STATUS_META.active;
                const gender   = GENDER_META[p.gender ?? ''];
                const fullName = toTitleCase(p.full_name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim());

                return (
                  <div key={p.id}
                    className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                    style={{ gridTemplateColumns: '2.5rem 1fr 160px 90px 80px 108px' }}>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt={fullName}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-100 shadow-sm"
                          onError={e => {
                            const el = e.target as HTMLImageElement;
                            el.style.display = 'none';
                            el.parentElement!.innerHTML = `<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center"><svg class="h-4 w-4 text-indigo-400" ...></svg></div>`;
                          }} />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-indigo-400" />
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {p.parent_id && <span className="text-[11px] font-mono text-slate-400">{p.parent_id}</span>}
                        {gender && (
                          <span className={`px-1.5 py-0 rounded text-[11px] font-semibold border ${gender.bg} ${gender.color} ${gender.border}`}>
                            {gender.label}
                          </span>
                        )}
                        {p.occupation && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{toTitleCase(p.occupation)}</span>
                        )}
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="hidden sm:block min-w-0 space-y-0.5">
                      {p.mobile && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                          <Phone className="h-3 w-3 text-slate-300 flex-shrink-0" />
                          <span className="truncate">{p.mobile}</span>
                        </div>
                      )}
                      {p.email && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 truncate">
                          <Mail className="h-3 w-3 text-slate-300 flex-shrink-0" />
                          <span className="truncate">{p.email}</span>
                        </div>
                      )}
                      {!p.mobile && !p.email && <span className="text-xs text-slate-300">No contact</span>}
                    </div>

                    {/* Wards */}
                    <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-600">
                      <Users className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                      <span className="font-semibold">{p.wards_count ?? 0}</span>
                      <span className="text-xs text-slate-400">{(p.wards_count ?? 0) === 1 ? 'ward' : 'wards'}</span>
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
                      <button onClick={() => router.push(`/dashboard/staff/students/guardians/${p.id}`)}
                        title="View" className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canEdit && (
                        <button onClick={() => router.push(`/dashboard/staff/students/guardians/${p.id}/edit`)}
                          title="Edit" className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canAddStudent && (
                        <button
                          onClick={() => router.push(`/dashboard/staff/students/register/${p.id}`)}
                          title="Register Ward"
                          className="p-1.5 rounded-lg text-violet-600 bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-all">
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
                <span className="font-semibold text-slate-600">{total}</span> guardian{total !== 1 ? 's' : ''}
                {hasFilters && <span className="ml-1 text-blue-500 font-medium">(filtered)</span>}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchParents(filters, page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchParents(filters, pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchParents(filters, page + 1)} disabled={page === totalPages}
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