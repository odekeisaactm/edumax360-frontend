'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { salaryStructuresAPI, payrollAPI } from '@/lib/salary_management.service';
import {
  LayoutDashboard,
  Users,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Wallet,
  Play,
  RefreshCw,
  AlertCircle,
  Loader2,
  Trophy,
  History,
  UserX,
  Building2,
  Edit3,
  Eye,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(amount: string | number | undefined | null): string {
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
const currentYear = now.getFullYear();

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString('en-US', { month: 'long' }),
}));

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2.5">
      <div
        className={`h-full ${color} rounded-full transition-all duration-700`}
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
      />
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'paid')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Paid
      </span>
    );
  if (status === 'partially_paid')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Partial
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Pending
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PayrollDashboardPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canView = user?.is_superuser || hasPermission('salary_management.view_salaryrecordmodel');
  const canManage = user?.is_superuser || hasPermission('salary_management.add_salaryrecordmodel');

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [structures, setStructures] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [structsRes, recordsRes] = await Promise.all([
        salaryStructuresAPI.list({ is_active: true, page_size: 1000 }),
        payrollAPI.listRecords({ month, year, page_size: 1000 }),
      ]) as any[];
      setStructures(unwrapList(structsRes));
      setRecords(unwrapList(recordsRes));
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (canView) fetchData();
  }, [fetchData, canView]);

  // ── Computed stats ──
  const stats = useMemo(() => {
    const totalStaff = structures.length;

    const processedStaffIds = new Set(
      records.map((r) => (typeof r.staff === 'object' ? r.staff?.id : r.staff))
    );
    const processedCount = records.length;
    const unprocessedCount = Math.max(totalStaff - processedCount, 0);

    const paidCount = records.filter((r) => r.payment_status === 'paid').length;
    const partiallyPaidCount = records.filter((r) => r.payment_status === 'partially_paid').length;
    const pendingCount = records.filter((r) => r.payment_status === 'pending').length;

    const totalGross = records.reduce((s, r) => s + (parseFloat(r.total_income) || 0), 0);
    const totalNet = records.reduce((s, r) => s + (parseFloat(r.net_salary) || 0), 0);
    const totalStatutory = records.reduce((s, r) => s + (parseFloat(r.total_statutory_deductions) || 0), 0);
    const totalTax = records.reduce((s, r) => s + (parseFloat(r.monthly_tax) || 0), 0);
    const totalOtherDeductions = records.reduce((s, r) => s + (parseFloat(r.total_other_deductions) || 0), 0);
    const totalAmountPaid = records.reduce((s, r) => s + (parseFloat(r.amount_paid) || 0), 0);
    const totalOutstanding = totalNet - totalAmountPaid;

    const avgGross = processedCount > 0 ? totalGross / processedCount : 0;
    const avgNet = processedCount > 0 ? totalNet / processedCount : 0;
    const avgTaxRateSum = records.reduce((s, r) => s + (parseFloat(r.effective_tax_rate) || 0), 0);
    const avgTaxRate = processedCount > 0 ? avgTaxRateSum / processedCount : 0;

    const processingCompletion = totalStaff > 0 ? (processedCount / totalStaff) * 100 : 0;
    const paymentCompletion = processedCount > 0 ? (paidCount / processedCount) * 100 : 0;
    const paymentPctOfNet = totalNet > 0 ? (totalAmountPaid / totalNet) * 100 : 0;
    const outstandingPct = totalNet > 0 ? (totalOutstanding / totalNet) * 100 : 0;

    const topEarners = [...records]
      .sort((a, b) => (parseFloat(b.net_salary) || 0) - (parseFloat(a.net_salary) || 0))
      .slice(0, 5);

    const recentPayments = [...records]
      .filter((r) => r.payment_status === 'paid' && r.paid_date)
      .sort((a, b) => new Date(b.paid_date).getTime() - new Date(a.paid_date).getTime())
      .slice(0, 10);

    const unprocessedStaff = structures
      .filter((s) => {
        const sid = typeof s.staff === 'object' ? s.staff?.id : s.staff;
        return !processedStaffIds.has(sid);
      })
      .slice(0, 10);

    return {
      totalStaff, processedCount, unprocessedCount,
      paidCount, partiallyPaidCount, pendingCount,
      totalGross, totalNet, totalDeductions: totalStatutory + totalTax + totalOtherDeductions,
      totalStatutory, totalTax, totalOtherDeductions,
      totalAmountPaid, totalOutstanding,
      avgGross, avgNet, avgTaxRate,
      processingCompletion, paymentCompletion,
      paymentPctOfNet, outstandingPct,
      topEarners, recentPayments, unprocessedStaff,
    };
  }, [structures, records]);

  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

  // ── Permission guard ──
  if (!canView) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to view the payroll dashboard.</p>
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
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            Payroll Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">
            {monthName} {year} — payroll overview
          </p>
        </div>

        {/* Month / Year selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-white text-slate-600"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-white text-slate-600"
          >
            {Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            title="Refresh"
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canManage && (
            <button
              onClick={() => router.push(`/dashboard/staff/salary/bulk-payslips?month=${month}&year=${year}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-800 transition-all shadow-md shadow-violet-200"
            >
              <Play className="h-4 w-4" /> Bulk Process
            </button>
          )}
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {loading ? (
        <div className="p-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-400">Loading payroll data…</p>
        </div>
      ) : pageError ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-4">{pageError}</p>
          <button
            onClick={fetchData}
            className="text-sm text-violet-600 underline inline-flex items-center gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* ── Stat Chips ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Active Staff',
                value: stats.totalStaff,
                color: 'from-blue-500 to-blue-600',
                shadow: 'shadow-blue-100',
                icon: Users,
              },
              {
                label: 'Processed',
                value: stats.processedCount,
                color: 'from-emerald-500 to-teal-600',
                shadow: 'shadow-emerald-100',
                icon: CheckCircle,
                sub: `${stats.processingCompletion.toFixed(1)}% complete`,
                progress: stats.processingCompletion,
                progressColor: 'bg-gradient-to-r from-emerald-400 to-teal-500',
              },
              {
                label: 'Paid',
                value: stats.paidCount,
                color: 'from-cyan-500 to-cyan-600',
                shadow: 'shadow-cyan-100',
                icon: DollarSign,
                sub: `${stats.paymentCompletion.toFixed(1)}% of processed`,
                progress: stats.paymentCompletion,
                progressColor: 'bg-gradient-to-r from-cyan-400 to-cyan-500',
              },
              {
                label: 'Pending Payment',
                value: stats.pendingCount,
                color: 'from-amber-400 to-orange-500',
                shadow: 'shadow-amber-100',
                icon: Clock,
              },
            ].map(({ label, value, color, shadow, icon: Icon, sub, progress, progressColor }) => (
              <div key={label} className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${shadow}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-400 truncate">{label}</p>
                    <p className="text-2xl font-bold text-slate-800">{value}</p>
                    {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
                    {progress !== undefined && progressColor && (
                      <ProgressBar pct={progress} color={progressColor} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Financial Summary + Payment Status ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Financial Summary — spans 2 cols */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center shadow-sm">
                  <TrendingUp className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className="font-bold text-slate-800">Financial Summary</h3>
              </div>
              <div className="p-5">
                {/* Top row */}
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Total Gross Income</p>
                    <p className="text-xl font-bold text-blue-600">{fmtMoney(stats.totalGross)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Avg: {fmtMoney(stats.avgGross)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Total Net Salary</p>
                    <p className="text-xl font-bold text-emerald-600">{fmtMoney(stats.totalNet)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Avg: {fmtMoney(stats.avgNet)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Total Deductions</p>
                    <p className="text-xl font-bold text-red-500">{fmtMoney(stats.totalDeductions)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Avg Tax Rate: {stats.avgTaxRate.toFixed(2)}%</p>
                  </div>
                </div>

                {/* Deduction breakdown */}
                <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-50">
                  {[
                    { label: 'Statutory Deductions', value: stats.totalStatutory, text: 'text-orange-500', bg: 'bg-orange-50' },
                    { label: 'PAYE Tax', value: stats.totalTax, text: 'text-red-500', bg: 'bg-red-50' },
                    { label: 'Other Deductions', value: stats.totalOtherDeductions, text: 'text-pink-500', bg: 'bg-pink-50' },
                  ].map(({ label, value, text, bg }) => (
                    <div key={label} className={`${bg} rounded-xl p-3`}>
                      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
                      <p className={`text-sm font-bold ${text}`}>{fmtMoney(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment Status */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-purple-700 rounded-lg flex items-center justify-center shadow-sm">
                  <Wallet className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className="font-bold text-slate-800">Payment Status</h3>
              </div>
              <div className="p-5 space-y-4">

                {/* Paid bar */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500">Amount Paid</span>
                    <span className="text-sm font-bold text-emerald-600">{fmtMoney(stats.totalAmountPaid)}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(stats.paymentPctOfNet, 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{stats.paymentPctOfNet.toFixed(1)}% of total net</p>
                </div>

                {/* Outstanding bar */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500">Outstanding</span>
                    <span className="text-sm font-bold text-red-500">{fmtMoney(Math.max(stats.totalOutstanding, 0))}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-400 to-rose-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(stats.outstandingPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Badge counts */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'Paid', count: stats.paidCount, bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
                    { label: 'Partial', count: stats.partiallyPaidCount, bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
                    { label: 'Pending', count: stats.pendingCount, bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
                  ].map(({ label, count, bg, text, dot }) => (
                    <div key={label} className={`${bg} rounded-xl p-2.5 text-center`}>
                      <p className={`text-2xl font-bold ${text}`}>{count}</p>
                      <div className={`inline-flex items-center gap-1 text-[11px] ${text} mt-0.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Top Earners + Recent Payments ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Top Earners */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
                  <Trophy className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className="font-bold text-slate-800">Top 5 Earners</h3>
              </div>
              {stats.topEarners.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">No records available</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {stats.topEarners.map((record, i) => {
                    const staff = record.staff_detail || {};
                    const name = staff.full_name || staff.first_name || `Staff #${record.staff}`;
                    const staffId = staff.staff_id || '';
                    const rankColors = [
                      'bg-amber-100 text-amber-700',
                      'bg-slate-100 text-slate-600',
                      'bg-orange-100 text-orange-600',
                      'bg-slate-50 text-slate-500',
                      'bg-slate-50 text-slate-500',
                    ];
                    return (
                      <div
                        key={record.id ?? i}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${rankColors[i]}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                          {staffId && <p className="text-[11px] font-mono text-slate-400">{staffId}</p>}
                        </div>
                        <span className="text-sm font-bold text-emerald-600 flex-shrink-0">
                          {fmtMoney(record.net_salary)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Payments */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                  <History className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className="font-bold text-slate-800">Recent Payments</h3>
              </div>
              {stats.recentPayments.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">No recent payments</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {stats.recentPayments.map((record, i) => {
                    const staff = record.staff_detail || {};
                    const name = staff.full_name || staff.first_name || `Staff #${record.staff}`;
                    const staffId = staff.staff_id || '';
                    return (
                      <div
                        key={record.id ?? i}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                          {staffId && <p className="text-[11px] font-mono text-slate-400">{staffId}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-emerald-600">{fmtMoney(record.amount_paid)}</p>
                          {record.paid_date && (
                            <p className="text-[11px] text-slate-400">
                              {new Date(record.paid_date).toLocaleDateString('en-NG', {
                                month: 'short', day: 'numeric', year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Unprocessed Staff ── */}
          {stats.unprocessedStaff.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-amber-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
                    <UserX className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-800">Unprocessed Staff</h3>
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-700">
                    {stats.unprocessedCount}
                  </span>
                </div>
                {canManage && (
                  <button
                    onClick={() =>
                      router.push(`/dashboard/staff/salary/bulk-payslips?month=${month}&year=${year}`)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
                  >
                    <Play className="h-3 w-3" /> Bulk Process
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-50">
                {stats.unprocessedStaff.map((structure, i) => {
                  const staff = structure.staff_detail || {};
                  const name = staff.full_name || staff.first_name || `Staff #${structure.staff}`;
                  const staffId = staff.staff_id || '';
                  const dept = staff.department_name || '';
                  return (
                    <div
                      key={structure.id ?? i}
                      className="grid grid-cols-[1fr_150px_100px] items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {staffId && <span className="text-[11px] font-mono text-slate-400">{staffId}</span>}
                          {dept && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                              <Building2 className="h-2.5 w-2.5" /> {dept}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-700">
                        {fmtMoney(structure.monthly_salary)}
                      </span>
                      {canManage && (
                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/staff/salary/payroll/process?structureId=${structure.id}&month=${month}&year=${year}`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-100 hover:bg-green-100 transition-all"
                        >
                          <Play className="h-3 w-3" /> Process
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {stats.unprocessedCount > 10 && (
                <div className="px-5 py-3 border-t border-amber-50 bg-amber-50/40 text-center">
                  <p className="text-xs text-amber-600">
                    Showing 10 of {stats.unprocessedCount} unprocessed staff.{' '}
                    <button
                      onClick={() =>
                        router.push(`/dashboard/staff/salary/payslips?month=${month}&year=${year}`)
                      }
                      className="underline font-semibold"
                    >
                      View all in Payslips
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── All Payroll Records ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg flex items-center justify-center shadow-sm">
                  <DollarSign className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className="font-bold text-slate-800">All Payroll Records</h3>
                <span className="text-xs text-slate-400">({stats.processedCount})</span>
              </div>
              <button
                onClick={() =>
                  router.push(`/dashboard/staff/salary/payslips?month=${month}&year=${year}`)
                }
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                View all →
              </button>
            </div>

            {records.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">
                  No payroll records for {monthName} {year}.
                  {stats.unprocessedStaff.length > 0 && ' Process the unprocessed staff above to get started.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/60 border-b border-slate-100">
                      {[
                        { label: 'Staff', align: 'left' },
                        { label: 'Department', align: 'left' },
                        { label: 'Gross Income', align: 'right' },
                        { label: 'Deductions', align: 'right' },
                        { label: 'Net Salary', align: 'right' },
                        { label: 'Status', align: 'left' },
                        { label: 'Actions', align: 'left' },
                      ].map(({ label, align }) => (
                        <th
                          key={label}
                          className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-${align}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {records.map((record, i) => {
                      const staff = record.staff_detail || {};
                      const name = staff.full_name || staff.first_name || `Staff #${record.staff}`;
                      const staffId = staff.staff_id || '';
                      const dept = staff.department_name || 'N/A';
                      const totalDeductions =
                        (parseFloat(record.total_statutory_deductions) || 0) +
                        (parseFloat(record.monthly_tax) || 0) +
                        (parseFloat(record.total_other_deductions) || 0);

                      return (
                        <tr
                          key={record.id ?? i}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{name}</p>
                            {staffId && (
                              <p className="text-[11px] font-mono text-slate-400 mt-0.5">{staffId}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-slate-300" /> {dept}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            {fmtMoney(record.total_income)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-red-500">
                            {fmtMoney(totalDeductions)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            {fmtMoney(record.net_salary)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={record.payment_status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  router.push(`/dashboard/staff/salary/payslips/${record.id}`)
                                }
                                title="View Payslip"
                                className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {canManage &&
                                record.payment_status !== 'paid' &&
                                record.salary_structure && (
                                  <button
                                    onClick={() =>
                                      router.push(
                                        `/dashboard/staff/salary/payroll/process?structureId=${record.salary_structure}&month=${month}&year=${year}`
                                      )
                                    }
                                    title="Edit / Reprocess"
                                    className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}