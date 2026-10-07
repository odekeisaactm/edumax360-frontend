'use client';

import React from 'react';
import { Layers } from 'lucide-react';

const n = (v: any): number => {
  const x = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
};

function fmtMoney(amount: string | number): string {
  return '₦' + n(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const pctBadge = (pct: any) => {
  const p = n(pct);
  const cls = p >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : p > 0 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';
  return <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${cls}`}>{p}%</span>;
};

const TH = 'px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest print:px-3 print:py-2.5 print:text-[9px] print:text-slate-900';

/** Fee-by-fee breakdown: Student fees / Family fees / Other debts.
 *  Totals only — it does not matter which parent or student paid. */
export default function FeeBreakdownTab({ data, reportTitle }: { data: any; reportTitle: string }) {
  // `'groups' in data` guards against another tab's response briefly landing here.
  if (data === null || data === undefined || typeof data !== 'object' || !Array.isArray(data.groups)) {
    return <div className="py-24 flex items-center justify-center text-slate-300 text-sm font-medium">Loading…</div>;
  }

  const groups: any[] = data.groups;
  const totals = data.totals;

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Layers className="h-10 w-10 mb-3 text-slate-300" />
        <h3 className="font-semibold text-slate-700 mb-1">No fees found</h3>
        <p className="text-sm font-medium">No billed fees match the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-300">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl print:hidden">
        <h3 className="text-sm font-bold text-slate-800">Fee Breakdown</h3>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
          Billed and collected per fee • all students and families combined
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap print:text-[11px] print-table">
          <thead className="bg-slate-50 border-b-2 border-slate-200 print:border-slate-900">
            <tr>
              <th className={TH}>Fee</th>
              <th className={`${TH} text-right`}>Billed</th>
              <th className={`${TH} text-right`}>Concessions</th>
              <th className={`${TH} text-right`}>Net Expected</th>
              <th className={`${TH} text-right`}>Collected</th>
              <th className={`${TH} text-right`}>Balance</th>
              <th className={`${TH} text-center`}>% Collected</th>
            </tr>
          </thead>

          {groups.map((g: any) => (
            <tbody key={g.key} className="print-group divide-y divide-slate-100 print:divide-slate-200">
              <tr className="bg-slate-100">
                <td colSpan={7} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 print:px-3">
                  {g.label}
                </td>
              </tr>
              {g.rows.map((r: any) => (
                <tr key={`${g.key}-${r.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 print:px-3 print:py-2 font-bold text-slate-800">{r.name}</td>
                  <td className="px-4 py-3 print:px-3 print:py-2 text-right text-slate-600">{fmtMoney(r.gross_billed)}</td>
                  <td className="px-4 py-3 print:px-3 print:py-2 text-right font-bold text-emerald-600 print:text-slate-600">-{fmtMoney(n(r.discounts) + n(r.waivers))}</td>
                  <td className="px-4 py-3 print:px-3 print:py-2 text-right font-bold text-slate-700">{fmtMoney(r.net_expected)}</td>
                  <td className="px-4 py-3 print:px-3 print:py-2 text-right font-bold text-indigo-600 print:text-slate-800">{fmtMoney(r.paid)}</td>
                  <td className="px-4 py-3 print:px-3 print:py-2 text-right font-black text-rose-600 print:text-slate-900">{fmtMoney(r.balance)}</td>
                  <td className="px-4 py-3 print:px-3 print:py-2 text-center">{pctBadge(r.pct_paid)}</td>
                </tr>
              ))}
              {g.rows.length > 1 && (
                <tr className="bg-slate-50 font-black text-slate-800">
                  <td className="px-4 py-2.5 print:px-3 text-[10px] uppercase tracking-widest">{g.label} subtotal</td>
                  <td className="px-4 py-2.5 print:px-3 text-right">{fmtMoney(g.subtotal.gross_billed)}</td>
                  <td className="px-4 py-2.5 print:px-3 text-right">-{fmtMoney(n(g.subtotal.discounts) + n(g.subtotal.waivers))}</td>
                  <td className="px-4 py-2.5 print:px-3 text-right">{fmtMoney(g.subtotal.net_expected)}</td>
                  <td className="px-4 py-2.5 print:px-3 text-right">{fmtMoney(g.subtotal.paid)}</td>
                  <td className="px-4 py-2.5 print:px-3 text-right">{fmtMoney(g.subtotal.balance)}</td>
                  <td className="px-4 py-2.5 print:px-3 text-center">{n(g.subtotal.pct_paid)}%</td>
                </tr>
              )}
            </tbody>
          ))}

          <tfoot className="print-once">
            <tr className="bg-slate-900 text-white font-black print:bg-slate-100 print:text-slate-900 print:border-t-2 print:border-slate-900">
              <td className="px-4 py-3.5 print:px-3 print:py-2.5 text-[10px] uppercase tracking-widest">Grand total</td>
              <td className="px-4 py-3.5 print:px-3 text-right">{fmtMoney(totals.gross_billed)}</td>
              <td className="px-4 py-3.5 print:px-3 text-right">-{fmtMoney(n(totals.discounts) + n(totals.waivers))}</td>
              <td className="px-4 py-3.5 print:px-3 text-right">{fmtMoney(totals.net_expected)}</td>
              <td className="px-4 py-3.5 print:px-3 text-right">{fmtMoney(totals.paid)}</td>
              <td className="px-4 py-3.5 print:px-3 text-right">{fmtMoney(totals.balance)}</td>
              <td className="px-4 py-3.5 print:px-3 text-center">{n(totals.pct_paid)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}