'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { salarySettingsAPI } from '@/lib/salary_management.service';
import { SalarySetting } from '@/lib/salary_management.types';
import {
  Settings, ArrowLeft, Edit3, AlertCircle, Loader2, CheckCircle,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Lock, Pause,
  Users, UserCircle2, Wrench, Download, Copy, Check, Gift, Shield,
  Percent, Landmark, MinusCircle, PlusCircle, PlusSquare, Wallet,
  X,
} from 'lucide-react';

// ─── Helpers (kept consistent with SalarySettingForm.tsx) ─────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.details && typeof d.details === 'object') {
      const msgs = Object.entries(d.details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? (v as any[])[0] : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toNum(value: any, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return d;
  }
}

function getCreatedByName(createdBy: SalarySetting['created_by']): string {
  if (!createdBy) return 'System';
  if (typeof createdBy === 'number') return `User #${createdBy}`;
  const u = createdBy as any;
  // FIX: User shape may vary; fall back gracefully across common name fields.
  return (u as any).full_name || (u as any).get_full_name || (u as any).username || (u as any).email || `User #${(u as any).id ?? ''}`;
}

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

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

// ─── Accordion section ─────────────────────────────────────────────────────────
function Section({ icon, iconBg, title, open, onToggle, children }: {
  icon: React.ReactNode; iconBg: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-3">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-4 px-6 py-4 transition-colors text-left hover:bg-slate-50/60">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
        <span className="text-sm font-bold text-slate-800 flex-1">{title}</span>
        <div className="flex-shrink-0 text-slate-400">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
      </button>
      {open && <div className="px-6 pb-6 border-t border-slate-50"><div className="pt-5">{children}</div></div>}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}

function DollarSignIcon() {
  return (
    <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

// ─── Based-on resolver ──────────────────────────────────────────────────────────
function resolveBasedOnLabel(basedOn: string | undefined, basedOnType: string | undefined, basicComponents: SalarySetting['basic_components']): string {
  if (!basedOn) return 'Total Salary';
  const upper = basedOn.toUpperCase();
  if (basedOnType === 'additional_field') return basedOn;
  if (upper === 'TOTAL') return 'Total Salary';
  if (upper === 'GROSS_INCOME') return 'Gross Income';
  const comp = Object.values(basicComponents || {}).find((c) => c.code?.toUpperCase() === upper);
  return comp ? `${comp.name} (${comp.code})` : basedOn;
}

// ─── Calculation description ───────────────────────────────────────────────────
function calcDescription(item: { calculation_type?: string; percentage?: number; fixed_amount?: number; based_on?: string; based_on_type?: string }, basicComponents: SalarySetting['basic_components']): string {
  const type = item.calculation_type || 'percentage';
  const based = resolveBasedOnLabel(item.based_on, item.based_on_type, basicComponents);
  const pct = toNum(item.percentage, 0);
  const fixed = toNum(item.fixed_amount, 0);
  if (type === 'fixed') return `Fixed: ${fmtMoney(fixed)}`;
  if (type === 'percentage') return `${pct.toFixed(2)}% of ${based}`;
  return `${fmtMoney(fixed)} + ${pct.toFixed(2)}% of ${based}`;
}

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function SalarySettingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, hasPermission } = useAuth();

  const [data, setData] = useState<SalarySetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [previewSalary, setPreviewSalary] = useState(500000);
  const [copied, setCopied] = useState(false);

  const [open, setOpen] = useState<Record<string, boolean>>({
    basic: true, allowances: false, reliefs: false, brackets: false,
    statutory: false, otherDeductions: false, incomeItems: false, additionalFields: false,
  });
  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const showToast = (type: 'success' | 'error', message: string) => {
    const tid = ++_toastId;
    setToasts((p) => [...p, { id: tid, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== tid)), 4500);
  };
  const dismissToast = (tid: number) => setToasts((p) => p.filter((t) => t.id !== tid));

  // ── Fetch ──
  useEffect(() => {
    if (!id) return;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      setError('Invalid salary setting id.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await salarySettingsAPI.get(numericId);
        if (!cancelled) setData(result);
      } catch (err: any) {
        if (!cancelled) setError(extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const canEdit = !!(user?.is_superuser || hasPermission?.('finance.change_salaryrecord'));
  const canActivate = !!(user?.is_superuser || hasPermission?.('finance.change_salaryrecord'));

  // ── Activate / deactivate ──
  // NOTE: backend has no dedicated toggle endpoint — PUT on the detail view
  // already accepts a partial payload (serializer is constructed with
  // partial=True), so flipping is_active through the existing update() call
  // is correct and avoids standing up a redundant endpoint.
  const handleToggleActive = async () => {
    if (!data || data.is_locked) return;
    const nextActive = !data.is_active;
    setToggling(true);
    try {
      const result = await salarySettingsAPI.update(data.id, { ...data, is_active: nextActive } as any);
      setData(result);
      showToast('success', `"${result.name}" ${nextActive ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setToggling(false);
    }
  };

  // ── Derived: total basic percentage ──
  const totalPct = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.basic_components || {}).reduce((s, c) => s + toNum(c.percentage, 0), 0);
  }, [data]);
  const isPctValid = Math.abs(totalPct - 100) < 0.01;

  // ── Combined JSON for download/copy ──
  const combinedJson = useMemo(() => {
    if (!data) return '';
    const { id: _id, is_locked, created_by, created_at, updated_at, ...rest } = data;
    return JSON.stringify(rest, null, 2);
  }, [data]);

  const handleDownloadJson = () => {
    if (!data) return;
    const blob = new Blob([combinedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary_setting_${data.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(combinedJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('error', 'Unable to copy to clipboard. Try downloading instead.');
    }
  };

  // ── Loading / error states ──
  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Loading salary setting…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Couldn't load this setting</p>
          <p className="text-sm text-slate-400 mb-4">{error || 'Salary setting not found.'}</p>
          <button onClick={() => router.push('/dashboard/staff/salary/settings')} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Settings
          </button>
        </div>
      </div>
    );
  }

  const basicList = Object.values(data.basic_components || {});

  return (
    <div className="pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <button onClick={() => router.push('/dashboard/staff/salary/settings')} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0 mt-0.5">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>

        <div className="flex-1 min-w-[240px]">
          <h1 className="text-2xl font-bold text-slate-900">{data.name}</h1>
          {data.description && <p className="text-sm text-slate-500 mt-0.5">{data.description}</p>}
          <p className="text-xs text-slate-400 mt-1">
            Effective: {data.effective_from}{data.effective_to ? ` — ${data.effective_to}` : ''}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Status badge */}
          <div>
            {data.is_locked ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                <Lock className="h-3 w-3" /> Locked
              </span>
            ) : data.is_active ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <CheckCircle className="h-3 w-3" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                <Pause className="h-3 w-3" /> Inactive
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {canActivate && (
              data.is_locked ? (
                <button type="button" disabled className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed">
                  {data.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {data.is_active ? 'Deactivate' : 'Activate'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleActive}
                  disabled={toggling}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border transition-colors disabled:opacity-50 ${
                    data.is_active
                      ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                      : 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
                  }`}
                >
                  {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : data.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {data.is_active ? 'Deactivate' : 'Activate'}
                </button>
              )
            )}

            {canEdit && (
              data.is_locked ? (
                <button type="button" disabled className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed">
                  <Edit3 className="h-4 w-4" /> Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/staff/salary/settings/${data.id}/edit`)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all"
                >
                  <Edit3 className="h-4 w-4" /> Edit
                </button>
              )
            )}
          </div>

          {data.is_locked && (
            <p className="text-[11px] text-slate-400 max-w-[220px] text-right">
              This setting has been used in salary processing and can no longer be edited or toggled.
            </p>
          )}
        </div>
      </div>

      {/* ── Meta cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-2">
            <Users className="h-4 w-4 text-blue-500" /> Usage
          </div>
          <p className="text-xs text-slate-500">Locked: <span className="font-medium text-slate-700">{data.is_locked ? 'Yes' : 'No'}</span></p>
          <p className="text-xs text-slate-500">Leave allowance: <span className="font-medium text-slate-700">{toNum(data.leave_allowance_percentage, 0).toFixed(2)}%</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-2">
            <UserCircle2 className="h-4 w-4 text-purple-500" /> Meta
          </div>
          <p className="text-xs text-slate-500">Created by: <span className="font-medium text-slate-700">{getCreatedByName(data.created_by)}</span></p>
          <p className="text-xs text-slate-500">Created: <span className="font-medium text-slate-700">{fmtDate(data.created_at)}</span></p>
          <p className="text-xs text-slate-500">Updated: <span className="font-medium text-slate-700">{fmtDate(data.updated_at)}</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-2">
            <Wrench className="h-4 w-4 text-slate-500" /> Quick Actions
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleDownloadJson} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
              <Download className="h-3.5 w-3.5" /> Download
            </button>
            <button type="button" onClick={handleCopyJson} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Salary preview ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-3">
          <Wallet className="h-4 w-4 text-blue-500" /> Salary Preview
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Monthly Salary (₦)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={previewSalary}
              onChange={(e) => setPreviewSalary(toNum(e.target.value, 0))}
              className="w-48 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Include Leave in Gross</label>
            {data.include_leave_in_gross ? (
              <span className="inline-flex text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg">Yes</span>
            ) : (
              <span className="inline-flex text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg">No</span>
            )}
          </div>
          <p className="text-xs text-slate-400 flex-1 min-w-[180px] text-right">Adjust the salary to recompute component amounts below.</p>
        </div>
      </div>

      {/* ── Sections ── */}
      <Section icon={<DollarSignIcon />} iconBg="bg-gradient-to-br from-green-500 to-green-700" title="Basic Salary Components" open={open.basic} onToggle={() => toggle('basic')}>
        <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
          <span className="text-sm text-blue-700">These components must total <strong>100%</strong>.</span>
          <span className={`text-sm font-bold ${isPctValid ? 'text-green-600' : 'text-red-600'}`}>
            Current Total: {totalPct.toFixed(2)}%
          </span>
        </div>
        {basicList.length === 0 ? <EmptyNote text="No basic components configured." /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {basicList.map((c, i) => {
              const pct = toNum(c.percentage, 0);
              const amount = (previewSalary * pct) / 100;
              return (
                <div key={`${c.code}-${i}`} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{c.name} <span className="text-xs font-normal text-slate-400">({c.code})</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">Percentage: {pct.toFixed(2)}%</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800">{fmtMoney(amount)}</p>
                    <p className="text-[11px] text-slate-400">of {fmtMoney(previewSalary)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section icon={<Gift className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-cyan-500 to-cyan-700" title="Allowances" open={open.allowances} onToggle={() => toggle('allowances')}>
        {(!data.allowances || data.allowances.length === 0) ? <EmptyNote text="No allowances configured." /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.allowances.map((a, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{a.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {a.is_active ? 'Active' : 'Inactive'} • {a.annual_only ? 'Annual only' : 'Monthly'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 text-right flex-shrink-0">{calcDescription(a, data.basic_components)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<Shield className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-amber-500 to-amber-700" title="Tax Reliefs & Exemptions" open={open.reliefs} onToggle={() => toggle('reliefs')}>
        {(!data.reliefs_exemptions || data.reliefs_exemptions.length === 0) ? <EmptyNote text="No reliefs configured." /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.reliefs_exemptions.map((r, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <p className="text-sm font-bold text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {r.is_active ? 'Active' : 'Inactive'} • {calcDescription(r, data.basic_components)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<Percent className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-red-500 to-red-700" title="Tax Brackets (PAYE)" open={open.brackets} onToggle={() => toggle('brackets')}>
        {(!data.tax_brackets || data.tax_brackets.length === 0) ? <EmptyNote text="No tax brackets configured." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="py-2 pr-4">Limit (₦)</th>
                  <th className="py-2">Rate (%)</th>
                </tr>
              </thead>
              <tbody>
                {data.tax_brackets.map((b, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-4 text-slate-700">{b.limit === null || b.limit === undefined ? <em className="text-slate-400">Remaining</em> : fmtMoney(toNum(b.limit, 0))}</td>
                    <td className="py-2 text-slate-700">{toNum(b.rate, 0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section icon={<Landmark className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-slate-600 to-slate-800" title="Statutory Deductions" open={open.statutory} onToggle={() => toggle('statutory')}>
        {(!data.statutory_deductions || data.statutory_deductions.length === 0) ? <EmptyNote text="No statutory deductions configured." /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.statutory_deductions.map((s, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <p className="text-sm font-bold text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {s.is_active ? 'Active' : 'Inactive'} • {calcDescription(s, data.basic_components)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<MinusCircle className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-gray-700 to-gray-900" title="Other Deductions Configuration" open={open.otherDeductions} onToggle={() => toggle('otherDeductions')}>
        {(!data.other_deductions_config || data.other_deductions_config.length === 0) ? <EmptyNote text="No other deductions configured." /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.other_deductions_config.map((o: any, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <p className="text-sm font-bold text-slate-800">{o.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {o.display_rule || ''}{o.linked_to ? ` • linked to ${o.linked_to}` : ''} • order: {o.order ?? 1}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<PlusCircle className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-teal-500 to-teal-700" title="Additional Income Items" open={open.incomeItems} onToggle={() => toggle('incomeItems')}>
        {(!data.income_items || data.income_items.length === 0) ? <EmptyNote text="No additional income items configured." /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.income_items.map((it: any, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <p className="text-sm font-bold text-slate-800">{it.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{it.display_rule || ''} • order: {it.order ?? 1}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<PlusSquare className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-purple-500 to-purple-700" title="Additional Salary Profile Fields" open={open.additionalFields} onToggle={() => toggle('additionalFields')}>
        {(!data.additional_fields || data.additional_fields.length === 0) ? <EmptyNote text="No additional fields configured." /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.additional_fields.map((f: any, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <p className="text-sm font-bold text-slate-800">{f.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">Code: {f.code}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}