'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { feeAPI } from '@/lib/api';
import { PaymentGatewayConfig, GatewayPurpose } from '@/lib/type';
import {
  Smartphone, Plus, Edit3, Trash2, Check, X,
  AlertCircle, AlertTriangle, Loader2, Search,
  RefreshCw, HelpCircle, Globe, Shield, Activity,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────

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
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Helper Modal ──────────────────────────────────────────────────────────────

function HelperModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="h-4 w-4" /> Payment Gateways — Helper
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong>Payment Gateways</strong> allow parents to pay school fees or fund student wallets online using providers like Paystack or Flutterwave.
          </p>
          <div className="space-y-3">
            {[
              {
                title: 'Name',
                color: 'bg-purple-100 text-purple-700',
                desc: 'A label for this configuration, e.g. "Main Paystack Gateway" or "USD Flutterwave".',
              },
              {
                title: 'Purpose',
                color: 'bg-indigo-100 text-indigo-700',
                desc: 'Restrict the gateway to "Fee Payment", "Wallet Funding", or allow "Both". Useful if you want different accounts for different revenue streams.',
              },
              {
                title: 'Credentials',
                color: 'bg-slate-100 text-slate-600',
                desc: 'Enter your Public and Secret keys provided by the gateway dashboard. These are stored securely.',
              },
            ].map(({ title, color, desc }) => (
              <div key={title} className="flex gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0 h-fit mt-0.5 ${color}`}>
                  {title}
                </span>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-xs text-purple-700 leading-relaxed">
              <strong>Tip:</strong> Use <strong>Test Mode</strong> during setup to verify everything works without using real money. Once verified, switch to production keys and disable test mode.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────

function ConfirmModal({ open, gateway, isDeleting, onConfirm, onCancel }: {
  open: boolean; gateway: PaymentGatewayConfig | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !gateway) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Gateway</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete the gateway{' '}
          <span className="font-semibold text-slate-700">"{gateway.name}"</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting
              ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</>
              : <><Trash2 className="h-4 w-4" />Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gateway Form Modal ──────────────────────────────────────────────────────

interface GatewayFormData {
  name: string;
  provider: 'paystack' | 'flutterwave' | 'custom';
  purpose: GatewayPurpose;
  is_active: boolean;
  is_test_mode?: boolean;
  public_key: string;
  secret_key: string;
  webhook_secret: string;
}
const EMPTY: GatewayFormData = {
  name: '', provider: 'paystack', purpose: 'both', is_active: true, is_test_mode: true,
  public_key: '', secret_key: '', webhook_secret: ''
};

function GatewayModal({ editing, isSaving, onSave, onClose }: {
  editing: PaymentGatewayConfig | null; isSaving: boolean;
  onSave: (data: GatewayFormData) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<GatewayFormData>(
    editing ? {
      name: editing.name,
      provider: editing.provider,
      purpose: editing.purpose,
      is_active: editing.is_active,
      is_test_mode: (editing as any).is_test_mode ?? true,
      public_key: editing.public_key || '',
      secret_key: '', // Always empty for editing unless user wants to change it
      webhook_secret: editing.webhook_secret || '',
    } : EMPTY
  );
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.public_key.trim()) { setFormError('Public key is required.'); return; }
    // Secret key only required for new gateways
    if (!editing && !form.secret_key.trim()) { setFormError('Secret key is required for new gateways.'); return; }

    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            {editing ? 'Edit Gateway' : 'New Gateway'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form id="gateway-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Paystack" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Provider <span className="text-red-400 normal-case">*</span></label>
                <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value as any }))}
                  className={inputCls}>
                  <option value="paystack">Paystack</option>
                  <option value="flutterwave">Flutterwave</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Purpose <span className="text-red-400 normal-case">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'fee_payment',    label: 'Fees Only' },
                  { id: 'wallet_funding', label: 'Wallet Only' },
                  { id: 'both',           label: 'Wallet and Fee' },
                ].map(p => (
                  <button key={p.id} type="button"
                    onClick={() => setForm(f => ({ ...f, purpose: p.id as GatewayPurpose }))}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                      form.purpose === p.id
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className={labelCls}>Public Key <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.public_key}
                  onChange={e => setForm(f => ({ ...f, public_key: e.target.value }))}
                  placeholder="pk_..." className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>Secret Key {editing && <span className="text-slate-300 normal-case font-normal">(leave blank to keep current)</span>}</label>
                <input type="password" value={form.secret_key}
                  onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))}
                  placeholder={editing ? "••••••••••••••••" : "sk_..."} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>Webhook Secret <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
                <input type="text" value={form.webhook_secret}
                  onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))}
                  placeholder="Secret for signature verification" className={`${inputCls} font-mono`} />
              </div>
            </div>

            <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-purple-600' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs font-bold text-slate-700">Active</span>
              </div>
              <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                <button type="button" onClick={() => setForm(f => ({ ...f, is_test_mode: !f.is_test_mode }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_test_mode ? 'bg-amber-500' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_test_mode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs font-bold text-slate-700">Test Mode</span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="gateway-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-purple-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Gateway' : 'Create Gateway'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PaymentGatewaysPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [gateways, setGateways]       = useState<PaymentGatewayConfig[]>([]);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [showHelper, setShowHelper]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGatewayConfig | null>(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [deletingGateway, setDeletingGateway] = useState<PaymentGatewayConfig | null>(null);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [toasts, setToasts]           = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const res = await feeAPI.getGatewayConfigs();
      setGateways(Array.isArray(res) ? res : ((res as any).results || []));
    }
    catch (err) { setPageError(extractError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingGateway(null); setShowModal(true); };
  const openEdit   = (g: PaymentGatewayConfig) => { setEditingGateway(g); setShowModal(true); };

  const handleSave = async (data: GatewayFormData) => {
    setIsSaving(true);
    try {
      if (editingGateway) {
        const updated = await feeAPI.updateGatewayConfig(editingGateway.id, data);
        setGateways(prev => prev.map(g => g.id === editingGateway.id ? updated : g));
        showToast('success', `"${updated.name}" updated successfully`);
      } else {
        const created = await feeAPI.createGatewayConfig(data);
        setGateways(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingGateway) return;
    setIsDeleting(true);
    try {
      await feeAPI.deleteGatewayConfig(deletingGateway.id);
      setGateways(prev => prev.filter(g => g.id !== deletingGateway.id));
      showToast('success', `"${deletingGateway.name}" deleted`);
      setDeletingGateway(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingGateway(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = gateways.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.provider.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showHelper && <HelperModal onClose={() => setShowHelper(false)} />}

      <ConfirmModal
        open={!!deletingGateway} gateway={deletingGateway} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingGateway(null)}
      />

      {showModal && (
        <GatewayModal
          editing={editingGateway} isSaving={isSaving}
          onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-purple-200">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            Payment Gateways
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Online payment provider configurations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelper(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            <HelpCircle className="h-4 w-4 text-sky-500" /> Helper
          </button>
          {canManage && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all shadow-md shadow-purple-200">
              <Plus className="h-4 w-4" /> Add Gateway
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Gateways', value: gateways.length, color: 'from-purple-500 to-indigo-600' },
          { label: 'Active',         value: gateways.filter(g => g.is_active).length, color: 'from-emerald-500 to-teal-600' },
          { label: 'Test Mode',      value: (gateways as any).filter((g: any) => g.is_test_mode).length, color: 'from-amber-500 to-orange-600' },
          { label: 'Providers',      value: new Set(gateways.map(g => g.provider)).size, color: 'from-blue-500 to-indigo-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Smartphone className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Grid List ── */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search gateways..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 shadow-sm" />
          </div>
          <button onClick={fetchData} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border p-20 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500 mx-auto" />
            <p className="mt-4 text-slate-400 text-sm">Loading gateways...</p>
          </div>
        ) : pageError ? (
          <div className="bg-white rounded-2xl border border-red-100 p-16 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 mb-4">{pageError}</p>
            <button onClick={fetchData} className="px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-20 text-center">
            <Smartphone className="h-14 w-14 text-slate-200 mx-auto mb-4" />
            <h3 className="font-bold text-slate-700">{search ? 'No match found' : 'No gateways yet'}</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
              {search ? 'Try searching for a different name or provider.' : 'Configure your first payment gateway to start accepting online payments.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(g => (
              <div key={g.id} className={`group bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md hover:border-purple-200 transition-all ${!g.is_active && 'opacity-70'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 capitalize">{g.provider}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(g)} className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Gateway">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeletingGateway(g)} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Gateway">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Purpose</span>
                    <span className="text-[10px] font-bold text-slate-700 capitalize px-2 py-0.5 bg-slate-100 rounded-lg">
                      {g.purpose === 'both' ? 'Wallet and Fee' : g.purpose?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Public Key</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                      {g.public_key ? `${g.public_key.substring(0, 12)}...` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${g.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                      {g.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {(g as any).is_test_mode && (
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Test Mode
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}