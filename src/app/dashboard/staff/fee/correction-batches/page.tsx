'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicCalendarAPI, academicAPI, feeAPI } from '@/lib/api';
import { Session, AcademicSessionPeriod, ClassModel } from '@/lib/types';
import {
  AlertCircle, X, Loader2, Search, History, AlertTriangle, ArrowRight,
  RotateCcw, CheckCircle2, Info, Zap, Wallet, FileText,
  ChevronLeft, ChevronRight, Eye, ShieldAlert, Calendar, Layers,
  HelpCircle, Clock, XCircle
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
  status: 'pending' | 'in_progress' | 'success' | 'partial' | 'failure';
  status_display: string;
  created_by_name: string;
  created_at: string;
  total_targets: number;
  processed_targets: number;
  failed_targets: number;
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

interface RebillStatus {
  id: number;
  status: 'pending' | 'in_progress' | 'success' | 'partial' | 'failure';
  status_display: string;
  is_complete: boolean;
  total_targets: number;
  processed_targets: number;
  failed_targets: number;
  progress_pct: number;
  error_message: string | null;
}

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
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border sm:max-w-sm transition-all animate-in slide-in-from-right-4
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
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // ~5 minutes

// ─── Execution Mode Copy (plain language, not developer-speak) ───────────────
const EXECUTION_MODE_COPY: Record<ExecutionMode, { title: string; description: string; recommended?: boolean; accent: string }> = {
  void_only: {
    title: 'Cancel Only — Refund to Wallet',
    description: 'Cancels the wrong invoice. Online payments go back into the student\'s wallet. Cash/teller payments are removed from today\'s cash records — the accountant must re-lodge that teller slip once the corrected invoice is ready.',
    accent: 'rose',
  },
  void_and_regenerate: {
    title: 'Cancel & Reissue — Don\'t Auto-Pay',
    description: 'Cancels the wrong invoice and immediately creates the corrected one. Online funds move to the wallet, but nobody\'s payment is applied to the new invoice automatically — staff apply it manually afterward.',
    accent: 'amber',
  },
  void_regenerate_and_reapply: {
    title: 'Cancel, Reissue & Auto-Pay (Recommended)',
    description: 'Cancels the wrong invoice, creates the corrected one, and automatically applies every payment already made — cash, transfer, or online — to the new invoice. Nobody needs to pay twice or re-upload a teller slip.',
    recommended: true,
    accent: 'emerald',
  },
};

// ─── Help Modal ────────────────────────────────────────────────────────────
function HowThisWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[140] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <HelpCircle className="h-4 w-4 text-rose-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">How Invoice Correction Works</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>
            Use this when an invoice was billed with the <strong>wrong amount or wrong items</strong> and needs to be
            replaced. It cancels ("voids") the incorrect invoice and — depending on the option you pick — creates a
            corrected one and moves any payment across automatically.
          </p>
          <div className="space-y-3">
            {(Object.keys(EXECUTION_MODE_COPY) as ExecutionMode[]).map(key => {
              const mode = EXECUTION_MODE_COPY[key];
              return (
                <div key={key} className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                  <p className="text-xs font-bold text-slate-800 mb-1">{mode.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{mode.description}</p>
                </div>
              );
            })}
          </div>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-2.5">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              This can only be run on the <strong>current or a future term</strong> — past, closed terms are locked and
              cannot be corrected this way.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Once started, correction can take a little while for large groups (a whole class, for example). You can
            close this window and keep working — a progress bar will show at the top of the page until it's done.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Active Correction Progress Banner ────────────────────────────────────
function ActiveCorrectionBanner({ status }: { status: RebillStatus }) {
  const isDone = status.is_complete;
  const hasFailures = status.failed_targets > 0;

  let icon = <Loader2 className="h-4 w-4 animate-spin text-rose-600" />;
  let bg = 'bg-white border-slate-200';
  let label = `Processing correction — ${status.processed_targets} of ${status.total_targets}`;

  if (isDone) {
    if (status.status === 'success') {
      icon = <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      bg = 'bg-emerald-50 border-emerald-200';
      label = `Correction complete — ${status.processed_targets} record(s) fixed`;
    } else if (status.status === 'partial') {
      icon = <AlertTriangle className="h-4 w-4 text-amber-600" />;
      bg = 'bg-amber-50 border-amber-200';
      label = `Completed with ${status.failed_targets} issue(s) — check the ledger for details`;
    } else {
      icon = <XCircle className="h-4 w-4 text-red-600" />;
      bg = 'bg-red-50 border-red-200';
      label = status.error_message || 'Correction failed to complete.';
    }
  } else if (hasFailures) {
    bg = 'bg-amber-50 border-amber-200';
  }

  return (
    <div className={`rounded-xl border p-3.5 flex items-center gap-3 ${bg} animate-in slide-in-from-top-2`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 truncate">{label}</p>
        {!isDone && (
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${status.progress_pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

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

  // Help modal
  const [showHelp, setShowHelp] = useState(false);

  // Background correction progress (survives wizard close)
  const [activeStatus, setActiveStatus] = useState<RebillStatus | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Clean up any pending poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

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
       params.student__current_class = filterClassId;
       if (filterSectionId) params.student__current_class_section = filterSectionId;
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

  // ── Background polling for the queued correction ──
  // ── Background polling for the queued correction ──
  const pollRebillStatus = useCallback((batchId: number, attempt = 0) => {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      showToast('error', 'Still processing — check the ledger shortly, this is taking longer than expected.');
      setActiveStatus(null); // Clear the banner so it doesn't stay stuck
      return;
    }

    pollTimeoutRef.current = setTimeout(async () => {
      try {
        const data: RebillStatus = await feeAPI.getRebillStatus(batchId);
        setActiveStatus(data);

        if (data.is_complete) {
          if (data.status === 'success') {
            showToast('success', `Correction complete — ${data.processed_targets} record(s) fixed.`);
          } else if (data.status === 'partial') {
            showToast('error', `Completed with ${data.failed_targets} issue(s). Open the correction in the ledger to see which records need a look.`);
          } else {
            showToast('error', data.error_message || 'Correction failed to complete.');
          }
          fetchBatches();
          // Keep the banner visible briefly so the accountant sees the final state
          setTimeout(() => setActiveStatus(null), 6000);
          return;
        }

        // If not complete, queue the next poll
        pollRebillStatus(batchId, attempt + 1);

      } catch (err) {
        // RESILIENCE UPGRADE: Don't kill the loop on a network hiccup!
        console.warn(`Poll attempt ${attempt} failed, retrying...`, err);
        // We queue the next attempt anyway. If the server is truly dead,
        // it will eventually hit MAX_POLL_ATTEMPTS and gracefully exit.
        pollRebillStatus(batchId, attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  }, [fetchBatches, showToast]);



  const executeAtomicRebill = async () => {
    const totalSelected = selectedStudentInvoiceIds.size + selectedFamilyInvoiceIds.size;
    if (totalSelected === 0) return showToast('error', 'Select at least one invoice.');
    if (!batchTitle.trim()) return showToast('error', 'A title is required.');
    if (batchReason.trim().length < 5) return showToast('error', 'A detailed reason is required for the audit ledger.');

    setIsExecuting(true);
    try {
      const batch: CorrectionBatch = await feeAPI.executeAtomicRebill({
        title: batchTitle.trim(),
        reason: batchReason.trim(),
        execution_mode: executionMode,
        student_invoice_ids: Array.from(selectedStudentInvoiceIds),
        family_invoice_ids: Array.from(selectedFamilyInvoiceIds),
      });

      setIsWizardOpen(false);
      resetWizardScope();
      showToast('success', 'Correction queued — processing now. You can keep working.');

      setActiveStatus({
        id: batch.id,
        status: 'pending',
        status_display: 'Pending',
        is_complete: false,
        total_targets: totalSelected,
        processed_targets: 0,
        failed_targets: 0,
        progress_pct: 0,
        error_message: null,
      });
      pollRebillStatus(batch.id);
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
      `COR-${b.id}`.toLowerCase().includes(term)
    );
  }, [batches, ledgerSearch]);

  const ledgerTotalPages = Math.max(1, Math.ceil(filteredBatches.length / LEDGER_PAGE_SIZE));
  const ledgerSafePage = Math.min(ledgerPage, ledgerTotalPages);
  const pagedBatches = filteredBatches.slice((ledgerSafePage - 1) * LEDGER_PAGE_SIZE, ledgerSafePage * LEDGER_PAGE_SIZE);

  const statusPillClasses = (s: CorrectionBatch['status']) => {
    switch (s) {
      case 'success': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'partial': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'failure': return 'bg-red-50 text-red-700 border-red-100';
      case 'in_progress': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  if (loading) return (
    <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-rose-600" />
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading Ledger...</p>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-5 pb-20 max-w-7xl mx-auto px-3 sm:px-0">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
      {showHelp && <HowThisWorksModal onClose={() => setShowHelp(false)} />}

      {activeStatus && <ActiveCorrectionBanner status={activeStatus} />}

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
            <RotateCcw className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-bold text-slate-900">Invoice Corrections</h1>
              <button onClick={() => setShowHelp(true)} className="text-slate-300 hover:text-rose-500 transition-colors" title="How this works">
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Fix a wrong invoice — cancel it and reissue the corrected one.</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => { setIsWizardOpen(true); setWizardStep(1); }} className="w-full md:w-auto justify-center px-4 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-2 whitespace-nowrap">
            <Zap className="h-4 w-4" /> Fix an Invoice
          </button>
        )}
      </div>

      {/* ─── KPI ─── */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 inline-flex items-center gap-3.5 w-full sm:w-auto">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <History className="w-4 h-4 text-slate-600" />
        </div>
        <div>
          <p className="text-lg font-black text-slate-800 leading-none">{batches.length}{batchesHitCap ? '+' : ''}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Corrections Run</p>
        </div>
      </div>

      {/* ─── Ledger History Table ─── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-rose-500" />
            <h3 className="font-bold text-slate-800 text-sm">Correction History</h3>
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
          <div className="px-4 sm:px-5 py-2 bg-amber-50 border-b border-amber-100 text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Showing the {LEDGER_FETCH_CAP} most recent. Narrow your search to see older records.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-28 sm:w-32">ID</th>
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title & Reason</th>
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Staff</th>
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center hidden sm:table-cell">Invoices</th>
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right hidden md:table-cell">Timestamp</th>
                <th className="px-3 sm:px-5 py-3 w-12 sm:w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm font-medium">
                    {ledgerSearch ? 'No corrections match your search.' : 'No corrections have been run yet.'}
                  </td>
                </tr>
              ) : (
                pagedBatches.map((batch) => {
                   const sCount = batch.affected_student_invoices?.length || 0;
                   const fCount = batch.affected_family_invoices?.length || 0;
                   return (
                     <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors group">
                       <td className="px-3 sm:px-5 py-3 sm:py-3.5">
                         <span className="text-[10px] sm:text-xs font-bold font-mono text-rose-700 bg-rose-50 px-2 sm:px-2.5 py-1 rounded-md border border-rose-100">
                           COR-{batch.id.toString().padStart(4, '0')}
                         </span>
                       </td>
                       <td className="px-3 sm:px-5 py-3 sm:py-3.5">
                         <p className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-1">{batch.title}</p>
                         <p className="text-[11px] sm:text-xs text-slate-500 max-w-xs sm:max-w-sm truncate mt-0.5" title={batch.reason}>{batch.reason}</p>
                       </td>
                       <td className="px-3 sm:px-5 py-3.5 font-semibold text-slate-700 text-xs hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                               {batch.created_by_name?.charAt(0)}
                            </div>
                            <span className="truncate max-w-[120px]" title={batch.created_by_name}>{batch.created_by_name}</span>
                          </div>
                       </td>
                       <td className="px-3 sm:px-5 py-3.5 text-center">
                          <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase rounded-md tracking-wider border inline-block ${statusPillClasses(batch.status)}`}>
                             {batch.status_display || batch.status}
                          </span>
                          {batch.status === 'in_progress' && (
                            <p className="text-[9px] text-slate-400 font-semibold mt-1">{batch.processed_targets}/{batch.total_targets}</p>
                          )}
                       </td>
                       <td className="px-3 sm:px-5 py-3.5 text-center hidden sm:table-cell">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-md tracking-wider border border-slate-200">
                             {sCount + fCount}
                          </span>
                       </td>
                       <td className="px-3 sm:px-5 py-3.5 text-right text-xs font-semibold text-slate-400 hidden md:table-cell">
                         {new Date(batch.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                       </td>
                       <td className="px-3 sm:px-5 py-3.5 text-right">
                          <button
                             onClick={() => router.push(`/dashboard/staff/fee/correction-batches/${batch.id}`)}
                             className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                             title="View details"
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
          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500">
              {((ledgerSafePage - 1) * LEDGER_PAGE_SIZE) + 1}–{Math.min(ledgerSafePage * LEDGER_PAGE_SIZE, filteredBatches.length)} of{' '}
              <span className="font-bold text-slate-700">{filteredBatches.length}</span>
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

      {/* ─── Correction Wizard Drawer ─── */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full sm:max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right-8 duration-300">

            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Invoice Correction Wizard</h2>
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">Step {wizardStep} of 3</p>
                </div>
              </div>
              <button onClick={attemptCloseWizard} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">

              {/* STEP 1: SCOPE DEFINITION */}
              {wizardStep === 1 && (
                <div className="max-w-xl mx-auto space-y-4 sm:space-y-5 animate-in zoom-in-95">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium text-amber-800 leading-relaxed">
                      You can only correct invoices from the <strong>current or a future term</strong>. Past, closed terms are locked.
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                     <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-rose-500" /> 1. Which Term?
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
                              <p className="text-[9px] text-amber-600 font-semibold mt-1.5">Past terms are locked.</p>
                           )}
                        </div>
                     </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                     <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-rose-500" /> 2. Who Is This For?
                     </h3>

                     <div className="space-y-4">
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Bill Type</label>
                           <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                              <button onClick={() => setInvoiceDocType('student')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${invoiceDocType === 'student' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Student Bills</button>
                              <button onClick={() => setInvoiceDocType('family')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${invoiceDocType === 'family' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Family Bills</button>
                              <button onClick={() => setInvoiceDocType('both')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${invoiceDocType === 'both' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Both</button>
                           </div>
                        </div>

                        <hr className="border-slate-100" />

                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">How Many Students?</label>
                           <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg mb-3">
                              <button onClick={() => setScopeType('term')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${scopeType === 'term' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Whole Term</button>
                              <button onClick={() => setScopeType('class')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${scopeType === 'class' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>One Class</button>
                              <button onClick={() => setScopeType('student')} className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${scopeType === 'student' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>One Student</button>
                           </div>

                           {scopeType === 'class' && (
                              <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                                 <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">Class</label>
                                    <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500">
                                       <option value="">Select Class...</option>
                                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">Arm <span className="lowercase font-normal opacity-70">(Optional)</span></label>
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                     <div>
                        <h3 className="text-sm font-bold text-slate-900">Select Invoices to Correct</h3>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Found {fetchedInvoices.length} matching invoices</p>
                     </div>
                     <div className="relative w-full sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input type="text" placeholder="Filter list..." value={tableSearch} onChange={e => setTableSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500" />
                     </div>
                  </div>

                  <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                     <div className="overflow-y-auto flex-1">
                        <table className="w-full text-left">
                           <thead className="bg-slate-50/90 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-sm">
                              <tr>
                                 <th className="px-3 sm:px-4 py-2.5 w-10 text-center">
                                    <input type="checkbox" checked={selectedStats.count > 0 && selectedStats.count === filteredInvoices.length} onChange={toggleAllInvoices} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer" />
                                 </th>
                                 <th className="px-3 sm:px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Type</th>
                                 <th className="px-3 sm:px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Billed To</th>
                                 <th className="px-3 sm:px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                 <th className="px-3 sm:px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right hidden sm:table-cell">Paid</th>
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
                                          <td className="px-3 sm:px-4 py-2.5 text-center">
                                             <input type="checkbox" checked={isSelected} readOnly className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 pointer-events-none" />
                                          </td>
                                          <td className="px-3 sm:px-4 py-2.5 hidden sm:table-cell">
                                             {inv._type === 'student'
                                                ? <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-widest rounded border border-slate-200">Student</span>
                                                : <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 text-[9px] font-bold uppercase tracking-widest rounded border border-rose-100">Family</span>
                                             }
                                          </td>
                                          <td className="px-3 sm:px-4 py-2.5">
                                             <p className="font-semibold text-slate-800 text-xs">{inv.billed_name}</p>
                                             <p className="text-[10px] font-mono font-medium text-slate-400 mt-0.5">{inv.invoice_number}</p>
                                          </td>
                                          <td className="px-3 sm:px-4 py-2.5 text-right font-bold text-slate-700 text-xs">{formatCurrency(inv.total_amount)}</td>
                                          <td className="px-3 sm:px-4 py-2.5 text-right hidden sm:table-cell">
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
                     <div className="px-3 sm:px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest"><span className="text-rose-600">{selectedStats.count}</span> Selected</p>
                        <p className="text-xs font-bold text-slate-800">Total: {formatCurrency(selectedStats.voidValue)}</p>
                     </div>
                  </div>
                </div>
              )}

              {/* STEP 3: EXECUTION & PIVOT */}
              {wizardStep === 3 && (
                <div className="max-w-xl mx-auto space-y-5 sm:space-y-6 animate-in slide-in-from-right-4">

                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">1. Give This Correction a Name <span className="text-rose-500">*</span></label>
                     <input
                       type="text"
                       value={batchTitle}
                       onChange={e => setBatchTitle(e.target.value)}
                       placeholder="e.g. Primary 5 Fee Structure Correction"
                       className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-sm"
                     />
                  </div>

                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">2. What Should Happen to Payments Already Made?</label>
                     <div className="grid grid-cols-1 gap-2.5">
                        {(Object.keys(EXECUTION_MODE_COPY) as ExecutionMode[]).map(key => {
                          const mode = EXECUTION_MODE_COPY[key];
                          const isActive = executionMode === key;
                          const ringClass = mode.accent === 'rose' ? 'border-rose-500 bg-rose-50/50'
                            : mode.accent === 'amber' ? 'border-amber-500 bg-amber-50/50'
                            : 'border-emerald-500 bg-emerald-50/50';
                          const dotClass = mode.accent === 'rose' ? 'border-rose-500' : mode.accent === 'amber' ? 'border-amber-500' : 'border-emerald-500';
                          const dotFillClass = mode.accent === 'rose' ? 'bg-rose-500' : mode.accent === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
                          return (
                            <div key={key} onClick={() => setExecutionMode(key)} className={`p-3.5 rounded-xl border cursor-pointer transition-all ${isActive ? `${ringClass} shadow-sm` : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                               <div className="flex items-center gap-2.5 mb-1">
                                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${isActive ? dotClass : 'border-slate-300'}`}>
                                     {isActive && <div className={`w-1.5 h-1.5 rounded-full ${dotFillClass}`} />}
                                  </div>
                                  <h4 className="text-sm font-bold text-slate-800">{mode.title}</h4>
                               </div>
                               <p className="text-[11px] text-slate-500 font-medium pl-6 leading-relaxed">{mode.description}</p>
                            </div>
                          );
                        })}
                     </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">3. Why Is This Correction Needed? <span className="text-rose-500">*</span></label>
                    <textarea
                      rows={3}
                      value={batchReason}
                      onChange={e => setBatchReason(e.target.value)}
                      placeholder="Detail exactly why this correction was made, for the permanent audit record..."
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none shadow-sm"
                    />
                  </div>

                  {selectedStats.pivotValue > 0 && (
                     <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex gap-3">
                        <Wallet className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                           <p className="text-xs font-bold text-slate-700">Existing Payments Detected</p>
                           <p className="text-[11px] font-medium text-slate-500 mt-1 leading-relaxed">
                              Online (Paystack) payments are always moved safely into the student's wallet.{' '}
                              <strong className="text-rose-600">
                                {executionMode === 'void_regenerate_and_reapply'
                                  ? 'Cash/teller payments will be carried straight onto the corrected invoice — no re-upload needed.'
                                  : 'Cash/teller payments will need to be re-lodged once the corrected invoice is ready.'}
                              </strong>
                           </p>
                        </div>
                     </div>
                  )}
                </div>
              )}

            </div>

            {/* Drawer Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
              {wizardStep > 1 ? (
                <button onClick={() => setWizardStep(prev => (prev - 1) as any)} className="px-3 sm:px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
                  Go Back
                </button>
              ) : <div></div>}

              {wizardStep === 1 && (
                <button
                  onClick={fetchInvoicesForVoiding}
                  disabled={!filterSessionId || !filterPeriodId || (scopeType === 'class' && !filterClassId) || (scopeType === 'student' && studentSearchInput.length < 3) || invoicesLoading}
                  className="px-4 sm:px-5 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {invoicesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Find Invoices'} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {wizardStep === 2 && (
                <button
                  onClick={() => setWizardStep(3)}
                  disabled={selectedStats.count === 0}
                  className="px-4 sm:px-5 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  Review <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {wizardStep === 3 && (
                <button
                  onClick={executeAtomicRebill}
                  disabled={isExecuting || !batchTitle.trim() || batchReason.trim().length < 5}
                  className="px-4 sm:px-5 py-2.5 bg-rose-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-rose-700 shadow-md shadow-rose-200 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />} Run Correction
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