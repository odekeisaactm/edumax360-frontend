'use client';

/**
 * Shared filter scope for the finance dashboard and reports:
 * session → period (school's own labels) → currency (one at a time).
 * Defaults to the current session, the current period and the base currency.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { academicCalendarAPI, financeSettingsAPI, bankDetailsAPI } from '@/lib/api';
import type { Session, AcademicSessionPeriod } from '@/lib/types';
import { buildCurrencyCatalog, type CurrencyCatalog } from '@/lib/currency';
import { usePeriodLabels, type PeriodLabels } from '@/lib/usePeriodLabels';

export interface FinanceScope {
  ready: boolean;
  sessions: Session[];
  periods: AcademicSessionPeriod[];
  sessionId: string;
  periodId: string;
  currency: string;
  catalog: CurrencyCatalog | null;
  labels: PeriodLabels;
  setSessionId: (id: string) => void;
  setPeriodId: (id: string) => void;
  setCurrency: (code: string) => void;
  sessionLabel: string;
  periodLabel: string;
}

function periodName(p?: AcademicSessionPeriod | null): string {
  return (p as any)?.name || p?.period?.name || '';
}

export function useFinanceScope(opts: { defaultToCurrentPeriod?: boolean } = {}): FinanceScope {
  const { defaultToCurrentPeriod = true } = opts;
  const labels = usePeriodLabels();

  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [sessionId, setSessionIdState] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [currency, setCurrency] = useState('');
  const [catalog, setCatalog] = useState<CurrencyCatalog | null>(null);

  const loadPeriods = useCallback(async (sid: string, pickCurrent: boolean) => {
    if (!sid) { setPeriods([]); setPeriodId(''); return; }
    try {
      const list = await academicCalendarAPI.listSessionPeriods({ session_id: Number(sid) });
      const sorted = [...(Array.isArray(list) ? list : [])].sort(
        (a, b) => (a.period?.order ?? 0) - (b.period?.order ?? 0)
      );
      setPeriods(sorted);
      if (pickCurrent) {
        const cur = sorted.find(p => p.is_current);
        setPeriodId(cur ? String(cur.id) : '');
      } else {
        setPeriodId('');
      }
    } catch {
      setPeriods([]); setPeriodId('');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [sessRes, curRaw, settings, banks] = await Promise.all([
        academicCalendarAPI.listSessions().catch(() => []),
        academicCalendarAPI.getCurrentSession().catch(() => null),
        financeSettingsAPI.get().catch(() => null),
        bankDetailsAPI.list({ is_active: true } as any).catch(() => []),
      ]);
      if (!alive) return;

      const list: Session[] = Array.isArray(sessRes) ? [...sessRes].sort((a: any, b: any) => (b.start_year ?? 0) - (a.start_year ?? 0)) : [];
      setSessions(list);

      const bankList: any[] = Array.isArray(banks) ? banks : (banks as any)?.results ?? [];
      const cat = buildCurrencyCatalog(settings, bankList.map(b => b.currency));
      setCatalog(cat);
      setCurrency(cat.base);

      const cur: any = (curRaw as any)?.data?.data || (curRaw as any)?.data || curRaw;
      const sid = cur?.id ? String(cur.id) : (list[0]?.id ? String(list[0].id) : '');
      setSessionIdState(sid);
      await loadPeriods(sid, defaultToCurrentPeriod);
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [loadPeriods, defaultToCurrentPeriod]);

  const setSessionId = useCallback((id: string) => {
    setSessionIdState(id);
    loadPeriods(id, false);
  }, [loadPeriods]);

  const sessionLabel = useMemo(() => {
    const s: any = sessions.find(x => String(x.id) === sessionId);
    return s ? `${s.start_year}/${s.end_year}` : '';
  }, [sessions, sessionId]);
  const periodLabel = useMemo(() => periodName(periods.find(p => String(p.id) === periodId)), [periods, periodId]);

  return {
    ready, sessions, periods, sessionId, periodId, currency, catalog, labels,
    setSessionId, setPeriodId, setCurrency, sessionLabel, periodLabel,
  };
}

export { periodName };
