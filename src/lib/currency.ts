/**
 * Multi-currency display helpers for finance pages.
 *
 * Rule: a figure is always shown in its OWN currency. Amounts in different
 * currencies are never converted or added together on the client.
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

export interface CurrencyCatalog {
  base: string;
  list: CurrencyInfo[];
  byCode: Record<string, CurrencyInfo>;
}

const FALLBACK_SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', EUR: '€', GBP: '£', GHS: '₵', KES: 'KSh', ZAR: 'R', XOF: 'CFA', CAD: 'C$',
};

/** Build a catalogue from FinanceSettings.currency_config (and optional extra codes, e.g. from bank accounts). */
export function buildCurrencyCatalog(settings: any, extraCodes: string[] = []): CurrencyCatalog {
  const cfg = settings?.currency_config || {};
  const base = String(cfg.base_currency || 'NGN').toUpperCase();
  const supported: Record<string, any> = cfg.supported_currencies || {};

  const codes: string[] = [base];
  Object.keys(supported).forEach(k => { const c = k.toUpperCase(); if (!codes.includes(c)) codes.push(c); });
  extraCodes.forEach(k => { const c = String(k || '').toUpperCase(); if (c && !codes.includes(c)) codes.push(c); });

  const list = codes.map(code => {
    const m = supported[code] || supported[code.toLowerCase()] || {};
    return { code, name: m.name || code, symbol: m.symbol || FALLBACK_SYMBOLS[code] || '' };
  });
  return { base, list, byCode: Object.fromEntries(list.map(c => [c.code, c])) };
}

export function currencySymbol(code: string | null | undefined, catalog?: CurrencyCatalog | null): string {
  const c = String(code || '').toUpperCase();
  return catalog?.byCode[c]?.symbol || FALLBACK_SYMBOLS[c] || '';
}

/** "₦12,500.00" — or "XYZ 12,500.00" when no symbol is known. */
export function fmtCurrency(
  amount: string | number | null | undefined,
  code: string | null | undefined,
  catalog?: CurrencyCatalog | null,
  opts: { decimals?: number } = {},
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  const decimals = opts.decimals ?? 2;
  const body = Math.abs(safe).toLocaleString('en-NG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sym = currencySymbol(code, catalog);
  const prefix = sym || (code ? `${String(code).toUpperCase()} ` : '');
  return `${safe < 0 ? '-' : ''}${prefix}${body}`;
}

/** Compact axis label: ₦1.2M, $450k. */
export function fmtCompact(value: number, code: string | null | undefined, catalog?: CurrencyCatalog | null): string {
  const sym = currencySymbol(code, catalog) || '';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(0)}k`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}
