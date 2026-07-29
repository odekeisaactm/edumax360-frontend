'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicCalendarAPI, academicAPI, feeAPI } from '@/lib/api';
import { Session, AcademicSessionPeriod, ClassModel } from '@/lib/types';
import {
  AlertCircle, X, Loader2, Search, History, AlertTriangle, ArrowRight,
  RotateCcw, CheckCircle2, Info, Zap, ArrowLeft, Wallet, FileText,
  ChevronLeft, ChevronRight, Eye, ShieldAlert, Calendar, Layers
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface AffectedInvoice {
  id: number;
  invoice_number: string;
  student_name?: string;
  parent_name?: string;
}

interface CorrectionBatch {
  id: number;
  title: string;
  reason: string;
  created_by_name: string;
  created_at: string;
  affected_student_invoices: AffectedInvoice[];
  affected_family_invoices: AffectedInvoice[];
}

interface UnifiedInvoiceTarget {
  _id: number;
  _type: 'student' | 'family';
  invoice_number: string;
  billed_name: string;
  total_amount: string;
  amount_paid: string;
  status: string;
}

interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

type ScopeType = 'term' | 'class' | 'student';
type InvoiceDocType = 'student' | 'family' | 'both';
type ExecutionMode = 'void_only' | 'void_and_regenerate' | 'void_regenerate_and_reapply';

let _toastId = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractError(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'An unexpected error occurred.';
}

function formatCurrency(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(num);
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

const LEDGER_FETCH_CAP = 300;
const LEDGER_PAGE_SIZE = 20;

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CorrectionBatchesPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 6000);
  }, []);

  // System Data
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<CorrectionBatch[]>([]);
  const [batchesHitCap, setBatchesHitCap] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [allSections, setAllSections] = useState<any[]>([]);

  // Ledger State
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);

  // Wizard General State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  // Step 1: Scope Settings
  const [scopeType, setScopeType] = useState<ScopeType>('class');
  const [invoiceDocType, setInvoiceDocType] = useState<InvoiceDocType>('both');
  const [filterSessionId, setFilterSessionId] = useState<string>('');
  const [filterPeriodId, setFilterPeriodId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [filterSectionId, setFilterSectionId] = useState<string>('');
  const [studentSearchInput, setStudentSearchInput] = useState('');

  // Step 2: Invoice Selection
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [fetchedInvoices, setFetchedInvoices] = useState<UnifiedInvoiceTarget[]>([]);
  const [selectedStudentInvoiceIds, setSelectedStudentInvoiceIds] = useState<Set<number>>(new Set());
  const [selectedFamilyInvoiceIds, setSelectedFamilyInvoiceIds] = useState<Set<number>>(new Set());
  const [tableSearch, setTableSearch] = useState('');

  // Step 3: Execution Payload
  const [batchTitle, setBatchTitle] = useState('');
  const [batchReason, setBatchReason] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('void_regenerate_and_reapply');

  // ─── Data Loading ──────────────────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    try {
      const res = await feeAPI.getCorrectionBatches({ page_size: LEDGER_FETCH_CAP } as any);
      const results = Array.isArray(res) ? res : ((res as any)?.results ?? res ?? []);
      setBatches(Array.isArray(results) ? results : []);
      setBatchesHitCap(Array.isArray(results) && results.length >= LEDGER_FETCH_CAP);
    } catch (err: any) {
      showToast('error', extractError(err));
    }
  }, [showToast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessRes, perRes, clsRes, sectionsRes] = await Promise.all([
        academicCalendarAPI.listSessions(),
        academicCalendarAPI.listSessionPeriods(),
        academicAPI.listClasses({ is_active: true }),
        academicAPI.listClassSections(),
      ]);
      setSessions(sessRes);
      setPeriods(perRes);
      setClasses(clsRes);
      setAllSections(Array.isArray(sectionsRes) ? sectionsRes : []);
      await fetchBatches();

      const currentSess = sessRes.find((s: any) => s.is_active);
      if (currentSess) {
        setFilterSessionId(currentSess.id.toString());
        const currentPer = perRes.find((p: any) => p.session?.id === currentSess.id && p.is_current);
        if (currentPer) setFilterPeriodId(currentPer.id.toString());
      }
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [fetchBatches, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const sectionsForSelectedClass = useMemo(() => {
    if (!filterClassId) return [];
    const cls = classes.find(c => c.id.toString() === filterClassId);
    if (!cls) return [];
    return allSections.filter((sec: any) =>
      !sec.school_section || !(cls as any).school_section || sec.school_section === (cls as any).school_section
    );
  }, [filterClassId, classes, allSections]);

  useEffect(() => { setFilterSectionId(''); }, [filterClassId]);

  const validPeriods = useMemo(() => {
    if (!filterSessionId) return [];
    const targetSession = sessions.find(s => s.id.toString() === filterSessionId);
    const sessionPeriods = periods.filter(p => p.session?.id.toString() === filterSessionId);
    const currentPeriod = periods.find(p => p.is_current);
    if (!currentPeriod || !targetSession) return sessionPeriods;

    const currentSession = sessions.find(s => s.id === currentPeriod.session?.id);
    if (!currentSession) return sessionPeriods;

    if (targetSession.start_year > currentSession.start_year) return sessionPeriods;
    if (targetSession.start_year === currentSession.start_year) {
      return sessionPeriods.filter(p => (p.period?.order ?? 0) >= (currentPeriod.period?.order ?? 0));
    }
    return [];
  }, [periods, sessions, filterSessionId]);

  // ─── Wizard Actions ────────────────────────────────────────────────────────
  const fetchInvoicesForVoiding = async () => {
    if (!filterSessionId || !filterPeriodId) return showToast('error', 'Session and Term are strictly required.');
    if (scopeType === 'class' && !filterClassId) return showToast('error', 'Target class is required for Class Scope.');
    if (scopeType === 'student' && studentSearchInput.trim().length < 3) return showToast('error', 'Enter at least 3 characters to search.');

    setInvoicesLoading(true);
    try {
      const params: any = { session: filterSessionId, period: filterPeriodId, page_size: 1000 };
      if (scopeType === 'class') {
        params.student_class = filterClassId;
        if (filterSectionId) params.class_section = filterSectionId;
      }
      if (scopeType === 'student') params.search = studentSearchInput.trim();

      const fetchPromises = [];
      if (invoiceDocType === 'student' || invoiceDocType === 'both') {
        fetchPromises.push(feeAPI.getInvoices(params).then((res: any) => ({ type: 'student', data: res.results || res || [] })));
      }
      if (invoiceDocType === 'family' || invoiceDocType === 'both') {
        fetchPromises.push(feeAPI.getFamilyInvoices(params).then((res: any) => ({ type: 'family', data: res.results || res || [] })));
      }

      const results = await Promise.all(fetchPromises);

      let unifiedList: UnifiedInvoiceTarget[] = [];
      results.forEach(res => {
        const valid = res.data.filter((inv: any) => inv.status !== 'void');
        const mapped = valid.map((inv: any) => ({
          _id: inv.id,
          _type: res.type as 'student' | 'family',
          invoice_number: inv.invoice_number,
          billed_name: res.type === 'student' ? inv.student_name : inv.parent_name,
          total_amount: inv.total_amount,
          amount_paid: inv.amount_paid,
          status: inv.status
        }));
        unifiedList = [...unifiedList, ...mapped];
      });

      setFetchedInvoices(unifiedList);
      setSelectedStudentInvoiceIds(new Set());
      setSelectedFamilyInvoiceIds(new Set());
      setWizardStep(2);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setInvoicesLoading(false);
    }
  };

  const toggleInvoiceSelection = (id: number, type: 'student' | 'family') => {
    if (type === 'student') {
      const newSet = new Set(selectedStudentInvoiceIds);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      setSelectedStudentInvoiceIds(newSet);
    } else {
      const newSet = new Set(selectedFamilyInvoiceIds);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      setSelectedFamilyInvoiceIds(newSet);
    }
  };

  const toggleAllInvoices = () => {
    const totalSelected = selectedStudentInvoiceIds.size + selectedFamilyInvoiceIds.size;
    if (totalSelected === filteredInvoices.length) {
      setSelectedStudentInvoiceIds(new Set());
      setSelectedFamilyInvoiceIds(new Set());
    } else {
      const sIds = new Set<number>();
      const fIds = new Set<number>();
      filteredInvoices.forEach(inv => {
        if (inv._type === 'student') sIds.add(inv._id);
        else fIds.add(inv._id);
      });
      setSelectedStudentInvoiceIds(sIds);
      setSelectedFamilyInvoiceIds(fIds);
    }
  };

  const resetWizardScope = () => {
    setWizardStep(1);
    setScopeType('class');
    setInvoiceDocType('both');
    setFilterClassId('');
    setFilterSectionId('');
    setStudentSearchInput('');
    setFetchedInvoices([]);
    setSelectedStudentInvoiceIds(new Set());
    setSelectedFamilyInvoiceIds(new Set());
    setTableSearch('');
    setExecutionMode('void_regenerate_and_reapply');
    setBatchTitle('');
    setBatchReason('');
  };

  const attemptCloseWizard = () => {
    if (wizardStep > 1 && !isExecuting) setCloseConfirmOpen(true);
    else { setIsWizardOpen(false); resetWizardScope(); }
  };

  const confirmCloseWizard = () => {
    setCloseConfirmOpen(false);
    setIsWizardOpen(false);
    resetWizardScope();
  };

  const executeAtomicRebill = async () => {
    const totalSelected = selectedStudentInvoiceIds.size + selectedFamilyInvoiceIds.size;
    if (totalSelected === 0) return showToast('error', 'Select at least one invoice.');
    if (!batchTitle.trim()) return showToast('error', 'A Batch Title is required.');
    if (batchReason.trim().length < 5) return showToast('error', 'A detailed audit reason is required.');

    setIsExecuting(true);
    try {
      await feeAPI.executeAtomicRebill({
        title: batchTitle.trim(),
        reason: batchReason.trim(),
        execution_mode: executionMode,
        student_invoice_ids: Array.from(selectedStudentInvoiceIds),
        family_invoice_ids: Array.from(selectedFamilyInvoiceIds),
      });
      showToast('success', `Correction successfully executed on ${totalSelected} records.`);
      setIsWizardOpen(false);
      resetWizardScope();
      fetchBatches();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsExecuting(false);
    }
  };

  // ─── Filter & Stats Calculations ───────────────────────────────────────────
  const filteredInvoices = fetchedInvoices.filter(inv => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return inv.billed_name?.toLowerCase().includes(term) || inv.invoice_number?.toLowerCase().includes(term);
  });

  const selectedStats = useMemo(() => {
    let voidValue = 0;
    let pivotValue = 0;
    fetchedInvoices.forEach(inv => {
      if ((inv._type === 'student' && selectedStudentInvoiceIds.has(inv._id)) ||
          (inv._type === 'family' && selectedFamilyInvoiceIds.has(inv._id))) {
        voidValue += parseFloat(inv.total_amount || '0');
        pivotValue += parseFloat(inv.amount_paid || '0');
      }
    });
    return { voidValue, pivotValue, count: selectedStudentInvoiceIds.size + selectedFamilyInvoiceIds.size };
  }, [fetchedInvoices, selectedStudentInvoiceIds, selectedFamilyInvoiceIds]);

  // ── Ledger Pagination ──
  useEffect(() => { setLedgerPage(1); }, [ledgerSearch]);

  const filteredBatches = useMemo(() => {
    if (!ledgerSearch.trim()) return batches;
    const term = ledgerSearch.trim().toLowerCase();
    return batches.filter(b =>
      b.title?.toLowerCase().includes(term) ||
      b.reason?.toLowerCase().includes(term) ||
      b.created_by_name?.toLowerCase().includes(term) ||
      `BAT-${b.id}`.toLowerCase().includes(term)
    );
  }, [batches, ledgerSearch]);

  const ledgerTotalPages = Math.max(1, Math.ceil(filteredBatches.length / LEDGER_PAGE_SIZE));
  const ledgerSafePage = Math.min(ledgerPage, ledgerTotalPages);
  const pagedBatches = filteredBatches.slice((ledgerSafePage - 1) * LEDGER_PAGE_SIZE, ledgerSafePage * LEDGER_PAGE_SIZE);

  if (loading) return (
    <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-rose-600" />
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading Ledger...</p>
    </div>
  );

  return (
    <div className="space-y-5 pb-20 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
            <RotateCcw className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Correction Batches</h1>
            <p className="text-xs text-slate-500 mt-0.5">Audit log for mass voids and atomic re-bills.</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => { setIsWizardOpen(true); setWizardStep(1); }} className="px-4 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-2 whitespace-nowrap">
            <Zap className="h-4 w-4" /> Atomic Re-bill Wizard
          </button>
        )}
      </div>

      {/* ─── KPI ─── */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 inline-flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <History className="w-4 h-4 text-slate-600" />
        </div>
        <div>
          <p className="text-lg font-black text-slate-800 leading-none">{batches.length}{batchesHitCap ? '+' : ''}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Audit Batches</p>
        </div>
      </div>

      {/* ─── Ledger History Table ─── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-rose-500" />
            <h3 className="font-bold text-slate-800 text-sm">Correction Ledger</h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={ledgerSearch}
              onChange={e => setLedgerSearch(e.target.value)}
              placeholder="Search title, reason or staff..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
            />
          </div>
        </div>

        {batchesHitCap && (
          <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Showing the {LEDGER_FETCH_CAP} most recent batches. Narrow your search to see older records.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-32">Batch ID</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title & Reason</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorized By</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Affected</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Timestamp</th>
                <th className="px-5 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-sm font-medium">
                    {ledgerSearch ? 'No batches match your search.' : 'No correction batches found.'}
                  </td>
                </tr>
              ) : (
                pagedBatches.map((batch: any) => {
                   const sCount = batch.affected_student_invoices?.length || 0;
                   const fCount = batch.affected_family_invoices?.length || 0;
                   return (
                     <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors group">
                       <td className="px-5 py-3.5">
                         <span className="text-xs font-bold font-mono text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                           BAT-{batch.id.toString().padStart(4, '0')}
                         </span>
                       </td>
                       <td className="px-5 py-3.5">
                         <p className="text-sm font-semibold text-slate-800">{batch.title}</p>
                         <p className="text-xs text-slate-500 max-w-sm truncate mt-0.5" title={batch.reason}>{batch.reason}</p>
                       </td>
                       <td className="px-5 py-3.5 font-semibold text-slate-700 text-xs flex items-center gap-2 mt-1">
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                             {batch.created_by_name.charAt(0)}
                          </div>
                          <span className="truncate max-w-[120px]" title={batch.created_by_name}>{batch.created_by_name}</span>
                       </td>
                       <td className="px-5 py-3.5 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-md tracking-wider border border-slate-200">
                             {sCount + fCount} Docs
                          </span>
                       </td>
                       <td className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400">
                         {new Date(batch.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                       </td>
                       <td className="px-5 py-3.5 text-right">
                          <button
                             onClick={() => router.push(`/dashboard/staff/fee/correction-batches/${batch.id}`)}
                             className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                             title="View Audit Details"
                          >
                             <Eye className="h-4 w-4" />
                          </button>
                       </td>
                     </tr>
                   );
                })
              )}
            </tbody>
          </table>
        </div>

        {ledgerTotalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Showing {((ledgerSafePage - 1) * LEDGER_PAGE_SIZE) + 1}–{Math.min(ledgerSafePage * LEDGER_PAGE_SIZE, filteredBatches.length)} of{' '}
              <span className="font-bold text-slate-700">{filteredBatches.length}</span> batches
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setLedgerPage(p => Math.max(1, p - 1))} disabled={ledgerSafePage === 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition-colors bg-transparent">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-xs font-bold text-slate-600">{ledgerSafePage} / {ledgerTotalPages}</span>
              <button onClick={() => setLedgerPage(p => Math.min(ledgerTotalPages, p + 1))} disabled={ledgerSafePage === ledgerTotalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition-colors bg-transparent">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Mass Correction Wizard Drawer ─── */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right-8 duration-300">

            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Atomic Re-bill Engine</h2>
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">Step {wizardStep} of 3</p>
                </div>
              </div>
              <button onClick={attemptCloseWizard} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">

              {/* STEP 1: SCOPE DEFINITION */}
              {wizardStep === 1 && (
                <div className="max-w-xl mx-auto space-y-5 animate-in zoom-in-95">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium text-amber-800 leading-relaxed">
                      <strong>Strict Protocol:</strong> You can only void invoices from current or future terms. Past terms are audited and locked.
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                     <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-rose-500" /> 1. Select Accounting Period
                     </h3>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Session</label>
                           <select value={filterSessionId} onChange={e => setFilterSessionId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                              {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Term</label>
                           <select value={filterPeriodId} onChange={e => setFilterPeriodId(e.target.value)} disabled={!filterSessionId} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50">
                              <option value="">Select Term...</option>
                              {validPeriods.map(p => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
                           </select>
                           {validPeriods.length === 0 && filterSessionId && (
                              <p className="text-[9px] text-amber-600 font-semibold mt-1.5">Past terms are strictly locked.</p>
                           )}
                        </div>
                     </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                     <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-rose-500" /> 2. Target Resolution & Type
                     </h3>

                     <div className="space-y-4">
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Document Type</label>
                           <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                              <button onClick={() => setInvoiceDocType('student')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${invoiceDocType === 'student' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Student Only</button>
                              <button onClick={() => setInvoiceDocType('family')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${invoiceDocType === 'family' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Family Only</button>
                              <button onClick={() => setInvoiceDocType('both')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${invoiceDocType === 'both' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Both Types</button>
                           </div>
                        </div>

                        <hr className="border-slate-100" />

                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Target Scope</label>
                           <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg mb-3">
                              <button onClick={() => setScopeType('term')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${scopeType === 'term' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Entire Term</button>
                              <button onClick={() => setScopeType('class')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${scopeType === 'class' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Specific Class</button>
                              <button onClick={() => setScopeType('student')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${scopeType === 'student' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Student Search</button>
                           </div>

                           {scopeType === 'class' && (
                              <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                                 <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">Target Class</label>
                                    <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                                       <option value="">Select Class...</option>
                                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">Class Arm <span className="lowercase font-normal opacity-70">(Optional)</span></label>
                                    <select value={filterSectionId} onChange={e => setFilterSectionId(e.target.value)} disabled={!filterClassId || sectionsForSelectedClass.length === 0} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50">
                                       <option value="">All Arms</option>
                                       {sectionsForSelectedClass.map((sec: any) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                                    </select>
                                 </div>
                              </div>
                           )}

                           {scopeType === 'student' && (
                              <div className="animate-in slide-in-from-top-2">
                                 <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input type="text" placeholder="Name or Registration Number..." value={studentSearchInput} onChange={e => setStudentSearchInput(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500" />
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {/* STEP 2: INVOICE SELECTION */}
              {wizardStep === 2 && (
                <div className="h-full flex flex-col animate-in slide-in-from-right-4 space-y-3">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-sm font-bold text-slate-900">Select Target Invoices</h3>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Found {fetchedInvoices.length} valid documents</p>
                     </div>
                     <div className="relative w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input type="text" placeholder="Filter list..." value={tableSearch} onChange={e => setTableSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500" />
                     </div>
                  </div>

                  <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                     <div className="overflow-y-auto flex-1">
                        <table className="w-full text-left">
                           <thead className="bg-slate-50/90 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-sm">
                              <tr>
                                 <th className="px-4 py-2.5 w-10 text-center">
                                    <input type="checkbox" checked={selectedStats.count > 0 && selectedStats.count === filteredInvoices.length} onChange={toggleAllInvoices} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer" />
                                 </th>
                                 <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                 <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Billed To</th>
                                 <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                 <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Paid</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {filteredInvoices.length === 0 ? (
                                 <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 font-medium text-xs">No invoices found matching criteria.</td></tr>
                              ) : (
                                 filteredInvoices.map(inv => {
                                    const paid = parseFloat(inv.amount_paid || '0');
                                    const isSelected = inv._type === 'student' ? selectedStudentInvoiceIds.has(inv._id) : selectedFamilyInvoiceIds.has(inv._id);

                                    return (
                                       <tr key={`${inv._type}-${inv._id}`} onClick={() => toggleInvoiceSelection(inv._id, inv._type)} className={`cursor-pointer transition-colors ${isSelected ? 'bg-rose-50/60' : 'hover:bg-slate-50'}`}>
                                          <td className="px-4 py-2.5 text-center">
                                             <input type="checkbox" checked={isSelected} readOnly className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 pointer-events-none" />
                                          </td>
                                          <td className="px-4 py-2.5">
                                             {inv._type === 'student'
                                                ? <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-widest rounded border border-slate-200">Student</span>
                                                : <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 text-[9px] font-bold uppercase tracking-widest rounded border border-rose-100">Family</span>
                                             }
                                          </td>
                                          <td className="px-4 py-2.5">
                                             <p className="font-semibold text-slate-800 text-xs">{inv.billed_name}</p>
                                             <p className="text-[10px] font-mono font-medium text-slate-400 mt-0.5">{inv.invoice_number}</p>
                                          </td>
                                          <td className="px-4 py-2.5 text-right font-bold text-slate-700 text-xs">{formatCurrency(inv.total_amount)}</td>
                                          <td className="px-4 py-2.5 text-right">
                                             {paid > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[9px] uppercase tracking-widest rounded border border-emerald-100">
                                                   <Wallet className="w-3 h-3" /> {formatCurrency(paid)}
                                                </span>
                                             ) : (
                                                <span className="text-slate-300 font-bold text-[10px] uppercase tracking-widest">₦0.00</span>
                                             )}
                                          </td>
                                       </tr>
                                    );
                                 })
                              )}
                           </tbody>
                        </table>
                     </div>
                     <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest"><span className="text-rose-600">{selectedStats.count}</span> Selected</p>
                        <p className="text-xs font-bold text-slate-800">Total Value: {formatCurrency(selectedStats.voidValue)}</p>
                     </div>
                  </div>
                </div>
              )}

              {/* STEP 3: EXECUTION & PIVOT */}
              {wizardStep === 3 && (
                <div className="max-w-xl mx-auto space-y-6 animate-in slide-in-from-right-4">

                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">1. Batch Audit Title <span className="text-rose-500">*</span></label>
                     <input
                       type="text"
                       value={batchTitle}
                       onChange={e => setBatchTitle(e.target.value)}
                       placeholder="e.g. Primary 5 Fee Structure Correction"
                       className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-sm"
                     />
                  </div>

                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">2. Execution Mode</label>
                     <div className="grid grid-cols-1 gap-2.5">
                        {/* Mode 1 */}
                        <div onClick={() => setExecutionMode('void_only')} className={`p-3.5 rounded-xl border cursor-pointer transition-all ${executionMode === 'void_only' ? 'border-rose-500 bg-rose-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                           <div className="flex items-center gap-2.5 mb-1">
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${executionMode === 'void_only' ? 'border-rose-500' : 'border-slate-300'}`}>
                                 {executionMode === 'void_only' && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                              </div>
                              <h4 className="text-sm font-bold text-slate-800">Void & Credit Wallet</h4>
                           </div>
                           <p className="text-[11px] text-slate-500 font-medium pl-6 leading-relaxed">Permanently voids the invoices. Online payments are pivoted securely to the student wallets. No new invoices are generated.</p>
                        </div>

                        {/* Mode 2 */}
                        <div onClick={() => setExecutionMode('void_and_regenerate')} className={`p-3.5 rounded-xl border cursor-pointer transition-all ${executionMode === 'void_and_regenerate' ? 'border-amber-500 bg-amber-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                           <div className="flex items-center gap-2.5 mb-1">
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${executionMode === 'void_and_regenerate' ? 'border-amber-500' : 'border-slate-300'}`}>
                                 {executionMode === 'void_and_regenerate' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                              </div>
                              <h4 className="text-sm font-bold text-slate-800">Void & Regenerate Only</h4>
                           </div>
                           <p className="text-[11px] text-slate-500 font-medium pl-6 leading-relaxed">Voids invoices, pivots online funds, and instantly generates corrected invoices. <span className="font-semibold text-amber-700">Funds are NOT automatically applied to the new bills.</span></p>
                        </div>

                        {/* Mode 3 */}
                        <div onClick={() => setExecutionMode('void_regenerate_and_reapply')} className={`p-3.5 rounded-xl border cursor-pointer transition-all ${executionMode === 'void_regenerate_and_reapply' ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                           <div className="flex items-center gap-2.5 mb-1">
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${executionMode === 'void_regenerate_and_reapply' ? 'border-emerald-500' : 'border-slate-300'}`}>
                                 {executionMode === 'void_regenerate_and_reapply' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                              </div>
                              <h4 className="text-sm font-bold text-slate-800">Void, Regenerate & Auto-Reapply</h4>
                           </div>
                           <p className="text-[11px] text-slate-500 font-medium pl-6 leading-relaxed">The full suite. Voids invoices, pivots online funds, generates new invoices, and <span className="font-semibold text-emerald-700">automatically sweeps the pivoted funds to pay the new bills.</span></p>
                        </div>
                     </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">3. Audit Ledger Reason <span className="text-rose-500">*</span></label>
                    <textarea
                      rows={3}
                      value={batchReason}
                      onChange={e => setBatchReason(e.target.value)}
                      placeholder="Detail exactly why this batch was executed for the immutable ledger..."
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none shadow-sm"
                    />
                  </div>

                  {selectedStats.pivotValue > 0 && (
                     <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex gap-3">
                        <Wallet className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                           <p className="text-xs font-bold text-slate-700">Payment Reversal Detected</p>
                           <p className="text-[11px] font-medium text-slate-500 mt-1 leading-relaxed">
                              This batch execution will safely pivot <strong className="text-slate-800">Online (Paystack)</strong> payments back into the respective student Fee Wallets based on your selected mode. <strong className="text-rose-600">Manual payments (Cash/Tellers) will be stripped and require re-uploading.</strong>
                           </p>
                        </div>
                     </div>
                  )}
                </div>
              )}

            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
              {wizardStep > 1 ? (
                <button onClick={() => setWizardStep(prev => (prev - 1) as any)} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
                  Go Back
                </button>
              ) : <div></div>}

              {wizardStep === 1 && (
                <button
                  onClick={fetchInvoicesForVoiding}
                  disabled={!filterSessionId || !filterPeriodId || (scopeType === 'class' && !filterClassId) || (scopeType === 'student' && studentSearchInput.length < 3) || invoicesLoading}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {invoicesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Fetch Invoices'} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {wizardStep === 2 && (
                <button
                  onClick={() => setWizardStep(3)}
                  disabled={selectedStats.count === 0}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  Review Execution <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {wizardStep === 3 && (
                <button
                  onClick={executeAtomicRebill}
                  disabled={isExecuting || !batchTitle.trim() || batchReason.trim().length < 5}
                  className="px-5 py-2.5 bg-rose-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-rose-700 shadow-md shadow-rose-200 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />} Execute Batch
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ─── Discard Confirm ─── */}
      {closeConfirmOpen && (
        <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setCloseConfirmOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 bg-amber-50 text-amber-600 border border-amber-100">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1.5">Discard progress?</h3>
            <p className="text-xs text-slate-500 text-center mb-5 leading-relaxed font-medium">
              You have unsaved selections in this wizard. Closing now will discard them entirely.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setCloseConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Keep Editing</button>
              <button onClick={confirmCloseWizard} className="flex-1 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}