'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, academicCalendarAPI, studentsAPI } from '@/lib/api';
import { Session, AcademicSessionPeriod, ClassModel, Student } from '@/lib/types';
import {
  AlertCircle, X, Loader2, Search, History, AlertTriangle, ArrowRight,
  CheckCircle2, Info, Zap, FileText, ChevronLeft, ChevronRight, Eye,
  ShieldAlert, Calendar, Layers, HelpCircle, XCircle, TrendingUp, Users, Play
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface PromotionBatch {
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
  progress_pct: number;
  error_message: string | null;
}

interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

let _toastId = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractError(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[140] flex flex-col gap-2 pointer-events-none">
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
const MAX_POLL_ATTEMPTS = 150;

// ─── Help Modal ────────────────────────────────────────────────────────────
function HowThisWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[140] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <HelpCircle className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">How Automated Promotions Work</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>
            This tool safely transitions students to their next academic class or marks them as graduated at the end of a session, strictly following the mappings defined in your <strong>Promotion Config</strong>.
          </p>
          <div className="space-y-3">
             <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                <p className="text-xs font-bold text-slate-800 mb-1">Safety First: No Double Promotions</p>
                <p className="text-xs text-slate-500 leading-relaxed">The system maintains a rigid history ledger. If you run a Whole School promotion twice, it automatically skips students who were already promoted in the selected session.</p>
             </div>
             <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                <p className="text-xs font-bold text-slate-800 mb-1">Double Promotions / Demotions</p>
                <p className="text-xs text-slate-500 leading-relaxed">To intentionally bypass the safety lock and double promote a student, you must run the batch using the <strong>Individual Student</strong> scope.</p>
             </div>
          </div>
          <p className="text-xs text-slate-400">
            Promotion batches run securely in the background. You can close the wizard and continue using the system while the batch processes hundreds of students.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Active Progress Banner ────────────────────────────────────
function ActivePromotionBanner({ status }: { status: PromotionBatch }) {
  const isDone = ['success', 'partial', 'failure'].includes(status.status);
  const hasFailures = status.failed_targets > 0;

  let icon = <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
  let bg = 'bg-white border-slate-200';
  let label = `Processing promotions — ${status.processed_targets} of ${status.total_targets}`;

  if (isDone) {
    if (status.status === 'success') {
      icon = <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      bg = 'bg-emerald-50 border-emerald-200';
      label = `Promotion complete — ${status.processed_targets} student(s) transitioned`;
    } else if (status.status === 'partial') {
      icon = <AlertTriangle className="h-4 w-4 text-amber-600" />;
      bg = 'bg-amber-50 border-amber-200';
      label = `Completed with ${status.failed_targets} issue(s) — missing mappings or system errors`;
    } else {
      icon = <XCircle className="h-4 w-4 text-red-600" />;
      bg = 'bg-red-50 border-red-200';
      label = status.error_message || 'Promotion batch failed to complete.';
    }
  } else if (hasFailures) {
    bg = 'bg-amber-50 border-amber-200';
  }

  return (
    <div className={`rounded-xl border p-3.5 flex items-center gap-3 ${bg} animate-in slide-in-from-top-2`}>
      {icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-800 truncate">{label}</p>
            <p className="text-xs font-bold text-slate-500">{status.progress_pct}%</p>
        </div>
        {!isDone && (
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${status.progress_pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function PromotionsPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('academic_structure.manage_promotions');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 6000);
  }, []);

  // System Data
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<PromotionBatch[]>([]);
  const [batchesHitCap, setBatchesHitCap] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);

  // Ledger State
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [showHelp, setShowHelp] = useState(false);

  // Background polling (survives wizard close)
  const [activeStatus, setActiveStatus] = useState<PromotionBatch | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wizard General State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [preCheckData, setPreCheckData] = useState<any>(null);

  // Step 1: Scope Settings
  const [scopeType, setScopeType] = useState<'school' | 'class' | 'individual'>('school');
  const [filterSessionId, setFilterSessionId] = useState<string>('');

  // Scopes Target State
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchedStudents, setSearchedStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Step 2: Payload
  const [batchTitle, setBatchTitle] = useState('');
  const [batchReason, setBatchReason] = useState('');

  // ─── Data Loading ──────────────────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    try {
      const res = await academicAPI.getPromotionBatches({ page_size: LEDGER_FETCH_CAP });
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
      const [sessRes, perRes, clsRes] = await Promise.all([
        academicCalendarAPI.listSessions(),
        academicCalendarAPI.listSessionPeriods(),
        academicAPI.listClasses({ is_active: true })
      ]);
      setSessions(sessRes);
      setPeriods(perRes);
      setClasses(clsRes);
      await fetchBatches();

      const currentSess = sessRes.find((s: any) => s.is_active);
      if (currentSess) setFilterSessionId(currentSess.id.toString());

    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [fetchBatches, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    return () => { if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current); };
  }, []);

  // Student Search Effect
  useEffect(() => {
    if (scopeType !== 'individual' || studentSearch.length < 3) {
       setSearchedStudents([]);
       return;
    }
    const timer = setTimeout(async () => {
       setIsSearching(true);
       try {
          const res = await studentsAPI.list({ search: studentSearch, page_size: 10 } as any);
          setSearchedStudents(res.results || []);
       } catch (err) {
          console.error(err);
       } finally {
          setIsSearching(false);
       }
    }, 500);
    return () => clearTimeout(timer);
  }, [studentSearch, scopeType]);

  // ─── Wizard Actions ────────────────────────────────────────────────────────
  const runPreCheck = async () => {
    try {
      const data = await academicAPI.promotionPreCheck();
      setPreCheckData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openWizard = () => {
    setIsWizardOpen(true);
    setWizardStep(1);
    runPreCheck();
  };

  const resetWizardScope = () => {
    setWizardStep(1);
    setScopeType('school');
    setBatchTitle('');
    setBatchReason('');
    setSelectedClassIds([]);
    setSelectedStudents([]);
    setStudentSearch('');
    setSearchedStudents([]);
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

  // ── Background polling ──
  const pollBatchStatus = useCallback((batchId: number, attempt = 0) => {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      showToast('error', 'Still processing — check the ledger shortly.');
      setActiveStatus(null);
      return;
    }

    pollTimeoutRef.current = setTimeout(async () => {
      try {
        const data: PromotionBatch = await academicAPI.getPromotionBatchStatus(batchId);
        setActiveStatus(data);

        if (['success', 'partial', 'failure'].includes(data.status)) {
          if (data.status === 'success') {
            showToast('success', `Promotion complete — ${data.processed_targets} student(s) transitioned.`);
          } else if (data.status === 'partial') {
            showToast('error', `Completed with ${data.failed_targets} issue(s). Check missing mappings.`);
          } else {
            showToast('error', data.error_message || 'Promotion failed to complete.');
          }
          fetchBatches();
          setTimeout(() => setActiveStatus(null), 6000);
          return;
        }

        pollBatchStatus(batchId, attempt + 1);
      } catch (err) {
        console.warn(`Poll attempt ${attempt} failed, retrying...`, err);
        pollBatchStatus(batchId, attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  }, [fetchBatches, showToast]);

  const executePromotion = async () => {
    if (!filterSessionId) return showToast('error', 'Session is required.');
    if (!batchTitle.trim()) return showToast('error', 'A title is required.');
    if (scopeType === 'class' && selectedClassIds.length === 0) return showToast('error', 'Select at least one class.');
    if (scopeType === 'individual' && selectedStudents.length === 0) return showToast('error', 'Select at least one student.');

    setIsExecuting(true);
    try {
      const batch: PromotionBatch = await academicAPI.executePromotionBatch({
        title: batchTitle.trim(),
        reason: batchReason.trim(),
        scope_type: scopeType,
        session_id: parseInt(filterSessionId),
        target_class_ids: scopeType === 'class' ? selectedClassIds : undefined,
        target_student_ids: scopeType === 'individual' ? selectedStudents.map(s => s.id) : undefined,
      });

      setIsWizardOpen(false);
      resetWizardScope();
      showToast('success', 'Promotion batch queued — processing now.');

      setActiveStatus(batch);
      pollBatchStatus(batch.id);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsExecuting(false);
    }
  };

  // ── Ledger Pagination ──
  useEffect(() => { setLedgerPage(1); }, [ledgerSearch]);

  const filteredBatches = useMemo(() => {
    if (!ledgerSearch.trim()) return batches;
    const term = ledgerSearch.trim().toLowerCase();
    return batches.filter(b =>
      b.title?.toLowerCase().includes(term) ||
      b.reason?.toLowerCase().includes(term) ||
      b.created_by_name?.toLowerCase().includes(term) ||
      `PRM-${b.id}`.toLowerCase().includes(term)
    );
  }, [batches, ledgerSearch]);

  const ledgerTotalPages = Math.max(1, Math.ceil(filteredBatches.length / LEDGER_PAGE_SIZE));
  const ledgerSafePage = Math.min(ledgerPage, ledgerTotalPages);
  const pagedBatches = filteredBatches.slice((ledgerSafePage - 1) * LEDGER_PAGE_SIZE, ledgerSafePage * LEDGER_PAGE_SIZE);

  const statusPillClasses = (s: PromotionBatch['status']) => {
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
      <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading Ledger...</p>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-5 pb-20 max-w-7xl mx-auto px-3 sm:px-0">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
      {showHelp && <HowThisWorksModal onClose={() => setShowHelp(false)} />}

      {activeStatus && <ActivePromotionBanner status={activeStatus} />}

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-bold text-slate-900">Automated Promotions</h1>
              <button onClick={() => setShowHelp(true)} className="text-slate-300 hover:text-blue-500 transition-colors" title="How this works">
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Safely transition students to their next class based on mappings.</p>
          </div>
        </div>
        {canManage && (
          <button onClick={openWizard} className="w-full md:w-auto justify-center px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap">
            <Zap className="h-4 w-4" /> Run Promotion
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
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Batches Run</p>
        </div>
      </div>

      {/* ─── Ledger History Table ─── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <h3 className="font-bold text-slate-800 text-sm">Batch History</h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={ledgerSearch}
              onChange={e => setLedgerSearch(e.target.value)}
              placeholder="Search batches..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-28 sm:w-32">ID</th>
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title & Reason</th>
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Staff</th>
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-3 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right hidden md:table-cell">Timestamp</th>
                <th className="px-3 sm:px-5 py-3 w-12 sm:w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-sm font-medium">
                    No promotions have been run yet.
                  </td>
                </tr>
              ) : (
                pagedBatches.map((batch) => (
                     <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors group">
                       <td className="px-3 sm:px-5 py-3 sm:py-3.5">
                         <span className="text-[10px] sm:text-xs font-bold font-mono text-blue-700 bg-blue-50 px-2 sm:px-2.5 py-1 rounded-md border border-blue-100">
                           PRM-{batch.id.toString().padStart(4, '0')}
                         </span>
                       </td>
                       <td className="px-3 sm:px-5 py-3 sm:py-3.5">
                         <p className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-1">{batch.title}</p>
                         <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{batch.reason}</p>
                       </td>
                       <td className="px-3 sm:px-5 py-3.5 font-semibold text-slate-700 text-xs hidden sm:table-cell">
                         {batch.created_by_name}
                       </td>
                       <td className="px-3 sm:px-5 py-3.5 text-center">
                          <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase rounded-md tracking-wider border inline-block ${statusPillClasses(batch.status)}`}>
                             {batch.status_display || batch.status}
                          </span>
                          {batch.status === 'in_progress' && (
                            <p className="text-[9px] text-slate-400 font-semibold mt-1">{batch.processed_targets}/{batch.total_targets}</p>
                          )}
                       </td>
                       <td className="px-3 sm:px-5 py-3.5 text-right text-xs font-semibold text-slate-400 hidden md:table-cell">
                         {new Date(batch.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                       </td>
                     </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Drawer Wizard ─── */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full sm:max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right-8 duration-300">

            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Run Promotion Batch</h2>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Step {wizardStep} of 2</p>
                </div>
              </div>
              <button onClick={attemptCloseWizard} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
              {wizardStep === 1 && (
                <div className="max-w-xl mx-auto space-y-4 sm:space-y-5 animate-in zoom-in-95">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                     <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-blue-500" /> 1. Academic Scope
                     </h3>
                     <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Base Session</label>
                        <select value={filterSessionId} onChange={e => setFilterSessionId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                           {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">Double promotions are validated against this session.</p>
                     </div>

                     <div className="pt-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Execution Scope</label>
                        <select value={scopeType} onChange={e => {
                           setScopeType(e.target.value as any);
                           setSelectedClassIds([]);
                           setSelectedStudents([]);
                           setStudentSearch('');
                        }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                           <option value="school">Whole School (Safe Auto-Skipping)</option>
                           <option value="class">Specific Class(es)</option>
                           <option value="individual">Individual Students</option>
                        </select>
                     </div>

                     {/* Dynamic Class Target Select */}
                     {scopeType === 'class' && (
                        <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                           <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Select Target Classes</label>
                           <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                              {classes.map(cls => (
                                 <label key={cls.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 p-1.5 hover:bg-slate-100 rounded cursor-pointer transition-colors">
                                    <input
                                       type="checkbox"
                                       checked={selectedClassIds.includes(cls.id)}
                                       onChange={(e) => {
                                          if (e.target.checked) setSelectedClassIds(p => [...p, cls.id]);
                                          else setSelectedClassIds(p => p.filter(id => id !== cls.id));
                                       }}
                                       className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    {cls.name}
                                 </label>
                              ))}
                           </div>
                        </div>
                     )}

                     {/* Dynamic Individual Student Select */}
                     {scopeType === 'individual' && (
                        <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                           <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Search & Select Students</label>
                           <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <input
                                 type="text"
                                 value={studentSearch}
                                 onChange={e => setStudentSearch(e.target.value)}
                                 placeholder="Type student name or ID..."
                                 className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-500 animate-spin" />}
                           </div>

                           {searchedStudents.length > 0 && (
                              <div className="mt-2 p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                                 {searchedStudents.map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded text-xs">
                                       <div>
                                          <p className="font-semibold text-slate-800">{student.first_name} {student.last_name}</p>
                                          <p className="text-[10px] text-slate-500">{student.admission_number || 'No ID'}</p>
                                       </div>
                                       <ButtonRaw
                                          variant="secondary"
                                          className="py-1 px-2 text-[10px]"
                                          disabled={selectedStudents.some(s => s.id === student.id)}
                                          onClick={() => {
                                             setSelectedStudents(p => [...p, student]);
                                             setStudentSearch('');
                                             setSearchedStudents([]);
                                          }}
                                       >
                                          {selectedStudents.some(s => s.id === student.id) ? 'Added' : 'Add'}
                                       </ButtonRaw>
                                    </div>
                                 ))}
                              </div>
                           )}

                           {selectedStudents.length > 0 && (
                              <div className="mt-4">
                                 <p className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Selected Students ({selectedStudents.length})</p>
                                 <div className="flex flex-wrap gap-2">
                                    {selectedStudents.map(student => (
                                       <div key={student.id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 px-2 py-1 rounded text-[11px] font-medium">
                                          {student.first_name} {student.last_name}
                                          <button onClick={() => setSelectedStudents(p => p.filter(s => s.id !== student.id))} className="hover:bg-blue-100 rounded-full p-0.5">
                                             <X className="h-3 w-3" />
                                          </button>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}
                        </div>
                     )}

                  </div>

                  {preCheckData && (
                     <div className={`rounded-xl border p-4 ${preCheckData.is_end_of_session ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-start gap-2.5">
                           {preCheckData.is_end_of_session ? <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />}
                           <div>
                              <p className="text-sm font-bold text-slate-900">Term Detection</p>
                              <p className={`text-xs mt-1 leading-relaxed ${preCheckData.is_end_of_session ? 'text-emerald-700' : 'text-amber-800'}`}>
                                 {preCheckData.is_end_of_session
                                    ? "This is marked as an end-of-session period. Safe to proceed with promotions."
                                    : "This is NOT an end-of-session period. Promoting now may be premature unless fixing data."}
                              </p>
                           </div>
                        </div>
                     </div>
                  )}

                  {preCheckData?.missing_mappings && preCheckData.missing_mappings.length > 0 && (
                     <div className="rounded-xl border bg-red-50 border-red-200 p-4">
                        <div className="flex items-start gap-2.5">
                           <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                           <div>
                              <p className="text-sm font-bold text-red-900">Missing Mappings Detected</p>
                              <p className="text-xs text-red-700 mt-1">
                                 <strong>{preCheckData.missing_mappings.length}</strong> active classes have no next-class assigned.
                                 They will be skipped. Fix them in Promotion Config to include them.
                              </p>
                           </div>
                        </div>
                     </div>
                  )}
                </div>
              )}

              {wizardStep === 2 && (
                <div className="max-w-xl mx-auto space-y-4 sm:space-y-5 animate-in zoom-in-95">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                     <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-500" /> 2. Finalize
                     </h3>

                     <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Batch Title *</label>
                        <input type="text" value={batchTitle} onChange={e => setBatchTitle(e.target.value)} placeholder="e.g. 2025/2026 End of Year Promotion" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Reason / Notes</label>
                        <textarea value={batchReason} onChange={e => setBatchReason(e.target.value)} rows={3} placeholder="Optional context..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                     </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
               <ButtonRaw onClick={wizardStep === 1 ? attemptCloseWizard : () => setWizardStep(1)} variant="secondary">
                  Cancel
               </ButtonRaw>

               {wizardStep === 1 ? (
                  <ButtonRaw onClick={() => setWizardStep(2)} variant="primary">
                     Next <ArrowRight className="h-4 w-4 ml-1.5" />
                  </ButtonRaw>
               ) : (
                  <ButtonRaw onClick={executePromotion} disabled={isExecuting} variant="primary">
                     {isExecuting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2 fill-white" />}
                     Confirm & Execute
                  </ButtonRaw>
               )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      {closeConfirmOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-lg">Discard Progress?</h3>
            <p className="text-sm text-slate-500 mt-2">You haven't executed the promotion yet. Closing the wizard will lose your selections.</p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <ButtonRaw onClick={() => setCloseConfirmOpen(false)} variant="secondary">Keep Editing</ButtonRaw>
              <ButtonRaw onClick={confirmCloseWizard} variant="danger">Discard & Close</ButtonRaw>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Raw Button Component (No Shadcn) ────────────────────────────────────
function ButtonRaw({ children, onClick, variant = 'primary', disabled = false, className = '' }: any) {
   const base = "inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
   const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
      secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-500",
      danger: "bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-500",
   };
   return (
      <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant as keyof typeof variants]} ${className}`}>
         {children}
      </button>
   );
}