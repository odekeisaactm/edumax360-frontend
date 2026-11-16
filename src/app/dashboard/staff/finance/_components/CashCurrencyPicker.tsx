'use client';

/**
 * "Which currency is this cash in?" — shown when the payment method is Cash.
 *
 * Cash vaults are currency-specific (a Naira safe, a Dollar cash box …). The
 * select lists every configured currency; ones without an active cash vault are
 * disabled with a hint. Hidden entirely for single-currency schools.
 */
import React from 'react';
import Link from 'next/link';
import { Wallet, AlertTriangle, Coins } from 'lucide-react';
import { fmtCurrency, type CurrencyCatalog } from '@/lib/currency';

export interface CashVaultLite {
  id: number;
  bank_name: string;
  currency?: string | null;
  current_balance?: string | number | null;
}

export function vaultsInCurrency<T extends CashVaultLite>(vaults: T[], code: string, base: string): T[] {
  return vaults.filter(v => String(v.currency || base).toUpperCase() === code);
}

export default function CashCurrencyPicker({
  catalog, vaults, value, onChange, direction, className = '', hideLabel = false,
}: {
  catalog: CurrencyCatalog;
  vaults: CashVaultLite[];
  value: string;
  onChange: (code: string) => void;
  /** 'in' = cash received into a vault, 'out' = cash paid from a vault. */
  direction: 'in' | 'out';
  className?: string;
  /** Hide the built-in label when the parent form already labels the field. */
  hideLabel?: boolean;
}) {
  const multi = catalog.list.length > 1;
  const matching = vaultsInCurrency(vaults, value, catalog.base);
  const verb = direction === 'in' ? 'Into' : 'From';

  return (
    <div className={className}>
      {multi && (
        <>
          {!hideLabel && (
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Cash Currency <span className="text-red-500">*</span>
            </label>
          )}
          <div className="relative">
            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <select
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 text-sm font-bold border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              {catalog.list.map(c => {
                const has = vaultsInCurrency(vaults, c.code, catalog.base).length > 0;
                return (
                  <option key={c.code} value={c.code} disabled={!has}>
                    {c.code}{c.symbol ? ` (${c.symbol})` : ''}{c.code === catalog.base ? ' · Base' : ''}
                    {!has ? ` — no ${c.code} cash box yet` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </>
      )}

      <div className={`${multi ? 'mt-2' : ''}`}>
        {matching.length === 1 ? (
          <div className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 min-w-0">
              <Wallet className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="truncate">{verb} <strong className="text-slate-800">{matching[0].bank_name}</strong></span>
            </span>
            <span className="text-xs font-bold text-slate-500 tabular-nums shrink-0">
              Bal: {fmtCurrency(matching[0].current_balance ?? 0, value, catalog)}
            </span>
          </div>
        ) : matching.length > 1 ? (
          <div className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-600 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-slate-400 shrink-0" />
            <span>{verb} your assigned <strong className="text-slate-800">{value}</strong> cash box</span>
          </div>
        ) : (
          <div className="px-3.5 py-2.5 text-xs border border-amber-200 rounded-xl bg-amber-50 text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              No active <strong>{value}</strong> cash box exists.{' '}
              <Link href="/dashboard/staff/finance/bank-accounts" className="font-bold underline">Create one under Bank Accounts</Link>{' '}
              to {direction === 'in' ? 'receive' : 'pay out'} {value} cash.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
