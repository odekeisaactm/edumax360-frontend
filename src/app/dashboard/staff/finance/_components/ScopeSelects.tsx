'use client';

import React from 'react';
import { Coins } from 'lucide-react';
import type { FinanceScope } from './useFinanceScope';
import { periodName } from './useFinanceScope';

const selectCls =
  'px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 min-w-0';

/** Session → period → currency selects. The currency select only shows for multi-currency schools. */
export default function ScopeSelects({ scope, showPeriod = true }: { scope: FinanceScope; showPeriod?: boolean }) {
  const { sessions, periods, sessionId, periodId, currency, catalog, labels } = scope;
  const multi = (catalog?.list.length || 0) > 1;

  return (
    <>
      <select aria-label="Session" value={sessionId} onChange={e => scope.setSessionId(e.target.value)} className={selectCls}>
        <option value="">All sessions</option>
        {sessions.map((s: any) => <option key={s.id} value={s.id}>Session {s.start_year}/{s.end_year}</option>)}
      </select>

      {showPeriod && (
        <select aria-label={labels.singular} value={periodId} onChange={e => scope.setPeriodId(e.target.value)} disabled={!sessionId} className={selectCls}>
          <option value="">{sessionId ? `Whole session (all ${labels.plural.toLowerCase()})` : `All ${labels.plural.toLowerCase()}`}</option>
          {periods.map(p => <option key={p.id} value={p.id}>{periodName(p)}{p.is_current ? ' · Current' : ''}</option>)}
        </select>
      )}

      {multi && (
        <div className="relative">
          <Coins className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <select
            aria-label="Currency"
            title="Figures are shown one currency at a time — currencies are never converted or added together."
            value={currency}
            onChange={e => scope.setCurrency(e.target.value)}
            className={`${selectCls} pl-8`}
          >
            {catalog?.list.map(c => (
              <option key={c.code} value={c.code}>{c.code}{c.symbol ? ` (${c.symbol})` : ''}{c.code === catalog.base ? ' · Base' : ''}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
