'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicCalendarAPI } from '@/lib/api';
import { SchoolSection, SchoolSectionFormValues } from '@/lib/types';
import {
  Building2, Plus, Edit3, Trash2, Check, X,
  AlertCircle, AlertTriangle, Loader2, Hash,
  ToggleLeft, ToggleRight, ArrowUp, ArrowDown,
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
        .map(([f, v]) => `${f}: ${Array.isArray(v) ? v[0] : String(v)}`)
        .join(' | ');
      if (fields) return fields;
    }
    if (d.error) return String(d.error);
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
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, section, isLoading, onConfirm, onCancel }: {
  open: boolean; section: SchoolSection | null; isLoading: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !section) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Section</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete <span className="font-semibold text-slate-700">"{section.name}"</span>?
          This cannot be undone.
        </p>
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
function SectionModal({ editing, isSaving, nextOrder, onSave, onClose }: {
  editing: SchoolSection | null; isSaving: boolean; nextOrder: number;
  onSave: (data: SchoolSectionFormValues) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<SchoolSectionFormValues>(
    editing
      ? { name: editing.name, code: editing.code, description: editing.description ?? '', is_active: editing.is_active, order: editing.order }
      : { name: '', code: '', description: '', is_active: true, order: nextOrder }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof SchoolSectionFormValues>(k: K, v: SchoolSectionFormValues[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  // Auto-generate code from name
  const handleNameChange = (name: string) => {
    set('name', name);
    if (!editing) {
      set('code', name.trim().slice(0, 4).toUpperCase().replace(/\s+/g, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.code.trim()) { setFormError('Code is required.'); return; }
    if (form.code.length > 10) { setFormError('Code must be 10 characters or fewer.'); return; }
    try { await onSave({ ...form, code: form.code.toUpperCase() }); }
    catch (err: any) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {editing ? 'Edit Section' : 'New School Section'}
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

        <form id="section-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input type="text" value={form.name} onChange={e => handleNameChange(e.target.value)}
              className={inputCls} placeholder="e.g. Primary, Secondary, Nursery" required />
          </div>

          {/* Code + Order */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Code <span className="text-red-400">*</span>
              </label>
              <input type="text" value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                className={inputCls + " uppercase font-mono tracking-widest"} placeholder="e.g. PRI" maxLength={10} required />
              <p className="text-xs text-slate-400 mt-1">Auto-uppercased</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Order</label>
              <input type="number" value={form.order} min={1}
                onChange={e => set('order', parseInt(e.target.value) || 1)}
                className={inputCls} />
              <p className="text-xs text-slate-400 mt-1">Display order</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)}
              className={inputCls + " resize-none"} rows={2} placeholder="Optional description..." />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Active</p>
                <p className="text-xs text-slate-500">Section is visible and in use</p>
              </div>
            </div>
            <button type="button" onClick={() => set('is_active', !form.is_active)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="section-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200">
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
export default function SchoolSectionsPage() {
  const { hasPermission, user } = useAuth();

  const [sections, setSections] = useState<SchoolSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SchoolSection | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean; section: SchoolSection | null; isLoading: boolean;
  }>({ open: false, section: null, isLoading: false });

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canAdd    = user?.is_superuser || hasPermission('school_configuration.add_schoolsectionmodel');
  const canChange = user?.is_superuser || hasPermission('school_configuration.change_schoolsectionmodel');
  const canDelete = user?.is_superuser || hasPermission('school_configuration.delete_schoolsectionmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => { fetchSections(); }, []);

  const fetchSections = async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await academicCalendarAPI.listSchoolSections();
      setSections(Array.isArray(data) ? data.sort((a, b) => a.order - b.order) : []);
    } catch (err: any) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setShowModal(true); };
  const openEdit = (s: SchoolSection) => { setEditing(s); setShowModal(true); };

  const handleSave = async (form: SchoolSectionFormValues) => {
    setIsSaving(true);
    try {
      if (editing) {
        const updated = await academicCalendarAPI.updateSchoolSection(editing.id, form);
        setSections(prev => prev.map(s => s.id === updated.id ? updated : s).sort((a, b) => a.order - b.order));
        showToast('success', 'Section updated');
      } else {
        const created = await academicCalendarAPI.createSchoolSection(form);
        setSections(prev => [...prev, created].sort((a, b) => a.order - b.order));
        showToast('success', 'Section created');
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmState.section) return;
    setConfirmState(s => ({ ...s, isLoading: true }));
    try {
      await academicCalendarAPI.deleteSchoolSection(confirmState.section.id);
      setSections(prev => prev.filter(s => s.id !== confirmState.section!.id));
      showToast('success', 'Section deleted');
      setConfirmState({ open: false, section: null, isLoading: false });
    } catch (err: any) {
      showToast('error', extractError(err));
      setConfirmState(s => ({ ...s, isLoading: false, open: false }));
    }
  };

  const nextOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) + 1 : 1;
  const activeSections = sections.filter(s => s.is_active);
  const inactiveSections = sections.filter(s => !s.is_active);

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={confirmState.open} section={confirmState.section} isLoading={confirmState.isLoading}
        onConfirm={handleDelete} onCancel={() => setConfirmState({ open: false, section: null, isLoading: false })}
      />
      {showModal && (
        <SectionModal editing={editing} isSaving={isSaving} nextOrder={nextOrder}
          onSave={handleSave} onClose={() => setShowModal(false)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            School Sections
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">
            Define divisions like Primary, Secondary, Nursery
          </p>
        </div>
        {canAdd && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
            <Plus className="h-4 w-4" /> Add Section
          </button>
        )}
      </div>

      {/* Stats */}
      {sections.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Total</p>
            <p className="text-2xl font-bold text-slate-900">{sections.length}</p>
            <p className="text-xs text-slate-400">sections</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Active</p>
            <p className="text-2xl font-bold text-emerald-700">{activeSections.length}</p>
            <p className="text-xs text-emerald-500">in use</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Inactive</p>
            <p className="text-2xl font-bold text-slate-500">{inactiveSections.length}</p>
            <p className="text-xs text-slate-400">disabled</p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400">Loading sections...</p>
        </div>
      ) : pageError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-700 mb-3">{pageError}</p>
          <button onClick={fetchSections} className="text-sm text-red-600 underline">Retry</button>
        </div>
      ) : sections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-emerald-200" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">No sections yet</h3>
          <p className="text-sm text-slate-400 mb-5">Add your first school section to get started.</p>
          {canAdd && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
              <Plus className="h-4 w-4" /> Add Section
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide col-span-2">Actions</span>
          </div>

          <div className="divide-y divide-slate-50">
            {sections.map((section, idx) => (
              <div key={section.id}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors ${!section.is_active ? 'opacity-60' : ''}`}>

                {/* Order */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    disabled={idx === 0}
                    onClick={() => {
                      const prev = sections[idx - 1];
                      const updated = sections.map(s => {
                        if (s.id === section.id) return { ...s, order: prev.order };
                        if (s.id === prev.id) return { ...s, order: section.order };
                        return s;
                      }).sort((a, b) => a.order - b.order);
                      setSections(updated);
                      academicCalendarAPI.updateSchoolSection(section.id, { order: prev.order });
                      academicCalendarAPI.updateSchoolSection(prev.id, { order: section.order });
                    }}
                    className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <span className="text-xs font-bold text-slate-400 w-4 text-center">{section.order}</span>
                  <button
                    disabled={idx === sections.length - 1}
                    onClick={() => {
                      const next = sections[idx + 1];
                      const updated = sections.map(s => {
                        if (s.id === section.id) return { ...s, order: next.order };
                        if (s.id === next.id) return { ...s, order: section.order };
                        return s;
                      }).sort((a, b) => a.order - b.order);
                      setSections(updated);
                      academicCalendarAPI.updateSchoolSection(section.id, { order: next.order });
                      academicCalendarAPI.updateSchoolSection(next.id, { order: section.order });
                    }}
                    className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Name + description */}
                <div>
                  <p className="font-bold text-slate-900">{section.name}</p>
                  {section.description && (
                    <p className="text-xs text-slate-400 truncate max-w-xs">{section.description}</p>
                  )}
                </div>

                {/* Code */}
                <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-600 tracking-widest">
                  {section.code}
                </span>

                {/* Status */}
                {section.is_active ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                  </span>
                )}

                {/* Actions */}
                {canChange && (
                  <button onClick={() => openEdit(section)} title="Edit"
                    className="p-2 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition-all">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => setConfirmState({ open: true, section, isLoading: false })} title="Delete"
                    className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}