'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicCalendarAPI } from '@/lib/api';
import { AcademicPeriodType } from '@/lib/types';
import {
  CalendarDays, Plus, Edit3, Trash2, Check, X,
  AlertCircle, AlertTriangle, Loader2, Layers,
  Hash, BookOpen, Star, ChevronRight,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.non_field_errors) return (d.non_field_errors as string[]).join(' ');
    const fields = Object.entries(d)
      .map(([f, v]) => `${f}: ${Array.isArray(v) ? (v as string[]).join(', ') : v}`)
      .join(' | ');
    if (fields) return fields;
  }
  return err?.message || 'An unexpected error occurred.';
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
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string;
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
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Period Name Input Row ─────────────────────────────────────────────────────
interface PeriodRow { order: number; name: string; }

// ─── Form Modal ───────────────────────────────────────────────────────────────
interface FormModalProps {
  editing: AcademicPeriodType | null;
  isSaving: boolean;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

function PeriodTypeModal({ editing, isSaving, onSave, onClose }: FormModalProps) {
  const [singularName, setSingularName] = useState(editing?.singular_name ?? '');
  const [pluralName, setPluralName] = useState(editing?.plural_name ?? '');
  const [periodsPerSession, setPeriodsPerSession] = useState(editing?.periods_per_session ?? 3);
  const [periodRows, setPeriodRows] = useState<PeriodRow[]>(() => {
    if (editing?.periods?.length) {
      return editing.periods.map(p => ({ order: p.order, name: p.name }));
    }
    return Array.from({ length: 3 }, (_, i) => ({ order: i + 1, name: '' }));
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Keep period rows in sync when periodsPerSession changes
  useEffect(() => {
    setPeriodRows(prev => {
      const rows: PeriodRow[] = [];
      for (let i = 1; i <= periodsPerSession; i++) {
        rows.push({ order: i, name: prev.find(r => r.order === i)?.name ?? '' });
      }
      return rows;
    });
  }, [periodsPerSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate period names
    const empty = periodRows.find(r => !r.name.trim());
    if (empty) { setFormError(`Please enter a name for Period ${empty.order}.`); return; }

    const payload: any = {
      singular_name: singularName.trim(),
      plural_name: pluralName.trim(),
      periods_per_session: periodsPerSession,
      periods: periodRows.map(r => ({ order: r.order, name: r.name.trim() })),
    };

    try { await onSave(payload); }
    catch (err: any) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {editing ? 'Edit Period Type' : 'New Period Type'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error — outside scroll */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{formError}</span>
          </div>
        )}

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form id="period-type-form" onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Singular Name <span className="text-red-400">*</span>
                </label>
                <input type="text" required value={singularName}
                  onChange={e => setSingularName(e.target.value)}
                  className={inputCls} placeholder="e.g., Term" />
                <p className="text-xs text-slate-400 mt-1">Used in labels: "Term 1"</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Plural Name <span className="text-red-400">*</span>
                </label>
                <input type="text" required value={pluralName}
                  onChange={e => setPluralName(e.target.value)}
                  className={inputCls} placeholder="e.g., Terms" />
                <p className="text-xs text-slate-400 mt-1">Used in headings</p>
              </div>
            </div>

            {/* Periods per session */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Periods per Session <span className="text-red-400">*</span>
              </label>
              <select value={periodsPerSession}
                onChange={e => setPeriodsPerSession(Number(e.target.value))}
                className={inputCls}>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'period' : 'periods'}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">How many periods make up one academic session</p>
            </div>

            {/* Period names */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Period Names <span className="text-red-400">*</span>
              </label>
              <div className="space-y-2">
                {periodRows.map((row, i) => (
                  <div key={row.order} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-teal-700">{row.order}</span>
                    </div>
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => {
                        const updated = [...periodRows];
                        updated[i] = { ...updated[i], name: e.target.value };
                        setPeriodRows(updated);
                      }}
                      className={inputCls}
                      placeholder={`e.g., ${singularName || 'Period'} ${row.order}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">These are the names displayed on reports, timetables and marksheets.</p>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="period-type-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-teal-700 hover:to-cyan-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-teal-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4" />{editing ? 'Update' : 'Create'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PeriodTypesPage() {
  const { hasPermission, user } = useAuth();

  const [periodTypes, setPeriodTypes] = useState<AcademicPeriodType[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<AcademicPeriodType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const canAdd    = user?.is_superuser || hasPermission('school_configuration.add_academicperiodtypemodel');
  const canChange = user?.is_superuser || hasPermission('school_configuration.change_academicperiodtypemodel');
  const canDelete = user?.is_superuser || hasPermission('school_configuration.delete_academicperiodtypemodel');

  // ── Utils ──────────────────────────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
  const setAction = (id: number, action: string) => setActionLoading(prev => ({ ...prev, [id]: action }));
  const clearAction = (id: number) => setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });

  // ── Data ───────────────────────────────────────────────────────────────────
  useEffect(() => { fetchPeriodTypes(); }, []);

  const fetchPeriodTypes = async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await academicCalendarAPI.listPeriodTypes();
      setPeriodTypes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditingType(null); setShowModal(true); };
  const openEdit = (pt: AcademicPeriodType) => { setEditingType(pt); setShowModal(true); };

  const handleSave = async (payload: any) => {
    setIsSaving(true);
    try {
      if (editingType) {
        const updated = await academicCalendarAPI.updatePeriodType(editingType.id, payload);
        setPeriodTypes(prev => prev.map(p => p.id === updated.id ? updated : p));
        showToast('success', 'Period type updated');
      } else {
        const created = await academicCalendarAPI.createPeriodType(payload);
        setPeriodTypes(prev => [created, ...prev]);
        showToast('success', 'Period type created');
      }
      setShowModal(false);
    } catch (err) {
      throw err; // Let modal handle & display it
    } finally { setIsSaving(false); }
  };

  const confirmDelete = (pt: AcademicPeriodType) => {
    setConfirmState({
      open: true,
      title: 'Delete Period Type',
      message: `"${pt.plural_name}" and all its period definitions will be permanently deleted.`,
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        setAction(pt.id, 'delete');
        try {
          await academicCalendarAPI.deletePeriodType(pt.id);
          setPeriodTypes(prev => prev.filter(p => p.id !== pt.id));
          showToast('success', 'Period type deleted');
        } catch (err: any) {
          showToast('error', extractError(err));
        } finally { clearAction(pt.id); }
      },
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={confirmState.open} title={confirmState.title} message={confirmState.message}
        confirmLabel="Delete" onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
      {showModal && (
        <PeriodTypeModal editing={editingType} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-200">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            Period Types
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">
            Define how your school structures academic periods — terms, semesters, quarters, etc.
          </p>
        </div>
        {canAdd && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-semibold rounded-xl hover:from-teal-700 hover:to-cyan-700 transition-all shadow-md shadow-teal-200">
            <Plus className="h-4 w-4" /> Add Period Type
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <BookOpen className="h-4 w-4 text-teal-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-teal-900 mb-0.5">How period types work</p>
          <p className="text-xs text-teal-700 leading-relaxed">
            Only one period type can be <strong>active</strong> at a time — activating a new one automatically deactivates the previous.
            The active type determines the structure used for sessions, timetables, assessments and reports across the school.
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400">Loading period types...</p>
        </div>
      ) : pageError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700 mb-3">{pageError}</p>
          <button onClick={fetchPeriodTypes} className="text-sm text-red-600 underline">Retry</button>
        </div>
      ) : periodTypes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="h-8 w-8 text-teal-300" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">No period types defined</h3>
          <p className="text-sm text-slate-400 mb-5">Create your first period type to structure your academic calendar.</p>
          {canAdd && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-semibold rounded-xl hover:from-teal-700 hover:to-cyan-700 transition-all shadow-md shadow-teal-200">
              <Plus className="h-4 w-4" /> Add Period Type
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {periodTypes.map(pt => {
            const busy = actionLoading[pt.id];
            return (
              <div key={pt.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${pt.is_active ? 'border-teal-200 ring-1 ring-teal-100' : 'border-slate-100'}`}>
                {/* Active indicator strip */}
                <div className={`h-1 w-full ${pt.is_active ? 'bg-gradient-to-r from-teal-400 to-cyan-400' : 'bg-slate-100'}`} />

                <div className="p-5">
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${pt.is_active ? 'bg-teal-50 border border-teal-100' : 'bg-slate-50 border border-slate-100'}`}>
                        <Layers className={`h-5 w-5 ${pt.is_active ? 'text-teal-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{pt.plural_name}</h3>
                        <p className="text-xs text-slate-400">Singular: <span className="font-medium text-slate-600">{pt.singular_name}</span></p>
                      </div>
                    </div>
                    {pt.is_active && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full flex-shrink-0">
                        <Star className="h-3 w-3 fill-teal-500" /> Active
                      </span>
                    )}
                  </div>

                  {/* Periods count chip */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                      <Hash className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-700">{pt.periods_per_session} per session</span>
                    </div>
                  </div>

                  {/* Period list */}
                  {pt.periods && pt.periods.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {pt.periods
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map(period => (
                          <div key={period.order} className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${pt.is_active ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600'}`}>
                              {period.order}
                            </div>
                            <span className="text-xs font-medium text-slate-700">{period.name}</span>
                            <ChevronRight className="h-3 w-3 text-slate-300 ml-auto" />
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 pt-3 border-t border-slate-50">
                    {canChange && (
                      <button onClick={() => openEdit(pt)} title="Edit"
                        className="p-2 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition-all">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => confirmDelete(pt)} disabled={!!busy} title="Delete"
                        className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all disabled:opacity-40">
                        {busy === 'delete'
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}