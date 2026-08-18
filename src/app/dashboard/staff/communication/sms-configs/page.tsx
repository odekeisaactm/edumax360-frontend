'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  Smartphone, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  Lock, Radio, MessageSquare, HelpCircle, ShieldQuestion
} from 'lucide-react';

// ─── Provider Options ──────────────────────────────────────────────────────────

const SMS_PROVIDERS = [
  { id: 'termii', label: 'Termii' },
  { id: 'africastalking', label: "Africa's Talking" },
  { id: 'twilio', label: 'Twilio' },
  { id: 'nexmo', label: 'Nexmo (Vonage)' },
  { id: 'other', label: 'Other / Custom' },
] as const;

function providerLabel(id: string): string {
  return SMS_PROVIDERS.find(p => p.id === id)?.label ?? id;
}

// Per-provider field labels — the two credential fields mean different things
// depending on the provider (Twilio's second field is an Auth Token, Africa's
// Talking's is actually a Username, not a secret).
interface ProviderFieldConfig {
  primaryLabel: string;
  primaryPlaceholder: string;
  showSecondary: boolean;
  secondaryLabel: string;
  secondaryPlaceholder: string;
  secondaryType: 'password' | 'text';
}

function getProviderFieldConfig(provider: string): ProviderFieldConfig {
  switch (provider) {
    case 'twilio':
      return {
        primaryLabel: 'Account SID',
        primaryPlaceholder: 'Starts with AC...',
        showSecondary: true,
        secondaryLabel: 'Auth Token',
        secondaryPlaceholder: 'Your Twilio Auth Token',
        secondaryType: 'password',
      };
    case 'africastalking':
      return {
        primaryLabel: 'API Key',
        primaryPlaceholder: 'Your Africa\'s Talking API Key',
        showSecondary: true,
        secondaryLabel: 'Username',
        secondaryPlaceholder: 'Your app username (e.g. sandbox)',
        secondaryType: 'text',
      };
    case 'nexmo':
      return {
        primaryLabel: 'API Key',
        primaryPlaceholder: 'Your Vonage API Key',
        showSecondary: true,
        secondaryLabel: 'API Secret',
        secondaryPlaceholder: 'Your Vonage API Secret',
        secondaryType: 'password',
      };
    case 'termii':
      return {
        primaryLabel: 'API Key',
        primaryPlaceholder: 'Your Termii API Key',
        showSecondary: false,
        secondaryLabel: '',
        secondaryPlaceholder: '',
        secondaryType: 'password',
      };
    default:
      return {
        primaryLabel: 'API Key',
        primaryPlaceholder: 'Your provider API Key',
        showSecondary: true,
        secondaryLabel: 'Secret Key (if applicable)',
        secondaryPlaceholder: 'Secret Key, if your provider requires one',
        secondaryType: 'password',
      };
  }
}

// ─── Types & API ───────────────────────────────────────────────────────────────

export type ConfigStatus = 'active' | 'inactive';
export type SMSProviderType = 'africastalking' | 'twilio' | 'nexmo' | 'termii' | 'other';

export interface SMSConfig {
  id: number;
  name: string;
  provider: SMSProviderType;
  api_key?: string; // Write-only in backend, usually not returned
  secret_key?: string; // Write-only
  sender_id: string;
  status: ConfigStatus;
  created_at: string;
  updated_at: string;
}

export interface SMSConfigFormValues {
  name: string;
  provider: SMSProviderType;
  api_key: string;
  secret_key?: string;
  sender_id?: string;
  status: ConfigStatus;
}

const smsAPI = {
  list: async (): Promise<SMSConfig[]> => {
    const res = await api.get('/api/communication/sms-configs/');
    return Array.isArray(res.data?.results) ? res.data.results : res.data;
  },
  create: async (data: SMSConfigFormValues): Promise<SMSConfig> => {
    const res = await api.post('/api/communication/sms-configs/', data);
    return res.data;
  },
  update: async (id: number, data: Partial<SMSConfigFormValues>): Promise<SMSConfig> => {
    const res = await api.patch(`/api/communication/sms-configs/${id}/`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/communication/sms-configs/${id}/`);
  }
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d.slice(0, 150);
    if (d.detail) return String(d.detail).slice(0, 150);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v[0] : String(v)}`)
        .join('\n');
      if (fields) return fields.slice(0, 200);
    }
    if (d.message) return String(d.message).slice(0, 150);
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] sm:w-auto">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg ring-1 sm:max-w-sm transition-all
          ${t.type === 'success' ? 'bg-emerald-50 ring-emerald-200 text-emerald-900' : 'bg-red-50 ring-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-600" />}
          <p className="text-sm font-medium flex-1 leading-snug whitespace-pre-line">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────

function ConfirmModal({ open, config, isDeleting, onConfirm, onCancel }: {
  open: boolean; config: SMSConfig | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !config) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md p-6">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-100 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Configuration</h3>
        <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
          Are you sure you want to permanently delete <span className="font-semibold text-slate-700">"{config.name}"</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-red-200">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Credentials Explainer Modal ────────────────────────────────────────────────

const CREDENTIAL_STEPS: Record<string, { intro: string; steps: string[] }> = {
  termii: {
    intro: 'Termii uses a single API Key for authentication — no separate secret is needed.',
    steps: [
      'Log in to the Termii dashboard at accounts.termii.com.',
      'Open Settings → API Keys from the left sidebar.',
      'Copy the API Key shown there and paste it into the API Key field here.',
      'Under Settings → Sender ID, request or select an approved Sender ID to use above.',
    ],
  },
  africastalking: {
    intro: 'Africa\'s Talking authenticates with an API Key plus your app Username (not a secret) — both are required.',
    steps: [
      'Log in to the Africa\'s Talking dashboard.',
      'Note the app Username shown at the top of the dashboard (e.g. "sandbox" for test apps).',
      'Go to Settings → API Key to view or generate your key.',
      'Enter the API Key and the Username into the matching fields here.',
    ],
  },
  twilio: {
    intro: 'Twilio identifies your account with an Account SID and authenticates with an Auth Token — both come from the same page.',
    steps: [
      'Log in to the Twilio Console.',
      'On the main dashboard, find "Account Info" — it shows the Account SID and Auth Token directly.',
      'Click "view" to reveal the Auth Token, then copy both values.',
      'Paste the Account SID and Auth Token into the matching fields here.',
    ],
  },
  nexmo: {
    intro: 'Vonage (formerly Nexmo) uses an API Key and API Secret pair from the API dashboard.',
    steps: [
      'Log in to the Vonage API Dashboard.',
      'Your API Key and API Secret are shown on the dashboard homepage under "API keys".',
      'Copy both values into the matching fields here.',
    ],
  },
};

function SMSCredentialsHelpModal({ initialProvider, onClose }: { initialProvider: string; onClose: () => void }) {
  const tabs = SMS_PROVIDERS.filter(p => p.id !== 'other');
  const [tab, setTab] = useState<string>(
    tabs.some(t => t.id === initialProvider) ? initialProvider : 'termii'
  );
  const active = CREDENTIAL_STEPS[tab];

  return (
    <div className="fixed inset-0 z-[65] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg h-[min(560px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <ShieldQuestion className="h-4 w-4" />
            </span>
            Where Do I Find My Credentials?
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Select your provider</p>
            <div className="flex gap-1.5 flex-wrap mb-4">
              {tabs.map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    tab === t.id ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl mb-4">
              <p className="text-xs text-slate-700 leading-relaxed">{active.intro}</p>
            </div>

            <ol className="space-y-2.5">
              {active.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">Dashboard menu names vary slightly as providers update their sites — search "API key" or "API credentials" in account settings if a step doesn't match exactly.</p>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SMS Registration Modal ────────────────────────────────────────────────────

function SMSModal({
  editing, isSaving, onSave, onClose, showToast
}: {
  editing: SMSConfig | null; isSaving: boolean;
  onSave: (data: SMSConfigFormValues) => Promise<void>; onClose: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [form, setForm] = useState<SMSConfigFormValues>(
    editing ? {
      name: editing.name,
      provider: editing.provider,
      api_key: '',
      secret_key: '',
      sender_id: editing.sender_id || '',
      status: editing.status,
    } : {
      name: '',
      provider: '' as SMSProviderType,
      api_key: '',
      secret_key: '',
      sender_id: '',
      status: 'active',
    }
  );
  const [showHelp, setShowHelp] = useState(false);

  const set = <K extends keyof SMSConfigFormValues>(key: K, value: SMSConfigFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.provider) {
      showToast('error', 'Please fill in all mandatory configuration fields.'); return;
    }
    if (!editing && !form.api_key?.trim()) {
      showToast('error', 'An API Key is required for new configurations.'); return;
    }

    try {
      // Clean keys from payload if empty during an edit
      const payload = { ...form };
      if (editing && !payload.api_key) delete payload.api_key;
      if (editing && !payload.secret_key) delete payload.secret_key;

      await onSave(payload);
    } catch (err) { showToast('error', extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 outline-none bg-white font-medium text-slate-800 transition-shadow";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";
  const fieldConfig = getProviderFieldConfig(form.provider);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      {showHelp && <SMSCredentialsHelpModal initialProvider={form.provider} onClose={() => setShowHelp(false)} />}
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-2xl h-[min(650px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Smartphone className="h-4 w-4" />
            </span>
            {editing ? 'Edit SMS Gateway' : 'Register SMS Gateway'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-6">
          <form id="sms-form" onSubmit={handleSubmit} className="space-y-5">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>SMS Provider <span className="text-red-500">*</span></label>
                <select value={form.provider} onChange={e => set('provider', e.target.value as SMSProviderType)} className={inputCls}>
                  <option value="" disabled>Select a provider...</option>
                  {SMS_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Config Name <span className="text-red-500">*</span></label>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Primary Termii Account" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Sender ID</label>
              <input type="text" value={form.sender_id || ''} onChange={e => set('sender_id', e.target.value)}
                placeholder="e.g. SCHOOL-NAME (Max 11 chars)" maxLength={11} className={inputCls} />
              <p className="text-[10px] text-slate-400 mt-1.5">This is the name that appears on the recipient's phone. Must be approved by your provider.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50/70 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between -mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Credentials</p>
                <button type="button" onClick={() => setShowHelp(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">
                  <HelpCircle className="h-3 w-3" /> Where do I find these?
                </button>
              </div>

              <div>
                <label className={labelCls}>{fieldConfig.primaryLabel} {editing ? '' : <span className="text-red-500">*</span>}</label>
                <input type="password" required={!editing} value={form.api_key || ''} onChange={e => set('api_key', e.target.value)}
                  placeholder={editing ? "•••••••• (Leave blank to keep)" : fieldConfig.primaryPlaceholder} className={inputCls} />
              </div>

              {fieldConfig.showSecondary && (
                <div>
                  <label className={labelCls}>{fieldConfig.secondaryLabel}</label>
                  <input type={fieldConfig.secondaryType} value={form.secret_key || ''} onChange={e => set('secret_key', e.target.value)}
                    placeholder={editing && fieldConfig.secondaryType === 'password' ? "•••••••• (Leave blank to keep)" : fieldConfig.secondaryPlaceholder}
                    className={inputCls} />
                </div>
              )}

              {editing && (
                <div className="flex items-start gap-1.5 mt-1">
                  <Lock className="h-3 w-3 mt-0.5 flex-shrink-0 text-slate-400" />
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Keys are encrypted at rest. Only enter new values if you wish to overwrite the existing credentials.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-800">Operational Status</p>
                <p className="text-xs text-slate-400">Allow system to route messages here</p>
              </div>
              <button type="button" role="switch" aria-checked={form.status === 'active'}
                onClick={() => set('status', form.status === 'active' ? 'inactive' : 'active')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.status === 'active' ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-white hover:border-slate-300 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="sms-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Saving...'}</> : <><Check className="h-4 w-4" />{editing ? 'Update Configuration' : 'Register Configuration'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function SMSConfigsPage() {
  const { hasPermission, user } = useAuth();

  const [configs, setConfigs] = useState<SMSConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SMSConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingConfig, setDeletingConfig] = useState<SMSConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canManage = user?.is_superuser || hasPermission('communication.manage_communication_settings');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await smsAPI.list();
      setConfigs(data);
    } catch (err) { showToast('error', extractError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const openCreate = () => {
    setEditingConfig(null);
    setShowModal(true);
  };

  const openEdit = (config: SMSConfig) => {
    setEditingConfig(config);
    setShowModal(true);
  };

  const handleSave = async (form: SMSConfigFormValues) => {
    setIsSaving(true);
    try {
      if (editingConfig) {
        const updated = await smsAPI.update(editingConfig.id, form);
        setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
        showToast('success', `"${updated.name}" updated successfully.`);
      } else {
        const created = await smsAPI.create(form);
        setConfigs(prev => [created, ...prev]);
        showToast('success', `"${created.name}" registered successfully.`);
      }
      setShowModal(false);
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingConfig) return;
    setIsDeleting(true);
    try {
      await smsAPI.delete(deletingConfig.id);
      setConfigs(prev => prev.filter(c => c.id !== deletingConfig.id));
      showToast('success', `"${deletingConfig.name}" removed successfully.`);
      setDeletingConfig(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingConfig(null);
    } finally { setIsDeleting(false); }
  };

  const filteredConfigs = configs.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (c.sender_id && c.sender_id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchActive = !showActiveOnly || c.status === 'active';
    return matchSearch && matchActive;
  });

  const activeCount = configs.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal open={!!deletingConfig} config={deletingConfig} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingConfig(null)} />

      {showModal && (
        <SMSModal editing={editingConfig} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} showToast={showToast} />
      )}

      {/* Top Hub Header */}
      <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-4">
        <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">SMS Gateway Configurations</h1>
              <p className="text-xs text-slate-400 mt-0.5">Manage SMS providers for attendance alerts and broadcast messaging</p>
            </div>
          </div>
          {canManage && (
            <button onClick={() => openCreate()}
              className="self-stretch sm:self-auto px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 hover:from-emerald-700 hover:to-teal-700 transition-all flex-shrink-0">
              <Plus className="h-3.5 w-3.5" /> Add Gateway Config
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-3.5 sm:p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Total Configs</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-0.5">
              {loading ? '—' : configs.length}
            </p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
        <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-3.5 sm:p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Active Gateways</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-0.5">
              {loading ? '—' : activeCount}
            </p>
          </div>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${activeCount > 0 ? 'from-emerald-500 to-teal-600' : 'from-amber-400 to-orange-500'}`}>
            {activeCount > 0 ? <Radio className="h-4 w-4 sm:h-5 sm:w-5" /> : <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search by name, provider, or sender ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 outline-none font-medium transition-shadow" />
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-3 flex-shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button type="button" role="switch" aria-checked={showActiveOnly} onClick={() => setShowActiveOnly(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-emerald-600' : 'bg-slate-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap">Active Only</span>
          </label>
          <button onClick={fetchConfigs} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Configurations List Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-400 font-medium">Loading SMS configurations...</p>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <Smartphone className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base mb-1">
            {searchTerm ? 'No matching configurations found' : 'No SMS Gateways Registered'}
          </h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
            {searchTerm ? 'Try adjusting your search query.' : 'Register an SMS provider API key to enable text messaging broadcasts and alerts.'}
          </p>
          {!searchTerm && canManage && (
            <button onClick={() => openCreate()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700 transition-all">
              <Plus className="h-4 w-4" /> Add First Gateway
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredConfigs.map(config => (
            <div key={config.id} className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className={`h-1 w-full bg-gradient-to-r ${config.status === 'active' ? 'from-emerald-500 to-teal-500' : 'from-slate-300 to-slate-400'}`} />
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold ${config.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate text-sm">{config.name}</h3>
                      <p className="text-xs text-slate-400 font-medium truncate">{providerLabel(config.provider)}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${config.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${config.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {config.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sender ID</p>
                  <p className="font-mono font-bold text-slate-900 text-xs tracking-wide mt-0.5 truncate">
                    {config.sender_id || '—'}
                  </p>
                </div>

                <div className="flex items-center justify-end pt-0.5">
                  <div className="flex gap-1.5">
                    {canManage && (
                      <button onClick={() => openEdit(config)} title="Edit Configuration"
                        className="p-1.5 rounded-lg text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canManage && (
                      <button onClick={() => setDeletingConfig(config)} title="Delete Configuration"
                        className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}