'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { whatsAppConfigAPI } from '@/lib/communication.service';
import type { WhatsAppConfig, WhatsAppConfigFormValues } from '@/lib/types';
import {
  MessageSquare, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  Lock, Radio, ShieldQuestion, Send, Smartphone, Globe, Link as LinkIcon, HelpCircle
} from 'lucide-react';

// ─── Provider Options ──────────────────────────────────────────────────────────

const WA_PROVIDERS = [
  { id: 'meta_cloud', label: 'Meta Cloud API (Official)' },
  { id: 'twilio', label: 'Twilio' },
  { id: 'termii', label: 'Termii' },
  { id: 'custom', label: 'Custom REST API' },
] as const;

function providerLabel(id: string): string {
  return WA_PROVIDERS.find(p => p.id === id)?.label ?? id;
}

// ─── Phone Number Validation ────────────────────────────────────────────────────

// E.164: + followed by 8-15 digits, first digit non-zero
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

function isValidE164(value: string): boolean {
  return E164_REGEX.test(value.trim());
}

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
  open: boolean; config: WhatsAppConfig | null; isDeleting: boolean;
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

// ─── Test Send Modal ───────────────────────────────────────────────────────────

function TestSendModal({ open, config, onClose, showToast }: {
  open: boolean; config: WhatsAppConfig | null; onClose: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!open || !config) return null;

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      showToast('error', 'Please enter a destination phone number.');
      return;
    }
    if (!isValidE164(phoneNumber)) {
      showToast('error', 'Enter the number in international format, e.g. +2348012345678.');
      return;
    }

    setIsSending(true);
    try {
      // Calling the backend endpoint directly to ensure payload matches {"to": "..."}
      await api.post(`/api/communication/whatsapp-configs/${config.id}/test-send/`, {
        to: phoneNumber
      });
      showToast('success', `Test message dispatched successfully to ${phoneNumber}.`);
      onClose();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Send className="h-4 w-4" /> Test Connection
          </h3>
          <button onClick={onClose} disabled={isSending} className="text-white/70 hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleTestSend} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Destination Phone Number</label>
            <input required type="text" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
              placeholder="e.g. +2348012345678" className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 outline-none bg-white font-medium" />
            <p className="text-[10px] text-slate-400 mt-1.5">Include the country code (e.g. +234 for Nigeria).</p>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800">
            A standard greeting message will be sent using the <span className="font-bold">{config.name}</span> configuration to verify credentials.
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} disabled={isSending}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSending}
              className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
              {isSending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Message</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Credentials Explainer Modal ────────────────────────────────────────────────

const WA_CREDENTIAL_STEPS: Record<string, { intro: string; steps: string[] }> = {
  meta_cloud: {
    intro: 'The Meta Cloud API is managed through Meta Business Manager, not a simple provider dashboard — credentials live across a few different screens.',
    steps: [
      'Go to business.facebook.com and open (or create) a WhatsApp Business Account (WABA) under Business Settings.',
      'In the WhatsApp → API Setup screen, note the Phone Number ID and WhatsApp Business Account ID shown there.',
      'Generate an access token: a temporary token works for testing, but for production create a System User (Business Settings → Users → System Users) and generate a permanent token with whatsapp_business_messaging permission.',
      'Webhook Verify Token is not issued by Meta — you invent any string yourself, enter it here, and enter the exact same string when configuring the webhook in the Meta dashboard.',
    ],
  },
  twilio: {
    intro: 'Twilio identifies your account with an Account SID and authenticates with an Auth Token — both come from the same page.',
    steps: [
      'Log in to the Twilio Console.',
      'On the main dashboard, find "Account Info" — it shows the Account SID and Auth Token directly.',
      'Click "view" to reveal the Auth Token, then copy both values.',
      'If using the WhatsApp Sandbox for testing, the sandbox number is shown under Messaging → Try it out → Send a WhatsApp message.',
    ],
  },
  termii: {
    intro: 'Termii uses a single API Key for authentication — no separate secret is needed.',
    steps: [
      'Log in to the Termii dashboard at accounts.termii.com.',
      'Open Settings → API Keys from the left sidebar.',
      'Copy the API Key shown there and paste it into the API Key field here.',
    ],
  },
};

function WhatsAppCredentialsHelpModal({ initialProvider, onClose }: { initialProvider: string; onClose: () => void }) {
  const tabs = WA_PROVIDERS.filter(p => p.id !== 'custom');
  const [tab, setTab] = useState<string>(
    tabs.some(t => t.id === initialProvider) ? initialProvider : 'meta_cloud'
  );
  const active = WA_CREDENTIAL_STEPS[tab];

  return (
    <div className="fixed inset-0 z-[65] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg h-[min(580px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
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
            <p className="text-xs text-amber-800 leading-relaxed">Meta's Business Manager UI in particular changes fairly often — search "System Users" or "API Setup" in Business Settings if a step doesn't match exactly.</p>
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

// ─── WhatsApp Registration Modal ───────────────────────────────────────────────

function WhatsAppModal({
  editing, isSaving, onSave, onClose, showToast
}: {
  editing: WhatsAppConfig | null; isSaving: boolean;
  onSave: (data: WhatsAppConfigFormValues) => Promise<void>; onClose: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [form, setForm] = useState<Partial<WhatsAppConfigFormValues>>(
    editing ? {
      name: editing.name,
      provider: editing.provider,
      is_active: editing.is_active,
      from_phone_number: editing.from_phone_number,
      registered_school_numbers: editing.registered_school_numbers,
      parent_portal_url: editing.parent_portal_url || '',
      meta_phone_number_id: editing.meta_phone_number_id || '',
      meta_waba_id: editing.meta_waba_id || '',
      twilio_account_sid: editing.twilio_account_sid || '',
      custom_api_base_url: editing.custom_api_base_url || '',
    } : {
      name: '',
      provider: '' as any,
      is_active: false,
      from_phone_number: '',
      registered_school_numbers: [],
      parent_portal_url: '',
    }
  );
  const [showHelp, setShowHelp] = useState(false);

  // Use a string state for the text area editing of registered numbers
  const [numbersText, setNumbersText] = useState((form.registered_school_numbers || []).join('\n'));

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.provider || !form.from_phone_number?.trim()) {
      showToast('error', 'Please fill in all mandatory configuration fields, including the provider.'); return;
    }
    if (!isValidE164(form.from_phone_number)) {
      showToast('error', 'Sender Phone Number must be in international format, e.g. +2348012345678.'); return;
    }

    // Convert text area back to array of strings, and validate each entry —
    // fraud-detection matching depends on these being clean E.164 numbers.
    const parsedNumbers = numbersText.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    const badNumbers = parsedNumbers.filter(n => !isValidE164(n));
    if (badNumbers.length > 0) {
      showToast('error', `These registered numbers aren't in international format (e.g. +2348012345678):\n${badNumbers.slice(0, 3).join('\n')}${badNumbers.length > 3 ? `\n...and ${badNumbers.length - 3} more` : ''}`);
      return;
    }

    const payload = { ...form, registered_school_numbers: parsedNumbers } as WhatsAppConfigFormValues;

    // Validation per provider
    if (form.provider === 'meta_cloud') {
      if (!editing && !payload.meta_access_token_input?.trim()) {
        showToast('error', 'Meta Access Token is required for new setups.'); return;
      }
    } else if (form.provider === 'twilio') {
      if (!payload.twilio_account_sid?.trim()) {
        showToast('error', 'Twilio Account SID is required.'); return;
      }
      if (!editing && !payload.twilio_auth_token_input?.trim()) {
        showToast('error', 'Twilio Auth Token is required for new setups.'); return;
      }
    } else if (form.provider === 'termii') {
      if (!editing && !payload.termii_api_key_input?.trim()) {
        showToast('error', 'Termii API Key is required for new setups.'); return;
      }
    }

    try {
      await onSave(payload);
    } catch (err) { showToast('error', extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 outline-none bg-white font-medium text-slate-800 transition-shadow";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      {showHelp && <WhatsAppCredentialsHelpModal initialProvider={form.provider || 'meta_cloud'} onClose={() => setShowHelp(false)} />}
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-3xl h-[min(800px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <MessageSquare className="h-4 w-4" />
            </span>
            {editing ? 'Edit WhatsApp Config' : 'Register WhatsApp Provider'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-6">
          <form id="wa-form" onSubmit={handleSubmit} className="space-y-6">

            {/* General Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Globe className="h-4 w-4 text-emerald-600" /> General Info
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Config Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.name || ''} onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Official School Line" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Provider <span className="text-red-500">*</span></label>
                  <select value={form.provider || ''} onChange={e => set('provider', e.target.value)} className={inputCls}>
                    <option value="" disabled>Select a provider...</option>
                    {WA_PROVIDERS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Sender Phone Number <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.from_phone_number || ''} onChange={e => set('from_phone_number', e.target.value)}
                    placeholder="e.g. +2348012345678" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Parent Portal URL</label>
                  <input type="url" value={form.parent_portal_url || ''} onChange={e => set('parent_portal_url', e.target.value)}
                    placeholder="e.g. https://portal.school.com" className={inputCls} />
                </div>
              </div>
            </div>

            {/* Provider Specific Credentials */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-600" /> API Credentials
                </h4>
                {form.provider && (
                  <button type="button" onClick={() => setShowHelp(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">
                    <HelpCircle className="h-3 w-3" /> Where do I find these?
                  </button>
                )}
              </div>

              {!form.provider ? (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400 text-center">
                  Select a provider above to see the required credential fields.
                </div>
              ) : (
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 space-y-4">
                  {form.provider === 'meta_cloud' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Phone Number ID</label>
                          <input type="text" value={form.meta_phone_number_id || ''} onChange={e => set('meta_phone_number_id', e.target.value)}
                            placeholder="From Meta Dashboard" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>WhatsApp Business Account ID</label>
                          <input type="text" value={form.meta_waba_id || ''} onChange={e => set('meta_waba_id', e.target.value)}
                            placeholder="From Meta Dashboard" className={inputCls} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Access Token {editing ? '' : <span className="text-red-500">*</span>}</label>
                        <input type="password" required={!editing} value={form.meta_access_token_input || ''} onChange={e => set('meta_access_token_input', e.target.value)}
                          placeholder={editing ? "•••••••• (Leave blank to keep)" : "Permanent or temporary token"} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Webhook Verify Token</label>
                        <input type="password" value={form.meta_webhook_verify_token_input || ''} onChange={e => set('meta_webhook_verify_token_input', e.target.value)}
                          placeholder={editing ? "•••••••• (Leave blank to keep)" : "For incoming messages (optional)"} className={inputCls} />
                      </div>
                    </>
                  )}

                  {form.provider === 'twilio' && (
                    <>
                      <div>
                        <label className={labelCls}>Twilio Account SID <span className="text-red-500">*</span></label>
                        <input type="text" required value={form.twilio_account_sid || ''} onChange={e => set('twilio_account_sid', e.target.value)}
                          placeholder="Starts with AC..." className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Auth Token {editing ? '' : <span className="text-red-500">*</span>}</label>
                        <input type="password" required={!editing} value={form.twilio_auth_token_input || ''} onChange={e => set('twilio_auth_token_input', e.target.value)}
                          placeholder={editing ? "•••••••• (Leave blank to keep)" : "Your Twilio Auth Token"} className={inputCls} />
                      </div>
                    </>
                  )}

                  {form.provider === 'termii' && (
                    <div>
                      <label className={labelCls}>Termii API Key {editing ? '' : <span className="text-red-500">*</span>}</label>
                      <input type="password" required={!editing} value={form.termii_api_key_input || ''} onChange={e => set('termii_api_key_input', e.target.value)}
                        placeholder={editing ? "•••••••• (Leave blank to keep)" : "Your Termii API Key"} className={inputCls} />
                    </div>
                  )}

                  {form.provider === 'custom' && (
                    <>
                      <div>
                        <label className={labelCls}>Custom API Base URL</label>
                        <input type="url" value={form.custom_api_base_url || ''} onChange={e => set('custom_api_base_url', e.target.value)}
                          placeholder="e.g. https://api.myprovider.com/v1" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Custom API Key</label>
                        <input type="password" value={form.custom_api_key_input || ''} onChange={e => set('custom_api_key_input', e.target.value)}
                          placeholder={editing ? "•••••••• (Leave blank to keep)" : "Authorization Bearer Token"} className={inputCls} />
                      </div>
                    </>
                  )}

                  {editing && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <ShieldQuestion className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        API Tokens are encrypted at rest. Only enter new keys if you wish to overwrite the existing credentials.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Activation */}
            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Radio className="h-4 w-4 text-emerald-600" /> Activation
              </h4>
              <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <div className="pr-4">
                  <p className="text-sm font-semibold text-slate-800">Set as Active Configuration</p>
                  <p className="text-xs text-slate-400 mt-0.5">Only one WhatsApp config can be active at a time — turning this on will deactivate whichever config is currently active.</p>
                </div>
                <button type="button" role="switch" aria-checked={!!form.is_active}
                  onClick={() => set('is_active', !form.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Fraud Protection / Security */}
            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <ShieldQuestion className="h-4 w-4 text-emerald-600" /> Fraud Protection
              </h4>
              <div>
                <label className={labelCls}>Registered Official School Numbers</label>
                <textarea rows={3} value={numbersText} onChange={e => setNumbersText(e.target.value)}
                  placeholder="+2348012345678&#10;+2348098765432" className={inputCls} />
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  One number per line, in international format (e.g. +2348012345678). Inbound payment claims from numbers not in this list are flagged as suspicious by the AI bot.
                </p>
              </div>
            </div>

          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-white hover:border-slate-300 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="wa-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold rounded-xl shadow-md shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Saving...'}</> : <><Check className="h-4 w-4" />{editing ? 'Update Configuration' : 'Register Provider'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function WhatsAppConfigsPage() {
  const { hasPermission, user } = useAuth();

  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WhatsAppConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingConfig, setDeletingConfig] = useState<WhatsAppConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [testingConfig, setTestingConfig] = useState<WhatsAppConfig | null>(null);

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
      const data = await whatsAppConfigAPI.list();
      setConfigs(data);
    } catch (err) { showToast('error', extractError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const openCreate = () => {
    setEditingConfig(null);
    setShowModal(true);
  };

  const openEdit = (config: WhatsAppConfig) => {
    setEditingConfig(config);
    setShowModal(true);
  };

  const handleSave = async (form: WhatsAppConfigFormValues) => {
    setIsSaving(true);
    try {
      if (editingConfig) {
        const updated = await whatsAppConfigAPI.update(editingConfig.id, form);
        setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
        showToast('success', `"${updated.name}" updated successfully.`);
      } else {
        const created = await whatsAppConfigAPI.create(form);
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
      await whatsAppConfigAPI.delete(deletingConfig.id);
      setConfigs(prev => prev.filter(c => c.id !== deletingConfig.id));
      showToast('success', `"${deletingConfig.name}" removed successfully.`);
      setDeletingConfig(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingConfig(null);
    } finally { setIsDeleting(false); }
  };

  const handleSetActive = async (id: number) => {
    try {
      await whatsAppConfigAPI.setActive(id);
      // Update UI locally to reflect the backend logic: only one can be active.
      setConfigs(prev => prev.map(c => ({
        ...c,
        is_active: c.id === id
      })));
      showToast('success', 'Active configuration updated.');
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const filteredConfigs = configs.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.from_phone_number.includes(searchTerm);
    const matchActive = !showActiveOnly || c.is_active;
    return matchSearch && matchActive;
  });

  const activeConfig = configs.find(c => c.is_active);

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal open={!!deletingConfig} config={deletingConfig} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingConfig(null)} />

      <TestSendModal open={!!testingConfig} config={testingConfig} onClose={() => setTestingConfig(null)} showToast={showToast} />

      {showModal && (
        <WhatsAppModal editing={editingConfig} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} showToast={showToast} />
      )}

      {/* Top Hub Header */}
      <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-4">
        <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-green-600 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">WhatsApp Configurations</h1>
              <p className="text-xs text-slate-400 mt-0.5">Manage messaging API endpoints and chatbots</p>
            </div>
          </div>
          {canManage && (
            <button onClick={() => openCreate()}
              className="self-stretch sm:self-auto px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 hover:from-emerald-700 hover:to-green-700 transition-all flex-shrink-0">
              <Plus className="h-3.5 w-3.5" /> Add WhatsApp Provider
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
            <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
        <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-3.5 sm:p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Active Route</p>
            <p className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 truncate">
              {loading ? '—' : activeConfig ? activeConfig.name : 'None Selected'}
            </p>
          </div>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${activeConfig ? 'from-emerald-500 to-green-600' : 'from-amber-400 to-orange-500'}`}>
            {activeConfig ? <Radio className="h-4 w-4 sm:h-5 sm:w-5" /> : <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search by name, provider, or phone number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
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
          <p className="mt-3 text-sm text-slate-400 font-medium">Loading WhatsApp configurations...</p>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <MessageSquare className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base mb-1">
            {searchTerm ? 'No matching configurations found' : 'No WhatsApp Providers Registered'}
          </h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
            {searchTerm ? 'Try adjusting your search query.' : 'Register a WhatsApp API provider to enable chatbot services and rich messaging.'}
          </p>
          {!searchTerm && canManage && (
            <button onClick={() => openCreate()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-200 hover:from-emerald-700 hover:to-green-700 transition-all">
              <Plus className="h-4 w-4" /> Add First Config
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredConfigs.map(config => (
            <div key={config.id} className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className={`h-1 w-full bg-gradient-to-r ${config.is_active ? 'from-emerald-500 to-teal-500' : 'from-slate-300 to-slate-400'}`} />
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold ${config.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate text-sm">{config.name}</h3>
                      <p className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-wide">{providerLabel(config.provider)}</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span className="text-[10px] font-bold text-slate-500">ACTIVE</span>
                    <button type="button" role="switch" aria-checked={config.is_active}
                      onClick={() => { if (!config.is_active) handleSetActive(config.id); }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${config.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${config.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sender Number</p>
                    <p className="font-mono font-bold text-slate-900 text-xs tracking-wide mt-0.5 truncate">
                      {config.from_phone_number || '—'}
                    </p>
                  </div>
                  <div className="text-right border-l border-slate-200 pl-3">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Registered #s</p>
                     <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                       {config.registered_school_numbers?.length || 0}
                     </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex gap-1.5">
                    {canManage && (
                       <button onClick={() => setTestingConfig(config)} title="Test Connection"
                         className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors uppercase tracking-wide">
                         <Send className="h-3 w-3" /> Test
                       </button>
                    )}
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