'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { studentCustomFieldsAPI } from '@/lib/api';
import { CustomField } from '@/lib/types';
import {
  FileText, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, ChevronDown, ChevronUp,
  Loader2, RefreshCw, GripVertical, Hash, Type,
  Calendar, List, AlignLeft, ToggleLeft, Users, UserCheck,
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
  }
  return err?.message || 'An unexpected error occurred.';
}

const FIELD_TYPE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  text:     { label: 'Text',     icon: Type,       color: 'text-blue-600',    bg: 'bg-blue-100' },
  number:   { label: 'Number',   icon: Hash,       color: 'text-violet-600',  bg: 'bg-violet-100' },
  date:     { label: 'Date',     icon: Calendar,   color: 'text-orange-600',  bg: 'bg-orange-100' },
  select:   { label: 'Select',   icon: List,       color: 'text-teal-600',    bg: 'bg-teal-100' },
  textarea: { label: 'Textarea', icon: AlignLeft,  color: 'text-indigo-600',  bg: 'bg-indigo-100' },
  checkbox: { label: 'Checkbox', icon: ToggleLeft, color: 'text-emerald-600', bg: 'bg-emerald-100' },
};

function FieldTypeBadge({ type }: { type: string }) {
  const meta = FIELD_TYPE_META[type] ?? { label: type, icon: Type, color: 'text-slate-600', bg: 'bg-slate-100' };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${meta.bg} ${meta.color}`}>
      <Icon className="h-3 w-3" />{meta.label}
    </span>
  );
}

function FieldForBadge({ fieldFor }: { fieldFor: 'student' | 'parent' }) {
  return fieldFor === 'student'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700"><Users className="h-3 w-3" />Student</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700"><UserCheck className="h-3 w-3" />Parent</span>;
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

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, field, isDeleting, onConfirm, onCancel }: {
  open: boolean; field: CustomField | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !field) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Custom Field</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{field.field_name}"</span>?
          Any data stored in this field will be lost.
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

// ─── Field Form Modal ──────────────────────────────────────────────────────────
function FieldModal({ editing, fieldsCount, isSaving, onSave, onClose }: {
  editing: CustomField | null;
  fieldsCount: number;
  isSaving: boolean;
  onSave: (data: Partial<CustomField>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    field_for: editing?.field_for ?? 'student' as 'student' | 'parent',
    field_name: editing?.field_name ?? '',
    field_type: editing?.field_type ?? 'text' as CustomField['field_type'],
    is_required: editing?.is_required ?? false,
    choices: editing?.choices ?? [] as string[],
    ordering: editing?.ordering ?? fieldsCount,
    description: editing?.description ?? '',
    is_active: editing?.is_active ?? true,
  });
  const [choicesText, setChoicesText] = useState((editing?.choices ?? []).join('\n'));
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.field_type === 'select' && (!form.choices || form.choices.length === 0)) {
      setFormError('Select fields require at least one choice.'); return;
    }
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
            <FileText className="h-4 w-4" />
            {editing ? 'Edit Custom Field' : 'New Custom Field'}
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
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Form */}
        <form id="field-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* Field For */}
            <div>
              <label className={labelCls}>Field For <span className="text-red-400 normal-case">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {(['student', 'parent'] as const).map(opt => (
                  <button key={opt} type="button"
                    onClick={() => set('field_for', opt)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      form.field_for === opt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}>
                    {opt === 'student' ? <Users className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Field Name */}
            <div>
              <label className={labelCls}>Field Name <span className="text-red-400 normal-case">*</span></label>
              <input required type="text" value={form.field_name} onChange={e => set('field_name', e.target.value)}
                placeholder="e.g. Previous School" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Field Type */}
              <div>
                <label className={labelCls}>Field Type <span className="text-red-400 normal-case">*</span></label>
                <select required value={form.field_type}
                  onChange={e => { set('field_type', e.target.value as any); if (e.target.value !== 'select') set('choices', []); }}
                  className={inputCls}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Select / Dropdown</option>
                  <option value="textarea">Textarea</option>
                  <option value="checkbox">Checkbox</option>
                </select>
              </div>
              {/* Ordering */}
              <div>
                <label className={labelCls}>Display Order</label>
                <input type="number" value={form.ordering} onChange={e => set('ordering', Number(e.target.value))}
                  min={0} className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Lower = shown first</p>
              </div>
            </div>

            {/* Choices — only for select */}
            {form.field_type === 'select' && (
              <div>
                <label className={labelCls}>Choices <span className="text-red-400 normal-case">*</span></label>
                <textarea
                  value={choicesText}
                  onChange={e => {
                    setChoicesText(e.target.value);
                    set('choices', e.target.value.split('\n').map(s => s.trim()).filter(Boolean));
                  }}
                  rows={4} placeholder={'Option 1\nOption 2\nOption 3'}
                  className={inputCls + ' resize-none'} />
                <p className="text-xs text-slate-400 mt-1">One choice per line</p>
              </div>
            )}

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={2} placeholder="Brief description of this field..."
                className={inputCls + ' resize-none'} />
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">Required</p>
                  <p className="text-xs text-slate-400">Must be filled</p>
                </div>
                <button type="button" role="switch" aria-checked={form.is_required}
                  onClick={() => set('is_required', !form.is_required)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_required ? 'bg-blue-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_required ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">Active</p>
                  <p className="text-xs text-slate-400">Show in forms</p>
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
          <button type="submit" form="field-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Field' : 'Create Field'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentCustomFieldsPage() {
  const { hasPermission, user } = useAuth();

  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingField, setDeletingField] = useState<CustomField | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterFieldFor, setFilterFieldFor] = useState<'all' | 'student' | 'parent'>('all');
  const [filterType, setFilterType] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [draggedItem, setDraggedItem] = useState<CustomField | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('student_management.add_customfieldmodel');
  const canEdit   = user?.is_superuser || hasPermission('student_management.change_customfieldmodel');
  const canDelete = user?.is_superuser || hasPermission('student_management.delete_customfieldmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchFields = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await studentCustomFieldsAPI.list();
      setFields(Array.isArray(data) ? data : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  const openCreate = () => { setEditingField(null); setShowModal(true); };
  const openEdit = (f: CustomField) => { setEditingField(f); setShowModal(true); };

  const handleSave = async (form: Partial<CustomField>) => {
    setIsSaving(true);
    try {
      if (editingField) {
        const updated = await studentCustomFieldsAPI.update(editingField.id, form);
        setFields(prev => prev.map(f => f.id === updated.id ? updated : f));
        showToast('success', `"${updated.field_name}" updated successfully`);
      } else {
        const created = await studentCustomFieldsAPI.create(form);
        setFields(prev => [...prev, created]);
        showToast('success', `"${created.field_name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingField) return;
    setIsDeleting(true);
    try {
      await studentCustomFieldsAPI.delete(deletingField.id);
      setFields(prev => prev.filter(f => f.id !== deletingField.id));
      showToast('success', `"${deletingField.field_name}" deleted`);
      setDeletingField(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingField(null);
    } finally { setIsDeleting(false); }
  };

  const handleToggleActive = async (f: CustomField) => {
    try {
      const updated = await studentCustomFieldsAPI.update(f.id, { ...f, is_active: !f.is_active });
      setFields(prev => prev.map(x => x.id === updated.id ? updated : x));
      showToast('success', `"${updated.field_name}" ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  // ── Drag to reorder ──
  const handleDragStart = (e: React.DragEvent, f: CustomField) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem(f);
  };

  const handleDragOver = (e: React.DragEvent, target: CustomField) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === target.id) return;
    const from = fields.findIndex(f => f.id === draggedItem.id);
    const to   = fields.findIndex(f => f.id === target.id);
    if (from === to) return;
    const reordered = [...fields];
    reordered.splice(from, 1);
    reordered.splice(to, 0, draggedItem);
    setFields(reordered.map((f, i) => ({ ...f, ordering: i })));
  };

  const handleDragEnd = async () => {
    if (!draggedItem) return;
    setDraggedItem(null);
    try {
      for (let i = 0; i < fields.length; i++) {
        if (fields[i].ordering !== i) {
          await studentCustomFieldsAPI.update(fields[i].id, { ...fields[i], ordering: i });
        }
      }
      showToast('success', 'Fields reordered');
    } catch {
      showToast('error', 'Failed to save new order');
      fetchFields();
    }
  };

  const sorted = [...fields].sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0));

  const filtered = sorted.filter(f => {
    const matchSearch   = (f.field_name ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchFor      = filterFieldFor === 'all' || f.field_for === filterFieldFor;
    const matchType     = !filterType || f.field_type === filterType;
    const matchActive   = !showActiveOnly || f.is_active;
    return matchSearch && matchFor && matchType && matchActive;
  });

  const totalActive        = fields.filter(f => f.is_active).length;
  const totalRequired      = fields.filter(f => f.is_required).length;
  const totalStudentFields = fields.filter(f => f.field_for === 'student').length;
  const totalParentFields  = fields.filter(f => f.field_for === 'parent').length;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingField} field={deletingField} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingField(null)}
      />

      {showModal && (
        <FieldModal
          editing={editingField} fieldsCount={fields.length}
          isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <FileText className="h-5 w-5 text-white" />
            </div>
            Custom Fields
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Define extra fields for student and parent records</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Custom Field
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Fields',    value: fields.length,        icon: FileText,   color: 'from-blue-500 to-blue-600' },
          { label: 'Student Fields',  value: totalStudentFields,   icon: Users,      color: 'from-violet-500 to-purple-600' },
          { label: 'Parent Fields',   value: totalParentFields,    icon: UserCheck,  color: 'from-teal-500 to-cyan-600' },
          { label: 'Required',        value: totalRequired,        icon: AlertCircle,color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
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
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search fields..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <select value={filterFieldFor} onChange={e => setFilterFieldFor(e.target.value as any)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600">
              <option value="all">All (Student & Parent)</option>
              <option value="student">Student only</option>
              <option value="parent">Parent only</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600">
              <option value="">All types</option>
              {Object.entries(FIELD_TYPE_META).map(([val, meta]) => (
                <option key={val} value={val}>{meta.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={showActiveOnly}
                onClick={() => setShowActiveOnly(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-slate-600">Active only</span>
            </label>
            <button onClick={fetchFields} title="Refresh"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading custom fields...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchFields} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || filterType || filterFieldFor !== 'all' ? 'No fields match your filters' : 'No custom fields yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || filterType || filterFieldFor !== 'all'
                ? 'Try different keywords or filters.'
                : 'Add your first custom field to extend student and parent records.'}
            </p>
            {!searchTerm && !filterType && filterFieldFor === 'all' && canCreate && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Custom Field
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Drag hint */}
            <div className="px-5 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2">
              <GripVertical className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs text-slate-400">Drag rows to reorder how fields appear in forms</p>
            </div>

            {/* Table header */}
            <div className="grid items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: 'auto 1fr auto auto auto auto 132px' }}>
              <span className="w-4" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Field</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">For</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Required</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(f => (
                <div key={f.id}
                  className={`transition-opacity ${draggedItem?.id === f.id ? 'opacity-40' : 'opacity-100'}`}
                  draggable onDragStart={e => handleDragStart(e, f)}
                  onDragOver={e => handleDragOver(e, f)} onDragEnd={handleDragEnd}>

                  <div className="grid items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-grab active:cursor-grabbing"
                    style={{ gridTemplateColumns: 'auto 1fr auto auto auto auto 132px' }}>

                    <GripVertical className="h-4 w-4 text-slate-300" />

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{f.field_name}</p>
                      {f.description && <p className="text-xs text-slate-400 truncate">{f.description}</p>}
                    </div>

                    <FieldForBadge fieldFor={f.field_for} />
                    <FieldTypeBadge type={f.field_type} />

                    {f.is_required
                      ? <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg whitespace-nowrap">Required</span>
                      : <span className="text-xs text-slate-400">Optional</span>}

                    {f.is_active
                      ? <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      : <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                        </span>}

                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <>
                          <button onClick={() => openEdit(f)} title="Edit"
                            className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleToggleActive(f)}
                            title={f.is_active ? 'Deactivate' : 'Activate'}
                            className={`p-2 rounded-lg border transition-all ${f.is_active
                              ? 'text-slate-500 bg-slate-100 border-slate-200 hover:bg-slate-200'
                              : 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100'}`}>
                            <ToggleLeft className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingField(f)} title="Delete"
                          className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === f.id ? null : f.id)} title="Details"
                        className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                        {expandedId === f.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded */}
                  {expandedId === f.id && (
                    <div className="px-5 pb-4">
                      <div className="ml-8 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Field ID</span>
                          <p className="mt-1 text-slate-700 font-medium">#{f.id}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Display Order</span>
                          <p className="mt-1 text-slate-700">{f.ordering ?? 0}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Updated</span>
                          <p className="mt-1 text-slate-700">{f.updated_at ? new Date(f.updated_at).toLocaleDateString() : '—'}</p>
                        </div>
                        {f.field_type === 'select' && f.choices && f.choices.length > 0 && (
                          <div className="sm:col-span-3">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Choices</span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {f.choices.map((c, i) => (
                                <span key={i} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {fields.length} field{fields.length !== 1 ? 's' : ''}
                {filterFieldFor !== 'all' ? ` · ${filterFieldFor} fields` : ''}
                {filterType ? ` · ${FIELD_TYPE_META[filterType]?.label ?? filterType} type` : ''}
                {showActiveOnly ? ' · active only' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}