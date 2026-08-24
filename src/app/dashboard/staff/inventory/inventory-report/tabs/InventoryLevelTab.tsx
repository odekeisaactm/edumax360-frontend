'use client';

import React from 'react';
import { Package, FileBarChart2 } from 'lucide-react';

function fmtQty(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return num.toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

export default function InventoryLevelTab({ data, reportTitle, showOptional }: {
  data: any;
  reportTitle: string;
  showOptional: boolean;
}) {
  const reportData = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  const items = reportData?.items || [];

  if (data === null || data === undefined) {
    return <div className="py-24 flex items-center justify-center text-slate-300 text-sm font-medium">Loading…</div>;
  }

  if (!reportData || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Package className="h-10 w-10 mb-3 text-slate-300" />
        <p className="text-sm font-medium">No inventory activity found for this selection.</p>
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in duration-300">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Qty Stocked In</th>
              {showOptional && (
                <>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Qty Sold</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Qty Stocked Out</th>
                </>
              )}
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Qty Left</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-bold text-slate-800">{item.name}</p>
                    {item.barcode && <p className="text-[10px] font-mono text-slate-400">{item.barcode}</p>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-slate-500">{item.category}</td>
                <td className="px-4 py-3 text-right text-xs font-medium text-slate-600">{fmtQty(item.qty_stocked_in)}</td>
                {showOptional && (
                  <>
                    <td className="px-4 py-3 text-right text-xs font-medium text-red-600">{fmtQty(item.qty_sold)}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-amber-600">{fmtQty(item.qty_stocked_out)}</td>
                  </>
                )}
                <td className="px-4 py-3 text-right font-bold text-slate-700">{fmtQty(item.qty_left)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Print footer */}
      <div className="hidden print:block mt-6">
        <p className="text-[10px] text-slate-400">
          {reportTitle} — {items.length} item(s) shown.
        </p>
      </div>
    </div>
  );
}