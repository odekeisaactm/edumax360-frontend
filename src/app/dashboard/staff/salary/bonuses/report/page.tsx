'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { bonusesAPI, academicCalendarAPI } from '@/lib/api';
import {
  FileText, Printer, ChevronDown, CalendarDays, Loader2,
  AlertCircle, ArrowLeft, BarChart3, Users, RefreshCw, Check,
  Building2, X, UserCircle, Tags
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

function getImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function unwrapList(res: any): any[] {
  const data = res?.results?.data ?? res?.data?.results ?? res?.data ?? res?.results ?? res;
  return Array.isArray(data) ? data : [];
}

// ─── Constants ───────────────────────────────────────────────────────────────────
const now = new Date();
const currentMonth = String(now.getMonth() + 1);
const currentYear = String(now.getFullYear());

const MONTHS = [
  { value: '', label: 'All Months' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i).toLocaleString('default', { month: 'long' }) }))
];
const YEARS = [
  { value: '', label: 'All Years' },
  ...Array.from({ length: 5 }, (_, i) => ({ value: String(now.getFullYear() - 2 + i), label: String(now.getFullYear() - 2 + i) }))
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BonusReportPage() {
  const router = useRouter();
  const { hasPermission, user, schoolInfo } = useAuth();

  // ── Filters ──
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ── Lookups ──
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);

  // ── Data ──
  const [stats, setStats] = useState({ total_amount: 0, paid_amount: 0, unpaid_amount: 0 });
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [recipientBreakdown, setRecipientBreakdown] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(true);

  // ── Print Mode ──
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [printMode, setPrintMode] = useState<'recipient' | 'category' | 'combined' | null>(null);

  const canView = user?.is_superuser || hasPermission('salary_management.view_salaryrecordmodel');

  // ── Print Escape Key Listener ──
  useEffect(() => {
    if (!printMode) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setPrintMode(null); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printMode]);

  // ── Fetch Lookups ──
  useEffect(() => {
    academicCalendarAPI.listSessions().then((data: any) => setSessions(unwrapList(data))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSession) { setPeriods([]); setSelectedPeriod(''); return; }
    academicCalendarAPI.listSessionPeriods({ session_id: Number(selectedSession) })
      .then((data: any) => setPeriods(unwrapList(data)))
      .catch(() => setPeriods([]));
  }, [selectedSession]);

  // ── Generate Report ──
  const generateReport = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const params: Record<string, any> = { page_size: 10000 };
      if (month) params.month = month;
      if (year) params.year = year;
      if (statusFilter) params.status = statusFilter;
      if (selectedPeriod) params.academic_period = selectedPeriod;
      else if (selectedSession) params.session = selectedSession;

      const res = await bonusesAPI.list(params) as any;
      const bonuses = unwrapList(res);
      const resStats = res.stats || res.data?.stats || res.results?.stats || {};

      setStats({
          total_amount: Number(resStats.total_amount) || 0,
          paid_amount: Number(resStats.paid_amount) || 0,
          unpaid_amount: Number(resStats.unpaid_amount) || 0
      });
      setCategoryBreakdown(resStats.category_breakdown || []);
      setTotalCount(res.count ?? res.data?.count ?? res.results?.count ?? bonuses.length);

      // Client-side Recipient Grouping
      const recipients: Record<string, { type: string; total: number }> = {};
      bonuses.forEach((b: any) => {
        const name = b.type === 'staff'
          ? (b.staff_detail?.full_name || b.staff_name || 'Unknown Staff')
          : (b.volunteer_name || 'Unknown Volunteer');

        if (!recipients[name]) recipients[name] = { type: b.type, total: 0 };
        recipients[name].total += parseFloat(String(b.amount));
      });

      const sortedRecipients = Object.entries(recipients)
        .map(([name, r]) => ({ name, type: r.type, total: r.total }))
        .sort((a, b) => b.total - a.total);

      setRecipientBreakdown(sortedRecipients);
      setHasGenerated(true);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [month, year, statusFilter, selectedSession, selectedPeriod]);

  useEffect(() => { generateReport(); }, []);

  const handleSessionChange = (val: string) => {
    setSelectedSession(val);
    setSelectedPeriod('');
    if (val) { setMonth(''); setYear(''); }
  };

  const getFilterString = () => {
    const str = [];
    if (month) str.push(`Month: ${MONTHS.find(m => m.value === month)?.label}`);
    if (year) str.push(`Year: ${year}`);
    if (selectedSession) str.push(`Session: ${sessions.find((s: any) => String(s.id) === selectedSession)?.start_year}/${sessions.find((s: any) => String(s.id) === selectedSession)?.end_year}`);
    if (selectedPeriod) str.push(`Term: ${periods.find((p: any) => String(p.id) === selectedPeriod)?.period?.name}`);
    if (statusFilter) str.push(`Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`);
    return str.join(' • ') || 'All Time / All Records';
  };

  if (!canView) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertCircle className="h-7 w-7 text-red-400" /></div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to view bonus reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">

      {/* Print CSS constraints */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
          @page { margin: 15mm; size: A4 portrait; }
        }
      `}} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/staff/salary/bonuses')} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                <FileText className="h-5 w-5 text-white" />
              </div>
              Bonus Reports
            </h1>
            <p className="text-sm text-slate-400 mt-1 pl-12">Analyze bonus payouts by category and recipient</p>
          </div>
        </div>
      </div>

      {/* ── Filters Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3 w-full">
            <select value={selectedSession} onChange={e => handleSessionChange(e.target.value)} className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500 transition-all">
              <option value="">All Sessions</option>
              {sessions.map((s: any) => <option key={s.id} value={String(s.id)}>{s.start_year}/{s.end_year}</option>)}
            </select>
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} disabled={!selectedSession} className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 transition-all">
              <option value="">All Terms</option>
              {periods.map((p: any) => <option key={p.id} value={String(p.id)}>{p.period?.name || `Period ${p.id}`}</option>)}
            </select>
            <select value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500 transition-all">
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={year} onChange={e => setYear(e.target.value)} className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500 transition-all">
              {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500 transition-all">
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <button onClick={generateReport} disabled={loading} className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0 shadow-md shadow-blue-200">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /></> : <><RefreshCw className="h-4 w-4" /> Generate</>}
          </button>
        </div>
      </div>

      {pageError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{pageError}</p>
        </div>
      )}

      {/* ── Report Content ── */}
      {hasGenerated && !loading && !pageError && (
        <>
          {/* Header row: Stats & Export */}
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              {[
                { label: 'Total Amount', value: fmtMoney(stats.total_amount), color: 'from-blue-500 to-blue-600', icon: BarChart3 },
                { label: 'Paid Amount', value: fmtMoney(stats.paid_amount), color: 'from-emerald-500 to-teal-600', icon: Check },
                { label: 'Unpaid Amount', value: fmtMoney(stats.unpaid_amount), color: 'from-amber-400 to-orange-500', icon: AlertCircle },
                { label: 'Total Records', value: totalCount, color: 'from-violet-500 to-purple-600', icon: Users },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}><Icon className="h-5 w-5 text-white" /></div>
                  <div className="min-w-0"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate mb-0.5">{label}</p><p className="text-xl font-black text-slate-800 truncate tabular-nums">{value}</p></div>
                </div>
              ))}
            </div>

            <div className="relative flex-shrink-0 w-full lg:w-auto">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold rounded-2xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
                <Printer className="h-4 w-4" /> Print Report <ChevronDown className="h-4 w-4" />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-14 z-20 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 flex flex-col">
                    <button onClick={() => { setShowExportMenu(false); setPrintMode('combined'); }} className="text-left px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors">Comprehensive Report</button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button onClick={() => { setShowExportMenu(false); setPrintMode('recipient'); }} className="text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Recipient List Only</button>
                    <button onClick={() => { setShowExportMenu(false); setPrintMode('category'); }} className="text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Category List Only</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tables: Stacked Full Width */}
          <div className="space-y-6">

            {/* Category Breakdown Table */}
            {categoryBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Tags className="h-4 w-4 text-violet-600" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Category Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80">
                        <th className="text-left px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Category</th>
                        <th className="text-center px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Count</th>
                        <th className="text-right px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {categoryBreakdown.map((cat, i) => (
                        <tr key={i} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="px-5 py-3 font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{cat.name}</td>
                          <td className="px-5 py-3 text-center text-slate-500 font-medium">{cat.count || 0}</td>
                          <td className="px-5 py-3 text-right font-black text-slate-800 tabular-nums">{fmtMoney(cat.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recipient Breakdown Table */}
            {recipientBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Top Recipients</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80">
                        <th className="text-left px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide w-16">Rank</th>
                        <th className="text-left px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Recipient Name</th>
                        <th className="text-center px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide w-32">Type</th>
                        <th className="text-right px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {recipientBreakdown.map((rec, i) => (
                        <tr key={rec.name} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">#{i + 1}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${rec.type === 'staff' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                {rec.type === 'staff' ? <UserCircle className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                              </div>
                              <span className="font-bold text-slate-800">{rec.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {rec.type === 'staff'
                              ? <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-md">Staff</span>
                              : <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wider rounded-md">Vol</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-slate-800 tabular-nums text-[15px]">{fmtMoney(rec.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50/30 border-t border-blue-100">
                        <td colSpan={3} className="px-5 py-4 text-right font-black text-blue-800 uppercase text-[11px] tracking-widest">
                          Grand Total
                        </td>
                        <td className="px-5 py-4 text-right font-black text-blue-900 tabular-nums text-lg">
                          {fmtMoney(stats.total_amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── IN-DOM PRINT OVERLAY ── */}
      {printMode && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full">

            {/* Action bar — hidden on print */}
            <div className="print:hidden flex justify-between items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <button onClick={() => setPrintMode(null)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
                <X className="w-4 h-4" /> Close
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-sm transition-colors">
                <Printer className="w-3.5 h-3.5" /> Print Document
              </button>
            </div>

            <div className="p-8 print:p-0 text-slate-900 print:text-black">
              {/* Letterhead */}
              <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 mb-6">
                {schoolInfo?.logo ? (
                  <img src={getImageUrl(schoolInfo.logo)} alt="" className="h-16 w-16 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Building2 className="h-8 w-8 text-slate-400" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-black uppercase tracking-wide text-slate-900 truncate">{schoolInfo?.name || 'School Name Not Set'}</h1>
                  <p className="text-[12px] font-medium text-slate-600 truncate">{schoolInfo?.address || 'Address not configured'}</p>
                  <p className="text-[12px] font-medium text-slate-600">{[schoolInfo?.email, schoolInfo?.mobile_1].filter(Boolean).join(' • ')}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Report Type</p>
                  <span className="text-[12px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 whitespace-nowrap">
                    Bonus {printMode === 'combined' ? 'Summary' : printMode === 'recipient' ? 'Recipients' : 'Categories'}
                  </span>
                </div>
              </div>

              {/* Meta Data */}
              <div className="mb-6 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Report Parameters Applied</p>
                <p className="text-sm font-semibold text-slate-800">{getFilterString()}</p>
              </div>

              {/* Top Stats Summary */}
              <div className="grid grid-cols-4 gap-0 border-y border-slate-300 divide-x divide-slate-300 mb-8">
                <div className="p-3 text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Dispensed</p>
                  <p className="text-lg font-black text-slate-900 tabular-nums">{fmtMoney(stats.total_amount)}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Paid</p>
                  <p className="text-lg font-black text-slate-900 tabular-nums">{fmtMoney(stats.paid_amount)}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Unpaid / Pending</p>
                  <p className="text-lg font-black text-slate-900 tabular-nums">{fmtMoney(stats.unpaid_amount)}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Records</p>
                  <p className="text-lg font-black text-slate-900 tabular-nums">{totalCount}</p>
                </div>
              </div>

              {/* Category Table */}
              {(printMode === 'combined' || printMode === 'category') && categoryBreakdown.length > 0 && (
                <div className="mb-8 break-inside-avoid">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3 border-b-2 border-slate-800 pb-1 inline-block">Category Distribution</h2>
                  <table className="w-full text-sm border-collapse border border-slate-300">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-300 px-4 py-2 text-left font-bold text-slate-800 uppercase text-[11px] tracking-wider">Category</th>
                        <th className="border border-slate-300 px-4 py-2 text-center font-bold text-slate-800 uppercase text-[11px] tracking-wider w-24">Count</th>
                        <th className="border border-slate-300 px-4 py-2 text-right font-bold text-slate-800 uppercase text-[11px] tracking-wider w-40">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryBreakdown.map(cat => (
                        <tr key={cat.name}>
                          <td className="border border-slate-300 px-4 py-2 text-slate-800">{cat.name}</td>
                          <td className="border border-slate-300 px-4 py-2 text-center text-slate-800">{cat.count || 0}</td>
                          <td className="border border-slate-300 px-4 py-2 text-right font-bold text-slate-900 tabular-nums">{fmtMoney(cat.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recipient Table */}
              {(printMode === 'combined' || printMode === 'recipient') && recipientBreakdown.length > 0 && (
                <div className="break-inside-avoid">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3 border-b-2 border-slate-800 pb-1 inline-block">Recipient Distribution</h2>
                  <table className="w-full text-sm border-collapse border border-slate-300">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-300 px-4 py-2 text-center font-bold text-slate-800 uppercase text-[11px] tracking-wider w-12">S/N</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-bold text-slate-800 uppercase text-[11px] tracking-wider">Name</th>
                        <th className="border border-slate-300 px-4 py-2 text-center font-bold text-slate-800 uppercase text-[11px] tracking-wider w-24">Type</th>
                        <th className="border border-slate-300 px-4 py-2 text-right font-bold text-slate-800 uppercase text-[11px] tracking-wider w-40">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipientBreakdown.map((rec, i) => (
                        <tr key={rec.name}>
                          <td className="border border-slate-300 px-4 py-2 text-center text-slate-500">{i + 1}</td>
                          <td className="border border-slate-300 px-4 py-2 font-medium text-slate-800">{rec.name}</td>
                          <td className="border border-slate-300 px-4 py-2 text-center text-slate-600">{rec.type === 'staff' ? 'Staff' : 'Volunteer'}</td>
                          <td className="border border-slate-300 px-4 py-2 text-right font-bold text-slate-900 tabular-nums">{fmtMoney(rec.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100">
                        <td colSpan={3} className="border border-slate-300 px-4 py-2 text-right font-black text-slate-800 uppercase text-[11px] tracking-wider">Grand Total</td>
                        <td className="border border-slate-300 px-4 py-2 text-right font-black text-slate-900 tabular-nums text-base">{fmtMoney(stats.total_amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t-2 border-slate-200 pt-4">
                This is a computer-generated report. <br />
                <span className="mt-1 block text-slate-500">Generated: {now.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}