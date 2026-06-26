'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  staffFundingAPI,
  staffAPI,
} from '@/lib/api';
import { StaffFunding } from '@/lib/types';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpCircle,
  Wallet,
  User,
  Calendar,
  FileText,
  Printer,
  RefreshCw,
  Check,
  X,
  Undo,
  Building2,
  Briefcase,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.details && typeof d.details === 'object') {
      const msgs = Object.entries(d.details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? (v as any[])[0] : String(v)}`)
        .join(' ');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Print Receipt (no jspdf — pure HTML print window) ────────────────────────
function buildReceiptHTML(
  funding: StaffFunding,
  staff: any,
  schoolName: string,
): string {
  const staffName = staff
    ? toTitleCase(staff.full_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim())
    : '—';

  const statusColors: Record<string, string> = {
    confirmed: '#059669', pending: '#d97706',
    declined: '#dc2626', failed: '#dc2626', reverted: '#64748b',
  };
  const statusColor = statusColors[funding.status] ?? '#64748b';
  const now = new Date().toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short' });

  const rows = [
    ['Staff Member',    staffName],
    ['Staff ID',        staff?.staff_id        || '—'],
    ['Department',      staff?.department_name || '—'],
    ['Position',        staff?.position_name   || '—'],
    ['Payment Method',  (funding.method || '—').charAt(0).toUpperCase() + (funding.method || '').slice(1)],
    ['Mode',            (funding.mode   || '—').charAt(0).toUpperCase() + (funding.mode   || '').slice(1)],
    ['Reference',       funding.reference     || '—'],
    ['Teller Number',   funding.teller_number || '—'],
    ['Date',            formatDateShort(funding.created_at)],
    ...(funding.decline_reason ? [['Decline Reason', funding.decline_reason]] : []),
    ...(funding.refund_reason  ? [['Revert Reason',  funding.refund_reason]]  : []),
  ];

  const tableRows = rows.map(([label, value], i) =>
    `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
      <td style="padding:7px 12px;color:#64748b;font-weight:600;width:42%">${label}</td>
      <td style="padding:7px 12px;color:#1e293b">${value}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Staff Funding Receipt #${funding.id}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #1e293b;
      background: #fff;
      padding: 30px;
      max-width: 600px;
      margin: 0 auto;
    }
    .header { text-align: center; margin-bottom: 24px; }
    .school-name {
      font-size: 20px; font-weight: 800; color: #059669;
      letter-spacing: -0.3px; margin-bottom: 4px;
    }
    .receipt-title {
      font-size: 13px; font-weight: 700; color: #475569;
      text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;
    }
    .amount-box {
      background: linear-gradient(135deg, #059669, #0d9488);
      color: white; border-radius: 12px; padding: 16px 24px;
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
    }
    .amount-label { font-size: 11px; opacity: 0.85; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .amount-value { font-size: 26px; font-weight: 800; }
    .receipt-no   { font-size: 11px; opacity: 0.85; }
    .status-box {
      display: inline-block; padding: 4px 14px; border-radius: 999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .5px; color: ${statusColor};
      border: 1.5px solid ${statusColor}; background: ${statusColor}18;
    }
    table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden;
            border: 1px solid #e2e8f0; margin-top: 16px; }
    td { font-size: 11.5px; }
    .divider { border: none; border-top: 1px dashed #cbd5e1; margin: 20px 0; }
    .footer { text-align: center; color: #94a3b8; font-size: 10px; margin-top: 24px; }
    .footer strong { color: #64748b; }
    @media print {
      body { padding: 15px; }
      @page { margin: 15mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="school-name">${schoolName}</div>
    <div class="receipt-title">Staff Wallet Funding Receipt</div>
  </div>

  <div class="amount-box">
    <div>
      <div class="amount-label">Amount Deposited</div>
      <div class="amount-value">${fmtMoney(funding.amount)}</div>
    </div>
    <div style="text-align:right">
      <div class="receipt-no">Receipt #${funding.id}</div>
      <div style="margin-top:6px">
        <span class="status-box">${funding.status}</span>
      </div>
    </div>
  </div>

  <table>
    <tbody>${tableRows}</tbody>
  </table>

  <hr class="divider"/>
  <div class="footer">
    <p><strong>Generated:</strong> ${now}</p>
    <p style="margin-top:4px">This is a computer-generated receipt. No signature required.</p>
    <p style="margin-top:4px">${schoolName}</p>
  </div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${
          t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          {t.type === 'success'
            ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    pending:   { label: 'Pending',   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle className="h-3 w-3" /> },
    declined:  { label: 'Declined',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     icon: <XCircle className="h-3 w-3" /> },
    reverted:  { label: 'Reverted',  color: 'text-slate-600',   bg: 'bg-slate-100',  border: 'border-slate-200',   icon: <ArrowUpCircle className="h-3 w-3" /> },
    failed:    { label: 'Failed',    color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     icon: <XCircle className="h-3 w-3" /> },
  };
  const meta = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="h-3.5 w-3.5 text-slate-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-slate-800 break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────
function ActionButton({ onClick, loading, variant, children }: {
  onClick: () => void; loading?: boolean;
  variant: 'confirm' | 'decline' | 'revert'; children: React.ReactNode;
}) {
  const styles = {
    confirm: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200',
    decline: 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200',
    revert:  'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200',
  };
  return (
    <button onClick={onClick} disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all disabled:opacity-50 w-full justify-center ${styles[variant]}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StaffFundingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { hasPermission, user, schoolInfo } = useAuth();

  const [funding, setFunding]   = useState<StaffFunding | null>(null);
  const [staff, setStaff]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [toasts, setToasts]     = useState<ToastItem[]>([]);

  const [actionLoading, setActionLoading]       = useState<'confirm' | 'decline' | 'revert' | null>(null);
  const [declineReason, setDeclineReason]       = useState('');
  const [revertReason, setRevertReason]         = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showRevertModal, setShowRevertModal]   = useState(false);

  // ✅ Fixed: use staff permissions, not student ones
  const canConfirm = user?.is_superuser || hasPermission('finance.change_stafffundingmodel');
  const canView    = user?.is_superuser || hasPermission('finance.view_stafffundingmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const tid = ++_toastId;
    setToasts(prev => [...prev, { id: tid, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4500);
  };
  const dismissToast = (tid: number) => setToasts(prev => prev.filter(t => t.id !== tid));

  // ─── Fetch ──
  const fetchFunding = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const data = await staffFundingAPI.get(id);
      setFunding(data);
      if (data.staff) {
        try {
          const s = await staffAPI.get(data.staff);
          setStaff(s);
        } catch { /* silent */ }
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id, canView]);

  useEffect(() => { fetchFunding(); }, [fetchFunding]);

  // ─── Actions ──
  const handleConfirm = async () => {
    if (!funding) return;
    setActionLoading('confirm');
    try {
      await staffFundingAPI.action(id, { action: 'confirm' });
      showToast('success', 'Funding confirmed and wallet updated.');
      fetchFunding();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(null); }
  };

  const handleDecline = async () => {
    if (!funding || !declineReason.trim()) return;
    setActionLoading('decline');
    try {
      await staffFundingAPI.action(id, { action: 'decline', reason: declineReason });
      showToast('success', 'Funding declined.');
      setShowDeclineModal(false); setDeclineReason('');
      fetchFunding();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(null); }
  };

  const handleRevert = async () => {
    if (!funding || !revertReason.trim()) return;
    setActionLoading('revert');
    try {
      await staffFundingAPI.action(id, { action: 'revert', reason: revertReason });
      showToast('success', 'Funding reverted and wallet deducted.');
      setShowRevertModal(false); setRevertReason('');
      fetchFunding();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(null); }
  };

  // ─── Print Receipt — no jspdf, pure HTML print window ──
  const handlePrintReceipt = () => {
    if (!funding) return;
    const html = buildReceiptHTML(funding, staff, schoolInfo?.name || 'School');
    const win  = window.open('', '_blank');
    if (!win) {
      showToast('error', 'Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  // ─── Guards ──
  if (!canView) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to view this funding.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm text-slate-400">Loading funding details…</p>
      </div>
    );
  }

  if (!funding) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-amber-500" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Funding Not Found</p>
          <p className="text-sm text-slate-400">This funding record doesn't exist.</p>
        </div>
      </div>
    );
  }

  const status   = funding.status;
  const staffName = staff
    ? toTitleCase(staff.full_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim())
    : '—';

  return (
    <div className="pb-10 max-w-4xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ─── Decline Modal ── */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Decline Funding</h3>
              <button onClick={() => setShowDeclineModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Please provide a reason for declining this funding.</p>
              <textarea
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="Enter reason for declining..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none h-24"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => setShowDeclineModal(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={handleDecline}
                disabled={!declineReason.trim() || actionLoading === 'decline'}
                className="px-5 py-2 text-sm bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {actionLoading === 'decline' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Revert Modal ── */}
      {showRevertModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Revert Funding</h3>
              <button onClick={() => setShowRevertModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">This will deduct the amount from the staff wallet. Please provide a reason.</p>
              <textarea
                value={revertReason}
                onChange={e => setRevertReason(e.target.value)}
                placeholder="Enter reason for reverting..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none h-24"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => setShowRevertModal(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={handleRevert}
                disabled={!revertReason.trim() || actionLoading === 'revert'}
                className="px-5 py-2 text-sm bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">
                {actionLoading === 'revert' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo className="h-4 w-4" />}
                Revert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Page Header ── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/staff/finance/deposits?filter=staff')}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              Staff Funding
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">Funding #{funding.id}</p>
          </div>
        </div>
        <button
          onClick={handlePrintReceipt}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
        >
          <Printer className="h-4 w-4" /> Print Receipt
        </button>
      </div>

      {/* ─── Error Banner ── */}
      {error && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium flex-1">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Main Info ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Status / Amount hero */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</p>
                <StatusBadge status={status} />
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</p>
                <p className="text-2xl font-bold text-slate-900">{fmtMoney(funding.amount)}</p>
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">Funding Details</h3>
            </div>
            <div className="p-6 divide-y divide-slate-50">
              <InfoRow label="Staff Member"   value={staffName}                        icon={User} />
              <InfoRow label="Staff ID"       value={staff?.staff_id || '—'}           icon={User} />
              <InfoRow label="Department"     value={staff?.department_name || '—'}    icon={Building2} />
              <InfoRow label="Position"       value={staff?.position_name || '—'}      icon={Briefcase} />
              <InfoRow label="Amount"         value={<span className="font-bold text-slate-900">{fmtMoney(funding.amount)}</span>} icon={Wallet} />
              <InfoRow label="Payment Method" value={funding.method ? <span className="capitalize">{funding.method}</span> : '—'} />
              <InfoRow label="Mode"           value={funding.mode   ? <span className="capitalize">{funding.mode}</span>   : '—'} />
              <InfoRow label="Reference"      value={funding.reference     || '—'} />
              <InfoRow label="Teller Number"  value={funding.teller_number || '—'} />
              {funding.decline_reason && <InfoRow label="Decline Reason" value={funding.decline_reason} />}
              {funding.refund_reason  && <InfoRow label="Revert Reason"  value={funding.refund_reason}  />}
              <InfoRow label="Created At"     value={formatDate(funding.created_at)} icon={Calendar} />
            </div>
          </div>
        </div>

        {/* ─── Right Panel ── */}
        <div className="space-y-5">

          {/* Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50">
              <h3 className="text-sm font-bold text-slate-800">Actions</h3>
            </div>
            <div className="p-6 space-y-3">
              {status === 'pending' && canConfirm && (
                <>
                  <ActionButton variant="confirm" onClick={handleConfirm} loading={actionLoading === 'confirm'}>
                    <Check className="h-4 w-4" /> Confirm Funding
                  </ActionButton>
                  <ActionButton variant="decline" onClick={() => setShowDeclineModal(true)} loading={actionLoading === 'decline'}>
                    <X className="h-4 w-4" /> Decline Funding
                  </ActionButton>
                </>
              )}

              {status === 'confirmed' && canConfirm && (
                <ActionButton variant="revert" onClick={() => setShowRevertModal(true)} loading={actionLoading === 'revert'}>
                  <Undo className="h-4 w-4" /> Revert Funding
                </ActionButton>
              )}

              {(status === 'declined' || status === 'reverted' || status === 'failed') && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <p className="text-sm text-slate-500 font-medium capitalize">
                    This funding has been {status}.
                  </p>
                  {status === 'declined' && funding.decline_reason && (
                    <p className="text-xs text-slate-400 mt-1">Reason: {funding.decline_reason}</p>
                  )}
                  {status === 'reverted' && funding.refund_reason && (
                    <p className="text-xs text-slate-400 mt-1">Reason: {funding.refund_reason}</p>
                  )}
                </div>
              )}

              {!canConfirm && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
                  <p className="text-sm text-amber-700 font-medium">View Only</p>
                  <p className="text-xs text-amber-500 mt-1">You don't have permission to modify this funding.</p>
                </div>
              )}
            </div>
          </div>

          {/* Staff Quick Info */}
          {staff && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-50">
                <h3 className="text-sm font-bold text-slate-800">Staff Info</h3>
              </div>
              <div className="p-6 space-y-2.5">
                {[
                  ['Name',       staffName],
                  ['Staff ID',   staff.staff_id        || '—'],
                  ['Department', staff.department_name || '—'],
                  ['Gender',     staff.gender          || '—'],
                  ['Status',     staff.status          || '—'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-800 capitalize">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={fetchFunding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
