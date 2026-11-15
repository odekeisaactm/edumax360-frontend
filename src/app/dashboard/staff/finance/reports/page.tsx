'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { financeReportsAPI, schoolInfoAPI } from '@/lib/api';
import { getApiUrl } from '@/lib/getApiUrl';
import type {
  IncomeExpenseStatementResponse, IncomeSummaryResponse, ExpenseSummaryResponse,
  CashFlowResponse, FinanceSummaryRow,
} from '@/lib/finance.types';
import { fmtCurrency, fmtCompact } from '@/lib/currency';
import {
  Loader2, AlertTriangle, X, FileText, Download, Printer, Scale, TrendingUp, TrendingDown,
  ArrowLeftRight, CalendarRange, Coins, ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import PrintLetterhead from '@/components/reports/PrintLetterhead';
import { useFinanceScope } from '../_components/useFinanceScope';
import ScopeSelects from '../_components/ScopeSelects';

type TabKey = 'statement' | 'income' | 'expense' | 'cashflow';

const TABS: { key: TabKey; label: string; icon: typeof Scale; api: 'income-expense-statement' | 'income-summary' | 'expense-summary' | 'cash-flow'; title: string }[] = [
  { key: 'statement', label: 'Income & Expense', icon: Scale, api: 'income-expense-statement', title: 'Income & Expense Statement' },
  { key: 'income', label: 'Income Summary', icon: TrendingUp, api: 'income-summary', title: 'Income Summary' },
  { key: 'expense', label: 'Expense Summary', icon: TrendingDown, api: 'expense-summary', title: 'Expense Summary' },
  { key: 'cashflow', label: 'Cash Flow', icon: ArrowLeftRight, api: 'cash-flow', title: 'Cash Flow Statement' },
];

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'Failed to load report.';
}

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function StatementTab({ data, money }: { data: IncomeExpenseStatementResponse; money: (v: string | number) => string }) {
  const net = parseFloat(data.net_income);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
        <Kpi label="Total Revenue" value={money(data.total_revenue)} tone="in" />
        <Kpi label="Total Expenditure" value={money(data.total_expenses)} tone="out" />
        <Kpi label={net >= 0 ? 'Net Surplus' : 'Net Deficit'} value={money(data.net_income)} tone={net >= 0 ? 'net' : 'out'}
          sub={data.margin_pct != null ? `${data.margin_pct}% of revenue` : undefined} />
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <StatementSection title="Revenue" lines={data.revenue} total={data.total_revenue} tone="in" currency={data.currency} money={money} />
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <StatementSection title="Expenditure" lines={data.expenses} total={data.total_expenses} tone="out" currency={data.currency} money={money} />
      </div>
      <div className={`rounded-xl px-5 py-4 flex items-center justify-between ${net >= 0 ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white'}`}>
        <span className="text-xs font-black uppercase tracking-widest">Net {net >= 0 ? 'Surplus' : 'Deficit'}</span>
        <span className="text-xl font-black tabular-nums">{money(data.net_income)}</span>
      </div>
    </div>
  );
}

function StatementSection({ title, lines, total, tone, currency, money }: {
  title: string; lines: IncomeExpenseStatementResponse['revenue']; total: string; tone: 'in' | 'out';
  currency: string; money: (v: string | number) => string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className={`text-[10px] font-black uppercase tracking-widest ${tone === 'in' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
          <th className="px-5 py-2.5 text-left">{title}</th>
          <th className="px-5 py-2.5 text-right w-48">Amount ({currency})</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {lines.length === 0 ? (
          <tr><td colSpan={2} className="px-5 py-6 text-center text-xs text-slate-400 font-medium">Nothing recorded for this scope.</td></tr>
        ) : lines.map(line => (
          <React.Fragment key={line.name}>
            <tr className="print-group">
              <td className="px-5 py-2.5 font-bold text-slate-800">{line.name}</td>
              <td className="px-5 py-2.5 text-right font-black text-slate-900 tabular-nums">{money(line.amount)}</td>
            </tr>
            {line.children.map(c => (
              <tr key={`${line.name}-${c.name}`}>
                <td className="pl-10 pr-5 py-1.5 text-xs text-slate-500 font-medium">
                  <span className="inline-flex items-center gap-1"><ChevronRight className="w-3 h-3 text-slate-300" />{c.name}</span>
                </td>
                <td className="px-5 py-1.5 text-right text-xs text-slate-500 font-semibold tabular-nums">{money(c.amount)}</td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
      <tfoot className="print-once">
        <tr className="border-t-2 border-slate-200">
          <td className="px-5 py-3 font-black text-slate-900 uppercase text-xs tracking-wider">Total {title}</td>
          <td className={`px-5 py-3 text-right font-black tabular-nums ${tone === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>{money(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Kpi({ label, value, tone, sub }: { label: string; value: string; tone: 'in' | 'out' | 'net'; sub?: string }) {
  const color = tone === 'in' ? 'text-emerald-700' : tone === 'out' ? 'text-rose-700' : 'text-indigo-700';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-black mt-1 tabular-nums break-words ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 font-medium mt-1">{sub}</p>}
    </div>
  );
}

function SummaryTab({ data, money, tone, emptyText }: {
  data: IncomeSummaryResponse | ExpenseSummaryResponse; money: (v: string | number) => string; tone: 'in' | 'out'; emptyText: string;
}) {
  const color = tone === 'in' ? '#059669' : '#e11d48';
  const groups = useMemo(() => {
    const map = new Map<string, FinanceSummaryRow[]>();
    data.rows.forEach(r => { map.set(r.group, [...(map.get(r.group) || []), r]); });
    return Array.from(map.entries());
  }, [data.rows]);

  if (!data.rows.length) return <p className="py-16 text-center text-sm text-slate-400 font-medium">{emptyText}</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
        <Kpi label={tone === 'in' ? 'Total Income' : 'Total Expenditure'} value={money(data.total)} tone={tone} />
        <Kpi label="Line Items" value={String(data.rows.length)} tone="net" />
        <Kpi label="Largest Item" value={data.rows[0]?.name || '—'} tone="net" sub={data.rows[0] ? `${money(data.rows[0].amount)} · ${data.rows[0].percentage}%` : undefined} />
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
              <th className="px-5 py-2.5 text-left">Item</th>
              <th className="px-5 py-2.5 text-right w-24">Records</th>
              <th className="px-5 py-2.5 text-left w-56 print:w-40">Share</th>
              <th className="px-5 py-2.5 text-right w-44">Amount ({data.currency})</th>
            </tr>
          </thead>
          {groups.map(([group, rows]) => (
            <tbody key={group} className="divide-y divide-slate-100 print-group">
              {(groups.length > 1 || rows.length > 1 || rows[0].name !== group) && (
                <tr className="bg-slate-50/60">
                  <td colSpan={4} className="px-5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{group}</td>
                </tr>
              )}
              {rows.map(r => (
                <tr key={r.key}>
                  <td className="px-5 py-2.5 font-bold text-slate-800">{r.name}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-slate-500 font-semibold tabular-nums">{r.count || '—'}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, r.percentage))}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 tabular-nums w-10 text-right">{r.percentage}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-right font-black text-slate-900 tabular-nums">{money(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot className="print-once">
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="px-5 py-3 font-black text-xs uppercase tracking-wider text-slate-900" colSpan={3}>Total</td>
              <td className={`px-5 py-3 text-right font-black tabular-nums ${tone === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>{money(data.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function CashFlowTab({ data, money, code, catalog }: { data: CashFlowResponse; money: (v: string | number) => string; code: string; catalog: any }) {
  const chart = data.months.map(m => ({ month: m.month, inflow: parseFloat(m.inflow), outflow: parseFloat(m.outflow) }));
  const net = parseFloat(data.net_flow);
  if (!data.months.length) return <p className="py-16 text-center text-sm text-slate-400 font-medium">No account movements in {code} for this range.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
        <Kpi label="Total Inflow" value={money(data.total_inflow)} tone="in" />
        <Kpi label="Total Outflow" value={money(data.total_outflow)} tone="out" />
        <Kpi label="Net Cash Flow" value={money(data.net_flow)} tone={net >= 0 ? 'net' : 'out'} />
      </div>

      <div className="h-64 print:hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtCompact(v, code, catalog)} />
            <Tooltip formatter={(v: any, n: any) => [money(v), n === 'inflow' ? 'Inflow' : 'Outflow']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => (v === 'inflow' ? 'Inflow' : 'Outflow')} />
            <Bar dataKey="inflow" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="outflow" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                <th className="px-4 py-2.5 text-left">Month</th>
                <th className="px-4 py-2.5 text-right">Inflow</th>
                <th className="px-4 py-2.5 text-right">Outflow</th>
                <th className="px-4 py-2.5 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.months.map(m => (
                <tr key={m.month_key}>
                  <td className="px-4 py-2 font-bold text-slate-800">{m.month}</td>
                  <td className="px-4 py-2 text-right text-emerald-700 font-semibold tabular-nums">{money(m.inflow)}</td>
                  <td className="px-4 py-2 text-right text-rose-700 font-semibold tabular-nums">{money(m.outflow)}</td>
                  <td className={`px-4 py-2 text-right font-black tabular-nums ${parseFloat(m.net) >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>{money(m.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="print-once">
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-black">
                <td className="px-4 py-2.5 text-xs uppercase tracking-wider">Total</td>
                <td className="px-4 py-2.5 text-right text-emerald-700 tabular-nums">{money(data.total_inflow)}</td>
                <td className="px-4 py-2.5 text-right text-rose-700 tabular-nums">{money(data.total_outflow)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(data.net_flow)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">By Transaction Type</div>
            <ul className="divide-y divide-slate-100">
              {data.by_type.map(t => (
                <li key={t.type} className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-700 truncate">{t.name}</span>
                  <span className="text-xs tabular-nums text-right shrink-0">
                    {parseFloat(t.inflow) > 0 && <span className="text-emerald-700 font-bold">+{money(t.inflow)}</span>}
                    {parseFloat(t.inflow) > 0 && parseFloat(t.outflow) > 0 && <span className="text-slate-300 mx-1.5">/</span>}
                    {parseFloat(t.outflow) > 0 && <span className="text-rose-700 font-bold">−{money(t.outflow)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">By Account</div>
            <ul className="divide-y divide-slate-100">
              {data.by_account.map(a => (
                <li key={a.id ?? a.name} className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-700 truncate">{a.name}</span>
                  <span className={`text-xs font-black tabular-nums ${parseFloat(a.net) >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>{money(a.net)} net</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Opening balances and transfers between the school&apos;s own accounts are excluded.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FinanceReportsPage() {
  const { user, hasPermission } = useAuth();
  const canView = user?.is_superuser || hasPermission('finance.view_expensemodel') || hasPermission('finance.view_incomemodel');

  const scope = useFinanceScope({ defaultToCurrentPeriod: false });
  const [tab, setTab] = useState<TabKey>('statement');
  const [useDates, setUseDates] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Each result is tagged with the request key it answers; "loading" = no result for the current key yet.
  const [report, setReport] = useState<{ key: string; tab: TabKey; body: any; error: string | null } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [printedAt, setPrintedAt] = useState(() => new Date().toLocaleString('en-GB'));
  const latestKey = useRef('');

  const meta = TABS.find(t => t.key === tab)!;
  const isCashFlow = tab === 'cashflow';
  const datesActive = (useDates || isCashFlow) && (!!dateFrom || !!dateTo);
  const dateError = dateFrom && dateTo && dateFrom > dateTo ? 'Start date must be before end date.' : null;

  useEffect(() => { schoolInfoAPI.get().then(setSchoolInfo).catch(() => {}); }, []);
  const logoUrl = useMemo(() => {
    const p: string | undefined = schoolInfo?.logo;
    if (!p) return undefined;
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    return `${getApiUrl()}${p.startsWith('/') ? '' : '/'}${p}`;
  }, [schoolInfo]);
  useEffect(() => { if (logoUrl) { const img = new Image(); img.src = logoUrl; } }, [logoUrl]);

  const params = useMemo(() => {
    const p: Record<string, string> = { currency: scope.currency };
    // Cash flow is a ledger view: dates only. Other tabs use session/period, optionally narrowed by dates.
    if (!isCashFlow) {
      if (scope.sessionId) p.session_id = scope.sessionId;
      if (scope.periodId) p.period_id = scope.periodId;
    }
    if (useDates || isCashFlow) {
      if (dateFrom) p.date_from = dateFrom;
      if (dateTo) p.date_to = dateTo;
    }
    return p;
  }, [scope.currency, scope.sessionId, scope.periodId, isCashFlow, useDates, dateFrom, dateTo]);

  const requestKey = scope.ready && scope.currency && !dateError ? JSON.stringify([tab, params]) : '';

  useEffect(() => {
    if (!requestKey) return;
    latestKey.current = requestKey;
    const [t, p] = JSON.parse(requestKey) as [TabKey, Record<string, string>];
    const api = financeReportsAPI;
    const req = t === 'statement' ? api.incomeExpenseStatement(p)
      : t === 'income' ? api.incomeSummary(p)
      : t === 'expense' ? api.expenseSummary(p)
      : api.cashFlow(p);
    req
      .then(body => { if (latestKey.current === requestKey) setReport({ key: requestKey, tab: t, body, error: null }); })
      .catch(err => {
        if (latestKey.current === requestKey) {
          setReport(prev => ({ key: requestKey, tab: t, body: prev?.tab === t ? prev.body : null, error: extractError(err) }));
        }
      });
  }, [requestKey]);

  const loading = !!requestKey && report?.key !== requestKey;
  const fetchError = report?.key === requestKey ? report.error : null;
  const error = actionError || (fetchError && fetchError !== dismissedError ? fetchError : null);
  const clearError = () => { setActionError(null); setDismissedError(fetchError); };

  const code = scope.currency;
  const money = useCallback((v: string | number) => fmtCurrency(v, code, scope.catalog), [code, scope.catalog]);
  const body = report && report.tab === tab ? report.body : null;

  const filterLabels = useMemo(() => {
    const parts: string[] = [`Currency: ${code}`];
    if (!isCashFlow) {
      parts.push(scope.sessionLabel ? `Session ${scope.sessionLabel}` : 'All sessions');
      if (scope.periodId) parts.push(scope.periodLabel);
    }
    if (datesActive) parts.push(`${dateFrom ? fmtDay(dateFrom) : 'Start'} – ${dateTo ? fmtDay(dateTo) : 'Today'}`);
    else if (isCashFlow) parts.push('All dates');
    return parts;
  }, [code, isCashFlow, scope.sessionLabel, scope.periodId, scope.periodLabel, datesActive, dateFrom, dateTo]);

  const fileTitle = [meta.title, code, !isCashFlow && scope.sessionLabel ? scope.sessionLabel.replace('/', '-') : '', !isCashFlow ? scope.periodLabel : '']
    .filter(Boolean).join(' - ');

  const handleCsv = async () => {
    setExporting(true);
    try {
      const blob = await financeReportsAPI.exportCsv(meta.api, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${fileTitle}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(extractError(err));
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    setPrintedAt(new Date().toLocaleString('en-GB'));
    setTimeout(() => window.print(), 80);
  };

  if (!canView) return <div className="p-16 text-center font-bold text-red-600">Access Denied: Missing finance permissions.</div>;

  if (!scope.ready) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading Finance Reports...</p>
      </div>
    );
  }

  const inputCls = 'px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50';

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-0 animate-in fade-in duration-300 print:p-0 print:pb-0 print:space-y-0 print:max-w-none">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Finance Reports</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Statements and breakdowns of money in and money out, one currency at a time.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCsv} disabled={!body || exporting} className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} CSV
          </button>
          <button onClick={handlePrint} disabled={!body} className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5 shadow-sm">
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          {!isCashFlow && <ScopeSelects scope={scope} />}
          {isCashFlow && (scope.catalog?.list.length || 0) > 1 && <ScopeSelects scope={scope} showPeriod={false} />}
          {!isCashFlow && (
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none ml-1">
              <input type="checkbox" checked={useDates} onChange={e => setUseDates(e.target.checked)} className="w-3.5 h-3.5 rounded text-indigo-600" />
              <CalendarRange className="w-3.5 h-3.5 text-slate-400" /> Narrow by date
            </label>
          )}
          {(useDates || isCashFlow) && (
            <div className="flex items-center gap-1.5">
              <input type="date" aria-label="From date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
              <span className="text-slate-300 font-bold text-xs">—</span>
              <input type="date" aria-label="To date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className={inputCls} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="p-1.5 text-slate-400 hover:text-slate-700" title="Clear dates"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>
          )}
        </div>
        {isCashFlow && (
          <p className="text-[11px] text-slate-400 font-medium">Cash flow follows actual account movements, so it is filtered by date only{(scope.catalog?.list.length || 0) > 1 ? ' and currency' : ''}.</p>
        )}
        {dateError && <p className="text-[11px] text-red-600 font-bold">{dateError}</p>}
        {(scope.catalog?.list.length || 0) > 1 && (
          <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Showing {code} only. Other currencies are reported separately and never converted.</p>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex overflow-x-auto gap-2 p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit max-w-full print:hidden">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === t.key ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <PrintLetterhead schoolInfo={schoolInfo} logoUrl={logoUrl} title={meta.title} filters={filterLabels} generatedAt={printedAt} />

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-800 print:hidden">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <span className="flex-1 font-medium">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Report body ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] relative print:border-0 print:shadow-none print:rounded-none print:min-h-0">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl print:hidden">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
          </div>
        )}
        <div className="px-5 sm:px-6 pt-5 pb-1 flex flex-wrap items-baseline justify-between gap-2 print:hidden">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> {meta.title}</h2>
          <p className="text-[11px] text-slate-400 font-medium">{filterLabels.join(' · ')}</p>
        </div>
        <div className="p-5 sm:p-6 print:p-0">
          {!body ? (
            !loading && <p className="py-16 text-center text-sm text-slate-400 font-medium">No data.</p>
          ) : tab === 'statement' ? (
            <StatementTab data={body} money={money} />
          ) : tab === 'income' ? (
            <SummaryTab data={body} money={money} tone="in" emptyText="No income recorded for this scope." />
          ) : tab === 'expense' ? (
            <SummaryTab data={body} money={money} tone="out" emptyText="No expenditure recorded for this scope." />
          ) : (
            <CashFlowTab data={body} money={money} code={code} catalog={scope.catalog} />
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 1.2cm 1.2cm 1.6cm 1.2cm;
            @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #94a3b8; }
          }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tfoot.print-once { display: table-row-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          tbody.print-group { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
