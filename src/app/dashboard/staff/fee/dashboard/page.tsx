'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI } from '@/lib/api';
import { Session, AcademicSessionPeriod } from '@/lib/types';
import {
  Wallet, AlertTriangle, CheckCircle, X, Loader2,
  ShieldCheck, ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function fmtMoney(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function formatPaymentMode(mode: string): string {
  if (!mode) return 'Checkout';
  if (mode === 'online_gateway') return 'Online Gateway';
  if (mode === 'bank_transfer') return 'Bank Transfer';
  return mode.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Fee Dashboard Component ─────────────────────────────────────────────
export default function FeeDashboardPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  // Filter States
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [filterSessionId, setFilterSessionId] = useState<string>('');
  const [filterPeriodId, setFilterPeriodId] = useState<string>('');

  // Dashboard Metrics & Chart State
  const [kpis, setKpis] = useState({
    total_billed: '0',
    total_discounts: '0',
    net_expected: '0',
    total_paid: '0',
    total_outstanding: '0',
    collection_rate: 0,
  });
  const [trends, setTrends] = useState<any[]>([]);
  const [topDebtors, setTopDebtors] = useState<any[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);

  // Race condition guard
  const fetchRequestIdRef = useRef(0);

  // ── Initial Setup ──
  useEffect(() => {
    const init = async () => {
      try {
        const [sessRes, curSessRaw] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession()
        ]);
        const curSess = curSessRaw?.data?.data || curSessRaw?.data || curSessRaw;
        setSessions(Array.isArray(sessRes) ? sessRes : []);
        const targetSessionId = curSess?.id ? curSess.id.toString() : (sessRes[0]?.id?.toString() || '');

        if (targetSessionId) {
          setFilterSessionId(targetSessionId);
          const perData = await academicCalendarAPI.listSessionPeriods({ session_id: Number(targetSessionId) });
          setPeriods(perData);
          const currentP = perData.find(p => p.is_current);
          if (currentP) setFilterPeriodId(currentP.id.toString());
          else if (perData.length > 0) setFilterPeriodId(perData[0].id.toString());
        }
      } catch (err) {
        showToast('error', 'Failed to initialize dashboard parameters.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [showToast]);

  // Update periods when session changes
  useEffect(() => {
    if (!loading && filterSessionId) {
      academicCalendarAPI.listSessionPeriods({ session_id: Number(filterSessionId) })
        .then(res => {
          setPeriods(res);
          if (res.length > 0 && !res.find(p => p.id.toString() === filterPeriodId)) {
            setFilterPeriodId(res[0].id.toString());
          }
        });
    }
  }, [filterSessionId, loading, filterPeriodId]);

  // ── Fetch Dashboard Metrics ──
  const fetchDashboardData = useCallback(async () => {
    if (!filterSessionId || !filterPeriodId) return;
    const requestId = ++fetchRequestIdRef.current;
    setDataLoading(true);

    try {
      const params = { session_id: filterSessionId, period_id: filterPeriodId };
      const [kpiRes, trendRes, debtorsRes, receiptsRes] = await Promise.all([
        feeAPI.getDashboardKPIs(params),
        feeAPI.getPaymentTrends({ session_id: filterSessionId, days: 30 }),
        feeAPI.getCollectionReport({ session_id: filterSessionId, period_id: filterPeriodId, threshold_pct: 0 }),
        feeAPI.getReceipts({ status: 'confirmed', page_size: 6 })
      ]);

      if (requestId !== fetchRequestIdRef.current) return;

      setKpis(kpiRes);
      setTrends(Array.isArray(trendRes) ? trendRes : []);

      // Sort collection items by highest balance to find top debtors
      const sortedDebtors = (Array.isArray(debtorsRes) ? debtorsRes : [])
        .filter((d: any) => parseFloat(d.balance) > 0)
        .sort((a: any, b: any) => parseFloat(b.balance) - parseFloat(a.balance))
        .slice(0, 5);
      setTopDebtors(sortedDebtors);

      const rList = receiptsRes.results || receiptsRes || [];
      setRecentTxns(rList);

    } catch (err: any) {
      if (requestId !== fetchRequestIdRef.current) return;
      showToast('error', extractError(err));
    } finally {
      if (requestId === fetchRequestIdRef.current) setDataLoading(false);
    }
  }, [filterSessionId, filterPeriodId, showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Recharts Formatters ──
  const formatYAxis = (val: number) => {
    if (val >= 1000000000) return `₦${(val / 1000000000).toFixed(1)}B`;
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(0)}k`;
    return `₦${val}`;
  };

  const formatXAxisDate = (val: string) => {
    if (!val || val === 'None') return '';
    return val.slice(5); // Converts '2026-08-15' to '08-15'
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading Fee Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-0 animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Header & Filter Bar ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fee Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Real-time financial overview and collections.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={filterSessionId}
            onChange={e => setFilterSessionId(e.target.value)}
            className="px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {sessions.map(s => <option key={s.id} value={s.id}>Session: {s.start_year}/{s.end_year}</option>)}
          </select>

          <select
            value={filterPeriodId}
            onChange={e => setFilterPeriodId(e.target.value)}
            disabled={!filterSessionId}
            className="px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
          </select>

          {canManage && (
            <button
              onClick={() => router.push('/dashboard/staff/fee/payments/new')}
              className="px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center gap-1.5 ml-auto md:ml-0"
            >
              <Wallet className="w-4 h-4" /> Receive Payment
            </button>
          )}
        </div>
      </div>

      {/* ── 3 KPI Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Net Expected Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative flex flex-col justify-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Expected Revenue</p>
          <h3 className="text-xl md:text-2xl lg:text-xl xl:text-3xl font-black text-slate-900 mt-2 tracking-tight break-words">
            {fmtMoney(kpis.net_expected)}
          </h3>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500 font-medium flex-wrap">
            <span className="whitespace-nowrap">Gross: {fmtMoney(kpis.total_billed)}</span>
            <span className="text-slate-300 shrink-0">•</span>
            <span className="text-emerald-600 font-bold shrink-0 whitespace-nowrap">-{fmtMoney(kpis.total_discounts)} Disc.</span>
          </div>
        </div>

        {/* Card 2: Total Collected (With Outstanding beneath it) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative flex flex-col justify-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Collected</p>
          <h3 className="text-xl md:text-2xl lg:text-xl xl:text-3xl font-black text-emerald-600 mt-2 tracking-tight break-words">
            {fmtMoney(kpis.total_paid)}
          </h3>
          <div className="flex items-center gap-1.5 mt-3 text-xs font-medium flex-wrap">
            <span className="text-rose-600 font-bold whitespace-nowrap">outstanding: {fmtMoney(kpis.total_outstanding)}</span>
          </div>
        </div>

        {/* Card 3: Collection Health */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-5 rounded-2xl text-white shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Collection Health</p>
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
          </div>
          <div className="my-2">
            <h3 className="text-3xl font-black">{kpis.collection_rate}%</h3>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, kpis.collection_rate)}%` }} />
            </div>
          </div>
          <p className="text-[11px] text-indigo-200 font-medium">Live collection data</p>
        </div>
      </div>

      {/* ── Chart & Top Debtors Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main Chart Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Daily Collections</h3>
              <p className="text-xs text-slate-400">Payments collected over the last 30 days</p>
            </div>
            {dataLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
          </div>

          <div className="h-72 w-full">
            {trends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">No collections recorded for this window.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatXAxisDate} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatYAxis} />
                  <Tooltip formatter={(val: any) => [fmtMoney(val), 'Collected']} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                  <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Debtors Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold text-slate-900">Top Debtors</h3>
            <button onClick={() => router.push('/dashboard/staff/fee/debtors')} className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
          </div>

          <div className="space-y-4 flex-1">
            {topDebtors.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-medium text-slate-400 py-12">No debtors found.</div>
            ) : (
              topDebtors.map((debtor, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {debtor.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate" title={debtor.name}>{debtor.name}</p>
                      <p className="text-[10px] text-slate-400">Balance Due</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-black text-rose-600 truncate max-w-[90px]" title={fmtMoney(debtor.balance)}>{fmtMoney(debtor.balance)}</p>
                    <button
                      onClick={() => router.push(`/dashboard/staff/fee/payments/new?parent_id=${debtor.id}`)}
                      className="text-[10px] font-bold text-indigo-600 hover:underline mt-0.5 flex items-center justify-end gap-1 w-full"
                    >
                      Collect <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── Recent Transactions Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Payments</h3>
            <p className="text-xs text-slate-400">Latest confirmed payments.</p>
          </div>
          <button onClick={() => router.push('/dashboard/staff/fee/payments')} className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Payer / Beneficiary</th>
                <th className="px-5 py-3.5">Mode</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTxns.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-xs font-medium text-slate-400">No confirmed payments found.</td></tr>
              ) : (
                recentTxns.map((txn: any) => (
                  <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-600">{txn.reference}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">{txn.parent_name || txn.student_name || 'Family Account'}</td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-slate-600">{formatPaymentMode(txn.external_payment_mode)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{txn.date}</td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900">{fmtMoney(txn.total_amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}