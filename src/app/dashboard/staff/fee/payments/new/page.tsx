'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, { feeAPI, studentsAPI, parentsAPI, financeAPI, financeSettingsAPI, academicCalendarAPI } from '@/lib/api';
import {
  Users, Search, ArrowLeft, X, Loader2, UserCircle,
  Check, AlertCircle, ShoppingCart, Eye, FileText,
  Upload, Building2, Calendar, ShieldMinus, Wallet, Info,
  ChevronDown, ChevronUp, AlertTriangle, CreditCard, Percent, UserCheck
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;

function fmtMoney(amount: number | string): string {
  return '₦' + Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.non_field_errors) return (d.non_field_errors as string[]).join(' ');
  }
  return err?.message || 'An unexpected error occurred.';
}

// Kobo-safe integer math — avoids floating point drift across repeated
// waterfall recalculations on decimal Naira amounts.
const toKobo = (naira: number | string) => Math.round(Number(naira || 0) * 100);
const fromKobo = (kobo: number) => kobo / 100;

// Period-type naming is cached in localStorage for 7 days so we don't hit the
// API on every visit just to know whether this school calls it "Terms" or
// "Quarters".
const PERIOD_NAME_CACHE_KEY = 'academic_period_name';
const PERIOD_NAME_TTL_MS = 7 * 24 * 60 * 60 * 1000;
function getCachedPeriodName(): string | null {
  try {
    const raw = localStorage.getItem(PERIOD_NAME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.expiresAt > Date.now() && parsed?.value) return parsed.value;
  } catch { /* ignore */ }
  return null;
}
function setCachedPeriodName(value: string) {
  try {
    localStorage.setItem(PERIOD_NAME_CACHE_KEY, JSON.stringify({ value, expiresAt: Date.now() + PERIOD_NAME_TTL_MS }));
  } catch { /* ignore */ }
}

const REDIRECT_PREF_KEY = 'pos_redirect_pref';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CartItem {
  uid: string;
  targetType: 'invoice' | 'family_invoice' | 'ancillary_debt';
  targetId: number;
  description: string;
  balance: number;
  allocated: string;
  included?: boolean; // false = excluded from this payment run entirely. Defaults to true (undefined treated as included).
  rawObj: any;
}
interface CartGroup {
  groupId: string;
  groupName: string;
  isFamily: boolean;
  items: CartItem[];
}
interface TermOption {
  session_id: number | null;
  period_id: number | null;
  label: string;
  total_owed: number;
}

export default function POSCheckoutPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const presetParentId = searchParams.get('parent_id');
  const presetStudentId = searchParams.get('student_id');

  // ─── State: Global ───
  const [preLoading, setPreLoading] = useState(true);
  const [step, setStep] = useState<'search' | 'cart'>('search');
  const [settings, setSettings] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [periodTypeName, setPeriodTypeName] = useState<string>('Terms');
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null);
  // Refs mirror the two IDs above so the very first `handleSelectProfile` call
  // (triggered from a preset ?parent_id=/?student_id= URL) can read the
  // "current term" synchronously, without waiting on a render cycle.
  const currentSessionIdRef = useRef<number | null>(null);
  const currentPeriodIdRef = useRef<number | null>(null);

  // ─── State: Search ───
  const [searchType, setSearchType] = useState<'student' | 'parent'>(presetParentId ? 'parent' : 'student');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);

  // ─── State: Cart 2-Step Data ───
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [termsWithDebt, setTermsWithDebt] = useState<TermOption[]>([]);
  const [activeTerm, setActiveTerm] = useState<TermOption | null>(null);

  const [loadingLedger, setLoadingLedger] = useState(false);
  const [cartGroups, setCartGroups] = useState<CartGroup[]>([]);
  const [rawParentData, setRawParentData] = useState<any>(null); // full ledger response for this term — drives the statement drawer

  // ─── State: Payment Inputs ───
  const [tenderedAmount, setTenderedAmount] = useState<string>(''); // external cash/transfer/pos amount — drives the waterfall alongside wallet contributions
  const [tenderedTouched, setTenderedTouched] = useState(false); // true once the cashier has directly typed into "Amount Tendered" — stops the item-first auto-sync (see manualOverrides effect below)
  const [paymentMode, setPaymentMode] = useState('cash');
  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // ─── State: Per-Item Manual Overrides ───
  // uid -> raw string the cashier typed directly into that item's "Allocated Pay" box.
  // Items NOT in this map are auto-filled by the waterfall (in order) using whatever
  // funds remain after manual entries are subtracted. This replaces the old global
  // "manualMode" boolean, which used to freeze the *entire* cart the instant any single
  // item was hand-edited.
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});

  // ─── State: Multi-Wallet Funding Sources ───
  const [walletContributions, setWalletContributions] = useState<Record<number, string>>({}); // studentId -> amount

  // ─── State: Overpayment Distribution ───
  const [overpaymentMode, setOverpaymentMode] = useState<'select' | 'split'>('select');
  const [overpaymentTargetId, setOverpaymentTargetId] = useState<number | null>(null);
  const [splitPercentages, setSplitPercentages] = useState<Record<number, number>>({});

  const [postSaveAction, setPostSaveAction] = useState<'list' | 'stay'>('list');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // ─── State: Modals ───
  const [showStatementDrawer, setShowStatementDrawer] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [warningModal, setWarningModal] = useState<{ warnings: string[]; action: 'preview' | 'submit' } | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToasts(p => [...p, { id: ++_toastId, type, message }]);
    setTimeout(() => setToasts(p => p.slice(1)), 4000);
  };

  // ─── INIT ───
  useEffect(() => {
    const init = async () => {
      try {
        const [sets, bks, curSessRaw, curPerRes] = await Promise.all([
          financeSettingsAPI.get().catch(() => null),
          financeAPI.bankDetails.list({ is_active: true, account_type: 'bank' }).catch(() => []),
          academicCalendarAPI.getCurrentSession().catch(() => null),
          api.get('/api/school/session-periods/current/').catch(() => null),
        ]);
        setSettings(sets || {});
        setBanks(Array.isArray(bks) ? bks : []);

        // Current session/period — resolved (and mirrored into refs) BEFORE any
        // preset-profile load below, so the "current term" auto-select works
        // whether the person arrived via search or via a ?parent_id=/?student_id= link.
        const curSess = curSessRaw?.data?.data || curSessRaw?.data || curSessRaw;
        const curPer = curPerRes?.data?.data || curPerRes?.data;
        const sessId = curSess?.id ?? null;
        const perId = curPer?.id ?? null;
        setCurrentSessionId(sessId);
        setCurrentPeriodId(perId);
        currentSessionIdRef.current = sessId;
        currentPeriodIdRef.current = perId;

        // Redirect preference (shared with the deposit page)
        const savedPref = localStorage.getItem(REDIRECT_PREF_KEY);
        if (savedPref === 'stay' || savedPref === 'list') setPostSaveAction(savedPref);

        // Period type naming — cache-first
        const cachedName = getCachedPeriodName();
        if (cachedName) {
          setPeriodTypeName(cachedName);
        } else {
          academicCalendarAPI.listPeriodTypes().then((types: any) => {
            const active = Array.isArray(types) ? types.find((t: any) => t.is_active) : null;
            const name = active?.plural_name || 'Terms';
            setPeriodTypeName(name);
            setCachedPeriodName(name);
          }).catch(() => {});
        }

        if (presetParentId) {
          const parent = await parentsAPI.get(Number(presetParentId));
          setSearchType('parent');
          await handleSelectProfile(parent, 'parent');
          // Strip ?parent_id=... from the URL so a later manual search + reload
          // doesn't keep snapping back to this parent.
          router.replace(pathname);
        } else if (presetStudentId) {
          const student = await studentsAPI.get(Number(presetStudentId));
          setSearchType('student');
          await handleSelectProfile(student, 'student');
          router.replace(pathname);
        }
      } catch (err) {
        setError('Failed to load required core data.');
      } finally {
        setPreLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetParentId, presetStudentId]);

  const handleRedirectChange = (val: 'list' | 'stay') => {
    setPostSaveAction(val);
    localStorage.setItem(REDIRECT_PREF_KEY, val);
  };

  // ─── Search Debounce ───
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      setSearchLoading(true);
      const fetcher = searchType === 'student' ? studentsAPI.list : parentsAPI.list;
      fetcher({ search: searchQuery.trim(), page_size: 8 })
        .then((res: any) => setSearchResults(res.results || res.data || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchType]);

  // ─── STEP 1: Fetch Terms with Debt ───
  const handleSelectProfile = async (p: any, type: 'student' | 'parent') => {
    setSelectedPerson(p);
    setStep('cart');
    setLoadingTerms(true);
    setTermsWithDebt([]);
    setCartGroups([]);
    setRawParentData(null);
    setActiveTerm(null);
    setError('');

    try {
      const params = type === 'parent' ? { parent_id: p.id } : { student_id: p.id };
      const res = await feeAPI.getPosTerms(params);
      const terms: TermOption[] = res?.terms || [];
      setTermsWithDebt(terms);

      if (terms.length > 0) {
        const sessId = currentSessionIdRef.current;
        const perId = currentPeriodIdRef.current;
        const currentMatch = terms.find(t =>
          sessId != null && perId != null &&
          String(t.session_id) === String(sessId) && String(t.period_id) === String(perId)
        );
        setActiveTerm(currentMatch || terms[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load debt history for this profile.');
    } finally {
      setLoadingTerms(false);
    }
  };

  // ─── STEP 2: Fetch Ledger for Active Term ───
  useEffect(() => {
    if (!activeTerm || !selectedPerson) return;

    const fetchTermLedger = async () => {
      setLoadingLedger(true);
      setCartGroups([]);
      setRawParentData(null);
      // Reset every payment input — switching terms means starting the allocation over
      setTenderedAmount('');
      setTenderedTouched(false);
      setManualOverrides({});
      setWalletContributions({});
      setOverpaymentTargetId(null);
      setSplitPercentages({});
      setAttemptedSubmit(false);

      try {
        const params: any = {
          session_id: activeTerm.session_id,
          period_id: activeTerm.period_id,
          mode: searchType
        };
        if (searchType === 'parent') params.parent_id = selectedPerson.id;
        else params.student_id = selectedPerson.id;

        const res = await feeAPI.getBillingLedger(params);
        const parentData = res.results?.[0];
        if (!parentData) throw new Error("No ledger data returned.");

        setRawParentData(parentData);

        const groups: CartGroup[] = [];

        parentData.students?.forEach((stData: any) => {
          const items: CartItem[] = [];
          if (stData.invoice) {
            stData.invoice.items?.forEach((line: any) => {
              if (Number(line.balance) > 0) {
                items.push({
                  uid: `invoice_${line.id}`, targetType: 'invoice', targetId: line.id,
                  description: line.description, balance: Number(line.balance), allocated: '', included: true, rawObj: line
                });
              }
            });
          }
          if (stData.other_payments) {
            stData.other_payments.forEach((op: any) => {
              if (Number(op.balance) > 0) {
                items.push({
                  uid: `ancillary_debt_${op.id}`, targetType: 'ancillary_debt', targetId: op.id,
                  description: `${op.description} (${op.category_display})`, balance: Number(op.balance), allocated: '', included: true, rawObj: op
                });
              }
            });
          }
          if (items.length > 0) {
            const name = toTitleCase(stData.student?.full_name || stData.__str__ || 'Student');
            groups.push({ groupId: `stu_${stData.student_id || stData.id}`, groupName: name, isFamily: false, items });
          }
        });

        if (parentData.family_invoice) {
          const items: CartItem[] = [];
          parentData.family_invoice.items?.forEach((line: any) => {
            if (Number(line.balance) > 0) {
              items.push({
                uid: `family_invoice_${line.id}`, targetType: 'family_invoice', targetId: line.id,
                description: line.description, balance: Number(line.balance), allocated: '', included: true, rawObj: line
              });
            }
          });
          if (items.length > 0) {
            groups.push({ groupId: 'family_shared', groupName: 'Family Shared Fees', isFamily: true, items });
          }
        }

        setCartGroups(groups);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load specific line items for this term.');
      } finally {
        setLoadingLedger(false);
      }
    };

    fetchTermLedger();
  }, [activeTerm, selectedPerson, searchType]);

  // ─── Wards (for wallet + overpayment UI) ───
  const wards = useMemo(() => rawParentData?.students || [], [rawParentData]);
  const eligibleWalletWards = useMemo(() => wards.filter((w: any) => Number(w.student?.fee_balance || 0) > 0), [wards]);

  // ─── Funds available ───
  const walletContributionKobo = useMemo(
    () => Object.values(walletContributions).reduce((s, v) => s + toKobo(v), 0),
    [walletContributions]
  );
  const tenderedKobo = toKobo(tenderedAmount);
  const totalAvailableKobo = tenderedKobo + walletContributionKobo;

  // ─── Sum of everything the cashier has manually typed into item boxes (clamped to each item's balance) ───
  const manualSumKobo = useMemo(() => {
    let s = 0;
    cartGroups.forEach(g => g.items.forEach(it => {
      if (it.included !== false && manualOverrides[it.uid] !== undefined) {
        s += Math.min(Math.max(0, toKobo(manualOverrides[it.uid])), toKobo(it.balance));
      }
    }));
    return s;
  }, [cartGroups, manualOverrides]);

  // ─── Derived, always-correct allocation table ───
  // Manually-pinned items keep exactly what the cashier typed (clamped to balance).
  // Everything else is auto-filled, in order, from whatever funds are left over —
  // this runs on every render, for every amount (no more "must be a big number" bug,
  // and no more "one manual edit freezes the whole cart" bug).
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

  // ─── Item-first mode: if the cashier hasn't touched "Amount Tendered" yet, keep it
  // in sync with whatever they've typed directly into item boxes. The moment they type
  // into Amount Tendered themselves, this stops (tenderedTouched flips true). ───
  useEffect(() => {
    if (tenderedTouched) return;
    setTenderedAmount(manualSumKobo > 0 ? String(fromKobo(manualSumKobo)) : '');
  }, [manualSumKobo, tenderedTouched]);

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
      if (next[studentId] !== undefined) {
        delete next[studentId];
      } else {
        next[studentId] = String(maxBalance);
      }
      return next;
    });
  };

  const handleWalletAmountChange = (studentId: number, rawValue: string, maxBalance: number) => {
    setWalletContributions(prev => {
      const clamped = rawValue === '' ? '0' : String(Math.min(Math.max(0, Number(rawValue) || 0), maxBalance));
      return { ...prev, [studentId]: clamped };
    });
  };

  // ─── Math Totals ───
  const totalAllocatedKobo = useMemo(
    () => finalGroups.reduce((s, g) => s + g.items.reduce((s2, i) => s2 + toKobo(i.allocated || 0), 0), 0),
    [finalGroups]
  );
  const overpaymentKobo = Math.max(0, totalAvailableKobo - totalAllocatedKobo);

  // ─── Selected Total — sum of balances for items still checked "in", regardless of
  // payment inputs. Lets a cashier show a parent a live, reduced total by unchecking
  // items the parent can't pay for right now, without touching a calculator. ───
  const selectedTotalKobo = useMemo(
    () => cartGroups.reduce((s, g) => s + g.items.reduce((s2, it) => it.included !== false ? s2 + toKobo(it.balance) : s2, 0), 0),
    [cartGroups]
  );
  const manualCount = Object.keys(manualOverrides).length;

  // ─── Overpayment: init split percentages when it first appears ───
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const bankRequired = externalNeeded && paymentMode !== 'cash';
  const proofRequired = externalNeeded && paymentMode !== 'cash' && !!settings?.require_proof_for_funding;
  const overpaymentNeedsTarget = overpaymentKobo > 0 && wards.length > 1 && overpaymentMode === 'select' && !overpaymentTargetId;

  const canConfirm = totalAvailableKobo > 0
    && !(bankRequired && !bankAccountId)
    && !(proofRequired && !proofFile)
    && !overpaymentNeedsTarget;

  // ─── Invoice Drawer Logic (kept for group-level "view" on the family/other groups) ───
  const openDrawerForGroup = (group: CartGroup) => {
    setShowStatementDrawer(true);
  };

  // ─── Pre-submit warnings (blocking, must be acknowledged) ───
  // 1) Cashier filled item boxes first (auto-syncing Amount Tendered), then manually
  //    overrode Amount Tendered to something higher than what they'd allocated.
  // 2) A ward's own wallet balance is enough to cover what's being charged for them,
  //    but no wallet contribution was selected and cash/transfer/POS is being used instead.
  const getPreSubmitWarnings = (): string[] => {
    const warnings: string[] = [];

    if (manualCount > 0 && tenderedTouched && tenderedKobo > manualSumKobo) {
      warnings.push(
        `Amount Tendered (${fmtMoney(fromKobo(tenderedKobo))}) is more than the ${fmtMoney(fromKobo(manualSumKobo))} you allocated to line items. The extra ${fmtMoney(fromKobo(tenderedKobo - manualSumKobo))} will be recorded as an overpayment / wallet credit. Continue?`
      );
    }

    wards.forEach((w: any) => {
      const sid = w.student.id;
      if (walletContributions[sid] !== undefined) return; // already pulling from this ward's wallet
      const balKobo = toKobo(w.student?.fee_balance || 0);
      if (balKobo <= 0) return;
      const group = finalGroups.find(g => g.groupId === `stu_${sid}`);
      const wardAllocKobo = group ? group.items.reduce((s, it) => s + toKobo(it.allocated || 0), 0) : 0;
      if (wardAllocKobo > 0 && balKobo >= wardAllocKobo && tenderedKobo > 0) {
        warnings.push(
          `${toTitleCase(w.student.full_name)} has ${fmtMoney(fromKobo(balKobo))} in their wallet — enough to cover the ${fmtMoney(fromKobo(wardAllocKobo))} currently being charged as ${paymentMode.replace('_', ' ')} for them. Consider ticking their wallet instead. Continue anyway?`
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
      if (totalAvailableKobo <= 0) setError('Enter a tendered amount or select a wallet source before confirming.');
      else if (bankRequired && !bankAccountId) setError('Please select which bank account received this payment.');
      else if (proofRequired && !proofFile) setError('Proof of payment is required for this payment method.');
      else if (overpaymentNeedsTarget) setError('Select which ward should receive the excess wallet credit.');
      return;
    }
    setIsSubmitting(true);
    setError('');

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
        if (parseFloat(amt) > 0) {
          fundingSources.push({ source_type: 'wallet', wallet_student_id: Number(sid), wallet_type: 'fee', amount: amt });
        }
      });
      if (tenderedKobo > 0) {
        fundingSources.push({ source_type: 'external', amount: fromKobo(tenderedKobo) });
      }

      const payload: any = {
        total_amount: String(fromKobo(totalAvailableKobo)),
        allocations: [...debtAllocations, ...overpayAllocPayload],
        funding_sources: fundingSources,
      };

      if (tenderedKobo > 0) {
        payload.external_payment_mode = paymentMode;
        payload.external_amount = String(fromKobo(tenderedKobo));
        if (bankAccountId) payload.bank_account_id = bankAccountId;
      }
      if (reference) payload.reference = reference;

      if (searchType === 'student') payload.student_id = selectedPerson.id;
      else payload.parent_id = selectedPerson.id;

      if (!proofFile) {
        await feeAPI.checkout(payload);
      } else {
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
          if (typeof payload[key] === 'object') formData.append(key, JSON.stringify(payload[key]));
          else formData.append(key, payload[key]);
        });
        formData.append('proof_of_payment', proofFile);
        await feeAPI.checkout(formData);
      }

      showToast('success', 'Payment processed successfully.');
      setShowPreview(false);

      if (postSaveAction === 'list') {
        router.push('/dashboard/staff/fee/payments');
      } else {
        setTenderedAmount('');
        setTenderedTouched(false);
        setManualOverrides({});
        setWalletContributions({});
        setOverpaymentTargetId(null);
        setSplitPercentages({});
        setPaymentMode('cash');
        setBankAccountId('');
        setReference('');
        setProofFile(null);
        setAttemptedSubmit(false);
        await handleSelectProfile(selectedPerson, searchType);
      }
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (preLoading) return <div className="flex items-center justify-center py-32"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;

  const activeTermLabel = activeTerm?.label || '';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 pb-28 animate-in fade-in duration-300 relative">

      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl shadow-lg">
            <Check className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-bold">{t.message}</p>
          </div>
        ))}
      </div>

      {/* ── Blocking Warning Modal (Point 2 mismatch / Point 3 wallet-sufficiency) ── */}
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

      {/* ── Consolidated Statement Drawer (single, family-wide, this term only) ── */}
      {showStatementDrawer && rawParentData && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in" onClick={() => setShowStatementDrawer(false)}>
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center"><FileText className="w-5 h-5 mr-2 text-indigo-500"/> Billing Statement</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{toTitleCase(rawParentData.parent_name || selectedPerson?.full_name || '')} — {activeTermLabel}</p>
              </div>
              <button onClick={() => setShowStatementDrawer(false)} className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50" aria-label="Close"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
              {wards.map((w: any) => {
                const st = w.student;
                const items: any[] = [];
                if (w.invoice) items.push(...(w.invoice.items || []));
                let feeTotal = 0, feeDiscount = 0, feeWaived = 0, feePaid = 0, feeBalance = 0;
                (w.invoice?.items || []).forEach((it: any) => {
                  feeTotal += parseFloat(it.amount); feeDiscount += parseFloat(it.total_discount || '0');
                  feeWaived += parseFloat(it.total_waived || '0'); feePaid += parseFloat(it.amount_paid || '0'); feeBalance += parseFloat(it.balance || '0');
                });
                const adhoc = w.other_payments || [];
                return (
                  <div key={st.id} className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-100 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700">{toTitleCase(st.full_name)}</span>
                      <span className="text-[10px] font-bold text-slate-500">{st.current_class_name} {st.current_class_section_name || ''}</span>
                    </div>
                    <div className="p-3 space-y-2">
                      {items.length === 0 && adhoc.length === 0 ? (
                        <p className="text-xs text-slate-400 italic px-1">No billed items for this term.</p>
                      ) : (
                        <>
                          {items.map((it: any) => (
                            <div key={it.id} className="flex justify-between items-start text-xs">
                              <span className="font-bold text-slate-700 pr-2">{it.description}</span>
                              <span className="font-bold text-slate-600 shrink-0">{fmtMoney(it.balance)}</span>
                            </div>
                          ))}
                          {adhoc.map((op: any) => (
                            <div key={op.id} className="flex justify-between items-start text-xs">
                              <span className="font-bold text-amber-700 pr-2">{op.description} ({op.category_display})</span>
                              <span className="font-bold text-amber-600 shrink-0">{fmtMoney(op.balance)}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {rawParentData.family_invoice && (
                <div className="border border-purple-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-purple-50 flex items-center gap-2">
                    <ShieldMinus className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs font-black text-purple-800">Family Shared Fees</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {(rawParentData.family_invoice.items || []).map((it: any) => (
                      <div key={it.id} className="flex justify-between items-start text-xs">
                        <span className="font-bold text-slate-700 pr-2">{it.description}</span>
                        <span className="font-bold text-slate-600 shrink-0">{fmtMoney(it.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl">
                <span className="text-xs font-black uppercase tracking-widest">Total Owed ({activeTermLabel})</span>
                <span className="text-lg font-black">{fmtMoney(activeTerm?.total_owed || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {showPreview && (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowPreview(false)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="font-black text-slate-800 text-lg">Preview Transaction</h3>
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
                      <td className="py-3 text-right font-medium text-slate-500">{fmtMoney(item.balance)}</td>
                      <td className="py-3 text-right font-black text-emerald-600">+{fmtMoney(Number(item.allocated))}</td>
                      <td className="py-3 text-right font-black text-indigo-600">{fmtMoney(item.balance - Number(item.allocated))}</td>
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
                          <span className="font-black text-indigo-700">{fmtMoney(Number(amt))}</span>
                        </div>
                      );
                    })}
                    {tenderedKobo > 0 && (
                      <div className="flex justify-between text-sm bg-slate-100 px-3 py-2 rounded-lg">
                        <span className="font-bold text-slate-700 capitalize">{paymentMode.replace('_', ' ')}</span>
                        <span className="font-black text-slate-700">{fmtMoney(fromKobo(tenderedKobo))}</span>
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
                        <span className="font-black text-amber-700">{fmtMoney(fromKobo(o.amountKobo))}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-600">Total Settlement</span>
                <span className="font-black text-2xl text-slate-900">{fmtMoney(fromKobo(totalAvailableKobo))}</span>
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

      {/* ── Compact Header ── */}
      <div className="max-w-6xl w-full mx-auto px-4 lg:px-8 pt-4">
        <div className="flex items-center gap-3 mb-5 bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => step === 'cart' ? setStep('search') : router.back()} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 shrink-0" aria-label="Back">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-black text-slate-900">Receive Payment</h1>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1 font-medium">{error}</p>
            <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4" /></button>
          </div>
        )}

        {step === 'search' ? (
          // ─── STEP 1: Search & Confirm ───
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex gap-2 mb-5 p-1.5 bg-slate-100 rounded-xl">
                <button onClick={() => { setSearchType('student'); setSearchResults([]); setSelectedPerson(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${searchType === 'student' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Student</button>
                <button onClick={() => { setSearchType('parent'); setSearchResults([]); setSelectedPerson(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${searchType === 'parent' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Parent (Family)</button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={`Search ${searchType}...`} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                {searchLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 my-8"/> :
                  searchResults.map(p => (
                    <div key={p.id} onClick={() => handleSelectProfile(p, searchType)} className={`p-4 rounded-xl border-2 cursor-pointer flex items-center gap-4 transition-all ${selectedPerson?.id === p.id ? 'border-indigo-500 bg-indigo-50/80 shadow-sm' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}>
                      {p.image_url ? <img src={p.image_url} alt="" className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-200" /> : <UserCircle className="w-10 h-10 text-slate-400" />}
                      <div>
                        <p className="text-sm font-bold text-slate-800">{toTitleCase(p.full_name || `${p.first_name} ${p.last_name}`)}</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">{searchType === 'student' ? p.registration_number : p.mobile}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              {selectedPerson ? (
                <div className="text-center py-10">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
                  <p className="mt-4 font-bold text-slate-500">Loading Billing History...</p>
                </div>
              ) : (
                <div className="text-center py-24 text-slate-400">
                  <UserCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="font-medium text-sm">Select a profile to begin.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // ─── STEP 2: PAYMENT WORKSPACE ───
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Left Column: Terms Navigation */}
            <div className="w-full lg:w-1/4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm self-start lg:sticky lg:top-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500"/> {periodTypeName} with Debt
              </h3>
              {loadingTerms ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 my-8"/> : termsWithDebt.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 text-center py-8">No debt found.</p>
              ) : (
                <div className="space-y-2">
                  {termsWithDebt.map((term, idx) => {
                    const isSelected = activeTerm?.session_id === term.session_id && activeTerm?.period_id === term.period_id;
                    const isCurrent = currentSessionId != null && currentPeriodId != null &&
                      String(term.session_id) === String(currentSessionId) && String(term.period_id) === String(currentPeriodId);
                    return (
                      <button key={idx} onClick={() => setActiveTerm(term)} className={`w-full text-left p-3 rounded-xl border-2 transition-all relative ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className={`text-[11px] font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{term.label}</p>
                          {isCurrent && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Current</span>}
                        </div>
                        <p className="text-[10px] font-bold text-rose-500">Owes: {fmtMoney(term.total_owed)}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="w-full lg:w-3/4 flex flex-col gap-6">

              {/* Line Items Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-sm font-black text-slate-800">Line Items Breakdown</h3>
                    <span className="text-[10px] font-bold text-slate-500 px-2.5 py-1 bg-white border border-slate-200 rounded-full">
                      Selected Total: {fmtMoney(fromKobo(selectedTotalKobo))}
                    </span>
                    {manualCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full">
                        <span className="text-[9px] font-black text-amber-700 uppercase tracking-wide">Manual: {manualCount} item{manualCount > 1 ? 's' : ''}</span>
                        <button onClick={resetToAutoFill} className="text-[9px] font-black text-indigo-600 underline">Reset to Auto-fill</button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-600 px-3 py-1 bg-indigo-100 rounded-full">{activeTerm?.label}</span>
                    {rawParentData && (
                      <button onClick={() => setShowStatementDrawer(true)} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg transition-colors" title="View full billing statement" aria-label="View full billing statement">
                        <Eye className="w-4 h-4"/>
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-5 pt-3 pb-1">
                  <p className="text-[11px] text-slate-400 font-medium">
                    Uncheck an item to leave it out of this payment, or type an amount directly into a box below — everything else fills automatically with whatever's left of the amount tendered.
                  </p>
                </div>

                <div className="overflow-x-auto min-h-[160px]">
                  {loadingLedger ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div>
                  ) : (
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200">
                          <th className="px-3 py-3 w-8 bg-slate-100"></th>
                          <th className="px-4 py-3 w-1/2 bg-slate-100">Description</th>
                          <th className="px-4 py-3 text-right bg-slate-100">Balance Due</th>
                          <th className="px-4 py-3 text-right w-40 bg-slate-100">Allocated Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {finalGroups.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-sm font-medium text-slate-400">No items in this term.</td></tr>
                        ) : (
                          finalGroups.map(group => (
                            <React.Fragment key={group.groupId}>
                              <tr className={group.isFamily ? "bg-purple-50 border-y border-purple-100" : "bg-slate-50 border-y border-slate-200"}>
                                <td colSpan={4} className={`px-4 py-2 text-xs font-black flex items-center gap-2 ${group.isFamily ? 'text-purple-900' : 'text-slate-800'}`}>
                                  {group.isFamily ? <Building2 className="w-4 h-4 text-purple-400"/> : <UserCircle className="w-4 h-4 text-slate-400"/>}
                                  {group.groupName}
                                </td>
                              </tr>

                              {group.items.map(item => {
                                const excluded = item.included === false;
                                return (
                                  <tr key={item.uid} className={`transition-colors ${excluded ? 'opacity-40' : group.isFamily ? 'hover:bg-purple-50/50' : 'hover:bg-slate-50'} ${item.targetType === 'ancillary_debt' ? 'bg-amber-50/20' : ''}`}>
                                    <td className="px-3 py-2.5">
                                      <input
                                        type="checkbox"
                                        checked={!excluded}
                                        onChange={() => toggleItemIncluded(item.uid)}
                                        aria-label={`Include ${item.description} in this payment`}
                                        className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500"
                                      />
                                    </td>
                                    <td className={`px-4 py-2.5 text-xs font-bold text-slate-700 pl-2 relative ${excluded ? 'line-through' : ''}`}>
                                      {item.targetType === 'ancillary_debt' && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] mr-2">FINE</span>}
                                      {item.description}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs font-black text-rose-600 text-right">{fmtMoney(item.balance)}</td>
                                    <td className="px-4 py-2.5 text-right">
                                      {excluded ? (
                                        <span className="text-[10px] text-slate-300 italic">excluded</span>
                                      ) : (
                                        <input
                                          type="number"
                                          value={item.allocated}
                                          onChange={e => handleManualAllocation(item.uid, e.target.value)}
                                          placeholder="0.00"
                                          aria-label={`Allocate payment to ${item.description}`}
                                          className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-right shadow-sm"
                                        />
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Multi-Wallet Funding Sources */}
              {eligibleWalletWards.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><Wallet className="w-4 h-4 text-indigo-500"/> Fund From Student Wallet</h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Optional — pull part of this payment from a ward's existing fee wallet balance.</p>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {eligibleWalletWards.map((w: any) => {
                      const sid = w.student.id;
                      const maxBal = Number(w.student.fee_balance);
                      const checked = walletContributions[sid] !== undefined;
                      return (
                        <div key={sid} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${checked ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-100'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleWalletWard(sid, maxBal)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" aria-label={`Use ${toTitleCase(w.student.full_name)}'s wallet`} />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-800">{toTitleCase(w.student.full_name)}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Available: {fmtMoney(maxBal)}</p>
                          </div>
                          {checked && (
                            <div className="relative w-32">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₦</span>
                              <input type="number" value={walletContributions[sid]} onChange={e => handleWalletAmountChange(sid, e.target.value, maxBal)}
                                className="w-full pl-5 pr-2 py-1.5 text-xs font-bold border border-indigo-200 rounded-lg text-right outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Payment Method */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-500"/> Payment Method</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Covers whatever the wallet contributions above don't.</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Method</label>
                      <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white">
                        <option value="cash">Cash</option><option value="bank_transfer">Transfer</option><option value="pos">POS Terminal</option>
                      </select>
                    </div>

                    {paymentMode !== 'cash' && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Bank Account</label>
                        <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className={`w-full px-3 py-2.5 border rounded-lg text-xs font-medium outline-none bg-white ${attemptedSubmit && bankRequired && !bankAccountId ? 'border-red-400' : 'border-slate-300'}`}>
                          <option value="">Select account...</option>
                          {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
                        </select>
                        {attemptedSubmit && bankRequired && !bankAccountId && (
                          <p className="text-[10px] text-red-500 font-bold mt-1">Please select which bank account received this payment.</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reference <span className="font-normal normal-case text-slate-300">(optional)</span></label>
                      <input type="text" placeholder="e.g. transfer ref" value={reference} onChange={e => setReference(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs outline-none" />
                    </div>
                  </div>

                  {paymentMode !== 'cash' && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Proof of Payment {proofRequired && <span className="text-red-500">*</span>}
                      </label>
                      <label className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg cursor-pointer bg-white hover:bg-slate-50 text-xs text-slate-500 font-bold transition-colors w-fit ${attemptedSubmit && proofRequired && !proofFile ? 'border-red-400' : 'border-slate-300'}`}>
                        <Upload className="w-3.5 h-3.5" />
                        <span>{proofFile ? proofFile.name : 'Upload file'}</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setProofFile(e.target.files?.[0] || null)} />
                      </label>
                      {attemptedSubmit && proofRequired && !proofFile && (
                        <p className="text-[10px] text-red-500 font-bold mt-1">Proof of payment is required for this payment method.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Overpayment Distribution */}
              {overpaymentKobo > 0 && (
                <div className="bg-amber-50 rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-amber-200 bg-amber-100/60">
                    <h3 className="text-sm font-black text-amber-900 flex items-center gap-2"><Info className="w-4 h-4"/> Overpayment Detected</h3>
                    <p className="text-xs text-amber-800 font-medium mt-0.5">
                      {fmtMoney(totalAllocatedKobo / 100)} will be applied to outstanding fees. The remaining <strong>{fmtMoney(fromKobo(overpaymentKobo))}</strong> will be saved to {wards.length === 1 ? "the student's" : "a ward's"} wallet.
                    </p>
                  </div>
                  <div className="p-5">
                    {wards.length <= 1 ? (
                      <p className="text-xs font-bold text-amber-800 flex items-center gap-2"><UserCheck className="w-4 h-4"/> Crediting {toTitleCase(wards[0]?.student.full_name || 'student')}'s wallet.</p>
                    ) : (
                      <>
                        <div className="flex gap-2 mb-4 p-1 bg-white rounded-lg border border-amber-200 w-fit">
                          <button onClick={() => setOverpaymentMode('select')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${overpaymentMode === 'select' ? 'bg-amber-600 text-white' : 'text-amber-700'}`}>Select One</button>
                          <button onClick={() => setOverpaymentMode('split')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${overpaymentMode === 'split' ? 'bg-amber-600 text-white' : 'text-amber-700'}`}>Split Between Wards</button>
                        </div>

                        {overpaymentMode === 'select' ? (
                          <div className="space-y-2">
                            {wards.map((w: any) => (
                              <label key={w.student.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${overpaymentTargetId === w.student.id ? 'border-amber-500 bg-white' : 'border-transparent bg-white/50 hover:bg-white'}`}>
                                <input type="radio" name="overpayTarget" checked={overpaymentTargetId === w.student.id} onChange={() => setOverpaymentTargetId(w.student.id)} className="w-4 h-4 text-amber-600" />
                                <span className="text-xs font-bold text-slate-800">{toTitleCase(w.student.full_name)}</span>
                              </label>
                            ))}
                            {attemptedSubmit && overpaymentNeedsTarget && (
                              <p className="text-[10px] text-red-600 font-bold">Select which ward should receive the excess.</p>
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
                                  {fmtMoney(fromKobo(Math.round(overpaymentKobo * (splitPercentages[w.student.id] ?? 0) / 100)))}
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
          </div>
        )}
      </div>

      {/* ─── FIXED BOTTOM ACTION BAR — only the amount driver + submit-related actions ─── */}
      {step === 'cart' && (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 px-4 py-3 md:px-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 justify-between">

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount Tendered</label>
                <div className="relative w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₦</span>
                  <input type="number" value={tenderedAmount} onChange={e => handleTenderedChange(e.target.value)} placeholder="0.00"
                    className="w-full pl-7 pr-2 py-2 bg-slate-50 border-2 border-indigo-400 rounded-lg text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all" />
                </div>
              </div>

              <button onClick={handlePreviewClick} disabled={totalAllocatedKobo <= 0 && overpaymentKobo <= 0} className="self-end flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors">
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>

              <div className="self-end flex items-center gap-3 text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="redirect" checked={postSaveAction === 'list'} onChange={() => handleRedirectChange('list')} className="w-3.5 h-3.5 text-indigo-600" />
                  Go to Receipts
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="redirect" checked={postSaveAction === 'stay'} onChange={() => handleRedirectChange('stay')} className="w-3.5 h-3.5 text-indigo-600" />
                  Stay &amp; Reset
                </label>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Settle</p>
                <p className="text-lg font-black text-indigo-600">{fmtMoney(fromKobo(totalAvailableKobo))}</p>
              </div>
              <button onClick={handleConfirmClick} disabled={!canConfirm || isSubmitting} title={!canConfirm ? 'Complete the required payment fields above' : undefined} className="px-7 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Check className="w-4 h-4"/> Confirm</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}