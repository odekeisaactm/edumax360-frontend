'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { marqueeAPI, academicAPI, departmentsAPI } from '@/lib/api';
import type {
  MarqueeMessage,
  MarqueeMessageFormValues,
  MarqueeTargetType,
  MarqueeDisplayLocation,
  MarqueeDismissalBehavior
} from '@/lib/types';
import {
  MonitorPlay, Plus, Edit3, Trash2, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  Calendar, Users, Filter, LayoutTemplate,
  ChevronDown, ChevronUp, AlignLeft
} from 'lucide-react';

// ─── Helpers & Constants ───────────────────────────────────────────────────────

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
        .map(([, v]) => (Array.isArray(v) ? (v as any[])[0] : String(v)))
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

const PAGE_SIZE = 20;

const TARGET_LABELS: Record<MarqueeTargetType, string> = {
  ALL: 'Everyone',
  STUDENT: 'Students',
  STAFF: 'Staff',
  PARENT: 'Parents',
};

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-[fadeIn_0.2s_ease-out]
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ open, title, message, isProcessing, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; isProcessing: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.15s_ease-out]">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">{title}</h3>
        <p className="text-sm text-slate-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isProcessing} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isProcessing} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Live Scrolling Preview Component ──────────────────────────────────────────

function MarqueePreview({ message, dismissBehavior }: { message: string, dismissBehavior: MarqueeDismissalBehavior }) {
  return (
    <div className="w-full bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-white py-2.5 px-4 flex items-center relative overflow-hidden group rounded-xl shadow-inner border border-indigo-950">

      <div className="flex-shrink-0 flex items-center gap-2 z-10 bg-indigo-900 pr-3 shadow-[10px_0_15px_-5px_rgba(49,46,129,1)]">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span className="uppercase tracking-wider text-[10px] font-bold text-indigo-200">Live Preview</span>
      </div>

      <div className="flex-1 overflow-hidden relative flex items-center">
        {/* Uses the global .animate-marquee class */}
        <div className="whitespace-nowrap inline-block animate-marquee group-hover:[animation-play-state:paused] text-sm font-medium">
          <span className="mx-4">{message || "Type a message below to see it scroll here..."}</span>
          <span className="mx-4 text-indigo-400/50">•</span>
          <span className="mx-4">{message || "Type a message below to see it scroll here..."}</span>
        </div>
      </div>

      {dismissBehavior !== 'CANNOT_DISMISS' && (
        <div className="ml-3 z-10 flex-shrink-0 p-1 rounded-md text-indigo-300 bg-indigo-900 shadow-[-10px_0_15px_-5px_rgba(49,46,129,1)] cursor-not-allowed">
          <X className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

// ─── Marquee Drawer Wizard ─────────────────────────────────────────────────────

function MarqueeDrawer({
  editing, isSaving, onSave, onClose, showToast
}: {
  editing: MarqueeMessage | null; isSaving: boolean;
  onSave: (data: Partial<MarqueeMessageFormValues>) => Promise<void>; onClose: () => void;
  showToast: (type: 'success'|'error', msg: string) => void;
}) {
  const [form, setForm] = useState<MarqueeMessageFormValues>(
    editing ? {
      message: editing.message,
      target_type: editing.target_type,
      filter_criteria: editing.filter_criteria || {},
      display_location: editing.display_location,
      dismissal_behavior: editing.dismissal_behavior,
      is_active: editing.is_active,
      start_date: editing.start_date,
      end_date: editing.end_date,
    } : {
      message: '',
      target_type: 'ALL',
      filter_criteria: {},
      display_location: 'ALL_PAGES',
      dismissal_behavior: 'SESSION',
      is_active: true,
      start_date: null,
      end_date: null,
    }
  );

  const [departments, setDepartments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    if (form.target_type === 'STAFF') {
      departmentsAPI.list().then(data => {
        setDepartments(Array.isArray(data) ? data : (data as any).results || []);
      }).catch(() => {});
    }
    if (form.target_type === 'STUDENT') {
      academicAPI.listClasses().then(data => {
        setClasses(Array.isArray(data) ? data : (data as any).results || []);
      }).catch(() => {});
    }
  }, [form.target_type]);

  const set = <K extends keyof MarqueeMessageFormValues>(key: K, val: MarqueeMessageFormValues[K]) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return showToast('error', 'Message cannot be empty.');

    if (form.start_date && form.end_date) {
      if (new Date(form.start_date) > new Date(form.end_date)) {
        return showToast('error', 'Start date cannot be after end date.');
      }
    }
    await onSave(form);
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none bg-white font-medium text-slate-800 transition-shadow";
  const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex justify-end animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-[slideInRight_0.3s_ease-out]">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MonitorPlay className="h-5 w-5 text-indigo-600" /> {editing ? 'Edit Marquee' : 'Create Marquee'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Configure global scrolling announcements.</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"><X className="h-5 w-5"/></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">

          <div className="space-y-2">
            <label className={labelCls}>Message Content <span className="text-red-500">*</span></label>
            <MarqueePreview message={form.message} dismissBehavior={form.dismissal_behavior} />
            <textarea required value={form.message} onChange={e => set('message', e.target.value)} placeholder="Enter the announcement text..." maxLength={500}
              className={`${inputCls} mt-3 h-24 resize-none`} />
            <p className="text-right text-[10px] text-slate-400 font-medium">{form.message.length} / 500 characters</p>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Display Location</label>
              <select value={form.display_location} onChange={e => set('display_location', e.target.value as MarqueeDisplayLocation)} className={inputCls}>
                <option value="DASHBOARD_ONLY">Dashboard Only</option>
                <option value="ALL_PAGES">All Pages</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Dismissal Behavior</label>
              <select value={form.dismissal_behavior} onChange={e => set('dismissal_behavior', e.target.value as MarqueeDismissalBehavior)} className={inputCls}>
                <option value="CANNOT_DISMISS">Cannot Dismiss (Always Show)</option>
                <option value="SESSION">Dismiss for Session</option>
                <option value="PERMANENT">Dismiss Permanently</option>
              </select>
            </div>
          </div>

          <div className="p-5 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-5">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Users className="h-4 w-4 text-indigo-600"/> Targeting</h4>

            <div>
              <label className={labelCls}>Target Audience</label>
              <select value={form.target_type} onChange={e => { set('target_type', e.target.value as MarqueeTargetType); set('filter_criteria', {}); }} className={inputCls}>
                {Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {form.target_type !== 'ALL' && (
              <div className="pt-4 border-t border-slate-200/60 space-y-4">
                <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><Filter className="h-3 w-3"/> Optional Sub-Filters</h5>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select value={form.filter_criteria.gender || ''} onChange={e => set('filter_criteria', { ...form.filter_criteria, gender: e.target.value })} className={inputCls}>
                      <option value="">All Genders</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  {form.target_type === 'STAFF' && (
                    <div>
                      <label className={labelCls}>Department</label>
                      <select value={form.filter_criteria.department_id || ''} onChange={e => set('filter_criteria', { ...form.filter_criteria, department_id: e.target.value })} className={inputCls}>
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}

                  {form.target_type === 'STUDENT' && (
                    <div>
                      <label className={labelCls}>Class</label>
                      <select value={form.filter_criteria.class_id || ''} onChange={e => set('filter_criteria', { ...form.filter_criteria, class_id: e.target.value })} className={inputCls}>
                        <option value="">All Classes</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {form.target_type === 'PARENT' && (
                  <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer p-3 bg-white rounded-xl border border-slate-200">
                    <input type="checkbox" checked={!!form.filter_criteria.require_active_ward}
                      onChange={e => set('filter_criteria', { ...form.filter_criteria, require_active_ward: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                    Only target parents with active wards
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="p-5 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">Publish Status</p>
                <p className="text-xs text-slate-500">Should this marquee be live immediately?</p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active} onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${form.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-5 pt-4 border-t border-slate-200/60">
              <div>
                <label className={labelCls}>Start Date <span className="lowercase font-normal text-slate-400">(Optional)</span></label>
                <input type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value || null)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>End Date <span className="lowercase font-normal text-slate-400">(Optional)</span></label>
                <input type="date" value={form.end_date || ''} onChange={e => set('end_date', e.target.value || null)} className={inputCls} />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={isSaving} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center gap-2">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin"/> Saving...</> : <><Check className="h-4 w-4" /> Save Marquee</>}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function MarqueesPage() {
  const { hasPermission, user } = useAuth();

  const [marquees, setMarquees] = useState<MarqueeMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingItem, setEditingItem] = useState<MarqueeMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingItem, setDeletingItem] = useState<MarqueeMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null); // Added expand state

  const canManage = user?.is_superuser || hasPermission('communication.manage_communication_settings');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchMarquees = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await marqueeAPI.list();
      const results = (data as any)?.results ?? (data as any)?.data ?? data ?? [];
      setMarquees(Array.isArray(results) ? results : []);
      setTotal((data as any)?.count ?? results.length);
    } catch (err: any) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMarquees(); }, [fetchMarquees]);

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await marqueeAPI.delete(deletingItem.id);
      setMarquees(prev => prev.filter(m => m.id !== deletingItem.id));
      showToast('success', 'Marquee deleted successfully.');
      setDeletingItem(null);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setIsDeleting(false); }
  };

  const handleSave = async (form: Partial<MarqueeMessageFormValues>) => {
    setIsSaving(true);
    try {
      if (editingItem) {
        const updated = await marqueeAPI.update(editingItem.id, form);
        setMarquees(prev => prev.map(m => m.id === updated.id ? updated : m));
        showToast('success', 'Marquee updated successfully.');
      } else {
        const created = await marqueeAPI.create(form as MarqueeMessageFormValues);
        setMarquees(prev => [created, ...prev]);
        showToast('success', 'Marquee created successfully.');
      }
      setShowDrawer(false);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setIsSaving(false); }
  };

  const openCreate = () => { setEditingItem(null); setShowDrawer(true); };
  const openEdit = (item: MarqueeMessage) => { setEditingItem(item); setShowDrawer(true); };

  const formatDisplay = (loc: string, beh: string) => {
    const l = loc === 'DASHBOARD_ONLY' ? 'Dashboard' : 'Global';
    const b = beh === 'CANNOT_DISMISS' ? 'Sticky' : beh === 'SESSION' ? 'Session' : 'Dismissible';
    return `${l} • ${b}`;
  };

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingItem} title="Delete Marquee" message="Are you sure you want to permanently delete this announcement?"
        isProcessing={isDeleting} onConfirm={handleDelete} onCancel={() => setDeletingItem(null)}
      />

      {showDrawer && (
        <MarqueeDrawer editing={editingItem} isSaving={isSaving} onSave={handleSave} onClose={() => setShowDrawer(false)} showToast={showToast} />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <MonitorPlay className="h-5 w-5 text-white" />
            </div>
            Marquee Announcements
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage global scrolling alerts across the portal</p>
        </div>
        {canManage && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-bold rounded-xl hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md shadow-indigo-200">
            <Plus className="h-4 w-4" /> New Marquee
          </button>
        )}
      </div>

      {/* ── List Card (Edge-to-Edge) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Active & Scheduled Messages</h3>
          <button onClick={fetchMarquees} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><RefreshCw className="h-4 w-4"/></button>
        </div>

        {loading ? (
          <div className="p-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" /><p className="mt-2 text-sm text-slate-400">Loading marquees...</p></div>
        ) : pageError ? (
          <div className="p-10 text-center"><AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-red-600 mb-3">{pageError}</p></div>
        ) : marquees.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><MonitorPlay className="h-7 w-7 text-indigo-300" /></div>
            <h3 className="font-semibold text-slate-700 mb-1">No marquees configured</h3>
            <p className="text-sm text-slate-400 mb-5">Create a scrolling announcement to broadcast important information.</p>
          </div>
        ) : (
          <>
            {/* Adjusted grid to fit the new Expand Toggle Button */}
            <div className="grid grid-cols-[2fr_1fr_1fr_120px_120px] items-center gap-4 px-6 py-3 bg-slate-50/60 border-b border-slate-100 min-w-[800px] overflow-x-auto">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Message</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Target Audience</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Placement</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</span>
            </div>

            <div className="divide-y divide-slate-50 overflow-x-auto">
              {marquees.map(m => {
                const hasFilters = Object.keys(m.filter_criteria || {}).length > 0;
                const isExpanded = expandedId === m.id;

                return (
                  <React.Fragment key={m.id}>
                    <div className="grid grid-cols-[2fr_1fr_1fr_120px_120px] items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors min-w-[800px]">

                      {/* Truncated for table neatness */}
                      <div className="min-w-0 pr-4 max-w-sm" title={m.message}>
                        <p className="font-bold text-slate-900 text-sm truncate">{m.message}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1"><Calendar className="h-3 w-3"/> {m.start_date || 'Any'} – {m.end_date || 'Any'}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-indigo-400" /> {TARGET_LABELS[m.target_type]}</span>
                        {hasFilters && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Filter className="h-3 w-3"/> Filtered List</span>}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><LayoutTemplate className="h-3.5 w-3.5 text-slate-400"/> {formatDisplay(m.display_location, m.dismissal_behavior)}</span>
                      </div>

                      <div className="text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border w-max ${m.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {m.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <>
                            <button onClick={() => openEdit(m)} title="Edit" className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all"><Edit3 className="h-4 w-4" /></button>
                            <button onClick={() => setDeletingItem(m)} title="Delete" className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                        {/* New Accordion Toggle */}
                        <button onClick={() => setExpandedId(isExpanded ? null : m.id)} title="View full message"
                          className="p-1.5 rounded-lg text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-200 transition-all">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* The Expanded View */}
                    {isExpanded && (
                      <div className="px-6 pb-4 pt-0">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-4 shadow-inner">

                          {/* Full Text */}
                          <div>
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                              <AlignLeft className="h-3.5 w-3.5" /> Full Announcement Text
                            </span>
                            <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                              {m.message}
                            </p>
                          </div>

                          {/* Hidden Metadata Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200/60">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dismissal Behavior</span>
                              <p className="mt-1 text-xs text-slate-700 font-semibold">
                                {m.dismissal_behavior === 'CANNOT_DISMISS' ? 'Sticky (Cannot Dismiss)' : m.dismissal_behavior === 'SESSION' ? 'Session Only' : 'Permanent'}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Display Location</span>
                              <p className="mt-1 text-xs text-slate-700 font-semibold">
                                {m.display_location === 'DASHBOARD_ONLY' ? 'Dashboard Only' : 'All Pages'}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created</span>
                              <p className="mt-1 text-xs text-slate-700 font-semibold">
                                {new Date(m.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Marquee ID</span>
                              <p className="mt-1 text-xs text-slate-700 font-semibold text-mono">
                                #{m.id}
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {marquees.length} of {total} marquee{total !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}