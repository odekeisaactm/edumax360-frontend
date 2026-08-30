'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  supplierPaymentsAPI,
  bankDetailsAPI,
  financeSettingsAPI,
} from '@/lib/finance.service';
import { purchaseOrderAPI } from '@/lib/inventory.service';
import type {
  SupplierPaymentFormValues,
  SchoolBankDetail,
  GeneralPaymentMethod,
  FinanceSettings,
} from '@/lib/finance.types';
import {
  ArrowLeft, CreditCard, Check, Loader2, AlertCircle, ChevronDown,
  X, Wallet, Info,
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

export default function NewSupplierPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectPoId = searchParams.get('purchase_order');

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<SchoolBankDetail[]>([]);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);

  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [poSearch, setPoSearch] = useState('');
  const [showPoDropdown, setShowPoDropdown] = useState(false);
  const [poPayments, setPoPayments] = useState<any[]>([]);

  const baseCurrency = settings?.currency_config?.base_currency || 'NGN';
  const [selectedCurrency, setSelectedCurrency] = useState<string>(baseCurrency);
  const isForeign = !!settings?.strict_multi_currency && selectedCurrency !== baseCurrency;

  const [form, setForm] = useState<SupplierPaymentFormValues>({
    supplier: 0,
    purchase_order: 0,
    amount: '',
    bank_account: null,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    setLoadingInitial(true);
    Promise.all([
      purchaseOrderAPI.list({ page_size: 1000 }),
      bankDetailsAPI.list({ is_active: true }),
      financeSettingsAPI.get(),
    ]).then(([poRes, bankRes, settingsRes]) => {
      const pos = Array.isArray(poRes) ? poRes : (poRes as any)?.results || [];
      const banks = Array.isArray(bankRes) ? bankRes : (bankRes as any)?.results || [];
      setPurchaseOrders(pos);
      setBankAccounts(banks.filter((b: SchoolBankDetail) => b.account_type !== 'cash_vault'));
      const settingsData = (settingsRes as any)?.data || settingsRes;
      setSettings(settingsData);
      setSelectedCurrency(settingsData?.currency_config?.base_currency || 'NGN');

      // Arrived via "Record Another Payment" from a PO's detail page —
      // pre-select it instead of making the cashier search again.
      if (preselectPoId) {
        const match = pos.find((po: any) => String(po.id) === String(preselectPoId));
        if (match) handleSelectPo(match);
      }
    }).finally(() => setLoadingInitial(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only POs with an outstanding balance are payable — sourced from the
  // backend's `balance` field, not computed client-side.
  const filteredPOs = useMemo(() => {
    return purchaseOrders
      .filter((po: any) => parseFloat(po.balance ?? po.total_amount ?? '0') > 0)
      .filter((po: any) => {
        if (!poSearch.trim()) return true;
        const q = poSearch.toLowerCase();
        return (
          (po.order_number || '').toLowerCase().includes(q) ||
          (po.supplier_name || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [purchaseOrders, poSearch]);

  const poBalance = selectedPo ? parseFloat(selectedPo.balance ?? '0') : 0;

  const fetchPoPayments = async (poId: number) => {
    try {
      const res = await supplierPaymentsAPI.list({ purchase_order: poId, page_size: 1000 });
      const all = Array.isArray(res) ? res : (res as any)?.results || [];
      setPoPayments(all);
    } catch {
      setPoPayments([]);
    }
  };

  const handleSelectPo = async (po: any) => {
    setShowPoDropdown(false);
    setPoSearch('');
    setSelectedPo(po);
    setForm(prev => ({
      ...prev,
      purchase_order: po.id,
      supplier: po.supplier_id || po.supplier,
      amount: '',
      foreign_amount: '',
      exchange_rate: undefined,
      foreign_currency: undefined,
    }));
    try {
      const details = await purchaseOrderAPI.get(po.id);
      setSelectedPo(details);
      await fetchPoPayments(po.id);
    } catch {
      setFormError('Failed to load purchase order details.');
    }
  };

  const clearPo = () => {
    setSelectedPo(null);
    setPoPayments([]);
    setForm(prev => ({
      ...prev,
      purchase_order: 0,
      supplier: 0,
      amount: '',
      foreign_amount: '',
      exchange_rate: undefined,
      foreign_currency: undefined,
    }));
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

  const isAmountInvalid = useMemo(() => {
    if (!form.amount || !selectedPo) return false;
    return parseFloat(form.amount) > poBalance;
  }, [form.amount, poBalance, selectedPo]);

  const canSubmit = !!selectedPo && !!form.amount && !isAmountInvalid && !!form.payment_date &&
    (form.payment_method === 'cash' || !!form.bank_account);

  const handleSubmit = async () => {
    setFormError(null);
    if (!selectedPo) { setFormError('Select a purchase order.'); return; }
    if (!form.amount || !form.payment_date) { setFormError('Please fill all required fields.'); return; }
    if (form.payment_method !== 'cash' && !form.bank_account) {
      setFormError('A bank account is required for non-cash payments.');
      return;
    }
    if (isAmountInvalid) {
      setFormError(`Amount exceeds outstanding balance of ₦${poBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, supplier: form.supplier || undefined };
      const created = await supplierPaymentsAPI.create(payload);
      router.push(`/dashboard/staff/finance/supplier-payments/${created.id}`);
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/staff/finance/supplier-payments')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            Record Supplier Payment
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
            {/* Purchase Order Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Purchase Order <span className="text-red-400 normal-case">*</span>
              </label>
              {selectedPo ? (
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800">
                  <span className="truncate">{selectedPo.order_number}</span>
                  <button type="button" onClick={clearPo} className="p-1 text-slate-400 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div
                    onClick={() => setShowPoDropdown(!showPoDropdown)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-400 cursor-pointer flex items-center justify-between"
                  >
                    <span>Search purchase order with a balance...</span>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                  {showPoDropdown && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search order number or supplier..."
                          value={poSearch}
                          onChange={e => setPoSearch(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                        {filteredPOs.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">No orders with a balance found.</div>
                        ) : (
                          filteredPOs.map((po: any) => (
                            <button
                              key={po.id}
                              type="button"
                              onClick={() => handleSelectPo(po)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 flex flex-col"
                            >
                              <span className="font-semibold">{po.order_number}</span>
                              <span className="text-xs text-slate-500">{po.supplier_name || 'Unknown supplier'}</span>
                              <span className="text-xs text-emerald-600 font-medium">
                                Balance: ₦{parseFloat(po.balance ?? '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected PO Details */}
            {selectedPo && (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Info className="h-4 w-4 text-indigo-500" />
                  Purchase Order Summary
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div><span className="text-slate-400">Order No:</span><span className="font-medium ml-1">{selectedPo.order_number}</span></div>
                  <div><span className="text-slate-400">Supplier:</span><span className="font-medium ml-1">{selectedPo.supplier_name || '—'}</span></div>
                  <div><span className="text-slate-400">Order Date:</span><span className="font-medium ml-1">{selectedPo.order_date ? new Date(selectedPo.order_date).toLocaleDateString('en-GB') : '—'}</span></div>
                  <div><span className="text-slate-400">Total Amount:</span><span className="font-medium ml-1">₦{parseFloat(selectedPo.total_amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div><span className="text-slate-400">Amount Paid:</span><span className="font-medium ml-1">₦{parseFloat(selectedPo.amount_paid || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div><span className="text-slate-400">Balance:</span><span className="font-bold ml-1 text-emerald-600">₦{poBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>

                <div className="mt-3">
                  <span className="text-xs font-semibold text-slate-500">Previous Payments</span>
                  {poPayments.length > 0 ? (
                    <ul className="mt-1 divide-y divide-slate-100 text-xs">
                      {poPayments.map((pmt: any) => (
                        <li key={pmt.id} className="py-1 flex justify-between">
                          <span>{pmt.receipt_number}</span>
                          <span>₦{parseFloat(pmt.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                    <Wallet className="h-4 w-4 text-slate-400" />
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
                    className={`w-full px-3 py-2 text-sm border rounded-xl ${isAmountInvalid ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
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
                  {isAmountInvalid && <p className="text-xs text-red-600 mt-1">Amount exceeds outstanding balance of ₦{poBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}.</p>}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Amount ({baseCurrency}) <span className="text-red-400 normal-case">*</span>
                </label>
                <input
                  type="number" step="0.01" min="0.01"
                  max={selectedPo ? poBalance : undefined}
                  value={form.amount}
                  onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  disabled={!selectedPo}
                  className={`w-full px-3 py-2 text-sm border rounded-xl disabled:bg-slate-50 disabled:text-slate-400 ${isAmountInvalid ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder={selectedPo ? `Max: ₦${poBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Select a purchase order first'}
                />
                {isAmountInvalid && <p className="text-xs text-red-600 mt-1">Amount exceeds outstanding balance.</p>}
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
                onClick={() => router.push('/dashboard/staff/finance/supplier-payments')}
                className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !canSubmit}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Payment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}