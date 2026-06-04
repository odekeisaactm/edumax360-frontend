// app/dashboard/staff/academic/leadership-roles/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, academicCalendarAPI, staffAPI } from '@/lib/api';
import { LeadershipRole, SchoolSection } from '@/lib/types';
import {
  Crown, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, ChevronDown, ChevronUp,
  Building, Loader2, RefreshCw, Calendar, User,
  ShieldCheck, BadgeCheck, UserCircle,
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
function ConfirmDeleteModal({ open, role, isDeleting, onConfirm, onCancel }: {
  open: boolean; role: LeadershipRole | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !role) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Remove Leadership Role</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Remove <span className="font-semibold text-slate-700">{role.staff_name}</span> as{' '}
          <span className="font-semibold text-slate-700">{role.role_type_display}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting
              ? <><Loader2 className="h-4 w-4 animate-spin" />Removing...</>
              : <><Trash2 className="h-4 w-4" />Remove</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Role Config ───────────────────────────────────────────────────────────────
type RoleType = 'head_teacher' | 'deputy_head' | 'section_head' | 'academic_director' | 'principal' | 'vice_principal';

const ROLE_CONFIG: Record<RoleType, { label: string; color: string; bg: string; border: string }> = {
  principal:         { label: 'Principal',         color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-100'  },
  vice_principal:    { label: 'Vice Principal',    color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-100'  },
  academic_director: { label: 'Academic Director', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100'    },
  head_teacher:      { label: 'Head Teacher',      color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-100'    },
  deputy_head:       { label: 'Deputy Head',       color: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-100'    },
  section_head:      { label: 'Section Head',      color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
};

// Roles where school section field is shown
const SECTION_ROLES: RoleType[] = ['section_head', 'head_teacher', 'deputy_head'];

function RoleBadge({ roleType }: { roleType: string }) {
  const cfg = ROLE_CONFIG[roleType as RoleType] ?? {
    label: roleType, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Crown className="h-3 w-3" />{cfg.label}
    </span>
  );
}

// ─── Staff Search Input ────────────────────────────────────────────────────────
function StaffSearchInput({ staffOptions, value, onChange }: {
  staffOptions: StaffOption[];
  value: number | '';
  onChange: (id: number | '') => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = staffOptions.find(s => s.id === value) ?? null;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = staffOptions.filter(s =>
    !query || s.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 50);

  const handleSelect = (s: StaffOption) => {
    onChange(s.id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger / selected display */}
      {selected && !open ? (
        <div
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 transition-colors bg-white"
        >
          <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <UserCircle className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <span className="flex-1 font-medium text-slate-800 truncate">{selected.name}</span>
          <button type="button" onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            autoFocus={open}
            placeholder="Search staff by name..."
            value={query}
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-blue-400 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {!selected && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Type to filter..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-xs text-slate-400 text-center">No staff found</li>
            ) : filtered.map(s => (
              <li key={s.id}>
                <button type="button" onClick={() => handleSelect(s)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-blue-50 transition-colors text-left ${
                    s.id === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                  }`}>
                  <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <UserCircle className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <span className="truncate">{s.name}</span>
                  {s.id === value && <Check className="h-3.5 w-3.5 ml-auto flex-shrink-0 text-blue-600" />}
                </button>
              </li>
            ))}
          </ul>
          {filtered.length === 50 && (
            <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100 bg-slate-50">
              Showing first 50 results — type to narrow down
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface StaffOption { id: number; name: string; }

interface FormValues {
  role_type: RoleType;
  staff: number | '';
  school_section: number | '';
  start_date: string;
  end_date: string;
  is_current: boolean;
  notes: string;
}

const defaultForm: FormValues = {
  role_type: 'principal',
  staff: '',
  school_section: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  is_current: true,
  notes: '',
};

// ─── Leadership Role Modal ─────────────────────────────────────────────────────
function LeadershipRoleModal({ editing, schoolSections, staffOptions, isSaving, onSave, onClose }: {
  editing: LeadershipRole | null;
  schoolSections: SchoolSection[];
  staffOptions: StaffOption[];
  isSaving: boolean;
  onSave: (data: FormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormValues>(() => {
    if (!editing) return { ...defaultForm };
    return {
      role_type: editing.role_type as RoleType,
      staff: editing.staff as number,
      school_section: (editing.school_section as number) ?? '',
      start_date: editing.start_date,
      end_date: editing.end_date || '',
      is_current: editing.is_current,
      notes: editing.notes || '',
    };
  });
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(key: K, val: FormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.staff === '') { setFormError('Please select a staff member.'); return; }
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  const showSection = SECTION_ROLES.includes(form.role_type);
  const sectionRequired = form.role_type === 'section_head';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Crown className="h-4 w-4" />
            {editing ? 'Edit Leadership Role' : 'Assign Leadership Role'}
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
            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form id="role-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

            <div>
              <label className={labelCls}>Role Type <span className="text-red-400 normal-case">*</span></label>
              <select required value={form.role_type}
                onChange={e => set('role_type', e.target.value as RoleType)} className={inputCls}>
                {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Staff Member <span className="text-red-400 normal-case">*</span></label>
              {/* Hidden input ensures form validation fires if nothing selected */}
              <input type="text" required readOnly tabIndex={-1}
                value={form.staff !== '' ? String(form.staff) : ''}
                className="sr-only" aria-hidden />
              <StaffSearchInput
                staffOptions={staffOptions}
                value={form.staff}
                onChange={val => set('staff', val)}
              />
              {form.staff === '' && (
                <p className="text-xs text-slate-400 mt-1">Start typing to search for a staff member</p>
              )}
            </div>

            {showSection && (
              <div>
                <label className={labelCls}>
                  School Section {sectionRequired && <span className="text-red-400 normal-case">*</span>}
                </label>
                <select required={sectionRequired} value={form.school_section}
                  onChange={e => set('school_section', e.target.value ? Number(e.target.value) : '')}
                  className={inputCls}>
                  <option value="">School-wide (no specific section)</option>
                  {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start Date <span className="text-red-400 normal-case">*</span></label>
                <input required type="date" value={form.start_date}
                  onChange={e => set('start_date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>End Date</label>
                <input type="date" value={form.end_date}
                  onChange={e => {
                    set('end_date', e.target.value);
                    if (e.target.value) set('is_current', false);
                  }} className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Leave blank if still in role</p>
              </div>
            </div>

            {/* Currently active toggle */}
            <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
              form.end_date ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-slate-50 border-slate-100'
            }`}>
              <div>
                <p className="text-sm font-medium text-slate-800">Currently Active</p>
                <p className="text-xs text-slate-400">
                  {form.end_date
                    ? 'Cannot be active with an end date set'
                    : 'Staff is currently holding this role'}
                </p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_current}
                disabled={!!form.end_date}
                onClick={() => !form.end_date && set('is_current', !form.is_current)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${
                  form.is_current && !form.end_date ? 'bg-blue-600' : 'bg-slate-200'
                }`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  form.is_current && !form.end_date ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={2} placeholder="Any additional notes about this role assignment"
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
          <button type="submit" form="role-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Assigning...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Role' : 'Assign Role'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LeadershipRolesPage() {
  const { hasPermission, user } = useAuth();

  const [roles, setRoles] = useState<LeadershipRole[]>([]);
  const [schoolSections, setSchoolSections] = useState<SchoolSection[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<LeadershipRole | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingRole, setDeletingRole] = useState<LeadershipRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleType, setSelectedRoleType] = useState('');
  const [selectedSection, setSelectedSection] = useState<number | ''>('');
  const [showCurrentOnly, setShowCurrentOnly] = useState(true);
  const [expandedRole, setExpandedRole] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView   = user?.is_superuser || hasPermission('academic.view_leadershiprolemodel');
  const canCreate = user?.is_superuser || hasPermission('academic.add_leadershiprolemodel');
  const canEdit   = user?.is_superuser || hasPermission('academic.change_leadershiprolemodel');
  const canDelete = user?.is_superuser || hasPermission('academic.delete_leadershiprolemodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      // staffAPI.list returns { results, count } per the staff list page pattern
      const [rolesData, sectionsData, staffData] = await Promise.all([
        academicAPI.listLeadershipRoles(),
        academicCalendarAPI.listSchoolSections(),
        staffAPI.list({ status: 'active', page_size: 500 }),
      ]);

      setRoles(rolesData);
      setSchoolSections(sectionsData);

      const staffList: any[] = (staffData as any)?.results ?? (staffData as any)?.data ?? staffData ?? [];
      setStaffOptions(
        (Array.isArray(staffList) ? staffList : []).map(s => ({
          id: s.id,
          name: s.full_name ?? (`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Staff #${s.id}`),
        }))
      );
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (canView) fetchData(); }, [canView, fetchData]);

  const handleSave = async (data: FormValues) => {
    setIsSaving(true);
    try {
      const payload: any = {
        role_type: data.role_type,
        staff: data.staff as number,
        start_date: data.start_date,
        is_current: data.is_current,
      };
      if (data.school_section) payload.school_section = data.school_section;
      if (data.end_date) payload.end_date = data.end_date;
      if (data.notes) payload.notes = data.notes;

      if (editingRole) {
        const updated = await academicAPI.updateLeadershipRole(editingRole.id, payload);
        setRoles(prev => prev.map(r => r.id === updated.id ? updated : r));
        showToast('success', 'Leadership role updated successfully');
      } else {
        const created = await academicAPI.createLeadershipRole(payload);
        setRoles(prev => [created, ...prev]);
        showToast('success', 'Leadership role assigned successfully');
      }
      setShowModal(false);
      setEditingRole(null);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    setIsDeleting(true);
    try {
      await academicAPI.deleteLeadershipRole(deletingRole.id);
      setRoles(prev => prev.filter(r => r.id !== deletingRole.id));
      showToast('success', 'Leadership role removed successfully');
      setDeletingRole(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingRole(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = roles.filter(r => {
    const matchSearch = !searchTerm ||
      r.staff_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.role_type_display?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType    = !selectedRoleType || r.role_type === selectedRoleType;
    const matchSection = !selectedSection  || r.school_section === selectedSection;
    const matchCurrent = !showCurrentOnly  || r.is_current;
    return matchSearch && matchType && matchSection && matchCurrent;
  });

  const currentCount    = roles.filter(r => r.is_current).length;
  const uniqueStaff     = new Set(roles.map(r => r.staff)).size;
  const uniqueRoleTypes = new Set(roles.map(r => r.role_type)).size;

  if (!canView) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 text-sm">You don't have permission to view leadership roles.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDeleteModal
        open={!!deletingRole} role={deletingRole} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingRole(null)}
      />

      {showModal && (
        <LeadershipRoleModal
          editing={editingRole} schoolSections={schoolSections} staffOptions={staffOptions}
          isSaving={isSaving} onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingRole(null); }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Crown className="h-5 w-5 text-white" />
            </div>
            Leadership Roles
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Manage school leadership and role assignments</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditingRole(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Assign Role
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Assignments', value: roles.length,    icon: Crown,       color: 'from-blue-500 to-blue-600'     },
          { label: 'Currently Active',  value: currentCount,    icon: BadgeCheck,  color: 'from-emerald-500 to-teal-600'  },
          { label: 'Staff in Roles',    value: uniqueStaff,     icon: User,        color: 'from-violet-500 to-purple-600' },
          { label: 'Role Types Used',   value: uniqueRoleTypes, icon: ShieldCheck, color: 'from-orange-400 to-amber-500'  },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by staff name or role..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <select value={selectedRoleType} onChange={e => setSelectedRoleType(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-600">
            <option value="">All Role Types</option>
            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <select value={selectedSection}
            onChange={e => setSelectedSection(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-600">
            <option value="">All Sections</option>
            {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCurrentOnly(v => !v)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                showCurrentOnly
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
              Current only
            </button>
            <button onClick={fetchData} title="Refresh"
              className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_150px_130px_90px_110px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff Member</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading leadership roles...</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-sm text-slate-500">{pageError}</p>
            <button onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Crown className="h-6 w-6 text-slate-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No leadership roles found</h3>
            <p className="text-sm text-slate-400">
              {searchTerm || selectedRoleType || selectedSection
                ? 'Try adjusting your filters'
                : 'Get started by assigning your first leadership role'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(role => (
              <div key={role.id}>
                <div className="grid grid-cols-[1fr_150px_130px_90px_110px] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">

                  {/* Staff */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{role.staff_name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Since {new Date(role.start_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Role badge */}
                  <RoleBadge roleType={role.role_type} />

                  {/* Section */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                    <Building className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{role.school_section_name || 'School-wide'}</span>
                  </div>

                  {/* Status */}
                  {role.is_current
                    ? <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Current
                      </span>
                    : <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Past
                      </span>}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <button onClick={() => { setEditingRole(role); setShowModal(true); }}
                        title="Edit"
                        className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingRole(role)}
                        title="Remove"
                        className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                      title="Details"
                      className="p-1.5 rounded-lg text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all">
                      {expandedRole === role.id
                        ? <ChevronUp className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded row */}
                {expandedRole === role.id && (
                  <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-slate-400 mb-0.5">Start Date</p>
                        <p className="font-semibold text-slate-700">
                          {new Date(role.start_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">End Date</p>
                        <p className="font-semibold text-slate-700">
                          {role.end_date ? new Date(role.end_date).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      {role.notes && (
                        <div className="sm:col-span-2">
                          <p className="text-slate-400 mb-0.5">Notes</p>
                          <p className="font-medium text-slate-600">{role.notes}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-slate-400 mb-0.5">Recorded</p>
                        <p className="font-semibold text-slate-700">
                          {new Date(role.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Last Updated</p>
                        <p className="font-semibold text-slate-700">
                          {new Date(role.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}