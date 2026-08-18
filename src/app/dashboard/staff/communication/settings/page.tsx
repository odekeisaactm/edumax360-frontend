'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  Settings, Edit3, Check, X, AlertCircle, Loader2, RefreshCw,
  MessageSquare, Users, Wallet, Clock, Zap, Shield, Smartphone, Globe, Hash
} from 'lucide-react';

// ─── Types & Defaults ──────────────────────────────────────────────────────────

export interface CommunicationSettings {
  id: number;
  whatsapp_mode: 'own_only' | 'platform_only' | 'fallback_to_platform';
  whatsapp_failure_timeout_seconds: number;
  sms_mode: 'own_only' | 'platform_only' | 'fallback_to_platform';
  default_require_active_ward_for_parents: boolean;
  platform_balance: string; // Read-only from API
  low_platform_balance_threshold: string;
  platform_sms_cost_per_page: string; // Read-only from API
  sms_page_character_length: number; // Read-only from API
  updated_at: string;
  created_at: string;
}

// Editable fields only
export interface EditableCommunicationSettings {
  whatsapp_mode: 'own_only' | 'platform_only' | 'fallback_to_platform';
  whatsapp_failure_timeout_seconds: number;
  sms_mode: 'own_only' | 'platform_only' | 'fallback_to_platform';
  default_require_active_ward_for_parents: boolean;
  low_platform_balance_threshold: string;
}

const DEFAULT_FORM: EditableCommunicationSettings = {
  whatsapp_mode: 'own_only',
  whatsapp_failure_timeout_seconds: 15,
  sms_mode: 'own_only',
  default_require_active_ward_for_parents: true,
  low_platform_balance_threshold: '500.00',
};

function settingsToForm(s: CommunicationSettings): EditableCommunicationSettings {
  return {
    whatsapp_mode: s.whatsapp_mode,
    whatsapp_failure_timeout_seconds: s.whatsapp_failure_timeout_seconds,
    sms_mode: s.sms_mode,
    default_require_active_ward_for_parents: s.default_require_active_ward_for_parents,
    low_platform_balance_threshold: s.low_platform_balance_threshold,
  };
}

function formatRoutingMode(val: string) {
  if (val === 'own_only') return "School's Account Only";
  if (val === 'platform_only') return "Platform Account Only";
  if (val === 'fallback_to_platform') return "School Account (Fallback)";
  return val;
}

// ─── API Wrapper ───────────────────────────────────────────────────────────────

const communicationSettingsAPI = {
  get: async (): Promise<CommunicationSettings | null> => {
    const res = await api.get('/api/communication/settings/');
    const data = res.data.results ? res.data.results[0] : res.data[0] || res.data;
    return data || null;
  },
  update: async (id: number, data: Partial<EditableCommunicationSettings>): Promise<CommunicationSettings> => {
    const res = await api.patch(`/api/communication/settings/${id}/`, data);
    return res.data;
  },
  create: async (data: Partial<EditableCommunicationSettings>): Promise<CommunicationSettings> => {
    const res = await api.post('/api/communication/settings/', data);
    return res.data;
  }
};

// ─── Reusable components ───────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
    <div className="flex items-start gap-4 py-3.5 px-4 hover:bg-slate-50/70 rounded-xl transition-colors">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <div className="flex-shrink-0 pt-1">{value}</div>
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none bg-white transition-shadow";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const selectCls = inputCls + " appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_0.9rem_center] bg-[length:1rem] pr-9";

// ─── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({ settings, isSaving, onSave, onClose }: {
  settings: CommunicationSettings | null;
  isSaving: boolean;
  onSave: (f: Partial<EditableCommunicationSettings>) => Promise<void>;
  onClose: () => void;
}) {
  type Tab = 'routing' | 'billing' | 'targeting';
  const [activeTab, setActiveTab] = useState<Tab>('routing');
  const [form, setForm] = useState<Partial<EditableCommunicationSettings>>(
    settings ? settingsToForm(settings) : DEFAULT_FORM
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof EditableCommunicationSettings>(key: K, value: EditableCommunicationSettings[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.detail) {
        setSaveError(data.detail);
      } else if (typeof data === 'object') {
        const msgs = Object.entries(data)
          .map(([f, m]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(m) ? m.join(', ') : m}`)
          .join('\n');
        setSaveError(msgs);
      } else {
        setSaveError(err?.message || 'Failed to save communication settings.');
      }
    }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'routing', label: 'Message Routing', icon: Smartphone },
    { id: 'billing', label: 'Platform Billing', icon: Wallet },
    { id: 'targeting', label: 'Targeting Defaults', icon: Users },
  ];

  const showWaTimeout = form.whatsapp_mode === 'fallback_to_platform';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Fixed-height modal shell */}
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-2xl h-[min(620px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Settings className="h-4 w-4" />
            </span>
            {settings ? 'Edit Communication Settings' : 'Initialize Settings'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4 flex-shrink-0 gap-1 bg-slate-50/60">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.id ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600 flex-shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Scrollable body */}
        <form id="comm-settings-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6 space-y-4">

            {/* ── Routing ── */}
            {activeTab === 'routing' && (
              <div className="space-y-6">

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <MessageSquare className="h-4 w-4 text-emerald-600" /> WhatsApp Settings
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>WhatsApp Routing Mode</label>
                      <select value={form.whatsapp_mode} onChange={e => set('whatsapp_mode', e.target.value as any)} className={selectCls}>
                        <option value="own_only">School's Own Account Only</option>
                        <option value="platform_only">Use Platform Account Only</option>
                        <option value="fallback_to_platform">Own Account (Fallback to Platform)</option>
                      </select>
                    </div>

                    {showWaTimeout && (
                      <div className="animate-[fadeIn_0.15s_ease-out]">
                        <label className={labelCls}>Failure Timeout (Seconds)</label>
                        <input type="number" min="1" max="60"
                          value={form.whatsapp_failure_timeout_seconds}
                          onChange={e => set('whatsapp_failure_timeout_seconds', Number(e.target.value))}
                          className={inputCls} placeholder="15" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Smartphone className="h-4 w-4 text-violet-600" /> SMS Settings
                  </h4>
                  <div>
                    <label className={labelCls}>SMS Routing Mode</label>
                    <select value={form.sms_mode} onChange={e => set('sms_mode', e.target.value as any)} className={selectCls}>
                      <option value="own_only">School's Own Gateway Only</option>
                      <option value="platform_only">Use Platform Gateway Only</option>
                      <option value="fallback_to_platform">Own Gateway (Fallback to Platform)</option>
                    </select>
                  </div>
                </div>

              </div>
            )}

            {/* ── Billing ── */}
            {activeTab === 'billing' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Manage warning thresholds. Billing rates and balances are centrally managed by the platform administrator.</p>

                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-50/40 border border-slate-100 rounded-xl">
                   <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Unified Platform Balance</p>
                   <p className="text-2xl font-bold text-slate-800">
                     ₦{Number(settings?.platform_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                   </p>
                   <p className="text-[10px] text-slate-400 mt-1">Deducted automatically for platform-routed WhatsApp or SMS messages. Top up via the Finance module.</p>
                </div>

                <div>
                  <label className={labelCls}>Low Balance Alert Threshold (₦)</label>
                  <input type="number" step="0.01" min="0"
                    value={form.low_platform_balance_threshold}
                    onChange={e => set('low_platform_balance_threshold', e.target.value)}
                    className={inputCls} placeholder="500.00" />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Alert the school admin when the unified balance drops below this amount.
                  </p>
                </div>
              </div>
            )}

            {/* ── Targeting ── */}
            {activeTab === 'targeting' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure default behaviors for the campaign builder filter engine.</p>
                <Toggle
                  checked={!!form.default_require_active_ward_for_parents}
                  onChange={v => set('default_require_active_ward_for_parents', v)}
                  label="Require Active Ward for Parents"
                  description="When targeting parents, default to excluding parents whose children have graduated or left."
                />
              </div>
            )}

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-white hover:border-slate-300 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="comm-settings-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4" />{settings ? 'Save Changes' : 'Initialize Settings'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CommunicationSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [settings, setSettings] = useState<CommunicationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('communication.manage_communication_settings');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await communicationSettingsAPI.get();
      if (data === null) { setPageError('not_found'); setSettings(null); }
      else { setSettings(data); }
    } catch { setPageError('fetch_error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (form: Partial<EditableCommunicationSettings>) => {
    setIsSaving(true);
    try {
      let updated;
      if (settings?.id) {
        updated = await communicationSettingsAPI.update(settings.id, form);
      } else {
        updated = await communicationSettingsAPI.create(form);
      }
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
        <p className="text-slate-400 text-sm">Loading communication settings...</p>
      </div>
    </div>
  );

  // ── Fetch error ──
  if (pageError === 'fetch_error') return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl ring-1 ring-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">Couldn't load communication settings. Please try again.</p>
        <button onClick={fetchSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  // ── Not found ──
  if (pageError === 'not_found' && !settings) return (
    <>
      {isEditing && <SettingsModal settings={null} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
            <MessageSquare className="h-10 w-10 text-blue-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure Communication Settings</h3>
            <p className="text-slate-400 text-sm">Set up global routing rules, platform billing, and campaign defaults.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200">
              <Zap className="h-5 w-5" /> Initialize Settings
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to set up communication settings. Please contact an administrator.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const s = settings!;

  return (
    <div className="space-y-6 pb-10 max-w-6xl mx-auto">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white ring-1 ring-emerald-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Communication settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && <SettingsModal settings={s} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}

      {/* ── Page header ── */}
      <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-4">
        <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">General Settings</h1>
              <p className="text-xs text-slate-400 mt-0.5">Global communication rules and routing preferences</p>
            </div>
          </div>
          {canEdit && (
            <button onClick={() => setIsEditing(true)}
              className="self-stretch sm:self-auto px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 hover:from-blue-700 hover:to-indigo-700 transition-all flex-shrink-0">
              <Edit3 className="h-3.5 w-3.5" /> Edit Settings
            </button>
          )}
        </div>
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'WhatsApp Route',
            value: formatRoutingMode(s.whatsapp_mode),
            icon: MessageSquare,
            color: 'from-emerald-500 to-green-600',
          },
          {
            label: 'SMS Route',
            value: formatRoutingMode(s.sms_mode),
            icon: Smartphone,
            color: 'from-violet-500 to-purple-600',
          },
          {
            label: 'Platform Wallet',
            value: `₦${Number(s.platform_balance || 0).toLocaleString()}`,
            icon: Wallet,
            color: 'from-blue-500 to-blue-600',
          },
          {
            label: 'SMS Limit/Page',
            value: `${s.sms_page_character_length} Chars`,
            icon: Hash,
            color: 'from-orange-400 to-amber-500',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm hover:shadow-md transition-shadow p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">{label}</p>
              <p className="text-sm font-bold text-slate-900 capitalize truncate mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Details Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Routing & Campaigns Card */}
        <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50">
            <div className="w-6 h-6 bg-blue-50 rounded-md flex items-center justify-center">
              <Globe className="h-3 w-3 text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Routing & Campaigns</h3>
          </div>
          <div className="p-2 flex-1">
            <SettingRow icon={MessageSquare} iconBg="bg-emerald-50 text-emerald-600"
              label="WhatsApp Mode" description="Primary dispatch channel"
              value={<span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wide">{formatRoutingMode(s.whatsapp_mode)}</span>} />
            <SettingRow icon={Smartphone} iconBg="bg-violet-50 text-violet-600"
              label="SMS Mode" description="Primary SMS gateway"
              value={<span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wide">{formatRoutingMode(s.sms_mode)}</span>} />
            {s.whatsapp_mode === 'fallback_to_platform' && (
              <SettingRow icon={Clock} iconBg="bg-indigo-50 text-indigo-600"
                label="Failure Timeout" description="Seconds to wait before WA fallback"
                value={<span className="text-xs font-bold text-slate-900">{s.whatsapp_failure_timeout_seconds}s</span>} />
            )}
            <SettingRow icon={Shield} iconBg="bg-purple-50 text-purple-600"
              label="Active Ward Check" description="Require active students for parent sends"
              value={<StatusBadge value={s.default_require_active_ward_for_parents} />} />
          </div>
        </div>

        {/* Platform Billing Card */}
        <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50">
            <div className="w-6 h-6 bg-amber-50 rounded-md flex items-center justify-center">
              <Wallet className="h-3 w-3 text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Billing & Rates</h3>
          </div>
          <div className="p-2 flex-1">
            <SettingRow icon={Wallet} iconBg="bg-emerald-50 text-emerald-600"
              label="Available Balance" description="For platform-routed messages"
              value={<span className="text-sm font-bold text-slate-800">₦{Number(s.platform_balance || 0).toLocaleString()}</span>} />
            <SettingRow icon={AlertCircle} iconBg="bg-rose-50 text-rose-600"
              label="Low Balance Alert" description="Threshold for admin warning"
              value={<span className="text-xs font-bold text-rose-600">₦{Number(s.low_platform_balance_threshold || 0).toLocaleString()}</span>} />
            <SettingRow icon={Smartphone} iconBg="bg-indigo-50 text-indigo-600"
              label="Platform SMS Rate" description="Cost per page if routed via platform"
              value={<span className="text-xs font-mono font-bold text-slate-900">₦{Number(s.platform_sms_cost_per_page || 0).toLocaleString()}</span>} />
            <SettingRow icon={Hash} iconBg="bg-orange-50 text-orange-600"
              label="Page Char Limit" description="Limit for cost estimates"
              value={<span className="text-xs font-bold text-slate-900">{s.sms_page_character_length}</span>} />
          </div>
        </div>
      </div>

      {/* ── Full settings table ── */}
      <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-800">All Settings List</h3>
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
                { label: 'WhatsApp Routing Mode', value: <span className="text-sm font-medium">{formatRoutingMode(s.whatsapp_mode)}</span>, desc: 'Determines which API account routes outgoing WhatsApp messages' },
                { label: 'SMS Routing Mode', value: <span className="text-sm font-medium">{formatRoutingMode(s.sms_mode)}</span>, desc: 'Determines which API account routes standard SMS text messages' },
                ...(s.whatsapp_mode === 'fallback_to_platform'
                  ? [{ label: 'Failure Timeout', value: <span className="text-sm">{s.whatsapp_failure_timeout_seconds} Seconds</span>, desc: 'Wait time before marking a message attempt as failed and falling back to the platform account' }]
                  : []),
                { label: 'Platform Balance', value: <span className="text-sm font-bold">₦{Number(s.platform_balance || 0).toLocaleString()}</span>, desc: 'Current unified balance deducted from platform-routed WhatsApp and SMS messages (Read-only)' },
                { label: 'Platform SMS Cost', value: <span className="text-sm font-mono font-bold">₦{Number(s.platform_sms_cost_per_page || 0).toLocaleString()}</span>, desc: 'Flat fee charged to the platform balance per SMS page (Read-only)' },
                { label: 'SMS Page Limit', value: <span className="text-sm">{s.sms_page_character_length} Characters</span>, desc: 'The character threshold used to calculate multi-page billing for SMS (Read-only)' },
                { label: 'Low Balance Threshold', value: <span className="text-sm">₦{Number(s.low_platform_balance_threshold || 0).toLocaleString()}</span>, desc: 'Triggers an alert when the platform balance falls below this limit' },
                { label: 'Default Require Active Ward', value: <StatusBadge value={s.default_require_active_ward_for_parents} />, desc: 'By default, excludes parents whose children have graduated from bulk parent campaigns' },
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