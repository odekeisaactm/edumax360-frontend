'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api'; // Using your standard axios instance
import {
  Server, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  Mail, Lock, Radio, HelpCircle, ChevronRight, ShieldQuestion
} from 'lucide-react';

// ─── Provider Presets ──────────────────────────────────────────────────────────

interface ProviderPreset {
  id: string;
  label: string;
  host: string;
  port: number;
  use_tls: boolean;
  use_ssl: boolean;
  domains: string[];
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 587, use_tls: true, use_ssl: false, domains: ['gmail.com', 'googlemail.com'] },
  { id: 'outlook', label: 'Outlook / Office 365', host: 'smtp.office365.com', port: 587, use_tls: true, use_ssl: false, domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'] },
  { id: 'yahoo', label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: 587, use_tls: true, use_ssl: false, domains: ['yahoo.com', 'ymail.com', 'rocketmail.com'] },
  { id: 'zoho', label: 'Zoho Mail', host: 'smtp.zoho.com', port: 587, use_tls: true, use_ssl: false, domains: ['zoho.com', 'zohomail.com'] },
];

function emailDomain(email: string): string {
  const parts = email.trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

// ─── Types & API ───────────────────────────────────────────────────────────────

export type ConfigStatus = 'active' | 'inactive';

export interface SMTPConfig {
  id: number;
  name: string;
  email: string;
  host: string;
  port: number;
  username: string;
  use_tls: boolean;
  use_ssl: boolean;
  status: ConfigStatus;
  created_at: string;
  updated_at: string;
}

export interface SMTPConfigFormValues {
  name: string;
  email: string;
  host: string;
  port: number | string;
  username: string;
  password?: string;
  use_tls: boolean;
  use_ssl: boolean;
  status: ConfigStatus;
}

const smtpAPI = {
  list: async (): Promise<SMTPConfig[]> => {
    const res = await api.get('/api/communication/smtp-configs/');
    return Array.isArray(res.data?.results) ? res.data.results : res.data;
  },
  create: async (data: SMTPConfigFormValues): Promise<SMTPConfig> => {
    const res = await api.post('/api/communication/smtp-configs/', data);
    return res.data;
  },
  update: async (id: number, data: Partial<SMTPConfigFormValues>): Promise<SMTPConfig> => {
    const res = await api.patch(`/api/communication/smtp-configs/${id}/`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/communication/smtp-configs/${id}/`);
  }
};

// ─── Helpers & Storage Keys ────────────────────────────────────────────────────

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
  open: boolean; config: SMTPConfig | null; isDeleting: boolean;
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

// ─── App Password Explainer Modal ──────────────────────────────────────────────

const APP_PASSWORD_STEPS: Record<string, string[]> = {
  gmail: [
    'Turn on 2-Step Verification for the Google account (Google Account → Security).',
    'Go to Google Account → Security → 2-Step Verification → App passwords.',
    'Create a new app password, name it something like "School Portal".',
    'Copy the 16-character code and paste it into the SMTP Password field here.',
  ],
  outlook: [
    'Turn on two-step verification for the Microsoft account (Security → Advanced security options).',
    'Under "App passwords", choose to create a new one.',
    'Give it a name like "School Portal" and generate it.',
    'Copy the generated code and paste it into the SMTP Password field here.',
  ],
  yahoo: [
    'Sign in and go to Account Security on the Yahoo account.',
    'Turn on two-step verification if it isn\'t already on.',
    'Select "Generate app password", name it, and create it.',
    'Copy the code shown and paste it into the SMTP Password field here.',
  ],
  zoho: [
    'Sign in to Zoho Mail and open Security → App Passwords in account settings.',
    'Choose to generate a new app-specific password and name it.',
    'Copy the generated password and paste it into the SMTP Password field here.',
  ],
};

function AppPasswordModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<keyof typeof APP_PASSWORD_STEPS>('gmail');
  const tabs: { id: keyof typeof APP_PASSWORD_STEPS; label: string }[] = [
    { id: 'gmail', label: 'Gmail' },
    { id: 'outlook', label: 'Outlook' },
    { id: 'yahoo', label: 'Yahoo' },
    { id: 'zoho', label: 'Zoho' },
  ];

  return (
    <div className="fixed inset-0 z-[65] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg h-[min(560px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <ShieldQuestion className="h-4 w-4" />
            </span>
            App Passwords Explained
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl space-y-2">
            <p className="text-sm font-semibold text-slate-800">App password vs. normal password</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your normal password logs you into the provider's website or app. An <span className="font-semibold">app password</span> is a separate, auto-generated code used only by a specific third-party app or service — like this SMTP integration — to send mail on your behalf.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Most providers require an app password instead of your regular one once two-factor authentication (2FA) is enabled, since a regular password alone can't get through 2FA. App passwords can also be revoked individually without changing the account's main password.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Quick steps by provider</p>
            <div className="flex gap-1.5 flex-wrap mb-4">
              {tabs.map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    tab === t.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <ol className="space-y-2.5">
              {APP_PASSWORD_STEPS[tab].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">Exact menu names vary slightly as providers update their settings pages — search "app password" in the account's security settings if a step doesn't match exactly.</p>
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

// ─── SMTP Registration Modal ───────────────────────────────────────────────────

function SMTPModal({
  editing, isSaving, onSave, onClose, showToast
}: {
  editing: SMTPConfig | null; isSaving: boolean;
  onSave: (data: SMTPConfigFormValues) => Promise<void>; onClose: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [form, setForm] = useState<SMTPConfigFormValues>(
    editing ? {
      name: editing.name,
      email: editing.email,
      host: editing.host,
      port: editing.port,
      username: editing.username,
      password: '', // Blank on edit, backend handles updates only if provided
      use_tls: editing.use_tls,
      use_ssl: editing.use_ssl,
      status: editing.status,
    } : {
      name: '',
      email: '',
      host: '',
      port: 587,
      username: '',
      password: '',
      use_tls: true,
      use_ssl: false,
      status: 'active',
    }
  );
  const [provider, setProvider] = useState<string>(() => {
    if (!editing) return '';
    const matched = PROVIDER_PRESETS.find(p => p.host.toLowerCase() === editing.host.toLowerCase());
    return matched?.id ?? 'custom';
  });
  const [showAppPasswordHelp, setShowAppPasswordHelp] = useState(false);

  const handleProviderChange = (id: string) => {
    setProvider(id);
    const preset = PROVIDER_PRESETS.find(p => p.id === id);
    if (!preset) return; // "custom" — leave fields as-is
    setForm(prev => ({
      ...prev,
      host: preset.host,
      port: preset.port,
      use_tls: preset.use_tls,
      use_ssl: preset.use_ssl,
    }));
  };

  const set = <K extends keyof SMTPConfigFormValues>(key: K, value: SMTPConfigFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.host.trim() || !form.username.trim() || !form.email.trim()) {
      showToast('error', 'Please fill in all mandatory configuration fields.'); return;
    }
    if (!editing && !form.password?.trim()) {
      showToast('error', 'A password or application specific password is required for new configurations.'); return;
    }

    if (!provider) {
      showToast('error', 'Please select an Email Provider — choose "Custom / Other" if none of the presets apply.');
      return;
    }

    const domain = emailDomain(form.email);
    if (provider === 'custom') {
      const matched = PROVIDER_PRESETS.find(p => p.id !== 'outlook' && p.domains.includes(domain));
      if (matched) {
        showToast('error', `This email domain belongs to ${matched.label}. Select "${matched.label}" from the Email Provider field instead of Custom / Other.`);
        return;
      }
    }
    // Note: we intentionally do NOT require the domain to match the selected
    // preset (e.g. Gmail → @gmail.com). Google Workspace, Zoho Workspace, and
    // Microsoft 365 all let organizations send through these presets while
    // using their own custom domain (e.g. admin@greenfield.edu.ng), so a
    // strict forward check would lock out exactly the schools most likely
    // to use these presets.

    try {
      // Clean password from payload if it's empty during an edit
      const payload = { ...form };
      if (editing && !payload.password) {
        delete payload.password;
      }
      await onSave(payload);
    } catch (err) { showToast('error', extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none bg-white font-medium text-slate-800 transition-shadow";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      {showAppPasswordHelp && <AppPasswordModal onClose={() => setShowAppPasswordHelp(false)} />}
      {/* Fixed-height shell, capped to viewport so header/footer never go off-screen */}
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-2xl h-[min(700px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Server className="h-4 w-4" />
            </span>
            {editing ? 'Edit SMTP Configuration' : 'Register SMTP Server'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-6">
          <form id="smtp-form" onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className={labelCls}>Email Provider <span className="text-red-500">*</span></label>
              <select value={provider} onChange={e => handleProviderChange(e.target.value)} className={inputCls}>
                <option value="" disabled>Select a provider...</option>
                <option value="custom">Custom / Other</option>
                {PROVIDER_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">Picking a provider fills in the host, port, and TLS/SSL settings below — you can still edit them.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Provider / Config Name <span className="text-red-500">*</span></label>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Amazon SES, Gmail Main" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sender Email Address <span className="text-red-500">*</span></label>
                <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="e.g. noreply@school.com" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>SMTP Host Server <span className="text-red-500">*</span></label>
                <input required type="text" value={form.host} onChange={e => set('host', e.target.value)}
                  placeholder="e.g. smtp.gmail.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Port <span className="text-red-500">*</span></label>
                <input required type="number" min="1" max="65535" value={form.port} onChange={e => set('port', Number(e.target.value))}
                  placeholder="e.g. 587, 465" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/70 rounded-xl border border-slate-100">
              <div>
                <label className={labelCls}>SMTP Username <span className="text-red-500">*</span></label>
                <input required type="text" value={form.username} onChange={e => set('username', e.target.value)}
                  placeholder="e.g. apikey or email" className={inputCls} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls + ' mb-0'}>SMTP Password {editing ? '' : <span className="text-red-500">*</span>}</label>
                  <button type="button" onClick={() => setShowAppPasswordHelp(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                    <HelpCircle className="h-3 w-3" /> What's an app password?
                  </button>
                </div>
                <input type="password" required={!editing} value={form.password || ''} onChange={e => set('password', e.target.value)}
                  placeholder={editing ? "•••••••• (Leave blank to keep)" : "Your secret key"} className={inputCls} />
              </div>
              {editing && (
                <div className="sm:col-span-2 flex items-start gap-1.5 -mt-1">
                  <Lock className="h-3 w-3 mt-0.5 flex-shrink-0 text-slate-400" />
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Password is encrypted. Only enter a new one if you wish to overwrite the existing credentials.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                form.use_tls ? 'border-blue-500 bg-blue-50/70' : 'border-slate-100 hover:border-slate-200 bg-white'
              }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  form.use_tls ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                }`}>
                  {form.use_tls && <Check className="h-3 w-3 text-white" />}
                </div>
                <input type="checkbox" checked={form.use_tls} onChange={e => set('use_tls', e.target.checked)} className="sr-only" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">Use TLS</p>
                  <p className="text-[10px] text-slate-500 uppercase mt-0.5 tracking-wide">Commonly port 587</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                form.use_ssl ? 'border-blue-500 bg-blue-50/70' : 'border-slate-100 hover:border-slate-200 bg-white'
              }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  form.use_ssl ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                }`}>
                  {form.use_ssl && <Check className="h-3 w-3 text-white" />}
                </div>
                <input type="checkbox" checked={form.use_ssl} onChange={e => set('use_ssl', e.target.checked)} className="sr-only" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">Use SSL</p>
                  <p className="text-[10px] text-slate-500 uppercase mt-0.5 tracking-wide">Commonly port 465</p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-800">Operational Status</p>
                <p className="text-xs text-slate-400">Allow system to use this configuration</p>
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
          <button type="submit" form="smtp-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Saving...'}</> : <><Check className="h-4 w-4" />{editing ? 'Update Configuration' : 'Register Configuration'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function SMTPConfigsPage() {
  const { hasPermission, user } = useAuth();

  const [configs, setConfigs] = useState<SMTPConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SMTPConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingConfig, setDeletingConfig] = useState<SMTPConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Adjust to your actual permission check string
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
      const data = await smtpAPI.list();
      setConfigs(data);
    } catch (err) { showToast('error', extractError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const openCreate = () => {
    setEditingConfig(null);
    setShowModal(true);
  };

  const openEdit = (config: SMTPConfig) => {
    setEditingConfig(config);
    setShowModal(true);
  };

  const handleSave = async (form: SMTPConfigFormValues) => {
    setIsSaving(true);
    try {
      if (editingConfig) {
        const updated = await smtpAPI.update(editingConfig.id, form);
        setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
        showToast('success', `"${updated.name}" updated successfully.`);
      } else {
        const created = await smtpAPI.create(form);
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
      await smtpAPI.delete(deletingConfig.id);
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
                        c.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.email.toLowerCase().includes(searchTerm.toLowerCase());
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
        <SMTPModal editing={editingConfig} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} showToast={showToast} />
      )}

      {/* Top Hub Header */}
      <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-4">
        <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Email SMTP Configurations</h1>
              <p className="text-xs text-slate-400 mt-0.5">Manage mail servers for notifications and broadcasts</p>
            </div>
          </div>
          {canManage && (
            <button onClick={() => openCreate()}
              className="self-stretch sm:self-auto px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 hover:from-blue-700 hover:to-indigo-700 transition-all flex-shrink-0">
              <Plus className="h-3.5 w-3.5" /> Add Server Config
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
            <Server className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
        <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-3.5 sm:p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Active Servers</p>
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
          <input type="text" placeholder="Search by name, host, or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none font-medium transition-shadow" />
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-3 flex-shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button type="button" role="switch" aria-checked={showActiveOnly} onClick={() => setShowActiveOnly(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-blue-600' : 'bg-slate-200'}`}>
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-400 font-medium">Loading SMTP configurations...</p>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
            <Server className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base mb-1">
            {searchTerm ? 'No matching configurations found' : 'No SMTP Configurations Registered'}
          </h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
            {searchTerm ? 'Try adjusting your search query.' : 'Register an SMTP server configuration to enable automated emails and broadcast campaigns.'}
          </p>
          {!searchTerm && canManage && (
            <button onClick={() => openCreate()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-200 hover:from-blue-700 hover:to-indigo-700 transition-all">
              <Plus className="h-4 w-4" /> Add First Config
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
                      <Server className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate text-sm">{config.name}</h3>
                      <p className="text-xs text-slate-400 font-medium truncate">{config.email}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${config.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${config.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {config.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">SMTP Host</p>
                    <p className="font-mono font-bold text-slate-900 text-xs tracking-wide mt-0.5 truncate">
                      {config.host}
                    </p>
                  </div>
                  <div className="text-right border-l border-slate-200 pl-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Port</p>
                    <p className="font-mono font-bold text-blue-700 text-sm mt-0.5">
                      {config.port}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${config.use_tls ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                      TLS
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${config.use_ssl ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                      SSL
                    </span>
                  </div>
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