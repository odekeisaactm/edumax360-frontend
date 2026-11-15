'use client';

/**
 * Shared payment-method UI for the wallet funding and fee checkout pages.
 *
 *  - PaymentMethodPicker   → "Pay Online" (recommended) vs "Bank Deposit" tiles
 *  - PaidToBankHint        → quiet escape hatch from online to offline
 *  - OnlinePaymentIntroModal → one-time announcement that online payment is live
 *  - useOneTimeFlag        → storage-backed "seen" flag that never throws
 */

import React, { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  ArrowRight, Check, Clock, CreditCard, Globe, Landmark,
  ShieldCheck, Smartphone, Sparkles, Upload, X, Zap,
} from 'lucide-react';

export type PaymentMode = 'online' | 'offline';

// ─── Storage keys ──────────────────────────────────────────────────────────────
export const ONLINE_INTRO_SEEN_KEY = 'ssaas.onlinePaymentIntro.seen.v1';

// ─── useOneTimeFlag ────────────────────────────────────────────────────────────
/**
 * Returns whether a flag has been set in local/session storage.
 * `ready` is false until the first client-side read, so callers can avoid
 * flashing a modal during SSR/hydration. Storage failures (private mode,
 * blocked site data) are treated as "not seen" and silently ignored.
 */
const FLAG_EVENT = 'ssaas:one-time-flag';
// In-memory fallback so a dismissed modal stays dismissed even when storage is blocked.
const memoryFlags = new Set<string>();

function getStore(scope: 'local' | 'session'): Storage | null {
  try {
    return scope === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function subscribeFlags(cb: () => void) {
  window.addEventListener(FLAG_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(FLAG_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useOneTimeFlag(key: string, scope: 'local' | 'session' = 'local') {
  const memKey = `${scope}:${key}`;
  // Snapshot: '1' seen, '0' not seen, null on the server (not ready yet).
  const snapshot = useSyncExternalStore<string | null>(
    subscribeFlags,
    () => {
      if (memoryFlags.has(memKey)) return '1';
      try {
        return getStore(scope)?.getItem(key) === '1' ? '1' : '0';
      } catch {
        return '0';
      }
    },
    () => null,
  );

  const markSeen = useCallback(() => {
    memoryFlags.add(memKey);
    try { getStore(scope)?.setItem(key, '1'); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(FLAG_EVENT));
  }, [key, scope, memKey]);

  return { ready: snapshot !== null, seen: snapshot === '1', markSeen };
}

// ─── ModalShell ────────────────────────────────────────────────────────────────
/** Accessible modal frame: backdrop, Esc to close, body scroll lock. */
export function ModalShell({
  open, onClose, labelledBy, children, maxWidth = 'max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`bg-white w-full ${maxWidth} rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ─── PaymentMethodPicker ───────────────────────────────────────────────────────
interface PickerProps {
  value: PaymentMode;
  onChange: (mode: PaymentMode) => void;
  /** School has at least one active payment gateway. */
  onlineAvailable: boolean;
  /** Gateway list is still loading. */
  loading?: boolean;
  /** Hide the section label (when the parent card already has a heading). */
  hideLabel?: boolean;
  /** Who confirms bank deposits, e.g. "the school" or "the finance office". */
  verifier?: string;
}

export function PaymentMethodPicker({
  value, onChange, onlineAvailable, loading = false, hideLabel = false, verifier = 'the school',
}: PickerProps) {
  const label = !hideLabel && (
    <p className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
      Payment Method
    </p>
  );

  if (loading) {
    return (
      <div>
        {label}
        <div className="grid grid-cols-2 gap-2.5" aria-busy="true">
          {[0, 1].map(i => (
            <div key={i} className="h-[88px] rounded-xl border-2 border-slate-100 bg-slate-50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // No gateway → bank deposit is the only route. Say so plainly instead of
  // showing a picker with one option.
  if (!onlineAvailable) {
    return (
      <div>
        {label}
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 border-slate-200 bg-slate-50/60">
          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-800">Bank Deposit</p>
            <p className="text-[11px] text-slate-500 font-medium leading-snug">
              Pay into a school account, then upload your receipt below.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tiles: {
    mode: PaymentMode;
    title: string;
    desc: string;
    meta: string;
    MetaIcon: typeof Zap;
    Icon: typeof Globe;
    badge?: string;
  }[] = [
    {
      mode: 'online', title: 'Pay Online', desc: 'Card, bank transfer or USSD',
      meta: 'Credited instantly', MetaIcon: Zap, Icon: Globe, badge: 'Recommended',
    },
    {
      mode: 'offline', title: 'Bank Deposit', desc: 'Already paid? Upload proof',
      meta: `Confirmed by ${verifier}`, MetaIcon: Clock, Icon: Landmark,
    },
  ];

  return (
    <div>
      {label}
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2.5">
        {tiles.map(t => {
          const active = value === t.mode;
          const online = t.mode === 'online';
          return (
            <button
              key={t.mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(t.mode)}
              className={`relative text-left p-3 rounded-xl border-2 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
                active
                  ? online
                    ? 'border-blue-500 bg-blue-50/60 shadow-sm shadow-blue-100'
                    : 'border-indigo-500 bg-indigo-50/60 shadow-sm shadow-indigo-100'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              {t.badge && (
                <span className="absolute -top-2 right-2.5 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-600 text-white shadow-sm">
                  {t.badge}
                </span>
              )}
              <div className="flex items-start gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  active
                    ? online ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  <t.Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-black leading-tight ${active ? 'text-slate-900' : 'text-slate-700'}`}>{t.title}</p>
                  <p className="text-[10.5px] text-slate-500 font-medium leading-snug mt-0.5">{t.desc}</p>
                </div>
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  active
                    ? online ? 'border-blue-600 bg-blue-600' : 'border-indigo-600 bg-indigo-600'
                    : 'border-slate-300 bg-white'
                }`}>
                  {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                </span>
              </div>
              <p className={`mt-2 flex items-center gap-1 text-[10px] font-bold ${
                active ? (online ? 'text-blue-700' : 'text-indigo-700') : 'text-slate-400'
              }`}>
                <t.MetaIcon className="w-3 h-3" /> {t.meta}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PaidToBankHint ────────────────────────────────────────────────────────────
/** Shown under the online form so parents who already paid at the bank can switch. */
export function PaidToBankHint({ onSwitch }: { onSwitch: () => void }) {
  return (
    <button
      type="button"
      onClick={onSwitch}
      className="group w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-dashed border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center shrink-0 transition-colors">
        <Upload className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-700">Already paid into the school&apos;s bank account?</p>
        <p className="text-[10.5px] text-slate-500 font-medium">Upload your receipt instead, no need to pay again.</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

// ─── OnlinePaymentIntroModal ───────────────────────────────────────────────────
export function OnlinePaymentIntroModal({
  open, onPayOnline, onPaidToBank, subject = 'fees',
}: {
  open: boolean;
  onPayOnline: () => void;
  onPaidToBank: () => void;
  /** What is being paid, used in the copy: "fees" or "wallet top-ups". */
  subject?: 'fees' | 'wallet';
}) {
  const headline = subject === 'fees'
    ? 'You can now pay school fees online'
    : 'You can now fund wallets online';
  const sub = subject === 'fees'
    ? 'No more bank queues or uploading receipts. Pay in a few taps and your ledger updates the moment payment goes through.'
    : 'Top up in a few taps. The wallet is credited the moment payment goes through, with no receipt to upload or wait for.';

  const perks = [
    { Icon: CreditCard, text: 'Pay with card, bank transfer or USSD' },
    { Icon: Zap, text: 'Credited instantly, with no manual confirmation' },
    { Icon: ShieldCheck, text: 'Secured by a licensed payment provider' },
  ];

  return (
    <ModalShell open={open} onClose={onPayOnline} labelledBy="online-intro-title">
      <div className="relative px-6 pt-7 pb-6 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" aria-hidden />
        <div className="absolute right-10 bottom-[-3rem] w-28 h-28 rounded-full bg-white/5" aria-hidden />
        <button
          onClick={onPayOnline}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-white/15 border border-white/20">
          <Sparkles className="w-3 h-3" /> New
        </span>
        <div className="flex items-center gap-3 mt-4">
          <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <h2 id="online-intro-title" className="text-lg font-black leading-tight">{headline}</h2>
        </div>
        <p className="text-[12.5px] text-blue-50/90 font-medium leading-relaxed mt-3">{sub}</p>
      </div>

      <div className="px-6 py-5 space-y-3 overflow-y-auto">
        {perks.map(({ Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-xs font-bold text-slate-700">{text}</p>
          </div>
        ))}

        <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
          <Landmark className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-amber-900 font-medium leading-relaxed">
            <span className="font-black">Already paid at the bank?</span> You don&apos;t need to pay again.
            Choose <span className="font-black">Bank Deposit</span> and upload your receipt as usual.
          </p>
        </div>
      </div>

      <div className="px-6 pb-6 pt-1 flex flex-col-reverse sm:flex-row gap-2.5">
        <button
          onClick={onPaidToBank}
          className="flex-1 px-4 py-3 text-xs font-black text-slate-700 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2"
        >
          <Upload className="w-3.5 h-3.5" /> I&apos;ve paid at the bank
        </button>
        <button
          onClick={onPayOnline}
          autoFocus
          className="flex-1 px-4 py-3 text-xs font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors flex items-center justify-center gap-2"
        >
          <Globe className="w-3.5 h-3.5" /> Pay online <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </ModalShell>
  );
}
