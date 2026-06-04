'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { aiServicesAPI } from '@/lib/api';
import { AIServiceConfig } from '@/lib/types';
import {
  Cpu, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  Zap, Activity, Database, TrendingUp, ChevronDown,
  ChevronUp, Key, Globe, ToggleLeft,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; message: string; }

type AIModelMeta = { id: string; label: string; flags: string };

// Enriched map with emojis for native HTML rendering
const AI_MODELS_MAP: Record<string, AIModelMeta[]> = {
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o', flags: '🧠 Smartest, 👁️ Vision' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', flags: '⚡ Fast, 🧠 Smart' },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', flags: '⚡ Fastest, 💰 Cheap' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', flags: '⚡ Fast, 🧠 Smartest' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', flags: '🧠 Smart, 💎 Premium' },
    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', flags: '⚡ Fastest, 💰 Cheap' },
  ],
  groq: [
      { id: 'llama-3.3-70b-versatile',  label: 'Llama 3.3 (70B)',   flags: '🚀 Lightning, 🧠 Smart' },
      { id: 'llama-3.1-8b-instant',     label: 'Llama 3.1 (8B)',    flags: '🚀 Lightning, 💰 Cheap' },
      { id: 'llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', flags: '⚡ Fast, ⚖️ Balanced' },
      { id: 'gemma2-9b-it',             label: 'Gemma 2 (9B)',      flags: '⚡ Fast' },
  ],
  google: [
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', flags: '🧠 Smart, 📚 Huge Context' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', flags: '⚡ Fast, 💰 Cheap' },
  ],
  local: [],
  custom: []
};

// Default URLs to auto-fill when a provider is selected
const DEFAULT_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1/messages',
  groq: 'https://api.groq.com/openai/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/models/',
  local: 'http://localhost:11434/v1',
  custom: 'https://your-custom-api.com/v1/chat'
};

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([f, v]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(v) ? v[0] : String(v)}`)
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
    if (d.non_field_errors?.length) return d.non_field_errors[0];
    if (typeof d === 'object') {
      const msgs = Object.entries(d)
        .map(([f, v]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'error' ? 'bg-red-50 border-red-200 text-red-900'
          : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : t.type === 'error'
            ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
            : <Zap className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />}
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
function ConfirmModal({ open, service, isDeleting, onConfirm, onCancel }: {
  open: boolean; service: AIServiceConfig | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !service) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete AI Service</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{service.name}"</span>?
          This cannot be undone and may affect AI marking configurations.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
              : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AIServiceConfigFormValues {
  name: string;
  service_type: string;
  model_name: string;
  api_endpoint: string;
  api_key: string;
  is_active: boolean;
  default_temperature: number;
  default_max_tokens: number;
  monthly_token_limit?: number;
}


// ─── Service Form Modal ────────────────────────────────────────────────────────
const DEFAULT_FORM: AIServiceConfigFormValues = {
  name: '',
  service_type: 'openai',
  model_name: '',
  api_endpoint: DEFAULT_ENDPOINTS['openai'],
  api_key: '',
  is_active: true,
  default_temperature: 0.7,
  default_max_tokens: 1000,
  monthly_token_limit: undefined,
};

function ServiceModal({ editing, isSaving, onSave, onClose }: {
  editing: AIServiceConfig | null;
  isSaving: boolean;
  onSave: (data: AIServiceConfigFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AIServiceConfigFormValues>(
    editing
      ? {
          name: editing.name,
          service_type: editing.service_type,
          model_name: editing.model_name || '',
          api_endpoint: editing.api_endpoint || '',
          api_key: '',
          is_active: editing.is_active,
          default_temperature: editing.default_temperature,
          default_max_tokens: editing.default_max_tokens,
          monthly_token_limit: editing.monthly_token_limit ?? undefined,
        }
      : DEFAULT_FORM
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof AIServiceConfigFormValues>(key: K, value: AIServiceConfigFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            {editing ? 'Edit AI Service' : 'New AI Service'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form id="ai-service-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* Name */}
            <div>
              <label className={labelCls}>Configuration Name <span className="text-red-400 normal-case">*</span></label>
              <input type="text" required value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g., Primary Auto-Marker"
                className={inputCls} />
            </div>

            {/* Type + Model Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Service Type <span className="text-red-400 normal-case">*</span></label>
                <select
                  required
                  value={form.service_type}
                  onChange={e => {
                    const newType = e.target.value as any;
                    setForm(prev => ({
                      ...prev,
                      service_type: newType,
                      model_name: '', // Reset model
                      api_endpoint: DEFAULT_ENDPOINTS[newType] || '' // Auto-fill endpoint
                    }));
                  }}
                  className={inputCls}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="groq">Groq</option>
                  <option value="google">Google Gemini</option>
                  <option value="local">Local Server</option>
                  <option value="custom">Custom API</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Model <span className="text-red-400 normal-case">*</span></label>
                {form.service_type === 'local' || form.service_type === 'custom' ? (
                  <input type="text" required value={form.model_name || ''}
                    onChange={e => set('model_name', e.target.value)}
                    placeholder="e.g., llama3"
                    className={inputCls} />
                ) : (
                  <select required value={form.model_name || ''}
                    onChange={e => set('model_name', e.target.value)}
                    className={inputCls}>
                    <option value="" disabled>Select a model...</option>
                    {(AI_MODELS_MAP[form.service_type] || []).map(m => (
                      <option key={m.id} value={m.id}>{m.label} {m.flags ? `— ${m.flags}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Full Width API Endpoint */}
            <div>
              <label className={labelCls}>
                API Endpoint
                <span className="text-slate-400 normal-case ml-1 font-normal">(Auto-filled)</span>
              </label>
              <input type="url" value={form.api_endpoint || ''}
                onChange={e => set('api_endpoint', e.target.value)}
                placeholder="e.g., https://api.openai.com/v1"
                className={inputCls} />
            </div>

            {/* API Key */}
            <div>
              <label className={labelCls}>
                API Key <span className="text-red-400 normal-case">*</span>
                {editing && <span className="text-slate-400 normal-case ml-1 font-normal">(leave blank to keep current)</span>}
              </label>
              <input type="password" required={!editing} value={form.api_key}
                onChange={e => set('api_key', e.target.value)}
                placeholder={editing ? '••••••••••••••••' : 'sk-...'}
                className={inputCls} />
            </div>

            {/* Temperature + Max Tokens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Default Temperature</label>
                <input type="number" step={0.1} min={0} max={2}
                  value={form.default_temperature}
                  onChange={e => set('default_temperature', parseFloat(e.target.value))}
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Randomness (0–2)</p>
              </div>
              <div>
                <label className={labelCls}>Max Tokens</label>
                <input type="number" min={1}
                  value={form.default_max_tokens}
                  onChange={e => set('default_max_tokens', parseInt(e.target.value))}
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Max response length</p>
              </div>
            </div>

            {/* Monthly Limit */}
            <div>
              <label className={labelCls}>Monthly Token Limit</label>
              <input type="number" min={0}
                value={form.monthly_token_limit ?? ''}
                onChange={e => set('monthly_token_limit', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Leave blank for unlimited"
                className={inputCls} />
              <p className="text-xs text-slate-400 mt-1">Optional monthly usage cap to control costs</p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-800">Active</p>
                <p className="text-xs text-slate-400 mt-0.5">Service is available for use in marking</p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active}
                onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-4 ${form.is_active ? 'bg-violet-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="ai-service-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-violet-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Service' : 'Create Service'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Token Usage Bar ───────────────────────────────────────────────────────────
function TokenUsageBar({ used, limit }: { used: number; limit?: number }) {
  if (!limit) {
    return (
      <span className="text-sm font-semibold text-slate-700">
        {used.toLocaleString()} <span className="text-xs font-normal text-slate-400">tokens used</span>
      </span>
    );
  }
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600';
  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${textColor}`}>{used.toLocaleString()} / {limit.toLocaleString()}</span>
        <span className="text-slate-400">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AIServicesPage() {
  const { hasPermission, user } = useAuth();

  const [services, setServices] = useState<AIServiceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<AIServiceConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingService, setDeletingService] = useState<AIServiceConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canView   = user?.is_superuser || hasPermission('assessment_center.view_aiserviceconfigmodel');
  const canCreate = user?.is_superuser || hasPermission('assessment_center.add_aiserviceconfigmodel');
  const canEdit   = user?.is_superuser || hasPermission('assessment_center.change_aiserviceconfigmodel');
  const canDelete = user?.is_superuser || hasPermission('assessment_center.delete_aiserviceconfigmodel');

  const showToast = (type: ToastItem['type'], message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchServices = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await aiServicesAPI.list();
      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (canView) fetchServices(); }, [fetchServices, canView]);

  const openCreate = () => { setEditingService(null); setShowModal(true); };
  const openEdit = (s: AIServiceConfig) => { setEditingService(s); setShowModal(true); };

  const handleSave = async (form: AIServiceConfigFormValues) => {
    setIsSaving(true);
    try {
      if (editingService) {
        const updated = await aiServicesAPI.update(editingService.id, form as any);
        setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast('success', `"${updated.name}" updated successfully`);
      } else {
        const created = await aiServicesAPI.create(form as any);
        setServices(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingService) return;
    setIsDeleting(true);
    try {
      await aiServicesAPI.delete(deletingService.id);
      setServices(prev => prev.filter(s => s.id !== deletingService.id));
      showToast('success', `"${deletingService.name}" deleted`);
      setDeletingService(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingService(null);
    } finally { setIsDeleting(false); }
  };

  const handleTestConnection = async (service: AIServiceConfig) => {
    setTestingId(service.id);
    try {
      const result = await aiServicesAPI.testConnection(service.id);
      showToast(result.success ? 'success' : 'error', result.message || (result.success ? 'Connection successful!' : 'Connection failed'));
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setTestingId(null); }
  };

  const handleResetUsage = async (service: AIServiceConfig) => {
    setResettingId(service.id);
    try {
      await aiServicesAPI.resetUsage(service.id);
setServices(prev => prev.map(s => s.id === service.id ? { ...s, tokens_used_this_month: 0 } : s));
      showToast('success', `Token usage reset for "${service.name}"`);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setResettingId(null); }
  };

  // Permission denied
  if (!canView) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-500">You don't have permission to view AI services.</p>
      </div>
    </div>
  );

  const filtered = services.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.service_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchActive = !showActiveOnly || s.is_active;
    return matchSearch && matchActive;
  });

  const totalActive = services.filter(s => s.is_active).length;
  const totalTokensUsed = services.reduce((sum, s) => sum + (s.tokens_used_this_month ?? 0), 0);

  const serviceTypeLabel = (type: string) => ({ openai: 'OpenAI', anthropic: 'Anthropic', groq: 'Groq', google: 'Google', local: 'Local', custom: 'Custom' }[type] ?? type);
  const serviceTypeBadgeColor = (type: string) => ({
    openai: 'bg-emerald-100 text-emerald-700',
    anthropic: 'bg-violet-100 text-violet-700',
    groq: 'bg-orange-100 text-orange-700',
    google: 'bg-blue-100 text-blue-700',
    custom: 'bg-slate-100 text-slate-700',
    local: 'bg-zinc-100 text-zinc-700'
  }[type] ?? 'bg-slate-100 text-slate-600');

  // Exact column sizing guarantees alignment for headers and rows
  const gridClasses = "grid grid-cols-[minmax(0,1fr)_130px_150px_100px_160px] items-center gap-4";

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingService} service={deletingService} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingService(null)}
      />

      {showModal && (
        <ServiceModal editing={editingService} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            AI Services
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Configure AI providers for automated marking</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200">
            <Plus className="h-4 w-4" /> Add AI Service
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Services', value: services.length, icon: Cpu, color: 'from-violet-500 to-purple-600' },
          { label: 'Active', value: totalActive, icon: Check, color: 'from-emerald-500 to-teal-600' },
          { label: 'Tokens Used (Month)', value: totalTokensUsed.toLocaleString(), icon: TrendingUp, color: 'from-blue-500 to-indigo-600' },
          { label: 'With Usage Limits', value: services.filter(s => s.monthly_token_limit).length, icon: Database, color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Search + filter bar */}
          <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search by name or provider..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" role="switch" aria-checked={showActiveOnly}
                  onClick={() => setShowActiveOnly(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-violet-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-slate-600">Active only</span>
              </label>
              <button onClick={fetchServices} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* States */}
          {loading ? (
            <div className="p-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
              <p className="mt-2 text-sm text-slate-400">Loading AI services...</p>
            </div>
          ) : pageError ? (
            <div className="p-10 text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-600 mb-3">{pageError}</p>
              <button onClick={fetchServices} className="text-sm text-violet-600 underline inline-flex items-center gap-1">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Cpu className="h-7 w-7 text-violet-300" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">
                {searchTerm ? 'No services match your search' : 'No AI services yet'}
              </h3>
              <p className="text-sm text-slate-400 mb-5">
                {searchTerm ? 'Try different keywords.' : 'Add your first AI service to enable automated marking.'}
              </p>
              {!searchTerm && canCreate && (
                <button onClick={openCreate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200">
                  <Plus className="h-4 w-4" /> Add AI Service
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className={`${gridClasses} px-5 py-3 bg-slate-50/60 border-b border-slate-100`}>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Provider</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Model</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</span>
              </div>

              <div className="divide-y divide-slate-50">
                {filtered.map(service => (
                  <div key={service.id}>
                    <div className={`${gridClasses} px-5 py-4 hover:bg-slate-50/50 transition-colors`}>

                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${service.is_active ? 'bg-violet-100' : 'bg-slate-100'}`}>
                          <Cpu className={`h-4 w-4 ${service.is_active ? 'text-violet-600' : 'text-slate-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{service.name}</p>
                          <div className="w-24 mt-0.5">
                            <TokenUsageBar used={service.tokens_used_this_month ?? 0} limit={service.monthly_token_limit ?? undefined} />
                          </div>
                        </div>
                      </div>

                      {/* Provider badge */}
                      <div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${serviceTypeBadgeColor(service.service_type)}`}>
                          {serviceTypeLabel(service.service_type)}
                        </span>
                      </div>

                      {/* Model Name */}
                      <div className="min-w-0">
                        <p className="text-sm text-slate-600 truncate bg-slate-100 px-2 py-1 rounded inline-block" title={service.model_name || 'Default'}>
                          {service.model_name || 'Default'}
                        </p>
                      </div>

                      {/* Status */}
                      <div>
                        {service.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        {/* Test Connection */}
                        <button onClick={() => handleTestConnection(service)}
                          disabled={testingId === service.id}
                          title="Test connection"
                          className="p-2 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all disabled:opacity-50">
                          {testingId === service.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Zap className="h-3.5 w-3.5" />}
                        </button>
                        {/* Reset Usage */}
                        {canEdit && service.monthly_token_limit && (service.tokens_used_this_month ?? 0) > 0 && (
                          <button onClick={() => handleResetUsage(service)}
                            disabled={resettingId === service.id}
                            title="Reset token usage"
                            className="p-2 rounded-lg text-violet-600 bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-all disabled:opacity-50">
                            {resettingId === service.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RefreshCw className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={() => openEdit(service)} title="Edit"
                            className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeletingService(service)} title="Delete"
                            className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => setExpandedId(expandedId === service.id ? null : service.id)} title="Toggle details"
                          className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                          {expandedId === service.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded row */}
                    {expandedId === service.id && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                              <Activity className="h-3 w-3" /> Temperature
                            </span>
                            <p className="mt-1 text-slate-700 font-medium">{service.default_temperature}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                              <Database className="h-3 w-3" /> Max Tokens
                            </span>
                            <p className="mt-1 text-slate-700 font-medium">{service.default_max_tokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" /> Monthly Limit
                            </span>
                            <p className="mt-1 text-slate-700 font-medium">
                              {service.monthly_token_limit ? service.monthly_token_limit.toLocaleString() : 'Unlimited'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                              <RefreshCw className="h-3 w-3" /> Last Reset
                            </span>
                            <p className="mt-1 text-slate-700 font-medium">
                              {service.last_reset_date ? new Date(service.last_reset_date).toLocaleDateString() : '—'}
                            </p>
                          </div>
                          {service.api_endpoint && (
                            <div className="col-span-2 sm:col-span-4">
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                <Globe className="h-3 w-3" /> API Endpoint
                              </span>
                              <p className="mt-1 text-slate-600 font-mono text-xs break-all">{service.api_endpoint}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer count */}
              <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
                <p className="text-xs text-slate-400">
                  Showing {filtered.length} of {services.length} service{services.length !== 1 ? 's' : ''}
                  {showActiveOnly ? ' (active only)' : ''}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}