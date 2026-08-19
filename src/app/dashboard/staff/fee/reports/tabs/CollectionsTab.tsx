'use client';

import React, { useMemo, useState } from 'react';
import { Users, FileText, ShieldMinus, ChevronLeft, ChevronRight } from 'lucide-react';

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const clearedBadge = (pct: number | null) => {
  if (pct === null) return <span className="px-2 py-0.5 text-[10px] font-black rounded-md border bg-slate-50 text-slate-400 border-slate-200">N/A</span>;
  const cls = pct >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : pct > 0 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';
  return <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${cls}`}>{pct}%</span>;
};

const familyStatusBadge = (statusVal?: string) => {
  if (!statusVal || statusVal === 'none') return null;
  if (statusVal === 'clear') {
    return <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-50 text-purple-500 border border-purple-100 whitespace-nowrap">Family fees clear</span>;
  }
  return <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-50 text-rose-600 border border-rose-200 whitespace-nowrap">Family fees outstanding</span>;
};

const PAGE_SIZE = 25;

export default function CollectionsTab({ data, groupBy, reportTitle }: { data: any[] | null; groupBy: string; reportTitle: string }) {
  const [page, setPage] = useState(1);

  // FIX: guard against `data` being anything other than a real array before
  // ever calling .map/.length on it — this is what caused "data.map is not
  // a function" when a stale/differently-shaped response briefly landed here.
  const rows: any[] = Array.isArray(data) ? data : [];

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  // Reset to page 1 whenever the underlying filtered dataset changes size
  // (new filters applied) so we never render an out-of-range page.
  React.useEffect(() => { setPage(1); }, [rows.length]);

  if (data === null) {
    return <div className="py-24 flex items-center justify-center text-slate-300 text-sm font-medium">Loading…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <FileText className="h-10 w-10 mb-3 text-slate-300" />
        <h3 className="font-semibold text-slate-700 mb-1">No collections found</h3>
        <p className="text-sm font-medium">No records match the selected filters.</p>
      </div>
    );
  }

  const pageTotals = pageRows.reduce((acc, row) => {
    acc.billed += parseFloat(row.gross_billed || '0');
    acc.discounts += parseFloat(row.discounts || '0') + parseFloat(row.waivers || '0');
    acc.net += parseFloat(row.net_expected || '0');
    acc.paid += parseFloat(row.paid || '0');
    acc.balance += parseFloat(row.balance || '0');
    return acc;
  }, { billed: 0, discounts: 0, net: 0, paid: 0, balance: 0 });

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Collection & Clearance Ledger</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            {rows.length} {groupBy === 'parent' ? 'families' : 'students'} • Grouped by {groupBy}
          </p>
        </div>
      </div>

      {/* On-screen view: paginated for readability. */}
      <div className="overflow-x-auto print:hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Name / Reference</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Gross Billed</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Concessions</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Net Expected</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Paid</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Balance Due</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">% Cleared</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((row: any) => {
              const totalConcessions = parseFloat(row.discounts || '0') + parseFloat(row.waivers || '0');

              // ── PARENT MODE: same shape as the billing ledger page —
              // a parent header row followed by one row per ward, then a
              // shared "Family Shared Fees" row if applicable. ──
              if (groupBy === 'parent') {
                return (
                  <React.Fragment key={`parent-${row.id}`}>
                    <tr className="bg-[#e9ecef] border-t border-slate-300 hover:bg-slate-200 transition-colors">
                      <td colSpan={2} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-slate-700" />
                          <span className="font-black text-slate-800 text-[13px] uppercase tracking-wide">{toTitleCase(row.name)}</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold rounded shadow-sm">{(row.children || []).length} Ward(s)</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-500">-{fmtMoney(totalConcessions)}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-700">{fmtMoney(row.net_expected)}</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">{fmtMoney(row.paid)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[15px] font-black ${row.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(row.balance)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">{clearedBadge(row.pct_paid)}</td>
                    </tr>

                    {(row.children || []).map((child: any) => (
                      <tr key={`stu-${child.id}`} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 pl-10">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{toTitleCase(child.name)}</span>
                            {child.class_name && <span className="text-[10px] font-bold text-slate-400 uppercase">{child.class_name}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-600">{fmtMoney(child.gross_billed)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-600">-{fmtMoney(parseFloat(child.discounts || '0') + parseFloat(child.waivers || '0'))}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-600">{fmtMoney(child.net_expected)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-600">{fmtMoney(child.paid)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-black ${child.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(child.balance)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">{clearedBadge(child.pct_paid)}</td>
                      </tr>
                    ))}

                    {row.family_invoice && (
                      <tr className="bg-purple-50/20 hover:bg-purple-50/50 transition-colors">
                        <td className="px-4 py-2.5 pl-10">
                          <div className="flex items-center gap-2">
                            <ShieldMinus className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-bold text-purple-900 text-xs">Family Shared Fees</span>
                            <span className="text-[9px] font-bold text-purple-400">{row.family_invoice.invoice_number}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium text-purple-700">{fmtMoney(row.family_invoice.billed)}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-emerald-600">-{fmtMoney(parseFloat(row.family_invoice.discounts || '0') + parseFloat(row.family_invoice.waivers || '0'))}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium text-purple-700">—</td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium text-purple-700">{fmtMoney(row.family_invoice.paid)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                    <tr className="border-0 bg-transparent"><td colSpan={7} className="h-2"></td></tr>
                  </React.Fragment>
                );
              }

              // ── STUDENT MODE: one flat row per student. Family-bound
              // fees are intentionally NOT summed into this row (see the
              // backend note on why) — only a non-numeric status badge is
              // shown so nothing here can double count across siblings. ──
              return (
                <tr key={`row-${row.id}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{toTitleCase(row.name)}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {row.class_name && <span className="text-[10px] font-bold text-slate-400 uppercase">{row.class_name}</span>}
                        {familyStatusBadge(row.family_fee_status)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-slate-500">{fmtMoney(row.gross_billed)}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-emerald-600">
                    {totalConcessions > 0 ? `-${fmtMoney(totalConcessions)}` : '₦0.00'}
                  </td>
                  <td className="px-4 py-3.5 text-right font-black text-slate-700">{fmtMoney(row.net_expected)}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-indigo-600">{fmtMoney(row.paid)}</td>
                  <td className="px-4 py-3.5 text-right font-black text-rose-600">{fmtMoney(row.balance)}</td>
                  <td className="px-4 py-3.5 text-center">{clearedBadge(row.pct_paid)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-800">
              <td className="px-4 py-3 text-[10px] uppercase tracking-widest">Page Totals ({pageRows.length} rows)</td>
              <td className="px-4 py-3 text-right">{fmtMoney(pageTotals.billed)}</td>
              <td className="px-4 py-3 text-right text-emerald-700">-{fmtMoney(pageTotals.discounts)}</td>
              <td className="px-4 py-3 text-right">{fmtMoney(pageTotals.net)}</td>
              <td className="px-4 py-3 text-right">{fmtMoney(pageTotals.paid)}</td>
              <td className="px-4 py-3 text-right text-rose-700">{fmtMoney(pageTotals.balance)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Print / PDF view: renders the FULL filtered `rows` set, not just
          the current on-screen page — "download all" must mean all. */}
      <div className="hidden print:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b-2 border-slate-900">
              <th className="py-2 text-left">Name</th>
              <th className="py-2 text-right">Billed</th>
              <th className="py-2 text-right">Concessions</th>
              <th className="py-2 text-right">Net Expected</th>
              <th className="py-2 text-right">Paid</th>
              <th className="py-2 text-right">Balance</th>
              <th className="py-2 text-right">% Cleared</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((row: any) => {
              const rowConcessions = parseFloat(row.discounts || '0') + parseFloat(row.waivers || '0');
              const parentLine = (
                <tr key={`p-print-${row.id}`} className="border-b border-slate-200 font-bold">
                  <td className="py-1.5">{toTitleCase(row.name)}{groupBy === 'parent' ? ` (${(row.children || []).length} ward(s))` : ''}</td>
                  <td className="py-1.5 text-right">{fmtMoney(row.gross_billed)}</td>
                  <td className="py-1.5 text-right">-{fmtMoney(rowConcessions)}</td>
                  <td className="py-1.5 text-right">{fmtMoney(row.net_expected)}</td>
                  <td className="py-1.5 text-right">{fmtMoney(row.paid)}</td>
                  <td className="py-1.5 text-right">{fmtMoney(row.balance)}</td>
                  <td className="py-1.5 text-right">{row.pct_paid ?? '—'}%</td>
                </tr>
              );
              if (groupBy !== 'parent') return [parentLine];
              const childLines = (row.children || []).map((child: any) => (
                <tr key={`c-print-${child.id}`} className="border-b border-slate-100 text-slate-600">
                  <td className="py-1 pl-4">↳ {toTitleCase(child.name)}</td>
                  <td className="py-1 text-right">{fmtMoney(child.gross_billed)}</td>
                  <td className="py-1 text-right">-{fmtMoney(parseFloat(child.discounts || '0') + parseFloat(child.waivers || '0'))}</td>
                  <td className="py-1 text-right">{fmtMoney(child.net_expected)}</td>
                  <td className="py-1 text-right">{fmtMoney(child.paid)}</td>
                  <td className="py-1 text-right">{fmtMoney(child.balance)}</td>
                  <td className="py-1 text-right">{child.pct_paid ?? '—'}%</td>
                </tr>
              ));
              return [parentLine, ...childLines];
            })}
          </tbody>
        </table>
      </div>

      {/* Client-side pagination — purely a display convenience. The dataset
          itself is already the full filtered set from the backend, so CSV
          export (page-level toolbar) and the print/PDF view above always
          cover everything, not just this page. */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <span className="text-xs font-bold text-slate-500">Page {page} of {totalPages} ({rows.length} total)</span>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 bg-white border border-slate-300 rounded shadow-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 bg-white border border-slate-300 rounded shadow-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}