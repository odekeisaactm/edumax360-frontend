'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api, feeAPI, academicCalendarAPI, academicAPI } from '@/lib/api';
import { FeeStructure, Fee, FeeGroup, ClassModel, ClassSection, AcademicSessionPeriod, Discount } from '@/lib/types';
import {
  Layers, Plus, Edit2, Trash2, Check, X, AlertCircle,
  Loader2, Search, ArrowLeft, Settings, Users, Info,
  ChevronDown, ChevronUp, FolderOpen, Tag, Ban, Calculator, ShieldAlert, Copy
} from 'lucide-react';

// ─── Constants & UI Helpers ───────────────────────────────────────────────────
// Single accent (cyan) instead of the old blue→indigo gradient soup. Functional
// colors (emerald/rose/amber) are reserved for status/severity only, never decoration.

const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5';
const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white transition-all';
const selectCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white transition-all appearance-none';

const PAGE_SIZE = 20;

const fmtMoney = (v: string | number = 0) => `₦${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

function extractError(err: any): string {
  if (err?.response?.data?.detail) return err.response.data.detail;
  return err?.message || 'An unexpected error occurred';
}

function SectionHeader({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode; }) {
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

// ─── Toasts ───────────────────────────────────────────────────────────────────

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

// ─── Searchable Select ────────────────────────────────────────────────────────
// Drop-in replacement for a plain <select> when the option list is fully loaded
// (not paginated) but may be long enough that scrolling a native dropdown is
// painful. Filtering happens entirely client-side against `options`, so it
// requires the FULL list to already be in memory — see loadData() below, which
// now loads every fee/group instead of just the first page.

interface ComboOption { value: string; label: string; }

function SearchableSelect({
  options, value, onChange, placeholder = 'Select...', disabled = false,
}: { options: ComboOption[]; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUp: false });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const computeCoords = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = 260; // rough max height of the panel (search bar + list)
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    setCoords({
      top: openUp ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      openUp,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    computeCoords();
    const onScrollOrResize = () => computeCoords();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, computeCoords]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideWrapper = wrapperRef.current && wrapperRef.current.contains(target);
      const insideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      if (!insideWrapper && !insideDropdown) {
        setOpen(false); setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label;
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`${selectCls} text-left flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={`truncate ${selectedLabel ? 'text-slate-800' : 'text-slate-400'}`}>{selectedLabel || placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: coords.openUp ? undefined : coords.top + 6,
            bottom: coords.openUp ? window.innerHeight - coords.top + 6 : undefined,
            left: coords.left,
            width: coords.width,
          }}
          className="z-[100] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type to filter..."
                className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-xs text-slate-400 text-center">No matches</p>
            ) : filtered.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-cyan-50 flex items-center justify-between gap-2 transition-colors ${opt.value === value ? 'bg-cyan-50 font-semibold text-cyan-700' : 'text-slate-700'}`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <Check className="h-3.5 w-3.5 text-cyan-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Anomaly Types ──────────────────────────────────────────────────────────
// One unified scanner instead of two disconnected systems. "missing_arm" flags a
// single structure that covers some but not all sibling sections of a class.
// "double_billing" flags a PAIR of already-saved, active structures for the same
// fee whose scopes overlap — the persistent, list-level counterpart to the
// live/submit-time guard that only runs while the form is open.
//
// NOTE: both the scanner and the live guard deliberately run against the FULL,
// unpaginated structures list (`structures`), fetched once via loadData().
// The paginated `pagedStructures` state below is used ONLY to render the
// visible table rows — it must never be used for anomaly detection, or
// conflicts on other pages would silently stop being flagged.

type MissingArmAnomaly = {
  type: 'missing_arm';
  id: string;
  structure: FeeStructure;
  missing: { cls: ClassModel; missingSecs: ClassSection[] }[];
};
type DoubleBillingAnomaly = {
  type: 'double_billing';
  id: string;
  a: FeeStructure;
  b: FeeStructure;
  classNames: string[];
};
type Anomaly = MissingArmAnomaly | DoubleBillingAnomaly;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FeeStructuresPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastIdRef.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  // ── Full Dataset (used by anomaly scanner + live double-billing guard) ──
  const [loading, setLoading] = useState(true);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [groups, setGroups] = useState<FeeGroup[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);

  // ── Paginated Dataset (used ONLY to render the list-view table) ──
  const [pagedStructures, setPagedStructures] = useState<FeeStructure[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(true);

  // ── UI State ──
  const [view, setView] = useState<'list' | 'create' | { mode: 'edit'; structure: FeeStructure }>('list');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterOccurrence, setFilterOccurrence] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  // ── Form State ──
  const [selectedFee, setSelectedFee] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [scopes, setScopes] = useState<{ classId: number, sectionId: number | null }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classSearch, setClassSearch] = useState('');
  const [expandedScopeClasses, setExpandedScopeClasses] = useState<number[]>([]);

  // ── Live (pre-submit) double-billing warning ──
  const [liveConflicts, setLiveConflicts] = useState<string[]>([]);
  const [dismissedLiveWarning, setDismissedLiveWarning] = useState(false);

  // ── Modals State ──
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; struct: FeeStructure | null; isErrorMode: boolean; errorMsg: string }>({ open: false, struct: null, isErrorMode: false, errorMsg: '' });
  const [doubleBillingModal, setDoubleBillingModal] = useState<{ open: boolean; conflicts: string[] }>({ open: false, conflicts: [] });

  // ── Unified Anomalies State (list-level, persistent) ──
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [showAnomaliesModal, setShowAnomaliesModal] = useState(false);

  // ── Simulator State ──
  const [simulatorModal, setSimulatorModal] = useState(false);
  const [simPeriods, setSimPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [simDiscounts, setSimDiscounts] = useState<Discount[]>([]);
  const [simState, setSimState] = useState({ class_id: '', section_id: '', period_id: '', discount_ids: [] as number[] });
  const [simResults, setSimResults] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [discountsOpen, setDiscountsOpen] = useState(false);

  // Fees/Groups are reference/master data used to populate the "Fee Blueprint"
  // and "Financial Group" pickers in the create/edit form. The endpoint may
  // return either a plain array (already unpaginated) or a DRF-style paginated
  // object ({ results, count, next }) — previously we assumed the former and
  // just took whatever came back, which silently truncated to one page (20
  // items) whenever the backend paginated. This normalizes both shapes and, if
  // paginated, keeps following `next` until it's null, so the full set is
  // always loaded no matter the backend's page_size/max_page_size.
  const fetchAllPages = useCallback(async (initial: any): Promise<any[]> => {
    if (Array.isArray(initial)) return initial;
    let acc: any[] = initial?.results || [];
    let nextUrl: string | null = initial?.next || null;
    while (nextUrl) {
      const res = await api.get(nextUrl);
      acc = acc.concat(res.data?.results || []);
      nextUrl = res.data?.next || null;
    }
    return acc;
  }, []);

  // ── Load FULL dataset (reference data + all structures, for anomaly scanner) ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sData, fRaw, gRaw, cData, secData, pData] = await Promise.all([
        feeAPI.getFeeStructures(),
        feeAPI.getFees(),
        feeAPI.getFeeGroups(),
        academicAPI.listClasses({ is_active: true }),
        academicAPI.listClassSections(),
        academicCalendarAPI.listSessionPeriods({ is_current: true }),
      ]);
      const [fData, gData] = await Promise.all([fetchAllPages(fRaw), fetchAllPages(gRaw)]);
      setStructures(sData); setFees(fData); setGroups(gData); setClasses(cData); setSections(secData);

      // De-duplicate session-period rows down to one entry per underlying period.
      // The endpoint returns session-period junction rows, so if more than one
      // matches "current" (e.g. across sessions), the same period name can appear
      // more than once. Keep the first occurrence per period.id — same approach
      // the Discounts page already uses for its own period dropdown.
      const dedupedPeriods = Array.from(
        new Map(pData.map((p: any) => [p.period?.id ?? p.id, p])).values()
      );
      setSimPeriods(dedupedPeriods as AcademicSessionPeriod[]);

      // Try fetching discounts if the endpoint exists, otherwise fail gracefully
      try {
        const dData = await (feeAPI as any).getDiscounts();
        setSimDiscounts(dData);
      } catch (e) {
        console.warn("Discounts API not found yet. Skipping discounts for simulator.");
      }

    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast, fetchAllPages]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Fetch PAGINATED structures for the visible table ──
  const fetchPagedStructures = useCallback(async () => {
    setTableLoading(true);
    try {
      const response = await api.get('/api/fee/structures/', {
        params: {
          page,
          page_size: PAGE_SIZE,
          search: search.trim() || undefined,
          group: filterGroup !== 'all' ? filterGroup : undefined,
          is_active: filterStatus === 'all' ? undefined : filterStatus === 'active',
          fee__occurrence: filterOccurrence !== 'all' ? filterOccurrence : undefined,
        },
      });
      const resData = response.data;
      const data = resData.results || resData || [];
      const count = typeof resData.count === 'number' ? resData.count : data.length;
      setPagedStructures(data);
      setTotal(count);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setTableLoading(false);
    }
  }, [page, search, filterGroup, filterStatus, filterOccurrence, showToast]);

  // Reset to page 1 whenever a filter/search changes
  useEffect(() => { setPage(1); }, [search, filterGroup, filterStatus, filterOccurrence]);

  // Debounced fetch (same 400ms pattern as the Fee Types page)
  useEffect(() => {
    const handler = setTimeout(() => { fetchPagedStructures(); }, 400);
    return () => clearTimeout(handler);
  }, [fetchPagedStructures]);

  // ── Unified Anomaly Scanner ──
  // Runs against the FULL saved dataset (`structures`), not `pagedStructures`,
  // so it stays accurate regardless of which table page someone is looking at.
  useEffect(() => {
    if (structures.length === 0 || classes.length === 0 || sections.length === 0) { setAnomalies([]); return; }

    const detected: Anomaly[] = [];

    // 1) Missing-arm: a structure covers some but not all sibling sections of a class.
    structures.forEach(struct => {
      if (!struct.is_active || !struct.scopes) return;
      const armId = `arm-${struct.id}`;
      if (localStorage.getItem(`fee_anomaly_ignored_${armId}`)) return;

      const classMap: Record<number, (number | null)[]> = {};
      struct.scopes.forEach(sc => {
        if (!classMap[sc.student_class]) classMap[sc.student_class] = [];
        classMap[sc.student_class].push(sc.class_section);
      });

      const missingForStruct: { cls: ClassModel, missingSecs: ClassSection[] }[] = [];
      Object.keys(classMap).forEach(cidStr => {
        const cId = parseInt(cidStr);
        const assignedSections = classMap[cId];
        if (assignedSections.includes(null)) return;

        const cls = classes.find(c => c.id === cId);
        if (!cls) return;

        const availableSecs = sections.filter(sec => !sec.school_section || !cls.school_section || sec.school_section === cls.school_section);
        if (availableSecs.length > 0 && assignedSections.length < availableSecs.length) {
          const missing = availableSecs.filter(sec => !assignedSections.includes(sec.id));
          missingForStruct.push({ cls, missingSecs: missing });
        }
      });

      if (missingForStruct.length > 0) {
        detected.push({ type: 'missing_arm', id: armId, structure: struct, missing: missingForStruct });
      }
    });

    // 2) Double-billing: two active, saved structures for the SAME fee whose
    // scopes overlap. This is the persistent counterpart to the live guard in
    // the create/edit form — that one only ever fires while someone is actively
    // building a new structure, so conflicts between two already-saved
    // structures (edited independently, or created before the conflict existed)
    // never surfaced anywhere. Now they do, right here on the list.
    const activeStructures = structures.filter(s => s.is_active);
    for (let i = 0; i < activeStructures.length; i++) {
      for (let j = i + 1; j < activeStructures.length; j++) {
        const a = activeStructures[i];
        const b = activeStructures[j];
        if (a.fee !== b.fee) continue;

        const billId = `bill-${a.id}-${b.id}`;
        if (localStorage.getItem(`fee_anomaly_ignored_${billId}`)) continue;

        const overlapNames = new Set<string>();
        (a.scopes || []).forEach(sa => {
          (b.scopes || []).forEach(sb => {
            if (sa.student_class !== sb.student_class) return;
            if (sa.class_section === null || sb.class_section === null || sa.class_section === sb.class_section) {
              overlapNames.add(classes.find(c => c.id === sa.student_class)?.name || 'Unknown class');
            }
          });
        });

        if (overlapNames.size > 0) {
          detected.push({ type: 'double_billing', id: billId, a, b, classNames: Array.from(overlapNames) });
        }
      }
    }

    setAnomalies(detected);
  }, [structures, classes, sections]);

  const ignoreAnomaly = (id: string) => {
    localStorage.setItem(`fee_anomaly_ignored_${id}`, 'true');
    setAnomalies(prev => {
      const next = prev.filter(a => a.id !== id);
      if (next.length === 0) setShowAnomaliesModal(false);
      return next;
    });
  };

  // Clears any lingering ignore-flags tied to a deleted structure so localStorage
  // doesn't accumulate keys for records that no longer exist.
  const purgeAnomalyIgnores = (structureId: number) => {
    try {
      localStorage.removeItem(`fee_anomaly_ignored_arm-${structureId}`);
      Object.keys(localStorage).forEach(k => {
        if (!k.startsWith('fee_anomaly_ignored_bill-')) return;
        if (k.includes(`-${structureId}-`) || k.endsWith(`-${structureId}`)) {
          localStorage.removeItem(k);
        }
      });
    } catch { /* ignore storage access issues */ }
  };

  // ── Form Effect ──
  useEffect(() => {
    if (typeof view === 'object' && view.mode === 'edit') {
      const s = view.structure;
      setSelectedFee(s.fee.toString());
      setSelectedGroup(s.group.toString());
      setIsActive(s.is_active);
      setScopes(s.scopes?.map(sc => ({ classId: sc.student_class, sectionId: sc.class_section })) || []);
    } else {
      setSelectedFee(''); setSelectedGroup(''); setScopes([]); setIsActive(true);
    }
    setClassSearch(''); setExpandedScopeClasses([]); setDismissedLiveWarning(false);
  }, [view]);

  // ── Scope Interaction ──
  const toggleRow = (id: number) => setExpandedRows(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const handleWholeClassToggle = (classId: number) => {
    setScopes(prev => {
      if (prev.some(s => s.classId === classId && s.sectionId === null)) return prev.filter(s => s.classId !== classId);
      return [...prev.filter(s => s.classId !== classId), { classId, sectionId: null }];
    });
  };
  const handleSectionToggle = (classId: number, sectionId: number) => {
    setScopes(prev => {
      let newScopes = prev.filter(s => !(s.classId === classId && s.sectionId === null));
      if (newScopes.some(s => s.classId === classId && s.sectionId === sectionId)) {
        return newScopes.filter(s => !(s.classId === classId && s.sectionId === sectionId));
      }
      return [...newScopes, { classId, sectionId }];
    });
  };
  const selectAllWholeClasses = () => setScopes(classes.map(c => ({ classId: c.id, sectionId: null })));
  const clearAllScopes = () => setScopes([]);

  // ── Double Billing Guard (live, in the form) ──
  const checkDoubleBilling = useCallback(() => {
    const feeId = parseInt(selectedFee);
    const conflicts: string[] = [];
    const editingId = typeof view === 'object' ? view.structure.id : null;

    const existingForFee = structures.filter(s => s.fee === feeId && s.is_active && s.id !== editingId);

    for (const newScope of scopes) {
      const cName = classes.find(c => c.id === newScope.classId)?.name || 'Class';
      const sName = newScope.sectionId ? sections.find(s => s.id === newScope.sectionId)?.name : 'All Arms';
      const scopeLabel = `${cName} (${sName})`;

      for (const exStruct of existingForFee) {
        for (const exScope of exStruct.scopes || []) {
          if (newScope.classId === exScope.student_class) {
            if (newScope.sectionId === null || exScope.class_section === null || newScope.sectionId === exScope.class_section) {
              const conflictGroup = groups.find(g => g.id === exStruct.group)?.name || 'Another Group';
              conflicts.push(`You assigned ${scopeLabel}, but this fee is already active for this class in group "${conflictGroup}".`);
            }
          }
        }
      }
    }
    return Array.from(new Set(conflicts));
  }, [selectedFee, scopes, structures, view, classes, sections, groups]);

  useEffect(() => {
    if (!selectedFee || scopes.length === 0) { setLiveConflicts([]); return; }
    const conflicts = checkDoubleBilling();
    setLiveConflicts(conflicts);
    if (conflicts.length > 0) setDismissedLiveWarning(false);
  }, [selectedFee, scopes, checkDoubleBilling]);

  const processSubmit = async (bypassWarning = false) => {
    if (!selectedFee || !selectedGroup) return showToast('error', 'Select both Fee Blueprint and Group.');
    if (scopes.length === 0) return showToast('error', 'Select at least one Class or Arm.');

    if (!bypassWarning) {
      const conflicts = checkDoubleBilling();
      if (conflicts.length > 0) {
        setDoubleBillingModal({ open: true, conflicts });
        return;
      }
    }

    setIsSubmitting(true);
    setDoubleBillingModal({ open: false, conflicts: [] });

    try {
      const payload = {
        fee: parseInt(selectedFee), group: parseInt(selectedGroup),
        scopes: scopes.map(s => ({ student_class: s.classId, class_section: s.sectionId })),
        is_active: isActive,
      };

      if (typeof view === 'object' && view.mode === 'edit') {
        const updated = await feeAPI.updateFeeStructure(view.structure.id, payload as any);
        setStructures(p => p.map(s => s.id === updated.id ? updated : s));
        fetchPagedStructures(); // keep visible table in sync with the edit
        showToast('success', 'Fee structure updated successfully.');
        setView('list');
      } else {
        const created = await feeAPI.createFeeStructure(payload as any);
        showToast('success', 'Structure created. Redirecting to set prices...');
        router.push(`/dashboard/staff/fee/fee-structures/${created.id}?new=true`);
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Safe Deletion ──
  const triggerDelete = async () => {
    if (!deleteModal.struct) return;
    setIsSubmitting(true);
    try {
      await feeAPI.deleteFeeStructure(deleteModal.struct.id);
      purgeAnomalyIgnores(deleteModal.struct.id);
      setStructures(p => p.filter(s => s.id !== deleteModal.struct!.id));
      fetchPagedStructures(); // keep visible table in sync with the deletion
      showToast('success', 'Structure deleted successfully.');
      setDeleteModal({ open: false, struct: null, isErrorMode: false, errorMsg: '' });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || extractError(err);
      if (err?.response?.status === 400 && msg.toLowerCase().includes('billed')) {
         setDeleteModal(p => ({ ...p, isErrorMode: true, errorMsg: msg }));
      } else {
         showToast('error', msg);
         setDeleteModal({ open: false, struct: null, isErrorMode: false, errorMsg: '' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Simulator ──
  const simClassId = simState.class_id ? parseInt(simState.class_id) : null;
  const applicableDiscounts = simClassId
    ? simDiscounts.filter(d => (d as any).applicable_classes?.includes(simClassId))
    : [];

  useEffect(() => {
    setSimState(p => ({
      ...p,
      discount_ids: p.discount_ids.filter(id => applicableDiscounts.some(d => d.id === id)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState.class_id]);

  const sortedSimPeriods = [...simPeriods].sort((a: any, b: any) => (a.period?.order ?? 0) - (b.period?.order ?? 0));

  const runSimulation = async () => {
    if (!simState.class_id || !simState.period_id) return showToast('error', 'Class and Period are required for simulation.');
    if (!(feeAPI as any).simulateFee) return showToast('error', 'Simulator endpoint not yet configured in api.ts');

    setSimLoading(true);
    try {
      const res = await (feeAPI as any).simulateFee({
        class_id: parseInt(simState.class_id),
        period_id: parseInt(simState.period_id),
        section_id: simState.section_id ? parseInt(simState.section_id) : undefined,
        discount_ids: simState.discount_ids
      });
      setSimResults(res);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSimLoading(false);
    }
  };


  // ============================================================================
  // RENDER: LIST VIEW
  // ============================================================================

  const renderListView = () => {
    // Filtering now happens server-side (see fetchPagedStructures params),
    // so pagedStructures is rendered directly — no client-side .filter() here.
    const severeCount = anomalies.filter(a => a.type === 'double_billing').length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="space-y-5 pb-12 max-w-6xl mx-auto animate-in fade-in duration-300">

        {/* Unified Anomaly Banner */}
        {anomalies.length > 0 && (
          <div className={`border rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-4 ${severeCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3">
              <ShieldAlert className={`h-4 w-4 shrink-0 ${severeCount > 0 ? 'text-rose-600' : 'text-amber-600'}`} />
              <div>
                <p className={`text-sm font-bold ${severeCount > 0 ? 'text-rose-900' : 'text-amber-900'}`}>
                  {anomalies.length} structure issue{anomalies.length !== 1 ? 's' : ''} to review
                  {severeCount > 0 && <span className="font-normal"> · {severeCount} possible double billing</span>}
                </p>
                <p className={`text-xs ${severeCount > 0 ? 'text-rose-700' : 'text-amber-700'}`}>Uneven arm coverage and overlapping active structures are flagged here as they're saved.</p>
              </div>
            </div>
            <button onClick={() => setShowAnomaliesModal(true)} className={`whitespace-nowrap px-3.5 py-1.5 bg-white text-xs font-bold rounded-lg border transition-colors ${severeCount > 0 ? 'text-rose-700 border-rose-200 hover:bg-rose-100' : 'text-amber-700 border-amber-200 hover:bg-amber-100'}`}>
              Review
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Fee Master</h1>
              <p className="text-xs text-slate-500 mt-0.5">Manage fee blueprints, scopes, and target classes</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
             <button onClick={() => setSimulatorModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
              <Calculator className="h-4 w-4 text-cyan-600" /> Simulator
            </button>
            {canManage && (
              <button onClick={() => setView('create')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                <Plus className="h-4 w-4" /> New Structure
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex flex-col md:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fee name or group..." className={inputCls + ' pl-10 py-2'} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className={selectCls + ' py-2 w-full md:w-36'}>
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className={selectCls + ' py-2 w-full md:w-44'}>
            <option value="all">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={filterOccurrence} onChange={e => setFilterOccurrence(e.target.value)} className={selectCls + ' py-2 w-full md:w-36'}>
            <option value="all">All Occurrences</option>
            <option value="periodic">Periodic</option>
            <option value="annually">Annually</option>
            <option value="one_time">One-Time</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {tableLoading ? (
             <div className="p-14 flex flex-col items-center justify-center text-slate-400">
               <Loader2 className="h-6 w-6 animate-spin text-cyan-600 mb-3" />
               <p className="text-sm font-semibold">Loading fee structures...</p>
             </div>
          ) : pagedStructures.length === 0 ? (
             <div className="p-14 flex flex-col items-center justify-center text-slate-400">
               <Layers className="h-8 w-8 text-slate-300 mb-3" />
               <p className="text-sm font-semibold text-slate-600">No structures found</p>
               <p className="text-xs mt-1">Adjust your filters or create a new fee structure.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-3.5 pl-5 w-8"></th>
                    <th className="p-3.5">Fee Blueprint</th>
                    <th className="p-3.5">Financial Group</th>
                    <th className="p-3.5">Occurrence</th>
                    <th className="p-3.5 text-center">Target Scope</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedStructures.map(s => {
                    const fee = fees.find(f => f.id === s.fee);
                    const group = groups.find(g => g.id === s.group);
                    const isExpanded = expandedRows.includes(s.id);
                    const flagged = anomalies.some(a =>
                      (a.type === 'missing_arm' && a.structure.id === s.id) ||
                      (a.type === 'double_billing' && (a.a.id === s.id || a.b.id === s.id))
                    );

                    return (
                      <React.Fragment key={s.id}>
                        <tr onClick={() => toggleRow(s.id)} className={`group hover:bg-slate-50/80 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50' : ''}`}>
                          <td className="p-3.5 pl-5">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-cyan-600" />}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              {flagged && <span title="Flagged in anomaly review" className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                              <div>
                                <p className="text-sm font-bold text-slate-900">{fee?.name || 'Unknown'}</p>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{fee?.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-md">
                               <FolderOpen className="h-3 w-3" /> {group?.name}
                            </span>
                          </td>
                          <td className="p-3.5">
                             <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${fee?.occurrence === 'periodic' ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-50 text-amber-700'}`}>
                               {fee?.occurrence.replace('_', ' ')}
                             </span>
                          </td>
                          <td className="p-3.5 text-center">
                             <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                               {s.scopes?.length || 0} Assign{(s.scopes?.length || 0) !== 1 ? 'ments' : 'ment'}
                             </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {s.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="p-3.5 pr-5 text-right">
                             <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                <button onClick={() => router.push(`/dashboard/staff/fee/fee-structures/${s.id}`)} title="Configure Prices" className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-md transition-colors">
                                   <Tag className="h-4 w-4" />
                                </button>
                                {canManage && (
                                  <>
                                    <button onClick={() => setView({ mode: 'edit', structure: s })} title="Edit Scopes" className="p-2 text-amber-600 hover:bg-amber-50 rounded-md transition-colors">
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => setDeleteModal({ open: true, struct: s, isErrorMode: false, errorMsg: '' })} title="Delete Structure" className="p-2 text-rose-600 hover:bg-rose-50 rounded-md transition-colors">
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
                              <div className="bg-slate-50/60 p-5 border-l-2 border-cyan-500">
                                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Targeted Scopes Detail</h4>
                                 <div className="flex flex-wrap gap-2">
                                    {!s.scopes || s.scopes.length === 0 ? <span className="text-xs italic text-slate-400">No classes assigned.</span> :
                                      s.scopes.map((sc, idx) => {
                                        const cName = classes.find(c => c.id === sc.student_class)?.name || 'Unknown Class';
                                        const sName = sc.class_section ? sections.find(sec => sec.id === sc.class_section)?.name : 'ALL ARMS';
                                        const isAll = !sc.class_section;
                                        return (
                                          <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold ${isAll ? 'bg-white border-cyan-200 text-cyan-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                                             <Users className={`h-3.5 w-3.5 ${isAll ? 'text-cyan-500' : 'text-slate-400'}`} />
                                             {cName} <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${isAll ? 'bg-cyan-100' : 'bg-slate-100'}`}>{sName}</span>
                                          </div>
                                        )
                                      })
                                    }
                                 </div>
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

          {/* ── Footer Pagination ── */}
          {!tableLoading && pagedStructures.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                Showing Page {page} of {totalPages} (Total: {total} record{total !== 1 ? 's' : ''})
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER: CREATE / EDIT VIEW
  // ============================================================================

  const renderFormView = () => {
    const isEdit = typeof view === 'object' && view.mode === 'edit';
    const canSubmit = !isSubmitting;
    const visibleClasses = classes.filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase()));

    return (
      <div className="max-w-6xl mx-auto space-y-5 pb-16 animate-in slide-in-from-bottom-4 duration-300">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3.5">
            <button onClick={() => setView('list')} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{isEdit ? 'Update' : 'Setup New'} Fee Structure</h1>
              <p className="text-xs text-slate-500">Link a fee blueprint to specific classes and sections.</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button onClick={() => setView('list')} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={() => processSubmit(false)} disabled={!canSubmit} className="flex-1 sm:flex-none px-5 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Assignment
            </button>
          </div>
        </div>

        {/* Live double-billing warning */}
        {liveConflicts.length > 0 && !dismissedLiveWarning && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-rose-900">Possible double billing ({liveConflicts.length})</p>
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
              <SectionHeader icon={<Settings className="h-4 w-4" />} title="Master Selection" />
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelCls}>Fee Blueprint <span className="text-rose-500">*</span></label>
                  <SearchableSelect
                    value={selectedFee}
                    onChange={setSelectedFee}
                    placeholder="Select Fee..."
                    options={fees.map(f => ({ value: f.id.toString(), label: `${f.name} (${f.code})` }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Financial Group <span className="text-rose-500">*</span></label>
                  <SearchableSelect
                    value={selectedGroup}
                    onChange={setSelectedGroup}
                    placeholder="Select Group..."
                    options={groups.map(g => ({ value: g.id.toString(), label: g.name }))}
                  />
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Structure Status</p>
                    <p className="text-[10px] text-slate-400">Toggle active state</p>
                  </div>
                  <Toggle checked={isActive} onChange={setIsActive} />
                </div>
              </div>
            </div>
            <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4 flex gap-2.5">
               <Info className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
               <p className="text-xs text-cyan-900 leading-relaxed">After saving, you'll be redirected to the <strong>Pricing Dashboard</strong> to assign the amounts for each term/period.</p>
            </div>
          </div>

          {/* Right Col: Scope Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-100 flex flex-col h-[600px]">
              <SectionHeader icon={<ShieldAlert className="h-4 w-4" />} title="Target Scopes (Classes & Arms)">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectAllWholeClasses} className="px-2.5 py-1 bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase rounded-md hover:bg-cyan-100 transition-colors">Select All</button>
                  <button type="button" onClick={clearAllScopes} className="px-2.5 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold uppercase rounded-md hover:bg-slate-100 transition-colors">Clear</button>
                </div>
              </SectionHeader>

              <div className="px-5 pt-3.5 pb-3 border-b border-slate-100 bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input value={classSearch} onChange={e => setClassSearch(e.target.value)} placeholder="Filter classes by name..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
              </div>

              <div className="p-3.5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                {classes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 italic gap-2 opacity-50">
                    <Users className="h-7 w-7" />
                    <p className="text-sm font-bold">No classes available</p>
                  </div>
                ) : visibleClasses.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <p className="text-sm font-bold">No classes match "{classSearch}"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {visibleClasses.map(cls => {
                      const isWholeClass = scopes.some(s => s.classId === cls.id && s.sectionId === null);
                      const classSections = sections.filter(sec => !sec.school_section || !cls.school_section || sec.school_section === cls.school_section);
                      const selectedSectionIds = scopes.filter(s => s.classId === cls.id && s.sectionId !== null).map(s => s.sectionId);
                      const hasSelection = isWholeClass || selectedSectionIds.length > 0;
                      const isExpanded = expandedScopeClasses.includes(cls.id) || selectedSectionIds.length > 0;

                      return (
                        <div key={cls.id} className={`border rounded-lg p-2.5 transition-colors bg-white ${hasSelection ? 'border-cyan-300 ring-1 ring-cyan-100' : 'border-slate-200'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 text-xs truncate" title={cls.name}>{cls.name}</span>
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0 group">
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${isWholeClass ? 'text-cyan-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Whole Class</span>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isWholeClass ? 'bg-cyan-600 border-cyan-600' : 'bg-slate-50 border-slate-300 group-hover:border-cyan-400'}`}>
                                {isWholeClass && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <input type="checkbox" className="hidden" checked={isWholeClass} onChange={() => handleWholeClassToggle(cls.id)} />
                            </label>
                          </div>

                          {!isWholeClass && classSections.length > 0 && (
                            !isExpanded ? (
                              <button type="button" onClick={() => setExpandedScopeClasses(p => [...p, cls.id])}
                                className="mt-2 text-[10px] font-bold text-cyan-600 hover:text-cyan-700 transition-colors">
                                + Assign specific arms
                              </button>
                            ) : (
                              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                                {classSections.map(sec => {
                                  const isSecSelected = selectedSectionIds.includes(sec.id);
                                  return (
                                    <button key={sec.id} type="button" onClick={() => handleSectionToggle(cls.id, sec.id)}
                                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors border ${isSecSelected ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-white border-slate-200 text-slate-500 hover:border-cyan-300 hover:text-cyan-600'}`}>
                                      {sec.name}
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
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 bg-white flex justify-between items-center">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Scopes</span>
                 <span className="text-xs font-black text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md">{scopes.length} Selected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // ROOT RENDER
  // ============================================================================

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
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">{deleteModal.isErrorMode ? 'Action Restricted' : 'Delete Structure'}</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              {deleteModal.isErrorMode ? deleteModal.errorMsg : `Are you sure you want to permanently delete this structure? This action cannot be undone.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ open: false, struct: null, isErrorMode: false, errorMsg: '' })} className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200">
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

      {/* Double Billing Guard (submit-time, blocking) */}
      {doubleBillingModal.open && (
         <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-rose-600 px-5 py-4 flex items-center gap-3">
               <ShieldAlert className="h-5 w-5 text-white" />
               <h3 className="text-base font-bold text-white">Potential Double Billing</h3>
            </div>
            <div className="p-5">
               <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                 You are assigning scopes that overlap with existing active structures for this same fee blueprint. This will cause the system to bill the student twice for the exact same item.
               </p>
               <div className="bg-rose-50 border border-rose-100 rounded-lg p-3.5 max-h-48 overflow-y-auto mb-5">
                 <ul className="space-y-2">
                   {doubleBillingModal.conflicts.map((c, i) => (
                     <li key={i} className="text-xs font-semibold text-rose-800 flex items-start gap-2">
                       <span className="mt-0.5">•</span> <span>{c}</span>
                     </li>
                   ))}
                 </ul>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setDoubleBillingModal({ open: false, conflicts: [] })} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">Review Scopes</button>
                 <button onClick={() => processSubmit(true)} className="flex-1 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 flex items-center justify-center gap-2">I Understand, Proceed</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Anomaly Review Modal */}
      {showAnomaliesModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-600" /> Structure Issues</h3>
              <button onClick={() => setShowAnomaliesModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
              {anomalies.map((a) => {
                if (a.type === 'missing_arm') {
                  const fname = fees.find(f => f.id === a.structure.fee)?.name;
                  return (
                    <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-4">
                       <div className="flex justify-between items-start mb-3">
                          <div>
                             <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded mb-1.5">
                               <Users className="h-3 w-3" /> Uneven arm coverage
                             </span>
                             <p className="text-sm font-bold text-slate-800">Fee: {fname}</p>
                             <p className="text-xs text-slate-500">Group: {groups.find(g => g.id === a.structure.group)?.name}</p>
                          </div>
                          <button onClick={() => ignoreAnomaly(a.id)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap">Ignore</button>
                       </div>
                       <div className="space-y-2">
                         {a.missing.map((m, j) => (
                           <div key={j} className="bg-amber-50 border border-amber-100 p-2.5 rounded-md flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-800">Class: {m.cls.name}</span>
                              <span className="text-xs font-medium text-amber-700 text-right">Missing: {m.missingSecs.map(x => x.name).join(', ')}</span>
                           </div>
                         ))}
                       </div>
                    </div>
                  );
                }

                // double_billing
                const feeName = fees.find(f => f.id === a.a.fee)?.name;
                const groupAName = groups.find(g => g.id === a.a.group)?.name;
                const groupBName = groups.find(g => g.id === a.b.group)?.name;
                return (
                  <div key={a.id} className="bg-white border border-rose-200 rounded-lg p-4">
                     <div className="flex justify-between items-start mb-3">
                        <div>
                           <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded mb-1.5">
                             <Copy className="h-3 w-3" /> Possible double billing
                           </span>
                           <p className="text-sm font-bold text-slate-800">Fee: {feeName}</p>
                           <p className="text-xs text-slate-500">"{groupAName}" and "{groupBName}" both bill the same class scope</p>
                        </div>
                        <button onClick={() => ignoreAnomaly(a.id)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap">Ignore</button>
                     </div>
                     <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-md flex flex-wrap gap-1.5">
                       {a.classNames.map((cname, i) => (
                         <span key={i} className="text-xs font-bold text-rose-800 bg-white border border-rose-200 px-2 py-0.5 rounded">{cname}</span>
                       ))}
                     </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      {simulatorModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95">
             <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 rounded-t-xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2"><Calculator className="h-4 w-4 text-cyan-400" /> Invoice Simulator</h3>
              <button onClick={() => { setSimulatorModal(false); setSimResults(null); }} className="p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
               <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>Select Class <span className="text-rose-500">*</span></label>
                    <select value={simState.class_id} onChange={e => setSimState(p => ({...p, class_id: e.target.value}))} className={selectCls}>
                      <option value="">Choose...</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Select Arm/Section <span className="text-slate-400 font-normal normal-case">(Optional)</span></label>
                    <select value={simState.section_id} onChange={e => setSimState(p => ({...p, section_id: e.target.value}))} className={selectCls}>
                      <option value="">Any / General</option>
                      {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Academic Term / Period <span className="text-rose-500">*</span></label>
                    <select value={simState.period_id} onChange={e => setSimState(p => ({...p, period_id: e.target.value}))} className={selectCls}>
                      <option value="">Choose Period...</option>
                      {sortedSimPeriods.map((p: any) => <option key={p.period.id} value={p.period.id.toString()}>{p.period.name}</option>)}
                    </select>
                  </div>

                  {simDiscounts.length > 0 && (
                    <div className="col-span-2 border border-slate-200 rounded-lg overflow-hidden">
                      <button type="button" onClick={() => setDiscountsOpen(o => !o)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                          Institutional Discounts {simClassId ? `(${applicableDiscounts.length} applicable)` : ''}
                        </span>
                        {discountsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </button>
                      {discountsOpen && (
                        <div className="p-3 max-h-40 overflow-y-auto space-y-2 bg-white border-t border-slate-100">
                          {!simClassId ? (
                            <p className="text-xs text-slate-400 italic">Select a class to see which discounts apply.</p>
                          ) : applicableDiscounts.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No discounts are configured for this class.</p>
                          ) : applicableDiscounts.map(d => (
                            <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={simState.discount_ids.includes(d.id)} onChange={e => {
                                 const arr = e.target.checked ? [...simState.discount_ids, d.id] : simState.discount_ids.filter(x => x !== d.id);
                                 setSimState(p => ({...p, discount_ids: arr}));
                              }} className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4" />
                              <span className="text-sm font-semibold text-slate-700">{d.title}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
               </div>

               <button onClick={runSimulation} disabled={simLoading} className="w-full py-2.5 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50">
                 {simLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Generate Preview
               </button>

               {/* Results Area */}
               {simResults && (
                 <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden animate-in fade-in">
                    <div className="bg-slate-50 border-b border-slate-200 p-3.5 text-center">
                       <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Expected Invoice Preview</p>
                    </div>
                    {simResults.items.length === 0 ? (
                       <div className="p-8 text-center text-slate-500 font-medium text-sm">No fees map to this specific configuration.</div>
                    ) : (
                      <table className="w-full text-sm">
                         <tbody className="divide-y divide-slate-100">
                           {simResults.items.map((item: any, i: number) => (
                             <tr key={i} className="bg-white">
                               <td className="p-3.5">
                                  <p className="font-bold text-slate-800">{item.fee_name}</p>
                                  <div className="flex gap-2 mt-1">
                                    <span className="text-[9px] uppercase font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.group_name}</span>
                                    {item.applied_discounts.map((d: string, di: number) => (
                                      <span key={di} className="text-[9px] uppercase font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">{d}</span>
                                    ))}
                                  </div>
                               </td>
                               <td className="p-3.5 text-right">
                                  {Number(item.discount_amount) > 0 && <p className="text-xs text-rose-500 line-through mb-0.5">{fmtMoney(item.base_amount)}</p>}
                                  <p className="font-black text-slate-900">{fmtMoney(item.final_amount)}</p>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                         <tfoot className="bg-slate-900 text-white font-black border-t border-slate-900">
                           <tr>
                             <td className="p-3.5 uppercase tracking-widest text-xs text-cyan-400">Total Billable</td>
                             <td className="p-3.5 text-right text-base">{fmtMoney(simResults.total_final)}</td>
                           </tr>
                         </tfoot>
                      </table>
                    )}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}