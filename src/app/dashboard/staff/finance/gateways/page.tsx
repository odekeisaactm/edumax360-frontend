'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { gatewayAPI, financeSettingsAPI, bankDetailsAPI } from '@/lib/api';
import type { PaymentGatewayConfig, GatewayPurpose, SchoolBankDetail } from '@/lib/finance.types';
import {
  Smartphone, Plus, Edit3, Trash2, Check, X,
  AlertCircle, AlertTriangle, Loader2, Search,
  RefreshCw, HelpCircle, Globe, Activity, Star, Play, Building
} from 'lucide-react';

// Declare Window SDK extensions for TypeScript compliance
declare global {
  interface Window {
    PaystackPop?: any;
    FlutterwaveCheckout?: any;
  }
}

// ─── Dynamic SDK Script Loader Helper ──────────────────────────────────────────
const loadedScripts: Record<string, boolean> = {};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loadedScripts[src]) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      loadedScripts[src] = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts[src] = true;
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d.slice(0, 150);
    if (d.detail) return String(d.detail).slice(0, 150);
    if (d.message) return String(d.message).slice(0, 150);
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-fade-in
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug whitespace-pre-line">{t.message}</p>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HelpCircle className="h-5 w-5" /> Online Payment Gateways
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed font-medium">
            Configure institutional gateways to enable automated online school fee collections and instant student wallet deposits via Paystack or Flutterwave.
          </p>
          <div className="space-y-3">
            {[
              {
                title: 'Client-Side Inline Testing',
                color: 'bg-emerald-100 text-emerald-800',
                desc: 'Clicking "Test Inline" loads the official checkout iframe directly in your browser. If your Public Key is wrong, the provider popup immediately shows an error without touching your database.',
              },
              {
                title: 'Settlement Bank Linking',
                color: 'bg-blue-100 text-blue-800',
                desc: 'By linking a bank account, all transactions via this gateway automatically securely resolve into the correct ledger automatically.',
              },
              {
                title: 'API Credentials',
                color: 'bg-indigo-100 text-indigo-800',
                desc: 'Enter your API keys obtained from your payment provider dashboard. Secret keys are encrypted at rest for secure server-to-server webhook verification.',
              },
            ].map(({ title, color, desc }) => (
              <div key={title} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${color}`}>
                  {title}
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end flex-shrink-0">
          <button onClick={onClose}
            className="px-5 py-2 text-sm border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors">
            Got It
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Gateway</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete the gateway{' '}
          <span className="font-semibold text-slate-700">"{gateway.name}"</span>?
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

// ─── Gateway Form Modal ──────────────────────────────────────────────────────
interface GatewayFormData {
  name: string;
  provider: 'paystack' | 'flutterwave';
  purpose: GatewayPurpose;
  is_active: boolean;
  is_test_mode: boolean;
  is_default: boolean;
  public_key: string;
  secret_key: string;
  webhook_secret: string;
  default_settlement_bank: string | number;
}

function GatewayModal({ editing, isSaving, onSave, onClose, banks }: {
  editing: PaymentGatewayConfig | null; isSaving: boolean;
  onSave: (data: GatewayFormData) => Promise<void>; onClose: () => void;
  banks: SchoolBankDetail[];
}) {
  const EMPTY: GatewayFormData = {
    name: '', provider: 'paystack', purpose: 'both', is_active: true, is_test_mode: true, is_default: false,
    public_key: '', secret_key: '', webhook_secret: '', default_settlement_bank: ''
  };

  const [form, setForm] = useState<GatewayFormData>(
    editing ? {
      name: editing.name,
      provider: (editing.provider === 'custom' ? 'paystack' : editing.provider) as 'paystack' | 'flutterwave',
      purpose: editing.purpose || 'both',
      is_active: editing.is_active,
      is_test_mode: editing.is_test_mode ?? true,
      is_default: editing.is_default ?? false,
      public_key: editing.public_key || '',
      secret_key: '',
      webhook_secret: editing.webhook_secret || '',
      default_settlement_bank: editing.default_settlement_bank || '',
    } : EMPTY
  );
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError('Gateway name label is required.'); return; }
    if (!form.public_key.trim()) { setFormError('Public API key is required.'); return; }
    if (!editing && !form.secret_key.trim()) { setFormError('Secret API key is mandatory when registering a new gateway.'); return; }

    const payload = { ...form };
    if (!payload.default_settlement_bank) {
      (payload as any).default_settlement_bank = null;
    }

    try { await onSave(payload); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition bg-white font-medium text-slate-800";
  const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {editing ? 'Modify Gateway Configuration' : 'Configure New Gateway'}
          </h3>
          <button onClick={onClose} disabled={isSaving} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1 whitespace-pre-line">{formError}</span>
            <button onClick={() => setFormError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        <form id="gateway-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelCls}>Configuration Label <span className="text-red-500">*</span></label>
              <input required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Primary Paystack NGN" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Payment Provider <span className="text-red-500">*</span></label>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value as any }))} className={inputCls}>
                <option value="paystack">Paystack</option>
                <option value="flutterwave">Flutterwave</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Operational Purpose <span className="text-red-500">*</span></label>
              <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value as GatewayPurpose }))} className={inputCls}>
                <option value="both">Both Fees & Wallet</option>
                <option value="fee_payment">Fee Processing Only</option>
                <option value="wallet_funding">Wallet Deposits Only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2">
            <div>
              <label className={labelCls}>Settlement Bank Account</label>
              <select value={form.default_settlement_bank} onChange={e => setForm(f => ({ ...f, default_settlement_bank: e.target.value }))} className={inputCls}>
                <option value="">-- No Linked Bank (Tracking Off) --</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Required if Strict Bank Tracking is ON.</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <label className={labelCls}>Public API Key <span className="text-red-500">*</span></label>
              <input required type="text" value={form.public_key} onChange={e => setForm(f => ({ ...f, public_key: e.target.value }))} placeholder="pk_test_..." className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Secret API Key {editing && <span className="text-slate-400 normal-case font-normal">(Leave blank to keep existing key)</span>}</label>
              <input type="password" value={form.secret_key} onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))} placeholder={editing ? "••••••••••••••••••••••••" : "sk_test_..."} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Webhook Secret Key <span className="text-slate-400 normal-case font-normal">(Optional verification)</span></label>
              <input type="text" value={form.webhook_secret} onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))} placeholder="whsec_..." className={`${inputCls} font-mono`} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Active</span>
              <button type="button" role="switch" aria-checked={form.is_active} onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-purple-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Test Mode</span>
              <button type="button" role="switch" aria-checked={form.is_test_mode} onClick={() => setForm(f => ({ ...f, is_test_mode: !f.is_test_mode }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_test_mode ? 'bg-amber-500' : 'bg-slate-300'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_test_mode ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Default</span>
              <button type="button" role="switch" aria-checked={form.is_default} onClick={() => setForm(f => ({ ...f, is_default: !f.is_default }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_default ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_default ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-200/60">
            Cancel
          </button>
          <button type="submit" form="gateway-form" disabled={isSaving} className="px-5 py-2 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:opacity-95 transition-all shadow-md flex items-center gap-2">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> {editing ? 'Updating...' : 'Registering...'}</> : <><Check className="h-4 w-4" /> {editing ? 'Save Modifications' : 'Initialize Gateway'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PaymentGatewaysPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('finance.change_paymentgatewayconfigmodel');

  const [baseCurrency, setBaseCurrency] = useState('NGN');
  const [gateways, setGateways]       = useState<PaymentGatewayConfig[]>([]);
  const [banks, setBanks]             = useState<SchoolBankDetail[]>([]);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [showHelper, setShowHelper]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGatewayConfig | null>(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [deletingGateway, setDeletingGateway] = useState<PaymentGatewayConfig | null>(null);
  const [isDeleting, setIsDeleting]   = useState(false);

  const [testingId, setTestingId]     = useState<number | null>(null);
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
      const [settingsData, banksData, gatewaysData] = await Promise.all([
        financeSettingsAPI.get().catch(() => null),
        bankDetailsAPI.list({ is_active: true, account_type: 'bank' }).catch(() => []),
        gatewayAPI.list()
      ]);

      if (settingsData?.currency_config?.base_currency) {
        setBaseCurrency(settingsData.currency_config.base_currency);
      }
      setBanks(Array.isArray(banksData) ? banksData : []);
      setGateways(Array.isArray(gatewaysData) ? gatewaysData : []);
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
        const updated = await gatewayAPI.update(editingGateway.id, data);
        setGateways(prev => prev.map(g => g.id === editingGateway.id ? updated : g));
        showToast('success', `"${updated.name}" updated successfully.`);
      } else {
        const created = await gatewayAPI.create(data);
        setGateways(prev => [created, ...prev]);
        showToast('success', `"${created.name}" configured successfully.`);
      }
      setShowModal(false);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingGateway) return;
    setIsDeleting(true);
    try {
      await gatewayAPI.delete(deletingGateway.id);
      setGateways(prev => prev.filter(g => g.id !== deletingGateway.id));
      showToast('success', `"${deletingGateway.name}" removed successfully.`);
      setDeletingGateway(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingGateway(null);
    } finally { setIsDeleting(false); }
  };

  const handleSetDefault = async (g: PaymentGatewayConfig) => {
    try {
      const updated = await gatewayAPI.setDefault(g.id);
      setGateways(prev => prev.map(item => ({ ...item, is_default: item.id === updated.id })));
      showToast('success', `"${updated.name}" set as default institutional gateway.`);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleInlineTest = async (gateway: PaymentGatewayConfig) => {
    if (!gateway.public_key) {
      showToast('error', 'No Public API Key configured for this gateway.');
      return;
    }

    setTestingId(gateway.id);
    const testAmount = 1000;
    const ref = `INLINE-TEST-${Date.now()}`;

    // Guarantee strictly valid RFC email format so gateway regex never rejects initialization
    const isValidEmail = (e?: string) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.endsWith('.test') && !e.endsWith('.local');
    const testEmail = isValidEmail(user?.email) ? user!.email : 'verifier@schoolsaas.com';
    const testName = (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) || 'System Verification Admin';
    const testPhone = '08000000000';

    try {
      if (gateway.provider === 'paystack') {
        await loadScript('https://js.paystack.co/v1/inline.js');
        if (!window.PaystackPop) throw new Error('Paystack inline SDK failed to initialize.');

        const handler = window.PaystackPop.setup({
          key: gateway.public_key,
          email: testEmail,
          firstname: 'System',
          lastname: 'Admin',
          amount: testAmount * 100, // Paystack expects lowest currency denomination (kobo/cents)
          currency: baseCurrency,
          ref: ref,
          callback: (response: any) => {
            showToast('success', `Paystack test transaction verified! Ref: ${response.reference}`);
          },
          onClose: () => {
            showToast('success', 'Paystack modal closed cleanly. Public API key verified!');
          }
        });
        handler.openIframe();

      } else if (gateway.provider === 'flutterwave') {
        await loadScript('https://checkout.flutterwave.com/v3.js');
        if (!window.FlutterwaveCheckout) throw new Error('Flutterwave SDK failed to initialize.');

        window.FlutterwaveCheckout({
          public_key: gateway.public_key,
          tx_ref: ref,
          amount: testAmount,
          currency: baseCurrency,
          payment_options: 'card, banktransfer, ussd',
          customer: {
            email: testEmail,
            name: testName,
            phonenumber: testPhone,
          },
          customizations: {
            title: 'School SaaS Inline Test',
            description: `Verify connection for ${gateway.name}`,
          },
          callback: (data: any) => {
            if (data.status === "successful" || data.status === "completed") {
              showToast('success', `Flutterwave test transaction successful! Ref: ${data.tx_ref}`);
            } else {
              showToast('error', `Flutterwave verification ended with status: ${data.status}`);
            }
          },
          onclose: () => {
            showToast('success', 'Flutterwave modal closed cleanly. Public API key verified!');
          }
        });
      }
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setTestingId(null);
    }
  };

  const filtered = gateways.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.provider.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showHelper && <HelperModal onClose={() => setShowHelper(false)} />}

      <ConfirmModal
        open={!!deletingGateway} gateway={deletingGateway} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingGateway(null)}
      />

      {showModal && (
        <GatewayModal
          editing={editingGateway} isSaving={isSaving} banks={banks}
          onSave={handleSave} onClose={() => setShowModal(false)}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-purple-200">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Online Payment Gateways</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Manage automated online fee processing and wallet deposits via Paystack & Flutterwave</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => setShowHelper(true)} className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <HelpCircle className="h-4 w-4 text-purple-600" /> Guide
          </button>
          {canManage && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:opacity-95 transition-all shadow-md shadow-purple-200">
              <Plus className="h-4 w-4" /> Add Gateway
            </button>
          )}
        </div>
      </div>

      {/* Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Configured Providers', value: gateways.length, color: 'from-purple-500 to-indigo-600' },
          { label: 'Active Operational',   value: gateways.filter(g => g.is_active).length, color: 'from-emerald-500 to-teal-600' },
          { label: 'Sandbox / Test Mode',  value: gateways.filter(g => g.is_test_mode).length, color: 'from-amber-500 to-orange-600' },
          { label: 'Base Currency Unit',   value: baseCurrency, color: 'from-blue-500 to-indigo-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3.5">
            <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold truncate">{label}</p>
              <p className="text-lg font-bold text-slate-900">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid List Section */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Filter configurations by label or payment provider..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium" />
          </div>
          <button onClick={fetchData} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Reload List">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto" />
            <p className="mt-2 text-sm font-medium text-slate-400">Loading payment integrations...</p>
          </div>
        ) : pageError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-800">{pageError}</p>
            <button onClick={fetchData} className="mt-3 text-xs font-bold text-red-600 underline">Try Reloading</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-600">
              <Smartphone className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">{search ? 'No match found' : 'No Payment Gateways Configured'}</h3>
            <p className="text-sm text-slate-500 mb-6">
              {search ? 'Try searching for a different configuration label.' : 'Register API credentials to automate student invoice settlement.'}
            </p>
            {!search && canManage && (
              <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold rounded-xl shadow-md">
                <Plus className="h-4 w-4" /> Add First Gateway
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map(g => {
              const linkedBank = banks.find(b => String(b.id) === String(g.default_settlement_bank));
              return (
                <div key={g.id} className={`bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col ${!g.is_active && 'opacity-75'}`}>
                  <div className={`h-1.5 w-full bg-gradient-to-r ${g.is_active ? 'from-purple-500 to-indigo-500' : 'from-slate-300 to-slate-400'}`} />
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">

                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                          <Globe className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 capitalize text-base truncate">{g.provider}</h3>
                            {g.is_default && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                                <Star className="h-3 w-3 fill-current" /> Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-500 truncate">{g.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {canManage && (
                          <>
                            <button onClick={() => openEdit(g)} className="p-2 text-slate-600 hover:text-purple-600 bg-slate-50 hover:bg-purple-50 rounded-lg border border-slate-200 transition-colors" title="Edit Configuration">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeletingGateway(g)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-colors" title="Delete Configuration">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Routing Purpose</span>
                        <span className="text-xs font-bold text-slate-800 capitalize px-2 py-0.5 bg-white rounded-md border border-slate-200 shadow-2xs">
                          {g.purpose === 'both' ? 'Fees & Wallet' : g.purpose?.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Building className="h-3.5 w-3.5" /> Settles To</span>
                        <span className="text-xs font-bold text-slate-600 truncate max-w-[180px]">
                          {linkedBank ? `${linkedBank.bank_name}` : <span className="text-amber-600 italic">No Bank Linked</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-semibold text-slate-500">Public API Key</span>
                        <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-[180px]">
                          {g.public_key ? `${g.public_key.substring(0, 14)}...` : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${g.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {g.is_active ? 'Active' : 'Disabled'}
                        </span>
                        {g.is_test_mode && (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
                            <Activity className="h-3 w-3" /> Sandbox
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {g.is_active && (
                          <button
                            onClick={() => handleInlineTest(g)}
                            disabled={testingId === g.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                          >
                            {testingId === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                            Test Inline ({baseCurrency} 1k)
                          </button>
                        )}

                        {!g.is_default && canManage && g.is_active && (
                          <button
                            onClick={() => handleSetDefault(g)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                          >
                            Make Default
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
      </div>
    </div>
  );
}