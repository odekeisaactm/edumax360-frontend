'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicCalendarAPI } from '@/lib/api';
import { Session, SessionFormValues } from '@/lib/types';
import {
  Calendar, Plus, Edit3, Trash2, Check, X,
  AlertCircle, AlertTriangle, Loader2, CheckCircle2,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);

    // DRF validation errors are nested under 'details'
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      if (details.__all__?.length) return details.__all__[0];
      const fields = Object.entries(details)
        .map(([f, v]) => Array.isArray(v) ? v[0] : String(v))
        .join(' ');
      if (fields) return fields;
    }

    if (d.non_field_errors?.length) return d.non_field_errors[0];
    if (d.error) return String(d.error);
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────
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
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ open, session, isDeleting, onConfirm, onCancel }: {
  open: boolean; session: Session | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !session) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Session</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete <span className="font-semibold text-slate-700">"{session.start_year}{session.separator}{session.end_year}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Session Form Modal ────────────────────────────────────────────────────────
function SessionModal({ editing, isSaving, onSave, onClose }: {
  editing: Session | null; isSaving: boolean;
  onSave: (data: SessionFormValues) => Promise<void>; onClose: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState<SessionFormValues>(
    editing
      ? { start_year: editing.start_year, end_year: editing.end_year, separator: editing.separator }
      : { start_year: currentYear, end_year: currentYear + 1, separator: '/' }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const preview = `${form.start_year}${form.separator}${form.end_year}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.start_year || !form.end_year) {
      setFormError('Both start and end year are required.'); return;
    }
    if (form.end_year <= form.start_year) {
      setFormError('End year must be greater than start year.'); return;
    }
    if (form.start_year < currentYear - 50 || form.end_year > currentYear + 10) {
      setFormError('Please enter a realistic year range.'); return;
    }

    try { await onSave(form); }
    catch (err: any) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {editing ? 'Edit Session' : 'New Academic Session'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error — outside scroll, always visible */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{formError}</span>
          </div>
        )}

        <form id="session-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Start Year <span className="text-red-400">*</span>
              </label>
              <input type="number" required value={form.start_year}
                onChange={e => setForm(f => ({ ...f, start_year: parseInt(e.target.value) || 0 }))}
                className={inputCls} placeholder="e.g. 2024" min={2000} max={2100} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                End Year <span className="text-red-400">*</span>
              </label>
              <input type="number" required value={form.end_year}
                onChange={e => setForm(f => ({ ...f, end_year: parseInt(e.target.value) || 0 }))}
                className={inputCls} placeholder="e.g. 2025" min={2000} max={2100} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Separator</label>
            <div className="flex gap-3">
              {(['/', '-'] as const).map(sep => (
                <button key={sep} type="button"
                  onClick={() => setForm(f => ({ ...f, separator: sep }))}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border-2 transition-all ${
                    form.separator === sep
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {sep === '/' ? 'Slash (/)' : 'Dash (-)'}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 text-center">
            <p className="text-xs text-slate-500 mb-1">Preview</p>
            <p className="text-2xl font-bold text-slate-800 tracking-wide">{preview}</p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="session-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update' : 'Create'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const { hasPermission, user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('school_configuration.add_sessionmodel');
  const canEdit   = user?.is_superuser || hasPermission('school_configuration.change_sessionmodel');
  const canDelete = user?.is_superuser || hasPermission('school_configuration.delete_sessionmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await academicCalendarAPI.listSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  };

  const openCreate = () => { setEditingSession(null); setShowModal(true); };
  const openEdit = (s: Session) => { setEditingSession(s); setShowModal(true); };

  const handleSave = async (form: SessionFormValues) => {
    setIsSaving(true);
    try {
      if (editingSession) {
        const updated = await academicCalendarAPI.updateSession(editingSession.id, form);
        setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast('success', 'Session updated successfully');
      } else {
        const created = await academicCalendarAPI.createSession(form);
        setSessions(prev => [created, ...prev]);
        showToast('success', 'Session created successfully');
      }
      setShowModal(false);
    } catch (err) {
      throw err; // Modal handles display
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingSession) return;
    setIsDeleting(true);
    try {
      await academicCalendarAPI.deleteSession(deletingSession.id);
      setSessions(prev => prev.filter(s => s.id !== deletingSession.id));
      showToast('success', 'Session deleted');
      setDeletingSession(null);
    } catch (err: any) {
      showToast('error', extractError(err));
      setDeletingSession(null);
    } finally { setIsDeleting(false); }
  };

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={!!deletingSession} session={deletingSession} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingSession(null)}
      />
      {showModal && (
        <SessionModal editing={editingSession} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            Academic Sessions
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage your school's academic years</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Session
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading sessions...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchSessions} className="text-sm text-blue-600 underline">Retry</button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No sessions yet</h3>
            <p className="text-sm text-slate-400 mb-5">Add your first academic session to get started.</p>
            {canCreate && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Session
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Session</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {sessions.map(session => (
                <div key={session.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                  {/* Session name */}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${session.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <Calendar className={`h-4 w-4 ${session.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">
                        {session.start_year}{session.separator}{session.end_year}
                      </p>
                      <p className="text-xs text-slate-400">ID #{session.id}</p>
                    </div>
                  </div>

                  {/* Status */}
                  {session.is_active ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Inactive
                    </span>
                  )}

                  {/* Created */}
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(session.created_at).toLocaleDateString()}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button onClick={() => openEdit(session)} title="Edit"
                        className="p-2 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition-all">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingSession(session)} title="Delete"
                        className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all">
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
    </div>
  );
}