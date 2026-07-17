'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicAPI, academicCalendarAPI } from '@/lib/api';
import { Discount, Fee, ClassModel, ClassSection, AcademicSessionPeriod } from '@/lib/types';
import {
  Tag, Plus, Edit2, Trash2, Check, X, AlertCircle,
  Loader2, Search, ArrowLeft, Settings, Users, Info,
  ChevronDown, ChevronUp, Ban, Percent, Hash, Layers, Eye, AlertTriangle, ShieldAlert
} from 'lucide-react';

// ─── Constants & UI Helpers ───────────────────────────────────────────────────

const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5';
const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white transition-all';
const selectCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white transition-all appearance-none';

const fmtMoney = (v: string | number = 0) => `₦${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const fmtPercent = (v: string | number = 0) => `${Number(v)}%`;

function extractError(err: any): string {
  if (err?.response?.data?.detail) return err.response.data.detail;
  return err?.message || 'An unexpected error occurred';
}

function SectionHeader({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode; }) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
      <h2 className="font-bold text-slate-800 flex items-center gap-2.5 text-sm uppercase tracking-wide">
        <span className="text-indigo-500">{icon}</span>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DiscountConfigurationsPage() {
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
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [blueprintPeriods, setBlueprintPeriods] = useState<{id: number, name: string}[]>([]);

  // ── UI State ──
  const [view, setView] = useState<'list' | 'create' | { mode: 'edit'; discount: Discount }>('list');
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  // ── Form State ──
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [occurrence, setOccurrence] = useState('periodic');
  const [paymentPeriod, setPaymentPeriod] = useState<string>('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [selectedFees, setSelectedFees] = useState<number[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [tierOverrides, setTierOverrides] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Modals State ──
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; discount: Discount | null; isErrorMode: boolean; errorMsg: string }>({ open: false, discount: null, isErrorMode: false, errorMsg: '' });
  const [previewModal, setPreviewModal] = useState(false);
  const [lowAmountWarning, setLowAmountWarning] = useState(false);

  // ── Overlap Guard (mirrors the Fee Structure double-billing guard) ──
  // Two discounts silently covering the same class + fee is the discount
  // equivalent of double billing: a student ends up stacked with concessions
  // nobody deliberately intended together. An empty applicable_fees list
  // means "all fees", same convention as a null class_section meaning "all arms".
  const [liveConflicts, setLiveConflicts] = useState<{ message: string; severe: boolean }[]>([]);
  const [dismissedLiveWarning, setDismissedLiveWarning] = useState(false);
  const [overlapModal, setOverlapModal] = useState<{ open: boolean; conflicts: { message: string; severe: boolean }[] }>({ open: false, conflicts: [] });

  // ── List-level Anomaly Scanner ──
  const [anomalies, setAnomalies] = useState<{ key: string; a: Discount; b: Discount; sharedClasses: string[]; severe: boolean }[]>([]);
  const [showAnomaliesModal, setShowAnomaliesModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dData, fData, cData, spData] = await Promise.all([
        feeAPI.getDiscounts ? feeAPI.getDiscounts() : (feeAPI as any).discounts.list(),
        feeAPI.getFees(),
        academicAPI.listClasses({ is_active: true }),
        academicCalendarAPI.listSessionPeriods({ is_current: true }),
      ]);
      setDiscounts(dData);
      setFees(fData);
      setClasses(cData);

      // Extract unique period blueprints for the dropdown
      const uniquePeriods = Array.from(new Map(spData.map((p: any) => [p.period?.id || p.period, p.period])).values());
      setBlueprintPeriods(uniquePeriods as any);

    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Cross-Discount Anomaly Scanner ──
  // Same idea as the Fee Structure "Missing Arm" scanner, but for discounts:
  // scans every pair of discounts for shared class + overlapping fee scope,
  // so overlaps that were never visible from a single edit screen (e.g. two
  // discounts created weeks apart by different admins) still surface.
  useEffect(() => {
    if (discounts.length < 2 || classes.length === 0) { setAnomalies([]); return; }

    const found: typeof anomalies = [];
    for (let i = 0; i < discounts.length; i++) {
      for (let j = i + 1; j < discounts.length; j++) {
        const a = discounts[i];
        const b = discounts[j];
        const key = `${a.id}-${b.id}`;
        if (localStorage.getItem(`discount_anomaly_ignored_${key}`)) continue;

        const aFeesEmpty = !a.applicable_fees || a.applicable_fees.length === 0;
        const bFeesEmpty = !b.applicable_fees || b.applicable_fees.length === 0;
        const feeOverlap = aFeesEmpty || bFeesEmpty || (a.applicable_fees || []).some(f => (b.applicable_fees || []).includes(f));
        if (!feeOverlap) continue;

        const sharedClassIds = (a.applicable_classes || []).filter(cid => (b.applicable_classes || []).includes(cid));
        if (sharedClassIds.length === 0) continue;

        const bothPercentage = a.discount_type === 'percentage' && b.discount_type === 'percentage';
        let severe = false;
        if (bothPercentage) {
          for (const cid of sharedClassIds) {
            const aTier = a.class_tiers?.find((t: any) => t.student_class === cid);
            const bTier = b.class_tiers?.find((t: any) => t.student_class === cid);
            const aRate = parseFloat((aTier ? aTier.tier_amount : a.amount) as any || '0');
            const bRate = parseFloat((bTier ? bTier.tier_amount : b.amount) as any || '0');
            if (aRate + bRate >= 100) { severe = true; break; }
          }
        }

        found.push({
          key,
          a, b,
          sharedClasses: sharedClassIds.map(cid => classes.find(c => c.id === cid)?.name || `Class #${cid}`),
          severe,
        });
      }
    }
    setAnomalies(found);
  }, [discounts, classes]);

  const ignoreAnomaly = (key: string) => {
    localStorage.setItem(`discount_anomaly_ignored_${key}`, 'true');
    setAnomalies(prev => prev.filter(a => a.key !== key));
  };

  // ── Form Effect ──
  useEffect(() => {
    if (typeof view === 'object' && view.mode === 'edit') {
      const d = view.discount;
      setTitle(d.title);
      setType(d.discount_type as 'percentage' | 'fixed');
      setOccurrence(d.occurrence);
      setPaymentPeriod(d.payment_period?.toString() || '');
      setDefaultAmount(d.amount || '');
      setSelectedFees(d.applicable_fees || []);
      setSelectedClasses(d.applicable_classes || []);

      const overrides: Record<number, string> = {};
      d.class_tiers?.forEach(tier => {
        overrides[tier.student_class] = tier.tier_amount;
      });
      setTierOverrides(overrides);
    } else {
      setTitle(''); setType('percentage'); setOccurrence('periodic'); setPaymentPeriod(''); setDefaultAmount('');
      setSelectedFees([]); setSelectedClasses([]); setTierOverrides({});
    }
    setDismissedLiveWarning(false);
  }, [view]);

  // ── Interactions ──
  const toggleRow = (id: number) => setExpandedRows(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleFeeToggle = (feeId: number) => setSelectedFees(p => p.includes(feeId) ? p.filter(id => id !== feeId) : [...p, feeId]);
  const selectAllFees = () => setSelectedFees(fees.map(f => f.id));
  const clearAllFees = () => setSelectedFees([]);

  const handleClassToggle = (classId: number) => {
    setSelectedClasses(p => {
      if (p.includes(classId)) {
        const next = p.filter(id => id !== classId);
        const newTiers = { ...tierOverrides };
        delete newTiers[classId];
        setTierOverrides(newTiers);
        return next;
      }
      return [...p, classId];
    });
  };
  const selectAllClasses = () => setSelectedClasses(classes.map(c => c.id));
  const clearAllClasses = () => { setSelectedClasses([]); setTierOverrides({}); };

  const handleTierChange = (classId: number, val: string) => {
    if (type === 'percentage' && parseFloat(val) > 100) return;
    if (val === '') {
      const newTiers = { ...tierOverrides };
      delete newTiers[classId];
      setTierOverrides(newTiers);
    } else {
      setTierOverrides(p => ({ ...p, [classId]: val }));
    }
  };

  // ── Overlap Detection ──
  // For each class this discount targets, find other discounts that already
  // cover that same class AND share fee scope (empty applicable_fees == ALL
  // fees, so it overlaps with anything). If both discounts are percentage-based,
  // also sum the effective rates for that class — a stack reaching 100%+ zeroes
  // out or goes negative on the invoice line, which is a hard financial bug,
  // not just an "FYI these overlap" notice, so it's flagged separately (severe).
  const checkOverlap = useCallback(() => {
    if (selectedClasses.length === 0) return [];
    const editingId = typeof view === 'object' ? view.discount.id : null;
    const others = discounts.filter(d => d.id !== editingId);
    const feesAEmpty = selectedFees.length === 0;
    const conflicts: { message: string; severe: boolean }[] = [];
    const seen = new Set<string>();

    for (const cid of selectedClasses) {
      const className = classes.find(c => c.id === cid)?.name || `Class #${cid}`;
      const myRate = parseFloat((tierOverrides[cid] ?? defaultAmount) || '0');

      for (const other of others) {
        if (!other.applicable_classes?.includes(cid)) continue;

        const feesBEmpty = !other.applicable_fees || other.applicable_fees.length === 0;
        const feeOverlap = feesAEmpty || feesBEmpty || selectedFees.some(f => other.applicable_fees!.includes(f));
        if (!feeOverlap) continue;

        const dedupeKey = `${cid}-${other.id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const otherTier = other.class_tiers?.find((t: any) => t.student_class === cid);
        const otherRate = parseFloat((otherTier ? otherTier.tier_amount : other.amount) as any || '0');
        const bothPercentage = type === 'percentage' && other.discount_type === 'percentage';
        const stacked = bothPercentage ? myRate + otherRate : null;
        const severe = stacked !== null && stacked >= 100;
        const scopeLabel = feesAEmpty || feesBEmpty ? 'an overlapping "all fees" scope' : 'shared fee(s)';

        if (severe) {
          conflicts.push({ message: `${className}: stacking with "${other.title}" totals ${stacked}% off — this fully (or over-) discounts the invoice.`, severe: true });
        } else {
          conflicts.push({ message: `${className} is already covered by "${other.title}" for ${scopeLabel}.`, severe: false });
        }
      }
    }
    return conflicts;
  }, [selectedClasses, selectedFees, tierOverrides, defaultAmount, type, discounts, view, classes]);

  // Live-check as the admin builds out the form, same pattern as the fee
  // structure's double-billing check — surfaces the warning well before Save.
  useEffect(() => {
    if (selectedClasses.length === 0) { setLiveConflicts([]); return; }
    const conflicts = checkOverlap();
    setLiveConflicts(conflicts);
    if (conflicts.length > 0) setDismissedLiveWarning(false);
  }, [selectedClasses, selectedFees, tierOverrides, defaultAmount, type, checkOverlap]);

  // ── Submit Logic ──
  const triggerSave = (bypassLowAmount = false, bypassOverlap = false) => {
    if (!title) return showToast('error', 'Discount title is required.');
    if (!defaultAmount || parseFloat(defaultAmount) <= 0) return showToast('error', 'Default amount must be greater than zero.');
    if (type === 'percentage' && parseFloat(defaultAmount) > 100) return showToast('error', 'Percentage cannot exceed 100%.');

    // Smart guardrail for suspiciously low fixed amounts
    if (!bypassLowAmount && type === 'fixed' && parseFloat(defaultAmount) <= 100) {
      setLowAmountWarning(true);
      return;
    }

    // Overlap guard — block on unresolved class+fee conflicts with other discounts
    if (!bypassOverlap) {
      const conflicts = checkOverlap();
      if (conflicts.length > 0) {
        setOverlapModal({ open: true, conflicts });
        return;
      }
    }

    executeSubmit();
  };

  const executeSubmit = async () => {
    setIsSubmitting(true);
    setLowAmountWarning(false);
    setOverlapModal({ open: false, conflicts: [] });
    try {
      const payload = {
        title,
        discount_type: type,
        occurrence,
        payment_period: occurrence !== 'periodic' && paymentPeriod ? parseInt(paymentPeriod) : null,
        amount: defaultAmount,
        applicable_fees: selectedFees,
        applicable_classes: selectedClasses,
        class_tiers: Object.entries(tierOverrides).map(([classId, amt]) => ({
          student_class: parseInt(classId),
          tier_amount: amt
        })),
      };

      if (typeof view === 'object' && view.mode === 'edit') {
         // FIXED: Using your exact adapter method
         const updated = await feeAPI.updateDiscount(view.discount.id, payload as any);
         setDiscounts(p => p.map(d => d.id === updated.id ? updated : d));
         showToast('success', 'Discount configuration updated.');
      } else {
         // FIXED: Using your exact adapter method
         const created = await feeAPI.createDiscount(payload as any);
         setDiscounts(p => [created, ...p]);
         showToast('success', 'Discount configuration created successfully.');
      }
      setView('list');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerDelete = async () => {
    if (!deleteModal.discount) return;
    setIsSubmitting(true);
    try {
      const apiEndpoint = (feeAPI as any).discounts || feeAPI;
      await (apiEndpoint.delete ? apiEndpoint.delete(deleteModal.discount.id) : (feeAPI as any).deleteDiscount(deleteModal.discount.id));
      setDiscounts(p => p.filter(d => d.id !== deleteModal.discount!.id));
      showToast('success', 'Discount deleted successfully.');
      setDeleteModal({ open: false, discount: null, isErrorMode: false, errorMsg: '' });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || extractError(err);
      if (err?.response?.status === 400 && (msg.toLowerCase().includes('enrolled') || msg.toLowerCase().includes('applied') || msg.toLowerCase().includes('invoice'))) {
         setDeleteModal(p => ({ ...p, isErrorMode: true, errorMsg: msg }));
      } else {
         showToast('error', msg);
         setDeleteModal({ open: false, discount: null, isErrorMode: false, errorMsg: '' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // RENDER: LIST VIEW
  // ============================================================================

  const renderListView = () => {
    const filtered = discounts.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));

    return (
      <div className="space-y-6 pb-12 max-w-7xl mx-auto animate-in fade-in duration-300">

        {/* Overlap Anomaly Banner */}
        {anomalies.length > 0 && (
          <div className={`border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-4 ${anomalies.some(a => a.severe) ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3">
              <ShieldAlert className={`h-5 w-5 shrink-0 ${anomalies.some(a => a.severe) ? 'text-rose-600' : 'text-amber-600'}`} />
              <div>
                <p className={`text-sm font-bold ${anomalies.some(a => a.severe) ? 'text-rose-900' : 'text-amber-900'}`}>{anomalies.length} Potential Discount Overlap{anomalies.length > 1 ? 's' : ''} Detected</p>
                <p className={`text-xs ${anomalies.some(a => a.severe) ? 'text-rose-700' : 'text-amber-700'}`}>Some discounts cover the same class and fee scope — students may be stacked with concessions nobody intended together.</p>
              </div>
            </div>
            <button onClick={() => setShowAnomaliesModal(true)} className={`whitespace-nowrap px-4 py-2 bg-white text-xs font-bold rounded-xl border transition-colors ${anomalies.some(a => a.severe) ? 'text-rose-700 border-rose-200 hover:bg-rose-100' : 'text-amber-700 border-amber-200 hover:bg-amber-100'}`}>
              Review Overlaps
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Tag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Discount Configurations</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Manage master concessions, scholarships, and class tiers</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search discounts..." className={inputCls + ' pl-10 py-2.5 w-full sm:w-64'} />
            </div>
            {canManage && (
              <button onClick={() => setView('create')}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm whitespace-nowrap">
                <Plus className="h-4 w-4" /> New Discount
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
             <div className="p-16 flex flex-col items-center justify-center text-slate-400">
               <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
               <p className="text-sm font-bold">Loading Configurations...</p>
             </div>
          ) : filtered.length === 0 ? (
             <div className="p-16 flex flex-col items-center justify-center text-slate-400">
               <Tag className="h-10 w-10 text-slate-300 mb-4" />
               <p className="text-base font-bold text-slate-600">No discounts found</p>
               <p className="text-sm mt-1">Create a master discount to start applying concessions.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-4 pl-6 w-8"></th>
                    <th className="p-4">Title</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Occurrence</th>
                    <th className="p-4 text-right">Default Value</th>
                    <th className="p-4 text-center">Class Overrides</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(d => {
                    const isExpanded = expandedRows.includes(d.id);
                    const isPct = d.discount_type === 'percentage';

                    return (
                      <React.Fragment key={d.id}>
                        <tr onClick={() => toggleRow(d.id)} className={`group hover:bg-slate-50/80 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50' : ''}`}>
                          <td className="p-4 pl-6">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-indigo-500" />}
                          </td>
                          <td className="p-4 font-extrabold text-slate-900 text-sm">
                            {d.title}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${isPct ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                               {isPct ? <Percent className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                               {d.discount_type_display || d.discount_type}
                            </span>
                          </td>
                          <td className="p-4">
                             <div className="flex flex-col">
                               <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 inline-block w-max">
                                 {d.occurrence_display || d.occurrence.replace('_', ' ')}
                               </span>
                               {d.occurrence !== 'periodic' && (
                                 <span className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest">{d.payment_period_name || 'First Applicable'}</span>
                               )}
                             </div>
                          </td>
                          <td className="p-4 text-right font-black text-slate-800 text-sm">
                             {isPct ? fmtPercent(d.amount || 0) : fmtMoney(d.amount || 0)}
                          </td>
                          <td className="p-4 text-center">
                             {d.class_tiers && d.class_tiers.length > 0 ? (
                               <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                                 {d.class_tiers.length} Tier{d.class_tiers.length > 1 ? 's' : ''} Active
                               </span>
                             ) : (
                               <span className="text-[10px] font-medium text-slate-400 italic">Uniform</span>
                             )}
                          </td>
                          <td className="p-4 pr-6 text-right">
                             <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                {canManage && (
                                  <>
                                    <button onClick={() => setView({ mode: 'edit', discount: d })} title="Edit Configuration" className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors">
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => setDeleteModal({ open: true, discount: d, isErrorMode: false, errorMsg: '' })} title="Delete Discount" className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors">
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
                              <div className="bg-slate-50/50 p-6 border-l-4 border-indigo-500 shadow-inner grid grid-cols-1 lg:grid-cols-2 gap-8">

                                 {/* Allowed Fees Table */}
                                 <div>
                                   <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Layers className="h-3.5 w-3.5" /> Allowed Fees</h4>
                                   {!d.applicable_fees || d.applicable_fees.length === 0 ? (
                                     <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2.5 rounded-lg border border-emerald-100">Applies unconditionally to All Fees</p>
                                   ) : (
                                     <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto custom-scrollbar">
                                       <table className="w-full text-left text-xs">
                                         <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                           <tr className="text-slate-500"><th className="p-3 font-bold uppercase tracking-wider text-[10px]">Fee Name</th></tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-100">
                                           {d.applicable_fees.map(fid => {
                                             const feeObj = fees.find(f => f.id === fid);
                                             return (
                                               <tr key={fid}>
                                                 <td className="p-3 font-bold text-slate-800">{feeObj?.name || `Fee #${fid}`}</td>
                                               </tr>
                                             );
                                           })}
                                         </tbody>
                                       </table>
                                     </div>
                                   )}
                                 </div>

                                 {/* Eligible Classes & Effective Rate Table (full roster, override highlighted) */}
                                 <div>
                                   <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Eligible Classes & Rates</h4>
                                   {!d.applicable_classes || d.applicable_classes.length === 0 ? (
                                     <p className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-2.5 rounded-lg border border-rose-100">No classes selected. Nobody will receive this discount.</p>
                                   ) : (
                                     <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto custom-scrollbar">
                                       <table className="w-full text-left text-xs">
                                         <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                           <tr className="text-slate-500">
                                             <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Class</th>
                                             <th className="p-3 text-right font-bold uppercase tracking-wider text-[10px]">Effective Rate</th>
                                           </tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-100">
                                           {d.applicable_classes.map(cid => {
                                             const classObj = classes.find(c => c.id === cid);
                                             const tier = d.class_tiers?.find((t: any) => t.student_class === cid);
                                             const val = tier ? tier.tier_amount : d.amount;
                                             return (
                                               <tr key={cid} className={tier ? 'bg-indigo-50/40' : ''}>
                                                 <td className="p-3 font-bold text-slate-800">{classObj?.name || `Class #${cid}`}</td>
                                                 <td className="p-3 text-right">
                                                   {tier ? (
                                                     <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black whitespace-nowrap">
                                                       {isPct ? fmtPercent(val) : fmtMoney(val)} (Override)
                                                     </span>
                                                   ) : (
                                                     <span className="font-black text-slate-900">{isPct ? fmtPercent(val) : fmtMoney(val)}</span>
                                                   )}
                                                 </td>
                                               </tr>
                                             );
                                           })}
                                         </tbody>
                                       </table>
                                     </div>
                                   )}
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
    const isPct = type === 'percentage';

    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in slide-in-from-bottom-4 duration-300">

        {/* Header - Simple Title */}
        <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <button onClick={() => setView('list')} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 border border-transparent rounded-xl transition-all">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <Tag className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{isEdit ? 'Update' : 'New'} Discount Configuration</h1>
            <p className="text-xs text-slate-500 font-medium">Define master rules and class-specific overrides in one place.</p>
          </div>
        </div>

        {/* Live overlap warning — dismissible, resurfaces if the conflict set changes */}
        {liveConflicts.length > 0 && !dismissedLiveWarning && (
          <div className={`border rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2 ${liveConflicts.some(c => c.severe) ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${liveConflicts.some(c => c.severe) ? 'text-rose-600' : 'text-amber-600'}`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${liveConflicts.some(c => c.severe) ? 'text-rose-900' : 'text-amber-900'}`}>
                {liveConflicts.some(c => c.severe) ? 'Discount stacking exceeds 100% for some classes' : `Possible discount overlap (${liveConflicts.length})`}
              </p>
              <ul className="mt-1.5 space-y-1">
                {liveConflicts.map((c, i) => (
                  <li key={i} className={`text-xs flex items-start gap-1.5 ${c.severe ? 'text-rose-800 font-semibold' : 'text-amber-800'}`}><span className="mt-0.5">•</span><span>{c.message}</span></li>
                ))}
              </ul>
            </div>
            <button onClick={() => setDismissedLiveWarning(true)} className={`p-1 shrink-0 ${liveConflicts.some(c => c.severe) ? 'text-rose-500 hover:text-rose-700' : 'text-amber-500 hover:text-amber-700'}`}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Master Rules (Full Width) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <SectionHeader icon={<Settings className="h-4 w-4" />} title="Master Rules" />
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2">
              <label className={labelCls}>Discount Title <span className="text-rose-500">*</span></label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Staff Scholarship" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Type</label>
              <select value={type} onChange={e => {
                  setType(e.target.value as any);
                  if (e.target.value === 'percentage' && parseFloat(defaultAmount) > 100) setDefaultAmount('100');
              }} className={selectCls}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₦)</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Default Amount <span className="text-rose-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{isPct ? '%' : '₦'}</span>
                <input
                  type="number" step="0.01" max={isPct ? 100 : undefined}
                  value={defaultAmount}
                  onChange={e => {
                     const v = e.target.value;
                     if (isPct && parseFloat(v) > 100) return;
                     setDefaultAmount(v);
                  }}
                  placeholder="0.00"
                  className={inputCls + ' pl-8 font-black text-slate-900'}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Occurrence</label>
              <select value={occurrence} onChange={e => setOccurrence(e.target.value)} className={selectCls}>
                <option value="periodic">Periodic (Every Term)</option>
                <option value="annually">Annually</option>
                <option value="one_time">One Time</option>
              </select>
            </div>

            {occurrence !== 'periodic' && (
              <div className="lg:col-span-3">
                <label className={labelCls}>Applicable Period <span className="text-slate-400 normal-case font-normal">(Optional)</span></label>
                <select value={paymentPeriod} onChange={e => setPaymentPeriod(e.target.value)} className={selectCls}>
                  <option value="">First Applicable Term (Auto-consume)</option>
                  {blueprintPeriods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 italic">If left blank, the discount will apply to the very next invoice generated and then expire.</p>
              </div>
            )}
          </div>
        </div>

        {/* Side-by-Side: Fees & Classes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Allowed Fees */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
            <SectionHeader icon={<Layers className="h-4 w-4" />} title="Allowed Fees Limitation">
              <div className="flex items-center gap-2">
                <button type="button" onClick={selectAllFees} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase rounded-md hover:bg-indigo-100 transition-colors border border-indigo-100">Select All</button>
                <button type="button" onClick={clearAllFees} className="px-2.5 py-1 bg-slate-50 text-slate-500 text-[9px] font-bold uppercase rounded-md hover:bg-slate-100 transition-colors border border-slate-200">Clear</button>
              </div>
            </SectionHeader>
            <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex items-start gap-2">
               <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
               <p className="text-[10px] text-blue-800 leading-relaxed font-medium">Leave this completely empty to allow this discount to apply against <strong>ALL</strong> fee items on an invoice.</p>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
               {fees.map(f => (
                 <label key={f.id} className="flex items-center gap-3 p-2.5 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                   <input type="checkbox" checked={selectedFees.includes(f.id)} onChange={() => handleFeeToggle(f.id)} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                   <div>
                     <p className="text-xs font-bold text-slate-800">{f.name}</p>
                     <p className="text-[9px] text-slate-400 uppercase tracking-widest">{f.occurrence.replace('_', ' ')}</p>
                   </div>
                 </label>
               ))}
            </div>
          </div>

          {/* Eligible Classes & Tiers */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
            <SectionHeader icon={<Users className="h-4 w-4" />} title="Eligible Classes & Tier Overrides">
               <div className="flex items-center gap-2">
                <button type="button" onClick={selectAllClasses} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase rounded-md hover:bg-indigo-100 transition-colors border border-indigo-100">Select All</button>
                <button type="button" onClick={clearAllClasses} className="px-2.5 py-1 bg-slate-50 text-slate-500 text-[9px] font-bold uppercase rounded-md hover:bg-slate-100 transition-colors border border-slate-200">Clear</button>
              </div>
            </SectionHeader>
            <div className="p-4 bg-amber-50/50 border-b border-amber-100 flex items-start gap-2">
               <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
               <p className="text-[10px] text-amber-800 leading-relaxed font-medium">Select eligible classes. By default, they receive the <strong>Default Amount</strong>. Type in the box to create a class-specific override.</p>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 space-y-3">
              {classes.length === 0 ? (
                <div className="text-center py-10 text-slate-400"><p className="text-sm font-bold">No classes available.</p></div>
              ) : (
                classes.map(cls => {
                  const isChecked = selectedClasses.includes(cls.id);
                  const hasOverride = tierOverrides[cls.id] !== undefined;

                  return (
                    <div key={cls.id} className={`border rounded-xl p-3 transition-all ${isChecked ? 'bg-white border-indigo-300 shadow-sm ring-1 ring-indigo-50' : 'bg-transparent border-slate-200'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <label className="flex items-center gap-3 cursor-pointer group flex-1">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                            {isChecked && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <input type="checkbox" className="hidden" checked={isChecked} onChange={() => handleClassToggle(cls.id)} />
                          <span className={`text-sm font-bold transition-colors ${isChecked ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>{cls.name}</span>
                        </label>

                        {isChecked && (
                          <div className="w-32 relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">{isPct ? '%' : '₦'}</span>
                            <input
                              type="number" step="0.01" max={isPct ? 100 : undefined}
                              value={tierOverrides[cls.id] ?? ''}
                              onChange={e => handleTierChange(cls.id, e.target.value)}
                              placeholder="Default"
                              className={`w-full pl-6 pr-2 py-1.5 text-xs font-black text-right border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${hasOverride ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-700 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)]">
          <div className="max-w-4xl mx-auto px-6 py-2.5 flex items-center justify-between">
            <button type="button" onClick={() => setPreviewModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
              <Eye className="h-3.5 w-3.5" /> Preview Setup
            </button>

            <div className="flex items-center gap-2">
               <button onClick={() => setView('list')} className="px-4 py-2 bg-transparent text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-colors">Cancel</button>
               <button onClick={() => triggerSave(false)} disabled={isSubmitting} className="px-6 py-2 bg-indigo-500 text-white text-xs font-black tracking-wide rounded-lg shadow-md shadow-indigo-500/30 hover:bg-indigo-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                 {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save Rule
               </button>
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

      {/* Low Fixed Amount Warning */}
      {lowAmountWarning && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-50 border border-amber-200 text-amber-600">
               <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Confirm Low Amount</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              You selected a Fixed Amount of <strong className="text-amber-600">₦{defaultAmount}</strong>. This is extremely low and is usually a mistake when users intend to enter a percentage (e.g., 50%). Are you sure you want to proceed?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setLowAmountWarning(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200">
                Cancel
              </button>
              <button onClick={() => { setLowAmountWarning(false); triggerSave(true, false); }} className="flex-1 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 flex items-center justify-center gap-2">
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlap Guard (submit-time, blocking) */}
      {overlapModal.open && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className={`p-5 flex items-center gap-3 ${overlapModal.conflicts.some(c => c.severe) ? 'bg-rose-600' : 'bg-amber-600'}`}>
               <AlertTriangle className="h-6 w-6 text-white" />
               <h3 className="text-lg font-bold text-white">{overlapModal.conflicts.some(c => c.severe) ? 'Discount Stacking Exceeds 100%' : 'Potential Discount Overlap'}</h3>
            </div>
            <div className="p-6">
               <p className="text-sm text-slate-600 font-medium mb-4 leading-relaxed">
                 This configuration overlaps with other active discounts for the same class and fee scope. Depending on how invoices are generated, students could receive both discounts stacked on the same line.
               </p>
               <div className={`border rounded-xl p-4 max-h-48 overflow-y-auto mb-6 ${overlapModal.conflicts.some(c => c.severe) ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                 <ul className="space-y-2">
                   {overlapModal.conflicts.map((c, i) => (
                     <li key={i} className={`text-xs font-bold flex items-start gap-2 ${c.severe ? 'text-rose-800' : 'text-amber-800'}`}>
                       <span className="mt-0.5">•</span> <span>{c.message}</span>
                     </li>
                   ))}
                 </ul>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setOverlapModal({ open: false, conflicts: [] })} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50">Review Scopes</button>
                 <button onClick={() => triggerSave(true, true)} className={`flex-1 py-3 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 ${overlapModal.conflicts.some(c => c.severe) ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}>I Understand, Proceed</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Discount Anomaly Review Modal */}
      {showAnomaliesModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-600" /> Discount Overlaps</h3>
              <button onClick={() => setShowAnomaliesModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
              {anomalies.map(an => (
                <div key={an.key} className={`bg-white border rounded-xl p-5 shadow-sm ${an.severe ? 'border-rose-200' : 'border-slate-200'}`}>
                   <div className="flex justify-between items-start mb-3">
                      <div>
                         <p className="text-sm font-bold text-slate-800">"{an.a.title}" <span className="text-slate-400 font-normal">overlaps with</span> "{an.b.title}"</p>
                         {an.severe && <p className="text-xs font-bold text-rose-600 mt-1">Stacked percentage reaches 100% or more for at least one shared class.</p>}
                      </div>
                      <button onClick={() => ignoreAnomaly(an.key)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Ignore Issue</button>
                   </div>
                   <div className={`p-3 rounded-lg border flex flex-wrap gap-2 ${an.severe ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                      {an.sharedClasses.map((cname, i) => (
                        <span key={i} className={`text-xs font-bold px-2.5 py-1 rounded-md bg-white border ${an.severe ? 'text-rose-700 border-rose-200' : 'text-amber-700 border-amber-200'}`}>{cname}</span>
                      ))}
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Setup Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 rounded-t-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Eye className="h-5 w-5 text-indigo-400" /> Configuration Preview</h3>
              <button onClick={() => setPreviewModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Master Details</h4>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                   <div><p className="text-[10px] text-slate-500 uppercase font-bold">Title</p><p className="text-xs font-black text-slate-800">{title || '---'}</p></div>
                   <div><p className="text-[10px] text-slate-500 uppercase font-bold">Type</p><p className="text-xs font-black text-slate-800 capitalize">{type}</p></div>
                   <div><p className="text-[10px] text-slate-500 uppercase font-bold">Default Value</p><p className="text-xs font-black text-slate-800">{type === 'percentage' ? fmtPercent(defaultAmount) : fmtMoney(defaultAmount)}</p></div>
                   <div><p className="text-[10px] text-slate-500 uppercase font-bold">Occurrence</p><p className="text-xs font-black text-slate-800 capitalize">{occurrence.replace('_', ' ')}</p></div>
                 </div>
               </div>

               <div>
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Allowed Fees</h4>
                 {selectedFees.length === 0 ? (
                   <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">Applies unconditionally to all fees</p>
                 ) : (
                   <div className="border border-slate-200 rounded-xl overflow-hidden">
                     <table className="w-full text-left text-xs">
                       <thead className="bg-slate-50 border-b border-slate-200"><tr className="text-slate-500"><th className="p-3">Fee Name</th><th className="p-3 text-right">Occurrence</th></tr></thead>
                       <tbody className="divide-y divide-slate-100">
                         {selectedFees.map(fid => {
                           const f = fees.find(x => x.id === fid);
                           return <tr key={fid}><td className="p-3 font-bold text-slate-800">{f?.name}</td><td className="p-3 text-right text-slate-500">{f?.occurrence.replace('_', ' ')}</td></tr>;
                         })}
                       </tbody>
                     </table>
                   </div>
                 )}
               </div>

               <div>
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Eligible Classes & Overrides</h4>
                 {selectedClasses.length === 0 ? (
                   <p className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">No classes selected. Nobody will receive this discount.</p>
                 ) : (
                   <div className="border border-slate-200 rounded-xl overflow-hidden">
                     <table className="w-full text-left text-xs">
                       <thead className="bg-slate-50 border-b border-slate-200"><tr className="text-slate-500"><th className="p-3">Class Name</th><th className="p-3 text-right">Effective Rate</th></tr></thead>
                       <tbody className="divide-y divide-slate-100">
                         {selectedClasses.map(cid => {
                           const c = classes.find(x => x.id === cid);
                           const override = tierOverrides[cid];
                           const val = override || defaultAmount;
                           return (
                             <tr key={cid}>
                               <td className="p-3 font-bold text-slate-800">{c?.name}</td>
                               <td className="p-3 text-right">
                                 {override ? (
                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black">{type==='percentage' ? fmtPercent(val) : fmtMoney(val)} (Override)</span>
                                 ) : (
                                    <span className="font-bold text-slate-600">{type==='percentage' ? fmtPercent(val) : fmtMoney(val)}</span>
                                 )}
                               </td>
                             </tr>
                           );
                         })}
                       </tbody>
                     </table>
                   </div>
                 )}
               </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
               <button onClick={() => setPreviewModal(false)} className="px-6 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors">Close Preview</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border ${deleteModal.isErrorMode ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
               <Ban className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">{deleteModal.isErrorMode ? 'Action Restricted' : 'Delete Discount'}</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              {deleteModal.isErrorMode ? deleteModal.errorMsg : `Are you sure you want to permanently delete "${deleteModal.discount?.title}"?`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ open: false, discount: null, isErrorMode: false, errorMsg: '' })} className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200">
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
    </>
  );
}