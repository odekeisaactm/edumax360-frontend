'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, { feeAPI, academicCalendarAPI, academicAPI, studentsAPI } from '@/lib/api';
import { InvoiceGenerationJob, ClassModel, AcademicSessionPeriod } from '@/lib/types';
import {
  Layers, Search, AlertCircle, Check, X, Loader2, PlayCircle,
  ArrowLeft, BellRing, Settings, Users, AlertTriangle, RefreshCw, FileText, CalendarClock, ChevronRight, ChevronLeft, Filter, Info
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Hub Component ────────────────────────────────────────────────────────
export default function InvoiceGenerationHub() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  // ── State: Core Data ──
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'hub' | 'form' | 'progress'>('hub');

  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<any | null>(null);

  // ── State: Pagination & History Filtering ──
  const [jobs, setJobs] = useState<InvoiceGenerationJob[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterSessionId, setFilterSessionId] = useState<string>('');
  const [filterPeriodId, setFilterPeriodId] = useState<string>('');
  const [filterPeriods, setFilterPeriods] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // ── State: Bulk Form Selections ──
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [availablePeriods, setAvailablePeriods] = useState<any[]>([]);

  // ── State: Pending Inbox & Search ──
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [generatingSingleId, setGeneratingSingleId] = useState<number | null>(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State: Single Invoice Generation Modal ──
  // Replaces the old inline "quick generate" search box in the header — search,
  // select, see exactly what will happen, then run with clear processing/result
  // feedback, all inside one focused modal instead of a header dropdown.
  const [showSingleGenModal, setShowSingleGenModal] = useState(false);
  const [singleGenStudent, setSingleGenStudent] = useState<any | null>(null);
  const [singleGenStatus, setSingleGenStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [singleGenErrorMsg, setSingleGenErrorMsg] = useState('');

  // ── State: Bulk Form & Pre-Flight ──
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [preFlightConflicts, setPreFlightConflicts] = useState<{ message: string; severe: boolean }[]>([]);
  const [showPreFlightModal, setShowPreFlightModal] = useState(false);
  const [showFutureWarningModal, setShowFutureWarningModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── State: Job Progress & Drawer ──
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [activeJobStatus, setActiveJobStatus] = useState<any | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<any | null>(null);

  // ── Load Initial Core Data ──
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [cData, sessData, curSessRaw, fData, dData] = await Promise.all([
          academicAPI.listClasses({ is_active: true }),
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession(),
          feeAPI.getFeeStructures(),
          feeAPI.getDiscounts()
        ]);

        const curSess = curSessRaw?.data?.data || curSessRaw?.data || curSessRaw;
        let curPer = null;
        try {
          const curPerRes = await api.get('/api/school/session-periods/current/');
          curPer = curPerRes.data?.data || curPerRes.data;
        } catch (e) {
          console.warn("Could not fetch current period via direct endpoint.");
        }

        setClasses(Array.isArray(cData) ? cData : []);
        setSessions(Array.isArray(sessData) ? sessData : []);
        setCurrentSession(curSess);
        setCurrentPeriod(curPer);
        setFeeStructures(fData);
        setDiscounts(dData);

        if (curSess?.id && curPer?.id) {
          setSelectedSessionId(curSess.id.toString());
          setSelectedPeriodId(curPer.id.toString());
          const pending = await feeAPI.getPendingStudents({ session_id: curSess.id, period_id: curPer.id });
          setPendingStudents(pending.students || []);
        }
      } catch (err) {
        showToast('error', 'Failed to initialize hub data.');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // ── Dynamic Periods loading for Hub Filter ──
  useEffect(() => {
    if (filterSessionId) {
       academicCalendarAPI.listSessionPeriods({ session_id: Number(filterSessionId) })
         .then(res => setFilterPeriods(res))
         .catch(() => setFilterPeriods([]));
    } else {
       setFilterPeriods([]);
       setFilterPeriodId('');
    }
  }, [filterSessionId]);

  // ── Load Jobs (With Pagination & Filters) ──
  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const params: any = { page: currentPage };
      if (filterSessionId) params.session = filterSessionId;
      if (filterPeriodId) params.period = filterPeriodId;

      const res = await feeAPI.getGenerationJobs(params);

      if (res && res.results) {
        setJobs(res.results);
        setTotalPages(Math.ceil(res.count / 20) || 1); // Assuming PAGE_SIZE = 20
      } else if (Array.isArray(res)) {
        setJobs(res);
        setTotalPages(1);
      }
    } catch (err) {
      showToast('error', 'Failed to fetch job history.');
    } finally {
      setJobsLoading(false);
    }
  }, [currentPage, filterSessionId, filterPeriodId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // ── Dynamic Periods loading for Form ──
  useEffect(() => {
    if (selectedSessionId) {
       academicCalendarAPI.listSessionPeriods({ session_id: Number(selectedSessionId) })
         .then(res => setAvailablePeriods(res))
         .catch(() => setAvailablePeriods([]));
    } else {
       setAvailablePeriods([]);
    }
  }, [selectedSessionId]);

  // ── Polling Engine ──
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if ((view === 'progress' || view === 'hub') && activeJobId) {
      interval = setInterval(async () => {
        try {
          const status = await feeAPI.getJobStatus(activeJobId);
          setActiveJobStatus(status);
          setJobs(prev => prev.map(j => (j.job_id === activeJobId || j.id === activeJobId) ? { ...j, ...status } : j));

          if (status.is_complete) {
            clearInterval(interval);
            if (view === 'progress') {
              setTimeout(() => {
                setActiveJobId(null);
                setActiveJobStatus(null);
                setView('hub');
                setSelectedJobDetail(status); // Auto-open Drawer
                showToast(status.status?.toLowerCase() === 'success' ? 'success' : 'error', `Job Finished: ${status.status_display}`);
                loadJobs(); // Refresh table
              }, 2500);
            } else {
               setActiveJobId(null);
               setActiveJobStatus(null);
               setSelectedJobDetail(status); // Auto-open Drawer
               loadJobs();
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeJobId, view, loadJobs]);

  // ── Single Student Actions ──
  const handleSingleGenerate = async (studentId: number) => {
    if (!currentSession || !currentPeriod) return;
    setGeneratingSingleId(studentId);
    try {
      await feeAPI.generateSingleInvoice({
        student_id: studentId,
        session_id: currentSession.id,
        period_id: currentPeriod.id
      });
      showToast('success', 'Invoice generated successfully.');
      setPendingStudents(p => p.filter(s => s.student_id !== studentId));
      setStudentSearch(''); setSearchResults([]);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setGeneratingSingleId(null);
    }
  };

  const handleRunAllPending = async () => {
    if (pendingStudents.length === 0) return;
    setShowPendingModal(false);
    showToast('success', `Generating ${pendingStudents.length} invoices...`);
    for (const st of pendingStudents) {
       await handleSingleGenerate(st.student_id);
    }
  };

  // ── Single Invoice Generation Modal Handlers ──
  const closeSingleGenModal = () => {
    setShowSingleGenModal(false);
    setSingleGenStudent(null);
    setSingleGenStatus('idle');
    setSingleGenErrorMsg('');
    setStudentSearch('');
    setSearchResults([]);
  };

  const resetSingleGenSelection = () => {
    setSingleGenStudent(null);
    setSingleGenStatus('idle');
    setSingleGenErrorMsg('');
    setStudentSearch('');
    setSearchResults([]);
  };

  const handleModalGenerate = async () => {
    if (!singleGenStudent || !currentSession || !currentPeriod) return;
    setSingleGenStatus('processing');
    try {
      await feeAPI.generateSingleInvoice({
        student_id: singleGenStudent.id,
        session_id: currentSession.id,
        period_id: currentPeriod.id
      });
      setSingleGenStatus('done');
      setPendingStudents(p => p.filter(s => s.student_id !== singleGenStudent.id));
    } catch (err) {
      setSingleGenStatus('error');
      setSingleGenErrorMsg(extractError(err));
    }
  };

  // ── Student Search (feeds both the modal and, previously, the header dropdown) ──
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (studentSearch.trim().length < 2) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await studentsAPI.list({ search: studentSearch.trim(), status: 'active', page_size: 5 });
        setSearchResults(res.results || []);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, [studentSearch]);

  // ── Bulk Class Selection ──
  // Previously the per-class label had no click handler at all, so only the
  // "Select All" / "Clear" buttons (which write directly to selectedClasses)
  // appeared to work. This wires up the actual per-row toggle.
  const toggleClassSelection = (classId: number) => {
    setSelectedClasses(prev => prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]);
  };

  // ── Pre-Flight Checks ──
  const handleStartBulkCheck = () => {
    if (!selectedSessionId || !selectedPeriodId) return showToast('error', 'Please select a session and term.');
    if (selectedClasses.length === 0) return showToast('error', 'Please select at least one class.');

    const conflicts: { message: string; severe: boolean }[] = [];
    for (const classId of selectedClasses) {
      const className = classes.find(c => c.id === classId)?.name || `Class #${classId}`;
      const structuresForClass = feeStructures.filter(fs => fs.is_active && fs.scopes?.some((s: any) => s.student_class === classId));

      const feeCounts = new Map<number, number>();
      structuresForClass.forEach(fs => feeCounts.set(fs.fee, (feeCounts.get(fs.fee) || 0) + 1));

      feeCounts.forEach((count, feeId) => {
        if (count > 1) {
          const feeName = feeStructures.find(fs => fs.fee === feeId)?.fee_name || 'A fee';
          conflicts.push({ severe: true, message: `${className}: "${feeName}" is mapped multiple times in active fee structures. This WILL cause double-billing.`});
        }
      });

      const discountsForClass = discounts.filter(d => d.applicable_classes?.includes(classId) || (!d.applicable_classes?.length));
      let totalPct = 0;
      discountsForClass.forEach(d => {
        if (d.discount_type === 'percentage') {
           const tier = d.class_tiers?.find((t:any) => t.student_class === classId);
           totalPct += parseFloat(tier ? tier.tier_amount : d.amount);
        }
      });

      if (totalPct >= 100) {
         conflicts.push({ severe: true, message: `${className}: Active percentage discounts stack up to ${totalPct}%. Invoices for this class will be fully zeroed out.`});
      } else if (totalPct >= 50) {
         conflicts.push({ severe: false, message: `${className}: Active percentage discounts stack up to ${totalPct}%. Ensure this aggressive concession is intentional.`});
      }
    }

    if (conflicts.length > 0) {
      setPreFlightConflicts(conflicts);
      setShowPreFlightModal(true);
      return;
    }

    triggerFutureCheck();
  };

  const triggerFutureCheck = () => {
    setShowPreFlightModal(false);

    const selSess = sessions.find(s => s.id.toString() === selectedSessionId);
    const selPer = availablePeriods.find(p => p.id.toString() === selectedPeriodId);

    let isFuture = false;
    if (selSess && currentSession) {
       if (selSess.start_year > currentSession.start_year) {
         isFuture = true;
       } else if (selSess.id === currentSession.id && selPer && currentPeriod) {
         const selOrder = selPer.period?.term_order || selPer.term_order || 0;
         const curOrder = currentPeriod.period?.term_order || currentPeriod.term_order || 0;
         if (selOrder > curOrder) isFuture = true;
       }
    }

    if (isFuture) {
      setShowFutureWarningModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  const executeBulkJob = async () => {
    setIsSubmitting(true);
    setShowFutureWarningModal(false);
    setShowConfirmModal(false);

    try {
      const job = await feeAPI.startGenerationJob({
        session_id: Number(selectedSessionId),
        period_id: Number(selectedPeriodId),
        class_ids: selectedClasses
      });

      const jobId = job.job_id || job.id;
      setActiveJobId(jobId);
      setActiveJobStatus({ ...job, progress_pct: 0 });
      setJobs(prev => [job, ...prev]);
      setView('progress');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // RENDER: HUB DASHBOARD
  // ============================================================================
  const renderHub = () => (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-300">

      {pendingStudents.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center border border-amber-200 shrink-0">
              <BellRing className="h-5 w-5 text-amber-600 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Pending Invoices Detected</p>
              <p className="text-xs text-amber-700 mt-0.5">
                <strong className="text-amber-900">{pendingStudents.length}</strong> active students do not have an invoice for the current term yet.
              </p>
            </div>
          </div>
          <button onClick={() => setShowPendingModal(true)} className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors shadow-sm whitespace-nowrap">
            View Inbox
          </button>
        </div>
      )}

      {/* Title Row — own line, no longer sharing space with actions/filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
          <Layers className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoice Generation Hub</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Current Period: <strong className="text-slate-800">{currentSession?.start_year}/{currentSession?.end_year} — {currentPeriod?.name || currentPeriod?.period?.name || 'Loading...'}</strong>
          </p>
        </div>
      </div>

      {/* Action Row — separate card, its own line */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <p className="text-xs font-bold text-slate-700">Quick Actions</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Generate a single student's invoice on demand, or run a full billing cycle for one or more classes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setShowSingleGenModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-indigo-100 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-50 transition-colors shadow-sm whitespace-nowrap">
            <Search className="h-4 w-4" /> Generate Single Invoice
          </button>
          {canManage && (
            <button onClick={() => { setSelectedClasses(classes.map(c => c.id)); setView('form'); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap">
              <PlayCircle className="h-4 w-4" /> Bulk Run
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
         {/* Section header now carries the session/term filter — it's the table this filter actually controls */}
         <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
           <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><RefreshCw className="h-4 w-4 text-indigo-500" /> Historical Runs</h2>
           <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 self-start sm:self-auto">
             <Filter className="h-4 w-4 text-slate-400 ml-2" />
             <select value={filterSessionId} onChange={e => { setFilterSessionId(e.target.value); setCurrentPage(1); }} className="bg-transparent border-none text-xs font-semibold text-slate-700 py-2.5 pl-2 pr-6 focus:ring-0 cursor-pointer outline-none">
               <option value="">All Sessions</option>
               {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
             </select>
             <div className="w-px h-5 bg-slate-200 mx-1"></div>
             <select value={filterPeriodId} onChange={e => { setFilterPeriodId(e.target.value); setCurrentPage(1); }} disabled={!filterSessionId} className="bg-transparent border-none text-xs font-semibold text-slate-700 py-2.5 pl-2 pr-6 focus:ring-0 cursor-pointer outline-none disabled:opacity-50">
               <option value="">All Terms</option>
               {filterPeriods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
             </select>
           </div>
         </div>

         {loading || jobsLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
         ) : jobs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
               <Layers className="h-10 w-10 mx-auto mb-3 text-slate-300" />
               <p className="text-sm font-bold">No generation jobs found.</p>
            </div>
         ) : (
           <div className="overflow-x-auto flex-1">
             <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                   <tr>
                      <th className="px-6 py-4 font-bold">Date & Time</th>
                      <th className="px-6 py-4 font-bold">Billing Period</th>
                      <th className="px-6 py-4 font-bold">Initiated By</th>
                      <th className="px-6 py-4 font-bold">Progress / Status</th>
                      <th className="px-6 py-4 font-bold text-right">Summary Breakdown</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {jobs.map(job => {
                     const isRunning = !job.is_complete;
                     const isSuccess = job.status?.toLowerCase() === 'success';
                     const isPartial = job.status?.toLowerCase() === 'partial';

                     return (
                       <tr key={job.job_id || job.id} onClick={() => setSelectedJobDetail(job)} className="hover:bg-slate-50/80 cursor-pointer transition-colors group">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{new Date(job.created_at).toLocaleDateString('en-GB')}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{new Date(job.created_at).toLocaleTimeString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-700">{job.session_display || '---'}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{job.period_display || '---'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                 {(job.created_by_name || 'Sys')[0].toUpperCase()}
                               </div>
                               <span className="text-xs font-bold text-slate-700">{job.created_by_name || 'System Auto-Run'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[200px]">
                             {isRunning ? (
                                <div>
                                   <div className="flex justify-between text-[10px] font-bold text-indigo-700 mb-1">
                                      <span>Running...</span>
                                      <span>{job.progress_pct}%</span>
                                   </div>
                                   <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                                      <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${job.progress_pct}%` }}></div>
                                   </div>
                                </div>
                             ) : (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${isSuccess ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isPartial ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                   {isSuccess ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />} {job.status_display}
                                </span>
                             )}
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-3">
                               <div className="text-right">
                                 {isRunning ? (
                                   <p className="text-xs font-bold text-slate-500">{job.processed_students} / {job.total_students} Processed</p>
                                 ) : (
                                   <div className="flex items-center justify-end gap-2 text-[11px] font-semibold">
                                      <span className="text-slate-500" title="Total Processed">{job.processed_students} Chk</span> <span className="text-slate-300">|</span>
                                      <span className="text-emerald-600" title="Newly Generated">{job.generated_count || 0} Gen</span> <span className="text-slate-300">|</span>
                                      <span className="text-amber-600" title="Skipped (Already Exists or No Fee Structure)">{job.skipped_count || 0} Skp</span>
                                      {job.failed_students > 0 && (
                                        <>
                                          <span className="text-slate-300">|</span>
                                          <span className="text-rose-600" title="Failed to Generate">{job.failed_students} Fail</span>
                                        </>
                                      )}
                                   </div>
                                 )}
                               </div>
                               <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                             </div>
                          </td>
                       </tr>
                     )
                   })}
                </tbody>
             </table>
           </div>
         )}

         {/* Pagination Footer */}
         {totalPages > 1 && (
           <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-2">
                 <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                 <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"><ChevronRight className="h-4 w-4" /></button>
              </div>
           </div>
         )}
      </div>

    </div>
  );

  // ============================================================================
  // RENDER: BULK FORM VIEW
  // ============================================================================
  const renderForm = () => {
    const validSessions = sessions.filter(s => {
       if (!currentSession) return true;
       return s.start_year >= currentSession.start_year;
    });

    return (
      <div className="space-y-6 pb-20 max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <button onClick={() => setView('hub')} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 border border-transparent rounded-xl transition-all">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shadow-md shrink-0">
            <PlayCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Run Bulk Invoice Generation</h1>
            <p className="text-xs text-slate-500 font-medium">Select a period and classes to automatically bill.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
           <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-indigo-500" /> Target Billing Period
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Session</label>
                  <select
                    value={selectedSessionId}
                    onChange={e => { setSelectedSessionId(e.target.value); setSelectedPeriodId(''); }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  >
                    <option value="">Select Session...</option>
                    {validSessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Term</label>
                  <select
                    value={selectedPeriodId}
                    onChange={e => setSelectedPeriodId(e.target.value)}
                    disabled={!selectedSessionId}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                  >
                    <option value="">Select Term...</option>
                    {availablePeriods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[10px] font-medium text-slate-500 mt-3 italic flex items-start gap-1">
                 <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> Note: Generating invoices for future terms allows parents to pay ahead, but generating for past terms is disabled to protect historical records.
              </p>
           </div>

           <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                 <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                   <Users className="h-4 w-4 text-indigo-500" /> Target Classes
                 </h2>
                 <div className="flex items-center gap-2">
                   <button onClick={() => setSelectedClasses(classes.map(c => c.id))} className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100">Select All</button>
                   <button onClick={() => setSelectedClasses([])} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200">Clear</button>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                 {classes.map(c => {
                   const isChecked = selectedClasses.includes(c.id);
                   return (
                     <label key={c.id} onClick={() => toggleClassSelection(c.id)} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${isChecked ? 'border-indigo-500 bg-indigo-50/30 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                          {isChecked && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className={`text-sm font-bold ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>{c.name}</span>
                     </label>
                   )
                 })}
              </div>
           </div>
        </div>

        <div className="flex justify-end gap-3">
           <button onClick={() => setView('hub')} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
           <button onClick={handleStartBulkCheck} disabled={selectedClasses.length === 0 || !selectedSessionId || !selectedPeriodId} className="px-8 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50">
              <PlayCircle className="h-4 w-4" /> Start Generation
           </button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER: PROGRESS VIEW
  // ============================================================================
  const renderProgress = () => {
    const pct = activeJobStatus?.progress_pct || 0;
    const isDone = activeJobStatus?.is_complete;

    return (
      <div className="max-w-2xl mx-auto mt-20 text-center animate-in zoom-in-95 duration-500">
         <div className="w-24 h-24 mx-auto bg-white rounded-3xl shadow-xl shadow-indigo-100/50 flex items-center justify-center mb-8 border border-indigo-50 relative overflow-hidden">
            <div className="absolute inset-0 bg-indigo-50 opacity-50" style={{ height: `${pct}%`, top: `${100 - pct}%`, transition: 'all 1s ease' }}></div>
            {isDone ? <Check className="h-10 w-10 text-emerald-500 relative z-10" /> : <Loader2 className="h-10 w-10 animate-spin text-indigo-600 relative z-10" />}
         </div>

         <h1 className="text-3xl font-black text-slate-900 mb-2">
            {isDone ? 'Generation Complete!' : 'Generating Invoices...'}
         </h1>
         <p className="text-slate-500 font-medium mb-12">
            {isDone ? 'All selected classes have been processed.' : 'Please wait while the engine maps structures and processes discounts.'}
         </p>

         <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-md mx-auto">
            <div className="flex justify-between items-end mb-3">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Progress</span>
               <span className="text-2xl font-black text-indigo-600">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 mb-4 overflow-hidden">
               <div className="bg-indigo-600 h-3 rounded-full transition-all duration-500 ease-out relative" style={{ width: `${pct}%` }}>
                  <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
               </div>
            </div>
            <p className="text-sm font-bold text-slate-600">
               {activeJobStatus?.processed_students || 0} of {activeJobStatus?.total_students || 0} Students Processed
            </p>
         </div>
      </div>
    );
  };

  return (
    <>
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {view === 'hub' && renderHub()}
      {view === 'form' && renderForm()}
      {view === 'progress' && renderProgress()}

      {/* ── Pending Inbox Modal ── */}
      {showPendingModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center"><BellRing className="h-4 w-4 text-amber-600" /></div>
                   <h3 className="font-bold text-slate-900">Pending Invoices</h3>
                </div>
                <button onClick={() => setShowPendingModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><X className="h-5 w-5" /></button>
             </div>

             <div className="p-6 bg-amber-50/30 border-b border-amber-100">
                <p className="text-sm text-amber-900 font-medium">
                   The students below are active but missing an invoice for the current term.
                   Generating individually will still process family invoices accurately without duplicating siblings.
                </p>
             </div>

             <div className="flex-1 overflow-y-auto p-2">
                {pendingStudents.map(s => {
                  const titleName = toTitleCase(s.name || '');
                  return (
                    <div key={s.student_id} className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between group border-b border-slate-50 last:border-0 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{titleName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-400">{s.registration_number}</span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{s.class_name}</span>
                        </div>
                      </div>
                      <button disabled={generatingSingleId === s.student_id} onClick={() => handleSingleGenerate(s.student_id)} className="px-4 py-2 bg-white border-2 border-indigo-100 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-50 transition-colors shadow-sm disabled:opacity-50 min-w-[100px]">
                        {generatingSingleId === s.student_id ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Generate'}
                      </button>
                    </div>
                  )
                })}
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-3xl">
                <button onClick={() => setShowPendingModal(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors">Close</button>
                <button onClick={handleRunAllPending} className="px-6 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-amber-700 transition-all">Generate All</button>
             </div>
          </div>
        </div>
      )}

      {/* ── Single Invoice Generation Modal ── */}
      {showSingleGenModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center"><Search className="h-4 w-4 text-indigo-600" /></div>
                   <h3 className="font-bold text-slate-900">Generate Single Invoice</h3>
                </div>
                <button onClick={closeSingleGenModal} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><X className="h-5 w-5" /></button>
             </div>

             <div className="p-6">
                {/* Step 1: Search & Select */}
                {!singleGenStudent && (
                  <>
                    <p className="text-xs text-slate-500 font-medium mb-4">
                      Search for a student to generate an invoice for the current billing period
                      (<strong className="text-slate-700">{currentSession?.start_year}/{currentSession?.end_year} — {currentPeriod?.name || currentPeriod?.period?.name}</strong>).
                    </p>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input autoFocus type="text" placeholder="Search by name or registration number..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                             className="w-full pl-10 pr-4 py-3 text-sm font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all" />
                    </div>

                    <div className="mt-3 max-h-64 overflow-y-auto custom-scrollbar">
                      {searchLoading && (
                        <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
                      )}
                      {!searchLoading && studentSearch.trim().length >= 2 && searchResults.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-8">No matching students found.</p>
                      )}
                      {!searchLoading && searchResults.map(s => {
                        const fullName = toTitleCase(s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim());
                        return (
                          <button key={s.id} onClick={() => setSingleGenStudent(s)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between group border-b border-slate-50 last:border-0 rounded-xl transition-colors">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{fullName}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{s.registration_number}{s.class_name ? ` • ${s.class_name}` : ''}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          </button>
                        );
                      })}
                      {studentSearch.trim().length < 2 && (
                        <p className="text-xs text-slate-400 text-center py-8">Type at least 2 characters to search.</p>
                      )}
                    </div>
                  </>
                )}

                {/* Step 2: Confirm, Process, and Result — all in one place, no page navigation */}
                {singleGenStudent && (() => {
                  const studentDisplayName = toTitleCase(singleGenStudent.full_name || `${singleGenStudent.first_name || ''} ${singleGenStudent.last_name || ''}`.trim());
                  const periodLabel = `${currentSession?.start_year}/${currentSession?.end_year} — ${currentPeriod?.name || currentPeriod?.period?.name}`;

                  if (singleGenStatus === 'done') {
                    return (
                      <div className="text-center py-4 animate-in fade-in duration-200">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-50 border border-emerald-200 text-emerald-600">
                          <Check className="h-7 w-7" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900 mb-1">Invoice Processed</h4>
                        <p className="text-xs text-slate-500 mb-6 px-4">{studentDisplayName}'s invoice for {periodLabel} is now up to date.</p>
                        <div className="flex gap-3">
                          <button onClick={resetSingleGenSelection} className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200">Generate Another</button>
                          <button onClick={closeSingleGenModal} className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700">Done</button>
                        </div>
                      </div>
                    );
                  }

                  if (singleGenStatus === 'error') {
                    return (
                      <div className="text-center py-4 animate-in fade-in duration-200">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-rose-50 border border-rose-200 text-rose-600">
                          <AlertCircle className="h-7 w-7" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900 mb-1">Generation Failed</h4>
                        <p className="text-xs text-rose-600 mb-6 px-4">{singleGenErrorMsg}</p>
                        <div className="flex gap-3">
                          <button onClick={resetSingleGenSelection} className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200">Back to Search</button>
                          <button onClick={handleModalGenerate} className="flex-1 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700">Retry</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="animate-in fade-in duration-200">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Selected Student</p>
                        <p className="text-sm font-bold text-slate-900">{studentDisplayName}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{singleGenStudent.registration_number}{singleGenStudent.class_name ? ` • ${singleGenStudent.class_name}` : ''}</p>
                      </div>

                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex gap-3">
                        <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                          This will generate an invoice for <strong>{studentDisplayName}</strong> for <strong>{periodLabel}</strong> if one doesn't already exist. If it does, it will be refreshed with any relevant fee or discount changes — or left untouched if it's already up to date.
                        </p>
                      </div>

                      {singleGenStatus === 'processing' ? (
                        <div className="py-6 flex flex-col items-center gap-3">
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                          <p className="text-xs font-bold text-slate-500">Processing invoice...</p>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button onClick={resetSingleGenSelection} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50">Back</button>
                          <button onClick={handleModalGenerate} className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 flex items-center justify-center gap-2">
                            <PlayCircle className="h-4 w-4" /> Generate Invoice
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
             </div>
          </div>
        </div>
      )}

      {/* ── Pre-Flight Warning Modal ── */}
      {showPreFlightModal && (
        <div className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className={`p-5 flex items-center gap-3 ${preFlightConflicts.some(c => c.severe) ? 'bg-rose-600' : 'bg-amber-500'}`}>
               <AlertTriangle className="h-6 w-6 text-white" />
               <h3 className="text-lg font-bold text-white">Billing Configuration Warning</h3>
            </div>
            <div className="p-6">
               <p className="text-sm text-slate-700 font-medium mb-5 leading-relaxed">
                 Our system detected overlapping fee structures or aggressive discounts in your active configurations. If you proceed, the invoices generated may contain errors.
               </p>
               <div className={`border rounded-xl p-4 max-h-60 overflow-y-auto mb-6 custom-scrollbar ${preFlightConflicts.some(c => c.severe) ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                 <ul className="space-y-3">
                   {preFlightConflicts.map((c, i) => (
                     <li key={i} className={`text-xs flex items-start gap-2 ${c.severe ? 'text-rose-900 font-bold' : 'text-amber-900 font-medium'}`}>
                       <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${c.severe ? 'text-rose-500' : 'text-amber-500'}`} />
                       <span>{c.message}</span>
                     </li>
                   ))}
                 </ul>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setShowPreFlightModal(false)} className="flex-1 py-3 bg-white border-2 border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">Go Back</button>
                 <button onClick={() => triggerFutureCheck()} className={`flex-1 py-3 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${preFlightConflicts.some(c => c.severe) ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'}`}>
                    I Understand, Proceed
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Future Term Warning Modal ── */}
      {showFutureWarningModal && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-50 border border-amber-200 text-amber-600">
               <CalendarClock className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Advance Billing Warning</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              You selected a <strong className="text-amber-600">Future Term</strong>. This will generate invoices ahead of the current academic calendar. This is useful for allowing parents to pay in advance, but please ensure your fee structures for that term are completely finalized.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowFutureWarningModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={() => setShowConfirmModal(true)} className="flex-1 py-3 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 shadow-md shadow-amber-200 transition-all flex items-center justify-center gap-2">
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Final Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-indigo-50 border border-indigo-100 text-indigo-600">
               <Layers className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Confirm Bulk Generation</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              You are about to generate invoices for <strong className="text-indigo-600">{selectedClasses.length} class{selectedClasses.length > 1 ? 'es' : ''}</strong>. The system will automatically skip students who already have an invoice for this term.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={executeBulkJob} disabled={isSubmitting} className="flex-1 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Run'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Expanded Job Details Drawer ── */}
      {selectedJobDetail && (
         <div className="fixed inset-0 z-[80] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedJobDetail(null)}></div>
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
               <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-indigo-600"/> Generation Run Details
                  </h3>
                  <button onClick={() => setSelectedJobDetail(null)} className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-lg border border-slate-200 shadow-sm"><X className="w-4 h-4"/></button>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${selectedJobDetail.status?.toLowerCase() === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : selectedJobDetail.status?.toLowerCase() === 'partial' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                     {selectedJobDetail.status?.toLowerCase() === 'success' ? <Check className="h-6 w-6 text-emerald-600" /> : <AlertTriangle className={`h-6 w-6 ${selectedJobDetail.status?.toLowerCase() === 'partial' ? 'text-amber-600' : 'text-rose-600'}`} />}
                     <div>
                       <p className="font-bold text-sm">Status: {selectedJobDetail.status_display}</p>
                       <p className="text-xs mt-0.5 opacity-80">{new Date(selectedJobDetail.created_at).toLocaleString()}</p>
                     </div>
                  </div>

                  {/* Context Info */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                       <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Session</p>
                         <p className="text-sm font-bold text-slate-800">{selectedJobDetail.session_display || '---'}</p>
                       </div>
                       <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Term</p>
                         <p className="text-sm font-bold text-slate-800">{selectedJobDetail.period_display || '---'}</p>
                       </div>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Classes ({selectedJobDetail.classes_to_invoice?.length || 0})</p>
                       <div className="flex flex-wrap gap-1.5">
                          {selectedJobDetail.classes_to_invoice?.map((cid: number) => {
                             const c = classes.find(cls => cls.id === cid);
                             return <span key={cid} className="px-2 py-0.5 bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 rounded">{c ? c.name : `Class ${cid}`}</span>
                          })}
                       </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3">
                     <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Checked</p>
                        <p className="text-xl font-black text-slate-800">{selectedJobDetail.processed_students}</p>
                     </div>
                     <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Generated</p>
                        <p className="text-xl font-black text-emerald-700">{selectedJobDetail.generated_count || 0}</p>
                     </div>
                     <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Skipped</p>
                        <p className="text-xl font-black text-amber-700">{selectedJobDetail.skipped_count || 0}</p>
                     </div>
                     <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center">
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Failed</p>
                        <p className="text-xl font-black text-rose-600">{selectedJobDetail.failed_students}</p>
                     </div>
                  </div>

                  {selectedJobDetail.error_message && (
                     <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                           <AlertCircle className="h-4 w-4 text-rose-500" /> Error Logs
                        </h4>
                        <div className="p-4 bg-slate-900 rounded-xl overflow-x-auto">
                           <pre className="text-[10px] text-rose-300 font-mono whitespace-pre-wrap">{selectedJobDetail.error_message}</pre>
                        </div>
                     </div>
                  )}
               </div>

               {/* View Invoices Action Button */}
               {['success', 'partial'].includes(selectedJobDetail.status?.toLowerCase()) && (
                  <div className="p-5 border-t border-slate-100 bg-slate-50">
                     <button onClick={() => {
                        router.push(`/dashboard/staff/fee/invoices?session=${selectedJobDetail.session}&period=${selectedJobDetail.period}`);
                     }} className="w-full py-3 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors flex items-center justify-center gap-2">
                        <FileText className="h-4 w-4" /> View Invoices
                     </button>
                  </div>
               )}
            </div>
         </div>
      )}

    </>
  );
}