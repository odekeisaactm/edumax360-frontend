'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI } from '@/lib/api';
import {
  Search, AlertCircle, CheckCircle2, X, Loader2, FileText,
  ArrowLeft, Wallet, ShieldAlert, Printer, ArrowUpDown, XCircle, ArrowRight,
  ChevronRight, ChevronDown, Info
} from 'lucide-react';

// ─── Interfaces ───────────────────────────────────────────────────────────────
let _toastId = 0;
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

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
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
      icon = <AlertCircle className="h-4 w-4 text-amber-600" />;
      bg = 'bg-amber-50 border-amber-200';
      label = `Completed with ${status.failed_targets} issue(s) — see table below`;
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

// ─── Main Batch Detail Component ───────────────────────────────────────────────
export default function CorrectionBatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.id;
  const { user } = useAuth();

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  const [loading, setLoading] = useState(true);
  const [batchData, setBatchData] = useState<any>(null);
  const [liveStatus, setLiveStatus] = useState<RebillStatus | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Accordion State
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Unified fetch that grabs the static details + live Celery status
  const fetchBatchDetails = useCallback(async () => {
    if (!batchId) return null;
    try {
      const [detailRes, statusRes] = await Promise.all([
        feeAPI.getCorrectionBatchDetail(Number(batchId)),
        feeAPI.getRebillStatus(Number(batchId))
      ]);
      setBatchData(detailRes);
      setLiveStatus(statusRes);
      return statusRes;
    } catch (err) {
      showToast('error', extractError(err));
      return null;
    }
  }, [batchId, showToast]);

  // 2. Poll loop if the status is not complete
  useEffect(() => {
    let isMounted = true;

    const loadAndPoll = async () => {
      setLoading(true);
      const initialStatus = await fetchBatchDetails();
      setLoading(false);

      const poll = async () => {
        if (!isMounted) return;
        try {
          const s = await fetchBatchDetails();
          if (s && !s.is_complete) {
            pollTimeoutRef.current = setTimeout(poll, 2500);
          }
        } catch (e) {
          // Resilience: network blip shouldn't kill the poll
          pollTimeoutRef.current = setTimeout(poll, 3000);
        }
      };

      if (initialStatus && !initialStatus.is_complete) {
        pollTimeoutRef.current = setTimeout(poll, 2500);
      }
    };

    loadAndPoll();

    return () => {
      isMounted = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [fetchBatchDetails]);

  // Extract unique classes for filter dropdown
  const availableClasses = useMemo(() => {
    const docs = batchData?.affected_documents || [];
    const classesSet = new Set<string>();
    docs.forEach((d: any) => {
      if (d.class_name && d.class_name !== 'Family Account') {
        classesSet.add(d.class_name);
      }
    });
    return Array.from(classesSet).sort();
  }, [batchData]);

  // Filter and Sort affected documents
  const filteredDocuments = useMemo(() => {
    const docs = batchData?.affected_documents || [];
    let filtered = [...docs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((d: any) =>
        d.invoice_number?.toLowerCase().includes(q) ||
        d.new_invoice_number?.toLowerCase().includes(q) ||
        d.billed_name?.toLowerCase().includes(q) ||
        d.registration_number?.toLowerCase().includes(q)
      );
    }

    if (channelFilter) {
      filtered = filtered.filter((d: any) => d.payment_channel === channelFilter);
    }

    if (classFilter) {
      filtered = filtered.filter((d: any) => d.class_name === classFilter);
    }

    // Sort by class name
    filtered.sort((a, b) => {
      const classA = (a.class_name || '').toLowerCase();
      const classB = (b.class_name || '').toLowerCase();
      if (classA < classB) return sortOrder === 'asc' ? -1 : 1;
      if (classA > classB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [batchData, searchQuery, channelFilter, classFilter, sortOrder]);

  // Statistics Summary
  const stats = useMemo(() => {
    const docs = batchData?.affected_documents || [];
    let totalBilled = 0;
    let totalPaid = 0;
    let onlineCount = 0;
    let manualCount = 0;

    docs.forEach((d: any) => {
      totalBilled += parseFloat(d.amount_billed || '0');
      totalPaid += parseFloat(d.amount_paid || '0');
      if (d.payment_channel === 'online' || d.payment_channel === 'mixed') onlineCount++;
      if (d.payment_channel === 'manual' || d.payment_channel === 'mixed') manualCount++;
    });

    return { totalBilled, totalPaid, count: docs.length, onlineCount, manualCount };
  }, [batchData]);

  const toggleDoc = (index: number) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedDocs(new Set(filteredDocuments.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedDocs(new Set());
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
      </div>
    );
  }

  if (!batchData) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Batch audit record not found.</p>
        <button onClick={() => router.push('/dashboard/staff/fee/correction-batches')} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg">
          Back to Batches
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {liveStatus && (!liveStatus.is_complete || liveStatus.status !== 'success') && (
        <ActiveCorrectionBanner status={liveStatus} />
      )}

      {/* ── Header & Navigation ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => router.push('/dashboard/staff/fee/correction-batches')}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            title="Back to Batches"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100">
                BAT-{batchData.id.toString().padStart(4, '0')}
              </span>
              <h1 className="text-xl font-bold text-slate-900">{batchData.title}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">Authorized by <strong className="text-slate-700">{batchData.created_by_name || 'Staff'}</strong> on {new Date(batchData.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Printer className="h-4 w-4" /> Print Audit Report
        </button>
      </div>

      {/* ── Reason Callout Box ── */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Audit Rationale / Reason</h3>
          <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{batchData.reason}</p>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processed Target</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-xl font-black text-slate-800">{stats.count}</p>
            {liveStatus && !liveStatus.is_complete && (
              <span className="text-xs font-bold text-rose-500 animate-pulse">of {liveStatus.total_targets}</span>
            )}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Value Billed</p>
          <p className="text-xl font-black text-slate-800 mt-1">{formatCurrency(stats.totalBilled)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Payments Pivoted</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(stats.totalPaid)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Channel Breakdown</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100">Online: {stats.onlineCount}</span>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-100">Manual: {stats.manualCount}</span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-center shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, reg no or invoice..."
            className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">All Classes</option>
            {availableClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
          </select>

          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">All Channels</option>
            <option value="online">Online / Mixed</option>
            <option value="manual">Manual (Cash/Teller)</option>
            <option value="none">No Payments</option>
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center gap-1.5 text-slate-700 transition-colors"
            title="Toggle Class Sorting"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" /> Class ({sortOrder.toUpperCase()})
          </button>
        </div>
      </div>

      {/* ── Affected Documents Table (Accordion) ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-rose-500" />
            <h3 className="font-bold text-slate-800 text-sm">Execution Log & Resolution</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest border-r border-slate-200 pr-3">{filteredDocuments.length} Records</span>
            <button onClick={expandAll} className="text-xs font-bold text-cyan-600 hover:text-cyan-700">Expand All</button>
            <button onClick={collapseAll} className="text-xs font-bold text-slate-400 hover:text-slate-600">Collapse All</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-3 w-10 text-center"></th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest">Billed Entity</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest">Class & Arm</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest">Invoices (Old &rarr; New)</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest text-right">Billed Amount</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-widest text-center">Primary Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-400 font-medium">
                    {searchQuery || classFilter || channelFilter
                      ? 'No documents match your filter criteria.'
                      : (liveStatus && !liveStatus.is_complete ? 'Processing first records...' : 'No execution log available.')}
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc: any, i: number) => {
                  const isExpanded = expandedDocs.has(i);
                  const paid = parseFloat(doc.amount_paid || '0');

                  // Determine High Level Status
                  let primaryStatus = <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-md border border-slate-200">Voided</span>;
                  if (doc.status_at_void === 'error') {
                     primaryStatus = <span className="px-2.5 py-1 bg-red-50 text-red-700 font-bold text-[10px] uppercase tracking-wider rounded-md border border-red-200">Error</span>;
                  } else if (doc.regeneration === 'skipped_no_fee_structure' || doc.regeneration === 'skipped_no_active_ward') {
                     primaryStatus = <span className="px-2.5 py-1 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider rounded-md border border-slate-200">Skipped</span>;
                  } else if (doc.new_invoice_number) {
                     primaryStatus = <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-wider rounded-md border border-emerald-100">Re-Billed</span>;
                  }

                  return (
                    <React.Fragment key={i}>
                      {/* ── MAIN ROW ── */}
                      <tr onClick={() => toggleDoc(i)} className={`cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/70'}`}>
                        <td className="px-3 py-3.5 text-center text-slate-400">
                          {isExpanded ? <ChevronDown className="h-4 w-4 mx-auto" /> : <ChevronRight className="h-4 w-4 mx-auto" />}
                        </td>
                        <td className="px-5 py-3.5 align-middle">
                          <div className="flex items-center gap-3">
                            {doc.type === 'student' ? (
                               <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex flex-col items-center justify-center font-bold text-[10px] shrink-0 border border-slate-200" title="Student">S</div>
                            ) : (
                               <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex flex-col items-center justify-center font-bold text-[10px] shrink-0 border border-rose-100" title="Family">F</div>
                            )}
                            <div>
                              <p className="font-bold text-slate-800">{doc.billed_name}</p>
                              {doc.registration_number && <p className="text-[10px] font-mono text-slate-400">{doc.registration_number}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-700 align-middle">
                          {doc.class_name || '—'} {doc.class_section_name ? <span className="text-slate-400 font-normal">({doc.class_section_name})</span> : ''}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-800 align-middle">
                          {doc.status_at_void === 'error' ? (
                             <span className="text-red-500 font-semibold">—</span>
                          ) : (
                             <div className="flex flex-col gap-0.5 items-start">
                                <span className="line-through text-slate-400 opacity-70 block">{doc.invoice_number}</span>
                                {doc.new_invoice_number && (
                                  <div className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit">
                                    <ArrowRight className="h-3 w-3 shrink-0"/> {doc.new_invoice_number}
                                  </div>
                                )}
                             </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-800 align-middle">
                          {doc.amount_billed ? formatCurrency(doc.amount_billed) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center align-middle">
                          {primaryStatus}
                        </td>
                      </tr>

                      {/* ── EXPANDED ACCORDION ROW ── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0 border-b border-slate-100">
                             <div className="bg-slate-50/70 p-5 pl-14 border-l-2 border-cyan-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                   {/* Left Side: Payment Context */}
                                   <div>
                                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Original Payment Context</h4>
                                      {paid > 0 ? (
                                         <div className="space-y-2">
                                            <p className="text-xs font-semibold text-slate-700 flex items-center justify-between border-b border-slate-200 pb-2">
                                               <span>Amount Paid Before Void:</span>
                                               <span className="font-black text-slate-900">{formatCurrency(paid)}</span>
                                            </p>
                                            <p className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                                               <span>Detected Channel:</span>
                                               {doc.payment_channel === 'online' ? (
                                                  <span className="text-emerald-700 font-bold">Online Transfer / Card</span>
                                                ) : doc.payment_channel === 'manual' ? (
                                                  <span className="text-amber-700 font-bold">Manual (Cash / POS)</span>
                                                ) : doc.payment_channel === 'mixed' ? (
                                                   <span className="text-blue-700 font-bold">Mixed (Online & Manual)</span>
                                                ) : (
                                                   <span className="text-slate-500">—</span>
                                                )}
                                            </p>
                                         </div>
                                      ) : (
                                         <p className="text-xs text-slate-500 italic">No previous payments detected on this invoice.</p>
                                      )}
                                   </div>

                                   {/* Right Side: Resolution Log */}
                                   <div>
                                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">System Actions Taken</h4>

                                      {doc.status_at_void === 'error' ? (
                                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                             <p className="text-xs font-bold text-red-800 mb-1 flex items-center gap-1.5"><XCircle className="h-4 w-4"/> Error Processing Record</p>
                                             <p className="text-xs text-red-600 leading-relaxed font-mono">{doc.error || 'Unknown failure occurred.'}</p>
                                          </div>
                                      ) : (
                                         <div className="flex flex-col gap-2 items-start">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Original Invoice Voided
                                            </span>

                                            {doc.wallet_funded && (
                                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                                <CheckCircle2 className="w-4 h-4 text-blue-500" /> Digital Funds Refunded to Wallet
                                              </span>
                                            )}

                                            {doc.new_invoice_number && paid > 0 && !doc.manual_stripped && (
                                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Funds Auto-Applied to New Bill
                                              </span>
                                            )}

                                            {doc.manual_stripped && (
                                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                                <AlertTriangle className="w-4 h-4 text-amber-500" /> Manual Cash Stripped (Requires re-lodgement)
                                              </span>
                                            )}

                                            {doc.regeneration === 'skipped_no_fee_structure' && (
                                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 mt-1">
                                                <Info className="w-4 h-4 text-slate-400" /> Skipped Re-billing: No fees applicable for term
                                              </span>
                                            )}

                                            {doc.regeneration === 'skipped_no_active_ward' && (
                                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 mt-1">
                                                <Info className="w-4 h-4 text-slate-400" /> Skipped Re-billing: Parent has no active wards
                                              </span>
                                            )}
                                         </div>
                                      )}
                                   </div>

                                </div>
                             </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}