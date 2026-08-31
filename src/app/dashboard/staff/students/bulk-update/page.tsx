'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  studentsAPI,
  parentsAPI,
  academicAPI,
  studentUtilsAPI,
  bulkUpdateAPI,
} from '@/lib/api';
import {
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Users,
  Pencil,
  KeyRound,
  Image as ImageIcon,
  Trash2,
  UploadCloud,
  Info,
  Save,
  CheckCircle2,
  MapPin,
} from 'lucide-react';

// ─── Type Definitions ──────────────────────────────────────────────────────────
interface BulkFieldGroups {
  [groupName: string]: string[];
}

interface EditableRow {
  original: any;
  fields: Record<string, any>; // only modified fields
  usernameMode: 'none' | 'auto' | 'fixed' | 'manual';
  usernameValue: string;
  passwordMode: 'none' | 'auto' | 'fixed' | 'manual';
  passwordValue: string;
  sendCredentialsEmail: boolean;
  imageFile: File | null;
  removeImage: boolean;
  parentName?: string;
  emailError?: string;
}

interface ToastItem {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface ConfirmModalState {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

const MAX_BATCH_SIZE = 50;

// ─── Field Group Metadata ─────────────────────────────────────────────────────
const GROUP_META: Record<string, { label: string; icon: any; description: string }> = {
  name: { label: 'Name', icon: Pencil, description: 'First, middle and last name' },
  contact: { label: 'Contact', icon: Users, description: 'Email, mobile and address' },
  class: { label: 'Class', icon: GraduationCap, description: 'Current class and section' },
  bio: { label: 'Biography', icon: Users, description: 'Date of birth, gender, religion etc.' },
  state: { label: 'State / LGA', icon: MapPin, description: 'State of origin and LGA' },
  parent: { label: 'Parent', icon: Users, description: 'Guardian and relationship' },
  registration_number: { label: 'Reg Number', icon: KeyRound, description: 'Registration number' },
  occupation: { label: 'Occupation', icon: Users, description: 'Job and office details' },
  credentials: { label: 'Credentials', icon: KeyRound, description: 'Username & password' },
  image: { label: 'Image', icon: ImageIcon, description: 'Update or remove photo' },
};

const FIELD_META: Record<string, { label: string; type: string; options?: { value: string; label: string }[] }> = {
  first_name: { label: 'First Name', type: 'text' },
  middle_name: { label: 'Middle Name', type: 'text' },
  last_name: { label: 'Last Name', type: 'text' },
  title: { label: 'Title', type: 'text' },
  email: { label: 'Email', type: 'email' },
  mobile: { label: 'Mobile', type: 'text' },
  address: { label: 'Address', type: 'text' },
  date_of_birth: { label: 'Date of Birth', type: 'date' },
  gender: {
    label: 'Gender',
    type: 'select',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
    ],
  },
  marital_status: {
    label: 'Marital Status',
    type: 'select',
    options: [
      { value: 'single', label: 'Single' },
      { value: 'married', label: 'Married' },
      { value: 'divorced', label: 'Divorced' },
      { value: 'widowed', label: 'Widowed' },
    ],
  },
  religion: {
    label: 'Religion',
    type: 'select',
    options: [
      { value: 'christianity', label: 'Christianity' },
      { value: 'islam', label: 'Islam' },
      { value: 'traditional', label: 'Traditional' },
      { value: 'other', label: 'Other' },
    ],
  },
  blood_group: {
    label: 'Blood Group',
    type: 'select',
    options: [
      { value: 'A+', label: 'A+' },
      { value: 'A-', label: 'A-' },
      { value: 'B+', label: 'B+' },
      { value: 'B-', label: 'B-' },
      { value: 'AB+', label: 'AB+' },
      { value: 'AB-', label: 'AB-' },
      { value: 'O+', label: 'O+' },
      { value: 'O-', label: 'O-' },
    ],
  },
  genotype: {
    label: 'Genotype',
    type: 'select',
    options: [
      { value: 'AA', label: 'AA' },
      { value: 'AS', label: 'AS' },
      { value: 'SS', label: 'SS' },
      { value: 'AC', label: 'AC' },
    ],
  },
  medical_conditions: { label: 'Medical Conditions', type: 'textarea' },
  is_special_need: { label: 'Special Need', type: 'checkbox' },
  state: { label: 'State', type: 'select' },
  lga: { label: 'LGA', type: 'select' },
  current_class: { label: 'Class', type: 'select' },
  current_class_section: { label: 'Class Section', type: 'select' },
  parent: { label: 'Parent', type: 'parent_search' },
  relationship_with_parent: {
    label: 'Relationship',
    type: 'select',
    options: [
      { value: 'father', label: 'Father' },
      { value: 'mother', label: 'Mother' },
      { value: 'guardian', label: 'Guardian' },
      { value: 'uncle', label: 'Uncle' },
      { value: 'aunt', label: 'Aunt' },
      { value: 'grandparent', label: 'Grandparent' },
      { value: 'sibling', label: 'Sibling' },
      { value: 'other', label: 'Other' },
    ],
  },
  occupation: { label: 'Occupation', type: 'text' },
  office_address: { label: 'Office Address', type: 'text' },
  office_mobile: { label: 'Office Mobile', type: 'text' },
  registration_number: { label: 'Registration Number', type: 'text' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
let toastId = 0;

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d?.message) return String(d.message);
  if (d?.detail) return String(d.detail);
  return err?.message || 'An unexpected error occurred.';
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function isValidEmail(email: string): boolean {
  if (!email) return true; // empty is allowed (clearing)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[110] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
            ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}
        >
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

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ state, onClose }: { state: ConfirmModalState | null; onClose: () => void }) {
  if (!state) return null;
  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3 bg-amber-50 text-amber-600 border border-amber-100">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-base font-bold text-slate-900 text-center mb-1.5">{state.title}</h3>
        <p className="text-xs text-slate-500 text-center mb-5 leading-relaxed font-medium">{state.message}</p>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">
            Keep Editing
          </button>
          <button
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className="flex-1 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
          >
            {state.confirmText || 'Discard'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Parent Search Modal ───────────────────────────────────────────────────────
function ParentSearchModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (parent: any) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setResults([]);
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await parentsAPI.list({ status: 'active', search: search.trim(), page_size: 8 });
        const data = (res as any)?.results ?? (res as any)?.data ?? res ?? [];
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[125] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Select Guardian</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, mobile or parent ID…"
              autoFocus
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50/50 placeholder:text-slate-300"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              </div>
            ) : results.length > 0 ? (
              results.map(p => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {toTitleCase(p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim())}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {p.parent_id} {p.mobile ? `• ${p.mobile}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
              ))
            ) : (
              <div className="py-10 text-center">
                <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  {search.trim().length < 2 ? 'Type at least 2 characters to search' : 'No guardians found'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Summary Modal (simple, no PDF) ────────────────────────────────────────────
function SummaryModal({ result, onClose }: { result: any; onClose: () => void }) {
  const [showWarning, setShowWarning] = useState(false);

  const handleClose = () => setShowWarning(true);

  return (
    <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={showWarning ? undefined : onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Bulk Update Complete</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-4rem)]">
          {/* Summary counts */}
          <div className="flex items-center justify-center gap-8 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-800">{result.summary.success}</p>
              <p className="text-xs text-slate-400">Succeeded</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{result.summary.failed}</p>
              <p className="text-xs text-slate-400">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-800">{result.summary.total}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
          </div>

          {/* Results table */}
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase">ID</th>
                  <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {result.results.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-sm font-mono text-slate-600">{r.id}</td>
                    <td className="px-4 py-2">
                      {r.success ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <Check className="h-3 w-3" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                          <X className="h-3 w-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {r.success ? (r.warning || 'No issues') : r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Warning when closing */}
        {showWarning && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center z-10">
            <div className="bg-white rounded-2xl p-5 mx-4 text-center shadow-xl">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800 mb-2">Report will be lost</p>
              <p className="text-xs text-slate-500 mb-4">
                Closing this modal will discard the report.
              </p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setShowWarning(false)} className="px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                  Cancel
                </button>
                <button onClick={() => { setShowWarning(false); onClose(); }} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">
                  Close Anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function BulkUpdatePage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const [entityType, setEntityType] = useState<'student' | 'parent'>('student');
  const [fieldGroups, setFieldGroups] = useState<BulkFieldGroups>({});
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [records, setRecords] = useState<any[]>([]);
  const [editMap, setEditMap] = useState<Record<number, EditableRow>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [batchSize, setBatchSize] = useState(20);

  const [filters, setFilters] = useState<Record<string, string>>({ search: '', status: '', class_id: '', section_id: '', gender: '' });
  const [referenceData, setReferenceData] = useState<{
    classes: any[];
    sections: any[];
    states: string[];
    lgasCache: Record<string, string[]>;
  }>({ classes: [], sections: [], states: [], lgasCache: {} });

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [showParentModal, setShowParentModal] = useState<{ rowId: number; field: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);

  const canEditStudents = user?.is_superuser || hasPermission('student_management.add_bulkstudentuploadmodel');
  const canEditParents = user?.is_superuser || hasPermission('student_management.add_bulkstudentuploadmodel');
  const canEdit = entityType === 'student' ? canEditStudents : canEditParents;

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const isRowDirty = useCallback((rowId: number) => {
    const row = editMap[rowId];
    if (!row) return false;
    const hasFields = Object.values(row.fields).some(v => v !== '' && v !== null && v !== undefined);
    return hasFields || row.usernameMode !== 'none' || row.passwordMode !== 'none' || !!row.imageFile || row.removeImage;
  }, [editMap]);

  const hasAnyDirty = useMemo(() => {
    return Object.keys(editMap).some(id => isRowDirty(Number(id)));
  }, [editMap, isRowDirty]);

  const loadFieldGroups = useCallback(async (entity: 'student' | 'parent') => {
    setLoadingGroups(true);
    try {
      const groups = await bulkUpdateAPI.getFieldGroups(entity);
      setFieldGroups(groups);
      setSelectedGroups(prev => {
        const available = new Set(Object.keys(groups));
        ['credentials', 'image'].forEach(g => available.add(g));
        return new Set([...prev].filter(g => available.has(g)));
      });
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoadingGroups(false);
    }
  }, [showToast]);

  const resetDataAfterConfirm = () => {
    setRecords([]);
    setEditMap({});
    setSelectedIds(new Set());
    setPage(1);
    setTotal(0);
    setResult(null);
    setShowSummary(false);
  };

  const handleEntityChange = (newEntity: 'student' | 'parent') => {
    if (newEntity === entityType) return;
    if (hasAnyDirty) {
      setConfirmModal({
        title: 'Switch entity type?',
        message: 'This will discard all unsaved changes in the current table.',
        confirmText: 'Switch & Discard',
        onConfirm: () => {
          setEntityType(newEntity);
          resetDataAfterConfirm();
          loadFieldGroups(newEntity);
        },
      });
    } else {
      setEntityType(newEntity);
      resetDataAfterConfirm();
      loadFieldGroups(newEntity);
    }
  };

  const toggleGroup = (groupKey: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        const fieldsInGroup = fieldGroups[groupKey] || [];
        const hasGroupEdits = Object.values(editMap).some(row =>
          Object.entries(row.fields).some(([field, value]) =>
            fieldsInGroup.includes(field) && value !== '' && value !== null && value !== undefined
          )
        );
        const hasCredentialEdits = groupKey === 'credentials' && Object.values(editMap).some(r => r.usernameMode !== 'none' || r.passwordMode !== 'none');
        const hasImageEdits = groupKey === 'image' && Object.values(editMap).some(r => r.imageFile || r.removeImage);

        if (hasGroupEdits || hasCredentialEdits || hasImageEdits) {
          setConfirmModal({
            title: 'Discard group edits?',
            message: 'Unsaved changes in this group will be removed.',
            confirmText: 'Discard',
            onConfirm: () => {
              setEditMap(prev => {
                const newMap = { ...prev };
                Object.keys(newMap).forEach(id => {
                  const row = newMap[Number(id)];
                  if (groupKey === 'credentials') {
                    row.usernameMode = 'none'; row.usernameValue = ''; row.passwordMode = 'none'; row.passwordValue = ''; row.sendCredentialsEmail = false;
                  } else if (groupKey === 'image') {
                    row.imageFile = null; row.removeImage = false;
                  } else {
                    fieldsInGroup.forEach(f => { delete row.fields[f]; });
                  }
                });
                return newMap;
              });
              next.delete(groupKey);
            },
          });
          return prev;
        }
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const buildParams = useCallback((pageNum: number) => {
    const params: Record<string, any> = { page: pageNum, page_size: batchSize, bulk: true };
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.gender) params.gender = filters.gender;
    if (entityType === 'student') {
      if (filters.class_id) params.current_class = filters.class_id;
      if (filters.section_id) params.current_class_section = filters.section_id;
    }
    return params;
  }, [filters, batchSize, entityType]);

  const loadLgas = useCallback(async (state: string) => {
    if (!state || referenceData.lgasCache[state]) return;
    try {
      const lgas = await studentUtilsAPI.getLgas(state);
      setReferenceData(prev => ({ ...prev, lgasCache: { ...prev.lgasCache, [state]: lgas } }));
    } catch {
      // ignore
    }
  }, [referenceData.lgasCache]);

  const fetchRecords = useCallback(async (pageNum: number) => {
    setLoadingRecords(true);
    try {
      const params = buildParams(pageNum);
      const data = entityType === 'student' ? await studentsAPI.list(params) : await parentsAPI.list(params);
      const results = (data as any)?.results ?? (data as any)?.data ?? data ?? [];
      const count = (data as any)?.count ?? results.length;
      setRecords(Array.isArray(results) ? results : []);
      setTotal(count);
      setPage(pageNum);
      setResult(null);
      setShowSummary(false);

      const initialMap: Record<number, EditableRow> = {};
      (Array.isArray(results) ? results : []).forEach((r: any) => {
        initialMap[r.id] = {
          original: r,
          fields: {},
          usernameMode: 'none',
          usernameValue: '',
          passwordMode: 'none',
          passwordValue: '',
          sendCredentialsEmail: false,
          imageFile: null,
          removeImage: false,
        };
        if (r.parent_name) initialMap[r.id].parentName = r.parent_name;
        // pre-load LGAs for states
        if (r.state) loadLgas(r.state);
      });
      setEditMap(initialMap);
      setSelectedIds(new Set((Array.isArray(results) ? results : []).map((r: any) => r.id)));
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoadingRecords(false);
    }
  }, [buildParams, entityType, showToast, loadLgas]);

  const handleLoadRecords = () => {
    if (hasAnyDirty) {
      setConfirmModal({
        title: 'Load new records?',
        message: 'This will replace the current table and discard all unsaved changes.',
        confirmText: 'Load & Discard',
        onConfirm: () => fetchRecords(1),
      });
    } else {
      fetchRecords(1);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(total / batchSize)) return;
    if (hasAnyDirty) {
      setConfirmModal({
        title: 'Leave this page?',
        message: 'Unsaved changes on this page will be lost.',
        confirmText: 'Leave & Discard',
        onConfirm: () => fetchRecords(newPage),
      });
    } else {
      fetchRecords(newPage);
    }
  };

  const applyFieldEdit = (rowId: number, field: string, value: any) => {
    setEditMap(prev => {
      const row = { ...(prev[rowId] || {}), fields: { ...(prev[rowId]?.fields || {}) } };
      if (field === 'email' && value !== '' && value !== null && value !== undefined) {
        if (!isValidEmail(String(value))) {
          row.emailError = 'Invalid email';
        } else {
          delete row.emailError;
        }
      } else if (field === 'email') {
        delete row.emailError;
      }
      const originalValue = row.original?.[field] ?? '';
      if (value === originalValue || value === '' || value === null || value === undefined) {
        delete row.fields[field];
      } else {
        row.fields[field] = value;
      }
      return { ...prev, [rowId]: row };
    });
  };

  const setRowCredentialMode = (rowId: number, type: 'username' | 'password', mode: 'none' | 'auto' | 'fixed' | 'manual') => {
    setEditMap(prev => {
      const row = { ...prev[rowId] };
      if (type === 'username') {
        row.usernameMode = mode;
        if (mode !== 'fixed' && mode !== 'manual') row.usernameValue = '';
      } else {
        row.passwordMode = mode;
        if (mode !== 'fixed' && mode !== 'manual') row.passwordValue = '';
      }
      return { ...prev, [rowId]: row };
    });
  };

  const setRowCredentialValue = (rowId: number, type: 'username' | 'password', value: string) => {
    setEditMap(prev => {
      const row = { ...prev[rowId] };
      if (type === 'username') row.usernameValue = value;
      else row.passwordValue = value;
      return { ...prev, [rowId]: row };
    });
  };

  const setRowImage = (rowId: number, file: File | null) => {
    setEditMap(prev => ({ ...prev, [rowId]: { ...prev[rowId], imageFile: file, removeImage: false } }));
  };

  const setRowRemoveImage = (rowId: number) => {
    setEditMap(prev => ({ ...prev, [rowId]: { ...prev[rowId], imageFile: null, removeImage: true } }));
  };

  const handleParentSelect = (rowId: number, parent: any) => {
    applyFieldEdit(rowId, 'parent', parent.id);
    setEditMap(prev => ({ ...prev, [rowId]: { ...prev[rowId], parentName: parent.full_name || `${parent.first_name} ${parent.last_name}` } }));
    setShowParentModal(null);
  };

  const handleStateChange = (rowId: number, state: string) => {
    applyFieldEdit(rowId, 'state', state);
    applyFieldEdit(rowId, 'lga', ''); // clear old LGA
    loadLgas(state);
  };

  const handleSubmit = async () => {
    const currentPageIds = new Set(records.map(r => r.id));
    const targetIds = Array.from(selectedIds).filter(id => currentPageIds.has(id) && isRowDirty(id));
    if (targetIds.length === 0) {
      showToast('error', 'No unsaved changes to apply. Edit at least one row.');
      return;
    }

    const hasEmailError = targetIds.some(id => editMap[id]?.emailError);
    if (hasEmailError) {
      showToast('error', 'Some email addresses are invalid. Fix them before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const rows: any[] = [];
      const imageFiles: Record<number, File> = {};

      targetIds.forEach(id => {
        const row = editMap[id];
        if (!row) return;
        const fields: Record<string, any> = {};
        Object.entries(row.fields).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) fields[k] = v;
        });

        const payload: any = { id };
        if (Object.keys(fields).length) payload.fields = fields;

        if (row.usernameMode !== 'none') {
          payload.username_mode = row.usernameMode;
          if (row.usernameMode === 'fixed' || row.usernameMode === 'manual') payload.username_value = row.usernameValue;
        }
        if (row.passwordMode !== 'none') {
          payload.password_mode = row.passwordMode;
          if (row.passwordMode === 'fixed' || row.passwordMode === 'manual') payload.password_value = row.passwordValue;
        }
        if ((row.usernameMode !== 'none' || row.passwordMode !== 'none') && row.sendCredentialsEmail) {
          payload.send_credentials_email = true;
        }
        if (row.imageFile) {
          imageFiles[id] = row.imageFile;
        }
        if (row.removeImage) payload.remove_image = true;

        rows.push(payload);
      });

      const response = Object.keys(imageFiles).length > 0
        ? entityType === 'student'
          ? await bulkUpdateAPI.updateStudentsMultipart(rows, imageFiles)
          : await bulkUpdateAPI.updateParentsMultipart(rows, imageFiles)
        : entityType === 'student'
          ? await bulkUpdateAPI.updateStudents(rows)
          : await bulkUpdateAPI.updateParents(rows);

      setResult(response);
      setShowSummary(true);
      showToast('success', `Bulk update completed: ${response.summary.success} succeeded, ${response.summary.failed} failed`);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadFieldGroups(entityType);
  }, []);

  useEffect(() => {
    Promise.all([
      academicAPI.listClasses(),
      academicAPI.listClassSections(),
      studentUtilsAPI.getStates(),
    ]).then(([classes, sections, states]) => {
      setReferenceData(prev => ({ ...prev, classes, sections, states }));
    }).catch(() => {});
  }, []);

  const groupList = useMemo(() => {
    const groups = Object.keys(fieldGroups);
    return [...groups, 'credentials', 'image'];
  }, [fieldGroups]);

  const allSelectedOnPage = records.length > 0 && records.every(r => selectedIds.has(r.id));

  const totalPages = Math.ceil(total / batchSize);

  const getDisplayValue = (record: any, field: string) => {
    const row = editMap[record.id];
    if (row && Object.prototype.hasOwnProperty.call(row.fields, field)) {
      return row.fields[field];
    }
    if (field === 'date_of_birth') {
      return formatDateForInput(record[field]);
    }
    return record[field] ?? '';
  };

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />
      <ParentSearchModal
        open={!!showParentModal}
        onClose={() => setShowParentModal(null)}
        onSelect={(p) => showParentModal && handleParentSelect(showParentModal.rowId, p)}
      />
      {showSummary && result && <SummaryModal result={result} onClose={() => setShowSummary(false)} />}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
            <Pencil className="h-5 w-5 text-white" />
          </div>
          Bulk Update
        </h1>
        <p className="text-sm text-slate-400 mt-0.5 pl-12">Edit multiple student or guardian records at once</p>
      </div>

      {/* Entity Toggle */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 flex gap-1.5">
        {([
          { id: 'student' as const, label: 'Students', icon: GraduationCap },
          { id: 'parent' as const, label: 'Guardians', icon: Users },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleEntityChange(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              entityType === id
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Group Selector */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">
          Select fields to edit
        </p>
        {loadingGroups ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {groupList.map(groupKey => {
              const meta = GROUP_META[groupKey] || { label: groupKey, icon: Pencil, description: '' };
              const Icon = meta.icon;
              const isSelected = selectedGroups.has(groupKey);
              return (
                <button
                  key={groupKey}
                  onClick={() => toggleGroup(groupKey)}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 leading-tight">{meta.label}</p>
                    {meta.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{meta.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search…"
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <select
          value={filters.status}
          onChange={e => handleFilterChange('status', e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          {entityType === 'student' && <option value="graduated">Graduated</option>}
          {entityType === 'parent' && <option value="inactive">Inactive</option>}
        </select>

        <select
          value={filters.gender}
          onChange={e => handleFilterChange('gender', e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        >
          <option value="">All genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>

        {entityType === 'student' && (
          <>
            <select
              value={filters.class_id}
              onChange={e => handleFilterChange('class_id', e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">All classes</option>
              {referenceData.classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filters.section_id}
              onChange={e => handleFilterChange('section_id', e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">All sections</option>
              {referenceData.sections.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </>
        )}

        <div className="flex items-center gap-2">
          <select
            value={batchSize}
            onChange={e => setBatchSize(Number(e.target.value))}
            className="px-2 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            title="Batch size"
          >
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
          <button
            onClick={handleLoadRecords}
            disabled={loadingRecords}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50"
          >
            {loadingRecords ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Load Records
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {records.length === 0 && !loadingRecords ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="h-7 w-7 text-blue-300" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">No records loaded</p>
            <p className="text-sm text-slate-400">Use filters and click "Load Records" to get started</p>
          </div>
        ) : loadingRecords ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading records…</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (allSelectedOnPage) {
                              records.forEach(r => next.delete(r.id));
                            } else {
                              records.forEach(r => next.add(r.id));
                            }
                            return next;
                          });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Record</th>
                    {Array.from(selectedGroups).map(groupKey => {
                      if (groupKey === 'credentials') {
                        return (
                          <th key={groupKey} className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Username / Password
                          </th>
                        );
                      }
                      if (groupKey === 'image') {
                        return (
                          <th key={groupKey} className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Image
                          </th>
                        );
                      }
                      const fields = fieldGroups[groupKey] || [];
                      return fields.map(field => {
                        const meta = FIELD_META[field];
                        if (!meta) return null;
                        return (
                          <th key={field} className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            {meta.label}
                          </th>
                        );
                      });
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map(record => {
                    const row = editMap[record.id];
                    if (!row) return null;
                    const selected = selectedIds.has(record.id);
                    return (
                      <tr key={record.id} className={`hover:bg-slate-50/50 transition-colors ${selected ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                next.has(record.id) ? next.delete(record.id) : next.add(record.id);
                                return next;
                              });
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                              {record.image_url ? (
                                <img src={record.image_url} className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <GraduationCap className="h-4 w-4 text-blue-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {toTitleCase(record.full_name || `${record.first_name || ''} ${record.last_name || ''}`.trim())}
                              </p>
                              <p className="text-[11px] font-mono text-slate-400">
                                {entityType === 'student' ? record.registration_number : record.parent_id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {Array.from(selectedGroups).map(groupKey => {
                          if (groupKey === 'credentials') {
                            return (
                              <td key={groupKey} className="px-3 py-3">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={row.usernameMode}
                                      onChange={e => setRowCredentialMode(record.id, 'username', e.target.value as any)}
                                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                      <option value="none">No change</option>
                                      <option value="auto">Auto</option>
                                      <option value="fixed">Fixed</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                    {(row.usernameMode === 'fixed' || row.usernameMode === 'manual') && (
                                      <input
                                        type="text"
                                        placeholder="Username"
                                        value={row.usernameValue}
                                        onChange={e => setRowCredentialValue(record.id, 'username', e.target.value)}
                                        className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white w-24"
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={row.passwordMode}
                                      onChange={e => setRowCredentialMode(record.id, 'password', e.target.value as any)}
                                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                      <option value="none">No change</option>
                                      <option value="auto">Auto</option>
                                      <option value="fixed">Fixed</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                    {(row.passwordMode === 'fixed' || row.passwordMode === 'manual') && (
                                      <input
                                        type="text"
                                        placeholder="Password"
                                        value={row.passwordValue}
                                        onChange={e => setRowCredentialValue(record.id, 'password', e.target.value)}
                                        className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white w-24"
                                      />
                                    )}
                                  </div>
                                  {(row.usernameMode !== 'none' || row.passwordMode !== 'none') && (
                                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                                      <input
                                        type="checkbox"
                                        checked={row.sendCredentialsEmail}
                                        onChange={e => setEditMap(prev => ({ ...prev, [record.id]: { ...prev[record.id], sendCredentialsEmail: e.target.checked } }))}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                      />
                                      Email credentials
                                    </label>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          if (groupKey === 'image') {
                            return (
                              <td key={groupKey} className="px-3 py-3">
                                <div className="flex flex-col items-start gap-2">
                                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                    {row.imageFile ? (
                                      <img src={URL.createObjectURL(row.imageFile)} className="w-full h-full object-cover" />
                                    ) : row.removeImage ? (
                                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                                        <Trash2 className="h-4 w-4" />
                                      </div>
                                    ) : record.image_url ? (
                                      <img src={record.image_url} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                                        <ImageIcon className="h-4 w-4" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors">
                                      <UploadCloud className="h-3 w-3" />
                                      Change
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => e.target.files?.[0] && setRowImage(record.id, e.target.files[0])}
                                      />
                                    </label>
                                    <button
                                      onClick={() => setRowRemoveImage(record.id)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </td>
                            );
                          }

                          const fields = fieldGroups[groupKey] || [];
                          return fields.map(field => {
                            const meta = FIELD_META[field];
                            if (!meta) return <td key={field} />;

                            const displayValue = getDisplayValue(record, field);

                            if (meta.type === 'checkbox') {
                              return (
                                <td key={field} className="px-3 py-3">
                                  <input
                                    type="checkbox"
                                    checked={!!displayValue}
                                    onChange={e => applyFieldEdit(record.id, field, e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                  />
                                </td>
                              );
                            }

                            if (meta.type === 'select') {
                              let optionList = meta.options || [];
                              if (field === 'current_class') optionList = referenceData.classes.map(c => ({ value: c.id, label: c.name }));
                              else if (field === 'current_class_section') optionList = referenceData.sections.map(s => ({ value: s.id, label: s.name }));
                              else if (field === 'state') optionList = referenceData.states.map(s => ({ value: s, label: s }));
                              else if (field === 'lga') {
                                const stateValue = row.fields.state ?? record.state;
                                const lgaList = referenceData.lgasCache[stateValue] || [];
                                optionList = lgaList.map(l => ({ value: l, label: l }));
                              }

                              return (
                                <td key={field} className="px-3 py-3">
                                  <select
                                    value={displayValue}
                                    onChange={e => {
                                      if (field === 'state') {
                                        handleStateChange(record.id, e.target.value);
                                      } else {
                                        applyFieldEdit(record.id, field, e.target.value);
                                      }
                                    }}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                  >
                                    <option value="">Select…</option>
                                    {optionList.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </td>
                              );
                            }

                            if (meta.type === 'parent_search') {
                              return (
                                <td key={field} className="px-3 py-3">
                                  <button
                                    onClick={() => setShowParentModal({ rowId: record.id, field })}
                                    className="w-full max-w-[160px] px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors text-left truncate"
                                  >
                                    {row.parentName || record.parent_name || 'Select parent'}
                                  </button>
                                </td>
                              );
                            }

                            if (meta.type === 'textarea') {
                              return (
                                <td key={field} className="px-3 py-3">
                                  <textarea
                                    value={displayValue}
                                    onChange={e => applyFieldEdit(record.id, field, e.target.value)}
                                    rows={2}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white resize-none"
                                    placeholder={meta.label}
                                  />
                                </td>
                              );
                            }

                            return (
                              <td key={field} className="px-3 py-3">
                                <input
                                  type={meta.type === 'email' ? 'email' : meta.type === 'date' ? 'date' : 'text'}
                                  value={displayValue}
                                  onChange={e => {
                                    applyFieldEdit(record.id, field, e.target.value);
                                  }}
                                  onBlur={() => {
                                    if (field === 'registration_number' && displayValue) {
                                      bulkUpdateAPI.checkDuplicateRegistrationNumber(displayValue, record.id)
                                        .then(check => {
                                          if (check?.is_duplicate) {
                                            showToast('error', `Reg number already in use by ${check.student_name}`);
                                          }
                                        })
                                        .catch(() => {});
                                    }
                                  }}
                                  className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white ${
                                    field === 'email' && row.emailError ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-200'
                                  }`}
                                  placeholder={meta.label}
                                />
                                {field === 'email' && row.emailError && (
                                  <p className="text-xs text-red-500 mt-1">{row.emailError}</p>
                                )}
                              </td>
                            );
                          });
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * batchSize) + 1}–{Math.min(page * batchSize, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> records
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 text-xs font-bold text-slate-600">{page} / {totalPages}</span>
                  <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || !hasAnyDirty}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Applying Updates…</>
          ) : (
            <><Save className="h-4 w-4" /> Apply Updates</>
          )}
        </button>
      </div>
    </div>
  );
}