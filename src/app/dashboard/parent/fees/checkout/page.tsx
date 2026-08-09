'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
// Note: financeAPI is removed, we only need feeAPI and academicCalendarAPI
import api, { feeAPI, academicCalendarAPI } from '@/lib/api';
import {
  ArrowLeft, Loader2, Check, AlertCircle, Upload, Wallet, X,
  Building2, UserCircle, Eye, AlertTriangle, Info, UserCheck, Percent, HelpCircle
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function formatCurrency(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(num);
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substring(1).toLowerCase());
}

function smartTitleCase(str: string): string {
  if (!str) return '';
  return str
    .split(' ')
    .filter(Boolean)
    .map(word => {
      if (/^[A-Z]{2,6}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function cleanFeeDescription(desc: string): string {
  if (!desc) return '';
  const dashIdx = desc.indexOf('—');
  const base = (dashIdx >= 0 ? desc.slice(0, dashIdx) : desc).trim();
  return smartTitleCase(base);
}

const toKobo = (naira: number | string) => Math.round(Number(naira || 0) * 100);
const fromKobo = (kobo: number) => kobo / 100;

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.non_field_errors) return (d.non_field_errors as string[]).join(' ');
  }
  return err?.message || 'Checkout failed. Please try again.';
}

// ─── UI Components ────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CartItem {
  uid: string;
  targetType: 'invoice' | 'family_invoice' | 'ancillary_debt';
  targetId: number;
  description: string;
  balance: number;
  allocated: string;
  included?: boolean;
}

interface CartGroup {
  groupId: string;
  groupName: string;
  groupMeta?: string;
  isFamily: boolean;
  items: CartItem[];
}

// ─── Help content ──────────────────────────────────────────────────────────
const HELP_STEPS: [string, string][] = [
  ['1. Choose what to pay', 'Every fee is ticked by default. Untick anything you don\u2019t want to pay right now.'],
  ['2. Type the amount you deposited', 'Enter the total you sent to the bank at the bottom of the page. It automatically fills your fees in order, starting with the first one.'],
  ['3. Or pay a specific fee', 'Want to control exactly how much goes to one fee? Type an amount directly into that fee\u2019s box \u2014 everything else still fills automatically around it.'],
  ['4. Use wallet credit (optional)', 'If a ward already has money in their wallet, tick it to use that instead of a new deposit.'],
  ['5. Add your proof', 'Select the bank account you paid into and upload your receipt or screenshot.'],
  ['6. Preview, then submit', 'Tap "Preview Allocation" to check everything looks right, then "Submit Proof". The school will confirm it shortly after.'],
];

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50 flex items-center justify-between">
          <h3 className="font-black text-indigo-900 text-sm flex items-center gap-2">
            <HelpCircle className="w-4 h-4" /> How This Page Works
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded-md" aria-label="Close">
            <X className="w-4 h-4 text-indigo-600" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {HELP_STEPS.map(([title, body]) => (
            <div key={title}>
              <p className="text-xs font-black text-slate-800">{title}</p>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">{body}</p>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function ParentCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSession = searchParams.get('session');
  const urlPeriod = searchParams.get('period');

  // ─── State: Global ───
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const [filterSessionId, setFilterSessionId] = useState<string>(urlSession || '');
  const [filterPeriodId, setFilterPeriodId] = useState<string>(urlPeriod || '');

  const [rawParentData, setRawParentData] = useState<any>(null);
  const [cartGroups, setCartGroups] = useState<CartGroup[]>([]);

  // ─── State: Payment Inputs ───
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [tenderedTouched, setTenderedTouched] = useState(false);

  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // ─── State: Cart Engine ───
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  const [walletContributions, setWalletContributions] = useState<Record<number, string>>({});

  const [overpaymentMode, setOverpaymentMode] = useState<'select' | 'split'>('select');
  const [overpaymentTargetId, setOverpaymentTargetId] = useState<number | null>(null);
  const [splitPercentages, setSplitPercentages] = useState<Record<number, number>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // ─── State: Modals ───
  const [showPreview, setShowPreview] = useState(false);
  const [warningModal, setWarningModal] = useState<{ warnings: string[]; action: 'preview' | 'submit' } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // ─── INIT ───
  useEffect(() => {
    const init = async () => {
      try {
        const [sessData, curSessRaw, banksData] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession().catch(() => null),
          // Using our safe new public banks endpoint!
          feeAPI.getBankAccounts().catch(() => [])
        ]);

        setSessions(Array.isArray(sessData) ? sessData : []);
        setBanks(Array.isArray(banksData) ? banksData : []);

        const curSess = curSessRaw?.data?.data || curSessRaw?.data || curSessRaw;
        const targetSessionId = urlSession || (curSess?.id ? curSess.id.toString() : (sessData[0]?.id?.toString() || ''));

        if (targetSessionId) {
          setFilterSessionId(targetSessionId);
          const perData = await academicCalendarAPI.listSessionPeriods({ session_id: Number(targetSessionId) });
          setPeriods(perData);

          if (urlPeriod) {
            setFilterPeriodId(urlPeriod);
          } else {
            const currentP = perData.find((p: any) => p.is_current);
            if (currentP) setFilterPeriodId(currentP.id.toString());
            else if (perData.length > 0) setFilterPeriodId(perData[0].id.toString());
          }
        }
      } catch (err) {
        showToast('error', 'Failed to initialize system data.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [urlSession, urlPeriod]);

  // Update periods list when session changes
  useEffect(() => {
    if (!loading && filterSessionId) {
      academicCalendarAPI.listSessionPeriods({ session_id: Number(filterSessionId) })
        .then(res => {
          setPeriods(res);
          if (res.length > 0 && !res.find((p: any) => p.id.toString() === filterPeriodId)) {
            setFilterPeriodId(res[0].id.toString());
          }
        });
    }
  }, [filterSessionId, loading]);

  // ─── Fetch Ledger ───
  const fetchLedger = useCallback(async () => {
    if (!filterSessionId || !filterPeriodId) return;
    setDataLoading(true);
    setCartGroups([]);
    setRawParentData(null);
    setTenderedAmount('');
    setTenderedTouched(false);
    setManualOverrides({});
    setWalletContributions({});
    setOverpaymentTargetId(null);
    setSplitPercentages({});
    setAttemptedSubmit(false);

    try {
      const res = await feeAPI.getBillingLedger({
        session_id: filterSessionId,
        period_id: filterPeriodId,
        mode: 'parent'
      });
      const parentData = res.results?.[0] || res?.[0] || res;
      if (!parentData) {
        setRawParentData(null);
        return;
      }

      setRawParentData(parentData);
      const groups: CartGroup[] = [];

      (parentData.students || []).forEach((stData: any) => {
        const items: CartItem[] = [];
        if (stData.invoice) {
          (stData.invoice.items || []).forEach((line: any) => {
            const bal = parseFloat(line.balance || '0');
            if (bal > 0) {
              items.push({
                uid: `invoice_${line.id}`, targetType: 'invoice', targetId: line.id,
                description: cleanFeeDescription(line.description), balance: bal, allocated: '', included: true
              });
            }
          });
        }
        if (stData.other_payments) {
          stData.other_payments.forEach((op: any) => {
            const bal = parseFloat(op.balance || '0');
            if (bal > 0) {
              items.push({
                uid: `ancillary_debt_${op.id}`, targetType: 'ancillary_debt', targetId: op.id,
                description: `${cleanFeeDescription(op.description)} (${smartTitleCase(op.category_display || '')})`, balance: bal, allocated: '', included: true
              });
            }
          });
        }
        if (items.length > 0) {
          const st = stData.student || {};
          const name = toTitleCase(st.full_name || stData.__str__ || 'Student');
          const classInfo = [st.current_class_name, st.current_class_section_name].filter(Boolean).join(' ');
          const groupMeta = [st.registration_number, classInfo].filter(Boolean).join(' • ');
          groups.push({ groupId: `stu_${stData.student_id || stData.id}`, groupName: name, groupMeta, isFamily: false, items });
        }
      });

      if (parentData.family_invoice) {
        const items: CartItem[] = [];
        (parentData.family_invoice.items || []).forEach((line: any) => {
          const bal = parseFloat(line.balance || '0');
          if (bal > 0) {
            items.push({
              uid: `family_invoice_${line.id}`, targetType: 'family_invoice', targetId: line.id,
              description: cleanFeeDescription(line.description), balance: bal, allocated: '', included: true
            });
          }
        });
        if (items.length > 0) {
          groups.push({ groupId: 'family_shared', groupName: 'Family Shared Fees', isFamily: true, items });
        }
      }

      setCartGroups(groups);
    } catch (err: any) {
      showToast('error', 'Failed to load line items for this term.');
    } finally {
      setDataLoading(false);
    }
  }, [filterSessionId, filterPeriodId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // ─── Ward Info & Wallet Math ───
  const wards = useMemo(() => rawParentData?.students || [], [rawParentData]);
  const eligibleWalletWards = useMemo(() => wards.filter((w: any) => Number(w.student?.fee_balance || 0) > 0), [wards]);

  const walletContributionKobo = useMemo(
    () => Object.values(walletContributions).reduce((s, v) => s + toKobo(v), 0),
    [walletContributions]
  );
  const tenderedKobo = toKobo(tenderedAmount);
  const totalAvailableKobo = tenderedKobo + walletContributionKobo;

  // ─── Manual Sum & Waterfall Allocation ───
  const manualSumKobo = useMemo(() => {
    let s = 0;
    cartGroups.forEach(g => g.items.forEach(it => {
      if (it.included !== false && manualOverrides[it.uid] !== undefined) {
        s += Math.min(Math.max(0, toKobo(manualOverrides[it.uid])), toKobo(it.balance));
      }
    }));
    return s;
  }, [cartGroups, manualOverrides]);

  const finalGroups: CartGroup[] = useMemo(() => {
    let rem = Math.max(0, totalAvailableKobo - manualSumKobo);
    return cartGroups.map(g => ({
      ...g,
      items: g.items.map(it => {
        if (it.included === false) return { ...it, allocated: '' };
        if (manualOverrides[it.uid] !== undefined) {
          const clampedKobo = Math.min(Math.max(0, toKobo(manualOverrides[it.uid])), toKobo(it.balance));
          return { ...it, allocated: clampedKobo > 0 ? String(fromKobo(clampedKobo)) : (manualOverrides[it.uid] === '' ? '' : '0') };
        }
        const balKobo = toKobo(it.balance);
        if (rem <= 0 || balKobo <= 0) return { ...it, allocated: '' };
        const allocKobo = Math.min(balKobo, rem);
        rem -= allocKobo;
        return { ...it, allocated: allocKobo > 0 ? String(fromKobo(allocKobo)) : '' };
      })
    }));
  }, [cartGroups, manualOverrides, totalAvailableKobo, manualSumKobo]);

  // Auto-sync tendered amount if the parent only touches the item boxes directly
  useEffect(() => {
    if (tenderedTouched) return;
    setTenderedAmount(manualSumKobo > 0 ? String(fromKobo(manualSumKobo)) : '');
  }, [manualSumKobo, tenderedTouched]);

  // ─── Input Handlers ───
  const handleTenderedChange = (val: string) => {
    setTenderedTouched(true);
    setTenderedAmount(val);
  };

  const handleManualAllocation = (uid: string, rawValue: string) => {
    setManualOverrides(prev => {
      const next = { ...prev };
      if (rawValue === '') delete next[uid];
      else next[uid] = rawValue;
      return next;
    });
  };

  const toggleItemIncluded = (uid: string) => {
    setCartGroups(prev => prev.map(g => ({
      ...g,
      items: g.items.map(it => it.uid === uid ? { ...it, included: it.included === false ? true : false } : it)
    })));
    setManualOverrides(prev => {
      if (!(uid in prev)) return prev;
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  };

  const resetToAutoFill = () => setManualOverrides({});

  const toggleWalletWard = (studentId: number, maxBalance: number) => {
    setWalletContributions(prev => {
      const next = { ...prev };
      if (next[studentId] !== undefined) delete next[studentId];
      else next[studentId] = String(maxBalance);
      return next;
    });
  };

  const handleWalletAmountChange = (studentId: number, rawValue: string, maxBalance: number) => {
    setWalletContributions(prev => {
      const clamped = rawValue === '' ? '' : String(Math.min(Math.max(0, Number(rawValue) || 0), maxBalance));
      return { ...prev, [studentId]: clamped };
    });
  };

  // ─── Sub-totals ───
  const totalAllocatedKobo = useMemo(
    () => finalGroups.reduce((s, g) => s + g.items.reduce((s2, i) => s2 + toKobo(i.allocated || 0), 0), 0),
    [finalGroups]
  );

  const selectedTotalKobo = useMemo(
    () => cartGroups.reduce((s, g) => s + g.items.reduce((s2, it) => it.included !== false ? s2 + toKobo(it.balance) : s2, 0), 0),
    [cartGroups]
  );

  const overpaymentKobo = Math.max(0, totalAvailableKobo - totalAllocatedKobo);
  const manualCount = Object.keys(manualOverrides).length;

  // ─── Overpayment Logic ───
  useEffect(() => {
    if (overpaymentKobo <= 0 || wards.length <= 1) return;
    setSplitPercentages(prev => {
      if (Object.keys(prev).length === wards.length) return prev;
      const base = Math.floor(100 / wards.length);
      const remainder = 100 - base * wards.length;
      const next: Record<number, number> = {};
      wards.forEach((w: any, idx: number) => { next[w.student.id] = base + (idx === 0 ? remainder : 0); });
      return next;
    });
  }, [overpaymentKobo > 0, wards.length]);

  const rebalanceSplit = (changedId: number, rawVal: number) => {
    const ids = wards.map((w: any) => w.student.id);
    const clampedNew = Math.max(0, Math.min(100, Math.round(rawVal)));
    setSplitPercentages(prev => {
      const cur = { ...prev };
      const oldVal = cur[changedId] ?? 0;
      let delta = clampedNew - oldVal;
      cur[changedId] = clampedNew;
      const others = ids.filter((id: number) => id !== changedId);
      let i = others.length - 1;
      while (delta !== 0 && i >= 0) {
        const id = others[i];
        const curVal = cur[id] ?? 0;
        if (delta > 0) {
          const take = Math.min(curVal, delta);
          cur[id] = curVal - take;
          delta -= take;
        } else {
          const give = Math.min(100 - curVal, -delta);
          cur[id] = curVal + give;
          delta += give;
        }
        i--;
      }
      return cur;
    });
  };

  const overpaymentAllocations = useMemo(() => {
    if (overpaymentKobo <= 0) return [];
    if (wards.length <= 1) {
      const only = wards[0];
      return only ? [{ studentId: only.student.id, name: toTitleCase(only.student.full_name), amountKobo: overpaymentKobo }] : [];
    }
    if (overpaymentMode === 'select') {
      if (!overpaymentTargetId) return [];
      const w = wards.find((x: any) => x.student.id === overpaymentTargetId);
      return w ? [{ studentId: overpaymentTargetId, name: toTitleCase(w.student.full_name), amountKobo: overpaymentKobo }] : [];
    }
    const ids = wards.map((w: any) => w.student.id);
    let running = 0;
    const raw = ids.map((id: number) => {
      const pct = splitPercentages[id] ?? 0;
      const amt = Math.round(overpaymentKobo * pct / 100);
      running += amt;
      const w = wards.find((x: any) => x.student.id === id);
      return { studentId: id, name: toTitleCase(w?.student.full_name || ''), amountKobo: amt };
    });
    const diff = overpaymentKobo - running;
    if (raw.length) raw[raw.length - 1].amountKobo += diff;
    return raw;
  }, [overpaymentKobo, wards, overpaymentMode, overpaymentTargetId, splitPercentages]);

  // ─── Validation ───
  const externalNeeded = tenderedKobo > 0;
  const bankRequired = externalNeeded;
  const proofRequired = externalNeeded;
  const overpaymentNeedsTarget = overpaymentKobo > 0 && wards.length > 1 && overpaymentMode === 'select' && !overpaymentTargetId;

  const canConfirm = totalAvailableKobo > 0
    && !(bankRequired && !bankAccountId)
    && !(proofRequired && !proofFile)
    && !overpaymentNeedsTarget;

  // ─── Pre-submit Warnings ───
  const getPreSubmitWarnings = (): string[] => {
    const warnings: string[] = [];
    wards.forEach((w: any) => {
      const sid = w.student.id;
      if (walletContributions[sid] !== undefined) return;
      const balKobo = toKobo(w.student?.fee_balance || 0);
      if (balKobo <= 0) return;
      const group = finalGroups.find(g => g.groupId === `stu_${sid}`);
      const wardAllocKobo = group ? group.items.reduce((s, it) => s + toKobo(it.allocated || 0), 0) : 0;
      if (wardAllocKobo > 0 && balKobo >= wardAllocKobo && tenderedKobo > 0) {
        warnings.push(
          `${toTitleCase(w.student.full_name)} has ${formatCurrency(fromKobo(balKobo))} in their wallet — enough to cover the ${formatCurrency(fromKobo(wardAllocKobo))} currently being charged. Consider ticking their wallet instead. Continue anyway?`
        );
      }
    });
    return warnings;
  };

  const handlePreviewClick = () => {
    const warnings = getPreSubmitWarnings();
    if (warnings.length > 0) { setWarningModal({ warnings, action: 'preview' }); return; }
    setShowPreview(true);
  };

  const handleConfirmClick = () => {
    const warnings = getPreSubmitWarnings();
    if (warnings.length > 0) { setWarningModal({ warnings, action: 'submit' }); return; }
    handleSubmit();
  };

  // ─── Submission ───
  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    if (!canConfirm) {
      if (totalAvailableKobo <= 0) showToast('error', 'Enter a payment amount or select a wallet source.');
      else if (bankRequired && !bankAccountId) showToast('error', 'Select the school bank account you transferred to.');
      else if (proofRequired && !proofFile) showToast('error', 'Upload your payment receipt.');
      else if (overpaymentNeedsTarget) showToast('error', 'Select which ward should receive the excess wallet credit.');
      return;
    }

    setIsSubmitting(true);

    try {
      const debtAllocations: any[] = [];
      finalGroups.forEach(g => {
        g.items.forEach(a => {
          if (parseFloat(a.allocated) > 0) {
            debtAllocations.push({ target_type: a.targetType, target_id: a.targetId, amount: a.allocated });
          }
        });
      });
      const overpayAllocPayload = overpaymentAllocations
        .filter(o => o.amountKobo > 0)
        .map(o => ({ target_type: 'wallet_funding', target_id: o.studentId, amount: String(fromKobo(o.amountKobo)) }));

      const fundingSources: any[] = [];
      Object.entries(walletContributions).forEach(([sid, amt]) => {
        const parsed = parseFloat(amt || '0');
        if (parsed > 0) {
          fundingSources.push({ source_type: 'wallet', wallet_student_id: Number(sid), wallet_type: 'fee', amount: parsed });
        }
      });
      if (tenderedKobo > 0) {
        fundingSources.push({ source_type: 'external', amount: fromKobo(tenderedKobo) });
      }

      const formData = new FormData();
      formData.append('total_amount', String(fromKobo(totalAvailableKobo)));

      if (tenderedKobo > 0) {
        formData.append('external_amount', String(fromKobo(tenderedKobo)));
        if (bankAccountId) formData.append('bank_account_id', bankAccountId);
        if (reference) formData.append('reference', reference);
        if (proofFile) formData.append('proof_of_payment', proofFile);
      }

      formData.append('funding_sources', JSON.stringify(fundingSources));
      formData.append('allocations', JSON.stringify([...debtAllocations, ...overpayAllocPayload]));

      // ─── THE NEW SECURE ENDPOINT ───
      await api.post('/api/fee/parent-submit-proof/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast('success', 'Payment proof submitted successfully for confirmation!');
      setShowPreview(false);

      setTimeout(() => {
        router.push('/dashboard/parent/fees/history');
      }, 1500);

    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="py-32 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-32 px-4 sm:px-6">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Help Modal ── */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* ── Warning Modal ── */}
      {warningModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="font-black text-amber-900 text-sm">Please Confirm Before Proceeding</h3>
            </div>
            <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
              {warningModal.warnings.map((w, i) => (
                <p key={i} className="text-xs font-medium text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-3">{w}</p>
              ))}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setWarningModal(null)} className="px-5 py-2.5 font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100">
                Go Back &amp; Fix
              </button>
              <button
                onClick={() => {
                  const action = warningModal.action;
                  setWarningModal(null);
                  if (action === 'preview') setShowPreview(true);
                  else handleSubmit();
                }}
                className="px-5 py-2.5 font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {showPreview && (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowPreview(false)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="font-black text-slate-800 text-lg">Preview Upload Transaction</h3>
              <button onClick={() => setShowPreview(false)} className="p-1.5 hover:bg-slate-200 rounded-md" aria-label="Close"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Applied to Debts</p>
              <table className="w-full text-left text-sm whitespace-nowrap mb-6">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-widest">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Balance Before</th>
                    <th className="pb-2 text-right text-emerald-600">Paying Now</th>
                    <th className="pb-2 text-right text-indigo-600">New Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finalGroups.flatMap(g => g.items).filter(i => parseFloat(i.allocated) > 0).map(item => (
                    <tr key={item.uid}>
                      <td className="py-3 font-bold text-slate-800 truncate max-w-[200px]">{item.description}</td>
                      <td className="py-3 text-right font-medium text-slate-500">{formatCurrency(item.balance)}</td>
                      <td className="py-3 text-right font-black text-emerald-600">+{formatCurrency(Number(item.allocated))}</td>
                      <td className="py-3 text-right font-black text-indigo-600">{formatCurrency(item.balance - Number(item.allocated))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(Object.keys(walletContributions).length > 0 || tenderedKobo > 0) && (
                <>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Funding Sources</p>
                  <div className="space-y-1.5 mb-6">
                    {Object.entries(walletContributions).filter(([, v]) => parseFloat(v) > 0).map(([sid, amt]) => {
                      const w = wards.find((x: any) => String(x.student.id) === sid);
                      return (
                        <div key={sid} className="flex justify-between text-sm bg-indigo-50 px-3 py-2 rounded-lg">
                          <span className="font-bold text-indigo-800 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5"/> {toTitleCase(w?.student.full_name || 'Wallet')}</span>
                          <span className="font-black text-indigo-700">{formatCurrency(Number(amt))}</span>
                        </div>
                      );
                    })}
                    {tenderedKobo > 0 && (
                      <div className="flex justify-between text-sm bg-slate-100 px-3 py-2 rounded-lg">
                        <span className="font-bold text-slate-700">Bank Transfer / Deposit</span>
                        <span className="font-black text-slate-700">{formatCurrency(fromKobo(tenderedKobo))}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {overpaymentAllocations.length > 0 && (
                <>
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Excess Credited to Wallet</p>
                  <div className="space-y-1.5 mb-6">
                    {overpaymentAllocations.map(o => (
                      <div key={o.studentId} className="flex justify-between text-sm bg-amber-50 px-3 py-2 rounded-lg">
                        <span className="font-bold text-amber-800">{o.name}</span>
                        <span className="font-black text-amber-700">{formatCurrency(fromKobo(o.amountKobo))}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-600">Total Upload Proof Amount</span>
                <span className="font-black text-2xl text-slate-900">{formatCurrency(fromKobo(totalAvailableKobo))}</span>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowPreview(false)} className="px-5 py-2.5 font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100">Cancel</button>
              <button onClick={handleConfirmClick} disabled={isSubmitting || !canConfirm} className="px-6 py-2.5 font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Check className="w-4 h-4"/> Confirm &amp; Process</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm pt-6 mt-4">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-slate-900">Upload Payment Proof</h1>
          <p className="text-xs text-slate-400">Allocate your bank transfer across your wards securely.</p>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors shrink-0"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">How this works</span>
        </button>
      </div>

      {/* ── Term Selector ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-48">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Academic Session</label>
            <select value={filterSessionId} onChange={e => setFilterSessionId(e.target.value)} className="w-full px-3 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none">
              {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Term / Period</label>
            <select value={filterPeriodId} onChange={e => setFilterPeriodId(e.target.value)} disabled={!filterSessionId} className="w-full px-3 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none">
              {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Data Views ── */}
      {dataLoading ? (
        <div className="py-20 flex justify-center bg-white rounded-2xl border border-slate-200"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
      ) : cartGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Check className="w-12 h-12 text-emerald-500 mx-auto bg-emerald-50 p-2 rounded-full" />
          <h3 className="font-black text-slate-800 text-base">All Caught Up!</h3>
          <p className="text-xs text-slate-400">No outstanding balance for this selected term.</p>
          <button onClick={() => router.push('/dashboard/parent/fees')} className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm mt-2">
            Return to Ledger
          </button>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Line Items */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-sm font-black text-slate-800">Fee Allocation Breakdown</h3>
                <span className="text-[10px] font-bold text-slate-500 px-2.5 py-1 bg-white border border-slate-200 rounded-full">
                  Selected Bills: {formatCurrency(fromKobo(selectedTotalKobo))}
                </span>
                {manualCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full">
                    <span className="text-[9px] font-black text-amber-700 uppercase tracking-wide">Manual: {manualCount} item{manualCount > 1 ? 's' : ''}</span>
                    <button onClick={resetToAutoFill} className="text-[9px] font-black text-indigo-600 underline">Reset to Auto-fill</button>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 pt-3 pb-1">
              <p className="text-[11px] text-slate-400 font-medium">
                Uncheck an item to exclude it, or type an amount directly into a box — everything else fills automatically based on your deposit amount.
              </p>
            </div>

            {/* Column headers — desktop/tablet only, mobile stacks instead */}
            <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest border-y-2 border-slate-200">
              <div className="w-6"></div>
              <div className="flex-1">Description</div>
              <div className="w-28 text-right">Balance Due</div>
              <div className="w-36 text-right">Allocated Pay</div>
            </div>

            <div className="divide-y divide-slate-100 min-h-[120px]">
              {finalGroups.map(group => (
                <div key={group.groupId}>
                  <div className={`flex items-center gap-2 px-5 py-2 ${group.isFamily ? 'bg-purple-50 border-y border-purple-100' : 'bg-slate-50 border-y border-slate-200'}`}>
                    {group.isFamily ? <Building2 className="w-4 h-4 text-purple-400 shrink-0"/> : <UserCircle className="w-4 h-4 text-slate-400 shrink-0"/>}
                    <span className={`text-xs font-black truncate ${group.isFamily ? 'text-purple-900' : 'text-slate-800'}`}>{group.groupName}</span>
                    {group.groupMeta && (
                      <span className="text-[10px] font-bold text-slate-400 normal-case shrink-0">• {group.groupMeta}</span>
                    )}
                  </div>

                  {group.items.map(item => {
                    const excluded = item.included === false;
                    return (
                      <div
                        key={item.uid}
                        className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-5 py-3 transition-colors ${excluded ? 'opacity-40' : group.isFamily ? 'hover:bg-purple-50/50' : 'hover:bg-slate-50'} ${item.targetType === 'ancillary_debt' ? 'bg-amber-50/20' : ''}`}
                      >
                        {/* Checkbox + description (+ balance on mobile) */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={!excluded}
                            onChange={() => toggleItemIncluded(item.uid)}
                            className="w-3.5 h-3.5 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-bold text-slate-700 break-words ${excluded ? 'line-through' : ''}`}>
                              {item.targetType === 'ancillary_debt' && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] mr-1.5 align-middle">FINE</span>
                              )}
                              {item.description}
                            </p>
                            <p className="text-[11px] font-black text-rose-600 sm:hidden mt-0.5">
                              Balance: {formatCurrency(item.balance)}
                            </p>
                          </div>
                        </div>

                        {/* Balance due — desktop/tablet only */}
                        <div className="hidden sm:block w-28 text-right text-xs font-black text-rose-600 shrink-0">
                          {formatCurrency(item.balance)}
                        </div>

                        {/* Allocated input */}
                        <div className="w-full sm:w-36 shrink-0 pl-6 sm:pl-0">
                          {excluded ? (
                            <span className="text-[10px] text-slate-300 italic">excluded</span>
                          ) : (
                            <input
                              type="number"
                              value={item.allocated}
                              onChange={e => handleManualAllocation(item.uid, e.target.value)}
                              placeholder="0.00"
                              className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-right shadow-sm bg-white"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Wallet Pull */}
          {eligibleWalletWards.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><Wallet className="w-4 h-4 text-indigo-500"/> Apply Wallet Credit</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Use existing wallet balances to reduce the cash/transfer required.</p>
              </div>
              <div className="p-4 space-y-2.5">
                {eligibleWalletWards.map((w: any) => {
                  const sid = w.student.id;
                  const maxBal = Number(w.student.fee_balance);
                  const checked = walletContributions[sid] !== undefined;
                  return (
                    <div key={sid} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${checked ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-100'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleWalletWard(sid, maxBal)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-800">{toTitleCase(w.student.full_name)}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Available: {formatCurrency(maxBal)}</p>
                      </div>
                      {checked && (
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₦</span>
                          <input type="number" value={walletContributions[sid]} onChange={e => handleWalletAmountChange(sid, e.target.value, maxBal)}
                            className="w-full pl-5 pr-2 py-1.5 text-xs font-bold border border-indigo-200 rounded-lg text-right outline-none bg-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Proof Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-500" /> Payment Proof Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  School Bank Account Paid Into <span className="text-red-500">*</span>
                </label>
                <select
                  value={bankAccountId}
                  onChange={e => setBankAccountId(e.target.value)}
                  className={`w-full px-3.5 py-3 border rounded-xl text-xs font-bold outline-none bg-slate-50 transition-colors ${attemptedSubmit && bankRequired && !bankAccountId ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                >
                  <option value="">Select an account...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>)}
                </select>
                {attemptedSubmit && bankRequired && !bankAccountId && (
                  <p className="text-[10px] text-red-500 font-bold mt-1">Please select which account you paid into.</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Transfer Reference <span className="text-slate-300 font-medium normal-case">(optional)</span>
                </label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. TRF-2026-XXXX" className="w-full px-3.5 py-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50" />
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Receipt / Screenshot Document <span className="text-red-500">*</span>
              </label>
              <label className={`flex items-center justify-center gap-3 w-full px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-all ${attemptedSubmit && proofRequired && !proofFile ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50/50 text-slate-600'}`}>
                <Upload className={`w-5 h-5 shrink-0 ${proofFile ? 'text-emerald-500' : 'text-slate-400'}`} />
                <span className="font-bold text-sm truncate max-w-sm">{proofFile ? proofFile.name : 'Click to Browse File (PDF, JPG, PNG)'}</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setProofFile(e.target.files?.[0] || null)} required />
              </label>
              {attemptedSubmit && proofRequired && !proofFile && (
                <p className="text-[10px] text-red-500 font-bold mt-1.5">Please upload your payment receipt.</p>
              )}
            </div>
          </div>

          {/* Overpayment Logic */}
          {overpaymentKobo > 0 && (
            <div className="bg-amber-50 rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-amber-200 bg-amber-100/60">
                <h3 className="text-sm font-black text-amber-900 flex items-center gap-2"><Info className="w-4 h-4"/> Excess Deposit Detected</h3>
                <p className="text-xs text-amber-800 font-medium mt-0.5">
                  {formatCurrency(totalAllocatedKobo / 100)} will clear the selected bills. The remaining <strong>{formatCurrency(fromKobo(overpaymentKobo))}</strong> will be saved to your {wards.length === 1 ? "ward's" : "wards'"} wallet for future use.
                </p>
              </div>
              <div className="p-5">
                {wards.length <= 1 ? (
                  <p className="text-xs font-bold text-amber-800 flex items-center gap-2"><UserCheck className="w-4 h-4"/> Safely depositing to {toTitleCase(wards[0]?.student.full_name || 'student')}'s wallet.</p>
                ) : (
                  <>
                    <div className="flex gap-2 mb-4 p-1 bg-white rounded-lg border border-amber-200 w-fit">
                      <button onClick={() => setOverpaymentMode('select')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${overpaymentMode === 'select' ? 'bg-amber-600 text-white' : 'text-amber-700'}`}>Select Ward</button>
                      <button onClick={() => setOverpaymentMode('split')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${overpaymentMode === 'split' ? 'bg-amber-600 text-white' : 'text-amber-700'}`}>Split Among Wards</button>
                    </div>

                    {overpaymentMode === 'select' ? (
                      <div className="space-y-2">
                        {wards.map((w: any) => (
                          <label key={w.student.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${overpaymentTargetId === w.student.id ? 'border-amber-500 bg-white' : 'border-transparent bg-white/50 hover:bg-white'}`}>
                            <input type="radio" checked={overpaymentTargetId === w.student.id} onChange={() => setOverpaymentTargetId(w.student.id)} className="w-4 h-4 text-amber-600 cursor-pointer" />
                            <span className="text-xs font-bold text-slate-800">{toTitleCase(w.student.full_name)}</span>
                          </label>
                        ))}
                        {attemptedSubmit && overpaymentNeedsTarget && (
                          <p className="text-[10px] text-red-600 font-bold">Please select which ward should receive the excess balance.</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {wards.map((w: any) => (
                          <div key={w.student.id} className="flex items-center gap-3 p-3 rounded-xl border-2 border-transparent bg-white">
                            <span className="text-xs font-bold text-slate-800 flex-1">{toTitleCase(w.student.full_name)}</span>
                            <div className="relative w-24">
                              <input type="number" min={0} max={100} value={splitPercentages[w.student.id] ?? 0}
                                onChange={e => rebalanceSplit(w.student.id, Number(e.target.value))}
                                className="w-full pr-6 pl-2 py-1.5 text-xs font-bold border border-slate-300 rounded-lg text-right outline-none focus:ring-1 focus:ring-amber-500" />
                              <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                            </div>
                            <span className="text-xs font-black text-amber-700 w-24 text-right">
                              {formatCurrency(fromKobo(Math.round(overpaymentKobo * (splitPercentages[w.student.id] ?? 0) / 100)))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Fixed Bottom Action Bar ── */}
      {cartGroups.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 px-4 py-3 md:px-8">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Amount Deposited</label>
                <div className="relative w-44">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₦</span>
                  <input
                    type="number"
                    value={tenderedAmount}
                    onChange={e => handleTenderedChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border-2 border-indigo-400 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                </div>
              </div>

              <button onClick={handlePreviewClick} disabled={totalAllocatedKobo <= 0 && overpaymentKobo <= 0} className="self-end flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors">
                <Eye className="w-3.5 h-3.5" /> Preview Allocation
              </button>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Settlement</p>
                <p className="text-lg font-black text-indigo-600">{formatCurrency(fromKobo(totalAvailableKobo))}</p>
              </div>
              <button
                onClick={handleConfirmClick}
                disabled={!canConfirm || isSubmitting}
                title={!canConfirm ? 'Enter amount and upload receipt' : undefined}
                className="px-7 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Check className="w-4 h-4"/> Submit Proof</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParentCheckoutPage() {
  return (
    <Suspense fallback={<div className="py-32 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}>
      <ParentCheckoutContent />
    </Suspense>
  );
}