'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { expenseCategoriesAPI } from '@/lib/api';
import type { ExpenseCategory, ExpenseCategoryFormValues } from '@/lib/finance.types';
import {
  Tag, Plus, Edit3, Trash2, Search,
  X, Check, AlertCircle, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, RefreshCw, FolderOpen, ArrowDownRight,
  ChevronLeft, ChevronRight
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

const PAGE_SIZE = 20;

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
function ConfirmModal({ open, category, isDeleting, onConfirm, onCancel }: {
  open: boolean; category: ExpenseCategory | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !category) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Expense Category</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{category.name}"</span>?
          This cannot be undone and will affect all linked institutional expenditure records.
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

// ─── Category Form Modal ─────────────────────────────────────────────────────
function CategoryModal({ editing, isSaving, onSave, onClose }: {
  editing: ExpenseCategory | null;
  isSaving: boolean;
  onSave: (data: ExpenseCategoryFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ExpenseCategoryFormValues>(
    editing
      ? { name: editing.name || '', description: editing.description ?? '', is_active: editing.is_active ?? true }
      : { name: '', description: '', is_active: true }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof ExpenseCategoryFormValues>(key: K, value: ExpenseCategoryFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      setFormError(err instanceof Error ? err.message : 'An error occurred while saving.');
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ArrowDownRight className="h-5 w-5" />
            {editing ? 'Edit Expense Category' : 'New Expense Category'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form id="category-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelCls}>Category Name <span className="text-red-500 normal-case">*</span></label>
              <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Staff Payroll, Maintenance, Diesel / Fuel" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} placeholder="Brief description of what falls under this expenditure class..."
                className={inputCls + ' resize-none'} />
            </div>
            <div className="flex items-center">
              <div className="flex items-center justify-between w-full p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">Active</p>
                  <p className="text-xs text-slate-400">Category is available when recording expenditures</p>
                </div>
                <button type="button" role="switch" aria-checked={form.is_active}
                  onClick={() => set('is_active', !form.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-red-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="category-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold rounded-xl hover:from-red-700 hover:to-rose-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-red-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Category' : 'Create Category'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function ExpenseCategoriesPage() {
  const { hasPermission, user } = useAuth();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Pagination & Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<ExpenseCategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingCat, setDeletingCat] = useState<ExpenseCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // THE FIX: Using underlying finance permissions so Accountant roles map correctly
  const canCreate = user?.is_superuser || hasPermission('finance.add_expensemodel');
  const canEdit   = user?.is_superuser || hasPermission('finance.add_expensemodel');
  const canDelete = user?.is_superuser || hasPermission('finance.add_expensemodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Fetch using true Server-Side Pagination
  const fetchCategories = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const params: any = { page, page_size: PAGE_SIZE };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (showActiveOnly) params.is_active = true;

      const response: any = await expenseCategoriesAPI.list(params);

      const listData = Array.isArray(response) ? response : (response?.results || response?.data || []);
      const count = typeof response?.count === 'number' ? response.count : listData.length;

      setCategories(Array.isArray(listData) ? listData.filter(Boolean) : []);
      setTotal(count);
    } catch (err: any) {
      setPageError(err instanceof Error ? err.message : 'Failed to fetch categories.');
    } finally { setLoading(false); }
  }, [page, searchTerm, showActiveOnly]);

  useEffect(() => {
    // Slight debounce so typing doesn't spam the server
    const handler = setTimeout(() => {
      fetchCategories();
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchCategories]);

  // Reset page to 1 when filters change
  useEffect(() => { setPage(1); }, [searchTerm, showActiveOnly]);

  const openCreate = () => { setEditingCat(null); setShowModal(true); };
  const openEdit = (cat: ExpenseCategory) => { setEditingCat(cat); setShowModal(true); };

  const handleSave = async (form: ExpenseCategoryFormValues) => {
    setIsSaving(true);
    try {
      if (editingCat) {
        await expenseCategoriesAPI.update(editingCat.id, form);
        showToast('success', `"${form.name}" updated successfully`);
      } else {
        await expenseCategoriesAPI.create(form);
        showToast('success', `"${form.name}" created successfully`);
      }
      setShowModal(false);
      fetchCategories(); // Refetch to maintain correct pagination limits
    } catch (err: any) {
      showToast('error', err instanceof Error ? err.message : 'Error saving category.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;
    setIsDeleting(true);
    try {
      await expenseCategoriesAPI.delete(deletingCat.id);
      showToast('success', `"${deletingCat.name}" deleted`);
      setDeletingCat(null);
      fetchCategories(); // Refetch
    } catch (err: any) {
      showToast('error', err instanceof Error ? err.message : 'Could not delete category.');
      setDeletingCat(null);
    } finally { setIsDeleting(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCountOnPage = categories.filter(c => c.is_active).length;

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingCat} category={deletingCat} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingCat(null)}
      />

      {showModal && (
        <CategoryModal editing={editingCat} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl flex items-center justify-center shadow-md shadow-red-200">
              <ArrowDownRight className="h-5 w-5 text-white" />
            </div>
            Expense Categories
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage expenditure classifications for your institution</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-semibold rounded-xl hover:from-red-700 hover:to-rose-700 transition-all shadow-md shadow-red-200">
            <Plus className="h-4 w-4" /> Add Category
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Categories', value: total, icon: Tag, color: 'from-red-500 to-rose-600' },
          { label: 'Active (Pg)', value: activeCountOnPage, icon: Check, color: 'from-emerald-500 to-teal-600' },
          { label: 'Inactive (Pg)', value: categories.length - activeCountOnPage, icon: FolderOpen, color: 'from-slate-400 to-slate-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading && page === 1 ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Search + filter bar */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by name or description..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-slate-50 focus:bg-white transition-colors" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={showActiveOnly}
                onClick={() => setShowActiveOnly(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-red-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-slate-600">Active only</span>
            </label>
            <button onClick={fetchCategories} className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors border border-slate-200" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-red-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* States */}
        {loading && page === 1 ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading categories...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchCategories} className="text-sm font-bold text-red-600 underline inline-flex items-center gap-1 hover:text-red-800">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ArrowDownRight className="h-7 w-7 text-red-300" />
            </div>
            <h3 className="font-bold text-slate-700 mb-1">
              {searchTerm ? 'No categories match your search' : 'No expense categories yet'}
            </h3>
            <p className="text-sm font-medium text-slate-400 mb-5">
              {searchTerm ? 'Try different keywords.' : 'Add your first expense category to start tracking expenditure.'}
            </p>
            {!searchTerm && canCreate && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-semibold rounded-xl hover:from-red-700 hover:to-rose-700 transition-all shadow-md shadow-red-200">
                <Plus className="h-4 w-4" /> Add Category
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Category</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {categories.map(cat => (
                <div key={cat.id}>
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                    {/* Name + description */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.is_active ? 'bg-red-100' : 'bg-slate-100'}`}>
                        <ArrowDownRight className={`h-4 w-4 ${cat.is_active ? 'text-red-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{cat.name}</p>
                        {cat.description && <p className="text-xs font-medium text-slate-400 truncate">{cat.description}</p>}
                      </div>
                    </div>

                    {/* Status */}
                    {cat.is_active ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold rounded-full whitespace-nowrap uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-bold rounded-full whitespace-nowrap uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <button onClick={() => openEdit(cat)} title="Edit"
                          className="p-1.5 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors">
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingCat(cat)} title="Delete"
                          className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)} title="Toggle details"
                        className="p-1.5 rounded-lg text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
                        {expandedId === cat.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded row */}
                  {expandedId === cat.id && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        {cat.description && (
                          <div className="sm:col-span-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</span>
                            <p className="mt-1 font-medium text-slate-700">{cat.description}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category ID</span>
                          <p className="mt-1 font-mono font-bold text-slate-700">#{cat.id}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created</span>
                          <p className="mt-1 font-medium text-slate-700">{cat.created_at ? new Date(cat.created_at).toLocaleDateString('en-GB') : '—'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">
                  Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of <span className="font-bold text-slate-700">{total}</span> entries
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <ChevronLeft className="h-4 w-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}