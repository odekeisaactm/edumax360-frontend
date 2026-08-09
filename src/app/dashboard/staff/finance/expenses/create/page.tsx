'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  expenseAPI,
  expenseCategoriesAPI,
  bankDetailsAPI,
  financeSettingsAPI,
  staffAPI,
} from '@/lib/api';
import type {
  ExpenseCategory,
  SchoolBankDetail,
  FinanceSettings,
  GeneralPaymentMethod,
} from '@/lib/finance.types';
import {
  ArrowDownRight, ArrowLeft, Check, AlertCircle, Loader2, UploadCloud,
  DollarSign, Wallet, FileText, Tag, Lock, ChevronDown, ChevronUp,
  Plus, Trash2, UserCheck, CreditCard, Layers, ListPlus, X, Search,
} from 'lucide-react';

// ─── Interfaces & Types ────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

interface LineItem {
  id: string;
  date: string;
  particular: string;
  amount: string;
}

interface StaffOption {
  id: number;
  full_name: string;
  staff_id: string;
  department_name?: string;
}

function extractErrorMessage(err: any): string {
  const d = err?.response?.data || err?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.error) return String(d.error);
    if (Array.isArray(d.non_field_errors) && d.non_field_errors.length > 0) return String(d.non_field_errors[0]);

    if (typeof d === 'object') {
      const messages: string[] = [];
      for (const [key, val] of Object.entries(d)) {
        if (Array.isArray(val) && val.length > 0) {
          const fieldLabel = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
          messages.push(`${fieldLabel}: ${val[0]}`);
        } else if (typeof val === 'string') {
          messages.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${val}`);
        }
      }
      if (messages.length > 0) return messages.join(' | ');
    }
  }
  return err?.message || 'An unexpected error occurred while communicating with the server.';
}

function titleCase(str: string): string {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Searchable Category Picker ────────────────────────────────────────────────
function CategoryPicker({
  label, value, onChange, categories, placeholder = 'Search category...'
}: {
  label: string; value: number | ''; onChange: (id: number | '') => void;
  categories: ExpenseCategory[]; placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCategory = useMemo(() => categories.find(c => c.id === Number(value)), [categories, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  }, [categories, search]);

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label} <span className="text-red-500">*</span></label>
      {selectedCategory ? (
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800">
          <div className="min-w-0"><span className="font-bold truncate">{titleCase(selectedCategory.name)}</span></div>
          <button type="button" onClick={() => onChange('')} className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <div>
          <div onClick={() => setIsOpen(!isOpen)} className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-400 cursor-pointer flex items-center justify-between hover:border-slate-300 transition-colors">
            <span className="truncate">{placeholder}</span><ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <Search className="h-4 w-4 text-slate-400 ml-1 shrink-0" />
                <input type="text" placeholder="Type to filter categories..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent text-xs outline-none font-medium text-slate-700 py-1" autoFocus />
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-medium">No matches found</div>
                ) : (
                  filtered.map(c => (
                    <button key={c.id} type="button" onClick={() => { onChange(c.id); setIsOpen(false); setSearch(''); }} className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 flex items-center justify-between transition-colors">
                      <span className="font-bold text-slate-800 truncate pr-2">{titleCase(c.name)}</span>
                      {c.description && <span className="text-[10px] text-slate-400 truncate max-w-[120px] hidden sm:block">{c.description}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Searchable Staff Autocomplete Picker ─────────────────────────────────────
function StaffPicker({
  label, value, onChange, staffList, placeholder = 'Search & select staff...',
}: {
  label: string; value: number | ''; onChange: (id: number | '') => void; staffList: StaffOption[]; placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedStaff = useMemo(() => staffList.find(s => s.id === Number(value)), [staffList, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return staffList.slice(0, 8);
    const q = search.toLowerCase();
    return staffList.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      (s.staff_id && s.staff_id.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [staffList, search]);

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      {selectedStaff ? (
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800">
          <div className="min-w-0">
            <span className="font-bold">{selectedStaff.full_name}</span>
            <span className="text-xs text-slate-400 ml-1.5 font-mono">({selectedStaff.staff_id})</span>
          </div>
          <button type="button" onClick={() => onChange('')} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div>
          <div onClick={() => setIsOpen(!isOpen)} className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-400 cursor-pointer flex items-center justify-between hover:border-slate-300">
            <span className="truncate">{placeholder}</span><ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <Search className="h-4 w-4 text-slate-400 ml-1" />
                <input type="text" placeholder="Search staff name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent text-xs outline-none font-medium text-slate-700" autoFocus />
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-medium">No staff matches found</div>
                ) : (
                  filtered.map(s => (
                    <button key={s.id} type="button" onClick={() => { onChange(s.id); setIsOpen(false); setSearch(''); }} className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 flex items-center justify-between transition-colors">
                      <span className="font-bold text-slate-800">{s.full_name}</span>
                      <span className="font-mono text-[11px] text-slate-400">{s.staff_id}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function ExpenseCreatePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [banks, setBanks] = useState<SchoolBankDetail[]>([]);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Core Form State
  const [category, setCategory] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<GeneralPaymentMethod>('bank_transfer');
  const [bankAccount, setBankAccount] = useState<number | ''>('');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Multi-Currency State
  const [selectedCurrency, setSelectedCurrency] = useState<string>('NGN');
  const [amount, setAmount] = useState<string>('');
  const [foreignAmount, setForeignAmount] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('');

  // Itemized Breakdown State
  const [useLineItems, setUseLineItems] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Advanced Voucher Accordion State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [reference, setReference] = useState<string>('');
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');
  const [voteAndSubhead, setVoteAndSubhead] = useState<string>('');
  const [preparedBy, setPreparedBy] = useState<number | ''>('');
  const [authorisedBy, setAuthorisedBy] = useState<number | ''>('');
  const [collectedBy, setCollectedBy] = useState<number | ''>('');
  const [collectedByOther, setCollectedByOther] = useState<string>('');

  // Cheque Details State
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeBy, setChequeBy] = useState('');
  const [chequePreparedDate, setChequePreparedDate] = useState('');
  const [chequeSignedDate, setChequeSignedDate] = useState('');

  // UI & Persistence State - Default to 'detail'
  const [postSubmitAction, setPostSubmitAction] = useState<'list' | 'create_another' | 'detail'>('detail');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  function getattrUserStaffId(u: any): string {
    return u?.staff_profile?.staff_id || u?.profile?.staff_id || u?.staff_id || '';
  }

  const fetchReferences = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const [catsRes, banksRes, settingsRes, staffRes] = await Promise.all([
        expenseCategoriesAPI.list({ page_size: 1000 }).catch(() => []),
        bankDetailsAPI.list({ is_active: true }).catch(() => []),
        financeSettingsAPI.get().catch(() => null),
        staffAPI.list({ page_size: 500 }).catch(() => []),
      ]);

      const listCats = Array.isArray(catsRes) ? catsRes : (catsRes as any)?.results || [];
      const listBanks = Array.isArray(banksRes) ? banksRes : (banksRes as any)?.results || [];
      const listStaff = Array.isArray(staffRes) ? staffRes : (staffRes as any)?.results || [];

      setCategories(listCats.filter((c: any) => c && c.is_active));
      setBanks(listBanks);
      setSettings(settingsRes);

      const formattedStaff = listStaff.map((s: any) => ({
        id: s.id,
        full_name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.username || 'Staff Member',
        staff_id: s.staff_id || `STAFF-${s.id}`,
        department_name: s.department_name || s.department?.name,
      }));
      setStaffList(formattedStaff);

      if (settingsRes?.currency_config?.base_currency) {
        setSelectedCurrency(settingsRes.currency_config.base_currency);
      }

      if (user) {
        const match = formattedStaff.find((s: any) => s.staff_id === getattrUserStaffId(user));
        if (match) setPreparedBy(match.id);
      }
    } catch (err: any) {
      showToast('error', extractErrorMessage(err));
    } finally {
      setLoadingRefs(false);
    }
  }, [user]);

  useEffect(() => { fetchReferences(); }, [fetchReferences]);

  const baseCurrencyCode = settings?.currency_config?.base_currency || 'NGN';
  const isForeign = !!settings?.strict_multi_currency && selectedCurrency !== baseCurrencyCode;

  // 2. Strict Currency Locking Rules
  useEffect(() => {
    if (!baseCurrencyCode) return;

    if (paymentMethod === 'cash') {
      setSelectedCurrency(baseCurrencyCode);
      setForeignAmount('');
      setExchangeRate('');
    } else if (bankAccount) {
      const selectedBank = banks.find(b => b.id === Number(bankAccount));
      const targetCurrency = selectedBank?.currency || baseCurrencyCode;
      setSelectedCurrency(targetCurrency);

      if (targetCurrency === baseCurrencyCode) {
        setForeignAmount('');
        setExchangeRate('');
      } else {
        const cfg = settings?.currency_config?.supported_currencies?.[targetCurrency];
        const rateStr = cfg?.rate_to_base ? String(cfg.rate_to_base) : '1';
        setExchangeRate(rateStr);
        if (foreignAmount && !useLineItems) {
          const calcBase = parseFloat(foreignAmount) * parseFloat(rateStr);
          setAmount(calcBase.toFixed(2));
        }
      }
    }
  }, [paymentMethod, bankAccount, banks, baseCurrencyCode, settings, foreignAmount, useLineItems]);

  const handleForeignAmountChange = (val: string) => {
    if (useLineItems) return;
    setForeignAmount(val);
    const numForeign = parseFloat(val);
    const numRate = parseFloat(exchangeRate);
    if (!isNaN(numForeign) && !isNaN(numRate) && numRate > 0) {
      setAmount((numForeign * numRate).toFixed(2));
    } else {
      setAmount('');
    }
  };

  const handleMethodChange = (method: GeneralPaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'cash') setBankAccount('');
  };

  // ─── DYNAMIC LINE ITEMS SUMMATION ───
  useEffect(() => {
    if (!useLineItems) return;
    const total = lineItems.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

    if (total > 0) {
      if (isForeign) {
        setForeignAmount(total.toFixed(2));
        const numRate = parseFloat(exchangeRate);
        if (!isNaN(numRate) && numRate > 0) {
          setAmount((total * numRate).toFixed(2));
        } else {
          setAmount('');
        }
      } else {
        setAmount(total.toFixed(2));
        setForeignAmount('');
      }
    } else {
      setAmount('');
      setForeignAmount('');
    }
  }, [lineItems, useLineItems, isForeign, exchangeRate]);

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: Math.random().toString(36).substring(2, 9), date: expenseDate, particular: '', amount: '' }]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, val: string) => {
    setLineItems(prev => prev.map(item => (item.id === id ? { ...item, [field]: val } : item)));
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExts.includes(ext)) {
      showToast('error', `File extension "${ext}" is not allowed. Allowed extensions are: pdf, jpg, jpeg, png.`);
      e.target.value = ''; return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Receipt file size must not exceed 5MB.');
      e.target.value = ''; return;
    }
    setReceiptFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return showToast('error', 'Please select an expenditure category.');
    if (!amount || parseFloat(amount) <= 0) return showToast('error', 'Expenditure amount must be greater than zero.');
    if (paymentMethod !== 'cash' && !bankAccount && settings?.track_bank_balance) {
      return showToast('error', `A commercial bank account is strictly required when payment method is ${paymentMethod}.`);
    }
    if (paymentMethod !== 'cash' && settings?.require_proof_for_funding && !receiptFile) {
      return showToast('error', 'School policy strictly mandates uploading a supporting receipt / document for non-cash expenditure.');
    }
    if (useLineItems) {
      const invalid = lineItems.some(i => !i.particular.trim() || !(parseFloat(i.amount) > 0));
      if (invalid) return showToast('error', 'Please complete all line item descriptions and valid amounts or remove empty rows.');
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('category', String(category));
      formData.append('amount', amount);
      formData.append('payment_method', paymentMethod);
      formData.append('expense_date', expenseDate);

      if (paymentMethod !== 'cash' && bankAccount) formData.append('bank_account', String(bankAccount));
      if (isForeign && foreignAmount && exchangeRate) {
        formData.append('foreign_currency', selectedCurrency);
        formData.append('foreign_amount', foreignAmount);
        formData.append('exchange_rate', exchangeRate);
      }
      if (description.trim()) formData.append('description', description.trim());
      if (notes.trim()) formData.append('notes', notes.trim());
      if (receiptFile) formData.append('receipt', receiptFile);

      if (reference.trim()) formData.append('reference', reference.trim());
      if (beneficiaryName.trim()) formData.append('name', beneficiaryName.trim());
      if (voteAndSubhead.trim()) formData.append('vote_and_subhead', voteAndSubhead.trim());

      if (preparedBy) formData.append('prepared_by', String(preparedBy));
      if (authorisedBy) formData.append('authorised_by', String(authorisedBy));
      if (collectedBy) formData.append('collected_by', String(collectedBy));
      if (collectedByOther.trim()) formData.append('collected_by_other', collectedByOther.trim());

      if (chequeNumber.trim()) formData.append('cheque_number', chequeNumber.trim());
      if (bankName.trim()) formData.append('bank_name', bankName.trim());
      if (chequeBy.trim()) formData.append('cheque_by', chequeBy.trim());
      if (chequePreparedDate) formData.append('cheque_prepared_date', chequePreparedDate);
      if (chequeSignedDate) formData.append('cheque_signed_date', chequeSignedDate);

      if (useLineItems && lineItems.length > 0) {
        const cleanItems = lineItems.map(i => ({
          date: i.date || expenseDate,
          particular: i.particular.trim(),
          amount: parseFloat(i.amount).toFixed(2),
        }));
        formData.append('line_items_json', JSON.stringify(cleanItems));
      }

      const created: any = await expenseAPI.create(formData);
      showToast('success', 'Expenditure voucher recorded and bank ledger debited successfully!');

      setTimeout(() => {
        if (postSubmitAction === 'create_another') {
          setAmount(''); setForeignAmount(''); setDescription(''); setNotes(''); setReceiptFile(null);
          setBeneficiaryName(''); setVoteAndSubhead(''); setLineItems([]); setUseLineItems(false);
          setChequeNumber(''); setBankName(''); setChequeBy('');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setIsSubmitting(false);
        } else if (postSubmitAction === 'detail' && created?.id) {
          router.push(`/dashboard/staff/finance/expenses?open_detail=${created.id}`);
        } else {
          router.push('/dashboard/staff/finance/expenses');
        }
      }, 1000);
    } catch (err: any) {
      showToast('error', extractErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  if (loadingRefs) {
    return (
      <div className="p-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto" />
        <p className="mt-2 text-sm text-slate-400">Loading expenditure creation environment...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 px-4 sm:px-0">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownRight className="h-6 w-6 text-red-600" /> Record New Expense
            </h1>
            <p className="text-sm text-slate-400">Log institutional expenditures and generate payment vouchers</p>
          </div>
        </div>
      </div>

      <form id="expense-create-form" onSubmit={handleSubmit} className="space-y-6">

        {/* Card 1: Core Classification */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-red-600" /> Classification & Payment Method
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <CategoryPicker label="Expense Category" value={category} onChange={setCategory} categories={categories} />
            </div>

            <div>
              <label className={labelCls}>Expense Date <span className="text-red-500">*</span></label>
              <input required type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Payment Method <span className="text-red-500">*</span></label>
              <select value={paymentMethod} onChange={e => handleMethodChange(e.target.value as GeneralPaymentMethod)} className={inputCls}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="pos">POS Terminal</option>
                <option value="cash">Physical Cash</option>
                <option value="cheque">Cheque</option>
                <option value="others">Other Disbursement</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Source Account {paymentMethod !== 'cash' && <span className="text-red-500">*</span>}</label>
              {paymentMethod === 'cash' ? (
                <div className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-between">
                  <span>Debiting Assigned Physical Cash Vault</span>
                  <Wallet className="h-4 w-4 text-slate-400" />
                </div>
              ) : (
                <select required={settings?.track_bank_balance} value={bankAccount} onChange={e => setBankAccount(Number(e.target.value))} className={inputCls}>
                  <option value="">Select source bank account...</option>
                  {banks.filter(b => b.account_type !== 'cash_vault').map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} ({b.account_number}) — Bal: {b.currency} {parseFloat(b.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Currency & Amounts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Amount & Currency
            </h3>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
              <Lock className="h-3 w-3 text-slate-400" />
              <span>{isForeign ? 'LOCKED CURRENCY' : 'CURRENCY'}: {isForeign ? selectedCurrency : baseCurrencyCode}</span>
            </div>
          </div>

          {isForeign && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Foreign Amount ({selectedCurrency}) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0.01" required={!useLineItems} disabled={useLineItems} placeholder={`0.00 ${selectedCurrency}`} value={foreignAmount} onChange={e => handleForeignAmountChange(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Direct Conversion Rate (Locked)</label>
                <div className="relative">
                  <input type="text" readOnly disabled value={exchangeRate ? `1 ${selectedCurrency} = ${baseCurrencyCode} ${parseFloat(exchangeRate).toLocaleString()}` : 'No rate defined'} className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-100 text-slate-600 font-semibold pr-10 cursor-not-allowed" />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Expenditure Recorded ({baseCurrencyCode}) <span className="text-red-500">*</span>
              </label>
              {useLineItems && (
                <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  Calculated automatically from itemized rows below
                </span>
              )}
            </div>
            <input type="number" step="0.01" min="0.01" required readOnly={isForeign || useLineItems} placeholder="0.00" value={amount} onChange={e => !isForeign && !useLineItems && setAmount(e.target.value)} className={`${inputCls} text-lg font-bold ${isForeign || useLineItems ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : 'text-slate-900'}`} />
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-3">
                <ListPlus className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Itemized Breakdown (Line Items)</p>
                  <p className="text-xs text-slate-400">Add multiple rows to itemize components with automatic total sum</p>
                </div>
              </div>
              <button type="button" role="switch" aria-checked={useLineItems} onClick={() => { setUseLineItems(!useLineItems); if (!useLineItems && lineItems.length === 0) addLineItem(); }} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${useLineItems ? 'bg-red-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${useLineItems ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {useLineItems && (
              <div className="mt-4 space-y-3 p-4 bg-red-50/30 rounded-xl border border-red-100">
                <div className="grid grid-cols-12 gap-3 px-1 text-xs font-bold text-slate-500 uppercase">
                  <span className="col-span-3 sm:col-span-2">Date</span>
                  <span className="col-span-6 sm:col-span-7">Particular / Component Description</span>
                  <span className="col-span-3 sm:col-span-2 text-right">Amount ({selectedCurrency})</span>
                  <span className="hidden sm:block sm:col-span-1"></span>
                </div>
                {lineItems.map(item => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="col-span-4 sm:col-span-3"><input type="date" value={item.date} onChange={e => updateLineItem(item.id, 'date', e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none" /></div>
                    <div className="col-span-5 sm:col-span-6"><input type="text" placeholder="e.g. Fuel purchase" value={item.particular} onChange={e => updateLineItem(item.id, 'particular', e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none font-medium" /></div>
                    <div className="col-span-3 sm:col-span-2"><input type="number" step="0.01" placeholder="0.00" value={item.amount} onChange={e => updateLineItem(item.id, 'amount', e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none text-right font-bold" /></div>
                    <div className="col-span-12 sm:col-span-1 flex justify-end"><button type="button" onClick={() => removeLineItem(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button></div>
                  </div>
                ))}
                <button type="button" onClick={addLineItem} className="w-full py-2.5 border-2 border-dashed border-red-200 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Add Itemized Row</button>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Supporting Information */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" /> Remarks & Proof
          </h3>

          <div className="grid grid-cols-1 gap-4">
            <div><label className={labelCls}>Expense Description</label><input type="text" placeholder="e.g. Generator maintenance for administrative block" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Internal Notes / Remarks</label><textarea rows={2} placeholder="Additional institutional notes regarding this expenditure..." value={notes} onChange={e => setNotes(e.target.value)} className={inputCls + ' resize-none'} /></div>
            <div>
              <label className={labelCls}>Attach Receipt / Invoice {paymentMethod !== 'cash' && settings?.require_proof_for_funding && <span className="text-red-500">* (Required)</span>}</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-red-400 transition-colors bg-slate-50/50">
                <input type="file" id="receipt-upload" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center">
                  <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm font-semibold text-red-600 hover:text-red-700">Click to upload invoice or bank slip</span>
                  <span className="text-xs text-slate-400 mt-1">Max 5MB (Allowed: PDF, JPG, PNG)</span>
                </label>
                {receiptFile && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
                    <span>Selected: {receiptFile.name}</span><button type="button" onClick={() => setReceiptFile(null)} className="text-red-500 hover:text-red-700 font-bold ml-1">×</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Collapsible Advanced Voucher & Cheque Accordion ── */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="w-full px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between text-left hover:opacity-95 transition-opacity">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-red-400" />
              <div><p className="text-sm font-bold">Advanced Voucher & Cheque Fields</p><p className="text-xs text-slate-400">Configure authorization signatories, beneficiary name, vote head, and cheque details</p></div>
            </div>
            <div className="p-1 rounded-lg bg-white/10 text-white">{showAdvanced ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
          </button>

          {showAdvanced && (
            <div className="p-6 space-y-6 bg-slate-50/40 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-2xs">
                <div><label className={labelCls}>In Favour Of (Beneficiary Name)</label><input type="text" value={beneficiaryName} onChange={e => setBeneficiaryName(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Vote & Sub-head</label><input type="text" value={voteAndSubhead} onChange={e => setVoteAndSubhead(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Voucher Reference Number</label><input type="text" placeholder="Auto-generates if empty" value={reference} onChange={e => setReference(e.target.value)} className={inputCls} /></div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-2xs space-y-4">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2"><UserCheck className="h-4 w-4 text-red-600" /> Signatory Authorization Routing</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StaffPicker label="Prepared By" value={preparedBy} onChange={setPreparedBy} staffList={staffList} placeholder="Search staff who prepared..." />
                  <StaffPicker label="Authorised / Approved By" value={authorisedBy} onChange={setAuthorisedBy} staffList={staffList} placeholder="Search signatory staff..." />
                  <StaffPicker label="Collected By (Internal Staff)" value={collectedBy} onChange={id => { setCollectedBy(id); if (id) setCollectedByOther(''); }} staffList={staffList} placeholder="Select staff collector..." />
                </div>
                <div className="pt-1">
                  <label className={labelCls}>OR External Collector Name (If not internal staff)</label>
                  <input type="text" disabled={!!collectedBy} placeholder={collectedBy ? "Internal staff member selected above" : "Enter full name & ID of vendor/contractor collecting payment..."} value={collectedByOther} onChange={e => setCollectedByOther(e.target.value)} className={`${inputCls} ${collectedBy ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} />
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-2xs space-y-4">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2"><CreditCard className="h-4 w-4 text-red-600" /> Cheque Information (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className={labelCls}>Cheque Number</label><input type="text" value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Cheque Bank Name</label><input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Cheque Issued By</label><input type="text" value={chequeBy} onChange={e => setChequeBy(e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Cheque Prepared Date</label><input type="date" value={chequePreparedDate} onChange={e => setChequePreparedDate(e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Cheque Signed Date</label><input type="date" value={chequeSignedDate} onChange={e => setChequeSignedDate(e.target.value)} className={inputCls} /></div>
                </div>
              </div>
            </div>
          )}
        </div>

      </form>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl py-3 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            <span className="w-full sm:w-auto">After Saving:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="redirectAction" checked={postSubmitAction === 'list'} onChange={() => setPostSubmitAction('list')} className="text-red-600 focus:ring-red-500" />
              Back to List
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="redirectAction" checked={postSubmitAction === 'create_another'} onChange={() => setPostSubmitAction('create_another')} className="text-red-600 focus:ring-red-500" />
              Stay & Record Another
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="redirectAction" checked={postSubmitAction === 'detail'} onChange={() => setPostSubmitAction('detail')} className="text-red-600 focus:ring-red-500" />
              View Voucher
            </label>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button type="button" disabled={isSubmitting} onClick={() => router.back()} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" form="expense-create-form" disabled={isSubmitting} className="px-6 py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-semibold rounded-xl hover:from-red-700 hover:to-rose-700 transition-all shadow-md shadow-red-200 disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Recording...</> : <><Check className="h-4 w-4" /> Save & Post Expense</>}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}