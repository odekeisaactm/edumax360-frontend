'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { bonusesAPI, academicCalendarAPI } from '@/lib/api';
import {
  FileText, Printer, Download, ChevronDown, CalendarDays, Loader2,
  AlertCircle, ArrowLeft, BarChart3, Users, RefreshCw, Check
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

// ─── Print Engine ────────────────────────────────────────────────────────────────
const generatePrintHTML = (type: 'recipient' | 'category' | 'combined', data: any, filters: any) => {
  const printCSS = `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000; padding: 40px 40px 20px 40px; position: relative; }
      h1 { text-align: center; margin-bottom: 5px; font-size: 24px; }
      h3 { text-align: center; margin-top: 0; color: #555; font-weight: normal; font-size: 14px; margin-bottom: 40px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
      th, td { border: 1px solid #333; padding: 10px 12px; text-align: left; }
      th { background-color: #f4f4f4; font-weight: 600; }
      tr:nth-child(even) { background-color: #fafafa; }
      .text-right { text-align: right; }
      .stats-grid { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 20px; }
      .stat-box { border: 1px solid #333; padding: 15px; flex: 1; text-align: center; }
      .stat-box h4 { margin: 0 0 5px 0; font-size: 14px; color: #555; }
      .stat-box p { margin: 0; font-size: 20px; font-weight: bold; }
      .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ccc; padding-top: 10px; }
      .close-btn { position: absolute; top: 20px; right: 20px; padding: 6px 16px; border: 1px solid #ccc; background: #f9f9f9; cursor: pointer; font-size: 14px; border-radius: 4px; }
      .close-btn:hover { background: #e9e9e9; }
      @media print { .no-print { display: none !important; } body { padding: 20px; } }
    </style>
  `;

  const getFilterString = () => {
    let str = [];
    if (filters.month) str.push(`Month: ${MONTHS.find(m=>m.value===filters.month)?.label}`);
    if (filters.year) str.push(`Year: ${filters.year}`);
    if (filters.sessionLabel) str.push(`Session: ${filters.sessionLabel}`);
    if (filters.periodLabel) str.push(`Term: ${filters.periodLabel}`);
    if (filters.status) str.push(`Status: ${filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}`);
    return str.join(' | ') || 'All Data';
  };

  if (type === 'recipient') {
    return `
      <!DOCTYPE html><html><head><title>Recipient Report</title>${printCSS}</head><body>
        <button class="close-btn no-print" onclick="window.close()">Close</button>
        <h1>Bonus Report (By Recipient)</h1>
        <h3>${getFilterString()}</h3>
        <table>
          <thead><tr><th>S/N</th><th>Recipient Name</th><th>Type</th><th class="text-right">Total Amount</th></tr></thead>
          <tbody>
            ${data.recipientBreakdown.map((r: any, i: number) => `
              <tr>
                <td>${i + 1}</td>
                <td>${r.name}</td>
                <td>${r.type === 'staff' ? 'Staff' : 'Volunteer'}</td>
                <td class="text-right">${fmtMoney(r.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">Generated on ${new Date().toLocaleString()}</div>
      </body></html>
    `;
  }

  if (type === 'category') {
    return `
      <!DOCTYPE html><html><head><title>Category Breakdown</title>${printCSS}</head><body>
        <button class="close-btn no-print" onclick="window.close()">Close</button>
        <h1>Bonus Report (By Category)</h1>
        <h3>${getFilterString()}</h3>
        <table>
          <thead><tr><th>Category</th><th class="text-right">Count</th><th class="text-right">Total Amount</th></tr></thead>
          <tbody>
            ${data.categoryBreakdown.map((c: any) => `
              <tr>
                <td>${c.name}</td>
                <td class="text-right">${c.count || 0}</td>
                <td class="text-right">${fmtMoney(c.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">Generated on ${new Date().toLocaleString()}</div>
      </body></html>
    `;
  }

  return `
    <!DOCTYPE html><html><head><title>Combined Bonus Report</title>${printCSS}</head><body>
      <button class="close-btn no-print" onclick="window.close()">Close</button>
      <h1>Comprehensive Bonus Report</h1>
      <h3>${getFilterString()}</h3>

      <div class="stats-grid">
        <div class="stat-box"><h4>Total Amount</h4><p>${fmtMoney(data.stats.total_amount)}</p></div>
        <div class="stat-box"><h4>Paid Amount</h4><p>${fmtMoney(data.stats.paid_amount)}</p></div>
        <div class="stat-box"><h4>Unpaid Amount</h4><p>${fmtMoney(data.stats.unpaid_amount)}</p></div>
        <div class="stat-box"><h4>Total Count</h4><p>${data.totalCount}</p></div>
      </div>

      <h2 style="font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 5px;">Category Breakdown</h2>
      <table>
        <thead><tr><th>Category</th><th class="text-right">Count</th><th class="text-right">Total Amount</th></tr></thead>
        <tbody>
          ${data.categoryBreakdown.map((c: any) => `
            <tr><td>${c.name}</td><td class="text-right">${c.count || 0}</td><td class="text-right">${fmtMoney(c.total)}</td></tr>
          `).join('')}
        </tbody>
      </table>

      <h2 style="font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">Recipient Breakdown</h2>
      <table>
        <thead><tr><th>S/N</th><th>Recipient Name</th><th>Type</th><th class="text-right">Total Amount</th></tr></thead>
        <tbody>
          ${data.recipientBreakdown.map((r: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td>${r.name}</td>
              <td>${r.type === 'staff' ? 'Staff' : 'Volunteer'}</td>
              <td class="text-right">${fmtMoney(r.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">Generated on ${new Date().toLocaleString()}</div>
    </body></html>
  `;
};

const handlePrint = (type: 'recipient' | 'category' | 'combined', data: any, filters: any) => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(generatePrintHTML(type, data, filters));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BonusReportPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  // ── Filters (Defaults to Current Month/Year for initial load) ──
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
  const [hasGenerated, setHasGenerated] = useState(true); // True initially because we load on mount

  // ── Export Dropdown ──
  const [showExportMenu, setShowExportMenu] = useState(false);

  const canView = user?.is_superuser || hasPermission('salary_management.view_salaryrecordmodel');

  // ── Fetch Lookups ──
  useEffect(() => {
    academicCalendarAPI.listSessions().then((data: any) => setSessions(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSession) { setPeriods([]); setSelectedPeriod(''); return; }
    academicCalendarAPI.listSessionPeriods({ session_id: Number(selectedSession) }).then((data: any) => {
      setPeriods(Array.isArray(data) ? data : (data?.results?.data || data?.data || []));
    }).catch(() => setPeriods([]));
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
      const bonuses = res.results || [];
      const resStats = res.stats || {};
      setStats({
          total_amount: Number(resStats.total_amount) || 0,
          paid_amount: Number(resStats.paid_amount) || 0,
          unpaid_amount: Number(resStats.unpaid_amount) || 0
      });
      setCategoryBreakdown(resStats.category_breakdown || []);
      setTotalCount(res.count || bonuses.length);

      // Client-side Recipient Breakdown Grouping
      const recipients: Record<string, { type: string; total: number }> = {};
      bonuses.forEach((b: any) => {
        // Safely resolve name (ignoring the ugly Django string for null staff)
        const name = b.type === 'staff'
          ? (b.staff_detail?.full_name || 'Unknown Staff')
          : (b.volunteer_name || 'Unknown Volunteer');

        if (!recipients[name]) recipients[name] = { type: b.type, total: 0 };
        recipients[name].total += parseFloat(String(b.amount));
      });

      const recipientEntries = Object.entries(recipients);
      const mappedRecipients = recipientEntries.map(([name, r]) => ({
        name, type: r.type, total: r.total
      }));
      const sortedRecipients = mappedRecipients.sort((a, b) => b.total - a.total);
      setRecipientBreakdown(sortedRecipients);

      setHasGenerated(true);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [month, year, statusFilter, selectedSession, selectedPeriod]);

  // ── Load on Mount ──
  useEffect(() => {
    generateReport();
  }, []);

  // ── Handle Session Selection (Clear Month/Year) ──
  const handleSessionChange = (val: string) => {
    setSelectedSession(val);
    setSelectedPeriod('');
    if (val) {
      setMonth('');
      setYear('');
    }
  };

  // ── Print / Export Handlers ──
  const currentFilters = {
    month, year, status: statusFilter,
    sessionLabel: sessions.find((s: any) => String(s.id) === selectedSession) ? `${sessions.find((s: any) => String(s.id) === selectedSession)?.start_year}/${sessions.find((s: any) => String(s.id) === selectedSession)?.end_year}` : null,
    periodLabel: periods.find((p: any) => String(p.id) === selectedPeriod)?.period?.name || null,
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
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200"><FileText className="h-5 w-5 text-white" /></div>
            Bonus Report
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Analyze bonus payouts by category and recipient</p>
        </div>
        <button onClick={() => router.push('/dashboard/staff/salary/bonuses')} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all"><ArrowLeft className="h-4 w-4" /> Back to List</button>
      </div>

      {/* ── Filters Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-500" /> Report Filters</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Session</label>
            <select value={selectedSession} onChange={e => handleSessionChange(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500">
              <option value="">All Sessions</option>
              {sessions.map((s: any) => <option key={s.id} value={String(s.id)}>{s.start_year}/{s.end_year}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Term</label>
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} disabled={!selectedSession} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500">
              <option value="">All Terms</option>
              {periods.map((p: any) => <option key={p.id} value={String(p.id)}>{p.period?.name || `Period ${p.id}`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500">
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Year</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500">
              {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-white text-slate-600 focus:ring-2 focus:ring-blue-500">
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <button onClick={generateReport} disabled={loading} className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-200">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><RefreshCw className="h-4 w-4" /> Generate Report</>}
          </button>
        </div>
      </div>

      {/* ── Error State ── */}
      {pageError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-3">{pageError}</p>
          <button onClick={generateReport} className="text-sm text-blue-600 underline inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
        </div>
      )}

      {/* ── Report Content ── */}
      {hasGenerated && !loading && !pageError && (
        <>
          {/* Stats Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Amount', value: fmtMoney(stats.total_amount), color: 'from-blue-500 to-blue-600', icon: BarChart3 },
              { label: 'Paid Amount', value: fmtMoney(stats.paid_amount), color: 'from-emerald-500 to-teal-600', icon: Check },
              { label: 'Unpaid Amount', value: fmtMoney(stats.unpaid_amount), color: 'from-amber-400 to-orange-500', icon: AlertCircle },
              { label: 'Total Count', value: totalCount, color: 'from-violet-500 to-purple-600', icon: Users },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}><Icon className="h-4 w-4 text-white" /></div>
                <div className="min-w-0"><p className="text-xs text-slate-400 truncate">{label}</p><p className="text-lg font-bold text-slate-800">{value}</p></div>
              </div>
            ))}
          </div>

          {/* Export Dropdown */}
          <div className="flex justify-end relative">
            <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
                <Printer className="h-4 w-4" /> Print / Export
                <ChevronDown className="h-4 w-4" />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-12 z-20 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 flex flex-col">
                    <button onClick={() => { setShowExportMenu(false); handlePrint('recipient', { stats, categoryBreakdown, recipientBreakdown, totalCount }, currentFilters); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                      <Users className="h-4 w-4 text-slate-400" /> Recipient List
                    </button>
                    <button onClick={() => { setShowExportMenu(false); handlePrint('category', { stats, categoryBreakdown, recipientBreakdown, totalCount }, currentFilters); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                      <BarChart3 className="h-4 w-4 text-slate-400" /> Category Breakdown
                    </button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button onClick={() => { setShowExportMenu(false); handlePrint('combined', { stats, categoryBreakdown, recipientBreakdown, totalCount }, currentFilters); }} className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 flex items-center gap-3">
                      <Download className="h-4 w-4" /> Combined Report
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Category Breakdown Table */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-700">Category Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/60 border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Count</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {categoryBreakdown.map((cat, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">{cat.name}</td>
                        <td className="px-5 py-3 text-right text-slate-600">{cat.count || 0}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">{fmtMoney(cat.total)}</td>
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
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-700">Recipient Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/60 border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-10">#</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Recipient Name</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Type</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recipientBreakdown.map((rec, i) => (
                      <tr key={rec.name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-5 py-3 font-medium text-slate-800">{rec.name}</td>
                        <td className="px-5 py-3 text-center">
                          {rec.type === 'staff'
                            ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-md">Staff</span>
                            : <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-md">Vol</span>
                          }
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">{fmtMoney(rec.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Footer Summary */}
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                      <td colSpan={3} className="px-5 py-3 text-slate-700">Total</td>
                      <td className="px-5 py-3 text-right text-slate-900">{fmtMoney(stats.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}