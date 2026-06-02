'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicCalendarAPI } from '@/lib/api';
import {
  AcademicSessionPeriod, AcademicSessionPeriodFormValues,
  Session, AcademicPeriodType, SchoolSection,
} from '@/lib/types';
import {
  CalendarRange, Plus, Edit3, Trash2, Check, X,
  AlertCircle, AlertTriangle, Loader2, Star,
  ChevronDown, Globe, Building2, Calendar,
  Palmtree, ArrowRight, Clock,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.details) {
      const det = d.details;
      if (det.non_field_errors?.length) return det.non_field_errors[0];
      if (det.__all__?.length) return det.__all__[0];
      const fields = Object.entries(det)
        .map(([, v]) => Array.isArray(v) ? v[0] : String(v))
        .join(' ');
      if (fields) return fields;
    }
    if (d.error) return String(d.error);
  }
  return err?.message || 'An unexpected error occurred.';
}

function sessionLabel(s: Session) {
  return `${s.start_year}${s.separator}${s.end_year}`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
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
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, isLoading, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; isLoading: boolean;
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
        <p className="text-sm text-slate-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
interface ModalProps {
  editing: AcademicSessionPeriod | null;
  isSaving: boolean;
  sessions: Session[];
  periodTypes: AcademicPeriodType[];
  sections: SchoolSection[];
  onSave: (data: AcademicSessionPeriodFormValues) => Promise<void>;
  onClose: () => void;
}

function SessionPeriodModal({ editing, isSaving, sessions, periodTypes, sections, onSave, onClose }: ModalProps) {
  // Derive available periods from the active period type
  const activePeriodType = periodTypes.find(pt => pt.is_active);
  const availablePeriods = activePeriodType?.periods ?? [];

  const [form, setForm] = useState<AcademicSessionPeriodFormValues>({
    session_id: editing?.session?.id ?? (sessions[0]?.id ?? 0),
    period_id: editing?.period?.id ?? (availablePeriods[0]?.id ?? 0),
    school_section_id: editing?.school_section?.id ?? undefined,
    resumption_date: editing?.resumption_date ?? '',
    closing_date: editing?.closing_date ?? '',
    next_resumption_date: editing?.next_resumption_date ?? '',
    is_current: editing?.is_current ?? false,
    is_on_holiday: editing?.is_on_holiday ?? false,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof AcademicSessionPeriodFormValues>(k: K, v: AcademicSessionPeriodFormValues[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.session_id) { setFormError('Please select a session.'); return; }
    if (!form.period_id) { setFormError('Please select a period.'); return; }
    if (form.resumption_date && form.closing_date && form.resumption_date >= form.closing_date) {
      setFormError('Resumption date must be before closing date.'); return;
    }
    const payload = {
      ...form,
      school_section_id: form.school_section_id || undefined,
      resumption_date: form.resumption_date || undefined,
      closing_date: form.closing_date || undefined,
      next_resumption_date: form.next_resumption_date || undefined,
    };
    try { await onSave(payload); }
    catch (err: any) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition bg-white";
  const selectCls = inputCls + " cursor-pointer";

  const selectedSession = sessions.find(s => s.id === form.session_id);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarRange className="h-4 w-4" />
            {editing ? 'Edit Session Period' : 'New Session Period'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{formError}</span>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <form id="sp-form" onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Session */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Session <span className="text-red-400">*</span>
              </label>
              <select value={form.session_id} onChange={e => set('session_id', Number(e.target.value))} className={selectCls}>
                <option value={0} disabled>Select session...</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{sessionLabel(s)}{s.is_active ? ' (Active)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Period */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Period <span className="text-red-400">*</span>
              </label>
              {availablePeriods.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  No active period type found. Create and activate a period type first.
                </div>
              ) : (
                <select value={form.period_id} onChange={e => set('period_id', Number(e.target.value))} className={selectCls}>
                  <option value={0} disabled>Select period...</option>
                  {availablePeriods.sort((a, b) => a.order - b.order).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
              {activePeriodType && (
                <p className="text-xs text-slate-400 mt-1">From active type: <span className="font-medium text-slate-600">{activePeriodType.plural_name}</span></p>
              )}
            </div>

            {/* Section */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                School Section <span className="text-slate-300">(optional — leave blank for global)</span>
              </label>
              <select
                value={form.school_section_id ?? ''}
                onChange={e => set('school_section_id', e.target.value ? Number(e.target.value) : undefined)}
                className={selectCls}>
                <option value="">Global (all sections)</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Resumption Date</label>
                <input type="date" value={form.resumption_date ?? ''} onChange={e => set('resumption_date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Closing Date</label>
                <input type="date" value={form.closing_date ?? ''} onChange={e => set('closing_date', e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Next Resumption Date</label>
              <input type="date" value={form.next_resumption_date ?? ''} onChange={e => set('next_resumption_date', e.target.value)} className={inputCls} />
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-1">
              {/* Is Current */}
              <div className="flex items-center justify-between p-3.5 bg-violet-50 rounded-xl border border-violet-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                    <Star className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Set as Current Period</p>
                    <p className="text-xs text-slate-500">Makes this the active period for the session</p>
                  </div>
                </div>
                <button type="button" onClick={() => set('is_current', !form.is_current)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.is_current ? 'bg-violet-500' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_current ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Is On Holiday */}
              <div className="flex items-center justify-between p-3.5 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Palmtree className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">On Holiday</p>
                    <p className="text-xs text-slate-500">School is currently on break</p>
                  </div>
                </div>
                <button type="button" onClick={() => set('is_on_holiday', !form.is_on_holiday)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.is_on_holiday ? 'bg-amber-500' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_on_holiday ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="sp-form" disabled={isSaving || availablePeriods.length === 0}
            className="px-5 py-2 text-sm bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-violet-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update' : 'Create'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Period Card ───────────────────────────────────────────────────────────────
function PeriodCard({ sp, canChange, canDelete, onEdit, onDelete }: {
  sp: AcademicSessionPeriod;
  canChange: boolean; canDelete: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden
      ${sp.is_current ? 'border-violet-200 ring-1 ring-violet-100' : 'border-slate-100'}`}>
      <div className={`h-1 w-full ${sp.is_current ? 'bg-gradient-to-r from-violet-400 to-purple-400' : sp.is_on_holiday ? 'bg-gradient-to-r from-amber-300 to-orange-300' : 'bg-slate-100'}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm
              ${sp.is_current ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
              {sp.period.order}
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{sp.period.name}</h3>
              <p className="text-xs text-slate-400">{sessionLabel(sp.session)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {sp.is_current && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-full">
                <Star className="h-3 w-3 fill-violet-500" /> Current
              </span>
            )}
            {sp.is_on_holiday && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                <Palmtree className="h-3 w-3" /> Holiday
              </span>
            )}
          </div>
        </div>

        {/* Section */}
        <div className="flex items-center gap-2 mb-4">
          {sp.school_section ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">{sp.school_section.name}</span>
              <span className="text-xs text-slate-400">({sp.school_section.code})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Global</span>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="space-y-2 mb-4">
          {(sp.resumption_date || sp.closing_date) && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span>{fmt(sp.resumption_date)}</span>
              <ArrowRight className="h-3 w-3 text-slate-300" />
              <span>{fmt(sp.closing_date)}</span>
            </div>
          )}
          {sp.next_resumption_date && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span>Next: {fmt(sp.next_resumption_date)}</span>
            </div>
          )}
          {!sp.resumption_date && !sp.closing_date && !sp.next_resumption_date && (
            <p className="text-xs text-slate-300 italic">No dates set</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-3 border-t border-slate-50">
          {canChange && (
            <button onClick={onEdit} title="Edit"
              className="p-2 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition-all">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} title="Delete"
              className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SessionPeriodsPage() {
  const { hasPermission, user } = useAuth();

  const [sessionPeriods, setSessionPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periodTypes, setPeriodTypes] = useState<AcademicPeriodType[]>([]);
  const [sections, setSections] = useState<SchoolSection[]>([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Filters
  const [filterSession, setFilterSession] = useState<number | ''>('');
  const [filterSection, setFilterSection] = useState<number | ''>('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AcademicSessionPeriod | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean; sp: AcademicSessionPeriod | null; isLoading: boolean;
  }>({ open: false, sp: null, isLoading: false });

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canAdd    = user?.is_superuser || hasPermission('school_configuration.add_academicsessionperiodmodel');
  const canChange = user?.is_superuser || hasPermission('school_configuration.change_academicsessionperiodmodel');
  const canDelete = user?.is_superuser || hasPermission('school_configuration.delete_academicsessionperiodmodel');

  // ── Utils ──────────────────────────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Load reference data ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true); setPageError(null);
      try {
        const [sps, sess, pts, secs] = await Promise.all([
          academicCalendarAPI.listSessionPeriods(),
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.listPeriodTypes(),
          academicCalendarAPI.listSchoolSections(),
        ]);
        setSessionPeriods(Array.isArray(sps) ? sps : []);
        setSessions(Array.isArray(sess) ? sess : []);
        setPeriodTypes(Array.isArray(pts) ? pts : []);
        setSections(Array.isArray(secs) ? secs : []);

        // Default filter to active session
        const active = (sess as Session[]).find(s => s.is_active);
        if (active) setFilterSession(active.id);
      } catch (err: any) {
        setPageError(extractError(err));
      } finally { setLoading(false); }
    };
    load();
  }, []);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return sessionPeriods.filter(sp => {
      if (filterSession && sp.session.id !== filterSession) return false;
      if (filterSection !== '') {
        if (filterSection === 0 && sp.school_section !== null && sp.school_section !== undefined) return false;
        if (filterSection !== 0 && sp.school_section?.id !== filterSection) return false;
      }
      return true;
    });
  }, [sessionPeriods, filterSession, filterSection]);

  // Sort: current first, then by period order
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
      return a.period.order - b.period.order;
    }), [filtered]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditing(null); setShowModal(true); };
  const openEdit = (sp: AcademicSessionPeriod) => { setEditing(sp); setShowModal(true); };

  const handleSave = async (form: AcademicSessionPeriodFormValues) => {
    setIsSaving(true);
    try {
      if (editing) {
        const updated = await academicCalendarAPI.updateSessionPeriod(editing.id, form);
        setSessionPeriods(prev => prev.map(sp => sp.id === updated.id ? updated : sp));
        // If newly set as current, unset others in same session/section
        if (form.is_current) {
          setSessionPeriods(prev => prev.map(sp => {
            if (sp.id === updated.id) return updated;
            if (sp.session.id === updated.session.id &&
                sp.school_section?.id === updated.school_section?.id) {
              return { ...sp, is_current: false };
            }
            return sp;
          }));
          // Also update session is_active
          setSessions(prev => prev.map(s => ({ ...s, is_active: s.id === updated.session.id })));
        }
        showToast('success', 'Session period updated');
      } else {
        const created = await academicCalendarAPI.createSessionPeriod(form);
        setSessionPeriods(prev => [created, ...prev]);
        if (form.is_current) {
          setSessionPeriods(prev => prev.map(sp => {
            if (sp.id === created.id) return sp;
            if (sp.session.id === created.session.id &&
                sp.school_section?.id === created.school_section?.id) {
              return { ...sp, is_current: false };
            }
            return sp;
          }));
          setSessions(prev => prev.map(s => ({ ...s, is_active: s.id === created.session.id })));
        }
        showToast('success', 'Session period created');
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const confirmDelete = (sp: AcademicSessionPeriod) =>
    setConfirmState({ open: true, sp, isLoading: false });

  const handleDelete = async () => {
    if (!confirmState.sp) return;
    setConfirmState(s => ({ ...s, isLoading: true }));
    try {
      await academicCalendarAPI.deleteSessionPeriod(confirmState.sp.id);
      setSessionPeriods(prev => prev.filter(sp => sp.id !== confirmState.sp!.id));
      showToast('success', 'Session period deleted');
      setConfirmState({ open: false, sp: null, isLoading: false });
    } catch (err: any) {
      showToast('error', extractError(err));
      setConfirmState(s => ({ ...s, isLoading: false, open: false }));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const activeSession = sessions.find(s => s.is_active);

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={confirmState.open}
        title="Delete Session Period"
        message={confirmState.sp
          ? `Delete "${confirmState.sp.period.name}" from ${sessionLabel(confirmState.sp.session)}? This cannot be undone.`
          : ''}
        isLoading={confirmState.isLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmState({ open: false, sp: null, isLoading: false })}
      />
      {showModal && (
        <SessionPeriodModal
          editing={editing} isSaving={isSaving}
          sessions={sessions} periodTypes={periodTypes} sections={sections}
          onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <CalendarRange className="h-5 w-5 text-white" />
            </div>
            Session Periods
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">
            Link sessions and periods with dates, and mark which is current
          </p>
        </div>
        {canAdd && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200">
            <Plus className="h-4 w-4" /> Add Session Period
          </button>
        )}
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Star className="h-4 w-4 text-violet-600 fill-violet-400" />
          </div>
          <p className="text-sm text-violet-800">
            Active session: <span className="font-bold">{sessionLabel(activeSession)}</span>
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <select value={filterSession} onChange={e => setFilterSession(e.target.value ? Number(e.target.value) : '')}
            className="pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none appearance-none cursor-pointer font-medium text-slate-700">
            <option value="">All Sessions</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{sessionLabel(s)}{s.is_active ? ' ★' : ''}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={filterSection} onChange={e => setFilterSection(e.target.value === '' ? '' : Number(e.target.value))}
            className="pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none appearance-none cursor-pointer font-medium text-slate-700">
            <option value="">All Sections</option>
            <option value={0}>Global only</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>

        {(filterSession !== '' || filterSection !== '') && (
          <button onClick={() => { setFilterSession(''); setFilterSection(''); }}
            className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Clear filters
          </button>
        )}

        <span className="ml-auto flex items-center text-xs text-slate-400 font-medium">
          {sorted.length} record{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400">Loading session periods...</p>
        </div>
      ) : pageError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-700 mb-3">{pageError}</p>
          <button onClick={() => window.location.reload()} className="text-sm text-red-600 underline">Retry</button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarRange className="h-8 w-8 text-violet-200" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">No session periods found</h3>
          <p className="text-sm text-slate-400 mb-5">
            {filterSession || filterSection !== ''
              ? 'No records match your current filters.'
              : 'Create your first session period to set up the academic calendar.'}
          </p>
          {canAdd && !filterSession && filterSection === '' && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200">
              <Plus className="h-4 w-4" /> Add Session Period
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sorted.map(sp => (
            <PeriodCard key={sp.id} sp={sp}
              canChange={canChange} canDelete={canDelete}
              onEdit={() => openEdit(sp)}
              onDelete={() => confirmDelete(sp)}
            />
          ))}
        </div>
      )}
    </div>
  );
}