'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { hrSettingsAPI } from '@/lib/api';
import { HRSettings } from '@/lib/types';
import {
  Settings, Edit3, Users, Check, X, AlertCircle, Sparkles,
  Database, Shield, Calendar, Loader2, IdCard, Key,
  ToggleLeft, Hash, Barcode, UserCheck, Lock, Clock,
  ChevronRight, RefreshCw,
} from 'lucide-react';

// ─── Default form values ───────────────────────────────────────────────────────
const DEFAULT_FORM: HRSettings = {
  auto_generate_staff_id: true,
  staff_id_prefix: 'STF',
  staff_id_length: 4,
  generate_staff_barcode: false,
  use_salary_fields: false,
  use_health_fields: false,
  auto_generate_staff_logins: false,
  staff_username_type: 'email',
  staff_password_type: 'random_alphanumeric',
  staff_password_length: 8,
  auto_approve_leave: false,
  allow_leave_staff_login: true,
  updated_at: '',
  created_at: '',
};

function settingsToForm(s: HRSettings): HRSettings {
  return {
    auto_generate_staff_id: s.auto_generate_staff_id ?? true,
    staff_id_prefix: s.staff_id_prefix ?? 'STF',
    staff_id_length: s.staff_id_length ?? 4,
    generate_staff_barcode: s.generate_staff_barcode ?? false,
    use_salary_fields: s.use_salary_fields ?? false,
    use_health_fields: s.use_health_fields ?? false,
    auto_generate_staff_logins: s.auto_generate_staff_logins ?? false,
    staff_username_type: s.staff_username_type ?? 'email',
    staff_password_type: s.staff_password_type ?? 'random_alphanumeric',
    staff_password_length: s.staff_password_length ?? 8,
    auto_approve_leave: s.auto_approve_leave ?? false,
    allow_leave_staff_login: s.allow_leave_staff_login ?? true,
    updated_at: s.updated_at ?? '',
    created_at: s.created_at ?? '',
  };
}

// ─── Reusable Toggle ───────────────────────────────────────────────────────────
function Toggle({
  checked, onChange, label, description,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
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
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({
  value, activeLabel = 'Enabled', inactiveLabel = 'Disabled', danger = false,
}: {
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

// ─── Setting Row ───────────────────────────────────────────────────────────────
function SettingRow({
  icon: Icon, iconBg, label, value, description,
}: {
  icon: any; iconBg: string; label: string; value: React.ReactNode; description: string;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 px-4 hover:bg-slate-50/70 rounded-xl transition-colors">
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

// ─── Input ─────────────────────────────────────────────────────────────────────
const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  settings, isSaving, onSave, onClose,
}: {
  settings: HRSettings | null;
  isSaving: boolean;
  onSave: (f: HRSettings) => Promise<void>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'staff_id' | 'login' | 'leave'>('general');
  // KEY FIX: form is fully controlled React state — no hidden/unrendered DOM fields
  const [form, setForm] = useState<HRSettings>(settings ? settingsToForm(settings) : DEFAULT_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof HRSettings>(key: K, value: HRSettings[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.details) {
        const msgs = Object.entries(data.details)
          .map(([f, m]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(m) ? m.join(', ') : m}`)
          .join('\n');
        setSaveError(msgs);
      } else {
        setSaveError(data?.message || err?.message || 'Failed to save HR settings.');
      }
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'staff_id' as const, label: 'Staff ID', icon: IdCard },
    { id: 'login' as const, label: 'Login Generation', icon: Key },
    { id: 'leave' as const, label: 'Leave', icon: Calendar },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {settings ? 'Edit HR Settings' : 'Create HR Settings'}
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
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.id ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <form id="hr-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* ── General ── */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Control which optional field groups are shown in staff forms.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={form.use_salary_fields} onChange={v => set('use_salary_fields', v)}
                    label="Salary Fields" description="Show salary-related fields in staff forms" />
                  <Toggle checked={form.use_health_fields} onChange={v => set('use_health_fields', v)}
                    label="Health Fields" description="Show blood group, genotype, medical conditions" />
                </div>
              </div>
            )}

            {/* ── Staff ID ── */}
            {activeTab === 'staff_id' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure how staff IDs are generated and formatted.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={form.auto_generate_staff_id} onChange={v => set('auto_generate_staff_id', v)}
                    label="Auto Generate Staff ID" description="Automatically assign sequential IDs" />
                  <Toggle checked={form.generate_staff_barcode} onChange={v => set('generate_staff_barcode', v)}
                    label="Generate Barcode" description="Create barcode image for each staff ID" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Staff ID Prefix</label>
                    <input type="text" value={form.staff_id_prefix} onChange={e => set('staff_id_prefix', e.target.value)}
                      maxLength={10} placeholder="e.g. STF" className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Result preview: <span className="font-mono font-semibold text-slate-600">{form.staff_id_prefix || 'STF'}-{String(1).padStart(form.staff_id_length || 4, '0')}</span></p>
                  </div>
                  <div>
                    <label className={labelCls}>ID Number Length</label>
                    <input type="number" value={form.staff_id_length} onChange={e => set('staff_id_length', Number(e.target.value))}
                      min={1} max={10} className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Number of digits (1–10)</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Login Generation ── */}
            {activeTab === 'login' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure how staff login credentials are auto-generated when a new staff is created.</p>
                <Toggle checked={form.auto_generate_staff_logins} onChange={v => set('auto_generate_staff_logins', v)}
                  label="Auto Generate Staff Logins" description="Automatically create Django user accounts for new staff" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Username Format</label>
                    <select value={form.staff_username_type} onChange={e => set('staff_username_type', e.target.value as any)} className={inputCls}>
                      <option value="email">Email Address</option>
                      <option value="staff_id">Staff ID</option>
                      <option value="custom">Custom (First + Last Name)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Password Format</label>
                    <select value={form.staff_password_type} onChange={e => set('staff_password_type', e.target.value as any)} className={inputCls}>
                      <option value="random_alphanumeric">Random Alphanumeric</option>
                      <option value="random_alpha">Random Alphabetic</option>
                      <option value="random_special">Random with Special Characters</option>
                      <option value="first_name">First Name</option>
                      <option value="last_name">Last Name</option>
                      <option value="first_last">First + Last Name</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Password Length</label>
                    <input type="number" value={form.staff_password_length} onChange={e => set('staff_password_length', Number(e.target.value))}
                      min={6} max={20} className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Minimum 6 characters</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Leave ── */}
            {activeTab === 'leave' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure leave request handling and access rules.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={form.auto_approve_leave} onChange={v => set('auto_approve_leave', v)}
                    label="Auto Approve Leave" description="Instantly approve all leave requests" />
                  <Toggle checked={form.allow_leave_staff_login} onChange={v => set('allow_leave_staff_login', v)}
                    label="Allow Login on Leave" description="Staff on leave can still log into the portal" />
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
          <button type="submit" form="hr-settings-form" disabled={isSaving}
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function HRSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [hrSettings, setHRSettings] = useState<HRSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('human_resource.change_hrsettingmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await hrSettingsAPI.get();
      if (data === null) { setPageError('not_found'); setHRSettings(null); }
      else { setHRSettings(data); }
    } catch { setPageError('fetch_error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (form: HRSettings) => {
    setIsSaving(true);
    try {
      const updated = hrSettings
        ? await hrSettingsAPI.update(form)
        : await hrSettingsAPI.create(form);
      setHRSettings(updated);
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
  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading HR settings...</p>
      </div>
    </div>
  );

  // ── Fetch error ──
  if (pageError === 'fetch_error') return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">Couldn't load HR settings. Please try again.</p>
        <button onClick={fetchSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  // ── Not found (first-time setup) ──
  if (pageError === 'not_found' && !hrSettings) return (
    <>
      {isEditing && <SettingsModal settings={null} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
            <Users className="h-10 w-10 text-blue-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure HR Settings</h3>
            <p className="text-slate-400 text-sm">Set up your HR module to customise staff management for your school.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200">
              <Sparkles className="h-5 w-5" /> Set Up HR Settings
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to set up HR settings. Please contact an administrator.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const s = hrSettings!;
  const previewId = `${s.staff_id_prefix || 'STF'}-${String(1).padStart(s.staff_id_length || 4, '0')}`;

  return (
    <div className="space-y-6 pb-10">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">HR settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && <SettingsModal settings={s} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Users className="h-5 w-5 text-white" />
            </div>
            HR Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Human resource configuration and preferences</p>
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
          { label: 'Staff ID Format', value: previewId, icon: IdCard, color: 'from-blue-500 to-blue-600' },
          { label: 'Username Format', value: s.staff_username_type?.replace(/_/g, ' ') ?? 'email', icon: UserCheck, color: 'from-violet-500 to-purple-600' },
          { label: 'Password Format', value: s.staff_password_type?.replace(/_/g, ' ') ?? '—', icon: Lock, color: 'from-teal-500 to-cyan-600' },
          { label: 'Password Length', value: `${s.staff_password_length ?? 8} chars`, icon: Hash, color: 'from-orange-400 to-amber-500' },
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

      {/* ── Three cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Staff ID & General */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <IdCard className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Staff ID & General</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={IdCard} iconBg="bg-blue-50 text-blue-600" label="Auto Generate Staff ID"
              description="Automatically assign sequential IDs" value={<StatusBadge value={s.auto_generate_staff_id} />} />
            <SettingRow icon={Barcode} iconBg="bg-indigo-50 text-indigo-600" label="Generate Barcode"
              description="Create barcode for each staff ID" value={<StatusBadge value={s.generate_staff_barcode} />} />
            <SettingRow icon={Hash} iconBg="bg-violet-50 text-violet-600" label="ID Prefix"
              description="Prefix attached to all staff IDs"
              value={<span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{s.staff_id_prefix || 'STF'}</span>} />
            <SettingRow icon={Hash} iconBg="bg-purple-50 text-purple-600" label="ID Number Length"
              description="Digits in the sequential number"
              value={<span className="text-xs font-bold text-slate-700">{s.staff_id_length ?? 4} digits</span>} />
            <SettingRow icon={Settings} iconBg="bg-sky-50 text-sky-600" label="Salary Fields"
              description="Show salary fields in staff forms" value={<StatusBadge value={s.use_salary_fields} />} />
            <SettingRow icon={Settings} iconBg="bg-teal-50 text-teal-600" label="Health Fields"
              description="Show health fields in staff forms" value={<StatusBadge value={s.use_health_fields} />} />
          </div>
        </div>

        {/* Login Generation */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
              <Key className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Login Generation</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={UserCheck} iconBg="bg-violet-50 text-violet-600" label="Auto Generate Logins"
              description="Create login accounts for new staff" value={<StatusBadge value={s.auto_generate_staff_logins} />} />
            <SettingRow icon={UserCheck} iconBg="bg-blue-50 text-blue-600" label="Username Format"
              description="How usernames are formed"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.staff_username_type?.replace(/_/g, ' ') ?? 'email'}</span>} />
            <SettingRow icon={Lock} iconBg="bg-indigo-50 text-indigo-600" label="Password Format"
              description="How passwords are generated"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.staff_password_type?.replace(/_/g, ' ') ?? '—'}</span>} />
            <SettingRow icon={Hash} iconBg="bg-purple-50 text-purple-600" label="Password Length"
              description="Minimum password character count"
              value={<span className="text-xs font-bold text-slate-700">{s.staff_password_length ?? 8} chars</span>} />
          </div>
        </div>

        {/* Leave Settings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <Calendar className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Leave Settings</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Calendar} iconBg="bg-orange-50 text-orange-600" label="Auto Approve Leave"
              description="Automatically approve all leave requests" value={<StatusBadge value={s.auto_approve_leave} />} />
            <SettingRow icon={Clock} iconBg="bg-amber-50 text-amber-600" label="Allow Login on Leave"
              description="Staff on leave can still log into the portal"
              value={<StatusBadge value={s.allow_leave_staff_login} activeLabel="Allowed" inactiveLabel="Blocked" />} />
          </div>

          {/* ID preview card */}
          <div className="mx-4 mb-4 mt-2 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">Staff ID Preview</p>
            <p className="text-2xl font-mono font-bold text-blue-800">{previewId}</p>
            <p className="text-xs text-blue-500 mt-1">Based on current prefix &amp; length settings</p>
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
                { label: 'Auto Generate Staff ID', value: <StatusBadge value={s.auto_generate_staff_id} />, desc: 'Automatically assign sequential IDs to new staff' },
                { label: 'Staff ID Prefix', value: <span className="font-mono text-sm font-semibold text-slate-700">{s.staff_id_prefix || 'STF'}</span>, desc: 'Prefix prepended to all staff IDs' },
                { label: 'Staff ID Length', value: <span className="text-sm text-slate-700">{s.staff_id_length ?? 4} digits</span>, desc: 'Number of digits in the sequential part of the ID' },
                { label: 'Generate Staff Barcode', value: <StatusBadge value={s.generate_staff_barcode} />, desc: 'Generate a barcode image for each staff ID card' },
                { label: 'Use Salary Fields', value: <StatusBadge value={s.use_salary_fields} />, desc: 'Show salary-related fields in staff registration forms' },
                { label: 'Use Health Fields', value: <StatusBadge value={s.use_health_fields} />, desc: 'Show blood group, genotype, and medical condition fields' },
                { label: 'Auto Generate Logins', value: <StatusBadge value={s.auto_generate_staff_logins} />, desc: 'Automatically create Django user accounts for new staff' },
                { label: 'Username Format', value: <span className="capitalize text-sm text-slate-700">{s.staff_username_type?.replace(/_/g, ' ') ?? 'email'}</span>, desc: 'How staff usernames are generated' },
                { label: 'Password Format', value: <span className="capitalize text-sm text-slate-700">{s.staff_password_type?.replace(/_/g, ' ') ?? '—'}</span>, desc: 'How staff default passwords are generated' },
                { label: 'Password Length', value: <span className="text-sm text-slate-700">{s.staff_password_length ?? 8} characters</span>, desc: 'Minimum length for auto-generated passwords' },
                { label: 'Auto Approve Leave', value: <StatusBadge value={s.auto_approve_leave} />, desc: 'Skip manual approval and automatically approve all leave requests' },
                { label: 'Allow Login on Leave', value: <StatusBadge value={s.allow_leave_staff_login} activeLabel="Allowed" inactiveLabel="Blocked" />, desc: 'Whether staff currently on leave can log into the portal' },
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

      {/* Last updated */}
      {s.updated_at && (
        <p className="text-xs text-slate-400 text-right">
          Last updated: {new Date(s.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}