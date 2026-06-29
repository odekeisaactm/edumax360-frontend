'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { bonusesAPI, bonusCategoriesAPI, academicCalendarAPI, staffAPI } from '@/lib/api';
import { Bonus, BonusCategory, BonusWrite } from '@/lib/types';
import {
  Award, Star, Plus, Eye, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  FileSpreadsheet, FileText, UserCircle, Download, Users, CalendarDays,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const MONTHS = [
  { value: '', label: 'All Months' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleString('default', { month: 'long' }),
  })),
];
const now = new Date();
const YEARS = [
  { value: '', label: 'All Years' },
  ...Array.from({ length: 5 }, (_, i) => ({
    value: String(now.getFullYear() - 2 + i),
    label: String(now.getFullYear() - 2 + i),
  })),
];

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
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
            ${t.type === 'success'
              ? 'bg-white border-emerald-200 text-emerald-900'
              : 'bg-white border-red-200 text-red-900'}`}
        >
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-500" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-40 hover:opacity-80 flex-shrink-0 ml-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, isLoading, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; isLoading: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-11 h-11 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <h3 className="text-base font-bold text-slate-900 text-center mb-1">{title}</h3>
        <p className="text-sm text-slate-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Processing...</> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Excel Modal ───────────────────────────────────────────────────────────────
function ExcelModal({ open, onClose, onDownload, isDownloading }: {
  open: boolean; onClose: () => void; onDownload: (title: string) => void; isDownloading: boolean;
}) {
  const [title, setTitle] = useState('Bonus Report');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Download Report
        </h3>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Document title
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-5 transition"
          placeholder="e.g. December 2024 Bonuses"
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onDownload(title)}
            disabled={isDownloading || !title}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {isDownloading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
              : <><Download className="h-4 w-4" />Download CSV</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({ bonusId, onClose }: { bonusId: number | null; onClose: () => void }) {
  const [data, setData] = useState<Bonus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bonusId) {
      setLoading(true);
      bonusesAPI.get(bonusId)
        .then(res => setData(res))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [bonusId]);

  if (!bonusId) return null;
  const staffDetail = (data?.staff_detail as any) || null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-300">Bonus Details</span>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Amount</p>
              <p className="text-3xl font-bold text-white mb-3">{fmtMoney(data.amount)}</p>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                ${data.status === 'paid'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${data.status === 'paid' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {data.status === 'paid' ? 'Paid' : 'Unpaid'}
              </span>
            </div>

            <div className="p-5 space-y-4 flex-1">
              {/* Recipient */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5" /> Recipient
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-blue-700">Type:</span>
                  {data.type === 'staff'
                    ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] font-bold rounded-md border border-blue-200">Staff</span>
                    : <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[11px] font-bold rounded-md">Volunteer</span>}
                </div>
                {data.type === 'staff' && staffDetail ? (
                  <div className="flex items-center gap-3 mt-2 p-3 bg-white rounded-lg border border-blue-100">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {staffDetail.first_name?.[0]}{staffDetail.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{staffDetail.full_name || data.staff_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{staffDetail.staff_id || ''}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-blue-900 font-medium mt-1">{data.volunteer_name}</p>
                )}
              </div>

              {/* Period */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Payment Info
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Period</p>
                    <p className="text-sm font-bold text-slate-800">{data.month}/{data.year}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Due date</p>
                    <p className="text-sm font-bold text-slate-800">
                      {new Date(data.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Transaction Meta</p>
                <div className="space-y-2 text-sm">
                  {[
                    ['Created by', (data as any).created_by_name || 'System'],
                    ['Created on', new Date(data.created_at).toLocaleString()],
                    ['Last updated', new Date(data.updated_at).toLocaleString()],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-slate-500 flex-shrink-0">{label}</span>
                      <span className="font-medium text-slate-800 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {data.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Notes</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{data.notes}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-red-500 text-sm">
            Failed to load details.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bonus Form Modal ──────────────────────────────────────────────────────────
function BonusFormModal({ editing, categories, currentPeriodId, isSaving, onSave, onClose }: {
  editing: Bonus | null;
  categories: BonusCategory[];
  currentPeriodId: number | null;
  isSaving: boolean;
  onSave: (data: BonusWrite) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    type: (editing?.type || 'staff') as 'staff' | 'volunteer',
    category: typeof editing?.category === 'object'
      ? (editing.category as any).id
      : (editing?.category || 0) as number,
    staff: typeof editing?.staff === 'object'
      ? (editing.staff as any).id
      : (editing?.staff || null) as number | null,
    volunteer_name: editing?.volunteer_name || '',
    amount: editing?.amount || '',
    due_date: editing?.due_date
      ? editing.due_date.split('T')[0]
      : new Date().toISOString().split('T')[0],
    notes: editing?.notes || '',
    isPaid: editing ? editing.status === 'paid' : true,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState<any[]>([]);
  const [showStaffDrop, setShowStaffDrop] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (form.type !== 'staff' || !staffSearch) { setStaffResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await staffAPI.list({ search: staffSearch, page_size: 10, is_active: true }) as any;
        setStaffResults(res.results || res.data || res || []);
      } catch { setStaffResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [staffSearch, form.type]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowStaffDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    if (key === 'type') {
      setForm(prev => ({ ...prev, type: value as any, staff: null, volunteer_name: '' }));
    } else {
      setForm(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload: BonusWrite = {
      type: form.type,
      category: form.category,
      staff: form.type === 'staff' ? form.staff : null,
      volunteer_name: form.type === 'volunteer' ? form.volunteer_name : null,
      amount: form.amount,
      due_date: form.due_date,
      status: form.isPaid ? 'paid' : 'unpaid',
      notes: form.notes,
      academic_period: !editing && currentPeriodId ? currentPeriodId : undefined,
    };
    try { await onSave(payload); } catch (err) { setFormError(extractError(err)); }
  };

  const selectedStaffName = editing?.type === 'staff'
    ? (editing?.staff_detail as any)?.full_name || editing?.staff_name
    : null;

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Award className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {editing ? 'Edit bonus' : 'New bonus'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form id="bonus-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className={labelCls}>Type <span className="text-red-400 normal-case font-normal">*</span></label>
              <select
                required
                value={form.type}
                onChange={e => set('type', e.target.value as any)}
                className={inputCls}
              >
                <option value="staff">Staff</option>
                <option value="volunteer">Volunteer</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Category <span className="text-red-400 normal-case font-normal">*</span></label>
              <select
                required
                value={String(form.category || '')}
                onChange={e => set('category', parseInt(e.target.value))}
                className={inputCls}
              >
                <option value="">Select category...</option>
                {categories.filter(c => c.is_active).map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>

            {form.type === 'staff' ? (
              <div className="sm:col-span-2" ref={searchRef}>
                <label className={labelCls}>Staff member <span className="text-red-400 normal-case font-normal">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={selectedStaffName || 'Search by name or staff ID...'}
                    value={staffSearch || (editing?.type === 'staff' ? (selectedStaffName || '') : '')}
                    onChange={e => { setStaffSearch(e.target.value); setShowStaffDrop(true); set('staff', null); }}
                    onFocus={() => setShowStaffDrop(true)}
                    className={inputCls + ' pr-10'}
                    required={!form.staff}
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                  {showStaffDrop && staffResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {staffResults.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            set('staff', s.id);
                            setStaffSearch(s.full_name || `${s.first_name} ${s.last_name}`);
                            setShowStaffDrop(false);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                            <UserCircle className="h-4 w-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {s.full_name || `${s.first_name} ${s.last_name}`}
                            </p>
                            <p className="text-xs text-slate-400 font-mono">{s.staff_id || `ID: ${s.id}`}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className={labelCls}>Volunteer name <span className="text-red-400 normal-case font-normal">*</span></label>
                <input
                  required
                  type="text"
                  value={form.volunteer_name}
                  onChange={e => set('volunteer_name', e.target.value)}
                  placeholder="Enter volunteer name"
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Amount (₦) <span className="text-red-400 normal-case font-normal">*</span></label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Due date <span className="text-red-400 normal-case font-normal">*</span></label>
              <input
                required
                type="date"
                value={form.due_date}
                onChange={e => set('due_date', e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Payment toggle */}
            <div className="sm:col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-800">Payment status</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editing ? 'Toggle to mark as paid or unpaid' : 'Mark as paid immediately on creation'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isPaid}
                onClick={() => set('isPaid', !form.isPaid)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0
                  ${form.isPaid ? 'bg-emerald-500' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform
                  ${form.isPaid ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>

            {!editing && currentPeriodId && (
              <div className="sm:col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-600 flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                Will automatically be assigned to the current academic period.
              </div>
            )}

            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                placeholder="Optional notes..."
                className={inputCls + ' resize-none'}
              />
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="bonus-form"
            disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-blue-200"
          >
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              : <><Check className="h-4 w-4" />{editing ? 'Update bonus' : 'Create bonus'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BonusesPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data ──
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [categories, setCategories] = useState<BonusCategory[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [stats, setStats] = useState({
    total_amount: 0,
    paid_amount: 0,
    unpaid_amount: 0,
    category_breakdown: [] as { name: string; total: number }[],
  });

  // ── Modal / Drawer State ──
  const [showForm, setShowForm] = useState(false);
  const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingBonus, setDeletingBonus] = useState<Bonus | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [markingPaidBonus, setMarkingPaidBonus] = useState<Bonus | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const canCreate = user?.is_superuser || hasPermission('salary_management.add_salaryrecordmodel');
  const canEdit = user?.is_superuser || hasPermission('salary_management.change_salaryrecordmodel');
  const canDelete = user?.is_superuser || hasPermission('salary_management.delete_salaryrecordmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Lookups ──
  useEffect(() => {
    bonusCategoriesAPI.list().then(setCategories).catch(() => {});
    academicCalendarAPI.listSessions()
      .then((data: any) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {});
    academicCalendarAPI.listSessionPeriods({ is_current: true, page_size: 1 } as any)
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data?.results?.data || data?.data || []);
        if (list.length > 0) setCurrentPeriodId(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSession) { setPeriods([]); setSelectedPeriod(''); return; }
    academicCalendarAPI.listSessionPeriods({ session_id: Number(selectedSession) })
      .then((data: any) => setPeriods(Array.isArray(data) ? data : (data?.results?.data || data?.data || [])))
      .catch(() => setPeriods([]));
  }, [selectedSession]);

  // ── Fetch ──
  const fetchData = useCallback(async (pg = 1) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (month) params.month = month;
      if (year) params.year = year;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      if (selectedPeriod) params.academic_period = selectedPeriod;
      else if (selectedSession) params.session = selectedSession;

      const res = await bonusesAPI.list(params) as any;
      setBonuses(res.results || []);
      setTotal(res.count || 0);
      setPage(pg);
      if (res.stats) setStats(res.stats);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [month, year, categoryFilter, statusFilter, selectedSession, selectedPeriod, search]);

  useEffect(() => { fetchData(1); }, [month, year, categoryFilter, statusFilter, selectedSession, selectedPeriod, fetchData]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchData(1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search, fetchData]);

  // ── Actions ──
  const openCreate = () => { setEditingBonus(null); setShowForm(true); };
  const openEdit = (b: Bonus) => { setEditingBonus(b); setShowForm(true); };

  const handleSave = async (form: BonusWrite) => {
    setIsSaving(true);
    try {
      if (editingBonus) {
        const updated = await bonusesAPI.update(editingBonus.id, form);
        setBonuses(prev => prev.map(b => b.id === updated.id ? updated : b));
        showToast('success', 'Bonus updated');
      } else {
        const created = await bonusesAPI.create(form);
        setBonuses(prev => [created, ...prev]);
        setTotal(prev => prev + 1);
        showToast('success', 'Bonus created');
      }
      setShowForm(false);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBonus) return;
    setIsDeleting(true);
    try {
      await bonusesAPI.delete(deletingBonus.id);
      setBonuses(prev => prev.filter(b => b.id !== deletingBonus.id));
      setTotal(prev => prev - 1);
      showToast('success', 'Bonus deleted');
      setDeletingBonus(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingBonus(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!markingPaidBonus) return;
    setIsMarkingPaid(true);
    try {
      await bonusesAPI.markPaid(markingPaidBonus.id);
      setBonuses(prev => prev.map(b =>
        b.id === markingPaidBonus.id ? { ...b, status: 'paid' as const } : b
      ));
      showToast('success', 'Marked as paid');
      setMarkingPaidBonus(null);
    } catch (err) {
      showToast('error', extractError(err));
      setMarkingPaidBonus(null);
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleDownloadExcel = async (title: string) => {
    setIsDownloading(true);
    try {
      const params: Record<string, any> = { page_size: 1000 };
      if (month) params.month = month;
      if (year) params.year = year;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (selectedPeriod) params.academic_period = selectedPeriod;
      else if (selectedSession) params.session = selectedSession;
      if (search) params.search = search;

      const res = await bonusesAPI.list(params) as any;
      const headers = ['Recipient', 'Type', 'Category', 'Amount', 'Due Date', 'Status'];
      const rows = (res.results || []).map((b: any) => [
        b.type === 'staff' ? (b.staff_detail?.full_name || b.staff_name || '') : b.volunteer_name,
        b.type,
        categories.find(c => c.id === b.category)?.name || '',
        b.amount,
        new Date(b.due_date).toLocaleDateString(),
        b.status,
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map((r: any[]) => r.map((c: any) => `"${c}"`).join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setShowExcelModal(false);
      showToast('success', 'Report downloaded');
    } catch {
      showToast('error', 'Failed to generate report');
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Derived ──
  const getCategoryName = (id: number) => categories.find(c => c.id === id)?.name || '—';
  const activeSession = sessions.find((s: any) => String(s.id) === selectedSession);
  const activeSessionLabel = activeSession ? `${activeSession.start_year}/${activeSession.end_year}` : null;
  const activePeriodLabel = periods.find((p: any) => String(p.id) === selectedPeriod)?.period?.name || null;
  const hasFilters = search || statusFilter || categoryFilter || selectedSession || selectedPeriod || month || year;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const clearFilters = () => {
    setMonth(''); setYear(''); setCategoryFilter('');
    setStatusFilter(''); setSearch(''); setSelectedSession(''); setSelectedPeriod('');
  };

  const selectCls = "px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500 transition";

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingBonus}
        title="Delete bonus"
        message="This action cannot be undone. The bonus record will be permanently removed."
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingBonus(null)}
      />
      <ConfirmModal
        open={!!markingPaidBonus}
        title="Confirm payment"
        message={`Mark the bonus of ${markingPaidBonus ? fmtMoney(markingPaidBonus.amount) : ''} as paid?`}
        isLoading={isMarkingPaid}
        onConfirm={handleMarkPaid}
        onCancel={() => setMarkingPaidBonus(null)}
      />

      <DetailDrawer bonusId={detailId} onClose={() => setDetailId(null)} />
      <ExcelModal
        open={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onDownload={handleDownloadExcel}
        isDownloading={isDownloading}
      />
      {showForm && (
        <BonusFormModal
          editing={editingBonus}
          categories={categories}
          currentPeriodId={currentPeriodId}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-200 flex-shrink-0">
            <Award className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Bonuses</h1>
            <p className="text-xs text-slate-400">Manage staff and volunteer bonuses</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push('/dashboard/staff/salary/bonuses/report')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            <FileText className="h-4 w-4" /> Report
          </button>
          <button
            onClick={() => setShowExcelModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-emerald-200 text-emerald-700 bg-emerald-50 text-sm font-medium rounded-xl hover:bg-emerald-100 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export
          </button>
          {canCreate && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm shadow-blue-200"
            >
              <Plus className="h-4 w-4" /> Add bonus
            </button>
          )}
        </div>
      </div>

      {/* ── Period Banner ── */}
      {(activeSessionLabel || activePeriodLabel) && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
          <CalendarDays className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            Showing bonuses for{' '}
            <span className="font-semibold">
              {activeSessionLabel}{activePeriodLabel ? ` — ${activePeriodLabel}` : ''}
            </span>
          </p>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total amount', value: fmtMoney(stats.total_amount), iconBg: 'bg-blue-50 border-blue-100', iconColor: 'text-blue-500', icon: Award },
          { label: 'Paid', value: fmtMoney(stats.paid_amount), iconBg: 'bg-emerald-50 border-emerald-100', iconColor: 'text-emerald-500', icon: Check },
          { label: 'Unpaid', value: fmtMoney(stats.unpaid_amount), iconBg: 'bg-amber-50 border-amber-100', iconColor: 'text-amber-500', icon: AlertTriangle },
          { label: 'Total records', value: total, iconBg: 'bg-violet-50 border-violet-100', iconColor: 'text-violet-500', icon: Star },
        ].map(({ label, value, iconBg, iconColor, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 border rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800 tabular-nums">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Category Breakdown ── */}
      {stats.category_breakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Category breakdown</p>
          <div className="flex flex-wrap gap-2">
            {stats.category_breakdown.map(cat => (
              <div key={cat.name} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500">{cat.name}</span>
                <span className="text-xs font-bold text-slate-800 tabular-nums">{fmtMoney(cat.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Filter bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name or staff ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={month} onChange={e => setMonth(e.target.value)} className={selectCls}>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={year} onChange={e => setYear(e.target.value)} className={selectCls}>
                {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
              <button
                onClick={() => fetchData(page)}
                title="Refresh"
                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={selectCls}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="">All status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <select
              value={selectedSession}
              onChange={e => { setSelectedSession(e.target.value); setSelectedPeriod(''); }}
              className={selectCls}
            >
              <option value="">All sessions</option>
              {sessions.map((s: any) => (
                <option key={s.id} value={String(s.id)}>{s.start_year}/{s.end_year}</option>
              ))}
            </select>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              disabled={!selectedSession}
              className={selectCls + ' disabled:opacity-40 disabled:cursor-not-allowed'}
            >
              <option value="">All terms</option>
              {periods.map((p: any) => (
                <option key={p.id} value={String(p.id)}>{p.period?.name || `Period ${p.id}`}</option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Table Body ── */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500 mx-auto" />
            <p className="mt-2.5 text-sm text-slate-400">Loading bonuses...</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-7 w-7 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button
              onClick={() => fetchData(1)}
              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : bonuses.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Award className="h-6 w-6 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No bonuses match your filters' : 'No bonuses yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {hasFilters ? 'Try adjusting your filters.' : 'Add your first bonus record to get started.'}
            </p>
            {!hasFilters && canCreate && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-200"
              >
                <Plus className="h-4 w-4" /> Add bonus
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '820px' }}>
                <colgroup>
                  <col style={{ width: '44px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '72px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '112px' }} />
                  <col style={{ width: '88px' }} />
                  <col style={{ width: '96px' }} />
                  <col style={{ width: '120px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-3 py-2.5" />
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Recipient
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Category
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Due date
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bonuses.map(bonus => {
                    const staffDetail = (bonus.staff_detail as any) || null;
                    const recipientName = bonus.type === 'staff'
                      ? (staffDetail?.full_name || bonus.staff_name || 'Unknown')
                      : bonus.volunteer_name;
                    const recipientSub = bonus.type === 'staff'
                      ? (staffDetail?.staff_id || '')
                      : 'Volunteer';

                    return (
                      <tr key={bonus.id} className="hover:bg-slate-50/60 transition-colors group">
                        {/* Avatar */}
                        <td className="px-3 py-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                            ${bonus.type === 'staff'
                              ? 'bg-blue-50 border border-blue-100'
                              : 'bg-slate-50 border border-slate-200'}`}>
                            {bonus.type === 'staff'
                              ? <UserCircle className="h-4 w-4 text-blue-400" />
                              : <Users className="h-4 w-4 text-slate-400" />}
                          </div>
                        </td>

                        {/* Recipient */}
                        <td className="px-3 py-2.5">
                          <p className="text-sm font-medium text-slate-900 truncate">{recipientName}</p>
                          {recipientSub && (
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{recipientSub}</p>
                          )}
                        </td>

                        {/* Type */}
                        <td className="px-3 py-2.5 text-center">
                          {bonus.type === 'staff'
                            ? <span className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 text-[11px] font-semibold rounded-md">Staff</span>
                            : <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold rounded-md">Vol</span>}
                        </td>

                        {/* Category */}
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-500 truncate block">
                            {getCategoryName(typeof bonus.category === 'number' ? bonus.category : 0)}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-sm font-semibold text-slate-800 tabular-nums">
                            {fmtMoney(bonus.amount)}
                          </span>
                        </td>

                        {/* Due date */}
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-500">
                            {new Date(bonus.due_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5 text-center">
                          {bonus.status === 'paid' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-semibold rounded-full whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 text-[11px] font-semibold rounded-full whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />Unpaid
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setDetailId(bonus.id)}
                              title="View details"
                              className="w-7 h-7 rounded-lg flex items-center justify-center border border-blue-100 bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => openEdit(bonus)}
                                title="Edit"
                                className="w-7 h-7 rounded-lg flex items-center justify-center border border-amber-100 bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canEdit && bonus.status === 'unpaid' && (
                              <button
                                onClick={() => setMarkingPaidBonus(bonus)}
                                title="Mark as paid"
                                className="w-7 h-7 rounded-lg flex items-center justify-center border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setDeletingBonus(bonus)}
                                title="Delete"
                                className="w-7 h-7 rounded-lg flex items-center justify-center border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-400">
                Showing{' '}
                <span className="font-medium text-slate-600">
                  {bonuses.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)}
                </span>
                {' '}of{' '}
                <span className="font-semibold text-slate-700">{total}</span>
                {' '}bonuses
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchData(page - 1)}
                    disabled={page === 1}
                    className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5
                      ? i + 1
                      : page <= 3
                        ? i + 1
                        : page >= totalPages - 2
                          ? totalPages - 4 + i
                          : page - 2 + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => fetchData(pg)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors
                          ${pg === page
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchData(page + 1)}
                    disabled={page === totalPages}
                    className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
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