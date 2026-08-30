'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  advancePaymentsAPI,
  bankDetailsAPI,
  financeSettingsAPI,
} from '@/lib/finance.service';
import { purchaseAdvanceAPI } from '@/lib/inventory.service';
import type {
  PurchaseAdvancePaymentFormValues,
  SchoolBankDetail,
  GeneralPaymentMethod,
  FinanceSettings,
} from '@/lib/finance.types';
import {
  ArrowLeft, Wallet, Check, Loader2, AlertCircle, ChevronDown,
  X, Landmark, Info, AlertTriangle,
} from 'lucide-react';

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (Array.isArray(d.non_field_errors) && d.non_field_errors.length) return String(d.non_field_errors[0]);
    for (const [key, val] of Object.entries(d)) {
      if (Array.isArray(val) && val.length) return `${key}: ${val[0]}`;
      if (typeof val === 'string') return val;
    }
  }
  return err?.message || 'An error occurred';
}

const PAYMENT_METHODS: { value: GeneralPaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

const DIRECTION_OPTIONS = [
  { value: 'to_staff', label: 'Paid to Staff', short: 'Out', icon: '↑' },
  { value: 'from_staff', label: 'Refunded by Staff', short: 'In', icon: '↓' },
];

export default function NewAdvancePaymentPage() {
  const router = useRouter();

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [advances, setAdvances] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<SchoolBankDetail[]>([]);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);

  const [selectedAdvance, setSelectedAdvance] = useState<any>(null);
  const [advanceSearch, setAdvanceSearch] = useState('');
  const [showAdvanceDropdown, setShowAdvanceDropdown] = useState(false);
  const [advancePayments, setAdvancePayments] = useState<any[]>([]);

  const [direction, setDirection] = useState<'to_staff' | 'from_staff'>('to_staff');

  const baseCurrency = settings?.currency_config?.base_currency || 'NGN';
  const [selectedCurrency, setSelectedCurrency] = useState<string>(baseCurrency);
  const isForeign = !!settings?.strict_multi_currency && selectedCurrency !== baseCurrency;

  const [form, setForm] = useState<PurchaseAdvancePaymentFormValues>({
    advance: 0,
    direction: 'to_staff',
    amount: '',
    bank_account: null,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference: '',
    notes: '',
    foreign_currency: undefined,
    foreign_amount: undefined,
    exchange_rate: undefined,
  });

  const [showOverdrawConfirm, setShowOverdrawConfirm] = useState(false);

  useEffect(() => {
    setLoadingInitial(true);
    Promise.all([
      purchaseAdvanceAPI.list({ page_size: 1000 }),
      bankDetailsAPI.list({ is_active: true }),
      financeSettingsAPI.get(),
    ]).then(([advRes, bankRes, settingsRes]) => {
      const advs = Array.isArray(advRes) ? advRes : (advRes as any)?.results || [];
      const banks = Array.isArray(bankRes) ? bankRes : (bankRes as any)?.results || [];
      setAdvances(advs.filter((a: any) => a.status !== 'cancelled'));
      setBankAccounts(banks.filter((b: SchoolBankDetail) => b.account_type !== 'cash_vault'));
      const settingsData = (settingsRes as any)?.data || settingsRes;
      setSettings(settingsData);
      setSelectedCurrency(settingsData?.currency_config?.base_currency || 'NGN');
    }).finally(() => setLoadingInitial(false));
  }, []);

  // Maximum allowed amount for the selected advance + direction.
  const maxAllowed = useMemo(() => {
    if (!selectedAdvance) return 0;
    const approved = parseFloat(selectedAdvance.approved_amount || '0');
    const disbursed = parseFloat(selectedAdvance.disbursed_amount || '0');
    const actual = parseFloat(selectedAdvance.actual_total || '0');

    if (direction === 'to_staff') {
      const capBase = actual > 0 ? actual : approved;
      return Math.max(0, capBase - disbursed);
    } else {
      return Math.max(0, disbursed - actual);
    }
  }, [selectedAdvance, direction]);

  const isOverdraw = useMemo(() => {
    if (!form.amount || !selectedAdvance) return false;
    return parseFloat(form.amount) > maxAllowed;
  }, [form.amount, maxAllowed, selectedAdvance]);

  const filteredAdvances = useMemo(() => {
    return advances
      .filter((adv: any) => {
        const disbursed = parseFloat(adv.disbursed_amount || '0');
        const approved = parseFloat(adv.approved_amount || '0');
        const actual = parseFloat(adv.actual_total || '0');
        if (direction === 'to_staff') {
          const cap = actual > 0 ? actual : approved;
          return cap - disbursed > 0;
        } else {
          return disbursed - actual > 0;
        }
      })
      .filter((adv: any) => {
        if (!advanceSearch.trim()) return true;
        const q = advanceSearch.toLowerCase();
        return (
          (adv.advance_number || '').toLowerCase().includes(q) ||
          (adv.staff_name || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [advances, advanceSearch, direction]);

  const fetchAdvancePayments = async (advanceId: number) => {
    try {
      const res = await advancePaymentsAPI.list({ advance: advanceId, page_size: 1000 });
      const all = Array.isArray(res) ? res : (res as any)?.results || [];
      setAdvancePayments(all);
    } catch {
      setAdvancePayments([]);
    }
  };

  const handleSelectAdvance = async (adv: any) => {
    setShowAdvanceDropdown(false);
    setAdvanceSearch('');
    setSelectedAdvance(adv);
    setForm(prev => ({
      ...prev,
      advance: adv.id,
      amount: '',
      foreign_amount: '',
      exchange_rate: undefined,
      foreign_currency: undefined,
    }));
    try {
      const details = await purchaseAdvanceAPI.get(adv.id);
      setSelectedAdvance(details);
      await fetchAdvancePayments(adv.id);
    } catch {
      setFormError('Failed to load advance details.');
    }
  };

  const clearAdvance = () => {
    setSelectedAdvance(null);
    setAdvancePayments([]);
    setForm(prev => ({
      ...prev,
      advance: 0,
      amount: '',
      foreign_amount: '',
      exchange_rate: undefined,
      foreign_currency: undefined,
    }));
  };

  const handleDirectionChange = (dir: 'to_staff' | 'from_staff') => {
    setDirection(dir);
    setForm(prev => ({ ...prev, direction: dir }));
  };

  const handleBankChange = (bankId: number | null) => {
    setForm(prev => ({ ...prev, bank_account: bankId }));
    if (bankId) {
      const bank = bankAccounts.find(b => b.id === bankId);
      if (bank) {
        const currency = bank.currency;
        setSelectedCurrency(currency);
        if (currency !== baseCurrency) {
          const rate = settings?.currency_config?.supported_currencies?.[currency]?.rate_to_base;
          setForm(prev => ({
            ...prev,
            foreign_currency: currency,
            exchange_rate: rate ? String(rate) : '',
            foreign_amount: '',
          }));
        } else {
          setForm(prev => ({ ...prev, foreign_currency: undefined, foreign_amount: undefined, exchange_rate: undefined }));
        }
      }
    } else {
      setSelectedCurrency(baseCurrency);
      setForm(prev => ({ ...prev, foreign_currency: undefined, foreign_amount: undefined, exchange_rate: undefined }));
    }
  };

  const handleForeignAmountChange = (val: string) => {
    setForm(prev => ({ ...prev, foreign_amount: val }));
    const rate = parseFloat(form.exchange_rate || '1');
    if (!isNaN(parseFloat(val)) && !isNaN(rate) && rate > 0) {
      const baseAmount = parseFloat(val) * rate;
      setForm(prev => ({ ...prev, amount: baseAmount.toFixed(2) }));
    } else {
      setForm(prev => ({ ...prev, amount: '' }));
    }
  };

  const canSubmit = !!selectedAdvance && !!form.amount && !!form.payment_date &&
    (form.payment_method === 'cash' || !!form.bank_account) && !isOverdraw;

  const submitPayment = async () => {
    setFormError(null);
    if (!selectedAdvance || !form.amount || !form.payment_date) {
      setFormError('Please fill all required fields.');
      return;
    }
    if (form.payment_method !== 'cash' && !form.bank_account) {
      setFormError('A bank account is required for non-cash payments.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, advance: selectedAdvance.id };
      const created = await advancePaymentsAPI.create(payload);
      router.push(`/dashboard/staff/finance/advance-payments/${created.id}`);
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    if (isOverdraw) {
      setShowOverdrawConfirm(true);
      return;
    }
    submitPayment();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/staff/finance/advance-payments')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            Record Advance Payment / Refund
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        {loadingInitial ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Direction Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Payment Direction <span className="text-red-400 normal-case">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DIRECTION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleDirectionChange(opt.value as any)}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                      direction === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advance Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Purchase Advance <span className="text-red-400 normal-case">*</span>
              </label>
              {selectedAdvance ? (
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800">
                  <span className="truncate">
                    {selectedAdvance.advance_number} — {selectedAdvance.staff_name}
                  </span>
                  <button type="button" onClick={clearAdvance} className="p-1 text-slate-400 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div
                    onClick={() => setShowAdvanceDropdown(!showAdvanceDropdown)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-400 cursor-pointer flex items-center justify-between"
                  >
                    <span>Search advance number or staff...</span>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                  {showAdvanceDropdown && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search advance number or staff..."
                          value={advanceSearch}
                          onChange={e => setAdvanceSearch(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                        {filteredAdvances.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">No advances with a balance found.</div>
                        ) : (
                          filteredAdvances.map((adv: any) => {
                            const disbursed = parseFloat(adv.disbursed_amount || '0');
                            const approved = parseFloat(adv.approved_amount || '0');
                            const actual = parseFloat(adv.actual_total || '0');
                            const outstanding = direction === 'to_staff'
                              ? Math.max(0, (actual > 0 ? actual : approved) - disbursed)
                              : Math.max(0, disbursed - actual);
                            return (
                              <button
                                key={adv.id}
                                type="button"
                                onClick={() => handleSelectAdvance(adv)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 flex flex-col"
                              >
                                <span className="font-semibold">{adv.advance_number}</span>
                                <span className="text-xs text-slate-500">{adv.staff_name || 'Unknown staff'}</span>
                                <span className="text-xs text-emerald-600 font-medium">
                                  Outstanding: ₦{outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Advance Summary */}
            {selectedAdvance && (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Info className="h-4 w-4 text-indigo-500" />
                  Advance Summary
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-slate-400">Advance Ref:</span><span className="font-medium ml-1">{selectedAdvance.advance_number}</span></div>
                  <div><span className="text-slate-400">Staff:</span><span className="font-medium ml-1">{selectedAdvance.staff_name}</span></div>
                  <div><span className="text-slate-400">Approved:</span><span className="font-medium ml-1">₦{parseFloat(selectedAdvance.approved_amount || '0').toLocaleString()}</span></div>
                  <div><span className="text-slate-400">Disbursed (net):</span><span className="font-medium ml-1">₦{parseFloat(selectedAdvance.disbursed_amount || '0').toLocaleString()}</span></div>
                  <div><span className="text-slate-400">Actual Total:</span><span className="font-medium ml-1">₦{parseFloat(selectedAdvance.actual_total || '0').toLocaleString()}</span></div>
                  <div><span className="text-slate-400">Balance Due:</span><span className="font-medium ml-1">₦{parseFloat(selectedAdvance.balance_due || '0').toLocaleString()}</span></div>
                  <div><span className="text-slate-400">Max for this direction:</span><span className="font-bold ml-1 text-emerald-600">₦{maxAllowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>

                <div className="mt-3">
                  <span className="text-xs font-semibold text-slate-500">Previous Payments</span>
                  {advancePayments.length > 0 ? (
                    <ul className="mt-1 divide-y divide-slate-100 text-xs">
                      {advancePayments.map((pmt: any) => (
                        <li key={pmt.id} className="py-1 flex justify-between">
                          <span>{pmt.voucher_number}</span>
                          <span className={pmt.direction === 'to_staff' ? 'text-red-600' : 'text-emerald-600'}>
                            {pmt.direction === 'to_staff' ? '-' : '+'}₦{parseFloat(pmt.amount).toLocaleString()}
                          </span>
                          <span className="text-slate-400 capitalize">{(pmt.payment_method || '').replace('_', ' ')}</span>
                          <span className="text-slate-400">{pmt.payment_date}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">No previous payments recorded.</p>
                  )}
                </div>
              </div>
            )}

            {/* Payment Method & Bank Account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Payment Method <span className="text-red-400 normal-case">*</span>
                </label>
                <select
                  value={form.payment_method}
                  onChange={e => {
                    const method = e.target.value as GeneralPaymentMethod;
                    setForm(prev => ({ ...prev, payment_method: method }));
                    if (method === 'cash') {
                      setForm(prev => ({ ...prev, bank_account: null, foreign_currency: undefined, foreign_amount: undefined, exchange_rate: undefined }));
                      setSelectedCurrency(baseCurrency);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                >
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Bank Account {form.payment_method !== 'cash' && <span className="text-red-400 normal-case">*</span>}
                </label>
                {form.payment_method === 'cash' ? (
                  <div className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-between">
                    <span>Physical Cash Vault</span>
                    <Landmark className="h-4 w-4 text-slate-400" />
                  </div>
                ) : (
                  <select
                    value={form.bank_account || ''}
                    onChange={e => handleBankChange(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  >
                    <option value="">Select bank...</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} ({b.account_number}) — Bal: {b.currency} {parseFloat(b.current_balance).toLocaleString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Currency & Amount */}
            {isForeign ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Foreign Amount ({selectedCurrency}) <span className="text-red-400 normal-case">*</span>
                  </label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={form.foreign_amount || ''}
                    onChange={e => handleForeignAmountChange(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-xl ${isOverdraw ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                    placeholder={`0.00 ${selectedCurrency}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Exchange Rate (Locked)</label>
                  <input
                    type="text" readOnly disabled
                    value={form.exchange_rate ? `1 ${selectedCurrency} = ${baseCurrency} ${parseFloat(form.exchange_rate).toLocaleString()}` : 'No rate defined'}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-100 text-slate-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Total Amount ({baseCurrency}) <span className="text-red-400 normal-case">*</span>
                  </label>
                  <input
                    type="number" readOnly value={form.amount}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-100 text-slate-600 font-bold"
                    placeholder="0.00"
                  />
                  {isOverdraw && <p className="text-xs text-red-600 mt-1">Amount exceeds recommended maximum.</p>}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Amount ({baseCurrency}) <span className="text-red-400 normal-case">*</span>
                </label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={form.amount}
                  onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  disabled={!selectedAdvance}
                  className={`w-full px-3 py-2 text-sm border rounded-xl disabled:bg-slate-50 disabled:text-slate-400 ${isOverdraw ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder={selectedAdvance ? `Recommended max: ₦${maxAllowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Select an advance first'}
                />
                {isOverdraw && <p className="text-xs text-red-600 mt-1">This amount exceeds the recommended maximum.</p>}
              </div>
            )}

            {/* Date, Reference, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Payment Date <span className="text-red-400 normal-case">*</span>
                </label>
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={e => setForm(prev => ({ ...prev, payment_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reference</label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={e => setForm(prev => ({ ...prev, reference: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none"
                placeholder="Optional notes"
              />
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" /> {formError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => router.push('/dashboard/staff/finance/advance-payments')}
                className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !selectedAdvance || !form.amount}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Payment
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Overdraw Confirmation Modal */}
      {showOverdrawConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center">Amount Exceeds Recommended</h3>
            <p className="text-sm text-slate-500 text-center leading-relaxed">
              The entered amount is higher than the calculated maximum for this advance and direction. Do you want to proceed anyway?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowOverdrawConfirm(false)}
                className="flex-1 py-2.5 text-sm font-bold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50"
              >
                Review
              </button>
              <button
                onClick={() => { setShowOverdrawConfirm(false); submitPayment(); }}
                disabled={saving}
                className="flex-1 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 flex items-center justify-center gap-1.5 shadow-md shadow-amber-200 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}