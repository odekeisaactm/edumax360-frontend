'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api, feeAPI, academicCalendarAPI, schoolConfigAPI } from '@/lib/api';
import { billingLedgerAPI } from '@/lib/fee.service';
import { FeeNotificationBatch, FeeNotificationLog } from '@/lib/fee.types';
import {
  Mail, Check, AlertCircle, AlertTriangle, Loader2, Search, FilterX, Users, X, Send,
  FileText, ArrowRight, ChevronLeft, ChevronRight, Eye, RefreshCw, Zap, CheckCircle2,
  XCircle, Clock, ShieldCheck, HelpCircle, Layers, Calendar
} from 'lucide-react';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

interface LiveBatchStatus {
  id: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  status_display: string;
  is_complete: boolean;
  total_targets: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  progress_pct: number;
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
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[120] flex flex-col gap-2 pointer-events-none">
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

// ─── Active Campaign Progress Banner ──────────────────────────────────────────
function ActiveCampaignBanner({ status }: { status: LiveBatchStatus }) {
  const isDone = status.is_complete;
  const hasFailures = status.failed > 0;

  let icon = <Loader2 className="h-4 w-4 animate-spin text-rose-600" />;
  let bg = 'bg-white border-slate-200';
  let label = `Sending emails & generating PDFs — ${status.processed} of ${status.total_targets} processed`;

  if (isDone) {
    if (status.status === 'completed' && !hasFailures) {
      icon = <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      bg = 'bg-emerald-50 border-emerald-200';
      label = `Campaign finished — ${status.successful} sent successfully (${status.skipped} skipped)`;
    } else if (hasFailures) {
      icon = <AlertTriangle className="h-4 w-4 text-amber-600" />;
      bg = 'bg-amber-50 border-amber-200';
      label = `Campaign finished with ${status.failed} failure(s) — see details below`;
    } else {
      icon = <XCircle className="h-4 w-4 text-red-600" />;
      bg = 'bg-red-50 border-red-200';
      label = 'Campaign failed to complete.';
    }
  }

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 shadow-sm ${bg} animate-in slide-in-from-top-2`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 truncate">{label}</p>
        {!isDone && (
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
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

// ─── Main Content Component ───────────────────────────────────────────────────
function FeeRemindersContent() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const canManageFees = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const [celeryStatus, setCeleryStatus] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);

  // History State
  const [batches, setBatches] = useState<FeeNotificationBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 15;

  // Selected Batch for Audit Drawer
  const [selectedBatch, setSelectedBatch] = useState<FeeNotificationBatch | null>(null);
  const [loadingBatchDetail, setLoadingBatchDetail] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerStatusFilter, setDrawerStatusFilter] = useState('');

  // Live Polling
  const [activeStatus, setActiveStatus] = useState<LiveBatchStatus | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Wizard State ──
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [campaignType, setCampaignType] = useState<'send_reminders' | 'send_summaries'>('send_reminders');
  const [sessionId, setSessionId] = useState('');
  const [periodId, setPeriodId] = useState('');

  // Custom Filters for Wizard
  const [minDebt, setMinDebt] = useState('0');
  const [skipDays, setSkipDays] = useState('5');

  // Wizard Step 2 Recipients Preview
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<number>>(new Set());
  const [tableSearch, setTableSearch] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Initialize
  useEffect(() => {
    schoolConfigAPI.getCeleryStatus()
      .then(res => setCeleryStatus(res.alive))
      .catch(() => setCeleryStatus(false));

    academicCalendarAPI.listSessions().then(s => {
      const sessList = Array.isArray(s) ? s : (s as any)?.results || [];
      setSessions(sessList);
      const active = sessList.find((x: any) => x.is_active);
      if (active) setSessionId(active.id.toString());
    });

    // Prefill skipDays from global settings
    feeAPI.getSettings().then((setts: any) => {
      if (setts?.reminder_interval_days !== undefined) {
        setSkipDays(setts.reminder_interval_days.toString());
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionId) {
      academicCalendarAPI.listSessionPeriods({ session_id: Number(sessionId) })
        .then(p => {
          const perList = Array.isArray(p) ? p : (p as any)?.results || [];
          setPeriods(perList);
          const current = perList.find((x: any) => x.is_current);
          if (current) setPeriodId(current.id.toString());
          else if (perList.length > 0) setPeriodId(perList[0].id.toString());
        });
    } else {
      setPeriods([]);
      setPeriodId('');
    }
  }, [sessionId]);

  const fetchBatchHistory = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await feeAPI.getNotificationBatches();
      const results = Array.isArray(res) ? res : res?.results ?? [];
      setBatches(results);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoadingBatches(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchBatchHistory();
  }, [fetchBatchHistory]);

  // Clean up poll on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  // ── Background Polling ──
  const pollBatchProgress = useCallback((batchId: number, attempt = 0) => {
    if (attempt >= 120) {
      setActiveStatus(null);
      return;
    }

    pollTimeoutRef.current = setTimeout(async () => {
      try {
        const data: LiveBatchStatus = await feeAPI.getNotificationBatchStatus(batchId);
        setActiveStatus(data);

        if (data.is_complete) {
          if (data.status === 'completed') {
            showToast('success', `Campaign complete: ${data.successful} sent successfully.`);
          } else {
            showToast('error', `Campaign finished with ${data.failed} error(s).`);
          }
          fetchBatchHistory();
          setTimeout(() => setActiveStatus(null), 6000);
          return;
        }

        pollBatchProgress(batchId, attempt + 1);
      } catch (err) {
        pollBatchProgress(batchId, attempt + 1);
      }
    }, 2000);
  }, [fetchBatchHistory, showToast]);

  // ── Fetch Recipients for Step 2 ──
  const fetchRecipientsForWizard = async () => {
    if (!sessionId || !periodId) return showToast('error', 'Select Session and Term first.');
    setPreviewLoading(true);
    try {
      const res = await billingLedgerAPI.get({
        session_id: sessionId,
        period_id: periodId,
        mode: 'parent',
        debtors_only: campaignType === 'send_reminders',
        page_size: 5000, // Fetch all for the preview table
      } as any);

      const results = Array.isArray(res) ? res : res?.results ?? [];
      setPreviewData(results);
      setSelectedRecipientIds(new Set(results.map((r: any) => r.parent_id)));
      setWizardStep(2);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (selectedRecipientIds.size === 0) return showToast('error', 'Select at least one recipient.');
    setIsExecuting(true);
    try {
      const targetIds = Array.from(selectedRecipientIds);
      const res: any = await billingLedgerAPI.bulkAction({
        action: campaignType,
        target_type: 'parent',
        target_ids: targetIds,
        session_id: Number(sessionId),
        period_id: Number(periodId),
        skip_days: Number(skipDays) || 0,
        min_debt: campaignType === 'send_reminders' ? (Number(minDebt) || 0) : undefined,
      } as any);

      showToast('success', res.detail || 'Campaign launched in background.');
      setIsWizardOpen(false);
      setWizardStep(1);

      // Instantly show the banner using the batch_id returned from Django
      if (res.batch_id) {
        setActiveStatus({
          id: res.batch_id,
          status: 'pending',
          status_display: 'Pending',
          is_complete: false,
          total_targets: targetIds.length,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          progress_pct: 0,
        });
        pollBatchProgress(res.batch_id);
      } else {
        // Fallback if backend doesn't return batch_id
        fetchBatchHistory();
      }

    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsExecuting(false);
    }
  };

  // Open Audit Detail Drawer
  const openAuditDrawer = async (batch: FeeNotificationBatch) => {
    setSelectedBatch(batch);
    setLoadingBatchDetail(true);
    try {
      const full = await feeAPI.getNotificationBatch(batch.id);
      setSelectedBatch(full);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoadingBatchDetail(false);
    }
  };

  // ── Filtered History Batches ──
  const filteredBatches = useMemo(() => {
    if (!historySearch.trim()) return batches;
    const q = historySearch.toLowerCase();
    return batches.filter(b =>
      b.action_display?.toLowerCase().includes(q) ||
      b.created_by_name?.toLowerCase().includes(q) ||
      `BAT-${b.id}`.toLowerCase().includes(q)
    );
  }, [batches, historySearch]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredBatches.length / HISTORY_PAGE_SIZE));
  const pagedBatches = filteredBatches.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

  // ── Filtered Recipient Preview (Wizard Step 2) ──
  const filteredRecipients = useMemo(() => {
    if (!tableSearch.trim()) return previewData;
    const q = tableSearch.toLowerCase();
    return previewData.filter((r: any) =>
      r.parent_name?.toLowerCase().includes(q) || r.phone?.includes(q)
    );
  }, [previewData, tableSearch]);

  // ── Filtered Drawer Logs ──
  const filteredLogs = useMemo(() => {
    const logs = selectedBatch?.logs || [];
    return logs.filter((log: FeeNotificationLog) => {
      const matchesSearch = !drawerSearch.trim() ||
        log.parent_name?.toLowerCase().includes(drawerSearch.toLowerCase()) ||
        log.parent_phone?.includes(drawerSearch);
      const matchesStatus = !drawerStatusFilter || log.status === drawerStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [selectedBatch, drawerSearch, drawerStatusFilter]);

  if (!canManageFees) return <div className="p-16 text-center text-red-600 font-bold">Access Denied</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 pb-28 space-y-5 animate-in fade-in">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {activeStatus && <ActiveCampaignBanner status={activeStatus} />}

      {celeryStatus === false && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-amber-800 text-sm">Background Workers Offline</h3>
            <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">Celery worker processes are not responding. Emails and PDF generation tasks will queue until background workers are restarted.</p>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-100 shrink-0">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Fee Reminders &amp; Statements</h1>
            <p className="text-xs text-slate-400 mt-0.5">Automated payment reminders, consolidated statement PDFs, and delivery logs.</p>
          </div>
        </div>
        <button
          onClick={() => { setIsWizardOpen(true); setWizardStep(1); }}
          className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
        >
          <Zap className="h-4 w-4" /> Launch New Campaign
        </button>
      </div>

      {/* ── KPI METRICS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Campaigns</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{batches.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delivered Successfully</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {batches.reduce((acc, b) => acc + (b.successful || 0), 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Throttled / Anti-Spam</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {batches.reduce((acc, b) => acc + (b.skipped || 0), 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Failed Deliveries</p>
          <p className="text-2xl font-black text-rose-600 mt-1">
            {batches.reduce((acc, b) => acc + (b.failed || 0), 0)}
          </p>
        </div>
      </div>

      {/* ── CAMPAIGN HISTORY LEDGER ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">Campaign Audit History</h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={historySearch}
              onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Campaign Type</th>
                <th className="px-5 py-3.5">Term</th>
                <th className="px-5 py-3.5">Triggered By</th>
                <th className="px-5 py-3.5 text-center">Results (Sent / Skip / Fail)</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loadingBatches ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />Loading history...</td></tr>
              ) : pagedBatches.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400 font-medium">No campaign history found.</td></tr>
              ) : (
                pagedBatches.map(batch => (
                  <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        BAT-{batch.id.toString().padStart(4, '0')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      {batch.action === 'send_reminders' ? (
                        <span className="flex items-center gap-1.5 text-rose-700"><Mail className="w-3.5 h-3.5 text-rose-500" /> Payment Reminders</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-indigo-700"><FileText className="w-3.5 h-3.5 text-indigo-500" /> Account Statements</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-semibold">
                      {batch.session_display} &bull; {batch.period_display}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{batch.created_by_name}</td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="Sent">{batch.successful}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" title="Skipped">{batch.skipped}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100" title="Failed">{batch.failed}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${
                        batch.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        batch.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                        batch.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {batch.status_display || batch.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-400 font-medium">
                      {new Date(batch.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openAuditDrawer(batch)}
                        className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg transition-colors"
                        title="View Delivery Logs"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {historyTotalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Page {historyPage} of {historyTotalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                disabled={historyPage === historyTotalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CAMPAIGN WIZARD DRAWER ── */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full sm:max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Send className="h-4 w-4 text-indigo-300" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Launch Communication Campaign</h2>
                  <p className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest">Step {wizardStep} of 3</p>
                </div>
              </div>
              <button onClick={() => setIsWizardOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
              {/* STEP 1: CAMPAIGN CONFIG */}
              {wizardStep === 1 && (
                <div className="space-y-5 animate-in zoom-in-95">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">1. Select Campaign Objective</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setCampaignType('send_reminders')}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${campaignType === 'send_reminders' ? 'border-rose-500 bg-rose-50/50 shadow-2xs' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-2 font-bold text-slate-800 text-xs mb-1">
                          <Mail className="w-4 h-4 text-rose-600" /> Payment Reminders
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">Sends debt notifications with attached PDF invoice summaries to owing parents.</p>
                      </div>

                      <div
                        onClick={() => setCampaignType('send_summaries')}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${campaignType === 'send_summaries' ? 'border-indigo-500 bg-indigo-50/50 shadow-2xs' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-2 font-bold text-slate-800 text-xs mb-1">
                          <FileText className="w-4 h-4 text-indigo-600" /> Account Statements
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">Sends official statement of account PDFs consolidating all wards to every parent.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">2. Scope &amp; Target Term</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Session</label>
                        <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500">
                          {sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Term</label>
                        <select value={periodId} onChange={e => setPeriodId(e.target.value)} disabled={!sessionId} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                          {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {campaignType === 'send_reminders' && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">3. Advanced Filtering & Anti-Spam</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Minimum Debt Threshold (₦)</label>
                          <input
                            type="number"
                            min="0"
                            value={minDebt}
                            onChange={e => setMinDebt(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="0.00"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Skip parents owing below this amount.</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Skip if Reminded Within (Days)</label>
                          <input
                            type="number"
                            min="0"
                            value={skipDays}
                            onChange={e => setSkipDays(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="5"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Prevents spamming parents by skipping recent contacts.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: RECIPIENT PREVIEW TABLE */}
              {wizardStep === 2 && (
                <div className="space-y-3 h-full flex flex-col animate-in slide-in-from-right">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">Recipients Preview ({selectedRecipientIds.size} selected)</h3>
                      <p className="text-[11px] text-slate-500">Uncheck anyone you do not wish to contact in this campaign.</p>
                    </div>
                    <div className="relative w-48">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={tableSearch}
                        onChange={e => setTableSearch(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
                    <div className="overflow-y-auto flex-1 max-h-96">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-2.5 w-8 text-center">
                              <input
                                type="checkbox"
                                checked={selectedRecipientIds.size > 0 && selectedRecipientIds.size === filteredRecipients.length}
                                onChange={e => setSelectedRecipientIds(e.target.checked ? new Set(filteredRecipients.map((r: any) => r.parent_id)) : new Set())}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                            </th>
                            <th className="px-3 py-2.5">Parent Name</th>
                            <th className="px-3 py-2.5 text-right">Owing Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredRecipients.map((r: any) => {
                            const isChecked = selectedRecipientIds.has(r.parent_id);
                            return (
                              <tr key={r.parent_id} onClick={() => {
                                const next = new Set(selectedRecipientIds);
                                next.has(r.parent_id) ? next.delete(r.parent_id) : next.add(r.parent_id);
                                setSelectedRecipientIds(next);
                              }} className={`cursor-pointer ${isChecked ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`}>
                                <td className="px-3 py-2.5 text-center">
                                  <input type="checkbox" checked={isChecked} readOnly className="rounded text-indigo-600 pointer-events-none" />
                                </td>
                                <td className="px-3 py-2.5 font-bold text-slate-800">{r.parent_name}</td>
                                <td className="px-3 py-2.5 text-right font-black text-rose-600">{formatCurrency(r.grand_total_outstanding)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: FINAL CONFIRMATION */}
              {wizardStep === 3 && (
                <div className="space-y-4 max-w-lg mx-auto py-4 text-center animate-in zoom-in-95">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Ready to Launch Campaign?</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      You are about to dispatch <strong>{campaignType === 'send_reminders' ? 'Payment Reminders' : 'Account Statements'}</strong> to <strong>{selectedRecipientIds.size} parent(s)</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2">
                    <div className="flex justify-between">
                       <span className="text-slate-500">Objective:</span>
                       <strong className="text-slate-800 capitalize">{campaignType.replace('send_', '')}</strong>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-slate-500">Term:</span>
                       <strong className="text-slate-800">
                         {(() => {
                            const sess = sessions.find(s => s.id.toString() === sessionId);
                            const per = periods.find(p => p.id.toString() === periodId);
                            const sessionStr = sess?.name || `${sess?.start_year}/${sess?.end_year}`;
                            const periodStr = per?.period?.name || per?.name;
                            return `${sessionStr} • ${periodStr}`;
                         })()}
                       </strong>
                    </div>
                    <div className="flex justify-between"><span className="text-slate-500">Recipients:</span><strong className="text-indigo-600 font-bold">{selectedRecipientIds.size} Parents</strong></div>
                    <div className="flex justify-between"><span className="text-slate-500">Attachments:</span><strong className="text-slate-800">Generated PDF Statements</strong></div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic">This runs asynchronously in the background via Celery. You can safely close the window and track progress on the dashboard.</p>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
              {wizardStep > 1 ? (
                <button onClick={() => setWizardStep(p => (p - 1) as any)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">
                  Back
                </button>
              ) : <div></div>}

              {wizardStep === 1 && (
                <button
                  disabled={previewLoading || !sessionId || !periodId}
                  onClick={fetchRecipientsForWizard}
                  className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-100 flex items-center gap-1.5"
                >
                  {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Review Recipients'} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {wizardStep === 2 && (
                <button
                  disabled={selectedRecipientIds.size === 0}
                  onClick={() => setWizardStep(3)}
                  className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-100 flex items-center gap-1.5"
                >
                  Proceed to Confirm <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {wizardStep === 3 && (
                <button
                  disabled={isExecuting}
                  onClick={handleLaunchCampaign}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-200 flex items-center gap-2"
                >
                  {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Launch Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── BATCH AUDIT DETAIL DRAWER ── */}
      {selectedBatch && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full sm:max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-900 text-white">
              <div>
                <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest">Campaign Audit</span>
                <h3 className="text-sm font-bold">BAT-{selectedBatch.id.toString().padStart(4, '0')} &bull; {selectedBatch.action_display}</h3>
              </div>
              <button onClick={() => setSelectedBatch(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Delivered</span>
                  <p className="text-lg font-black text-emerald-800">{selectedBatch.successful}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Throttled</span>
                  <p className="text-lg font-black text-amber-800">{selectedBatch.skipped}</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Failed</span>
                  <p className="text-lg font-black text-rose-800">{selectedBatch.failed}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search recipient..."
                    value={drawerSearch}
                    onChange={e => setDrawerSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                  />
                </div>
                <select
                  value={drawerStatusFilter}
                  onChange={e => setDrawerStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none font-semibold text-slate-600"
                >
                  <option value="">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="skipped">Skipped</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                {loadingBatchDetail ? (
                  <div className="py-12 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />Loading audit logs...</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">No delivery logs found.</div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {filteredLogs.map(log => (
                      <div key={log.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/60">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{log.parent_name || log.student_name || 'Recipient'}</p>
                          {log.parent_phone && <p className="text-[10px] text-slate-400 font-mono">{log.parent_phone}</p>}
                          {log.error_message && <p className="text-[10px] text-rose-500 mt-0.5">{log.error_message}</p>}
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border shrink-0 ${
                          log.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          log.status === 'skipped' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {log.status_display || log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeeRemindersPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}>
      <FeeRemindersContent />
    </Suspense>
  );
}