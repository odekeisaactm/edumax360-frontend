'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusCircle, CreditCard, Clock, CheckCircle2,
  XCircle, RotateCcw, Mail, Eye, X, Loader2,
  AlertCircle, Search, ExternalLink,
  AlertTriangle, Check
} from 'lucide-react';
import { feeAPI, api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ─── Helpers & Types ──────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string | null): string {
  if (!str || str.includes('<method-wrapper')) return 'Unknown Payer';
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

// Dedupe allocation rows down to unique invoices so we don't show a "View" link
// per line item when several items belong to the same invoice.
function getUniqueInvoiceLinks(allocations: any[] = []): { id: number; type: 'student' | 'family' }[] {
  const map = new Map<number, { id: number; type: 'student' | 'family' }>();
  for (const a of allocations) {
    if (a.invoice_id) {
      map.set(a.invoice_id, { id: a.invoice_id, type: a.invoice_type || 'student' });
    }
  }
  return Array.from(map.values());
}

function isReversalExpired(payment: any, settings: any): boolean {
  const windowHours = settings?.reversal_window_hours ?? 24;
  if (windowHours <= 0) return false;
  const hoursOld = (Date.now() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60);
  return hoursOld > windowHours;
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} role="status" className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in slide-in-from-top-2
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2" aria-label="Dismiss notification">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Custom Modal Dialogs ─────────────────────────────────────────────────────
function ConfirmActionModal({ open, title, message, onConfirm, onCancel, loading }: any) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h3 id="confirm-modal-title" className="text-lg font-bold text-slate-900 text-center">{title}</h3>
        <p className="text-xs text-slate-500 text-center leading-relaxed">{message}</p>
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 text-xs font-semibold border rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200 transition-colors">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonModal({ open, title, icon, actionText, actionColor, onConfirm, onCancel, loading }: any) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      // small delay so the modal is mounted before we try to focus it
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const btnColor = actionColor === 'rose' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200';
  const headerColor = actionColor === 'rose' ? 'text-rose-600' : 'text-amber-600';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="reason-modal-title" className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
        <div id="reason-modal-title" className={`flex items-center gap-2 font-bold text-base ${headerColor}`}>
          {icon} {title}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">Please state the exact reason for this action to maintain ledger integrity.</p>
        <div>
          <label htmlFor="reason-textarea" className="block text-xs font-bold text-slate-600 uppercase mb-1">Reason <span className="text-rose-500">*</span></label>
          <textarea
            id="reason-textarea"
            ref={textareaRef}
            rows={3}
            placeholder="Provide detail..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-xs font-semibold border rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={loading || !reason.trim()} className={`px-5 py-2 text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors ${btnColor}`}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {actionText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
// Matches PaymentReceiptModel.PaymentStatus exactly: pending / confirmed / failed / reverted.
// (There is no "declined" status on the backend — a rejected pending payment is reverted,
// same as an undo on a confirmed one. Kept as one status+label so the badge never lies
// about what actually happened.)
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending Approval', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { label: 'Failed', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: <XCircle className="h-3 w-3" /> },
    reverted: { label: 'Reverted', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: <RotateCcw className="h-3 w-3" /> },
  };
  const meta = map[status?.toLowerCase() || 'pending'] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Main Consolidated Page ────────────────────────────────────────────────────
export default function PaymentsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending_count: 0, confirmed_today_total: 0 });
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination — backend uses LargeResultsPagination, so the list is server-paginated.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Guards against a slow, stale request landing after a newer one and clobbering
  // fresher results (e.g. typing quickly in search, or flipping status filter fast).
  const requestIdRef = useRef(0);

  // Modals & Drawer States
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [declineModal, setDeclineModal] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [revertModal, setRevertModal] = useState<{ open: boolean; item: any }>({ open: false, item: null });

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const fetchPaymentsAndStats = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params: any = { page: currentPage };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const [listRes, statsRes, settingsRes] = await Promise.all([
        feeAPI.getReceipts(params),
        api.get('/api/fee/checkouts/stats/').catch(() => ({ data: { pending_count: 0, confirmed_today_total: 0 } })),
        feeAPI.getSettings().catch(() => ({}))
      ]);

      // Discard if a newer request has since been fired.
      if (requestId !== requestIdRef.current) return;

      let finalResults: any[] = [];
      let count = 0;
      if (Array.isArray(listRes)) {
        finalResults = listRes;
        count = listRes.length;
      } else if (listRes?.results && Array.isArray(listRes.results)) {
        finalResults = listRes.results;
        count = listRes.count ?? listRes.results.length;
      } else if (listRes?.data?.results && Array.isArray(listRes.data.results)) {
        finalResults = listRes.data.results;
        count = listRes.data.count ?? listRes.data.results.length;
      } else if (listRes?.data && Array.isArray(listRes.data)) {
        finalResults = listRes.data;
        count = listRes.data.length;
      }

      setPayments(finalResults);
      setTotalCount(count);
      if (finalResults.length > 0 && listRes?.page_size) setPageSize(listRes.page_size);
      setStats(statsRes.data);
      setSettings(settingsRes);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error("Failed to load payments", error);
      showToast('error', extractError(error));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [statusFilter, search, currentPage]);

  // Debounce search only; status/page changes fetch immediately.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPaymentsAndStats();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPaymentsAndStats]);

  // Reset to page 1 whenever filters change (not on page changes themselves).
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, search]);

  // Keyboard shortcut for drawer
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  // Patch a single row in place instead of doing a full refetch after an action —
  // avoids the whole-table loading flicker. Falls back to a full refetch if the
  // updated receipt isn't in the currently loaded page (e.g. status filter no
  // longer matches it) so stats/pagination stay correct.
  const patchPaymentRow = useCallback((updated: any) => {
    setPayments(prev => {
      const exists = prev.some(p => p.id === updated.id);
      if (!exists) return prev;
      // If an active status filter no longer matches this row's new status, drop it
      // from the current view and let a background refetch keep counts honest.
      if (statusFilter && updated.status !== statusFilter) {
        fetchPaymentsAndStats();
        return prev.filter(p => p.id !== updated.id);
      }
      return prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p));
    });
    setSelectedPayment((prev: any) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    // Stats (pending count, confirmed today total) always need a fresh pull since
    // they're aggregate values, not derivable from a single row.
    api.get('/api/fee/checkouts/stats/').then(res => setStats(res.data)).catch(() => {});
  }, [statusFilter, fetchPaymentsAndStats]);

  // --- Action Handlers ---
  const handleApproveSubmit = async () => {
    if (!confirmModal.item) return;
    setActionLoading(true);
    try {
      const updated = await feeAPI.confirmReceipt(confirmModal.item.id, confirmModal.item.allocations || []);
      showToast('success', 'Payment confirmed successfully!');
      setConfirmModal({ open: false, item: null });
      setIsDrawerOpen(false);
      patchPaymentRow(updated?.data ?? updated ?? { ...confirmModal.item, status: 'confirmed' });
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineSubmit = async (reason: string) => {
    if (!declineModal.item) return;
    setActionLoading(true);
    try {
      const updated = await feeAPI.revertReceipt(declineModal.item.id, reason);
      showToast('success', 'Payment declined and reverted.');
      setDeclineModal({ open: false, item: null });
      setIsDrawerOpen(false);
      patchPaymentRow(updated?.data ?? updated ?? { ...declineModal.item, status: 'reverted', reversal_reason: reason });
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevertSubmit = async (reason: string) => {
    if (!revertModal.item) return;
    setActionLoading(true);
    try {
      const updated = await feeAPI.revertReceipt(revertModal.item.id, reason);
      showToast('success', 'Payment reversed successfully.');
      setRevertModal({ open: false, item: null });
      setIsDrawerOpen(false);
      patchPaymentRow(updated?.data ?? updated ?? { ...revertModal.item, status: 'reverted', reversal_reason: reason });
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmailReceipt = async (paymentId: number) => {
    try {
      if (feeAPI.emailReceipt) {
        await feeAPI.emailReceipt(paymentId);
      } else {
        await api.post(`/api/fee/checkouts/${paymentId}/email_receipt/`);
      }
      showToast('success', 'Receipt queued for emailing.');
    } catch (err: any) {
      showToast('error', extractError(err));
    }
  };

  const openDrawer = (payment: any) => {
    setSelectedPayment(payment);
    setIsDrawerOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* MODALS */}
      <ConfirmActionModal
        open={confirmModal.open}
        title="Confirm Payment"
        message={`Are you sure you want to approve this payment of ₦${Number(confirmModal.item?.total_amount || 0).toLocaleString()}?`}
        onConfirm={handleApproveSubmit}
        onCancel={() => setConfirmModal({ open: false, item: null })}
        loading={actionLoading}
      />

      <ReasonModal
        open={declineModal.open}
        title="Decline Payment"
        icon={<AlertTriangle className="h-5 w-5" />}
        actionText="Decline Payment"
        actionColor="rose"
        onConfirm={handleDeclineSubmit}
        onCancel={() => setDeclineModal({ open: false, item: null })}
        loading={actionLoading}
      />

      <ReasonModal
        open={revertModal.open}
        title="Revert Confirmed Payment"
        icon={<RotateCcw className="h-5 w-5" />}
        actionText="Confirm Reversal"
        actionColor="amber"
        onConfirm={handleRevertSubmit}
        onCancel={() => setRevertModal({ open: false, item: null })}
        loading={actionLoading}
      />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments & Receipts</h1>
          <p className="text-sm text-slate-500">Manage all incoming student and family payments.</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/staff/fee/payments/new')}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-md shadow-emerald-200"
        >
          <PlusCircle className="h-5 w-5" />
          New Payment
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Confirmed Today</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.confirmed_today_total)}</p>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')}
          className={`bg-white border ${statusFilter === 'pending' ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-200 hover:border-amber-300'} cursor-pointer rounded-xl p-5 shadow-sm flex items-center gap-4 transition-all`}
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Approvals</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-black text-slate-900">{stats.pending_count}</p>
              <span className="text-sm font-medium text-amber-600 mb-1">
                {statusFilter === 'pending' ? 'Viewing pending' : 'Click to filter & review'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search reference, payer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
            aria-label="Search payments"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="reverted">Reverted</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3.5">Date & Ref</th>
                <th className="px-4 py-3.5 min-w-[200px]">Payer Name</th>
                <th className="px-4 py-3.5 text-right">Amount</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-xs font-medium">Loading payments...</p>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500 font-medium">No payments found.</td>
                </tr>
              ) : (
                payments.map((p) => {
                  const payerName = toTitleCase(p.student_name || p.parent_name);
                  const isPending = p.status === 'pending';
                  const isConfirmed = p.status === 'confirmed';
                  const isExpired = isReversalExpired(p, settings);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-bold text-slate-800">{p.reference}</p>
                        <p className="text-xs text-slate-500">{formatDate(p.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800 flex items-center gap-2">
                          {p.student_image_url || p.parent_image_url ? (
                            <img src={getImageUrl(p.student_image_url || p.parent_image_url)} alt="" className="w-6 h-6 rounded-md object-cover border border-slate-200" />
                          ) : (
                            <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                              {payerName.charAt(0)}
                            </span>
                          )}
                          {payerName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 ml-8">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {p.parent ? 'Family' : 'Student'}
                          </span>
                          {p.student_class && (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {p.student_class}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(p.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button onClick={() => setConfirmModal({ open: true, item: p })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve" aria-label={`Approve payment ${p.reference}`}><CheckCircle2 className="w-4 h-4" /></button>
                              <button onClick={() => setDeclineModal({ open: true, item: p })} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Decline" aria-label={`Decline payment ${p.reference}`}><XCircle className="w-4 h-4" /></button>
                            </>
                          )}
                          {isConfirmed && (
                            <button
                              onClick={() => setRevertModal({ open: true, item: p })}
                              disabled={isExpired}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isExpired ? `Reversal period (${settings?.reversal_window_hours ?? 24}h) expired` : "Revert"}
                              aria-label={`Revert payment ${p.reference}`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => openDrawer(p)} className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors shadow-sm" title="View Details" aria-label={`View details for ${p.reference}`}>
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Page {currentPage} of {totalPages} · {totalCount} total
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg shadow-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg shadow-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER (Audit Style) */}
      {isDrawerOpen && selectedPayment && (
        <div onClick={() => setIsDrawerOpen(false)} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200"
          >
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Transaction Audit</span>
                <h3 id="drawer-title" className="text-base font-bold truncate">Ref: {selectedPayment.reference}</h3>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close drawer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Payment Summary Header */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Total Amount</p>
                  <p className="text-3xl font-black text-slate-900">{formatCurrency(selectedPayment.total_amount)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <StatusBadge status={selectedPayment.status} />
                </div>
              </div>

              {selectedPayment.reversal_reason && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5 text-rose-600" /> Reversal / Decline Reason
                  </span>
                  <p className="text-xs text-rose-950 font-medium leading-relaxed">{selectedPayment.reversal_reason}</p>
                </div>
              )}

              {/* Profile Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payer Profile Breakdown</h4>
                <div className="p-4 rounded-2xl border border-slate-100 bg-white space-y-3 shadow-sm">
                  <div className="flex items-center gap-3.5 border-b border-slate-100 pb-3">
                    {selectedPayment.student_image_url || selectedPayment.parent_image_url ? (
                      <img src={getImageUrl(selectedPayment.student_image_url || selectedPayment.parent_image_url)} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                        {toTitleCase(selectedPayment.student_name || selectedPayment.parent_name).charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-base truncate">{toTitleCase(selectedPayment.student_name || selectedPayment.parent_name)}</p>
                      <p className="text-xs font-mono text-slate-500">{selectedPayment.parent ? 'Family Account' : 'Student Account'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Class / Context:</span>
                      <strong className="text-slate-700">{selectedPayment.student_class || 'N/A'}</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Payment Mode:</span>
                      <strong className="text-slate-700 capitalize">{selectedPayment.external_payment_mode || 'Wallet/Online'}</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg col-span-2">
                      <span className="text-slate-400 block">Processed By:</span>
                      <strong className="text-slate-700">{selectedPayment.confirmed_by_full_name || selectedPayment.confirmed_by_name || 'System'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Allocations Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                  <span>Allocation Breakdown</span>
                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{selectedPayment.allocations?.length || 0} items</span>
                </h4>

                <div className="space-y-2">
                  {selectedPayment.allocations?.map((alloc: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-white shadow-sm hover:border-slate-300 transition-colors">
                      <p
                      className="text-sm font-bold text-slate-800 cursor-help border-b border-dotted border-slate-400"
                      title={alloc.hover_detail || 'No additional details available'}
                    >
                      {toTitleCase(alloc.fee_name || alloc.description)}
                    </p>
                      <p className="font-black text-slate-900">{formatCurrency(alloc.amount)}</p>
                    </div>
                  ))}
                  {!selectedPayment.allocations?.length && (
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400 italic text-center">
                      No nested allocations recorded.
                    </div>
                  )}
                </div>

                {/* One "View Invoice" link per unique invoice, deduped across items.
                    Routes match the billing ledger page: /invoices/{id}?type=student|family */}
                {(() => {
                  const uniqueInvoices = getUniqueInvoiceLinks(selectedPayment.allocations);
                  if (uniqueInvoices.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {uniqueInvoices.map(({ id, type }) => (
                        <button
                          key={id}
                          onClick={() => {
                            setIsDrawerOpen(false);
                            router.push(`/dashboard/staff/fee/invoices/${id}?type=${type}`);
                          }}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-[10px] uppercase font-bold bg-blue-50 px-2 py-1 rounded transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View {type === 'family' ? 'Family Invoice' : 'Invoice'}{uniqueInvoices.length > 1 ? ` #${id}` : ''}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-2 flex-shrink-0">
              {selectedPayment.status === 'pending' && (
                <>
                  <button
                    disabled={actionLoading}
                    onClick={() => setDeclineModal({ open: true, item: selectedPayment })}
                    className="px-4 py-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Decline
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => setConfirmModal({ open: true, item: selectedPayment })}
                    className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-200"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve Payment
                  </button>
                </>
              )}
              {selectedPayment.status === 'confirmed' && (
                <>
                  <button
                    onClick={() => handleEmailReceipt(selectedPayment.id)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Mail className="w-4 h-4" /> Email Receipt
                  </button>

                  {(() => {
                    const isExpired = isReversalExpired(selectedPayment, settings);
                    return (
                      <button
                        disabled={isExpired}
                        onClick={() => setRevertModal({ open: true, item: selectedPayment })}
                        title={isExpired ? `Reversal period (${settings?.reversal_window_hours ?? 24}h) expired` : 'Revert Payment'}
                        className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className="w-4 h-4" /> {isExpired ? 'Reversal Expired' : 'Revert Payment'}
                      </button>
                    );
                  })()}
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}