'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, utilitiesAPI, academicCalendarAPI } from '@/lib/api';
import { Fee, Utility, AcademicPeriod } from '@/lib/types';
import {
  List, Plus, Edit3, Trash2, Check, X, AlertCircle,
  AlertTriangle, Loader2, Search, Lock, RefreshCw, HelpCircle,
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

// ─── Helper Modal ──────────────────────────────────────────────────────────────

function HelperModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>

        <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="h-4 w-4" /> Fee Types — Helper
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong>Fee Types</strong> are the building blocks of your school's billing system. Each one represents
            a specific charge that can be assigned to students through a Fee Structure.
          </p>

          <div className="space-y-3">
            {[
              {
                title: 'Name',
                color: 'bg-blue-100 text-blue-700',
                desc: 'The full descriptive name shown on invoices and receipts, e.g. "First Term Tuition Fee".',
              },
              {
                title: 'Code',
                color: 'bg-indigo-100 text-indigo-700',
                desc: 'A short unique shortcode for internal reference and reports, e.g. "TUI-001". Must be unique across all fees.',
              },
              {
                title: 'Occurrence',
                color: 'bg-violet-100 text-violet-700',
                desc: (
                  <>
                    How often the fee is charged:
                    <ul className="mt-1.5 space-y-1 list-none pl-0">
                      <li><span className="font-semibold">Periodic</span> — billed every academic period (term/semester/quarter).</li>
                      <li><span className="font-semibold">Annually</span> — billed once per session, in a specific period you designate.</li>
                      <li><span className="font-semibold">One-Time</span> — billed only once ever, e.g. an admission fee.</li>
                    </ul>
                  </>
                ),
              },
              {
                title: 'Payment Period',
                color: 'bg-amber-100 text-amber-700',
                desc: 'Only required for Annually or One-Time fees. Specifies which academic period the fee should be billed in. Hidden for Periodic fees.',
              },
              {
                title: 'Required Utility',
                color: 'bg-teal-100 text-teal-700',
                desc: 'Optional. Restricts this fee to only students subscribed to a specific utility (e.g. Transport, Boarding). Leave blank to apply to all students.',
              },
              {
                title: 'Family / Parent-bound',
                color: 'bg-emerald-100 text-emerald-700',
                desc: 'If enabled, this fee is charged once per family (parent) rather than once per student. Useful for fees like PTA levy where siblings share the charge.',
              },
            ].map(({ title, color, desc }) => (
              <div key={title} className="flex gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0 h-fit mt-0.5 ${color}`}>
                  {title}
                </span>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────

function ConfirmModal({ open, fee, isDeleting, onConfirm, onCancel }: {
  open: boolean; fee: Fee | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !fee) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Fee</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{fee.name}"</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting
              ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</>
              : <><Trash2 className="h-4 w-4" />Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fee Form Modal ────────────────────────────────────────────────────────────

type FeeFormData = {
  name: string;
  code: string;
  occurrence: string;
  payment_period: number | '';
  required_utility: number | '';
  parent_bound: boolean;
  description: string;
};

const EMPTY: FeeFormData = {
  name: '', code: '', occurrence: 'periodic',
  payment_period: '', required_utility: '',
  parent_bound: false, description: '',
};

const OCC_LABELS: Record<string, string> = {
  periodic: 'Periodic', annually: 'Annually', one_time: 'One-Time',
};

function FeeModal({ editing, utilities, periods, isSaving, onSave, onClose }: {
  editing: Fee | null;
  utilities: Utility[];
  periods: AcademicPeriod[];
  isSaving: boolean;
  onSave: (data: FeeFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FeeFormData>(
    editing
      ? {
          name: editing.name,
          code: editing.code,
          occurrence: editing.occurrence,
          payment_period: editing.payment_period ?? '',
          required_utility: editing.required_utility ?? '',
          parent_bound: editing.parent_bound,
          description: editing.description || '',
        }
      : EMPTY
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof FeeFormData>(key: K, value: FeeFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Clear payment_period when switching back to periodic
  const handleOccurrenceChange = (val: string) => {
    set('occurrence', val);
    if (val === 'periodic') set('payment_period', '');
  };

  const needsPeriod = form.occurrence === 'annually' || form.occurrence === 'one_time';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.code.trim()) { setFormError('Name and code are required.'); return; }
    if (needsPeriod && !form.payment_period) { setFormError('Payment Period is required for Annually and One-Time fees.'); return; }
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <List className="h-4 w-4" />
            {editing ? 'Edit Fee Type' : 'New Fee Type'}
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
            <span className="flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form id="fee-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

            {/* Name + Code */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. First Term Tuition" className={inputCls} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Code <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.code}
                  onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="e.g. TUI-001"
                  className={`${inputCls} font-mono`} />
              </div>
            </div>

            {/* Occurrence + Payment Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Occurrence <span className="text-red-400 normal-case">*</span></label>
                <select required value={form.occurrence} onChange={e => handleOccurrenceChange(e.target.value)} className={inputCls}>
                  <option value="periodic">Periodic (every term)</option>
                  <option value="annually">Annually (once per session)</option>
                  <option value="one_time">One-Time (once ever)</option>
                </select>
              </div>
              <div className={needsPeriod ? '' : 'opacity-40 pointer-events-none'}>
                <label className={labelCls}>
                  Payment Period
                  {needsPeriod && <span className="text-red-400 normal-case"> *</span>}
                </label>
                <select
                  value={form.payment_period}
                  onChange={e => set('payment_period', e.target.value ? Number(e.target.value) : '')}
                  disabled={!needsPeriod}
                  className={inputCls}
                >
                  <option value="">— Select period —</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Required for Annually / One-Time fees.</p>
              </div>
            </div>

            {/* Required Utility */}
            <div>
              <label className={labelCls}>Required Utility <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
              <select value={form.required_utility}
                onChange={e => set('required_utility', e.target.value ? Number(e.target.value) : '')}
                className={inputCls}>
                <option value="">None — applies to all students</option>
                {utilities.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Only students subscribed to this utility will be billed.</p>
            </div>

            {/* Parent-bound toggle */}
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">Family / Parent-bound</p>
                  <p className="text-xs text-slate-400 mt-0.5">Charged once per family, not per individual student</p>
                </div>
                <button type="button" role="switch" aria-checked={form.parent_bound}
                  onClick={() => set('parent_bound', !form.parent_bound)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.parent_bound ? 'bg-blue-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.parent_bound ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} placeholder="Optional notes about this fee..."
                className={inputCls} />
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="fee-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Fee' : 'Create Fee'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function FeesPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [fees, setFees]               = useState<Fee[]>([]);
  const [utilities, setUtilities]     = useState<Utility[]>([]);
  const [periods, setPeriods]         = useState<AcademicPeriod[]>([]);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [showHelper, setShowHelper]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [editingFee, setEditingFee]   = useState<Fee | null>(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [deletingFee, setDeletingFee] = useState<Fee | null>(null);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [toasts, setToasts]           = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [feesData, utilitiesData, periodTypesData] = await Promise.all([
        feeAPI.getFees(),
        utilitiesAPI.list(),
        academicCalendarAPI.listPeriodTypes(),
      ]);
      setFees(feesData);
      setUtilities(utilitiesData);
      const active = periodTypesData.find((pt: any) => pt.is_active);
      setPeriods(active ? active.periods.slice().sort((a: any, b: any) => a.order - b.order) : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingFee(null); setShowModal(true); };
  const openEdit   = (f: Fee) => { setEditingFee(f); setShowModal(true); };

  const handleSave = async (data: FeeFormData) => {
    setIsSaving(true);
    try {
      const payload = {
        ...data,
        payment_period:   data.payment_period   || null,
        required_utility: data.required_utility || null,
      };
      if (editingFee) {
        const updated = await feeAPI.updateFee(editingFee.id, payload);
        setFees(prev => prev.map(f => f.id === editingFee.id ? updated : f));
        showToast('success', `"${updated.name}" updated successfully`);
      } else {
        const created = await feeAPI.createFee(payload);
        setFees(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingFee) return;
    setIsDeleting(true);
    try {
      await feeAPI.deleteFee(deletingFee.id);
      setFees(prev => prev.filter(f => f.id !== deletingFee.id));
      showToast('success', `"${deletingFee.name}" deleted`);
      setDeletingFee(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingFee(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = fees.filter(f =>
    !search ||
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.code.toLowerCase().includes(search.toLowerCase())
  );

  const periodicCount  = fees.filter(f => f.occurrence === 'periodic').length;
  const annualCount    = fees.filter(f => f.occurrence === 'annually').length;
  const oneTimeCount   = fees.filter(f => f.occurrence === 'one_time').length;
  const familyCount    = fees.filter(f => f.parent_bound).length;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showHelper && <HelperModal onClose={() => setShowHelper(false)} />}

      <ConfirmModal
        open={!!deletingFee} fee={deletingFee} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingFee(null)}
      />

      {showModal && (
        <FeeModal
          editing={editingFee} utilities={utilities} periods={periods}
          isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <List className="h-5 w-5 text-white" />
            </div>
            Fee Types
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Define individual fee charges used in invoice generation</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelper(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            <HelpCircle className="h-4 w-4 text-sky-500" /> Helper
          </button>
          {canManage && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> Add Fee Type
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Fee Types', value: fees.length,              color: 'from-blue-500 to-blue-600'     },
          { label: 'Periodic',        value: periodicCount,            color: 'from-violet-500 to-purple-600' },
          { label: 'Annual / One-Time', value: annualCount + oneTimeCount, color: 'from-amber-400 to-orange-500' },
          { label: 'Family-bound',    value: familyCount,              color: 'from-emerald-500 to-teal-600'  },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <List className="h-4 w-4 text-white" />
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

        {/* Search + refresh bar */}
        <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by name or code..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <button onClick={fetchData}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading fee types...</p>
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
              <List className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {search ? 'No fee types match your search' : 'No fee types yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {search ? 'Try a different name or code.' : 'Add your first fee type to get started.'}
            </p>
            {!search && canManage && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Fee Type
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_130px_110px_130px_80px_120px_90px] items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Occurrence</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Utility</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Family</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Period</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(f => (
                <div key={f.id}
                  className="grid grid-cols-[1fr_130px_110px_130px_80px_120px_90px] items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">

                  {/* Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-900 truncate">{f.name}</span>
                    {f.is_protected && (
                      <Lock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" title="Protected — cannot be deleted" />
                    )}
                  </div>

                  {/* Code */}
                  <span className="font-mono text-xs text-slate-500 truncate">{f.code}</span>

                  {/* Occurrence */}
                  <span className={`inline-flex w-fit px-2.5 py-1 rounded-full text-xs font-semibold
                    ${f.occurrence === 'periodic'  ? 'bg-blue-100 text-blue-700'   :
                      f.occurrence === 'annually'  ? 'bg-amber-100 text-amber-700' :
                                                     'bg-slate-100 text-slate-600'}`}>
                    {OCC_LABELS[f.occurrence] || f.occurrence}
                  </span>

                  {/* Utility */}
                  <span className="text-xs text-slate-500 truncate">
                    {f.required_utility_name
                      ? <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full font-medium">{f.required_utility_name}</span>
                      : <span className="text-slate-300">—</span>}
                  </span>

                  {/* Family bound */}
                  {f.parent_bound
                    ? <span className="inline-flex w-fit px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">Yes</span>
                    : <span className="text-slate-300 text-sm">—</span>}

                  {/* Payment Period */}
                  <span className="text-xs text-slate-500 truncate">
                    {f.payment_period_name
                      ? <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">{f.payment_period_name}</span>
                      : <span className="text-slate-300">—</span>}
                  </span>

                  {/* Actions — always visible */}
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(f)} title="Edit"
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeletingFee(f)} title="Delete" disabled={f.is_protected}
                          className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {fees.length} fee type{fees.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}