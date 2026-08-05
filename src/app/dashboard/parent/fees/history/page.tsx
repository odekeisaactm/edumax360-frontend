'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, Clock, CheckCircle2, XCircle, RotateCcw,
  Printer, FileText, Eye, X, Loader2, Building2, AlertCircle, CalendarRange
} from 'lucide-react';
import { feeAPI, schoolInfoAPI } from '@/lib/api';

// ─── Helpers & Types ──────────────────────────────────────────────────────────
function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string | null): string {
  if (!str) return '—';
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

function smartTitleCase(str: string): string {
  if (!str) return '';
  return str
    .split(' ')
    .filter(Boolean)
    .map(word => {
      if (/^[A-Z]{2,6}$/.test(word)) return word; // keep acronyms like PTA, ICT as-is
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
  if (!mode) return 'Online / Wallet';
  return smartTitleCase(mode.replace(/_/g, ' '));
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

// Groups a payment's allocations by the group_name the backend already computes
// (e.g. "Chisom Chisom • LEA-0021" or "Family Shared Fees") so a payment covering
// several students shows one card per student instead of one flat list.
function groupAllocations(payment: any) {
  if (!payment?.allocations) return {};
  return payment.allocations.reduce((acc: any, curr: any) => {
    const groupName = curr.group_name || 'Other';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(curr);
    return acc;
  }, {});
}

// A payment always belongs to a single session/term (multiple invoices, same period).
// wallet_funding allocations don't carry session info, so we scan for the first
// allocation whose hover_detail actually has it.
function parseSessionTerm(payment: any): { session: string; term: string; label: string } {
  const withPeriod = payment?.allocations?.find((a: any) => a.hover_detail?.startsWith('Session:'));
  if (!withPeriod) return { session: '—', term: '—', label: 'Unspecified' };
  const match = withPeriod.hover_detail.match(/Session:\s*(.+?)\s*\|\s*Term:\s*(.+)/);
  if (!match) return { session: '—', term: '—', label: 'Unspecified' };
  const session = match[1].trim();
  const term = smartTitleCase(match[2].trim());
  return { session, term, label: `${session} · ${term}` };
}

// ─── Status Badge Component ───────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { label: 'Failed', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: <XCircle className="h-3 w-3" /> },
    reverted: { label: 'Reverted', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: <RotateCcw className="h-3 w-3" /> },
  };
  const meta = map[status?.toLowerCase() || 'pending'] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function ParentPaymentsPage() {
  const router = useRouter();

  const [payments, setPayments] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [printPayment, setPrintPayment] = useState<any | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage };
      if (statusFilter) params.status = statusFilter;

      const res = await feeAPI.getReceipts(params);

      let finalResults: any[] = [];
      if (Array.isArray(res)) finalResults = res;
      else if (res?.results && Array.isArray(res.results)) {
        finalResults = res.results;
        setTotalPages(Math.max(1, Math.ceil((res.count || res.results.length) / (res.page_size || 50))));
      }
      setPayments(finalResults);
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchPayments(); }, 300);
    return () => clearTimeout(timer);
  }, [fetchPayments]);

  useEffect(() => {
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => {});
  }, []);

  useEffect(() => {
    if (!printPayment) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setPrintPayment(null); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printPayment]);

  // Session/term options are derived from whatever's currently loaded on this page —
  // there's no backend filter param for it yet, so this only filters the visible page.
  const periodsByPayment = useMemo(() => {
    const map = new Map<number, ReturnType<typeof parseSessionTerm>>();
    payments.forEach(p => map.set(p.id, parseSessionTerm(p)));
    return map;
  }, [payments]);

  const availableSessions = useMemo(() => {
    return Array.from(new Set(Array.from(periodsByPayment.values()).map(p => p.session))).filter(s => s !== '—');
  }, [periodsByPayment]);

  const availableTerms = useMemo(() => {
    const terms = Array.from(periodsByPayment.values())
      .filter(p => !sessionFilter || p.session === sessionFilter)
      .map(p => p.term);
    return Array.from(new Set(terms)).filter(t => t !== '—');
  }, [periodsByPayment, sessionFilter]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const period = periodsByPayment.get(p.id);
      if (sessionFilter && period?.session !== sessionFilter) return false;
      if (termFilter && period?.term !== termFilter) return false;
      return true;
    });
  }, [payments, periodsByPayment, sessionFilter, termFilter]);

  const printPeriod = useMemo(() => printPayment ? parseSessionTerm(printPayment) : null, [printPayment]);
  const printGroupedAllocations = useMemo(() => groupAllocations(printPayment), [printPayment]);

  // Most browsers default the print/"Save as PDF" filename to document.title,
  // so we set it to something meaningful just before printing and restore it after.
  const handlePrint = () => {
    if (!printPayment) return;
    const name = toTitleCase(printPayment.student_name || printPayment.parent_name);
    const period = printPeriod?.label || '';
    const originalTitle = document.title;
    const safeTitle = `Receipt - ${name} - ${period}`.replace(/[\\/:*?"<>|]/g, '-');
    document.title = safeTitle;
    const restore = () => { document.title = originalTitle; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-12 space-y-6 animate-in fade-in duration-300">

      {/* ── Print CSS Isolation ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #receipt-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border: none !important; max-height: none !important; padding: 10px !important; }
          @page { margin: 1cm; size: A4 portrait; }
        }
      `}} />

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Payment History</h1>
          <p className="text-xs font-medium text-slate-500 mt-1">Track your online payments and bank transfer uploads.</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/parent/fees/checkout')}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors shadow-md w-full sm:w-auto"
        >
          <Upload className="h-4 w-4" /> Upload Payment Proof
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <CalendarRange className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select
            value={sessionFilter}
            onChange={(e) => { setSessionFilter(e.target.value); setTermFilter(''); }}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
          >
            <option value="">All Sessions</option>
            {availableSessions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <select
          value={termFilter}
          onChange={(e) => setTermFilter(e.target.value)}
          disabled={!availableTerms.length}
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48 disabled:opacity-50"
        >
          <option value="">All Terms</option>
          {availableTerms.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
        >
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="reverted">Declined</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-5 py-4">Transaction Date</th>
                <th className="px-5 py-4">Session / Term</th>
                <th className="px-5 py-4 text-right">Amount</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /><p className="text-xs font-medium">Loading history...</p></td></tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="font-bold">No payment records found.</p>
                      <p className="text-xs">Your uploaded payment proofs will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const period = periodsByPayment.get(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-600">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-800">{period?.session}</p>
                        <p className="text-xs font-medium text-slate-500">{period?.term}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-slate-900">{formatCurrency(p.total_amount)}</td>
                      <td className="px-5 py-3.5 text-center"><StatusBadge status={p.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.proof_of_payment && (
                            <a
                              href={getImageUrl(p.proof_of_payment)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="View Uploaded Document"
                            >
                              <Upload className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => setPrintPayment(p)}
                            className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Receipt
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

        {!loading && totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Prev</button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>


      {/* ── OFFICIAL RECEIPT MODAL ── */}
      {printPayment && (
        <div onClick={() => setPrintPayment(null)} className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">

          <div id="receipt-print-area" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl border border-slate-300 shadow-2xl relative print:shadow-none print:border-none print:w-full">

            {/* Controls — in-flow header, not floated outside the card, so it never clips */}
            <div className="print:hidden flex justify-end gap-2 px-6 py-3 bg-slate-50 border-b border-slate-200">
              <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow hover:bg-indigo-700 flex items-center gap-1.5"><Printer className="w-4 h-4"/> Print Receipt</button>
              <button onClick={() => setPrintPayment(null)} className="px-4 py-2 bg-white text-slate-700 border border-slate-200 text-xs font-bold rounded-lg shadow-sm hover:bg-slate-50 flex items-center gap-1.5"><X className="w-4 h-4"/> Close</button>
            </div>

            <div className="p-6 sm:p-10 relative">

              {/* Watermark — centered on the card, not clipped, readable through section backgrounds */}
              {printPayment.status === 'confirmed' && (
                <div className="absolute inset-0 flex items-center justify-center z-0 select-none pointer-events-none">
                  <span className="-rotate-[15deg] text-[6rem] sm:text-[9rem] font-black text-emerald-600/25 border-8 border-emerald-600/30 px-8 py-2 rounded-2xl tracking-widest">
                    PAID
                  </span>
                </div>
              )}
              {printPayment.status === 'reverted' && (
                <div className="absolute inset-0 flex items-center justify-center z-0 select-none pointer-events-none">
                  <span className="-rotate-[15deg] text-[5rem] sm:text-[7rem] font-black text-rose-600/25 border-8 border-rose-600/30 px-8 py-2 rounded-2xl tracking-widest">
                    DECLINED
                  </span>
                </div>
              )}

              {/* Letterhead — logo beside details, conserves vertical space */}
              <div className="flex items-center gap-4 border-b-2 border-black pb-4 mb-5 relative z-10">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="School Logo" className="h-16 w-16 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-16 w-16 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                    <Building2 className="w-8 h-8 text-slate-400"/>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide text-black truncate">{schoolInfo?.name || 'SCHOOL NAME'}</h2>
                  <p className="text-xs font-medium text-slate-700 truncate">{schoolInfo?.address || 'School Address not set'}</p>
                  <p className="text-xs font-medium text-slate-700">{[schoolInfo?.email, schoolInfo?.mobile_1].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 whitespace-nowrap">
                  Official Receipt
                </span>
              </div>

              {/* Receipt Meta */}
              <div className="flex justify-between items-center text-xs font-bold text-black mb-4 relative z-10">
                <div>Receipt No: {printPayment.reference}</div>
                <div>Date: {formatDate(printPayment.created_at)}</div>
              </div>

              {/* Received From — image + name side by side */}
              <div className="border border-slate-300 rounded mb-4 relative z-10 bg-white/85">
                <div className="bg-slate-100/80 border-b border-slate-300 px-4 py-1.5 font-bold text-xs text-slate-900">Received From</div>
                <div className="p-3 flex items-center gap-3">
                  {(printPayment.student_image_url || printPayment.parent_image_url) ? (
                    <img src={getImageUrl(printPayment.student_image_url || printPayment.parent_image_url)} alt="" className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg shrink-0">
                      {toTitleCase(printPayment.student_name || printPayment.parent_name).charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h5 className="text-base font-black text-slate-900 truncate">{toTitleCase(printPayment.student_name || printPayment.parent_name)}</h5>
                    <p className="text-xs text-slate-700">
                      {printPayment.parent ? 'Family / Parent' : 'Student'}
                      {!printPayment.parent && printPayment.student_class_full && <> · {printPayment.student_class_full}</>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Primary Payment Table */}
              <table className="w-full border-collapse border border-slate-300 text-xs mb-4 relative z-10">
                <tbody>
                  <tr>
                    <th className="border border-slate-300 px-3 py-2 text-left bg-slate-100/80 w-1/3 text-slate-900">Amount Paid</th>
                    <td className="border border-slate-300 px-3 py-2 font-black text-slate-900 text-sm bg-white/80">{formatCurrency(printPayment.total_amount)}</td>
                  </tr>
                  {printPayment.amount_in_words && (
                    <tr>
                      <th className="border border-slate-300 px-3 py-1.5 text-left bg-slate-100/80 text-slate-900">In Words</th>
                      <td className="border border-slate-300 px-3 py-1.5 italic text-slate-800 bg-white/80">{printPayment.amount_in_words}</td>
                    </tr>
                  )}
                  <tr>
                    <th className="border border-slate-300 px-3 py-1.5 text-left bg-slate-100/80 text-slate-900">Payment Method</th>
                    <td className="border border-slate-300 px-3 py-1.5 text-slate-800 bg-white/80">{formatPaymentMode(printPayment.external_payment_mode)}</td>
                  </tr>
                  <tr>
                    <th className="border border-slate-300 px-3 py-1.5 text-left bg-slate-100/80 text-slate-900">Academic Term</th>
                    <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-900 bg-white/80">{printPeriod?.label}</td>
                  </tr>
                  {printPayment.notes && (
                    <tr>
                      <th className="border border-slate-300 px-3 py-1.5 text-left bg-slate-100/80 text-slate-900">Notes</th>
                      <td className="border border-slate-300 px-3 py-1.5 text-slate-800 bg-white/80">{printPayment.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Fees Settled — grouped by student, matching the accountant layout */}
              <div className="border border-slate-300 rounded mb-4 relative z-10 bg-slate-50/70 overflow-hidden">
                <div className="bg-slate-100/80 border-b border-slate-300 px-4 py-1.5 font-bold text-xs text-slate-900">Fee Allocation Summary</div>
                <div className="p-3 space-y-2.5">
                  {Object.entries(printGroupedAllocations).map(([groupName, items]: [string, any]) => {
                    const subtotal = items.reduce((s: number, i: any) => s + parseFloat(i.amount), 0);
                    return (
                      <div key={groupName} className="border border-slate-200 rounded-lg overflow-hidden bg-white/80">
                        <div className="px-3 py-1.5 bg-slate-100/80 border-b border-slate-200 flex justify-between items-center">
                          <span className="text-[11px] font-black text-slate-700">{groupName}</span>
                          <span className="text-[11px] font-black text-indigo-600">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="px-3 py-1.5 space-y-1">
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
                    <p className="text-xs text-center text-slate-500 italic py-2">No detailed allocations recorded.</p>
                  )}
                </div>
                <div className="border-t border-slate-300 px-4 py-2 flex justify-between items-center bg-white/80">
                  <span className="text-xs font-black text-slate-900">Total Settled</span>
                  <span className="text-sm font-black text-slate-900">{formatCurrency(printPayment.total_amount)}</span>
                </div>
              </div>

              {/* Status Alert */}
              <div className="relative z-10 mb-6">
                {printPayment.status === 'confirmed' ? (
                  <div className="bg-emerald-50/80 border border-emerald-300 text-emerald-900 px-3 py-2.5 rounded text-xs flex items-start gap-2 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      <strong className="block mb-0.5">Payment Confirmed & Ledger Updated</strong>
                      This transaction has been verified by the finance office and applied to your account.
                    </div>
                  </div>
                ) : printPayment.status === 'pending' ? (
                  <div className="bg-amber-50/80 border border-amber-300 text-amber-900 px-3 py-2.5 rounded text-xs flex items-start gap-2 shadow-sm">
                    <Clock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong className="block mb-0.5">Proof Under Review</strong>
                      Your payment proof is awaiting verification by the school accountant.
                    </div>
                  </div>
                ) : (
                  <div className="bg-rose-50/80 border border-rose-300 text-rose-900 px-3 py-2.5 rounded text-xs flex items-start gap-2 shadow-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <strong className="block mb-0.5">Payment Declined</strong>
                      Reason: {printPayment.reversal_reason || 'No reason provided.'}
                    </div>
                  </div>
                )}
              </div>

              {/* Signatures — accountant signature image if available on their staff document */}
              <div className="flex justify-between items-end px-4 sm:px-12 relative z-10">
                <div className="text-center w-5/12 sm:w-1/3">
                  {/* NOTE: confirm the actual field name from the staff-document serializer before shipping */}
                  {printPayment.confirmed_by_signature_url ? (
                    <img src={getImageUrl(printPayment.confirmed_by_signature_url)} alt="Signature" className="h-10 mx-auto mb-1 object-contain" />
                  ) : (
                    <hr className="border-black mb-2" />
                  )}
                  <p className="text-[11px] font-bold text-black">Issued By: {printPayment.confirmed_by_full_name || 'Finance Office'}</p>
                </div>
                <div className="text-center w-5/12 sm:w-1/3">
                  <hr className="border-black mb-2" />
                  <p className="text-[11px] font-bold text-black">Signature & Stamp</p>
                </div>
              </div>

              <div className="mt-6 text-center bg-slate-50/80 border border-slate-200 p-2.5 rounded text-[10px] text-slate-600 relative z-10">
                <strong>Note:</strong> This receipt confirms payment received by the school. Please keep it for your records.
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}