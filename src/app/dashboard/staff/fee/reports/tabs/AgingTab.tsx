'use client';

import React, { useMemo } from 'react';
import { Clock, AlertOctagon } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AgingTab({ data, reportTitle }: { data: any; reportTitle: string }) {
  if (data === null || data === undefined) {
    return <div className="py-24 flex items-center justify-center text-slate-300 text-sm font-medium">Loading…</div>;
  }

  // FIX: guard — aging is a single flat object ({0_30, 31_60, ...}), never
  // an array. If a stale array from another tab briefly lands here (before
  // the reset-on-tab-change fix), bucket lookups just come back undefined
  // instead of throwing.
  const safe = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};

  const buckets = [
    { key: '0_30', name: '0–30 Days', amount: parseFloat(safe['0_30']) || 0, fill: '#10b981' },
    { key: '31_60', name: '31–60 Days', amount: parseFloat(safe['31_60']) || 0, fill: '#f59e0b' },
    { key: '61_90', name: '61–90 Days', amount: parseFloat(safe['61_90']) || 0, fill: '#f43f5e' },
    { key: '90_plus', name: '90+ Days', amount: parseFloat(safe['90_plus']) || 0, fill: '#9f1239' },
  ];

  const total = useMemo(() => buckets.reduce((s, b) => s + b.amount, 0), [safe]);
  const criticalShare = total > 0 ? Math.round((buckets[3].amount / total) * 100) : 0;

  const formatYAxis = (val: number) => {
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(0)}k`;
    return `₦${val}`;
  };

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Clock className="h-10 w-10 mb-3 text-slate-300" />
        <p className="text-sm font-medium">No overdue balances found — everything currently due is within terms.</p>
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Aging &amp; Overdue Analysis</h3>
            <p className="text-xs text-slate-500">Only balances already past their due date — collection risk by how overdue.</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Overdue</p>
          <p className="text-lg font-black text-slate-900">{fmtMoney(total)}</p>
        </div>
      </div>

      {criticalShare >= 40 && (
        <div className="mb-5 flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-bold text-rose-700">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" /> {criticalShare}% of all overdue debt is 90+ days old — this is the highest-risk slice for write-off.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {buckets.map((b) => {
          const share = total > 0 ? Math.round((b.amount / total) * 100) : 0;
          return (
            <div key={b.key} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{b.name} Overdue</p>
              <p className="text-xl font-black mt-1" style={{ color: b.fill }}>{fmtMoney(b.amount)}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">{share}% of overdue debt</p>
            </div>
          );
        })}
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatYAxis} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} width={90} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(val: any) => [fmtMoney(val), 'Overdue Balance']} />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {buckets.map((b) => <Cell key={b.key} fill={b.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}