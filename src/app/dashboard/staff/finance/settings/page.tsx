'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { financeSettingsAPI } from '@/lib/api';
import { FinanceSettings } from '@/lib/types';
import {
  Settings,
  Edit3,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Loader2,
  RefreshCw,
  DollarSign,
  Wallet,
  CreditCard,
  FileText,
  Building,
  Tag,
  Coins,
  Globe,
  Receipt,
  Banknote,
  Mail,
  TrendingUp,
  TrendingDown,
  Percent,
} from 'lucide-react';

// ─── Default form values ───────────────────────────────────────────────────────
const DEFAULT_FORM: FinanceSettings = {
  allow_partial_payments: true,
  send_payment_receipt_email: true,
  default_currency: 'naira',
  require_proof_for_funding: false,
  auto_confirm_funding: false,
  max_funding_amount: null,
  voucher_prefix: 'EXP',
  default_expense_payment_method: 'cash',
  updated_at: '',
};

function settingsToForm(s: FinanceSettings): FinanceSettings {
  return {
    allow_partial_payments: s.allow_partial_payments ?? true,
    send_payment_receipt_email: s.send_payment_receipt_email ?? true,
    default_currency: s.default_currency ?? 'naira',
    require_proof_for_funding: s.require_proof_for_funding ?? false,
    auto_confirm_funding: s.auto_confirm_funding ?? false,
    max_funding_amount: s.max_funding_amount ?? null,
    voucher_prefix: s.voucher_prefix ?? 'EXP',
    default_expense_payment_method: s.default_expense_payment_method ?? 'cash',
    updated_at: s.updated_at ?? '',
  };
}

// ─── Reusable Toggle ───────────────────────────────────────────────────────────
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
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 flex-shrink-0 ${
          checked ? 'bg-emerald-600' : 'bg-slate-200'
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

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({
  value,
  activeLabel = 'Enabled',
  inactiveLabel = 'Disabled',
  danger = false,
}: {
  value: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  danger?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        value
          ? danger
            ? 'bg-red-100 text-red-700'
            : 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          value ? (danger ? 'bg-red-500' : 'bg-emerald-500') : 'bg-slate-400'
        }`}
      />
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

// ─── Setting Row ───────────────────────────────────────────────────────────────
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
    <div className="flex items-center gap-4 py-3.5 px-4 hover:bg-slate-50/70 rounded-xl transition-colors">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      <div className="flex-shrink-0">{value}</div>
    </div>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

// ─── Settings Modal ────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<
    'general' | 'funding' | 'income_expense' | 'procurement'
  >('general');
  const [form, setForm] = useState<FinanceSettings>(
    settings ? settingsToForm(settings) : DEFAULT_FORM
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof FinanceSettings>(key: K, value: FinanceSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.details) {
        const msgs = Object.entries(data.details)
          .map(([f, m]: [string, any]) =>
            `${f.replace(/_/g, ' ')}: ${Array.isArray(m) ? m.join(', ') : m}`
          )
          .join('\n');
        setSaveError(msgs);
      } else {
        setSaveError(data?.message || err?.message || 'Failed to save finance settings.');
      }
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'funding' as const, label: 'Wallet Funding', icon: Wallet },
    { id: 'income_expense' as const, label: 'Income & Expense', icon: Receipt },
    { id: 'procurement' as const, label: 'Procurement', icon: Building },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {settings ? 'Edit Finance Settings' : 'Create Finance Settings'}
          </h3>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{saveError}</span>
            <button
              onClick={() => setSaveError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 flex-shrink-0 gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.id
                  ? 'text-emerald-600 border-emerald-600'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <form id="finance-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">
            {/* ── General ── */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">General finance preferences and payment rules.</p>
                <div className="grid grid-cols-1 gap-3">
                  <Toggle
                    checked={form.allow_partial_payments}
                    onChange={(v) => set('allow_partial_payments', v)}
                    label="Allow Partial Payments"
                    description="Allow parents to pay part of their fees at a time"
                  />
                  <Toggle
                    checked={form.send_payment_receipt_email}
                    onChange={(v) => set('send_payment_receipt_email', v)}
                    label="Send Payment Receipt Email"
                    description="Automatically email receipt to parent upon payment"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Default Currency</label>
                    <select
                      value={form.default_currency}
                      onChange={(e) => set('default_currency', e.target.value as any)}
                      className={inputCls}
                    >
                      <option value="naira">Naira (NGN)</option>
                      <option value="dollar">Dollar (USD)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                      Pre-selected currency in income/expense forms
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Wallet Funding ── */}
            {activeTab === 'funding' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure wallet funding rules and validation.</p>
                <div className="grid grid-cols-1 gap-3">
                  <Toggle
                    checked={form.require_proof_for_funding}
                    onChange={(v) => set('require_proof_for_funding', v)}
                    label="Require Proof of Payment"
                    description="Force users to upload proof of payment when funding wallets"
                  />
                  <Toggle
                    checked={form.auto_confirm_funding}
                    onChange={(v) => set('auto_confirm_funding', v)}
                    label="Auto-Confirm Funding"
                    description="Automatically confirm and credit wallet immediately after funding"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Max Funding Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.max_funding_amount ?? ''}
                      onChange={(e) =>
                      set('max_funding_amount', e.target.value ? e.target.value : null)
                    }
                      placeholder="Leave blank for no limit"
                      className={inputCls}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Maximum amount allowed per funding transaction
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Income & Expense ── */}
            {activeTab === 'income_expense' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Default values for income and expense records.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Default Expense Payment Method</label>
                    <select
                      value={form.default_expense_payment_method}
                      onChange={(e) =>
                        set('default_expense_payment_method', e.target.value as any)
                      }
                      className={inputCls}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="transfer">Bank Transfer</option>
                      <option value="dollar_pay">Dollar Pay</option>
                      <option value="others">Others</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                      Pre-selected payment method for expenses
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Default Currency</label>
                    <select
                      value={form.default_currency}
                      onChange={(e) => set('default_currency', e.target.value as any)}
                      className={inputCls}
                    >
                      <option value="naira">Naira (NGN)</option>
                      <option value="dollar">Dollar (USD)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                      Pre-selected for income/expense forms
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Voucher Prefix</label>
                    <input
                      type="text"
                      value={form.voucher_prefix}
                      onChange={(e) => set('voucher_prefix', e.target.value)}
                      maxLength={10}
                      placeholder="e.g. EXP"
                      className={inputCls}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Result preview:{' '}
                      <span className="font-mono font-semibold text-slate-600">
                        {form.voucher_prefix || 'EXP'}-{new Date().getFullYear()}-0001
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Procurement ── */}
            {activeTab === 'procurement' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Default values for procurement-related transactions.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Voucher Prefix</label>
                    <input
                      type="text"
                      value={form.voucher_prefix}
                      onChange={(e) => set('voucher_prefix', e.target.value)}
                      maxLength={10}
                      placeholder="e.g. EXP"
                      className={inputCls}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Used for supplier and advance payments
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Default Expense Payment Method</label>
                    <select
                      value={form.default_expense_payment_method}
                      onChange={(e) =>
                        set('default_expense_payment_method', e.target.value as any)
                      }
                      className={inputCls}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="transfer">Bank Transfer</option>
                      <option value="dollar_pay">Dollar Pay</option>
                      <option value="others">Others</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Used for supplier payments</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="finance-settings-form"
            disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {settings ? 'Save Changes' : 'Create Settings'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FinanceSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('finance.change_financesettingmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await financeSettingsAPI.get();
      if (data === null) {
        setPageError('not_found');
        setFinanceSettings(null);
      } else {
        setFinanceSettings(data);
      }
    } catch {
      setPageError('fetch_error');
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
      setPageError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading ──
  if (loading)
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading finance settings...</p>
        </div>
      </div>
    );

  // ── Fetch error ──
  if (pageError === 'fetch_error')
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
          <p className="text-sm text-slate-500">Couldn't load finance settings. Please try again.</p>
          <button
            onClick={fetchSettings}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
        </div>
      </div>
    );

  // ── Not found (first-time setup) ──
  if (pageError === 'not_found' && !financeSettings)
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
        <div className="min-h-[600px] flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto">
              <DollarSign className="h-10 w-10 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure Finance Settings</h3>
              <p className="text-slate-400 text-sm">
                Set up your finance module to manage payments, funding, and expenses for your school.
              </p>
            </div>
            {canEdit ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-200"
              >
                <Sparkles className="h-5 w-5" /> Set Up Finance Settings
              </button>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                You don't have permission to set up finance settings. Please contact an administrator.
              </div>
            )}
          </div>
        </div>
      </>
    );

  const s = financeSettings!;
  const voucherPreview = `${s.voucher_prefix || 'EXP'}-${new Date().getFullYear()}-0001`;
  const currencyDisplay = s.default_currency === 'naira' ? 'Naira (NGN)' : 'Dollar (USD)';
  const paymentMethodDisplay = s.default_expense_payment_method?.replace(/_/g, ' ') ?? 'cash';

  return (
    <div className="space-y-6 pb-10">
      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Finance settings saved successfully!</p>
          </div>
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

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            Finance Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Finance module configuration and preferences</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200"
          >
            <Edit3 className="h-4 w-4" /> Edit Settings
          </button>
        )}
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Default Currency',
            value: currencyDisplay,
            icon: Coins,
            color: 'from-emerald-500 to-emerald-600',
          },
          {
            label: 'Voucher Prefix',
            value: s.voucher_prefix ?? 'EXP',
            icon: Tag,
            color: 'from-teal-500 to-cyan-600',
          },
          {
            label: 'Default Payment Method',
            value: paymentMethodDisplay,
            icon: CreditCard,
            color: 'from-blue-500 to-indigo-600',
          },
          {
            label: 'Auto-Confirm Funding',
            value: s.auto_confirm_funding ? 'Yes' : 'No',
            icon: Wallet,
            color: 'from-amber-500 to-orange-600',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3"
          >
            <div
              className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}
            >
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800 capitalize truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Three cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* General & Wallet Funding */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Settings className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">General & Wallet</h3>
          </div>
          <div className="p-2">
            <SettingRow
              icon={Receipt}
              iconBg="bg-emerald-50 text-emerald-600"
              label="Allow Partial Payments"
              description="Parents can pay fees in installments"
              value={<StatusBadge value={s.allow_partial_payments} />}
            />
            <SettingRow
              icon={Mail}
              iconBg="bg-blue-50 text-blue-600"
              label="Send Payment Receipt Email"
              description="Auto-email receipt on payment confirmation"
              value={<StatusBadge value={s.send_payment_receipt_email} />}
            />
            <SettingRow
              icon={Globe}
              iconBg="bg-purple-50 text-purple-600"
              label="Default Currency"
              description="Pre-selected currency in forms"
              value={
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                  {currencyDisplay}
                </span>
              }
            />
            <SettingRow
              icon={FileText}
              iconBg="bg-amber-50 text-amber-600"
              label="Require Proof of Payment"
              description="Force proof upload for wallet funding"
              value={<StatusBadge value={s.require_proof_for_funding} />}
            />
            <SettingRow
              icon={Wallet}
              iconBg="bg-indigo-50 text-indigo-600"
              label="Auto-Confirm Funding"
              description="Immediately credit wallet on funding"
              value={<StatusBadge value={s.auto_confirm_funding} />}
            />
            <SettingRow
              icon={Banknote}
              iconBg="bg-rose-50 text-rose-600"
              label="Max Funding Amount"
              description="Per-transaction funding limit"
              value={
                <span className="text-xs font-bold text-slate-700">
                  {s.max_funding_amount
                    ? `₦${Number(s.max_funding_amount).toLocaleString()}`
                    : 'No limit'}
                </span>
              }
            />
          </div>
        </div>

        {/* Income & Expense */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
              <Receipt className="h-3.5 w-3.5 text-teal-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Income & Expense</h3>
          </div>
          <div className="p-2">
            <SettingRow
              icon={Coins}
              iconBg="bg-emerald-50 text-emerald-600"
              label="Default Currency"
              description="Pre-selected for income/expense forms"
              value={
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                  {currencyDisplay}
                </span>
              }
            />
            <SettingRow
              icon={CreditCard}
              iconBg="bg-violet-50 text-violet-600"
              label="Default Payment Method"
              description="Pre-selected for expense records"
              value={
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">
                  {paymentMethodDisplay}
                </span>
              }
            />
            <SettingRow
              icon={Tag}
              iconBg="bg-blue-50 text-blue-600"
              label="Voucher Prefix"
              description="Prefix for expense voucher numbers"
              value={
                <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                  {s.voucher_prefix || 'EXP'}
                </span>
              }
            />
          </div>
          {/* Voucher preview */}
          <div className="mx-4 mb-4 mt-2 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
            <p className="text-xs font-semibold text-emerald-700 mb-1 uppercase tracking-wide">
              Voucher Preview
            </p>
            <p className="text-2xl font-mono font-bold text-emerald-800">{voucherPreview}</p>
            <p className="text-xs text-emerald-500 mt-1">Based on current prefix setting</p>
          </div>
        </div>

        {/* Procurement */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Building className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Procurement</h3>
          </div>
          <div className="p-2">
            <SettingRow
              icon={Tag}
              iconBg="bg-blue-50 text-blue-600"
              label="Voucher Prefix"
              description="Used for supplier and advance payments"
              value={
                <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                  {s.voucher_prefix || 'EXP'}
                </span>
              }
            />
            <SettingRow
              icon={CreditCard}
              iconBg="bg-violet-50 text-violet-600"
              label="Default Payment Method"
              description="Pre-selected for supplier payments"
              value={
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">
                  {paymentMethodDisplay}
                </span>
              }
            />
          </div>
        </div>
      </div>

      {/* ── Full settings table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">All Settings</h3>
          <span className="text-xs text-slate-400">Complete configuration overview</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-5">
                  Setting
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">
                  Value
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                {
                  label: 'Allow Partial Payments',
                  value: <StatusBadge value={s.allow_partial_payments} />,
                  desc: 'Allow parents to pay fees in multiple installments',
                },
                {
                  label: 'Send Payment Receipt Email',
                  value: <StatusBadge value={s.send_payment_receipt_email} />,
                  desc: 'Automatically email a receipt to the parent upon payment confirmation',
                },
                {
                  label: 'Default Currency',
                  value: (
                    <span className="text-sm font-semibold text-slate-700">{currencyDisplay}</span>
                  ),
                  desc: 'Pre-selected currency in income and expense forms',
                },
                {
                  label: 'Require Proof of Payment',
                  value: <StatusBadge value={s.require_proof_for_funding} />,
                  desc: 'Force users to upload a proof of payment when funding wallets',
                },
                {
                  label: 'Auto-Confirm Funding',
                  value: <StatusBadge value={s.auto_confirm_funding} />,
                  desc: 'Automatically confirm funding and credit wallet immediately',
                },
                {
                  label: 'Max Funding Amount',
                  value: (
                    <span className="text-sm font-semibold text-slate-700">
                      {s.max_funding_amount
                        ? `₦${Number(s.max_funding_amount).toLocaleString()}`
                        : 'No limit'}
                    </span>
                  ),
                  desc: 'Maximum amount allowed per funding transaction',
                },
                {
                  label: 'Voucher Prefix',
                  value: (
                    <span className="font-mono text-sm font-semibold text-slate-700">
                      {s.voucher_prefix || 'EXP'}
                    </span>
                  ),
                  desc: 'Prefix for expense and advance voucher numbers',
                },
                {
                  label: 'Default Expense Payment Method',
                  value: (
                    <span className="capitalize text-sm font-semibold text-slate-700">
                      {paymentMethodDisplay}
                    </span>
                  ),
                  desc: 'Pre-selected payment method when creating expenses',
                },
              ].map(({ label, value, desc }) => (
                <tr key={label} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-5 text-sm font-medium text-slate-700 whitespace-nowrap">
                    {label}
                  </td>
                  <td className="py-3.5 px-4">{value}</td>
                  <td className="py-3.5 px-4 text-xs text-slate-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Last updated */}
      {s.updated_at && (
        <p className="text-xs text-slate-400 text-right">
          Last updated: {new Date(s.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}