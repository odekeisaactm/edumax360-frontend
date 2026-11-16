'use client';

/**
 * Wallet Balances — every student (fee / canteen) and staff wallet holding money,
 * with automatic detection of wallets that no longer tally with their own ledger,
 * and decrease-only corrections that are posted to the ledger with a reason.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicAPI } from '@/lib/api';
import {
  walletBalancesAPI, type StudentWalletRow, type StaffWalletRow, type WalletKind, type WalletShow,
  type CorrectionMode, type WalletBalancesResponse,
} from '@/lib/walletBalances';
import {
  Wallet, Search, Loader2, AlertTriangle, CheckCircle2, X, ChevronLeft, ChevronRight, ShieldAlert,
  GraduationCap, Briefcase, UtensilsCrossed, Coins, RotateCcw, Scale, Minus, Info, RefreshCw, Check,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const naira = (v: string | number | null | undefined) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
};
const num = (v: string | number | null | undefined) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const titleCase = (s?: string | null) => (s || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
const ago = (iso: string | null) => {
  if (!iso) return 'No activity';
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'Today';
  if (d < 2) return 'Yesterday';
  if (d < 30) return `${Math.floor(d)} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const SHOW_OPTIONS: { key: WalletShow; label: string }[] = [
  { key: 'with_balance', label: 'With balance' },
  { key: 'out_of_sync', label: 'Out of sync' },
  { key: 'negative', label: 'In debt' },
  { key: 'all', label: 'All wallets' },
];
const PAGE_SIZE = 25;

type AnyRow = StudentWalletRow | StaffWalletRow;
interface CorrectTarget {
  kind: WalletKind;
  row: AnyRow;
  field: 'fee' | 'canteen' | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WalletBalancesPage() {
  const { user, hasPermission } = useAuth();
  const canView = user?.is_superuser || hasPermission('finance.view_wallettransactionmodel')
    || hasPermission('finance.view_staffwallettransactionmodel') || hasPermission('finance.view_studentfundingmodel');
  const canCorrect = user?.is_superuser || hasPermission('finance.correct_wallet');

  const [kind, setKind] = useState<WalletKind>('student');
  const [show, setShow] = useState<WalletShow>('with_balance');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);

  const [result, setResult] = useState<{ key: string; data: WalletBalancesResponse<AnyRow> | null; error: string | null } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, AnyRow>>({});
  const [target, setTarget] = useState<CorrectTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const latestKey = useRef('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    academicAPI.listClasses().then((list: any) => setClasses(Array.isArray(list) ? list : list?.results || [])).catch(() => {});
  }, []);

  const requestKey = JSON.stringify([kind, show, debounced, kind === 'student' ? classId : '', page, nonce]);

  useEffect(() => {
    latestKey.current = requestKey;
    walletBalancesAPI.list<AnyRow>({
      kind, show, page, page_size: PAGE_SIZE,
      ...(debounced ? { search: debounced } : {}),
      ...(kind === 'student' && classId ? { class_id: classId } : {}),
    })
      .then(data => { if (latestKey.current === requestKey) { setResult({ key: requestKey, data, error: null }); setOverrides({}); } })
      .catch(err => { if (latestKey.current === requestKey) setResult(prev => ({ key: requestKey, data: prev?.data ?? null, error: err.message })); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = result?.key !== requestKey;
  const data = result?.data ?? null;
  const rows = (data?.results || []).map(r => overrides[`${kind}:${r.id}`] || r);
  const summary = data?.summary || {};
  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  const switchKind = (k: WalletKind) => { if (k === kind) return; setKind(k); setPage(1); setClassId(''); };
  const switchShow = (s: WalletShow) => { setShow(s); setPage(1); };

  const onCorrected = (row: AnyRow, message: string) => {
    setOverrides(prev => ({ ...prev, [`${kind}:${row.id}`]: row }));
    setTarget(null);
    setToast(message);
    setTimeout(() => setToast(null), 4500);
    // Refresh the headline numbers quietly
    setTimeout(() => setNonce(n => n + 1), 600);
  };

  if (!canView) return <div className="p-16 text-center font-bold text-red-600">Access Denied: Missing finance permissions.</div>;

  const outOfSync = Number(summary.out_of_sync || 0);
  const negative = Number(summary.negative || 0);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-0 animate-in fade-in duration-300">
      {toast && (
        <div className="fixed top-4 right-4 z-[130] flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border bg-emerald-50 border-emerald-200 text-emerald-900 max-w-sm animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold flex-1">{toast}</p>
          <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-200 shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Wallet Balances</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Money held in student and staff wallets — spot balances that don&apos;t tally and correct them.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start md:self-auto" role="tablist">
          {([['student', 'Students', GraduationCap], ['staff', 'Staff', Briefcase]] as const).map(([k, label, Icon]) => (
            <button key={k} role="tab" aria-selected={kind === k} onClick={() => switchKind(k)}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${kind === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity ${loading && !data ? 'opacity-50' : ''}`}>
        {kind === 'student' ? (
          <>
            <Kpi label="Fee wallets" value={naira(summary.total_fee)} icon={<Coins className="w-4 h-4" />} tone="teal" />
            <Kpi label="Canteen wallets" value={naira(summary.total_canteen)} icon={<UtensilsCrossed className="w-4 h-4" />} tone="orange" />
          </>
        ) : (
          <>
            <Kpi label="Staff wallets" value={naira(summary.total)} icon={<Coins className="w-4 h-4" />} tone="teal" />
            <Kpi label="Wallets with money" value={String(summary.with_balance ?? 0)} icon={<Wallet className="w-4 h-4" />} tone="slate" />
          </>
        )}
        <button onClick={() => switchShow('out_of_sync')} className="text-left">
          <Kpi label="Out of sync" value={String(outOfSync)} icon={<ShieldAlert className="w-4 h-4" />} tone={outOfSync ? 'amber' : 'emerald'}
            hint={outOfSync ? 'Balance ≠ ledger — review' : 'Every wallet tallies'} interactive active={show === 'out_of_sync'} />
        </button>
        <button onClick={() => switchShow('negative')} className="text-left">
          <Kpi label="In debt" value={String(negative)} icon={<Minus className="w-4 h-4" />} tone={negative ? 'rose' : 'slate'}
            hint="Negative balances (read-only)" interactive active={show === 'negative'} />
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={kind === 'student' ? 'Search student name or registration number…' : 'Search staff name or staff ID…'}
            className="w-full pl-9 pr-3 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-300 transition-all" />
        </div>
        {kind === 'student' && (
          <select value={classId} onChange={e => { setClassId(e.target.value); setPage(1); }} aria-label="Class"
            className="px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">All classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
          {SHOW_OPTIONS.map(o => (
            <button key={o.key} onClick={() => switchShow(o.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${show === o.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={() => setNonce(n => n + 1)} title="Refresh" className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start lg:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
        {result?.error && (
          <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> {result.error}
          </div>
        )}
        {!data && loading ? (
          <div className="py-24 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
            <p className="text-xs font-bold uppercase tracking-widest">Loading wallets…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="font-black text-slate-800 mt-4">
              {show === 'out_of_sync' ? 'Every wallet tallies with its ledger' : show === 'negative' ? 'No wallets in debt' : 'No wallets match'}
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Try another filter or clear the search.</p>
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-5 py-3 text-left">{kind === 'student' ? 'Student' : 'Staff'}</th>
                  {kind === 'student' ? (
                    <>
                      <th className="px-5 py-3 text-right">Fee wallet</th>
                      <th className="px-5 py-3 text-right">Canteen wallet</th>
                    </>
                  ) : (
                    <th className="px-5 py-3 text-right">Balance</th>
                  )}
                  <th className="px-5 py-3 text-left hidden md:table-cell">Last activity</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => kind === 'student' ? (
                  <StudentRow key={r.id} row={r as StudentWalletRow} canCorrect={canCorrect}
                    onCorrect={field => setTarget({ kind, row: r, field })} />
                ) : (
                  <StaffRow key={r.id} row={r as StaffWalletRow} canCorrect={canCorrect}
                    onCorrect={() => setTarget({ kind, row: r, field: null })} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.count > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>{((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, data.count)} of {data.count}</span>
            <div className="flex gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-2 py-1.5">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 font-medium flex items-start gap-1.5 px-1">
        <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
        &ldquo;Out of sync&rdquo; means the stored balance differs from the balance recorded on the wallet&apos;s latest ledger entry. Corrections can only reduce a balance,
        are posted to the ledger as adjustments with your reason, and bring the wallet back in sync.
      </p>

      {target && (
        <CorrectModal target={target} onClose={() => setTarget(null)} onDone={onCorrected} />
      )}
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
const TONES: Record<string, { box: string; icon: string; value: string }> = {
  teal: { box: 'bg-white border-slate-200', icon: 'bg-teal-50 text-teal-600', value: 'text-slate-900' },
  orange: { box: 'bg-white border-slate-200', icon: 'bg-orange-50 text-orange-600', value: 'text-slate-900' },
  slate: { box: 'bg-white border-slate-200', icon: 'bg-slate-100 text-slate-500', value: 'text-slate-900' },
  amber: { box: 'bg-amber-50 border-amber-200', icon: 'bg-amber-100 text-amber-700', value: 'text-amber-800' },
  emerald: { box: 'bg-white border-slate-200', icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
  rose: { box: 'bg-rose-50 border-rose-200', icon: 'bg-rose-100 text-rose-600', value: 'text-rose-700' },
};

function Kpi({ label, value, icon, tone, hint, interactive, active }: {
  label: string; value: string; icon: React.ReactNode; tone: keyof typeof TONES | string; hint?: string; interactive?: boolean; active?: boolean;
}) {
  const t = TONES[tone] || TONES.slate;
  return (
    <div className={`h-full rounded-2xl border shadow-sm p-4 sm:p-5 transition-all ${t.box} ${interactive ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : ''} ${active ? 'ring-2 ring-teal-500/40' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.icon}`}>{icon}</span>
      </div>
      <p className={`text-xl sm:text-2xl font-black mt-2 tracking-tight tabular-nums truncate ${t.value}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-500 font-medium mt-1">{hint}</p>}
    </div>
  );
}

function BalanceCell({ balance, ledger, inSync, onCorrect, canCorrect, label }: {
  balance: string; ledger: string; inSync: boolean; onCorrect: () => void; canCorrect: boolean; label: string;
}) {
  const b = num(balance);
  return (
    <td className="px-5 py-3.5 text-right align-top">
      <div className="inline-flex flex-col items-end gap-1">
        <span className={`text-sm font-black tabular-nums ${b < 0 ? 'text-rose-600' : b === 0 ? 'text-slate-300' : 'text-slate-900'}`}>{naira(balance)}</span>
        {!inSync ? (
          <span title={`Ledger says ${naira(ledger)}`} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
            <ShieldAlert className="w-3 h-3" /> Ledger {naira(ledger)}
          </span>
        ) : b !== 0 ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600"><Check className="w-3 h-3" strokeWidth={3} /> Tallies</span>
        ) : null}
        {canCorrect && b > 0 && (
          <button onClick={onCorrect} aria-label={`Correct ${label}`} className="text-[10.5px] font-black text-teal-700 hover:text-teal-900 hover:underline">Correct</button>
        )}
      </div>
    </td>
  );
}

function StudentRow({ row, canCorrect, onCorrect }: { row: StudentWalletRow; canCorrect: boolean; onCorrect: (f: 'fee' | 'canteen') => void }) {
  const out = !row.fee_in_sync || !row.canteen_in_sync;
  return (
    <tr className={`hover:bg-slate-50/70 transition-colors ${out ? 'bg-amber-50/30' : ''}`}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 flex items-center justify-center text-xs font-black shrink-0">{initials(titleCase(row.name))}</div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate max-w-[220px]">{titleCase(row.name)}</p>
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-[220px]">
              <span className="font-mono">{row.registration_number || '—'}</span>
              {row.class_name && <> · {row.class_name}{row.section_name ? ` ${row.section_name}` : ''}</>}
            </p>
          </div>
        </div>
      </td>
      <BalanceCell balance={row.fee_balance} ledger={row.fee_ledger} inSync={row.fee_in_sync} canCorrect={canCorrect} onCorrect={() => onCorrect('fee')} label={`${row.name}'s fee wallet`} />
      <BalanceCell balance={row.canteen_balance} ledger={row.canteen_ledger} inSync={row.canteen_in_sync} canCorrect={canCorrect} onCorrect={() => onCorrect('canteen')} label={`${row.name}'s canteen wallet`} />
      <td className="px-5 py-3.5 text-xs text-slate-500 font-medium hidden md:table-cell">{ago(row.last_activity)}</td>
      <td className="px-5 py-3.5 text-right">
        {canCorrect && (num(row.fee_balance) > 0 || num(row.canteen_balance) > 0) ? (
          <button onClick={() => onCorrect(num(row.fee_balance) > 0 ? 'fee' : 'canteen')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${out ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {out ? 'Fix' : 'Correct'}
          </button>
        ) : <span className="text-[11px] text-slate-300 font-bold">—</span>}
      </td>
    </tr>
  );
}

function StaffRow({ row, canCorrect, onCorrect }: { row: StaffWalletRow; canCorrect: boolean; onCorrect: () => void }) {
  return (
    <tr className={`hover:bg-slate-50/70 transition-colors ${!row.in_sync ? 'bg-amber-50/30' : ''}`}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">{initials(titleCase(row.name))}</div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate max-w-[240px]">{titleCase(row.name)}</p>
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-[240px]">
              <span className="font-mono">{row.staff_id || '—'}</span>{row.department_name && <> · {row.department_name}</>}
            </p>
          </div>
        </div>
      </td>
      <BalanceCell balance={row.balance} ledger={row.ledger} inSync={row.in_sync} canCorrect={false} onCorrect={onCorrect} label={`${row.name}'s wallet`} />
      <td className="px-5 py-3.5 text-xs text-slate-500 font-medium hidden md:table-cell">{ago(row.last_activity)}</td>
      <td className="px-5 py-3.5 text-right">
        {canCorrect && num(row.balance) > 0 ? (
          <button onClick={onCorrect}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${!row.in_sync ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {!row.in_sync ? 'Fix' : 'Correct'}
          </button>
        ) : <span className="text-[11px] text-slate-300 font-bold">—</span>}
      </td>
    </tr>
  );
}

// ─── Correction modal ─────────────────────────────────────────────────────────
function CorrectModal({ target, onClose, onDone }: {
  target: CorrectTarget; onClose: () => void; onDone: (row: AnyRow, message: string) => void;
}) {
  const isStudent = target.kind === 'student';
  const srow = target.row as StudentWalletRow;
  const frow = target.row as StaffWalletRow;

  const stateFor = (f: 'fee' | 'canteen') => {
    const current = isStudent ? num(f === 'fee' ? srow.fee_balance : srow.canteen_balance) : num(frow.balance);
    const ledger = isStudent ? num(f === 'fee' ? srow.fee_ledger : srow.canteen_ledger) : num(frow.ledger);
    const inSync = isStudent ? (f === 'fee' ? srow.fee_in_sync : srow.canteen_in_sync) : frow.in_sync;
    return { current, ledger, inSync, ledgerOption: !inSync && ledger >= 0 && ledger < current };
  };

  const [field, setField] = useState<'fee' | 'canteen'>(target.field || 'fee');
  const { current, ledger, inSync, ledgerOption } = stateFor(field);

  const [mode, setMode] = useState<CorrectionMode>(stateFor(target.field || 'fee').ledgerOption ? 'to_ledger' : 'reduce');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Switch fee ↔ canteen, keeping the chosen correction valid for that wallet. */
  const changeField = (f: 'fee' | 'canteen') => {
    setField(f);
    setAmount('');
    setMode(stateFor(f).ledgerOption ? 'to_ledger' : (mode === 'to_ledger' ? 'reduce' : mode));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const newBalance = useMemo(() => {
    if (mode === 'reset') return 0;
    if (mode === 'to_ledger') return ledger;
    const cut = num(amount);
    return current - cut;
  }, [mode, ledger, amount, current]);
  const removed = current - newBalance;
  const valid = current > 0 && newBalance >= 0 && removed > 0 && reason.trim().length >= 5;

  const submit = async () => {
    if (!valid) return;
    setSaving(true); setError(null);
    try {
      const res = await walletBalancesAPI.correct({
        kind: target.kind, id: target.row.id,
        ...(isStudent ? { wallet_field: field } : {}),
        mode, ...(mode === 'reduce' ? { amount: num(amount).toFixed(2) } : {}),
        reason: reason.trim(),
      });
      onDone(res.row, `${res.detail} Ref ${res.reference}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply the correction.');
      setSaving(false);
    }
  };

  const options: { key: CorrectionMode; title: string; desc: string; icon: React.ReactNode; show: boolean }[] = [
    { key: 'to_ledger', title: 'Match the ledger', desc: `Set the balance to ${naira(ledger)}, the figure on the latest ledger entry.`, icon: <Scale className="w-4 h-4" />, show: ledgerOption },
    { key: 'reduce', title: 'Remove an amount', desc: 'Take a specific amount out of the wallet.', icon: <Minus className="w-4 h-4" />, show: true },
    { key: 'reset', title: 'Reset to zero', desc: `Clear the whole ${naira(current)}.`, icon: <RotateCcw className="w-4 h-4" />, show: true },
  ];

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in" onClick={() => !saving && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="correct-title" onClick={e => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center text-xs font-black shrink-0">{initials(titleCase(target.row.name))}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Correct wallet</p>
            <h2 id="correct-title" className="text-base font-black text-slate-900 truncate">{titleCase(target.row.name)}</h2>
          </div>
          <button onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {isStudent && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              {(['fee', 'canteen'] as const).map(f => {
                const bal = num(f === 'fee' ? srow.fee_balance : srow.canteen_balance);
                return (
                  <button key={f} onClick={() => changeField(f)} disabled={bal <= 0}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${field === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                    {f === 'fee' ? <Coins className="w-3.5 h-3.5" /> : <UtensilsCrossed className="w-3.5 h-3.5" />}
                    {f === 'fee' ? 'Fee' : 'Canteen'} · {naira(bal)}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current balance</p>
              <p className="text-lg font-black text-slate-900 tabular-nums mt-0.5">{naira(current)}</p>
            </div>
            <div className={`rounded-xl border p-3.5 ${inSync ? 'bg-emerald-50/60 border-emerald-100' : 'bg-amber-50 border-amber-200'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ledger balance</p>
              <p className={`text-lg font-black tabular-nums mt-0.5 ${inSync ? 'text-emerald-700' : 'text-amber-800'}`}>{naira(ledger)}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${inSync ? 'text-emerald-600' : 'text-amber-700'}`}>{inSync ? 'Tallies' : `Off by ${naira(current - ledger)}`}</p>
            </div>
          </div>

          <div className="space-y-2" role="radiogroup" aria-label="Correction type">
            {options.filter(o => o.show).map(o => (
              <button key={o.key} role="radio" aria-checked={mode === o.key} onClick={() => setMode(o.key)}
                className={`w-full text-left p-3.5 rounded-xl border-2 flex items-start gap-3 transition-all ${mode === o.key ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${mode === o.key ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{o.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-900">{o.title}{o.key === 'to_ledger' && <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 align-middle">Suggested</span>}</span>
                  <span className="block text-[11.5px] text-slate-500 font-medium mt-0.5">{o.desc}</span>
                </span>
              </button>
            ))}
          </div>

          {mode === 'reduce' && (
            <div>
              <label htmlFor="cut" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Amount to remove</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-slate-400">₦</span>
                <input id="cut" type="number" min="0" max={current} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus placeholder="0.00"
                  className="w-full pl-9 pr-24 py-3 text-lg font-black rounded-xl border-2 border-slate-200 bg-slate-50 outline-none focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10 tabular-nums" />
                <button type="button" onClick={() => setAmount(current.toFixed(2))} className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300">Max</button>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">After correction</p>
              <p className="text-xl font-black tabular-nums mt-0.5">{newBalance >= 0 ? naira(newBalance) : '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Removed</p>
              <p className={`text-xl font-black tabular-nums mt-0.5 ${removed > 0 ? 'text-rose-300' : 'text-slate-500'}`}>{removed > 0 ? `−${naira(removed)}` : naira(0)}</p>
            </div>
          </div>
          {newBalance < 0 && <p className="text-xs font-bold text-rose-600 -mt-3">You can remove at most {naira(current)}.</p>}

          <div>
            <label htmlFor="why" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Reason <span className="text-rose-500">*</span></label>
            <textarea id="why" rows={2} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Duplicate credit from the July funding bug"
              className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-300 resize-none" />
            <p className="text-[10.5px] text-slate-400 font-medium mt-1">Saved on the wallet ledger as an adjustment. This can&apos;t be undone from here.</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />{error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={!valid || saving}
            className="px-5 py-2.5 text-sm font-black rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-rose-200 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
            {removed > 0 && newBalance >= 0 ? `Remove ${naira(removed)}` : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
