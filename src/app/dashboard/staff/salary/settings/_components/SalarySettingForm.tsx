'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { salarySettingsAPI } from '@/lib/salary_management.service';
import { SalarySetting, SalarySettingWrite } from '@/lib/salary_management.types';
import {
  Settings, ArrowLeft, Save, X, AlertCircle, Loader2, CheckCircle,
  ChevronDown, ChevronUp, Plus, Trash2, Info, DollarSign,
  Gift, Shield, Percent, Landmark, MinusCircle, PlusCircle, Edit3,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

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

// FIX: DRF DecimalField commonly serializes as a string (e.g. "12.50"). This
// coerces any incoming API value (string | number | null | undefined) into a
// safe JS number for local state, so seeded edit-mode values behave the same
// as freshly-typed create-mode values.
function toNum(value: any, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Same idea, but preserves null (used for tax bracket "limit", where null
// means "remaining income" and must NOT be coerced to 0).
function toNumOrNull(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

// ─── Shared style tokens ──────────────────────────────────────────────────────
const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

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

// ─── Section accordion ────────────────────────────────────────────────────────
function Section({ icon, iconBg, title, subtitle, required, open, onToggle, children, hasError }: {
  icon: React.ReactNode; iconBg: string; title: string; subtitle?: string;
  required?: boolean; open: boolean; onToggle: () => void; children: React.ReactNode; hasError?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button type="button" onClick={onToggle} className={`w-full flex items-center gap-4 px-6 py-4 transition-colors text-left ${hasError ? 'bg-red-50/50' : 'hover:bg-slate-50/60'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{title}</span>
            {required && <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100 uppercase tracking-wide">Required</span>}
            {hasError && <span className="text-[10px] font-semibold text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Needs attention</span>}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex-shrink-0 text-slate-400">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
      </button>
      {open && <div className="px-6 pb-6 border-t border-slate-50"><div className="pt-5">{children}</div></div>}
    </div>
  );
}

// ─── Item types ───────────────────────────────────────────────────────────────
interface BasicComponent { id: string; name: string; code: string; percentage: number; }
interface AdditionalField { id: string; name: string; code: string; }
interface Allowance { id: string; name: string; is_active: boolean; calculation_type: 'percentage' | 'fixed' | 'combined'; annual_only: boolean; percentage?: number; fixed_amount?: number; based_on?: string; based_on_type?: 'component' | 'additional_field'; }
interface Relief { id: string; name: string; is_active: boolean; calculation_type: 'percentage' | 'fixed' | 'combined'; percentage?: number; fixed_amount?: number; based_on?: string; based_on_type?: 'component' | 'additional_field'; }
interface TaxBracket { id: string; limit: number | null; rate: number; }
interface StatutoryDeduction { id: string; name: string; is_active: boolean; calculation_type: 'percentage' | 'fixed' | 'combined'; percentage?: number; fixed_amount?: number; based_on?: string; based_on_type?: 'component' | 'additional_field'; }
interface OtherDeductionConfig { id: string; name: string; display_rule: 'show_if_filled' | 'always_show'; linked_to: '' | 'staff_loan' | 'salary_advance'; order: number; }
interface IncomeItem { id: string; name: string; display_rule: 'show_if_filled' | 'always_show'; order: number; }

// ─── Add button ───────────────────────────────────────────────────────────────
function AddBtn({ onClick, label, color }: { onClick: () => void; label: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100',
    purple: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100',
    cyan: 'text-cyan-700 bg-cyan-50 border-cyan-200 hover:bg-cyan-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100',
    red: 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100',
    slate: 'text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200',
    gray: 'text-gray-700 bg-gray-100 border-gray-200 hover:bg-gray-200',
    teal: 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100',
  };
  return (
    <button type="button" onClick={onClick} className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border rounded-lg transition-colors ${colors[color]}`}>
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}

// ─── Remove button ────────────────────────────────────────────────────────────
function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

// ─── Based-on select helpers ──────────────────────────────────────────────────
function BasedOnFields({ basedOnType, basedOn, onTypeChange, onValueChange, componentCodes, additionalFields, defaultKeyword = 'TOTAL' }: {
  basedOnType: string; basedOn: string; onTypeChange: (v: string) => void; onValueChange: (v: string) => void;
  componentCodes: string[]; additionalFields: AdditionalField[]; defaultKeyword?: string;
}) {
  const componentOptions = [
    { value: 'TOTAL', label: 'Total Salary' },
    { value: 'GROSS_INCOME', label: 'Gross Income' },
    ...componentCodes.map((c) => ({ value: c, label: `Component: ${c}` })),
  ];
  const additionalOptions = additionalFields.filter((f) => f.code && f.name).map((f) => ({ value: f.code, label: `${f.name} (${f.code})` }));

  return (
    <>
      <div>
        <label className={labelCls}>Based On Type</label>
        <select className={inputCls} value={basedOnType} onChange={(e) => onTypeChange(e.target.value)}>
          <option value="component">Salary Component</option>
          <option value="additional_field">Additional Field</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Based On</label>
        {basedOnType === 'additional_field' ? (
          <select className={inputCls} value={basedOn || ''} onChange={(e) => onValueChange(e.target.value)}>
            <option value="">Select field</option>
            {additionalOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <select className={inputCls} value={basedOn || defaultKeyword} onChange={(e) => onValueChange(e.target.value)}>
            {componentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>
    </>
  );
}

// ─── Item components ──────────────────────────────────────────────────────────
function BasicComponentItem({ item, onChange, onRemove, previewSalary }: { item: BasicComponent; onChange: (id: string, f: keyof BasicComponent, v: any) => void; onRemove: (id: string) => void; previewSalary: number; }) {
  const amount = (previewSalary * item.percentage) / 100;
  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-slate-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div><label className={labelCls}>Name</label><input type="text" className={inputCls} placeholder="e.g. Basic Salary" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} /></div>
        <div>
          <label className={labelCls}>Code</label>
          <input type="text" className={inputCls} placeholder="e.g. B" maxLength={3} value={item.code} onChange={(e) => onChange(item.id, 'code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          <p className="text-[10px] text-slate-400 mt-0.5">Max 3 chars, unique</p>
        </div>
        <div><label className={labelCls}>Percentage (%)</label><input type="number" className={inputCls} placeholder="e.g. 40" step="0.01" min="0" max="100" value={item.percentage || ''} onChange={(e) => onChange(item.id, 'percentage', parseFloat(e.target.value) || 0)} /></div>
        <div className="flex items-end justify-between">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Preview <span className="normal-case font-normal text-slate-400">(₦500k salary)</span></label>
            <p className="text-sm font-bold text-slate-800 mt-1">{fmtMoney(amount)}</p>
          </div>
          <RemoveBtn onClick={() => onRemove(item.id)} />
        </div>
      </div>
    </div>
  );
}

function AdditionalFieldItem({ item, onChange, onRemove }: { item: AdditionalField; onChange: (id: string, f: keyof AdditionalField, v: any) => void; onRemove: (id: string) => void; }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-slate-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className={labelCls}>Field Name</label><input type="text" className={inputCls} placeholder="e.g. Rent" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} /></div>
        <div><label className={labelCls}>Field Code</label><input type="text" className={inputCls} placeholder="e.g. rent" value={item.code} onChange={(e) => onChange(item.id, 'code', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} /></div>
        <div className="flex items-end justify-end"><RemoveBtn onClick={() => onRemove(item.id)} /></div>
      </div>
    </div>
  );
}

function AllowanceItem({ item, onChange, onRemove, additionalFields, componentCodes }: { item: Allowance; onChange: (id: string, f: keyof Allowance, v: any) => void; onRemove: (id: string) => void; additionalFields: AdditionalField[]; componentCodes: string[]; }) {
  const isFixed = item.calculation_type === 'fixed';
  const isPercentage = item.calculation_type === 'percentage';
  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-slate-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div><label className={labelCls}>Name</label><input type="text" className={inputCls} placeholder="e.g. Housing Allowance" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} /></div>
        <div><label className={labelCls}>Calculation Type</label>
          <select className={inputCls} value={item.calculation_type} onChange={(e) => onChange(item.id, 'calculation_type', e.target.value)}>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
            <option value="combined">Combined (Fixed + %)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" checked={item.is_active} onChange={(e) => onChange(item.id, 'is_active', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600" /> Active</label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" checked={item.annual_only} onChange={(e) => onChange(item.id, 'annual_only', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600" /> Annual Only</label>
        </div>
        <div className="flex items-end justify-end"><RemoveBtn onClick={() => onRemove(item.id)} /></div>
      </div>
      {(!isFixed || !isPercentage) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200">
          {!isFixed && <>
            <div><label className={labelCls}>Percentage (%)</label><input type="number" className={inputCls} step="0.01" min="0" placeholder="e.g. 10" value={item.percentage || ''} onChange={(e) => onChange(item.id, 'percentage', parseFloat(e.target.value) || 0)} /></div>
            <BasedOnFields basedOnType={item.based_on_type || 'component'} basedOn={item.based_on || 'TOTAL'} onTypeChange={(v) => onChange(item.id, 'based_on_type', v)} onValueChange={(v) => onChange(item.id, 'based_on', v)} componentCodes={componentCodes} additionalFields={additionalFields} defaultKeyword="TOTAL" />
          </>}
          {!isPercentage && (
            <div className={!isFixed ? 'sm:col-span-1' : 'sm:col-span-3'}>
              <label className={labelCls}>Fixed Amount (₦)</label>
              <input type="number" className={inputCls} step="0.01" min="0" placeholder="e.g. 50000" value={item.fixed_amount || ''} onChange={(e) => onChange(item.id, 'fixed_amount', parseFloat(e.target.value) || 0)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReliefItem({ item, onChange, onRemove, additionalFields, componentCodes }: { item: Relief; onChange: (id: string, f: keyof Relief, v: any) => void; onRemove: (id: string) => void; additionalFields: AdditionalField[]; componentCodes: string[]; }) {
  const isFixed = item.calculation_type === 'fixed';
  const isPercentage = item.calculation_type === 'percentage';
  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-slate-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className={labelCls}>Name</label><input type="text" className={inputCls} placeholder="e.g. Personal Relief" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} /></div>
        <div><label className={labelCls}>Calculation Type</label>
          <select className={inputCls} value={item.calculation_type} onChange={(e) => onChange(item.id, 'calculation_type', e.target.value)}>
            <option value="combined">Combined (Fixed + %)</option>
            <option value="percentage">Percentage Only</option>
            <option value="fixed">Fixed Only</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" checked={item.is_active} onChange={(e) => onChange(item.id, 'is_active', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600" /> Active</label>
          <RemoveBtn onClick={() => onRemove(item.id)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200">
        {!isFixed && <>
          <div><label className={labelCls}>Percentage (%)</label><input type="number" className={inputCls} step="0.01" min="0" placeholder="e.g. 20" value={item.percentage || ''} onChange={(e) => onChange(item.id, 'percentage', parseFloat(e.target.value) || 0)} /></div>
          <BasedOnFields basedOnType={item.based_on_type || 'component'} basedOn={item.based_on || 'GROSS_INCOME'} onTypeChange={(v) => onChange(item.id, 'based_on_type', v)} onValueChange={(v) => onChange(item.id, 'based_on', v)} componentCodes={componentCodes} additionalFields={additionalFields} defaultKeyword="GROSS_INCOME" />
        </>}
        {!isPercentage && (
          <div className={!isFixed ? '' : 'sm:col-span-3'}>
            <label className={labelCls}>Fixed Amount (₦)</label>
            <input type="number" className={inputCls} step="0.01" min="0" placeholder="e.g. 200000" value={item.fixed_amount || ''} onChange={(e) => onChange(item.id, 'fixed_amount', parseFloat(e.target.value) || 0)} />
          </div>
        )}
      </div>
    </div>
  );
}

function TaxBracketItem({ item, onChange, onRemove }: { item: TaxBracket; onChange: (id: string, f: keyof TaxBracket, v: any) => void; onRemove: (id: string) => void; }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-slate-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Income Limit (₦)</label>
          <input type="number" className={inputCls} step="1" min="0" placeholder="e.g. 300000" value={item.limit === null ? '' : item.limit} onChange={(e) => { const v = e.target.value.trim(); onChange(item.id, 'limit', v === '' ? null : parseFloat(v)); }} />
          <p className="text-[10px] text-slate-400 mt-0.5">Leave empty for "remaining"</p>
        </div>
        <div><label className={labelCls}>Rate (%)</label><input type="number" className={inputCls} step="0.01" min="0" max="100" placeholder="e.g. 7" value={item.rate || ''} onChange={(e) => onChange(item.id, 'rate', parseFloat(e.target.value) || 0)} /></div>
        <div className="flex items-end justify-end"><RemoveBtn onClick={() => onRemove(item.id)} /></div>
      </div>
    </div>
  );
}

function StatutoryDeductionItem({ item, onChange, onRemove, additionalFields, componentCodes }: { item: StatutoryDeduction; onChange: (id: string, f: keyof StatutoryDeduction, v: any) => void; onRemove: (id: string) => void; additionalFields: AdditionalField[]; componentCodes: string[]; }) {
  const isFixed = item.calculation_type === 'fixed';
  const isPercentage = item.calculation_type === 'percentage';
  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-slate-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className={labelCls}>Name</label><input type="text" className={inputCls} placeholder="e.g. Pension" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} /></div>
        <div><label className={labelCls}>Calculation Type</label>
          <select className={inputCls} value={item.calculation_type} onChange={(e) => onChange(item.id, 'calculation_type', e.target.value)}>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
            <option value="combined">Combined (Fixed + %)</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" checked={item.is_active} onChange={(e) => onChange(item.id, 'is_active', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600" /> Active</label>
          <RemoveBtn onClick={() => onRemove(item.id)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200">
        {!isFixed && <>
          <div><label className={labelCls}>Percentage (%)</label><input type="number" className={inputCls} step="0.01" min="0" placeholder="e.g. 8" value={item.percentage || ''} onChange={(e) => onChange(item.id, 'percentage', parseFloat(e.target.value) || 0)} /></div>
          <BasedOnFields basedOnType={item.based_on_type || 'component'} basedOn={item.based_on || 'TOTAL'} onTypeChange={(v) => onChange(item.id, 'based_on_type', v)} onValueChange={(v) => onChange(item.id, 'based_on', v)} componentCodes={componentCodes} additionalFields={additionalFields} defaultKeyword="TOTAL" />
        </>}
        {!isPercentage && (
          <div className={!isFixed ? '' : 'sm:col-span-3'}>
            <label className={labelCls}>Fixed Amount (₦)</label>
            <input type="number" className={inputCls} step="0.01" min="0" placeholder="e.g. 2000" value={item.fixed_amount || ''} onChange={(e) => onChange(item.id, 'fixed_amount', parseFloat(e.target.value) || 0)} />
          </div>
        )}
      </div>
    </div>
  );
}

function OtherDeductionConfigItem({ item, onChange, onRemove }: { item: OtherDeductionConfig; onChange: (id: string, f: keyof OtherDeductionConfig, v: any) => void; onRemove: (id: string) => void; }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-slate-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div><label className={labelCls}>Name</label><input type="text" className={inputCls} placeholder="e.g. Staff Loan" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} /></div>
        <div><label className={labelCls}>Display Rule</label>
          <select className={inputCls} value={item.display_rule} onChange={(e) => onChange(item.id, 'display_rule', e.target.value)}>
            <option value="show_if_filled">Show if Filled</option>
            <option value="always_show">Always Show</option>
          </select>
        </div>
        <div><label className={labelCls}>Auto-Link To</label>
          <select className={inputCls} value={item.linked_to} onChange={(e) => onChange(item.id, 'linked_to', e.target.value)}>
            <option value="">None (Manual)</option>
            <option value="staff_loan">Staff Loan</option>
            <option value="salary_advance">Salary Advance</option>
          </select>
        </div>
        <div><label className={labelCls}>Order</label><input type="number" className={inputCls} min="1" value={item.order} onChange={(e) => onChange(item.id, 'order', parseInt(e.target.value) || 1)} /></div>
        <div className="flex items-end justify-end"><RemoveBtn onClick={() => onRemove(item.id)} /></div>
      </div>
    </div>
  );
}

function IncomeItemRow({ item, onChange, onRemove }: { item: IncomeItem; onChange: (id: string, f: keyof IncomeItem, v: any) => void; onRemove: (id: string) => void; }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-3 bg-slate-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div><label className={labelCls}>Name</label><input type="text" className={inputCls} placeholder="e.g. Reimbursable" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} /></div>
        <div><label className={labelCls}>Display Rule</label>
          <select className={inputCls} value={item.display_rule} onChange={(e) => onChange(item.id, 'display_rule', e.target.value)}>
            <option value="show_if_filled">Show if Filled</option>
            <option value="always_show">Always Show</option>
          </select>
        </div>
        <div><label className={labelCls}>Order</label><input type="number" className={inputCls} min="1" value={item.order} onChange={(e) => onChange(item.id, 'order', parseInt(e.target.value) || 1)} /></div>
        <div className="flex items-end justify-end"><RemoveBtn onClick={() => onRemove(item.id)} /></div>
      </div>
    </div>
  );
}

// ─── Seed helpers: convert API data → local state ─────────────────────────────
// FIX: every numeric field coming from the API is run through toNum/toNumOrNull
// in case DRF serializes DecimalFields as strings (e.g. "12.50").
function seedBasicComponents(raw: Record<string, any>, genId: () => string): BasicComponent[] {
  return Object.values(raw || {}).map((c: any) => ({
    id: genId(),
    name: c.name || '',
    code: c.code || '',
    percentage: toNum(c.percentage, 0),
  }));
}

function seedAllowances(raw: any[], genId: () => string): Allowance[] {
  return (raw || []).map((a: any) => ({
    id: genId(),
    name: a.name || '',
    is_active: a.is_active ?? true,
    calculation_type: a.calculation_type || 'percentage',
    annual_only: a.annual_only ?? false,
    percentage: a.percentage != null ? toNum(a.percentage, 0) : undefined,
    fixed_amount: a.fixed_amount != null ? toNum(a.fixed_amount, 0) : undefined,
    based_on: a.based_on || undefined,
    based_on_type: a.based_on_type || 'component',
  }));
}

function seedReliefs(raw: any[], genId: () => string): Relief[] {
  return (raw || []).map((r: any) => ({
    id: genId(),
    name: r.name || '',
    is_active: r.is_active ?? true,
    calculation_type: r.calculation_type || 'combined',
    percentage: r.percentage != null ? toNum(r.percentage, 0) : undefined,
    fixed_amount: r.fixed_amount != null ? toNum(r.fixed_amount, 0) : undefined,
    based_on: r.based_on || undefined,
    based_on_type: r.based_on_type || 'component',
  }));
}

function seedTaxBrackets(raw: any[], genId: () => string): TaxBracket[] {
  return (raw || []).map((b: any) => ({
    id: genId(),
    limit: toNumOrNull(b.limit),
    rate: toNum(b.rate, 0),
  }));
}

function seedStatutoryDeductions(raw: any[], genId: () => string): StatutoryDeduction[] {
  return (raw || []).map((s: any) => ({
    id: genId(),
    name: s.name || '',
    is_active: s.is_active ?? true,
    calculation_type: s.calculation_type || 'percentage',
    percentage: s.percentage != null ? toNum(s.percentage, 0) : undefined,
    fixed_amount: s.fixed_amount != null ? toNum(s.fixed_amount, 0) : undefined,
    based_on: s.based_on || undefined,
    based_on_type: s.based_on_type || 'component',
  }));
}

function seedOtherDeductions(raw: any[], genId: () => string): OtherDeductionConfig[] {
  return (raw || []).map((o: any) => ({
    id: genId(),
    name: o.name || '',
    display_rule: o.display_rule || 'show_if_filled',
    linked_to: o.linked_to || '',
    order: toNum(o.order, 1),
  }));
}

function seedIncomeItems(raw: any[], genId: () => string): IncomeItem[] {
  return (raw || []).map((i: any) => ({
    id: genId(),
    name: i.name || '',
    display_rule: i.display_rule || 'show_if_filled',
    order: toNum(i.order, 1),
  }));
}

function seedAdditionalFields(raw: any[], genId: () => string): AdditionalField[] {
  return (raw || []).map((f: any) => ({ id: genId(), name: f.name || '', code: f.code || '' }));
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface SalarySettingFormProps {
  initialData?: SalarySetting;
}

// ─── Main form component ──────────────────────────────────────────────────────
export default function SalarySettingForm({ initialData }: SalarySettingFormProps) {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const isEdit = !!initialData;

  const idCounterRef = useRef(0);
  const genId = useCallback(() => `item-${++idCounterRef.current}`, []);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  // ── Basic fields ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [leaveAllowancePercentage, setLeaveAllowancePercentage] = useState(10);
  const [includeLeaveInGross, setIncludeLeaveInGross] = useState(false);

  // ── Dynamic lists ──
  const [basicComponents, setBasicComponents] = useState<BasicComponent[]>([]);
  const [additionalFields, setAdditionalFields] = useState<AdditionalField[]>([]);
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [reliefs, setReliefs] = useState<Relief[]>([]);
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>([]);
  const [statutoryDeductions, setStatutoryDeductions] = useState<StatutoryDeduction[]>([]);
  const [otherDeductions, setOtherDeductions] = useState<OtherDeductionConfig[]>([]);
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>([]);

  // ── Section open state ──
  const [open, setOpen] = useState<Record<string, boolean>>({
    basic: true, components: true, additionalFields: false,
    allowances: false, reliefs: false, taxBrackets: false,
    statutory: false, otherDeductions: false, incomeItems: false,
  });
  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  // ── Seed from initialData on edit ──
  useEffect(() => {
    if (!initialData || seeded) return;
    setName(initialData.name || '');
    setDescription(initialData.description || '');
    setEffectiveFrom(initialData.effective_from || new Date().toISOString().split('T')[0]);
    setEffectiveTo(initialData.effective_to || '');
    setLeaveAllowancePercentage(toNum(initialData.leave_allowance_percentage, 10));
    setIncludeLeaveInGross(initialData.include_leave_in_gross || false);

    // Seed additional fields FIRST so based_on dropdowns are populated
    // before allowances/reliefs/statutory deductions try to reference them.
    setAdditionalFields(seedAdditionalFields(initialData.additional_fields || [], genId));

    setBasicComponents(seedBasicComponents(initialData.basic_components || {}, genId));
    setAllowances(seedAllowances(initialData.allowances || [], genId));
    setReliefs(seedReliefs(initialData.reliefs_exemptions || [], genId));
    setTaxBrackets(seedTaxBrackets(initialData.tax_brackets || [], genId));
    setStatutoryDeductions(seedStatutoryDeductions(initialData.statutory_deductions || [], genId));
    setOtherDeductions(seedOtherDeductions(initialData.other_deductions_config || [], genId));
    setIncomeItems(seedIncomeItems(initialData.income_items || [], genId));
    setSeeded(true);
  }, [initialData, genId, seeded]);

  // ── Derived ──
  const componentCodes = basicComponents.map((c) => c.code).filter(Boolean);
  const totalPct = basicComponents.reduce((s, c) => s + c.percentage, 0);
  const isPctValid = Math.abs(totalPct - 100) < 0.01;

  // ── List helpers ──
  const mkAdd = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, defaults: Omit<T, 'id'>) =>
    () => setter((p) => [...p, { id: genId(), ...defaults } as T]);

  const mkUpdate = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
    (id: string, field: keyof T, value: any) => setter((p) => p.map((item) => item.id === id ? { ...item, [field]: value } : item));

  const mkRemove = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
    (id: string) => setter((p) => p.filter((item) => item.id !== id));

  const addBasicComponent = mkAdd<BasicComponent>(setBasicComponents, { name: '', code: '', percentage: 0 });
  const updateBasicComponent = mkUpdate<BasicComponent>(setBasicComponents);
  const removeBasicComponent = mkRemove<BasicComponent>(setBasicComponents);

  const addAdditionalField = mkAdd<AdditionalField>(setAdditionalFields, { name: '', code: '' });
  const updateAdditionalField = mkUpdate<AdditionalField>(setAdditionalFields);
  const removeAdditionalField = mkRemove<AdditionalField>(setAdditionalFields);

  const addAllowance = mkAdd<Allowance>(setAllowances, { name: '', is_active: true, calculation_type: 'percentage', annual_only: false, percentage: 0, based_on: 'TOTAL', based_on_type: 'component' });
  const updateAllowance = mkUpdate<Allowance>(setAllowances);
  const removeAllowance = mkRemove<Allowance>(setAllowances);

  const addRelief = mkAdd<Relief>(setReliefs, { name: '', is_active: true, calculation_type: 'combined', percentage: 0, fixed_amount: 0, based_on: 'GROSS_INCOME', based_on_type: 'component' });
  const updateRelief = mkUpdate<Relief>(setReliefs);
  const removeRelief = mkRemove<Relief>(setReliefs);

  const addTaxBracket = mkAdd<TaxBracket>(setTaxBrackets, { limit: null, rate: 0 });
  const updateTaxBracket = mkUpdate<TaxBracket>(setTaxBrackets);
  const removeTaxBracket = mkRemove<TaxBracket>(setTaxBrackets);

  const addStatutoryDeduction = mkAdd<StatutoryDeduction>(setStatutoryDeductions, { name: '', is_active: true, calculation_type: 'percentage', percentage: 0, based_on: 'TOTAL', based_on_type: 'component' });
  const updateStatutoryDeduction = mkUpdate<StatutoryDeduction>(setStatutoryDeductions);
  const removeStatutoryDeduction = mkRemove<StatutoryDeduction>(setStatutoryDeductions);

  const addOtherDeduction = mkAdd<OtherDeductionConfig>(setOtherDeductions, { name: '', display_rule: 'show_if_filled', linked_to: '', order: 1 });
  const updateOtherDeduction = mkUpdate<OtherDeductionConfig>(setOtherDeductions);
  const removeOtherDeduction = mkRemove<OtherDeductionConfig>(setOtherDeductions);

  const addIncomeItem = mkAdd<IncomeItem>(setIncomeItems, { name: '', display_rule: 'show_if_filled', order: 1 });
  const updateIncomeItem = mkUpdate<IncomeItem>(setIncomeItems);
  const removeIncomeItem = mkRemove<IncomeItem>(setIncomeItems);

  // ── Validation ──
  const validate = (): string | null => {
    if (!name.trim()) return 'Setting name is required.';
    if (!effectiveFrom) return 'Effective from date is required.';

    const totalPct = basicComponents.reduce((sum, c) => sum + c.percentage, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      return `Basic components must total 100%. Current total: ${totalPct.toFixed(2)}%`;
    }

    const codes = basicComponents.map((c) => c.code.toUpperCase()).filter(Boolean);
    const uniqueCodes = new Set(codes);
    if (codes.length !== uniqueCodes.size) return 'Component codes must be unique.';
    for (const c of basicComponents) {
      if (c.code.length > 3) return `Component code "${c.code}" exceeds 3 characters.`;
      if (!c.name.trim()) return `Component "${c.code}" has no name.`;
    }

    const validateBasedOn = (
      items: any[],
      typeField: string,
      basedOnField: string,
      itemType: string,
    ): string | null => {
      for (const item of items) {
        const basedOnType = item[typeField] || 'component';
        const basedOn = item[basedOnField] || '';
        if (basedOnType === 'component' && basedOn) {
          const upper = basedOn.toUpperCase();
          if (!['TOTAL', 'GROSS_INCOME'].includes(upper) && !componentCodes.includes(upper)) {
            return `"${itemType} ${item.name || 'unnamed'}": Based On "${basedOn}" is not a valid component code.`;
          }
        } else if (basedOnType === 'additional_field' && basedOn) {
          const addCodes = additionalFields.map((f) => f.code);
          if (!addCodes.includes(basedOn)) {
            return `"${itemType} ${item.name || 'unnamed'}": Based On "${basedOn}" is not a valid additional field code.`;
          }
        }
      }
      return null;
    };

    const err1 = validateBasedOn(allowances, 'based_on_type', 'based_on', 'Allowance');
    if (err1) return err1;
    const err2 = validateBasedOn(reliefs, 'based_on_type', 'based_on', 'Relief');
    if (err2) return err2;
    const err3 = validateBasedOn(statutoryDeductions, 'based_on_type', 'based_on', 'Statutory deduction');
    if (err3) return err3;

    // ▼▼▼ NEW CODE GOES HERE — right after err3, before addCodes ▼▼▼
    const validateAmount = (items: any[], itemType: string): string | null => {
      for (const item of items) {
        const label = item.name || 'unnamed';
        const pct = item.percentage;
        const fixed = item.fixed_amount;
        const hasPct = pct !== undefined && pct !== null && pct > 0;
        const hasFixed = fixed !== undefined && fixed !== null && fixed > 0;

        if (item.calculation_type === 'percentage' && !hasPct) {
          return `"${itemType} ${label}": Percentage must be greater than 0.`;
        }
        if (item.calculation_type === 'fixed' && !hasFixed) {
          return `"${itemType} ${label}": Fixed amount must be greater than 0.`;
        }
        if (item.calculation_type === 'combined' && !hasPct && !hasFixed) {
          return `"${itemType} ${label}": Combined type needs a percentage or a fixed amount (or both).`;
        }
      }
      return null;
    };

    const err4 = validateAmount(allowances, 'Allowance');
    if (err4) return err4;
    const err5 = validateAmount(reliefs, 'Relief');
    if (err5) return err5;
    const err6 = validateAmount(statutoryDeductions, 'Statutory deduction');
    if (err6) return err6;
    // ▲▲▲ END NEW CODE ▲▲▲

    const addCodes = additionalFields.map((f) => f.code).filter(Boolean);
    if (new Set(addCodes).size !== addCodes.length) return 'Additional field codes must be unique.';
    for (const f of additionalFields) {
      if (!f.name.trim()) return `Additional field "${f.code}" has no name.`;
      if (!f.code.trim()) return `Additional field "${f.name}" has no code.`;
    }

    return null;
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFormError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => errorBannerRef.current?.focus(), 400);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const payload: SalarySettingWrite = {
        name: name.trim(),
        description: description.trim() || undefined,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        leave_allowance_percentage: leaveAllowancePercentage,
        include_leave_in_gross: includeLeaveInGross,
        is_active: initialData?.is_active ?? false,
        basic_components: basicComponents.reduce((acc, c) => {
          if (c.name.trim() && c.code.trim()) {
            acc[c.name.toLowerCase().replace(/\s+/g, '_')] = { name: c.name.trim(), code: c.code.trim().toUpperCase(), percentage: c.percentage };
          }
          return acc;
        }, {} as Record<string, any>),
        allowances: allowances.map((a) => ({ name: a.name.trim(), is_active: a.is_active, calculation_type: a.calculation_type, annual_only: a.annual_only, ...(a.percentage != null && { percentage: a.percentage }), ...(a.fixed_amount != null && { fixed_amount: a.fixed_amount }), ...(a.based_on && { based_on: a.based_on }), based_on_type: a.based_on_type || 'component' })),
        reliefs_exemptions: reliefs.map((r) => ({ name: r.name.trim(), is_active: r.is_active, calculation_type: r.calculation_type, ...(r.percentage != null && { percentage: r.percentage }), ...(r.fixed_amount != null && { fixed_amount: r.fixed_amount }), ...(r.based_on && { based_on: r.based_on }), based_on_type: r.based_on_type || 'component' })),
        tax_brackets: taxBrackets.map((b) => ({ limit: b.limit, rate: b.rate })),
        statutory_deductions: statutoryDeductions.map((s) => ({ name: s.name.trim(), is_active: s.is_active, calculation_type: s.calculation_type, ...(s.percentage != null && { percentage: s.percentage }), ...(s.fixed_amount != null && { fixed_amount: s.fixed_amount }), ...(s.based_on && { based_on: s.based_on }), based_on_type: s.based_on_type || 'component' })),
        other_deductions_config: otherDeductions.map((o) => ({ name: o.name.trim(), display_rule: o.display_rule, ...(o.linked_to && { linked_to: o.linked_to }), order: o.order })),
        income_items: incomeItems.map((i) => ({ name: i.name.trim(), display_rule: i.display_rule, order: i.order })),
        additional_fields: additionalFields.map((f) => ({ name: f.name.trim(), code: f.code.trim() })),
      };

      if (isEdit && initialData) {
        const result = await salarySettingsAPI.update(initialData.id, payload);
        showToast('success', `"${result.name}" updated successfully.`);
        router.push(`/dashboard/staff/salary/settings/${initialData.id}`);
      } else {
        const result = await salarySettingsAPI.create(payload);
        showToast('success', `"${result.name}" created successfully.`);
        router.push(`/dashboard/staff/salary/settings/${result.id}`);
      }
    } catch (err) {
      setFormError(extractError(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts((p) => p.filter((t) => t.id !== id));

  const canManage = user?.is_superuser || hasPermission('finance.add_salaryrecord');
  if (!canManage) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertCircle className="h-7 w-7 text-red-400" /></div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to {isEdit ? 'edit' : 'create'} salary settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              {isEdit ? <Edit3 className="h-5 w-5 text-white" /> : <Settings className="h-5 w-5 text-white" />}
            </div>
            {isEdit ? `Edit: ${initialData?.name}` : 'Create Salary Setting'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">
            {isEdit ? 'Update payroll rules, tax brackets, allowances, and deductions' : 'Define payroll rules, tax brackets, allowances, and deductions'}
          </p>
        </div>
      </div>

      {/* Error banner */}
      {formError && (
        <div className="mb-4" ref={errorBannerRef} tabIndex={-1} style={{ outline: 'none' }}>
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium flex-1">{formError}</p>
            <button onClick={() => setFormError(null)}><X className="h-4 w-4 text-red-400 hover:text-red-600" /></button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <Section icon={<Info className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-blue-500 to-blue-700" title="Basic Information" subtitle="Name, description, and effective dates" required open={open.basic} onToggle={() => toggle('basic')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Setting Name <span className="text-red-500 normal-case">*</span></label><input type="text" className={inputCls} placeholder="e.g. 2025 Nigeria Tax Rules" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div>
              <label className={labelCls}>Leave Allowance Percentage (%) <span className="text-red-500 normal-case">*</span></label>
              <input type="number" className={inputCls} step="0.01" min="0" value={leaveAllowancePercentage} onChange={(e) => setLeaveAllowancePercentage(parseFloat(e.target.value) || 0)} required />
              <p className="text-xs text-slate-400 mt-1">Percentage of annual basic salary</p>
            </div>
            <div><label className={labelCls}>Effective From <span className="text-red-500 normal-case">*</span></label><input type="date" className={inputCls} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required /></div>
            <div>
              <label className={labelCls}>Effective To</label>
              <input type="date" className={inputCls} value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">Leave empty if indefinitely valid</p>
            </div>
            <div className="md:col-span-2"><label className={labelCls}>Description</label><textarea className={`${inputCls} resize-none`} rows={3} placeholder="Brief description of this salary setting" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                <input type="checkbox" checked={includeLeaveInGross} onChange={(e) => setIncludeLeaveInGross(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                Include Leave Allowance in Gross Income
              </label>
              <p className="text-xs text-slate-400 mt-1">Controls whether leave allowance is included in gross income calculation</p>
            </div>
          </div>
        </Section>

        {/* Basic Salary Components */}
        <Section icon={<DollarSign className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-green-500 to-green-700" title="Basic Salary Components" subtitle="Split monthly salary into named components. Total must equal 100%." required open={open.components} onToggle={() => toggle('components')}>
          <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
            <span className="text-sm text-blue-700"><Info className="h-4 w-4 inline mr-1" />Total: <strong>{totalPct.toFixed(2)}%</strong></span>
            <span className={`text-sm font-bold ${isPctValid ? 'text-green-600' : 'text-red-600'}`}>{isPctValid ? '✅ Valid' : '⚠️ Must total 100%'}</span>
          </div>
          {basicComponents.map((item) => <BasicComponentItem key={item.id} item={item} onChange={updateBasicComponent} onRemove={removeBasicComponent} previewSalary={500000} />)}
          <AddBtn onClick={addBasicComponent} label="Add Component" color="green" />
        </Section>

        {/* Additional Fields */}
        <Section icon={<Plus className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-purple-500 to-purple-700" title="Additional Salary Profile Fields" subtitle="Extra fields for staff salary profile (e.g., Rent for relief calculation)" open={open.additionalFields} onToggle={() => toggle('additionalFields')}>
          <p className="text-sm text-slate-500 mb-4">These fields can be referenced in allowances, reliefs, and statutory deductions as "Additional Field" base type.</p>
          {additionalFields.map((item) => <AdditionalFieldItem key={item.id} item={item} onChange={updateAdditionalField} onRemove={removeAdditionalField} />)}
          <AddBtn onClick={addAdditionalField} label="Add Field" color="purple" />
        </Section>

        {/* Allowances */}
        <Section icon={<Gift className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-cyan-500 to-cyan-700" title="Allowances" subtitle="Additional income items, fixed or percentage-based" open={open.allowances} onToggle={() => toggle('allowances')}>
          {allowances.map((item) => <AllowanceItem key={item.id} item={item} onChange={updateAllowance} onRemove={removeAllowance} additionalFields={additionalFields} componentCodes={componentCodes} />)}
          <AddBtn onClick={addAllowance} label="Add Allowance" color="cyan" />
        </Section>

        {/* Reliefs */}
        <Section icon={<Shield className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-amber-500 to-amber-700" title="Tax Reliefs & Exemptions" subtitle="Deductions from gross income before calculating tax" open={open.reliefs} onToggle={() => toggle('reliefs')}>
          {reliefs.map((item) => <ReliefItem key={item.id} item={item} onChange={updateRelief} onRemove={removeRelief} additionalFields={additionalFields} componentCodes={componentCodes} />)}
          <AddBtn onClick={addRelief} label="Add Relief/Exemption" color="amber" />
        </Section>

        {/* Tax Brackets */}
        <Section icon={<Percent className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-red-500 to-red-700" title="Tax Brackets (PAYE)" subtitle="Progressive tax rates applied to taxable income" open={open.taxBrackets} onToggle={() => toggle('taxBrackets')}>
          {taxBrackets.map((item) => <TaxBracketItem key={item.id} item={item} onChange={updateTaxBracket} onRemove={removeTaxBracket} />)}
          <AddBtn onClick={addTaxBracket} label="Add Tax Bracket" color="red" />
        </Section>

        {/* Statutory Deductions */}
        <Section icon={<Landmark className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-slate-600 to-slate-800" title="Statutory Deductions" subtitle="Mandatory deductions like Pension, NHF, etc." open={open.statutory} onToggle={() => toggle('statutory')}>
          {statutoryDeductions.map((item) => <StatutoryDeductionItem key={item.id} item={item} onChange={updateStatutoryDeduction} onRemove={removeStatutoryDeduction} additionalFields={additionalFields} componentCodes={componentCodes} />)}
          <AddBtn onClick={addStatutoryDeduction} label="Add Statutory Deduction" color="slate" />
        </Section>

        {/* Other Deductions */}
        <Section icon={<MinusCircle className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-gray-700 to-gray-900" title="Other Deductions Configuration" subtitle="Configure how other deductions (loans, advances, welfare) appear on payslips" open={open.otherDeductions} onToggle={() => toggle('otherDeductions')}>
          {otherDeductions.map((item) => <OtherDeductionConfigItem key={item.id} item={item} onChange={updateOtherDeduction} onRemove={removeOtherDeduction} />)}
          <AddBtn onClick={addOtherDeduction} label="Add Deduction Config" color="gray" />
        </Section>

        {/* Income Items */}
        <Section icon={<PlusCircle className="h-5 w-5 text-white" />} iconBg="bg-gradient-to-br from-teal-500 to-teal-700" title="Additional Income Items" subtitle="Additional income items to show on payslips (Reimbursables, Other Payables, etc.)" open={open.incomeItems} onToggle={() => toggle('incomeItems')}>
          {incomeItems.map((item) => <IncomeItemRow key={item.id} item={item} onChange={updateIncomeItem} onRemove={removeIncomeItem} />)}
          <AddBtn onClick={addIncomeItem} label="Add Income Item" color="teal" />
        </Section>

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                <Settings className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{name || (isEdit ? 'Edit Salary Setting' : 'New Salary Setting')}</p>
                <p className="text-[11px] text-slate-400 truncate">{basicComponents.length} components · {allowances.length} allowances · {taxBrackets.length} brackets</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button type="button" onClick={() => router.back()} disabled={submitting} className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {isEdit ? 'Saving…' : 'Creating…'}</> : <><Save className="h-4 w-4" /> {isEdit ? 'Save Changes' : 'Create Setting'}</>}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}