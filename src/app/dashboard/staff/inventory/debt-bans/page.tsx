// app/dashboard/staff/inventory/debt-bans/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { bannedDebtUserAPI, studentsAPI, staffAPI } from '@/lib/api';
import { BannedDebtUser } from '@/lib/types';
import {
  ShieldOff, Plus, Edit3, Search,
  X, Check, AlertCircle, Loader2,
  RefreshCw, UserCog, GraduationCap, ShieldCheck, Ban,
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

function staffDisplayName(s: any): string {
  return s?.full_name || `${s?.first_name || ''} ${s?.last_name || ''}`.trim() || `Staff #${s?.id}`;
}

function studentDisplayName(s: any): string {
  return s?.full_name || `${s?.first_name || ''} ${s?.last_name || ''}`.trim() || `Student #${s?.id}`;
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

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ value, activeLabel = 'Banned', inactiveLabel = 'Lifted' }: { value: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      value ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-red-500' : 'bg-emerald-500'}`} />
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

// ─── Form Values ───────────────────────────────────────────────────────────────
type PersonType = 'student' | 'staff';
interface BanFormValues {
  person_type: PersonType;
  person_id: number | null;
  reason: string;
  is_active: boolean;
}

// ─── Ban Modal ─────────────────────────────────────────────────────────────────
function BanModal({ editing, isSaving, onSave, onClose }: {
  editing: BannedDebtUser | null;
  isSaving: boolean;
  onSave: (data: BanFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const initialType: PersonType = editing ? (editing.student ? 'student' : 'staff') : 'student';
  const [form, setForm] = useState<BanFormValues>(
    editing
      ? {
          person_type: initialType,
          person_id: editing.student ?? editing.staff ?? null,
          reason: editing.reason,
          is_active: editing.is_active,
        }
      : { person_type: 'student', person_id: null, reason: '', is_active: true }
  );
  const [personSearch, setPersonSearch] = useState(editing ? (editing.student_name || editing.staff_name || '') : '');
  const [personResults, setPersonResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Set right before setPersonSearch() on a selection, so the resulting personSearch
  // change doesn't immediately re-trigger a search (which would just re-show the
  // same name as a suggestion right after picking it).
  const skipSearchRef = useRef(false);

  const set = <K extends keyof BanFormValues>(key: K, value: BanFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Search students or staff depending on the selected person_type — only when creating new.
  useEffect(() => {
    if (editing) return;
    if (skipSearchRef.current) { skipSearchRef.current = false; return; }
    if (personSearch.trim().length < 2) { setPersonResults([]); return; }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = form.person_type === 'student'
          ? await studentsAPI.list({ search: personSearch, status: 'active' } as any)
          : await staffAPI.list({ search: personSearch, status: 'active' } as any);
        setPersonResults(Array.isArray(data) ? data.slice(0, 8) : []);
        setShowResults(true);
      } catch {
        setPersonResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [personSearch, form.person_type, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!editing && !form.person_id) { setFormError(`Please select a ${form.person_type}.`); return; }
    if (!form.reason.trim()) { setFormError('Please provide a reason.'); return; }
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldOff className="h-4 w-4" />
            {editing ? 'Edit Ban Record' : 'Ban From Debt Purchases'}
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
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form id="ban-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">

          {!editing && (
            <div>
              <label className={labelCls}>Person Type <span className="text-red-400 normal-case">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => { set('person_type', 'student'); set('person_id', null); setPersonSearch(''); setPersonResults([]); }}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    form.person_type === 'student' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>
                  <GraduationCap className="h-4 w-4" /> Student
                </button>
                <button type="button"
                  onClick={() => { set('person_type', 'staff'); set('person_id', null); setPersonSearch(''); setPersonResults([]); }}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    form.person_type === 'staff' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>
                  <UserCog className="h-4 w-4" /> Staff
                </button>
              </div>
            </div>
          )}

          {/* Person search/select */}
          <div className="relative">
            <label className={labelCls}>
              {form.person_type === 'student' ? 'Student' : 'Staff Member'} <span className="text-red-400 normal-case">*</span>
            </label>
            <input
              type="text"
              disabled={!!editing}
              value={personSearch}
              onChange={e => { setPersonSearch(e.target.value); set('person_id', null); }}
              onFocus={() => personResults.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              placeholder={`Search ${form.person_type === 'student' ? 'student' : 'staff'} by name...`}
              className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
            />
            {isSearching && <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-blue-500" />}
            {!editing && showResults && (
              <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                {personResults.length > 0 ? personResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => {
                      skipSearchRef.current = true;
                      set('person_id', p.id);
                      setPersonSearch(form.person_type === 'student' ? studentDisplayName(p) : staffDisplayName(p));
                      setPersonResults([]);
                      setShowResults(false);
                    }}
                    className="w-full flex items-center gap-2 p-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                  >
                    {form.person_type === 'student' ? <GraduationCap className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /> : <UserCog className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 truncate">
                        {form.person_type === 'student' ? studentDisplayName(p) : staffDisplayName(p)}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {form.person_type === 'student'
                          ? `${p.registration_number || '—'} • ${p.current_class_name || ''} ${p.current_class_section_name || ''}`.trim()
                          : `${p.staff_id || '—'} • ${p.department_name || '—'}`}
                      </p>
                    </div>
                  </button>
                )) : <div className="p-3 text-center text-xs text-slate-400">No results found.</div>}
              </div>
            )}
            {editing && <p className="text-xs text-slate-400 mt-1">The banned person cannot be changed — create a new record instead.</p>}
          </div>

          {/* Reason */}
          <div>
            <label className={labelCls}>Reason <span className="text-red-400 normal-case">*</span></label>
            <textarea required rows={3} value={form.reason} onChange={e => set('reason', e.target.value)}
              placeholder="e.g. Repeated unpaid debt, abused wallet credit privileges..."
              className={`${inputCls} resize-none`} />
          </div>

          {/* Active toggle — only meaningful when editing an existing ban */}
          {editing && (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-800">Ban Active</p>
                <p className="text-xs text-slate-400">Turn off to lift the ban while keeping the record</p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active}
                onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-red-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="ban-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Saving...' : 'Banning...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Save Changes' : 'Ban User'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DebtBansPage() {
  const { hasPermission, user } = useAuth();

  const [bans, setBans] = useState<BannedDebtUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingBan, setEditingBan] = useState<BannedDebtUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'lifted'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'student' | 'staff'>('all');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canManage = user?.is_superuser || hasPermission('inventory.add_inventorysettingmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter === 'active' ? 'active' : 'inactive' } : undefined;
      const data = await bannedDebtUserAPI.list(params);
      setBans(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingBan(null); setShowModal(true); };
  const openEdit = (ban: BannedDebtUser) => { setEditingBan(ban); setShowModal(true); };

  const handleSave = async (form: BanFormValues) => {
    setIsSaving(true);
    try {
      if (editingBan) {
        const updated = await bannedDebtUserAPI.update(editingBan.id, { reason: form.reason, is_active: form.is_active });
        setBans(prev => prev.map(b => b.id === updated.id ? updated : b));
        showToast('success', `Ban record for "${updated.student_name || updated.staff_name}" updated`);
      } else {
        const payload = form.person_type === 'student'
          ? { student: form.person_id!, reason: form.reason }
          : { staff: form.person_id!, reason: form.reason };
        const created = await bannedDebtUserAPI.create(payload);
        setBans(prev => [created, ...prev]);
        showToast('success', `"${created.student_name || created.staff_name}" barred from debt purchases`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const filtered = bans.filter(b => {
    const name = b.student_name || b.staff_name || '';
    const matchSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'all' || (typeFilter === 'student' ? !!b.student : !!b.staff);
    return matchSearch && matchType;
  });

  const totalActive = bans.filter(b => b.is_active).length;
  const totalStudents = bans.filter(b => !!b.student).length;
  const totalStaff = bans.filter(b => !!b.staff).length;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showModal && (
        <BanModal
          editing={editingBan}
          isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <ShieldOff className="h-5 w-5 text-white" />
            </div>
            Banned Debt Users
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Block specific students or staff from wallet-debt purchases</p>
        </div>
        {canManage && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Ban User
          </button>
        )}
      </div>

      {/* ── Info banner ── */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <ShieldCheck className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          A banned user is blocked from buying on debt even if debt is enabled and they haven't exceeded the max
          debt limit. Lift a ban by editing the record instead of deleting it, to keep the audit trail.
        </p>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: bans.length, icon: ShieldOff, color: 'from-blue-500 to-blue-600' },
          { label: 'Currently Banned', value: totalActive, icon: Ban, color: 'from-red-500 to-rose-600' },
          { label: 'Students', value: totalStudents, icon: GraduationCap, color: 'from-violet-500 to-purple-600' },
          { label: 'Staff', value: totalStaff, icon: UserCog, color: 'from-amber-500 to-orange-600' },
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
            <input type="text" placeholder="Search by name..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white">
              <option value="all">All Types</option>
              <option value="student">Students</option>
              <option value="staff">Staff</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white">
              <option value="all">All Statuses</option>
              <option value="active">Currently Banned</option>
              <option value="lifted">Lifted</option>
            </select>
            <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading ban records...</p>
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
              <ShieldOff className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' ? 'No records match your filters' : 'No ban records yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' ? 'Try different keywords or filters.' : 'Ban a student or staff member to block them from debt purchases.'}
            </p>
            {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && canManage && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Ban User
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_1.5fr_auto_auto] items-center gap-x-6 gap-y-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Person</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(ban => {
                const isStudent = !!ban.student;
                const name = ban.student_name || ban.staff_name || '—';
                return (
                  <div key={ban.id} className="grid grid-cols-[1fr_auto_1.5fr_auto_auto] items-center gap-x-6 gap-y-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                    {/* Person */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isStudent ? 'bg-violet-100' : 'bg-amber-100'}`}>
                        {isStudent ? <GraduationCap className="h-4 w-4 text-violet-600" /> : <UserCog className="h-4 w-4 text-amber-600" />}
                      </div>
                      <p className="font-semibold text-slate-900 truncate">{name}</p>
                    </div>

                    {/* Type */}
                    <span className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${isStudent ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isStudent ? 'Student' : 'Staff'}
                    </span>

                    {/* Reason */}
                    <p className="text-sm text-slate-500 truncate pl-2" title={ban.reason}>{ban.reason}</p>

                    {/* Status */}
                    <StatusBadge value={ban.is_active} />

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {canManage && (
                        <button onClick={() => openEdit(ban)} title="Edit reason / toggle ban"
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {bans.length} record{bans.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}