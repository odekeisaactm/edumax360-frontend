// app/dashboard/staff/inventory/suppliers/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { inventorySupplierAPI } from '@/lib/api';
import { InventorySupplier } from '@/lib/types';
import {
  Building, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw, Eye,
  ChevronLeft, ChevronRight, Phone, Mail, User,
  Filter, Download, FileSpreadsheet, FileText, SlidersHorizontal,
  ChevronDown, MapPin,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    // Handle DRF validation errors nested in 'details'
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
          </div>
        </div>

        {/* Footer */}
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

        {/* Header */}
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

        {/* Error */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form id="supplier-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className={labelCls}>Supplier Name <span className="text-red-400 normal-case">*</span></label>
              <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Zenith Books Ltd" className={inputCls} />
            </div>

            {/* Contact Person */}
            <div>
              <label className={labelCls}>Contact Person</label>
              <input type="text" value={form.contact_person} onChange={e => set('contact_person', e.target.value)}
                placeholder="e.g. John Doe" className={inputCls} />
            </div>

            {/* Phone */}
            <div>
              <label className={labelCls}>Phone Number</label>
              <input type="tel" value={form.phone_number} onChange={e => set('phone_number', e.target.value)}
                placeholder="e.g. 08012345678" className={inputCls} />
            </div>

            {/* Email */}
            <div className="sm:col-span-2">
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="e.g. contact@zenithbooks.com" className={inputCls} />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className={labelCls}>Address</label>
              <textarea value={form.address} onChange={e => set('address', e.target.value)}
                rows={3} placeholder="Optional address..." className={inputCls} />
            </div>

            {/* Active toggle */}
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

        {/* Footer */}
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

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canCreate = user?.is_superuser || hasPermission('inventory.add_itemmodel');
  const canEdit   = user?.is_superuser || hasPermission('inventory.add_itemmodel');
  const canDelete = user?.is_superuser || hasPermission('inventory.delete_itemmodel');

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

      // Safely extract array from deeply nested response
      let results: any[] = [];
      if (Array.isArray(data)) {
        results = data;
      } else if (data?.results?.data && Array.isArray(data.results.data)) {
        results = data.results.data; // Handles the { count, results: { success, data: [...] } } structure
      } else if (data?.results && Array.isArray(data.results)) {
        results = data.results; // Standard DRF pagination
      } else if (data?.data && Array.isArray(data.data)) {
        results = data.data; // Standard APIResponse wrapper
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

  const handleDownloadExcel = () => {
    setDownloading(true);
    setTimeout(() => {
      showToast('success', 'Excel export started (mock)');
      setDownloading(false);
    }, 1000);
  };

  const handleDownloadPDF = () => {
    setDownloading(true);
    setTimeout(() => {
      showToast('success', 'PDF export started (mock)');
      setDownloading(false);
    }, 1000);
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
        open={showFilterModal}
        filters={filters}
        selectedFields={selectedFields}
        onApply={applyFilters}
        onClose={() => setShowFilterModal(false)}
        onReset={resetFilters}
      />

      <ConfirmModal
        open={!!deletingSupplier} supplier={deletingSupplier} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingSupplier(null)}
      />

      {showFormModal && (
        <SupplierModal
          editing={editingSupplier}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setShowFormModal(false)}
        />
      )}

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

                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                        <Building className="h-4 w-4 text-indigo-400" />
                      </div>
                    </div>

                    {/* Name */}
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

                    {/* Email */}
                    <div className="hidden sm:block min-w-0 space-y-0.5">
                      {s.email && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                          <Mail className="h-3 w-3 text-slate-300 flex-shrink-0" />
                          <span className="truncate">{s.email}</span>
                        </div>
                      )}
                      {!s.email && <span className="text-xs text-slate-300">No email</span>}
                    </div>

                    {/* Phone */}
                    <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-600">
                      {s.phone_number && (
                        <>
                          <Phone className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                          <span className="truncate text-xs">{s.phone_number}</span>
                        </>
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
                      <button onClick={() => router.push(`/dashboard/staff/inventory/suppliers/${s.id}`)}
                        title="View" className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canEdit && (
                        <button onClick={() => { setEditingSupplier(s); setShowFormModal(true); }}
                          title="Edit" className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingSupplier(s)}
                          title="Delete" className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
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
                <span className="font-semibold text-slate-600">{total}</span> supplier{total !== 1 ? 's' : ''}
                {hasFilters && <span className="ml-1 text-blue-500 font-medium">(filtered)</span>}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchSuppliers(filters, page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchSuppliers(filters, pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchSuppliers(filters, page + 1)} disabled={page === totalPages}
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