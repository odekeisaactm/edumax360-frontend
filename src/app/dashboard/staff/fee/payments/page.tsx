'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, financeSettingsAPI } from '@/lib/api';
import {
  Search, X, Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight,
  Eye, CheckCircle, XCircle, Clock, ArrowUpCircle, Wallet, CreditCard,
  FileText, RotateCcw, Check, Calendar, Download, ExternalLink,
  Receipt, Building2, UserCircle, FilterX, Banknote
} from 'lucide-react';

// ─── Helpers & Types ──────────────────────────────────────────────────────────
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
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in slide-in-from-top-2
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending Confirmation', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle className="h-3 w-3" /> },
    failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <XCircle className="h-3 w-3" /> },
    reverted: { label: 'Reverted', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: <ArrowUpCircle className="h-3 w-3" /> },
  };
  const meta = map[status?.toLowerCase() || 'pending'] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ─── A4 Receipt Generator (User's Exact Template) ─────────────────────────────
function triggerA4Receipt(item: any, schoolInfo: any) {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to print receipts.'); return; }

  const personName = item.parent_name || item.student_name || 'Walk-in Customer';
  const logoHtml = schoolInfo?.logo ? `<img src="${schoolInfo.logo}" alt="School Logo" class="mb-2">` : '';
  const bankHtml = item.bank_account_detail
    ? `${item.bank_account_detail.bank_name} - ${item.bank_account_detail.account_number}`
    : 'N/A';

  // Format the JSON allocations into readable table rows
  const allocationsHtml = (item.allocations || []).map((alloc: any) => {
    const label = alloc.target_type.replace('_', ' ').toUpperCase();
    return `
      <tr>
        <td style="font-size: 14px;">Payment applied to: <strong>${label}</strong></td>
        <td class="text-end fw-bold">₦${Number(alloc.amount).toLocaleString('en-NG', {minimumFractionDigits:2})}</td>
      </tr>
    `;
  }).join('');

  // Format funding sources
  const sourcesHtml = (item.funding_sources || []).map((src: any) => {
    const label = src.source_type === 'wallet' ? 'Virtual Wallet Deduction' : 'External Payment (Cash/Bank)';
    return `<div class="d-flex justify-content-between mb-1"><span class="text-muted">${label}:</span> <strong>₦${Number(src.amount).toLocaleString('en-NG', {minimumFractionDigits:2})}</strong></div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Receipt - ${item.reference}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css">
    <style>
        body { background-color: #f8f9fa; font-family: sans-serif; }
        .receipt-container { max-width: 800px; margin: 2rem auto; background: #fff; border: 1px solid #dee2e6; padding: 2.5rem; position: relative; }
        .receipt-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 2rem; }
        .receipt-header img { max-height: 90px; }
        .paid-stamp { position: absolute; top: 220px; left: 50%; transform: translateX(-50%) rotate(-15deg); font-size: 8rem; font-weight: 900; color: rgba(40, 167, 69, 0.08); border: 8px solid rgba(40, 167, 69, 0.08); padding: 0.5rem 2rem; border-radius: 15px; z-index: 0; user-select: none; pointer-events: none; }
        .reverted-stamp { position: absolute; top: 220px; left: 50%; transform: translateX(-50%) rotate(-15deg); font-size: 7rem; font-weight: 900; color: rgba(220, 53, 69, 0.08); border: 8px solid rgba(220, 53, 69, 0.08); padding: 0.5rem 2rem; border-radius: 15px; z-index: 0; user-select: none; pointer-events: none; }
        .receipt-body { position: relative; z-index: 1; }
        @media print {
            body { background-color: #fff; }
            .receipt-container { margin: 0; border: none; max-width: 100%; padding: 0.5rem; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="receipt-container shadow-sm">
        <div class="receipt-header">
            ${logoHtml}
            <h2 class="mt-2 mb-1 fw-black">${schoolInfo?.name?.toUpperCase() || 'SCHOOL FINANCE OFFICE'}</h2>
            <p class="mb-0 text-muted">${schoolInfo?.address || ''}</p>
            <p class="text-muted">${schoolInfo?.email || ''} | ${schoolInfo?.mobile || ''}</p>
            <h4 class="mt-3 fw-bold">OFFICIAL PAYMENT RECEIPT</h4>
        </div>

        ${item.status === 'confirmed' ? '<div class="paid-stamp">PAID</div>' : ''}
        ${item.status === 'reverted' ? '<div class="reverted-stamp">REVERTED</div>' : ''}

        <div class="receipt-body">
            <div class="row mb-4">
                <div class="col-6"><span class="text-muted">Receipt No:</span> <br><strong>${item.reference}</strong></div>
                <div class="col-6 text-end"><span class="text-muted">Date:</span> <br><strong>${formatDate(item.date || item.created_at)}</strong></div>
            </div>

            <div class="card mb-4 border-dark">
                <div class="card-header bg-dark text-white fw-bold">Received From</div>
                <div class="card-body py-3">
                    <h5 class="card-title my-1 fw-bold">${personName}</h5>
                    <p class="card-text mb-0 text-muted"><strong>Account Type:</strong> ${item.parent_name ? 'Family / Guardian' : 'Independent Student'}</p>
                </div>
            </div>

            <table class="table table-bordered mb-4">
                <tbody>
                    <tr><th style="width: 35%; background: #f8f9fa;">Total Amount Paid</th><td class="fs-5 text-success"><strong>₦${Number(item.total_amount).toLocaleString('en-NG', {minimumFractionDigits:2})}</strong></td></tr>
                    <tr><th style="background: #f8f9fa;">Payment Channel</th><td class="text-capitalize">${item.external_payment_mode?.replace('_', ' ') || 'Wallet Only'}</td></tr>
                    <tr><th style="background: #f8f9fa;">Receiving Bank</th><td>${bankHtml}</td></tr>
                    <tr><th style="background: #f8f9fa;">Cashier Notes</th><td>${item.notes || '—'}</td></tr>
                </tbody>
            </table>

            <div class="card bg-light mt-4 border-0">
                <div class="card-body">
                    <h6 class="card-title mb-3 fw-bold text-uppercase text-muted" style="font-size:12px; letter-spacing:1px;">Payment Allocation Breakdown</h6>
                    <table class="table table-borderless table-sm mb-3">
                        <tbody>${allocationsHtml}</tbody>
                    </table>
                    <hr>
                    <h6 class="card-title mt-3 mb-2 fw-bold text-uppercase text-muted" style="font-size:12px; letter-spacing:1px;">Funding Sources</h6>
                    ${sourcesHtml}
                </div>
            </div>

            <div class="row mt-5 pt-4">
                <div class="col-6 text-center">
                    <hr class="mx-auto border-dark" style="width: 80%; opacity: 0.2;">
                    <p class="mb-0 text-muted small">Issued By</p>
                    <p class="fw-bold">${item.confirmed_by_name || 'Finance Office'}</p>
                </div>
                <div class="col-6 text-center">
                     <hr class="mx-auto border-dark" style="width: 80%; opacity: 0.2;">
                     <p class="mb-0 text-muted small">Signature & Stamp</p>
                </div>
            </div>

            <div class="alert alert-secondary mt-4 small border-0 text-center text-muted">
                <strong>Note:</strong> This receipt confirms payment received into the school's ledger. Please keep this for your records.
            </div>
        </div>

        <div class="text-center mt-4 no-print gap-2 d-flex justify-content-center">
            <button class="btn btn-dark px-4 fw-bold" onclick="window.print();"><i class="bi bi-printer me-2"></i> Print Receipt</button>
            <button onclick="window.close()" class="btn btn-outline-secondary px-4 fw-bold">Close Window</button>
        </div>

        <div class="text-center mt-4 pt-3 border-top" style="font-size: 0.65rem; color: #aaa; letter-spacing: 0.05em; text-transform: uppercase;">
            Managed by <strong>TEKERA IT CONSULTS</strong> &mdash; 0806 005 0437
        </div>
    </div>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Slide-Out Audit Drawer ───────────────────────────────────────────────────
function AuditDrawer({ item, onClose, onRevert, actionLoading, canManage }: any) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;
  const personName = item.parent_name || item.student_name || 'Unknown';
  const isFamily = !!item.parent_name;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Master Receipt</span>
            <h3 className="text-lg font-black truncate max-w-[320px]">{item.reference}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

          {/* Status & Amount Banner */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Settled</p>
              <p className="text-3xl font-black text-slate-900">{fmtMoney(item.total_amount)}</p>
            </div>
            <div className="text-right">
              <StatusBadge status={item.status} />
              <p className="text-[11px] font-semibold text-slate-400 mt-2">{formatDate(item.date || item.created_at)}</p>
            </div>
          </div>

          {/* Profile & Channel */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-indigo-600">
                {isFamily ? <Building2 className="w-4 h-4"/> : <UserCircle className="w-4 h-4"/>}
                <span className="text-[10px] font-black uppercase tracking-wider">Payer Profile</span>
              </div>
              <p className="font-bold text-slate-800 text-sm truncate">{personName}</p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">{isFamily ? 'Family / Guardian' : 'Independent Student'}</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-emerald-600">
                <CreditCard className="w-4 h-4"/>
                <span className="text-[10px] font-black uppercase tracking-wider">Channel</span>
              </div>
              <p className="font-bold text-slate-800 text-sm capitalize">{item.external_payment_mode?.replace('_', ' ') || 'Wallet Only'}</p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">{item.bank_account_detail?.bank_name || 'Internal Ledger'}</p>
            </div>
          </div>

          {/* Proof of Payment */}
          {item.proof_of_payment && (
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center"><FileText className="w-5 h-5"/></div>
                <div>
                  <p className="text-xs font-bold text-blue-900">Proof of Payment</p>
                  <p className="text-[10px] text-blue-600 font-medium">Bank Slip / Teller Attached</p>
                </div>
              </div>
              <a href={item.proof_of_payment} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg text-blue-600 hover:bg-blue-600 hover:text-white transition-colors border border-blue-200 shadow-sm">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Funding Sources (Inflows) */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Funding Sources (Inflow)</h4>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {(item.funding_sources || []).map((src: any, idx: number) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {src.source_type === 'wallet' ? <Wallet className="w-4 h-4 text-purple-500"/> : <Banknote className="w-4 h-4 text-emerald-500"/>}
                      <span className="text-xs font-bold text-slate-700">{src.source_type === 'wallet' ? 'Virtual Wallet Deduction' : 'External Cash/Bank'}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900">{fmtMoney(src.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Allocations (Outflows) */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Debt Allocations (Outflow)</h4>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {(item.allocations || []).map((alloc: any, idx: number) => {
                  const isWalletCredit = alloc.target_type === 'wallet_funding';
                  return (
                    <div key={idx} className={`p-3.5 flex items-center justify-between ${isWalletCredit ? 'bg-amber-50/50' : ''}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isWalletCredit ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                        <span className={`text-xs font-bold ${isWalletCredit ? 'text-amber-800' : 'text-slate-700'}`}>
                          {alloc.target_type.replace('_', ' ').toUpperCase()} {alloc.target_id ? `#${alloc.target_id}` : ''}
                        </span>
                      </div>
                      <span className={`text-sm font-black ${isWalletCredit ? 'text-amber-700' : 'text-slate-900'}`}>{fmtMoney(alloc.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reversal Reason */}
          {item.status === 'reverted' && item.reversal_reason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-1.5">
              <span className="text-[11px] font-bold text-red-800 uppercase tracking-wide flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Reversal Reason
              </span>
              <p className="text-xs text-red-950 font-medium leading-relaxed">{item.reversal_reason}</p>
              <p className="text-[10px] text-red-700/70 pt-2 border-t border-red-200/50 mt-2">Reverted by {item.reverted_by?.full_name || 'Admin'} on {formatDate(item.reverted_at)}</p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-200 bg-white flex flex-wrap gap-3 justify-end flex-shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          {(item.status === 'confirmed' || item.status === 'reverted') && (
            <button onClick={() => triggerA4Receipt(item, {})} className="px-5 py-2.5 bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 flex items-center gap-2 transition-all">
              <FileText className="h-4 w-4 text-emerald-600" /> Print A4 Receipt
            </button>
          )}

          {item.status === 'confirmed' && canManage && (
            <button
              onClick={() => onRevert(item)}
              disabled={actionLoading}
              className="px-5 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-all shadow-md shadow-red-200"
            >
              <RotateCcw className="h-4 w-4" /> Revert Ledger
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PaymentReceiptsPage() {
  const router = useRouter();
  const { hasPermission, user, schoolInfo } = useAuth();
  const canManage = user?.is_superuser || hasPermission('finance.confirm_payment');

  // State
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [revertModal, setRevertModal] = useState<{ open: boolean; item: any; reason: string }>({ open: false, item: null, reason: '' });
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const clearAllFilters = () => {
    setStatusFilter('');
    setModeFilter('');
    setSearchQuery('');
  };

  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (statusFilter) params.status = statusFilter;
    if (modeFilter) params.external_payment_mode = modeFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    return params;
  }, [page, statusFilter, modeFilter, searchQuery]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await feeAPI.getReceipts(buildParams());
      setData(response?.results || []);
      setTotal(response?.count || 0);
    } catch (err) {
      setError(extractError(err));
    } finally { setLoading(false); }
  }, [buildParams]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, modeFilter, searchQuery]);

  const handleRevertSubmit = async () => {
    if (!revertModal.reason.trim()) { showToast('error', 'Reversal reason is required.'); return; }
    setActionLoading(true);
    try {
      await feeAPI.revertReceipt(revertModal.item.id, revertModal.reason.trim());
      showToast('success', 'Master receipt successfully reverted. Debt ledgers restored.');
      setRevertModal({ open: false, item: null, reason: '' });
      setSelectedItem(null);
      fetchData();
    } catch (err) { showToast('error', extractError(err)); }
    finally { setActionLoading(false); }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Slide-out Drawer */}
      <AuditDrawer
        item={selectedItem} onClose={() => setSelectedItem(null)}
        onRevert={(item: any) => setRevertModal({ open: true, item, reason: '' })}
        actionLoading={actionLoading} canManage={canManage} schoolInfo={schoolInfo}
      />

      {/* Revert Modal */}
      {revertModal.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><RotateCcw className="h-5 w-5 text-red-600" /> Revert Master Receipt</h3>
            <p className="text-xs text-slate-500 leading-relaxed">This action will atomically restore the debt balances for all invoices and fines paid within this cart, and deduct any wallet refunds issued. <strong>This cannot be undone.</strong></p>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Reversal Reason <span className="text-red-500">*</span></label>
              <textarea
                rows={3} placeholder="State exact reason for pulling back this receipt..."
                value={revertModal.reason} onChange={(e) => setRevertModal(s => ({ ...s, reason: e.target.value }))}
                className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setRevertModal({ open: false, item: null, reason: '' })} className="px-5 py-2.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200">Cancel</button>
              <button onClick={handleRevertSubmit} disabled={actionLoading} className="px-6 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-red-200">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} Execute Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            Payment Receipts
          </h1>
          <p className="text-sm text-slate-500 mt-1 pl-13">Audit and manage centralized fee checkout transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/staff/fee/payments/new')} className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> POS Checkout
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text" placeholder="Search reference, parent, or student..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 text-sm font-bold border border-slate-200 rounded-xl bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="reverted">Reverted</option>
          </select>

          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className="px-4 py-2.5 text-sm font-bold border border-slate-200 rounded-xl bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option value="">All Payment Modes</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="pos">POS Terminal</option>
            <option value="online">Online Gateway</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            {(statusFilter || modeFilter || searchQuery) && (
              <button onClick={clearAllFilters} className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 text-xs font-bold flex items-center gap-1.5 transition-colors">
                <FilterX className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <button onClick={fetchData} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-500 font-bold">Loading master receipts...</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center text-red-600 font-medium flex flex-col items-center"><AlertCircle className="w-10 h-10 mb-2 opacity-50"/> {error}</div>
        ) : data.length === 0 ? (
          <div className="p-20 text-center space-y-3">
            <Receipt className="h-12 w-12 text-slate-200 mx-auto" />
            <h3 className="font-black text-slate-700 text-lg">No receipts found</h3>
            <p className="text-sm text-slate-400 font-medium">Try adjusting your filters or record a new POS checkout.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-4">Reference & Date</th>
                  <th className="px-5 py-4">Payer Profile</th>
                  <th className="px-5 py-4">Channel</th>
                  <th className="px-5 py-4">Total Amount</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  const personName = item.parent_name || item.student_name || 'Unknown';
                  const isFamily = !!item.parent_name;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3">
                        <p className="font-bold text-indigo-900">{item.reference}</p>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{formatDate(item.date || item.created_at)}</p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {isFamily ? <Building2 className="w-4 h-4 text-slate-400"/> : <UserCircle className="w-4 h-4 text-slate-400"/>}
                          <div>
                            <p className="font-bold text-slate-800">{personName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{isFamily ? 'Family' : 'Student'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-700 capitalize">{item.external_payment_mode?.replace('_', ' ') || 'Wallet Only'}</p>
                        {item.bank_account_detail && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{item.bank_account_detail.bank_name}</p>}
                      </td>
                      <td className="px-5 py-3 font-black text-slate-900 text-base">{fmtMoney(item.total_amount)}</td>
                      <td className="px-5 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                          {(item.status === 'confirmed' || item.status === 'reverted') && (
                            <button onClick={() => triggerA4Receipt(item, schoolInfo)} title="Print A4 Receipt" className="p-2 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setSelectedItem(item)} title="Audit Details" className="p-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
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
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>Showing Page {page} of {Math.ceil(total / PAGE_SIZE) || 1} &nbsp;&middot;&nbsp; {total} total receipts</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-1"><ChevronLeft className="h-3.5 w-3.5" /> Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total} className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-1">Next <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}