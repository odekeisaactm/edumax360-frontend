'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { payrollAPI, bonusesAPI, academicCalendarAPI, staffAPI } from '@/lib/api';
import {
  FileText, Search, X, RefreshCw, AlertCircle, Loader2, Printer,
  TrendingUp, TrendingDown, DollarSign, Shield, Percent, Gift,
  ChevronDown, ChevronUp, UserCircle, Calendar, BarChart3,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(amount: number | string | undefined | null): string {
  if (amount == null) return '₦0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function unwrapList(res: any): any[] {
  const data = res?.results?.data ?? res?.data?.results ?? res?.data ?? res?.results ?? res;
  return Array.isArray(data) ? data : [];
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear  = now.getFullYear();

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString('en-US', { month: 'long' }),
}));
const YEARS = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i);

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportMode = 'single' | 'range' | 'session';

interface ReportData {
  totalGrossSalary: number;
  basicComponents: Record<string, number>;
  allowances: Record<string, number>;
  additionalIncome: Record<string, number>;
  statutoryDeductions: Record<string, number>;
  otherDeductions: Record<string, number>;
  totalPayeTax: number;
  totalReliefs: number;
  totalTakeHome: number;
  totalPaid: number;
  totalPending: number;
  recordCount: number;
}

interface BonusData {
  staffTotal: number;
  volunteerTotal: number;
  total: number;
  categories: Record<string, number>;
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function ReportSection({ title, icon, iconBg, total, totalLabel, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; iconBg: string;
  total?: number; totalLabel?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${iconBg}`}>
            {icon}
          </div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {total !== undefined && (
            <span className="text-sm font-bold text-slate-700">{fmtMoney(total)}</span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────
function DataRow({ label, value, isTotal, highlight }: {
  label: string; value: string; isTotal?: boolean; highlight?: 'green' | 'red';
}) {
  return (
    <div className={`flex justify-between items-center py-2.5 px-3 rounded-lg text-sm
      ${isTotal ? 'bg-slate-50 border border-slate-100 font-bold' : 'border-b border-slate-50 last:border-0'}`}>
      <span className={isTotal ? 'text-slate-700' : 'text-slate-500'}>{label}</span>
      <span className={
        highlight === 'green' ? 'font-bold text-emerald-600' :
        highlight === 'red'   ? 'font-bold text-red-500' :
        isTotal               ? 'text-slate-800' :
        'font-medium text-slate-700'
      }>{value}</span>
    </div>
  );
}

// ─── Sub section ──────────────────────────────────────────────────────────────
function SubSection({ title, items }: { title: string; items: Record<string, number> }) {
  if (Object.keys(items).length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</p>
      <div className="space-y-1">
        {Object.entries(items).map(([name, amount]) => (
          <DataRow key={name} label={name} value={fmtMoney(amount)} />
        ))}
      </div>
    </div>
  );
}

// ─── Staff Picker ──────────────────────────────────────────────────────────────
function StaffPicker({ value, onChange }: {
  value: { id: number; name: string } | null;
  onChange: (staff: { id: number; name: string } | null) => void;
}) {
  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState<any[]>([]);
  const [showDrop, setShowDrop]     = useState(false);
  const [searching, setSearching]   = useState(false);
  const ref                         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!search) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await staffAPI.list({ search, page_size: 10, is_active: true }) as any;
        setResults(unwrapList(res));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={value ? value.name : search}
          onChange={e => { setSearch(e.target.value); onChange(null); setShowDrop(true); }}
          onFocus={() => setShowDrop(true)}
          placeholder="All staff (search to filter)…"
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
        />
        {(value || search) && (
          <button onClick={() => { onChange(null); setSearch(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showDrop && (search || searching) && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {searching ? (
            <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">No staff found.</div>
          ) : results.map(s => (
            <button key={s.id} type="button"
              onClick={() => {
                onChange({ id: s.id, name: s.full_name || `${s.first_name} ${s.last_name}` });
                setSearch('');
                setShowDrop(false);
              }}
              className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <UserCircle className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{s.full_name || `${s.first_name} ${s.last_name}`}</p>
                <p className="text-xs text-slate-400 font-mono">{s.staff_id}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SalaryReportPage() {
  const { user, hasPermission } = useAuth();
  const canView = user?.is_superuser || hasPermission('finance.view_salaryrecord');

  // ── Filter state ──
  const [mode, setMode]                 = useState<ReportMode>('single');
  const [singleMonth, setSingleMonth]   = useState(currentMonth);
  const [singleYear, setSingleYear]     = useState(currentYear);
  const [fromMonth, setFromMonth]       = useState(currentMonth);
  const [fromYear, setFromYear]         = useState(currentYear);
  const [toMonth, setToMonth]           = useState(currentMonth);
  const [toYear, setToYear]             = useState(currentYear);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedPeriod, setSelectedPeriod]   = useState('');
  const [selectedStaff, setSelectedStaff]     = useState<{ id: number; name: string } | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods]   = useState<any[]>([]);

  // ── Data state ──
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [bonusData, setBonusData]   = useState<BonusData | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');

  // ── Load sessions ──
  useEffect(() => {
    academicCalendarAPI.listSessions()
      .then((data: any) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSession) { setPeriods([]); setSelectedPeriod(''); return; }
    academicCalendarAPI.listSessionPeriods({ session_id: Number(selectedSession) })
      .then((data: any) => setPeriods(unwrapList(data)))
      .catch(() => setPeriods([]));
  }, [selectedSession]);

  // ── Build filter params ──
  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page_size: 1000 };
    if (selectedStaff) params.staff = selectedStaff.id;

    if (mode === 'single') {
      params.month = singleMonth;
      params.year  = singleYear;
    } else if (mode === 'range') {
      params.from_month = fromMonth;
      params.from_year  = fromYear;
      params.to_month   = toMonth;
      params.to_year    = toYear;
    } else if (mode === 'session') {
      if (selectedPeriod)  params.academic_period = selectedPeriod;
      else if (selectedSession) params.session    = selectedSession;
    }

    return params;
  }, [mode, singleMonth, singleYear, fromMonth, fromYear, toMonth, toYear, selectedSession, selectedPeriod, selectedStaff]);

  // ── Aggregate salary records ──
  const aggregateRecords = (records: any[]): ReportData => {
    const data: ReportData = {
      totalGrossSalary: 0,
      basicComponents: {},
      allowances: {},
      additionalIncome: {},
      statutoryDeductions: {},
      otherDeductions: {},
      totalPayeTax: 0,
      totalReliefs: 0,
      totalTakeHome: 0,
      totalPaid: 0,
      totalPending: 0,
      recordCount: records.length,
    };

    records.forEach(r => {
      data.totalGrossSalary += parseFloat(r.total_income) || 0;
      data.totalPayeTax     += parseFloat(r.monthly_tax)  || 0;
      data.totalReliefs     += parseFloat(r.total_reliefs) || 0;
      data.totalTakeHome    += parseFloat(r.net_salary)   || 0;
      data.totalPaid        += parseFloat(r.amount_paid)  || 0;

      // Basic components
      Object.entries(r.basic_components_breakdown || {}).forEach(([, comp]: [string, any]) => {
        const name   = comp?.name || '';
        const amount = parseFloat(comp?.amount) || 0;
        if (name && amount > 0) data.basicComponents[name] = (data.basicComponents[name] || 0) + amount;
      });

      // Allowances
      Object.entries(r.allowances_breakdown || {}).forEach(([name, allow]: [string, any]) => {
        const amount = parseFloat(allow?.amount ?? allow) || 0;
        if (amount > 0) data.allowances[name] = (data.allowances[name] || 0) + amount;
      });

      // Additional income
      Object.entries(r.additional_income || {}).forEach(([name, val]: [string, any]) => {
        const amount = parseFloat(val) || 0;
        if (amount > 0) data.additionalIncome[name] = (data.additionalIncome[name] || 0) + amount;
      });

      // Statutory deductions
      Object.entries(r.statutory_deductions || {}).forEach(([name, ded]: [string, any]) => {
        const amount = parseFloat(typeof ded === 'object' ? ded?.amount : ded) || 0;
        if (amount > 0) data.statutoryDeductions[name] = (data.statutoryDeductions[name] || 0) + amount;
      });

      // Other deductions
      Object.entries(r.other_deductions || {}).forEach(([name, ded]: [string, any]) => {
        const amount = parseFloat(typeof ded === 'object' ? ded?.amount : ded) || 0;
        if (amount > 0) data.otherDeductions[name] = (data.otherDeductions[name] || 0) + amount;
      });
    });

    data.totalPending = data.totalTakeHome - data.totalPaid;
    return data;
  };

  // ── Aggregate bonuses ──
  const aggregateBonuses = (bonuses: any[]): BonusData => {
    const data: BonusData = { staffTotal: 0, volunteerTotal: 0, total: 0, categories: {} };
    bonuses.forEach(b => {
      const amount = parseFloat(b.amount) || 0;
      if (b.type === 'staff') data.staffTotal += amount;
      else data.volunteerTotal += amount;
      const catName = typeof b.category === 'object' ? b.category?.name : (b.category_name || '');
      if (catName) data.categories[catName] = (data.categories[catName] || 0) + amount;
    });
    data.total = data.staffTotal + data.volunteerTotal;
    return data;
  };

  // ── Fetch ──
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();

      // Bonus params — same period filter, no staff filter (bonuses use staff_id)
      const bonusParams: Record<string, any> = { page_size: 1000 };
      if (selectedStaff) bonusParams.staff_id = selectedStaff.id;
      if (params.month)          bonusParams.month          = params.month;
      if (params.year)           bonusParams.year           = params.year;
      if (params.from_month)     bonusParams.from_month     = params.from_month;
      if (params.from_year)      bonusParams.from_year      = params.from_year;
      if (params.to_month)       bonusParams.to_month       = params.to_month;
      if (params.to_year)        bonusParams.to_year        = params.to_year;
      if (params.academic_period) bonusParams.academic_period = params.academic_period;
      if (params.session)        bonusParams.session        = params.session;

      const [recordsRes, bonusRes] = await Promise.all([
        payrollAPI.listRecords(params),
        bonusesAPI.list(bonusParams),
      ]) as any[];

      const records = unwrapList(recordsRes);
      const bonuses = unwrapList(bonusRes);

      setReportData(aggregateRecords(records));
      setBonusData(aggregateBonuses(bonuses));

      // Build period label
      if (mode === 'single') {
        setPeriodLabel(`${MONTHS[singleMonth - 1].label} ${singleYear}`);
      } else if (mode === 'range') {
        setPeriodLabel(`${MONTHS[fromMonth - 1].label} ${fromYear} – ${MONTHS[toMonth - 1].label} ${toYear}`);
      } else {
        const sess = sessions.find(s => String(s.id) === selectedSession);
        const prd  = periods.find(p => String(p.id) === selectedPeriod);
        setPeriodLabel(
          prd  ? `${prd.period?.name || 'Term'} – ${sess?.start_year}/${sess?.end_year}` :
          sess ? `${sess.start_year}/${sess.end_year}` : 'All periods'
        );
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [buildParams, mode, singleMonth, singleYear, fromMonth, fromYear, toMonth, toYear, selectedSession, selectedPeriod, sessions, periods, selectedStaff]);

  if (!canView) return <div className="p-10 text-center text-slate-500">Access Denied</div>;

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            Salary Report
          </h1>
          {periodLabel && (
            <p className="text-sm text-slate-400 mt-1 pl-12">{periodLabel}{selectedStaff ? ` · ${selectedStaff.name}` : ''}</p>
          )}
        </div>
        {reportData && (
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            <Printer className="h-4 w-4" /> Print Report
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h5 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" /> Report Filters
        </h5>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-5">
          {(['single', 'range', 'session'] as ReportMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize
                ${mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {m === 'single' ? 'Single Month' : m === 'range' ? 'Date Range' : 'Session / Term'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">

          {/* Single month */}
          {mode === 'single' && <>
            <div>
              <label className={labelCls}>Month</label>
              <select value={singleMonth} onChange={e => setSingleMonth(Number(e.target.value))} className={inputCls}>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Year</label>
              <select value={singleYear} onChange={e => setSingleYear(Number(e.target.value))} className={inputCls}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </>}

          {/* Date range */}
          {mode === 'range' && <>
            <div>
              <label className={labelCls}>From Month</label>
              <select value={fromMonth} onChange={e => setFromMonth(Number(e.target.value))} className={inputCls}>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>From Year</label>
              <select value={fromYear} onChange={e => setFromYear(Number(e.target.value))} className={inputCls}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>To Month</label>
              <select value={toMonth} onChange={e => setToMonth(Number(e.target.value))} className={inputCls}>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>To Year</label>
              <select value={toYear} onChange={e => setToYear(Number(e.target.value))} className={inputCls}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </>}

          {/* Session / term */}
          {mode === 'session' && <>
            <div>
              <label className={labelCls}>Session</label>
              <select value={selectedSession} onChange={e => { setSelectedSession(e.target.value); setSelectedPeriod(''); }} className={inputCls}>
                <option value="">All Sessions</option>
                {sessions.map((s: any) => (
                  <option key={s.id} value={String(s.id)}>{s.start_year}/{s.end_year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Term</label>
              <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
                disabled={!selectedSession} className={inputCls + ' disabled:opacity-40'}>
                <option value="">All Terms</option>
                {periods.map((p: any) => (
                  <option key={p.id} value={String(p.id)}>{p.period?.name || `Period ${p.id}`}</option>
                ))}
              </select>
            </div>
          </>}

          {/* Staff picker — always visible */}
          <div className={mode === 'range' ? 'lg:col-span-4 sm:col-span-3 col-span-2' : 'col-span-2 sm:col-span-1'}>
            <label className={labelCls}>Staff (leave blank for all)</label>
            <StaffPicker value={selectedStaff} onChange={setSelectedStaff} />
          </div>

          {/* Generate button */}
          <div className="flex items-end col-span-2 sm:col-span-1">
            <button onClick={fetchReport} disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-xl transition-all disabled:opacity-50">
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                : <><RefreshCw className="h-4 w-4" /> Generate Report</>}
            </button>
          </div>

        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Failed to generate report</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !reportData && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="h-7 w-7 text-violet-300" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">No report generated yet</h3>
          <p className="text-sm text-slate-400">Set your filters above and click Generate Report.</p>
        </div>
      )}

      {/* Report */}
      {!loading && reportData && bonusData && (
        <div className="space-y-4" id="printable-report">

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Records',      value: String(reportData.recordCount),          color: 'from-blue-500 to-blue-600',     Icon: FileText },
              { label: 'Gross Income', value: fmtMoney(reportData.totalGrossSalary),   color: 'from-violet-500 to-purple-600', Icon: TrendingUp },
              { label: 'Total Tax',    value: fmtMoney(reportData.totalPayeTax),       color: 'from-orange-500 to-red-500',    Icon: Percent },
              { label: 'Take Home',    value: fmtMoney(reportData.totalTakeHome),      color: 'from-emerald-500 to-green-600', Icon: DollarSign },
            ].map(({ label, value, color, Icon }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 truncate">{label}</p>
                  <p className="text-base font-bold text-slate-800 tabular-nums truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Income */}
          <ReportSection
            title="Income"
            icon={<TrendingUp className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
            total={reportData.totalGrossSalary}
          >
            <DataRow label="Total Gross Salary" value={fmtMoney(reportData.totalGrossSalary)} isTotal />
            <SubSection title="Basic Components" items={reportData.basicComponents} />
            <SubSection title="Allowances" items={reportData.allowances} />
            <SubSection title="Additional Income" items={reportData.additionalIncome} />
          </ReportSection>

          {/* Bonuses */}
          <ReportSection
            title="Bonuses"
            icon={<Gift className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-pink-500 to-rose-600"
            total={bonusData.total}
          >
            <div className="space-y-1">
              <DataRow label="Staff Bonuses" value={fmtMoney(bonusData.staffTotal)} />
              {!selectedStaff && <DataRow label="Volunteer Bonuses" value={fmtMoney(bonusData.volunteerTotal)} />}
              <DataRow label="Total Bonuses" value={fmtMoney(bonusData.total)} isTotal />
            </div>
            {Object.keys(bonusData.categories).length > 0 && (
              <SubSection title="Breakdown by Category (not additive)" items={bonusData.categories} />
            )}
          </ReportSection>

          {/* Deductions */}
          <ReportSection
            title="Deductions"
            icon={<TrendingDown className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-red-500 to-rose-600"
            total={
              Object.values(reportData.statutoryDeductions).reduce((s, v) => s + v, 0) +
              Object.values(reportData.otherDeductions).reduce((s, v) => s + v, 0) +
              reportData.totalPayeTax
            }
          >
            {Object.keys(reportData.statutoryDeductions).length > 0 && (
              <>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Statutory Deductions
                </p>
                <div className="space-y-1">
                  {Object.entries(reportData.statutoryDeductions).map(([name, amt]) => (
                    <DataRow key={name} label={name} value={fmtMoney(amt)} />
                  ))}
                </div>
              </>
            )}
            <SubSection title="Other Deductions" items={reportData.otherDeductions} />
            <div className="mt-4 pt-4 border-t border-dashed border-slate-200 space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" /> Taxation
              </p>
              <DataRow label="Total PAYE Tax" value={fmtMoney(reportData.totalPayeTax)} />
              <DataRow label="Total Reliefs / Exemptions" value={fmtMoney(reportData.totalReliefs)} />
            </div>
          </ReportSection>

          {/* Summary */}
          <ReportSection
            title="Summary"
            icon={<BarChart3 className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-slate-600 to-slate-800"
          >
            <div className="space-y-1">
              <DataRow label="Total Take-Home Salary" value={fmtMoney(reportData.totalTakeHome)} isTotal />
              <DataRow label="Total Amount Paid" value={fmtMoney(reportData.totalPaid)} highlight="green" />
              <DataRow label="Total Pending / Unpaid" value={fmtMoney(reportData.totalPending)} highlight="red" />
            </div>
          </ReportSection>

          {/* Grand total */}
          <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-2xl shadow-lg p-8 text-center text-white">
            <p className="text-violet-200 text-xs font-semibold uppercase tracking-widest mb-1">Net Take-Home Pay</p>
            {periodLabel && <p className="text-violet-300 text-sm mb-4">{periodLabel}</p>}
            <h2 className="text-4xl font-extrabold tracking-tight">{fmtMoney(reportData.totalTakeHome)}</h2>
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <span className="text-violet-200">
                <span className="text-white font-semibold">{fmtMoney(reportData.totalPaid)}</span> paid
              </span>
              <span className="text-violet-400">·</span>
              <span className="text-violet-200">
                <span className="text-white font-semibold">{fmtMoney(reportData.totalPending)}</span> pending
              </span>
            </div>
          </div>

        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

    </div>
  );
}