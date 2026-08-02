'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusCircle, Clock, CheckCircle2, XCircle, RotateCcw,
  Mail, Eye, X, Loader2, AlertCircle, Search, ExternalLink,
  AlertTriangle, Check, Printer, FileText, Phone, Wallet, Building2
} from 'lucide-react';
import { feeAPI, api, schoolInfoAPI } from '@/lib/api';
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

function smartTitleCase(str: string): string {
  if (!str) return '';
  return str
    .split(' ')
    .filter(Boolean)
    .map(word => {
      if (/^[A-Z]{2,6}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function cleanFeeDescription(desc: string): string {
  if (!desc) return '';
  const dashIdx = desc.indexOf('—');
  const base = (dashIdx >= 0 ? desc.slice(0, dashIdx) : desc).trim();
  return smartTitleCase(base);
}

function formatPaymentMode(mode: string | null): string {
  if (!mode) return 'Wallet or Online Payment';
  return smartTitleCase(mode.replace(/_/g, ' '));
}

function isReversalExpired(payment: any, settings: any): boolean {
  const windowHours = settings?.reversal_window_hours ?? 24;
  if (windowHours <= 0) return false;
  const hoursOld = (Date.now() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60);
  return hoursOld > windowHours;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

function getImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

// Groups a payment's allocations by the group_name the backend already computes
// (e.g. "Chisom Chisom • LEA-0021" or "Family Shared Fees") — used by both the
// drawer and the print view so a payment covering several students shows one
// card per student instead of repeating their name on every line.
function groupAllocations(payment: any) {
  if (!payment?.allocations) return {};
  return payment.allocations.reduce((acc: any, curr: any) => {
    const groupName = curr.group_name || 'Other';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(curr);
    return acc;
  }, {});
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
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending Approval', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { label: 'Failed', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: <XCircle className="h-3 w-3" /> },
    reverted: { label: 'Reverted', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: <RotateCcw className="h-3 w-3" /> },
  };
  const meta = map[status?.toLowerCase() || 'pending'] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${meta.bg} ${meta.color} ${meta.border}`}>
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
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const requestIdRef = useRef(0);

  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Printable receipt — rendered in place from whatever payment object triggered it.
  // No route change, no second fetch: the row/drawer object already has everything.
  const [printPayment, setPrintPayment] = useState<any | null>(null);

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

      if (requestId !== requestIdRef.current) return;

      let finalResults: any[] = [];
      let count = 0;
      if (Array.isArray(listRes)) {
        finalResults = listRes; count = listRes.length;
      } else if (listRes?.results && Array.isArray(listRes.results)) {
        finalResults = listRes.results; count = listRes.count ?? listRes.results.length;
      }

      setPayments(finalResults);
      setTotalCount(count);
      if (finalResults.length > 0 && listRes?.page_size) setPageSize(listRes.page_size);
      setStats(statsRes.data);
      setSettings(settingsRes);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      showToast('error', extractError(error));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [statusFilter, search, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchPaymentsAndStats(); }, 300);
    return () => clearTimeout(timer);
  }, [fetchPaymentsAndStats]);

  // School letterhead info for the printable receipt — fetched once, reused for every print.
  useEffect(() => {
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => {});
  }, []);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, search]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsDrawerOpen(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!printPayment) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setPrintPayment(null); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printPayment]);

  const patchPaymentRow = useCallback((updated: any) => {
    setPayments(prev => {
      const exists = prev.some(p => p.id === updated.id);
      if (!exists) return prev;
      if (statusFilter && updated.status !== statusFilter) {
        fetchPaymentsAndStats();
        return prev.filter(p => p.id !== updated.id);
      }
      return prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p));
    });
    setSelectedPayment((prev: any) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
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
      if (feeAPI.emailReceipt) await feeAPI.emailReceipt(paymentId);
      else await api.post(`/api/fee/checkouts/${paymentId}/email_receipt/`);
      showToast('success', 'Receipt queued for emailing.');
    } catch (err: any) {
      showToast('error', extractError(err));
    }
  };

  // Group allocations for the drawer
  const groupedAllocations = useMemo(() => groupAllocations(selectedPayment), [selectedPayment]);
  // Same grouping, driving the printable receipt — kept as a separate memo since
  // printPayment and selectedPayment can be different records (row-level direct print).
  const printGroupedAllocations = useMemo(() => groupAllocations(printPayment), [printPayment]);

  const openDrawer = (payment: any) => {
    setSelectedPayment(payment);
    setIsDrawerOpen(true);
  };

  const openPrintView = (payment: any) => setPrintPayment(payment);
  const closePrintView = () => setPrintPayment(null);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pt-3 pb-8 space-y-5 animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Print CSS — only #receipt-print-area survives window.print() */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
          @page { margin: 1.2cm; size: A4 portrait; }
        }
      `}} />

      {/* MODALS */}
      <ConfirmActionModal open={confirmModal.open} title="Confirm Payment" message={`Approve this payment of ₦${Number(confirmModal.item?.total_amount || 0).toLocaleString()}?`} onConfirm={handleApproveSubmit} onCancel={() => setConfirmModal({ open: false, item: null })} loading={actionLoading} />
      <ReasonModal open={declineModal.open} title="Decline Payment" icon={<AlertTriangle className="h-5 w-5" />} actionText="Decline Payment" actionColor="rose" onConfirm={handleDeclineSubmit} onCancel={() => setDeclineModal({ open: false, item: null })} loading={actionLoading} />
      <ReasonModal open={revertModal.open} title="Revert Confirmed Payment" icon={<RotateCcw className="h-5 w-5" />} actionText="Confirm Reversal" actionColor="amber" onConfirm={handleRevertSubmit} onCancel={() => setRevertModal({ open: false, item: null })} loading={actionLoading} />

      {/* ── HEADER CARD ── */}
      <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-indigo-700" />
        <div className="flex items-center gap-3.5 pl-1.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Payments & Receipts</h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Review, confirm, and print records for every incoming payment.</p>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard/staff/fee/payments/new')} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-md shadow-indigo-200 shrink-0">
          <PlusCircle className="h-4 w-4" /> New Payment
        </button>
      </div>

      {/* COMPACT PENDING BANNER */}
      {stats.pending_count > 0 && statusFilter !== 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg"><Clock className="w-5 h-5"/></div>
            <div>
              <p className="text-sm font-bold text-amber-900">{stats.pending_count} Pending Approval{stats.pending_count > 1 ? 's' : ''}</p>
              <p className="text-xs font-medium text-amber-700">Review and confirm payments to update ledgers.</p>
            </div>
          </div>
          <button onClick={() => setStatusFilter('pending')} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm">
            Review Now
          </button>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search reference, payer name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="reverted">Reverted</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-5 py-4">Date & Ref</th>
                <th className="px-5 py-4 min-w-[200px]">Payer Profile</th>
                <th className="px-5 py-4 text-right">Amount</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /><p className="text-xs font-medium">Loading payments...</p></td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-500 font-medium">No payments found.</td></tr>
              ) : (
                payments.map((p) => {
                  const payerName = toTitleCase(p.student_name || p.parent_name);
                  const isPending = p.status === 'pending';
                  const isConfirmed = p.status === 'confirmed';
                  const isExpired = p.status === 'confirmed' ? ((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60) > (settings?.reversal_window_hours ?? 24)) : false;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="font-bold text-slate-800">{p.reference}</p>
                        <p className="text-xs font-medium text-slate-500">{formatDate(p.created_at)}</p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.student_image_url || p.parent_image_url ? (
                            <img src={getImageUrl(p.student_image_url || p.parent_image_url)} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
                              {payerName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-800">{payerName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {p.parent ? 'Family' : 'Student'}
                              </span>
                              {(p.student_class_full || p.student_class) && (
                                <span className="text-[10px] font-bold text-indigo-600">
                                  {p.student_class_full || p.student_class}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(p.total_amount)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button onClick={() => setConfirmModal({ open: true, item: p })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>
                              <button onClick={() => setDeclineModal({ open: true, item: p })} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Decline"><XCircle className="w-4 h-4" /></button>
                            </>
                          )}
                          {isConfirmed && (
                            <button onClick={() => setRevertModal({ open: true, item: p })} disabled={isExpired} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={isExpired ? "Reversal Window Expired" : "Revert Payment"}>
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => openPrintView(p)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Print Receipt">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button onClick={() => openDrawer(p)} className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors shadow-sm" title="View Transaction Drawer">
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
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages} · {totalCount} total</span>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Prev</button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER (Grouped Audit Style) */}
      {isDrawerOpen && selectedPayment && (
        <div onClick={() => setIsDrawerOpen(false)} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="drawer-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Transaction Audit</span>
                <h3 id="drawer-title" className="text-lg font-black truncate">Ref: {selectedPayment.reference}</h3>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Payment Summary */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Settled</p>
                    <p className="text-3xl font-black text-slate-900">{formatCurrency(selectedPayment.total_amount)}</p>
                  </div>
                  <StatusBadge status={selectedPayment.status} />
                </div>
                {selectedPayment.amount_in_words && (
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{selectedPayment.amount_in_words}</p>
                )}
              </div>

              {selectedPayment.reversal_reason && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-black text-rose-800 uppercase tracking-widest flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5 text-rose-600" /> Reversal Reason</span>
                  <p className="text-sm text-rose-950 font-bold">{selectedPayment.reversal_reason}</p>
                </div>
              )}

              {/* Payer Profile — compact single card instead of a name block + separate boxed grid */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3">
                  {selectedPayment.student_image_url || selectedPayment.parent_image_url ? (
                    <img src={getImageUrl(selectedPayment.student_image_url || selectedPayment.parent_image_url)} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg shrink-0">{toTitleCase(selectedPayment.student_name || selectedPayment.parent_name).charAt(0)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-base truncate">{toTitleCase(selectedPayment.student_name || selectedPayment.parent_name)}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="text-[9px] font-black uppercase tracking-wide text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {selectedPayment.parent ? 'Family' : 'Student'}
                      </span>
                      {!selectedPayment.parent && (selectedPayment.student_class_full || selectedPayment.student_class) && (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {selectedPayment.student_class_full || selectedPayment.student_class}
                        </span>
                      )}
                      {(selectedPayment.parent_phone || selectedPayment.student_phone) && (
                        <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {selectedPayment.parent_phone || selectedPayment.student_phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-400 font-medium">Paid via <strong className="text-slate-700 font-bold">{formatPaymentMode(selectedPayment.external_payment_mode)}</strong></span>
                  <span className="text-slate-400 font-medium">Processed by <strong className="text-slate-700 font-bold">{selectedPayment.confirmed_by_full_name || selectedPayment.confirmed_by_name || 'System'}</strong></span>
                </div>
              </div>

              {/* Grouped Allocations */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                  <span>Fees Settled</span>
                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{selectedPayment.allocations?.length || 0} items</span>
                </h4>

                <div className="space-y-4">
                  {Object.entries(groupedAllocations).map(([groupName, items]: [string, any]) => {
                    const subtotal = items.reduce((s: number, i: any) => s + parseFloat(i.amount), 0);
                    // Extract unique invoices paid within this specific student's group
                    const uniqueInvoices = Array.from(new Map(
                      items.filter((i:any) => i.invoice_id).map((i:any) => [i.invoice_id, { id: i.invoice_id, type: i.invoice_type || 'student' }])
                    ).values()) as {id: number, type: string}[];

                    return (
                      <div key={groupName} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                          <span className="text-xs font-black text-slate-700">{groupName}</span>
                          <span className="text-xs font-black text-indigo-600">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="p-3 space-y-2">
                          {items.map((alloc: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-start text-xs">
                              <span className="font-bold text-slate-600 pr-2">{cleanFeeDescription(alloc.fee_name || alloc.description)}</span>
                              <span className="font-black text-slate-800">{formatCurrency(alloc.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {uniqueInvoices.length > 0 && (
                          <div className="bg-indigo-50/50 px-3 py-2 border-t border-indigo-100 flex flex-wrap gap-2">
                            {uniqueInvoices.map(({id, type}) => (
                              <button key={id} onClick={() => { setIsDrawerOpen(false); router.push(`/dashboard/staff/fee/invoices/${id}?type=${type}`); }}
                                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-colors">
                                <ExternalLink className="w-3 h-3"/> View {type === 'family' ? 'Family Invoice' : 'Student Invoice'} #{id}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!selectedPayment.allocations?.length && (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-400 text-center">No allocations recorded.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-2 shrink-0">
              {selectedPayment.status === 'pending' && (
                <>
                  <button disabled={actionLoading} onClick={() => setDeclineModal({ open: true, item: selectedPayment })} className="px-4 py-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Decline</button>
                  <button disabled={actionLoading} onClick={() => setConfirmModal({ open: true, item: selectedPayment })} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Approve Payment</button>
                </>
              )}
              {selectedPayment.status === 'confirmed' && (
                <>
                  {selectedPayment.proof_of_payment && (
                    <a href={getImageUrl(selectedPayment.proof_of_payment)} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
                      <FileText className="w-4 h-4" /> View Proof
                    </a>
                  )}
                  <button onClick={() => openPrintView(selectedPayment)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
                    <Printer className="w-4 h-4" /> Print Receipt
                  </button>
                  <button onClick={() => handleEmailReceipt(selectedPayment.id)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
                    <Mail className="w-4 h-4" /> Email
                  </button>
                  {(() => {
                    const isExpired = isReversalExpired(selectedPayment, settings);
                    return (
                      <button disabled={isExpired} onClick={() => setRevertModal({ open: true, item: selectedPayment })} title={isExpired ? 'Reversal Expired' : 'Revert Payment'} className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-40">
                        <RotateCcw className="w-4 h-4" /> Revert
                      </button>
                    );
                  })()}
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── PRINTABLE RECEIPT — rendered in place, no route change, no extra fetch ── */}
      {printPayment && (
        <div onClick={closePrintView} className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">

            {/* Action bar — hidden on print */}
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={closePrintView} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
                <X className="w-4 h-4" /> Close
              </button>
              <div className="flex items-center gap-2">
                {printPayment.status === 'confirmed' && (
                  <button onClick={() => handleEmailReceipt(printPayment.id)} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                )}
                <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </div>
            </div>

            <div className="p-8 print:p-6">

              {/* Letterhead — logo sits beside the details instead of stacked above them */}
              <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 mb-5">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-14 w-14 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-7 w-7 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-black uppercase tracking-wide text-slate-900 truncate">{schoolInfo?.name || 'School Name Not Set'}</h1>
                  <p className="text-[11px] font-medium text-slate-500 truncate">{schoolInfo?.address || 'Address not configured'}</p>
                  <p className="text-[11px] font-medium text-slate-500">{[schoolInfo?.email, schoolInfo?.mobile_1].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 whitespace-nowrap">
                  Payment Receipt
                </span>
              </div>

              {/* Compact meta strip instead of stacked label/value lines */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">{printPayment.reference}</span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                  printPayment.status === 'reverted' ? 'bg-rose-50 text-rose-700' : printPayment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {printPayment.status_display}
                </span>
                <span className="text-[10px] font-bold text-slate-500">{formatDateShort(printPayment.created_at)} · {formatTime(printPayment.created_at)}</span>
              </div>

              {/* Received From */}
              <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-4 mb-2 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Received From</p>
                  <p className="text-base font-black text-slate-900 truncate">{toTitleCase(printPayment.student_name || printPayment.parent_name)}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <span className="text-[9px] font-bold uppercase text-indigo-600 bg-white px-1.5 py-0.5 rounded">{printPayment.parent ? 'Family' : 'Student'}</span>
                    {!printPayment.parent && (printPayment.student_class_full || printPayment.student_class) && (
                      <span className="text-[9px] font-bold text-slate-500">{printPayment.student_class_full || printPayment.student_class}</span>
                    )}
                    {(printPayment.parent_phone || printPayment.student_phone) && (
                      <span className="text-[9px] font-bold text-slate-400">{printPayment.parent_phone || printPayment.student_phone}</span>
                    )}
                  </div>
                </div>
                <p className="text-2xl font-black text-indigo-700 shrink-0 whitespace-nowrap">{formatCurrency(printPayment.total_amount)}</p>
              </div>
              {printPayment.amount_in_words && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider italic mb-5">{printPayment.amount_in_words}</p>
              )}

              {/* Paid Via */}
              <div className="mb-5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Paid Via</h3>
                <div className="flex flex-wrap gap-2">
                  {printPayment.funding_sources?.map((source: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-bold text-slate-700">{source.source_type === 'external' ? formatPaymentMode(printPayment.external_payment_mode) : 'Wallet Deduction'}</span>
                      <span className="text-xs font-black text-slate-900">{formatCurrency(source.amount)}</span>
                    </div>
                  ))}
                  {!printPayment.funding_sources?.length && (
                    <span className="text-xs font-medium text-slate-400">Not recorded.</span>
                  )}
                </div>
              </div>

              {/* Fees Settled — grouped by student, not repeated per line */}
              <div className="mb-5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fees Settled</h3>
                <div className="space-y-2.5">
                  {Object.entries(printGroupedAllocations).map(([groupName, items]: [string, any]) => {
                    const subtotal = items.reduce((s: number, i: any) => s + parseFloat(i.amount), 0);
                    return (
                      <div key={groupName} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                          <span className="text-[11px] font-black text-slate-700">{groupName}</span>
                          <span className="text-[11px] font-black text-indigo-600">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="px-3 py-2 space-y-1">
                          {items.map((alloc: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-[11px]">
                              <span className="font-semibold text-slate-600">{cleanFeeDescription(alloc.fee_name || alloc.description)}</span>
                              <span className="font-bold text-slate-800">{formatCurrency(alloc.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {!printPayment.allocations?.length && (
                    <p className="text-xs font-medium text-slate-400 text-center py-3">No fee allocations recorded for this payment.</p>
                  )}
                </div>
              </div>

              {printPayment.status === 'reverted' && (
                <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-0.5">Payment Reverted</p>
                  <p className="text-xs font-bold text-rose-900">{printPayment.reversal_reason || 'No reason provided.'}</p>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 mt-8 text-[11px]">
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-700">{printPayment.confirmed_by_full_name || printPayment.confirmed_by_name || 'System'}</p>
                  <p className="text-slate-400 font-medium">Processed By</p>
                </div>
                <div className="text-center border-t border-slate-300 pt-2">
                  <p className="font-bold text-slate-400">&nbsp;</p>
                  <p className="text-slate-400 font-medium">Authorized Signature &amp; Stamp</p>
                </div>
              </div>

              <p className="text-center text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-6">
                This receipt confirms payment received · Contact the office for a full statement of account
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}