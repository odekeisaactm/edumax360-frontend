'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { positionsAPI, departmentsAPI } from '@/lib/api';
import { Position, Department, PositionFormValues } from '@/lib/types';
import {
  GraduationCap, Plus, Edit3, Trash2, Users, Search,
  Building, X, Check, AlertCircle, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, RefreshCw,
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

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, position, isDeleting, onConfirm, onCancel }: {
  open: boolean; position: Position | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !position) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Position</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{position.name}"</span>?
          This cannot be undone and will affect all linked staff.
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

// ─── Position Form Modal ───────────────────────────────────────────────────────
function PositionModal({ editing, departments, isSaving, onSave, onClose }: {
  editing: Position | null;
  departments: Department[];
  isSaving: boolean;
  onSave: (data: PositionFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PositionFormValues>(
    editing
      ? {
          name: editing.name,
          code: editing.code,
          department: typeof editing.department === 'object' ? editing.department.id : editing.department,
          description: editing.description ?? '',
          is_active: editing.is_active,
        }
      : { name: '', code: '', department: 0, description: '', is_active: true }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof PositionFormValues>(key: K, value: PositionFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.department) { setFormError('Please select a department.'); return; }
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {editing ? 'Edit Position' : 'New Position'}
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
        <form id="position-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Position Name <span className="text-red-400 normal-case">*</span></label>
              <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Mathematics Teacher" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Position Code <span className="text-red-400 normal-case">*</span></label>
              <input required type="text" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. MATH_TCHR" className={inputCls} />
              <p className="text-xs text-slate-400 mt-1">Auto-uppercased</p>
            </div>
            <div>
              <label className={labelCls}>Department <span className="text-red-400 normal-case">*</span></label>
              <select required value={form.department} onChange={e => set('department', Number(e.target.value))} className={inputCls}>
                <option value={0}>Select department...</option>
                {departments.filter(d => d.is_active).map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} placeholder="Brief description of this position..."
                className={inputCls + ' resize-none'} />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">Active</p>
                  <p className="text-xs text-slate-400">Position is currently available</p>
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
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="position-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Position' : 'Create Position'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PositionsPage() {
  const { hasPermission, user } = useAuth();

  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingPos, setDeletingPos] = useState<Position | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterDept, setFilterDept] = useState<number>(0);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('human_resource.add_positionmodel');
  const canEdit   = user?.is_superuser || hasPermission('human_resource.change_positionmodel');
  const canDelete = user?.is_superuser || hasPermission('human_resource.delete_positionmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [posData, deptData] = await Promise.all([positionsAPI.list(), departmentsAPI.list()]);
      setPositions(Array.isArray(posData) ? posData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getDeptName = (pos: Position) => {
    if (pos.department_name) return pos.department_name;
    if (typeof pos.department === 'object' && pos.department) return (pos.department as Department).name;
    const dept = departments.find(d => d.id === (pos.department as number));
    return dept?.name ?? '—';
  };

  const openCreate = () => { setEditingPos(null); setShowModal(true); };
  const openEdit = (pos: Position) => { setEditingPos(pos); setShowModal(true); };

  const handleSave = async (form: PositionFormValues) => {
    setIsSaving(true);
    try {
      if (editingPos) {
        const updated = await positionsAPI.update(editingPos.id, form);
        setPositions(prev => prev.map(p => p.id === updated.id ? updated : p));
        showToast('success', `"${updated.name}" updated successfully`);
      } else {
        const created = await positionsAPI.create(form);
        setPositions(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingPos) return;
    setIsDeleting(true);
    try {
      await positionsAPI.delete(deletingPos.id);
      setPositions(prev => prev.filter(p => p.id !== deletingPos.id));
      showToast('success', `"${deletingPos.name}" deleted`);
      setDeletingPos(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingPos(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = positions.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getDeptName(p).toLowerCase().includes(searchTerm.toLowerCase());
    const matchActive = !showActiveOnly || p.is_active;
    const matchDept = !filterDept || (
      typeof p.department === 'object'
        ? (p.department as Department).id === filterDept
        : p.department === filterDept
    );
    return matchSearch && matchActive && matchDept;
  });

  const totalActive = positions.filter(p => p.is_active).length;
  const totalStaff  = positions.reduce((sum, p) => sum + (p.staff_count ?? 0), 0);

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingPos} position={deletingPos} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingPos(null)}
      />

      {showModal && (
        <PositionModal editing={editingPos} departments={departments} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            Positions
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage job positions within departments</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Position
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Positions', value: positions.length, icon: GraduationCap, color: 'from-blue-500 to-blue-600' },
          { label: 'Active', value: totalActive, icon: Check, color: 'from-emerald-500 to-teal-600' },
          { label: 'Departments', value: departments.length, icon: Building, color: 'from-violet-500 to-purple-600' },
          { label: 'Total Staff', value: totalStaff, icon: Users, color: 'from-orange-400 to-amber-500' },
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

        {/* Search + filter bar */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by name, code or department..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Department filter */}
            <select value={filterDept} onChange={e => setFilterDept(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-slate-600">
              <option value={0}>All departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {/* Active toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={showActiveOnly}
                onClick={() => setShowActiveOnly(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-slate-600">Active only</span>
            </label>
            <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading positions...</p>
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
              <GraduationCap className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || filterDept ? 'No positions match your filters' : 'No positions yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || filterDept ? 'Try different keywords or filters.' : 'Add your first position to get started.'}
            </p>
            {!searchTerm && !filterDept && canCreate && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Position
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Position</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Staff</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(pos => (
                <div key={pos.id}>
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                    {/* Name + code */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${pos.is_active ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                        <GraduationCap className={`h-4 w-4 ${pos.is_active ? 'text-indigo-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{pos.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{pos.code}</p>
                      </div>
                    </div>

                    {/* Department */}
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap">
                      <Building className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate max-w-[140px]">{getDeptName(pos)}</span>
                    </div>

                    {/* Staff count */}
                    <div className="flex items-center justify-center gap-1 text-sm text-slate-600">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">{pos.staff_count ?? 0}</span>
                    </div>

                    {/* Status */}
                    {pos.is_active ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button onClick={() => openEdit(pos)} title="Edit"
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingPos(pos)} title="Delete"
                          className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === pos.id ? null : pos.id)} title="Toggle details"
                        className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                        {expandedId === pos.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded row */}
                  {expandedId === pos.id && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        {pos.description && (
                          <div className="sm:col-span-3">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</span>
                            <p className="mt-1 text-slate-600">{pos.description}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Position ID</span>
                          <p className="mt-1 text-slate-700 font-medium">#{pos.id}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</span>
                          <p className="mt-1 text-slate-700">{new Date(pos.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Updated</span>
                          <p className="mt-1 text-slate-700">{new Date(pos.updated_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {positions.length} position{positions.length !== 1 ? 's' : ''}
                {showActiveOnly ? ' (active only)' : ''}
                {filterDept ? ` · filtered by department` : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}