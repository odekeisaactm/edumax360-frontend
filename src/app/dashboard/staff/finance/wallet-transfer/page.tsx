'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  studentsAPI,
  financeSettingsAPI,
  walletTransferAPI,
  auditLedgersAPI,
} from '@/lib/api';
import {
  Users, Search, ArrowLeft, X, Loader2, UserCircle, Sparkles,
  AlertCircle, Check, Wallet, CreditCard, ArrowRightLeft,
  DollarSign, Zap, ShieldAlert, FileText, ArrowUpRight, Plus,
  Printer, ShieldCheck, Eye,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.details && typeof d.details === 'object') {
      const msgs = Object.entries(d.details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? (v as any[])[0] : String(v)}`)
        .join(' ');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: number | string): string {
  return '₦' + Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Consistently unwrap API responses. Some endpoints (e.g. studentsAPI.get) nest
// the payload two levels deep (axios response.data -> DRF wrapper.data -> record),
// while list/search results are sometimes only nested once. Applying this twice
// is a safe no-op if the object is already unwrapped.
function unwrapRecord(obj: any): any {
  const first = obj?.data ?? obj;
  return first?.data ?? first;
}

const QUICK_REASONS = [
  'Reallocating tuition fee excess to canteen lunch wallet.',
  'Clearing cafeteria lunch deficit from tuition fee wallet.',
  'Sibling peer-to-peer balance reallocation for cafeteria allowance.',
  'Internal wallet balance adjustment by cashier desk.',
];

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({
  person,
  selected,
  onClick,
}: {
  person: any;
  selected: boolean;
  onClick: () => void;
}) {
  const unwrapped = person?.data ?? person;
  const fullName = toTitleCase(unwrapped.full_name || `${unwrapped.first_name || ''} ${unwrapped.last_name || ''}`.trim());
  const idLabel = unwrapped.registration_number;
  const classLabel = [unwrapped.current_class_name, unwrapped.current_class_section_name].filter(Boolean).join(' · ');
  const genderLabel = unwrapped.gender ? toTitleCase(unwrapped.gender) : null;
  const statusLabel = unwrapped.status ? toTitleCase(unwrapped.status) : '';

  const feeBal = Number(unwrapped?.fee_balance ?? unwrapped?.fee_wallet ?? 0);
  const canteenBal = Number(unwrapped?.canteen_balance ?? unwrapped?.canteen_wallet ?? 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 text-left transition-all duration-200 ${
        selected
          ? 'border-emerald-500 bg-emerald-50/80 shadow-sm shadow-emerald-100'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/80 hover:shadow-sm'
      }`}
    >
      <div className="flex-shrink-0">
        {unwrapped.image_url ? (
          <img src={unwrapped.image_url} alt={fullName} className="w-10 h-10 rounded-xl object-cover border border-slate-100" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
            <UserCircle className="h-6 w-6 text-emerald-500" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${selected ? 'text-emerald-900' : 'text-slate-800'}`}>
          {fullName}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {idLabel && <span className="text-[11px] font-mono text-slate-400">{idLabel}</span>}
          {classLabel && <span className="text-[11px] text-slate-400 truncate">· {classLabel}</span>}
          {genderLabel && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              unwrapped.gender === 'male' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-pink-50 text-pink-700 border-pink-100'
            }`}>
              {genderLabel}
            </span>
          )}
          {statusLabel && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              statusLabel === 'active' || statusLabel === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="text-xs font-semibold text-slate-600">
          Fee: <span className="font-mono">{fmtMoney(feeBal)}</span>
        </div>
        <div className={`text-xs font-semibold mt-0.5 ${canteenBal < 0 ? 'text-red-600' : 'text-slate-600'}`}>
          Canteen: <span className="font-mono">{fmtMoney(canteenBal)}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Quick Amount ─────────────────────────────────────────────────────────────
function QuickAmount({ amount, onClick }: { amount: number; onClick: (val: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(amount)}
      className="px-3 py-1.5 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-200 hover:border-slate-300 transition-colors"
    >
      ₦{amount.toLocaleString()}
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function WalletTransferPOSPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const presetId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
  const canTransfer = user?.is_superuser || hasPermission('finance.add_wallettransfermodel');

  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Workspace Tabs: 'transfer' | 'ledger'
  const [activeTab, setActiveTab] = useState<'transfer' | 'ledger'>('transfer');
  const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedLedgerItem, setSelectedLedgerItem] = useState<any | null>(null);

  // Sibling Discovery State
  const [siblings, setSiblings] = useState<any[]>([]);
  const [loadingSiblings, setLoadingSiblings] = useState(false);

  // Transfer Form State
  const [transferType, setTransferType] = useState<'cross_wallet' | 'sibling_transfer'>('cross_wallet');
  const [sourceWalletType, setSourceWalletType] = useState<'canteen' | 'fee'>('fee');
  const [destWalletType, setDestWalletType] = useState<'canteen' | 'fee'>('canteen');
  const [destinationStudentId, setDestinationStudentId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debt recovery mode: when set, the sibling with this ID is the funding SOURCE
  // and `selectedPerson` (the debtor) is the destination. This is the reverse of
  // the normal sibling_transfer flow, so it's tracked explicitly rather than
  // inferred, to avoid ambiguity in handleSubmit.
  const [debtRecoverySiblingId, setDebtRecoverySiblingId] = useState<number | null>(null);

  // Persistent LocalStorage memory
  const [postSaveAction, setPostSaveAction] = useState<'stay' | 'list' | 'draw_out'>('list');

  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [studentWallet, setStudentWallet] = useState<{ canteen: number; fee: number } | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    const savedPref = localStorage.getItem('pos_redirect_pref') as 'stay' | 'list' | 'draw_out';
    if (savedPref && ['stay', 'list', 'draw_out'].includes(savedPref)) {
      setPostSaveAction(savedPref);
    }
  }, []);

  const handleRedirectChange = (val: 'stay' | 'list' | 'draw_out') => {
    setPostSaveAction(val);
    localStorage.setItem('pos_redirect_pref', val);
  };

  useEffect(() => {
    financeSettingsAPI.get()
      .then(data => setSettings(data || {}))
      .catch(() => setSettings({}))
      .finally(() => setLoadingSettings(false));
  }, []);

  // Pre-load student if presetId is provided in URL
  useEffect(() => {
    if (!presetId) return;
    studentsAPI.get(presetId)
     .then(res => {
     const studentObj = (res as any)?.data ?? res;
        handleSelectPerson(studentObj);
      })
      .catch(() => setError('Could not load the student. Please search manually.'));
  }, [presetId]);

  // Fetch siblings helper
  const fetchSiblings = async (person: any) => {
    const parentId = person?.parent ?? person?.parent_id;
    if (!parentId) {
      setSiblings([]);
      return;
    }
    setLoadingSiblings(true);
    try {
      const data: any = await studentsAPI.list({ parent: typeof parentId === 'object' ? parentId.id : parentId, page_size: 20 });
      const rawList = data?.results?.data ?? data?.results ?? data?.data ?? data ?? [];
      const sibs = Array.isArray(rawList) ? rawList.filter((s: any) => s.id !== person.id) : [];
      setSiblings(sibs);
      if (sibs.length > 0) {
        setDestinationStudentId(sibs[0].id);
      }
    } catch {
      setSiblings([]);
    } finally {
      setLoadingSiblings(false);
    }
  };

  // Fetch full 360° student wallet ledger strictly filtered by student ID.
  // Returns the resolved list so callers (like the post-transfer refresh) can
  // derive up-to-the-second wallet balances from it, since the ledger is
  // written synchronously with the transaction and is more reliable than a
  // fresh GET on the student record immediately after a mutation.
  const fetchStudentLedger = async (studentId: number): Promise<any[]> => {
    setLoadingHistory(true);
    try {
      const data: any = await auditLedgersAPI.getStudentWalletLedger({
        student_id: studentId,
        page_size: 30,
      });
      const rawList = data?.results?.data ?? data?.results ?? data?.data ?? data ?? [];
      const list = Array.isArray(rawList) ? rawList : [];

      // Frontend safety filter to guarantee no other student records leak through
      const strictlyFiltered = list.filter((item: any) => {
        const sid = item.student_id ?? item.student ?? item.wallet_student_id ?? item.wallet_detail?.student_id;
        if (sid !== undefined && sid !== null) {
          return Number(sid) === studentId;
        }
        return true;
      });

      setLedgerHistory(strictlyFiltered);
      return strictlyFiltered;
    } catch {
      setLedgerHistory([]);
      return [];
    } finally {
      setLoadingHistory(false);
    }
  };



  // Search debounce
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounce.current = setTimeout(() => {
      setSearchLoading(true);
      studentsAPI.list({ search: searchQuery.trim(), page_size: 10 })
        .then((data: any) => {
          const results = data?.results?.data ?? data?.results ?? data?.data ?? data ?? [];
          setSearchResults(Array.isArray(results) ? results : []);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery]);

  const handleSelectPerson = (person: any) => {
    const unwrapped = person?.data ?? person;
    setSelectedPerson(unwrapped);
    setSearchResults([]);
    setSearchQuery('');
    setError(null);
    setAmount('');
    setReason('');
    setTransferType('cross_wallet');
    setSourceWalletType('fee');
    setDestWalletType('canteen');
    setDebtRecoverySiblingId(null);
    setActiveTab('transfer');

    const canteen = Number(unwrapped?.canteen_balance ?? unwrapped?.canteen_wallet ?? 0);
    const fee = Number(unwrapped?.fee_balance ?? unwrapped?.fee_wallet ?? 0);
    setStudentWallet({ canteen, fee });

    fetchSiblings(unwrapped);
    fetchStudentLedger(unwrapped.id);
  };

  const clearSelection = () => {
    setSelectedPerson(null);
    setStudentWallet(null);
    setSiblings([]);
    setSelectedLedgerItem(null);
    setDebtRecoverySiblingId(null);
    setError(null);
  };

  const handleAmountQuick = (val: number) => setAmount(val);

  const activeSourceBalance = sourceWalletType === 'fee' ? (studentWallet?.fee ?? 0) : (studentWallet?.canteen ?? 0);

  // While in debt-recovery mode, the funds are actually being drawn from the
  // sibling's wallet, not the selected (debtor) student's wallet. Resolve the
  // sibling record and use its balance for both display and validation.
  const debtRecoverySibling = debtRecoverySiblingId
    ? siblings.find(s => s.id === debtRecoverySiblingId) ?? null
    : null;

  const effectiveSourceBalance = debtRecoverySibling
    ? Number(sourceWalletType === 'fee'
        ? (debtRecoverySibling.fee_balance ?? debtRecoverySibling.fee_wallet ?? 0)
        : (debtRecoverySibling.canteen_balance ?? debtRecoverySibling.canteen_wallet ?? 0))
    : activeSourceBalance;

  // 1-Click Smart Debt Intercept
  const handleInterceptDebt = (sibling: any, debtAmount: number) => {
    setActiveTab('transfer');
    setTransferType('sibling_transfer');
    setDebtRecoverySiblingId(sibling.id);
    setDestinationStudentId(selectedPerson.id);
    setSourceWalletType('canteen');
    setDestWalletType('canteen');
    setAmount(debtAmount);
    setReason(`Automated debt clearance for ${toTitleCase(selectedPerson.full_name)} from sibling ${toTitleCase(sibling.full_name)}.`);
  };

  const cancelDebtRecovery = () => {
    setDebtRecoverySiblingId(null);
    setDestinationStudentId(siblings.length > 0 ? siblings[0].id : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Amount is required and must be greater than ₦0.00.');
      return;
    }

    if (numAmount > effectiveSourceBalance) {
      setError(
        debtRecoverySibling
          ? `Insufficient liquidity in ${toTitleCase(debtRecoverySibling.full_name)}'s wallet. Available: ${fmtMoney(effectiveSourceBalance)}`
          : `Insufficient liquidity in source wallet. Available: ${fmtMoney(effectiveSourceBalance)}`
      );
      return;
    }

    if (!reason.trim()) {
      setError('An audit narration / reason is strictly required for ledger reconciliation.');
      return;
    }

    if (transferType === 'cross_wallet' && sourceWalletType === destWalletType) {
      setError('Source and destination wallets must be different for internal cross-wallet transfers.');
      return;
    }

    if (transferType === 'sibling_transfer' && !debtRecoverySiblingId && !destinationStudentId) {
      setError('Please select a verified sibling destination.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        transfer_type: transferType,
        source_wallet_type: sourceWalletType,
        destination_wallet_type: destWalletType,
        amount: numAmount,
        reason: reason.trim(),
      };

      if (transferType === 'cross_wallet') {
        // Internal move within the same student's two wallets.
        payload.source_student = selectedPerson.id;
        payload.destination_student = selectedPerson.id;
      } else if (debtRecoverySiblingId) {
        // Debt recovery: funds flow FROM the sibling TO the debtor (selectedPerson).
        payload.source_student = debtRecoverySiblingId;
        payload.destination_student = selectedPerson.id;
      } else {
        // Normal sibling transfer: funds flow FROM the selected student TO the chosen sibling.
        payload.source_student = selectedPerson.id;
        payload.destination_student = destinationStudentId;
      }

      const response = await walletTransferAPI.create(payload);
      const transferId = response?.id;

      showToast('success', `Transfer of ${fmtMoney(numAmount)} executed successfully`);

      if (postSaveAction === 'list') {
        router.push('/dashboard/staff/finance/wallet-transfers');
        return;
      }

      if (postSaveAction === 'draw_out' && transferId) {
        router.push(`/dashboard/staff/finance/wallet-transfers?open_audit=${transferId}`);
        return;
      }

      // ── OPTIMISTIC LOCAL BALANCE UPDATE ──
      // The transfer already succeeded server-side (we got here past the
      // await above), but an immediate follow-up GET — on the student record
      // OR the ledger — can return momentarily stale numbers due to
      // caching/replica lag on the backend. Rather than trust a refetch that
      // may lose that race, compute the resulting balances ourselves from
      // what we already know plus the amount that was just moved. This is
      // deterministic and can't be stale.
      setAmount('');
      setReason('');

      const nextSelectedWallet: { canteen: number; fee: number } = {
        canteen: studentWallet?.canteen ?? 0,
        fee: studentWallet?.fee ?? 0,
      };
      let nextSiblings = siblings.map(s => ({ ...s }));

      const bumpSibling = (siblingId: number, walletType: 'fee' | 'canteen', delta: number) => {
        nextSiblings = nextSiblings.map(s => {
          if (s.id !== siblingId) return s;
          if (walletType === 'fee') {
            const key = s.fee_balance !== undefined ? 'fee_balance' : 'fee_wallet';
            return { ...s, [key]: Number(s[key] || 0) + delta };
          }
          const key = s.canteen_balance !== undefined ? 'canteen_balance' : 'canteen_wallet';
          return { ...s, [key]: Number(s[key] || 0) + delta };
        });
      };

      if (transferType === 'cross_wallet') {
        nextSelectedWallet[sourceWalletType] -= numAmount;
        nextSelectedWallet[destWalletType] += numAmount;
      } else if (debtRecoverySiblingId) {
        bumpSibling(debtRecoverySiblingId, sourceWalletType, -numAmount);
        nextSelectedWallet[destWalletType] += numAmount;
      } else if (destinationStudentId) {
        nextSelectedWallet[sourceWalletType] -= numAmount;
        bumpSibling(destinationStudentId as number, destWalletType, numAmount);
      }

      setStudentWallet(nextSelectedWallet);
      setSiblings(nextSiblings);
      setDebtRecoverySiblingId(null);

      // Best-effort background refresh for non-wallet profile details (name,
      // photo, class) and the ledger tab's history list. This intentionally
      // does NOT overwrite the wallet numbers set above, since the server
      // read here can still lag behind the write that just happened.
      try {
        const freshRes = await studentsAPI.get(selectedPerson.id);
        // Same double-unwrap as handleSelectPerson / the presetId loader use,
        // since studentsAPI.get nests the record two levels deep.
        const freshStudent = unwrapRecord(freshRes);
        setSelectedPerson({
          ...freshStudent,
          canteen_balance: nextSelectedWallet.canteen,
          fee_balance: nextSelectedWallet.fee,
        });
        await fetchStudentLedger(freshStudent.id);
      } catch (err) {
        console.error('Failed to refresh profile details post-transfer:', err);
      }

      setError(null);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canTransfer) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to execute wallet transfers.</p>
        </div>
      </div>
    );
  }

  if (loadingSettings) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
        <p className="mt-2 text-sm text-slate-400">Loading transfer environment...</p>
      </div>
    );
  }

  const canteenDebt = (studentWallet?.canteen ?? 0) < 0 ? Math.abs(studentWallet?.canteen ?? 0) : 0;
  const solventSibling = siblings.find(s => {
    const sibCanteen = Number(s?.canteen_balance ?? s?.canteen_wallet ?? 0);
    return sibCanteen >= canteenDebt && canteenDebt > 0;
  });

  return (
    <div className="pb-28 max-w-7xl mx-auto relative">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/dashboard/staff/finance/wallet-transfers')} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <ArrowRightLeft className="h-5 w-5 text-white" />
            </div>
            Execute Wallet Transfer
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Reallocate internal funds between Fee and Canteen wallets or perform sibling balance shifts</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium flex-1">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Policy Rules Banner */}
      {settings && (
        <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Active Transfer Policies:</span>
          <span className={`flex items-center gap-1 px-2 py-1 rounded border font-medium ${settings.allow_inter_field_transfer !== false ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            Cross-Wallet: {settings.allow_inter_field_transfer !== false ? 'Enabled' : 'Disabled'}
          </span>
          <span className={`flex items-center gap-1 px-2 py-1 rounded border font-medium ${settings.allow_sibling_transfer !== false ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            Sibling Transfers: {settings.allow_sibling_transfer !== false ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      )}

      {!selectedPerson ? (
        // Search Arena
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search student by name, admission ID, or class..."
              className="w-full pl-11 pr-10 py-3.5 text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white shadow-xs"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {searchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                <span className="ml-2 text-sm text-slate-400">Searching enrolled students...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((person) => (
                <ResultCard
                  key={person.id}
                  person={person}
                  selected={false}
                  onClick={() => handleSelectPerson(person)}
                />
              ))
            ) : searchQuery.trim().length >= 2 ? (
              <div className="text-center py-10">
                <UserCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No students found</p>
                <p className="text-xs text-slate-400">Try verifying the spelling or admission ID</p>
              </div>
            ) : (
              <div className="text-center py-10">
                <Search className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Type at least 2 characters to search</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Selected Student + Dual-Tab Workspace
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Profile Summary & Sibling Discovery */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden sticky top-4">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {selectedPerson.image_url ? (
                      <img src={selectedPerson.image_url} alt="Profile" className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                        <UserCircle className="h-8 w-8 text-emerald-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-lg leading-tight">
                      {toTitleCase(selectedPerson.full_name || `${selectedPerson.first_name || ''} ${selectedPerson.last_name || ''}`.trim())}
                    </p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      {selectedPerson.registration_number}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-600">
                        {[selectedPerson.current_class_name, selectedPerson.current_class_section_name].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Wallet Balances */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className={`border rounded-xl p-3 text-center ${studentWallet?.canteen && studentWallet.canteen < 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${studentWallet?.canteen && studentWallet.canteen < 0 ? 'text-red-700' : 'text-blue-600'}`}>Canteen</p>
                    <p className={`text-lg font-bold ${studentWallet?.canteen && studentWallet.canteen < 0 ? 'text-red-900' : 'text-blue-800'}`}>
                      {studentWallet ? fmtMoney(studentWallet.canteen) : '—'}
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide">Fee</p>
                    <p className="text-lg font-bold text-purple-800">
                      {studentWallet ? fmtMoney(studentWallet.fee) : '—'}
                    </p>
                  </div>
                </div>

                {/* Fund Wallet Preselect & Change Selection Actions */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/staff/finance/deposit?type=student&id=${selectedPerson.id}`)}
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Fund Wallet ➔
                  </button>
                  <button
                    onClick={clearSelection}
                    className="flex-1 py-2 px-3 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Change Selection
                  </button>
                </div>

                {/* Sibling Network with Swap Action */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Verified Siblings</p>
                    {loadingSiblings && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                  </div>
                  {siblings.length > 0 ? (
                    <div className="space-y-2">
                      {siblings.map(sib => {
                        const sibFullName = toTitleCase(sib.full_name || `${sib.first_name || ''} ${sib.last_name || ''}`.trim());
                        const sibClass = [sib.current_class_name, sib.current_class_section_name].filter(Boolean).join(' · ');
                        const sibCanteen = Number(sib?.canteen_balance ?? sib?.canteen_wallet ?? 0);
                        const sibFee = Number(sib?.fee_balance ?? sib?.fee_wallet ?? 0);
                        return (
                          <div key={sib.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-slate-800">{sibFullName}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{sib.registration_number} {sibClass ? `· ${sibClass}` : ''}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSelectPerson(sib)}
                                className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1"
                                title="Swap this sibling into the primary workspace"
                              >
                                Make Main <ArrowUpRight className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="flex justify-between border-t border-slate-100 pt-1 text-[11px] font-mono">
                              <span className="text-blue-700">Can: {fmtMoney(sibCanteen)}</span>
                              <span className="text-purple-700">Fee: {fmtMoney(sibFee)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No enrolled siblings share this parent ID.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Workspace: Tabs + Form or Full Ledger */}
          <div className="lg:col-span-3 space-y-4">
            {solventSibling && canteenDebt > 0 && (
              <div className="p-4 bg-gradient-to-r from-red-600 to-amber-600 rounded-2xl text-white shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Zap className="h-6 w-6 text-amber-300 flex-shrink-0 fill-amber-300" />
                  <div>
                    <h4 className="font-bold text-sm">Cafeteria Deficit Detected: {fmtMoney(canteenDebt)}</h4>
                    <p className="text-xs text-red-100 mt-0.5">
                      Sibling {toTitleCase(solventSibling.full_name)} has sufficient funds ({fmtMoney(Number(solventSibling?.canteen_balance ?? solventSibling?.canteen_wallet ?? 0))}).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleInterceptDebt(solventSibling, canteenDebt)}
                  className="px-3.5 py-2 bg-white text-red-700 font-bold text-xs rounded-xl hover:bg-red-50 transition-colors flex-shrink-0 shadow-xs"
                >
                  ⚡ Recover Now
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('transfer')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'transfer'
                        ? 'bg-white text-emerald-800 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    ⚡ Configure Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ledger')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'ledger'
                        ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Full Wallet Ledger ({ledgerHistory.length})
                  </button>
                </div>
              </div>

              {activeTab === 'transfer' ? (
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  {debtRecoverySibling && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                        <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500 flex-shrink-0" />
                        <span>
                          Debt Recovery: pulling from <span className="font-bold">{toTitleCase(debtRecoverySibling.full_name)}</span>'s{' '}
                          {sourceWalletType === 'fee' ? 'Fee' : 'Canteen'} Wallet into <span className="font-bold">{toTitleCase(selectedPerson.full_name)}</span>'s{' '}
                          {destWalletType === 'fee' ? 'Fee' : 'Canteen'} Wallet.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={cancelDebtRecovery}
                        className="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex-shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Transfer Category <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTransferType('cross_wallet');
                          setSourceWalletType('fee');
                          setDestWalletType('canteen');
                          setDebtRecoverySiblingId(null);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                          transferType === 'cross_wallet'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        Cross-Wallet
                      </button>
                      <button
                        type="button"
                        disabled={siblings.length === 0}
                        onClick={() => {
                          setTransferType('sibling_transfer');
                          setDebtRecoverySiblingId(null);
                          if (siblings.length > 0) setDestinationStudentId(siblings[0].id);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                          transferType === 'sibling_transfer'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : siblings.length === 0
                            ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Users className="h-4 w-4" />
                        Sibling Transfer {siblings.length === 0 && '(0)'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Source Wallet (Deduct From) <span className="text-red-500">*</span>
                        {debtRecoverySibling && (
                          <span className="ml-1.5 normal-case font-normal text-amber-600">— {toTitleCase(debtRecoverySibling.full_name)}</span>
                        )}
                      </label>
                      <select
                        value={sourceWalletType}
                        onChange={e => {
                          const val = e.target.value as 'fee' | 'canteen';
                          setSourceWalletType(val);
                          if (transferType === 'cross_wallet') {
                            setDestWalletType(val === 'fee' ? 'canteen' : 'fee');
                          }
                        }}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                      >
                        <option value="fee">
                          Tuition Fee Wallet ({fmtMoney(debtRecoverySibling
                            ? (debtRecoverySibling.fee_balance ?? debtRecoverySibling.fee_wallet ?? 0)
                            : (studentWallet?.fee ?? 0))})
                        </option>
                        <option value="canteen">
                          Canteen Wallet ({fmtMoney(debtRecoverySibling
                            ? (debtRecoverySibling.canteen_balance ?? debtRecoverySibling.canteen_wallet ?? 0)
                            : (studentWallet?.canteen ?? 0))})
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Destination (Credit To) <span className="text-red-500">*</span>
                      </label>
                      {transferType === 'cross_wallet' ? (
                        <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 flex items-center justify-between">
                          <span>{destWalletType === 'fee' ? 'Tuition Fee Wallet' : 'Canteen Wallet'}</span>
                          <span className="text-xs text-slate-400 font-normal">Auto-paired</span>
                        </div>
                      ) : debtRecoverySibling ? (
                        <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-semibold text-amber-800 flex items-center justify-between">
                          <span>{toTitleCase(selectedPerson.full_name)} (Debtor)</span>
                          <span className="text-[10px] font-bold uppercase text-amber-500">Locked</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <select
                            value={destinationStudentId}
                            onChange={e => setDestinationStudentId(Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                          >
                            {siblings.map(sib => (
                              <option key={sib.id} value={sib.id}>
                                {toTitleCase(sib.full_name)} ({sib.registration_number})
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDestWalletType('fee')}
                              className={`py-1.5 px-2 text-xs font-bold rounded-lg border ${destWalletType === 'fee' ? 'bg-purple-50 border-purple-400 text-purple-700' : 'bg-white border-slate-200 text-slate-600'}`}
                            >
                              Fee Wallet
                            </button>
                            <button
                              type="button"
                              onClick={() => setDestWalletType('canteen')}
                              className={`py-1.5 px-2 text-xs font-bold rounded-lg border ${destWalletType === 'canteen' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
                            >
                              Canteen Wallet
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Amount (₦) <span className="text-red-500">*</span>
                      </label>
                      <span className="text-xs text-slate-400 font-mono">
                        Max Available: {fmtMoney(effectiveSourceBalance)}
                      </span>
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={effectiveSourceBalance > 0 ? effectiveSourceBalance : undefined}
                        value={amount}
                        onChange={e => setAmount(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-slate-900"
                        placeholder="Enter transfer amount"
                        required
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[500, 1000, 2000, 5000, 10000].map(val => (
                        <QuickAmount key={val} amount={val} onClick={handleAmountQuick} />
                      ))}
                      {effectiveSourceBalance > 0 && (
                        <button
                          type="button"
                          onClick={() => setAmount(effectiveSourceBalance)}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-800 hover:bg-emerald-200 ml-auto transition-colors"
                        >
                          Transfer Max
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Audit Narration / Reason <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] font-semibold text-emerald-600">Quick Select below 👇</span>
                    </div>
                    <textarea
                      rows={2}
                      required
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. Reallocating tuition excess into canteen wallet for weekly lunch..."
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {QUICK_REASONS.map((qReason, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setReason(qReason)}
                          className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-slate-200 rounded-lg text-slate-600 transition-colors text-left"
                        >
                          + {qReason}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">After Save</label>
                      <select
                        value={postSaveAction}
                        onChange={e => handleRedirectChange(e.target.value as any)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-700"
                      >
                        <option value="list">📋 Go to Master Transfers List</option>
                        <option value="stay">🔄 Stay (Clear & Reset)</option>
                        <option value="draw_out">👁️ Go to Index & View Receipt</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !amount || Number(amount) <= 0 || Number(amount) > effectiveSourceBalance}
                      className="flex-1 sm:flex-none px-6 py-2.5 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200"
                    >
                      {isSubmitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Committing...</>
                      ) : (
                        <><ArrowRightLeft className="h-4 w-4" /> Execute Reallocation</>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                // ── Full Wallet Ledger Audit Trail Tab ──
                <div className="p-6">
                  {loadingHistory ? (
                    <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
                  ) : ledgerHistory.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">No ledger movements recorded for this student yet.</div>
                  ) : (
                    <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                      {ledgerHistory.map((item: any) => {
                        const isCredit = item.transaction_type === 'funding' || item.transaction_type === 'transfer_in' || item.direction === 'credit';
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedLedgerItem(item)}
                            className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-emerald-50/40 hover:border-emerald-200 transition-all cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-800">{item.reference || `#${item.id}`}</span>
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                  {item.wallet_field || 'Wallet'}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-800 mt-1">{toTitleCase(item.transaction_type_display || item.transaction_type)}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-sm">{item.reason || 'No narration provided'}</p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <span className={`font-mono font-bold text-sm ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                                {isCredit ? '+' : '-'}{fmtMoney(Number(item.amount || 0))}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">Bal: {fmtMoney(Number(item.balance_after || 0))}</span>
                              <span className="text-[10px] text-emerald-600 font-bold inline-flex items-center gap-0.5 mt-0.5">
                                <Eye className="h-3 w-3" /> Slip
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Slide-Out Receipt Drawer for Full Ledger Tab */}
      {selectedLedgerItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-100 animate-slide-left">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Ledger Transaction Slip
              </div>
              <button onClick={() => setSelectedLedgerItem(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div id="thermal-receipt" className="p-8 flex-1 overflow-y-auto space-y-6 font-mono text-xs text-slate-700">
              <div className="text-center border-b border-dashed border-slate-300 pb-4">
                <h3 className="font-sans font-black text-base text-slate-900 uppercase">School Finance Command</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Wallet Ledger Audit Voucher</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between"><span>Reference:</span> <span className="font-bold text-slate-900">{selectedLedgerItem.reference || `#${selectedLedgerItem.id}`}</span></div>
                <div className="flex justify-between"><span>Timestamp:</span> <span>{new Date(selectedLedgerItem.created_at).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Category:</span> <span className="font-bold uppercase">{toTitleCase(selectedLedgerItem.transaction_type_display || selectedLedgerItem.transaction_type)}</span></div>
                <div className="flex justify-between"><span>Target Wallet:</span> <span className="font-bold uppercase text-blue-700">{selectedLedgerItem.wallet_field} Wallet</span></div>
              </div>

              <div className="border-y border-dashed border-slate-300 py-4 flex justify-between items-center font-sans font-black text-lg text-slate-900">
                <span>Amount:</span>
                <span className="font-mono text-emerald-600">{fmtMoney(selectedLedgerItem.amount)}</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 font-mono">
                <div className="flex justify-between text-slate-500"><span>Balance Before:</span> <span>{fmtMoney(selectedLedgerItem.balance_before)}</span></div>
                <div className="flex justify-between font-bold text-slate-900"><span>Balance After:</span> <span>{fmtMoney(selectedLedgerItem.balance_after)}</span></div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Audit Narration</span>
                <p className="p-3 bg-slate-50 rounded-lg text-slate-600 font-sans">{selectedLedgerItem.reason || 'No narration provided.'}</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" /> Print Receipt (Ctrl+P)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}