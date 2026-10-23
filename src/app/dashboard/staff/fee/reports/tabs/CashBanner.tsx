'use client';

import React from 'react';
import { Wallet } from 'lucide-react';

const n = (v: any): number => {
  const x = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
};

function fmtMoney(amount: string | number): string {
  return '₦' + n(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(s: string): string {
  if (!s) return '';
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Stat({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`mt-0.5 ${strong ? 'text-base font-black text-indigo-800' : 'text-sm font-bold text-slate-800'}`}>
        {fmtMoney(value)}
      </p>
    </div>
  );
}

/**
 * Always-visible reconciliation block for date-range reports.
 * total received = applied to invoices & debts + wallet top-ups.
 * Shown even when wallet top-ups are zero, so the figures never look incomplete.
 * Figures cover the whole school and all sessions.
 */
export default function CashBanner({ summary, scopeLabel, variant }: {
  summary?: any;
  scopeLabel: string;
  variant: 'table' | 'chart';
}) {
  if (!summary) return null;
  const unallocated = n(summary.unallocated);

  return (
    <div className="mx-5 mt-4 mb-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 print:mx-0 print:bg-white print:border-slate-300">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-900">
        <Wallet className="w-3.5 h-3.5 shrink-0 print:hidden" />
        Money received {fmtDate(summary.start_date)} – {fmtDate(summary.end_date)} · {scopeLabel}
      </p>

      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Applied to invoices & debts" value={n(summary.applied)} />
        <Stat label="Wallet top-ups (overpayments)" value={n(summary.wallet_topups)} />
        <Stat label="Total received" value={n(summary.total_received)} strong />
      </div>

      {unallocated > 0.005 && (
        <p className="mt-2 text-[11px] font-bold text-amber-700">
          {fmtMoney(unallocated)} of received money is not allocated to any invoice, debt or wallet.
        </p>
      )}

      <p className="mt-2.5 text-[11px] font-medium text-slate-500 leading-snug">
        These three figures cover the whole school and all sessions.{' '}
        {variant === 'table'
          ? 'The table below follows your filters and counts only money applied to invoices and debts — wallet top-ups never appear in it.'
          : scopeLabel.startsWith('Session')
            ? `The chart shows only money applied to ${scopeLabel.toLowerCase()}; wallet top-ups are not tied to a session.`
            : 'The chart shows total received each day, wallet top-ups included.'}
      </p>
    </div>
  );
}