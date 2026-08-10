// app/dashboard/staff/inventory/suppliers/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { inventorySupplierAPI } from '@/lib/api';
import { InventorySupplier } from '@/lib/types';
import * as XLSX from 'xlsx';
import {
  Building, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw, Eye,
  ChevronLeft, ChevronRight, Phone, Mail, User,
  Filter, Download, FileSpreadsheet, FileText, SlidersHorizontal,
  ChevronDown, ArrowRightCircle, MapPin,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
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
  inactive:  { label: 'Inactive',  dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-100',  border: 'border-slate-200'   },
};

const PAGE_SIZE = 20;

// ─── Export field definitions ──────────────────────────────────────────────────
const ALL_EXPORT_FIELDS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'name',           label: 'Supplier Name',  defaultOn: true  },
  { key: 'contact_person', label: 'Contact Person', defaultOn: true  },
  { key: 'phone_number',   label: 'Phone Number',   defaultOn: true  },
  { key: 'email',          label: 'Email',          defaultOn: true  },
  { key: 'address',        label: 'Address',        defaultOn: false },
  { key: 'is_active',      label: 'Status',         defaultOn: false },
  { key: 'created_at',     label: 'Created At',     defaultOn: false },
];

const DEFAULT_FIELDS = new Set(ALL_EXPORT_FIELDS.filter(f => f.defaultOn).map(f => f.key));

// ─── Filter State ──────────────────────────────────────────────────────────────
interface FilterState {
  search: string;
  status: string;
}

const EMPTY_FILTERS: FilterState = { search: '', status: '' };

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
  open, filters, selectedFields, onApply, onClose, onReset,
}: {
  open: boolean;
  filters: FilterState;
  selectedFields: Set<string>;
  onApply: (f: FilterState, fields: Set<string>) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const [local, setLocal] = useState<FilterState>(filters);
  const [localFields, setLocalFields] = useState<Set<string>>(new Set(selectedFields));

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  useEffect(() => {
    if (open) {
      setLocal(filters);
      setLocalFields(new Set(selectedFields));
    }
  }, [open, filters, selectedFields]);

  const set = (k: keyof FilterState, v: string) => setLocal(p => ({ ...p, [k]: v }));

  const toggleField = (key: string) => setLocalFields(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
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

        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Filters</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={local.status} onChange={e => set('status', e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

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
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={() => {
            setLocal(EMPTY_FILTERS);
            setLocalFields(new Set(DEFAULT_FIELDS));
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
                <p className="text-[11px] text-slate-400">Printable supplier list</p>
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

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, supplier, isDeleting, onConfirm, onCancel }: {
  open: boolean; supplier: InventorySupplier | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !supplier) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Supplier</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{supplier.name}"</span>?
          This cannot be undone.
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
interface SupplierFormValues {
  name: string;
  contact_person: string;
  phone_number: string;
  email: string;
  address: string;
  is_active: boolean;
}

// ─── Supplier Form Modal ───────────────────────────────────────────────────────
function SupplierModal({ editing, isSaving, onSave, onClose }: {
  editing: InventorySupplier | null;
  isSaving: boolean;
  onSave: (data: SupplierFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SupplierFormValues>(
    editing
      ? {
          name: editing.name,
          contact_person: editing.contact_person || '',
          phone_number: editing.phone_number || '',
          email: editing.email || '',
          address: editing.address || '',
          is_active: editing.is_active,
        }
      : { name: '', contact_person: '', phone_number: '', email: '', address: '', is_active: true }
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Auto-focus
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => nameInputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const set = <K extends keyof SupplierFormValues>(key: K, value: SupplierFormValues[K]) =>
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building className="h-4 w-4" />
            {editing ? 'Edit Supplier' : 'New Supplier'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form id="supplier-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Supplier Name <span className="text-red-400 normal-case">*</span></label>
              <input ref={nameInputRef} required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Zenith Books Ltd" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contact Person</label>
              <input type="text" value={form.contact_person} onChange={e => set('contact_person', e.target.value)}
                placeholder="e.g. John Doe" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input type="tel" value={form.phone_number} onChange={e => set('phone_number', e.target.value)}
                placeholder="e.g. 08012345678" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="e.g. contact@zenithbooks.com" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Address</label>
              <textarea value={form.address} onChange={e => set('address', e.target.value)}
                rows={3} placeholder="Optional address..." className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">Active</p>
                  <p className="text-xs text-slate-400">Supplier is available for transactions</p>
                </div>
                <button type="button" role="switch" aria-checked={form.is_active}
                  onClick={() => set('is_active', !form.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="supplier-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Supplier' : 'Create Supplier'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function SupplierDrawer({ supplier, open, onClose }: {
  supplier: InventorySupplier | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open || !supplier) return null;

  const status = STATUS_META[supplier.is_active ? 'active' : 'inactive'] ?? STATUS_META.inactive;

  const detailRows = [
    { label: 'Contact Person', value: toTitleCase(supplier.contact_person || ''), icon: User, show: !!supplier.contact_person },
    { label: 'Phone Number', value: supplier.phone_number || '', icon: Phone, show: !!supplier.phone_number },
    { label: 'Email Address', value: supplier.email || '', icon: Mail, show: !!supplier.email },
    { label: 'Address', value: supplier.address || '', icon: MapPin, show: !!supplier.address, isAddress: true },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-[slideInRight_0.2s_ease-out]">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
              <Building className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base leading-tight">{toTitleCase(supplier.name)}</h2>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                  {status.label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            {detailRows.map(row => row.show && (
              <div key={row.label} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <row.icon className="h-4 w-4 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{row.label}</p>
                  <p className={`text-sm text-slate-700 leading-relaxed ${row.isAddress ? 'whitespace-pre-wrap' : ''}`}>
                    {row.value || '—'}
                  </p>
                </div>
              </div>
            ))}

            {!detailRows.some(r => r.show) && (
              <p className="text-sm text-slate-400 italic text-center py-8">No additional details provided for this supplier.</p>
            )}
          </div>

          {/* System Info */}
          <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Supplier ID</p>
              <p className="text-sm text-slate-600 mt-0.5 font-mono">#{supplier.id}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Created</p>
              <p className="text-sm text-slate-600 mt-0.5">{new Date(supplier.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0 space-y-2">
          <button
            onClick={() => {
              onClose();
              router.push(`/dashboard/staff/inventory/stock-in?supplier=${supplier.id}`);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
          >
            <ArrowRightCircle className="h-4 w-4" />
            View Stock-Ins for this Supplier
          </button>
          <p className="text-[11px] text-slate-400 text-center">
            Takes you to the Stock-In page with this supplier pre-filtered.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ─── Export: fetch ALL records matching current filters (bypasses pagination) ──
async function fetchAllForExport(
  apiList: (params: Record<string, any>) => Promise<any>,
  f: FilterState,
): Promise<InventorySupplier[]> {
  const params: Record<string, any> = { page: 1, page_size: 10000 };
  if (f.search) params.search = f.search;
  if (f.status) params.status = f.status;

  const data = await apiList(params);

  if (Array.isArray(data)) return data;
  if (data?.results?.data && Array.isArray(data.results.data)) return data.results.data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

// ─── Export: resolve a single field value from a supplier row ─────────────────
function getSupplierFieldValue(s: InventorySupplier, key: string): string {
  switch (key) {
    case 'name':           return toTitleCase(s.name || '');
    case 'contact_person': return toTitleCase(s.contact_person || '') || '—';
    case 'phone_number':   return s.phone_number || '—';
    case 'email':          return s.email || '—';
    case 'address':        return s.address || '—';
    case 'is_active':      return s.is_active ? 'Active' : 'Inactive';
    case 'created_at': {
      const raw = (s as any).created_at;
      return raw ? new Date(raw).toLocaleDateString('en-NG') : '—';
    }
    default: return '—';
  }
}

// ─── Export: build print-ready HTML ──────────────────────────────────────────
function buildSuppliersPDFHTML(
  rows: InventorySupplier[],
  fields: Set<string>,
  filterInfo: string,
): string {
  const now = new Date().toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short' });
  const visibleFields = ALL_EXPORT_FIELDS.filter(f => fields.has(f.key));

  const thead = visibleFields.map(f => `<th>${f.label}</th>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Inventory Suppliers Export</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; padding: 28px 32px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2.5px solid #4f46e5; padding-bottom: 14px; margin-bottom: 20px; }
    .header h1 { font-size: 18px; font-weight: 800; color: #4f46e5; letter-spacing: -0.5px; }
    .header p  { font-size: 11px; color: #94a3b8; margin-top: 3px; }
    .header-right { text-align: right; font-size: 10px; color: #64748b; line-height: 1.8; }
    .header-right strong { color: #1e293b; }
    .filter-bar { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:7px 14px; font-size:11px; color:#475569; margin-bottom:16px; }
    .filter-bar strong { color:#1e293b; }
    table { width:100%; border-collapse:collapse; }
    thead tr { background: linear-gradient(135deg, #4f46e5, #7c3aed); }
    thead th { padding:9px 12px; text-align:left; color:#fff; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; }
    td { padding:8px 12px; color:#334155; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    tfoot td { padding:10px 12px; font-size:10px; color:#94a3b8; border-top:2px solid #e2e8f0; }
    .summary { margin-top:18px; display:flex; gap:10px; }
    .chip { padding:4px 12px; border-radius:999px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; }
    .chip-total    { background:#eff6ff; color:#3b82f6; border:1px solid #bfdbfe; }
    .chip-active   { background:#ecfdf5; color:#059669; border:1px solid #6ee7b7; }
    .chip-inactive { background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; }
    @media print { body { padding:10px 15px; } @page { margin:12mm; size: A4 landscape; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Inventory Suppliers</h1>
      <p>Generated: ${now}</p>
    </div>
    <div class="header-right">
      <div>Total records: <strong>${rows.length}</strong></div>
      <div>Active: <strong>${rows.filter(s => s.is_active).length}</strong></div>
      <div>Inactive: <strong>${rows.filter(s => !s.is_active).length}</strong></div>
    </div>
  </div>

  ${filterInfo ? `<div class="filter-bar">Applied filters: <strong>${filterInfo}</strong></div>` : ''}

  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        ${thead}
      </tr>
    </thead>
    <tbody>
      ${rows.map((s, i) => {
        const cells = visibleFields.map(f => {
          const val = getSupplierFieldValue(s, f.key);
          if (f.key === 'is_active') {
            const colour = s.is_active ? '#059669' : '#64748b';
            const bg     = s.is_active ? '#ecfdf5'  : '#f1f5f9';
            return `<td><span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;color:${colour};background:${bg};border:1px solid ${colour}40">${val}</span></td>`;
          }
          return `<td>${val}</td>`;
        }).join('');
        return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
          <td style="color:#94a3b8;font-size:10px">${i + 1}</td>
          ${cells}
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="${visibleFields.length + 1}">System-generated export · Total rows: ${rows.length}</td>
      </tr>
    </tfoot>
  </table>

  <div class="summary">
    <span class="chip chip-total">Total: ${rows.length}</span>
    <span class="chip chip-active">Active: ${rows.filter(s => s.is_active).length}</span>
    <span class="chip chip-inactive">Inactive: ${rows.filter(s => !s.is_active).length}</span>
  </div>

  <script>window.onload = function () { window.print(); };<\/script>
</body>
</html>`;
}

// ─── Export: download as real .xlsx via SheetJS ───────────────────────────────
function downloadSuppliersExcel(
  rows: InventorySupplier[],
  fields: Set<string>,
): void {
  const visibleFields = ALL_EXPORT_FIELDS.filter(f => fields.has(f.key));

  const exportData = rows.map((s, i) => {
    const obj: Record<string, any> = { '#': i + 1 };
    visibleFields.forEach(f => { obj[f.label] = getSupplierFieldValue(s, f.key); });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');

  const colWidths = [{ wch: 5 }, ...visibleFields.map(f => ({ wch: Math.max(f.label.length + 4, 18) }))];
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `suppliers_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [pendingSearch, setPendingSearch] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_FIELDS));

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<InventorySupplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Drawer
  const [viewingSupplier, setViewingSupplier] = useState<InventorySupplier | null>(null);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canCreate = user?.is_superuser || hasPermission('inventory.add_inventoryitemmodel');
  const canEdit   = user?.is_superuser || hasPermission('inventory.add_inventoryitemmodel');
  const canDelete = user?.is_superuser || hasPermission('inventory.delete_inventoryitemmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const buildParams = useCallback((f: FilterState, pg: number) => {
    const p: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
    if (f.search) p.search = f.search;
    if (f.status) p.status = f.status;
    return p;
  }, []);

  const fetchSuppliers = useCallback(async (f: FilterState, pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const data = await inventorySupplierAPI.list(buildParams(f, pg));
      let results: any[] = [];
      if (Array.isArray(data)) {
        results = data;
      } else if (data?.results?.data && Array.isArray(data.results.data)) {
        results = data.results.data;
      } else if (data?.results && Array.isArray(data.results)) {
        results = data.results;
      } else if (data?.data && Array.isArray(data.data)) {
        results = data.data;
      }
      setSuppliers(results);
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
      fetchSuppliers(next, 1);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [pendingSearch]);

  // Initial load
  useEffect(() => { fetchSuppliers(EMPTY_FILTERS, 1); }, []);

  const applyFilters = (f: FilterState, fields: Set<string>) => {
    const next = { ...f, search: pendingSearch };
    setFilters(next);
    setSelectedFields(fields);
    fetchSuppliers(next, 1);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setPendingSearch('');
    setFilters(EMPTY_FILTERS);
    setSelectedFields(new Set(DEFAULT_FIELDS));
    fetchSuppliers(EMPTY_FILTERS, 1);
    setShowFilterModal(false);
  };

  const removeFilter = (key: keyof FilterState) => {
    const next = { ...filters, [key]: '' };
    setFilters(next);
    fetchSuppliers(next, 1);
  };

  const handleSave = async (formData: SupplierFormValues) => {
    setIsSaving(true);
    try {
      if (editingSupplier) {
        const updated = await inventorySupplierAPI.update(editingSupplier.id, formData);
        setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast('success', `"${updated.name}" updated successfully`);
      } else {
        const created = await inventorySupplierAPI.create(formData);
        setSuppliers(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully`);
      }
      setShowFormModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingSupplier) return;
    setIsDeleting(true);
    try {
      await inventorySupplierAPI.delete(deletingSupplier.id);
      setSuppliers(prev => prev.filter(s => s.id !== deletingSupplier.id));
      showToast('success', `"${deletingSupplier.name}" deleted`);
      setDeletingSupplier(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingSupplier(null);
    } finally { setIsDeleting(false); }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const all = await fetchAllForExport(inventorySupplierAPI.list, filters);
      const parts: string[] = [];
      if (filters.search) parts.push(`Search: "${filters.search}"`);
      if (filters.status) parts.push(`Status: ${filters.status}`);
      const filterInfo = parts.join(' · ');
      const html = buildSuppliersPDFHTML(all, selectedFields, filterInfo);
      const win = window.open('', '_blank');
      if (!win) {
        showToast('error', 'Pop-up blocked. Please allow pop-ups for this site.');
        return;
      }
      win.document.write(html);
      win.document.close();
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setDownloading(false); }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const all = await fetchAllForExport(inventorySupplierAPI.list, filters);
      downloadSuppliersExcel(all, selectedFields);
      showToast('success', `Exported ${all.length} supplier${all.length !== 1 ? 's' : ''} to Excel`);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setDownloading(false); }
  };

  const activeFilterChips: { key: keyof FilterState; label: string }[] = [
    filters.status && { key: 'status', label: `Status: ${filters.status}` },
  ].filter(Boolean) as { key: keyof FilterState; label: string }[];

  const hasFilters = !!(pendingSearch || activeFilterChips.length);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeCount = suppliers.filter(s => s.is_active).length;

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <FilterModal
        open={showFilterModal} filters={filters} selectedFields={selectedFields}
        onApply={applyFilters} onClose={() => setShowFilterModal(false)} onReset={resetFilters}
      />

      <ConfirmModal
        open={!!deletingSupplier} supplier={deletingSupplier} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingSupplier(null)}
      />

      {showFormModal && (
        <SupplierModal
          editing={editingSupplier} isSaving={isSaving}
          onSave={handleSave} onClose={() => setShowFormModal(false)}
        />
      )}

      <SupplierDrawer
        supplier={viewingSupplier}
        open={!!viewingSupplier}
        onClose={() => setViewingSupplier(null)}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Building className="h-5 w-5 text-white" />
            </div>
            Inventory Suppliers
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage vendors and suppliers</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DownloadDropdown onExcel={handleDownloadExcel} onPDF={handleDownloadPDF} downloading={downloading} />
          {canCreate && (
            <button onClick={() => { setEditingSupplier(null); setShowFormModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: total,          color: 'from-blue-500 to-blue-600'    },
          { label: 'Active',    value: activeCount,    color: 'from-emerald-500 to-teal-600' },
          { label: 'Inactive',  value: suppliers.length - activeCount, color: 'from-orange-400 to-amber-500' },
          { label: 'This Page', value: suppliers.length, color: 'from-violet-500 to-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Building className="h-4 w-4 text-white" />
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
              <input type="text" placeholder="Search by name, contact, phone, email…"
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
              <button onClick={() => fetchSuppliers(filters, page)} title="Refresh"
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
            <p className="mt-2 text-sm text-slate-400">Loading suppliers...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchSuppliers(filters, 1)}
              className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No suppliers match your filters' : 'No suppliers yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Add your first supplier to get started.'}
            </p>
            {hasFilters
              ? <button onClick={resetFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              : canCreate && (
                <button onClick={() => { setEditingSupplier(null); setShowFormModal(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200">
                  <Plus className="h-4 w-4" /> Add Supplier
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
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {suppliers.map(s => {
                const status = STATUS_META[s.is_active ? 'active' : 'inactive'] ?? STATUS_META.inactive;
                const name = toTitleCase(s.name || '');

                return (
                  <div key={s.id}
                    className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                    style={{ gridTemplateColumns: '2.5rem 1fr 160px 90px 80px 108px' }}>

                    <div className="flex-shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                        <Building className="h-4 w-4 text-indigo-400" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {s.contact_person && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                            {toTitleCase(s.contact_person)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="hidden sm:block min-w-0 space-y-0.5">
                      {s.email && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                          <Mail className="h-3 w-3 text-slate-300 flex-shrink-0" />
                          <span className="truncate">{s.email}</span>
                        </div>
                      )}
                      {!s.email && <span className="text-xs text-slate-300">No email</span>}
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-600">
                      {s.phone_number && (
                        <>
                          <Phone className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                          <span className="truncate text-xs">{s.phone_number}</span>
                        </>
                      )}
                    </div>

                    <div className="hidden sm:block">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setViewingSupplier(s)} title="View Details"
                        className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canEdit && (
                        <button onClick={() => { setEditingSupplier(s); setShowFormModal(true); }} title="Edit"
                          className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingSupplier(s)} title="Delete"
                          className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Showing page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchSuppliers(filters, page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => fetchSuppliers(filters, page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}