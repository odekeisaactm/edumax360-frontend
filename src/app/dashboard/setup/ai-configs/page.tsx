'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { aiConfigAPI } from '@/lib/api';
import { SchoolAIConfig } from '@/lib/types';
import {
  Bot, Plus, Edit3, Trash2, Key, Plug, RotateCcw, Search,
  X, Check, AlertCircle, Server, Cpu, Globe, Zap, Loader2, AlertTriangle,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
    if (data.detail) return String(data.detail);
    if (data.non_field_errors) return (data.non_field_errors as string[]).join(' ');
    const fieldErrors = Object.entries(data)
      .map(([f, v]) => `${f}: ${Array.isArray(v) ? (v as string[]).join(', ') : v}`)
      .join(' | ');
    if (fieldErrors) return fieldErrors;
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean; title: string; message: string;
  confirmLabel?: string; variant?: 'danger' | 'warning';
  onConfirm: () => void; onCancel: () => void;
}
function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'}`}>
          <AlertTriangle className={`h-6 w-6 ${variant === 'danger' ? 'text-red-600' : 'text-amber-600'}`} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-white transition-colors ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  groq: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
  custom: [],
  local: [],
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AIConfigurationsPage() {
  const { hasPermission, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [configs, setConfigs] = useState<SchoolAIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SchoolAIConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; message: string;
    confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: 'Confirm', variant: 'danger', onConfirm: () => {} });

  // Actions & toasts
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Form
  const [formData, setFormData] = useState({
    name: '', provider: 'openai' as SchoolAIConfig['provider'],
    model_name: '', api_base_url: '', api_key: '',
    monthly_token_limit: 100000, is_active: true,
  });

  // ── Utils ──────────────────────────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
  const setAction = (id: number, action: string) => setActionLoading(prev => ({ ...prev, [id]: action }));
  const clearAction = (id: number) => setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const canView = user?.is_superuser || hasPermission('school_configuration.view_schoolaiconfigmodel');
    if (canView) fetchConfigs(); else setLoading(false);
  }, [mounted, user, hasPermission]);

  const fetchConfigs = async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await aiConfigAPI.list();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setPageError(extractErrorMessage(err));
    } finally { setLoading(false); }
  };

  // ── Modal handlers ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingConfig(null); setFormError(null);
    setFormData({ name: '', provider: 'openai', model_name: '', api_base_url: '', api_key: '', monthly_token_limit: 100000, is_active: true });
    setShowModal(true);
  };

  const openEdit = (c: SchoolAIConfig) => {
    setEditingConfig(c); setFormError(null);
    setFormData({ name: c.name, provider: c.provider, model_name: c.model_name, api_base_url: c.api_base_url || '', api_key: '', monthly_token_limit: c.monthly_token_limit, is_active: c.is_active });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); setFormError(null);
    try {
      const payload: any = {
        name: formData.name, provider: formData.provider, model_name: formData.model_name,
        api_base_url: formData.api_base_url, monthly_token_limit: formData.monthly_token_limit,
        is_active: formData.is_active,
      };
      // Backend serializer expects "api_key_input" — never send raw "api_key"
      if (formData.api_key) payload.api_key_input = formData.api_key;

      if (editingConfig) {
        const updated = await aiConfigAPI.update(editingConfig.id!, payload);
        setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
        showToast('success', 'Configuration updated');
      } else {
        if (!formData.api_key) throw new Error('API Key is required for new configurations');
        const created = await aiConfigAPI.create(payload);
        setConfigs(prev => [created, ...prev]);
        showToast('success', 'Configuration created');
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(extractErrorMessage(err));
    } finally { setIsSubmitting(false); }
  };

  // ── Confirm actions ────────────────────────────────────────────────────────
  const confirmDelete = (id: number, name: string) => {
    setConfirmState({
      open: true, title: 'Delete Configuration',
      message: `"${name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete', variant: 'danger',
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        setAction(id, 'delete');
        try {
          await aiConfigAPI.delete(id);
          setConfigs(prev => prev.filter(c => c.id !== id));
          showToast('success', 'Configuration deleted');
        } catch (err: any) {
          showToast('error', extractErrorMessage(err));
        } finally { clearAction(id); }
      },
    });
  };

  const confirmReset = (id: number, name: string) => {
    setConfirmState({
      open: true, title: 'Reset Usage Counter',
      message: `Reset monthly token usage for "${name}" to zero?`,
      confirmLabel: 'Reset', variant: 'warning',
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        setAction(id, 'reset');
        try {
          await aiConfigAPI.resetUsage(id);
          setConfigs(prev => prev.map(c => c.id === id ? { ...c, tokens_used_this_month: 0 } : c));
          showToast('success', 'Usage counter reset');
        } catch (err: any) {
          showToast('error', extractErrorMessage(err));
        } finally { clearAction(id); }
      },
    });
  };

  const handleTestConnection = async (id: number) => {
    setAction(id, 'test');
    try {
      const result = await aiConfigAPI.testConnection(id);
      showToast('success', result.detail || 'Connection successful!');
    } catch (err: any) {
      showToast('error', extractErrorMessage(err));
    } finally { clearAction(id); }
  };

  // ── Provider helpers ───────────────────────────────────────────────────────
  const getProviderIcon = (p: string) => {
    if (p === 'openai') return <Zap className="h-4 w-4 text-emerald-500" />;
    if (p === 'anthropic') return <Cpu className="h-4 w-4 text-orange-500" />;
    if (p === 'google') return <span className="font-black text-blue-500 text-sm leading-none">G</span>;
    if (p === 'groq') return <span className="font-black text-red-500 text-sm leading-none">Gr</span>;
    if (p === 'custom' || p === 'local') return <Server className="h-4 w-4 text-slate-500" />;
    return <Globe className="h-4 w-4 text-gray-400" />;
  };
  const getAccent = (p: string) => {
    if (p === 'openai') return 'from-emerald-400 to-teal-400';
    if (p === 'anthropic') return 'from-orange-400 to-amber-400';
    if (p === 'google') return 'from-blue-400 to-sky-400';
    if (p === 'groq') return 'from-red-400 to-rose-400';
    return 'from-slate-300 to-gray-400';
  };
  const getBg = (p: string) => {
    if (p === 'openai') return 'bg-emerald-50 border-emerald-100';
    if (p === 'anthropic') return 'bg-orange-50 border-orange-100';
    if (p === 'google') return 'bg-blue-50 border-blue-100';
    if (p === 'groq') return 'bg-red-50 border-red-100';
    return 'bg-slate-50 border-slate-100';
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
    </div>
  );

  const canView   = user?.is_superuser || hasPermission('school_configuration.view_schoolaiconfigmodel');
  const canAdd    = user?.is_superuser || hasPermission('school_configuration.add_schoolaiconfigmodel');
  const canChange = user?.is_superuser || hasPermission('school_configuration.change_schoolaiconfigmodel');
  const canDelete = user?.is_superuser || hasPermission('school_configuration.delete_schoolaiconfigmodel');

  if (!canView) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">You don't have permission to view AI Configurations.</p>
      </div>
    </div>
  );

  const filteredConfigs = configs.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.model_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-8">
      {/* Toast stack — z-[70], always visible above everything */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmState.open} title={confirmState.title} message={confirmState.message}
        confirmLabel={confirmState.confirmLabel} variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-purple-200">
              <Bot className="h-5 w-5 text-white" />
            </div>
            AI Configurations
          </h1>
          <p className="text-sm text-gray-500 pl-12">Manage LLM providers, API keys, and usage limits</p>
        </div>
        {canAdd && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md shadow-purple-200">
            <Plus className="h-4 w-4" /> Add Configuration
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search by name, provider, or model..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto" />
          <p className="mt-2 text-sm text-gray-400">Loading...</p>
        </div>
      ) : pageError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">{pageError}</p>
          <button onClick={fetchConfigs} className="mt-3 text-sm text-red-600 underline">Retry</button>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bot className="h-8 w-8 text-purple-300" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">No configurations found</h3>
          <p className="text-sm text-gray-400">Get started by adding your first AI provider.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredConfigs.map(config => {
            const usagePct = config.monthly_token_limit
              ? Math.min((config.tokens_used_this_month / config.monthly_token_limit) * 100, 100) : 0;
            const isOver = usagePct >= 100;
            const isWarn = usagePct >= 80 && !isOver;
            const busy = actionLoading[config.id!];

            return (
              <div key={config.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                <div className={`h-1 w-full bg-gradient-to-r ${getAccent(config.provider)}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${getBg(config.provider)}`}>
                        {getProviderIcon(config.provider)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{config.name}</h3>
                        <p className="text-xs text-gray-400 capitalize truncate">{config.provider} · {config.model_name}</p>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ml-2 ${config.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {config.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400 font-medium">Usage this month</span>
                      <span className={`font-semibold ${isOver ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-gray-600'}`}>
                        {config.tokens_used_this_month.toLocaleString()} / {config.monthly_token_limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-gradient-to-r from-purple-500 to-indigo-500'}`}
                        style={{ width: `${usagePct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex gap-1">
                      {canChange && (
                        <button onClick={() => handleTestConnection(config.id!)} disabled={!!busy} title="Test Connection"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40">
                          {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                          Test
                        </button>
                      )}
                      {canChange && (
                        <button onClick={() => confirmReset(config.id!, config.name)} disabled={!!busy}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40">
                          {busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {canChange && (
                        <button onClick={() => openEdit(config)} title="Edit"
                          className="p-2 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => confirmDelete(config.id!, config.name)} disabled={!!busy} title="Delete"
                          className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all disabled:opacity-40">
                          {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="h-4 w-4" />
                {editingConfig ? 'Edit Configuration' : 'New Configuration'}
              </h3>
              <button onClick={() => setShowModal(false)} disabled={isSubmitting}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form error — outside scroll, always visible */}
            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1">
              <form id="ai-config-form" onSubmit={handleSubmit} className="p-6 space-y-4">

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Configuration Name</label>
                  <input type="text" required value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    placeholder="e.g., General GPT-4, Math Tutor" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Provider</label>
                  <select value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white">
                    <option value="openai">OpenAI</option>
                    <option value="groq">Groq</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="custom">Custom (OpenAI Compatible)</option>
                    <option value="local">Local / Ollama</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Model Name</label>
                  <div className="flex gap-2">
                    <select
                      value={PROVIDER_MODELS[formData.provider]?.includes(formData.model_name) ? formData.model_name : 'custom'}
                      onChange={e => {
                        const val = e.target.value;
                        if (val !== 'custom') setFormData({ ...formData, model_name: val });
                      }}
                      className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                    >
                      {PROVIDER_MODELS[formData.provider]?.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      <option value="custom">-- Custom Model Name --</option>
                    </select>

                    {(formData.provider === 'custom' || formData.provider === 'local' || !PROVIDER_MODELS[formData.provider]?.includes(formData.model_name)) && (
                      <input
                        type="text"
                        required
                        value={formData.model_name}
                        onChange={e => setFormData({ ...formData, model_name: e.target.value })}
                        className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        placeholder="e.g., my-custom-model"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Select from common models or enter a custom identifier.</p>
                </div>

                {(formData.provider === 'custom' || formData.provider === 'local') && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">API Base URL</label>
                    <input type="url" value={formData.api_base_url}
                      onChange={e => setFormData({ ...formData, api_base_url: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      placeholder="http://localhost:11434/v1" />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    API Key{' '}
                    {editingConfig && <span className="normal-case font-normal text-gray-400">(leave blank to keep existing)</span>}
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                    <input type="password" required={!editingConfig} value={formData.api_key}
                      onChange={e => setFormData({ ...formData, api_key: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono tracking-widest"
                      placeholder={editingConfig ? '••••••••••••' : 'sk-...'} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Monthly Token Limit</label>
                  <input type="number" required min="1000" value={formData.monthly_token_limit}
                    onChange={e => setFormData({ ...formData, monthly_token_limit: parseInt(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none" />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Active</p>
                    <p className="text-xs text-gray-400">Disable without deleting</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                    <div className="w-10 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 after:shadow-sm"></div>
                  </label>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
              <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" form="ai-config-form" disabled={isSubmitting}
                className="px-5 py-2 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-purple-200">
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                  : <><Check className="h-4 w-4" />{editingConfig ? 'Update' : 'Create'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}