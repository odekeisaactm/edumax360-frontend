'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { financeSettingsAPI } from '@/lib/api';
import type { FinanceSettings } from '@/lib/finance.types';
import {
  Settings,
  Edit3,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Loader2,
  DollarSign,
  Wallet,
  FileText,
  Building,
  Tag,
  Coins,
  Receipt,
  Mail,
  Plus,
  Trash2,
  Star,
  Zap,
  RotateCcw,
  ArrowRightLeft,
  Users,
  Bell,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

// ─── Types & Presets ───────────────────────────────────────────────────────────

interface CurrencyItem {
  name: string;
  symbol: string;
  rate_to_base: number;
}

interface CurrencyConfig {
  base_currency: string;
  supported_currencies: Record<string, CurrencyItem>;
}

interface CurrencyFormValues {
  code: string;
  name: string;
  symbol: string;
  rate: string;
}

const CURRENCY_PRESETS = [
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', defaultRate: '1.00' },
  { code: 'USD', name: 'US Dollar', symbol: '$', defaultRate: '1500.00' },
  { code: 'EUR', name: 'Euro', symbol: '€', defaultRate: '1620.00' },
  { code: 'GBP', name: 'British Pound', symbol: '£', defaultRate: '1900.00' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', defaultRate: '105.00' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', defaultRate: '11.50' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', defaultRate: '80.00' },
];

const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  base_currency: 'NGN',
  supported_currencies: {
    NGN: { name: 'Nigerian Naira', symbol: '₦', rate_to_base: 1.0 },
  },
};

const DEFAULT_FORM: FinanceSettings = {
  allow_partial_payments: true,
  send_payment_receipt_email: true,
  require_proof_for_funding: false,
  auto_confirm_funding: false,
  max_funding_amount: null,
  reversal_window_hours: 24,
  allow_inter_field_transfer: true,
  allow_sibling_transfer: true,
  notification_emails: [],
  voucher_prefix: 'EXP',
  default_expense_payment_method: 'cash',
  track_bank_balance: true,
  strict_multi_currency: false,
  updated_at: '',
  updated_by: null,
  currency_config: DEFAULT_CURRENCY_CONFIG,
};

function settingsToForm(s: FinanceSettings): FinanceSettings {
  const cc =
    s.currency_config &&
    Object.keys(s.currency_config.supported_currencies || {}).length > 0
      ? s.currency_config
      : DEFAULT_CURRENCY_CONFIG;

  return {
    ...DEFAULT_FORM,
    ...s,
    notification_emails: Array.isArray(s.notification_emails) ? s.notification_emails : [],
    currency_config: cc,
  };
}

// ─── Reusable Components ───────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-colors">
      <div className="flex-1 pr-4">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 flex-shrink-0 ${
          checked ? 'bg-emerald-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function StatusBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        value ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {value ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function SettingRow({
  icon: Icon,
  iconBg,
  label,
  value,
  description,
}: {
  icon: any;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3.5 py-3 px-3.5 hover:bg-slate-50/80 rounded-xl transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="flex-shrink-0">{value}</div>
    </div>
  );
}

const inputCls =
  'w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white font-medium text-slate-800 shadow-sm';
const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5';

// ─── Currency Tab Component ────────────────────────────────────────────────────

function CurrencyTab({
  config,
  strictMultiCurrency,
  onStrictToggle,
  onChange,
}: {
  config: CurrencyConfig;
  strictMultiCurrency: boolean;
  onStrictToggle: (v: boolean) => void;
  onChange: (newConfig: CurrencyConfig) => void;
}) {
  const [newCurrency, setNewCurrency] = useState<CurrencyFormValues>({
    code: '',
    name: '',
    symbol: '',
    rate: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { base_currency, supported_currencies = {} } = config;

  const handleSelectPreset = (preset: (typeof CURRENCY_PRESETS)[number]) => {
    setError(null);
    setNewCurrency({
      code: preset.code,
      name: preset.name,
      symbol: preset.symbol,
      rate: base_currency === preset.code || !base_currency ? '1.00' : preset.defaultRate,
    });
  };

  const handleAddCurrency = () => {
    setError(null);
    const code = newCurrency.code.trim().toUpperCase();

    if (!code) {
      setError('Please enter a currency code (e.g., NGN, USD).');
      return;
    }
    if (supported_currencies[code]) {
      setError(`Currency "${code}" is already configured.`);
      return;
    }
    if (!newCurrency.name.trim() || !newCurrency.symbol.trim()) {
      setError('Currency name and symbol are required.');
      return;
    }
    const rate = parseFloat(newCurrency.rate);
    if (isNaN(rate) || rate <= 0) {
      setError('Exchange rate must be greater than zero.');
      return;
    }

    const updatedCurrencies = {
      ...supported_currencies,
      [code]: {
        name: newCurrency.name.trim(),
        symbol: newCurrency.symbol.trim(),
        rate_to_base: rate,
      },
    };

    const newBase = base_currency || code;

    onChange({
      base_currency: newBase,
      supported_currencies: updatedCurrencies,
    });

    setNewCurrency({ code: '', name: '', symbol: '', rate: '' });
  };

  const handleRateChange = (code: string, newRateStr: string) => {
    const rate = parseFloat(newRateStr);
    if (isNaN(rate) || rate <= 0) return;

    const updated = {
      ...supported_currencies,
      [code]: {
        ...supported_currencies[code],
        rate_to_base: rate,
      },
    };
    onChange({
      base_currency,
      supported_currencies: updated,
    });
  };

  const handleRemoveCurrency = (code: string) => {
    if (code === base_currency) {
      setError('Cannot remove the base currency. Please designate another currency as base first.');
      return;
    }
    const { [code]: _, ...rest } = supported_currencies;
    onChange({
      base_currency,
      supported_currencies: rest,
    });
  };

  const handleSetBase = (code: string) => {
    setError(null);
    const updated = { ...supported_currencies };
    if (updated[code]) {
      updated[code] = { ...updated[code], rate_to_base: 1.0 };
    }
    onChange({
      base_currency: code,
      supported_currencies: updated,
    });
  };

  const currencyEntries = Object.entries(supported_currencies);

  return (
    <div className="space-y-5">
      <Toggle
        checked={strictMultiCurrency}
        onChange={onStrictToggle}
        label="Enforce Strict Multi-Currency Ledger"
        description="Enforces logging explicit foreign amounts and exchange rates for international fee payments and expenses."
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quick Add Presets */}
      <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
          <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" /> Click Preset to Populate Form
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CURRENCY_PRESETS.map((preset) => {
            const isAdded = Boolean(supported_currencies[preset.code]);
            return (
              <button
                key={preset.code}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                disabled={isAdded}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isAdded
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-emerald-700 border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white'
                }`}
              >
                <span>{preset.symbol}</span>
                <span>{preset.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Input */}
      <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className={labelCls}>Code</label>
          <input
            type="text"
            placeholder="e.g. NGN"
            value={newCurrency.code}
            onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Name</label>
          <input
            type="text"
            placeholder="e.g. Naira"
            value={newCurrency.name}
            onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Symbol</label>
          <input
            type="text"
            placeholder="e.g. ₦"
            value={newCurrency.symbol}
            onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelCls}>Rate to Base</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="1.00"
              value={newCurrency.rate}
              onChange={(e) => setNewCurrency({ ...newCurrency, rate: e.target.value })}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={handleAddCurrency}
            className="px-4 py-2 bg-emerald-600 text-white font-semibold text-sm rounded-xl hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center h-10 mt-auto"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Currency Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider py-3 px-4">Code</th>
              <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider py-3 px-4">Name</th>
              <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider py-3 px-4">Symbol</th>
              <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider py-3 px-4 w-36">Conversion Rate</th>
              <th className="text-center text-xs font-bold text-slate-600 uppercase tracking-wider py-3 px-4">Status</th>
              <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wider py-3 px-4">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {currencyEntries.map(([code, details]) => {
              const isBase = code === base_currency;
              return (
                <tr key={code} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 text-sm font-mono font-bold text-slate-800">{code}</td>
                  <td className="py-3 px-4 text-sm font-medium text-slate-700">{details.name}</td>
                  <td className="py-3 px-4 text-sm font-semibold text-slate-800">{details.symbol}</td>
                  <td className="py-2 px-4">
                    {isBase ? (
                      <span className="text-sm font-mono font-bold text-slate-600">1.00 (Base)</span>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={details.rate_to_base}
                        onBlur={(e) => handleRateChange(code, e.target.value)}
                        className="w-24 px-2.5 py-1 text-sm font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {isBase ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                        <Star className="h-3 w-3 fill-current" /> Base Currency
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetBase(code)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold underline underline-offset-2"
                      >
                        Make Base
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveCurrency(code)}
                      disabled={isBase}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isBase ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50 hover:text-red-700'
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Settings Modal Component ──────────────────────────────────────────────────

function SettingsModal({
  settings,
  isSaving,
  onSave,
  onClose,
}: {
  settings: FinanceSettings | null;
  isSaving: boolean;
  onSave: (f: FinanceSettings) => Promise<void>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'funding' | 'procurement' | 'currency'>('general');
  const [form, setForm] = useState<FinanceSettings>(
    settings ? settingsToForm(settings) : settingsToForm(DEFAULT_FORM)
  );
  // Temporary string state for comma-separated emails input
  const [emailsInput, setEmailsInput] = useState<string>(
    Array.isArray(settings?.notification_emails) ? settings.notification_emails.join(', ') : ''
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  // State to intercept track_bank_balance toggle and display confirmation modal
  const [pendingStrictToggle, setPendingStrictToggle] = useState<boolean | null>(null);

  const set = <K extends keyof FinanceSettings>(key: K, value: FinanceSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const cc = form.currency_config;
    if (!cc || !cc.base_currency || Object.keys(cc.supported_currencies || {}).length === 0) {
      setSaveError('Please configure at least one currency and designate a base currency before saving.');
      setActiveTab('currency');
      return;
    }

    // Convert comma-separated string back to clean string array before save
    const parsedEmails = emailsInput
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    try {
      await onSave({
        ...form,
        notification_emails: parsedEmails,
      });
    } catch (err: any) {
      const data = err?.response?.data;
      setSaveError(data?.detail || data?.message || err?.message || 'Failed to save settings.');
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General Rules', icon: Settings },
    { id: 'funding' as const, label: 'Wallet Funding', icon: Wallet },
    { id: 'procurement' as const, label: 'Vouchers & Pay', icon: Receipt },
    { id: 'currency' as const, label: 'Currencies', icon: Coins },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      {/* ── Mini Confirmation Modal for Strict Bank Tracking Toggle ── */}
      {pendingStrictToggle !== null && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 text-center space-y-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                pendingStrictToggle ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
              }`}
            >
              {pendingStrictToggle ? (
                <Building className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">
                {pendingStrictToggle
                  ? 'Enable Strict Bank Tracking?'
                  : 'Disable Strict Bank Tracking?'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                {pendingStrictToggle
                  ? 'Enabling Strict Bank Tracking enforces mandatory bank account selection on all non-cash incomes and expenses. You may need to review or adjust your active bank account balances first to ensure your ledgers tally accurately.'
                  : 'Disabling Strict Bank Tracking means new income and expense entries will no longer automatically update your linked bank account ledgers or require an associated bank account. This may cause physical and software balances to drift out of sync.'}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingStrictToggle(null)}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  set('track_bank_balance', pendingStrictToggle);
                  setPendingStrictToggle(null);
                }}
                className={`flex-1 py-2.5 px-4 text-xs font-bold text-white rounded-xl shadow-md transition-all ${
                  pendingStrictToggle
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                }`}
              >
                I Understand, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[500px] flex flex-col border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 text-white">
            <Settings className="h-5 w-5" />
            <h3 className="text-base font-bold">
              {settings ? 'Update Finance Settings' : 'Initialize Finance Settings'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Banner */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 flex-shrink-0 gap-4 overflow-x-auto bg-slate-50/50">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 py-3.5 text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.id
                  ? 'text-emerald-600 border-emerald-600'
                  : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable Form Body */}
        <form id="settings-form" onSubmit={handleSubmit} className="overflow-y-auto p-6 flex-1 space-y-5">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <Toggle
                checked={form.allow_partial_payments}
                onChange={(v) => set('allow_partial_payments', v)}
                label="Allow Partial Fee Payments"
                description="Parents and students can pay invoices in flexible installments over time."
              />
              <Toggle
                checked={form.send_payment_receipt_email}
                onChange={(v) => set('send_payment_receipt_email', v)}
                label="Automate Receipt Emails"
                description="Immediately dispatch PDF payment confirmations to parents upon successful payment."
              />
              <Toggle
                checked={form.track_bank_balance}
                onChange={(newValue) => setPendingStrictToggle(newValue)}
                label="Strict Bank Ledger Tracking"
                description="Automatically post ledger entries against linked school bank accounts on income/expense creation."
              />
            </div>
          )}

          {activeTab === 'funding' && (
            <div className="space-y-4">
              <Toggle
                checked={form.require_proof_for_funding}
                onChange={(v) => set('require_proof_for_funding', v)}
                label="Mandatory Proof of Payment"
                description="Users must attach a bank teller or transaction receipt when submitting wallet deposits."
              />
              <Toggle
                checked={form.auto_confirm_funding}
                onChange={(v) => set('auto_confirm_funding', v)}
                label="Auto-Confirm Wallet Top-ups"
                description="Bypass manual verification and credit student/staff balances instantly upon submission."
              />
              <Toggle
                checked={form.allow_inter_field_transfer}
                onChange={(v) => set('allow_inter_field_transfer', v)}
                label="Cross-Wallet Transfers"
                description="Allow students/staff to transfer funds between their Fee Wallet and Canteen Wallet."
              />
              <Toggle
                checked={form.allow_sibling_transfer}
                onChange={(v) => set('allow_sibling_transfer', v)}
                label="Sibling Peer-to-Peer Transfers"
                description="Allow funds transfers between students linked to the exact same registered parent."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className={labelCls}>Maximum Deposit Ceiling</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.max_funding_amount ?? ''}
                    onChange={(e) => set('max_funding_amount', e.target.value ? e.target.value : null)}
                    placeholder="Unlimited"
                    className={inputCls}
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Safety ceiling per individual wallet top-up transaction.
                  </p>
                </div>

                <div>
                  <label className={labelCls}>Reversal Window (Hours)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.reversal_window_hours ?? 24}
                    onChange={(e) => set('reversal_window_hours', e.target.value ? parseInt(e.target.value, 10) : 0)}
                    placeholder="24"
                    className={inputCls}
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Hours allowed before POS deposit reversals are locked. Set 0 for unlimited.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <label className={labelCls}>Notification Alert Emails (Comma-Separated)</label>
                <input
                  type="text"
                  value={emailsInput}
                  onChange={(e) => setEmailsInput(e.target.value)}
                  placeholder="bursar@school.com, finance@school.com"
                  className={inputCls}
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Email addresses that receive automated alerts when wallet deposits are submitted or confirmed.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'procurement' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Voucher Prefix</label>
                  <input
                    type="text"
                    value={form.voucher_prefix}
                    onChange={(e) => set('voucher_prefix', e.target.value.toUpperCase())}
                    maxLength={8}
                    placeholder="EXP"
                    className={inputCls}
                  />
                  <p className="text-xs text-slate-500 mt-1">Identifier prepended to expense slips.</p>
                </div>
                <div>
                  <label className={labelCls}>Default Payment Method</label>
                  <select
                    value={form.default_expense_payment_method}
                    onChange={(e) => set('default_expense_payment_method', e.target.value as any)}
                    className={inputCls}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card / POS</option>
                    <option value="cheque">Cheque</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Pre-selected option on general expense forms.</p>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                    Live Voucher Preview
                  </p>
                  <p className="text-lg font-mono font-bold text-emerald-900 mt-0.5">
                    {form.voucher_prefix || 'EXP'}-{new Date().getFullYear()}-0001
                  </p>
                </div>
                <Tag className="h-8 w-8 text-emerald-600/30" />
              </div>
            </div>
          )}

          {activeTab === 'currency' && (
            <CurrencyTab
              config={form.currency_config || DEFAULT_CURRENCY_CONFIG}
              strictMultiCurrency={form.strict_multi_currency}
              onStrictToggle={(v) => set('strict_multi_currency', v)}
              onChange={(newConfig) => set('currency_config', newConfig)}
            />
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="settings-form"
            disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> {settings ? 'Save Preferences' : 'Initialize Module'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page View ────────────────────────────────────────────────────────────

export default function FinanceSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canEdit = user?.is_superuser || hasPermission('finance.change_financesettingmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeSettingsAPI.get();
      setFinanceSettings(data);
    } catch {
      // API service safely returns null on 404
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (form: FinanceSettings) => {
    setIsSaving(true);
    try {
      const updated = financeSettings
        ? await financeSettingsAPI.update(form)
        : await financeSettingsAPI.create(form);
      setFinanceSettings(updated);
      setIsEditing(false);
      setToast('Finance settings successfully updated!');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!financeSettings) {
    return (
      <>
        {isEditing && (
          <SettingsModal
            settings={null}
            isSaving={isSaving}
            onSave={handleSave}
            onClose={() => setIsEditing(false)}
          />
        )}
        <div className="min-h-[550px] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
              <DollarSign className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Initialize Finance Module</h3>
              <p className="text-sm text-slate-500 mt-1">
                Configure your school's base currency, voucher numbering, deposit verification policies, and general accounting rules to activate financial operations.
              </p>
            </div>
            {canEdit ? (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" /> Initialize Settings
              </button>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl font-semibold">
                You lack admin privileges to initialize module settings.
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  const s = financeSettings;
  const baseCurrency = s.currency_config?.base_currency || 'NGN';
  const notificationEmails = Array.isArray(s.notification_emails) ? s.notification_emails : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in text-sm font-medium">
          <Check className="h-4 w-4 text-emerald-400" /> {toast}
        </div>
      )}

      {isEditing && (
        <SettingsModal
          settings={s}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-200">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Finance Preferences</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage operational rules, currencies, and voucher numbering prefixes
            </p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Edit3 className="h-4 w-4" /> Modify Preferences
          </button>
        )}
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Base Currency</p>
            <p className="text-base font-bold text-slate-900">{baseCurrency}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Voucher Prefix</p>
            <p className="text-base font-bold font-mono text-slate-900">{s.voucher_prefix}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Bank Tracking</p>
            <p className="text-base font-bold text-slate-900">
              {s.track_bank_balance ? 'Strict' : 'Disabled'}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Auto-Confirm</p>
            <p className="text-base font-bold text-slate-900">
              {s.auto_confirm_funding ? 'Active' : 'Manual'}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-100 font-bold text-sm text-slate-800 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-600" /> Operational & Payment Rules
          </div>
          <div className="p-2 divide-y divide-slate-100">
            <SettingRow
              icon={Receipt}
              iconBg="bg-emerald-50 text-emerald-600"
              label="Installment Payments"
              description="Allow partial fee settlement"
              value={<StatusBadge value={s.allow_partial_payments} />}
            />
            <SettingRow
              icon={Mail}
              iconBg="bg-blue-50 text-blue-600"
              label="Receipt Dispatch"
              description="Send PDF receipt email on payment"
              value={<StatusBadge value={s.send_payment_receipt_email} />}
            />
            <SettingRow
              icon={Building}
              iconBg="bg-indigo-50 text-indigo-600"
              label="Strict Bank Tracking"
              description="Sync bank ledgers automatically"
              value={<StatusBadge value={s.track_bank_balance} />}
            />
            <SettingRow
              icon={Coins}
              iconBg="bg-amber-50 text-amber-600"
              label="Strict Multi-Currency"
              description="Enforce conversion rate logging"
              value={<StatusBadge value={s.strict_multi_currency} />}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-100 font-bold text-sm text-slate-800 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-teal-600" /> Wallet Funding & Transfers
          </div>
          <div className="p-2 divide-y divide-slate-100">
            <SettingRow
              icon={FileText}
              iconBg="bg-amber-50 text-amber-600"
              label="Teller Attachment"
              description="Require deposit proof upload"
              value={<StatusBadge value={s.require_proof_for_funding} />}
            />
            <SettingRow
              icon={Zap}
              iconBg="bg-teal-50 text-teal-600"
              label="Instant Verification"
              description="Auto-confirm deposit submissions"
              value={<StatusBadge value={s.auto_confirm_funding} />}
            />
            <SettingRow
              icon={ArrowRightLeft}
              iconBg="bg-blue-50 text-blue-600"
              label="Cross-Wallet Transfers"
              description="Allow moving funds between Fee & Canteen"
              value={<StatusBadge value={s.allow_inter_field_transfer} />}
            />
            <SettingRow
              icon={Users}
              iconBg="bg-purple-50 text-purple-600"
              label="Sibling Transfers"
              description="Allow peer-to-peer sibling balance moves"
              value={<StatusBadge value={s.allow_sibling_transfer} />}
            />
            <SettingRow
              icon={Receipt}
              iconBg="bg-rose-50 text-rose-600"
              label="Deposit Ceiling"
              description="Transaction maximum safety limit"
              value={
                <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                  {s.max_funding_amount ? `₦${Number(s.max_funding_amount).toLocaleString()}` : 'Unlimited'}
                </span>
              }
            />
            <SettingRow
              icon={RotateCcw}
              iconBg="bg-indigo-50 text-indigo-600"
              label="Reversal Grace Window"
              description="Allowed timeframe for mistake reversals"
              value={
                <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                  {s.reversal_window_hours && s.reversal_window_hours > 0
                    ? `${s.reversal_window_hours} hr${s.reversal_window_hours === 1 ? '' : 's'}`
                    : 'Unlimited'}
                </span>
              }
            />
            <SettingRow
              icon={Bell}
              iconBg="bg-emerald-50 text-emerald-600"
              label="Notification Alerts"
              description="Emails notified on wallet activity"
              value={
                notificationEmails.length === 0 ? (
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                    None Configured
                  </span>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    {notificationEmails.map((email, idx) => (
                      <span
                        key={idx}
                        className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                      >
                        {email}
                      </span>
                    ))}
                  </div>
                )
              }
            />
          </div>
        </div>

        {/* ── Supported Currencies Overview Card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <Coins className="h-4 w-4 text-emerald-600" /> Active Currencies & Exchange Rates
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-200/60 px-2.5 py-1 rounded-full">
              Base: {s.currency_config?.base_currency || 'NGN'}
            </span>
          </div>

          <div className="p-4">
            {!s.currency_config?.supported_currencies ||
            Object.keys(s.currency_config.supported_currencies).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4 italic">
                No currencies configured yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(s.currency_config.supported_currencies).map(([code, details]) => {
                  const isBase = code === s.currency_config.base_currency;
                  return (
                    <div
                      key={code}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                        isBase
                          ? 'bg-emerald-50/40 border-emerald-200/80'
                          : 'bg-slate-50/50 border-slate-200/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                            isBase
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {details.symbol}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-sm text-slate-900">{code}</span>
                            {isBase && (
                              <span className="text-[10px] uppercase tracking-wider font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                Base
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium truncate max-w-[120px]">
                            {details.name}
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-mono text-sm font-bold text-slate-700">
                        {isBase ? '1.00' : Number(details.rate_to_base).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}