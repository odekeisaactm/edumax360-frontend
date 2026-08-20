'use client';

import React from 'react';
import { Package, AlertTriangle, PackageX } from 'lucide-react';

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return num.toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

export default function StockLevelTab({ data, reportTitle }: { data: any; reportTitle: string }) {
  const reportData = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  const items = reportData?.items || [];
  const summary = reportData?.summary || null;

  if (data === null || data === undefined) {
    return <div className="py-24 flex items-center justify-center text-slate-300 text-sm font-medium">Loading…</div>;
  }

  if (!reportData || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Package className="h-10 w-10 mb-3 text-slate-300" />
        <p className="text-sm font-medium">No stock data available for this selection.</p>
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in duration-300">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Items</p>
            <p className="text-xl font-black text-slate-800 mt-1">{summary.total_items}</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Low Stock
            </p>
            <p className="text-xl font-black text-amber-700 mt-1">{summary.low_stock_count}</p>
          </div>
          <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
              <PackageX className="w-3 h-3" /> Out of Stock
            </p>
            <p className="text-xl font-black text-rose-600 mt-1">{summary.out_of_stock_count}</p>
          </div>
          <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-100">
            <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Value at Cost</p>
            <p className="text-lg font-black text-cyan-700 mt-1">{fmtMoney(summary.total_value_at_cost)}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Value at Selling</p>
            <p className="text-lg font-black text-emerald-700 mt-1">{fmtMoney(summary.total_value_at_selling)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Quantity</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Reorder Level</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Last Cost</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Selling Price</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Stock Value (Cost)</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Stock Value (Selling)</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item: any) => {
              const isOut = item.is_out_of_stock;
              const isLow = item.is_low_stock && !isOut;
              return (
                <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isOut ? 'bg-rose-50/30' : isLow ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-800">{item.name}</p>
                      {item.barcode && <p className="text-[10px] font-mono text-slate-400">{item.barcode}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-500">{item.category}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{fmtQty(item.quantity)}</td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-slate-500">{fmtQty(item.reorder_level)}</td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-slate-600">{fmtMoney(item.last_cost_price)}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">{fmtMoney(item.current_selling_price)}</td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-slate-600">{fmtMoney(item.stock_value_at_cost)}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">{fmtMoney(item.stock_value_at_selling)}</td>
                  <td className="px-4 py-3 text-center">
                    {isOut ? (
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-md border bg-rose-100 text-rose-700 border-rose-300">OUT</span>
                    ) : isLow ? (
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-md border bg-amber-100 text-amber-700 border-amber-300">LOW</span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-md border bg-emerald-100 text-emerald-700 border-emerald-300">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Print footer */}
      <div className="hidden print:block mt-6">
        <p className="text-[10px] text-slate-400">
          {reportTitle} — {items.length} item(s) shown. Total value at selling price: {fmtMoney(summary?.total_value_at_selling || 0)}.
        </p>
      </div>
    </div>
  );
}