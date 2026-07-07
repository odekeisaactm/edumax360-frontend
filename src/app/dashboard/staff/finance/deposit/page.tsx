'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  studentsAPI,
  staffAPI,
  financeSettingsAPI,
  studentFundingAPI,
  staffFundingAPI,
  bankDetailsAPI,
  gatewayAPI,
  onlinePaymentAPI,
} from '@/lib/api';
import {
  Users, Search, ArrowLeft, X, Loader2, UserCircle, Sparkles,
  AlertCircle, Check, Wallet, CreditCard, Banknote, ChevronDown,
  Eye, List, RefreshCw, Plus, DollarSign, Upload, Globe, ShieldCheck,
} from 'lucide-react';

// Declare global gateway window objects for TypeScript
declare global {
  interface Window {
    PaystackPop?: any;
    FlutterwaveCheckout?: any;
  }
}

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

function fmtMoney(amount: number): string {
  return '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

// ─── Full-Screen Verification Overlay ──────────────────────────────────────────
function VerificationOverlay({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1.5">Verifying Payment...</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Connecting to payment gateway and reconciling the school ledger. Please do not refresh or close this window.
        </p>
      </div>
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({
  person,
  type,
  selected,
  onClick,
}: {
  person: any;
  type: 'student' | 'staff';
  selected: boolean;
  onClick: () => void;
}) {
  const isStudent = type === 'student';
  const fullName = toTitleCase(person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim());
  const idLabel = isStudent ? person.registration_number : person.staff_id;
  const classLabel = isStudent
    ? [person.current_class_name, person.current_class_section_name].filter(Boolean).join(' · ')
    : [person.department_name, person.position_name].filter(Boolean).join(' · ');
  const genderLabel = person.gender ? toTitleCase(person.gender) : null;
  const statusLabel = person.status ? toTitleCase(person.status) : '';

  const balanceDisplay = person.wallet_balance !== undefined ? fmtMoney(person.wallet_balance) : '—';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 text-left transition-all duration-200 ${
        selected
          ? 'border-blue-500 bg-blue-50/80 shadow-sm shadow-blue-100'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/80 hover:shadow-sm'
      }`}
    >
      <div className="flex-shrink-0">
        {person.image_url ? (
          <img src={person.image_url} alt={fullName} className="w-10 h-10 rounded-xl object-cover border border-slate-100" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <UserCircle className="h-6 w-6 text-blue-400" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${selected ? 'text-blue-900' : 'text-slate-800'}`}>
          {fullName}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {idLabel && <span className="text-[11px] font-mono text-slate-400">{idLabel}</span>}
          {classLabel && <span className="text-[11px] text-slate-400 truncate">· {classLabel}</span>}
          {genderLabel && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              person.gender === 'male' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-pink-50 text-pink-700 border-pink-100'
            }`}>
              {genderLabel}
            </span>
          )}
          {statusLabel && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              statusLabel === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="text-xs font-semibold text-slate-600">{balanceDisplay}</div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-auto mt-0.5 transition-all ${
          selected ? 'border-blue-500 bg-blue-500' : 'border-slate-200'
        }`}>
          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
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
export default function DepositCreationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const presetType = searchParams.get('type') === 'staff' ? 'staff' : 'student';
  const presetId = searchParams.get('id') ? Number(searchParams.get('id')) : null;

  const canFundStudent = user?.is_superuser || hasPermission('finance.add_studentfundingmodel');
  const canFundStaff = user?.is_superuser || hasPermission('finance.add_studentfundingmodel');

  const [searchType, setSearchType] = useState<'student' | 'staff'>(presetType);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [loadingPreset, setLoadingPreset] = useState(!!presetId);
  const [error, setError] = useState<string | null>(null);

  // Mode & Gateway state
  const [paymentMode, setPaymentMode] = useState<'offline' | 'online'>('offline');
  const [banks, setBanks] = useState<any[]>([]);
  const [bankAccount, setBankAccount] = useState<string>('');
  const [hasActiveGateway, setHasActiveGateway] = useState(false);
  const [billingEmail, setBillingEmail] = useState('');
  const [isManualEmail, setIsManualEmail] = useState(false);

  const [walletType, setWalletType] = useState<'canteen' | 'fee'>('canteen');
  const [amount, setAmount] = useState<number | ''>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [tellerNumber, setTellerNumber] = useState('');
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Persistent LocalStorage memory for redirect option
  const [postSaveAction, setPostSaveAction] = useState<'stay' | 'list' | 'draw_out'>('list');
  const [savedFundingId, setSavedFundingId] = useState<number | null>(null);

  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [studentWallet, setStudentWallet] = useState<{ canteen?: number; fee?: number } | null>(null);
  const [staffWallet, setStaffWallet] = useState<number | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const [recentFundings, setRecentFundings] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Load saved redirect preference from localStorage on mount ──
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

  // ── Dynamically Load Payment Gateway Scripts ──
  useEffect(() => {
    if (!document.getElementById('paystack-script')) {
      const script = document.createElement('script');
      script.id = 'paystack-script';
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      document.body.appendChild(script);
    }
    if (!document.getElementById('flutterwave-script')) {
      const script = document.createElement('script');
      script.id = 'flutterwave-script';
      script.src = 'https://checkout.flutterwave.com/v3.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // ── Fetch settings, banks & gateways ──
  useEffect(() => {
    Promise.all([
      financeSettingsAPI.get().catch(() => null),
      bankDetailsAPI.list({ is_active: true, account_type: 'bank' }).catch(() => []),
      gatewayAPI.list().catch(() => []),
    ]).then(([settingsData, banksData, gatewaysData]) => {
      setSettings(settingsData || {});
      setBanks(Array.isArray(banksData) ? banksData : []);
      setHasActiveGateway(Array.isArray(gatewaysData) && gatewaysData.some((g: any) => g.is_active));
      setLoadingSettings(false);
    });

    const returnedRef = searchParams.get('reference') || searchParams.get('trxref');
    if (returnedRef) {
      handlePostPaymentReconciliation(returnedRef, null);
    }
  }, [router, searchParams]);

  // ── Pre-load person if presetId ──
  useEffect(() => {
    if (!presetId) return;
    setLoadingPreset(true);
    const fetcher = presetType === 'student' ? studentsAPI.get : staffAPI.get;
    fetcher(presetId)
      .then(data => {
        handleSelectPerson(data);
      })
      .catch(() => setError('Could not load the person. Please search manually.'))
      .finally(() => setLoadingPreset(false));
  }, [presetId, presetType]);

  // ── Search debounce ──
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounce.current = setTimeout(() => {
      setSearchLoading(true);
      const fetcher = searchType === 'student' ? studentsAPI.list : staffAPI.list;
      fetcher({ search: searchQuery.trim(), page_size: 10 })
        .then((data: any) => {
          const results = data?.results ?? data?.data ?? data ?? [];
          setSearchResults(Array.isArray(results) ? results : []);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery, searchType]);

  // ── Fetch wallet and recent history ──
  const fetchWalletAndHistory = async (person: any, type: 'student' | 'staff') => {
    if (!person) return;
    setLoadingWallet(true);
    setLoadingRecent(true);
    try {
      if (type === 'student') {
        const canteen = person?.canteen_balance ?? person.canteen_wallet ?? 0;
        const fee = person?.fee_balance ?? person.fee_wallet ?? 0;
        setStudentWallet({ canteen: Number(canteen), fee: Number(fee) });
        const fundings = await studentFundingAPI.list({ student_id: person.id, page_size: 3 });
        setRecentFundings(Array.isArray(fundings.results) ? fundings.results : []);
      } else {
        const balance = person.wallet_balance ?? person.wallet?.balance ?? 0;
        setStaffWallet(Number(balance));
        const fundings = await staffFundingAPI.list({ staff_id: person.id, page_size: 3 });
        setRecentFundings(Array.isArray(fundings.results) ? fundings.results : []);
      }
    } catch {
      // silent
    } finally {
      setLoadingWallet(false);
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    if (!selectedPerson) {
      setStudentWallet(null);
      setStaffWallet(null);
      setRecentFundings([]);
      setSavedFundingId(null);
      return;
    }
    fetchWalletAndHistory(selectedPerson, searchType);
  }, [selectedPerson]);

  const handleSelectPerson = (person: any) => {
    setSelectedPerson(person);
    setSearchResults([]);
    setSearchQuery('');
    setError(null);
    setAmount('');
    setProofFile(null);
    setPaymentMethod(settings?.default_expense_payment_method || 'cash');
    setBankAccount('');
    setTellerNumber('');
    setReference('');
    setSavedFundingId(null);
    // Note: We retain postSaveAction from localStorage instead of resetting to 'list'

    let resolved = '';
    if (person.email && typeof person.email === 'string' && person.email.trim() !== '') {
      resolved = person.email.trim();
    } else if (searchType === 'student' && person.parent_email && typeof person.parent_email === 'string' && person.parent_email.trim() !== '') {
      resolved = person.parent_email.trim();
    }
    setBillingEmail(resolved);
    setIsManualEmail(!resolved);

    fetchWalletAndHistory(person, searchType);
  };

  const clearSelection = () => {
    setSelectedPerson(null);
    setStudentWallet(null);
    setStaffWallet(null);
    setRecentFundings([]);
    setSavedFundingId(null);
    setError(null);
  };

  const handleAmountQuick = (val: number) => setAmount(val);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
  };

  // ── Synchronous Post-Payment Verification & Routing ──
  const handlePostPaymentReconciliation = async (txRef: string, fundingRecordId: number | null) => {
    setIsVerifying(true);
    try {
      await onlinePaymentAPI.verifyLive(txRef);
      showToast('success', `Payment successfully verified and credited to ledger!`);

      const filterType = searchType === 'student' ? 'student' : 'staff';

      if (postSaveAction === 'list') {
        router.push(`/dashboard/staff/finance/deposits?filter=${filterType}`);
        return;
      }

      if (postSaveAction === 'draw_out' && fundingRecordId) {
        router.push(`/dashboard/staff/finance/deposits?filter=${filterType}&open_audit=${fundingRecordId}`);
        return;
      }

      if (selectedPerson) {
        fetchWalletAndHistory(selectedPerson, searchType);
      }
      setAmount('');
      setReference('');
    } catch (err) {
      setError(extractError(err));
      showToast('error', 'Live verification failed or pending. Please check transaction history.');
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Launch Inline Payment Modal ──
  const launchInlineCheckout = (gatewayRes: any, numAmount: number, fundingRecordId: number) => {
    const provider = gatewayRes.provider;
    const publicKey = gatewayRes.public_key;
    const txRef = gatewayRes.reference;

    if (provider === 'paystack') {
      if (!window.PaystackPop) {
        showToast('error', 'Paystack SDK failed to load. Redirecting via web checkout...');
        if (gatewayRes.payment_url) window.location.href = gatewayRes.payment_url;
        return;
      }
      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: billingEmail.trim(),
        amount: numAmount * 100, // Kobo
        ref: txRef,
        access_code: gatewayRes.access_code,
        onClose: () => {
          showToast('error', 'Online payment checkout canceled by cashier.');
        },
        callback: () => {
          handlePostPaymentReconciliation(txRef, fundingRecordId);
        },
      });
      handler.openIframe();
    } else if (provider === 'flutterwave') {
      if (!window.FlutterwaveCheckout) {
        showToast('error', 'Flutterwave SDK failed to load. Redirecting via web checkout...');
        if (gatewayRes.payment_url) window.location.href = gatewayRes.payment_url;
        return;
      }
      window.FlutterwaveCheckout({
        public_key: publicKey,
        tx_ref: txRef,
        amount: numAmount,
        currency: 'NGN',
        customer: { email: billingEmail.trim() },
        onclose: () => {
          showToast('error', 'Online payment checkout canceled by cashier.');
        },
        callback: () => {
          handlePostPaymentReconciliation(txRef, fundingRecordId);
        },
      });
    } else {
      if (gatewayRes.payment_url) {
        window.location.href = gatewayRes.payment_url;
      } else {
        setError('Payment gateway did not return valid inline checkout credentials.');
      }
    }
  };

  // ── Submit & Comprehensive Validation ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Amount is required and must be greater than ₦0.00.');
      return;
    }
    if (settings?.max_funding_amount && numAmount > Number(settings.max_funding_amount)) {
      setError(`Amount exceeds maximum allowed limit of ${fmtMoney(Number(settings.max_funding_amount))}`);
      return;
    }

    if (paymentMode === 'offline') {
      if (paymentMethod !== 'cash' && !bankAccount) {
        setError('A settlement bank account is required for all non-cash offline deposits.');
        return;
      }
      if (settings?.require_proof_for_funding && paymentMethod !== 'cash' && !proofFile) {
        setError('School policy strictly mandates uploading a proof of payment document for non-cash deposits.');
        return;
      }
    } else {
      if (!billingEmail || !isValidEmail(billingEmail.trim())) {
        setError('A valid billing email address (e.g., name@domain.com) is strictly required by online payment gateways.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const filterType = searchType === 'student' ? 'student' : 'staff';

      if (paymentMode === 'offline') {
        const formData = new FormData();
        const endpoint = searchType === 'student' ? studentFundingAPI.create : staffFundingAPI.create;

        formData.append('amount', String(numAmount));
        formData.append('method', paymentMethod);
        formData.append('mode', 'offline');

        if (paymentMethod !== 'cash' && bankAccount) formData.append('bank_account', bankAccount);
        if (tellerNumber.trim()) formData.append('teller_number', tellerNumber.trim());
        if (reference.trim()) formData.append('reference', reference.trim());
        if (proofFile) formData.append('proof_of_payment', proofFile);

        if (searchType === 'student') {
          formData.append('student', String(selectedPerson.id));
          formData.append('wallet_type', walletType);
        } else {
          formData.append('staff', String(selectedPerson.id));
        }

        const response = await endpoint(formData);
        const fundingId = response?.id;

        showToast('success', `Funding of ${fmtMoney(numAmount)} recorded successfully`);

        if (postSaveAction === 'list') {
          router.push(`/dashboard/staff/finance/deposits?filter=${filterType}`);
          return;
        }

        if (postSaveAction === 'draw_out' && fundingId) {
          router.push(`/dashboard/staff/finance/deposits?filter=${filterType}&open_audit=${fundingId}`);
          return;
        }

        setSavedFundingId(fundingId);
        clearSelection();
        setAmount('');
        setProofFile(null);
        setTellerNumber('');
        setReference('');
        setError(null);
      } else {
        // ── ONLINE GATEWAY FLOW ──
        const pendingPayload: any = {
          amount: numAmount,
          method: 'bank_transfer',
          mode: 'online',
        };
        if (searchType === 'student') {
          pendingPayload.student = selectedPerson.id;
          pendingPayload.wallet_type = walletType;
        } else {
          pendingPayload.staff = selectedPerson.id;
        }

        const createdRecord = searchType === 'student'
          ? await studentFundingAPI.create(pendingPayload)
          : await staffFundingAPI.create(pendingPayload);

        const gatewayRes = await onlinePaymentAPI.initiate({
          payment_type: searchType === 'student' ? 'student_funding' : 'staff_funding',
          payment_id: createdRecord.id,
          amount: numAmount,
          email: billingEmail.trim(),
        });

        launchInlineCheckout(gatewayRes, numAmount, createdRecord.id);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasConfiguredSettings = settings && (
    settings.max_funding_amount || settings.require_proof_for_funding || settings.auto_confirm_funding
  );

  // ── Permission guard ──
  if (!canFundStudent && !canFundStaff) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to fund wallets.</p>
        </div>
      </div>
    );
  }

  if (loadingPreset) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
        <p className="mt-2 text-sm text-slate-400">Loading person details...</p>
      </div>
    );
  }

  return (
    <div className="pb-28 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <VerificationOverlay isVisible={isVerifying} />

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/dashboard/staff/finance/deposits')} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            Create Wallet Deposit
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Fund student or staff wallets directly at the POS terminal</p>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium flex-1">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Conditional Settings Banner ── */}
      {hasConfiguredSettings && (
        <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Active School Rules:</span>
          {settings.max_funding_amount && (
            <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs">
              <span>Max Ceiling:</span>
              <span className="font-bold text-slate-800">{fmtMoney(Number(settings.max_funding_amount))}</span>
            </span>
          )}
          {settings.require_proof_for_funding && (
            <span className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded border border-amber-200 text-amber-800 font-medium">
              <Upload className="h-3 w-3 text-amber-600" /> Proof Required
            </span>
          )}
          {settings.auto_confirm_funding && (
            <span className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-emerald-800 font-medium">
              <Check className="h-3 w-3 text-emerald-600" /> Auto-Confirm Active
            </span>
          )}
        </div>
      )}

      {!selectedPerson ? (
        // ─── Search ──
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit mb-6 mx-auto">
            <button
              onClick={() => { setSearchType('student'); setSearchResults([]); setSearchQuery(''); }}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                searchType === 'student'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="h-4 w-4 inline mr-1.5" /> Student
            </button>
            <button
              onClick={() => { setSearchType('staff'); setSearchResults([]); setSearchQuery(''); }}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                searchType === 'staff'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="h-4 w-4 inline mr-1.5" /> Staff
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${searchType} by name, ID, email, or mobile...`}
              className="w-full pl-11 pr-10 py-3 text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
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
                <span className="ml-2 text-sm text-slate-400">Searching...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((person) => (
                <ResultCard
                  key={person.id}
                  person={person}
                  type={searchType}
                  selected={false}
                  onClick={() => handleSelectPerson(person)}
                />
              ))
            ) : searchQuery.trim().length >= 2 ? (
              <div className="text-center py-10">
                <UserCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No {searchType}s found</p>
                <p className="text-xs text-slate-400">Try adjusting your search terms</p>
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
        // ─── Selected Person + Funding Form ──
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Selected Person Card */}
          <div className="lg:col-span-2">
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
                      {searchType === 'student' ? selectedPerson.registration_number : selectedPerson.staff_id}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {searchType === 'student' ? (
                        <span className="text-xs font-medium text-slate-600">
                          {[selectedPerson.current_class_name, selectedPerson.current_class_section_name].filter(Boolean).join(' · ') || '—'}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-600">
                          {[selectedPerson.department_name, selectedPerson.position_name].filter(Boolean).join(' · ') || '—'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Wallet Balances */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {searchType === 'student' ? (
                    <>
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Canteen</p>
                        <p className="text-lg font-bold text-blue-800">
                          {loadingWallet ? '...' : studentWallet ? fmtMoney(studentWallet.canteen || 0) : '—'}
                        </p>
                      </div>
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide">Fee</p>
                        <p className="text-lg font-bold text-purple-800">
                          {loadingWallet ? '...' : studentWallet ? fmtMoney(studentWallet.fee || 0) : '—'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Wallet Balance</p>
                      <p className="text-lg font-bold text-emerald-800">
                        {loadingWallet ? '...' : staffWallet !== null ? fmtMoney(staffWallet) : '—'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Recent Fundings */}
                {recentFundings.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Recent Funding</p>
                    <div className="space-y-1.5">
                      {recentFundings.slice(0, 3).map((f: any) => (
                        <div key={f.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">
                            {fmtMoney(f.amount)} · {f.wallet_type ? toTitleCase(f.wallet_type) : 'Wallet'}
                          </span>
                          <span className="text-slate-400">
                            {new Date(f.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button onClick={clearSelection} className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                    Change Selection
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Funding Form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Fund Wallet</h3>

                {hasActiveGateway && (
                  <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('offline')}
                      className={`px-3 py-1 rounded-md transition-all ${paymentMode === 'offline' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Offline
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('online')}
                      className={`px-3 py-1 rounded-md transition-all ${paymentMode === 'online' ? 'bg-white text-blue-700 shadow-sm flex items-center gap-1' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <Globe className="h-3 w-3" /> Pay Online
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Wallet Type (Student only) */}
                {searchType === 'student' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Wallet Type <span className="text-red-500 normal-case">*</span>
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setWalletType('canteen')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                          walletType === 'canteen'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Wallet className="h-4 w-4" />
                        Canteen
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalletType('fee')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                          walletType === 'fee'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <CreditCard className="h-4 w-4" />
                        Fee
                      </button>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Amount (₦) <span className="text-red-500 normal-case">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                      placeholder="Enter amount"
                      required
                    />
                  </div>
                  {settings?.max_funding_amount && amount && amount > settings.max_funding_amount && (
                    <p className="mt-1 text-xs text-red-600">
                      Exceeds max limit of {fmtMoney(Number(settings.max_funding_amount))}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[500, 1000, 2000, 5000, 10000].map(val => (
                      <QuickAmount key={val} amount={val} onClick={handleAmountQuick} />
                    ))}
                  </div>
                </div>

                {/* ── OFFLINE FIELDS ── */}
                {paymentMode === 'offline' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Payment Method <span className="text-red-500 normal-case">*</span>
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={e => setPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                        >
                          <option value="cash">Cash</option>
                          <option value="pos">POS</option>
                          <option value="bank_teller">Bank Teller</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>

                      {paymentMethod !== 'cash' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Settlement Bank <span className="text-red-500 normal-case">*</span>
                          </label>
                          <select
                            value={bankAccount}
                            onChange={e => setBankAccount(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                            required
                          >
                            <option value="">Select bank account</option>
                            {banks.map(b => (
                              <option key={b.id} value={b.id}>{b.bank_name} ({b.account_number})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {paymentMethod !== 'cash' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Proof of Payment
                          {settings?.require_proof_for_funding && <span className="text-red-500 normal-case ml-1">*</span>}
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl hover:border-emerald-400 transition-colors bg-white text-sm text-slate-500">
                              <Upload className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate text-xs">
                                {proofFile ? proofFile.name : 'Choose file'}
                              </span>
                            </div>
                            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                          </label>
                          {proofFile && (
                            <button type="button" onClick={() => setProofFile(null)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          External Reference / Invoice # <span className="normal-case font-normal text-slate-400">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={reference}
                          onChange={e => setReference(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                          placeholder="Leave blank to auto-generate"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Teller Number</label>
                        <input
                          type="text"
                          value={tellerNumber}
                          onChange={e => setTellerNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                          placeholder="e.g. Teller #123"
                        />
                      </div>
                    </div>

                  </>
                )}

                {/* ── ONLINE GATEWAY FIELDS ── */}
                {paymentMode === 'online' && (
                  <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Billing Email for Gateway <span className="text-red-500">*</span>
                      </label>
                      {isManualEmail ? (
                        <div>
                          <input
                            type="email"
                            required
                            value={billingEmail}
                            onChange={e => setBillingEmail(e.target.value)}
                            placeholder="Enter payer email address"
                            className="w-full px-3.5 py-2 text-sm border border-blue-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          <p className="text-[11px] text-amber-700 mt-1">⚠️ Required for inline checkout authorization.</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-sm">
                          <span className="font-medium text-slate-700">{billingEmail}</span>
                          <button type="button" onClick={() => setIsManualEmail(true)} className="text-xs text-blue-600 font-bold hover:underline">
                            Change
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      An inline modal will open to process the card or transfer. Once completed, the cashier desk will immediately verify the transaction and credit the school ledger.
                    </p>
                  </div>
                )}

                {/* Post-Save Action & Submit */}
                <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">After Save</label>
                    <select
                      value={postSaveAction}
                      onChange={e => handleRedirectChange(e.target.value as any)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white font-medium text-slate-700"
                    >
                      <option value="list">📋 Go to List</option>
                      <option value="stay">🔄 Stay (Clear & Reset)</option>
                      <option value="draw_out">👁️ Go to Index & View Receipt</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || isVerifying}
                    className={`flex-1 sm:flex-none px-6 py-2.5 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2 ${paymentMode === 'online' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200'}`}
                  >
                    {isSubmitting || isVerifying ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                    ) : paymentMode === 'online' ? (
                      <><Globe className="h-4 w-4" /> Pay Online</>
                    ) : (
                      <><Wallet className="h-4 w-4" /> Fund Wallet</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}