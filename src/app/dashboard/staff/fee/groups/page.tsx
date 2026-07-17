'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { feeAPI } from '@/lib/api';
import { FeeGroup } from '@/lib/types';
import {
  FolderOpen, Plus, Edit3, Trash2, Check, X,
  AlertCircle, AlertTriangle, Loader2, Search,
  RefreshCw, HelpCircle,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="h-4 w-4" /> Fee Groups — Helper
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong>Fee Groups</strong> are logical containers that bundle related fee structures together.
            They make it easier to organise and apply fees to specific sets of students.
          </p>
          <div className="space-y-3">
            {[
              {
                title: 'Name',
                color: 'bg-blue-100 text-blue-700',
                desc: 'A clear label for the group, e.g. "New Student Package", "JSS Fees", "SS Boarding Fees". Should reflect the category of students or fees it covers.',
              },
              {
                title: 'Description',
                color: 'bg-slate-100 text-slate-600',
                desc: 'Optional. Add extra context about what this group covers or which students it applies to. Shown on the group card for quick reference.',
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
          <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Tip:</strong> After creating a group, go to <strong>Fee Structures</strong> to assign individual fee types and their amounts to this group. The group itself only holds a name and description.
            </p>
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

function ConfirmModal({ open, group, isDeleting, onConfirm, onCancel }: {
  open: boolean; group: FeeGroup | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !group) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Fee Group</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{group.name}"</span>?
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

// ─── Fee Group Form Modal ──────────────────────────────────────────────────────

interface FeeGroupFormData { name: string; description: string; }
const EMPTY: FeeGroupFormData = { name: '', description: '' };

function FeeGroupModal({ editing, isSaving, onSave, onClose }: {
  editing: FeeGroup | null; isSaving: boolean;
  onSave: (data: FeeGroupFormData) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<FeeGroupFormData>(
    editing ? { name: editing.name, description: editing.description || '' } : EMPTY
  );
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            {editing ? 'Edit Fee Group' : 'New Fee Group'}
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
        <form id="fee-group-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">
            <div>
              <label className={labelCls}>Name <span className="text-red-400 normal-case">*</span></label>
              <input required type="text" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. New Student Package, JSS Fees"
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Description <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
              <textarea value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4} placeholder="Describe what this group covers or which students it applies to..."
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
          <button type="submit" form="fee-group-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Group' : 'Create Group'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function FeeGroupsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [groups, setGroups]           = useState<FeeGroup[]>([]);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [showHelper, setShowHelper]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [editingGroup, setEditingGroup] = useState<FeeGroup | null>(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<FeeGroup | null>(null);
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
    try { setGroups(await feeAPI.getFeeGroups()); }
    catch (err) { setPageError(extractError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingGroup(null); setShowModal(true); };
  const openEdit   = (g: FeeGroup) => { setEditingGroup(g); setShowModal(true); };

  const handleSave = async (data: FeeGroupFormData) => {
    setIsSaving(true);
    try {
      if (editingGroup) {
        const updated = await feeAPI.updateFeeGroup(editingGroup.id, data);
        setGroups(prev => prev.map(g => g.id === editingGroup.id ? updated : g));
        showToast('success', `"${updated.name}" updated successfully`);
      } else {
        const created = await feeAPI.createFeeGroup(data);
        setGroups(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    setIsDeleting(true);
    try {
      await feeAPI.deleteFeeGroup(deletingGroup.id);
      setGroups(prev => prev.filter(g => g.id !== deletingGroup.id));
      showToast('success', `"${deletingGroup.name}" deleted`);
      setDeletingGroup(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingGroup(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = groups.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showHelper && <HelperModal onClose={() => setShowHelper(false)} />}

      <ConfirmModal
        open={!!deletingGroup} group={deletingGroup} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingGroup(null)}
      />

      {showModal && (
        <FeeGroupModal
          editing={editingGroup} isSaving={isSaving}
          onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <FolderOpen className="h-5 w-5 text-white" />
            </div>
            Fee Groups
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Logical containers for organising fee structures</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelper(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            <HelpCircle className="h-4 w-4 text-sky-500" /> Helper
          </button>
          {canManage && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> Add Group
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Groups',      value: groups.length,                                    color: 'from-blue-500 to-blue-600'   },
          { label: 'With Description',  value: groups.filter(g => g.description).length,         color: 'from-violet-500 to-purple-600' },
          { label: 'Added This Month',  value: groups.filter(g => {
              const d = new Date(g.created_at);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length,                                                                             color: 'from-blue-500 to-indigo-600'   },
          { label: 'Total Structures',  value: groups.reduce((s, g) => s + (g.structure_count ?? 0), 0), color: 'from-emerald-500 to-teal-600'  },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <FolderOpen className="h-4 w-4 text-white" />
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
            <input type="text" placeholder="Search fee groups..." value={search}
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
            <p className="mt-2 text-sm text-slate-400">Loading fee groups...</p>
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
              <FolderOpen className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {search ? 'No groups match your search' : 'No fee groups yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {search ? 'Try a different name.' : 'Create your first fee group to start organising fee structures.'}
            </p>
            {!search && canManage && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Group
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_200px_100px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(g => (
                <div key={g.id}
                  className="grid grid-cols-[1fr_200px_100px] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">

                  {/* Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{g.name}</p>
                      <p className="text-xs text-slate-400">{new Date(g.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <span className="text-xs text-slate-500 truncate">
                    {g.description || <span className="text-slate-300">—</span>}
                  </span>

                  {/* Actions — always visible */}
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(g)} title="Edit"
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeletingGroup(g)} title="Delete"
                          className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
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
                Showing {filtered.length} of {groups.length} group{groups.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}