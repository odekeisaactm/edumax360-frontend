'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { studentSettingsAPI } from '@/lib/api';
import { StudentSettings } from '@/lib/types';
import {
  Settings, Edit3, Users, Check, X, AlertCircle, Sparkles,
  Shield, Barcode, Fingerprint, Key, Hash, UserCheck, Lock,
  RefreshCw, Loader2, IdCard, ToggleLeft, Smartphone,
} from 'lucide-react';

// ─── Default form values ───────────────────────────────────────────────────────
const DEFAULT_FORM: StudentSettings = {
  auto_generate_student_id: true,
  student_id_prefix: 'STU',
  auto_generate_parent_id: true,
  parent_id_prefix: 'PAR',
  use_health_fields: false,
  generate_barcode: false,
  enable_fingerprint: false,
  max_fingerprint_count: 2,
  auto_generate_logins: false,
  student_username_type: 'registration_number',
  student_password_type: 'registration_number',
  student_password_length: 8,
  parent_username_type: 'email',
  parent_password_type: 'random_alphanumeric',
  parent_password_length: 8,
  parent_portal_enabled: true,
  student_portal_enabled: true,
  show_user_form: true,
  updated_at: '',
};

function settingsToForm(s: StudentSettings): StudentSettings {
  return {
    auto_generate_student_id: s.auto_generate_student_id ?? true,
    student_id_prefix: s.student_id_prefix ?? 'STU',
    auto_generate_parent_id: s.auto_generate_parent_id ?? true,
    parent_id_prefix: s.parent_id_prefix ?? 'PAR',
    use_health_fields: s.use_health_fields ?? false,
    generate_barcode: s.generate_barcode ?? false,
    enable_fingerprint: s.enable_fingerprint ?? false,
    max_fingerprint_count: s.max_fingerprint_count ?? 2,
    auto_generate_logins: s.auto_generate_logins ?? false,
    student_username_type: s.student_username_type ?? 'registration_number',
    student_password_type: s.student_password_type ?? 'registration_number',
    student_password_length: s.student_password_length ?? 8,
    parent_username_type: s.parent_username_type ?? 'email',
    parent_password_type: s.parent_password_type ?? 'random_alphanumeric',
    parent_password_length: s.parent_password_length ?? 8,
    parent_portal_enabled: s.parent_portal_enabled ?? true,
    student_portal_enabled: s.student_portal_enabled ?? true,
    show_user_form: s.show_user_form ?? true,
    updated_at: s.updated_at ?? '',
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
  value, activeLabel = 'Enabled', inactiveLabel = 'Disabled',
}: {
  value: boolean; activeLabel?: string; inactiveLabel?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-slate-400'}`} />
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

// ─── Input / Label helpers ─────────────────────────────────────────────────────
const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  settings, isSaving, onSave, onClose,
}: {
  settings: StudentSettings | null;
  isSaving: boolean;
  onSave: (f: StudentSettings) => Promise<void>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'ids' | 'login' | 'features'>('general');
  const [form, setForm] = useState<StudentSettings>(settings ? settingsToForm(settings) : DEFAULT_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof StudentSettings>(key: K, value: StudentSettings[K]) =>
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
        setSaveError(data?.message || err?.message || 'Failed to save student settings.');
      }
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'ids' as const, label: 'ID Generation', icon: IdCard },
    { id: 'login' as const, label: 'Login Generation', icon: Key },
    { id: 'features' as const, label: 'Features', icon: Sparkles },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {settings ? 'Edit Student Settings' : 'Create Student Settings'}
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
        <form id="student-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* ── General ── */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure portal access and general display preferences.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={form.parent_portal_enabled} onChange={v => set('parent_portal_enabled', v)}
                    label="Parent Portal" description="Allow parents to access the portal" />
                  <Toggle checked={form.student_portal_enabled} onChange={v => set('student_portal_enabled', v)}
                    label="Student Portal" description="Allow students to access the portal" />
                  <Toggle checked={form.use_health_fields} onChange={v => set('use_health_fields', v)}
                    label="Health Fields" description="Show blood group, genotype, medical conditions" />
                  <Toggle checked={form.show_user_form} onChange={v => set('show_user_form', v)}
                    label="Show User Form" description="Show account form during registration" />
                </div>
              </div>
            )}

            {/* ── ID Generation ── */}
            {activeTab === 'ids' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure how student and parent IDs are generated.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={form.auto_generate_student_id} onChange={v => set('auto_generate_student_id', v)}
                    label="Auto Generate Student ID" description="Automatically assign sequential IDs" />
                  <Toggle checked={form.auto_generate_parent_id} onChange={v => set('auto_generate_parent_id', v)}
                    label="Auto Generate Parent ID" description="Automatically assign sequential parent IDs" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Student ID Prefix</label>
                    <input type="text" value={form.student_id_prefix} onChange={e => set('student_id_prefix', e.target.value)}
                      maxLength={10} placeholder="e.g. STU" className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Preview: <span className="font-mono font-semibold text-slate-600">{form.student_id_prefix || 'STU'}-0001</span></p>
                  </div>
                  <div>
                    <label className={labelCls}>Parent ID Prefix</label>
                    <input type="text" value={form.parent_id_prefix} onChange={e => set('parent_id_prefix', e.target.value)}
                      maxLength={10} placeholder="e.g. PAR" className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Preview: <span className="font-mono font-semibold text-slate-600">{form.parent_id_prefix || 'PAR'}-0001</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Login Generation ── */}
            {activeTab === 'login' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure how login credentials are auto-generated for students and parents.</p>
                <Toggle checked={form.auto_generate_logins} onChange={v => set('auto_generate_logins', v)}
                  label="Auto Generate Logins" description="Automatically create login accounts on registration" />

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Student Login</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Username Format</label>
                      <select value={form.student_username_type} onChange={e => set('student_username_type', e.target.value as any)} className={inputCls}>
                        <option value="registration_number">Registration Number</option>
                        <option value="email">Email Address</option>
                        <option value="custom">Custom (First + Last Name)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Password Format</label>
                      <select value={form.student_password_type} onChange={e => set('student_password_type', e.target.value as any)} className={inputCls}>
                        <option value="registration_number">Registration Number</option>
                        <option value="dob">Date of Birth (DDMMYYYY)</option>
                        <option value="random_alphanumeric">Random Alphanumeric</option>
                        <option value="first_name">First Name</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Password Length</label>
                      <input type="number" value={form.student_password_length} onChange={e => set('student_password_length', Number(e.target.value))}
                        min={6} max={20} className={inputCls} />
                      <p className="text-xs text-slate-400 mt-1">Minimum 6 characters</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Parent Login</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Username Format</label>
                      <select value={form.parent_username_type} onChange={e => set('parent_username_type', e.target.value as any)} className={inputCls}>
                        <option value="email">Email Address</option>
                        <option value="parent_id">Parent ID</option>
                        <option value="mobile">Mobile Number</option>
                        <option value="custom">Custom (First + Last Name)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Password Format</label>
                      <select value={form.parent_password_type} onChange={e => set('parent_password_type', e.target.value as any)} className={inputCls}>
                        <option value="random_alphanumeric">Random Alphanumeric</option>
                        <option value="random_alpha">Random Alphabetic</option>
                        <option value="first_name">First Name</option>
                        <option value="last_name">Last Name</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Password Length</label>
                      <input type="number" value={form.parent_password_length} onChange={e => set('parent_password_length', Number(e.target.value))}
                        min={6} max={20} className={inputCls} />
                      <p className="text-xs text-slate-400 mt-1">Minimum 6 characters</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Features ── */}
            {activeTab === 'features' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Enable or disable optional features for student records.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={form.generate_barcode} onChange={v => set('generate_barcode', v)}
                    label="Generate Barcode" description="Generate barcode for each student" />
                  <Toggle checked={form.enable_fingerprint} onChange={v => set('enable_fingerprint', v)}
                    label="Enable Fingerprint" description="Enable fingerprint capture for students" />
                </div>
                <div>
                  <label className={labelCls}>Max Fingerprint Count</label>
                  <input type="number" value={form.max_fingerprint_count} onChange={e => set('max_fingerprint_count', Number(e.target.value))}
                    min={1} max={10} className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">Maximum fingerprints per student (1–10)</p>
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
          <button type="submit" form="student-settings-form" disabled={isSaving}
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
export default function StudentSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [settings, setSettings] = useState<StudentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('student_management.change_studentsettingmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await studentSettingsAPI.get();
      if (data === null) { setPageError('not_found'); setSettings(null); }
      else { setSettings(data); }
    } catch { setPageError('fetch_error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (form: StudentSettings) => {
    setIsSaving(true);
    try {
      const updated = settings
        ? await studentSettingsAPI.update(form)
        : await studentSettingsAPI.create(form);
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

  // ── Loading ──
  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading student settings...</p>
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
        <p className="text-sm text-slate-500">Couldn't load student settings. Please try again.</p>
        <button onClick={fetchSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  // ── Not found (first-time setup) ──
  if (pageError === 'not_found' && !settings) return (
    <>
      {isEditing && <SettingsModal settings={null} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
            <Users className="h-10 w-10 text-blue-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure Student Settings</h3>
            <p className="text-slate-400 text-sm">Set up student management to customise how students and parents are registered and managed.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200">
              <Sparkles className="h-5 w-5" /> Set Up Student Settings
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to set up student settings. Please contact an administrator.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const s = settings!;
  const studentIdPreview = `${s.student_id_prefix || 'STU'}-0001`;
  const parentIdPreview = `${s.parent_id_prefix || 'PAR'}-0001`;

  return (
    <div className="space-y-6 pb-10">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Student settings saved successfully!</p>
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
            Student Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Student & parent management configuration</p>
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
          { label: 'Student ID Format', value: studentIdPreview, icon: IdCard, color: 'from-blue-500 to-blue-600' },
          { label: 'Parent ID Format', value: parentIdPreview, icon: IdCard, color: 'from-violet-500 to-purple-600' },
          { label: 'Student Username', value: s.student_username_type?.replace(/_/g, ' ') ?? '—', icon: UserCheck, color: 'from-teal-500 to-cyan-600' },
          { label: 'Parent Username', value: s.parent_username_type?.replace(/_/g, ' ') ?? '—', icon: Smartphone, color: 'from-orange-400 to-amber-500' },
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

        {/* ID Generation & General */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <IdCard className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">ID Generation & General</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={IdCard} iconBg="bg-blue-50 text-blue-600" label="Auto Generate Student ID"
              description="Automatically assign sequential IDs" value={<StatusBadge value={s.auto_generate_student_id} />} />
            <SettingRow icon={IdCard} iconBg="bg-indigo-50 text-indigo-600" label="Auto Generate Parent ID"
              description="Automatically assign sequential parent IDs" value={<StatusBadge value={s.auto_generate_parent_id} />} />
            <SettingRow icon={Hash} iconBg="bg-violet-50 text-violet-600" label="Student ID Prefix"
              description="Prefix for student IDs"
              value={<span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{s.student_id_prefix || 'STU'}</span>} />
            <SettingRow icon={Hash} iconBg="bg-purple-50 text-purple-600" label="Parent ID Prefix"
              description="Prefix for parent IDs"
              value={<span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{s.parent_id_prefix || 'PAR'}</span>} />
            <SettingRow icon={Settings} iconBg="bg-sky-50 text-sky-600" label="Health Fields"
              description="Show health fields in student forms" value={<StatusBadge value={s.use_health_fields} />} />
            <SettingRow icon={Settings} iconBg="bg-teal-50 text-teal-600" label="Show User Form"
              description="Show account form during registration" value={<StatusBadge value={s.show_user_form} />} />
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
              description="Create login accounts on registration" value={<StatusBadge value={s.auto_generate_logins} />} />
            <SettingRow icon={UserCheck} iconBg="bg-blue-50 text-blue-600" label="Student Username"
              description="How student usernames are formed"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.student_username_type?.replace(/_/g, ' ') ?? '—'}</span>} />
            <SettingRow icon={Lock} iconBg="bg-indigo-50 text-indigo-600" label="Student Password"
              description="How student passwords are generated"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.student_password_type?.replace(/_/g, ' ') ?? '—'}</span>} />
            <SettingRow icon={Smartphone} iconBg="bg-teal-50 text-teal-600" label="Parent Username"
              description="How parent usernames are formed"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.parent_username_type?.replace(/_/g, ' ') ?? '—'}</span>} />
            <SettingRow icon={Lock} iconBg="bg-cyan-50 text-cyan-600" label="Parent Password"
              description="How parent passwords are generated"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.parent_password_type?.replace(/_/g, ' ') ?? '—'}</span>} />
          </div>
        </div>

        {/* Features & Portal */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Features & Portal</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Shield} iconBg="bg-green-50 text-green-600" label="Parent Portal"
              description="Allow parents to access the portal" value={<StatusBadge value={s.parent_portal_enabled} activeLabel="Enabled" inactiveLabel="Disabled" />} />
            <SettingRow icon={Shield} iconBg="bg-emerald-50 text-emerald-600" label="Student Portal"
              description="Allow students to access the portal" value={<StatusBadge value={s.student_portal_enabled} activeLabel="Enabled" inactiveLabel="Disabled" />} />
            <SettingRow icon={Barcode} iconBg="bg-orange-50 text-orange-600" label="Generate Barcode"
              description="Generate barcode for each student" value={<StatusBadge value={s.generate_barcode} />} />
            <SettingRow icon={Fingerprint} iconBg="bg-rose-50 text-rose-600" label="Enable Fingerprint"
              description="Enable fingerprint capture" value={<StatusBadge value={s.enable_fingerprint} />} />
            <SettingRow icon={Hash} iconBg="bg-amber-50 text-amber-600" label="Max Fingerprints"
              description="Maximum fingerprints per student"
              value={<span className="text-xs font-bold text-slate-700">{s.max_fingerprint_count ?? 2} per student</span>} />
          </div>

          {/* ID preview */}
          <div className="mx-4 mb-4 mt-2 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">ID Previews</p>
            <p className="text-lg font-mono font-bold text-blue-800">{studentIdPreview}</p>
            <p className="text-lg font-mono font-bold text-indigo-700">{parentIdPreview}</p>
            <p className="text-xs text-blue-500 mt-1">Based on current prefix settings</p>
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
                { label: 'Auto Generate Student ID', value: <StatusBadge value={s.auto_generate_student_id} />, desc: 'Automatically assign sequential IDs to new students' },
                { label: 'Student ID Prefix', value: <span className="font-mono text-sm font-semibold text-slate-700">{s.student_id_prefix || 'STU'}</span>, desc: 'Prefix prepended to all student IDs' },
                { label: 'Auto Generate Parent ID', value: <StatusBadge value={s.auto_generate_parent_id} />, desc: 'Automatically assign sequential IDs to new parents' },
                { label: 'Parent ID Prefix', value: <span className="font-mono text-sm font-semibold text-slate-700">{s.parent_id_prefix || 'PAR'}</span>, desc: 'Prefix prepended to all parent IDs' },
                { label: 'Use Health Fields', value: <StatusBadge value={s.use_health_fields} />, desc: 'Show blood group, genotype, and medical condition fields' },
                { label: 'Generate Barcode', value: <StatusBadge value={s.generate_barcode} />, desc: 'Generate a barcode image for each student' },
                { label: 'Enable Fingerprint', value: <StatusBadge value={s.enable_fingerprint} />, desc: 'Enable fingerprint capture for biometric access' },
                { label: 'Max Fingerprint Count', value: <span className="text-sm text-slate-700">{s.max_fingerprint_count ?? 2} per student</span>, desc: 'Maximum number of fingerprints per student' },
                { label: 'Auto Generate Logins', value: <StatusBadge value={s.auto_generate_logins} />, desc: 'Automatically create login accounts for students and parents' },
                { label: 'Student Username Format', value: <span className="capitalize text-sm text-slate-700">{s.student_username_type?.replace(/_/g, ' ') ?? '—'}</span>, desc: 'How student usernames are generated' },
                { label: 'Student Password Format', value: <span className="capitalize text-sm text-slate-700">{s.student_password_type?.replace(/_/g, ' ') ?? '—'}</span>, desc: 'How student default passwords are generated' },
                { label: 'Student Password Length', value: <span className="text-sm text-slate-700">{s.student_password_length ?? 8} characters</span>, desc: 'Minimum length for student auto-generated passwords' },
                { label: 'Parent Username Format', value: <span className="capitalize text-sm text-slate-700">{s.parent_username_type?.replace(/_/g, ' ') ?? '—'}</span>, desc: 'How parent usernames are generated' },
                { label: 'Parent Password Format', value: <span className="capitalize text-sm text-slate-700">{s.parent_password_type?.replace(/_/g, ' ') ?? '—'}</span>, desc: 'How parent default passwords are generated' },
                { label: 'Parent Password Length', value: <span className="text-sm text-slate-700">{s.parent_password_length ?? 8} characters</span>, desc: 'Minimum length for parent auto-generated passwords' },
                { label: 'Parent Portal', value: <StatusBadge value={s.parent_portal_enabled} />, desc: 'Allow parents to access the portal' },
                { label: 'Student Portal', value: <StatusBadge value={s.student_portal_enabled} />, desc: 'Allow students to access the portal' },
                { label: 'Show User Form', value: <StatusBadge value={s.show_user_form} />, desc: 'Show account form during student/parent registration' },
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