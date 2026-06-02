'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { feeAPI } from '@/lib/api';
import { FeeSetting } from '@/lib/types';
import {
  Settings, Edit3, Check, X, AlertCircle, Loader2,
  Bell, Wallet, CreditCard, MessageSquare, Bot,
  FileText, Sparkles, RefreshCw, Globe,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
        checked ? 'bg-emerald-500' : 'bg-gray-200'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function NumberField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          min={min}
          max={max}
          className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        {suffix && <span className="text-xs text-gray-400 w-10">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Display Card ─────────────────────────────────────────────────────────────

function DisplayBool({ value }: { value: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {value ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function DisplayRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

// ─── Settings Modal ──────────────────────────────────────────────────────────

type Tab = 'invoices' | 'wallet' | 'reminders' | 'online' | 'bot';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'wallet', label: 'Wallet', icon: Wallet },
  { key: 'reminders', label: 'Reminders', icon: Bell },
  { key: 'online', label: 'Online Payment', icon: Globe },
  { key: 'bot', label: 'WhatsApp Bot', icon: MessageSquare },
];

interface ModalProps {
  settings: FeeSetting;
  onClose: () => void;
  onSave: (data: Partial<FeeSetting>) => Promise<void>;
}

function SettingsModal({ settings, onClose, onSave }: ModalProps) {
  const [tab, setTab] = useState<Tab>('invoices');
  const [form, setForm] = useState<Partial<FeeSetting>>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FeeSetting, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      const data = e.response?.data;
      if (data?.errors) {
        const msgs = Object.entries(data.errors)
          .map(([k, v]: any) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\n');
        setError(msgs);
      } else {
        setError(data?.message || e.message || 'Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-5 w-5" /> Fee Settings
          </h3>
          <button onClick={onClose} disabled={saving} className="text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto sticky bg-white z-10">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all ${
                tab === key
                  ? 'text-emerald-700 border-b-2 border-emerald-500 bg-emerald-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Invoices tab ── */}
          {tab === 'invoices' && (
            <div>
              <SettingRow
                label="Auto-generate invoice on enrollment"
                description="Automatically create an invoice when a student is enrolled in the current period"
                checked={form.auto_generate_invoice_on_enrollment ?? false}
                onChange={v => set('auto_generate_invoice_on_enrollment', v)}
              />
              <NumberField
                label="Invoice due days after period start"
                description="How many days after the period begins before invoices are considered overdue"
                value={form.invoice_due_days_after_period_start ?? 14}
                onChange={v => set('invoice_due_days_after_period_start', v)}
                min={0}
                max={365}
                suffix="days"
              />
              <SettingRow
                label="Send invoice by email"
                description="Email the invoice PDF to the parent when an invoice is generated"
                checked={form.send_invoice_email ?? false}
                onChange={v => set('send_invoice_email', v)}
              />
              <SettingRow
                label="Send payment receipt by email"
                description="Email a receipt PDF to the parent when a payment is confirmed"
                checked={form.send_payment_receipt_email ?? false}
                onChange={v => set('send_payment_receipt_email', v)}
              />
            </div>
          )}

          {/* ── Wallet tab ── */}
          {tab === 'wallet' && (
            <div>
              <SettingRow
                label="Unified wallet balance"
                description="Merge fee and canteen wallet into a single balance (disables separate field transfers)"
                checked={form.wallet_unified ?? false}
                onChange={v => set('wallet_unified', v)}
              />
              <SettingRow
                label="Allow inter-field wallet transfer"
                description="Staff can move funds between a student's fee wallet and canteen wallet"
                checked={form.allow_inter_field_transfer ?? true}
                onChange={v => set('allow_inter_field_transfer', v)}
                disabled={form.wallet_unified ?? false}
              />
              <SettingRow
                label="Allow sibling wallet transfer"
                description="Staff can transfer wallet balance from one sibling to another"
                checked={form.allow_sibling_transfer ?? true}
                onChange={v => set('allow_sibling_transfer', v)}
              />
            </div>
          )}

          {/* ── Reminders tab ── */}
          {tab === 'reminders' && (
            <div>
              <SettingRow
                label="Enable automatic fee reminders"
                description="Send WhatsApp/email reminders to parents with outstanding balances"
                checked={form.enable_auto_reminder ?? false}
                onChange={v => set('enable_auto_reminder', v)}
              />
              <NumberField
                label="Days after invoice before first reminder"
                description="How many days after invoice generation to send the first reminder"
                value={form.reminder_start_days_after_invoice ?? 7}
                onChange={v => set('reminder_start_days_after_invoice', v)}
                min={1}
                max={90}
                suffix="days"
              />
              <NumberField
                label="Reminder repeat interval"
                description="How often to repeat reminders until the invoice is paid"
                value={form.reminder_interval_days ?? 7}
                onChange={v => set('reminder_interval_days', v)}
                min={1}
                max={90}
                suffix="days"
              />
            </div>
          )}

          {/* ── Online Payment tab ── */}
          {tab === 'online' && (
            <div>
              <SettingRow
                label="Auto-confirm online payments"
                description="Automatically confirm online payments when the gateway webhook verifies them. Disable to require manual review."
                checked={form.online_payment_auto_confirm ?? true}
                onChange={v => set('online_payment_auto_confirm', v)}
              />
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Payment Gateway Configuration</p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      To configure your payment gateways (Paystack, Flutterwave, etc.), go to{' '}
                      <a href="/dashboard/staff/finance/gateways"
                        className="underline font-medium hover:text-amber-900">
                        Payment Gateways
                      </a>{' '}
                      in the sidebar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Bot tab ── */}
          {tab === 'bot' && (
            <div>
              <SettingRow
                label="Enable WhatsApp bot"
                description="Allow parents to check invoices, balances, and submit payment proof via WhatsApp"
                checked={form.whatsapp_bot_enabled ?? false}
                onChange={v => set('whatsapp_bot_enabled', v)}
              />
              <SettingRow
                label="Allow proof of payment upload"
                description="Parents can send a photo/PDF of their bank receipt via WhatsApp for staff review"
                checked={form.bot_allow_proof_upload ?? false}
                onChange={v => set('bot_allow_proof_upload', v)}
                disabled={!(form.whatsapp_bot_enabled ?? false)}
              />
              <SettingRow
                label="Send receipt via WhatsApp"
                description="Automatically send the payment receipt to the parent's WhatsApp when a payment is confirmed"
                checked={form.bot_send_receipt ?? false}
                onChange={v => set('bot_send_receipt', v)}
                disabled={!(form.whatsapp_bot_enabled ?? false)}
              />
              {!(form.whatsapp_bot_enabled ?? false) && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Bot className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-600">WhatsApp bot is disabled</p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Enable the bot above to configure proof upload and receipt settings.
                        Also ensure a WhatsApp provider is configured in{' '}
                        <a href="/dashboard/staff/finance/settings" className="underline">
                          Communications settings
                        </a>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button onClick={onClose} disabled={saving}
            className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Display Section Cards ────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeeSettingsPage() {
  const { user, hasPermission } = useAuth();
  const canEdit = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [settings, setSettings] = useState<FeeSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await feeAPI.getSettings();
      setSettings(data);
    } catch (e: any) {
      if (e.response?.status === 404) {
        setSettings(null);
        setError('not_found');
      } else {
        setError('fetch_error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Partial<FeeSetting>) => {
    const updated = settings
      ? await feeAPI.updateSettings(data)
      : await feeAPI.updateSettings(data); // backend handles create-or-update
    setSettings(updated);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading fee settings...</p>
        </div>
      </div>
    );
  }

  // ── Not found / first time ──
  if (error === 'not_found' && !settings) {
    return (
      <>
        {isEditing && (
          <SettingsModal
            settings={{} as FeeSetting}
            onClose={() => setIsEditing(false)}
            onSave={handleSave}
          />
        )}
        <div className="min-h-[500px] flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center mx-auto">
              <Settings className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Configure Fee Settings</h3>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Set up your fee module settings — invoice generation, wallet rules, reminders, and bot configuration.
              </p>
            </div>
            {canEdit ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 shadow-md hover:shadow-lg transition-all"
              >
                <Sparkles className="h-4 w-4" /> Set Up Fee Settings
              </button>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                You don't have permission to configure fee settings.
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Error ──
  if (error === 'fetch_error') {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="max-w-sm text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <p className="text-gray-600">Failed to load fee settings.</p>
          <button onClick={load} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6 pb-8">
      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-lg">
          <Check className="h-4 w-4 text-green-600" />
          <p className="text-sm font-medium text-green-800">Settings saved successfully</p>
        </div>
      )}

      {/* Edit modal */}
      {isEditing && (
        <SettingsModal
          settings={settings}
          onClose={() => setIsEditing(false)}
          onSave={handleSave}
        />
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fee Settings</h1>
            <p className="text-sm text-gray-400">System-wide configuration for the fee module</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <Edit3 className="h-4 w-4" /> Edit Settings
          </button>
        )}
      </div>

      {/* Settings cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Invoice Settings */}
        <SectionCard title="Invoice Settings" icon={FileText} iconColor="bg-blue-50 text-blue-600">
          <DisplayRow label="Auto-generate on enrollment" value={<DisplayBool value={settings.auto_generate_invoice_on_enrollment} />} />
          <DisplayRow label="Due days after period start" value={`${settings.invoice_due_days_after_period_start} days`} />
          <DisplayRow label="Send invoice by email" value={<DisplayBool value={settings.send_invoice_email} />} />
          <DisplayRow label="Send payment receipt by email" value={<DisplayBool value={settings.send_payment_receipt_email} />} />
        </SectionCard>

        {/* Wallet Settings */}
        <SectionCard title="Wallet Settings" icon={Wallet} iconColor="bg-teal-50 text-teal-600">
          <DisplayRow label="Unified wallet balance" value={<DisplayBool value={settings.wallet_unified} />} />
          <DisplayRow label="Allow inter-field transfer" value={<DisplayBool value={settings.allow_inter_field_transfer} />} />
          <DisplayRow label="Allow sibling transfer" value={<DisplayBool value={settings.allow_sibling_transfer} />} />
        </SectionCard>

        {/* Reminder Settings */}
        <SectionCard title="Reminders" icon={Bell} iconColor="bg-amber-50 text-amber-600">
          <DisplayRow label="Auto reminders enabled" value={<DisplayBool value={settings.enable_auto_reminder} />} />
          <DisplayRow label="First reminder after" value={`${settings.reminder_start_days_after_invoice} days`} />
          <DisplayRow label="Repeat interval" value={`every ${settings.reminder_interval_days} days`} />
        </SectionCard>

        {/* Online Payment */}
        <SectionCard title="Online Payment" icon={Globe} iconColor="bg-purple-50 text-purple-600">
          <DisplayRow label="Auto-confirm online payments" value={<DisplayBool value={settings.online_payment_auto_confirm} />} />
          <div className="py-3">
            <a href="/dashboard/staff/finance/gateways"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              <CreditCard className="h-3.5 w-3.5" /> Configure Payment Gateways →
            </a>
          </div>
        </SectionCard>

        {/* WhatsApp Bot */}
        <SectionCard title="WhatsApp Bot" icon={MessageSquare} iconColor="bg-green-50 text-green-600">
          <DisplayRow label="Bot enabled" value={<DisplayBool value={settings.whatsapp_bot_enabled} />} />
          <DisplayRow label="Allow proof upload" value={<DisplayBool value={settings.bot_allow_proof_upload} />} />
          <DisplayRow label="Send receipt via WhatsApp" value={<DisplayBool value={settings.bot_send_receipt} />} />
        </SectionCard>

        {/* AI Config reference */}
        <SectionCard title="AI Configuration" icon={Bot} iconColor="bg-indigo-50 text-indigo-600">
          <DisplayRow
            label="Active AI config"
            value={settings.active_ai_config
              ? <span className="text-xs font-mono text-gray-700">Config #{settings.active_ai_config}</span>
              : <span className="text-xs text-gray-400">Not configured</span>}
          />
          <DisplayRow
            label="Active WhatsApp config"
            value={settings.active_whatsapp_config
              ? <span className="text-xs font-mono text-gray-700">Config #{settings.active_whatsapp_config}</span>
              : <span className="text-xs text-gray-400">Not configured</span>}
          />
          <div className="py-3">
            <a href="/dashboard/setup/school-settings"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              <RefreshCw className="h-3.5 w-3.5" /> Manage AI & WhatsApp configs →
            </a>
          </div>
        </SectionCard>

      </div>
    </div>
  );
}