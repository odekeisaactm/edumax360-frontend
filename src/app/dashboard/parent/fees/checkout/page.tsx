'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI } from '@/lib/api';
import {
  ArrowLeft, Loader2, Check, AlertCircle, CreditCard, Upload, Globe, Wallet, ShieldCheck, X, Calendar, Building2, UserCircle
} from 'lucide-react';

declare global {
  interface Window {
    PaystackPop?: any;
  }
}

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

function ParentCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const urlSession = searchParams.get('session');
  const urlPeriod = searchParams.get('period');

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

  const [filterSessionId, setFilterSessionId] = useState<string>(urlSession || '');
  const [filterPeriodId, setFilterPeriodId] = useState<string>(urlPeriod || '');

  const [rawParentData, setRawParentData] = useState<any>(null);
  const [cartGroups, setCartGroups] = useState<CartGroup[]>([]);

  const [paymentMode, setPaymentMode] = useState<'online' | 'upload'>('online');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [tenderedTouched, setTenderedTouched] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  const [walletContributions, setWalletContributions] = useState<Record<number, string>>({});
  const [reference, setReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Paystack script
  useEffect(() => {
    if (!document.getElementById('paystack-script')) {
      const script = document.createElement('script');
      script.id = 'paystack-script';
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Initialize Sessions & Periods cleanly via calendar API
  useEffect(() => {
    const init = async () => {
      try {
        const [sessData, curSessRaw] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession().catch(() => null)
        ]);
        setSessions(Array.isArray(sessData) ? sessData : []);

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
        showToast('error', 'Failed to initialize academic calendar.');
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

  // Fetch Ledger data for the selected session and term
  const fetchLedger = useCallback(async () => {
    if (!filterSessionId || !filterPeriodId) return;
    setDataLoading(true);
    setCartGroups([]);
    setRawParentData(null);
    setTenderedAmount('');
    setTenderedTouched(false);
    setManualOverrides({});
    setWalletContributions({});

    try {
      const res = await feeAPI.getBillingLedger({
        session_id: filterSessionId,
        period_id: filterPeriodId,
        mode: 'parent'
      });
      const parentData = res.results?.[0] || res?.[0] || res;
      if (!parentData) {
        setRawParentData(null);
        setDataLoading(false);
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

  const wards = useMemo(() => rawParentData?.students || [], [rawParentData]);
  const eligibleWalletWards = useMemo(() => wards.filter((w: any) => Number(w.student?.fee_balance || 0) > 0), [wards]);

  // Waterfall allocation calculations
  const walletContributionKobo = useMemo(
    () => Object.values(walletContributions).reduce((s, v) => s + toKobo(v), 0),
    [walletContributions]
  );
  const tenderedKobo = toKobo(tenderedAmount);
  const totalAvailableKobo = tenderedKobo + walletContributionKobo;

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

  useEffect(() => {
    if (tenderedTouched) return;
    setTenderedAmount(manualSumKobo > 0 ? String(fromKobo(manualSumKobo)) : '');
  }, [manualSumKobo, tenderedTouched]);

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
  };

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

  const totalAllocatedKobo = useMemo(
    () => finalGroups.reduce((s, g) => s + g.items.reduce((s2, i) => s2 + toKobo(i.allocated || 0), 0), 0),
    [finalGroups]
  );

  const canConfirm = totalAvailableKobo > 0 && totalAllocatedKobo > 0;

  const handlePostPaymentVerification = async (txRef: string) => {
    try {
      await feeAPI.verifyOnlinePayment(txRef);
      showToast('success', 'Payment verified and credited successfully!');
      setTimeout(() => {
        router.push(`/dashboard/parent/fees?session=${filterSessionId}&period=${filterPeriodId}`);
      }, 1500);
    } catch (err) {
      showToast('error', 'Verification pending or failed. Please check payment history.');
    }
  };

  const handleSubmit = async () => {
    if (!canConfirm) {
      showToast('error', 'Please enter a payment amount or select a funding source.');
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

      if (paymentMode === 'online') {
        const payload: any = {
          parent_id: rawParentData.parent_id,
          total_amount: fromKobo(totalAvailableKobo),
          external_payment_mode: 'online',
          external_amount: tenderedKobo > 0 ? fromKobo(tenderedKobo) : 0,
          funding_sources: fundingSources,
          allocations: debtAllocations,
        };
        const receiptRes = await feeAPI.checkout(payload);
        const billingEmail = user?.email || rawParentData.email || 'parent@school.com';

        const gatewayRes = await feeAPI.initiateOnlinePayment({
          payment_type: 'master_checkout',
          payment_id: receiptRes.id,
          amount: fromKobo(totalAvailableKobo),
          email: billingEmail
        });

        if (gatewayRes.provider === 'paystack') {
          if (!window.PaystackPop) throw new Error('Paystack SDK failed to load.');
          const handler = window.PaystackPop.setup({
            key: gatewayRes.public_key,
            email: billingEmail,
            amount: totalAvailableKobo,
            ref: gatewayRes.reference,
            access_code: gatewayRes.access_code,
            onClose: () => showToast('error', 'Payment canceled.'),
            callback: () => handlePostPaymentVerification(gatewayRes.reference),
          });
          handler.openIframe();
        } else if (gatewayRes.payment_url) {
          window.location.href = gatewayRes.payment_url;
        }
      } else {
        const formData = new FormData();
        formData.append('parent_id', rawParentData.parent_id);
        formData.append('total_amount', String(fromKobo(totalAvailableKobo)));
        formData.append('external_payment_mode', 'bank_transfer');
        formData.append('external_amount', String(tenderedKobo > 0 ? fromKobo(tenderedKobo) : 0));
        if (reference) formData.append('reference', reference);
        if (proofFile) formData.append('proof_of_payment', proofFile);
        formData.append('funding_sources', JSON.stringify(fundingSources));
        formData.append('allocations', JSON.stringify(debtAllocations));

        await feeAPI.checkout(formData);
        showToast('success', 'Payment proof submitted for cashier confirmation!');
        setTimeout(() => {
          router.push(`/dashboard/parent/fees?session=${filterSessionId}&period=${filterPeriodId}`);
        }, 1500);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || 'Checkout failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="py-32 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-32 px-4 sm:px-6">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* Header */}
      <div className="flex items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-black text-slate-900">Secure Family Checkout</h1>
          <p className="text-xs text-slate-400">Settle bills across all your wards in a single transaction</p>
        </div>
      </div>

      {/* Term Selector Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-40">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Session</label>
            <select value={filterSessionId} onChange={e => setFilterSessionId(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none">
              {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-44">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Term / Period</label>
            <select value={filterPeriodId} onChange={e => setFilterPeriodId(e.target.value)} disabled={!filterSessionId} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none">
              {periods.map(p => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {dataLoading ? (
        <div className="py-20 flex justify-center bg-white rounded-2xl border border-slate-200"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
      ) : cartGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Check className="w-12 h-12 text-emerald-500 mx-auto bg-emerald-50 p-2 rounded-full" />
          <h3 className="font-black text-slate-800 text-base">All Caught Up!</h3>
          <p className="text-xs text-slate-400">No outstanding balance for this term.</p>
          <button onClick={() => router.push('/dashboard/parent/fees')} className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm">
            Return to Ledger
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Line Items Table with Waterfall Allocation */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Line Items Allocation</h3>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                Total Owed: {formatCurrency(rawParentData?.grand_total_outstanding || 0)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="w-10 px-3 py-2.5 text-center"></th>
                    <th className="px-4 py-2.5">Description</th>
                    <th className="px-4 py-2.5 text-right">Balance Due</th>
                    <th className="px-4 py-2.5 text-right w-36">Allocate Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finalGroups.map(group => (
                    <React.Fragment key={group.groupId}>
                      <tr className={group.isFamily ? "bg-purple-50/60" : "bg-slate-50/60"}>
                        <td className="px-3 py-2"></td>
                        <td colSpan={3} className={`px-4 py-2 font-black ${group.isFamily ? 'text-purple-900' : 'text-slate-800'}`}>
                          {group.groupName} {group.groupMeta ? `• ${group.groupMeta}` : ''}
                        </td>
                      </tr>
                      {group.items.map(item => {
                        const excluded = item.included === false;
                        return (
                          <tr key={item.uid} className={excluded ? 'opacity-40' : 'hover:bg-slate-50/50'}>
                            <td className="px-3 py-2.5 text-center">
                              <input type="checkbox" checked={!excluded} onChange={() => toggleItemIncluded(item.uid)} className="w-3.5 h-3.5 text-indigo-600 rounded" aria-label={`Include ${item.description}`} />
                            </td>
                            <td className={`px-4 py-2.5 font-bold text-slate-700 ${excluded ? 'line-through' : ''}`}>{item.description}</td>
                            <td className="px-4 py-2.5 text-right font-black text-rose-600">{formatCurrency(item.balance)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <input
                                type="number"
                                value={item.allocated}
                                onChange={e => handleManualAllocation(item.uid, e.target.value)}
                                placeholder="0.00"
                                aria-label={`Allocate payment to ${item.description}`}
                                className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-right outline-none focus:ring-1 focus:ring-indigo-500 bg-white shadow-2xs"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Multi-Wallet Contributions */}
          {eligibleWalletWards.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2"><Wallet className="w-4 h-4 text-indigo-500"/> Fund From Student Wallet</h3>
              <div className="space-y-2">
                {eligibleWalletWards.map((w: any) => {
                  const sid = w.student.id;
                  const maxBal = Number(w.student.fee_balance);
                  const checked = walletContributions[sid] !== undefined;
                  return (
                    <div key={sid} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${checked ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-100'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleWalletWard(sid, maxBal)} className="w-4 h-4 text-indigo-600 rounded" aria-label={`Use ${toTitleCase(w.student.full_name)} wallet`} />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-800">{toTitleCase(w.student.full_name)}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Available: {formatCurrency(maxBal)}</p>
                      </div>
                      {checked && (
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₦</span>
                          <input type="number" value={walletContributions[sid]} onChange={e => handleWalletAmountChange(sid, e.target.value, maxBal)}
                            className="w-full pl-5 pr-2 py-1.5 text-xs font-bold border border-indigo-200 rounded-lg text-right outline-none" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Mode Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Choose Settlement Method</h3>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPaymentMode('online')} className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${paymentMode === 'online' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200'}`}>
                <Globe className={`w-5 h-5 ${paymentMode === 'online' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">Pay Online (Paystack)</p>
                  <p className="text-[10px] text-slate-400">Instant verification</p>
                </div>
              </button>
              <button type="button" onClick={() => setPaymentMode('upload')} className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${paymentMode === 'upload' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200'}`}>
                <Upload className={`w-5 h-5 ${paymentMode === 'upload' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">Bank Transfer Proof</p>
                  <p className="text-[10px] text-slate-400">Upload receipt image</p>
                </div>
              </button>
            </div>

            {paymentMode === 'upload' && (
              <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Transfer Reference</label>
                  <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. TRF-2026-XXXX" className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl outline-none font-bold text-slate-700" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Proof Document <span className="text-rose-500">*</span></label>
                  <label className="flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 text-xs text-slate-600 font-bold transition-colors">
                    <Upload className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate flex-1">{proofFile ? proofFile.name : 'Choose file (PDF, JPG, PNG)'}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setProofFile(e.target.files?.[0] || null)} required />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fixed Bottom Action Bar */}
      {cartGroups.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Amount Tendered</p>
              <div className="relative w-44 mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₦</span>
                <input
                  type="number"
                  value={tenderedAmount}
                  onChange={e => { setTenderedTouched(true); setTenderedAmount(e.target.value); }}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 border-2 border-indigo-500 rounded-xl text-sm font-black outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Settlement</p>
                <p className="text-xl font-black text-indigo-600">{formatCurrency(fromKobo(totalAvailableKobo))}</p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !canConfirm}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-40"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Check className="w-4 h-4"/> Confirm &amp; Pay</>}
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