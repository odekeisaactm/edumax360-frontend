'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { financeReportsAPI } from '@/lib/api';
import type { DashboardKPIResponse, FinanceSourceRow, FinanceRecentItem } from '@/lib/finance.types';
import { fmtCurrency, fmtCompact, type CurrencyCatalog } from '@/lib/currency';
import {
  ArrowDownLeft, ArrowUpRight, Landmark, Wallet, Loader2, AlertTriangle, X,
  TrendingUp, TrendingDown, Scale, FileBarChart, Plus, Coins, GraduationCap, Hourglass, RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { useFinanceScope } from '../_components/useFinanceScope';
import ScopeSelects from '../_components/ScopeSelects';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

const IN_COLOR = '#059669';   // emerald-600
const OUT_COLOR = '#e11d48';  // rose-600
const NET_COLOR = '#4f46e5';  // indigo-600

// ─── Small building blocks ────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        {hint && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

function SourceBars({ rows, color, money, empty }: { rows: FinanceSourceRow[]; color: string; money: (v: string | number) => string; empty: string }) {
  if (!rows.length) return <p className="text-xs text-slate-400 font-medium py-6 text-center">{empty}</p>;
  return (
    <ul className="space-y-3.5">
      {rows.map(r => (
        <li key={r.key || r.name}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-bold text-slate-700 truncate">{r.name}</span>
            <span className="font-black text-slate-900 tabular-nums shrink-0">{money(r.amount)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, Math.min(100, r.percentage))}%`, backgroundColor: color }} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 tabular-nums w-10 text-right">{r.percentage}%</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecentList({ items, money, tone, empty }: { items: FinanceRecentItem[]; money: (v: string | number) => string; tone: 'in' | 'out'; empty: string }) {
  if (!items.length) return <p className="text-xs text-slate-400 font-medium py-8 text-center">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((it, i) => (
        <li key={`${it.reference}-${i}`} className="flex items-center gap-3 py-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {tone === 'in' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 truncate">{it.description}</p>
            <p className="text-[10px] text-slate-400 font-medium truncate">
              {it.type || it.category || 'Expense'} · {fmtDate(it.date)} · <span className="font-mono">{it.reference}</span>
            </p>
          </div>
          <span className={`text-xs font-black tabular-nums shrink-0 ${tone === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {tone === 'in' ? '+' : '−'}{money(it.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FinanceDashboardPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canView = user?.is_superuser || hasPermission('finance.view_expensemodel') || hasPermission('finance.view_incomemodel');
  const canRecordExpense = user?.is_superuser || hasPermission('finance.add_expensemodel');

  const scope = useFinanceScope();
  const [nonce, setNonce] = useState(0);
  // Result is tagged with the request key it answers; "loading" = no result for the current key yet.
  const [result, setResult] = useState<{ key: string; data: DashboardKPIResponse | null; error: string | null } | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const latestKey = useRef('');

  const requestKey = scope.ready && scope.currency
    ? JSON.stringify([scope.currency, scope.sessionId, scope.periodId, nonce])
    : '';

  useEffect(() => {
    if (!requestKey) return;
    latestKey.current = requestKey;
    const [currency, sessionId, periodId] = JSON.parse(requestKey) as [string, string, string, number];
    financeReportsAPI.dashboardKPI({
      currency,
      session_id: sessionId || undefined,
      period_id: periodId || undefined,
    })
      .then(res => { if (latestKey.current === requestKey) setResult({ key: requestKey, data: res, error: null }); })
      .catch(err => {
        if (latestKey.current === requestKey) {
          setResult(prev => ({ key: requestKey, data: prev?.data ?? null, error: extractError(err) }));
        }
      });
  }, [requestKey]);

  const loading = !!requestKey && result?.key !== requestKey;
  const data = result?.data ?? null;
  const error = result?.error && result.error !== dismissedError ? result.error : null;
  const load = useCallback(() => setNonce(n => n + 1), []);

  if (!canView) return <div className="p-16 text-center font-bold text-red-600">Access Denied: Missing finance permissions.</div>;

  if (!scope.ready || (!data && loading)) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading Finance Dashboard...</p>
      </div>
    );
  }

  const code = data?.currency || scope.currency;
  const catalog: CurrencyCatalog | null = scope.catalog;
  const money = (v: string | number) => fmtCurrency(v, code, catalog);
  const net = parseFloat(data?.net_position || '0');
  const moneyIn = parseFloat(data?.money_in.total || '0');
  const margin = moneyIn > 0 ? Math.round((net / moneyIn) * 1000) / 10 : null;

  const scopeText = [
    scope.sessionLabel ? `Session ${scope.sessionLabel}` : 'All sessions',
    scope.periodId ? scope.periodLabel : (scope.sessionId ? `all ${scope.labels.plural.toLowerCase()}` : ''),
  ].filter(Boolean).join(' · ');

  const trend = (data?.monthly_trend || []).map(t => ({
    month: t.month.replace(/ (\d{2})(\d{2})$/, ' ’$2'),
    income: parseFloat(t.income), expense: parseFloat(t.expense), net: parseFloat(t.net),
  }));
  const trendHasData = trend.some(t => t.income || t.expense);
  const rec = data?.receivables;

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-0 animate-in fade-in duration-300">

      {/* ── Header & Filters ── */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Finance Dashboard</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Money in, money out and account positions · <span className="text-slate-700 font-bold">{scopeText}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <ScopeSelects scope={scope} />
            <button onClick={load} title="Refresh" className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button onClick={() => router.push('/dashboard/staff/finance/reports')} className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
              <FileBarChart className="w-3.5 h-3.5" /> Reports
            </button>
            {canRecordExpense && (
              <button onClick={() => router.push('/dashboard/staff/finance/expenses/create')} className="px-3.5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 flex items-center gap-1.5 shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Record Expense
              </button>
            )}
          </div>
        </div>
        {(catalog?.list.length || 0) > 1 && (
          <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" /> All figures are in <span className="font-bold text-slate-600">{code}</span>. Other currencies are reported separately and never converted.
          </p>
        )}
      </Card>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <span className="flex-1 font-medium">{error}</span>
          <button onClick={() => setDismissedError(error)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {data && (
        <>
          {/* ── KPI Cards ── */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Money In</p>
                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><TrendingUp className="w-4 h-4" /></span>
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-2 tracking-tight tabular-nums break-words">{money(data.money_in.total)}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-2">{data.money_in.sources.length} source{data.money_in.sources.length === 1 ? '' : 's'} · fees, income &amp; wallet funding</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Money Out</p>
                <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><TrendingDown className="w-4 h-4" /></span>
              </div>
              <p className="text-2xl font-black text-rose-700 mt-2 tracking-tight tabular-nums break-words">{money(data.money_out.total)}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-2">Expenses, supplier payments &amp; advances</p>
            </Card>

            <div className={`p-5 rounded-2xl text-white shadow-sm bg-gradient-to-br ${net >= 0 ? 'from-indigo-900 to-slate-900' : 'from-rose-900 to-slate-900'}`}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Net Position</p>
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Scale className="w-4 h-4" /></span>
              </div>
              <p className="text-2xl font-black mt-2 tracking-tight tabular-nums break-words">{money(data.net_position)}</p>
              <p className="text-[11px] text-indigo-200/90 font-medium mt-2">
                {margin == null ? 'No money in for this scope' : net >= 0 ? `Surplus · keeping ${margin}% of money in` : `Deficit · spending exceeds income by ${Math.abs(margin)}%`}
              </p>
            </div>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cash &amp; Bank · {code}</p>
                <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"><Landmark className="w-4 h-4" /></span>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 tracking-tight tabular-nums break-words">{money(data.balance_total)}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-2">Live balance across {data.accounts.length} {code} account{data.accounts.length === 1 ? '' : 's'}</p>
            </Card>
          </div>

          {/* ── Trend + Receivables ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6">
              <SectionTitle title="Monthly Trend" hint={`Money in vs money out over the last 12 months (${code})`} />
              <div className="h-72">
                {!trendHasData ? (
                  <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">No transactions in the last 12 months.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtCompact(v, code, catalog)} />
                      <Tooltip
                        formatter={(v: any, name: any) => [money(v), name === 'income' ? 'Money in' : name === 'expense' ? 'Money out' : 'Net']}
                        labelStyle={{ fontWeight: 800, color: '#0f172a' }}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        formatter={(v: string) => (v === 'income' ? 'Money in' : v === 'expense' ? 'Money out' : 'Net')} />
                      <Bar dataKey="income" fill={IN_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="expense" fill={OUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                      <Line type="monotone" dataKey="net" stroke={NET_COLOR} strokeWidth={2.5} dot={{ r: 2.5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-6 flex flex-col">
              <SectionTitle title="Receivables & Commitments" hint={rec ? 'What the school is still owed and has committed' : undefined} />
              {rec ? (
                <div className="space-y-5 flex-1">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <GraduationCap className="w-3.5 h-3.5" /> Outstanding Fees
                    </div>
                    <p className="text-xl font-black text-rose-600 mt-1 tabular-nums">{rec.fee_outstanding != null ? money(rec.fee_outstanding) : '—'}</p>
                    {rec.fee_collection_rate != null && (
                      <>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, rec.fee_collection_rate)}%` }} />
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-1.5">
                          <span className="font-bold text-slate-700">{rec.fee_collection_rate}%</span> collected of {rec.fee_net_expected != null ? money(rec.fee_net_expected) : '—'} expected
                        </p>
                      </>
                    )}
                    <button onClick={() => router.push('/dashboard/staff/fee/debtors')} className="text-[11px] font-bold text-indigo-600 hover:underline mt-2">View debtors →</button>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <Hourglass className="w-3.5 h-3.5" /> Advances Awaiting Disbursement
                    </div>
                    <p className="text-xl font-black text-amber-600 mt-1 tabular-nums">{money(rec.advances_awaiting_disbursement)}</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">Approved purchase advances not yet paid out</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
                  <Coins className="w-8 h-8 text-slate-200" />
                  <p className="text-xs text-slate-500 font-medium max-w-[220px]">
                    Fee receivables and advances are tracked in <span className="font-bold">{data.base_currency}</span>. Switch the currency to {data.base_currency} to see them.
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* ── Breakdown ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6">
              <SectionTitle title="Where Money Came From" hint="Share of money in, by source" />
              <SourceBars rows={data.money_in.sources} color={IN_COLOR} money={money} empty="No money in for this scope." />
            </Card>
            <Card className="p-6">
              <SectionTitle title="Where Money Went" hint="Share of money out, by type" />
              <SourceBars rows={data.money_out.sources} color={OUT_COLOR} money={money} empty="No money out for this scope." />
            </Card>
            <Card className="p-6">
              <SectionTitle
                title="Top Expense Categories"
                hint="General expenses only"
                action={<button onClick={() => router.push('/dashboard/staff/finance/expenses')} className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0">All expenses</button>}
              />
              <SourceBars
                rows={data.expense_categories.map(c => ({ key: c.name, name: `${c.name} · ${c.count}`, amount: c.amount, percentage: c.percentage }))}
                color="#f59e0b" money={money} empty="No general expenses for this scope."
              />
            </Card>
          </div>

          {/* ── Accounts + Recent activity ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6">
              <SectionTitle
                title={`${code} Accounts`}
                hint="Current balances"
                action={<button onClick={() => router.push('/dashboard/staff/finance/bank-accounts')} className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0">Manage</button>}
              />
              {data.accounts.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium py-8 text-center">No active {code} accounts.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.accounts.map(a => (
                    <li key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                        {a.type === 'cash_vault' ? <Wallet className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{a.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{a.type === 'cash_vault' ? 'Cash vault' : (a.account_number || 'Bank account')}</p>
                      </div>
                      <span className={`text-xs font-black tabular-nums ${parseFloat(a.balance) < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{money(a.balance)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-6">
              <SectionTitle title="Recent Money In" hint="Latest fee collections & other income" />
              <RecentList items={data.recent_income} money={money} tone="in" empty="No recent income." />
            </Card>

            <Card className="p-6">
              <SectionTitle
                title="Recent Expenses"
                hint="Latest expenditure vouchers"
                action={<button onClick={() => router.push('/dashboard/staff/finance/expenses')} className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0">View all</button>}
              />
              <RecentList items={data.recent_expenses} money={money} tone="out" empty="No recent expenses." />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
