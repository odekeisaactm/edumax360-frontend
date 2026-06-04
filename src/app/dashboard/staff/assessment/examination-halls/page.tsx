'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { examinationHallsAPI, academicCalendarAPI } from '@/lib/api';
import { ExaminationHall, ExaminationHallFormValues, SchoolSection } from '@/lib/types';
import {
  Building2, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  MapPin, Users, ChevronDown, ChevronUp, Globe,
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
    if (typeof d === 'object') {
      const msgs = Object.entries(d)
        .map(([f, v]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
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
function ConfirmModal({ open, hall, isDeleting, onConfirm, onCancel }: {
  open: boolean; hall: ExaminationHall | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !hall) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Examination Hall</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{hall.name}"</span>?
          This cannot be undone and may affect scheduled exams.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
              : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hall Form Modal ───────────────────────────────────────────────────────────
function HallModal({ editing, schoolSections, isSaving, onSave, onClose }: {
  editing: ExaminationHall | null;
  schoolSections: SchoolSection[];
  isSaving: boolean;
  onSave: (data: ExaminationHallFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ExaminationHallFormValues>(
    editing
      ? {
          name: editing.name,
          code: editing.code,
          capacity: editing.capacity,
          location: editing.location || '',
          school_section: typeof editing.school_section === 'number' ? editing.school_section : null,
          is_active: editing.is_active,
        }
      : { name: '', code: '', capacity: 0, location: '', school_section: null, is_active: true }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof ExaminationHallFormValues>(key: K, value: ExaminationHallFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.capacity || form.capacity < 1) { setFormError('Capacity must be at least 1.'); return; }
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {editing ? 'Edit Examination Hall' : 'New Examination Hall'}
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
            <span className="whitespace-pre-line flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form id="hall-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* Name + Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Hall Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Main Examination Hall" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Hall Code <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.code}
                  onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="e.g. HALL-A" className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Auto-uppercased, must be unique</p>
              </div>
            </div>

            {/* Capacity + Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Capacity <span className="text-red-400 normal-case">*</span></label>
                <input required type="number" min={1}
                  value={form.capacity || ''}
                  onChange={e => set('capacity', parseInt(e.target.value) || 0)}
                  placeholder="e.g. 100" className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Maximum students per exam</p>
              </div>
              <div>
                <label className={labelCls}>School Section</label>
                <select
                  value={form.school_section ?? ''}
                  onChange={e => set('school_section', e.target.value ? parseInt(e.target.value) : null)}
                  className={inputCls}>
                  <option value="">All Sections (Global)</option>
                  {schoolSections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Leave blank for all sections</p>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className={labelCls}>Location</label>
              <input type="text" value={form.location}
                onChange={e => set('location', e.target.value)}
                placeholder="e.g. Ground Floor, Block A" className={inputCls} />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-800">Active</p>
                <p className="text-xs text-slate-400 mt-0.5">Hall is available for exam scheduling</p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active}
                onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-4 ${form.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="hall-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Hall' : 'Create Hall'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ExaminationHallsPage() {
  const { hasPermission, user } = useAuth();

  const [halls, setHalls] = useState<ExaminationHall[]>([]);
  const [schoolSections, setSchoolSections] = useState<SchoolSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingHall, setEditingHall] = useState<ExaminationHall | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingHall, setDeletingHall] = useState<ExaminationHall | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [filterSection, setFilterSection] = useState<number>(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView   = user?.is_superuser || hasPermission('assessment_center.view_examinationhallmodel');
  const canCreate = user?.is_superuser || hasPermission('assessment_center.add_examinationhallmodel');
  const canEdit   = user?.is_superuser || hasPermission('assessment_center.change_examinationhallmodel');
  const canDelete = user?.is_superuser || hasPermission('assessment_center.delete_examinationhallmodel');

  const showToast = (type: ToastItem['type'], message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [hallsData, sectionsData] = await Promise.all([
        examinationHallsAPI.list(),
        academicCalendarAPI.listSchoolSections(),
      ]);
      setHalls(Array.isArray(hallsData) ? hallsData : []);
      setSchoolSections(Array.isArray(sectionsData) ? sectionsData : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (canView) fetchData(); }, [fetchData, canView]);

  const getSectionName = (hall: ExaminationHall): string => {
    if (!hall.school_section) return 'All Sections';
    if (typeof hall.school_section === 'object') return (hall.school_section as SchoolSection).name;
    const section = schoolSections.find(s => s.id === hall.school_section);
    return section?.name ?? 'Unknown';
  };

  const isGlobal = (hall: ExaminationHall) => !hall.school_section;

  const openCreate = () => { setEditingHall(null); setShowModal(true); };
  const openEdit = (hall: ExaminationHall) => { setEditingHall(hall); setShowModal(true); };

  const handleSave = async (form: ExaminationHallFormValues) => {
    setIsSaving(true);
    try {
      if (editingHall) {
        const updated = await examinationHallsAPI.update(editingHall.id, form);
        setHalls(prev => prev.map(h => h.id === updated.id ? updated : h));
        showToast('success', `"${updated.name}" updated successfully`);
      } else {
        const created = await examinationHallsAPI.create(form);
        setHalls(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingHall) return;
    setIsDeleting(true);
    try {
      await examinationHallsAPI.delete(deletingHall.id);
      setHalls(prev => prev.filter(h => h.id !== deletingHall.id));
      showToast('success', `"${deletingHall.name}" deleted`);
      setDeletingHall(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingHall(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = halls.filter(h => {
    const matchSearch =
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.location || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchActive = !showActiveOnly || h.is_active;
    const matchSection = !filterSection || (
      typeof h.school_section === 'object'
        ? (h.school_section as unknown as SchoolSection)?.id === filterSection
        : h.school_section === filterSection
    );
    return matchSearch && matchActive && matchSection;
  });

  const totalActive   = halls.filter(h => h.is_active).length;
  const totalCapacity = halls.reduce((sum, h) => sum + h.capacity, 0);
  const totalGlobal   = halls.filter(h => !h.school_section).length;

  if (!canView) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-500">You don't have permission to view examination halls.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingHall} hall={deletingHall} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingHall(null)}
      />

      {showModal && (
        <HallModal
          editing={editingHall} schoolSections={schoolSections}
          isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            Examination Halls
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage examination venues and seating capacities</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Hall
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Halls', value: halls.length, icon: Building2, color: 'from-blue-500 to-cyan-600' },
          { label: 'Active', value: totalActive, icon: Check, color: 'from-emerald-500 to-teal-600' },
          { label: 'Total Capacity', value: totalCapacity.toLocaleString(), icon: Users, color: 'from-violet-500 to-purple-600' },
          { label: 'Global Halls', value: totalGlobal, icon: Globe, color: 'from-orange-400 to-amber-500' },
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
            <input type="text" placeholder="Search by name, code or location..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {schoolSections.length > 0 && (
              <select value={filterSection} onChange={e => setFilterSection(Number(e.target.value))}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-slate-600">
                <option value={0}>All sections</option>
                {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
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
            <p className="mt-2 text-sm text-slate-400">Loading examination halls...</p>
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
              <Building2 className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || filterSection ? 'No halls match your filters' : 'No examination halls yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || filterSection ? 'Try different keywords or filters.' : 'Add your first examination hall to get started.'}
            </p>
            {!searchTerm && !filterSection && canCreate && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Hall
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hall</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Capacity</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(hall => (
                <div key={hall.id}>
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                    {/* Name + code */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${hall.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <Building2 className={`h-4 w-4 ${hall.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{hall.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{hall.code}</p>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap">
                      {hall.location
                        ? <><MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /><span className="truncate max-w-[120px]">{hall.location}</span></>
                        : <span className="text-slate-400 text-xs italic">Not set</span>}
                    </div>

                    {/* Capacity */}
                    <div className="flex items-center justify-center gap-1 text-sm text-slate-700 whitespace-nowrap">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-semibold">{hall.capacity.toLocaleString()}</span>
                    </div>

                    {/* Section */}
                    {isGlobal(hall) ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg whitespace-nowrap">
                        <Globe className="h-3 w-3" /> Global
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600 whitespace-nowrap truncate max-w-[100px]">
                        {getSectionName(hall)}
                      </span>
                    )}

                    {/* Status */}
                    {hall.is_active ? (
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
                        <button onClick={() => openEdit(hall)} title="Edit"
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingHall(hall)} title="Delete"
                          className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === hall.id ? null : hall.id)} title="Toggle details"
                        className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                        {expandedId === hall.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded row */}
                  {expandedId === hall.id && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hall ID</span>
                          <p className="mt-1 text-slate-700 font-medium">#{hall.id}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Capacity</span>
                          <p className="mt-1 text-slate-700 font-medium">{hall.capacity.toLocaleString()} seats</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</span>
                          <p className="mt-1 text-slate-700 font-medium">{getSectionName(hall)}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                          <p className={`mt-1 font-medium ${hall.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {hall.is_active ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                        {hall.location && (
                          <div className="col-span-2 sm:col-span-4">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> Location
                            </span>
                            <p className="mt-1 text-slate-600">{hall.location}</p>
                          </div>
                        )}
                        {hall.created_at && (
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</span>
                            <p className="mt-1 text-slate-700">{new Date(hall.created_at).toLocaleDateString()}</p>
                          </div>
                        )}
                        {hall.updated_at && (
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Updated</span>
                            <p className="mt-1 text-slate-700">{new Date(hall.updated_at).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {halls.length} hall{halls.length !== 1 ? 's' : ''}
                {showActiveOnly ? ' (active only)' : ''}
                {filterSection ? ' · filtered by section' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}