'use client';

import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Brush } from 'recharts';
import { TrendingUp, Wallet, CreditCard, Users, Banknote, ChevronUp, ChevronDown } from 'lucide-react';

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type SortKey = 'quantity' | 'revenue' | 'profit' | 'name';
type SortOrder = 'asc' | 'desc';

export default function SalesProfitTab({ data, reportTitle }: { data: any; reportTitle: string }) {
  const reportData = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  const summary = reportData?.summary || null;
  const topItems = reportData?.top_items || [];
  const dailyTrend = reportData?.daily_trend || [];

  const [sortBy, setSortBy] = useState<SortKey>('quantity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedItems = useMemo(() => {
    const items = [...topItems];
    const keyMap: Record<SortKey, string> = {
      quantity: 'quantity_sold',
      revenue: 'revenue',
      profit: 'profit',
      name: 'item_name',
    };
    const key = keyMap[sortBy];

    items.sort((a, b) => {
      let cmp = 0;
      if (key === 'item_name') {
        cmp = a[key].localeCompare(b[key]);
      } else {
        cmp = parseFloat(a[key]) - parseFloat(b[key]);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [topItems, sortBy, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const chartData = useMemo(() => {
    return dailyTrend.map((d: any) => ({
      date: d.date,
      revenue: parseFloat(d.revenue || '0'),
      profit: parseFloat(d.profit || '0'),
      transactions: d.transactions,
    }));
  }, [dailyTrend]);

  if (data === null || data === undefined) {
    return <div className="py-24 flex items-center justify-center text-slate-300 text-sm font-medium">Loading…</div>;
  }

  if (!reportData || !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <TrendingUp className="h-10 w-10 mb-3 text-slate-300" />
        <p className="text-sm font-medium">No sales data available for this selection.</p>
      </div>
    );
  }

  const formatYAxis = (val: number) => {
    if (val >= 1000000000) return `₦${(val / 1000000000).toFixed(1)}B`;
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(0)}k`;
    return `₦${val}`;
  };

  const SortHeader = ({ label, sortKey, className }: { label: string; sortKey: SortKey; className?: string }) => (
    <button onClick={() => handleSort(sortKey)} className={`inline-flex items-center gap-1 hover:text-cyan-600 transition-colors ${className || ''}`}>
      {label}
      {sortBy === sortKey && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );

  return (
    <div className="p-6 animate-in fade-in duration-300">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:hidden">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Revenue</p>
          <p className="text-xl font-black text-slate-800 mt-1">{fmtMoney(summary.total_revenue)}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Profit</p>
          <p className="text-xl font-black text-emerald-700 mt-1">{fmtMoney(summary.total_profit)}</p>
          <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{summary.profit_margin}% margin</p>
        </div>
        <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-100">
          <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Transactions</p>
          <p className="text-xl font-black text-cyan-700 mt-1">{summary.total_transactions}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Range</p>
          <p className="text-xs font-bold text-slate-700 mt-1">
            {summary.date_range?.start_date || '—'} → {summary.date_range?.end_date || '—'}
          </p>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 print:hidden">
        {[
          { label: 'Cash', value: summary.payment_breakdown.cash, icon: <Banknote className="w-4 h-4" />, cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
          { label: 'Student Wallet', value: summary.payment_breakdown.student_wallet, icon: <Wallet className="w-4 h-4" />, cls: 'bg-blue-50 border-blue-100 text-blue-700' },
          { label: 'Staff Wallet', value: summary.payment_breakdown.staff_wallet, icon: <Users className="w-4 h-4" />, cls: 'bg-purple-50 border-purple-100 text-purple-700' },
          { label: 'POS', value: summary.payment_breakdown.pos, icon: <CreditCard className="w-4 h-4" />, cls: 'bg-cyan-50 border-cyan-100 text-cyan-700' },
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

      {/* Daily Trend Chart */}
      {chartData.length > 0 && (
        <div className="mb-8 print:hidden">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Collection Flow Over Time</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => val ? val.slice(5) : ''} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatYAxis} />
                <Tooltip formatter={(val: any, name: string) => [fmtMoney(val), name === 'revenue' ? 'Revenue' : 'Profit']} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                <Area type="monotone" dataKey="revenue" stroke="#0891b2" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                <Brush dataKey="date" height={24} stroke="#0891b2" travellerWidth={7} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Items Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Top Selling Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <SortHeader label="Item" sortKey="name" />
                </th>
                <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
                <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                  <SortHeader label="Qty Sold" sortKey="quantity" className="justify-end" />
                </th>
                <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                  <SortHeader label="Revenue" sortKey="revenue" className="justify-end" />
                </th>
                <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                  <SortHeader label="Profit" sortKey="profit" className="justify-end" />
                </th>
                <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No items sold in this period.</td>
                </tr>
              ) : sortedItems.map((item: any) => (
                <tr key={item.item_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-slate-800">{item.item_name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{item.category}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-700">{parseFloat(item.quantity_sold).toFixed(0)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-600">{fmtMoney(item.revenue)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{fmtMoney(item.profit)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-xs font-bold text-slate-500">{item.profit_margin}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print footer */}
      <div className="hidden print:block mt-6">
        <p className="text-[10px] text-slate-400">
          {reportTitle} — Total Revenue: {fmtMoney(summary.total_revenue)} | Total Profit: {fmtMoney(summary.total_profit)} ({summary.profit_margin}% margin).
        </p>
      </div>
    </div>
  );
}