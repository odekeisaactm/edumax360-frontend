'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { walletTransferAPI, financeSettingsAPI, studentsAPI } from '@/lib/api';
import {
  Search, X, Loader2, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Eye, CheckCircle, XCircle, Clock, ArrowUpCircle,
  FileText, RotateCcw, Check, ArrowRightLeft, DollarSign,
  FilterX, User, Wallet, ArrowRight, UserCircle, ShieldCheck,
} from 'lucide-react';
import type { TransferExportRow } from './TransfersExporter';

const TransfersExporter = dynamic(() => import('./TransfersExporter'), { ssr: false });

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
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount || 0);
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

// Helper to reliably extract numeric ID from DRF fields
function getStudentId(rawField: any, detailObj: any): number | null {
  if (typeof rawField === 'number' && !isNaN(rawField)) return rawField;
  if (typeof rawField === 'string' && !isNaN(Number(rawField))) return Number(rawField);
  if (typeof rawField === 'object' && rawField !== null && rawField.id) return Number(rawField.id);
  if (detailObj && detailObj.id) return Number(detailObj.id);
  return null;
}

// Merge a "live" student fetch with the transfer's embedded snapshot
// (`*_student_detail`). The list endpoint that powers the transfers table
// already returns complete, correct balances embedded on each transfer
// record. The per-student GET used here to refresh the profile can succeed
// while using a lighter serializer that omits/renames the wallet balance
// fields — in that case the object is still truthy, so a plain `||`
// fallback never kicks in and the balances silently render as 0. This merge
// takes the live object for everything, but falls back per-field to the
// embedded snapshot specifically for the balance fields whenever the live
// object doesn't actually have that field.
function mergeStudentProfile(live: any, fallback: any): any {
  if (!live) return fallback || null;
  if (!fallback) return live;

  const merged = { ...fallback, ...live };
  const balanceFields = ['canteen_balance', 'fee_balance', 'canteen_wallet', 'fee_wallet'];
  for (const field of balanceFields) {
    if (live[field] === undefined || live[field] === null) {
      merged[field] = fallback[field];
    }
  }
  return merged;
}

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
  const meta = map[status?.toLowerCase() || 'confirmed'] ?? map.confirmed;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Thermal/A4 Receipt Generator (Safe against alert blocks) ─────────────────
function triggerPrintReceipt(item: any, schoolName?: string, onError?: (msg: string) => void) {
  const srcName = toTitleCase(item.source_student_detail?.full_name || item.source_student_name || `ID #${item.source_student}`);
  const destName = toTitleCase(item.destination_student_detail?.full_name || item.destination_student_name || `ID #${item.destination_student}`);

  const win = window.open('', '_blank');
  if (!win) {
    if (onError) onError('Pop-up blocked. Please allow pop-ups for this site to print thermal slips.');
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt - Transfer #${item.id}</title>
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
    <p style="margin:4px 0 0;font-size:12px;">INTERNAL REALLOCATION VOUCHER</p>
  </div>
  <div class="row"><span>Reference:</span><span class="bold">${item.reference || `TRF-${item.id}`}</span></div>
  <div class="row"><span>Date:</span><span>${formatDate(item.created_at)}</span></div>
  <div class="row"><span>Category:</span><span class="bold">${toTitleCase(item.transfer_type_display || item.transfer_type)}</span></div>
  <div class="row"><span>Status:</span><span class="status bold">${item.status}</span></div>
  <div class="row"><span>Processed By:</span><span class="bold">${item.created_by_name || '—'}</span></div>
  <div class="border-b"></div>
  <div class="row"><span>Sender:</span><span class="bold">${srcName}</span></div>
  <div class="row"><span>From Wallet:</span><span class="bold uppercase">${item.source_wallet_type}</span></div>
  <div class="row"><span>Receiver:</span><span class="bold">${destName}</span></div>
  <div class="row"><span>To Wallet:</span><span class="bold uppercase">${item.destination_wallet_type}</span></div>
  <div class="amount">${fmtMoney(item.amount)}</div>
  <div class="border-b"></div>
  <div style="font-size:12px;margin-bottom:12px;"><strong>Narration:</strong><br/>${item.reason || 'No narration provided.'}</div>
  <div class="text-center" style="font-size:11px;margin-top:16px;">Verified internal shift.<br/>Printed on ${new Date().toLocaleString()}</div>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Student Profile Display Card for Drawer ──────────────────────────────────
function StudentProfileCard({ profile, fallbackName, fallbackId, label, roleWallet }: any) {
  const fullName = toTitleCase(profile?.full_name || fallbackName || 'Student Profile');
  const regNo = profile?.registration_number || fallbackId || '—';
  const classLabel = [profile?.current_class_name, profile?.current_class_section_name].filter(Boolean).join(' · ');

  const feeBal = Number(profile?.fee_balance ?? profile?.fee_wallet ?? 0);
  const canteenBal = Number(profile?.canteen_balance ?? profile?.canteen_wallet ?? 0);

  return (
    <div className="p-4 rounded-2xl border border-slate-100 bg-white space-y-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        {roleWallet && (
          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
            roleWallet === 'fee' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {roleWallet} Wallet Involved
          </span>
        )}
      </div>

      <div className="flex items-start gap-3.5">
        <div className="flex-shrink-0">
          {profile?.image_url ? (
            <img src={profile.image_url} alt={fullName} className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
              <UserCircle className="h-7 w-7 text-emerald-600" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-base leading-tight truncate">{fullName}</p>
          <p className="text-xs font-mono text-slate-500 mt-0.5">{regNo}</p>
          {classLabel && <p className="text-xs font-medium text-slate-600 mt-1 truncate">Class: {classLabel}</p>}
        </div>
      </div>

      {/* Live Current Wallet Standing */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className={`p-2.5 rounded-xl border text-center ${canteenBal < 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50/60 border-blue-100'}`}>
          <span className="text-[10px] font-bold text-blue-600 uppercase block">Live Canteen Bal</span>
          <span className={`text-xs font-mono font-black ${canteenBal < 0 ? 'text-red-700' : 'text-blue-900'}`}>{fmtMoney(canteenBal)}</span>
        </div>
        <div className="p-2.5 rounded-xl border bg-purple-50/60 border-purple-100 text-center">
          <span className="text-[10px] font-bold text-purple-600 uppercase block">Live Tuition Fee Bal</span>
          <span className="text-xs font-mono font-black text-purple-900">{fmtMoney(feeBal)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Slide-Out Audit Drawer ───────────────────────────────────────────────────
function AuditDrawer({ item, onClose, onRevert, actionLoading, settings, canCheckerAction, schoolName, onError }: any) {
  const [sourceLive, setSourceLive] = useState<any>(null);
  const [destLive, setDestLive] = useState<any>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (item.status === 'confirmed' || item.status === 'reverted') {
          triggerPrintReceipt(item, schoolName, onError);
        }
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, schoolName, onClose, onError]);

  // Query studentsAPI.get() with robust unwrapping for live balances
  useEffect(() => {
    if (!item) {
      setSourceLive(null);
      setDestLive(null);
      return;
    }

    let isMounted = true;
    setLoadingProfiles(true);

    const srcId = getStudentId(item.source_student, item.source_student_detail);
    const destId = getStudentId(item.destination_student, item.destination_student_detail);

    const fetchProfiles = async () => {
      try {
        let unwrappedSrc = null;
        if (srcId) {
          const rawSrc = await studentsAPI.get(srcId).catch(() => null);
          unwrappedSrc = (rawSrc as any)?.data?.data ?? (rawSrc as any)?.data ?? rawSrc;
        }
        if (!isMounted) return;
        // Merge rather than all-or-nothing fallback: the "get by id" endpoint
        // can return a truthy object that's still missing/renamed wallet
        // balance fields (different serializer than the transfers list uses).
        // A plain `||` never catches that since the object itself isn't
        // falsy — it just silently renders 0/0. Merging per-field against the
        // transfer's embedded snapshot (which is always complete) fixes this.
        setSourceLive(mergeStudentProfile(unwrappedSrc, item.source_student_detail));

        if (destId && destId !== srcId) {
          let unwrappedDest = null;
          const rawDest = await studentsAPI.get(destId).catch(() => null);
          unwrappedDest = (rawDest as any)?.data?.data ?? (rawDest as any)?.data ?? rawDest;
          if (!isMounted) return;
          setDestLive(mergeStudentProfile(unwrappedDest, item.destination_student_detail));
        } else {
          setDestLive(mergeStudentProfile(unwrappedSrc, item.source_student_detail));
        }
      } finally {
        if (isMounted) setLoadingProfiles(false);
      }
    };

    fetchProfiles();
    return () => { isMounted = false; };
  }, [item]);

  if (!item) return null;

  const srcId = getStudentId(item.source_student, item.source_student_detail);
  const destId = getStudentId(item.destination_student, item.destination_student_detail);
  const isSameStudent = (srcId && destId && srcId === destId) || item.transfer_type === 'cross_wallet';

  const windowHours = settings?.reversal_window_hours ?? 24;
  const hoursSinceCreation = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
  const isWindowExpired = windowHours > 0 && hoursSinceCreation > windowHours;

  const srcFallbackName = item.source_student_detail?.full_name || item.source_student_name || `ID #${item.source_student}`;
  const destFallbackName = item.destination_student_detail?.full_name || item.destination_student_name || `ID #${item.destination_student}`;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Transfer Audit Slip</span>
            <h3 className="text-base font-bold truncate max-w-[320px]">Ref: {item.reference || `#${item.id}`}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Reallocated Volume Banner */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Reallocated Volume</p>
              <p className="text-2xl font-black text-slate-900 font-mono">{fmtMoney(item.amount)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={item.status} />
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                {toTitleCase(item.transfer_type_display || item.transfer_type)}
              </span>
            </div>
          </div>

          {loadingProfiles && (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Fetching live student standing...
            </div>
          )}

          {/* Context-Aware Profile Section */}
          {isSameStudent ? (
            <div className="space-y-3">
              <StudentProfileCard
                profile={sourceLive}
                fallbackName={srcFallbackName}
                fallbackId={srcId}
                label="Subject Beneficiary Profile (Single Student)"
              />

              {/* Internal Flow Diagram */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700">
                <div className="text-center flex-1">
                  <span className="text-[10px] text-purple-600 uppercase font-mono block">Deducted From</span>
                  <span className="font-bold uppercase">{item.source_wallet_type} Wallet</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div className="text-center flex-1">
                  <span className="text-[10px] text-blue-600 uppercase font-mono block">Credited To</span>
                  <span className="font-bold uppercase">{item.destination_wallet_type} Wallet</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <StudentProfileCard
                profile={sourceLive}
                fallbackName={srcFallbackName}
                fallbackId={srcId}
                label="Sender Profile (Deducted Source)"
                roleWallet={item.source_wallet_type}
              />

              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider py-1">
                <ArrowRightLeft className="h-4 w-4 text-emerald-500" /> Sibling Peer Shift ({fmtMoney(item.amount)})
              </div>

              <StudentProfileCard
                profile={destLive}
                fallbackName={destFallbackName}
                fallbackId={destId}
                label="Receiver Profile (Credited Destination)"
                roleWallet={item.destination_wallet_type}
              />
            </div>
          )}

          {/* Audit Narration & Timestamps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit Narration & Trail</h4>
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm bg-white">
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Full Reference</span><span className="font-mono font-bold text-slate-800">{item.reference || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Recorded On</span><span className="text-slate-800">{formatDate(item.created_at)}</span></div>
              <div className="p-3.5 flex justify-between items-center">
                <span className="text-slate-500">Processed By</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  {item.created_by_name || 'Unknown Staff'}
                </span>
              </div>
              {item.status === 'reverted' && (
                <div className="p-3.5 flex justify-between">
                  <span className="text-slate-500">Reverted On</span>
                  <span className="text-slate-800">{formatDate(item.reverted_at)}</span>
                </div>
              )}
              <div className="p-3.5 flex flex-col gap-1">
                <span className="text-xs text-slate-400 uppercase font-semibold">Cashier Narration</span>
                <span className="text-slate-700 text-xs font-medium leading-relaxed">{item.reason || 'No narration provided.'}</span>
              </div>
              {item.status === 'reverted' && item.refund_reason && (
                <div className="p-3.5 flex flex-col gap-1">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Reversal Reason</span>
                  <span className="text-slate-700 text-xs font-medium leading-relaxed">{item.refund_reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2 justify-end flex-shrink-0">
          <button onClick={() => triggerPrintReceipt(item, schoolName, onError)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs">
            <FileText className="h-3.5 w-3.5 text-emerald-600" /> Print Receipt
          </button>

          {item.status === 'confirmed' && canCheckerAction && (
            <button
              onClick={() => onRevert(item)}
              disabled={actionLoading || isWindowExpired}
              title={isWindowExpired ? `Reversal grace period (${windowHours}h) expired` : 'Revert transaction'}
              className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {isWindowExpired ? 'Reversal Expired' : 'Revert Transfer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Consolidated Page ────────────────────────────────────────────────────
export default function ConsolidatedTransfersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user, schoolInfo } = useAuth();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const canCheckerAction = user?.is_superuser || hasPermission('finance.confirm_funding') || hasPermission('finance.add_wallettransfermodel');

  // State
  const [statusFilter, setStatusFilter]   = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');

  const [data, setData]                   = useState<any[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [pageError, setPageError]         = useState<string | null>(null);

  const [settings, setSettings]           = useState<any>(null);

  // Drawer & Modals
  const [selectedItem, setSelectedItem]   = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [revertModal, setRevertModal]     = useState<{ open: boolean; item: any; reason: string }>({ open: false, item: null, reason: '' });

  const [toasts, setToasts]               = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const hasActiveFilters = Boolean(statusFilter || typeFilter || searchQuery.trim() || startDate || endDate);

  const clearAllFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
  };

  useEffect(() => {
    financeSettingsAPI.get().then(res => setSettings(res || {})).catch(() => {});
  }, []);

  // Build Query Params
  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (statusFilter)                         params.status        = statusFilter;
    if (typeFilter)                           params.transfer_type = typeFilter;
    if (searchQuery.trim())                   params.search        = searchQuery.trim();
    if (startDate)                            params.start_date    = startDate;
    if (endDate)                              params.end_date      = endDate;
    return params;
  }, [page, statusFilter, typeFilter, searchQuery, startDate, endDate]);

  // Fetch List
  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const response: any = await walletTransferAPI.list(buildParams());
      const results = Array.isArray(response) ? response : response?.results?.data ?? response?.results ?? response?.data ?? [];
      const totalCount = typeof response?.count === 'number' ? response.count : results.length;
      setData(results);
      setTotal(totalCount);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [buildParams]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, searchQuery, startDate, endDate]);

  // Auto-Open Audit Drawer ONCE on landing & clean URL
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
      walletTransferAPI.get(numId).then((res: any) => {
        const unwrapped = res?.data ?? res;
        if (unwrapped) setSelectedItem(unwrapped);
      }).catch(() => {});
    }
  }, [searchParams, data, router]);

  const handleRevertSubmit = async () => {
    if (!revertModal.reason.trim()) { showToast('error', 'Reversal reason is required.'); return; }
    setActionLoading(true);
    try {
      await walletTransferAPI.revert(revertModal.item.id, revertModal.reason.trim());
      showToast('success', 'Transfer successfully reverted and wallet balances adjusted.');
      setRevertModal({ open: false, item: null, reason: '' });
      setSelectedItem(null);
      fetchData();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(false); }
  };

  const getExportRows = useCallback(async (): Promise<TransferExportRow[]> => {
    const params: any = { ...buildParams(), page_size: 2000 }; delete params.page;
    const response: any = await walletTransferAPI.list(params);
    const results = Array.isArray(response) ? response : response?.results?.data ?? response?.results ?? [];
    return results.map((item: any) => {
      const senderName = toTitleCase(item.source_student_detail?.full_name || item.source_student_name || `ID #${item.source_student}`);
      const receiverName = toTitleCase(item.destination_student_detail?.full_name || item.destination_student_name || `ID #${item.destination_student}`);
      return {
        id: item.id, reference: item.reference, transferType: item.transfer_type_display || item.transfer_type,
        senderName, sourceWallet: item.source_wallet_type, receiverName, destWallet: item.destination_wallet_type,
        amount: item.amount, status: item.status, created: formatDate(item.created_at), reason: item.reason,
      };
    });
  }, [buildParams]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Slide-out Drawer */}
      <AuditDrawer
        item={selectedItem} onClose={() => setSelectedItem(null)}
        onRevert={(item: any) => setRevertModal({ open: true, item, reason: '' })}
        actionLoading={actionLoading} settings={settings} canCheckerAction={canCheckerAction} schoolName={schoolInfo?.name}
        onError={(msg: string) => showToast('error', msg)}
      />

      {/* Revert Modal */}
      {revertModal.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><RotateCcw className="h-5 w-5 text-red-600" /> Revert Confirmed Transfer</h3>
            <p className="text-xs text-slate-500 leading-relaxed">This will atomically reverse ₦{Number(revertModal.item?.amount || 0).toLocaleString()} between the source and destination wallets.</p>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Reversal Reason <span className="text-red-500">*</span></label>
              <textarea
                rows={3}
                placeholder="State exact reason for mistake or fund reallocation pull-back..."
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
              <ArrowRightLeft className="h-5 w-5 text-white" />
            </div>
            Master Transfers Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Audit, confirm, and reconcile internal student wallet reallocations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/dashboard/staff/finance/wallet-transfer')} className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-200 hover:from-emerald-700 transition-all flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> New POS Transfer
          </button>
          <TransfersExporter schoolName={schoolInfo?.name} getExportRows={getExportRows} />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, narration, or student name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="reverted">Reverted</option>
          </select>

          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
            <option value="">All Categories</option>
            <option value="cross_wallet">Cross-Wallet</option>
            <option value="sibling_transfer">Sibling Transfer</option>
          </select>

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
            <p className="text-xs text-slate-400 font-medium">Loading transfer records...</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center text-red-600 font-medium">{pageError}</div>
        ) : data.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <ArrowRightLeft className="h-10 w-10 text-slate-200 mx-auto" />
            <h3 className="font-bold text-slate-700">No wallet transfers found</h3>
            <p className="text-xs text-slate-400">Try clearing active filters or execute a new POS transfer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-3.5">Sender (Deducted)</th>
                  <th className="px-3 py-3.5">Receiver (Credited)</th>
                  <th className="px-3 py-3.5 text-center">Category</th>
                  <th className="px-3 py-3.5">Amount</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-3 py-3.5">Timestamp</th>
                  <th className="px-3 py-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  const srcName = toTitleCase(item.source_student_detail?.full_name || item.source_student_name || `ID #${item.source_student}`);
                  const destName = toTitleCase(item.destination_student_detail?.full_name || item.destination_student_name || `ID #${item.destination_student}`);

                  const windowHours = settings?.reversal_window_hours ?? 24;
                  const hoursOld = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
                  const isExpired = windowHours > 0 && hoursOld > windowHours;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-3 max-w-[180px]">
                        <p className="font-bold text-slate-800 text-xs truncate" title={srcName}>{srcName}</p>
                        <span className="text-[10px] font-mono text-purple-700 font-bold uppercase">{item.source_wallet_type} Wallet</span>
                      </td>
                      <td className="px-3 py-3 max-w-[180px]">
                        <p className="font-bold text-slate-800 text-xs truncate" title={destName}>{destName}</p>
                        <span className="text-[10px] font-mono text-blue-700 font-bold uppercase">{item.destination_wallet_type} Wallet</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {item.transfer_type === 'sibling_transfer' ? (
                          <div title="Sibling Peer-to-Peer Shift" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs font-bold text-[11px]">
                            <User className="h-3.5 w-3.5 flex-shrink-0" />
                            <ArrowRightLeft className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                            <User className="h-3.5 w-3.5 flex-shrink-0" />
                          </div>
                        ) : (
                          <div title="Internal Cross-Wallet Reallocation" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/80 shadow-2xs font-bold text-[11px]">
                            <Wallet className="h-3.5 w-3.5 flex-shrink-0" />
                            <ArrowRightLeft className="h-3 w-3 text-purple-500 flex-shrink-0" />
                            <Wallet className="h-3.5 w-3.5 flex-shrink-0" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-black text-slate-900 whitespace-nowrap">{fmtMoney(item.amount)}</td>
                      <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                      <td className="px-3 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{formatDate(item.created_at)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {(item.status === 'confirmed' || item.status === 'reverted') && (
                            <button onClick={() => triggerPrintReceipt(item, schoolInfo?.name, (msg) => showToast('error', msg))} title="Print Receipt" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          {item.status === 'confirmed' && canCheckerAction && (
                            <button
                              onClick={() => setRevertModal({ open: true, item, reason: '' })}
                              disabled={isExpired}
                              title={isExpired ? `Grace period (${windowHours}h) expired` : 'Revert transfer'}
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