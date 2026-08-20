'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { inventoryAssignmentAPI, inventoryItemAPI, academicAPI, academicCalendarAPI } from '@/lib/api';
import { InventoryAssignment, InventoryItemList, ClassModel, AcademicPeriod } from '@/lib/types';
import {
  Layers, Plus, Edit2, Trash2, Check, X, AlertCircle,
  Loader2, Search, ArrowLeft, Users, Info,
  ChevronDown, ChevronUp, Package, Ban, Activity, ShieldAlert, Copy, CalendarClock
} from 'lucide-react';

const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5';
const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white transition-all';
const selectCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white transition-all appearance-none';

const PAGE_SIZE = 20;

function extractError(err: any): string {
  if (err?.response?.data?.detail) return err.response.data.detail;
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.response?.data?.details) {
    const details = err.response.data.details;
    const firstKey = Object.keys(details)[0];
    if (firstKey) {
      const val = details[firstKey];
      return Array.isArray(val) ? val[0] : String(val);
    }
  }
  return err?.message || 'An unexpected error occurred';
}

function SectionHeader({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
      <h2 className="font-bold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wide">
        <span className="text-cyan-600">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border pointer-events-auto animate-in slide-in-from-right-4 ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />}
          <span className="text-sm font-medium whitespace-pre-line">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${checked ? 'bg-cyan-600' : 'bg-slate-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function GenderBadge({ gender }: { gender: 'male' | 'female' | 'both' }) {
  const cfg = {
    both: { label: 'All Genders', cls: 'bg-slate-100 text-slate-600' },
    male: { label: 'Male Only', cls: 'bg-sky-50 text-sky-700' },
    female: { label: 'Female Only', cls: 'bg-pink-50 text-pink-700' },
  }[gender];
  return <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg.cls}`}>{cfg.label}</span>;
}

// Two assignments can only double-issue the same physical item to the same
// student if their gender targeting actually overlaps. male vs female never
// overlaps; 'both' overlaps with anything; same-gender-to-same-gender overlaps.
function gendersOverlap(g1: string, g2: string) {
  if (g1 === 'both' || g2 === 'both') return true;
  return g1 === g2;
}

// Groups a flat list of ClassConfigurationModel ids under their parent class,
// so the UI can render "Primary 1: Gold, Green, Blue" instead of 36 loose pills.
function groupConfigsByClass(configIds: number[], classes: ClassModel[]): { className: string; arms: string[] }[] {
  const groups: { className: string; arms: string[] }[] = [];
  classes.forEach(cls => {
    const matched = (cls.configurations || []).filter(cfg => configIds.includes(cfg.id));
    if (matched.length > 0) {
      groups.push({
        className: cls.name,
        arms: matched.map(cfg => cfg.class_section_name || `Arm ${cfg.id}`),
      });
    }
  });
  return groups;
}

// ─── Duplicate Assignment Anomaly ──────────────────────────────────────────
// Two saved, active assignments for the SAME item whose gender targeting
// overlaps and whose class-arm scopes overlap. Persistent, list-level
// counterpart to the live in-form guard below — catches conflicts between
// assignments edited independently or created before the conflict existed.
type DuplicateAnomaly = {
  id: string;
  a: InventoryAssignment;
  b: InventoryAssignment;
  classNames: string[];
};

// ─── Searchable Item Picker ─────────────────────────────────────────────────
// Server-side search combobox: this platform is multi-tenant, so the item
// catalog can't be assumed to fit in one client-side page. Every keystroke
// (debounced) hits the same search-capable endpoint the rest of the app uses.
function ItemSearchSelect({
  selectedLabel,
  onSelect,
  disabled,
}: {
  selectedLabel: string;
  onSelect: (item: InventoryItemList) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InventoryItemList[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Debounced server search — fires on open (to show an initial page) and on typing
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await inventoryItemAPI.list({
          search: query.trim() || undefined,
          page_size: 20,
          is_active: true,
        });
        const data = Array.isArray(res) ? res : res?.results || [];
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  if (disabled) {
    return (
      <div className={inputCls + ' bg-slate-50 text-slate-500'}>
        {selectedLabel || 'Item cannot be changed after creation'}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={selectCls + ' text-left flex items-center justify-between gap-2'}
      >
        <span className={selectedLabel ? 'text-slate-800 truncate' : 'text-slate-400'}>
          {selectedLabel || 'Search for an item...'}
        </span>
        <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search items by name..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading && (
              <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-cyan-600" /></div>
            )}
            {!loading && results.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No items found.</p>
            )}
            {!loading && results.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onSelect(item); setOpen(false); setQuery(''); }}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 border-b border-slate-50 last:border-0"
              >
                <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">₦{Number(item.current_selling_price).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InventoryAssignmentsPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('inventory.view_inventoryassignmentmodel');

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastIdRef.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  // ── Full Dataset (used by anomaly scanner + live duplicate guard) ──
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<InventoryAssignment[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);

  // ── Pagination (visible table only) ──
  const [pagedAssignments, setPagedAssignments] = useState<InventoryAssignment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(true);

  // ── UI State ──
  const [view, setView] = useState<'list' | 'create' | { mode: 'edit'; assignment: InventoryAssignment }>('list');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  // ── Form State ──
  const [title, setTitle] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [selectedItemLabel, setSelectedItemLabel] = useState('');
  const [quantityPerStudent, setQuantityPerStudent] = useState('1');
  const [gender, setGender] = useState<'male' | 'female' | 'both'>('both');
  const [isMandatory, setIsMandatory] = useState(false);
  const [isFree, setIsFree] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [academicPeriod, setAcademicPeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedConfigIds, setSelectedConfigIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classSearch, setClassSearch] = useState('');
  const [expandedScopeClasses, setExpandedScopeClasses] = useState<number[]>([]);

  // ── Live (pre-submit) duplicate warning ──
  const [liveConflicts, setLiveConflicts] = useState<string[]>([]);
  const [dismissedLiveWarning, setDismissedLiveWarning] = useState(false);

  // ── Modals ──
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; assignment: InventoryAssignment | null; isErrorMode: boolean; errorMsg: string }>({ open: false, assignment: null, isErrorMode: false, errorMsg: '' });
  const [duplicateModal, setDuplicateModal] = useState<{ open: boolean; conflicts: string[] }>({ open: false, conflicts: [] });

  // ── Persistent Duplicate Anomalies ──
  const [anomalies, setAnomalies] = useState<DuplicateAnomaly[]>([]);
  const [showAnomaliesModal, setShowAnomaliesModal] = useState(false);

  // ── Load Data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aData, cData] = await Promise.all([
        inventoryAssignmentAPI.list({ page_size: 100 }),
        academicAPI.listClasses({ is_active: true }),
      ]);
      setAssignments(Array.isArray(aData) ? aData : aData?.results || []);
      setClasses(Array.isArray(cData) ? cData : cData?.results || []);

      // The period-types endpoint already nests each type's periods array
      // (id/name/order) — no need for a second request to a periods-by-type
      // endpoint that doesn't exist on this backend. Just read the active
      // type's nested list directly.
      try {
        const types = await academicCalendarAPI.listPeriodTypes();
        const activeType = types.find((t: any) => t.is_active);
        setPeriods((activeType?.periods || []) as AcademicPeriod[]);
      } catch (e) {
        console.warn('Could not load academic periods for assignment form.', e);
        setPeriods([]);
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Fetch Paged Assignments ──
  const fetchPagedAssignments = useCallback(async () => {
    setTableLoading(true);
    try {
      const response = await inventoryAssignmentAPI.list({
        page, page_size: PAGE_SIZE,
        search: search.trim() || undefined,
        is_active: filterStatus === 'all' ? undefined : filterStatus === 'active',
      });
      const data = Array.isArray(response) ? response : response?.results || [];
      const count = typeof response?.count === 'number' ? response.count : data.length;
      setPagedAssignments(data);
      setTotal(count);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setTableLoading(false);
    }
  }, [page, search, filterStatus, showToast]);

  useEffect(() => { setPage(1); }, [search, filterStatus]);
  useEffect(() => {
    const handler = setTimeout(() => { fetchPagedAssignments(); }, 400);
    return () => clearTimeout(handler);
  }, [fetchPagedAssignments]);

  // ── Duplicate Anomaly Scanner (runs against the FULL dataset) ──
  useEffect(() => {
    if (assignments.length === 0 || classes.length === 0) { setAnomalies([]); return; }

    const detected: DuplicateAnomaly[] = [];
    const active = assignments.filter(a => a.is_active);

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        if (a.item !== b.item) continue;
        if (!gendersOverlap(a.gender, b.gender)) continue;

        const overlapIds = (a.student_classes || []).filter(id => (b.student_classes || []).includes(id));
        if (overlapIds.length === 0) continue;

        const dupId = `dup-${a.id}-${b.id}`;
        if (typeof window !== 'undefined' && localStorage.getItem(`inv_anomaly_ignored_${dupId}`)) continue;

        const classNames = Array.from(new Set(groupConfigsByClass(overlapIds, classes).map(g => g.className)));
        detected.push({ id: dupId, a, b, classNames });
      }
    }

    setAnomalies(detected);
  }, [assignments, classes]);

  const ignoreAnomaly = (id: string) => {
    localStorage.setItem(`inv_anomaly_ignored_${id}`, 'true');
    setAnomalies(prev => {
      const next = prev.filter(a => a.id !== id);
      if (next.length === 0) setShowAnomaliesModal(false);
      return next;
    });
  };

  const purgeAnomalyIgnores = (assignmentId: number) => {
    try {
      Object.keys(localStorage).forEach(k => {
        if (!k.startsWith('inv_anomaly_ignored_dup-')) return;
        if (k.includes(`-${assignmentId}-`) || k.endsWith(`-${assignmentId}`)) {
          localStorage.removeItem(k);
        }
      });
    } catch { /* ignore storage access issues */ }
  };

  // ── Form Effects ──
  useEffect(() => {
    if (typeof view === 'object' && view.mode === 'edit') {
      const a = view.assignment;
      setTitle(a.title || '');
      setSelectedItem(a.item.toString());
      setSelectedItemLabel(a.item_name || `Item #${a.item}`);
      setQuantityPerStudent(a.quantity_per_student);
      setGender(a.gender);
      setIsMandatory(a.is_mandatory);
      setIsFree(a.is_free);
      setIsActive(a.is_active);
      setAcademicPeriod(a.academic_period ? a.academic_period.toString() : '');
      setNotes(a.notes || '');
      setSelectedConfigIds(a.student_classes || []);
    } else {
      setTitle(''); setSelectedItem(''); setSelectedItemLabel(''); setQuantityPerStudent('1'); setGender('both');
      setIsMandatory(false); setIsFree(true); setIsActive(true); setAcademicPeriod('');
      setNotes('');
      setSelectedConfigIds([]);
    }
    setClassSearch('');
    setExpandedScopeClasses([]);
    setDismissedLiveWarning(false);
  }, [view]);

  // ─── Selection Helpers ───
  const toggleRow = (id: number) => setExpandedRows(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleWholeClassToggle = (cls: ClassModel) => {
    const configIds = (cls.configurations || []).map(cfg => cfg.id);
    setSelectedConfigIds(prev => {
      const allSelected = configIds.length > 0 && configIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !configIds.includes(id));
      } else {
        return [...new Set([...prev, ...configIds])];
      }
    });
  };

  const handleConfigToggle = (configId: number) => {
    setSelectedConfigIds(prev =>
      prev.includes(configId) ? prev.filter(id => id !== configId) : [...prev, configId]
    );
  };

  const isWholeClassSelected = (cls: ClassModel): boolean => {
    const configIds = (cls.configurations || []).map(cfg => cfg.id);
    return configIds.length > 0 && configIds.every(id => selectedConfigIds.includes(id));
  };

  const hasPartialSelection = (cls: ClassModel): boolean => {
    const configIds = (cls.configurations || []).map(cfg => cfg.id);
    const selected = configIds.filter(id => selectedConfigIds.includes(id));
    return selected.length > 0 && selected.length < configIds.length;
  };

  const selectAllClasses = () => {
    const allConfigIds = classes.flatMap(c => (c.configurations || []).map(cfg => cfg.id));
    setSelectedConfigIds(allConfigIds);
  };

  const clearAllScopes = () => setSelectedConfigIds([]);

  // ── Live Duplicate Guard (in the form) ──
  const checkDuplicateConflicts = useCallback(() => {
    const itemId = parseInt(selectedItem);
    const editingId = typeof view === 'object' ? view.assignment.id : null;
    const conflicts: string[] = [];

    const existingForItem = assignments.filter(a => a.item === itemId && a.is_active && a.id !== editingId);

    for (const ex of existingForItem) {
      if (!gendersOverlap(gender, ex.gender)) continue;
      const overlapIds = selectedConfigIds.filter(id => (ex.student_classes || []).includes(id));
      if (overlapIds.length === 0) continue;
      const names = Array.from(new Set(groupConfigsByClass(overlapIds, classes).map(g => g.className)));
      conflicts.push(`Overlaps with "${ex.title || ex.item_name}" for ${names.join(', ')}.`);
    }
    return Array.from(new Set(conflicts));
  }, [selectedItem, gender, selectedConfigIds, assignments, view, classes]);

  useEffect(() => {
    if (!selectedItem || selectedConfigIds.length === 0) { setLiveConflicts([]); return; }
    const conflicts = checkDuplicateConflicts();
    setLiveConflicts(conflicts);
    if (conflicts.length > 0) setDismissedLiveWarning(false);
  }, [selectedItem, gender, selectedConfigIds, checkDuplicateConflicts]);

  // ── Submit ──
  const processSubmit = async (bypassWarning = false) => {
    if (!title.trim()) return showToast('error', 'Assignment title is required.');
    if (!selectedItem) return showToast('error', 'Select an item to assign.');
    if (!quantityPerStudent || parseFloat(quantityPerStudent) <= 0) return showToast('error', 'Quantity must be greater than zero.');
    if (selectedConfigIds.length === 0) return showToast('error', 'Select at least one class or arm.');

    if (!bypassWarning) {
      const conflicts = checkDuplicateConflicts();
      if (conflicts.length > 0) {
        setDuplicateModal({ open: true, conflicts });
        return;
      }
    }

    setIsSubmitting(true);
    setDuplicateModal({ open: false, conflicts: [] });
    try {
      const payload: any = {
        title: title.trim(),
        item: parseInt(selectedItem),
        quantity_per_student: quantityPerStudent,
        gender,
        is_mandatory: isMandatory,
        is_free: isFree,
        is_active: isActive,
        academic_period: academicPeriod ? parseInt(academicPeriod) : null,
        notes: notes || null,
        student_classes: selectedConfigIds,
      };

      if (typeof view === 'object' && view.mode === 'edit') {
        await inventoryAssignmentAPI.update(view.assignment.id, payload);
        showToast('success', 'Assignment updated successfully.');
      } else {
        await inventoryAssignmentAPI.create(payload);
        showToast('success', 'Assignment created successfully. Go to Generation Jobs to generate collections.');
      }
      await loadData();
      await fetchPagedAssignments();
      setView('list');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete ──
  const triggerDelete = async () => {
    if (!deleteModal.assignment) return;
    setIsSubmitting(true);
    try {
      await inventoryAssignmentAPI.delete(deleteModal.assignment.id);
      purgeAnomalyIgnores(deleteModal.assignment.id);
      await loadData();
      await fetchPagedAssignments();
      showToast('success', 'Assignment deleted successfully.');
      setDeleteModal({ open: false, assignment: null, isErrorMode: false, errorMsg: '' });
    } catch (err: any) {
      setDeleteModal(p => ({ ...p, isErrorMode: true, errorMsg: extractError(err) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render List View ──
  const renderListView = () => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="space-y-5 pb-12 max-w-6xl mx-auto animate-in fade-in duration-300">

        {/* Duplicate Anomaly Banner */}
        {anomalies.length > 0 && (
          <div className="border rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-4 bg-rose-50 border-rose-200">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-bold text-rose-900">
                  {anomalies.length} possible duplicate assignment{anomalies.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-rose-700">Active assignments issuing the same item to overlapping students are flagged here.</p>
              </div>
            </div>
            <button onClick={() => setShowAnomaliesModal(true)} className="whitespace-nowrap px-3.5 py-1.5 bg-white text-xs font-bold rounded-lg border text-rose-700 border-rose-200 hover:bg-rose-100 transition-colors">
              Review
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Assign Items</h1>
              <p className="text-xs text-slate-500 mt-0.5">Assign items to class arms for collection</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => router.push('/dashboard/staff/inventory/assignments/jobs')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
              <Activity className="h-4 w-4" /> Generation Jobs
            </button>
            {canManage && (
              <button onClick={() => setView('create')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                <Plus className="h-4 w-4" /> New Assignment
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex flex-col md:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or item name..." className={inputCls + ' pl-10 py-2'} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className={selectCls + ' py-2 w-full md:w-36'}>
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {tableLoading ? (
            <div className="p-14 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600 mb-3" />
              <p className="text-sm font-semibold">Loading assignments...</p>
            </div>
          ) : pagedAssignments.length === 0 ? (
            <div className="p-14 flex flex-col items-center justify-center text-slate-400">
              <Package className="h-8 w-8 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600">No assignments found</p>
              <p className="text-xs mt-1">Create a new assignment to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-3.5 pl-5 w-8"></th>
                    <th className="p-3.5">Title</th>
                    <th className="p-3.5">Item</th>
                    <th className="p-3.5 text-center">Qty / Student</th>
                    <th className="p-3.5 text-center">Type</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedAssignments.map(a => {
                    const isExpanded = expandedRows.includes(a.id);
                    const flagged = anomalies.some(an => an.a.id === a.id || an.b.id === a.id);
                    const groupedArms = isExpanded ? groupConfigsByClass(a.student_classes || [], classes) : [];
                    const periodName = a.academic_period ? periods.find(p => p.id === a.academic_period)?.name : null;

                    return (
                      <React.Fragment key={a.id}>
                        <tr onClick={() => toggleRow(a.id)} className={`group hover:bg-slate-50/80 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50' : ''}`}>
                          <td className="p-3.5 pl-5">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-cyan-600" />}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              {flagged && <span title="Flagged as a possible duplicate" className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
                              <p className="text-sm font-bold text-slate-900">{a.title || a.item_name || `Assignment #${a.id}`}</p>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="text-xs font-medium text-slate-600">{a.item_name || `Item #${a.item}`}</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{a.quantity_per_student}</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center flex-wrap gap-1.5">
                              {a.is_mandatory && <span className="text-[9px] font-bold uppercase bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">Mandatory</span>}
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${a.is_free ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {a.is_free ? 'Free' : 'Paid'}
                              </span>
                              <GenderBadge gender={a.gender} />
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${a.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${a.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {a.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="p-3.5 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              {canManage && (
                                <>
                                  <button onClick={() => setView({ mode: 'edit', assignment: a })} title="Edit" className="p-2 text-amber-600 hover:bg-amber-50 rounded-md">
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => setDeleteModal({ open: true, assignment: a, isErrorMode: false, errorMsg: '' })} title="Delete" className="p-2 text-rose-600 hover:bg-rose-50 rounded-md">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0 border-b border-slate-100">
                              <div className="bg-slate-50/60 p-5 border-l-2 border-cyan-500 space-y-4">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  {periodName && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-white border-slate-200 text-slate-600 font-bold">
                                      <CalendarClock className="h-3.5 w-3.5 text-slate-400" /> {periodName}
                                    </span>
                                  )}
                                  {!periodName && (
                                    <span className="italic text-slate-400">Applies every period (not term-specific)</span>
                                  )}
                                </div>

                                <div>
                                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Target Arms</h4>
                                  {groupedArms.length === 0 ? (
                                    <span className="text-xs italic text-slate-400">No arms assigned.</span>
                                  ) : (
                                    <div className="space-y-2">
                                      {groupedArms.map((g, idx) => (
                                        <div key={idx} className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-md p-2.5">
                                          <Users className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                                          <div>
                                            <span className="text-xs font-bold text-slate-800">{g.className}</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {g.arms.map((arm, ai) => (
                                                <span key={ai} className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">{arm}</span>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {a.notes && <p className="text-xs text-slate-500 italic">{a.notes}</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!tableLoading && pagedAssignments.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Page {page} of {totalPages} (Total: {total})</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Next</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render Form View ──
  const renderFormView = () => {
    const isEdit = typeof view === 'object' && view.mode === 'edit';
    const visibleClasses = classes.filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase()));

    return (
      <div className="max-w-6xl mx-auto space-y-5 pb-16 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3.5">
            <button onClick={() => setView('list')} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{isEdit ? 'Update' : 'Create'} Assignment</h1>
              <p className="text-xs text-slate-500">Assign an item to specific class arms.</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button onClick={() => setView('list')} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={() => processSubmit(false)} disabled={isSubmitting} className="flex-1 sm:flex-none px-5 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 flex items-center justify-center gap-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Assignment
            </button>
          </div>
        </div>

        {/* Live duplicate warning */}
        {liveConflicts.length > 0 && !dismissedLiveWarning && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-rose-900">Possible duplicate assignment ({liveConflicts.length})</p>
              <ul className="mt-1.5 space-y-1">
                {liveConflicts.map((c, i) => (
                  <li key={i} className="text-xs text-rose-800 flex items-start gap-1.5"><span className="mt-0.5">•</span><span>{c}</span></li>
                ))}
              </ul>
            </div>
            <button onClick={() => setDismissedLiveWarning(true)} className="p-1 text-rose-500 hover:text-rose-700 shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Left Col: Config */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <SectionHeader icon={<Info className="h-4 w-4" />} title="Assignment Details" />
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelCls}>Title <span className="text-rose-500">*</span></label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. JSS1 Mathematics Textbook" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Item <span className="text-rose-500">*</span></label>
                  <ItemSearchSelect
                    selectedLabel={selectedItemLabel}
                    onSelect={(item) => { setSelectedItem(item.id.toString()); setSelectedItemLabel(item.name); }}
                    disabled={isEdit}
                  />
                </div>
                <div>
                  <label className={labelCls}>Quantity Per Student <span className="text-rose-500">*</span></label>
                  <input type="number" min="0.01" step="0.01" value={quantityPerStudent} onChange={e => setQuantityPerStudent(e.target.value)} className={inputCls} placeholder="e.g. 1" />
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select value={gender} onChange={e => setGender(e.target.value as any)} className={selectCls}>
                    <option value="both">Both (All Students)</option>
                    <option value="male">Male Only</option>
                    <option value="female">Female Only</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Academic Period <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                  <select value={academicPeriod} onChange={e => setAcademicPeriod(e.target.value)} className={selectCls}>
                    <option value="">Every Period</option>
                    {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Leave blank to include this item whenever a generation job runs, regardless of term.</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Assignment Status</p>
                    <p className="text-[10px] text-slate-400">Disable without deleting</p>
                  </div>
                  <Toggle checked={isActive} onChange={setIsActive} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <SectionHeader icon={<Package className="h-4 w-4" />} title="Assignment Type" />
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Mandatory</p>
                    <p className="text-[10px] text-slate-400">Required for all students</p>
                  </div>
                  <Toggle checked={isMandatory} onChange={setIsMandatory} />
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Free Item</p>
                    <p className="text-[10px] text-slate-400">No payment required</p>
                  </div>
                  <Toggle checked={isFree} onChange={setIsFree} />
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Optional notes..." />
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Class Arms Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-100 flex flex-col h-[550px]">
              <SectionHeader icon={<Users className="h-4 w-4" />} title="Target Class Arms">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectAllClasses} className="px-2.5 py-1 bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase rounded-md hover:bg-cyan-100">Select All</button>
                  <button type="button" onClick={clearAllScopes} className="px-2.5 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold uppercase rounded-md hover:bg-slate-100">Clear</button>
                </div>
              </SectionHeader>

              <div className="px-5 pt-3.5 pb-3 border-b border-slate-100 bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input value={classSearch} onChange={e => setClassSearch(e.target.value)} placeholder="Filter classes by name..." className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
              </div>

              {/* 1 col on mobile, 2 on small/tablet, 3 on laptop+ — a fixed 2-up grid
                  wasted horizontal space on wider screens */}
              <div className="p-3.5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {visibleClasses.map(cls => {
                    const configs = cls.configurations || [];
                    const wholeSelected = isWholeClassSelected(cls);
                    const partialSelected = hasPartialSelection(cls);
                    const hasSelection = wholeSelected || partialSelected;
                    const isExpanded = expandedScopeClasses.includes(cls.id) || partialSelected;

                    return (
                      <div key={cls.id} className={`border rounded-lg p-2.5 transition-colors bg-white ${hasSelection ? 'border-cyan-300 ring-1 ring-cyan-100' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 text-xs truncate" title={cls.name}>{cls.name}</span>
                          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${wholeSelected ? 'text-cyan-600' : partialSelected ? 'text-amber-600' : 'text-slate-400'}`}>
                              {wholeSelected ? 'All Arms' : partialSelected ? 'Partial' : 'Select All Arms'}
                            </span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${wholeSelected ? 'bg-cyan-600 border-cyan-600' : 'bg-slate-50 border-slate-300'}`}>
                              {wholeSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={wholeSelected} onChange={() => handleWholeClassToggle(cls)} />
                          </label>
                        </div>

                        {!wholeSelected && configs.length > 0 && (
                          !isExpanded ? (
                            <button type="button" onClick={() => setExpandedScopeClasses(p => [...p, cls.id])}
                              className="mt-2 text-[10px] font-bold text-cyan-600 hover:text-cyan-700 transition-colors">
                              + Pick specific arms ({configs.length})
                            </button>
                          ) : (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                              {configs.map(cfg => {
                                const isSelected = selectedConfigIds.includes(cfg.id);
                                return (
                                  <button key={cfg.id} type="button" onClick={() => handleConfigToggle(cfg.id)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors border ${isSelected ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-white border-slate-200 text-slate-500 hover:border-cyan-300'}`}>
                                    {cfg.class_section_name || `Arm ${cfg.id}`}
                                  </button>
                                );
                              })}
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 bg-white flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Arms</span>
                <span className="text-xs font-black text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md">{selectedConfigIds.length} Selected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <ToastStack toasts={toasts} onRemove={id => setToasts(p => p.filter(t => t.id !== id))} />
      {view === 'list' ? renderListView() : renderFormView()}

      {/* Delete Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-4 ${deleteModal.isErrorMode ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
              <Ban className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">{deleteModal.isErrorMode ? 'Action Restricted' : 'Delete Assignment'}</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              {deleteModal.isErrorMode ? deleteModal.errorMsg : `Are you sure you want to delete this assignment? This cannot be undone.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ open: false, assignment: null, isErrorMode: false, errorMsg: '' })} className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200">
                {deleteModal.isErrorMode ? 'Understood' : 'Cancel'}
              </button>
              {!deleteModal.isErrorMode && (
                <button onClick={triggerDelete} disabled={isSubmitting} className="flex-1 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Guard (submit-time, blocking) */}
      {duplicateModal.open && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-rose-600 px-5 py-4 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-white" />
              <h3 className="text-base font-bold text-white">Potential Duplicate Assignment</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                You are assigning this item to arms that overlap with an existing active assignment for the same item and overlapping gender targeting. This may issue the item to the same students twice.
              </p>
              <div className="bg-rose-50 border border-rose-100 rounded-lg p-3.5 max-h-48 overflow-y-auto mb-5">
                <ul className="space-y-2">
                  {duplicateModal.conflicts.map((c, i) => (
                    <li key={i} className="text-xs font-semibold text-rose-800 flex items-start gap-2">
                      <span className="mt-0.5">•</span> <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDuplicateModal({ open: false, conflicts: [] })} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">Review Arms</button>
                <button onClick={() => processSubmit(true)} className="flex-1 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 flex items-center justify-center gap-2">I Understand, Proceed</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anomaly Review Modal */}
      {showAnomaliesModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-600" /> Duplicate Assignments</h3>
              <button onClick={() => setShowAnomaliesModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
              {anomalies.map((an) => (
                <div key={an.id} className="bg-white border border-rose-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded mb-1.5">
                        <Copy className="h-3 w-3" /> Possible duplicate
                      </span>
                      <p className="text-sm font-bold text-slate-800">{an.a.item_name || `Item #${an.a.item}`}</p>
                      <p className="text-xs text-slate-500">"{an.a.title}" and "{an.b.title}" both target overlapping students</p>
                    </div>
                    <button onClick={() => ignoreAnomaly(an.id)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap">Ignore</button>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-md flex flex-wrap gap-1.5">
                    {an.classNames.map((cname, i) => (
                      <span key={i} className="text-xs font-bold text-rose-800 bg-white border border-rose-200 px-2 py-0.5 rounded">{cname}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}