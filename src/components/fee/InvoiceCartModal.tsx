'use client';

/**
 * Invoice Cart — review a student's invoice for any period of the current
 * session and add / remove fee lines like a cart. Every change needs a reason
 * and is written to an audit log on the server.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Loader2, AlertTriangle, Lock, Trash2, Undo2, Plus, Search, Check, Users, User,
  History, ShoppingCart, Sparkles, Info, CalendarCheck, Receipt, ChevronDown, ChevronUp, Filter,
} from 'lucide-react';
import {
  invoiceCartAPI, type InvoiceCart, type CartItem, type CartCatalogEntry, type CartTarget,
} from '@/lib/invoiceCart';
import { usePeriodLabels } from '@/lib/usePeriodLabels';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const naira = (v: string | number | null | undefined) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
};
const num = (v: string | number | null | undefined) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const titleCase = (s?: string | null) =>
  (s || '').replace(/\w\S*/g, w => (/^[A-Z0-9]{2,6}$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const OCCURRENCE_STYLE: Record<string, string> = {
  periodic: 'bg-sky-50 text-sky-700 border-sky-100',
  annually: 'bg-violet-50 text-violet-700 border-violet-100',
  one_time: 'bg-amber-50 text-amber-700 border-amber-100',
};
const OCCURRENCE_LABEL: Record<string, string> = { periodic: 'Every period', annually: 'Annual', one_time: 'One-time' };

function OccurrenceChip({ occurrence }: { occurrence: string }) {
  return (
    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${OCCURRENCE_STYLE[occurrence] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
      {OCCURRENCE_LABEL[occurrence] || occurrence}
    </span>
  );
}

interface StagedAdd {
  key: string;
  entry: CartCatalogEntry;
  amount: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface CartModalProps {
  open: boolean;
  studentId: number | null;
  /** Session-period id to open on (defaults to the current period). */
  initialPeriodId?: number | null;
  onClose: () => void;
  /** Called after a successful save so the parent can refresh its ledger. */
  onChanged?: () => void;
}

/** Mounts a fresh cart sheet each time it opens (keyed), so no stale state leaks between students. */
export default function InvoiceCartModal(props: CartModalProps) {
  if (!props.open || !props.studentId) return null;
  return <CartSheet key={`${props.studentId}:${props.initialPeriodId ?? 'current'}`} {...props} studentId={props.studentId} />;
}

function CartSheet({
  studentId, initialPeriodId, onClose, onChanged,
}: CartModalProps & { studentId: number }) {
  const labels = usePeriodLabels();
  const s = labels.singular.toLowerCase();

  const [cart, setCart] = useState<InvoiceCart | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(initialPeriodId ?? null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [adds, setAdds] = useState<StagedAdd[]>([]);
  const [removals, setRemovals] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [classOnly, setClassOnly] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingPeriod, setPendingPeriod] = useState<number | null>(null);
  const reqRef = useRef(0);

  const dirty = adds.length > 0 || removals.size > 0;

  const resetStage = () => { setAdds([]); setRemovals(new Set()); setReason(''); };

  const fetchCart = useCallback((pid: number | null) => {
    const id = ++reqRef.current;
    invoiceCartAPI.get(studentId, pid)
      .then(data => {
        if (id !== reqRef.current) return;
        setCart(data);
        setPeriodId(data.period.id);
        setError(null);
      })
      .catch((e: Error) => { if (id === reqRef.current) setError(e.message); })
      .finally(() => { if (id === reqRef.current) setLoading(false); });
  }, [studentId]);

  /** User-initiated (re)load, e.g. switching period. */
  const load = (pid: number | null) => { setLoading(true); setError(null); fetchCart(pid); };

  // Initial load (state already starts as "loading")
  useEffect(() => { fetchCart(initialPeriodId ?? null); }, [fetchCart, initialPeriodId]);

  const dirtyRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { dirtyRef.current = dirty; onCloseRef.current = onClose; });

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm('You have unsaved changes to this invoice. Discard them?')) return;
    onCloseRef.current();
  }, []);

  // Esc to close (asks first if there are unsaved changes) + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [requestClose]);

  const switchPeriod = (pid: number) => {
    if (pid === periodId) return;
    if (dirty) { setPendingPeriod(pid); return; }
    setSuccess(null);
    load(pid);
  };

  // ── Staging ──
  const stagedKeys = useMemo(() => new Set(adds.map(a => `${a.entry.target}:${a.entry.fee_master_id}`)), [adds]);

  const stageAdd = (entry: CartCatalogEntry) => {
    setSuccess(null);
    setAdds(prev => [...prev, { key: `${entry.fee_master_id}-${Date.now()}`, entry, amount: entry.suggested_amount || '' }]);
  };
  const unstageAdd = (key: string) => setAdds(prev => prev.filter(a => a.key !== key));
  const setAddAmount = (key: string, amount: string) => setAdds(prev => prev.map(a => (a.key === key ? { ...a, amount } : a)));
  const toggleRemove = (item: CartItem) => {
    if (!item.removable) return;
    setSuccess(null);
    setRemovals(prev => {
      const next = new Set(prev);
      if (next.has(item.uid)) next.delete(item.uid); else next.add(item.uid);
      return next;
    });
  };

  // ── Derived ──
  const items = cart?.items || [];
  const studentItems = items.filter(i => i.target === 'student');
  const familyItems = items.filter(i => i.target === 'family');
  const currentTotal = items.reduce((t, i) => t + num(i.amount), 0);
  const removedTotal = items.filter(i => removals.has(i.uid)).reduce((t, i) => t + num(i.amount), 0);
  const addedTotal = adds.reduce((t, a) => t + num(a.amount), 0);
  const projected = currentTotal - removedTotal + addedTotal;
  const invalidAdds = adds.filter(a => !(num(a.amount) > 0));
  const reasonOk = reason.trim().length >= 5;
  const canSave = dirty && reasonOk && invalidAdds.length === 0 && !saving && !!cart?.editable;

  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (cart?.catalog || []).filter(c => {
      if (classOnly && !c.in_scope) return false;
      if (!q) return true;
      return [c.fee_name, c.fee_code, c.group_name].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [cart, search, classOnly]);
  const hiddenOutOfScope = (cart?.catalog || []).filter(c => !c.in_scope).length;

  const save = async () => {
    if (!cart || !canSave) return;
    setSaving(true); setError(null);
    try {
      const removes = items.filter(i => removals.has(i.uid)).map(i => ({ target: i.target as CartTarget, item_id: i.id }));
      const fresh = await invoiceCartAPI.apply({
        student_id: cart.student.id,
        period_id: cart.period.id,
        reason: reason.trim(),
        adds: adds.map(a => ({ fee_master_id: a.entry.fee_master_id, amount: num(a.amount).toFixed(2) })),
        removes,
      });
      const parts = [adds.length && `${adds.length} added`, removes.length && `${removes.length} removed`].filter(Boolean);
      setCart(fresh);
      resetStage();
      setSuccess(`Invoice updated — ${parts.join(', ')}. Discounts and balances were recalculated.`);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the changes.');
    } finally {
      setSaving(false);
    }
  };

  const stu = cart?.student;

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={requestClose}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="invoice-cart-title"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-6xl h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* ── Header ── */}
        <header className="shrink-0 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white px-5 sm:px-7 pt-5 pb-0">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-sm font-black shrink-0">
              {stu ? initials(titleCase(stu.name)) : <ShoppingCart className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">Edit Invoice</p>
              <h2 id="invoice-cart-title" className="text-lg sm:text-xl font-black leading-tight truncate">
                {stu ? titleCase(stu.name) : 'Loading student…'}
              </h2>
              {stu && (
                <p className="text-[11px] text-slate-300 font-medium mt-0.5 truncate">
                  {[stu.registration_number, [stu.class_name, stu.section_name].filter(Boolean).join(' '), cart?.session.label && `Session ${cart.session.label}`]
                    .filter(Boolean).join('  ·  ')}
                </p>
              )}
            </div>
            <button onClick={requestClose} aria-label="Close" className="p-2 -mr-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Period tabs */}
          <div className="mt-5 flex gap-1 overflow-x-auto -mx-1 px-1" role="tablist" aria-label={labels.plural}>
            {(cart?.periods || []).map(p => {
              const active = p.id === periodId;
              return (
                <button
                  key={p.id} role="tab" aria-selected={active} onClick={() => switchPeriod(p.id)}
                  className={`relative shrink-0 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    active ? 'bg-slate-50 text-slate-900' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${p.has_invoice ? (active ? 'bg-emerald-500' : 'bg-emerald-400') : (active ? 'bg-slate-300' : 'bg-slate-500')}`} />
                  {p.name}
                  {p.is_current && (
                    <span className={`text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-white/10 text-indigo-200'}`}>Current</span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* ── Unsaved-changes guard for period switching ── */}
        {pendingPeriod != null && (
          <div className="shrink-0 mx-5 sm:mx-7 mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center gap-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="flex-1 text-amber-900 font-medium">You have unsaved changes on this {s}. Switching will discard them.</span>
            <button onClick={() => setPendingPeriod(null)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-amber-200 text-amber-800 hover:bg-amber-100">Keep editing</button>
            <button onClick={() => { const p = pendingPeriod; setPendingPeriod(null); resetStage(); setSuccess(null); load(p); }} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700">Discard &amp; switch</button>
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && !cart ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <p className="text-xs font-bold uppercase tracking-widest">Loading invoice…</p>
            </div>
          ) : !cart ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
              <p className="text-sm font-bold text-slate-700">{error || 'Could not load this invoice.'}</p>
              <button onClick={() => load(periodId)} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white">Try again</button>
            </div>
          ) : (
            <div className={`p-5 sm:p-7 space-y-5 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {!cart.editable && (
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600 font-medium">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                  This {s} is outside the current session, so it&apos;s read-only. Only the current session can be edited.
                </div>
              )}
              {success && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-900 animate-in fade-in slide-in-from-top-1">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="font-semibold">{success}</span>
                </div>
              )}
              {error && cart && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span className="flex-1 font-semibold">{error}</span>
                  <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* ═══ LEFT: what's on the invoice ═══ */}
                <section className="lg:col-span-3 space-y-4">
                  <InvoiceSummaryBar cart={cart} />

                  {adds.length > 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 overflow-hidden">
                      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-emerald-200/70">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Adding ({adds.length})</p>
                      </div>
                      <ul className="divide-y divide-emerald-100">
                        {adds.map(a => {
                          const bad = !(num(a.amount) > 0);
                          return (
                            <li key={a.key} className="px-4 py-3 flex flex-wrap sm:flex-nowrap items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-bold text-slate-900 truncate">{titleCase(a.entry.fee_name)}</p>
                                  <OccurrenceChip occurrence={a.entry.occurrence} />
                                  {a.entry.target === 'family' && <FamilyChip />}
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium truncate">{titleCase(a.entry.group_name)}</p>
                                {a.entry.price_note && <p className="text-[10.5px] text-amber-700 font-semibold mt-0.5">{a.entry.price_note}</p>}
                              </div>
                              <div className="relative w-36 shrink-0">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">₦</span>
                                <input
                                  type="number" min="0" step="0.01" inputMode="decimal" value={a.amount}
                                  onChange={e => setAddAmount(a.key, e.target.value)}
                                  aria-label={`Amount for ${a.entry.fee_name}`}
                                  autoFocus={!a.entry.suggested_amount}
                                  className={`w-full pl-7 pr-2.5 py-2 text-sm font-black text-right rounded-xl border-2 bg-white outline-none focus:ring-4 transition-all tabular-nums ${
                                    bad ? 'border-rose-300 focus:ring-rose-500/10' : 'border-emerald-200 focus:border-emerald-400 focus:ring-emerald-500/10'}`}
                                />
                                {a.entry.standard_amount && num(a.amount) !== num(a.entry.standard_amount) && num(a.amount) > 0 && (
                                  <p className="absolute -bottom-4 right-0 text-[9.5px] font-bold text-amber-600 whitespace-nowrap">Standard {naira(a.entry.standard_amount)}</p>
                                )}
                              </div>
                              <button onClick={() => unstageAdd(a.key)} aria-label={`Don't add ${a.entry.fee_name}`}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0">
                                <X className="w-4 h-4" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <ItemGroup
                    title="Student invoice" icon={<User className="w-3.5 h-3.5" />}
                    number={cart.student_invoice?.invoice_number}
                    items={studentItems} removals={removals} onToggle={toggleRemove}
                    empty={`No student fees billed for this ${s} yet.`}
                  />
                  {(familyItems.length > 0 || cart.family_invoice) && (
                    <ItemGroup
                      title={`Family invoice${cart.student.parent_name ? ` · ${titleCase(cart.student.parent_name)}` : ''}`}
                      icon={<Users className="w-3.5 h-3.5" />} family
                      number={cart.family_invoice?.invoice_number}
                      items={familyItems} removals={removals} onToggle={toggleRemove}
                      empty="No shared family fees on this invoice."
                    />
                  )}

                  {/* History */}
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <button onClick={() => setShowHistory(v => !v)} className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-slate-50 transition-colors">
                      <History className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-black text-slate-700 flex-1">Change history this session</span>
                      <span className="text-[10px] font-bold text-slate-400">{cart.history.length}</span>
                      {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {showHistory && (
                      cart.history.length === 0 ? (
                        <p className="px-4 pb-4 text-xs text-slate-400 font-medium">No manual changes have been made this session.</p>
                      ) : (
                        <ol className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                          {cart.history.map(h => (
                            <li key={h.id} className="flex gap-3">
                              <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${h.action === 'add' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {h.action === 'add' ? <Plus className="w-3 h-3" strokeWidth={3} /> : <Trash2 className="w-3 h-3" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800">
                                  {h.action === 'add' ? 'Added' : 'Removed'} {titleCase(h.description)}
                                  <span className="font-black tabular-nums"> · {naira(h.amount)}</span>
                                  <span className="text-slate-400 font-semibold"> · {h.period_name}</span>
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">&ldquo;{h.reason}&rdquo;</p>
                                {h.notes?.length > 0 && <p className="text-[10.5px] text-slate-400 mt-0.5">{h.notes.join(' ')}</p>}
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{h.by} · {fmtWhen(h.at)}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )
                    )}
                  </div>
                </section>

                {/* ═══ RIGHT: catalogue ═══ */}
                <section className="lg:col-span-2">
                  <div className="lg:sticky lg:top-0 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-500" /> Add fees</h3>
                        <span className="text-[10px] font-bold text-slate-400">{catalog.length} shown</span>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fee name, code or group…"
                          className="w-full pl-9 pr-3 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                        <input type="checkbox" checked={classOnly} onChange={e => setClassOnly(e.target.checked)} className="w-3.5 h-3.5 rounded text-indigo-600" />
                        <Filter className="w-3 h-3 text-slate-400" />
                        Only fees set for {cart.student.class_name || 'this class'}
                        {classOnly && hiddenOutOfScope > 0 && <span className="text-slate-400 font-semibold">({hiddenOutOfScope} hidden)</span>}
                      </label>
                    </div>
                    <ul className="max-h-[52vh] lg:max-h-[calc(100vh-26rem)] overflow-y-auto divide-y divide-slate-100">
                      {catalog.length === 0 ? (
                        <li className="px-4 py-10 text-center text-xs text-slate-400 font-medium">No fee structures match.</li>
                      ) : catalog.map(c => {
                        const staged = stagedKeys.has(`${c.target}:${c.fee_master_id}`);
                        const disabled = !!c.disabled_reason || staged || !cart.editable;
                        return (
                          <li key={c.fee_master_id} className={`px-4 py-3 ${disabled ? 'bg-slate-50/60' : 'hover:bg-indigo-50/30'} transition-colors`}>
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className={`text-[13px] font-bold truncate ${disabled ? 'text-slate-400' : 'text-slate-900'}`}>{titleCase(c.fee_name)}</p>
                                  <OccurrenceChip occurrence={c.occurrence} />
                                  {c.target === 'family' && <FamilyChip />}
                                  {!c.in_scope && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-rose-50 text-rose-600 border-rose-100">Other class</span>}
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium truncate">{titleCase(c.group_name)} · <span className="font-mono">{c.fee_code}</span></p>
                                {c.warnings.map(w => (
                                  <p key={w} className="text-[10.5px] text-amber-700 font-semibold mt-1 flex items-start gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-px" />{w}</p>
                                ))}
                                {c.disabled_reason && <p className="text-[10.5px] text-slate-400 font-semibold mt-1">{c.disabled_reason}</p>}
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-xs font-black tabular-nums ${c.suggested_amount ? 'text-slate-800' : 'text-slate-300'}`}>
                                  {c.suggested_amount ? naira(c.suggested_amount) : 'No price'}
                                </p>
                                {c.price_source !== 'period' && c.suggested_amount && <p className="text-[9.5px] font-bold text-amber-600">other {s}</p>}
                                <button
                                  onClick={() => stageAdd(c)} disabled={disabled}
                                  className={`mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                                    staged ? 'bg-emerald-100 text-emerald-700' : disabled ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 active:scale-95'}`}
                                >
                                  {staged ? <><Check className="w-3 h-3" strokeWidth={3} /> Added</> : <><Plus className="w-3 h-3" strokeWidth={3} /> Add</>}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer: review & save ── */}
        {cart && cart.editable && (
          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 sm:px-7 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex items-center gap-5 shrink-0">
                <div>
                  <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">Changes</p>
                  <p className="text-sm font-black text-slate-800 mt-0.5">
                    {dirty ? (
                      <>
                        {adds.length > 0 && <span className="text-emerald-600">+{adds.length} added</span>}
                        {adds.length > 0 && removals.size > 0 && <span className="text-slate-300"> · </span>}
                        {removals.size > 0 && <span className="text-rose-600">−{removals.size} removed</span>}
                      </>
                    ) : <span className="text-slate-400 font-bold">None yet</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">Gross billed</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5 tabular-nums">
                    {dirty && <span className="text-slate-400 line-through font-bold mr-1.5">{naira(currentTotal)}</span>}
                    {naira(projected)}
                  </p>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <label htmlFor="cart-reason" className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Reason for this change <span className="text-rose-500">*</span>
                </label>
                <input
                  id="cart-reason" value={reason} onChange={e => setReason(e.target.value)} disabled={!dirty}
                  placeholder={dirty ? 'e.g. Joined in 2nd term — bill the new-intake fee' : 'Add or remove an item first'}
                  className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 disabled:opacity-60 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {dirty && (
                  <button onClick={resetStage} disabled={saving} className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                    Discard
                  </button>
                )}
                <button
                  onClick={save} disabled={!canSave}
                  title={!dirty ? 'No changes' : !reasonOk ? 'Enter a reason (at least 5 characters)' : invalidAdds.length ? 'Every new item needs an amount above zero' : undefined}
                  className="px-5 py-2.5 text-sm font-black rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-slate-900/10 flex items-center gap-2 transition-all active:scale-[0.98]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save changes
                </button>
              </div>
            </div>
            <p className="mt-2.5 text-[10.5px] text-slate-400 font-medium flex items-center gap-1.5">
              <Info className="w-3 h-3" /> Discounts are re-applied automatically after saving. Paid lines can&apos;t be removed — revert the payment or use a waiver.
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
function FamilyChip() {
  return <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-100">Family</span>;
}

function InvoiceSummaryBar({ cart }: { cart: InvoiceCart }) {
  const inv = [cart.student_invoice, cart.family_invoice].filter(Boolean) as NonNullable<InvoiceCart['student_invoice']>[];
  const sum = (k: 'total' | 'discount' | 'waived' | 'paid' | 'balance') => inv.reduce((t, i) => t + num(i[k]), 0);
  const stats = [
    { label: 'Billed', value: sum('total'), tone: 'text-slate-900' },
    { label: 'Discount + Waiver', value: sum('discount') + sum('waived'), tone: 'text-emerald-600' },
    { label: 'Paid', value: sum('paid'), tone: 'text-indigo-600' },
    { label: 'Balance', value: sum('balance'), tone: sum('balance') > 0 ? 'text-rose-600' : 'text-emerald-600' },
  ];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
      {stats.map(st => (
        <div key={st.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">{st.label}</p>
          <p className={`text-sm sm:text-base font-black tabular-nums mt-0.5 truncate ${st.tone}`}>{naira(st.value)}</p>
        </div>
      ))}
    </div>
  );
}

function ItemGroup({
  title, icon, number, items, removals, onToggle, empty, family = false,
}: {
  title: string; icon: React.ReactNode; number?: string | null; items: CartItem[];
  removals: Set<string>; onToggle: (i: CartItem) => void; empty: string; family?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${family ? 'bg-purple-50/60 border-purple-100' : 'bg-slate-50 border-slate-100'}`}>
        <span className={family ? 'text-purple-500' : 'text-slate-400'}>{icon}</span>
        <p className={`text-[10px] font-black uppercase tracking-widest flex-1 truncate ${family ? 'text-purple-800' : 'text-slate-500'}`}>{title}</p>
        {number && <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1"><Receipt className="w-3 h-3" />{number}</span>}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <CalendarCheck className="w-7 h-7 text-slate-200 mx-auto" />
          <p className="text-xs text-slate-400 font-medium mt-2">{empty}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map(it => {
            const removing = removals.has(it.uid);
            const extras = [
              num(it.discount) > 0 && `−${naira(it.discount)} discount`,
              num(it.waived) > 0 && `−${naira(it.waived)} waived`,
              num(it.paid) > 0 && `${naira(it.paid)} paid`,
              it.pending_waivers > 0 && `${it.pending_waivers} waiver request${it.pending_waivers > 1 ? 's' : ''} pending`,
            ].filter(Boolean) as string[];
            return (
              <li key={it.uid} className={`px-4 py-3 flex items-center gap-3 transition-colors ${removing ? 'bg-rose-50/70' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-sm font-bold truncate ${removing ? 'text-rose-700 line-through decoration-2' : 'text-slate-900'}`}>{titleCase(it.fee_name)}</p>
                    <OccurrenceChip occurrence={it.occurrence} />
                    {removing && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-600 text-white">Removing</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium truncate">
                    {titleCase(it.group_name)}{extras.length ? <span className="text-slate-500"> · {extras.join(' · ')}</span> : null}
                  </p>
                  {!it.removable && it.block_reason && (
                    <p className="text-[10.5px] text-slate-500 font-semibold mt-1 flex items-start gap-1"><Lock className="w-3 h-3 shrink-0 mt-px text-slate-400" />{it.block_reason}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black tabular-nums ${removing ? 'text-rose-400 line-through' : 'text-slate-900'}`}>{naira(it.amount)}</p>
                  {num(it.balance) !== num(it.amount) && !removing && (
                    <p className="text-[10px] font-bold text-slate-400 tabular-nums">Bal {naira(it.balance)}</p>
                  )}
                </div>
                {it.removable ? (
                  <button
                    onClick={() => onToggle(it)} aria-label={removing ? `Keep ${it.fee_name}` : `Remove ${it.fee_name}`}
                    title={removing ? 'Keep this item' : 'Remove this item'}
                    className={`p-2 rounded-lg transition-colors shrink-0 ${removing ? 'text-rose-600 bg-rose-100 hover:bg-rose-200' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                  >
                    {removing ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                ) : (
                  <span className="p-2 text-slate-300 shrink-0" title={it.block_reason || 'Locked'}><Lock className="w-4 h-4" /></span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
