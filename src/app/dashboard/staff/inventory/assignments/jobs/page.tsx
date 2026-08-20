'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { inventoryJobAPI, inventoryAssignmentAPI } from '@/lib/api';
import { CollectionGenerationJob, InventoryAssignment } from '@/lib/types';
import {
  Layers, Check, X, AlertCircle, Loader2, Activity,
  ArrowLeft, AlertTriangle, FileText, ChevronRight,
  ChevronLeft, Package, Clock, CheckCircle2, XCircle, BellRing, Cpu,
  PlayCircle, Boxes, RefreshCw
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InventoryGenerationJobsPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('inventory.view_inventoryassignmentmodel');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  // ── State: Data ──
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<CollectionGenerationJob[]>([]);
  const [assignments, setAssignments] = useState<InventoryAssignment[]>([]);
  const [generatedAssignmentIds, setGeneratedAssignmentIds] = useState<Set<number>>(new Set());

  // ── State: Pending Detector ──
  const [pendingAssignments, setPendingAssignments] = useState<InventoryAssignment[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);

  // ── State: Pagination ──
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ── State: Filters ──
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // ── State: Bulk Generation ──
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<number[]>([]);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // ── State: Detail Drawer ──
  const [selectedJobDetail, setSelectedJobDetail] = useState<CollectionGenerationJob | null>(null);

  // ── State: Polling ──
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load Data ──
  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage, page_size: 20 };
      if (filterStatus !== 'all') params.status = filterStatus;

      const res = await inventoryJobAPI.list(params);
      const data = Array.isArray(res) ? res : res?.results || [];
      const count = typeof res?.count === 'number' ? res.count : data.length;

      setJobs(data);
      setTotalPages(Math.max(1, Math.ceil(count / 20)));
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus, showToast]);

  const loadAssignments = useCallback(async () => {
    try {
      const res = await inventoryAssignmentAPI.list({ page_size: 100, is_active: true });
      const data = Array.isArray(res) ? res : res?.results || [];
      setAssignments(data);
      return data;
    } catch { return []; }
  }, []);

  // ── Load generated assignment IDs + pending ──
  const loadPendingAssignments = useCallback(async () => {
    try {
      const activeAssignments = await loadAssignments();

      const allJobsRes = await inventoryJobAPI.list({ page_size: 100, status: 'success' });
      const successfulJobs = Array.isArray(allJobsRes) ? allJobsRes : allJobsRes?.results || [];

      const generatedIds = new Set(successfulJobs.map((j: CollectionGenerationJob) => j.assignment));
      setGeneratedAssignmentIds(generatedIds);

      const pending = activeAssignments.filter((a: InventoryAssignment) => !generatedIds.has(a.id));
      setPendingAssignments(pending);
    } catch {
      // Silent
    }
  }, [loadAssignments]);

  useEffect(() => {
    loadJobs();
    loadPendingAssignments();
  }, [loadJobs, loadPendingAssignments]);

  // ── Polling for running jobs ──
  useEffect(() => {
    const runningJobs = jobs.filter(j => ['pending', 'in_progress'].includes(j.status));

    if (pollingRef.current) clearInterval(pollingRef.current);

    if (runningJobs.length > 0) {
      pollingRef.current = setInterval(async () => {
        for (const job of runningJobs) {
          try {
            const status = await inventoryJobAPI.getStatus(job.job_id);
            setJobs(prev => prev.map(j => j.job_id === job.job_id ? { ...j, ...status } : j));

            if (['success', 'failure'].includes(status.status)) {
              loadPendingAssignments();
            }
          } catch { /* silent */ }
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [jobs.map(j => j.status).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Individual Generation ──
  const handleGenerateForAssignment = async (assignmentId: number) => {
    setGeneratingFor(assignmentId);
    try {
      const job = await inventoryJobAPI.generateCollections({ assignment_id: assignmentId });
      showToast('success', `Generation started. Job ID: ${job.job_id.slice(0, 8)}...`);
      loadJobs();
      setTimeout(() => loadPendingAssignments(), 1000);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setGeneratingFor(null);
    }
  };

  // ── Bulk Generation ──
  const handleRunBulkGeneration = async () => {
    if (selectedAssignments.length === 0) {
      return showToast('error', 'Select at least one assignment.');
    }

    setIsBulkSubmitting(true);
    try {
      for (const assignmentId of selectedAssignments) {
        await inventoryJobAPI.generateCollections({ assignment_id: assignmentId });
      }
      showToast('success', `Bulk generation started for ${selectedAssignments.length} assignment(s).`);
      setShowBulkModal(false);
      setSelectedAssignments([]);
      loadJobs();
      setTimeout(() => loadPendingAssignments(), 1500);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // ── Toggle All in Bulk Modal ──
  const toggleAllAssignments = () => {
    if (selectedAssignments.length === assignments.length && assignments.length > 0) {
      setSelectedAssignments([]);
    } else {
      setSelectedAssignments(assignments.map(a => a.id));
    }
  };

  // ── Status Badge ──
  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
      'pending': { cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
      'in_progress': { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'In Progress' },
      'success': { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Success' },
      'failure': { cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: <XCircle className="h-3 w-3" />, label: 'Failure' },
    };
    const s = map[status] || map['pending'];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${s.cls}`}>
        {s.icon} {s.label}
      </span>
    );
  };

  const getProgressPct = (job: CollectionGenerationJob) => {
    if (!job.total_students) return 0;
    return Math.round((job.processed_students / job.total_students) * 100);
  };

  // ── Render ──
  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* Pending Banner */}
      {pendingAssignments.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center border border-amber-200 shrink-0">
              <BellRing className="h-5 w-5 text-amber-600 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Pending Allocations Detected</p>
              <p className="text-xs text-amber-700 mt-0.5">
                <strong className="text-amber-900">{pendingAssignments.length}</strong> active assignment(s) have not been generated yet.
              </p>
            </div>
          </div>
          <button onClick={() => setShowPendingModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors shadow-sm whitespace-nowrap">
            View Pending
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3.5">
          <button onClick={() => router.push('/dashboard/staff/inventory/assignments')} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Generate Assignments</h1>
            <p className="text-xs text-slate-500 mt-0.5">Run allocation generation for assigned items</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => router.push('/dashboard/staff/inventory/allocations')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
            <Boxes className="h-4 w-4" /> View Allocations
          </button>
          {canManage && (
            <button onClick={() => { setSelectedAssignments([]); setShowBulkModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
              <PlayCircle className="h-4 w-4" /> Bulk Run
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center gap-2.5">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          className="w-full md:w-44 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 bg-white">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
        <button onClick={() => { loadJobs(); loadPendingAssignments(); }}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {loading && jobs.length === 0 ? (
          <div className="p-14 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-600 mb-3" />
            <p className="text-sm font-semibold">Loading generation jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-14 flex flex-col items-center justify-center text-slate-400">
            <Package className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-600">No generation jobs found</p>
            <p className="text-xs mt-1">Run a generation from the Bulk Run button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-3.5 pl-5">Assignment</th>
                  <th className="p-3.5">Started</th>
                  <th className="p-3.5">Progress</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {jobs.map(job => {
                  const isRunning = ['pending', 'in_progress'].includes(job.status);
                  const progressPct = getProgressPct(job);
                  const assignment = assignments.find(a => a.id === job.assignment);
                  const displayTitle = assignment?.title || job.item_name || `Assignment #${job.assignment}`;
                  const displayItem = job.item_name || assignment?.item_name || '—';
                  const displayQty = assignment?.quantity_per_student || '—';

                  return (
                    <tr key={job.job_id} onClick={() => setSelectedJobDetail(job)}
                      className="group hover:bg-slate-50/80 cursor-pointer transition-colors">
                      <td className="p-3.5 pl-5 max-w-[280px]">
                        <p
                          className="text-sm font-bold text-slate-900 truncate"
                          title={displayTitle}
                        >
                          {displayTitle}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                          {displayItem} <span className="text-slate-400">({displayQty} per student)</span>
                        </p>
                      </td>
                      <td className="p-3.5">
                        <p className="text-xs text-slate-600">{new Date(job.created_at).toLocaleDateString('en-GB')}</p>
                        <p className="text-[10px] text-slate-400">{new Date(job.created_at).toLocaleTimeString()}</p>
                      </td>
                      <td className="p-3.5 min-w-[180px]">
                        {isRunning ? (
                          <div>
                            <div className="flex justify-between text-[10px] font-bold text-cyan-700 mb-1">
                              <span>Running...</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="w-full bg-cyan-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-cyan-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                            <span title="Total Students">{job.total_students} Total</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-emerald-600" title="Created">{job.created_collections} Created</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-amber-600" title="Skipped">{job.skipped_students} Skipped</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-cyan-500 transition-colors ml-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk Generation Modal (ALL assignments with Check All) ── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center">
                  <Cpu className="h-4 w-4 text-cyan-600" />
                </div>
                <h3 className="font-bold text-slate-900">Bulk Generation</h3>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">
                Select assignments to generate. System skips students who already have allocations.
              </p>
              <button
                onClick={toggleAllAssignments}
                className="text-[10px] font-bold uppercase text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md hover:bg-cyan-100 transition-colors whitespace-nowrap ml-3 shrink-0"
              >
                {selectedAssignments.length === assignments.length && assignments.length > 0 ? 'Uncheck All' : 'Check All'}
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {assignments.length === 0 ? (
                <p className="text-center py-8 text-sm text-slate-400">No active assignments found.</p>
              ) : assignments.map(a => {
                const isChecked = selectedAssignments.includes(a.id);
                const alreadyGenerated = generatedAssignmentIds.has(a.id);
                const displayTitle = a.title || a.item_name || `Assignment #${a.id}`;

                return (
                  <label key={a.id} onClick={() => {
                    setSelectedAssignments(prev => prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id]);
                  }} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all mb-2 ${isChecked ? 'border-cyan-500 bg-cyan-50/30' : 'border-slate-100 hover:border-slate-200'}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'bg-cyan-600 border-cyan-600' : 'bg-white border-slate-300'}`}>
                      {isChecked && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-bold text-slate-800 truncate"
                        title={displayTitle}
                      >
                        {displayTitle}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{a.item_name} ({a.quantity_per_student} per student)</p>
                    </div>
                    {alreadyGenerated && (
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
                        Generated
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowBulkModal(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-200 bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleRunBulkGeneration} disabled={isBulkSubmitting || selectedAssignments.length === 0}
                className="px-6 py-2.5 bg-cyan-600 text-white text-sm font-bold rounded-xl hover:bg-cyan-700 shadow-md disabled:opacity-50 flex items-center gap-2">
                {isBulkSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Run ({selectedAssignments.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Assignments Modal (quick generate) ── */}
      {showPendingModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <BellRing className="h-4 w-4 text-amber-600" />
                </div>
                <h3 className="font-bold text-slate-900">Pending Allocations</h3>
              </div>
              <button onClick={() => setShowPendingModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {pendingAssignments.map(a => {
                const displayTitle = a.title || a.item_name || `Assignment #${a.id}`;
                return (
                  <div key={a.id} className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 rounded-xl">
                    <div className="flex-1 min-w-0 mr-3">
                      <p
                        className="text-sm font-bold text-slate-800 truncate"
                        title={displayTitle}
                      >
                        {displayTitle}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{a.item_name} ({a.quantity_per_student} per student)</p>
                    </div>
                    <button disabled={generatingFor === a.id}
                      onClick={() => handleGenerateForAssignment(a.id)}
                      className="px-4 py-2 bg-white border-2 border-cyan-100 text-cyan-700 text-xs font-bold rounded-xl hover:bg-cyan-50 transition-colors disabled:opacity-50 min-w-[100px] shrink-0">
                      {generatingFor === a.id ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Generate'}
                    </button>
                  </div>
                );
              })}
              {pendingAssignments.length === 0 && (
                <p className="text-center py-12 text-slate-400 text-sm font-medium">All assignments have been generated. 🎉</p>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowPendingModal(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-200 bg-slate-100 rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Job Detail Drawer ── */}
      {selectedJobDetail && (() => {
        const assignment = assignments.find(a => a.id === selectedJobDetail.assignment);
        const displayTitle = assignment?.title || selectedJobDetail.item_name || `Assignment #${selectedJobDetail.assignment}`;
        const displayItem = selectedJobDetail.item_name || assignment?.item_name || '—';
        const displayQty = assignment?.quantity_per_student || '—';

        return (
          <div className="fixed inset-0 z-[80] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedJobDetail(null)} />
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-900 flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-cyan-600" /> Generation Run Details
                </h3>
                <button onClick={() => setSelectedJobDetail(null)} className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-lg border border-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
                {/* Status */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                  selectedJobDetail.status === 'success' ? 'bg-emerald-50 border-emerald-200' :
                  selectedJobDetail.status === 'failure' ? 'bg-rose-50 border-rose-200' :
                  'bg-cyan-50 border-cyan-200'
                }`}>
                  {selectedJobDetail.status === 'success' ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> :
                   selectedJobDetail.status === 'failure' ? <XCircle className="h-6 w-6 text-rose-600" /> :
                   <Loader2 className="h-6 w-6 text-cyan-600 animate-spin" />}
                  <div>
                    <p className="font-bold text-sm">{selectedJobDetail.status_display || selectedJobDetail.status}</p>
                    <p className="text-xs mt-0.5 opacity-80">Started: {new Date(selectedJobDetail.created_at).toLocaleString()}</p>
                    {selectedJobDetail.completed_at && (
                      <p className="text-xs mt-0.5 opacity-80">Completed: {new Date(selectedJobDetail.completed_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>

                {/* Assignment Info (full — not truncated) */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignment</p>
                  <p className="text-sm font-bold text-slate-800 break-words">{displayTitle}</p>
                  <p className="text-xs text-slate-500">
                    Item: <span className="font-bold">{displayItem}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Quantity per Student: <span className="font-bold">{displayQty}</span>
                  </p>
                </div>

                {/* Job ID */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Job ID</p>
                  <p className="text-sm font-mono text-slate-700 break-all">{selectedJobDetail.job_id}</p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Students</p>
                    <p className="text-xl font-black text-slate-800">{selectedJobDetail.total_students}</p>
                  </div>
                  <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-1">Processed</p>
                    <p className="text-xl font-black text-cyan-700">{selectedJobDetail.processed_students}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Created</p>
                    <p className="text-xl font-black text-emerald-700">{selectedJobDetail.created_collections}</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Skipped</p>
                    <p className="text-xl font-black text-amber-700">{selectedJobDetail.skipped_students}</p>
                  </div>
                </div>

                {/* Message */}
                {selectedJobDetail.error_message && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-500" /> Message
                    </h4>
                    <div className="p-4 bg-slate-900 rounded-xl overflow-x-auto">
                      <pre className="text-[10px] text-rose-300 font-mono whitespace-pre-wrap">{selectedJobDetail.error_message}</pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50">
                <button onClick={() => {
                  setSelectedJobDetail(null);
                  router.push('/dashboard/staff/inventory/allocations');
                }} className="w-full py-3 bg-cyan-600 text-white font-bold text-sm rounded-xl hover:bg-cyan-700 flex items-center justify-center gap-2">
                  <Boxes className="h-4 w-4" /> View Allocations
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}