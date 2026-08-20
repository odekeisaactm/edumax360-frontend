'use client';

import React from 'react';
import { Users, TrendingUp, Wallet, CreditCard, Banknote } from 'lucide-react';

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export default function StaffSalesTab({ data, reportTitle }: { data: any; reportTitle: string }) {
  const reportData = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  const summary = reportData?.summary || null;
  const staffReport = reportData?.staff_report || [];

  if (data === null || data === undefined) {
    return <div className="py-24 flex items-center justify-center text-slate-300 text-sm font-medium">Loading…</div>;
  }

  if (!reportData || !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Users className="h-10 w-10 mb-3 text-slate-300" />
        <p className="text-sm font-medium">No staff sales data available for this selection.</p>
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in duration-300">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 print:hidden">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Users className="w-3 h-3" /> Active Staff
          </p>
          <p className="text-xl font-black text-slate-800 mt-1">{summary.total_staff}</p>
        </div>
        <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-100">
          <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Total Sales</p>
          <p className="text-xl font-black text-cyan-700 mt-1">{summary.total_sales}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Total Revenue
          </p>
          <p className="text-lg font-black text-emerald-700 mt-1">{fmtMoney(summary.total_amount)}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Range</p>
          <p className="text-xs font-bold text-slate-700 mt-1">
            {reportData.date_range?.start_date || '—'} → {reportData.date_range?.end_date || '—'}
          </p>
        </div>
      </div>

      {/* Payment Breakdown Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 print:hidden">
        {[
          { label: 'Cash', value: summary.cash_total, icon: <Banknote className="w-4 h-4" />, cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
          { label: 'Student Wallet', value: summary.student_wallet_total, icon: <Wallet className="w-4 h-4" />, cls: 'bg-blue-50 border-blue-100 text-blue-700' },
          { label: 'Staff Wallet', value: summary.staff_wallet_total, icon: <Users className="w-4 h-4" />, cls: 'bg-purple-50 border-purple-100 text-purple-700' },
          { label: 'POS', value: summary.pos_total, icon: <CreditCard className="w-4 h-4" />, cls: 'bg-cyan-50 border-cyan-100 text-cyan-700' },
        ].map(pm => (
          <div key={pm.label} className={`p-3.5 rounded-xl border ${pm.cls}`}>
            <div className="flex items-center gap-2 mb-1.5">
              {pm.icon}
              <p className="text-[10px] font-black uppercase tracking-widest">{pm.label}</p>
            </div>
            <p className="text-sm font-black">{fmtMoney(pm.value)}</p>
          </div>
        ))}
      </div>

      {/* Staff Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Staff Name</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Sales Count</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Total Revenue</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Cash</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Student Wallet</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Staff Wallet</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">POS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffReport.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">No staff sales in this period.</td>
              </tr>
            ) : staffReport.map((staff: any) => (
              <tr key={staff.staff_id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5">
                  <div>
                    <p className="font-bold text-slate-800">{toTitleCase(staff.staff_name)}</p>
                    {staff.staff_code && <p className="text-[10px] font-mono text-slate-400">{staff.staff_code}</p>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="px-2 py-1 text-xs font-bold text-slate-700 bg-slate-100 rounded-full">{staff.total_sales}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmtMoney(staff.total_amount)}</td>
                <td className="px-4 py-2.5 text-right text-xs font-medium text-emerald-700">{fmtMoney(staff.cash_total)}</td>
                <td className="px-4 py-2.5 text-right text-xs font-medium text-blue-700">{fmtMoney(staff.student_wallet_total)}</td>
                <td className="px-4 py-2.5 text-right text-xs font-medium text-purple-700">{fmtMoney(staff.staff_wallet_total)}</td>
                <td className="px-4 py-2.5 text-right text-xs font-medium text-cyan-700">{fmtMoney(staff.pos_total)}</td>
              </tr>
            ))}
          </tbody>
          {staffReport.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-800">
                <td className="px-4 py-2.5 text-xs uppercase tracking-widest">Grand Total</td>
                <td className="px-4 py-2.5 text-center text-sm">{summary.total_sales}</td>
                <td className="px-4 py-2.5 text-right">{fmtMoney(summary.total_amount)}</td>
                <td className="px-4 py-2.5 text-right text-emerald-700">{fmtMoney(summary.cash_total)}</td>
                <td className="px-4 py-2.5 text-right text-blue-700">{fmtMoney(summary.student_wallet_total)}</td>
                <td className="px-4 py-2.5 text-right text-purple-700">{fmtMoney(summary.staff_wallet_total)}</td>
                <td className="px-4 py-2.5 text-right text-cyan-700">{fmtMoney(summary.pos_total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Print footer */}
      <div className="hidden print:block mt-6">
        <p className="text-[10px] text-slate-400">
          {reportTitle} — {summary.total_staff} staff member(s) | {summary.total_sales} sale(s) | Total: {fmtMoney(summary.total_amount)}.
        </p>
      </div>
    </div>
  );
}