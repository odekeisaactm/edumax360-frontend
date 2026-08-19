'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { FileText, AlertTriangle } from 'lucide-react';

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ClassPerformanceTab({ data, reportTitle }: { data: any[] | null; reportTitle: string }) {
  const rows: any[] = Array.isArray(data) ? data : [];

  // FIX: `[...rows].sort(...)` instead of `rows.sort(...)`. Sorting the
  // array in place mutates React state directly — React 18 Strict Mode
  // deep-freezes state, so calling .sort() on it throws
  // "Cannot assign to read only property '0'". Chart order is by class
  // `order` (Nursery 1, Nursery 2, ... JSS 3, ...), a real school
  // sequence, not by revenue — revenue-sorting a class list reads oddly
  // to staff scanning it top to bottom.
  const chartData = useMemo(() => {
    return [...rows]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(d => ({
        name: d.name,
        Expected: parseFloat(d.net_expected || '0'),
        Paid: parseFloat(d.balance) > 0 ? parseFloat(d.paid || '0') : parseFloat(d.net_expected || '0'),
      }));
  }, [rows]);

  const tableRows = useMemo(() => [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [rows]);

  const worstDefaultRate = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.max(...rows.map(r => r.default_rate || 0));
  }, [rows]);

  if (data === null) {
    return <div className="py-24 flex items-center justify-center text-slate-300 text-sm font-medium">Loading…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <FileText className="h-10 w-10 mb-3 text-slate-300" />
        <p className="text-sm font-medium">No performance data available for this selection.</p>
      </div>
    );
  }

  const formatYAxis = (val: number) => {
    if (val >= 1000000000) return `₦${(val / 1000000000).toFixed(1)}B`;
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(0)}k`;
    return `₦${val}`;
  };

  return (
    <div className="p-6 animate-in fade-in duration-300">
      <div className="mb-6 border-b border-slate-100 pb-4 flex items-center justify-between print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Expected vs. Collected — Per Class</h3>
          <p className="text-xs text-slate-500 mt-1">Genuinely grouped by class (not a relabeled student list).</p>
        </div>
        <span className="px-2.5 py-1 text-[10px] font-black rounded-md bg-slate-50 text-slate-500 border border-slate-200">
          {rows.length} classes
        </span>
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} tickFormatter={formatYAxis} />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              formatter={(val: any) => [fmtMoney(val)]}
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
            <Bar dataKey="Expected" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Paid" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {worstDefaultRate > 30 && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-700 print:hidden">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> At least one class has a default rate above 30% — see the highlighted row below.
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Class</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Students</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Gross Billed</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Concessions</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Collected</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Balance</th>
              <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Default Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tableRows.map(r => {
              const concessions = parseFloat(r.discounts || '0') + parseFloat(r.waivers || '0');
              const isWorst = r.default_rate > 30;
              return (
                <tr key={r.id} className={isWorst ? 'bg-rose-50/40 hover:bg-rose-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-2.5 font-bold text-slate-800">{r.name}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-500">{r.student_count}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-500">{fmtMoney(r.gross_billed)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">-{fmtMoney(concessions)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-indigo-600">{fmtMoney(r.paid)}</td>
                  <td className="px-4 py-2.5 text-right font-black text-rose-600">{fmtMoney(r.balance)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${isWorst ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {r.default_rate}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}