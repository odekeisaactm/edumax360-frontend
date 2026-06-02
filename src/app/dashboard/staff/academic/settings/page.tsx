// app/dashboard/staff/academic/settings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicAPI } from '@/lib/api';
import { AcademicSettings } from '@/lib/types';
import {
  GraduationCap, Edit3, Users, Check, X, AlertCircle, Sparkles,
  BookOpen, ArrowUpCircle, Loader2, ToggleLeft, Hash, UserCheck,
  Settings, ChevronRight, RefreshCw, Percent, Shield,
} from 'lucide-react';

// ─── Default form values ───────────────────────────────────────────────────────
const DEFAULT_FORM: Partial<AcademicSettings> = {
  use_class_sections: false,
  auto_promote_students: true,
  promotion_cutoff_score: '40',
  use_promotion_cutoff: false,
  max_students_per_class: 60,
  enable_subject_registration: true,
};

function settingsToForm(s: AcademicSettings): Partial<AcademicSettings> {
  return {
    use_class_sections: s.use_class_sections ?? false,
    auto_promote_students: s.auto_promote_students ?? true,
    promotion_cutoff_score: s.promotion_cutoff_score ?? '40',
    use_promotion_cutoff: s.use_promotion_cutoff ?? false,
    max_students_per_class: s.max_students_per_class ?? 60,
    enable_subject_registration: s.enable_subject_registration ?? true,
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

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  settings, isSaving, onSave, onClose,
}: {
  settings: AcademicSettings | null;
  isSaving: boolean;
  onSave: (f: Partial<AcademicSettings>) => Promise<void>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'classes' | 'promotion' | 'subjects'>('classes');
  const [form, setForm] = useState<Partial<AcademicSettings>>(
    settings ? settingsToForm(settings) : DEFAULT_FORM
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof AcademicSettings>(key: K, value: AcademicSettings[K]) =>
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
        setSaveError(data?.message || err?.message || 'Failed to save academic settings.');
      }
    }
  };

  const tabs = [
    { id: 'classes' as const, label: 'Classes', icon: Users },
    { id: 'promotion' as const, label: 'Promotion', icon: ArrowUpCircle },
    { id: 'subjects' as const, label: 'Subjects', icon: BookOpen },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {settings ? 'Edit Academic Settings' : 'Create Academic Settings'}
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
        <form id="academic-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* ── Classes ── */}
            {activeTab === 'classes' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure class structure and capacity settings.</p>
                <Toggle
                  checked={form.use_class_sections ?? false}
                  onChange={v => set('use_class_sections', v)}
                  label="Use Class Sections"
                  description="Enable class arms/sections (e.g., JSS1A, JSS1B, JSS1C)"
                />
                <div>
                  <label className={labelCls}>Max Students Per Class</label>
                  <input
                    type="number"
                    value={form.max_students_per_class ?? 60}
                    onChange={e => set('max_students_per_class', parseInt(e.target.value) || 60)}
                    min={1} max={200}
                    className={inputCls}
                  />
                  <p className="text-xs text-slate-400 mt-1">Maximum number of students allowed per class configuration (1–200)</p>
                </div>
              </div>
            )}

            {/* ── Promotion ── */}
            {activeTab === 'promotion' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure how students are promoted at the end of each session.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle
                    checked={form.auto_promote_students ?? true}
                    onChange={v => set('auto_promote_students', v)}
                    label="Auto Promote Students"
                    description="Automatically promote at end of session"
                  />
                  <Toggle
                    checked={form.use_promotion_cutoff ?? false}
                    onChange={v => set('use_promotion_cutoff', v)}
                    label="Use Promotion Cutoff"
                    description="Require minimum score to be promoted"
                  />
                </div>
                <div>
                  <label className={labelCls}>Promotion Cutoff Score (%)</label>
                  <input
                    type="number"
                    value={form.promotion_cutoff_score ?? '40'}
                    onChange={e => set('promotion_cutoff_score', e.target.value)}
                    min={0} max={100} step={0.01}
                    className={inputCls}
                  />
                  <p className="text-xs text-slate-400 mt-1">Minimum score required for promotion (0–100). Only applies if cutoff is enabled.</p>
                </div>
              </div>
            )}

            {/* ── Subjects ── */}
            {activeTab === 'subjects' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure subject registration and assignment settings.</p>
                <Toggle
                  checked={form.enable_subject_registration ?? true}
                  onChange={v => set('enable_subject_registration', v)}
                  label="Enable Subject Registration"
                  description="Allow students to register for elective subjects"
                />
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
          <button type="submit" form="academic-settings-form" disabled={isSaving}
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
export default function AcademicSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [settings, setSettings] = useState<AcademicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('academic.change_academicsettingmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await academicAPI.getSettings();
      if (data === null) { setPageError('not_found'); setSettings(null); }
      else { setSettings(data); }
    } catch { setPageError('fetch_error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (form: Partial<AcademicSettings>) => {
    setIsSaving(true);
    try {
      const updated = await academicAPI.updateSettings(form);
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
        <p className="text-slate-400 text-sm">Loading academic settings...</p>
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
        <p className="text-sm text-slate-500">Couldn't load academic settings. Please try again.</p>
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
            <GraduationCap className="h-10 w-10 text-blue-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure Academic Settings</h3>
            <p className="text-slate-400 text-sm">Set up your academic module to customise class structures, promotions, and subject management.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200">
              <Sparkles className="h-5 w-5" /> Set Up Academic Settings
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to set up academic settings. Please contact an administrator.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const s = settings!;
  const cutoffDisplay = `${s.promotion_cutoff_score ?? '40'}%`;

  return (
    <div className="space-y-6 pb-10">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Academic settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && <SettingsModal settings={s} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            Academic Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Academic structure and promotion configuration</p>
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
          { label: 'Class Sections', value: s.use_class_sections ? 'Enabled' : 'Disabled', icon: Users, color: 'from-blue-500 to-blue-600' },
          { label: 'Max Per Class', value: `${s.max_students_per_class ?? 60} students`, icon: Hash, color: 'from-violet-500 to-purple-600' },
          { label: 'Cutoff Score', value: cutoffDisplay, icon: Percent, color: 'from-teal-500 to-cyan-600' },
          { label: 'Auto Promote', value: s.auto_promote_students ? 'On' : 'Off', icon: ArrowUpCircle, color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Three cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Class Settings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Class Settings</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Users} iconBg="bg-blue-50 text-blue-600" label="Use Class Sections"
              description="Enable class arms (JSS1A, JSS1B, etc.)"
              value={<StatusBadge value={s.use_class_sections} />} />
            <SettingRow icon={Hash} iconBg="bg-indigo-50 text-indigo-600" label="Max Students Per Class"
              description="Capacity limit per class configuration"
              value={<span className="text-xs font-bold text-slate-700">{s.max_students_per_class ?? 60} students</span>} />
          </div>

          {/* Section preview card */}
          <div className="mx-4 mb-4 mt-2 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Class Name Preview</p>
            <div className="flex gap-2 flex-wrap">
              {s.use_class_sections
                ? ['JSS1 A', 'JSS1 B', 'SS2 A'].map(c => (
                    <span key={c} className="text-sm font-mono font-bold text-blue-800 bg-white px-2 py-1 rounded-lg border border-blue-100">{c}</span>
                  ))
                : ['JSS1', 'SS2', 'Primary 3'].map(c => (
                    <span key={c} className="text-sm font-mono font-bold text-blue-800 bg-white px-2 py-1 rounded-lg border border-blue-100">{c}</span>
                  ))
              }
            </div>
            <p className="text-xs text-blue-500 mt-2">{s.use_class_sections ? 'Sections enabled' : 'No sections'}</p>
          </div>
        </div>

        {/* Promotion Settings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
              <ArrowUpCircle className="h-3.5 w-3.5 text-green-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Promotion Settings</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={ArrowUpCircle} iconBg="bg-green-50 text-green-600" label="Auto Promote Students"
              description="Automatically promote at end of session"
              value={<StatusBadge value={s.auto_promote_students} />} />
            <SettingRow icon={Shield} iconBg="bg-teal-50 text-teal-600" label="Use Promotion Cutoff"
              description="Require minimum score for promotion"
              value={<StatusBadge value={s.use_promotion_cutoff} />} />
            <SettingRow icon={Percent} iconBg="bg-cyan-50 text-cyan-600" label="Cutoff Score"
              description="Minimum score required to be promoted"
              value={<span className="text-xs font-bold text-slate-700">{cutoffDisplay}</span>} />
          </div>
        </div>

        {/* Subject Settings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
              <BookOpen className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Subject Settings</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={BookOpen} iconBg="bg-purple-50 text-purple-600" label="Subject Registration"
              description="Allow students to register for subjects"
              value={<StatusBadge value={s.enable_subject_registration} activeLabel="Allowed" inactiveLabel="Disabled" />} />
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
                { label: 'Use Class Sections', value: <StatusBadge value={s.use_class_sections} />, desc: 'Enable class arms/sections (e.g., JSS1A, JSS1B)' },
                { label: 'Max Students Per Class', value: <span className="text-sm text-slate-700">{s.max_students_per_class ?? 60} students</span>, desc: 'Maximum number of students allowed per class configuration' },
                { label: 'Auto Promote Students', value: <StatusBadge value={s.auto_promote_students} />, desc: 'Automatically promote students at the end of each session' },
                { label: 'Use Promotion Cutoff', value: <StatusBadge value={s.use_promotion_cutoff} />, desc: 'Require students to meet a minimum score before being promoted' },
                { label: 'Promotion Cutoff Score', value: <span className="text-sm text-slate-700">{cutoffDisplay}</span>, desc: 'Minimum score (%) required for promotion when cutoff is enabled' },
                { label: 'Subject Registration', value: <StatusBadge value={s.enable_subject_registration} activeLabel="Allowed" inactiveLabel="Disabled" />, desc: 'Allow students to register for elective subjects' },
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