'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { studentFundingAPI, schoolInfoAPI } from '@/lib/api';
import {
  Wallet, X, Loader2, AlertCircle, RefreshCw, Eye, CheckCircle, Clock,
  ArrowUpCircle, XCircle, FileText, ExternalLink, PlusCircle, FilterX, Printer, UtensilsCrossed
} from 'lucide-react';

// ─── Helpers & Types ──────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str?: string): string {
  if (!str) return '—';
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
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
  return new Date(dateStr).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
}

// Consistent status → color mapping, reused by the badge, the mobile card's
// accent bar, and the avatar ring so the whole row reads as one status at a glance.
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', icon: <Clock className="h-3 w-3" /> },
  confirmed: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: <CheckCircle className="h-3 w-3" /> },
  declined: { label: 'Declined', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', icon: <XCircle className="h-3 w-3" /> },
  reverted: { label: 'Reverted', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', dot: 'bg-slate-400', icon: <ArrowUpCircle className="h-3 w-3" /> },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', icon: <XCircle className="h-3 w-3" /> },
};
function statusMeta(status: string) {
  return STATUS_META[status?.toLowerCase() || 'pending'] ?? STATUS_META.pending;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Thermal/A4 Receipt Generator ─────────────────────────────────────────────
function triggerPrintReceipt(item: any, schoolName?: string) {
  const person = item.student;
  const personName = toTitleCase(person?.full_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim());
  const regNo = person?.registration_number;
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to print receipts.'); return; }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt - TXN #${item.id}</title>
  <style>
    body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-width: 420px; margin: 0 auto; color: #111; }
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
    <button onclick="window.print()" class="btn" style="background:#4f46e5;color:#fff;border:none;">🖨️ Print Receipt</button>
    <button onclick="window.close()" class="btn" style="margin-left:8px;">❌ Close Window</button>
  </div>
  <div class="text-center border-b">
    <h2 style="margin:0;font-size:16px;">${schoolName || 'SCHOOL MANAGEMENT SYSTEM'}</h2>
    <p style="margin:4px 0 0;font-size:12px;">WALLET FUNDING RECEIPT</p>
  </div>
  <div class="row"><span>Reference:</span><span class="bold">${item.reference || `TXN-${item.id}`}</span></div>
  <div class="row"><span>Date:</span><span>${formatDate(item.created_at)}</span></div>
  <div class="row"><span>Status:</span><span class="status bold">${item.status}</span></div>
  <div class="border-b"></div>
  <div class="row"><span>Credited To:</span><span class="bold">${personName}</span></div>
  <div class="row"><span>ID Number:</span><span>${regNo || 'N/A'}</span></div>
  <div class="row"><span>Wallet Type:</span><span class="bold uppercase">${item.wallet_type}</span></div>
  <div class="row"><span>Payment Method:</span><span class="capitalize">${item.method} (${item.mode})</span></div>
  <div class="amount">${fmtMoney(item.amount)}</div>
  <div class="border-b"></div>
  <div class="text-center" style="font-size:11px;margin-top:16px;">Thank you for your payment.<br/>Printed on ${new Date().toLocaleString()}</div>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Slide-Out Audit Drawer (Parent Read-Only Version) ────────────────────────
function AuditDrawer({ item, onClose, schoolName }: any) {
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (item.status === 'confirmed' || item.status === 'reverted') {
          triggerPrintReceipt(item, schoolName);
        }
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, schoolName, onClose]);

  if (!item) return null;
  const person = item.student;
  const personName = toTitleCase(person?.full_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim());
  const regNo = person?.registration_number;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Deposit Details</span>
            <h3 className="text-lg font-black truncate max-w-[280px]">Ref: {item.reference || `#${item.id}`}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status & Amount Banner */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount</p>
              <p className="text-3xl font-black text-slate-900">{fmtMoney(item.amount)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <StatusBadge status={item.status} />
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                {item.wallet_type || 'General'} Wallet
              </span>
            </div>
          </div>

          {/* Conditional Reason Banners */}
          {item.status?.toLowerCase() === 'declined' && item.decline_reason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-1">
              <span className="text-[11px] font-black text-red-800 uppercase tracking-wide flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-600" /> Decline Reason
              </span>
              <p className="text-xs text-red-950 font-bold leading-relaxed">{item.decline_reason}</p>
            </div>
          )}

          {/* Proof of Payment Document */}
          {item.proof_of_payment && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-900 uppercase flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-600" /> Uploaded Proof
                </span>
              </div>
              <a href={item.proof_of_payment} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors shadow-sm">
                <span className="text-xs font-bold truncate max-w-[250px]">View Document</span>
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
              </a>
            </div>
          )}

          {/* Profile Breakdown */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credited To</h4>
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3.5">
                {person?.image_url ? (
                  <img src={person.image_url} alt={personName} className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-lg">
                    {personName.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-base truncate">{personName}</p>
                  <p className="text-xs font-bold text-slate-500">{regNo || 'No ID assigned'}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">{person?.current_class_name || '—'} {person?.current_class_section_name ? `(${person.current_class_section_name})` : ''}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Trail */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Details</h4>
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm bg-white shadow-sm">
              <div className="p-3.5 flex justify-between"><span className="text-slate-500 font-medium">Channel Mode</span><span className="font-bold capitalize text-slate-800">{item.mode}</span></div>
              <div className="p-3.5 flex justify-between"><span className="text-slate-500 font-medium">Method</span><span className="font-bold capitalize text-slate-800">{item.method}</span></div>
              {item.teller_number && (
                <div className="p-3.5 flex justify-between"><span className="text-slate-500 font-medium">Teller Number</span><span className="font-mono font-bold text-slate-800">{item.teller_number}</span></div>
              )}
              <div className="p-3.5 flex justify-between"><span className="text-slate-500 font-medium">Date Initiated</span><span className="font-bold text-slate-800">{formatDate(item.created_at)}</span></div>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end flex-shrink-0">
          {(item.status === 'confirmed' || item.status === 'reverted') && (
            <button onClick={() => triggerPrintReceipt(item, schoolName)} className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm w-full sm:w-auto justify-center">
              <Printer className="h-4 w-4" /> Print Official Receipt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Transaction Card ───────────────────────────────────────────────────
function TransactionCard({ item, onSelect }: { item: any; onSelect: () => void }) {
  const meta = statusMeta(item.status);
  const personName = toTitleCase(item.student?.full_name || `${item.student?.first_name || ''} ${item.student?.last_name || ''}`.trim());
  const isCanteen = item.wallet_type?.toLowerCase() === 'canteen';

  return (
    <button onClick={onSelect} className="w-full flex items-stretch gap-0 bg-white rounded-xl border border-slate-200 overflow-hidden text-left active:scale-[0.99] transition-transform">
      <div className={`w-1 shrink-0 ${meta.dot}`} />
      <div className="flex-1 flex items-center gap-3 p-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${isCanteen ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>
          {isCanteen ? <UtensilsCrossed className="h-4 w-4" /> : personName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-sm text-slate-800 truncate">{personName}</p>
            <p className="font-black text-sm text-slate-900 shrink-0">{fmtMoney(item.amount)}</p>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[11px] text-slate-400 font-medium truncate capitalize">{item.wallet_type} wallet · {formatDateShort(item.created_at)}</span>
            <span className={`text-[9px] font-black uppercase tracking-wider shrink-0 ${meta.color}`}>{meta.label}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ParentWalletHistoryPage() {
  const router = useRouter();

  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [walletTypeFilter, setWalletTypeFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const hasActiveFilters = Boolean(statusFilter || walletTypeFilter);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (walletTypeFilter) params.wallet_type = walletTypeFilter;

      // Ensure your backend allows IsParentOwner and filters by parent's wards for this endpoint!
      const response = await studentFundingAPI.list(params);
      const results = Array.isArray(response) ? response : response?.results ?? response?.data ?? [];
      const totalCount = typeof response?.count === 'number' ? response.count : results.length;

      setData(results);
      setTotal(totalCount);
    } catch (err) {
      console.error("Failed to fetch wallet history:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, walletTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { schoolInfoAPI.get().then(setSchoolInfo).catch(() => {}); }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-12 space-y-4 animate-in fade-in duration-300">

      {/* Slide-out Drawer */}
      <AuditDrawer item={selectedItem} onClose={() => setSelectedItem(null)} schoolName={schoolInfo?.name} />

      {/* Controls card — groups title, CTA and filters as one unit, separate from the data below.
          Kept intentionally thin (p-4, no big button, no separate cards per row) so it doesn't
          reintroduce the old bulk. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-200 shrink-0">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">Wallet Funding</h1>
              <p className="text-[11px] font-medium text-slate-500 truncate">Deposits &amp; top-ups across your wards</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/parent/wallet/fund')}
            className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-sm shadow-indigo-200 shrink-0 transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Fund
          </button>
        </div>

        {/* Filter Toolbar — one compact row, scrolls horizontally on very small screens instead of stacking */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
          <select value={walletTypeFilter} onChange={(e) => { setWalletTypeFilter(e.target.value); setPage(1); }} className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 shrink-0 min-w-[112px]">
            <option value="">All Wallets</option>
            <option value="canteen">Canteen</option>
            <option value="fee">Fee</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 shrink-0 min-w-[112px]">
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="declined">Declined</option>
          </select>
          {hasActiveFilters && (
            <button onClick={() => { setStatusFilter(''); setWalletTypeFilter(''); setPage(1); }} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0">
              <FilterX className="h-3.5 w-3.5" /> Clear
            </button>
          )}
          <button onClick={fetchData} className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 transition-colors shrink-0 ml-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Mobile: card list ── */}
      <div className="md:hidden space-y-2">
        {loading && page === 1 ? (
          <div className="py-14 text-center bg-white rounded-xl border border-slate-200"><Loader2 className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" /><p className="text-xs text-slate-400 font-medium">Loading records...</p></div>
        ) : data.length === 0 ? (
          <div className="py-14 text-center bg-white rounded-xl border border-slate-200 px-6">
            <Wallet className="h-9 w-9 text-slate-200 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">No funding records found.</p>
            <p className="text-xs text-slate-400 mt-1">Your wallet deposits and top-ups will appear here.</p>
          </div>
        ) : (
          data.map((item) => <TransactionCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} />)
        )}
      </div>

      {/* ── Desktop/tablet: table ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-5 py-3.5">Beneficiary</th>
                <th className="px-5 py-3.5">Wallet Type</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && page === 1 ? (
                <tr><td colSpan={6} className="py-14 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" /><p className="text-xs text-slate-400 font-medium">Loading records...</p></td></tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500">
                    <Wallet className="h-9 w-9 text-slate-200 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No funding records found.</p>
                    <p className="text-xs text-slate-400 mt-1">Your wallet deposits and top-ups will appear here.</p>
                  </td>
                </tr>
              ) : (
                data.map((item) => {
                  const personName = toTitleCase(item.student?.full_name || `${item.student?.first_name || ''} ${item.student?.last_name || ''}`.trim());
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-800">{personName}</p>
                        <p className="text-[11px] font-mono text-slate-400">{item.student?.registration_number || '—'}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-slate-100 text-slate-600">{item.wallet_type}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-black text-slate-900">{fmtMoney(item.amount)}</td>
                      <td className="px-5 py-3 text-center"><StatusBadge status={item.status} /></td>
                      <td className="px-5 py-3 text-xs font-medium text-slate-500">{formatDate(item.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(item.status === 'confirmed' || item.status === 'reverted') && (
                            <button onClick={() => triggerPrintReceipt(item, schoolInfo?.name)} title="Print Receipt" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setSelectedItem(item)} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 rounded-lg transition-colors shadow-sm flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" /> View
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
      </div>

      {/* Pagination Bar */}
      {!loading && Math.ceil(total / PAGE_SIZE) > 1 && (
        <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex items-center justify-between text-xs font-bold text-slate-500">
          <span>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}