'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { myFundingAPI } from '@/lib/api';
import {
  Search, X, Loader2, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Eye, CheckCircle, XCircle, Clock, ArrowUpCircle,
  FileText, Check, DollarSign, FilterX, UserCircle, Phone,
  Building2, Printer, Wallet,
} from 'lucide-react';

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

function fmtMoney(amount: string | number | undefined): string {
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

// ─── Thermal/A4 Receipt Generator ─────────────────────────────────────────────
function triggerPrintReceipt(item: any, schoolName?: string, onError?: (msg: string) => void) {
  const person = typeof item.staff === 'object' ? item.staff : item.staff_detail;
  const personName = toTitleCase(person?.full_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Staff Profile');

  const win = window.open('', '_blank');
  if (!win) {
    if (onError) onError('Pop-up blocked. Please allow pop-ups for this site to print receipt vouchers.');
    return;
  }

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
    <p style="margin:4px 0 0;font-size:12px;">STAFF WALLET FUNDING VOUCHER</p>
  </div>
  <div class="row"><span>Reference:</span><span class="bold">${item.reference || `TXN-${item.id}`}</span></div>
  <div class="row"><span>Date:</span><span>${formatDate(item.created_at)}</span></div>
  <div class="row"><span>Status:</span><span class="status bold">${item.status}</span></div>
  <div class="border-b"></div>
  <div class="row"><span>Staff Name:</span><span class="bold">${personName}</span></div>
  <div class="row"><span>Staff ID:</span><span>${person?.staff_id || 'N/A'}</span></div>
  <div class="row"><span>Payment Method:</span><span class="capitalize">${item.method} (${item.mode})</span></div>
  <div class="amount">${fmtMoney(item.amount)}</div>
  <div class="border-b"></div>
  <div class="text-center" style="font-size:11px;margin-top:16px;">Verified wallet top-up.<br/>Printed on ${new Date().toLocaleString()}</div>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Slide-Out Self-Service Audit Drawer ──────────────────────────────────────
function AuditDrawer({ item, onClose, schoolName, onError }: any) {
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

  if (!item) return null;
  const person = typeof item.staff === 'object' ? item.staff : item.staff_detail;
  const personName = toTitleCase(person?.full_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Staff Profile');

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">My Funding Audit</span>
            <h3 className="text-base font-bold truncate max-w-[260px]">Ref: {item.reference || `#${item.id}`}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Funded Amount</p>
              <p className="text-2xl font-black text-slate-900 font-mono">{fmtMoney(item.amount)}</p>
            </div>
            <StatusBadge status={item.status} />
          </div>

          {item.status?.toLowerCase() === 'declined' && item.decline_reason && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-red-800 uppercase tracking-wide">Decline Reason</span>
              <p className="text-xs text-red-950 font-medium leading-relaxed">{item.decline_reason}</p>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Breakdown</h4>
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm bg-white">
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Beneficiary</span><span className="font-bold text-slate-800">{personName}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono font-bold text-slate-800">{item.reference || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Payment Mode</span><span className="font-semibold capitalize text-slate-800">{item.mode}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Method</span><span className="font-semibold capitalize text-slate-800">{item.method}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Teller Number</span><span className="font-mono font-medium text-slate-800">{item.teller_number || '—'}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500">Recorded On</span><span className="text-slate-800">{formatDate(item.created_at)}</span></div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end flex-shrink-0">
          {(item.status === 'confirmed' || item.status === 'reverted') && (
            <button onClick={() => triggerPrintReceipt(item, schoolName, onError)} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
              <Printer className="h-4 w-4" /> Print Receipt (Ctrl+P)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function StaffMyFundingPage() {
  const { user, schoolInfo } = useAuth();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // State
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [data, setData] = useState<any[]>([]);
  const [staffProfile, setStaffProfile] = useState<any | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const hasActiveFilters = Boolean(statusFilter || searchQuery.trim() || startDate || endDate);

  const clearAllFilters = () => {
    setStatusFilter('');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
  };

  // Build Query Params with simultaneous DRF multi-key support for dates
  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (statusFilter) params.status = statusFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();

    // Multi-key date boundaries ensure DRF catches the filter regardless of backend naming
    if (startDate) {
      params.start_date = startDate;
      params.date_from = startDate;
      params.created_at__gte = `${startDate}T00:00:00`;
    }
    if (endDate) {
      params.end_date = endDate;
      params.date_to = endDate;
      params.created_at__lte = `${endDate}T23:59:59`;
    }
    return params;
  }, [page, statusFilter, searchQuery, startDate, endDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const response: any = await myFundingAPI.getStaffFunding(buildParams());
      const results = Array.isArray(response) ? response : response?.results?.data ?? response?.results ?? response?.data ?? [];
      const totalCount = typeof response?.count === 'number' ? response.count : results.length;

      setData(results);
      setTotal(totalCount);

      // Deep profile resolution: merges envelope profile, row details, and authenticated user
      const rootProfile = response?.profile ?? response?.staff ?? response?.staff_detail;
      const rowProfile = results.find((r: any) => r.staff_detail || (typeof r.staff === 'object' && r.staff))?.staff_detail ?? results.find((r: any) => typeof r.staff === 'object')?.staff;
      const resolvedProfile = rootProfile ?? rowProfile ?? user;

      setStaffProfile(resolvedProfile);

      // Deep balance resolution
      const rootBal = response?.wallet_balance ?? response?.balance ?? response?.profile?.wallet_balance ?? response?.profile?.balance;
      const rowBal = rowProfile?.wallet_balance ?? rowProfile?.balance ?? resolvedProfile?.wallet_balance ?? resolvedProfile?.balance;
      setWalletBalance(Number(rootBal ?? rowBal ?? 0));
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [buildParams, user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQuery, startDate, endDate]);

  const personName = toTitleCase(
    staffProfile?.full_name ||
    `${staffProfile?.first_name || user?.first_name || ''} ${staffProfile?.last_name || user?.last_name || ''}`.trim() ||
    'Staff Profile'
  );

  const staffIdLabel = staffProfile?.staff_id || (user as any)?.staff_id || 'STAFF';
  const deptLabel = staffProfile?.department_name || staffProfile?.department?.name || (user as any)?.department_name;
  const posLabel = staffProfile?.position_name || staffProfile?.position?.name || (user as any)?.position_name;
  const phoneLabel = staffProfile?.phone || staffProfile?.mobile || (user as any)?.phone;
  const avatarUrl = staffProfile?.image_url || staffProfile?.profile_image || (user as any)?.image_url || (user as any)?.profile_image;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Slide-out Drawer */}
      <AuditDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        schoolName={schoolInfo?.name}
        onError={(msg: string) => showToast('error', msg)}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            My Wallet Funding History
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">View personal wallet top-ups, track live balances, and print receipt slips</p>
        </div>
      </div>

      {/* Hero Section: Staff Profile & Live Wallet Balance */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="md:col-span-2 flex items-center gap-4 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-6">
          {avatarUrl ? (
            <img src={avatarUrl} alt={personName} className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-2xs flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 font-bold text-xl flex-shrink-0">
              {personName.charAt(0) || 'S'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 truncate">{personName}</h2>
              <span className="px-2 py-0.5 bg-slate-100 font-mono font-bold text-xs text-slate-600 rounded-md">
                {staffIdLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
              {deptLabel && (
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-slate-400" /> {deptLabel}</span>
              )}
              {posLabel && (
                <span className="flex items-center gap-1"><UserCircle className="h-3.5 w-3.5 text-slate-400" /> {posLabel}</span>
              )}
              {phoneLabel && (
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" /> {phoneLabel}</span>
              )}
            </div>
          </div>
        </div>

        {/* Live Balance Card */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Live Wallet Standing</span>
            <span className="text-2xl font-black text-emerald-950 font-mono mt-0.5 block">{fmtMoney(walletBalance)}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search payment channel or teller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending Approval</option>
            <option value="declined">Declined</option>
          </select>

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
                className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <FilterX className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <button onClick={fetchData} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table Data (Reference column removed for clean width) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-xs text-slate-400 font-medium">Loading personal funding ledger...</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center text-red-600 font-medium">{pageError}</div>
        ) : data.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Wallet className="h-10 w-10 text-slate-200 mx-auto" />
            <h3 className="font-bold text-slate-700">No funding records found</h3>
            <p className="text-xs text-slate-400">You currently have no wallet top-ups matching your active filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3.5">Funded Amount</th>
                  <th className="px-4 py-3.5">Channel Mode</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-black text-slate-900 font-mono text-base">{fmtMoney(item.amount)}</td>
                    <td className="px-4 py-3 capitalize text-slate-700 font-bold">
                      {item.method} <span className="text-xs text-slate-400 font-normal">({item.mode})</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-medium">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {(item.status === 'confirmed' || item.status === 'reverted') && (
                          <button onClick={() => triggerPrintReceipt(item, schoolInfo?.name, (msg) => showToast('error', msg))} title="Print Receipt" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => setSelectedItem(item)} title="View Details & Reference" className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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