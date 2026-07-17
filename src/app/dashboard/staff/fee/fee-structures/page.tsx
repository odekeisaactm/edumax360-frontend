'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI, academicAPI } from '@/lib/api';
import { FeeStructure, Fee, FeeGroup, ClassModel, ClassSection, AcademicSessionPeriod, Discount } from '@/lib/types';
import {
  Layers, Plus, Edit2, Trash2, Check, X, AlertCircle,
  Loader2, Search, ArrowLeft, Settings, Users, Info,
  LayoutGrid, AlertTriangle, ShieldCheck, PlayCircle,
  ChevronDown, ChevronUp, FolderOpen, Tag, Ban, Calculator, ShieldAlert
} from 'lucide-react';

// ─── Constants & UI Helpers ───────────────────────────────────────────────────

const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5';
const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white transition-all';
const selectCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white transition-all appearance-none';

const fmtMoney = (v: string | number = 0) => `₦${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

function extractError(err: any): string {
  if (err?.response?.data?.detail) return err.response.data.detail;
  return err?.message || 'An unexpected error occurred';
}

function SectionHeader({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode; }) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
      <h2 className="font-bold text-slate-800 flex items-center gap-2.5 text-sm uppercase tracking-wide">
        <span className="text-blue-500">{icon}</span>
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
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto animate-in slide-in-from-right-4 ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

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

  // ── Data State ──
  const [loading, setLoading] = useState(true);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [groups, setGroups] = useState<FeeGroup[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);

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

  // ── Anomalies State ──
  const [anomalies, setAnomalies] = useState<{ structure: FeeStructure; missing: { cls: ClassModel, missingSecs: ClassSection[] }[] }[]>([]);
  const [showAnomaliesModal, setShowAnomaliesModal] = useState(false);

  // ── Simulator State ──
  const [simulatorModal, setSimulatorModal] = useState(false);
  const [simPeriods, setSimPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [simDiscounts, setSimDiscounts] = useState<Discount[]>([]);
  const [simState, setSimState] = useState({ class_id: '', section_id: '', period_id: '', discount_ids: [] as number[] });
  const [simResults, setSimResults] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [discountsOpen, setDiscountsOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sData, fData, gData, cData, secData, pData] = await Promise.all([
        feeAPI.getFeeStructures(),
        feeAPI.getFees(),
        feeAPI.getFeeGroups(),
        academicAPI.listClasses({ is_active: true }),
        academicAPI.listClassSections(),
        academicCalendarAPI.listSessionPeriods({ is_current: true }),
      ]);
      setStructures(sData); setFees(fData); setGroups(gData); setClasses(cData); setSections(secData);
      setSimPeriods(pData);

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
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Missing Arm Analyzer ──
  useEffect(() => {
    if (structures.length === 0 || classes.length === 0 || sections.length === 0) return;

    const detected: typeof anomalies = [];
    structures.forEach(struct => {
      if (!struct.is_active || !struct.scopes) return;
      if (localStorage.getItem(`fee_anomaly_ignored_${struct.id}`)) return;

      const classMap: Record<number, (number | null)[]> = {};
      struct.scopes.forEach(sc => {
        if (!classMap[sc.student_class]) classMap[sc.student_class] = [];
        classMap[sc.student_class].push(sc.class_section);
      });

      const missingForStruct: { cls: ClassModel, missingSecs: ClassSection[] }[] = [];

      Object.keys(classMap).forEach(cidStr => {
        const cId = parseInt(cidStr);
        const assignedSections = classMap[cId];
        if (assignedSections.includes(null)) return; // Whole class covered

        const cls = classes.find(c => c.id === cId);
        if (!cls) return;

        const availableSecs = sections.filter(sec => !sec.school_section || !cls.school_section || sec.school_section === cls.school_section);

        if (availableSecs.length > 0 && assignedSections.length < availableSecs.length) {
          const missing = availableSecs.filter(sec => !assignedSections.includes(sec.id));
          missingForStruct.push({ cls, missingSecs: missing });
        }
      });

      if (missingForStruct.length > 0) {
        detected.push({ structure: struct, missing: missingForStruct });
      }
    });
    setAnomalies(detected);
  }, [structures, classes, sections]);

  const ignoreAnomaly = (structId: number) => {
    localStorage.setItem(`fee_anomaly_ignored_${structId}`, 'true');
    setAnomalies(prev => prev.filter(a => a.structure.id !== structId));
    if (anomalies.length === 1) setShowAnomaliesModal(false);
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

  // ── Double Billing Guard ──
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

  // Live-check as the admin builds out scopes, so the warning shows up before
  // they ever reach Save — not just as a last-resort blocker at submit time.
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
      setStructures(p => p.filter(s => s.id !== deleteModal.struct!.id));
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
  // Discounts are only shown once a class is picked, and only the ones that
  // actually apply — matches DiscountService.apply_to_invoke, which requires
  // applicable_classes to be non-empty AND contain the class (empty means the
  // discount applies to nobody, not everybody).
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
    const filtered = structures.filter(s => {
      const f = fees.find(x => x.id === s.fee);
      const g = groups.find(x => x.id === s.group);

      let pass = true;
      if (search) pass = pass && ((f?.name.toLowerCase().includes(search.toLowerCase())) || (g?.name.toLowerCase().includes(search.toLowerCase())));
      if (filterStatus === 'active') pass = pass && s.is_active;
      if (filterStatus === 'inactive') pass = pass && !s.is_active;
      if (filterGroup !== 'all') pass = pass && s.group.toString() === filterGroup;
      if (filterOccurrence !== 'all') pass = pass && f?.occurrence === filterOccurrence;
      return pass;
    });

    return (
      <div className="space-y-6 pb-12 max-w-6xl mx-auto animate-in fade-in duration-300">

        {/* Missing Arm Banner */}
        {anomalies.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-rose-900">{anomalies.length} Potential Structure Anomalies Detected</p>
                <p className="text-xs text-rose-700">Some fees are assigned to specific sections, but sibling sections in the same class are left out.</p>
              </div>
            </div>
            <button onClick={() => setShowAnomaliesModal(true)} className="whitespace-nowrap px-4 py-2 bg-white text-rose-700 text-xs font-bold rounded-xl border border-rose-200 hover:bg-rose-100 transition-colors">
              Review Anomalies
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Fee Master</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Manage fee blueprints, scopes, and target classes</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <button onClick={() => setSimulatorModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm">
              <Calculator className="h-4 w-4 text-blue-600" /> Invoice Simulator
            </button>
            {canManage && (
              <button onClick={() => setView('create')}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm">
                <Plus className="h-4 w-4" /> Create Structure
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fee name or group..." className={inputCls + ' pl-10 py-2.5'} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className={selectCls + ' py-2.5 w-full md:w-40'}>
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className={selectCls + ' py-2.5 w-full md:w-48'}>
            <option value="all">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={filterOccurrence} onChange={e => setFilterOccurrence(e.target.value)} className={selectCls + ' py-2.5 w-full md:w-40'}>
            <option value="all">All Occurrences</option>
            <option value="periodic">Periodic</option>
            <option value="annually">Annually</option>
            <option value="one_time">One-Time</option>
          </select>
        </div>

        {/* Accordion Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
             <div className="p-16 flex flex-col items-center justify-center text-slate-400">
               <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
               <p className="text-sm font-bold">Loading Master Ledger...</p>
             </div>
          ) : filtered.length === 0 ? (
             <div className="p-16 flex flex-col items-center justify-center text-slate-400">
               <Layers className="h-10 w-10 text-slate-300 mb-4" />
               <p className="text-base font-bold text-slate-600">No structures found</p>
               <p className="text-sm mt-1">Adjust your filters or create a new fee structure.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-4 pl-6 w-8"></th>
                    <th className="p-4">Fee Blueprint</th>
                    <th className="p-4">Financial Group</th>
                    <th className="p-4">Occurrence</th>
                    <th className="p-4 text-center">Target Scope</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(s => {
                    const fee = fees.find(f => f.id === s.fee);
                    const group = groups.find(g => g.id === s.group);
                    const isExpanded = expandedRows.includes(s.id);

                    return (
                      <React.Fragment key={s.id}>
                        <tr onClick={() => toggleRow(s.id)} className={`group hover:bg-slate-50/80 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50' : ''}`}>
                          <td className="p-4 pl-6">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />}
                          </td>
                          <td className="p-4">
                            <p className="text-sm font-extrabold text-slate-900">{fee?.name || 'Unknown'}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{fee?.code}</p>
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-200">
                               <FolderOpen className="h-3 w-3 text-slate-500" /> {group?.name}
                            </span>
                          </td>
                          <td className="p-4">
                             <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${fee?.occurrence === 'periodic' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                               {fee?.occurrence.replace('_', ' ')}
                             </span>
                          </td>
                          <td className="p-4 text-center">
                             <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                               {s.scopes?.length || 0} Assign{(s.scopes?.length || 0) !== 1 ? 'ments' : 'ment'}
                             </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {s.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="p-4 pr-6 text-right">
                             <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                <button onClick={() => router.push(`/dashboard/staff/fee/fee-structures/${s.id}`)} title="Configure Prices" className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                                   <Tag className="h-4 w-4" />
                                </button>
                                {canManage && (
                                  <>
                                    <button onClick={() => setView({ mode: 'edit', structure: s })} title="Edit Scopes" className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors">
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => setDeleteModal({ open: true, struct: s, isErrorMode: false, errorMsg: '' })} title="Delete Structure" className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                             </div>
                          </td>
                        </tr>
                        {/* Expanded Dropdown */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0 border-b border-slate-100">
                              <div className="bg-slate-50/50 p-6 border-l-4 border-blue-500 shadow-inner">
                                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Targeted Scopes Detail</h4>
                                 <div className="flex flex-wrap gap-2">
                                    {!s.scopes || s.scopes.length === 0 ? <span className="text-xs italic text-slate-400">No classes assigned.</span> :
                                      s.scopes.map((sc, idx) => {
                                        const cName = classes.find(c => c.id === sc.student_class)?.name || 'Unknown Class';
                                        const sName = sc.class_section ? sections.find(sec => sec.id === sc.class_section)?.name : 'ALL ARMS';
                                        const isAll = !sc.class_section;
                                        return (
                                          <div key={idx} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm ${isAll ? 'bg-white border-blue-200 text-blue-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                                             <Users className={`h-3.5 w-3.5 ${isAll ? 'text-blue-500' : 'text-slate-400'}`} />
                                             {cName} <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${isAll ? 'bg-blue-100' : 'bg-slate-100'}`}>{sName}</span>
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
      <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-in slide-in-from-bottom-4 duration-300">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 border border-transparent rounded-xl transition-all">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{isEdit ? 'Update' : 'Setup New'} Fee Structure</h1>
              <p className="text-xs text-slate-500 font-medium">Link a fee blueprint to specific classes and sections.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => setView('list')} className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">Cancel</button>
            <button onClick={() => processSubmit(false)} disabled={!canSubmit} className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Assignment
            </button>
          </div>
        </div>

        {/* Live double-billing warning — dismissible, resurfaces if the conflict set changes */}
        {liveConflicts.length > 0 && !dismissedLiveWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">Possible double billing ({liveConflicts.length})</p>
              <ul className="mt-1.5 space-y-1">
                {liveConflicts.map((c, i) => (
                  <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5"><span className="mt-0.5">•</span><span>{c}</span></li>
                ))}
              </ul>
            </div>
            <button onClick={() => setDismissedLiveWarning(true)} className="p-1 text-amber-500 hover:text-amber-700 shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left Col: Config */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <SectionHeader icon={<Settings className="h-4 w-4" />} title="Master Selection" />
              <div className="p-6 space-y-5">
                <div>
                  <label className={labelCls}>Fee Blueprint <span className="text-rose-500">*</span></label>
                  <select value={selectedFee} onChange={e => setSelectedFee(e.target.value)} className={selectCls}>
                    <option value="">Select Fee...</option>
                    {fees.map(f => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Financial Group <span className="text-rose-500">*</span></label>
                  <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className={selectCls}>
                    <option value="">Select Group...</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Structure Status</p>
                    <p className="text-[10px] text-slate-400 font-medium">Toggle active state</p>
                  </div>
                  <Toggle checked={isActive} onChange={setIsActive} />
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
               <Info className="h-5 w-5 text-blue-600 shrink-0" />
               <p className="text-xs text-blue-800 leading-relaxed font-medium">After saving this structure, you will be redirected to the <strong>Pricing Dashboard</strong> where you will assign the specific monetary amounts for each term/period.</p>
            </div>
          </div>

          {/* Right Col: Scope Selection — compact grid, search-filterable, sections collapsed by default */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[600px]">
              <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} title="Target Scopes (Classes & Arms)">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectAllWholeClasses} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded-lg hover:bg-blue-100 transition-colors border border-blue-100">Select All Classes</button>
                  <button type="button" onClick={clearAllScopes} className="px-3 py-1.5 bg-slate-50 text-slate-500 text-[10px] font-bold uppercase rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">Clear</button>
                </div>
              </SectionHeader>

              <div className="px-6 pt-4 pb-3 border-b border-slate-100 bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input value={classSearch} onChange={e => setClassSearch(e.target.value)} placeholder="Filter classes by name..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                {classes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 italic gap-2 opacity-50">
                    <Users className="h-8 w-8" />
                    <p className="text-sm font-bold">No classes available</p>
                  </div>
                ) : visibleClasses.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <p className="text-sm font-bold">No classes match "{classSearch}"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {visibleClasses.map(cls => {
                      const isWholeClass = scopes.some(s => s.classId === cls.id && s.sectionId === null);
                      const classSections = sections.filter(sec => !sec.school_section || !cls.school_section || sec.school_section === cls.school_section);
                      const selectedSectionIds = scopes.filter(s => s.classId === cls.id && s.sectionId !== null).map(s => s.sectionId);
                      const hasSelection = isWholeClass || selectedSectionIds.length > 0;
                      const isExpanded = expandedScopeClasses.includes(cls.id) || selectedSectionIds.length > 0;

                      return (
                        <div key={cls.id} className={`border rounded-xl p-3 transition-all bg-white ${hasSelection ? 'border-blue-300 shadow-sm ring-1 ring-blue-100' : 'border-slate-200'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 text-xs truncate" title={cls.name}>{cls.name}</span>
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0 group">
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${isWholeClass ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Whole Class</span>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isWholeClass ? 'bg-blue-600 border-blue-600' : 'bg-slate-50 border-slate-300 group-hover:border-blue-400'}`}>
                                {isWholeClass && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <input type="checkbox" className="hidden" checked={isWholeClass} onChange={() => handleWholeClassToggle(cls.id)} />
                            </label>
                          </div>

                          {!isWholeClass && classSections.length > 0 && (
                            !isExpanded ? (
                              <button type="button" onClick={() => setExpandedScopeClasses(p => [...p, cls.id])}
                                className="mt-2 text-[10px] font-bold text-blue-500 hover:text-blue-700 transition-colors">
                                + Assign specific arms
                              </button>
                            ) : (
                              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                                {classSections.map(sec => {
                                  const isSecSelected = selectedSectionIds.includes(sec.id);
                                  return (
                                    <button key={sec.id} type="button" onClick={() => handleSectionToggle(cls.id, sec.id)}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${isSecSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}>
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
              <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex justify-between items-center shadow-inner">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Scopes Count</span>
                 <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{scopes.length} Selected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // ROOT RENDER — main content + toasts + all modals, always mounted regardless
  // of which view (list / create / edit) is currently active.
  // ============================================================================

  return (
    <>
      <ToastStack toasts={toasts} onRemove={id => setToasts(p => p.filter(t => t.id !== id))} />

      {view === 'list' ? renderListView() : renderFormView()}

      {/* Delete Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border ${deleteModal.isErrorMode ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
               <Ban className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">{deleteModal.isErrorMode ? 'Action Restricted' : 'Delete Structure'}</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              {deleteModal.isErrorMode ? deleteModal.errorMsg : `Are you sure you want to permanently delete this structure? This action cannot be undone.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ open: false, struct: null, isErrorMode: false, errorMsg: '' })} className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200">
                {deleteModal.isErrorMode ? 'Understood' : 'Cancel'}
              </button>
              {!deleteModal.isErrorMode && (
                <button onClick={triggerDelete} disabled={isSubmitting} className="flex-1 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 flex items-center justify-center gap-2">
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
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-rose-600 p-5 flex items-center gap-3">
               <AlertTriangle className="h-6 w-6 text-white" />
               <h3 className="text-lg font-bold text-white">Potential Double Billing</h3>
            </div>
            <div className="p-6">
               <p className="text-sm text-slate-600 font-medium mb-4 leading-relaxed">
                 You are assigning scopes that overlap with existing active structures for this same fee blueprint. This will cause the system to bill the student twice for the exact same item.
               </p>
               <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 max-h-48 overflow-y-auto mb-6">
                 <ul className="space-y-2">
                   {doubleBillingModal.conflicts.map((c, i) => (
                     <li key={i} className="text-xs font-bold text-rose-800 flex items-start gap-2">
                       <span className="mt-0.5">•</span> <span>{c}</span>
                     </li>
                   ))}
                 </ul>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setDoubleBillingModal({ open: false, conflicts: [] })} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50">Review Scopes</button>
                 <button onClick={() => processSubmit(true)} className="flex-1 py-3 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 flex items-center justify-center gap-2">I Understand, Proceed</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Anomaly Analyzer Modal */}
      {showAnomaliesModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-600" /> Structure Anomalies</h3>
              <button onClick={() => setShowAnomaliesModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
              {anomalies.map((a, i) => {
                const fname = fees.find(f => f.id === a.structure.fee)?.name;
                return (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                     <div className="flex justify-between items-start mb-4">
                        <div>
                           <p className="text-sm font-bold text-slate-800">Fee: {fname}</p>
                           <p className="text-xs text-slate-500">Group: {groups.find(g=>g.id===a.structure.group)?.name}</p>
                        </div>
                        <button onClick={() => ignoreAnomaly(a.structure.id)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">Ignore Issue</button>
                     </div>
                     <div className="space-y-3">
                       {a.missing.map((m, j) => (
                         <div key={j} className="bg-rose-50 border border-rose-100 p-3 rounded-lg flex items-center justify-between">
                            <span className="text-xs font-bold text-rose-800">Class: {m.cls.name}</span>
                            <span className="text-xs font-medium text-rose-600 text-right">Missing Arms: {m.missingSecs.map(x=>x.name).join(', ')}</span>
                         </div>
                       ))}
                     </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      {simulatorModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 rounded-t-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Calculator className="h-5 w-5 text-blue-400" /> Invoice Simulator</h3>
              <button onClick={() => { setSimulatorModal(false); setSimResults(null); }} className="p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="grid grid-cols-2 gap-4">
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
                      {sortedSimPeriods.map((p: any) => <option key={p.id} value={p.period.id.toString()}>{p.period.name}</option>)}
                    </select>
                  </div>

                  {simDiscounts.length > 0 && (
                    <div className="col-span-2 border border-slate-200 rounded-xl overflow-hidden">
                      <button type="button" onClick={() => setDiscountsOpen(o => !o)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
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
                              }} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                              <span className="text-sm font-bold text-slate-700">{d.title}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
               </div>

               <button onClick={runSimulation} disabled={simLoading} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md shadow-blue-200 hover:bg-blue-700 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                 {simLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-5 w-5" />} Generate Preview
               </button>

               {/* Results Area */}
               {simResults && (
                 <div className="mt-8 border border-slate-200 rounded-2xl overflow-hidden animate-in fade-in">
                    <div className="bg-slate-50 border-b border-slate-200 p-4 text-center">
                       <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Expected Invoice Preview</p>
                    </div>
                    {simResults.items.length === 0 ? (
                       <div className="p-8 text-center text-slate-500 font-medium">No fees map to this specific configuration.</div>
                    ) : (
                      <table className="w-full text-sm">
                         <tbody className="divide-y divide-slate-100">
                           {simResults.items.map((item: any, i: number) => (
                             <tr key={i} className="bg-white">
                               <td className="p-4">
                                  <p className="font-bold text-slate-800">{item.fee_name}</p>
                                  <div className="flex gap-2 mt-1">
                                    <span className="text-[9px] uppercase font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.group_name}</span>
                                    {item.applied_discounts.map((d: string, di: number) => (
                                      <span key={di} className="text-[9px] uppercase font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">{d}</span>
                                    ))}
                                  </div>
                               </td>
                               <td className="p-4 text-right">
                                  {Number(item.discount_amount) > 0 && <p className="text-xs text-rose-500 line-through mb-0.5">{fmtMoney(item.base_amount)}</p>}
                                  <p className="font-black text-slate-900">{fmtMoney(item.final_amount)}</p>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                         <tfoot className="bg-slate-900 text-white font-black border-t border-slate-900">
                           <tr>
                             <td className="p-4 uppercase tracking-widest text-xs text-blue-400">Total Billable</td>
                             <td className="p-4 text-right text-base">{fmtMoney(simResults.total_final)}</td>
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