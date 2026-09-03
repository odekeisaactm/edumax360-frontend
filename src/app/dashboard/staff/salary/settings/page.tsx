'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { salarySettingsAPI } from '@/lib/salary_management.service';
import { SalarySetting } from '@/lib/salary_management.types';
import {
  Settings,
  Plus,
  Eye,
  Edit3,
  Lock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Calendar,
  Clock,
  X,
  PauseCircle,
  DollarSign,
  ShieldCheck,
  Percent,
  Gift,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Stat strip ───────────────────────────────────────────────────────────────
function StatChip({ icon, label, value, gradient }: { icon: React.ReactNode; label: string; value: string | number; gradient: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${gradient}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ─── Setting Card ─────────────────────────────────────────────────────────────
function SettingCard({ setting, canEdit }: { setting: SalarySetting; canEdit: boolean }) {
  const componentCount = Object.keys(setting.basic_components || {}).length;
  const allowanceCount = (setting.allowances || []).length;
  const bracketCount = (setting.tax_brackets || []).length;
  const statutoryCount = (setting.statutory_deductions || []).length;

  const statusConfig = setting.is_locked
    ? { label: 'Locked', icon: <Lock className="h-3 w-3" />, pill: 'bg-slate-100 text-slate-600 border-slate-200', border: 'border-slate-200', header: 'bg-slate-50 border-b border-slate-100' }
    : setting.is_active
    ? { label: 'Active', icon: <CheckCircle className="h-3 w-3" />, pill: 'bg-green-100 text-green-700 border-green-200', border: 'border-green-200', header: 'bg-green-50 border-b border-green-100' }
    : { label: 'Inactive', icon: <PauseCircle className="h-3 w-3" />, pill: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-amber-100', header: 'bg-slate-50 border-b border-slate-100' };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col ${statusConfig.border}`}>
      {/* Card header */}
      <div className={`px-4 py-3 flex items-start justify-between gap-2 ${statusConfig.header}`}>
        <div className="min-w-0">
          <h5 className="font-bold text-slate-800 truncate text-sm">{setting.name}</h5>
          {setting.description && (
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{setting.description}</p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full border flex-shrink-0 ${statusConfig.pill}`}>
          {statusConfig.icon} {statusConfig.label}
        </span>
      </div>

      {/* Dates */}
      <div className="px-4 pt-3 pb-2 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Effective: <span className="text-slate-600 font-medium">{new Date(setting.effective_from).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {setting.effective_to && <> → {new Date(setting.effective_to).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Created {new Date(setting.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Config summary chips */}
      <div className="px-4 py-3 flex flex-wrap gap-1.5">
        <ConfigChip icon={<DollarSign className="h-3 w-3" />} label={`${componentCount} component${componentCount !== 1 ? 's' : ''}`} color="blue" />
        <ConfigChip icon={<Gift className="h-3 w-3" />} label={`${allowanceCount} allowance${allowanceCount !== 1 ? 's' : ''}`} color="cyan" />
        <ConfigChip icon={<Percent className="h-3 w-3" />} label={`${bracketCount} tax bracket${bracketCount !== 1 ? 's' : ''}`} color="red" />
        <ConfigChip icon={<ShieldCheck className="h-3 w-3" />} label={`${statutoryCount} statutory`} color="slate" />
      </div>

      {/* Footer actions */}
      <div className="mt-auto px-4 py-3 border-t border-slate-50 bg-slate-50/50 flex justify-end gap-2">
        <Link
          href={`/dashboard/staff/salary/settings/${setting.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" /> View
        </Link>
        {canEdit && !setting.is_locked && (
          <Link
            href={`/dashboard/staff/salary/settings/${setting.id}/edit`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </Link>
        )}
        {setting.is_locked && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed">
            <Lock className="h-3.5 w-3.5" /> Locked
          </span>
        )}
      </div>
    </div>
  );
}

function ConfigChip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    slate: 'bg-slate-100 text-slate-500 border-slate-200',
    green: 'bg-green-50 text-green-600 border-green-100',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[color] || colors.slate}`}>
      {icon} {label}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="py-20 text-center">
      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
        <Settings className="h-8 w-8 text-blue-400" />
      </div>
      <h3 className="font-bold text-slate-700 text-base mb-2">No salary settings yet</h3>
      <p className="text-sm text-slate-400 max-w-xs mx-auto mb-6">
        Create your first salary setting to configure tax rules, allowances, and payroll components.
      </p>
      {canCreate && (
        <Link
          href="/dashboard/staff/salary/settings/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
        >
          <Plus className="h-4 w-4" /> Create First Setting
        </Link>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SalarySettingsListPage() {
  const { hasPermission, user } = useAuth();
  const [settings, setSettings] = useState<SalarySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('salary_management.change_salarysettingmodel');
  const canEdit = user?.is_superuser || hasPermission('salary_management.change_salarysettingmodel');
  const canView = user?.is_superuser || hasPermission('salary_management.view_salarysettingmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await salarySettingsAPI.list();
      setSettings(Array.isArray(data) ? data : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) fetchSettings();
  }, [canView, fetchSettings]);

  // ── Stats ──
  const total = settings.length;
  const activeCount = settings.filter((s) => s.is_active).length;
  const inactiveCount = settings.filter((s) => !s.is_active).length;
  const lockedCount = settings.filter((s) => s.is_locked).length;

  if (!canView) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to view salary settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Settings className="h-5 w-5 text-white" />
            </div>
            Salary Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Configure payroll tax rules, allowances, and deductions</p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/staff/salary/settings/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" /> New Setting
          </Link>
        )}
      </div>

      {/* ── Stat strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip icon={<Settings className="h-4 w-4 text-white" />} label="Total" value={loading ? '—' : total} gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
        <StatChip icon={<CheckCircle className="h-4 w-4 text-white" />} label="Active" value={loading ? '—' : activeCount} gradient="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <StatChip icon={<PauseCircle className="h-4 w-4 text-white" />} label="Inactive" value={loading ? '—' : inactiveCount} gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
        <StatChip icon={<Lock className="h-4 w-4 text-white" />} label="Locked" value={loading ? '—' : lockedCount} gradient="bg-gradient-to-br from-slate-500 to-slate-700" />
      </div>

      {/* ── Main card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">
            {loading ? 'Loading...' : `${total} setting${total !== 1 ? 's' : ''}`}
          </p>
          <button
            onClick={fetchSettings}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
            <p className="mt-3 text-sm text-slate-400">Loading salary settings…</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 mb-4 font-medium">{pageError}</p>
            <button onClick={fetchSettings} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : settings.length === 0 ? (
          <EmptyState canCreate={canCreate} />
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.map((s) => (
              <SettingCard key={s.id} setting={s} canEdit={canEdit} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}