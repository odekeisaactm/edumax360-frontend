'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWard } from '@/context/WardContext';
import { financeAPI } from '@/lib/api';
import {
  Loader2, AlertCircle, CheckCircle2,
  CreditCard, Upload, X, Landmark, FileText, ChevronDown,
  ShieldCheck, Clock, ArrowRight, Banknote, UtensilsCrossed, ArrowLeft
} from 'lucide-react';
import type { SchoolBankDetail } from '@/lib/types';

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
  return err?.message || 'An unexpected error occurred while submitting.';
}

function toTitleCase(str?: string): string {
  if (!str) return '—';
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-in fade-in slide-in-from-top-2
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ParentFundWalletPage() {
  const router = useRouter();
  const { selectedWard } = useWard();

  // Form State
  const [walletType, setWalletType] = useState<'canteen' | 'fee'>('canteen');
  const [amount, setAmount] = useState<number | ''>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [tellerNumber, setTellerNumber] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Data & Loading State
  const [banks, setBanks] = useState<SchoolBankDetail[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  // Derived
  const selectedBank = banks.find(b => String(b.id) === String(bankAccount));

  // 1. Clear form whenever the selected ward changes
  useEffect(() => {
    setWalletType('canteen');
    setAmount('');
    setBankAccount('');
    setTellerNumber('');
    setProofFile(null);
    setError(null);
  }, [selectedWard?.id]);

  // 2. Fetch Active Commercial Banks
  useEffect(() => {
    const fetchBanks = async () => {
      setLoadingBanks(true);
      try {
        const bankData = await financeAPI.bankDetails.list({
          is_active: true,
          account_type: 'bank' as any,
        });
        setBanks(bankData);
      } catch (err) {
        showToast('error', 'Failed to load school bank accounts.');
      } finally {
        setLoadingBanks(false);
      }
    };
    fetchBanks();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
  };

  // 3. Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWard) return;

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than ₦0.00.');
      return;
    }
    if (!bankAccount) {
      setError('Please select the school bank account you paid into.');
      return;
    }
    if (!proofFile) {
      setError('A proof of payment document (receipt/screenshot) is strictly required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('student', String(selectedWard.id));
      formData.append('wallet_type', walletType);
      formData.append('amount', String(numAmount));
      formData.append('method', 'bank_transfer');
      formData.append('mode', 'offline');
      formData.append('bank_account', bankAccount);
      formData.append('proof_of_payment', proofFile);

      if (tellerNumber.trim()) formData.append('teller_number', tellerNumber.trim());

      await financeAPI.studentFunding.create(formData);

      showToast('success', `Deposit of ₦${numAmount.toLocaleString()} submitted successfully.`);

      setTimeout(() => {
        router.push('/dashboard/parent/wallet/history');
      }, 1000);

    } catch (err) {
      setError(extractError(err));
      setIsSubmitting(false);
    }
  };

  if (!selectedWard) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="font-semibold text-slate-800">Loading student profile...</p>
        <p className="text-sm text-slate-500 mt-1">Please select a ward from the top navigation.</p>
      </div>
    );
  }

  const wardName = toTitleCase(
    selectedWard.full_name ||
    `${selectedWard.first_name || ''} ${selectedWard.last_name || ''}`.trim()
  );

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-20 animate-in fade-in duration-300 space-y-4">
      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
      />

      {/* ── Header Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => router.push('/dashboard/parent/wallet/history')}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              title="Back to History"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-200 shrink-0">
              <Banknote className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
                Fund Wallet
              </h1>
              <p className="text-[11px] font-medium text-slate-500 truncate">
                Upload payment proof to top-up
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Selected Ward Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 flex items-center gap-3">
        {selectedWard.image_url ? (
          <img
            src={selectedWard.image_url}
            alt="Profile"
            className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center border border-indigo-200">
            <span className="font-black text-sm text-indigo-700">
              {wardName.charAt(0)}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 text-sm truncate">
            Funding for {wardName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-mono text-slate-400">
              {selectedWard.registration_number || 'No ID'}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-medium text-slate-500">
              {selectedWard.current_class_name || 'No Class'}
            </span>
          </div>
        </div>
        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 shrink-0">
          Ward
        </span>
      </div>

      {/* ── Main Form Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="divide-y divide-slate-100">

            {/* ─── Wallet Type Selector — compact inline ─── */}
            <div className="px-4 sm:px-5 pt-4 pb-3.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                Wallet Type <span className="text-red-500">*</span>
              </label>
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setWalletType('canteen')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                    walletType === 'canteen'
                      ? 'bg-white text-orange-700 shadow-sm border border-orange-200/60'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" /> Canteen
                </button>
                <button
                  type="button"
                  onClick={() => setWalletType('fee')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                    walletType === 'fee'
                      ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200/60'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5" /> Fee
                </button>
              </div>
            </div>

            {/* ─── Amount Section ─── */}
            <div className="px-4 sm:px-5 py-3.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                Amount to Fund <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <span className="text-base font-black text-slate-400">₦</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value ? parseFloat(e.target.value) : '')
                  }
                  className="w-full pl-10 pr-4 py-3 text-xl font-black text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none placeholder:text-slate-200 placeholder:font-medium transition-all bg-slate-50/50"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {[2000, 5000, 10000, 20000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      amount === val
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50'
                    }`}
                  >
                    ₦{val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Bank Account Selection ─── */}
            <div className="px-4 sm:px-5 py-3.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                Paid Into Bank <span className="text-red-500">*</span>
              </label>

              {loadingBanks ? (
                <div className="flex items-center gap-2 px-3 py-2.5 border-2 border-slate-100 bg-slate-50 rounded-xl text-xs text-slate-400 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                  Fetching bank accounts...
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <select
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="w-full pl-9 pr-9 py-2.5 text-sm font-bold border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none appearance-none text-slate-700 bg-slate-50/50 transition-all cursor-pointer"
                      required
                    >
                      <option value="" disabled>
                        Select bank account
                      </option>
                      {banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} — {b.account_number}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Selected bank detail */}
                  {selectedBank && (
                    <div className="mt-2.5 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl animate-in slide-in-from-top-1 duration-200">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                          <Landmark className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs font-black text-emerald-900">
                            {selectedBank.bank_name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Acct:</span>
                            <span className="text-xs font-mono font-black text-emerald-900 tracking-wider">
                              {selectedBank.account_number}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-emerald-700 truncate">
                            {selectedBank.account_name}
                          </p>
                        </div>
                        <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ─── Proof of Payment Upload — compact ─── */}
            <div className="px-4 sm:px-5 py-3.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                Proof of Payment <span className="text-red-500">*</span>
              </label>
              <div
                className={`relative flex items-center gap-3 px-3.5 py-2.5 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer ${
                  proofFile
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
                }`}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  required
                />
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    proofFile
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-white border border-slate-200 text-slate-400'
                  }`}
                >
                  {proofFile ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${proofFile ? 'text-emerald-800' : 'text-slate-600'}`}>
                    {proofFile ? proofFile.name : 'Tap to attach receipt'}
                  </p>
                  <p className="text-[10px] text-slate-400">PDF, JPG, PNG · Max 5MB</p>
                </div>
              </div>
            </div>

            {/* ─── Optional Teller Number — full width ─── */}
            <div className="px-4 sm:px-5 py-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Teller Number
                </label>
                <span className="text-[9px] font-bold text-slate-300 uppercase">Optional</span>
              </div>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                <input
                  type="text"
                  value={tellerNumber}
                  onChange={(e) => setTellerNumber(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-sm font-medium border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none bg-slate-50/50 transition-all placeholder:text-slate-300"
                  placeholder="Enter teller number if available"
                />
              </div>
            </div>
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div className="mx-4 sm:mx-5 mt-3 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 animate-in slide-in-from-bottom-2 duration-200">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 font-bold flex-1 leading-relaxed">
                {error}
              </p>
              <button
                onClick={() => setError(null)}
                className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ── Info Note ── */}
          <div className="mx-4 sm:mx-5 mt-3 flex items-start gap-2 bg-amber-50/70 border border-amber-200 rounded-xl p-3">
            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
              Deposits are subject to verification. Your wallet balance will update once the school confirms your payment.
            </p>
          </div>

          {/* ── Submit Button ── */}
          <div className="p-4 sm:p-5 pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2.5 py-3 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing Deposit...
                </>
              ) : (
                <>
                  Submit Payment Proof
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}