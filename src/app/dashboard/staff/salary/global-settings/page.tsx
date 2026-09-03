// app/dashboard/staff/salary/global-settings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { salaryGlobalSettingsAPI } from '@/lib/salary_management.service';
import { useAuth, useRequireAuth } from '@/context/AuthContext';
import { SalaryGlobalSetting, GlobalPasswordType } from '@/lib/salary_management.types';
import {
  Settings, Edit3, Check, X, AlertCircle, Loader2,
  ShieldCheck, FileText, Send, Lock, Coins,
  RefreshCw, Sliders, Hash, Wallet
} from 'lucide-react';

// ─── API Unwrapper ────────────────────────────────────────────────────────────
function unwrap(payload: any) {
  if (payload && payload.success !== undefined && payload.data !== undefined) {
    return payload.data;
  }
  return payload;
}

// ─── Default Form Values ──────────────────────────────────────────────────────
const DEFAULT_FORM: Partial<SalaryGlobalSetting> = {
  allow_custom_overrides: true,
  require_payroll_approval: true,
  auto_deduct_loans: true,
  send_payslip_via_email: true,
  payslip_password_protection: false,
  payslip_password_type: 'none',
  default_payslip_note: 'This is a computer-generated document. No signature is required.',
};

const PASSWORD_TYPE_LABELS: Record<GlobalPasswordType, string> = {
  none: 'None (Unprotected)',
  staff_id: 'Staff ID',
  mobile_last_4: 'Mobile Number (Last 4 Digits)',
  bank_account_last_4: 'Salary Bank Account (Last 4 Digits)',
};

function settingsToForm(s: SalaryGlobalSetting): Partial<SalaryGlobalSetting> {
  return {
    allow_custom_overrides: s.allow_custom_overrides ?? true,
    require_payroll_approval: s.require_payroll_approval ?? true,
    auto_deduct_loans: s.auto_deduct_loans ?? true,
    send_payslip_via_email: s.send_payslip_via_email ?? true,
    payslip_password_protection: s.payslip_password_protection ?? false,
    payslip_password_type: s.payslip_password_type ?? 'none',
    default_payslip_note: s.default_payslip_note ?? '',
  };
}

// ─── Reusable Components ──────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 transition-colors ${disabled ? 'opacity-60 cursor-not-allowed grayscale-[30%]' : 'hover:border-slate-200'}`}>
      <div className="flex-1 pr-4">
        <p className={`text-sm font-medium ${disabled ? 'text-slate-500' : 'text-slate-800'}`}>{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${checked ? 'bg-emerald-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function StatusBadge({ value, activeLabel = 'Enabled', inactiveLabel = 'Disabled', danger = false }: {
  value: boolean; activeLabel?: string; inactiveLabel?: string; danger?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      value ? danger ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value ? danger ? 'bg-red-500' : 'bg-emerald-500' : 'bg-slate-400'}`} />
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

function SettingRow({ icon: Icon, iconBg, label, value, description }: {
  icon: any; iconBg: string; label: string; value: React.ReactNode; description: string;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 px-4 hover:bg-slate-50/70 rounded-xl transition-colors group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
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

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({
  settings,
  isSaving,
  onSave,
  onClose,
}: {
  settings: SalaryGlobalSetting | null;
  isSaving: boolean;
  onSave: (f: Partial<SalaryGlobalSetting>) => Promise<void>;
  onClose: () => void;
}) {
  type TabId = 'core' | 'payslip';
  const [activeTab, setActiveTab] = useState<TabId>('core');
  const [form, setForm] = useState<Partial<SalaryGlobalSetting>>(
    settings ? settingsToForm(settings) : DEFAULT_FORM
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof SalaryGlobalSetting>(key: K, value: SalaryGlobalSetting[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try { await onSave(form); }
    catch (err: any) {
      const data = err?.response?.data;
      if (!data) return setSaveError(err?.message || 'An unexpected error occurred.');
      if (data.non_field_errors) return setSaveError(Array.isArray(data.non_field_errors) ? data.non_field_errors.join('\n') : data.non_field_errors);
      if (typeof data === 'object' && !data.message) {
        setSaveError(Object.entries(data).map(([field, errors]: [string, any]) => `${field.replace(/_/g, ' ')}: ${Array.isArray(errors) ? errors.join(', ') : String(errors)}`).join('\n'));
        return;
      }
      setSaveError(data?.message || 'Failed to save settings.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            Global Salary Settings
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 flex-shrink-0 gap-1 overflow-x-auto">
          <button type="button" onClick={() => setActiveTab('core')}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === 'core' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}>
            <ShieldCheck className="h-3.5 w-3.5" /> Payroll Rules
          </button>
          <button type="button" onClick={() => setActiveTab('payslip')}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === 'payslip' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}>
            <FileText className="h-3.5 w-3.5" /> Payslips & Emails
          </button>
        </div>

        {/* Scrollable body */}
        <form id="global-salary-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 bg-slate-50/20">
          <div className="p-6 space-y-6">

            {/* ── Core Payroll Rules ── */}
            {activeTab === 'core' && (
              <div className="space-y-4 max-w-2xl">
                <p className="text-sm text-slate-500 mb-2">Configure core calculations and operational workflows for the payroll engine.</p>

                <Toggle checked={!!form.require_payroll_approval} onChange={v => set('require_payroll_approval', v)}
                  label="Require Payroll Approval (Maker-Checker)"
                  description="New payroll batches remain 'Pending' until reviewed and approved by an authorized administrator." />

                <Toggle checked={!!form.allow_custom_overrides} onChange={v => set('allow_custom_overrides', v)}
                  label="Allow Custom Flat-Amount Overrides"
                  description="Permit HR to override standard template mathematics with bespoke flat-rate allowances/deductions for specific staff." />

                <Toggle checked={!!form.auto_deduct_loans} onChange={v => set('auto_deduct_loans', v)}
                  label="Auto-Deduct Active Loans"
                  description="Automatically calculate and sweep outstanding loans/advances from a staff member's net pay during processing." />
              </div>
            )}

            {/* ── Payslips & Emails ── */}
            {activeTab === 'payslip' && (
              <div className="space-y-6 max-w-2xl">
                <p className="text-sm text-slate-500 mb-2">Manage payslip delivery and PDF document security.</p>

                <Toggle checked={!!form.send_payslip_via_email} onChange={v => set('send_payslip_via_email', v)}
                  label="Auto-Email Payslips"
                  description="Dispatch PDF payslips silently via email the moment a salary record is marked as Paid." />

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <Toggle checked={!!form.payslip_password_protection} onChange={v => set('payslip_password_protection', v)}
                    label="Password Protect PDF Payslips"
                    description="Encrypt generated PDFs. Staff will need a password to view their payslip." />

                  <div className={`pt-2 ${!form.payslip_password_protection && 'opacity-50 pointer-events-none'}`}>
                    <label className={labelCls}>PDF Password Type</label>
                    <select
                      value={form.payslip_password_type ?? 'none'}
                      onChange={e => set('payslip_password_type', e.target.value as GlobalPasswordType)}
                      className={inputCls}
                      disabled={!form.payslip_password_protection}
                    >
                      <option value="none">None (Unprotected)</option>
                      <option value="staff_id">Staff ID</option>
                      <option value="mobile_last_4">Mobile Number (Last 4 Digits)</option>
                      <option value="bank_account_last_4">Salary Bank Account (Last 4 Digits)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1.5">What the staff member must type to unlock the PDF.</p>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Default Payslip Footer Note</label>
                  <textarea
                    value={form.default_payslip_note ?? ''}
                    onChange={e => set('default_payslip_note', e.target.value)}
                    rows={3}
                    placeholder="e.g., This is a computer-generated document. No signature is required."
                    className={inputCls}
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Appears at the bottom of all generated payslips.</p>
                </div>
              </div>
            )}

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-5 py-2.5 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="global-salary-settings-form" disabled={isSaving}
            className="px-6 py-2.5 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4" />{settings ? 'Save Settings' : 'Initialize Settings'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SalaryGlobalSettingsPage() {
  const { hasPermission, user } = useAuth();
  const { authReady } = useRequireAuth();

  const [settings, setSettings] = useState<SalaryGlobalSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('salary_management.change_salarysettingmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await salaryGlobalSettingsAPI.get();
      setSettings(data);
    } catch {
      setPageError('fetch_error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady && user) fetchSettings();
  }, [fetchSettings, authReady, user]);

  const handleSave = async (form: Partial<SalaryGlobalSetting>) => {
    setIsSaving(true);
    try {
      const updated = await salaryGlobalSettingsAPI.patch(form as SalaryGlobalSettingWrite);
      setSettings(updated);
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

  if (!authReady || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
    </div>
  );

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading Global Salary Settings...</p>
      </div>
    </div>
  );

  if (pageError === 'fetch_error' || !settings) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">Couldn't load settings. Please try again.</p>
        <button onClick={fetchSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10 max-w-6xl mx-auto">

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && (
        <SettingsModal settings={settings} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Sliders className="h-5 w-5 text-white" />
            </div>
            Global Salary Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1 pl-13">
            Configure core payroll rules, automations, and payslip delivery.
          </p>
        </div>
        {canEdit ? (
          <button onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
            <Edit3 className="h-4 w-4" /> Edit Settings
          </button>
        ) : (
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800">
            Read Only Access
          </div>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Approval Workflow',
            value: settings.require_payroll_approval ? 'Required' : 'Bypassed',
            icon: ShieldCheck,
            color: settings.require_payroll_approval ? 'from-emerald-500 to-teal-600' : 'from-slate-400 to-slate-500',
          },
          {
            label: 'Custom Overrides',
            value: settings.allow_custom_overrides ? 'Enabled' : 'Locked',
            icon: Edit3,
            color: settings.allow_custom_overrides ? 'from-blue-500 to-indigo-600' : 'from-slate-400 to-slate-500',
          },
          {
            label: 'Loan Auto-Sweep',
            value: settings.auto_deduct_loans ? 'Active' : 'Manual',
            icon: Wallet,
            color: settings.auto_deduct_loans ? 'from-violet-500 to-purple-600' : 'from-slate-400 to-slate-500',
          },
          {
            label: 'Payslip Dispatch',
            value: settings.send_payslip_via_email ? 'Automated' : 'Disabled',
            icon: Send,
            color: settings.send_payslip_via_email ? 'from-orange-400 to-amber-500' : 'from-slate-400 to-slate-500',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
              <p className="text-base font-bold text-slate-900 capitalize truncate mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Core Payroll Rules */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Coins className="h-4 w-4 text-blue-700" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Payroll Rules & Operations</h3>
          </div>
          <div className="p-3 flex-1">
            <SettingRow icon={ShieldCheck} iconBg="bg-emerald-50 text-emerald-600"
              label="Maker-Checker Approvals"
              description="Require admin approval for processed payroll"
              value={<StatusBadge value={settings.require_payroll_approval} />} />
            <SettingRow icon={Edit3} iconBg="bg-indigo-50 text-indigo-600"
              label="Custom Flat Overrides"
              description="Allow HR to override template calculations"
              value={<StatusBadge value={settings.allow_custom_overrides} />} />
            <SettingRow icon={Wallet} iconBg="bg-violet-50 text-violet-600"
              label="Loan Auto-Sweep"
              description="Auto-deduct loans from net salary"
              value={<StatusBadge value={settings.auto_deduct_loans} />} />
          </div>
        </div>

        {/* Payslips & Emails */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-orange-700" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Payslips & Delivery</h3>
          </div>
          <div className="p-3 flex-1">
            <SettingRow icon={Send} iconBg="bg-amber-50 text-amber-600"
              label="Auto-Email Payslips"
              description="Send payslips silently when marked Paid"
              value={<StatusBadge value={settings.send_payslip_via_email} />} />
            <SettingRow icon={Lock} iconBg="bg-rose-50 text-rose-600"
              label="PDF Encryption"
              description="Password protect emailed documents"
              value={<StatusBadge value={settings.payslip_password_protection} danger={!settings.payslip_password_protection} activeLabel="Encrypted" inactiveLabel="Unprotected" />} />

            <SettingRow icon={Hash} iconBg="bg-slate-100 text-slate-600"
              label="Password Type"
              description="Key required to unlock the PDF"
              value={
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg block text-right max-w-[140px] truncate ${settings.payslip_password_protection ? 'bg-slate-100 text-slate-700' : 'text-slate-400 bg-slate-50 line-through'}`}>
                  {PASSWORD_TYPE_LABELS[settings.payslip_password_type]}
                </span>
              } />
          </div>
        </div>

      </div>

      {/* ── Settings Overview Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Complete Settings Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-5">Setting</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Value</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { label: 'Payroll Approval', value: <StatusBadge value={settings.require_payroll_approval} />, desc: 'Payroll batches remain Pending until an authorized admin approves them.' },
                { label: 'Allow Custom Overrides', value: <StatusBadge value={settings.allow_custom_overrides} />, desc: 'HR can input bespoke flat-amount allowances/deductions for specific staff.' },
                { label: 'Auto-Deduct Loans', value: <StatusBadge value={settings.auto_deduct_loans} />, desc: 'Outstanding active loans and advances are swept during calculation.' },
                { label: 'Email Payslips', value: <StatusBadge value={settings.send_payslip_via_email} />, desc: 'Payslips are automatically emailed to staff when the status hits Paid.' },
                { label: 'PDF Password Lock', value: <StatusBadge value={settings.payslip_password_protection} danger={!settings.payslip_password_protection} activeLabel="Locked" inactiveLabel="Unlocked" />, desc: 'PDFs are encrypted to prevent unauthorized viewing.' },
                { label: 'Unlock Key', value: <span className="text-sm font-semibold text-slate-700">{PASSWORD_TYPE_LABELS[settings.payslip_password_type]}</span>, desc: 'The specific data point the staff member must type to open the PDF.' },
                { label: 'Default Footer Note', value: <span className="text-sm text-slate-700 truncate max-w-xs block">{settings.default_payslip_note || '—'}</span>, desc: 'Standard text appended to the bottom of every generated payslip.' },
              ].map(({ label, value, desc }) => (
                <tr key={label} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-5 text-sm font-medium text-slate-700 whitespace-nowrap">{label}</td>
                  <td className="py-3.5 px-4">{value}</td>
                  <td className="py-3.5 px-4 text-xs text-slate-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}