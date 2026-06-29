'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { inventorySettingAPI } from '@/lib/api';
import { InventorySetting, InventorySettingPayload, SaleRedirectTarget } from '@/lib/types';
import {
  Settings, Edit3, ShoppingCart, Check, X, AlertCircle, Sparkles,
  Percent, Wallet, ShieldOff, Gauge, MonitorSmartphone, Loader2,
  Banknote, CreditCard, Users, UserCog, Clock, RefreshCw, Printer,
  ArrowRightCircle,
} from 'lucide-react';

// ─── Default form values ───────────────────────────────────────────────────────
const DEFAULT_FORM: InventorySettingPayload = {
  allow_discount: false,
  allow_student_debt: false,
  allow_staff_debt: false,
  max_student_debt: '0.00',
  max_staff_debt: '0.00',
  allow_walkin_sale: true,
  allow_cash: true,
  allow_pos: true,
  max_individual_sale_amount: null,
  max_daily_sale_amount: null,
  max_refund_grace_period_hours: null,
  default_sale_redirect: 'new_sale',
  auto_print_receipt: false,
};

function settingsToForm(s: InventorySetting): InventorySettingPayload {
  return {
    allow_discount: s.allow_discount ?? false,
    allow_student_debt: s.allow_student_debt ?? false,
    allow_staff_debt: s.allow_staff_debt ?? false,
    max_student_debt: s.max_student_debt ?? '0.00',
    max_staff_debt: s.max_staff_debt ?? '0.00',
    allow_walkin_sale: s.allow_walkin_sale ?? true,
    allow_cash: s.allow_cash ?? true,
    allow_pos: s.allow_pos ?? true,
    max_individual_sale_amount: s.max_individual_sale_amount ?? null,
    max_daily_sale_amount: s.max_daily_sale_amount ?? null,
    max_refund_grace_period_hours: s.max_refund_grace_period_hours ?? null,
    default_sale_redirect: s.default_sale_redirect ?? 'new_sale',
    auto_print_receipt: s.auto_print_receipt ?? false,
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
  value, activeLabel = 'Enabled', inactiveLabel = 'Disabled', danger = false,
}: {
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

// ─── Input ─────────────────────────────────────────────────────────────────────
const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

function formatNaira(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'No limit';
  const n = Number(value);
  return Number.isNaN(n) ? 'No limit' : `₦${n.toLocaleString()}`;
}

const REDIRECT_LABELS: Record<SaleRedirectTarget, string> = {
  index: 'Sales Index',
  new_sale: 'New Sale',
  detail: 'Sale Detail',
};

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  settings, isSaving, onSave, onClose,
}: {
  settings: InventorySetting;
  isSaving: boolean;
  onSave: (f: InventorySettingPayload) => Promise<void>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'sales' | 'payment' | 'debt' | 'limits' | 'pos'>('sales');
  const [form, setForm] = useState<InventorySettingPayload>(settingsToForm(settings));
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof InventorySettingPayload>(key: K, value: InventorySettingPayload[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Walk-in sales require at least one of cash/pos — mirrors backend validation
  // so the person sees the conflict before submitting, not just after.
  const walkinConflict = form.allow_walkin_sale && !form.allow_cash && !form.allow_pos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (walkinConflict) {
      setSaveError('Walk-in sales require at least one of Cash or POS to be enabled.');
      setActiveTab('payment');
      return;
    }
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
        setSaveError(data?.message || err?.message || 'Failed to save inventory settings.');
      }
    }
  };

  const tabs = [
    { id: 'sales' as const, label: 'Sales & Discount', icon: Percent },
    { id: 'payment' as const, label: 'Payment Methods', icon: CreditCard },
    { id: 'debt' as const, label: 'Debt & Wallet', icon: Wallet },
    { id: 'limits' as const, label: 'Limits & Refunds', icon: Gauge },
    { id: 'pos' as const, label: 'POS Behavior', icon: MonitorSmartphone },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Edit POS Settings
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
        <form id="inventory-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* ── Sales & Discount ── */}
            {activeTab === 'sales' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Control discounting and walk-in (non-enrolled) customer sales.</p>
                <Toggle checked={!!form.allow_discount} onChange={v => set('allow_discount', v)}
                  label="Allow Discount" description="Let staff apply a discount on the POS sale screen" />
                <Toggle checked={!!form.allow_walkin_sale} onChange={v => set('allow_walkin_sale', v)}
                  label="Allow Walk-in Sale" description="Allow sales without a student or staff attached" />
              </div>
            )}

            {/* ── Payment Methods ── */}
            {activeTab === 'payment' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Choose which payment methods staff can select at checkout.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={!!form.allow_cash} onChange={v => set('allow_cash', v)}
                    label="Allow Cash" description="Accept physical cash payments" />
                  <Toggle checked={!!form.allow_pos} onChange={v => set('allow_pos', v)}
                    label="Allow POS / Card" description="Accept card payments via POS terminal" />
                </div>
                {walkinConflict && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    Walk-in sales are enabled but neither Cash nor POS is — walk-in customers have no
                    wallet to pay with. Enable at least one, or turn off walk-in sales.
                  </div>
                )}
              </div>
            )}

            {/* ── Debt & Wallet ── */}
            {activeTab === 'debt' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Allow wallet balances to go negative, within a capped limit.</p>
                <Toggle checked={!!form.allow_student_debt} onChange={v => set('allow_student_debt', v)}
                  label="Allow Student Debt" description="Students can buy beyond their canteen wallet balance" />
                <div>
                  <label className={labelCls}>Max Student Debt (₦)</label>
                  <input type="number" step="0.01" min="0"
                    value={form.max_student_debt ?? ''} disabled={!form.allow_student_debt}
                    onChange={e => set('max_student_debt', e.target.value)}
                    className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`} />
                </div>
                <div className="h-px bg-slate-100" />
                <Toggle checked={!!form.allow_staff_debt} onChange={v => set('allow_staff_debt', v)}
                  label="Allow Staff Debt" description="Staff can buy beyond their wallet balance" />
                <div>
                  <label className={labelCls}>Max Staff Debt (₦)</label>
                  <input type="number" step="0.01" min="0"
                    value={form.max_staff_debt ?? ''} disabled={!form.allow_staff_debt}
                    onChange={e => set('max_staff_debt', e.target.value)}
                    className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`} />
                </div>
              </div>
            )}

            {/* ── Limits & Refunds ── */}
            {activeTab === 'limits' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Leave a field blank for no limit. A single purchase that exceeds a cap on its own is still allowed — these limits are meant to catch repeated small purchases adding up, not block one genuine large purchase.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Max Individual Sale (₦)</label>
                    <input type="number" step="0.01" min="0" placeholder="No limit"
                      value={form.max_individual_sale_amount ?? ''}
                      onChange={e => set('max_individual_sale_amount', e.target.value || null)}
                      className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Per-transaction cap per customer</p>
                  </div>
                  <div>
                    <label className={labelCls}>Max Daily Sale (₦)</label>
                    <input type="number" step="0.01" min="0" placeholder="No limit"
                      value={form.max_daily_sale_amount ?? ''}
                      onChange={e => set('max_daily_sale_amount', e.target.value || null)}
                      className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Cumulative same-day cap per customer</p>
                  </div>
                </div>
                <div className="h-px bg-slate-100" />
                <div>
                  <label className={labelCls}>Refund Grace Period (hours)</label>
                  <input type="number" step="1" min="0" placeholder="No limit"
                    value={form.max_refund_grace_period_hours ?? ''}
                    onChange={e => set('max_refund_grace_period_hours', e.target.value ? Number(e.target.value) : null)}
                    className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">
                    How long after a sale it can still be refunded. For days, multiply by 24 (e.g. 48 = 2 days).
                  </p>
                </div>
              </div>
            )}

            {/* ── POS Behavior ── */}
            {activeTab === 'pos' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Control where staff land after completing a sale, and receipt printing.</p>
                <div>
                  <label className={labelCls}>After Sale, Redirect To</label>
                  <select value={form.default_sale_redirect} onChange={e => set('default_sale_redirect', e.target.value as SaleRedirectTarget)} className={inputCls}>
                    <option value="new_sale">New Sale (start another order)</option>
                    <option value="index">Sales Index</option>
                    <option value="detail">Sale Detail (receipt view)</option>
                  </select>
                </div>
                <Toggle checked={!!form.auto_print_receipt} onChange={v => set('auto_print_receipt', v)}
                  label="Auto Print Receipt" description="Automatically print a receipt as soon as a sale completes" />
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
          <button type="submit" form="inventory-settings-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function InventorySettingsPage() {
  const { hasPermission, user } = useAuth();
  const [settings, setSettings] = useState<InventorySetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('inventory.add_inventorysettingmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await inventorySettingAPI.get();
      setSettings(data);
    } catch {
      setPageError('fetch_error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (form: InventorySettingPayload) => {
    setIsSaving(true);
    try {
      const updated = await inventorySettingAPI.update(form);
      setSettings(updated);
      setIsEditing(false);
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
        <p className="text-slate-400 text-sm">Loading POS settings...</p>
      </div>
    </div>
  );

  // ── Fetch error ──
  if (pageError === 'fetch_error' || !settings) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">Couldn't load POS settings. Please try again.</p>
        <button onClick={fetchSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  const s = settings;

  return (
    <div className="space-y-6 pb-10">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">POS settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && <SettingsModal settings={s} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            POS Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Point of sale rules, payment methods, and debt controls</p>
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
          { label: 'Discount', value: s.allow_discount ? 'Enabled' : 'Disabled', icon: Percent, color: 'from-blue-500 to-blue-600' },
          { label: 'Walk-in Sale', value: s.allow_walkin_sale ? 'Allowed' : 'Blocked', icon: Users, color: 'from-violet-500 to-purple-600' },
          { label: 'Daily Sale Cap', value: formatNaira(s.max_daily_sale_amount), icon: Gauge, color: 'from-teal-500 to-cyan-600' },
          { label: 'Refund Window', value: s.max_refund_grace_period_hours != null ? `${s.max_refund_grace_period_hours}h` : 'No limit', icon: Clock, color: 'from-orange-400 to-amber-500' },
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

      {/* ── Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Sales, Discount & Payment */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <CreditCard className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Sales & Payment</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Percent} iconBg="bg-blue-50 text-blue-600" label="Allow Discount"
              description="Staff can apply a discount on sales" value={<StatusBadge value={s.allow_discount} />} />
            <SettingRow icon={Users} iconBg="bg-indigo-50 text-indigo-600" label="Allow Walk-in Sale"
              description="Sales without a registered customer" value={<StatusBadge value={s.allow_walkin_sale} />} />
            <SettingRow icon={Banknote} iconBg="bg-emerald-50 text-emerald-600" label="Allow Cash"
              description="Cash payments at checkout" value={<StatusBadge value={s.allow_cash} />} />
            <SettingRow icon={CreditCard} iconBg="bg-sky-50 text-sky-600" label="Allow POS / Card"
              description="Card payments via POS terminal" value={<StatusBadge value={s.allow_pos} />} />
          </div>
        </div>

        {/* Debt & Wallet */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
              <Wallet className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Debt & Wallet</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={UserCog} iconBg="bg-violet-50 text-violet-600" label="Allow Student Debt"
              description="Buy beyond canteen wallet balance" value={<StatusBadge value={s.allow_student_debt} />} />
            <SettingRow icon={Wallet} iconBg="bg-purple-50 text-purple-600" label="Max Student Debt"
              description="Negative balance ceiling for students"
              value={<span className="text-xs font-bold text-slate-700">{formatNaira(s.max_student_debt)}</span>} />
            <SettingRow icon={UserCog} iconBg="bg-rose-50 text-rose-600" label="Allow Staff Debt"
              description="Buy beyond staff wallet balance" value={<StatusBadge value={s.allow_staff_debt} />} />
            <SettingRow icon={Wallet} iconBg="bg-pink-50 text-pink-600" label="Max Staff Debt"
              description="Negative balance ceiling for staff"
              value={<span className="text-xs font-bold text-slate-700">{formatNaira(s.max_staff_debt)}</span>} />
          </div>
        </div>

        {/* Limits, Refunds & POS UX */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <Gauge className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Limits & Behavior</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Gauge} iconBg="bg-orange-50 text-orange-600" label="Max Individual Sale"
              description="Per-transaction cap per customer"
              value={<span className="text-xs font-bold text-slate-700">{formatNaira(s.max_individual_sale_amount)}</span>} />
            <SettingRow icon={Gauge} iconBg="bg-amber-50 text-amber-600" label="Max Daily Sale"
              description="Cumulative same-day cap per customer"
              value={<span className="text-xs font-bold text-slate-700">{formatNaira(s.max_daily_sale_amount)}</span>} />
            <SettingRow icon={Clock} iconBg="bg-yellow-50 text-yellow-700" label="Refund Grace Period"
              description="Hours after sale a refund is allowed"
              value={<span className="text-xs font-bold text-slate-700">{s.max_refund_grace_period_hours != null ? `${s.max_refund_grace_period_hours}h` : 'No limit'}</span>} />
            <SettingRow icon={Printer} iconBg="bg-lime-50 text-lime-700" label="Auto Print Receipt"
              description="Print automatically after each sale" value={<StatusBadge value={s.auto_print_receipt} />} />
          </div>

          {/* Redirect preview card */}
          <div className="mx-4 mb-4 mt-2 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide flex items-center gap-1.5">
              <ArrowRightCircle className="h-3 w-3" /> After Sale
            </p>
            <p className="text-lg font-bold text-blue-800">{REDIRECT_LABELS[s.default_sale_redirect]}</p>
            <p className="text-xs text-blue-500 mt-1">Where staff land once a sale completes</p>
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
                { label: 'Allow Discount', value: <StatusBadge value={s.allow_discount} />, desc: 'Staff can apply a discount at checkout' },
                { label: 'Allow Walk-in Sale', value: <StatusBadge value={s.allow_walkin_sale} />, desc: 'Sales without a registered student or staff' },
                { label: 'Allow Cash', value: <StatusBadge value={s.allow_cash} />, desc: 'Cash payments accepted at checkout' },
                { label: 'Allow POS / Card', value: <StatusBadge value={s.allow_pos} />, desc: 'Card payments via POS terminal accepted' },
                { label: 'Allow Student Debt', value: <StatusBadge value={s.allow_student_debt} />, desc: 'Students may purchase beyond their canteen wallet balance' },
                { label: 'Max Student Debt', value: <span className="text-sm text-slate-700">{formatNaira(s.max_student_debt)}</span>, desc: 'Maximum negative balance allowed for students' },
                { label: 'Allow Staff Debt', value: <StatusBadge value={s.allow_staff_debt} />, desc: 'Staff may purchase beyond their wallet balance' },
                { label: 'Max Staff Debt', value: <span className="text-sm text-slate-700">{formatNaira(s.max_staff_debt)}</span>, desc: 'Maximum negative balance allowed for staff' },
                { label: 'Max Individual Sale', value: <span className="text-sm text-slate-700">{formatNaira(s.max_individual_sale_amount)}</span>, desc: 'Per-transaction spending cap per customer' },
                { label: 'Max Daily Sale', value: <span className="text-sm text-slate-700">{formatNaira(s.max_daily_sale_amount)}</span>, desc: 'Cumulative same-day spending cap per customer' },
                { label: 'Refund Grace Period', value: <span className="text-sm text-slate-700">{s.max_refund_grace_period_hours != null ? `${s.max_refund_grace_period_hours} hours` : 'No limit'}</span>, desc: 'Time window after a sale within which it can be refunded' },
                { label: 'Default Redirect', value: <span className="text-sm text-slate-700">{REDIRECT_LABELS[s.default_sale_redirect]}</span>, desc: 'Page staff are taken to after completing a sale' },
                { label: 'Auto Print Receipt', value: <StatusBadge value={s.auto_print_receipt} />, desc: 'Receipt prints automatically once a sale completes' },
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