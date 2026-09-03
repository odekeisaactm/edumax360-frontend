'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { schoolSettingsAPI, aiConfigAPI } from '@/lib/api';
import { whatsAppConfigAPI } from '@/lib/communication.service'; // Added WhatsApp API import
import { useAuth, useRequireAuth } from '@/context/AuthContext';
import { SchoolAIConfig, SchoolSettings } from '@/lib/types';
import {
  Settings, Edit3, X, Check, AlertCircle, Sparkles,
  Monitor, Building, Calendar, Loader2, Bot,
  Bell, Mail, MessageSquare, Database, Shield,
  Users, Smartphone, ChevronRight, Wallet, Key, Lock
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SettingsForm {
  school_type: 'day' | 'boarding' | 'mixed';
  enable_notifications: boolean;
  parent_portal_enabled: boolean;
  student_portal_enabled: boolean;
  separate_school_sections_data: boolean;
  enable_sms_notifications: boolean;
  enable_email_notifications: boolean;
  default_period_type: 'term' | 'semester' | 'quarter' | 'trimester';
  school_week_start_day: 'monday' | 'sunday' | 'saturday';
  items_per_page: 10 | 25 | 50 | 100;
  date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  delete_archived_data_after_years: number;
  backup_frequency_days: number;
  enable_automatic_backup: boolean;
  maintenance_mode: boolean;
  active_ai_config_id: number | null;
  ai_billing_mode: 'disabled' | 'platform_wallet' | 'school_owns_key' | 'staff_pays' | 'parent_pays';
  active_whatsapp_config_id: number | null; // Added field
}

const DEFAULT_FORM: SettingsForm = {
  school_type: 'day', enable_notifications: true, parent_portal_enabled: true,
  student_portal_enabled: true, separate_school_sections_data: false,
  enable_sms_notifications: false, enable_email_notifications: true,
  default_period_type: 'term', school_week_start_day: 'monday',
  items_per_page: 25, date_format: 'DD/MM/YYYY',
  delete_archived_data_after_years: 7, backup_frequency_days: 7,
  enable_automatic_backup: true, maintenance_mode: false,
  active_ai_config_id: null, ai_billing_mode: 'platform_wallet',
  active_whatsapp_config_id: null,
};

function settingsToForm(s: any): SettingsForm {
  return {
    school_type: s.school_type ?? 'day',
    enable_notifications: s.enable_notifications ?? true,
    parent_portal_enabled: s.parent_portal_enabled ?? true,
    student_portal_enabled: s.student_portal_enabled ?? true,
    separate_school_sections_data: s.separate_school_sections_data ?? false,
    enable_sms_notifications: s.enable_sms_notifications ?? false,
    enable_email_notifications: s.enable_email_notifications ?? true,
    default_period_type: s.default_period_type ?? 'term',
    school_week_start_day: s.school_week_start_day ?? 'monday',
    items_per_page: s.items_per_page ?? 25,
    date_format: s.date_format ?? 'DD/MM/YYYY',
    delete_archived_data_after_years: s.delete_archived_data_after_years ?? 7,
    backup_frequency_days: s.backup_frequency_days ?? 7,
    enable_automatic_backup: s.enable_automatic_backup ?? true,
    maintenance_mode: s.maintenance_mode ?? false,
    active_ai_config_id: s.active_ai_config ?? null,
    ai_billing_mode: s.ai_billing_mode ?? 'platform_wallet',
    active_whatsapp_config_id: s.active_whatsapp_config ?? null,
  };
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex-shrink-0 ml-3 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
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
      value
        ? danger ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-500'
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

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({ settings, aiConfigs, waConfigs, isSaving, onSave, onClose, canManageWhatsApp }: {
  settings: any;
  aiConfigs: SchoolAIConfig[];
  waConfigs: any[]; // Added WhatsApp Configs
  isSaving: boolean;
  onSave: (f: SettingsForm) => Promise<void>;
  onClose: () => void;
  canManageWhatsApp: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'academic' | 'system' | 'integrations'>('general');
  const [form, setForm] = useState<SettingsForm>(settings ? settingsToForm(settings) : DEFAULT_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaveError(null);
    try { await onSave(form); }
    catch (err: any) {
      const data = err?.response?.data;
      setSaveError(data?.detail || data?.message || err?.message || 'Failed to save settings.');
    }
  };

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'academic', label: 'Academic' },
    { id: 'system', label: 'System' },
    { id: 'integrations', label: 'Integrations' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col h-[85vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {settings ? 'Edit School Settings' : 'Create School Settings'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{saveError}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 flex-shrink-0 gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${activeTab === t.id ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable form */}
        <form id="school-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

            {/* General */}
            {activeTab === 'general' && (
              <>
                <div>
                  <label className={labelCls}>School Type</label>
                  <select value={form.school_type} onChange={e => set('school_type', e.target.value as 'day' | 'boarding' | 'mixed')} className={inputCls}>
                    <option value="day">Day School</option>
                    <option value="boarding">Boarding School</option>
                    <option value="mixed">Mixed (Day & Boarding)</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={form.enable_notifications} onChange={v => set('enable_notifications', v)} label="Notifications" description="System-wide notifications" />
                  <Toggle checked={form.parent_portal_enabled} onChange={v => set('parent_portal_enabled', v)} label="Parent Portal" description="Allow parents to access portal" />
                  <Toggle checked={form.student_portal_enabled} onChange={v => set('student_portal_enabled', v)} label="Student Portal" description="Allow students to access portal" />
                  <Toggle checked={form.separate_school_sections_data} onChange={v => set('separate_school_sections_data', v)} label="Separate Sections" description="Isolate section data" />
                  <Toggle checked={form.enable_sms_notifications} onChange={v => set('enable_sms_notifications', v)} label="SMS Notifications" description="Enable SMS system-wide" />
                  <Toggle checked={form.enable_email_notifications} onChange={v => set('enable_email_notifications', v)} label="Email Notifications" description="Enable email system-wide" />
                </div>
              </>
            )}

            {/* Academic */}
            {activeTab === 'academic' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Default Period Type</label>
                  <select value={form.default_period_type} onChange={e => set('default_period_type', e.target.value as 'term' | 'semester' | 'quarter' | 'trimester')} className={inputCls}>
                    <option value="term">Term</option>
                    <option value="semester">Semester</option>
                    <option value="quarter">Quarter</option>
                    <option value="trimester">Trimester</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Week Start Day</label>
                  <select value={form.school_week_start_day} onChange={e => set('school_week_start_day', e.target.value as 'monday' | 'sunday' | 'saturday')} className={inputCls}>
                    <option value="monday">Monday</option>
                    <option value="sunday">Sunday</option>
                    <option value="saturday">Saturday</option>
                  </select>
                </div>
              </div>
            )}

            {/* System */}
            {activeTab === 'system' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Items Per Page</label>
                    <select value={form.items_per_page} onChange={e => set('items_per_page', Number(e.target.value) as 10 | 25 | 50 | 100)} className={inputCls}>
                      {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Date Format</label>
                    <select value={form.date_format} onChange={e => set('date_format', e.target.value as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD')} className={inputCls}>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Archive Data After (Years)</label>
                    <input type="number" min={0} max={50} value={form.delete_archived_data_after_years}
                      onChange={e => set('delete_archived_data_after_years', Number(e.target.value))} className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">0 = never delete</p>
                  </div>
                  <div>
                    <label className={labelCls}>Backup Frequency (Days)</label>
                    <input type="number" min={1} max={365} value={form.backup_frequency_days}
                      onChange={e => set('backup_frequency_days', Number(e.target.value))} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  <Toggle checked={form.enable_automatic_backup} onChange={v => set('enable_automatic_backup', v)} label="Automatic Backup" description="Enable scheduled backups" />
                  <Toggle checked={form.maintenance_mode} onChange={v => set('maintenance_mode', v)} label="Maintenance Mode" description="Blocks non-admin access" />
                </div>
              </>
            )}

            {/* Integrations */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">

                {/* AI Billing & Setup */}
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>AI Billing Mode</label>
                    <select value={form.ai_billing_mode} onChange={e => set('ai_billing_mode', e.target.value as any)} className={inputCls}>
                      <option value="disabled">Disabled (No AI)</option>
                      <option value="platform_wallet">Platform Credits (School Wallet)</option>
                      <option value="school_owns_key">Bring Your Own Key (School API Key)</option>
                      <option value="staff_pays">Staff Pays (Personal Wallet)</option>
                      <option value="parent_pays">Parent Pays (Personal Wallet)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1.5">Determines how AI token usage is billed across the system.</p>
                  </div>

                  {form.ai_billing_mode === 'school_owns_key' && (
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="h-4 w-4 text-indigo-600" />
                        <h4 className="text-sm font-semibold text-indigo-900">Select School API Key</h4>
                      </div>
                      <p className="text-xs text-indigo-600 mb-3">Because you chose 'Bring Your Own Key', you must select an active configuration below.</p>

                      {aiConfigs.length === 0 ? (
                        <div className="p-3 bg-white rounded-lg border border-indigo-200 text-xs text-slate-500 text-center">
                          No active AI configurations found. Create one in Settings → AI Configs first.
                        </div>
                      ) : (
                        <select value={form.active_ai_config_id ?? ''}
                          onChange={e => set('active_ai_config_id', e.target.value ? Number(e.target.value) : null)}
                          className={inputCls}>
                          <option value="">— Select an AI Provider —</option>
                          {aiConfigs.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.provider} / {c.model_name})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {form.ai_billing_mode === 'platform_wallet' && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                      <Wallet className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-emerald-900">Platform Wallet Active</h4>
                        <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                          You are using the platform's central AI models. AI tasks will be deducted directly from your school's credit balance. No API keys are required.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <hr className="border-slate-100" />

                {/* WhatsApp Dropdown */}
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">W</span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800">WhatsApp Integration</h4>
                    </div>
                    {canManageWhatsApp ? (
                      <Link href="/dashboard/staff/communication/whatsapp-configs" onClick={onClose}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                        Manage Providers <ChevronRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                        <Lock className="h-3 w-3" /> Restricted
                      </span>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Active WhatsApp Provider</label>
                    {waConfigs.length === 0 ? (
                      <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
                        No WhatsApp configurations found. Please add one in Communication settings.
                      </div>
                    ) : (
                      <select value={form.active_whatsapp_config_id ?? ''}
                        onChange={e => set('active_whatsapp_config_id', e.target.value ? Number(e.target.value) : null)}
                        className={inputCls}>
                        <option value="">— None —</option>
                        {waConfigs.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.from_phone_number})</option>
                        ))}
                      </select>
                    )}
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      Select the default WhatsApp channel to use for automated school messages and the AI bot.
                    </p>
                  </div>
                </div>

              </div>
            )}

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="school-settings-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4" />{settings ? 'Save Changes' : 'Create Settings'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function SchoolSettingsPage() {
  const { hasPermission, user } = useAuth();
  const { authReady } = useRequireAuth();

  const [schoolSettings, setSchoolSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [aiConfigs, setAiConfigs] = useState<SchoolAIConfig[]>([]);
  const [waConfigs, setWaConfigs] = useState<any[]>([]); // To hold WhatsApp configs

  const canEdit = user?.is_superuser || hasPermission('school_configuration.change_schoolsettingsmodel');
  const canManageWhatsApp = user?.is_superuser || hasPermission('communication.manage_communication_settings');

  useEffect(() => {
    if (authReady && user) fetchAll();
  }, [authReady, user]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch Settings, AI Configs, and WhatsApp Configs concurrently
      const [settingsData, aiData, waData] = await Promise.all([
        schoolSettingsAPI.get(),
        aiConfigAPI.list().catch(() => []),
        whatsAppConfigAPI.list().catch(() => []),
      ]);

      if (settingsData === null) {
        setPageError('not_found');
        setSchoolSettings(null);
      } else {
        setSchoolSettings(settingsData);
        setPageError(null);
      }

      setAiConfigs(Array.isArray(aiData) ? aiData.filter((c: SchoolAIConfig) => c.is_active) : []);
      setWaConfigs(Array.isArray(waData) ? waData : []);

    } catch {
      setPageError('fetch_error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (form: SettingsForm) => {
    setIsSaving(true);
    try {
      const updated = schoolSettings
      ? await schoolSettingsAPI.update(form as any)
      : await schoolSettingsAPI.create(form as any);
      setSchoolSettings(updated);
      setIsEditing(false);
      setPageError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) { throw err; }
    finally { setIsSaving(false); }
  };

  if (!authReady || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
  );

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading school settings...</p>
      </div>
    </div>
  );

  if (pageError === 'fetch_error') return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">Couldn't load school settings.</p>
        <button onClick={fetchAll} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">Try Again</button>
      </div>
    </div>
  );

  if (pageError === 'not_found' && !schoolSettings) return (
    <>
      {isEditing && <SettingsModal settings={null} aiConfigs={aiConfigs} waConfigs={waConfigs} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} canManageWhatsApp={canManageWhatsApp} />}
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
            <Settings className="h-10 w-10 text-blue-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure Your School</h3>
            <p className="text-slate-400 text-sm">Set up your school's settings to customise the system.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200">
              <Sparkles className="h-5 w-5" /> Set Up School Settings
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to set up school settings.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const s = schoolSettings;
  const activeAI = aiConfigs.find(c => c.id === s?.active_ai_config) ?? s?.active_ai_config_details ?? null;
  const activeWA = s?.active_whatsapp_config_details;
  const hasWhatsApp = !!s?.active_whatsapp_config;

  return (
    <div className="space-y-6 pb-10">
      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && <SettingsModal settings={s} aiConfigs={aiConfigs} waConfigs={waConfigs} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} canManageWhatsApp={canManageWhatsApp} />}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Settings className="h-5 w-5 text-white" />
            </div>
            School Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">System-wide configuration and preferences</p>
        </div>
        {canEdit && (
          <button onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Edit3 className="h-4 w-4" /> Edit Settings
          </button>
        )}
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'School Type', value: s?.school_type ?? '—', icon: Building, color: 'from-blue-500 to-blue-600' },
          { label: 'Period Type', value: s?.default_period_type ?? '—', icon: Calendar, color: 'from-violet-500 to-purple-600' },
          { label: 'Date Format', value: s?.date_format ?? '—', icon: Monitor, color: 'from-teal-500 to-cyan-600' },
          { label: 'Items / Page', value: String(s?.items_per_page ?? 25), icon: Database, color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800 capitalize truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Settings sections ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Portals & Notifications */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Portals & Notifications</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Users} iconBg="bg-blue-50 text-blue-600" label="Parent Portal" description="Parent access to the portal"
              value={<StatusBadge value={s?.parent_portal_enabled} />} />
            <SettingRow icon={Users} iconBg="bg-indigo-50 text-indigo-600" label="Student Portal" description="Student access to the portal"
              value={<StatusBadge value={s?.student_portal_enabled} />} />
            <SettingRow icon={Bell} iconBg="bg-violet-50 text-violet-600" label="Notifications" description="System-wide notifications"
              value={<StatusBadge value={s?.enable_notifications} />} />
            <SettingRow icon={Mail} iconBg="bg-sky-50 text-sky-600" label="Email Notifications" description="Email alerts system-wide"
              value={<StatusBadge value={s?.enable_email_notifications} />} />
            <SettingRow icon={Smartphone} iconBg="bg-emerald-50 text-emerald-600" label="SMS Notifications" description="SMS alerts system-wide"
              value={<StatusBadge value={s?.enable_sms_notifications} />} />
            <SettingRow icon={Building} iconBg="bg-amber-50 text-amber-600" label="Separate Sections" description="Isolate section data"
              value={<StatusBadge value={s?.separate_school_sections_data} activeLabel="On" inactiveLabel="Off" />} />
          </div>
        </div>

        {/* System & Backup */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
              <Monitor className="h-3.5 w-3.5 text-teal-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">System & Backup</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Monitor} iconBg="bg-teal-50 text-teal-600" label="Date Format" description="Date display across the system"
              value={<span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{s?.date_format ?? 'DD/MM/YYYY'}</span>} />
            <SettingRow icon={Database} iconBg="bg-orange-50 text-orange-600" label="Items Per Page" description="Default list page size"
              value={<span className="text-xs font-bold text-slate-700">{s?.items_per_page ?? 25}</span>} />
            <SettingRow icon={Database} iconBg="bg-cyan-50 text-cyan-600" label="Auto Backup" description="Scheduled database backups"
              value={<StatusBadge value={s?.enable_automatic_backup} />} />
            <SettingRow icon={Database} iconBg="bg-blue-50 text-blue-600" label="Backup Frequency" description="Days between backups"
              value={<span className="text-xs font-bold text-slate-700">Every {s?.backup_frequency_days ?? 7}d</span>} />
            <SettingRow icon={Database} iconBg="bg-purple-50 text-purple-600" label="Archive Retention" description="Years before data deletion"
              value={<span className="text-xs font-bold text-slate-700">{s?.delete_archived_data_after_years === 0 ? 'Never' : `${s?.delete_archived_data_after_years ?? 7} yrs`}</span>} />
            <SettingRow icon={Shield} iconBg="bg-red-50 text-red-500" label="Maintenance Mode" description="Blocks non-admin access"
              value={<StatusBadge value={s?.maintenance_mode} activeLabel="Active" inactiveLabel="Inactive" danger />} />
          </div>
        </div>

        {/* AI & Integrations */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">AI & Integrations</h3>
          </div>
          <div className="p-4 space-y-4 flex-1">

            {/* AI Billing Mode Info */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Billing Mode</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 uppercase">
                  {s?.ai_billing_mode?.replace(/_/g, ' ') || 'Platform Wallet'}
                </span>
              </div>

              {s?.ai_billing_mode === 'platform_wallet' ? (
                <div className="flex items-start gap-2 mt-2">
                  <Wallet className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Using platform credits. Features deduct directly from the school's central wallet.
                  </p>
                </div>
              ) : s?.ai_billing_mode === 'school_owns_key' ? (
                 <div className="mt-3">
                   {activeAI ? (
                     <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                       <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100 flex-shrink-0">
                         <Key className="h-4 w-4 text-indigo-600" />
                       </div>
                       <div className="min-w-0">
                         <p className="text-xs font-bold text-slate-800 truncate">{activeAI.name}</p>
                         <p className="text-[10px] text-slate-500 truncate">{activeAI.provider} • {activeAI.model_name}</p>
                       </div>
                     </div>
                   ) : (
                     <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 font-medium text-center">
                       API Key Missing — AI Features Disabled
                     </div>
                   )}
                 </div>
              ) : s?.ai_billing_mode === 'disabled' ? (
                 <p className="text-xs text-slate-500 mt-2">All AI features are disabled system-wide.</p>
              ) : (
                 <p className="text-xs text-slate-500 mt-2">Individual users pay for their own AI usage via personal wallets.</p>
              )}
            </div>

            {/* WhatsApp Integration Display */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-[104px]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">W</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">WhatsApp Config</h4>
                </div>
                {hasWhatsApp && (
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_#d1fae5] flex-shrink-0"></span>
                )}
              </div>

              {activeWA ? (
                <div className="mb-auto mt-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{activeWA.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{activeWA.from_phone_number} • {activeWA.provider}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed mb-auto line-clamp-2 mt-1">
                  No active WhatsApp configuration. Bots and automated messaging are currently disabled.
                </p>
              )}

              {canManageWhatsApp ? (
                <Link href="/dashboard/staff/communication/whatsapp-configs"
                  className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors w-fit">
                  Manage in Communication <ChevronRight className="h-3 w-3" />
                </Link>
              ) : (
                <span className="mt-3 text-[11px] font-medium text-slate-400 flex items-center gap-1 w-fit uppercase tracking-wider">
                  <Lock className="h-3 w-3" /> Restricted Access
                </span>
              )}
            </div>

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
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-5">Setting</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Value</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { label: 'School Type', value: <span className="capitalize text-sm text-slate-700">{s?.school_type ?? '—'}</span>, desc: 'Type of school accommodation' },
                { label: 'Enable Notifications', value: <StatusBadge value={s?.enable_notifications} />, desc: 'Allow system-wide notifications' },
                { label: 'Parent Portal', value: <StatusBadge value={s?.parent_portal_enabled} />, desc: 'Allow parents to access the portal' },
                { label: 'Student Portal', value: <StatusBadge value={s?.student_portal_enabled} />, desc: 'Allow students to access the portal' },
                { label: 'Separate Sections', value: <StatusBadge value={s?.separate_school_sections_data} activeLabel="On" inactiveLabel="Off" />, desc: 'Keep section data isolated' },
                { label: 'SMS Notifications', value: <StatusBadge value={s?.enable_sms_notifications} />, desc: 'Enable SMS alerts system-wide' },
                { label: 'Email Notifications', value: <StatusBadge value={s?.enable_email_notifications} />, desc: 'Enable email alerts system-wide' },
                { label: 'Default Period Type', value: <span className="capitalize text-sm text-slate-700">{s?.default_period_type ?? '—'}</span>, desc: 'Academic period structure' },
                { label: 'Week Start Day', value: <span className="capitalize text-sm text-slate-700">{s?.school_week_start_day ?? '—'}</span>, desc: 'First day of the school week' },
                { label: 'Items Per Page', value: <span className="text-sm font-medium text-slate-700">{s?.items_per_page ?? 25}</span>, desc: 'Default pagination size in lists' },
                { label: 'Date Format', value: <span className="font-mono text-sm text-slate-700">{s?.date_format ?? 'DD/MM/YYYY'}</span>, desc: 'Date display format throughout the system' },
                { label: 'Archive Retention', value: <span className="text-sm text-slate-700">{s?.delete_archived_data_after_years === 0 ? 'Never delete' : `${s?.delete_archived_data_after_years ?? 7} years`}</span>, desc: 'Years to keep archived data (0 = never)' },
                { label: 'Automatic Backup', value: <StatusBadge value={s?.enable_automatic_backup} />, desc: 'Scheduled database backups' },
                { label: 'Backup Frequency', value: <span className="text-sm text-slate-700">Every {s?.backup_frequency_days ?? 7} days</span>, desc: 'Days between automatic backups' },
                { label: 'Maintenance Mode', value: <StatusBadge value={s?.maintenance_mode} activeLabel="Active" inactiveLabel="Inactive" danger />, desc: 'Blocks non-admin access when active' },
                { label: 'AI Billing Mode', value: <span className="capitalize text-sm font-semibold text-slate-700">{s?.ai_billing_mode?.replace(/_/g, ' ') || 'Platform Wallet'}</span>, desc: 'Determines who pays for AI usage across all modules' },
                { label: 'Custom AI Provider', value: activeAI
                  ? <span className="text-sm font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">{activeAI.name}</span>
                  : <span className="text-xs text-slate-400">Not configured</span>, desc: 'Custom API key used if billing mode is set to "School Owns Key"' },
                { label: 'Active WhatsApp Config', value: activeWA
                  ? <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">{activeWA.name}</span>
                  : <span className="text-xs text-slate-400">Not configured</span>, desc: 'Active WhatsApp channel used for bot replies and notifications' },
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