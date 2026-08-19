'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Brush } from 'recharts';
import { TrendingUp } from 'lucide-react';

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TrendsTab({ data, reportTitle }: { data: any[] | null; reportTitle: string }) {
  const rows: any[] = Array.isArray(data) ? data : [];

  const chartData = useMemo(() => rows.map(d => ({ date: d.date, amount: parseFloat(d.amount || '0') })), [rows]);

  const total = useMemo(() => chartData.reduce((s, d) => s + d.amount, 0), [chartData]);
  const daysWithCollections = useMemo(() => chartData.filter(d => d.amount > 0).length, [chartData]);

  if (data === null) {
    return <div className="py-24 flex items-center justify-center text-slate-300 text-sm font-medium">Loading…</div>;
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <TrendingUp className="h-10 w-10 mb-3 text-slate-300" />
        <p className="text-sm font-medium">No trend data available for this selection.</p>
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
    <div className="p-6 flex flex-col animate-in fade-in duration-300">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Collection Flow Over Time</h3>
          <p className="text-xs text-slate-500">
            Confirmed payments by date — every day in the window is shown, including zero-collection days.
            Drag the handles below the chart to zoom into a range.
          </p>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total in Window</p>
          <p className="text-lg font-black text-indigo-700">{fmtMoney(total)}</p>
          <p className="text-[10px] text-slate-400 font-medium">{daysWithCollections} of {chartData.length} days had activity</p>
        </div>
      </div>

      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAmountTrends" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => val ? val.slice(5) : ''} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatYAxis} />
            <Tooltip formatter={(val: any) => [fmtMoney(val), 'Collected']} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
            <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmountTrends)" />
            <Brush
              dataKey="date"
              height={26}
              stroke="#4f46e5"
              travellerWidth={8}
              tickFormatter={(val) => val ? String(val).slice(5) : ''}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}