'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { feeAPI } from '@/lib/fee.service';
import api from '@/lib/api';
import type { FeeSetting } from '@/lib/fee.types';
import {
  Settings,
  Edit3,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Loader2,
  Receipt,
  Globe,
  Bell,
  MessageCircle,
  FileText,
  CreditCard,
  UploadCloud,
  CalendarClock,
  Clock,
  CheckCircle,
  Shield,
  Mail,
} from 'lucide-react';

// ─── Interfaces & Defaults ─────────────────────────────────────────────────────

interface PaymentGateway {
  id: number;
  name: string;
  provider: string;
  provider_display?: string;
}

const DEFAULT_FORM: FeeSetting = {
  id: 0,
  allow_partial_payments: true,
  minimum_online_payment_amount: '100.00',
  online_payment_enabled: false,
  default_gateway: null,
  online_payment_auto_confirm: true,
  allow_teller_upload: true,
  auto_generate_invoice_on_enrollment: true,
  invoice_due_days_after_period_start: 14,
  enable_auto_reminder: true,
  reminder_start_days_after_invoice: 7,
  reminder_interval_days: 5,
  send_payment_receipt_email: true,
  send_invoice_whatsapp: true,
  whatsapp_bot_enabled: true,
  bot_allow_proof_upload: true,
  bot_send_receipt: true,
};

// ─── Shared UI Components ──────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description }) => (
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
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  </div>
);

const StatusBadge: React.FC<{ value: boolean }> = ({ value }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${value ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-slate-400'}`} />
    {value ? 'Enabled' : 'Disabled'}
  </span>
);

const SettingRow: React.FC<{ icon: any; iconBg: string; label: string; value: React.ReactNode; description: string; }> = ({ icon: Icon, iconBg, label, value, description }) => (
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

// Form Styles
const inputCls = 'w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white font-medium text-slate-800 shadow-sm transition-shadow';
const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5';

// ─── Settings Modal Component ──────────────────────────────────────────────────

interface SettingsModalProps {
  settings: FeeSetting | null;
  gateways: PaymentGateway[];
  isSaving: boolean;
  onSave: (form: FeeSetting) => Promise<void>;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, gateways, isSaving, onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState<'invoicing' | 'portal' | 'reminders' | 'bot'>('invoicing');
  const [form, setForm] = useState<FeeSetting>(settings ? { ...DEFAULT_FORM, ...settings } : { ...DEFAULT_FORM });
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof FeeSetting>(key: K, value: FeeSetting[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      const data = err?.response?.data;
      setSaveError(data?.detail || data?.message || err?.message || 'Failed to persist settings. Please check your inputs.');
    }
  };

  const tabs = [
    { id: 'invoicing' as const, label: 'Invoicing Rules', icon: FileText },
    { id: 'portal' as const, label: 'Parent Portal', icon: Globe },
    { id: 'reminders' as const, label: 'Reminders & Mail', icon: Bell },
    { id: 'bot' as const, label: 'WhatsApp Bot', icon: MessageCircle },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Enforced 500px fixed height container */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[500px] flex flex-col border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-2.5 text-white">
            <Settings className="h-5 w-5" />
            <h3 className="text-base font-bold">{settings ? 'Update Fee Module Settings' : 'Initialize Fee Module Settings'}</h3>
          </div>
          <button onClick={onClose} disabled={isSaving} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Banner */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between flex-shrink-0 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{saveError}</span>
            </div>
            <button type="button" onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 transition-colors"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 flex-shrink-0 gap-4 overflow-x-auto bg-slate-50/50">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 py-3.5 text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap focus:outline-none ${
                activeTab === t.id ? 'text-emerald-600 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable Form Body */}
        <form id="settings-form" onSubmit={handleSubmit} className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-6 bg-white">

          {activeTab === 'invoicing' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <Toggle checked={form.auto_generate_invoice_on_enrollment} onChange={v => set('auto_generate_invoice_on_enrollment', v)}
                label="Auto-Generate Invoice on Enrollment" description="Automatically generate a student's first invoice when they are registered or enrolled in a new class." />

              <Toggle checked={form.allow_partial_payments} onChange={v => set('allow_partial_payments', v)}
                label="Allow Partial Invoice Payments" description="Parents can pay fees in installments rather than settling the full invoice at once." />

              <div className="pt-2">
                <label className={labelCls}>Invoice Due Days</label>
                <input type="number" min="0" value={form.invoice_due_days_after_period_start} onChange={e => set('invoice_due_days_after_period_start', parseInt(e.target.value) || 0)} className={inputCls} />
                <p className="text-xs text-slate-500 mt-1.5 font-medium">Number of days after the academic term's resumption date that invoices become officially overdue.</p>
              </div>
            </div>
          )}

          {activeTab === 'portal' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <Toggle
                checked={form.online_payment_enabled}
                onChange={v => {
                  set('online_payment_enabled', v);
                  if (!v) set('default_gateway', null); // Reset gateway if disabled
                }}
                label="Enable Online Payment Gateway"
                description="Allow parents to pay invoices securely via Card/Bank Transfer through configured payment gateways."
              />

              {/* Conditional Rendering: Only show Gateway Configs if enabled */}
              {form.online_payment_enabled && (
                <div className="space-y-4 pt-3 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className={labelCls}>Default Payment Gateway</label>
                    <select
                      value={form.default_gateway || ''}
                      onChange={e => set('default_gateway', e.target.value ? parseInt(e.target.value) : null)}
                      className={inputCls}
                      required={form.online_payment_enabled}
                    >
                      <option value="">Select an active gateway...</option>
                      {gateways.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.provider_display || g.provider})</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">Select the primary gateway used for processing online fee payments.</p>
                  </div>

                  <div>
                    <label className={labelCls}>Minimum Online Payment (NGN)</label>
                    <input type="number" step="0.01" min="0" value={form.minimum_online_payment_amount} onChange={e => set('minimum_online_payment_amount', e.target.value)} className={inputCls} />
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">The lowest allowable amount a parent can pay through the online gateway at once.</p>
                  </div>

                  <Toggle checked={form.online_payment_auto_confirm} onChange={v => set('online_payment_auto_confirm', v)}
                    label="Auto-Confirm Webhook Payments" description="Instantly update invoice status when a successful payment is verified via provider webhooks." />
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <Toggle checked={form.allow_teller_upload} onChange={v => set('allow_teller_upload', v)}
                  label="Allow Manual Teller Uploads" description="Allow parents to upload images of bank deposit slips via the portal for manual verification." />
              </div>
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <Toggle checked={form.enable_auto_reminder} onChange={v => set('enable_auto_reminder', v)}
                label="Enable Automated Reminders" description="The system will periodically email/message parents who have overdue balances." />

              <Toggle checked={form.send_payment_receipt_email} onChange={v => set('send_payment_receipt_email', v)}
                label="Email PDF Receipts" description="Automatically dispatch a PDF receipt to the parent's registered email when a payment is confirmed." />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className={labelCls}>Reminder Start (Days)</label>
                  <input type="number" min="0" value={form.reminder_start_days_after_invoice} onChange={e => set('reminder_start_days_after_invoice', parseInt(e.target.value) || 0)} className={inputCls} />
                  <p className="text-xs text-slate-500 mt-1.5 font-medium">Days after invoice issue date to send the first reminder.</p>
                </div>
                <div>
                  <label className={labelCls}>Reminder Interval (Days)</label>
                  <input type="number" min="1" value={form.reminder_interval_days} onChange={e => set('reminder_interval_days', parseInt(e.target.value) || 1)} className={inputCls} />
                  <p className="text-xs text-slate-500 mt-1.5 font-medium">How often to repeat the reminder after the first one is sent.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bot' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <Toggle checked={form.whatsapp_bot_enabled} onChange={v => set('whatsapp_bot_enabled', v)}
                label="Enable WhatsApp Bot Integration" description="Allow the school's WhatsApp bot to query invoice balances and accept proofs." />

              <Toggle checked={form.send_invoice_whatsapp} onChange={v => set('send_invoice_whatsapp', v)}
                label="Send Invoice Alerts via WhatsApp" description="Push a notification to the parent's WhatsApp when a new termly invoice is generated." />

              <Toggle checked={form.bot_send_receipt} onChange={v => set('bot_send_receipt', v)}
                label="Send Receipts via WhatsApp" description="Push a confirmation message to WhatsApp when an accountant confirms a payment." />

              <Toggle checked={form.bot_allow_proof_upload} onChange={v => set('bot_allow_proof_upload', v)}
                label="Accept Teller Uploads via Bot" description="Parents can send images of their bank deposit slips directly to the WhatsApp bot for processing." />
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0 z-10">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200">
            Cancel
          </button>
          <button type="submit" form="settings-form" disabled={isSaving} className="px-6 py-2.5 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:opacity-70 disabled:cursor-not-allowed">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Check className="h-4 w-4" /> {settings ? 'Save Preferences' : 'Initialize Module'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page View ────────────────────────────────────────────────────────────

export default function FeeSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [settings, setSettings] = useState<FeeSetting | null>(null);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canEdit = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const fetchSettingsAndGateways = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, gatewaysRes] = await Promise.all([
        feeAPI.settings.get().catch(() => null),
        api.get('/api/finance/gateways/').catch(() => ({ data: { results: [] } }))
      ]);
      setSettings(settingsData);
      setGateways(gatewaysRes.data?.results || gatewaysRes.data || []);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettingsAndGateways();
  }, [fetchSettingsAndGateways]);

  const handleSave = async (form: FeeSetting) => {
    setIsSaving(true);
    try {
      const updated = await feeAPI.settings.update(form);
      setSettings(updated);
      setIsEditing(false);
      setToast('Fee module settings successfully updated!');
      setTimeout(() => setToast(null), 4000);
    } catch (error) {
      throw error; // Let the modal catch and display the specific error
    } finally {
      setIsSaving(false);
    }
  };

  const getGatewayName = (id: number | null | undefined) => {
    if (!id) return 'None (Disabled)';
    const g = gateways.find(gw => gw.id === id);
    return g ? `${g.name} (${g.provider_display || g.provider})` : `Unknown (ID: ${id})`;
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Loading fee configuration...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <>
        {isEditing && <SettingsModal settings={null} gateways={gateways} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}
        <div className="min-h-[550px] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm border border-emerald-100">
              <Receipt className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Initialize Fee Module</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">Configure your school's invoicing rules, online payment gateways, and WhatsApp bot integrations to begin processing fees.</p>
            </div>
            {canEdit ? (
              <button onClick={() => setIsEditing(true)} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2 focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500">
                <Sparkles className="h-4 w-4" /> Initialize Settings
              </button>
            ) : (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3 text-left">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-semibold leading-relaxed">You lack administrative privileges to initialize module settings. Please contact the system administrator.</p>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300 text-sm font-medium border border-slate-700">
          <Check className="h-4 w-4 text-emerald-400" /> {toast}
        </div>
      )}

      {/* Editing Modal */}
      {isEditing && <SettingsModal settings={settings} gateways={gateways} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-200">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fee Module Preferences</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Manage automated invoicing, payment portals, and reminder schedules</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-slate-900">
            <Edit3 className="h-4 w-4" /> Modify Preferences
          </button>
        )}
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><FileText className="h-5 w-5" /></div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Auto-Invoicing</p>
            <p className="text-base font-black text-slate-900 leading-tight mt-0.5">{settings.auto_generate_invoice_on_enrollment ? 'Active' : 'Disabled'}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><CreditCard className="h-5 w-5" /></div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Online Pay</p>
            <p className="text-base font-black text-slate-900 leading-tight mt-0.5">{settings.online_payment_enabled ? 'Active' : 'Disabled'}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><Bell className="h-5 w-5" /></div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Reminders</p>
            <p className="text-base font-black text-slate-900 leading-tight mt-0.5">{settings.enable_auto_reminder ? 'Automated' : 'Manual'}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-3 bg-teal-50 rounded-xl text-teal-600"><MessageCircle className="h-5 w-5" /></div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">WhatsApp Bot</p>
            <p className="text-base font-black text-slate-900 leading-tight mt-0.5">{settings.whatsapp_bot_enabled ? 'Active' : 'Disabled'}</p>
          </div>
        </div>
      </div>

      {/* Detailed Configuration Read-Only Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Invoicing & Reminders Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-100 font-bold text-sm text-slate-800 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-emerald-600" /> Invoicing & Reminder Schedules
          </div>
          <div className="p-2 divide-y divide-slate-100 flex-1">
            <SettingRow icon={FileText} iconBg="bg-emerald-50 text-emerald-600" label="Auto-Generation" description="Create invoices when students enroll" value={<StatusBadge value={settings.auto_generate_invoice_on_enrollment} />} />
            <SettingRow icon={FileText} iconBg="bg-slate-50 text-slate-600" label="Partial Payments" description="Allow invoices to be paid in installments" value={<StatusBadge value={settings.allow_partial_payments} />} />
            <SettingRow icon={Clock} iconBg="bg-amber-50 text-amber-600" label="Invoice Grace Period" description="Days until invoices are marked overdue" value={<span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">{settings.invoice_due_days_after_period_start} days</span>} />
            <SettingRow icon={Bell} iconBg="bg-blue-50 text-blue-600" label="Auto Reminders" description="Dispatch automated late fee emails" value={<StatusBadge value={settings.enable_auto_reminder} />} />
            <SettingRow icon={CalendarClock} iconBg="bg-indigo-50 text-indigo-600" label="Reminder Schedule" description="When to send the first and subsequent emails" value={
              <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">Start: Day {settings.reminder_start_days_after_invoice} | Rep: {settings.reminder_interval_days}d</span>
            } />
          </div>
        </div>

        {/* Portal & Communications Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-100 font-bold text-sm text-slate-800 flex items-center gap-2">
            <Globe className="h-4 w-4 text-teal-600" /> Portals & Communications
          </div>
          <div className="p-2 divide-y divide-slate-100 flex-1">
            <SettingRow icon={Shield} iconBg="bg-blue-50 text-blue-600" label="Default Gateway" description="Active gateway for online payments" value={<span className="font-mono font-bold text-[10px] text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">{getGatewayName(settings.default_gateway)}</span>} />
            <SettingRow icon={CreditCard} iconBg="bg-emerald-50 text-emerald-600" label="Online Gateway" description="Accept payments via Paystack/Flutterwave" value={<StatusBadge value={settings.online_payment_enabled} />} />
            <SettingRow icon={CreditCard} iconBg="bg-slate-50 text-slate-600" label="Min. Online Payment" description="Lowest allowed card/transfer amount" value={<span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">₦{settings.minimum_online_payment_amount}</span>} />
            <SettingRow icon={CheckCircle} iconBg="bg-indigo-50 text-indigo-600" label="Webhook Auto-Confirm" description="Automatically confirm digital payments" value={<StatusBadge value={settings.online_payment_auto_confirm} />} />
            <SettingRow icon={UploadCloud} iconBg="bg-amber-50 text-amber-600" label="Manual Tellers" description="Allow manual deposit slip uploads" value={<StatusBadge value={settings.allow_teller_upload} />} />
            <SettingRow icon={MessageCircle} iconBg="bg-teal-50 text-teal-600" label="WhatsApp Bot" description="Allow bot to accept proofs & check balances" value={<StatusBadge value={settings.whatsapp_bot_enabled} />} />
            <SettingRow icon={MessageCircle} iconBg="bg-slate-50 text-slate-600" label="WhatsApp Invoices" description="Push new invoice alerts to parents via WhatsApp" value={<StatusBadge value={settings.send_invoice_whatsapp} />} />
            <SettingRow icon={MessageCircle} iconBg="bg-slate-50 text-slate-600" label="WhatsApp Receipts" description="Push confirmed receipts to WhatsApp" value={<StatusBadge value={settings.bot_send_receipt} />} />
            <SettingRow icon={UploadCloud} iconBg="bg-slate-50 text-slate-600" label="Bot Teller Uploads" description="Accept bank deposit images via WhatsApp" value={<StatusBadge value={settings.bot_allow_proof_upload} />} />
            <SettingRow icon={Mail} iconBg="bg-purple-50 text-purple-600" label="Email PDF Receipts" description="Dispatch receipts upon confirmation" value={<StatusBadge value={settings.send_payment_receipt_email} />} />
          </div>
        </div>

      </div>
    </div>
  );
}