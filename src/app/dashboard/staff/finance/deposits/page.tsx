'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import {
  studentFundingAPI,
  staffFundingAPI,
  academicCalendarAPI,
  financeSettingsAPI,
  onlinePaymentAPI,
} from '@/lib/api';
import {
  Users, Search, X, Loader2, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Eye, CheckCircle, XCircle, Clock, ArrowUpCircle,
  Wallet, CreditCard, FileText, RotateCcw, Check, ShieldCheck,
  Calendar, DollarSign, Building2, UserCircle, Download, ExternalLink,
  AlertTriangle, Phone, FilterX,
} from 'lucide-react';
import type { ExportRow } from './DepositsExporter';

const DepositsExporter = dynamic(() => import('./DepositsExporter'), { ssr: false });

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

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str?: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const PAGE_SIZE = 20;

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in slide-in-from-top-2
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2">
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
    pending: { label: 'Pending Approval', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle className="h-3 w-3" /> },
    declined: { label: 'Declined', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <XCircle className="h-3 w-3" /> },
    reverted: { label: 'Reverted', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: <ArrowUpCircle className="h-3 w-3" /> },
    failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <XCircle className="h-3 w-3" /> },
  };
  const meta = map[status?.toLowerCase() || 'pending'] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Custom Modal Dialogs ─────────────────────────────────────────────────────
function ConfirmActionModal({ open, title, message, onConfirm, onCancel, loading }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center">{title}</h3>
        <p className="text-xs text-slate-500 text-center leading-relaxed">{message}</p>
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 text-xs font-semibold border rounded-xl hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

function DeclineReasonModal({ open, onConfirm, onCancel, loading }: any) {
  const [reason, setReason] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
        <div className="flex items-center gap-2 text-red-600 font-bold text-base">
          <AlertTriangle className="h-5 w-5" /> Decline Deposit Submission
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">Please state the exact reason for rejecting this deposit submission so the beneficiary/cashier can be notified.</p>
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Decline Reason <span className="text-red-500">*</span></label>
          <textarea
            rows={3}
            placeholder="e.g. Attached bank slip is blurred or amount mismatch..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-xs font-semibold border rounded-xl hover:bg-slate-50">Cancel</button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={loading || !reason.trim()} className="px-5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm Decline
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Thermal/A4 Receipt Generator (With Close Window Button) ──────────────────
function triggerPrintReceipt(item: any, viewType: 'student' | 'staff', schoolName?: string) {
  const isStudent = viewType === 'student';
  const person = isStudent ? item.student : item.staff;
  const personName = toTitleCase(person?.full_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim());
  const regNo = isStudent ? person?.registration_number : person?.staff_id;
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to print receipts.'); return; }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt - TXN #${item.id}</title>
  <style>
    body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-w: 420px; margin: 0 auto; color: #111; }
    .text-center { text-align: center; }
    .border-b { border-bottom: 1px dashed #444; padding-bottom: 12px; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
    .bold { font-weight: bold; }
    .amount { font-size: 20px; margin: 16px 0; text-align: center; border: 2px solid #111; padding: 10px; font-weight: 800; }
    .status { text-transform: uppercase; font-weight: bold; }
    .no-print { margin-bottom: 20px; text-align: center; }
    .btn { padding: 8px 16px; font-size: 13px; cursor: pointer; border-radius: 6px; border: 1px solid #ccc; background: #f0f0f0; font-weight: bold; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" class="btn" style="background:#059669;color:#fff;border:none;">🖨️ Print Receipt</button>
    <button onclick="window.close()" class="btn" style="margin-left:8px;">❌ Close Window</button>
  </div>
  <div class="text-center border-b">
    <h2 style="margin:0;font-size:16px;">${schoolName || 'SCHOOL MANAGEMENT SYSTEM'}</h2>
    <p style="margin:4px 0 0;font-size:12px;">OFFICIAL TRANSACTION RECEIPT</p>
  </div>
  <div class="row"><span>Reference:</span><span class="bold">${item.reference || `TXN-${item.id}`}</span></div>
  <div class="row"><span>Date:</span><span>${formatDate(item.created_at)}</span></div>
  <div class="row"><span>Status:</span><span class="status bold">${item.status}</span></div>
  <div class="border-b"></div>
  <div class="row"><span>Received From:</span><span class="bold">${personName}</span></div>
  <div class="row"><span>ID Number:</span><span>${regNo || 'N/A'}</span></div>
  ${isStudent ? `<div class="row"><span>Wallet Type:</span><span class="bold uppercase">${item.wallet_type}</span></div>` : ''}
  <div class="row"><span>Payment Method:</span><span class="capitalize">${item.method} (${item.mode})</span></div>
  <div class="amount">${fmtMoney(item.amount)}</div>
  ${item.reverted_at ? `<div class="row" style="color:red;"><span>Reverted On:</span><span>${formatDate(item.reverted_at)}</span></div>` : ''}
  <div class="border-b"></div>
  <div class="text-center" style="font-size:11px;margin-top:16px;">Thank you for your payment.<br/>Printed on ${new Date().toLocaleString()}</div>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Slide-Out Audit Drawer (Click outside to close + Ctrl+P/Esc shortcuts) ────
function AuditDrawer({ item, viewType, onClose, onConfirm, onDecline, onRevert, onVerify, actionLoading, settings, canCheckerAction, schoolName }: any) {
  // Desktop keyboard listener: Esc to close, Ctrl+P to print receipt when drawer is active
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (item.status === 'confirmed' || item.status === 'reverted') {
          triggerPrintReceipt(item, viewType, schoolName);
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, viewType, schoolName, onClose]);

  if (!item) return null;
  const isStudent = viewType === 'student';
  const person = isStudent ? item.student : item.staff;
  const personName = toTitleCase(person?.full_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim());
  const regNo = isStudent ? person?.registration_number : person?.staff_id;

  const windowHours = settings?.reversal_window_hours ?? 24;
  const hoursSinceCreation = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
  const isWindowExpired = windowHours > 0 && hoursSinceCreation > windowHours;

  const recordedBy = item.created_by_name || item.created_by?.full_name || item.created_by?.username || 'System / Parent Portal';

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Transaction Audit</span>
            <h3 className="text-base font-bold truncate max-w-[320px]">Ref: {item.reference || `#${item.id}`}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status & Amount Banner */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Total Amount</p>
              <p className="text-2xl font-black text-slate-900">{fmtMoney(item.amount)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={item.status} />
              {isStudent && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                  {item.wallet_type || 'General'} Wallet
                </span>
              )}
            </div>
          </div>

          {/* Conditional Reason Banners */}
          {item.status?.toLowerCase() === 'declined' && item.decline_reason && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-red-800 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> Rejection / Decline Reason
              </span>
              <p className="text-xs text-red-950 font-medium leading-relaxed">{item.decline_reason}</p>
            </div>
          )}

          {item.status?.toLowerCase() === 'reverted' && (item.refund_reason || item.decline_reason) && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5 text-amber-600" /> Ledger Reversal Reason
              </span>
              <p className="text-xs text-amber-950 font-medium leading-relaxed">{item.refund_reason || item.decline_reason}</p>
            </div>
          )}

          {/* Elevated Proof of Payment Document */}
          {item.proof_of_payment ? (
            <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" /> Attached Proof of Payment
                </span>
                <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">Verified Upload</span>
              </div>
              <a href={item.proof_of_payment} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors shadow-2xs">
                <span className="text-xs font-bold truncate max-w-[280px]">Open Document / Bank Slip</span>
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
              </a>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400 italic flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-300" /> No physical proof of payment attached to this record.
            </div>
          )}

          {/* Profile Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Beneficiary Profile Breakdown</h4>
            <div className="p-4 rounded-2xl border border-slate-100 bg-white space-y-3 shadow-2xs">
              <div className="flex items-center gap-3.5 border-b border-slate-100 pb-3">
                {person?.image_url ? (
                  <img src={person.image_url} alt={personName} className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                    {personName.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-base truncate">{personName}</p>
                  <p className="text-xs font-mono text-slate-500">{regNo || 'No ID assigned'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {isStudent ? (
                  <>
                    <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-400 block">Class / Section:</span><strong className="text-slate-700">{person?.current_class_name || '—'} ({person?.current_class_section_name || '—'})</strong></div>
                    <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-400 block">Gender:</span><strong className="text-slate-700 capitalize">{person?.gender || '—'}</strong></div>
                    <div className="p-2 bg-slate-50 rounded-lg col-span-2"><span className="text-slate-400 block">Parent Guardian:</span><strong className="text-slate-700">{person?.parent_name || '—'} ({person?.parent_email || 'No email'})</strong></div>
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-400 block">Department:</span><strong className="text-slate-700">{person?.department_name || '—'}</strong></div>
                    <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-400 block">Position:</span><strong className="text-slate-700">{person?.position_name || '—'}</strong></div>
                    <div className="p-2 bg-slate-50 rounded-lg col-span-2 flex items-center justify-between">
                      <div><span className="text-slate-400 block">Phone Contact:</span><strong className="text-slate-700">{person?.phone || person?.mobile || 'No phone recorded'}</strong></div>
                      {(person?.phone || person?.mobile) && <Phone className="h-3.5 w-3.5 text-slate-400" />}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Ledger Trail */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ledger & Payment Trail</h4>
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm bg-white">
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Full Reference</span><span className="font-mono font-bold text-slate-800">{item.reference || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Channel Mode</span><span className="font-semibold capitalize text-slate-800">{item.mode}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Method</span><span className="font-semibold capitalize text-slate-800">{item.method}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Teller Number</span><span className="font-mono font-medium text-slate-800">{item.teller_number || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Recorded By</span><span className="font-medium text-slate-800">{recordedBy}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Created On</span><span className="text-slate-800">{formatDate(item.created_at)}</span></div>
              {item.reverted_at && (
                <div className="p-3.5 flex justify-between bg-red-50/60 text-red-900"><span className="font-semibold">Reverted On</span><span className="font-mono">{formatDate(item.reverted_at)}</span></div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2 justify-end flex-shrink-0">
          {(item.status === 'confirmed' || item.status === 'reverted') && (
            <button onClick={() => triggerPrintReceipt(item, viewType, schoolName)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs">
              <FileText className="h-3.5 w-3.5 text-emerald-600" /> Print Receipt
            </button>
          )}

          {item.status === 'pending' && item.mode === 'online' && (
            item.reference ? (
              <button onClick={() => onVerify(item)} disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 flex items-center gap-1.5 shadow-sm">
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Live Gateway Verify
              </button>
            ) : (
              <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-medium">⚠️ Unreferenced legacy online record</span>
            )
          )}

          {item.status === 'pending' && item.mode !== 'online' && canCheckerAction && (
            <>
              <button onClick={() => onDecline(item)} disabled={actionLoading} className="px-4 py-2 bg-red-50 text-red-700 font-bold text-xs rounded-xl hover:bg-red-100 border border-red-200">
                Decline
              </button>
              <button onClick={() => onConfirm(item)} disabled={actionLoading} className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm">
                <Check className="h-3.5 w-3.5" /> Confirm & Credit
              </button>
            </>
          )}

          {item.status === 'confirmed' && item.mode !== 'online' && canCheckerAction && (
            <button
              onClick={() => onRevert(item)}
              disabled={actionLoading || isWindowExpired}
              title={isWindowExpired ? `Reversal grace period (${windowHours}h) expired` : 'Revert transaction'}
              className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {isWindowExpired ? 'Reversal Expired' : 'Revert Deposit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Consolidated Page ────────────────────────────────────────────────────
export default function ConsolidatedDepositsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user, schoolInfo } = useAuth();

  const initialFilter = searchParams.get('filter') === 'staff' ? 'staff' : 'student';
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const canViewStudent = user?.is_superuser || hasPermission('finance.view_studentfundingmodel');
  const canViewStaff   = user?.is_superuser || hasPermission('finance.view_stafffundingmodel');
  const canCheckerAction = user?.is_superuser || hasPermission('finance.confirm_funding') || hasPermission('finance.change_studentfundingmodel');

  // State
  const [viewType, setViewType]           = useState<'student' | 'staff'>(initialFilter);
  const [statusFilter, setStatusFilter]   = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [sessionId, setSessionId]         = useState('');
  const [periodId, setPeriodId]           = useState('');
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');
  const [walletTypeFilter, setWalletTypeFilter] = useState('');

  const [data, setData]                   = useState<any[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [pageError, setPageError]         = useState<string | null>(null);

  // References
  const [sessionPeriods, setSessionPeriods] = useState<any[]>([]);
  const [sessions, setSessions]             = useState<any[]>([]);
  const [settings, setSettings]             = useState<any>(null);

  // Drawer & Modals
  const [selectedItem, setSelectedItem]     = useState<any | null>(null);
  const [actionLoading, setActionLoading]   = useState(false);
  const [confirmModal, setConfirmModal]     = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [declineModal, setDeclineModal]     = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [revertModal, setRevertModal]       = useState<{ open: boolean; item: any; reason: string }>({ open: false, item: null, reason: '' });

  const [toasts, setToasts]                 = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const hasActiveFilters = Boolean(statusFilter || searchQuery.trim() || sessionId || periodId || startDate || endDate || walletTypeFilter);

  const clearAllFilters = () => {
    setStatusFilter('');
    setSearchQuery('');
    setSessionId('');
    setPeriodId('');
    setStartDate('');
    setEndDate('');
    setWalletTypeFilter('');
  };

  // Load reference data
  useEffect(() => {
    Promise.all([
      academicCalendarAPI.listSessions().catch(() => []),
      academicCalendarAPI.listSessionPeriods().catch(() => []),
      financeSettingsAPI.get().catch(() => ({})),
    ]).then(([sessData, spData, settingsData]) => {
      setSessions(Array.isArray(sessData) ? sessData : (sessData as any)?.results ?? []);
      setSessionPeriods(Array.isArray(spData) ? spData : (spData as any)?.results ?? []);
      setSettings(settingsData);
    });
  }, []);

  const availablePeriods = useMemo(() => {
    if (!sessionId) return [];
    return sessionPeriods
      .filter((sp: any) => String(sp.session?.id) === String(sessionId))
      .map((sp: any) => sp.period)
      .filter(Boolean);
  }, [sessionId, sessionPeriods]);

  // Build Query Params
  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (statusFilter)                         params.status              = statusFilter;
    if (searchQuery.trim())                   params.search              = searchQuery.trim();
    if (sessionId)                            params.session_id          = sessionId;
    if (periodId)                             params.academic_period_id  = periodId;
    if (startDate)                            params.start_date          = startDate;
    if (endDate)                              params.end_date            = endDate;
    if (viewType === 'student' && walletTypeFilter) params.wallet_type   = walletTypeFilter;
    return params;
  }, [page, statusFilter, searchQuery, sessionId, periodId, startDate, endDate, walletTypeFilter, viewType]);

  // Fetch List
  const fetchData = useCallback(async () => {
    if (!canViewStudent && !canViewStaff) return;
    setLoading(true); setPageError(null);
    try {
      const api = viewType === 'student' ? studentFundingAPI : staffFundingAPI;
      const response = await api.list(buildParams());
      const results = Array.isArray(response) ? response : (response as any)?.results ?? (response as any)?.data ?? [];
      const totalCount = typeof (response as any)?.count === 'number' ? (response as any).count : results.length;
      setData(results);
      setTotal(totalCount);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [viewType, buildParams, canViewStudent, canViewStaff]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQuery, sessionId, periodId, startDate, endDate, walletTypeFilter, viewType]);

  // ── Auto-Open Audit Drawer ONCE on landing & clean URL ──
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    const targetId = searchParams.get('open_audit');
    if (!targetId || autoOpenedRef.current) return;

    const numId = Number(targetId);
    autoOpenedRef.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('open_audit');
    const newQuery = params.toString();
    const cleanUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
    router.replace(cleanUrl, { scroll: false });

    const existing = data.find((d: any) => d.id === numId);
    if (existing) {
      setSelectedItem(existing);
    } else {
      const api = viewType === 'student' ? studentFundingAPI : staffFundingAPI;
      api.get(numId).then((res: any) => {
        if (res) setSelectedItem(res);
      }).catch(() => {});
    }
  }, [searchParams, data, viewType, router]);

  // Action Handlers
  const handleConfirmSubmit = async () => {
    if (!confirmModal.item) return;
    setActionLoading(true);
    try {
      const api = viewType === 'student' ? studentFundingAPI : staffFundingAPI;
      await api.confirm(confirmModal.item.id);
      showToast('success', 'Deposit confirmed and wallet credited!');
      setConfirmModal({ open: false, item: null });
      setSelectedItem(null);
      fetchData();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(false); }
  };

  const handleDeclineSubmit = async (reason: string) => {
    if (!declineModal.item) return;
    setActionLoading(true);
    try {
      const api = viewType === 'student' ? studentFundingAPI : staffFundingAPI;
      await api.decline(declineModal.item.id, { reason });
      showToast('success', 'Deposit declined successfully.');
      setDeclineModal({ open: false, item: null });
      setSelectedItem(null);
      fetchData();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(false); }
  };

  const handleVerifyLive = async (item: any) => {
    if (!item.reference) { showToast('error', 'Legacy unreferenced record: Cannot verify live via Paystack/Flutterwave.'); return; }
    setActionLoading(true);
    try {
      await onlinePaymentAPI.verifyLive(item.reference);
      showToast('success', 'Online payment verified live from gateway and reconciled!');
      setSelectedItem(null);
      fetchData();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(false); }
  };

  const handleRevertSubmit = async () => {
    if (!revertModal.reason.trim()) { showToast('error', 'Reversal reason is required.'); return; }
    setActionLoading(true);
    try {
      const api = viewType === 'student' ? studentFundingAPI : staffFundingAPI;
      await api.revert(revertModal.item.id, { reason: revertModal.reason.trim() });
      showToast('success', 'Deposit successfully reverted from wallet and bank ledger.');
      setRevertModal({ open: false, item: null, reason: '' });
      setSelectedItem(null);
      fetchData();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(false); }
  };

  const getExportRows = useCallback(async (): Promise<ExportRow[]> => {
    const api = viewType === 'student' ? studentFundingAPI : staffFundingAPI;
    const params: any = { ...buildParams(), page_size: 2000 }; delete params.page;
    const response = await api.list(params);
    const results = Array.isArray(response) ? response : (response as any)?.results ?? [];
    return results.map((item: any) => {
      const person = viewType === 'student' ? item.student : item.staff;
      const personName = toTitleCase(person?.full_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim());
      return {
        id: item.id, personName,
        personId: viewType === 'student' ? (person?.registration_number || '—') : (person?.staff_id || '—'),
        walletType: item.wallet_type, amount: item.amount, method: item.method,
        status: item.status, created: formatDate(item.created_at), reference: item.reference,
      };
    });
  }, [viewType, buildParams]);

  if (!canViewStudent && !canViewStaff) {
    return <div className="p-16 text-center font-bold text-red-600">Access Denied: Missing finance permissions.</div>;
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Slide-out Drawer */}
      <AuditDrawer
        item={selectedItem} viewType={viewType} onClose={() => setSelectedItem(null)}
        onConfirm={(item: any) => setConfirmModal({ open: true, item })}
        onDecline={(item: any) => setDeclineModal({ open: true, item })}
        onVerify={handleVerifyLive}
        onRevert={(item: any) => setRevertModal({ open: true, item, reason: '' })}
        actionLoading={actionLoading} settings={settings} canCheckerAction={canCheckerAction} schoolName={schoolInfo?.name}
      />

      {/* Modals */}
      <ConfirmActionModal
        open={confirmModal.open}
        title="Confirm Deposit & Credit Wallet"
        message={`Are you sure you want to verify and credit ₦${Number(confirmModal.item?.amount || 0).toLocaleString()} to the beneficiary's wallet?`}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmModal({ open: false, item: null })}
        loading={actionLoading}
      />
      <DeclineReasonModal
        open={declineModal.open}
        onConfirm={handleDeclineSubmit}
        onCancel={() => setDeclineModal({ open: false, item: null })}
        loading={actionLoading}
      />
      {revertModal.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><RotateCcw className="h-5 w-5 text-red-600" /> Revert Confirmed Deposit</h3>
            <p className="text-xs text-slate-500 leading-relaxed">This will atomically deduct ₦{Number(revertModal.item?.amount || 0).toLocaleString()} from the virtual wallet and create a debit row in the physical cash box/bank ledger.</p>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Reversal Reason <span className="text-red-500">*</span></label>
              <textarea
                rows={3}
                placeholder="State exact reason for mistake or cash pull-back..."
                value={revertModal.reason}
                onChange={(e) => setRevertModal(s => ({ ...s, reason: e.target.value }))}
                className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRevertModal({ open: false, item: null, reason: '' })} className="px-4 py-2 text-xs font-semibold border rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={handleRevertSubmit} disabled={actionLoading} className="px-5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            Master Deposits Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Audit, confirm, verify, and reconcile school wallet top-ups</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/dashboard/staff/finance/deposit')} className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-200 hover:from-emerald-700 transition-all flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> New POS Deposit
          </button>
          <DepositsExporter viewType={viewType} schoolName={schoolInfo?.name} getExportRows={getExportRows} />
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {(['student', 'staff'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setViewType(t); setPage(1); setSelectedItem(null); }}
            className={`px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all ${viewType === t ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Users className="h-4 w-4 inline mr-1.5" /> {t} Fundings
          </button>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search beneficiary name, ID, or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
            <option value="">All Statuses</option>
            <option value="pending">Pending Approval</option>
            <option value="confirmed">Confirmed</option>
            <option value="declined">Declined</option>
            <option value="reverted">Reverted</option>
          </select>

          <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setPeriodId(''); }} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
            <option value="">All Sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
          </select>

          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={!sessionId || availablePeriods.length === 0} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium disabled:bg-slate-50 disabled:text-slate-400">
            <option value="">All Periods</option>
            {availablePeriods.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {viewType === 'student' && (
            <select value={walletTypeFilter} onChange={(e) => setWalletTypeFilter(e.target.value)} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
              <option value="">All Wallets</option>
              <option value="canteen">Canteen Wallet</option>
              <option value="fee">Fee Wallet</option>
            </select>
          )}

          {/* Locked Date Pickers */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              max={todayStr}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
            <span className="text-slate-300 text-xs font-bold">—</span>
            <input
              type="date"
              max={todayStr}
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                title="Clear all active filters"
                className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <FilterX className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
            <button onClick={fetchData} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} /></button>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-xs text-slate-400 font-medium">Loading deposit records...</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center text-red-600 font-medium">{pageError}</div>
        ) : data.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Wallet className="h-10 w-10 text-slate-200 mx-auto" />
            <h3 className="font-bold text-slate-700">No deposits found</h3>
            <p className="text-xs text-slate-400">Try clearing active filters or record a new POS deposit.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3.5 min-w-[240px]">Beneficiary Details</th>
                  {viewType === 'student' && <th className="px-4 py-3.5">Wallet</th>}
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Channel</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  const person = viewType === 'student' ? item.student : item.staff;
                  const personName = toTitleCase(person?.full_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim());
                  const regNo = viewType === 'student' ? person?.registration_number : person?.staff_id;

                  const windowHours = settings?.reversal_window_hours ?? 24;
                  const hoursOld = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
                  const isExpired = windowHours > 0 && hoursOld > windowHours;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 min-w-[240px]">
                        <p className="font-bold text-slate-800">{personName}</p>
                        <p className="text-[11px] font-mono text-slate-400">{regNo || '—'}</p>
                      </td>
                      {viewType === 'student' && (
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">{item.wallet_type}</span>
                        </td>
                      )}
                      <td className="px-4 py-3 font-black text-slate-900">{fmtMoney(item.amount)}</td>
                      <td className="px-4 py-3 capitalize text-slate-600 font-medium">
                        {item.method} <span className="text-xs text-slate-400">({item.mode})</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {(item.status === 'confirmed' || item.status === 'reverted') && (
                            <button onClick={() => triggerPrintReceipt(item, viewType, schoolInfo?.name)} title="Print Receipt" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          {item.status === 'pending' && item.mode === 'online' && item.reference && (
                            <button onClick={() => handleVerifyLive(item)} title="Verify Live Gateway" className="px-2 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg hover:bg-blue-100 flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5" /> Verify
                            </button>
                          )}
                          {item.status === 'pending' && item.mode !== 'online' && canCheckerAction && (
                            <>
                              <button onClick={() => setConfirmModal({ open: true, item })} title="Confirm & Credit" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={() => setDeclineModal({ open: true, item })} title="Decline Deposit" className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {item.status === 'confirmed' && item.mode !== 'online' && canCheckerAction && (
                            <button
                              onClick={() => setRevertModal({ open: true, item, reason: '' })}
                              disabled={isExpired}
                              title={isExpired ? `Grace period (${windowHours}h) expired` : 'Revert deposit'}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setSelectedItem(item)} title="Open Audit Drawer" className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Page {page} of {Math.ceil(total / PAGE_SIZE) || 1} ({total} records)</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total} className="p-1.5 border rounded-lg bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}