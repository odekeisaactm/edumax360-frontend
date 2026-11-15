'use client';

/**
 * Tenant-specific academic period naming (Term / Quarter / Semester …),
 * read from the school's active period type (Academic Calendar → Period Types).
 */
import { useEffect, useState } from 'react';
import { academicCalendarAPI } from '@/lib/api';

export interface PeriodLabels {
  /** "Term", "Quarter" … */
  singular: string;
  /** "Terms", "Quarters" … */
  plural: string;
}

export const DEFAULT_PERIOD_LABELS: PeriodLabels = { singular: 'Term', plural: 'Terms' };

function titleCase(s: string): string {
  return s.split(' ').filter(Boolean).map(w => (/^[A-Z]{2,6}$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
}

export function labelsFromPeriodTypes(types: unknown): PeriodLabels {
  if (!Array.isArray(types) || types.length === 0) return DEFAULT_PERIOD_LABELS;
  const active: any = types.find((t: any) => t?.is_active) ?? (types.length === 1 ? types[0] : null);
  if (!active) return DEFAULT_PERIOD_LABELS;
  const singular = titleCase(String(active.singular_name || '').trim()) || DEFAULT_PERIOD_LABELS.singular;
  const plural = titleCase(String(active.plural_name || '').trim()) || `${singular}s`;
  return { singular, plural };
}

let cache: PeriodLabels | null = null;
let inflight: Promise<PeriodLabels> | null = null;

function load(): Promise<PeriodLabels> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = academicCalendarAPI.listPeriodTypes()
      .then(types => (cache = labelsFromPeriodTypes(types)))
      .catch(() => DEFAULT_PERIOD_LABELS)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Returns the school's period labels; falls back to Term/Terms until loaded or on error. */
export function usePeriodLabels(): PeriodLabels {
  const [labels, setLabels] = useState<PeriodLabels>(cache ?? DEFAULT_PERIOD_LABELS);
  useEffect(() => {
    let alive = true;
    load().then(l => { if (alive) setLabels(l); });
    return () => { alive = false; };
  }, []);
  return labels;
}
