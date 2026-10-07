'use client';

import React, { useMemo, useState } from 'react';
import { Users, FileText, ShieldMinus, ChevronLeft, ChevronRight } from 'lucide-react';

const n = (v: any): number => {
  const x = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
};

function fmtMoney(amount: string | number): string {
  return '₦' + n(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

interface Sums { billed: number; conc: number; net: number; paid: number; balance: number; }
const ZERO_SUMS: Sums = { billed: 0, conc: 0, net: 0, paid: 0, balance: 0 };
const sumsFrom = (t: any): Sums => ({
  billed: n(t.gross_billed), conc: n(t.discounts) + n(t.waivers),
  net: n(t.net_expected), paid: n(t.paid), balance: n(t.balance),
});
const addSums = (a: Sums, b: Sums): Sums => ({
  billed: a.billed + b.billed, conc: a.conc + b.conc, net: a.net + b.net,
  paid: a.paid + b.paid, balance: a.balance + b.balance,
});
const pctOf = (s: Sums): number | null => (s.net > 0 ? Math.min(100, Math.round((s.paid / s.net) * 1000) / 10) : null);

const clearedBadge = (pct: number | null) => {
  if (pct === null || pct === undefined) return <span className="px-2 py-0.5 text-[10px] font-black rounded-md border bg-slate-50 text-slate-400 border-slate-200">N/A</span>;
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

/** Compact "Name (Class) · Name (Class)" line — wraps naturally, takes one or two lines. */
function WardsLine({ wards, className = '' }: { wards?: { name: string; class_name?: string }[]; className?: string }) {
  if (!wards || wards.length === 0) return null;
  const text = wards
    .map(w => (w.class_name ? `${toTitleCase(w.name)} (${w.class_name})` : toTitleCase(w.name)))
    .join('  ·  ');
  return <p className={`text-[10px] font-medium text-slate-500 leading-snug whitespace-normal ${className}`}>{text}</p>;
}

function TotalRow({ label, sums, className = '', pad = 'py-3', showPct = true }: {
  label: string; sums: Sums; className?: string; pad?: string; showPct?: boolean;
}) {
  const pct = pctOf(sums);
  return (
    <tr className={className}>
      <td className={`px-3 ${pad} text-[10px] uppercase tracking-widest`}>{label}</td>
      <td className={`px-3 ${pad} text-right`}>{fmtMoney(sums.billed)}</td>
      <td className={`px-3 ${pad} text-right`}>-{fmtMoney(sums.conc)}</td>
      <td className={`px-3 ${pad} text-right`}>{fmtMoney(sums.net)}</td>
      <td className={`px-3 ${pad} text-right`}>{fmtMoney(sums.paid)}</td>
      <td className={`px-3 ${pad} text-right`}>{fmtMoney(sums.balance)}</td>
      <td className={`px-3 ${pad} text-center`}>{showPct && pct !== null ? `${pct}%` : ''}</td>
    </tr>
  );
}

const PAGE_SIZE = 25;
const TH = 'px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest';

export default function CollectionsTab({ data, totals, familyTotals, groupBy, reportTitle }: {
  data: any[] | null; totals?: any; familyTotals?: any; groupBy: string; reportTitle: string;
}) {
  const [page, setPage] = useState(1);

  const rows: any[] = Array.isArray(data) ? data : [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);

  React.useEffect(() => { setPage(1); }, [rows.length]);

  // Grand total comes from the backend (full filtered set). Falls back to
  // summing every row — never just the visible page.
  const grand = useMemo<Sums>(
    () => (totals ? sumsFrom(totals) : rows.reduce<Sums>((a, r) => addSums(a, sumsFrom(r)), ZERO_SUMS)),
    [totals, rows],
  );
  const family = useMemo<Sums | null>(() => (familyTotals ? sumsFrom(familyTotals) : null), [familyTotals]);
  const combined = useMemo<Sums | null>(() => (family ? addSums(grand, family) : null), [grand, family]);
  const pageSums = useMemo<Sums>(() => pageRows.reduce<Sums>((a, r) => addSums(a, sumsFrom(r)), ZERO_SUMS), [pageRows]);

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

  const noun = groupBy === 'parent' ? 'families' : 'students';
  const count = totals?.count ?? rows.length;

  const screenTotalCls = 'bg-slate-900 text-white font-black';
  const screenSubCls = 'bg-slate-100 text-slate-800 font-black border-t-2 border-slate-300';
  const screenFamilyCls = 'bg-purple-50 text-purple-900 font-bold';
  const printTotalCls = 'bg-slate-100 text-slate-900 font-black border-t-2 border-slate-900';
  const printFamilyCls = 'text-slate-700 font-bold border-t border-slate-300';

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Collection & Clearance Ledger</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            {count} {noun} • Grouped by {groupBy}
          </p>
        </div>
      </div>

      {/* ───────── On-screen view (paginated) ───────── */}
      <div className="overflow-x-auto print:hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
            <tr>
              <th className={TH}>Name / Reference</th>
              <th className={`${TH} text-right`}>Gross Billed</th>
              <th className={`${TH} text-right`}>Concessions</th>
              <th className={`${TH} text-right`}>Net Expected</th>
              <th className={`${TH} text-right`}>Paid</th>
              <th className={`${TH} text-right`}>Balance Due</th>
              <th className={`${TH} text-center`}>% Cleared</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((row: any) => {
              const totalConcessions = n(row.discounts) + n(row.waivers);

              if (groupBy === 'parent') {
                const children: any[] = row.children || [];
                const fi = row.family_invoice;
                const fiConc = fi ? n(fi.discounts) + n(fi.waivers) : 0;
                const fiNet = fi ? n(fi.billed) - fiConc : 0;
                const fiBal = fi ? Math.max(fiNet - n(fi.paid), 0) : 0;

                return (
                  <React.Fragment key={`parent-${row.id}`}>
                    <tr className="bg-[#e9ecef] border-t border-slate-300 hover:bg-slate-200 transition-colors">
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-slate-700 shrink-0" />
                          <span className="font-black text-slate-800 text-[13px] uppercase tracking-wide">{toTitleCase(row.name)}</span>
                        </div>
                        {children.length === 0 && <WardsLine wards={row.wards} className="pl-6 mt-1 max-w-md" />}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-600 align-top">{fmtMoney(row.gross_billed)}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-500 align-top">-{fmtMoney(totalConcessions)}</td>
                      <td className="px-3 py-3 text-right font-black text-slate-700 align-top">{fmtMoney(row.net_expected)}</td>
                      <td className="px-3 py-3 text-right font-bold text-indigo-600 align-top">{fmtMoney(row.paid)}</td>
                      <td className="px-3 py-3 text-right align-top">
                        <span className={`text-[15px] font-black ${n(row.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(row.balance)}</span>
                      </td>
                      <td className="px-3 py-3 text-center align-top">{clearedBadge(row.pct_paid)}</td>
                    </tr>

                    {children.map((child: any) => (
                      <tr key={`stu-${child.id}`} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 pl-10">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{toTitleCase(child.name)}</span>
                            {child.class_name && <span className="text-[10px] font-bold text-slate-400 uppercase">{child.class_name}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-600">{fmtMoney(child.gross_billed)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-600">-{fmtMoney(n(child.discounts) + n(child.waivers))}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-600">{fmtMoney(child.net_expected)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-600">{fmtMoney(child.paid)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`font-black ${n(child.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(child.balance)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">{clearedBadge(child.pct_paid)}</td>
                      </tr>
                    ))}

                    {fi && (
                      <tr className="bg-purple-50/20 hover:bg-purple-50/50 transition-colors">
                        <td className="px-3 py-2.5 pl-10">
                          <div className="flex items-center gap-2">
                            <ShieldMinus className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="font-bold text-purple-900 text-xs">Family Shared Fees</span>
                            <span className="text-[9px] font-bold text-purple-400">{fi.invoice_number}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-medium text-purple-700">{fmtMoney(fi.billed)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-600">-{fmtMoney(fiConc)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-medium text-purple-700">{fmtMoney(fiNet)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-medium text-purple-700">{fmtMoney(fi.paid)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-purple-700">{fmtMoney(fiBal)}</td>
                        <td></td>
                      </tr>
                    )}
                    <tr className="border-0 bg-transparent"><td colSpan={7} className="h-2"></td></tr>
                  </React.Fragment>
                );
              }

              // STUDENT MODE — family-bound fees are not summed into the row.
              return (
                <tr key={`row-${row.id}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{toTitleCase(row.name)}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {row.class_name && <span className="text-[10px] font-bold text-slate-400 uppercase">{row.class_name}</span>}
                        {familyStatusBadge(row.family_fee_status)}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-medium text-slate-500">{fmtMoney(row.gross_billed)}</td>
                  <td className="px-3 py-3.5 text-right font-bold text-emerald-600">
                    {totalConcessions > 0 ? `-${fmtMoney(totalConcessions)}` : '₦0.00'}
                  </td>
                  <td className="px-3 py-3.5 text-right font-black text-slate-700">{fmtMoney(row.net_expected)}</td>
                  <td className="px-3 py-3.5 text-right font-bold text-indigo-600">{fmtMoney(row.paid)}</td>
                  <td className="px-3 py-3.5 text-right font-black text-rose-600">{fmtMoney(row.balance)}</td>
                  <td className="px-3 py-3.5 text-center">{clearedBadge(row.pct_paid)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {totalPages > 1 && (
              <TotalRow label={`This page (${pageRows.length})`} sums={pageSums} showPct={false}
                className="bg-slate-50 border-t-2 border-slate-300 text-slate-500 font-bold" pad="py-2" />
            )}
            <TotalRow
              label={family ? `Student fees total (${count} ${noun})` : `Grand total (${count} ${noun})`}
              sums={grand} className={family ? screenSubCls : screenTotalCls}
            />
            {family && combined && (
              <>
                <TotalRow label="Family fees (billed to parents)" sums={family} className={screenFamilyCls} pad="py-2.5" />
                <TotalRow label="Combined total" sums={combined} className={screenTotalCls} />
              </>
            )}
          </tfoot>
        </table>
      </div>

      {/* ───────── Print / PDF view: the FULL filtered set ───────── */}
      <div className="hidden print:block">
        <table className="w-full text-left text-[11px] print-table">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-900">
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider">Name</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-right">Billed</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-right">Concessions</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-right">Net Expected</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-right">Paid</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-right">Balance</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-right">% Cleared</th>
            </tr>
          </thead>

          {groupBy === 'parent' ? (
            rows.map((row: any) => {
              const children: any[] = row.children || [];
              const fi = row.family_invoice;
              return (
                <tbody key={`pg-${row.id}`} className="print-group">
                  <tr className="bg-slate-100 border-t border-slate-300">
                    <td className="px-3 py-2">
                      <span className="font-bold text-slate-900">{toTitleCase(row.name)}</span>
                      {children.length === 0 && <WardsLine wards={row.wards} className="mt-0.5" />}
                    </td>
                    <td className="px-3 py-2 text-right font-bold align-top">{fmtMoney(row.gross_billed)}</td>
                    <td className="px-3 py-2 text-right font-bold align-top">-{fmtMoney(n(row.discounts) + n(row.waivers))}</td>
                    <td className="px-3 py-2 text-right font-bold align-top">{fmtMoney(row.net_expected)}</td>
                    <td className="px-3 py-2 text-right font-bold align-top">{fmtMoney(row.paid)}</td>
                    <td className="px-3 py-2 text-right font-bold align-top">{fmtMoney(row.balance)}</td>
                    <td className="px-3 py-2 text-right font-bold align-top">{row.pct_paid ?? '—'}%</td>
                  </tr>
                  {children.map((child: any) => (
                    <tr key={`c-${child.id}`} className="border-b border-slate-100 text-slate-600">
                      <td className="px-3 py-1.5 pl-8">
                        ↳ {toTitleCase(child.name)}
                        {child.class_name && <span className="text-slate-400"> · {child.class_name}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">{fmtMoney(child.gross_billed)}</td>
                      <td className="px-3 py-1.5 text-right">-{fmtMoney(n(child.discounts) + n(child.waivers))}</td>
                      <td className="px-3 py-1.5 text-right">{fmtMoney(child.net_expected)}</td>
                      <td className="px-3 py-1.5 text-right">{fmtMoney(child.paid)}</td>
                      <td className="px-3 py-1.5 text-right">{fmtMoney(child.balance)}</td>
                      <td className="px-3 py-1.5 text-right">{child.pct_paid ?? '—'}{child.pct_paid != null ? '%' : ''}</td>
                    </tr>
                  ))}
                  {fi && (
                    <tr className="border-b border-slate-100 text-slate-500 italic">
                      <td className="px-3 py-1.5 pl-8">↳ Family shared fees ({fi.invoice_number})</td>
                      <td className="px-3 py-1.5 text-right">{fmtMoney(fi.billed)}</td>
                      <td className="px-3 py-1.5 text-right">-{fmtMoney(n(fi.discounts) + n(fi.waivers))}</td>
                      <td className="px-3 py-1.5 text-right">{fmtMoney(n(fi.billed) - n(fi.discounts) - n(fi.waivers))}</td>
                      <td className="px-3 py-1.5 text-right">{fmtMoney(fi.paid)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                </tbody>
              );
            })
          ) : (
            <tbody>
              {rows.map((row: any) => (
                <tr key={`ps-${row.id}`} className="border-b border-slate-200">
                  <td className="px-3 py-2">
                    <span className="font-bold text-slate-900">{toTitleCase(row.name)}</span>
                    {row.class_name && <span className="text-slate-400"> · {row.class_name}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtMoney(row.gross_billed)}</td>
                  <td className="px-3 py-2 text-right">-{fmtMoney(n(row.discounts) + n(row.waivers))}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(row.net_expected)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(row.paid)}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmtMoney(row.balance)}</td>
                  <td className="px-3 py-2 text-right">{row.pct_paid ?? '—'}%</td>
                </tr>
              ))}
            </tbody>
          )}

          <tfoot className="print-once">
            <TotalRow
              label={family ? 'Student fees total' : 'Grand total'}
              sums={grand} className={printTotalCls} pad="py-2.5"
            />
            {family && combined && (
              <>
                <TotalRow label="Family fees (billed to parents)" sums={family} className={printFamilyCls} pad="py-2" />
                <TotalRow label="Combined total" sums={combined} className={printTotalCls} pad="py-2.5" />
              </>
            )}
          </tfoot>
        </table>
      </div>

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