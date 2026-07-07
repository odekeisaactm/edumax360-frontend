'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { resultBehaviorAPI, academicCalendarAPI } from '@/lib/api';
import { ResultBehaviorCategory, ResultBehaviorField } from '@/lib/types';
import {
  Star, Plus, Edit3, Trash2, Search, X, Check, AlertCircle,
  AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Layers, Shield, Building2, GripVertical, Hash, Eye,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SchoolSection {
  id: number;
  name: string;
  code: string;
}

interface CategoryFormData {
  name: string;
  school_section: number | null;
  order: number;
  recommended_fields_count: number;
}

interface FieldFormData {
  _id: string;
  name: string;
  order: number;
}

let _uid = 0;
const uid = () => String(++_uid);
let _toastId = 0;

interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.error) return String(d.error);
    if (d.message) return String(d.message);
    if (d.non_field_errors?.length) return d.non_field_errors[0];
    if (d.details) {
      const msgs = Object.entries(d.details)
        .map(([, v]) => Array.isArray(v) ? v[0] : String(v))
        .join(' ');
      if (msgs) return msgs;
    }
    // Catch any other field-level errors
    if (typeof d === 'object') {
      const msgs = Object.entries(d)
        .map(([f, v]: [string, any]) => {
          const val = Array.isArray(v) ? v[0] : String(v);
          return f === 'non_field_errors' ? val : `${f.replace(/_/g, ' ')}: ${val}`;
        })
        .join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
          : t.type === 'warn' ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
          : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ open, category, isDeleting, onConfirm, onCancel }: {
  open: boolean; category: ResultBehaviorCategory | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !category) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Category</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Delete <span className="font-semibold text-slate-700">"{category.name}"</span>? All behavior fields within it will also be deleted. This cannot be undone.
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

// ─── Category Modal ───────────────────────────────────────────────────────────
function CategoryModal({ editing, schoolSections, isSaving, onSave, onClose }: {
  editing: ResultBehaviorCategory | null;
  schoolSections: SchoolSection[];
  isSaving: boolean;
  onSave: (data: CategoryFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CategoryFormData>({
    name: editing?.name || '',
    school_section: editing?.school_section ?? null,
    order: editing?.order ?? 1,
    recommended_fields_count: editing?.recommended_fields_count ?? 5,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Category name is required.');
      return;
    }
    try {
      await onSave(form);
    } catch (err) {
      setFormError(extractError(err));
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Star className="h-4 w-4" />
            {editing ? 'Edit Category' : 'New Category'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form id="category-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Category Name <span className="text-red-400 normal-case">*</span></label>
            <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Psychomotor Skills, Affective Domain" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>School Section</label>
            <select value={form.school_section ?? ''} onChange={e => setForm({ ...form, school_section: e.target.value ? Number(e.target.value) : null })}
              className={inputCls}>
              <option value="">All Sections (Global)</option>
              {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Display Order</label>
              <input type="number" min="1" value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Recommended Fields</label>
              <input type="number" min="1" max="20" value={form.recommended_fields_count}
                onChange={e => setForm({ ...form, recommended_fields_count: Number(e.target.value) })}
                className={inputCls} />
              <p className="text-xs text-slate-400 mt-1">Suggestion from template (not enforced)</p>
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="category-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Category' : 'Create Category'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Behavior Field Row Editor (Inline) ────────────────────────────────────────
function BehaviorFieldRow({ field, index, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: {
  field: FieldFormData;
  index: number;
  onUpdate: (field: FieldFormData) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const inputCls = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";

  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={onMoveUp} disabled={isFirst}
          className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30 transition-colors">
          <ChevronUp className="h-3 w-3" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={isLast}
          className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30 transition-colors">
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <input type="text" value={field.name} onChange={e => onUpdate({ ...field, name: e.target.value })}
        placeholder="Field name" className={inputCls + " flex-1"} />
      <input type="number" min="1" value={field.order} onChange={e => onUpdate({ ...field, order: Number(e.target.value) })}
        className="w-16 text-center px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      <button type="button" onClick={onRemove}
        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BehaviorPage() {
  const { hasPermission, user } = useAuth();

  const [categories, setCategories] = useState<ResultBehaviorCategory[]>([]);
  const [schoolSections, setSchoolSections] = useState<SchoolSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ResultBehaviorCategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingCategory, setDeletingCategory] = useState<ResultBehaviorCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState<number | ''>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Field management for expanded category
  const [categoryFields, setCategoryFields] = useState<Record<number, FieldFormData[]>>({});
  const [savingFields, setSavingFields] = useState<Record<number, boolean>>({});

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('result.manage_result_configuration');
  const canEdit = user?.is_superuser || hasPermission('result.manage_result_configuration');
  const canDelete = user?.is_superuser || hasPermission('result.manage_result_configuration');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchCategories = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const params: { school_section?: number } = {};
      if (filterSection) params.school_section = Number(filterSection);
      const [categoriesData, sectionsData] = await Promise.all([
        resultBehaviorAPI.listCategories(params),
        academicCalendarAPI.listSchoolSections(),
      ]);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setSchoolSections(Array.isArray(sectionsData) ? sectionsData : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [filterSection]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Fetch fields when expanding a category
  const fetchFieldsForCategory = useCallback(async (categoryId: number) => {
      try {
        const fieldsData = await resultBehaviorAPI.listFields({ category: categoryId });
        const fields = Array.isArray(fieldsData) ? fieldsData : [];
        setCategoryFields(prev => ({
          ...prev,
          [categoryId]: fields.map(f => ({
            _id: String(f.id),  // ← Use the actual database ID as string
            name: f.name,
            order: f.order
          })),
        }));
      } catch (err) {
        showToast('error', extractError(err));
      }
    }, [showToast]);

  const handleExpand = (categoryId: number) => {
    if (expandedId === categoryId) {
      setExpandedId(null);
    } else {
      setExpandedId(categoryId);
      if (!categoryFields[categoryId]) {
        fetchFieldsForCategory(categoryId);
      }
    }
  };

  const handleSaveCategory = async (data: CategoryFormData) => {
    setIsSaving(true);
    try {
      if (editingCategory) {
        const updated = await resultBehaviorAPI.updateCategory(editingCategory.id, data);
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...updated, fields_list: c.fields_list } : c));
        showToast('success', `"${data.name}" updated successfully`);
      } else {
        const created = await resultBehaviorAPI.createCategory(data);
        setCategories(prev => [created, ...prev]);
        showToast('success', `"${data.name}" created successfully`);
      }
      setShowModal(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    try {
      await resultBehaviorAPI.deleteCategory(deletingCategory.id);
      setCategories(prev => prev.filter(c => c.id !== deletingCategory.id));
      showToast('success', `"${deletingCategory.name}" deleted`);
      setDeletingCategory(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingCategory(null);
    } finally { setIsDeleting(false); }
  };

  const handleSaveFields = async (categoryId: number) => {
      const fields = categoryFields[categoryId];
      if (!fields) return;

      setSavingFields(prev => ({ ...prev, [categoryId]: true }));
      try {
        // Fetch existing fields to delete removed ones
        const existingFields = await resultBehaviorAPI.listFields({ category: categoryId });
        const existingIds = new Set(existingFields.map(f => f.id));

        // Find which IDs are still present (not temp)
        const currentIds = new Set(
          fields
            .filter(f => !f._id.toString().startsWith('temp_'))
            .map(f => parseInt(f._id.toString()))
        );

        // Delete removed fields
        for (const existing of existingFields) {
          if (!currentIds.has(existing.id)) {
            await resultBehaviorAPI.deleteField(existing.id);
          }
        }

        // Create or update fields
        for (const field of fields) {
          if (field._id.toString().startsWith('temp_')) {
            // New field - create
            await resultBehaviorAPI.createField({
              category: categoryId,
              name: field.name,
              order: field.order,
            });
          } else {
            // Existing field - update
            await resultBehaviorAPI.updateField(parseInt(field._id.toString()), {
              name: field.name,
              order: field.order,
            });
          }
        }

        showToast('success', 'Behavior fields saved successfully');
        fetchFieldsForCategory(categoryId); // Refresh to get actual IDs
      } catch (err) {
        showToast('error', extractError(err));
      } finally {
        setSavingFields(prev => ({ ...prev, [categoryId]: false }));
      }
    };

  const addFieldToCategory = (categoryId: number) => {
      const currentFields = categoryFields[categoryId] || [];
      const newOrder = currentFields.length + 1;
      const newField: FieldFormData = {
        _id: `temp_${Date.now()}_${Math.random()}`,  // ← More unique temp ID
        name: '',
        order: newOrder,
      };
      setCategoryFields(prev => ({
        ...prev,
        [categoryId]: [...currentFields, newField],
      }));
    };

  const updateFieldInCategory = (categoryId: number, fieldIndex: number, updatedField: FieldFormData) => {
    const currentFields = [...(categoryFields[categoryId] || [])];
    currentFields[fieldIndex] = updatedField;
    setCategoryFields(prev => ({ ...prev, [categoryId]: currentFields }));
  };

  const removeFieldFromCategory = (categoryId: number, fieldIndex: number) => {
    const currentFields = [...(categoryFields[categoryId] || [])];
    currentFields.splice(fieldIndex, 1);
    // Reorder remaining fields
    currentFields.forEach((field, idx) => { field.order = idx + 1; });
    setCategoryFields(prev => ({ ...prev, [categoryId]: currentFields }));
  };

  const moveField = (categoryId: number, fieldIndex: number, direction: 'up' | 'down') => {
    const fields = [...(categoryFields[categoryId] || [])];
    if (direction === 'up' && fieldIndex === 0) return;
    if (direction === 'down' && fieldIndex === fields.length - 1) return;

    const swapIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
    [fields[fieldIndex], fields[swapIndex]] = [fields[swapIndex], fields[fieldIndex]];

    // Update orders
    fields.forEach((field, idx) => { field.order = idx + 1; });
    setCategoryFields(prev => ({ ...prev, [categoryId]: fields }));
  };

  const getSectionName = (sectionId: number | null | undefined) => {
    if (!sectionId) return 'All Sections';
    return schoolSections.find(s => s.id === sectionId)?.name || 'Unknown';
  };

  const filtered = categories.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSection = !filterSection || c.school_section === filterSection;
    return matchSearch && matchSection;
  });

  const totalActive = categories.length;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal open={!!deletingCategory} category={deletingCategory} isDeleting={isDeleting}
        onConfirm={handleDeleteCategory} onCancel={() => setDeletingCategory(null)} />

      {showModal && (
        <CategoryModal
          editing={editingCategory}
          schoolSections={schoolSections}
          isSaving={isSaving}
          onSave={handleSaveCategory}
          onClose={() => { setShowModal(false); setEditingCategory(null); }}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Star className="h-5 w-5 text-white" />
            </div>
            Behavior Categories
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage behavior categories and their rating fields</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditingCategory(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> New Category
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Categories', value: categories.length, icon: Layers, color: 'from-blue-500 to-blue-600' },
          { label: 'School Sections', value: schoolSections.length, icon: Building2, color: 'from-violet-500 to-purple-600' },
          { label: 'Active', value: totalActive, icon: Shield, color: 'from-emerald-500 to-teal-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800 truncate">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search categories..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value ? Number(e.target.value) : '')}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="">All Sections</option>
            {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={fetchCategories} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading categories...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchCategories} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Star className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || filterSection ? 'No categories match your search' : 'No behavior categories yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || filterSection ? 'Try different keywords or filters.' : 'Create your first behavior category to get started.'}
            </p>
            {!searchTerm && !filterSection && canCreate && (
              <button onClick={() => { setEditingCategory(null); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> New Category
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_160px_100px_100px_120px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fields</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recommended</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(category => {
                const fields = categoryFields[category.id] || [];
                const isExpanded = expandedId === category.id;
                const isSavingFieldsForCategory = savingFields[category.id] || false;

                return (
                  <div key={category.id}>
                    <div className="flex flex-col sm:grid sm:grid-cols-[1fr_160px_100px_100px_120px] items-start sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                      <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100">
                          <Star className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{category.name}</p>
                          <p className="text-xs text-slate-400">Order: {category.order}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:block min-w-0">
                        <span className="sm:hidden text-xs text-slate-400">Section:</span>
                        <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[150px] block">
                          {getSectionName(category.school_section)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 sm:block">
                        <span className="sm:hidden text-xs text-slate-400">Fields:</span>
                        <span className="text-sm font-medium text-slate-600">
                          {category.fields_list?.length || 0} field{(category.fields_list?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                          {category.recommended_fields_count}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button onClick={() => { setEditingCategory(category); setShowModal(true); }} title="Edit"
                            className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeletingCategory(category)} title="Delete"
                            className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleExpand(category.id)} title="Expand fields"
                          className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="ml-0 sm:ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Behavior Fields</p>
                            <div className="flex gap-2">
                              {fields.length > 0 && (
                                <button onClick={() => handleSaveFields(category.id)} disabled={isSavingFieldsForCategory}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all disabled:opacity-50">
                                  {isSavingFieldsForCategory ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Save Fields
                                </button>
                              )}
                              <button onClick={() => addFieldToCategory(category.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                                <Plus className="h-3 w-3" /> Add Field
                              </button>
                            </div>
                          </div>

                          {fields.length === 0 ? (
                            <p className="text-sm text-slate-400 italic text-center py-4">No behavior fields yet. Click "Add Field" to create one.</p>
                          ) : (
                            <div className="space-y-2">
                              {fields.map((field, idx) => (
                                <BehaviorFieldRow
                                  key={field._id}
                                  field={field}
                                  index={idx}
                                  onUpdate={(updated) => updateFieldInCategory(category.id, idx, updated)}
                                  onRemove={() => removeFieldFromCategory(category.id, idx)}
                                  onMoveUp={() => moveField(category.id, idx, 'up')}
                                  onMoveDown={() => moveField(category.id, idx, 'down')}
                                  isFirst={idx === 0}
                                  isLast={idx === fields.length - 1}
                                />
                              ))}
                            </div>
                          )}

                          {category.recommended_fields_count > 0 && fields.length < category.recommended_fields_count && (
                            <p className="text-xs text-amber-600 mt-3 pt-2 border-t border-slate-100">
                              💡 Template recommends {category.recommended_fields_count} fields for optimal display. Current: {fields.length}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}